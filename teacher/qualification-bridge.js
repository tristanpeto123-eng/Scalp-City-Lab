// PUBLIC READ-ONLY bridge from archived research to independent HISTORICAL Teacher screening.
// Never admits pupils, reads credentials, approves trades, or synthesizes grade evidence.
import {requireMatchingAcademySource} from './historical-screen-client.mjs';
(()=>{
 'use strict';
 const root=document.getElementById('qualification-bridge');
 if(!root)return;
 const PAIRS=['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD'];
 const styles=document.createElement('style');
 styles.textContent=`
 #qualification-bridge{box-sizing:border-box;display:block;margin:22px auto;padding:20px;max-width:1150px;border-radius:16px;border:1px solid #486978;background:linear-gradient(135deg,#102b3b,#0a1c2e);color:#eaf5f6;font:14px/1.55 system-ui,-apple-system,sans-serif;text-align:left}
 #qualification-bridge *{box-sizing:border-box}#qualification-bridge h2{margin:5px 0 10px;font-size:21px;color:#edfaf7}
 #qualification-bridge p{font-size:13px;color:#b8ced9;margin:8px 0}
 #qualification-bridge .q-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;margin:14px 0}
 #qualification-bridge .q-metric{padding:12px;border:1px solid #35576b;border-radius:10px;background:#0b2232}
 #qualification-bridge .q-metric small{display:block;font-size:11px;color:#a7bfca}#qualification-bridge .q-metric strong{font-size:17px}
 #qualification-bridge .q-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
 #qualification-bridge label{font-size:12px;font-weight:800;color:#c6dce4}
 #qualification-bridge select,#qualification-bridge button{min-height:41px;border:1px solid #6b8a98;background:#102b3d;color:#eef7fa;padding:8px 11px;border-radius:9px;max-width:100%}
 #qualification-bridge a{color:#a5e5d6}#qualification-bridge .q-badge{color:#f1d6aa;font-size:12px;font-weight:850}
 #qualification-bridge .q-negative{color:#edb4b6}#qualification-bridge .q-positive{color:#9de9cd}
 `;document.head.append(styles);
 const node=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n};
 const title=node('h2','Independent historical screening');
 const status=node('p','Checking signed-off historical-screen publication. No admission implied.');
 const details=document.createElement('div');
 root.replaceChildren(title,status,details);
 const safeTime=s=>typeof s==='string'&&!Number.isNaN(Date.parse(s));
 const readOnlyReport=d=>{
  if(d?.schema!=='TEACHER_PUBLIC_HISTORICAL_SCREEN_V1'||
    d.source!=='INDEPENDENT_HISTORICAL_SCREEN_NO_PAPER_ORDERS'||
    !safeTime(d.checkedAt)||!safeTime(d.lastResearchTrainingEnd)||
    d.trainingOnly!==true||d.brokerOrdersSubmitted!==0||d.admissionsIssued!==0||
    d.verifiedForwardGrades!==0||d.screenedCount!==10||d.slotsCap!==3||
    !Array.isArray(d.pupils)||d.pupils.length!==10||
    d.eligibleCount!==d.pupils.filter(x=>x.verdict==='PASS').length||
    PAIRS.some(p=>d.pupils.filter(x=>x.symbol===p).length!==1)||
    d.pupils.some(p=>!['PASS','BLOCKED'].includes(p.verdict)||!Array.isArray(p.reasons)))
    throw Error('Published research report failed no-order validation');
  return d;
 };
 async function show(){
  status.textContent='Checking published independent historical screen…';details.replaceChildren();
  delete window.ScalpHistoricalScreen;
  try{
   const url='./research-data/teacher-qualification.json?read-only='+Date.now();
   const response=await fetch(url,{cache:'no-store',credentials:'omit'});
   if(!response.ok)throw Error('No current public Teacher screen has been published');
   const report=readOnlyReport(await response.json());
   // A previously published screen may reference an older Academy snapshot:
   // never expose a historical PASS to other UIs until the source digest agrees.
   const rosterResponse=await fetch('./research-data/robot-academy.json?screen-source='+Date.now(),
     {cache:'no-store',credentials:'omit'});
   if(!rosterResponse.ok)throw Error('Academy evidence source is unavailable for comparison');
   const roster=await rosterResponse.json();
   await requireMatchingAcademySource({screen:report,academy:roster});
   window.ScalpHistoricalScreen=Object.freeze({...report,pupils:Object.freeze(report.pupils.map(p=>Object.freeze({...p})))});
   window.dispatchEvent(new Event('scalp-historical-screen'));
   const sampleAge=Math.max(0,Math.floor((Date.now()-Date.parse(report.lastResearchTrainingEnd))/86400000));
   const screenAge=Math.max(0,Math.floor((Date.now()-Date.parse(report.checkedAt))/86400000));
   const stale=screenAge>2||sampleAge>7;
   status.textContent=report.eligibleCount+' / 10 historical candidates cleared for manual review · '+report.screenedCount+' assessed. '+(stale?'WARNING: research/screening evidence is old. ':'')+'No pupils admitted; no confirmed PAPER trades or grades.';
   const metric=(label,value)=>{
    const box=node('div','','q-metric');box.append(node('small',label),node('strong',value));return box
   };
   const stats=node('div','','q-grid');
   stats.append(metric('Historical screening passes',String(report.eligibleCount)+'/10'),
    metric('PAPER examination admissions','0'),
    metric('Independently verified grades','0'),
    metric('Training data age',sampleAge+' days'));
   details.append(stats);
   const chooseWrap=node('div','','q-row'),label=node('label','Inspect chart: '),select=document.createElement('select');
   select.setAttribute('aria-label','Select chart qualification');
   for(const symbol of PAIRS){const option=node('option',symbol);option.value=symbol;select.append(option)}
   const query=new URLSearchParams(location.search).get('pupil');
   if(query){const choice=PAIRS.find(s=>s.replace('/','')===query.toUpperCase());if(choice)select.value=choice}
   chooseWrap.append(label,select);details.append(chooseWrap);
   const panel=node('div','','q-grid');details.append(panel);
   function draw(){
    const p=report.pupils.find(x=>x.symbol===select.value);
    panel.replaceChildren(metric('Historical screening result',p.verdict==='PASS'?'MANUAL REVIEW ONLY':'BLOCKED'),
      metric('Prior closed training trades',String(p.trainingTrades)),
      metric('Training net result',Number.isFinite(p.trainingNetGbp)?'£'+p.trainingNetGbp.toFixed(2):'Unverified'),
      metric('Holdout net result',Number.isFinite(p.historicalHoldoutNetGbp)?'£'+p.historicalHoldoutNetGbp.toFixed(2):'Not verified'));
    const explain=node('p',p.reasons.length?
     'Reasons: '+p.reasons.join('; '):'Historical screen passed. Requires independent owner-controlled review; no admission or trade authorization.');
    panel.append(explain);
   }
   select.addEventListener('change',draw);draw();
   details.append(node('p','Historical screen checked '+new Date(report.checkedAt).toLocaleString()+
    '; latest recorded training sample '+new Date(report.lastResearchTrainingEnd).toLocaleString()+
    '. The publisher is unsigned and cannot authenticate paper fills.',''));
  }catch(e){
   status.textContent='Independent screening status UNKNOWN: '+String(e.message||e)+
    '. The absence of a public report is not a failed grade, an admission, or proof that screening ran.';
  }
  const footer=node('p','Official forward grades require separately verified, Ed25519-signed paper-broker evidence. Research-screen eligibility alone never enables execution.');
  details.append(footer);
  const link=document.createElement('a');link.href='./training-monitor.html';link.textContent='See training liveness and historical progress ↗';details.append(link);
 }
 show();
})();
