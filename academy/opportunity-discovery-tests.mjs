import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseDiscoveryCSV,validateDiscoveryBars,discoverOpportunities,FIVE_MINUTES} from './opportunity-discovery.mjs';
const start=Date.parse('2025-01-01T00:00:00Z');
const bars=Array.from({length:1320},(_,i)=>{
 const o=2650+Math.sin(i*.15)*9+Math.cos(i*.023)*15+i*.006,c=o+Math.cos(i*.41)*.9;
 return {t:new Date(start+i*FIVE_MINUTES).toISOString(),o,h:Math.max(o,c)+.65,l:Math.min(o,c)-.65,c,v:100+i%15};
});
const csv=['time,open,high,low,close,volume',...bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v].join(','))].join('\n');
test('CSV importer accepts completed recorded-format 5m bars',()=>{
 assert.deepEqual(parseDiscoveryCSV(csv),bars);
});
test('reject future, duplicate and invalid historical bars',()=>{
 assert.throws(()=>validateDiscoveryBars([...bars.slice(0,40),bars[39],...bars.slice(40)]),/duplicate/);
 assert.throws(()=>validateDiscoveryBars(bars.map((x,i)=>i===10?{...x,h:x.l-1}:x)),/Invalid candle/);
 assert.throws(()=>validateDiscoveryBars(bars.map(x=>({...x,t:new Date(Date.parse(x.t)+10*365*86400000).toISOString()}))),/incomplete/);
});
test('real historical training/development partitions reserve final 20%',()=>{
 const r=discoverOpportunities({bars});
 assert.equal(r.schema,'ACADEMY_OPPORTUNITY_DISCOVERY_V1');
 assert.ok(r.summary.trainCandidates>0&&r.summary.developmentCandidates>0);
 assert.equal(r.dataset.sealedTestCandles,264);
 assert.equal(r.dataset.sealedTestEvaluated,false);
 assert.ok(r.opportunities.every(x=>Date.parse(x.closedAt)<Date.parse(r.dataset.sealedTestStart)));
 assert.ok(r.opportunities.every(x=>x.isCounterfactual&&['TRAIN','DEVELOPMENT'].includes(x.phase)));
 assert.equal(r.brokerOrders,0);assert.equal(r.modelPromotions,0);assert.equal(r.verifiedForwardGrades,0);
});
test('both directions offered but explicitly correlated by groupId',()=>{
 const r=discoverOpportunities({bars});
 const a=r.opportunities.slice(0,4);
 assert.equal(new Set(a.map(x=>x.groupId)).size,1);
 assert.equal(new Set(a.map(x=>x.id)).size,4);
 assert.deepEqual(new Set(a.map(x=>x.side)),new Set(['LONG','SHORT']));
});
test('causal feature vector does not use future opening price or outcome',()=>{
 const first=discoverOpportunities({bars}).opportunities[0];
 const changed=bars.map(x=>({...x}));
 const j=changed.findIndex(x=>x.t===first.openedAt);
 changed[j].o*=1.01;changed[j].h=Math.max(changed[j].h,changed[j].o+1);
 const next=discoverOpportunities({bars:changed}).opportunities[0];
 assert.deepEqual(next.features,first.features);
 assert.notEqual(next.netPnlGbp,first.netPnlGbp);
});
test('mutating the sealed final 20% cannot change any candidate labels',()=>{
 const a=discoverOpportunities({bars}).opportunities;
 const later=bars.map((b,i)=>i>=1056?{...b,o:b.o+100,h:b.h+100,l:b.l+100,c:b.c+100}:b);
 assert.deepEqual(discoverOpportunities({bars:later}).opportunities,a);
});
test('net virtual P&L includes modeled costs and stress is more costly',()=>{
 const r=discoverOpportunities({bars,sideCostBps:7,stressSideCostBps:15});
 for(const x of r.opportunities){
  const gross=(x.side==='LONG'?1:-1)*(x.exitPrice/x.entryPrice-1);
  assert.ok(Math.abs(x.netPnlGbp-(1000*(gross-.0014)))<1e-7);
  assert.ok(x.stressNetPnlGbp<=x.netPnlGbp);
  assert.ok(x.features.length===6&&x.features.every(v=>v>=-1&&v<=1));
  assert.equal(x.binaryLabel,x.label==='GOOD'?1:x.label==='BAD'?0:null);
 }
});
test('preserves genuine session gaps and rejects cross-gap opportunities',()=>{
 const shifted=bars.map((x,i)=>i<550?x:{...x,t:new Date(Date.parse(x.t)+86400000).toISOString()});
 const r=discoverOpportunities({bars:shifted});
 assert.equal(r.dataset.gaps,1);
 for(const x of r.opportunities)assert.ok(!(x.signalAt<shifted[550].t&&x.closedAt>=shifted[550].t));
});
test('simultaneous TP/SL is conservatively a losing stop',()=>{
 const r=discoverOpportunities({bars,sideCostBps:0,stressSideCostBps:0,scenarios:[{holdCandles:1,stopBps:.5,takeBps:.5}]});
 const hits=r.opportunities.filter(x=>x.exitReason==='AMBIGUOUS_STOP_FIRST');
 assert.ok(hits.length>0);assert.ok(hits.every(x=>x.label==='BAD'));
});