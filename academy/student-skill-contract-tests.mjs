import assert from 'node:assert/strict';
import {test} from 'node:test';
import {studentSkillContract,STUDENT_SKILL_REGISTRY,assertStudentQualified} from './student-skill-contract.mjs';
test('all agreed trading skills have an implementation-status entry',()=>{
 const required=['SCOUT_REGIME','PRICE_LEVELS','CROSS_CHART_REACTION','EVENT_ANTICIPATION','EVENT_PROPAGATION','EVENT_DIRECTION_AMPLITUDE','SCOUT_EXPECTANCY','STRATEGIST','VALIDATOR','GUARDIAN_MONITOR','INDEPENDENT_EXAMINER','GOOD_BAD_MEMORY','CONTEXTUAL_SKILL_SELECTOR'];
 const known=new Set(STUDENT_SKILL_REGISTRY.map(s=>s.id));
 for(const id of required)assert.ok(known.has(id),'Missing skill '+id);
});
test('current Gold and Silver skills are explicitly incomplete',()=>{
 for(const [symbol,timeframe] of [['XAUUSD','5Min'],['XAUUSD','15Min'],['XAGUSD','15Min']]){
  const c=studentSkillContract({symbol,timeframe});
  assert.equal(c.fullSkillStackImplemented,false);
  assert.equal(c.independentExamEligible,false);
  assert.equal(c.tradingFloorAppointmentEligible,false);
  assert.ok(c.missingSkillIds.includes('PRICE_LEVELS'));
  assert.ok(c.missingSkillIds.includes('EVENT_ANTICIPATION'));
  assert.throws(()=>assertStudentQualified(c),/SKILL_GATE_BLOCKED/);
 }
});
test('assertStudentQualified independently reads known built capabilities',()=>{
 const original=studentSkillContract({symbol:'XAUUSD',timeframe:'15Min'});
 const edited={...original,fullSkillStackImplemented:true,qualifyingTraining:true,
   independentExamEligible:true,tradingFloorAppointmentEligible:true,missingSkillIds:[]};
 assert.throws(()=>assertStudentQualified(edited),/SKILL_GATE_BLOCKED/);
 assert.throws(()=>studentSkillContract({symbol:'XAGUSD',timeframe:'5Min'}),/Unsupported/);
});
