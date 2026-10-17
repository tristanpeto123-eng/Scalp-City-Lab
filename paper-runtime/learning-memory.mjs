// Deterministic, auditable *research* memory. No neural-network claims.
// ONLY TRAINING results can influence future candidates. Held-out results
// are retained for Checker as diagnostics but NEVER used by proposeCandidates.
// One overlapping/duplicate historical sample cannot create fake new evidence.
import {createHash} from 'node:crypto';
import {TRIAL_RULES} from './trial-profit.mjs';
import {isResearchCrypto} from './crypto-research-marketset.mjs';

export const MEMORY_SCHEMA='SCALP_RESEARCH_MEMORY_V1';
export const MEMORY_BRANCH='scalp-learning-memory';
const GRID=Object.freeze([
 [6,26],[9,34],[12,48],[4,16],[5,21],[7,28],
 [8,32],[10,40],[14,56],[16,64],[20,80],
 [4,24],[5,35],[7,42],[9,54],[12,72]
].map(([fast,slow])=>Object.freeze({fast,slow})));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const key=p=>p.fast+':'+p.slow;
const finite=Number.isFinite;
const strictDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const strictParams=p=>p&&Number.isInteger(p.fast)&&Number.isInteger(p.slow)&&
 p.fast>=2&&p.slow>p.fast&&p.slow<=120;
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
  for(const x of e.trainingOptions){
   if(!strictParams(x.params)||!Number.isInteger(x.closedTrades)||x.closedTrades<0||
      !finite(x.netProfitGbp)||!finite(x.winRatePct)||x.winRatePct<0||x.winRatePct>100||
      x.trainingScore!==null&&!finite(x.trainingScore))
      throw Error('Malformed training-only model evidence');
  }
 }
 return value;
}
export function proposeCandidates(memory,{symbol,feed}){
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
   .sort((a,b)=>b.scoreSum/b.trials-a.scoreSum/a.trials||a.params.fast-b.params.fast);
 const positive=ranked.filter(x=>x.netSum>0);
 const chosen=[],seen=new Set();
 const insert=p=>{if(!strictParams(p)||seen.has(key(p)))return;seen.add(key(p));chosen.push({...p});};
 // Keep a credible exploitation candidate only from independent TRAIN-only evidence.
 for(const row of positive.slice(0,2))insert(row.params);
 // Untried fixed grid gives bounded exploration and ensures unsuccessful
 // strategies teach the designer to look somewhere else next time.
 for(const item of GRID.filter(p=>!tried.has(key(p))).slice(0,6))insert(item);
 // Never report a run as proof of a successful learning algorithm.
 if(chosen.length<5)for(const p of GRID)insert(p);
 return {candidates:chosen.slice(0,6),market:symbol,feed,priorIndependentWindows:accepted.length,
   triedParameters:tried.size,
   basis:'TRAIN_ONLY_EVIDENCE_PLUS_BOUNDED_GRID_EXPLORATION',
   learnedFromHoldout:false,modelDeployed:false};
}
export function rememberTraining(memory,event){
 assertMemory(memory);
 const {symbol,feed,trainingStart,trainingEnd,trainFingerprint,trainingOptions}=event||{};
 if(!details(event)||!strictDate(trainingStart)||!strictDate(trainingEnd)||
    Date.parse(trainingStart)>=Date.parse(trainingEnd)||
    !/^[a-f0-9]{64}$/.test(trainFingerprint)||!Array.isArray(trainingOptions)||
    trainingOptions.length<1||trainingOptions.length>16)throw Error('Invalid training observation');
 const opts=trainingOptions.map(o=>({
   params:{fast:o.params?.fast,slow:o.params?.slow},
   closedTrades:o.trainingClosedTrades??o.closedTrades,
   netProfitGbp:o.trainingNetGbp??o.netProfitGbp,
   winRatePct:o.trainingWinRatePct??o.winRatePct,
   trainingScore:o.trainingScore??o.score??null
 }));
 const recordId=hash([memory.policy,symbol,feed,trainingStart,trainingEnd,trainFingerprint]);
 const existing=memory.experiments.find(e=>e.id===recordId);
 if(existing)return {memory,reason:'EXACT_DATA_REPLAY_DEDUPED',acceptedForLearning:false,recordId};
 const spans=memory.experiments.filter(e=>e.symbol===symbol&&e.feed===feed&&e.acceptedForLearning);
 const overlapping=spans.some(e=>Date.parse(trainingStart)<Date.parse(e.trainingEnd)&&
     Date.parse(e.trainingStart)<Date.parse(trainingEnd));
 const candidate={id:recordId,symbol,feed,trainingStart,trainingEnd,trainFingerprint,
    acceptedForLearning:!overlapping,trainingOptions:opts,
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
