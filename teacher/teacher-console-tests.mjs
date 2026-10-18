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
test('default feed is unprovisioned and cannot supply forged positive grades',async()=>{
 const cfg=JSON.parse(await read('teacher/public-settings.json'));
 assert.equal(cfg.status,'NOT_PROVISIONED');
 assert.equal(cfg.feedUrl,null);
 assert.equal(cfg.signingPublicKeyBase64,null);
 assert.match(consolePage,/lastConnection='NOT PROVISIONED'/);
});
test('provisional teacher results may show 0-29 closes but never a fake confirmed grade',async()=>{
 const code=await read('teacher/grade-pipeline.mjs');
 assert.match(code,/x\.status==='FORWARD_TESTING'/);
 assert.match(code,/BROKER-RECONCILED BUT PROVISIONAL/);
 assert.match(consolePage,/p\.closedTrades>=30/);
 assert.match(consolePage,/p\.status==='VERIFIED_FORWARD_GRADE'/);
});
