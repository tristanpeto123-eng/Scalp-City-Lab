/**
 * Research-only SL virtual paper trading dashboard.
 * The historical walk-forward replay is separate from the forward loop.
 * It never sends a brokerage order, routes money, or invents market candles.
 */
import {runSLHistoricalPaperReplay,SL_REPLAY_VERSION} from './sl-paper-replay.mjs?slboot=20261024r3';
import {loadSLChartCache} from './sl-chart-cache.mjs?slboot=20261024r3';
const $=id=>document.getElementById(id);
const money=n=>(n>=0?'+':'−')+'£'+Math.abs(n).toFixed(2);
const key=conf=>'scalp-city-lab:sl:historical-paper:v1:'+[
 conf.market,conf.symbol,conf.holdCandles,conf.sideCostBps,conf.virtualNotionalGbp
].join(':');
function ledger(id,orders){
 const tbody=$(id);
 if(!tbody)return;
 tbody.replaceChildren();
 if(!Array.isArray(orders)||!orders.length){
  const tr=document.createElement('tr'),cell=document.createElement('td');
  cell.colSpan=7;cell.textContent='No executed virtual paper orders in this view';
  tr.append(cell);tbody.append(tr);return;
 }
 for(const o of orders.slice(-60).reverse()){
  const tr=document.createElement('tr');
  const fields=[o.entryAt,o.side,o.selection||'MODEL',
   Number(o.entryPrice).toFixed(4),
   Number.isFinite(o.exitPrice)?Number(o.exitPrice).toFixed(4):'—',
   o.status,o.status==='CLOSED'?money(o.netPnlGbp):'—'];
  fields.forEach((value,index)=>{
   const td=document.createElement('td');td.textContent=value;
   if(index===6&&o.status==='CLOSED')td.className=o.netPnlGbp>=0?'paper-profit':'paper-loss';
   tr.append(td);
  });
  tbody.append(tr);
 }
}
export function renderSLPaperLive(state){
 if(!$('livePaperStatus'))return;
 const orders=state?.paperOrders||[];
 const closed=orders.filter(o=>o.status==='CLOSED').length;
 const open=orders.filter(o=>o.status==='OPEN').length;
 $('livePaperStatus').textContent=state?
  closed+' executed and closed virtual orders · '+open+' open · '+
  (state.paperSkipped||0)+' rejected candidates · '+
  (state.paperCancelled||0)+' cancelled market-gap orders. '+
  (!orders.length?'No new 5m bars traded since the initial training baseline.':'Model-selected net '+money(state.selectedNetPnlGbp||0)+'.') :
  'No saved forward SL loop checkpoint. Initial CSV training does not place orders.';
 ledger('livePaperRows',orders);
}
function readHistory(conf){
 const raw=localStorage.getItem(key(conf));
 if(!raw)return null;
 const r=JSON.parse(raw);
 if(r.schema!==SL_REPLAY_VERSION||r.state?.config?.market!==conf.market||
  r.state?.config?.symbol!==conf.symbol||
  r.state?.config?.holdCandles!==conf.holdCandles||
  r.state?.config?.sideCostBps!==conf.sideCostBps||
  r.state?.config?.virtualNotionalGbp!==conf.virtualNotionalGbp)
  throw Error('The saved paper journal belongs to another market or settings');
 return r;
}
function showHistory(replay){
 $('paperClosed').textContent=replay?.summary?.ordersClosed??0;
 $('paperSelected').textContent=replay?.summary?.modelSelected??0;
 $('paperExplore').textContent=replay?.summary?.exploratory??0;
 $('paperNet').textContent=money(replay?.summary?.allPaperNetGbp||0);
 ledger('paperRows',replay?.state?.paperOrders);
 $('paperStatus').textContent=replay?
  'HISTORICAL SIMULATION · '+replay.trainingBars+' training candles, '+
  replay.replayedBars+' later replay candles · '+replay.summary.ordersClosed+
  ' virtual order closes ('+replay.summary.modelSelected+' SL-selected, '+
  replay.summary.exploratory+' exploration); '+replay.summary.modelSkipped+
  ' skipped; '+replay.summary.ordersCancelled+' gap cancellations. Modelled net '+
  money(replay.summary.allPaperNetGbp)+
  '. These are NOT broker/paper account fills or forward profit.' :
  'No historical paper replay saved for this market/settings.';
}
export function initSLPaperUI({getConfig,isLoopBusy,getLoop}){
 if(typeof getConfig!=='function'||typeof isLoopBusy!=='function')
  throw Error('SL paper UI missing read-only configuration accessors');
 const restore=()=>{
  try{showHistory(readHistory(getConfig()))}
  catch(err){showHistory(null);$('paperStatus').textContent='Paper journal restore error: '+err.message;}
  renderSLPaperLive(getLoop?.());
 };
 $('paperReplay').addEventListener('click',async()=>{
  if(isLoopBusy()){
   $('paperStatus').textContent='Pause the forward SL loop before starting offline historical paper replay.';
   return;
  }
  $('paperReplay').disabled=true;
  $('paperStatus').textContent='Running historical next-open paper fills and feedback learning…';
  await new Promise(resolve=>setTimeout(resolve,25));
  try{
   const conf=getConfig();
   const source=await loadSLChartCache({market:conf.market,symbol:conf.symbol});
   if(!source)throw Error('Import at least 450 genuine recorded 5-minute candles first. No demo bars will be substituted.');
   const result=runSLHistoricalPaperReplay({...conf,bars:source.bars,
    executionPolicy:$('paperPolicy').value});
   // Keep replay state and P&L away from live loop's neural checkpoint.
   const serialized=JSON.stringify(result);
   localStorage.setItem(key(conf),serialized);
   if(localStorage.getItem(key(conf))!==serialized)
    throw Error('Could not verify saved historical paper order ledger');
   showHistory(result);
  }catch(err){$('paperStatus').textContent='Historical paper replay blocked: '+err.message;}
  finally{$('paperReplay').disabled=false;}
 });
 $('paperExport').addEventListener('click',()=>{
  try{
   const r=readHistory(getConfig());if(!r)throw Error('Run a historical paper replay first');
   const exportData={
    schema:r.schema,mode:r.mode,market:r.state.config.market,
    symbol:r.state.config.symbol,trainingBars:r.trainingBars,replayedBars:r.replayedBars,
    trainingCutoff:r.trainLastBar,summary:r.summary,
    orders:r.state.paperOrders,disclaimer:r.disclaimer
   };
   const url=URL.createObjectURL(new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;
   a.download='sl-historical-virtual-paper-'+r.state.config.symbol+'.json';
   a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(err){$('paperStatus').textContent=err.message;}
 });
 $('market').addEventListener('change',restore);
 for(const id of ['fiveSymbol','fiveHold','fiveCost','fiveNotional'])
  $(id).addEventListener('change',restore);
 restore();
}
