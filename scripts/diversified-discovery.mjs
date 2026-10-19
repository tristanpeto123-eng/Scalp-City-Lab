// Broader strategy discovery on strictly disjoint development windows.
// No authenticated broker clients, no persisted promotions, and no selection
// using the final 20% sealed chronological holdout.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {PAIRS,checkSnapshot,simulateValidation} from '../strategy-validation-core.mjs';

const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rounded=n=>Number(n.toFixed(4));
const DAY=86400000;
export const BANK=Object.freeze([
 {family:'ema_trend',fast:5,slow:21},
 {family:'ema_trend',fast:9,slow:34},
 {family:'ema_trend',fast:14,slow:55},
 {family:'ema_trend',fast:21,slow:75},
 {family:'rsi_reversion',period:7,buyBelow:25,sellAbove:60},
 {family:'rsi_reversion',period:9,buyBelow:32,sellAbove:65},
 {family:'rsi_reversion',period:14,buyBelow:30,sellAbove:60},
 {family:'rsi_reversion',period:21,buyBelow:38,sellAbove:70},
 {family:'channel_breakout',lookback:10,exitLookback:5},
 {family:'channel_breakout',lookback:20,exitLookback:10},
 {family:'channel_breakout',lookback:40,exitLookback:20},
 {family:'channel_breakout',lookback:72,exitLookback:24}
]);
export const POLICY=Object.freeze({
 developmentFraction:0.8,disjointFolds:3,minCandlesPerFold:800,
 minResearchCloses:30,feePerSide:.0025,stressedFeePerSide:.005,
 maxDevelopmentDrawdownPct:8,brokerOrders:0,independentModelPromotion:false
});
const config=p=>p.family==='ema_trend'?{strategy:'ema',strategyParams:{fast:p.fast,slow:p.slow}}:
 p.family==='rsi_reversion'?{strategy:'rsi',strategyParams:{
  period:p.period,buyBelow:p.buyBelow,sellAbove:p.sellAbove}}:
 {strategy:'breakout',strategyParams:{lookback:p.lookback,exitLookback:p.exitLookback}};

