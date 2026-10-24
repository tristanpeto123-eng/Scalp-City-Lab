// Academy student publishing console. Imported exam traces are research-only, never broker evidence.
import {evaluateSubmission,SUBMISSION_SCHEMA} from './academy-common-exam.mjs';
const ID='XAU-SCST-01',SLOT='scalp-city-lab:unified-academy:scst:v1';
const elt=(tag,txt)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;return n;};
const panel=elt('section');panel.id='scout-publisher';panel.style.cssText='margin-top:18px;border:1px solid #58768e;border-radius:16px;padding:17px;background:#132a40';
const title=elt('h2','Publish Scout + Strategist');title.className='section-title';
const help=elt('p','Combined student XAU-SCST-01 · Commodities · XAUUSD · 15-minute. Upload a real exported model checkpoint and its frozen, completed-candle research exam trace in the Academy contract. The common engine applies the same next-open fills, position allocation and transaction-cost rules to every supported student. Import does not verify that the checkpoint generated its trace.');
help.className='section-note';
const file=elt('input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','Scout and Strategist frozen model and exam JSON');
file.style.cssText='max-width:100%;padding:9px;border:1px solid #56738e;border-radius:9px;color:#dcecff';
const submit=elt('button','Enrol and run common exam');submit.className='btn primary';submit.type='button';
const exportBtn=elt('button','Download exam report');exportBtn.className='btn';exportBtn.type='button';exportBtn.disabled=true;
const outcome=elt('p','Student in Orientation: no imported model checkpoint and no common examination result.');outcome.className='note';outcome.setAttribute('role','status');
const metadata=elt('div');metadata.className='note';
const history=elt('div');history.className='note';
panel.append(title,help,file,elt('div'),submit,exportBtn,outcome,metadata,history);
const parent=document.querySelector('.school-layout main');
if(parent)parent.append(panel);
let latest=null;
const notify=(r)=>{
  window.dispatchEvent(new CustomEvent('academy:scout-status',{detail:r?{
    id:ID,version:r.modelVersion,modelSha256:r.modelSha256,dataSha256:r.dataSha256,
    source:'LOCAL_RESEARCH_EXAM',trades:r.closedTrades,wins:r.wins,net:r.realisedNetGbp,
    drawdown:r.maxDrawdownPct,method:'Scout + Strategist',fromUtc:r.fromUtc,toUtc:r.toUtc
  }:null}));
};
function safeStored(){
 try{
  const p=JSON.parse(localStorage.getItem(SLOT)||'null');
  if(!p||p.schema!=='ACADEMY_LOCAL_RESEARCH_HISTORY_V1'||!Array.isArray(p.results))return [];
  return p.results.filter(r=>r&&r.schema==='ACADEMY_COMMON_EXAM_V1'&&r.studentId===ID&&
      r.evidenceLevel==='LOCAL_UNVERIFIED_HISTORICAL_REPLAY'&&r.qualified===false&&
      r.allowsPromotion===false&&Number.isFinite(r.realisedNetGbp)&&
      Number.isInteger(r.closedTrades)&&Number.isInteger(r.wins)&&r.wins<=r.closedTrades&&
      /^[a-f0-9]{64}$/.test(r.modelSha256||'')&&/^[a-f0-9]{64}$/.test(r.dataSha256||''))
      .slice(-12);
 }catch{return [];}
}
let rows=safeStored();
function redraw(){
 history.replaceChildren();
 const heading=elt('h3','Published research exams');history.append(heading);
 if(!rows.length){history.append(elt('p','No exams recorded on this device.'));return;}
 const table=elt('table');table.style.cssText='width:100%;font-size:.76rem;border-collapse:collapse';
 const head=elt('tr');
 for(const v of ['Version','Trades','Win %','Net GBP','Max DD','Period'])head.append(elt('th',v));
 table.append(head);
 rows.slice().reverse().forEach(r=>{
   const tr=elt('tr');
   for(const v of [r.modelVersion,String(r.closedTrades),
     r.winRatePct===null?'—':r.winRatePct.toFixed(1)+'%',
     r.realisedNetGbp.toFixed(2),r.maxDrawdownPct.toFixed(2)+'%',
     r.fromUtc.slice(0,10)+' → '+r.toUtc.slice(0,10)]){
       const cell=elt('td',v);cell.style.cssText='padding:7px 3px;border-top:1px solid #34516e';tr.append(cell);
     }
   table.append(tr);
 });
 history.append(table);
}
if(rows.length){latest=rows.at(-1);notify(latest);exportBtn.disabled=false;
  outcome.textContent='Restored local research exam for '+latest.modelVersion+'. UNVERIFIED: not a Teacher paper grade.';}
redraw();
submit.onclick=async()=>{
 if(!file.files?.length){outcome.textContent='Select a checkpoint + exam JSON file first.';return;}
 submit.disabled=true;outcome.textContent='Checking checkpoint, candle provenance, timestamps and common exam rules…';
 try{
  const f=file.files[0];if(f.size>9000000)throw Error('File exceeds 9 MB upload limit');
  const payload=JSON.parse(await f.text());
  if(payload.schema!==SUBMISSION_SCHEMA||payload.student?.id!==ID)
    throw Error('This intake accepts only the combined Scout + Strategist student '+ID);
  const r=await evaluateSubmission(payload);
  latest=r;rows=rows.filter(x=>x.modelSha256!==r.modelSha256||x.dataSha256!==r.dataSha256);
  rows.push(r);rows=rows.slice(-12);
  // Keep only a small examination history: the original model checkpoint is never committed to a public repo.
  const compact=rows.map(({trades,equitySeries,...x})=>x);
  try{localStorage.setItem(SLOT,JSON.stringify({schema:'ACADEMY_LOCAL_RESEARCH_HISTORY_V1',results:compact}));}
  catch{outcome.textContent='Exam computed; browser storage unavailable. Export the report before leaving.';}
  exportBtn.disabled=false;notify(r);redraw();
  outcome.textContent='Enrolled '+r.studentId+' / '+r.modelVersion+' · '+r.closedTrades+
    ' simulated closed trades · net £'+r.realisedNetGbp.toFixed(2)+
    ' · max DD '+r.maxDrawdownPct.toFixed(2)+'%. RESEARCH ONLY: decisions were supplied with the checkpoint, not independently reproduced.';
  metadata.textContent='Frozen model SHA-256: '+r.modelSha256+' | Exam data SHA-256: '+r.dataSha256+
    ' | Traces SHA-256: '+r.decisionsSha256+'. The source data and prediction trace are unverified; no Teacher qualification or orders.';
 }catch(e){outcome.textContent='Import blocked: '+String(e.message||e); }
 finally{submit.disabled=false;}
};
exportBtn.onclick=()=>{
 if(!latest)return;
 const blob=new Blob([JSON.stringify(latest,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=elt('a');a.href=url;
 a.download='XAU-SCST-01-'+latest.modelVersion+'-unverified-exam.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
};
