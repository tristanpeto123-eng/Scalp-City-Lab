// Scalp City £50 -> £2,050 VIRTUAL balance objective (£2,000 NET profit).
// No mandatory reward/risk ratio. Long-only EMA trend exits at the NEXT candle
// open after a completed bearish EMA signal, or at a 2% protective SIMULATED stop.
// It is NOT a real broker protective stop or guarantee of fills.
import {measureGoal} from './performance.mjs';
import {isResearchCrypto} from './crypto-research-marketset.mjs';

export const TRIAL_RULES=Object.freeze({
 version:'GBP50-PROFIT2000-v2',startingBalanceGbp:50,targetNetProfitGbp:2000,
 targetBalanceGbp:2050,riskFraction:0.01,stopFraction:0.02,
 cryptoFeeFractionPerSide:0.005,equityFeeFractionPerSide:0.001,
 maxAllocationFraction:0.50,minimumVirtualNotionalGbp:1
});
const VALID=new Set(['SPY','QQQ','IWM']);
const scalar=n=>typeof n==='number'&&Number.isFinite(n);
const round=n=>Number(n.toFixed(8));
const timestamp=s=>{const t=Date.parse(s);if(!Number.isFinite(t))throw Error('Invalid timestamp');return t;};
const feeFor=sym=>isResearchCrypto(sym)?TRIAL_RULES.cryptoFeeFractionPerSide:TRIAL_RULES.equityFeeFractionPerSide;

