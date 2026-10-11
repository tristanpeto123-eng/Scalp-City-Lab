/* Independent, research-only VA-01 agent; auto-consumes BT-01 reports via event bus. */
export const VA01=Object.freeze({id:'VA-01',name:'Validator',protocol:'scalp-city.agent.v1',canTrade:false,permissions:['read-report','audit-ledger','publish-validation']});
const HISTORY=(typeof location==='undefined'?'scalp-city-local':location.pathname.split('/').filter(Boolean)[0]||'scalp-city-root')+':VA-01:audit-history:v1';
export class ValidatorAgent{
  constructor({workerPath='./validator-agent-worker.js',listen=true}={}){
    this.workerPath=workerPath;this.worker=null;this.listeners=new Set();this.state='IDLE';this.lastAudit=null;
    try{this.history=JSON.parse(localStorage.getItem(HISTORY)||'[]')}catch{this.history=[]}
    if(listen&&typeof window!=='undefined')window.addEventListener('scalp-city:agent-report',e=>{
      const d=e.detail;if(d?.agentId==='BT-01'&&d?.type==='backtest'){
        try{this.validate(d.report,d.dataset)}catch(err){this.emit('failed',{error:String(err.message||err)})}
      }
    });
  }
  subscribe(callback){this.listeners.add(callback);return()=>this.listeners.delete(callback)}
  get busy(){return Boolean(this.worker)}
  emit(type,more={}){const message={protocol:VA01.protocol,agentId:VA01.id,type,state:this.state,...more};
    for(const fn of this.listeners)try{fn(message)}catch(err){console.warn(err)}
    if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scalp-city:validator-status',{detail:message}));
  }
  validate(report,dataset){
    if(this.busy)throw Error('VA-01 is already auditing a job');
    if(!report?.jobId||report.agentId!=='BT-01')throw Error('VA-01 requires a valid BT-01 report');
    this.state='RUNNING';const jobId=report.jobId,worker=new Worker(this.workerPath,{type:'module'});this.worker=worker;
    worker.onmessage=e=>{const m=e.data;if(worker!==this.worker||m.jobId!==jobId||m.agentId!==VA01.id)return;
      if(m.kind==='validated'){
        this.lastAudit=m.audit;this.state='COMPLETED';this.history=[{jobId,date:m.audit.createdAt,verdict:m.audit.verdict,failed:m.audit.counters.failed},...this.history].slice(0,15);
        try{localStorage.setItem(HISTORY,JSON.stringify(this.history))}catch{}
        this.emit('completed',{jobId,audit:m.audit});
        if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('scalp-city:validator-report',{detail:{agentId:VA01.id,subjectAgent:'BT-01',jobId,audit:m.audit}}));
        worker.terminate();this.worker=null;
      }else if(m.kind==='failed'){this.state='FAILED';this.emit('failed',{jobId,error:m.error});worker.terminate();this.worker=null}
    };
    worker.onerror=e=>{if(this.worker!==worker)return;this.state='FAILED';this.emit('failed',{jobId,error:e.message||'Validator error'});worker.terminate();this.worker=null};
    this.emit('started',{jobId});worker.postMessage({protocol:VA01.protocol,agentId:VA01.id,kind:'validate',jobId,report,dataset});return jobId;
  }
  stop(){if(!this.worker)return;this.worker.terminate();this.worker=null;this.state='CANCELLED';this.emit('cancelled')}
}
