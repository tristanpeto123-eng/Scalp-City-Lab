import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {
 SCHEMA,GENESIS,canonicalJson,sha256,computeChainHash,validateResearchEvent,
 validateEventId,SYMBOLS
} from '../src/audit-core.mjs';

globalThis.crypto ??= webcrypto;
const claims={
 schema:SCHEMA,symbol:'LTC/USD',modelSha256:'a'.repeat(64),
 sourceRunSha256:'b'.repeat(64),marketBarTimeframe:'5Min',
 developmentEndCandleMs:Date.UTC(2026,9,21,12,0,0),
 developmentNetGbp:-0.23,stressedNetGbp:-0.75,closedVirtualTrades:3,
 source:'GITHUB_RESEARCH_UNVERIFIED',paperOrders:0,liveOrders:0,officialGrades:0
};
async function record(x=claims){return {...x,eventId:await sha256(canonicalJson(x))};}
test('stable canonical SHA256 receipt bound to every simulated research claim',async()=>{
 const r=await record();
 assert.equal(validateResearchEvent(r).eventId,r.eventId);
 assert.equal(await validateEventId(r),true);
 assert.equal(await validateEventId({...r,stressedNetGbp:4}),false);
 assert.equal(canonicalJson({x:2,b:1}),canonicalJson({b:1,x:2}));
 assert.match(await sha256('SCALP'),/^[a-f0-9]{64}$/);
});
test('strict no-real-orders, no-grades, no keys, no outside namespaces',async()=>{
 const r=await record();
 for(const patch of [
  {paperOrders:1},{liveOrders:1},{officialGrades:1},
  {marketBarTimeframe:'1Min'},{source:'BROKER_VERIFIED'},
  {symbol:'XAUUSD'},{modelSha256:'bad'},
  {sourceRunSha256:'bad'}, {developmentNetGbp:NaN},
  {closedVirtualTrades:1.2}, {developmentEndCandleMs:0},
  {developmentEndCandleMs:r.developmentEndCandleMs+1},
  {credential:'PAPER_SECRET'},{accountId:'nope'},{gradeApproved:true}
 ]){
  assert.throws(()=>validateResearchEvent({...r,...patch}),/UNTRUSTED|UNAPPROVED/);
 }
 assert.equal(SYMBOLS.size,10);
});
test('single chained research receipt is hash-bound but not a broker attestation',async()=>{
 const r=await record();
 const t=Date.UTC(2026,9,22,12);
 const head=await computeChainHash({seq:1,eventId:r.eventId,prevHash:GENESIS,createdAtMs:t});
 const altered=await computeChainHash({seq:2,eventId:r.eventId,prevHash:GENESIS,createdAtMs:t});
 assert.notEqual(head,altered);
 assert.equal(GENESIS.length,64);
 assert.equal(typeof head,'string');
});
