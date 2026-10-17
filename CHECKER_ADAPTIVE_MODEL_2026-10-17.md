# Checker: Scalp City adaptive crypto strategy selector — 17 October 2026

## Scope / authorization

Research improvement to **Strategy Validation** only; draft PR #8. User reported that the existing test repeatedly fails and lacks intelligence. No approval to merge, deploy, arm paper orders, accept real deposits, custody money or promise withdrawals.

### Root cause in published version

Static 15-minute long-only EMA 9/34, RSI 14 (30/60) or Donchian breakout (20/10) rules apply identically to all ten crypto pairs. They do not learn pair-specific market behavior or decide to sit out weak setups. Default backtest uses 0.5% modelled fee per side, which is higher than Alpaca's published entry-tier **taker** rate of 0.25% per side. Documentation: https://docs.alpaca.markets/us/docs/crypto-fees. Alpaca's actual account type, eligible trading venue, spread, slippage, GBP FX, order constraints and fees must still be independently verified.

### Proposed adaptive mode (draft, not deployed)

- Research candidate bank: 3 EMA pairs, 2 RSI configurations and 3 breakout configurations, all interpretable and specified before testing.
- One independent **chart** model per pair, no transfer of pricing, model selection or holdings to another pair.
- Initial **20%** historical window for discovery, next **20%** for confirmation and double-fee stress, **last 60%** completely sealed until a candidate passes the training gate. First 40% produces only market-behavior profile and parameter selection. No future-price peeking.
- Confirm positive closed-trade net GBP in BOTH earlier windows, positive results even at **double estimated taker fees (0.5% per side)**, and a conservative drawdown limit. At least two completed simulated trades per internal window is a research *floor*, **not statistically sufficient evidence to approve deployment**.
- If no strategy passes, issue an explicit **ABSTAIN_NO_POSITIVE_EDGE_AFTER_FEES** decision, instead of generating a hypothetical winning trade or relaxing criteria.
- Passed research candidates may be evaluated against a chronologically later held-out window, but such an experiment is neither a live trade nor a calibrated forecast.
- UI exposes chart model's past trend/volatility observations, why candidate rules were accepted or rejected, and deterministic records for Data Curator, Researcher, Strategy Designer, Checker and Risk Manager. These explain **software decisions**, not conversations with 5 independent live AI agents.
- A browser-local, deduplicated research-window log is informational only; there is **no claim of neural learning, continuous retraining or independent real execution**. The more advanced centrally persisted learning framework remains staged separately in draft PR #2, not approved for production.

### Measured 60-day real Alpaca/Kraken US data (5,759 complete 15-minute bars per pair)

Source: signed-in GitHub Actions logs of offline preloaded historical data in [validation acceptance tests](https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39076487150), fee assumptions 0.25% per side (0.5% stress). Hypothetical, no real fills.

| Chart | Early-window decision | Frozen outer 60% historical evaluation |
|---|---|---|
| BTC/USD | Abstain | withheld, no purported trades |
| ETH/USD | **Screened RSI 14 / buy below 30 / exit at 65** | 9 simulated closed trades; 3 net winners, **33.33%**; net **−£2.12 GBP**, maximum marked drawdown 5.03% |
| SOL/USD | Abstain | withheld |
| XRP/USD | Abstain | withheld |
| ADA/USD | Abstain | withheld |
| AVAX/USD | Abstain | withheld |
| LINK/USD | Abstain | withheld |
| DOGE/USD | Abstain | withheld |
| LTC/USD | Abstain | withheld |
| BCH/USD | Abstain | withheld |

**Important:** The sole model that initially passed was **negative out-of-sample**. 0 of 10 demonstrated a confirmed profitable chart model or the user-requested observed 80% win rate. This is compelling evidence that switching among basic strategies is insufficient; not a reason to loosen gates.

### Checker acceptance and open risks

- [x] Published basic manual strategy tests still run.
- [x] Deterministic per-chart strategy configuration under normal and doubled fees, without changing broker order permissions.
- [x] Ten preloaded market datasets evaluated.
- [x] Adversarial test mutates the LAST 60% and verifies that training selection and strategy scores remain unchanged.
- [x] Per-pair model isolation and no fake gains from flat or incomplete market data.
- [x] Conservative abstention and explanatory audit, plus duplicate-safe local experiment notes.
- [x] GitHub static page and bootstrap checks green on tested commit.
- [ ] Research qualitatively new signal families and trained feature-based models, **without** using these inspected holdout results for their own validation.
- [ ] Longer truly fresh out-of-sample periods, independent evaluation and chronological forward-paper observations.
- [ ] Executable spread/slippage/GBP FX, stop gap, liquidity, data provenance and realistic order fulfillment must be audited.
- [ ] UK jurisdiction, payments/custody, financial-promotions and broker suitability issues remain unreviewed for any real funds use.
- [ ] Owner approval of exact release required before merging PR #8. All funded execution remains blocked.

**G1 verdict: SOFTWARE TESTS PASSED; STRATEGY PERFORMANCE NOT VERIFIED — NEEDS_REVISION FOR TRADING.** Model adaptation is an experimental feature only and must not be presented as an 80% winning system, guaranteed £2,000 outcome, or a financial payout.


### Final holdout verdict hardening

The adaptive evaluator now **explicitly rejects** any frozen historical replay with negative/zero cumulative realized net profit, fewer than 20 completed holdout trades, or modeled drawdown above 10%. This verdict is created only AFTER freezing the train-selected candidate; it is not fed back into retraining, so the already-inspected outer sample remains an audit record rather than an optimization dataset. An observed 80% win-rate target is reported separately from positive net-profit criteria. ETH/USD's **−£2.12 / 9 closes / 33.33% wins** therefore returns `HOLDOUT_REJECTED`, not `OUT_OF_SAMPLE_HISTORICAL_EVALUATION` mistaken for performance success.

The browser page separately labels `TRAINING SCREENED` and `CHECKER OUTER HOLDOUT REJECTED`, even though it still shows the historical simulated negative result. No candidate can automatically become broker-executable.
