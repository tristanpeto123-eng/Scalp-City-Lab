# Research ↔ Teacher evidence bridge · 2026-10-19

## Purpose
The historical trainer persists ten chart-scoped research pupils in the private GitHub
memory branch, then publishes read-only Academy training records. Teacher screens the
same archived sources against untouched chronology and cost/risk gates.
Previously its report was uploaded only as a CI artifact; browser users could not
distinguish **a recent independent historical rejection** from **an absent report**.

## End-to-end read path
1. GitHub's existing research job performs historical-only runs and updates the
   GitHub memory branch and `research-data/robot-academy.json`. Repeated or overlapping
   candles **do not** prove new learning or progress. Stale sample age is explicit.
2. `teacher/qualification-runner.mjs` remains independent: sources, FX references,
   historical holdout and doubled-cost criteria. A candidate can receive a historical
   PASS for **manual review**, never a broker admission.
3. After successful independent screening, `scripts/publish-teacher-screen.mjs`
   strictly validates the complete audit cohort, fails on nonzero orders or admissions,
   strips report fields not needed by the browser, and publishes
   `research-data/teacher-qualification.json` to the Lab repository.
4. `teacher/qualification-bridge.js` fetches the report read-only and independently
   checks 10 distinct symbols, the schema, and zero official grades/orders/admissions.
   Academy, Teacher and Trading Floor all show the same source-backed **historical
   qualification** category and status. An absent report is UNKNOWN, never PASS.
5. Actual official PAPER forward grades remain separate: the pinned signed Ed25519
   Teacher feed is the sole official source. No bridge component can mutate it.

## Visual/mobile
Journey is a compact accessible 48px launcher on iPhones; opening the full route map
remains an explicit tap. This is not a claim of manual iOS Safari verification.

## What is NOT connected yet
This bridge **does not** enrol candidates, run paper orders, create signed grades,
make neural models Teacher-compatible, establish current profitable strategies, or
automatically use the Research Desk's local trial records as Academy memory.
These remain gated tasks requiring independent risk, source/version reconciliation,
explicit owner release approval and separately commissioned server-side runtime.

## Acceptance
G0 public report and UI fail-closed tests. G1 existing signed feed + Academy and
Teacher checks. When approved/merged, trigger the owner-operated Teacher qualification
workflow or wait for its daily schedule; a GitHub Pages deploy alone will show UNKNOWN
until independent report generation/publish succeeds.

## Source reconciliation (fail closed)

The site now SHA-256 hashes the full current published `robot-academy.json` object and
compares it with the independent Teacher audit's `academySourceSha256` before any
historical screening result is made available to the four screens. An old report,
missing current source, wrong digest or unavailable secure hashing is **UNKNOWN**,
not a PASS. Matching hashes prove consistency with the published source only;
they are **not** a Teacher cryptographic signature or evidence of live trades.
