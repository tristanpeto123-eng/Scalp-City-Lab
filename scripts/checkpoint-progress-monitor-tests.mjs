import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const monitor=await readFile(new URL('../training-monitor.html',import.meta.url),'utf8');
const dqn=await readFile(new URL('../.github/workflows/robot-dqn-replay.yml',import.meta.url),'utf8');
const research=await readFile(new URL('./run-robot-training.mjs',import.meta.url),'utf8');

test('neural monitor compares the OLD vs NEW model on identical historical development data',()=>{
 assert.match(monitor,/id="rl-compared"/);
 assert.match(monitor,/id="rl-improved"/);
 assert.match(monitor,/checkpointProgress/);
 assert.match(monitor,/validationWindowSha256/);
 assert.match(monitor,/deltaNetVirtual/);
 assert.match(monitor,/deltaStressedNetVirtual/);
 assert.match(monitor,/isIndependentForwardEvidence!==false/);
 assert.match(monitor,/automaticPromotion!==false/);
 assert.match(monitor,/SAME_DEVELOPMENT_WINDOW_NOT_FORWARD_VERIFIED/);
 assert.match(monitor,/FIRST_CHECKPOINT_NO_COMPARATOR/);
 const js=monitor.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new Script(js));
});
test('future neural model updates cannot be mistaken for forward grades or live brokerage',()=>{
 assert.match(dqn,/rl.test_checkpoint_progress/);
 assert.match(dqn,/checkpointComparisonPupils/);
 assert.match(dqn,/checkpointImprovedPupils/);
 assert.match(dqn,/SAME_WINDOW_PRIOR_CHECKPOINT_IMPROVED/);
 assert.doesNotMatch(dqn,/paper-api\.alpaca\.markets|api\.alpaca\.markets\/v2\/orders/);
 assert.doesNotMatch(monitor,/Math\.random\(\)|submitOrder\(/);
});
test('historical training can recover large persisted memory without bypassing its optimistic write lock',()=>{
 assert.match(research,/\/git\/blobs\//);
 assert.ok(research.includes('blob?.sha!==meta.sha'));
 assert.match(research,/bytes\.length!==expectedSize/);
 assert.match(research,/branch:MEMORY_BRANCH,sha:expectedSha,content:encoded/);
 assert.match(research,/Research history must be append-only/);
 assert.doesNotMatch(research,/paper-api\.alpaca\.markets|\/v2\/orders/);
});
