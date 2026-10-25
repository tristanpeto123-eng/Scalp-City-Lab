/** Standalone offline Teacher CLI; no network or broker calls. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {trainAcademyTeacher} from '../academy/teacher-training.mjs';
export async function trainAcademyCLI(input,outputDir){
 if(!input||!outputDir)throw Error('Usage: node scripts/train-academy.mjs <discovery.json> <output-directory>');
 const discovery=JSON.parse(await readFile(resolve(input),'utf8'));
 const {checkpoint,report}=trainAcademyTeacher(discovery);
 const directory=resolve(outputDir);await mkdir(directory,{recursive:true});
 const model='academy-teacher-'+report.checkpointSha256+'.json';
 const results='academy-report-'+report.checkpointSha256+'.json';
 await writeFile(resolve(directory,model),JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
 await writeFile(resolve(directory,results),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return {model,results,checkpointSha256:report.checkpointSha256,developmentNetGbp:report.development.netGbp,brokerEnabled:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))
 trainAcademyCLI(process.argv[2],process.argv[3]).then(x=>console.log(JSON.stringify(x,null,2)))
  .catch(e=>{console.error('ACADEMY_TEACHER_FAILED:',e.message);process.exitCode=1;});