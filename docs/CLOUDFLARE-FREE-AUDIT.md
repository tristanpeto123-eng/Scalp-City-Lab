# Scalp City — £0 Cloudflare + GitHub research/audit foundation

**Scope:** Source-backed research history and tamper-evident *unverified* records on Cloudflare Workers **Free**. No live or simulated brokerage order submission, no trading automations, no model promotion, and **no paid Render or Railway deployment**.

The original Python broker executor still requires a trusted durable single-writer host before it may submit PAPER orders; it is deliberately NOT moved into this Worker. The Worker neither imports a DQN nor calls Alpaca. Its audit records do **not** represent forward performance or official Teacher grades.

## What is built

- GitHub Pages continues to host Scalp City pages (where enabled already).
- GitHub Actions handles research with the existing ten 5-minute DQNs on its existing branches.
- Cloudflare Worker **scalp-city-free-audit** exposes a public GET-only /health route. All audit routes require a **private bearer token** configured as a Cloudflare Worker secret. It has no CORS response, no browser token, no coin inventories, orders or brokerage credentials.
- One SQLite-backed Durable Object is deterministically addressed as **single-research-audit-v1**. It atomically journals idempotent research checkpoint receipts with a SHA-256 hash chain. Total receipts are capped to 512 to keep this small. Each record is classified GITHUB_RESEARCH_UNVERIFIED, with paperOrders=0, liveOrders=0 and officialGrades=0; no broker grading may be inferred.
- Manual GitHub Action **Cloudflare free research history** fetches the current rl-learning-memory branch and converts all ten real pupil research manifests into normalized receipts. It rejects missing source lineage, unexpected assets, any broker executions or forward-grade claims. It is manually triggered and will not run without secret authorisation.
- SQLite DO free-tier storage is bounded by Cloudflare's account-wide free quotas; no paid services, R2, cron schedules, queues or container instances are configured.

