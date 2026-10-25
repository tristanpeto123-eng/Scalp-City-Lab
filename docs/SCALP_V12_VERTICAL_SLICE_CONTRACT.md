# Scalp City v1.2 — Vertical Slice Build Contract

Status: **DRAFT BUILD CONTRACT / NOT IMPLEMENTED**
Date: 2026-10-25 UTC
Owner-approved objective: prove **data → shared skill → student → training → independent test → Skill Effectiveness Matrix** using Commodities/XAUUSD, before scaling out.

## Scope and boundaries
Build only on architecture-v1.2-g0-skill-matrix after G0 prerequisites for the affected files and model memories are satisfied. Integrate with existing Lab modules; do not silently replace SL, Deep RL, crypto Academy, Teacher or NEO systems. Do not write to Scalp-City-1, Agentic-Trading or The-Foundry. **No broker, live/paper order, or model-promotion path.**

The first vertical slice uses the Commodities student and **Market Regime Intelligence** only. Event Reaction Intelligence, Closer and later Adaptive Profit Management remain outside this implementation increment.

## Components and ownership
| Component | Responsibility |
|---|---|
| Data Curator service | Validate/normalise XAUUSD 5m candles, preserve gaps and provenance |
| Shared Regime Skill | Emit direction and volatility state from completed prior history |
| Commodities Student | Read versioned skill features through an adapter, independently store model and decisions |
| Teacher | Run fixed, seeded training lessons and baseline/ablation comparisons |
| Backtest service | Replay identical timestamps, signals and execution assumptions for baseline and treatment |
| Independent Examiner/Checker | Recompute tests, block leakage, report uncertainty and status |
| Student Observatory | Read-only display of a true Skill Effectiveness Matrix cell and evidence links |
| Registry/Journal | Content hashes of data, code, model checkpoint, decisions, test configuration and results |

## Feature and regime contract
- Symbol: XAUUSD, instrument/source identity explicit; UTC five-minute completed OHLCV.
- Time t: only completed bars with close <= t; prediction timestamp, generation timestamp and forecast horizon separately recorded.
- Market regime is a combination of orthogonal **directionality** (uptrend, downtrend, range/uncertain) and **volatility state** (compressed, normal, elevated, extreme/unknown), plus a data-quality/abstention flag.
- Chop/conflicting signals can independently require abstention, rather than be classified as trend.
- Outputs include: schemaVersion, skillId, skillVersion, market, symbol, timeframe, asOfUtc, lastInputCandleUtc, dataHash, regime, numerical causal evidence, uncertainty, status/reason.
- Missing/late/out-of-order data returns UNKNOWN or ABSTAIN. Do not fabricate candles, volume or probabilities.
- No feature computed from future bar OHLC, same-bar inaccessible high/low, future event headlines or post-entry P&L.

## Experimental design
1. Freeze training period, development period and sealed evaluation period **chronologically**, with embargo/purge for overlapping labels.
2. Keep original data and code hashes immutable and log all seeds and hyperparameters.
3. Define a deterministic strategy baseline without the Market Regime skill (CONTROL).
4. Train a separate candidate with the Market Regime feature/policy (TREATMENT); keep identical candidate opportunity windows, risk rules, transaction cost model and entry/exit semantics.
5. Tune only on training/development; score the sealed test once per frozen candidate.
6. Compare net P&L, expectancy, drawdown, per-trade cost, turnover and opportunity coverage; report the paired difference and uncertainty interval.
7. Stratify comparisons by regime and volatility; use resampling appropriate for serial dependence and correct for repeated comparisons.
8. Label observed differences as EXPLORATORY until evidence is sufficient. A positive point estimate is not a skill qualification.
9. Preserve both successful and failed/no-trade counterfactual opportunities; do not train only from the profitable trades selected by a prior model.
10. One published Matrix cell must disclose paired observations, independent windows, source/replay hash, model hashes, costs, results and evidence quality. No hard-coded demo percentages in real-data mode.

## Required tests (Checker acceptance)
| Test | Expected behaviour |
|---|---|
| V-01 Import valid completed UTC XAUUSD candles | Accepted, exact source hash preserved |
| V-02 Duplicated, corrupt or unordered OHLC | Rejected with reason |
| V-03 Gaps or market closure | Preserved without synthetic filling |
| V-04 Causal regime extraction | No price/news later than asOfUtc consumed |
| V-05 Closed-bar / next-open simulation | Orders only at permitted simulated time |
| V-06 Data-stale or unknown regime | Abstain or explicit unknown; no silent fallback |
| V-07 Market isolation | Commodities model cannot overwrite Forex/Indices memories |
| V-08 Skill-off baseline | Does not read or depend on regime output |
| V-09 Paired ablation test | Same historical windows, costs and risk specification |
| V-10 Frozen checkpoint replay | Exact decision trace and report hash reproduced |
| V-11 Holdout embargo | Training cannot access sealed test labels or metrics |
| V-12 No-new-data repetition | No false credit for new observations or skill progress |
| V-13 Strategy degradation | Negative effect shown as AVOID/EXPERIMENTAL, not hidden |
| V-14 Uncertain positive effect | No automatic USE recommendation from weak evidence |
| V-15 Observatory cell provenance | UI matches independent report; data missing → UNKNOWN |
| V-16 Permission boundary | No paper/live broker calls or self-promotion possible |
| V-17 Crash/reload persistence | Model/state restore valid; corrupt checkpoint rejected |
| V-18 Regression | Legacy Academy, SL, DQN and current Lab UI tests remain passing |

## Evidence artifacts
- Immutable data manifest and provenance record (no unlicensed vendor data committed).
- Versioned regime-skill contract with unit tests.
- Control/treatment model checkpoints in **private** storage.
- Frozen config, candle-by-candle trace and test report with hashes.
- Comparisons showing costs, uncertainty, paired test effects and failure cases.
- Read-only Skill Effectiveness Matrix with clear TRAIN / DEVELOPMENT / SEALED-TEST labels.
- Checker G0, pre-build G1 and post-build G1 sign-offs, with exact commit SHA.

## Release and stop conditions
- **No modification to stable main or stable repo** as part of the build contract.
- Before implementation: confirm G0 recoverability and locate the actual Commodities student checkpoint adapter. If no genuine compatible checkpoint exists, use a clearly marked deterministic research baseline; do not claim a trained student exists.
- If valid XAUUSD history is unavailable, perform code-only fixture tests; do not publish performance or success claims.
- Failure of leakage, risk, provenance, isolation or reproducibility tests blocks the integration.
- A successful pilot qualifies the architecture for expansion research; it does not qualify a model for paper/live trading.

**Next decision after proof:** extend from one instrument/skill to additional markets, ERI and Closer only after the experimental pipeline survives independent validation.
