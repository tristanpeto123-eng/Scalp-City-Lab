// Robot Academy Teacher v0.1: bounded PAPER examination, no live trading.
import {createHash} from 'node:crypto';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';
import {checkParams} from '../scripts/run-robot-training.mjs';
import {virtualPaperEquity} from './risk-ledger.mjs';

const PERIOD=15*60_000;
const id=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const at=x=>Date.parse(x);
export const POLICY=Object.freeze({
 minimumForwardCloses:30,maxDrawdownPct:10,dailyStopPct:1,
 perPupilVirtualUsd:50,maxOrderFraction:.50,stopLossPct:2,
 maxConcurrentPositions:1,brokerOrdersRequireExactRelease:true
});

export function readiness(pupil,audit){
  const reasons=[];
  const leader=pupil?.researchLeader;
  if(!PAIRS.includes(pupil?.symbol))reasons.push('Unknown symbol');
  if(!leader||leader.trainingNetGbp<=0||leader.trainingClosedTrades<30)
    reasons.push('Training not profitable with at least 30 closed trades');
  if(!leader||leader.outOfSampleVerified!==false)reasons.push('Unexpected research provenance');
  if(!audit||audit.source!=='INDEPENDENT_CHRONOLOGICAL_HOLDOUT'||
     audit.symbol!==pupil?.symbol||audit.modelExperimentId!==leader?.sourceExperimentId||
     audit.paramsDigest!==(leader?id(leader.parameters):null)||audit.closedTrades<30||
     !finite(audit.netGbp)||audit.netGbp<=0||
     !finite(audit.doubleCostNetGbp)||audit.doubleCostNetGbp<=0||
     !finite(audit.maxDrawdownPct)||audit.maxDrawdownPct>8||
     !(at(audit.windowStart)>=at(leader?.trainedThrough))||
     !(at(audit.windowEnd)>at(audit.windowStart)))
    reasons.push('Missing independent, profitable, stress-tested sealed holdout');
  return {ready:reasons.length===0,reasons,modelId:leader?id([pupil.symbol,leader.sourceExperimentId,leader.parameters]):null};
}

// Admission must be produced by a separately reviewed, server-side holdout auditor,
// not by a public page or by a historical grade. The owner approves the exact
// *runtime release* separately. This function alone never grants broker authority.
export function freezeAdmission(pupil,audit,examStartedAt){
  const gate=readiness(pupil,audit);
  if(!gate.ready)throw Error('TEACHER: readiness denied: '+gate.reasons.join('; '));
  if(!(at(examStartedAt)>at(audit.windowEnd)))throw Error('TEACHER: exam must begin after sealed audit');
  checkParams(pupil.researchLeader.parameters);
  const model={symbol:pupil.symbol,modelId:gate.modelId,
    experimentId:pupil.researchLeader.sourceExperimentId,
    parameters:structuredClone(pupil.researchLeader.parameters),
    auditDigest:id(audit),startedAt:examStartedAt};
  return Object.freeze({...model,parameters:Object.freeze(model.parameters),fingerprint:id(model)});
}

export function closedSignal(rows,params){
  checkParams(params);
  if(!Array.isArray(rows)||rows.length<150)throw Error('TEACHER: insufficient signal warmup');
  const high=[],low=[];let fast=null,slow=null,prev=null,gain=0,loss=0,rsi=50,signal=null;
  for(const b of rows){
    const c=b.c,priorHigh=high.length>=params.lookback?Math.max(...high.slice(-params.lookback)):Infinity;
    const priorLow=low.length>=params.exitLookback?Math.min(...low.slice(-params.exitLookback)):-Infinity;
    const kFast=2/((params.family==='ema_trend'?params.fast:9)+1);
    const kSlow=2/((params.family==='ema_trend'?params.slow:34)+1);
    fast=fast===null?c:fast+kFast*(c-fast);
    slow=slow===null?c:slow+kSlow*(c-slow);
    if(prev!==null){
      const n=params.family==='rsi_reversion'?params.period:14;
      gain=(gain*(n-1)+Math.max(0,c-prev))/n;
      loss=(loss*(n-1)+Math.max(0,prev-c))/n;
      rsi=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
    }
    prev=c;high.push(b.h);low.push(b.l);
    if(high.length>96){high.shift();low.shift();}
    if(params.family==='ema_trend')signal={buy:fast>slow,sell:fast<=slow};
    else if(params.family==='rsi_reversion')signal={buy:rsi<params.buyBelow,sell:rsi>=params.sellAbove};
    else signal={buy:c>priorHigh,sell:c<priorLow};
  }
  return signal;
}
export function validateForwardBars(snapshot,symbol,now){
  const checked=checkSnapshot(snapshot,symbol,now);
  const last=checked.bars.at(-1);
  if(last.t+PERIOD>now-30_000||now-(last.t+PERIOD)>22*60_000)
    throw Error('TEACHER: stale or unfinished forward candle');
  return {bars:checked.bars,bar: last,closedAt:new Date(last.t+PERIOD).toISOString()};
}

