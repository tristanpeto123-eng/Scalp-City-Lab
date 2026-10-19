// One truthful navigation model shared by Scalp City's separate experiences.
// Links are literal same-origin app routes. No credentials, order controls,
// synthesized admission status or remote scripts.
(()=>{
  'use strict';
  if(document.querySelector('.sc-journey-dock'))return;
  const stages=[
    {path:'strategy-validation.html',name:'Historical Lab',description:'Research strategies on past market data'},
    {path:'robot-academy.html',name:'Robot Academy',description:'Ten pupils, historical learning and progress'},
    {path:'teacher-console.html',name:"Teacher's Office",description:'Independent qualification and PAPER evidence'},
    {path:'trading-floor.html',name:'Trading Floor',description:'Monitor admitted traders or run synthetic demo'}
  ];
  const current=location.pathname.split('/').pop()||'index.html';
  const idx=stages.findIndex(s=>s.path===current);
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./journey-nav.css';document.head.appendChild(link);
  const dock=document.createElement('aside');dock.className='sc-journey-dock';
  dock.setAttribute('aria-label','Scalp City journey navigation');
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='sc-journey-trigger';
  toggle.setAttribute('aria-controls','sc-journey-panel');toggle.setAttribute('aria-expanded','false');
  const dot=document.createElement('span');dot.className='sc-dot';dot.setAttribute('aria-hidden','true');
  toggle.append(dot,document.createTextNode(idx>=0?'Journey · '+(idx+1)+'/4':'Explore Scalp City'));
  const panel=document.createElement('nav');panel.className='sc-journey-panel';
  panel.id='sc-journey-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Scalp City section journey');
  const top=document.createElement('div');top.className='sc-journey-top';
  const heading=document.createElement('div');
  const eyebrow=document.createElement('span');eyebrow.className='sc-journey-eyebrow';eyebrow.textContent='ONE CONNECTED WORKFLOW';
  const name=document.createElement('div');name.className='sc-journey-name';name.textContent='Scalp City';
  heading.append(eyebrow,name);
  const close=document.createElement('button');close.className='sc-journey-close';close.type='button';close.textContent='✕';
  close.setAttribute('aria-label','Close journey navigator');
  top.append(heading,close);
  const copy=document.createElement('p');copy.className='sc-journey-copy';
  copy.textContent='Historical research comes first. Qualification is separate, and PAPER orders stay locked until independently approved.';
  const list=document.createElement('ol');list.className='sc-journey-stages';
  for(const [index,stage] of stages.entries()){
    const li=document.createElement('li');
    const a=document.createElement('a');a.href='./'+stage.path;a.className='sc-journey-stage';
    if(current===stage.path)a.setAttribute('aria-current','page');
    const numeral=document.createElement('span');numeral.className='sc-stage-number';numeral.textContent=String(index+1);
    const labels=document.createElement('span');
    const bold=document.createElement('strong');bold.textContent=stage.name;
    const sub=document.createElement('small');sub.textContent=stage.description;
    labels.append(bold,sub);a.append(numeral,labels);li.appendChild(a);list.appendChild(li);
  }
  const extras=document.createElement('div');extras.className='sc-journey-links';
  for(const [label,url] of [
    ['Mission Control','./mission-control.html'],
    ['Explore 3D City','./agent-city.html'],
    ['Legacy research scene','./index.html']
  ]){const a=document.createElement('a');a.href=url;a.textContent=label;
    if(current===url.slice(2))a.setAttribute('aria-current','page');extras.append(a);}
  panel.append(top,copy,list,extras);dock.append(toggle,panel);document.body.append(dock);
  const setOpen=open=>{
    panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    if(open)close.focus();else toggle.focus();
  };
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  close.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)setOpen(false)});
  document.addEventListener('pointerdown',e=>{
    if(!panel.hidden&&!dock.contains(e.target)){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
  });
})();
