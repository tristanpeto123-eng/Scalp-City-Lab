# Shared Alpaca PAPER — durable single writer + independent Teacher observer

**Release:** SCALP-SHARED-PAPER-PILOT-v0.2, review candidate only.
**Owner scope:** use an *existing* linked Alpaca PAPER account for Scalp City's
pupil demo execution and independent Teacher assessment. Do not create new
accounts, touch real money, or switch on GitHub Actions order submissions.

## Execution architecture

One account has pooled USD/crypto inventory, so two independent order writers
would race. Client order ID namespaces alone do **not** isolate balances, fees,
buying power, cancelled fills or crypto holdings.

1. A **single private Linux host with persistent /data volume** is the only
   potential order executor. `paper_sandbox/shared_runtime.py` rejects
   ephemeral GitHub Actions, ensures the expected PAPER account UUID matches
   the actual broker response, verifies all existing demo order identities
   against the private journal and rejects unrelated positions/pending orders.
2. An exclusive `fcntl.flock` serialises the entire preflight -> model
   decision -> paper POST transaction on that host. This is a *single-host
   filesystem lock*, **not** a distributed lease. Deploying multiple Railway
   replicas or another GitHub order writer remains forbidden.
3. The private mode uses a SHA256 hash-chained, append-only JSONL ledger.
   A model SHA256, source completed-bar timestamp, side, symbol, verified
   account fingerprint, exact client ID and ten-dollar cap are fsynced as
   `INTENT` **before** POST. A confirmed paper-broker order ID is fsynced as
   `ACK`. After ambiguous network responses, unmatched intents permanently
   prevent new autonomous submissions until independent broker reconciliation.
   No retry or silent deletion. The ledger is private; no API secrets or raw
   account UUIDs are written to it.
4. The Teacher has a **pure-read-only Node verifier**
   `teacher/shared-paper-journal.mjs` which independently verifies the Python
   JSONL hash chain, per-intent account/model signatures (content integrity,
   not asymmetric signatures), broker order IDs, duplicate/missing fills,
   external orders and cross-strategy positions via
   `teacher/shared-paper-observer.mjs`.
   That adapter cannot contact Alpaca, alter funds, sign grades or award
   qualification. Teacher currently observes *pilot activity*, not its own
   paper trading strategy's independent credentials.
5. The existing scheduled GitHub Actions pilot has been restricted to
   **read-only preflight and model planning**. All scheduled work is skipped;
   manual `paper` mode is unavailable. This avoids an accidental independent
   second writer or a restart that loses its local intent records.
   Even the old `paper_sandbox.paper_executor --mode paper` fails closed
   on GitHub Actions or an unjournaled production CLI.

## Explicit private-host execution gates (NOT configured or enabled)

Only after creating **one** dedicated single-instance service/runner sharing
private credentials on a durable `/data/` volume, and getting fresh broker
preflight evidence, can the operator consider exact-release approval.
This does not authorize startup by publishing this PR.

- `SCALP_DEMO_PAPER_KEY`, `SCALP_DEMO_PAPER_SECRET`,
  `SCALP_DEMO_PAPER_ACCOUNT_ID` — PAPER secrets and expected UUID, not
  real/live credentials; value never copied into GitHub source or chat.
- `SCALP_DEMO_SYMBOL`, `SCALP_DEMO_MODEL_SHA256` — one existing exact
  immutable frozen model only; model must be stored privately, not retrained
  or substituted during the paper session.
- `SCALP_SHARED_ACCOUNT_JOURNAL_DIR=/data/<PRIVATE_FOLDER>` —
  private persistent path, one trusted Linux host, mode 0700; no network
  multi-writer filesystem until separately reviewed.
- `SCALP_SHARED_ACCOUNT_MODE=SINGLE_WRITER_TEACHER_READ_ONLY`
- `SCALP_SHARED_TEACHER_WRITES_OFF=YES` — declaration only; the operator
  MUST independently verify that the Railway Teacher runtime's separate
  trading process is truly OFF. This flag is not itself strong proof.
- `SCALP_SHARED_PAPER_APPROVED=EXACT_SHARED_PAPER_PILOT_V1`
- `SCALP_DEMO_PAPER_ENABLED=YES_DEMO_ONLY`

Because these flags are not enabled and no valid frozen candidate has been
installed into a trusted private runner, this PR submits **zero** real Alpaca
PAPER orders. A development merge does not constitute broker activation.

## Verification and next commissioning gates

The GitHub CI runs actual Python ledger/lock/crash tests, mocked paper brokerage
requests, and JavaScript that verifies a **real Python-created** journal on
Teacher's side. These are not actual broker executions.

Before an actual order:
- Confirm GitHub and Railway configured paper credentials really reference
  the **same** broker account UUID using GET-only paper account preflights.
  The repo connector can see only secret **names**; values remain private.
- Confirm no second executor is armed, account history is complete, no
  foreign/manual orders or positions and no same-symbol Teacher inventory.
- Review the new frozen model SHA and small-dollar risk budgets. No model has
  demonstrated independently positive PAPER returns yet.
- Run dry-run `python -m paper_sandbox.shared_runtime --mode preflight` and
  `--mode plan --model <FROZEN_PRIVATE_CHECKPOINT>` on the eventual host.
- Only after a separate approved, controlled release, evaluate starting a
  single paper-mode session on that same volume. Teacher independently
  observes broker FILL activities, pending orders, fees and risk marks.
- **Official Teacher grading remains blocked**: 30+ settled forward round
  trips, CFEE and fee attribution across account use, immutable source
  model admission, independently audited mark-to-market and GBP reference,
  and an independent Ed25519 signed report are still required.
- Must implement/validate durable operational startup, identity verification,
  health alerts and manual reconciliation for ambiguous intents before
  unattended PAPER scheduling is commissioned.

## Known conservative restrictions

For now, the shared writer refuses a paper account with any completed
Teacher order in the **same symbol**, even if the trade is closed. This avoids
ambiguous coin-fee attribution. It also refuses any unexpected position or
history inconsistent with its own private journal. Account sharing here means
one account and one writer at a time—not two simultaneous strategies consuming
shared inventory.

Local file locks cannot arbitrate writers on different hosts; before
commissioning, keep existing Teacher order execution OFF and GitHub order
execution blocked. There is no live-money endpoint, deposits or withdrawals.
