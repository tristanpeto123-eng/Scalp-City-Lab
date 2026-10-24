/**
 * SL local chart-history cache. Saves actual recorded 5m OHLCV candles
 * separately from good/bad training examples and neural model checkpoints.
 *
 * IndexedDB persists across normal same-origin page reloads; it is NOT
 * an off-device backup. Never store provider keys, private PATs or secrets.
 */
import {validateSLFiveMinuteBars} from './sl-5m.mjs?slboot=20261024r3';
import {SL_ACTIVE_MARKETS} from './sl-core.mjs?slboot=20261024r3';

export const SL_CHART_CACHE_SCHEMA='SL_LOCAL_5M_CHART_V1';
const DATABASE='scalp-city-sl-chart-history';
const TABLE='five-minute-bars';
const SYMBOL=/^[A-Z0-9._/-]{2,24}$/;
const SOURCES=['USER_IMPORTED_UNVERIFIED_5MIN','TWELVEDATA_PROVIDER_REPORTED_UNVERIFIED'];
const makeKey=(market,symbol)=>{
 if(!SL_ACTIVE_MARKETS.includes(market)||typeof symbol!=='string'||!SYMBOL.test(symbol))
  throw Error('Chart cache market and symbol must match active SL student');
 return market+':'+symbol;
};
export function prepareSLChartCache({market,symbol,bars,source,providerSymbol=null,now=Date.now()}={}){
 const id=makeKey(market,symbol);
 if(!SOURCES.includes(source))throw Error('Chart cache source must be explicit, never synthetic');
 if(providerSymbol!==null&&(typeof providerSymbol!=='string'||providerSymbol.length>60))
  throw Error('Invalid market provider symbol');
 const checked=validateSLFiveMinuteBars(bars,{now});
 return {schema:SL_CHART_CACHE_SCHEMA,id,market,symbol,source,
  providerSymbol,cachedAt:new Date(now).toISOString(),count:checked.bars.length,
  firstBar:checked.bars[0].t,lastBar:checked.bars.at(-1).t,bars:checked.bars};
}
export function verifySLChartCache(record,{market=record?.market,symbol=record?.symbol,now=Date.now()}={}){
 if(!record||record.schema!==SL_CHART_CACHE_SCHEMA||
  record.id!==makeKey(market,symbol)||record.market!==market||record.symbol!==symbol||
  !SOURCES.includes(record.source)||typeof record.cachedAt!=='string'||
  !Number.isFinite(Date.parse(record.cachedAt)))
  throw Error('Saved SL candles belong to another market/symbol or use an invalid schema');
 // Prohibit extra untrusted fields (e.g. any API key or token).
 const keys=Object.keys(record);
 const allowed=new Set(['schema','id','market','symbol','source','providerSymbol','cachedAt','count','firstBar','lastBar','bars']);
 if(keys.some(k=>!allowed.has(k)))throw Error('Saved SL chart record includes an unsupported field');
 const checked=validateSLFiveMinuteBars(record.bars,{now});
 if(record.count!==checked.bars.length||record.firstBar!==checked.bars[0].t||
    record.lastBar!==checked.bars.at(-1).t)
  throw Error('Saved SL chart record metadata disagrees with its recorded candles');
 return {...record,bars:checked.bars};
}
function openDB(factory){
 if(!factory)throw Error('IndexedDB unavailable: candles cannot persist in this browser');
 return new Promise((resolve,reject)=>{
  const req=factory.open(DATABASE,1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(TABLE))db.createObjectStore(TABLE,{keyPath:'id'});
  };
  req.onerror=()=>reject(Error('IndexedDB open failed: '+(req.error?.message||'unknown error')));
  req.onsuccess=()=>resolve(req.result);
 });
}
function operation(db,mode,method,value){
 return new Promise((resolve,reject)=>{
  let result=null,done=false;
  const transaction=db.transaction(TABLE,mode),store=transaction.objectStore(TABLE);
  const request=method==='get'?store.get(value):store.put(value);
  request.onsuccess=()=>{result=request.result};
  request.onerror=()=>{if(!done){done=true;reject(Error('Chart-cache '+method+' failed'))}};
  transaction.oncomplete=()=>{if(!done){done=true;resolve(result)}};
  transaction.onerror=()=>{if(!done){done=true;reject(Error('Chart-cache transaction failed: '+(transaction.error?.message||'unknown')))}};
  transaction.onabort=()=>{if(!done){done=true;reject(Error('Chart-cache write was aborted'))}};
 });
}
export async function loadSLChartCache({market,symbol,factory=globalThis.indexedDB,now=Date.now()}={}){
 const id=makeKey(market,symbol);
 const db=await openDB(factory);
 try{
  const found=await operation(db,'readonly','get',id);
  return found?verifySLChartCache(found,{market,symbol,now}):null;
 }finally{db.close()}
}
export async function saveSLChartCache({market,symbol,bars,source,providerSymbol=null,
 factory=globalThis.indexedDB,now=Date.now()}={}){
 const record=prepareSLChartCache({market,symbol,bars,source,providerSymbol,now});
 const db=await openDB(factory);
 try{await operation(db,'readwrite','put',record)}
 finally{db.close()}
 const readBack=await loadSLChartCache({market,symbol,factory,now});
 if(!readBack||readBack.count!==record.count||
  readBack.firstBar!==record.firstBar||readBack.lastBar!==record.lastBar||
  readBack.source!==record.source)
  throw Error('SL 5m candle history failed the IndexedDB save/readback check');
 return readBack;
}
