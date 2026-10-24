/**
 * Scalp City SL checkpoint vault: SHA-256 verified portable model state and
 * opt-in private GitHub repository storage. No backend/live trading interface.
 *
 * Callers provide a fine-grained token at runtime; neither token nor provider
 * key is ever included in the envelope, URL, localStorage, or commit body.
 */
import {SL_LOOP_SCHEMA} from './sl-loop.mjs';
import {validateSLMemory,SL_FEATURES,predictSL} from './sl-core.mjs';
export const SL_VAULT_SCHEMA='SL_MODEL_VAULT_V1';
const CREDENTIAL_FIELD=/^(?:api[-_]?key|token|secret|password|authorization|credential|private[-_]?key)$/i;
const ascii=/^[A-Za-z0-9_.-]+$/;
const utf8=new TextEncoder();
const bytesHex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const bytesB64=bytes=>{
 let result='';
 for(let i=0;i<bytes.length;i+=12000){
  const part=bytes.subarray(i,i+12000);
  result+=String.fromCharCode(...part);
 }
 return btoa(result);
};
const b64Text=str=>{
 const clean=str.replace(/\s/g,'');
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)||clean.length%4!==0)throw Error('GitHub vault returned invalid base64 content');
 const decoded=atob(clean),buf=Uint8Array.from(decoded,c=>c.charCodeAt(0));
 return new TextDecoder('utf-8',{fatal:true}).decode(buf);
};
async function sha256(contents){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)throw Error('Secure context required for SHA-256 vault integrity');
 return bytesHex(new Uint8Array(await subtle.digest('SHA-256',utf8.encode(contents))));
}
function scanCredentials(node){
 if(!node||typeof node!=='object')return;
 for(const [key,value] of Object.entries(node)){
  if(CREDENTIAL_FIELD.test(key))throw Error('Credential-like key is forbidden from SL vault snapshots: '+key);
  if(value&&typeof value==='object')scanCredentials(value);
 }
}
export function validateSLVaultState(state){
 if(!state||state.schema!==SL_LOOP_SCHEMA||!state.config||!state.model||
  !Array.isArray(state.tail)||state.tail.length<25||
  typeof state.cursor!=='string'||!Number.isFinite(Date.parse(state.cursor))||
  !state.lastBar||!Array.isArray(state.events)||
  !Number.isInteger(state.revisions)||state.revisions<0)
  throw Error('Not a complete SL neural learning checkpoint');
 if(!['COMMODITIES','FOREX','INDICES'].includes(state.config.market)||
  typeof state.config.symbol!=='string'||!ascii.test(state.config.symbol)||
  state.config.symbol.length<2||state.config.symbol.length>24)
  throw Error('Vault SL market or symbol invalid');
 const memory=validateSLMemory(state.memory);
 if(memory.market!==state.config.market)throw Error('Vault memory and market mismatch');
 const m=state.model;
 if(m.market!==state.config.market||m.strategy!=='SL'||m.activatedForTrading!==false||
  !m.weights||m.weights.w1?.length!==8||m.weights.w2?.length!==8||
  m.weights.b1?.length!==8||
  m.weights.w1.some(row=>!Array.isArray(row)||row.length!==SL_FEATURES.length||row.some(v=>!Number.isFinite(v)))||
  m.weights.w2.some(v=>!Number.isFinite(v))||
  m.weights.b1.some(v=>!Number.isFinite(v))||!Number.isFinite(m.weights.b2))
  throw Error('Vault neural weights are invalid or active for broker trading');
 predictSL(m,Array(SL_FEATURES.length).fill(0),state.config.market);
 scanCredentials(state);
 if(JSON.stringify(state).length>5000000)throw Error('SL model checkpoint exceeds 5MB size limit');
 return state;
}
export async function createSLVaultEnvelope(state,{now=Date.now()}={}){
 validateSLVaultState(state);
 const copy=JSON.parse(JSON.stringify(state));
 return {
  schema:SL_VAULT_SCHEMA,
  strategy:'SL',
  market:copy.config.market,
  symbol:copy.config.symbol,
  revision:copy.revisions,
  savedAt:new Date(now).toISOString(),
  sha256:await sha256(JSON.stringify(copy)),
  state:copy
 };
}
export async function verifySLVaultEnvelope(envelope){
 if(!envelope||envelope.schema!==SL_VAULT_SCHEMA||
  typeof envelope.sha256!=='string'||!/^[a-f0-9]{64}$/.test(envelope.sha256))
  throw Error('File is not a SHA-256 SL model checkpoint');
 validateSLVaultState(envelope.state);
 if(envelope.market!==envelope.state.config.market||
  envelope.symbol!==envelope.state.config.symbol||
  envelope.revision!==envelope.state.revisions)
  throw Error('Model vault metadata does not match the saved neural state');
 if(await sha256(JSON.stringify(envelope.state))!==envelope.sha256)
  throw Error('Model vault SHA-256 mismatch: backup was changed or corrupted');
 return envelope.state;
}
function secureRepo(owner,repo){
 if(!ascii.test(owner)||!ascii.test(repo)||owner.length>100||repo.length>100||
   !owner||!repo)throw Error('Enter a valid private GitHub owner/repository');
 const blocked=['Scalp-City-Lab','Scalp-City-1','Scalp-City','Scalp-City-3D-UI-Test'];
 if(owner.toLowerCase()==='tristanpeto123-eng'&&blocked.some(x=>x.toLowerCase()===repo.toLowerCase()))
  throw Error('Your Scalp City code repositories are public. Use a separate PRIVATE GitHub repository for trained model backups.');
 return {owner,repo};
}
function header(token){return {'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
  'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};}
async function api(url,token,fetchImpl,options={}){
 if(typeof token!=='string'||token.length<8||token.length>512)
  throw Error('Enter a fine-grained token restricted to the private model-vault repository');
 const result=await fetchImpl(url,{
  ...options,headers:header(token),method:options.method||'GET',
  mode:'cors',redirect:'error',cache:'no-store',credentials:'omit'
 });
 if(!result||typeof result.status!=='number')throw Error('GitHub vault network error');
 if(result.status===404)return {missing:true};
 if(!result.ok)throw Error('GitHub vault error HTTP '+result.status+' (check token, repository permission and private status)');
 return await result.json();
}
export async function checkPrivateSLVault({owner,repo,token,fetchImpl=fetch}={}){
 secureRepo(owner,repo);
 const info=await api('https://api.github.com/repos/'+owner+'/'+repo,token,fetchImpl);
 if(info.missing)throw Error('Private GitHub vault repository not found or token has no access');
 if(info.private!==true||info.visibility==='public')
  throw Error('Refusing to store trading model: GitHub vault repository is not private');
 if(typeof info.default_branch!=='string'||!ascii.test(info.default_branch))
  throw Error('GitHub vault repository lacks a valid default branch');
 return {owner,repo,branch:info.default_branch,private:true};
}
function vaultPath(state){
 validateSLVaultState(state);
 return 'sl-learning/'+state.config.market+'/'+state.config.symbol+'/latest.json';
}
function contentsUrl(vault,path){
 return 'https://api.github.com/repos/'+vault.owner+'/'+vault.repo+'/contents/'+
   path.split('/').map(encodeURIComponent).join('/');
}
async function readContent(url,token,fetchImpl){
 const existing=await api(url,token,fetchImpl);
 if(existing.missing)return null;
 if(typeof existing.content!=='string'||typeof existing.sha!=='string')throw Error('Invalid GitHub checkpoint content');
 const envelope=JSON.parse(b64Text(existing.content));
 await verifySLVaultEnvelope(envelope);
 return {envelope,gitSha:existing.sha};
}
export async function writePrivateSLVault({owner,repo,token,envelope,fetchImpl=fetch}={}){
 const state=await verifySLVaultEnvelope(envelope);
 const vault=await checkPrivateSLVault({owner,repo,token,fetchImpl});
 const url=contentsUrl(vault,vaultPath(state));
 const existing=await readContent(url,token,fetchImpl);
 if(existing?.envelope.state.cursor===state.cursor&&
    existing.envelope.sha256===envelope.sha256)
  return {verified:true,changed:false,savedAt:existing.envelope.savedAt,
    sha256:envelope.sha256,repository:owner+'/'+repo,revision:state.revisions};
 if(existing?.envelope.revision>envelope.revision)
  throw Error('Remote checkpoint is newer; refusing to overwrite learned weights');
 if(existing){
  const previous=existing.envelope.state;
  const newerTime=Date.parse(state.cursor),previousTime=Date.parse(previous.cursor);
  if(newerTime<previousTime)
   throw Error('Remote checkpoint has a newer candle cursor; restore before overwriting');
  if(newerTime===previousTime)
   throw Error('Remote checkpoint has different weights at the same candle; restore/reconcile the model fork');
  // If no model update occurred, the progress-only next-bar checkpoint must retain
  // the previously read terminal bar. A missing overlap implies a fork or gap.
  if(existing.envelope.revision===envelope.revision&&
     !state.tail.some(b=>b.t===previous.cursor&&
       JSON.stringify(b)===JSON.stringify(previous.lastBar)))
   throw Error('Remote checkpoint cursor overlap could not be verified; restore and reconcile');
 }
 const payload={branch:vault.branch,
  message:'checkpoint(sl): '+state.config.market+' '+state.config.symbol+' rev '+state.revisions,
  content:bytesB64(utf8.encode(JSON.stringify(envelope,null,2)))};
 if(existing)payload.sha=existing.gitSha;
 await api(url,token,fetchImpl,{method:'PUT',body:JSON.stringify(payload)});
 const readBack=await readContent(url,token,fetchImpl);
 if(!readBack||readBack.envelope.sha256!==envelope.sha256)
  throw Error('Remote vault write could not be verified by readback');
 return {verified:true,changed:true,savedAt:readBack.envelope.savedAt,
  sha256:envelope.sha256,repository:owner+'/'+repo,revision:state.revisions};
}
export async function readPrivateSLVault({owner,repo,token,market,symbol,fetchImpl=fetch}={}){
 const vault=await checkPrivateSLVault({owner,repo,token,fetchImpl});
 if(!['COMMODITIES','FOREX','INDICES'].includes(market)||
  !ascii.test(symbol||''))throw Error('Specify valid SL market/symbol for remote restore');
 const url=contentsUrl(vault,'sl-learning/'+market+'/'+symbol+'/latest.json');
 const found=await readContent(url,token,fetchImpl);
 if(!found)throw Error('No SL model checkpoint exists yet in this private repository');
 if(found.envelope.market!==market||found.envelope.symbol!==symbol)
  throw Error('Remote model does not match selected market');
 return found.envelope;
}
