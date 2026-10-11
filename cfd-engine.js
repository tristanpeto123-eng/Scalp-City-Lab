/* Scalp City CFD Lab · browser-only exploratory DAILY backtester.
   Decisions use close(t) and fills use open(t+1). Never places broker orders.
   Six research hypotheses, NOT verified trading edges. */
export const ENGINE_VERSION='1.1.0-order-stable';
export const STRATEGIES = [
  {id:'CFD-001',name:'Cross-sectional momentum',min:190,params:{lookback:126,skip:21,tail:.25}},
  {id:'CFD-002',name:'Sector residual stat-arb (proxy)',min:115,params:{lookback:60,zWindow:40,entryZ:1.5,exitZ:.5,stopZ:3.5}},
  {id:'CFD-003',name:'Distance pairs (beta-hedged)',min:210,params:{formation:126,zWindow:60,entryZ:2,exitZ:.25,stopZ:3.5,maxHold:40,pairs:2}},
  {id:'CFD-004',name:'Moving-average trend',min:110,params:{fast:20,slow:100}},
  {id:'CFD-005',name:'Sector short-term reversal',min:15,params:{lookback:2,tail:.25}},
  {id:'CFD-006',name:'Donchian volatility breakout',min:70,params:{channel:50,exitChannel:20,atrDays:14,bufferAtr:.5}}
];
export const DEFAULT_COSTS = Object.freeze({capital:10000,spreadBps:6,commissionBps:2,slippageBps:2,longApr:.07,shortApr:.03,borrowApr:.01,marginRate:.20,maxMarginUtil:.60,grossExposure:1});
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
const sd=x=>{if(x.length<2)return 0;const m=mean(x);return Math.sqrt(x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-1))};
const empty=syms=>Object.fromEntries(syms.map(s=>[s,0]));
const sign=x=>x>0?1:x<0?-1:0;
const avg=(x,i,n)=>i>=n-1?mean(x.slice(i-n+1,i+1)):NaN;
function weightNormalize(w,gross){const sum=Object.values(w).reduce((a,b)=>a+Math.abs(b),0);return sum>0?Object.fromEntries(Object.entries(w).map(([s,v])=>[s,v*gross/sum])):w}
function ranked(score,sectors,tail,gross){
  const groups={};for(const [s,v] of Object.entries(score)){if(!Number.isFinite(v))continue;(groups[sectors[s]] ||= []).push([s,v])}
  const eligible=Object.values(groups).filter(x=>x.length>=4),w=empty(Object.keys(sectors));
  for(const group of eligible){group.sort((a,b)=>a[1]-b[1]);const n=Math.min(Math.floor(group.length/2),Math.max(1,Math.floor(group.length*tail)));
    for(let j=0;j<n;j++){w[group[j][0]]+=gross/(2*eligible.length*n);w[group[group.length-1-j][0]]-=gross/(2*eligible.length*n)}
  }return w;
}
export function parseDailyCSV(csv){
  if(typeof csv!=='string'||csv.length>25000000)throw Error('CSV is missing or exceeds 25 MB');
  const lines=csv.trim().split(/\r?\n/),header=(lines.shift()||'').split(',').map(x=>x.trim().toLowerCase());
  const idx=k=>header.indexOf(k);for(const k of ['date','security_id','sector','open','high','low','close','volume'])if(idx(k)<0)throw Error('Missing CSV column: '+k);
  const dayMap=new Map(),syms=new Set(),dupes=new Set();let rows=0;
  for(const line of lines){if(!line.trim())continue;if(++rows>150000)throw Error('Maximum 150,000 rows');
    const c=line.split(','),date=(c[idx('date')]||'').trim(),s=(c[idx('security_id')]||'').trim(),key=date+'|'+s;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||!s)throw Error('Invalid date/security_id: row '+rows);
    if(dupes.has(key))throw Error('Duplicate '+key);dupes.add(key);
    const bar={sector:(c[idx('sector')]||'UNKNOWN').trim()};
    for(const k of ['open','high','low','close','volume']){bar[k]=Number(c[idx(k)]);if(!Number.isFinite(bar[k])||bar[k]<0||(k!=='volume'&&bar[k]===0))throw Error('Invalid '+k+' on '+key)}
    if(bar.high+1e-9<Math.max(bar.open,bar.close)||bar.low-1e-9>Math.min(bar.open,bar.close))throw Error('OHLC range error '+key);
    const extra=(k,v)=>idx(k)>=0&&c[idx(k)]!==''?Number(c[idx(k)]):v;
    bar.signalClose=extra('split_adjusted_close',bar.close);bar.dividend=extra('cash_dividend',0);bar.spread=extra('spread_bps',NaN);bar.borrow=extra('borrow_available',1);
    if(!Number.isFinite(bar.signalClose)||bar.signalClose<=0||!Number.isFinite(bar.dividend)||bar.dividend<0||!Number.isFinite(bar.borrow))throw Error('Invalid optional field '+key);
    const o=dayMap.get(date)||{};o[s]=bar;dayMap.set(date,o);syms.add(s);
  }
  const dates=[...dayMap.keys()].sort(),symbols=[...syms].sort();if(dates.length<75||symbols.length<2)throw Error('At least 75 sessions and 2 securities needed');
  if(symbols.length>250)throw Error('Maximum 250 symbols');
  for(const date of dates)if(Object.keys(dayMap.get(date)).length!==symbols.length)throw Error('Missing historical bar(s) on '+date+' — no stale forward fills');
  return {dates,symbols,bars:dates.map(date=>dayMap.get(date)),source:'IMPORTED',warning:'You must supply delisted constituents, split-only adjusted signal prices, broker financing/dividend adjustments and point-in-time classifications for realistic research.'};
}
export function demoData(){
  let seed=81138;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const symbols=Array.from({length:16},(_,i)=>'SIM'+String(i+1).padStart(2,'0')),sectorNames=['TECH','FINANCE','HEALTH','INDUSTRY'];
  const px=Object.fromEntries(symbols.map((s,i)=>[s,70+i*4]));const dates=[],bars=[];let t=Date.UTC(2024,0,2);
  while(dates.length<460){const d=new Date(t),dow=d.getUTCDay();t+=86400000;if(dow===0||dow===6)continue;
    const date=d.toISOString().slice(0,10),i=dates.length,m=(rand()-.5)*.025,sectorMove=sectorNames.map(()=>(rand()-.5)*.023+m*.7),day={};
    for(let j=0;j<symbols.length;j++){const s=symbols[j],old=px[s],o=old*(1+(rand()-.5)*.006),trend=Math.sin(i/70+j/5)*.001;
      const c=Math.max(1,o*(1+sectorMove[Math.floor(j/4)]*.7+(rand()-.5)*.018+trend));
      day[s]={sector:sectorNames[Math.floor(j/4)],open:o,high:Math.max(o,c)*(1+rand()*.006),low:Math.min(o,c)*(1-rand()*.006),close:c,signalClose:c,volume:8e5+rand()*1e6,dividend:0,spread:NaN,borrow:1};px[s]=c}
    dates.push(date);bars.push(day)}return {dates,symbols,bars,source:'SYNTHETIC',warning:'Synthetic data is for software testing only. Results do not indicate future or historical market performance.'};
}
function pairZ(a,b,i,w){
  const x=a.slice(i-w+1,i+1).map(Math.log),y=b.slice(i-w+1,i+1).map(Math.log),mx=mean(x),my=mean(y);
  const denom=mean(y.map(v=>(v-my)**2));if(denom<1e-12)return null;
  const beta=mean(x.map((v,k)=>(v-mx)*(y[k]-my)))/denom;if(beta<=0||beta>8)return null;
  const res=x.map((v,k)=>v-beta*y[k]),vol=sd(res);return vol>1e-9?{z:(res.at(-1)-mean(res))/vol,beta}:null;
}
/** FNV-1a checksum of raw imported rows, for reproducibility comparisons only.
 * Not a cryptographic integrity signature. Includes orientation-sensitive values.
 */
