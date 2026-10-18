import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PAIRS} from '../strategy-validation-core.mjs';
import {initialPaperStatus,inspectPaperAccounts} from './hosted-preflight.mjs';
const credentials=Object.fromEntries(PAIRS.map((symbol,i)=>
 [symbol,{key:'pk_mock_'+i,secret:'secret_mock_'+i}]));
const slots=Object.fromEntries(PAIRS.slice(0,3).map(s=>[s,credentials[s]]));
let calls=0;
const broker=ids=>({
 async account(symbol){calls++;return {id:ids?.[symbol]||'account-'+symbol,
 status:'ACTIVE',crypto_status:'ACTIVE',non_marginable_buying_power: '100',
 trading_blocked:false,account_blocked:false};},
 async asset(symbol){calls++;return {symbol,class:'crypto',tradable:true,
 shortable:false,marginable:false,min_order_size:'0.0001',
 min_trade_increment:'0.0001'};},
 async positions(){calls++;return [];},
 async openOrders(){calls++;return [];},
 async paperOrder(){throw Error('WRITE DISALLOWED');}
});
const now=()=>new Date('2026-10-18T12:00:00.000Z');
test('missing credentials means no broker calls or claim of commissioning',async()=>{
 calls=0;
 assert.equal(initialPaperStatus().allPassed,false);
 const report=await inspectPaperAccounts({brokerFactory:()=>broker(),now});
 assert.equal(report.status,'NOT_CONFIGURED');
 assert.equal(report.checked,0);assert.equal(calls,0);
 assert.equal(report.paperOrdersEnabled,false);
});
test('three isolated Alpaca PAPER slots pass and all ten Academy pupils remain',async()=>{
 calls=0;
 const report=await inspectPaperAccounts({
  raw:JSON.stringify(slots),brokerFactory:()=>broker(),now
 });
 assert.equal(report.status,'ALL_SLOTS_VERIFIED');
 assert.equal(report.academyPupils,10);
 assert.equal(report.required,3);
 assert.equal(report.configured,3);assert.equal(report.checked,3);
 assert.equal(report.passed,3);assert.equal(report.allPassed,true);
 assert.equal(calls,12);
 assert.equal(report.checkedAt,now().toISOString());
 const serialized=JSON.stringify(report);
 assert.ok(!serialized.includes('secret_mock'));
 assert.ok(!serialized.includes('pk_mock'));
 assert.ok(!serialized.includes('account-BTC'));
 assert.ok(!serialized.includes('accountHashSuffix'));
 assert.equal(report.paperOrdersEnabled,false);
});
test('partial account set cannot claim full commissioning',async()=>{
 const report=await inspectPaperAccounts({
  raw:JSON.stringify({'BTC/USD':credentials['BTC/USD']}),
  brokerFactory:()=>broker(),now
 });
 assert.equal(report.status,'PARTIAL_SLOTS');
 assert.equal(report.passed,1);assert.equal(report.configured,1);
 assert.equal(report.allPassed,false);
});
test('duplicated PAPER keys rejected without making broker calls',async()=>{
 calls=0;
 const dupe={...slots,'ETH/USD':slots['BTC/USD']};
 const result=await inspectPaperAccounts({raw:JSON.stringify(dupe),brokerFactory:()=>broker(),now});
 assert.equal(result.status,'DUPLICATED_CREDENTIALS');
 assert.equal(result.allPassed,false);assert.equal(calls,0);
});
test('duplicated actual broker account ID triggers strict denial',async()=>{
 const ids=Object.fromEntries(PAIRS.map(s=>[s,'one-shared-account']));
 const report=await inspectPaperAccounts({raw:JSON.stringify(slots),
 brokerFactory:()=>broker(ids),now});
 assert.equal(report.status,'READ_ONLY_CHECK_ERROR');
 assert.equal(report.allPassed,false);assert.equal(report.passed,0);
});
test('malformed or extra mappings are denied without echoing secrets',async()=>{
 for(const raw of ['{BAD',JSON.stringify({...credentials,'QQQ':credentials['BTC/USD']}),
  JSON.stringify({'BTC/USD':{key:'',secret:'secret'}})]){
  const report=await inspectPaperAccounts({raw,brokerFactory:()=>broker(),now});
  assert.equal(report.allPassed,false);
  assert.ok(['INVALID_JSON','INVALID_SYMBOL_MAPPING','INVALID_ACCOUNT_ENTRY'].includes(report.status));
  assert.ok(!JSON.stringify(report).includes('secret_mock'));
 }
});
test('individual blocked account fails even when every other account passes',async()=>{
 const blocked=broker();
 const original=blocked.account;
 blocked.account=async symbol=>symbol==='SOL/USD'?
 {...await original(symbol),trading_blocked:true}:original(symbol);
 const report=await inspectPaperAccounts({raw:JSON.stringify(slots),
  brokerFactory:()=>blocked,now});
 assert.equal(report.status,'SOME_ACCOUNTS_FAILED');
 assert.equal(report.passed,2);assert.equal(report.checked,3);
 assert.equal(report.checks.find(p=>p.symbol==='SOL/USD').result,'FAIL');
 assert.equal(report.allPassed,false);
});
test('private Railway only; public gateway cannot receive or transmit credentials',async()=>{
 const server=await readFile(new URL('./commission-server.mjs',import.meta.url),'utf8');
 assert.match(server,/inspectPaperAccounts/);
 assert.match(server,/status\.paperAccounts/);
 assert.match(server,/process\.env\.TEACHER_PAPER_CREDENTIALS_JSON/);
 assert.match(server,/if\(req\.method!=='GET'/);
 assert.doesNotMatch(server,/console\.log\([^\n]*TEACHER_PAPER_CREDENTIALS_JSON/);
 const settings=JSON.parse(await readFile(new URL('./public-settings.json',import.meta.url),'utf8'));
 assert.equal(settings.status,'CONFIGURED');
 assert.ok(!JSON.stringify(settings).includes('PAPER_CREDENTIALS'));
});

test('Alpaca owner account limit fails closed rather than demanding ten accounts',async()=>{
 calls=0;
 const report=await inspectPaperAccounts({raw:JSON.stringify(credentials),
  brokerFactory:()=>broker(),now});
 assert.equal(report.status,'EXCEEDS_PROVIDER_LIMIT');
 assert.equal(report.required,3);
 assert.equal(report.configured,10);
 assert.equal(report.allPassed,false);
 assert.equal(calls,0);
});
test('any three Academy pupils can be assigned the isolated available seats',async()=>{
 const chosen=Object.fromEntries(['XRP/USD','LINK/USD','DOGE/USD']
   .map(p=>[p,credentials[p]]));
 const result=await inspectPaperAccounts({raw:JSON.stringify(chosen),
  brokerFactory:()=>broker(),now});
 assert.equal(result.status,'ALL_SLOTS_VERIFIED');
 assert.equal(result.checked,3);
 assert.equal(result.checks.some(x=>x.symbol==='BTC/USD'),false);
 assert.equal(result.paperOrdersEnabled,false);
});
