import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

/** Public, non-secret progress telemetry. The counters are NOT broker trades. */
export const STUDENT_PROGRESS_SCHEMA='SCALP_STUDENT_PROGRESS_V1';
export const CRYPTO_PAIRS=Object.freeze(['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD']);
const finite=Number.isFinite;
const goodDate=t=>typeof t==='string'&&finite(Date.parse(t));
const later=(a,b)=>!a||Date.parse(b)>Date.parse(a)?b:a;
function checkInputs({academy,monitor,rl,previous}){
 if(academy?.schema!=='ROBOT_ACADEMY_RESEARCH_V1'||!Array.isArray(academy.pupils)||
  academy.pupils.length!==10||academy.actualBrokerOrders!==0||academy.verifiedForwardGrades!==0)
  throw Error('Student progress: invalid source Academy evidence');
 if(monitor?.schema!=='SCALP_TRAINING_MONITOR_V1'||monitor.trainingOnly!==true||
  monitor.brokerOrders!==0||monitor.verifiedForwardGrades!==0||
  !goodDate(monitor.publishedAt)||!Array.isArray(monitor.lastMeasuredCycle?.charts))
  throw Error('Student progress: invalid research monitor');
 if(rl?.schema!=='SCALP_RAPID_RL_REPLAY_V1'||!goodDate(rl.generatedAt)||
  !Array.isArray(rl.pupils)||rl.pupils.length!==10||
  rl.paperOrders!==0||rl.liveOrders!==0||rl.verifiedForwardGrades!==0||
  rl.sealedHoldoutAccessed!==false||
  rl.marketBarTimeframe!=='5Min')
  throw Error('Student progress: invalid Deep RL report');
 if(previous!=null&&(previous.schema!==STUDENT_PROGRESS_SCHEMA||
   !Array.isArray(previous.students)||previous.students.length!==10))
  throw Error('Student progress: invalid previous progress journal');
}
function digestMarker(p){
 if(typeof p.modelSha256!=='string'||!/^[a-f0-9]{64}$/.test(p.modelSha256))
  throw Error('Student progress: invalid stored model fingerprint');
 return p.modelSha256;
}
function researchLessons(p){
 if(!Array.isArray(p.generations)||p.generations.length!==p.experiments||
   p.generations.length>2000)throw Error('Student progress: invalid Academy lesson history');
 return p.generations.map((g,i)=>{
  if(!Number.isInteger(g.run)||g.run!==i+1||!goodDate(g.trainingEnd)||
    !Number.isInteger(g.testedConfigurations)||g.testedConfigurations<1||
    ![true,false].includes(g.independentWindow))
   throw Error('Student progress: invalid chronological Academy generation');
  return {run:g.run,trainedThrough:g.trainingEnd,grade:g.grade??null,
   trainingNetGbp:finite(g.leaderTrainingNetGbp)?g.leaderTrainingNetGbp:null,
   testedConfigurations:g.testedConfigurations,independent:g.independentWindow,
   researchXp:finite(g.rewardCreditsAwarded)?g.rewardCreditsAwarded:0};
 });
}
function checkpointReading(p,stamp){
 const c=p.checkpointProgress||{},metric=p.profitObjective||{};
 if(!finite(p.cumulativeGradientUpdates)||p.cumulativeGradientUpdates<0||
  !finite(p.gradientUpdatesThisRun)||p.gradientUpdatesThisRun<0||
  !finite(p.newTrainingTailCandles)||p.newTrainingTailCandles<0||
  !finite(p.laterDevelopmentNetGbp)||!finite(p.laterDevelopmentStressedNetGbp)||
  p.forwardVerified!==false||p.paperOrders!==0||metric.forwardVerified!==false||
  c.isIndependentForwardEvidence!==false||
  !['SAME_DEVELOPMENT_WINDOW_NOT_FORWARD_VERIFIED','FIRST_CHECKPOINT_NO_COMPARATOR'].includes(c.comparisonStatus))
  throw Error('Student progress: Deep RL training source invalid or forward claims unsupported');
 return {
  observedAt:stamp,modelSha256:digestMarker(p),
  cumulativeGradientUpdates:p.cumulativeGradientUpdates,
  gradientUpdatesThisRun:p.gradientUpdatesThisRun,
  newTrainingTailCandles:p.newTrainingTailCandles,
  sameWindowNetVirtual:p.laterDevelopmentNetGbp,
  sameWindowStressNetVirtual:p.laterDevelopmentStressedNetGbp,
  sameWindowImproved:c.improvedUnderBothCostAssumptions===true,
  profitDevelopmentGatePassed:metric.developmentGatePassed===true,
  developmentStatus:metric.researchStatus||'UNASSESSED',
  developmentReasons:Array.isArray(metric.reasons)?metric.reasons.filter(x=>typeof x==='string').slice(0,8):[]
 };
}
export function buildStudentProgress({academy,monitor,rl,previous=null,generatedAt=new Date().toISOString()}={}){
 checkInputs({academy,monitor,rl,previous});
 if(!goodDate(generatedAt))throw Error('Student progress: invalid published timestamp');
 const getUnique=(arr,field)=>new Map(arr.map(x=>[x[field],x]));
 const A=getUnique(academy.pupils,'symbol'),R=getUnique(rl.pupils,'symbol');
 const M=getUnique(monitor.lastMeasuredCycle.charts,'symbol'),P=getUnique(previous?.students||[],'symbol');
 if(A.size!==10||R.size!==10||M.size!==10)throw Error('Student progress: missing or duplicate crypto pupil');
 const students=CRYPTO_PAIRS.map(symbol=>{
  const a=A.get(symbol),r=R.get(symbol),m=M.get(symbol),prior=P.get(symbol);
  if(!a||!r||!m||a.confirmedForward!==false||a.championModel!==null||a.verifiedForwardTrades!==0)
   throw Error('Student progress: mismatched pupil identity or unapproved promotion');
  const lessons=researchLessons(a);
  const observation=checkpointReading(r,rl.generatedAt);
  const points=prior?.rl?.checkpoints||[];
  if(!Array.isArray(points)||points.length>90)throw Error('Student progress: corrupt old neural timeline');
  // Same model fingerprint does not become a new learning event when republished.
  const fresh=!points.length||points.at(-1).modelSha256!==observation.modelSha256;
  const checkpoints=(fresh?[...points,observation]:points).slice(-90);
  if(checkpoints.some((p,i)=>i&&Date.parse(p.observedAt)<Date.parse(checkpoints[i-1].observedAt)))
   throw Error('Student progress: checkpoint clock moved backward');
  const cap=m.status==='DAILY_EXPERIMENT_CAP';
  const noCandles=m.newTrainingCandles===0;
  const gate=observation.profitDevelopmentGatePassed;
  return {
   id:'CRYPTO:'+symbol,market:'CRYPTO',symbol,name:symbol.split('/')[0],
   mode:'PUBLISHED_TRAINING_RESEARCH_ONLY',
   publishedAcademyAt:monitor.publishedAt,
   latestHistoricalTrainingEnd:a.latestTrainingEnd,
   research:{
    experiments:a.experiments,
    independentWindows:a.independentTrainingWindows,
    configurations:a.distinctStrategiesTried,
    historicalTrainingGrade:a.researchLeader?.trainingWinRatePct??null,
    historicalCandidateNetGbp:a.researchLeader?.trainingNetGbp??null,
    historicalCandidateTrades:a.researchLeader?.trainingClosedTrades??null,
    xp:a.learningCredits?.points||0,
    status:m.status,latestBatchEvaluations:m.evaluations,
    lastBatchNewTrainingCandles:m.newTrainingCandles,
    lessons
   },
   rl:{
    generatedAt:rl.generatedAt,
    cumulativeGradientUpdates:r.cumulativeGradientUpdates,
    gradientUpdatesThisRun:r.gradientUpdatesThisRun,
    newTrainingTailCandles:r.newTrainingTailCandles,
    decisionsThisRun:r.decisionsThisRun,
    profitDevelopmentGatePassed:gate,
    checkpoints
   },
   blockers:[
    ...(cap?['ACADEMY_DAILY_EXPERIMENT_CAP']:[]),
    ...(noCandles?['NO_NEW_INDEPENDENT_ACADEMY_CANDLES']:[]),
    ...(!gate?['RL_PROFIT_DEVELOPMENT_GATE_FAILED']:[]),
    'NO_VERIFIED_FORWARD_PAPER_RESULTS'
   ],
   researchProgressOnly:true,forwardVerified:false,brokerOrders:0,
   admittedForTrading:false
  };
 });
 return {schema:STUDENT_PROGRESS_SCHEMA,
  generatedAt,academySnapshotAt:monitor.publishedAt,
  rlSnapshotAt:rl.generatedAt,markets:['COMMODITIES','FOREX','INDICES','EQUITIES','CRYPTO'],
  specializations:[
   {market:'COMMODITIES',symbol:'XAUUSD',storage:'LOCAL_SL_CHECKPOINT_ONLY'},
   {market:'FOREX',symbol:'EURUSD',storage:'LOCAL_SL_CHECKPOINT_ONLY'},
   {market:'INDICES',symbol:'SPX',storage:'LOCAL_SL_CHECKPOINT_ONLY'},
   {market:'EQUITIES',storage:'NOT_ACTIVATED'},
  ],
  students,summary:{
   pupils:students.length,
   cappedAcademyStudents:students.filter(s=>s.blockers.includes('ACADEMY_DAILY_EXPERIMENT_CAP')).length,
   rlUpdatedPupils:students.filter(s=>s.rl.gradientUpdatesThisRun>0).length,
   rlProfitGatePasses:students.filter(s=>s.rl.profitDevelopmentGatePassed).length,
   newIndependentAcademyCandles:students.reduce((sum,s)=>sum+s.research.lastBatchNewTrainingCandles,0),
   independentlyForwardVerified:0,realBrokerOrders:0,
   caution:'Historical research and same-window DQN improvements are NOT prospective forward trading results.'
  }};
}
async function main(){
 const [, , academyPath,monitorPath,rlPath,outputPath]=process.argv;
 if(![academyPath,monitorPath,rlPath,outputPath].every(Boolean))
  throw Error('Usage: node scripts/build-student-progress.mjs ACADEMY MONITOR RL OUTPUT');
 const [academy,monitor,rl]=await Promise.all([academyPath,monitorPath,rlPath].map(async p=>JSON.parse(await readFile(p,'utf8'))));
 let previous=null;
 try{previous=JSON.parse(await readFile(outputPath,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 if(previous&&previous.academySnapshotAt===monitor.publishedAt&&
    previous.rlSnapshotAt===rl.generatedAt){
  console.log('STUDENT_PROGRESSION_NO_NEW_SOURCE_EVIDENCE');
  return;
 }
 const result=buildStudentProgress({academy,monitor,rl,previous});
 await mkdir(path.dirname(outputPath),{recursive:true});
 await writeFile(outputPath,JSON.stringify(result,null,2)+'\n');
 console.log('STUDENT_PROGRESSION_PUBLISHED '+JSON.stringify({
  students:result.students.length,academyCaps:result.summary.cappedAcademyStudents,
  rlTrainingStudents:result.summary.rlUpdatedPupils,rlProfitPasses:result.summary.rlProfitGatePasses,
  totalCheckpointPoints:result.students.reduce((v,s)=>v+s.rl.checkpoints.length,0),
  verifiedForward:0,orders:0
 }));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1]))
 main().catch(e=>{console.error('STUDENT_PROGRESSION_BLOCKED '+e.message);process.exitCode=1});
