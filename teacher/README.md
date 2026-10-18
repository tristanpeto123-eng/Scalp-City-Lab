# Robot Academy Teacher v0.2 — audited PAPER examinations
**Release candidate:** ACADEMY-TEACHER-0.2.0-rc1
**State (18 Oct 2026):** merged to main; two Railway services and a public pinned-key HTTPS status gateway deployed and independently checked. Actual Alpaca PAPER examinations are NOT enabled: zero admitted pupils, zero Teacher orders, zero verified grades. See `teacher/CONNECTION.md` for verified commissioning evidence.
**Order endpoint:** \`https://paper-api.alpaca.markets/v2/orders\` only. No live trade, deposits or withdrawals.

## What was actually built
| Stage | File | Current coverage |
|---|---|---|
| Research provenance / sealed out-of-sample test | auditor.mjs | Reconstruct exact training fingerprint from independently archived history and 15-minute Alpaca bars, evaluate strictly later bars with next-open execution and 2x cost |
| Operator-controlled enrollment | admit.mjs / admission-seal.mjs | Immutable model hash, historical profitability & risk gates, signed admission; separate *explicit exact release* gate for paper execution |
| Paper-only strategy examiner | engine.mjs / alpaca-crypto.mjs | 10 crypto pairs, frozen per-chart strategy, 15-minute *completed* bar, IOC-only paper orders, fail closed on ambiguous order/position |
| Pupil exposure budget | risk-ledger.mjs / runtime.mjs | $50 research/paper risk ledger, max $25 per order, 1% daily stop and 10% peak drawdown latch, persist sampled virtual marks in private hash journal |
| Broker evidence collector | evidence.mjs | Match broker orders against individual FILL activities, detect partial fills, deduplicate broker IDs, collapse all partials into a single independent round trip, account for coin CFEE versus USD FEE without double counting |
| External GBP reference | fx-reference.mjs | Fetch dated GBP-per-USD daily ECB reference rates via Frankfurter read-only API; refuse stale/missing data |
| Independent grading | grade-pipeline.mjs | Count 30+ paper closed round trips, finalized fees, actual net GBP, marked and realized drawdown; sign sanitized result with Ed25519 |
| Publisher / Academy UI | grade-service.mjs / robot-academy.html / public-settings.json | Local read-only signed public feed; browser must import *pinned* Ed25519 public key and verify payload signature before changing a pupil's official grade |
| Checker | teacher-tests.mjs / teacher-v2-tests.mjs | Mock-only structural, contamination, accounting, crypto fee, duplicated-fill, $50 budget, 30-roundtrip and signed-evidence regression checks |

## Mandatory gates and settings
1. **G0 — Research admission:** Reconcile trusted \`scalp-learning-memory\` branch JSON to current saved Academy leader and a snapshot containing the **same training fingerprint**. Unseen historical holdout must have 30+ closes, positive net GBP, positive at 2x costs, and <=8% drawdown. *This is not forward evidence*. At this time all ten published research leaders are loss-making, so no one qualifies.
2. **G1 — Independent model enrollment:** Run \`node teacher/admit.mjs\` on a controlled host with a private copy of research memory and original snapshots. Default is report-only. Explicitly issuing admissions additionally requires \`TEACHER_ISSUE_ADMISSIONS=true\`, the private signing secret \`TEACHER_ADMISSION_SIGNING_SECRET\` (48+ chars), and review of the records in \`TEACHER_PRIVATE_DIR/admissions.json\`. **Never commit admissions or secrets.**
3. **G2 — Genuine broker paper execution:** Provide separate Alpaca PAPER-account key pair per admitted pupil to \`TEACHER_PAPER_CREDENTIALS_JSON\`, with credentials stored as server-side secrets. \`TEACHER_PRIVATE_DIR\` must be an absolute private durable path. \`node teacher/runtime.mjs\` is dry-run until the user explicitly approves **ACADEMY-TEACHER-0.2.0-rc1** and the operator *deliberately* sets **both** \`TEACHER_RELEASE_APPROVED=ACADEMY-TEACHER-0.2.0-rc1\` and \`TEACHER_PAPER_ENABLED=true\`. This release approval does not authorize live money. Requires a private supervised always-on Node 22+ host, not GitHub Actions or GitHub Pages.
4. **G3 — Reconciled 30+ forwards:** At least 30 distinct closed round trips **after** admission, no external positions, fills and aggregate orders agree, crypto fee activities posted, no outstanding orders, final paper flat inventory, risk journal covers first opening to last close, daily independently sourced GBP rates available. **Grade 0–10** is determined by real paper win rate in 10% bands. A pupil qualifies for further graduation review only with positive actual net GBP and <=10% independently recorded peak drawdown. Any ambiguity displays \`EVIDENCE_PENDING\`, not a grade.
5. **G4 — Signed Academy publication:** Provision an Ed25519 signing key privately via \`TEACHER_PUBLISH_PRIVATE_KEY_PEM\`; set its matching *public* SPKI bytes (base64) and a real HTTPS feed URL in repository \`teacher/public-settings.json\`, status \`CONFIGURED\`, **only after deployment approval**. Run \`node teacher/grade-service.mjs\` separately behind an authenticated/supervised HTTPS reverse proxy. The public endpoint is GET-only \`/api/academy\`, with CORS limited to this project's Pages origin; reporter writes only sanitized, signed \`public-exam-report.json\` to a private folder. Browser rejects unsigned, tampered or >36h stale grade feeds and falls back to provisional research; self-asserted JSON previews cannot change verified grades.

## Critical validation still required before real paper deployment
- Read-only paper account and venue preflight during fresh trading (data freshness, precision, asset eligibility, funding, cancellation, uptime). The previous connection proves only BTC/ETH crypto *read-only* eligibility, not the Teacher executor. One existing paper account was verified; ten separate test accounts were not.
- Exercise actual Alpaca **FILL/CFEE/FEE** field shapes and timing. Alpaca says CFEE can post at day end, not always with an order ID. This implementation fails closed when cost/date assignment is ambiguous; even 48 hours elapsed plus observed fee activity is an **operational settlement policy**, not a contractual guarantee of fee finality. Fee corrections require grade invalidation/republication with an audit trail.
- Test sudden network loss between pre-order INTENT, POST, ACK and fill, IOC partials, asset-minimum-size rounding, coin-fee position mismatches, midnight, and manual emergency cancellation.
- Independent risk review must inspect the $50 virtual mark: default Alpaca demo account equity may be much larger and cannot be used as the pupil's risk baseline.
- Deploy HTTPS feed and pin the *real* publisher public key before the static Academy can show grades. No keys are bundled in this PR.

## Local tests (safe; no credentials or broker network)
\`node --test teacher/teacher-tests.mjs teacher/teacher-v2-tests.mjs\`
\`node --test robot-academy-tests.mjs\`

The GitHub Actions Teacher Checker workflow runs syntax and these mock tests only. **A passing CI job proves code-level mock behavior, not genuine forward profitability, broker compatibility, or readiness for real-money orders.**

## Risk/governance
Historical parent training and historical audit are separate from **forward broker fill evidence**. A 100% observed win rate with negative net profit is not profitable qualification. No automated decision can grant real-money execution, unfreeze a model mid-exam, or bypass an explicitly withheld owner release. Broker failures stop the service; emergency stops are not guaranteed to cancel accepted orders or close holdings.

**Known blockers today:** zero eligible historical champions, zero Teacher forward orders, zero verified grades, no PAPER keys in private Railway examiner, no independent per-pupil broker preflight. Persistent hosting and pinned HTTPS gateway are now commissioned; absent trade evidence correctly returns 503.

## Integrated Teacher UI (connection update)
The review branch now includes \`teacher-console.html\`, with navigation from:
- \`robot-academy.html\` (dedicated Teacher's Office links)
- \`agent-city.html\` (Teacher link)
- \`trading-floor.html\` (Teacher link)
- \`index.html\` (main Scalp City entry)

The console fetches the real, versioned historical training record at \`research-data/robot-academy.json\`, plus the same **signed and pinned** forward-paper feed contract the Academy consumes. Verified records override research grades only after a valid Ed25519 signature and sound arithmetic; broker-reconciled provisional paper closes may be shown as exam progress but never as a confirmed grade. Outages, an unprovisioned publisher, stale or mismatched keys show **NOT CONNECTED** and cannot create grades. A 30-close visual demonstration is explicitly MOCK and isolated from the verified results state.

### Read-only live broker connectivity probe
With **PAPER** Alpaca credentials provided securely via a private host environment (never in GitHub or browser):

\`\`\`bash
TEACHER_PAPER_CREDENTIALS_JSON='{"BTC/USD":{"key":"YOUR_PAPER_KEY","secret":"YOUR_PAPER_SECRET"}}' \
  TEACHER_PREFLIGHT_SYMBOLS=BTC/USD \
  node teacher/paper-preflight.mjs
\`\`\`

It sends **GET only** requests for account, asset, positions and open orders; validates paper-only identity and crypto access; reports whether the account is suitable for a later separately approved paper trial. This script does **not** submit, cancel or amend orders. Using one paper credential cannot operate the current ten-pupil segregated design: every admitted pupil needs a distinct account. One existing GitHub Actions PAPER credential pair was successfully read-only preflighted for BTC/USD on 18 October 2026 (run 39132172472), but **these keys are not provisioned on Railway** and do not establish ten independent accounts. No order was sent.

The private always-on Railway host and HTTPS gateway are now deployed using `teacher/commission-server.mjs`. The gateway and private signer passed the real public HTTPS acceptance run 39132293037. The real exam cycle (`teacher/runtime.mjs`) remains disabled until per-pupil PAPER secrets, signed historical admissions and operator-controlled paper-risk acceptance are complete. GitHub Pages hosts the UI only and has no broker secrets.
