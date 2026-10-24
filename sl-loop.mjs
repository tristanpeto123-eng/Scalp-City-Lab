/**
 * SL auto-learning cycle (research simulation only).
 * Fetching and scheduling occur in the UI. This pure reducer sees only completed
 * historical bars, freezes decisions at a signal candle's close, fills at the
 * next completed candle's OPEN (modeled, not actual execution), then labels and
 * retrains ONLY after a virtual position has closed.
 *
 * No paper/live brokerage, no implied continuous unattended service.
 */
import {createSLMemory,validateSLMemory,trainSL,predictSL,slMemoryStats} from './sl-core.mjs';
import {buildSLFiveMinuteDataset,validateSLFiveMinuteBars,slFiveMinuteSignal,SL_FIVE_MIN_MS} from './sl-5m.mjs';

export const SL_LOOP_SCHEMA='SL_5MIN_CAUSAL_LOOP_V1';
const iso=t=>new Date(t).toISOString();
const numeric=n=>typeof n==='number'&&Number.isFinite(n);
function configOf(o){
 const {market,symbol,holdCandles=3,sideCostBps=4,virtualNotionalGbp=1000}=o||{};
 if(!['COMMODITIES','FOREX','INDICES'].includes(market)||
  typeof symbol!=='string'||!/^[A-Z0-9._/-]{2,24}$/.test(symbol)||
  !Number.isInteger(holdCandles)||holdCandles<1||holdCandles>24||
  !numeric(sideCostBps)||sideCostBps<0||sideCostBps>100||
  !numeric(virtualNotionalGbp)||virtualNotionalGbp<50||virtualNotionalGbp>1000000)
  throw Error('Invalid SL loop market, symbol or virtual trading settings');
 return {market,symbol,holdCandles,sideCostBps,virtualNotionalGbp};
}
function sameBar(a,b){
 return !!a&&!!b&&['t','o','h','l','c','v'].every(k=>a[k]===b[k]);
}
function snapshot(bars,now){
 return validateSLFiveMinuteBars(bars,{now}).bars;
}
function logEvent(state,message){
 state.events=[{time:new Date().toISOString(),message},...state.events].slice(0,35);
}
function intentFor(bars,i,model,market){
 const signal=slFiveMinuteSignal(bars,i);
 if(!signal)return null;
 const p=predictSL(model,signal.entryFeatures,market);
 return {...signal,execute:p.researchDecision==='SELECT',score:p.profitWeightedScore};
}
function trainingWithStatus(memory){
 const t=trainSL(memory);
 return {model:t.model,score:t.report.heldOutResults,status:t.report.status};
}
function ensureLoop(state){
 if(!state||state.schema!==SL_LOOP_SCHEMA||!state.config||!state.cursor||
   !state.lastBar||!Array.isArray(state.events)||!state.memory)throw Error('Invalid SL loop checkpoint');
 const conf=configOf(state.config);
 const m=validateSLMemory(state.memory);
 if(m.market!==conf.market)throw Error('SL loop memory has a different market');
 return conf;
}
/** Seed only from pre-existing fully completed bars. The historical test is NOT forward proof. */
export function initializeSLLoop({bars,market,symbol,holdCandles=3,sideCostBps=4,
 virtualNotionalGbp=1000,now=Date.now()}={}){
 const config=configOf({market,symbol,holdCandles,sideCostBps,virtualNotionalGbp});
 const historical=buildSLFiveMinuteDataset({bars,...config,now});
 let memory=createSLMemory(market);
 // Limit expensive training/reviews while leaving checkpoint bounded.
 for(const x of historical.opportunities.slice(-1700)){
  const t=x.trade;
  if(t.netPnlGbp>0)memory.good.push(t);
  else memory.bad.push(t);
 }
 memory=validateSLMemory(memory);
 const trained=trainingWithStatus(memory);
 const lastBar=historical.bars.at(-1);
 const pending=intentFor(historical.bars,historical.bars.length-1,trained.model,market);
 const state={schema:SL_LOOP_SCHEMA,config,memory,cursor:lastBar.t,lastBar,
  pending,position:null,cycles:0,newCandles:0,closedCandidates:0,executedTrades:0,
  selectedNetPnlGbp:0,counterfactualCount:0,revisions:0,
  status:'BASELINE_TRAINED_WAITING_FOR_NEW_BARS',
  feed:'USER_OR_PROVIDER_REPORTED_UNVERIFIED',events:[]};
 logEvent(state,'Baseline: '+historical.bars.length+' completed 5m bars; trained on '+memory.good.length+' good and '+memory.bad.length+' bad historical candidates. No forward claims.');
 return {state,model:trained.model,stats:slMemoryStats(memory),newCandles:0,newClosed:0,
   result:'BASELINE_CAPTURE_NO_NEW_FORWARD_TRADES'};
}
function cloneState(st){
 return {...st,config:{...st.config},memory:validateSLMemory(st.memory),
  lastBar:{...st.lastBar},pending:st.pending?{...st.pending,entryFeatures:[...st.pending.entryFeatures]}:null,
  position:st.position?{...st.position,entryFeatures:[...st.position.entryFeatures]}:null,
  events:[...st.events]};
}
function processClosed(state,pos,b,model){
 const conf=state.config;
 const pnl=conf.virtualNotionalGbp*
   (pos.side*(b.o/pos.entryPrice-1)-2*conf.sideCostBps/10000);
 // Zero after cost has no binary label and must not be invented as either pile.
 if(Math.abs(pnl)>1e-10){
  const trade={id:'SLLOOP|'+conf.symbol+'|'+pos.entryAt+'|'+conf.holdCandles+'|'+conf.sideCostBps+'|'+conf.virtualNotionalGbp,
   market:conf.market,source:'HISTORICAL_RESEARCH',openedAt:pos.entryAt,
   closedAt:b.t,entryFeatures:[...pos.entryFeatures],netPnlGbp:pnl};
  if([...state.memory.good,...state.memory.bad].some(t=>t.id===trade.id))
   throw Error('SL loop duplicate completed virtual candidate');
  const pile=pnl>0?'good':'bad';
  state.memory[pile].push(trade);
  state.counterfactualCount++;
  // Training only observes a closed outcome, after the frozen decision.
  const trained=trainingWithStatus(state.memory);
  model=trained.model;state.revisions++;
 }
 state.closedCandidates++;
 if(pos.execute){
  state.executedTrades++;
  state.selectedNetPnlGbp=Math.round((state.selectedNetPnlGbp+pnl)*1000000)/1000000;
 }
 logEvent(state,(pos.execute?'SIM EXECUTED':'SIM SKIPPED')+
  ' '+(pnl>=0?'+':'')+pnl.toFixed(2)+' GBP virtual candidate at '+b.t+
  (pos.execute?' (included in selected P&L)':' (counterfactual; not account P&L)'));
 return model;
}
/**
 * Never produce another result from unchanged history.
 * Atomic: any revised overlapping candle or in-flight session gap rejects the
 * entire update before the caller persists it.
 */
