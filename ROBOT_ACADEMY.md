# Scalp City Robot Academy — approved UI specification

## Purpose
One robot pupil per crypto pair, a colourful school metaphor for **observed winning-trade percentage**. Grades 0 through 9 represent 0–9.999…%, 10–19.999…%, etc. Grade 10 is exactly 100%. **Orientation** means insufficient or missing trade evidence.

## Evidence requirements
- The initial published academy has **zero independently verified forward-paper trade records** and must show every robot ungraded.
- Clicking **Explore simulated classroom** shows clearly labelled *fictional* 100-trade demonstration results. Clicking **Simulate a training lesson** changes those demo fixtures only. **Show actual status** resets the UI to ungraded.
- A grade is provisional unless the record is independently validated and has at least **30 unique closed forward-paper trades**. A sample of 30 is a UI minimum, not proof of profitable strategy.
- For each pupil the report card separates grade, observed win rate, **realized net GBP profit**, **max drawdown**, champion strategy/model, and evidence status. 80% winners can still lose money after fees or through large losses.
- Data from historical backtests, training sets, replayed windows, generated tests, screenshots or user-authored JSON **must never** populate a *verified* grade.
- Future trusted data ingestion should authenticate backend, validate broker forward-paper trade IDs and order/fill reconciliation, de-duplicate unique closes, compute net GBP correctly (conversion and fees), and bind each result to exactly one pair and one selected model. JSON's self-reported source field is not authentication.
- Champion strategies are input hypotheses for future training, not automatic permission to place orders, graduate, or approve release. Final broker actions remain blocked.

## Integration contract
`robot-academy-schema.json` specifies a planned **server-issued** forward-paper feed. Required: source, unique trades, profit/loss, drawdown, champion model and provenance. The current page does **not** fetch or trust this feed. `window.RobotAcademy.previewVerifiedRecord()` performs shape checks for a *client-side preview only* and never changes official grades.

## GitHub release
Static UI: `robot-academy.html`. Navigation from `strategy-validation.html`. Node checks: `robot-academy-tests.mjs` via `.github/workflows/robot-academy-tests.yml`.

Visual school grades are educational; not investment returns, approval for real accounts, or a brokerage platform.
