import assert from 'node:assert/strict';
import {validateEvidence,planSession,PLANNER_VERSION} from './deposit-goal-planner.mjs';
import {TRIAL_RULES} from './trial-profit.mjs';
let n=0;
assert.equal(PLANNER_VERSION,'SCALP_PLANNER_PAPER_V1');n++;
assert.equal(TRIAL_RULES.startingBalanceGbp,50);n++;
assert.throws(()=>planSession({depositGbp:49,mode:'WAIT_DURATION',durationDays:14}),/at least £50/);n++;
assert.throws(()=>planSession({depositGbp:50,mode:'ALL_OR_NOTHING'}),/Choose/);n++;
assert.throws(()=>planSession({depositGbp:50,mode:'WAIT_DURATION',durationDays:0}),/duration/);n++;
assert.throws(()=>planSession({depositGbp:50,mode:'TARGET_PROFIT',targetNetProfitGbp:0}),/target/);n++;
const absent=planSession({depositGbp:50,mode:'TARGET_PROFIT',targetNetProfitGbp:2000},null);
assert.equal(absent.status,'ESTIMATE_UNAVAILABLE');n++;
assert.equal(absent.estimatedWaitDays,null);n++;
assert.equal(absent.withdrawalAvailable,false);n++;
assert.equal(absent.canTradeRealFunds,false);n++;
assert.equal(absent.probabilityOfTargetPct,null);n++;
let start=Date.parse('2025-01-01T00:00:00Z'),days=[];
for(let i=0;i<96;i++){
 days.push({date:new Date(start+i*86400000).toISOString().slice(0,10),
   netReturn:i%6===0?-.02:i%3===0?-.01:.012,closedTrades:1});
}
const makeWindow=(i)=>({modelId:'CHART_BTCUSD',
 start:days[i*32].date,end:days[i*32+31].date,
 source:'HISTORICAL_FROZEN_REPLAY',days:days.slice(i*32,(i+1)*32)});
const evidence={policy:TRIAL_RULES.version,windows:[makeWindow(0),makeWindow(1),makeWindow(2)]};
const check=validateEvidence(evidence);
assert.equal(check.ok,true);n++;
assert.equal(check.days,96);n++;
assert.equal(check.windows,3);n++;
assert.equal(check.trades,96);n++;
const duration=planSession({depositGbp:50,mode:'WAIT_DURATION',durationDays:100},evidence);
assert.equal(duration.status,'SCENARIO_ESTIMATE_ONLY');n++;
assert.equal(duration.durationDays,100);n++;
assert.equal(duration.estimatedWaitDays,null);n++;
assert.ok(duration.projectedBalanceGbp.pessimisticP10<=duration.projectedBalanceGbp.medianP50);n++;
assert.ok(duration.projectedBalanceGbp.medianP50<=duration.projectedBalanceGbp.optimisticP90);n++;
assert.equal(duration.projectedCumulativeProfitGbp.medianP50,duration.estimatedProfitGbp.medianP50);n++;
assert.equal(duration.withdrawalAvailable,false);n++;
assert.equal(duration.payoutGuaranteed,false);n++;
assert.equal(duration.hasWithdrawableBalance,false);n++;
const same=planSession({depositGbp:50,mode:'WAIT_DURATION',durationDays:100},evidence);
assert.deepEqual(same,duration);n++;
const target=planSession({depositGbp:50,mode:'TARGET_PROFIT',targetNetProfitGbp:2000},
 evidence,{maxDays:180});
assert.equal(target.targetNetProfitGbp,2000);n++;
assert.equal(target.horizonDays,180);n++;
assert.ok(target.probabilityOfTargetPct>=0&&target.probabilityOfTargetPct<=100);n++;
assert.ok(target.estimatedWaitDays===null||target.estimatedWaitDays>=1);n++;
const negative={...evidence,windows:evidence.windows.map(w=>({
 ...w,days:w.days.map(d=>({...d,netReturn:-.01}))
}))};
const noPromise=planSession({depositGbp:50,mode:'TARGET_PROFIT',targetNetProfitGbp:2000},negative,{maxDays:60});
assert.equal(noPromise.probabilityOfTargetPct,0);n++;
assert.equal(noPromise.estimatedWaitDays,null);n++;
assert.equal(noPromise.noReliableETA,true);n++;
assert.ok(noPromise.probabilityOfLossPct>99);n++;
assert.equal(noPromise.payoutGuaranteed,false);n++;
const overlapping={...evidence,windows:[makeWindow(0),makeWindow(0),makeWindow(2)]};
assert.equal(validateEvidence(overlapping).reason,'DUPLICATE_OR_OVERLAPPING_EVALUATION_DAYS');n++;
assert.equal(planSession({depositGbp:50,mode:'WAIT_DURATION',durationDays:30},overlapping).status,
 'ESTIMATE_UNAVAILABLE');n++;
const oneWin={...evidence,windows:evidence.windows.map(w=>({...w,
 days:w.days.map(x=>({...x,netReturn:.1}))}))};
assert.equal(validateEvidence(oneWin).reason,'INSUFFICIENT_LOSS_OBSERVATIONS');n++;
const tooShort={...evidence,windows:[makeWindow(0)]};
assert.equal(validateEvidence(tooShort).reason,'INSUFFICIENT_INDEPENDENT_EVALUATION');n++;
const wrongPolicy={...evidence,policy:'PREVIOUS_3R'};
assert.equal(validateEvidence(wrongPolicy).ok,false);n++;
const invalid={...evidence,windows:evidence.windows.map((w,i)=>i===0?{
 ...w,days:w.days.map((d,j)=>j===2?{...d,netReturn:-1}:d)}:w)};
assert.equal(validateEvidence(invalid).reason,'INVALID_DAILY_RETURN_EVIDENCE');n++;
console.log('PASS '+n+' deposit/duration/profit probabilistic scenario and explicit no-guarantee tests');
