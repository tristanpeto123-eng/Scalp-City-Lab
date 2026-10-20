import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {
 PAIRS,checkMemory,selectHistoricalParent,proposeResearchLesson,runResearchLesson,
 evaluateAll,fetchMemory,persistMemory,RESEARCH_LIMITS
} from './run-robot-training.mjs';
const now=Date.parse('2026-10-18T00:30:00Z');
const begin=Date.parse('2026-08-20T00:00:00Z');
const count=1500;
const snapshots=new Map(PAIRS.map((symbol,index)=>[symbol,{
 symbol,timeframe:'15Min',source:'ALPACA_KRAKEN_US_US-1',
 feed:'us-1',generatedAt:new Date(now-60000).toISOString(),
 bars:Array.from({length:count},(_,i)=>{
  const a=100+10*Math.sin(i/9+index),b=100+10*Math.sin((i+1)/9+index);
  return {t:new Date(begin+i*900000).toISOString(),o:a,c:b,
   h:Math.max(a,b)*1.001,l:Math.min(a,b)*.999,v:100+i%17};
 })
}]));
const parent={params:{family:'ema_trend',fast:9,slow:34},
 closedTrades:48,netProfitGbp:-1.5,winRatePct:45.83,trainingScore:null};
const oldRecord={
 id:'a'.repeat(64),symbol:'BTC/USD',feed:'us-1',
 trainingStart:'2026-07-01T00:00:00Z',
 trainingEnd:'2026-08-01T00:00:00Z',
 trainFingerprint:'b'.repeat(64),
 acceptedForLearning:true,
 trainingOptions:[
  {...parent}, // We have a historical losing reference, not a champion.
  {params:{family:'rsi_reversion',period:14,buyBelow:30,sellAbove:60},
   closedTrades:45,netProfitGbp:-3,winRatePct:66.67,trainingScore:null}
 ]};
