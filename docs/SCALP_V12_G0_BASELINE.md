# Scalp City v1.2 — G0 Baseline and Recovery Audit

Status: **IN PROGRESS — NOT PASSED**
Date: 2026-10-25 (UTC)
Change type: Documentation only; no deployment, broker permission, or automated promotion.

## Approval boundary
The owner approved the **deployment and verification plan**, starting with the read-only baseline audit and vertical-slice implementation contract. This is **not** approval to merge, delete/replace existing code, enable any paper broker order, trade real capital, or graduate a student.

## Immutable starting references
| Asset | Reference | Status |
|---|---|---|
| Lab target | tristanpeto123-eng/Scalp-City-Lab at 70550c06b16291b860f9be84bae03b0dbe5fa790 | Pinned as branch base |
| Stable legacy | tristanpeto123-eng/Scalp-City-1 at 3b246ebec0458734509135a5317e2af011d45408 | Preserve; do not modify |
| Lab working branch | architecture-v1.2-g0-skill-matrix | Documentation and subsequent isolated work only |
| Agentic-Trading | tristanpeto123-eng/Agentic-Trading | Independent; not part of automatic migration |
| The-Foundry | tristanpeto123-eng/The-Foundry | Standalone 3D prototype, not live telemetry |

GitHub branches are references, **not** verified off-device backups of private student weights. The Lab and stable repositories are public.

## Observed evidence
- The Lab default branch was inspected at the exact commit above; its tree listed 324 paths.
- GitHub Pages build/deployment succeeded for Lab commit 70550c06b (run 40227326724).
- Student Observatory, Deep RL and research workflows have other successful runs; do not count them as green checks on the pinned baseline unless their exact head SHA matches.
- More recent successful Price Level, Opportunity Discovery and Teacher workflows shown on 2026-10-25 used commit 62dd25c5bb17..., **not the pinned main commit**. They are useful evidence of a separate revision, not of this baseline.
- Source documents report browser-local SL checkpoints, separate branches holding RL/pupil memories, zero verified forward grades, and no authorised live broker path. Do not infer current remote data completeness from these descriptions.
- Direct repository cloning was unavailable from this runtime (network DNS). No complete independent source or model backup was created during the audit.

## G0 Checker acceptance register
| ID | Assertion | Current finding |
|---|---|---|
| G0-01 | Pinned Lab and stable commit SHAs recorded | OBSERVED |
| G0-02 | Branch isolated from stable and starts at pinned Lab SHA | PASS — readback and CI branch-diff gate |
| G0-03 | Full source and external model/journal inventory | PARTIAL — six memory/data branch refs identified; local browser and private memory not inventoried |
| G0-04 | Source repository backup created and checksum verified | PARTIAL — pinned Git source restored and SHA-compared in CI; NO independent durable/offsite backup verified |
| G0-05 | Private model and training-memory backups verified by restore | OPEN |
| G0-06 | Relevant CI suites green on exact pinned SHA | PASS for unchanged functional code on branch HEAD 77558d8352ba6b983bf412d9b6473b9316833adf; source-diff gate verifies all changes from pinned baseline are documentation + G0 workflow |
| G0-07 | Student views, CSV import and model persistence browser smoke tested | OPEN |
| G0-08 | No broker order or promotion permission changed | OBSERVED from documentation-only actions; recheck on release |
| G0-09 | Tested rollback procedure with recoverable prior version | PARTIAL — immutable source recovery in clean scratch passed; persistent service, model and deployment rollbacks untested |
| G0-10 | Checker signs off G0 after source and backups reconciled | BLOCKED |

**G0 overall result: BLOCKED / NOT PASSED.** Private student/model backup and restore, offsite source backup, browser checks and deployment rollback are outstanding. A build badge alone is insufficient.

## Preservation / rollback rules
1. Keep the stable repository and its current model data untouched.
2. Do not write private checkpoints or API credentials to public repositories.
3. Commit new work only to the isolated implementation branch, in versioned steps.
4. Require regression CI and Checker G1 before any requested pull-request merge.
5. Before infrastructure changes, take encrypted private backups and verify restoring them to an isolated location.
6. If a test fails, halt promotion and revert the candidate branch or release; never overwrite evidence.

## Evidence sources
- Lab source: https://github.com/tristanpeto123-eng/Scalp-City-Lab
- Pinned Lab commit: https://github.com/tristanpeto123-eng/Scalp-City-Lab/commit/70550c06b16291b860f9be84bae03b0dbe5fa790
- Stable commit: https://github.com/tristanpeto123-eng/Scalp-City-1/commit/3b246ebec0458734509135a5317e2af011d45408
- Pages baseline run: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/40227326724
- Different-revision Price Level checker: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/40230058419

Prepared for the owner and Checker review. **No claim of completed G0 or profitable trading.**


## G0 execution addendum — 25 October 2026
- GitHub Actions run: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/40231754227
- Exact workflow SHA: `77558d8352ba6b983bf412d9b6473b9316833adf`
- Job `source-restore`: PASS. Full pinned git tree was extracted to a clean scratch directory; README.md, app.js, sl-core.mjs and academy-common-exam.mjs were compared byte-for-byte with immutable source commit. The workflow's allowed-path diff verifies this branch has changed **only** audit docs and the read-only workflow.
- Job `offline-regression`: PASS. SL core/5m/loop/vault/cache, Academy/common exam, XAUUSD discovery/Teacher, student progress and paper-broker **mock** safety tests completed. These tests do not establish market profitability or real broker order safety.
- Separate bootstrap job on same commit: https://github.com/tristanpeto123-eng/Scalp-City-Lab/actions/runs/40231757958 (PASS).
- GitHub branch metadata confirmed existing `scalp-learning-memory`, `rl-learning-memory`, `neo-learning-memory`, `rl-5m-data`, `paper-sandbox-models`, and `universal-student-memory`. Heads observed at audit time, respectively: `2ee3a532a02f10000ca90432a3a895e0dde6fd5f`, `9b00c1c17fadda0b537c454830f77c18b5a716b9`, `9c0d8b3d474f2d11b688adb0552bc63b47fb2b37`, `88f45a981840215bb8754e0fa711a19f72289b0c`, `152bcb3e36e6c9104b38de7c8a613201d0f0d7d3`, and `a4771ba474b5b7136078c1c28e6835c182f5a7bb`. These are **reference pointers, not authenticated backups**, and can move with scheduled training jobs. The repository is PUBLIC, including its branches; review confidentiality before placing learned model data there.
- Separately, SL checkpoints may exist only in the user's browser local storage. Neither GitHub nor this audit has recovered them. Their export, secure backup and isolated restore must be operator verified.
- The audit accessed metadata, test logs and already-public source only, **not private credentials or user-local model checkpoints**.
