import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { SCHEMA, canonicalJson, sha256 } from '../src/audit-core.mjs';

globalThis.crypto ??= webcrypto;
const mode=process.argv[2];
const base=process.env.SCALP_CF_LOCAL_URL||'http://127.0.0.1:8787';
const token=process.env.SCALP_CF_TEST_TOKEN;
assert.ok(token&&token.length>=32,'Generated local test token required');
const attrs={
 schema:SCHEMA,symbol:'LTC/USD',modelSha256:'a'.repeat(64),
 sourceRunSha256:'b'.repeat(64),marketBarTimeframe:'5Min',
 developmentEndCandleMs:Date.UTC(2026,9,21,12),
 developmentNetGbp:-0.23,stressedNetGbp:-0.75,closedVirtualTrades:3,
 source:'GITHUB_RESEARCH_UNVERIFIED',paperOrders:0,liveOrders:0,officialGrades:0
};
const claim=async overrides=>{
 const fields={...attrs,...overrides};
 return {...fields,eventId:await sha256(canonicalJson(fields))};
};
async function api(path,{method='GET',auth=true,body,contentType='application/json'}={}){
 const headers={};
 if(auth)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']=contentType;
 const response=await fetch(base+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(15000)
 });
 return {status:response.status,headers:response.headers,body:await response.json()};
}
const valid=await claim({});
const health=await api('/health',{auth:false});
assert.equal(health.status,200);
assert.equal(health.body.status,'READY_RESEARCH_ONLY');
assert.equal(health.body.liveOrdersSubmitted,0);
assert.equal(health.body.paperOrdersSubmitted,0);
assert.equal(health.body.teacherGrades,0);
assert.equal(health.headers.get('access-control-allow-origin'),null);
assert.equal((await api('/v2/orders',{method:'POST',body:{}})).status,404);
assert.equal((await api('/v1/audit/status',{auth:false})).status,401);
assert.equal((await api('/v1/audit/research',{auth:false,method:'POST',body:valid})).status,401);
assert.equal((await api('/v1/audit/research',{method:'GET'})).status,405);

if(mode==='initial'){
 const empty=await api('/v1/audit/status');
 assert.equal(empty.status,200);
 assert.equal(empty.body.researchReceipts,0);
 const inserted=await api('/v1/audit/research',{method:'POST',body:valid});
 assert.equal(inserted.status,201);
 assert.equal(inserted.body.status,'ARCHIVED_UNVERIFIED_RESEARCH');
 assert.equal(inserted.body.seq,1);
 const retry=await api('/v1/audit/research',{method:'POST',body:valid});
 assert.equal(retry.status,200);
 assert.equal(retry.body.status,'ALREADY_ARCHIVED');
 assert.equal(retry.body.chainHash,inserted.body.chainHash);
 assert.equal((await api('/v1/audit/research',{method:'POST',
  body:{...valid,officialGrades:1}})).status,400);
 assert.equal((await api('/v1/audit/research',{method:'POST',body:valid,
  contentType:'text/plain'})).status,400);
 const second=await claim({symbol:'ETH/USD',modelSha256:'c'.repeat(64)});
 const third=await claim({symbol:'BTC/USD',modelSha256:'d'.repeat(64)});
 const parallel=await Promise.all([second,third].map(body=>api('/v1/audit/research',{method:'POST',body})));
 assert.deepEqual(parallel.map(x=>x.status),[201,201]);
 assert.deepEqual(parallel.map(x=>x.body.seq).sort(),[2,3]);
 const state=await api('/v1/audit/status');
 assert.equal(state.body.researchReceipts,3);
 assert.equal(state.body.paperOrdersSubmitted,0);
 assert.equal(state.body.tradingEnabled,false);
 assert.equal(state.body.providerOrdersVerified,0);
 const verified=await api('/v1/audit/verify');
 assert.equal(verified.status,200);
 assert.equal(verified.body.chainInternallyConsistent,true);
 assert.equal(verified.body.independentlyAttested,false);
 assert.equal(verified.body.checked,3);
 assert.equal(verified.body.latestChainHash,state.body.latestChainHash);
 assert.equal(JSON.stringify(verified).includes(token),false);
 console.log('CF_ZERO_COST_AUDIT_INITIAL_AND_PARALLEL_SQLITE_PASS');
}else if(mode==='restart'){
 const state=await api('/v1/audit/status');
 assert.equal(state.status,200);
 assert.equal(state.body.researchReceipts,3);
 const verified=await api('/v1/audit/verify');
 assert.equal(verified.body.checked,3);
 assert.equal(verified.body.chainInternallyConsistent,true);
 const retry=await api('/v1/audit/research',{method:'POST',body:valid});
 assert.equal(retry.body.status,'ALREADY_ARCHIVED');
 assert.equal((await api('/v1/audit/status')).body.researchReceipts,3);
 console.log('CF_ZERO_COST_AUDIT_RESTART_PERSISTENCE_PASS');
}else{
 throw Error('Smoke test mode must be initial or restart');
}
