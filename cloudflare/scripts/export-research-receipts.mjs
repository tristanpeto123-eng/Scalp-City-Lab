/**
 * Offline conversion of authenticated GitHub *research* report JSON to
 * explicitly unverified, idempotent Cloudflare receipts. No brokerage.
 *
 * Usage: node cloudflare/scripts/export-research-receipts.mjs <report.json>
 * Emits 10 JSONL records, for manual protected ingestion only.
 */
import { readFileSync } from 'node:fs';
import {
 SCHEMA,SYMBOLS,canonicalJson,sha256,validateResearchEvent
} from '../src/audit-core.mjs';

export async function convertReport(report) {
 if(!report||report.schema!=='SCALP_RAPID_RL_REPLAY_V1'||
    report.marketBarTimeframe!=='5Min'||
    report.decisionsAreNotBrokerTrades!==true||
    report.paperOrders!==0||report.liveOrders!==0||
    report.verifiedForwardGrades!==0||report.automaticAdmissions!==0||
    report.sealedHoldoutAccessed!==false||
    !Array.isArray(report.pupils)||report.pupils.length!==10)
  throw Error('RESEARCH_REPORT_PROVENANCE_INCOMPLETE');
 const symbols=new Set();
 const out=[];
 for(const p of report.pupils){
  if(!SYMBOLS.has(p?.symbol)||symbols.has(p.symbol)||
    p.marketTimeframe!=='5Min'||p.researchOnly!==true||
    p.forwardVerified!==false||p.paperOrders!==0)
    throw Error('PUPIL_PROVENANCE_NOT_RESEARCH_ONLY');
  symbols.add(p.symbol);
  const fields={
   schema:SCHEMA,
   symbol:p.symbol,
   modelSha256:p.modelSha256,
   sourceRunSha256:p.sourceTrainingFingerprint,
   marketBarTimeframe:'5Min',
   developmentEndCandleMs:p.validationThrough,
   developmentNetGbp:p.laterDevelopmentNetGbp,
   stressedNetGbp:p.laterDevelopmentStressedNetGbp,
   closedVirtualTrades:p.simulatedClosedTradesThisRun,
   source:'GITHUB_RESEARCH_UNVERIFIED',
   paperOrders:0,liveOrders:0,officialGrades:0
  };
  const record=validateResearchEvent({...fields,
    eventId:await sha256(canonicalJson(fields))});
  out.push(record);
 }
 return out.sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
if(process.argv[1]&&process.argv[1].endsWith('export-research-receipts.mjs')){
 const path=process.argv[2];
 if(!path)throw Error('Supply an actual RL report path');
 const receipts=await convertReport(JSON.parse(readFileSync(path,'utf8')));
 for(const record of receipts)process.stdout.write(JSON.stringify(record)+'\n');
}
