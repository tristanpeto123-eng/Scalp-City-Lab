# Checker release candidate — SCALP-PAPER-0.1.0-rc3

**Owner approval for this exact revision:** NOT YET GIVEN
**Merge and production deployment:** NOT AUTHORISED
**Real-money path:** NONE
**Paper orders:** DEFAULT OFF

## Scope
- Integrate BTC/USD and ETH/USD into the same 12 deterministic stages as SPY/QQQ/IWM.
- Use 24/7 crypto data instead of the stock-market clock.
- Crypto market data: /v1beta3/crypto/us/bars, completed 15-minute bars; fail on staleness, duplicates and malformed OHLCV.
- Crypto paper adapter: IOC market orders, permitted pairs only, paper API hostname hardcoded, idempotent client-order IDs.
- Crypto RM risk: max 0.5% of equity per new position, require cash and non-marginable buying power, two concurrent holdings maximum, pending orders count, do not auto-sell manual holdings.
- Crypto backtest estimate: 50 bps round-trip transition friction, with 2x stress; not externally validated broker tariff.
- GH scheduled runner: read-only, paperEnabled hardcoded false, public standard Actions runners, 15 minute best-effort ticks; no durable agent memory between GH runs.
- Containerized persistent runner prepared, has durable journal volume and local-only telemetry, never activated by PR merge.

## Owner performance contract — October 17, 2026

- **Virtual initial capital:** £50 (GBP shadow ledger, never Alpaca USD balance)
- **Trade entry target:** 3:1 reward-to-risk NET of modelled costs, with an initial max 1% equity risk (£0.50) and modelled profit target £1.50
- **Score threshold:** >= 80% net winners across at least 61 **closed entry-to-exit** forward trades; 49/61 minimum when n=61; positive portfolio net P&L, profit factor >= 1.25 and a single strategy cohort
- **Independence:** never count synthetic, historical backtest, pending, partially filled, or duplicated orders in the forward score
- **Accuracy:** report 95% Wilson lower bound; meeting observed 80% doesn't establish true p>=80%
- **Clock/entry:** next finalized 15-min candle open, ambiguous touch counts as stop, 30-minute signal expiration, fees estimated; FX movements omitted (GBP shadow account)
- **Safety:** persistent service explicitly rejects broker order arming until stop/target protection is independently validated

## Checker G2 — audit findings (17 October 2026)

**Verdict: NEEDS_REVISION before release approval.** Existing green CI checks verify mocked safety/unit tests, not successful forward trading, learned strategy performance or fault-tolerant operation.

### P0 — hard release blockers

1. **Objective misalignment:** `engine.mjs` optimises one of three static EMA parameter pairs based on conventional long/flat simulated net returns; `trial-50gbp.mjs` independently measures 3:1 stop/take-profit outcomes. No strategy candidate is currently selected by walk-forward, out-of-sample **3R-adjusted win rate, expectancy, profit factor or 61-trade evidence**. Implement this selection and separate training/holdout before calling it a learner.
2. **No adaptive feedback loop:** the operational service does not feed actual verified closed-trade outcomes to Researcher / Optimizer; no independent evaluation-epoch promotion or model version locking exists. It can collect virtual results only when running, not systematically learn from them.
3. **No persistent deployment:** GitHub scheduled Actions are stateless and cannot preserve the £50 trade journal. Provision and verify a private persistent machine with durable storage, restart recovery and live telemetry; demonstrate a nonzero forward sample without retroactive entries.
4. **No protective broker exit system:** native crypto bracket/OCO unsupported; 3R stops and targets are virtual only. Keep `SCALP_PAPER_ENABLED=true` hard-blocked until independent partial fill, downtime, disconnection, gap, commission and kill-switch tests pass.
5. **Strategy-cohort integrity:** prior code grouped every EMA candidate solely under `50GBP-3R-v1`, allowing results from changing strategies to be pooled. Patched in this review so trade cohort includes exact candidate ID; independent train/test phase separation and frozen candidate eligibility still needed.
6. **Accounting assumptions:** £50 is a *GBP virtual* ledger applying USD relative price changes; FX, real crypto fees, spreads, slippage and market impact aren't broker-verified. Such outcomes cannot qualify as broker-fill evidence.

### Acceptance sequence

- **P1:** independently test and rank candidate strategies using 3:1 stop/target fills *after costs* on truly held-out walk-forward folds; log rejected candidates and avoid tuning on evaluation results.
- **P2:** add separate training and frozen evaluation cohorts; retain candidate fingerprints, no mixing of parameter revisions when measuring ≥61 completed trades.
- **P3:** test durable journal recovery with network failures, duplicates, state corruption and backfill gaps; create a private always-on forward research runtime with public status disabled.
- **P4:** accumulate ≥61 closed, chronological, non-retrospective forward £50 virtual trades and evaluate ≥80% net wins, positive net return, profit factor, drawdown and confidence interval. A 61-trade observed 80% does **not** prove true win probability ≥80%.
- **P5:** only after evidence, build and separately approve protective broker-order execution; never treat paper or virtual outcomes as real-profit guarantees.

## Checker evidence
- [x] Existing equities and workflow mock tests (26 checks) passed locally.
- [x] Crypto-specific mock tests (29 checks) passed locally; 55 total.
- [x] GitHub Actions CI on rc3 implementation passed: paper runtime tests and Bootstrap & Checks, both green, 17 October 2026.
- [x] Real broker **GET-only** five-market research flow passed: BTC/USD and ETH/USD processed real 15-minute candles, both strategies were correctly **VALIDATION_BLOCKED**, and equities were MARKET_CLOSED on Saturday. The one-shot runner was hardcoded no-order. Evidence: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39063695341.
- [x] Both final post-cleanup GitHub CI workflows passed for commit `9aaef75cfded56efeb78015b9966c70f3ae9ff84` (2026-10-17): Scalp paper runtime tests and Bootstrap & Checks.
- [ ] Verified crypto broker partial fills, fractional quantity precision, dust and true tariff/market impact.
- [x] Virtual £50 risk/3R mathematics, 61-trade scoring, stale-entry expiry and stop-first replay tested: 43 automated virtual-trial checks passed before this audit, plus two additional strategy-cohort tests now under CI. Previously 98 verified checks; post-audit total should reach 100 if final CI succeeds. GitHub Actions isolated-paper-tests successful on 17 October 2026, run 39065383406.
- [ ] Full persistent journal restart and actual forward trade collection tested with persistent host.
- [ ] Verified restart recovery, lost/retried broker API response, journal integrity under real runtime conditions.
- [ ] Verified deployed HTTPS read-only telemetry, broker permissions and user kill switch.
- [ ] No untrusted library, credential or real-money endpoint introduced (review full diff before merge).
- [ ] Owner approves exact SCALP-PAPER-0.1.0-rc3 release.
- [ ] Hosting provided with durable storage; real demo orders require a SEPARATE arming step after checks.

**Do not promote research scores into deployment decisions.** The pipeline's Validator is deterministic independent arithmetic, not proof of statistical generalization or trading profitability. Crypto has materially different liquidity and execution mechanics; the numerical estimates are provisional.

**Privacy:** GitHub Actions logs and repository are public; never print credentials, account balances, manual holdings or raw order history.
