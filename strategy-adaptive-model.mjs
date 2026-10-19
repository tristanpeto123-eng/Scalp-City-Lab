// Adaptive STRATEGY RESEARCH, not AI-autonomous trading.
// Each crypto pair is screened independently using only pre-evaluation candles.
// First 20% discovers candidates, next 20% checks them at ordinary AND
// doubled modelled fees, last 60% remains untouched until one strategy is frozen.
// Never promote validation-period returns into the candidate selector.
import {PAIRS,checkSnapshot,simulateValidation} from './strategy-validation-core.mjs';
import {inventCandidates,INVENT_VERSION} from './strategy-free-discovery.mjs';
export const AUTO_MODEL_VERSION='CHART_AUTO_RESEARCH_V1';
export const AUTO_CANDIDATES=Object.freeze([
 {strategy:'ema',params:{fast:5,slow:21},label:'EMA short 5/21'},
 {strategy:'ema',params:{fast:9,slow:34},label:'EMA trend 9/34'},
 {strategy:'ema',params:{fast:12,slow:48},label:'EMA trend 12/48'},
 {strategy:'rsi',params:{period:14,buyBelow:25,sellAbove:60},label:'RSI pullback 14/25/60'},
 {strategy:'rsi',params:{period:14,buyBelow:30,sellAbove:65},label:'RSI pullback 14/30/65'},
 {strategy:'breakout',params:{lookback:20,exitLookback:10},label:'Channel 20/10'},
 {strategy:'breakout',params:{lookback:40,exitLookback:20},label:'Channel 40/20'},
 {strategy:'breakout',params:{lookback:60,exitLookback:30},label:'Channel 60/30'}
]);
const round=n=>Math.round(n*100)/100;
const limitedSnapshot=(source,bars)=>({...source,bars});
export function chartBehavior(trainingBars){
 if(!Array.isArray(trainingBars)||trainingBars.length<100)throw Error('Insufficient closed bars for chart profile');
 const first=trainingBars[0],last=trainingBars.at(-1);
 let zero=0,totalRange=0,squared=0,sum=0;
 const logReturns=[];
 for(let i=0;i<trainingBars.length;i++){
  const b=trainingBars[i];
  if(Number(b.v)===0)zero++;
  totalRange+=(Number(b.h)-Number(b.l))/Number(b.c);
  if(i){const prior=Number(trainingBars[i-1].c),current=Number(b.c);
   const r=Math.log(current/prior);logReturns.push(r);sum+=r;squared+=r*r;}
 }
 const mean=sum/logReturns.length;
 const deviation=Math.sqrt(Math.max(0,squared/logReturns.length-mean*mean));
 const movement=100*(Number(last.c)/Number(first.c)-1);
 const dailyVol=100*deviation*Math.sqrt(96);
 return {
  sampleStart:first.t,sampleEnd:last.t,trainingBars:trainingBars.length,
  observedPeriodMovePct:round(movement),dailyVolatilityPct:round(dailyVol),
  average15mRangePct:round(100*totalRange/trainingBars.length),
  zeroVolumePct:round(100*zero/trainingBars.length),
  regime:dailyVol>9?'HIGH_VOLATILITY':Math.abs(movement)>8?'DIRECTIONAL':'MIXED',
  method:'Descriptive features of finished training candles only; no next-price predictor'
 };
}
function windowRun(dataset,symbol,startingBalanceGbp,candidate,feePerSideFraction,now){
 return simulateValidation({snapshot:dataset,symbol,startingBalanceGbp,
  strategy:candidate.strategy,strategyParams:candidate.params,
  mode:'duration',limit:365,feePerSideFraction,now});
}
function assess(first,second,stress){
 const rejection=[];
 if(first.closedTrades<2)rejection.push('DISCOVERY_UNDER_2_CLOSED_TRADES');
 if(second.closedTrades<2)rejection.push('CONFIRMATION_UNDER_2_CLOSED_TRADES');
 if(first.realizedNetProfitGbp<=0)rejection.push('DISCOVERY_NET_NEGATIVE_OR_FLAT');
 if(second.realizedNetProfitGbp<=0)rejection.push('CONFIRMATION_NET_NEGATIVE_OR_FLAT');
 if(stress.realizedNetProfitGbp<=0)rejection.push('DOUBLE_FEE_STRESS_FAILED');
 if(second.maxDrawdownPct>10)rejection.push('CONFIRMATION_DRAWDOWN_GT_10_PERCENT');
 // A chart can have a few winning trades and still lose money overall.
 const score=round((first.realizedNetProfitGbp+2*second.realizedNetProfitGbp+
   stress.realizedNetProfitGbp)/3-second.maxDrawdownPct*.05);
 return {eligible:rejection.length===0,rejection,score};
}
function describeCandidate(candidate,first,second,stress){
 const analysis=assess(first,second,stress);
 return {
  strategy:candidate.strategy,params:{...candidate.params},label:candidate.label,
  method:candidate.strategy==='ema'?'Trend-following moving-average momentum':
    candidate.strategy==='rsi'?'Countertrend RSI pullback/recovery':
    candidate.strategy==='synth'?'Invented, auditable composite entry/exit rules':
    'Prior-bar price channel momentum with trailing exit',
  discovery:{closedTrades:first.closedTrades,netGbp:first.realizedNetProfitGbp,
    winRatePct:first.winRatePct,maxDrawdownPct:first.maxDrawdownPct},
  confirmation:{closedTrades:second.closedTrades,netGbp:second.realizedNetProfitGbp,
    winRatePct:second.winRatePct,maxDrawdownPct:second.maxDrawdownPct,
    profitFactor:second.profitFactor},
  doubledFee:{netGbp:stress.realizedNetProfitGbp,closedTrades:stress.closedTrades},
  ...analysis
 };
}
export function screenChart({
 snapshot,symbol,startingBalanceGbp=50,now=Date.now(),strategyMode='preset'
}={}){
 if(!['preset','invent'].includes(strategyMode))throw Error('Unknown strategy creation mode');
 if(!PAIRS.includes(symbol))throw Error('Unknown crypto chart');
 // Uses the same independent baseline/data vetting as every manual replay.
 const source=checkSnapshot(snapshot,symbol,now);
 if(!Number.isFinite(startingBalanceGbp)||startingBalanceGbp<50||startingBalanceGbp>1e6)
  throw Error('Starting virtual balance must be at least £50');
 const N=source.bars.length,firstEnd=Math.floor(N*.2),confirmationEnd=Math.floor(N*.4);
 const behavior=chartBehavior(snapshot.bars.slice(0,confirmationEnd));
 const modelId='CHART_'+symbol.replace('/','');
 if(firstEnd<480||confirmationEnd-firstEnd<480){
  return {status:'INSUFFICIENT_INDEPENDENT_TRAINING',modelId,symbol,strategyMode,
   behavior,selected:null,candidates:[],evidence:'No strategy may be selected from a short history',
   outerHoldoutIntact:true};
 }
 const discovery=limitedSnapshot(snapshot,snapshot.bars.slice(0,firstEnd));
 const confirmation=limitedSnapshot(snapshot,snapshot.bars.slice(firstEnd,confirmationEnd));
 // Invention sees only the earliest discovery slice, never confirmation or holdout.
 const hypotheses=strategyMode==='invent'?inventCandidates(discovery.bars):AUTO_CANDIDATES;
 const results=hypotheses.map(candidate=>{
  const first=windowRun(discovery,symbol,startingBalanceGbp,candidate,.0025,now);
  const second=windowRun(confirmation,symbol,startingBalanceGbp,candidate,.0025,now);
  const stress=windowRun(confirmation,symbol,startingBalanceGbp,candidate,.005,now);
  return describeCandidate(candidate,first,second,stress);
 });
 const viable=results.filter(x=>x.eligible).sort((a,b)=>b.score-a.score||a.label.localeCompare(b.label));
 const ranked=results.slice().sort((a,b)=>a.rejection.length-b.rejection.length||
  b.score-a.score||a.label.localeCompare(b.label));
 const selected=viable[0]||null;
 const status=selected?'SCREENED_CANDIDATE_RESEARCH_ONLY':'ABSTAIN_NO_POSITIVE_EDGE_AFTER_FEES';
 const stats=selected?.confirmation||ranked[0]?.confirmation||null;
 const explanations=[
  {agent:'Data Curator',method:'Verify every 15-minute executed-volume candle and feed provenance',
    evidence:N+' continuous historical candles, '+source.zeroVolumeFraction.toFixed(3)+' zero-volume fraction',
    decision:'Source admitted to research'},
  {agent:'Researcher',method:'Profile trend, volatility and range on the first 40% ONLY',
    evidence:behavior.regime+'; '+behavior.observedPeriodMovePct+'% period move; '+behavior.dailyVolatilityPct+'% daily volatility',
    decision:'Descriptive observations, not a price forecast'},
  {agent:'Strategy Designer',method:strategyMode==='invent'?
    'Compose original bounded entry/exit rule hypotheses from early chart data':
    'Try eight fixed rule sets independently on this exact pair',
    evidence:results.length+(strategyMode==='invent'?
      ' independently generated composite candidates':' candidates across EMA, RSI and Donchian breakout'),
    decision:selected?selected.label+' passed both internal windows':'No strategy demonstrated sufficiently positive after-cost results'},
  {agent:'Checker',method:'Two disjoint training windows, plus doubled-cost confirmation stress',
    evidence:stats?stats.closedTrades+' confirmation closes; net £'+stats.netGbp:'No confirmation data',
    decision:status},
  {agent:'Risk Manager',method:'1% planned stop exposure; 50% allocation cap; reject weak candidates',
    evidence:'Modelled 0.25% Alpaca tier-1 taker fees each side, doubled-fee stress at 0.5% each side; spread and slippage excluded',
    decision:selected?'Allow unseen historical replay only':'ABSTAIN; no live or paper broker orders'}
 ];
 return {
  modelId,symbol,version:strategyMode==='invent'?INVENT_VERSION:AUTO_MODEL_VERSION,
  strategyMode,status,selected,behavior,candidates:ranked,
  trainingWindows:{
   discovery:{start:discovery.bars[0].t,end:discovery.bars.at(-1).t,count:discovery.bars.length},
   confirmation:{start:confirmation.bars[0].t,end:confirmation.bars.at(-1).t,count:confirmation.bars.length},
   evaluation:{start:snapshot.bars[confirmationEnd].t,end:snapshot.bars.at(-1).t,count:N-confirmationEnd}
  },
  outerHoldoutIntact:true,
  usesOtherPairsTraining:false,
  scoreDerivedFromOuterEvaluation:false,
  learningType:strategyMode==='invent'?
   'TRAINING_ONLY_COMPOSITE_RULE_INVENTION_NOT_NEURAL_AI':
   'TRAINING_ONLY_RULE_SEARCH_NOT_NEURAL_AI',
  evidence:'Same historical dataset tested once per candidate; repeated/overlapping windows are not independent forward proof',
  explanations
 };
}
export function validateAdaptive({snapshot,symbol,startingBalanceGbp=50,mode='duration',
 limit=14,now=Date.now(),strategyMode='preset'}={}){
 // First freeze a strategy based only on the earliest 40%; if none
 // passes, abstain rather than manufacturing an 80% win-rate.
 const model=screenChart({snapshot,symbol,startingBalanceGbp,now,strategyMode});
 if(!model.selected)return {status:model.status,model,replay:null,brokerOrders:0,
  predictedGuaranteedProfit:false};
 const replay=simulateValidation({snapshot,symbol,startingBalanceGbp,
  mode,limit,strategy:model.selected.strategy,
  strategyParams:model.selected.params,feePerSideFraction:.0025,now});
 // Checker inspects ONLY AFTER strategy is frozen, cannot feed results back
 // to the current candidate selector. A negative or tiny out-of-sample
 // result MUST NEVER be described as a validated winning model.
 const reasons=[];
 if(replay.closedTrades<20)reasons.push('INSUFFICIENT_OUTER_HOLDOUT_TRADES');
 if(replay.realizedNetProfitGbp<=0)reasons.push('OUTER_HOLDOUT_NET_NOT_POSITIVE');
 if(replay.maxDrawdownPct>10)reasons.push('OUTER_HOLDOUT_DRAWDOWN_GT_10');
 const winTargetObserved=replay.winRatePct!==null&&replay.winRatePct>=80;
 const verdict=reasons.length?'HOLDOUT_REJECTED':
   'HOLDOUT_POSITIVE_RESEARCH_ONLY_NOT_FORWARD_VALIDATED';
 return {status:verdict,model,replay,brokerOrders:0,
  checker:{reasons,observed80PctWinTargetMet:winTargetObserved,
   requiredFutureEvidence:'Independent genuinely new data and verified forward trading results',
   eligibleForBrokerExecution:false,independentForwardValidated:false},
  predictedGuaranteedProfit:false};
}
