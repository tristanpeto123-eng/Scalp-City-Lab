import assert from 'node:assert/strict';
import {
 SL_HOURLY_MS,SL_FULL_BOOTSTRAP_BARS,SL_INCREMENTAL_BARS,
 SL_EXPECTED_CREDITS_PER_CALL,SL_PROVIDER_BASIC_DAILY_CREDITS,
 SL_PROVIDER_BASIC_PER_MINUTE_CREDITS,SL_HOURLY_CREDIT_EXAMPLES,
 slSyncKey,slReadSyncState,planSLHourlySync,recordSLHourlyAttempt,confirmSLHourlySuccess
} from './sl-hourly-sync.mjs';
const now=Date.parse('2026-10-24T14:00:00Z');
const market='COMMODITIES',symbol='XAUUSD';
const checkpoint={schema:'SL_5MIN_CAUSAL_LOOP_V1',config:{market,symbol}};
const defaultPlan=planSLHourlySync({market,symbol,now});
assert.equal(defaultPlan.due,true);
assert.equal(defaultPlan.outputsize,5000);
assert.equal(defaultPlan.estimatedCredits,1);
assert.equal(defaultPlan.refreshMode,'CATCHUP_5000_BARS');
assert.equal(SL_EXPECTED_CREDITS_PER_CALL,1);
assert.equal(SL_PROVIDER_BASIC_DAILY_CREDITS,800);
assert.equal(SL_PROVIDER_BASIC_PER_MINUTE_CREDITS,8);
assert.equal(SL_HOURLY_CREDIT_EXAMPLES.perSymbolPerDay,24);
assert.equal(SL_HOURLY_CREDIT_EXAMPLES.threeSymbolsPerDay,72);
assert.equal(SL_HOURLY_CREDIT_EXAMPLES.continuousFiveMinutePerDay,288);
let record=slReadSyncState(null,market,symbol);
assert.equal(record.totalAttempts,0);
record=recordSLHourlyAttempt(record,market,symbol,{now});
assert.equal(record.totalAttempts,1);
assert.equal(record.lastSuccessAt,null);
const immediate=planSLHourlySync({market,symbol,record,checkpoint,now:now+12*60000});
assert.equal(immediate.due,false);
assert.equal(immediate.delayMs,48*60000);
assert.equal(immediate.outputsize,5000);
assert.throws(()=>recordSLHourlyAttempt(record,market,symbol,{now:now+12*60000}),/minimum interval/);
record=confirmSLHourlySuccess(record,market,symbol,{now:now+2000});
const due=planSLHourlySync({market,symbol,record,checkpoint,now:now+SL_HOURLY_MS});
assert.equal(due.due,true);
assert.equal(due.outputsize,SL_INCREMENTAL_BARS);
assert.equal(due.refreshMode,'OVERLAPPING_180_BARS');
const next=recordSLHourlyAttempt(record,market,symbol,{now:now+SL_HOURLY_MS});
assert.equal(next.totalAttempts,2);
const delayed=planSLHourlySync({market,symbol,record,checkpoint,now:now+9*SL_HOURLY_MS});
assert.equal(delayed.outputsize,SL_FULL_BOOTSTRAP_BARS);
assert.equal(delayed.due,true);
assert.throws(()=>planSLHourlySync({market,symbol,record,checkpoint,now:now-60000}),/clock moved backwards/);
assert.throws(()=>slReadSyncState('{bad json',market,symbol),/corrupt/);
assert.throws(()=>slReadSyncState({...record,market:'FOREX'},market,symbol),/invalid|another market/);
assert.notEqual(slSyncKey(market,symbol),slSyncKey('FOREX','EURUSD'));
assert.throws(()=>slSyncKey('CRYPTO','BTCUSD'),/invalid/);
assert.equal(JSON.stringify(record).includes('apiKey'),false);
assert.equal(JSON.stringify(record).includes('weights'),false);
assert.equal(JSON.stringify(record).includes('token'),false);
console.log('SL hourly sync tests passed: 1 credit per hour, 5000 bootstrap/150 overlap, quotas, per-symbol isolation, no retry on failures, no credentials');