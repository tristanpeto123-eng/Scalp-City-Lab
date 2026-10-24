# Scalp City · Student Observatory

Route: **student-progress.html**, linked from Robot Academy, Training Monitor and Scalp City Lab.

## Real connected progression

**Crypto cohort (10 per-pair research students)**

1. The Academy publishes read-only historical research lessons to \`research-data/robot-academy.json\`. Each lesson has a recorded source period, sampled candidate count, provisional win-rate grade, net historical virtual profit, and \`independentWindow\` flag. The last 40–60% historically held out from model selection is not promoted to proof merely by rendering charts.
2. The bounded research monitor \`research-data/training-monitor.json\` supplies exact reasons a new lesson did not save, e.g. \`DAILY_EXPERIMENT_CAP\`, \`newTrainingCandles:0\`, or \`NO_NEW_PARAMETERS_ON_SAME_CANDLES\`.
3. Deep RL's \`rl-learning-memory/rl-rapid/latest.json\` provides actual cumulative gradient updates, latest run updates, genuinely new five-minute candle tail count, frozen model fingerprint and same-window virtual development performance under ordinary/stressed costs.
4. An hourly best-effort GitHub Actions workflow \`student-progression.yml\` merges **only whitelisted, public-safe summary fields** into \`research-data/student-progression.json\`. It accumulates a new progress-chart point only for a changed model SHA; republishing identical model data never becomes fake learning. No raw weights or account secrets leave their source branches.

**Market-specialist students**

The currently active Commodities, Forex and Indices student slots look for their SL checkpoint in the current browser's existing \`localStorage\` (per-market and symbol). The Observatory may show actual saved incremental neural-feedback revisions, candidate good/bad trade counts, processed candles and accumulated virtual P&L from recorded orders, **but it never sends the checkpoint to GitHub or syncs it across devices**. If a student has not trained or was trained on another device, its status is \`NO_LOCAL_CHECKPOINT\`. Equities is represented as not yet activated.

## Chart definitions, no implied proficiency

- **Academy grade**: provisional win-rate *bucket of historical candidate*, not machine-learning accuracy, capital performance or admission.
- **DQN cumulative updates**: actual saved neural optimizer update count over unique checkpoints, not profit or a proof of model improvement.
- **DQN after-cost performance**: same-window historical development profit and stress profit; this is deliberately not a forward trade sequence. A higher line is not verified generalization.
- **Independent window timeline**: \`1\` only for historical windows marked independent relative to previously accepted research. An overlapping run scores \`0\` regardless of how many times it was scheduled.
- **SL local charts**: realized **virtual simulator P&L** from already recorded completed simulated orders; no actual broker-money claims, no inferred orders.
- **Freshness**: show exact Academy published and DQN checkpoint timestamps; a successful Actions run with no saved evidence remains a no-op.

Promotion/graduation is **not** automated. Research has zero signed independently verified forward grades and zero broker orders; profit gates can remain failed despite genuine optimizer activity.

## Reliability and next backend milestone

This release is a **read-only Observatory plus hourly GitHub report publisher**, not a permanent low-latency server. Its best-effort GitHub schedule can be delayed. The SL live polling loop still runs only while the existing Safari tab remains open and awake; it needs separate private server storage, provider permissions, budget, failure recovery and owner-approved deployment before any unattended operation can be claimed. The browser deliberately does not send client-stored models, credentials or private trade journals to a public endpoint.

## Tests

\`node --test scripts/build-student-progress-tests.mjs\`

\`node scripts/student-progress-browser-smoke.mjs\` after Playwright Chromium and WebKit browsers are installed.

Checker gates include source-schema/source-identity validation, model fingerprint de-duplication, lack of imaginary forward evidence, chart/roster rendering, persisted browser-local SL and mobile WebKit.
