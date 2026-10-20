import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const $ = id => document.getElementById(id);
const palette = { gold:0xe8ca91, teal:0x69e8d7, steel:0x243c4f, black:0x06111c, cream:0xeaf3ea };
export const FLOORS = [
  {name:'Mission Control',role:'Operations hub',accent:0xe8ca91,stations:[
    ['Director','Cross-system overview','mission',-8,-3],['Research coordinator','Strategy discovery','lab',0,-3],['Archivist','Experiment records','monitor',8,-3],['Navigator','Departments and route map','elevator',-6,4]]},
  {name:'Research Lab',role:'Historical strategy development',accent:0x5bcce2,stations:[
    ['BTC Research','Historical candles / provisional','lab',-9,-4],['ETH Research','Historical candles / provisional','lab',-3,-4],['SOL Research','Historical candles / provisional','lab',3,-4],['NEO','Pattern-memory research','neo',9,-4],['Replay Analyst','5-minute candle inspection','replay',-6,3],['Strategy Auditor','Out-of-sample validation','lab',6,3]]},
  {name:'Robot Academy',role:'Training classrooms',accent:0xb9a4f2,stations:[
    ['BTC Pupil','Training-grade illustration','academy',-10,-4],['ETH Pupil','Training-grade illustration','academy',-5,-4],['SOL Pupil','Training-grade illustration','academy',0,-4],['XRP Pupil','Training-grade illustration','academy',5,-4],['ADA Pupil','Training-grade illustration','academy',10,-4],['AVAX Pupil','Training-grade illustration','academy',-10,4],['LINK Pupil','Training-grade illustration','academy',-5,4],['DOGE Pupil','Training-grade illustration','academy',0,4],['LTC Pupil','Training-grade illustration','academy',5,4],['BCH Pupil','Training-grade illustration','academy',10,4]]},
  {name:"Teacher's Office",role:'Independent examination',accent:0x82d9ca,stations:[
    ['Teacher-01','Review of holdout & signed PAPER evidence','teacher',-8,-3],['The Checker','Evidence and admission gates','teacher',0,-3],['Exam Recorder','Qualification dossier viewer','academy',8,-3]]},
  {name:'Trading Floor',role:'PAPER-gated only · no live funds',accent:0xf2bb7c,stations:[
    ['Admitted Seat 01','Reserved / not verified','paper',-8,-4],['Admitted Seat 02','Reserved / not verified','paper',0,-4],['Admitted Seat 03','Reserved / not verified','paper',8,-4],['Risk Desk','No authority to place real-money trades','teacher',-8,3],['Evidence Feed','Review actual forward-paper reports','paper',0,3],['Supervisory Desk','Examination gates','teacher',8,3]]},
  {name:'Operations',role:'Training scheduler and telemetry',accent:0x89c7ee,stations:[
    ['Training Monitor','Published batch telemetry, not streaming','monitor',-8,-3],['Market Replay','5-minute candle viewer','replay',0,-3],['NEO Archive','Historical pattern-memory research','neo',8,-3],['World Directory','Navigation and app directory','elevator',-6,4]]}
];
window.ScalpWorld = {floors:FLOORS,teleport};
let floorNumber = 0, scene, camera, renderer, stage, signTexture, robotMeshes=[], blockers=[], clock;
let yaw=0,pitch=0,drag=null,wasDragged=false,paused=false,worldReady=false;
const keys=new Set(),touchMoves=new Set(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const material=(color,roughness=.6,metalness=.23)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const emissive=(color,power=.7)=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:power,metalness:.33,roughness:.33});
const mats={floor:material(0x152636,.78),wall:material(0x203347,.68),steel:material(0x293d4e,.4,.75),dark:material(0x0b1827,.6),glass:new THREE.MeshPhysicalMaterial({color:0x83cad2,transparent:true,opacity:.18,roughness:.2,depthWrite:false}),gold:emissive(palette.gold,.45),screen:emissive(0x2dbed1,.7)};
function box(parent,w,h,d,mat,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.receiveShadow=true;o.castShadow=true;parent.add(o);return o;}
function cylinder(parent,rt,rb,h,mat,x,y,z){const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,12),mat);o.position.set(x,y,z);parent.add(o);return o;}
function labelTexture(top,sub,color='#a6e8e3'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=230;
  const c=canvas.getContext('2d');c.fillStyle='#0a1825';c.fillRect(0,0,1024,230);
  c.fillStyle=color;c.fillRect(0,0,1024,8);c.font='900 65px system-ui,sans-serif';c.fillText(top.toUpperCase().slice(0,26),48,102);
  c.fillStyle='#b1cad4';c.font='600 30px system-ui,sans-serif';c.fillText(sub.toUpperCase().slice(0,48),48,159);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function neonLabel(parent,top,sub,x,y,z,width=6){
  const tex=labelTexture(top,sub);const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width*230/1024),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function stationScreen(name,role,accent){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=300;
  const c=canvas.getContext('2d');c.fillStyle='#07151f';c.fillRect(0,0,512,300);
  c.fillStyle='#153449';c.fillRect(18,18,476,264);c.strokeStyle='#80e6da';
  c.strokeRect(18,18,476,264);
  c.fillStyle='#ccecf1';c.font='bold 25px system-ui';c.fillText(name.toUpperCase().slice(0,25),34,58);
  c.fillStyle='#8ab5c0';c.font='18px system-ui';c.fillText(role.slice(0,42),34,91);
  c.strokeStyle='#75d6c4';c.lineWidth=4;c.beginPath();
  // These are decorative waveforms, NOT historical or forward performance charts.
  for(let i=0;i<33;i++){const x=32+i*14,y=175+Math.sin(i*.54+name.length)*24+Math.cos(i*.26)*15;
    if(!i)c.moveTo(x,y);else c.lineTo(x,y);}
  c.stroke();c.fillStyle='#e8ca91';c.font='bold 16px system-ui';
  c.fillText('VISUAL DEMO / NO ORDER EXECUTION',34,257);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function robot(parent,name,role,app,x,z,i,accent){
  const g=new THREE.Group();g.position.set(x,0,z);g.userData.station={name,role,app};
  const accentMat=emissive(accent,.25);
  cylinder(g,.54,.65,.18,mats.dark,0,.22,0);
  box(g,.79,.95,.48,accentMat,0,1.06,0);
  const head=box(g,.93,.72,.67,mats.steel,0,1.95,0);head.userData.face=true;
  box(g,.69,.26,.04,mats.dark,0,2.0,.355);
  box(g,.15,.14,.055,emissive(0x73fce9,1.6),-.19,2.04,.39);
  box(g,.15,.14,.055,emissive(0x73fce9,1.6),.19,2.04,.39);
  cylinder(g,.04,.04,.33,mats.gold,0,2.45,0);
  cylinder(g,.095,.095,.10,mats.gold,0,2.66,0);
  const armL=box(g,.24,.8,.26,mats.steel,-.57,1.21,0);
  const armR=box(g,.24,.8,.26,mats.steel,.57,1.21,0);
  const legL=box(g,.25,.35,.25,mats.dark,-.23,.37,0);
  const legR=box(g,.25,.35,.25,mats.dark,.23,.37,0);
  const desk=box(g,2.4,.12,.94,mats.steel,0,.95,.92);
  for(const sx of [-1.03,1.03])box(g,.08,.92,.08,mats.steel,sx,.47,1.18);
  box(g,1.1,.74,.10,mats.dark,0,1.59,.55);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(.99,.62),new THREE.MeshBasicMaterial({map:stationScreen(name,role,accent),side:THREE.DoubleSide}));display.position.set(0,1.59,.635);g.add(display);
  box(g,.2,.24,.18,mats.steel,0,1.2,.60);
  // "Work" is purely decorative motion, never evidence of a running trade.
  const tag=document.createElement('canvas');tag.width=512;tag.height=96;
  const ctx=tag.getContext('2d');ctx.fillStyle='#071521';ctx.fillRect(0,0,512,96);
  ctx.fillStyle='#d9eff3';ctx.font='bold 36px system-ui';ctx.textAlign='center';ctx.fillText(name.toUpperCase().slice(0,22),256,59);
  const texture=new THREE.CanvasTexture(tag);texture.colorSpace=THREE.SRGBColorSpace;
  const nameplate=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.41),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
  nameplate.position.set(0,2.95,0);g.add(nameplate);
  // Mesh ancestry allows raycast to select an individual station.
  parent.add(g);robotMeshes.push({g,head,armL,armR,i,name,role,app,x,z});
  blockers.push({x,z,r:1.18});return g;
}
function buildStage(floor){
  robotMeshes=[];blockers=[];
  if(stage){scene.remove(stage);stage.traverse(n=>{
    n.geometry?.dispose?.();
    if(n.material && !Object.values(mats).includes(n.material)){
      const arr=Array.isArray(n.material)?n.material:[n.material];
      arr.forEach(m=>{m.map?.dispose?.();m.dispose?.();});
    }
  });}
  stage=new THREE.Group();scene.add(stage);const accent=emissive(floor.accent,.8);
  box(stage,29,.6,26,mats.floor,0,-.31,0);
  for(let x=-14;x<=14;x+=2){box(stage,.02,.012,25,accent,x,.015,0);}
  for(let z=-12;z<=12;z+=2){box(stage,28,.012,.02,accent,0,.018,z);}
  for(const x of [-14,14]){
    box(stage,.4,4.0,26,mats.wall,x,2,0);
    for(const z of [-9,-3,3,9]){box(stage,.46,3.6,.17,mats.steel,x,2,z);}
    for(const z of [-6,0,6])box(stage,.48,2.6,3.4,mats.glass,x,2.1,z);
  }
  box(stage,29,4.0,.35,mats.wall,0,2,12.5);
  box(stage,10,3.9,.38,mats.wall,-9.6,2,-12.5);
  box(stage,10,3.9,.38,mats.wall,9.6,2,-12.5);
  box(stage,4.1,4.2,.45,mats.steel,0,2.1,-12.3);
  box(stage,3.1,3.1,.2,mats.dark,0,1.6,-12.03);
  box(stage,.12,3.0,.16,accent,0,1.5,-11.9);
  box(stage,3.25,.12,.15,accent,0,3.18,-11.9);
  neonLabel(stage,'LIFT / NEXT FLOOR','APPROACH DOOR AND PRESS E',0,3.82,-11.8,4.7);
  for(const x of [-13.7,13.7])for(const z of [-11.8,11.8]){
    const pillar=box(stage,.55,4.2,.6,mats.steel,x,2.1,z);pillar.userData.pillar=true;
    box(stage,.18,3.8,.18,accent,x,2.1,z);
  }
  box(stage,24,.15,1.0,mats.steel,0,4.05,12);
  // No overhead ceiling mesh; room perspective and clickable furnishings stay visible.
  neonLabel(stage,floor.name,floor.role,0,3.4,11.98,7);
  for(let i=0;i<floor.stations.length;i++){
    const [name,role,app,x,z]=floor.stations[i];
    robot(stage,name,role,app,x,z,i,floor.accent);
  }
  // Purpose-specific decor, avoiding a generic repeated office on every floor.
  if(floorNumber===0){
    neonLabel(stage,'DIRECTOR DESK','NAVIGATE RESEARCH → ACADEMY → EXAM',6,2.5,11.75,7);
    box(stage,5,.16,1.2,mats.gold,8,.85,9.3);
  }else if(floorNumber===1){
    neonLabel(stage,'MARKET RESEARCH','HISTORICAL · OOS HOLDOUT · MODEL LAB',-8,2.5,11.75,7);
    for(const x of [-10,-4,2,8])box(stage,2.1,.09,.34,mats.screen,x,3.05,11.5);
  }else if(floorNumber===2){
    neonLabel(stage,'ROBOT CLASSROOM','TEN PUPILS · PROVISIONAL GRADES',7,2.6,11.75,7);
    for(const x of [-9,-3,3,9])box(stage,.14,2.1,.14,mats.gold,x,1.1,8.5);
  }else if(floorNumber===3){
    neonLabel(stage,'EXAMINATION BOARD','INDEPENDENT EVIDENCE REQUIRED',6,2.6,11.75,8);
    box(stage,7,1.35,.13,mats.glass,6,1.7,11.7);
  }else if(floorNumber===4){
    neonLabel(stage,'PAPER GATE','NO VERIFIED SEATS · NO LIVE FUNDS',6,2.7,11.75,8);
    for(const x of [-12,-6,0,6,12])box(stage,.08,1.5,.35,accent,x,.8,7.8);
  }else if(floorNumber===5){
    neonLabel(stage,'OPERATIONS CORE','PUBLISHED BATCH DATA · NOT LIVE STREAM',7,2.7,11.75,9);
    for(const x of [-12,-10])for(const z of [5,7,9]){
      box(stage,1.2,2.2,1.1,mats.steel,x,1.1,z);
      for(let k=0;k<6;k++)box(stage,.8,.045,.02,accent,x,.45+k*.3,z+.56);
    }
  }
  // Glass planning boards and an evidence wall preserve floor personality.
  const backboard=box(stage,8,1.3,.12,mats.dark,-8,2.6,11.95);backboard.material=emissive(floor.accent,.2);
  neonLabel(stage,floor.role,'UI SCENE · NOT LIVE TRADING EVIDENCE',-8,2.72,11.85,7.3);
  box(stage,8,.15,2.6,mats.steel,7,1.13,8.1);
  for(const x of [4,10])box(stage,.14,1.18,.14,mats.steel,x,.57,9.1);
  for(let i=0;i<5;i++)box(stage,.8,.35,.08,emissive(floor.accent,.18),4.4+i*1.25,1.55,7.9);
}
function makeWorld(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0x081624);scene.fog=new THREE.FogExp2(0x0b2432,.012);
  camera=new THREE.PerspectiveCamera(69,1,.09,200);camera.position.set(0,1.7,8.7);
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.45;
  scene.add(new THREE.HemisphereLight(0xa6ddff,0x0b1826,2.2));
  const main=new THREE.DirectionalLight(0xffe8c1,1.7);main.position.set(-8,12,9);scene.add(main);
  for(const [x,z,color] of [[-9,-6,0x66e8dd],[8,2,0xffcf86],[0,10,0x7bbaff]]){
    const light=new THREE.PointLight(color,34,22,2);light.position.set(x,3.9,z);scene.add(light);
  }
  // Distant skyline through the translucent side panels.
  const skyline=new THREE.Group();scene.add(skyline);
  const shades=[0x142e43,0x1c3f55,0x183246];
  for(let i=0;i<44;i++){const a=i/44*Math.PI*2;const r=31+(i%4)*4;const h=5+(i*7%13);
    box(skyline,2+(i%3),h,3,material(shades[i%3],.94),Math.cos(a)*r,h/2-1,Math.sin(a)*r);
  }
  buildStage(FLOORS[0]);resize();clock=new THREE.Clock();worldReady=true;requestAnimationFrame(tick);
}
function updateHUD(){
  const f=FLOORS[floorNumber];
  $('floorIndex').textContent='FLOOR '+String(floorNumber+1).padStart(2,'0')+' / '+String(FLOORS.length).padStart(2,'0');
  $('floorName').textContent=f.name;$('floorRole').textContent=f.role;
  const next=FLOORS[(floorNumber+1)%FLOORS.length];
  $('liftTarget').textContent='Next: '+next.name;
  $('robotInfo').hidden=true;
  document.querySelectorAll('#floorMenu button').forEach((b,i)=>b.setAttribute('aria-current',String(i===floorNumber)));
  window.dispatchEvent(new CustomEvent('scalp:floor',{detail:{index:floorNumber,name:f.name}}));
}
function teleport(index){
  const target=Number(index);if(!Number.isInteger(target)||target<0||target>=FLOORS.length)return;
  floorNumber=target;camera?.position.set(0,1.7,8.7);yaw=0;pitch=0;drag=null;keys.clear();touchMoves.clear();
  if(stage)buildStage(FLOORS[target]);updateHUD();$('floorMenu').hidden=true;$('floorsToggle').setAttribute('aria-expanded','false');
}
function updateMovement(dt){
  if(paused||!worldReady)return;
  let f=0,s=0;
  if(keys.has('KeyW')||keys.has('ArrowUp')||touchMoves.has('forward'))f+=1;
  if(keys.has('KeyS')||keys.has('ArrowDown')||touchMoves.has('back'))f-=1;
  if(keys.has('KeyA')||touchMoves.has('left'))s-=1;
  if(keys.has('KeyD')||touchMoves.has('right'))s+=1;
  if(keys.has('ArrowLeft'))yaw+=dt*1.4;
  if(keys.has('ArrowRight'))yaw-=dt*1.4;
  if(f||s){const norm=Math.hypot(f,s);f/=norm;s/=norm;
    const speed=(keys.has('ShiftLeft')?6:3.8)*dt;
    const nx=camera.position.x+(-Math.sin(yaw)*f+Math.cos(yaw)*s)*speed;
    const nz=camera.position.z+(-Math.cos(yaw)*f-Math.sin(yaw)*s)*speed;
    const clear=(x,z)=>blockers.every(o=>Math.hypot(o.x-x,o.z-z)>o.r);
    if(nx>-12.6&&nx<12.6&&clear(nx,camera.position.z))camera.position.x=nx;
    if(nz>-10.8&&nz<11.4&&clear(camera.position.x,nz))camera.position.z=nz;
  }
  camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
  $('liftPrompt').hidden=Math.hypot(camera.position.x,camera.position.z+10.7)>2.55;
}
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.min(clock.getDelta(),.045);updateMovement(dt);
  if(!paused&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    const time=now*.001;
    for(const b of robotMeshes){b.head.rotation.z=Math.sin(time*1.25+b.i)*.038;
      b.armL.rotation.x=Math.sin(time*2.6+b.i)*.14;
      b.armR.rotation.x=-Math.sin(time*2.6+b.i)*.14;}
  }
  renderer.render(scene,camera);
}
function resize(){
  if(!camera||!renderer)return;
  const w=window.innerWidth,h=window.innerHeight;
  camera.aspect=w/h;camera.fov=w<620?78:69;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
function inspect(hit){
  let node=hit.object;while(node&&!node.userData.station)node=node.parent;
  if(!node||!node.userData.station)return;
  const {name,role,app}=node.userData.station;
  $('robotLabel').textContent='FLOOR '+(floorNumber+1)+' · ILLUSTRATIVE ROBOT';
  $('robotName').textContent=name;$('robotDescription').textContent=role+'. Character motion is a visual demonstration, not a live execution feed.';
  $('robotInfo').hidden=false;$('robotOpen').onclick=()=>window.dispatchEvent(new CustomEvent('scalp:open-app',{detail:{app}}));
}
function attachHandlers(){
  window.addEventListener('resize',resize);
  window.addEventListener('keydown',e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
    if(e.code==='KeyP'&&!e.repeat){$('phoneToggle').click();return;}
    if(e.code==='Escape'){$('robotInfo').hidden=true;$('floorMenu').hidden=true;}
    if(e.code==='KeyE'&&!$('liftPrompt').hidden&&!e.repeat){teleport((floorNumber+1)%FLOORS.length);return;}
    if(/^(Key[WASD]|Arrow(Up|Down|Left|Right)|ShiftLeft)$/.test(e.code)){keys.add(e.code);e.preventDefault();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();touchMoves.clear();});
  const canvas=$('world');
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,id:e.pointerId};wasDragged=false;canvas.setPointerCapture?.(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id||paused)return;
    const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7)wasDragged=true;
    yaw-=dx*.004;pitch=Math.max(-.9,Math.min(.85,pitch-dy*.0033));drag.lastX=e.clientX;drag.lastY=e.clientY;});
  canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;
    if(wasDragged||paused)return;
    const rect=canvas.getBoundingClientRect();
    pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const intersects=raycaster.intersectObjects(robotMeshes.map(r=>r.g),true);
    if(intersects.length&&intersects[0].distance<18)inspect(intersects[0]);});
  for(const b of document.querySelectorAll('[data-move]')){
    const move=b.dataset.move;
    b.addEventListener('pointerdown',e=>{e.preventDefault();touchMoves.add(move);b.setPointerCapture?.(e.pointerId);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>touchMoves.delete(move));
  }
  $('closeInfo').onclick=()=>$('robotInfo').hidden=true;
  $('liftButton').onclick=()=>teleport((floorNumber+1)%FLOORS.length);
  $('floorsToggle').onclick=()=>{
    const nav=$('floorMenu');nav.hidden=!nav.hidden;$('floorsToggle').setAttribute('aria-expanded',String(!nav.hidden));};
  const floorMenu=$('floorMenu');
  FLOORS.forEach((floor,index)=>{
    const b=document.createElement('button');b.type='button';
    const name=document.createElement('span');name.textContent=String(index+1).padStart(2,'0')+' · '+floor.name;
    const note=document.createElement('small');note.textContent='TELEPORT ↗';b.append(name,note);
    b.addEventListener('click',()=>teleport(index));floorMenu.append(b);
  });
  window.addEventListener('scalp:phone-state',e=>{paused=Boolean(e.detail?.open);keys.clear();touchMoves.clear();});
}
attachHandlers();
try{makeWorld();}catch(err){
  console.error('Scalp City 3D initialization failed:',err);
  $('fallback').hidden=false;
  $('fallback').querySelector('p').textContent='WebGL could not start. You can still open the phone and select floors.';
  updateHUD();
}
