// Eight crypto markets: one-shot, READ-ONLY real market data comparisons.
// It NEVER calls paperOrder; it NEVER broadens production trading allowlists.
import {AlpacaPaper} from './alpaca-paper.mjs';
import {CRYPTO_RESEARCH_ONLY,isResearchCrypto} from './crypto-research-marketset.mjs';
import {loadHistoricalCrypto,replayHistorical} from './replay-profit.mjs';
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
export async function runScreener({broker,markets=CRYPTO_RESEARCH_ONLY,days=90,now=Date.now(),
   maximumPages=80}={}){
 if(!broker||!Array.isArray(markets)||markets.length<1||markets.length>8||
   new Set(markets).size!==markets.length||markets.some(s=>!isResearchCrypto(s)||!CRYPTO_RESEARCH_ONLY.includes(s)))
   throw Error('Only the eight research-only crypto USD pairs are permitted');
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
   const source=await loadHistoricalCrypto({broker,symbol,days,now,maximumPages});
   const dq=quality(source.raw);
   if(!dq.ok){
     results.push({symbol,status:'DATA_QUALITY_REJECTED',eligible:false,data:dq,
       pages:source.fetchedPages});
   }else{
     const replay=replayHistorical({symbol,raw:source.raw,closedBefore:now-30000});
     const {independentHoldout,holdoutReasons,holdoutVerdict,params,eligible,calibrationBars}=replay.trainOnlySelection;
     results.push({symbol,status:eligible?'FROZEN_REPLAY_EVALUATED':'STRATEGY_REJECTED',
       eligible,params,holdoutVerdict,holdoutReasons,calibrationBars,
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
   targets:target,days,checkedAt:new Date(now).toISOString(),
   marketsChecked:results.length,results,
   eligibleMarkets:results.filter(x=>x.eligible).map(x=>x.symbol),
   brokerOrdersSubmitted:0,
   disclaimer:'Historical candle simulation, not actual trades, profit or verified live forward win rate. All 8 new markets are research only; hard-coded Alpaca broker order allowlist remains unchanged.'};
}
async function main(){
 const days=Number(process.env.SCALP_RESEARCH_DAYS||90),broker=new AlpacaPaper();
 const report=await runScreener({broker,days});
 console.log('MARKET_RESEARCH_REPORT '+JSON.stringify(report));
 if(process.env.SCALP_RESEARCH_OUTPUT){
  const filepath=path.resolve(process.env.SCALP_RESEARCH_OUTPUT);
  await mkdir(path.dirname(filepath),{recursive:true});
  await writeFile(filepath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 }
 if(report.results.every(x=>x.status==='RESEARCH_ERROR'||x.status==='NO_ACTIVE_TRADABLE_PAPER_ASSET'))
   process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href)
  main().catch(e=>{console.error('Market research failed:',String(e.message||e));process.exitCode=1;});
