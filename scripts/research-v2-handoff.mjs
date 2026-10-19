// V2 -> Teacher review queue. Data only; never changes the Academy grade namespace.
// This module refuses to turn historical development into a paper admission.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PAIRS} from '../strategy-validation-core.mjs';
import {checkParams,toSimulator} from './run-robot-training.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function makeTeacherReviewQueue(report){
 if(!report||report.schema!=='SCALP_RESEARCH_V2_CANDIDATES'||
    report.admissionsIssued!==0||report.verifiedForwardGrades!==0||
    report.paperOrders!==0||report.liveOrders!==0||
    report.holdoutAccessedForSelection!==false||!Array.isArray(report.symbols)||
    report.symbols.length!==PAIRS.length)
   throw Error('V2 HANDOFF: invalid source or unexpected broker authority');
 const seen=new Set(),requests=[];
 for(const p of report.symbols){
   if(!PAIRS.includes(p.symbol)||seen.has(p.symbol)||p.sealedHoldout?.usedForSelection!==false||
     !Array.isArray(p.shortlisted)||p.shortlisted.length>3||p.brokerOrders!==0||
     p.teacherAdmission!==false)throw Error('V2 HANDOFF: invalid research pupil');
   seen.add(p.symbol);
   for(const candidate of p.shortlisted){
     checkParams(candidate.parameters);toSimulator(candidate.parameters);
     if(!Number.isFinite(candidate.netStressGbp)||candidate.netStressGbp<=0||
       !Number.isFinite(candidate.researchScore))
       throw Error('V2 HANDOFF: candidate lacking positive development stress score');
     requests.push({
       symbol:p.symbol,
       params:candidate.parameters,
       historicalDevelopmentId:sha([p.symbol,p.researchSnapshotHash,candidate.parameters]),
       sourceSnapshotFingerprint:p.researchSnapshotHash,
       developmentCandidateOnly:true,
       status:'WAITING_INDEPENDENT_LINEAGE_AND_UNSEEN_HOLDOUT',
       independentForwardTrades:0,
       paperAdmissionIssued:false
     });
   }
 }
 return {
   schema:'SCALP_V2_TEACHER_REVIEW_QUEUE',generatedAt:report.generatedAt,
   sourceReportDigest:sha(report),requests,requestedTotal:requests.length,
   teacherAutomaticAdmit:false,requiresIndependentAudit:true,
   paperOrders:0,liveOrders:0,verifiedForwardGrades:0,
   note:'Read-only candidate review queue, not a model enrollment, paper allocation or signed grade.'};
}
async function main(){
 const [infile,outfile]=process.argv.slice(2);
 if(!infile||!outfile)throw Error('USAGE: node scripts/research-v2-handoff.mjs <v2-report> <teacher-review-queue>');
 const r=makeTeacherReviewQueue(JSON.parse(await readFile(infile,'utf8')));
 await mkdir(path.dirname(outfile),{recursive:true});
 await writeFile(outfile,JSON.stringify(r,null,2)+'\n');
 console.log('V2_TEACHER_HANDOFF '+JSON.stringify({requests:r.requestedTotal,paperOrders:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('V2_HANDOFF_BLOCKED',String(e.message||e));process.exitCode=1;});
