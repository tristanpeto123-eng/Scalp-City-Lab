// Read-only, versioned cross-repository research status index.
// Never treats equity supply/news evidence as crypto signals or trade orders.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const COMMIT=/^[0-9a-f]{40}$/;
function requireSource(source,repo){
 if(source?.repo!==repo||!COMMIT.test(source.sha||''))
  throw Error('INDEX: full verifiable '+repo+' source commit required');
}
const integer=(v)=>Number.isInteger(v)&&v>=0;
function checkIndexInput({discovery,supplyLearning,supplyChart,supplyPrice,strategyModel,strategyStatus,commits}={}){
 if(!discovery||discovery.schema!=='SCALP_DIVERSIFIED_RESEARCH_V1'||
  discovery.sourceSnapshots!==10||discovery.paperOrders!==0||
  discovery.liveOrders!==0||discovery.independentForwardValidations!==0||
  discovery.admissions!==0||discovery.holdoutUsedForSelection!==false)
  throw Error('INDEX: invalid crypto source or implicit broker claim');
 for(const [key,repo] of [['crypto','Scalp-City-Lab'],['supply','supply-scout'],
   ['strategy','strategy-lab-template']])requireSource(commits?.[key],
    'tristanpeto123-eng/'+repo);
 if(!integer(supplyLearning?.archive_count)||
  !integer(supplyLearning?.cluster_count)||
  supplyLearning.cluster_count>supplyLearning.archive_count||
  supplyLearning.data_quality?.all_current_archive_unverified!==true)
  throw Error('INDEX: unsupported or unverified Supply Scout archive');
 if(supplyChart?.model_status!=='LOCKED'||
  !integer(supplyChart?.confirmed_chart_entries)||
  !integer(supplyChart?.tracked_events)||
  !integer(supplyPrice?.outcomes_90d_resolved)||
  supplyPrice?.prediction_model!=='LOCKED')
  throw Error('INDEX: expected separate, locked Supply Scout evidence');
 if(strategyModel?.status!=='LOCKED'||!integer(strategyModel?.verified_resolved_events)||
  !integer(strategyModel?.minimum_events)||strategyModel.minimum_events<80||
  strategyStatus?.training_model!=='LOCKED'||strategyStatus?.mode!=='technical')
  throw Error('INDEX: expected separate locked equity Strategy Lab');
}
export function buildEvidenceIndex(input){
 checkIndexInput(input);
 const {discovery,supplyLearning,supplyChart,supplyPrice,strategyModel,strategyStatus,commits}=input;
 return {schema:'CROSS_PROJECT_RESEARCH_INDEX_V1',generatedAt:discovery.generatedAt,
  status:'READ_ONLY_SEPARATE_EVIDENCE_DOMAINS',
  totalSystems:3,
  systems:[
   {id:'scalp-crypto',domain:'CRYPTO_15MIN',repo:commits.crypto.repo,
    commitSha:commits.crypto.sha,sourceDigest:sha(discovery),
    state:'UNVALIDATED_RESEARCH',instruments:discovery.sourceSnapshots,
    researchCandidates:discovery.researchCandidates,
    developmentThresholdCandidates:discovery.developmentThresholdCandidates,
    independentForwardEvidence:0,verifiedProfitableModels:0,
    brokerOrders:0,admissions:0},
   {id:'supply-scout',domain:'EQUITY_NEWS_EVENTS',repo:commits.supply.repo,
    commitSha:commits.supply.sha,
    sourceDigest:sha([supplyLearning,supplyChart,supplyPrice]),
    state:'UNVERIFIED_NEWS_MODEL_LOCKED',newsRecords:supplyLearning.archive_count,
    newsClusters:supplyLearning.cluster_count,
    trackedChartEvents:supplyChart.tracked_events,
    confirmedChartEntries:supplyChart.confirmed_chart_entries,
    resolved90dOutcomes:supplyPrice.outcomes_90d_resolved,
    independentForwardEvidence:0,brokerOrders:0,admissions:0},
   {id:'strategy-lab',domain:'EQUITY_TECHNICAL',repo:commits.strategy.repo,
    commitSha:commits.strategy.sha,sourceDigest:sha([strategyModel,strategyStatus]),
    state:'SUPPLY_EVIDENCE_MODEL_LOCKED',observedSymbols:strategyStatus.available_symbols?.length??0,
    verifiedResolvedEpisodes:strategyModel.verified_resolved_events,
    minimumEvidenceEpisodes:strategyModel.minimum_events,
    independentForwardEvidence:0,brokerOrders:0,admissions:0}
  ],
  crossDomainPricePredictionAllowed:false,
  automatedTraderAccess:false,
  statusPolicy:'Source SHA records are snapshot provenance, not proof of truthful claims. No earnings estimates, promotions or executions allowed from this index.',
  pipelineNext:'Validate independent episodes and source quality before any shared predictive feature development'};
}
async function main(){
 const [discoveryPath,supplyDir,strategyDir,cryptoSha,supplySha,strategySha,outPath]=
  process.argv.slice(2);
 if(!outPath||process.argv.length!==9)
  throw Error('USAGE: node scripts/research-evidence-index.mjs <discovery.json> <supply-directory> <strategy-directory> <crypto-commit> <supply-commit> <strategy-commit> <new-output.json>');
 const get=async name=>JSON.parse(await readFile(name,'utf8'));
 const result=buildEvidenceIndex({
  discovery:await get(discoveryPath),
  supplyLearning:await get(join(supplyDir,'data/learning/learning_state.json')),
  supplyChart:await get(join(supplyDir,'data/learning/chart_status.json')),
  supplyPrice:await get(join(supplyDir,'data/learning/price_status.json')),
  strategyModel:await get(join(strategyDir,'results/model_status.json')),
  strategyStatus:await get(join(strategyDir,'results/status.json')),
  commits:{
   crypto:{repo:'tristanpeto123-eng/Scalp-City-Lab',sha:cryptoSha},
   supply:{repo:'tristanpeto123-eng/supply-scout',sha:supplySha},
   strategy:{repo:'tristanpeto123-eng/strategy-lab-template',sha:strategySha}
  }
 });
 await mkdir(dirname(resolve(outPath)),{recursive:true});
 await writeFile(resolve(outPath),JSON.stringify(result,null,2)+'\n',
  {flag:'wx',mode:0o600});
 console.log('CROSS_PROJECT_EVIDENCE_INDEX '+JSON.stringify({
  systems:result.totalSystems,domains:result.systems.map(x=>x.domain),
  crossDomainTradingAllowed:result.crossDomainPricePredictionAllowed,
  brokerOrders:0}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('EVIDENCE_INDEX_BLOCKED',String(e.message||e));process.exitCode=1});
