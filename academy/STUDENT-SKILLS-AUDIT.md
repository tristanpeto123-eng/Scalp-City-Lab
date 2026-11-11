# Academy student skill architecture audit — 25 October 2026

**Decision:** the current Gold/Silver 9×12×1 classifier is **OLD-STYLE BASELINE ONLY**. No graduate, broker-paper appointment or autonomous trading permissions are granted by training or passing CI.

## Evidence from actual source

- `academy/opportunity-discovery.mjs` emits six pre-entry features (trend, momentum, volatility, relative volume, relative position in 24-bar high/low, long/short), a simplistic regime flag, and pre-fixed holding/SL/TP scenarios. These features are **not** the full Scout, Levels, Strategist or event skills.
- `academy/teacher-training.mjs` appends holding period, stop and target to those six features, trains a 9×12×1 neural binary classifier, picks a threshold on training history and reports historical development P&L. Classification score **is not** calibrated expected net GBP.
- The final 20% is sealed; the independent examiner, virtual forward replay, skill-linked Good/Bad memory, autonomous contextual skill selection, and broker-paper reconciliation are **not implemented in this lane**.
- Gold/15Min, Gold/5Min and Silver/15Min now receive explicit immutable skill-gap reports via `student-skill-contract.mjs`. Silver/15Min and Gold/15Min use separate neural weights and checkpoints. The existing independent SL strategy and older ten crypto pupils remain unchanged.

## Canonical architecture to build, NOT evidence of existing implementation

1. **Sources / Regime context** — completed OHLC on native timeframe, multi-timeframe context and verified point-in-time event/news snapshots. Scout A independently classifies direction, volatility, chop, trend quality and confidence. Unknown/unsafe regimes can yield ABSTAIN.
2. **Shared analytical skills (versioned, causal read-only outputs)** — Price Level Intelligence (zones, bounce/break/retest/sweep/next zone), Cross-Chart Reaction Intelligence (time-aligned market relationships and lag), and Event Reaction Intelligence consisting of *Event Anticipation*, *Reaction Propagation* and *Direction & Amplitude Forecasting*. Shared skills are researched on historical facts; per-market students fit their own conditional reactions rather than mixing all trade outcomes. If event/news data are absent, output `NO_EVIDENCE`, never fabricate sentiment or scheduled/unscheduled-event signals.
3. **Trade context, reasoning and proposals** — Scout B estimates **cost-adjusted expected trade value**, distinct from classifier score. Strategist chooses a thesis, candidate direction, entry, TP/SL, invalidation, duration and next target, or ABSTAIN. Selection must rely only on data available at the signal time.
4. **Checks** — independent Validator checks thesis, context, costs, source freshness, risk, and simulated fills. Guardian A observes and logs thesis validity without autonomous early exits. Adaptive Profit Management / active exits remain a **separate future skill**, not a hidden Guardian side effect.
5. **Student memory and Teacher** — Good/Bad/Neutral outcomes contain *skill version, evidence bundle id, decision reason, timestamp, entry/exit, actual or virtual source, after-cost net P&L and magnitude*. Teacher trains per-symbol/mode experts and a contextual selector, with abstention and matched before/after baselines. Do not confuse multiple candidate directions for independent executed trades.
6. **Independent Examiner / promotion** — immutable source cutoffs and unseen holds, purged walk-forward validation, portfolio exposure and cost stress, calibration and net-GBP vs champion. Proposed minimum gates (from earlier design): ≥100 independently evaluated closed trades, positive net profit, profit factor ≥1.20, max drawdown ≤15%, verified no-leak and champion improvement. These are **provisional** and **not implemented**; never claim they have passed.
7. **Governance** — Scout/Strategist/Guardian/Validator proposed skills do not place broker orders. The owner must explicitly approve the exact immutable model for actual broker paper testing; live approval is a later separate gate. The existing SL strategy must not be overwritten or silently repurposed.

## Implementation status summary

| Skill | Current code | Required upgrade |
|---|---|---|
| Market data/timeframe | Basic validated OHLC | Provenance, point-in-time multi-market/timeframe joins |
| Good/Bad memory | Historical ephemeral labels | Durable market+skill memory with reasons |
| Scout A / Regime | Basic 24-candle heuristic | Independent regime detector, confidence and abstention |
| Price Level Intelligence | One high-low relative-position scalar | Level zones, interaction patterns, predictions |
| Cross-Chart Reaction | Missing | Lead/lag and after-cost conditional evidence |
| ERI subskills (three) | Missing | Causal event anticipation, propagation, direction and amplitude |
| Scout B expectancy | Missing | Independent net-EV/regime model |
| Strategist | Fixed trial TP/SL, not a skill | Contextual trade thesis and TP/SL/invalidation |
| Validator | Missing | Separate thesis, cost, source and risk adjudication |
| Guardian A | Missing | Read-only thesis monitor |
| Skill selector | Missing | Conditional expert selection, abstention |
| Examiner | Sealed data reserved, not evaluated | Independent promotion exam and checkpoint comparison |

**Checker policy:** A trained legacy neural baseline may produce *research* reports, but must never be described as a fully configured student. `assertStudentQualified` rejects attempts to use this branch's capabilities for full-stack training/graduation. Its canonical code registry cannot be bypassed by editing only a model JSON manifest. To graduate, substantive skill modules, timestamped proof they were actually called, and independent tests must be added and reviewed, followed by explicit owner approval.

**Next coding milestone:** build Scout A as the first fully independent callable capability, then Price Level Intelligence and evidence bundles, then contextual Teacher/Strategist; conditionally add ERI and Cross-Chart when synchronized source data exist. Re-run baselines from **frozen data windows** without peeking at held-out data, and identify any false positive/negative edge after costs.
