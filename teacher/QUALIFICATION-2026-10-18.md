# Teacher qualification result — 18 October 2026

**Outcome:** 0/10 currently admissible; 0/3 PAPER examiner seats assigned.
**Actual Alpaca paper orders submitted by Teacher:** 0.
**Actual broker fill-based grades:** 0.
**Existing credentials:** Three isolated PAPER accounts were previously verified 3/3 from the private Railway service via READ-ONLY GET.
**Release state:** PAPER order switch OFF. LIVE orders, deposits and withdrawals NEVER authorised.

## Independent source-grounded screening

GitHub Actions run [39138636327](https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39138636327) completed successfully using:
- The ten research leaders in `research-data/robot-academy.json` (last training through 2026-09-12).
- The separately archived, append-only GitHub `scalp-learning-memory` branch.
- Existing repo `validation-data/*.json` Alpaca/Kraken 15-minute bar snapshots.
- Read-only dated USD/GBP reference via Frankfurter/ECB.
- `teacher/auditor.mjs` checks for source-model lineage, identical frozen training fingerprint, strictly later, untouched holdout candles, at least 30 closes, positive GBP profitability at normal and doubled transaction costs, <=8% independent holdout drawdown.

| Symbol | Saved training closes | Saved training net GBP | Status |
|---|---:|---:|---|
| BTC/USD | 22 | -0.94 | BLOCKED |
| ETH/USD | 22 | -4.0403 | BLOCKED |
| SOL/USD | 23 | -0.79 | BLOCKED |
| XRP/USD | 24 | -1.32 | BLOCKED |
| ADA/USD | 22 | -0.50 | BLOCKED |
| AVAX/USD | 20 | -3.6783 | BLOCKED |
| LINK/USD | 23 | -2.07 | BLOCKED |
| DOGE/USD | 21 | -1.66 | BLOCKED |
| LTC/USD | 31 | -0.34 | BLOCKED |
| BCH/USD | 32 | -3.25 | BLOCKED |

All ten training leaders are loss-making. Eight have fewer than 30 training closes. Many also fail frozen lineage or training fingerprint reconciliation against current archived inputs. Consequently **no independent holdout profitability claim** or signed admission was issued. A high historical win rate is not a substitute for profitability.

## Blocker: fresh research credentials (separate from Railway)

The owner-directed GitHub Actions research run [39138376609](https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/39138376609) attempted live, read-only retrieval of completed Alpaca Kraken US crypto candles. It failed with `Alpaca history HTTP 401 for BTC/USD`, **before any model training**, so historical memory and Academy rankings were not refreshed. This does not mean the **three Railway paper accounts** have failed: the Railway broker preflight previously passed 3/3.

`robot-research-training.yml` uses *separate* GitHub repository Actions secrets `ALPACA_PAPER_KEY` and `ALPACA_PAPER_SECRET`. They cannot be read back through GitHub APIs or copied from Railway's private variables by this application.

The owner must refresh these two GitHub Actions secrets with a currently valid **PAPER** key pair, using **GitHub → repository Settings → Secrets and variables → Actions → Repository secrets**. Never paste credentials into GitHub code, issues, web pages or a chat. After securely rotating, re-run `Scalp City — repeated parent-seeded chart research lessons` from GitHub Actions, or update `robot-training.trigger` to trigger a new independent read-only training cycle.

## Next execution gates (no bypass)

1. Acquire fresh completed source-authenticated bars for all ten research symbols. Re-run legitimate model research and persist append-only result lineage. Ensure snapshots preserve all frozen training bars so independent auditor can reproduce training fingerprints.
2. Re-run `Teacher — independent model qualification (no orders)`. This workflow produces a read-only screening report and GitHub Actions artifact; on main it runs daily (UTC cron 14:47). A passing screening shortlist is **not** an enrolled trader.
3. If any candidate becomes independently profitable with >=30 training closes, correct untampered lineage, >=30 untouched holdout closes, positive normal and double-cost GBP outcomes and <=8% holdout drawdown, review a frozen, signed admission and select up to three pupils whose crypto symbols map to distinct preflighted PAPER accounts.
4. Only after separately reviewing the exact code release, kill switches, live-paper broker fill/CFEE/FEE activity shapes, cross-system position reconciliation and owner release controls may the PAPER-only execution latch be armed for a limited examination.
5. Independently reconcile each real Alpaca PAPER fill, fee and partial fill and obtain >=30 independently closed round trips after admission. Grade publishing remains cryptographically signed, fail-closed, and unavailable without actual evidence.

**No model was paper-examined and no real fills were obtained at this checkpoint.** Treat any promise of profitable or qualified models without these gates as unverified.
