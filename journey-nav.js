// Scalp City IA v2. One persistent six-area navigator for all browser rooms.
// Display/navigation ONLY. No broker calls, approvals, new data or grade claims.
(()=>{
'use strict';
if(document.getElementById('sc-global-navigation'))return;
const areas=[
 {id:'command',path:'mission-control.html',name:'Command',purpose:'CEO and system overview',tools:[]},
 {id:'research',path:'strategy-validation.html',name:'Research',purpose:'Datasets, strategy experiments and backtests',tools:[
  ['Supervised Learning','sl-strategy.html'],['Legacy research workstation','index.html']]},
 {id:'academy',path:'robot-academy.html',name:'Academy',purpose:'Robot students and historical training',tools:[
  ['Student Progress','student-progress.html'],['Universal Student','universal-student.html'],
  ['Training Monitor','training-monitor.html'],['5-minute Replay','market-replay-5m.html'],
  ['Robot Observer','robot-observer.html'],['NEO Memory','neo-lab.html']]},
 {id:'teacher',path:'teacher-console.html',name:'Teacher',purpose:'Independent examinations and qualification',tools:[]},
 {id:'trading',path:'trading-floor.html',name:'Trading',purpose:'Paper-trading supervision and synthetic demo',tools:[]},
 {id:'city',path:'agent-city.html',name:'3D City',purpose:'Spatial agent operations overview',tools:[]}
];
const page=location.pathname.split('/').pop()||'index.html';
const owner=areas.find(a=>a.path===page||a.tools.some(t=>t[1]===page))||areas[0];
const isScene=page==='index.html'||page==='agent-city.html';
const el=(tag,cls,label)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(label)e.textContent=label;
 return e;
};
const link=(name,path,cls)=>{
 const a=el('a',cls,name);
 const dest=new URL(path,location.href);
 const requested=new URLSearchParams(location.search).get('pupil');
 if((path==='teacher-console.html'||path==='trading-floor.html')&&
    /^(BTC|ETH|SOL|XRP|ADA|AVAX|LINK|DOGE|LTC|BCH)USD$/.test(requested||'')){
  dest.searchParams.set('pupil',requested);
 }
 a.href=dest.href;
 if(page===path)a.setAttribute('aria-current','page');
 return a;
};
const nav=el('nav','sc-main-nav'+(isScene?' sc-scene':''));
nav.id='sc-global-navigation';
nav.setAttribute('aria-label','Scalp City primary navigation');
nav.setAttribute('data-area',owner.id);
nav.setAttribute('data-expanded','false');
const header=el('div','sc-nav-heading');
const brand=link('SCALP CITY','mission-control.html','sc-nav-wordmark');
brand.setAttribute('aria-label','Scalp City Command');
const context=el('div','sc-nav-context',(owner.name+' / '+(page===owner.path?'Main room':page==='index.html'?'Legacy workstation':owner.tools.find(t=>t[1]===page)?.[0]||'Tool')));
const toggle=el('button','sc-nav-toggle','☰ Areas');
toggle.type='button';
toggle.setAttribute('aria-expanded','false');
toggle.setAttribute('aria-controls','sc-nav-menu');
header.append(brand,context,toggle);
const menu=el('div','sc-nav-menu');menu.id='sc-nav-menu';
const links=el('div','sc-nav-areas');
for(const area of areas){
 const a=link(area.name,area.path,'sc-nav-area');
 if(area.id===owner.id){
  a.setAttribute('data-selected','true');
  if(page!==area.path)a.setAttribute('aria-current','location');
 }
 links.append(a);
}
menu.append(links);
if(owner.tools.length){
 const tools=el('div','sc-nav-tools');
 tools.append(el('span','sc-nav-tools-label','Tools:'));
 for(const [name,path] of owner.tools)tools.append(link(name,path,'sc-nav-tool'));
 menu.append(tools);
}
const purpose=el('span','sc-nav-purpose',owner.purpose);
menu.append(purpose);
nav.append(header,menu);
document.body.prepend(nav);
const setOpen=enabled=>{
 nav.setAttribute('data-expanded',String(enabled));
 toggle.setAttribute('aria-expanded',String(enabled));
 toggle.textContent=enabled?'✕ Close':'☰ Areas';
};
toggle.addEventListener('click',()=>setOpen(nav.getAttribute('data-expanded')!=='true'));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.getAttribute('data-expanded')==='true')setOpen(false)});
document.addEventListener('pointerdown',event=>{if(!nav.contains(event.target)&&nav.getAttribute('data-expanded')==='true')setOpen(false)});
// Retire extra cross-page navigation, never controls (e.g. the 3D station rail).
const duplicates={
 'mission-control.html':['nav.toplinks'],
 'strategy-validation.html':['nav.topnav'],
 'robot-academy.html':['header.head > nav'],
 'teacher-console.html':['header.top > nav'],
 'trading-floor.html':['body > header nav'],
 'training-monitor.html':['main > nav[aria-label="Training monitor routes"]'],
 'student-progress.html':['nav.backlinks'],
 'universal-student.html':['main > header nav'],
 'robot-observer.html':['nav[aria-label="Navigation"]'],
 'neo-lab.html':['main > nav'],
 'agent-city.html':['.topActions > a.back'],
 'index.html':['#missionEntry','#slEntry','#studentProgressEntry','#academyEntry','#teacherEntry','#agentCityLink']
};
for(const selector of duplicates[page]||[]){
 document.querySelectorAll(selector).forEach(e=>e.classList.add('sc-retired-links'));
}
// Teacher owns the detailed historical-screening panel. Preserve the readonly
// bridge on Trading because its verified eligibility count consumes its event;
// only hide the redundant display. Other source bridges remain non-authoritative.
if(['strategy-validation.html','robot-academy.html','trading-floor.html'].includes(page)){
 const duplicate=document.getElementById('qualification-bridge');
 if(duplicate){
  duplicate.classList.add('sc-retired-evidence');
  const note=el('aside','sc-evidence-owner');
  note.append(el('span','', 'Independent screening and admission evidence is maintained in the Teacher’s Office. '),
              link('Review evidence →','teacher-console.html','sc-evidence-link'));
  duplicate.insertAdjacentElement('afterend',note);
 }
}
const css=document.createElement('link');
css.rel='stylesheet';css.href='./journey-nav.css';document.head.append(css);
})();