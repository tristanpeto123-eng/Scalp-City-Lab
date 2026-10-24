import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const root=new URL('../',import.meta.url);
const pages=[
 'index.html','mission-control.html','strategy-validation.html','sl-strategy.html',
 'robot-academy.html','student-progress.html','universal-student.html',
 'training-monitor.html','market-replay-5m.html','robot-observer.html','neo-lab.html',
 'teacher-console.html','trading-floor.html','agent-city.html'
];
const content=name=>readFile(new URL(name,root),'utf8');
test('one six-area map covers all 14 Scalp City screens',async()=>{
 const js=await content('journey-nav.js');
 assert.doesNotThrow(()=>new Script(js));
 for(const route of ['mission-control.html','strategy-validation.html','robot-academy.html',
   'teacher-console.html','trading-floor.html','agent-city.html'])assert.ok(js.includes("path:'"+route+"'"),route);
 for(const page of pages){
  const html=await content(page);
  assert.match(html,/journey-nav\.js/,page);
 }
 assert.match(js,/aria-current/);
 assert.match(js,/aria-expanded/);
 assert.match(js,/Escape/);
 assert.match(js,/data-area/);
 assert.match(js,/Legacy research workstation/);
 assert.doesNotMatch(js,/paperOrder\(|\/v2\/orders|APCA-API-SECRET-KEY/);
});
test('historical evidence has exactly one visible owner but existing readers are preserved',async()=>{
 const js=await content('journey-nav.js');
 const teacher=await content('teacher-console.html');
 const trade=await content('trading-floor.html');
 assert.match(teacher,/id="qualification-bridge"/);
 assert.match(teacher,/teacher\/qualification-bridge\.js/);
 assert.match(trade,/ScalpHistoricalScreen/);
 assert.match(js,/sc-retired-evidence/);
 assert.match(js,/Teacher.s Office/);
 assert.match(js,/sc-retired-links/);
 const css=await content('journey-nav.css');
 assert.match(css,/\.sc-retired-evidence\{display:none!important\}/);
});
test('PWA launches Command without removing the legacy research room',async()=>{
 const pwa=JSON.parse(await content('manifest.webmanifest'));
 assert.equal(pwa.start_url,'./mission-control.html');
 const old=await content('index.html');
 assert.match(old,/SCALP CITY LAB \/ SIMULATION ONLY/);
 assert.match(old,/backtester-agent-ui\.js/);
 assert.match(await content('journey-nav.js'),/Legacy research workstation/);
});
test('Mission Control retains actual research/evidence sources and no broker writes',async()=>{
 const html=await content('mission-control.html');
 assert.match(html,/historical-lab-latest\.json/);
 assert.match(html,/readHostingConnection/);
 assert.doesNotMatch(html,/APCA-API-SECRET-KEY|paperOrder\(|\/v2\/orders/);
});
