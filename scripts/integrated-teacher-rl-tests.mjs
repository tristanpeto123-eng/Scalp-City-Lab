import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=async path=>readFile(new URL(path,root),'utf8');
test('Teacher historical screening is present on all four stages but cannot claim forward grading',async()=>{
 const pages=['strategy-validation.html','robot-academy.html','teacher-console.html','trading-floor.html'];
 for(const path of pages){
  const html=await read(path);
  assert.match(html,/id="qualification-bridge"/,path+' missing target');
  assert.match(html,/src="\.\/teacher\/qualification-bridge\.js"/,path+' missing read-only bridge');
 }
 const client=await read('teacher/historical-screen-client.mjs');
 assert.match(client,/academySourceSha256/);
 assert.match(client,/SHA-256/);
 const bridge=await read('teacher/qualification-bridge.js');
 assert.match(bridge,/Ed25519-signed/);
 assert.doesNotMatch(bridge,/fetch\(['"]https:\/\/paper-api\.alpaca\.markets/);
 assert.doesNotMatch(bridge,/submitOrder|placeOrder|automaticAdmission/);
});
test('Merged monitor preserves true 5-minute RL and separately sourced historical audit',async()=>{
 const h=await read('training-monitor.html');
 for(const id of ['rl-speed','rl-closes','rl-updates','rl-decisions','rl-positive','rl-new',
  'rl-status','rl-pupils','observed-cadence','replayed-data-warning','batches','health']){
  assert.match(h,new RegExp('id="'+id+'"'), 'missing '+id);
 }
 for(const term of ["d.marketBarTimeframe!=='5Min'","loadRapidRL()",
  '5-minute archived bars','newTrainingCandles===0','lastScheduledAt',
  'measuredBatchAttempts','https://raw.githubusercontent.com/','market-replay-5m.html'])
  assert.ok(h.includes(term),'Missing integration invariant '+term);
 assert.doesNotMatch(h,/d\.marketBarTimeframe!=='15Min'/);
 const ids=[...h.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(new Set(ids).size,ids.length,'Monitor must not have duplicate DOM IDs');
 const script=h.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script?.length>200,'Inline monitor module missing');
 const tmp=await mkdtemp(join(tmpdir(),'scalp-integrated-'));
 try{
  const file=join(tmp,'monitor.mjs');await writeFile(file,script);
  const run=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
 }finally{await rm(tmp,{recursive:true,force:true});}
 for(const match of script.matchAll(/\$\('([a-z0-9-]+)'\)/g))
  assert.ok(ids.includes(match[1]),'Monitor JS references missing ID '+match[1]);
});
test('Latest DQN engine remains the supported 5-minute source and does not connect to brokerage',async()=>{
 const py=await read('rl/rapid_replay.py');
 assert.match(py,/marketBarTimeframe':\s*'5Min'/);
 assert.match(py,/gradientUpdatesThisRun/);
 assert.match(py,/decisionsPerSecond/);
 assert.match(py,/laterDevelopmentStressedNetGbp/);
 const workflow=await read('.github/workflows/robot-dqn-replay.yml');
 assert.match(workflow,/ref: rl-5m-data/);
 assert.match(workflow,/ref: rl-learning-memory/);
 assert.doesNotMatch(workflow,/ALPACA_PAPER_SECRET|SCALP_PAPER_SECRET/);
});
test('The newest Academy navigation survives the Teacher merge',async()=>{
 const html=await read('robot-academy.html');
 assert.match(html,/neo-lab\.html/);
 assert.match(html,/market-replay-5m\.html/);
 assert.match(html,/qualification-bridge\.js/);
 const nav=await read('journey-nav.css');
 assert.match(nav,/sc-global-navigation/);
 assert.match(nav,/sc-retired-evidence/);
});
