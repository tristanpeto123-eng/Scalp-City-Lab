/* Scalp City Student Observatory — read-only, actual saved research evidence. */
const $=id=>document.getElementById(id);
const money=v=>Number.isFinite(v)?(v>=0?'+':'−')+'£'+Math.abs(v).toFixed(2):'—';
const fmt=v=>Number.isFinite(v)?Math.round(v).toLocaleString('en-GB'):'—';
const when=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-GB',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC':'Unrecorded';
const themes={COMMODITIES:'#e1bd7b',FOREX:'#8dcce5',INDICES:'#c2b1ed',EQUITIES:'#bac9d4',CRYPTO:'#97e2c6'};
const statuses={
 ACADEMY_DAILY_EXPERIMENT_CAP:'Academy daily experiment cap reached. New research attempts resume on another UTC day, subject to available data.',
 NO_NEW_INDEPENDENT_ACADEMY_CANDLES:'No additional independent Academy training candles. Reused historical bars cannot earn more evidence.',
 RL_PROFIT_DEVELOPMENT_GATE_FAILED:'Deep RL has not passed its development profit/risk gate. More gradient updates alone do not imply better trading.',
 NO_VERIFIED_FORWARD_PAPER_RESULTS:'No independently verified forward-paper trades or approved graduation.'
};
const state={report:null,market:'ALL',selected:'CRYPTO:BTC/USD',students:[],loading:false};

