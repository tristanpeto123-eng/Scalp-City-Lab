# SL — Supervised Learning (independent strategy)

**Status:** experimental, NOT deployed to paper or real trading.

SL is a separate Scalp City trading strategy, not a replacement for EMA, RSI, breakout, RL or existing workers. Market students have independent SL neural weights and good/bad memory piles; **Commodities, Forex and Indices** are the first three enabled markets; Equities and Crypto are reserved. The old ten-pair Robot Academy is untouched.

## Objective and labels

**Maximise net money made.** Positive net GBP after costs goes into **good**, negative into **bad**; flat results cannot be classified into either. The magnitude of net GBP is reflected in supervised classification weights; threshold tuning selects the highest total net GBP on chronological validation records, not the highest win percentage. £500 gains and £500 losses matter much more than £5 outcomes, with per-example clipping to limit outliers.

## Implemented

- `sl-core.mjs`: independent six-input, eight-hidden, one-output neural network, deterministic seeded gradient training, sample-weighted loss and read-only research predictions.
- `sl-strategy.html`: per-market browser-local memory, import/export, good/bad stats, training, prediction probe and fresh synthetic examples. **Synthetic and historical samples cannot mix.**
- `sl-core-tests.mjs`: run `node sl-core-tests.mjs`. Tests classification, duplicate rejection, market isolation, deterministic learning, 60/20/20 splits, overlap purging, disabled execution.
- Inputs per potential trade: unique `id`, `market`, `source` = `HISTORICAL_RESEARCH` or `SYNTHETIC_DEMO`, `openedAt`, `closedAt`, six normalized **pre-entry** `entryFeatures` in this order: trend, momentum, volatility, relativeVolume, distanceFromLevel, entrySignal; and realized / counterfactual `netPnlGbp` inclusive of costs.
- Historical splits: earliest 60% for training, next 20% to tune the entry threshold by net GBP, latest 20% for untouched historical evaluation. Purge overlapping positions at the split boundaries. At least 40 labelled opportunities with two training classes required.

## Critical limitations

Model score is **not** a calibrated profit probability. Backtest statistics are not live or verified forward trading. Training on only previously executed trades may omit losing opportunities the robot would have considered and bias reported returns; the candidate-trade sampling policy and pre-entry feature provenance require an independent review. A separate paper-trading examination and owner approval would be required before promotion. The app has no broker order interface, portfolio risk allocator, or live model deployment. It does not affect `Scalp-City-1` or other Scalp City Lab strategies.
