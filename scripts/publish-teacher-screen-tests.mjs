import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicQualification} from './publish-teacher-screen.mjs';
import {PAIRS} from '../strategy-validation-core.mjs';
const hash='e'.repeat(64);
const make=()=>({
 schema:'TEACHER_INDEPENDENT_QUALIFICATION_V1',
 source:'INDEPENDENT_HISTORICAL_SCREEN_NO_PAPER_ORDERS',
 status:'NO_ADMISSIBLE_PUPILS',checkedAt:'2026-10-19T18:00:00Z',
 latestResearchTrainingEnd:'2026-09-13T17:00:00Z',memoryDigest:hash,academyDigest:hash,
 pupilsTotal:10,availablePaperSlots:3,eligibleCount:0,blockedCount:10,
 admissionsIssued:0,brokerOrdersSubmitted:0,verifiedForwardGrades:0,
 pupils:PAIRS.map(symbol=>({symbol,ready:false,verdict:'BLOCKED',trainingTrades:22,
 trainingNetGbp:-1,trainingWinRatePct:33,trainingEnd:'2026-09-13T17:00:00Z',
 holdoutNetGbp:-.7,doubleCostNetGbp:-1.4,reasons:['NEGATIVE_OR_ZERO_TRAINING_PROFIT']}))
});
test('publishes ten screened historical pupils with explicit zero-paper boundary',()=>{
 const d=publicQualification(make());
 assert.equal(d.pupils.length,10);
 assert.equal(d.admissionsIssued,0);
 assert.equal(d.verifiedForwardGrades,0);
 assert.equal(d.pupils[0].verdict,'BLOCKED');
 assert.ok(d.caveat.includes('not PAPER admission'));
});
test('rejects order activity, forged count, duplicate chart, fake pass and mismatched permission',()=>{
 for(const mutation of [
  d=>d.brokerOrdersSubmitted=1,d=>d.admissionsIssued=1,d=>d.verifiedForwardGrades=1,
  d=>d.pupils[0].verdict='PASS',d=>d.pupils[1].symbol='BTC/USD',
  d=>d.eligibleCount=2,d=>d.status='REVIEW_REQUIRED',
  d=>d.memoryDigest='not-verified',d=>d.pupils[0].reasons=['X'.repeat(190)]
 ]){const d=make();mutation(d);assert.throws(()=>publicQualification(d),/QUALIFICATION_PUBLIC/);}
});
