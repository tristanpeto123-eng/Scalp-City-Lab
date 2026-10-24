/**
 * SL 5-minute candle acquisition budget (per symbol, browser-session orchestration).
 * One request each hour retrieves MULTIPLE completed 5-minute bars. No API key,
 * market data or private strategy weights are stored by this policy.
 *
 * Twelve Data /time_series: 1 credit/symbol/request, max outputsize=5000.
 * Basic 8 screenshot: 8/min and 800/day. Our conservative per-symbol hourly
 * policy consumes no more than 24 credits per 24 hours per symbol.
 */
export const SL_SYNC_POLICY_V1='SL_HOURLY_BATCH_V1';
export const SL_HOURLY_MS=60*60*1000;
export const SL_FULL_BOOTSTRAP_BARS=5000;
export const SL_INCREMENTAL_BARS=180;
export const SL_EXPECTED_CREDITS_PER_CALL=1;
export const SL_PROVIDER_BASIC_DAILY_CREDITS=800;
export const SL_PROVIDER_BASIC_PER_MINUTE_CREDITS=8;
const validTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));
const allowedMarket=market=>['COMMODITIES','FOREX','INDICES'].includes(market);
export function slSyncKey(market,symbol){
 if(!allowedMarket(market)||typeof symbol!=='string'||!/^[A-Z0-9._/-]{2,24}$/.test(symbol))
  throw Error('SL hourly sync: invalid market or symbol');
 return 'scalp-city-lab:sl:5m-poll:v1:'+market+':'+symbol;
}
export function slReadSyncState(raw,market,symbol){
 if(!raw)return {schema:SL_SYNC_POLICY_V1,market,symbol,lastAttemptAt:null,lastSuccessAt:null,totalAttempts:0};
 let s;
 try{s=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw Error('Saved 5m provider budget state is corrupt; do not bypass rate limiter')}
 if(!s||s.schema!==SL_SYNC_POLICY_V1||s.market!==market||s.symbol!==symbol||
   !Number.isInteger(s.totalAttempts)||s.totalAttempts<0||
   (s.lastAttemptAt!==null&&!validTime(s.lastAttemptAt))||
   (s.lastSuccessAt!==null&&!validTime(s.lastSuccessAt)))
  throw Error('5m provider budget state invalid or from another market');
 return {...s};
}
export function planSLHourlySync({
 market,symbol,record=null,checkpoint=null,now=Date.now()
}={}){
 if(!Number.isFinite(now))throw Error('SL hourly sync: invalid now');
 slSyncKey(market,symbol);
 const s=slReadSyncState(record,market,symbol);
 let delayMs=0;
 if(s.lastAttemptAt!==null){
  const since=now-Date.parse(s.lastAttemptAt);
  if(since<0)throw Error('SL hourly sync: device clock moved backwards; do not bypass quota');
  delayMs=Math.max(0,SL_HOURLY_MS-since);
 }
 // Refresh with a small overlapping bar window after a recent successful
 // snapshot. If the browser was asleep or closed, obtain 5000 to catch up.
 const successAge=s.lastSuccessAt===null?Infinity:now-Date.parse(s.lastSuccessAt);
 if(successAge<0)throw Error('SL hourly sync: latest success is in the future');
 const hasCheckpoint=checkpoint?.schema==='SL_5MIN_CAUSAL_LOOP_V1'&&
  checkpoint.config?.market===market&&checkpoint.config?.symbol===symbol;
 const outputsize=hasCheckpoint&&successAge<8*SL_HOURLY_MS?
  SL_INCREMENTAL_BARS:SL_FULL_BOOTSTRAP_BARS;
 return {due:delayMs===0,delayMs,nextDueAt:new Date(now+delayMs).toISOString(),
  outputsize,estimatedCredits:SL_EXPECTED_CREDITS_PER_CALL,
  refreshMode:outputsize===SL_INCREMENTAL_BARS?'OVERLAPPING_180_BARS':'CATCHUP_5000_BARS',
  hourlyMinimumMs:SL_HOURLY_MS};
}
export function recordSLHourlyAttempt(record,market,symbol,{now=Date.now(),success=false}={}){
 slSyncKey(market,symbol);
 const s=slReadSyncState(record,market,symbol);
 const plan=planSLHourlySync({market,symbol,record:s,now});
 if(!plan.due)throw Error('Provider hourly minimum interval not reached');
 const timestamp=new Date(now).toISOString();
 return {...s,lastAttemptAt:timestamp,lastSuccessAt:success?timestamp:s.lastSuccessAt,
  totalAttempts:s.totalAttempts+1};
}
export function confirmSLHourlySuccess(record,market,symbol,{now=Date.now()}={}){
 slSyncKey(market,symbol);
 const s=slReadSyncState(record,market,symbol);
 if(!validTime(s.lastAttemptAt))throw Error('Cannot confirm provider success without a request attempt');
 if(now<Date.parse(s.lastAttemptAt))throw Error('Provider success timestamp predates request');
 return {...s,lastSuccessAt:new Date(now).toISOString()};
}
export const SL_HOURLY_CREDIT_EXAMPLES=Object.freeze({
 perSymbolPerDay:24,threeSymbolsPerDay:72,continuousFiveMinutePerDay:288
});
