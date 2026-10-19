import test from 'node:test';
import assert from 'node:assert/strict';
import {PAIRS} from '../strategy-validation-core.mjs';
import {integratedResearchReview} from './integrated-research-review.mjs';
const now=Date.parse('2026-10-19T16:00:00Z'),PERIOD=900000,N=3200;
const fx=Object.freeze({source:'FRANKFURTER_ECB_REFERENCE',date:'2026-10-19',gbpPerUsd:.74});
const emptyMemory=()=>({schema:'SCALP_RESEARCH_MEMORY_V1',
  policy:'GBP50-PROFIT2000-v2',experiments:[]});
const snapshots=()=>Object.fromEntries(PAIRS.map((symbol,k)=>{
 const start=now-(N+2)*PERIOD;
 const bars=Array.from({length:N},(_,i)=>{
  const c=100+k+1.6*Math.sin(i/10)+i*.0008;
  const o=100+k+1.6*Math.sin((i-1)/10)+(i-1)*.0008;
  return {t:new Date(start+i*PERIOD).toISOString(),o,c,
    h:Math.max(o,c)*1.002,l:Math.min(o,c)*.998,v:10+(i%5)};
 });
 return [symbol,{symbol,source:'ALPACA_KRAKEN_US_US-1',timeframe:'15Min',
  generatedAt:new Date(now-60000).toISOString(),bars}];
}));
test('integrates ten source charts through trainer, frozen Academy, independent Teacher and report with no orders',async()=>{
 const memory=emptyMemory(),data=snapshots(),before=JSON.stringify(memory);
 const out=await integratedResearchReview({memory,snapshots:data,fx,now});
 assert.equal(JSON.stringify(memory),before,'source memory must not be rewritten');
 assert.equal(out.report.researchSymbols,10);
 assert.equal(out.report.pupils.length,10);
 assert.equal(out.report.researchExperimentsAdded,10);
 assert.equal(out.report.controls.paperOrders,0);
 assert.equal(out.report.controls.liveOrders,0);
 assert.equal(out.report.controls.admissions,0);
 assert.equal(out.report.controls.verifiedForwardGrades,0);
 assert.equal(out.qualification.admissionsIssued,0);
 assert.equal(out.academy.verifiedForwardGrades,0);
 assert.equal(out.academy.actualBrokerOrders,0);
 assert.equal(out.development.quarantinedHoldoutNotScored,true);
 assert.equal(out.report.academyCandidateSha256,
   out.report.independentQualificationAcademySha256);
 for(const row of out.report.pupils){
  assert.equal(row.brokerGrade,null);
  assert.equal(row.realPaperTrades,0);
  assert.equal(row.developmentHoldoutQuarantined,true);
  assert.ok(['PASS','BLOCKED'].includes(row.independentHistoricalScreen));
  assert.ok(row.independentHistoricalScreen==='PASS'?
    row.proposedAction==='OWNER_REVIEW_REQUIRED':row.proposedAction==='RESEARCH_MORE');
 }
});
test('rejects one missing or altered market source without inventing a result',async()=>{
 const data=snapshots();delete data['ETH/USD'];
 await assert.rejects(integratedResearchReview({memory:emptyMemory(),
   snapshots:data,fx,now}),/Preloaded data missing|source snapshots/);
});
test('rejects future, stale and falsely sourced snapshots',async()=>{
 const data=snapshots();
 data['BTC/USD'].source='FAKE_BACKTEST_SOURCE';
 await assert.rejects(integratedResearchReview({memory:emptyMemory(),
   snapshots:data,fx,now}),/Unverified candle-source provenance/);
 const old=snapshots();
 const delta=16*86400000;
 for(const item of Object.values(old)){
  item.bars=item.bars.map(b=>({...b,t:new Date(Date.parse(b.t)-delta).toISOString()}));
 }
 await assert.rejects(integratedResearchReview({memory:emptyMemory(),
   snapshots:old,fx,now}),/stale historical candle window/);
});
test('does not trust self-described or future FX rates',async()=>{
 await assert.rejects(integratedResearchReview({memory:emptyMemory(),
   snapshots:snapshots(),fx:{...fx,source:'USER_GUESS'},now}),/fresh external reference/);
});
