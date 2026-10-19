import copy
import math
import unittest
from datetime import datetime,timedelta,timezone
from neo.pattern_memory import (append_training_history,pattern_features,
                                predict,HISTORY,FIVE_MIN_MS)

def sample():
    t=datetime(2025,1,1,tzinfo=timezone.utc)
    bars=[]
    for i in range(2400):
        o=100+.1*math.sin(i/9)
        c=100+.1*math.sin((i+1)/9)
        bars.append({'t':(t+timedelta(minutes=5*i)).isoformat(),
                     'o':o,'h':max(o,c)+.01,'l':min(o,c)-.01,
                     'c':c,'v':100+(i%30)})
    return {'symbol':'BTC/USD','timeframe':'5Min',
            'source':'ALPACA_KRAKEN_US_US-1','bars':bars,
            'generatedAt':'2025-03-01T00:00:00Z'}

class NeoMemoryTests(unittest.TestCase):
    def test_persists_every_eligible_unique_window_without_leaking_validation(self):
        a=append_training_history(sample())
        self.assertGreater(len(a['patterns']),1000)
        self.assertFalse(a['finalHoldoutObserved'])
        self.assertEqual(len({x['key'] for x in a['patterns']}),len(a['patterns']))
        self.assertTrue(all(x['labelThrough']<a['initialDevelopmentStart'] for x in a['patterns']))
        again=append_training_history(sample(),a)
        self.assertEqual(again['newPatternCount'],0)
        self.assertEqual(len(again['patterns']),len(a['patterns']))

    def test_future_candles_never_change_earlier_pattern_features(self):
        from rl.dqn_experiment import validate_snapshot
        s=sample();rows=validate_snapshot(s)
        first=pattern_features(rows,100)
        modified=copy.deepcopy(s)
        modified['bars'][150]['c']*=1.07
        modified['bars'][150]['h']*=1.08
        altered=validate_snapshot(modified)
        self.assertEqual(first,pattern_features(altered,100))

    def test_rejects_memory_containing_a_future_labeled_example(self):
        a=append_training_history(sample())
        bad=copy.deepcopy(a)
        bad['patterns'][5]['labelThrough']=bad['initialDevelopmentStart']
        with self.assertRaisesRegex(ValueError,'compromised'):
            append_training_history(sample(),bad)

    def test_matches_past_only_not_unseen_outcome(self):
        a=append_training_history(sample())
        q=a['patterns'][-1]
        early=predict(a,q['features'],a['patterns'][50]['t'])
        self.assertEqual(early['status'],'HISTORICAL_ANALOGUE_ONLY')
        self.assertGreaterEqual(early['matched'],11)
        limited={'patterns':[q]}
        result=predict(limited,q['features'],q['t'])
        self.assertEqual(result['action'],'FLAT')
        self.assertEqual(result['status'],'INSUFFICIENT_PRIOR_PATTERNS')
        self.assertEqual(result['matched'],0)

if __name__=='__main__':
    unittest.main()
