// Dedicated BT-01 computational worker. No broker imports, API access, or network calls.
import {backtest,STRATEGIES,ENGINE_VERSION,datasetFingerprint} from './cfd-engine.js';
const AGENT='BT-01',PROTOCOL='scalp-city.agent.v1';
let running=false,activeId=null,aborted=false;
const send=(kind,jobId,body={})=>postMessage({protocol:PROTOCOL,agentId:AGENT,kind,jobId,...body});
const tick=()=>new Promise(r=>setTimeout(r,0));
function assertResult(result){
  if(!result||!Number.isFinite(result.netPnL)||!Number.isFinite(result.metrics?.sharpe)||!Array.isArray(result.curve))throw Error('Invalid simulation result '+result?.id);
  if(result.curve.some(x=>!Number.isFinite(x.nav)))throw Error('Non-finite NAV for '+result.id);
  const c=result.costs;
  const pnl=result.grossPricePnL-c.commission-c.spread-c.slippage-c.financing-c.borrow+c.dividends;
  if(Math.abs(pnl-result.netPnL)>1e-5)throw Error('Ledger reconciliation failed '+result.id);
}
async function execute(req){
  const {jobId,data,config={},strategyIds=['ALL'],stress=false}=req;
  if(!jobId||running)throw Error('Worker busy or invalid job ID');
  running=true;activeId=jobId;aborted=false;
  try{
    const ids=strategyIds.includes('ALL')?STRATEGIES.map(s=>s.id):[...new Set(strategyIds)];
    if(!ids.length||ids.some(id=>!STRATEGIES.some(s=>s.id===id)))throw Error('Unknown/empty strategy request');
    if(!data||data.dates?.length<75||!Array.isArray(data.symbols)||!Array.isArray(data.bars))throw Error('Dataset needs >=75 aligned daily sessions');
    send('started',jobId,{total:ids.length*(stress?2:1),strategies:ids});
    const results=[],stressResults=[];let completed=0;
    for(const id of ids){
      if(aborted)return;
      const outcome=backtest(data,id,config);assertResult(outcome);results.push(outcome);
      completed++;send('progress',jobId,{completed,total:ids.length*(stress?2:1),strategyId:id,scenario:'base'});await tick();
    }
    if(stress)for(const id of ids){
      if(aborted)return;
      const test=backtest(data,id,{...config,spreadBps:2*Number(config.spreadBps??6),slippageBps:2*Number(config.slippageBps??2)});
      assertResult(test);stressResults.push(test);
      completed++;send('progress',jobId,{completed,total:ids.length*2,strategyId:id,scenario:'2x-cost'});await tick();
    }
    if(aborted)return;
    const robustness=results.map(x=>{
      const s=stressResults.find(t=>t.id===x.id);
      return {id:x.id,netReturnPct:x.metrics.netReturnPct,holdoutReturnPct:x.metrics.holdoutReturnPct,
        stressedNetReturnPct:s?.metrics.netReturnPct??null,stressDeltaPct:s?s.metrics.netReturnPct-x.metrics.netReturnPct:null,
        costDrag:(x.costs.spread+x.costs.slippage+x.costs.commission+x.costs.financing+x.costs.borrow-x.costs.dividends),
        marginEvents:x.metrics.marginEvents};
    });
    send('completed',jobId,{report:{protocol:PROTOCOL,agentId:AGENT,jobId,createdAt:new Date().toISOString(),
      dataset:{source:data.source,assets:data.symbols.length,sessions:data.dates.length,first:data.dates[0],last:data.dates.at(-1),fingerprint:datasetFingerprint(data),warning:data.warning||null},
      engineVersion:ENGINE_VERSION,
      config,results,stressResults,robustness,verdict:'RESEARCH_ONLY',canTrade:false,
      validation:{historicalProof:false,walkForward:false,actualBrokerCostsVerified:false,
        warnings:[data.warning||'Point-in-time universe and costs need independent verification',
          'Fixed-parameter last-30% check is not blind walk-forward validation',
          'No live execution, corporate-action normalization, delistings, intraday margin or FX simulation']}}});
  }catch(err){send('failed',jobId,{error:String(err?.message||err)})}
  finally{running=false;activeId=null;aborted=false}
}
globalThis.onmessage=e=>{
  const m=e.data;
  if(!m||m.protocol!==PROTOCOL||m.agentId!==AGENT)return;
  if(m.kind==='cancel'&&m.jobId===activeId){aborted=true;send('cancelled',m.jobId);return}
  if(m.kind==='execute'){execute(m).catch(err=>send('failed',m.jobId,{error:String(err)}))}
};
