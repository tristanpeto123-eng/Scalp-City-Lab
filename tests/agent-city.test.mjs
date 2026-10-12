import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const txt=n=>{let p=new URL(`../${n}`,import.meta.url);if(!existsSync(p))p=new URL(`./${n}`,import.meta.url);return readFileSync(p,'utf8')};
test('Agent City has 12 distinct buildings and per-agent robots',()=>{
 const src=txt('agent-city.js');assert.match(src,/AGENTS\.forEach\(station\)/);assert.match(src,/function makeRobot\(/);assert.match(src,/function station\(/);
 const ids=[...src.matchAll(/\{id:'([A-Z]{2}-01)'/g)].map(x=>x[1]);assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);
});
test('physical monitors render agent decisions and reports',()=>{
 const src=txt('agent-city.js');for(const s of ['screenTexture','agent.decision','agent.metric','screen0.draw()','screen1.draw()'])assert.ok(src.includes(s),`missing ${s}`)
});
test('rooms are selectable with 3D raycasting and mobile controls',()=>{
 const src=txt('agent-city.js');for(const s of ['Raycaster','setFromCamera','intersectObjects','pointerdown','touchmove','resize()','choose(id)'])assert.ok(src.includes(s),`missing ${s}`)
});
test('display-only events cannot authorize orders; demo is explicitly labeled',()=>{
 const src=txt('agent-city.js');assert.match(src,/ILLUSTRATIVE \/ SYNTHETIC/);assert.match(src,/EXTERNAL EVENT · DISPLAY ONLY/);assert.doesNotMatch(src,/fetch\(/);assert.doesNotMatch(src, /Authorization/);
 const html=txt('agent-city.html');assert.match(html,/ILLUSTRATIVE DATA/);assert.match(html,/No live trading or autonomous authorization/);
});
test('style includes touch, reduced motion, and keyboard focus',()=>{
 const css=txt('agent-city.css');for(const s of ['touch-action:none','focus-visible','prefers-reduced-motion','max-width:750px','.loading[hidden]'])assert.ok(css.includes(s),`missing ${s}`);
});
test('installer locked to Lab and preserves existing scene',()=>{
 const py=txt('install-agent-city.py');assert.match(py,/repo!='tristanpeto123-eng\/Scalp-City-Lab'/);assert.doesNotMatch(py,/Path\('scene3d\.js'\)\.write_text/);
});
