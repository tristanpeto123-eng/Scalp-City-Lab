/** Price Level Intelligence v1 — causal, offline, market-isolated research ONLY.
 * No order routing, broker credentials, final-holdout scoring or model promotion.
 */
import {createHash} from 'node:crypto';
import {validateDiscoveryBars,COMMODITY_TIMEFRAMES} from './opportunity-discovery.mjs';
export const PLI_SCHEMA='SCALP_PLI_RESEARCH_V1';
export const PLI_MODEL_SCHEMA='SCALP_PLI_MODEL_V1';
const finite=Number.isFinite;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round=x=>Number(x.toFixed(6));
function validateParams({symbol,timeframe,sideCostBps,stressSideCostBps,notionalGbp}){
 if(!(['XAUUSD','XAGUSD'].includes(symbol))||(symbol==='XAGUSD'&&timeframe!=='15Min')||
  !['5Min','15Min'].includes(timeframe))throw Error('Unsupported market student or timeframe');
 if([sideCostBps,stressSideCostBps,notionalGbp].some(x=>!finite(x))||sideCostBps<0||
   stressSideCostBps<sideCostBps||stressSideCostBps>250||notionalGbp<50)throw Error('Invalid virtual cost/notional');
}
function atrAt(b,i,length=14){
 if(i<length)return null;
 let sum=0;
 for(let j=i-length+1;j<=i;j++){
  const p=b[j-1].c,c=b[j];sum+=Math.max(c.h-c.l,Math.abs(c.h-p),Math.abs(c.l-p));
 }
 return sum/length;
}
function regimeAt(b,i,atr){
 const span=20;
 if(i<span)return 'UNKNOWN';
 let travel=0;
 for(let j=i-span+1;j<=i;j++)travel+=Math.abs(b[j].c-b[j-1].c);
 const efficiency=travel?Math.abs(b[i].c-b[i-span].c)/travel:0;
 const vol=atr/b[i].c;
 return vol>.008?'VOLATILE':efficiency>.38?'DIRECTIONAL':efficiency<.13?'CHOPPY':'RANGING';
}
/** Confirmed pivots: right-hand confirmation bars MUST already be closed. */
function levelsAt(b,i,{lookback=192,pivotWidth=2,atrMultiplier=.25}={}){
 if(i<80||i>=b.length)throw Error('Need >=80 historical closed bars at signal');
 const atr=atrAt(b,i);if(!finite(atr)||atr<=0)return {levels:[],atr:0,regime:'UNKNOWN'};
 const eps=atr*atrMultiplier,start=Math.max(pivotWidth,i-lookback),raw=[];
 for(let j=start;j<=i-pivotWidth;j++){
  let hi=true,lo=true;
  for(let n=1;n<=pivotWidth;n++){
   if(b[j].h<=b[j-n].h||b[j].h<=b[j+n].h)hi=false;
   if(b[j].l>=b[j-n].l||b[j].l>=b[j+n].l)lo=false;
  }
  if(hi)raw.push({p:b[j].h,kind:'SWING_HIGH',j});
  if(lo)raw.push({p:b[j].l,kind:'SWING_LOW',j});
 }
 raw.sort((x,y)=>x.p-y.p||x.j-y.j);
 const clusters=[];
 for(const point of raw){
  const z=clusters.at(-1);
  if(z&&Math.abs(point.p-z.price)<=eps){
   z.price=(z.price*z.hits+point.p)/(z.hits+1);z.hits++;
   z.lastSeen=Math.max(z.lastSeen,point.j);z.highs+=point.kind==='SWING_HIGH'?1:0;
   z.lows+=point.kind==='SWING_LOW'?1:0;
  }else clusters.push({price:point.p,hits:1,lastSeen:point.j,highs:point.kind==='SWING_HIGH'?1:0,lows:point.kind==='SWING_LOW'?1:0});
 }
 const c=b[i].c;
 const levels=clusters.map((x,n)=>({
  id:'L'+n,price:round(x.price),lower:round(x.price-eps),upper:round(x.price+eps),
  touches:x.hits,ageBars:i-x.lastSeen,type:x.price<c-eps?'SUPPORT':x.price>c+eps?'RESISTANCE':'IN_ZONE',
  swingHighs:x.highs,swingLows:x.lows,strength:round(Math.min(1,(x.hits/4)*.7+.3*Math.max(0,1-(i-x.lastSeen)/lookback)))
 })).filter(x=>x.touches>=2||x.ageBars<48).sort((x,y)=>x.price-y.price);
 return {levels,atr:round(atr),regime:regimeAt(b,i,atr)};
}
export function mapKeyLevels({bars,signalIndex,symbol='XAUUSD',timeframe='15Min',now=Date.now()}={}){
 validateParams({symbol,timeframe,sideCostBps:0,stressSideCostBps:0,notionalGbp:1000});
 const b=validateDiscoveryBars(bars,{now,timeframe}).bars;
 const i=signalIndex??b.length-1;
 if(!Number.isInteger(i)||i<80||i>=b.length)throw Error('Invalid point-in-time signal index');
 const data=levelsAt(b,i);
 return {schema:PLI_SCHEMA,status:'RESEARCH_ONLY',symbol,timeframe,signalAt:b[i].t,
  ...data,brokerOrders:0,usesFutureCandles:false};
}
function createSetups(b,i,zones,atr,regime){
 const c=b[i],prev=b[i-1],proposals=[],costBuffer=atr*.28;
 if(regime==='CHOPPY'||regime==='UNKNOWN')return [];
 for(const z of zones){
  const dist=Math.abs(c.c-z.price),near=dist<=atr*.55;
  const strong=z.touches>=2;
  const candidate=[];
  if(strong&&near&&c.l<z.upper&&c.c>z.upper&&c.c>c.o)
   candidate.push(['REJECTION',1]);
  if(strong&&near&&c.h>z.lower&&c.c<z.lower&&c.c<c.o)
   candidate.push(['REJECTION',-1]);
  if(strong&&prev.c<=z.upper&&c.c>z.upper+atr*.12&&c.c>c.o)
   candidate.push(['BREAKOUT',1]);
  if(strong&&prev.c>=z.lower&&c.c<z.lower-atr*.12&&c.c<c.o)
   candidate.push(['BREAKOUT',-1]);
  if(strong&&c.l<z.lower-atr*.1&&c.c>z.upper&&c.c>c.o)
   candidate.push(['SWEEP',1]);
  if(strong&&c.h>z.upper+atr*.1&&c.c<z.lower&&c.c<c.o)
   candidate.push(['SWEEP',-1]);
  // Confirmed breakout in prior 8 bars, retesting the same level without losing it.
  if(strong&&near&&c.l<=z.upper&&c.c>z.upper&&c.c>c.o&&
     b.slice(Math.max(0,i-8),i-1).some(x=>x.c>z.upper+atr*.4))candidate.push(['RETEST',1]);
  if(strong&&near&&c.h>=z.lower&&c.c<z.lower&&c.c<c.o&&
     b.slice(Math.max(0,i-8),i-1).some(x=>x.c<z.lower-atr*.4))candidate.push(['RETEST',-1]);
  for(const [pattern,side] of candidate){
   const stop=side===1?z.lower-costBuffer:z.upper+costBuffer;
   const risk=side*(c.c-stop);
   if(risk<=atr*.22||risk>atr*2.5)continue;
   const destinations=zones.filter(x=>side*(x.price-c.c)>Math.max(risk*1.25,atr*.7))
       .sort((x,y)=>side*(x.price-y.price));
   const destination=destinations[0];if(!destination)continue;
   const target=side===1?destination.lower:destination.upper;
   const reward=side*(target-c.c);
   if(reward<=risk*1.15)continue;
   proposals.push({
    id:`${b[i].t}|${side}|${pattern}|${z.id}|${destination.id}`,
    signalAt:b[i].t,side:side===1?'LONG':'SHORT',pattern,regime,
    originLevel:z.price,targetLevel:destination.price,sourceZone:z,destinationZone:destination,
    indicativeEntry:round(c.c),stop:round(stop),target:round(target),
    indicativeRR:round(reward/risk),plannedRisk:round(risk),
    entryPolicy:'NEXT_CONTIGUOUS_BAR_OPEN',invalidation:'STOP_OR_TIME_EXIT',
    levelVersion:PLI_MODEL_SCHEMA,modelledOnly:true
   });
  }
 }
 return proposals.sort((a,b)=>b.indicativeRR-a.indicativeRR||a.id.localeCompare(b.id)).slice(0,12);
}
/** A live/chart caller provides only CLOSED bars. Never promotes signals to orders. */
export function suggestLevelSetups({bars,symbol='XAUUSD',timeframe='15Min',checkpoint=null,now=Date.now()}={}){
 const mapped=mapKeyLevels({bars,symbol,timeframe,now});
 if(checkpoint&&(checkpoint.schema!==PLI_MODEL_SCHEMA||checkpoint.symbol!==symbol||
    checkpoint.timeframe!==timeframe||checkpoint.enabledForBroker!==false))throw Error('Wrong or unsafe PLI market checkpoint');
 const raw=createSetups(bars,bars.length-1,mapped.levels,mapped.atr,mapped.regime);
 const setups=raw.map(s=>{
  const key=s.pattern+'|'+s.regime;
  const item=checkpoint?.statistics[key]??null;
  const n=item?.n??0;
  const successProbability=n>=checkpoint?.minSamples?(item.wins+1)/(n+2):null;
  return {...s,estimatedHitProbability:successProbability==null?null:round(successProbability),
   evidenceSamples:n,decision:successProbability==null?'ABSTAIN_INSUFFICIENT_EVIDENCE':
    successProbability>=checkpoint.minProbability?'RESEARCH_CANDIDATE':'ABSTAIN_UNFAVOURABLE',
   evidenceProvenance:'TRAIN_ONLY_NO_OOS_CALIBRATION',brokerExecutable:false};
 });
 return {...mapped,setups};
}
function simulate(b,i,s,{holdBars,sideCostBps,stressSideCostBps,notionalGbp,timeframeMs}){
 const side=s.side==='LONG'?1:-1,entryBar=b[i+1];
 if(!entryBar||Date.parse(entryBar.t)-Date.parse(b[i].t)!==timeframeMs)return null;
 const entry=entryBar.o,risk=side*(entry-s.stop),reward=side*(s.target-entry);
 if(risk<=0||reward<=0||reward/risk<1)return null;
 let maximumFavourable=0,maximumAdverse=0,closed=null;
 for(let j=i+1;j<=i+holdBars;j++){
  const bar=b[j],prior=b[j-1];if(!bar||Date.parse(bar.t)-Date.parse(prior.t)!==timeframeMs)return null;
  maximumFavourable=Math.max(maximumFavourable,side===1?bar.h-entry:entry-bar.l);
  maximumAdverse=Math.max(maximumAdverse,side===1?entry-bar.l:bar.h-entry);
  const openStop=side*(bar.o-s.stop)<=0,openTake=side*(s.target-bar.o)<=0;
  const lowStop=side===1?bar.l<=s.stop:bar.h>=s.stop;
  const highTake=side===1?bar.h>=s.target:bar.l<=s.target;
  if(openStop){closed={price:bar.o,reason:'STOP_GAP',j};break;}
  if(openTake){closed={price:s.target,reason:'TAKE_AT_OPEN',j};break;}
  if(lowStop){closed={price:s.stop,reason:highTake?'AMBIGUOUS_STOP_FIRST':'STOP',j};break;}
  if(highTake){closed={price:s.target,reason:'TAKE',j};break;}
  if(j===i+holdBars)closed={price:b[j+1]?.o??bar.c,reason:'TIME_EXIT',j};
 }
 if(!closed)return null;
 // No future bar beyond the declared max hold is required at time exit.
 if(closed.reason==='TIME_EXIT')closed.price=b[closed.j].c;
 const gross=side*(closed.price/entry-1);
 const net=notionalGbp*(gross-2*sideCostBps/1e4);
 const stress=notionalGbp*(gross-2*stressSideCostBps/1e4);
 return {entry:round(entry),exit:round(closed.price),closedAt:b[closed.j].t,exitReason:closed.reason,
  netGbp:round(net),stressNetGbp:round(stress),mfe:round(maximumFavourable),mae:round(maximumAdverse),
  outcome:net>1e-8?'GOOD':net< -1e-8?'BAD':'NEUTRAL',actualRR:round(reward/risk)};
}
function summarize(rows){
 let net=0,stress=0,wins=0,losses=0,profit=0,loss=0,peak=0,maxDrawdown=0;
 for(const r of rows){net+=r.netGbp;stress+=r.stressNetGbp;
  if(r.netGbp>0){wins++;profit+=r.netGbp;}else if(r.netGbp<0){losses++;loss-=r.netGbp;}
  peak=Math.max(peak,net);maxDrawdown=Math.max(maxDrawdown,peak-net);
 }
 return {trades:rows.length,wins,losses,netGbp:round(net),stressNetGbp:round(stress),
  winRate:rows.length?round(wins/rows.length):null,
  profitFactor:loss?round(profit/loss):null,maxDrawdownGbp:round(maxDrawdown)};
}
function eligible(r,stat,minSamples,minProbability){
 const k=r.pattern+'|'+r.regime,n=stat[k]?.n??0;
 const p=n>=minSamples?(stat[k].wins+1)/(n+2):null;
 return p!==null&&p>=minProbability;
}
function choose(candidates,statistics,minSamples,minProbability){
 return candidates.filter(r=>eligible(r,statistics,minSamples,minProbability))
  .sort((a,b)=>((statistics[b.pattern+'|'+b.regime].wins+1)/(statistics[b.pattern+'|'+b.regime].n+2))*b.indicativeRR-
                    ((statistics[a.pattern+'|'+a.regime].wins+1)/(statistics[a.pattern+'|'+a.regime].n+2))*a.indicativeRR||a.id.localeCompare(b.id))[0]??null;
}
function nonoverlap(rows){
 const selected=[];let until=-1;
 for(const row of rows){if(row.i<=until)continue;selected.push(row);until=row.closeIndex;}
 return selected;
}
/** Research walk-forward: TRAIN (60%, internal fit/tune), DEVELOPMENT (20%), 20% sealed. */
export function researchLevelTransitions({bars,symbol='XAUUSD',timeframe='15Min',now=Date.now(),
 sideCostBps=8,stressSideCostBps=16,notionalGbp=1000,holdBars=12,
 minSamples=8,sourceSha256=null}={}){
 validateParams({symbol,timeframe,sideCostBps,stressSideCostBps,notionalGbp});
 if(!Number.isInteger(holdBars)||holdBars<2||holdBars>32||!Number.isInteger(minSamples)||minSamples<2||minSamples>100)
  throw Error('Invalid forecast horizon or evidence threshold');
 const b=validateDiscoveryBars(bars,{now,timeframe}).bars,ms=COMMODITY_TIMEFRAMES[timeframe];
 if(b.length<1100)throw Error('Need >=1100 genuine historical bars for purged train/development');
 const trainEnd=Math.floor(b.length*.6),testStart=Math.floor(b.length*.8),tuneStart=Math.floor(trainEnd*.8);
 const fitEnd=tuneStart-holdBars-2,devEnd=testStart-holdBars-2;
 const candidates=[];
 for(let i=192;i<devEnd;i+=4){
  if(i>=fitEnd&&i<tuneStart||i>=trainEnd-holdBars-2&&i<trainEnd)continue;
  let ok=true;for(let j=i-192;j<=i;j++){
   if(j>0&&j>i-32&&Date.parse(b[j].t)-Date.parse(b[j-1].t)!==ms){ok=false;break;}
  }
  if(!ok)continue;
  const {levels,atr,regime}=levelsAt(b,i),setups=createSetups(b,i,levels,atr,regime);
  const phase=i<fitEnd?'FIT':i<tuneStart?'SKIP':i<trainEnd-holdBars-2?'TUNE':'DEVELOPMENT';
  if(phase==='SKIP')continue;
  const scored=setups.map(s=>{
   const virtual=simulate(b,i,s,{holdBars,sideCostBps,stressSideCostBps,notionalGbp,timeframeMs:ms});
   if(!virtual)return null;
   const closeIndex=b.findIndex((x,j)=>j>=i+1&&j<=i+holdBars&&x.t===virtual.closedAt);
   return {...s,...virtual,phase,i,closeIndex,market:'COMMODITIES',symbol,timeframe};
  }).filter(Boolean);
  if(scored.length)candidates.push({i,rows:scored});
 }
 const fits=candidates.filter(x=>x.rows[0].phase==='FIT');
 const stats={};
 // One potentially selected candidate per signal time, not independent long/short labels.
 for(const group of fits){
  const row=group.rows.sort((a,b)=>b.indicativeRR-a.indicativeRR||a.id.localeCompare(b.id))[0];
  const key=row.pattern+'|'+row.regime;
  const stat=stats[key]??={n:0,wins:0,netGbp:0,stressNetGbp:0,mfe:0,mae:0};
  stat.n++;stat.wins+=row.netGbp>0?1:0;stat.netGbp+=row.netGbp;stat.stressNetGbp+=row.stressNetGbp;
  stat.mfe+=row.mfe;stat.mae+=row.mae;
 }
 for(const v of Object.values(stats)){
  v.netGbp=round(v.netGbp);v.stressNetGbp=round(v.stressNetGbp);
  v.avgMfe=round(v.mfe/v.n);v.avgMae=round(v.mae/v.n);delete v.mfe;delete v.mae;
 }
 const thresholds=[.5,.55,.6,.65,.7,.75,.8];
 const phaseRows=(phase,probability,reference=false)=>{
  const groups=candidates.filter(x=>x.rows[0].phase===phase),picked=[];
  for(const g of groups){
   const candidate=reference?g.rows.find(r=>r.side===(b[g.i].c>=b[g.i-3].c?'LONG':'SHORT')):
     choose(g.rows,stats,minSamples,probability);
   if(candidate)picked.push(candidate);
  }
  return nonoverlap(picked);
 };
 const comparisons=thresholds.map(th=>({threshold:th,...summarize(phaseRows('TUNE',th))}));
 const winners=comparisons.filter(x=>x.trades>=5&&x.stressNetGbp>0).sort((a,b)=>b.stressNetGbp-a.stressNetGbp||b.threshold-a.threshold);
 const minProbability=winners[0]?.threshold??1.01;
 const tune=phaseRows('TUNE',minProbability),dev=phaseRows('DEVELOPMENT',minProbability),reference=phaseRows('DEVELOPMENT',.5,true);
 const memory=fits.flatMap(g=>g.rows.map(r=>({id:r.id,signalAt:r.signalAt,closedAt:r.closedAt,
  symbol:r.symbol,timeframe:r.timeframe,pattern:r.pattern,regime:r.regime,side:r.side,
  levelFrom:r.originLevel,levelTo:r.targetLevel,entry:r.entry,exit:r.exit,stop:r.stop,target:r.target,
  exitReason:r.exitReason,outcome:r.outcome,netGbp:r.netGbp,stressNetGbp:r.stressNetGbp,
  mfe:r.mfe,mae:r.mae,evidenceOrigin:'COUNTERFACTUAL_TRAIN_FIT'})));
 const model={schema:PLI_MODEL_SCHEMA,symbol,timeframe,market:'COMMODITIES',
  trainedBefore:b[tuneStart].t,statistics:stats,minSamples,minProbability,
  enabledForBroker:false,modelPromoted:false,calibrated:false,sourceSha256,
  memorySha256:digest(memory),researchOnly:true};
 const result={schema:PLI_SCHEMA,status:'HISTORICAL_DEVELOPMENT_ONLY',symbol,timeframe,sourceSha256,
  data:{first:b[0].t,last:b.at(-1).t,bars:b.length,trainEnd:b[trainEnd].t,tuneStart:b[tuneStart].t,
   developmentStart:b[trainEnd].t,sealedTestStart:b[testStart].t,
   sealedTestCandles:b.length-testStart,sealedTestEvaluated:false},
  settings:{sideCostBps,stressSideCostBps,notionalGbp,holdBars,minSamples,scanStepBars:4},
  learning:{fitSignalGroups:fits.length,fitCounterfactuals:memory.length,statistics:stats,
   selectedThreshold:minProbability,abstained:minProbability>1,tuningComparisons:comparisons},
  tuning:summarize(tune),development:summarize(dev),baseline:summarize(reference),
  profitabilityGatePassed:dev.length>=20&&summarize(dev).stressNetGbp>0&&summarize(dev).netGbp>summarize(reference).netGbp,
  modelSha256:digest(model),memorySha256:model.memorySha256,
  brokerOrders:0,paperOrders:0,liveOrders:0,modelPromotions:0,automaticPromotion:false,
  limitations:['Unverified OHLC source, unknown actual bid/ask fees and slippage',
   'TRAIN-derived conditional hit frequency is NOT calibrated forward probability',
   'Synthetic or historical counterfactuals are not broker fills',
   'OHLC simultaneous stop and take: stop first; gaps are not backfilled',
   'The final 20% is sealed; development reuse invalidates it as a fresh confirmation',
   'No independent risk examiner, broker-paper validation or full agent skill qualification']};
 return {model,report:result,memory};
}