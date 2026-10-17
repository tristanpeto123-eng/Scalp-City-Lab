// Browser + Node deterministic OFFLINE historical virtual validation.
// Uses only completed Alpaca/Kraken 15-minute OHLCV snapshots. No broker orders.
// Simulated losses, fees, gaps and unfilled positions are not real executions.
export const PAIRS=Object.freeze(['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD']);
const PERIOD=900000,FEE=.005,MAX_VOLUME_GAP=.40;
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const iso=t=>new Date(t).toISOString();
export function checkSnapshot(source,symbol,now=Date.now()){
 if(!PAIRS.includes(symbol)||!source||source.symbol!==symbol||source.timeframe!=='15Min'||
    !Array.isArray(source.bars)||source.bars.length<480||source.bars.length>20000)
   throw Error('Preloaded data missing, mismatched or insufficient for '+symbol);
 const bars=source.bars.map(b=>({t:Date.parse(b.t),o:Number(b.o),h:Number(b.h),l:Number(b.l),c:Number(b.c),v:Number(b.v)}));
 let zero=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i];
  if(!valid(b.t)||![b.o,b.h,b.l,b.c,b.v].every(valid)||b.v<0||
    Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)||
    (i&&b.t-bars[i-1].t!==PERIOD))
   throw Error('Invalid, missing or noncontiguous 15-minute candle at index '+i);
  if(!b.v)zero++;
 }
 if((bars.at(-1).t+PERIOD)>now-30000)throw Error('Snapshot includes unfinished or future candles');
 if(zero/bars.length>MAX_VOLUME_GAP)throw Error('More than 40% zero-volume bars; insufficient traded-price evidence');
 if(source.source!=='ALPACA_KRAKEN_US_1_HISTORICAL_GET')
   throw Error('Unverified candle-source provenance');
 return {symbol,bars,source:source.source,snapshotAt:source.generatedAt||null,
  sampleStart:iso(bars[0].t),sampleEnd:iso(bars.at(-1).t+PERIOD),
  zeroVolumeFraction:zero/bars.length};
}
export function simulateValidation({snapshot,symbol,startingBalanceGbp=50,mode='duration',limit=14,strategy='ema',now=Date.now()}){
 const checked=checkSnapshot(snapshot,symbol,now);
 if(!valid(startingBalanceGbp)||startingBalanceGbp<50||startingBalanceGbp>1e6)
  throw Error('Starting virtual balance must be £50–£1m');
 if(!['duration','profit'].includes(mode)||!valid(limit)||limit<=0||
   (mode==='duration'&&(!Number.isInteger(limit)||limit>3650))||
   (mode==='profit'&&limit>1e8))
  throw Error('Invalid duration or cumulative-profit target');
 if(!['ema','rsi','breakout'].includes(strategy))throw Error('Unknown strategy');
 const bars=checked.bars,calibrationEnd=Math.floor(bars.length*.4),test=bars.slice(calibrationEnd);
 // Feature warmup uses only first 40%; no tuning/selecting on held-out bars.
 let fast=null,slow=null,prev=null,avgGain=0,avgLoss=0,ready=0;
 const high=[],low=[];let rsi=50;
 function observe(b){
  const earlierHigh=high.length>=20?Math.max(...high.slice(-20)):Infinity;
  const earlierLow=low.length>=10?Math.min(...low.slice(-10)):-Infinity;
  fast=fast===null?b.c:fast+2/10*(b.c-fast);
  slow=slow===null?b.c:slow+2/35*(b.c-slow);
  if(prev!==null){const gain=Math.max(0,b.c-prev),loss=Math.max(0,prev-b.c);
   avgGain=(avgGain*13+gain)/14;avgLoss=(avgLoss*13+loss)/14;
   rsi=avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);}
  prev=b.c;high.push(b.h);low.push(b.l);ready++;
  if(high.length>20){high.shift();low.shift();}
  if(strategy==='ema')return {entry:ready>=35&&fast>slow,exit:fast<=slow};
  if(strategy==='rsi')return {entry:ready>=35&&rsi<30,exit:rsi>=60};
  return {entry:ready>=35&&b.c>earlierHigh,exit:b.c<earlierLow};
 }
 bars.slice(0,calibrationEnd).forEach(observe);
 let cash=startingBalanceGbp,open=null,pending=null,wins=0,losses=0,closed=0,realized=0,
  maxDD=0,peak=startingBalanceGbp,processed=0,reason='HISTORY_EXHAUSTED',
  endTime=test.at(-1).t+PERIOD;
 const trades=[];
 const close=(price,t,kind)=>{
  const proceeds=open.units*price*(1-FEE),net=proceeds-open.entryCost;
  cash+=proceeds;realized+=net;closed++;if(net>0)wins++;else losses++;
  trades.push({openedAt:iso(open.openTime),closedAt:iso(t),entryPrice:open.entryPrice,
   exitPrice:price,netGbp:round(net),exit:kind});
  open=null;
 };
 for(let i=0;i<test.length;i++){
  const b=test[i];
  if(mode==='duration'&&b.t-test[0].t>=limit*86400000){
   reason='DURATION_REACHED';endTime=b.t;break;
  }
  if(pending==='SELL'&&open)close(b.o,b.t,'SIGNAL_NEXT_OPEN');
  else if(pending==='BUY'&&!open){
   // Position size limits modeled 2% stop + fee risk to 1% of cash,
   // 50% maximum notional; none of this guarantees gap risk protection.
   const stopNetFraction=.02+FEE*(2-.02);
   const notional=Math.min(cash*.5,cash*.01/stopNetFraction);
   if(notional>=1&&cash>notional*(1+FEE)){
    const units=notional/b.o,entryCost=notional*(1+FEE);
    cash-=entryCost;
    open={units,entryCost,entryPrice:b.o,openTime:b.t,stopPrice:b.o*.98};
   }
  }
  pending=null;
  if(open&&b.o<=open.stopPrice)close(b.o,b.t,'STOP_GAP_NEXT_OPEN');
  else if(open&&b.l<=open.stopPrice)close(open.stopPrice,b.t+PERIOD,'SIMULATED_INTRABAR_STOP');
  const signal=observe(b);
  if(open&&signal.exit)pending='SELL';
  else if(!open&&signal.entry)pending='BUY';
  const marked=cash+(open?open.units*b.c*(1-FEE):0);
  peak=Math.max(peak,marked);maxDD=Math.max(maxDD,100*(peak-marked)/peak);
  processed++;endTime=b.t+PERIOD;
  // Goal is CUMULATIVE realised NET trade profit, not one winning trade.
  if(mode==='profit'&&!open&&realized>=limit){
    reason='CUMULATIVE_NET_PROFIT_REACHED';break;
  }
 }
 const last=test[Math.max(0,processed-1)];
 const estimatedLiquidation=open?open.units*last.c*(1-FEE):0;
 const equity=cash+estimatedLiquidation;
 const netProfit=realized;
 if(Math.abs(cash+(open?open.entryCost:0)-startingBalanceGbp-realized)>0.00001)
  throw Error('Closed-trade ledger reconciliation failed');
 return {symbol,strategy,mode,limit,startingBalanceGbp,
  actualSource:checked.source,sourcePeriod:{start:checked.sampleStart,end:checked.sampleEnd},
  status:reason,goalReached:reason==='CUMULATIVE_NET_PROFIT_REACHED',
  elapsedDays:round((endTime-test[0].t)/86400000),
  validationPeriod:{start:iso(test[0].t),end:iso(endTime)},
  candlesTotal:bars.length,calibrationCandles:calibrationEnd,heldOutCandles:processed,
  availableTestDays:round(test.length/96),
  realizedNetProfitGbp:round(netProfit),cashBalanceGbp:round(cash),
  markedEquityGbp:round(equity),openPosition:Boolean(open),
  closedTrades:closed,wins,losses,winRatePct:closed?round(wins/closed*100):null,
  maxDrawdownPct:round(maxDD),trades,
  costAssumption:'Illustrative 0.5% per side; no independent spread, GBP/USD FX or slippage evidence.',
  validation:'Historical simulation ONLY. No actual fills, persistence, real deposits or withdrawals.',
  payoutGuaranteed:false,actualForwardTradeCount:0};
}
