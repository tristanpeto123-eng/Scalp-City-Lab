import assert from 'node:assert/strict';
import {simulate,validateHoldoutIndependently,curateBars,validate,AgentWorkflow,AGENTS,VERSION,inOpeningGrace} from './engine.mjs';
import {AlpacaPaper} from './alpaca-paper.mjs';

const NOW=Date.parse('2026-10-16T19:00:00Z');
function makeBars(n=200,now=NOW){
  const bars=[];let price=100;
  for(let i=n-1;i>=0;i--){
    const t=now-((i+2)*15*60_000),o=price,c=price*(1+(Math.sin(i*.51)*.0008)+.001);
    bars.push({t:new Date(t).toISOString(),o,h:Math.max(o,c)*1.0005,l:Math.min(o,c)*.9995,c,v:1000});price=c;
  }
  return bars;
}
const raw=makeBars(),bars=curateBars(raw,NOW).bars;
let checked=0;
for(const p of [{fast:6,slow:26},{fast:9,slow:34},{fast:12,slow:48}]){
  const a=simulate(bars,p,{start:150}),b=validateHoldoutIndependently(bars,p,150);
  assert.ok(Math.abs(a.netReturnPct-b.netReturnPct)<1e-8,'independent returns must reconcile');
  assert.ok(Math.abs(a.maxDrawdownPct-b.maxDrawdownPct)<1e-8,'independent drawdown must reconcile');
  assert.equal(a.orders,b.orders);checked++;
}
assert.throws(()=>curateBars(raw.slice(0,80),NOW),/require/);checked++;
assert.throws(()=>curateBars([...raw,raw.at(-1)],NOW),/duplicate/);checked++;
assert.throws(()=>curateBars(makeBars(200,NOW-2*3600_000),NOW),/stale/);checked++;
assert.throws(()=>curateBars([...raw.slice(0,199),{...raw.at(-1),h:0}],NOW),/invalid/);checked++;
assert.equal(inOpeningGrace(Date.parse('2026-10-19T13:32:00Z')),true);checked++;
assert.equal(inOpeningGrace(Date.parse('2026-11-02T14:32:00Z')),true);checked++;
assert.equal(inOpeningGrace(Date.parse('2026-10-19T13:47:00Z')),false);checked++;

