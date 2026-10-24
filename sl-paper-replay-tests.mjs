import assert from 'node:assert/strict';
import {initializeSLLoop,advanceSLLoop,SL_PAPER_ORDER_LIMIT} from './sl-loop.mjs';
import {runSLHistoricalPaperReplay} from './sl-paper-replay.mjs';

const STEP=300000,now=Date.parse('2026-03-01T00:00:00Z');
const start=Date.parse('2026-02-10T00:00:00Z');
const bars=Array.from({length:900},(_,i)=>{
 const o=2900+Math.sin(i*.19)*20+Math.cos(i*.029)*5;
 const c=o+Math.sin(i*.37);
 return {t:new Date(start+i*STEP).toISOString(),o,c,
  h:Math.max(o,c)+.3,l:Math.min(o,c)-.3,v:100+i%21};
});
const config={market:'COMMODITIES',symbol:'XAUUSD',holdCandles:3,
 sideCostBps:4,virtualNotionalGbp:1000};
const exploration=runSLHistoricalPaperReplay({bars,...config,executionPolicy:'EXPLORE_ALL',now});
assert.equal(exploration.mode,'HISTORICAL_RESEARCH_REPLAY');
assert.equal(exploration.executionPolicy,'EXPLORE_ALL');
assert.equal(exploration.replayFirstBar,bars[540].t);
assert.equal(exploration.trainLastBar,bars[539].t);
assert.equal(exploration.trainingBars,540);
assert.equal(exploration.replayedBars,360);
assert.equal(exploration.state.cursor,bars.at(-1).t);
assert.equal(exploration.state.historicalReplay,true);
assert.ok(exploration.summary.ordersOpened>10,'all-candidate exploration should generate paper orders');
assert.equal(exploration.summary.ordersOpened,exploration.state.paperOrders.length);
assert.ok(exploration.state.paperOrders.every(o=>o.id.startsWith('PAPER|XAUUSD|')));
const closes=exploration.state.paperOrders.filter(o=>o.status==='CLOSED');
assert.ok(closes.length>10);
assert.equal(exploration.summary.ordersClosed,closes.length);
for(const o of closes){
 assert.equal(o.market,'COMMODITIES');
 assert.ok(['LONG','SHORT'].includes(o.side));
 assert.ok(['MODEL','EXPLORATION'].includes(o.selection));
 assert.ok(o.entryPrice>0&&o.exitPrice>0);
 assert.equal(o.costGbp,config.virtualNotionalGbp*2*config.sideCostBps/10000);
 const sign=o.side==='LONG'?1:-1;
 const expected=config.virtualNotionalGbp*(sign*(o.exitPrice/o.entryPrice-1)-.0008);
 assert.ok(Math.abs(expected-o.netPnlGbp)<1e-7);
 assert.equal(Date.parse(o.exitedAt)-Date.parse(o.entryAt),3*STEP);
 assert.ok(Date.parse(o.entryAt)>Date.parse(exploration.trainLastBar),'trade after training cutoff');
 assert.ok(o.signalTime<o.entryAt,'decision frozen before virtual fill');
 assert.ok(o.score>=0&&o.score<=1&&o.threshold>=0&&o.threshold<=1);
}
const net=closes.reduce((a,o)=>a+o.netPnlGbp,0);
assert.ok(Math.abs(net-exploration.summary.allPaperNetGbp)<.0001);
assert.ok(Math.abs(exploration.summary.modelSelectedNetGbp-
 closes.filter(o=>o.selection==='MODEL').reduce((a,o)=>a+o.netPnlGbp,0))<.0001);
assert.ok(!JSON.stringify(exploration.state).includes('apiKey'));
assert.equal(exploration.state.model.activatedForTrading,false);
assert.ok(exploration.state.revisions>=closes.length-1);
const selected=runSLHistoricalPaperReplay({bars,...config,executionPolicy:'SL_SELECTED',now});
assert.ok(selected.state.paperOrders.every(o=>o.selection==='MODEL'));
assert.ok(selected.summary.ordersOpened<=exploration.summary.ordersOpened);
const replay2=runSLHistoricalPaperReplay({bars,...config,executionPolicy:'EXPLORE_ALL',now});
assert.deepEqual(exploration.state.paperOrders,replay2.state.paperOrders,'same historical data gives same paper fills');
assert.throws(()=>runSLHistoricalPaperReplay({bars:bars.slice(0,300),...config,now}),/450/);
// Forward engine: a canceled order crossing a session gap must have no invented P&L.
const initial=initializeSLLoop({bars:bars.slice(0,600),...config,executionPolicy:'EXPLORE_ALL',now});
const nextBar={...bars[600]};
const opened=advanceSLLoop(initial.state,[...bars.slice(0,600),nextBar],{now});
assert.equal(opened.state.paperOrders.at(-1)?.status,'OPEN');
const jumped={...bars[601],t:new Date(Date.parse(bars[601].t)+24*STEP).toISOString()};
const cancelled=advanceSLLoop(opened.state,[...bars.slice(0,601),jumped],{now});
assert.equal(cancelled.state.paperOrders.at(-1).status,'CANCELLED');
assert.equal(cancelled.state.paperCancelled,1);
assert.equal(cancelled.state.closedCandidates,0);
assert.equal(cancelled.state.selectedNetPnlGbp,0);
assert.equal(cancelled.state.paperNetPnlGbp,0);
assert.equal(cancelled.state.revisions,0);
assert.equal(SL_PAPER_ORDER_LIMIT,1500);
console.log('SL PAPER PASS: trained-prefix-only walk forward, virtual entries/exits, fees and net, model vs exploration, gap cancellations, deterministic ledger, no broker orders');
