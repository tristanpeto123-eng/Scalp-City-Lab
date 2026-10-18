# Alpaca three-seat PAPER account commissioning

**Alpaca permits three PAPER accounts under one owner login.** Three separate accounts are sufficient for the ten-pupil Scalp City Academy: only up to three independently qualified pupils may be assigned to live PAPER examination seats concurrently; the other pupils stay in research/queue. No account should be reused concurrently by two active paper traders.

Official references: https://alpaca.markets/learn/start-paper-trading and https://docs.alpaca.markets/us/docs/paper-trading

## Secure configuration (3 real PAPER keys, never in source or chat)

1. Open the Railway **Scalp City Teacher Paper Exams** project.
2. Select **teacher-private-examiner**, not **teacher-signed-gateway**.
3. Go to **Variables → New Variable**. Name it `TEACHER_PAPER_CREDENTIALS_JSON`.
4. Paste this **template in Railway's private variable editor**, replacing only the six placeholder strings with the corresponding three dedicated Alpaca PAPER account credentials:

```json
{
  "BTC/USD": {"key": "PAPER_BTC_KEY_ID", "secret": "PAPER_BTC_SECRET_KEY"},
  "ETH/USD": {"key": "PAPER_ETH_KEY_ID", "secret": "PAPER_ETH_SECRET_KEY"},
  "SOL/USD": {"key": "PAPER_SOL_KEY_ID", "secret": "PAPER_SOL_SECRET_KEY"}
}
```

The three currencies above are **example assignments**, not a hard-coded condition. If you have made three differently named PAPER accounts, their dashboard names don't matter: map each distinct real PAPER key pair to whichever three Academy pairs you actually want to commission, choosing from BTC/USD, ETH/USD, SOL/USD, XRP/USD, ADA/USD, AVAX/USD, LINK/USD, DOGE/USD, LTC/USD and BCH/USD. `TEACHER_PAPER_CREDENTIALS_JSON` maps chart symbols to *PAPER API credentials*, not Alpaca account display names.

**Never** store Alpaca keys in chat, GitHub, screenshots, client storage or the public signed gateway. Never use LIVE Alpaca API credentials here.

5. Save and apply Railway's deployment changes.
6. Keep `TEACHER_ENABLE_EXAMINER=false` and `TEACHER_PAPER_ENABLED=false` at all times during this commissioning stage.
7. Confirm read-only status from the existing signed HTTPS gateway `GET https://teacher-signed-gateway-production.up.railway.app/api/connection`.

## What counts as success

`paperAccounts.status = ALL_SLOTS_VERIFIED` with `required=3`, `configured=3`, `checked=3`, `passed=3`, and `academyPupils=10`. That result means **three distinct PAPER accounts** were independently validated for their selected symbols via GET-only requests. It does **not** prove paper fills, strategy profit, eligibility, a signed forward grade, or authorize trading.

A single or two-account setup returns `PARTIAL_SLOTS`; a mapping with more than three returns `EXCEEDS_PROVIDER_LIMIT` and does not contact the broker. Duplicate API keys or broker account IDs, blocked/unclean accounts and missing crypto trading permissions cause failed checks. Preflight never places, modifies or cancels orders.

## Rotation after a pupil finishes

Archive that pupil's signed history and stop its paper cycle; ensure that account has **zero unowned positions and outstanding orders** before reassigning the seat. Keep the past immutable and explicitly map the reassigned broker keys to the next chosen Academy symbol in Railway. Changing the JSON mapping alone **does not** constitute proof of a completed examination or authorize order writes. Re-run independent read-only preflight and require a separate signed admission and approval for any subsequent examination.

**The ten research pupils continue running/researching irrespective of only three PAPER accounts.** Real-money trading, deposits and withdrawals are not available in this commissioning workflow.
