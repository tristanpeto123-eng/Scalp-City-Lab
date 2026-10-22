/** Free-tier, UNVERIFIED research evidence only. No brokerage or order authority. */
export const SCHEMA='SCALP_CF_RESEARCH_RECEIPT_V1';
export const GENESIS='0'.repeat(64);
export const MAX_EVENTS=512;
export const MAX_BODY_BYTES=4096;
export const MAX_SELF_CHECK=64;
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const SYMBOLS=new Set(['BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD']);

export function canonicalJson(value){
 if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
 if(value!==null&&typeof value==='object')
   return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
 return JSON.stringify(value);
}
export async function sha256(value){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
const KEYS=['eventId','schema','symbol','modelSha256','sourceRunSha256',
 'marketBarTimeframe','developmentEndCandleMs','developmentNetGbp',
 'stressedNetGbp','closedVirtualTrades','source',
 'paperOrders','liveOrders','officialGrades'];

export function validateResearchEvent(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_RECORD');
 if(Object.keys(value).length!==KEYS.length||
    Object.keys(value).some(k=>!KEYS.includes(k)))throw Error('UNAPPROVED_FIELDS');
 if(value.schema!==SCHEMA||!SYMBOLS.has(value.symbol)||
    !hex64(value.eventId)||!hex64(value.modelSha256)||
    !hex64(value.sourceRunSha256)||value.marketBarTimeframe!=='5Min'||
    !Number.isSafeInteger(value.developmentEndCandleMs)||
    value.developmentEndCandleMs<=0||
    value.developmentEndCandleMs%300000!==0||
    typeof value.developmentNetGbp!=='number'||!Number.isFinite(value.developmentNetGbp)||
    typeof value.stressedNetGbp!=='number'||!Number.isFinite(value.stressedNetGbp)||
    !Number.isSafeInteger(value.closedVirtualTrades)||value.closedVirtualTrades<0||
    value.closedVirtualTrades>100000||
    value.source!=='GITHUB_RESEARCH_UNVERIFIED'||
    value.paperOrders!==0||value.liveOrders!==0||value.officialGrades!==0)
   throw Error('UNTRUSTED_RESEARCH_EVENT');
 return Object.fromEntries(KEYS.map(k=>[k,value[k]]));
}
export async function validateEventId(record){
 const {eventId,...claims}=validateResearchEvent(record);
 return (await sha256(canonicalJson(claims)))===eventId;
}
export async function computeChainHash({seq,eventId,prevHash,createdAtMs}){
 return sha256(canonicalJson({schema:'SCALP_CF_APPEND_ONLY_SHA256_CHAIN_V1',
   seq,eventId,prevHash,createdAtMs}));
}
