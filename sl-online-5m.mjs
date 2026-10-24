/**
 * SL read-only on-demand 5m data adapter.
 * The user's API key exists only in the page's password field and request header.
 * No stored key, no broker credentials, no server-side credentials and no orders.
 */
import {validateSLFiveMinuteBars,SL_FIVE_MIN_MS} from './sl-5m.mjs';

export const SL_ONLINE_FEED_VERSION='SL_TWELVEDATA_5MIN_V1';
const INSTRUMENTS=Object.freeze({
 COMMODITIES:Object.freeze({XAUUSD:'XAU/USD',XAGUSD:'XAG/USD'}),
 FOREX:Object.freeze({EURUSD:'EUR/USD',GBPUSD:'GBP/USD',USDJPY:'USD/JPY'}),
 INDICES:Object.freeze({SPX:'SPX',NDX:'NDX'})
});
const normal=s=>String(s||'').replace(/[^A-Z0-9]/gi,'').toUpperCase();
export function slOnlineInstrument(market,symbol){
 const list=INSTRUMENTS[market];
 const candidate=normal(symbol);
 if(!list||!Object.hasOwn(list,candidate))
  throw Error('This market/symbol is not configured for online 5m data. Use XAUUSD, XAGUSD, EURUSD, GBPUSD, USDJPY, SPX or NDX, or import a CSV.');
 return Object.freeze({market,symbol:candidate,providerSymbol:list[candidate]});
}
function parseUtcDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?(?:Z)?$/.test(value))
  throw Error('Provider returned a candle with a non-UTC timestamp');
 const raw=value.replace(' ','T');
 const iso=raw.endsWith('Z')?raw:raw+'Z';
 const time=Date.parse(iso);
 if(!Number.isFinite(time))throw Error('Provider returned invalid candle timestamp');
 return new Date(time).toISOString();
}
function cleanProviderError(body,status){
 const code=Number(body?.code)||status;
 if(code===429)return 'Provider rate limit reached. Try later or check your Twelve Data plan.';
 if(code===401||code===403)return 'Twelve Data rejected the API key or access level.';
 if(code===402)return 'Twelve Data subscription does not include this instrument/timeframe.';
 if(code===404)return 'Twelve Data could not find the requested market symbol.';
 return 'Twelve Data rejected the request. Check instrument entitlement and credentials (HTTP '+status+').';
}
export async function loadSLOnlineFiveMinute({
 market,symbol,apiKey,fetchImpl=fetch,now=Date.now(),outputsize=5000
}={}){
 const instrument=slOnlineInstrument(market,symbol);
 if(typeof apiKey!=='string'||apiKey.trim().length<4||apiKey.trim().length>256)
  throw Error('Enter your own Twelve Data API key to fetch online history.');
 if(!Number.isInteger(outputsize)||outputsize<150||outputsize>5000)
  throw Error('Online 5m outputsize must be 150–5000');
 if(!Number.isFinite(now))throw Error('Invalid current time');
 const q=new URLSearchParams({
  symbol:instrument.providerSymbol,interval:'5min',outputsize:String(outputsize),
  timezone:'UTC',order:'desc',format:'JSON'
 });
 const url='https://api.twelvedata.com/time_series?'+q;
 let response;
 try{
  response=await fetchImpl(url,{
   method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
   redirect:'error',
   headers:{Authorization:'apikey '+apiKey.trim(),Accept:'application/json'},
   signal:AbortSignal.timeout(25000)
  });
 }catch(err){
  throw Error('Could not reach Twelve Data over HTTPS (network/CORS/timeout). No substitute or synthetic market data was used.');
 }
 if(!response||typeof response.ok!=='boolean'||typeof response.json!=='function')
  throw Error('Provider returned an invalid HTTP response');
 let body;
 try{body=await response.json()}catch{throw Error('Provider response is not valid JSON market data')}
 if(!response.ok||body?.status==='error'||body?.code)
  throw Error(cleanProviderError(body,response.status));
 if(body?.status!=='ok'||body.meta?.interval!=='5min'||
    normal(body.meta?.symbol)!==normal(instrument.providerSymbol)||
    !Array.isArray(body.values))
  throw Error('Provider identity, timeframe or price-series schema does not match the requested chart');
 if(body.values.length<150||body.values.length>outputsize)
  throw Error('Provider returned insufficient or oversized candle history');
 const bars=body.values.map(x=>({
  t:parseUtcDate(x?.datetime),
  o:Number(x?.open),h:Number(x?.high),l:Number(x?.low),c:Number(x?.close),
  v:x?.volume===undefined||x.volume===null||x.volume===''?null:Number(x.volume)
 })).filter(x=>Date.parse(x.t)+SL_FIVE_MIN_MS<=now-30000)
   .sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
 const checked=validateSLFiveMinuteBars(bars,{now});
 const lastMs=Date.parse(checked.bars.at(-1).t);
 if(now-(lastMs+SL_FIVE_MIN_MS)>10*86400000)
  throw Error('Provider history is stale by more than 10 calendar days; refusing to train on outdated data.');
 return Object.freeze({
  schema:SL_ONLINE_FEED_VERSION,
  source:'TWELVEDATA_PROVIDER_REPORTED_UNVERIFIED',
  market:instrument.market,symbol:instrument.symbol,
  providerSymbol:instrument.providerSymbol,timeframe:'5Min',
  downloadedAt:new Date(now).toISOString(),firstBar:checked.bars[0].t,
  lastBar:checked.bars.at(-1).t,
  gaps:checked.gaps,missingVolume:checked.missingVolume,
  bars:checked.bars,
  warning:'Twelve Data provider-reported history, not independently authenticated or brokerage executions. Some symbols require paid subscription. No broker orders.'
 });
}
