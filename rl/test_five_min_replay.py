"""A causal native-five-minute viewer requires genuine ordered source bars."""
import unittest
from datetime import datetime,timedelta,timezone
import numpy as np
from rl.dqn_experiment import (validate_snapshot,split_development,build_causal_trace,
                               QNetwork,MarketEnv,FIVE_MIN_MS)

def five_min_snapshot():
    begin=datetime(2025,1,1,tzinfo=timezone.utc)
    bars=[]
    for i in range(2400):
        o=100+0.05*np.sin(i/5)
        c=100+0.05*np.sin((i+1)/5)
        bars.append({'t':(begin+timedelta(minutes=5*i)).isoformat(),
             'o':o,'h':max(o,c)+.01,'l':min(o,c)-.01,'c':c,'v':100+i%17})
    return {'symbol':'BTC/USD','source':'ALPACA_KRAKEN_US_US-1',
            'timeframe':'5Min','bars':bars}

class FiveMinuteCausalReplay(unittest.TestCase):
    def test_genuine_completed_five_minute_observations(self):
        x=validate_snapshot(five_min_snapshot())
        self.assertEqual(x[1]['t']-x[0]['t'],FIVE_MIN_MS)
        bad=five_min_snapshot()
        bad['bars'][60]['t']=(datetime(2025,1,1,tzinfo=timezone.utc)+
                              timedelta(minutes=15*60)).isoformat()
        with self.assertRaisesRegex(ValueError,'noncontiguous'):
            validate_snapshot(bad)

    def test_trace_reveals_next_candle_only_after_model_action(self):
        data=validate_snapshot(five_min_snapshot())
        training,validation,split=split_development(data)
        network=QNetwork()
        result=build_causal_trace(network,validation,symbol='BTC/USD',max_visible=80)
        self.assertEqual(result['schema'],'SCALP_CAUSAL_REPLAY_5MIN_V1')
        self.assertEqual(result['timeframe'],'5Min')
        self.assertEqual(result['warmupCandleCount'],33)
        self.assertEqual(len(result['candles']),80)
        self.assertEqual(len(result['decisions']),47)
        self.assertEqual(result['paperOrders'],0)
        self.assertFalse(result['heldOutQuarantineTouched'])
        for i,d in enumerate(result['decisions']):
            self.assertEqual(d['observedCandleTime'],result['candles'][i+32]['t'])
            self.assertEqual(d['nextCandleTime'],result['candles'][i+33]['t'])
            self.assertEqual(d['nextCandleTime']-d['observedCandleTime'],FIVE_MIN_MS)
            self.assertIn(d['action'],('LONG','FLAT'))

    def test_hidden_future_candle_cannot_change_previous_dqn_decision(self):
        data=validate_snapshot(five_min_snapshot())
        _,validation,_=split_development(data)
        policy=QNetwork()
        original=build_causal_trace(policy,validation,symbol='BTC/USD',max_visible=80)
        rival=[dict(row) for row in validation]
        for row in rival[70:80]:
            row['o']*=1.02;row['h']*=1.02;row['l']*=1.02;row['c']*=1.02
        alternate=build_causal_trace(policy,rival,symbol='BTC/USD',max_visible=80)
        self.assertEqual(original['decisions'][:35],alternate['decisions'][:35])

    def test_legacy_fifteen_minute_bars_not_allowed_in_visual_5m_replay(self):
        from rl.test_dqn_experiment import snapshot
        old=validate_snapshot(snapshot())
        with self.assertRaisesRegex(ValueError,'Five-minute'):
            build_causal_trace(QNetwork(),old[:80],symbol='BTC/USD')

if __name__=='__main__':
    unittest.main()
