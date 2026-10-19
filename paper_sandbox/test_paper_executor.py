import hashlib,io,tempfile,unittest
from pathlib import Path
from datetime import datetime,timedelta,timezone
import torch
from rl.dqn_experiment import QNetwork
from paper_sandbox.paper_executor import (PAPER,DATA,PREFIX,FailClosed,
 auth_config,preflight,paper_decision,api_request)

NOW=datetime(2026,10,19,21,55,0,tzinfo=timezone.utc)
def setup():
 env={'SCALP_DEMO_PAPER_KEY':'paper-only-key','SCALP_DEMO_PAPER_SECRET':'paper-only-secret',
      'SCALP_DEMO_PAPER_ACCOUNT_ID':'paper-account-uuid',
      'SCALP_DEMO_SYMBOL':'BTC/USD','SCALP_DEMO_PAPER_ENABLED':'YES_DEMO_ONLY'}
 policy=QNetwork()
 with torch.no_grad():
  policy.net[-1].weight.zero_()
  policy.net[-1].bias[:]=torch.tensor([-10.0,10.0])
 blob=io.BytesIO();torch.save(policy.state_dict(),blob)
 env['SCALP_DEMO_MODEL_SHA256']=hashlib.sha256(blob.getvalue()).hexdigest()
 return env,blob.getvalue()
class FakeTransport:
 def __init__(self):
  self.calls=[];self.positions=[];self.orders=[]
  first=NOW-timedelta(hours=6)
  self.bars=[]
  for i in range(72):
   self.bars.append({'t':(first+timedelta(minutes=5*i)).isoformat(),
      'o':100.0,'h':101.0,'l':99.0,'c':100.25,'v':100.0})
 def __call__(self,url,method,payload,headers):
  self.calls.append((url,method,payload))
  if url==PAPER+'/v2/account':
   return {'id':'paper-account-uuid','status':'ACTIVE','currency':'USD',
           'cash':'1000','equity':'1000','trading_blocked':False,'account_blocked':False}
  if url.startswith(PAPER+'/v2/orders?'):return self.orders
  if url==PAPER+'/v2/positions':return self.positions
  if url.startswith(DATA+'/v1beta3/crypto/us-1/bars?'):
   return {'bars':{'BTC/USD':self.bars},'next_page_token':None}
  if url==PAPER+'/v2/orders' and method=='POST':
   return {'status':'accepted','client_order_id':payload['client_order_id']}
  raise AssertionError('Unexpected request '+url)

class PaperSandboxTests(unittest.TestCase):
 def test_pinned_paper_host_forbids_live_endpoint(self):
  env,_=setup()
  with self.assertRaises(FailClosed):
   api_request('https://api.alpaca.markets','/v2/orders',
      key=env['SCALP_DEMO_PAPER_KEY'],secret=env['SCALP_DEMO_PAPER_SECRET'],
      method='POST',body={})
  env['APCA_API_BASE_URL']='https://api.alpaca.markets'
  with self.assertRaisesRegex(FailClosed,'non-paper'):
   auth_config(env)

 def test_dedicated_paper_account_identity_and_isolation(self):
  env,_=setup();transport=FakeTransport()
  self.assertEqual(preflight(env=env,transport=transport)['paperEndpoint'],PAPER)
  env['SCALP_DEMO_PAPER_ACCOUNT_ID']='another-account'
  with self.assertRaisesRegex(FailClosed,'identity'):
   preflight(env=env,transport=transport)
  env['SCALP_DEMO_PAPER_ACCOUNT_ID']='paper-account-uuid'
  transport.orders=[{'client_order_id':'MANUAL-ALPACA-ORDER'}]
  with self.assertRaisesRegex(FailClosed,'unrelated'):
   preflight(env=env,transport=transport)

 def test_dry_run_does_not_post_even_for_long_model(self):
  env,blob=setup();transport=FakeTransport()
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/'candidate.pt';f.write_bytes(blob)
   outcome=paper_decision(env=env,model_file=f,now=NOW,
       transport=transport,execute=False)
  self.assertEqual(outcome['signal'],'LONG')
  self.assertEqual(outcome['orderSide'],'buy')
  self.assertEqual(outcome['status'],'PAPER_PLAN_ONLY')
  self.assertTrue(all(call[1]=='GET' for call in transport.calls))

 def test_authorised_tiny_paper_order_never_routes_to_live(self):
  env,blob=setup();transport=FakeTransport()
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/'candidate.pt';f.write_bytes(blob)
   result=paper_decision(env=env,model_file=f,now=NOW,
                           transport=transport,execute=True)
  posted=[c for c in transport.calls if c[1]=='POST']
  self.assertEqual(len(posted),1)
  self.assertEqual(posted[0][0],PAPER+'/v2/orders')
  self.assertEqual(posted[0][2]['notional'],'5.00')
  self.assertTrue(posted[0][2]['client_order_id'].startswith(PREFIX))
  self.assertTrue(result['demoOrderSubmitted'])
  self.assertFalse(result['liveOrders'])
  self.assertNotIn('live',posted[0][0])

 def test_explicit_enable_gate_and_checkpoint_provenance(self):
  env,blob=setup();transport=FakeTransport()
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/'candidate.pt';f.write_bytes(blob)
   env['SCALP_DEMO_PAPER_ENABLED']=''
   with self.assertRaisesRegex(FailClosed,'explicitly disabled'):
    paper_decision(env=env,model_file=f,now=NOW,transport=transport,execute=True)
   self.assertEqual(len([x for x in transport.calls if x[1]=='POST']),0)
   env['SCALP_DEMO_PAPER_ENABLED']='YES_DEMO_ONLY'
   f.write_bytes(b'tampered')
   with self.assertRaisesRegex(FailClosed,'SHA differs'):
    paper_decision(env=env,model_file=f,now=NOW,transport=transport,execute=True)

 def test_incomplete_bar_and_daily_order_limit_fail_closed(self):
  env,blob=setup();transport=FakeTransport()
  with tempfile.TemporaryDirectory() as d:
   f=Path(d)/'candidate.pt';f.write_bytes(blob)
   transport.bars[31]['t']=transport.bars[30]['t']
   with self.assertRaisesRegex(FailClosed,'Noncontiguous'):
    paper_decision(env=env,model_file=f,now=NOW,transport=transport,execute=True)
   transport=FakeTransport()
   transport.orders=[{'client_order_id':PREFIX+str(i),
      'created_at':NOW.isoformat(),'status':'filled'} for i in range(4)]
   with self.assertRaisesRegex(FailClosed,'budget'):
    paper_decision(env=env,model_file=f,now=NOW,transport=transport,execute=True)

if __name__=='__main__':unittest.main()