export function datasetFingerprint(data){
  let hash=2166136261;
  const feed=str=>{for(let i=0;i<str.length;i++){hash^=str.charCodeAt(i);hash=Math.imul(hash,16777619)}};
  for(let i=0;i<data.dates.length;i++){
    feed(data.dates[i]);
    for(const s of [...data.symbols].sort()){
      const b=data.bars[i][s];
      feed(s+'|'+b.sector+'|'+[b.open,b.high,b.low,b.close,b.volume,b.signalClose,b.dividend,b.spread,b.borrow].join('|'));
    }
  }
  return 'fnv1a32:'+((hash>>>0).toString(16).padStart(8,'0'));
}
export function signals(data,id,settings={}){
  const def=STRATEGIES.find(x=>x.id===id);if(!def)throw Error('Unknown strategy '+id);
  const p={...def.params,...settings},symbols=[...data.symbols].sort(),n=data.dates.length,px=Object.fromEntries(symbols.map(s=>[s,data.bars.map(b=>b[s].signalClose)]));
  const events=Array(n).fill(null),states=empty(symbols),arb=empty(symbols),active={};let selected=[],refresh=-9999,lastSig='',gross=Math.min(2,Math.max(0,Number(settings.grossExposure??1)));
  for(let i=def.min-1;i<n;i++){
    const sectors=Object.fromEntries(symbols.map(s=>[s,data.bars[i][s].sector]));let w=empty(symbols);
    if(id==='CFD-001'){
      if(i+1<n&&data.dates[i].slice(0,7)===data.dates[i+1].slice(0,7))continue;
      const score={};for(const s of symbols)score[s]=i>=p.lookback+p.skip?px[s][i-p.skip]/px[s][i-p.skip-p.lookback]-1:NaN;
      w=ranked(score,sectors,p.tail,gross);
    }else if(id==='CFD-005'){
      const scores={},groups={};for(const s of symbols){scores[s]=px[s][i]/px[s][i-p.lookback]-1;(groups[sectors[s]] ||= []).push(scores[s])}
      for(const s of symbols)scores[s]-=mean(groups[sectors[s]]);w=ranked(scores,sectors,p.tail,gross);
    }else if(id==='CFD-004'){
      for(const s of symbols){const f=avg(px[s],i,p.fast),slow=avg(px[s],i,p.slow);w[s]=Number.isFinite(f)&&Number.isFinite(slow)?(f>slow?1:-1):0}w=weightNormalize(w,gross);
    }else if(id==='CFD-006'){
      for(const s of symbols){const bar=data.bars[i][s];let hi=-Infinity,lo=Infinity,xhi=-Infinity,xlo=Infinity;
        for(let k=i-p.channel;k<i;k++){const b=data.bars[k][s];hi=Math.max(hi,b.high);lo=Math.min(lo,b.low)}
        for(let k=i-p.exitChannel;k<i;k++){const b=data.bars[k][s];xhi=Math.max(xhi,b.high);xlo=Math.min(xlo,b.low)}
        const tr=[];for(let k=i-p.atrDays+1;k<=i;k++){const b=data.bars[k][s],prev=data.bars[k-1][s].close;tr.push(Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev)))}
        const atr=mean(tr);if(states[s]>0&&bar.close<xlo)states[s]=0;else if(states[s]<0&&bar.close>xhi)states[s]=0;
        if(!states[s]){if(bar.close>hi+p.bufferAtr*atr)states[s]=1;else if(bar.close<lo-p.bufferAtr*atr)states[s]=-1}w[s]=states[s];
      }w=weightNormalize(w,gross);
    }else if(id==='CFD-002'){
      const ret={},meanSec={};for(const s of symbols){const vals=[];for(let k=i-p.lookback-p.zWindow+1;k<=i;k++)if(k>0)vals.push(px[s][k]/px[s][k-1]-1);ret[s]=vals}
      for(const sec of new Set(Object.values(sectors))){const members=symbols.filter(s=>sectors[s]===sec);for(let k=0;k<ret[members[0]].length;k++)meanSec[sec+'|'+k]=mean(members.map(s=>ret[s][k]))}
      for(const s of symbols){const cum=[];let sum=0;for(let k=0;k<ret[s].length;k++){sum+=ret[s][k]-meanSec[sectors[s]+'|'+k];cum.push(sum)}
        const recent=cum.slice(-p.zWindow),vol=sd(recent),z=vol>1e-9?(recent.at(-1)-mean(recent))/vol:0;
        if(arb[s]&&(Math.abs(z)<=p.exitZ||Math.abs(z)>=p.stopZ))arb[s]=0;
        else if(!arb[s]&&Math.abs(z)>=p.entryZ&&Math.abs(z)<p.stopZ)arb[s]=-sign(z);
      }
      for(const sec of new Set(Object.values(sectors))){const members=symbols.filter(s=>sectors[s]===sec);if(members.length<4)continue;
        const longs=members.filter(s=>arb[s]>0),shorts=members.filter(s=>arb[s]<0);
        if(longs.length&&shorts.length){for(const s of longs)w[s]=1/(2*longs.length);for(const s of shorts)w[s]=-1/(2*shorts.length)}
      }w=weightNormalize(w,gross);
    }else if(id==='CFD-003'){
      if(i-refresh>=p.formation){const pairs=[];for(let a=0;a<symbols.length;a++)for(let b=a+1;b<symbols.length;b++){
        const sa=symbols[a],sb=symbols[b];if(sectors[sa]!==sectors[sb])continue;const p0=px[sa][i-p.formation],q0=px[sb][i-p.formation];let d=0;
        for(let k=i-p.formation;k<i;k++)d+=(px[sa][k]/p0-px[sb][k]/q0)**2;pairs.push({a:sa,b:sb,score:d})
      }pairs.sort((a,b)=>a.score-b.score);selected=[];const used=new Set();for(const pair of pairs){if(used.has(pair.a)||used.has(pair.b))continue;
        selected.push(pair);used.add(pair.a);used.add(pair.b);if(selected.length>=p.pairs)break}
        for(const key of Object.keys(active))delete active[key];refresh=i;
      }
      for(const pair of selected){const key=pair.a+'|'+pair.b,zinfo=pairZ(px[pair.a],px[pair.b],i,p.zWindow);if(!zinfo){delete active[key];continue}
        const z=zinfo.z,old=active[key];if(old&&(Math.abs(z)<=p.exitZ||Math.abs(z)>=p.stopZ||i-old.enter>=p.maxHold))delete active[key];
        else if(!old&&Math.abs(z)>=p.entryZ&&Math.abs(z)<p.stopZ)active[key]={direction:-sign(z),beta:zinfo.beta,enter:i};
        const cur=active[key];if(cur){w[pair.a]+=cur.direction/(1+cur.beta);w[pair.b]-=cur.direction*cur.beta/(1+cur.beta)}
      }w=weightNormalize(w,gross);
    }
    const fingerprint=symbols.map(s=>Math.round(w[s]*1e6)).join('|');
    if(id==='CFD-001'||id==='CFD-005'||fingerprint!==lastSig){events[i]=w;lastSig=fingerprint}
  }return events;
}
export function backtest(data,id,options={}){
  const c={...DEFAULT_COSTS,...options},signal=signals(data,id,c),symbols=[...data.symbols].sort(),initial=Number(c.capital);
  if(!Number.isFinite(initial)||initial<=0)throw Error('Invalid initial capital');
  let nav=initial,orders=0,marginEvents=0,grossPricePnL=0,turnover=0,halted=false;
  const qty=empty(symbols),cost={commission:0,spread:0,slippage:0,financing:0,borrow:0,dividends:0},curve=[];
  function order(s,delta,price,bar){const notional=Math.abs(delta*price);if(notional<.25)return;
    const spread=notional*Math.max(0,Number.isFinite(bar.spread)?bar.spread:c.spreadBps)/20000;
    const slip=notional*Math.max(0,c.slippageBps)/10000,fee=notional*Math.max(0,c.commissionBps)/10000;
    nav-=spread+slip+fee;cost.spread+=spread;cost.slippage+=slip;cost.commission+=fee;qty[s]+=delta;orders++;turnover+=notional;
  }
  for(let i=0;i<data.dates.length;i++){
    const day=data.bars[i],date=data.dates[i];
    if(i>0){const prev=data.bars[i-1],days=Math.max(1,Math.min(5,Math.round((Date.parse(date)-Date.parse(data.dates[i-1]))/86400000)));
      for(const s of symbols){if(!qty[s])continue;
        const gap=qty[s]*(day[s].open-prev[s].close);nav+=gap;grossPricePnL+=gap;
        const div=qty[s]*day[s].dividend;nav+=div;cost.dividends+=div;
        const nominal=Math.abs(qty[s]*prev[s].close),carry=nominal*(qty[s]>0?c.longApr:c.shortApr)*days/365;
        nav-=carry;cost.financing+=carry;
        if(qty[s]<0){const fee=nominal*c.borrowApr*days/365;nav-=fee;cost.borrow+=fee}
      }
      if(signal[i-1]&&!halted&&nav>0){const weights=signal[i-1],weightsGross=Object.values(weights).reduce((a,v)=>a+Math.abs(v),0)||1;
        const cap=Math.max(0,Math.min(c.grossExposure,c.maxMarginUtil/Math.max(.01,c.marginRate)*.98)),factor=Math.min(1,cap/weightsGross);
        for(const s of symbols){const b=day[s],targetWeight=weights[s]*factor,target=targetWeight<0&&b.borrow===0?0:nav*targetWeight/b.open;
          order(s,target-qty[s],b.open,b)}
      }
    }
    for(const s of symbols){const change=qty[s]*(day[s].close-day[s].open);nav+=change;grossPricePnL+=change}
    let margin=symbols.reduce((a,s)=>a+Math.abs(qty[s]*day[s].close)*c.marginRate,0);
    if(!halted&&margin>0&&(nav<=margin*.5||margin>Math.max(0,nav)*c.maxMarginUtil)){
      marginEvents++;for(const s of symbols)order(s,-qty[s],day[s].close,day[s]);margin=0;if(nav<=0)halted=true;
    }if(nav<=0)halted=true;curve.push({date,nav,orders,margin});
  }
  const returns=[],cut=Math.max(1,Math.floor(curve.length*.7));let peak=initial,dd=0;
  for(let i=0;i<curve.length;i++){peak=Math.max(peak,curve[i].nav);if(peak>0)dd=Math.max(dd,(peak-curve[i].nav)/peak);
    if(i>0&&curve[i-1].nav>0)returns.push(curve[i].nav/curve[i-1].nav-1)}
  const vol=sd(returns),s=vol?mean(returns)/vol*Math.sqrt(252):0;
  const metrics={netReturnPct:(nav/initial-1)*100,holdoutReturnPct:curve[cut-1].nav>0?(nav/curve[cut-1].nav-1)*100:null,
    sharpe:s,maxDrawdownPct:dd*100,orders,marginEvents,notionalTurnover:turnover};
  return {id,name:STRATEGIES.find(x=>x.id===id).name,metrics,costs:cost,grossPricePnL,netPnL:nav-initial,curve,
    signalEvents:signal.filter(Boolean).length,source:data.source,engineVersion:ENGINE_VERSION};
}
export function runAll(data,costs={},only='ALL'){
  const defs=only==='ALL'?STRATEGIES:STRATEGIES.filter(s=>s.id===only);if(!defs.length)throw Error('Unknown strategy selection');
  return defs.map(s=>backtest(data,s.id,costs));
}
