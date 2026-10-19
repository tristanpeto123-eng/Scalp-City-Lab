# Scalp City — continuous research learners, immutable grades, NEO, demo PAPER pilot

**Status:** Release-candidate, owner approval required before production deployment. **No LIVE trading capabilities.** NEO, the training scheduler and the paper sandbox are independent.

## Goal

Profit after realistic spread/fees/slippage and controlled drawdown is the goal, not XP or number of orders. A pupil that rationally remains flat can be correctly managing risk; force-trading to inflate trade counts would not prove edge.

## Training as much as is useful

- 10 independent five-minute DQN agents, persisted on `rl-learning-memory` with genuine gradient updates and model SHA lineage.
- Increase from 2 one-episode batches/hour (48 episodes per pupil per day) to one **three-episode** batch/hour (72 episodes per pupil per day). Each episode traverses authentic completed historical observations; a single batch can comprise hundreds of thousands of simulated decisions, **not** real trades.
- A five-episode bounded manual training burst is available under GitHub Actions -> Robot Academy accelerated Deep RL -> Run workflow; actual runner timeout takes precedence and quota limits apply.
- The 5-minute market-source refresh remains six-hourly and read-only. More epochs on the same 30-day history do not add independent evidence. Watch validation performance and a frozen, untouched final holdout, not just total SGD steps.
- Stored `latest.json` includes real evaluations, simulated position closes, real gradient updates, development net/stressed return, SHA checkpoints and no paper orders.

## Grading/frozen versions while research keeps progressing

- Each student has an evolving researcher/learner checkpoint. Historical candidates can be captured by the **immutable model registry** (`rl/model_registry.py`). A freeze copies weight bytes using content-addressed filenames, records source SHA and cannot overwrite an existing release with different content.
- A frozen candidate is **not automatically a graduate**. Only independent signed PAPER order/fill evidence plus owner approval can admit an exact model version to the trading floor.
- When admitted, that version stays immutable. The learner retains its independent evolving weights, and a future promotion needs its own assessment.
- There is intentionally no automatic promotion, no model changing during a qualified forward examination, and no PAPER order execution from NEO pattern-memory jobs.

## NEO, the separate memory agent

- NEO is a source-grounded global research memory of genuine five-minute OHLCV windows from all ten markets, using stable SHA identifiers and scale-normalised price/body/range pattern features (not screenshots/pixel-perfect memory).
- Deduplicates all eligible training patterns; retains their historical three-candle forward outcomes with timestamp provenance. Can retrieve nearest earlier outcomes causally. Predictions are historical analogies, **not calibrated probabilities or independently tested profit**.
- Fixed initial training/validation boundary prevents rolling-window contamination. Previously reserved validation and final holdout data are not allowed to leak into Neo's labelled archive. This conservatively limits new labelled patterns until a subsequent independently audited evaluation epoch is created.
- Isolated persisted `neo-learning-memory/patterns/<PAIR>.json` and `latest.json`. UI `neo-lab.html` shows chart-pattern coverage and safe historical example predictions.

## PAPER = demo money, with hard technical gates

Alpaca explicitly documents a **separate paper account and API credentials** for simulated-money trading. This code uses only `https://paper-api.alpaca.markets`; live endpoint cannot be selected. See https://docs.alpaca.markets/us/docs/paper-trading .

**Important: do NOT reuse the three existing Teacher/examiner PAPER accounts by accident.** Use a **dedicated separate demo account** for the experimental sandbox (or explicitly reassign an existing one when no conflicting examiner orders are present).

Two-phase activation:

1. In GitHub repository Settings -> Secrets and variables -> Actions -> Secrets, configure:
   - `SCALP_DEMO_PAPER_KEY` and `SCALP_DEMO_PAPER_SECRET` from the designated Alpaca **PAPER** account.
   - `SCALP_DEMO_PAPER_ACCOUNT_ID` expected UUID of that **same** PAPER account. Used to prevent trading in a different PAPER account even if keys were accidentally changed.
   These names are deliberately different from the existing read-only `ALPACA_PAPER_KEY` data keys. They must never be checked into code.
2. Run `Scalp City — isolated DEMO PAPER pilot` with `preflight` in Actions. This reads the paper account, positions and orders using GET only, and refuses any previously unrelated orders or holdings.
3. Under `Robot Academy — accelerated Deep RL historical replay`, select an exact per-pupil `modelSha256`. Run `Scalp City — freeze one ungraded DEMO candidate` with that exact SHA and a symbol. This copies frozen research weights to isolated `paper-sandbox-models`. The frozen candidate is **not graded**.
4. In Settings -> Secrets and variables -> Actions -> Variables, configure `SCALP_DEMO_SYMBOL` (e.g. `ADA/USD`), `SCALP_DEMO_MODEL_SHA256` (exact frozen 64-character hash) and, **only after** successful preflight and explicit approval for demo orders, set `SCALP_DEMO_PAPER_ENABLED` to exactly `YES_DEMO_ONLY`.
5. Run `mode=plan` once. Only then, with the enabled flag, `mode=paper` or the five-minute best-effort schedule may issue tightly capped demo orders. The schedule never sends orders when disabled.

Execution limits: one authorised symbol, one pinned model version, dedicated account identity, at most 4 submissions per UTC day, maximum $5 USD new order size (coded upper bound $10), no margin/shorts, no unrelated positions or orders, duplicate candle/side/model client-order IDs block repeat submissions, no order if candles are stale/noncontiguous, no intrabar inference, account equity and cash minimum $20. If a trade is submitted, the result is **not filled evidence** until verified through paper broker fills. Timing is best-effort GitHub Actions, not an always-on low-latency market executor.

This paper sandbox is for experimental model testing, **not independent grading**. The Teacher still requires its own signed paper account transaction history, independently verified grading rules and explicit owner authority. Neither sandbox submissions nor NEO memories are certificates of profitability.

## No automated broker activation in this PR

The assistant has no tool to inspect/change user-specific GitHub repository Actions secrets/variables or send a workflow dispatch. This PR only implements the gate, tests, and workflows; it does **not** claim an account has been connected, a demonstration order has been submitted or the model has graduated.
