import assert from 'node:assert/strict';
import {STRATEGY_GRID,normaliseStrategy,signalPolicy,strategyKey,explainSignalPolicy} from './signal-policies.mjs';
import {emptyMemory,assertMemory,proposeCandidates,rememberTraining,
 fingerprintTraining,MEMORY_BRANCH} from './learning-memory.mjs';
import {profileChart,pairModels,explainChartModel} from './chart-models.mjs';
import {replayHistorical} from './replay-profit.mjs';
import {simulateProfit,optimizeProfit} from './learning-profit.mjs';
import {loadGitHubMemory,commitGitHubMemory} from './github-learning-store.mjs';
let n=0;
const start=Date.parse('2026-01-01T00:00:00Z'),raw=[];let prev=100;
for(let i=0;i<1300;i++){
 const o=prev,c=100+9*Math.sin(i/9)+3*Math.sin(i/37);
 raw.push({t:new Date(start+i*900000).toISOString(),o,
   h:Math.max(o,c)*1.002,l:Math.min(o,c)*.998,c,v:1000});
 prev=c;
}
assert.equal(STRATEGY_GRID.length,16);n++;
assert.deepEqual([...new Set(STRATEGY_GRID.map(p=>p.family))].sort(),
 ['channel_breakout','ema_trend','rsi_reversion']);n++;
for(const params of STRATEGY_GRID){
 const rule=normaliseStrategy(params);
 assert.equal(rule.family,params.family);n++;
 assert.ok(explainSignalPolicy(params).method.length>20);n++;
 const signal=signalPolicy(params);
 const observed=raw.slice(0,300).map(b=>signal.observe(b));
 assert.equal(observed.length,300);n++;
 assert.ok(observed.every(o=>typeof o.entry==='boolean'&&typeof o.exit==='boolean'));n++;
}
assert.throws(()=>normaliseStrategy({family:'invisible'}),/Unknown/);n++;
assert.throws(()=>normaliseStrategy({family:'channel_breakout',lookback:2,exitLookback:1}),/Invalid/);n++;
assert.throws(()=>normaliseStrategy({family:'rsi_reversion',period:14,buyBelow:70,sellAbove:30}),/Invalid/);n++;
// Causality: re-observing a prefix, no change from future data.
for(const params of STRATEGY_GRID.filter((_,i)=>i%4===0)){
 const first=signalPolicy(params),second=signalPolicy(params);
 const a=raw.slice(0,300).map(x=>first.observe(x));
 const changed=raw.map((x,i)=>i<300?x:{...x,o:x.o*.8,h:x.h*1.7,l:x.l*.6,c:x.c*1.1});
 const b=changed.slice(0,300).map(x=>second.observe(x));
 assert.deepEqual(a,b);n++;
}
const profile=profileChart(raw.slice(0,390));
assert.equal(profile.candles,390);n++;
assert.ok(profile.averageCandleRangePct>0);n++;
assert.ok(profile.dailyRealizedVolatilityPct>=0);n++;
assert.ok(['HIGH_VOLATILITY','DIRECTIONAL','MIXED_OR_RANGE'].includes(profile.descriptiveRegime));n++;
assert.equal(profile.sampleEnd,raw[390].t);n++;
let memory=emptyMemory();
const btcOriginal=proposeCandidates(memory,{symbol:'BTC/USD',feed:'us-1',behavior:profile});
assert.equal(btcOriginal.market,'BTC/USD');n++;
assert.equal(btcOriginal.priorIndependentWindows,0);n++;
assert.ok(new Set(btcOriginal.candidates.map(p=>p.family)).size>=2);n++;
const inputBars=raw.map(b=>({...b,t:Date.parse(b.t)}));
const sim=simulateProfit(inputBars,STRATEGY_GRID[8],{symbol:'BTC/USD'});
assert.ok(Number.isFinite(sim.netGbp));n++;
const selection=optimizeProfit(inputBars,btcOriginal.candidates,'BTC/USD');
assert.equal(selection.trainingOptions.length,6);n++;
const replay=replayHistorical({symbol:'BTC/USD',raw,candidates:btcOriginal.candidates,
 closedBefore:start+1302*900000});
assert.equal(replay.trainOnlySelection.trainOptions.length,6);n++;
const paramsF=STRATEGY_GRID.slice(0,6);
const evidence=btcOriginal.candidates.map((params,i)=>({
 params,closedTrades:8,netProfitGbp:i===1?10:-3,
 winRatePct:i===1?70:10,score:i===1?8:-4
}));
const event={symbol:'BTC/USD',feed:'us-1',
 trainingStart:raw[0].t,trainingEnd:raw[390].t,
 trainFingerprint:fingerprintTraining(raw.slice(0,390)),
 behavior:profile,trainingOptions:evidence};
