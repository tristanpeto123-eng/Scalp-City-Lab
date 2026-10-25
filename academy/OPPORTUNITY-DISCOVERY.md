# Academy Opportunity Discovery v1 — review candidate

**Scope:** XAUUSD five-minute offline historical research. No broker/API key, paper/live orders, SL changes or automatic promotion. This is the Discovery milestone, not a trained network.

## Input and process

Use a local XAUUSD-5m.csv with time,open,high,low,close and optional volume. Times must be ISO 8601, UTC when no offset is supplied. Accepted range: 150–150,000 completed five-minute candles. Duplicates, invalid OHLC, incomplete last candles and out-of-order data cause errors. Genuine market closures are preserved, not filled; no candidates cross a gap.

Each eligible *completed signal candle* yields two directions (LONG/SHORT) and two predefined holding/stop/target configurations. Inputs use the closed signal bar and previous bars only. Virtual entries use the following candle's open. Stops, targets and time exits use OHLC; adverse opening gaps fill at the worse open and simultaneous intrabar stop/target touches are treated **stop first** because their order cannot be known.

Virtual net profit is signed return times GBP notional, minus modeled costs on **both** sides (default 8 basis points each; stressed at 16). Positive net = GOOD (1); negative = BAD (0); essentially zero = NEUTRAL (null). Winning labels alone cannot establish decision quality. Alternatives generated at one timestamp share a groupId because they are correlated counterfactuals, **not independent executions**.

Chronological allocation: earliest 60% training, next 20% development, final 20% RESERVED. This engine does not simulate or label the final test segment, and excludes any candidates crossing phase boundaries. The label report is unverified research; independent exam must be performed later.

## Run (no credentials)

From repository root:

node --test academy/opportunity-discovery-tests.mjs

node scripts/discover-academy.mjs /path/to/XAUUSD-5m.csv /tmp/xau-discovery.json

The repository currently contains **no independently verified 360-day XAUUSD dataset**. Unit tests create synthetic prices solely for software checks, not a claim about XAUUSD market performance. The CLI refuses to invent missing data.

Optional GitHub Action runs the tests and the CLI if academy-data/XAUUSD-5m.csv has been deliberately supplied. When missing, it records NO_SOURCE_DATA without outputting fake trades. Generated JSON is a temporary Actions artifact, not a public research grade. Uploading historical vendor data to a public repository could violate a licence; use a controlled runner if source rights require it.

## Next stages

1. Independently verify 360 days of real XAUUSD data (source, timezone, instrument and licence).
2. Build group-aware Teacher training from TRAIN examples, threshold selection on DEVELOPMENT, frozen model checkpoint registry, and an independent final test.
3. Add genuinely new market evidence and automatic retraining only when that evidence exists.
4. Require the owner's explicit exact-version approval before any Trading Floor broker-paper appointment.

No Scalp-City-1 changes, broker connections, deposits or order routing are permitted by this patch.