import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// Scalp City Agent City prototype: real WebGL geometry, no trading / brokerage capability.
// In a future sprint, send observable agent telemetry via window.ScalpCityAgentCity.ingest(event).
// All default decisions below are illustrative demonstration data, never market observations.
export const AGENTS = Object.freeze([
 {id:'DC-01',name:'Data Curator',role:'Market data intake & lineage',x:-24,z:-15,color:'#26c7d9',type:'scanner',decision:'Dataset checked · 460 bars',metric:'0 missing bars',state:'DEMO · COMPLETE',notes:['Input source: SYNTHETIC','OHLC consistency verified','Data manifest prepared']},
 {id:'RS-01',name:'Researcher',role:'Hypotheses and regime discovery',x:-12,z:-15,color:'#459bff',type:'scientist',decision:'Hypothesis H-104 proposed',metric:'3 ideas considered',state:'DEMO · RESEARCH',notes:['Regime: trend / range','Potential liquidity sweep found','Research idea forwarded']},
 {id:'SD-01',name:'Strategy Designer',role:'Deterministic entry & exit rules',x:0,z:-15,color:'#ffac55',type:'engineer',decision:'Rule set S-031 frozen',metric:'12 defined rules',state:'DEMO · COMPLETE',notes:['Entry criteria assembled','Exit rules defined','Version hash generated']},
 {id:'OP-01',name:'Optimizer',role:'Training-fold parameter search',x:12,z:-15,color:'#b077ff',type:'tuner',decision:'Sweep 47% complete',metric:'4,700 candidates',state:'DEMO · RUNNING',notes:['Search bounded to training','Top candidate selected','Holdout never exposed']},
 {id:'BT-01',name:'Backtester',role:'Chronological simulation & cost ledger',x:24,z:-15,color:'#50d99b',type:'analyst',decision:'Cost-stressed report ready',metric:'6 daily strategies',state:'DEMO · COMPLETE',notes:['Next-session fills simulated','Transaction costs applied','Not proof of profitability']},
 {id:'VL-01',name:'Validator',role:'Independent out-of-sample audit',x:-18,z:1,color:'#ff626e',type:'inspector',decision:'Rejected: unstable holdout',metric:'2 of 5 checks failed',state:'DEMO · BLOCKED',notes:['Overfit warning raised','Frozen parameters inspected','Returned to research']},
 {id:'VA-01',name:'Vault',role:'Versioned experimental knowledge',x:-6,z:1,color:'#6ae0ff',type:'archivist',decision:'Experiment archived',metric:'Version chain intact',state:'DEMO · STORED',notes:['Candidate ID recorded','Input dataset fingerprinted','Historical attempts preserved']},
 {id:'JR-01',name:'Journal',role:'Decision & event audit record',x:6,z:1,color:'#82c7eb',type:'scribe',decision:'Audit event appended',metric:'12 station channels',state:'DEMO · RECORDING',notes:['Worker report received','Evidence chain extended','Trace IDs available']},
 {id:'SC-01',name:'Scorer',role:'Independent candidate ranking',x:18,z:1,color:'#ffd36e',type:'judge',decision:'Candidate Q blocked',metric:'No approval granted',state:'DEMO · WAITING',notes:['Validation gate checked','Unvalidated candidate excluded','Ranking not deployment']},
 {id:'RM-01',name:'Risk Manager',role:'Position limits & final veto',x:-14,z:17,color:'#ff496c',type:'guardian',decision:'Exposure veto active',metric:'No paper order allowed',state:'DEMO · VETO',notes:['Daily loss limit checked','Max exposure condition failed','Manager cannot override']},
 {id:'BM-01',name:'Bot Manager',role:'Schedule, routing & monitoring',x:0,z:17,color:'#46bbff',type:'commander',decision:'12 stations monitored',metric:'No gate overrides',state:'DEMO · IDLE',notes:['Tasks routed across stations','Agent state displayed','Failures returned to research']},
 {id:'PT-01',name:'Paper Trader',role:'Simulated execution only',x:14,z:17,color:'#44ddb7',type:'operator',decision:'Standing by · no approval',metric:'0 simulated orders',state:'DEMO · STANDBY',notes:['Risk gate required','No broker integration','Simulation environment only']}
]);
const FLOW = Object.freeze([
 ['DC-01','RS-01'],['RS-01','SD-01'],['SD-01','OP-01'],['OP-01','BT-01'],
 ['BT-01','VL-01'],['VL-01','SC-01'],['VL-01','RS-01'],['SC-01','RM-01'],['RM-01','PT-01'],
 ['PT-01','JR-01'],['JR-01','VA-01'],['VA-01','RS-01'],['BM-01','DC-01'],['BM-01','RM-01']
]);
const byId=new Map(AGENTS.map(a=>[a.id,{...a,origin:'ILLUSTRATIVE / SYNTHETIC',events:a.notes.slice()}]));
const $=s=>document.querySelector(s), stage=$('#stage'),canvas=$('#agentCityCanvas');
const rail=$('#stationRail'),inspector=$('#inspector');
const mats=new Map();
const ink=new THREE.MeshStandardMaterial({color:0x09111e,metalness:.65,roughness:.35});
const steel=new THREE.MeshStandardMaterial({color:0x21364f,metalness:.78,roughness:.23});
const satin=new THREE.MeshStandardMaterial({color:0x5b708b,metalness:.65,roughness:.32});
const floorMat=new THREE.MeshStandardMaterial({color:0x0a1522,metalness:.6,roughness:.38});
const concrete=new THREE.MeshStandardMaterial({color:0x101b2d,metalness:.42,roughness:.64});
function material(color,emit=.4){const key=color+emit;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:emit,metalness:.49,roughness:.29}));return mats.get(key)}
function box(parent,w,h,d,mat,x=0,y=0,z=0){const v=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);v.position.set(x,y,z);parent.add(v);v.castShadow=true;v.receiveShadow=true;return v}
function sphere(parent,r,mat,x=0,y=0,z=0,segments=14){const v=new THREE.Mesh(new THREE.SphereGeometry(r,segments,10),mat);v.position.set(x,y,z);parent.add(v);v.castShadow=true;return v}
function cylinder(parent,r1,r2,h,mat,x=0,y=0,z=0,segments=16){const v=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),mat);v.position.set(x,y,z);parent.add(v);v.castShadow=true;return v}
function lineBetween(parent,a,b,col,radius=.045){const a3=new THREE.Vector3(...a),b3=new THREE.Vector3(...b),dif=b3.clone().sub(a3);const len=dif.length();if(len<.01)return null;const mesh=cylinder(parent,radius,radius,len,material(col,.6),0,0,0,8);mesh.position.copy(a3.add(b3).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dif.normalize());return mesh}
function screen(parent,w,h,x,y,z,draw,angle=0){const t=document.createElement('canvas');t.width=512;t.height=320;const ctx=t.getContext('2d');const texture=new THREE.CanvasTexture(t);texture.colorSpace=THREE.SRGBColorSpace;const frame=new THREE.Group();frame.position.set(x,y,z);frame.rotation.y=angle;parent.add(frame);box(frame,w+.17,h+.18,.13,steel);box(frame,w+.07,h+.07,.018,ink,0,0,.076);const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));face.position.z=.09;frame.add(face);return {ctx,texture,frame,draw:()=>{draw(ctx,t.width,t.height);texture.needsUpdate=true}}}
function txt(ctx,v,x,y,size=23,color='#e7effe',align='left',weight='700'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px ui-monospace,Menlo,monospace`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(v),x,y)}
function truncate(s,max){s=String(s);return s.length>max?s.slice(0,max-1)+'…':s}
function screenTexture(agent){return (ctx,w,h)=>{ctx.fillStyle='#030c1a';ctx.fillRect(0,0,w,h);for(let x=0;x<w;x+=38){ctx.fillStyle='#16304477';ctx.fillRect(x,0,1,h)}for(let y=0;y<h;y+=38){ctx.fillStyle='#16304477';ctx.fillRect(0,y,w,1)}ctx.fillStyle=agent.color;ctx.fillRect(0,0,w,6);txt(ctx,agent.id+'  /  '+agent.name.toUpperCase(),23,37,23,'#c1e9ff');txt(ctx,truncate(agent.state,27),23,78,19,agent.color);ctx.fillStyle='#1a2a3a';ctx.fillRect(20,107,w-40,1);txt(ctx,'DECISION',23,136,17,'#7294b4');txt(ctx,truncate(agent.decision,30),23,167,24,'#f0f5fd');txt(ctx,'MONITOR',23,216,17,'#7294b4');txt(ctx,truncate(agent.metric,29),23,247,22,'#f6cd88');txt(ctx,agent.origin.includes('EXTERNAL')?'EXTERNAL EVENT':'DEMO STATE · NO LIVE DATA',23,294,16,'#849db5') }}
function signTexture(agent){const t=document.createElement('canvas');t.width=1024;t.height=180;const c=t.getContext('2d');c.fillStyle='#08182a';c.fillRect(0,0,1024,180);c.fillStyle=agent.color;c.fillRect(0,0,1024,10);c.fillRect(0,172,1024,8);txt(c,agent.name.toUpperCase(),512,81,67,'#e3eeff','center','900');const texture=new THREE.CanvasTexture(t);texture.colorSpace=THREE.SRGBColorSpace;return texture}
const scene=new THREE.Scene();scene.background=new THREE.Color('#040916');scene.fog=new THREE.FogExp2('#040915',.006);
const hemi=new THREE.HemisphereLight(0x8ec6ff,0x080a13,1.38);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xc4ddff,2.5);sun.position.set(-18,38,14);scene.add(sun);
const fill=new THREE.PointLight(0x6f37ff,85,85,2);fill.position.set(2,19,-15);scene.add(fill);
const highlight=new THREE.PointLight(0x27d7ff,60,65,2);highlight.position.set(1,14,18);scene.add(highlight);
const world=new THREE.Group();scene.add(world);
box(world,68,1.5,52,ink,0,-1.1,1);
box(world,66,.15,50,floorMat,0,-.32,1);
const grid=new THREE.GridHelper(66,33,0x316180,0x17293c);grid.position.y=-.23;grid.scale.z=.76;world.add(grid);
for(let i=0;i<70;i++){const x=-32+i*1;const edge=box(world,.025,.03,47,material(i%5===0?'#0c3e59':'#123145',.15),x,-.19,1);edge.castShadow=false}
// Distant physical skyline makes parallax legible, while agent stations remain the dominant forms.
let seed=17417;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
for(let i=0;i<130;i++){const x=(rand()-.5)*170,z=-42-rand()*60,h=4+rand()*26;if(Math.abs(x)<34&&z>-48)continue;const b=box(world,1.8+rand()*3,h,2.5+rand()*3,concrete,x,h/2-1,z);b.castShadow=false;for(let row=0;row<Math.min(18,Math.floor(h/1.45));row++) {if(rand()>.58)box(world,.38,.18,.035,material(rand()>.5?'#28698c':'#76558a',.17),x+(rand()-.5)*1,h*.1+row*1.12-1,z+1.3);}}
function neonRing(parent,r,col,y){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,.045,7,64),material(col,.7));mesh.rotation.x=-Math.PI/2;mesh.position.y=y;parent.add(mesh);return mesh}
function makeRobot(g,a){
 const robot=new THREE.Group();robot.position.set(0,.2,.52);g.add(robot);const col=material(a.color,.5);const accent=material('#e4ecff',.08);
 // Feet, segmented legs, neck, torso, shoulder joints and arms have distinct physical volumes.
 for(const dx of [-.34,.34]) {box(robot,.31,.38,.38,steel,dx,.22,.08);box(robot,.46,.14,.62,ink,dx,.07,.18);sphere(robot,.17,col,dx,.48,.05)}
 const torso=box(robot,1.24,1.07,.81,accent,0,1.05,0);box(robot,.97,.77,.10,steel,0,1.06,.46);
 box(robot,.77,.18,.13,col,0,1.21,.535);
 cylinder(robot,.12,.12,.23,steel,0,1.69,0);
 const head=new THREE.Group();head.position.y=2.08;robot.add(head);
 box(head,1.03,.68,.75,accent);box(head,.86,.27,.075,ink,0,.075,.414);
 for(let dx of [-.22,.22])box(head,.19,.10,.02,col,dx,.09,.46);
 for(let dx of [-.67,.67]){sphere(robot,.22,col,dx,1.42,0);lineBetween(robot,[dx,1.36,.04],[dx*1.15,.85,.32],a.color,.12);sphere(robot,.14,accent,dx*1.15,.85,.32);box(robot,.25,.21,.21,steel,dx*1.15,.67,.35)}
 sphere(head,.10,col,.0,.46,0);lineBetween(head,[0,.47,0],[.0,.72,0],a.color,.035);sphere(head,.10,col,0,.74,0);
 // Differentiated profession-specific equipment: not identical spheres labeled differently.
 if(a.type==='scientist'){box(head,.27,.10,.12,col,-.26,.32,.39);box(head,.27,.10,.12,col,.26,.32,.39);box(robot,.35,.06,.22,col,.73,.9,.55)}
 if(a.type==='engineer'){box(robot,.4,.17,.5,col,.0,.5,.84);cylinder(robot,.12,.12,.5,col,.63,.61,.6,6)}
 if(a.type==='tuner'){for(let i=0;i<3;i++)box(robot,.27,.36,.18,col,-.6+i*.6,1.04,-.48)}
 if(a.type==='analyst'){box(robot,.72,.08,.4,col,.0,.68,1.06)}
 if(a.type==='inspector'){sphere(robot,.41,col,.75,.85,.9);cylinder(robot,.035,.035,.65,col,1.02,.68,.91)}
 if(a.type==='archivist'){cylinder(robot,.5,.5,.13,col,0,.6,.9,8)}
 if(a.type==='scribe'){box(robot,.7,.08,.55,col,0,.65,.95);box(robot,.07,.44,.07,col,.65,.8,1.0)}
 if(a.type==='judge'){for(const dx of [-.25,0,.25]){const crown=cylinder(robot,.09,.14,.25,col,dx,2.56,0,6);crown.rotation.z=dx*.15}}
 if(a.type==='guardian'){const shield=new THREE.Mesh(new THREE.IcosahedronGeometry(.45,0),col);shield.position.set(.74,.85,.91);robot.add(shield)}
 if(a.type==='commander'){neonRing(robot,.78,a.color,.1);sphere(robot,.16,col,0,1.11,.55)}
 if(a.type==='operator'){box(robot,.54,.08,.34,col,0,.64,.9);sphere(robot,.13,col,.6,2.12,.0)}
 if(a.type==='scanner'){for(let dx of [-.46,.46])cylinder(head,.11,.11,.41,col,dx,.64,0)}
 robot.userData={agentId:a.id};return robot;
}
const stations=new Map(),pickables=[],linkMeshes=[],animationItems=[];
function station(a){
 const group=new THREE.Group();group.position.set(a.x,0,a.z);world.add(group);
 const col=material(a.color,.66);
 // Architectural volumes: substantial slab, full rear wall, glass side elevations, open 3 m frontage.
 box(group,8.55,.65,8.5,ink,0,-.07,0);
 box(group,7.9,.16,7.9,steel,0,.28,0);
 for(let dx of [-3.65,3.65])box(group,.24,3.7,7.5,steel,dx,2.08,0);
 box(group,7.6,3.65,.35,concrete,0,2.0,-3.57);
 for(let dx of [-3.53,3.53])box(group,.12,2.55,6.8,new THREE.MeshStandardMaterial({color:0x6aa5b7,metalness:.17,roughness:.17,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}),dx,2.05,.05);
 box(group,8.5,.21,8.5,steel,0,4.12,0);
 box(group,7.5,.09,6.3,ink,0,4.2,-.8);
 // Roof glazing aperture over the robot; architectural frame actually has an opening.
 box(group,6.9,.14,.35,col,0,4.25,3.5);box(group,6.9,.14,.35,col,0,4.25,-3.5);
 for(let dx of [-3.95,3.95]){box(group,.19,4,.19,col,dx,2.04,3.5);box(group,.16,.1,7.6,col,dx,4.13,0)}
 for(let z of [-3.5,3.5])box(group,7.9,.09,.10,col,0,.34,z);
 // Open front with 3.5m clear pedestrian aperture; transparent back screens.
 for(let dx of [-3.35,3.35])box(group,.34,2.15,.38,steel,dx,1.52,3.48);
 const sg=new THREE.Mesh(new THREE.PlaneGeometry(5.9,1.01),new THREE.MeshBasicMaterial({map:signTexture(a),side:THREE.DoubleSide}));sg.position.set(0,3.49,3.84);group.add(sg);
 const agent=byId.get(a.id);
 const screen0=screen(group,3.55,2.25,0,2.15,-3.27,(c,w,h)=>screenTexture(agent)(c,w,h));screen0.draw();
 const screen1=screen(group,2.14,1.22,-2.43,1.55,-1.6,(c,w,h)=>{c.fillStyle='#041225';c.fillRect(0,0,w,h);txt(c,'TASK QUEUE',18,35,30,'#8ddafa');agent.events.slice(0,4).forEach((t,i)=>txt(c,'▸ '+truncate(t,29),18,94+i*50,21,i===0?a.color:'#aac4dc'))},Math.PI*.13);screen1.draw();
 box(group,4.2,.16,1.6,steel,0,.82,1.97);box(group,4.0,.12,1.43,ink,0,.98,1.98);
 for(let dx of [-1.6,1.6])box(group,.22,.75,.22,steel,dx,.40,1.97);
 // Physical keyboard and desk monitor, so every robot visibly works at a real station.
 const con=box(group,1.8,.055,.5,col,0,1.02,1.73);con.rotation.x=.03;
 for(let k=-3;k<4;k++)box(group,.16,.024,.20,material('#30506c',.15),k*.21,1.07,1.68);
 const robot=makeRobot(group,a);
 const light=new THREE.PointLight(new THREE.Color(a.color),18,13,2);light.position.set(0,3.24,1.15);group.add(light);
 // Accessible independent docking platform, with visible active ring.
 neonRing(group,3.25,a.color,.45);
 box(group,2.6,.04,1.1,col,0,.48,3.6);
 let interact=box(group,8.15,3.8,8.0,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),0,2.3,0);interact.visible=false;
 const clickTargets=[...group.children.filter(x=>x.isMesh && x!==interact),...robot.children.filter(x=>x.isMesh)];
 clickTargets.forEach(t=>{t.userData.agentId=a.id;pickables.push(t)});
 stations.set(a.id,{a,group,robot,screen0,screen1,light});animationItems.push({robot,light,a});
}
AGENTS.forEach(station);
// Central spine and luminous message conduits are real tubes with moving data particles.
for(const [from,to] of FLOW){const aa=byId.get(from),bb=byId.get(to);const points=[new THREE.Vector3(aa.x,.49,aa.z),new THREE.Vector3(aa.x,.53,aa.z+Math.sign(bb.z-aa.z)*4.6),new THREE.Vector3(bb.x,.53,bb.z-Math.sign(bb.z-aa.z)*4.6),new THREE.Vector3(bb.x,.49,bb.z)];if(Math.abs(aa.z-bb.z)<1){points.splice(1,2,new THREE.Vector3((aa.x+bb.x)/2,.51,(aa.z+bb.z)/2));}
 const crv=new THREE.CatmullRomCurve3(points);const tube=new THREE.Mesh(new THREE.TubeGeometry(crv,Math.max(8,Math.ceil(crv.getLength()/2)),.075,6,false),material('#26486e',.35));world.add(tube);const pulse=sphere(world,.18,material(from==='RM-01'?'#ff496c':'#54defb',1.3));linkMeshes.push({curve:crv,pulse,offset:rand()});}
// Public-purpose navigation, explicit orbit limits, pinch/scroll and tap selection.
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
const camera=new THREE.PerspectiveCamera(44,1,.1,410);
const target=new THREE.Vector3(0,0,0), cameraDest=new THREE.Vector3();
let yaw=0,pitch=.83,distance=95,focus=new THREE.Vector3(0,0,1),selected=null,dragging=false,hasDragged=false,lastX=0,lastY=0,downX=0,downY=0,lastPinch=0;
const reduceMotion=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
function resetCamera(){selected=null;focus.set(0,0,1);yaw=0;pitch=.87;distance=window.innerWidth<720?160:95;refreshSelection();$('#help').hidden=false}
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=window.innerWidth<700?56:44;camera.updateProjectionMatrix();if(!selected&&window.innerWidth<720)distance=Math.max(distance,145)}
window.addEventListener('resize',resize);resize();resetCamera();
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
function choose(id){const a=byId.get(id);if(!a)return;selected=id;focus.set(a.x,1.5,a.z);yaw=0;pitch=.47;distance=13.4;refreshSelection();$('#help').hidden=true;
 $('#agentCode').textContent=a.id;$('#agentName').textContent=a.name;$('#agentRole').textContent=a.role;$('#agentState').textContent=a.state;$('#agentDecision').textContent=a.decision;$('#agentMetric').textContent=a.metric;$('#agentOrigin').textContent=a.origin;$('#agentEvents').replaceChildren(...a.events.slice(0,6).map(t=>{let li=document.createElement('li');li.textContent=t;return li}));inspector.style.setProperty('--accent',a.color);inspector.hidden=false;}
function refreshSelection(){if(!selected)inspector.hidden=true;for(const b of rail.querySelectorAll('button'))b.setAttribute('aria-current',String(b.dataset.id===selected));}
for(const a of AGENTS){const b=document.createElement('button');b.type='button';b.dataset.id=a.id;b.style.setProperty('--accent',a.color);b.innerHTML=`${a.name}<small>${a.id}</small>`;b.addEventListener('click',()=>choose(a.id));rail.appendChild(b)}
$('#overview').addEventListener('click',resetCamera);
$('#closeInspector').addEventListener('click',resetCamera);
function lookPoint(ev){const rect=canvas.getBoundingClientRect();pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;ray.setFromCamera(pointer,camera);let hits=ray.intersectObjects(pickables,false);if(hits.length){let id=hits[0].object.userData.agentId;if(id)choose(id)}}
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.isPrimary===false)return;dragging=true;hasDragged=false;downX=lastX=e.clientX;downY=lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;if(Math.hypot(e.clientX-downX,e.clientY-downY)>7)hasDragged=true;if(hasDragged){yaw-=dx*.004;pitch=THREE.MathUtils.clamp(pitch+dy*.003,.24,1.35)}});
canvas.addEventListener('pointerup',e=>{if(!hasDragged)lookPoint(e);dragging=false});canvas.addEventListener('pointercancel',()=>{dragging=false});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.0011),9,210)},{passive:false});
canvas.addEventListener('touchmove',e=>{if(e.touches.length===2){let a=e.touches[0],b=e.touches[1],n=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);if(lastPinch>0)distance=THREE.MathUtils.clamp(distance*lastPinch/n,9,210);lastPinch=n}}, {passive:true});canvas.addEventListener('touchend',()=>{lastPinch=0});
window.addEventListener('keydown',e=>{if(e.key==='Escape')resetCamera();if(e.key==='ArrowLeft')yaw-=.1;if(e.key==='ArrowRight')yaw+=.1;if(e.key==='ArrowUp')pitch=Math.max(.24,pitch-.1);if(e.key==='ArrowDown')pitch=Math.min(1.35,pitch+.1)});
function displayAgent(id){const o=stations.get(id);if(!o)return;o.screen0.draw();o.screen1.draw();if(selected===id)choose(id)}
// Telemetry adapter: display-only. Client-origin data is never a permission/approval source.
function ingest(event){if(!event||typeof event!=='object')return false;const id=String(event.agentId||'');let a=byId.get(id);if(!a)return false;
 const text=(value,max=85)=>String(value||'').replace(/[\r\n\t]/g,' ').slice(0,max);
 if(event.decision)a.decision=text(event.decision);if(event.state)a.state=text(event.state,40);if(event.metric)a.metric=text(event.metric,50);
 const message=text(event.message||event.decision||event.type||'Observation');a.events.unshift(message);a.events=a.events.slice(0,12);a.origin='EXTERNAL EVENT · DISPLAY ONLY';displayAgent(id);$('#sourceMode').textContent='EXTERNAL EVENTS / VIEW ONLY';return true;}
window.ScalpCityAgentCity=Object.freeze({ingest,select:choose,overview:resetCamera,stations:AGENTS.map(a=>({id:a.id,name:a.name}))});
window.addEventListener('scalp-city:agent-status',e=>ingest(e.detail));
window.addEventListener('scalp-city:agent-report',e=>ingest({agentId:e.detail?.agentId||'BT-01',state:'REPORT RECEIVED',decision:'Backtest report received',metric:'Review required · not approved',message:'Backtest report published for review'}));
try {const bc=new BroadcastChannel('scalp-city-lab-telemetry-v1');bc.onmessage=e=>ingest(e.data)}catch{}
const demoSequence=Object.freeze({
'DC-01':['Import received · synthetic OHLC','Data checks passed'],
'RS-01':['Reviewing regimes and liquidity','Hypothesis H-104 drafted'],
'SD-01':['Entry and exit rules compiled','Strategy S-031 version frozen'],
'OP-01':['Search training parameters','Training sweep checkpoint'],
'BT-01':['Replaying historical bars','Cost stress report produced'],
'VL-01':['Examining sealed holdout','Candidate failed robustness gate'],
'SC-01':['Comparing validated candidates','Blocked candidate excluded'],
'RM-01':['Exposure and drawdown review','Simulated trade veto applied'],
'PT-01':['No approved paper signal','Order queue remains empty'],
'JR-01':['Recording audit events','Experiment decision recorded'],
'VA-01':['Writing candidate version','Experiment archived for research'],
'BM-01':['Checking task dependencies','Workflow routed to agents']});
let playing=false,playIndex=0,lastCycle=0;const sequence=['DC-01','RS-01','SD-01','OP-01','BT-01','VL-01','SC-01','RM-01','PT-01','JR-01','VA-01','BM-01'];
$('#play').addEventListener('click',()=>{playing=true;$('#play').hidden=true;$('#pause').hidden=false;$('#pause').setAttribute('aria-pressed','true')});
$('#pause').addEventListener('click',()=>{playing=false;$('#play').hidden=false;$('#pause').hidden=true;$('#pause').setAttribute('aria-pressed','false')});
const clock=new THREE.Clock();let last=0;
function frame(){requestAnimationFrame(frame);const delta=clock.getDelta(),elapsed=clock.elapsedTime;if(playing&&!reduceMotion&&elapsed-lastCycle>2.4){playIndex=(playIndex+1)%sequence.length;const a=byId.get(sequence[playIndex]);if(a){a.state='DEMO · REPLAY';a.decision=demoSequence[a.id][playIndex%2];a.events.unshift('Illustrative workflow: '+a.decision);a.events=a.events.slice(0,12);displayAgent(a.id);$('#activity').textContent=a.id+' / '+a.state;stations.get(a.id).light.intensity=30;}lastCycle=elapsed}
 const x=focus.x+Math.sin(yaw)*Math.cos(pitch)*distance,z=focus.z+Math.cos(yaw)*Math.cos(pitch)*distance,y=focus.y+Math.sin(pitch)*distance;cameraDest.set(x,y,z);const smooth=reduceMotion?1:1-Math.exp(-delta*5);camera.position.lerp(cameraDest,smooth);target.lerp(focus,smooth);camera.lookAt(target);
 if(!reduceMotion){for(const item of animationItems){item.robot.rotation.y=Math.sin(elapsed*.7+item.a.x)*.08;item.robot.position.y=.2+Math.sin(elapsed*1.4+item.a.z)*.04;item.light.intensity=16+Math.sin(elapsed*1.1+item.a.x)*3;}for(const p of linkMeshes)p.pulse.position.copy(p.curve.getPoint((elapsed*.08+p.offset)%1));}
 renderer.render(scene,camera);if(last===0){window.__scalpCityReady=true;$('#loading').hidden=true;last=elapsed||.0001;}}
try{frame()}catch(error){console.error('Agent City runtime error',error);$('#loading').hidden=true;$('#error').hidden=false}
