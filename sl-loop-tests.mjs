import assert from 'node:assert/strict';
import {initializeSLLoop,advanceSLLoop,SL_LOOP_SCHEMA} from './sl-loop.mjs';

const STEP=300000,now=Date.parse('2026-02-15T00:00:00Z');
const start=Date.parse('2026-01-01T00:00:00Z');
const bars=Array.from({length:1200},(_,i)=>{
 const o=4100+Math.sin(i*.19)*14+Math.cos(i*.057)*7+i*.002;
 const c=o+.65*Math.sin(i*.46);
 return {t:new Date(start+i*STEP).toISOString(),o,h:Math.max(o,c)+.8,
  l:Math.min(o,c)-.8,c,v:100+i%28};
});
const config={market:'COMMODITIES',symbol:'XAUUSD',holdCandles:2,
 sideCostBps:3,virtualNotionalGbp:1000};
const bootstrap=initializeSLLoop({bars,...config,now});
assert.equal(bootstrap.state.schema,SL_LOOP_SCHEMA);
assert.equal(bootstrap.result,'BASELINE_CAPTURE_NO_NEW_FORWARD_TRADES');
assert.equal(bootstrap.state.cycles,0);
assert.equal(bootstrap.state.executedTrades,0);
assert.equal(bootstrap.state.newCandles,0);
assert.ok(bootstrap.state.memory.good.length>0);
assert.ok(bootstrap.state.memory.bad.length>0);
assert.ok(bootstrap.state.pending);
assert.equal(bootstrap.state.pending.signalTime,bars.at(-1).t);
assert.equal(bootstrap.state.pending.entryAt,
 new Date(Date.parse(bars.at(-1).t)+STEP).toISOString());
const initialN=bootstrap.state.memory.good.length+bootstrap.state.memory.bad.length;
const future=Array.from({length:23},(_,j)=>{
 const i=bars.length+j,o=4100+Math.sin(i*.19)*14+Math.cos(i*.057)*7+i*.002;
 const c=o+.65*Math.sin(i*.46);
 return {t:new Date(start+i*STEP).toISOString(),o,h:Math.max(o,c)+.8,
  l:Math.min(o,c)-.8,c,v:100+i%28};
});
const first=advanceSLLoop(bootstrap.state,[...bars,future[0]],{now});
assert.equal(first.newCandles,1);
assert.equal(first.newClosed,0);
assert.equal(first.state.newCandles,1);
assert.ok(first.state.position,'pending signal entered at next candle open');
assert.equal(first.state.position.entryPrice,future[0].o);
assert.equal(first.state.position.entryAt,future[0].t);
assert.equal(first.state.selectedNetPnlGbp,0);
assert.equal(first.state.memory.good.length+first.state.memory.bad.length,initialN);
assert.deepEqual(first.state.model,bootstrap.state.model,'unclosed opportunity cannot train model');
const same=advanceSLLoop(first.state,[...bars,future[0]],{now});
assert.equal(same.result,'UNCHANGED_NO_NEW_LEARNING');
assert.equal(same.newClosed,0);
assert.deepEqual(same.state,first.state);
const next=advanceSLLoop(first.state,[...bars,...future.slice(0,3)],{now});
assert.equal(next.newClosed,1);
assert.equal(next.state.closedCandidates,1);
assert.equal(next.state.revisions,1);
assert.equal(next.state.model.incrementalUpdates,1,'fresh closed trade immediately teaches neural model');
assert.notDeepEqual(next.state.model.weights,first.state.model.weights,
 'model must update rather than only shift historical validation partitions');
assert.equal(next.state.memory.good.length+next.state.memory.bad.length,initialN+1);
const after=advanceSLLoop(next.state,[...bars,...future.slice(0,23)],{now});
assert.ok(after.state.closedCandidates>2);
assert.ok(after.state.revisions>2);
assert.equal(after.state.newCandles,23);
assert.equal(after.state.closedCandidates,
 after.state.counterfactualCount,'all nonzero virtual outcomes labelled');
assert.ok(after.state.executedTrades<=after.state.closedCandidates);
assert.equal(after.state.memory.good.length+after.state.memory.bad.length,
  initialN+after.state.counterfactualCount);
assert.equal(after.state.lastBar.t,future.at(-1).t);
assert.equal(after.state.status,'AWAITING_MORE_COMPLETED_BARS');
assert.equal(after.state.model.incrementalUpdates,after.state.counterfactualCount);
assert.ok(!JSON.stringify(after.state).includes('apikey'));
const restored=JSON.parse(JSON.stringify(after.state));
assert.deepEqual(advanceSLLoop(restored,[...bars,...future],{now}).state,restored);
const revised=[...bars,...future.slice(0,1)].map(x=>({...x}));
revised.at(-1).c+=1;
revised.at(-1).h=Math.max(revised.at(-1).h,revised.at(-1).c);
await assert.rejects(async()=>advanceSLLoop(first.state,revised,{now}),/source revised/);
const oldEdited=[...bars,...future.slice(0,1)].map(x=>({...x}));
oldEdited[oldEdited.length-3].c+=.01;
oldEdited[oldEdited.length-3].h=Math.max(oldEdited[oldEdited.length-3].h,oldEdited[oldEdited.length-3].c+.1);
assert.throws(()=>advanceSLLoop(first.state,oldEdited,{now}),/revised or lost an overlapping/);
assert.throws(()=>advanceSLLoop(after.state,[...bars.slice(0,1100),...future.slice(0,10)],{now}),
 /source continuity|unordered/);
const weekend=[...bars,future[0],{...future[1],t:new Date(Date.parse(future[1].t)+86400000).toISOString()}];
assert.throws(()=>advanceSLLoop(first.state,weekend,{now}),/open virtual position spans/);
assert.throws(()=>initializeSLLoop({bars,market:'CRYPTO',symbol:'BTCUSD',now}),/Invalid SL loop/);
const mutated=future.map(x=>({...x}));
mutated[2].o+=5;mutated[2].h=Math.max(mutated[2].h,mutated[2].o+.1);
const changed=advanceSLLoop(first.state,[...bars,...mutated.slice(0,3)],{now});
assert.equal(first.state.position.entryPrice,future[0].o,'prior execution price frozen');
assert.equal(changed.state.memory.good.length+changed.state.memory.bad.length,initialN+1,
 'only completed outcome teaches network');
assert.notEqual(changed.state.memory.good.concat(changed.state.memory.bad).at(-1)?.netPnlGbp,
 next.state.memory.good.concat(next.state.memory.bad).at(-1)?.netPnlGbp);
console.log('PASS SL LOOP: historical baseline, model-frozen entry, simulated close, feedback retrain, idempotent repeated bars, continuity, gaps, no orders');