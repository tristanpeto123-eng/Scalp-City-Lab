// Public READ-ONLY academy/Teacher client contract.
// Never imported by the private broker runtime. No credentials or POST calls.
export const PAIRS=Object.freeze(['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD',
 'AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD']);
const sha=/^[a-f0-9]{64}$/;
export function checkResearch(payload){
 if(payload?.schema!=='ROBOT_ACADEMY_RESEARCH_V1'||
    payload.source!=='GITHUB_PERSISTED_HISTORICAL_TRAINING'||
    payload.sourcePolicy!=='GBP50-PROFIT2000-v2'||
    payload.verifiedForwardGrades!==0||payload.actualBrokerOrders!==0||
    !sha.test(payload.sourceDigest||'')||!Array.isArray(payload.pupils)||
    payload.pupils.length!==10)throw Error('Academy research provenance invalid');
 const seen=new Set();
 for(const row of payload.pupils){
   if(!PAIRS.includes(row?.symbol)||seen.has(row.symbol)||
      row.source!=='HISTORICAL_TRAINING_RESEARCH'||
      row.confirmedForward!==false||row.verifiedForwardTrades!==0||
      row.championModel!==null)throw Error('Academy research identity or verification invalid');
   seen.add(row.symbol);
   const leader=row.researchLeader;
   if(leader&&(!Number.isInteger(leader.trainingClosedTrades)||
      leader.trainingClosedTrades<0||
      !Number.isFinite(leader.trainingWinRatePct)||
      leader.trainingWinRatePct<0||leader.trainingWinRatePct>100||
      !Number.isFinite(leader.trainingNetGbp)||
      typeof leader.name!=='string'||leader.name.length>100||
      leader.outOfSampleVerified!==false))
     throw Error('Invalid historical research leader');
 }
 return payload;
}
export function checkSignedReport(payload,now=Date.now()){
 const at=Date.parse(payload?.generatedAt);
 if(payload?.schema!=='ROBOT_ACADEMY_SIGNED_FORWARD_V1'||
    payload.source!=='SERVER_VERIFIED_ALPACA_PAPER'||payload.paperOnly!==true||
    !Array.isArray(payload.pupils)||payload.pupils.length>10||
    !Number.isInteger(payload.verifiedCount)||payload.verifiedCount<0||
    !Number.isFinite(at)||at>now+300000||now-at>36*3600_000)
   throw Error('Authenticated report schema/time invalid');
 const seen=new Set(),grades=new Map(),statuses=new Map();
 for(const row of payload.pupils){
   if(!PAIRS.includes(row?.symbol)||seen.has(row.symbol))
     throw Error('Signed pupil identity invalid or duplicated');
   seen.add(row.symbol);
   if(row.status==='VERIFIED_FORWARD_GRADE'){
     const expected=Math.min(10,Math.floor((100*row.wins/row.closedTrades+1e-8)/10));
     if(!Number.isInteger(row.closedTrades)||row.closedTrades<30||
        !Number.isInteger(row.wins)||row.wins<0||row.wins>row.closedTrades||
        !Number.isInteger(row.grade)||row.grade!==expected||
        !Number.isFinite(row.netProfitGbp)||
        !Number.isFinite(row.maxDrawdownPct)||row.maxDrawdownPct<0||
        row.maxDrawdownPct>100||
        typeof row.qualified!=='boolean'||
        row.qualified!==(row.netProfitGbp>0&&row.maxDrawdownPct<=10)||
        !sha.test(row.evidenceHash||'')||
        typeof row.modelId!=='string'||!row.modelId)
       throw Error('Signed pupil grade arithmetic/evidence invalid');
     grades.set(row.symbol,row);
   }else if(row.status!=='EVIDENCE_PENDING'&&row.status!=='FORWARD_TESTING')
     throw Error('Unrecognized signed examination status');
   statuses.set(row.symbol,row);
 }
 if(grades.size!==payload.verifiedCount)
   throw Error('Signed grade tally inconsistent');
 return {payload,grades,statuses,generatedAt:at};
}
const b64bytes=x=>{
 if(typeof x!=='string'||x.length>8192||!x.length)
   throw Error('Missing signature/key');
 const text=x.replace(/-/g,'+').replace(/_/g,'/');
 if(typeof atob==='function')return Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 throw Error('Base64 decoding unavailable');
};
async function getJson(fetchImpl,url){
 const response=await fetchImpl(url,{method:'GET',cache:'no-store',credentials:'omit',
   redirect:'error',headers:{Accept:'application/json'}});
 if(!response.ok)throw Error('Read-only source HTTP '+response.status);
 return response.json();
}
export async function readResearch({fetchImpl=globalThis.fetch,
    baseUrl='https://tristanpeto123-eng.github.io/Scalp-City-Lab/'}={}){
 return checkResearch(await getJson(fetchImpl,new URL('./research-data/robot-academy.json',baseUrl).href));
}
export async function readSignedPaperFeed({
 fetchImpl=globalThis.fetch,webcrypto=globalThis.crypto,
 baseUrl='https://tristanpeto123-eng.github.io/Scalp-City-Lab/',
 now=Date.now()}={}){
 const settings=await getJson(fetchImpl,new URL('./teacher/public-settings.json',baseUrl).href);
 if(settings?.schema!=='ROBOT_ACADEMY_PUBLIC_SETTINGS_V1'||
    settings.status!=='CONFIGURED'||typeof settings.feedUrl!=='string'||
    typeof settings.signingPublicKeyBase64!=='string')
   throw Error('SIGNED_FEED_NOT_PROVISIONED');
 const target=new URL(settings.feedUrl,baseUrl);
 if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash)
   throw Error('Signed feed URL must be credential-free HTTPS');
 if(!webcrypto?.subtle)throw Error('Ed25519 verifier unavailable');
 const bundle=await getJson(fetchImpl,target.href);
 if(bundle?.algorithm!=='Ed25519'||!bundle.payload||
    typeof bundle.signature!=='string')throw Error('Unsigned examination response');
 const key=await webcrypto.subtle.importKey('spki',
   b64bytes(settings.signingPublicKeyBase64),'Ed25519',false,['verify']);
 const bytes=new TextEncoder().encode(JSON.stringify(bundle.payload));
 if(!await webcrypto.subtle.verify('Ed25519',key,b64bytes(bundle.signature),bytes))
   throw Error('Examiner signature did not match pinned public key');
 return checkSignedReport(bundle.payload,now);
}

