import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const C={ink:0x020208,obsidian:0x070610,screen:0x03050d,violet:0x6f37ff,magenta:0xff2dce,cyan:0x27d7ff,green:0x35ffa7,red:0xff315f,gold:0xffd35a,white:0xf3efff};
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(()=>{let s=0x51ca17;return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})();

function darkMat(color=C.obsidian,metalness=.82,roughness=.26){return new THREE.MeshStandardMaterial({color,metalness,roughness})}
function neonMat(color,intensity=2.4){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,metalness:.35,roughness:.22})}
function glassMat(opacity=.22,color=0x8d71ff){return new THREE.MeshPhysicalMaterial({color,transparent:true,opacity,roughness:.12,metalness:.08,transmission:.18,depthWrite:false,side:THREE.DoubleSide})}
function makeBox(w,h,d,mat,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function cyl(r1,r2,h,mat,x=0,y=0,z=0,seg=24){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function text(ctx,str,x,y,size,color='#fff',weight=700,align='left',family='ui-monospace, SFMono-Regular, Menlo, monospace'){ctx.font=`${weight} ${size}px ${family}`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(String(str),x,y)}
function roundedRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function makeCanvasTexture(w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:true});const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;return{canvas,ctx,texture}}
function panelBase(ctx,w,h,accent){ctx.clearRect(0,0,w,h);ctx.fillStyle='#02030a';ctx.fillRect(0,0,w,h);const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(111,55,255,.11)');g.addColorStop(.54,'rgba(0,0,0,0)');g.addColorStop(1,accent+'22');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.055)';ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(0,h*i/6);ctx.lineTo(w,h*i/6);ctx.stroke()}for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(w*i/8,0);ctx.lineTo(w*i/8,h);ctx.stroke()}}
function fitLine(ctx,s,maxWidth,maxChars=54){const t=String(s||'').replace(/\s+/g,' ').trim();if(t.length<=maxChars&&ctx.measureText(t).width<=maxWidth)return t;let out=t.slice(0,maxChars);while(out.length&&ctx.measureText(out+'…').width>maxWidth)out=out.slice(0,-1);return out+'…'}

