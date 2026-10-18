// Read-only external smoke test. No Alpaca credentials, account queries or writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const cfg=JSON.parse(await readFile(new URL('../teacher/public-settings.json',import.meta.url),'utf8'));
assert.equal(cfg.status,'CONFIGURED');
const endpoint=new URL(cfg.feedUrl),ping=new URL(cfg.connectionUrl);
assert.equal(endpoint.protocol,'https:');
assert.equal(endpoint.origin,ping.origin);
const get=async url=>{
 const response=await fetch(url,{method:'GET',redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
 return {status:response.status,json:await response.json()};
};
const base=endpoint.origin;
const health=await get(base+'/health');
assert.equal(health.status,200,'Railway signed gateway is not answering HTTPS');
assert.equal(health.json.service,'public-signed-paper-gateway');
const connection=await get(ping.href);
assert.equal(connection.status,200,'Private examiner/gateway authenticated handshake failed');
assert.equal(connection.json.schema,'TEACHER_PUBLIC_CONNECTION_V1');
assert.equal(connection.json.signerPinned,true);
assert.equal(connection.json.privateExaminerLinked,true);
assert.equal(connection.json.paperOrdersEnabled,false,
  'Paper execution unexpectedly armed without a separate release');
assert.equal(connection.json.examinerStatus,'NOT_ADMITTED');
const grades=await get(endpoint.href);
assert.equal(grades.status,503,
  'No authenticated paper examination exists; publishing a grade now would be wrong');
assert.equal(grades.json.verifiedPaperGrades,0);
assert.equal(grades.json.paperOrdersEnabled,false);
console.log(JSON.stringify({
  schema:'TEACHER_RAILWAY_SMOKE_V1',
  host:base,https:true,privateExaminerLinked:true,signerPinned:true,
  orderExecution:'LOCKED',verifiedGrades:0,result:'PASS'
}));
