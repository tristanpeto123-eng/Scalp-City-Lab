import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildStudentProgress,CRYPTO_PAIRS,STUDENT_PROGRESS_SCHEMA} from './build-student-progress.mjs';
const stamp='2026-10-24T16:00:00.000Z';
const modelSha=i=>(i+1).toString(16).padStart(64,'0');
const academy={schema:'ROBOT_ACADEMY_RESEARCH_V1',actualBrokerOrders:0,verifiedForwardGrades:0,
 pupils:CRYPTO_PAIRS.map((symbol,i)=>({
  symbol,confirmedForward:false,championModel:null,verifiedForwardTrades:0,
  experiments:2,independentTrainingWindows:1,distinctStrategiesTried:12,
  latestTrainingEnd:'2026-09-18T04:45:00.000Z',
  researchLeader:{trainingWinRatePct:40+i,trainingNetGbp:-1+i*.2,trainingClosedTrades:22},
  learningCredits:{points:0},
  generations:[
   {run:1,trainingEnd:'2026-08-01T00:00:00Z',grade:2,leaderTrainingNetGbp:-2,independentWindow:true,testedConfigurations:6},
   {run:2,trainingEnd:'2026-09-18T04:45:00Z',grade:4,leaderTrainingNetGbp:-1,independentWindow:false,testedConfigurations:6}
  ]
 }))};
const monitor={schema:'SCALP_TRAINING_MONITOR_V1',trainingOnly:true,brokerOrders:0,verifiedForwardGrades:0,
 publishedAt:stamp,lastMeasuredCycle:{charts:CRYPTO_PAIRS.map(symbol=>({
 symbol,status:'DAILY_EXPERIMENT_CAP',evaluations:0,newTrainingCandles:0
 }))}};
const rl={schema:'SCALP_RAPID_RL_REPLAY_V1',generatedAt:stamp,paperOrders:0,liveOrders:0,
 verifiedForwardGrades:0,sealedHoldoutAccessed:false,marketBarTimeframe:'5Min',
 pupils:CRYPTO_PAIRS.map((symbol,i)=>({
  symbol,modelSha256:modelSha(i),cumulativeGradientUpdates:12000+i,
  gradientUpdatesThisRun:4000,newTrainingTailCandles:77,
  laterDevelopmentNetGbp:-.1, laterDevelopmentStressedNetGbp:-.25,
  decisionsThisRun:145,forwardVerified:false,paperOrders:0,
  profitObjective:{forwardVerified:false,developmentGatePassed:false,
   researchStatus:'DEVELOPMENT_PROFIT_GATE_FAILED',reasons:['NOT_PROFITABLE_UNDER_STRESS']},
  checkpointProgress:{comparisonStatus:'SAME_DEVELOPMENT_WINDOW_NOT_FORWARD_VERIFIED',
   isIndependentForwardEvidence:false,improvedUnderBothCostAssumptions:false}
 }))};
test('builds ten research-only pupils with genuine individual Academy timelines',()=>{
 const x=buildStudentProgress({academy,monitor,rl,generatedAt:stamp});
 assert.equal(x.schema,STUDENT_PROGRESS_SCHEMA);
 assert.equal(x.students.length,10);
 assert.equal(x.summary.cappedAcademyStudents,10);
 assert.equal(x.summary.rlUpdatedPupils,10);
 assert.equal(x.summary.independentlyForwardVerified,0);
 assert.equal(x.summary.realBrokerOrders,0);
 assert.equal(x.students[0].research.lessons.length,2);
 assert.equal(x.students[0].rl.checkpoints.length,1);
 assert.deepEqual(x.students[0].blockers,[
  'ACADEMY_DAILY_EXPERIMENT_CAP','NO_NEW_INDEPENDENT_ACADEMY_CANDLES',
  'RL_PROFIT_DEVELOPMENT_GATE_FAILED','NO_VERIFIED_FORWARD_PAPER_RESULTS'
 ]);
 assert.equal(x.students[0].research.historicalTrainingGrade,40);
 assert.equal(x.students[0].research.lessons[0].independent,true);
});
test('checkpoint journal appends ONLY newly trained model fingerprints',()=>{
 const first=buildStudentProgress({academy,monitor,rl,generatedAt:stamp});
 const repeated=buildStudentProgress({academy,monitor,rl,previous:first,generatedAt:'2026-10-24T17:00:00Z'});
 assert.equal(repeated.students[0].rl.checkpoints.length,1);
 const next={...rl,generatedAt:'2026-10-24T18:00:00Z',
 pupils:rl.pupils.map((x,i)=>({...x,modelSha256:modelSha(i+23),cumulativeGradientUpdates:x.cumulativeGradientUpdates+300}))};
 const moved=buildStudentProgress({academy,monitor,rl:next,previous:repeated,generatedAt:'2026-10-24T18:02:00Z'});
 assert.equal(moved.students[0].rl.checkpoints.length,2);
 assert.equal(moved.students[0].rl.checkpoints[1].cumulativeGradientUpdates,12300);
 assert.equal(moved.students[0].rl.checkpoints[0].cumulativeGradientUpdates,12000);
});
test('prevents invented forward graduates, used-holdout evidence and invalid grades',()=>{
 assert.throws(()=>buildStudentProgress({academy,monitor,
  rl:{...rl,verifiedForwardGrades:1}}),/invalid Deep RL/);
 assert.throws(()=>buildStudentProgress({academy:{...academy,actualBrokerOrders:1},monitor,rl}),/invalid source Academy/);
 const wrong={...academy,pupils:academy.pupils.map((p,i)=>i? p:{...p,championModel:{name:'fake'}})};
 assert.throws(()=>buildStudentProgress({academy:wrong,monitor,rl}),/unapproved promotion/);
 const revised={...rl,pupils:rl.pupils.map((p,i)=>i?p:{...p,checkpointProgress:{...p.checkpointProgress,isIndependentForwardEvidence:true}})};
 assert.throws(()=>buildStudentProgress({academy,monitor,rl:revised}),/forward claims/);
});
test('refuses missing duplicated crypto students and corrupt historical timelines',()=>{
 const badA={...academy,pupils:academy.pupils.map((p,i)=>i?p:{...p,experiments:3})};
 assert.throws(()=>buildStudentProgress({academy:badA,monitor,rl}),/lesson history/);
 const b={...rl,pupils:[rl.pupils[0],...rl.pupils.slice(0,9)]};
 assert.throws(()=>buildStudentProgress({academy,monitor,rl:b}),/missing or duplicate/);
});
