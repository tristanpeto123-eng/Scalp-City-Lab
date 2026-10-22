/**
 * Manual, authenticated publish of at most ten unverified research receipts.
 * Run ONLY in a manually-approved GitHub Action after Worker token setup.
 * Never prints secrets and never performs broker/order operations.
 */
import { readFileSync } from 'node:fs';
import { convertReport } from './export-research-receipts.mjs';

const endpoint=process.env.SCALP_CF_FREE_WORKER_URL;
const token=process.env.SCALP_CF_AUDIT_TOKEN;
const reportPath=process.argv[2];
if(!endpoint||!token||token.length<32||!reportPath)
 throw Error('RESEARCH_SYNC_NOT_CONFIGURED');
const u=new URL(endpoint);
if(u.protocol!=='https:'||
   u.port||u.username||u.password||u.search||u.hash||
   !/^scalp-city-free-audit\.[a-z0-9-]+\.workers\.dev$/.test(u.hostname)||
   u.pathname!=='/')
 throw Error('RESEARCH_SYNC_HOST_NOT_ALLOWLISTED');
const events=await convertReport(JSON.parse(readFileSync(reportPath,'utf8')));
if(events.length!==10)throw Error('RESEARCH_COUNT_INVALID');
for(const event of events){
 const resp=await fetch(new URL('/v1/audit/research',u),{
  method:'POST',redirect:'error',
  headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(event),
  signal:AbortSignal.timeout(12000)
 });
 const status=resp.status;
 const output=await resp.json().catch(()=>({}));
 if(!(status===200&&output.status==='ALREADY_ARCHIVED')&&
    !(status===201&&output.status==='ARCHIVED_UNVERIFIED_RESEARCH')){
  console.error('RESEARCH_SYNC_BLOCKED '+event.symbol+
    ' HTTP='+status+' classification='+(output.reason||'UNKNOWN'));
  process.exitCode=1;
  break;
 }
 console.log('RESEARCH_ONLY '+event.symbol+' '+output.status+
   ' receipt='+event.eventId.slice(0,12));
}
