# Robot Academy: self-directed Deep RL pilot

This is an optional second training lane beside the existing EMA/RSI/breakout research trainer. The DQN policy is learned from historical observations and rewards rather than constrained to a preset indicator strategy. All ten supported crypto charts have separate model instances and training runs.

## What it does

- One model per chart using completed 15-minute Alpaca/Kraken snapshot data; reject untrusted, discontinuous, incomplete or malformed candles.
- Uses historical close, momentum, volatility, relative volume, position state and equity drawdown as nine observation features, drawn from already-completed bars.
- Learns FLAT/LONG decisions using a PyTorch neural Deep Q-Network (9-64-64-2), epsilon exploration, replay memory and target-network stabilization.
- Executes simulated trades on the **following** candle's open, with a maximum 50% of cash at entry and no shorting or leverage.
- Reward is logarithmic marked-equity improvement *after* simulated transaction fees/slippage; score also reports drawdown, closed trades and benchmark comparisons.
- Chronology: first 60% train, next 20% development validation, last 20% untouched sealed holdout.
- 0.25% fees and 0.1% slippage on normal runs, doubled on stress validation. These are modeling assumptions, not actual fills.
- Saves policy weights and evidence summaries as local or manual workflow artifacts only. Training seeds and data/model hashes are included.

## Checker and safety rules

This prototype has **no Alpaca account calls**, broker orders, real/paper deposits, official grades, admissions or automatic promotions. It cannot activate the trading floor or replace the authenticated Teacher evidence pipeline. Replay of the same history is not independent evidence; the final sealed segment is not an optimisation target. Any serious candidate requires additional regime robustness, multi-seed stability, independent historical review, paper execution and owner-authorized examiner integration.

## Run

Use Python 3.11+ with numpy and PyTorch installed, from the repo root:

    python -m unittest rl.test_dqn_experiment -v
    python -m rl.dqn_experiment --symbol BTC/USD --episodes 5 --seed 7 --outdir dqn-artifacts

Other symbols are run separately by changing --symbol. The GitHub Action is **manual-only**, uses read-only repository access and uploads development-only model artifacts. It is not a scheduled research process and is not authorized for paper or live execution.

## Future integration contract

Researcher trains independently, Checker audits trained models and overfitting, Teacher independently screens and (after explicit approval) conducts paper-forward tests. Only broker-reconciled signed forward evidence can update official grading; live deployment requires separate, exact owner authorization.
