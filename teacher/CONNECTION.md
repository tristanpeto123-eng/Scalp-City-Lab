# Teacher Connection Handoff — v0.2
**Review branch** \`feat/robot-academy-teacher-v0.1\` (PR #15). **Do not interpret a mock check as a commissioned broker integration.**

## Connected NOW, without brokerage permissions
The 3D City, Research Floor, Robot Academy, Teacher Console and Trading Floor link to each other; pupil dossier links preserve the selected chart \`?pupil=BTCUSD\` etc. The Trading Floor's ten pupils are loaded from the same published \`research-data/robot-academy.json\` that the Academy reads. They are **historical research**, not approved traders.

\`teacher/public-client.mjs\` provides the read-only browser contract for actual historical research plus the independently signed Teacher grade feed. \`teacher-console.html\` and \`robot-academy.html\` retain their own equivalent cryptographic signature validation for compatibility. Neither browser UI can authenticate to the Alpaca trading API or submit orders. The former synthetic Trading Floor XAU/EUR/NAS apprentices have been replaced with the ten actual research charts. Any account simulator is separate and prominently labeled **synthetic**, never paper-executed.

The signed feed is disabled by default (\`teacher/public-settings.json\` is \`NOT_PROVISIONED\`). Therefore actual status is **not connected to a paper broker**. No pupils are qualified by the currently persisted research data. A complete signed feed cannot be fabricated as an acceptable substitute.

## Commissioning checklist — requires separately provisioned private host
1. **Independent eligible pupil**: Train and identify an actually profitable research model with 30+ training closes; run the sealed chronological independent holdout auditor (30+ closes, positive stressed return, drawdown threshold) and issue an HMAC-signed frozen admission. No current published candidate meets the screening requirements.
2. **Genuine PAPER credentials and read-only preflight**: Issue crypto-enabled credentials for a **separate Alpaca PAPER account per concurrently admitted pupil**; store secrets in a server secret manager, never GitHub, Pages, HTML or browser storage. Run \`node teacher/paper-preflight.mjs\` with \`TEACHER_PAPER_CREDENTIALS_JSON\` on that server. Check distinct account IDs, asset permission, balances, open positions/orders and crypto precision using GET requests only.
3. **Persistent controlled execution**: Use a long-lived supervised Node 22+ host with durable private filesystem \`TEACHER_PRIVATE_DIR\` and an intentional kill switch. \`node teacher/runtime.mjs\` defaults to DRY_RUN. Its separate explicit paper-order arm requires \`TEACHER_PAPER_ENABLED=true\` **and** \`TEACHER_RELEASE_APPROVED=ACADEMY-TEACHER-0.2.0-rc1\` after the owner approves that exact version and Checker signs off on a real paper-account preflight. Paper orders are never the same as live-money approval.
4. **Publisher keys**: On the private host generate a unique Ed25519 signer key pair. \`TEACHER_PUBLISH_PRIVATE_KEY_PEM\` is the private key exclusively in the examiner process. \`TEACHER_PUBLISH_PUBLIC_KEY_PEM\` belongs in the separate READ-ONLY service. The public key's SPKI DER base64 representation must be pinned as \`teacher/public-settings.json.signingPublicKeyBase64\`. Never commit the private key.
5. **Read-only public HTTPS feed**: Supervise \`node teacher/grade-service.mjs\` with a private durable dir containing \`public-exam-report.json\`. The default service binds only to localhost:8790; put it behind a reverse proxy with TLS at \`GET /api/academy\`. It itself verifies the publisher signature, rejects stale and forged reports and does NOT possess broker keys. Only after you have a real reachable feed and approved pinned public key, change \`teacher/public-settings.json\` to \`status=CONFIGURED\` with the exact \`feedUrl\` and correct public SPKI bytes.
6. **End-to-end real paper acceptance test**: Run a **small, real PAPER-only** executed and reconciled round trip after all approved gates. Reconcile broker FILL rows, partial fills, fee units/date, holdings, and GBP reference; confirm first-to-last mark-to-market journal history. Check restarts/network exceptions and unknown manual orders. Follow with at least 30 independently settled and verified closed round trips before a grade can be published.

## How to test today's connected code (without secrets or orders)
\`\`\`sh
node --test robot-academy-tests.mjs
node --test teacher/teacher-tests.mjs teacher/teacher-v2-tests.mjs teacher/teacher-console-tests.mjs teacher/public-client-tests.mjs teacher/grade-service-tests.mjs
\`\`\`
GitHub Actions workflows run those tests on the draft PR. The tests use fake research-paper records and temporary HTTP localhost endpoints, never external broker trading credentials. The mocked 30-trade fixture proves grade calculation, not a real pupil's win rate or profitability.

## Hard limitations
GitHub Pages is a static site; it cannot securely keep private Alpaca credentials, sign reports, run forward trades or persist the examiner journal. Current approval permits this code to be built and reviewed on a branch, **not** to merge/deploy it or place paper orders. Never route real money through the demo Trading Floor.

If no eligible pupils or no valid public signed evidence exist, show \`NOT ADMITTED\` / \`NOT CONNECTED\` and keep verified forward grades at zero. This is the expected safe state today.
