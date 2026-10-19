import tempfile, unittest
from pathlib import Path
from rl.model_registry import freeze_candidate,validate_locked_checkpoint

class FrozenModelTests(unittest.TestCase):
 def test_frozen_checkpoint_never_changes_while_learner_evolves(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);weights=root/'latest.pt';weights.write_bytes(b'learner-v1')
   version=freeze_candidate(symbol='BTC/USD',learned_weights=weights,
                            registry_dir=root/'frozen',source_run_sha='a'*64)
   frozen=root/'frozen'/('BTC-USD-'+version['modelSha256']+'.pt')
   proof=frozen.with_suffix('.json')
   self.assertTrue(frozen.exists())
   self.assertFalse(version['tradingFloorAdmitted'])
   self.assertFalse(version['signedGradeVerified'])
   weights.write_bytes(b'learner-v2')
   self.assertEqual(frozen.read_bytes(),b'learner-v1')
   self.assertEqual(validate_locked_checkpoint(frozen,proof)['modelSha256'],
                    version['modelSha256'])
   next_version=freeze_candidate(symbol='BTC/USD',learned_weights=weights,
                          registry_dir=root/'frozen',source_run_sha='b'*64)
   self.assertNotEqual(version['modelSha256'],next_version['modelSha256'])
   self.assertEqual(frozen.read_bytes(),b'learner-v1')

 def test_tamper_or_false_lineage_fails(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);source=root/'learning.pt';source.write_bytes(b'legit')
   v=freeze_candidate(symbol='ETH/USD',learned_weights=source,
                        registry_dir=root/'frozen',source_run_sha='f'*64)
   pt=root/'frozen'/('ETH-USD-'+v['modelSha256']+'.pt')
   proof=pt.with_suffix('.json')
   with self.assertRaisesRegex(ValueError,'lineage'):
    freeze_candidate(symbol='ETH/USD',learned_weights=source,
                       registry_dir=root/'frozen',source_run_sha='a'*64)
   pt.write_bytes(b'altered')
   with self.assertRaisesRegex(ValueError,'SHA'):
    validate_locked_checkpoint(pt,proof)

if __name__=='__main__':unittest.main()
