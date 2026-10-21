# One Alpaca PAPER account for Scalp City demo pupils + Teacher observation

**Status: design + read-only attribution prototype. NOT commissioned for broker
order execution or official forward grading.** The owner requested using the
already connected Alpaca PAPER account for both roles, with no new account.

## Design decision

**One account, one order-writing process, two roles:**
1. The *pupil pilot* is the **only** prospective paper-order writer. The
   current prototype writes orders with `SCALPDEMO5M-` client order IDs using
   tiny demo-money budgets and a pinned frozen model.
2. The *Teacher* is an **independent GET-only reader and auditor** of the
   same Alpaca account. It must NOT start its separate `teacher-` paper
   trading executor on that account while the pupil pilot holds the writer
   lease. Trading activity must not be submitted twice to "produce a grade".
3. Teacher should eventually verify genuine broker FILL and CFEE/FEE activity
   **against signed, immutable, source-bound pilot order intent records**,
   isolate the exact frozen pupil/model and symbol, rebuild a separate mark to
   market risk ledger, and issue a signed grade only after all ordinary
   qualification and owner-approval gates. This adapter is NOT built yet.

Alpaca documents that distinct `client_order_id` values can segregate
strategies within one account, and that account activity records carry
`order_id` for reconciling actual fills. This does NOT segregate shared
inventory or broker fees automatically.

## Implemented in this review branch

`teacher/shared-paper-observer.mjs` accepts only source-provided broker
account, exhaustive order/activity records, and optionally individually
frozen intent mappings. It:
- Requires matching account identity, status and complete broker pages;
- Separates `SCALPDEMO5M-` and `teacher-` order namespaces;
- Rejects unrelated/manual orders, duplicated/missing order IDs, broken
  symbol/side links, fabricated model-intent SHA or mismatched fills;
- Blocks mixed open order writers and reports open inventory as unsafe for
  account handoff;
- Counts genuine FILL activities without inventing fees, net profit,
  per-strategy balances, eligibility or official grades;
- Always returns `readOnly: true`,
  `sharedAccountExecutionEnabled: false`, `paperOrdersSubmitted: 0`,
  `teacherGrades: 0`.

This module is deliberately **not wired to submit orders** or to Teacher's
`gradePupil` until an independently verified execution and attribution
architecture is supplied.

## Real dependencies to activate safely

A. **Match exactly the same PAPER broker account ID** across the existing
GitHub paper account and private Railway Teacher credentials (not possible
to read secret values through the active GitHub connection). Identical
account display names are not sufficient.

B. **One writer authority** enforced by a single server-side, durable lease
or explicit fail-closed transition. Because independent GitHub Actions
and Railway may run at overlapping times, a human checkbox/flag alone is
not a strong distributed lease. Teacher runtime must be observational
only for that account. The existing Railway examiner's exact-release
variable is absent, so the older Teacher writer cannot currently arm
automatically; never loosen this rule.

C. **Complete evidence sources**: 30+ independently observed, settled
closed round trips, full broker FILL/fee activity, verified virtual
capital/crypto inventory attribution, time series drawdown and GBP
conversion. The current GitHub pilot exposes only summary logs and
30-day workflow artifacts; these are NOT a durable independent signed
model-intent ledger.

D. **No hidden brokerage access**: the assistant cannot change GitHub
Actions secrets/variables or dispatch Actions via its currently connected
GitHub tools. Existing Railway variables are redacted and must not be
copied or exposed. Any new credentials are entered by the owner
directly into a private trusted secrets interface, never chat/code.

E. **Release approval**: after Checker validation and a read-only live
account preflight, the owner separately approves the exact writer model
SHA, account identity fingerprint and activation. No order is submitted
as a side effect of review/merge.

## Why we cannot simply enable both current executors

The present Teacher's `engine.mjs` and `evidence.mjs` intentionally reject
non-`teacher-` paper orders and ambiguous shared crypto fee/inventory
attribution. The current demo pilot's `preflight` intentionally rejects
non-`SCALPDEMO5M-` historical orders. Silencing those checks without
adding a durable source-bound ownership ledger would compromise grades
and could lead to double-selling a pooled holding.

## Scope of this change

Read-only segregation foundation, tests and documented release plan.
The original paper and Teacher execution gates remain unchanged and OFF.
