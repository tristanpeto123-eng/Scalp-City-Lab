# Checker — Scalp City £50 virtual / £2,000 net profit (no fixed R:R)

**Owner instruction:** 17 October 2026 — remove mandatory 3:1 reward/risk; subsequently revise primary profit and secondary win-rate goals. Keep £50 virtual start, target **£2,000 net GBP profit** (virtual balance target £2,050). Owner's latest direction is an **80% observed winning-trade-rate target, with no minimum or maximum trade-count requirement**. There is no 61-trade stopping point; trade count and Wilson confidence are always reported, and £2,000 profit success does not depend on a trade-count prerequisite.
**G0 code-change scope:** APPROVED for development implementation and test.
**G1 automated test gate:** PASSED at the tested development implementation; final commit must be checked.
**Deployment / merge:** NOT AUTHORISED by this strategy-goal change. PR #2 remains draft.
**Broker/real-money orders:** DISABLED and not enabled by repository changes.

## What Checker verified

- [x] Current `trial-profit.mjs` initializes virtual £50, tracks profit target £2,000 separately from starting principal, reports £2,050 balance target, capped modelled risk at 1% of current GBP balance, and never requires a reward/risk multiple.
- [x] The current strategy exits on modelled 2%-below-entry stop, or at the **next candle open** following a bearish completed-candle EMA signal. Open-to-open and gap semantics are model assumptions, not broker guarantees.
- [x] Current `learning-profit.mjs` selects three transparent EMA candidate configurations on **train-only** net GBP profit, expectancy, profit factor and drawdown; later 25% holdout is screened and independent arithmetic is checked.
- [x] `replay-profit.mjs` freezes a strategy before revealing later historical bars and does not count historical-replay results as actual live forward trades. Its origin, dataset fingerprint and candidate are auditable.
- [x] GBP virtual P&L assumes USD-price relative changes, no GBP/USD movement, modelled 0.5% crypto / 0.1% equity fees per side, no proved market slippage. Stated profits are NOT broker-settled GBP.
- [x] New `profit-goal-tests.mjs` **47 prior tests** passed along with 26 general-agent tests and 29 crypto integration checks: 102 tests in the initial objective update; old mandatory-3:1 tests removed from current CI and obsolete code deleted from the review branch.
- [x] Real Alpaca **GET-only** 180-day BTC + ETH historical-as-live trial on 17 October 2026 completed successfully as a process, with 17,279 BTC and 17,177 ETH completed market bars. Evidence: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39068545879
- [x] Both 180-day candidate selections **REJECTED**. 25% calibration holdout for selected BTC candidate: 47 closed simulated trades, 2 net winners (4.26%), modelled net -£8.38; ETH: 40 closed simulated trades, 4 winners (10%), modelled net -£6.57. Neither was qualified for the frozen replay. Each frozen replay therefore made ZERO trades and started/ended at £50 virtual; **no strategy demonstrated progress toward £2,000**. Historical calibration holdout losses are NOT actual ledger losses.

## Not yet complete

- [ ] Generate more credible long-only (or separately risk-reviewed) signal families, test realistic execution and fees, maintain prospective untouched evaluation periods, and discard unsuccessful candidates rather than weakening gates.
- [ ] Implement durable approved-strategy version locking plus genuine feedback learning from **verified closed forward trades** without contaminating independent evaluation cohorts.
- [ ] Privately host the persistent virtual portfolio, confirm restart/journal integrity, outage recovery, broker read-only permissions, and closed-market handling. Existing GH Actions 15-min research is stateless, unmerged and not a hosting substitute.
- [ ] Demonstrate credible, reproducible net positive historical out-of-sample results under cost and slippage stress **before** considering a continuous virtual research trial.
- [ ] Observe true chronological out-of-sample and then forward performance over time. Historical trades never count as actual forward fills. £2,000 profit goal is aspirational and extremely unlikely with modest risk from £50.
- [ ] Build, independently verify and obtain owner approval for any paper-order protective exit integration (partial fills, gaps, loss caps, 24/7 outages). `SCALP_PAPER_ENABLED=true` must remain hard-blocked in service.mjs.
- [ ] An exact release/merge requires explicit owner approval after final G1 review.

**Verdict: UPDATED CODE GOAL IMPLEMENTED, RESEARCH STRATEGIES FAILED — BLOCK AUTOMATED BROKER TRADING.** Never represent historical, modelled, virtual or paper outcomes as real-money investment results.

## Checker G1 — Latest win-rate/trade-count changes (17 October 2026)

- [x] Starting balance remains **£50 GBP virtual**, target remains **£2,000 net GBP profit**, final balance target **£2,050**; no fixed R:R multiple.
- [x] Owner revised win-rate objective back to **80%** of completed positive-net trades. This is observed, not a claim of an 80% underlying statistical probability.
- [x] **No fixed minimum or maximum number of trades**. The previous 61-trade condition is retired as a hard requirement. Each completed trade is recorded until portfolio-goal/risk stopping decisions are made.
- [x] Win-rate scoreboard accounts for zero completed trades without dividing by zero; shows exact closed-trade sample count and Wilson 95% lower confidence bound.
- [x] Tests cover 0 completed trades (cannot count as success), 4/5 wins (80%, observed), 3/5 (60%, fail), 49/61 (80.3%, pass), 48/61 (78.7%, fail), and 400/500 (80%, pass), plus that the £2,000 virtual profit goal is independent of completed trade count.
- [x] Strategy/accounting policy identifier incremented to `GBP50-PROFIT2000-v2`; old v1/3R data cannot silently become v2 forward proof.
- [ ] Verify final GitHub CI result for the exact committed revision.
- [ ] Historical candidate strategies are still previously rejected, regardless of changed scoreboard rules; independent strategy viability, private persistent hosting, protective paper-order execution and genuine forward results remain outstanding.

**Checker release conclusion remains NEEDS_REVISION for deployment.** Changing a win-rate threshold does not validate the strategy or authorize trading.


## Checker G1 — Eight additional cryptocurrency markets, 17 Oct 2026
**Verdict: ALL REJECTED; DO NOT DEPLOY OR ARM PAPER ORDERS.** Eight-market research-only evaluation used real Alpaca historical US crypto data and `GBP50-PROFIT2000-v2` no-fixed-RR strategy. Results are documented in [CRYPTO_MARKET_SCREEN_2026-10-17.md](CRYPTO_MARKET_SCREEN_2026-10-17.md). Source run: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39070019426.
- SOL/USD: 8,614 candles, holdout 5/24 net wins (20.83%), **−£2.89** modelled.
- XRP/USD: 8,616 candles, holdout 4/27 net wins (14.81%), **−£2.12** modelled.
- ADA/AVAX/LINK/DOGE/LTC/BCH/USD: rejected due zero-volume ratio **55.47%, 56.02%, 56.80%, 73.64%, 73.85%, 73.27%** respectively, above the conservative 40% research threshold. No inference of executable fills from quote-derived bars.
- All 8 historical **frozen forward-like replays correctly withheld** because eligibility/quality gates failed. The virtual £50 trial was not debited; zero paper broker orders.
- The `crypto-research-marketset.mjs` only enlarges offline historical simulation coverage, NOT `alpaca-paper.mjs` broker ticker permissions. Reverify repo CI after cleanup.
