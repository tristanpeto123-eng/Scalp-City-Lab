# Diversified Research and Evidence Index — draft v0.1

## Scope
This PR advances the approved Scalp City *read-only research* integration in two ways:

1. **Diverse, disjoint development**: 12 preregistered EMA/RSI/channel hypotheses per one of 10 cryptocurrency pairs, tested at normal and doubled estimated fees on **three non-overlapping chronological development slices**. Entire final 20% of each candle snapshot is quarantined; it is not used for selection, ranking, champion naming, or performance claims.
2. **Read-only, versioned source index**: one report includes the research status of Scalp City, Supply Scout, and Strategy Lab using exact GitHub commit identities and SHA-256 content digests. Stock/supply evidence remains separated from crypto trading data; instrument/timeframe/domain boundaries are explicit.

## Why
The previous trainer primarily mutates nearby historical winning/losing parameters on often overlapping data. New discovery checks multiple preregistered parameter families, disjoint development windows, transaction-cost stress, and source recency. The result remains **development hypothesis research only**. Positive folds alone cannot qualify a strategy.

## Test commands
```sh
node --test scripts/diversified-discovery-tests.mjs scripts/research-evidence-index-tests.mjs
node scripts/diversified-discovery.mjs validation-data /tmp/new-discovery.json
node scripts/research-evidence-index.mjs /tmp/new-discovery.json ../supply-scout ../strategy-lab-template \
  <40hex-crypto-commit> <40hex-supply-commit> <40hex-strategy-commit> /tmp/new-cross-project-index.json
```
The GitHub review workflow checks out all three public repositories with no persistent credentials, verifies source versions, exercises historical candles and uploads the two JSON outputs. The workflow writes neither main nor historical learning memory, signs no admission, and has no Alpaca credentials or broker calls.

## Acceptance criteria
- Exactly ten distinct source-tagged, contiguous completed Kraken-US/Alpaca 15-minute candle arrays pass `checkSnapshot`; last sampled candle within 14 days, not merely recently generated metadata.
- Twelve parameter hypotheses per chart, from three predeclared strategy families.
- Three strictly disjoint development folds per symbol; final 20% untouched for ranking. Unit test mutates sealed future and verifies identical candidate scores.
- Each experiment logs actual training-only net GBP, doubled-cost outcome, number of closes and drawdown; no investment forecast from these results.
- Index includes versioned stock and news sources, rejects missing SHAs or unverified source changes, and explicitly forbids cross-domain model promotion.
- Paper orders, live orders, admissions, independent forward validations and verified profitable models remain at 0. No changes to Teacher, Trading Floor, runtime, signing keys or deployment environments.

## Additional blockers after this review
- Positive development results need genuinely later independent chronological testing, source-matched model freezes, honest trade/fee reconciliation and clear evidence of robustness. Do NOT reuse the quarantined final 20% in iterative optimisation.
- A fresh completed candle differs from a genuinely independent market sample; real paper fills remain necessary for forward evidence.
- Supply Scout still needs independently verified events and Strategy Lab's supply-evidence model is locked. Neither source is allowed to train the crypto models automatically.
- This PR intentionally has **no scheduled publication, external deployment or broker switch**. Exact owner release approval remains separate from review.

## Status
Candidate only on `feat/discovery-and-evidence-index-20261019` until Github Actions PASS and independent owner review. The approved previous PR #24 remains on main.
