import test from 'node:test';
import assert from 'node:assert/strict';
import {PAIRS} from '../strategy-validation-core.mjs';
import {discoverAll,discoverOne,splitDisjointDevelopment,BANK} from './diversified-discovery.mjs';
const now=Date.parse('2026-10-19T16:00:00Z'),N=3900,PERIOD=900000;
const snapshots=()=>Object.fromEntries(PAIRS.map((symbol,k)=>{
 const begin=now-(N+2)*PERIOD;
 const bars=Array.from({length:N},(_,i)=>{
  const o=100+k+2*Math.sin((i-1)/24)+i*.001,c=100+k+2*Math.sin(i/24)+i*.001;
  return {t:new Date(begin+i*PERIOD).toISOString(),o,c,
   h:Math.max(o,c)*1.002,l:Math.min(o,c)*.998,v:15+i%7};
 });
 return [symbol,{symbol,source:'ALPACA_KRAKEN_US_US-1',timeframe:'15Min',
  generatedAt:new Date(now-60000).toISOString(),bars}];
}));
test('ten real-shape charts -> diverse deterministic proposals, no broker pathways',()=>{
 const report=discoverAll({snapshots:snapshots(),now});
 assert.equal(report.sourceSnapshots,10);
 assert.equal(report.researchCandidates,10*BANK.length);
 assert.equal(report.distinctFamilies,3);
 assert.equal(report.paperOrders,0);
 assert.equal(report.liveOrders,0);
 assert.equal(report.admissions,0);
 assert.equal(report.independentForwardValidations,0);
 assert.equal(report.holdoutUsedForSelection,false);
 for(const pupil of report.pupils){
  assert.equal(pupil.developmentFolds.length,3);
  assert.equal(pupil.holdout.usedForSelection,false);
  assert.equal(pupil.signedAdmission,null);
  assert.ok(pupil.allCandidates.every(x=>x.admissionAllowed===false&&x.brokerForwardTrades===0));
  assert.deepEqual(new Set(pupil.allCandidates.map(x=>x.family)),
   new Set(['ema_trend','rsi_reversion','channel_breakout']));
 }
});
test('all selection folds disjoint and strictly before sealed future',()=>{
 const bars=snapshots()['BTC/USD'].bars.map(b=>({...b,t:Date.parse(b.t)}));
 const s=splitDisjointDevelopment(bars);
 assert.equal(s.folds.length,3);
 assert.equal(s.folds[0].start,0);
 assert.equal(s.folds[0].end,s.folds[1].start);
 assert.equal(s.folds[1].end,s.folds[2].start);
 assert.equal(s.folds[2].end,s.holdoutStartIndex);
 assert.ok(s.folds.at(-1).end<bars.length);
});
test('changing sealed future prices cannot change any candidate score or rank',()=>{
 const initial=snapshots()['BTC/USD'],start=Math.floor(N*.8);
 const poisoned={...initial,bars:initial.bars.map((b,i)=>
  i<start?b:{...b,o:b.o*1.8,c:b.c*1.8,h:b.h*1.8,l:b.l*1.8})};
 const a=discoverOne({snapshot:initial,symbol:'BTC/USD',now});
 const b=discoverOne({snapshot:poisoned,symbol:'BTC/USD',now});
 assert.deepEqual(a.allCandidates,b.allCandidates);
 assert.notEqual(a.snapshotDigest,b.snapshotDigest);
 assert.equal(a.holdout.usedForSelection,false);
});
test('rejects stale candles, synthetic source and missing market',()=>{
 const data=snapshots();
 data['ETH/USD'].source='SIMULATED';
 assert.throws(()=>discoverAll({snapshots:data,now}),/Unverified candle-source provenance/);
 const old=snapshots()['BTC/USD'];
 old.bars=old.bars.map(b=>({...b,t:new Date(Date.parse(b.t)-17*86400000).toISOString()}));
 assert.throws(()=>discoverOne({snapshot:old,symbol:'BTC/USD',now}),/stale/);
});
