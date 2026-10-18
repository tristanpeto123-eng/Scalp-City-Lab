// Private operator-only admission process. GET data, sign historical screening
// only when it actually passes; it NEVER places paper orders.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DailyGBPReference} from './fx-reference.mjs';
import {auditCandidate,issueAdmission} from './auditor.mjs';
import {signAdmission} from './admission-seal.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function screen({memory,research,dataDir,fx,now=Date.now(),
  read=fs.readFile,admit=false,secret}={}){
  if(!memory||!Array.isArray(research?.pupils)||!fx)
    throw Error('AUDITOR: independent memory, candidates and FX required');
  const reports=[],signed=[];
  for(const pupil of research.pupils){
    const file=path.join(dataDir,pupil.symbol.replace('/','-')+'.json');
    const snapshot=JSON.parse(await read(file,'utf8'));
    try{
      const outcome=auditCandidate({memory,snapshot,pupil,fx,now});
      reports.push({symbol:pupil.symbol,ready:outcome.gate.ready,
        reasons:outcome.gate.reasons,unseenCandles:outcome.counts.unseenCandles,
        holdoutNetGbp:outcome.audit.netGbp,
        doubledCostNetGbp:outcome.audit.doubleCostNetGbp});
      if(outcome.gate.ready&&admit){
        const examStartedAt=new Date(now+60000).toISOString();
        signed.push(signAdmission(issueAdmission({
          memory,snapshot,pupil,fx,examStartedAt,now}),secret));
      }
    }catch(e){reports.push({symbol:pupil.symbol,ready:false,
      reasons:[String(e.message||e).slice(0,160)]});}
  }
  return {reports,signed,
    warning:'Readiness means HISTORICAL screening passed; live paper order activation is a separate exact owner approval'};
}
async function main(){
  const privateDir=process.env.TEACHER_PRIVATE_DIR;
  if(!privateDir||!path.isAbsolute(privateDir))
    throw Error('AUDITOR: private absolute directory required');
  const memory=JSON.parse(await fs.readFile(
    process.env.TEACHER_MEMORY_FILE||path.join(privateDir,'research-memory.json'),'utf8'));
  const research=JSON.parse(await fs.readFile(
    path.join(root,'../research-data/robot-academy.json'),'utf8'));
  const fx=await new DailyGBPReference().on(new Date().toISOString());
  const admit=process.env.TEACHER_ISSUE_ADMISSIONS==='true';
  const results=await screen({memory,research,
    dataDir:path.join(root,'../validation-data'),fx,admit,
    secret:admit?process.env.TEACHER_ADMISSION_SIGNING_SECRET:null});
  console.log('Independent historical teacher screenings',
    JSON.stringify(results.reports,null,2));
  if(admit&&results.signed.length){
    const target=path.join(privateDir,'admissions.json');
    const previous=await fs.readFile(target,'utf8').catch(e=>
      e.code==='ENOENT'?null:Promise.reject(e));
    if(previous)throw Error('AUDITOR: existing signed admissions need explicit human review');
    await fs.writeFile(target,JSON.stringify(results.signed,null,2)+'\n',
      {flag:'wx',mode:0o600});
    console.log('ISSUED',results.signed.length,'new signed HISTORICAL admissions; paper orders remain OFF');
  }else console.log('NO_ADMISSIONS_ISSUED',results.signed.length);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error('AUDITOR BLOCKED',e.message);process.exitCode=1;});
