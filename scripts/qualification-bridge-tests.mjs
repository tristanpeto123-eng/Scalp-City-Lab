import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('browser bridge remains readonly with graceful unavailable reports',async()=>{
 const js=await readFile(new URL('../teacher/qualification-bridge.js',import.meta.url),'utf8');
 for(const needle of ['qualification-bridge','research-data/teacher-qualification.json','no confirmed PAPER','screenedCount','No current public Teacher screen','UNKNOWN','training-monitor.html','readOnlyReport']){
  assert.ok(js.includes(needle),needle);
 }
 assert.doesNotMatch(js,/fetch\([^\n]+method\s*:\s*['"]POST['"]/i);
 assert.doesNotMatch(js,/submitOrder\s*\(|APCA-API-SECRET-KEY|\/v2\/orders/);
});
test('Academy, Teacher and Trading Floor present read-only historical bridge',async()=>{
 for(const file of ['robot-academy.html','teacher-console.html','trading-floor.html','strategy-validation.html']){
  const html=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.match(html,/id="qualification-bridge"/,file);
  assert.match(html,/teacher\/qualification-bridge\.js/,file);
 }
});

test('training monitor distinguishes actual scheduled execution from configured five-minute intention',async()=>{
 const html=await readFile(new URL('../training-monitor.html',import.meta.url),'utf8');
 for(const term of ['observed-cadence','lastScheduledAt','completed scheduled runs','SCHEDULE DELAY','does not guarantee that frequency','AWAITING FIRST MEASURED RUN','replayed-data-warning','ZERO new training candles'])
  assert.ok(html.includes(term),term);
});

test('public verdict must match current Academy source before it is shared',async()=>{
 const bridge=await readFile(new URL('../teacher/qualification-bridge.js',import.meta.url),'utf8');
 for(const required of ['requireMatchingAcademySource','robot-academy.json?screen-source','delete window.ScalpHistoricalScreen'])
   assert.ok(bridge.includes(required),required);
 assert.ok(bridge.indexOf('await requireMatchingAcademySource')<bridge.indexOf('window.ScalpHistoricalScreen=Object.freeze'));
 for(const file of ['robot-academy.html','teacher-console.html','trading-floor.html','strategy-validation.html']){
   const h=await readFile(new URL('../'+file,import.meta.url),'utf8');
   assert.match(h,/<script type="module" src="\.\/teacher\/qualification-bridge\.js">/);
 }
});
