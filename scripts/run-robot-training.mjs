// Scalp City research lessons. Designed for GitHub Actions with model-memory
// persistence only. Every chart's strongest previously researched candidate
// seeds its next independent exploration; repeated bars never count as
// independent evidence. NOT an AI network, trader or profitable prediction.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';
import {evaluateTrainingAcrossFolds} from './historical-training-folds.mjs';
import {scoreTrainingReward,checkTrainingReward} from './robot-rewards.mjs';
export {PAIRS};

const MEMORY_BRANCH='scalp-learning-memory';
const MEMORY_PATH='scalp-learning/history.json';
const MEMORY_SCHEMA='SCALP_RESEARCH_MEMORY_V1';
const POLICY='GBP50-PROFIT2000-v2';
const API='https://api.github.com/repos/tristanpeto123-eng/Scalp-City-Lab/contents/'+MEMORY_PATH;
const SHA=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const PERIOD=900000;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=n=>Number(n.toFixed(8));
const canonical=p=>JSON.stringify(p);
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const goodNumber=Number.isFinite;
const acceptedFamilies=['ema_trend','rsi_reversion','channel_breakout'];
export const RESEARCH_LIMITS=Object.freeze({
 candidatesPerCycle:6,maxExperimentsPerSymbolDay:8,
 startingVirtualGbp:50,
 observedHoldoutUsedToSelect:false,
 requiresIndependentForwardBeforePromotion:true,
 brokerOrders:0
});
export function checkMemory(memory){
 if(!memory||memory.schema!==MEMORY_SCHEMA||memory.policy!==POLICY||
    !Array.isArray(memory.experiments)||memory.experiments.length>2000)
  throw Error('Incompatible or exhausted saved model-memory schema');
 const ids=new Set();
 for(const e of memory.experiments){
  if(!PAIRS.includes(e?.symbol)||!['us','us-1'].includes(e.feed)||
    !SHA64.test(e.id||'')||ids.has(e.id)||!SHA64.test(e.trainFingerprint||'')||
    !date(e.trainingStart)||!date(e.trainingEnd)||
    !(Date.parse(e.trainingStart)<Date.parse(e.trainingEnd))||
    typeof e.acceptedForLearning!=='boolean'||
    !Array.isArray(e.trainingOptions)||e.trainingOptions.length>16||
    e.trainingOptions.length<1)throw Error('Corrupted or duplicate stored training experiments');
  ids.add(e.id);
  for(const o of e.trainingOptions){
   checkParams(o.params);
   checkTrainingReward(o.researchReward);
   if(o.researchReward){
     const expected=scoreTrainingReward({
       closedTrades:o.closedTrades,netProfitGbp:o.netProfitGbp,
       stressNetProfitGbp:o.stressNetProfitGbp,
       maxDrawdownPct:o.maxDrawdownPct
     },{independent:e.acceptedForLearning});
     if(JSON.stringify(expected)!==JSON.stringify(o.researchReward))
       throw Error('Reward does not match audited historical metrics');
   }
   if(!Number.isInteger(o.closedTrades)||o.closedTrades<0||
      !goodNumber(o.netProfitGbp)||!goodNumber(o.winRatePct)||
      o.winRatePct<0||o.winRatePct>100||
      o.trainingScore!==null&&!goodNumber(o.trainingScore))
     throw Error('Invalid historical training result');
  }
 }
 return memory;
}
export function checkParams(p){
 if(!p||typeof p!=='object'||!acceptedFamilies.includes(p.family))
  throw Error('Unsupported research strategy family');
 if(p.family==='ema_trend'){
  if(!Number.isInteger(p.fast)||!Number.isInteger(p.slow)||
     p.fast<2||p.fast>=p.slow||p.slow>120)throw Error('Invalid EMA parameters');
 }else if(p.family==='rsi_reversion'){
  if(!Number.isInteger(p.period)||!Number.isInteger(p.buyBelow)||
     !Number.isInteger(p.sellAbove)||p.period<3||p.period>40||
     p.buyBelow<10||p.buyBelow>45||p.sellAbove<=p.buyBelow||p.sellAbove>90)
   throw Error('Invalid RSI parameters');
 }else if(!Number.isInteger(p.lookback)||!Number.isInteger(p.exitLookback)||
    p.lookback<5||p.lookback>80||p.exitLookback<3||
    p.exitLookback>p.lookback)throw Error('Invalid channel parameters');
 return p;
}
export function toSimulator(p){
 checkParams(p);
 // Strictly intersect archived strategy rules with the live validator's
 // narrower parameter bounds. Archived out-of-bounds parents are not executed.
 if(p.family==='ema_trend'&&(p.fast<3||p.slow>96))throw Error('Unsupported EMA validator bounds');
 if(p.family==='rsi_reversion'&&(p.period<7||p.period>30||p.buyBelow>40||p.sellAbove>85))
  throw Error('Unsupported RSI validator bounds');
 if(p.family==='channel_breakout'&&(p.lookback<10||p.exitLookback<5))
  throw Error('Unsupported breakout validator bounds');
 if(p.family==='ema_trend')return {strategy:'ema',strategyParams:{fast:p.fast,slow:p.slow}};
 if(p.family==='rsi_reversion')return {strategy:'rsi',strategyParams:{
  period:p.period,buyBelow:p.buyBelow,sellAbove:p.sellAbove}};
 return {strategy:'breakout',strategyParams:{
  lookback:p.lookback,exitLookback:p.exitLookback}};
}
export function selectHistoricalParent(memory,symbol,feed='us-1'){
 checkMemory(memory);
 if(!PAIRS.includes(symbol)||!['us','us-1'].includes(feed))
  throw Error('Unrecognized research chart');
 const previous=memory.experiments.filter(e=>e.symbol===symbol&&e.feed===feed);
 const options=previous.flatMap(e=>e.trainingOptions.map(o=>({
  experimentId:e.id,trainingEnd:e.trainingEnd,
  params:o.params,closedTrades:o.closedTrades,
  winRatePct:o.winRatePct,netProfitGbp:o.netProfitGbp,
  rewardPoints:e.acceptedForLearning&&o.researchReward?.eligible?o.researchReward.points:0
 })));
 // Do not use training win rate alone. Prefer greatest historic net profit
 // among strategies with meaningful sample size, though it can be a loser.
 // Cross-period net comparisons are only *heuristic research seeds*.
 const admissible=options.filter(o=>{
  if(o.closedTrades<20)return false;
  try{toSimulator(o.params);return true}catch{return false}
 });
 // Reinforce only cost-stressed positive training on nonoverlapping historical
 // windows. Old saved data has no reward and retains the net-profit fallback.
 admissible.sort((a,b)=>b.rewardPoints-a.rewardPoints||b.netProfitGbp-a.netProfitGbp||
  b.closedTrades-a.closedTrades||
  Date.parse(b.trainingEnd)-Date.parse(a.trainingEnd)||
  canonical(a.params).localeCompare(canonical(b.params)));
 const best=admissible[0]||null;
 return best?{...best,
  status:best.netProfitGbp>0?'POSITIVE_TRAINING_ONLY':'LOSS_MAKING_RESEARCH_PARENT',
  confirmedChampion:false,forwardValidated:false}:null;
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Math.round(value)));
function variantsAround(parent){
 const bases=parent?[parent]:[
  {family:'ema_trend',fast:9,slow:34},
  {family:'rsi_reversion',period:14,buyBelow:30,sellAbove:60},
  {family:'channel_breakout',lookback:20,exitLookback:10}
 ];
 const proposals=[];
 const add=p=>{try{const clean=checkParams(p);toSimulator(clean);if(!proposals.some(x=>canonical(x)===canonical(clean)))
  proposals.push(clean);}catch{}};
 for(const p of bases){
  add(p);
  if(p.family==='ema_trend'){
   for(const [f,s] of [[-3,-8],[-2,-4],[-1,0],[1,4],[2,8],[3,12],
     [-2,8],[2,-8],[-4,-10],[4,10],[0,16],[0,-12]]){
    const fast=clamp(p.fast+f,2,60),slow=clamp(p.slow+s,fast+1,120);
    add({family:'ema_trend',fast,slow});
   }
  }else if(p.family==='rsi_reversion'){
   for(const [period,buyBelow,sellAbove] of [[p.period,p.buyBelow-5,p.sellAbove],
    [p.period,p.buyBelow+5,p.sellAbove],[p.period,p.buyBelow,p.sellAbove-5],
    [p.period,p.buyBelow,p.sellAbove+5],[p.period-5,p.buyBelow,p.sellAbove],
    [p.period+5,p.buyBelow,p.sellAbove],[p.period-5,p.buyBelow-5,p.sellAbove+5],
    [p.period+5,p.buyBelow+5,p.sellAbove-5]]){
    add({family:'rsi_reversion',period:clamp(period,3,40),
     buyBelow:clamp(buyBelow,10,45),
     sellAbove:clamp(sellAbove,Math.max(11,clamp(buyBelow,10,45)+1),90)});
   }
  }else{
   for(const [delta,exit] of [[-10,-5],[-5,-2],[-2,0],[5,3],[10,5],[20,10],
     [0,-5],[0,5],[15,-3],[-5,5]]){
    const lookback=clamp(p.lookback+delta,5,80);
    add({family:'channel_breakout',lookback,
      exitLookback:clamp(p.exitLookback+exit,3,lookback)});
   }
  }
 }
 for(const p of [
 {family:'ema_trend',fast:6,slow:26},{family:'ema_trend',fast:9,slow:34},
 {family:'ema_trend',fast:12,slow:48},{family:'ema_trend',fast:4,slow:16},
 {family:'rsi_reversion',period:14,buyBelow:28,sellAbove:56},
 {family:'rsi_reversion',period:14,buyBelow:32,sellAbove:60},
 {family:'rsi_reversion',period:9,buyBelow:25,sellAbove:55},
 {family:'channel_breakout',lookback:15,exitLookback:8},
 {family:'channel_breakout',lookback:20,exitLookback:10},
 {family:'channel_breakout',lookback:30,exitLookback:12},
 {family:'channel_breakout',lookback:40,exitLookback:20}
 ])add(p);
 return proposals;
}
export function proposeResearchLesson(memory,{symbol,feed='us-1',fingerprint}={}){
 const parent=selectHistoricalParent(memory,symbol,feed);
 const history=memory.experiments.filter(e=>e.symbol===symbol&&e.feed===feed);
 const onSameCandles=history.filter(e=>e.trainFingerprint===fingerprint);
 const triedOnSameCandles=new Set(onSameCandles.flatMap(e=>e.trainingOptions.map(o=>canonical(o.params))));
 const remaining=variantsAround(parent?.params||null).filter(p=>!triedOnSameCandles.has(canonical(p)));
 // Include parent for an honest comparison on NEW candles. If parent has
 // already been compared on the same ones, don't double-count it.
 const result=[];
 const add=p=>{if(!result.some(q=>canonical(q)===canonical(p)))result.push(p);};
 if(parent&&!triedOnSameCandles.has(canonical(parent.params)))add(parent.params);
 // Preserve exploration across rule families, rather than always cloning the
 // last rewarded parent. At least two seats are reserved for other families.
 const diversity=parent?remaining.filter(p=>p.family!==parent.params.family).slice(0,2):[];
 const coreLimit=RESEARCH_LIMITS.candidatesPerCycle-diversity.length;
 for(const candidate of remaining){if(result.length>=coreLimit)break;add(candidate);}
 for(const candidate of diversity)add(candidate);
 return {symbol,feed,seed:parent,candidates:result.slice(0,RESEARCH_LIMITS.candidatesPerCycle),
  alreadyTriedOnTheseCandles:triedOnSameCandles.size,
  selectionBasis:'PREVIOUS_CHART_BEST_NET_GBP_THEN_BOUNDED_NEIGHBOUR_MUTATIONS',
  seededFromSavedHistory:Boolean(parent),sourceIsTrainingOnly:true};
}
function profile(bars){
 const start=bars[0],end=bars.at(-1);let sum=0,sum2=0,range=0,zero=0,up=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i];if(b.v===0)zero++;if(b.c>b.o)up++;
  range+=100*(b.h-b.l)/b.c;
  if(i){const r=Math.log(b.c/bars[i-1].c);sum+=r;sum2+=r*r;}
 }
 const N=bars.length-1,mean=sum/N;
 const deviation=Math.sqrt(Math.max(0,sum2/N-mean*mean))*100*Math.sqrt(96);
 const move=100*(end.c/start.c-1);
 const regime=deviation>5?'HIGH_VOLATILITY':Math.abs(move)>8?'DIRECTIONAL':'MIXED_OR_RANGE';
 return {
  candles:bars.length,timeframe:'15Min',
  sampleStart:new Date(start.t).toISOString(),
  sampleEnd:new Date(end.t+PERIOD).toISOString(),
  sampledClose:round(end.c),observedPriceChangePct:round(move),
  dailyRealizedVolatilityPct:round(deviation),
  averageCandleRangePct:round(range/bars.length),
  upCandleFractionPct:round(100*up/bars.length),
  zeroVolumeFractionPct:round(100*zero/bars.length),
  descriptiveRegime:regime,
  interpretation:'Completed TRAINING bars only. Repeated time windows and tuned features are NOT independent prediction evidence.'
 };
}
export function runResearchLesson(memory,{snapshot,symbol,now=Date.now()}={}){
 checkMemory(memory);
 const checked=checkSnapshot(snapshot,symbol,now);
 // Chronologically lock the first 40%, withhold the newer 60% entirely.
 // simulateValidation internally reserves a further early warm-up slice.
 const boundary=Math.floor(checked.bars.length*.40);
 const training=checked.bars.slice(0,boundary);
 if(training.length<480)throw Error('Insufficient historical TRAIN-only candles');
 const fingerprint=hash(training.map(b=>[new Date(b.t).toISOString(),b.o,b.h,b.l,b.c,b.v]));
 const plan=proposeResearchLesson(memory,{symbol,feed:'us-1',fingerprint});
 const start=new Date(training[0].t).toISOString(),
 end=new Date(training.at(-1).t+PERIOD).toISOString();
 const sameDay=memory.experiments.filter(e=>e.symbol===symbol&&e.feed==='us-1'&&
  e.trainingEnd.slice(0,10)===end.slice(0,10));
 if(!plan.candidates.length||sameDay.length>=RESEARCH_LIMITS.maxExperimentsPerSymbolDay){
  return {memory,changed:false,status:plan.candidates.length?'DAILY_EXPERIMENT_CAP':'NO_NEW_PARAMETERS_ON_SAME_CANDLES',
   symbol,seed:plan.seed,holdoutUsedForSelection:false,brokerOrders:0};
 }
 const acceptedForLearning=!memory.experiments.some(e=>
   e.symbol===symbol&&e.feed==='us-1'&&e.acceptedForLearning&&
   Date.parse(start)<Date.parse(e.trainingEnd)&&Date.parse(e.trainingStart)<Date.parse(end));
 const lastAcceptedEnd=memory.experiments.filter(e=>e.symbol===symbol&&e.feed==='us-1'&&e.acceptedForLearning)
   .reduce((latest,e)=>Math.max(latest,Date.parse(e.trainingEnd)),0);
 const newTrainingCandles=acceptedForLearning?(lastAcceptedEnd?
   Math.max(0,Math.floor((Date.parse(end)-lastAcceptedEnd)/PERIOD)) : training.length):0;
 // Three disjoint historical training folds within the first 40% of the
 // saved 60-day snapshot. The untouched last 60% never enters model selection.
 const outcomes=plan.candidates.map(p=>{
  const result=evaluateTrainingAcrossFolds({snapshot,symbol,config:toSimulator(p),now});
  const researchReward=scoreTrainingReward({
    closedTrades:result.closedTrades,netProfitGbp:result.netGbp,
    stressNetProfitGbp:result.stressNetGbp,
    maxDrawdownPct:result.robustness.worstDrawdownPct
  },{independent:acceptedForLearning});
  return {params:p,closedTrades:result.closedTrades,
    netProfitGbp:result.netGbp,stressNetProfitGbp:result.stressNetGbp,
    maxDrawdownPct:result.robustness.worstDrawdownPct,
    winRatePct:result.winRatePct,trainingScore:result.trainingScore,
    researchReward,robustness:result.robustness};
 });
 const ids=outcomes.map(o=>canonical(o.params)).sort();
 const recordId=hash([POLICY,'HISTORICAL_3FOLD_V1',symbol,'us-1',start,end,fingerprint,hash(ids)]);
 if(memory.experiments.some(e=>e.id===recordId))
  return {memory,changed:false,status:'IDENTICAL_EXPERIMENT_DEDUPED',
   symbol,seed:plan.seed,holdoutUsedForSelection:false,brokerOrders:0};
 if(memory.experiments.length>=2000)throw Error('Model memory capacity reached, manual archive policy required');
 const record={
  id:recordId,symbol,feed:'us-1',trainingStart:start,trainingEnd:end,
  trainFingerprint:fingerprint,acceptedForLearning,
  trainingOptions:outcomes,behavior:profile(training),
  reason:acceptedForLearning?'INDEPENDENT_RELATIVE_TO_SAVED_MEMORY':'OVERLAPPING_TRAINING_WINDOW',
  parentResearchModel:plan.seed?{params:plan.seed.params,
    previousNetGbp:plan.seed.netProfitGbp,sourceExperimentId:plan.seed.experimentId,
    confirmedChampion:false}:null,
  researchPolicy:'BOUNDED_PARENT_MUTATION_3FOLD_V2',
  trulyIndependentForwardValidated:false
 };
 const next={...memory,experiments:[...memory.experiments,record]};
 checkMemory(next);
 return {memory:next,changed:true,symbol,status:record.reason,
  seed:plan.seed,
  testedParams:outcomes.length,
  chronologicalTrainingWindows:outcomes[0]?.robustness.windowCount||0,
  newTrainingCandles,snapshotAt:snapshot.generatedAt??null,
  trainingEnd:end,rewardCreditsAwarded:outcomes.reduce((sum,o)=>sum+o.researchReward.points,0),
  bestObservedTrainingNetGbp:Math.max(...outcomes.map(x=>x.netProfitGbp)),
  bestObservedTrainingWinRatePct:Math.max(...outcomes.map(x=>x.winRatePct)),
  holdoutUsedForSelection:false,brokerOrders:0,
  promotion:'NONE_RESEARCH_ONLY',
  note:'Three disjoint historical folds within earlier 40%; overlapping refreshes never count as fresh independent forward proof.'};
}
export async function evaluateAll({memory,dataDir='validation-data',read=readFile,
 now=Date.now(),batchesPerPupil=1}={}){
 checkMemory(memory);
 if(!Number.isInteger(batchesPerPupil)||batchesPerPupil<1||batchesPerPupil>3)
   throw Error('RESEARCH: batches per pupil must be between 1 and 3');
 let next=memory;const reports=[];
 for(const symbol of PAIRS){
  // Read one immutable historical snapshot per pupil per cycle. Independent
  // experiments are NOT inferred from multiple runs over these same candles.
  const filename=path.join(dataDir,symbol.replace('/','-')+'.json');
  const snapshot=JSON.parse(await read(filename,'utf8'));
  const batches=[];
  for(let i=0;i<batchesPerPupil;i++){
   const item=runResearchLesson(next,{snapshot,symbol,now});
   next=item.memory;
   const {memory:_secret,...publicReport}=item;
   batches.push(publicReport);
   if(!item.changed)break;
  }
  const first=batches[0],completed=batches.filter(x=>x.changed);
  const candidates=batches.reduce((sum,x)=>sum+(x.testedParams||0),0);
  reports.push({...first,
   status:completed.length?completed.at(-1).status:first.status,
   testedParams:candidates,
   chronologicalTrainingWindows:first.chronologicalTrainingWindows||0,
   newTrainingCandles:first.newTrainingCandles||0,
   rewardCreditsAwarded:batches.reduce((sum,x)=>sum+(x.rewardCreditsAwarded||0),0),
   researchBatchesAttempted:batches.length,
   savedExperiments:completed.length,
   bestObservedTrainingNetGbp:completed.length?
     Math.max(...completed.map(x=>x.bestObservedTrainingNetGbp)):null,
   bestObservedTrainingWinRatePct:completed.length?
     Math.max(...completed.map(x=>x.bestObservedTrainingWinRatePct)):null,
   repeatedHistoryDoesNotCountAsIndependent:true,
   brokerOrders:0});
 }
 return {memory:next,reports,
  addedExperiments:next.experiments.length-memory.experiments.length,
  brokerOrders:0,independentForwardEvidence:0};
}
function ghHeaders(token){if(!token)throw Error('Missing GitHub Actions token');
 return {'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
 'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',
 'User-Agent':'Scalp-City-Safe-Research'};}
