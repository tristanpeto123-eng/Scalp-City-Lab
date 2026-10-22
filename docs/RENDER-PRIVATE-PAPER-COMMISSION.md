# Render deployment: Scalp City PAPER read-only commissioning

**State: review-only.** This Blueprint defines a **paid** Render private service and its **paid persistent disk**. Merely committing a Blueprint does not create or bill for anything. Only the account owner should explicitly review costs and click **Deploy Blueprint** in Render.

## Why this service is private and disk-backed

- Service: `scalp-paper-readonly-commissioner`
- Type `pserv`: **private internal networking**, no public `onrender.com` URL
- Docker source: `paper_sandbox/Dockerfile.commission`, **only** the read-only commissioner is copied into the image. There is **no** DQN/Torch, Alpaca order executor, or LIVE API broker endpoint inside it.
- One instance in `frankfurt` with `0.5c-512mb` compute; future paper journal stored on a separate, **1 GB persistent disk mounted at `/data`**. Do not attach an additional instance or change to an ephemeral disk.
- `autoDeployTrigger: "off"`: no automatic redeploy on branch pushes.
- `SCALP_READ_ONLY_ACCOUNT_PREFLIGHT=NO`: service does not contact Alpaca by default.
- Zero PAPER or LIVE trades, no withdrawal, no Teacher graduation, no model execution.

Render charges for the compute instance and disk. Review the **current Render checkout price**, taxes and duration before accepting. Do not select a plan or confirm a charge simply because this source file is approved.

## Deploy through the dashboard (required for a private service + disk)

1. Merge the prerequisites from [PR #54](https://github.com/tristanpeto123-eng/Scalp-City-Lab/pull/54) into `main`, then merge the Blueprint PR containing `render.yaml`. Confirm `main` contains `paper_sandbox/Dockerfile.commission`, `paper_sandbox/railway_commission.py`, and `render.yaml`.
2. Open [Render Dashboard → Blueprints](https://dashboard.render.com/blueprints), choose **New Blueprint Instance**, connect the GitHub repository `tristanpeto123-eng/Scalp-City-Lab`, and select the intended Render workspace.
3. Render will read `render.yaml` on the selected branch. Review **exactly one service** `scalp-paper-readonly-commissioner`, `pserv`, Frankfurt, one paid compute instance, and one paid 1 GB persistent disk at `/data`. Do not add a public web service or trading worker.
4. Approve the explicit billable infrastructure in Render to deploy the read-only commissioning service.
5. Check the private-service logs for the **sanitised** startup line `SCALP_PAPER_COMMISSION` with `storageReady: true`, `paperOrdersSubmitted: 0` and `accountStatus: GET_ONLY_PREFLIGHT_NOT_REQUESTED`. No broker secrets or raw account UUIDs should appear in logs.
6. Reboot/redeploy the service and confirm the storage canary remains valid; by design, `/data/scalp-paper/read-only-host-ready` is mode 0600 in a mode-0700 directory. A GitHub Docker CI cold-start/restart test covers this exact behaviour independently.

## Reuse the existing Alpaca PAPER account safely

Railway's October 2026 security disclosure means **assume old Railway stored API keys and signing secrets require rotation**. Regenerate the Alpaca PAPER API key/secret in Alpaca, revoke the old pair, review broker activity, and **never paste keys, secret JSON, or account IDs into GitHub or this chat**. Render needs new secrets entered via its encrypted service environment variables.

The read-only commissioning service supports three permitted Alpaca PAPER GET requests only:
`/v2/account`, `/v2/orders?status=all&limit=500` and `/v2/positions`.

Set the following values on the Render private service **only when ready to commission**, and restart it after the changes:

| Render variable | Meaning |
|---|---|
| `SCALP_EXISTING_TEACHER_PAPER_CREDENTIALS_JSON` | JSON object mapping a symbol, e.g. `"LTC/USD"`, to a rotated `{"key":"…","secret":"…"}` PAPER credential pair. Enter in Render's secret editor; **never source it from old Railway automatically** |
| `SCALP_EXISTING_TEACHER_SOURCE_SYMBOL` | Symbol key in that map, such as `LTC/USD`; must reflect the **actual existing** account's symbol mapping |
| `SCALP_DEMO_PAPER_ACCOUNT_ID` | Exact Alpaca PAPER account UUID obtained directly from the secure Alpaca console; not inferred from a fingerprint |
| `SCALP_READ_ONLY_ACCOUNT_PREFLIGHT` | Set to `YES` to permit **GET-only** read-only startup verification; leave `NO` until the preceding requirements hold |

A successful preflight reports `PAPER_READ_ONLY_ACCOUNT_VERIFIED` and a truncated SHA-256 account fingerprint. A mismatch reports `PAPER_ACCOUNT_OBSERVED_AWAITING_ID_PIN`; this is **not** approval to trade. Unknown order history, insufficient account status and incomplete data block readiness.

## What this does NOT complete

The existing Railway Teacher process remains unchanged. **Do not operate an old Teacher broker writer and a new pupil broker writer concurrently on the same account.** Before any paper-order POST:

- Verify independently that the Railway Teacher writer is disabled, rather than trusting a self-declared flag.
- Establish a single private, persistent **order-writing** host separate from this **read-only** commissioner, with the hash-chained model-intent journal and one active process/volume.
- Match account ID and previous order/position/fee ownership; reject ambiguous fills. Keep the exact pinned, **historically loss-making and ungraded**, frozen LTC/USD model separately.
- Review the account, fixed candidate SHA, and the exact owner-approved PAPER-only release; then explicitly enable the small simulated-money gates in the correct order-writing deployment only.
- Until genuine independently reconciled paper fills, fees and drawdowns exist, **Teacher graduation remains at zero**.

The Render app currently available in ChatGPT exposes **public web-service** creation, not private-service/disk Blueprint provisioning. Accordingly the dashboard step and cost approval must be performed by the user; the source PR can be built and tested without charging anything.

## Source checks

The companion GitHub Checker ensures the Blueprint remains one private instance, uses the exact Dockerfile, keeps autodeploy off, attaches one durable `/data` disk, and supplies **no secrets or trading activation env vars**. It builds the actual Docker image, runs it, and verifies healthy read-only cold start and canary survival after restart with zero broker POSTs.
