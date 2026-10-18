import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {chronologicalReplay,auditCandidate} from './auditor.mjs';
import {signAdmission,verifyAdmission} from './admission-seal.mjs';
import {reconcilePaper} from './evidence.mjs';
import {DailyGBPReference} from './fx-reference.mjs';
import {virtualPaperEquity} from './risk-ledger.mjs';
import {makeReport,verifyReport,gradePupil} from './grade-pipeline.mjs';
import {freezeAdmission} from './engine.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const params={family:'ema_trend',fast:9,slow:34};
const pupil={symbol:'BTC/USD',researchLeader:{
 sourceExperimentId:'example-1',parameters:params,trainingNetGbp:10,
 trainingClosedTrades:60,trainedThrough:'2026-10-01T00:00:00Z',
 outOfSampleVerified:false
}};
const audit={source:'INDEPENDENT_CHRONOLOGICAL_HOLDOUT',
 symbol:'BTC/USD',modelExperimentId:'example-1',paramsDigest:hash(params),
 closedTrades:45,netGbp:4,doubleCostNetGbp:2,maxDrawdownPct:4,
 windowStart:'2026-10-01T00:00:00Z',windowEnd:'2026-10-08T00:00:00Z'};
const admission=freezeAdmission(pupil,audit,'2026-10-09T00:00:00Z');
const secret='123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const signed=signAdmission({admission,audit},secret);
const now=Date.parse('2026-10-18T12:00:00Z');
const bid='teacher-'+'a'.repeat(34),sid='teacher-'+'b'.repeat(34);
const orders=[
 {id:'buy-o',client_order_id:bid,symbol:'BTC/USD',side:'buy',
  status:'filled',filled_qty:'1',filled_avg_price:'100'},
 {id:'sell-o',client_order_id:sid,symbol:'BTC/USD',side:'sell',
  status:'filled',filled_qty:'0.99',filled_avg_price:'110'}
];
const activities=[
 {id:'f1',activity_type:'FILL',order_id:'buy-o',symbol:'BTC/USD',
  side:'buy',qty:'0.4',price:'100',transaction_time:'2026-10-10T10:00:00Z'},
 {id:'f2',activity_type:'FILL',order_id:'buy-o',symbol:'BTC/USD',
  side:'buy',qty:'0.6',price:'100',transaction_time:'2026-10-10T10:01:00Z'},
 {id:'fee1',activity_type:'CFEE',date:'2026-10-10',net_amount:'0',
  qty:'-0.01',price:'100',symbol:'BTCUSD'},
 {id:'f3',activity_type:'FILL',order_id:'sell-o',symbol:'BTC/USD',
  side:'sell',qty:'0.6',price:'110',transaction_time:'2026-10-11T10:00:00Z'},
 {id:'f4',activity_type:'FILL',order_id:'sell-o',symbol:'BTC/USD',
  side:'sell',qty:'0.39',price:'110',transaction_time:'2026-10-11T10:01:00Z'},
 {id:'fee2',activity_type:'FEE',date:'2026-10-11',net_amount:'-0.3',
  qty:'0',symbol:'BTCUSD'}
];
const props={symbol:'BTC/USD',modelId:admission.modelId,
 admissionStartedAt:admission.startedAt,
 orders,activities,journalOrderIds:new Set([bid,sid]),
 positions:[],openOrders:[],now,accountId:'paper-007'};

test('independently signed and version-bound admissions resist mutation',()=>{
 assert.equal(verifyAdmission(signed,secret).fingerprint,admission.fingerprint);
 assert.throws(()=>verifyAdmission({...signed,audit:{...audit,netGbp:-2}},secret),/changed/);
 assert.throws(()=>verifyAdmission({...signed,serverProof:'a'.repeat(64)},secret),/changed/);
 assert.throws(()=>verifyAdmission(signed,'wrong'),/key/);
});

