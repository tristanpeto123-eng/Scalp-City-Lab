/** Local, offline PLI evidence runner. Input CSV remains private. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseDiscoveryCSV} from '../academy/opportunity-discovery.mjs';
import {researchLevelTransitions} from '../academy/price-level-intelligence.mjs';
export async function runPriceLevelResearch(source,{symbol='XAUUSD',timeframe='15Min',outputDir}={}){
 if(!source||!outputDir)throw Error('Usage: node scripts/research-price-levels.mjs SYMBOL TIMEFRAME <private.csv> <private-output-dir>');
 const input=resolve(source),output=resolve(outputDir);
 if(input===output||output.startsWith(input+'/'))throw Error('Output must differ from input');
 const raw=await readFile(input,'utf8');
 const sourceSha256=createHash('sha256').update(raw).digest('hex');
 const bars=parseDiscoveryCSV(raw.replace(/^(\uFEFF)?datetime,/i,'time,'),{timeframe});
 const result=researchLevelTransitions({bars,symbol,timeframe,sourceSha256});
 const name=`PLI-${symbol}-${timeframe}-${sourceSha256.slice(0,16)}`;
 await mkdir(output,{recursive:true});
 // All 3 files are local/private. Refuse to overwrite a prior research experiment.
 await writeFile(join(output,name+'-report.json'),JSON.stringify(result.report,null,2)+'\n',{flag:'wx'});
 await writeFile(join(output,name+'-model.json'),JSON.stringify(result.model,null,2)+'\n',{flag:'wx'});
 await writeFile(join(output,name+'-fit-memory.json'),JSON.stringify(result.memory,null,2)+'\n',{flag:'wx'});
 return {name,sourceSha256,report:result.report};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 runPriceLevelResearch(process.argv[4],{symbol:process.argv[2],timeframe:process.argv[3],outputDir:process.argv[5]})
  .then(x=>console.log(JSON.stringify({experiment:x.name,report:x.report},null,2)))
  .catch(e=>{console.error('PLI_RESEARCH_FAILED',e.message);process.exitCode=1;});
}