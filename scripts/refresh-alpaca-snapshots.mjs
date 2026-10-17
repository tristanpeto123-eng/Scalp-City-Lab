// Refresh published historical snapshots from Alpaca's Kraken US crypto feed.
// Designed for GitHub Actions with server-side PAPER keys. GET ONLY.
// No browser credentials, orders, real trades, deposits or withdrawals.
import {writeFile,mkdir,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';

const API='https://data.alpaca.markets/v1beta3/crypto/us-1/bars';
const PERIOD=15*60*1000;
const TIMEOUT=20000;
const MAX_PAGES=80;
const MAX_BARS=20000;
const SOURCE='ALPACA_KRAKEN_US_US-1';
export const SNAPSHOT_DAYS=60;
export async function fetchSnapshot({
 symbol,key,secret,now=Date.now(),fetchImpl=fetch,days=SNAPSHOT_DAYS
}={}){
 if(!PAIRS.includes(symbol))throw Error('Unapproved pair');
 if(!key||!secret)throw Error('Missing server-side Alpaca PAPER data credentials');
 if(!Number.isInteger(days)||days<8||days>90)throw Error('Invalid historical window');
 if(!Number.isFinite(now))throw Error('Invalid snapshot time');
 const q=new URLSearchParams({
  symbols:symbol,timeframe:'15Min',
  start:new Date(now-days*86400_000).toISOString(),
  end:new Date(now-30000).toISOString(),
  limit:'10000',sort:'asc'
 });
 const headers={
  'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,
  Accept:'application/json'
 };
 const rows=[],tokens=new Set();
 let complete=false;
 for(let page=0;page<MAX_PAGES;page++){
  const response=await fetchImpl(API+'?'+q.toString(),{
   method:'GET',headers,signal:AbortSignal.timeout(TIMEOUT),
   redirect:'error',cache:'no-store'
  });
  if(!response.ok)throw Error('Alpaca history HTTP '+response.status+' for '+symbol);
  const payload=await response.json();
  if(!payload||!Array.isArray(payload.bars?.[symbol]))
   throw Error('Alpaca history omitted '+symbol+' on page '+(page+1));
  const batch=payload.bars[symbol];
  if(rows.length+batch.length>MAX_BARS)throw Error('History exceeds safe bar limit');
  rows.push(...batch);
  const next=payload.next_page_token;
  if(!next){complete=true;break;}
  if(typeof next!=='string'||tokens.has(next))
   throw Error('Invalid or repeated Alpaca page token');
  tokens.add(next);q.set('page_token',next);
 }
 if(!complete)throw Error('Alpaca historical pagination not exhausted');
 const bars=rows.filter(b=>Number.isFinite(Date.parse(b?.t))&&
  Date.parse(b.t)+PERIOD<=now-30000);
 const snapshot={
  symbol,timeframe:'15Min',source:SOURCE,feed:'us-1',
  generatedAt:new Date(now).toISOString(),
  trading:false,calendarDays:days,bars
 };
 const checked=checkSnapshot(snapshot,symbol,now);
 if(checked.bars.length<3000)
  throw Error('Too few completed contiguous bars to replace published history for '+symbol);
 // Entire period is rechecked; never silently truncate or synthesize missing bars.
 return snapshot;
}
export async function refreshAll({
 key,secret,now=Date.now(),fetchImpl=fetch,outputDir='validation-data'
}={}){
 // Fetch+validate everything before touching published files.
 const snapshots=[];
 for(const symbol of PAIRS){
  const data=await fetchSnapshot({symbol,key,secret,now,fetchImpl});
  snapshots.push(data);
  console.log('Validated '+symbol+': '+data.bars.length+
    ' completed candles, last '+data.bars.at(-1).t);
 }
 await mkdir(outputDir,{recursive:true});
 for(const s of snapshots){
  const file=path.join(outputDir,s.symbol.replace('/','-')+'.json');
  const tmp=file+'.tmp';
  await writeFile(tmp,JSON.stringify(s)+'\n',{mode:0o644});
  await rename(tmp,file);
 }
 return {updated:snapshots.length,generatedAt:new Date(now).toISOString(),
  pairs:snapshots.map(s=>s.symbol),requestMethods:['GET'],paperOrders:0};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href){
 refreshAll({key:process.env.ALPACA_PAPER_KEY,
  secret:process.env.ALPACA_PAPER_SECRET})
 .then(r=>console.log('Read-only historical snapshot refresh completed',JSON.stringify(r)))
 .catch(err=>{console.error('Snapshot refresh blocked:',String(err.message||err));process.exitCode=1});
}
