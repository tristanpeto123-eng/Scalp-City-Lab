// Offline integration with actual persisted GitHub research-memory checkout.
// CI-only fixed FX fixture is NOT a production reference, signature, or PAPER result.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assess} from '../teacher/qualification-runner.mjs';
import {publicQualification} from './publish-teacher-screen.mjs';
const read=async path=>JSON.parse(await readFile(path,'utf8'));
test('archived research -> independent historical screen -> safe ten-chart public report',async()=>{
 const [memory,research]=await Promise.all([
   read('research-memory/scalp-learning/history.json'),
   read('research-data/robot-academy.json')
 ]);
 const result=await assess({memory,research,snapshotsDir:'validation-data',
   fx:{source:'FRANKFURTER_ECB_REFERENCE',gbpPerUsd:0.75},
   now:Date.now()});
 assert.equal(result.schema,'TEACHER_INDEPENDENT_QUALIFICATION_V1');
 assert.equal(result.pupilsTotal,10);
 assert.equal(result.admissionsIssued,0);
 assert.equal(result.brokerOrdersSubmitted,0);
 assert.equal(result.verifiedForwardGrades,0);
 const publicReport=publicQualification(result);
 assert.equal(publicReport.pupils.length,10);
 assert.equal(publicReport.eligibleCount,result.eligibleCount);
 assert.equal(publicReport.admissionsIssued,0);
 assert.equal(publicReport.brokerOrdersSubmitted,0);
 assert.equal(publicReport.verifiedForwardGrades,0);
 assert.equal(publicReport.academySourceSha256,result.academyDigest);
 assert.match(publicReport.caveat,/not PAPER admission/);
 console.log('OFFLINE_TEACHER_SCREEN_FIXTURE_ONLY',JSON.stringify({
   pupils:result.pupilsTotal,eligible:result.eligibleCount,
   blocked:result.blockedCount,orders:0,admissions:0,grades:0
 }));
});
