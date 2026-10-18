// Daily official-reference data redistributed via Frankfurter (read-only).
const API='https://api.frankfurter.dev/v1/';
export class DailyGBPReference {
  constructor({fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
    this.fetchImpl=fetchImpl;this.now=now;this.cache=new Map();
  }
  async on(instant){
    const ms=Date.parse(instant);
    if(!Number.isFinite(ms)||ms>this.now())throw Error('FX invalid/future date');
    const day=new Date(ms).toISOString().slice(0,10);
    if(this.cache.has(day))return this.cache.get(day);
    const response=await this.fetchImpl(API+day+'?base=USD&symbols=GBP',{
      method:'GET',redirect:'error',cache:'no-store',
      signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('FX HTTP '+response.status);
    const data=await response.json(),rate=data?.rates?.GBP;
    if(data?.base!=='USD'||!Number.isFinite(rate)||rate<=0||
       typeof data.date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data.date)||
       Date.parse(data.date+'T00:00:00Z')>ms||
       ms-Date.parse(data.date+'T00:00:00Z')>5*86400_000)
      throw Error('FX missing/stale trusted reference rate');
    const reference=Object.freeze({source:'FRANKFURTER_ECB_REFERENCE',date:data.date,
      gbpPerUsd:rate,requestedDay:day,
      type:'DAILY_REFERENCE_NOT_TRANSACTION_RATE'});
    this.cache.set(day,reference);
    return reference;
  }
}