// Force validation rejection: no trades (a consistently flat set).
const flatRaw=makeBars().map((b,i)=>({...b,o:100,h:100.1,l:99.9,c:100}));
const fb=curateBars(flatRaw,NOW).bars;
const block=validate(fb,{params:{fast:6,slow:26}},150,{training:{entries:0}});
assert.equal(block.verdict,'BLOCKED');checked++;
class Journal {constructor(){this.events=[];}async append(x){this.events.push(x);}}
function brokerFactory(data){return {
  submitted:[], clock:async()=>({is_open:true}),history:async()=>data,
  account:async()=>({status:'ACTIVE',equity:'100000',last_equity:'100000',buying_power:'90000',trading_blocked:false,account_blocked:false}),
  positions:async()=>[],openOrders:async()=>[],recentOrders:async()=>[],orderByClientId:async()=>null,
  paperOrder:async function(order){this.submitted.push(order);return {id:'paper-order',status:'accepted'};}
}}
const forbidden=brokerFactory(flatRaw),j=new Journal();const flow=new AgentWorkflow({broker:forbidden,journal:j,paperEnabled:true,now:()=>NOW});
const a=await flow.process('SPY');assert.equal(a.status,'VALIDATION_BLOCKED');assert.equal(forbidden.submitted.length,0);
assert.ok(!j.events.some(e=>e.agentId==='RM-01'||e.agentId==='PT-01'));checked++;
const a2=await flow.process('SPY');assert.equal(a2.status,'NO_NEW_BAR');checked++;
const staleBroker=brokerFactory(makeBars(200,NOW-3600_000));const staleFlow=new AgentWorkflow({broker:staleBroker,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(staleFlow.process('SPY'),/stale/);assert.equal(staleFlow.halted,true);checked++;
// Risk refusal and emergency stop are non-bypassable.
const riskBroker=brokerFactory(raw);riskBroker.account=async()=>({status:'ACTIVE',equity:'97000',last_equity:'100000',buying_power:'50000'});
const riskFlow=new AgentWorkflow({broker:riskBroker,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(riskFlow.evaluateRisk({symbol:'SPY',signal:1,curated:curateBars(raw,NOW),clock:{is_open:true}}),/daily drawdown/);checked++;
riskFlow.emergencyStop();await assert.rejects(riskFlow.process('SPY'),/Emergency stop/);checked++;
// Mock HTTP proves paper-only URLs and idempotent lookup handling.
const urls=[];const mockFetch=async (url,opt)=>{urls.push({url,method:opt?.method});if(url.includes('orders:by_client_order_id'))return {status:404,ok:false};return {ok:true,status:200,json:async()=>({id:'paper-order',bars:[]})}};
const adapter=new AlpacaPaper({key:'paper-test',secret:'paper-test',fetchImpl:mockFetch,now:()=>NOW});
await adapter.paperOrder({symbol:'SPY',side:'buy',type:'market',time_in_force:'day',client_order_id:'sc010rc3-SPY-aaaaaaaaaaaaaaaaaaaaaaaa',notional:'100'});
assert.ok(urls.every(x=>x.url.startsWith('https://paper-api.alpaca.markets/')));checked++;
assert.throws(()=>adapter.paperOrder({symbol:'XAUUSD',side:'buy',type:'market',time_in_force:'day',client_order_id:'xyz'}),/Rejected/);checked++;
// Confirm complete connectivity in an approved mock-only profitable scenario:
// This checks the transition wiring without claiming actual market profitability.
const approved=new AgentWorkflow({broker:brokerFactory(raw),journal:new Journal(),paperEnabled:false,now:()=>NOW});
const stages=[];const orig=approved.stage.bind(approved);
approved.stage=async (id,fn,details)=>{stages.push(id);if(id==='VL-01') return {verdict:'AUDIT_PASS',holdout:{netGbp:2,maxDrawdownPct:1}};return orig(id,fn,details)};
const result=await approved.process('QQQ');assert.equal(result.status,'DRY_RUN');
assert.deepEqual(stages,AGENTS.map(x=>x[0]));checked++;
const liveMock=brokerFactory(raw);
const wired=new AgentWorkflow({broker:liveMock,journal:new Journal(),paperEnabled:true,now:()=>NOW});
const delegate=wired.stage.bind(wired);wired.stage=(id,fn,d)=>id==='VL-01'?Promise.resolve({verdict:'AUDIT_PASS',holdout:{netGbp:3,maxDrawdownPct:1}}):delegate(id,fn,d);
const submitted=await wired.process('SPY');assert.equal(submitted.status,'PAPER_ORDER_SUBMITTED');
assert.equal(liveMock.submitted.length,1);assert.equal(liveMock.submitted[0].symbol,'SPY');
assert.ok(/^sc010rc3-/.test(liveMock.submitted[0].client_order_id));checked++;
const duplicate=await wired.process('SPY');assert.equal(duplicate.status,'NO_NEW_BAR');assert.equal(liveMock.submitted.length,1);checked++;
liveMock.recentOrders=async()=>[{id:'paper-order',client_order_id:liveMock.submitted[0].client_order_id,symbol:'SPY',side:'buy',status:'filled',filled_qty:'1',filled_avg_price:'150.00',filled_at:new Date(NOW).toISOString()}];
await wired.reconcile();assert.equal(wired.getStatus().forwardFills.length,1);checked++;
const closed=brokerFactory(raw);closed.clock=async()=>({is_open:false});
const idle=new AgentWorkflow({broker:closed,journal:new Journal(),paperEnabled:true,now:()=>NOW});
assert.equal((await idle.process('SPY')).status,'MARKET_CLOSED');assert.equal(closed.submitted.length,0);checked++;
const monday=Date.parse('2026-10-19T13:32:00Z');
const opening=new AgentWorkflow({broker:brokerFactory(raw),journal:new Journal(),paperEnabled:true,now:()=>monday});
assert.equal((await opening.process('SPY')).status,'WAITING_FOR_OPENING_CANDLE');
assert.equal(opening.halted,false);checked++;
const pending=brokerFactory(raw);
pending.openOrders=async()=>[{symbol:'QQQ',side:'buy'},{symbol:'IWM',side:'buy'}];
const pendingFlow=new AgentWorkflow({broker:pending,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(pendingFlow.evaluateRisk({symbol:'SPY',signal:1,curated:curateBars(raw,NOW),clock:{is_open:true}}),/maximum two/);checked++;
const manual=brokerFactory(raw);
manual.positions=async()=>[{symbol:'SPY',qty:'2'}];
const manualFlow=new AgentWorkflow({broker:manual,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(manualFlow.evaluateRisk({symbol:'SPY',signal:0,curated:curateBars(raw,NOW),clock:{is_open:true}}),/manual or unattributed/);checked++;

console.log(`PASS ${checked} connected-agent checks · ${VERSION} · no real broker contacted`);
