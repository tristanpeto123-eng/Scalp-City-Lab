import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapKeyLevels,suggestLevelSetups,researchLevelTransitions,PLI_SCHEMA,PLI_MODEL_SCHEMA} from './price-level-intelligence.mjs';
const ms=900000,start=Date.parse('2025-02-03T00:00:00Z');
function synthetic({count=2200,seed=7,offset=0}={}){
 let r=seed;const rng=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};
 return Array.from({length:count},(_,i)=>{
  const mid=3300+offset+36*Math.sin(i*.055)+9*Math.sin(i*.17)+3*(rng()-.5);
  const o=mid+1.5*(rng()-.5),c=mid+1.5*(rng()-.5);
  return {t:new Date(start+ms*i).toISOString(),o,h:Math.max(o,c)+1.1,l:Math.min(o,c)-1.1,c,v:100};
 });
}
const bars=synthetic();
test('level mapper marks historical price zones using closed candles only',()=>{
 const a=mapKeyLevels({bars,signalIndex:900,symbol:'XAUUSD'});
 assert.equal(a.schema,PLI_SCHEMA);
 assert.equal(a.signalAt,bars[900].t);
 assert.ok(a.levels.length>0&&a.levels.every(x=>x.lower<=x.price&&x.price<=x.upper));
 const altered=bars.map((b,i)=>i<=900?b:{...b,o:b.o+800,h:b.h+800,l:b.l+800,c:b.c+800});
 assert.deepEqual(mapKeyLevels({bars:altered,signalIndex:900,symbol:'XAUUSD'}),a);
});
test('research keeps final 20% sealed including against future price mutation',()=>{
 const a=researchLevelTransitions({bars,symbol:'XAUUSD'});
 const cutoff=Math.floor(bars.length*.8);
 const future=bars.map((b,i)=>i<cutoff?b:{...b,o:b.o+200,h:b.h+200,l:b.l+200,c:b.c+200});
 const c=researchLevelTransitions({bars:future,symbol:'XAUUSD'});
 assert.equal(a.modelSha256,c.modelSha256);
 assert.deepEqual(a.report,c.report);
 assert.equal(a.report.data.sealedTestEvaluated,false);
 assert.ok(a.report.data.sealedTestCandles>0);
 assert.equal(a.report.brokerOrders,0);
 assert.equal(a.report.paperOrders,0);
});
test('market specialists cannot use each others trained level models',()=>{
 const g=researchLevelTransitions({bars,symbol:'XAUUSD'});
 const s=researchLevelTransitions({bars:synthetic({offset:100}),symbol:'XAGUSD'});
 assert.equal(g.model.schema,PLI_MODEL_SCHEMA);
 assert.notEqual(g.model.symbol,s.model.symbol);
 assert.throws(()=>suggestLevelSetups({bars,symbol:'XAGUSD',checkpoint:g.model}),/Wrong or unsafe/);
 assert.throws(()=>suggestLevelSetups({bars,symbol:'XAGUSD',timeframe:'5Min'}),/Unsupported/);
 assert.equal(s.model.enabledForBroker,false);
});
test('higher round trip fees never boost virtual net profits',()=>{
 const a=researchLevelTransitions({bars,sideCostBps:5,stressSideCostBps:10});
 const b=researchLevelTransitions({bars,sideCostBps:10,stressSideCostBps:20});
 const old=a.memory.filter(x=>x.netGbp!==0),newer=new Map(b.memory.map(x=>[x.id,x]));
 for(const c of old){const d=newer.get(c.id);assert.ok(d);assert.ok(d.netGbp<=c.netGbp+1e-7);assert.ok(d.stressNetGbp<=c.stressNetGbp+1e-7);}
});
test('gaps are not manufactured into virtual candle fills',()=>{
 const shifted=bars.map((b,i)=>i<700?b:{...b,t:new Date(Date.parse(b.t)+2*86400000).toISOString()});
 const r=researchLevelTransitions({bars:shifted});
 assert.ok(r.memory.every(m=>!(m.signalAt<shifted[700].t&&m.closedAt>=shifted[700].t)));
});
test('student market and input fail closed',()=>{
 assert.throws(()=>researchLevelTransitions({bars,symbol:'BTCUSD'}),/Unsupported/);
 assert.throws(()=>researchLevelTransitions({bars:bars.slice(0,900)}),/>=1100/);
 assert.throws(()=>mapKeyLevels({bars:bars.slice(0,120)}),/150/);
 const a=researchLevelTransitions({bars});
 const q=suggestLevelSetups({bars,checkpoint:a.model});
 assert.equal(q.brokerOrders,0);
 assert.ok(q.setups.every(x=>x.brokerExecutable===false));
});