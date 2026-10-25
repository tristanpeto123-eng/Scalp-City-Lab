import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseDiscoveryCSV,discoverOpportunities,FIFTEEN_MINUTES} from './opportunity-discovery.mjs';
import {trainAcademyTeacher,predictTeacher} from './teacher-training.mjs';
import {importCommodityTrainingSet} from '../scripts/import-commodity-training-set.mjs';
const first=Date.parse('2025-04-01T00:00:00Z');
const bars=Array.from({length:3400},(_,i)=>{
 const o=31+Math.sin(i*.08)*.6+Math.cos(i*.02)*.8+i*.0001;
 const c=o+Math.sin(i*.23)*.04;
 return {t:new Date(first+i*FIFTEEN_MINUTES).toISOString(),
  o,h:Math.max(o,c)+.05,l:Math.min(o,c)-.05,c,v:null};
});
const csv=['time,open,high,low,close',...bars.map(b=>[b.t,b.o,b.h,b.l,b.c].join(','))].join('\n');
test('15Min original gold and silver candles stay on 15Min grid',()=>{
 const source=parseDiscoveryCSV(csv,{timeframe:'15Min'});
 assert.equal(source.length,bars.length);
 assert.throws(()=>parseDiscoveryCSV(csv,{timeframe:'5Min'}),/Unordered|duplicate|Invalid|5Min|off|completed|interval/i);
});
test('Teacher uses separate gold/silver models on same native timeframe',()=>{
 const gold=discoverOpportunities({bars,symbol:'XAUUSD',timeframe:'15Min'});
 const silver=discoverOpportunities({bars,symbol:'XAGUSD',timeframe:'15Min'});
 assert.equal(gold.timeframe,'15Min');
 assert.equal(silver.timeframe,'15Min');
 const g=trainAcademyTeacher(gold),s=trainAcademyTeacher(silver);
 assert.equal(g.checkpoint.symbol,'XAUUSD');
 assert.equal(s.checkpoint.symbol,'XAGUSD');
 assert.equal(g.checkpoint.timeframe,'15Min');
 assert.equal(s.checkpoint.timeframe,'15Min');
 assert.notEqual(g.report.checkpointSha256,s.report.checkpointSha256);
 assert.equal(g.checkpoint.enabledForBroker,false);
 assert.equal(s.checkpoint.enabledForBroker,false);
 assert.throws(()=>predictTeacher(g.checkpoint,silver.opportunities[0]),/Wrong commodity/);
 assert.equal(g.report.independentFinalTestEvaluated,false);
 assert.equal(s.report.independentFinalTestEvaluated,false);
});
test('15Min sealed holdout prices never influence Teacher training',()=>{
 const source=discoverOpportunities({bars,symbol:'XAGUSD',timeframe:'15Min'});
 const mutated=bars.map((b,i)=>i<2720?b:{...b,o:b.o+5,h:b.h+5,l:b.l+5,c:b.c+5});
 const altered=discoverOpportunities({bars:mutated,symbol:'XAGUSD',timeframe:'15Min'});
 assert.deepEqual(source.opportunities,altered.opportunities);
 assert.equal(trainAcademyTeacher(source).report.checkpointSha256,
              trainAcademyTeacher(altered).report.checkpointSha256);
});
test('separate source import creates immutable manifest and a blocked broker checkpoint',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'academy-15m-'));
 try{
  const src=join(dir,'old-gold-15m.csv'),output=join(dir,'out');
  await writeFile(src,csv);
  const r=await importCommodityTrainingSet(src,{symbol:'XAUUSD',outputDir:output});
  assert.equal(r.manifest.symbol,'XAUUSD');
  assert.equal(r.manifest.sourceRedistributed,false);
  assert.equal(r.manifest.sourceVerified,false);
  assert.equal(r.manifest.timeframe,'15Min');
  assert.equal(r.manifest.brokerOrders,0);
  assert.equal(r.manifest.sealedTestEvaluated,false);
  const file=join(output,r.manifest.experimentId+'-checkpoint.json');
  const model=JSON.parse(await readFile(file,'utf8'));
  assert.equal(model.enabledForBroker,false);
  await assert.rejects(importCommodityTrainingSet(src,{symbol:'XAUUSD',outputDir:output}),/EEXIST/);
 }finally{await rm(dir,{recursive:true,force:true});}
});