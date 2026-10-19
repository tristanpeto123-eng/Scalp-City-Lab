# Robot Academy — accelerated neural reinforcement learning

Status: feature branch / independent Checker required. **No broker orders, no deployment, no validated profitability.**

## Why one trade per second isn't the right training metric

The available authenticated market source is **15-minute OHLCV candles**. There are no authenticated one-second ticks, order book events or true one-second fills in the repository. Inventing 900 one-second quotes from one historical candle is incorrect, leaks imaginary precision and cannot train a real 1 Hz scalper.

The correct training mechanism is **accelerated historical replay**: each genuine completed 15-minute bar presents one sequential market decision, run as fast as CPU allows (possibly hundreds or more simulated decisions per wall-clock second). A decision to stay flat or stay long is NOT an executed virtual trade. Measured metrics therefore distinguish:
- policy decisions per second, across all ten models;
- simulated position closes per second;
- real network gradient updates per second and total;
- simulated virtual account P&L/drawdown after fees and slippage;
- independent new source candles, which may be zero even when optimising the same data.

A literal paper order per second is not permitted by this design, nor is it an acceptable proxy for a profitable strategy.

## Learning architecture

1. Ten isolated per-symbol DQN policies with their own neural weight checkpoint and model SHA. A non-spoofable manifest links model files and checks prior weights before updating; corrupted or missing weights block resumption.
2. Observation: only completed historical returns, volume, ranges, position and drawdown. Actions: flat / long, with trades executed in the simulation at the *next* 15-minute candle's open.
3. Shaped reward: log net equity return after fees and slippage minus incremental drawdown risk. Replay buffer, epsilon exploration, target network, Huber loss, gradient updates; policy weights are trained rather than assigning points for a high win rate.
4. Chronological split: training earliest 60%, validation next 20%, quarantined last 20%. Only earlier training bars update weights. Validation is descriptive and repeated validation on overlapping datasets is not proof of independence.
5. Existing experimental PyTorch DQN is extended, not replaced by a fake scalar reward engine. `rl/rapid_replay.py` runs ten model updates in a batch and writes `rl-rapid/latest.json` plus `models/<PAIR>-dqn.pt` on an isolated `rl-learning-memory` branch. Each successful batch resumes from the last checkpoint. Fingerprints/new training tail counts prevent calling the same bars new market evidence.

## Runtime and interfaces

- GitHub Actions research workflow schedules two batches hourly, best effort; a scheduled job is **not** a continuously running 1 Hz trading process.
- Each job must pass independent tests, validate source freshness, then execute ten offline DQN runs and publish only research-model weights and a public-safe summary to the dedicated `rl-learning-memory` branch.
- The existing `training-monitor.html` has a new "Neural reinforcement learning · rapid replay" section showing measured decisions/sec, actual virtual closes/sec, gradient updates, data novelty and each pupil's later-development simulated outcome. It reads only approved read-only summary JSON from the GitHub learning branch.
- Always show "Not measured" and a workflow link until an actual first batch succeeds.
- The Teacher, signed forward-paper grades, broker trade admission and real-money execution remain separate and OFF.

## Required next infrastructure for real 1-second trading frequency

Before even considering one *virtual market action* per second on real market time rather than accelerated 15-minute replay, obtain signed/authenticated time-series trades or order book at <=1 s resolution, enforce timestamp dedupe/latency/slippage/spread costs, use a persistent worker rather than GitHub cron, and independently benchmark against cash/buy-hold plus frozen out-of-sample then true segregated PAPER execution. Broker order frequency and any funded account access require distinct explicit approval and independent safeguards.

## Acceptance

Run `python -m unittest rl.test_dqn_experiment rl.test_rapid_replay -v`, `node --test scripts/training-monitor-tests.mjs`, and the new independent GitHub Checker. Verify 10 actual checkpoint hashes, real gradient updates, no access to final holdout, no credential calls or orders, new data counts and zero official admissions. Do not merge without exact-version owner approval.