test('no duplicate trial from buy or sell partial fills, crypto fee counted once',()=>{
 const e=reconcilePaper(props);
 assert.equal(e.status,'BROKER_RECONCILED');
 assert.equal(e.verifiedFillCount,4);
 assert.equal(e.closedTrades.length,1);
 assert.ok(Math.abs(e.closedTrades[0].buyUsd-100)<1e-8);
 assert.ok(Math.abs(e.closedTrades[0].sellUsd-108.9)<1e-8);
 assert.ok(Math.abs(e.feeEvidence.feesByCloseId[0].feeUsd-.3)<1e-8);
 assert.ok(e.closedTrades[0].closeId.startsWith('paper-roundtrip-'));
});
test('incomplete crypto settlement blocks and duplicate event or fake qty fails closed',()=>{
 assert.equal(reconcilePaper({...props,activities:activities.filter(x=>x.id!=='fee1')}).status,'EVIDENCE_PENDING');
 assert.equal(reconcilePaper({...props,now:Date.parse('2026-10-11T14:00:00Z')}).status,'EVIDENCE_PENDING');
 assert.equal(reconcilePaper({...props,orders:[...orders,{id:'manual',client_order_id:'manual',symbol:'BTC/USD',side:'buy',filled_qty:'0',status:'canceled'}]}).status,'EVIDENCE_PENDING');
 assert.throws(()=>reconcilePaper({...props,activities:[...activities,activities[0]]}),/duplicate/);
 assert.throws(()=>reconcilePaper({...props,orders:[{...orders[0],filled_qty:'20'},orders[1]]}),/quantity/);
});
test('separate $50 exposure ledger never uses Alpaca account default equity',()=>{
 const empty=virtualPaperEquity({symbol:'BTC/USD',orders:[],positions:[],
   ownedClientIds:new Set(),markPrice:100});
 assert.equal(empty.equity,50);
 const mark=virtualPaperEquity({symbol:'BTC/USD',
   orders:[{symbol:'BTC/USD',client_order_id:bid,side:'buy',
      filled_qty:'0.2',filled_avg_price:'100'}],
   positions:[{symbol:'BTC/USD',qty:'0.2'}],
   ownedClientIds:new Set([bid]),markPrice:95});
 assert.ok(mark.equity<50);assert.ok(mark.equity>45);
 assert.throws(()=>virtualPaperEquity({symbol:'BTC/USD',
   orders:[{symbol:'BTC/USD',client_order_id:'stranger',side:'buy',
      filled_qty:'1',filled_avg_price:'100'}],
   positions:[],ownedClientIds:new Set(),markPrice:100}),/unknown order/);
});
test('official-reference currency adapter rejects stale, malformed, future FX',async()=>{
 const remote=async()=>({ok:true,json:async()=>({base:'USD',date:'2026-10-09',rates:{GBP:.76}})});
 const client=new DailyGBPReference({fetchImpl:remote,now:()=>now});
 const rate=await client.on('2026-10-10T00:00:00Z');
 assert.equal(rate.gbpPerUsd,.76);
 await assert.rejects(client.on('2026-10-18T10:00:00Z'),/stale/);
 await assert.rejects(client.on('2030-01-01T00:00:00Z'),/future/);
});
test('auditor refuses research lineage without preserved training fingerprint',()=>{
 const snapshot={symbol:'BTC/USD',source:'ALPACA_KRAKEN_US_US-1',timeframe:'15Min',
   bars:Array.from({length:960},(_,i)=>({t:new Date(Date.parse('2026-09-20T00:00:00Z')+i*900000).toISOString(),
     o:100,h:101,l:99,c:100,v:10}))};
 const old={schema:'SCALP_RESEARCH_MEMORY_V1',experiments:[{
   id:'example-1',symbol:'BTC/USD',feed:'us-1',acceptedForLearning:true,
   trainingStart:'2026-09-20T00:00:00Z',trainingEnd:'2026-10-01T00:00:00Z',
   trainFingerprint:'a'.repeat(64),trainingOptions:[{params}]
 }]};
 assert.throws(()=>auditCandidate({memory:old,snapshot,pupil,
   fx:{source:'FRANKFURTER_ECB_REFERENCE',date:'2026-10-17',gbpPerUsd:.75},now}),/fingerprint/);
});
test('chronological replayer does not mistake zero returns for forward winnings',()=>{
 const bars=Array.from({length:400},(_,i)=>({t:i*900000,o:100,h:100,l:100,c:100,v:10}));
 const result=chronologicalReplay(bars,params,Date.parse('1970-01-03T00:00:00Z'));
 assert.equal(result.wins,0);
 assert.equal(result.closedTrades,0);
});

test('full adapter -> grade -> signature -> verify pathway stays ungraded below 30',async()=>{
 const [privateKey,publicKey]=(()=>{const k=generateKeyPairSync('ed25519');return[k.privateKey,k.publicKey]})();
 const broker={
  account:async()=>({status:'ACTIVE',id:'paper-007'}),
  recentOrders:async()=>orders,activities:async()=>activities,
  positions:async()=>[],openOrders:async()=>[]};
 const journal={unresolved:()=>[],orderIds:async()=>new Set([bid,sid])};
 const fx={on:async()=>({source:'FRANKFURTER_ECB_REFERENCE',date:'2026-10-11',gbpPerUsd:.78})};
 const grade=await gradePupil({record:signed,signingSecret:secret,broker,journal,fx,now});
 assert.equal(grade.status,'FORWARD_TESTING');
 assert.equal(grade.closedTrades,1);
 const bundle=await makeReport({records:[signed],signingSecret:secret,broker,journal,
  fx,publisherPrivateKey:privateKey,now});
 assert.equal(bundle.payload.verifiedCount,0);
 assert.equal(verifyReport(bundle,publicKey).pupils[0].status,'FORWARD_TESTING');
 assert.throws(()=>verifyReport({...bundle,payload:{...bundle.payload,verifiedCount:1}},publicKey),/signature invalid/);
});


