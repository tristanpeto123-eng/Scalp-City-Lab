import assert from 'node:assert/strict';
import {initializeSLLoop} from './sl-loop.mjs';
import {createSLVaultEnvelope,verifySLVaultEnvelope,checkPrivateSLVault,
 writePrivateSLVault,readPrivateSLVault} from './sl-model-vault.mjs';
const now=Date.parse('2026-02-21T12:00:00Z');
const start=Date.parse('2026-02-17T00:00:00Z');
const bars=Array.from({length:450},(_,i)=>{
 const o=2800+i*.007+Math.sin(i*.2)*12;
 const c=o+Math.sin(i*.33);
 return {t:new Date(start+i*300000).toISOString(),o,c,h:Math.max(o,c)+.8,l:Math.min(o,c)-.8,v:100+i%25};
});
const {state}=initializeSLLoop({bars,market:'COMMODITIES',symbol:'XAUUSD',now});
assert.ok(state.model.weights.w1.length===8);
const env=await createSLVaultEnvelope(state,{now});
assert.equal(env.market,'COMMODITIES');
assert.equal(env.revision,0);
assert.equal(env.savedAt,new Date(now).toISOString());
assert.equal(env.sha256.length,64);
assert.deepEqual(await verifySLVaultEnvelope(env),state);
assert.equal(JSON.stringify(env).includes('apikey'),false);
const fake={...env,sha256:'0'.repeat(64)};
await assert.rejects(verifySLVaultEnvelope(fake),/SHA-256 mismatch/);
await assert.rejects(createSLVaultEnvelope({...state,apiKey:'DONT_SAVE'}),/Credential-like/);
await assert.rejects(createSLVaultEnvelope({...state,model:{...state.model,activatedForTrading:true}}),/invalid or active/);
let saved=null,requests=[];
const api=async(url,opts)=>{
 requests.push({url,method:opts.method,body:opts.body||null,headers:opts.headers});
 const info=url.endsWith('/repos/tristanpeto123-eng/private-sl-vault');
 if(info)return {status:200,ok:true,json:async()=>({private:true,visibility:'private',default_branch:'main'})};
 if(url.includes('/contents/')){
  if(opts.method==='PUT'){
   const body=JSON.parse(opts.body);
   assert.equal(body.branch,'main');
   assert.equal(body.message,'checkpoint(sl): COMMODITIES XAUUSD rev 0');
   saved=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(body.content),x=>x.charCodeAt(0))));
   return {status:201,ok:true,json:async()=>({content:{sha:'test-sha'}})};
  }
  if(!saved)return {status:404,ok:false,json:async()=>({message:'Not Found'})};
  const str=JSON.stringify(saved);
  const bytes=new TextEncoder().encode(str);
  const val=btoa(String.fromCharCode(...bytes));
  return {status:200,ok:true,json:async()=>({sha:'test-sha',content:val})};
 }
 throw Error('Unexpected path '+url);
};
const cfg={owner:'tristanpeto123-eng',repo:'private-sl-vault',token:'PRIVATE_FAKE_TOKEN',fetchImpl:api};
const probe=await checkPrivateSLVault(cfg);
assert.equal(probe.private,true);
const result=await writePrivateSLVault({...cfg,envelope:env});
assert.equal(result.verified,true);
assert.equal(result.changed,true);
assert.ok(saved.state.model.weights.w1.length===8);
assert.ok(saved.state.memory.good.length+saved.state.memory.bad.length>=40);
assert.equal(JSON.stringify(saved).includes('PRIVATE_FAKE_TOKEN'),false);
const unchanged=await writePrivateSLVault({...cfg,envelope:env});
assert.equal(unchanged.verified,true);
assert.equal(unchanged.changed,false);
assert.equal(requests.filter(x=>x.method==='PUT').length,1);
assert.equal(requests.some(x=>x.url.includes('PRIVATE_FAKE_TOKEN')),false);
assert.ok(requests.every(x=>x.headers.Authorization==='Bearer PRIVATE_FAKE_TOKEN'));
const read=await readPrivateSLVault({...cfg,market:'COMMODITIES',symbol:'XAUUSD'});
assert.equal(read.sha256,env.sha256);
assert.deepEqual(await verifySLVaultEnvelope(read),state);
await assert.rejects(writePrivateSLVault({...cfg,repo:'Scalp-City-Lab',envelope:env}),/PRIVATE/);
const publicFetch=async()=>({status:200,ok:true,json:async()=>({private:false,visibility:'public',default_branch:'main'})});
await assert.rejects(checkPrivateSLVault({...cfg,repo:'public-vault',fetchImpl:publicFetch}),/not private/);
await assert.rejects(readPrivateSLVault({...cfg,market:'FOREX',symbol:'EURUSD'}),/No SL model checkpoint/);
const changedState={...state,revisions:1};
const newer=await createSLVaultEnvelope(changedState,{now:now+5000});
assert.equal((await writePrivateSLVault({...cfg,envelope:newer})).changed,true);
await assert.rejects(writePrivateSLVault({...cfg,envelope:env}),/newer/);
const conflict=await createSLVaultEnvelope({...changedState,selectedNetPnlGbp:5},{now:now+6000});
await assert.rejects(writePrivateSLVault({...cfg,envelope:conflict}),/conflicts/);
console.log('SL MODEL VAULT PASS: native weights saved, integrity verified, private repo lock, token never stored, remote readback, latest revision, conflict gate, downloadable restore');