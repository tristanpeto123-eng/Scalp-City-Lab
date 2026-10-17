import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./robot-academy.html',import.meta.url),'utf8');
const gradeExpr=html.match(/const grade=p=>([^;]+);/)?.[1];
const percentExpr=html.match(/const percent=p=>([^;]+);/)?.[1];
const confirmedExpr=html.match(/const confirmed=p=>([^;]+);/)?.[1];
if(!gradeExpr||!percentExpr||!confirmedExpr)throw Error('Cannot find actual Academy grade functions');
const grade=new Function('p','return '+gradeExpr);
const pct=new Function('p','return '+percentExpr);
const confirmed=new Function('p','demo','return '+confirmedExpr);
const pupil=(wins,trades,source='VERIFIED_PAPER_FORWARD')=>({wins,trades,source});
test('ten pair-specific robot pupils and eleven 10-percent classrooms',()=>{
 const pairStrings=html.match(/\['[A-Z]+\/USD',/g)||[];
 assert.equal(pairStrings.length,10);
 assert.match(html,/for\(let g=0;g<=10;g\+\+\)/);
 assert.match(html,/Graduation/);
 assert.match(html,/orientation|Orientation/);
 assert.match(html,/80–89.9%/);
});
test('grade increases exactly at 10pct increments, including 100pct graduation',()=>{
 for(let n=0;n<=10;n++){
  assert.equal(grade(pupil(n*10,100)),n);
  if(n<10)assert.equal(grade(pupil(n*10+9,100)),n);
 }
 assert.equal(grade(pupil(99,100)),9);
 assert.equal(grade(pupil(100,100)),10);
 assert.equal(grade(pupil(0,100)),0);
 assert.equal(grade(pupil(0,0)),null);
 assert.equal(grade(pupil(null,null)),null);
 assert.equal(pct(pupil(3,10)),30);
});
test('no unverified or demo score is presented as confirmed',()=>{
 assert.equal(confirmed(pupil(25,30),false),true);
 assert.equal(confirmed(pupil(25,29),false),false);
 assert.equal(confirmed(pupil(25,30,'HISTORICAL_REPLAY'),false),false);
 assert.equal(confirmed(pupil(25,30,'FICTIONAL_DEMO'),false),false);
 assert.equal(confirmed(pupil(25,30),true),false);
 assert.match(html,/No verified forward-paper results are connected/);
 assert.match(html,/Demo mode is fictional/);
 assert.match(html,/not a profitable trading model|can get a high grade and still lose money/);
});
test('graduation can only run through user-driven fictional lesson controls',()=>{
 assert.match(html,/id="demo"/);
 assert.match(html,/id="lesson" disabled/);
 assert.match(html,/id="reset"/);
 assert.match(html,/if\(!demo\)return/);
 assert.match(html,/if\(grade\(p\)>old/);
 assert.match(html,/window\.RobotAcademy=/);
 assert.match(html,/record\.source!=='VERIFIED_PAPER_FORWARD'/);
 assert.doesNotMatch(html,/ALPACA_PAPER_KEY|APCA-API-SECRET-KEY|paperOrder\s*\(/);
 assert.doesNotMatch(html,/https:\/\/data\.alpaca\.markets/);
});
test('the graduation prototype is an independent page, not deployed trading code',()=>{
 assert.match(html,/<title>Scalp City — Robot Academy<\/title>/);
 assert.match(html,/strategy-validation\.html/);
 assert.match(html,/Never|No confirmed forward-paper win-rate records|No verified forward-paper results are connected/);
 assert.match(html,/status:'UNVERIFIED'|source:'UNVERIFIED'/);
});

test('report card differentiates profitability, drawdown, win rate and champion model',()=>{
 assert.match(html,/Net profit/);
 assert.match(html,/Max drawdown/);
 assert.match(html,/Current champion model/);
 assert.match(html,/const profitState=/);
 assert.match(html,/p\.net>0\?'PROFITABLE'/);
 assert.match(html,/p\.net<0\?'LOSS-MAKING'/);
 // A fictional 81%-win-rate robot is deliberately LOSS-MAKING.
 assert.match(html,/i===7\?-3\.60/);
 assert.match(html,/FICTIONAL_DEMO/);
});
test('published Academy does not load self-asserted browser records as confirmed evidence',async()=>{
 assert.match(html,/UNTRUSTED_CLIENT_PREVIEW/);
 assert.doesNotMatch(html,/fetch\(.+VERIFIED_PAPER_FORWARD/);
 assert.match(html,/No verified forward-paper results are connected/);
 const spec=JSON.parse(await readFile(new URL('./robot-academy-schema.json',import.meta.url),'utf8'));
 assert.equal(spec.properties.schemaVersion.const,'ROBOT_ACADEMY_EVIDENCE_V1');
 assert.equal(spec.properties.source.const,'VERIFIED_PAPER_FORWARD');
 assert.equal(spec.properties.pupils.items.properties.netProfitGbp.type,'number');
 assert.equal(spec.properties.pupils.items.properties.maxDrawdownPct.maximum,100);
 assert.ok(spec.properties.pupils.items.required.includes('distinctTradeIds'));
});
test('published test page links directly to the school',async()=>{
 const page=await readFile(new URL('./strategy-validation.html',import.meta.url),'utf8');
 assert.match(page,/href="\.\/robot-academy\.html"/);
 assert.match(page,/Robot Academy/);
});
