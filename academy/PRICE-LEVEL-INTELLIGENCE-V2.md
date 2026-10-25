# Price Level Intelligence v2 — contextual model experiment

**Status:** isolated Scalp City Academy RESEARCH ONLY. Does not replace v1, graduate students, interact with real/paper brokers, or change existing SL/Teacher/production Scalp City.

## Why v2 exists

The first level mapper identified historical zones and mapped rejection/breakout/sweep/retest setups, but simple win-rate cutoffs on `(pattern, regime)` found no profitable trade threshold on the first private QC XAUUSD sample. Treat this as a negative result, not as a problem to evade by disabling risk gates.

v2 adds:

- 16 pre-entry contextual features: pattern, regime, side, indicative RR, level touch count/age, volatility-normalised stop, approach momentum, candle body and level-to-level span.
- Regularised ridge-return estimator of *stressed, modelled net returns* plus shrunk context-specific realised-backtest means rather than ranking by uncalibrated win rate alone.
- Group-balanced loss: simultaneous alternative counterfactuals at a timestamp carry total fit weight 1; they are not falsely counted as independent actual trades.
- Empirical sample counts and conservative uncertainty penalty; unknown/negative-edge regimes abstain. The lower-bound heuristic is **not** an actual statistical confidence interval.
- Strict chronological FIT → TUNE (margin selection only) → DEVELOPMENT (diagnostics only); sealed final 20% NEVER scored. Source identification and symbol/timeframe restrictions stay intact.
- Nonoverlapping virtual selections, adverse same-candle SL/TP precedence, gap rejection, bidirectional cost stress, fixed £1000 virtual notional.

## Local commands (Node 22, no broker/network)

`node --test academy/price-level-intelligence-tests.mjs academy/price-level-intelligence-v2-tests.mjs`

`node scripts/research-contextual-levels.mjs XAUUSD 15Min /private/XAUUSD_15min.csv /private/pli-v2`

Output files are source-hash-named, immutable (`wx`) and private: model, FIT-only Good/Bad memory, research report. Provider candles must not be checked into a public GitHub repository.

## Initial diagnostic — private XAUUSD QC snapshot, 2026-10-25

The private QC snapshot contains 23,415 15-minute candles (SHA-256 `be6af88bd595edd0cdf5430822aea2603cdaa507054d58a3fa2218231e6050c3`). It **does not** match the earlier independently registered source SHA or candle count. Source authenticity, quote convention and execution costs are unverified.

In the v2 retrospective run, there were 342 FIT signal groups and 68 TUNE groups; the model abstained on TUNE and DEVELOPMENT rather than asserting a profitable edge. The comparison baseline of 105 highest-indicative-RR nonoverlapping historical candidates was negative after modelled costs. A larger training sample or more features does not establish predictive skill. The source's development period had already been examined during v1 research, so it is **not** an independent v2 validation.

## Examiner and release gates

1. GitHub syntactic/regression CI must pass, and reviewer should inspect chronology, cost handling, memory weighting and honest reporting.
2. Independently authenticate and licence source data; verify true bid/ask/venue costs and fills; do not claim £ returns represent actual broker fills.
3. Never tune again on the DEVELOPMENT period and then call it independent; use genuinely new later untouched observations and purged walk-forward evaluation, with frozen checkpoints and no lookahead.
4. Require sustained positive risk-adjusted *net* performance relative to cash, v1 and naive level/momentum baselines before considering separate paper-trading approval.
5. No automatic promotion, trading-floor/broker permission or production deployment; explicit owner approval on exact tested commit is required.
