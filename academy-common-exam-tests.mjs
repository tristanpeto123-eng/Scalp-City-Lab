import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateSubmission,COSTS} from './academy-common-exam.mjs';
const ts=Date.parse('2025-02-01T00:00:00.000Z');
function sample(method='SUPERVISED'){
 const candles=Array.from({length:121},(_,i)=>{
  const p=2500+(i*2)+(i%7)*0.2;
  return {t:new Date(ts+i*900000).toISOString(),o:p,h:p+3,l:p-2,c:p+1};
 });
 const decisions=candles.slice(0,-1).map((c,i)=>({t:c.t,action:i%8<4?'LONG':'FLAT'}));
 return {schema:'ACADEMY_FROZEN_STUDENT_V1',
 student:{id:'XAU-SCST-01',family:'SCOUT_STRATEGIST',learningMethod:method,
   market:'COMMODITIES',symbol:'XAUUSD',timeframe:'15Min',version:'2.4.1',
   trainedThroughUtc:'2025-01-31T00:00:00.000Z'},
 checkpoint:{architecture:'ScoutStrategistClassifierV2',state:{weights:[0.3,0.1,-0.2],bias:0.12}},
 examination:{source:'HISTORICAL_MARKET_DATA',provider:'TEST_FIXTURE_ONLY',symbol:'XAUUSD',
   timeframe:'15Min',synthetic:false,candles,decisions}};
}
test('frozen Scout is an Academy student with a reproducible local exam',async()=>{
 const x=await evaluateSubmission(sample()),y=await evaluateSubmission(sample());
 assert.deepEqual(x,y);
 assert.equal(x.studentId,'XAU-SCST-01');
 assert.equal(x.symbol,'XAUUSD');
 assert.equal(x.schema,'ACADEMY_COMMON_EXAM_V1');
 assert.ok(x.closedTrades>0);
 assert.equal(x.closedTrades,x.wins+x.losses);
 assert.equal(x.costs.initialGbp,1000);
 assert.equal(x.costs.positionFraction,0.25);
 assert.equal(x.verifiedPaperTrades,0);
 assert.equal(x.brokerOrders,0);
 assert.equal(x.qualified,false);
 assert.equal(x.allowsPromotion,false);
 assert.match(x.modelSha256,/^[a-f0-9]{64}$/);
 assert.match(x.dataSha256,/^[a-f0-9]{64}$/);
});
test('same exam scoring applies across training methods; method does not change fills',async()=>{
 const a=await evaluateSubmission(sample('SUPERVISED'));
 const b=await evaluateSubmission(sample('REINFORCEMENT'));
 assert.equal(a.realisedNetGbp,b.realisedNetGbp);
 assert.equal(a.maxDrawdownPct,b.maxDrawdownPct);
 assert.equal(a.closedTrades,b.closedTrades);
 assert.deepEqual(a.trades,b.trades);
 assert.deepEqual(a.costs,COSTS);
});
test('no future leakage, synthetic history, missing bars or post-hoc decisions',async()=>{
 for(const mutation of [
  s=>s.student.trainedThroughUtc='2025-03-01T00:00:00.000Z',
  s=>s.examination.synthetic=true,
  s=>s.examination.verifiedForward=true,
  s=>s.examination.candles[4].t=s.examination.candles[3].t,
  s=>s.examination.decisions[4].t=s.examination.decisions[3].t,
  s=>s.examination.decisions.pop(),
  s=>s.examination.decisions[1].action='BUY',
  s=>s.checkpoint.state={}
 ]){
  const s=sample();mutation(s);
  await assert.rejects(()=>evaluateSubmission(s),/ACADEMY:/);
 }
});
test('Scout identity cannot be spoofed by another symbol, or registered without weights',async()=>{
 const a=sample();a.student.symbol='BTCUSD';a.examination.symbol='BTCUSD';
 await assert.rejects(()=>evaluateSubmission(a),/Scout \/ Strategist identity/);
 const b=sample();b.checkpoint={architecture:'fake',state:{}};
 await assert.rejects(()=>evaluateSubmission(b),/model state/);
});
test('site includes one actual Scout in common classrooms and preserves ten original crypto pupils',async()=>{
 const html=await readFile(new URL('./robot-academy.html',import.meta.url),'utf8');
 assert.equal((html.match(/\['[A-Z]+\/USD',/g)||[]).length,10);
 assert.match(html,/modelId:'XAU-SCST-01'/);
 assert.match(html,/\.concat\(scout\)/);
 assert.match(html,/academy-unified-ui\.mjs/);
 assert.match(html,/academy:scout-status/);
 assert.match(html,/LOCAL_RESEARCH_EXAM/);
 assert.match(html,/Research grade|research grade|training grade|research grades/);
});