function createScreenSources(){
  const qqq=makeCanvasTexture(960,420),spy=makeCanvasTexture(960,420),iwm=makeCanvasTexture(960,420),main=makeCanvasTexture(1280,760),signal=makeCanvasTexture(620,900),pnl=makeCanvasTexture(620,390),leaders=makeCanvasTexture(620,720),telemetry=makeCanvasTexture(1200,160),status=makeCanvasTexture(700,230);
  const ticker={QQQ:{...qqq,accent:'#35ffa7',chart:$('#qqqChart'),price:$('#qqqPrice')},SPY:{...spy,accent:'#ff315f',chart:$('#spyChart'),price:$('#spyPrice')},IWM:{...iwm,accent:'#27d7ff',chart:$('#iwmChart'),price:$('#iwmPrice')}};
  const drawTicker=(symbol,o)=>{const {ctx,canvas,texture,accent,chart,price}=o,w=canvas.width,h=canvas.height;panelBase(ctx,w,h,accent);text(ctx,symbol,48,56,44,'#f4efff',900);text(ctx,price?.textContent||'—',w-46,56,33,accent,800,'right');ctx.save();ctx.shadowColor=accent;ctx.shadowBlur=17;ctx.globalAlpha=.98;if(chart)ctx.drawImage(chart,32,100,w-64,h-126);ctx.restore();text(ctx,'REPLAY NODE / 1m',48,h-24,17,'#766f88',700);texture.needsUpdate=true};
  const drawMain=()=>{const {ctx,canvas,texture}=main,w=canvas.width,h=canvas.height;panelBase(ctx,w,h,'#6f37ff');text(ctx,`${$('#mainSymbol')?.textContent||'SPY'}  /  1m REPLAY`,42,39,25,'#f2edff',800);text(ctx,$('#generationLabel')?.textContent||'GEN 0',w-38,39,19,'#928aa7',700,'right');ctx.save();ctx.globalAlpha=.99;ctx.drawImage($('#mainChart'),26,72,w-52,h-118);ctx.restore();text(ctx,'— VWAP',42,h-24,17,'#ffd35a',800);text(ctx,'— EMA 9',160,h-24,17,'#27d7ff',800);text(ctx,$('#tradeState')?.textContent||'WAITING',w-40,h-24,17,'#35ffa7',800,'right');texture.needsUpdate=true};
  const drawSignal=()=>{const {ctx,canvas,texture}=signal,w=canvas.width,h=canvas.height;panelBase(ctx,w,h,'#ffd35a');text(ctx,'SIGNAL SCANNER',36,46,31,'#ffd35a',900);text(ctx,'LIVE RESEARCH THOUGHTS',36,83,14,'#8b829b',700);const rows=Array.from($('#signalLog')?.children||[]).slice(0,12);let y=130;ctx.font='700 19px ui-monospace,monospace';if(!rows.length)text(ctx,'No signal traffic yet',36,y,18,'#777084',650);for(const r of rows){const color=r.classList.contains('good')?'#35ffa7':r.classList.contains('bad')?'#ff315f':'#c7bed9';text(ctx,fitLine(ctx,r.textContent,w-72,48),36,y,18,color,650);y+=54}text(ctx,'CHAN / 01',w-30,h-26,14,'#60586d',700,'right');texture.needsUpdate=true};
  const drawPnl=()=>{const {ctx,canvas,texture}=pnl,w=canvas.width,h=canvas.height;panelBase(ctx,w,h,'#27d7ff');text(ctx,'RESEARCH LAB',34,44,27,'#27d7ff',900);text(ctx,'CANDIDATE SUM / NOT ACCOUNT PNL',34,83,14,'#7d768d',700);text(ctx,$('#sessionPnl')?.textContent||'+£0',w/2,180,74,'#35ffa7',900,'center');text(ctx,`${$('#tradeCount')?.textContent||'0 trades'}  ·  ${$('#winRate')?.textContent||'0% win'}`,w/2,253,19,'#c2bacc',700,'center');text(ctx,`BEST ${$('#bestScore')?.textContent||'—'}   /   SURVIVORS ${$('#survivorCount')?.textContent||'0'}`,w/2,309,16,'#90869f',700,'center');texture.needsUpdate=true};
  const drawLeaders=()=>{const {ctx,canvas,texture}=leaders,w=canvas.width,h=canvas.height;panelBase(ctx,w,h,'#ffd35a');text(ctx,'♛  CHALLENGERS',34,44,29,'#ffd35a',900);text(ctx,'RANK     STRATEGY                              SCORE',34,91,14,'#80788d',700);ctx.strokeStyle='rgba(255,211,90,.24)';ctx.beginPath();ctx.moveTo(34,112);ctx.lineTo(w-34,112);ctx.stroke();const rows=Array.from($('#leaderRows')?.children||[]).slice(0,6);let y=160;if(!rows.length)text(ctx,'—   No challengers yet',34,y,19,'#a69caf',650);rows.forEach((r,i)=>{const cols=Array.from(r.children).map(x=>x.textContent.trim());text(ctx,cols[0]||String(i+1),40,y,21,i===0?'#ffd35a':'#aca4b9',800);text(ctx,(cols[1]||'').slice(0,30),94,y,18,'#e4ddef',650);text(ctx,cols[2]||'—',w-38,y,19,'#35ffa7',800,'right');y+=72});texture.needsUpdate=true};
  const drawTelemetry=()=>{const {ctx,canvas,texture}=telemetry,w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(5,5,15,0)');g.addColorStop(.08,'rgba(5,5,15,.96)');g.addColorStop(.92,'rgba(5,5,15,.96)');g.addColorStop(1,'rgba(5,5,15,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);const cells=[['SESSION',$('#runtime')?.textContent],['EXPERIMENTS',$('#experimentCount')?.textContent],['SURVIVORS',$('#survivorCount')?.textContent],['BEST SCORE',$('#bestScore')?.textContent],['WORKERS',$('#workerCount')?.textContent]];cells.forEach(([a,b],i)=>{const x=(i+.5)*w/cells.length;text(ctx,a,x,47,13,'#746c83',700,'center');text(ctx,b||'—',x,91,22,'#d0c7dc',800,'center')});texture.needsUpdate=true};
  const drawStatus=()=>{const {ctx,canvas,texture}=status,w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);roundedRect(ctx,8,8,w-16,h-16,28);ctx.fillStyle='rgba(3,5,13,.96)';ctx.fill();ctx.strokeStyle='rgba(53,255,167,.72)';ctx.lineWidth=6;ctx.stroke();const live=$('#marketPill')?.classList.contains('live');text(ctx,'●',56,78,36,live?'#35ffa7':'#655e78',900);text(ctx,live?'RESEARCH ACTIVE':'RESEARCH IDLE',95,78,38,live?'#d9ffed':'#9b94aa',900);text(ctx,live?'AUTONOMOUS LAB ONLINE':'TRAINING BAY STANDBY',w/2,151,24,'#928aa7',800,'center');texture.needsUpdate=true};
  let last=0;const update=(now,force=false)=>{if(!force&&now-last<120)return;last=now;Object.entries(ticker).forEach(([s,o])=>drawTicker(s,o));drawMain();drawSignal();drawPnl();drawLeaders();drawTelemetry();drawStatus()};
  update(performance.now(),true);return{ticker,main,signal,pnl,leaders,telemetry,status,update};
}

