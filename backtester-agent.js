// BT-01 coordinator: isolated from app.js/training-worker.js and live trading.
// Other agents can issue browser-local CustomEvent('scalp-city:agent-task', {detail:{target:'BT-01',action:'run',dataset,config,strategyIds,stress}}).
export const BT01=Object.freeze({id:'BT-01',name:'Backtester',protocol:'scalp-city.agent.v1',role:'Research / backtest',permissions:['simulation','local-report','publish'],canTrade:false});
const HISTORY_KEY='scalp-city-lab:BT-01:report-history:v1';
export class BacktesterAgent{
  constructor({workerPath='./backtester-agent-worker.js',listen=true}={}){
    this.workerPath=workerPath;this.worker=null;this.jobId=null;this.state='IDLE';this.lastReport=null;this.listeners=new Set();this.history=this.readHistory();this.jobSeq=0;
    if(listen&&typeof window!=='undefined'){
      window.addEventListener('scalp-city:agent-task',e=>{
        const task=e.detail;
        if(!task||task.target!==BT01.id||task.action!=='run')return;
        try{this.run(task)}catch(err){this.emit('rejected',{error:String(err.message||err)})}
      });
    }
  }
  readHistory(){try{const records=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(records)?records.slice(0,12):[]}catch{return []}}
  get busy(){return Boolean(this.worker)}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  emit(type,detail={}){
    const payload={protocol:BT01.protocol,agentId:BT01.id,type,state:this.state,jobId:this.jobId,...detail};
    for(const fn of this.listeners)try{fn(payload)}catch(err){console.warn('BT-01 listener failed',err)}
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scalp-city:agent-status',{detail:payload}));
  }
  run({dataset,config={},strategyIds=['ALL'],stress=true}={}){
    if(this.busy)throw Error('BT-01 already testing; stop the current job first');
    if(!dataset?.dates||!dataset?.bars||!dataset?.symbols)throw Error('Missing aligned daily dataset');
    if(!Array.isArray(strategyIds))throw Error('strategyIds must be an array');
    const jobId='BT01-'+Date.now().toString(36)+'-'+(++this.jobSeq);
    const worker=new Worker(this.workerPath,{type:'module'});this.worker=worker;this.jobId=jobId;this.state='QUEUED';this.lastReport=null;
    worker.onmessage=e=>{
      const m=e.data;if(this.worker!==worker||m?.jobId!==jobId||m.protocol!==BT01.protocol||m.agentId!==BT01.id)return;
      if(m.kind==='started'){this.state='RUNNING';this.emit('started',{total:m.total,strategies:m.strategies})}
      else if(m.kind==='progress'){this.emit('progress',{completed:m.completed,total:m.total,strategyId:m.strategyId,scenario:m.scenario})}
      else if(m.kind==='completed'){
        this.lastReport=m.report;this.state='COMPLETED';this.saveSummary(m.report);
        this.emit('completed',{report:m.report});
        if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scalp-city:agent-report',{detail:{agentId:BT01.id,type:'backtest',report:m.report}}));
        this.release();
      }else if(m.kind==='failed'){this.state='FAILED';this.emit('failed',{error:m.error});this.release()}
      else if(m.kind==='cancelled'){this.state='CANCELLED';this.emit('cancelled');this.release()}
    };
    worker.onerror=e=>{if(this.worker!==worker)return;this.state='FAILED';this.emit('failed',{error:String(e.message||'Worker error')});this.release()};
    this.emit('queued',{strategies:strategyIds,stress});
    worker.postMessage({protocol:BT01.protocol,agentId:BT01.id,kind:'execute',jobId,data:dataset,config,strategyIds,stress});
    return jobId;
  }
  stop(){if(!this.busy)return false;const jobId=this.jobId;this.worker.terminate();this.worker=null;this.state='CANCELLED';this.emit('cancelled',{jobId});return true}
  release(){this.worker?.terminate();this.worker=null}
  saveSummary(report){
    const item={jobId:report.jobId,date:report.createdAt,source:report.dataset.source,assets:report.dataset.assets,
      sessions:report.dataset.sessions,count:report.results.length,
      summaries:report.robustness.map(({id,netReturnPct,stressedNetReturnPct})=>({id,netReturnPct,stressedNetReturnPct})),verdict:report.verdict};
    this.history=[item,...this.history].slice(0,12);
    try{if(typeof localStorage!=='undefined')localStorage.setItem(HISTORY_KEY,JSON.stringify(this.history))}catch(err){console.warn('BT-01 report history storage unavailable',err)}
  }
}
