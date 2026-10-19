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
 if(source.source!=='ALPACA_KRAKEN_US_US-1')
   throw Error('Unverified candle-source provenance');
 return {symbol,bars,source:source.source,snapshotAt:source.generatedAt||null,
  sampleStart:iso(bars[0].t),sampleEnd:iso(bars.at(-1).t+PERIOD),
  zeroVolumeFraction:zero/bars.length};
}
function strategyConfig(strategy,p={}){
 if(strategy==='ema'){const fast=p.fast??9,slow=p.slow??34;
  if(!Number.isInteger(fast)||!Number.isInteger(slow)||fast<3||fast>=slow||slow>96)throw Error('Invalid EMA parameters');
  return {fast,slow};}
 if(strategy==='rsi'){const period=p.period??14,buyBelow=p.buyBelow??30,sellAbove=p.sellAbove??60;
  if(!Number.isInteger(period)||period<7||period>30||
   !Number.isInteger(buyBelow)||buyBelow<10||buyBelow>40||
   !Number.isInteger(sellAbove)||sellAbove<=buyBelow||sellAbove>85)throw Error('Invalid RSI parameters');
  return {period,buyBelow,sellAbove};}
 if(strategy==='breakout'){const lookback=p.lookback??20,exitLookback=p.exitLookback??10;
  if(!Number.isInteger(lookback)||lookback<10||lookback>96||
   !Number.isInteger(exitLookback)||exitLookback<5||exitLookback>lookback)throw Error('Invalid channel parameters');
  return {lookback,exitLookback};}
 if(strategy==='synth'){
  // A bounded declarative rule tree. Never evaluate dynamic user code.
  const ints=[['fast',3,24],['slow',7,96],['period',7,30],['buyBelow',10,45],
   ['sellAbove',50,85],['lookback',10,80],['exitLookback',5,80]];
  if(ints.some(([k,min,max])=>!Number.isInteger(p[k])||p[k]<min||p[k]>max)||
    p.fast>=p.slow||p.sellAbove<=p.buyBelow||p.exitLookback>p.lookback||
    !valid(p.volumeMultiplier)||p.volumeMultiplier<1||p.volumeMultiplier>3||
    !Array.isArray(p.entrySignals)||p.entrySignals.length!==2||
    new Set(p.entrySignals).size!==2||
    p.entrySignals.some(x=>!['ema_up','rsi_dip','channel_break','volume_surge'].includes(x))||
    !['all','any'].includes(p.entryJoin)||
    !['ema_down','rsi_recovered','channel_down'].includes(p.exitSignal))
   throw Error('Invalid invented strategy rules');
  return {...p,entrySignals:[...p.entrySignals]};
 }
 throw Error('Unknown strategy');
}
export function simulateValidation({snapshot,symbol,startingBalanceGbp=50,mode='duration',limit=14,
 strategy='ema',strategyParams=null,feePerSideFraction=FEE,now=Date.now()}){
 const checked=checkSnapshot(snapshot,symbol,now);
 if(!valid(startingBalanceGbp)||startingBalanceGbp<50||startingBalanceGbp>1e6)
  throw Error('Starting virtual balance must be £50–£1m');
 if(!['duration','profit'].includes(mode)||!valid(limit)||limit<=0||
   (mode==='duration'&&(!Number.isInteger(limit)||limit>3650))||
   (mode==='profit'&&limit>1e8))
  throw Error('Invalid duration or cumulative-profit target');
 const params=strategyConfig(strategy,strategyParams||{});
 if(!valid(feePerSideFraction)||feePerSideFraction<.0025||feePerSideFraction>FEE*2)
  throw Error('Invalid modeled fee stress');
 const fee=feePerSideFraction;
 const bars=checked.bars,calibrationEnd=Math.floor(bars.length*.4),test=bars.slice(calibrationEnd);
 // Feature warmup uses only first 40%; no tuning/selecting on held-out bars.
 let fast=null,slow=null,prev=null,avgGain=0,avgLoss=0,ready=0,volumeEma=null;
 const high=[],low=[];let rsi=50;
 const warmup=Math.max(35,strategy==='ema'||strategy==='synth'?params.slow:0,
  strategy==='breakout'||strategy==='synth'?params.lookback:0);
 function observe(b){
  const earlierHigh=high.length>=params.lookback?Math.max(...high.slice(-params.lookback)):Infinity;
  const earlierLow=low.length>=params.exitLookback?Math.min(...low.slice(-params.exitLookback)):-Infinity;
  const fastN=strategy==='ema'||strategy==='synth'?params.fast:9;
  const slowN=strategy==='ema'||strategy==='synth'?params.slow:34;
  const previousVolumeEma=volumeEma===null?b.v:volumeEma;
  volumeEma=volumeEma===null?b.v:volumeEma*.95+b.v*.05;
  fast=fast===null?b.c:fast+2/(fastN+1)*(b.c-fast);
  slow=slow===null?b.c:slow+2/(slowN+1)*(b.c-slow);
  if(prev!==null){const gain=Math.max(0,b.c-prev),loss=Math.max(0,prev-b.c);
   const n=strategy==='rsi'||strategy==='synth'?params.period:14;
   avgGain=(avgGain*(n-1)+gain)/n;avgLoss=(avgLoss*(n-1)+loss)/n;
   rsi=avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);}
  prev=b.c;high.push(b.h);low.push(b.l);ready++;
  if(high.length>96){high.shift();low.shift();}
  if(strategy==='ema')return {entry:ready>=warmup&&fast>slow,exit:fast<=slow};
  if(strategy==='rsi')return {entry:ready>=warmup&&rsi<params.buyBelow,exit:rsi>=params.sellAbove};
  if(strategy==='synth'){
   const values={
    ema_up:fast>slow,rsi_dip:rsi<params.buyBelow,
    channel_break:b.c>earlierHigh,volume_surge:b.v>previousVolumeEma*params.volumeMultiplier
   };
   const entry=params.entryJoin==='all'?
    params.entrySignals.every(rule=>values[rule]):
    params.entrySignals.some(rule=>values[rule]);
   const exit=params.exitSignal==='ema_down'?fast<=slow:
    params.exitSignal==='rsi_recovered'?rsi>=params.sellAbove:b.c<earlierLow;
   return {entry:ready>=warmup&&entry,exit};
  }
  return {entry:ready>=warmup&&b.c>earlierHigh,exit:b.c<earlierLow};
 }
 bars.slice(0,calibrationEnd).forEach(observe);
 let cash=startingBalanceGbp,open=null,pending=null,wins=0,losses=0,closed=0,realized=0,
  maxDD=0,peak=startingBalanceGbp,processed=0,reason='HISTORY_EXHAUSTED',
  endTime=test.at(-1).t+PERIOD;
 const trades=[];
 const close=(price,t,kind)=>{
  const proceeds=open.units*price*(1-fee),net=proceeds-open.entryCost;
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
   const stopNetFraction=.02+fee*(2-.02);
   const notional=Math.min(cash*.5,cash*.01/stopNetFraction);
   if(notional>=1&&cash>notional*(1+fee)){
    const units=notional/b.o,entryCost=notional*(1+fee);
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
  const marked=cash+(open?open.units*b.c*(1-fee):0);
  peak=Math.max(peak,marked);maxDD=Math.max(maxDD,100*(peak-marked)/peak);
  processed++;endTime=b.t+PERIOD;
  // Goal is CUMULATIVE realised NET trade profit, not one winning trade.
  if(mode==='profit'&&!open&&realized>=limit){
    reason='CUMULATIVE_NET_PROFIT_REACHED';break;
  }
 }
 const last=test[Math.max(0,processed-1)];
 const estimatedLiquidation=open?open.units*last.c*(1-fee):0;
 const equity=cash+estimatedLiquidation;
 const netProfit=realized;
 if(Math.abs(cash+(open?open.entryCost:0)-startingBalanceGbp-realized)>0.00001)
  throw Error('Closed-trade ledger reconciliation failed');
 const grossWinnings=trades.filter(t=>t.netGbp>0).reduce((s,t)=>s+t.netGbp,0);
 const grossLosses=-trades.filter(t=>t.netGbp<0).reduce((s,t)=>s+t.netGbp,0);
 const profitFactor=closed===0?null:grossLosses>0?round(grossWinnings/grossLosses):grossWinnings>0?null:0;
 return {symbol,strategy,strategyParams:params,
  feePerSideFraction:fee,profitFactor,expectancyNetGbp:closed?round(netProfit/closed):null,
  mode,limit,startingBalanceGbp,
  actualSource:checked.source,sourcePeriod:{start:checked.sampleStart,end:checked.sampleEnd},
  status:reason,goalReached:reason==='CUMULATIVE_NET_PROFIT_REACHED',
  elapsedDays:round((endTime-test[0].t)/86400000),
  validationPeriod:{start:iso(test[0].t),end:iso(endTime)},
  candlesTotal:bars.length,calibrationCandles:calibrationEnd,heldOutCandles:processed,
  availableTestDays:round(test.length/96),
  realizedNetProfitGbp:round(netProfit),cashBalanceGbp:round(cash),
  markedEquityGbp:round(equity),openPosition:Boolean(open),openPositionInitialCostGbp:open?round(open.entryCost):0,
  closedTrades:closed,wins,losses,winRatePct:closed?round(wins/closed*100):null,
  maxDrawdownPct:round(maxDD),trades,
  costAssumption:'Modelled fee '+(fee*100).toFixed(2)+'% per side; no independent spread, GBP/USD FX or slippage evidence.',
  validation:'Historical simulation ONLY. No actual fills, persistence, real deposits or withdrawals.',
  payoutGuaranteed:false,actualForwardTradeCount:0};
}
