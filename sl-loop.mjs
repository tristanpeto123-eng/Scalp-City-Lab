/**
 * SL auto-learning cycle (research simulation only).
 * Fetching and scheduling occur in the UI. This pure reducer sees only completed
 * historical bars, freezes decisions at a signal candle's close, fills at the
 * next completed candle's OPEN (modeled, not actual execution), then labels and
 * retrains ONLY after a virtual position has closed.
 *
 * No paper/live brokerage, no implied continuous unattended service.
 */
import {createSLMemory,validateSLMemory,trainSL,predictSL,slMemoryStats,updateSLModelAfterClose} from './sl-core.mjs?slboot=20261024r3';
import {buildSLFiveMinuteDataset,validateSLFiveMinuteBars,slFiveMinuteSignal,SL_FIVE_MIN_MS} from './sl-5m.mjs?slboot=20261024r3';

export const SL_LOOP_SCHEMA='SL_5MIN_CAUSAL_LOOP_V1';
export const SL_PAPER_ORDER_LIMIT=1500;
export const SL_PAPER_POLICIES=Object.freeze(['SL_SELECTED','EXPLORE_ALL']);
const iso=t=>new Date(t).toISOString();
const numeric=n=>typeof n==='number'&&Number.isFinite(n);
function configOf(o){
 const {market,symbol,holdCandles=3,sideCostBps=4,virtualNotionalGbp=1000,executionPolicy='SL_SELECTED'}=o||{};
 if(!['COMMODITIES','FOREX','INDICES'].includes(market)||
  typeof symbol!=='string'||!/^[A-Z0-9._/-]{2,24}$/.test(symbol)||
  !Number.isInteger(holdCandles)||holdCandles<1||holdCandles>24||
  !numeric(sideCostBps)||sideCostBps<0||sideCostBps>100||
  !numeric(virtualNotionalGbp)||virtualNotionalGbp<50||virtualNotionalGbp>1000000||
  !SL_PAPER_POLICIES.includes(executionPolicy))
  throw Error('Invalid SL loop market, symbol or virtual trading settings');
 // Do not add a default-only field to legacy live-loop checkpoints: the UI
 // compares the saved config to existing field-only settings.
 return {market,symbol,holdCandles,sideCostBps,virtualNotionalGbp,
  ...(executionPolicy==='EXPLORE_ALL'?{executionPolicy}: {})};
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
function intentFor(bars,i,model,market,policy='SL_SELECTED'){
 const signal=slFiveMinuteSignal(bars,i);
 if(!signal)return null;
 const p=predictSL(model,signal.entryFeatures,market);
 const selected=p.researchDecision==='SELECT';
 const reason=selected?'MODEL':policy==='EXPLORE_ALL'?'EXPLORATION':'REJECTED';
 return {...signal,selectedByModel:selected,execute:reason!=='REJECTED',
  executionReason:reason,score:p.profitWeightedScore,threshold:model.threshold};
}
function trainingWithStatus(memory){
 const t=trainSL(memory);
 return {model:t.model,score:t.report.heldOutResults,status:t.report.status};
}
function ensureLoop(state){
 if(!state||state.schema!==SL_LOOP_SCHEMA||!state.config||!state.cursor||
   !state.lastBar||!Array.isArray(state.tail)||state.tail.length<25||
   !Array.isArray(state.events)||!state.memory)throw Error('Invalid SL loop checkpoint');
 if(state.paperOrders!==undefined&&(!Array.isArray(state.paperOrders)||
    state.paperOrders.length>SL_PAPER_ORDER_LIMIT))
  throw Error('Invalid paper trade ledger');
 const conf=configOf(state.config);
 const m=validateSLMemory(state.memory);
 if(m.market!==conf.market)throw Error('SL loop memory has a different market');
 if(state.model?.strategy!=='SL'||state.model?.market!==conf.market||
    state.model?.activatedForTrading!==false)throw Error('SL loop model/checkpoint mismatch');
 return conf;
}
/** Seed only from pre-existing fully completed bars. The historical test is NOT forward proof. */
export function initializeSLLoop({bars,market,symbol,holdCandles=3,sideCostBps=4,
 virtualNotionalGbp=1000,executionPolicy='SL_SELECTED',now=Date.now()}={}){
 const config=configOf({market,symbol,holdCandles,sideCostBps,virtualNotionalGbp,executionPolicy});
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
 const magnitudes=[...memory.good,...memory.bad].map(t=>Math.abs(t.netPnlGbp)).sort((a,b)=>a-b);
 const referenceGbp=magnitudes[Math.floor(magnitudes.length/2)]||5;
 const lastBar=historical.bars.at(-1);
 const pending=intentFor(historical.bars,historical.bars.length-1,trained.model,market,executionPolicy);
 const state={schema:SL_LOOP_SCHEMA,config,memory,model:trained.model,referenceGbp,cursor:lastBar.t,lastBar,
  pending,position:null,tail:historical.bars.slice(-28).map(b=>({...b})),
  cycles:0,newCandles:0,closedCandidates:0,executedTrades:0,
  selectedNetPnlGbp:0,paperNetPnlGbp:0,counterfactualCount:0,revisions:0,
  paperOrders:[],paperSkipped:0,paperCancelled:0,
  status:'BASELINE_TRAINED_WAITING_FOR_NEW_BARS',
  feed:'USER_OR_PROVIDER_REPORTED_UNVERIFIED',events:[]};
 logEvent(state,'Baseline: '+historical.bars.length+' completed 5m bars; trained on '+memory.good.length+' good and '+memory.bad.length+' bad historical candidates. No forward claims.');
 return {state,model:trained.model,stats:slMemoryStats(memory),newCandles:0,newClosed:0,
   result:'BASELINE_CAPTURE_NO_NEW_FORWARD_TRADES'};
}
function cloneState(st){
 return {...st,config:{...st.config},memory:validateSLMemory(st.memory),
  model:{...st.model,weights:{w1:st.model.weights.w1.map(r=>[...r]),
    w2:[...st.model.weights.w2],b1:[...st.model.weights.b1],b2:st.model.weights.b2}},
  lastBar:{...st.lastBar},tail:st.tail.map(b=>({...b})),pending:st.pending?{...st.pending,entryFeatures:[...st.pending.entryFeatures]}:null,
  position:st.position?{...st.position,entryFeatures:[...st.position.entryFeatures]}:null,
  paperOrders:(st.paperOrders||[]).map(o=>({...o})),
  paperNetPnlGbp:st.paperNetPnlGbp??st.selectedNetPnlGbp,
  paperSkipped:st.paperSkipped??0,paperCancelled:st.paperCancelled??0,
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
  // Incremental update consumes THIS closed outcome immediately, never a future bar.
  model=updateSLModelAfterClose(model,trade,{referenceGbp:state.referenceGbp});
  state.model=model;state.revisions++;
 }
 state.closedCandidates++;
 if(pos.execute){
  state.executedTrades++;
  state.paperNetPnlGbp=Math.round((state.paperNetPnlGbp+pnl)*1000000)/1000000;
  if(pos.executionReason!=='EXPLORATION')
   state.selectedNetPnlGbp=Math.round((state.selectedNetPnlGbp+pnl)*1000000)/1000000;
  const order=(state.paperOrders||[]).find(o=>o.id===pos.paperOrderId&&o.status==='OPEN');
  if(!order)throw Error('Virtual paper order went missing before exit; stopping without fabricated P&L');
  order.status='CLOSED';
  order.exitPrice=b.o;order.exitedAt=b.t;
  order.grossGbp=conf.virtualNotionalGbp*pos.side*(b.o/pos.entryPrice-1);
  order.costGbp=conf.virtualNotionalGbp*2*conf.sideCostBps/10000;
  order.netPnlGbp=pnl;
 }else state.paperSkipped=(state.paperSkipped||0)+1;
 logEvent(state,(pos.execute?'PAPER CLOSED':'SIM SKIPPED')+
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
 const byTime=new Map(all.map(b=>[b.t,b]));
 for(const old of checkpoint.tail){
  const current=byTime.get(old.t);
  if(!current||!sameBar(old,current))
   throw Error('SL loop source revised or lost an overlapping completed candle; refusing silent retraining');
 }
 if(cursorIndex===all.length-1)
  return {state:checkpoint,result:'UNCHANGED_NO_NEW_LEARNING',newCandles:0,newClosed:0,
    model:null,stats:slMemoryStats(checkpoint.memory)};
 const future=all.slice(cursorIndex+1);
 if(future.length>750)throw Error('SL loop missed over 750 candles. Restart with explicit baseline review.');
 const current=cloneState(checkpoint);
 let model=current.model;
 const begin=current.closedCandidates;
 for(let i=cursorIndex+1;i<all.length;i++){
  const candle=all[i],previous=all[i-1];
  const continuous=Date.parse(candle.t)-Date.parse(previous.t)===SL_FIVE_MIN_MS;
  if(!continuous){
   if(current.position){
    // There is no defensible next-open fill across a session closure. Cancel
    // the unresolved virtual position and do NOT create fake P&L or a label.
    if(current.position.execute){
     const order=(current.paperOrders||[]).find(o=>o.id===current.position.paperOrderId&&o.status==='OPEN');
     if(order){order.status='CANCELLED';order.reason='MARKET_GAP_NO_EXIT_FILL';current.paperCancelled++;}
    }
    logEvent(current,'Session gap: virtual position cancelled (no invented exit price or training label).');
    current.position=null;
   }
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
   if(current.position.execute){
    const id='PAPER|'+conf.symbol+'|'+candle.t;
    if((current.paperOrders||[]).some(o=>o.id===id))throw Error('Duplicate paper order');
    current.position.paperOrderId=id;
    current.paperOrders.push({
     id,market:conf.market,symbol:conf.symbol,side:current.position.side===1?'LONG':'SHORT',
     selection:current.position.executionReason||'MODEL',
     score:current.position.score,threshold:current.position.threshold,
     signalTime:current.position.signalTime,entryAt:candle.t,entryPrice:candle.o,
     plannedExitAt:current.position.exitAt,status:'OPEN',notionalGbp:conf.virtualNotionalGbp,
     costBpsPerSide:conf.sideCostBps
    });
    if(current.paperOrders.length>SL_PAPER_ORDER_LIMIT)current.paperOrders.shift();
   }
   logEvent(current,(current.position.execute?'PAPER OPEN':'SIM SKIP')+
      ' '+(current.position.side===1?'LONG':'SHORT')+
      ' at next bar open '+candle.t+'; frozen score '+current.position.score);
   current.pending=null;
  }
  // Even with an active opportunity, no new signals are generated until exit.
  if(!current.position&&!current.pending)
   current.pending=intentFor(all,i,model,conf.market,conf.executionPolicy);
  current.cursor=candle.t;current.lastBar={...candle};
  current.tail=all.slice(Math.max(0,i-27),i+1).map(b=>({...b}));
  current.newCandles++;
 }
 current.cycles++;
 current.status='AWAITING_MORE_COMPLETED_BARS';
 return {state:current,result:'NEW_COMPLETED_BARS_PROCESSED',
  newCandles:future.length,newClosed:current.closedCandidates-begin,model,
  stats:slMemoryStats(current.memory)};
}
