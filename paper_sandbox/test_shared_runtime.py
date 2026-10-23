"""Shared PAPER one-writer integration tests with fake Alpaca transport only."""
import hashlib
import tempfile
import unittest
from pathlib import Path

from paper_sandbox.paper_executor import FailClosed, PAPER, PREFIX
from paper_sandbox.test_paper_executor import FakeTransport, NOW, setup
from paper_sandbox.shared_ledger import PaperIntentJournal
from paper_sandbox.shared_runtime import shared_cycle


class StatefulFakePaper(FakeTransport):
    def __init__(self):
        super().__init__()
        self.fail_post=False
    def __call__(self,url,method,payload,headers):
        if method=='POST' and url==PAPER+'/v2/orders':
            self.calls.append((url,method,payload))
            if self.fail_post:
                raise TimeoutError('simulated no-acknowledgement network failure')
            order_id='broker-paper-001'
            self.orders.append({
                'id':order_id,'symbol':payload['symbol'],
                'client_order_id':payload['client_order_id'],
                'side':payload['side'],'status':'filled',
                'filled_qty':'0.05',
                'created_at':NOW.isoformat()
            })
            return {'id':order_id,'client_order_id':payload['client_order_id'],
                    'status':'filled'}
        return super().__call__(url,method,payload,headers)


def config(folder):
    env,blob=setup()
    env.update(SCALP_SHARED_ACCOUNT_MODE='SINGLE_WRITER_TEACHER_READ_ONLY',
      SCALP_SHARED_PAPER_APPROVED='EXACT_SHARED_PAPER_PILOT_V1',
      SCALP_SHARED_TEACHER_WRITES_OFF='YES',
      SCALP_SHARED_ACCOUNT_JOURNAL_DIR=str(folder),
      SCALP_INTERNAL_MOCK_ONLY='YES_UNIT_TEST',
      GITHUB_ACTIONS='false')
    return env,blob


class SharedRuntimeTests(unittest.TestCase):
    def test_read_only_preflight_works_with_one_existing_alpaca_paper_account(self):
        env,_=config('/tmp/unused-test-paper-host')
        transport=StatefulFakePaper()
        result=shared_cycle(env=env,model_file=None,transport=transport,execute=False)
        self.assertEqual(result['status'],'SHARED_PAPER_PREFLIGHT_ONLY')
        self.assertTrue(result['paperOnly'])
        self.assertFalse(any(c[1]=='POST' for c in transport.calls))

    def test_real_simulated_post_is_once_only_and_logged_before_broker_post(self):
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            model=Path(dirname)/'frozen-model.pt';model.write_bytes(blob)
            transport=StatefulFakePaper()
            result=shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            self.assertTrue(result['singleWriter'])
            self.assertTrue(result['teacherReadOnly'])
            self.assertTrue(result['demoOrderSubmitted'])
            self.assertEqual(result['liveOrders'],0)
            self.assertEqual(result['status'],'PAPER_ORDER_SUBMITTED_NOT_FILLED')
            entries=PaperIntentJournal(env['SCALP_SHARED_ACCOUNT_JOURNAL_DIR']).read_verified()
            self.assertEqual([e['kind'] for e in entries],['INTENT','ACK'])
            self.assertEqual(entries[0]['data']['modelSha256'],env['SCALP_DEMO_MODEL_SHA256'])
            self.assertEqual(entries[1]['data']['brokerOrderId'],'broker-paper-001')
            self.assertEqual(sum(method=='POST' for _,method,_ in transport.calls),1)
            second=shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            self.assertFalse(second['demoOrderSubmitted'])
            self.assertEqual(sum(method=='POST' for _,method,_ in transport.calls),1)
            self.assertEqual(PaperIntentJournal(env['SCALP_SHARED_ACCOUNT_JOURNAL_DIR']).unresolved(),set())

    def test_ambiguous_post_stays_unresolved_no_retry(self):
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            model=Path(dirname)/'frozen-model.pt';model.write_bytes(blob)
            transport=StatefulFakePaper();transport.fail_post=True
            with self.assertRaises(TimeoutError):
                shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            journal=PaperIntentJournal(env['SCALP_SHARED_ACCOUNT_JOURNAL_DIR'])
            self.assertEqual(len(journal.unresolved()),1)
            transport.fail_post=False
            with self.assertRaisesRegex(FailClosed,'Unresolved prior demo POST'):
                shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            self.assertEqual(sum(method=='POST' for _,method,_ in transport.calls),1)

    def test_github_runner_always_forbidden_for_shared_writer(self):
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            env['GITHUB_ACTIONS']='true'
            model=Path(dirname)/'model.pt';model.write_bytes(blob)
            transport=StatefulFakePaper()
            with self.assertRaisesRegex(FailClosed,'Ephemeral GitHub Actions'):
                shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            self.assertFalse(any(c[1]=='POST' for c in transport.calls))

    def test_teacher_past_orders_allowed_read_only_but_same_symbol_disallowed_for_trade(self):
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            model=Path(dirname)/'model.pt';model.write_bytes(blob)
            transport=StatefulFakePaper()
            transport.orders=[{
                'id':'teacher-01','client_order_id':'teacher-'+'f'*34,
                'symbol':'ETH/USD','side':'buy','status':'filled',
                'filled_qty':'0.01','created_at':NOW.isoformat()
            }]
            outcome=shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            self.assertTrue(outcome['demoOrderSubmitted'])
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            model=Path(dirname)/'model.pt';model.write_bytes(blob)
            transport=StatefulFakePaper()
            transport.orders=[{
                'id':'teacher-01','client_order_id':'teacher-'+'f'*34,
                'symbol':'BTC/USD','side':'buy','status':'filled',
                'filled_qty':'0.01','created_at':NOW.isoformat()
            }]
            with self.assertRaisesRegex(FailClosed,'inventory/fee attribution'):
                shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)

    def test_no_live_credentials_and_non_data_private_root_are_blocked(self):
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            env.pop('SCALP_INTERNAL_MOCK_ONLY')
            model=Path(dirname)/'model.pt';model.write_bytes(blob)
            transport=StatefulFakePaper()
            with self.assertRaisesRegex(FailClosed,'/data journal'):
                shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)
            env['SCALP_INTERNAL_MOCK_ONLY']='YES_UNIT_TEST'
            env['APCA_API_BASE_URL']='https://api.alpaca.markets'
            with self.assertRaisesRegex(FailClosed,'non-paper'):
                shared_cycle(env=env,model_file=model,transport=transport,now=NOW,execute=True)



    def test_private_shared_order_host_is_locked_in_source_even_with_all_env_flags(self):
        with tempfile.TemporaryDirectory() as dirname:
            env,blob=config(Path(dirname)/'journal')
            env['SCALP_SHARED_ACCOUNT_JOURNAL_DIR']='/data/scalp-paper'
            env['SCALP_SHARED_PAPER_APPROVED']='EXACT_SHARED_PAPER_PILOT_V1'
            env['SCALP_DEMO_PAPER_ENABLED']='YES_DEMO_ONLY'
            with self.assertRaisesRegex(FailClosed,'source-locked'):
                shared_cycle(env=env,model_file=None,transport=None,execute=True)

if __name__=='__main__':
    unittest.main()
