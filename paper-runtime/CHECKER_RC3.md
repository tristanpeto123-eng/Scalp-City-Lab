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

## Checker evidence
- [x] Existing equities and workflow mock tests (26 checks) passed locally.
- [x] Crypto-specific mock tests (29 checks) passed locally; 55 total.
- [x] GitHub Actions CI on rc3 implementation passed: paper runtime tests and Bootstrap & Checks, both green, 17 October 2026.
- [x] Real broker **GET-only** five-market research flow passed: BTC/USD and ETH/USD processed real 15-minute candles, both strategies were correctly **VALIDATION_BLOCKED**, and equities were MARKET_CLOSED on Saturday. The one-shot runner was hardcoded no-order. Evidence: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39063695341.
- [ ] Re-check the final cleanup commit's CI status before owner release review.
- [ ] Verified crypto broker partial fills, fractional quantity precision, dust and true tariff/market impact.
- [ ] Verified restart recovery, lost/retried broker API response, journal integrity under real runtime conditions.
- [ ] Verified deployed HTTPS read-only telemetry, broker permissions and user kill switch.
- [ ] No untrusted library, credential or real-money endpoint introduced (review full diff before merge).
- [ ] Owner approves exact SCALP-PAPER-0.1.0-rc3 release.
- [ ] Hosting provided with durable storage; real demo orders require a SEPARATE arming step after checks.

**Do not promote research scores into deployment decisions.** The pipeline's Validator is deterministic independent arithmetic, not proof of statistical generalization or trading profitability. Crypto has materially different liquidity and execution mechanics; the numerical estimates are provisional.

**Privacy:** GitHub Actions logs and repository are public; never print credentials, account balances, manual holdings or raw order history.
