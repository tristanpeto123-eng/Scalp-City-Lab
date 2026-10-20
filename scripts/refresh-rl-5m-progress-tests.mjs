import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareFiveMinuteSourceTail,FIVE_MIN_MS,validateFiveMinuteSnapshot} from './refresh-rl-5m.mjs';
const now=Date.parse('2026-10-20T20:40:00Z');
const base=now-12*86400_000;
const bars=Array.from({length:2400},(_,i)=>({
 t:new Date(base+i*FIVE_MIN_MS).toISOString(),
 o:100+i*.001,h:101+i*.001,l:99+i*.001,c:100.5+i*.001,v:17
}));
const snapshot=bs=>({
 symbol:'BTC/USD',source:'ALPACA_KRAKEN_US_US-1',
 timeframe:'5Min',trading:false,generatedAt:new Date(now).toISOString(),bars:bs
});
const old=snapshot(bars),newBars=bars.slice(2).concat([1,2].map(j=>({
 ...bars.at(-1),t:new Date(Date.parse(bars.at(-1).t)+j*FIVE_MIN_MS).toISOString()
})));
const newer=snapshot(newBars);
test('baseline and unchanged source never claim newly learned candles',()=>{
 const baseline=compareFiveMinuteSourceTail(null,old);
 assert.equal(baseline.newTailCandles,0);
 assert.equal(baseline.state,'BASELINE_CAPTURE_NO_NEW_LEARNING');
 const repeat=compareFiveMinuteSourceTail(old,snapshot([...bars]));
 assert.equal(repeat.newTailCandles,0);
 assert.equal(repeat.state,'UNCHANGED_SOURCE_NO_NEW_LEARNING');
});
test('rolling 5m source counts only appended completed candles, not re-used overlap',()=>{
 validateFiveMinuteSnapshot(old,now);
 validateFiveMinuteSnapshot(newer,now);
 const r=compareFiveMinuteSourceTail(old,newer);
 assert.equal(r.newTailCandles,2);
 assert.equal(r.overlap,2398);
 assert.equal(r.state,'VERIFIED_NEW_SOURCE_TAIL');
});
test('rewritten overlap, backwards update, gaps and cross-symbol mixes fail closed',()=>{
 const changed=snapshot(newBars.map((b,i)=>i===100?{...b,c:b.c+.1}:b));
 assert.throws(()=>compareFiveMinuteSourceTail(old,changed),/previously observed candle changed/);
 assert.throws(()=>compareFiveMinuteSourceTail(old,snapshot(bars.slice(0,-1))),/backwards/);
 const gap=snapshot([...newBars.slice(0,-1),
  {...newBars.at(-1),t:new Date(Date.parse(newBars.at(-1).t)+FIVE_MIN_MS).toISOString()}]);
 assert.throws(()=>compareFiveMinuteSourceTail(old,gap),/missing new completed tail candles/);
 assert.throws(()=>compareFiveMinuteSourceTail(old,{...newer,symbol:'ETH/USD'}),/incompatible/);
 assert.throws(()=>compareFiveMinuteSourceTail(old,snapshot(bars.map(b=>({
   ...b,t:new Date(Date.parse(b.t)+FIVE_MIN_MS*3000).toISOString()
 }))))),/previous source tail absent/);
});
