import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runResearchSession,compactSessionRecord,candidateVerdict} from './strategy-research-session.mjs';
const snap=async(symbol='BTC/USD')=>JSON.parse(await readFile(new URL('./validation-data/'+symbol.replace('/','-')+'.json',import.meta.url),'utf8'));
test('Research Desk gives a diagnostic leaderboard and an honest decision even when every candidate fails',async()=>{
 const snapshot=await snap(),r=runResearchSession({snapshot,symbol:'BTC/USD',strategyMode:'invent'});
 assert.equal(r.type,'research');
 assert.equal(r.evaluatedCount,16);
 assert.equal(r.candidates.length,16);
 assert.ok(r.candidates.every(c=>Array.isArray(c.rejection)&&c.discovery&&c.confirmation&&c.doubledFee));
 assert.equal(r.independentForwardValidated,false);
 assert.equal(r.officialGrade,null);
 assert.equal(r.brokerOrders,0);
 assert.ok(r.decisionReason.length>20);
 assert.ok(r.bestCandidate);
 if(!r.selected){
  assert.equal(r.replay,null);
  assert.equal(r.decision,'NO_ELIGIBLE_DEVELOPMENT_CANDIDATE');
  assert.ok(r.bestCandidate.rejection.length>0);
 }
 const log=compactSessionRecord(r);
 assert.equal(log.experimentCount,16);
 assert.equal(log.brokerOrders,0);
 assert.equal(log.independentForwardValidated,false);
 assert.equal(candidateVerdict(r.bestCandidate),r.bestCandidate.eligible?'INTERNAL_SCREEN_PASSED':'DEVELOPMENT_REJECTED');
});
test('Both automatic research and manual replays remain independently labelled',async()=>{
 const snapshot=await snap();
 const auto=runResearchSession({snapshot,symbol:'BTC/USD',strategyMode:'auto'});
 assert.equal(auto.evaluatedCount,8);
 assert.equal(auto.type,'research');
 const manual=runResearchSession({snapshot,symbol:'BTC/USD',strategyMode:'rsi',mode:'duration',limit:7});
 assert.equal(manual.type,'manual');
 assert.ok(manual.replay);
 assert.equal(manual.replay.strategy,'rsi');
 assert.equal(manual.decision,'MANUAL_HISTORICAL_REPLAY');
 assert.equal(manual.brokerOrders,0);
 assert.equal(manual.independentForwardValidated,false);
});
test('Session rejects invalid risk or source rather than manufacturing demo prices',async()=>{
 const snapshot=await snap();
 assert.throws(()=>runResearchSession({snapshot,symbol:'BTC/USD',startingBalanceGbp:1}),/£50/);
 assert.throws(()=>runResearchSession({snapshot,symbol:'BTC/USD',strategyMode:'unknown'}),/supported/);
 assert.throws(()=>runResearchSession({snapshot,symbol:'DOGE/USD'}),/mismatched/);
});
test('Page has research flow, actionable data fallback and accessible candidate diagnostics',async()=>{
 const h=await readFile(new URL('./strategy-validation.html',import.meta.url),'utf8');
 for(const needle of ['Research Desk','research-question','candidate-list','download-report','research-history','session-decision','Run research session','strategy-research-session.mjs','Load newest published Alpaca data','validation-data/','loadPair()','fetch(url,'])
 assert.ok(h.includes(needle),'Missing '+needle);
 assert.doesNotMatch(h,/submitOrder\(|paperOrder\(/);
});
