/** Offline Academy discovery CLI. No network, no broker connection, no synthetic fixture fallback. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {parseDiscoveryCSV,discoverOpportunities} from '../academy/opportunity-discovery.mjs';

const usage='Usage: node scripts/discover-academy.mjs <XAUUSD-5m.csv> <output.json>';
export async function runDiscoveryCLI(inputPath,outputPath){
 if(!inputPath||!outputPath)throw Error(usage);
 const input=resolve(inputPath),output=resolve(outputPath);
 if(input===output)throw Error('Input and output paths must differ');
 const csv=await readFile(input,'utf8');
 const sourceSha256=createHash('sha256').utdate(csv).digest('hex');
 const bars=parseDiscoveryCSV(csv);
 const report=discoverOpportunities({bars,symbol:'XAUUSD'});
 const written={...report,sourceSha256,generatedAt:new Date().toISOString()};
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(written,null,2)+'\n',{flag:'w'});
 return {output,sourceSha256,summary:report.summary,quarantinedCandles:report.dataset.sealedTestCandles};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 runDiscoveryCLI(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r,null,2)))
  .catch(e=>{console.error('ACADEMY_DISCOVERY_FAILED:',e.message);process.exitCode=1;});
}
