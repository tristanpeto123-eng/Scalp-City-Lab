"""£0-new-hosting local Linux / Raspberry Pi commissioning runner.

Uses the existing frozen DQN and append-only, fsynced journal without
introducing a cloud provider or duplicating a shared Alpaca PAPER writer.

OFF is the default: no disk writes, API calls, imports of PyTorch, or orders.
PREFLIGHT and PLAN use broker GETs only. PAPER requires separate explicit
owner release and the shared_runtime safeguards; never auto-arm PAPER.
"""
from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

MODES = frozenset(("OFF", "PREFLIGHT", "PLAN", "PAPER"))
DEFAULT_JOURNAL = "/data/scalp-paper"


class HostBlocked(Exception):
    pass


def _private_disk(path: str) -> bool:
    if not isinstance(path, str) or not path.startswith("/data/"):
        return False
    root = Path(path)
    if root.is_symlink() or not root.is_dir():
        return False
    try:
        return stat.S_IMODE(root.stat().st_mode) & 0o077 == 0
    except OSError:
        return False


def _frozen(env):
    model = env.get("SCALP_LOCAL_MODEL_FILE", "")
    manifest = env.get("SCALP_LOCAL_MODEL_MANIFEST", "")
    if not model or not manifest or not Path(model).is_file() or not Path(manifest).is_file():
        raise HostBlocked("Private model checkpoint and manifest must exist")
    from rl.model_registry import validate_locked_checkpoint
    try:
        record = validate_locked_checkpoint(model, manifest)
    except (ValueError, OSError, KeyError, TypeError) as exc:
        raise HostBlocked("Frozen checkpoint/manifest integrity check failed") from exc
    if (record.get("modelSha256") != env.get("SCALP_DEMO_MODEL_SHA256")
        or record.get("symbol") != env.get("SCALP_DEMO_SYMBOL")
        or record.get("modelLocked") is not True
        or record.get("graduated") is not False
        or record.get("tradingFloorAdmitted") is not False):
        raise HostBlocked("Frozen model or symbol differs from pinned demo intent")
    return model


def run_once(env=None, *, backend=None):
    env = env if env is not None else os.environ
    mode = env.get("SCALP_LOCAL_MODE", "OFF").upper()
    if mode not in MODES:
        raise HostBlocked("Invalid mode: OFF, PREFLIGHT, PLAN or PAPER only")

    root = env.get("SCALP_SHARED_ACCOUNT_JOURNAL_DIR", DEFAULT_JOURNAL)
    disk_ready = _private_disk(root)
    report = {"schema": "SCALP_LOCAL_PAPER_HOST_V1", "mode": mode,
              "paperOnly": True, "liveOrders": 0, "diskReady": disk_ready,
              "paperOrdersSubmitted": 0, "teacherGrades": 0}

    if mode == "OFF":
        return {**report, "status": "HOST_OFFLINE_SAFE",
                "brokerRequests": 0, "reason": "No trading mode armed"}

    if not disk_ready:
        raise HostBlocked("Private persistent /data journal missing or exposed")

    # Fail before importing heavyweight inference dependencies or opening a socket.
    if mode == "PAPER":
        if env.get("GITHUB_ACTIONS", "").lower() == "true":
            raise HostBlocked("GitHub Actions is not a PAPER order host")
        if env.get("SCALP_LOCAL_HOST_OWNER_RELEASE") != "EXACT_LOCAL_PAPER_V1":
            raise HostBlocked("Explicit local-host owner release missing")
        if env.get("SCALP_LOCAL_CONFIRM_ONLY_WRITER") != "YES":
            raise HostBlocked("Independent Teacher writer shutdown unverified")
        if env.get("SCALP_SHARED_ACCOUNT_JOURNAL_DIR") != root:
            raise HostBlocked("Local and shared order journal paths must match")

    if backend is None:
        from paper_sandbox import shared_runtime as backend

    if mode == "PREFLIGHT":
        snapshot = backend.preflight(env=env, shared_mode=True)
        return {**report, "status": "PAPER_READ_ONLY_PREFLIGHT",
                "accountFingerprint": snapshot["accountFingerprint"],
                "historicalOrders": len(snapshot["orders"]),
                "openPositions": len(snapshot["positions"]),
                "brokerWrites": 0}

    model_path = _frozen(env)
    if mode == "PLAN":
        planned = backend.paper_decision(
            env=env, model_file=model_path, execute=False, shared_mode=True)
        return {**report, "status": "PAPER_READ_ONLY_PLAN",
                "signal": planned["signal"], "symbol": planned["symbol"],
                "lastCompletedCandle": planned["lastCompletedCandle"],
                "modelSha256": planned["modelSha256"],
                "brokerWrites": 0}

    # The shared_runtime remains the only owner of the PAPER POST path.
    # It enforces its own additional account, owner, journal and model gates.
    result = backend.shared_cycle(
        env=env, model_file=model_path, execute=True)
    return {**report,
            "status": result["status"],
            "paperOrdersSubmitted": int(result.get("demoOrderSubmitted") is True),
            "brokerWrites": int(result.get("demoOrderSubmitted") is True),
            "symbol": result["symbol"],
            "modelSha256": result["modelSha256"],
            "accountFingerprint": result["accountFingerprint"]}


def main():
    try:
        result = run_once()
    except (HostBlocked, Exception) as exc:
        # Do not include upstream error strings: they could carry provider
        # response bodies, broker IDs or credentials. The exception's class
        # and the generic failure status are sufficient for a syslog alarm.
        print("SCALP_LOCAL_PAPER_BLOCKED " + type(exc).__name__,
              file=sys.stderr, flush=True)
        return 1
    print("SCALP_LOCAL_PAPER " + json.dumps(result, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
