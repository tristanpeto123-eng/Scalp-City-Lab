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
  // Training Monitor is a subroom of the Academy, not a fifth stage.
  const idx=current==='training-monitor.html'?1:stages.findIndex(s=>s.path===current);
  const active=idx>=0?stages[idx]:null;
  const next=idx>=0&&idx<stages.length-1?stages[idx+1]:null;
  const previous=idx>0?stages[idx-1]:null;
  const quick=next?{path:next.path,label:'Continue to '+next.name}:
    idx===3?{path:'mission-control.html',label:'Return to Mission Control'}:
    {path:current==='mission-control.html'?'strategy-validation.html':'mission-control.html',
     label:current==='mission-control.html'?'Start in Historical Lab':'Open Mission Control'};
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./journey-nav.css';document.head.appendChild(link);
  // Persistent, inline progress rail: the 4-stage learning journey should not
  // require opening a floating menu. It describes locations, NOT gate approval.
  const inlinePages=new Set([
    'mission-control.html','strategy-validation.html','robot-academy.html',
    'training-monitor.html','teacher-console.html','trading-floor.html'
  ]);
  const host=document.querySelector('body > .shell > header, body > .wrap > header, body > header, body > main > nav');
  if(inlinePages.has(current)&&host){
    const rail=document.createElement('nav');
    rail.className='sc-workflow-rail';
    rail.setAttribute('aria-label','Four-stage research and examination journey');
    const heading=document.createElement('div');heading.className='sc-workflow-heading';
    const title=document.createElement('strong');title.textContent='The Foundry / four stages';
    const note=document.createElement('span');
    note.textContent='Navigate stages freely · exams and promotions require verified evidence';
    heading.append(title,note);
    const track=document.createElement('ol');track.className='sc-workflow-track';
    const shortNames=['Historical Lab','Robot Academy',"Teacher's Office",'Trading Floor'];
    const hints=['Explore past data','Train and compare pupils','Review independent evidence','Watch approved PAPER trials'];
    const rawPupil=new URLSearchParams(location.search).get('pupil');
    const pupil=/^(BTC|ETH|SOL|XRP|ADA|AVAX|LINK|DOGE|LTC|BCH)USD$/.test(rawPupil||'')?rawPupil:null;
    for(const [i,stage] of stages.entries()){
      const li=document.createElement('li');
      const a=document.createElement('a');
      const url=new URL(stage.path,location.href);
      if(pupil&&(stage.path==='teacher-console.html'||stage.path==='trading-floor.html'))
        url.searchParams.set('pupil',pupil);
      a.href=url.href;
      a.className='sc-workflow-step';
      if(i===idx)a.setAttribute('aria-current','page');
      const num=document.createElement('span');num.className='sc-workflow-num';num.textContent=String(i+1).padStart(2,'0');
      const labels=document.createElement('span');labels.className='sc-workflow-labels';
      const label=document.createElement('strong');label.textContent=shortNames[i];
      const sub=document.createElement('small');sub.textContent=hints[i];
      labels.append(label,sub);a.append(num,labels);
      li.append(a);track.append(li);
    }
    rail.append(heading,track);
    host.insertAdjacentElement('afterend',rail);
  }
  const dock=document.createElement('aside');dock.className='sc-journey-dock';
  dock.setAttribute('aria-label','Scalp City journey navigation');
  const forward=document.createElement('a');forward.className='sc-journey-quick';
  forward.href='./'+quick.path;forward.textContent=quick.label+' →';
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='sc-journey-trigger';
  toggle.setAttribute('aria-controls','sc-journey-panel');toggle.setAttribute('aria-expanded','false');
  const dot=document.createElement('span');dot.className='sc-dot';dot.setAttribute('aria-hidden','true');
  toggle.append(dot,document.createTextNode(active?'STEP '+(idx+1)+'/4 · '+active.name:'Explore Scalp City'));
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
  copy.textContent='Historical research comes first. Qualification and forward PAPER examination remain separate, independently verified stages.';
  const context=document.createElement('div');context.className='sc-journey-context';
  const present=document.createElement('strong');
  present.textContent=active?'You are here · '+active.name:'You are in the Scalp City overview';
  const guidance=document.createElement('p');
  guidance.textContent=active?active.description+'. The next screen provides the next part of the evidence, not automatic promotion.':
    'Begin at the historical laboratory, then follow the pupils into qualification.';
  context.append(present,guidance);
  const advance=document.createElement('a');advance.className='sc-journey-next';
  advance.href='./'+quick.path;advance.textContent=quick.label+' →';
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
    ['Training Monitor','./training-monitor.html'],
    ['Mission Control','./mission-control.html'],
    ['Explore 3D City','./agent-city.html'],
    ['Legacy research scene','./index.html']
  ]){const a=document.createElement('a');a.href=url;a.textContent=label;
    if(current===url.slice(2))a.setAttribute('aria-current','page');extras.append(a);}
  const back=previous?document.createElement('a'):null;
  if(back){back.href='./'+previous.path;back.className='sc-journey-back';back.textContent='← Previous · '+previous.name;}
  panel.append(top,copy,context,list,advance);
  if(back)panel.append(back);
  panel.append(extras);
  dock.append(forward,toggle,panel);document.body.append(dock);
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
