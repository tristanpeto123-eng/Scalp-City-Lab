import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifySharedPaperHistory as inspect} from './shared-paper-observer.mjs';

const account={id:'paper-verified-01',status:'ACTIVE',trading_blocked:false,account_blocked:false};
const demoOrder={id:'paper-order-A',client_order_id:'SCALPDEMO5M-abc123',symbol:'BTC/USD',
  side:'buy',status:'filled',filled_qty:'0.05'};
const teacherOrder={id:'paper-order-B',client_order_id:'teacher-'+'b'.repeat(34),symbol:'ETH/USD',
  side:'sell',status:'filled',filled_qty:'0.10'};
const demoFill={id:'paper-fill-A',activity_type:'FILL',order_id:demoOrder.id,
  symbol:'BTC/USD',side:'buy',price:'100',qty:'0.05',
  transaction_time:'2026-10-20T12:00:00Z'};
const teacherFill={id:'paper-fill-B',activity_type:'FILL',order_id:teacherOrder.id,
  symbol:'ETH/USD',side:'sell',price:'100',qty:'0.10',
  transaction_time:'2026-10-20T13:00:00Z'};
function inputs(other={}){
 return {account,expectedAccountId:account.id,orders:[demoOrder,teacherOrder],
   positions:[],openOrders:[],activities:[demoFill,teacherFill],
   ordersComplete:true,activitiesComplete:true,
   frozenIntents:[{clientOrderId:demoOrder.client_order_id,
     modelSha256:'a'.repeat(64),paperOnly:true,readOnlyProvenance:true,symbol:'BTC/USD'}],
   ...other};
}
test('one shared PAPER account can report distinct demo and Teacher orders with no grades or mutations',()=>{
 const data=inspect(inputs());
 assert.equal(data.status,'OBSERVED_NOT_GRADED');
 assert.equal(data.lanes.demo.orders,1);
 assert.equal(data.lanes.teacher.orders,1);
 assert.equal(data.lanes.demo.recordedFillActivities,1);
 assert.equal(data.lanes.teacher.recordedFillActivities,1);
 assert.equal(data.attributionComplete,true);
 assert.equal(data.readyForManualHandoffReview,true);
 assert.equal(data.sharedAccountExecutionEnabled,false);
 assert.equal(data.canIndependentlyGrade,false);
 assert.equal(data.teacherGrades,0);
 assert.equal(data.paperOrdersSubmitted,0);
 assert.equal(data.liveOrdersSubmitted,0);
});
test('missing hash-bound demo intent gives observer data but no handoff readiness or grade',()=>{
 const d=inspect(inputs({frozenIntents:[]}));
 assert.equal(d.status,'OBSERVED_NOT_GRADED');
 assert.equal(d.attributionComplete,false);
 assert.equal(d.readyForManualHandoffReview,false);
 assert.equal(d.canIndependentlyGrade,false);
 assert.equal(d.lanes.demo.unattributedIntents,1);
});
test('mixed open orders from two strategies on shared account fail closed',()=>{
 const d=inspect(inputs({
  orders:[{...demoOrder,status:'new',filled_qty:'0'},
          {...teacherOrder,status:'accepted',filled_qty:'0'}],
  openOrders:[{...demoOrder,status:'new'},{...teacherOrder,status:'accepted'}],
  activities:[],frozenIntents:[]}));
 assert.equal(d.status,'BLOCKED');
 assert.equal(d.reason,'CONCURRENT_PAPER_EXECUTORS_CONFLICT');
});
test('historical filled orders cannot mask account open inventory',()=>{
 const d=inspect(inputs({positions:[{symbol:'BTCUSD',qty:'0.001'}]}));
 assert.equal(d.status,'OBSERVED_NOT_GRADED');
 assert.equal(d.accountContainsOpenPositions,true);
 assert.equal(d.readyForManualHandoffReview,false);
});
test('unknown manual orders, broken account identity or missing pages block attribution',()=>{
 for(const other of [
  {orders:[demoOrder,{...teacherOrder,client_order_id:'manual-order'}]},
  {expectedAccountId:'another-account-id'},
  {ordersComplete:false},
  {activitiesComplete:false},
  {orders:new Array(500).fill(demoOrder)},
  {openOrders:[{id:'ghost-order',status:'new'}]}
 ])assert.equal(inspect(inputs(other)).status,'BLOCKED');
});
test('unknown fills, missing broker FILL, duplicate activities and false model bindings block',()=>{
 for(const other of [
  {activities:[{...demoFill,order_id:'unowned'},teacherFill]},
  {activities:[demoFill,demoFill,teacherFill]},
  {activities:[demoFill]},
  {frozenIntents:[{clientOrderId:demoOrder.client_order_id,
    modelSha256:'b'.repeat(64),paperOnly:true,readOnlyProvenance:false,symbol:'BTC/USD'}]},
 ])assert.equal(inspect(inputs(other)).status,'BLOCKED');
});
test('observer does not access Alpaca endpoint or allow order placement / give official grades',async()=>{
 const code=await readFile(new URL('./shared-paper-observer.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|\/v2\/orders|api\.alpaca\.markets/);
 assert.match(code,/paperOrdersSubmitted:0/);
 assert.match(code,/sharedAccountExecutionEnabled:false/);
 assert.match(code,/teacherGrades:0/);
});
