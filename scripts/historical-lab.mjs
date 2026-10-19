// Research-only historical walk-forward laboratory. No brokerage credentials,
// network fetch, account access, signed admissions or order endpoints.
// All development folds end BEFORE a quarantined final 20% of each snapshot.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkSnapshot,PAIRS,simulateValidation} from '../strategy-validation-core.mjs';
import {checkMemory,proposeResearchLesson,selectHistoricalParent,toSimulator} from './run-robot-training.mjs';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const n=value=>Number(value.toFixed(4));
export const LAB_POLICY=Object.freeze({
 source:'PUBLISHED_HISTORICAL_15MIN_CANDLES',
 reserveUntouchedFraction:0.20,
 minFoldCandles:1200,
 strideCandles:600,
 maxFolds:6,
 maxCandidates:6,
 regularFeePerSide:0.0025,
 stressedFeePerSide:0.005,
 orderExecution:false,
 promotions:false
});
export function developmentFolds(bars){
 if(!Array.isArray(bars)||bars.length<2400)throw Error('HISTORICAL_LAB: insufficient historic candles');
 const sealedHoldoutStart=Math.floor(bars.length*(1-LAB_POLICY.reserveUntouchedFraction));
 const training=bars.slice(0,sealedHoldoutStart),length=LAB_POLICY.minFoldCandles;
 if(training.length<length*2)throw Error('HISTORICAL_LAB: insufficient training-only development data');
 const folds=[];
 for(let start=0;start+length<=training.length&&folds.length<LAB_POLICY.maxFolds;
     start+=LAB_POLICY.strideCandles){
   const end=start+length;
   folds.push({startIndex:start,endIndex:end,
     firstBar:training[start].t,lastBar:training[end-1].t});
 }
 if(folds.length<2)throw Error('HISTORICAL_LAB: needs multiple chronological folds');
 return {folds,sealedHoldoutStart,trainingEnd:training.at(-1).t,
   reservedCandles:bars.length-sealedHoldoutStart};
}
function distinctCandidates(memory,symbol){
 const plan=proposeResearchLesson(memory,{symbol,feed:'us-1',fingerprint:'HISTORICAL_FOLD_ONLY'});
 const parent=selectHistoricalParent(memory,symbol,'us-1');
 const seen=new Set(),items=[];
 for(const candidate of [parent?.params,...plan.candidates]){
  if(!candidate)continue;
  try{
   toSimulator(candidate);
   const k=JSON.stringify(candidate);
   if(seen.has(k))continue;
   seen.add(k);items.push(candidate);
  }catch{continue;}
  if(items.length>=LAB_POLICY.maxCandidates)break;
 }
 return items;
}
export function evaluateHistoricalPupil({snapshot,memory,symbol,now=Date.now()}={}){
 const source=checkSnapshot(snapshot,symbol,now);
 const {folds,sealedHoldoutStart,trainingEnd,reservedCandles}=developmentFolds(source.bars);
 const candidates=distinctCandidates(checkMemory(memory),symbol);
 const tests=candidates.map(params=>{
   const config=toSimulator(params);
   const foldsEvaluated=folds.map(fold=>{
     const segment={...snapshot,bars:snapshot.bars.slice(fold.startIndex,fold.endIndex)};
     const base=simulateValidation({snapshot:segment,symbol,now,
       feePerSideFraction:LAB_POLICY.regularFeePerSide,...config});
     const stress=simulateValidation({snapshot:segment,symbol,now,
       feePerSideFraction:LAB_POLICY.stressedFeePerSide,...config});
     return {start:fold.firstBar,end:fold.lastBar,
       closes:base.closedTrades,netGbp:base.realizedNetProfitGbp,
       stressNetGbp:stress.realizedNetProfitGbp,maxDrawdownPct:base.maxDrawdownPct};
   });
   const normalNet=foldsEvaluated.reduce((a,b)=>a+b.netGbp,0);
   const stressedNet=foldsEvaluated.reduce((a,b)=>a+b.stressNetGbp,0);
   const profitableFolds=foldsEvaluated.filter(f=>f.netGbp>0&&f.stressNetGbp>0).length;
   return {parameters:params,normalNetAcrossOverlappingFolds:n(normalNet),
     stressedNetAcrossOverlappingFolds:n(stressedNet),
     profitableFolds,foldsEvaluated,
     researchRankScore:n(stressedNet+profitableFolds*0.01),
     note:'Overlapping folds are not independent trading samples or admissible paper evidence'};
 });
 tests.sort((a,b)=>b.researchRankScore-a.researchRankScore||
   b.profitableFolds-a.profitableFolds);
 return {symbol,snapshotSource:source.source,
   snapshotAt:snapshot.generatedAt||null,snapshotSha:sha(snapshot),
   historicalCandles:source.bars.length,
   developmentFoldCount:folds.length,
   developmentWindow:{start:source.sampleStart,end:new Date(Date.parse(trainingEnd)+900000).toISOString()},
   heldOutQuarantine:{start:new Date(source.bars[sealedHoldoutStart].t).toISOString(),
     end:source.sampleEnd,candles:reservedCandles,
     usedForModelSelection:false,admissionsAllowed:false},
   candidatesEvaluated:tests.length,
   bestResearchCandidate:tests[0]?{...tests[0],foldsEvaluated:undefined}:null,
   // All outcomes are based on *development* slices; do not attach grades.
   status:tests.length?'DEVELOPMENT_RESEARCH_ONLY':'NO_ELIGIBLE_STRATEGY_CANDIDATE',
   officialGrade:null,brokerRoundTrips:0,orders:0,modelPromotion:false};
}
export function historicalLab({memory,snapshots,now=Date.now()}={}){
 checkMemory(memory);
 if(!snapshots||PAIRS.some(p=>!snapshots[p]))throw Error('HISTORICAL_LAB: missing one of ten trusted snapshots');
 const pupils=PAIRS.map(symbol=>evaluateHistoricalPupil({snapshot:snapshots[symbol],memory,symbol,now}));
 return {schema:'SCALP_HISTORICAL_WALK_FORWARD_V1',
   mode:'OFFLINE_HISTORICAL_DEVELOPMENT',source:LAB_POLICY.source,
   researchSnapshotDate:pupils.map(p=>p.snapshotAt).sort().at(-1),
   tenPupils:pupils.length,policy:LAB_POLICY,
   quarantinedHoldoutNotScored:true,
   admissionCount:0,verifiedForwardGrades:0,brokerOrders:0,
   pupils};
}
async function main(){
 const [memoryPath,snapshotDir,outputPath]=process.argv.slice(2);
 if(!memoryPath||!snapshotDir||!outputPath)
   throw Error('USAGE: node scripts/historical-lab.mjs <archived-memory> <snapshot-dir> <report-output>');
 const memory=JSON.parse(await readFile(memoryPath,'utf8'));
 const snapshots={};
 for(const symbol of PAIRS)snapshots[symbol]=JSON.parse(
   await readFile(path.join(snapshotDir,symbol.replace('/','-')+'.json'),'utf8'));
 const report=historicalLab({memory,snapshots});
 await mkdir(path.dirname(outputPath),{recursive:true});
 await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
 console.log('HISTORICAL_LAB_COMPLETE '+JSON.stringify({
   pupils:report.tenPupils,folds:report.pupils[0].developmentFoldCount,
   holdoutNotScored:report.quarantinedHoldoutNotScored,
   candidates:report.pupils.map(p=>({symbol:p.symbol,tested:p.candidatesEvaluated,
    folds:p.developmentFoldCount,topScore:p.bestResearchCandidate?.researchRankScore??null})),
   admissions:0,orders:0}));
}
const self=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self)main().catch(e=>{console.error('HISTORICAL_LAB_BLOCKED',String(e.message||e));process.exitCode=1;});
