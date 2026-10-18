// Persistent examiner service (Node 22+). NEVER run unattended on GitHub Pages.
// Default mode is DRY_RUN; real funds are not accessible in this implementation.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Teacher} from './engine.mjs';
import {CryptoTeacherBroker} from './alpaca-crypto.mjs';

export const RELEASE='ACADEMY-TEACHER-0.1.0-rc1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
export class TeacherJournal {
  constructor(root){this.root=root;this.file=path.join(root,'events.jsonl');
    this.events=[];this.lastHash='GENESIS';this.sequence=0;}
  async init(){
    await fs.mkdir(this.root,{mode:0o700,recursive:true});
    const text=await fs.readFile(this.file,'utf8').catch(e=>{
      if(e.code==='ENOENT')return '';throw e;
    });
    for(const line of text.split('\n').filter(Boolean)){
      const record=JSON.parse(line),{hash:received,...body}=record;
      if(body.prev!==this.lastHash||body.seq!==this.sequence+1||hash(body)!==received)
        throw Error('TEACHER: private journal integrity failure');
      this.events.push(body);this.lastHash=received;this.sequence=body.seq;
    }
  }
  async add(type,data){
    const body={seq:++this.sequence,prev:this.lastHash,type,...data,
      loggedAt:new Date().toISOString()};
    const next=hash(body);
    const handle=await fs.open(this.file,'a',0o600);
    try{await handle.writeFile(JSON.stringify({...body,hash:next})+'\n');await handle.sync();}
    finally{await handle.close();}
    this.events.push(body);this.lastHash=next;
  }
  async hasBar(barId){return this.events.some(e=>e.type==='BAR'&&e.barId===barId);}
  async hasIntent(clientOrderId){return this.events.some(e=>e.type==='INTENT'&&e.clientOrderId===clientOrderId);}
  async bar(barId){return this.add('BAR',{barId});}
  async intent(clientOrderId,data){return this.add('INTENT',{clientOrderId,...data});}
  async ack(clientOrderId,data){return this.add('ACK',{clientOrderId,...data});}
  async observe(symbol,equity){
    if(!Number.isFinite(equity)||equity<=0)throw Error('TEACHER: invalid observed equity');
    await this.add('EQUITY',{symbol,equity});
  }
  async peakEquity(symbol){
    const values=this.events.filter(e=>e.type==='EQUITY'&&e.symbol===symbol).map(e=>e.equity);
    if(!values.length)throw Error('TEACHER: private equity baseline not initialized');
    return Math.max(...values);
  }
  async orderIds(symbol){
    return new Set(this.events.filter(e=>e.type==='INTENT'&&e.symbol===symbol).map(e=>e.clientOrderId));
  }
  unresolved(){
    return this.events.filter(e=>e.type==='INTENT'&&!this.events.some(
      x=>x.type==='ACK'&&x.clientOrderId===e.clientOrderId));
  }
}
function parse(value,name){
  if(!value)throw Error('TEACHER: missing '+name);
  try{return JSON.parse(value)}catch{throw Error('TEACHER: malformed '+name);}
}
export function reviewConfiguration({admissions,credentials,enabled,approval}){
  if(!Array.isArray(admissions)||!admissions.length||admissions.length>10)
    throw Error('TEACHER: no independently admitted pupil available');
  if(enabled&&approval!==RELEASE)throw Error('TEACHER: exact owner release approval absent');
  const seen=new Set();
  for(const a of admissions){
    if(seen.has(a.symbol))throw Error('TEACHER: duplicate pupil');
    seen.add(a.symbol);
    if(!credentials[a.symbol]?.key||!credentials[a.symbol]?.secret)
      throw Error('TEACHER: missing dedicated crypto PAPER account for '+a.symbol);
  }
  const keys=admissions.map(a=>credentials[a.symbol].key);
  if(new Set(keys).size!==keys.length)throw Error('TEACHER: pupil accounts must be separate');
  return true;
}
export async function start(){
  const directory=process.env.TEACHER_PRIVATE_DIR;
  if(!directory||!path.isAbsolute(directory))throw Error('TEACHER: private absolute journal directory required');
  const admissions=JSON.parse(await fs.readFile(path.join(directory,'admissions.json'),'utf8'));
  const credentials=parse(process.env.TEACHER_PAPER_CREDENTIALS_JSON,'paper-account credentials');
  const enabled=process.env.TEACHER_PAPER_ENABLED==='true';
  reviewConfiguration({admissions,credentials,enabled,approval:process.env.TEACHER_RELEASE_APPROVED});
  const broker=new CryptoTeacherBroker({credentials});
  const journal=new TeacherJournal(directory);
  await journal.init();
  if(journal.unresolved().length)throw Error('TEACHER: broker intents require manual reconciliation before restart');
  // Verify all account IDs unique and no pre-existing manual holdings/orders at startup.
  const ids=new Set();
  for(const a of admissions){
    const [account,positions,orders]=await Promise.all([
      broker.account(a.symbol),broker.positions(a.symbol),broker.openOrders(a.symbol)]);
    if(!account.id||ids.has(account.id))throw Error('TEACHER: shared or missing paper account identity');
    ids.add(account.id);
    const known=await journal.orderIds(a.symbol);
    if(orders.some(o=>o.symbol!==a.symbol||!known.has(o.client_order_id)))
      throw Error('TEACHER: unknown outstanding order at startup');
    if(positions.some(p=>p.symbol!==a.symbol||Number(p.qty)<0))
      throw Error('TEACHER: foreign paper position at startup');
    for(const p of positions){
      if(!await broker.ownedPosition(a.symbol,known,Number(p.qty)))
        throw Error('TEACHER: restart position cannot be attributed to examiner');
    }
    if(!journal.events.some(e=>e.type==='EQUITY'&&e.symbol===a.symbol))
      await journal.observe(a.symbol,Number(account.equity));
  }
  const teacher=new Teacher({broker,journal,admissions,paperEnabled:enabled});
  console.log('TEACHER '+RELEASE+' '+(enabled?'PAPER ARMED':'DRY_RUN')+
    ' pupils='+admissions.map(a=>a.symbol).join(',')+'; no live broker');
  // Never publish write endpoints. An operational machine needs OS supervision,
  // backup, monitoring and a tested kill switch; SIGTERM exits before next cycle.
  let running=true;
  process.on('SIGTERM',()=>{running=false;});
  process.on('SIGINT',()=>{running=false;});
  while(running){
    for(const a of admissions){
      if(!running)break;
      try{
        const result=await teacher.cycle(a.symbol);
        await journal.add('CYCLE',{symbol:a.symbol,status:result.status});
        if(result.status!=='NO_NEW_CANDLE')console.log(a.symbol,result.status);
      }catch(e){
        console.error('TEACHER HALTED:',a.symbol,String(e.message));
        await journal.add('HALT',{symbol:a.symbol,reason:String(e.message)});
        throw e; // fail closed; manual restart and review mandatory
      }
    }
    if(running)await delay(60_000);
  }
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href)
  start().catch(e=>{console.error('Teacher stopped:',e.message);process.exitCode=1;});
