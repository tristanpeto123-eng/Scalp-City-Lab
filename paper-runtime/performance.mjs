// Forward paper performance measurement. No simulated/backtest data are eligible.
// Never equate order count, partial fills or profitable bars with completed trades.
import {createHash} from 'node:crypto';

export const GOAL=Object.freeze({minimumClosedTrades:61,minimumWinRate:0.70,minimumProfitFactor:1.25});
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const symbol=x=>String(x||'').replace('/','');
const crypto=x=>['BTCUSD','ETHUSD'].includes(symbol(x));
const botId=id=>/^sc[0-9a-z]+-[A-Z]+-[a-f0-9]{24}$/.test(String(id||''));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function wilsonLowerBound(wins,total,z=1.96){
 if(!Number.isInteger(wins)||!Number.isInteger(total)||total<0||wins<0||wins>total)throw Error('Invalid proportion');
 if(total===0)return 0;
 const p=wins/total, zz=z*z, denominator=1+zz/total;
 return (p+zz/(2*total)-z*Math.sqrt(p*(1-p)/total+zz/(4*total*total)))/denominator;
}
export function measureGoal(trades,{minTrades=GOAL.minimumClosedTrades}={}){
 if(!Array.isArray(trades))throw Error('Trades must be an array');
 const seen=new Set();
 for(const t of trades){
   if(!t||typeof t.id!=='string'||seen.has(t.id))throw Error('Duplicate/missing closed trade id');
   seen.add(t.id);
   if(!valid(t.netUsd)||!t.closedAt||!Number.isFinite(Date.parse(t.closedAt)))throw Error('Invalid closed trade evidence');
 }
 const sorted=[...trades].sort((a,b)=>Date.parse(a.closedAt)-Date.parse(b.closedAt)||a.id.localeCompare(b.id));
 const n=sorted.length,wins=sorted.filter(t=>t.netUsd>0).length,losers=n-wins;
 const sum=sorted.reduce((v,t)=>v+t.netUsd,0),winGross=sorted.reduce((v,t)=>v+Math.max(0,t.netUsd),0);
 const lossGross=sorted.reduce((v,t)=>v+Math.max(0,-t.netUsd),0);
 const pf=lossGross>0?winGross/lossGross:(winGross>0?null:0); // null: unbounded with no losses, never numeric Infinity in JSON
 let run=0,peak=0,maxDrawdownUsd=0;
 for(const t of sorted){run+=t.netUsd;peak=Math.max(peak,run);maxDrawdownUsd=Math.max(maxDrawdownUsd,peak-run);}
 const cohorts=new Set(sorted.map(t=>t.cohort));
 const verified=sorted.every(t=>t.evidence==='ALPACA_PAPER_FILLS'&&t.feeBasis==='POSTED_FEES_VERIFIED'&&
   typeof t.cohort==='string'&&t.cohort!=='UNATTRIBUTED'&&t.cohort!=='MIXED');
 const sufficient=n>=minTrades;
 const observed=sufficient&&wins/n>=GOAL.minimumWinRate&&sum>0&&(pf===null||pf>=GOAL.minimumProfitFactor);
 const stable=sufficient&&cohorts.size===1;
 const status=!sufficient?'INSUFFICIENT_CLOSED_TRADES':
   !stable?'MIXED_STRATEGY_COHORT':
   !observed?'PERFORMANCE_NOT_MET':
   !verified?'PROVISIONAL_COSTS_OR_EVIDENCE':'TARGET_VERIFIED';
 return {status,goal:GOAL,closedTrades:n,wins,losses:losers,
   winRatePct:n?Number((wins/n*100).toFixed(2)):0,
   wilson95LowerPct:Number((wilsonLowerBound(wins,n)*100).toFixed(2)),
   netUsd:Number(sum.toFixed(4)),expectancyUsd:n?Number((sum/n).toFixed(4)):0,
   profitFactor:pf===null?null:Number(pf.toFixed(4)),maxDrawdownUsd:Number(maxDrawdownUsd.toFixed(4)),
   singleCohort:cohorts.size<=1,feesAndFillsVerified:verified,
   observedThresholdMet:observed,verifiedTargetMet:status==='TARGET_VERIFIED',
   note:'Secondary 70% win-rate threshold over 61+ CLOSED trades; independently verified broker costs and fill evidence required for verified status. Historical and modeled results remain provisional.'};
}

