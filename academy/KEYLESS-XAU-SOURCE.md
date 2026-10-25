# Academy XAUUSD Keyless Source — review milestone

## Purpose
Train the existing offline Discovery Engine and Neural Teacher on real, externally published historical XAUUSD five-minute candles **without a broker API key**. This is a *research evaluation*, not authenticated paper performance.

## Source and coverage
Initial source: GetData public GitHub XAUUSD 5m **sample** (self-described as derived from Dukascopy). Source: https://github.com/getdata-finance/xauusd-5m-ohlcv-metals-historical-data
The public sample currently covers approximately **six months**, not the 360-day target. Its origin has NOT been independently authenticated. No claim of actual Dukascopy feed authenticity or broker fill validity is made. The sample may change weekly.

The GitHub Action downloads the sample temporarily over HTTPS; it does not commit or republish the market CSV. It validates five-minute chronology and OHLC, preserves real gaps, normalises `datetime` to `time`, computes raw and normalised SHA-256 hashes, and records range, count and provider identity. All downstream profit results are tagged `HISTORICAL_DEVELOPMENT_ONLY`. Provider/reuse rights must be reviewed before commercial use.

## Run manually
1. Obtain the freely published sample yourself, saving it as `/tmp/XAUUSD_5m.csv`, or use the action in `.github/workflows/academy-keyless-xau.yml`.
2. `node scripts/intake-xau-sample.mjs /tmp/XAUUSD_5m.csv /tmp/xau-normalized.csv /tmp/xau-provenance.json`
3. `node scripts/discover-academy.mjs /tmp/xau-normalized.csv /tmp/xau-discovery.json`
4. `node scripts/train-academy.mjs /tmp/xau-discovery.json /tmp/academy-out`

No final holdout is evaluated, no real paper account is connected and no model is appointed. Only the unverified research report and provenance manifest are published as short-lived private run artifacts. Neural weights are NOT published by the workflow.

## Limitations and next
- No 360-day XAUUSD feed yet. For that, use a separately reviewed, rate-limited direct Dukascopy downloader or other licensed source before further scientific conclusions.
- A single public sample remains independent of broker fills, latency, actual spreads and venue restrictions.
- Retraining on the same source SHA is not an additional experiment or new evidence. The standalone SL strategy, crypto Academy and Trading Floor are unchanged.
- Until an independent unseen test and then forward broker-paper reconciliation pass, performance cannot qualify a pupil for graduation.

**Research / Checker only**. Owner must explicitly approve exact releases and any future broker paper connection.