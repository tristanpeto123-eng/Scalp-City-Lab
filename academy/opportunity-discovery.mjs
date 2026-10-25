/** Academy XAUUSD historical candidate discovery. Offline research only: no broker I/O. */
export const DISCOVERY_SCHEMA='ACADEMY_OPPORTUNITY_DISCOVERY_V1';
export const FIVE_MINUTES=300000;
export const FIFTEEN_MINUTES=900000;
export const COMMODITY_TIMEFRAMES=Object.freeze({FiveMin:FIVE_MINUTES,FiveMinute:FIVE_MINUTES,'5Min':FIVE_MINUTES,'15Min':FIFTEEN_MINUTES});
const cadence=tf=>{if(!['5Min','15Min'].includes(tf))throw Error('Unsupported market timeframe');return COMMODITY_TIMEFRAMES[tf]};
const ok=Number.isFinite,clip=n=>Math.max(-1,Math.min(1,n));
export function validateDiscoveryBars(input,{now=Date.now(),timeframe='5Min'}={}){
 const intervalMs=cadence(timeframe);
 if(!Array.isArray(input)||input.length<150||input.length>150000)throw Error('Need 150–150000 completed '+timeframe+' candles');
 let gaps=0,last=-Infinity,observedFiveMin=0,observedFifteenMin=0;const bars=input.map((b,i)=>{
  const t=Date.parse(b.t);
  if(!ok(t)||t%intervalMs||!['o','h','l','c'].every(k=>typeof b[k]==='number'&&ok(b[k]))||
     Math.min(b.o,b.h,b.l,b.c)<=0||b.h<Math.max(b.o,b.c,b.l)||b.l>Math.min(b.o,b.c,b.h)||
     (b.v!=null&&(!ok(b.v)||b.v<0)))throw Error('Invalid candle '+i);
  if(i){const distance=t-last;if(distance<intervalMs||distance%intervalMs)throw Error('Unordered or duplicate candles');if(distance>intervalMs)gaps++;if(distance===FIVE_MINUTES)observedFiveMin++;if(distance===FIFTEEN_MINUTES)observedFifteenMin++;}
  last=t;return {t:new Date(t).toISOString(),o:b.o,h:b.h,l:b.l,c:b.c,v:b.v??null};
 });
 if(timeframe==='5Min'&&observedFiveMin===0&&observedFifteenMin>input.length*.55)
  throw Error('15Min dataset cannot be treated as genuine 5Min candles');
 if(last+intervalMs>now-30000)throw Error('Last candle incomplete or future');
 return {bars,gaps};
}
export function parseDiscoveryCSV(csv,{timeframe='5Min'}={}){
 cadence(timeframe);
 if(typeof csv!=='string'||csv.length>45000000)throw Error('Invalid CSV size');
 const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
 if(lines.length<151||lines.length>150001)throw Error('Insufficient CSV candles');
 const names=lines.shift().toLowerCase().split(',').map(x=>x.trim());
 const index=['time','open','high','low','close','volume'].map(n=>names.indexOf(n));
 if(index.slice(0,5).some(x=>x<0))throw Error('Need time,open,high,low,close CSV headers');
 const bars=lines.map((line,i)=>{
  const x=line.split(',');if(x.length!==names.length)throw Error('Invalid CSV row '+i);
  const raw=x[index[0]].trim();
  if(!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)?$/i.test(raw))throw Error('ISO UTC timestamp required');
  const t=raw.replace(' ','T')+(/[Zz]$|[+-]\d\d:?\d\d$/.test(raw)?'':'Z');
  const nums=index.slice(1,5).map(k=>{if(!x[k]?.trim())throw Error('Missing OHLC');return Number(x[k]);});
  const v=index[5]<0||x[index[5]]===''?null:Number(x[index[5]]);
  return {t,...Object.fromEntries(['o','h','l','c'].map((k,j)=>[k,nums[j]])),v};
 });
 return validateDiscoveryBars(bars,{timeframe}).bars;
}
function inputs(b,i,side){
 const p=b.slice(i-24,i),cur=b[i],v=p.filter(x=>x.v>0),mean=v.length?v.reduce((s,x)=>s+x.v,0)/v.length:0;
 const hi=Math.max(...p.map(x=>x.h)),lo=Math.min(...p.map(x=>x.l));
 const range=p.reduce((s,x)=>s+(x.h-x.l)/x.c,0)/24;
 let dist=0;for(let j=i-10;j<=i;j++)dist+=Math.abs(b[j].c-b[j-1].c);
 const efficiency=dist?Math.abs(b[i].c-b[i-11].c)/dist:0;
 return {features:[clip((cur.c/b[i-12].c-1)*350),clip((cur.c/b[i-3].c-1)*700),clip(range*190),
  mean&&cur.v!=null?clip(cur.v/mean-1):0,hi>lo?clip(2*(cur.c-lo)/(hi-lo)-1):0,side],
  regime:range>.006?'VOLATILE':efficiency>.55?'DIRECTIONAL':efficiency<.2?'CHOPPY':'RANGING'};
}
function virtualExit(b,at,side,hold,stopBps,takeBps){
 const entry=b[at].o,stop=entry*(1-side*stopBps/10000),take=entry*(1+side*takeBps/10000);
 for(let j=at;j<at+hold;j++){
  const c=b[j],bad=side===1?c.o<=stop:c.o>=stop,good=side===1?c.o>=take:c.o<=take;
  if(bad)return {price:c.o,index:j,reason:'STOP_GAP'};
  if(good)return {price:take,index:j,reason:'TAKE'};
  const touchBad=side===1?c.l<=stop:c.h>=stop,touchGood=side===1?c.h>=take:c.l<=take;
  if(touchBad)return {price:stop,index:j,reason:touchGood?'AMBIGUOUS_STOP_FIRST':'STOP'};
  if(touchGood)return {price:take,index:j,reason:'TAKE'};
 }
 return {price:b[at+hold].o,index:at+hold,reason:'TIME_EXIT'};
}
export function discoverOpportunities({bars,symbol='XAUUSD',timeframe='5Min',virtualNotionalGbp=1000,sideCostBps=8,
 stressSideCostBps=16,scenarios=[{holdCandles:3,stopBps:35,takeBps:70},{holdCandles:6,stopBps:55,takeBps:110}],now=Date.now()}={}){
 if(!['XAUUSD','XAGUSD'].includes(symbol))throw Error('Only XAUUSD and XAGUSD commodity specialists supported');
 const intervalMs=cadence(timeframe);
 if(!ok(virtualNotionalGbp)||virtualNotionalGbp<50||!ok(sideCostBps)||sideCostBps<0||
    !ok(stressSideCostBps)||stressSideCostBps<sideCostBps||stressSideCostBps>200)throw Error('Invalid costs');
 if(!Array.isArray(scenarios)||!scenarios.length||scenarios.length>8||scenarios.some(s=>
   !Number.isInteger(s.holdCandles)||s.holdCandles<1||s.holdCandles>24||!ok(s.stopBps)||s.stopBps<=0||
   !ok(s.takeBps)||s.takeBps<=0))throw Error('Invalid scenarios');
 const src=validateDiscoveryBars(bars,{now,timeframe}),b=src.bars,train=Math.floor(b.length*.6),end=Math.floor(b.length*.8);
 const maxHold=Math.max(...scenarios.map(s=>s.holdCandles)),opportunities=[];
 for(let i=25;i+1+maxHold<end;i+=maxHold+1){
  const final=i+1+maxHold,phase=i<train?'TRAIN':'DEVELOPMENT';
  if(phase==='TRAIN'&&final>=train)continue;
  let valid=true;for(let j=i-23;j<=final;j++)if(Date.parse(b[j].t)-Date.parse(b[j-1].t)!==intervalMs){valid=false;break;}
  if(!valid)continue;
  for(const s of scenarios)for(const side of [1,-1]){
   const ex=virtualExit(b,i+1,side,s.holdCandles,s.stopBps,s.takeBps),f=inputs(b,i,side);
   const gross=side*(ex.price/b[i+1].o-1);
   const net=virtualNotionalGbp*(gross-2*sideCostBps/10000),stress=virtualNotionalGbp*(gross-2*stressSideCostBps/10000);
   const label=net>1e-8?'GOOD':net< -1e-8?'BAD':'NEUTRAL';
   opportunities.push({id:['DISC',symbol,b[i].t,side,s.holdCandles,s.stopBps,s.takeBps].join('|'),
    groupId:symbol+'|'+b[i].t,source:'USER_SUPPLIED_UNVERIFIED',phase,market:'COMMODITIES',symbol,
    signalAt:b[i].t,openedAt:b[i+1].t,closedAt:b[ex.index].t,side:side===1?'LONG':'SHORT',
    features:f.features,regime:f.regime,scenario:{...s},entryPrice:b[i+1].o,exitPrice:ex.price,
    exitReason:ex.reason,netPnlGbp:Number(net.toFixed(8)),stressNetPnlGbp:Number(stress.toFixed(8)),
    label,binaryLabel:label==='NEUTRAL'?null:label==='GOOD'?1:0,isCounterfactual:true});
  }
 }
 return {schema:DISCOVERY_SCHEMA,status:'HISTORICAL_RESEARCH_ONLY',symbol,timeframe,
  parameters:{virtualNotionalGbp,sideCostBps,stressSideCostBps,scenarios},
  dataset:{firstCandle:b[0].t,lastCandle:b.at(-1).t,totalCandles:b.length,gaps:src.gaps,
   sealedTestStart:b[end].t,sealedTestCandles:b.length-end,sealedTestEvaluated:false},
  summary:{trainCandidates:opportunities.filter(x=>x.phase==='TRAIN').length,
   developmentCandidates:opportunities.filter(x=>x.phase==='DEVELOPMENT').length,
   good:opportunities.filter(x=>x.label==='GOOD').length,bad:opportunities.filter(x=>x.label==='BAD').length,
   neutral:opportunities.filter(x=>x.label==='NEUTRAL').length},
  opportunities,brokerOrders:0,modelPromotions:0,verifiedForwardGrades:0,
  limitations:['Counterfactual opportunities are correlated, not independent trades',
   'OHLC ambiguous stop/take sequence assumed stop first','No actual spread, FX or broker fills',
   'Final 20% reserved: not examined by discovery engine']};
}