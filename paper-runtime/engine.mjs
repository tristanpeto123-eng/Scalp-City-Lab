// Scalp City Lab · connected forward-paper agent pipeline. NO live-money execution path.
// Intentionally pure strategy functions for deterministic test/replay.
import { createHash } from 'node:crypto';

export const VERSION = '0.1.0-rc1';
export const AGENTS = Object.freeze([
  ['BM-01','Bot Manager'],['DC-01','Data Curator'],['RS-01','Researcher'],
  ['SD-01','Strategy Designer'],['OP-01','Optimizer'],['BT-01','Backtester'],
  ['VL-01','Independent Validator'],['SC-01','Scorer'],['RM-01','Risk Manager'],
  ['PT-01','Paper Trader'],['JR-01','Journal'],['VA-01','Vault']
]);
const idBy = Object.fromEntries(AGENTS.map(([id,name])=>[id,name]));
export const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const COST_BPS = 10; // conservative illustrative friction; NOT broker-verified.
export const INTERVAL_MS = 15*60_000;
// US equity session starts at 09:30 New York time, including DST changes.
// The first completed 15-minute session bar cannot exist at market open.
export function inOpeningGrace(now=Date.now()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
  }).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  const seconds=parts.hour*3600+parts.minute*60+parts.second;
  return seconds>=9*3600+30*60&&seconds<9*3600+46*60+30;
}
const minHistory=150;
const NUM = x => typeof x==='number' && Number.isFinite(x);
const positive = x => NUM(x) && x>0;
const ema = (bars,period) => {
  const out=[];const k=2/(period+1);let value=bars[0].c;
  for(const b of bars){value=k*b.c+(1-k)*value;out.push(value)}return out;
};
const positionAt = (i,fast,slow)=>i>=0&&fast[i]>slow[i]?1:0;
export function simulate(bars,params,{start=1,end=bars.length,costBps=COST_BPS}={}) {
  const fast=ema(bars,params.fast), slow=ema(bars,params.slow);
  let equity=1, peak=1, dd=0, position=0, orders=0, entries=0, winBars=0;
  for(let i=Math.max(1,start);i<Math.min(end,bars.length);i++){
    const desired=positionAt(i-1,fast,slow);
    if(position!==desired){equity*=1-Math.abs(position-desired)*costBps/10_000;orders++;if(desired===1)entries++;}
    position=desired;
    const current=bars[i].o, next=i+1<Math.min(end,bars.length)?bars[i+1].o:current;
    const gain=position*(next/current-1);
    if(gain>0)winBars++;
    equity*=1+gain;peak=Math.max(peak,equity);dd=Math.max(dd,peak>0?(peak-equity)/peak:1);
  }
  return {netReturnPct:(equity-1)*100,maxDrawdownPct:dd*100,orders,entries,winBars};
}

// Independent reference evaluation: deliberately does NOT call simulate or ema.
export function validateHoldoutIndependently(bars,params,cut,{costBps=COST_BPS}={}){
  if(cut<params.slow||bars.length-cut<25) return {auditPassed:false,reason:'Insufficient sealed holdout'};
  let f=bars[0].c,s=f,pos=0,equity=1,peak=1,dd=0,orders=0,entries=0;
  const kf=2/(params.fast+1),ks=2/(params.slow+1);
  for(let i=0;i<bars.length;i++){
    f=kf*bars[i].c+(1-kf)*f;s=ks*bars[i].c+(1-ks)*s;
    if(i+1<cut||i+1>=bars.length) continue;
    const desired=f>s?1:0;
    if(pos!==desired){equity*=1-costBps/10000;orders++;if(desired===1)entries++;}
    pos=desired;
    equity*=1+pos*(bars[i+2]?.o??bars[i+1].o)/bars[i+1].o-pos;
    peak=Math.max(peak,equity);dd=Math.max(dd,(peak-equity)/peak);
  }
  return {auditPassed:true,netReturnPct:(equity-1)*100,maxDrawdownPct:dd*100,orders,entries};
}

