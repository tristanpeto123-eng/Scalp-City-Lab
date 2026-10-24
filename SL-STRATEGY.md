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

## Online 5-minute history (on demand)

The SL interface now has **Fetch 5m online**, using the documented Twelve Data `/time_series` endpoint via HTTPS. A **personal API key is required**; it stays in a local password field for that browser page and is supplied directly to the data provider via an Authorization header, not embedded in a URL, repository, GitHub action, saved memory or analytics. No credentials are provisioned by Scalp City. This is an opt-in call initiated by the user and may be blocked by browser CORS/network restrictions.

- Market mapping is **explicit**: Commodities `XAUUSD→XAU/USD`, `XAGUSD→XAG/USD`; Forex `EURUSD→EUR/USD`, `GBPUSD→GBP/USD`, `USDJPY→USD/JPY`; Indices `SPX→SPX`, `NDX→NDX`. The platform **never maps US100 CFD into cash NDX** without explicit user consent; use the manual CSV path for unsupported symbols.
- Request `5min`, `timezone=UTC`, up to 5,000 candles. Check provider identity, interval, schema, sorting, complete-bar cutoff, five-minute alignment, OHLC accuracy, duplicates, gaps and recent provenance. No filled-in candles or substituted data if the source is invalid.
- Twelve Data's published plans currently place **commodities data on the paid Grow plan or higher**, and some indices may require additional access. Basic can cover supported forex. If the key is missing or entitlement insufficient, show a direct error and keep the CSV import route; do not invent prices, use demo keys silently, or claim historic data was downloaded.
- After a valid fetch, the user explicitly adds precommitted simulated trade examples to the corresponding SL good/bad memory and can run Train SL. Both fee assumptions and validation remain visible. Provider timestamps and symbol are shown on the page; data ingestion is **provider-reported, not independently authenticated**, and not live brokerage execution.
- This is an **on-demand automatic download**, not a persistent feed, monitoring service, scheduled background trainer or unattended portfolio trader. A browser-only key is not automatically shared with any backend. Tests use mock provider responses, not real provider credentials. Functionality can only be fully verified after an eligible key and successful cross-origin API response are supplied.

## Automatic 5-minute learning loop (browser-only simulation)

The **SL Learning Loop** is independent from the other Scalp City bots. When the user presses **Start learning loop**, the Lab (1) downloads completed five-minute candles with their own Twelve Data API key, (2) takes a frozen pre-entry neural decision from the most recent *closed* candle, (3) models a next-bar-open virtual long or short if selected, while tracking skipped candidate outcomes as explicitly **counterfactual**, (4) waits for the fixed holding period to finish and labels net GBP after the two modelled trading costs, (5) retrains SL solely after a candidate outcome closes, and (6) checks again after the next five-minute close. This repeats only while the page is open and awake.

A first run seeds the model from historical trade examples and **does not count that download as forward profit or additional learning**. Subsequent unchanged provider snapshots produce `UNCHANGED_NO_NEW_LEARNING` and no new labels. A missing overlap, previously revised candle, incomplete next bar or unsupported open-position session gap stops the loop rather than inventing fills. A pending signal does not imply a trade until the following completed bar becomes available. No historical future candle is an input to the original entry decision. Each cycle's simulated trades, skipped-opportunity counterfactuals, and retraining revisions are separate from live performance and are shown in the local journal.

Start, run-one-cycle, pause, export and reset controls appear in section 4 of `sl-strategy.html`. Only the current symbol's local checkpoint is retained; the API key remains solely in the password field, never in saved checkpoints or GitHub. The browser may throttle/pause timers, especially on iOS, and an unattended background or scheduled server service is **not** implemented. Continuous scheduled 5-minute requests consume provider API credits and require an eligible subscription; real XAUUSD data access is **not verified without credentials**. This implementation never sends broker, paper, or real-money orders. Owner-approved paper/live execution requires a separate review.

The baseline model is trained on historical data with an internal chronological split. Its research-only validation statistics are not an independently sealed holdout once models repeatedly retrain; only strictly forward, decision-frozen completed virtual outcomes can be scored as sequential prospective simulation. Virtual fills on delayed completed bars assume next-open execution that might not have been achievable in the live market.

Run `node sl-loop-tests.mjs` for causal closed-bar streaming and state replay acceptance tests.

## Model persistence and verifiable private backups

