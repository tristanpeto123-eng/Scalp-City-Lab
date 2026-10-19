# SCALP-RESEARCH-V2 — parallel research lab
Status: **review candidate / no release approved / no broker orders** (19 October 2026)

## Scope
This is a separate, reproducible offline discovery engine for the ten Academy
crypto symbols. It does not replace the independent Teacher, independent historical
auditor, paper order executor, forward fill examiner, or signed public grade.

- `scripts/research-v2.mjs`: parallel Worker Thread evaluations across 10 charts.
- `scripts/research-v2-tests.mjs`: separation, determinism, brokerless output,
  thread agreement and historical tamper regression.
- `scripts/research-v2-handoff.mjs`: produces a source-digested, unsigned,
  no-orders Teacher **review queue** from shortlisted historical models.
- `scripts/research-v2-archive.mjs`: chronological overlapping archive with
  immutable content-addressed raw files and manifest chaining; abort on a
  mismatched historical candle or gap.
- `.github/workflows/research-v2-check.yml`: read-only pull-request Checker,
  tests and a downloadable development-only result artifact.

## Research architecture
1. **Provenance:** validated 15-minute completed Alpaca/Kraken crypto snapshots,
   per-market full snapshot digest, bounded chronology. Never modify source bars.
2. **Fixed quarantine:** last 20% of the dataset is excluded from all V2
   candidate generation and selection. Random-search seeds are derived from the
   **development-only** history digest. Altering quarantined future prices MUST
   NOT change any candidate rankings.
3. **Exploration:** 36 configurations per market by default, balanced over the
   three **already supported** families: EMA trend, RSI reversion, channel breakout.
   Include approved earlier historical parent and neighbours only when its
   training period finishes before the quarantined data. Parent is not a
   verified champion, and no ML weights or AI forecasts are implied.
4. **Evaluation:** split the development 80% into two or three entirely disjoint
   chronological folds. The existing canonical strategy simulator warms up
   causally within each fold and scores only subsequent bars. Every candidate
   is retested at modeled 0.25% and 0.50% **per side**. Folds do not share
   scored trades and results are not independent live trading samples.
5. **Screening:** require >=30 scored historical closes, >0 aggregate modeled net
   at normal and doubled fees, max fold drawdown <=8%, and positive outcomes
   in at least two-thirds of folds. Rank by risk-penalised, stress-cost
   outcomes and archive failures too.
6. **Execution:** automatic workload selection runs small batches sequentially
   (thread startup proved slower on the 19 October GitHub CI runner),
   reserving up to 4 parallel workers for large candidate budgets. GitHub
   writes only an Actions artifact; no Alpaca credentials, live feeds, secrets,
   order privileges, portfolio control, automatic admission or grading.

## Candidate handoff / Academy contract
An exported `SCALP_RESEARCH_V2_CANDIDATES` object is **development-only**.
Shortlisted candidates may be inspected by Researcher, Checker, Director and
Teacher, but cannot enter `research-data/robot-academy.json` as confirmed
champions or appear as forward-paper grades. For any candidate to reach the
Teacher it needs a **new**, frozen historical research lineage and independent
untouched holdout verification by the existing Teacher auditor. New
parameters that do not match an independently fingerprinted research record
must be enrolled via an audited source-history adapter, NOT copied into
signed admissions. Paper orders require an explicit exact-version release.

A later separate integration can write **provisional research cards** to the
Academy; the signed grade namespace is never written by this V2 engine.

## Checker instructions
Run:

```bash
node --test scripts/research-v2-tests.mjs
node scripts/research-v2.mjs research-memory/scalp-learning/history.json validation-data qualification-results/scalp-research-v2.json auto 36
node scripts/research-v2-handoff.mjs qualification-results/scalp-research-v2.json qualification-results/teacher-review-v2.json
```

For immutable private historical backups, run:

```bash
node scripts/research-v2-archive.mjs /absolute/private/scalp-archive validation-data
```

Archive operation is explicitly opt-in: do not copy private archive files into
public source control. The current validator caps combined contiguous datasets
at 20,000 candles; sharding is required before larger datasets can be ingested.
Historical archive assembly into multi-epoch training remains a follow-up.

## Outstanding prerequisites before production training replacement
- Benchmark V1 vs V2 at equal candidate count and realistic regimes. In GitHub
  CI on 19 October, the same 360 candidate evaluations completed in 1093 ms
  serial versus 1181 ms forced four-worker (0.925x speed ratio); hence
  lightweight workload auto mode now favours one worker. These are run-specific
  timings, not guarantees.
- Resolve disagreement between canonical simulator's intrabar stops and the
  independent Teacher auditor's next-open close checks. A V2 result is not
  evidence of Teacher parity or executable returns.
- Introduce a vetted cost/slippage model, multiple-testing diagnostics and
  alternate regimes. No increased universe of strategy families is authorised
  until both simulator and independent auditor support them.
- Confirm V2 isolation tests and reproducibility in GitHub Actions.
- Run G0/G1 Checker review and owner approval of exact release before any
  deployment, Academy publication or external action.

**Never infer profitability, live fills or model graduation from an offline result.**
