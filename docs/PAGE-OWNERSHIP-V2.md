# Scalp City — page ownership and duplicate-retirement contract
Status: IMPLEMENTED NAVIGATION ON REVIEW BRANCH; NOT RELEASED. 24 October 2026.

## Six primary destinations
1. **Command** (\`mission-control.html\`): CEO overview, status and alerts, links to stages. No strategy editing or broker-order buttons.
2. **Research** (\`strategy-validation.html\`): historical datasets, hypotheses, backtest development and method comparison. Sub-tools: \`sl-strategy.html\` (SL memory/model and loop); \`index.html\` (legacy QQQ/SPY/IWM research workstation, preserved until its unique controls have migrated).
3. **Academy** (\`robot-academy.html\`): student catalogue, models and training outcomes. Sub-tools: \`student-progress.html\`, \`universal-student.html\`, \`training-monitor.html\`, \`market-replay-5m.html\`, \`robot-observer.html\`, \`neo-lab.html\`. Tool URLs remain working so no checkpoint/journal needs migration for this release.
4. **Teacher** (\`teacher-console.html\`): authoritative independent historical screen, qualification and forward examination evidence. Single *visible* historical-screen detail panel.
5. **Trading** (\`trading-floor.html\`): execution supervision, signed result states and explicit synthetic demonstrations. Retains the existing read-only historical-screen event consumer, but no repeated full-screen screening panel.
6. **3D City** (\`agent-city.html\`): spatial agent navigation and station inspection. Navigation is display-only and cannot authorize any agent action.

## Rules implemented
- \`journey-nav.js\` injects one six-area navigator, with owner-specific tool links, on all 14 existing HTML pages.
- Old header cross-page navs are *visually retired*, not deleted from source until browser regression verification; internal tool controls and the 3D station rail remain untouched.
- A detailed repeated historical-screen panel is visually retired on Research, Academy and Trading; the canonical Teacher report remains visible. A short link takes the user to Teacher instead.
- The PWA launch URL is Command. Direct \`index.html\` still runs the original simulated workstation; its functionality must not be deleted until its remaining unique tools migrate and pass tests.
- All research, broker, storage, data, trading and model code stays unchanged in this first UI consolidation. No claims of actual paper grades, successful returns or live execution are introduced.

## Next consolidation gates (not yet implemented)
- Replace the legacy index workstation with Research-owned modules after comparing all unique RUN / DATA / MEM / EXIT behaviors and stored histories.
- Migrate Academy presentation from ten crypto-pair research cards to the agreed persistent market students (Commodities, Forex, Indices first; Equities and Crypto later) **without deleting original crypto model histories**. Universal student/model-source capability must remain separate from verified qualifications.
- Centralize repeated summary widgets to shared read-only components, while preserving source-verification contracts and individual historical studies.
- Reconcile outstanding PR #40 (selected-pupil continuity) before release; do not overwrite its unmerged changes.
- Verify on iPhone and desktop: navigation, back/forward, 3D controls, student progress, SL persistence, source status, teacher audit, synthetic trading controls; execute CI and Checker gates.
- Remove retired header markup and orphan CSS only after feature parity and evidence-source checks.

## Rollback / scope
UI-only branch, no main deployment, no automatic PR merge, no broker interactions. Changes are revertible and the complete old screens remain in Git history.
