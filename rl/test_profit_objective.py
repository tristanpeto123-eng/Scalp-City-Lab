"""Net-profit objective must never confuse XP, trade frequency or in-sample wins."""
import unittest
from rl.profit_objective import (assess_profit_objective,OBJECTIVE_ID)

def result(net,drawdown=2.0,closes=35):
    return {'netProfitGbp':net,'maxDrawdownPct':drawdown,'closedTrades':closes}

def assess(normal,stress,passive=-0.5,closes=35,dd=2):
    return assess_profit_objective(
        result(normal,dd,closes),result(stress,dd,closes),
        {'cash':result(0), 'buy_hold':result(passive)})

class ProfitObjectiveTests(unittest.TestCase):
    def test_real_development_profit_survives_fees_drawdown_and_passive(self):
        x=assess(3,1.5,passive=2)
        self.assertEqual(x['objectiveId'],OBJECTIVE_ID)
        self.assertTrue(x['developmentGatePassed'])
        self.assertEqual(x['excessVsBestPassiveGbp'],1)
        self.assertFalse(x['automaticPromotion'])
        self.assertFalse(x['forwardVerified'])
        self.assertTrue(x['validationOnlyNotTrainingReward'])
    def test_29_trades_are_not_a_reliable_development_sample(self):
        x=assess(4,3,passive=1,closes=29)
        self.assertFalse(x['developmentGatePassed'])
        self.assertIn('INSUFFICIENT_CLOSED_TRADES',x['reasons'])

    def test_no_trade_cash_strategy_is_never_falsely_profitable(self):
        x=assess(0,0,passive=-2,closes=0)
        self.assertFalse(x['developmentGatePassed'])
        self.assertIn('NOT_PROFITABLE_AFTER_COSTS',x['reasons'])
        self.assertIn('INSUFFICIENT_CLOSED_TRADES',x['reasons'])
        self.assertEqual(x['normalNetGbp'],0)
    def test_high_win_rate_cannot_override_fee_stressed_loss(self):
        x=assess(1.1,-3.4,closes=150)
        self.assertFalse(x['developmentGatePassed'])
        self.assertIn('NOT_PROFITABLE_UNDER_STRESS',x['reasons'])
    def test_positive_cash_returns_but_worse_than_buy_and_hold_fails(self):
        x=assess(2,1.5,passive=4)
        self.assertFalse(x['developmentGatePassed'])
        self.assertIn('NO_EDGE_VS_CASH_AND_BUY_HOLD',x['reasons'])
        self.assertEqual(x['excessVsBestPassiveGbp'],-2)
    def test_dangerous_drawdown_and_small_sample_are_not_promoted(self):
        x=assess(8,6,passive=1,closes=1,dd=17)
        self.assertFalse(x['developmentGatePassed'])
        self.assertIn('DRAWDOWN_EXCEEDS_LIMIT',x['reasons'])
        self.assertIn('INSUFFICIENT_CLOSED_TRADES',x['reasons'])
    def test_reject_missing_or_spoofed_evidence(self):
        with self.assertRaisesRegex(ValueError,'Missing passive'):
            assess_profit_objective(result(3),result(1),{'cash':result(0)})
        with self.assertRaisesRegex(ValueError,'Cash baseline'):
            assess_profit_objective(result(3),result(1),{
                'cash':result(1),'buy_hold':result(-2)})
        with self.assertRaisesRegex(ValueError,'missing or non-finite'):
            assess_profit_objective(result(3),result(float('nan')),{
                'cash':result(0),'buy_hold':result(-2)})
if __name__=='__main__':
    unittest.main()
