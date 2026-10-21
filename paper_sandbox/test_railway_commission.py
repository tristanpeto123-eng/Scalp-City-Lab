"""Commission host tests exercise real read-only methods with fake Alpaca."""
import json
import tempfile
import unittest
from pathlib import Path

from paper_sandbox.railway_commission import (
    PAPER, APP, private_storage_status, read_only_preflight,
    report_status, _source_credentials, _broker_get,
)


class CommissionTests(unittest.TestCase):
    def credentials(self):
        return {'SCALP_EXISTING_TEACHER_PAPER_CREDENTIALS_JSON': json.dumps({
            'BTC/USD': {'key':'test-paper-source','secret':'test-paper-secret'}
        }), 'SCALP_EXISTING_TEACHER_SOURCE_SYMBOL':'BTC/USD',
        'SCALP_DEMO_PAPER_ACCOUNT_ID':'paper-account-1',
        'SCALP_READ_ONLY_ACCOUNT_PREFLIGHT':'YES'}

    def test_no_credentials_means_never_claim_account_is_connected(self):
        with tempfile.TemporaryDirectory() as directory:
            result=report_status({},Path(directory))
        self.assertTrue(result['storageReady'])
        self.assertFalse(result['writerEnabled'])
        self.assertEqual(result['account']['status'],'GET_ONLY_PREFLIGHT_NOT_REQUESTED')
        self.assertEqual(result['paperOrdersSubmitted'],0)
        self.assertEqual(read_only_preflight({})['status'],'CREDENTIAL_REFERENCE_MISSING')

    def test_source_reference_reads_existing_teacher_symbol_without_exposing_secret(self):
        env=self.credentials()
        requests=[]
        def fake(url,method,headers):
            requests.append((url,method))
            self.assertEqual(method,'GET')
            self.assertEqual(headers['APCA-API-KEY-ID'],'test-paper-source')
            if url==PAPER+'/v2/account':
                return {'id':'paper-account-1','status':'ACTIVE','currency':'USD',
                        'trading_blocked':False,'account_blocked':False}
            if url==PAPER+'/v2/orders?status=all&limit=500':
                return []
            if url==PAPER+'/v2/positions':
                return []
            raise AssertionError('Unexpected endpoint')
        with tempfile.TemporaryDirectory() as directory:
            result=report_status(env,Path(directory),fake)
        account=result['account']
        self.assertEqual(account['status'],'PAPER_READ_ONLY_ACCOUNT_VERIFIED')
        self.assertTrue(account['accountIdentityPinned'])
        self.assertEqual(account['mappedCredentialSymbol'],'BTC/USD')
        self.assertEqual(len(requests),3)
        self.assertTrue(all(url.startswith(PAPER+'/v2/') for url,_ in requests))
        serialized=json.dumps(result)
        self.assertNotIn('test-paper-source',serialized)
        self.assertNotIn('test-paper-secret',serialized)
        self.assertNotIn('paper-account-1',serialized)
        self.assertEqual(account['historicalOrderCount'],0)

    def test_alpaca_paper_uuid_not_guessed_and_cannot_substitute_wrong_account(self):
        env=self.credentials()
        env['SCALP_DEMO_PAPER_ACCOUNT_ID']='wrong-id'
        def fake(url,method,headers):
            if url.endswith('/v2/account'):
                return {'id':'paper-account-1','status':'ACTIVE'}
            return []
        result=read_only_preflight(env,fake)
        self.assertFalse(result['accountIdentityPinned'])
        self.assertEqual(result['status'],'PAPER_ACCOUNT_OBSERVED_AWAITING_ID_PIN')

    def test_missing_wrong_or_truncated_broker_data_fails_closed(self):
        env=self.credentials()
        for payload in [None, [], {}, list(range(500))]:
            def fake(url,method,headers):
                if url.endswith('/v2/account'):
                    return {'id':'paper-account-1','status':'ACTIVE'}
                if 'orders?' in url:
                    return payload
                return []
            result=read_only_preflight(env,fake)
            self.assertEqual(result['status'],'PAPER_ACCOUNT_HISTORY_OR_STATUS_UNVERIFIED')
        env['SCALP_EXISTING_TEACHER_SOURCE_SYMBOL']='WRONG/USD'
        self.assertEqual(_source_credentials(env)[1],'INVALID_SOURCE_SYMBOL')

    def test_api_can_never_issue_a_write_even_with_valid_keys(self):
        with self.assertRaises(ValueError):
            _broker_get('/v2/orders', 'paper','paper')
        with self.assertRaises(ValueError):
            _broker_get('/v2/orders?status=all&limit=1000','paper','paper')
        with self.assertRaises(ValueError):
            _broker_get('/v2/account/activities','paper','paper')

    def test_canary_survives_restart_and_tampering_fails_readiness(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'journal'
            self.assertTrue(private_storage_status(path))
            self.assertTrue(private_storage_status(path))
            (path/'read-only-host-ready').write_bytes(b'ALTERED')
            self.assertFalse(private_storage_status(path))


if __name__=='__main__':
    unittest.main()
