"""Real file locking, append-only evidence and interrupted POST safety tests."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from paper_sandbox.shared_ledger import (
    PaperIntentJournal, JournalError, GENESIS
)


def intent(client='SCALPDEMO5M-'+'a'*31):
    return {
        'clientOrderId':client,'symbol':'BTC/USD','side':'buy',
        'modelSha256':'b'*64,'accountFingerprint':'c'*64,
        'sourceCandleMs':1792540200000,'maxOrderUsd':'10.00',
        'paperOnly':True,'liveOrders':0
    }


def ack(client='SCALPDEMO5M-'+'a'*31):
    return {'clientOrderId':client,'brokerOrderId':'paper-broker-1',
            'providerStatus':'accepted','paperOnly':True}


class SharedPaperLedgerTests(unittest.TestCase):
    def test_atomic_intent_ack_and_source_verified_observer_export(self):
        with tempfile.TemporaryDirectory() as dirname:
            first=PaperIntentJournal(dirname)
            with first.writer():
                first.append('INTENT',intent())
                self.assertEqual(first.unresolved(),{intent()['clientOrderId']})
                first.append('ACK',ack())
                self.assertEqual(first.unresolved(),set())
                receipt=first.export_observer_receipt()
                self.assertEqual(receipt['modelIntents'][0]['modelSha256'],'b'*64)
                self.assertEqual(receipt['teacherGrades'],0)
                self.assertFalse(receipt['forwardVerified'])
            reread=PaperIntentJournal(dirname)
            with reread.writer():
                self.assertEqual(len(reread.read_verified()),2)
                self.assertEqual(reread.read_verified()[0]['prev'],GENESIS)
                self.assertEqual(reread.unresolved(),set())
                with self.assertRaisesRegex(JournalError,'Repeated'):
                    reread.append('INTENT',intent())
                reread.append('INTENT',intent('SCALPDEMO5M-'+'d'*31))
            with self.assertRaisesRegex(JournalError,'Only exclusive'):
                reread.append('INTENT',intent('SCALPDEMO5M-'+'e'*31))

    def test_ambiguous_post_crash_blocks_replay_and_auto_retry(self):
        with tempfile.TemporaryDirectory() as dirname:
            j=PaperIntentJournal(dirname)
            with j.writer():
                j.append('INTENT',intent())
            with j.writer():
                self.assertEqual(j.unresolved(),{intent()['clientOrderId']})
                with self.assertRaisesRegex(JournalError,'Unresolved previous order'):
                    j.append('INTENT',intent('SCALPDEMO5M-'+'d'*31))
            # No client-side retry has been performed.
            self.assertEqual(len(j.read_verified()),1)

    def test_single_writer_lock_rejects_concurrent_host_process(self):
        with tempfile.TemporaryDirectory() as dirname:
            first=PaperIntentJournal(dirname)
            second=PaperIntentJournal(dirname)
            with first.writer():
                with self.assertRaisesRegex(JournalError,'Concurrent paper writer'):
                    with second.writer():
                        self.fail('Second writer obtained lock')

    def test_corrupted_hash_sequence_and_truncated_event_fail_closed(self):
        with tempfile.TemporaryDirectory() as dirname:
            j=PaperIntentJournal(dirname)
            with j.writer():
                j.append('INTENT',intent())
                j.append('ACK',ack())
            path=Path(dirname)/'paper-intents.jsonl'
            original=path.read_text()
            path.write_text(original.replace('BTC/USD','ETH/USD',1))
            with self.assertRaisesRegex(JournalError,'hash chain altered'):
                j.read_verified()
            path.write_text(original[:-1])
            with self.assertRaisesRegex(JournalError,'Truncated'):
                j.read_verified()
            path.write_text(original)
            self.assertEqual(len(j.read_verified()),2)

    def test_invalid_intent_missing_provenance_never_written(self):
        with tempfile.TemporaryDirectory() as dirname:
            j=PaperIntentJournal(dirname)
            with j.writer():
                bad=intent();bad['modelSha256']='wrong'
                with self.assertRaisesRegex(JournalError,'Invalid'):
                    j.append('INTENT',bad)
                with self.assertRaisesRegex(JournalError,'ACK'):
                    j.append('ACK',ack())
            self.assertFalse(j.journal.exists())

    def test_symlinked_private_journal_cannot_redirect_audit(self):
        with tempfile.TemporaryDirectory() as dirname:
            private=Path(dirname)/'private';private.mkdir(mode=0o700)
            other=Path(dirname)/'unrelated'
            other.write_text('SECRET_NEVER_OVERWRITE')
            (private/'paper-intents.jsonl').symlink_to(other)
            with self.assertRaisesRegex(JournalError,'symlink'):
                with PaperIntentJournal(private).writer():
                    pass
            self.assertEqual(other.read_text(),'SECRET_NEVER_OVERWRITE')


if __name__=='__main__':
    unittest.main()
