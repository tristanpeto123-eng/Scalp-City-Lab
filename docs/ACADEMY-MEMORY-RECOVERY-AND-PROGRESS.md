# Academy memory recovery + measured model progression — PR #46

## A. Restore scheduled historical lessons

Observed 20 October incident: `scalp-learning-memory:scalp-learning/history.json`
grew beyond GitHub's Contents API 1 MiB inline threshold. Contents responded
`encoding: none` with absent/empty inline bytes. The scheduled Node worker tried
to parse those bytes as JSON and failed `Unexpected end of JSON input`.

Recovery in `scripts/run-robot-training.mjs`:
1. Fetch Contents metadata with the authenticated GitHub Actions read token.
2. When and ONLY when `encoding: none`, fetch immutable
   `GET /git/blobs/<Contents-SHA>`.
3. Verify that the returned blob SHA matches source metadata, is complete
   base64 and within the 32 MiB input limit; check decoded length against metadata.
4. Parse/validate the full saved research object before evaluating any lesson.
5. Append only; persist with a Contents `PUT` that supplies the **expected previous
   SHA** to prevent silent concurrent overwrites. No PAPER/live account access.

CI includes a generated >1,048,576 byte fixture, malformed/short/wrong-SHA
blob cases, and all historical training/monitor/safety regression suites.

**Commissioning requirement:** CI green is not enough to claim the scheduled
system recovered. The first actual GitHub Actions job running after the merge
must successfully fetch the existing oversized `scalp-learning-memory` blob,
execute safe research decisions and publish consistent source-linked results.
If that job fails, the blocker is still open.

## B. Measure whether a pupil got better, not merely trained more

On every five-minute neural DQN update, compare the **old, unmodified**
checkpoint against the new model using exactly the **same** chronological
development dataset, standard trading costs and doubled-cost stress.
Store the prior model hash, a SHA256 digest of the identical development
bars, both model outcomes and both deltas in each research report.
All ten comparisons must reconcile before the new checkpoints can publish.

- `rl/dqn_experiment.py`: frozen predecessor same-window evaluation before
  gradient descent; new candidate evaluation afterwards.
- `rl/rapid_replay.py`: verifies every signed-by-source measurement,
  predecessor checkpoint hash, numerical deltas and zero broker/forward powers.
- `training-monitor.html`: displays per-pupil normal/stress deltas and counts
  of models beating predecessors on **both** assumptions.
- `rl/test_checkpoint_progress.py`: actually trains/compares PyTorch models
  and tests that the sealed final 20% is not passed into learning/evaluation.

Results are **descriptive comparisons on reused historical development bars**.
They do not prove the model will earn money, do not calibrate win probability,
and must never automatically unlock Teacher admissions, PAPER execution, live
money or a frozen release. A "better" but still loss-making model may remain
unprofitable. A model trained for the first time must correctly report "no
previous checkpoint" rather than claiming improvement.

## Source lanes remain separate

- 15-minute traditional rule/parent-seeded Academy lessons:
  `scalp-learning-memory`, scheduled every 5 min best effort.
- 5-minute neural DQN pupils: `rl-learning-memory`, scheduled 3 episodes
  per pupil each hour best effort, source `rl-5m-data`.
- NEO pattern memory: `neo-learning-memory`, independent historical analogue
  archive; fixed initial training/development boundary.
- Independent Teacher screens remain read-only; simulated trading results
  cannot become broker-verified grades.

All LIVE permissions remain disabled; this release introduces no broker order
request or account funding.
