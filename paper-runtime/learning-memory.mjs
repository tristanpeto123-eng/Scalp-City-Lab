// Deterministic, auditable *research* memory. No neural-network claims.
// ONLY TRAINING results can influence future candidates. Held-out results
// are retained for Checker as diagnostics but NEVER used by proposeCandidates.
// One overlapping/duplicate historical sample cannot create fake new evidence.
import {createHash} from 'node:crypto';
import {TRIAL_RULES} from './trial-profit.mjs';
import {isResearchCrypto} from './crypto-research-marketset.mjs';
import {STRATEGY_GRID,normaliseStrategy,strategyKey} from './signal-policies.mjs';

export const MEMORY_SCHEMA='SCALP_RESEARCH_MEMORY_V1';
export const MEMORY_BRANCH='scalp-learning-memory';
const GRID=STRATEGY_GRID;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const key=strategyKey;
const finite=Number.isFinite;
const strictDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const strictParams=p=>{try{return Boolean(normaliseStrategy(p))}catch{return false}};
const isFeed=x=>['us','us-1'].includes(x);
const details=x=>x&&typeof x==='object'&&typeof x.symbol==='string'&&isResearchCrypto(x.symbol)&&isFeed(x.feed);
export function emptyMemory(){
 return {schema:MEMORY_SCHEMA,policy:TRIAL_RULES.version,experiments:[]};
}
export function assertMemory(value){
 if(!value||value.schema!==MEMORY_SCHEMA||value.policy!==TRIAL_RULES.version||
    !Array.isArray(value.experiments)||value.experiments.length>2000)throw Error('Invalid or stale model memory version');
 const ids=new Set();
 for(const e of value.experiments){
  if(!details(e)||!strictDate(e.trainingStart)||!strictDate(e.trainingEnd)||
     !(Date.parse(e.trainingEnd)>Date.parse(e.trainingStart))||
     !/^[a-f0-9]{64}$/.test(e.trainFingerprint)||
     !/^[a-f0-9]{64}$/.test(e.id)||ids.has(e.id)||
     typeof e.acceptedForLearning!=='boolean'||!Array.isArray(e.trainingOptions)||
     e.trainingOptions.length>16)throw Error('Invalid or duplicate historical learning record');
  ids.add(e.id);
  if(e.behavior!==undefined && (typeof e.behavior!=='object'||
   !Number.isFinite(e.behavior.dailyRealizedVolatilityPct)||
   !['DIRECTIONAL','HIGH_VOLATILITY','MIXED_OR_RANGE'].includes(e.behavior.descriptiveRegime)||
   e.behavior.sampleEnd!==e.trainingEnd))
   throw Error('Chart profile must derive exclusively from training window');
  for(const x of e.trainingOptions){
   if(!strictParams(x.params)||!Number.isInteger(x.closedTrades)||x.closedTrades<0||
      !finite(x.netProfitGbp)||!finite(x.winRatePct)||x.winRatePct<0||x.winRatePct>100||
      x.trainingScore!==null&&!finite(x.trainingScore))
      throw Error('Malformed training-only model evidence');
  }
 }
 return value;
}
export function proposeCandidates(memory,{symbol,feed,behavior}={}){
 assertMemory(memory);
 if(!isResearchCrypto(symbol)||!isFeed(feed))throw Error('Unknown research market or feed');
 const historic=memory.experiments.filter(e=>e.symbol===symbol&&e.feed===feed);
 const accepted=historic.filter(e=>e.acceptedForLearning);
 const tried=new Set(historic.flatMap(e=>e.trainingOptions.map(o=>key(o.params))));
 const observations=new Map();
 for(const e of accepted)for(const o of e.trainingOptions){
   const k=key(o.params),prior=observations.get(k)||{params:o.params,trials:0,scoreSum:0,netSum:0};
   prior.trials++;prior.scoreSum+=o.trainingScore??-100;
   prior.netSum+=o.netProfitGbp;
   observations.set(k,prior);
 }
 const ranked=[...observations.values()]
   .sort((a,b)=>b.scoreSum/b.trials-a.scoreSum/a.trials||key(a.params).localeCompare(key(b.params)));
 const positive=ranked.filter(x=>x.netSum>0);
 const chosen=[],seen=new Set();
 // A chart's own training-only regime may change which untried *families*
 // are explored first. It never uses later holdout or other chart evidence.
 const regime=behavior?.descriptiveRegime||accepted.at(-1)?.behavior?.descriptiveRegime||'MIXED_OR_RANGE';
 const order=regime==='HIGH_VOLATILITY'
   ?['channel_breakout','ema_trend','rsi_reversion']
   :regime==='DIRECTIONAL'
     ?['ema_trend','channel_breakout','rsi_reversion']
     :['rsi_reversion','ema_trend','channel_breakout'];
 const grouped=order.flatMap(family=>GRID.filter(p=>p.family===family&&!tried.has(key(p))));
 const roundRobin=[];
 let index=0;
 while(roundRobin.length<grouped.length){
   for(const family of order){
     const member=GRID.filter(p=>p.family===family&&!tried.has(key(p)))[index];
     if(member)roundRobin.push(member);
   }
   index++;
 }

 const insert=p=>{if(!strictParams(p)||seen.has(key(p)))return;seen.add(key(p));chosen.push({...p});};
 // Keep a credible exploitation candidate only from independent TRAIN-only evidence.
 for(const row of positive.slice(0,2))insert(row.params);
 // Untried fixed grid gives bounded exploration and ensures unsuccessful
 // strategies teach the designer to look somewhere else next time.
 for(const item of roundRobin.slice(0,6))insert(item);
 // Never report a run as proof of a successful learning algorithm.
 if(chosen.length<5)for(const p of GRID)insert(p);
 return {candidates:chosen.slice(0,6),market:symbol,feed,priorIndependentWindows:accepted.length,
   triedParameters:tried.size,distinctStrategies:[...new Set(chosen.map(p=>p.family))],
   chartModelId:'CHART_'+symbol.replace('/',''),trainingRegime:regime,
   basis:'TRAIN_ONLY_EVIDENCE_PLUS_BOUNDED_GRID_EXPLORATION',
   learnedFromHoldout:false,modelDeployed:false};
}
export function rememberTraining(memory,event){
 assertMemory(memory);
 const {symbol,feed,trainingStart,trainingEnd,trainFingerprint,trainingOptions,behavior}=event||{};
 if(!details(event)||!strictDate(trainingStart)||!strictDate(trainingEnd)||
    Date.parse(trainingStart)>=Date.parse(trainingEnd)||
    !/^[a-f0-9]{64}$/.test(trainFingerprint)||!Array.isArray(trainingOptions)||
    trainingOptions.length<1||trainingOptions.length>16||
   !behavior||behavior.sampleEnd!==trainingEnd)throw Error('Invalid training observation/profile');
 const opts=trainingOptions.map(o=>({
   params:normaliseStrategy(o.params),
   closedTrades:o.trainingClosedTrades??o.closedTrades,
   netProfitGbp:o.trainingNetGbp??o.netProfitGbp,
   winRatePct:o.trainingWinRatePct??o.winRatePct,
   trainingScore:o.trainingScore??o.score??null
 }));
 const recordId=hash([memory.policy,symbol,feed,trainingStart,trainingEnd,trainFingerprint]);
 const existing=memory.experiments.find(e=>e.id===recordId);
 if(existing)return {memory,reason:'EXACT_DATA_REPLAY_DEDUPED',acceptedForLearning:false,recordId};
 // Overlapping daily re-tests may be useful for a local exploratory session,
 // but never count as independent evidence and never grow the persistent
 // archive every 15 minutes. Keep at most one shadow study per UTC date.
 const day=trainingEnd.slice(0,10);
 const shadow=memory.experiments.find(e=>e.symbol===symbol&&e.feed===feed&&
   !e.acceptedForLearning&&e.trainingEnd.slice(0,10)===day);
 if(shadow)return {memory,reason:'SAME_DAY_OVERLAP_NOT_PERSISTED',acceptedForLearning:false,recordId:shadow.id};
 const spans=memory.experiments.filter(e=>e.symbol===symbol&&e.feed===feed&&e.acceptedForLearning);
 const overlapping=spans.some(e=>Date.parse(trainingStart)<Date.parse(e.trainingEnd)&&
     Date.parse(e.trainingStart)<Date.parse(trainingEnd));
 const candidate={id:recordId,symbol,feed,trainingStart,trainingEnd,trainFingerprint,
    acceptedForLearning:!overlapping,trainingOptions:opts,behavior,
    // NEVER enter held-out P&L, win rate OR verdict in training memory.
    reason:overlapping?'OVERLAPPING_TRAINING_WINDOW':'INDEPENDENT_TRAINING_WINDOW'};
 const result={...memory,experiments:[...memory.experiments,candidate]};
 assertMemory(result);
 return {memory:result,reason:candidate.reason,
   acceptedForLearning:candidate.acceptedForLearning,recordId};
}
export function fingerprintTraining(raw){
 if(!Array.isArray(raw)||!raw.length)throw Error('Empty training candles');
 return hash(raw.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v]));
}
