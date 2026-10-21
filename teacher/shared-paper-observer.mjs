// Shared PAPER account: independent, READ-ONLY lane classification.
// Exactly one executor may own paper orders. Teacher may observe demo orders,
// but observing them is NOT grading or a reason to start a second executor.
// Never possesses paper API credentials, sends a request, creates admissions,
// or silently rewrites existing Teacher grading/ledger rules.
const DEMO='SCALPDEMO5M-',TEACHER='teacher-';
const ORDER_FINAL=new Set(['filled','canceled','cancelled','expired','rejected','done_for_day']);
const LIVE_STATES=new Set(['new','accepted','pending_new','partially_filled',
  'pending_cancel','pending_replace','accepted_for_bidding','held','stopped','suspended']);
const canonical=x=>String(x||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
const finite=(x)=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x));
const fail=(reason)=>({schema:'SCALP_SHARED_PAPER_OBSERVER_V1',
  status:'BLOCKED',reason,paperOnly:true,readOnly:true,paperOrdersSubmitted:0,
  liveOrdersSubmitted:0,teacherGrades:0,forwardVerified:false,
  sharedAccountExecutionEnabled:false});
export const PUPIL_PREFIX=DEMO;
export const TEACHER_PREFIX=TEACHER;

// All live/history records must be comprehensive: caller must separately
// verify pagination is exhausted. Orders without history completeness are
// NOT safely attributable. No fees or account positions are allocated here.
export function classifySharedPaperHistory({
  account,expectedAccountId,orders,positions=[],openOrders=[],
  activities=[],ordersComplete=false,activitiesComplete=false,
  frozenIntents=[]
}={}){
 if(!account||typeof expectedAccountId!=='string'||!expectedAccountId||
    account.id!==expectedAccountId||account.status!=='ACTIVE'||account.trading_blocked||
    account.account_blocked)return fail('PAPER_ACCOUNT_UNVERIFIED');
 if(!ordersComplete||!activitiesComplete||!Array.isArray(orders)||
    !Array.isArray(openOrders)||!Array.isArray(positions)||
    !Array.isArray(activities)||orders.length>=500)
    return fail('INCOMPLETE_PAPER_BROKER_HISTORY');
 if(!Array.isArray(frozenIntents))return fail('INVALID_FROZEN_INTENT_RECORD');
 const byBrokerId=new Map(),byClientId=new Map();
 const groups={DEMO:[],TEACHER:[]};
 for(const order of orders){
  if(typeof order?.id!=='string'||!order.id||
     typeof order.client_order_id!=='string'||!order.client_order_id||
     byBrokerId.has(order.id)||byClientId.has(order.client_order_id)||
     !ORDER_FINAL.has(order.status)&&!LIVE_STATES.has(order.status)||
     !['buy','sell'].includes(order.side)||!canonical(order.symbol))
    return fail('MALFORMED_OR_DUPLICATE_BROKER_ORDER');
  const role=order.client_order_id.startsWith(DEMO)?'DEMO':
             /^teacher-[a-f0-9]{34}$/.test(order.client_order_id)?'TEACHER':null;
  if(!role)return fail('UNATTRIBUTED_EXTERNAL_PAPER_ORDER');
  const normalized=canonical(order.symbol);
  const entry={id:order.id,clientOrderId:order.client_order_id,
    symbol:normalized,role,status:order.status,side:order.side,
    final:ORDER_FINAL.has(order.status)};
  groups[role].push(entry);
  byBrokerId.set(order.id,entry);byClientId.set(entry.clientOrderId,entry);
 }
 const liveOrders=new Set();
 for(const order of openOrders){
  if(!order?.id||!byBrokerId.has(order.id)||
     !byBrokerId.get(order.id)||ORDER_FINAL.has(order.status))
   return fail('OPEN_ORDER_NOT_IN_COMPLETE_LEDGER');
  liveOrders.add(order.id);
 }
 if(orders.some(o=>!ORDER_FINAL.has(o.status)&&!liveOrders.has(o.id)))
   return fail('PENDING_ORDER_NOT_RECONCILED');
 const filledByRole={DEMO:0,TEACHER:0},fillIds=new Set(),fillOrders=new Set();
 for(const act of activities){
  if(typeof act?.id!=='string'||!act.id||fillIds.has(act.id))
    return fail('UNTRUSTED_OR_DUPLICATED_ACTIVITY');
  fillIds.add(act.id);
  if(act.activity_type==='FILL'){
   const source=byBrokerId.get(act.order_id);
   if(!source||canonical(act.symbol)!==source.symbol||act.side!==source.side||
      !finite(act.qty)||Number(act.qty)<=0||
      !finite(act.price)||Number(act.price)<=0||
      !Number.isFinite(Date.parse(act.transaction_time)))
     return fail('UNATTRIBUTED_OR_MALFORMED_FILL');
   filledByRole[source.role]++;
   fillOrders.add(source.id);
  }else if(!['CFEE','FEE'].includes(act.activity_type)){
   return fail('UNRECONCILED_ACTIVITY_CATEGORY');
  }
 }
 // A fee is not reliably divisible across overlapping strategies without
 // independent fee-activity attribution. Never calculate P&L in this module.
 const feeActivities=activities.filter(a=>a.activity_type==='CFEE'||a.activity_type==='FEE').length;
 if(positions.some(p=>!canonical(p?.symbol)||!finite(p.qty)||
    Number(p.qty)<0))return fail('INVALID_SHARED_ACCOUNT_POSITION');
 const positionsBySymbol=new Set(positions.filter(p=>Number(p.qty)>0).map(p=>canonical(p.symbol)));
 const active=groups.DEMO.filter(x=>!x.final).concat(groups.TEACHER.filter(x=>!x.final));
 const activeRoles=new Set(active.map(x=>x.role));
 if(activeRoles.size>1)return fail('CONCURRENT_PAPER_EXECUTORS_CONFLICT');
 const filledOrders=orders.filter(o=>finite(o.filled_qty)&&Number(o.filled_qty)>0);
 if(filledOrders.some(o=>!fillOrders.has(o.id)))
   return fail('BROKER_FILL_ACTIVITY_MISSING');
 // A free-floating PAPER position cannot be assigned to either strategy just
 // because its symbol matches. Do not let either executor act on it.
 const pendingPosition=positionsBySymbol.size>0;
 const intentsById=new Map();
 for(const intent of frozenIntents){
  if(typeof intent?.clientOrderId!=='string'||intentsById.has(intent.clientOrderId)||
     !/^[a-f0-9]{64}$/.test(intent.modelSha256||'')||
     intent.paperOnly!==true||intent.readOnlyProvenance!==true||
     !byClientId.has(intent.clientOrderId)||
     byClientId.get(intent.clientOrderId).role!=='DEMO'||
     canonical(intent.symbol)!==byClientId.get(intent.clientOrderId).symbol)
    return fail('UNTRUSTED_MODEL_TO_ORDER_INTENT');
  intentsById.set(intent.clientOrderId,intent);
 }
 const unattributedDemo=groups.DEMO.filter(x=>!intentsById.has(x.clientOrderId)).length;
 const attributionComplete=unattributedDemo===0;
 // No paper orders may ever be granted by the observer. It cannot issue a
 // signed Teacher grade; that requires a separate full fee/P&L reconciler,
 // immutable model admission, risk marks and private signer.
 return {schema:'SCALP_SHARED_PAPER_OBSERVER_V1',
  status:'OBSERVED_NOT_GRADED',reason:'READ_ONLY_SHARED_ACCOUNT_AUDIT',
  paperOnly:true,readOnly:true,paperOrdersSubmitted:0,liveOrdersSubmitted:0,
  teacherGrades:0,forwardVerified:false,sharedAccountExecutionEnabled:false,
  accountVerified:true,brokerOrders:orders.length,openOrders:active.length,
  accountContainsOpenPositions:pendingPosition,
  lanes:{
   demo:{orders:groups.DEMO.length,recordedFillActivities:filledByRole.DEMO,
     modelBoundIntents:intentsById.size,unattributedIntents:unattributedDemo},
   teacher:{orders:groups.TEACHER.length,recordedFillActivities:filledByRole.TEACHER}
  },feeActivities,
  attributionComplete,canIndependentlyGrade:false,
  mustPreventSecondOrderWriter:true,
  handoffRequiresFlatInventoryAndNoPendingOrders:true,
  // Information only; never an activation token.
  readyForManualHandoffReview:active.length===0&&!pendingPosition&&attributionComplete,
  caveat:'Shared PAPER history can be attributed by order IDs, but aggregate positions and crypto fees require a single writer and broker-confirmed per-model evidence before official grading.'
 };
}
