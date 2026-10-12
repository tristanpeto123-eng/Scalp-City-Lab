# BT-01 + VA-01 Lab hotfix v1.1.2

## Issue found
The v1.1.1 `backtester-agent-ui.js` shipped a malformed button HTML attribute:
`id="cfdExport type="button"`, which parses as `id="cfdExport type="`, so `#cfdExport` does not exist and the module throws when binding the button listener. The new Lab UI can therefore fail to finish initializing.

This fix restores `id="cfdExport" type="button"`, adds a visible `BUILD 1.1.2` marker in the modal heading, and increments the **Lab-only** PWA service-worker cache key. The six trading strategy algorithms, BT-01 report history, and VA-01 validation worker are unchanged.

## Install — Lab only
1. Open https://github.com/tristanpeto123-eng/Scalp-City-Lab (main branch).
2. Upload the TWO files `backtester-agent-ui.js` and `sw.js` from this hotfix into the **repository root**, replacing their existing counterparts. Do not upload a nested folder or zip file as a single repository file.
3. Open the exact URL https://tristanpeto123-eng.github.io/Scalp-City-Lab/ and reload in a new browser tab. Do not use `/Scalp-City-1/` (production).
4. Open BT-01; its heading must read `SCALP CITY LAB · BT-01 / VA-01 · BUILD 1.1.2`.
5. Import your real-price CSV, select `ALL SIX STRATEGIES`, run `BACKTEST + 2× COST STRESS`, and verify the results appear as 6 full-width cards on an iPhone. Scroll to the VA-01 panel to read the audit.
6. Export both the BT-01 report JSON and the separate VA-01 validator audit JSON.

If the build stamp remains absent after deploying, the device is on production or an old cached page. Close old tabs, use Safari directly (rather than the chat's in-app web view), reload the Lab URL, and inspect the Safari page URL including its path.

## Safety
All results remain research-only. Adjusted stock prices, limited surviving stocks, assumed fees, and absent independent point-in-time data prevent any real-money strategy approval.
