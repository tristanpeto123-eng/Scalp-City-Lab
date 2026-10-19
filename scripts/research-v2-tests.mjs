import test from 'node:test';
import assert from 'node:assert/strict';
import {PAIRS} from '../strategy-validation-core.mjs';
import {V2_POLICY,makeFolds,proposeV2Candidates,evaluateV2Symbol,evaluateV2All} from './research-v2.mjs';

const now=Date.parse('2026-10-19T12:00:00Z'),len=5000;
const source={schema:'SCALP_RESEARCH_MEMORY_V1',policy:'GBP50-PROFIT2000-v2',experiments:[]};
const snapshots=Object.fromEntries(PAIRS.map((symbol,k)=>{
  const first=now-(len+2)*900000;
  const bars=Array.from({length:len},(_,i)=>{
    const o=100+k+0.012*i+2*Math.sin(i/18)+0.7*Math.cos(i/8);
    const c=100+k+0.012*(i+1)+2*Math.sin((i+1)/18)+0.7*Math.cos((i+1)/8);
    return {t:new Date(first+i*900000).toISOString(),o,c,
      h:Math.max(o,c)*1.001,l:Math.min(o,c)*.999,v:200+(i%13)};
  });
  return [symbol,{symbol,timeframe:'15Min',source:'ALPACA_KRAKEN_US_US-1',
    generatedAt:new Date(now).toISOString(),bars}];
}));

test('folds are disjoint and strictly before untouched final 20%',()=>{
 const plan=makeFolds(snapshots['BTC/USD']);
 assert.equal(plan.cut,4000);
 assert.equal(plan.folds.length,3);
 assert.equal(plan.totalCandles,5000);
 let previous=0;
 for(const fold of plan.folds){
   assert.equal(fold.from,previous);
   assert.ok(fold.to-fold.from>=1200);
   assert.ok(fold.last<plan.holdoutStart);
   previous=fold.to;
 }
 assert.equal(previous,plan.cut);
});
test('candidate search is deterministic, diverse and bounded by official strategy rules',()=>{
 const options={symbol:'BTC/USD',memory:source,snapshotHash:'abcdef',developmentEnd:now,limit:36};
 const a=proposeV2Candidates(options),b=proposeV2Candidates(options);
 assert.deepEqual(a,b);
 assert.equal(a.candidates.length,36);
 assert.equal(new Set(a.candidates.map(JSON.stringify)).size,36);
 assert.deepEqual(new Set(a.candidates.map(x=>x.family)),
  new Set(['ema_trend','rsi_reversion','channel_breakout']));
});
test('changing sealed future prices never affects candidate ranking',()=>{
 const base=snapshots['BTC/USD'],cut=makeFolds(base).cut;
 const changed={...base,bars:base.bars.map((bar,i)=>i<cut?bar:{
   ...bar,o:bar.o*1.5,c:bar.c*1.5,h:bar.h*1.5,l:bar.l*1.5
 })};
 const a=evaluateV2Symbol({snapshot:base,symbol:'BTC/USD',memory:source,now,limit:9});
 const b=evaluateV2Symbol({snapshot:changed,symbol:'BTC/USD',memory:source,now,limit:9});
 assert.deepEqual(a.allCandidateResults,b.allCandidateResults);
 assert.deepEqual(a.shortlisted,b.shortlisted);
 assert.equal(a.sealedHoldout.usedForSelection,false);
 assert.equal(a.teacherAdmission,false);
 assert.equal(a.brokerOrders,0);
});
test('threaded and serial ten-chart runs agree with zero orders or grades',async()=>{
 const args={memory:source,snapshots,now,limit:6};
 const a=await evaluateV2All({...args,workers:1});
 const b=await evaluateV2All({...args,workers:3});
 assert.equal(a.evaluatedCandidates,60);
 assert.equal(b.evaluatedCandidates,60);
 assert.equal(a.holdoutAccessedForSelection,false);
 assert.equal(b.admissionsIssued,0);
 assert.equal(b.paperOrders,0);
 assert.equal(b.liveOrders,0);
 assert.equal(b.verifiedForwardGrades,0);
 assert.deepEqual(a.symbols,b.symbols);
});
test('budget and missing markets fail closed',async()=>{
 assert.throws(()=>proposeV2Candidates({symbol:'BTC/USD',memory:source,
  snapshotHash:'a',developmentEnd:now,limit:500}),/budget/);
 await assert.rejects(evaluateV2All({memory:source,snapshots:{},now}),/ten charts/);
 assert.equal(V2_POLICY.reservedHoldout,0.20);
});

import {mergeVerifiedHistory} from './research-v2-archive.mjs';
test('archive preserves older bars and rejects altered overlapping OHLCV',()=>{
  const src=snapshots['BTC/USD'];
  const a={...src,bars:src.bars.slice(0,3600)};
  const b={...src,bars:src.bars.slice(1800)};
  const merged=mergeVerifiedHistory(a,b,now);
  assert.equal(merged.bars.length,len);
  const corruption={...b,bars:b.bars.map((x,i)=>i===100?{...x,v:x.v+1}:x)};
  assert.throws(()=>mergeVerifiedHistory(a,corruption,now),/mutation detected/);
});
test('historical gaps block archive ingestion',()=>{
  const s=snapshots['BTC/USD'];
  const old={...s,bars:s.bars.slice(0,1800)};
  const newer={...s,bars:s.bars.slice(2000)};
  assert.throws(()=>mergeVerifiedHistory(old,newer,now),/no common candles/);
});
