/** Private offline PLI v2: no network, credential or brokerage imports. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {parseDiscoveryCSV} from '../academy/opportunity-discovery.mjs';
import {researchContextualLevels} from '../academy/price-level-intelligence-v2.mjs';
export async function runContextualResearch(inputPath,{symbol='XAUUSD',timeframe='15Min',outputDir}={}){
 if(!inputPath||!outputDir)throw Error('Usage: node scripts/research-contextual-levels.mjs XAUUSD 15Min input.csv private_out_dir');
 const input=resolve(inputPath),out=resolve(outputDir);
 if(input===out||out.startsWith(input+'/'))throw Error('Do not place outputs beneath input path');
 const raw=await readFile(input,'utf8'),sha=createHash('sha256').update(raw).digest('hex');
 const bars=parseDiscoveryCSV(raw.replace(/^(\uFEFF)?datetime,/i,'time,'),{timeframe});
 const {model,report,memory}=researchContextualLevels({bars,symbol,timeframe,sourceSha256:sha});
 await mkdir(out,{recursive:true});
 const prefix=join(out,`PLI-V2-${symbol}-${timeframe}-${sha.slice(0,16)}`);
 await writeFile(prefix+'-model.json',JSON.stringify(model,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 await writeFile(prefix+'-fit-memory.json',JSON.stringify(memory,null,2)+'\n',{flag:'wx'});
 return {report,modelSha256:report.modelSha256};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 runContextualResearch(process.argv[4],{symbol:process.argv[2],timeframe:process.argv[3],outputDir:process.argv[5]})
  .then(r=>console.log(JSON.stringify(r.report,null,2)))
  .catch(e=>{console.error('PLI_V2_RESEARCH_FAILED:',e.message);process.exitCode=1;});
}
