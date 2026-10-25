/** PLI v2: contextual, cost-aware, point-in-time research model. NO BROKER API.
 * Standalone sidecar to legacy PLI; no change to existing Teacher, SL or orders.
 */
import {createHash} from 'node:crypto';
import {validateDiscoveryBars,COMMODITY_TIMEFRAMES} from './opportunity-discovery.mjs';
import {levelsAt,createSetups,simulate,summarize,nonoverlap,suggestLevelSetups} from './price-level-intelligence.mjs';
export const PLI_V2_SCHEMA='SCALP_PLI_CONTEXTUAL_RESEARCH_V2';
export const PLI_V2_MODEL_SCHEMA='SCALP_PLI_CONTEXTUAL_MODEL_V2';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rnd=x=>Number(x.toFixed(6));
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const FEATURES=['bias','breakout','rejection','sweep','retest','directional','ranging','volatile',
 'side','rewardRisk','sourceTouches','sourceRecency','stopAtr','bodyAtr','approachTrend','levelSpanAtr'];
const BPS_PER_UNIT=10000;
function validStudent(symbol,timeframe){
 if(!['XAUUSD','XAGUSD'].includes(symbol)||!['5Min','15Min'].includes(timeframe)||symbol==='XAGUSD'&&timeframe!=='15Min')
  throw Error('Unsupported market specialist or native timeframe');
}
/** All predictor inputs use historical bars <= signalIndex, and no trade outcome. */
export function levelFeatureVector(b,i,s,atr){
 if(i<20||i>=b.length||!Number.isFinite(atr)||atr<=0)throw Error('Invalid signal context');
 const side=s.side==='LONG'?1:-1,c=b[i];
 const xs=[1,Number(s.pattern==='BREAKOUT'),Number(s.pattern==='REJECTION'),
  Number(s.pattern==='SWEEP'),Number(s.pattern==='RETEST'),
  Number(s.regime==='DIRECTIONAL'),Number(s.regime==='RANGING'),Number(s.regime==='VOLATILE'),
  side,cap(s.indicativeRR/3,0,2),cap(s.sourceZone.touches/5,0,2),
  1-cap(s.sourceZone.ageBars/192,0,1),cap(s.plannedRisk/atr,0,3),
  cap(side*(c.c-c.o)/atr,-3,3),cap(side*(c.c-b[i-8].c)/(8*atr),-3,3),
  cap(Math.abs(s.targetLevel-s.originLevel)/atr,0,5)];
 if(xs.length!==FEATURES.length||xs.some(x=>!Number.isFinite(x)))throw Error('Nonfinite level inputs');
 return xs;
}
function fitRidge(groups,{notionalGbp,lambda=30,clipBps=200}={}){
 const size=FEATURES.length,m=Array.from({length:size},()=>Array(size+1).fill(0));
 for(const g of groups){
  const weight=1/g.rows.length;
  for(const row of g.rows){
   const x=row.features,y=cap(row.stressNetGbp/notionalGbp*BPS_PER_UNIT,-clipBps,clipBps);
   for(let a=0;a<size;a++){
    m[a][size]+=weight*x[a]*y;
    for(let k=0;k<size;k++)m[a][k]+=weight*x[a]*x[k];
   }
  }
 }
 for(let a=0;a<size;a++)m[a][a]+=a===0?lambda*.3:lambda;
 // Stable, deterministic pivoting with ridge positive diagonal.
 for(let col=0;col<size;col++){
  let pivot=col;
  for(let r=col+1;r<size;r++)if(Math.abs(m[r][col])>Math.abs(m[pivot][col]))pivot=r;
  if(Math.abs(m[pivot][col])<1e-12)throw Error('Singular ridge coefficients');
  [m[col],m[pivot]]=[m[pivot],m[col]];
  const scale=m[col][col];for(let k=col;k<=size;k++)m[col][k]/=scale;
  for(let row=0;row<size;row++)if(row!==col){
   const factor=m[row][col];for(let k=col;k<=size;k++)m[row][k]-=factor*m[col][k];
  }
 }
 return m.map(row=>rnd(row[size]));
}
function trainExperts(groups,notionalGbp){
 const stats={};
 for(const g of groups){
  const weight=1/g.rows.length;
  for(const r of g.rows){
   const k=r.pattern+'|'+r.regime,stat=stats[k]??={weightedN:0,groups:new Set(),sumBps:0,sumSqBps:0,wins:0};
   const y=cap(r.stressNetGbp/notionalGbp*BPS_PER_UNIT,-200,200);
   stat.weightedN+=weight;stat.groups.add(g.i);stat.sumBps+=weight*y;
   stat.sumSqBps+=weight*y*y;stat.wins+=weight*Number(r.stressNetGbp>0);
  }
 }
 return Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,{
  nGroups:v.groups.size,effectiveN:rnd(v.weightedN),meanBps:rnd(v.sumBps/v.weightedN),
  stdBps:rnd(Math.sqrt(Math.max(0,v.sumSqBps/v.weightedN-(v.sumBps/v.weightedN)**2))),
  profitableFraction:rnd(v.wins/v.weightedN)
 }]));
}
function validateModel(model,symbol,timeframe){
 if(model?.schema!==PLI_V2_MODEL_SCHEMA||model.symbol!==symbol||model.timeframe!==timeframe||
  model.enabledForBroker!==false||model.paperTradingEligible!==false||model.liveTradingEligible!==false||
  model.modelPromoted!==false||model.fitProvenance!=='FIT_ONLY'||
  !Array.isArray(model.coefficients)||model.coefficients.length!==FEATURES.length||
  model.coefficients.some(x=>!Number.isFinite(x))||!model.experts||![0,2,4,8,12,20,101].includes(model.entryMarginBps)||!Number.isInteger(model.minGroups)||model.minGroups<3||model.minGroups>100)
  throw Error('Wrong, corrupted or unsafe contextual PLI checkpoint');
}
/** Forecast is net stressed expectancy *estimate*, not a calibrated hit probability. */
export function predictLevelEdge(model,{features,pattern,regime},{symbol=model?.symbol,timeframe=model?.timeframe}={}){
 validStudent(symbol,timeframe);validateModel(model,symbol,timeframe);
 if(!Array.isArray(features)||features.length!==FEATURES.length||features.some(x=>!Number.isFinite(x)))
  throw Error('Invalid causal level feature vector');
 const expert=model.experts[pattern+'|'+regime];
 if(!expert||expert.nGroups<model.minGroups)return {action:'ABSTAIN_UNSEEN_CONTEXT',
  expectedStressBps:null,lowerBoundBps:null,evidenceGroups:expert?.nGroups??0};
 const lin=model.coefficients.reduce((s,v,i)=>s+v*features[i],0);
 const shrunk=expert.meanBps*expert.effectiveN/(expert.effectiveN+18);
 const estimate=.6*lin+.4*shrunk;
 const noise=expert.stdBps/Math.sqrt(Math.max(1,expert.effectiveN));
 // Reject weak estimates: a conservative, but NOT formal statistical confidence bound.
 const lower=estimate-.5*noise;
 return {action:model.entryMarginBps<=100&&lower>=model.entryMarginBps?'RESEARCH_CANDIDATE':'ABSTAIN_NO_EDGE',
  expectedStressBps:rnd(estimate),lowerBoundBps:rnd(lower),
  evidenceGroups:expert.nGroups,modelVersion:PLI_V2_MODEL_SCHEMA,
  statisticalGuarantee:false,calibrated:false};
}
function scan(b,ms,{holdBars,notionalGbp,sideCostBps,stressSideCostBps,scanStepBars},fitEnd,tuneStart,trainEnd,testStart){
 const testBound=testStart-holdBars-2,groups=[];
 for(let i=192;i<testBound;i+=scanStepBars){
  const phase=i<fitEnd?'FIT':i>=tuneStart&&i<trainEnd-holdBars-2?'TUNE':i>=trainEnd?'DEVELOPMENT':null;
  if(!phase)continue;
  let continuous=true;
  for(let j=Math.max(1,i-32);j<=i;j++)if(Date.parse(b[j].t)-Date.parse(b[j-1].t)!==ms){continuous=false;break;}
  if(!continuous)continue;
  const {levels,atr,regime}=levelsAt(b,i);
  if(!atr||regime==='UNKNOWN'||regime==='CHOPPY')continue;
  const setups=createSetups(b,i,levels,atr,regime),rows=[];
  for(const setup of setups){
   const outcome=simulate(b,i,setup,{holdBars,notionalGbp,sideCostBps,stressSideCostBps,timeframeMs:ms});
   if(!outcome)continue;
   const closeIndex=b.findIndex((x,j)=>j>=i+1&&j<=i+holdBars&&x.t===outcome.closedAt);
   if(closeIndex<0)throw Error('Unresolved outcome index');
   rows.push({...setup,...outcome,features:levelFeatureVector(b,i,setup,atr),i,closeIndex,phase});
  }
  if(rows.length)groups.push({i,rows});
 }
 return groups;
}
function select(groups,model,{mode='model'}={}){
 const chosen=[];
 for(const group of groups){
  if(mode==='baseline'){
   const r=[...group.rows].sort((a,b)=>b.indicativeRR-a.indicativeRR||a.id.localeCompare(b.id))[0];
   chosen.push(r);continue;
  }
  const ranked=group.rows.map(r=>({r,forecast:predictLevelEdge(model,r)}))
   .filter(x=>x.forecast.action==='RESEARCH_CANDIDATE')
   .sort((a,b)=>b.forecast.lowerBoundBps-a.forecast.lowerBoundBps||a.r.id.localeCompare(b.r.id));
  if(ranked[0])chosen.push(ranked[0].r);
 }
 return nonoverlap(chosen);
}
export function researchContextualLevels({bars,symbol='XAUUSD',timeframe='15Min',now=Date.now(),
 sourceSha256=null,sideCostBps=8,stressSideCostBps=16,notionalGbp=1000,holdBars=12,
 scanStepBars=3,minGroups=8}={}){
 validStudent(symbol,timeframe);
 if([sideCostBps,stressSideCostBps,notionalGbp].some(x=>!Number.isFinite(x))||sideCostBps<0||
  stressSideCostBps<sideCostBps||stressSideCostBps>250||notionalGbp<50||
  !Number.isInteger(holdBars)||holdBars<2||holdBars>32||
  !Number.isInteger(scanStepBars)||scanStepBars<1||scanStepBars>12||
  !Number.isInteger(minGroups)||minGroups<3||minGroups>100)throw Error('Invalid research settings');
 const v=validateDiscoveryBars(bars,{now,timeframe}),b=v.bars,ms=COMMODITY_TIMEFRAMES[timeframe];
 if(b.length<1100)throw Error('Need >=1100 source candles for purged 60/20/20 study');
 const trainEnd=Math.floor(b.length*.6),testStart=Math.floor(b.length*.8),tuneStart=Math.floor(trainEnd*.8);
 const fitEnd=tuneStart-holdBars-2;
 const groups=scan(b,ms,{holdBars,notionalGbp,sideCostBps,stressSideCostBps,scanStepBars},fitEnd,tuneStart,trainEnd,testStart);
 const fit=groups.filter(g=>g.rows[0].phase==='FIT'),tune=groups.filter(g=>g.rows[0].phase==='TUNE'),dev=groups.filter(g=>g.rows[0].phase==='DEVELOPMENT');
 const coefficients=fitRidge(fit,{notionalGbp}),experts=trainExperts(fit,notionalGbp);
 const model={schema:PLI_V2_MODEL_SCHEMA,market:'COMMODITIES',symbol,timeframe,sourceSha256,
  trainedBefore:b[tuneStart].t,fitProvenance:'FIT_ONLY',features:[...FEATURES],coefficients,
  experts,minGroups,entryMarginBps:101,enabledForBroker:false,paperTradingEligible:false,
  liveTradingEligible:false,modelPromoted:false,calibrated:false,qualifiedStudent:false};
 const settings={sideCostBps,stressSideCostBps,notionalGbp,holdBars,scanStepBars,minGroups};
 // Tune one abstention margin on late TRAIN, NEVER on development / final holdout.
 const trialMargins=[0,2,4,8,12,20];
 const experiments=trialMargins.map(m=>{
  const mModel={...model,entryMarginBps:m},rows=select(tune,mModel);
  return {marginBps:m,...summarize(rows)};
 });
 const passing=experiments.filter(x=>x.trades>=8&&x.stressNetGbp>0)
  .sort((a,b)=>b.stressNetGbp-a.stressNetGbp||b.marginBps-a.marginBps);
 model.entryMarginBps=passing[0]?.marginBps??101;
 const fitMemory=fit.flatMap(g=>g.rows.map(r=>({id:r.id,signalAt:r.signalAt,closedAt:r.closedAt,
  market:'COMMODITIES',symbol,timeframe,pattern:r.pattern,regime:r.regime,side:r.side,
  originLevel:r.originLevel,destinationLevel:r.targetLevel,entry:r.entry,stop:r.stop,target:r.target,
  exit:r.exit,exitReason:r.exitReason,netGbp:r.netGbp,stressNetGbp:r.stressNetGbp,
  outcome:r.outcome,features:r.features,evidenceOrigin:'FIT_ONLY_COUNTERFACTUAL',
  isExecutedTrade:false,groupId:symbol+'|'+r.signalAt})));
 const devSelected=select(dev,model),refSelected=select(dev,model,{mode:'baseline'});
 const development=summarize(devSelected),baseline=summarize(refSelected);
 const report={schema:PLI_V2_SCHEMA,status:'HISTORICAL_DEVELOPMENT_ONLY',market:'COMMODITIES',symbol,timeframe,
  sourceSha256,sourceAuthenticated:false,
  chronology:{first:b[0].t,last:b.at(-1).t,candles:b.length,gaps:v.gaps,
   fitEndExclusive:b[fitEnd].t,tuningStart:b[tuneStart].t,developmentStart:b[trainEnd].t,
   sealedTestStart:b[testStart].t,sealedTestCandles:b.length-testStart,sealedTestEvaluated:false},
  settings,fit:{groups:fit.length,counterfactuals:fitMemory.length,experts},
  tuning:{groups:tune.length,experiments,chosenMarginBps:model.entryMarginBps,abstained:model.entryMarginBps>100},
  development:{...development,diagnosticOnly:true},
  comparison:{baselineHighestRR:baseline,cashStressNetGbp:0,
   // Same source and overlapping historical periods as v1: not independent evidence.
   baselineMethod:'highest_indicative_RR_at_each_signal_nonoverlap'},
  positivityGatePassed:development.trades>=20&&development.stressNetGbp>0&&
     development.netGbp>baseline.netGbp,
  modelSha256:hash(model),fitMemorySha256:hash(fitMemory),
  brokerOrders:0,paperOrders:0,liveOrders:0,automaticPromotion:false,
  independentExamPassed:false,fullSkillQualification:false,
  limitations:['No source/feed authenticity, live bid/ask, slippage, FX conversion or broker fills',
   'Outcomes are OHLC counterfactuals, with simultaneous TP/SL resolved stop first',
   'Ridge and expert estimates are not calibrated probabilities or formal confidence intervals',
   'Multiple observations at each timestamp are correlated and down-weighted during fitting',
   'Development on previously inspected historical data is diagnostic, not unseen confirmation',
   'Final 20% of bars remains unopened for an independent future Examiner',
   'No automatic trading eligibility regardless of simulated P&L']};
 return {model,report,memory:fitMemory};
}
/** Read-only forecast using pre-trained immutable, market-identity-checked checkpoint. */
export function contextualSetups({bars,symbol='XAUUSD',timeframe='15Min',model,now=Date.now()}={}){
 validStudent(symbol,timeframe);validateModel(model,symbol,timeframe);
 const map=suggestLevelSetups({bars,symbol,timeframe,now});
 const signalIndex=bars.length-1;
 return {...map,modelSchema:PLI_V2_MODEL_SCHEMA,setups:map.setups.map(s=>{
  const forecast=predictLevelEdge(model,{...s,features:levelFeatureVector(bars,signalIndex,s,map.atr)},{symbol,timeframe});
  return {...s,forecast,decision:forecast.action,brokerExecutable:false};
 })};
}
