# FOUNDRY-JOURNEY-0.3 — historical learning to evidence-backed PAPER examination

Status: **implementation and Checker review**. Owner has not separately approved merging this exact release. Neither a public deploy nor PAPER examination is implied by passing tests.

## Single user experience
| Order | Location | What the user does | Evidence boundary |
|---|---|---|---|
| 0 | `mission-control.html` | See the state of the whole Foundry and pick a task | Landing/overview only |
| 1 | `strategy-validation.html` | Investigate strategies on completed historical candles | Browser research; never an official grade |
| 2 | `robot-academy.html` | View each of ten individual crypto pupil histories and provisional results | Saved training results are not admission |
| 2a | `training-monitor.html` | Check measured evaluations/s, actual learning, failure counts, new candles consumed | 0 new candles means replay of known data |
| 3 | `teacher-console.html` | Review independent chronological screening and verified PAPER evidence, if any | Historic screen is not signed forward grade |
| 4 | `trading-floor.html` | Examine published outcomes; synthetic sandbox remains explicitly separated | No front-end broker order authority |
| Optional | `agent-city.html` | Explore the 3D metaphor and roles | Illustration, not broker execution |

Keep the canonical four-stage rail visible on relevant screens, with Mission Control as the clear overview. Navigating between Academy, Teacher and Trading Floor carries an explicitly selected pupil using an allowlisted `?pupil=SOLUSD` URL parameter. Invalid values cannot be placed into contextual links. No persistent user storage and no broker orders are involved.

## Historical-first operating contract
- GitHub research schedules best-effort every **5 minutes** and retrieves authentic completed **15-minute candles**, with source refresh kept separate.
- Bounded per-candidate chronological folds use only the training partition; later validation and sealed holdouts are not learning rewards and repeated windows do **not** count as independent evidence.
- All measurements must distinguish simulations and unique configurations from novel data, profitable holdout confirmations and independently reconciled forward PAPER fills.
- As of the inspected research snapshot on 19 October 2026, the last saved cycle reported **1,080 virtual candidate evaluations at 1,024.98/s**, 30 historical batch attempts and **0 new training candles**. These are simulated strategy evaluations, not 1,080 broker trades or new independent observations.
- Three Alpaca PAPER accounts are separately linked, but remain examination slots, not authorised order engines. Admission still requires an auditable frozen model, historical holdout profit at stressed costs and user-controlled release gates. At least 30 real closed PAPER round trips with verified fills, fees and drawdown are required before official grading.

## Release integrity
1. Checker: `scripts/journey-context-runtime-tests.mjs`, `scripts/journey-nav-tests.mjs`, Academy/Teacher tests, Foundry integrated workflow.
2. Include independent research-to-Teacher publication from PR #33 only after its own Checker verification; never substitute unsigned historical screening for signed PAPER grades.
3. Keep PR #36 neural accelerated historical replay as a **separate reviewed release**; do not introduce scheduled PyTorch execution, extra GitHub Actions cost or brokerage authority as an accidental dependency of UX work.
4. Owner must expressly approve the exact PR or assembled merge version before an external release. Record the actual merged commit and live browser verification after that approval.

This is a cohesive product journey, not a promise of profitable models or live trading readiness.
