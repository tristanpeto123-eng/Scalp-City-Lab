import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const load=p=>readFileSync(resolve(root,p),'utf8');
const html=load('gta-ui/index.html');
const world=load('gta-ui/world.js');
const phone=load('gta-ui/phone.js');
const css=load('gta-ui/style.css');

test('scene, phone and stylesheet are bundled',()=>{
  for(const file of ['./world.js','./phone.js','./style.css'])assert.ok(html.includes(file),file);
  assert.match(html,/id="world"/);
  assert.match(html,/id="phoneShell"/);
  assert.match(html,/id="liftButton"/);
});
test('3D world supports distinct floors, mobile walking and a physical elevator',()=>{
  for(const name of ['Mission Control','Research Lab','Robot Academy',"Teacher's Office",'Trading Floor','Operations'])
    assert.ok(world.includes(name),'Missing floor '+name);
  assert.match(world,/data-move/);
  assert.match(world,/KeyE/);
  assert.match(world,/function teleport/);
  assert.match(world,/robotMeshes/);
  assert.match(world,/No overhead ceiling mesh/);
});
test('existing nested phone routes are real pages in the source',()=>{
  const routes=[...phone.matchAll(/route:'\.\.\/([^']+)'/g)].map(m=>m[1]);
  assert.ok(routes.length>=6);
  for(const route of routes)assert.ok(existsSync(resolve(root,route)),'Missing app route '+route);
  assert.ok(!routes.includes('training-monitor.html'),'Unimplemented monitor route');
  assert.ok(!routes.includes('trading-floor.html'),'Unimplemented trading-floor route');
});
test('native status apps only read saved evidence',()=>{
  assert.ok(phone.includes('research-data/'));
  assert.ok(phone.includes('training-monitor.json'));
  assert.ok(phone.includes('robot-academy.json'));
  assert.ok(phone.includes('not the current live throughput'));
  assert.match(phone,/no paper order-entry or live trading controls/i);
  assert.ok(!/\/v2\/orders|submitOrder|placeOrder/.test(world+phone));
});
test('phone supports full-screen, home, collapse, keyboard escape and floor controls',()=>{
  assert.match(phone,/function maximize/);
  assert.match(phone,/function openHome/);
  assert.match(phone,/function openApp/);
  assert.match(css,/\.phone-shell\.maximized/);
  assert.match(css,/\.native-floor/);
  assert.ok(phone.includes("appFrame"));
});
