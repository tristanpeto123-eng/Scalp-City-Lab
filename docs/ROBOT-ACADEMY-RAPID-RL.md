# Robot Academy — authentic 5-minute Deep RL market replay

**Status:** review candidate (19 October 2026). Production workflow and website cannot be claimed active until merge and a successful authenticated five-minute source refresh. Historical training only. No broker orders, paper grades or financial advice.

## Objective

Train ten independent neural Deep-Q Network pupils so each behaves as if observing a live crypto chart: a model only receives prior **completed 5-minute candles**, decides FLAT/LONG, and any virtual position change happens at the **following 5-minute bar open**. The simulator then observes the new closed bar, computes fee- and slippage-adjusted reward/equity/drawdown and updates weights from experience replay.

The agent sees *numerical OHLCV and position-state features*; the human watches the corresponding visual candlesticks in `market-replay-5m.html`. It does not infer or inspect future candles. No intra-bar tick/trade data are available; none are invented.

## New native data lane

- `scripts/refresh-rl-5m.mjs` performs GET-only Alpaca/Kraken US 5Min bars with credentials stored in GitHub Actions secrets; two pages or more if required. Strict bar provenance and contiguity (300,000 ms), complete timestamps, OHLC ordering, no synthetic filling of gaps, and up to 30 historical days.
- `.github/workflows/refresh-rl-5m.yml` refreshes read-only history six-hourly and saves to isolated `rl-5m-data` GitHub branch `snapshots/<PAIR>.json`.
- The existing legacy 15Min public strategy snapshots and their validation worker remain unchanged. New RL won't use them as training input.
- `.github/workflows/robot-dqn-replay.yml` then trains 10 pupil neural models from this isolated `rl-5m-data` branch twice hourly (best effort), retaining each prior state-dict checkpoint on distinct `rl-learning-memory` branch.
- Any missing or stale datasets, missing saved model weights, altered timeframe, invalid bar or failed provenance check blocks training rather than falling back to fake 5-minute prices.

## Training versus live trading

- Real source interval **5 minutes**. Faster-than-realtime replay is a CPU convenience only. Policy decisions per wall-clock second are not broker orders, and position closes are counted separately.
- Historical training: earliest 60%. Later development test: next 20%. Final 20% remains **untouched**, never enters training or the published playback.
- DQN choices: 0/FLAT or 1/LONG, capped at 50% available cash notional, modeled 0.25% fees per side + 0.1% slippage; extra fee stress in validation.
- Shaped reinforcement: log account equity changes after transaction costs, penalizing incremental drawdown. Real gradients/backprop, epsilon exploration, replay and target networks.
- Held-out replay (`rl-rapid/replays/<PAIR>-5m.json`) contains up to 420 genuine later-development candles with warmup, frozen DQN actions, next-open virtual fills and simulated closing equity/reward. Future bars remain visually hidden until the user advances the viewer.
- Replay starts at the earliest 33 warmup candles and shows no actions before features exist. One "Next 5m candle" reveals one actual five-minute bar; optional playback accelerates wall-clock display but never changes the source interval.
- This establishes **readiness of the interface and offline decision structure**, not live-market deployment. Future live capability requires fresh 5m feed timing, latency and reconciliation monitoring, disjoint forward PAPER tests and separate human approval before any broker access. Current UI has none.

## Integrity checks
- `node --test scripts/refresh-rl-5m-tests.mjs scripts/market-replay-5m-tests.mjs`
- `python -m unittest rl.test_dqn_experiment rl.test_rapid_replay rl.test_five_min_replay -v` (requires numpy and torch)
- `.github/workflows/robot-rapid-rl-check.yml`: independent G0/G1 source/timestamp/holdout safety tests and no-order guard.
- The page must display a clear first-run unavailable state until genuine snapshots, DQN weights and replay trace have been published. Do not substitute demo candles into this production route.

## Primary mission — evidence-backed net profitability

The DQN pupil's **ultimate objective is sustained positive, risk-controlled net
GBP return after fees and adverse slippage** on authentic five-minute market
observations. There is no reward for activity, unnecessary entries, win-rate
alone, learning XP, or arbitrary daily trade frequency. Remaining FLAT and
preserving capital is preferable to taking an unprofitable trade.

Each simulated position is marked to its immediately **liquidatable value**
(including the closing fee/slippage) while held. The per-step reinforcement
reward is net log-equity improvement with an incremental drawdown penalty; the
model receives a negative outcome when trading costs or falling prices lower
net equity. DQN training learns from these rewards and updates neural weights.
This is an approximation to eventual compound net profit, not a guarantee.

The separate, **frozen-policy development audit** in
`rl/profit_objective.py` requires all of:

- net profit greater than £0 after normal simulated trading costs;
- net profit greater than £0 after doubled fees and slippage stress;
- more profit than both staying in cash and passive buy-and-hold over the same
  development period, net of the same baseline execution costs;
- simulated maximum drawdown no greater than 8%;
- at least five fully closed simulated trades for an initial activity sample.

These are **necessary research filters, not sufficient investment evidence**.
For each pupil, `profitObjective` includes failed conditions, normal/stressed
net GBP P&L, passive excess, drawdown and closure count, and explicit
`automaticPromotion=false`, `brokerOrders=0` and
`forwardVerified=false`. The browser Training Monitor exposes the same
profit ledger, rather than ranking models by speed or success percentage.

The development 20% segment is inspected repeatedly during autonomous research,
so it can become subject to implicit selection/overfitting. It must never be
represented as fully independent validation. The sealed final 20% is not read
during development. Before any Teacher graduation, a truly independent,
time-forward out-of-sample and actual segregated PAPER fill ledger are required,
with explicit owner authorization for any later trading release.

The goal does **not** require a trade every five minutes; real-world execution
frequency will be set by the profitable policy and risk constraints, not the
number of bars arriving. In falling or fee-dominated markets, staying in cash
may be the optimal profit-seeking decision. Current DQN only supports LONG/FLAT,
not short selling.

Checker tests: `python -m unittest rl.test_profit_objective
rl.test_dqn_experiment rl.test_rapid_replay -v` and
`node --test scripts/rl-profit-monitor-tests.mjs`.
