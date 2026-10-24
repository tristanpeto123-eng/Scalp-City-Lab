# Scalp City Lab

This is an isolated, **simulation-only** development clone of [Scalp-City-1](https://github.com/tristanpeto123-eng/Scalp-City-1). The source snapshot was pinned to commit `3b246ebec0458734509135a5317e2af011d45408`.

The Lab uses different IndexedDB/localStorage namespaces, a different PWA identity and service-worker cache, and GitHub memory sync locked to this repository and the `knowledge-lab` prefix. It does not access or update the stable repository's history.

The existing 3D research room, six-strategy BT-01 backtester and browser optimizer are experimental software; the research results are **not evidence of live profitability**. The independent agent permission pipeline is a roadmap and design contract, not implemented runtime enforcement. **No live broker credentials or real-money trading allowed.**

A separate experimental supervised-learning strategy, **SL**, is available at [SL Strategy](sl-strategy.html), with its own [research specification](SL-STRATEGY.md) and isolated memory. It includes five-minute research and candle replay for Commodities, Forex and Indices, with optional **Fetch 5m online** using a personal Twelve Data API key (gold/commodities require a suitable paid provider plan), plus CSV import fallback. It is not a live or paper trader.

See [Agent Workflow](WORKFLOW_V1.md) and [Roadmap](LAB_ROADMAP.md).

## Running Lab
Once GitHub Actions bootstrap passes, enable Pages using Settings → Pages → Deploy from branch → main / root. Test on iPhone: 3D loading, 3 ticker selection, CSV import, start/stop, local save, BT-01 report export and read-only Lab storage. Do not configure GitHub memory tokens until testing the Lab-only repository guard.

## Development rule
No automatic deployment or promotion into Scalp-City-1. Release candidates require independent validation, risk checks and human review. The Lab workflow never touches the original repository.

**SL historical chart imports now persist locally**: after importing a 5-minute CSV or fetching a permitted online symbol, the candles are saved to IndexedDB and reloaded by market/symbol. Section 4 can use **Process loaded 5m candles** without an API key for a single simulation/training cycle. Automated online loop fetches are credit-guarded to once an hour per symbol with up to 5,000 bootstrap/180 incremental candles; real broker trading is disabled. Model backup remains a separate explicit private GitHub vault process.
