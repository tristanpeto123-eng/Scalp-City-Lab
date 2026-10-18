// Independent chronological examination admission auditor.
// Historical evidence ONLY. NEVER sends broker orders or certificates to the browser.
import {createHash} from 'node:crypto';
import {checkSnapshot,PAIRS} from '../strategy-validation-core.mjs';
import {checkParams} from '../scripts/run-robot-training.mjs';
import {readiness,freezeAdmission} from './engine.mjs';

const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const good=x=>Number.isFinite(x);
const FEE=.0025,START=50,MAX_BUY=.5;
const candleTime=x=>new Date(x).toISOString();
const paramsEquivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

// This replay deliberately does NOT import the historical optimizer or its
// trading simulation: it re-implements frozen signal decisions on completed
// bars and executes only on next candle's OPEN, after previous bar closes.
export function chronologicalReplay(bars,params,holdoutStart,feeRate=FEE){
  checkParams(params);
  if(!Array.isArray(bars)||bars.length<300||!good(holdoutStart)||
     !good(feeRate)||feeRate<0||feeRate>.02)throw Error('AUDITOR: invalid replay inputs');
  let fast=null,slow=null,prev=null,avgGain=0,avgLoss=0,rsi=50;
  let cash=START,position=null,wins=0,maxDD=0,peak=START,rounds=[];
  const highs=[],lows=[];
  for(let i=0;i<bars.length-1;i++){
    const bar=bars[i],next=bars[i+1];
    const prevHigh=highs.length>=params.lookback?Math.max(...highs.slice(-params.lookback)):Infinity;
    const prevLow=lows.length>=params.exitLookback?Math.min(...lows.slice(-params.exitLookback)):-Infinity;
    const ff=params.family==='ema_trend'?params.fast:9,ss=params.family==='ema_trend'?params.slow:34;
    fast=fast===null?bar.c:fast+2/(ff+1)*(bar.c-fast);
    slow=slow===null?bar.c:slow+2/(ss+1)*(bar.c-slow);
    if(prev!==null){
      const n=params.family==='rsi_reversion'?params.period:14;
      avgGain=(avgGain*(n-1)+Math.max(0,bar.c-prev))/n;
      avgLoss=(avgLoss*(n-1)+Math.max(0,prev-bar.c))/n;
      rsi=avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);
    }
    prev=bar.c;highs.push(bar.h);lows.push(bar.l);
    if(highs.length>96){highs.shift();lows.shift();}
    if(next.t<holdoutStart)continue; // train history is warmup, not scored
    const sign=params.family==='ema_trend'?
      {buy:fast>slow,sell:fast<=slow}:
      params.family==='rsi_reversion'?
      {buy:rsi<params.buyBelow,sell:rsi>=params.sellAbove}:
      {buy:bar.c>prevHigh,sell:bar.c<prevLow};
    const stop=position&&bar.c<position.entryPrice*.98;
    if(position&&(sign.sell||stop)){
      const proceeds=position.qty*next.o*(1-feeRate),profit=proceeds-position.entryCost;
      cash+=proceeds;
      rounds.push({open:position.time,close:candleTime(next.t),netUsd:profit});
      if(profit>0)wins++;
      position=null;
    }else if(!position&&sign.buy){
      const notional=Math.min(START*MAX_BUY,cash*.5);
      if(notional>=1&&cash>=notional*(1+feeRate)){
        position={qty:notional/next.o,entryCost:notional*(1+feeRate),entryPrice:next.o,
          time:candleTime(next.t)};
        cash-=position.entryCost;
      }
    }
    const marked=cash+(position?position.qty*next.c*(1-feeRate):0);
    peak=Math.max(peak,marked);
    if(marked<0)throw Error('AUDITOR: negative estimated equity');
    maxDD=Math.max(maxDD,(peak-marked)/peak*100);
  }
  const netUsd=rounds.reduce((sum,r)=>sum+r.netUsd,0);
  return {closedTrades:rounds.length,wins,netUsd,maxDrawdownPct:maxDD,
    firstClose:rounds[0]?.close||null,lastClose:rounds.at(-1)?.close||null,
    openExposure:Boolean(position),simulation:'UNSEEN_CHRONOLOGICAL_NEXT_OPEN'};
}

