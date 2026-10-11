# Scalp City Lab · BT-01 / VA-01 integration v1.1.1

**Target:** `tristanpeto123-eng/Scalp-City-Lab` ONLY. The production repository `Scalp-City-1` must remain unchanged.

## Included

- `cfd-engine.js` — deterministic alphabetic symbol ordering for all strategies, especially directional beta-hedged pairs; engine version plus a reproducible FNV-1a input checksum.
- `backtester-agent.js`, `backtester-agent-worker.js` — publish the dataset used and its versioned checksum to the agent event bus for audit.
- `validator-agent.js`, `validator-agent-worker.js`, `validator-agent.json` — isolated VA-01 validator worker, audit reports, explicit safety blockers, no trading permissions.
- `backtester-agent-ui.js` — fully legible per-strategy mobile cards, selectable details, audit status, export buttons.
- `backtester-agent.css` — responsive iPhone layout and separate VA-01 panel.
- `sw.js` — cache invalidation and offline asset list; **Lab-only cache names and cleanup**, to avoid deleting production caches on the shared GitHub Pages origin.

## Diagnosed CFD-003 disagreement

Exactly the same 685-session, nine-stock imported-price panel produces **-15.203758%** when symbols are passed in alphabetic order and **+1.372560%** when the old simulator is passed symbols in the original hand-built collection order. The pairs algorithm regresses A on B (an asymmetric calculation), and its enumeration order previously depended on input order. The first number matches the user's iPhone-imported CSV. The +1.37% is NOT an independent benchmark. Standardizing the order makes both routes produce -15.203758%; this does not validate or improve the strategy.

## Validation scope

VA-01 independently recomputes report cost reconciliation, ending equity, reported percentage return, maximum drawdown, Sharpe, final-30% return, data order, source checksum and doubled execution-cost direction. It does **not** reconstruct individual fills or guarantee the absence of lookahead, historical point-in-time bias or corporate action errors. Reports remain blocked for live trading.

## Install to Lab

1. Open `https://github.com/tristanpeto123-eng/Scalp-City-Lab` on the **main** branch.
2. Unzip the provided `Scalp_City_Lab_BT01_VA01_v1.1.1_Upload.zip` on your iPhone or computer. **Upload the files, not the ZIP** — GitHub does not extract uploaded ZIP archives.
3. Choose **Add file → Upload files**, add the **contents** of its `upload-root/` folder to the repository **root**, replacing existing files. Do not upload `upload-root` as a nested directory.
4. After commit, visit `https://tristanpeto123-eng.github.io/Scalp-City-Lab/` in a new tab, import `bt01_realprice_panel_2019_2021.csv`, select **ALL SIX STRATEGIES**, choose **BACKTEST + 2× COST STRESS**.
5. Confirm all six iPhone cards show complete metrics. Confirm **VA-01** shows **6/6 accounting passes**, **4 or more trading blockers**, and **NOT APPROVED FOR LIVE TRADING**. Export both JSON reports.
6. If your phone still displays old files, hard-refresh the website or clear **only the Lab site's** offline cache. Do not modify Scalp-City-1.

### Regression tests (local)

From the project root with Node.js 22+, run:

```
node tests/test-agent.mjs
node tests/test-v1.1.mjs
```

Tests use synthetic prices and the supplied preliminary real-price CSV. The real-price panel uses adjusted historical stock prices from a fixed set of surviving stocks, and theoretical fees; outcomes have no production-trading evidentiary status.

## Isolation note

Agent report history and Service Worker cache names are Lab-specific. The existing base `app.js` still uses its original `scalp-city-v1` IndexedDB/session configuration; full application-wide sandboxing remains a separate migration. Do not sync Lab session data to a production GitHub knowledge prefix. The update intentionally changes only the BT-01 and VA-01 system.
