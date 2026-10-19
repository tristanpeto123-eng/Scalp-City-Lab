// Static contract for Scalp City's shared navigation and safe historical pipeline.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const load=file=>readFile(new URL('../'+file,import.meta.url),'utf8');
const routes=['mission-control.html','strategy-validation.html','robot-academy.html',
 'training-monitor.html','teacher-console.html','trading-floor.html'];
test('shared in-page stage navigation parses and is present on every workflow screen',async()=>{
 const nav=await load('journey-nav.js');
 assert.doesNotThrow(()=>new Script(nav));
 assert.match(nav,/className='sc-workflow-rail'/);
 assert.match(nav,/aria-current','page/);
 assert.match(nav,/sc-workflow-track/);
 assert.match(nav,/const inlinePages=new Set/);
 for(const route of routes){
   assert.match(nav,new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   assert.match(await load(route),/journey-nav\.js/,'Route missing navigation: '+route);
 }
});
test('research and forward PAPER are clearly distinguished in public navigation',async()=>{
 const nav=await load('journey-nav.js');
 assert.match(nav,/Navigate stages freely/);
 assert.match(nav,/verified evidence/);
 assert.match(nav,/rawPupil/);
 assert.match(nav,/shortNames=\['Historical Lab','Robot Academy'/);
 assert.doesNotMatch(nav,/v2\/orders|APCA-API-SECRET-KEY|fetch\(/);
});
test('measured batch reporting is surfaced but not interpreted as paper fills',async()=>{
 const source=await load('scripts/run-robot-training.mjs');
 const page=await load('training-monitor.html');
 assert.match(source,/batchesPerPupil=1/);
 assert.match(source,/batchesPerPupil<1\|\|batchesPerPupil>3/);
 assert.match(source,/repeatedHistoryDoesNotCountAsIndependent:true/);
 assert.match(source,/measuredBatchAttempts:/);
 assert.match(page,/id="batches"/);
 assert.match(page,/measuredBatchAttempts/);
 assert.match(page,/not independent tests/);
});
test('historic fold comparisons and explanatory page agree on disjoint folds',async()=>{
 const lab=await load('scripts/historical-lab.mjs');
 const home=await load('mission-control.html');
 assert.match(lab,/strideCandles:1200/);
 assert.match(lab,/normalNetAcrossDisjointFolds/);
 assert.match(lab,/stressedNetAcrossDisjointFolds/);
 assert.match(home,/Separate non-overlapping historical development windows/);
});
