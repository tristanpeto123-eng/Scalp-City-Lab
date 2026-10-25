# Academy Neural Teacher v1 — review candidate

## Scope
A separate neural Teacher for **XAUUSD historical research**, not the existing SL strategy. No brokerage account, API key, authenticated paper results, live orders, or model promotion.

## Training
- Accept only the offline Discovery Engine's Good/Bad/Neutral counterfactual candidates and keep each signal timestamp as one correlated candidate group.
- Use the original market candle chronology: first 60% TRAIN, following 20% DEVELOPMENT, final 20% untouched.
- Fit a 9-input / 12-hidden / 1-output tanh-sigmoid neural network using the early TRAIN groups. Inputs: six pre-entry causal features plus precommitted holding period, stop distance, and target distance.
- Binary labels are positive and negative **virtual net P&L after modelled costs**. Neutral examples are excluded from binary weight updates. Class weights and profit magnitudes are clipped; group weighting reduces repeated-timestamp dominance.
- Choose a threshold only using later TRAIN groups; if none makes positive normal and stressed virtual net P&L with at least eight selected timestamp groups, **ABSTAIN**.
- On DEVELOPMENT, choose at most one simulated trade per timestamp using the frozen neural score and threshold. Compare realised virtual net P&L, stressed P&L, drawdown and a simple momentum reference. These are development diagnostics only.
- Produce an SHA-256-labelled immutable research checkpoint with **enabledForBroker=false**, and a separate report with **zero forward verified grades, zero paper/live orders, zero automatic promotions**.

## Run
`node --test academy/opportunity-discovery-tests.mjs academy/teacher-training-tests.mjs`

`node scripts/discover-academy.mjs /path/to/XAUUSD-5m.csv /tmp/discovery.json`

`node scripts/train-academy.mjs /tmp/discovery.json /tmp/academy-outputs`

No historical XAUUSD data has yet been authenticated or supplied to this repository. Tests use synthetic fixtures **only for software correctness**, not claims of market performance. GitHub Actions can re-run Checker and train from a deliberately supplied CSV if present; when absent, it logs NO_SOURCE_DATA and does not invent results. Scheduled runs on identical history do not count as additional independent learning. No persistent price-data collector, cross-run neural checkpoint continuation, or independent holdout examiner is implemented in this milestone.

## Promotion boundary
Neither a high prediction score nor a positive historical development report allows paper broker orders or CEO appointment. Independent final holdout examination, audited forward-paper results after owner authorisation, and explicit approval of exact model versions are separate future steps. Do not merge this feature to Scalp-City-1 or change the existing SL implementation.