A trained SL neural network **is actual JavaScript data**, not an HTML illustration. The entire `SL_5MIN_CAUSAL_LOOP_V1` checkpoint includes eight-neuron neural weight tensors (6-input/8-hidden/1-output), current threshold, the selected market, the latest completed candle and 28-bar overlap, pending/virtual positions, good/bad closed-trade examples, performance journal, feed state and incremental-learning revision count.

**Existing (live):** Each finished loop cycle writes this checkpoint under `scalp-city-lab:sl:loop:v1:<market>:<symbol>:...` in the current browser's `localStorage`. This stays on the same browser across reloads but is NOT an off-device backup and may be lost when Safari website data is cleared, private browsing is used, storage quotas are exhausted or the device is replaced.

**Model Vault (this change):** Section 4 adds:
- Explicit browser read-after-write confirmation of weights, candle cursor, and good/bad memory.
- Portable **Download model checkpoint** JSON containing saved neural weights, labelled examples, settings, updated model and SHA-256 integrity digest; **Restore model checkpoint** from Files with digest verification. The download is usable across devices.
- Opt-in **verified private GitHub repository backup**: create a *new PRIVATE repository* (e.g. `private-sl-vault` under your GitHub account); provide its owner, repository and a fine-grained PAT with Content: Read/write on that repository only; click **Save + verify private cloud backup**. The system checks the repository is private, then PUTs `sl-learning/<market>/<symbol>/latest.json` in its default branch. Afterwards it GETs the file again and verifies its SHA-256 digest and revision. Successful API calls without a matching readback do NOT count as saved.
- **Restore from private GitHub** verifies checksum, model structure and matching market/settings before an explicit user-confirmed replacement.
- Optional **auto-backup** after new training cycles; a failure stops the loop instead of silently claiming the model is safely saved.

**Safety:** The existing repositories `Scalp-City-Lab`, `Scalp-City-1`, `Scalp-City` and `Scalp-City-3D-UI-Test` are public and explicitly rejected as backup destinations. No learned trading strategies or trade journals are pushed to them. The user-entered GitHub PAT and Twelve Data key are used only in HTTP authorization headers, kept only in input/session memory (never exported, committed to the code repo, stored in localStorage or included in the model snapshot). The GitHub repository is created and kept private **by the user**; the app does not automatically provision one. GitHub API writes need network/CORS and adequate permissions. No browser control provides true iOS background execution; no broker order submission.

**Acceptance:** `node sl-model-vault-tests.mjs` exercises SHA-256 integrity, serialization of real network weights and memory, private-only destination, credential exclusion, remote upload/readback, idempotence, stale-revision overwrite veto and remote restore.

## Bug fix: imported history is not identical to trade memory (Oct 2026)

Earlier HTML kept `fiveBars` in JavaScript memory only; reloading the page lost the chart and showed "No 5-minute history imported" even when the browser retained SL's **different** labelled good/bad trade memory. The loop model is another separate `localStorage` checkpoint.

The current **5-minute chart cache** stores successfully validated CSV or Twelve Data OHLCV candles in IndexedDB under a **market+symbol** key, never an API credential. It validates after a write by reading the record back; subsequent page loads and market/symbol changes restore those candles automatically. The UI reports which market, number of bars, last recorded UTC candle and cache source are loaded. If there is only a saved good/bad memory but no old chart cache, it explicitly says the memory is intact and asks to import/fetch the raw chart once—old raw data cannot be reconstructed from trade labels.

The **Process loaded 5m candles** button uses the saved historical chart in a single offline simulation/training cycle, without Twelve Data credits or API key. The first pass creates a historical neural baseline; later **newer imported candles** can advance the stored loop checkpoint. The **Start learning loop** button still requires an eligible provider key for future automatic hourly snapshots and cannot run unattended if iOS Safari is suspended. Neither button submits paper/live orders or creates real execution records. Raw chart cache lives only on the current browser/device and is not the private Model Vault backup; export the learned model separately.

On Twelve Data Basic 8, `/time_series` costs one credit per symbol/request (independent of `outputsize`, up to 5,000). An hourly request can return twelve new 5m candles instead of spending twelve separate credits. First fetch/catch-up uses 5,000; routine hourly update requests **180** candles to allow dropping an unfinished latest candle while retaining the >=150 bars expected by the historical validator. The device-side guard records an attempted request before fetching and forbids another before 60 minutes; manual provider fetches or a different device may still consume extra credits. Commodity data including XAUUSD may be unavailable on Basic despite unused credits, so test with eligible Forex such as EURUSD or import CSV. No fabricated data is substituted on source errors.
