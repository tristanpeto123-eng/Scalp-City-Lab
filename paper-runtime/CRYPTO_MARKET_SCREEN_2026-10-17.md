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
