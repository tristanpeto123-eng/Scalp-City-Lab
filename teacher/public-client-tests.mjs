import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PAIRS,checkResearch,checkSignedReport,readSignedPaperFeed,
  readResearch} from './public-client.mjs';
const base='https://scalp.example/Scalp-City-Lab/trading-floor.html';
const source=JSON.parse(await readFile(new URL('../research-data/robot-academy.json',import.meta.url),'utf8'));
const keypair=generateKeyPairSync('ed25519');
const pub=keypair.publicKey.export({type:'spki',format:'der'}).toString('base64');
const record={
 schema:'ROBOT_ACADEMY_SIGNED_FORWARD_V1',source:'SERVER_VERIFIED_ALPACA_PAPER',
 paperOnly:true,generatedAt:'2026-10-18T01:30:00.000Z',verifiedCount:1,
 pupils:[{symbol:'BTC/USD',status:'VERIFIED_FORWARD_GRADE',
   closedTrades:30,wins:24,grade:8,netProfitGbp:1.5,
   maxDrawdownPct:5,qualified:true,modelId:'valid-paper-model',
   evidenceHash:'a'.repeat(64)}]
};
const report=p=>({algorithm:'Ed25519',payload:p,signature:sign(null,
 Buffer.from(JSON.stringify(p)),keypair.privateKey).toString('base64')});
function mockFetch({payload=record,signed=report(payload),configured=true}={}){
 return async url=>{
   if(url.endsWith('/research-data/robot-academy.json'))
      return {ok:true,json:async()=>source};
   if(url.endsWith('/teacher/public-settings.json'))
      return {ok:true,json:async()=>({
        schema:'ROBOT_ACADEMY_PUBLIC_SETTINGS_V1',
        status:configured?'CONFIGURED':'NOT_PROVISIONED',
        feedUrl:'https://paper.example/api/academy',
        signingPublicKeyBase64:pub
      })};
   if(url==='https://paper.example/api/academy')
     return {ok:true,json:async()=>signed};
   throw Error('Mock must never call outside read-only whitelisted sources: '+url);
 };
}
const now=Date.parse('2026-10-18T02:00:00.000Z');
test('ten genuine research pupils validated; no historical champion is a paper graduate',()=>{
 assert.equal(PAIRS.length,10);
 const data=checkResearch(source);
 assert.equal(data.pupils.length,10);
 assert.ok(data.pupils.every(p=>p.researchLeader?.trainingNetGbp<0));
 assert.throws(()=>checkResearch({...source,verifiedForwardGrades:1}),/provenance/);
});
test('read-only Academy research loads actual file with no order permissions',async()=>{
 const research=await readResearch({fetchImpl:mockFetch(),baseUrl:base});
 assert.equal(research.pupils[0].symbol,'BTC/USD');
});
test('signed forward grade validates exact reported win-rate and independent P&L',()=>{
 const verified=checkSignedReport(record,now);
 assert.equal(verified.grades.get('BTC/USD').grade,8);
 assert.throws(()=>checkSignedReport({...record,verifiedCount:2},now),/tally/);
 assert.throws(()=>checkSignedReport({...record,pupils:[{...record.pupils[0],grade:10}]},now),/arithmetic/);
 assert.throws(()=>checkSignedReport({...record,pupils:[{...record.pupils[0],qualified:false}]},now),/arithmetic/);
 assert.throws(()=>checkSignedReport({...record,generatedAt:'2026-10-10T01:00:00Z'},now),/schema\/time/);
});
test('production signed feed verifies Ed25519 key before admitting any grade',async()=>{
 const valid=await readSignedPaperFeed({fetchImpl:mockFetch(),webcrypto,baseUrl:base,now});
 assert.equal(valid.grades.size,1);
 assert.equal(valid.grades.get('BTC/USD').wins,24);
});
test('tampered signature, absent publisher and missing fee grade never graduate',async()=>{
 const altered={...record,pupils:[{...record.pupils[0],wins:29,grade:9}]};
 await assert.rejects(readSignedPaperFeed({fetchImpl:mockFetch({signed:{
   ...report(record),payload:altered}}),webcrypto,baseUrl:base,now}),/signature/);
 await assert.rejects(readSignedPaperFeed({fetchImpl:mockFetch({configured:false}),
   webcrypto,baseUrl:base,now}),/NOT_PROVISIONED/);
 const pending={...record,verifiedCount:0,pupils:[{
   symbol:'BTC/USD',status:'EVIDENCE_PENDING',reason:'CFEE waiting'}]};
 const wait=await readSignedPaperFeed({fetchImpl:mockFetch({payload:pending}),
   webcrypto,baseUrl:base,now});
 assert.equal(wait.grades.size,0);
});
test('trading-floor app imports the authoritative verifier; broker trades are inaccessible',async()=>{
 const html=await readFile(new URL('../trading-floor.html',import.meta.url),'utf8');
 assert.match(html,/teacher\/public-client\.mjs/);
 assert.match(html,/readSignedPaperFeed/);
 assert.match(html,/readResearch/);
 assert.match(html,/teacher-console\.html\?pupil=/);
 assert.match(html,/Synthetic demo only/);
 assert.doesNotMatch(html,/APCA-API-SECRET-KEY|TEACHER_PAPER_CREDENTIALS_JSON/);
 assert.doesNotMatch(html,/paperOrder\s*\(|\/v2\/orders/);
 const office=await readFile(new URL('../teacher-console.html',import.meta.url),'utf8');
 assert.match(office,/URLSearchParams\(location\.search\)/);
 assert.match(office,/Ed25519/);
});
