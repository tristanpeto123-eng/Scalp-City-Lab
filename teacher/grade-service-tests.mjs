import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {serve} from './grade-service.mjs';
import {makeReport} from './grade-pipeline.mjs';
test('paper-grade read-only HTTP service rejects forged, expired, unsigned and missing evidence',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'scalp-public-grade-'));
 const keys=generateKeyPairSync('ed25519');
 assert.throws(()=>serve({directory:root,port:0}),/verifier key required/);
 const service=serve({directory:root,publisherPublicKey:keys.publicKey,port:0});
 await once(service,'listening');
 const base='http://127.0.0.1:'+service.address().port+'/api/academy';
 try{
   const missing=await fetch(base);assert.equal(missing.status,503);
   assert.equal(missing.headers.get('cache-control'),'no-store');
   assert.equal(missing.headers.get('access-control-allow-origin'),'https://tristanpeto123-eng.github.io');
   const bundle=await makeReport({records:[],publisherPrivateKey:keys.privateKey});
   const file=path.join(root,'public-exam-report.json');
   await writeFile(file,JSON.stringify(bundle));
   const published=await fetch(base);assert.equal(published.status,200);
   const parsed=await published.json();
   assert.equal(parsed.payload.verifiedCount,0);
   assert.equal(parsed.payload.paperOnly,true);
   assert.equal((await fetch(base,{method:'POST'})).status,404);
   await writeFile(file,JSON.stringify({...bundle,payload:{
     ...bundle.payload,verifiedCount:10}}));
   assert.equal((await fetch(base)).status,503);
   await writeFile(file,JSON.stringify({...bundle,payload:{
     ...bundle.payload,generatedAt:'2001-01-01T00:00:00.000Z'}}));
   assert.equal((await fetch(base)).status,503);
   await writeFile(file,'{"unsigned":true}');
   assert.equal((await fetch(base)).status,503);
 }finally{
   await new Promise((resolve,reject)=>service.close(e=>e?reject(e):resolve()));
   await rm(root,{recursive:true,force:true});
 }
});
