// Independent research-to-Teacher lineage audit. Read-only: no admissions,
// data repair by guessing or broker calls. Histories that no longer match the
// frozen source window MUST stay blocked for human review.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';
import {checkMemory} from './run-robot-training.mjs';
import {buildAcademySnapshot} from './export-robot-academy.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const candleTime=x=>new Date(x).toISOString();
export function explainCandidateLineage(memory,pupil,bars){
 const symbol=pupil?.symbol,leader=pupil?.researchLeader;
 if(!PAIRS.includes(symbol))throw Error('TEACHER_LINEAGE: unknown crypto pupil');
 if(!leader)return {symbol,status:'NO_ACCEPTED_ELIGIBLE_LEADER',
   reasons:['NO_LEADER_FROM_ACCEPTED_HISTORY'],sampleSourceMatched:false};
 const experiment=memory.experiments.find(e=>e.id===leader.sourceExperimentId);
 if(!experiment||experiment.symbol!==symbol||experiment.feed!=='us-1'||
  !experiment.acceptedForLearning||
  experiment.trainingEnd!==leader.trainedThrough||
  !experiment.trainingOptions.some(o=>JSON.stringify(o.params)===JSON.stringify(leader.parameters)))
  return {symbol,status:'RESEARCH_LINEAGE_MISMATCH',
   reasons:['LEADER_NOT_FROM_ACCEPTED_IMMUTABLE_EXPERIMENT'],
   sampleSourceMatched:false,sourceExperimentId:leader.sourceExperimentId};
 const start=Date.parse(experiment.trainingStart),end=Date.parse(experiment.trainingEnd);
 const rows=bars.filter(b=>b.t>=start&&b.t<end);
 const startMatched=rows.length>0&&rows[0].t===start;
 const endMatched=rows.length>0&&rows.at(-1).t+900000===end;
 const fingerprint=hash(rows.map(b=>[candleTime(b.t),b.o,b.h,b.l,b.c,b.v]));
 const match=rows.length>=480&&startMatched&&endMatched&&
   fingerprint===experiment.trainFingerprint;
 const reasons=[];
 if(rows.length<480||!startMatched||!endMatched)reasons.push('FROZEN_TRAINING_WINDOW_NOT_ARCHIVED_CONTIGUOUSLY');
 if(fingerprint!==experiment.trainFingerprint)reasons.push('FROZEN_CANDLE_FINGERPRINT_MISMATCH');
 return {symbol,status:match?'SOURCE_MATCHES_FROZEN_RESEARCH':'SOURCE_WINDOW_MISSING_OR_CHANGED',
  sampleSourceMatched:match,acceptedForLearning:true,
  sourceExperimentId:experiment.id,trainingStart:experiment.trainingStart,
  trainingEnd:experiment.trainingEnd,availableTrainingCandles:rows.length,
  reasons,brokerOrders:0,forwardVerified:false,admissionsIssued:0};
}
export function diagnoseTeacherLineage({memory,academy,snapshots}){
 checkMemory(memory);
 if(!academy||academy.pupils?.length!==PAIRS.length||
  new Set(academy.pupils.map(p=>p.symbol)).size!==PAIRS.length)
  throw Error('TEACHER_LINEAGE: ten unique Academy pupils required');
 const pupils=PAIRS.map(symbol=>{
  const bars=snapshots?.[symbol]?.bars;
  if(!Array.isArray(bars))return {symbol,status:'SOURCE_SNAPSHOT_MISSING',
    sampleSourceMatched:false,reasons:['READ_ONLY_MARKET_SOURCE_MISSING'],brokerOrders:0};
  return explainCandidateLineage(memory,academy.pupils.find(p=>p.symbol===symbol),bars);
 });
 return {schema:'TEACHER_LINEAGE_DIAGNOSTICS_V1',pupilsTotal:10,
  candidatesPresent:pupils.filter(x=>x.sourceExperimentId).length,
  sourceMatches:pupils.filter(x=>x.sampleSourceMatched).length,
  sourceBlocked:pupils.filter(x=>!x.sampleSourceMatched).length,
  pupils,brokerOrders:0,admissionsIssued:0,verifiedForwardGrades:0,
  note:'Research lineage diagnostics only; source matching does NOT imply Teacher qualification, profit or broker permission.'};
}
async function main(){
 const [memoryFile,sourceDir,outputFile]=process.argv.slice(2);
 if(!memoryFile||!sourceDir||!outputFile||process.argv.length!==5)
  throw Error('USAGE: node scripts/teacher-lineage-diagnostics.mjs <memory> <snapshotDir> <newReport>');
 const memory=JSON.parse(await readFile(memoryFile,'utf8'));
 const academy=buildAcademySnapshot(memory),snapshots={};
 for(const symbol of PAIRS){
  const d=JSON.parse(await readFile(path.join(sourceDir,symbol.replace('/','-')+'.json'),'utf8'));
  snapshots[symbol]=checkSnapshot(d,symbol);
 }
 const report=diagnoseTeacherLineage({memory,academy,snapshots});
 await mkdir(path.dirname(path.resolve(outputFile)),{recursive:true});
 await writeFile(outputFile,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('TEACHER_LINEAGE_DIAGNOSTICS '+JSON.stringify({
  candidatesPresent:report.candidatesPresent,sourceMatches:report.sourceMatches,
  sourceBlocked:report.sourceBlocked,admissions:0,brokerOrders:0
 }));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('TEACHER_LINEAGE_BLOCKED',String(e.message||e));process.exitCode=1;});
