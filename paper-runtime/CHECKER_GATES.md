# Checker G0 / G1 — SCALP-PAPER-0.1.0-rc2

**Owner approval:** PENDING. **Deployment:** NONE. **Paper orders:** DISABLED BY DEFAULT.

## G0 structural audit
- [x] Distinct Data Curator, Researcher, Strategy Designer, Optimizer, Backtester, Validator, Scorer, Risk, Paper Trader, Journal and Vault functions are routed by Bot Manager.
- [x] Validator consumes a sealed holdout and recomputes its metrics with a separate implementation.
- [x] Scorer cannot pass blocked validation; risk veto cannot be overridden by the pipeline.
- [x] Hard-coded `paper-api.alpaca.markets` endpoint; no live-money URL configuration.
- [x] No broker keys in repository files or the browser.

## G1 local evidence
- [x] Node 22 syntax checks passed for rc2.
- [x] 26 mock-only checks passed, including deny-by-default, rejected holdout, stale/duplicate data, risk veto, test account order, duplicate bar prevention, and mock fill reconciliation.
- [x] GitHub Actions PR checks for rc2 passed (Bootstrap & Checks run 39056767617; Paper Runtime Tests run 39056767489).
- [x] Manual read-only GitHub Actions preflight configured for post-approval merge (paper secrets never logged, no paper orders).
- [x] **Verified paper-account connection (17 Oct 2026):** one-time GitHub Actions pinned read-only preflight passed. Alpaca account status `ACTIVE`, market `CLOSED` (Saturday), IEX completed historical candles SPY 450 / QQQ 502 / IWM 448. No order API call; paperEnabled remained false. Evidence: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39060871699
- [ ] Market-open feed freshness and 15-minute candle clock verified in an actual NYSE trading session.
- [x] **Crypto data and paper eligibility verified (17 October 2026, Saturday):** BTC/USD and ETH/USD were active and tradable in the linked paper account; each returned 287 completed 15-minute candles from `crypto/us`, latest completed at `2026-10-17T19:00:00Z`, data age 10 minutes. 24/7 and read-only test, no broker order calls. Evidence: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39061254677
- [x] Persistent manually dispatched **crypto GET-only** workflow created, separate from equities. Never enables paper orders.
- [ ] **Crypto pipeline execution NOT implemented:** current AgentWorkflow, Risk Manager, broker order allowlist and service scheduling remain equities-only. Crypto trade execution must have independent crypto-specific tests, 24/7 scheduling, fee stress, non-marginable buying-power checks, GTC/IOC time-in-force, exposure accounting and owner approval before release.

\n- [ ] Authentic Alpaca **paper** credentials tested from an authorised, persistent server.
- [ ] Live IEX feed provenance and 15-min boundary verified during actual US market hours.
- [ ] External read-only Agent City telemetry tested on a separately hosted HTTPS origin.
- [ ] Manual review of real broker costs/market behavior, circuit breakers, fill reconciliation, restart and disaster recovery.
- [ ] Owner explicitly approves this exact version for any paper-order enablement.

This prototype's agent names represent deterministic code stages, not separately deployed cognitive agents. Existing Lab historical BT-01 UI and the main Research Floor are not replaced; Agent City receives read-only external telemetry only. US stocks/ETFs SPY, QQQ, IWM are supported; XAUUSD is not supported in this pilot.

**No claims of profitable strategy training, real-world live execution, completed deployment, or autonomous running are authorised by this checklist.**