// Derived only from cumulative filled_qty and filled_avg_price of broker order snapshots.
// Multiple updates of the same order are NOT new trades.
// Without broker-posted fee reconciliation these are ESTIMATED net figures.
export function reconstructClosedTrades(orders){
 if(!Array.isArray(orders))throw Error('Order snapshots array required');
 const sorted=[...orders].filter(o=>Number(o.filled_qty)>0).sort((a,b)=>
   Date.parse(a.submitted_at)-Date.parse(b.submitted_at)||String(a.id).localeCompare(String(b.id)));
 const holdings=new Map(),completed=[];
 for(const o of sorted){
  if(!botId(o.client_order_id))continue;
  const qty=Number(o.filled_qty),price=Number(o.filled_avg_price),ts=Date.parse(o.submitted_at);
  if(!valid(qty)||qty<=0||!valid(price)||price<=0||!Number.isFinite(ts)||!['buy','sell'].includes(o.side))
    throw Error('Cannot score incomplete or malformed broker fill');
  const asset=symbol(o.symbol);
  if(!['SPY','QQQ','IWM','BTCUSD','ETHUSD'].includes(asset))throw Error('Unauthorized performance symbol');
  const cohort=typeof o.candidateId==='string'&&o.candidateId.length>0?o.candidateId:'UNATTRIBUTED';
  const feeRate=crypto(asset)?.005:.001; // per leg, model only (crypto includes estimated spread)
  let lot=holdings.get(asset);
  if(o.side==='buy'){
    if(!lot){lot={id:o.id,openedAt:o.submitted_at,qty:0,buyNotional:0,sellNotional:0,modelCost:0,cohort};holdings.set(asset,lot);}
    lot.qty+=qty;lot.buyNotional+=qty*price;lot.modelCost+=qty*price*feeRate;
    if(lot.cohort!==cohort)lot.cohort='MIXED';
  }else{
    if(!lot||lot.qty<qty-1e-8)throw Error('Unattributed exit or quantity overdraw; cannot fabricate a win');
    lot.qty-=qty;lot.sellNotional+=qty*price;lot.modelCost+=qty*price*feeRate;
    if(lot.cohort!==cohort)lot.cohort='MIXED';
    if(Math.abs(lot.qty)<1e-8){
      completed.push({id:hash([asset,lot.id,o.id]).slice(0,24),symbol:asset,
        closedAt:o.filled_at||o.submitted_at,cohort:lot.cohort,
        netUsd:Number((lot.sellNotional-lot.buyNotional-lot.modelCost).toFixed(6)),
        evidence:'ALPACA_PAPER_FILLS',feeBasis:'MODELED_NOT_POSTED'});
      holdings.delete(asset);
    }
  }
 }
 return {closedTrades:completed,openPositions:[...holdings.keys()]};
}
export class ForwardPaperBook {
 constructor(snapshot={}){this.orders=new Map(Object.entries(snapshot||{}));}
 restore(snapshot){if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))throw Error('Invalid snapshot');this.orders=new Map(Object.entries(snapshot));}
 snapshot(){return Object.fromEntries(this.orders);}
 // Changes are prepared but NEVER applied until the caller has journalled them durably.
 prepare(raw,candidateId){
  if(!raw||typeof raw.id!=='string'||!botId(raw.client_order_id)||!(Number(raw.filled_qty)>0))return null;
  const normalized={id:raw.id,client_order_id:raw.client_order_id,symbol:raw.symbol,side:raw.side,
    filled_qty:String(raw.filled_qty),filled_avg_price:String(raw.filled_avg_price),
    submitted_at:raw.submitted_at,filled_at:raw.filled_at||null,
    candidateId:candidateId||this.orders.get(raw.id)?.candidateId||null};
  const older=this.orders.get(raw.id);
  if(older&&Number(normalized.filled_qty)<Number(older.filled_qty)-1e-9)throw Error('Broker fill quantity decreased');
  if(older&&hash(older)===hash(normalized))return null;
  const next={...this.snapshot(),[raw.id]:normalized};
  const result=reconstructClosedTrades(Object.values(next));
  return {next,summary:measureGoal(result.closedTrades),closedTrades:result.closedTrades};
 }
 apply(prepared){if(!prepared?.next)throw Error('Not a prepared performance update');this.restore(prepared.next);}
 summary(){const derived=reconstructClosedTrades([...this.orders.values()]);return measureGoal(derived.closedTrades);}
}
