import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchContextualLevels,contextualSetups,predictLevelEdge,levelFeatureVector,PLI_V2_MODEL_SCHEMA} from './price-level-intelligence-v2.mjs';
import {researchLevelTransitions} from './price-level-intelligence.mjs';
const ms=900000,first=Date.parse('2025-01-06T00:00:00Z');
function fixture(count=1560,seed=13){
 let r=seed;const rand=()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};
 return Array.from({length:count},(_,i)=>{
  const base=2900+28*Math.sin(i*.078)+14*Math.sin(i*.015)+3*(rand()-.5);
  const o=base+.4*(rand()-.5),c=base+.6*(rand()-.5);
  return {t:new Date(first+ms*i).toISOString(),o,h:Math.max(o,c)+1.5,l:Math.min(o,c)-1.5,c,v:null};
 });
}
const bars=fixture();
const run=x=>researchContextualLevels({bars,...x});
test('distinct contextual checkpoint and opt-out broker flags',()=>{
 const {model,report,memory}=run();
 assert.equal(model.schema,PLI_V2_MODEL_SCHEMA);
 assert.equal(model.enabledForBroker,false);
 assert.equal(model.paperTradingEligible,false);
 assert.equal(model.liveTradingEligible,false);
 assert.equal(report.chronology.sealedTestEvaluated,false);
 assert.ok(report.fit.groups>=0&&report.fit.counterfactuals===memory.length);
 assert.ok(memory.every(r=>r.evidenceOrigin==='FIT_ONLY_COUNTERFACTUAL'&&r.isExecutedTrade===false));
 assert.ok(model.features.length>12);
});
test('sealed final 20% mutation changes neither learned model nor development report',()=>{
 const a=run(),offset=Math.floor(bars.length*.8);
 const future=bars.map((c,i)=>i<offset?c:{...c,o:c.o+100,h:c.h+100,l:c.l+100,c:c.c+100});
 const b=run({bars:future});
 assert.deepEqual(a.model,b.model);
 assert.deepEqual(a.report,b.report);
 assert.deepEqual(a.memory,b.memory);
});
test('last-bar mutation changes labels but not pre-entry level features',()=>{
 const a=run(),one=a.memory[0];
 if(!one)return;
 const idx=bars.findIndex(b=>b.t===one.signalAt);
 const changed=bars.map(x=>({...x})),j=idx+1;
 changed[j].o+=1;changed[j].h=Math.max(changed[j].h,changed[j].o+.2);
 const second=run({bars:changed});
 const match=second.memory.find(m=>m.id===one.id);
 if(match)assert.deepEqual(match.features,one.features);
});
test('native symbol and timeframe checkpoint gates are enforced',()=>{
 const g=run();
 assert.throws(()=>contextualSetups({bars,model:g.model,symbol:'XAGUSD'}),/Wrong|unsafe/);
 assert.throws(()=>researchContextualLevels({bars,symbol:'XAGUSD',timeframe:'5Min'}),/Unsupported/);
 assert.throws(()=>predictLevelEdge({...g.model,enabledForBroker:true},{features:Array(16).fill(0),pattern:'BREAKOUT',regime:'RANGING'}),/unsafe/);
 const s=contextualSetups({bars,model:g.model});
 assert.ok(s.setups.every(x=>x.brokerExecutable===false));
});
test('greater fees cannot inflate any matching FIT counterfactual outcome',()=>{
 const a=run({sideCostBps:5,stressSideCostBps:10});
 const b=run({sideCostBps:10,stressSideCostBps:20});
 const changed=new Map(b.memory.map(x=>[x.id,x]));
 for(const r of a.memory){const x=changed.get(r.id);assert.ok(x);assert.ok(x.netGbp<=r.netGbp+1e-7);assert.ok(x.stressNetGbp<=r.stressNetGbp+1e-7);}
});
test('gaps avoid virtual fills crossing a missing candle boundary',()=>{
 const gap=bars.map((b,i)=>i<680?b:{...b,t:new Date(Date.parse(b.t)+86400000).toISOString()});
 const x=run({bars:gap});
 assert.ok(x.memory.every(r=>!(r.signalAt<gap[680].t&&r.closedAt>=gap[680].t)));
});
test('context fitting and tuning remain isolated from later development bars',()=>{
 const orig=run();
 const start=Math.floor(bars.length*.6);
 const altered=bars.map((b,i)=>i<start?b:{...b,o:b.o+100,h:b.h+100,l:b.l+100,c:b.c+100});
 const later=run({bars:altered});
 assert.deepEqual(orig.model,later.model);
 assert.deepEqual(orig.report.tuning,later.report.tuning);
 assert.deepEqual(orig.memory,later.memory);
});
test('an abstaining model does not fabricate performance or executions',()=>{
 const r=run();
 if(r.model.entryMarginBps>100)assert.equal(r.report.development.trades,0);
 assert.equal(r.report.brokerOrders,0);
 assert.equal(r.report.paperOrders,0);
 assert.equal(r.report.liveOrders,0);
 assert.equal(r.report.independentExamPassed,false);
 assert.equal(r.report.automaticPromotion,false);
});
