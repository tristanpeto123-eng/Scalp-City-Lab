"""Universal-01 cross-market DQN research lane. No broker or admissions."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

from rl.dqn_experiment import SYMBOLS, run, validate_snapshot

SCHEMA = "SCALP_UNIVERSAL_STUDENT_RESEARCH_V1"
REPO = "tristanpeto123-eng/Scalp-City-Lab"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def market_file(symbol: str) -> str:
    if symbol not in SYMBOLS:
        raise ValueError("No vetted 5-minute dataset for " + str(symbol))
    return symbol.replace("/", "-") + ".json"


def execute(*, target: str, source: str, episodes: int,
            data_root: str, seed_root: str, state_root: str) -> dict:
    if target not in SYMBOLS or source not in SYMBOLS:
        raise ValueError("Supported target/source must be from the Academy's 10 crypto pairs")
    if not isinstance(episodes, int) or not 1 <= episodes <= 10:
        raise ValueError("Episodes must be 1-10")
    data_root, seed_root, state_root = map(Path, (data_root, seed_root, state_root))
    snapshot_file = data_root / "snapshots" / market_file(target)
    snapshot = json.loads(snapshot_file.read_text())
    if snapshot.get("symbol") != target or snapshot.get("timeframe") != "5Min":
        raise ValueError("Target source does not match the requested 5m market")
    validate_snapshot(snapshot)
    source_path = seed_root / "models" / (source.replace("/", "-") + "-dqn.pt")
    source_report = seed_root / "models" / (source.replace("/", "-") + "-dqn.json")
    seed_manifest = json.loads(source_report.read_text())
    source_sha = digest(source_path)
    if (seed_manifest.get("symbol") != source or
            seed_manifest.get("policySha256") != source_sha or
            seed_manifest.get("modelType") != "DEEP_Q_NETWORK" or
            seed_manifest.get("paperOrders") != 0 or
            seed_manifest.get("liveOrders") != 0):
        raise ValueError("Source model integrity or permissions failed")
    stem = target.replace("/", "-")
    target_dir = state_root / "universal-student-data" / "markets"
    model_dir = state_root / "universal-student-models"
    target_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)
    history_path = target_dir / (stem + ".json")
    old = json.loads(history_path.read_text()) if history_path.exists() else None
    if old and (old.get("schema") != SCHEMA or old.get("targetSymbol") != target or
                old.get("brokerOrders") != 0 or old.get("liveOrders") != 0 or
                not isinstance(old.get("generations"), list)):
        raise ValueError("Untrusted prior Universal Student history")
    old_generations = old["generations"] if old else []
    if len(old_generations) >= 100:
        raise ValueError("Generation limit reached: archive evidence before adding more")
    previous = model_dir / (stem + "-dqn.pt")
    if old_generations:
        if not previous.is_file() or digest(previous) != old_generations[-1].get("checkpointSha256"):
            raise ValueError("Previous student's weights do not match recorded generation")
        parent_path, parent_sha, parent_origin = previous, digest(previous), "OWN_PRIOR_GENERATION"
    else:
        if previous.exists():
            raise ValueError("Untracked checkpoint: refusing to overwrite")
        parent_path, parent_sha, parent_origin = source_path, source_sha, "TRANSFER_SEED"
    output = state_root / "universal-student-work"
    result = run(snapshot, episodes=episodes, seed=7, outdir=output,
                 prior_checkpoint=parent_path)
    generated = output / (stem + "-dqn.pt")
    generated_sha = digest(generated)
    if (result.get("policySha256") != generated_sha or
            result.get("previousCheckpointSha256") != parent_sha or
            result.get("paperOrders") != 0 or result.get("liveOrders") != 0 or
            result.get("splits", {}).get("sealedHoldoutTouched") is not False or
            result.get("champion") is not False or result.get("officialGrade") is not None):
        raise ValueError("Checker rejected generated candidate or holdout provenance")
    # A source policy can have seen chronologically newer correlated markets.
    # Therefore no imported seed is claimed to be independently out-of-sample.
    generation = len(old_generations) + 1
    snapshot_sha = digest(snapshot_file)
    record = {
        "generation": generation, "sourceSymbol": source if generation == 1 else old_generations[0]["sourceSymbol"],
        "targetSymbol": target, "seedOrigin": parent_origin,
        "parentCheckpointSha256": parent_sha, "checkpointSha256": generated_sha,
        "targetDataSha256": snapshot_sha, "episodes": episodes,
        "gradientUpdates": result["training"]["gradientUpdates"],
        "virtualTrainingClosedTrades": result["training"]["simulatedClosedTrades"],
        "developmentNetGbp": result["validation"]["netProfitGbp"],
        "developmentStressNetGbp": result["validationDoubleCostStress"]["netProfitGbp"],
        "preTrainingDevelopmentNetGbp": result["checkpointProgress"]["previousNetVirtual"],
        "developmentDeltaGbp": result["checkpointProgress"]["deltaNetVirtual"],
        "developmentTrades": result["validation"]["closedTrades"],
        "developmentWinRatePct": (
            round(100 * result["validation"]["wins"] / result["validation"]["closedTrades"], 2)
            if result["validation"]["closedTrades"] else None),
        "developmentDrawdownPct": result["validation"]["maxDrawdownPct"],
        "timeframe": "5Min", "separateForwardEvidence": False,
        "holdoutTouched": False, "brokerOrders": 0, "liveOrders": 0
    }
    history = {"schema": SCHEMA, "studentId": "UNIVERSAL-01",
               "targetSymbol": target, "modelFamily": "DEEP_Q_NETWORK_9_64_64_2",
               "sourceSymbol": record["sourceSymbol"],
               "sourcePolicy": "EXISTING_SAVED_CRYPTO_DQN_NOT_XAU_CONV1D",
               "status": "HISTORICAL_RESEARCH_ONLY",
               "note": "Cross-market seeding is not an independent forward holdout; past-only replay, no orders.",
               "brokerOrders": 0, "liveOrders": 0, "officialGrade": None,
               "generations": [*old_generations, record]}
    # Write immutable generation files; previous research remains intact.
    generation_model = model_dir / (stem + f"-gen{generation}.pt")
    generation_report = target_dir / (stem + f"-gen{generation}.json")
    if generation_model.exists() or generation_report.exists():
        raise ValueError("Generation evidence already exists; refusing overwrite")
    generation_model.write_bytes(generated.read_bytes())
    generation_report.write_text(json.dumps(record, indent=2) + "\n")
    previous.write_bytes(generated.read_bytes())
    history_path.write_text(json.dumps(history, indent=2) + "\n")
    index_path = state_root / "universal-student-data" / "latest.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {
        "schema": "SCALP_UNIVERSAL_STUDENT_INDEX_V1",
        "markets": [], "paperOrders": 0, "liveOrders": 0}
    if (index.get("schema") != "SCALP_UNIVERSAL_STUDENT_INDEX_V1" or
            index.get("paperOrders") != 0 or index.get("liveOrders") != 0):
        raise ValueError("Unsafe or invalid index")
    index["markets"] = sorted(set(index.get("markets", [])) | {target})
    index_path.write_text(json.dumps(index, indent=2) + "\n")
    return {"student": "UNIVERSAL-01", "market": target, "generation": generation,
            "netDevelopmentGbp": record["developmentNetGbp"], "checkpointSha256": generated_sha,
            "verifiedForwardTrades": 0, "brokerOrders": 0, "liveOrders": 0}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--source", default="BTC/USD")
    parser.add_argument("--episodes", type=int, default=3)
    parser.add_argument("--data-root", default="universal-data-input")
    parser.add_argument("--seed-root", default="universal-seed-input")
    parser.add_argument("--state-root", default="universal-state")
    args = parser.parse_args()
    print(json.dumps(execute(target=args.target, source=args.source,
                             episodes=args.episodes, data_root=args.data_root,
                             seed_root=args.seed_root, state_root=args.state_root), indent=2))


if __name__ == "__main__":
    main()
