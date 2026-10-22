import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  validateReport,validateTrace,replayState,coachingPacket,
  SYMBOLS,COACH_TYPES
} from './robot-observer-core.mjs';

const root=process.env.SCALP_OBSERVER_RESEARCH_ROOT;
const sha='a'.repeat(64);
const pupil={
  symbol:'ADA/USD',modelSha256:sha,sourceTrainingFingerprint:'b'.repeat(64),
  visualReplayPath:'rl-rapid/replays/ADA-USD-5m.json',
  paperOrders:0,forwardVerified:false,researchOnly:true,
  cumulativeGradientUpdates:3456,cumulativeDecisions:5000,
  laterDevelopmentNetGbp:-0.22,laterDevelopmentStressedNetGbp:-0.44,
  laterDevelopmentMaxDrawdownPct:3.5
};
const sampleReport={
  schema:'SCALP_RAPID_RL_REPLAY_V1',
  marketBarTimeframe:'5Min',
  simulationClock:'HISTORICAL_REPLAY',
  decisionsAreNotBrokerTrades:true,
  paperOrders:0,liveOrders:0,verifiedForwardGrades:0,
  sealedHoldoutAccessed:false,automaticAdmissions:0,
  gradientUpdates:3456,decisionCount:5000,simulatedClosedTrades:1,
  generatedAt:'2026-10-21T19:00:00Z',
  pupils: SYMBOLS.map(sym=>({...pupil,
    symbol:sym,
    visualReplayPath:'rl-rapid/replays/'+sym.replace('/','-')+'-5m.json'}))
};
const start=1791555000000;
const candles=Array.from({length:36},(_,i)=>({
  t:start+i*300000,o:100+i,h:102+i,l:99+i,c:101+i,v:10+i
}));
const trace={
  schema:'SCALP_CAUSAL_REPLAY_5MIN_V1',
  symbol:'ADA/USD',policySha256:sha,timeframe:'5Min',
  historicalOnly:true,futureCandlesVisibleAtOnce:false,
  fillsAreSimulated:true,forwardPaperVerified:false,
  heldOutQuarantineTouched:false,
  paperOrders:0,liveOrders:0,
  accountingCurrency:'VIRTUAL_UNITS',startingVirtualBalance:50,
  candles,
  decisions:[{
    observedCandleTime:candles[33].t,
    nextCandleTime:candles[34].t,
    action:'LONG',executionSide:'BUY',executionPriceUsd:candles[34].o,
    equityGbp:49.9,simulatedClosedTrades:0,openPosition:true,
    reward:-0.1,realizedProfitVirtual:0
  },{
    observedCandleTime:candles[34].t,
    nextCandleTime:candles[35].t,
    action:'FLAT',executionSide:'SELL',executionPriceUsd:candles[35].o,
    equityGbp:50.2,simulatedClosedTrades:1,openPosition:false,
    reward:0.2,realizedProfitVirtual:0.2
  }],
  virtualFills:[{
    side:'BUY',candleTime:candles[34].t,
    sourceDecisionTime:candles[33].t,executionPriceUsd:candles[34].o,
    feeVirtual:0.1,realizedProfitVirtual:null
  },{
    side:'SELL',candleTime:candles[35].t,
    sourceDecisionTime:candles[34].t,executionPriceUsd:candles[35].o,
    feeVirtual:0.1,realizedProfitVirtual:0.2
  }],
  closedTrades:[{
    exitTime:candles[35].t,netProfitVirtual:0.2,outcome:'WIN'
  }]
};
const clone=x=>structuredClone(x);
assert.equal(validateReport(sampleReport),sampleReport);
assert.equal(validateTrace(trace,pupil),trace);
const first=replayState(trace,pupil,0),last=replayState(trace,pupil,1);
assert.equal(first.completed.length,0);
assert.equal(first.openPosition,true);
assert.equal(first.winRate,null);
assert.equal(last.completed.length,1);
assert.equal(last.fills.length,2);
assert.ok(Math.abs(last.net-0.2)<1e-9, 'floating point virtual P&L tolerance');
assert.equal(last.winRate,100);
assert.equal(last.openPosition,false);
assert.ok(last.maxDrawdownPct>0);
assert.equal(first.candles.at(-1).t,candles[34].t);
assert.equal(last.candles.at(-1).t,candles[35].t);
assert.throws(()=>replayState(trace,pupil,999),RangeError);

for(const patch of [
  {paperOrders:1},{liveOrders:2},{verifiedForwardGrades:1},
  {sealedHoldoutAccessed:true},{decisionsAreNotBrokerTrades:false},
  {simulationClock:'LIVE'},{marketBarTimeframe:'1Sec'}
]){
  assert.throws(()=>validateReport({...sampleReport,...patch}),/UNVERIFIED_RESEARCH/);
}
for(const patch of [
  {policySha256:'e'.repeat(64)},{paperOrders:1},
  {historicalOnly:false},{futureCandlesVisibleAtOnce:true},
  {heldOutQuarantineTouched:true},{fillsAreSimulated:false}
]){
  assert.throws(()=>validateTrace({...trace,...patch},pupil),/UNVERIFIED_RESEARCH/);
}
const bad=clone(trace);
bad.decisions[0].nextCandleTime+=300000;
assert.throws(()=>validateTrace(bad,pupil),/noncausal/);
const candleTamper=clone(trace);
candleTamper.candles[1].t+=1;
assert.throws(()=>validateTrace(candleTamper,pupil),/noncontiguous/);
const packet=coachingPacket({
  type:COACH_TYPES[0],note:'Concern about inactivity',symbol:'ADA/USD',
  modelSha256:sha,generatedAt:sampleReport.generatedAt
});
assert.equal(packet.status,'LOCAL_DRAFT_NOT_SENT_NOT_APPLIED');
assert.equal(packet.effectOnTraining,'NONE_UNTIL_INDEPENDENT_REVIEW');
assert.equal(packet.brokerOrders,0);
assert.throws(()=>coachingPacket({
  ...packet,type:'Execute a live BUY order',
  generatedAt:sampleReport.generatedAt,note:'bad'
}),/Invalid local/);
assert.throws(()=>coachingPacket({
  type:COACH_TYPES[0],note:'x'.repeat(300),symbol:'ADA/USD',
  modelSha256:sha,generatedAt:sampleReport.generatedAt
}),/Invalid local/);

if(root){
  const report=validateReport(JSON.parse(readFileSync(path.join(root,'rl-rapid/latest.json'),'utf8')));
  let withVirtualFills=0,closed=0;
  for(const p of report.pupils){
    const data=validateTrace(JSON.parse(readFileSync(path.join(root,p.visualReplayPath),'utf8')),p);
    const result=replayState(data,p,data.decisions.length-1);
    assert.equal(result.completed.length,data.closedTrades.length);
    assert.equal(result.fills.length,data.virtualFills.length);
    assert.ok(result.equity>=0);
    assert.equal(result.candles.at(-1).t,data.decisions.at(-1).nextCandleTime);
    withVirtualFills+=Number(result.fills.length>0);
    closed+=result.completed.length;
  }
  console.log('AUTONOMOUS_OBSERVER_SOURCE_VERIFIED: 10 true historical traces; '+withVirtualFills+
      ' traces have virtual fills; '+closed+' historical round trips; 0 broker orders.');
}
console.log('AUTONOMOUS_OBSERVER_TESTS_PASS: source binding, causal playback, measured stats, local-only optional coach.');
