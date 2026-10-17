// Scheduled one-shot research runner. Hard-disabled paper trading.
// Designed for GitHub-hosted ephemeral runners. Each run is independent and
// does NOT claim to preserve the forward-learning journal between runs.
import { AlpacaPaper } from './alpaca-paper.mjs';
import { AgentWorkflow, ASSETS, VERSION } from './engine.mjs';

class VolatileJournal {
  constructor(){this.events=[];}
  async append(evt){this.events.push(evt);}
}
async function main(){
  const broker=new AlpacaPaper();
  const journal=new VolatileJournal();
  const workflow=new AgentWorkflow({broker,journal,paperEnabled:false});
  // Neither environment toggles nor broker credentials can arm orders here.
  const outcomes=[];
  for(const symbol of ASSETS){
    try{
      const result=await workflow.process(symbol);
      outcomes.push({symbol,status:result.status,
        candidateId:result.candidateId||null,
        decision:result.trade?.status||null});
    }catch(error){
      outcomes.push({symbol,status:'BLOCKED',error:String(error.message||error).slice(0,140)});
      break; // hard stop: remaining symbols never process after runtime failure
    }
  }
  const report={version:VERSION,mode:'SCHEDULED_READ_ONLY_RESEARCH',
    noOrderCapability:true,at:new Date().toISOString(),
    markets:workflow.markets,outcomes,
    stationEvents:journal.events.map(e=>({agentId:e.agentId,state:e.state,decision:e.decision,ts:e.ts})),
    note:'Each run uses an ephemeral journal; no persistent model training or broker order placement.'};
  console.log(JSON.stringify(report,null,2));
  if(outcomes.some(o=>o.status==='BLOCKED'))process.exitCode=1;
}
main().catch(e=>{console.error('Research cycle stopped:',String(e.message||e));process.exitCode=1;});
