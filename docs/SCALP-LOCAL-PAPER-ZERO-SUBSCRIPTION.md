# Raspberry Pi / spare Linux PC — Scalp City PAPER host, no new hosting subscription

**Default: OFF.** This is an alternative to blocked Railway OAuth and billable
Render private volumes. It preserves the existing *Python* frozen-model inference
and persistent `PaperIntentJournal`, rather than porting the DQN to a 10ms
serverless runtime.

There is **no new hosting subscription** if a suitable machine already exists.
The computer needs electricity, existing internet access, storage and physical
maintenance, so the total cost of operating hardware is not literally zero.
If you do not own usable hardware, **do not buy anything on the strength of this
plan**; use the development-only paper mocks until a free device is available.

## Platform

- Recommended: Raspberry Pi **4 / 5, 64-bit Linux, at least 2 GB RAM**,
  preferably 4 GB; or an already-owned 64-bit Debian/Ubuntu mini-PC or laptop.
- PyTorch documents ARM64 support for the Pi 4/5:
  https://docs.pytorch.org/tutorials/intermediate/realtime_rpi.html
- Single host process, single account, one private `/data/scalp-paper` directory
  owned only by `scalpbot`, append-only fsynced journal.
- `systemd` fires the **same oneshot service** at UTC minute
  02,07,12,17,22,27,32,37,42,47,52,57, with no backfill after outages.
  **Timer is never automatically enabled by these repository files.**
- No inbound network port, no tunnel, no public web server, no new provider
  account. The existing GitHub repository stays the source of updates/research,
  and the read-only Scalp City public UI can continue to be hosted separately.

## 1. Prepare existing device (no Alpaca credentials yet)

For an already-configured Pi 4/5 running current **64-bit** Raspberry Pi OS or
a spare Ubuntu/Debian machine, install Python, `git`, and `systemd`.
Commands are illustrative and must be executed **on the user's device**;
nothing was remotely installed from ChatGPT.

```bash
uname -m                              # must show aarch64 or x86_64
sudo apt-get update
sudo apt-get install -y git python3-venv python3-pip
id -u scalpbot >/dev/null 2>&1 || sudo useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin scalpbot
sudo install -d -m 0755 /opt/scalp-city
sudo install -d -m 0700 -o scalpbot -g scalpbot /data/scalp-paper
sudo install -d -m 0700 -o root -g root /etc/scalp-city
sudo git clone --branch main https://github.com/tristanpeto123-eng/Scalp-City-Lab.git /opt/scalp-city/app
sudo python3 -m venv /opt/scalp-city/venv
sudo /opt/scalp-city/venv/bin/python -m pip install --no-cache-dir numpy 'torch>=2.3,<3'
sudo install -o root -g root -m 0600 /opt/scalp-city/app/paper_sandbox/deploy/paper.env.example /etc/scalp-city/paper.env
sudo install -o root -g root -m 0644 /opt/scalp-city/app/paper_sandbox/deploy/systemd/scalp-paper-check.service /etc/systemd/system/
sudo install -o root -g root -m 0644 /opt/scalp-city/app/paper_sandbox/deploy/systemd/scalp-paper-check.timer /etc/systemd/system/
sudo systemctl daemon-reload
systemd-analyze calendar '*-*-* *:02,07,12,17,22,27,32,37,42,47,52,57:00' --iterations=3
sudo systemctl start scalp-paper-check.service
sudo journalctl -u scalp-paper-check.service -n 15 --no-pager
sudo systemctl is-enabled scalp-paper-check.timer # expected: disabled
```

The default status must be `HOST_OFFLINE_SAFE`, `brokerRequests: 0`,
`paperOrdersSubmitted: 0`, `liveOrders: 0`. Any other outcome is a blocker.
**Don't enable the timer yet.**

## 2. Read-only paper account preflight (only after rotating keys)

Railway disclosed a 2026 security incident involving secrets. Rotate the
**Alpaca PAPER-only** key and secret through Alpaca's own portal and check
account order history. NEVER paste keys or account UUIDs into chats/GitHub,
print them to logs or store them in the repository.

Privately edit `/etc/scalp-city/paper.env` using `sudoedit`; the file is
root-only mode 0600. The values below are **placeholders**, not configured.

```text
SCALP_LOCAL_MODE=PREFLIGHT
SCALP_SHARED_ACCOUNT_JOURNAL_DIR=/data/scalp-paper
SCALP_DEMO_PAPER_KEY=SET_PRIVATELY_NOT_HERE
SCALP_DEMO_PAPER_SECRET=SET_PRIVATELY_NOT_HERE
SCALP_DEMO_PAPER_ACCOUNT_ID=PIN_EXACT_PAPER_ACCOUNT_UUID_PRIVATELY
SCALP_DEMO_SYMBOL=LTC/USD
```

