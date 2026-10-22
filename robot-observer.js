import {validateReport,validateTrace,replayState,coachingPacket,SYMBOLS} from './robot-observer-core.mjs';

const FEED='https://raw.githubusercontent.com/tristanpeto123-eng/Scalp-City-Lab/rl-learning-memory/';
const COACH_KEY='scalp_city_observer_coach_drafts_v1';
const byId=id=>document.getElementById(id);
const dFormat=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'});
const fmtTime=x=>Number.isFinite(x)?dFormat.format(new Date(x)):'—';
const virtual=n=>Number.isFinite(n)?(n<0?'−':n>0?'+':'')+Math.abs(n).toFixed(2)+' units':'—';
const decimal=n=>Number.isFinite(n)?Number(n).toLocaleString('en-GB',{maximumFractionDigits:0}):'—';
const price=n=>Number.isFinite(n)?Number(n).toLocaleString('en-GB',{minimumFractionDigits:n>=10?2:4,maximumFractionDigits:n>=10?3:7}):'—';
let report=null, selected='ADA/USD',trace=null,index=0,playing=false,timer=null,request=0;
let drafts=readDrafts();
function readDrafts(){
  try{
    const data=JSON.parse(localStorage.getItem(COACH_KEY)||'[]');
    return Array.isArray(data)?data.filter(x=>x?.schema==='SCALP_OWNER_COACH_PROPOSAL_V1').slice(-50):[];
  }catch{return []}
}
function setStatus(message,good=true){
  byId('loadstatus').textContent=message;
  byId('loadstatus').style.color=good?'#b8e6de':'#ffd0a7';
}
function stop(){if(timer!==null){clearInterval(timer);timer=null;}playing=false;byId('play').textContent='▶ Replay';}
function clearMetrics(){
  for(const id of ['net','closes','wins','drawdown','updates','development','stress'])byId(id).textContent='—';
  byId('orders').textContent='0';byId('sourceid').textContent='Model SHA: —';
  byId('symbol').textContent='Awaiting verified research';
  byId('play').disabled=true;byId('step').disabled=true;byId('position').disabled=true;
  byId('saveCoach').disabled=true;byId('progress').textContent='0 / 0';
  byId('trades').replaceChildren();
}
function chip(symbol,active){
  const b=document.createElement('button');
  b.type='button';b.textContent=symbol.replace('/USD','');b.setAttribute('aria-pressed',String(active));
  b.addEventListener('click',()=>{if(symbol!==selected)loadPupil(symbol)});
  return b;
}
function renderPupilBar(){
  byId('pupils').replaceChildren(...SYMBOLS.map(s=>chip(s,s===selected)));
}
function renderTape(state){
  const target=byId('trades');target.replaceChildren();
  if(!state.fills.length){
    const tr=document.createElement('tr'),cell=document.createElement('td');
    cell.colSpan=4;cell.textContent='No virtual fills so far in this recorded episode';tr.append(cell);target.append(tr);return;
  }
  const rows=state.fills.slice(-7).reverse();
  for(const fill of rows){
    const tr=document.createElement('tr');
    const when=document.createElement('td'),side=document.createElement('td'),
      px=document.createElement('td'),net=document.createElement('td');
    when.textContent=fmtTime(fill.candleTime);
    side.textContent=fill.side==='BUY'?'BUY ↗':'SELL ↘';
    side.className=fill.side==='BUY'?'positive':'negative';
    px.textContent=price(fill.executionPriceUsd);
    net.textContent=fill.side==='SELL' && Number.isFinite(fill.realizedProfitVirtual)
      ?virtual(fill.realizedProfitVirtual):'Open position';
    if(fill.side==='SELL') net.className=(fill.realizedProfitVirtual>=0?'positive':'negative');
    tr.append(when,side,px,net);target.append(tr);
  }
}
function drawPrice(state){
  const svg=byId('chart');svg.replaceChildren();
  const ns='http://www.w3.org/2000/svg';
  const el=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
    if(text!==undefined)n.textContent=text;return n;};
  const candles=state.candles.slice(-100);
  if(candles.length<2)return;
  const prices=candles.map(c=>c.c),min=Math.min(...candles.map(c=>c.l)),
    max=Math.max(...candles.map(c=>c.h)),range=Math.max(max-min,1e-8);
  const x=i=>48+(i/Math.max(1,candles.length-1))*817;
  const y=price=>220-((price-min)/range)*175;
  for(let j=0;j<5;j++){
    const gy=46+j*43.5, pr=max-(range*j/4);
    svg.append(el('line',{x1:43,y1:gy,x2:865,y2:gy,stroke:'#244257','stroke-width':1}));
    svg.append(el('text',{x:4,y:gy+4,fill:'#99bacc','font-size':12},price(pr)));
  }
  const path=prices.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p).toFixed(1)).join(' ');
  svg.append(el('path',{d:path,fill:'none',stroke:'#82ded8','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
  const first=candles[0].t, last=candles.at(-1).t,byTime=new Map(candles.map((c,i)=>[c.t,i]));
  for(const fill of state.fills){
    if(fill.candleTime<first || fill.candleTime>last)continue;
    const i=byTime.get(fill.candleTime);if(i===undefined)continue;
    const py=y(fill.executionPriceUsd),buy=fill.side==='BUY';
    svg.append(el('circle',{cx:x(i),cy:py,r:7,fill:buy?'#8bf1b7':'#ffa7a4',stroke:'#061525','stroke-width':2}));
    svg.append(el('title',{},fill.side+' · '+fmtTime(fill.candleTime)));
  }
  svg.append(el('text',{x:48,y:254,fill:'#9ab9c8','font-size':12},fmtTime(first)));
  svg.append(el('text',{x:860,y:254,fill:'#9ab9c8','font-size':12,'text-anchor':'end'},fmtTime(last)));
}
function render(){
  if(!trace||!report)return;
  const pupil=report.pupils.find(p=>p.symbol===selected);
  const state=replayState(trace,pupil,index),decision=state.decision;
  const pnl=byId('net');
  pnl.textContent=virtual(state.net);pnl.className=state.net<0?'negative':state.net>0?'positive':'';
  byId('closes').textContent=decimal(state.completed.length);
  byId('wins').textContent=state.winRate===null?'N/A':state.winRate.toFixed(1)+'%';
  byId('drawdown').textContent=state.maxDrawdownPct.toFixed(2)+'%';
  byId('updates').textContent=decimal(pupil.cumulativeGradientUpdates);
  const dev=byId('development'),stressed=byId('stress');
  dev.textContent=virtual(pupil.laterDevelopmentNetGbp);
  dev.className=pupil.laterDevelopmentNetGbp>0?'positive':pupil.laterDevelopmentNetGbp<0?'negative':'';
  stressed.textContent=virtual(pupil.laterDevelopmentStressedNetGbp);
  stressed.className=pupil.laterDevelopmentStressedNetGbp>0?'positive':pupil.laterDevelopmentStressedNetGbp<0?'negative':'';
  byId('symbol').textContent=selected+' · Autonomous DQN';
  byId('currentTime').textContent='Last observed '+fmtTime(decision.observedCandleTime)+' · virtual execution '+fmtTime(decision.nextCandleTime);
  byId('currentSignal').textContent=decision.executionSide||((decision.action==='LONG')?'HOLD LONG':'STAY FLAT');
  byId('currentSignal').className=decision.executionSide==='BUY'?'positive':decision.executionSide==='SELL'?'negative':'';
  byId('positionState').textContent=state.openPosition?'Current virtual position: LONG':'Current virtual position: FLAT';
  byId('sourceid').textContent='Model SHA '+pupil.modelSha256.slice(0,14)+'…';
  byId('sourceUpdated').textContent='Published '+fmtTime(Date.parse(report.generatedAt))+' · '+(pupil.newTrainingTailCandles||0)+' new training-tail candles in latest batch';
  byId('description').textContent=
    'This robot made '+decimal(pupil.decisionsThisRun)+' simulated training decisions and '+decimal(pupil.gradientUpdatesThisRun)+
    ' real gradient updates in the published research batch. These playback frames show the frozen post-training model on archived candles, not new training on your phone.';
  byId('replayflag').textContent='ARCHIVED · NO BROKER';
  byId('position').max=String(trace.decisions.length-1);
  byId('position').value=String(index);
  byId('progress').textContent=(index+1)+' / '+trace.decisions.length;
  byId('play').disabled=false;byId('step').disabled=false;byId('position').disabled=false;
  byId('saveCoach').disabled=false;
  drawPrice(state);renderTape(state);
}
async function loadPupil(symbol) {
  if(!report)return;
  const pupil=report.pupils.find(x=>x.symbol===symbol);
  if(!pupil)return;
  stop();const serial=++request;selected=symbol;trace=null;clearMetrics();renderPupilBar();
  setStatus('Verifying '+symbol+' frozen policy hash against its independently saved replay…');
  try{
    const uri=FEED+pupil.visualReplayPath;
    const response=await fetch(uri+'?v='+Date.now(),{cache:'no-store',credentials:'omit',redirect:'error'});
    if(!response.ok)throw Error('Replay evidence unavailable (HTTP '+response.status+')');
    const raw=await response.json();
    if(serial!==request)return;
    trace=validateTrace(raw,pupil);
    index=trace.decisions.length-1;
    setStatus('Verified '+symbol+' · '+trace.decisions.length+' archived decisions · '+trace.closedTrades.length+' closed virtual trades. View is historical, not live.');
    render();
  }catch(error){
    if(serial!==request)return;
    trace=null;clearMetrics();
    setStatus('No verified replay displayed: '+error.message,false);
  }
}
async function refresh(){
  stop();const serial=++request;trace=null;report=null;clearMetrics();
  byId('refresh').disabled=true;setStatus('Retrieving source-bound GitHub research history…');
  try{
    const response=await fetch(FEED+'rl-rapid/latest.json?v='+Date.now(),
                               {cache:'no-store',credentials:'omit',redirect:'error'});
    if(!response.ok)throw Error('GitHub research report unavailable (HTTP '+response.status+')');
    const data=validateReport(await response.json());
    if(serial!==request)return;
    report=data;byId('batchtime').textContent='· '+fmtTime(Date.parse(data.generatedAt));
    renderPupilBar();
    await loadPupil(selected);
  }catch(error){
    if(serial!==request)return;
    report=null;clearMetrics();setStatus('Cannot verify research feed: '+error.message,false);
  }finally{byId('refresh').disabled=false;}
}
function tick(){
  if(!trace){stop();return;}
  if(index>=trace.decisions.length-1){stop();return;}
  index=Math.min(trace.decisions.length-1,index+Number(byId('speed').value));
  render();
  if(index>=trace.decisions.length-1)stop();
}
byId('play').addEventListener('click',()=>{
  if(!trace)return;
  if(playing){stop();return;}
  if(index===trace.decisions.length-1){index=0;render();}
  playing=true;byId('play').textContent='Ⅱ Pause';
  timer=setInterval(tick,240);
});
byId('step').addEventListener('click',()=>{stop();if(trace){index=Math.min(trace.decisions.length-1,index+1);render();}});
byId('position').addEventListener('input',event=>{stop();if(trace){index=Math.max(0,Math.min(trace.decisions.length-1,Number(event.target.value)||0));render();}});
byId('refresh').addEventListener('click',refresh);
function saveDrafts(){
  try{localStorage.setItem(COACH_KEY,JSON.stringify(drafts.slice(-50)));return true;}
  catch{return false;}
}
byId('saveCoach').addEventListener('click',()=>{
  if(!report||!trace)return;
  const type=byId('coachingType').value;
  try{
    const packet=coachingPacket({type,note:byId('coachingNote').value,
      symbol:selected,modelSha256:report.pupils.find(x=>x.symbol===selected).modelSha256,
      generatedAt:report.generatedAt});
    packet.createdAt=new Date().toISOString();
    drafts.push(packet);drafts=drafts.slice(-50);
    if(!saveDrafts())throw Error('Browser storage disabled; export unavailable');
    byId('exportCoach').disabled=false;
    byId('coachingNote').value='';
    byId('coachingStatus').textContent='Saved '+drafts.length+
      ' private review proposal(s). Nothing sent to training. Nothing applied to model.';
  }catch(error){byId('coachingStatus').textContent='Not saved: '+error.message;}
});
byId('exportCoach').addEventListener('click',()=>{
  if(!drafts.length)return;
  const blob=new Blob([JSON.stringify({schema:'SCALP_COACH_LOCAL_EXPORT_V1',proposals:drafts},null,2)],
    {type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='scalp-city-coach-review.json';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  byId('coachingStatus').textContent='Downloaded proposals for optional independent review. The learning model has not changed.';
});
byId('exportCoach').disabled=!drafts.length;
byId('coachingStatus').textContent=drafts.length
  ?drafts.length+' unsent proposals stored only in this browser. No model updates applied.'
  :'No coaching applied. The neural model keeps learning independently.';
window.addEventListener('pagehide',stop);
refresh();
// Only while screen is visible: new published reports, never create new decisions/trades.
setInterval(()=>{if(document.visibilityState==='visible'&&!playing)refresh();},5*60*1000);
