// ONE-TIME READ-ONLY sample packaging for Strategy Validation.
// Uses read-only Alpaca Kraken US 15m candles; NO broker account/order methods.
// Output is immutable archived public OHLCV sample, not a live feed.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const symbols=['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD'];
const key=process.env.ALPACA_PAPER_KEY,secret=process.env.ALPACA_PAPER_SECRET;
if(!key||!secret)throw Error('Authenticated historical-data GET requires configured paper read credentials');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','validation-data');
const timeframe=900000,days=60,now=Date.now(),cutoff=now-30000;
const end=Math.floor(cutoff/timeframe)*timeframe;
const start=end-days*86400000;
const headers={'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json'};
await mkdir(root,{recursive:true});
for(const symbol of symbols){
 const url=new URL('https://data.alpaca.markets/v1beta3/crypto/us-1/bars');
 url.searchParams.set('symbols',symbol);url.searchParams.set('timeframe','15Min');
 url.searchParams.set('start',new Date(start).toISOString());
 url.searchParams.set('end',new Date(end).toISOString());
 url.searchParams.set('limit','10000');url.searchParams.set('sort','asc');
 const rows=[],pageTokens=new Set();
 let finished=false;
 for(let i=0;i<80;i++){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  let response;
  try{response=await fetch(url,{method:'GET',headers,signal:controller.signal})}
  finally{clearTimeout(timer)}
  if(!response.ok)throw Error(symbol+' historical GET returned '+response.status);
  const result=await response.json();
  if(!Array.isArray(result.bars?.[symbol]))throw Error(symbol+' missing historical bar array');
  rows.push(...result.bars[symbol]);
  if(!result.next_page_token){finished=true;break}
  if(pageTokens.has(result.next_page_token))throw Error('Repeated page token for '+symbol);
  pageTokens.add(result.next_page_token);
  url.searchParams.set('page_token',result.next_page_token);
 }
 if(!finished)throw Error(symbol+' dataset truncated at 80 pages');
 const bars=rows.filter(b=>Date.parse(b.t)+timeframe<=end).map(b=>({
  t:b.t,o:Number(b.o),h:Number(b.h),l:Number(b.l),c:Number(b.c),v:Number(b.v)
 }));
 if(bars.length<3500||bars.length>7000)throw Error(symbol+' insufficient expected 60d bar history: '+bars.length);
 let zero=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i],t=Date.parse(b.t);
  if(!Number.isFinite(t)||[b.o,b.h,b.l,b.c,b.v].some(x=>!Number.isFinite(x))||
     b.v<0||Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.c,b.l)||
     b.l>Math.min(b.o,b.c,b.h)||(i&&t-Date.parse(bars[i-1].t)!==timeframe))
     throw Error(symbol+' bad OHLCV or missing candle at '+i);
  if(b.v===0)zero++;
 }
 if(zero/bars.length>.4)throw Error(symbol+' too many zero-volume candles');
 const record={symbol,timeframe:'15Min',source:'ALPACA_KRAKEN_US_US-1',
  generatedAt:new Date(now).toISOString(),trading:false,calendarDays:days,bars};
 await writeFile(path.join(root,symbol.replace('/','-')+'.json'),JSON.stringify(record)+'\n');
 console.log('SNAPSHOT_OK',symbol,'candles',bars.length,'zero%',(100*zero/bars.length).toFixed(2));
}
console.log('ALL_TEN_MARKETS_SNAPSHOTS_READY');
