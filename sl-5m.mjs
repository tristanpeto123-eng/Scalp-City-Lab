/**
 * Scalp City SL — native five-minute historical candle importer.
 * Read-only research lane. It never fetches credentials or places orders.
 * Both the labels and executions below are modeled counterfactuals.
 */
import {SL_ACTIVE_MARKETS, SL_FEATURES} from './sl-core.mjs';

export const SL_FIVE_MIN_MS = 300000;
export const SL_FIVE_MIN_VERSION = 'SL_5MIN_HISTORICAL_V1';
const FIN = n => typeof n === 'number' && Number.isFinite(n);
const clip = n => Math.max(-1,Math.min(1,n));
const round = n => Math.round((n + Number.EPSILON)*100)/100;
const fields = ['time','open','high','low','close'];
const aliases = {
 time:['time','timestamp','datetime','date','t'],
 open:['open','o'], high:['high','h'], low:['low','l'], close:['close','c'],
 volume:['volume','tick_volume','tickvolume','vol','v']
};
function csvFields(line){
 const out=[];let curr='',inside=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(c==='"'){if(inside&&line[i+1]==='"'){curr+='"';i++;}else inside=!inside;}
  else if(c===','&&!inside){out.push(curr.trim());curr='';}
  else curr+=c;
 }
 if(inside)throw Error('SL 5m CSV contains an unclosed quote');
 out.push(curr.trim());return out;
}
function utcTime(input){
 const v=String(input??'').trim();
 // A timestamp without a zone is interpreted as UTC, never as browser local time.
 const t=/^\d{4}-\d\d-\d\d(?:T| )\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:?\d\d)?$/i.test(v)
  ? (/[Zz]$|[+-]\d\d:?\d\d$/.test(v)?v.replace(' ','T'):v.replace(' ','T')+'Z')
  : v;
 const ms=Date.parse(t);
 if(!Number.isFinite(ms)) throw Error('SL 5m data requires valid UTC/ISO candle timestamps');
 return new Date(ms).toISOString();
}
export function parseSLFiveMinuteCSV(csv){
 if(typeof csv!=='string'||csv.length<40||csv.length>8_000_000)throw Error('SL 5m CSV is empty or too large');
 const rows=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
 if(rows.length<151||rows.length>60001)throw Error('SL needs 150–60000 five-minute candles plus a header');
 const head=csvFields(rows[0]).map(x=>x.toLowerCase().replace(/[^a-z_]/g,''));
 const idx={};
 for(const [key,names] of Object.entries(aliases))idx[key]=head.findIndex(x=>names.includes(x));
 if(fields.some(k=>idx[k]<0))throw Error('SL 5m CSV needs time, open, high, low, close columns');
 const bars=[];
 for(let i=1;i<rows.length;i++){
  const row=csvFields(rows[i]);
  const bar={t:utcTime(row[idx.time]),o:Number(row[idx.open]),
    h:Number(row[idx.high]),l:Number(row[idx.low]),c:Number(row[idx.close]),
    v:idx.volume<0||row[idx.volume]===''?null:Number(row[idx.volume])};
  bars.push(bar);
 }
 return validateSLFiveMinuteBars(bars).bars;
}
export function validateSLFiveMinuteBars(input,{now=Date.now()}={}){
 if(!Array.isArray(input)||input.length<150||input.length>60000||!FIN(now))
  throw Error('SL 5m expects 150–60000 recorded five-minute candles');
 const bars=[];let gaps=0,missingVolume=0;
 for(let i=0;i<input.length;i++){
  const b=input[i],t=Date.parse(b?.t),o=Number(b?.o),h=Number(b?.h),l=Number(b?.l),
   c=Number(b?.c),v=(b?.v===null||b?.v===undefined||b?.v==='')?null:Number(b.v);
  if(!Number.isFinite(t)||t%SL_FIVE_MIN_MS!==0||
     ![o,h,l,c].every(FIN)||Math.min(o,h,l,c)<=0||
     h<Math.max(o,c,l)||l>Math.min(o,c,h)|| (v!==null&&(!FIN(v)||v<0)))
    throw Error('SL 5m invalid candle at row '+(i+1));
  if(i){
   const gap=t-Date.parse(bars[i-1].t);
   if(gap<SL_FIVE_MIN_MS||gap%SL_FIVE_MIN_MS!==0)throw Error('SL 5m candles unordered, duplicated or off the 5-minute grid');
   if(gap>SL_FIVE_MIN_MS)gaps++;
  }
  if(v===null)missingVolume++;
  bars.push({t:new Date(t).toISOString(),o,h,l,c,v});
 }
 if(Date.parse(bars.at(-1).t)+SL_FIVE_MIN_MS>now-30000)
  throw Error('SL 5m last candle is still open or in the future');
 return {bars,gaps,missingVolume,source:'USER_IMPORTED_UNVERIFIED_5MIN'};
}
function segmentStart(bars,i){
 let from=i;
 while(from>0&&Date.parse(bars[from].t)-Date.parse(bars[from-1].t)===SL_FIVE_MIN_MS)from--;
 return from;
}
function featuresAt(bars,i,side){
 if(![side===1,side===-1].some(Boolean))throw Error('Invalid SL 5m side');
 const now=bars[i],prior=bars.slice(i-20,i);
 const avgRange=prior.reduce((s,b)=>s+(b.h-b.l)/b.c,0)/prior.length;
 const volumes=prior.map(b=>b.v).filter(v=>v!==null&&v>0);
 const avgVol=volumes.length?volumes.reduce((a,b)=>a+b,0)/volumes.length:0;
 const hi=Math.max(...prior.map(x=>x.h)),lo=Math.min(...prior.map(x=>x.l));
 const trend=clip((now.c/bars[i-12].c-1)*350);
 const momentum=clip((now.c/bars[i-3].c-1)*700);
 const volatility=clip(avgRange*190);
 const relativeVolume=now.v!==null&&avgVol>0?clip(now.v/avgVol-1):0;
 const distanceFromLevel=hi>lo?clip(2*(now.c-lo)/(hi-lo)-1):0;
 return [trend,momentum,volatility,relativeVolume,distanceFromLevel,side];
}
/**
 * Generate one predeclared long-or-short opportunity from each nonoverlapping historical
 * window. Signal uses the last COMPLETED candle. Simulated entry/exit happen at later
 * opens; both directions pay costs. No price or outcome after the signal influences features.
 */
