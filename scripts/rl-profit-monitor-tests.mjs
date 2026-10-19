import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const html=await readFile(new URL('../training-monitor.html',import.meta.url),'utf8');
test('ten neural pupils have visible net-profit and passive benchmark audit',()=>{
  for(const marker of ['id="profitpassing"','id="profitupdates"','id="profitnew"',
    'id="profitrows"','Net Profit Objective','Double-cost stress','Versus best passive'])
    assert.ok(html.includes(marker),marker);
  assert.match(html,/MAXIMISE_NET_PROFIT_AFTER_FEES_AND_SLIPPAGE_V1/);
  assert.match(html,/rl-learning-memory\/rl-rapid\/latest\.json/);
});
test('results are rejected if unsigned grades, broker orders, or missing profit evidence',()=>{
  for(const marker of ["d.paperOrders!==0","d.liveOrders!==0",
    "d.verifiedForwardGrades!==0","d.automaticAdmissions!==0",
    "d.sealedHoldoutAccessed!==false","p.trainingGoal!==profitGoal",
    "x.automaticPromotion!==false","x.forwardVerified!==false",
    "x.validationOnlyNotTrainingReward!==true","x.developmentGatePassed!==p.developmentProfitGatePassed",
    "passed!==d.profitGoalPassingPupils"])
    assert.ok(html.includes(marker),marker);
  assert.match(html,/Not yet audited/);
  assert.match(html,/not a.*paper grade/i);
});
test('JS syntax and refresh schedules valid without manufactured PnL',()=>{
  const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(js);
  assert.doesNotThrow(()=>new Script(js));
  assert.match(js,/setInterval\(loadProfitGoal,60000\)/);
  assert.match(js,/loadPublished\(\);loadActions\(\);loadProfitGoal\(\);/);
  assert.doesNotMatch(js,/Math\.random\(\)/);
});
