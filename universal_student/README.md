# Universal Student (UNIVERSAL-01) — phone-operated research lane

Status: REVIEW CANDIDATE. Not a production release, verified model or broker trader.

## How to use on iPhone after reviewed merge

1. Visit Scalp City Robot Academy → Universal Student (universal-student.html).
2. Select TARGET market (BTC/USD by default) and SOURCE saved DQN model.
3. Tap Train via GitHub. In GitHub Actions choose Run workflow, select main, enter target/source and up to 10 training episodes.
4. Return to Universal Student and press Reload progress.
5. The first generation copies compatible saved weights to a new student. Later generations continue only the selected target's own checkpoint, regardless of a later source selector change.

## Important distinction: original XAU source

This PR does NOT yet import the Rapid Learning v0.4 XAUUSD Conv1D weights. Those portable weights currently live in the earlier standalone downloadable Scalp City ZIP, not the GitHub repository. The gold model uses Conv1D (five input features, three actions), whereas the currently saved crypto models are DQN (nine features, two actions). Directly substituting those tensors would corrupt the model.

The integrated working lane uses actual saved crypto DQN weights from the separate GitHub rl-learning-memory branch. Commodities, forex and indices require a vetted compatible data/model adapter before they can train; they have NOT been silently relabelled as crypto.

## Files and data ownership

- universal-student.html: mobile-friendly UI for model selection, historical results and generation charts. Browser asks for no tokens and sends no orders.
- universal_student/run_github.py: model-transfer trainer, hash validation, strict market isolation and no checkpoint overwrite.
- .github/workflows/universal-student.yml: manually dispatched, GitHub-authenticated research-only training, 5-minute completed historical data.
- universal-student-memory branch: isolated model/checkpoint history and JSON reports for the frontend. Existing crypto pupils are not modified.
- universal_student/test_run_github.py and universal-student-tests.mjs: safety and behavior regression tests.

On GitHub Pages, triggering authenticated Actions is not possible without a secure auth service. Thus Train via GitHub opens GitHub's own workflow form for the signed-in owner. It is NOT a silent one-click job submission.

## Research boundaries

Historical replay uses modeled costs, virtual £50 capital, a 60/20/20 split, and an untouched final 20%. Cross-market models may have seen chronologically correlated later data in other markets; imported weights therefore do not establish independent out-of-sample validation. Repeated simulated closes are not verified forward trades, results are not real-money account P&L, and no evidence from this lane is an Academy official grade.

No broker orders, live permissions, automatic admission, user cash or trading authorization.

## Checker commands

- node --test universal-student-tests.mjs
- python -m unittest universal_student.test_run_github -v
- After exact-version owner-approved merge, initiate one BTC/USD workflow and check the Action result and isolated saved research JSON.

To stop training, disable the GitHub Actions workflow. No current production trader is affected.
