// One examination engine for any Academy strategy family. Research only: no broker, no paper credentials.
// External decisions are untrusted traces until a separate examiner reruns the frozen model.
export const EXAM_SCHEMA = 'ACADEMY_COMMON_EXAM_V1';
export const SUBMISSION_SCHEMA = 'ACADEMY_FROZEN_STUDENT_V1';
export const COSTS = Object.freeze({initialGbp:1000,positionFraction:0.25,feeBpsPerSide:10,spreadBpsPerSide:5,slippageBpsPerSide:5});
const finite = x => typeof x === 'number' && Number.isFinite(x);
const must = (ok, msg) => {if(!ok)throw Error('ACADEMY: '+msg);};
const ms = t => {const n=Date.parse(t); must(Number.isFinite(n),'Invalid UTC timestamp'); must(/Z$/.test(t),'Timestamps must be UTC');return n;};
const duration = {'5Min':300000,'15Min':900000,'1Hour':3600000};
const round = x => Math.round((x+Number.EPSILON)*10000)/10000;
const key = x => JSON.stringify(x);
export async function digest(obj) {
  must(Boolean(globalThis.crypto?.subtle),'SHA-256 unavailable: cannot enrol');
  const bytes=new TextEncoder().encode(key(obj));
  const buf=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('');
}
function inspectSubmission(s) {
  must(s&&s.schema===SUBMISSION_SCHEMA,'Wrong submission schema');
  const m=s.student;
  must(m&&typeof m==='object'&&/^[A-Z0-9-]{5,45}$/.test(m.id||''),'Invalid student ID');
  must(typeof m.family==='string'&&m.family.length>2&&m.family.length<=75,'Missing strategy family');
  must(['SUPERVISED','REINFORCEMENT','PATTERN_MEMORY','RULE_BASED','HYBRID'].includes(m.learningMethod),'Invalid learning method');
  must(typeof m.version==='string'&&/^[A-Za-z0-9._-]{1,55}$/.test(m.version),'Missing model version');
  must(/^[A-Z0-9/]{3,15}$/.test(m.symbol||''),'Invalid market symbol');
  must(duration[m.timeframe],'Unsupported timeframe');
  must(['COMMODITIES','FOREX','INDICES','EQUITIES','CRYPTO'].includes(m.market),'Invalid market');
  if(m.id==='XAU-SCST-01') must(m.family==='SCOUT_STRATEGIST'&&m.symbol==='XAUUSD'&&m.market==='COMMODITIES'&&m.timeframe==='15Min','Scout / Strategist identity is fixed to XAUUSD 15Min');
  const checkpoint=s.checkpoint;
  must(checkpoint&&typeof checkpoint==='object'&&!Array.isArray(checkpoint),'Trained checkpoint required');
  must(typeof checkpoint.architecture==='string'&&checkpoint.architecture.length>=3,'Checkpoint architecture required');
  must(checkpoint.state&&typeof checkpoint.state==='object'&&Object.keys(checkpoint.state).length>0,'Nonempty model state required');
  // Do not accept placeholder strings or metadata alone as an actual parameter checkpoint.
  let numericParameters=0,visited=0;
  const scan=value=>{
    if(++visited>250000)throw Error('ACADEMY: oversized model structure');
    if(typeof value==='number'){must(finite(value),'Non-finite checkpoint parameter');numericParameters++;return;}
    if(Array.isArray(value)){for(const child of value)scan(child);return;}
    if(value&&typeof value==='object'){for(const child of Object.values(value))scan(child);}
  };
  scan(checkpoint.state);
  must(numericParameters>=3,'Trained checkpoint must contain numeric model parameters');
  const checkpointSize=key(checkpoint).length;
  must(checkpointSize>=60&&checkpointSize<=2000000,'Checkpoint missing or exceeds 2 MB');
  const cutoff=ms(m.trainedThroughUtc);
  const e=s.examination;
  must(e&&e.source==='HISTORICAL_MARKET_DATA','Only labelled recorded-market research candles accepted');
  must(!e.synthetic&&!e.generated&&!e.verifiedForward,'Synthetic or falsely verified examination rejected');
  must(typeof e.provider==='string'&&e.provider.length>=3&&e.provider.length<=80,'Source provider required');
  must(e.symbol===m.symbol&&e.timeframe===m.timeframe,'Exam market/timeframe mismatch');
  must(Array.isArray(e.candles)&&e.candles.length>=50&&e.candles.length<=30000,'Need 50–30,000 historical candles');
  must(Array.isArray(e.decisions)&&e.decisions.length===e.candles.length-1,'Exactly one frozen decision per candle except the last required');
  let prev=0;
  const bars=e.candles.map((b,i)=>{
    must(b&&typeof b.t==='string','Missing candle UTC');
    const t=ms(b.t);
    must(t>cutoff,'Examination overlaps model training cutoff');
    must(!i||t-prev===duration[m.timeframe],'Non-contiguous or duplicated examination candles');
    for(const p of ['o','h','l','c'])must(finite(b[p])&&b[p]>0,'Invalid OHLC');
    must(b.h>=Math.max(b.o,b.c,b.l)&&b.l<=Math.min(b.o,b.c,b.h),'OHLC ordering invalid');
    prev=t;return {t,o:b.o,h:b.h,l:b.l,c:b.c};
  });
  for(let i=0;i<e.decisions.length;i++){
    const a=e.decisions[i];
    must(a&&a.t===e.candles[i].t,'Decision timestamp must match completed signal candle');
    must(['FLAT','LONG','SHORT'].includes(a.action),'Invalid action; use FLAT, LONG or SHORT');
  }
  must(Date.now()>=bars.at(-1).t+duration[m.timeframe],'Exam contains uncompleted/future candles');
  // Never interpret self-reported input as a signed independent run.
  return {m,checkpoint,e,bars};
}
export async function evaluateSubmission(s) {
  const {m,checkpoint,e,bars}=inspectSubmission(s);
  const modelSha256=await digest({student:m,checkpoint});
  const dataSha256=await digest({provider:e.provider,symbol:e.symbol,timeframe:e.timeframe,candles:e.candles});
  const decisionsSha256=await digest(e.decisions);
  const friction=(COSTS.spreadBpsPerSide+COSTS.slippageBpsPerSide)/10000;
  const fee=COSTS.feeBpsPerSide/10000;
  let realised=0,position=null,peak=COSTS.initialGbp,drawdown=0,win=0,loss=0;
  const trades=[],equitySeries=[];
  const equityAt=price => COSTS.initialGbp+realised+
    (position?position.side*(price-position.entryPrice)*position.units-position.entryFee-position.units*price*fee:0);
  const mark=(t,price)=>{
    const equity=equityAt(price);peak=Math.max(peak,equity);
    drawdown=Math.max(drawdown,peak>0?(peak-equity)/peak*100:100);
    equitySeries.push({t,equityGbp:round(equity)});
    return equity;
  };
  const close=(t,open)=>{
    if(!position)return;
    const fill=open*(1-position.side*friction);
    const exitFee=position.units*fill*fee;
    const net=position.side*(fill-position.entryPrice)*position.units-position.entryFee-exitFee;
    realised+=net;
    trades.push({entryUtc:position.entryUtc,exitUtc:t,side:position.side===1?'LONG':'SHORT',
      entryPrice:round(position.entryPrice),exitPrice:round(fill),netGbp:round(net),
      entryFeeGbp:round(position.entryFee),exitFeeGbp:round(exitFee)});
    if(net>0)win++;else if(net<0)loss++;
    position=null;
  };
  for(let i=1;i<bars.length;i++){
    const b=bars[i],a=e.decisions[i-1].action,target=a==='LONG'?1:a==='SHORT'?-1:0;
    if(position&&position.side!==target)close(e.candles[i].t,b.o);
    if(!position&&target!==0){
      const nav=COSTS.initialGbp+realised;
      if(nav>0){
        const allocation=nav*COSTS.positionFraction,fill=b.o*(1+target*friction);
        const units=allocation/fill;
        position={side:target,units,entryPrice:fill,entryFee:allocation*fee,entryUtc:e.candles[i].t};
      }
    }
    mark(e.candles[i].t,b.c);
  }
  if(position){close(e.candles.at(-1).t,bars.at(-1).c);mark(e.candles.at(-1).t,bars.at(-1).c);}
  const net=round(realised),total=trades.length;
  const gains=trades.reduce((n,t)=>n+Math.max(0,t.netGbp),0);
  const losses=trades.reduce((n,t)=>n+Math.max(0,-t.netGbp),0);
  return {
    schema:EXAM_SCHEMA,studentId:m.id,modelVersion:m.version,modelFamily:m.family,
    learningMethod:m.learningMethod,market:m.market,symbol:m.symbol,timeframe:m.timeframe,
    modelSha256,dataSha256,decisionsSha256,source:e.provider,
    fromUtc:e.candles[0].t,toUtc:e.candles.at(-1).t,trainedThroughUtc:m.trainedThroughUtc,
    costs:COSTS,closedTrades:total,wins:win,losses:loss,winRatePct:total?round(100*win/total):null,
    realisedNetGbp:net,netReturnPct:round(100*net/COSTS.initialGbp),
    maxDrawdownPct:round(drawdown),profitFactor:losses>0?round(gains/losses):gains>0?null:0,
    equitySeries,trades,
    evidenceLevel:'LOCAL_UNVERIFIED_HISTORICAL_REPLAY',qualified:false,
    verifiedPaperTrades:0,brokerOrders:0,allowsPromotion:false,
    note:'Candidate-provided predictions are NOT independently replayed from checkpoint weights; no sealed test, paper grade or live orders.'
  };
}