const saved=rememberTraining(memory,event);memory=saved.memory;
assert.equal(saved.acceptedForLearning,true);n++;
assert.equal(memory.experiments.length,1);n++;
assert.equal(memory.experiments[0].behavior.descriptiveRegime,profile.descriptiveRegime);n++;
assertMemory(memory);n++;
const repeated=rememberTraining(memory,event);
assert.equal(repeated.reason,'EXACT_DATA_REPLAY_DEDUPED');n++;
assert.equal(repeated.memory.experiments.length,1);n++;
const overlapping=rememberTraining(memory,{...event,
 trainingStart:raw[2].t,trainingEnd:raw[392].t,
 trainFingerprint:fingerprintTraining(raw.slice(2,392)),
 behavior:profileChart(raw.slice(2,392))});
assert.equal(overlapping.acceptedForLearning,false);n++;
assert.equal(overlapping.memory.experiments.length,2);n++;
const onceMore=rememberTraining(overlapping.memory,{...event,
 trainingStart:raw[4].t,trainingEnd:raw[394].t,
 trainFingerprint:fingerprintTraining(raw.slice(4,394)),
 behavior:profileChart(raw.slice(4,394))});
assert.equal(onceMore.reason,'SAME_DAY_OVERLAP_NOT_PERSISTED');n++;
assert.equal(onceMore.memory.experiments.length,2);n++;
const other={...event,symbol:'ETH/USD',
 trainFingerprint:fingerprintTraining(raw.slice(0,390).map((b,i)=>({...b,v:b.v+i})))};
const ethSave=rememberTraining(memory,other);
assert.equal(ethSave.acceptedForLearning,true);n++;
const before=proposeCandidates(memory,{symbol:'BTC/USD',feed:'us-1',behavior:profile});
const afterEth=proposeCandidates(ethSave.memory,{symbol:'BTC/USD',feed:'us-1',behavior:profile});
assert.deepEqual(before.candidates,afterEth.candidates);n++;
assert.equal(pairModels(ethSave.memory).length,10);n++;
assert.equal(pairModels(ethSave.memory).find(x=>x.symbol==='BTC/USD').independentTrainingWindows,1);n++;
assert.equal(pairModels(ethSave.memory).find(x=>x.symbol==='ETH/USD').independentTrainingWindows,1);n++;
assert.equal(pairModels(ethSave.memory).find(x=>x.symbol==='ADA/USD').independentTrainingWindows,0);n++;
const model=explainChartModel({symbol:'BTC/USD',feed:'us-1',
 proposal:btcOriginal,replay,behavior:profile,learning:saved});
assert.equal(model.modelId,'CHART_BTCUSD');n++;
assert.equal(model.agentExplanations.length,12);n++;
assert.ok(model.agentExplanations.every(a=>a.method&&a.decision&&a.evidence));n++;
assert.equal(model.selectedStrategy.verifiedProfitable,false);n++;
assert.equal(model.trainingProfile.candles,390);n++;
assert.ok(['ema_trend','rsi_reversion','channel_breakout'].includes(model.selectedStrategy.parameters.family));n++;
assert.equal(model.agentExplanations.find(a=>a.id==='PT-01').decision.includes('Zero real'),true);n++;
// Independent GitHub branch persistence; fail closed on corrupt, conflict, or nonappend mutations.
const token='TEST-NOT-REAL',modelBlob='a'.repeat(40),commitSha='b'.repeat(40);
let putBody=null;
const fakeFetch=async(url,opts)=>{
 assert.ok(url.includes('/contents/scalp-learning/history.json'));n++;
 if(opts.method==='GET')return {ok:true,json:async()=>({
   sha:modelBlob,content:Buffer.from(JSON.stringify(memory)).toString('base64')})};
 if(opts.method==='PUT'){putBody=JSON.parse(opts.body);
  return {ok:true,json:async()=>({content:{sha:modelBlob},commit:{sha:commitSha}})};}
 throw Error('Unexpected HTTP action');
};
const loaded=await loadGitHubMemory({fetchImpl:fakeFetch,token});
assert.deepEqual(loaded.memory,memory);n++;
const written=await commitGitHubMemory({fetchImpl:fakeFetch,token,
 expectedSha:loaded.blobSha,previousMemory:memory,memory:ethSave.memory});
assert.equal(written.status,'PERSISTED_TRAINING_MEMORY');n++;
assert.equal(putBody.branch,MEMORY_BRANCH);n++;
assert.equal(putBody.sha,modelBlob);n++;
assert.equal(JSON.parse(Buffer.from(putBody.content,'base64').toString('utf8')).experiments.length,2);n++;
await assert.rejects(commitGitHubMemory({fetchImpl:fakeFetch,token,
 expectedSha:modelBlob,memory:memory,previousMemory:ethSave.memory}),/Cannot erase/);n++;
await assert.rejects(loadGitHubMemory({fetchImpl:async()=>({ok:false,status:404}),token}),/fail/i);n++;
assert.throws(()=>assertMemory({...memory,policy:'STALE-3R'}),/stale/);n++;
console.log('PASS '+n+' independent per-chart behavior/strategies, 12-agent reasoning records, persistence and no-leakage tests');
