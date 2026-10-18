import {createHmac,timingSafeEqual} from 'node:crypto';
import {freezeAdmission} from './engine.mjs';
const context='ACADEMY-TEACHER-ADMISSION-V2';
const mac=(value,secret)=>createHmac('sha256',secret).update(context)
 .update(JSON.stringify(value)).digest('hex');
export function signAdmission(record,secret){
 if(typeof secret!=='string'||secret.length<48)throw Error('SEAL: key is missing');
 if(!record?.admission||!record?.audit)throw Error('SEAL: audit missing');
 return {...record,serverProof:mac({admission:record.admission,audit:record.audit},secret)};
}
export function verifyAdmission(record,secret){
 if(typeof secret!=='string'||secret.length<48)throw Error('SEAL: key missing');
 if(!record?.admission||!record?.audit||!/^[a-f0-9]{64}$/.test(record.serverProof||''))
  throw Error('SEAL: unsigned admission');
 const expected=Buffer.from(mac({admission:record.admission,audit:record.audit},secret),'hex');
 const received=Buffer.from(record.serverProof,'hex');
 if(received.length!==expected.length||!timingSafeEqual(expected,received))
  throw Error('SEAL: changed admission or audit');
 const p=record.admission,a=record.audit;
 const pupil={symbol:p.symbol,researchLeader:{
  sourceExperimentId:p.experimentId,parameters:p.parameters,
  trainingNetGbp:1,trainingClosedTrades:30,outOfSampleVerified:false,
  trainedThrough:a.windowStart
 }};
 const rebuilt=freezeAdmission(pupil,a,p.startedAt);
 if(rebuilt.fingerprint!==p.fingerprint)throw Error('SEAL: model fingerprints disagree');
 return p;
}
