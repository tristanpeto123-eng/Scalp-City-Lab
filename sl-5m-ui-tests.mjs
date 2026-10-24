import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const html=readFileSync(new URL('./sl-strategy.html',import.meta.url),'utf8');
assert.match(html,/id="fiveMinuteLab"/);
assert.match(html,/sl-5m\.mjs/);
assert.match(html,/id="fiveChart"/);
assert.match(html,/id="fiveBuild"/);
const scripts=[...html.matchAll(/<script\b[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,1,'SL console has one inline module');
const code=scripts[0][1];
const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:code,encoding:'utf8'});
assert.equal(result.status,0,'SL module syntax: '+result.stderr);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'no duplicated element IDs');
for(const [,id] of code.matchAll(/\$\('([^']+)'\)/g)){
 assert.ok(ids.includes(id),'UI references an absent element: '+id);
}
assert.match(code,/view=bars\.slice\(from,end\+1\)/,'replay chart draws only revealed bars');
assert.match(code,/predictSL\(/,'neural policy integrated');
assert.doesNotMatch(code,/fetch\(|WebSocket|sendOrder|placeOrder|tradeAPI/,'offline read-only UI');
console.log('SL 5m UI checks passed: valid module JavaScript, working element references, future-candle masking, no order route');