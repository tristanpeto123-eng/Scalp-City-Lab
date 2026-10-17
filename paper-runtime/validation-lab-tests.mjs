import assert from 'node:assert/strict';
import {checkValidationInput,runHistoricalValidation} from './validation-lab.mjs';
import {STRATEGY_GRID} from './signal-policies.mjs';
import {TRIAL_RULES} from './trial-profit.mjs';
let n=0;
const start=Date.parse('2026-04-01T00:00:00Z');
let prev=100;
const raw=Array.from({length:3000},(_,i)=>{
 const o=prev,c=110+12*Math.sin(i/7)+3*Math.cos(i/41);prev=c;
 return {t:new Date(start+i*900000).toISOString(),o,
  h:Math.max(o,c)*1.002,l:Math.min(o,c)*.998,c,v:500+i%20};
});
const lastClosed=start+(raw.length+3)*900000;
const fiveDays={symbol:'BTC/USD',feed:'us-1',mode:'DURATION',durationDays:5,
 startingBalanceGbp:200,historyDays:90};
assert.deepEqual(checkValidationInput(fiveDays),fiveDays);n++;
assert.throws(()=>checkValidationInput({...fiveDays,startingBalanceGbp:49}),/GBP50/);n++;
assert.throws(()=>checkValidationInput({...fiveDays,startingBalanceGbp:NaN}),/GBP50/);n++;
assert.throws(()=>checkValidationInput({...fiveDays,durationDays:0}),/Duration/);n++;
assert.throws(()=>checkValidationInput({...fiveDays,durationDays:220}),/Duration/);n++;
assert.throws(()=>checkValidationInput({...fiveDays,symbol:'DOGE/EUR'}),/supported USD pair/);n++;
assert.throws(()=>checkValidationInput({...fiveDays,historyDays:366}),/30-365/);n++;
assert.throws(()=>checkValidationInput({...fiveDays,mode:'PROFIT',targetNetProfitGbp:-1}),/positive/);n++;
const duration=runHistoricalValidation({input:fiveDays,raw,closedBefore:lastClosed});
assert.equal(duration.mode,'HISTORICAL_VALIDATION_REPLAY');n++;
assert.equal(duration.startingBalanceGbp,200);n++;
assert.equal(duration.rule.kind,'DURATION');n++;
assert.equal(duration.rule.days,5);n++;
assert.equal(duration.stopReason,'DURATION_REACHED');n++;
assert.equal(duration.daysSimulated,5);n++;
assert.equal(duration.candleCount,480);n++;
assert.equal(duration.actualPaperOrders,0);n++;
assert.equal(duration.realMoneyOrders,0);n++;
assert.equal(duration.withdrawableGbp,0);n++;
assert.equal(duration.frozenStrategy.calibrationTrainingCandidates,16);n++;
assert.ok(['RESEARCH_EVALUATED','DIAGNOSTIC_ONLY_REJECTED_CALIBRATION'].includes(duration.status));n++;
assert.ok(STRATEGY_GRID.some(p=>p.family===duration.frozenStrategy.parameters.family));n++;
assert.ok(duration.closedTrades>=0);n++;
assert.equal(Number((duration.virtualEndingBalanceGbp-200).toFixed(8)),
 Number(duration.realisedCumulativeNetProfitGbp.toFixed(8)));n++;
assert.equal(duration.observed80PctGoalMet,duration.closedTrades>0&&duration.observedWinRatePct>=80);n++;
assert.equal(duration.openPositionExcludedFromRealizedProfit,typeof duration.openPositionExcludedFromRealizedProfit==='boolean');n++;
const hash2=runHistoricalValidation({input:fiveDays,raw,closedBefore:lastClosed});
assert.deepEqual(hash2,duration);n++;
const futureModified=raw.map((x,i)=>i<1200?x:{...x,o:x.o*.9,
 h:x.h*1.6,l:x.l*.5,c:x.c*1.1});
const futureResult=runHistoricalValidation({input:fiveDays,raw:futureModified,closedBefore:lastClosed});
assert.deepEqual(futureResult.frozenStrategy,duration.frozenStrategy);n++;
assert.equal(futureResult.calibrationEnd,duration.calibrationEnd);n++;
assert.notEqual(futureResult.historicalDatasetHash,duration.historicalDatasetHash);n++;
const profitInput={...fiveDays,mode:'PROFIT',targetNetProfitGbp:2000};
const profitRun=runHistoricalValidation({input:profitInput,raw,closedBefore:lastClosed});
assert.equal(profitRun.rule.kind,'PROFIT');n++;
assert.equal(profitRun.rule.cumulativeNetGbp,2000);n++;
assert.equal(profitRun.stopReason,'DATA_END');n++;
assert.equal(profitRun.goalReached,false);n++;
assert.equal(profitRun.daysSimulated,18.75);n++;
assert.equal(profitRun.startingBalanceGbp,200);n++;
assert.equal(profitRun.withdrawableGbp,0);n++;
assert.throws(()=>runHistoricalValidation({input:{...fiveDays,durationDays:19},raw,closedBefore:lastClosed}),
 /exceeds unseen historical evaluation window/);n++;
assert.throws(()=>runHistoricalValidation({input:fiveDays,raw,closedBefore:start+2000*900000}),
 /not finalized/);n++;
const duplicate=raw.map(x=>({...x}));duplicate[123].t=duplicate[122].t;
assert.throws(()=>runHistoricalValidation({input:fiveDays,raw:duplicate,closedBefore:lastClosed}),
 /unsorted/);n++;
assert.equal(TRIAL_RULES.startingBalanceGbp,50);n++;
console.log('PASS '+n+' user-set GBP deposit + DURATION/PROFIT real historical validation, frozen model and zero brokerage orders');