export function advanceSLLoop(checkpoint,bars,{now=Date.now()}={}){
 const conf=ensureLoop(checkpoint);
 const all=snapshot(bars,now);
 const cursorIndex=all.findIndex(x=>x.t===checkpoint.cursor);
 if(cursorIndex<0)throw Error('SL loop source continuity lost: prior last candle missing. Do not restart on fabricated new history.');
 if(!sameBar(all[cursorIndex],checkpoint.lastBar))
  throw Error('SL loop source revised a previously observed completed candle; refusing silent retraining');
 if(cursorIndex===all.length-1)
  return {state:checkpoint,result:'UNCHANGED_NO_NEW_LEARNING',newCandles:0,newClosed:0,
    model:null,stats:slMemoryStats(checkpoint.memory)};
 const future=all.slice(cursorIndex+1);
 if(future.length>750)throw Error('SL loop missed over 750 candles. Restart with explicit baseline review.');
 const current=cloneState(checkpoint);
 let model=trainSL(current.memory).model;
 const begin=current.closedCandidates;
 for(let i=cursorIndex+1;i<all.length;i++){
  const candle=all[i],previous=all[i-1];
  const continuous=Date.parse(candle.t)-Date.parse(previous.t)===SL_FIVE_MIN_MS;
  if(!continuous){
   if(current.position)throw Error('SL loop open virtual position spans a market session gap. Paused; manual restart required.');
   if(current.pending){logEvent(current,'Discarded pending signal across a market session gap.');current.pending=null;}
  }
  if(current.position && Date.parse(candle.t)>=Date.parse(current.position.exitAt)){
   if(Date.parse(candle.t)!==Date.parse(current.position.exitAt))
    throw Error('SL loop missed expected virtual exit bar. Paused instead of inventing a fill.');
   model=processClosed(current,current.position,candle,model);
   current.position=null;
  }
  if(current.pending){
   if(candle.t!==current.pending.entryAt)
    throw Error('SL loop pending entry cannot execute without the next five-minute bar.');
   current.position={...current.pending,entryPrice:candle.o,
    exitAt:iso(Date.parse(candle.t)+conf.holdCandles*SL_FIVE_MIN_MS)};
   logEvent(current,(current.position.execute?'SIM ENTER':'SIM SKIP')+
      ' '+(current.position.side===1?'LONG':'SHORT')+
      ' at next bar open '+candle.t+'; frozen score '+current.position.score);
   current.pending=null;
  }
  // Even with an active opportunity, no new signals are generated until exit.
  if(!current.position&&!current.pending)
   current.pending=intentFor(all,i,model,conf.market);
  current.cursor=candle.t;current.lastBar={...candle};
  current.newCandles++;
 }
 current.cycles++;
 current.status='AWAITING_MORE_COMPLETED_BARS';
 return {state:current,result:'NEW_COMPLETED_BARS_PROCESSED',
  newCandles:future.length,newClosed:current.closedCandidates-begin,model,
  stats:slMemoryStats(current.memory)};
}
