// SCALP-RESEARCH-V2: deterministic, broker-free research. Never authorises grades or orders.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {PAIRS,checkSnapshot,simulateValidation} from '../strategy-validation-core.mjs';
import {checkMemory,checkParams,selectHistoricalParent,toSimulator} from './run-robot-training.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const canonical=x=>JSON.stringify(x);
export const V2_POLICY=Object.freeze({
  schema:'SCALP_RESEARCH_V2_CANDIDATES',reservedHoldout:0.20,
  minFoldBars:1200,maxFolds:3,candidatesPerSymbol:36,maxWorkers:4,
  initialGBP:50,normalFeePerSide:0.0025,stressFeePerSide:0.005,
  paperOrders:0,liveOrders:0,admissions:0,verifiedGrades:0
});
const number=(n)=>Number(n.toFixed(6));
function rng(seed) {
  let s=Number.parseInt(hash(seed).slice(0,8),16)>>>0;
  return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
const integer=(r,min,max)=>min+Math.floor(r()*(max-min+1));
function admissible(p) {try {checkParams(p);toSimulator(p);return true;}catch{return false;}}
export function makeFolds(snapshot) {
  const source=checkSnapshot(snapshot,snapshot?.symbol);
  const total=source.bars.length,cut=Math.floor(total*(1-V2_POLICY.reservedHoldout));
  if(cut<2*V2_POLICY.minFoldBars)throw Error('V2: insufficient development history');
  const n=Math.min(V2_POLICY.maxFolds,Math.floor(cut/V2_POLICY.minFoldBars));
  const folds=[];
  for(let k=0;k<n;k++){
    const from=Math.floor(k*cut/n),to=Math.floor((k+1)*cut/n);
    if(to-from<V2_POLICY.minFoldBars)throw Error('V2: short development fold');
    folds.push({from,to,first:source.bars[from].t,last:source.bars[to-1].t});
  }
  return {folds,cut,holdoutStart:source.bars[cut].t,holdoutEnd:source.bars.at(-1).t+900000,
    developmentEnd:source.bars[cut-1].t+900000,
    snapshotHash:hash(source.bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v])),
    totalCandles:total};
}
function neighbours(p){
  if(p.family==='ema_trend')return [
    {family:p.family,fast:p.fast-2,slow:p.slow-5},
    {family:p.family,fast:p.fast+2,slow:p.slow+5}];
  if(p.family==='rsi_reversion')return [
    {...p,buyBelow:p.buyBelow-4,sellAbove:p.sellAbove-4},
    {...p,buyBelow:p.buyBelow+4,sellAbove:p.sellAbove+4}];
  return [{...p,lookback:p.lookback-10,exitLookback:p.exitLookback-5},
    {...p,lookback:p.lookback+10,exitLookback:p.exitLookback+5}];
}
function sample(r,family) {
  if(family==='ema_trend'){
    const fast=integer(r,3,40);
    return {family,fast,slow:integer(r,fast+2,96)};
  }
  if(family==='rsi_reversion'){
    const buyBelow=integer(r,10,40);
    return {family,period:integer(r,7,30),buyBelow,sellAbove:integer(r,buyBelow+5,85)};
  }
  const lookback=integer(r,10,96);
  return {family,lookback,exitLookback:integer(r,5,lookback)};
}
export function proposeV2Candidates({symbol,memory,snapshotHash,developmentEnd,limit=V2_POLICY.candidatesPerSymbol}){
  checkMemory(memory);
  if(!PAIRS.includes(symbol)||!Number.isInteger(limit)||limit<3||limit>240)
    throw Error('V2: invalid symbol or candidate budget');
  const r=rng([symbol,snapshotHash,'RESEARCH_V2_FIXED_SEED']);
  const byFamily={ema_trend:[],rsi_reversion:[],channel_breakout:[]};
  const seen=new Set(),familyNames=Object.keys(byFamily);
  const push=p=>{if(!p||!admissible(p))return;const id=canonical(p);
    if(!seen.has(id)){seen.add(id);byFamily[p.family].push(p);}};
  // Training-only parent is permitted solely when it predates the sealed holdout.
  // No prior result, including a high win rate, is treated as forward evidence.
  const parent=selectHistoricalParent(memory,symbol,'us-1');
  const permitted=parent&&Date.parse(parent.trainingEnd)<=developmentEnd?parent:null;
  if(permitted){push(permitted.params);for(const p of neighbours(permitted.params))push(p);}
  const baselines=[
    {family:'ema_trend',fast:9,slow:34},
    {family:'ema_trend',fast:12,slow:48},
    {family:'rsi_reversion',period:14,buyBelow:30,sellAbove:65},
    {family:'rsi_reversion',period:9,buyBelow:25,sellAbove:60},
    {family:'channel_breakout',lookback:20,exitLookback:10},
    {family:'channel_breakout',lookback:40,exitLookback:20}
  ];
  baselines.forEach(push);
  const per=Math.ceil(limit/3);
  for(let j=0;j<3000&&familyNames.some(f=>byFamily[f].length<per);j++){
    const family=familyNames[j%3];
    if(byFamily[family].length<per)push(sample(r,family));
  }
  return {symbol,seed:permitted?.params??null,seedIsHistoricalOnly:Boolean(permitted),
    candidates:familyNames.flatMap(f=>byFamily[f].slice(0,per)).slice(0,limit),
    explorationMethod:'SEEDED_PLUS_DETERMINISTIC_DIVERSE_PARAMETER_SEARCH'};
}
function runFold(snapshot,symbol,config,fold,fee,now){
  const slice={...snapshot,bars:snapshot.bars.slice(fold.from,fold.to)};
  return simulateValidation({snapshot:slice,symbol,startingBalanceGbp:V2_POLICY.initialGBP,
    mode:'duration',limit:365,feePerSideFraction:fee,now,...config});
}
export function evaluateV2Symbol({snapshot,symbol,memory,now=Date.now(),limit=V2_POLICY.candidatesPerSymbol}){
  if(snapshot?.symbol!==symbol)throw Error('V2: symbol mismatch');
  const layout=makeFolds(snapshot),developmentEnd=layout.developmentEnd;
  const proposal=proposeV2Candidates({symbol,memory,snapshotHash:layout.snapshotHash,
    developmentEnd,limit});
  const ranked=proposal.candidates.map(params=>{
    const config=toSimulator(params);
    // Each scored fold is disjoint. Existing canonical simulator retains its
    // own causal warm-up (40%) INSIDE that fold; no scored trade is duplicated.
    const results=layout.folds.map(fold=>{
      const base=runFold(snapshot,symbol,config,fold,V2_POLICY.normalFeePerSide,now);
      const stress=runFold(snapshot,symbol,config,fold,V2_POLICY.stressFeePerSide,now);
      return {from:new Date(fold.first).toISOString(),to:new Date(fold.last+900000).toISOString(),
        closes:base.closedTrades,normalNetGbp:base.realizedNetProfitGbp,
        stressNetGbp:stress.realizedNetProfitGbp,
        normalDrawdownPct:base.maxDrawdownPct};
    });
    const sum=k=>number(results.reduce((acc,x)=>acc+x[k],0));
    const closes=results.reduce((acc,x)=>acc+x.closes,0);
    const normal=sum('normalNetGbp'),stressed=sum('stressNetGbp');
    const maxDD=Math.max(...results.map(x=>x.normalDrawdownPct));
    const profitable=results.filter(x=>x.normalNetGbp>0&&x.stressNetGbp>0).length;
    const eligible=closes>=30&&normal>0&&stressed>0&&maxDD<=8&&
      profitable>=Math.ceil(results.length*2/3);
    // Keep risk-aware prioritisation without declaring anything profitable.
    const score=number(stressed-0.1*maxDD+0.1*profitable);
    return {parameters:params,normalNetGbp:normal,stressedNetGbp:stressed,
      closedTrades:closes,profitableFolds:profitable,totalFolds:results.length,
      maxFoldDrawdownPct:maxDD,researchScore:score,developmentEligible:eligible,
      foldResults:results};
  });
  ranked.sort((a,b)=>Number(b.developmentEligible)-Number(a.developmentEligible)||
    b.researchScore-a.researchScore||b.closedTrades-a.closedTrades||
    canonical(a.parameters).localeCompare(canonical(b.parameters)));
  return {symbol,status:ranked.some(x=>x.developmentEligible)?
    'DEVELOPMENT_SHORTLIST_ONLY':'NO_DEVELOPMENT_CANDIDATE_PASSED',
    researchSnapshotHash:layout.snapshotHash,totalCandles:layout.totalCandles,
    developmentFolds:layout.folds.map(f=>({from:new Date(f.first).toISOString(),
      to:new Date(f.last+900000).toISOString(),scoredFoldUnique:true})),
    sealedHoldout:{from:new Date(layout.holdoutStart).toISOString(),
      to:new Date(layout.holdoutEnd).toISOString(),usedForSelection:false},
    candidateCount:ranked.length,seed:proposal.seed,allCandidateResults:ranked,
    shortlisted:ranked.filter(x=>x.developmentEligible).slice(0,3).map(x=>({
      parameters:x.parameters,researchScore:x.researchScore,netStressGbp:x.stressedNetGbp})),
    teacherAdmission:false,independentForwardEvidence:0,brokerOrders:0};
}
function parallel(workerPayload){
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:workerPayload});
    let finished=false;
    worker.once('message',msg=>{finished=true;resolve(msg);});
    worker.once('error',reject);
    worker.once('exit',code=>{if(!finished)reject(Error('V2 worker exited '+code));});
  });
}
export async function evaluateV2All({memory,snapshots,now=Date.now(),workers=V2_POLICY.maxWorkers,
 limit=V2_POLICY.candidatesPerSymbol}={}){
  checkMemory(memory);
  if(!snapshots||PAIRS.some(x=>!snapshots[x]))throw Error('V2: all ten charts required');
  if(!Number.isInteger(workers)||workers<1||workers>8)throw Error('V2: worker limit invalid');
  const pending=[...PAIRS],reports=[],started=performance.now();
  async function consume(){
    while(pending.length){
      const symbol=pending.shift();
      const args={snapshot:snapshots[symbol],symbol,memory,now,limit};
      const report=workers===1?evaluateV2Symbol(args):
        await parallel({args,kind:'research-v2-symbol'});
      reports.push(report);
    }
  }
  await Promise.all(Array.from({length:Math.min(workers,PAIRS.length)},consume));
  reports.sort((a,b)=>PAIRS.indexOf(a.symbol)-PAIRS.indexOf(b.symbol));
  return {schema:V2_POLICY.schema,policy:V2_POLICY,
    generatedAt:new Date(now).toISOString(),elapsedMilliseconds:Math.round(performance.now()-started),
    workerCount:Math.min(workers,PAIRS.length),symbols:reports,
    evaluatedCandidates:reports.reduce((n,x)=>n+x.candidateCount,0),
    shortlistedSymbols:reports.filter(x=>x.shortlisted.length>0).map(x=>x.symbol),
    holdoutAccessedForSelection:false,admissionsIssued:0,verifiedForwardGrades:0,
    paperOrders:0,liveOrders:0,disclaimer:'Historical development results only. No paper or live profitability claim.'};
}
async function main(){
  const [memoryFile,dataDir,outputFile]=process.argv.slice(2);
  if(!memoryFile||!dataDir||!outputFile)throw Error(
    'USAGE: node scripts/research-v2.mjs <memory.json> <dataDir> <output.json> [workers] [budget]');
  const workers=Number(process.argv[5]||4),limit=Number(process.argv[6]||36);
  const memory=JSON.parse(await readFile(memoryFile,'utf8'));
  const snapshots={};
  await Promise.all(PAIRS.map(async symbol=>{
    snapshots[symbol]=JSON.parse(await readFile(path.join(dataDir,
      symbol.replace('/','-')+'.json'),'utf8'));
  }));
  const result=await evaluateV2All({memory,snapshots,workers,limit});
  await mkdir(path.dirname(outputFile),{recursive:true});
  await writeFile(outputFile,JSON.stringify(result,null,2)+'\n');
  console.log('SCALP_RESEARCH_V2 '+JSON.stringify({
    candidates:result.evaluatedCandidates,workers:result.workerCount,
    wallMs:result.elapsedMilliseconds,shortlistedSymbols:result.shortlistedSymbols,
    holdoutUsed:false,admissions:0,brokerOrders:0}));
}
if(!isMainThread){
  try{if(workerData?.kind!=='research-v2-symbol')throw Error('V2: unexpected worker message');
    parentPort.postMessage(evaluateV2Symbol(workerData.args));
  }catch(e){throw Error('V2: '+String(e.message||e));}
}else if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{console.error('SCALP_RESEARCH_V2_BLOCKED',String(e.message||e));process.exitCode=1;});
}
