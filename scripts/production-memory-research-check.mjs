// Read-only reproduction of production research against the actual saved history.
// No GitHub token, private broker keys, POST or persistence permitted.
import {readFile} from 'node:fs/promises';
import {checkMemory,evaluateAll} from './run-robot-training.mjs';
const file=process.argv[2]||'ci-memory/scalp-learning/history.json';
let step='READ';
try {
 const text=await readFile(file,'utf8');
 const memory=JSON.parse(text);
 step='CHECK_MEMORY';
 checkMemory(memory);
 console.log('RESEARCH_STACK_STAGE',JSON.stringify({
  step:'CHECK_MEMORY',experiments:memory.experiments.length,bytes:Buffer.byteLength(text)}));
 step='EVALUATE_ALL';
 const result=await evaluateAll({
  memory,dataDir:'validation-data',batchesPerPupil:3,now:Date.now()});
 if(result.brokerOrders!==0||result.independentForwardEvidence!==0||
    result.reports.length!==10)throw Error('Research safety contract violated');
 console.log('RESEARCH_STACK_STAGE',JSON.stringify({
  step:'EVALUATE_ALL',newExperiments:result.addedExperiments,
  experiments:result.memory.experiments.length,brokerOrders:0,
  reports:result.reports.map(r=>({symbol:r.symbol,status:r.status,
    attempted:r.researchBatchesAttempted,newCandles:r.newTrainingCandles}))}));
 step='PERSISTENCE_SERIALIZATION';
 // Only serialize in memory — no tokens or GitHub API writes.
 const serialized=JSON.stringify(result.memory,null,2)+'\n';
 const base64=Buffer.from(serialized,'utf8').toString('base64');
 if(Buffer.from(base64,'base64').toString('utf8')!==serialized)
  throw Error('Saved research bytes failed roundtrip');
 console.log('RESEARCH_STACK_STAGE',JSON.stringify({step:'PERSISTENCE_SERIALIZATION',
  encodedBytes:Buffer.byteLength(base64),safe:true,noBrokerOrders:true}));
} catch(error) {
 console.error('RESEARCH_STACK_BLOCKED',JSON.stringify({step,
  error:String(error?.message||error),stack:String(error?.stack||'').slice(0,7000)}));
 process.exitCode=1;
}
