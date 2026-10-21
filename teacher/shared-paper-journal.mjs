// Independent Teacher side of the SHARED Alpaca PAPER account.
// Hash-chain validation, exact demo model/order provenance, and a READ-ONLY
// broker observer. Zero broker credentials, requests, payments or grade access.
import {createHash} from 'node:crypto';
import {classifySharedPaperHistory} from './shared-paper-observer.mjs';

const SCHEMA='SCALP_PAPER_INTENT_CHAIN_V1';
const GENESIS='0'.repeat(64);
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const canonical=x=>JSON.stringify(x,(_,v)=>{
  if(v!==null&&typeof v==='object'&&!Array.isArray(v))
    return Object.fromEntries(Object.keys(v).sort().map(key=>[key,v[key]]));
  return v;
});
const error=x=>{throw Error('SHARED_PAPER_OBSERVER: '+x)};
export function verifyPrivatePaperJournal(text){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>8*1024*1024||
    (text.length>0&&!text.endsWith('\n')))
  error('Untrusted/truncated private broker order journal');
 const records=[],used=new Set(),acked=new Set();let prev=GENESIS;
 for(const [n,line] of text.split('\n').filter(Boolean).entries()){
  if(!/^[\x20-\x7e]+$/.test(line))error('Non-ascii/private data in journal');
  let obj;try{obj=JSON.parse(line);}catch{error('Invalid journal JSON');}
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
     Object.keys(obj).sort().join('|')!=='data|kind|prev|schema|seq|sha256'||
     obj.schema!==SCHEMA||obj.seq!==n+1||obj.prev!==prev||
     !['INTENT','ACK'].includes(obj.kind)||!obj.data||
     !hex64(obj.sha256))
    error('Journal chain structure inconsistent');
  const {sha256,...unsigned}=obj;
  if(sha(canonical(unsigned))!==sha256)error('Journal hash chain modified');
  const e=obj.data,client=e.clientOrderId;
  if(typeof client!=='string'||!/^SCALPDEMO5M-[a-f0-9]{31}$/.test(client))
    error('Unknown private paper namespace');
  if(obj.kind==='INTENT'){
   if(used.has(client)||!hex64(e.modelSha256)||!hex64(e.accountFingerprint)||
      !['buy','sell'].includes(e.side)||
      !/^[A-Z]+\/USD$/.test(e.symbol)||
      !Number.isSafeInteger(e.sourceCandleMs)||e.sourceCandleMs<1||
      e.maxOrderUsd!=='10.00'||e.paperOnly!==true||e.liveOrders!==0)
     error('Unsigned or duplicated model-bound PAPER order intent');
   used.add(client);
  }else{
   if(!used.has(client)||acked.has(client)||
      !records.length||records.at(-1).kind!=='INTENT'||
      records.at(-1).data.clientOrderId!==client||
      typeof e.brokerOrderId!=='string'||!e.brokerOrderId||
      typeof e.providerStatus!=='string'||!e.providerStatus||
      e.paperOnly!==true)error('Broker ACK not bound to sole preceding intent');
   acked.add(client);
  }
  records.push(obj);prev=sha256;
 }
 return {records,latestChainHash:prev,
   intents:records.filter(x=>x.kind==='INTENT').map(x=>x.data),
   acknowledgements:records.filter(x=>x.kind==='ACK').map(x=>x.data),
   unresolved:[...used].filter(x=>!acked.has(x))};
}
export function observeSharedPaperAccount({
  journalText,account,expectedAccountId,orders,positions,
  openOrders,activities,ordersComplete,activitiesComplete
}={}){
 const j=verifyPrivatePaperJournal(journalText);
 if(j.unresolved.length)return {status:'BLOCKED',
  reason:'UNRESOLVED_PRIVATE_BROKER_INTENT',
  paperOnly:true,teacherGrades:0,brokerWrites:0,forwardVerified:false};
 const fingerprint=sha(expectedAccountId||'');
 if(j.intents.some(i=>i.accountFingerprint!==fingerprint))
  return {status:'BLOCKED',reason:'JOURNAL_ACCOUNT_ID_MISMATCH',
    paperOnly:true,teacherGrades:0,brokerWrites:0,forwardVerified:false};
 const receipts=new Map(j.acknowledgements.map(a=>[a.clientOrderId,a]));
 const history=orders||[];
 if(!Array.isArray(history))error('Broker orders must be an array');
 for(const intent of j.intents){
  const matches=history.filter(x=>x.client_order_id===intent.clientOrderId);
  if(matches.length!==1||matches[0].id!==receipts.get(intent.clientOrderId)?.brokerOrderId||
     matches[0].side!==intent.side||
     String(matches[0].symbol||'').replace('/','')!==intent.symbol.replace('/',''))
    return {status:'BLOCKED',reason:'BROKER_RECEIPT_JOURNAL_DISAGREEMENT',
      paperOnly:true,teacherGrades:0,brokerWrites:0,forwardVerified:false};
 }
 const checked=classifySharedPaperHistory({
  account,expectedAccountId,orders:history,positions,openOrders,activities,
  ordersComplete,activitiesComplete,
  frozenIntents:j.intents.map(i=>({
    clientOrderId:i.clientOrderId,modelSha256:i.modelSha256,
    symbol:i.symbol,paperOnly:true,readOnlyProvenance:true
  }))
 });
 return {...checked,source:'VERIFIED_PRIVATE_PAPER_HASH_CHAIN',
   latestChainHash:j.latestChainHash,
   journalIntentCount:j.intents.length,
   privateJournalHashVerified:true,brokerWrites:0,
   canIndependentlyGrade:false,teacherGrades:0,forwardVerified:false};
}
