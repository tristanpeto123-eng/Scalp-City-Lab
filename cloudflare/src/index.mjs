import { DurableObject } from 'cloudflare:workers';
import {
 SCHEMA,GENESIS,MAX_EVENTS,MAX_BODY_BYTES,MAX_SELF_CHECK,
 canonicalJson,computeChainHash,validateEventId,validateResearchEvent
} from './audit-core.mjs';

// Public worker has NO brokerage credentials, model loading, order endpoint,
// grading authority, scheduled trading or direct contact with Alpaca.
const securityHeaders={
 'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'
};
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:securityHeaders});
const rejection=(code,status)=>reply({status:'BLOCKED',reason:code,
 paperOrdersSubmitted:0,liveOrdersSubmitted:0,teacherGrades:0,brokerVerified:false},status);

async function authenticated(request,env){
 const secret=env.SCALP_CF_AUDIT_TOKEN;
 const header=request.headers.get('Authorization')||'';
 if(typeof secret!=='string'||secret.length<32||secret.length>256||
    !header.startsWith('Bearer ')||header.length>270)return false;
 const received=header.slice(7);
 if(received.length<1||received.length>256)return false;
 const a=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(received)));
 let mismatch=0;
 for(let i=0;i<a.length;i++)mismatch|=a[i]^b[i];
 return mismatch===0;
}

async function boundedJson(request){
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))
  throw Error('CONTENT_TYPE_REQUIRED');
 const length=Number(request.headers.get('content-length'));
 if(request.headers.has('content-length')&&(!Number.isSafeInteger(length)||length<0||length>MAX_BODY_BYTES))
  throw Error('RESEARCH_BODY_TOO_LARGE');
 const reader=request.body?.getReader();
 if(!reader)throw Error('JSON_BODY_REQUIRED');
 let size=0;
 const chunks=[];
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>MAX_BODY_BYTES)throw Error('RESEARCH_BODY_TOO_LARGE');
   chunks.push(value);
  }
 }catch(e){
  await reader.cancel().catch(()=>{});
  throw e;
 }
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{throw Error('INVALID_JSON_BODY');}
}

async function dispatch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/health'&&request.method==='GET')return reply({
  schema:'SCALP_CF_FREE_COMMISSION_V1',status:'READY_RESEARCH_ONLY',
  plan:'CLOUDFLARE_WORKERS_FREE',storage:'SQLITE_DURABLE_OBJECT',
  paperOrdersSubmitted:0,liveOrdersSubmitted:0,teacherGrades:0,
  brokerEndpointConfigured:false,noModelInference:true
 });
 if(!['/v1/audit/status','/v1/audit/research','/v1/audit/verify'].includes(path))
  return rejection('NOT_FOUND',404);
 if(!((path==='/v1/audit/research'&&request.method==='POST')||
      (path!=='/v1/audit/research'&&request.method==='GET')))
  return rejection('METHOD_NOT_ALLOWED',405);
 if(typeof env.SCALP_CF_AUDIT_TOKEN!=='string'||env.SCALP_CF_AUDIT_TOKEN.length<32)
  return rejection('PRIVATE_AUTH_NOT_CONFIGURED',503);
 if(!(await authenticated(request,env)))return rejection('NOT_AUTHORIZED',401);
 if(!env.AUDIT_LEDGER)return rejection('SQLITE_STORAGE_UNAVAILABLE',503);
 // Exactly one deterministic logical coordinator for research metadata.
 const ledger=env.AUDIT_LEDGER.getByName('single-research-audit-v1');
 if(request.method==='POST'){
  let value;
  try{
   value=validateResearchEvent(await boundedJson(request));
   if(!(await validateEventId(value)))throw Error('EVENT_DIGEST_MISMATCH');
  }catch(e){
   return rejection(['RESEARCH_BODY_TOO_LARGE','CONTENT_TYPE_REQUIRED',
    'JSON_BODY_REQUIRED','INVALID_JSON_BODY','UNAPPROVED_FIELDS',
    'UNTRUSTED_RESEARCH_EVENT','INVALID_RECORD','EVENT_DIGEST_MISMATCH'
   ].includes(e.message)?e.message:'INVALID_REQUEST',400);
  }
  return ledger.fetch(new Request('https://internal/append',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)
  }));
 }
 return ledger.fetch(new Request(path.endsWith('verify')?
  'https://internal/verify':'https://internal/status'));
}
export default {
 async fetch(request,env){
  try{return await dispatch(request,env);}
  catch{return rejection('TEMPORARY_AUDIT_FAILURE',503);}
 }
};

