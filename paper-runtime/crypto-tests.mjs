import assert from 'node:assert/strict';
import {AgentWorkflow,AGENTS,VERSION,curateBars,CRYPTO_COST_BPS,simulate,validate,validateHoldoutIndependently} from './engine.mjs';
import {AlpacaPaper} from './alpaca-paper.mjs';
const NOW=Date.parse('2026-10-17T20:00:00Z'); // Saturday, US stock market shut
const raw=[];let price=40000;
for(let i=200;i>=1;i--){const time=NOW-i*900000-60000;const o=price,c=o*1.001;
 raw.push({t:new Date(time).toISOString(),o,h:c*1.0002,l:o*.9998,c,v:100});price=c;}
const broker=()=>({submitted:[],clockCalls:0,history:async()=>raw,clock:async function(){this.clockCalls++;return {is_open:false}},
 account:async()=>({status:'ACTIVE',equity:'100000',last_equity:'100000',cash:'90000',non_marginable_buying_power:'90000',buying_power:'200000'}),
 positions:async()=>[],openOrders:async()=>[],recentOrders:async()=>[],orderByClientId:async()=>null,
 paperOrder:async function(o){this.submitted.push(o);return {id:'crypto-paper',status:'accepted'}}});
class Journal{constructor(){this.events=[];}async append(e){this.events.push(e);}}
let checked=0;
for(const sym of ['BTC/USD','ETH/USD']){
 const b=broker(),j=new Journal(),flow=new AgentWorkflow({broker:b,journal:j,paperEnabled:false,now:()=>NOW});
 const stages=[],real=flow.stage.bind(flow);
 flow.stage=(id,fn,x)=>{stages.push(id);return id==='VL-01'?Promise.resolve({verdict:'AUDIT_PASS',holdout:{netReturnPct:5,maxDrawdownPct:1}}):real(id,fn,x)};
 const result=await flow.process(sym);
 assert.equal(result.status,'DRY_RUN');checked++;
 assert.deepEqual(stages,AGENTS.map(x=>x[0]));checked++;
 assert.equal(b.clockCalls,0);checked++;
 assert.equal(b.submitted.length,0);checked++;
 assert.equal(result.trade.proposed.notional,500);checked++;
 assert.equal(flow.markets[sym].source,'REAL_CRYPTO_US');checked++;
}
const b=broker(),flow=new AgentWorkflow({broker:b,journal:new Journal(),paperEnabled:true,now:()=>NOW});
const real=flow.stage.bind(flow);
flow.stage=(id,fn,x)=>id==='VL-01'?Promise.resolve({verdict:'AUDIT_PASS',holdout:{netReturnPct:5,maxDrawdownPct:1}}):real(id,fn,x);
const submitted=await flow.process('BTC/USD');assert.equal(submitted.status,'PAPER_ORDER_SUBMITTED');checked++;
assert.equal(b.submitted.length,1);checked++;
assert.equal(b.submitted[0].symbol,'BTC/USD');checked++;
assert.equal(b.submitted[0].time_in_force,'ioc');checked++;
assert.equal(b.submitted[0].notional,'500.00');checked++;
assert.match(b.submitted[0].client_order_id,/^sc010rc3-BTCUSD-[a-f0-9]{24}$/);checked++;
assert.equal((await flow.process('BTC/USD')).status,'NO_NEW_BAR');checked++;
const missing=broker();missing.account=async()=>({status:'ACTIVE',equity:'100000',last_equity:'100000',cash:'90000',buying_power:'90000'});
const reject=new AgentWorkflow({broker:missing,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(reject.evaluateRisk({symbol:'BTC/USD',signal:1,curated:curateBars(raw,NOW,'ALPACA_CRYPTO_US'),clock:{is_open:true}}),/cash-only/);checked++;
const already=broker();already.openOrders=async()=>[{symbol:'BTCUSD',side:'buy'}];
const noDup=new AgentWorkflow({broker:already,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(noDup.evaluateRisk({symbol:'BTC/USD',signal:1,curated:curateBars(raw,NOW,'ALPACA_CRYPTO_US'),clock:{is_open:true}}),/pending/);checked++;
const manual=broker();manual.positions=async()=>[{symbol:'BTCUSD',qty:'0.01'}];
const safe=new AgentWorkflow({broker:manual,journal:new Journal(),paperEnabled:true,now:()=>NOW});
await assert.rejects(safe.evaluateRisk({symbol:'BTC/USD',signal:0,curated:curateBars(raw,NOW,'ALPACA_CRYPTO_US'),clock:{is_open:true}}),/unattributed/);checked++;
const http=[];
const client=new AlpacaPaper({key:'test',secret:'test',now:()=>NOW,fetchImpl:async(url,opt={})=>{
 http.push({url,method:opt.method||'GET'});
 if(url.includes('crypto/us/bars'))return {ok:true,json:async()=>({bars:{'BTC/USD':raw}})};
 return {ok:true,json:async()=>({id:'paper',status:'accepted'})};
}});
const fetched=await client.history('BTC/USD');assert.ok(fetched.length>=150);checked++;
assert.ok(http.every(o=>o.url.startsWith('https://data.alpaca.markets/')));checked++;
await client.paperOrder({symbol:'BTC/USD',side:'buy',type:'market',time_in_force:'ioc',client_order_id:'sc010rc3-BTCUSD-aaaaaaaaaaaaaaaaaaaaaaaa',notional:'50.00'});
assert.equal(http.at(-1).url,'https://paper-api.alpaca.markets/v2/orders');checked++;
assert.throws(()=>client.paperOrder({symbol:'BTC/USD',side:'buy',type:'market',time_in_force:'day',client_order_id:'sc010rc3-BTCUSD-aaaaaaaaaaaaaaaaaaaaaaaa',notional:'50.00'}),/Rejected/);checked++;
const curated=curateBars(raw,NOW,'ALPACA_CRYPTO_US');assert.equal(curated.source,'ALPACA_CRYPTO_US');checked++;
const p={fast:6,slow:26},cut=150;
const bt={training:simulate(curated.bars.slice(0,cut),p,{costBps:CRYPTO_COST_BPS})};
const evaluation=validate(curated.bars,{params:p},cut,bt,CRYPTO_COST_BPS);
assert.equal(evaluation.accountingMatch,true);checked++;
assert.notEqual(validateHoldoutIndependently(curated.bars,p,cut,{costBps:CRYPTO_COST_BPS}).netReturnPct,
 validateHoldoutIndependently(curated.bars,p,cut,{costBps:CRYPTO_COST_BPS*2}).netReturnPct);checked++;
console.log('PASS '+checked+' crypto risk/routing/market checks · '+VERSION+' · broker mocked');
