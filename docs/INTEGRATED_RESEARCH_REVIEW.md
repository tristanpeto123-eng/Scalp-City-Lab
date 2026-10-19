# Integrated Research Review v0.1 — candidate only

## Scope / owner request
Integrate **data → bounded per-chart optimisation → historical development folds → independent Teacher screening → Academy reporting** for the ten Alpaca/Kraken 15-minute crypto charts. This is a new, review-only orchestration entrypoint reusing existing audited components rather than modifying their approved release code.

**NOT A BROKER RUNTIME.** The new command does not import a broker client, does not read account keys, does not issue admissions, does not write to the GitHub learning-memory branch, does not publish Academy files, and has no live-money controls. A passing historical screen means human review is required; never automatically authorise PAPER or LIVE trades.

## Input/output contracts

Inputs: append-only `scalp-learning-memory/scalp-learning/history.json`; ten current authenticated `validation-data/*.json` snapshots; current dated read-only USD→GBP reference from Frankfurter (ECB reference series).

```bash
node --test scripts/integrated-research-review-tests.mjs
node scripts/integrated-research-review.mjs \
  research-memory/scalp-learning/history.json \
  validation-data \
  integration-review-output
```

The output directory must be new; `wx` writes refuse accidental overwrites. Five files are written:
- `research-integration-review.json` — stage lineage, model source hashes, each symbol's historical screening and reasons.
- `academy-candidate.json` — TRAINING-ONLY projected pupils (0 verified forward grades).
- `historical-development.json` — development-fold statistics with final 20% quarantined from parameter selection.
- `independent-qualification.json` — separately implemented Teacher historical audit; holds on bad fingerprints, insufficient samples, cost-stress losses or stale/mismatched data.
- `candidate-memory-NOT-PUBLISHED.json` — append-only research *proposal*, not saved to approved GitHub memory.

## Why the boundaries are preserved

1. `checkSnapshot` validates all ten source-tagged, contiguous, completed historical candle datasets; input bar end cannot be older than 14 days. This is freshness of research data, not broker-order readiness.
2. `evaluateAll` uses earlier bars, parent-seeded bounded candidates and training-only history; it cannot read Teacher holdout scores.
3. `historicalLab` independently runs descriptive development folds and quarantines the final fifth of each source snapshot.
4. `buildAcademySnapshot` converts *candidate* memory to the existing Academy format. A research leader is NOT an admitted pupil.
5. `assess` invokes the existing separate `teacher/auditor.mjs` to recompute strict source-matched holdout outcomes using an external FX reference. No broker fills are used or claimed.
6. The integrated report cross-checks the SHA-256 Academy candidate digest against the Teacher's input digest, reconciles each pupil's research statistics and refuses any official grade, admission or order.
7. The PR-only/read-only GitHub workflow exercises synthetic negative tests plus a real-source integrated run, uploading artifacts for independent inspection without touching main or PAPER accounts.

## Other research segments

Supply Scout and Strategy Lab handle stock-market or supply-chain research with different instruments, evidence requirements and timeframes. They are explicitly **not merged into the crypto model's training signals**. They can eventually publish separately authenticated versioned research events through a shared registry; that expansion requires symbol mapping, timestamp alignment and out-of-sample causal testing, not unverified JSON concatenation.

## Release gate and limitations

This is an isolated candidate on `feat/integrated-research-review-20261019`. No production/main merge, scheduled auto-publisher update, PAPER-order switch or live-trading scope is approved by this build request. Review GitHub Actions evidence and actual sample results, address failures, then request owner approval for an **exact commit/release** before deployment.

Historical profitability (if found) cannot guarantee positive forward or live trading results. Formal trading systems remain gated by the existing Teacher reconciliation and independent approval process.
