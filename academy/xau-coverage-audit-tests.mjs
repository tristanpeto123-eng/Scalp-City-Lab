import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditXauCoverage} from './xau-coverage-audit.mjs';
const t=Date.parse('2025-01-01T00:00:00Z');
const candle=(i,offset=0)=>({t:new Date(t+(i+offset)*300000).toISOString(),o:2600,h:2601,l:2599,c:2600,v:100});
test('coverage audit does not invent missing history',()=>{
 const b=Array.from({length:200},(_,i)=>candle(i));
 const a=auditXauCoverage(b);
 assert.equal(a.coverageDaysPassed,false);
 assert.equal(a.missingFiveMinuteBars,0);
 assert.equal(a.brokerOrders,0);
 assert.equal(a.releaseEligible,false);
});
test('counts missing five-minute bars without filling them',()=>{
 const b=Array.from({length:200},(_,i)=>candle(i,i>=100?12:0));
 const a=auditXauCoverage(b);
 assert.equal(a.gaps,1);
 assert.equal(a.missingFiveMinuteBars,12);
 assert.equal(a.gapsDetail.length,1);
 assert.equal(a.gapsDetail[0].missingBars,12);
});
test('rejects repeated timestamps and invalid OHLC',()=>{
 const b=Array.from({length:200},(_,i)=>candle(i));
 b[3]={...b[2]};
 assert.throws(()=>auditXauCoverage(b),/duplicate|Unordered/);
});
test('coverage threshold does not imply trading graduation',()=>{
 const b=Array.from({length:361},(_,d)=>Array.from({length:150},(_,i)=>candle(d*288+i))).flat();
 const a=auditXauCoverage(b);
 assert.equal(a.coverageDaysPassed,true);
 assert.equal(a.releaseEligible,false);
 assert.equal(a.sourceVerified,false);
 assert.ok(a.gaps>0);
});