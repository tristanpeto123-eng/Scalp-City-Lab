// Independent admission screen; no Alpaca broker operations or secret access.
// Input research-memory comes from separate immutable GitHub branch checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PAIRS} from '../strategy-validation-core.mjs';
import {checkMemory} from '../scripts/run-robot-training.mjs';
import {checkResearch} from './public-client.mjs';
import {DailyGBPReference} from './fx-reference.mjs';
import {screen} from './admit.mjs';
import {MAX_PAPER_SLOTS} from './hosted-preflight.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const safeDate=x=>typeof x==='string'&&!Number.isNaN(Date.parse(x));
export async function assess({memory,research,snapshotsDir,fx,readFile=fs.readFile,
 now=Date.now()}={}){
 const archive=checkMemory(memory),academy=checkResearch(research);
 if(!fx||fx.source!=='FRANKFURTER_ECB_REFERENCE'||!Number.isFinite(fx.gbpPerUsd)||fx.gbpPerUsd<=0)
   throw Error('QUALIFICATION: trusted reference exchange rate required');
 if(!Array.isArray(academy.pupils)||academy.pupils.length!==PAIRS.length||
    new Set(academy.pupils.map(x=>x.symbol)).size!==PAIRS.length)
   throw Error('QUALIFICATION: ten unique source-backed pupils required');
 const screened=await screen({memory:archive,research:academy,dataDir:snapshotsDir,
   read:readFile,fx,now,admit:false});
 if(screened.signed.length)throw Error('QUALIFICATION: screening attempted to issue admissions');
 if(screened.reports.length!==PAIRS.length)throw Error('QUALIFICATION: incomplete audit cohort');
 const pupils=screened.reports.map(item=>{
   const p=academy.pupils.find(x=>x.symbol===item.symbol),r=p?.researchLeader;
   if(!p||!r)throw Error('QUALIFICATION: missing research leader');
   const reasons=[...new Set([
      ...(r.trainingNetGbp<=0?['NEGATIVE_OR_ZERO_TRAINING_PROFIT']:[]),
      ...(r.trainingClosedTrades<30?['UNDER_30_TRAINING_CLOSES']:[]),
      ...((item.reasons||[]).map(x=>'AUDIT: '+String(x).slice(0,135)))
   ])];
   return {symbol:item.symbol,trainingTrades:r.trainingClosedTrades,
     trainingNetGbp:r.trainingNetGbp,trainingWinRatePct:r.trainingWinRatePct,
     trainingEnd:r.trainedThrough,holdoutNetGbp:item.holdoutNetGbp??null,
     doubleCostNetGbp:item.doubledCostNetGbp??null,
     holdoutCandles:item.unseenCandles??null,
     ready:item.ready===true&&reasons.length===0,
     verdict:item.ready===true&&reasons.length===0?'PASS':'BLOCKED',
     reasons};
 });
 // This is a shortlist, never an admission or automatic account assignment.
 const eligible=pupils.filter(p=>p.ready);
 return {
   schema:'TEACHER_INDEPENDENT_QUALIFICATION_V1',
   status:eligible.length?'REVIEW_REQUIRED':'NO_ADMISSIBLE_PUPILS',
   source:'INDEPENDENT_HISTORICAL_SCREEN_NO_PAPER_ORDERS',
   checkedAt:new Date(now).toISOString(),
   latestResearchTrainingEnd:research.latestTrainingEnd,
   memoryExperiments:memory.experiments.length,
   memoryDigest:hash(JSON.stringify(memory)),
   academyDigest:hash(JSON.stringify(research)),
   availablePaperSlots:MAX_PAPER_SLOTS,
   pupilsTotal:PAIRS.length,
   admissionsIssued:0,brokerOrdersSubmitted:0,verifiedForwardGrades:0,
   eligibleCount:eligible.length,
   shortlistedSymbols:eligible.slice().sort((a,b)=>(b.doubleCostNetGbp||0)-(a.doubleCostNetGbp||0)).slice(0,MAX_PAPER_SLOTS).map(p=>p.symbol),
   blockedCount:PAIRS.length-eligible.length,pupils,
   note:'Historical screening only. NEVER activate PAPER orders, sign admissions, or infer fill validation without independent review and separate release authorization.'
 };
}
async function main(){
 const root=path.dirname(fileURLToPath(import.meta.url));
 const [memoryFile,academyFile,snapshotsDir,outputFile]=process.argv.slice(2);
 if(!memoryFile||!academyFile||!snapshotsDir||!outputFile)
   throw Error('USAGE: node teacher/qualification-runner.mjs <trusted-memory> <academy> <snapshots-directory> <report-output>');
 const [memory,research]=await Promise.all([
  fs.readFile(memoryFile,'utf8').then(JSON.parse),
  fs.readFile(academyFile,'utf8').then(JSON.parse)
 ]);
 const now=Date.now();
 const fx=await new DailyGBPReference().on(new Date(now).toISOString());
 const report=await assess({memory,research,snapshotsDir:path.resolve(snapshotsDir),fx,now});
 await fs.mkdir(path.dirname(outputFile),{recursive:true});
 await fs.writeFile(outputFile,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log('INDEPENDENT_QUALIFICATION_REPORT',JSON.stringify({
  status:report.status,eligibleCount:report.eligibleCount,blockedCount:report.blockedCount,
  availablePaperSlots:report.availablePaperSlots,shortlistedSymbols:report.shortlistedSymbols,
  pupils:report.pupils.map(p=>({symbol:p.symbol,verdict:p.verdict,
   trainingTrades:p.trainingTrades,trainingNetGbp:p.trainingNetGbp,
   holdoutNetGbp:p.holdoutNetGbp,reasons:p.reasons})),
  admissionsIssued:0,brokerOrdersSubmitted:0
 }));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('QUALIFICATION_BLOCKED',String(e.message||e));process.exitCode=1;});
