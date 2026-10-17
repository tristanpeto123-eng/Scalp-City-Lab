// Fifty-pound, no-leverage GBP *virtual* forward-trial risk engine.
// Uses externally sourced USD-pair price RELATIVE MOVEMENTS; GBP/USD FX movements
// are excluded, so the output must NOT be presented as broker-settled GBP P&L.
// This engine never calls Alpaca or submits an order.
// Stops/targets are scored after MODELLED fees; no executable stop protection.
import {measureGoal} from './performance.mjs';

export const TRIAL_RULES=Object.freeze({
  version:'50GBP-3R-v1',startingBalanceGbp:50,riskFraction:0.01,rewardToRisk:3,
  stopFraction:0.02,cryptoFeeFractionPerSide:0.005,maxAllocationFraction:0.50,
  minimumVirtualNotionalGbp:1
});
const num=n=>typeof n==='number'&&Number.isFinite(n);
const round=n=>Number(n.toFixed(8));
const stamp=s=>{const n=Date.parse(s);if(!Number.isFinite(n))throw Error('Invalid timestamp');return n;};
const pairs=new Set(['BTC/USD','ETH/USD']);
export function initializeTrial(){
 return {version:TRIAL_RULES.version,currency:'GBP_VIRTUAL',startingBalanceGbp:50,
  balanceGbp:50,open:null,pending:null,closedTrades:[],lastBarBySymbol:{},status:'RESEARCH_ONLY'};
}
export function netRiskPlan({balanceGbp,entryPrice,feeRate=TRIAL_RULES.cryptoFeeFractionPerSide}){
 if(!num(balanceGbp)||balanceGbp<=0||!num(entryPrice)||entryPrice<=0||
    !num(feeRate)||feeRate<0||feeRate>=0.1)throw Error('Invalid virtual position inputs');
 const {riskFraction,rewardToRisk,stopFraction,maxAllocationFraction,minimumVirtualNotionalGbp}=TRIAL_RULES;
 // Includes entry + stop-exit fees. An exit below stop may exceed planned loss.
 const lossFraction=stopFraction+feeRate*(2-stopFraction);
 const riskBudget=balanceGbp*riskFraction;
 const notional=Math.min(balanceGbp*maxAllocationFraction,riskBudget/lossFraction);
 if(notional<minimumVirtualNotionalGbp)throw Error('Insufficient virtual balance for minimum position');
 // Target must yield 3x NET planned risk after entry+target-exit fees.
 const targetGainFraction=(rewardToRisk*lossFraction+2*feeRate)/(1-feeRate);
 const stopPrice=entryPrice*(1-stopFraction),targetPrice=entryPrice*(1+targetGainFraction);
 const plannedRiskGbp=notional*lossFraction;
 const plannedRewardGbp=notional*(targetGainFraction*(1-feeRate)-2*feeRate);
 if(Math.abs(plannedRewardGbp-3*plannedRiskGbp)>0.0000001)throw Error('3R accounting invariant violated');
 return {notionalGbp:round(notional),plannedRiskGbp:round(plannedRiskGbp),
  plannedRewardGbp:round(plannedRewardGbp),entryPrice,stopPrice:round(stopPrice),
  targetPrice:round(targetPrice),feeRate,riskBudgetGbp:round(riskBudget),
  plannedNetRR:round(plannedRewardGbp/plannedRiskGbp),
  assumptions:'GBP virtual, USD price ratios, FX movements omitted; 0.5% modeled fees per side; no broker execution'};
}
function validateBar(bar){
 if(!bar||!pairs.has(bar.symbol)||!num(bar.o)||!num(bar.h)||!num(bar.l)||!num(bar.c)||
 ![bar.o,bar.h,bar.l,bar.c].every(n=>n>0)||bar.h<Math.max(bar.o,bar.c,bar.l)||
 bar.l>Math.min(bar.o,bar.c,bar.h))throw Error('Invalid completed crypto OHLC bar');
 return stamp(bar.t);
}
export function queueSignal(state,{symbol,signalBarStart,candidateId}){
 if(state.version!==TRIAL_RULES.version)throw Error('Wrong trial version');
 if(!pairs.has(symbol)||!candidateId||!signalBarStart)throw Error('Invalid candidate evidence');
 const ts=stamp(signalBarStart);
 if(state.open||state.pending) return {state,result:'OCCUPIED'};
 if((state.lastBarBySymbol[symbol]??-Infinity)>ts)throw Error('Signal predates last processed bar');
 const pending={symbol,signalBarStart,signalMs:ts,candidateId};
 return {state:{...state,pending},result:'PENDING_NEXT_CANDLE'};
}
export function processBar(state,bar,{allowEntry=true}={}){
 if(state.version!==TRIAL_RULES.version)throw Error('Wrong trial version');
 const t=validateBar(bar), last=state.lastBarBySymbol[bar.symbol];
 if(last!==undefined&&t<=last)return {state,result:'DUPLICATE_OR_OUT_OF_ORDER'};
 const next={...state,lastBarBySymbol:{...state.lastBarBySymbol,[bar.symbol]:t},
  closedTrades:[...state.closedTrades]};
 // Never fill a missed/aged entry at a future price after a data outage.
 if(next.pending&&next.pending.symbol===bar.symbol&&t-next.pending.signalMs>2*900000){
   next.pending=null;return {state:next,result:'SIGNAL_EXPIRED'};
 }
 // Only previously queued signals may enter, NEVER after seeing current bar's movement.
 if(!next.open&&next.pending&&next.pending.symbol===bar.symbol&&t>next.pending.signalMs&&allowEntry){
   const plan=netRiskPlan({balanceGbp:next.balanceGbp,entryPrice:bar.o});
   next.open={symbol:bar.symbol,candidateId:next.pending.candidateId,
    entryBarStart:bar.t,enteredAtOpenPrice:bar.o,
    ...plan};
   next.pending=null;
 }
 if(!next.open||next.open.symbol!==bar.symbol)return {state:next,result:'NO_EXIT'};
 const pos=next.open;
 // If both prices are touched within one candle, STOP FIRST is mandatory (worst case).
 const stop=bar.o<=pos.stopPrice||bar.l<=pos.stopPrice;
 const win=bar.o>=pos.targetPrice||bar.h>=pos.targetPrice;
 if(!stop&&!win)return {state:next,result:'OPEN'};
 const outcome=stop?'STOP':'TAKE_PROFIT';
 const exit=outcome==='STOP'?Math.min(bar.o,pos.stopPrice):Math.max(bar.o,pos.targetPrice);
 const grossGbp=pos.notionalGbp*(exit/pos.enteredAtOpenPrice-1);
 const modeledFeesGbp=pos.notionalGbp*pos.feeRate*(1+exit/pos.enteredAtOpenPrice);
 const netGbp=round(grossGbp-modeledFeesGbp);
 const closed={id:pos.symbol.replace('/','')+':'+pos.entryBarStart+':'+bar.t,
  symbol:pos.symbol,cohort:pos.candidateId,closedAt:new Date(t+900000).toISOString(),
  openedAt:pos.entryBarStart,exitReason:outcome,bothBarriersTouched:stop&&win,
  netGbp,feeBasis:'MODELED_NOT_POSTED',
  evidence:'VIRTUAL_FORWARD_BAR_SIMULATION',virtualRiskGbp:pos.plannedRiskGbp,
  virtualRewardGbp:pos.plannedRewardGbp,actualRR:round(netGbp/pos.plannedRiskGbp)};
 next.balanceGbp=round(next.balanceGbp+netGbp);
 next.closedTrades.push(closed);next.open=null;
 next.status=next.balanceGbp>0?'RESEARCH_ONLY':'TRIAL_DEPLETED';
 return {state:next,result:outcome,closed};
}
export function trialReport(state){
 if(state.version!==TRIAL_RULES.version)throw Error('Wrong trial version');
 const {netUsd,expectancyUsd,...measurement}=measureGoal(state.closedTrades.map(t=>({...t,netUsd:t.netGbp})));
 return {startGbp:50,balanceGbp:state.balanceGbp,
  gainLossGbp:round(state.balanceGbp-50),open:state.open,pending:state.pending,
  netGbp:netUsd,expectancyGbp:expectancyUsd,...measurement,
  eligibleForRealMoney:false,brokerTradesSubmitted:0,
  note:'3R targets are NET of estimated costs; FX, spread variation, market slippage and gaps can change realized R/R. Results are virtual forward-bar observations, NOT actual Alpaca fills.'};
}
