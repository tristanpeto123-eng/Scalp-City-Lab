import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chronologicalTrainingFolds,evaluateTrainingAcrossFolds} from './historical-training-folds.mjs';
const size=6000;
const bars=Array.from({length:size},(_,i)=>({
 t:new Date(Date.parse('2026-07-01T00:00:00Z')+i*900000).toISOString(),
 o:100,c:100,h:101,l:99,v:1
}));
const snapshot={symbol:'BTC/USD',timeframe:'15Min',source:'ALPACA_KRAKEN_US_US-1',bars};
test('three folds are chronological, disjoint and never reach unseen last 60%',()=>{
 const all=chronologicalTrainingFolds(snapshot);
 assert.equal(all.length,3);
 assert.equal(all[0].from,0);
 assert.equal(all[2].to,Math.floor(size*.4));
 for(let i=0;i<3;i++){
  assert.ok(all[i].source.bars.length>=480);
  assert.equal(all[i].source.bars[0],bars[all[i].from]);
  if(i)assert.equal(all[i-1].to,all[i].from);
 }
 assert.ok(all.every(f=>f.to<=2400&&f.source.bars.every(b=>Date.parse(b.t)<Date.parse(bars[2400].t))));
});
test('small source uses one honest disjoint fold, no fake independent windows',()=>{
 const small={...snapshot,bars:bars.slice(0,1500)};
 const result=chronologicalTrainingFolds(small);
 assert.equal(result.length,1);
 assert.equal(result[0].to,600);
});
test('aggregated historical reward is evidence-based, cost stress and losses included',()=>{
 let calls=0;
 const result=evaluateTrainingAcrossFolds({snapshot,symbol:'BTC/USD',config:{strategy:'rsi',strategyParams:{period:14,buyBelow:30,sellAbove:60}},
 simulate:({snapshot:ds,feePerSideFraction})=>{
  calls++;
  assert.ok(ds.bars.every(b=>Date.parse(b.t)<Date.parse(bars[2400].t)));
  return {realizedNetProfitGbp:feePerSideFraction===.005?2:3,
    closedTrades:20,wins:12,maxDrawdownPct:2};
 }});
 assert.equal(calls,6);
 assert.equal(result.closedTrades,60);
 assert.equal(result.wins,36);
 assert.equal(result.netGbp,9);
 assert.equal(result.stressNetGbp,6);
 assert.equal(result.winRatePct,60);
 assert.equal(result.robustness.windowCount,3);
 assert.equal(result.robustness.positiveWindows,3);
 assert.equal(result.robustness.independentForwardEvidence,false);
 assert.ok(result.trainingScore>0);
});
test('normal profit with negative fee stress cannot be a robust parent',()=>{
 const result=evaluateTrainingAcrossFolds({snapshot,symbol:'BTC/USD',config:{strategy:'ema'},
 simulate:({feePerSideFraction})=>({realizedNetProfitGbp:feePerSideFraction===.005?-2:2,
 closedTrades:18,wins:10,maxDrawdownPct:2})});
 assert.equal(result.trainingScore,null);
 assert.equal(result.robustness.stressPositiveWindows,0);
});
test('malformed folds and invalid simulations fail closed',()=>{
 assert.throws(()=>chronologicalTrainingFolds({...snapshot,bars:bars.slice(0,600)}),/insufficient/);
 assert.throws(()=>evaluateTrainingAcrossFolds({snapshot,symbol:'BTC/USD',config:{strategy:'ema'},
 simulate:()=>({realizedNetProfitGbp:NaN,closedTrades:10,wins:10,maxDrawdownPct:0})}),/malformed/);
});
