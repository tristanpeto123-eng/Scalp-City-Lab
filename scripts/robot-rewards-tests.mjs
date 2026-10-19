import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreTrainingReward,checkTrainingReward,researchCredits} from './robot-rewards.mjs';
const good={closedTrades:48,netProfitGbp:8,stressNetProfitGbp:3,maxDrawdownPct:3,winRatePct:55};
test('reinforcement rewards bounded positive, stressed, sampled independent training',()=>{
  const r=scoreTrainingReward(good,{independent:true});
  assert.equal(r.eligible,true);assert.ok(r.points>0&&r.points<=100);
  assert.equal(r.forwardVerified,false);assert.equal(checkTrainingReward(r),true);
});
test('overlapping history, high win-rate losses, fee failures and over-risk receive NO credits',()=>{
  const inputs=[
    [good,false],[{...good,closedTrades:29},true],
    [{...good,winRatePct:99,netProfitGbp:-1},true],
    [{...good,stressNetProfitGbp:-.1},true],
    [{...good,maxDrawdownPct:8.1},true],
    [{...good,stressNetProfitGbp:NaN},true]
  ];
  for(const [metrics,independent] of inputs){
    const r=scoreTrainingReward(metrics,{independent});
    assert.equal(r.points,0);assert.equal(r.eligible,false);
  }
});
test('credits count only independent eligible experiments; never confer graduation',()=>{
  const reward=scoreTrainingReward(good,{independent:true});
  const saved=[{symbol:'BTC/USD',acceptedForLearning:true,
    trainingOptions:[{researchReward:reward}]},
    {symbol:'BTC/USD',acceptedForLearning:false,trainingOptions:[{researchReward:reward}]},
    {symbol:'ETH/USD',acceptedForLearning:true,trainingOptions:[{researchReward:reward}]}];
  assert.deepEqual(researchCredits(saved,'BTC/USD'),{
    points:reward.points,creditedOptions:1,creditedLessons:1,
    scope:'TRAINING_ONLY',independentlyForwardVerified:false});
  assert.equal(researchCredits(saved,'BTC/USD').creditedLessons,1);
});
test('malformed, fake verified reward is blocked',()=>{
  const r=scoreTrainingReward(good,{independent:true});
  assert.throws(()=>checkTrainingReward({...r,forwardVerified:true}),/Invalid/);
  assert.throws(()=>checkTrainingReward({...r,points:999}),/Invalid/);
  assert.equal(checkTrainingReward(undefined),true);
});
