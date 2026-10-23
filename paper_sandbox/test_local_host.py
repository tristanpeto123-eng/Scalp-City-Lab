"""No cloud costs, no broker requests in default mode, no trading on GitHub."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from paper_sandbox.local_host import HostBlocked, run_once


class BrokerSpy:
    def __init__(self):
        self.calls = []
    def preflight(self, **kwargs):
        self.calls.append(("preflight", kwargs))
        return {"accountFingerprint": "f" * 12, "orders": [], "positions": []}
    def paper_decision(self, **kwargs):
        self.calls.append(("plan", kwargs))
        return {"signal": "FLAT", "symbol": "LTC/USD",
                "modelSha256": kwargs["env"]["SCALP_DEMO_MODEL_SHA256"],
                "lastCompletedCandle": 1792704300000}
    def shared_cycle(self, **kwargs):
        self.calls.append(("PAPER", kwargs))
        return {"status": "PAPER_PLAN_ONLY", "demoOrderSubmitted": False,
                "modelSha256": kwargs["env"]["SCALP_DEMO_MODEL_SHA256"],
                "symbol": "LTC/USD", "accountFingerprint": "f" * 12}


class LocalHostTests(unittest.TestCase):
    def test_default_off_requires_no_provider_credentials_host_or_model(self):
        spy = BrokerSpy()
        result = run_once({}, backend=spy)
        self.assertEqual(result["status"], "HOST_OFFLINE_SAFE")
        self.assertFalse(result["diskReady"])
        self.assertEqual(result["brokerRequests"], 0)
        self.assertEqual(result["paperOrdersSubmitted"], 0)
        self.assertEqual(spy.calls, [])

    def test_unknown_mode_cannot_fall_through_to_broker(self):
        spy = BrokerSpy()
        with self.assertRaisesRegex(HostBlocked, "Invalid mode"):
            run_once({"SCALP_LOCAL_MODE": "live"}, backend=spy)
        self.assertEqual(spy.calls, [])

    def test_readonly_get_mode_never_posts_or_loads_model(self):
        spy = BrokerSpy()
        with patch("paper_sandbox.local_host._private_disk", return_value=True):
            result = run_once({"SCALP_LOCAL_MODE": "PREFLIGHT",
                "SCALP_SHARED_ACCOUNT_JOURNAL_DIR": "/data/scalp-paper"},
                backend=spy)
        self.assertEqual(result["status"], "PAPER_READ_ONLY_PREFLIGHT")
        self.assertEqual(result["brokerWrites"], 0)
        self.assertEqual([x[0] for x in spy.calls], ["preflight"])
        self.assertTrue(spy.calls[0][1]["shared_mode"])

    def test_private_disk_is_mandatory_for_any_network_mode(self):
        spy = BrokerSpy()
        for mode in ("PREFLIGHT", "PLAN", "PAPER"):
            with self.subTest(mode=mode):
                with self.assertRaisesRegex(HostBlocked, "Private persistent"):
                    run_once({"SCALP_LOCAL_MODE": mode}, backend=spy)
        self.assertEqual(spy.calls, [])

    def test_tiny_frozen_model_plan_is_hash_and_manifest_bound_and_readonly(self):
        spy = BrokerSpy()
        with tempfile.TemporaryDirectory() as tmp:
            from rl.model_registry import freeze_candidate
            checkpoint = Path(tmp) / "model.pt"
            checkpoint.write_bytes(b"synthetic fixture never traded")
            registry = Path(tmp) / "frozen"
            manifest = freeze_candidate(
                symbol="LTC/USD", learned_weights=checkpoint,
                registry_dir=registry, source_run_sha="9"*64)
            path = registry / ("LTC-USD-" + manifest["modelSha256"] + ".pt")
            meta = path.with_suffix(".json")
            env = {"SCALP_LOCAL_MODE": "PLAN",
                "SCALP_DEMO_MODEL_SHA256": manifest["modelSha256"],
                "SCALP_DEMO_SYMBOL": "LTC/USD",
                "SCALP_LOCAL_MODEL_FILE": str(path),
                "SCALP_LOCAL_MODEL_MANIFEST": str(meta),
                "SCALP_SHARED_ACCOUNT_JOURNAL_DIR": "/data/scalp-paper"}
            with patch("paper_sandbox.local_host._private_disk", return_value=True):
                plan = run_once(env, backend=spy)
            self.assertEqual(plan["status"], "PAPER_READ_ONLY_PLAN")
            self.assertEqual(plan["brokerWrites"], 0)
            self.assertEqual(spy.calls[-1][0], "plan")
            self.assertFalse(spy.calls[-1][1]["execute"])
            path.write_bytes(b"changed checkpoint")
            with patch("paper_sandbox.local_host._private_disk", return_value=True):
                with self.assertRaisesRegex(HostBlocked, "integrity"):
                    run_once(env, backend=spy)
            self.assertEqual([x[0] for x in spy.calls], ["plan"])

    def test_no_owner_release_no_paper_even_with_synthetically_mocked_broker(self):
        spy = BrokerSpy()
        with patch("paper_sandbox.local_host._private_disk", return_value=True):
            with self.assertRaisesRegex(HostBlocked, "owner release"):
                run_once({"SCALP_LOCAL_MODE": "PAPER",
                    "SCALP_SHARED_ACCOUNT_JOURNAL_DIR": "/data/scalp-paper"},
                    backend=spy)
        self.assertEqual(spy.calls, [])

    def test_github_runner_can_never_be_paper_host(self):
        spy = BrokerSpy()
        env = {"SCALP_LOCAL_MODE": "PAPER",
               "GITHUB_ACTIONS": "true",
               "SCALP_SHARED_ACCOUNT_JOURNAL_DIR": "/data/scalp-paper",
               "SCALP_LOCAL_HOST_OWNER_RELEASE": "EXACT_LOCAL_PAPER_V1"}
        with patch("paper_sandbox.local_host._private_disk", return_value=True):
            with self.assertRaisesRegex(HostBlocked, "GitHub Actions"):
                run_once(env, backend=spy)
        self.assertEqual(spy.calls, [])

    def test_declared_release_does_not_prove_teacher_writer_disabled(self):
        spy = BrokerSpy()
        env = {"SCALP_LOCAL_MODE": "PAPER",
               "SCALP_SHARED_ACCOUNT_JOURNAL_DIR": "/data/scalp-paper",
               "SCALP_LOCAL_HOST_OWNER_RELEASE": "EXACT_LOCAL_PAPER_V1"}
        with patch("paper_sandbox.local_host._private_disk", return_value=True):
            with self.assertRaisesRegex(HostBlocked, "shutdown unverified"):
                run_once(env, backend=spy)
        self.assertEqual(spy.calls, [])


if __name__ == "__main__":
    unittest.main()
