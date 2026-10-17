# Scalp City — Alternative crypto market research, 17 October 2026

**Research version:** `GBP50-PROFIT2000-v2`; **method:** Alpaca US 15-minute crypto bars, 90 calendar days, chronological historical-as-live calibration. **Status:** ALL EIGHT REJECTED; no release candidate qualified. **Proof:** https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39070019426

## Experiment

Same current market strategy on each asset: three EMA variants (6/26, 9/34, 12/48), long-only, next-open bearish exit or simulated 2% stop, maximum 1% planned portfolio risk per trade, virtual starting balance £50. The profit milestone is £2,000 net GBP (final £2,050), with an observed 80% win-rate target and no arbitrary trade-count limit. Fees are **estimated 0.5% per side**, and GBP changes use USD-price ratios with no FX adjustment. Actual spread, slippage, fill feasibility, available liquidity and realized fees were NOT tested.

Only the first 40% of each market's candles were available to strategy selection and independent historical holdout; the remaining 60% were reserved for frozen chronological replay if the calibration passed. Within calibration, candidate choice uses the first 75%; later 25% is audited separately for net GBP after estimated costs and 2× fee stress. If calibration fails, the reserved evaluation is **not entered**, so zero frozen replay trades are counted. No external paper or real-money broker orders were submitted.

## Actual results — Alpaca live GET-only dataset, 90 days

| Market | Candles received | Zero-volume candles | Internal calibration holdout | Outcome |
|---|---:|---:|---|---|
| SOL/USD | 8,614 | 24.87% | 24 simulated closed trades, 5 net wins (20.83%), **−£2.89** | Strategy rejected: no training eligibility, negative holdout and 2× fee stress |
| XRP/USD | 8,616 | 15.24% | 27 simulated closes, 4 net wins (14.81%), **−£2.12** | Strategy rejected: same failures |
| ADA/USD | 8,636 | 55.47% | Not run | Data-quality gate: zero-volume candles >40% |
| AVAX/USD | 8,633 | 56.02% | Not run | Data-quality gate |
| LINK/USD | 8,636 | 56.80% | Not run | Data-quality gate |
| DOGE/USD | 8,575 | 73.64% | Not run | Data-quality gate |
| LTC/USD | 8,593 | 73.85% | Not run | Data-quality gate |
| BCH/USD | 8,622 | 73.27% | Not run | Data-quality gate |

**Data-quality methodology:** zero-volume bars are rejected if >40% of the received 15-minute sample. This is a conservative, experimental heuristic, NOT an Alpaca requirement; their US crypto data may supply quote-midpoint OHLC even with no actual trade volume. It avoids attributing executable prices to quotes alone. Alternative true-trade/quote/order-book data and independently tested liquidity proxies could reopen these pairs for analysis, but the current test is NOT evidence that the symbols themselves are impossible to trade.

## Checker decision

- [x] Eight selected USD pairs verified via authenticated paper account **GET /v2/assets** for active/tradable status.
- [x] Each supported pair tested against full 90-day history using authenticated **GET /v1beta3/crypto/us/bars**, with pagination and closed-candle filtering.
- [x] Research-only registry **does not** expand hardcoded paper broker `paperOrder()` ticker allowlist. Unit tests explicitly reject new pairs at order adapter.
- [x] Each result tagged with asset, calibration sample, original data bar count and any data-quality rejection.
- [x] End-to-end GitHub Actions job completed successfully, evidence at link above. Success means a completed **testing process**, not strategy profitability.
- [x] No pair reached observed 80% win rate in eligible held-out strategy screening; **no pair qualified for frozen replay**.
- [ ] Revisit strategy families, estimate realistic transaction fees/spreads/liquidity with a suitable feed, then evaluate new frozen holdouts independently.
- [ ] No audited live forward fills, broker-protective exits, persistent hosting, or evidence for £2,000 goal. Do NOT authorize broker execution or production release.

**Verdict:** DATA AND STRATEGY RESEARCH COMPLETED; ALL EIGHT REJECTED. Remain **NEEDS_REVISION** for strategy promotion and release. No live or paper orders placed. Do not increase leverage or relax safety gates to manufacture target outcomes.


## Additional Kraken US historical-data cross-check (`us-1`)

Because six symbols failed the Alpaca US venue's quote-midpoint / zero-volume rule, Checker repeated the experiment using Alpaca's separate **Kraken US trade-based feed** via `GET /v1beta3/crypto/us-1/bars` using the **same 90-day lookback, same three EMA candidates, same simulation costs and identical frozen evaluation gate**. It is an alternative source of historical OHLCV, **NOT proof of executable fills, spreads, pricing or permissions on Kraken**.

**Actual read-only proof:** https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39070322662. All eight markets returned sufficient cleaner data (8,639 15-minute candles each). The original 40% zero-volume screen no longer blocked any market.

| Market | Kraken US 15-minute candles | Zero-volume candles | Internal calibration holdout | Verdict |
|---|---:|---:|---|---|
| SOL/USD | 8,639 | 0% | 25 simulated closes, 5 wins (**20.00%**), **−£2.69** | Rejected: training, holdout and stress |
| XRP/USD | 8,639 | 0% | 29 closes, 3 wins (**10.34%**), **−£3.04** | Rejected: training, holdout and stress |
| ADA/USD | 8,639 | 0% | 24 closes, 4 wins (**16.67%**), **−£1.43** | Rejected: training, holdout and stress |
| AVAX/USD | 8,639 | 0.05% | 21 closes, 3 wins (**14.29%**), **−£2.40** | Rejected: training, holdout and stress |
| LINK/USD | 8,639 | 0% | 24 closes, 3 wins (**12.50%**), **−£2.51** | Rejected: training, holdout and stress |
| DOGE/USD | 8,639 | 0% | 28 closes, 5 wins (**17.86%**), **−£2.27** | Rejected: training, holdout and stress |
| LTC/USD | 8,639 | 0.01% | 22 closes, 2 wins (**9.09%**), **−£2.00** | Rejected: training, holdout and stress |
| BCH/USD | 8,639 | 3.54% | 18 closes, 3 wins (**16.67%**), **+£0.66** | **Still rejected:** training candidate ineligible and 2x-cost stress failed |

**Key finding:** Kraken data improved trade-volume representation; **it did not rescue the current EMA strategy**. BCH has a small positive *historical internal holdout* under base modelled costs, but it is not an independently eligible strategy or achieved portfolio profit. The **frozen last 60% of history was not traded in any of these simulations** because candidates were rejected. The virtual £50 portfolio is unchanged; no actual broker orders submitted.

The two venues' reported bars and modeled outcomes must remain separated by `dataLocation`. Do not average or pool them as if they were independent live strategy wins, and never use the withheld 60% for candidate tuning after inspecting the results.

**Checker conclusion: ALL EIGHT STRATEGY CANDIDATES REJECTED EVEN ON CLEANER KRAKEN FEED.** Next research should test different, justified signal/exit families and execution-realistic costs, not loosen the validation threshold to manufacture the owner's 80% win-rate target.