export function evaluateGrade({admission,brokerEvidence,fxEvidence,feeEvidence}){
  // All three evidence inputs must come from server-side authenticated adapters.
  // This pure scorer is NOT an authentication boundary. Nothing self-reported
  // from a client/browser should be passed to it as trustworthy.
  if(!admission?.fingerprint||id({
    symbol:admission.symbol,modelId:admission.modelId,
    experimentId:admission.experimentId,parameters:admission.parameters,
    auditDigest:admission.auditDigest,startedAt:admission.startedAt
  })!==admission.fingerprint)throw Error('TEACHER: admission modified');
  if(!brokerEvidence?.verifiedByPaperBroker||brokerEvidence.symbol!==admission.symbol||
     brokerEvidence.modelId!==admission.modelId||brokerEvidence.unattributedOrders!==0||
     brokerEvidence.hasOpenExposure||brokerEvidence.hasPendingOrders)
    return {status:'EVIDENCE_PENDING',grade:null,qualified:false,reason:'Unreconciled broker positions/orders'};
  if(!feeEvidence?.settled||!feeEvidence?.complete||!fxEvidence?.verified||
     !fxEvidence.source||fxEvidence.source==='USER_ENTERED')
    return {status:'EVIDENCE_PENDING',grade:null,qualified:false,reason:'Final broker crypto fees or independent GBP/USD conversion missing'};
  const trades=brokerEvidence.closedTrades;
  if(!Array.isArray(trades)||!Array.isArray(feeEvidence.feesByCloseId)||
     !Array.isArray(fxEvidence.ratesByCloseId))throw Error('TEACHER: incomplete evidence');
  const fees=new Map(feeEvidence.feesByCloseId.map(x=>[x.id,x.feeUsd]));
  const fx=new Map(fxEvidence.ratesByCloseId.map(x=>[x.id,x.gbpPerUsd]));
  const seen=new Set();let net=0,wins=0,peak=0,equity=0,maxDD=0;
  const sorted=[...trades].sort((a,b)=>at(a.closedAt)-at(b.closedAt));
  for(const trade of sorted){
    if(typeof trade.closeId!=='string'||!trade.closeId||seen.has(trade.closeId)||
       !finite(trade.buyUsd)||!finite(trade.sellUsd)||trade.buyUsd<=0||trade.sellUsd<0||
       !(at(trade.openedAt)>=at(admission.startedAt))||
       !(at(trade.closedAt)>at(trade.openedAt))||
       !finite(fees.get(trade.closeId))||fees.get(trade.closeId)<0||
       !finite(fx.get(trade.closeId))||fx.get(trade.closeId)<=0)
      throw Error('TEACHER: invalid/duplicate or pre-admission paper round-trip');
    seen.add(trade.closeId);
    const profitGbp=(trade.sellUsd-trade.buyUsd-fees.get(trade.closeId))*fx.get(trade.closeId);
    if(profitGbp>0)wins++;
    net+=profitGbp;equity+=profitGbp;peak=Math.max(peak,equity);
    // Drawdown relative to fixed virtual capital, from realized closed positions only.
    maxDD=Math.max(maxDD,100*(peak-equity)/(POLICY.perPupilVirtualUsd*fx.get(trade.closeId)));
  }
  if(seen.size!==fees.size||seen.size!==fx.size)throw Error('TEACHER: unmatched fee/FX evidence');
  const n=trades.length,winRatePct=n?100*wins/n:null;
  const grade=n>=POLICY.minimumForwardCloses?Math.min(10,Math.floor((winRatePct+1e-9)/10)):null;
  return {status:grade===null?'FORWARD_TESTING':'VERIFIED_FORWARD_GRADE',
    symbol:admission.symbol,modelId:admission.modelId,
    grade,closedTrades:n,wins,winRatePct,
    netProfitGbp:Number(net.toFixed(4)),maxDrawdownPct:Number(maxDD.toFixed(4)),
    qualified:grade!==null&&net>0&&maxDD<=POLICY.maxDrawdownPct,
    championModel:null, // owner/governance promotion remains separate
    distinctTradeIds:[...seen],source:'SERVER_RECONCILED_PAPER_ONLY',
    note:'Observed forward-paper result, not a forecast or permission for real funds'};
}