function glowTexture(){const {canvas,ctx,texture}=makeCanvasTexture(256,256);const g=ctx.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,255,255,.88)');g.addColorStop(.16,'rgba(255,255,255,.34)');g.addColorStop(.5,'rgba(255,255,255,.07)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);texture.needsUpdate=true;return texture}
const glowMap=glowTexture();
function addGlow(parent,color,x,y,z,sx,sy=sx,opacity=.18,rotationX=0){const mat=new THREE.SpriteMaterial({map:glowMap,color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});const sp=new THREE.Sprite(mat);sp.position.set(x,y,z);sp.scale.set(sx,sy,1);sp.material.rotation=rotationX;parent.add(sp);return sp}
function makeLabelTexture(lines,accent='#ffffff',w=512,h=220){const p=makeCanvasTexture(w,h),ctx=p.ctx;ctx.clearRect(0,0,w,h);roundedRect(ctx,4,4,w-8,h-8,22);ctx.fillStyle='rgba(4,4,13,.98)';ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=5;ctx.stroke();const grad=ctx.createLinearGradient(0,0,w,0);grad.addColorStop(0,'rgba(255,255,255,.02)');grad.addColorStop(.5,accent+'1d');grad.addColorStop(1,'rgba(255,255,255,.02)');ctx.fillStyle=grad;roundedRect(ctx,12,12,w-24,h-24,16);ctx.fill();text(ctx,lines[0],w/2,h*.41,56,accent,900,'center');if(lines[1])text(ctx,lines[1],w/2,h*.72,24,'#9d95ae',800,'center');p.texture.needsUpdate=true;return p.texture}
function makeBrandTexture(){const p=makeCanvasTexture(1600,330),ctx=p.ctx,w=p.canvas.width,h=p.canvas.height;ctx.clearRect(0,0,w,h);const g=ctx.createLinearGradient(190,0,1270,0);g.addColorStop(0,'#f1eaff');g.addColorStop(.5,'#ffffff');g.addColorStop(.72,'#ff2dce');g.addColorStop(1,'#a54dff');ctx.shadowBlur=38;ctx.shadowColor='#6f37ff';ctx.font='900 146px Arial Narrow, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=g;ctx.fillText('SCALP CITY',w/2,h*.43);ctx.shadowColor='#ff2dce';ctx.shadowBlur=18;text(ctx,'♛',w/2,44,54,'#ffd35a',900,'center','Arial');ctx.shadowBlur=0;text(ctx,'TRADE  ·  TEST  ·  VALIDATE  ·  REPEAT',w/2,h*.82,28,'#d5cbe9',700,'center');p.texture.needsUpdate=true;return p.texture}

function cylinderBetween(a,b,r,mat,segments=12){const v=new THREE.Vector3().subVectors(b,a),len=v.length(),mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,segments),mat);m.position.copy(mid);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());m.castShadow=true;m.receiveShadow=true;return m}

function buildMonitor({w,h,texture,accent,x,y,z,ry=0,rx=0,rz=0,action=null,interactiveMeshes,arm='ceiling'}){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.set(rx,ry,rz);
  const caseMat=darkMat(0x060710,.88,.19),edgeMat=neonMat(accent,2.0);
  const back=makeBox(w+.16,h+.16,.28,caseMat,0,0,-.02);g.add(back);
  const rail=.042,d=.30;g.add(makeBox(w+.2,rail,d,edgeMat,0,h/2+.075,.01));g.add(makeBox(w+.2,rail,d,edgeMat,0,-h/2-.075,.01));g.add(makeBox(rail,h+.08,d,edgeMat,-w/2-.075,0,.01));g.add(makeBox(rail,h+.08,d,edgeMat,w/2+.075,0,.01));
  const screenMat=new THREE.MeshStandardMaterial({map:texture,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.72,roughness:.46,metalness:.08,toneMapped:false});
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(w-.10,h-.10),screenMat);screen.position.z=.136;screen.userData.action=action;g.add(screen);if(action)interactiveMeshes.push(screen);
  const glow=addGlow(g,accent,0,0,-.09,w*1.36,h*1.45,.09);
  const armMat=darkMat(0x0d0e18,.84,.27);
  if(arm==='ceiling'){const stem=makeBox(.09,.72,.09,armMat,0,h/2+.48,-.24);g.add(stem);g.add(makeBox(.46,.08,.34,armMat,0,h/2+.84,-.24));}
  if(arm==='wall'){g.add(makeBox(.75,.09,.09,armMat,0,h/2+.26,-.26));g.add(makeBox(.08,.55,.08,armMat,0,h/2+.54,-.26));}
  return{group:g,screen,accentMaterials:[edgeMat],glow};
}

