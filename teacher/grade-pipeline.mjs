// Server-side independent examiner: reconciliation -> dated FX -> grade.
// No POST, browser input or broker orders in this module.
import {createHash,sign,verify,createPublicKey} from 'node:crypto';
import {reconcilePaper} from './evidence.mjs';
import {evaluateGrade} from './engine.mjs';
import {verifyAdmission} from './admission-seal.mjs';
import {DailyGBPReference} from './fx-reference.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function gradePupil({
  record,signingSecret,broker,journal,
  fx=new DailyGBPReference(),now=Date.now()
}={}){
  const admission=verifyAdmission(record,signingSecret),symbol=admission.symbol;
  const modelId=admission.modelId;
  if((await journal.unresolved()).some(e=>e.symbol===symbol))
    return {symbol,modelId,status:'EVIDENCE_PENDING',reason:'Unresolved order intent',grade:null};
  const [account,orders,activities,positions,openOrders,owned]=await Promise.all([
    broker.account(symbol),broker.recentOrders(symbol),
    broker.activities(symbol,['FILL','CFEE','FEE']),
    broker.positions(symbol),broker.openOrders(symbol),
    journal.orderIds(symbol)
  ]);
  if(account.status!=='ACTIVE'||!account.id)
    throw Error('GRADER: account is not authenticated and active');
  const evidence=reconcilePaper({symbol,modelId,admissionStartedAt:admission.startedAt,
    orders,activities,journalOrderIds:owned,positions,openOrders,
    accountId:account.id,now});
  if(!evidence.verifiedByPaperBroker)
    return {symbol,modelId,status:'EVIDENCE_PENDING',reason:evidence.reason,grade:null};
  // Profitability alone is not enough: confirm the complete marked-to-market
  // excursion from the private, hash-chained exam journal before any final grade.
  const riskMarks=await journal.virtualEvidence(symbol,admission.startedAt);
  if(!Array.isArray(riskMarks)||riskMarks.length<evidence.closedTrades.length||
     !riskMarks.length)
    return {symbol,modelId,status:'EVIDENCE_PENDING',reason:'Insufficient independent mark-to-market journal',grade:null};
  const sortedMarks=[...riskMarks].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const firstTrade=evidence.closedTrades[0],lastTrade=evidence.closedTrades.at(-1);
  if(firstTrade&&(Date.parse(sortedMarks[0].at)>Date.parse(firstTrade.openedAt)||
      Date.parse(sortedMarks.at(-1).at)<Date.parse(lastTrade.closedAt)))
    return {symbol,modelId,status:'EVIDENCE_PENDING',reason:'Mark-to-market timeline does not cover all trades',grade:null};
  let peakMark=50,observedDrawdown=0,lastAt=0;
  const seenSeq=new Set();
  for(const mark of sortedMarks){
    const t=Date.parse(mark.at);
    if(!Number.isFinite(t)||t<lastAt||t>Date.parse(new Date(now).toISOString())||
       !Number.isFinite(mark.equity)||mark.equity<0||
       !Number.isInteger(mark.sequence)||seenSeq.has(mark.sequence))
      throw Error('GRADER: invalid or duplicated independent risk journal');
    seenSeq.add(mark.sequence);lastAt=t;
    peakMark=Math.max(peakMark,mark.equity);
    observedDrawdown=Math.max(observedDrawdown,100*(peakMark-mark.equity)/peakMark);
  }
  const ratesByCloseId=[];
  for(const t of evidence.closedTrades){
    const reference=await fx.on(t.closedAt);
    ratesByCloseId.push({id:t.closeId,gbpPerUsd:reference.gbpPerUsd,
      sourceDate:reference.date});
  }
  const fxEvidence={verified:true,source:'FRANKFURTER_ECB_REFERENCE',ratesByCloseId};
  const grade=evaluateGrade({admission,brokerEvidence:evidence,
    fxEvidence,feeEvidence:evidence.feeEvidence});
  grade.maxDrawdownPct=Number(Math.max(grade.maxDrawdownPct,observedDrawdown).toFixed(4));
  grade.qualified=grade.status==='VERIFIED_FORWARD_GRADE'&&
    grade.netProfitGbp>0&&grade.maxDrawdownPct<=10;
  return {...grade,
    brokerAccountFingerprint:sha(account.id).slice(0,16),
    evidenceHash:sha({orders,activities,fxEvidence,riskMarks,admissionFingerprint:admission.fingerprint}),
    method:'SERVER_RECONCILED_FILLS_CFEE_DAILY_ECB_V1',
    checkedAt:new Date(now).toISOString()};
}
export async function makeReport({records,signingSecret,broker,journal,fx,
  publisherPrivateKey,now=Date.now()}={}){
  if(!Array.isArray(records)||records.length>10||!publisherPrivateKey)
    throw Error('PUBLISHER: admissions and signing key required');
  const results=[];
  for(const r of records){
    // A failed broker query invalidates the ENTIRE publication, never
    // silently re-label a connection outage as zero verified trades.
    results.push(await gradePupil({record:r,signingSecret,broker,journal,fx,now}));
  }
  const payload={schema:'ROBOT_ACADEMY_SIGNED_FORWARD_V1',
    source:'SERVER_VERIFIED_ALPACA_PAPER',generatedAt:new Date(now).toISOString(),
    verifier:'ACADEMY-TEACHER-0.2.0-rc1',paperOnly:true,
    verifiedCount:results.filter(x=>x.status==='VERIFIED_FORWARD_GRADE').length,
    pupils:results.map(x=>({
      symbol:x.symbol,status:x.status,
      ...(x.status==='VERIFIED_FORWARD_GRADE'?{
        closedTrades:x.closedTrades,wins:x.wins,grade:x.grade,
        netProfitGbp:x.netProfitGbp,maxDrawdownPct:x.maxDrawdownPct,
        qualified:x.qualified,modelId:x.modelId,
        evidenceHash:x.evidenceHash
      }:{reason:x.reason||'Forward evidence not final'})
    }))};
  const data=Buffer.from(JSON.stringify(payload),'utf8');
  const signature=sign(null,data,publisherPrivateKey).toString('base64');
  return {payload,signature,algorithm:'Ed25519'};
}
export function verifyReport(bundle,publisherPublicKey){
  if(bundle?.algorithm!=='Ed25519'||!bundle.payload||!bundle.signature)
    throw Error('PUBLISHER: unsigned report');
  if(!verify(null,Buffer.from(JSON.stringify(bundle.payload),'utf8'),
       (publisherPublicKey?.type==='public'?publisherPublicKey:createPublicKey(publisherPublicKey)),Buffer.from(bundle.signature,'base64')))
    throw Error('PUBLISHER: report signature invalid');
  return bundle.payload;
}
