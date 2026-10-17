// One independent explainable research model per chart/pair.
// A "model" here is transparent regime features + tried candidate strategies +
// TRAIN-only history, not a neural net or a profitable prediction guarantee.
import {AGENTS} from './engine.mjs';
import {isResearchCrypto,CRYPTO_RESEARCH_MARKETS} from './crypto-research-marketset.mjs';
import {normaliseStrategy,explainSignalPolicy} from './signal-policies.mjs';
import {TRIAL_RULES} from './trial-profit.mjs';
import {assertMemory} from './learning-memory.mjs';
const round=(x,n=4)=>Number(x.toFixed(n));
export const chartId=s=>'CHART_'+s.replace('/','');
export function profileChart(raw){
 if(!Array.isArray(raw)||raw.length<100)throw Error('Insufficient past closed candles for chart regime profile');
 const rows=raw.map(b=>({
  t:typeof b.t==='number'?b.t:Date.parse(b.t),
  o:Number(b.o),h:Number(b.h),l:Number(b.l),c:Number(b.c),v:Number(b.v)
 }));
 for(let i=0;i<rows.length;i++){
  const b=rows[i];
  if(!Number.isFinite(b.t)||[b.o,b.h,b.l,b.c,b.v].some(x=>!Number.isFinite(x))||
    Math.min(b.o,b.h,b.l,b.c)<=0||b.v<0||b.h<Math.max(b.o,b.c,b.l)||
    b.l>Math.min(b.o,b.c,b.h)||(i>0&&b.t<=rows[i-1].t))
   throw Error('Invalid past chart OHLCV');
 }
 const returns=[],ranges=[];
 let up=0,zero=0;
 for(let i=0;i<rows.length;i++){
  const b=rows[i];
  ranges.push(100*(b.h-b.l)/b.c);
  if(b.v===0)zero++;
  if(i){const r=Math.log(b.c/rows[i-1].c);returns.push(r);if(r>0)up++;}
 }
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const sd=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/returns.length);
 const dailyVolPct=100*sd*Math.sqrt(96);
 const periodMovePct=100*(rows.at(-1).c/rows[0].c-1);
 const rangePct=ranges.reduce((a,b)=>a+b,0)/ranges.length;
 const absTrend=Math.abs(periodMovePct);
 const regime=dailyVolPct>9?'HIGH_VOLATILITY':
   absTrend>8?'DIRECTIONAL':
   'MIXED_OR_RANGE';
 const lagNum=returns.slice(1).reduce((sum,r,i)=>sum+
  (r-mean)*(returns[i]-mean),0);
 const corrDen=returns.reduce((sum,r)=>sum+(r-mean)**2,0);
 const lag1=corrDen>0?lagNum/corrDen:0;
 return {candles:rows.length,timeframe:'15Min',
   sampleStart:new Date(rows[0].t).toISOString(),
   sampleEnd:new Date(rows.at(-1).t+900000).toISOString(),
   sampledClose:rows.at(-1).c,
   observedPriceChangePct:round(periodMovePct,2),
   dailyRealizedVolatilityPct:round(dailyVolPct,2),
   averageCandleRangePct:round(rangePct,3),
   upCandleFractionPct:round(100*up/returns.length,2),
   lagOneReturnCorrelation:round(lag1,3),
   zeroVolumeFractionPct:round(100*zero/rows.length,2),
   descriptiveRegime:regime,
   interpretation:'Historical training-candle observations only: not next-price forecasts or executable quotes'};
}
export function pairModels(memory){
 assertMemory(memory);
 return CRYPTO_RESEARCH_MARKETS.map(symbol=>{
  const history=memory.experiments.filter(e=>e.symbol===symbol);
  const independent=history.filter(e=>e.acceptedForLearning);
  const latest=[...history].sort((a,b)=>Date.parse(b.trainingEnd)-Date.parse(a.trainingEnd))[0];
  const methods=[...new Set(history.flatMap(e=>e.trainingOptions.map(o=>normaliseStrategy(o.params).family)))];
  return {modelId:chartId(symbol),symbol,policy:memory.policy,
    independentTrainingWindows:independent.length,
    totalHistoricalStudies:history.length,
    sources:[...new Set(history.map(e=>e.feed))],
    strategiesExplored:methods,
    lastTrainingProfile:latest?.behavior||null,
    lastTrainingEnd:latest?.trainingEnd||null,
    liveTradingEnabled:false};
 });
}
export function explainChartModel({symbol,feed,proposal,replay,behavior,learning}){
 if(!isResearchCrypto(symbol)||!['us','us-1'].includes(feed)||
    proposal.market!==symbol||proposal.feed!==feed||!behavior||
    !replay?.trainOnlySelection||!learning)throw Error('Invalid chart explanation context');
 const t=replay.trainOnlySelection,params=normaliseStrategy(t.params);
 const method=explainSignalPolicy(params);
 const eligible=t.eligible&&learning.acceptedForLearning;
 const rejection=t.holdoutReasons?.join('; ')||'Not independently validated';
 const byId={
 'BM-01':{method:'Coordinate source-locked, non-order research stages for this exact pair',
  evidence:feed+' 15-minute finalized candles',decision:eligible?'Candidate passed screening':'Reject strategy promotion'},
 'DC-01':{method:'Check chronological OHLCV, zero-volume fraction and candle completion',
  evidence:behavior.candles+' training bars; '+behavior.zeroVolumeFractionPct+'% zero-volume',
  decision:'Input features accepted for descriptive research'},
 'RS-01':{method:'Measure training-only volatility, trend, candle ranges and lagged returns',
  evidence:behavior.descriptiveRegime+'; volatility/day '+behavior.dailyRealizedVolatilityPct+
   '%; sample move '+behavior.observedPriceChangePct+'%',
  decision:'Observed past regime only; no price forecast'},
 'SD-01':{method:'Compare transparent EMA crossover, RSI reversion and breakout rules',
  evidence:proposal.candidates.map(p=>normaliseStrategy(p).family).join(', '),
  decision:'Proposed '+proposal.candidates.length+' pair-specific test configurations'},
 'OP-01':{method:'Rank candidates by TRAIN-only net GBP, expectancy, win rate and drawdown',
  evidence:t.trainOptions.length+' training results; '+proposal.priorIndependentWindows+' older independent windows',
  decision:'Selected '+method.parameters.family+' for external evaluation'},
 'BT-01':{method:'Simulate £50 GBP virtual ledger, next-open fills, stops and estimated costs',
  evidence:'Target £'+TRIAL_RULES.targetNetProfitGbp+' cumulative net; no fixed RR; no trade count limit',
  decision:'Backtest is hypothetical, never a real trade'},
 'VL-01':{method:'Audit later calibration holdout without allowing it to choose candidates',
  evidence:t.holdoutVerdict+'; '+rejection,
  decision:eligible?'Screened candidate eligible for research-only replay':'Do not promote strategy'},
 'SC-01':{method:'Evaluate held-out GBP net return, 2x-cost stress, 80% win-rate separately',
  evidence:JSON.stringify({netGbp:t.independentHoldout?.netGbp??null,
   winRatePct:t.independentHoldout?.winRatePct??null}),
  decision:eligible?'Research score eligible; not live proof':'Screen rejected'},
 'RM-01':{method:'Apply at most 1% virtual planned entry risk, non-leveraged 50% allocation cap',
  evidence:'£50 starting balance; £2,000 accumulated net target; prices/costs hypothetical',
  decision:'Broker order placement remains blocked'},
 'PT-01':{method:'If research passed, replay future bars at next-open simulated prices only',
  evidence:'No live brokerage fill or protective stop has been verified',
  decision:'Zero real, paper or live-funded orders submitted'},
 'JR-01':{method:'Persist fingerprinted TRAIN-only evidence with overlap/duplicate checks',
  evidence:learning.reason+'; evidence '+learning.recordId.slice(0,12),
  decision:learning.acceptedForLearning?'New nonoverlapping training window saved':'Do not count as new independent learning'},
 'VA-01':{method:'Version and preserve pair-specific candidate, audit and rejection details',
  evidence:'Model '+chartId(symbol)+'; '+params.family,
  decision:'No autonomous deployment or model promotion'}
 };
 return {modelId:chartId(symbol),symbol,feed,
  trainingProfile:behavior,
  selectedStrategy:{...method,verifiedProfitable:false,eligibleForResearchReplay:eligible},
  candidateCount:t.trainOptions.length,holdoutVerdict:t.holdoutVerdict,
  holdoutReasons:t.holdoutReasons||[],learning:{
    independentNewWindow:learning.acceptedForLearning,reason:learning.reason,
    priorIndependentWindows:proposal.priorIndependentWindows,
    evidenceId:learning.recordId
  },
  agentExplanations:AGENTS.map(([id,name])=>({id,name,...byId[id]})),
  limitations:['Historical training statistics are not market predictions',
   'Holdout values cannot train or select a model',
   'No broker order execution, live fill verification or profit guarantee'],
  status:eligible?'RESEARCH_CANDIDATE_NOT_DEPLOYED':'RESEARCH_REJECTED'};
}