function makeRobot(){
  const g=new THREE.Group(),white=new THREE.MeshStandardMaterial({color:0xdddde8,metalness:.76,roughness:.18}),white2=new THREE.MeshStandardMaterial({color:0xbec1cf,metalness:.8,roughness:.22}),dark=darkMat(0x101019,.86,.19),gold=neonMat(C.gold,2.7),violet=neonMat(C.violet,2.5),pink=neonMat(C.magenta,3.0);
  const chair=new THREE.Group();chair.add(makeBox(1.36,1.58,.28,dark,0,1.18,.66));chair.add(makeBox(1.32,.20,1.06,dark,0,.57,.20));chair.add(makeBox(.16,.74,.16,dark,0,.25,.37));chair.add(cyl(.58,.66,.13,dark,0,.08,.37,28));for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const leg=makeBox(.08,.08,.70,dark,Math.cos(a)*.29,.08,.37+Math.sin(a)*.29);leg.rotation.y=-a;chair.add(leg)}g.add(chair);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.46,.76,8,20),dark);torso.scale.set(1.15,1,1);torso.position.set(0,1.48,.02);torso.castShadow=true;g.add(torso);
  const backPlate=makeBox(.78,.86,.085,white2,0,1.48,.45);backPlate.rotation.x=-.04;g.add(backPlate);g.add(makeBox(.075,.68,.035,gold,0,1.48,.50));g.add(makeBox(1.1,.17,.24,white2,0,1.91,.06));
  const neck=cyl(.18,.21,.26,dark,0,2.08,0,16);g.add(neck);const head=new THREE.Mesh(new THREE.SphereGeometry(.45,28,20),white);head.scale.set(1.13,.88,1);head.position.set(0,2.43,-.03);head.castShadow=true;g.add(head);g.add(makeBox(.52,.22,.055,dark,0,2.43,.40));g.add(makeBox(.31,.036,.025,violet,0,2.43,.435));const visor=makeBox(.70,.23,.06,violet,0,2.43,-.415);g.add(visor);
  const earGeo=new THREE.TorusGeometry(.125,.038,10,28);for(const sx of [-.51,.51]){const e=new THREE.Mesh(earGeo,gold);e.position.set(sx,2.41,-.02);e.rotation.y=Math.PI/2;g.add(e)}g.add(cyl(.012,.012,.30,white2,0,2.88,-.03,8));const tip=new THREE.Mesh(new THREE.SphereGeometry(.05,12,10),pink);tip.position.set(0,3.06,-.03);g.add(tip);
  const jointMat=darkMat(0x181723,.8,.22),shoulders=[[-.59,1.86,-.02],[.59,1.86,-.02]],elbows=[[-.86,1.40,-.62],[.88,1.42,-.63]],hands=[[-.69,1.16,-1.18],[.73,1.17,-1.18]];
  for(let i=0;i<2;i++){const s=new THREE.Vector3(...shoulders[i]),e=new THREE.Vector3(...elbows[i]),h=new THREE.Vector3(...hands[i]);const sj=new THREE.Mesh(new THREE.SphereGeometry(.165,16,12),jointMat);sj.position.copy(s);g.add(sj);g.add(cylinderBetween(s,e,.135,white2));const ej=new THREE.Mesh(new THREE.SphereGeometry(.145,16,12),jointMat);ej.position.copy(e);g.add(ej);g.add(cylinderBetween(e,h,.118,white));const palm=new THREE.Mesh(new THREE.SphereGeometry(.13,14,10),white);palm.scale.set(1.16,.62,1);palm.position.copy(h);g.add(palm)}
  g.userData.head=head;g.userData.leftHand=g.children[g.children.length-2];return g;
}

function addFloor(scene){
  const floorMat=new THREE.MeshPhysicalMaterial({color:0x020308,metalness:.92,roughness:.16,clearcoat:1,clearcoatRoughness:.08});const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,58),floorMat);floor.rotation.x=-Math.PI/2;floor.position.set(0,0,-10);floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(46,64,0x7037c0,0x211331);grid.position.set(0,.014,-9);grid.material.opacity=.28;grid.material.transparent=true;scene.add(grid);
  const runway=neonMat(C.violet,.52);for(const x of [-4.15,4.15])scene.add(makeBox(.018,.018,34,runway,x,.023,-7.5));
  // two low glass platforms make the desk/robot cast against something physical
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(2.25,2.25,.06,64),new THREE.MeshPhysicalMaterial({color:0x120b28,transparent:true,opacity:.55,metalness:.7,roughness:.12,clearcoat:1}));platform.position.set(-1.05,.04,3.35);platform.receiveShadow=true;scene.add(platform);
  return floor;
}

