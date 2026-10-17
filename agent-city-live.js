/* Read-only external runtime telemetry bridge for Scalp City Agent City.
   Never receives keys, submits trades or grants approval. Requires HTTPS backend. */
(() => {
  const storageKey='scalp-city-lab-paper-status-origin-v1';
  const source=document.getElementById('sourceMode');
  const trialBadge=document.createElement('span');
  trialBadge.id='fiftyPoundTrial';
  trialBadge.style.cssText='padding:7px;border:1px solid #446d86;border-radius:4px;color:#dafaff;background:#071b2a;font:700 10px monospace;white-space:nowrap;';
  trialBadge.textContent='£50 · 3R · 0/61 TRADES · NOT CONNECTED';
  document.querySelector('.topActions')?.prepend(trialBadge);
  const button=document.createElement('button');
  button.id='connectPaperStatus';button.type='button';button.textContent='CONNECT PAPER STATUS';
  button.title='Connect a read-only, external Scalp City paper runtime';
  button.style.cssText='border:1px solid #36b7df;background:#082035;color:#d6f5ff;padding:7px;font:700 10px monospace;cursor:pointer;';
  document.querySelector('.topActions')?.prepend(button);
  let endpoint='',seen=new Set(),connected=false;
  const setLabel=msg=>{source.textContent=msg;};
  function normalize(input){
    if(!input)return '';
    const u=new URL(input);
    if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use an HTTPS server origin');
    if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Enter server origin only, without keys or paths');
    return u.origin;
  }
  button.addEventListener('click',()=>{
    const v=prompt('Enter the HTTPS origin of your private paper-runtime read-only status server. Leave blank to disconnect:',endpoint);
    if(v===null)return;
    if(!v.trim()){
      endpoint='';seen=new Set();connected=false;localStorage.removeItem(storageKey);
      button.textContent='CONNECT PAPER STATUS';setLabel('ILLUSTRATIVE DATA');trialBadge.textContent='£50 · 3R · 0/61 TRADES · NOT CONNECTED';return;
    }
    try{
      endpoint=normalize(v.trim());localStorage.setItem(storageKey,endpoint);
      seen=new Set();connected=false;setLabel('CONNECTING PAPER TELEMETRY');poll();
    }catch(err){alert(err.message)}
  });
  async function poll(){
    if(!endpoint||!window.ScalpCityAgentCity?.ingest)return;
    try{
      const r=await fetch(`${endpoint}/api/status`,{cache:'no-store',mode:'cors',credentials:'omit',signal:AbortSignal.timeout(9000)});
      if(!r.ok)throw Error('HTTP '+r.status);
      const s=await r.json();if(!Array.isArray(s.events)||!['ALPACA_IEX','ALPACA_IEX_AND_CRYPTO_US'].includes(s.source)||!s.version)throw Error('Incompatible telemetry contract');
      if(s.trial&&s.trial.startGbp===50){
        const wins=Number(s.trial.wins||0),closed=Number(s.trial.closedTrades||0);
        trialBadge.textContent=`£${Number(s.trial.balanceGbp).toFixed(2)} VIRTUAL · 3:1 · ${closed}/61 CLOSED · ${Number(s.trial.winRatePct||0).toFixed(1)}% WINS`;
        trialBadge.title='Virtual GBP research portfolio, not Alpaca equity; modeled fees, not confirmed fills. Target 80% over >=61 closed trades.';
      }
      setLabel(`PAPER RUNTIME · ${s.paperEnabled?'ORDERS ARMED':'DRY RUN'} · ${s.status}`);
      connected=true;button.textContent='PAPER STATUS ✓';
      if(s.halted)window.ScalpCityAgentCity.ingest({agentId:'BM-01',state:'HALTED',decision:'Emergency stop / data failure',metric:'No new orders',message:'Runtime halted; operator action needed'});
      if(s.markets&&Object.keys(s.markets).length){const prices=Object.entries(s.markets).map(([symbol,m])=>`${symbol} ${Number(m.close).toFixed(2)}`).join(' · ');
        const newest=Object.values(s.markets).map(m=>Date.parse(m.finalizedAt)).filter(Number.isFinite);
        if(newest.length)window.ScalpCityAgentCity.ingest({agentId:'DC-01',state:'MARKET DATA · VERIFIED',decision:prices,metric:`${Object.keys(s.markets).length} live-feed instruments`,message:'Latest completed 15-minute bars; IEX-only equities and separate Alpaca crypto feed'});}
      const recent=s.events.slice(-40);
      for(const e of recent){
        const k=[e.agentId,e.ts,e.state,e.decision].join('|');if(seen.has(k))continue;
        seen.add(k);window.ScalpCityAgentCity.ingest({agentId:e.agentId,state:e.state,decision:e.decision,metric:e.metric||'Verified handoff',message:e.message||e.decision});
      }
      if(seen.size>400)seen=new Set([...seen].slice(-200));
    }catch(err){
      if(connected||endpoint)setLabel('PAPER STATUS OFFLINE · ILLUSTRATIONS ONLY');
      connected=false;button.textContent='RETRY PAPER STATUS';
    }
  }
  try{endpoint=normalize(localStorage.getItem(storageKey)||'')}catch{endpoint=''}
  setInterval(()=>{if(document.visibilityState==='visible')poll()},15000);
  // Wait for the 3D city module to publish its ingestion method.
  let attempts=0;const startup=setInterval(()=>{if(window.ScalpCityAgentCity){clearInterval(startup);poll()}else if(++attempts>25)clearInterval(startup)},400);
})();
