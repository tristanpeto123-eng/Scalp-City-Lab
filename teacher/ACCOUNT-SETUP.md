# Teacher PAPER credentials — safe Railway setup

**Credentials must be entered in Railway, not in ChatGPT, GitHub commits, Issues, Pages, or the public gateway.**

1. Open the Railway project **Scalp City Teacher Paper Exams**.
2. Select **teacher-private-examiner** (not **teacher-signed-gateway**).
3. Under **Variables**, select **New Variable**. Name it exactly `TEACHER_PAPER_CREDENTIALS_JSON`.
4. Value: one JSON object containing each pupil's dedicated **PAPER** API key/secret pair. Replace the example strings locally, directly in Railway. An incomplete object is permitted for staged checking but can never pass the complete 10-account gate:

```json
{
  "BTC/USD":  {"key": "BTC_PAPER_KEY",  "secret": "BTC_PAPER_SECRET"},
  "ETH/USD":  {"key": "ETH_PAPER_KEY",  "secret": "ETH_PAPER_SECRET"},
  "SOL/USD":  {"key": "SOL_PAPER_KEY",  "secret": "SOL_PAPER_SECRET"},
  "XRP/USD":  {"key": "XRP_PAPER_KEY",  "secret": "XRP_PAPER_SECRET"},
  "ADA/USD":  {"key": "ADA_PAPER_KEY",  "secret": "ADA_PAPER_SECRET"},
  "AVAX/USD": {"key": "AVAX_PAPER_KEY", "secret": "AVAX_PAPER_SECRET"},
  "LINK/USD": {"key": "LINK_PAPER_KEY", "secret": "LINK_PAPER_SECRET"},
  "DOGE/USD": {"key": "DOGE_PAPER_KEY", "secret": "DOGE_PAPER_SECRET"},
  "LTC/USD":  {"key": "LTC_PAPER_KEY",  "secret": "LTC_PAPER_SECRET"},
  "BCH/USD":  {"key": "BCH_PAPER_KEY",  "secret": "BCH_PAPER_SECRET"}
}
```

Each key/secret belongs to the corresponding *distinct PAPER account*, not to a live account. The account's dashboard label is only for human reference; the exact JSON key above (`BTC/USD`, etc.) maps it to the robot. Railway's Variables panel redeploys the service when the variable is committed.

**No enabling switches:** Keep `TEACHER_PAPER_ENABLED=false` and `TEACHER_ENABLE_EXAMINER=false`. They are independent controls. Never set them true merely because credentials were added.

## Automatic read-only verification

At startup, the private examiner:
- Parses only this private environment variable.
- Rejects invalid JSON, unexpected symbols, duplicate keys and shared Alpaca account IDs.
- For each supplied account, uses **GET only** against `https://paper-api.alpaca.markets` for account state, crypto asset permission, positions and open orders. It never submits or cancels orders.
- Reports only bounded check metadata (pupil symbol, pass/fail and counts), not the API keys, secrets, account ID, account balance or raw broker response.

View sanitized status at [Teacher connection status](https://teacher-signed-gateway-production.up.railway.app/api/connection) after the private examiner and gateway have picked up this release. `paperAccounts.status=ALL_ACCOUNTS_VERIFIED` and `passed=10` indicate ten accounts have passed connection checks, **not** that research pupils have been admitted, trades have occurred or grades were verified.

If credentials are missing, the public status is `NOT_CONFIGURED`. Other statuses include `PARTIAL_ACCOUNTS`, `DUPLICATED_CREDENTIALS`, `SOME_ACCOUNTS_FAILED` and `READ_ONLY_CHECK_ERROR`. Review accounts in Alpaca / Railway privately; do not expose the JSON configuration in screenshots or support tickets.

Independent model qualification, funded live account trading and withdrawals remain separately controlled and **disabled**.
