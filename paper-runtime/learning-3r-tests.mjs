import assert from 'node:assert/strict';
import {R3,terms,simulate3R,optimize3R,validate3R,audit3RTrades} from './learning-3r.mjs';
let n=0;
const sym='BTC/USD';
const makeBars=(length=240)=>{
 let previous=100;
 return Array.from({length},(_,i)=>{
  const o=previous;
  const c=100+22*Math.sin(i/6);
  previous=c;
  return {t:Date.parse('2026-10-01T00:00:00Z')+i*900000,
   o,h:Math.max(o,c)*1.001,l:Math.min(o,c)*.999,c,v:1000};
 });
};
const bars=makeBars(),params=[{fast:6,slow:26},{fast:9,slow:34},{fast:12,slow:48}];
assert.equal(R3.virtualInitialGbp,50);n++;
assert.equal(R3.rewardToRisk,3);n++;
for(const symbol of ['SPY','BTC/USD']){
 const p=terms(symbol,100);
 assert.ok(p.plannedRisk<=0.5+1e-9);n++;
 assert.ok(Math.abs(p.plannedReward/p.plannedRisk-3)<1e-9);n++;
 assert.ok(p.notional<=25);n++;
}
const training=optimize3R(bars,params,sym);
assert.equal(training.cut,180);n++;
assert.equal(training.selectionBasis,'TRAIN_3R_ONLY');n++;
assert.equal(training.sealedHoldout[0],180);n++;
assert.equal(training.trainingOptions.length,3);n++;
assert.ok(training.trainingOptions.every(x=>Number.isInteger(x.trainingClosedTrades)));n++;
assert.ok(training.candidate?.params?.slow>training.candidate?.params?.fast);n++;
// Alter all unseen prices without touching the train slice. Selection stays
// identical even if the holdout becomes astronomically profitable or disastrous.
const mutated=bars.map((x,i)=>i<training.cut?{...x}:{
 ...x,o:x.o*(i%2?1.4:.65),h:x.h*2,l:x.l*.45,c:x.c*(i%2?1.4:.65)});
const trainingAfterMutation=optimize3R(mutated,params,sym);
assert.deepEqual(training.candidate.params,trainingAfterMutation.candidate.params);n++;
assert.deepEqual(training.trainingOptions,trainingAfterMutation.trainingOptions);n++;
// An independent cold historical held-out evaluation never authorizes
// forward-trade performance or order placement, even if it passes.
const holdout=validate3R(bars,training,sym);
assert.ok(['BLOCKED','AUDIT_PASS'].includes(holdout.verdict));n++;
assert.equal(holdout.scope.includes('not independent future 61-trade'),true);n++;
assert.equal(holdout.trainingSelectionOnly,true);n++;
const sim=simulate3R(bars,params[0],{symbol:sym,start:60,end:180});
assert.equal(sim.segment[0],60);n++;
assert.equal(sim.segment[1],180);n++;
assert.ok(sim.trades.every(t=>t.entryIndex>=60&&t.exitIndex<180));n++;
assert.ok(sim.trades.every(t=>Math.abs(t.plannedRewardGbp/t.plannedRiskGbp-3)<1e-8));n++;
assert.ok(sim.trades.every(t=>t.notionalGbp<=25+.0001));n++;
assert.equal(audit3RTrades(sim,bars).matched,true);n++;
assert.ok(sim.trades.length>0,'Must exercise independent trades audit');n++;
const corrupt=structuredClone(sim);corrupt.trades[0].pnlGbp+=.02;
assert.throws(()=>audit3RTrades(corrupt,bars),/P&L mismatch/);n++;
const bad=structuredClone(sim);bad.trades[0].entryPrice+=5;
assert.throws(()=>audit3RTrades(bad,bars),/entry/);n++;
const noSample=optimize3R(Array.from({length:240},(_,i)=>({
 t:Date.parse('2026-10-01T00:00:00Z')+i*900000,o:100,h:100.1,l:99.9,c:100,v:100})),params,sym);
assert.equal(noSample.trainingEligible,false);n++;
const fail=validate3R(Array.from({length:240},(_,i)=>({
 t:Date.parse('2026-10-01T00:00:00Z')+i*900000,o:100,h:100.1,l:99.9,c:100,v:100})),noSample,sym);
assert.equal(fail.verdict,'BLOCKED');n++;
assert.ok(fail.reasons.some(x=>x.includes('No eligible')));n++;
assert.throws(()=>terms('DOGE/USD',100),/Invalid/);n++;
assert.throws(()=>simulate3R(bars,params[0],{symbol:'DOGE/USD'}),/Invalid/);n++;
const gapped=structuredClone(bars);gapped[50].l=gapped[50].h+1;
assert.throws(()=>simulate3R(gapped,params[0],{symbol:sym}),/Invalid/);n++;
console.log('PASS '+n+' strategy 3R train-only / independent holdout tests; NO Alpaca paper orders');
