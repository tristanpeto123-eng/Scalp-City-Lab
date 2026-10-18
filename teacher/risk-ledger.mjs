// Compute $50 examiner-level mark from *paper fills*, not the broker's
// unrelated $100k default buying power. Conservative before final CFEE posting.
import {POLICY} from './engine.mjs';
const num=x=>Number(x);
const val=n=>Number.isFinite(n)&&n>=0;
export function virtualPaperEquity({symbol,orders,positions,ownedClientIds,markPrice}){
 if(!Number.isFinite(markPrice)||markPrice<=0||!Array.isArray(orders)||
    !Array.isArray(positions)||!(ownedClientIds instanceof Set))
  throw Error('RISK: missing proven paper evidence');
 let buys=0,sells=0,buyQty=0,sellQty=0,turnover=0;
 for(const order of orders){
   if(order.symbol!==symbol||!ownedClientIds.has(order.client_order_id))
    throw Error('RISK: unknown order in dedicated paper account');
   const qty=num(order.filled_qty||0),avg=num(order.filled_avg_price||0);
   if(!val(qty)||!val(avg)||(qty>0&&avg<=0))throw Error('RISK: invalid execution mark');
   const notional=qty*avg;turnover+=notional;
   if(order.side==='buy'){buys+=notional;buyQty+=qty;}
   else if(order.side==='sell'){sells+=notional;sellQty+=qty;}
   else throw Error('RISK: unknown side');
 }
 const held=positions.reduce((s,p)=>{
   if(p.symbol!==symbol)throw Error('RISK: foreign paper holding');
   const qty=num(p.qty);
   if(!val(qty))throw Error('RISK: invalid held quantity');
   return s+qty;
 },0);
 // Crypto buy fees are deducted in coin; broker holdings are authoritative
 // for actual quantity. Over-hedged negative net inventory fails closed.
 if(sellQty>buyQty+1e-7||held>Math.max(0,buyQty-sellQty)+1e-7)
  throw Error('RISK: broker holding exceeds explained fills');
 // Conservative 0.5% per-side upper allowance until posted broker fees settle.
 const reserve=turnover*.005;
 const equity=POLICY.perPupilVirtualUsd-buys+sells+held*markPrice-reserve;
 if(!Number.isFinite(equity)||equity<0)
  throw Error('RISK: negative or uncomputable virtual equity');
 return {equity,netUsd:equity-POLICY.perPupilVirtualUsd,
   held,brokerQuote:markPrice,estimatedFeeReserveUsd:reserve,
   method:'FILLS_BASED_CONSERVATIVE_VIRTUAL_$50'};
}
