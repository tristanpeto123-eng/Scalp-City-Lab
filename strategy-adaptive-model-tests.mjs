import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PAIRS,simulateValidation} from './strategy-validation-core.mjs';
import {AUTO_CANDIDATES,screenChart,validateAdaptive,chartBehavior} from './strategy-adaptive-model.mjs';
const root=new URL('./validation-data/',import.meta.url);
const snapshots=new Map();
test('all ten crypto pairs support independently frozen training-only strategy research',async()=>{
 assert.equal(PAIRS.length,10);
 assert.equal(AUTO_CANDIDATES.length,8);
 for(const symbol of PAIRS){
  const source=JSON.parse(await readFile(new URL(symbol.replace('/','-')+'.json',root),'utf8'));
  snapshots.set(symbol,source);
  const model=screenChart({snapshot:source,symbol,startingBalanceGbp:50});
  assert.equal(model.modelId,'CHART_'+symbol.replace('/',''));
  assert.equal(model.symbol,symbol);
  assert.equal(model.outerHoldoutIntact,true);
  assert.equal(model.usesOtherPairsTraining,false);
  assert.equal(model.scoreDerivedFromOuterEvaluation,false);
  assert.equal(model.candidates.length,8);
  assert.equal(model.explanations.length,5);
  assert.ok(model.explanations.every(x=>x.agent&&x.method&&x.evidence&&x.decision));
  assert.equal(model.trainingWindows.discovery.count,Math.floor(source.bars.length*.2));
  assert.equal(model.trainingWindows.confirmation.count,
   Math.floor(source.bars.length*.4)-Math.floor(source.bars.length*.2));
  assert.equal(model.trainingWindows.evaluation.count,
   source.bars.length-Math.floor(source.bars.length*.4));
  const result=validateAdaptive({snapshot:source,symbol,startingBalanceGbp:50,
   mode:'duration',limit:14});
  assert.equal(result.brokerOrders,0);
  assert.equal(result.model.modelId,model.modelId);
  if(result.replay){
   assert.ok(['HOLDOUT_REJECTED','HOLDOUT_POSITIVE_RESEARCH_ONLY_NOT_FORWARD_VALIDATED'].includes(result.status));
   assert.equal(result.checker.eligibleForBrokerExecution,false);
   assert.equal(result.checker.independentForwardValidated,false);
   if(result.replay.realizedNetProfitGbp<=0||result.replay.closedTrades<20)
    assert.equal(result.status,'HOLDOUT_REJECTED');
   assert.equal(result.replay.symbol,symbol);
   assert.equal(result.replay.strategy,result.model.selected.strategy);
   assert.deepEqual(result.replay.strategyParams,result.model.selected.params);
   assert.equal(result.replay.actualForwardTradeCount,0);
   assert.equal(result.replay.payoutGuaranteed,false);
   assert.equal(Date.parse(result.replay.validationPeriod.start),Date.parse(model.trainingWindows.evaluation.start));
  }else{
   assert.equal(result.status,'ABSTAIN_NO_POSITIVE_EDGE_AFTER_FEES');
   assert.equal(result.model.selected,null);
  }
  console.log('PAIR_ADAPTIVE_RESEARCH '+JSON.stringify({
   symbol,status:result.status,
   selected:model.selected?.label||null,
   candidates:model.candidates.length,
   bestConfirmationNet:model.candidates[0]?.confirmation.netGbp,
   bestStressNet:model.candidates[0]?.doubledFee.netGbp,
   holdoutClosedTrades:result.replay?.closedTrades??null,
   holdoutWinRatePct:result.replay?.winRatePct??null,
   holdoutNetGbp:result.replay?.realizedNetProfitGbp??null,
   holdoutDrawdownPct:result.replay?.maxDrawdownPct??null,
   checkerReasons:result.checker?.reasons??[],
   actualForwardTrades:0
  }));
 }
});
test('future held-out price changes NEVER influence pair selection',()=>{
 const sample=snapshots.get('BTC/USD');
 const cutoff=Math.floor(sample.bars.length*.4);
 const corrupted={...sample,bars:sample.bars.map((b,i)=>{
  if(i<cutoff)return b;
  return {...b,o:b.o*1.2,c:b.c*1.2,h:b.h*1.2,l:b.l*1.2};
 })};
 const base=screenChart({snapshot:sample,symbol:'BTC/USD'});
 const changed=screenChart({snapshot:corrupted,symbol:'BTC/USD'});
 assert.deepEqual(changed.candidates,base.candidates);
 assert.deepEqual(changed.behavior,base.behavior);
 assert.deepEqual(changed.selected,base.selected);
 assert.deepEqual(changed.trainingWindows,base.trainingWindows);
});
test('different pairs do not share training outcomes',()=>{
 const eth=screenChart({snapshot:snapshots.get('ETH/USD'),symbol:'ETH/USD'});
 const btc=screenChart({snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD'});
 const btcRerun=screenChart({snapshot:snapshots.get('BTC/USD'),symbol:'BTC/USD'});
 assert.deepEqual(btc,btcRerun);
 assert.notEqual(eth.modelId,btc.modelId);
 assert.notDeepEqual(eth.behavior,btc.behavior);
});
test('nothing improves by fabricating history, an unauthorized pair or weak evidence',()=>{
 const btc=snapshots.get('BTC/USD');
 assert.throws(()=>screenChart({snapshot:btc,symbol:'SOL/USD'}),/mismatched|missing/);
 assert.throws(()=>screenChart({snapshot:btc,symbol:'SOL/USDT'}),/Unknown/);
 assert.throws(()=>screenChart({snapshot:btc,symbol:'BTC/USD',startingBalanceGbp:20}),/£50/);
 const short={...btc,bars:btc.bars.slice(0,900)};
 const result=validateAdaptive({snapshot:short,symbol:'BTC/USD',mode:'duration',limit:2});
 assert.equal(result.replay,null);
 assert.equal(result.model.status,'INSUFFICIENT_INDEPENDENT_TRAINING');
 const zeros={...btc,bars:btc.bars.map((b,i)=>i<3500?{...b,v:0}:b)};
 assert.throws(()=>screenChart({snapshot:zeros,symbol:'BTC/USD'}),/zero-volume/);
});
test('manual strategies allow fixed parameters and twice-fee stress but retain strict bounds',()=>{
 const btc=snapshots.get('BTC/USD'),opts={
  snapshot:btc,symbol:'BTC/USD',startingBalanceGbp:50,mode:'duration',limit:7
 };
 const e=simulateValidation({...opts,strategy:'ema',strategyParams:{fast:5,slow:21}});
 assert.deepEqual(e.strategyParams,{fast:5,slow:21});
 assert.equal(e.feePerSideFraction,.005);
 const e2=simulateValidation({...opts,strategy:'ema',strategyParams:{fast:5,slow:21},
  feePerSideFraction:.01});
 assert.equal(e2.feePerSideFraction,.01);
 const tier1=simulateValidation({...opts,strategy:'ema',strategyParams:{fast:5,slow:21},
  feePerSideFraction:.0025});
 assert.equal(tier1.feePerSideFraction,.0025);
 assert.match(tier1.costAssumption,/0.25%/);
 assert.ok(e2.cashBalanceGbp>=0);
 const r=simulateValidation({...opts,strategy:'rsi',
  strategyParams:{period:14,buyBelow:25,sellAbove:60}});
 assert.deepEqual(r.strategyParams,{period:14,buyBelow:25,sellAbove:60});
 const b=simulateValidation({...opts,strategy:'breakout',
  strategyParams:{lookback:60,exitLookback:30}});
 assert.deepEqual(b.strategyParams,{lookback:60,exitLookback:30});
 assert.throws(()=>simulateValidation({...opts,strategy:'ema',strategyParams:{fast:50,slow:20}}),/Invalid EMA/);
 assert.throws(()=>simulateValidation({...opts,strategy:'rsi',
  strategyParams:{period:14,buyBelow:80,sellAbove:30}}),/Invalid RSI/);
 assert.throws(()=>simulateValidation({...opts,strategy:'breakout',
  strategyParams:{lookback:20,exitLookback:40}}),/Invalid channel/);
 assert.throws(()=>simulateValidation({...opts,strategy:'ema',feePerSideFraction:0}),/fee/);
 assert.throws(()=>simulateValidation({...opts,strategy:'ema',feePerSideFraction:.025}),/fee/);
});
test('constant/flat markets are not portrayed as profitable intelligence',()=>{
 const btc=snapshots.get('BTC/USD'),anchor=btc.bars[0].c;
 const flat={...btc,bars:btc.bars.map(b=>({...b,o:anchor,h:anchor+.001,l:anchor-.001,c:anchor,v:1}))};
 const model=screenChart({snapshot:flat,symbol:'BTC/USD'});
 assert.equal(model.selected,null);
 assert.equal(model.status,'ABSTAIN_NO_POSITIVE_EDGE_AFTER_FEES');
 assert.ok(model.candidates.every(c=>c.rejection.length>0));
 assert.equal(chartBehavior(flat.bars.slice(0,Math.floor(flat.bars.length*.4))).regime,'MIXED');
});
test('page exposes adaptive option and reports rejection without placing orders',async()=>{
 const page=await readFile(new URL('./strategy-validation.html',import.meta.url),'utf8');
 assert.match(page,/value="auto"/);
 assert.match(page,/validateAdaptive/);
 assert.match(page,/modelExplanation/);
 assert.match(page,/NO QUALIFYING STRATEGY/);
 assert.match(page,/localStorage/);
 assert.match(page,/same historical window not double-counted/);
 assert.doesNotMatch(page,/paperOrder\s*\(/);
 assert.doesNotMatch(page,/APCA-API-SECRET-KEY/);
});
