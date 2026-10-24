"""Behavioral tests for Universal-01 offline model transfer and checkpoint lineage."""
import hashlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from universal_student.run_github import execute, market_file


def sha(b):
    return hashlib.sha256(b).hexdigest()


class UniversalStudentTests(unittest.TestCase):
    def test_whitelist_rejects_unsupported_market(self):
        self.assertEqual(market_file("BTC/USD"), "BTC-USD.json")
        with self.assertRaises(ValueError):
            market_file("XAUUSD")
        with self.assertRaises(ValueError):
            market_file("../../bad")

    def fixtures(self, root):
        data, source, state = (root / p for p in ("data", "source", "state"))
        (data / "snapshots").mkdir(parents=True)
        (source / "models").mkdir(parents=True)
        (data / "snapshots" / "ETH-USD.json").write_text(json.dumps(
            {"symbol": "ETH/USD", "timeframe": "5Min", "bars": []}))
        model = b"saved-real-model-fixture"  # mocked offline weights; NEVER real profit
        (source / "models" / "BTC-USD-dqn.pt").write_bytes(model)
        (source / "models" / "BTC-USD-dqn.json").write_text(json.dumps({
            "symbol": "BTC/USD", "policySha256": sha(model),
            "modelType": "DEEP_Q_NETWORK", "paperOrders": 0, "liveOrders": 0}))
        return data, source, state

    def fake_engine(self):
        def fake_run(snapshot, episodes, seed, outdir, prior_checkpoint):
            target = snapshot["symbol"].replace("/", "-")
            old = Path(prior_checkpoint).read_bytes()
            new = old + b"-one-more-training-generation"
            outdir = Path(outdir)
            outdir.mkdir(parents=True, exist_ok=True)
            (outdir / (target + "-dqn.pt")).write_bytes(new)
            return {
                "policySha256": sha(new),
                "previousCheckpointSha256": sha(old),
                "paperOrders": 0, "liveOrders": 0,
                "officialGrade": None, "champion": False,
                "splits": {"sealedHoldoutTouched": False},
                "training": {"gradientUpdates": 12, "simulatedClosedTrades": 4},
                "validation": {"netProfitGbp": -2.5, "closedTrades": 2,
                               "wins": 1, "maxDrawdownPct": 4.1},
                "validationDoubleCostStress": {"netProfitGbp": -3.6},
                "checkpointProgress": {"previousNetVirtual": -1.2,
                                       "deltaNetVirtual": -1.3}
            }
        return types.SimpleNamespace(run=fake_run, validate_snapshot=lambda _: [])

    def test_cross_market_transfer_and_second_generation_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            data, source, state = self.fixtures(Path(d))
            mock_engine = self.fake_engine()
            with patch.dict(sys.modules, {"rl.dqn_experiment": mock_engine}):
                first = execute(target="ETH/USD", source="BTC/USD", episodes=2,
                                data_root=data, seed_root=source, state_root=state)
                second = execute(target="ETH/USD", source="ETH/USD", episodes=2,
                                 data_root=data, seed_root=source, state_root=state)
            self.assertEqual((first["generation"], second["generation"]), (1, 2))
            self.assertEqual((source / "models" / "BTC-USD-dqn.pt").read_bytes(),
                             b"saved-real-model-fixture")
            base = state / "universal-student-data" / "markets"
            history = json.loads((base / "ETH-USD.json").read_text())
            self.assertEqual(len(history["generations"]), 2)
            self.assertEqual(history["sourceSymbol"], "BTC/USD")
            self.assertEqual(history["generations"][0]["seedOrigin"], "TRANSFER_SEED")
            self.assertEqual(history["generations"][1]["seedOrigin"], "OWN_PRIOR_GENERATION")
            self.assertTrue((state / "universal-student-models" / "ETH-USD-gen1.pt").exists())
            self.assertTrue((state / "universal-student-models" / "ETH-USD-gen2.pt").exists())
            self.assertEqual(history["brokerOrders"], 0)
            self.assertIsNone(history["officialGrade"])

    def test_tampered_seed_refused(self):
        with tempfile.TemporaryDirectory() as d:
            data, source, state = self.fixtures(Path(d))
            (source / "models" / "BTC-USD-dqn.pt").write_bytes(b"tampered")
            with patch.dict(sys.modules, {"rl.dqn_experiment": self.fake_engine()}):
                with self.assertRaisesRegex(ValueError, "integrity"):
                    execute(target="ETH/USD", source="BTC/USD", episodes=1,
                            data_root=data, seed_root=source, state_root=state)
            self.assertFalse((state / "universal-student-data").exists())


if __name__ == "__main__":
    unittest.main()