export class Teacher {
  constructor({broker,journal,admissions,paperEnabled=false,now=()=>Date.now()}){
    if(!broker||!journal)throw Error('TEACHER: broker and persistent journal required');
    this.broker=broker;this.journal=journal;this.now=now;
    this.paperEnabled=paperEnabled;this.admissions=new Map();
    for(const a of admissions||[]){
      if(!PAIRS.includes(a?.symbol)||this.admissions.has(a.symbol)||
         id({symbol:a.symbol,modelId:a.modelId,experimentId:a.experimentId,
             parameters:a.parameters,auditDigest:a.auditDigest,startedAt:a.startedAt})!==a.fingerprint)
        throw Error('TEACHER: invalid/duplicate immutable admission');
      checkParams(a.parameters);this.admissions.set(a.symbol,a);
    }
  }
  async cycle(symbol){
    const exam=this.admissions.get(symbol);
    if(!exam)return {status:'NOT_READY',symbol};
    // A separate, dedicated paper account per examiner keeps cash/positions and
    // delayed CFEE fees attributable to exactly one strategy/pupil.
    const now=this.now();
    const [account,positions,orders,asset,snapshot]=await Promise.all([
      this.broker.account(symbol),this.broker.positions(symbol),
      this.broker.openOrders(symbol),this.broker.asset(symbol),
      this.broker.history(symbol)
    ]);
    if(account.status!=='ACTIVE'||account.trading_blocked||account.account_blocked||
       asset.symbol!==symbol||asset.class!=='crypto'||!asset.tradable||
       asset.shortable||asset.marginable)throw Error('TEACHER: broker account/asset unsafe');
    if(positions.some(p=>p.symbol!==symbol||Number(p.qty)<0)||
       orders.some(o=>o.symbol!==symbol||!String(o.client_order_id||'').startsWith('teacher-')))
      throw Error('TEACHER: dedicated paper account contains external exposure');
    if(orders.length)return {status:'WAITING_ORDER_RECONCILIATION',symbol};
    const {bars,bar,closedAt}=validateForwardBars(snapshot,symbol,now);
    if(!(at(closedAt)>at(exam.startedAt)))return {status:'WAITING_NEW_FORWARD_BAR',symbol};
    const barId=exam.modelId+':'+closedAt;
    if(await this.journal.hasBar(barId))return {status:'NO_NEW_CANDLE',symbol};
    const pos=positions[0],qty=pos?Number(pos.qty):0;
    if(!finite(qty)||qty<0)throw Error('TEACHER: invalid paper holding');
    if(qty>0&&!await this.broker.ownedPosition(symbol,await this.journal.orderIds(symbol),qty))
      throw Error('TEACHER: cannot prove examiner owns paper inventory');
    const history=await this.broker.recentOrders(symbol);
    const owned=await this.journal.orderIds(symbol);
    const virtual=virtualPaperEquity({symbol,orders:history,positions,
      ownedClientIds:owned,markPrice:bar.c});
    const peak=await this.journal.peakVirtual(symbol);
    const dayStart=await this.journal.openVirtualToday(symbol,now);
    if(virtual.equity/dayStart<1-POLICY.dailyStopPct/100||
       virtual.equity/peak<1-POLICY.maxDrawdownPct/100)
      throw Error('TEACHER: $50 pupil loss/drawdown circuit breaker; manual reset only');
    await this.journal.virtual(symbol,virtual.equity);
    const signal=closedSignal(bars,exam.parameters);
    // Exits are always prioritised; actual stop protection depends on runtime uptime.
    const entry=Number(pos?.avg_entry_price);
    const stop=qty>0&&finite(entry)&&bar.c<entry*(1-POLICY.stopLossPct/100);
    const side=qty>0?(signal.sell||stop?'sell':null):(signal.buy?'buy':null);
    if(!side){await this.journal.bar(barId);return {status:'NO_SIGNAL',symbol};}
    const clientOrderId='teacher-'+id([exam.fingerprint,bar.t,side]).slice(0,34);
    if(await this.journal.hasIntent(clientOrderId))
      return {status:'UNRESOLVED_PREVIOUS_INTENT',symbol};
    const existing=await this.broker.orderByClientId(symbol,clientOrderId);
    if(existing)throw Error('TEACHER: unexpected external/replayed paper order id');
    const allowed=Math.min(POLICY.perPupilVirtualUsd*POLICY.maxOrderFraction,
                           Number(account.non_marginable_buying_power||0)*.9);
    const payload={symbol,side,type:'market',time_in_force:'ioc',client_order_id:clientOrderId};
    if(side==='buy'){
      const minCost=Number(asset.min_order_size)*bar.c;
      if(!finite(allowed)||allowed<1||!finite(minCost)||minCost>allowed)
        return {status:'INSUFFICIENT_PAPER_ALLOCATION',symbol};
      payload.notional=allowed.toFixed(2);
    }else{
      // Truncate to asset precision; NEVER sell beyond the broker-owned position.
      const increment=Number(asset.min_trade_increment);
      if(!(increment>0)||!finite(increment))throw Error('TEACHER: invalid asset precision');
      const size=Math.floor((qty+1e-10)/increment)*increment;
      if(size<Number(asset.min_order_size))return {status:'DUST_POSITION_REQUIRES_REVIEW',symbol};
      payload.qty=String(Number(size.toFixed(12)));
    }
    // Dry-run never records an intent or touches the paper order POST endpoint.
    if(!this.paperEnabled)return {status:'DRY_RUN',symbol,proposed:payload};
    // Durable INTENT first; broker result ambiguous => no automatic retry.
    await this.journal.intent(clientOrderId,{barId,symbol,modelId:exam.modelId,payload});
    const submitted=await this.broker.paperOrder(symbol,payload);
    await this.journal.ack(clientOrderId,{brokerOrderId:submitted.id,status:submitted.status});
    await this.journal.bar(barId);
    return {status:'PAPER_SUBMITTED_NOT_FILLED',symbol,clientOrderId,brokerOrderId:submitted.id};
  }
}