test('full mocked 30-trade cohort earns signed grade only with reconciled real-style evidence',async()=>{
 const orders=[],activities=[],journalIds=new Set();
 const start=Date.parse('2026-10-10T02:00:00Z');
 const eachDay=new Map();
 for(let i=0;i<30;i++){
   const buyAt=new Date(start+i*3*3600_000).toISOString();
   const sellAt=new Date(start+(i*3+1)*3600_000).toISOString();
   const d=buyAt.slice(0,10),row=eachDay.get(d)||{buys:0,sells:0};
   row.buys++;row.sells++;eachDay.set(d,row);
   const buyId='buy-'+i,sellId='sell-'+i;
   const buyClient='teacher-'+hash(['b',i]).slice(0,34);
   const sellClient='teacher-'+hash(['s',i]).slice(0,34);
   journalIds.add(buyClient);journalIds.add(sellClient);
   orders.push({id:buyId,client_order_id:buyClient,symbol:'BTC/USD',
     side:'buy',status:'filled',filled_qty:'0.1',filled_avg_price:'100'});
   orders.push({id:sellId,client_order_id:sellClient,symbol:'BTC/USD',
     side:'sell',status:'filled',filled_qty:'0.0999',filled_avg_price:'102'});
   activities.push({id:'buy-fill-'+i,activity_type:'FILL',order_id:buyId,
     symbol:'BTC/USD',side:'buy',qty:'0.1',price:'100',transaction_time:buyAt});
   activities.push({id:'sell-fill-'+i,activity_type:'FILL',order_id:sellId,
     symbol:'BTC/USD',side:'sell',qty:'0.0999',price:'102',transaction_time:sellAt});
 }
 for(const [d,item] of eachDay){
   activities.push({id:'coin-fee-'+d,activity_type:'CFEE',date:d,
     net_amount:'0',qty:String(-0.0001*item.buys),price:'100',symbol:'BTCUSD'});
   activities.push({id:'cash-fee-'+d,activity_type:'FEE',date:d,
     net_amount:String(-0.02*item.sells),qty:'0',symbol:'BTCUSD'});
 }
 const reconciled=reconcilePaper({...props,orders,activities,journalOrderIds:journalIds});
 assert.equal(reconciled.closedTrades.length,30);
 const broker={account:async()=>({status:'ACTIVE',id:'paper-007'}),
   recentOrders:async()=>orders,activities:async()=>activities,
   positions:async()=>[],openOrders:async()=>[]};
 const journal={unresolved:()=>[],orderIds:async()=>journalIds};
 const fx={on:async()=>({source:'FRANKFURTER_ECB_REFERENCE',
   date:'2026-10-14',gbpPerUsd:.78})};
 const pair=generateKeyPairSync('ed25519');
 const signedReport=await makeReport({records:[signed],signingSecret:secret,
   broker,journal,fx,publisherPrivateKey:pair.privateKey,now});
 const outcome=verifyReport(signedReport,pair.publicKey);
 assert.equal(outcome.verifiedCount,1);
 assert.equal(outcome.pupils[0].status,'VERIFIED_FORWARD_GRADE');
 assert.equal(outcome.pupils[0].grade,10);
 assert.equal(outcome.pupils[0].wins,30);
 assert.equal(outcome.pupils[0].qualified,true);
 assert.ok(outcome.pupils[0].netProfitGbp>0);
 assert.match(outcome.pupils[0].evidenceHash,/^[0-9a-f]{64}$/);
});

test('Academy uses pinned public signature verification, never trusts JSON alone',async()=>{
 const {readFile}=await import('node:fs/promises');
 const html=await readFile(new URL('../robot-academy.html',import.meta.url),'utf8');
 const settings=JSON.parse(await readFile(new URL('./public-settings.json',import.meta.url),'utf8'));
 assert.match(html,/crypto\.subtle\.verify\('Ed25519'/);
 assert.match(html,/signingPublicKeyBase64/);
 assert.match(html,/signatureValid/);
 assert.match(html,/ROBOT_ACADEMY_SIGNED_FORWARD_V1/);
 assert.match(html,/report\.verifiedCount/);
 assert.match(html,/if\(verified\)return/);
 assert.equal(settings.status,'NOT_PROVISIONED');
 assert.equal(settings.signingPublicKeyBase64,null);
});
