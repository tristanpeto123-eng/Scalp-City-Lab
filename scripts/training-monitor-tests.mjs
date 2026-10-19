import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const page=await readFile(new URL('../training-monitor.html',import.meta.url),'utf8');
test('published Academy history displays when first monitor JSON is absent',()=>{
 assert.match(page,/async function loadPublished\(/);
 assert.match(page,/const pupils=await fetch\('\.\/research-data\/robot-academy\.json/);
 assert.match(page,/function fillArchivedResearch\(school\)/);
 assert.match(page,/let data=null,monitorReason=/);
 assert.match(page,/catch\(err\)\{data=null;monitorReason=/);
 assert.match(page,/fillArchivedResearch\(school\)/);
 assert.match(page,/Historical training only/);
 assert.match(page,/Not yet measured/);
 assert.match(page,/Not scored \(legacy\)/);
 assert.match(page,/p\.learningCredits\?/);
});
test('old archived training is never falsely presented as measured live speed',()=>{
 assert.match(page,/lastMonitor=data\?\.lastMeasuredCycle\?data:null/);
 assert.match(page,/Number\.isFinite\(c\?\.evaluationsPerSecond\)/);
 assert.match(page,/AWAITING FIRST MEASURED RUN/);
 assert.match(page,/No new lesson yet/);
 assert.match(page,/No new comparable evidence/);
 assert.doesNotMatch(page,/Math\.random\(\)/);
});
test('GitHub run failure state and direct workflow link survive API outage',()=>{
 assert.match(page,/actions\/workflows\/robot-research-training\.yml/);
 assert.match(page,/WORKFLOW FAILURE/);
 assert.match(page,/Workflow status unavailable/);
 assert.match(page,/Open GitHub Actions/);
});
test('monitor script is valid browser JS and preserves zero broker claims',()=>{
 const js=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/data\.brokerOrders!==0/);
 assert.match(js,/data\.verifiedForwardGrades!==0/);
 assert.match(js,/school\.actualBrokerOrders!==0/);
});
