import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readiness,freezeAdmission,closedSignal,evaluateGrade,Teacher} from './engine.mjs';
import {CryptoTeacherBroker} from './alpaca-crypto.mjs';
import {TeacherJournal,reviewConfiguration,RELEASE} from './runtime.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const started='2026-10-10T00:00:00Z';
const params={family:'ema_trend',fast:9,slow:34};
const pupil={symbol:'BTC/USD',researchLeader:{
  sourceExperimentId:'sample-training-experiment',
  trainingNetGbp:2,trainingClosedTrades:42,outOfSampleVerified:false,
  trainedThrough:'2026-10-01T00:00:00Z',parameters:params
}};
const audit={source:'INDEPENDENT_CHRONOLOGICAL_HOLDOUT',symbol:'BTC/USD',
  modelExperimentId:'sample-training-experiment',paramsDigest:hash(params),
  closedTrades:36,netGbp:2,doubleCostNetGbp:.5,maxDrawdownPct:5,
  windowStart:'2026-10-02T00:00:00Z',windowEnd:'2026-10-08T00:00:00Z'};
const admission=freezeAdmission(pupil,audit,started);
test('loss-making research pupils cannot enter forward exam',()=>{
  const bad=readiness({...pupil,researchLeader:{...pupil.researchLeader,trainingNetGbp:-2}},audit);
  assert.equal(bad.ready,false);
  assert.equal(readiness({...pupil,researchLeader:null},audit).ready,false);
  assert.equal(readiness(pupil,{...audit,doubleCostNetGbp:-1}).ready,false);
  assert.equal(readiness(pupil,{...audit,windowStart:'2026-09-01T00:00:00Z'}).ready,false);
  assert.equal(readiness(pupil,audit).ready,true);
});
test('examination locks a model to the independently approved version',()=>{
  assert.throws(()=>freezeAdmission(pupil,audit,'2026-10-06T00:00:00Z'),/after sealed audit/);
  assert.equal(Object.isFrozen(admission),true);
  assert.equal(Object.isFrozen(admission.parameters),true);
});
test('grades need 30 unique closed paper round trips, settled fees and GBP FX',()=>{
  const one=(i,pnl=1)=>({closeId:'close-'+i,openedAt:'2026-10-11T00:00:00Z',
    closedAt:'2026-10-12T00:00:00Z',buyUsd:10,sellUsd:10+pnl});
  const make=n=>({verifiedByPaperBroker:true,symbol:'BTC/USD',
    modelId:admission.modelId,unattributedOrders:0,hasOpenExposure:false,
    hasPendingOrders:false,closedTrades:Array.from({length:n},(_,i)=>one(i))});
  const fees=n=>({complete:true,settled:true,feesByCloseId:Array.from({length:n},(_,i)=>
    ({id:'close-'+i,feeUsd:.05}))});
  const fx=n=>({verified:true,source:'ECB_REFERENCE',ratesByCloseId:Array.from({length:n},(_,i)=>
    ({id:'close-'+i,gbpPerUsd:.75}))});
  assert.equal(evaluateGrade({admission,brokerEvidence:make(29),feeEvidence:fees(29),fxEvidence:fx(29)}).grade,null);
  const pass=evaluateGrade({admission,brokerEvidence:make(30),feeEvidence:fees(30),fxEvidence:fx(30)});
  assert.equal(pass.grade,10);assert.equal(pass.closedTrades,30);assert.equal(pass.qualified,true);
  assert.equal(pass.championModel,null);
  assert.equal(evaluateGrade({admission,brokerEvidence:make(30),feeEvidence:{settled:false},fxEvidence:fx(30)}).grade,null);
  assert.equal(evaluateGrade({admission,brokerEvidence:make(30),feeEvidence:fees(30),fxEvidence:{verified:false}}).grade,null);
  const losing=make(30);for(let i=0;i<3;i++)losing.closedTrades[i].sellUsd=1;
  const result=evaluateGrade({admission,brokerEvidence:losing,feeEvidence:fees(30),fxEvidence:fx(30)});
  assert.equal(result.grade,9);assert.equal(result.qualified,false);assert.ok(result.netProfitGbp<0);
  const duplicate=make(30);duplicate.closedTrades[1].closeId='close-0';
  assert.throws(()=>evaluateGrade({admission,brokerEvidence:duplicate,feeEvidence:fees(30),fxEvidence:fx(30)}),/duplicate/);
  const tampered={...admission,modelId:'changed'};
  assert.throws(()=>evaluateGrade({admission:tampered,brokerEvidence:make(30),feeEvidence:fees(30),fxEvidence:fx(30)}),/modified/);
});
test('paper adapter only permits prechecked ioc orders at paper URL',async()=>{
  const requests=[];
  const fetchImpl=async(url,req)=>{requests.push({url,req});return{
    ok:true,status:200,json:async()=>({id:'paper-1',status:'accepted'})}};
  const broker=new CryptoTeacherBroker({credentials:{'BTC/USD':{key:'paper',secret:'test'}},fetchImpl});
  const order={symbol:'BTC/USD',side:'buy',type:'market',time_in_force:'ioc',
    client_order_id:'teacher-'+'b'.repeat(34),notional:'10.00'};
  await broker.paperOrder('BTC/USD',order);
  assert.equal(requests[0].url,'https://paper-api.alpaca.markets/v2/orders');
  assert.equal(requests[0].req.method,'POST');
  assert.throws(()=>broker.paperOrder('BTC/USD',{...order,time_in_force:'day'}),/invalid/);
  assert.throws(()=>broker.paperOrder('BTC/USD',{...order,symbol:'ETH/USD'}),/invalid/);
  assert.equal(requests.filter(x=>x.req.method==='POST').length,1);
});
test('service rejects missing explicit approval, reused paper account keys',()=>{
  const c={'BTC/USD':{key:'one',secret:'a'},'ETH/USD':{key:'one',secret:'b'}};
  assert.throws(()=>reviewConfiguration({admissions:[admission],credentials:c,enabled:true,approval:''}),/approval absent/);
  const eth={...admission,symbol:'ETH/USD'};
  assert.throws(()=>reviewConfiguration({admissions:[admission,eth],credentials:c,enabled:false}),/must be separate/);
  assert.equal(reviewConfiguration({admissions:[admission],credentials:c,enabled:true,approval:RELEASE}),true);
});
test('teacher never orders if no pupil is admitted, and dry-runs ready pupils',async()=>{
  const now=Date.parse('2026-10-18T12:15:40Z');
  let price=100;
  const bars=Array.from({length:600},(_,i)=>{
    const t=now-(600-i)*900000-50000;
    const o=price;price*=1.00003;
    return {t:new Date(t).toISOString(),o,c:price,h:Math.max(o,price)*1.01,
      l:Math.min(o,price)*.99,v:100};
  });
  const journal={hasBar:async()=>false,hasIntent:async()=>false,
    peakEquity:async()=>100000,observe:async()=>{},orderIds:async()=>new Set(),
    peakVirtual:async()=>50,openVirtualToday:async()=>50,virtual:async()=>{},
    bar:async()=>{},intent:async()=>{throw Error('should not submit')},
    ack:async()=>{throw Error('should not submit')}};
  const broker={account:async()=>({status:'ACTIVE',equity:'100000',last_equity:'100000',
      non_marginable_buying_power:'1000'}),
    positions:async()=>[],openOrders:async()=>[],asset:async()=>({symbol:'BTC/USD',
      class:'crypto',tradable:true,marginable:false,shortable:false,min_order_size:'0.0001'}),
    recentOrders:async()=>[],history:async()=>({symbol:'BTC/USD',source:'ALPACA_KRAKEN_US_US-1',
      timeframe:'15Min',bars}),orderByClientId:async()=>null};
  const no=new Teacher({broker,journal,admissions:[],now:()=>now});
  assert.equal((await no.cycle('BTC/USD')).status,'NOT_READY');
  const teacher=new Teacher({broker,journal,admissions:[admission],now:()=>now});
  const r=await teacher.cycle('BTC/USD');
  assert.equal(r.status,'DRY_RUN');assert.equal(r.proposed.time_in_force,'ioc');
});
test('durable hash-chain journal rejects edits and retains order-intent proof',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'scalp-teacher-test-'));
  try{
    const a=new TeacherJournal(dir);await a.init();await a.observe('BTC/USD',100);
    await a.intent('teacher-'+('a'.repeat(34)),{symbol:'BTC/USD'});
    assert.equal(await a.hasIntent('teacher-'+('a'.repeat(34))),true);
    const b=new TeacherJournal(dir);await b.init();assert.equal(b.unresolved().length,1);
    assert.equal(await b.peakEquity('BTC/USD'),100);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('signals cannot work without actual warmup market history',()=>{
  assert.throws(()=>closedSignal([],params),/warmup/);
});