export async function fetchMemory({token,fetchImpl=fetch}={}){
 const response=await fetchImpl(API+'?ref='+MEMORY_BRANCH,{
  method:'GET',headers:ghHeaders(token),cache:'no-store'});
 if(!response.ok)throw Error('Cannot read existing research memory HTTP '+response.status);
 const meta=await response.json();
 if(!SHA.test(meta.sha||'')||typeof meta.content!=='string')
  throw Error('Research memory GitHub source returned invalid SHA/content');
 const memory=JSON.parse(Buffer.from(meta.content.replace(/\s/g,''),'base64').toString('utf8'));
 return {memory:checkMemory(memory),blobSha:meta.sha};
}
export async function persistMemory({token,expectedSha,previous,next,fetchImpl=fetch}={}){
 if(!SHA.test(expectedSha||''))throw Error('Expected memory revision required');
 checkMemory(previous);checkMemory(next);
 if(next.experiments.length<previous.experiments.length)throw Error('Research history cannot shrink');
 for(let i=0;i<previous.experiments.length;i++)
  if(JSON.stringify(next.experiments[i])!==JSON.stringify(previous.experiments[i]))
   throw Error('Research history must be append-only');
 if(next.experiments.length===previous.experiments.length)
  return {status:'NO_NEW_RESEARCH_EVIDENCE',written:false};
 const encoded=Buffer.from(JSON.stringify(next,null,2)+'\n','utf8').toString('base64');
 const response=await fetchImpl(API,{
  method:'PUT',headers:ghHeaders(token),
  body:JSON.stringify({
   message:'research: append per-chart parent-seeded training-only lessons',
   branch:MEMORY_BRANCH,sha:expectedSha,content:encoded
  })
 });
 if(!response.ok)throw Error('Memory save failed HTTP '+response.status+'; no presumed success');
 const result=await response.json();
 if(!SHA.test(result.commit?.sha||''))throw Error('Research commit did not return authenticated commit SHA');
 return {status:'PERSISTED_NEW_TRAINING_LESSONS',written:true,commitSha:result.commit.sha};
}
async function main(){
 const token=process.env.GITHUB_TOKEN;
 if(!token)throw Error('GITHUB_TOKEN required: no file-based fallback');
 const {memory:before,blobSha}=await fetchMemory({token});
 // Each scheduled cycle uses independently refreshed, completed read-only
 // Alpaca bars if provided. Never silently fall back to an older snapshot.
 const selectedDir=process.env.SCALP_RESEARCH_INPUT_DIR||'validation-data';
 const startedAt=new Date().toISOString(),startMs=performance.now();
 // Bounded multi-generation exploration on a locally archived dataset.
 // Do not expand independent evidence counts or inspect the sealed holdout.
 const batchesPerPupil=Number(process.env.SCALP_HISTORICAL_BATCH_PASSES||3);
 const result=await evaluateAll({memory:before,dataDir:selectedDir,batchesPerPupil});
 const elapsedMs=Math.max(.001,performance.now()-startMs);
 const saved=await persistMemory({token,expectedSha:blobSha,previous:before,next:result.memory});
 const {writeFile,mkdir}=await import('node:fs/promises');
 await mkdir('research-data',{recursive:true});
 // Measure *executed* historical simulations: normal + stress for every
 // candidate, separately over each nonoverlapping training fold.
 const candidates=result.reports.reduce((sum,r)=>sum+(r.testedParams||0),0);
 const evaluated=result.reports.reduce((sum,r)=>
   sum+(r.testedParams||0)*(r.chronologicalTrainingWindows||0)*2,0);
 const telemetry={schema:'SCALP_TRAINING_CYCLE_V1',startedAt,completedAt:new Date().toISOString(),
  evaluationDurationMs:Number(elapsedMs.toFixed(3)),
  candidateEvaluations:evaluated,uniqueCandidateConfigurations:candidates,
  batchesPerPupil,measuredBatchAttempts:result.reports.reduce((n,r)=>n+(r.researchBatchesAttempted||0),0),
  researchFolds:'PRE_HOLDOUT_NONOVERLAPPING_V1',
  evaluationsPerSecond:Number((1000*evaluated/elapsedMs).toFixed(2)),
  newlySavedLessons:result.addedExperiments,
  newTrainingCandles:result.reports.reduce((sum,r)=>sum+(r.newTrainingCandles||0),0),
  totalRewardCredits:result.reports.reduce((sum,r)=>sum+(r.rewardCreditsAwarded||0),0),
  persistence:saved.status,brokerOrders:0,verifiedForwardGrades:0,
  charts:result.reports.map(r=>({symbol:r.symbol,status:r.status,
   evaluations:(r.testedParams||0)*(r.chronologicalTrainingWindows||0)*2,
   configurations:r.testedParams||0,folds:r.chronologicalTrainingWindows||0,
   batchesAttempted:r.researchBatchesAttempted||1,savedExperiments:r.savedExperiments||0,
   newTrainingCandles:r.newTrainingCandles||0,
   rewardCredits:r.rewardCreditsAwarded||0,trainingEnd:r.trainingEnd||null,
   snapshotAt:r.snapshotAt||null}))};
 await writeFile('research-data/training-cycle-latest.json',JSON.stringify(telemetry,null,2)+'\n');
 console.log('TRAINING_CYCLE_TELEMETRY '+JSON.stringify(telemetry));
 console.log('ROBOT_TRAINING_CYCLE '+JSON.stringify({
  status:saved.status,savedCommit:saved.commitSha??null,
  priorExperiments:before.experiments.length,
  newExperiments:result.addedExperiments,
  charts:result.reports,
  dataDirectory:selectedDir,brokerOrders:0,liveForwardValidated:false,
  note:'Research only, no real funds. Historical re-runs never justify trader graduation or predict earnings.'
 }));
 if(saved.written){
  // Keep this available for a second, authorized publisher step; this is
  // generated from persisted training only, not hypothetical accounts.
  const {writeFile}=await import('node:fs/promises');
  await writeFile('scalp-academy-learning-updated.flag','MEMORY_SAVED '+saved.commitSha+'\n');
 }
}
const cli=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(cli)main().catch(e=>{console.error('RESEARCH_TRAINING_BLOCKED '+String(e.message||e).slice(0,220));process.exitCode=1});
