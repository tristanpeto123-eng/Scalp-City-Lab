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

## Five-minute SL strategy mode

SL now contains an independent **5Min** research path in `sl-5m.mjs`, surfaced within `sl-strategy.html`. This is not the existing crypto DQN 5Min stream: SL remains Commodities, Forex and Indices, and accepts a matching **user-supplied recorded 5-minute OHLC CSV** (time/open/high/low/close; volume optional) for the chosen market.

- The file is locally parsed in the browser, validated for five-minute-aligned chronological completed candles, OHLC consistency and any gaps. Dates without a timezone are treated as UTC; session/overnight gaps are not fabricated or filled.
- User chooses symbol, holding period (1–24 5m candles), modeled all-in cost per side in basis points and virtual GBP notional. The chosen research baseline creates **one precommitted momentum-side opportunity per non-overlapping window** after 25 indicator warmup candles. Pre-entry features use closed signal candle and older history; execution enters on the **next candle's open**, exits after the selected number of 5m bars at its open. Loss/profit labels are signed virtual GBP P&L after both modeled sides' costs, not executable brokerage performance.
- Recorded opportunities enter the **existing selected-market SL good/bad memory**, only when explicitly added. Existing synthetic memories cannot be mixed with historical inputs. Training is the same isolated 60/20/20 chronological supervised SL procedure. This is a prototype hypothesis, not an optimized trading strategy or profit finding.
- Buttons reveal historical candles sequentially (step/play/restart/end), and display SL's frozen post-training research selection score. The chart hides future candles, but displaying a model on training-period history **does not constitute a forward test**. Historical held-out test statistics remain separate and do not prove future profits.
- Read-only CSV import and client-side storage only. **No live 5m automatic feed, broker credentials, paper/live orders, account money or verified fills.** The upstream crypto replay's own 5Min data and RL workers remain unchanged.
- Checker: `node sl-5m-tests.mjs` validates 5m structure, gaps, causal feature boundaries, next-open fills, fee-adjusted P&L, activated market isolation and no broker execution.
