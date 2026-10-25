import assert from 'node:assert/strict';
import {test} from 'node:test';
import {discoverOpportunities,FIVE_MINUTES} from './opportunity-discovery.mjs';
import {trainAcademyTeacher,predictTeacher} from './teacher-training.mjs';
const start=Date.parse('2025-01-01T00:00:00Z');
const bars=Array.from({length:3400},(_,i)=>{
 const o=2650+Math.sin(i*.11)*19+Math.cos(i*.017)*36+i*.016,c=o+Math.sin(i*.23)*2.2;
 return {t:new Date(start+i*FIVE_MINUTES).toISOString(),o,h:Math.max(o,c)+1.8,l:Math.min(o,c)-1.8,c,v:100+i%31};
});
const fixture=()=>({...discoverOpportunities({bars}),sourceSha256:'SYNTHETIC_UNIT_TEST_ONLY'});
test('Teacher trains independently, locks broker permissions, quarantines final test',()=>{
 const f=fixture(),{checkpoint,report}=trainAcademyTeacher(f);
 assert.equal(checkpoint.schema,'ACADEMY_TEACHER_MODEL_V1');
 assert.equal(checkpoint.architecture,'9x12x1_TANH_SIGMOID');
 assert.equal(checkpoint.enabledForBroker,false);
 assert.equal(report.status,'HISTORICAL_DEVELOPMENT_ONLY');
 assert.equal(report.paperOrders,0);assert.equal(report.liveOrders,0);
 assert.equal(report.automaticPromotion,false);
 assert.equal(report.independentFinalTestEvaluated,false);
 assert.equal(report.verifiedForwardGrades,0);
 assert.ok(report.samples.good>0&&report.samples.bad>0);
 assert.ok(report.groups.fit>20&&report.groups.tune>=10&&report.groups.development>=12);
 assert.equal(report.checkpointSha256.length,64);
 const p=predictTeacher(checkpoint,f.opportunities[0]);
 assert.ok(p>=0&&p<=1);
});
test('Deterministic checkpoint: same history does not manufacture progress',()=>{
 const a=trainAcademyTeacher(fixture()),b=trainAcademyTeacher(fixture());
 assert.equal(a.report.checkpointSha256,b.report.checkpointSha256);
 assert.deepEqual(a.report.development,b.report.development);
});
test('Sealed final 20% mutations cannot alter model or development result',()=>{
 const baseline=fixture();
 const changed=bars.map((b,i)=>i<2720?b:{...b,o:b.o+100,h:b.h+100,l:b.l+100,c:b.c+100});
 const altered=discoverOpportunities({bars:changed});
 assert.deepEqual(altered.opportunities,baseline.opportunities);
 assert.deepEqual(trainAcademyTeacher(altered).checkpoint,trainAcademyTeacher(baseline).checkpoint);
});
test('Reject forged winners, duplicates and holdout exposure',()=>{
 const a=fixture();a.opportunities[0].label='FORGED';
 assert.throws(()=>trainAcademyTeacher(a),/invalid|leaking/i);
 const b=fixture();b.opportunities.push({...b.opportunities[0]});
 assert.throws(()=>trainAcademyTeacher(b),/invalid|leaking/i);
 const c=fixture();c.opportunities[0].closedAt=c.dataset.sealedTestStart;
 assert.throws(()=>trainAcademyTeacher(c),/invalid|leaking/i);
});
test('Insufficient positive and negative classes cannot produce a model',()=>{
 const f=fixture();
 for(const c of f.opportunities){c.netPnlGbp=-Math.abs(c.netPnlGbp)-1;c.stressNetPnlGbp=c.netPnlGbp-1;c.label='BAD';c.binaryLabel=0;}
 assert.throws(()=>trainAcademyTeacher(f),/Insufficient/);
});