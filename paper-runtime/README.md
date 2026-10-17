# Scalp City Lab — Connected live-data / demo-order runtime (release candidate)

**Status: build/test candidate. NOT deployed. Not financial advice.** No real-money execution endpoint or override is implemented. Runs on a persistent Node.js 20+ host, not inside GitHub Pages or an iPhone background tab.

## Functional 12-station handoff

`BM-01 → DC-01 → RS-01 → SD-01 → OP-01 → BT-01 → VL-01 → SC-01 → RM-01 → PT-01 → JR-01 → VA-01`, then evidence returns to the next cycle. Validation failures route to Journal/Vault without Risk or Trader authority. All stages are functions consuming predecessor output, not autonomous LLM processes. No operator can bypass Validator/Scorer/Risk in this implementation.

- **BM-01:** Sequential orchestration; market clock gate; no work when closed.
- **DC-01:** Historical 15-minute *completed* IEX bars with timestamps, OHLC sanity, lag, duplicates and shape checks.
- **RS-01:** A deterministic long/flat trend hypothesis.
- **SD-01:** Three explicitly defined EMA candidates; hashes rule version.
- **OP-01:** Training-only parameter selection, no access to held-out scores.
- **BT-01:** Cost-aware research simulation, next-open fills only, no external orders.
- **VL-01:** Separate holdout math implementation and 2× cost audit; rejects insufficient/negative results.
- **SC-01:** Only eligible validation reports are ranked for a paper-only decision.
- **RM-01:** Freshness, account state, open orders, holdings, ≤1% daily loss stop, ≤2 holdings, 1% equity per new position, no shorts.
- **PT-01:** Disabled by default; submits ONLY through `https://paper-api.alpaca.markets/v2/orders`, idempotent client IDs and recorded pre-submission intents; submitted does not mean filled.
- **JR-01 / VA-01:** Append-only sha256-chain event records and evidence metadata; not a profitability learning model yet. Automatic optimizer learning from new fills is intentionally withheld until independently checked.

**Opening-session protection:** The engine waits for the first completed New York session candle (09:30–09:46:30 ET, DST-aware) rather than incorrectly halting when the last valid bar is from the previous session. This is a timing grace, never permission to trade stale bars. The bot refuses to auto-sell manual or unattributed holdings, and pending buys count toward the two-position cap.\n\n**Emergency stop limitation:** Stops new paper-order submissions but does not automatically cancel previously accepted paper orders or liquidate existing paper positions; use the broker dashboard for those operations.

**Limitations:** IEX-only quote coverage, partial market visibility; simple EMA research candidates; approximate fees, no point-in-time constituent/delisting validation, no full transaction-price or corporate-action simulator. Held-out backtest screens are not profitability proof. The 15-minute candles may have gaps on single-exchange data; the safety gate stops on stale feeds. Chart display is observation only. Market closed outside US equities hours. No XAUUSD/CFD adapter in this release.

## Configuration and execution

1. Open an **Alpaca paper trading** account. Create **paper-specific** keys only (never paste keys in ChatGPT, GitHub, or the browser UI).
2. On a private always-on Node.js host, set `ALPACA_PAPER_KEY` and `ALPACA_PAPER_SECRET` as environment secrets.
3. Run `node paper-runtime/tests.mjs`, then `node paper-runtime/preflight.mjs` to verify the real paper account and recent IEX bars **without placing an order**. Preflight reports `MARKET_CLOSED_OR_OPENING_GRACE` on weekends or before the first completed 15-minute candle.\n4. Run `node paper-runtime/service.mjs` on a persistent private host. Default is data ingestion and **dry-run proposed orders only**.
5. After owner approval of this exact release and broker configuration, explicitly set `SCALP_PAPER_ENABLED=true` and `SCALP_RELEASE_APPROVED=SCALP-PAPER-0.1.0-rc2` to arm paper demo orders, then restart. No live-trading switch exists.
6. Optional read-only City connection: set `SCALP_ALLOWED_ORIGIN=https://tristanpeto123-eng.github.io` and serve this status API over HTTPS behind a reverse proxy. Install `agent-city-live.js` next to `agent-city.html`, add `<script src="./agent-city-live.js" defer></script>` before `</body>`, then enter the HTTPS server origin using CONNECT PAPER STATUS. **Never expose secrets or POST controls to the browser.**

Other variables: `SCALP_JOURNAL_DIR` (private persistent journal storage), `SCALP_BIND` (`127.0.0.1` default), `PORT` (`8787` default). HTTPS and credential security are host deployment requirements. Do not publicly expose `/api/status` without appropriate authentication/reverse-proxy access control: strategy telemetry may be sensitive.

## Free GitHub Actions connection verification (zero orders)

Once **this exact release is approved and the workflow is merged**, navigate to the Scalp-City-Lab repository's **Settings → Secrets and variables → Actions** and add two repository secrets named `ALPACA_PAPER_KEY` and `ALPACA_PAPER_SECRET`. Use **paper-account keys exclusively**. Do not paste credentials into chat, issues or source files. Then open **Actions → Alpaca paper account connection (read only) → Run workflow**. This workflow checks paper-account status and historical completed IEX candles for SPY, QQQ and IWM. It **never calls the order API**. It can be run on weekends; outside trading hours it reports the market-closed state rather than claiming a live feed was validated.

**Important:** `workflow_dispatch` is only offered once the workflow exists on the default branch. Until PR #1 is approved and merged, the new manual workflow is present only on its review branch, so no account connection has been attempted. The Actions runner stops at the end of the test; it is **not continuous bot hosting**.

## Acceptance gates

1. Synthetic or stale bars denied.
2. Duplicate or malformed bars denied.
3. Missing holdout audit denies orders.
4. Validation failure never invokes risk/trader stage.
5. Risk veto cannot be overridden; stop latches until manual restart.
6. Same-bar duplicate deduped; idempotency verified with broker.
7. Failed/unknown broker API statuses halt rather than guessing order success.
8. Real-money API never addressed.
9. Only completed candle prices can influence signals.
10. Journal chain verified on startup; no approval inferred from research score.

This is an initial verifiable connected-agent **implementation**, not a claim that all existing Agent City illustration stations or the original BT-01 historical-worker UI have been converted to production-grade autonomous agents. Deployment and switching on external demo orders remain owner-controlled.
