import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext,Script} from 'node:vm';
const html=await readFile(new URL('../market-replay-5m.html',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(js);
const origin=Date.UTC(2026,9,8,16);
const candles=Array.from({length:35},(_,i)=>({
 t:origin+i*300000,o:100,h:101,l:99,c:100,v:100
}));
function fixture(actions){
 return {schema:'SCALP_CAUSAL_REPLAY_5MIN_V1',symbol:'BTC/USD',timeframe:'5Min',
  source:'ALPACA_KRAKEN_US_US-1',historicalOnly:true,futureCandlesVisibleAtOnce:false,
  heldOutQuarantineTouched:false,paperOrders:0,liveOrders:0,fillsAreSimulated:true,
  warmupCandleCount:33,candles,decisions:actions.map((x,i)=>({
   observedCandleTime:candles[32+i].t,nextCandleTime:candles[33+i].t,
   nextOpenPrice:100,reward:0,equityGbp:50,simulatedClosedTrades:x.closed||0,
   action:x.action,openPosition:x.held
  }))}
}
function env(){
 const nodes=new Map(),stored=new Map();
 const context2d=new Proxy({},{
  get(target,p){return target[p]??(()=>{});},
  set(target,p,v){target[p]=v;return true;}
 });
 const el=id=>{
  if(!nodes.has(id))nodes.set(id,{
   id,textContent:'',disabled:false,hidden:false,children:[],
   replaceChildren(){this.children=[];},
   append(child){this.children.push(child);},
   getBoundingClientRect(){return {width:320,height:290};},
   getContext(){return context2d;}
  });
  return nodes.get(id);
 };
 const document={
  getElementById:el,
  createElement:tag=>({
   tag,textContent:'',className:'',children:[],
   append(child){this.children.push(child);},
   remove(){},click(){}
  }),
  body:{append(){}}
 };
 const context=createContext({
  document,window:{devicePixelRatio:1,addEventListener(){}},
  localStorage:{setItem(k,v){stored.set(k,v);},getItem(k){return stored.get(k)??null;}},
  setInterval:()=>1,clearInterval(){},setTimeout(fn){fn();},
  console,URL:{createObjectURL(){return 'blob:mock';},revokeObjectURL(){}},
  Blob:class{},fetch:async()=>{throw Error('not in test');}
 });
 runInContext(js,context);
 return {context,nodes,stored};
}
function journalFixture(){
 const data=fixture([{action:'LONG',held:true,closed:0},
                      {action:'FLAT',held:false,closed:1}]);
 const slip=.001,fee=.0025,notional=25/(1+fee);
 const execBuy=100*(1+slip),quantity=notional/execBuy,entryCost=notional*(1+fee);
 const execSell=100*(1-slip),sellGross=quantity*execSell,sellFee=sellGross*fee;
 const proceeds=sellGross-sellFee,pnl=proceeds-entryCost;
 data.tradeJournalSchema='SCALP_VIRTUAL_TRADE_JOURNAL_V1';
 data.marketPriceCurrency='USD';data.accountingCurrency='VIRTUAL_UNITS';
 data.simulatedFeeRate=fee;data.simulatedSlippageRate=slip;
 data.startingVirtualBalance=50;data.policySha256='a'.repeat(64);
 data.decisions[0].executionSide='BUY';data.decisions[0].executionPriceUsd=execBuy;
 data.decisions[1].executionSide='SELL';data.decisions[1].executionPriceUsd=execSell;
 data.virtualFills=[
   {side:'BUY',candleTime:candles[33].t,sourceDecisionTime:candles[32].t,
    closedCandleTime:candles[33].t,marketOpenPriceUsd:100,executionPriceUsd:execBuy,
    quantityCrypto:quantity,feeVirtual:notional*fee,costVirtual:entryCost,
    marketCurrency:'USD',accountingCurrency:'VIRTUAL_UNITS'},
   {side:'SELL',candleTime:candles[34].t,sourceDecisionTime:candles[33].t,
    closedCandleTime:candles[34].t,marketOpenPriceUsd:100,executionPriceUsd:execSell,
    quantityCrypto:quantity,feeVirtual:sellFee,proceedsVirtual:proceeds,
    entryCostVirtual:entryCost,realizedProfitVirtual:pnl,
    marketCurrency:'USD',accountingCurrency:'VIRTUAL_UNITS'}
 ];
 data.closedTrades=[{tradeOrdinal:1,symbol:'BTC/USD',entryTime:candles[33].t,
   exitTime:candles[34].t,entryExecutionPriceUsd:execBuy,exitExecutionPriceUsd:execSell,
   quantityCrypto:quantity,entryCostVirtual:entryCost,exitProceedsVirtual:proceeds,
   netProfitVirtual:pnl,netReturnPct:100*pnl/entryCost,
   outcome:'LOSS',marketCurrency:'USD',accountingCurrency:'VIRTUAL_UNITS'}];
 data.openVirtualEntry=null;
 data.decisions[1].equityGbp=50+pnl;
 return data;
}
test('legacy FLAT displays no executed order despite next opening price',()=>{
 const {context,nodes}=env();
 context.fixture=fixture([{action:'FLAT',held:false},{action:'FLAT',held:false}]);
 runInContext("trace=validate(fixture,'BTC/USD');index=34;render()",context);
 assert.equal(nodes.get('fill').textContent,'No order');
 assert.equal(nodes.get('closes').textContent,'0');
 assert.equal(nodes.get('tradeRows').children.length,0);
 assert.match(nodes.get('journalEmpty').textContent,/No entries or exits/);
 assert.equal(nodes.get('export').disabled,true);
 assert.match(nodes.get('legacyNotice').hidden.toString(),/false/);
});
test('verified entry/exit appears in cards and persistent closed-trade table',()=>{
 const {context,nodes,stored}=env();
 context.fixture=journalFixture();
 runInContext("trace=validate(fixture,'BTC/USD');index=33;render()",context);
 assert.match(nodes.get('fill').textContent,/BUY \$100/);
 assert.equal(nodes.get('tradeRows').children.length,0);
 assert.equal(nodes.get('eventRows').children.length,1);
 assert.match(nodes.get('position').textContent,/LONG open/);
 runInContext('index=34;render()',context);
 assert.match(nodes.get('fill').textContent,/SELL \$99/);
 assert.equal(nodes.get('tradeRows').children.length,1);
 assert.equal(nodes.get('eventRows').children.length,2);
 assert.match(nodes.get('realized').textContent,/units/);
 assert.match(nodes.get('lasttrade').textContent,/LOSS/);
 assert.equal(nodes.get('export').disabled,false);
 assert.equal(nodes.get('saved').textContent,'This device');
 assert.ok(stored.size===1);
 runInContext('index=33;restoreProgress()',context);
 assert.equal(runInContext('index',context),34);
});
test('validator rejects fabricated execution prices and profit',()=>{
 const {context}=env();
 const data=journalFixture();
 data.virtualFills[0].executionPriceUsd=40;
 context.fixture=data;
 assert.throws(()=>runInContext("validate(fixture,'BTC/USD')",context),/execution price/i);
 const x=journalFixture();x.closedTrades[0].netProfitVirtual=5000;
 context.fixture=x;
 assert.throws(()=>runInContext("validate(fixture,'BTC/USD')",context),/P&L\/fill mismatch/i);
});
test('source journal is neither brokerage nor forward grader',()=>{
 assert.match(html,/id="tradeRows"/);
 assert.match(html,/id="eventRows"/);
 assert.match(html,/Virtual execution · USD/);
 assert.match(html,/accountingCurrency!=='VIRTUAL_UNITS'/);
 assert.doesNotMatch(html,/money\(d\.nextOpenPrice\)|paper-api\.alpaca\.markets|submitOrder\(/);
 assert.doesNotThrow(()=>new Script(js));
});
