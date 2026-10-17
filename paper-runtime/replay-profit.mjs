// Historical-as-live flexible-exit PROFIT research replay. Every historical bar becomes visible at its
// simulated close. No API ORDER methods, no live-forward claims, no future peeking.
// Frozen EMA candidate is chosen in calibration, then evaluated in untouched replay.
import {createHash} from 'node:crypto';
import {optimizeProfit,validateProfit} from './learning-profit.mjs';
import {initializeTrial,queueSignal,requestExit,processBar,trialReport,TRIAL_RULES} from './trial-profit.mjs';
import {isResearchCrypto} from './crypto-research-marketset.mjs';
const INTERVAL=15*60_000;
const ALLOWED=new Set(['BTC/USD','ETH/USD','SPY','QQQ','IWM']);
const CANDIDATES=[{fast:6,slow:26},{fast:9,slow:34},{fast:12,slow:48}];
const fingerprint=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function formatBars(raw,closedBefore=Infinity){
 if(!Array.isArray(raw))throw Error('Expected historical OHLCV array');
 const bars=raw.map(b=>({t:Date.parse(b.t),o:Number(b.o),h:Number(b.h),
   l:Number(b.l),c:Number(b.c),v:Number(b.v)}));
 for(let i=0;i<bars.length;i++){
   const b=bars[i];
   if(!Number.isFinite(b.t)||![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||
      Math.min(b.o,b.h,b.l,b.c)<=0||b.v<0||
      b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)||
      (i&&bars[i-1].t>=b.t))throw Error('Historical data bad or duplicated at row '+i);
   if(b.t+INTERVAL>closedBefore)throw Error('Future/incomplete candle in replay');
 }
 return bars;
}
function emaState(params,history){
 let fast=null,slow=null;
 const a=2/(params.fast+1),b=2/(params.slow+1);
 for(const bar of history){
  fast=fast===null?bar.c:fast+a*(bar.c-fast);
  slow=slow===null?bar.c:slow+b*(bar.c-slow);
 }
 return {fast,slow};
}
export function replayHistorical({symbol,raw,calibrationFraction=.40,candidates=CANDIDATES,closedBefore=Infinity}){
 if((!ALLOWED.has(symbol)&&!isResearchCrypto(symbol))||!Number.isFinite(calibrationFraction)||
    calibrationFraction<.25||calibrationFraction>.65)throw Error('Invalid replay configuration');
 const bars=formatBars(raw,closedBefore);
 if(bars.length<480)throw Error('Need at least 480 completed historical candles');
 const calibrationEnd=Math.floor(bars.length*calibrationFraction);
 if(calibrationEnd<200||bars.length-calibrationEnd<200)throw Error('Insufficient calibration or unseen replay bars');
 // Candidate selection uses only calibration data; the evaluator never gets
 // the later bars before its candidate is frozen.
 const calibration=bars.slice(0,calibrationEnd);
 const selected=optimizeProfit(calibration,candidates,symbol);
 const validation=validateProfit(calibration,selected,symbol);
 const params=Object.freeze({...selected.candidate.params});
 const candidateId=fingerprint({symbol,params,
   calibrationEndBar:new Date(calibration.at(-1).t).toISOString(),
   objective:TRIAL_RULES.version}).slice(0,32);
 const eligible=selected.trainingEligible&&validation.verdict==='AUDIT_PASS';
 const trainingResult={eligible,params,candidateId,trainingEligible:selected.trainingEligible,
   calibrationBars:calibration.length,trainOptions:selected.trainingOptions,
   independentHoldout:validation.holdout,holdoutVerdict:validation.verdict,
   holdoutReasons:validation.reasons,
   calibrationPeriod:{start:new Date(calibration[0].t).toISOString(),
     end:new Date(calibration.at(-1).t+INTERVAL).toISOString()}};
 let state=initializeTrial();
 const evaluated=bars.slice(calibrationEnd);
 if(eligible){
  const alpha=2/(params.fast+1),beta=2/(params.slow+1);
  let {fast,slow}=emaState(params,calibration);
  // At each step the bar is the ONLY newly visible observation.
  // Run the entry/exit engine first, then observe this candle's close,
  // then queue the next-open signal. Can't enter after observing current high.
  for(const bar of evaluated){
    const observed=processBar(state,{symbol,t:new Date(bar.t).toISOString(),
      o:bar.o,h:bar.h,l:bar.l,c:bar.c});
    state=observed.state;
    fast=fast+alpha*(bar.c-fast);
    slow=slow+beta*(bar.c-slow);
    if(!state.open&&!state.pending&&fast>slow){
      state=queueSignal(state,{symbol,signalBarStart:new Date(bar.t).toISOString(),candidateId}).state;
    }else if(state.open&&fast<=slow){
      state=requestExit(state,{symbol,signalBarStart:new Date(bar.t).toISOString()}).state;
    }
  }
 }
 const report=trialReport(state);
 const chronological=state.closedTrades.every((t,i,a)=>i===0||Date.parse(a[i-1].closedAt)<Date.parse(t.closedAt));
 if(!chronological)throw Error('Completed trades have invalid order/timestamps');
 return {mode:'HISTORICAL_AS_LIVE_REPLAY_NOT_FORWARD',asset:symbol,
   virtualStartGbp:50,netProfitTargetGbp:2000,targetBalanceGbp:2050,
   maxTrades:null,minTradesForProfitGoal:0,
   mandatoryRewardRisk:null,entryRiskFraction:.01,
   trainOnlySelection:trainingResult,evaluation:{
     bars:evaluated.length,begin:new Date(evaluated[0].t).toISOString(),
     end:new Date(evaluated.at(-1).t+INTERVAL).toISOString(),
     candidateFrozen:eligible,closedTrades:report.closedTrades,wins:report.wins,
     winRatePct:report.winRatePct,wilson95LowerPct:report.wilson95LowerPct,
     balanceGbp:report.balanceGbp,netGbp:report.netGbp,
     profitTargetGbp:2000,remainingProfitGbp:report.remainingProfitGbp,
     virtualProfitGoalMet:eligible&&report.targetReached,
     profitFactor:report.profitFactor,maxDrawdownGbp:report.maxDrawdownGbp,
     observed80pctWinRate:eligible&&report.closedTrades>0&&report.winRatePct>=80,
     actualLiveForwardTradeCount:0,openAtEnd:Boolean(state.open),
     status:eligible?'REPLAY_EVALUATED':'CALIBRATION_REJECTED'},
   closedTradeEvidence:eligible?state.closedTrades.map(t=>({
     id:t.id,candidateId:t.candidateId,entry:t.openedAt,closed:t.closedAt,
     symbol:t.symbol,exit:t.exitReason,pnlVirtualGbp:t.netGbp,
     fees:t.feeBasis,source:'HISTORICAL_REPLAY'})):[],
   dataFingerprint:fingerprint(bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v])),
   barsProcessed:bars.length,
   disclaimer:'Historical variable-exit profit research; no fixed R:R. Historical chronological simulation with modeled fees and no FX, slippage or real fills. Never counts as genuine live forward evidence; no future observations entered the training window.'};
}
export async function loadHistoricalCrypto({broker,symbol,days=180,now=Date.now(),maximumPages=80,location='us'}={}){
 if(!broker||!isResearchCrypto(symbol)||!Number.isInteger(days)||days<8||days>365||
    !Number.isInteger(maximumPages)||maximumPages<1||maximumPages>100||!['us','us-1'].includes(location))throw Error('Invalid crypto replay source');
 const params=new URLSearchParams({symbols:symbol,timeframe:'15Min',
   start:new Date(now-days*86400_000).toISOString(),end:new Date(now-30_000).toISOString(),
   limit:'10000',sort:'asc'});
 const tokens=new Set(),raw=[];
 for(let i=0;i<maximumPages;i++){
  const data=await broker.req('https://data.alpaca.markets',
    '/v1beta3/crypto/'+location+'/bars?'+params.toString());
  const received=data?.bars?.[symbol];
  if(!Array.isArray(received))throw Error('Historical API omitted '+symbol);
  raw.push(...received);
  if(!data.next_page_token) {
   return {raw:raw.filter(b=>Date.parse(b.t)+INTERVAL<=now-30_000),
     fetchedPages:i+1,symbol,days,
     source:'ALPACA_CRYPTO_'+location.toUpperCase()+'_BARS_GET_ONLY'};
  }
  if(tokens.has(data.next_page_token))throw Error('Repeated historical page token');
  tokens.add(data.next_page_token);
  params.set('page_token',data.next_page_token);
 }
 throw Error('Incomplete historical pagination after '+maximumPages+' pages / '+raw.length+' bars; refuse truncated training results');
}
