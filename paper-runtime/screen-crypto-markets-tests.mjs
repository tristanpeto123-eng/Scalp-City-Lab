import assert from 'node:assert/strict';
import {CRYPTO_RESEARCH_ONLY,isResearchCrypto} from './crypto-research-marketset.mjs';
import {quality,runScreener} from './screen-crypto-markets.mjs';
import {AlpacaPaper} from './alpaca-paper.mjs';
import {TRIAL_RULES} from './trial-profit.mjs';
let n=0;
assert.equal(CRYPTO_RESEARCH_ONLY.length,8);n++;
assert.equal(new Set(CRYPTO_RESEARCH_ONLY).size,8);n++;
assert.ok(CRYPTO_RESEARCH_ONLY.every(s=>s.endsWith('/USD')));n++;
for(const name of ['SOL/USD','XRP/USD','ADA/USD','AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD']){
 assert.ok(isResearchCrypto(name));n++;
}
assert.equal(isResearchCrypto('BTC/USD'),true);n++;
assert.equal(isResearchCrypto('DOGE/EUR'),false);n++;
assert.equal(TRIAL_RULES.startingBalanceGbp,50);n++;
assert.equal(TRIAL_RULES.targetNetProfitGbp,2000);n++;
assert.equal(quality(new Array(480).fill({v:1})).ok,true);n++;
assert.equal(quality(new Array(480).fill({v:0})).ok,false);n++;
assert.equal(quality([]).reason,'INSUFFICIENT_CANDLES');n++;
const start=Date.parse('2026-08-01T00:00:00Z');let price=100;
const bars=Array.from({length:1300},(_,i)=>{
 const o=price,c=100+10*Math.sin(i/5)+2*Math.cos(i/25);price=c;
 return {t:new Date(start+i*900000).toISOString(),o,h:Math.max(o,c)*1.002,
   l:Math.min(o,c)*.998,c,v:100};
});
const now=start+(bars.length+4)*900000;
const calls=[];
const broker={req:async(base,url)=>{
 calls.push({base,url});
 if(url.includes('/v2/assets'))return [
 {symbol:'SOL/USD',tradable:true,status:'active'},
 {symbol:'XRP/USD',tradable:false,status:'active'},
 {symbol:'LINK/USD',tradable:true,status:'active'}];
 if(url.includes('/crypto/us/bars')){
   const symbol=new URL('https://data.alpaca.markets'+url).searchParams.get('symbols');
   if(symbol==='SOL/USD')return {bars:{[symbol]:bars},next_page_token:null};
   if(symbol==='LINK/USD')return {bars:{[symbol]:bars.map(b=>({...b,v:0}))},next_page_token:null};
 }
 throw Error('Unexpected mock GET');
}};
const report=await runScreener({broker,markets:['SOL/USD','XRP/USD','LINK/USD'],days:30,now});
assert.equal(report.marketsChecked,3);n++;
assert.equal(report.brokerOrdersSubmitted,0);n++;
assert.equal(report.targets.observedWinRateTargetPct,80);n++;
assert.equal(report.targets.profitGoalGbp,2000);n++;
assert.equal(report.results[0].symbol,'SOL/USD');n++;
assert.ok(['STRATEGY_REJECTED','FROZEN_REPLAY_EVALUATED'].includes(report.results[0].status));n++;
assert.equal(report.results[0].researchOnly,true);n++;
assert.equal(report.results[0].completedBars,1300);n++;
assert.equal(report.results[0].calibrationBars,520);n++;
assert.equal(report.results[0].frozenReplay.actualLiveForwardTradeCount,0);n++;
assert.equal(report.results[1].status,'NO_ACTIVE_TRADABLE_PAPER_ASSET');n++;
assert.equal(report.results[2].status,'DATA_QUALITY_REJECTED');n++;
assert.equal(report.results[2].data.zeroVolumePct,100);n++;
assert.ok(calls.every(x=>x.base==='https://paper-api.alpaca.markets'||x.base==='https://data.alpaca.markets'));n++;
assert.ok(calls.every(x=>x.url.startsWith('/v2/assets?')||x.url.startsWith('/v1beta3/crypto/us/bars?')));n++;
await assert.rejects(runScreener({broker,markets:['BTC/USD']}),/research-only/);n++;
await assert.rejects(runScreener({broker,markets:['SOL/USD','SOL/USD']}),/research-only/);n++;
const adapter=new AlpacaPaper({key:'dummy',secret:'dummy',fetchImpl:async()=>{throw Error('HTTP called despite blocked asset')}});
assert.throws(()=>adapter.paperOrder({
 symbol:'SOL/USD',side:'buy',type:'market',time_in_force:'ioc',
 client_order_id:'sc010rc3-SOLUSD-aaaaaaaaaaaaaaaaaaaaaaaa',notional:'10.00'}),/Rejected/);n++;
assert.throws(()=>adapter.paperOrder({
 symbol:'DOGE/USD',side:'buy',type:'market',time_in_force:'ioc',
 client_order_id:'sc010rc3-DOGEUSD-aaaaaaaaaaaaaaaaaaaaaaaa',notional:'10.00'}),/Rejected/);n++;
const alternateCalls=[];
const altBroker={req:async(base,url)=>{
 alternateCalls.push({base,url});
 if(url.includes('/v2/assets'))return [{symbol:'SOL/USD',tradable:true,status:'active'}];
 if(url.includes('/v1beta3/crypto/us-1/bars?'))return {bars:{'SOL/USD':bars},next_page_token:null};
 throw Error('Unexpected historical feed URL');
}};
const altReport=await runScreener({broker:altBroker,markets:['SOL/USD'],location:'us-1',days:30,now});
assert.equal(altReport.dataLocation,'us-1');n++;
assert.equal(altReport.marketsChecked,1);n++;
assert.equal(altReport.brokerOrdersSubmitted,0);n++;
assert.ok(alternateCalls.some(x=>x.url.startsWith('/v1beta3/crypto/us-1/bars?')));n++;
await assert.rejects(runScreener({broker:altBroker,markets:['SOL/USD'],location:'eu-1'}),/Unsupported historical data feed/);n++;
console.log('PASS '+n+' historical multi-crypto research screens and unchanged broker-order permissions');
