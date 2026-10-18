// Railway two-service commissioning entrypoint, v0.2 PAPER ONLY.
// examiner: private network, durable volume, generated signer, no public domain.
// gateway: public HTTPS, verifies pinned signature, does not store Alpaca keys.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {start as startTeacher} from './runtime.mjs';
import {verifyReport} from './grade-pipeline.mjs';

const role=process.env.TEACHER_SERVICE_ROLE;
const port=Number(process.env.PORT||8080);
const version='ACADEMY-TEACHER-0.2.0-rc1';
const privateRoot=process.env.TEACHER_PRIVATE_DIR||'/data';
const allowed='https://tristanpeto123-eng.github.io';
const json=(res,code,body)=>{
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'Access-Control-Allow-Origin':allowed,'Vary':'Origin'});
  res.end(JSON.stringify(body));
};
const safeToken=(a,b)=>typeof a==='string'&&typeof b==='string'&&
  a.length>=32&&b.length>=32&&crypto.timingSafeEqual(
    crypto.createHash('sha256').update(a).digest(),
    crypto.createHash('sha256').update(b).digest());
async function readOrGenerate(name,generate){
 const filename=path.join(privateRoot,name);
 try{return await fs.readFile(filename,'utf8');}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const data=generate();
 try{await fs.writeFile(filename,data,{flag:'wx',mode:0o600});}
 catch(e){if(e.code!=='EEXIST')throw e;return fs.readFile(filename,'utf8');}
 return data;
}
async function startExaminer(){
 if(!path.isAbsolute(privateRoot))throw Error('EXAMINER: durable private absolute directory required');
 await fs.mkdir(privateRoot,{recursive:true,mode:0o700});
 const keyPem=process.env.TEACHER_PUBLISH_PRIVATE_KEY_PEM||
   await readOrGenerate('paper-signer.private.pem',()=>{
     const {privateKey}=crypto.generateKeyPairSync('ed25519');
     return privateKey.export({type:'pkcs8',format:'pem'});
   });
 const pub=crypto.createPublicKey(keyPem);
 if(pub.asymmetricKeyType!=='ed25519')throw Error('EXAMINER: Ed25519 signing key required');
 const publicSpki=pub.export({type:'spki',format:'der'}).toString('base64');
 const signingSecret=process.env.TEACHER_ADMISSION_SIGNING_SECRET||
   await readOrGenerate('admission.secret',()=>crypto.randomBytes(48).toString('hex'));
 process.env.TEACHER_PUBLISH_PRIVATE_KEY_PEM=keyPem;
 process.env.TEACHER_ADMISSION_SIGNING_SECRET=signingSecret.trim();
 process.env.TEACHER_PRIVATE_DIR=privateRoot;
 const expectedToken=process.env.TEACHER_INTERNAL_READ_TOKEN;
 if(!expectedToken||expectedToken.length<32)throw Error('EXAMINER: private internal authorization missing');
 // Public SPKI is safe to share, but never print private keys, broker credentials or admission secret.
 console.log('TEACHER_PUBLIC_SPKI_BASE64='+publicSpki);
 let examStatus='NOT_ADMITTED';
 if(process.env.TEACHER_ENABLE_EXAMINER==='true'){
   examStatus='STARTING';
   startTeacher().then(()=>{examStatus='STOPPED';}).catch(e=>{
     console.error('EXAMINER FAIL CLOSED:',String(e.message||e));
     process.exitCode=1;process.kill(process.pid,'SIGTERM');
   });
 }
 return http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/health')
    return json(res,200,{service:'private-paper-examiner',runtime:'RUNNING',
      examination:examStatus,version,paperOnly:true});
  const protectedRoute=req.url==='/internal/signed-report'||req.url==='/internal/status';
  if(req.method!=='GET'||!protectedRoute)
    return json(res,404,{error:'NOT_FOUND'});
  if(!safeToken(req.headers.authorization?.replace(/^Bearer /,''),
      expectedToken))return json(res,403,{error:'FORBIDDEN'});
  if(req.url==='/internal/status')
    return json(res,200,{schema:'TEACHER_PRIVATE_CONNECTION_V1',
      version,privateNetwork:true,publicSpki,examStatus,
      paperOrdersEnabled:process.env.TEACHER_PAPER_ENABLED==='true'&&
        process.env.TEACHER_ENABLE_EXAMINER==='true'});
  try{
   const doc=JSON.parse(await fs.readFile(path.join(privateRoot,'public-exam-report.json'),'utf8'));
   const payload=verifyReport(doc,pub);
   const at=Date.parse(payload.generatedAt),now=Date.now();
   if(payload.schema!=='ROBOT_ACADEMY_SIGNED_FORWARD_V1'||
      payload.source!=='SERVER_VERIFIED_ALPACA_PAPER'||payload.paperOnly!==true||
      !Number.isFinite(at)||at>now+300000||now-at>36*3600_000)
     throw Error('PAPER: stale, incorrect or unauthenticated report');
   return json(res,200,doc);
  }catch{return json(res,503,{status:'NO_VERIFIED_BROKER_EXAMINATION'});}
 }).listen(port,'0.0.0.0');
}
function startGateway(){
 const upstream=process.env.TEACHER_PRIVATE_REPORT_URL||'';
 const pinned=process.env.TEACHER_PUBLISH_PUBLIC_KEY_SPKI_BASE64||'';
 const token=process.env.TEACHER_INTERNAL_READ_TOKEN||'';
 if(!upstream.startsWith('http://')||!upstream.includes('.railway.internal:')||
    !/^[A-Za-z0-9+/=]{40,}$/.test(pinned)||token.length<32)
   throw Error('GATEWAY: private network URL, pinned public key and internal token required');
 const pub=crypto.createPublicKey({key:Buffer.from(pinned,'base64'),format:'der',type:'spki'});
 if(pub.asymmetricKeyType!=='ed25519')throw Error('GATEWAY: Ed25519 key required');
 return http.createServer(async(req,res)=>{
   if(req.method==='GET'&&req.url==='/health')
     return json(res,200,{service:'public-signed-paper-gateway',hosted:true,
       brokerAccountsVerified:false,version});
   if(req.method==='GET'&&req.url==='/api/connection'){
     try{
       const statusUrl=new URL(upstream);
       statusUrl.pathname='/internal/status';
       const response=await fetch(statusUrl,{method:'GET',redirect:'error',
         headers:{Authorization:'Bearer '+token},
         signal:AbortSignal.timeout(8000)});
       if(!response.ok)throw Error('Private examiner unreachable');
       const status=await response.json();
       if(status.schema!=='TEACHER_PRIVATE_CONNECTION_V1'||
          status.publicSpki!==pinned||status.privateNetwork!==true||
          status.version!==version)
          throw Error('Private examiner signing key mismatch');
       return json(res,200,{schema:'TEACHER_PUBLIC_CONNECTION_V1',
         signerPinned:true,privateExaminerLinked:true,
         examinerStatus:status.examStatus,paperOrdersEnabled:status.paperOrdersEnabled,
         version,feedStatus:'NO_VERIFIED_PAPER_RESULTS_UNTIL_PROVEN'});
     }catch{
       return json(res,503,{schema:'TEACHER_PUBLIC_CONNECTION_V1',
         signerPinned:false,privateExaminerLinked:false,
         paperOrdersEnabled:false,feedStatus:'PRIVATE_EXAMINER_UNAVAILABLE'});
     }
   }
   if(req.method!=='GET'||req.url!=='/api/academy')
     return json(res,404,{error:'NOT_FOUND'});
   try{
     const upstreamUrl=new URL(upstream);
     if(upstreamUrl.hostname.endsWith('.railway.internal')!==true||
        upstreamUrl.pathname!=='/internal/signed-report')
       throw Error('GATEWAY: untrusted upstream');
     const answer=await fetch(upstream,{method:'GET',redirect:'error',
       headers:{Authorization:'Bearer '+token,Accept:'application/json'},
       signal:AbortSignal.timeout(8000)});
     if(!answer.ok)throw Error('GATEWAY: authentic private report not published');
     const doc=await answer.json();
     const payload=verifyReport(doc,pub);
     const at=Date.parse(payload.generatedAt),now=Date.now();
     if(payload.schema!=='ROBOT_ACADEMY_SIGNED_FORWARD_V1'||
        payload.source!=='SERVER_VERIFIED_ALPACA_PAPER'||
        payload.paperOnly!==true||!Number.isFinite(at)||at>now+300000||
        now-at>36*3600_000)
       throw Error('GATEWAY: unverified or stale evidence');
     return json(res,200,doc);
   }catch{
     return json(res,503,{status:'PAPER_GRADE_NOT_COMMISSIONED',
       verifiedPaperGrades:0,paperOrdersEnabled:false});
   }
 }).listen(port,'0.0.0.0');
}
if(!Number.isInteger(port)||port<1||port>65535)throw Error('SERVICE: invalid PORT');
if(role==='examiner')await startExaminer();
else if(role==='gateway')startGateway();
else throw Error('SERVICE: unknown role; refuse to start');
