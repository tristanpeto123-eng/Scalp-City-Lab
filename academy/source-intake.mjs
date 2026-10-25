/** Normalise an external, keyless XAUUSD five-minute CSV sample for isolated Academy research. */
import {createHash} from 'node:crypto';
import {parseDiscoveryCSV} from './opportunity-discovery.mjs';
export const SAMPLE_SOURCE='GETDATA_PUBLIC_GITHUB_SAMPLE';
export const SAMPLE_URL='https://raw.githubusercontent.com/getdata-finance/xauusd-5m-ohlcv-metals-historical-data/main/XAUUSD_5m.csv';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function intakeXauSample(raw,{minimumCandles=20000,minimumDays=120}={}){
 if(typeof raw!=='string'||raw.length>25000000)throw Error('Invalid external sample size');
 if(!Number.isInteger(minimumCandles)||minimumCandles<150||
    !Number.isInteger(minimumDays)||minimumDays<1)throw Error('Invalid intake minimum');
 const lines=raw.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(!/^datetime,open,high,low,close,volume$/i.test(lines[0]?.trim()))
  throw Error('Unrecognised XAUUSD sample schema');
 const csv=['time,open,high,low,close,volume',...lines.slice(1)].join('\n')+'\n';
 const candles=parseDiscoveryCSV(csv);
 if(candles.length<minimumCandles)throw Error('Source sample too short for Academy research');
 const spanDays=(Date.parse(candles.at(-1).t)-Date.parse(candles[0].t))/86400000;
 if(spanDays<minimumDays)throw Error('Insufficient calendar-day XAUUSD coverage');
 const gaps=candles.reduce((n,b,i)=>n+(i&&Date.parse(b.t)-Date.parse(candles[i-1].t)>300000?1:0),0);
 return {csv,manifest:{
  schema:'ACADEMY_SOURCE_PROVENANCE_V1',source:SAMPLE_SOURCE,url:SAMPLE_URL,
  sourceFile:'XAUUSD_5m.csv',symbol:'XAUUSD',timeframe:'5Min',
  rawSha256:sha(raw),normalizedSha256:sha(csv),
  rows:candles.length,first:candles[0].t,last:candles.at(-1).t,
  spanCalendarDays:Number(spanDays.toFixed(2)),gaps,
  originVerified:false,providerReportedHistorical:true,paperFillsVerified:false,
  brokerOrders:0,sourceLicenseReviewRequired:true,
  note:'Research data fetched from a third-party public sample, not independently authenticated Dukascopy ticks. Missing source periods or session gaps are never backfilled.'}};
}