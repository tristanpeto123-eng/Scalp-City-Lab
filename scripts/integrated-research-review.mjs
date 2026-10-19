// Read-only integration: market data -> research -> development folds ->
// independently sourced Teacher screening -> Academy review artifacts.
// NEVER writes to scalp-learning-memory, Railway, an account or the live Academy.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';
import {checkMemory,evaluateAll} from './run-robot-training.mjs';
import {historicalLab} from './historical-lab.mjs';
import {buildAcademySnapshot} from './export-robot-academy.mjs';
import {assess} from '../teacher/qualification-runner.mjs';
import {screen} from '../teacher/admit.mjs';
import {DailyGBPReference} from '../teacher/fx-reference.mjs';

const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const age=(now,iso)=>now-Date.parse(iso);
const DAY=86400000;
const noOrders=Object.freeze({paperOrders:0,liveOrders:0,admissions:0,verifiedForwardGrades:0});
function assert(cond,msg){if(!cond)throw Error('INTEGRATION_BLOCKED: '+msg);}
function pairsMatch(rows){
 return Array.isArray(rows)&&rows.length===PAIRS.length&&
  new Set(rows.map(p=>p.symbol)).size===PAIRS.length&&
  PAIRS.every(symbol=>rows.some(p=>p.symbol===symbol));
}
function verifyFX(fx,now){
 assert(fx?.source==='FRANKFURTER_ECB_REFERENCE'&&
  Number.isFinite(fx.gbpPerUsd)&&fx.gbpPerUsd>0&&
  /^\d{4}-\d{2}-\d{2}$/.test(fx.date||'')&&
  age(now,fx.date+'T00:00:00Z')>=0&&age(now,fx.date+'T00:00:00Z')<=5*DAY,
  'fresh external reference GBP/USD rate required');
}

