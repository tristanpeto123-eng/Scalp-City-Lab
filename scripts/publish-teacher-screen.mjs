// Public historical qualification digest, derived ONLY from independent Teacher report.
// Never publishes a brokerage admission, signed paper grade or account credential.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {PAIRS} from '../strategy-validation-core.mjs';
const sha=/^[a-f0-9]{64}$/;
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function publicQualification(report){
 if(report?.schema!=='TEACHER_INDEPENDENT_QUALIFICATION_V1'||
  report.source!=='INDEPENDENT_HISTORICAL_SCREEN_NO_PAPER_ORDERS'||
  report.admissionsIssued!==0||report.brokerOrdersSubmitted!==0||
  report.verifiedForwardGrades!==0||report.availablePaperSlots!==3||
  !sha.test(report.memoryDigest)||!sha.test(report.academyDigest)||
  !iso(report.checkedAt)||!iso(report.latestResearchTrainingEnd)||
  report.pupilsTotal!==10||!Array.isArray(report.pupils)||report.pupils.length!==10)
  throw Error('QUALIFICATION_PUBLIC: unsigned historical audit has invalid source or permissions');
 const seen=new Set();
 const pupils=report.pupils.map(x=>{
  if(!PAIRS.includes(x.symbol)||seen.has(x.symbol)||!['PASS','BLOCKED'].includes(x.verdict)||
     typeof x.ready!=='boolean'||x.ready!==(x.verdict==='PASS')||
     !Number.isInteger(x.trainingTrades)||x.trainingTrades<0||
     !Number.isFinite(x.trainingNetGbp)||
     !Array.isArray(x.reasons)||x.reasons.some(s=>typeof s!=='string'||s.length>160)||
     (x.ready&&x.reasons.length!==0)||
     !iso(x.trainingEnd))throw Error('QUALIFICATION_PUBLIC: invalid pupil verdict');
  seen.add(x.symbol);
  return {
   symbol:x.symbol,verdict:x.verdict,trainingTrades:x.trainingTrades,
   trainingNetGbp:x.trainingNetGbp,trainingWinRatePct:x.trainingWinRatePct,
   historicalHoldoutNetGbp:x.holdoutNetGbp??null,
   doubleCostNetGbp:x.doubleCostNetGbp??null,
   lastTrainingSample:x.trainingEnd,reasons:x.reasons.slice(0,12)
  };
 });
 if(PAIRS.some(x=>!seen.has(x))||pupils.filter(x=>x.verdict==='PASS').length!==report.eligibleCount||
  report.blockedCount!==10-report.eligibleCount||
  !['REVIEW_REQUIRED','NO_ADMISSIBLE_PUPILS'].includes(report.status)||
  (report.status==='NO_ADMISSIBLE_PUPILS')!==(report.eligibleCount===0))
  throw Error('QUALIFICATION_PUBLIC: incomplete cohort or contradictory verdict');
 return {
  schema:'TEACHER_PUBLIC_HISTORICAL_SCREEN_V1',source:'INDEPENDENT_HISTORICAL_SCREEN_NO_PAPER_ORDERS',
  checkedAt:report.checkedAt,lastResearchTrainingEnd:report.latestResearchTrainingEnd,
  academySourceSha256:report.academyDigest,memorySourceSha256:report.memoryDigest,
  eligibleCount:report.eligibleCount,screenedCount:10,
  slotsCap:3,admissionsIssued:0,brokerOrdersSubmitted:0,
  verifiedForwardGrades:0,trainingOnly:true,
  status:report.status,pupils,
  caveat:'An independent HISTORICAL screen is not PAPER admission, forward fill evidence, or a signed official grade. Historical candidates require separate risk review and owner approval.'
 };
}
async function main(){
 const input=process.argv[2]||'qualification-results/report.json';
 const output=process.argv[3]||'research-data/teacher-qualification.json';
 const report=JSON.parse(await readFile(input,'utf8'));
 const result=publicQualification(report);
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log('PUBLIC_QUALIFICATION_NO_ORDERS',result.eligibleCount);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error(String(e));process.exitCode=1});
