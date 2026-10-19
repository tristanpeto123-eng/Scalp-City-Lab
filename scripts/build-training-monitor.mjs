// Public, read-only status of published historical research. NOT a live
// process stream and not proof of independence, predictive profit or broker fills.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkSnapshot,PAIRS,simulateValidation} from '../strategy-validation-core.mjs';
import {toSimulator} from './run-robot-training.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=x=>Number(x.toFixed(4));
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function buildTrainingMonitor({cycle,academy,snapshots,previous=null,now=new Date().toISOString()}={}){
 if(cycle?.schema!=='SCALP_TRAINING_CYCLE_V1'||academy?.schema!=='ROBOT_ACADEMY_RESEARCH_V1'||
   cycle.brokerOrders!==0||academy.actualBrokerOrders!==0||
   academy.verifiedForwardGrades!==0||!validTime(now)||!Array.isArray(academy.pupils)||
   academy.pupils.length!==10||PAIRS.some(s=>!snapshots?.[s]))
   throw Error('TRAINING_MONITOR: invalid research-only source');
 const lastSaved=cycle.newlySavedLessons>0?cycle.completedAt:
   (previous?.schema==='SCALP_TRAINING_MONITOR_V1'?previous.lastSuccessfulLessonAt:null);
 const samples=PAIRS.map(symbol=>{
   const source=snapshots[symbol],checked=checkSnapshot(source,symbol,Date.parse(now));
   const pupil=academy.pupils.find(p=>p.symbol===symbol);
   const candidate=pupil?.researchLeader;
   const cut=Math.floor(checked.bars.length*.4),limit=Math.floor(checked.bars.length*.8);
   const sample=checked.bars.slice(cut,limit);
   const start=new Date(sample[0].t).toISOString();
   const end=new Date(sample.at(-1).t+900000).toISOString();
   const previousSample=previous?.schema==='SCALP_TRAINING_MONITOR_V1'?
     previous.outOfSample?.charts?.find(x=>x.symbol===symbol):null;
   const skeleton={symbol,status:'NOT_EVALUATED',start,end,candles:sample.length,
     developmentOnly:true,forwardVerified:false,improvementGbp:null,
     improvementStatus:'NO_COMPARABLE_NEW_WINDOW'};
   // A selected training record cannot be evaluated on its own training bars.
   if(!candidate||!validTime(candidate.trainedThrough)||
      Date.parse(candidate.trainedThrough)>Date.parse(start))
      return {...skeleton,status:'NO_FROZEN_EARLIER_CANDIDATE'};
   const modelHash=hash(candidate.parameters);
   const sampleHash=hash(sample.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v]));
   const selected=toSimulator(candidate.parameters);
   const segment={...source,bars:source.bars.slice(cut,limit)};
   const normal=simulateValidation({snapshot:segment,symbol,
     startingBalanceGbp:50,mode:'duration',limit:365,
     feePerSideFraction:.0025,now:Date.parse(now),...selected});
   const stress=simulateValidation({snapshot:segment,symbol,
     startingBalanceGbp:50,mode:'duration',limit:365,
     feePerSideFraction:.005,now:Date.parse(now),...selected});
   const netGbp=round(normal.realizedNetProfitGbp);
   const sameModel=previousSample?.modelHash===modelHash;
   const differentWindow=previousSample?.sampleHash!==sampleHash;
   // Differences between two development slices are descriptive even when
   // they have new data: their times can overlap and are NOT independent.
   const comparable=previousSample?.status==='OBSERVED_DEVELOPMENT_OOS'&&
     sameModel&&differentWindow&&Number.isFinite(previousSample.netGbp);
   return {...skeleton,status:'OBSERVED_DEVELOPMENT_OOS',
     sourceSnapshotAt:source.generatedAt??null,modelHash,sampleHash,
     netGbp,stressNetGbp:round(stress.realizedNetProfitGbp),
     closedTrades:normal.closedTrades,maxDrawdownPct:round(normal.maxDrawdownPct),
     winRatePct:round(normal.winRatePct??0),
     improvementGbp:comparable?round(netGbp-previousSample.netGbp):null,
     improvementStatus:comparable?'DESCRIPTIVE_WINDOW_CHANGE_NOT_INDEPENDENT':
       previousSample&&sameModel&&!differentWindow?'UNCHANGED_WINDOW_NO_NEW_EVIDENCE':
       'NO_COMPARABLE_NEW_WINDOW'};
 });
 const measured=samples.filter(s=>s.status==='OBSERVED_DEVELOPMENT_OOS');
 return {schema:'SCALP_TRAINING_MONITOR_V1',publishedAt:now,
   lastSuccessfulLessonAt:lastSaved,
   lastMeasuredCycle:cycle,
   scheduleMinutes:5,snapshotRefreshHours:6,
   rewardCredits:academy.pupils.reduce((a,p)=>a+(p.learningCredits?.points||0),0),
   trainingOnly:true,brokerOrders:0,verifiedForwardGrades:0,
   outOfSample:{status:'CHRONOLOGICAL_DEVELOPMENT_ONLY_NOT_SEALED_HOLDOUT',
     evaluatedPupils:measured.length,positivePupils:measured.filter(s=>s.netGbp>0&&s.stressNetGbp>0).length,
     improvementMeasuredPupils:measured.filter(s=>s.improvementGbp!==null).length,
     note:'Later 40%-80% historical development segment, not selection input. Sealed final 20% untouched. Reused/overlapping windows are not new independent evidence.',
     charts:samples}};
}
async function main(){
 const cycle=JSON.parse(await readFile('research-data/training-cycle-latest.json','utf8'));
 const academy=JSON.parse(await readFile('research-data/robot-academy.json','utf8'));
 const priorPath='research-data/training-monitor.json';
 let previous=null;
 try{previous=JSON.parse(await readFile(priorPath,'utf8'));}catch{}
 // Repeated no-op Actions runs remain visible via the GitHub Actions API,
 // without flooding main with 288 identical dashboard commits each day.
 if(previous&&cycle.candidateEvaluations===0&&cycle.newlySavedLessons===0){
   console.log('TRAINING_MONITOR_NO_NEW_EVALUATIONS; Actions run remains externally visible');
   return;
 }
 const snapshots={};
 for(const symbol of PAIRS)snapshots[symbol]=JSON.parse(await readFile(
   path.join('validation-data',symbol.replace('/','-')+'.json'),'utf8'));
 const report=buildTrainingMonitor({cycle,academy,snapshots,previous});
 await mkdir('research-data',{recursive:true});
 await writeFile(priorPath,JSON.stringify(report,null,2)+'\n');
 console.log('TRAINING_MONITOR_PUBLISHED '+JSON.stringify({
   evaluations:cycle.candidateEvaluations,evalPerSec:cycle.evaluationsPerSecond,
   newTrainingCandles:cycle.newTrainingCandles,
   oosMeasured:report.outOfSample.evaluatedPupils,
   independentlyVerified:0,paperOrders:0}));
}
if(import.meta.url==='file://'+process.argv[1])main().catch(e=>{
 console.error('TRAINING_MONITOR_BLOCKED '+String(e.message));process.exitCode=1;
});
