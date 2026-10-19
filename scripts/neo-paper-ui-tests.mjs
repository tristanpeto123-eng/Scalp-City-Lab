import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const viewer=await readFile('neo-lab.html','utf8');
const paper=await readFile('.github/workflows/demo-paper-pilot.yml','utf8');
const trainer=await readFile('.github/workflows/robot-dqn-replay.yml','utf8');
const neo=await readFile('.github/workflows/neo-pattern-memory.yml','utf8');
test('Neo dashboard is explicitly read-only and preserves unverified empty states',()=>{
 assert.match(viewer,/neo-learning-memory\/patterns\/latest\.json/);
 assert.match(viewer,/No published NEO memory yet/);
 assert.match(viewer,/finalHoldoutTouched!==false/);
 assert.match(viewer,/paperOrders!==0/);
 assert.match(viewer,/liveOrders!==0/);
 assert.match(viewer,/ten authentic five-minute crypto charts|five-minute crypto charts/);
 const code=viewer.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code);
 assert.doesNotThrow(()=>new Script(code));
 assert.doesNotMatch(viewer,/placeOrder\(|submitOrder\(|Math\.random\(/);
});
test('faster historical learning retains bounded operator and no brokerage permissions',()=>{
 assert.match(trainer,/cron: '7 \* \* \* \*'/);
 assert.match(trainer,/inputs\.episodes \|\| '3'/);
 assert.match(trainer,/rl-5m-data\/snapshots/);
 assert.match(trainer,/rl-learning-memory/);
 assert.doesNotMatch(trainer,/paper-api\.alpaca\.markets|\/v2\/orders/);
});
test('Neo chart training and PAPER account credentials cannot leak between jobs',()=>{
 assert.match(neo,/neo-learning-memory/);
 assert.match(neo,/rl-5m-data/);
 assert.doesNotMatch(neo,/ALPACA_PAPER_SECRET|SCALP_DEMO_PAPER_SECRET/);
 assert.match(paper,/secrets\.SCALP_DEMO_PAPER_KEY/);
 assert.match(paper,/secrets\.SCALP_DEMO_PAPER_SECRET/);
 assert.doesNotMatch(paper,/secrets\.ALPACA_PAPER_KEY/);
 assert.match(paper,/vars\.SCALP_DEMO_PAPER_ENABLED == 'YES_DEMO_ONLY'/);
 assert.match(paper,/--mode "\$MODE"/);
});
