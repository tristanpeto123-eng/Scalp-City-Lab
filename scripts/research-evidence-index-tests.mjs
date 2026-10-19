import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceIndex} from './research-evidence-index.mjs';
const sha='a'.repeat(40);
const sources=()=>({
 discovery:{schema:'SCALP_DIVERSIFIED_RESEARCH_V1',
  generatedAt:'2026-10-19T16:00:00Z',sourceSnapshots:10,
  paperOrders:0,liveOrders:0,independentForwardValidations:0,
  admissions:0,holdoutUsedForSelection:false,researchCandidates:120,
  developmentThresholdCandidates:2},
 supplyLearning:{archive_count:600,cluster_count:542,
  data_quality:{all_current_archive_unverified:true}},
 supplyChart:{model_status:'LOCKED',confirmed_chart_entries:0,tracked_events:12},
 supplyPrice:{outcomes_90d_resolved:0,prediction_model:'LOCKED'},
 strategyModel:{status:'LOCKED',verified_resolved_events:0,minimum_events:80},
 strategyStatus:{training_model:'LOCKED',mode:'technical',
  available_symbols:['ACWI','ETN','FCX']},
 commits:{
  crypto:{repo:'tristanpeto123-eng/Scalp-City-Lab',sha},
  supply:{repo:'tristanpeto123-eng/supply-scout',sha},
  strategy:{repo:'tristanpeto123-eng/strategy-lab-template',sha}
 }
});
test('three instrument domains indexed without implying stock-to-crypto alpha',()=>{
 const result=buildEvidenceIndex(sources());
 assert.equal(result.totalSystems,3);
 assert.deepEqual(result.systems.map(x=>x.domain),
  ['CRYPTO_15MIN','EQUITY_NEWS_EVENTS','EQUITY_TECHNICAL']);
 assert.equal(result.crossDomainPricePredictionAllowed,false);
 assert.equal(result.automatedTraderAccess,false);
 assert.ok(result.systems.every(x=>x.brokerOrders===0&&x.independentForwardEvidence===0));
 assert.equal(result.systems[0].verifiedProfitableModels,0);
});
test('source SHA and unverified status are hard requirements',()=>{
 const a=sources();a.commits.supply.sha='not-a-git-sha';
 assert.throws(()=>buildEvidenceIndex(a),/source commit/);
 const b=sources();b.supplyLearning.data_quality.all_current_archive_unverified=false;
 assert.throws(()=>buildEvidenceIndex(b),/unverified Supply Scout/);
 const c=sources();c.strategyModel.status='READY';
 assert.throws(()=>buildEvidenceIndex(c),/locked equity Strategy Lab/);
 const d=sources();d.discovery.paperOrders=1;
 assert.throws(()=>buildEvidenceIndex(d),/broker claim/);
});