function addCity(scene){
  const city=new THREE.Group(),buildingMat=darkMat(0x080917,.6,.48),winLists={gold:[],cyan:[],pink:[]};
  for(let i=0;i<58;i++){const w=.68+rand()*1.55,d=.7+rand()*1.25,h=1.8+rand()*7.4,x=(rand()-.5)*22,z=-5-rand()*25;const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),buildingMat.clone());b.material.color.offsetHSL(0,0,rand()*.018);b.position.set(x,h/2,z);b.receiveShadow=true;city.add(b);const rows=Math.max(2,Math.min(13,Math.floor(h/.52))),cols=Math.max(1,Math.floor(w/.29));for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(rand()>.42){const key=rand()>.83?'cyan':(rand()>.88?'pink':'gold');winLists[key].push({x:x-w/2+.18+c*.28,y:.34+r*.52,z:z+d/2+.012})}}
  function instWindows(list,color){if(!list.length)return;const geo=new THREE.BoxGeometry(.04,.072,.012),mat=neonMat(color,1.7),mesh=new THREE.InstancedMesh(geo,mat,list.length),m=new THREE.Matrix4();list.forEach((p,i)=>{m.makeTranslation(p.x,p.y,p.z);mesh.setMatrixAt(i,m)});mesh.instanceMatrix.needsUpdate=true;city.add(mesh)}
  instWindows(winLists.gold,C.gold);instWindows(winLists.cyan,C.cyan);instWindows(winLists.pink,C.magenta);scene.add(city);return city;
}

function addRoom(scene){
  const g=new THREE.Group(),steel=darkMat(0x0b0b15,.86,.26),wall=darkMat(0x050510,.58,.55),violet=neonMat(C.violet,.72),pink=neonMat(C.magenta,.66),cyan=neonMat(C.cyan,.62);
  // side walls frame a genuine room while leaving the skyline visible through the central glass wall
  g.add(makeBox(1.15,8.4,7.2,wall,-5.15,4.1,-.2));g.add(makeBox(1.15,8.4,7.2,wall,5.15,4.1,-.2));
  g.add(makeBox(10.9,.28,7.2,wall,0,8.15,-.2));
  // ceiling ribs
  for(const z of [-2.5,-.7,1.1,2.9]){g.add(makeBox(10.0,.18,.22,steel,0,7.85,z));g.add(makeBox(9.4,.025,.06,z<0?violet:(z<2?pink:cyan),0,7.73,z+.08))}
  // huge window frame behind the monitors
  g.add(makeBox(10.0,.22,.20,steel,0,7.1,-3.05));g.add(makeBox(10.0,.22,.20,steel,0,.55,-3.05));for(const x of [-4.9,-2.45,0,2.45,4.9])g.add(makeBox(.16,6.7,.20,steel,x,3.82,-3.05));
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(9.65,6.35),glassMat(.08,0x6c51ff));glass.position.set(0,3.83,-3.13);g.add(glass);
  // close foreground pillars create occlusion/parallax on camera movement
  for(const x of [-5.0,5.0]){g.add(makeBox(.34,7.5,.38,steel,x,3.75,2.65));g.add(makeBox(.035,6.9,.40,x<0?pink:cyan,x+(x<0?.20:-.20),3.7,2.63))}
  scene.add(g);return g;
}

function addRings(scene,x=-1.05,z=3.38){const g=new THREE.Group();g.position.set(x,.09,z);g.rotation.x=Math.PI/2;[[.96,C.magenta],[1.34,C.violet],[1.76,C.gold]].forEach(([r,c],i)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,.018,8,100),neonMat(c,2.9-i*.3));m.userData.speed=(i%2?-1:1)*(.07+i*.018);g.add(m)});scene.add(g);const lp=new THREE.PointLight(C.magenta,22,5,2);lp.position.set(x,.25,z);scene.add(lp);return g}