export function curateBars(raw,now=Date.now()) {
  if(!Array.isArray(raw)||raw.length<minHistory)throw Error(`DC: require ${minHistory} real market bars`);
  const bars=raw.map(b=>({t:Date.parse(b.t),o:Number(b.o),h:Number(b.h),l:Number(b.l),c:Number(b.c),v:Number(b.v)}));
  for(let i=0;i<bars.length;i++){
    const b=bars[i];
    if(!Number.isFinite(b.t)||![b.o,b.h,b.l,b.c].every(positive)||!NUM(b.v)||b.v<0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)) throw Error(`DC: invalid OHLCV row ${i}`);
    if(i>0 && bars[i-1].t>=b.t)throw Error('DC: unsorted or duplicate bars');
    if(b.t+INTERVAL_MS>now-30_000)throw Error('DC: bar is not finalized');
  }
  const last=bars.at(-1);
  if(now-(last.t+INTERVAL_MS)>25*60_000)throw Error('DC: stale market data');
  // Never report IEX-only data as full US consolidated tape.
  return {bars,latest:last,source:'ALPACA_IEX',fingerprint:sha(raw),finalizedAt:new Date(last.t+INTERVAL_MS).toISOString()};
}
function paramsHash(symbol,params,source) {return sha({symbol,params,source,engine:VERSION});}
export function investigate(curated) {return {hypothesis:'Long/flat trend on closed 15-min EMA bars',observations:{lastClose:curated.latest.c,history:curated.bars.length},source:curated.source};}
export function design() {return [{fast:6,slow:26},{fast:9,slow:34},{fast:12,slow:48}];}
export function optimize(bars, candidates) {
  const cut=Math.floor(bars.length*0.75),trainEnd=cut;
  const options=candidates.map(p=>({params:p,result:simulate(bars.slice(0,trainEnd),p)}));
  // Select on TRAINING ONLY. No holdout result fed to optimizer.
  options.sort((a,b)=>b.result.netReturnPct-a.result.netReturnPct || a.params.fast-b.params.fast);
  return {candidate:options[0],cut,trainingOptions:options.map(x=>({params:x.params,trainingReturnPct:x.result.netReturnPct}))};
}
export function validate(bars,selected,cut,btResult){
  const p=selected.params;
  const own=validateHoldoutIndependently(bars,p,cut),stress=validateHoldoutIndependently(bars,p,cut,{costBps:2*COST_BPS});
  const second=simulate(bars,p,{start:cut});
  const accountingMatch=own.auditPassed&&Math.abs(own.netReturnPct-second.netReturnPct)<1e-8&&Math.abs(own.maxDrawdownPct-second.maxDrawdownPct)<1e-8;
  const reasons=[];
  if(!own.auditPassed) reasons.push(own.reason);
  if(!accountingMatch) reasons.push('Independent arithmetic mismatch');
  if(own.entries<1) reasons.push('No held-out trade entry');
  if(own.netReturnPct<=0) reasons.push('Negative/flat out-of-sample return');
  if(stress.netReturnPct<=0) reasons.push('Fails 2x cost stress');
  if(own.maxDrawdownPct>8) reasons.push('Excess holdout drawdown');
  if(btResult.training.entries<1)reasons.push('No training trades');
  return {verdict:reasons.length?'BLOCKED':'AUDIT_PASS',reasons,holdout:own,stress,accountingMatch,scope:'Forward-paper screening only, not proof of generalization or broker fills'};
}
export function score(validation){return {eligible:validation.verdict==='AUDIT_PASS',score:validation.verdict==='AUDIT_PASS'?validation.holdout.netReturnPct-validation.holdout.maxDrawdownPct:null};}
export function currentSignal(bars,params){const f=ema(bars,params.fast),s=ema(bars,params.slow);return f.at(-1)>s.at(-1)?1:0;}