export function auditCandidate({memory,snapshot,pupil,fx,now=Date.now()}={}){
  const leader=pupil?.researchLeader;
  if(!PAIRS.includes(pupil?.symbol)||!leader||!memory||
     memory.schema!=='SCALP_RESEARCH_MEMORY_V1'||!Array.isArray(memory.experiments))
    throw Error('AUDITOR: incompatible research sources');
  const exp=memory.experiments.find(x=>x.id===leader.sourceExperimentId);
  if(!exp||exp.symbol!==pupil.symbol||exp.feed!=='us-1'||!exp.acceptedForLearning||
     !exp.trainingOptions?.some(o=>paramsEquivalent(o.params,leader.parameters))||
     exp.trainingEnd!==leader.trainedThrough)
    throw Error('AUDITOR: parent model lineage not independently identifiable');
  if(!fx||fx.source!=='FRANKFURTER_ECB_REFERENCE'||!good(fx.gbpPerUsd)||
     fx.gbpPerUsd<=0||!fx.date)
    throw Error('AUDITOR: external reference FX rate missing');
  const checked=checkSnapshot(snapshot,pupil.symbol,now);
  const bars=checked.bars,start=Date.parse(exp.trainingStart),
    end=Date.parse(exp.trainingEnd);
  if(!good(start)||!good(end)||start>=end)throw Error('AUDITOR: training interval invalid');
  const training=bars.filter(b=>b.t>=start&&b.t<end);
  const trainHash=sha(training.map(b=>[candleTime(b.t),b.o,b.h,b.l,b.c,b.v]));
  if(trainHash!==exp.trainFingerprint||training.length<480||
     training[0].t!==start||training.at(-1).t+900000!==end)
    throw Error('AUDITOR: frozen training fingerprint unavailable or changed');
  const holdout=bars.filter(b=>b.t>=end);
  if(holdout.length<150||holdout[0].t!==end)
    throw Error('AUDITOR: insufficient untouched contiguous holdout');
  if(Date.parse(fx.date+'T00:00:00Z')>now||now-Date.parse(fx.date+'T00:00:00Z')>5*86400_000)
    throw Error('AUDITOR: reference rate stale or in future');
  const standard=chronologicalReplay(bars,leader.parameters,end,FEE);
  const doubled=chronologicalReplay(bars,leader.parameters,end,2*FEE);
  const audit={
    source:'INDEPENDENT_CHRONOLOGICAL_HOLDOUT',
    symbol:pupil.symbol,modelExperimentId:exp.id,
    paramsDigest:sha(leader.parameters),closedTrades:standard.closedTrades,
    netGbp:Number((standard.netUsd*fx.gbpPerUsd).toFixed(8)),
    doubleCostNetGbp:Number((doubled.netUsd*fx.gbpPerUsd).toFixed(8)),
    maxDrawdownPct:standard.maxDrawdownPct,
    windowStart:candleTime(end),
    windowEnd:candleTime(bars.at(-1).t+900000),
    replayDigest:sha([standard,doubled]),
    snapshotFingerprint:sha(bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v])),
    fx,modelFrozen:true,method:'INDEPENDENT_NEXT_OPEN_V1',
    checkedAt:candleTime(now)
  };
  const gate=readiness(pupil,audit);
  return {audit,gate,
    counts:{unseenCandles:holdout.length,trainingCandles:training.length},
    result:'HISTORICAL_SCREEN_ONLY_NOT_FORWARD_VERIFIED'};
}
export function issueAdmission({memory,snapshot,pupil,fx,examStartedAt,now=Date.now()}){
  const result=auditCandidate({memory,snapshot,pupil,fx,now});
  if(!result.gate.ready)throw Error('AUDITOR: not ready: '+result.gate.reasons.join('; '));
  const admission=freezeAdmission(pupil,result.audit,examStartedAt);
  return {admission,audit:result.audit,independentHoldoutSummary:result.counts,
    warning:'Historical admission alone never authorizes trading or graduation'};
}