function addDesk(scene,interactiveMeshes,controlMeshes){
  const g=new THREE.Group(),top=darkMat(0x090810,.9,.14),gold=neonMat(C.gold,1.9),purple=neonMat(C.violet,.75),steel=darkMat(0x0d0c16,.87,.22);
  // broad U-shaped workstation, each wing visibly angled in depth
  const center=makeBox(3.9,.22,1.34,top,.25,1.07,1.32);center.rotation.y=.015;g.add(center);const left=makeBox(2.25,.22,1.34,top,-2.72,1.10,1.66);left.rotation.y=-.18;g.add(left);const right=makeBox(2.35,.22,1.34,top,3.06,1.10,1.66);right.rotation.y=.18;g.add(right);
  for(const [slab,wide] of [[center,3.9],[left,2.25],[right,2.35]]){const rail=makeBox(wide+.02,.052,.055,gold,slab.position.x,.99,slab.position.z+.67);rail.rotation.y=slab.rotation.y;g.add(rail)}
  for(const x of [-3.4,-1.1,1.7,3.75]){const leg=makeBox(.24,.95,.42,steel,x,.53,1.72);leg.rotation.z=(x<0?-1:1)*.015;g.add(leg)}
  const pad=makeBox(2.95,.036,.82,new THREE.MeshStandardMaterial({color:0x100b27,emissive:C.violet,emissiveIntensity:.38,metalness:.52,roughness:.26}),.82,1.21,1.34);pad.rotation.x=-.025;g.add(pad);
  // keyboard rows make the desk feel like hardware, not a flat nav bar
  const keyMat=neonMat(C.cyan,.72),keyDark=darkMat(0x11101a,.65,.3);for(let r=0;r<3;r++)for(let i=0;i<8;i++){const k=makeBox(.16,.03,.11,(i+r)%4===0?keyMat:keyDark,-.55+i*.20,1.27,1.02+r*.14);g.add(k)}
  const defs=[['RUN','TRAIN','#35ffa7','enterBtn',-.72],['DATA','FEED','#27d7ff','dataBtn',-.08],['MEM','GITHUB','#a77cff','githubBtn',.56],['EXIT','SAVE','#ffd35a','exitBtn',1.20]];
  defs.forEach(([a,b,col,id,x])=>{const grp=new THREE.Group();grp.position.set(x,1.30,1.67);grp.rotation.x=-.07;const base=makeBox(.54,.115,.50,darkMat(0x080711,.8,.24),0,0,0);grp.add(base);const faceTex=makeLabelTexture([a,b],col,420,240);const faceMat=new THREE.MeshBasicMaterial({map:faceTex,toneMapped:false});const face=new THREE.Mesh(new THREE.PlaneGeometry(.47,.40),faceMat);face.rotation.x=-Math.PI/2;face.position.set(0,.062,-.01);face.userData.action={type:'dom',id};grp.add(face);interactiveMeshes.push(face);g.add(grp);controlMeshes.set(id,{group:grp,faceMat,accent:col})});
  [['syncPulse','#35ffa7',1.72],['emergencyStop','#ff315f',2.18]].forEach(([id,col,x])=>{const grp=new THREE.Group();grp.position.set(x,1.30,1.67);const rim=cyl(.23,.25,.12,darkMat(0x090812,.85,.2),0,0,0,28);grp.add(rim);const cap=cyl(.14,.14,.13,neonMat(parseInt(col.slice(1),16),2.8),0,.075,0,28);cap.userData.action={type:'dom',id};grp.add(cap);interactiveMeshes.push(cap);g.add(grp);controlMeshes.set(id,{group:grp,faceMat:cap.material,accent:col})});
  // physical props from the visual reference
  const books=new THREE.Group();['DISCIPLINE','BACKTEST','EXECUTE','IMPROVE'].forEach((_,i)=>{const b=makeBox(.9,.12,.45,darkMat(0x151020,.55,.45),-3.15,1.30+i*.13,1.32);b.rotation.y=-.18;books.add(b)});g.add(books);
  const mug=cyl(.18,.18,.34,new THREE.MeshStandardMaterial({color:0xdad8df,metalness:.08,roughness:.38}),2.84,1.31,1.25,28);g.add(mug);const mugMark=makeBox(.06,.15,.01,neonMat(C.gold,1.8),2.84,1.36,1.071);g.add(mugMark);
  scene.add(g);return g;
}

function addBull(scene){const g=new THREE.Group(),gold=new THREE.MeshStandardMaterial({color:0xc88618,emissive:0x4a2400,emissiveIntensity:.35,metalness:1,roughness:.15});const body=new THREE.Mesh(new THREE.SphereGeometry(.42,24,16),gold);body.scale.set(1.6,.75,.8);g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.26,20,14),gold);head.position.set(.56,.10,-.04);head.scale.set(1,.82,.85);g.add(head);for(const sy of [-1,1]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.07,.55,14),gold);horn.position.set(.72,.30,sy*.18);horn.rotation.z=-1.0;horn.rotation.x=sy*.40;g.add(horn)}for(const sx of [-.4,.28])for(const sz of [-.16,.16])g.add(makeBox(.08,.38,.08,gold,sx,-.31,sz));g.position.set(4.15,.42,3.88);g.rotation.y=-2.45;g.scale.set(.9,.9,.9);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(g);return g}

