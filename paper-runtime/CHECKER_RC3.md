# Checker — Scalp City £50 virtual / £8,000 net profit (no fixed R:R)

**Owner instruction:** 17 October 2026 — remove mandatory 3:1 reward/risk. Keep £50 virtual start, target **£8,000 net GBP profit** (virtual balance target £8,050). Previous ≥80% across ≥61 closed trades remains monitored as a secondary metric unless the owner revises it.
**G0 code-change scope:** APPROVED for development implementation and test.
**G1 automated test gate:** PASSED at the tested development implementation; final commit must be checked.
**Deployment / merge:** NOT AUTHORISED by this strategy-goal change. PR #2 remains draft.
**Broker/real-money orders:** DISABLED and not enabled by repository changes.

## What Checker verified

- [x] Current `trial-profit.mjs` initializes virtual £50, tracks profit target £8,000 separately from starting principal, reports £8,050 balance target, capped modelled risk at 1% of current GBP balance, and never requires a reward/risk multiple.
- [x] The current strategy exits on modelled 2%-below-entry stop, or at the **next candle open** following a bearish completed-candle EMA signal. Open-to-open and gap semantics are model assumptions, not broker guarantees.
- [x] Current `learning-profit.mjs` selects three transparent EMA candidate configurations on **train-only** net GBP profit, expectancy, profit factor and drawdown; later 25% holdout is screened and independent arithmetic is checked.
- [x] `replay-profit.mjs` freezes a strategy before revealing later historical bars and does not count historical-replay results as actual live forward trades. Its origin, dataset fingerprint and candidate are auditable.
- [x] GBP virtual P&L assumes USD-price relative changes, no GBP/USD movement, modelled 0.5% crypto / 0.1% equity fees per side, no proved market slippage. Stated profits are NOT broker-settled GBP.
- [x] New `profit-goal-tests.mjs` **47 tests** passed along with 26 general-agent tests and 29 crypto integration checks: 102 CURRENT active tests; old mandatory-3:1 tests removed from current CI and obsolete code deleted from the review branch.
- [x] Real Alpaca **GET-only** 180-day BTC + ETH historical-as-live trial on 17 October 2026 completed successfully as a process, with 17,279 BTC and 17,177 ETH completed market bars. Evidence: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39068545879
- [x] Both 180-day candidate selections **REJECTED**. 25% calibration holdout for selected BTC candidate: 47 closed simulated trades, 2 net winners (4.26%), modelled net -£8.38; ETH: 40 closed simulated trades, 4 winners (10%), modelled net -£6.57. Neither was qualified for the frozen replay. Each frozen replay therefore made ZERO trades and started/ended at £50 virtual; **no strategy demonstrated progress toward £8,000**. Historical calibration holdout losses are NOT actual ledger losses.

## Not yet complete

- [ ] Generate more credible long-only (or separately risk-reviewed) signal families, test realistic execution and fees, maintain prospective untouched evaluation periods, and discard unsuccessful candidates rather than weakening gates.
- [ ] Implement durable approved-strategy version locking plus genuine feedback learning from **verified closed forward trades** without contaminating independent evaluation cohorts.
- [ ] Privately host the persistent virtual portfolio, confirm restart/journal integrity, outage recovery, broker read-only permissions, and closed-market handling. Existing GH Actions 15-min research is stateless, unmerged and not a hosting substitute.
- [ ] Demonstrate credible, reproducible net positive historical out-of-sample results under cost and slippage stress **before** considering a continuous virtual research trial.
- [ ] Observe true chronological out-of-sample and then forward performance over time. Historical trades never count as actual forward fills. £8,000 profit goal is aspirational and extremely unlikely with modest risk from £50.
- [ ] Build, independently verify and obtain owner approval for any paper-order protective exit integration (partial fills, gaps, loss caps, 24/7 outages). `SCALP_PAPER_ENABLED=true` must remain hard-blocked in service.mjs.
- [ ] An exact release/merge requires explicit owner approval after final G1 review.

**Verdict: CODE GOAL CHANGE IMPLEMENTED, RESEARCH STRATEGIES FAILED — BLOCK AUTOMATED BROKER TRADING.** Never represent historical, modelled, virtual or paper outcomes as real-money investment results.
