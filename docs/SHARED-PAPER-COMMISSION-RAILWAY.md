# Scalp City shared PAPER commissioning — private host handoff

**Stage:** read-only Railway commissioning image validated on CI. **No demo
orders or live orders are authorised by this deployment.** The hosted Python
image contains only `railway_commission.py` and `__init__.py`, not the
PyTorch model or paper order-execution modules.

## Fixed project and safety boundaries

- Repo: `tristanpeto123-eng/Scalp-City-Lab`; source branch `main`.
- Existing Railway project: **Scalp City Teacher Paper Exams**.
- Create a **new service** named `scalp-paper-readonly-commissioner`.
  **Do not change the two existing services** `teacher-private-examiner`
  or `teacher-signed-gateway`.
- Builder: Dockerfile at `paper_sandbox/Dockerfile.commission`.
- One replica, one private persistent volume mounted at `/data`.
- No public domain. Do not expose a direct Alpaca credential endpoint.
- Container runs `python -m paper_sandbox.railway_commission`, which
  serves a GET-only `/health` endpoint and can run three GET-only Alpaca
  PAPER requests on startup when explicitly commissioned.
- Do not configure any PAPER POST, LIVE, cron, scheduled model trading, or
  money-transfer job; commissioning cannot submit orders.

## Configuration stages

### A. Platform and volume verification (no brokerage access)

Create the separate service from `main` and configure its custom Dockerfile.
Attach a persistent volume at `/data` before deployment. Set:
`SCALP_READ_ONLY_ACCOUNT_PREFLIGHT=NO`.

A healthy deployment should return the sanitized `GET /health` report
(`storageReady: true`, `writerEnabled: false`,
`mode: READ_ONLY_COMMISSIONING`, `paperOrdersSubmitted: 0`).
Because the commission service does not install the trading Python modules,
a configuration error cannot suddenly place an order.

### B. Reuse the existing connected Alpaca PAPER account without duplicating secrets

In the **new service only**, use a private Railway reference variable named
`SCALP_EXISTING_TEACHER_PAPER_CREDENTIALS_JSON` that resolves to the
existing `teacher-private-examiner` service's sealed
`TEACHER_PAPER_CREDENTIALS_JSON`. For example, the Railway variable
reference syntax is:

```text
${{teacher-private-examiner.TEACHER_PAPER_CREDENTIALS_JSON}}
```

Railway must confirm the reference is permitted and resolves securely; the
assistant cannot read or transplant the existing sealed secret. No credentials
may be stored in GitHub files, browser storage, logs or chat.

Map the intended source account symbol using
`SCALP_EXISTING_TEACHER_SOURCE_SYMBOL=BTC/USD`, changing only when
existing private Teacher configuration actually contains that assignment.

Enable `SCALP_READ_ONLY_ACCOUNT_PREFLIGHT=YES` to run only:
`GET https://paper-api.alpaca.markets/v2/account`,
`GET /v2/orders?status=all&limit=500`, and `GET /v2/positions`.

The safe status `PAPER_ACCOUNT_OBSERVED_AWAITING_ID_PIN` displays a truncated
SHA256 fingerprint of the broker's PAPER account UUID, **not** the UUID or
credentials. Verify the actual account identifier privately and set
`SCALP_DEMO_PAPER_ACCOUNT_ID` using the Railway private variable editor.
Only a correct exact UUID yields `PAPER_READ_ONLY_ACCOUNT_VERIFIED`.

The `readOnlyPreflight` report reports historical and open position counts.
Presence of previous Teacher trades or pooled holdings is NOT authorisation
to operate the same crypto symbol through the pupil executor. The separate
shared PAPER writer still enforces clean inventory and durable intent history.

### C. Frozen experimental pupil model

The independent `paper-sandbox-models` branch now contains an exact immutable
`LTC/USD` DQN checkpoint archive. It is not graduated, historically profitable
or automatically eligible for orders. GitHub CI verifies the archived bytes
against the model's 64-hex SHA and research-source lineage. Continuing RL
training does not overwrite it.

This commissioning container does **not** import, load or execute the
checkpoint. A later separate single-instance paper writer must use a private
copy of the exact pinned bytes, verify the SHA again, and pass the owner
release/account identity checks after a fresh read-only broker preflight.

### D. Remaining genuine execution and grading requirements

There is no running paper writer. Before paper-trading starts:
1. Verify the Railway Teacher writer is actually disabled; a variable
   declaration alone does not establish a distributed writer lease.
2. Install a *separate* secure one-replica order host with a writable
   persistent intent ledger and one authorised frozen pupil model.
3. Validate the provider's exact paper UUID, completed historical bars,
   fee/position ownership, unknown orders, duplicate-client-ID prevention,
   $5 entries and four-order UTC/day cap.
4. Run read-only/plan checks; explicitly approve the exact account,
   candidate model SHA and release version **before** enabling demo POST.
5. The independent Teacher can observe source-bound fills but cannot
   issue signed graduation until its own 30+ broker-settled independent
   round trips, fee activity and mark-to-market evidence are reconciled.

## Railway deployment blocked handling

If Railway returns **“Deploys have been paused temporarily”**, stop; do
not change the existing Teacher services or claim the host is running.
All code can remain validated and merged; creating the host and the
GET-only credential reference must resume only after the platform accepts
new service creation. Service creation is not equivalent to real account
authentication, and CI is not a live-paper broker test.

This document contains no account UUIDs, broker keys or private secrets.
