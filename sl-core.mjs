/** SL: isolated supervised neural-network research strategy. Never routes orders. */
export const SL_VERSION = 'SL_SUPERVISED_V1';
export const SL_MARKETS = Object.freeze(['COMMODITIES', 'FOREX', 'INDICES', 'EQUITIES', 'CRYPTO']);
export const SL_ACTIVE_MARKETS = Object.freeze(['COMMODITIES', 'FOREX', 'INDICES']);
export const SL_FEATURES = Object.freeze([
  'trend', 'momentum', 'volatility', 'relativeVolume', 'distanceFromLevel', 'entrySignal'
]);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const assertMarket = market => {
  if (!SL_MARKETS.includes(market)) throw Error('SL market not recognised');
};
const validTime = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /\d{4}-\d\d-\d\dT/.test(v);
export function createSLMemory(market) {
  assertMarket(market);
  return { strategy: 'SL', version: SL_VERSION, market, good: [], bad: [] };
}
function checkedTrade(trade, market) {
  if (!trade || typeof trade !== 'object' || Array.isArray(trade) || trade.market !== market ||
      typeof trade.id !== 'string' || trade.id.length < 1 || trade.id.length > 128 ||
      !validTime(trade.openedAt) || !validTime(trade.closedAt) ||
      Date.parse(trade.closedAt) <= Date.parse(trade.openedAt) ||
      !Array.isArray(trade.entryFeatures) || trade.entryFeatures.length !== SL_FEATURES.length ||
      !trade.entryFeatures.every(x => finite(x) && x >= -1 && x <= 1) ||
      !finite(trade.netPnlGbp) || Math.abs(trade.netPnlGbp) > 1e8 || trade.netPnlGbp === 0)
    throw Error('Invalid SL trade: use a unique id, market, entry-only features [-1,1], timestamps and nonzero net GBP P&L');
  if (trade.source !== 'HISTORICAL_RESEARCH' && trade.source !== 'SYNTHETIC_DEMO')
    throw Error('SL only accepts labelled historical-research or explicit synthetic-demo samples');
  return {id: trade.id, market, openedAt: new Date(trade.openedAt).toISOString(),
    closedAt: new Date(trade.closedAt).toISOString(), entryFeatures: [...trade.entryFeatures],
    netPnlGbp: trade.netPnlGbp, source: trade.source};
}
export function validateSLMemory(memory) {
  if (!memory || memory.strategy !== 'SL' || memory.version !== SL_VERSION) throw Error('Not an SL memory');
  assertMarket(memory.market);
  if (!Array.isArray(memory.good) || !Array.isArray(memory.bad)) throw Error('SL piles are missing');
  if (memory.good.length + memory.bad.length > 100000) throw Error('SL memory exceeds bounded size');
  const ids = new Set();
  const good = memory.good.map(trade => checkedTrade(trade, memory.market));
  const bad = memory.bad.map(trade => checkedTrade(trade, memory.market));
  for (const t of good) {
    if (t.netPnlGbp <= 0 || ids.has(t.id)) throw Error('Invalid or duplicate SL winning record');
    ids.add(t.id);
  }
  for (const t of bad) {
    if (t.netPnlGbp >= 0 || ids.has(t.id)) throw Error('Invalid or duplicate SL losing record');
    ids.add(t.id);
  }
  const kinds = new Set([...good,...bad].map(t=>t.source));
  if (kinds.size > 1) throw Error('Synthetic and historical SL trades must not be mixed');
  return {strategy:'SL',version:SL_VERSION,market:memory.market,good,bad};
}
export function recordSLTrade(memory, trade) {
  const validated = validateSLMemory(memory);
  const next = checkedTrade(trade, validated.market);
  if ([...validated.good, ...validated.bad].some(t => t.id === next.id)) throw Error('Duplicate SL trade ID');
  if ((validated.good[0] || validated.bad[0])?.source !== undefined &&
      (validated.good[0] || validated.bad[0]).source !== next.source)
    throw Error('Synthetic and historical SL trades must not be mixed');
  return {...validated, [next.netPnlGbp > 0 ? 'good' : 'bad']:
    [...validated[next.netPnlGbp > 0 ? 'good' : 'bad'], next]};
}
export function slMemoryStats(memory) {
  const m=validateSLMemory(memory);
  return {market:m.market, good:m.good.length, bad:m.bad.length,
    netPnlGbp:round([...m.good,...m.bad].reduce((s,t)=>s+t.netPnlGbp,0)),
    source:(m.good[0]||m.bad[0])?.source || 'UNTRAINED'};
}
function rng(seed) {
  let a=seed>>>0;
  return ()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};
}
const sigmoid = z => z>=0 ? 1/(1+Math.exp(-z)) : Math.exp(z)/(1+Math.exp(z));
function forward(w,x) {
  const h=w.w1.map((row,j)=>Math.tanh(w.b1[j]+row.reduce((s,v,k)=>s+v*x[k],0)));
  return {h,p:sigmoid(w.b2 + w.w2.reduce((s,v,j)=>s+v*h[j],0))};
}
function modelWeights(random) {
  return {w1:Array.from({length:8},()=>Array.from({length:SL_FEATURES.length},()=> (random()-.5)*.6)),
    b1:Array(8).fill(0), w2:Array.from({length:8},()=> (random()-.5)*.6),b2:0};
}
function evaluate(w, data, threshold) {
  const selected=data.filter(t=>forward(w,t.entryFeatures).p>=threshold);
  const cash=selected.reduce((s,t)=>s+t.netPnlGbp,0);
  let cumulative=0,peak=0,drawdown=0;
  for(const trade of selected){cumulative+=trade.netPnlGbp;peak=Math.max(peak,cumulative);drawdown=Math.max(drawdown,peak-cumulative);}
  return {count:data.length, selected:selected.length, wins:selected.filter(t=>t.netPnlGbp>0).length,
    netPnlGbp:round(cash), alwaysEnterNetGbp:round(data.reduce((s,t)=>s+t.netPnlGbp,0)),
    maxDrawdownGbp:round(drawdown)};
}
export function trainSL(memory, {seed=20261024, epochs=150, learningRate=.022}={}) {
  const m=validateSLMemory(memory);
  if (!SL_ACTIVE_MARKETS.includes(m.market)) throw Error('SL market not yet activated');
  if (!Number.isInteger(seed) || seed<0 || !Number.isInteger(epochs) || epochs<1 || epochs>2000 ||
      !finite(learningRate) || learningRate<=0 || learningRate>.25)
    throw Error('Invalid SL neural training controls');
  const data=[...m.good,...m.bad].sort((a,b)=>Date.parse(a.openedAt)-Date.parse(b.openedAt)||a.id.localeCompare(b.id));
  if (data.length<40) throw Error('SL requires at least 40 chronologically labelled candidate trades per market');
  const cut1=Math.floor(data.length*.6),cut2=Math.floor(data.length*.8);
  const [validationStart,testStart]=[data[cut1],data[cut2]];
  // Purge overlapping positions at chronological split boundaries: no train label can close after validation entries start.
  const train=data.slice(0,cut1).filter(t=>Date.parse(t.closedAt)<Date.parse(validationStart.openedAt));
  const validation=data.slice(cut1,cut2).filter(t=>Date.parse(t.closedAt)<Date.parse(testStart.openedAt));
  const test=data.slice(cut2);
  if (train.length<20 || validation.length<5 || test.length<5 ||
      new Set(train.map(t=>t.netPnlGbp>0)).size<2)
    throw Error('SL requires enough nonoverlapping training, validation and untouched test records with good/bad training labels');
  const random=rng(seed), w=modelWeights(random);
  const magnitudes=train.map(t=>Math.abs(t.netPnlGbp)).sort((a,b)=>a-b);
  const median=magnitudes[Math.floor(magnitudes.length/2)] || 1;
  const weighted=t=>Math.min(4,Math.max(.25,Math.abs(t.netPnlGbp)/median));
  const indices=train.map((_,i)=>i);
  for(let epoch=0;epoch<epochs;epoch++){
    for(let i=indices.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
    for(const index of indices){
      const t=train[index], x=t.entryFeatures,{h,p}=forward(w,x);
      const delta=(p-(t.netPnlGbp>0?1:0))*weighted(t);
      const oldW2=[...w.w2];
      for(let j=0;j<8;j++) w.w2[j]-=learningRate*delta*h[j];
      w.b2-=learningRate*delta;
      for(let j=0;j<8;j++){
        const dz=delta*oldW2[j]*(1-h[j]*h[j]);
        for(let k=0;k<SL_FEATURES.length;k++)w.w1[j][k]-=learningRate*dz*x[k];
        w.b1[j]-=learningRate*dz;
      }
    }
  }
  // A single threshold chosen using validation P&L; untouched test is scored once.
  const choices=[.4,.45,.5,.55,.6,.65,.7,.75,.8,.85];
  const thresholds=choices.map(threshold=>({threshold,...evaluate(w,validation,threshold)}));
  thresholds.sort((a,b)=>b.netPnlGbp-a.netPnlGbp||a.threshold-b.threshold);
  const threshold=thresholds[0].threshold;
  const report={status:'HISTORICAL_RESEARCH_ONLY',source:(m.good[0]||m.bad[0]).source,
    market:m.market, total:data.length, train:train.length, validation:validation.length,
    test:test.length, purged:data.length-train.length-validation.length-test.length,
    validationResults:evaluate(w,validation,threshold), heldOutResults:evaluate(w,test,threshold),
    optimization:'Validation net GBP profit, weighted labels by absolute net GBP; test held untouched',
    limitations:'Candidate-trade sample can have selection bias. Modelled outcomes are not executable P&L. No brokerage orders.'};
  return {model:{strategy:'SL',version:SL_VERSION,market:m.market,features:[...SL_FEATURES],
    threshold, weights:w, trainedThrough:train.at(-1).closedAt, activatedForTrading:false},report};
}
export function predictSL(model, entryFeatures, market=model?.market) {
  if (!model || model.strategy!=='SL' || model.version!==SL_VERSION || model.market!==market ||
      !SL_ACTIVE_MARKETS.includes(market) || model.activatedForTrading!==false ||
      !Array.isArray(entryFeatures) || entryFeatures.length!==SL_FEATURES.length ||
      !entryFeatures.every(x=>finite(x)&&x>=-1&&x<=1)) throw Error('Invalid SL research prediction');
  const p=forward(model.weights,entryFeatures).p;
  if(!finite(p)||!finite(model.threshold)||model.threshold<0||model.threshold>1)throw Error('Invalid SL model');
  return {strategy:'SL',market,profitWeightedScore:Math.round(p*10000)/10000,
    researchDecision:p>=model.threshold?'SELECT':'SKIP', brokerOrderAllowed:false};
}

/**
 * Real feedback for a FUTURE completed simulated opportunity.
 * Updates a frozen, research-only model after the outcome closes. Unlike the
 * fixed historical 60/20/20 experiment, the newest closed trade is included
 * immediately instead of languishing in the shifting sealed 20% tail.
 * An existing historical validation threshold stays frozen; the only honest
 * prospective score is performance logged before these feedback updates.
 */
export function updateSLModelAfterClose(model, trade, {referenceGbp=5,
 learningRate=.012, iterations=12}={}){
 if(!model||model.strategy!=='SL'||model.version!==SL_VERSION||
   model.activatedForTrading!==false||!SL_ACTIVE_MARKETS.includes(model.market)||
   !finite(referenceGbp)||referenceGbp<=0||
   !finite(learningRate)||learningRate<=0||learningRate>.25||
   !Number.isInteger(iterations)||iterations<1||iterations>1000)
  throw Error('Invalid SL incremental learning model/controls');
 const t=checkedTrade(trade,model.market);
 if(!model.weights||!Array.isArray(model.weights.w1)||model.weights.w1.length!==8||
  !Array.isArray(model.weights.w2)||model.weights.w2.length!==8||
  !Array.isArray(model.weights.b1)||model.weights.b1.length!==8||
  !finite(model.weights.b2)||!finite(model.threshold))
  throw Error('Invalid SL neural-network weights');
 const w={w1:model.weights.w1.map(row=>[...row]),b1:[...model.weights.b1],
   w2:[...model.weights.w2],b2:model.weights.b2};
 if(w.w1.some(row=>row.length!==SL_FEATURES.length||!row.every(finite))||
  !w.w2.every(finite)||!w.b1.every(finite))
  throw Error('Invalid SL learning tensor');
 const target=t.netPnlGbp>0?1:0;
 const weight=Math.min(4,Math.max(.25,Math.abs(t.netPnlGbp)/referenceGbp));
 for(let n=0;n<iterations;n++){
  const {p,h}=forward(w,t.entryFeatures);
  const delta=(p-target)*weight;
  const previous=[...w.w2];
  for(let j=0;j<8;j++)w.w2[j]-=learningRate*delta*h[j];
  w.b2-=learningRate*delta;
  for(let j=0;j<8;j++){
   const dz=delta*previous[j]*(1-h[j]*h[j]);
   for(let k=0;k<SL_FEATURES.length;k++)w.w1[j][k]-=learningRate*dz*t.entryFeatures[k];
   w.b1[j]-=learningRate*dz;
  }
 }
 return {...model,weights:w,trainedThrough:t.closedAt,
  incrementalUpdates:(model.incrementalUpdates||0)+1};
}
