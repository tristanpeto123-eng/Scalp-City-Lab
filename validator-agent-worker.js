/* VA-01: independent mathematical, stress, data-integrity and provenance checks.
   Does not import BT-01 engine; does not reconstruct broker execution or approve live trading. */
const PROTOCOL='scalp-city.agent.v1', AGENT='VA-01', EPS=1e-5;
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
const sd=x=>{if(x.length<2)return 0;const m=mean(x);return Math.sqrt(x.reduce((s,v)=>s+(v-m)**2,0)/(x.length-1))};
function independentDatasetFingerprint(data){
  let hash=2166136261;const feed=str=>{for(let i=0;i<str.length;i++){hash^=str.charCodeAt(i);hash=Math.imul(hash,16777619)}};
  for(let i=0;i<data.dates.length;i++){feed(data.dates[i]);for(const s of [...data.symbols].sort()){
    const b=data.bars[i][s];feed(s+'|'+b.sector+'|'+[b.open,b.high,b.low,b.close,b.volume,b.signalClose,b.dividend,b.spread,b.borrow].join('|'));
  }}
  return 'fnv1a32:'+((hash>>>0).toString(16).padStart(8,'0'));
}
function summary(report,data){
  if(!report||report.agentId!=='BT-01'||!report.jobId)throw Error('Expected BT-01 report with job ID');
  const findings=[],byStrategy=[],add=(type,id,detail)=>findings.push({type,id,detail});
  const capital=Number(report.config?.capital);if(!Number.isFinite(capital)||capital<=0)throw Error('Invalid report capital');
  const safeNear=(a,b,tol=1e-5)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(tol,Math.abs(b)*1e-9);
  const base=report.results||[],stressed=new Map((report.stressResults||[]).map(x=>[x.id,x]));
  if(!Array.isArray(report.results)||!base.length)throw Error('Report has no strategy results');
  if(new Set(base.map(x=>x.id)).size!==base.length)add('FAIL','DUPLICATE','Repeated strategy IDs in report');
  if(report.canTrade!==false)add('FAIL','EXECUTION_LOCK','BT-01 reported non-blocked trading');
  if(!report.engineVersion)add('WARN','ENGINE_VERSION','Engine version missing from report');
  if(!report.dataset?.fingerprint)add('WARN','DATA_FINGERPRINT','Dataset fingerprint missing; reproducibility cannot be confirmed');
  if(data){
    if(report.dataset?.fingerprint&&independentDatasetFingerprint(data)!==report.dataset.fingerprint)add('FAIL','DATA_FINGERPRINT','Historical market bars do not match the reported data checksum');
    if(data.dates?.length!==report.dataset?.sessions||data.symbols?.length!==report.dataset?.assets)add('FAIL','DATASET_SHAPE','Report metadata disagrees with supplied dataset');
    if(data.dates?.[0]!==report.dataset?.first||data.dates?.at(-1)!==report.dataset?.last)add('FAIL','DATASET_DATES','Report date range mismatches supplied dataset');
    if(!Array.isArray(data.bars)||data.bars.length!==data.dates?.length)add('FAIL','DATASET_ROWS','Supplied dataset is not a dated panel');
    else{
      for(let i=0;i<data.bars.length;i++){
        const day=data.bars[i];
        if(i&&!(data.dates[i]>data.dates[i-1]))add('FAIL','DATE_ORDER','Dates are not strictly increasing');
        for(const s of data.symbols){const b=day[s];if(!b||![b.open,b.high,b.low,b.close,b.volume].every(v=>Number.isFinite(v))||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)){
          add('FAIL','DATA_INTEGRITY','Malformed OHLCV row '+data.dates[i]+' / '+s);break;
        }}
        if(findings.filter(f=>f.id==='DATA_INTEGRITY'||f.id==='DATE_ORDER').length>3)break;
      }
    }
  }else add('WARN','NO_DATASET','Cannot independently check input market bars; only report accounting verified');
  for(const r of base){
    const checks=[],check=(condition,label)=>{checks.push({label,pass:Boolean(condition)});if(!condition)add('FAIL',r.id,label)};
    const c=r.costs||{},m=r.metrics||{},eq=r.curve||[];
    const allFinite=['commission','spread','slippage','financing','borrow','dividends'].every(k=>Number.isFinite(c[k]));
    check(allFinite,'Finite cost ledger');
    const reconciled=r.grossPricePnL-c.commission-c.spread-c.slippage-c.financing-c.borrow+c.dividends;
    check(allFinite&&safeNear(reconciled,r.netPnL),'Gross-to-net accounting reconciliation');
    check(eq.length===report.dataset.sessions&&eq.length>1,'Complete equity curve');
    const end=eq.at(-1)?.nav;
    check(safeNear(end-capital,r.netPnL),'Final equity matches net P&L');
    check(safeNear((end/capital-1)*100,m.netReturnPct),'Net return percentage matches NAV');
    let peak=capital,dd=0,sequence=true,ordered=true,monotonic=true;
    const ret=[];
    for(let i=0;i<eq.length;i++){
      const v=eq[i];if(!Number.isFinite(v.nav)||!Number.isFinite(v.orders)){sequence=false;continue}
      if(data&&v.date!==data.dates[i])ordered=false;
      if(i&&v.orders<eq[i-1].orders)monotonic=false;
      peak=Math.max(peak,v.nav);if(peak>0)dd=Math.max(dd,(peak-v.nav)/peak);
      if(i&&eq[i-1].nav>0)ret.push(v.nav/eq[i-1].nav-1);
    }
    check(sequence&&ordered&&monotonic,'Ordered, finite equity and nondecreasing order counter');
    check(safeNear(dd*100,m.maxDrawdownPct),'Drawdown recalculation');
    const sharpe=sd(ret)>0?mean(ret)/sd(ret)*Math.sqrt(252):0;
    check(safeNear(sharpe,m.sharpe),'Sharpe recalculation');
    const cut=Math.max(1,Math.floor(eq.length*.7)),pre=eq[cut-1]?.nav;
    const holdout=pre>0?(end/pre-1)*100:null;
    check(holdout!==null&&safeNear(holdout,m.holdoutReturnPct),'Last-30% chronological return check');
    const stress=stressed.get(r.id);
    if(stress){check(Number.isFinite(stress.netPnL)&&stress.metrics?.netReturnPct<=m.netReturnPct+1e-7,'2× transaction-cost stress is not better than baseline');}
    else add('WARN',r.id,'No matched doubled-cost stress scenario');
    const pass=checks.every(x=>x.pass);byStrategy.push({id:r.id,name:r.name,status:pass?'AUDIT_PASS':'AUDIT_FAIL',checks,netReturnPct:m.netReturnPct,stressReturnPct:stress?.metrics?.netReturnPct??null});
  }
  add('BLOCK','POINT_IN_TIME','Source universe and sector classifications are not independently verified point-in-time or delisting-aware');
  add('BLOCK','CFD_TARIFFS','Historical CFD spread, financing, borrow availability, dividends and broker fills not verified');
  add('BLOCK','OUT_OF_SAMPLE','A last-30% split is not pre-registered blind walk-forward validation');
  add('BLOCK','MODEL_SCOPE','No independent order-fill reconstruction, intraday margin, FX or split share-count adjustment');
  if(report.dataset?.source==='SYNTHETIC')add('BLOCK','SYNTHETIC','Synthetic market series are not real historical evidence');
  const fail=findings.filter(x=>x.type==='FAIL'),blocks=findings.filter(x=>x.type==='BLOCK');
  return {protocol:PROTOCOL,agentId:AGENT,version:'1.0.0',subjectAgent:'BT-01',jobId:report.jobId,
    dataset:report.dataset,engineVersion:report.engineVersion||'unknown',createdAt:new Date().toISOString(),
    auditPassed:fail.length===0,tradeApproved:false,verdict:fail.length?'INVALID_REPORT':'RESEARCH_ONLY_BLOCKED',
    counters:{passed:byStrategy.filter(x=>x.status==='AUDIT_PASS').length,failed:fail.length,blockers:blocks.length,warnings:findings.filter(x=>x.type==='WARN').length},
    byStrategy,findings,scope:'Independent reported P&L/equity math, stress, and supplied OHLCV shape only. NOT an independent execution replay or proof of edge.'};
}
self.onmessage=e=>{const m=e.data;if(m?.protocol!==PROTOCOL||m?.agentId!==AGENT||m?.kind!=='validate')return;
  try{self.postMessage({protocol:PROTOCOL,agentId:AGENT,kind:'validated',jobId:m.jobId,audit:summary(m.report,m.dataset)})}
  catch(err){self.postMessage({protocol:PROTOCOL,agentId:AGENT,kind:'failed',jobId:m.jobId,error:String(err?.message||err)})}
};
