/** Import one existing 15m commodity dataset as a segregated neural research experiment.
 * Reads a local CSV; does not fetch, publish candles, or open brokerage connections.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {parseDiscoveryCSV,discoverOpportunities} from '../academy/opportunity-discovery.mjs';
import {trainAcademyTeacher} from '../academy/teacher-training.mjs';
import {researchLevelTransitions} from '../academy/price-level-intelligence.mjs';
export const TRAINING_SET_SCHEMA='ACADEMY_COMMODITY_SET_V1';
export async function importCommodityTrainingSet(inputPath,{symbol,outputDir,origin='USER_SUPPLIED_UNVERIFIED'}={}){
 if(!inputPath||!outputDir||!['XAUUSD','XAGUSD'].includes(symbol))throw Error('Usage: node scripts/import-commodity-training-set.mjs <XAUUSD|XAGUSD> <15min.csv> <output-dir>');
 if(!['USER_SUPPLIED_UNVERIFIED','PUBLIC_SAMPLE_UNVERIFIED'].includes(origin))throw Error('Unknown source provenance');
 const source=resolve(inputPath),out=resolve(outputDir);
 if(source===out||out.startsWith(source+'/'))throw Error('Output cannot overwrite data input');
 const raw=await readFile(source,'utf8');
 const digest=createHash('sha256').update(raw).digest('hex');
 const csv=raw.replace(/^(\uFEFF)?datetime,/i,'time,');
 const bars=parseDiscoveryCSV(csv,{timeframe:'15Min'});
 const first=Date.parse(bars[0].t),last=Date.parse(bars.at(-1).t);
 const discovery={...discoverOpportunities({bars,symbol,timeframe:'15Min'}),
  sourceSha256:digest,sourceOrigin:origin};
 const {checkpoint,report}=trainAcademyTeacher(discovery);
 // Shared PLI is a separate per-market, training-only evidence stream; the legacy Teacher weights are unchanged.
 const pli=researchLevelTransitions({bars,symbol,timeframe:'15Min',sourceSha256:digest});
 if(checkpoint.symbol!==symbol||checkpoint.timeframe!=='15Min'||checkpoint.enabledForBroker!==false||
    report.independentFinalTestEvaluated!==false||report.verifiedForwardGrades!==0||report.paperOrders!==0)
  throw Error('Checker: market separation or trading safety violated');
 const experimentId=symbol+'-15Min-'+digest.slice(0,16);
 const manifest={
  schema:TRAINING_SET_SCHEMA,experimentId,market:'COMMODITIES',symbol,timeframe:'15Min',
  sourceOrigin:origin,sourceSha256:digest,sourceVerified:false,sourceRedistributed:false,
  first:bars[0].t,last:bars.at(-1).t,calendarDays:Number(((last-first)/86400000).toFixed(3)),
  candles:bars.length,marketClosureGaps:discovery.dataset.gaps,
  sealedTestCandles:discovery.dataset.sealedTestCandles,
  sealedTestEvaluated:false,
  discoverySummary:discovery.summary,
  reportSha256:report.checkpointSha256,virtualTradingOnly:true,brokerOrders:0,
  researchModelType:'LEGACY_NEURAL_BASELINE',
  studentSkillsContractVersion:report.studentSkillAudit.schema,
  priceLevelIntelligence:{schema:pli.report.schema,modelSha256:pli.report.modelSha256,
   sourceSha256:digest,fitSignalGroups:pli.report.learning.fitSignalGroups,
   development:pli.report.development,abstained:pli.report.learning.abstained,
   finalTestEvaluated:false,brokerEligible:false},
  studentMissingSkillIds:report.studentSkillAudit.missingSkillIds,
  studentSkillQualified:report.studentSkillAudit.fullSkillStackImplemented,
  independentExamEligible:report.studentSkillAudit.independentExamEligible,
  brokerPaperEligible:false,
  sourceInstrumentQuoteConventionVerified:false,
  overlappingPeriodsMustNotBeCountedAsIndependentEvidence:true,
  minimum360CalendarDaysReached:(last-first)>=360*86400000,
  limitations:['Historical 15-minute candles cannot be made into authentic 5-minute candles',
   'The source dataset may overlap with other trading experiments',
   'Training and development gains cannot replace unseen independent examination']};
 await mkdir(out,{recursive:true});
 // Existing versions are immutable; no silently overwriting a previous experiment.
 const prefix=join(out,experimentId);
 await writeFile(prefix+'-manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-teacher-report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-pli-report.json',JSON.stringify(pli.report,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-pli-model.json',JSON.stringify(pli.model,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-pli-memory.json',JSON.stringify(pli.memory,null,2)+'\n',{flag:'wx'});
 return {manifest,development:report.development,
  developmentProfitGatePassed:report.developmentProfitGatePassed,
  checkpointSha256:report.checkpointSha256,pliDevelopment:pli.report.development,
  pliAbstained:pli.report.learning.abstained};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 importCommodityTrainingSet(process.argv[3],{symbol:process.argv[2],outputDir:process.argv[4],
   origin:process.argv[5]||'USER_SUPPLIED_UNVERIFIED'})
 .then(r=>console.log(JSON.stringify({manifest:r.manifest,development:r.development,
  developmentProfitGatePassed:r.developmentProfitGatePassed,checkpointSha256:r.checkpointSha256},null,2)))
 .catch(e=>{console.error('COMMODITY_TRAINING_IMPORT_FAILED:',e.message);process.exitCode=1;});