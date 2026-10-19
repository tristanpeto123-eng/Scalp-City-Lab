import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inventCandidates} from './strategy-free-discovery.mjs';
import {screenChart,validateAdaptive} from './strategy-adaptive-model.mjs';
import {simulateValidation} from './strategy-validation-core.mjs';

const sample=async(symbol='BTC/USD')=>JSON.parse(await readFile(
 new URL('./validation-data/'+symbol.replace('/','-')+'.json',import.meta.url),'utf8'));

test('strategy invention is bounded, deterministic and composed instead of choosing preset rules',async()=>{
 const source=await sample(),before=source.bars.slice(0,Math.floor(source.bars.length*.2));
 const a=inventCandidates(before),b=inventCandidates(before);
 assert.deepEqual(a,b);
 assert.equal(a.length,16);
 assert.ok(a.every(x=>x.strategy==='synth'&&x.params.entrySignals.length===2));
 assert.equal(new Set(a.map(x=>JSON.stringify(x.params))).size,a.length);
 assert.notDeepEqual(a.map(x=>x.params),inventCandidates((await sample('ETH/USD')).bars.slice(0,before.length)).map(x=>x.params));
 assert.throws(()=>inventCandidates(before,{count:100}),/budget/);
 assert.throws(()=>inventCandidates(before.slice(0,300)),/Insufficient/);
});

test('invented rules run in the SAME protected offline simulator and reject arbitrary instructions',async()=>{
 const source=await sample(),base={snapshot:source,symbol:'BTC/USD',startingBalanceGbp:50};
 const p=inventCandidates(source.bars.slice(0,Math.floor(source.bars.length*.2)))[0].params;
 const r=simulateValidation({...base,mode:'duration',limit:2,strategy:'synth',strategyParams:p,feePerSideFraction:.0025});
 assert.equal(r.strategy,'synth');
 assert.deepEqual(r.strategyParams,p);
 assert.equal(r.actualForwardTradeCount,0);
 assert.equal(r.payoutGuaranteed,false);
 assert.ok(r.closedTrades>=0);
 assert.throws(()=>simulateValidation({...base,strategy:'synth',strategyParams:{...p,entrySignals:['eval','ema_up']}}),/Invalid invented/);
 assert.throws(()=>simulateValidation({...base,strategy:'synth',strategyParams:{...p,exitSignal:'custom_js'}}),/Invalid invented/);
 assert.throws(()=>simulateValidation({...base,strategy:'synth',strategyParams:{...p,fast:1000}}),/Invalid invented/);
});

test('invention never sees held-out prices when proposing or choosing a model',async()=>{
 const source=await sample(),cutoff=Math.floor(source.bars.length*.4);
 const changed={...source,bars:source.bars.map((b,i)=>i<cutoff?b:
  {...b,o:b.o*1.17,h:b.h*1.17,l:b.l*1.17,c:b.c*1.17})};
 const original=screenChart({snapshot:source,symbol:'BTC/USD',strategyMode:'invent'});
 const revised=screenChart({snapshot:changed,symbol:'BTC/USD',strategyMode:'invent'});
 assert.equal(original.strategyMode,'invent');
 assert.equal(original.candidates.length,16);
 assert.deepEqual(original.candidates,revised.candidates);
 assert.deepEqual(original.selected,revised.selected);
 assert.deepEqual(original.behavior,revised.behavior);
 assert.deepEqual(original.trainingWindows,revised.trainingWindows);
 assert.equal(original.outerHoldoutIntact,true);
 assert.equal(original.usesOtherPairsTraining,false);
 assert.equal(original.scoreDerivedFromOuterEvaluation,false);
 assert.equal(original.explanations.length,5);
 assert.equal(original.learningType,'TRAINING_ONLY_COMPOSITE_RULE_INVENTION_NOT_NEURAL_AI');
});

test('invention may abstain and cannot graduate itself or submit paper/live orders',async()=>{
 const source=await sample();
 const r=validateAdaptive({snapshot:source,symbol:'BTC/USD',strategyMode:'invent'});
 assert.equal(r.brokerOrders,0);
 assert.equal(r.predictedGuaranteedProfit,false);
 if(r.replay){
  assert.equal(r.model.selected.strategy,'synth');
  assert.equal(r.replay.actualForwardTradeCount,0);
  assert.equal(r.checker.eligibleForBrokerExecution,false);
  assert.equal(r.checker.independentForwardValidated,false);
 }else{
  assert.equal(r.model.selected,null);
  assert.equal(r.model.status,'ABSTAIN_NO_POSITIVE_EDGE_AFTER_FEES');
 }
 const price=source.bars[0].c;
 const flat={...source,bars:source.bars.map(b=>({...b,o:price,c:price,h:price+.01,l:price-.01,v:1}))};
 const abstain=validateAdaptive({snapshot:flat,symbol:'BTC/USD',strategyMode:'invent'});
 assert.equal(abstain.model.selected,null);
 assert.equal(abstain.replay,null);
 assert.equal(abstain.brokerOrders,0);
 assert.throws(()=>screenChart({snapshot:source,symbol:'BTC/USD',strategyMode:'execute-anything'}),/Unknown strategy creation mode/);
});

test('browser UI exposes both strategies and reports invented rule provenance',async()=>{
 const html=await readFile(new URL('./strategy-validation.html',import.meta.url),'utf8');
 assert.match(html,/value="auto"/);
 assert.match(html,/value="invent"/);
 assert.match(html,/strategyMode:choice==='invent'\?'invent':'preset'/);
 assert.match(html,/Rules frozen before the holdout replay/);
 assert.doesNotMatch(html,/APCA-API-SECRET-KEY/);
 assert.doesNotMatch(html,/submitOrder\(/);
});
