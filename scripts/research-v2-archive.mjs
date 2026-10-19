// SCALP V2 read-only, tamper-evident chronological archive.
// Retains older overlapping snapshots rather than silently rolling them away.
// No broker network, secrets, orders or admissions.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkSnapshot} from '../strategy-validation-core.mjs';

const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function candle(b){return [b.t,b.o,b.h,b.l,b.c,b.v];}
function requireCompatible(older,newer){
  if(older.symbol!==newer.symbol||older.timeframe!==newer.timeframe||
     older.source!==newer.source||older.feed!==newer.feed)
    throw Error('ARCHIVE: incompatible instrument or data source');
}
export function mergeVerifiedHistory(older,newer,now=Date.now()){
  checkSnapshot(newer,newer.symbol,now);
  if(!older)return {...newer,bars:newer.bars.slice()};
  checkSnapshot(older,older.symbol,now);
  requireCompatible(older,newer);
  const a=older.bars,b=newer.bars;
  const map=new Map(a.map(x=>[x.t,x]));
  let overlapping=0,inserted=0;
  for(const item of b){
    const existing=map.get(item.t);
    if(existing){
      overlapping++;
      if(digest(candle(existing))!==digest(candle(item)))
        throw Error('ARCHIVE: historical candle mutation detected at '+item.t);
    }else{map.set(item.t,item);inserted++;}
  }
  if(overlapping===0)throw Error('ARCHIVE: no common candles; cannot prove continuity');
  const bars=[...map.values()].sort((x,y)=>Date.parse(x.t)-Date.parse(y.t));
  if(bars.length>20000)throw Error('ARCHIVE: exceeds 20,000-bar validator limit; shard by epoch before continuing');
  const result={...newer,bars,archivalSource:'SCALP_V2_APPEND_ONLY',
    firstArchivedAt:older.firstArchivedAt||older.generatedAt,
    archivedThrough:newer.generatedAt};
  checkSnapshot(result,result.symbol,now);
  return result;
}
export async function syncArchive({root,snapshot,now=Date.now()}={}){
  if(!root||!path.isAbsolute(root))throw Error('ARCHIVE: private absolute archive root required');
  const symbol=snapshot?.symbol;
  checkSnapshot(snapshot,symbol,now);
  const folder=path.join(root,symbol.replace('/','-'));
  const pointer=path.join(folder,'latest.json');
  await mkdir(folder,{recursive:true});
  const priorPointer=await readFile(pointer,'utf8').then(JSON.parse).catch(e=>
    e.code==='ENOENT'?null:Promise.reject(e));
  let previous=null;
  if(priorPointer){
    const raw=JSON.parse(await readFile(path.join(folder,priorPointer.file),'utf8'));
    if(digest(raw)!==priorPointer.sha256)throw Error('ARCHIVE: prior immutable digest mismatch');
    previous=raw;
  }
  const merged=mergeVerifiedHistory(previous,snapshot,now);
  const sha=digest(merged),file='data-'+sha+'.json';
  const location=path.join(folder,file);
  const existing=await readFile(location,'utf8').catch(e=>e.code==='ENOENT'?null:Promise.reject(e));
  if(existing&&digest(JSON.parse(existing))!==sha)throw Error('ARCHIVE: existing immutable object changed');
  if(!existing)await writeFile(location,JSON.stringify(merged)+'\n',{flag:'wx',mode:0o600});
  const record={schema:'SCALP_ARCHIVE_V2',symbol,file,sha256:sha,
    previousManifestSha256:priorPointer?digest(priorPointer):null,
    priorArchiveSha256:priorPointer?.sha256||null,
    firstBar:merged.bars[0].t,lastBar:merged.bars.at(-1).t,
    candles:merged.bars.length,source:merged.source,recordedAt:new Date(now).toISOString()};
  const manifest='manifest-'+digest(record)+'.json';
  await writeFile(path.join(folder,manifest),JSON.stringify(record,null,2)+'\n',
    {flag:'wx',mode:0o600}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  // Atomic pointer, not evidence: immutable manifest and candle files remain available.
  const tmp=pointer+'.tmp-'+process.pid;
  await writeFile(tmp,JSON.stringify({...record,manifest})+'\n',{mode:0o600});
  await rename(tmp,pointer);
  return {symbol,file:location,manifest:path.join(folder,manifest),digest:sha,
    candles:merged.bars.length,previousDigest:record.priorArchiveSha256,
    orderCount:0,releaseApproved:false};
}
async function main(){
  const [root,inputDir]=process.argv.slice(2);
  if(!root||!inputDir)throw Error('USAGE: node scripts/research-v2-archive.mjs <absolute-private-root> <snapshot-dir>');
  const {PAIRS}=await import('../strategy-validation-core.mjs');
  for(const symbol of PAIRS){
    const s=JSON.parse(await readFile(path.join(inputDir,symbol.replace('/','-')+'.json'),'utf8'));
    const result=await syncArchive({root,snapshot:s});
    console.log('ARCHIVED '+JSON.stringify(result));
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error('ARCHIVE_BLOCKED',String(e.message||e));process.exitCode=1;});
