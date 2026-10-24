import assert from 'node:assert/strict';
import {saveSLChartCache,loadSLChartCache,prepareSLChartCache,verifySLChartCache} from './sl-chart-cache.mjs';
const start=Date.parse('2026-08-12T00:00:00Z'),now=Date.parse('2026-09-01T00:00:00Z');
const bars=Array.from({length:240},(_,i)=>({
 t:new Date(start+i*300000).toISOString(),
 o:2400+i*.01,h:2401+i*.01,l:2399+i*.01,c:2400.4+i*.01,v:i
}));
const sample=prepareSLChartCache({market:'FOREX',symbol:'EURUSD',bars,
 source:'USER_IMPORTED_UNVERIFIED_5MIN',now});
assert.equal(sample.count,240);
assert.equal(sample.firstBar,bars[0].t);
assert.deepEqual(verifySLChartCache(sample),sample);
assert.throws(()=>verifySLChartCache({...sample,apiKey:'should-never-persist'}),/unsupported field/);
assert.throws(()=>verifySLChartCache({...sample,symbol:'XAUUSD'}),/another market/);
assert.throws(()=>prepareSLChartCache({market:'CRYPTO',symbol:'BTCUSD',bars,
 source:'USER_IMPORTED_UNVERIFIED_5MIN',now}),/market/);
assert.throws(()=>prepareSLChartCache({market:'FOREX',symbol:'EURUSD',bars,
 source:'SYNTHETIC_DEMO',now}),/source/);
const database=new Map();
const factory={open(){
 const request={result:null,error:null};
 queueMicrotask(()=>{
  request.result={
   objectStoreNames:{contains:()=>true},
   createObjectStore:()=>{},
   transaction(table,mode){
    const transaction={};
    transaction.objectStore=()=>({
     get(key){
      const request={result:null};
      queueMicrotask(()=>{
       request.result=database.has(key)?structuredClone(database.get(key)):undefined;
       request.onsuccess?.();
       queueMicrotask(()=>transaction.oncomplete?.());
      });
      return request;
     },
     put(record){
      const request={result:null};
      queueMicrotask(()=>{
       database.set(record.id,structuredClone(record));
       request.result=record.id;
       request.onsuccess?.();
       queueMicrotask(()=>transaction.oncomplete?.());
      });
      return request;
     }
    });
    return transaction;
   },
   close(){}
  };
  request.onsuccess?.();
 });
 return request;
}};
const noData=await loadSLChartCache({market:'FOREX',symbol:'EURUSD',factory,now});
assert.equal(noData,null);
const saved=await saveSLChartCache({market:'FOREX',symbol:'EURUSD',
 bars,source:'USER_IMPORTED_UNVERIFIED_5MIN',factory,now});
assert.equal(saved.count,240);
assert.equal(saved.source,'USER_IMPORTED_UNVERIFIED_5MIN');
const restored=await loadSLChartCache({market:'FOREX',symbol:'EURUSD',factory,now});
assert.deepEqual(restored.bars,bars);
assert.equal(await loadSLChartCache({market:'COMMODITIES',symbol:'XAUUSD',factory,now}),null);
const net=await saveSLChartCache({market:'FOREX',symbol:'EURUSD',
 bars,source:'TWELVEDATA_PROVIDER_REPORTED_UNVERIFIED',providerSymbol:'EUR/USD',
 factory,now:now+1000});
assert.equal(net.source,'TWELVEDATA_PROVIDER_REPORTED_UNVERIFIED');
assert.equal(net.providerSymbol,'EUR/USD');
assert.equal(database.size,1,'same-symbol data replaces previous copy');
database.set('FOREX:EURUSD',{...net,token:'forbidden'});
await assert.rejects(loadSLChartCache({market:'FOREX',symbol:'EURUSD',factory,now}),
 /unsupported field/);
await assert.rejects(loadSLChartCache({market:'FOREX',symbol:'EURUSD',factory:null,now}),
 /unavailable/);
console.log('SL CHART CACHE PASS: full 5m OHLC persistence, read-back, market separation, metadata integrity, source provenance, credential exclusion');