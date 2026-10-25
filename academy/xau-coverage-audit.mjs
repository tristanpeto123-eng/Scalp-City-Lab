/** Academy-only chronological XAUUSD dataset audit. Does not fetch or trade. */
import {createHash} from 'node:crypto';
import {validateDiscoveryBars,FIVE_MINUTES} from './opportunity-discovery.mjs';
export function auditXauCoverage(bars,{requiredDays=360,now=Date.now()}={}){
 const {bars:b,gaps}=validateDiscoveryBars(bars,{now});
 const first=Date.parse(b[0].t),last=Date.parse(b.at(-1).t);
 const calendarDays=(last-first)/86400000;
 const missing=[];
 let missingFiveMinuteBars=0;
 for(let i=1;i<b.length;i++){
  const delta=Date.parse(b[i].t)-Date.parse(b[i-1].t);
  if(delta>FIVE_MINUTES){
   const absent=delta/FIVE_MINUTES-1;missingFiveMinuteBars+=absent;
   missing.push({after:b[i-1].t,before:b[i].t,missingBars:absent,hours:delta/3600000});
  }
 }
 const perDay=new Map();
 for(const c of b){const d=c.t.slice(0,10);perDay.set(d,(perDay.get(d)||0)+1);}
 const dayCounts=[...perDay].map(([day,count])=>({day,count}));
 const maxGap=missing.reduce((m,x)=>Math.max(m,x.hours),0);
 const weekdaysWithNoCandles=[];
 for(let t=Date.UTC(new Date(first).getUTCFullYear(),new Date(first).getUTCMonth(),new Date(first).getUTCDate());
     t<=last;t+=86400000){
  const date=new Date(t),weekday=date.getUTCDay();
  if(weekday!==0&&weekday!==6&&!perDay.has(date.toISOString().slice(0,10)))
   weekdaysWithNoCandles.push(date.toISOString().slice(0,10));
 }
 const sha=createHash('sha256').update(JSON.stringify(b)).digest('hex');
 return {schema:'ACADEMY_XAU_COVERAGE_AUDIT_V1',symbol:'XAUUSD',timeframe:'5Min',
  candleSha256:sha,candles:b.length,first:b[0].t,last:b.at(-1).t,
  calendarDays:Number(calendarDays.toFixed(3)),requiredDays,coverageDaysPassed:calendarDays>=requiredDays,
  gaps,missingFiveMinuteBars,maxGapHours:Number(maxGap.toFixed(2)),
  weekdaysWithNoCandles,daysWithCandles:perDay.size,dayCounts,
  gapsDetail:missing.slice(0,1000),gapsTruncated:missing.length>1000,
  sourceVerified:false,marketHoursReviewed:false,brokerOrders:0,
  releaseEligible:false,
  cautions:['Weekend and session closures are not automatically defects',
    'Source and instrument provenance require independent validation',
    '360 calendar days is not equivalent to 360 active trading days',
    'Passing coverage is not evidence of profitability or forward execution']};
}