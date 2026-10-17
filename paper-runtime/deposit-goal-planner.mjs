// Scalp City "deposit + target OR duration" simulator.
// No deposit, investing, custody, broker settlement, withdrawal or guarantees.
// Produces projections only from independent OUT-OF-SAMPLE daily NET portfolio
// returns, with loss/failure outcomes. Fails CLOSED if evidence insufficient.
import {TRIAL_RULES} from './trial-profit.mjs';
export const PLANNER_VERSION='SCALP_PLANNER_PAPER_V1';
const integer=n=>Number.isInteger(n);
const pct=(x)=>Number((100*x).toFixed(1));
const money=x=>Number(x.toFixed(2));
const ALLOWED=new Set(['HISTORICAL_FROZEN_REPLAY','VERIFIED_PAPER_FORWARD']);
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 new Date(s+'T00:00:00Z').toISOString().startsWith(s);
export function validateEvidence(e){
 if(!e||e.policy!==TRIAL_RULES.version||!Array.isArray(e.windows))return {ok:false,reason:'UNVERIFIED_OR_STALE_MODEL'};
 const sorted=[...e.windows].sort((a,b)=>a.start.localeCompare(b.start));
 const dates=new Set();let days=0,trades=0,returns=[];
 for(const w of sorted){
  if(!date(w.start)||!date(w.end)||w.end<w.start||
    !ALLOWED.has(w.source)||typeof w.modelId!=='string'||!w.modelId.startsWith('CHART_')||
    !Array.isArray(w.days))return {ok:false,reason:'INVALID_PROVENANCE'};
  if(w.days.some((d,i)=>
    !date(d.date)||d.date<w.start||d.date>w.end||
    !Number.isFinite(d.netReturn)||d.netReturn<=-1||d.netReturn>4||
    !integer(d.closedTrades)||d.closedTrades<0||
    (i>0&&w.days[i-1].date>=d.date)))
    return {ok:false,reason:'INVALID_DAILY_RETURN_EVIDENCE'};
  for(const d of w.days){
   if(dates.has(d.date))return {ok:false,reason:'DUPLICATE_OR_OVERLAPPING_EVALUATION_DAYS'};
   dates.add(d.date);days++;trades+=d.closedTrades;returns.push(d.netReturn);
  }
 }
 if(sorted.length<3||days<90||trades<40)return {ok:false,reason:'INSUFFICIENT_INDEPENDENT_EVALUATION',
  windows:sorted.length,days,trades,requirements:{independentWindows:3,days:90,closedTrades:40}};
 const negative=returns.filter(x=>x<0).length;
 if(negative<5)return {ok:false,reason:'INSUFFICIENT_LOSS_OBSERVATIONS'};
 return {ok:true,returns,days,trades,windows:sorted.length,
  sources:[...new Set(sorted.map(x=>x.source))],
  modelIds:[...new Set(sorted.map(x=>x.modelId))],
  caution:'Historical or paper daily returns; no guarantee future behavior repeats; GBP conversion/spreads/fees must be represented in supplied NET observations.'};
}
const sample=(seed,size,returns)=>{
 // Deterministic xorshift32: simulations are replayable but not statistical proof.
 let state=seed>>>0;if(!state)state=1;
 const out=[];
 for(let i=0;i<size;i++){
  state^=state<<13;state^=state>>>17;state^=state<<5;
  out.push(returns[(state>>>0)%returns.length]);
 }
 return out;
};
function quantile(a,q){
 const v=[...a].sort((x,y)=>x-y);
 const p=(v.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);
 return v[lo]+(v[hi]-v[lo])*(p-lo);
}
export function planSession(input,evidence,{simulations=400,seed=912734,maxDays=1095}={}){
 const {depositGbp,mode}=input||{};
 if(!Number.isFinite(depositGbp)||depositGbp<50||depositGbp>1_000_000)
  throw Error('Enter a virtual deposit of at least £50 and no more than £1m');
 if(!['TARGET_PROFIT','WAIT_DURATION'].includes(mode))throw Error('Choose target profit or wait duration');
 if(mode==='TARGET_PROFIT'&&(!Number.isFinite(input.targetNetProfitGbp)||
    input.targetNetProfitGbp<=0||input.targetNetProfitGbp>1e8))
   throw Error('Invalid cumulative target NET profit');
 if(mode==='WAIT_DURATION'&&(!integer(input.durationDays)||input.durationDays<1||
    input.durationDays>3650))throw Error('Invalid wait duration');
 if(!integer(simulations)||simulations<100||simulations>5000||
    !integer(maxDays)||maxDays<30||maxDays>3650)throw Error('Invalid scenario configuration');
 const evidenceCheck=validateEvidence(evidence);
 const base={mode,depositGbp,virtualOnly:true,
   acceptsRealDeposits:false,canTradeRealFunds:false,withdrawalAvailable:false,
   payoutGuaranteed:false,hasWithdrawableBalance:false,
   returnsAreNetOfAssumedCosts:true,
   investmentRisk:'Entire deposit may be lost; date is a review date, NOT a promised withdrawal/payout.',
   evidenceStatus:evidenceCheck.reason||'ELIGIBLE_BUT_NOT_PREDICTIVE'};
 if(!evidenceCheck.ok)return {status:'ESTIMATE_UNAVAILABLE',...base,
   reason:evidenceCheck.reason,evidenceRequirements:evidenceCheck.requirements??null,
   estimatedProfitGbp:null,estimatedWaitDays:null,probabilityOfTargetPct:null,
   projectedBalanceGbp:null};
 const horizon=mode==='WAIT_DURATION'?input.durationDays:maxDays;
 const threshold=mode==='TARGET_PROFIT'?depositGbp+input.targetNetProfitGbp:null;
 const final=[],profit=[],timeToTarget=[],lossCount=0,hits=0;
 const initialReturns=evidenceCheck.returns;
 for(let s=0;s<simulations;s++){
  let balance=depositGbp,hitAt=null;
  // This resamples actual observed daily net returns, including negative days.
  // Resampling within the entire eligible set is an illustration; it does not
  // preserve regime autocorrelation and must not be sold as a reliable forecast.
  const sampled=sample(seed+s*7919,horizon,initialReturns);
  for(let day=0;day<horizon;day++){
    balance*=1+sampled[day];
    if(balance<=0){balance=0;break;}
    if(threshold&&balance>=threshold){hitAt=day+1;break;}
  }
  const gain=balance-depositGbp;
  final.push(balance);profit.push(gain);
  if(gain<0)lossCount++;
  if(hitAt!==null){hits++;timeToTarget.push(hitAt);}
 }
 const output={...base,status:'SCENARIO_ESTIMATE_ONLY',
  evidence:{days:evidenceCheck.days,closedTrades:evidenceCheck.trades,
    independentWindows:evidenceCheck.windows,sources:evidenceCheck.sources,
    chartModels:evidenceCheck.modelIds},
  scenarios:simulations,
  assumptions:'Historical/paper daily net returns are bootstrap-resampled, ignoring serial correlations, changing regimes and actual liquidity; illustrated uncertainty is understated.',
  probabilityOfLossPct:pct(lossCount/simulations),
  projectedBalanceGbp:{
    pessimisticP10:money(quantile(final,.1)),
    medianP50:money(quantile(final,.5)),
    optimisticP90:money(quantile(final,.9))
  },
  projectedCumulativeProfitGbp:{
    pessimisticP10:money(quantile(profit,.1)),
    medianP50:money(quantile(profit,.5)),
    optimisticP90:money(quantile(profit,.9))
  },
  targetWinRateObservedPct:null // NOT inferred from day-level returns
 };
 if(mode==='WAIT_DURATION'){
  output.durationDays=input.durationDays;
  output.estimatedProfitGbp=output.projectedCumulativeProfitGbp;
  output.estimatedWaitDays=null;
  output.probabilityOfTargetPct=null;
 }else{
  const chance=hits/simulations;
  output.targetNetProfitGbp=input.targetNetProfitGbp;
  output.horizonDays=maxDays;
  output.probabilityOfTargetPct=pct(chance);
  // Conditional median can be misleading if success is uncommon. Refuse a
  // single ETA unless >=50% of *all* paths actually attain the target.
  output.estimatedWaitDays=chance>=.5?Math.ceil(quantile(timeToTarget,.5)):null;
  output.estimatedProfitGbp=null;
  output.noReliableETA=chance<.5;
 }
 return output;
}