function addMonitorBank(scene,sources,interactiveMeshes){
  const root=new THREE.Group(),monitors={};
  const specs=[
    ['QQQ',2.05,1.12,sources.ticker.QQQ.texture,C.green,-2.45,6.00,-1.95,.15,-.045,-.018,{type:'ticker',symbol:'QQQ'},'ceiling'],
    ['SPY',2.10,1.16,sources.ticker.SPY.texture,C.red,.08,6.08,-1.82,0,-.05,0,{type:'ticker',symbol:'SPY'},'ceiling'],
    ['IWM',2.05,1.12,sources.ticker.IWM.texture,C.cyan,2.62,6.00,-1.95,-.15,-.045,.018,{type:'ticker',symbol:'IWM'},'ceiling'],
    ['SIGNAL',1.45,2.18,sources.signal.texture,C.gold,-3.38,3.69,-1.63,.27,-.025,-.018,null,'wall'],
    ['CORE',4.18,2.55,sources.main.texture,C.violet,.18,3.72,-1.52,0,-.034,0,null,'wall'],
    ['PNL',1.48,.98,sources.pnl.texture,C.cyan,3.72,4.33,-1.65,-.26,-.02,.012,null,'wall'],
    ['LEADERS',1.48,1.28,sources.leaders.texture,C.gold,3.72,3.08,-1.65,-.26,-.02,.012,null,'wall']
  ];
  for(const [name,w,h,tex,accent,x,y,z,ry,rx,rz,action,arm] of specs){const m=buildMonitor({w,h,texture:tex,accent,x,y,z,ry,rx,rz,action,interactiveMeshes,arm});root.add(m.group);monitors[name]=m}
  const steel=darkMat(0x0b0b14,.85,.25);root.add(makeBox(8.2,.12,.14,steel,.12,6.83,-2.22));for(const x of [-2.45,.08,2.62,-3.38,3.72])root.add(makeBox(.06,1.1,.06,steel,x,6.45,-2.2));scene.add(root);
  // the screens really light the room
  [[C.violet,0,3.75,-.42,38,9],[C.magenta,-3.2,4.45,-.3,23,7],[C.cyan,3.35,4.35,-.25,23,7],[C.green,-2.3,5.9,-.5,12,4]].forEach(([color,x,y,z,intensity,dist])=>{const p=new THREE.PointLight(color,intensity,dist,2);p.position.set(x,y,z);scene.add(p)});
  return monitors;
}

function addBrand(scene){const tex=makeBrandTexture();const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthWrite:false});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(6.0,1.24),mat);mesh.position.set(.05,7.13,-2.40);scene.add(mesh);addGlow(scene,C.violet,.05,7.10,-2.7,7.0,1.7,.12);return mesh}
function addStatusSign(scene,sources){const m=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.72),new THREE.MeshBasicMaterial({map:sources.status.texture,toneMapped:false}));m.position.set(3.68,6.98,-1.66);m.rotation.y=-.24;scene.add(m);return m}
function addTelemetry(scene,sources){const mat=new THREE.MeshBasicMaterial({map:sources.telemetry.texture,transparent:true,toneMapped:false});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.5,.74),mat);mesh.position.set(.28,.58,2.96);mesh.rotation.x=-1.08;scene.add(mesh);return mesh}

