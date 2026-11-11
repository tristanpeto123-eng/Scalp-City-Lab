/** Academy Teacher v1: isolated offline historical neural training. NO broker integration. */
import {createHash} from 'node:crypto';
import {studentSkillContract,assertStudentQualified} from './student-skill-contract.mjs';
export const TEACHER_SCHEMA='ACADEMY_TEACHER_RESEARCH_V1';
const finite=Number.isFinite;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const sigmoid=z=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function inputs(c){
 const s=c.scenario;
 const x=[...c.features,2*s.holdCandles/24-1,2*s.stopBps/1000-1,2*s.takeBps/1000-1];
 if(x.length!==9||x.some(v=>!finite(v)||v< -1||v>1))throw Error('Invalid pre-entry features');
 return x;
}
function groups(candidates){
 const m=new Map();
 for(const c of candidates){if(!m.has(c.groupId))m.set(c.groupId,[]);m.get(c.groupId).push(c);}
 return [...m.values()].sort((a,b)=>a[0].signalAt.localeCompare(b[0].signalAt));
}
function forward(w,x){
 const h=w.w1.map((r,j)=>Math.tanh(w.b1[j]+r.reduce((s,v,i)=>s+v*x[i],0)));
 return {h,p:sigmoid(w.b2+w.w2.reduce((s,v,j)=>s+v*h[j],0))};
}
export function predictTeacher(checkpoint,candidate){
 if(checkpoint?.schema!=='ACADEMY_TEACHER_MODEL_V1'||checkpoint?.enabledForBroker!==false)throw Error('Invalid research checkpoint');
 if(candidate?.symbol!==checkpoint.symbol)throw Error('Wrong commodity checkpoint for candidate');
 return forward(checkpoint.weights,inputs(candidate)).p;
}
function validate(r){
 if(!r||r.schema!=='ACADEMY_OPPORTUNITY_DISCOVERY_V1'||r.status!=='HISTORICAL_RESEARCH_ONLY'||
 !['XAUUSD','XAGUSD'].includes(r.symbol)||!['5Min','15Min'].includes(r.timeframe)||r.dataset?.sealedTestEvaluated!==false||!r.dataset.sealedTestStart||
 r.brokerOrders!==0||r.modelPromotions!==0||r.verifiedForwardGrades!==0||
 !Array.isArray(r.opportunities)||r.opportunities.length<60)throw Error('Requires offline Discovery with sealed test');
 const split={TRAIN:[],DEVELOPMENT:[]},seen=new Set();
 for(const c of r.opportunities){
  const label=c.netPnlGbp>1e-8?'GOOD':c.netPnlGbp< -1e-8?'BAD':'NEUTRAL';
  if(!c||!['TRAIN','DEVELOPMENT'].includes(c.phase)||!c.groupId||!c.id||seen.has(c.id)||
   c.symbol!==r.symbol||c.market!=='COMMODITIES'||!['LONG','SHORT'].includes(c.side)||!finite(c.netPnlGbp)||!finite(c.stressNetPnlGbp)||
   c.stressNetPnlGbp>c.netPnlGbp+1e-7||c.label!==label||
   c.binaryLabel!==(label==='GOOD'?1:label==='BAD'?0:null)||c.isCounterfactual!==true||
   !(Date.parse(c.signalAt)<Date.parse(c.openedAt))||
   Date.parse(c.closedAt)<Date.parse(c.openedAt)||
   Date.parse(c.closedAt)>=Date.parse(r.dataset.sealedTestStart))
   throw Error('Rejected invalid or leaking candidate');
  inputs(c);seen.add(c.id);split[c.phase].push(c);
 }
 for(const phase of Object.keys(split)){
  const g=groups(split[phase]);if(g.length<12)throw Error('Insufficient research timestamp groups');
  for(const group of g)if(new Set(group.map(c=>c.signalAt)).size!==1)throw Error('Mixed timestamp group');
 }
 if(Math.max(...split.TRAIN.map(c=>Date.parse(c.closedAt)))>=
    Math.min(...split.DEVELOPMENT.map(c=>Date.parse(c.signalAt))))
    throw Error('Train-development overlap');
 return split;
}
function evaluate(w,g,threshold){
 let pnl=0,stress=0,peak=0,dd=0,wins=0,losses=0,won=0,lost=0,selected=0;
 for(const group of g){
  const best=group.map(c=>({c,p:forward(w,inputs(c)).p})).sort((a,b)=>b.p-a.p||a.c.id.localeCompare(b.c.id))[0];
  if(best.p<threshold)continue;
  const c=best.c;selected++;pnl+=c.netPnlGbp;stress+=c.stressNetPnlGbp;
  peak=Math.max(peak,pnl);dd=Math.max(dd,peak-pnl);
  if(c.netPnlGbp>0){wins++;won+=c.netPnlGbp;}
  if(c.netPnlGbp<0){losses++;lost-=c.netPnlGbp;}
 }
 return {candidateGroups:g.length,selectedTrades:selected,wins,losses,netGbp:Number(pnl.toFixed(6)),
 stressNetGbp:Number(stress.toFixed(6)),maxDrawdownGbp:Number(dd.toFixed(6)),
 profitFactor:lost>0?Number((won/lost).toFixed(4)):null};
}
function momentumReference(g){
 let net=0,stress=0,n=0;
 for(const group of g){
  const direction=group[0].features[1]>=0?'LONG':'SHORT';
  const c=group.filter(x=>x.side===direction).sort((a,b)=>a.scenario.holdCandles-b.scenario.holdCandles||a.id.localeCompare(b.id))[0];
  if(c){net+=c.netPnlGbp;stress+=c.stressNetPnlGbp;n++;}
 }
 return {selectedTrades:n,netGbp:Number(net.toFixed(6)),stressNetGbp:Number(stress.toFixed(6))};
}
export function trainAcademyTeacher(discovery,{seed=20261025,epochs=65,learningRate=.012,requireFullSkillStack=false}={}){
 const split=validate(discovery);
 const skillContract=studentSkillContract({symbol:discovery.symbol,timeframe:discovery.timeframe});
 // Full agent training and admission must never silently fall back to legacy classifier code.
 if(requireFullSkillStack)assertStudentQualified(skillContract,{purpose:'FULL_SKILL_STACK_TRAINING'});
 if(!Number.isInteger(seed)||seed<0||!Number.isInteger(epochs)||epochs<1||epochs>500||
 !finite(learningRate)||learningRate<=0||learningRate>.05)throw Error('Invalid Teacher training controls');
 const all=groups(split.TRAIN),cut=Math.floor(.8*all.length),tune=all.slice(cut),dev=groups(split.DEVELOPMENT);
 const tuneStart=Date.parse(tune[0][0].signalAt);
 const fitting=all.slice(0,cut).filter(g=>g.every(c=>Date.parse(c.closedAt)<tuneStart));
 const candidates=fitting.flat().filter(c=>c.binaryLabel!==null);
 if(fitting.length<20||tune.length<10||dev.length<12||candidates.length<40||
 new Set(candidates.map(c=>c.binaryLabel)).size!==2)throw Error('Insufficient Good and Bad training samples');
 const rand=random(seed);
 const w={w1:Array.from({length:12},()=>Array.from({length:9},()=>(rand()-.5)*.2)),
  b1:Array(12).fill(0),w2:Array.from({length:12},()=>(rand()-.5)*.2),b2:0};
 const magnitudes=candidates.map(c=>Math.abs(c.netPnlGbp)).sort((a,b)=>a-b);
 const median=magnitudes[Math.floor(magnitudes.length/2)]||1;
 const good=candidates.filter(c=>c.binaryLabel===1).length;
 const cw={0:Math.min(2,Math.max(.5,candidates.length/(2*(candidates.length-good)))),
           1:Math.min(2,Math.max(.5,candidates.length/(2*good)))};
 for(let epoch=0;epoch<epochs;epoch++){
  const order=[...fitting.keys()];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(const k of order){
   const set=fitting[k].filter(c=>c.binaryLabel!==null);
   for(const c of set){
    const x=inputs(c),{h,p}=forward(w,x);
    const amount=Math.min(3,Math.max(.33,Math.abs(c.netPnlGbp)/median));
    const delta=(p-c.binaryLabel)*amount*cw[c.binaryLabel]/set.length;
    const old=[...w.w2];
    for(let j=0;j<12;j++)w.w2[j]-=learningRate*delta*h[j];
    w.b2-=learningRate*delta;
    for(let j=0;j<12;j++){
     const d=delta*old[j]*(1-h[j]*h[j]);
     for(let i=0;i<9;i++)w.w1[j][i]-=learningRate*d*x[i];
     w.b1[j]-=learningRate*d;
    }
   }
  }
 }
 const options=[.4,.45,.5,.55,.6,.65,.7,.75,.8,.85,.9].map(threshold=>({threshold,...evaluate(w,tune,threshold)}))
  .filter(s=>s.selectedTrades>=8&&s.netGbp>0&&s.stressNetGbp>0)
  .sort((a,b)=>b.stressNetGbp-a.stressNetGbp||b.netGbp-a.netGbp||b.threshold-a.threshold);
 const threshold=options[0]?.threshold??1.01; // Abstain if no profitable training-only threshold.
 const checkpoint={schema:'ACADEMY_TEACHER_MODEL_V1',symbol:discovery.symbol,timeframe:discovery.timeframe,market:'COMMODITIES',
  architecture:'9x12x1_TANH_SIGMOID',weights:w,threshold,trainedThrough:fitting.at(-1).at(-1).closedAt,
  enabledForBroker:false,state:'RESEARCH_CHECKPOINT_NOT_APPROVED',
  studentSkillContractVersion:skillContract.schema,
  researchArchitecture:skillContract.architecture,
  qualifiedAgent:false,skillStackImplemented:false,
  inputNames:['trend','momentum','volatility','relativeVolume','distanceFromLevel','side','holdCandles','stopBps','takeBps']};
 const checkpointSha256=hash(checkpoint),score=evaluate(w,dev,threshold),baseline=momentumReference(dev),
  tuning=evaluate(w,tune,threshold);
 const report={schema:TEACHER_SCHEMA,status:'HISTORICAL_DEVELOPMENT_ONLY',symbol:discovery.symbol,timeframe:discovery.timeframe,
  sourceSha256:discovery.sourceSha256??null,
  discoveryDigest:hash({dataset:discovery.dataset,parameters:discovery.parameters,opportunities:discovery.opportunities}),
  checkpointSha256,groups:{fit:fitting.length,tune:tune.length,development:dev.length},
  samples:{good,bad:candidates.length-good,fit:candidates.length},
  training:{epochs,learningRate,seed,threshold,abstained:threshold>1,groupWeighted:true},
  internalTuning:{netGbp:tuning.netGbp,stressNetGbp:tuning.stressNetGbp,selectedTrades:tuning.selectedTrades},
  development:score,comparison:{cashNetGbp:0,momentumBaseline:baseline},
  developmentProfitGatePassed:score.selectedTrades>=10&&score.netGbp>0&&score.stressNetGbp>0&&score.netGbp>baseline.netGbp,
  studentSkillAudit:skillContract,studentGraduationGatePassed:false,
  specialistAgentQualified:false,brokerPaperEligible:false,
  verifiedForwardGrades:0,paperOrders:0,liveOrders:0,automaticPromotion:false,independentFinalTestEvaluated:false,
  warnings:['This is an old-style neural baseline; all requested specialist skills are NOT integrated',
   'Skill-based graduation is blocked until each skill is implemented and independently tested',
   'Offline outcomes are unverified correlated historical counterfactuals','Development is not authenticated forward-paper evidence',
   'Sealed final 20% of price history was never scored','No broker orders or automatic model deployment']};
 return {checkpoint,report};
}