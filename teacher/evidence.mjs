// Independently reconcile complete Alpaca PAPER order and activity histories.
// Never infer executions from order acknowledgements or assume absent fees = zero.
const good=n=>typeof n==='number'&&Number.isFinite(n);
const number=(raw,label)=>{const n=Number(raw);
  if(raw===null||raw===undefined||raw===''||!good(n))throw Error('EVIDENCE: invalid '+label);
  return n;
};
const time=x=>Date.parse(x);
const day=x=>new Date(time(x)).toISOString().slice(0,10);
const norm=s=>String(s||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
function pending(reason,details={}){return {verifiedByPaperBroker:false,status:'EVIDENCE_PENDING',reason,...details};}
export function reconcilePaper({symbol,modelId,admissionStartedAt,orders,activities,
  journalOrderIds,positions=[],openOrders=[],now=Date.now(),accountId}={}){
  if(!symbol||!modelId||!accountId||!Number.isFinite(time(admissionStartedAt))||
     !Array.isArray(orders)||!Array.isArray(activities)||
     !Array.isArray(positions)||!Array.isArray(openOrders)||
     !(journalOrderIds instanceof Set))
    throw Error('EVIDENCE: missing authentic broker query inputs');
  if(!journalOrderIds.size)return pending('No teacher orders are recorded',{symbol,modelId});
  const byId=new Map();
  for(const o of orders){
    if(!o?.id||byId.has(o.id)||!o.client_order_id)
      throw Error('EVIDENCE: duplicate/unidentified paper order');
    byId.set(o.id,o);
    if(o.symbol!==symbol||!journalOrderIds.has(o.client_order_id)||
       !/^teacher-[a-f0-9]{34}$/.test(o.client_order_id))
      return pending('Paper account includes an unknown/manual order',{symbol,modelId});
  }
  if([...journalOrderIds].some(id=>!orders.some(o=>o.client_order_id===id)))
    return pending('Journal order missing from complete broker history',{symbol,modelId});
  if(positions.some(p=>p.symbol!==symbol||number(p.qty,'position quantity')<0))
    return pending('Unknown or negative broker holding',{symbol,modelId});
  if(openOrders.some(o=>o.symbol!==symbol||!journalOrderIds.has(o.client_order_id)))
    return pending('Unattributed open order',{symbol,modelId});
  const fills=[],fees=[],ids=new Set();
  for(const a of activities){
    if(typeof a?.id!=='string'||!a.id||ids.has(a.id))
      throw Error('EVIDENCE: duplicate or absent broker activity ID');
    ids.add(a.id);
    if(a.activity_type==='FILL'){
      const order=byId.get(a.order_id);
      if(!order||a.symbol!==symbol||a.side!==order.side||
         !['buy','sell'].includes(a.side)||!Number.isFinite(time(a.transaction_time))||
         time(a.transaction_time)<time(admissionStartedAt)||
         time(a.transaction_time)>now)
        throw Error('EVIDENCE: fill cannot be bound to frozen pupil');
      const qty=number(a.qty,'fill quantity'),price=number(a.price,'fill price');
      if(qty<=0||price<=0)throw Error('EVIDENCE: invalid fill price/quantity');
      fills.push({id:a.id,orderId:a.order_id,clientId:order.client_order_id,
        side:a.side,qty,price,at:a.transaction_time,day:day(a.transaction_time)});
    }else if(a.activity_type==='FEE'||a.activity_type==='CFEE'){
      if(typeof a.date!=='string'||!Number.isFinite(Date.parse(a.date+'T00:00:00Z'))||
         norm(a.symbol)&&norm(a.symbol)!==norm(symbol))
        throw Error('EVIDENCE: fee date/symbol ambiguous');
      const type=a.activity_type;
      const net=a.net_amount===undefined?0:number(a.net_amount,'fee net amount');
      const qty=a.qty===undefined?0:number(a.qty,'fee units');
      const price=a.price===undefined?0:number(a.price,'fee unit price');
      if(net>0||qty>0||price<0||(!net&&!qty)||((qty<0)&&price<=0))
        throw Error('EVIDENCE: ambiguous/malformed crypto fee activity');
      fees.push({id:a.id,day:a.date.slice(0,10),kind:type,
        coinQty:qty<0?-qty:0,usdFee:net<0?-net:0,coinPrice:price});
    }else throw Error('EVIDENCE: unknown broker activity category');
  }
  if(!fills.length)return pending('No broker FILL activities yet',{symbol,modelId});
  // 1. Independently reconcile per-order cumulative fills with broker record.
  for(const order of orders){
    const related=fills.filter(f=>f.orderId===order.id);
    const quantity=related.reduce((sum,f)=>sum+f.qty,0);
    const brokerQuantity=number(order.filled_qty,'filled_qty');
    if(Math.abs(quantity-brokerQuantity)>Math.max(1e-8,brokerQuantity*1e-7))
      throw Error('EVIDENCE: order quantity does not match immutable FILL activities');
    if(!related.length&&brokerQuantity>0)
      throw Error('EVIDENCE: broker claims unrecorded execution');
  }
  if(orders.some(o=>!['filled','canceled','cancelled','expired','rejected','done_for_day']
    .includes(o.status)))return pending('Nonfinal/partial paper order status',{symbol,modelId});
  if(openOrders.length)return pending('Outstanding broker order',{symbol,modelId});
  // 2. Every charged date must have an independently posted fee record.
  // Alpaca may post CFEE the next UTC day. We deny ambiguous dates rather
  // than allocate an invented zero or guess attribution.
  const dated=new Map();
  for(const fill of fills){const entry=dated.get(fill.day)||{buys:[],sells:[]};
    (fill.side==='buy'?entry.buys:entry.sells).push(fill);dated.set(fill.day,entry);}
  if(fills.some(f=>now-time(f.at)<48*3600_000))
    return pending('Crypto settlement/CFEE waiting period (48h)',{symbol,modelId});
  for(const [d,group] of dated){
    if(!fees.some(f=>f.day===d))
      return pending('Broker has not posted complete fees for '+d,{symbol,modelId});
    if(group.buys.length&&group.sells.length&&
       fees.some(f=>f.day===d&&!f.usdFee&&!f.coinQty))
      return pending('Fee currency allocation ambiguous on '+d,{symbol,modelId});
  }
  for(const f of fees){
    if(!dated.has(f.day))return pending('Unattributed/out-of-period fee '+f.day,{symbol,modelId});
  }
  // 3. Buy-coin CFEE reduces deliverable cryptocurrency, not twice the P&L.
  // Sell-USD fees reduce the USD proceeds; do not also double-count crypto fee.
  const adjusted=new Map(fills.map(f=>[f.id,{...f,coinFee:0,usdFee:0}]));
  for(const f of fees){
    const group=dated.get(f.day);
    if(f.coinQty){
      if(!group.buys.length)return pending('Coin fee without same-day buy fill',{symbol,modelId});
      const total=group.buys.reduce((s,x)=>s+x.qty,0);
      if(f.coinQty>=total)return pending('Fee consumes all purchased units',{symbol,modelId});
      for(const x of group.buys)adjusted.get(x.id).coinFee+=f.coinQty*x.qty/total;
    }
    if(f.usdFee){
      if(!group.sells.length)return pending('USD fee without same-day sell fill',{symbol,modelId});
      const total=group.sells.reduce((s,x)=>s+x.qty*x.price,0);
      if(total<=0)return pending('Unable to allocate sell fee',{symbol,modelId});
      for(const x of group.sells)
        adjusted.get(x.id).usdFee+=f.usdFee*x.qty*x.price/total;
    }
  }
  // 4. A single round trip spans all partial fills from entry to flat.
  // A partially filled sell MUST NOT count as two independent trials.
  const ordered=[...adjusted.values()].sort((a,b)=>time(a.at)-time(b.at)||
    a.id.localeCompare(b.id));
  const closedTrades=[];let inventory=0,buyUsd=0,sellUsd=0,sellFees=0,
    startedAt=null,fillIds=[];
  for(const fill of ordered){
    const netQty=fill.qty-fill.coinFee;
    if(fill.side==='buy'){
      if(netQty<=0)throw Error('EVIDENCE: buy activity fully consumed by fees');
      if(inventory<0)throw Error('EVIDENCE: illegal short position');
      if(!inventory)startedAt=fill.at;
      inventory+=netQty;buyUsd+=fill.qty*fill.price;
    }else{
      if(inventory<=0||fill.qty>inventory+Math.max(1e-8,inventory*1e-7))
        throw Error('EVIDENCE: unowned or short sell fill');
      inventory-=fill.qty;sellUsd+=fill.qty*fill.price;sellFees+=fill.usdFee;
    }
    fillIds.push(fill.id);
    if(fill.side==='sell'&&inventory<=Math.max(1e-8,fill.qty*1e-7)){
      const closeId='paper-roundtrip-'+fillIds.join('.').slice(0,400);
      closedTrades.push({closeId,openedAt:startedAt,closedAt:fill.at,
        buyUsd,sellUsd,feeUsd:sellFees,fillIds:[...fillIds],
        accountId,modelId});
      inventory=0;buyUsd=0;sellUsd=0;sellFees=0;startedAt=null;fillIds=[];
    }
  }
  const actualQty=positions.filter(p=>p.symbol===symbol).reduce((s,p)=>s+number(p.qty,'remaining qty'),0);
  if(Math.abs(actualQty-inventory)>Math.max(1e-8,Math.max(actualQty,inventory)*1e-7))
    return pending('Broker position differs from fee-adjusted fill inventory',{symbol,modelId});
  if(inventory>1e-8||actualQty>1e-8)return pending('Open exposure; exam remains provisional',
    {symbol,modelId,closedTrades});
  // Close IDs are unique broker-evidence IDs, not invented win-rate samples.
  if(new Set(closedTrades.map(t=>t.closeId)).size!==closedTrades.length)
    throw Error('EVIDENCE: duplicate round-trip IDs');
  const feesByCloseId=closedTrades.map(t=>({id:t.closeId,feeUsd:t.feeUsd}));
  return {verifiedByPaperBroker:true,status:'BROKER_RECONCILED',symbol,modelId,
    accountId,unattributedOrders:0,hasOpenExposure:false,hasPendingOrders:false,
    closedTrades:closedTrades.map(({feeUsd,fillIds,accountId,modelId,...x})=>x),
    feeEvidence:{complete:true,settled:true,feesByCloseId},
    verifiedFillCount:fills.length,postedFeeCount:fees.length,
    digest:'REQUIRES_SERVER_SIGNATURE',
    explanation:'Dedicated paper account, FILL identities, broker order quantities and posted fee activities independently reconciled'};
}
