# Academy — Gold and Silver as separate native 15-minute training sets

**Purpose:** keep the existing 5-minute XAUUSD student research intact, import the previously obtained 360-day **15-minute** XAUUSD history as **Training Set B**, and add a distinct silver (**XAGUSD**) **Training Set C**. All evaluation remains historical and virtual. This patch does not merge markets into one model, approve any broker access, or inspect the sealed final 20%.

## Data sources

- **Set B: XAUUSD / native 15Min.** Previously saved, owner-provided dataset 23,416 OHLC candles from 2025-10-29 00:00 UTC to 2026-10-23 20:45 UTC. Raw SHA-256 `bf80e4e48c127573735499ee9c081f8f649e1c5414f8964b014215ef2a962bc2`. Span = 359.865 days (not literally a complete 360×24-hour window). 327 recorded timestamp discontinuities; most are expected weekends/market closures and cannot be blindly filled. Volume absent. Source institution, bid/ask and exact price convention remain unverified. The ORIGINAL CSV is deliberately **not** published to this public repository; only source fingerprint/metadata is retained. See `research-source-registry`.
- **Set C: XAGUSD / native 15Min.** Public **six-month** silver sample from the GetData GitHub repository `getdata-finance/xagusd-15m-ohlcv-metals-historical-data`. This sample is source-*reported* historical market data, not independently authenticated Dukascopy tick/BID-ASK execution data. CI fetches the sample temporarily and retains only short-lived metadata/research reports.
- **Set A remains existing XAUUSD 5Min** from its separate source. A and B overlap in calendar time; their apparent results must not be treated as independent proof. Silver and gold share commodity/macro risk drivers: different symbols are not necessarily statistically independent returns.

## Separate neural specialists

Both markets use the same research code but have distinct timestamp groups, Good/Bad outcomes, fitted weights, checkpoint symbols and SHA-256 identities. The Teacher refuses to score an XAGUSD candidate with an XAUUSD checkpoint. Both preserve source-native 15-minute chronology; nothing is interpolated to fake 5-minute OHLC.

For each, train on the early train partition, pick a threshold from later train data, report development results, and keep the final 20% untouched. Broker permissions stay OFF even for a profitable result. Costs remain illustrative modelled basis points and need venue-specific verification.

## Import private gold locally

`node scripts/import-commodity-training-set.mjs XAUUSD "/private/path/original-gold.csv" "/private/academy/gold-set-B"`

The importer requires UTC ISO timestamps and `time,open,high,low,close` with optional volume; the source remains private. It creates an immutable manifest, model file, and development report in the caller's private directory (no silent overwrite). For the silver public sample, `datetime,open,high,low,close,volume` is also accepted and normalized in memory without changing the original-source hash.

Silver example:

`node scripts/import-commodity-training-set.mjs XAGUSD "/private/path/XAGUSD_15m.csv" "/private/academy/silver-set-C" PUBLIC_SAMPLE_UNVERIFIED`

Do not upload copyrighted/restricted source prices to public GitHub. The data-source fingerprints cannot authenticate quoted broker fills.

## Checker acceptance rules

- Native 15Min input only, no fake 5Min, strict OHLC/time verification
- Unique source hash, independent gold and silver model identity
- Cross-symbol prediction rejected; source overlap explicitly acknowledged
- Good/Bad samples and profits are **modelled counterfactuals**, not independent trade executions
- No broker accounts/orders, no automatic deployments and no sealed final test exposure
- Profitability gate never bypassed to force trades
- Silver GitHub Actions source-backed test is **experimental**; additional verification is needed before claiming verified silver profitability

**Promotion:** owner approval, independent unseen examination and separately authorised broker-paper testing are future requirements.
