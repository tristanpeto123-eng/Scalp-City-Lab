// UI-facing research report contract. Offline only; never signs grades or places orders.
import {checkSnapshot,simulateValidation,PAIRS} from './strategy-validation-core.mjs';
import {validateAdaptive} from './strategy-adaptive-model.mjs';
export const SESSION_VERSION='SCALP_RESEARCH_DESK_V2';
export const RESEARCH_MODES=Object.freeze(['auto','invent','ema','rsi','breakout']);
const round=(n)=>Math.round((n+Number.EPSILON)*100)/100;
export function candidateVerdict(c){
 if(!c)return 'NO_CANDIDATE';
 return c.eligible?'INTERNAL_SCREEN_PASSED':'DEVELOPMENT_REJECTED';
}
export function runResearchSession({snapshot,symbol,startingBalanceGbp=50,mode='duration',limit=14,strategyMode='auto',now=Date.now()}={}){
 if(!RESEARCH_MODES.includes(strategyMode))throw Error('Select a supported strategy research mode');
 if(!PAIRS.includes(symbol))throw Error('Select a supported market');
 if(!Number.isFinite(startingBalanceGbp)||startingBalanceGbp<50||startingBalanceGbp>1000000)throw Error('Virtual starting balance must be between £50 and £1,000,000');
 if(!Number.isFinite(limit)||limit<=0)throw Error('Enter a positive goal value');
 const src=checkSnapshot(snapshot,symbol,now);
 const evidence={
  source:src.source,candles:src.bars.length,sampleStart:src.sampleStart,sampleEnd:src.sampleEnd,
  snapshotAt:src.snapshotAt,market:symbol,
  dataUse:'Offline historical simulation, not new market evidence or an independent forward result'
 };
 const input={snapshot,symbol,startingBalanceGbp,mode,limit,now};
 if(strategyMode==='auto'||strategyMode==='invent'){
  const outcome=validateAdaptive({...input,strategyMode:strategyMode==='invent'?'invent':'preset'});
  const model=outcome.model;
  const candidates=Array.isArray(model.candidates)?model.candidates:[];
  const qualified=candidates.filter(c=>c.eligible);
  const best=candidates[0]||null;
  return {
   version:SESSION_VERSION,type:'research',strategyMode,symbol,startingBalanceGbp,
   goal:{mode,limit},evidence,model,outcome,
   candidates,passingCount:qualified.length,evaluatedCount:candidates.length,
   bestCandidate:best,selected:model.selected||null,replay:outcome.replay||null,
   decision:model.selected?'CANDIDATE_FROZEN_FOR_HISTORICAL_CHECK':'NO_ELIGIBLE_DEVELOPMENT_CANDIDATE',
   decisionReason:model.selected?
    'One candidate passed internal development gates. Historical replay does not confer Teacher eligibility.':
    (candidates.length?
    'No candidate passed the independent development and doubled-fee checks. Ranked attempts and rejection reasons are available below.':
    'Not enough training history to assess candidates.'),
   independentForwardValidated:false,officialGrade:null,brokerOrders:0
  };
 }
 const replay=simulateValidation({...input,strategy:strategyMode});
 return {
  version:SESSION_VERSION,type:'manual',strategyMode,symbol,startingBalanceGbp,
  goal:{mode,limit},evidence,model:null,outcome:null,
  candidates:[],passingCount:0,evaluatedCount:1,bestCandidate:null,
  selected:null,replay,
  decision:'MANUAL_HISTORICAL_REPLAY',decisionReason:'This replays a fixed rule against history. It is not an independently screened candidate.',
  independentForwardValidated:false,officialGrade:null,brokerOrders:0
 };
}
export function compactSessionRecord(session,recordedAt=new Date().toISOString()){
 return {
  version:SESSION_VERSION,recordedAt,market:session.symbol,mode:session.strategyMode,
  startingBalanceGbp:session.startingBalanceGbp,goal:session.goal,
  decision:session.decision,experimentCount:session.evaluatedCount,
  internallyPassing:session.passingCount,
  researchLeader:session.bestCandidate?{
   name:session.bestCandidate.label,eligible:session.bestCandidate.eligible,
   discoveryNetGbp:session.bestCandidate.discovery.netGbp,
   confirmationNetGbp:session.bestCandidate.confirmation.netGbp,
   doubledCostNetGbp:session.bestCandidate.doubledFee.netGbp,
   rejectedBecause:session.bestCandidate.rejection
  }:null,
  replay:session.replay?{
   netGbp:round(session.replay.realizedNetProfitGbp),
   closedTrades:session.replay.closedTrades,winRatePct:session.replay.winRatePct,
   drawdownPct:session.replay.maxDrawdownPct,stopReason:session.replay.status
  }:null,
  evidence:session.evidence,independentForwardValidated:false,officialGrade:null,brokerOrders:0
 };
}
