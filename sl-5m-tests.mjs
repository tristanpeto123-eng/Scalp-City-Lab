import assert from 'node:assert/strict';
import {parseSLFiveMinuteCSV, validateSLFiveMinuteBars, buildSLFiveMinuteDataset, SL_FIVE_MIN_MS} from './sl-5m.mjs';
import {createSLMemory,validateSLMemory,trainSL,predictSL} from './sl-core.mjs';

const start=Date.parse('2025-03-03T00:00:00Z');
const bars=Array.from({length:1200},(_,i)=>{
 const o=1950+Math.sin(i*.22)*9+Math.cos(i*.034)*15+i*.003;
 const c=o+(Math.sin(i*.45)+Math.cos(i*.16))*.85;
 return {t:new Date(start+i*SL_FIVE_MIN_MS).toISOString(),
  o,h:Math.max(o,c)+.55,l:Math.min(o,c)-.55,c,v:95+(i%21)*3};
});
const csv=['time,open,high,low,close,volume',...bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v].join(','))].join('\n');
const parsed=parseSLFiveMinuteCSV(csv);
assert.deepEqual(parsed,bars);
const markets=['COMMODITIES','FOREX','INDICES'];
for(const market of markets){
 const ds=buildSLFiveMinuteDataset({bars:parsed,market,symbol:market==='COMMODITIES'?'XAUUSD':market==='FOREX'?'EURUSD':'US100',holdCandles:3,sideCostBps:4,virtualNotionalGbp:1000});
 assert.equal(ds.timeframe,'5Min');
 assert.equal(ds.feed,'USER_IMPORTED_UNVERIFIED_5MIN');
 assert.equal(ds.gaps,0);
 assert.ok(ds.opportunities.length>=40);
 assert.ok(ds.opportunities.some(o=>o.trade.netPnlGbp>0),'positive labels exist');
 assert.ok(ds.opportunities.some(o=>o.trade.netPnlGbp<0),'negative labels exist');
 assert.ok(ds.opportunities.every(o=>o.trade.market===market&&o.trade.source==='HISTORICAL_RESEARCH'));
 for(const o of ds.opportunities){
  assert.equal(o.entryIndex,o.signalIndex+1);
  assert.equal(o.exitIndex,o.entryIndex+3);
  assert.equal(o.trade.openedAt,ds.bars[o.entryIndex].t);
  assert.equal(o.trade.closedAt,ds.bars[o.exitIndex].t);
  assert.ok(o.trade.entryFeatures.every(x=>x>=-1&&x<=1));
  const expected=1000*(o.side*(ds.bars[o.exitIndex].o/ds.bars[o.entryIndex].o-1)-.0008);
  assert.ok(Math.abs(o.trade.netPnlGbp-expected)<1e-8,'net GBP incorporates both modeled costs');
 }
 const good=ds.opportunities.map(x=>x.trade).filter(x=>x.netPnlGbp>0);
 const bad=ds.opportunities.map(x=>x.trade).filter(x=>x.netPnlGbp<0);
 const m=validateSLMemory({...createSLMemory(market),good,bad});
 const trained=trainSL(m);
 assert.equal(trained.model.market,market);
 assert.equal(trained.report.source,'HISTORICAL_RESEARCH');
 assert.ok(trained.report.heldOutResults.count>=5);
 assert.equal(trained.model.activatedForTrading,false);
 assert.equal(predictSL(trained.model,ds.opportunities.at(-1).trade.entryFeatures,market).brokerOrderAllowed,false);
}
const base=buildSLFiveMinuteDataset({bars:parsed,market:'COMMODITIES',symbol:'XAUUSD'});
const first=base.opportunities[0],futureIndex=first.exitIndex;
const changed=bars.map(x=>({...x}));
changed[futureIndex].o*=1.01;
changed[futureIndex].h=Math.max(changed[futureIndex].h,changed[futureIndex].o+.3);
const mutated=buildSLFiveMinuteDataset({bars:changed,market:'COMMODITIES',symbol:'XAUUSD'});
assert.deepEqual(mutated.opportunities[0].trade.entryFeatures,first.trade.entryFeatures,'features cannot use future bars');
assert.notEqual(mutated.opportunities[0].trade.netPnlGbp,first.trade.netPnlGbp,'future exit affects label, not input');
const costly=buildSLFiveMinuteDataset({bars:parsed,market:'COMMODITIES',symbol:'XAUUSD',sideCostBps:50});
assert.ok(costly.opportunities.reduce((s,x)=>s+x.trade.netPnlGbp,0) < base.opportunities.reduce((s,x)=>s+x.trade.netPnlGbp,0));
assert.throws(()=>buildSLFiveMinuteDataset({bars:parsed,market:'CRYPTO',symbol:'BTCUSD'}),/not active/);
assert.throws(()=>buildSLFiveMinuteDataset({bars:parsed,market:'FOREX',symbol:'gold & silver'}),/market symbol/);
assert.throws(()=>buildSLFiveMinuteDataset({bars:parsed,market:'COMMODITIES',symbol:'XAUUSD',holdCandles:0}),/Invalid/);
assert.throws(()=>buildSLFiveMinuteDataset({bars:parsed,market:'COMMODITIES',symbol:'XAUUSD',sideCostBps:-1}),/Invalid/);
assert.throws(()=>validateSLFiveMinuteBars(bars.slice(0,100)),/150/);
assert.throws(()=>validateSLFiveMinuteBars([...bars.slice(0,40),bars[39],...bars.slice(40)]),/unordered, duplicated/);
assert.throws(()=>validateSLFiveMinuteBars(bars.map((b,i)=>i===20?{...b,h:b.l-2}:b)),/invalid candle/);
assert.throws(()=>validateSLFiveMinuteBars(bars.map((b,i)=>i===20?{...b,t:new Date(Date.parse(b.t)+1).toISOString()}:b)),/invalid candle|off the 5-minute grid/);
assert.throws(()=>parseSLFiveMinuteCSV(csv.replace(bars[0].t,'03/03/2025 00:00')),/ISO dates/);
const novol=['time,open,high,low,close',...bars.map(b=>[b.t,b.o,b.h,b.l,b.c].join(','))].join('\n');
assert.ok(parseSLFiveMinuteCSV(novol).every(b=>b.v===null));
const gapBars=bars.map((b,i)=>i>=650?{...b,t:new Date(Date.parse(b.t)+86400000).toISOString()}:b);
const gapDS=buildSLFiveMinuteDataset({bars:gapBars,market:'COMMODITIES',symbol:'XAUUSD'});
assert.equal(gapDS.gaps,1);
assert.ok(gapDS.opportunities.every(o=>o.exitIndex<650||o.signalIndex>=675),'no trade crosses gap or insufficient new warmup');
assert.throws(()=>validateSLFiveMinuteBars(bars.map(b=>({...b,t:new Date(Date.parse(b.t)+10*365*86400000).toISOString()}))),/future/);
console.log('SL 5m checks passed: authentic CSV ingestion, 5m grid, gap reset, causal features, next-open fills, cost-aware labels, 3 market students, holdout, no orders');
