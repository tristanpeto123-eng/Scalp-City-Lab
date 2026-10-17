import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {PAIRS,checkSnapshot,simulateValidation} from './strategy-validation-core.mjs';
import path from 'node:path';
const root=new URL('./validation-data/',import.meta.url);
const known=new Map();
test('all ten preloaded historical crypto markets are real, contiguous and pair-labeled',async()=>{
 assert.equal(PAIRS.length,10);
 for(const symbol of PAIRS){
  const filepath=new URL(symbol.replace('/','-')+'.json',root);
  const data=JSON.parse(await readFile(filepath,'utf8'));
  const parsed=checkSnapshot(data,symbol,Date.now());
  assert.equal(parsed.symbol,symbol);
  assert.ok(parsed.bars.length>=3000&&parsed.bars.length<=10000);
  assert.equal(parsed.source,'ALPACA_KRAKEN_US_US-1');
  assert.ok(parsed.zeroVolumeFraction<=.4);
  known.set(symbol,data);
 }
});
test('duration-limited historical simulations distinguish CASH profit from open unrealised equity',()=>{
 for(const pair of PAIRS){
  const snapshot=known.get(pair);
  for(const strategy of ['ema','rsi','breakout']){
   const run=simulateValidation({snapshot,symbol:pair,startingBalanceGbp:50,
    mode:'duration',limit:14,strategy,now:Date.now()});
   assert.equal(run.status,'DURATION_REACHED');
   assert.equal(run.elapsedDays,14);
   assert.equal(run.calibrationCandles,Math.floor(snapshot.bars.length*.4));
   assert.ok(run.heldOutCandles>=1340&&run.heldOutCandles<=1345);
   assert.ok(run.closedTrades>=0);
   assert.ok(run.winRatePct===null||(run.winRatePct>=0&&run.winRatePct<=100));
   assert.equal(run.actualForwardTradeCount,0);
   assert.equal(run.payoutGuaranteed,false);
   assert.ok(Math.abs(run.realizedNetProfitGbp-(run.cashBalanceGbp+run.openPositionInitialCostGbp-50))<.021);
   assert.ok(Math.abs(run.trades.reduce((s,t)=>s+t.netGbp,0)-run.realizedNetProfitGbp)<.07);
  }
 }
});
test('profit limit is cumulative and never reported as achieved from unrealised gains',()=>{
 const b=known.get('BTC/USD');
 const r=simulateValidation({snapshot:b,symbol:'BTC/USD',
  startingBalanceGbp:50,mode:'profit',limit:2000,strategy:'ema',
  now:Date.now()});
 assert.equal(r.status,'HISTORY_EXHAUSTED');
 assert.equal(r.goalReached,false);
 assert.equal(r.actualForwardTradeCount,0);
 assert.equal(r.openPositionInitialCostGbp>0,r.openPosition);
 const other=simulateValidation({snapshot:b,symbol:'BTC/USD',
  startingBalanceGbp:250,mode:'duration',limit:3,strategy:'rsi',
  now:Date.now()});
 assert.equal(other.startingBalanceGbp,250);
 assert.ok(Math.abs(other.realizedNetProfitGbp-(other.cashBalanceGbp+other.openPositionInitialCostGbp-250))<.025);
 assert.ok(other.heldOutCandles>0);
});
test('input and snapshot provenance failures fail closed',()=>{
 const s=known.get('BTC/USD'),base={snapshot:s,symbol:'BTC/USD',mode:'duration',limit:3};
 assert.throws(()=>simulateValidation({...base,startingBalanceGbp:49}),/£50/);
 assert.throws(()=>simulateValidation({...base,startingBalanceGbp:50,mode:'profit',limit:0}),/Invalid/);
 assert.throws(()=>simulateValidation({...base,startingBalanceGbp:50,mode:'duration',limit:1.5}),/Invalid/);
 assert.throws(()=>simulateValidation({...base,startingBalanceGbp:50,strategy:'imaginary'}),/Unknown/);
 assert.throws(()=>simulateValidation({...base,startingBalanceGbp:50,symbol:'ETH/USD'}),/mismatched/);
 assert.throws(()=>checkSnapshot({...s,source:'unknown'},'BTC/USD'),/Unverified/);
 assert.throws(()=>checkSnapshot({...s,bars:s.bars.slice(0,300)},'BTC/USD'),/insufficient/);
 const bad={...s,bars:s.bars.map((b,i)=>i===10?{...b,t:'2026-01-01T00:00:00Z'}:b)};
 assert.throws(()=>checkSnapshot(bad,'BTC/USD'),/noncontiguous/);
 const noVolume={...s,bars:s.bars.map((b,i)=>i<3000?{...b,v:0}:b)};
 assert.throws(()=>checkSnapshot(noVolume,'BTC/USD'),/zero-volume/);
});
test('page preloads ten snapshots and refreshes latest published Alpaca data safely',async()=>{
 const h=await readFile(new URL('./strategy-validation.html',import.meta.url),'utf8');
 assert.match(h,/loadPair\(\)/);
 assert.match(h,/validation-data\//);
 assert.match(h,/fetch\(url,/);
 assert.match(h,/Load newest published Alpaca data/);
 assert.match(h,/\?refresh=/);
 assert.match(h,/stale/);
 assert.match(h,/credentials:'omit'/);
 assert.match(h,/strategy-validation-core\.mjs/);
 assert.doesNotMatch(h,/fetchAlpacaDirect/);
 assert.doesNotMatch(h,/https:\/\/data\.alpaca\.markets\/v1beta3\/crypto\/us-1\/bars/);
 assert.doesNotMatch(h,/APCA-API-SECRET-KEY/);
 assert.doesNotMatch(h,/APCA-API-KEY-ID/);
 assert.doesNotMatch(h,/type="file"/);
 assert.doesNotMatch(h,/paperOrder\(/);
 assert.doesNotMatch(h,/submitOrder\(/);
});
