# Price Level Intelligence (PLI) — research lane v1

**Status:** proposed shared skill in Gold/Silver Academy, offline research only. It is not the standalone SL trading strategy. No broker, paper or live order ability.

## Contract and integration

1. OHLC source goes through existing `parseDiscoveryCSV` / `validateDiscoveryBars`; only fully completed native 5Min or 15Min candles allowed. XAGUSD requires 15Min in this branch.
2. `mapKeyLevels` maps past confirmed swing highs/lows into ATR-width price zones. Zone IDs/strength/reaction maps are provisional numerical research outputs, not deterministic liquidity locations.
3. `suggestLevelSetups` produces **read-only** rejection/breakout/sweep/retest candidate theses with next-contiguous-open entry policy, initial stop, nearest reachable destination and gross risk/reward. No confidence is returned when insufficient fit-only evidence exists.
4. `researchLevelTransitions` records virtual Good/Bad/Neutral counterfactuals after bidirectional modelled cost stress, stores market-specific pattern/market-regime statistics, selects a cutoff on late TRAIN only and evaluates on subsequent DEVELOPMENT only. It can legitimately select a threshold of 1.01 = full abstention.
5. The last **20% of chronological bars stays sealed** and no hold-out grade, promotion or broker appointment is performed. This is a development report, not an independent examiner.
6. Each market has its own checkpoint; cross-symbol checkpoint scoring is blocked. The shared capability does not share fitted trading weights and does not modify the old 9×12×1 Teacher, strategy SL or other market pupils.
7. A market student's future Teacher/Strategist adapter must explicitly supply timestamped PLI evidence and pass the student-skill admission gates. This lane itself does not qualify the full agent stack.

## Train, store private memory, and inspect (local Node 22)

`node --test academy/price-level-intelligence-tests.mjs`

`node scripts/research-price-levels.mjs XAUUSD 15Min /private/XAUUSD_15m.csv /private/pli-output`

For the silver student's own native source: use `XAGUSD 15Min`. Source CSV and output including price levels, memory and checkpoints remain private. Three files are created with `wx` (no silent overwrite): immutable source-hash-tagged report, per-symbol model and fit-only observation memory. A source SHA-256 is logged; do not commit provider candles/derived price levels without licensing and privacy review.

## Acceptance/known limitations

- Source/authenticity, bid/ask, actual spreads, FX/GBP conversion, slippage and real fills are not verified. Notional `GBP` values are simplistic virtual reports; no trade-size or venue matching.
- PLI pattern probabilities are Laplace-smoothed empirical TRAIN hit fractions, **not** calibrated probabilities or ≥80% guarantees. Sparse patterns and negative net results lead to abstention.
- Rejection, breakout and sweep candidates can overlap at one timestamp. Virtual fit memory contains correlated counterfactuals: these cannot be counted as independent fills. Tuning and development select at most one candidate per signal window with no overlapping exits.
- OHLC same-bar TP/SL ambiguity resolves to the adverse stop; market gaps are not interpolated.
- Key-level shape, regime labels and low-sample thresholds are starting hypotheses. Optimize only on training windows; repeated DEVELOPMENT tweaking contaminates the development gate. Only a new independent, unobserved later series can validate generalization.
- Ensure full standalone Scout, independent Validator, Examiner and broker-paper reconciler before requesting pupil promotion. Autonomous Closer and adaptive profit management remain separate research tracks.

## Real-data research snapshot (2026-10-25)

A private **QC** CSV was found (2025-10-29–2026-10-23) with 23,415 rows/candles, SHA-256 `be6af88bd595edd0cdf5430822aea2603cdaa507054d58a3fa2218231e6050c3`. **This does not match the 23,416-row, SHA `bf80e4e48c127573735499ee9c081f8f649e1c5414f8964b014215ef2a962bc2` registry entry for the earlier original**; do not conflate. QC source remains outside public GitHub.

The first virtual experiment selected *full abstention* on TRAIN tuning, yielding zero PLI development trades and no claimed profitability. A basic momentum comparator on the same development candidate windows produced 67 virtual trades and **−£175.62** standard-cost / **−£282.82** stress-cost cumulative P&L at £1,000 arbitrary notional. This is a diagnostic against one baseline, not statistically independent or forward-trading evidence.