function readLocalStudents(){
 const matches=[];
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(!key?.startsWith('scalp-city-lab:sl:loop:v1:'))continue;
   let s;try{s=JSON.parse(localStorage.getItem(key))}catch{continue}
   const cfg=s?.config;
   if(s?.schema!=='SL_5MIN_CAUSAL_LOOP_V1'||!cfg||
    !['COMMODITIES','FOREX','INDICES'].includes(cfg.market)||
    !/^[A-Z0-9._/-]{2,24}$/.test(cfg.symbol||'')||
    s.model?.strategy!=='SL'||s.model?.activatedForTrading!==false||
    !Array.isArray(s.model?.weights?.w1)||s.model.weights.w1.length!==8||
    !Array.isArray(s.memory?.good)||!Array.isArray(s.memory?.bad))continue;
   matches.push({id:'SL:'+cfg.market+':'+cfg.symbol,market:cfg.market,
    symbol:cfg.symbol,name:cfg.symbol,mode:'LOCAL_BROWSER_ONLY',
    source:'LOCAL_SL',checkpoint:s,lastSeen:s.cursor,
    stamp:s.model?.trainedThrough||s.cursor});
  }
 }catch(e){$('sourceState').textContent='Local SL storage unavailable: '+e.message}
 const byMarket=new Map();
 for(const x of matches){
  const previous=byMarket.get(x.market);
  if(!previous||Number(x.checkpoint.revisions||0)>Number(previous.checkpoint.revisions||0)||
    Date.parse(x.lastSeen)>Date.parse(previous.lastSeen))
    byMarket.set(x.market,x);
 }
 for(const [market,symbol] of [['COMMODITIES','XAUUSD'],['FOREX','EURUSD'],['INDICES','SPX']]){
  if(!byMarket.has(market))byMarket.set(market,{id:'SL:'+market+':'+symbol,market,symbol,
   name:symbol,mode:'NO_LOCAL_CHECKPOINT',source:'LOCAL_SL',checkpoint:null});
 }
 return [...byMarket.values()];
}
function allStudents(){
 return [...readLocalStudents(),...(state.report?.students||[]).map(s=>({...s,source:'PUBLISHED_CRYPTO'})),
 {id:'EQUITIES:NOT_ACTIVATED',name:'Awaiting student',symbol:'—',
 market:'EQUITIES',source:'INACTIVE',mode:'NOT_ACTIVATED'}];
}
function updateGlobal(){
 const s=state.report?.summary;
 $('statStudents').textContent=s?fmt(s.pupils):'—';
 $('statCapped').textContent=s?fmt(s.cappedAcademyStudents):'—';
 $('statUpdated').textContent=s?fmt(s.rlUpdatedPupils):'—';
 $('statForward').textContent=s?fmt(s.independentlyForwardVerified):'—';
}
function filteredStudents(){return state.students.filter(s=>state.market==='ALL'||s.market===state.market)}
function updateRoster(){
 for(const button of $('filters').querySelectorAll('button'))
  button.setAttribute('aria-pressed',String(button.dataset.market===state.market));
 const root=$('roster');root.replaceChildren();
 for(const s of filteredStudents()){
  const btn=document.createElement('button');btn.type='button';btn.className='student';
  btn.setAttribute('aria-current',String(s.id===state.selected));
  const icon=document.createElement('span');icon.className='robot';icon.textContent=s.market==='CRYPTO'?'🤖':
   s.market==='COMMODITIES'?'🏆':s.market==='FOREX'?'💱':
   s.market==='INDICES'?'📈':'🧪';
  const identity=document.createElement('span'),name=document.createElement('strong'),info=document.createElement('small');
  name.textContent=s.name;info.textContent=s.market==='CRYPTO'?'Crypto · published Academy + DQN':
   s.source==='LOCAL_SL'&&s.checkpoint?'SL · saved on this device':
   s.market==='EQUITIES'?'Not yet activated':'SL · no checkpoint on this browser';
  identity.append(name,info);
  const status=document.createElement('span');status.className='pill '+(
    s.market==='CRYPTO'&&s.blockers?.includes('ACADEMY_DAILY_EXPERIMENT_CAP')?'pause':
    s.source==='LOCAL_SL'&&s.checkpoint?'active':'');
  status.textContent=s.market==='CRYPTO'?'RESEARCH':s.checkpoint?'SAVED':'WAITING';
  btn.append(icon,identity,status);
  btn.addEventListener('click',()=>{state.selected=s.id;render()});root.append(btn);
 }
 if(!filteredStudents().length)root.textContent='No student evidence in this market.';
}
function plot(canvasId,values,options={}){
 const canvas=$(canvasId),ctx=canvas.getContext('2d');
 const w=560,h=210;
 canvas.width=w;canvas.height=h;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#0b1c2a';ctx.fillRect(0,0,w,h);
 const chart=(Array.isArray(values)?[{points:values,color:'#8ad8c9'}]:values||[]).map(s=>({
  color:s.color||'#8ad8c9',label:s.label||'',points:Array.isArray(s.points)?s.points:[]}));
 const n=Math.max(0,...chart.map(s=>s.points.length));
 const numbers=chart.flatMap(s=>s.points.filter(Number.isFinite));
 ctx.textBaseline='middle';ctx.font='12px system-ui';
 if(!numbers.length){
  ctx.fillStyle='#97b4bf';ctx.textAlign='center';
  ctx.fillText(options.empty||'No recorded measurements yet',w/2,h/2);return;
 }
 const left=55,right=w-18,top=16,bottom=h-36;
 let lo=Number.isFinite(options.min)?options.min:Math.min(...numbers),
  hi=Number.isFinite(options.max)?options.max:Math.max(...numbers);
 if(hi===lo){const d=Math.max(Math.abs(hi)*.1,1);lo-=d;hi+=d}
 if(options.includeZero){lo=Math.min(lo,0);hi=Math.max(hi,0)}
 const extra=(hi-lo)*.12;lo-=extra;hi+=extra;
 const px=i=>left+((n<=1?.5:i/(n-1))*(right-left));
 const py=value=>bottom-(value-lo)/(hi-lo)*(bottom-top);
 ctx.lineWidth=1;ctx.strokeStyle='#2c4755';ctx.textAlign='right';ctx.fillStyle='#a7c1cb';
 for(let i=0;i<4;i++){
  const y=top+(bottom-top)*i/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
  const val=hi-(hi-lo)*i/3;
  ctx.fillText(options.format==='integer'?Math.round(val).toLocaleString('en-GB'):val.toFixed(2),left-8,y);
 }
 for(const s of chart){
  let drawing=false;ctx.beginPath();ctx.strokeStyle=s.color;ctx.lineWidth=2.7;
  s.points.forEach((value,i)=>{
   if(!Number.isFinite(value)){drawing=false;return}
   const x=px(i),y=py(value);
   if(!drawing){ctx.moveTo(x,y);drawing=true}else ctx.lineTo(x,y)
  });ctx.stroke();
  s.points.forEach((v,i)=>{
   if(!Number.isFinite(v))return;
   ctx.beginPath();ctx.fillStyle=s.color;ctx.arc(px(i),py(v),n>35?1.9:3.5,0,Math.PI*2);ctx.fill();
  });
 }
 ctx.textAlign='left';ctx.fillStyle='#9fb6c5';ctx.font='11px system-ui';
 ctx.fillText(options.xStart||'Oldest',left,bottom+20);
 ctx.textAlign='right';ctx.fillText(options.xEnd||'Latest',right,bottom+20);
}
function setChartTitle(id,title,subtitle,note){
 $(id+'Title').textContent=title;$(id+'Subtitle').textContent=subtitle;$(id+'Note').textContent=note;
}
function putText(id,text){$(id).textContent=text}
function row(tbody,values){
 const tr=document.createElement('tr');
 for(const val of values){
  const td=document.createElement('td');td.textContent=val;tr.append(td);
 }
 tbody.append(tr);
}
function renderCrypto(s){
 const research=s.research||{},rl=s.rl||{},lessons=research.lessons||[],
 checkpoints=rl.checkpoints||[];
 putText('studentLane','CRYPTO / TWO INDEPENDENT TRAINING SYSTEMS');
 putText('studentName',s.symbol);
 putText('studentMode','Source: published Academy historical research + independently saved DQN checkpoint summary');
 putText('studentStatus','PROVISIONAL ONLY');
 $('studentStatus').className='pill pause';
 putText('studentExplanation', 'The Academy has '+fmt(research.experiments)+' historical research experiments; the Deep RL robot has '+fmt(rl.cumulativeGradientUpdates)+
 ' actual cumulative neural gradient updates. They are distinct tracks—not a single graduation percentage.');
 $('studentExplanation').className='alert info';
 putText('mResearch',fmt(research.experiments));
 putText('mGradient',fmt(rl.cumulativeGradientUpdates));
 putText('mCandles',fmt(rl.newTrainingTailCandles)+' RL');
 putText('mNet',money(research.historicalCandidateNetGbp));
 setChartTitle('grade','Academy grades','Historical leader grade per stored experiment (0–10)',
  lessons.length+' recorded research experiments, of which '+fmt(research.independentWindows)+' had independent training windows. Grades are provisional.');
 plot('gradeChart',lessons.map(l=>l.grade),{min:0,max:10,format:'integer',xStart:'Lesson 1',xEnd:'Lesson '+lessons.length});
 setChartTitle('updates','Deep RL neural updates','Cumulative backpropagation updates by model checkpoint',
  checkpoints.length+' persisted checkpoint observation(s). '+(checkpoints.length<2?'The trend appears after another distinct model fingerprint is published.':'Updates ≠ profitability.'));
 plot('updatesChart',checkpoints.map(c=>c.cumulativeGradientUpdates),{min:0,format:'integer',xStart:'Oldest model',xEnd:'Newest model'});
 setChartTitle('profit','DQN performance after costs','Same-window virtual development net vs stressed costs',
  'Unsealed development sample, not independent forward performance; never compare as actual account GBP.');
 plot('profitChart',[
  {color:'#8fddc7',points:checkpoints.map(c=>c.sameWindowNetVirtual)},
  {color:'#e6bc7a',points:checkpoints.map(c=>c.sameWindowStressNetVirtual)}
 ],{includeZero:true,xStart:'Previous checkpoint',xEnd:'Latest checkpoint'});
 setChartTitle('activity','Historical lesson independence','Independent window = 1; overlapping/reused = 0',
  'This chart prevents repeated training on the same candles looking like fresh market evidence.');
 plot('activityChart',lessons.map(l=>l.independent?1:0),{min:0,max:1,format:'integer',
 xStart:'First research',xEnd:'Latest research'});
 const blockers=$('blockers');blockers.replaceChildren();
 for(const b of s.blockers){
  const el=document.createElement('div');el.className='alert'+(b==='NO_VERIFIED_FORWARD_PAPER_RESULTS'?' info':'');
  el.textContent=statuses[b]||b;blockers.append(el);
 }
 putText('lastEvidence','Academy snapshot '+when(s.publishedAcademyAt)+
  ' · DQN checkpoint '+when(rl.generatedAt)+
  ' · Latest Academy training candle '+when(s.latestHistoricalTrainingEnd)+
  ' · All historical data; no signed broker paper grades.');
 const history=$('lessonTable');history.replaceChildren();
 for(const item of [...lessons].slice(-35).reverse())
  row(history,[when(item.trainedThrough),'Academy · lesson '+item.run,
   item.testedConfigurations+' configs · '+(item.independent?'non-overlap':'reused'),
   'Grade '+(item.grade??'—')+' · '+money(item.trainingNetGbp),
   item.independent?'Historical research only':'Repeated sample']);
 for(const c of [...checkpoints].reverse())
  row(history,[when(c.observedAt),'Deep RL checkpoint',
   fmt(c.gradientUpdatesThisRun)+' model updates',
   money(c.sameWindowNetVirtual)+' / stress '+money(c.sameWindowStressNetVirtual),
   c.sameWindowImproved?'Improved same window only':'No confirmed improvement']);
}
function localCheckpointSeries(s){
 const rows=(s?.paperOrders||[]).filter(o=>o.status==='CLOSED'&&Number.isFinite(o.netPnlGbp));
 let net=0;return rows.map(o=>{net+=o.netPnlGbp;return {value:net,at:o.exitedAt}});
}
function renderSL(s){
 const saved=s.checkpoint,rows=localCheckpointSeries(saved);
 putText('studentLane',s.market+' / MARKET SPECIALIST');
 putText('studentName',s.symbol);
 putText('studentMode',saved?'Local SL browser checkpoint · neural weights and trade memory never uploaded to this dashboard':
  'No SL neural checkpoint found for this market on this browser.');
 putText('studentStatus',saved?'LOCAL MODEL SAVED':'NOT CONNECTED');
 $('studentStatus').className='pill '+(saved?'active':'pause');
 putText('studentExplanation',saved?
  'This SL student has '+fmt(saved.revisions||0)+' saved incremental learning updates and '+
  fmt(saved.newCandles||0)+' newly processed chart candles. Values are local simulated research, not forward-paper qualification.':
  'No saved checkpoint was detected on this device. Open the SL Laboratory using this same browser, import chart candles and process a learning cycle to create one.');
 $('studentExplanation').className='alert '+(saved?'info':'');
 putText('mResearch',saved?fmt((saved.memory.good?.length||0)+(saved.memory.bad?.length||0)):'—');
 putText('mGradient',saved?fmt(saved.revisions||0)+' SL':'—');
 putText('mCandles',saved?fmt(saved.newCandles||0)+' total':'—');
 putText('mNet',saved?money(saved.paperNetPnlGbp??saved.selectedNetPnlGbp??0):'—');
 setChartTitle('grade','Learning memory','Recorded winning and losing labels',
  saved?'Good '+fmt(saved.memory.good.length)+' / Bad '+fmt(saved.memory.bad.length)+' trade outcomes. These are research labels.':'Import a real chart in SL to create a baseline.');
 const labels=saved?[
  ...saved.memory.good.map(x=>({at:x.closedAt,good:true})),
  ...saved.memory.bad.map(x=>({at:x.closedAt,good:false}))
 ].filter(x=>Number.isFinite(Date.parse(x.at))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)):[];
 let wins=0;plot('gradeChart',labels.slice(-140).map(x=>{if(x.good)wins++;return wins}),{min:0,format:'integer',empty:'No trade outcomes saved'});
 setChartTitle('updates','SL learning revisions','Incremental model updates after closed outcomes',
  saved?'Latest saved model revision '+fmt(saved.revisions||0)+'. Full per-revision model history is not yet stored.':'No model to graph yet.');
 plot('updatesChart',[],{empty:saved?'Revision timeline unavailable — only current counter is stored':'No saved neural model'});
 setChartTitle('profit','SL virtual cumulative P&L','Only recorded closed virtual paper orders in this local model',
  rows.length+' virtual order closes. Modelled execution, not actual cash or external paper fills.');
 plot('profitChart',rows.map(x=>x.value),{includeZero:true,empty:'No virtual paper orders closed'});
 setChartTitle('activity','SL position outcomes','Per-trade virtual results after modelled fees',
  'Individual recorded closed orders, not actual brokerage performance.');
 plot('activityChart',saved?.paperOrders?.filter(x=>x.status==='CLOSED').map(x=>x.netPnlGbp)||[],{
  includeZero:true,empty:'No recorded virtual closes yet'});
 const blockers=$('blockers');blockers.replaceChildren();
 for(const msg of [saved?
  'The local learning loop does not run continuously after Safari closes. Automatic hourly provider polling requires the SL page to remain open.':'No neural checkpoint on this browser: the model may be stored on another device or not yet created.',
  'No persistent server-side SL trainer or shared private model sync is connected to the Observatory.',
  'No signed independent forward-paper performance or broker trading approval.']){
  const node=document.createElement('div');node.className='alert';node.textContent=msg;blockers.append(node);
 }
 putText('lastEvidence',saved?'Local chart cursor '+when(saved.cursor)+
  ' · '+fmt(saved.cycles||0)+' browser loop cycles · '+fmt(saved.revisions||0)+' neural feedback revisions.':
  'Use the SL Laboratory for the first recorded training cycle.');
 const history=$('lessonTable');history.replaceChildren();
 for(const o of [...(saved?.paperOrders||[])].slice(-45).reverse())
  row(history,[when(o.exitedAt||o.entryAt),'SL virtual '+o.side,
   o.selection||'MODEL',o.status==='CLOSED'?money(o.netPnlGbp):'Pending',o.status]);
 if(!history.children.length)row(history,['—','SL','No recorded virtual paper orders','—','Model baseline only']);
}
function renderEmpty(s){
 putText('studentLane','EQUITIES / FUTURE COHORT');putText('studentName','Equities');
 putText('studentMode','Not activated — no student, model or training history has been provisioned.');
 putText('studentStatus','NOT ENROLLED');$('studentStatus').className='pill pause';
 putText('studentExplanation','The Equities student is planned but has no genuine training source. The Observatory does not generate fictional results.');
 $('studentExplanation').className='alert';['mResearch','mGradient','mCandles','mNet'].forEach(id=>putText(id,'—'));
 for(const [id,title] of [['grade','Academy lessons'],['updates','Neural checkpoints'],['profit','Virtual performance'],['activity','Evidence history']]){
  setChartTitle(id,title,'Not activated','No data available.');
  plot(id+'Chart',[],{empty:'Student has not been activated'});
 }
 $('blockers').textContent='Training source, persistent checkpoint and qualification pathway not yet connected.';
 $('lastEvidence').textContent='No observed evidence.';
 $('lessonTable').replaceChildren();
}
function render(){
 state.students=allStudents();
 const allowed=filteredStudents();
 if(!allowed.some(s=>s.id===state.selected))state.selected=allowed[0]?.id||'';
 updateGlobal();updateRoster();
 const chosen=state.students.find(s=>s.id===state.selected);
 if(!chosen)return;
 if(chosen.source==='PUBLISHED_CRYPTO')renderCrypto(chosen);
 else if(chosen.source==='LOCAL_SL')renderSL(chosen);
 else renderEmpty(chosen);
}
async function refresh(){
 if(state.loading)return;
 state.loading=true;$('reload').disabled=true;
 $('sourceState').textContent='Checking published evidence and local model checkpoints…';
 try{
  const r=await fetch('./research-data/student-progression.json?refresh='+Date.now(),
   {cache:'no-store',credentials:'omit'});
  if(!r.ok)throw Error('Published progress dataset unavailable (HTTP '+r.status+')');
  const data=await r.json();
  if(data?.schema!=='SCALP_STUDENT_PROGRESS_V1'||
   !Array.isArray(data.students)||data.students.length!==10||
   data.summary?.realBrokerOrders!==0||
   data.summary?.independentlyForwardVerified!==0||
   data.students.some(s=>s.forwardVerified!==false||s.brokerOrders!==0))
   throw Error('Unexpected or unaudited progress data');
  state.report=data;
  const hours=(Date.now()-Date.parse(data.generatedAt))/3600000;
  $('sourceState').textContent='Published '+when(data.generatedAt)+
   (hours>8?' · historical telemetry needs refresh':' · historical research only')+
   ' · local SL read separately';
 }catch(e){
  $('sourceState').textContent='Published progression currently unavailable: '+e.message+
   '. Local SL evidence remains accessible.';
 }finally{state.loading=false;$('reload').disabled=false;render()}
}
$('filters').addEventListener('click',e=>{
 const btn=e.target.closest('button[data-market]');
 if(!btn)return;state.market=btn.dataset.market;render();
});
$('reload').addEventListener('click',refresh);
window.addEventListener('storage',()=>render());
window.__studentProgressReady=true;
refresh();
