import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTrainingMonitor} from './build-training-monitor.mjs';
import {PAIRS} from '../strategy-validation-core.mjs';
const academy=JSON.parse(await readFile(new URL('../research-data/robot-academy.json',import.meta.url)));
const snapshots=Object.fromEntries(await Promise.all(PAIRS.map(async symbol=>[
 symbol,JSON.parse(await readFile(new URL('../validation-data/'+symbol.replace('/','-')+'.json',import.meta.url)))
])));
const now=new Date(Math.max(...Object.values(snapshots).map(x=>Date.parse(x.generatedAt)))+120000).toISOString();
const cycle={schema:'SCALP_TRAINING_CYCLE_V1',startedAt:now,completedAt:now,
 candidateEvaluations:12,evaluationDurationMs:200,evaluationsPerSecond:60,
 newlySavedLessons:2,newTrainingCandles:30,totalRewardCredits:0,
 persistence:'PERSISTED_NEW_TRAINING_LESSONS',brokerOrders:0,verifiedForwardGrades:0,charts:[]};
test('ten pupils, measured runtime, sealed final fifth and no paper claims',()=>{
 const r=buildTrainingMonitor({cycle,academy,snapshots,now});
 assert.equal(r.scheduleMinutes,5);
 assert.equal(r.outOfSample.charts.length,10);
 assert.equal(r.lastMeasuredCycle.evaluationsPerSecond,60);
 assert.equal(r.brokerOrders,0);
 assert.equal(r.verifiedForwardGrades,0);
 assert.equal(r.outOfSample.status,'CHRONOLOGICAL_DEVELOPMENT_ONLY_NOT_SEALED_HOLDOUT');
 assert.ok(r.outOfSample.charts.every(x=>x.forwardVerified===false));
 assert.ok(r.outOfSample.charts.every(x=>x.improvementGbp===null));
 assert.equal(r.lastSuccessfulLessonAt,now);
});
test('replayed historical windows cannot generate invented OOS improvement',()=>{
 const first=buildTrainingMonitor({cycle,academy,snapshots,now});
 const second=buildTrainingMonitor({cycle:{...cycle,newlySavedLessons:0},
   academy,snapshots,now,previous:first});
 assert.equal(second.lastSuccessfulLessonAt,now);
 assert.equal(second.outOfSample.improvementMeasuredPupils,0);
 for(const row of second.outOfSample.charts){
   assert.equal(row.improvementGbp,null);
   if(row.status==='OBSERVED_DEVELOPMENT_OOS')
     assert.equal(row.improvementStatus,'UNCHANGED_WINDOW_NO_NEW_EVIDENCE');
 }
});
test('spoofed broker activity and incorrect provenance fail closed',()=>{
 assert.throws(()=>buildTrainingMonitor({cycle:{...cycle,brokerOrders:1},academy,snapshots,now}),/invalid/);
 assert.throws(()=>buildTrainingMonitor({cycle,academy:{...academy,verifiedForwardGrades:1},snapshots,now}),/invalid/);
 assert.throws(()=>buildTrainingMonitor({cycle,academy,snapshots:{},now}),/invalid/);
});
