import assert from 'node:assert/strict';
import {loadSLOnlineFiveMinute,slOnlineInstrument} from './sl-online-5m.mjs';
const now=Date.parse('2026-10-24T12:00:00Z');
const start=Date.parse('2026-10-20T00:00:00Z');
const values=Array.from({length:300},(_,i)=>{
 const t=new Date(start+i*300000).toISOString().replace('T',' ').replace('.000Z','');
 const open=4100+i*.02;
 return {datetime:t,open:String(open),high:String(open+.5),
  low:String(open-.5),close:String(open+.15)};
}).reverse();
function mkBody(symbol='XAU/USD',valuesIn=values,interval='5min'){
 return {status:'ok',meta:{symbol,interval},values:valuesIn};
}
function responder(body, status=200, capture=()=>{}){
 return async(url,opts)=>{
  capture(url,opts);
  return {ok:status>=200&&status<300,status,json:async()=>body};
 };
}
for(const [market,symbol,provider] of [
 ['COMMODITIES','XAUUSD','XAU/USD'],['COMMODITIES','XAGUSD','XAG/USD'],
 ['FOREX','EURUSD','EUR/USD'],['FOREX','GBPUSD','GBP/USD'],
 ['FOREX','USDJPY','USD/JPY'],['INDICES','SPX','SPX'],['INDICES','NDX','NDX']
]){
 assert.equal(slOnlineInstrument(market,symbol).providerSymbol,provider);
}
assert.throws(()=>slOnlineInstrument('INDICES','US100'),/not configured/);
assert.throws(()=>slOnlineInstrument('CRYPTO','BTCUSD'),/not configured/);
let url,req;
const data=await loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'TEST-SECRET-NOT-FOR-SOURCE',
 now,fetchImpl:responder(mkBody(),200,(u,r)=>{url=u;req=r;})});
assert.equal(data.bars.length,300);
assert.equal(data.bars[0].t,'2026-10-20T00:00:00.000Z');
assert.equal(data.bars.at(-1).t,'2026-10-21T00:55:00.000Z');
assert.equal(data.source,'TWELVEDATA_PROVIDER_REPORTED_UNVERIFIED');
assert.equal(data.providerSymbol,'XAU/USD');
assert.equal(data.market,'COMMODITIES');
assert.ok(url.startsWith('https://api.twelvedata.com/time_series?'));
assert.equal(new URL(url).searchParams.get('interval'),'5min');
assert.equal(new URL(url).searchParams.get('timezone'),'UTC');
assert.ok(!url.includes('TEST-SECRET-NOT-FOR-SOURCE'),'key never enters URL');
assert.equal(req.headers.Authorization,'apikey TEST-SECRET-NOT-FOR-SOURCE');
assert.equal(req.credentials,'omit');
assert.equal(req.method,'GET');
assert.equal(req.redirect,'error');
assert.equal(req.cache,'no-store');
assert.equal(req.mode,'cors');
const other=await loadSLOnlineFiveMinute({market:'FOREX',symbol:'EURUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('EUR/USD'))});
assert.equal(other.market,'FOREX');
const future=values.slice();
future.unshift({datetime:'2026-10-24 11:55:00',open:'4150',high:'4151',low:'4149',close:'4150'});
const filtered=await loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('XAU/USD',future))});
assert.equal(filtered.bars.length,300,'the unclosed 11:55 UTC candle must not enter history at 12:00');
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('BTC/USD'))}),/identity/);
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('XAU/USD',values,'15min'))}),/identity/);
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder({status:'error',code:402,message:'plan required'},402)}),/subscription/);
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder({status:'error',code:429},429)}),/rate limit/);
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:async()=>{throw Error('request failed')}}),/network\/CORS/);
const bad=values.map(x=>({...x}));bad[10].high='-2';
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('XAU/USD',bad))}),/invalid candle/);
const repeat=values.map(x=>({...x}));repeat[10].datetime=repeat[11].datetime;
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('XAU/USD',repeat))}),/unordered, duplicated/);
const old=values.map(x=>({...x,datetime:'2024-10-20 '+x.datetime.slice(11)}));
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'unit-test',now,
 fetchImpl:responder(mkBody('XAU/USD',old))}),/unordered, duplicated|stale/);
await assert.rejects(loadSLOnlineFiveMinute({market:'COMMODITIES',symbol:'XAUUSD',apiKey:'',now,
 fetchImpl:responder(mkBody())}),/API key/);
console.log('SL ONLINE 5M PASS: market identity, provider API auth header, UTC, incomplete candle gate, schema, costs of plan, malformed/duplicate/stale data, no broker orders');