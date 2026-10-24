import {readFile,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base=process.cwd();
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.includes('..'))throw Error('path not supported');
  const absolute=resolve(base,'.'+path);
  if(!absolute.startsWith(base+'/'))throw Error('out of root');
  const bytes=await readFile(absolute);
  const ext=extname(absolute).toLowerCase();
  res.setHeader('content-type',ext==='.mjs'||ext==='.js'?'text/javascript; charset=utf-8':ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':'application/octet-stream');
  res.end(bytes);
 }catch(error){res.statusCode=404;res.end('Not found');}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const port=server.address().port;
try{
 for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await browserType.launch({headless:true});
  try{
   // Probe the currently published site, not just local browser simulation.
   const published=await browser.newPage();
   const publishedErrors=[];
   published.on('pageerror',e=>publishedErrors.push('JS: '+e.message));
   published.on('console',m=>{if(m.type()==='error')publishedErrors.push('console: '+m.text())});
   try{
    await published.goto('https://tristanpeto123-eng.github.io/Scalp-City-Lab/sl-strategy.html?startup_probe=20261024',{waitUntil:'networkidle',timeout:30000});
    await published.waitForTimeout(1500);
    const status=await published.locator('#fiveStatus').innerText();
    console.log(engine+' published page status '+status.slice(0,280)+'; errors '+JSON.stringify(publishedErrors).slice(0,800));
    assert.ok(!status.includes('Checking for saved'),engine+' PUBLISHED page module never initialized: '+JSON.stringify(publishedErrors));
   }finally{await published.close()}
   const page=await browser.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push('PAGE ERROR: '+e.message));
   page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE: '+m.text())});
   page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
   await page.goto('http://127.0.0.1:'+port+'/sl-strategy.html',{waitUntil:'networkidle'});
   await page.waitForTimeout(1300);
   const init=await page.locator('#fiveStatus').innerText();
   assert.ok(!init.includes('Checking for saved'),engine+' module never initialized: '+JSON.stringify(errors));
   assert.ok(!errors.length,engine+' boot console failures: '+JSON.stringify(errors));
   await page.locator('#market').selectOption('FOREX');
   await page.locator('#fiveSymbol').fill('EURUSD');
   const start=Date.parse('2025-06-02T00:00:00Z');
   const rows=['time,open,high,low,close,volume'];
   for(let i=0;i<650;i++){
    const o=3000+Math.sin(i*.23)*20+Math.cos(i*.015)*11+i*.001;
    const c=o+Math.cos(i*.43);
    rows.push([new Date(start+i*300000).toISOString(),o,Math.max(o,c)+.5,Math.min(o,c)-.5,c,200+i%18].join(','));
   }
   await page.locator('#fiveFile').setInputFiles({name:'real-format-5m-test.csv',mimeType:'text/csv',buffer:Buffer.from(rows.join('\n'))});
   await page.waitForFunction(()=>document.querySelector('#fiveCacheStatus')?.textContent?.includes('SAVED CHART VERIFIED'),null,{timeout:10000});
   assert.ok((await page.locator('#fiveStatus').innerText()).includes('SAVED'));
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#market').selectOption('FOREX');
   await page.waitForFunction(()=>document.querySelector('#fiveCacheStatus')?.textContent?.includes('SAVED CHART VERIFIED'),null,{timeout:12000});
   assert.ok(!await page.locator('#fiveBuild').isDisabled());
   await page.locator('#loopOnce').click();
   await page.waitForFunction(()=>document.querySelector('#loopLocalStatus')?.textContent?.includes('LOCAL CHECKPOINT VERIFIED'),null,{timeout:25000});
   assert.ok((await page.locator('#loopState').innerText()).includes('SAVED'),engine+' no checkpoint');
   await page.locator('#paperReplay').click();
   await page.waitForFunction(()=>document.querySelector('#paperStatus')?.textContent?.includes('HISTORICAL SIMULATION'),null,{timeout:35000});
   const n=Number(await page.locator('#paperClosed').innerText());
   assert.ok(n>0,engine+' historical paper replay generated no executed virtual closes');
   assert.ok(await page.locator('#paperRows tr').count()>0,engine+' paper ledger empty');
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#market').selectOption('FOREX');
   await page.waitForFunction(()=>document.querySelector('#fiveCacheStatus')?.textContent?.includes('SAVED CHART VERIFIED'),null,{timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#loopLocalStatus')?.textContent?.includes('MODEL FOUND'),
    null,{timeout:10000}).catch(async()=>{
      throw Error(engine+' model missing after refresh; actual status: '+
        await page.locator('#loopLocalStatus').innerText()+
        '; loop state: '+await page.locator('#loopState').innerText()+
        '; errors: '+JSON.stringify(errors));
    });
   await page.waitForFunction(()=>Number(document.querySelector('#paperClosed')?.textContent)>0,null,{timeout:10000});
   assert.ok(Number(await page.locator('#paperClosed').innerText())>0,engine+' historical paper ledger not persisted');
   assert.ok(!errors.length,engine+' errors: '+JSON.stringify(errors));
   console.log(engine+' PASS: module executed, imported CSV persisted, chart reloaded, loop model trained and persisted, no console errors');
  }finally{await browser.close()}
 }
}finally{server.close()}
