# Checker G0 / G1 — SCALP-PAPER-0.1.0-rc2

**Owner approval:** PENDING. **Deployment:** NONE. **Paper orders:** DISABLED BY DEFAULT.

## G0 structural audit
- [x] Distinct Data Curator, Researcher, Strategy Designer, Optimizer, Backtester, Validator, Scorer, Risk, Paper Trader, Journal and Vault functions are routed by Bot Manager.
- [x] Validator consumes a sealed holdout and recomputes its metrics with a separate implementation.
- [x] Scorer cannot pass blocked validation; risk veto cannot be overridden by the pipeline.
- [x] Hard-coded `paper-api.alpaca.markets` endpoint; no live-money URL configuration.
- [x] No broker keys in repository files or the browser.

## G1 local evidence
- [x] Node 22 syntax checks pending CI for rc2.
- [x] 26 mock-only checks passed, including deny-by-default, rejected holdout, stale/duplicate data, risk veto, test account order, duplicate bar prevention, and mock fill reconciliation.
- [x] GitHub Actions PR checks for rc2 pending. (Two checks passed on prior rc1.)
- [ ] Authentic Alpaca **paper** credentials tested from an authorised, persistent server.
- [ ] Live IEX feed provenance and 15-min boundary verified during actual US market hours.
- [ ] External read-only Agent City telemetry tested on a separately hosted HTTPS origin.
- [ ] Manual review of real broker costs/market behavior, circuit breakers, fill reconciliation, restart and disaster recovery.
- [ ] Owner explicitly approves this exact version for any paper-order enablement.

This prototype's agent names represent deterministic code stages, not separately deployed cognitive agents. Existing Lab historical BT-01 UI and the main Research Floor are not replaced; Agent City receives read-only external telemetry only. US stocks/ETFs SPY, QQQ, IWM are supported; XAUUSD is not supported in this pilot.

**No claims of profitable strategy training, real-world live execution, completed deployment, or autonomous running are authorised by this checklist.**
