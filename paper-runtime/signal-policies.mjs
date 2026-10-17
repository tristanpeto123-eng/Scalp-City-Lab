// Interpretable, causal, long-only chart signal families.
// Each observe() sees exactly ONE already-finalised candle and cannot inspect
// future OHLC. Decisions may trigger only a NEXT-candle-open paper simulation.
// Not broker trading code, not an ML or statistical guarantee.
export const STRATEGY_FAMILIES=Object.freeze({
 ema_trend:'EMA trend crossover',
 rsi_reversion:'RSI mean-reversion',
 channel_breakout:'Donchian channel breakout'
});
export const STRATEGY_GRID=Object.freeze([
 ...[[6,26],[9,34],[12,48],[4,16],[5,21],[7,28],[8,32],[10,40]]
   .map(([fast,slow])=>Object.freeze({family:'ema_trend',fast,slow})),
 ...[[14,28,56],[14,32,60],[9,25,55],[21,30,60]]
   .map(([period,buyBelow,sellAbove])=>Object.freeze({family:'rsi_reversion',period,buyBelow,sellAbove})),
 ...[[15,8],[20,10],[30,12],[40,20]]
   .map(([lookback,exitLookback])=>Object.freeze({family:'channel_breakout',lookback,exitLookback}))
]);
export function normaliseStrategy(p){
 if(!p||typeof p!=='object')throw Error('Missing strategy parameters');
 const family=p.family||'ema_trend';
 if(!Object.hasOwn(STRATEGY_FAMILIES,family))throw Error('Unknown strategy family');
 if(family==='ema_trend'){
  if(!Number.isInteger(p.fast)||!Number.isInteger(p.slow)||p.fast<2||p.fast>=p.slow||p.slow>120)
   throw Error('Invalid EMA strategy');
  return {family,fast:p.fast,slow:p.slow};
 }
 if(family==='rsi_reversion'){
  if(!Number.isInteger(p.period)||p.period<3||p.period>40||
    !Number.isInteger(p.buyBelow)||p.buyBelow<10||p.buyBelow>45||
    !Number.isInteger(p.sellAbove)||p.sellAbove<=p.buyBelow||p.sellAbove>90)
   throw Error('Invalid RSI strategy');
  return {family,period:p.period,buyBelow:p.buyBelow,sellAbove:p.sellAbove};
 }
 if(!Number.isInteger(p.lookback)||p.lookback<5||p.lookback>80||
   !Number.isInteger(p.exitLookback)||p.exitLookback<3||p.exitLookback>p.lookback)
  throw Error('Invalid channel breakout strategy');
 return {family,lookback:p.lookback,exitLookback:p.exitLookback};
}
export const strategyKey=p=>JSON.stringify(normaliseStrategy(p));
export function explainSignalPolicy(params){
 const p=normaliseStrategy(params);
 if(p.family==='ema_trend')return {
  method:'Compare fast and slow exponential moving averages of completed closes',
  entry:'If EMA '+p.fast+' > EMA '+p.slow+', queue entry for next candle open',
  exit:'If EMA '+p.fast+' <= EMA '+p.slow+', queue next-open exit; emergency simulated stop remains active',
  parameters:p,assumption:'Persistent directional moves can outweigh transaction costs'
 };
 if(p.family==='rsi_reversion')return {
  method:'Wilder RSI from completed close-to-close gains and losses',
  entry:'If '+p.period+'-bar RSI < '+p.buyBelow+', queue next-open entry',
  exit:'If RSI >= '+p.sellAbove+', queue next-open exit; emergency simulated stop remains active',
  parameters:p,assumption:'Oversold moves may rebound, but oversold conditions can persist'
 };
 return {
  method:'Rolling historical candle highs/lows excluding the signal candle',
  entry:'If completed close exceeds PRIOR '+p.lookback+'-bar high, queue next-open entry',
  exit:'If completed close falls below PRIOR '+p.exitLookback+'-bar low, queue next-open exit',
  parameters:p,assumption:'Channel expansion may signal momentum; whipsaws and gaps can be costly'
 };
}
export function signalPolicy(params){
 const p=normaliseStrategy(params);
 let fast=null,slow=null,prev=null,count=0,avgGain=null,avgLoss=null;
 const highs=[],lows=[];
 return {
  params:p,
  observe(bar){
   if(!bar||![bar.o,bar.h,bar.l,bar.c].every(Number.isFinite)||
      bar.l<=0||bar.h<Math.max(bar.o,bar.c,bar.l)||
      bar.l>Math.min(bar.o,bar.c,bar.h))throw Error('Malformed signal candle');
   let entry=false,exit=false,metric=null;
   if(p.family==='ema_trend'){
     fast=fast===null?bar.c:fast+2/(p.fast+1)*(bar.c-fast);
     slow=slow===null?bar.c:slow+2/(p.slow+1)*(bar.c-slow);
     entry=fast>slow;exit=!entry;metric={fastEma:fast,slowEma:slow};
   }else if(p.family==='rsi_reversion'){
     if(prev!==null){
       const delta=bar.c-prev,gain=Math.max(0,delta),loss=Math.max(0,-delta);
       if(avgGain===null){avgGain=gain;avgLoss=loss}
       else {avgGain=(avgGain*(p.period-1)+gain)/p.period;
         avgLoss=(avgLoss*(p.period-1)+loss)/p.period;}
     }
     if(count>=p.period&&avgGain!==null){
       const rsi=avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss);
       entry=rsi<p.buyBelow;exit=rsi>=p.sellAbove;metric={rsi};
     }
   }else{
     if(highs.length>=p.lookback){
       const ceiling=Math.max(...highs.slice(-p.lookback));
       const floor=Math.min(...lows.slice(-p.exitLookback));
       entry=bar.c>ceiling;exit=bar.c<floor;
       metric={priorHigh:ceiling,priorLow:floor};
     }
     highs.push(bar.h);lows.push(bar.l);
     if(highs.length>p.lookback){highs.shift();lows.shift();}
   }
   prev=bar.c;count++;
   return {entry,exit,metric,ready:metric!==null,family:p.family};
  }
 };
}
