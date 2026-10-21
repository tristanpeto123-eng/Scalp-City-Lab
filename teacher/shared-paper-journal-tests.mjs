import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyPrivatePaperJournal,observeSharedPaperAccount} from './shared-paper-journal.mjs';

const client='SCALPDEMO5M-'+'a'.repeat(31);
const sha=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'scalp-shared-'));
 const snippet=[
  'from paper_sandbox.shared_ledger import PaperIntentJournal',
  'import hashlib,sys',
  'j=PaperIntentJournal(sys.argv[1])',
  'with j.writer():',
  ' j.append("INTENT",{"clientOrderId":"'+client+'","symbol":"BTC/USD","side":"buy",',
  '  "modelSha256":"'+('b'.repeat(64))+'","accountFingerprint":hashlib.sha256(b"paper-007").hexdigest(),',
  '  "sourceCandleMs":1792540200000,"maxOrderUsd":"10.00","paperOnly":True,"liveOrders":0})',
  ' j.append("ACK",{"clientOrderId":"'+client+'","brokerOrderId":"broker-p-01",',
  '  "providerStatus":"filled","paperOnly":True})',
 ].join('\n');
 const proc=spawnSync('python',['-c',snippet,root],{encoding:'utf8'});
 if(proc.status!==0){await rm(root,{recursive:true,force:true});
  throw Error('Python fixture not valid: '+proc.stderr);}
 return {root,content:await readFile(join(root,'paper-intents.jsonl'),'utf8')};
}
const account={id:'paper-007',status:'ACTIVE',currency:'USD',
  trading_blocked:false,account_blocked:false};
const demoOrder={id:'broker-p-01',client_order_id:client,symbol:'BTC/USD',
  side:'buy',status:'filled',filled_qty:'0.05'};
const demoFill={id:'fill-01',order_id:'broker-p-01',symbol:'BTC/USD',
  activity_type:'FILL',side:'buy',qty:'0.05',price:'100',
  transaction_time:'2026-10-20T12:00:00Z'};
const teacherId='teacher-'+'c'.repeat(34);
const teacherOrder={id:'teacher-broker-1',client_order_id:teacherId,symbol:'ETH/USD',
 side:'buy',status:'filled',filled_qty:'0.01'};
const teacherFill={id:'teacher-fill-01',order_id:'teacher-broker-1',symbol:'ETH/USD',
 activity_type:'FILL',side:'buy',qty:'0.01',price:'100',
 transaction_time:'2026-10-20T13:00:00Z'};
function input(content,other={}){
 return {journalText:content,account,expectedAccountId:account.id,
   orders:[demoOrder,teacherOrder],positions:[],openOrders:[],
   activities:[demoFill,teacherFill],ordersComplete:true,
   activitiesComplete:true,...other};
}
test('Python-written journal verifies in independent Node Teacher and binds one existing PAPER account',async()=>{
 const {root,content}=await fixture();
 try{
  const journal=verifyPrivatePaperJournal(content);
  assert.equal(journal.records.length,2);
  assert.equal(journal.intents.length,1);
  assert.equal(journal.acknowledgements.length,1);
  assert.deepEqual(journal.unresolved,[]);
  assert.equal(journal.intents[0].accountFingerprint,sha('paper-007'));
  const d=observeSharedPaperAccount(input(content));
  assert.equal(d.status,'OBSERVED_NOT_GRADED');
  assert.equal(d.lanes.demo.orders,1);
  assert.equal(d.lanes.teacher.orders,1);
  assert.equal(d.lanes.demo.recordedFillActivities,1);
  assert.equal(d.lanes.teacher.recordedFillActivities,1);
  assert.equal(d.privateJournalHashVerified,true);
  assert.equal(d.forwardVerified,false);
  assert.equal(d.canIndependentlyGrade,false);
  assert.equal(d.teacherGrades,0);
  assert.equal(d.brokerWrites,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('tampered private ledger cannot certify a model or an account',async()=>{
 const {root,content}=await fixture();
 try{
  assert.throws(()=>verifyPrivatePaperJournal(content.replace('BTC/USD','SOL/USD')),/hash chain modified/);
  assert.throws(()=>verifyPrivatePaperJournal(content.slice(0,-1)),/truncated/);
  assert.equal(observeSharedPaperAccount(input(content,{expectedAccountId:'other-account'})).status,'BLOCKED');
  assert.equal(observeSharedPaperAccount(input(content,{ordersComplete:false})).status,'BLOCKED');
  assert.equal(observeSharedPaperAccount(input(content,{orders:[{...demoOrder,id:'unknown'},teacherOrder]})).status,'BLOCKED');
  assert.equal(observeSharedPaperAccount(input(content,{activities:[demoFill]})).status,'BLOCKED');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('shared Teacher adapter is pure read-only and cannot publish a grade or submit paper',async()=>{
 const code=await readFile(new URL('./shared-paper-journal.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/fetch\(|paperOrder\(|\/v2\/orders|api\.alpaca\.markets/);
 assert.match(code,/canIndependentlyGrade:false/);
 assert.match(code,/teacherGrades:0/);
 assert.match(code,/brokerWrites:0/);
});
