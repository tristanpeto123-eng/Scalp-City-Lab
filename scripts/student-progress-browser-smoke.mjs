import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base=process.cwd();
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.includes('..'))throw Error('Invalid relative path');
  const full=resolve(base,'.'+pathname);
  if(!full.startsWith(base+'/'))throw Error('Outside root');
  const bytes=await readFile(full);
  const ext=extname(full).toLowerCase();
  res.writeHead(200,{'Content-Type':ext==='.js'||ext==='.mjs'?'text/javascript; charset=utf-8':ext==='.json'?'application/json; charset=utf-8':'text/html; charset=utf-8'});
  res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 for(const [name,engine] of [['Chromium',chromium],['Safari WebKit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const issues=[];page.on('pageerror',e=>issues.push(e.message));
   page.on('console',msg=>{if(msg.type()==='error')issues.push(msg.text())});
   await page.goto('http://127.0.0.1:'+server.address().port+'/student-progress.html',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>document.querySelector('#statStudents')?.textContent==='10',null,{timeout:12000});
   assert.equal(await page.locator('#statStudents').innerText(),'10');
   assert.equal(await page.locator('#statForward').innerText(),'0');
   assert.ok((await page.locator('#studentMode').innerText()).includes('DQN'));
   assert.ok(Number((await page.locator('#mGradient').innerText()).replaceAll(',',''))>0);
   assert.equal(await page.locator('#roster .student').count(),14);
   assert.ok(Number(await page.locator('#lessonTable tr').count())>10);
   assert.ok(await page.locator('#gradeChart').evaluate(el=>{
    const ctx=el.getContext('2d'),pixels=ctx.getImageData(0,0,el.width,el.height).data;
    return pixels.some(x=>x!==0);
   }));
   await page.locator('#filters button[data-market="FOREX"]').click();
   assert.ok((await page.locator('#studentMode').innerText()).includes('No SL neural checkpoint'));
   await page.evaluate(()=>{
    const cfg={market:'FOREX',symbol:'EURUSD',holdCandles:3,sideCostBps:4,virtualNotionalGbp:1000};
    const state={schema:'SL_5MIN_CAUSAL_LOOP_V1',config:cfg,
     cursor:'2026-10-24T12:00:00.000Z',revisions:12,newCandles:120,cycles:6,
     model:{strategy:'SL',activatedForTrading:false,weights:{w1:Array.from({length:8},()=>[.1,.1,.1,.1,.1,.1])}},
     memory:{good:[{id:'T1',closedAt:'2026-10-24T11:00:00Z'}],bad:[]},
     paperOrders:[{status:'CLOSED',entryAt:'2026-10-24T10:00:00Z',exitedAt:'2026-10-24T11:00:00Z',side:'LONG',selection:'MODEL',netPnlGbp:4.3}],
     paperNetPnlGbp:4.3
    };
    localStorage.setItem('scalp-city-lab:sl:loop:v1:FOREX:EURUSD:3:4:1000',JSON.stringify(state));
   });
   await page.reload({waitUntil:'networkidle'});
   await page.locator('#filters button[data-market="FOREX"]').click();
   assert.ok((await page.locator('#studentStatus').innerText()).includes('LOCAL'));
   assert.ok((await page.locator('#mGradient').innerText()).includes('12'));
   assert.ok((await page.locator('#mNet').innerText()).includes('£4.30'));
   assert.ok((await page.locator('#profitNote').innerText()).includes('virtual order closes'));
   assert.equal(issues.length,0,name+' JavaScript errors '+JSON.stringify(issues));
   console.log(name+' student chart dashboard PASS: 10 crypto pupils, grade/history charts, local SL, refresh, no fake graduates');
  }finally{await browser.close()}
 }
}finally{server.close()}
