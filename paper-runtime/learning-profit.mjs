// Flexible-exit GBP-50 virtual strategy research, targeting £2,000 NET profit.
// NO fixed reward:risk; stop loss + next-open bearish trend exit. Never places orders.
import {initializeTrial,queueSignal,requestExit,processBar,trialReport,TRIAL_RULES} from './trial-profit.mjs';
import {isResearchCrypto} from './crypto-research-marketset.mjs';
import {normaliseStrategy,strategyKey,signalPolicy} from './signal-policies.mjs';
const ALLOWED=new Set(['BTC/USD','ETH/USD','SPY','QQQ','IWM']);
const finite=Number.isFinite;
export const PROFIT_OBJECTIVE=Object.freeze({
  startingGbp:50,netProfitTargetGbp:2000,targetBalanceGbp:2050,
  mandatoryRR:null,minimumClosedTrades:0,maximumClosedTrades:null,secondaryWinRateGoalPct:80,
  minTrainingClosed:3,minHoldoutClosed:3,maxDrawdownPct:20
});
export function validateHistory(bars,params){
 if(!Array.isArray(bars)||bars.length<80)throw Error('Invalid profit research input');
 normaliseStrategy(params);
 let prev=-Infinity;
 for(const b of bars){
  if(!finite(b.t)||b.t<=prev||![b.o,b.h,b.l,b.c].every(finite)||
    Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.c,b.l)||
    b.l>Math.min(b.o,b.c,b.h))throw Error('Invalid timestamped OHLC data');
  prev=b.t;
 }
}
export function simulateProfit(bars,params,{symbol,start=1,end=bars.length,feeMultiplier=1}={}){
 if(!ALLOWED.has(symbol)&&!isResearchCrypto(symbol))throw Error('Symbol not allowlisted');
 validateHistory(bars,params);
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>bars.length||start>=end)
  throw Error('Invalid research time segment');
 const policy=signalPolicy(params);
 let state=initializeTrial();
 for(let i=0;i<end;i++){
  const b=bars[i];
  if(i>=start){
   const result=processBar(state,{...b,t:new Date(b.t).toISOString(),symbol},{feeMultiplier});
   state=result.state;
  }
  const signal=policy.observe(b); // decision made at completed candle close
  if(i>=start){
   const barStart=new Date(b.t).toISOString();
   if(signal.ready&&signal.entry&&!state.open&&!state.pending)
    state=queueSignal(state,{symbol,signalBarStart:barStart,candidateId:'candidate-evaluation'}).state;
   else if(signal.ready&&signal.exit&&state.open)
    state=requestExit(state,{symbol,signalBarStart:barStart}).state;
  }
 }
 const summary=trialReport(state);
 let peak=50,balance=50,maxDD=0,netGrossWinners=0,netGrossLosers=0;
 for(const trade of state.closedTrades){
   balance+=trade.netGbp;
   peak=Math.max(balance,peak);
   maxDD=Math.max(maxDD,100*(peak-balance)/peak);
   if(trade.netGbp>0)netGrossWinners+=trade.netGbp;else netGrossLosers-=trade.netGbp;
 }
 const pf=netGrossLosers>0?netGrossWinners/netGrossLosers:(netGrossWinners>0?null:0);
 return {symbol,segment:[start,end],closedTrades:state.closedTrades.length,
  wins:summary.wins,winRatePct:summary.winRatePct,
  netGbp:summary.netProfitGbp,balanceGbp:summary.balanceGbp,
  profitFactor:pf,maxDrawdownPct:maxDD,
  expectancyGbp:state.closedTrades.length?summary.netProfitGbp/state.closedTrades.length:0,
  remainingToGoalGbp:summary.remainingProfitGbp,
  trades:state.closedTrades,openAtEnd:Boolean(state.open),
  feeMultiplier,scope:'HISTORICAL_RESEARCH_NO_BROKER_FILLS',mandatoryRR:null};
}
function selectScore(x){
 const m=x.result;
 if(m.closedTrades<PROFIT_OBJECTIVE.minTrainingClosed||m.netGbp<=0||
    m.profitFactor===0||m.maxDrawdownPct>PROFIT_OBJECTIVE.maxDrawdownPct)return -Infinity;
 // Profit and net expectancy lead; win rate is a secondary observation.
 const pf=m.profitFactor===null?4:Math.min(4,m.profitFactor);
 return m.netGbp*8+m.expectancyGbp*4+pf*2-m.maxDrawdownPct*.25+m.winRatePct*.01;
}
export function optimizeProfit(bars,candidates,symbol){
 if((!ALLOWED.has(symbol)&&!isResearchCrypto(symbol))||!Array.isArray(candidates)||candidates.length===0)
  throw Error('Missing profit strategy candidates');
 const cut=Math.floor(bars.length*.75);
 if(cut<=100||bars.length-cut<30)throw Error('Insufficient historical holdout');
 const tested=candidates.map(params=>{const result=simulateProfit(bars,params,{symbol,start:1,end:cut});
   return {params,result,score:selectScore({result})};});
 tested.sort((a,b)=>b.score-a.score||strategyKey(a.params).localeCompare(strategyKey(b.params)));
 const first=tested.find(x=>Number.isFinite(x.score));
 return {candidate:first||tested[0],trainingEligible:Boolean(first),cut,
  selectionBasis:'TRAIN_NET_GBP_PROFIT_NOT_FIXED_RR',
  trainingOptions:tested.map(x=>({params:x.params,closedTrades:x.result.closedTrades,
    netProfitGbp:x.result.netGbp,winRatePct:x.result.winRatePct,
    maxDrawdownPct:x.result.maxDrawdownPct,score:Number.isFinite(x.score)?x.score:null})),
  sealedHoldout:[cut,bars.length]};
}
// Independent order/accounting audit; no calls back into signal simulator.
export function auditProfit(trades,bars,{start,end}){
 let prevExit=start-1,total=0,wins=0,peak=50,balance=50,maxDD=0;
 for(const t of trades){
  const entryIndex=bars.findIndex(b=>new Date(b.t).toISOString()===t.openedAt);
  const exitIndex=bars.findIndex(b=>new Date(b.t+900000).toISOString()===t.closedAt);
  if(entryIndex<start||exitIndex>=end||entryIndex<=prevExit||exitIndex<entryIndex)
   throw Error('Profit audit chronology invalid');
  if(Math.abs(t.entryPrice-bars[entryIndex].o)>1e-6||!finite(t.exitPrice)||
    !(t.notionalGbp>0)||!(t.feeRate>=0))throw Error('Invalid profit audit entry');
  const bar=bars[exitIndex];
  if(t.exitReason==='STOP'){
    if(bar.l>t.exitPrice+1e-7||t.exitPrice>t.entryPrice*.98+1e-6)throw Error('Stop audit invalid');
  }else if(t.exitReason==='STOP_GAP'){
    if(Math.abs(t.exitPrice-bar.o)>1e-7||bar.o>t.entryPrice*.98+1e-6)throw Error('Gap audit invalid');
  }else if(t.exitReason==='BEARISH_SIGNAL_NEXT_OPEN'){
    if(Math.abs(t.exitPrice-bar.o)>1e-7)throw Error('Signal-exit price mismatch');
  }else throw Error('Unrecognized profit exit');
  const gross=t.notionalGbp*t.exitPrice/t.entryPrice-t.notionalGbp;
  const fee=t.notionalGbp*t.feeRate*(1+t.exitPrice/t.entryPrice);
  const independent=gross-fee;
  if(Math.abs(independent-t.netGbp)>1e-6)throw Error('Independent GBP profit mismatch');
  total+=independent;balance+=independent;if(independent>0)wins++;
  peak=Math.max(peak,balance);maxDD=Math.max(maxDD,100*(peak-balance)/peak);
  prevExit=exitIndex;
 }
 return {audited:true,closedTrades:trades.length,netGbp:total,wins,maxDrawdownPct:maxDD};
}
export function validateProfit(bars,selection,symbol){
 if(!selection?.candidate)return {verdict:'BLOCKED',reasons:['No candidate'],accountingMatch:false};
 const {params}=selection.candidate,cut=selection.cut;
 if(!Number.isInteger(cut)||cut<80||bars.length-cut<30)throw Error('No sealed profit holdout');
 const hold=simulateProfit(bars,params,{symbol,start:cut,end:bars.length});
 const audited=auditProfit(hold.trades,bars,{start:cut,end:bars.length});
 const stress=simulateProfit(bars,params,{symbol,start:cut,end:bars.length,feeMultiplier:2});
 const stressAudit=auditProfit(stress.trades,bars,{start:cut,end:bars.length});
 const match=Math.abs(audited.netGbp-hold.netGbp)<1e-5&&
  audited.wins===hold.wins&&stressAudit.audited;
 if(!match)throw Error('Independent profit/strategy PnL mismatch');
 const reasons=[];
 if(!selection.trainingEligible)reasons.push('Training candidate not eligible');
 if(hold.closedTrades<PROFIT_OBJECTIVE.minHoldoutClosed)reasons.push('Insufficient holdout closed trades');
 if(hold.netGbp<=0)reasons.push('Holdout net GBP profit nonpositive');
 if(stress.netGbp<=0)reasons.push('Fails 2x fee stress');
 if(hold.maxDrawdownPct>PROFIT_OBJECTIVE.maxDrawdownPct)reasons.push('Excess drawdown');
 const {trades:_,...summary}=hold,{trades:__,...stressSummary}=stress;
 return {verdict:reasons.length?'BLOCKED':'AUDIT_PASS',reasons,holdout:summary,
  stress:stressSummary,accountingMatch:true,objective:PROFIT_OBJECTIVE,
  scope:'Historical 25% holdout: not live profit, not guaranteed £2000',
  trainingSelectionOnly:true};
}
