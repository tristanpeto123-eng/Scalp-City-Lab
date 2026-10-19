// Training-only positive reinforcement. Never consumes sealed holdouts,
// out-of-sample monitor results, signed grades or broker orders.
export const REWARD_POLICY=Object.freeze({
  version:'TRAINING_REWARD_V1',minCloses:30,maxDrawdownPct:8,
  maxPoints:100,ordersAllowed:false,forwardVerified:false
});
const finite=Number.isFinite;
export function scoreTrainingReward(result,{independent=false}={}){
  const base={policy:REWARD_POLICY.version,points:0,eligible:false,
    reason:'',scope:'IN_SAMPLE_TRAINING_ONLY',forwardVerified:false};
  if(!independent)return {...base,reason:'OVERLAPPING_WINDOW_NO_CREDIT'};
  if(!result||!Number.isInteger(result.closedTrades)||result.closedTrades<REWARD_POLICY.minCloses)
    return {...base,reason:'INSUFFICIENT_TRADES'};
  if(![result.netProfitGbp,result.stressNetProfitGbp,result.maxDrawdownPct].every(finite))
    return {...base,reason:'MISSING_COST_OR_RISK_EVIDENCE'};
  if(result.netProfitGbp<=0||result.stressNetProfitGbp<=0)
    return {...base,reason:'NOT_PROFITABLE_AFTER_STRESSED_COSTS'};
  if(result.maxDrawdownPct<0||result.maxDrawdownPct>REWARD_POLICY.maxDrawdownPct)
    return {...base,reason:'DRAWDOWN_LIMIT'};
  const points=Math.min(REWARD_POLICY.maxPoints,Math.round(
    15+Math.min(10,result.netProfitGbp)*3+
    Math.min(10,result.stressNetProfitGbp)*4+
    (REWARD_POLICY.maxDrawdownPct-result.maxDrawdownPct)*3));
  return {...base,points,eligible:true,reason:'COST_STRESSED_TRAINING_CREDIT'};
}
export function checkTrainingReward(reward){
  if(reward===undefined)return true; // old, immutable records stay valid
  if(!reward||reward.policy!==REWARD_POLICY.version||
    !Number.isInteger(reward.points)||reward.points<0||reward.points>100||
    typeof reward.eligible!=='boolean'||typeof reward.reason!=='string'||
    reward.scope!=='IN_SAMPLE_TRAINING_ONLY'||reward.forwardVerified!==false||
    (reward.eligible&&(reward.points===0||reward.reason!=='COST_STRESSED_TRAINING_CREDIT'))||
    (!reward.eligible&&reward.points!==0))throw Error('Invalid training reward record');
  return true;
}
export function researchCredits(experiments,symbol){
  let points=0,creditedOptions=0,creditedLessons=0;
  for(const e of experiments){
    if(e.symbol!==symbol||!e.acceptedForLearning)continue;
    let qualifying=false;
    for(const o of e.trainingOptions){
      checkTrainingReward(o.researchReward);
      if(o.researchReward?.eligible){
        points+=o.researchReward.points;creditedOptions++;qualifying=true;
      }
    }
    if(qualifying)creditedLessons++;
  }
  return {points,creditedOptions,creditedLessons,scope:'TRAINING_ONLY',
    independentlyForwardVerified:false};
}
