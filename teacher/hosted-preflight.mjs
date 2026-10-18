// Read-only PAPER account commissioning. Never logs secrets, broker account IDs,
// or places any order; designed to run after Railway securely injects variables.
import {PAIRS} from '../strategy-validation-core.mjs';
import {CryptoTeacherBroker} from './alpaca-crypto.mjs';
import {preflightPaper} from './paper-preflight.mjs';
const own=Object.prototype.hasOwnProperty;
const INITIAL=()=>({
 schema:'TEACHER_PAPER_ACCOUNTS_PUBLIC_V1',
 status:'NOT_CONFIGURED',required:PAIRS.length,configured:0,checked:0,passed:0,
 allPassed:false,checks:[],checkedAt:null,operation:'READ_ONLY_GET',paperOrdersEnabled:false
});
export function initialPaperStatus(){return INITIAL();}
export async function inspectPaperAccounts({
 raw,brokerFactory,now=()=>new Date()
}={}){
 const reply=INITIAL();
 if(!raw)return reply;
 let credentials;
 try{credentials=JSON.parse(raw);}
 catch{return {...reply,status:'INVALID_JSON'};}
 if(!credentials||typeof credentials!=='object'||Array.isArray(credentials)||
   Object.keys(credentials).some(p=>!PAIRS.includes(p)))
   return {...reply,status:'INVALID_SYMBOL_MAPPING'};
 const valid=[];
 for(const symbol of PAIRS){
   if(!own.call(credentials,symbol))continue;
   const c=credentials[symbol];
   if(!c||typeof c!=='object'||Array.isArray(c)||
      typeof c.key!=='string'||typeof c.secret!=='string'||
      !c.key.trim()||!c.secret.trim())
      return {...reply,status:'INVALID_ACCOUNT_ENTRY'};
   valid.push(symbol);
 }
 reply.configured=valid.length;
 if(!valid.length)return reply;
 if(new Set(valid.map(p=>credentials[p].key)).size!==valid.length)
   return {...reply,status:'DUPLICATED_CREDENTIALS'};
 const factory=brokerFactory||((items)=>new CryptoTeacherBroker({
   credentials:items,fetchImpl:(url,options)=>{
      if(options?.method!=='GET'||
         !url.startsWith('https://paper-api.alpaca.markets/'))
         throw Error('PREFLIGHT: no write or non-PAPER endpoint permitted');
      return fetch(url,options);
   }
 }));
 try{
   const report=await preflightPaper({broker:factory(credentials),symbols:valid});
   const checks=report.rows.map(r=>({
     symbol:r.symbol,
     passed:r.passed===true,
     result:r.passed===true?'PASS':'FAIL',
     // Do not publish raw broker responses, IDs, credential metadata or
     // unbounded provider errors. The fixed reason codes suffice for status.
     reasonCount:Array.isArray(r.reasons)?r.reasons.length:0
   }));
   const passed=checks.filter(x=>x.passed).length;
   const allPassed=valid.length===PAIRS.length&&report.allPassed===true&&passed===valid.length;
   return {...reply,status:allPassed?'ALL_ACCOUNTS_VERIFIED':
        valid.length<PAIRS.length?'PARTIAL_ACCOUNTS':
        passed===valid.length?'NEEDS_REVIEW':'SOME_ACCOUNTS_FAILED',
     checked:checks.length,passed,allPassed,
     checks,checkedAt:now().toISOString()};
 }catch{
   return {...reply,status:'READ_ONLY_CHECK_ERROR',
     checkedAt:now().toISOString()};
 }
}