export class AgentWorkflow {
  constructor({broker,journal,paperEnabled=false,now=()=>Date.now()}={}){
    if(!broker||!journal)throw Error('Missing broker or journal');
    this.broker=broker;this.journal=journal;this.paperEnabled=paperEnabled;this.now=now;
    this.halted=false;this.lastProcessed=new Set();this.latestEvents=[];this.lastStatus='IDLE';this.seenOrderUpdates=new Set();this.forwardFills=[];this.markets={};
  }
  async stage(agentId,fn,details={}){
    if(!idBy[agentId])throw Error('Unknown agent');
    try{
      const result=await fn();
      const event={agentId,state:'COMPLETE',decision:details.decision||'Stage completed',metric:details.metric||'Pipeline',message:`${idBy[agentId]} delivered evidence`,ts:new Date(this.now()).toISOString()};
      await this.journal.append(event);this.latestEvents.push(event);this.latestEvents=this.latestEvents.slice(-60);return result;
    }catch(err){
      const event={agentId,state:'BLOCKED',decision:String(err.message||err).slice(0,110),metric:'No downstream authorization',ts:new Date(this.now()).toISOString()};
      await this.journal.append(event);this.latestEvents.push(event);this.latestEvents=this.latestEvents.slice(-60);
      throw err;
    }
  }
  async process(symbol){
    if(this.halted)throw Error('Emergency stop engaged');
    if(!['SPY','QQQ','IWM'].includes(symbol)) throw Error('Symbol not allowlisted');
    this.lastStatus='RUNNING';
    try{
      const clock=await this.broker.clock();
      if(!clock.is_open) {this.lastStatus='MARKET_CLOSED';return {status:'MARKET_CLOSED'};}
      if(inOpeningGrace(this.now())){this.lastStatus='WAITING_FOR_OPENING_CANDLE';return {status:'WAITING_FOR_OPENING_CANDLE'};}
      await this.stage('BM-01',()=>({symbol,clock:clock.timestamp||null}),{decision:'Fresh-bar workflow dispatched'});
      const raw=await this.broker.history(symbol);
      const curated=await this.stage('DC-01',()=>curateBars(raw,this.now()),{decision:'Closed real bars checked'});
      this.markets[symbol]={close:curated.latest.c,barStart:new Date(curated.latest.t).toISOString(),finalizedAt:curated.finalizedAt,feed:curated.source,source:'REAL_IEX'};
      const key=`${symbol}:${curated.latest.t}`;
      if(this.lastProcessed.has(key)){this.lastStatus='NO_NEW_BAR';return {status:'NO_NEW_BAR'};}
      const hypothesis=await this.stage('RS-01',()=>investigate(curated));
      const choices=await this.stage('SD-01',()=>design(hypothesis));
      const optimized=await this.stage('OP-01',()=>optimize(curated.bars,choices));
      const frozen={id:paramsHash(symbol,optimized.candidate.params,curated.source),symbol,params:Object.freeze({...optimized.candidate.params}),datasetFingerprint:curated.fingerprint};
      const bt=await this.stage('BT-01',()=>({training:simulate(curated.bars.slice(0,optimized.cut),frozen.params),costBps:COST_BPS,reportOnly:true}));
      const validation=await this.stage('VL-01',()=>validate(curated.bars,optimized.candidate,optimized.cut,bt),{decision:'Independent sealed holdout'});
      const ranking=await this.stage('SC-01',()=>score(validation));
      if(!ranking.eligible){
        await this.stage('JR-01',()=>({outcome:'REJECTED',reasons:validation.reasons}),{decision:'Rejected candidate recorded'});
        await this.stage('VA-01',()=>({candidate:frozen.id,verdict:validation.verdict}),{decision:'Rejected research stored'});
        this.lastProcessed.add(key);this.lastStatus='VALIDATION_BLOCKED';
        return {status:'VALIDATION_BLOCKED',symbol,candidateId:frozen.id,validation};
      }
      const signal=currentSignal(curated.bars,frozen.params);
      const risk=await this.stage('RM-01',()=>this.evaluateRisk({symbol,signal,curated,clock,candidate:frozen}));
      const traded=await this.stage('PT-01',()=>this.executePaper({symbol,signal,risk,candidate:frozen,bar:curated.latest}));
      await this.stage('JR-01',()=>({outcome:traded.status,orderId:traded.order?.id||null}),{decision:'Paper decision journalled'});
      await this.stage('VA-01',()=>({candidate:frozen.id,validationHash:sha(validation),paperOutcome:traded.status}),{decision:'Evidence archived'});
      this.lastProcessed.add(key);this.lastStatus=traded.status;
      return {status:traded.status,symbol,candidateId:frozen.id,validation,signal,trade:traded};
    }catch(err){this.lastStatus='BLOCKED';this.halted=true;throw err;}
  }
  async evaluateRisk({symbol,signal,curated,clock}){
    if(this.halted)throw Error('RM: stopped');
    if(!clock.is_open)throw Error('RM: market closed');
    if(this.now()-(curated.latest.t+INTERVAL_MS)>25*60_000)throw Error('RM: stale market bar');
    const [account,positions,orders] = await Promise.all([this.broker.account(),this.broker.positions(),this.broker.openOrders()]);
    if(account.status!=='ACTIVE'||account.trading_blocked||account.account_blocked)throw Error('RM: account restricted');
    const equity=Number(account.equity),previous=Number(account.last_equity);
    if(!positive(equity)||!positive(previous))throw Error('RM: invalid equity baseline');
    if(equity/previous-1 < -.01)throw Error('RM: 1% daily drawdown stop');
    if(orders.some(o=>o.symbol===symbol))throw Error('RM: existing pending order');
    if(positions.some(p=>Number(p.qty)<0))throw Error('RM: short position detected');
    const pos=positions.find(p=>p.symbol===symbol);
    const held=pos?Number(pos.qty):0;
    if(!NUM(held)||held<0)throw Error('RM: invalid held quantity');
    const action=signal===1&&!held?'buy':signal===0&&held?'sell':'none';
    const reserved=new Set([...positions.map(p=>p.symbol),...orders.filter(o=>o.side==='buy').map(o=>o.symbol)]);
    if(action==='buy'&&reserved.size>=2)throw Error('RM: maximum two holdings including pending buys');
    // Never liquidate a manual holding or a position whose provenance is incomplete.
    // Refuse to sell unless broker history proves the entire quantity is attributable
    // to this specific paper bot; a missing/trimmed order history fails closed.
    if(action==='sell'){
      const history=await this.broker.recentOrders();
      const owned=history.filter(o=>/^sc010rc1-/.test(String(o.client_order_id||''))&&o.symbol===symbol)
        .reduce((qty,o)=>qty+(o.side==='buy'?1:o.side==='sell'?-1:0)*Number(o.filled_qty||0),0);
      if(!Number.isFinite(owned)||owned+1e-8<held)throw Error('RM: manual or unattributed holding; no auto-liquidation');
    }
    // Hard cap per order: 1% account equity, paper only. No leverage.
    const notional=Math.max(0,Math.min(equity*.01,Number(account.buying_power)||0));
    if(action==='buy'&&notional<25)throw Error('RM: insufficient allowed notional');
    return {action,notional,held,signal,equity,validated:true,marketClockChecked:true};
  }
  async executePaper({symbol,risk,candidate,bar}){
    if(!risk.validated||!risk.marketClockChecked)throw Error('PT: missing independent risk permission');
    if(risk.action==='none')return {status:'NO_ORDER'};
    if(!this.paperEnabled)return {status:'DRY_RUN',proposed:{symbol,side:risk.action,notional:risk.notional,qty:risk.held}};
    const clientOrderId=`sc${VERSION.replace(/\W/g,'').slice(0,8)}-${symbol}-${sha([candidate.id,bar.t,risk.action]).slice(0,24)}`;
    // Broker adapter is hard-pinned to Alpaca paper URL, cannot accept live-money URL.
    const existing=await this.broker.orderByClientId(clientOrderId);
    if(existing){await this.journal.append({agentId:'PT-01',state:'RESOLVED',clientOrderId,brokerOrderId:existing.id,status:existing.status,ts:new Date(this.now()).toISOString()});return {status:'ALREADY_SUBMITTED',order:{id:existing.id,status:existing.status}};}
    // Intent must be durable BEFORE submitting. Any logging failure stops order submission.
    await this.journal.append({agentId:'PT-01',state:'INTENT',symbol,side:risk.action,clientOrderId,candidateId:candidate.id,ts:new Date(this.now()).toISOString()});
    const order=await this.broker.paperOrder({symbol,side:risk.action,type:'market',time_in_force:'day',client_order_id:clientOrderId,
      ...(risk.action==='buy'?{notional:risk.notional.toFixed(2)}:{qty:String(risk.held)})});
    await this.journal.append({agentId:'PT-01',state:'RESOLVED',clientOrderId,brokerOrderId:order.id,status:order.status,ts:new Date(this.now()).toISOString()});
    return {status:'PAPER_ORDER_SUBMITTED',order:{id:order.id,status:order.status,client_order_id:clientOrderId}};
  }
  async reconcile(){
    if(this.halted)return;
    const orders=await this.broker.recentOrders();
    for(const order of orders){
      if(!/^sc010rc1-/.test(String(order.client_order_id||'')))continue;
      const fingerprint=sha([order.id,order.status,order.filled_qty,order.filled_avg_price]);
      if(this.seenOrderUpdates.has(fingerprint))continue;
      this.seenOrderUpdates.add(fingerprint);
      const detail={agentId:'JR-01',state:'RECONCILED',decision:`${order.symbol} ${order.side}: ${order.status}`,
        metric:`filled ${order.filled_qty||0} @ ${order.filled_avg_price||'—'}`,orderId:order.id,
        ts:new Date(this.now()).toISOString()};
      await this.journal.append(detail);this.latestEvents.push(detail);
      if(order.status==='filled'||order.status==='partially_filled'){
        const fill={symbol:order.symbol,side:order.side,filled_qty:Number(order.filled_qty||0),filled_avg_price:Number(order.filled_avg_price||0),at:order.filled_at||null};
        this.forwardFills.push(fill);this.forwardFills=this.forwardFills.slice(-100);
        const archived={agentId:'VA-01',state:'FORWARD_EVIDENCE',decision:'Broker fill archived',metric:`${fill.symbol} ${fill.filled_qty} shares`,ts:new Date(this.now()).toISOString()};
        await this.journal.append({...archived,fill});this.latestEvents.push(archived);
      }
    }
    this.latestEvents=this.latestEvents.slice(-60);
  }
  emergencyStop(){this.halted=true;this.lastStatus='HALTED';}
  getStatus(){return {version:VERSION,status:this.lastStatus,paperEnabled:this.paperEnabled,halted:this.halted,source:'ALPACA_IEX',events:this.latestEvents.slice(-40),forwardFills:this.forwardFills.slice(-20),markets:this.markets,note:'Paper trading only; orders are not fills; illustrative fees; not financial advice'};}
}