export function initializeTrial(depositGbp=TRIAL_RULES.startingBalanceGbp){
 if(!scalar(depositGbp)||depositGbp<50||depositGbp>1_000_000)
   throw Error('Virtual initial deposit must be £50–£1,000,000');
 return {version:TRIAL_RULES.version,currency:'GBP_VIRTUAL',startingBalanceGbp:depositGbp,
  balanceGbp:depositGbp,open:null,pending:null,closedTrades:[],lastBarBySymbol:{},status:'RESEARCH_ONLY'};
}
export function netRiskPlan({balanceGbp,entryPrice,feeRate=TRIAL_RULES.cryptoFeeFractionPerSide}){
 if(!scalar(balanceGbp)||balanceGbp<=0||!scalar(entryPrice)||entryPrice<=0||
    !scalar(feeRate)||feeRate<0||feeRate>=0.1)throw Error('Invalid position inputs');
 const lossFraction=TRIAL_RULES.stopFraction+feeRate*(2-TRIAL_RULES.stopFraction);
 const notionalGbp=Math.min(balanceGbp*TRIAL_RULES.maxAllocationFraction,
   balanceGbp*TRIAL_RULES.riskFraction/lossFraction);
 if(notionalGbp<TRIAL_RULES.minimumVirtualNotionalGbp)throw Error('Insufficient virtual balance');
 return {entryPrice,stopPrice:round(entryPrice*(1-TRIAL_RULES.stopFraction)),
  notionalGbp:round(notionalGbp),plannedRiskGbp:round(notionalGbp*lossFraction),
  feeRate,stopFraction:TRIAL_RULES.stopFraction,exitPolicy:'NEXT_OPEN_BEARISH_EMA_OR_STOP',
  targetPrice:null,requiredRewardRisk:null};
}
function assertBar(b){
 if(!b||(!VALID.has(b.symbol)&&!isResearchCrypto(b.symbol))||![b.o,b.h,b.l,b.c].every(scalar)||
 Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.l,b.c)||
 b.l>Math.min(b.o,b.h,b.c))throw Error('Invalid completed OHLC');
 return timestamp(b.t);
}
function assertState(state){if(state?.version!==TRIAL_RULES.version)throw Error('Wrong virtual ledger version');}
export function queueSignal(state,{symbol,signalBarStart,candidateId}){
 assertState(state);
 if((!VALID.has(symbol)&&!isResearchCrypto(symbol))||!candidateId||!signalBarStart)throw Error('Invalid signal');
 const t=timestamp(signalBarStart);
 if(state.open||state.pending)return {state,result:'OCCUPIED'};
 if((state.lastBarBySymbol[symbol]??-Infinity)>t)throw Error('Signal older than processed bar');
 return {state:{...state,pending:{symbol,signalBarStart,signalMs:t,candidateId}},result:'PENDING_NEXT_CANDLE'};
}
export function requestExit(state,{symbol,signalBarStart}){
 assertState(state);
 const t=timestamp(signalBarStart);
 if(!state.open||state.open.symbol!==symbol||state.open.exitAfterSignalMs!==undefined)
   return {state,result:'NO_ELIGIBLE_OPEN'};
 if((state.lastBarBySymbol[symbol]??-Infinity)>t)throw Error('Exit signal predates last processed bar');
 return {state:{...state,open:{...state.open,exitAfterSignalMs:t}},result:'EXIT_NEXT_OPEN'};
}
function close(next,bar,exitPrice,exitReason){
 const pos=next.open;
 const beforeFees=pos.notionalGbp*(exitPrice/pos.entryPrice-1);
 const fees=pos.notionalGbp*pos.feeRate*(1+exitPrice/pos.entryPrice);
 const netGbp=round(beforeFees-fees);
 const trade={id:pos.symbol.replace('/','')+':'+pos.entryBarStart+':'+bar.t,
  symbol:pos.symbol,candidateId:pos.candidateId,cohort:TRIAL_RULES.version+':'+pos.candidateId,
  openedAt:pos.entryBarStart,closedAt:new Date(timestamp(bar.t)+900000).toISOString(),
  entryPrice:pos.entryPrice,exitPrice,notionalGbp:pos.notionalGbp,feeRate:pos.feeRate,
  plannedRiskGbp:pos.plannedRiskGbp,exitReason,
  netGbp,feeBasis:'MODELED_NOT_POSTED',evidence:'VIRTUAL_CANDLE_REPLAY'};
 next.balanceGbp=round(next.balanceGbp+netGbp);
 next.closedTrades.push(trade);next.open=null;
 next.status=next.balanceGbp<=0?'TRIAL_DEPLETED':
   next.balanceGbp>=next.startingBalanceGbp+TRIAL_RULES.targetNetProfitGbp?'VIRTUAL_TARGET_REACHED':'RESEARCH_ONLY';
 return {state:next,result:exitReason,closed:trade};
}
export function processBar(state,bar,{allowEntry=true,feeMultiplier=1}={}){
 assertState(state);
 if(!scalar(feeMultiplier)||feeMultiplier<1||feeMultiplier>3)throw Error('Invalid fee stress');
 const t=assertBar(bar),old=state.lastBarBySymbol[bar.symbol];
 if(old!==undefined&&t<=old)return {state,result:'DUPLICATE_OR_OUT_OF_ORDER'};
 const next={...state,closedTrades:[...state.closedTrades],
   lastBarBySymbol:{...state.lastBarBySymbol,[bar.symbol]:t}};
 if(next.pending?.symbol===bar.symbol && t-next.pending.signalMs>2*900000){
   next.pending=null;
   if(!next.open)return {state:next,result:'SIGNAL_EXPIRED'};
 }
 if(!next.open&&next.pending?.symbol===bar.symbol&&t>next.pending.signalMs&&allowEntry){
   const plan=netRiskPlan({balanceGbp:next.balanceGbp,entryPrice:bar.o,
     feeRate:feeFor(bar.symbol)*feeMultiplier});
   next.open={...plan,symbol:bar.symbol,candidateId:next.pending.candidateId,entryBarStart:bar.t};
   next.pending=null;
 }
 if(!next.open||next.open.symbol!==bar.symbol)return {state:next,result:'NO_EXIT'};
 const pos=next.open;
 // Stop priority on an ambiguous bar; gaps cannot be filled optimistically.
 if(bar.o<=pos.stopPrice)return close(next,bar,bar.o,'STOP_GAP');
 // Previously finalized bearish signal authorizes an OPEN exit before
 // examining this new candle's intra-bar high/low.
 if(pos.exitAfterSignalMs!==undefined&&t>pos.exitAfterSignalMs)
   return close(next,bar,bar.o,'BEARISH_SIGNAL_NEXT_OPEN');
 if(bar.l<=pos.stopPrice)return close(next,bar,pos.stopPrice,'STOP');
 return {state:next,result:'OPEN'};
}
export function trialReport(state){
 assertState(state);
 // Count only realized NET outcomes of CLOSED virtual entry-to-exit trades.
 // Never score a hypothetical balance change, open mark-to-market gain, signal
 // or single-trade target as accumulated profit.
 const closedProfitGbp=round(state.closedTrades.reduce((sum,t)=>{
   if(!scalar(t?.netGbp))throw Error('Invalid closed-trade GBP profit');
   return sum+t.netGbp;
 },0));
 if(!scalar(state.startingBalanceGbp)||state.startingBalanceGbp<50)throw Error('Invalid initial deposit ledger');
 const expectedBalance=round(state.startingBalanceGbp+closedProfitGbp);
 const allowableRoundingError=Math.max(1e-6,state.closedTrades.length*1e-7);
 if(!scalar(state.balanceGbp)||Math.abs(state.balanceGbp-expectedBalance)>allowableRoundingError)
   throw Error('Virtual account balance does not reconcile to cumulative closed trades');
 const {netUsd,expectancyUsd,maxDrawdownUsd,...metrics}=measureGoal(
   state.closedTrades.map(t=>({...t,netUsd:t.netGbp})));
 const profit=closedProfitGbp,remaining=round(Math.max(0,TRIAL_RULES.targetNetProfitGbp-profit));
 return {startGbp:state.startingBalanceGbp,balanceGbp:state.balanceGbp,
  netProfitGbp:profit,realizedClosedTradeProfitGbp:profit,
  profitAggregation:'SUM_OF_ALL_NET_CLOSED_TRADES',profitTargetGbp:TRIAL_RULES.targetNetProfitGbp,targetBalanceGbp:round(state.startingBalanceGbp+TRIAL_RULES.targetNetProfitGbp),
  remainingProfitGbp:remaining,profitProgressPct:round(Math.max(0,profit)/TRIAL_RULES.targetNetProfitGbp*100),
  targetReached:profit>=TRIAL_RULES.targetNetProfitGbp,closedTrades:metrics.closedTrades,
  ...Object.fromEntries(Object.entries(metrics).filter(([k])=>k!=='closedTrades')),
  expectancyGbp:expectancyUsd,netGbp:netUsd,maxDrawdownGbp:maxDrawdownUsd,
  winRateSampleTarget:null,winRateGoalPct:80,tradeLimit:null,mandatoryRewardRisk:null,
  open:state.open,pending:state.pending,eligibleForRealMoney:false,
  brokerTradesSubmitted:0,disclaimer:'GBP virtual historical/research P&L; models fees, omits actual FX/slippage, never broker-settled or guaranteed.'};
}