export function splitDisjointDevelopment(bars){
 if(!Array.isArray(bars)||bars.length<3600)throw Error('DISCOVERY: need >=3600 completed source candles');
 const boundary=Math.floor(bars.length*POLICY.developmentFraction);
 const foldSize=Math.floor(boundary/POLICY.disjointFolds);
 if(foldSize<POLICY.minCandlesPerFold)throw Error('DISCOVERY: insufficient disjoint development candles');
 const folds=Array.from({length:POLICY.disjointFolds},(_,i)=>{
  const start=i*foldSize,end=i===POLICY.disjointFolds-1?boundary:(i+1)*foldSize;
  return {start,end,startTime:new Date(bars[start].t).toISOString(),
   endTime:new Date(bars[end-1].t+900000).toISOString(),candles:end-start};
 });
 if(folds.at(-1).end!==boundary||folds.some((x,i)=>i&&folds[i-1].end!==x.start))
  throw Error('DISCOVERY: disjoint fold integrity broken');
 return {folds,holdoutStartIndex:boundary,holdoutCandles:bars.length-boundary,
  holdoutStartTime:new Date(bars[boundary].t).toISOString()};
}
export function discoverOne({snapshot,symbol,now=Date.now(),maxAgeDays=14}={}){
 const source=checkSnapshot(snapshot,symbol,now);
 if(!Number.isFinite(maxAgeDays)||maxAgeDays<=0||maxAgeDays>14)
  throw Error('DISCOVERY: invalid freshness limit');
 const elapsed=now-Date.parse(source.sampleEnd);
 if(elapsed<0||elapsed>maxAgeDays*DAY)
  throw Error('DISCOVERY: stale or future historical candle end');
 const {folds,holdoutStartIndex,holdoutCandles,holdoutStartTime}=
  splitDisjointDevelopment(source.bars);
 const sourceHash=sha(snapshot);
 const candidates=BANK.map(params=>{
  const runs=folds.map(f=>{
   const segment={...snapshot,bars:snapshot.bars.slice(f.start,f.end)};
   const base=simulateValidation({snapshot:segment,symbol,now,
    mode:'duration',limit:365,startingBalanceGbp:50,
    feePerSideFraction:POLICY.feePerSide,...config(params)});
   const stressed=simulateValidation({snapshot:segment,symbol,now,
    mode:'duration',limit:365,startingBalanceGbp:50,
    feePerSideFraction:POLICY.stressedFeePerSide,...config(params)});
   return {period:{start:f.startTime,end:f.endTime},
    closes:base.closedTrades,netGbp:base.realizedNetProfitGbp,
    stressNetGbp:stressed.realizedNetProfitGbp,
    maxDrawdownPct:base.maxDrawdownPct};
  });
  const closes=runs.reduce((a,x)=>a+x.closes,0),
   net=runs.reduce((a,x)=>a+x.netGbp,0),
   stressNet=runs.reduce((a,x)=>a+x.stressNetGbp,0),
   positiveFolds=runs.filter(x=>x.netGbp>0&&x.stressNetGbp>0).length,
   drawdown=Math.max(...runs.map(x=>x.maxDrawdownPct));
  const meetsResearchThreshold=closes>=POLICY.minResearchCloses&&
   net>0&&stressNet>0&&positiveFolds===folds.length&&
   drawdown<=POLICY.maxDevelopmentDrawdownPct;
  return {parameters:params,parameterHash:sha(params),family:params.family,
   developmentTradeCloses:closes,netGbp:rounded(net),
   doubleCostNetGbp:rounded(stressNet),positiveDisjointFolds:positiveFolds,
   worstFoldDrawdownPct:rounded(drawdown),folds:runs,
   developmentThresholdMet:meetsResearchThreshold,
   admissionAllowed:false,brokerForwardTrades:0};
 });
 // Selection depends on development slices only, NEVER the final fifth.
 candidates.sort((a,b)=>Number(b.developmentThresholdMet)-Number(a.developmentThresholdMet)||
  b.positiveDisjointFolds-a.positiveDisjointFolds||
  b.doubleCostNetGbp-a.doubleCostNetGbp||
  a.parameterHash.localeCompare(b.parameterHash));
 return {symbol,source:'ALPACA_KRAKEN_US_US-1',snapshotDigest:sourceHash,
  sourcePeriod:{start:source.sampleStart,end:source.sampleEnd},
  sourceAgeHours:rounded(elapsed/3600000),
  developmentFolds:folds,holdout:{startTime:holdoutStartTime,
   candles:holdoutCandles,usedForSelection:false,verified:false},
  candidatesEvaluated:candidates.length,
  developmentThresholdCount:candidates.filter(x=>x.developmentThresholdMet).length,
  topCandidate:candidates[0],allCandidates:candidates,
  status:'HISTORICAL_DEVELOPMENT_ONLY',signedAdmission:null,
  verifiedForwardTrades:0,paperOrders:0};
}
export function discoverAll({snapshots,now=Date.now()}={}){
 if(!snapshots||PAIRS.some(p=>!snapshots[p]))throw Error('DISCOVERY: ten source snapshots required');
 const pupils=PAIRS.map(symbol=>discoverOne({snapshot:snapshots[symbol],symbol,now}));
 return {schema:'SCALP_DIVERSIFIED_RESEARCH_V1',
  generatedAt:new Date(now).toISOString(),policy:POLICY,
  scope:'CRYPTO_15MIN_HISTORICAL_DEVELOPMENT',
  sourceSnapshots:pupils.length,distinctFamilies:3,
  researchCandidates:pupils.reduce((n,p)=>n+p.candidatesEvaluated,0),
  developmentThresholdCandidates:pupils.reduce((n,p)=>n+p.developmentThresholdCount,0),
  independentForwardValidations:0,admissions:0,paperOrders:0,liveOrders:0,
  holdoutUsedForSelection:false,
  caution:'No profitable forward model is proven. Three disjoint development windows are not three independent markets or proof of future profit. Final 20% is quarantined.',
  pupils};
}
async function main(){
 const [snapshotDir,outPath]=process.argv.slice(2);
 if(!snapshotDir||!outPath||process.argv.length!==4)
  throw Error('USAGE: node scripts/diversified-discovery.mjs <snapshot-dir> <new-output.json>');
 if(process.env.TEACHER_PAPER_ENABLED==='true'||process.env.SCALP_PAPER_ENABLED==='true')
  throw Error('DISCOVERY: broker execution must be disabled');
 const snapshots={};
 for(const symbol of PAIRS)
  snapshots[symbol]=JSON.parse(await readFile(join(snapshotDir,symbol.replace('/','-')+'.json'),'utf8'));
 const result=discoverAll({snapshots});
 await mkdir(dirname(resolve(outPath)),{recursive:true});
 await writeFile(resolve(outPath),JSON.stringify(result,null,2)+'\n',
  {encoding:'utf8',flag:'wx',mode:0o600});
 console.log('DIVERSIFIED_DISCOVERY '+JSON.stringify({charts:result.sourceSnapshots,
  researchCandidates:result.researchCandidates,
  passingDevelopmentThreshold:result.developmentThresholdCandidates,
  independentForwardValidations:0,admissions:0,paperOrders:0,liveOrders:0}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error('DISCOVERY_BLOCKED',String(e.message||e));process.exitCode=1});
