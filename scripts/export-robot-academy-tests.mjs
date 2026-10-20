import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAcademySnapshot,exportAcademyFile,PAIRS} from './export-robot-academy.mjs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const start='2026-01-01T00:00:00Z',end='2026-01-31T00:00:00Z';
const make=(symbol,id,independent,options,trainingEnd=end)=>({
 id:id.repeat(64),symbol,feed:'us-1',
 trainingStart:start,trainingEnd,trainFingerprint:id.repeat(64),
 acceptedForLearning:independent,trainingOptions:options,
 behavior:{descriptiveRegime:'MIXED_OR_RANGE'}
});
const opt=(family,trades,rate,net,p={})=>({
 params:family==='ema_trend'?{family,fast:9,slow:34,...p}:
  family==='rsi_reversion'?{family,period:14,buyBelow:30,sellAbove:65,...p}:
  {family,lookback:20,exitLookback:10,...p},
 closedTrades:trades,winRatePct:rate,netProfitGbp:net,trainingScore:null
});
const sample={
 schema:'SCALP_RESEARCH_MEMORY_V1',policy:'GBP50-PROFIT2000-v2',
 experiments:[
  make('BTC/USD','a',true,[opt('ema_trend',40,80,-10),opt('rsi_reversion',30,33.33,-2.5)]),
  make('BTC/USD','b',false,[opt('channel_breakout',50,52,-5),opt('ema_trend',45,60,-1.5,{fast:12,slow:48})]),
  make('ETH/USD','c',true,[opt('ema_trend',9,100,5)])
 ]};
test('ten pair identities and training-only provenance',()=>{
 const x=buildAcademySnapshot(sample);
 assert.equal(PAIRS.length,10);
 assert.equal(x.pupils.length,10);
 assert.equal(x.source,'GITHUB_PERSISTED_HISTORICAL_TRAINING');
 assert.equal(x.verifiedForwardGrades,0);
 assert.equal(x.actualBrokerOrders,0);
 assert.match(x.sourceDigest,/^[a-f0-9]{64}$/);
 assert.equal(x.pupils.every(p=>p.source==='HISTORICAL_TRAINING_RESEARCH'),true);
 assert.equal(x.pupils.every(p=>p.championModel===null&&p.confirmedForward===false),true);
});
test('Teacher candidate can only originate from accepted independent learning window',()=>{
 const x=buildAcademySnapshot(sample),btc=x.pupils[0];
 assert.equal(btc.researchLeader.family,'rsi_reversion');
 assert.equal(btc.researchLeader.parameters.period,14);
 assert.equal(btc.researchLeader.trainingNetGbp,-2.5);
 assert.equal(btc.researchLeader.trainingWinRatePct,33.33);
 assert.equal(btc.researchLeader.trainingClosedTrades,30);
 assert.equal(btc.researchLeader.sourceExperimentId,'a'.repeat(64));
 assert.equal(btc.researchLeader.status,'TRAINING_LOSS_MAKING');
 assert.equal(btc.evidenceStatus,'PROVISIONAL_TRAINING_ONLY');
 assert.equal(btc.championModel,null);
 assert.equal(btc.generations.length,2);
 assert.deepEqual(btc.generations.map(g=>g.grade),[3,3]);
 assert.equal(btc.experiments,2);
 assert.equal(btc.independentTrainingWindows,1);
 assert.equal(btc.distinctStrategiesTried,4);
 assert.equal(btc.generations[1].independentWindow,false);
});
test('high win rate does not override missing or loss-making evidence',()=>{
 const x=buildAcademySnapshot(sample);
 const eth=x.pupils.find(p=>p.symbol==='ETH/USD');
 assert.equal(eth.researchLeader,null);
 assert.equal(eth.evidenceStatus,'NO_ELIGIBLE_TRAINING_SAMPLE');
 assert.equal(eth.generations[0].grade,null);
 const btc=x.pupils[0];
 assert.equal(btc.championModel,null);
 assert.equal(btc.researchLeader.status,'TRAINING_LOSS_MAKING');
 const absent=x.pupils.find(p=>p.symbol==='SOL/USD');
 assert.equal(absent.experiments,0);
 assert.equal(absent.researchLeader,null);
});
test('rejects corrupted memory, duplicated experiment and market feed confusion',()=>{
 assert.throws(()=>buildAcademySnapshot({...sample,policy:'other'}),/Unrecognized/);
 assert.throws(()=>buildAcademySnapshot({...sample,experiments:[sample.experiments[0],sample.experiments[0]]}),/duplicate/);
 assert.throws(()=>buildAcademySnapshot({...sample,experiments:[{...sample.experiments[0],symbol:'BTC/USDT'}]}),/Malformed/);
 assert.throws(()=>buildAcademySnapshot({...sample,experiments:[{...sample.experiments[0],feed:'us'}]}),/Malformed/);
 assert.throws(()=>buildAcademySnapshot({...sample,experiments:[{...sample.experiments[0],trainingOptions:[opt('ema_trend',40,110,-2)]}]}),/Invalid research/);
});
test('deterministic snapshot and model shape across identical training history',()=>{
 assert.deepEqual(buildAcademySnapshot(sample),buildAcademySnapshot(structuredClone(sample)));
});
test('exporter produces parseable published JSON with no credentials or orders',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'academy-test-'));
 try{
  const input=path.join(dir,'history.json'),output=path.join(dir,'academy.json');
  await writeFile(input,JSON.stringify(sample));
  const meta=await exportAcademyFile({input,output});
  assert.equal(meta.verifiedForwardGrades,0);
  const result=JSON.parse(await readFile(output,'utf8'));
  assert.equal(meta.linkedPupils,1);
  assert.equal(result.pupils.length,10);
  assert.equal(result.pupils[0].championModel,null);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('provisional lesson lineage shows saved historical parent without declaring it a verified champion',()=>{
 const seeded={...sample,experiments:[sample.experiments[0],{
  ...sample.experiments[1],
  parentResearchModel:{params:{family:'rsi_reversion',period:14,buyBelow:30,sellAbove:65},
   previousNetGbp:-2.5,sourceExperimentId:'a'.repeat(64),
   confirmedChampion:false}
 }]};
 const result=buildAcademySnapshot(seeded);
 const btc=result.pupils.find(p=>p.symbol==='BTC/USD');
 assert.equal(btc.generations[1].parentStrategy,'RSI 14 / 30/65');
 assert.equal(btc.generations[1].parentHistoricalNetGbp,-2.5);
 assert.equal(btc.championModel,null);
 assert.equal(btc.confirmedForward,false);
});

test('unaccepted repeated history cannot replace accepted leader, even with extraordinary profits',()=>{
 const repeated=make('BTC/USD','d',false,[opt('ema_trend',200,98,999)],
  '2026-02-01T00:00:00Z');
 const report=buildAcademySnapshot({...sample,experiments:[...sample.experiments,repeated]});
 const btc=report.pupils[0];
 assert.equal(btc.researchLeader.sourceExperimentId,'a'.repeat(64));
 assert.equal(btc.researchLeader.trainingNetGbp,-2.5);
 assert.equal(btc.generations.at(-1).testedConfigurations,1);
 assert.equal(btc.confirmedForward,false);
 assert.equal(report.actualBrokerOrders,0);
});
