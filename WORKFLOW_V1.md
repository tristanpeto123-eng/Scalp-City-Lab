# Scalp City — Agent Workflow v1.0 (design contract, not all implemented)

## Directed pipeline
Operator -> Bot Manager -> Data Curator -> Researcher -> Strategy Designer -> Optimizer -> Backtester -> Independent Validator -> Independent Scorer -> Risk Manager -> Paper Trader -> Journal -> Vault.

Feedback: Backtester -> Optimizer (training-only); Validator/Scorer rejection -> Researcher (creates new version); Journal/Vault -> Researcher (historical evidence, never approval bypass); Vault -> 3D City (visualization only).

## Agent permissions
| Role | Allowed | Forbidden |
| --- | --- | --- |
| Data Curator | Ingest, normalize, version data | Overwrite immutable datasets silently |
| Researcher | Formulate hypotheses, read rejected test evidence | Approve or execute own hypotheses |
| Strategy Designer | Generate reproducible rule sets | Grant deployment approval |
| Optimizer | Tune using training folds only | Inspect sealed holdout during tuning |
| Backtester BT-01 | Simulate frozen strategies and publish reports | Trade real money; validate/approve own report |
| Validator | Run independent out-of-sample and leakage tests | Rewrite strategy being validated |
| Scorer | Rank independently validated candidates | Bypass validation and risk veto |
| Risk Manager | Check limits, deny orders, halt paper execution | Be overridden by Bot Manager or Optimizer |
| Paper Trader | Simulate approved trades under current risk allowance | Use broker API or live credentials |
| Journal / Vault | Append versioned provenance and outcomes | Mutate historic approvals or promote candidates |
| Bot Manager | Dispatch, schedule, observe | Modify approval decisions or lift veto |
| 3D City | Visualize agent status and evidence | Act as independent authorization mechanism |

## Approval chain
1. Each candidate carries a deterministic strategy and parameter hash plus dataset version and experiment ID.
2. Once submitted for independent validation, candidate parameters are frozen; any change creates a new candidate requiring new approval.
3. Validator checks data leakage, chronological out-of-sample, walk-forward stability, costs, minimum trade count and failure modes.
4. Scorer only ranks candidates that pass validation; a passing score is not a deployment approval by itself.
5. Risk Manager checks sizing, exposure, limits and feed health at each simulated order; its veto is final.
6. Paper Trader operates only in an isolated simulated environment. Live brokerage connectivity is not part of Lab.
7. Every decision is attributable, immutable and visible to the user. Missing evidence means DENY.

## Standard message schema
Every message includes `protocol`, `messageId`, `agentId`, `taskId`, `strategyId`, `strategyVersionHash`, `datasetVersion`, `timestamp`, `type` and `payload`; approval events also include `approverRole` and an evidence hash. The eventual backend must authenticate senders and enforce the permission checks on the server, not rely solely on browser events.

## Ten target acceptance tests (future multi-agent release gate)
1. Designer cannot approve itself.
2. Backtester cannot validate its own results.
3. Scorer cannot rank unvalidated work as approved.
4. Optimizer cannot read sealed holdout dataset.
5. Modified strategy invalidates all old approvals.
6. Missing/outdated data prevents new paper orders.
7. Risk veto cannot be overridden by Bot Manager.
8. Failed candidate is versioned before a new trial.
9. Journal entries cannot be silently rewritten.
10. Lab has no real-money execution path, and no automatic promotion to stable.

**Current implementation:** existing browser training workers and BT-01 on-demand backtester are prototypes. Independent Validator, Scorer, Risk Manager and Paper Trader are future implementation work. These principles are specifications, not a claim that runtime controls already exist.
