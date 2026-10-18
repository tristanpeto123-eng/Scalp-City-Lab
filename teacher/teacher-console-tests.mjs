import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const consolePage=await read('teacher-console.html');
test('connected Teacher console inline script parses in modern JS',()=>{
 const js=consolePage.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js?.includes('readFeed'));
 assert.doesNotThrow(()=>new Script(js,{filename:'teacher-console.browser.js'}));
});
test('teacher UI pulls actual repo research and independent pinned signature report',()=>{
 assert.match(consolePage,/fetch\('\.\/research-data\/robot-academy\.json'/);
 assert.match(consolePage,/fetch\('\.\/teacher\/public-settings\.json'/);
 assert.match(consolePage,/crypto\.subtle\.verify\('Ed25519'/);
 assert.match(consolePage,/signingPublicKeyBase64/);
 assert.match(consolePage,/ROBOT_ACADEMY_SIGNED_FORWARD_V1/);
 assert.match(consolePage,/report\.verifiedCount/);
 assert.match(consolePage,/!Number\.isInteger\(p\.closedTrades\)/);
 assert.match(consolePage,/source\.includes\(p\?\.symbol\)/);
});
test('no broker order mutation or client-controlled grade creation in connected UI',()=>{
 assert.doesNotMatch(consolePage,/paper-api\.alpaca\.markets/);
 assert.doesNotMatch(consolePage,/TEACHER_PAPER_CREDENTIALS_JSON/);
 assert.doesNotMatch(consolePage,/fetch\([^)]*method:\s*['"]POST/);
 assert.match(consolePage,/if\(!await crypto\.subtle\.verify/);
 assert.match(consolePage,/DEMO COMPLETE/);
});
test('Academy, trading floor, central 3D city and agent city link Teacher console',async()=>{
 for(const p of ['robot-academy.html','trading-floor.html','index.html','agent-city.html']){
  assert.match(await read(p),/href="\.\/teacher-console\.html"/,p+' missing teacher link');
 }
});
test('public HTTPS gateway has exact pinned public key and no order authority',async()=>{
 const cfg=JSON.parse(await read('teacher/public-settings.json'));
 assert.equal(cfg.status,'CONFIGURED');
 assert.match(cfg.feedUrl,/^https:\/\/[^/]+\/api\/academy$/);
 assert.match(cfg.connectionUrl,/^https:\/\/[^/]+\/api\/connection$/);
 assert.match(cfg.signingPublicKeyBase64,/^[A-Za-z0-9+/=]+$/);
 assert.match(consolePage,/lastConnection='NOT PROVISIONED'/);
});
test('provisional teacher results may show 0-29 closes but never a fake confirmed grade',async()=>{
 const code=await read('teacher/grade-pipeline.mjs');
 assert.match(code,/x\.status==='FORWARD_TESTING'/);
 assert.match(code,/BROKER-RECONCILED BUT PROVISIONAL/);
 assert.match(consolePage,/p\.closedTrades>=30/);
 assert.match(consolePage,/p\.status==='VERIFIED_FORWARD_GRADE'/);
});

test('read-only broker preflight checks unique paper identity and does not order',async()=>{
 const {preflightPaper}=await import('./paper-preflight.mjs');
 const broker={
  account:async()=>({id:'mock-paper-id-1',status:'ACTIVE',
    crypto_status:'ACTIVE',non_marginable_buying_power:'100',
    trading_blocked:false,account_blocked:false}),
  asset:async()=>({symbol:'BTC/USD',class:'crypto',tradable:true,
    marginable:false,shortable:false,min_order_size:'0.0001',
    min_trade_increment:'0.0001'}),
  positions:async()=>[],openOrders:async()=>[],
  paperOrder:async()=>{throw Error('MUST NOT PLACE ORDERS');}
 };
 const good=await preflightPaper({broker,symbols:['BTC/USD']});
 assert.equal(good.allPassed,true);
 assert.equal(good.rows[0].operation,'READ_ONLY_GET');
 const used=await preflightPaper({broker:{...broker,openOrders:async()=>[{}]},symbols:['BTC/USD']});
 assert.equal(used.allPassed,false);
 await assert.rejects(preflightPaper({broker,symbols:['BTC/USD','BTC/USD']}),/duplicate/);
});

test('operator paper preflight workflow is manual, read-only and confined to Alpaca PAPER',async()=>{
 const yml=await read('.github/workflows/teacher-paper-account-preflight.yml');
 assert.match(yml,/workflow_dispatch:/);
 assert.doesNotMatch(yml,/\bschedule\s*:/);
 assert.match(yml,/secrets\.ALPACA_PAPER_KEY/);
 assert.match(yml,/secrets\.ALPACA_PAPER_SECRET/);
 assert.match(yml,/opts\?\.method!=='GET'/);
 assert.match(yml,/https:\/\/paper-api\.alpaca\.markets\//);
 assert.doesNotMatch(yml,/paperOrder\(/);
 assert.doesNotMatch(yml,/method:\s*['"]POST['"]/);
});