// This namespace never has trading credentials, broker endpoints, or money authority.
export class ResearchAudit extends DurableObject{
 constructor(ctx,env){
  super(ctx,env);
  this.sql=ctx.storage.sql;
  this.sql.exec('CREATE TABLE IF NOT EXISTS research_receipts ('+
   'seq INTEGER PRIMARY KEY,'+
   'event_id TEXT NOT NULL UNIQUE,'+
   'prev_hash TEXT NOT NULL,'+
   'chain_hash TEXT NOT NULL,'+
   'created_at_ms INTEGER NOT NULL,'+
   'body_json TEXT NOT NULL)');
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/status'&&request.method==='GET')return this.status();
  if(path==='/verify'&&request.method==='GET')return this.verify();
  if(path!=='/append'||request.method!=='POST')return rejection('NOT_FOUND',404);
  // Crypto hashing yields async. blockConcurrencyWhile ensures the head of
  // the chain cannot change before the SQL insert commits.
  return this.ctx.blockConcurrencyWhile(async()=>{
   try{return await this.append(await request.json());}
   catch{return rejection('SQLITE_AUDIT_APPEND_FAILED',503);}
  });
 }
 latest(){
  return this.sql.exec('SELECT seq,chain_hash FROM research_receipts ORDER BY seq DESC LIMIT 1').toArray()[0];
 }
 status(){
  const head=this.latest();
  return reply({schema:'SCALP_CF_AUDIT_STATUS_V1',
   status:'RESEARCH_ONLY_NOT_BROKER_VERIFIED',
   researchReceipts:head?.seq??0,latestChainHash:head?.chain_hash??GENESIS,
   submittedClaimsAreUnverified:true,providerOrdersVerified:0,
   paperOrdersSubmitted:0,liveOrdersSubmitted:0,teacherGrades:0,tradingEnabled:false});
 }
 async append(raw){
  let value;
  try{
   value=validateResearchEvent(raw);
   if(!(await validateEventId(value)))return rejection('EVENT_DIGEST_MISMATCH',400);
  }catch{return rejection('INVALID_RESEARCH_RECEIPT',400);}
  const existing=this.sql.exec(
   'SELECT seq,chain_hash,body_json FROM research_receipts WHERE event_id=?',
   value.eventId).toArray()[0];
  const json=canonicalJson(value);
  if(existing){
   if(existing.body_json!==json)return rejection('RECEIPT_ID_COLLISION',409);
   return reply({status:'ALREADY_ARCHIVED',seq:existing.seq,chainHash:existing.chain_hash,
    verifiedBrokerActivity:false,paperOrdersSubmitted:0,liveOrdersSubmitted:0,teacherGrades:0});
  }
  const head=this.latest();
  const seq=(head?.seq??0)+1;
  if(seq>MAX_EVENTS)return rejection('FREE_TIER_JOURNAL_FULL',507);
  const prevHash=head?.chain_hash??GENESIS,createdAtMs=Date.now();
  const chainHash=await computeChainHash({seq,eventId:value.eventId,prevHash,createdAtMs});
  this.sql.exec('INSERT INTO research_receipts '+
   '(seq,event_id,prev_hash,chain_hash,created_at_ms,body_json) VALUES (?,?,?,?,?,?)',
   seq,value.eventId,prevHash,chainHash,createdAtMs,json);
  return reply({status:'ARCHIVED_UNVERIFIED_RESEARCH',seq,chainHash,
   verifiedBrokerActivity:false,paperOrdersSubmitted:0,liveOrdersSubmitted:0,teacherGrades:0},201);
 }
 async verify(){
  const head=this.latest();
  if(!head)return reply({status:'EMPTY_CHAIN',checked:0,
   chainInternallyConsistent:true,independentlyAttested:false,
   paperOrdersSubmitted:0,teacherGrades:0});
  if(head.seq>MAX_SELF_CHECK)return reply({status:'SELF_CHECK_LIMIT_REACHED',
   checked:0,chainInternallyConsistent:false,independentlyAttested:false,
   paperOrdersSubmitted:0,teacherGrades:0},409);
  const records=this.sql.exec('SELECT seq,event_id,prev_hash,chain_hash,'+
   'created_at_ms,body_json FROM research_receipts ORDER BY seq ASC').toArray();
  let prev=GENESIS,expectedSeq=1;
  for(const row of records){
   const expected=await computeChainHash({
    seq:row.seq,eventId:row.event_id,prevHash:prev,createdAtMs:row.created_at_ms});
   let validBody=false;
   try{
    const body=JSON.parse(row.body_json);
    validBody=body.eventId===row.event_id&&await validateEventId(body);
   }catch{}
   if(row.seq!==expectedSeq++||row.prev_hash!==prev||expected!==row.chain_hash||!validBody)
    return rejection('HASH_CHAIN_MISMATCH',409);
   prev=row.chain_hash;
  }
  return reply({status:'SELF_CHECK_COMPLETE',checked:records.length,
   latestChainHash:prev,chainInternallyConsistent:true,
   independentlyAttested:false,brokerVerified:false,
   paperOrdersSubmitted:0,liveOrdersSubmitted:0,teacherGrades:0});
 }
}
