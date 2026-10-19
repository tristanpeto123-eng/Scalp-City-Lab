import math
import unittest
from datetime import datetime, timedelta, timezone
import numpy as np
from rl.dqn_experiment import MarketEnv, run, split_development, validate_snapshot
from rl.profit_objective import OBJECTIVE_ID

def snapshot():
    start=datetime(2024,1,1,tzinfo=timezone.utc)
    bars=[]
    for i in range(2400):
        o=100+2*math.sin(i/8)
        c=100+2*math.sin((i+1)/8)
        bars.append({'t':(start+timedelta(minutes=15*i)).isoformat(),
                     'o':o,'h':max(o,c)*1.001,'l':min(o,c)*.999,
                     'c':c,'v':100+i%5})
    return {'symbol':'BTC/USD','source':'ALPACA_KRAKEN_US_US-1',
            'timeframe':'15Min','bars':bars}

class DeepRLTests(unittest.TestCase):
    def test_rejects_bad_source_gaps_and_future_bars(self):
        data=snapshot()
        self.assertEqual(len(validate_snapshot(data)),2400)
        data['source']='RANDOM_SOURCE'
        with self.assertRaises(ValueError):validate_snapshot(data)
        data=snapshot()
        data['bars'][101]['t']=data['bars'][100]['t']
        with self.assertRaises(ValueError):validate_snapshot(data)
        data=snapshot()
        data['bars'][-1]['t']='2030-01-01T00:00:00+00:00'
        with self.assertRaises(ValueError):validate_snapshot(data)

    def test_observations_cannot_see_future(self):
        bars=validate_snapshot(snapshot())[:80]
        env=MarketEnv(bars)
        before,_=env.reset()
        changed=[dict(b) for b in bars]
        changed[34]['c']*=1.02
        changed[34]['h']=max(changed[34]['h'],changed[34]['c'])
        rival=MarketEnv(changed)
        other,_=rival.reset()
        np.testing.assert_allclose(before,other)
        _,_,_,_,info=env.step(1)
        self.assertGreater(env.units,0)
        self.assertLess(info['equityGbp'],55)
        _,_,_,_,info=env.step(0)
        self.assertEqual(info['closedTrades'],1)

    def test_flat_position_gets_no_fake_activity_penalty(self):
        bars=validate_snapshot(snapshot())[:90]
        env=MarketEnv(bars)
        env.reset()
        for _ in range(15):
            _,reward,_,_,info=env.step(0)
            self.assertEqual(reward,0)
            self.assertEqual(info['netProfitGbp'],0)
            self.assertEqual(info['closedTrades'],0)

    def test_sealed_holdout_cannot_change_training_or_validation(self):
        data=snapshot()
        original=validate_snapshot(data)
        training,validation,metadata=split_development(original)
        self.assertEqual(metadata['sealedHoldoutCandles'],480)
        changed=snapshot()
        for b in changed['bars'][1920:]:
            for k in ('o','h','l','c'):b[k]*=1.2
        training2,validation2,_=split_development(validate_snapshot(changed))
        self.assertEqual(training,training2)
        self.assertEqual(validation,validation2)

    def test_real_gradient_steps_never_claim_teacher_approval(self):
        result=run(snapshot(),episodes=1,seed=11)
        self.assertGreater(result['training']['gradientUpdates'],0)
        self.assertFalse(result['splits']['sealedHoldoutTouched'])
        self.assertEqual(result['paperOrders'],0)
        self.assertEqual(result['liveOrders'],0)
        self.assertFalse(result['champion'])
        self.assertIsNone(result['officialGrade'])
        self.assertIn('validationDoubleCostStress',result)
        self.assertEqual(result['trainingGoal'],OBJECTIVE_ID)
        self.assertEqual(result['training']['optimisationObjective'],OBJECTIVE_ID)
        self.assertEqual(result['training']['tradeCountReward'],0)
        self.assertEqual(result['training']['winRateReward'],0)
        self.assertEqual(result['training']['flatActionPenalty'],0)
        self.assertEqual(result['profitObjective']['objectiveId'],OBJECTIVE_ID)
        self.assertEqual(result['profitObjective']['brokerOrders'],0)
        self.assertFalse(result['profitObjective']['automaticPromotion'])

if __name__=='__main__':
    unittest.main()
