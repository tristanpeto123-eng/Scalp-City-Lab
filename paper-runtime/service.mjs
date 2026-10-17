// Run with Node.js 20+ on a persistent server; not on static GitHub Pages or iOS background tab.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AlpacaPaper} from './alpaca-paper.mjs';
import {AgentWorkflow,sha,AGENTS} from './engine.mjs';

const folder=process.env.SCALP_JOURNAL_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'runtime');
const journalFile=path.join(folder,'events.jsonl');
let lastHash='GENESIS',sequence=0;const unresolvedIntents=new Set();
class FileJournal {
  async init(){await fs.mkdir(folder,{recursive:true,mode:0o700});try{
    const content=await fs.readFile(journalFile,'utf8');for(const line of content.split('\n').filter(Boolean)){
      const entry=JSON.parse(line),{hash,...unsigned}=entry;
      if(entry.previousHash!==lastHash||sha(unsigned)!==hash)throw Error('Journal hash-chain integrity failed');
      lastHash=hash;sequence=entry.sequence;
      if(entry.agentId==='PT-01'&&entry.state==='INTENT')unresolvedIntents.add(entry.clientOrderId);
      if(entry.agentId==='PT-01'&&entry.state==='RESOLVED')unresolvedIntents.delete(entry.clientOrderId);
    }
  }catch(e){if(e.code!=='ENOENT')throw e;}}
  async append(evt){
    const event={sequence:++sequence,previousHash:lastHash,...evt};
    const hash=sha(event);
    await fs.appendFile(journalFile,JSON.stringify({...event,hash})+'\n',{mode:0o600,flag:'a'});
    lastHash=hash;
    if(evt.agentId==='PT-01'&&evt.state==='INTENT')unresolvedIntents.add(evt.clientOrderId);
    if(evt.agentId==='PT-01'&&evt.state==='RESOLVED')unresolvedIntents.delete(evt.clientOrderId);
    return hash;
  }
}
const sleep=t=>new Promise(resolve=>setTimeout(resolve,t));
async function main(){
  const paperEnabled=process.env.SCALP_PAPER_ENABLED==='true';
  if(paperEnabled&&process.env.SCALP_RELEASE_APPROVED!=='SCALP-PAPER-0.1.0-rc3')throw Error('Paper orders require approval for exact release SCALP-PAPER-0.1.0-rc3');
  const broker=new AlpacaPaper();const journal=new FileJournal();await journal.init();
  if(paperEnabled&&unresolvedIntents.size)throw Error('Unresolved paper-order intents must be manually reconciled before re-arming: '+unresolvedIntents.size);
  const workflow=new AgentWorkflow({broker,journal,paperEnabled});
  await journal.append({agentId:'BM-01',state:'STARTUP',decision:paperEnabled?'PAPER ORDERS ARMED':'READ-ONLY / DRY-RUN',engine:'scalp-city-paper',ts:new Date().toISOString()});
  const host=process.env.SCALP_BIND||'127.0.0.1',port=Number(process.env.PORT||8787);
  const allowedOrigin=process.env.SCALP_ALLOWED_ORIGIN||'';
  const server=http.createServer((req,res)=>{
    const origin=req.headers.origin||'';
    if(origin&&origin===allowedOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
    if(req.method!=='GET'||!['/health','/api/status'].includes(req.url)){res.writeHead(404).end('{}');return;}
    if(req.url==='/health'){res.end(JSON.stringify({service:'scalp-paper',alive:true}));return;}
    res.end(JSON.stringify({checkedAt:new Date().toISOString(),...workflow.getStatus(),stations:AGENTS.map(([id,name])=>({id,name}))}));
  });
  server.listen(port,host,()=>console.log(`Scalp Paper status at http://${host}:${port}/api/status; mode=${paperEnabled?'PAPER':'DRY_RUN'}`));
  const stop=async()=>{workflow.emergencyStop();try{await journal.append({agentId:'BM-01',state:'HALTED',decision:'Process shutdown',ts:new Date().toISOString()})}catch(e){console.error('Journal halt write failed:',e.message)}server.close();process.exit(0)};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  while(!workflow.halted){
    try{await workflow.reconcile()}catch(e){workflow.emergencyStop();console.error('HALTED: reconciliation failed:',e.message);break;}
    for(const symbol of ['SPY','QQQ','IWM','BTC/USD','ETH/USD']){
      if(workflow.halted)break;
      try{const result=await workflow.process(symbol);console.log(new Date().toISOString(),symbol,result.status)}
      catch(e){console.error('HALTED:',symbol,e.message);break;}
    }
    if(!workflow.halted)await sleep(60_000);
  }
}
main().catch(err=>{console.error('Fatal runtime error:',err.message);process.exitCode=1});
