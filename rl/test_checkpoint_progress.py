"""Measure neural learning progress on exactly the same development candles.

This is a descriptive, chronological SAME-WINDOW historical comparison,
not a claim of fresh forward trades, independent profit or model graduation.
"""
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import torch
from rl.dqn_experiment import QNetwork, evaluate, run, validate_snapshot, split_development
from rl.test_rapid_replay import snapshot


class CheckpointProgressTests(unittest.TestCase):
    def test_actual_previous_weights_compared_without_sealed_holdout(self):
        source=snapshot()
        all_bars=validate_snapshot(source)
        _,development,layout=split_development(all_bars)
        self.assertFalse(layout['sealedHoldoutTouched'])
        baseline_model=QNetwork()
        with tempfile.TemporaryDirectory() as tmp:
            checkpoint=Path(tmp)/'older-frozen.pt'
            blob=io.BytesIO()
            torch.save(baseline_model.state_dict(),blob)
            checkpoint.write_bytes(blob.getvalue())
            model_hash=hashlib.sha256(blob.getvalue()).hexdigest()
            report=run(source,episodes=1,seed=33,prior_checkpoint=checkpoint)
            compare=report['checkpointProgress']
            self.assertEqual(compare['previousModelSha256'],model_hash)
            self.assertEqual(compare['schema'],'SCALP_CHECKPOINT_SAME_WINDOW_DEVELOPMENT_V1')
            self.assertEqual(compare['comparisonStatus'],
                             'SAME_DEVELOPMENT_WINDOW_NOT_FORWARD_VERIFIED')
            self.assertEqual(compare['validationWindowSha256'],hashlib.sha256(
                json.dumps(development,sort_keys=True).encode()).hexdigest())
            before=evaluate(baseline_model,development)
            stress=evaluate(baseline_model,development,fee=.005,slippage=.002)
            self.assertAlmostEqual(compare['previousNetVirtual'],before['netProfitGbp'])
            self.assertAlmostEqual(compare['previousStressedNetVirtual'],stress['netProfitGbp'])
            self.assertAlmostEqual(compare['candidateNetVirtual'],report['validation']['netProfitGbp'])
            self.assertAlmostEqual(compare['candidateStressedNetVirtual'],
                                   report['validationDoubleCostStress']['netProfitGbp'])
            self.assertAlmostEqual(compare['deltaNetVirtual'],
                                   compare['candidateNetVirtual']-compare['previousNetVirtual'],places=3)
            self.assertAlmostEqual(compare['deltaStressedNetVirtual'],
                                   compare['candidateStressedNetVirtual']-compare['previousStressedNetVirtual'],
                                   places=3)
            self.assertFalse(compare['isIndependentForwardEvidence'])
            self.assertFalse(compare['automaticPromotion'])
            self.assertEqual(compare['paperOrders'],0)
            self.assertEqual(compare['liveOrders'],0)
            self.assertEqual(report['splits']['sealedHoldoutTouched'],False)
            self.assertEqual(checkpoint.read_bytes(),blob.getvalue())

    def test_first_ever_training_cannot_invent_a_predecessor(self):
        result=run(snapshot(),episodes=1,seed=34)
        compare=result['checkpointProgress']
        self.assertEqual(compare['comparisonStatus'],'FIRST_CHECKPOINT_NO_COMPARATOR')
        self.assertIsNone(compare['previousModelSha256'])
        self.assertIsNone(compare['deltaNetVirtual'])
        self.assertIsNone(compare['deltaStressedNetVirtual'])
        self.assertFalse(compare['improvedUnderBothCostAssumptions'])
        self.assertFalse(compare['isIndependentForwardEvidence'])
        self.assertFalse(compare['automaticPromotion'])


if __name__=='__main__':
    unittest.main()
