/** Keyless sample intake CLI. Reads a downloaded file, NEVER fetches a broker/API. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {intakeXauSample} from '../academy/source-intake.mjs';
export async function runXauIntake(rawFile,normalisedCsv,manifestFile){
 if(!rawFile||!normalisedCsv||!manifestFile)throw Error('Usage: node scripts/intake-xau-sample.mjs <source.csv> <normalised.csv> <provenance.json>');
 const paths=[rawFile,normalisedCsv,manifestFile].map(resolve);
 if(new Set(paths).size!==3)throw Error('Source and output paths must be different');
 const {csv,manifest}=intakeXauSample(await readFile(paths[0],'utf8'));
 await mkdir(dirname(paths[1]),{recursive:true});
 await mkdir(dirname(paths[2]),{recursive:true});
 await writeFile(paths[1],csv,{flag:'wx'});
 await writeFile(paths[2],JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {source:manifest.source,rawSha256:manifest.rawSha256,normalisedSha256:manifest.normalizedSha256,
  bars:manifest.rows,first:manifest.first,last:manifest.last,sourceVerified:manifest.originVerified,
  brokerOrders:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 runXauIntake(process.argv[2],process.argv[3],process.argv[4]).then(x=>console.log(JSON.stringify(x,null,2)))
  .catch(e=>{console.error('ACADEMY_XAU_INTAKE_FAILED:',e.message);process.exitCode=1;});