**Do not merge or deploy the paid Render Blueprint (PR #56) as part of this plan.** We keep its tested work archived only. PR #54 is also optional, not a dependency.

## Create a Cloudflare Free account without payment

1. Open https://dash.cloudflare.com/ and create/log into a Cloudflare account.
2. Confirm **Workers & Pages → Free**. Do **not** switch to the Workers Paid plan, enter a payment card, accept an upgrade, or enable a billable product. Stop if the dashboard requires payment for the chosen setup.
3. In Cloudflare, find the **Account ID**, and create a least-privilege **Edit Cloudflare Workers** scoped API token for that account. No token may be pasted into a chat, code, browser URL or public issue.
4. In the **GitHub repository** Settings → Secrets and variables → Actions, create two repository **secrets**:
   - CLOUDFLARE_ACCOUNT_ID — the Cloudflare account ID.
   - CLOUDFLARE_API_TOKEN — your scoped Cloudflare deployment API token.
5. Under Actions **Variables**, set:
   - CLOUDFLARE_FREE_PLAN_CONFIRMED = YES_FREE_NO_BILLING
   Do this only after checking the Cloudflare account plan. This is an owner confirmation, **not** technical proof that an account can never have charges.
6. Merge the vetted Cloudflare audit PR into **main**, separately from the parked paid Render PR. From GitHub Actions, run **Cloudflare free read-only audit — manual deployment only** on branch main, enter the exact confirmation text:

       DEPLOY_FREE_RESEARCH_ONLY

   The job validates the Worker code and performs a normal Wrangler deployment. It is **workflow_dispatch only** (never on push/schedule). The deployed Worker has NO SCALP_CF_AUDIT_TOKEN secret initially, so only /health works and its private routes are closed. Publishing the service does not enable any broker activity.
7. In Cloudflare's dashboard, review the new Worker: one SQLite Durable Object, no queues/cron/containers, on the **Workers Free** plan. Record the exact Worker URL of the form:

       https://scalp-city-free-audit.<your-workers-subdomain>.workers.dev/

8. Generate a new random **40-byte (or longer)** token locally in a trusted password manager or secure random generator. This is an **audit token**, not Alpaca credentials. Install the exact same value:
   - As a **Cloudflare secret** SCALP_CF_AUDIT_TOKEN in the Worker settings (secret text, not a plain variable).
   - As a GitHub Actions **repository secret** SCALP_CF_AUDIT_TOKEN.
   Never put the secret into GitHub files, Pages JavaScript or HTTP query strings.
9. Add the GitHub Actions **variable** SCALP_CF_FREE_WORKER_URL to that exact HTTPS Worker URL (trailing slash). The research sync script accepts only an allowlisted host starting **scalp-city-free-audit.** and ending **.workers.dev**, with no redirect or custom query.
10. Run the manually dispatched GitHub workflow **Cloudflare free research history — manually sync ten ungraded models** on branch main with:

       SYNC_UNVERIFIED_RESEARCH_ONLY

    The job authenticates and posts ten source-validated research receipts (idempotent if repeated). Logs show symbols and truncated event digests, not secrets. Again **no brokerage account or funds are touched**.

The free Worker can answer these endpoints:

| Method/path | Authorisation | Semantics |
|---|---|---|
| GET /health | Public | Static safe health; no account or secret information |
| GET /v1/audit/status | Private bearer | SQLite journal count, last hash, unverified state; **zero official grades** |
| GET /v1/audit/verify | Private bearer | Internal hash-chain self-consistency up to 64 records; **not external provenance verification** |
| POST /v1/audit/research | Private bearer | Validate/append an unverified research checkpoint, duplicate-safe |
| POST /v2/orders, /broker/*, unknown routes | Not available | No order placement or credentials |

No CORS permission is granted. Don't put a private bearer token in a browser dashboard; future UI should consume only public sanitized information. Only /health is unauthenticated.

## Local tests / independent GitHub checks

The pull request checker performs:
1. Strict static review: free SQLite-backed Durable Object only, no paid storage, no queue/cron/scheduled trade, no broker URL, no secret in source.
2. Node tests for canonical source hashes, forbidden fields, simulated-only labels, missing provenance and tamper detection.
3. Wrangler bundle **dry-run**.
4. A real local workerd/Wrangler test using local SQLite: authenticated append, unauthorized denial, exact duplicate re-upload, wrong/dangerous data refusal, parallel append ordering, hash-chain self-check, worker restart, and persistent SQLite recovery, all with a short-lived generated *test-only* secret.

Tests use local infrastructure, not the live Cloudflare account or Alpaca broker. They cannot establish a real exchange fill, a genuine profitable model, or a deployed production Worker.

## £0 limits and safety

At the time of this proposal, Workers Free provides around 100,000 Worker requests/day, 10ms CPU per request, and SQLite-backed Durable Objects with a 5 GB account-wide free storage allowance. Consult https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/platform/limits/ for current limits. Requests can be rejected when quotas are exceeded. Keep workloads low and avoid continuous polling: the Worker is a **lightweight journal**, not a long-running Python training/inference process.

There is no Cloudflare account connection exposed in the ChatGPT plugin directory, so I cannot open your dashboard, change its plan, deploy the service or privately input your API token for you. The manual GitHub Action is prepared for those steps after the owner supplies secrets.

**No automatic PAPER trading.** To enable future paper execution, a *separate* reviewed design must provide deterministic inference, verified broker data and fees, authorisation, atomic intent-before-POST, account identity, risk caps, unambiguous reconciliation and no second trading writer. In particular, moving the research journal alone does not establish those guarantees.

## Existing Railway safety

Railway's October 2026 security disclosure requires rotating third-party credentials previously held there, including Alpaca PAPER secrets, *before* they are used anywhere again. Do **not** transplant old Railway secrets to Cloudflare. Existing Railway Teacher services and their persistent journal are not migrated or modified by this PR.

## Rollback

Manually disable the Cloudflare Worker from the Cloudflare dashboard or delete its SCALP_CF_AUDIT_TOKEN secret to block private uploads immediately. Keep the GitHub research models untouched. Removing or renaming the Durable Object class can destroy or detach its data; do not change the SQLite namespace identifiers lightly.
