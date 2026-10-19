import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateAdaptive} from './strategy-adaptive-model.mjs';
import {simulateValidation} from './strategy-validation-core.mjs';
const htmlUrl=new URL('./strategy-validation.html',import.meta.url);
const sampleUrl=new URL('./validation-data/BTC-USD.json',import.meta.url);

test('new Lab is a connected goal → chart pupil → exploration → evidence → Teacher journey',async()=>{
 const html=await readFile(htmlUrl,'utf8');
 for(const text of ['AGENT DEVELOPMENT / RESEARCH','What should this agent achieve?',
 'What has this robot learned so far?','Invent my own strategy',
 'Research report','Strategy research','Teacher','rejectionDescription',
 'renderPupil','loadAcademy','export-actions','No candidate passed all historical training',
 'no later-history replay','dataSource:selected.verified.source'])assert.ok(html.includes(text),text);
 assert.match(html,/value="auto"/);
 assert.match(html,/value="invent"/);
 assert.match(html,/source-dot/);
 assert.match(html,/type="number" min="50"/);
 assert.match(html,/fetch\('\.\/research-data\/robot-academy\.json'/);
 assert.match(html,/researchOnly:true/);
 assert.match(html,/paperOrders:0,liveOrders:0,admissions:0,verifiedForwardGrades:0/);
 assert.doesNotMatch(html,/https:\/\/paper-api\.alpaca\.markets/);
 assert.doesNotMatch(html,/fetch\(['"]https:\/\/data\.alpaca\.markets/);
});

test('browser module is syntactically valid and all DOM identifiers referenced by $ exist',async()=>{
 const html=await readFile(htmlUrl,'utf8');
 const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js,'inline JS source missing');
 const tmp=await mkdtemp(join(tmpdir(),'scalp-lab-'));
 try{
  const name=join(tmp,'lab.mjs');await writeFile(name,js);
  const checked=spawnSync(process.execPath,['--check',name],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr);
 }finally{await rm(tmp,{recursive:true,force:true});}
 const referenced=[...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]);
 for(const id of new Set(referenced))assert.match(html,new RegExp('id="'+id+'"'), 'Missing HTML control: '+id);
});

test('when every invented candidate fails, research still includes inspectable evidence',async()=>{
 const source=JSON.parse(await readFile(sampleUrl,'utf8'));
 const price=source.bars[0].c;
 const flat={...source,bars:source.bars.map(b=>({...b,
   o:price,c:price,h:price*1.001,l:price*0.999,v:10}))};
 const r=validateAdaptive({snapshot:flat,symbol:'BTC/USD',startingBalanceGbp:50,
  strategyMode:'invent',mode:'duration',limit:14});
 assert.equal(r.model.candidates.length,16);
 assert.equal(r.model.selected,null);
 assert.equal(r.replay,null);
 assert.equal(r.brokerOrders,0);
 assert.ok(r.model.candidates.every(x=>x.rejection.length>0));
 assert.ok(r.model.candidates.every(x=>x.discovery&&x.confirmation&&x.doubledFee));
});

test('manual baseline produces historical statistics even without a qualifying champion',async()=>{
 const source=JSON.parse(await readFile(sampleUrl,'utf8'));
 const result=simulateValidation({snapshot:source,symbol:'BTC/USD',
  startingBalanceGbp:50,mode:'duration',limit:14,strategy:'ema'});
 assert.equal(result.symbol,'BTC/USD');
 assert.equal(result.actualForwardTradeCount,0);
 assert.equal(result.payoutGuaranteed,false);
 assert.ok(Number.isFinite(result.realizedNetProfitGbp));
 assert.ok(Array.isArray(result.trades));
});