const empty={schema:'SCALP_RESEARCH_MEMORY_V1',policy:'GBP50-PROFIT2000-v2',experiments:[]};
const memory={...empty,experiments:[oldRecord]};
test('seeds from highest NET GBP research result, not maximum win-rate or invented champion',()=>{
 const result=selectHistoricalParent(memory,'BTC/USD');
 assert.equal(result.params.family,'ema_trend');
 assert.equal(result.params.fast,9);
 assert.equal(result.netProfitGbp,-1.5);
 assert.equal(result.status,'LOSS_MAKING_RESEARCH_PARENT');
 assert.equal(result.confirmedChampion,false);
 assert.equal(result.forwardValidated,false);
 assert.equal(selectHistoricalParent(memory,'ETH/USD'),null);
});
test('per-chart model parent never inherits a different chart',()=>{
 const eth={...oldRecord,id:'c'.repeat(64),symbol:'ETH/USD',
  trainingOptions:[{params:{family:'channel_breakout',lookback:20,exitLookback:10},
   closedTrades:40,netProfitGbp:2,winRatePct:40,trainingScore:1}]};
 const combo={...empty,experiments:[oldRecord,eth]};
 assert.equal(selectHistoricalParent(combo,'BTC/USD').params.family,'ema_trend');
 assert.equal(selectHistoricalParent(combo,'ETH/USD').params.family,'channel_breakout');
 assert.notEqual(selectHistoricalParent(combo,'BTC/USD').experimentId,
  selectHistoricalParent(combo,'ETH/USD').experimentId);
});
test('one research lesson tests bounded mutations around a saved historical parent',()=>{
 const dataset=snapshots.get('BTC/USD');
 const run=runResearchLesson(memory,{snapshot:dataset,symbol:'BTC/USD',now});
 assert.equal(run.changed,true);
 assert.equal(run.testedParams,6);
 assert.equal(run.holdoutUsedForSelection,false);
 assert.equal(run.brokerOrders,0);
 assert.equal(run.promotion,'NONE_RESEARCH_ONLY');
 assert.equal(run.seed.params.fast,9);
 assert.equal(run.memory.experiments.length,2);
 const next=run.memory.experiments.at(-1);
 assert.deepEqual(next.trainingOptions[0].params,parent.params);
 assert.ok(next.parentResearchModel&&!next.parentResearchModel.confirmedChampion);
 assert.equal(next.reason,'INDEPENDENT_RELATIVE_TO_SAVED_MEMORY');
 assert.ok(next.trainingOptions.every(o=>o.closedTrades>=0&&
  o.winRatePct>=0&&o.winRatePct<=100&&Number.isFinite(o.netProfitGbp)));
 assert.equal(next.trulyIndependentForwardValidated,false);
 assert.equal(next.trainingEnd,new Date(dataset.bars[Math.floor(count*.4)-1].t instanceof Date?
  dataset.bars[Math.floor(count*.4)-1].t:
  Date.parse(dataset.bars[Math.floor(count*.4)-1].t)+900000).toISOString());
});
test('repeated lessons append distinct parameters, but never claim repeated independent evidence',()=>{
 const first=runResearchLesson(memory,{snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD',now});
 const second=runResearchLesson(first.memory,{snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD',now});
 assert.equal(second.changed,true);
 const last=second.memory.experiments.at(-1);
 assert.equal(last.acceptedForLearning,false);
 assert.equal(last.reason,'OVERLAPPING_TRAINING_WINDOW');
 const all=new Set(first.memory.experiments.at(-1).trainingOptions.map(x=>JSON.stringify(x.params)));
 const again=last.trainingOptions.map(x=>JSON.stringify(x.params));
 assert.equal(again.some(x=>all.has(x)),false);
 assert.equal(second.brokerOrders,0);
 assert.equal(second.seed.confirmedChampion,false);
 assert.equal(RESEARCH_LIMITS.observedHoldoutUsedToSelect,false);
});
test('future unseen data cannot influence parent selection or training outcome',()=>{
 const s=snapshots.get('BTC/USD'),cut=Math.floor(s.bars.length*.40);
 const modified={...s,bars:s.bars.map((bar,i)=>i>=cut?
  {...bar,o:bar.o*1.4,h:bar.h*1.4,l:bar.l*1.4,c:bar.c*1.4}:bar)};
 const original=runResearchLesson(memory,{snapshot:s,symbol:'BTC/USD',now});
 const altered=runResearchLesson(memory,{snapshot:modified,symbol:'BTC/USD',now});
 assert.deepEqual(original.memory,altered.memory);
 assert.equal(original.bestObservedTrainingNetGbp,altered.bestObservedTrainingNetGbp);
});
test('loads all ten markets independently, appending exactly ten research events',async()=>{
 const read=async filename=>{
  const symbol=filename.split('/').at(-1).replace('-', '/').replace('.json','');
  if(!snapshots.has(symbol))throw Error('Wrong pair file '+filename);
  return JSON.stringify(snapshots.get(symbol));
 };
 const all=await evaluateAll({memory,dataDir:'validation-data',read,now});
 assert.equal(all.addedExperiments,10);
 assert.equal(all.reports.length,10);
 assert.equal(all.brokerOrders,0);
 assert.equal(all.independentForwardEvidence,0);
 assert.equal(new Set(all.memory.experiments.map(e=>e.symbol)).size,10);
 assert.equal(all.memory.experiments.filter(e=>e.acceptedForLearning).length,11); // 1 existing + 10 independent nonoverlapping
});
test('uses strict GitHub-only append with expected blob sha, not full rewriting',async()=>{
 const key='TEST-TOKEN',blob='b'.repeat(40),commit='c'.repeat(40);
 let seenPut=null;
 const fakeFetch=async(url,options)=>{
  assert.ok(url.includes('scalp-learning/history.json'));
  assert.ok(options.headers.Authorization.includes(key));
  if(options.method==='GET')return {ok:true,json:async()=>({
   sha:blob,content:Buffer.from(JSON.stringify(memory)).toString('base64')
  })};
  if(options.method==='PUT'){seenPut=JSON.parse(options.body);
   return {ok:true,json:async()=>({commit:{sha:commit}})};}
  throw Error('Unexpected method '+options.method);
 };
 const loaded=await fetchMemory({token:key,fetchImpl:fakeFetch});
 assert.deepEqual(loaded.memory,memory);
 const result=runResearchLesson(memory,{snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD',now});
 const saved=await persistMemory({token:key,expectedSha:loaded.blobSha,previous:loaded.memory,
  next:result.memory,fetchImpl:fakeFetch});
 assert.equal(saved.written,true);
 assert.equal(seenPut.branch,'scalp-learning-memory');
 assert.equal(seenPut.sha,blob);
 assert.equal(JSON.parse(Buffer.from(seenPut.content,'base64').toString()).experiments.length,2);
 assert.equal(saved.commitSha,commit);
 const noChange=await persistMemory({token:key,expectedSha:blob,
  previous:result.memory,next:result.memory,fetchImpl:fakeFetch});
 assert.equal(noChange.written,false);
 await assert.rejects(persistMemory({token:key,expectedSha:blob,
  previous:result.memory,next:memory,fetchImpl:fakeFetch}),/cannot shrink/);
});
test('rejects falsified evidence, incorrect pairs and missing data',async()=>{
 assert.throws(()=>checkMemory({...memory,policy:'INVALID'}),/Incompatible/);
 assert.throws(()=>checkMemory({...memory,experiments:[oldRecord,oldRecord]}),/duplicate/);
 assert.throws(()=>runResearchLesson(memory,{snapshot:snapshots.get('ETH/USD'),symbol:'BTC/USD',now}),/missing|mismatched/);
 await assert.rejects(fetchMemory({token:'TEST',fetchImpl:async()=>({ok:false,status:404})}),/Cannot read/);
 const corrupt={...snapshots.get('BTC/USD'),
  bars:snapshots.get('BTC/USD').bars.map((b,i)=>i===40?{...b,c:0}:b)};
 assert.throws(()=>runResearchLesson(memory,{snapshot:corrupt,symbol:'BTC/USD',now}),/Invalid/);
});
test('training process contains no broker order or real deposit actions',async()=>{
 const code=await readFile(new URL('./run-robot-training.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(code,/(?:paperOrder|submitOrder|placeOrder)\s*\(/);
 assert.doesNotMatch(code,/\/v2\/orders|\/v2\/positions|https:\/\/paper-api\.alpaca\.markets/);
 assert.match(code,/observedHoldoutUsedToSelect:false/);
});

test('five-minute historical research uses versioned local data, never live broker during training',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/robot-research-training.yml',import.meta.url),'utf8');
 const refresh=await readFile(new URL('../.github/workflows/refresh-alpaca-validation.yml',import.meta.url),'utf8');
 const worker=await readFile(new URL('./run-robot-training.mjs',import.meta.url),'utf8');
 assert.ok(workflow.includes("cron: '2,7,12,17,22,27,32,37,42,47,52,57 * * * *'"));
 assert.match(workflow,/concurrency:/);
 assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/SCALP_RESEARCH_INPUT_DIR: validation-data/);
 assert.match(workflow,/historical-lab\.mjs/);
 assert.match(workflow,/quarantinedHoldoutNotScored/);
 assert.doesNotMatch(workflow,/ALPACA_PAPER_KEY|ALPACA_PAPER_SECRET|refreshAll\(/);
 assert.match(refresh,/cron: '17 \*\/6 \* \* \*'/);
 assert.match(refresh,/ALPACA_PAPER_KEY/);
 assert.match(worker,/process\.env\.SCALP_RESEARCH_INPUT_DIR\|\|'validation-data'/);
 assert.match(worker,/dataDir:selectedDir/);
 assert.doesNotMatch(workflow,/\/v2\/orders|submitOrder\s*\(/);
});

test('archived RSI boundary mutations are filtered before strict simulator execution',()=>{
 const sample={...oldRecord,id:'d'.repeat(64),trainingOptions:[
  {params:{family:'rsi_reversion',period:14,buyBelow:40,sellAbove:60},
    closedTrades:45,netProfitGbp:0.5,winRatePct:40,trainingScore:null}
 ]};
 const saved={...empty,experiments:[sample]};
 const plan=proposeResearchLesson(saved,{symbol:'BTC/USD',feed:'us-1',fingerprint:'f'.repeat(64)});
 assert.ok(plan.candidates.length>0);
 assert.ok(plan.candidates.every(p=>p.family!=='rsi_reversion'||p.buyBelow<=40),
   'Proposals must not exceed the actual validator RSI buy threshold');
 const result=runResearchLesson(saved,{snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD',now});
 assert.equal(result.changed,true);
 assert.ok(result.memory.experiments.at(-1).trainingOptions.every(
   o=>o.params.family!=='rsi_reversion'||o.params.buyBelow<=40));
 assert.equal(result.brokerOrders,0);
});

test('training rewards are measured and tracked without disclosing holdout or placing orders',async()=>{
 const source=await readFile(new URL('./run-robot-training.mjs',import.meta.url),'utf8');
 assert.match(source,/scoreTrainingReward/);
 assert.match(source,/rewardCreditsAwarded/);
 assert.match(source,/TRAINING_CYCLE_TELEMETRY/);
 assert.match(source,/evaluationDurationMs/);
 const r=runResearchLesson(memory,{snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD',now});
 assert.ok(r.memory.experiments.at(-1).trainingOptions.every(o=>o.researchReward.forwardVerified===false));
 assert.ok(r.memory.experiments.at(-1).trainingOptions.every(o=>o.researchReward.points>=0));
});

test('bounded multi-batch research accelerates attempts without creating forward evidence',async()=>{
 const read=async filename=>{
  const symbol=filename.split('/').at(-1).replace('-', '/').replace('.json','');
  return JSON.stringify(snapshots.get(symbol));
 };
 const result=await evaluateAll({memory:empty,dataDir:'validation-data',read,now,batchesPerPupil:3});
 assert.equal(result.reports.length,10);
 assert.equal(result.addedExperiments,30);
 assert.equal(result.brokerOrders,0);
 assert.equal(result.independentForwardEvidence,0);
 assert.ok(result.reports.every(x=>x.researchBatchesAttempted===3&&
   x.savedExperiments===3&&x.repeatedHistoryDoesNotCountAsIndependent===true));
 assert.ok(result.memory.experiments.filter(x=>x.acceptedForLearning).length<=10);
 assert.ok(result.reports.every(x=>x.chronologicalTrainingWindows>=1));
});
test('invalid historical batch budgets are refused',async()=>{
 for(const n of [0,4,-1,1.5,Infinity]){
  await assert.rejects(evaluateAll({memory:empty,batchesPerPupil:n}),
   /batches per pupil/);
 }
});

test('research continues exploring new bounded models after original neighbourhood is exhausted',()=>{
 const fingerprint='f'.repeat(64),prior=new Set();
 let saved={...empty,experiments:[]};
 for(let generation=0;generation<14;generation++){
   const plan=proposeResearchLesson(saved,{symbol:'BTC/USD',fingerprint,feed:'us-1'});
   assert.ok(plan.candidates.length>0,'Need new research parameters at generation '+generation);
   for(const p of plan.candidates){
     const signature=JSON.stringify(p);
     assert.equal(prior.has(signature),false,'Cannot retest identical parameters on same candles');
     prior.add(signature);
   }
   const opts=plan.candidates.map(params=>({
     params,closedTrades:22,netProfitGbp:-1,winRatePct:40,trainingScore:null
   }));
   saved={...saved,experiments:[...saved.experiments,{
     id:generation.toString(16).padStart(64,'0'),symbol:'BTC/USD',feed:'us-1',
     trainingStart:'2026-08-01T00:00:00Z',trainingEnd:'2026-08-15T00:00:00Z',
     trainFingerprint:fingerprint,acceptedForLearning:generation===0,
     trainingOptions:opts
   }]};
 }
 assert.ok(prior.size>=65,'Broader search must extend beyond the exhausted fixed bank');
 assert.ok([...prior].some(v=>v.includes('channel_breakout')));
 assert.ok([...prior].some(v=>v.includes('ema_trend')));
 assert.ok([...prior].some(v=>v.includes('rsi_reversion')));
 assert.equal(checkMemory(saved),saved);
});

test('daily compute cap keys to UTC research time, never a historical candle date',()=>{
 const symbol='BTC/USD',snapshot=snapshots.get(symbol);
 const first=runResearchLesson(memory,{snapshot,symbol,now});
 assert.equal(first.changed,true);
 const record=first.memory.experiments.at(-1);
 assert.equal(record.researchedAt,new Date(now).toISOString());
 assert.ok(record.trainingEnd.slice(0,10)!==record.researchedAt.slice(0,10));
 // Eight genuine executions TODAY block only further today's attempts.
 const todayExperiments=Array.from({length:8},(_,i)=>({
   ...oldRecord,id:(i+100).toString(16).padStart(64,'0'),
   researchedAt:new Date(now).toISOString()
 }));
 const capped={...empty,experiments:todayExperiments};
 const blocked=runResearchLesson(capped,{snapshot,symbol,now});
 assert.equal(blocked.changed,false);
 assert.equal(blocked.status,'DAILY_EXPERIMENT_CAP');
 const nextDay=runResearchLesson(capped,{snapshot,symbol,now:now+86400000});
 assert.equal(nextDay.changed,true);
 assert.equal(nextDay.memory.experiments.at(-1).researchedAt,
   new Date(now+86400000).toISOString());
 assert.equal(nextDay.brokerOrders,0);
});

test('Contents API encoding:none must retrieve exact immutable large history blob, not parse empty JSON',async()=>{
 const content=JSON.stringify(memory);
 const length=Buffer.byteLength(content,'utf8'),blob='d'.repeat(40),urls=[];
 const fakeFetch=async(url,options)=>{
  urls.push(url);
  assert.equal(options.method,'GET');
  assert.match(options.headers.Authorization,/TEST-TOKEN/);
  if(url.includes('/contents/scalp-learning/history.json'))
   return {ok:true,json:async()=>({sha:blob,size:length,encoding:'none',content:''})};
  if(url.endsWith('/git/blobs/'+blob))
   return {ok:true,json:async()=>({sha:blob,size:length,encoding:'base64',
    content:Buffer.from(content).toString('base64')})};
  throw Error('Unexpected API request '+url);
 };
 const loaded=await fetchMemory({token:'TEST-TOKEN',fetchImpl:fakeFetch});
 assert.deepEqual(loaded.memory,memory);
 assert.equal(loaded.blobSha,blob);
 assert.equal(urls.length,2);
 assert.ok(urls[1].endsWith('/git/blobs/'+blob));
});
test('large-memory fallback fails closed on missing/truncated blobs or SHA mismatches',async()=>{
 const blob='e'.repeat(40),source=JSON.stringify(memory),expected=Buffer.byteLength(source);
 const meta={sha:blob,size:expected,encoding:'none',content:''};
 const fixture=raw=>async(url)=>{
  if(url.includes('/contents/'))return {ok:true,json:async()=>meta};
  return {ok:true,json:async()=>raw};
 };
 for(const invalid of [
  {sha:'f'.repeat(40),size:expected,encoding:'base64',content:Buffer.from(source).toString('base64')},
  {sha:blob,size:expected,encoding:'base64',content:Buffer.from(source.slice(0,-1)).toString('base64')},
  {sha:blob,size:expected,encoding:'none',content:''},
  {sha:blob,size:expected,encoding:'base64',content:''}
 ]){
  await assert.rejects(fetchMemory({token:'T',fetchImpl:fixture(invalid)}),/verification|length|base64/);
 }
 await assert.rejects(fetchMemory({token:'T',fetchImpl:fixture({sha:blob,size:expected,
  encoding:'base64',content:Buffer.from('{').toString('base64')})}),/length|corrupt/);
});


test('production-sized >1 MiB history uses authenticated SHA-pinned blob fallback and preserves append-only memory',async()=>{
 const token='RESEARCH-TEST-TOKEN',sha='a'.repeat(40);
 // GitHub Content API does NOT return inline bytes once a stored JSON exceeds 1 MiB.
 // Create the same response shape with no huge fixtures checked into the repo.
 const full={...memory,largeFixturePadding:'x'.repeat(1091780)};
 const json=JSON.stringify(full),length=Buffer.byteLength(json,'utf8');
 assert.ok(length>1048576,'must reproduce actual GitHub size threshold');
 const calls=[];
 const fetchImpl=async(url,opts)=>{
  calls.push({url,method:opts.method});
  if(url.includes('/contents/scalp-learning/history.json'))
   return {ok:true,json:async()=>({sha,size:length,encoding:'none',content:''})};
  if(url.endsWith('/git/blobs/'+sha))
   return {ok:true,json:async()=>({sha,size:length,encoding:'base64',
     content:Buffer.from(json).toString('base64').replace(/.{76}/g,match=>match+String.fromCharCode(10))})};
  throw Error('unexpected GitHub endpoint '+url);
 };
 const result=await fetchMemory({token,fetchImpl});
 assert.equal(result.blobSha,sha);
 assert.deepEqual(result.memory,full);
 assert.equal(calls.length,2);
 assert.ok(calls[1].url.includes('/git/blobs/'));
 assert.equal(calls[0].method,'GET');
 assert.equal(calls[1].method,'GET');
});
test('the full memory fallback fails closed if source metadata is missing or exceeds bound',async()=>{
 const content=Buffer.from(JSON.stringify(memory)).toString('base64');
 const get=meta=>fetchMemory({token:'T',fetchImpl:async()=>({ok:true,json:async()=>meta})});
 for(const meta of [
   {sha:'a'.repeat(40),encoding:'none',content:'',size:33554433},
   {sha:'a'.repeat(40),encoding:'none',content:'',size:-1},
   {sha:'invalid',encoding:'base64',content,size:123},
   {sha:'a'.repeat(40),encoding:'none',content:'nonempty',size:120}
 ]){
  await assert.rejects(get(meta),/SHA|size|inconsistent/);
 }
});
