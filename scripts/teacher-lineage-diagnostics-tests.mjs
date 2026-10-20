import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {explainCandidateLineage} from './teacher-lineage-diagnostics.mjs';
const bars=Array.from({length:500},(_,i)=>({
 t:Date.parse('2026-01-01T00:00:00Z')+i*900000,
 o:100,h:101,l:99,c:100.2,v:12
}));
const fingerprint=createHash('sha256').update(JSON.stringify(
 bars.map(b=>[new Date(b.t).toISOString(),b.o,b.h,b.l,b.c,b.v])
)).digest('hex');
const options={family:'ema_trend',fast:9,slow:34};
const exp={id:'a'.repeat(64),symbol:'BTC/USD',feed:'us-1',acceptedForLearning:true,
 trainingStart:new Date(bars[0].t).toISOString(),
 trainingEnd:new Date(bars.at(-1).t+900000).toISOString(),
 trainFingerprint:fingerprint,trainingOptions:[{params:options}]};
const memory={experiments:[exp]};
const pupil={symbol:'BTC/USD',researchLeader:{
 sourceExperimentId:exp.id,trainedThrough:exp.trainingEnd,parameters:options
}};
test('accepted immutable lineage with exact candle hash is source-match only, never Teacher admission',()=>{
 const r=explainCandidateLineage(memory,pupil,bars);
 assert.equal(r.status,'SOURCE_MATCHES_FROZEN_RESEARCH');
 assert.equal(r.sampleSourceMatched,true);
 assert.equal(r.forwardVerified,false);
 assert.equal(r.admissionsIssued,0);
 assert.equal(r.brokerOrders,0);
});
test('disallow false accepted flag and unaudited candidate source',()=>{
 const bad={experiments:[{...exp,acceptedForLearning:false}]};
 const r=explainCandidateLineage(bad,pupil,bars);
 assert.equal(r.status,'RESEARCH_LINEAGE_MISMATCH');
 assert.equal(r.sampleSourceMatched,false);
});
test('revised, truncated or missing frozen source cannot be treated as unchanged',()=>{
 const revised=bars.map((b,i)=>i===100?{...b,c:b.c+.1}:b);
 const changed=explainCandidateLineage(memory,pupil,revised);
 assert.equal(changed.sampleSourceMatched,false);
 assert.ok(changed.reasons.includes('FROZEN_CANDLE_FINGERPRINT_MISMATCH'));
 const missing=explainCandidateLineage(memory,pupil,bars.slice(20));
 assert.equal(missing.sampleSourceMatched,false);
 assert.ok(missing.reasons.includes('FROZEN_TRAINING_WINDOW_NOT_ARCHIVED_CONTIGUOUSLY'));
});
