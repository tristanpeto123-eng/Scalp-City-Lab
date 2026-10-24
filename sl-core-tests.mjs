import assert from 'node:assert/strict';
import {createSLMemory,recordSLTrade,trainSL,predictSL,validateSLMemory,slMemoryStats,SL_ACTIVE_MARKETS} from './sl-core.mjs';
function trade(i,market='COMMODITIES',source='HISTORICAL_RESEARCH'){
 const signal=Math.sin(i*4.13)>.1?1:-1;
 const opened=new Date(Date.UTC(2025,0,1+i,1)).toISOString();
 const closed=new Date(Date.UTC(2025,0,1+i,2)).toISOString();
 return {id:`trade-${i}`,market,source,openedAt:opened,closedAt:closed,
  entryFeatures:[signal,.3*signal,.1,.15,0,signal*.6],netPnlGbp:signal>0?10:-16};
}
let m=createSLMemory('COMMODITIES');
for(let i=0;i<100;i++)m=recordSLTrade(m,trade(i));
assert.equal(slMemoryStats(m).good+slMemoryStats(m).bad,100);
assert.equal(slMemoryStats(m).netPnlGbp, m.good.reduce((s,x)=>s+x.netPnlGbp,0)+m.bad.reduce((s,x)=>s+x.netPnlGbp,0));
assert.throws(()=>recordSLTrade(m,trade(0)),/Duplicate/);
assert.throws(()=>recordSLTrade(m,{...trade(101),entryFeatures:[99,0,0,0,0,0]}),/Invalid/);
assert.throws(()=>recordSLTrade(m,{...trade(101),netPnlGbp:0}),/Invalid/);
assert.throws(()=>recordSLTrade(m,{...trade(101),source:'SYNTHETIC_DEMO'}),/must not be mixed/);
assert.throws(()=>validateSLMemory({...m,bad:[...m.bad,m.good[0]]}),/losing/);
assert.throws(()=>trainSL(createSLMemory('COMMODITIES')),/at least 40/);
for(const market of SL_ACTIVE_MARKETS){
 let dataset=createSLMemory(market);
 for(let i=0;i<100;i++)dataset=recordSLTrade(dataset,trade(i,market));
 const a=trainSL(dataset), b=trainSL(dataset);
 assert.deepEqual(a,b,'deterministic training');
 assert.equal(a.report.train,60);assert.equal(a.report.validation,20);assert.equal(a.report.test,20);
 assert.equal(a.report.purged,0);
 assert.equal(a.model.activatedForTrading,false);
 assert.equal(predictSL(a.model,[.8,.2,.1,.1,0,.5],market).brokerOrderAllowed,false);
 assert.throws(()=>predictSL(a.model,[.8,.2,.1,.1,0,.5],'CRYPTO'),/Invalid/);
 assert.ok(a.report.heldOutResults.netPnlGbp<=1e7);
}
let d=createSLMemory('COMMODITIES');
for(let i=0;i<100;i++)d=recordSLTrade(d,{...trade(i),closedAt:new Date(Date.UTC(2025,0,1+i,3)).toISOString()});
assert.equal(trainSL(d).report.purged,0);
let overlapped=createSLMemory('COMMODITIES');
for(let i=0;i<100;i++)overlapped=recordSLTrade(overlapped,{...trade(i),closedAt:new Date(Date.UTC(2025,0,1+i,1+36)).toISOString()});
assert.ok(trainSL(overlapped).report.purged>0,'overlap purged');
assert.throws(()=>trainSL({...m, market:'CRYPTO',good:m.good.map(x=>({...x,market:'CRYPTO'})),bad:m.bad.map(x=>({...x,market:'CRYPTO'}))}),/not yet activated/);
console.log('SL tests passed: isolated piles, weighted MLP, 60/20/20, overlap purge, market isolation, deterministic inference and no orders');