// All in-memory model outputs are proposals. The auditor receives the immutable
// source snapshot and does not consult optimiser scores or any broker.
export async function integratedResearchReview({
 memory,snapshots,fx,now=Date.now(),maxCandleAgeDays=14
}={}){
 checkMemory(memory);
 assert(snapshots&&typeof snapshots==='object','ten source snapshots required');
 assert(Number.isFinite(now)&&now>0,'real evaluation timestamp required');
 verifyFX(fx,now);
 assert(Number.isFinite(maxCandleAgeDays)&&maxCandleAgeDays>0&&
  maxCandleAgeDays<=14,'candle freshness limit invalid');
 const source={},snapshotFingerprints={};
 for(const symbol of PAIRS){
  const snapshot=snapshots[symbol];
  const checked=checkSnapshot(snapshot,symbol,now);
  const last=Date.parse(checked.sampleEnd);
  assert(last<=now&&now-last<=maxCandleAgeDays*DAY,
    'stale historical candle window for '+symbol);
  source[symbol]=snapshot;
  snapshotFingerprints[symbol]=digest(snapshot);
 }
 // One snapshot accessor shared by the research engine and independent auditor.
 const read=async pathname=>{
  const match=PAIRS.find(s=>basename(pathname)===s.replace('/','-')+'.json');
  assert(match,'unsupported source path requested');
  return JSON.stringify(source[match]);
 };
 const beforeDigest=digest(memory);
 const research=await evaluateAll({memory,dataDir:'validation-data',read,now});
 assert(research.brokerOrders===0&&research.independentForwardEvidence===0,
   'research may not claim broker execution');
 // Development folds use only the development portion and quarantine final 20%.
 const lab=historicalLab({memory:research.memory,snapshots:source,now});
 assert(lab.quarantinedHoldoutNotScored===true&&lab.brokerOrders===0&&
   lab.admissionCount===0&&lab.verifiedForwardGrades===0,
   'development folds breached quarantine');
 const academy=buildAcademySnapshot(research.memory);
 assert(academy.actualBrokerOrders===0&&academy.verifiedForwardGrades===0&&
   pairsMatch(academy.pupils)&&academy.pupils.every(p=>
     p.confirmedForward===false&&p.championModel===null),
   'unverified grade or pupil substituted');
 // The existing full-cohort Teacher CLI assumes every chart already has
 // >=20 research closes. For a younger chart, screen separately with the same
 // independent auditor and mark its missing leader as BLOCKED, never invent it.
 let qualification;
 const cohortComplete=academy.pupils.every(p=>p.researchLeader!==null);
 if(cohortComplete){
  qualification=await assess({memory:research.memory,research:academy,
   snapshotsDir:'validation-data',read,fx,now});
 }else{
  const screened=await screen({memory:research.memory,research:academy,
   dataDir:'validation-data',read,fx,now,admit:false});
  assert(screened.signed.length===0&&pairsMatch(screened.reports),
    'auditor failed to review incomplete pupil cohort');
  const pupils=academy.pupils.map(p=>{
   const r=screened.reports.find(q=>q.symbol===p.symbol);
   const leader=p.researchLeader;
   const reasons=[...(leader?[]:['NO_RESEARCH_LEADER_MINIMUM_20_CLOSES']),
     ...r.reasons.map(x=>'AUDIT: '+String(x).slice(0,150))];
   return {symbol:p.symbol,trainingTrades:leader?.trainingClosedTrades??0,
    trainingNetGbp:leader?.trainingNetGbp??null,
    trainingWinRatePct:leader?.trainingWinRatePct??null,
    holdoutNetGbp:r.holdoutNetGbp??null,
    doubleCostNetGbp:r.doubledCostNetGbp??null,
    verdict:r.ready&&leader?'PASS':'BLOCKED',
    reasons};
  });
  qualification={schema:'TEACHER_INDEPENDENT_QUALIFICATION_V1',
   status:'INCOMPLETE_RESEARCH_COHORT',
   academyDigest:digest(academy),
   eligibleCount:pupils.filter(x=>x.verdict==='PASS').length,
   availablePaperSlots:3,admissionsIssued:0,brokerOrdersSubmitted:0,
   verifiedForwardGrades:0,pupils};
 }
 assert(qualification.academyDigest===digest(academy)&&
   qualification.admissionsIssued===0&&qualification.brokerOrdersSubmitted===0&&
   qualification.verifiedForwardGrades===0&&pairsMatch(qualification.pupils),
   'qualification diverged from frozen Academy candidate');
 const results=PAIRS.map(symbol=>{
  const pupil=academy.pupils.find(x=>x.symbol===symbol);
  const q=qualification.pupils.find(x=>x.symbol===symbol);
  const historical=lab.pupils.find(x=>x.symbol===symbol);
  assert(q.trainingTrades===pupil.researchLeader?.trainingClosedTrades&&
    q.trainingNetGbp===(pupil.researchLeader?.trainingNetGbp??null),
    'research/Teacher candidate mismatch: '+symbol);
  assert(historical.heldOutQuarantine.usedForModelSelection===false&&
    historical.orders===0&&historical.modelPromotion===false,
    'development stage attempted promotion');
  return {symbol,source:'ALPACA_KRAKEN_US_US-1',snapshotDigest:snapshotFingerprints[symbol],
    candidateExperimentId:pupil.researchLeader?.sourceExperimentId??null,
    modelParameters:pupil.researchLeader?.parameters??null,
    trainingNetGbp:q.trainingNetGbp,trainingClosedTrades:q.trainingTrades,
    trainingWinRatePct:q.trainingWinRatePct,
    separateDevelopmentFoldCount:historical.developmentFoldCount,
    developmentHoldoutQuarantined:true,
    independentHistoricalScreen:q.verdict,
    screenReasons:q.reasons,
    independentHoldoutNetGbp:q.holdoutNetGbp,
    stressHoldoutNetGbp:q.doubleCostNetGbp,
    proposedAction:q.verdict==='PASS'?'OWNER_REVIEW_REQUIRED':'RESEARCH_MORE',
    realPaperTrades:0,brokerGrade:null};
 });
 const report={
  schema:'SCALP_INTEGRATED_RESEARCH_REVIEW_V1',
  status:qualification.eligibleCount?'HISTORICAL_SHORTLIST_FOR_OWNER_REVIEW':'NO_ADMISSIBLE_HISTORICAL_MODELS',
  reviewedAt:new Date(now).toISOString(),
  pipeline:['VALIDATE_SOURCE','TRAIN_CANDIDATES','DEVELOPMENT_FOLDS',
    'FREEZE_ACADEMY_CANDIDATE','INDEPENDENT_TEACHER_SCREEN','REPORT_ONLY'],
  market:'CRYPTO_15MIN',
  researchMemoryBeforeSha256:beforeDigest,
  researchMemoryCandidateSha256:digest(research.memory),
  researchExperimentsAdded:research.addedExperiments,
  modelPolicy:'GBP50-PROFIT2000-v2',
  academyCandidateSha256:digest(academy),
  independentQualificationAcademySha256:qualification.academyDigest,
  researchSymbols:PAIRS.length,
  historicalScreenPasses:qualification.eligibleCount,
  availablePaperSeats:qualification.availablePaperSlots,
  fxReferenceDate:fx.date,fxSource:fx.source,
  otherSystems:{
   supplyScout:'SEPARATE_EQUITY_NEWS_RESEARCH_NOT_IMPUTED_TO_CRYPTO',
   strategyLab:'SEPARATE_EQUITY_BACKTEST_NOT_IMPUTED_TO_CRYPTO'
  },
  provenanceWarning:'Historical performance is not paper-forward evidence or a profitability guarantee. Overlapping development folds are not independent samples.',
  controls:noOrders,
  pupils:results
 };
 return {report,academy,qualification,development:lab,candidateMemory:research.memory};
}

