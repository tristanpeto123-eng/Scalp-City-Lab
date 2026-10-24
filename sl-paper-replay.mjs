/**
 * Historical WALK-FORWARD internal paper-trade REPLAY, not forward paper trading.
 * Train on an older prefix only. After the cutoff, reveal past completed bars
 * sequentially, freeze decisions before seeing their exits, and learn after
 * simulated closes. This never sends orders to a broker.
 */
import {validateSLFiveMinuteBars} from './sl-5m.mjs';
import {initializeSLLoop,advanceSLLoop,SL_PAPER_POLICIES} from './sl-loop.mjs';

export const SL_REPLAY_VERSION='SL_WALK_FORWARD_PAPER_V1';
export function runSLHistoricalPaperReplay({
 bars,market,symbol,holdCandles=3,sideCostBps=4,virtualNotionalGbp=1000,
 executionPolicy='EXPLORE_ALL',now=Date.now()
}={}){
 if(!SL_PAPER_POLICIES.includes(executionPolicy))
  throw Error('Historical paper execution policy unsupported');
 const validated=validateSLFiveMinuteBars(bars,{now}).bars;
 if(validated.length<450)
  throw Error('Historical paper replay requires at least 450 recorded completed 5m candles to separate past training and replay.');
 const trainEnd=Math.floor(validated.length*.6);
 const options={market,symbol,holdCandles,sideCostBps,virtualNotionalGbp,executionPolicy,now};
 // IMPORTANT: no candle after trainEnd is supplied to initial training.
 const baseline=initializeSLLoop({bars:validated.slice(0,trainEnd),...options});
 let current=baseline.state;
 const splitAt=validated[trainEnd-1].t;
 for(let end=trainEnd+1;end<=validated.length;end+=500){
  const through=Math.min(validated.length,end+499);
  current=advanceSLLoop(current,validated.slice(0,through),{now}).state;
 }
 if(current.cursor!==validated.at(-1).t)
  throw Error('Historical paper replay did not cover all recorded candles');
 const orders=current.paperOrders||[];
 const modelOrders=orders.filter(o=>o.selection==='MODEL');
 const exploreOrders=orders.filter(o=>o.selection==='EXPLORATION');
 return {
  schema:SL_REPLAY_VERSION,mode:'HISTORICAL_RESEARCH_REPLAY',
  trainLastBar:splitAt,replayFirstBar:validated[trainEnd].t,replayLastBar:validated.at(-1).t,
  trainingBars:trainEnd,replayedBars:validated.length-trainEnd,executionPolicy,
  state:{...current,status:'HISTORICAL_REPLAY_NOT_FORWARD_PAPER',
   historicalReplay:true,baselineCutoff:splitAt},
  summary:{
   ordersOpened:orders.length,ordersClosed:orders.filter(o=>o.status==='CLOSED').length,
   ordersCancelled:orders.filter(o=>o.status==='CANCELLED').length,
   modelSelected:modelOrders.filter(o=>o.status==='CLOSED').length,
   exploratory:exploreOrders.filter(o=>o.status==='CLOSED').length,
   modelSelectedNetGbp:current.selectedNetPnlGbp,
   allPaperNetGbp:current.paperNetPnlGbp,
   modelSkipped:current.paperSkipped??0
  },
  disclaimer:'Historical virtual research trades at next-bar opening prices and modeled costs; not broker paper/live orders, actual fills, forward performance or real GBP profit.'
 };
}
