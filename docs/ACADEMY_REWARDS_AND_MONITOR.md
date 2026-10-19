# Robot Academy rewards and training observability
Status: isolated review PR; release needs Checker gates and exact-version owner approval. No broker orders or verified trading graduates are claimed.

## Positive reinforcement
Each of the 10 crypto-chart pupils has append-only, per-chart historical research memory. An independently nonoverlapping TRAINING lesson can earn provisional XP only with 30 or more closed historical trades, positive modeled net profit after both normal and doubled fees, and maximum drawdown at most 8%. Each rewarded candidate earns at most 100 XP. High win rate with losses, reused candles, unsupported cost evidence, or excessive risk earns zero.

Subsequent training uses the strongest cost-stressed, rewarded historical parent as a research seed, falling back to historical net profit for legacy records. Two of six strategy exploration slots remain available for other strategy families. XP is never a verified grade, a promised return, a PAPER account admission, or an authorization to place orders. Existing stored memory is append-only and cannot be silently backfilled.

## Five-minute schedule
The GitHub Actions scheduled training cron now proposes 12 cycles an hour rather than 2. Cron is best effort. Historical market snapshots refresh every six hours via a separate GET-only workflow. Per-chart experiment caps and deduplication mean some cycles legitimately do no evaluations; a scheduled run is not evidence of learning.

The trainer times only in-process strategy evaluation, emits evaluations/sec and total evaluations, counts newly saved lessons, new nonoverlapping training candles and provisional earned XP. No-result cycles do not write repeated website status commits; the Actions API still exposes successful and failed attempts. The monitoring page polls measured reports every 30 seconds and public Actions run status every two minutes, with unknown/error states.

## Out-of-sample meaning
The read-only report evaluates the frozen selected training model against the later 40%-80% of historical candles, which are excluded from the original 0%-40% training selection. It never reads the quarantined final 20%, modifies strategy-selection rewards, issues Teacher grades or interacts with brokers. A repeated identical window never produces new improvement; changed overlapping windows are explicitly descriptive, not independent proof.

## Checker and release
The new independent PR Checker tests reinforcement bounds, replay protection, historical and Academy regressions, scheduler alignment, monitor lineage, and absence of broker order capabilities. Source is in an isolated branch, not approved or released on main. Verify actual GitHub Actions results and first published measurements before describing this as a live deployed capability.
