// Validation Lab: user-configured START CAPITAL + (DURATION OR NET PROFIT).
// Genuine READ-ONLY historical chronological evaluation: calibrate candidates
// solely on the first 40%; FREEZE one model before revealing the later 60%.
// Reused/backtested dates are NOT independent evidence or proof of payouts.
import {createHash} from 'node:crypto';
import {initializeTrial,queueSignal,requestExit,processBar,trialReport,TRIAL_RULES} from './trial-profit.mjs';
import {optimizeProfit,validateProfit} from './learning-profit.mjs';
import {signalPolicy,explainSignalPolicy,normaliseStrategy,STRATEGY_GRID} from './signal-policies.mjs';
import {isResearchCrypto} from './crypto-research-marketset.mjs';

const INTERVAL=900000;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rounded=x=>Number(x.toFixed(4));
export function checkValidationInput(x){
 if(!x||!isResearchCrypto(x.symbol)||!['DURATION','PROFIT'].includes(x.mode)||
  !Number.isFinite(x.startingBalanceGbp)||x.startingBalanceGbp<50||x.startingBalanceGbp>1_000_000||
  !['us','us-1'].includes(x.feed??'us-1'))throw Error('Enter a supported USD pair, GBP50+ virtual balance and DURATION or PROFIT');
 if(x.mode==='DURATION'&&(!Number.isInteger(x.durationDays)||x.durationDays<1||x.durationDays>219))
  throw Error('Duration must be 1-219 days of unseen historical data');
 if(x.mode==='PROFIT'&&(!Number.isFinite(x.targetNetProfitGbp)||
    x.targetNetProfitGbp<=0||x.targetNetProfitGbp>10_000_000))
  throw Error('Profit target must be positive cumulative NET GBP');
 if(x.historyDays!==undefined&&(!Number.isInteger(x.historyDays)||x.historyDays<30||x.historyDays>365))
  throw Error('Historical data range must be 30-365 days');
 return {symbol:x.symbol,feed:x.feed??'us-1',mode:x.mode,
  startingBalanceGbp:x.startingBalanceGbp,
  durationDays:x.mode==='DURATION'?x.durationDays:null,
  targetNetProfitGbp:x.mode==='PROFIT'?x.targetNetProfitGbp:null,
  historyDays:x.historyDays??(x.mode==='DURATION'?Math.min(365,Math.max(90,Math.ceil(x.durationDays/.55))):180)};
}
const barTimestamp=b=>typeof b.t==='number'?b.t:Date.parse(b.t);
function parseBars(raw){
 if(!Array.isArray(raw)||raw.length<480)throw Error('Insufficient real candles (480 minimum)');
 const rows=raw.map(b=>({t:barTimestamp(b),o:Number(b.o),h:Number(b.h),l:Number(b.l),
  c:Number(b.c),v:Number(b.v)}));
 for(let i=0;i<rows.length;i++){
  const b=rows[i];
  if(!Number.isFinite(b.t)||![b.o,b.h,b.l,b.c,b.v].every(Number.isFinite)||
    Math.min(b.o,b.h,b.l,b.c)<=0||b.v<0||b.h<Math.max(b.o,b.c,b.l)||
    b.l>Math.min(b.o,b.c,b.h)||(i>0&&b.t<=rows[i-1].t))
    throw Error('Invalid/unsorted candle input');
 }
 return rows;
}
export function runHistoricalValidation({input,raw,candidates=STRATEGY_GRID,closedBefore=Infinity}){
 const config=checkValidationInput(input),bars=parseBars(raw);
 if(bars.at(-1).t+INTERVAL>closedBefore)throw Error('Candle is not finalized');
 const calibrationEnd=Math.floor(bars.length*.4);
 const calibration=bars.slice(0,calibrationEnd);
 const selected=optimizeProfit(calibration,candidates,config.symbol);
 const gate=validateProfit(calibration,selected,config.symbol);
 const p=normaliseStrategy(selected.candidate.params);
 const frozenId=hash([TRIAL_RULES.version,config.symbol,config.feed,p,
  calibration.at(-1).t]).slice(0,32);
 const policy=signalPolicy(p);
 for(const b of calibration)policy.observe(b);
 const evaluation=bars.slice(calibrationEnd);
 const evalStart=evaluation[0].t,availableDays=(evaluation.at(-1).t+INTERVAL-evalStart)/86400000;
 if(config.mode==='DURATION'&&config.durationDays>availableDays+1e-8)
  throw Error('Requested duration exceeds unseen historical evaluation window; increase historyDays');
 let state=initializeTrial(config.startingBalanceGbp);
 let peak=state.balanceGbp,maxDrawdownPct=0,processed=0,stopped='DATA_END';
 const target=config.targetNetProfitGbp;
 let seenUntil=evalStart;
 for(const bar of evaluation){
  if(config.mode==='DURATION' && bar.t>=evalStart+config.durationDays*86400000){
   stopped='DURATION_REACHED';break;
  }
  const asISO=new Date(bar.t).toISOString();
  const changed=processBar(state,{symbol:config.symbol,t:asISO,o:bar.o,h:bar.h,l:bar.l,c:bar.c});
  state=changed.state;processed++;seenUntil=bar.t+INTERVAL;
  if(changed.closed){
   peak=Math.max(peak,state.balanceGbp);
   maxDrawdownPct=Math.max(maxDrawdownPct,(peak-state.balanceGbp)/peak*100);
  }
  // Stop decisions only after REALIZED close, never intrabar unrealized mark.
  if(config.mode==='PROFIT'&&trialReport(state).netProfitGbp>=target){
   stopped='PROFIT_TARGET_REACHED';break;
  }
  const decision=policy.observe(bar);
  if(state.balanceGbp>=50&&!state.open&&!state.pending&&decision.ready&&decision.entry){
   state=queueSignal(state,{symbol:config.symbol,signalBarStart:asISO,candidateId:frozenId}).state;
  }else if(state.open&&decision.ready&&decision.exit){
   state=requestExit(state,{symbol:config.symbol,signalBarStart:asISO}).state;
  }
 }
 if(config.mode==='DURATION'&&stopped==='DATA_END')stopped='DURATION_REACHED';
 const report=trialReport(state);
 const reached=config.mode==='PROFIT'?report.netProfitGbp>=target:null;
 // Results may be diagnostic even when the earlier calibration REJECTED
 // the candidate; never promote or falsely call such a run validated.
 const validResearchCandidate=selected.trainingEligible&&gate.verdict==='AUDIT_PASS';
 return {
  mode:'HISTORICAL_VALIDATION_REPLAY',status:validResearchCandidate?'RESEARCH_EVALUATED':'DIAGNOSTIC_ONLY_REJECTED_CALIBRATION',
  symbol:config.symbol,feed:config.feed,
  startingBalanceGbp:config.startingBalanceGbp,
  rule:config.mode==='DURATION'?
   {kind:'DURATION',days:config.durationDays}:{kind:'PROFIT',cumulativeNetGbp:target},
  frozenStrategy:{id:frozenId,parameters:p,explanation:explainSignalPolicy(p),
   trainEligible:selected.trainingEligible,calibrationVerdict:gate.verdict,
   calibrationRejectReasons:gate.reasons,calibrationTrainingCandidates:selected.trainingOptions.length},
  calibrationEnd:new Date(calibration.at(-1).t+INTERVAL).toISOString(),
  unseenEvaluationStarted:new Date(evalStart).toISOString(),
  unseenEvaluationEnded:new Date(seenUntil).toISOString(),
  stopReason:stopped,goalReached:reached,
  candleCount:processed,
  availableUnseenDays:rounded(availableDays),
  daysSimulated:rounded((seenUntil-evalStart)/86400000),
  closedTrades:report.closedTrades,wins:report.wins,
  observedWinRatePct:report.winRatePct,wilson95LowerPct:report.wilson95LowerPct,
  observed80PctGoalMet:report.closedTrades>0&&report.winRatePct>=80,
  realisedCumulativeNetProfitGbp:report.netProfitGbp,
  virtualEndingBalanceGbp:report.balanceGbp,
  simulatedMaxDrawdownPct:rounded(maxDrawdownPct),
  openPositionExcludedFromRealizedProfit:Boolean(report.open),
  pendingSignalExcludedFromProfit:Boolean(report.pending),
  historicalDatasetHash:hash(bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v])),
  validationClaim:'Historical diagnostic only; repeated runs on viewed holdouts are exploratory, not independent forward validation.',
  actualPaperOrders:0,realMoneyOrders:0,withdrawableGbp:0,
  limitations:[
   'Simulated fills and fees, no guaranteed broker execution, no GBP/USD FX, order-book spreads or live slippage',
   'Unclosed positions are excluded from realized profit; account is NOT liquidated automatically at horizon end',
   'Retesting same historical period cannot count as fresh validation or train the frozen candidate',
   'The strategy may fail to reach a cumulative profit target by the end of available data'
  ]
 };
}
