"""Demo-only Alpaca PAPER preflight and guarded model decision executor.

Zero support for live endpoint; no broker orders without exact frozen
checkpoint, paper account identity, dedicated secrets and enabled gate.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import math
import os
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
import numpy as np
import torch
from rl.dqn_experiment import FIVE_MIN_MS, QNetwork, MarketEnv, SYMBOLS

PAPER='https://paper-api.alpaca.markets'
DATA='https://data.alpaca.markets'
MAX_ORDER_USD=10.00
MAX_DAILY_ORDERS=4
PREFIX='SCALPDEMO5M-'
class FailClosed(Exception):pass

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*a,**k):raise FailClosed('HTTP redirects prohibited on paper requests')

def api_request(base,path,*,key,secret,method='GET',body=None,transport=None):
 if base not in (PAPER,DATA) or not path.startswith('/') or '//' in path:
  raise FailClosed('Only pinned Alpaca paper/data API hosts permitted')
 if base==PAPER and not (path.startswith('/v2/account') or
      path.startswith('/v2/orders') or path.startswith('/v2/positions')):
  raise FailClosed('Unapproved PAPER API resource')
 if base==DATA and not path.startswith('/v1beta3/crypto/us-1/bars?'):
  raise FailClosed('Unapproved data API resource')
 if method not in ('GET','POST') or (method=='POST' and (
      base!=PAPER or path!='/v2/orders')):
  raise FailClosed('Only PAPER orders can be POSTed')
 if not key or not secret:raise FailClosed('Missing dedicated demo PAPER credentials')
 url=base+path
 headers={'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,
          'Accept':'application/json','Content-Type':'application/json'}
 data=json.dumps(body).encode() if body is not None else None
 request=urllib.request.Request(url,data=data,headers=headers,method=method)
 if transport:
  result=transport(url,method,body,headers)
 else:
  try:
   with urllib.request.build_opener(NoRedirect).open(request,timeout=15) as response:
    if response.status<200 or response.status>=300:raise FailClosed('Provider HTTP '+str(response.status))
    result=json.load(response)
  except FailClosed:raise
  except Exception as exc:raise FailClosed('PAPER/data connectivity failure: '+type(exc).__name__) from exc
 return result

def auth_config(env):
 key=env.get('SCALP_DEMO_PAPER_KEY')
 secret=env.get('SCALP_DEMO_PAPER_SECRET')
 account_id=env.get('SCALP_DEMO_PAPER_ACCOUNT_ID')
 if not key or not secret or not account_id:
  raise FailClosed('Dedicated demo PAPER credentials and expected account ID required')
 if env.get('APCA_API_BASE_URL','') not in ('',PAPER):
  raise FailClosed('A configured non-paper brokerage endpoint is prohibited')
 return key,secret,account_id

def preflight(*,env,transport=None,shared_mode=False):
 key,secret,expected=auth_config(env)
 account=api_request(PAPER,'/v2/account',key=key,secret=secret,transport=transport)
 if (not isinstance(account,dict) or account.get('id')!=expected or
     account.get('status')!='ACTIVE' or account.get('currency','USD')!='USD' or
     account.get('trading_blocked') not in (False,None) or
     account.get('account_blocked') not in (False,None)):
  raise FailClosed('Paper account identity/status mismatch or restricted account')
 orders=api_request(PAPER,'/v2/orders?status=all&limit=500',key=key,secret=secret,transport=transport)
 positions=api_request(PAPER,'/v2/positions',key=key,secret=secret,transport=transport)
 if not isinstance(orders,list) or not isinstance(positions,list) or len(orders)>=500:
  raise FailClosed('Paper order/position ledger missing or truncated')
 for order in orders:
  client=order.get('client_order_id','')
  if not isinstance(client,str):
   raise FailClosed('Untrusted broker client order ID')
  if client.startswith(PREFIX):
   continue
  if (shared_mode and len(client)==42 and client.startswith('teacher-') and
      all(c in '0123456789abcdef' for c in client[8:]) and
      order.get('status') in ('filled','canceled','cancelled','expired','rejected','done_for_day')):
   continue
  raise FailClosed('Dedicated demo account contains unrelated or active Teacher orders')
 return {'account':account,'orders':orders,'positions':positions,'paperEndpoint':PAPER,
         'accountFingerprint':hashlib.sha256(expected.encode()).hexdigest()[:12]}

def verified_market_bars(*,key,secret,symbol,now,transport=None):
 if symbol not in SYMBOLS:raise FailClosed('Unsupported crypto pair')
 start=now-timedelta(hours=6)
 query=urllib.parse.urlencode({'symbols':symbol,'timeframe':'5Min',
        'start':start.isoformat(),'end':(now-timedelta(seconds=30)).isoformat(),
        'sort':'asc','limit':'1000'})
 result=api_request(DATA,'/v1beta3/crypto/us-1/bars?'+query,
    key=key,secret=secret,transport=transport)
 rows=result.get('bars',{}).get(symbol)
 if not isinstance(rows,list) or not 35<=len(rows)<=1000 or result.get('next_page_token'):
  raise FailClosed('Incomplete native five-minute broker data')
 out=[];last=None
 for bar in rows:
  try:
   t=int(datetime.fromisoformat(bar['t'].replace('Z','+00:00')).timestamp()*1000)
   o,h,l,c,v=[float(bar[k]) for k in ('o','h','l','c','v')]
  except Exception as exc:raise FailClosed('Malformed provider candle') from exc
  if (not all(math.isfinite(x) for x in (o,h,l,c,v)) or
      min(o,h,l,c)<=0 or v<0 or h<max(o,c,l) or l>min(o,c,h) or
      (last is not None and t-last!=FIVE_MIN_MS)):
   raise FailClosed('Noncontiguous/untrusted five-minute feed')
  last=t
  if t+FIVE_MIN_MS<=int(now.timestamp()*1000)-30000:
   out.append({'t':t,'o':o,'h':h,'l':l,'c':c,'v':v})
 if len(out)<35 or (now.timestamp()*1000-out[-1]['t'])>13*60*1000:
  raise FailClosed('Stale/incomplete last closed five-minute candle')
 return out

def paper_decision(*,env,model_file,now=None,transport=None,execute=False,
                   shared_mode=False,on_intent=None,on_ack=None):
 now=now or datetime.now(timezone.utc)
 if now.tzinfo is None:raise FailClosed('UTC-aware time mandatory')
 verified=preflight(env=env,transport=transport,shared_mode=shared_mode)
 key,secret,_=auth_config(env)
 symbol=env.get('SCALP_DEMO_SYMBOL','BTC/USD')
 sha=env.get('SCALP_DEMO_MODEL_SHA256','')
 if symbol not in SYMBOLS or len(sha)!=64 or any(x not in '0123456789abcdef' for x in sha):
  raise FailClosed('Exact frozen demo model SHA/symbol required')
 if not model_file or not Path(model_file).is_file():
  raise FailClosed('No dedicated frozen candidate checkpoint selected')
 data=Path(model_file).read_bytes()
 if hashlib.sha256(data).hexdigest()!=sha:
  raise FailClosed('Model SHA differs from explicitly pinned candidate')
 pos=verified['positions']
 if len(pos)>1 or (pos and pos[0].get('symbol','').replace('/','')!=symbol.replace('/','')):
  raise FailClosed('Unrelated existing demo positions block execution')
 acct=verified['account']
 if float(acct.get('cash',0))<20 or float(acct.get('equity',0))<20:
  raise FailClosed('Demo buying power/equity below minimum')
 if pos and abs(float(pos[0].get('market_value','0')))>12:
  raise FailClosed('Open paper position exceeds 12 USD gross cap')
 orders=verified['orders']
 today=now.date()
 daily=sum(datetime.fromisoformat(x['created_at'].replace('Z','+00:00')).date()==today
           for x in orders if x.get('created_at'))
 if daily>=MAX_DAILY_ORDERS:
  raise FailClosed('Demo order budget exhausted for today')
 if any(x.get('status') not in
        ('filled','canceled','cancelled','expired','rejected','done_for_day') for x in orders):
  raise FailClosed('Unfinished paper order blocks new placement')
 bars=verified_market_bars(key=key,secret=secret,symbol=symbol,now=now,transport=transport)
 model=QNetwork()
 model.load_state_dict(torch.load(io.BytesIO(data),map_location='cpu',weights_only=True),strict=True)
 model.eval()
 env_sim=MarketEnv(bars)
 env_sim.i=len(bars)-1
 if pos:
  env_sim.units=max(1e-12,float(pos[0].get('qty',0)))
  env_sim.cash=float(acct.get('cash',0))
  env_sim.peak=max(float(acct.get('equity',0)),env_sim.equity(bars[-1]['c']))
 with torch.no_grad():
  action=int(model(torch.from_numpy(env_sim.observation())).argmax().item())
 target='LONG' if action==1 else 'FLAT'
 have=bool(pos)
 side='buy' if target=='LONG' and not have else ('sell' if target=='FLAT' and have else None)
 # Exact candle/symbol/model deterministic client order id for retry dedupe.
 order_id=PREFIX+hashlib.sha256(
   (symbol+str(bars[-1]['t'])+sha+str(side)).encode()).hexdigest()[:31]
 if any(x.get('client_order_id')==order_id for x in orders):
  side=None
 plan={'status':'PAPER_PLAN_ONLY','source':'COMPLETED_5MIN_CRYPTO',
    'paperEndpoint':PAPER,'symbol':symbol,'modelSha256':sha,
    'signal':target,'lastCompletedCandle':bars[-1]['t'],
    'orderSide':side,'orderClientId':order_id if side else None,
    'accountFingerprint':verified['accountFingerprint'],
    'paperOnly':True,'liveOrders':0,'demoOrderSubmitted':False}
 if not execute or not side:return plan
 # Legacy GitHub Actions is an ephemeral runner: no persistent broker intent
 # journal or shared-account lock can be trusted there.
 if env.get('GITHUB_ACTIONS')=='true':
  raise FailClosed('Ephemeral GitHub runner cannot place PAPER orders')
 # In production the old single-account standalone path has been retired.
 # The shared account must use shared_runtime under a durable journal lock.
 if not shared_mode and transport is None:
  raise FailClosed('Legacy standalone PAPER POST disabled; use shared single-writer runtime')
 if env.get('SCALP_DEMO_PAPER_ENABLED')!='YES_DEMO_ONLY':
  raise FailClosed('Demo POST explicitly disabled; preflight only')
 payload={'symbol':symbol,'side':side,'type':'market','time_in_force':'gtc',
          'client_order_id':order_id}
 if side=='buy':
  payload['notional']='5.00'
 else:
  qty=float(pos[0].get('qty','0'))
  if qty<=0:raise FailClosed('No paper position to close')
  payload['qty']=format(qty,'.8f')
 if (on_intent is None)!=(on_ack is None):
  raise FailClosed('Both durable intent and acknowledgement callbacks are mandatory')
 if shared_mode and (on_intent is None or on_ack is None):
  raise FailClosed('Shared paper execution requires a durable single-writer journal')
 if on_intent:
  on_intent({'clientOrderId':order_id,'symbol':symbol,
    'side':side,'modelSha256':sha,
    'accountFingerprint':hashlib.sha256(auth_config(env)[2].encode()).hexdigest(),
    'sourceCandleMs':bars[-1]['t'],'maxOrderUsd':'10.00',
    'paperOnly':True,'liveOrders':0})
 order=api_request(PAPER,'/v2/orders',key=key,secret=secret,method='POST',
                   body=payload,transport=transport)
 if not isinstance(order,dict) or order.get('client_order_id')!=order_id:
  raise FailClosed('Paper order reply did not confirm client ID')
 if on_ack:
  if not isinstance(order.get('id'),str) or not order['id']:
   raise FailClosed('Broker acknowledgement lacks actual order identity')
  on_ack({'clientOrderId':order_id,'brokerOrderId':order['id'],
   'providerStatus':str(order.get('status','unknown')),'paperOnly':True})
 plan.update(status='PAPER_ORDER_SUBMITTED_NOT_FILLED',demoOrderSubmitted=True,
             paperOrderStatus=order.get('status','unknown'))
 return plan

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument('--mode',choices=('preflight','plan','paper'),default='preflight')
 parser.add_argument('--model',default=None)
 args=parser.parse_args()
 if args.mode=='preflight':
  r=preflight(env=os.environ)
  print('PAPER_PREFLIGHT '+json.dumps({'status':'PAPER_ACCOUNT_VERIFIED',
      'accountFingerprint':r['accountFingerprint'],'openPositions':len(r['positions']),
      'historicalOrders':len(r['orders']),'liveOrders':0}))
 else:
  r=paper_decision(env=os.environ,model_file=args.model,
                   execute=args.mode=='paper')
  print('PAPER_DEMO '+json.dumps(r))
if __name__=='__main__':
 try:main()
 except FailClosed as exc:
  raise SystemExit('PAPER_FAIL_CLOSED: '+str(exc))
