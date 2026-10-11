const $ = s => document.querySelector(s);
const state = {
  running:false, startedAt:null, timer:null, workers:[], workerCount:0,
  experiments:0, survivors:0, sessionPnl:0, trades:0, wins:0,
  generation:0, best:null, leaderboard:[], log:[], data:{}, knowledge:{},
  github:{owner:"",repo:"",branch:"main",path:"knowledge-lab",token:""},
  sessionId:null, importedSymbols:new Set()
};

const DB_NAME = "scalp-city-lab-v1";
const DB_VERSION = 1;
let dbPromise = null;
let sceneCtl = null;

function openDb(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{ const db=req.result;
      if(!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions",{keyPath:"id"});
      if(!db.objectStoreNames.contains("meta")) db.createObjectStore("meta",{keyPath:"key"});
    };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function idbPut(store,value){const db=await openDb();return new Promise((res,rej)=>{const tx=db.transaction(store,"readwrite");tx.objectStore(store).put(value);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function idbGet(store,key){const db=await openDb();return new Promise((res,rej)=>{const tx=db.transaction(store,"readonly");const r=tx.objectStore(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}

function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function generateSynthetic(symbol, n=2200){
  const seed={SPY:1337,QQQ:7331,IWM:31337}[symbol]||42, rnd=mulberry32(seed);
  let p={SPY:560,QQQ:470,IWM:220}[symbol]||100, out=[], t=Date.now()-n*60000;
  for(let i=0;i<n;i++){
    const cyc=Math.sin(i/83)*0.00055+Math.sin(i/317)*0.0008;
    const regime=(i%700<250?0.00018:i%700<470?-0.00010:0.00004);
    const noise=(rnd()-.5)*0.0048;
    const o=p, c=Math.max(1,p*(1+cyc+regime+noise));
    const h=Math.max(o,c)*(1+rnd()*0.0018), l=Math.min(o,c)*(1-rnd()*0.0018);
    const v=Math.floor(600000+rnd()*1400000+(Math.abs(c-o)/o)*8e7);
    out.push({time:t+i*60000,open:o,high:h,low:l,close:c,volume:v}); p=c;
  }
  return out;
}
function ensureData(){for(const s of ["QQQ","SPY","IWM"]) if(!state.data[s]) state.data[s]=generateSynthetic(s)}

function drawSpark(canvas,data,color){
  if(!canvas||!data?.length)return;const c=canvas.getContext("2d"),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);
  const seg=data.slice(-80), mn=Math.min(...seg.map(x=>x.close)), mx=Math.max(...seg.map(x=>x.close)), pad=10;
  c.strokeStyle="rgba(255,255,255,.06)";c.lineWidth=1;
  for(let i=1;i<4;i++){let y=h*i/4;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
  c.strokeStyle=color;c.lineWidth=4;c.shadowColor=color;c.shadowBlur=12;c.beginPath();
  seg.forEach((d,i)=>{const x=pad+i*(w-2*pad)/(seg.length-1);const y=h-pad-(d.close-mn)/(mx-mn||1)*(h-2*pad);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();c.shadowBlur=0;
}
function ema(values,period){const k=2/(period+1),out=[];let e=values[0];for(const v of values){e=v*k+e*(1-k);out.push(e)}return out}
function drawMain(symbol="SPY"){
  const canvas=$("#mainChart"),c=canvas.getContext("2d"),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);
  const arr=state.data[symbol].slice(-110), vals=arr.map(x=>x.close), em=ema(vals,9), mn=Math.min(...arr.map(x=>x.low)),mx=Math.max(...arr.map(x=>x.high));
  const x=i=>38+i*(w-65)/(arr.length-1), y=v=>h-35-(v-mn)/(mx-mn||1)*(h-65);
  c.strokeStyle="rgba(255,255,255,.06)";c.lineWidth=1;for(let i=0;i<6;i++){c.beginPath();c.moveTo(0,i*h/6);c.lineTo(w,i*h/6);c.stroke()}
  const typical=arr.map(d=>(d.high+d.low+d.close)/3);let pv=0,vv=0;const vw=typical.map((v,i)=>{pv+=v*arr[i].volume;vv+=arr[i].volume;return pv/vv});
  c.strokeStyle="#ffd34d";c.lineWidth=3;c.beginPath();vw.forEach((v,i)=>i?c.lineTo(x(i),y(v)):c.moveTo(x(i),y(v)));c.stroke();
  c.strokeStyle="#3ecbff";c.lineWidth=3;c.beginPath();em.forEach((v,i)=>i?c.lineTo(x(i),y(v)):c.moveTo(x(i),y(v)));c.stroke();
  const cw=Math.max(2,(w-70)/arr.length*.62);
  arr.forEach((d,i)=>{const up=d.close>=d.open,col=up?"#2dff9a":"#ff416d";c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1.2;c.beginPath();c.moveTo(x(i),y(d.high));c.lineTo(x(i),y(d.low));c.stroke();const yy=Math.min(y(d.open),y(d.close)),hh=Math.max(2,Math.abs(y(d.open)-y(d.close)));c.fillRect(x(i)-cw/2,yy,cw,hh)});
}
function redraw(){
  ensureData();drawSpark($("#qqqChart"),state.data.QQQ,"#2dff9a");drawSpark($("#spyChart"),state.data.SPY,"#ff416d");drawSpark($("#iwmChart"),state.data.IWM,"#3ecbff");
  for(const s of ["QQQ","SPY","IWM"]){const a=state.data[s],p=a[a.length-1].close;$("#"+s.toLowerCase()+"Price").textContent=p.toFixed(2)}
  drawMain($("#mainSymbol").textContent||"SPY");
  sceneCtl?.refresh?.();
}

async function city(){
  try{
    const mod=await import("./scene3d.js");
    sceneCtl=await mod.initScene3D($("#cityCanvas"));
  }catch(err){
    console.warn("3D scene unavailable; using lightweight fallback",err);
    cityFallback();
  }
}
function cityFallback(){
  document.documentElement.classList.add("scene-fallback");
  const cv=$("#cityCanvas"),c=cv.getContext("2d");let W,H,dpr,img=null;
  const paint=()=>{if(!W||!H)return;c.clearRect(0,0,W,H);if(img&&img.complete){const ir=img.width/img.height,vr=W/H;let sw,sh,sx,sy;if(ir>vr){sh=img.height;sw=sh*vr;sx=(img.width-sw)/2;sy=0}else{sw=img.width;sh=sw/vr;sx=0;sy=(img.height-sh)/2}c.drawImage(img,sx,sy,sw,sh,0,0,W,H);const veil=c.createLinearGradient(0,0,0,H);veil.addColorStop(0,"rgba(2,2,8,.04)");veil.addColorStop(.72,"rgba(2,2,8,.12)");veil.addColorStop(1,"rgba(2,2,8,.50)");c.fillStyle=veil;c.fillRect(0,0,W,H)}else{const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,"#18043d");g.addColorStop(.55,"#070413");g.addColorStop(1,"#020207");c.fillStyle=g;c.fillRect(0,0,W,H)}};
  const resize=()=>{dpr=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+"px";cv.style.height=H+"px";c.setTransform(dpr,0,0,dpr,0,0);paint()};
  img=new Image();img.onload=paint;img.src="./scalp-city-concept.png";addEventListener("resize",resize,{passive:true});resize();
  document.getElementById("interactionHint").textContent="3D ENGINE UNAVAILABLE · CONTROLS BELOW";
}
function log(msg,type="note"){
  state.log.unshift({t:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}),msg,type});state.log=state.log.slice(0,28);
  const frag=document.createDocumentFragment();for(const l of state.log){const row=document.createElement("div");row.className=`logline ${l.type}`;row.textContent=`${l.t} · ${l.msg}`;frag.appendChild(row)}$("#signalLog").replaceChildren(frag)
}
function renderLeaderboard(){
  const host=$("#leaderRows"),rows=state.leaderboard.slice().sort((a,b)=>b.score-a.score).slice(0,5),frag=document.createDocumentFragment();
  const add=(rank,label,score)=>{const row=document.createElement("div");row.className="leader-row";const a=document.createElement("span");a.className="rank";a.textContent=rank;const b=document.createElement("span");b.textContent=label;const c=document.createElement("span");c.className="score";c.textContent=score;row.append(a,b,c);frag.appendChild(row)};
  if(rows.length)rows.forEach((r,i)=>add(i?String(i+1):"♛",`${r.symbol}-${r.id.slice(-4)} · PF ${r.profitFactor.toFixed(2)}`,r.score.toFixed(1)));else add("—","No challengers yet","—");host.replaceChildren(frag)
}
function notify(message,tone="note"){
  const host=$("#toastViewport"),toast=document.createElement("div");toast.className=`toast ${tone}`;toast.textContent=message;host.replaceChildren(toast);setTimeout(()=>{if(toast.isConnected)toast.remove()},tone==="error"?6500:4200)
}
function renderStats(){
  $("#experimentCount").textContent=state.experiments.toLocaleString();$("#survivorCount").textContent=state.survivors.toLocaleString();$("#bestScore").textContent=state.best?state.best.score.toFixed(1):"—";
  $("#workerCount").textContent=state.workerCount;$("#sessionPnl").textContent="SIM "+(state.sessionPnl>=0?"+":"-")+Math.abs(state.sessionPnl).toFixed(0)+" pts";$("#sessionPnl").style.color=state.sessionPnl>=0?"var(--green)":"var(--red)";
  $("#tradeCount").textContent=`${state.trades} trades`;$("#winRate").textContent=`${state.trades?Math.round(state.wins/state.trades*100):0}% win`;$("#generationLabel").textContent=`GEN ${state.generation}`;
  renderLeaderboard()
}
function startTimer(){state.timer=setInterval(()=>{if(!state.startedAt)return;const sec=Math.floor((Date.now()-state.startedAt)/1000),h=String(Math.floor(sec/3600)).padStart(2,"0"),m=String(Math.floor(sec%3600/60)).padStart(2,"0"),s=String(sec%60).padStart(2,"0");$("#runtime").textContent=`${h}:${m}:${s}`},1000)}
function stopTimer(){clearInterval(state.timer);state.timer=null}

function startTraining(){
  if(state.running)return;ensureData();state.running=true;state.startedAt=Date.now();state.sessionId="session_"+new Date().toISOString().replace(/[:.]/g,"-");
  state.experiments=state.survivors=state.sessionPnl=state.trades=state.wins=0;state.generation=0;state.leaderboard=[];state.best=null;state.log=[];
  const hc=Math.max(2,Math.min(4,(navigator.hardwareConcurrency||4)-1));state.workerCount=hc;
  $("#enterBtn").classList.add("locked");$("#enterBtn").disabled=true;$("#exitBtn").classList.remove("locked");$("#exitBtn").disabled=false;$("#syncPulse").disabled=false;$("#emergencyStop").disabled=false;$("#marketPill").classList.add("live");$("#marketText").textContent="RESEARCH ACTIVE";sceneCtl?.setRunning(true);
  log(`Session ${state.sessionId} started`,"good");startTimer();renderStats();
  const symbols=["SPY","QQQ","IWM"];
  for(let i=0;i<hc;i++){const w=new Worker("./training-worker.js");state.workers.push(w);w.onmessage=e=>handleWorker(e.data);w.postMessage({type:"start",workerId:i,symbol:symbols[i%symbols.length],data:state.data[symbols[i%symbols.length]],seed:Date.now()+i*1009,parent:state.best});}
}
function handleWorker(m){
  if(m.type==="result"){state.experiments++;state.trades+=m.result.trades;state.wins+=m.result.wins;state.sessionPnl+=m.result.pnl;state.generation=Math.max(state.generation,m.result.generation);
    if(m.result.score>58){state.survivors++;state.leaderboard.push(m.result);state.leaderboard=state.leaderboard.sort((a,b)=>b.score-a.score).slice(0,20);if(!state.best||m.result.score>state.best.score){state.best=m.result;log(`NEW CHAMPION ${m.result.symbol}-${m.result.id.slice(-4)} score ${m.result.score.toFixed(1)}`,"good")}}
    else if(state.experiments%7===0) log(`${m.result.symbol}-${m.result.id.slice(-4)} rejected · ${m.result.score.toFixed(1)}`,"bad");
    if(state.experiments%11===0) log(`${m.result.symbol} ${m.result.note}`,"note");
    if(state.experiments%4===0){$("#mainSymbol").textContent=m.result.symbol;drawMain(m.result.symbol)}
    if(state.experiments%10===0) checkpoint();renderStats();
  }
}
function stopTraining(){state.running=false;$("#emergencyStop").disabled=true;for(const w of state.workers)w.postMessage({type:"stop"});for(const w of state.workers)w.terminate();state.workers=[];state.workerCount=0;stopTimer();$("#marketPill").classList.remove("live");$("#marketText").textContent="RESEARCH IDLE";sceneCtl?.setRunning(false);renderStats()}
function sessionPayload(){
  return {schemaVersion:"1.0",id:state.sessionId,startedAt:new Date(state.startedAt||Date.now()).toISOString(),endedAt:new Date().toISOString(),runtimeSec:state.startedAt?Math.floor((Date.now()-state.startedAt)/1000):0,
    experiments:state.experiments,survivors:state.survivors,sessionPnl:state.sessionPnl,trades:state.trades,wins:state.wins,best:state.best,leaderboard:state.leaderboard.slice(0,20),log:state.log.slice(0,50),
    dataSources:Object.fromEntries(["QQQ","SPY","IWM"].map(s=>[s,state.importedSymbols.has(s)?"csv":"synthetic"]))};
}
async function checkpoint(){if(!state.sessionId)return;await idbPut("sessions",sessionPayload());if(state.best)await idbPut("meta",{key:"best",value:state.best})}

async function parseCsv(file,symbol){
  const txt=await file.text(),lines=txt.trim().split(/\r?\n/),headers=lines[0].split(",").map(x=>x.trim().toLowerCase());
  const idx=k=>headers.indexOf(k);const req=["open","high","low","close","volume"];for(const r of req)if(idx(r)<0)throw new Error(`Missing ${r} column`);
  const ti=idx("time");const out=[];for(const line of lines.slice(1)){const a=line.split(",");if(a.length<5)continue;const d={time:ti>=0?(Date.parse(a[ti])||Number(a[ti])||Date.now()+out.length*60000):Date.now()+out.length*60000,open:+a[idx("open")],high:+a[idx("high")],low:+a[idx("low")],close:+a[idx("close")],volume:+a[idx("volume")]};if(Object.values(d).every(v=>Number.isFinite(v)))out.push(d)}
  if(out.length<100)throw new Error("Need at least 100 valid rows");state.data[symbol]=out;state.importedSymbols.add(symbol);redraw();log(`${symbol} CSV loaded · ${out.length} candles`,"good")
}

async function githubApi(path,method="GET",body=null){
  const g=state.github;if(!g.owner||!g.repo)throw new Error("Set owner and repository");if(g.owner!=="tristanpeto123-eng"||g.repo!=="Scalp-City-Lab"||g.branch!=="main"||g.path!=="knowledge-lab")throw new Error("LAB SAFETY LOCK: GitHub memory writes/reads restricted to Scalp-City-Lab main, knowledge-lab prefix");
  const [filePath,...queryParts]=path.split("?");const query=queryParts.length?"?"+queryParts.join("?"):"";const base=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}${query}`;
  const headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};if(g.token)headers.Authorization=`Bearer ${g.token}`;
  const r=await fetch(base,{method,headers,body:body?JSON.stringify(body):undefined});if(!r.ok){const t=await r.text();throw new Error(`${r.status} ${t.slice(0,180)}`)}return r.status===204?null:r.json()
}
const b64=s=>btoa(unescape(encodeURIComponent(s)));
async function putGithubFile(rel,obj,message){
  const g=state.github,path=`${g.path.replace(/^\/|\/$/g,"")}-${rel.replace(/\//g,"-")}`;let sha;
  try{const cur=await githubApi(path+"?ref="+encodeURIComponent(g.branch));sha=cur.sha}catch(e){if(!String(e.message).startsWith("404"))throw e}
  const body={message,content:b64(JSON.stringify(obj,null,2)),branch:g.branch};if(sha)body.sha=sha;return githubApi(path,"PUT",body)
}
async function loadGithubKnowledge(){
  const g=state.github;$("#ghStatus").textContent="Testing connection…";
  try{
    const path=`${g.path.replace(/^\/|\/$/g,"")}-manifest.json?ref=${encodeURIComponent(g.branch)}`;const m=await githubApi(path);
    const txt=decodeURIComponent(escape(atob(m.content.replace(/\n/g,""))));state.knowledge.manifest=JSON.parse(txt);$("#ghStatus").textContent=`Connected · ${state.knowledge.manifest.totalSessions||0} prior sessions`;log("GitHub knowledge loaded","good")
  }catch(e){
    if(String(e.message).startsWith("404")){$("#ghStatus").textContent="Connected · no knowledge yet";log("GitHub connected; starting fresh","good")}
    else{$("#ghStatus").textContent="Connection failed: "+e.message;throw e}
  }
}
async function syncGithub(payload){
  const g=state.github;if(!g.owner||!g.repo||!g.token)throw new Error("GitHub memory not configured");
  await putGithubFile(`sessions/${payload.id}.json`,payload,`Scalp City: save ${payload.id}`);
  const by={};for(const r of [state.best,...state.leaderboard].filter(Boolean)){if(!by[r.symbol]||r.score>by[r.symbol].score)by[r.symbol]=r}
  for(const [s,r] of Object.entries(by))await putGithubFile(`champions/${s}.json`,r,`Scalp City: update ${s} champion`);
  const prev=state.knowledge.manifest||{};const manifest={schemaVersion:"1.0",updatedAt:new Date().toISOString(),totalSessions:(prev.totalSessions||0)+1,lastSessionId:payload.id,bestOverall:state.best?{symbol:state.best.symbol,id:state.best.id,score:state.best.score}:prev.bestOverall||null};
  await putGithubFile("manifest.json",manifest,`Scalp City: update knowledge manifest`);state.knowledge.manifest=manifest;
}
function setGhFromUi(){
  state.github.owner=$("#ghOwner").value.trim();state.github.repo=$("#ghRepo").value.trim();state.github.branch=$("#ghBranch").value.trim()||"main";state.github.path=$("#ghPath").value.trim()||"knowledge-lab";state.github.token=$("#ghToken").value.trim();
  try{localStorage.setItem("scalpCityLabGithubMeta",JSON.stringify({owner:state.github.owner,repo:state.github.repo,branch:state.github.branch,path:state.github.path}))}catch{}
}
function loadGhMeta(){try{const g=JSON.parse(localStorage.getItem("scalpCityLabGithubMeta")||"{}");Object.assign(state.github,g);$("#ghOwner").value=g.owner||"";$("#ghRepo").value=g.repo||"Scalp-City-Lab";$("#ghBranch").value=g.branch||"main";$("#ghPath").value=g.path||"knowledge-lab"}catch{}}

async function saveExit(){
  if(!state.sessionId){return}$("#exitDialog").showModal();const box=$("#exitSteps");box.replaceChildren();const step=(t,cls="")=>{const e=document.createElement("div");e.className="step "+cls;e.textContent=t;box.appendChild(e);return e};
  let e=step("Stopping training workers…");stopTraining();e.textContent="✓ Training workers stopped";e.className="step ok";
  e=step("Saving session to iPhone…");const payload=sessionPayload();await idbPut("sessions",payload);await idbPut("meta",{key:"lastSession",value:payload.id});e.textContent="✓ Local checkpoint saved";e.className="step ok";
  if(state.github.owner&&state.github.repo&&state.github.token){
    e=step("Syncing knowledge to GitHub…");try{await syncGithub(payload);e.textContent="✓ GitHub knowledge synced";e.className="step ok"}catch(err){e.textContent="⚠ GitHub sync failed: "+err.message;e.className="step bad";downloadJson(payload)}
  }else{e=step("GitHub not configured — exporting session JSON instead");e.className="step note";downloadJson(payload)}
  step("SESSION SAFE","ok");$("#closeExit").style.display="block";$("#exitBtn").classList.add("locked");$("#exitBtn").disabled=true;$("#syncPulse").disabled=true;$("#emergencyStop").disabled=true;$("#enterBtn").classList.remove("locked");$("#enterBtn").disabled=false;
}
function downloadJson(obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${obj.id||"scalp-city-session"}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}

$("#enterBtn").addEventListener("click",startTraining);$("#exitBtn").addEventListener("click",saveExit);$("#emergencyStop").addEventListener("click",()=>{if(state.running){stopTraining();log("Emergency stop","bad")}});
$("#syncPulse").addEventListener("click",async()=>{await checkpoint();log("Local checkpoint saved","good")});
$("#dataBtn").addEventListener("click",()=>$("#dataDialog").showModal());$("#githubBtn").addEventListener("click",()=>$("#githubDialog").showModal());
$("#csvInput").addEventListener("change",async e=>{if(!e.target.files[0])return;$("#dataStatus").textContent="Loading CSV…";try{await parseCsv(e.target.files[0],$("#csvSymbol").value);$("#dataStatus").textContent="CSV loaded";notify("Market data loaded","ok");$("#dataDialog").close()}catch(err){$("#dataStatus").textContent=err.message;notify(err.message,"error")}});
$("#resetSynthetic").addEventListener("click",()=>{const s=$("#csvSymbol").value;state.data[s]=generateSynthetic(s);state.importedSymbols.delete(s);redraw();log(`${s} reset to synthetic`,"note")});
$("#testGithub").addEventListener("click",async()=>{setGhFromUi();try{await loadGithubKnowledge()}catch{}});
$("#closeExit").addEventListener("click",()=>$("#exitDialog").close());
$("#toggleToken").addEventListener("click",()=>{const input=$("#ghToken"),show=input.type==="password";input.type=show?"text":"password";$("#toggleToken").textContent=show?"HIDE":"SHOW";$("#toggleToken").setAttribute("aria-label",show?"Hide token":"Show token")});
document.querySelectorAll(".ticker-monitor").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".ticker-monitor").forEach(x=>x.classList.toggle("active",x===btn));$("#mainSymbol").textContent=btn.dataset.symbol;drawMain(btn.dataset.symbol);sceneCtl?.setSymbol?.(btn.dataset.symbol);sceneCtl?.refresh?.();notify(`${btn.dataset.symbol} routed to core monitor`)}));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&state.running)checkpoint()});
window.addEventListener("pagehide",()=>{if(state.running)checkpoint()});

if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
loadGhMeta();city();ensureData();redraw();renderStats();log("LAB simulation ready · training uses synthetic data unless CSV imported","good");
