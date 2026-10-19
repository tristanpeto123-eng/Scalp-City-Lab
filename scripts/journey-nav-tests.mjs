import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const pages=['index.html','agent-city.html','robot-academy.html','teacher-console.html',
  'trading-floor.html','strategy-validation.html','mission-control.html'];
test('each Scalp City area exposes its shared route map without replacing original interactions',async()=>{
 const navigator=await readFile(new URL('journey-nav.js',root),'utf8');
 for(const route of ['mission-control.html','strategy-validation.html','robot-academy.html',
    'teacher-console.html','trading-floor.html','agent-city.html'])assert.ok(navigator.includes(route));
 assert.match(navigator,/aria-expanded/);
 assert.match(navigator,/Escape/);
 assert.doesNotMatch(navigator,/broker|paperOrder\(|fetch\(['"]https:/);
 for(const page of pages){
  const text=await readFile(new URL(page,root),'utf8');
  assert.match(text,/journey-nav\.js/,'Missing journey nav on '+page);
  assert.match(text,/mission-control\.html/,'Missing mission entry on '+page);
 }
});
test('Mission Control has all four canonical entry links and evidence-only data sources',async()=>{
 const html=await readFile(new URL('mission-control.html',root),'utf8');
 assert.match(html,/ONE JOURNEY\. FOUR CONNECTED STAGES/);
 assert.match(html,/readResearch/);
 assert.match(html,/readHostingConnection/);
 assert.match(html,/historical-lab-latest\.json/);
 assert.doesNotMatch(html,/APCA-API-SECRET-KEY|paperOrder\(|\/v2\/orders/);
});

test('current-stage handoff is visible and routes all steps without exposing trading authority',async()=>{
 const js=await readFile(new URL('journey-nav.js',root),'utf8');
 const css=await readFile(new URL('journey-nav.css',root),'utf8');
 const monitor=await readFile(new URL('training-monitor.html',root),'utf8');
 assert.match(js,/Continue to /);
 assert.match(js,/sc-journey-quick/);
 assert.match(js,/sc-journey-context/);
 assert.match(js,/training-monitor\.html/);
 assert.match(js,/if\(back\)panel\.append\(back\)/);
 assert.match(css,/\.sc-journey-quick/);
 assert.match(css,/\.sc-journey-next/);
 assert.match(monitor,/journey-nav\.js/);
 assert.match(monitor,/Next: Independent Qualification/);
 assert.doesNotMatch(js,/\/v2\/orders|APCA-API-SECRET-KEY/);
});
