import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../market-replay-5m.html',import.meta.url),'utf8');
test('ten pupils, working play / pause, next-candle and reset controls',()=>{
 for(const id of ['symbol','speed','load','step','play','reset','chart','status'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/window\.addEventListener\('resize',draw\)/);
 assert.match(html,/timer=setInterval\(step/);
 assert.match(html,/index=Math\.min\(index\+1,trace\.candles\.length-1\)/);
});
test('chart reveals only historical prefix and guards five-minute timestamps',()=>{
 assert.match(html,/\.slice\(Math\.max\(0,index-73\),index\+1\)/);
 assert.match(html,/t-data\.candles\[i-1\]\.t!==300000/);
 assert.match(html,/d\.observedCandleTime!==data\.candles\[j-1\]\.t/);
 assert.match(html,/d\.nextCandleTime!==data\.candles\[j\]\.t/);
 assert.match(html,/futureCandlesVisibleAtOnce!==false/);
 assert.match(html,/heldOutQuarantineTouched!==false/);
});
test('no fake fixtures or browser broker orders, fail on missing model file',()=>{
 assert.match(html,/No verified five-minute DQN replay has been published/);
 assert.match(html,/No demo or fabricated candles substituted/);
 assert.match(html,/data\.paperOrders!==0/);
 assert.match(html,/data\.liveOrders!==0/);
 assert.doesNotMatch(html,/paper-api\.alpaca\.markets|submitOrder\(|placeOrder\(|Math\.random\(\)/);
});
test('embedded chart-replay script syntax valid in browser',()=>{
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new Script(js));
});