export function initScene3D(canvas){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!canvas)throw new Error('Missing #cityCanvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});const mobile=matchMedia('(max-width: 700px)').matches;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.22:1.65));renderer.setSize(innerWidth,innerHeight,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(C.ink);scene.fog=new THREE.FogExp2(0x080313,.024);
  // closer/lower camera makes the robot, desk and monitor bank share one believable room.
  const camera=new THREE.PerspectiveCamera(mobile?54:46,innerWidth/innerHeight,.1,85);const basePos=new THREE.Vector3(mobile?.55:.75,mobile?3.52:3.66,mobile?9.65:9.1),baseTarget=new THREE.Vector3(.05,3.62,-1.28);camera.position.copy(basePos);camera.lookAt(baseTarget);
  const hemi=new THREE.HemisphereLight(0x7455ff,0x11030f,1.35);scene.add(hemi);const key=new THREE.DirectionalLight(0xe5dfff,2.55);key.position.set(-4,8,6);key.castShadow=true;key.shadow.mapSize.set(mobile?768:1024,mobile?768:1024);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=9;key.shadow.camera.bottom=-2;scene.add(key);const rim=new THREE.DirectionalLight(0x8f4dff,1.25);rim.position.set(5,4,-4);scene.add(rim);
  const magentaLight=new THREE.PointLight(C.magenta,35,14,2);magentaLight.position.set(-4.35,3.4,3.2);scene.add(magentaLight);const cyanLight=new THREE.PointLight(C.cyan,31,14,2);cyanLight.position.set(4.45,3.1,2.7);scene.add(cyanLight);const goldLight=new THREE.PointLight(C.gold,26,9,2);goldLight.position.set(.3,1.35,2.25);scene.add(goldLight);

  addFloor(scene);const city=addCity(scene);addRoom(scene);const sources=createScreenSources(),interactiveMeshes=[],controlMeshes=new Map();const monitors=addMonitorBank(scene,sources,interactiveMeshes);addBrand(scene);addStatusSign(scene,sources);const desk=addDesk(scene,interactiveMeshes,controlMeshes);addTelemetry(scene,sources);const rings=addRings(scene);const robot=makeRobot();robot.position.set(-1.05,.03,3.48);robot.rotation.y=.02;scene.add(robot);addBull(scene);
  addGlow(scene,C.magenta,-1.05,.32,3.48,4.3,2.0,.12);addGlow(scene,C.violet,.2,3.5,-.9,8.2,6.0,.06);addGlow(scene,C.cyan,3.45,1.15,2.25,3.3,2.3,.065);

  let running=false,selected='SPY',raf=0,last=performance.now(),yaw=0,pitch=0,dragging=false,lastX=0,lastY=0,moved=0,hoverKey='',destroyed=false;const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function updatePointer(e){const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1}
  function hitAction(e){updatePointer(e);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(interactiveMeshes,false).find(h=>h.object.userData.action);return hit?.object.userData.action||null}
  function trigger(action){if(!action)return;document.getElementById('interactionHint')?.classList.add('used');if(action.type==='ticker'){document.querySelector(`.ticker-monitor[data-symbol="${action.symbol}"]`)?.click();return}if(action.type==='dom'){const b=document.getElementById(action.id);if(b&&!b.disabled)b.click()}}
  const onPointerDown=e=>{if(e.button!==undefined&&e.button!==0)return;dragging=true;lastX=e.clientX;lastY=e.clientY;moved=0;canvas.setPointerCapture?.(e.pointerId)};
  const onPointerMove=e=>{if(dragging){const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);yaw=clamp(yaw-dx*.0025,-.31,.31);pitch=clamp(pitch-dy*.00175,-.12,.12);if(moved>10)document.getElementById('interactionHint')?.classList.add('used')}else if(matchMedia('(hover:hover) and (pointer:fine)').matches){const a=hitAction(e),key=a?JSON.stringify(a):'';if(key!==hoverKey){hoverKey=key;canvas.style.cursor=a?'pointer':'grab'}}};
  const onPointerUp=e=>{if(!dragging)return;dragging=false;canvas.releasePointerCapture?.(e.pointerId);if(moved<9)trigger(hitAction(e))};
  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove,{passive:true});canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',()=>{dragging=false});

  function updateControlVisuals(){for(const [id,o] of controlMeshes){const btn=document.getElementById(id),disabled=!!btn?.disabled,parsed=parseInt(o.accent.slice(1),16);if(o.faceMat.emissive){o.faceMat.color.set(disabled?0x34303c:parsed);o.faceMat.emissive.set(disabled?0x000000:parsed);o.faceMat.emissiveIntensity=disabled?.08:(running&&id==='enterBtn'?4:2.6);o.faceMat.opacity=disabled?.46:1;o.faceMat.transparent=disabled}else{o.faceMat.opacity=disabled?.44:1;o.faceMat.transparent=disabled}o.group.position.y=disabled?1.285:1.30}selected=$('#mainSymbol')?.textContent||'SPY';for(const s of ['QQQ','SPY','IWM']){const m=monitors[s];if(!m)continue;const active=s===selected;m.accentMaterials.forEach(mat=>mat.emissiveIntensity=active?3.5:1.9);m.glow.material.opacity=active?.17:.075}}
  function onResize(){const isMob=innerWidth<=700;camera.aspect=innerWidth/innerHeight;camera.fov=isMob?54:46;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,isMob?1.22:1.65));renderer.setSize(innerWidth,innerHeight,false)}addEventListener('resize',onResize,{passive:true});
  let statTick=0;function animate(now){if(destroyed)return;raf=requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;sources.update(now);if(now-statTick>180){updateControlVisuals();statTick=now}if(!reduced){rings.children.forEach(r=>r.rotation.z+=r.userData.speed*dt);robot.userData.head.rotation.y=Math.sin(now*.00052)*.06;robot.position.y=.03+Math.sin(now*.0011)*.012;const autoX=Math.sin(now*.00017)*(running?.16:.075),autoY=Math.sin(now*.00013)*.035;const desired=basePos.clone();desired.x+=yaw*4.55+autoX;desired.y+=pitch*3.3+autoY;desired.z+=Math.abs(yaw)*.38;camera.position.lerp(desired,.038);const target=baseTarget.clone();target.x+=yaw*2.15;target.y+=pitch*1.35;camera.lookAt(target);city.rotation.y=Math.sin(now*.00005)*.002;desk.position.y=Math.sin(now*.00052)*.002}const pulse=running?1+.06*Math.sin(now*.006):1+.02*Math.sin(now*.002);magentaLight.intensity=35*pulse;cyanLight.intensity=31*(1+.04*Math.sin(now*.005+1));renderer.render(scene,camera)}animate(performance.now());
  return{setRunning(v){running=!!v},setSymbol(s){selected=s},refresh(){sources.update(performance.now(),true)},destroy(){destroyed=true;cancelAnimationFrame(raf);removeEventListener('resize',onResize);canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);renderer.dispose()}};
}