export function buildSLFiveMinuteDataset({
 bars,market,symbol,holdCandles=3,sideCostBps=4,virtualNotionalGbp=1000,now=Date.now()
}={}){
 if(!SL_ACTIVE_MARKETS.includes(market))throw Error('SL 5m market not active');
 if(typeof symbol!=='string'||!/^[A-Z0-9._/-]{2,24}$/.test(symbol))
  throw Error('SL 5m needs a market symbol such as XAUUSD, EURUSD or US100');
 if(!Number.isInteger(holdCandles)||holdCandles<1||holdCandles>24||
  !FIN(sideCostBps)||sideCostBps<0||sideCostBps>100||
  !FIN(virtualNotionalGbp)||virtualNotionalGbp<50||virtualNotionalGbp>1_000_000)
  throw Error('Invalid SL 5m holding period, cost or virtual notional');
 const {bars:clean,gaps,missingVolume,source}=validateSLFiveMinuteBars(bars,{now});
 const opportunities=[],step=holdCandles+1;
 // Reset indicator warmup after market closures; skip any trade spanning a gap.
 for(let i=25;i+step<clean.length;i+=step){
  const start=segmentStart(clean,i);
  if(i-start<25)continue;
  let contiguous=true;
  for(let j=i+1;j<=i+step;j++){
   if(Date.parse(clean[j].t)-Date.parse(clean[j-1].t)!==SL_FIVE_MIN_MS){contiguous=false;break;}
  }
  if(!contiguous)continue;
  const signal=clean[i],entry=clean[i+1],exit=clean[i+step];
  const side=(signal.c/clean[i-3].c>=1)?1:-1;
  const f=featuresAt(clean,i,side);
  if(f.length!==SL_FEATURES.length||f.some(n=>!FIN(n)||n < -1||n>1))
   throw Error('SL 5m feature computation failed');
  const grossReturn=side*(exit.o/entry.o-1);
  const netPnlGbp=virtualNotionalGbp*(grossReturn-2*sideCostBps/10000);
  // Break-even closes cannot be filed in a binary good/bad pile.
  if(Math.abs(netPnlGbp)<1e-9)continue;
  opportunities.push({
    trade:{id:`SL5M|${symbol}|${entry.t}|${side}|${holdCandles}|${sideCostBps}|${virtualNotionalGbp}`,
     market,source:'HISTORICAL_RESEARCH',openedAt:entry.t,closedAt:exit.t,
     entryFeatures:f,netPnlGbp},
    signalIndex:i,entryIndex:i+1,exitIndex:i+step,side,
    signalTime:signal.t,entryPrice:entry.o,exitPrice:exit.o,
    grossReturnPct:round(grossReturn*100),netPnlGbp:round(netPnlGbp)
  });
 }
 if(opportunities.length<40)
  throw Error('SL 5m needs 40+ nonoverlapping opportunities; import a longer contiguous dataset');
 return {schema:SL_FIVE_MIN_VERSION,market,symbol,timeframe:'5Min',
  bars:clean,opportunities,feed:source,gaps,missingVolume,
  holdCandles,sideCostBps,virtualNotionalGbp,
  explanation:'Past closed-bar inputs; following-open simulated fills; net GBP notional with both-side modeled costs. Historical research only.'};
}
