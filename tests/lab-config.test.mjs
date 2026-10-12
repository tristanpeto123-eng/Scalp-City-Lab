import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const txt = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Lab has independent IndexedDB, localStorage and BT-01 histories',()=>{
  assert.match(txt('app.js'),/DB_NAME = "scalp-city-lab-v1"/);
  assert.match(txt('app.js'),/scalpCityLabGithubMeta/);
  assert.doesNotMatch(txt('app.js'),/"scalpCityGithubMeta"/);
  const bt=txt('backtester-agent.js'); assert.match(bt,/BT-01:report-history:v[12]/); assert.match(bt,/location\.pathname|scalp-city-lab:/);
});
test('Hard GitHub memory lock forbids touching original repo or non-Lab paths',()=>{
  const app=txt('app.js');
  assert.match(app,/LAB SAFETY LOCK/);
  assert.match(app,/g\.owner!=="tristanpeto123-eng"/);
  assert.match(app,/g\.repo!=="Scalp-City-Lab"/);
  assert.match(app,/g\.branch!=="main"/);
  assert.match(app,/g\.path!=="knowledge-lab"/);
  assert.match(app,/filePath\.split\("\/"\)/);
});
test('PWA identity and service worker cache are distinct and non-destructive',()=>{
  assert.equal(JSON.parse(txt('manifest.webmanifest')).id,'/Scalp-City-Lab/');
  const sw=txt('sw.js');
  assert.match(sw,/scalp-city-lab-/);
  assert.match(sw,/k\.startsWith\((?:LAB_CACHE_PREFIX|'scalp-city-lab-')\)/);
  assert.doesNotMatch(sw,/keys\.filter\(k=>k!==CACHE\)/);
});
test('Lab prominently reports simulation and does not mislabel backtest PnL as real cash',()=>{
  assert.match(txt('index.html'),/SCALP CITY LAB \/ SIMULATION ONLY/);
  assert.match(txt('index.html'),/NOT live prices/);
  assert.match(txt('scene3d.js'),/CANDIDATE SUM \/ NOT ACCOUNT PNL/);
  assert.match(txt('app.js'),/\+" pts"/);
});
test('source assets, 3D app and BT-01 backtester copied into Lab',()=>{
  for(const f of ['app.js','scene3d.js','training-worker.js','backtester-agent.js','backtester-agent-worker.js','backtester-agent-ui.js','cfd-engine.js','styles.css','index.html','icon-192.png','icon-512.png','scalp-city-concept.png']) {
    assert.equal(existsSync(new URL(`../${f}`,import.meta.url)),true,`Missing ${f}`);
  }
});
test('memory starts empty, not copied from stable research sessions',()=>{
  assert.equal(JSON.parse(txt('knowledge-manifest.json')).totalSessions,0);
  for(const ticker of ['SPY','QQQ','IWM']){
    assert.equal(JSON.parse(txt(`knowledge-champions-${ticker}.json`)).champion,null);
  }
});
