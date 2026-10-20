"""Contract tests: accelerated RL is measured historical replay, never broker calls."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from rl.rapid_replay import train_replay_batch, new_training_tail, REPORT_SCHEMA
from rl.test_dqn_experiment import snapshot as fifteen_min_snapshot
from datetime import datetime, timedelta, timezone
from rl.dqn_experiment import validate_snapshot, split_development, MarketEnv, train_dqn


def snapshot():
    result=fifteen_min_snapshot()
    result['timeframe']='5Min'
    start=datetime(2024,1,1,tzinfo=timezone.utc)
    for i,b in enumerate(result['bars']):
        b['t']=(start+timedelta(minutes=5*i)).isoformat()
    return result

class RapidReplayContract(unittest.TestCase):
    def test_throughput_is_real_timings_and_never_a_broker_fill(self):
        data=validate_snapshot(snapshot())
        policy,m=train_dqn(data[:120],episodes=1,seed=3)
        self.assertGreater(m['steps'],1)
        self.assertGreater(m['decisionsPerSecond'],0)
        self.assertGreater(m['gradientUpdates'],0)
        self.assertEqual(m['marketTimeframe'],'5Min')
        self.assertIn('NOT_REALTIME_1S',m['cadenceType'])
        self.assertGreaterEqual(m['simulatedOpens'],m['simulatedClosedTrades'])

    def test_new_candles_must_move_train_end(self):
        bars=validate_snapshot(snapshot())[:100]
        self.assertEqual(new_training_tail(None,bars),100)
        self.assertEqual(new_training_tail({'trainedThrough':bars[-1]['t']},bars),0)
        self.assertEqual(new_training_tail({'trainedThrough':bars[-3]['t']},bars),2)

    def test_pupil_checkpoint_resumes_but_reused_candles_do_not_count_new(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/'data').mkdir()
            data=snapshot()
            (root/'data'/'BTC-USD.json').write_text(json.dumps(data))
            def fake_train(_,*,episodes,seed,outdir,prior_checkpoint=None,trace_out=None):
                out=Path(outdir)
                out.mkdir(parents=True,exist_ok=True)
                data_bytes=b'model'+bytes([episodes])
                (out/'BTC-USD-dqn.pt').write_bytes(data_bytes)
                if trace_out:
                    p=Path(trace_out);p.parent.mkdir(parents=True,exist_ok=True)
                    p.write_text('REPLAY_PROVENANCE_MOCK')
                training,validation,layout=split_development(validate_snapshot(data))
                had_prior=prior_checkpoint is not None
                previous_sha=hashlib.sha256(Path(prior_checkpoint).read_bytes()).hexdigest() if had_prior else None
                progress={
                    'schema':'SCALP_CHECKPOINT_SAME_WINDOW_DEVELOPMENT_V1',
                    'comparisonStatus':'SAME_DEVELOPMENT_WINDOW_NOT_FORWARD_VERIFIED' if had_prior else 'FIRST_CHECKPOINT_NO_COMPARATOR',
                    'validationWindowSha256':'c'*64,
                    'previousModelSha256':previous_sha,
                    'previousNetVirtual':-3.0 if had_prior else None,
                    'candidateNetVirtual':-2.5,
                    'deltaNetVirtual':0.5 if had_prior else None,
                    'previousStressedNetVirtual':-6.0 if had_prior else None,
                    'candidateStressedNetVirtual':-5.0,
                    'deltaStressedNetVirtual':1.0 if had_prior else None,
                    'improvedUnderBothCostAssumptions':had_prior,
                    'isIndependentForwardEvidence':False,
                    'automaticPromotion':False,'paperOrders':0,'liveOrders':0}
                return {
                    'schema':'SCALP_DQN_DEVELOPMENT_V1',
                    'symbol':'BTC/USD','marketTimeframe':'5Min',
                    'paperOrders':0,'liveOrders':0,
                    'officialGrade':None,'champion':False,
                    'policySha256':hashlib.sha256(data_bytes).hexdigest(),
                    'previousCheckpointSha256':(
                        hashlib.sha256(Path(prior_checkpoint).read_bytes()).hexdigest()
                        if prior_checkpoint else None),
                    'checkpointProgress':progress,
                    'trainingDataSha256':'f'*64,
                    'splits':{'sealedHoldoutTouched':False},
                    'training':{'steps':150,'gradientUpdates':35,'simulatedClosedTrades':12,
                      'simulatedOpens':15,'decisionsPerSecond':123.4,
                      'virtualClosesPerSecond':9.8,'gradientUpdatesPerSecond':29.3,
                      'trainingElapsedSeconds':1.21},
                    'validation':{'netProfitGbp':-2.5,'maxDrawdownPct':6,'closedTrades':8},
                    'validationDoubleCostStress':{'netProfitGbp':-5.0}
                }
            first=train_replay_batch(data_dir=root/'data',root=root/'memory',symbols=('BTC/USD',),
                                    train_fn=fake_train)
            self.assertEqual(first['decisionCount'],150)
            self.assertEqual(first['profitDevelopmentGatePasses'],0)
            self.assertFalse(first['pupils'][0]['profitObjective']['developmentGatePassed'])
            self.assertEqual(first['pupils'][0]['profitObjective']['automaticPromotion'],False)
            self.assertEqual(first['simulatedClosedTrades'],12)
            self.assertEqual(first['verifiedForwardGrades'],0)
            self.assertFalse(first['sealedHoldoutAccessed'])
            self.assertEqual(first['newTrainingTailCandles'],1440)
            second=train_replay_batch(data_dir=root/'data',root=root/'memory',symbols=('BTC/USD',),
                                     train_fn=fake_train)
            self.assertEqual(second['newTrainingTailCandles'],0)
            self.assertEqual(second['pupils'][0]['cumulativeDecisions'],300)
            self.assertIsNotNone(second['pupils'][0]['initialCheckpointSha256'])
            self.assertFalse(second['pupils'][0]['positiveUnderStressedCosts'])
            self.assertEqual(second['marketBarTimeframe'],'5Min')
            self.assertEqual(first['checkpointComparisonPupils'],0)
            self.assertEqual(first['checkpointImprovedPupils'],0)
            self.assertEqual(second['checkpointComparisonPupils'],1)
            self.assertEqual(second['checkpointImprovedPupils'],1)
            self.assertEqual(second['pupils'][0]['checkpointProgress']['deltaStressedNetVirtual'],1.0)
            self.assertFalse(second['pupils'][0]['checkpointProgress']['isIndependentForwardEvidence'])

    def test_missing_checkpoint_is_not_replaced_by_fake_new_model(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/'data').mkdir()
            (root/'data'/'BTC-USD.json').write_text(json.dumps(snapshot()))
            (root/'memory'/'rl-rapid').mkdir(parents=True)
            (root/'memory'/'rl-rapid'/'latest.json').write_text(json.dumps({
                'schema':REPORT_SCHEMA,'paperOrders':0,'liveOrders':0,
                'pupils':[{'symbol':'BTC/USD','modelSha256':'a'*64}]}))
            with self.assertRaisesRegex(ValueError,'checkpoint provenance mismatch'):
                train_replay_batch(data_dir=root/'data',root=root/'memory',symbols=('BTC/USD',),
                                   train_fn=lambda *a,**k:None)

    def test_no_source_data_lookahead_in_observation(self):
        bars=validate_snapshot(snapshot())[:80]
        x=MarketEnv(bars).reset()[0]
        modified=[dict(i) for i in bars]
        modified[50]['c']*=1.5;modified[50]['h']=max(modified[50]['c'],modified[50]['h'])
        y=MarketEnv(modified).reset()[0]
        self.assertEqual(x.tolist(),y.tolist())


if __name__=='__main__':
    unittest.main()
