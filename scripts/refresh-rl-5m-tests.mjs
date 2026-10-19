import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PAIRS} from '../strategy-validation-core.mjs';
import {FIVE_MIN_MS,validateFiveMinuteSnapshot,fetchFiveMinuteSnapshot} from './refresh-rl-5m.mjs';

const now=Date.parse('2026-10-19T20:00:00Z');
const begin=now-18*86400_000;
const bars=Array.from({length:2400},(_,i)=>({
  t:new Date(begin+i*FIVE_MIN_MS).toISOString(),
  o:100+i*.001,h:101+i*.001,l:99+i*.001,c:100.5+i*.001,v:50
}));
const snapshot=(v=bars)=>({
 symbol:'BTC/USD',timeframe:'5Min',source:'ALPACA_KRAKEN_US_US-1',
 trading:false,generatedAt:new Date(now).toISOString(),bars:v
});
test('accepts only native contiguous 5m data with completed OHLC candles',()=>{
 assert.equal(validateFiveMinuteSnapshot(snapshot(),now).bars.length,2400);
 assert.throws(()=>validateFiveMinuteSnapshot({...snapshot(),timeframe:'15Min'},now),/five-minute/);
 assert.throws(()=>validateFiveMinuteSnapshot({...snapshot(),source:'SYNTHETIC'},now),/five-minute/);
 assert.throws(()=>validateFiveMinuteSnapshot(snapshot(bars.map((b,i)=>i===30?{...b,t:new Date(Date.parse(b.t)+1000).toISOString()}:b)),now),/missing/);
});
test('unfinished candle and missing rows fail closed; never interpolate 5m bars',()=>{
 const future=bars.map((b,i)=>i===2399?{...b,t:new Date(now-FIVE_MIN_MS/2).toISOString()}:b);
 assert.throws(()=>validateFiveMinuteSnapshot(snapshot(future),now),/missing|unfinished/);
 assert.throws(()=>validateFiveMinuteSnapshot(snapshot(bars.slice(1)),now),/five-minute/);
});
test('crypto Alpaca GET pages retained verbatim, no order endpoints or credential leak',async()=>{
 const seen=[];
 const fetchImpl=async(url,options)=>{
  seen.push({url,method:options.method,headers:options.headers});
  const q=new URL(url).searchParams;
  assert.equal(q.get('timeframe'),'5Min');
  assert.equal(options.method,'GET');
  assert.ok(url.includes('/crypto/us-1/bars'));
  const page=seen.length===1?bars.slice(0,1500):bars.slice(1500);
  return {ok:true,json:async()=>({bars:{'BTC/USD':page},
    next_page_token:seen.length===1?'second':null})};
 };
 const result=await fetchFiveMinuteSnapshot({symbol:'BTC/USD',now,key:'KEY',secret:'SECRET',fetchImpl});
 assert.equal(result.bars.length,2400);
 assert.equal(result.bars[0].t,bars[0].t);
 assert.equal(result.timeframe,'5Min');
 assert.equal(seen.length,2);
 assert.ok(PAIRS.includes('BTC/USD'));
});
test('an incomplete or repeating cursor fails instead of publishing truncated evidence',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({bars:{'BTC/USD':bars.slice(0,2)},next_page_token:'loop'})});
 await assert.rejects(fetchFiveMinuteSnapshot({symbol:'BTC/USD',now,key:'K',secret:'S',fetchImpl}),/repeated pagination/);
});
