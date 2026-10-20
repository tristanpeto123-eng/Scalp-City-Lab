const $ = id => document.getElementById(id);
const APPS = [
 {id:'mission',title:'Mission Control',icon:'♛',color:'#6b6442',route:'../mission-control.html',description:'Control centre'},
 {id:'lab',title:'Research Lab',icon:'⌁',color:'#227e8e',route:'../strategy-validation.html',description:'Strategy development'},
 {id:'academy',title:'Academy',icon:'🎓',color:'#6550a4',route:'../robot-academy.html',description:'Student robots'},
 {id:'teacher',title:'Teacher',icon:'⚖',color:'#2c8a70',route:'../teacher-console.html',description:'Evidence & exams'},
 {id:'paper',title:'Trading Floor',icon:'▣',color:'#9b6538',native:'paper',description:'PAPER-gated status'},
 {id:'monitor',title:'Training Monitor',icon:'▥',color:'#2c7198',native:'monitor',description:'Saved telemetry'},
 {id:'replay',title:'5m Replay',icon:'▤',color:'#2b587c',route:'../market-replay-5m.html',description:'Historical candles'},
 {id:'neo',title:'NEO Lab',icon:'◈',color:'#743f82',route:'../neo-lab.html',description:'Pattern memory'},
 {id:'agents',title:'Agent City',icon:'⌘',color:'#20666d',route:'../agent-city.html',description:'Legacy 3D agents'},
 {id:'elevator',title:'Elevator',icon:'⇅',color:'#686f7b',native:'floors',description:'Teleport between floors'}
];
let current=null,opened=false,maximized=false;
const getApp = id => APPS.find(a=>a.id===id);
function phoneState(){
  $('phoneShell').hidden=!opened;
  $('phoneToggle').setAttribute('aria-expanded',String(opened));
  window.dispatchEvent(new CustomEvent('scalp:phone-state',{detail:{open:opened}}));
}
function showPhone(value){
  opened=Boolean(value);if(!opened)maximize(false);phoneState();
  if(opened){$('floorMenu').hidden=true;$('floorsToggle').setAttribute('aria-expanded','false');}
}
function maximize(value){
  maximized=Boolean(value);
  $('phoneShell').classList.toggle('maximized',maximized);
  $('appExpand').textContent=maximized?'COLLAPSE':'EXPAND';
  $('appExpand').setAttribute('aria-label',maximized?'Restore phone size':'Expand app');
}
function openHome(){
  maximize(false);current=null;
  $('phoneHome').hidden=false;$('phoneView').hidden=true;
  const frame=$('appFrame');frame.hidden=true;frame.src='about:blank';
  $('nativeView').hidden=true;
}
function openApp(id){
  const app=getApp(id);if(!app)return;
  current=app;$('phoneHome').hidden=true;$('phoneView').hidden=false;
  $('appTitle').textContent=app.title;
  const frame=$('appFrame'),native=$('nativeView');
  if(app.route){
    native.hidden=true;native.replaceChildren();
    frame.hidden=false;
    const route=new URL(app.route,location.href);
    // Only allow the known fixed same-origin application routes.
    if(route.origin!==location.origin){frame.hidden=true;return;}
    frame.src=route.href;
  }else{
    frame.hidden=true;frame.src='about:blank';
    native.hidden=false;void renderNative(app.native);
  }
  showPhone(true);
}
function item(title,value,note){
  const row=document.createElement('div');row.className='native-stat';
  const s=document.createElement('small');s.textContent=title;
  const b=document.createElement('strong');b.textContent=String(value??'—');
  row.append(s,b);
  if(note){const p=document.createElement('p');p.textContent=note;row.append(p);}
  return row;
}
function paragraph(parent,text){
  const p=document.createElement('p');p.textContent=text;parent.append(p);
}
function title(parent,text){
  const h=document.createElement('h3');h.textContent=text;parent.append(h);
}
function action(parent,label,fn){
  const button=document.createElement('button');button.type='button';button.className='accent-btn';
  button.textContent=label;button.addEventListener('click',fn);parent.append(button);return button;
}
async function readJson(path){
  const u=new URL('../research-data/'+path,location.href);
  if(u.origin!==location.origin)throw new Error('Local sources only');
  const result=await fetch(u,{cache:'no-store'});
  if(!result.ok)throw new Error('Published snapshot unavailable (HTTP '+result.status+')');
  return result.json();
}
function fmtDate(value){
  if(!value)return 'Unknown';
  const d=new Date(value);return Number.isFinite(d.valueOf())?d.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Unknown';
}
function count(v){return Number.isFinite(v)?v.toLocaleString('en-GB'):'—';}
async function renderNative(type){
  const root=$('nativeView');root.replaceChildren();
  if(type==='floors'){
    title(root,'Tower lift');
    paragraph(root,'Select a floor to teleport directly. Alternatively, walk to the lift doors inside a room and press E or the on-screen Enter Lift button.');
    (window.ScalpWorld?.floors||[]).forEach((floor,i)=>{
      const b=document.createElement('button');b.className='native-floor';b.type='button';
      b.textContent=String(i+1).padStart(2,'0')+' / '+floor.name+' →';
      b.addEventListener('click',()=>{window.ScalpWorld?.teleport(i);showPhone(false);openHome();});
      root.append(b);
    });
    return;
  }
  if(type==='monitor'){
    title(root,'Training telemetry');
    paragraph(root,'Read-only snapshot from the existing research-data/training-monitor.json. This is NOT a continuously streaming training session.');
    const status=item('Source','Loading saved measurements…');root.append(status);
    try{
      const d=await readJson('training-monitor.json');
      if(current?.native!==type)return;
      status.remove();
      root.append(
        item('Published at',fmtDate(d.publishedAt)),
        item('Last successful lesson',fmtDate(d.lastSuccessfulLessonAt)),
        item('Evaluations per second',count(d.lastMeasuredCycle?.evaluationsPerSecond),'Measured within the previous recorded batch, not the current live throughput.'),
        item('Candidate evaluations',count(d.lastMeasuredCycle?.candidateEvaluations)),
        item('Saved lessons',count(d.lastMeasuredCycle?.newlySavedLessons)),
        item('New training candles',count(d.lastMeasuredCycle?.newTrainingCandles)),
        item('Broker orders',count(d.lastMeasuredCycle?.brokerOrders)),
        item('Verified forward grades',count(d.lastMeasuredCycle?.verifiedForwardGrades))
      );
      action(root,'REFRESH SNAPSHOT',()=>{void renderNative('monitor');});
      action(root,'OPEN ACADEMY',()=>openApp('academy'));
    }catch(e){status.remove();paragraph(root,'Source error: '+e.message);action(root,'RETRY',()=>{void renderNative('monitor');});}
    return;
  }
  if(type==='paper'){
    title(root,'Trading Floor');
    paragraph(root,'This test build contains no paper order-entry or live trading controls. The older linked trading-floor.html page is missing from the inspected source, so the world shows the actual available verification state rather than inventing trades.');
    const s=item('Evidence','Checking published Academy register…');root.append(s);
    try{
      const d=await readJson('robot-academy.json');
      if(current?.native!==type)return;
      s.remove();
      root.append(item('Verified forward grades',count(d.verifiedForwardGrades)),
        item('Recorded broker orders',count(d.actualBrokerOrders)),
        item('Academy source',d.source||'Unknown'),
        item('Latest research end',fmtDate(d.latestTrainingEnd)));
      paragraph(root,d.caveat||'Historical grades do not authorise PAPER or real-money trading.');
    }catch(e){s.remove();paragraph(root,'Published state unavailable: '+e.message);}
    action(root,"OPEN TEACHER'S OFFICE",()=>openApp('teacher'));
    action(root,'OPEN MISSION CONTROL',()=>openApp('mission'));
  }
}
function setup(){
  const grid=$('appGrid');
  for(const app of APPS){
    const tile=document.createElement('button');tile.type='button';tile.className='app-tile';tile.setAttribute('aria-label','Open '+app.title);
    const mark=document.createElement('span');mark.className='app-symbol';
    mark.style.setProperty('--app-color',app.color);mark.textContent=app.icon;
    const name=document.createElement('span');name.textContent=app.title;tile.append(mark,name);
    tile.addEventListener('click',()=>openApp(app.id));grid.append(tile);
  }
  $('phoneToggle').addEventListener('click',()=>showPhone(!opened));
  $('phoneClose').addEventListener('click',()=>showPhone(false));
  $('appBack').addEventListener('click',openHome);
  $('phoneHomeButton').addEventListener('click',openHome);
  $('appExpand').addEventListener('click',()=>maximize(!maximized));
  const clock=$('phoneClock');
  clock.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}).format(new Date());
  window.addEventListener('scalp:open-app',event=>openApp(event.detail?.app));
  window.addEventListener('keydown',event=>{
    if(event.code==='Escape'&&opened){if(maximized)maximize(false);else if(current)openHome();else showPhone(false);}
  });
  phoneState();
}
setup();
