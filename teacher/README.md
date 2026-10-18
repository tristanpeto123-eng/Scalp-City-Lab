# Robot Academy — TEACHER-01 (review candidate)
Release: ACADEMY-TEACHER-0.1.0-rc1. State: NOT APPROVED, NOT DEPLOYED.
Execution: PAPER ONLY Alpaca crypto, OFF by default. No live-money URL, execution route or deposits.

## Examination workflow
1. Research -> Inspector: select frozen best per-pair historical candidate by net return, not win-rate alone. Only positive net strategies with 30+ historical closes can attempt independent chronological holdout.
2. Independent Validator -> Teacher admission: require a REAL, independently computed and reviewed sealed holdout with 30+ closed trades, positive after-cost GBP net and 2x cost GBP net, drawdown <=8%, no overlapping time with model training, and a parameter hash. Engine gates readiness and freezes a model hash. JSON alone is not proof: trusted independent validation and operator review remain TODO.
3. Teacher -> Forward Paper: independent dedicated Alpaca paper account per pupil; no public browser credentials. Consumes only fresh completed 15-minute crypto candles AFTER admission. Model is fixed through the exam. One long-only position, no leverage, shorts, external/manual positions, stale bars, or overlapping orders.
4. US$50 virtual exam bankroll per pupil; max US$10 notional paper buy, broker minimum size and precision enforced. Close-of-candle 2% stop, 1% paper account daily-loss veto, 10% peak drawdown veto. Stop is not guaranteed due to latency and gaps. IOC markets may not fill. Minimum BTC trade size can make US$10 insufficient; blocks rather than violating caps.
5. Paper order writes require exact owner approval of ACADEMY-TEACHER-0.1.0-rc1 and TEACHER_PAPER_ENABLED=true on a private persistent host. No paper orders ever executed by CI.
6. Exam scorer: demands authenticated reconciled broker fill roundtrips, published complete crypto fees (including delayed CFEE), independent GBP conversion, no exposure or outside orders, 30+ unique forward closes. Grade is floor(win rate/10), independent of profitability. Qualification ALSO needs positive net GBP and <=10% drawdown. Neither status permits automatic live trading. championModel always null.

## Critical missing integrations
- A genuine independently run holdout auditor and reviewed admission generator; no self-authored audit is acceptable.
- Complete broker fill/order/partial-execution/crypto-fee reconciliation, replay-safe evidence ledger, and timely CFEE settlement.
- Independent dated USD-to-GBP FX provider and authenticated server-issued Academy forward-grade feed.
- Persistent hosting, startup recovery for ambiguous POST outcomes, incident handling for outstanding paper orders, operator circuit breaker, observability, owner approval.
- Present historical classroom does not recognize generated JSON as verified evidence.
- Current ten pupils have negative historical research net. NONE ready. One prior crypto paper account preflight was confirmed, not ten distinct account keys.

Private host: TEACHER_PRIVATE_DIR points to a private absolute directory with reviewed admissions.json and journal. TEACHER_PAPER_CREDENTIALS_JSON is a private environment variable mapping each pupil symbol to unique paper account keys. node teacher/runtime.mjs performs dry-run by default. No credentials in GitHub, ChatGPT, browser or committed files.

This is a Teacher PAPER execution release candidate, not an actively trading teacher or a published verified grade.
