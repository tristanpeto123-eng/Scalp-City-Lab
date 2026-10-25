/**
 * Scalp City Academy v2 skill governance.
 *
 * A student's neural weights do not prove that shared strategy skills exist.
 * This registry reports only code-backed capabilities available in the current
 * isolated historical research lane. Neither flags nor manifests enable orders.
 */
export const STUDENT_SKILL_CONTRACT_VERSION='ACADEMY_STUDENT_SKILLS_V1';
export const SKILL_IMPLEMENTATION_STATES=Object.freeze(['IMPLEMENTED','PARTIAL','NOT_IMPLEMENTED']);
const validSymbols=new Set(['XAUUSD','XAGUSD']);
const allowedTimeframes={XAUUSD:new Set(['5Min','15Min']),XAGUSD:new Set(['15Min'])};

/**
 * Skills are capabilities, NOT simply indicators in a nine-value feature vector.
 * PARTIAL means there is a real narrower implementation, but the accepted skill
 * contract is not satisfied. None of these can be promoted as IMPLEMENTED.
 * This list intentionally describes the *current* Gold/Silver research code.
 */
export const STUDENT_SKILL_REGISTRY=Object.freeze([
 {id:'HISTORICAL_SOURCE',name:'Point-in-time historical source validation',owner:'Data Steward',scope:'shared',status:'PARTIAL',
  evidence:'academy/opportunity-discovery.mjs validates completed OHLC candles, but quote/source authentication and aligned multi-market evidence are absent'},
 {id:'OPPORTUNITY_DISCOVERY',name:'Causal opportunity discovery',owner:'Researcher',scope:'shared',status:'PARTIAL',
  evidence:'academy/opportunity-discovery.mjs enumerates fixed long/short scenarios; it does not discover optimized tactics'},
 {id:'GOOD_BAD_MEMORY',name:'Persistent skill-linked Good/Bad memory',owner:'Teacher',scope:'per_student',status:'PARTIAL',
  evidence:'Net-after-cost labels are computed, but durable per-skill reason/outcome memory is not implemented'},
 {id:'NEURAL_TEACHER',name:'Supervised market-specialized Teacher',owner:'Teacher',scope:'per_student',status:'PARTIAL',
  evidence:'academy/teacher-training.mjs fits a fixed 9x12x1 net; no contextual skill selector or skill-specific training yet'},
 {id:'SCOUT_REGIME',name:'Scout A: directional, volatility, quality and chop regimes',owner:'Scout A',scope:'shared',status:'PARTIAL',
  evidence:'One candle-window heuristic labels regimes; no independent ADX/DI, ATR, chop, compression, transitions or calibrated regime skill'},
 {id:'PRICE_LEVELS',name:'Price Level Intelligence: zones, transitions and sweeps',owner:'Price Level Intelligence',scope:'shared',status:'PARTIAL',
  evidence:'Offline callable PLI engine now maps causal ATR zones, rejection/breakout/sweep/retest, per-market transition memory, and next-zone virtual targets; still not independently validated or integrated into full neural admission/execution'},
 {id:'SCOUT_EXPECTANCY',name:'Scout B: cost-adjusted independent trade expectancy',owner:'Scout B',scope:'per_student',status:'NOT_IMPLEMENTED',
  evidence:'Classification probability is not calibrated expected GBP returns and is not an independent Scout assessment'},
 {id:'STRATEGIST',name:'Strategist: thesis, choice of entry, TP/SL and invalidation',owner:'Strategist',scope:'per_student',status:'NOT_IMPLEMENTED',
  evidence:'The baseline has fixed TP/SL combinations rather than a thesis-generating strategy agent'},
 {id:'CROSS_CHART_REACTION',name:'Cross-Chart Reaction Intelligence',owner:'Researcher',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'No synchronized multi-market OHLC, measured lead-lag or time-frame propagation skill'},
 {id:'EVENT_ANTICIPATION',name:'ERI: Event Anticipation',owner:'Event Researcher',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'No event-aligned point-in-time news, expected releases, historical sentiments or pre-event features'},
 {id:'EVENT_PROPAGATION',name:'ERI: Reaction Propagation',owner:'Event Researcher',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'No observed cross-market event propagation, lag structure or event-aligned outcomes'},
 {id:'EVENT_DIRECTION_AMPLITUDE',name:'ERI: Direction & Amplitude Forecasting',owner:'Event Researcher',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'No probabilistic event-direction, magnitude, duration or event-conditioned TP/SL forecasting'},
 {id:'VALIDATOR',name:'Validator: independent thesis/setup checks',owner:'Validator',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'OHLC/software unit checks are not independent trading-thesis or edge validation'},
 {id:'GUARDIAN_MONITOR',name:'Guardian A: independent thesis monitor (observation only)',owner:'Guardian',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'No thesis-state monitor or frozen decision audit; autonomous exits remain unapproved'},
 {id:'INDEPENDENT_EXAMINER',name:'Independent Examiner: untouched holdout, walk-forward and risk',owner:'Examiner',scope:'shared',status:'NOT_IMPLEMENTED',
  evidence:'The final 20% is reserved, not independently examined; zero certified forward/broker paper grades'},
 {id:'CONTEXTUAL_SKILL_SELECTOR',name:'Regime/event/level-contextual skill selector',owner:'Learning Director',scope:'per_student',status:'NOT_IMPLEMENTED',
  evidence:'No orchestration routing strategy skills or their confidence/abstention decisions to the student'}
]);
const core=new Set(STUDENT_SKILL_REGISTRY.map(s=>s.id));
export const SKILL_DEPENDENCIES=Object.freeze({
 EVENT_PROPAGATION:['EVENT_ANTICIPATION','CROSS_CHART_REACTION'],
 EVENT_DIRECTION_AMPLITUDE:['EVENT_PROPAGATION'],
 STRATEGIST:['SCOUT_REGIME','PRICE_LEVELS','SCOUT_EXPECTANCY'],
 VALIDATOR:['STRATEGIST'],
 GUARDIAN_MONITOR:['STRATEGIST'],
 INDEPENDENT_EXAMINER:['VALIDATOR','GOOD_BAD_MEMORY'],
 CONTEXTUAL_SKILL_SELECTOR:['SCOUT_REGIME','PRICE_LEVELS','STRATEGIST']
});
export function studentSkillContract({symbol,timeframe}={}){
 if(!validSymbols.has(symbol)||!allowedTimeframes[symbol].has(timeframe))
  throw Error('Unsupported student market or native timeframe');
 const skills=STUDENT_SKILL_REGISTRY.map(s=>({...s,dependencies:[...(SKILL_DEPENDENCIES[s.id]||[])]}));
 const missing=skills.filter(s=>s.status!=='IMPLEMENTED').map(s=>s.id);
 return {
  schema:STUDENT_SKILL_CONTRACT_VERSION,
  studentId:'COMMODITIES/'+symbol+'/'+timeframe,
  market:'COMMODITIES',symbol,timeframe,
  architecture:'LEGACY_BASELINE_9X12X1_WITH_SKILL_GAPS',
  skills,
  missingSkillIds:missing,
  fullSkillStackImplemented:missing.length===0,
  allowedUse:'RESEARCH_BASELINE_ONLY',
  qualifyingTraining:false,
  independentExamEligible:false,
  tradingFloorAppointmentEligible:false,
  brokerPaperEligible:false,liveTradingEligible:false,
  sourceInstrumentIsolated:true,
  sharedSkillsAreKnowledgeNotSharedWeights:true,
  notes:[
   'Skill capability not inferred from common input-feature names',
   'No trading approval is implied by Good/Bad training or passing software tests',
   'Event skills cannot be claimed with single-market OHLC only',
   'Autonomous trade-management skills are a separate future research lane'
  ]
 };
}
/**
 * Fail closed before any grading / promotion claim. A research experiment may
 * produce statistics while the profile remains unqualified for promotion.
 */
export function assertStudentQualified(contract,{purpose='EXAMINATION'}={}){
 const canonical=studentSkillContract({symbol:contract?.symbol,timeframe:contract?.timeframe});
 if(!contract||contract.schema!==STUDENT_SKILL_CONTRACT_VERSION||
   !canonical.fullSkillStackImplemented||!canonical.qualifyingTraining||
   !canonical.independentExamEligible||!canonical.tradingFloorAppointmentEligible||
   canonical.missingSkillIds.length!==0||
   contract.fullSkillStackImplemented!==true||contract.qualifyingTraining!==true||
   contract.independentExamEligible!==true||contract.tradingFloorAppointmentEligible!==true||
   contract.missingSkillIds?.length!==0)
   throw Error('ACADEMY_SKILL_GATE_BLOCKED: legacy baseline lacks verified specialist skill stack for '+purpose);
 return true;
}
for(const [id,deps] of Object.entries(SKILL_DEPENDENCIES)){
 if(!core.has(id)||deps.some(d=>!core.has(d)))throw Error('Invalid static Academy skill dependency');
}
