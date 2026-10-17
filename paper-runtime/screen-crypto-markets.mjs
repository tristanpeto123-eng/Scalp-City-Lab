// Eight crypto markets: one-shot, READ-ONLY real market data comparisons.
// It NEVER calls paperOrder; it NEVER broadens production trading allowlists.
import {AlpacaPaper} from './alpaca-paper.mjs';
import {CRYPTO_RESEARCH_ONLY,CRYPTO_RESEARCH_MARKETS,isResearchCrypto} from './crypto-research-marketset.mjs';
import {loadHistoricalCrypto,replayHistorical} from './replay-profit.mjs';
import {emptyMemory,assertMemory,proposeCandidates,rememberTraining,fingerprintTraining} from './learning-memory.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const target=Object.freeze({startVirtualGbp:50,profitGoalGbp:2000,
  finalVirtualBalanceGoalGbp:2050,observedWinRateTargetPct:80,
  tradeCountLimit:null,mandatoryRewardRisk:null});
export function quality(raw){
 if(!Array.isArray(raw)||raw.length<480)return {ok:false,reason:'INSUFFICIENT_CANDLES',count:raw?.length??0};
 const count=raw.length,zeroVolume=raw.filter(b=>!(Number(b.v)>0)).length;
 const zeroVolumeRatio=zeroVolume/count;
 return {ok:zeroVolumeRatio<=.4,reason:zeroVolumeRatio>.4?'ZERO_VOLUME_BARS_GT_40_PERCENT':null,
   count,zeroVolumeBars:zeroVolume,zeroVolumePct:Number((100*zeroVolumeRatio).toFixed(2))};
}
export async function runScreener({broker,markets=CRYPTO_RESEARCH_MARKETS,days=90,now=Date.now(),location='us',
   maximumPages=80,memory=emptyMemory()}={}){
 assertMemory(memory);
 let nextMemory=memory;
 if(!['us','us-1'].includes(location))throw Error('Unsupported historical data feed');
 if(!broker||!Array.isArray(markets)||markets.length<1||markets.length>10||
   new Set(markets).size!==markets.length||markets.some(s=>!isResearchCrypto(s)))
   throw Error('Only ten supported research crypto USD pairs are permitted');
 const results=[];
 // Read-only account assets check. Do not promote research to brokerage order approval.
 const listed=await broker.req('https://paper-api.alpaca.markets',
   '/v2/assets?status=active&asset_class=crypto');
 if(!Array.isArray(listed))throw Error('Unable to verify active crypto market set (GET)');
 for(const symbol of markets){
  const asset=listed.find(a=>a.symbol===symbol||a.symbol===symbol.replace('/',''));
  if(!asset||asset.tradable!==true||asset.status!=='active'){
   results.push({symbol,status:'NO_ACTIVE_TRADABLE_PAPER_ASSET',eligible:false});
   console.log('RESEARCH_RESULT '+JSON.stringify(results.at(-1)));
   continue;
  }
  try{
   const source=await loadHistoricalCrypto({broker,symbol,days,now,maximumPages,location});
   const dq=quality(source.raw);
   if(!dq.ok){
     results.push({symbol,status:'DATA_QUALITY_REJECTED',eligible:false,data:dq,
       pages:source.fetchedPages});
   }else{
     const proposal=proposeCandidates(nextMemory,{symbol,feed:location});
     const replay=replayHistorical({symbol,raw:source.raw,closedBefore:now-30000,
       candidates:proposal.candidates});
     // Only first 75% of first 40% (30% of total) was used for
     // selection. No 25% calibration holdout nor later 60% evaluation
     // candles may influence the persistent learner's training evidence.
     const calibrationEnd=Math.floor(source.raw.length*.40);
     const trainCount=Math.floor(calibrationEnd*.75);
     const training=source.raw.slice(0,trainCount);
     const learning=rememberTraining(nextMemory,{
       symbol,feed:location,
       trainingStart:training[0].t,
       trainingEnd:new Date(Date.parse(training.at(-1).t)+900000).toISOString(),
       trainFingerprint:fingerprintTraining(training),
       trainingOptions:replay.trainOnlySelection.trainOptions
     });
     nextMemory=learning.memory;
     const {independentHoldout,holdoutReasons,holdoutVerdict,params,eligible,calibrationBars}=replay.trainOnlySelection;
     // Re-running overlapping training bars creates NO new independent proof.
     const independentlyEligible=eligible&&learning.acceptedForLearning;
     results.push({symbol,status:independentlyEligible?'FROZEN_REPLAY_EVALUATED':eligible?'REPEATED_EVALUATION_NOT_INDEPENDENT':'STRATEGY_REJECTED',
       learning:{reason:learning.reason,acceptedIndependentWindow:learning.acceptedForLearning,
         priorIndependentWindows:proposal.priorIndependentWindows,
         priorParameters:proposal.triedParameters,proposedParameters:proposal.candidates,
         trainingEvidenceId:learning.recordId},
       eligible:independentlyEligible,params,holdoutVerdict,holdoutReasons,calibrationBars,
       completedBars:source.raw.length,pages:source.fetchedPages,data:dq,
       calibrationHoldout:{
         closedTrades:independentHoldout?.closedTrades??0,
         wins:independentHoldout?.wins??0,
         winRatePct:independentHoldout?.winRatePct??0,
         netGbp:independentHoldout?.netGbp??0,
         profitFactor:independentHoldout?.profitFactor??null,
         maxDrawdownPct:independentHoldout?.maxDrawdownPct??null
       },
       frozenReplay:replay.evaluation,
       researchOnly:true,brokerOrders:0});
   }
  }catch(e){
   results.push({symbol,status:'RESEARCH_ERROR',eligible:false,error:String(e.message||e).slice(0,160)});
  }
  console.log('RESEARCH_RESULT '+JSON.stringify(results.at(-1)));
 }
 return {mode:'HISTORICAL_MARKET_COMPARISON_READ_ONLY',
   dataLocation:location,
   targets:target,days,checkedAt:new Date(now).toISOString(),
   marketsChecked:results.length,results,
   eligibleMarkets:results.filter(x=>x.eligible).map(x=>x.symbol),
   modelMemory:nextMemory,
   learningEvents:results.flatMap(x=>x.learning?[{symbol:x.symbol,...x.learning}]:[]),
   brokerOrdersSubmitted:0,
   disclaimer:'Historical candle simulation, not actual trades, profit or verified live forward win rate. Eight new markets remain research-only; no broker order permissions changed. Overlapping historical studies are never fresh independent validation.'};
}
async function main(){
 const days=Number(process.env.SCALP_RESEARCH_DAYS||90),broker=new AlpacaPaper();
 const location=process.env.SCALP_RESEARCH_FEED||'us';
 const report=await runScreener({broker,days,location});
 // Memory is persisted by a distinct, audited GitHub writer. The normal
 // screener does not write remotely and does not print entire model state.
 const {modelMemory,...publicReport}=report;
 console.log('MARKET_RESEARCH_REPORT '+JSON.stringify(publicReport));
 if(process.env.SCALP_RESEARCH_OUTPUT){
  const filepath=path.resolve(process.env.SCALP_RESEARCH_OUTPUT);
  await mkdir(path.dirname(filepath),{recursive:true});
  await writeFile(filepath,JSON.stringify(publicReport,null,2)+'\n',{mode:0o600});
 }
 if(report.results.every(x=>x.status==='RESEARCH_ERROR'||x.status==='NO_ACTIVE_TRADABLE_PAPER_ASSET'))
   process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href)
  main().catch(e=>{console.error('Market research failed:',String(e.message||e));process.exitCode=1;});
