import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PAIRS,checkSnapshot} from '../strategy-validation-core.mjs';
import {fetchSnapshot,refreshAll,SNAPSHOT_DAYS} from './refresh-alpaca-snapshots.mjs';
const STEP=900000;
const now=Date.parse('2026-10-17T21:30:00Z');
const count=3800,first=now-(count+1)*STEP;
const createBars=symbol=>Array.from({length:count},(_,i)=>{
 const o=100+Math.sin(i/13)*4,c=100+Math.sin((i+1)/13)*4;
 return {t:new Date(first+i*STEP).toISOString(),o,h:Math.max(o,c)+.1,
  l:Math.min(o,c)-.1,c,v:symbol==='BCH/USD'?.2:10};
});
const makeFetch=(override)=>async (url,opts)=>{
 assert.equal(opts.method,'GET');
 assert.ok(url.startsWith('https://data.alpaca.markets/v1beta3/crypto/us-1/bars?'));
 assert.equal(opts.headers['APCA-API-KEY-ID'],'dummy-key');
 assert.equal(opts.headers['APCA-API-SECRET-KEY'],'dummy-secret');
 assert.equal(opts.redirect,'error');
 const q=new URL(url).searchParams,symbol=q.get('symbols'),page=q.get('page_token');
 assert.ok(PAIRS.includes(symbol));
 assert.equal(q.get('timeframe'),'15Min');
 const bars=createBars(symbol);
 const data=page==='next'?
   {bars:{[symbol]:bars.slice(1900)},next_page_token:null}:
   {bars:{[symbol]:bars.slice(0,1900)},next_page_token:'next'};
 return {ok:true,status:200,json:async()=>override?override(data,q):data};
};
test('all pairs use GET-only paginated Alpaca Kraken US historical data',async()=>{
 for(const symbol of PAIRS){
  const r=await fetchSnapshot({symbol,key:'dummy-key',secret:'dummy-secret',now,fetchImpl:makeFetch()});
  assert.equal(r.symbol,symbol);
  assert.equal(r.source,'ALPACA_KRAKEN_US_US-1');
  assert.equal(r.calendarDays,SNAPSHOT_DAYS);
  assert.equal(r.bars.length,count);
  assert.equal(checkSnapshot(r,symbol,now).bars.length,count);
 }
});
test('reader rejects missing credentials, unsupported symbols, missing data, repeated tokens',async()=>{
 await assert.rejects(fetchSnapshot({symbol:'SOL/USDT',key:'dummy-key',secret:'dummy-secret'}),/Unapproved pair/);
 await assert.rejects(fetchSnapshot({symbol:'BTC/USD'}),/server-side/);
 await assert.rejects(fetchSnapshot({symbol:'BTC/USD',key:'dummy-key',secret:'dummy-secret',now,
  fetchImpl:makeFetch((d)=>({...d,bars:{}}))}),/omitted/);
 await assert.rejects(fetchSnapshot({symbol:'BTC/USD',key:'dummy-key',secret:'dummy-secret',now,
  fetchImpl:makeFetch((d)=>({...d,next_page_token:'next'}))}),/repeated/);
});
test('reject missing candles, zero-volume majority and unfinished bars',async()=>{
 const broken=makeFetch((d,q)=>q.get('page_token')==='next'?
  {...d,bars:{'BTC/USD':d.bars['BTC/USD'].filter((_,i)=>i!==80)}}:d);
 await assert.rejects(fetchSnapshot({symbol:'BTC/USD',key:'dummy-key',secret:'dummy-secret',now,
  fetchImpl:broken}),/noncontiguous/);
 const zero=makeFetch((d,q)=>({...d,
  bars:{'BTC/USD':d.bars['BTC/USD'].map(b=>({...b,v:0}))}}));
 await assert.rejects(fetchSnapshot({symbol:'BTC/USD',key:'dummy-key',secret:'dummy-secret',now,
  fetchImpl:zero}),/zero-volume/);
});
test('all ten publish only after every pair passes',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'alpaca-research-'));
 try{
  const result=await refreshAll({key:'dummy-key',secret:'dummy-secret',now,
   fetchImpl:makeFetch(),outputDir:temp});
  assert.equal(result.updated,10);
  assert.equal(result.paperOrders,0);
  assert.deepEqual(result.requestMethods,['GET']);
  const files=await readdir(temp);
  assert.equal(files.length,10);
  const sample=JSON.parse(await readFile(path.join(temp,'BTC-USD.json'),'utf8'));
  assert.equal(checkSnapshot(sample,'BTC/USD',now).bars.length,count);
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('no partial publication when one of ten feeds rejects',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'alpaca-no-partial-'));
 try{
  await assert.rejects(refreshAll({key:'dummy-key',secret:'dummy-secret',now,outputDir:temp,
   fetchImpl:async(url,options)=>{
    if(new URL(url).searchParams.get('symbols')==='LTC/USD'){
     return {ok:false,status:503,json:async()=>({})};
    }
    return makeFetch()(url,options);
   }}),/HTTP 503/);
  assert.equal((await readdir(temp)).length,0);
 }finally{await rm(temp,{recursive:true,force:true});}
});