// Hosting connectivity does NOT establish Alpaca broker connectivity.
export async function readHostingConnection({
 fetchImpl=globalThis.fetch,
 baseUrl='https://tristanpeto123-eng.github.io/Scalp-City-Lab/'}={}){
 const settings=await getJson(fetchImpl,new URL('./teacher/public-settings.json',baseUrl).href);
 if(settings?.schema!=='ROBOT_ACADEMY_PUBLIC_SETTINGS_V1'||
    settings.status!=='CONFIGURED'||typeof settings.connectionUrl!=='string'||
    typeof settings.feedUrl!=='string')
   throw Error('PAPER_HOST_NOT_CONFIGURED');
 const target=new URL(settings.connectionUrl,baseUrl);
 const feed=new URL(settings.feedUrl,baseUrl);
 if(target.protocol!=='https:'||target.username||target.password||target.search||
    target.hash||target.origin!==feed.origin||target.pathname!=='/api/connection')
   throw Error('PAPER_HOST_UNTRUSTED_URL');
 const status=await getJson(fetchImpl,target.href);
 if(status?.schema!=='TEACHER_PUBLIC_CONNECTION_V1'||
    status.signerPinned!==true||status.privateExaminerLinked!==true||
    typeof status.examinerStatus!=='string'||typeof status.paperOrdersEnabled!=='boolean')
   throw Error('PAPER_HOST_PRIVATE_HANDSHAKE_FAILED');
 const a=status.paperAccounts;
 if(a!==undefined&&(a?.schema!=='TEACHER_PAPER_ACCOUNTS_PUBLIC_V1'||
    !Number.isInteger(a.required)||a.required!==3||a.academyPupils!==PAIRS.length||
    !Number.isInteger(a.configured)||a.configured<0||a.configured>10||
    !Number.isInteger(a.checked)||a.checked<0||a.checked>10||
    !Number.isInteger(a.passed)||a.passed<0||a.passed>a.checked||
    typeof a.status!=='string'||typeof a.allPassed!=='boolean'))
   throw Error('PAPER_ACCOUNT_STATUS_INVALID');
 return Object.freeze({
   hosted:true,signerPinned:true,privateExaminerLinked:true,
   examinerStatus:status.examinerStatus,
   paperOrdersEnabled:status.paperOrdersEnabled,
   brokerExaminationProven:false,
   paperAccounts:a?Object.freeze({
     status:a.status,configured:a.configured,checked:a.checked,academyPupils:a.academyPupils,
     passed:a.passed,required:a.required,allPassed:a.allPassed,
     checkedAt:a.checkedAt||null
   }):null
 });
}