Then run `sudo systemctl start scalp-paper-check.service` and inspect only
the sanitized fingerprint, order count and positions. The backend pins Alpaca
to `https://paper-api.alpaca.markets` and uses **GET** only in this mode.
No account ID, keys or raw positions are printed.

A shared Teacher account requires the previous Teacher trading writer to be
**independently disabled**. `SCALP_SHARED_TEACHER_WRITES_OFF=YES` alone is
merely a declaration, **not** evidence of exclusive ownership. If Railway is
not accessible, leave the owner-writing PAPER mode **OFF**.

## 3. Frozen research-model plan (no orders)

Use the `paper-sandbox-models` branch to place the exact frozen model and
manifest in a **private** read-only `/opt/scalp-city/models` directory.
Verify the checkpoint's file SHA against the manifest and the previously
independently verified research report.

The candidate currently archived is:

- Symbol: `LTC/USD`
- Model SHA256: `ca1767977d37399136189bd9e0ec6c09440ca8d4098869d186898f6a8d479db1`
- **Ungraded, not demonstrated profitable**, negative historical stress result.
  It is suitable only as an experimental model.
- The exact files: `frozen/LTC-USD-<SHA>.pt` and `.json`.

Set `SCALP_LOCAL_MODE=PLAN` plus
`SCALP_DEMO_MODEL_SHA256`, `SCALP_LOCAL_MODEL_FILE`, and
`SCALP_LOCAL_MODEL_MANIFEST` in the private config file and run the oneshot
unit. This loads the locked checkpoint, verifies its byte hash and account
identity, checks genuine completed 5m broker data, and **never** issues an
Alpaca POST.

When and only when read-only preflight and model planning work, the timer can
be manually enabled with `sudo systemctl enable --now scalp-paper-check.timer`.
It still uses PLAN and makes **no orders** until separately approved.

## 4. Future PAPER mode — NOT APPROVED OR ENABLED

Before ever setting `SCALP_LOCAL_MODE=PAPER`, commission a separate exact
release:
1. Confirm the Pi is the **only** account-order writer; shut down/verify the
   existing Railway Teacher broker writer and any other external bots.
2. Test the actual broker-history attribution, order statuses, fee activity,
   order quantity and pinned account ID; no unexplained Teacher/manual trades
   in the chosen asset and no positions that cannot be reconciled.
3. Check the local journal is protected, empty or fully reconciled, and stays
   durable after power cycles. No `/tmp` or ephemeral GitHub runner may be used.
4. The owner must explicitly authorise the exact frozen-model SHA,
   account and release. The `SCALP_LOCAL_HOST_OWNER_RELEASE` and existing
   `SCALP_SHARED_PAPER_APPROVED`, `SCALP_DEMO_PAPER_ENABLED` and
   `SCALP_SHARED_ACCOUNT_MODE` gates are **unset by default**.
5. Read all failsafes in
   [SHARED-PAPER-SINGLE-WRITER-V02.md](SHARED-PAPER-SINGLE-WRITER-V02.md).
   A lost POST acknowledgement leaves a durable unresolved intent and
   **blocks autonomous re-submissions** pending broker reconciliation.
6. The model has no independent positive return track record. No profitability
   or Teacher grades should be asserted just because PAPER tests run.

Avoid always-on unattended trading until controlled PAPER test evidence proves
the host's safety. If electricity, internet, Pi storage or Alpaca connectivity
fails, missed cycles are **skipped**; the timer does not backfill trades.

## Why not just use free GitHub Actions for every trade?

GitHub's August 2026 additional product terms restrict hosted Actions to
software-production/testing/deployment/publication and discourage using Actions
as a serverless application. GitHub schedule events can also be delayed or
dropped and its VMs lose their local state. Use Actions for **CI and mock
simulation**, not as Scalp City's unattended hosted broker worker.

See https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
and https://docs.github.com/en/actions/how-tos/troubleshoot-workflows.

## If you do not already have suitable hardware

The true zero-purchase fallback is **Cloudflare Workers Free with one
SQLite-backed Durable Object**, which provides persistent write-ahead
transactions and single-object serialisation, but would require porting the
PyTorch model to compact tested JS inference and setting up a new account.
The free limit is 10ms of Worker CPU per invocation and 5GB of Durable Object
SQL storage per account; the service must fail closed on quota/CPU faults.
It is a **separate engineering implementation**, not something running today.
Cloudflare confirms no credit card is required to start:
https://www.cloudflare.com/products/durable-objects/
