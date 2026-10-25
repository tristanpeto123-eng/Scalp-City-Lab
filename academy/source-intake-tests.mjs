import assert from 'node:assert/strict';
import {test} from 'node:test';
import {intakeXauSample,SAMPLE_SOURCE} from './source-intake.mjs';
const start=Date.parse('2025-01-01T00:00:00.000Z');
const N=35200; // 122 calendar days; explicitly synthetic checker fixtures, never financial evidence.
const raw=['datetime,open,high,low,close,volume',
 ...Array.from({length:N},(_,i)=>{
  const t=new Date(start+i*300000).toISOString();
  const o=2600+i*.012+Math.sin(i*.07)*3,c=o+Math.sin(i*.09);
  return [t,o,Math.max(o,c)+.3,Math.min(o,c)-.3,c,200+i%23].join(',');
 })].join('\n')+'\n';
test('normalise keyless provider schema without resampling or inventing candles',()=>{
 const {csv,manifest}=intakeXauSample(raw);
 assert.ok(csv.startsWith('time,open,high,low,close,volume\n'));
 assert.equal(manifest.rows,N);
 assert.equal(manifest.source,SAMPLE_SOURCE);
 assert.ok(manifest.spanCalendarDays>=120);
 assert.equal(manifest.gaps,0);
 assert.equal(manifest.rawSha256.length,64);
 assert.equal(manifest.normalizedSha256.length,64);
 assert.equal(manifest.originVerified,false);
 assert.equal(manifest.brokerOrders,0);
 assert.equal(csv.split('\n').length,N+2);
});
test('reject short, mismatched and malformed provider data',()=>{
 assert.throws(()=>intakeXauSample(raw.split('\n').slice(0,400).join('\n')),/too short|coverage/);
 assert.throws(()=>intakeXauSample(raw.replace('datetime,open','timestamp,open')),/schema/);
 assert.throws(()=>intakeXauSample(raw.replace('2025-01-01T00:00:00.000Z','2038-01-01T00:00:00.000Z')),/Unordered|duplicate/);
});
test('real market gaps are counted and never fabricated',()=>{
 const rows=raw.split('\n');
 for(let i=10000;i<10100;i++)rows.splice(10000,1);
 const {manifest}=intakeXauSample(rows.join('\n'));
 assert.equal(manifest.rows,N-100);
 assert.equal(manifest.gaps,1);
});
test('CLI writes both separate outputs with readback',async()=>{
 const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const {runXauIntake}=await import('../scripts/intake-xau-sample.mjs');
 const dir=await mkdtemp(join(tmpdir(),'academy-intake-'));
 try{
  const original=join(dir,'source.csv'),normal=join(dir,'normalised.csv'),manifest=join(dir,'manifest.json');
  await writeFile(original,raw);
  const result=await runXauIntake(original,normal,manifest);
  assert.equal(result.brokerOrders,0);
  assert.equal(result.bars,N);
  assert.ok((await readFile(normal,'utf8')).startsWith('time,open,high,low,close,volume\n'));
  const source=JSON.parse(await readFile(manifest,'utf8'));
  assert.equal(source.rawSha256,result.rawSha256);
 } finally {await rm(dir,{recursive:true,force:true});}
});
