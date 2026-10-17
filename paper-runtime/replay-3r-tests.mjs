import assert from 'node:assert/strict';
import {replayHistorical,loadHistoricalCrypto} from './replay-3r.mjs';
import {R3} from './learning-3r.mjs';
const start=Date.parse('2026-01-01T00:00:00Z'),step=15*60000;
function bars(length=1200){
 let prior=100;
 return Array.from({length},(_,i)=>{
  const o=prior,c=100+18*Math.sin(i/6)+3*Math.sin(i/17);
  const h=Math.max(o,c)*1.001,l=Math.min(o,c)*.999;
  prior=c;
  return {t:new Date(start+i*step).toISOString(),o,h,l,c,v:1000};
 });
}
let n=0;
const raw=bars(),a=replayHistorical({symbol:'BTC/USD',raw,closedBefore:start+(raw.length+2)*step});
assert.equal(a.mode,'HISTORICAL_AS_LIVE_REPLAY_NOT_FORWARD');n++;
assert.equal(a.virtualStartGbp,50);n++;
assert.equal(a.plannedRR,3);n++;
assert.equal(a.evaluation.actualLiveForwardTradeCount,0);n++;
assert.equal(a.trainOnlySelection.calibrationBars,480);n++;
assert.equal(a.evaluation.bars,720);n++;
assert.equal(a.trainOnlySelection.independentHoldout.segment[1],480);n++;
assert.equal(a.barsProcessed,1200);n++;
assert.equal(a.closedTradeEvidence.length,a.evaluation.closedTrades);n++;
assert.ok(['REPLAY_EVALUATED','CALIBRATION_REJECTED'].includes(a.evaluation.status));n++;
assert.ok(a.closedTradeEvidence.every(t=>t.source==='HISTORICAL_REPLAY'));n++;
assert.ok(a.closedTradeEvidence.every(t=>Date.parse(t.entry)>=start+480*step));n++;
assert.ok(a.closedTradeEvidence.every(t=>t.exit==='TAKE_PROFIT'||t.exit==='STOP'));n++;
assert.ok(a.closedTradeEvidence.every(t=>t.fees==='MODELED_NOT_POSTED'));n++;
assert.equal(a.evaluation.candidateFrozen,a.trainOnlySelection.eligible);n++;
// Mutating only the unseen evaluation cannot change the parameters,
 // calibration training scores, or calibration verdict.
const distorted=raw.map((b,i)=>i<480?{...b}:{...b,o:b.o*.8,h:b.h*1.6,l:b.l*.5,c:b.c*1.3});
const b=replayHistorical({symbol:'BTC/USD',raw:distorted,closedBefore:start+(raw.length+2)*step});
assert.deepEqual(a.trainOnlySelection,b.trainOnlySelection);n++;
assert.equal(b.evaluation.actualLiveForwardTradeCount,0);n++;
assert.notEqual(a.dataFingerprint,b.dataFingerprint);n++;
assert.throws(()=>replayHistorical({symbol:'SOL/USD',raw}),/Invalid/);n++;
assert.throws(()=>replayHistorical({symbol:'BTC/USD',raw:raw.slice(0,200)}),/480/);n++;
const duplicate=raw.map(x=>({...x}));duplicate[700].t=duplicate[699].t;
assert.throws(()=>replayHistorical({symbol:'BTC/USD',raw:duplicate}),/bad or duplicated/);n++;
const future=raw.map(x=>({...x}));
assert.throws(()=>replayHistorical({symbol:'BTC/USD',raw:future,closedBefore:start+300*step}),/Future/);n++;
const invalid=raw.map(x=>({...x}));invalid[2].h=invalid[2].l*.8;
assert.throws(()=>replayHistorical({symbol:'BTC/USD',raw:invalid}),/bad or duplicated/);n++;
assert.equal(R3.rewardToRisk,3);n++;
// Provenance-proof pagination from GET-only API: first page + next_page_token.
const mockRequest=[];
const broker={req:async(base,url)=>{
 mockRequest.push({base,url});
 const page=new URL('http://localhost'+url).searchParams.get('page_token');
 if(!page)return {bars:{'BTC/USD':raw.slice(0,500)},next_page_token:'next-page'};
 return {bars:{'BTC/USD':raw.slice(500)},next_page_token:null};
}};
const loaded=await loadHistoricalCrypto({broker,symbol:'BTC/USD',days:30,now:start+(raw.length+10)*step});
assert.equal(loaded.fetchedPages,2);n++;
assert.equal(loaded.raw.length,1200);n++;
assert.ok(mockRequest.every(x=>x.base==='https://data.alpaca.markets'));n++;
assert.ok(mockRequest.every(x=>x.url.startsWith('/v1beta3/crypto/us/bars?')));n++;
assert.ok(mockRequest.every(x=>x.url.includes('symbols=BTC%2FUSD')));n++;
let calls=0;
await assert.rejects(loadHistoricalCrypto({broker:{req:async()=>{
 calls++;return {bars:{'BTC/USD':[]},next_page_token:'SAME'};}},symbol:'BTC/USD',days:30,now:start+500*step}),/Repeated/);n++;
await assert.rejects(loadHistoricalCrypto({broker:{req:async()=>{
 return {bars:{'BTC/USD':[]},next_page_token:'NEXT'};}},symbol:'ETH/USD',days:30,maximumPages:1,now:start+500*step}),/omitted/);n++;
assert.ok(a.trainOnlySelection.trainOptions.every(x=>x.params.fast<x.params.slow));n++;
console.log('PASS '+n+' chronological historical-as-live replay and anti-lookahead checks; no real forward results');
