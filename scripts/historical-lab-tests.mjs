import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalLab,evaluateHistoricalPupil,developmentFolds} from './historical-lab.mjs';
import {PAIRS} from '../strategy-validation-core.mjs';
const now=Date.parse('2026-10-18T15:30:00Z'),begin=now-5000*900000-900000;
const snapshots=Object.fromEntries(PAIRS.map((symbol,index)=>{
 const bars=Array.from({length:5000},(_,i)=>{
  const o=100+index+Math.sin(i/17)*2+i*0.0005,c=100+index+Math.sin((i+1)/17)*2+i*0.0005;
  return {t:new Date(begin+i*900000).toISOString(),o,c,h:Math.max(o,c)*1.001,
    l:Math.min(o,c)*.999,v:12+(i%5)};
 });
 return [symbol,{symbol,bars,timeframe:'15Min',source:'ALPACA_KRAKEN_US_US-1',
   generatedAt:new Date(now-60000).toISOString()}];
}));
const model={schema:'SCALP_RESEARCH_MEMORY_V1',policy:'GBP50-PROFIT2000-v2',
 experiments:PAIRS.map((symbol,i)=>({
   id:String(i+1).padStart(64,'a'),symbol,feed:'us-1',
   trainFingerprint:'f'.repeat(64),trainingStart:'2026-08-01T00:00:00Z',
   trainingEnd:'2026-08-15T00:00:00Z',acceptedForLearning:true,
   trainingOptions:[{params:{family:'rsi_reversion',period:14,buyBelow:30,sellAbove:60},
     closedTrades:24,netProfitGbp:-1,winRatePct:42,trainingScore:null}]
 }))};
test('historical development folds never overlap quarantined final 20 percent',()=>{
 const bars=snapshots['BTC/USD'].bars;
 const layout=developmentFolds(bars);
 assert.ok(layout.folds.length>=3);
 for(const fold of layout.folds){
   assert.ok(fold.endIndex<=layout.sealedHoldoutStart);
   assert.ok(Date.parse(fold.lastBar)<Date.parse(bars[layout.sealedHoldoutStart].t));
 }
 assert.equal(layout.reservedCandles,1000);
});
test('ten markets run offline, never place orders, and publish research only',()=>{
 const report=historicalLab({snapshots,memory:model,now});
 assert.equal(report.tenPupils,10);
 assert.equal(report.admissionCount,0);
 assert.equal(report.verifiedForwardGrades,0);
 assert.equal(report.brokerOrders,0);
 assert.equal(report.quarantinedHoldoutNotScored,true);
 for(const pupil of report.pupils){
   assert.equal(pupil.officialGrade,null);
   assert.equal(pupil.orders,0);
   assert.equal(pupil.modelPromotion,false);
   assert.ok(pupil.candidatesEvaluated>=1);
   assert.equal(pupil.heldOutQuarantine.usedForModelSelection,false);
   assert.ok(Date.parse(pupil.developmentWindow.end)<=Date.parse(pupil.heldOutQuarantine.start));
 }
});
test('changing quarantined future candles does not affect ranked development candidates',()=>{
 const original=snapshots['BTC/USD'];
 const holdoutStart=developmentFolds(original.bars).sealedHoldoutStart;
 const manipulated={...original,bars:original.bars.map((b,i)=>i<holdoutStart?b:{
   ...b,o:b.o*1.5,c:b.c*1.5,h:b.h*1.5,l:b.l*1.5
 })};
 const a=evaluateHistoricalPupil({snapshot:original,memory:model,symbol:'BTC/USD',now});
 const b=evaluateHistoricalPupil({snapshot:manipulated,memory:model,symbol:'BTC/USD',now});
 assert.deepEqual(a.bestResearchCandidate,b.bestResearchCandidate);
 assert.equal(a.developmentFoldCount,b.developmentFoldCount);
});
test('short or malformed historical inputs fail closed',()=>{
 assert.throws(()=>developmentFolds([]),/insufficient historic/);
 const invalid={...snapshots['BTC/USD'],bars:snapshots['BTC/USD'].bars.slice(0,2000)};
 assert.throws(()=>evaluateHistoricalPupil({snapshot:invalid,memory:model,symbol:'BTC/USD',now}),
   /insufficient training-only/);
});
