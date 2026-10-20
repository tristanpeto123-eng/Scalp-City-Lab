import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {requireMatchingAcademySource} from '../teacher/historical-screen-client.mjs';
const academy=()=>({schema:'ROBOT_ACADEMY_RESEARCH_V1',source:'GITHUB_PERSISTED_HISTORICAL_TRAINING',
 actualBrokerOrders:0,verifiedForwardGrades:0,latestTrainingEnd:'2026-09-13T17:00:00.000Z',
 pupils:Array.from({length:10},(_,i)=>({symbol:String(i)}))});
const report=a=>({schema:'TEACHER_PUBLIC_HISTORICAL_SCREEN_V1',lastResearchTrainingEnd:a.latestTrainingEnd,
 academySourceSha256:createHash('sha256').update(JSON.stringify(a)).digest('hex')});
test('source-matched historical report can be displayed but cannot certify a trade',async()=>{
 const a=academy(),r=report(a);
 const check=await requireMatchingAcademySource({academy:a,screen:r,cryptoProvider:webcrypto});
 assert.equal(check.sourceMatched,true);
 assert.equal(check.academySourceSha256,r.academySourceSha256);
 assert.equal('admissionsIssued' in check,false);
});
test('fail closed if screen references older Academy data, fake data or cannot hash',async()=>{
 const a=academy(),r=report(a);
 const mutated={...a,pupils:a.pupils.map(x=>({...x}))};mutated.pupils[0].symbol='MODIFIED';
 const cases=[
  {academy:mutated,screen:r,cryptoProvider:webcrypto},
  {academy:{...a,actualBrokerOrders:1},screen:r,cryptoProvider:webcrypto},
  {academy:a,screen:{...r,lastResearchTrainingEnd:'2026-10-19T19:00:00Z'},cryptoProvider:webcrypto},
  {academy:a,screen:{...r,academySourceSha256:'0'.repeat(64)},cryptoProvider:webcrypto},
  {academy:a,screen:r,cryptoProvider:{subtle:null}}
 ];
 for(const args of cases)await assert.rejects(requireMatchingAcademySource(args),/source reconciliation|does not match/);
});
