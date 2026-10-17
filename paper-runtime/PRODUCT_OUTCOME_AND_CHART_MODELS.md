# Scalp City — Individual chart models and customer investment planner

**Release scope:** Research and product-design implementation only, 17 October 2026. This is NOT a regulated investment product, a live trading service, a broker account or a promise of returns.

## Customer outcome: deposit or wait duration

The future customer flow is:
1. Enter a starting **virtual** deposit (minimum **£50** for this test platform).
2. Pick ONE variable: **target cumulative NET profit** or **wait duration**. There is no maximum number of completed trades imposed by the product.
3. Receive a risk-aware probabilistic estimate of the OTHER variable, **only if independently accepted, out-of-sample evidence is sufficient**. If the evidence is inadequate, show `ESTIMATE_UNAVAILABLE`; never fabricate a completion date or profit forecast.
4. Confirm a **review date**, not a guaranteed payout or maturity date. At the review date, display any verifiable realized returns, outstanding positions and separate uninvested/settled funds.
5. A future real-money version can offer withdrawal ONLY through an eligible authorized custodian/broker, with separate identification, payment reconciliation, regulation/legal review and explicit user authorization. An investment target is not a guaranteed withdrawal amount, and deposits can be lost.

`trial-profit.mjs` now supports **arbitrary virtual starting balances of £50–£1,000,000**, while keeping the profit objective cumulative and independent of starting capital. A £200 starting virtual account with a £2,000 cumulative net profit target requires a final virtual balance of £2,200; a £50 account would require £2,050. The existing development service still initializes the research trial at the default £50 until real user-onboarding and custody are independently designed and approved.

**No current deposit endpoint, real account custody, order arm, withdrawal rail, direct debit or transfer capability has been activated.**

### Implemented scenario service

`deposit-goal-planner.mjs` takes `depositGbp>=50` and either `mode='TARGET_PROFIT'` with `targetNetProfitGbp`, or `mode='WAIT_DURATION'` with `durationDays`. It rejects invalid amounts/durations, refuses projections without:
- **3 non-overlapping** historical frozen or verified paper-forward evaluation windows
- **90 daily NET returns**, including fee assumptions
- **40 completed simulated trades** and at least 5 negative observed daily returns
- Correct versioned risk and portfolio policy, valid timestamps and unique days

The resulting deterministic resampling model produces loss probabilities and 10th/50th/90th percentile portfolio/profit outcomes; for profit-target mode it shows a likelihood of target within the chosen horizon and refuses any single ETA unless at least 50% of simulated paths attained it. **This is an illustrative bootstrap model, not a validated predictor**. It does not preserve serial correlations or changing regimes; ranges may understate uncertainty. No historical crypto sample currently satisfies this standard; therefore the real app **must show unavailable, not a made-up ETA**.

### Research system: one model per chart

Current logical, independently tracked research models: BTC/USD, ETH/USD, SOL/USD, XRP/USD, ADA/USD, AVAX/USD, LINK/USD, DOGE/USD, LTC/USD and BCH/USD. Each identified `CHART_<PAIR>`:
- learns only from that pair AND the exact `us` or `us-1` feed, never pools other charts' outcomes as independent examples
- stores finalized historical training timeframe, fingerprint, 15-minute realized volatility, trend / regime, candle range, historical mean-reversion and volume coverage
- proposes its own parameter/family candidates using only **TRAINING** windows, balancing bounded EMA trend, RSI reversal and Donchian breakout families
- independently audits later training-calibration holdouts with costs and 2x-cost stress
- records rejected candidates, regime summaries and accepted independent training windows in versioned GitHub memory; duplicate or overlapping historical windows never add new **independent** success claims
- keeps the selected strategy frozen before the remainder of history is replayed in chronological next-open simulation
- refuses independent validation before any paper or funded trade; training success doesn't authorize an order

**Every 12-agent report** exposes `method`, `evidence`, and `decision` for Bot Manager, Data Curator, Researcher, Strategy Designer, Optimizer, Backtester, Independent Validator, Scorer, Risk Manager, Paper Trader, Journal and Vault. These explain the implemented computations; they are not imaginary natural-language internal AI deliberations.

### Learning persistence and activation

The separate non-production GitHub branch `scalp-learning-memory` holds `scalp-learning/history.json`, initialized empty and **not** with fabricated learning evidence. `github-learning-store.mjs` requires GitHub content blob SHA before appending and fails closed on stale version, missing file or write conflict. `chart-model-learning.yml` is a **manual, approval-gated** workflow staged in draft PR #2. Once explicitly approved for a future release, a workflow run can gather fresh real Alpaca GET-only historical candles for each chart and persist training-only evidence. Unit tests using synthetic data NEVER populate the research model. Current production/branch defaults have **no continuous learning service deployed**.

## Outstanding release/security gates

- Supply truly independent chronological out-of-sample windows and sufficient trade evidence for a calibrated forecasting prototype. Validate predictions against later real outcomes.
- Assess the economic and regulatory implications of accepting UK retail deposits, automated investment advice/execution, custody, AML/KYC and financial promotions before proposing any launch.
- Verify real broker settlement, protected orders, outages and kill switches separately if a funded product is ever proposed.
- Real fills, profit or withdrawals must NEVER be claimed from historical or virtual results.
- The owner explicitly approves the exact version and execution authority; tests, demos and documentation do not imply that approval.
