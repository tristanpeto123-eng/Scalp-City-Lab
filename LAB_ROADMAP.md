# Scalp City Lab — Development Roadmap

Source snapshot: `tristanpeto123-eng/Scalp-City-1` commit `3b246ebec0458734509135a5317e2af011d45408` (11 October 2026).

## Milestone 0 — Isolation and baseline
- [x] Define isolation patch, smoke tests and independent-agent workflow (prepared in bootstrap).
- [ ] Bootstrap the empty Lab repository; wait for the GitHub Actions job to complete.
- [ ] Verify **Checks** are green and baseline source assets exist.
- [ ] Verify user-visible simulation label, QQQ/SPY/IWM demo, CSV import, stop, save, BT-01 report export on iPhone.
- [ ] Enable GitHub Pages on Lab only after tests pass.
- [ ] Verify the original repository's head remains unchanged.

## Milestone 1 — Accurate research
- [ ] Historical data licensing, source, provenance, timezone, cleaning and versions.
- [ ] Chronological training/validation/final holdout, walk-forward and leakage tests.
- [ ] Correct order fills, spreads, commissions and funding assumptions.
- [ ] Separate *candidate aggregate research statistics* from *paper account P&L*.

## Milestone 2 — Independent agents
- [ ] Researcher, Strategy Designer, Optimizer, Backtester, independent Validator, Scorer.
- [ ] Immutable content-hash approvals: change candidate = reset approval chain.
- [ ] Vault with provenance and traceability, feedback loop for rejected candidates.
- [ ] Denial-by-default capabilities and ten end-to-end acceptance cases.

## Milestone 3 — Risk and paper operations
- [ ] Risk Manager with unbypassable position-level limits and emergency stop.
- [ ] Forward paper execution with fresh data, reconciled simulated fills and journal.
- [ ] Strictly no live broker credentials or live order capabilities in Lab.

## Milestone 4 — Agent City and release
- [ ] Interactive 3D buildings/robots, connections and live workflow status.
- [ ] iPhone camera, rendering and screenshot fidelity tests.
- [ ] Human-reviewed promotion into stable repository only after tests pass.
