// Read-only Alpaca historical candles -> public static snapshots for the
// browser validator. Runs server-side inside GitHub Actions, never in a page.
// Never logs or exports secrets, account data or broker orders.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';
const key=process.env.ALPACA_PAPER_KEY;
const secret=process.env.ALPACA_PAPER_SECRET;
if(!key||!secret)throw Error('Alpaca PAPER market data secrets unavailable');
const feed='us-1',days=Number(process.env.SCALP_SNAPSHOT_DAYS||60);
if(!Number.isInteger(days)||days<8||days>90)throw Error('Snapshot history days must be 8–90');
const now=Date.now();
const BAR_MS=900_000;
const start=new Date(now-days*86400_000).toISOString();
const end=new Date(now-30_000).toISOString();
const base='https://data.alpaca.markets/v1beta3/crypto/'+feed+'/bars';
const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../validation-data');
const headers={'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,'Accept':'application/json'};
async function request(url){
 for(let attempt=1;attempt<=4;attempt++){
  const response=await fetch(url,{method:'GET',headers,signal:AbortSignal.timeout(20_000)});
  if(response.ok)return response.json();
  if((response.status===429||response.status>=500)&&attempt<4){
   await new Promise(r=>setTimeout(r,400*attempt*attempt));continue;
  }
  throw Error('Alpaca historical GET HTTP '+response.status);
 }
}
async function fetchPair(symbol){
 const query=new URLSearchParams({
  symbols:symbol,timeframe:'15Min',start,end,limit:'10000',sort:'asc'
 });
 const seen=new Set(),bars=[];
 for(let page=0;page<80;page++){
  const response=await request(base+'?'+query.toString());
  const chunk=response?.bars?.[symbol];
  if(!Array.isArray(chunk))throw Error('Missing bars for '+symbol);
  bars.push(...chunk);
  if(!response.next_page_token)break;
  if(seen.has(response.next_page_token))throw Error('Repeated paging token for '+symbol);
  seen.add(response.next_page_token);
  query.set('page_token',response.next_page_token);
  if(page===79)throw Error('Incomplete Alpaca pagination for '+symbol);
 }
 const clipped=bars.filter(b=>Number.isFinite(Date.parse(b.t))&&Date.parse(b.t)+BAR_MS<=now-30_000);
 const payload={
  symbol,source:'ALPACA_KRAKEN_US_US-1',
  feed,timeframe:'15Min',generatedAt:new Date(now).toISOString(),trading:false,calendarDays:days,
  bars:clipped.map(b=>({t:b.t,o:Number(b.o),h:Number(b.h),
    l:Number(b.l),c:Number(b.c),v:Number(b.v)}))
 };
 const inspected=checkSnapshot(payload,symbol,now);
 return {payload,inspected};
}
// All pairs must pass quality checks BEFORE replacing any published file.
const prepared=[];
for(const symbol of PAIRS){
 const item=await fetchPair(symbol);
 prepared.push({symbol,...item});
 console.log('VERIFIED ALPACA SNAPSHOT',symbol,item.inspected.bars.length,
  item.inspected.sampleStart,item.inspected.sampleEnd);
}
await fs.mkdir(folder,{recursive:true});
for(const {symbol,payload} of prepared){
 await fs.writeFile(path.join(folder,symbol.replace('/','-')+'.json'),
   JSON.stringify(payload)+'\n','utf8');
}
await fs.writeFile(path.join(folder,'index.json'),JSON.stringify({
 source:'ALPACA_KRAKEN_US_US-1',feed,timeframe:'15Min',
 generatedAt:new Date(now).toISOString(),markets:prepared.map(({symbol,inspected})=>({
  symbol,candles:inspected.bars.length,from:inspected.sampleStart,
  through:inspected.sampleEnd,
  zeroVolumePct:Number((inspected.zeroVolumeFraction*100).toFixed(2))
 }))},null,2)+'\n');
console.log('ALPACA HISTORICAL SNAPSHOTS SAVED',prepared.length,'read-only markets; no orders');