export async function writeReviewArtifacts(outputDir,result){
 const root=resolve(outputDir);
 await mkdir(root,{recursive:true});
 // Fail rather than overwrite a prior evidence bundle.
 for(const [filename,object] of [
  ['research-integration-review.json',result.report],
  ['academy-candidate.json',result.academy],
  ['historical-development.json',result.development],
  ['independent-qualification.json',result.qualification],
  ['candidate-memory-NOT-PUBLISHED.json',result.candidateMemory]
 ]){
  await writeFile(join(root,filename),JSON.stringify(object,null,2)+'\n',
    {encoding:'utf8',flag:'wx',mode:0o600});
 }
 return root;
}
async function main(){
 const [memoryPath,snapshotDir,outDir]=process.argv.slice(2);
 if(!memoryPath||!snapshotDir||!outDir||process.argv.length!==5)
  throw Error('USAGE: node scripts/integrated-research-review.mjs <archived-memory.json> <snapshot-dir> <fresh-output-dir>');
 if(process.env.TEACHER_PAPER_ENABLED==='true'||
    process.env.SCALP_PAPER_ENABLED==='true')
  throw Error('INTEGRATION_BLOCKED: review job must not run with paper execution armed');
 const memory=JSON.parse(await readFile(memoryPath,'utf8'));
 const snapshots={};
 for(const symbol of PAIRS){
  snapshots[symbol]=JSON.parse(await readFile(
   join(snapshotDir,symbol.replace('/','-')+'.json'),'utf8'));
 }
 const now=Date.now(),fx=await new DailyGBPReference().on(new Date(now).toISOString());
 const result=await integratedResearchReview({memory,snapshots,fx,now});
 const out=await writeReviewArtifacts(outDir,result);
 console.log('INTEGRATED_RESEARCH_REVIEW '+JSON.stringify({
  output:out,status:result.report.status,
  researchExperimentsAdded:result.report.researchExperimentsAdded,
  historicalScreenPasses:result.report.historicalScreenPasses,
  verifiedForwardGrades:0,brokerOrders:0,admissions:0
 }));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('INTEGRATED_REVIEW_FAILED',String(e.message||e));process.exitCode=1;});
