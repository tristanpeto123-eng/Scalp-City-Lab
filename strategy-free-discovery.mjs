// Bounded, deterministic strategy INVENTION from independent chart history.
// Not a language model: composes previously unseen, auditable indicator logic
// from primitives. Training-only research; cannot authorize orders or grades.
export const INVENT_VERSION='CHART_COMPOSITE_DISCOVERY_V1';
const ENTRY=['ema_up','rsi_dip','channel_break','volume_surge'];
const EXIT=['ema_down','rsi_recovered','channel_down'];
function seedFromBars(bars){
 let h=2166136261;
 // Only the early discovery slice can seed a candidate search.
 const step=Math.max(1,Math.floor(bars.length/31));
 for(let i=0;i<bars.length;i+=step){
  const x=bars[i];
  for(const ch of String(x.t)+'|'+Number(x.c).toFixed(6)+'|'+Number(x.v).toFixed(3)){
   h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
  }
 }
 return h||1;
}
function random(seed){
 let x=seed>>>0;
 return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296};
}
const choose=(options,rng)=>options[Math.floor(rng()*options.length)];
export function inventCandidates(discoveryBars,{count=16}={}){
 if(!Array.isArray(discoveryBars)||discoveryBars.length<480)
  throw Error('Insufficient early discovery history to invent rules');
 if(!Number.isInteger(count)||count<1||count>24)
  throw Error('Invalid bounded invention budget');
 const rng=random(seedFromBars(discoveryBars));
 const candidates=[],seen=new Set();
 for(let i=0;i<count*40&&candidates.length<count;i++){
  const fast=3+Math.floor(rng()*19);
  const slow=fast+4+Math.floor(rng()*Math.min(60,96-fast-4));
  const period=7+Math.floor(rng()*24);
  const buyBelow=20+Math.floor(rng()*26);
  const sellAbove=50+Math.floor(rng()*30);
  const lookback=10+Math.floor(rng()*55);
  const exitLookback=5+Math.floor(rng()*(lookback-4));
  const first=choose(ENTRY.slice(0,3),rng);
  const second=choose(ENTRY.filter(x=>x!==first),rng);
  const entrySignals=[first,second].sort();
  const params={fast,slow,period,buyBelow,sellAbove,lookback,exitLookback,
   volumeMultiplier:Number((1.1+rng()*1.2).toFixed(2)),
   entrySignals,entryJoin:choose(['all','any'],rng),exitSignal:choose(EXIT,rng)};
  const id=JSON.stringify(params);
  if(seen.has(id))continue;
  seen.add(id);
  candidates.push({strategy:'synth',params,
   label:'Invented '+entrySignals.join(' + ')+' ('+params.entryJoin+') / '+params.exitSignal});
 }
 if(candidates.length!==count)throw Error('Strategy invention budget could not be fulfilled');
 return candidates;
}
