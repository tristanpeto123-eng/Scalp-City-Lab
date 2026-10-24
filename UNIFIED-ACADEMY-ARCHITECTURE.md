# Unified Robot Academy — classroom and examination architecture (candidate v1)

## Approved ownership and scope
**One Academy classroom, many learning methods, one test protocol.**
Any independently trained strategy is a pupil after its *frozen version* has been published to a common intake. This is true for Scout + Strategist, DQN/RL, NEO pattern memory, SL, and deterministic indicator strategies. The student's learning method is a label, **not a different examination rubric**.

The 12 Foundry operational workers, Checker, Teacher, Guardian and Risk Manager remain *staff and services*, not trading pupils. One combined **Scout + Strategist** trade-decision student is `XAU-SCST-01`, initially fixed to XAUUSD/Commodities/15Min. The Guardian and Accumulator are separate supervisors, not silently fused into its checkpoint.

## Data and model separation
1. **Private training workspace** owns raw good/bad piles, rewards, optimizer runs, mutable weights and exploratory diagnostics. Training is model-dependent; it never supplies an exam grade.
2. **Publication gate** takes a versioned, immutable checkpoint plus train-cutoff timestamp, code/feature format and a recorded closed-candle decision trace. Hash model, test data and decisions separately. An import *cannot* create broker/paper certification.
3. **Common examiner** runs the same `academy-common-exam.mjs` logic regardless of learning method: one action at each closed bar, next-open virtual entry/exit, LONG/SHORT/FLAT; 25% virtual notional, £1,000 starting balance, 10bps fee + 5bps spread + 5bps slip **per side**, closing remaining exposure at the final recorded close. No invented candles or fills; no broker routes.
4. **Comparable cohort** means same instrument, identical candle dataset SHA-256, identical timeframe/window, exposure and execution assumptions. Across markets, normalise return and risk metrics, but never assert that a BTC result on one dataset directly outranks XAU on another by raw £.
5. **Independent examination** must rerun frozen checkpoint code on independently sourced unseen data and reconcile every decision, not accept student-supplied traces at face value. This critical server-side verification is **not yet implemented** for Scout + Strategist. Browser intake shows `LOCAL_UNVERIFIED_HISTORICAL_REPLAY` only.
6. **Paper stage** remains separate: Teacher's cryptographically signed, broker-reconciled fills and FX are the only source of verified paper grades. The existing 10-crypto-pair Teacher qualification is not automatically extended to XAUUSD; an approved symbol-specific adapter and paper source are needed. No live trading or automatic promotion.

## Lab integration
- `robot-academy.html` adds Scout + Strategist as pupil **11** in the **same 0–10 classroom rooms / Orientation / report card**. The ten legacy crypto pairs and their research/training memory remain untouched.
- `academy-unified-ui.mjs` adds a local intake on the Academy page. On JSON import it checks the real model checkpoint is nonempty and performs a common, deterministic, historical exam on provided completed market candles.
- `academy-common-exam.mjs` is a method-agnostic examiner contract; DQN, NEO, SL and rule-based workers can add checkpoint-to-trace adapters without changing scoring, risk assumptions or report-card data.
- Import results have **no signed forward-paper grade**. Exam-version summaries may persist in this browser. The actual private model weights are **not** stored in this public repository by the importer; keep the original checkpoint and its private backup.
- Publishing a model is different from retraining. Training never automatically triggers a release or replaces existing students. Versions stay attributable via hashes. Any move to independently supervised paper/live orders requires independent validation and explicit owner approval.

## Scout + Strategist export envelope
The installed Lab intake accepts **JSON**, not the previously created ZIP by itself. The V2.4 exporter or a conversion adapter must produce this exact envelope using its genuine trained weights and frozen decision trace. The source package is currently **not present in the Lab repository**, so no genuine Scout trained version can be claimed imported or examined by this patch.

```json
{
  "schema": "ACADEMY_FROZEN_STUDENT_V1",
  "student": {
    "id": "XAU-SCST-01", "family": "SCOUT_STRATEGIST",
    "learningMethod": "SUPERVISED",
    "market": "COMMODITIES", "symbol": "XAUUSD",
    "timeframe": "15Min", "version": "2.4.0",
    "trainedThroughUtc": "2025-01-31T00:00:00.000Z"
  },
  "checkpoint": {
    "architecture": "actual-v2.4-trained-checkpoint-type",
    "state": {"weights": "REPLACE_WITH_REAL_SERIALIZED_NUMERIC_MODEL_PARAMETERS"}
  },
  "examination": {
    "source": "HISTORICAL_MARKET_DATA",
    "provider": "actual-recorded-candle-provider",
    "symbol": "XAUUSD", "timeframe": "15Min",
    "synthetic": false,
    "candles": [{"t":"2025-02-01T00:00:00.000Z","o":2800,"h":2801,"l":2799,"c":2800.5}],
    "decisions": [{"t":"2025-02-01T00:00:00.000Z","action":"FLAT"}]
  }
}
```

The illustrative shape above is **not a valid complete submission**: a real exam needs 50+ contiguous completed candles, one prediction for every candle except the last, real prices, a real nonempty checkpoint, and an examination period entirely later than the training cutoff. It cannot prove the checkpoint produced the submitted predictions.

## Required future completion before Teacher graduation
- Locate and inspect the original V2.4 checkpoint format; implement an actual deterministic Scout+Strategist inference adapter, including all twelve pre-entry features and cost/risk logic. Reject incompatible models instead of guessing feature order or inventing weights.
- Authenticate and freeze a separate truly unseen XAUUSD dataset, execute the **checkpoint itself** through the common examiner, and demonstrate one-to-one reproducibility of the action trace.
- Add independent walk-forward tests, stressed costs and minimum trade count; compare Scout versions and other agents on the exact same XAUUSD test fixture with the same execution settings.
- Implement approved, independently reconciled paper adapter for XAUUSD if paper testing is authorized. Never reuse crypto-only authenticated paper grades.
- Promote only under Checker/Teacher approval gates and exact owner-approved release. A UI grade or positive historical net GBP is never enough.

**Safety:** This branch is a candidate, not a public/stable release. Synthetic fixture candles in automated tests are acceptable for checking software arithmetic only; they never populate a pupil report, evidence cache or verified grade.
