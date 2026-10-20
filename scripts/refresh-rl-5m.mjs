// Dedicated READ-ONLY authentic 5-minute Alpaca/Kraken crypto candle feed.
// Isolated from legacy 15-minute strategy-validation history. No broker orders.
import {writeFile,readFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PAIRS} from '../strategy-validation-core.mjs';

const API='https://data.alpaca.markets/v1beta3/crypto/us-1/bars';
export const FIVE_MIN_MS=300000;
export const WINDOW_DAYS=30;
const MIN_BARS=2400,MAX_BARS=12000,MAX_PAGES=24;
const SOURCE='ALPACA_KRAKEN_US_US-1';
export function validateFiveMinuteSnapshot(data,now=Date.now()){
 if(!data||!PAIRS.includes(data.symbol)||data.timeframe!=='5Min'||
    data.source!==SOURCE||data.trading!==false||
    !Array.isArray(data.bars)||data.bars.length<MIN_BARS||data.bars.length>MAX_BARS)
   throw Error('5MIN_FEED: absent/invalid native five-minute market history');
 let previous=null,zeros=0;
 for(const [i,b] of data.bars.entries()){
  const t=Date.parse(b.t),nums=['o','h','l','c','v'].map(k=>Number(b[k]));
  const [o,h,l,c,v]=nums;
  if(!Number.isFinite(t)||!nums.every(Number.isFinite)||Math.min(o,h,l,c)<=0||
     h<Math.max(o,c,l)||l>Math.min(o,c,h)||v<0||
     (previous!==null&&t-previous!==FIVE_MIN_MS))
   throw Error('5MIN_FEED: missing, fabricated or invalid market candle #'+i);
  previous=t;if(v===0)zeros++;
 }
 if(previous+FIVE_MIN_MS>now-30000)throw Error('5MIN_FEED: unfinished or future candle');
 if(zeros/data.bars.length>.4)throw Error('5MIN_FEED: insufficient volume coverage');
 if(!Number.isFinite(Date.parse(data.generatedAt)))throw Error('5MIN_FEED: missing fetch provenance time');
 return data;
}
export async function fetchFiveMinuteSnapshot({
 symbol,key,secret,now=Date.now(),fetchImpl=fetch,days=WINDOW_DAYS
}={}){
 if(!PAIRS.includes(symbol)||!key||!secret)throw Error('5MIN_FEED: unknown symbol or missing read-only credentials');
 if(!Number.isInteger(days)||days<14||days>40||!Number.isFinite(now))
   throw Error('5MIN_FEED: invalid history window');
 const q=new URLSearchParams({
  symbols:symbol,timeframe:'5Min',
  start:new Date(now-days*86400_000).toISOString(),
  end:new Date(now-30000).toISOString(),
  limit:'10000',sort:'asc'
 });
 const headers={'APCA-API-KEY-ID':key,'APCA-API-SECRET-KEY':secret,Accept:'application/json'};
 let completed=false;const seen=new Set(),bars=[];
 for(let page=0;page<MAX_PAGES;page++){
  const r=await fetchImpl(API+'?'+q.toString(),{
   method:'GET',headers,signal:AbortSignal.timeout(20000),redirect:'error',cache:'no-store'
  });
  if(!r.ok)throw Error('5MIN_FEED: provider HTTP '+r.status+' for '+symbol);
  const body=await r.json();
  const batch=body?.bars?.[symbol];
  if(!Array.isArray(batch)||bars.length+batch.length>MAX_BARS)
   throw Error('5MIN_FEED: missing/unbounded provider bars');
  bars.push(...batch);
  const token=body.next_page_token;
  if(!token){completed=true;break;}
  if(typeof token!=='string'||seen.has(token))
   throw Error('5MIN_FEED: repeated pagination token');
  seen.add(token);q.set('page_token',token);
 }
 if(!completed)throw Error('5MIN_FEED: unresolved provider pagination');
 const ready=bars.filter(b=>Number.isFinite(Date.parse(b?.t))&&
   Date.parse(b.t)+FIVE_MIN_MS<=now-30000);
 const result={symbol,timeframe:'5Min',source:SOURCE,feed:'us-1',
  generatedAt:new Date(now).toISOString(),trading:false,calendarDays:days,bars:ready};
 return validateFiveMinuteSnapshot(result,now);
}
// Count only genuinely NEW, completed, source-recorded tail candles.
// A baseline import or repeating an old window is not training progress.
export function compareFiveMinuteSourceTail(previous,current){
 if(!current||!Array.isArray(current.bars)||!current.bars.length)
  throw Error('5MIN_PROGRESS: current source bars missing');
 const last=current.bars.at(-1),lastMs=Date.parse(last.t);
 if(!previous)return {state:'BASELINE_CAPTURE_NO_NEW_LEARNING',newTailCandles:0,
  previousEnd:null,currentEnd:last.t,overlap:0};
 if(previous.symbol!==current.symbol||previous.timeframe!=='5Min'||
    previous.source!==current.source||!Array.isArray(previous.bars)||
    !previous.bars.length)throw Error('5MIN_PROGRESS: incompatible previous source');
 const oldEnd=Date.parse(previous.bars.at(-1).t);
 if(!Number.isFinite(oldEnd)||lastMs<oldEnd)
  throw Error('5MIN_PROGRESS: source window moved backwards');
 const overlapMap=new Map(previous.bars.map(b=>[Date.parse(b.t),b]));
 let overlaps=0;
 for(const b of current.bars){
  const ms=Date.parse(b.t),old=overlapMap.get(ms);
  if(!old)continue;
  overlaps++;
  if(['o','h','l','c','v'].some(k=>Number(b[k])!==Number(old[k])))
   throw Error('5MIN_PROGRESS: previously observed candle changed; cannot silently claim new learning');
 }
 if(!overlaps||!current.bars.some(b=>Date.parse(b.t)===oldEnd))
  throw Error('5MIN_PROGRESS: previous source tail absent; history continuity unverified');
 const tails=current.bars.filter(b=>Date.parse(b.t)>oldEnd);
 if(tails.some((b,i)=>Date.parse(b.t)!==oldEnd+(i+1)*FIVE_MIN_MS))
  throw Error('5MIN_PROGRESS: missing new completed tail candles');
 return {state:tails.length?'VERIFIED_NEW_SOURCE_TAIL':'UNCHANGED_SOURCE_NO_NEW_LEARNING',
  newTailCandles:tails.length,previousEnd:previous.bars.at(-1).t,
  currentEnd:last.t,overlap:overlaps};
}
export async function refreshFiveMinuteHistory({
 key,secret,now=Date.now(),fetchImpl=fetch,outputDir='rl-5m-data/snapshots',symbols=PAIRS
}={}){
 if(!Array.isArray(symbols)||!symbols.length||new Set(symbols).size!==symbols.length||
    symbols.some(s=>!PAIRS.includes(s)))throw Error('Invalid 5m research pair list');
 const snapshots=[],sourceProgress=[];
 for(const symbol of symbols){
  const x=await fetchFiveMinuteSnapshot({symbol,key,secret,now,fetchImpl});
  const existingPath=path.join(outputDir,symbol.replace('/','-')+'.json');
  let prior=null;
  try{prior=JSON.parse(await readFile(existingPath,'utf8'))}
  catch(e){if(e.code!=='ENOENT')throw Error('5MIN_PROGRESS: cannot parse previous source '+symbol)}
  const progress=compareFiveMinuteSourceTail(prior,x);
  snapshots.push(x);sourceProgress.push({symbol,...progress});
 }
 // Validate ALL charts and their prior immutable overlap before publishing ANY.
 await mkdir(outputDir,{recursive:true});
 for(const x of snapshots){
  const file=path.join(outputDir,x.symbol.replace('/','-')+'.json');
  const temporary=file+'.tmp';
  await writeFile(temporary,JSON.stringify(x)+'\n');
  await rename(temporary,file);
 }
 const report={schema:'SCALP_VERIFIED_SOURCE_TAIL_V1',
  generatedAt:new Date(now).toISOString(),timeframe:'5Min',
  symbols:sourceProgress,brokerOrders:0,liveOrders:0,
  newSourceTailCandles:sourceProgress.reduce((n,x)=>n+x.newTailCandles,0),
  caution:'New source bars alone are not proof of training consumption or predictive improvement'};
 const reportPath=path.join(path.dirname(outputDir),'source-progress','latest.json');
 await mkdir(path.dirname(reportPath),{recursive:true});
 await writeFile(reportPath+'.tmp',JSON.stringify(report,null,2)+'\n');
 await rename(reportPath+'.tmp',reportPath);
 return {updated:snapshots.length,timeframe:'5Min',brokerOrders:0,
  requestMethods:['GET'],newSourceTailCandles:report.newSourceTailCandles,
  progressReport:reportPath};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 refreshFiveMinuteHistory({key:process.env.ALPACA_PAPER_KEY,
  secret:process.env.ALPACA_PAPER_SECRET})
 .then(x=>console.log('RL_5MIN_DATA_REFRESH '+JSON.stringify(x)))
 .catch(e=>{console.error('RL_5MIN_DATA_BLOCKED '+String(e.message));process.exitCode=1;});
}
