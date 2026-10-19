"""Source-recorded virtual fills and net trade ledger are not browser guesses."""
import math
import unittest
import torch
from rl.dqn_experiment import build_causal_trace, split_development, validate_snapshot
from rl.test_five_min_replay import five_min_snapshot

class RotateAction(torch.nn.Module):
    def forward(self,x):
        # Deliberately hold for one bar, then flatten to record a closed trade.
        if x[7]>.5:
            return torch.tensor([10.0,0.0])
        return torch.tensor([0.0,10.0])

class AlwaysFlat(torch.nn.Module):
    def forward(self,x):
        return torch.tensor([10.0,0.0])

class AlwaysLong(torch.nn.Module):
    def forward(self,x):
        return torch.tensor([0.0,10.0])

def later_bars():
    source=validate_snapshot(five_min_snapshot())
    _,development,_=split_development(source)
    return development

class VirtualTradeJournalTests(unittest.TestCase):
    def test_fills_and_trade_journal_reconcile_to_true_simulated_executions(self):
        trace=build_causal_trace(RotateAction(),later_bars(),symbol='BTC/USD',max_visible=91)
        self.assertEqual(trace['schema'],'SCALP_CAUSAL_REPLAY_5MIN_V1')
        self.assertEqual(trace['tradeJournalSchema'],'SCALP_VIRTUAL_TRADE_JOURNAL_V1')
        self.assertEqual(trace['marketPriceCurrency'],'USD')
        self.assertEqual(trace['accountingCurrency'],'VIRTUAL_UNITS')
        self.assertEqual(trace['startingVirtualBalance'],50.0)
        self.assertGreater(len(trace['closedTrades']),15)
        self.assertEqual(len(trace['closedTrades'])*2+1,len(trace['virtualFills']))
        self.assertIsNotNone(trace['openVirtualEntry'])
        decisions={d['nextCandleTime']:d for d in trace['decisions']}
        last_fill=None
        for fill in trace['virtualFills']:
            last_fill=fill
            matched=decisions[fill['candleTime']]
            self.assertEqual(matched['executionSide'],fill['side'])
            self.assertAlmostEqual(matched['executionPriceUsd'],fill['executionPriceUsd'])
            self.assertEqual(fill['sourceDecisionTime']+300000,fill['candleTime'])
            self.assertGreater(fill['feeVirtual'],0)
            if fill['side']=='BUY':
                self.assertGreater(fill['executionPriceUsd'],fill['marketOpenPriceUsd'])
            else:
                self.assertLess(fill['executionPriceUsd'],fill['marketOpenPriceUsd'])
        self.assertEqual(last_fill['side'],'BUY')
        self.assertEqual(trace['decisions'][-1]['simulatedClosedTrades'],
                         len(trace['closedTrades']))
        for trade in trace['closedTrades']:
            expected=trade['exitProceedsVirtual']-trade['entryCostVirtual']
            self.assertAlmostEqual(expected,trade['netProfitVirtual'],places=9)
            self.assertAlmostEqual(100*expected/trade['entryCostVirtual'],
                                   trade['netReturnPct'],places=9)
            self.assertLess(trade['entryTime'],trade['exitTime'])
            self.assertEqual(trade['marketCurrency'],'USD')

    def test_flat_pupil_generates_no_fictional_broker_fills_or_closed_trades(self):
        trace=build_causal_trace(AlwaysFlat(),later_bars(),symbol='BTC/USD',max_visible=91)
        self.assertEqual(trace['virtualFills'],[])
        self.assertEqual(trace['closedTrades'],[])
        self.assertIsNone(trace['openVirtualEntry'])
        self.assertTrue(all(d['executionSide'] is None and
                            d['executionPriceUsd'] is None for d in trace['decisions']))
        self.assertTrue(all(d['simulatedClosedTrades']==0 for d in trace['decisions']))

    def test_open_position_has_buy_fill_but_no_closed_profit_yet(self):
        trace=build_causal_trace(AlwaysLong(),later_bars(),symbol='BTC/USD',max_visible=91)
        self.assertEqual(len(trace['virtualFills']),1)
        self.assertEqual(trace['virtualFills'][0]['side'],'BUY')
        self.assertEqual(trace['closedTrades'],[])
        self.assertIsNotNone(trace['openVirtualEntry'])
        self.assertTrue(trace['decisions'][-1]['openPosition'])
        self.assertEqual(trace['decisions'][-1]['simulatedClosedTrades'],0)

    def test_fees_and_slippage_count_against_profits(self):
        trace=build_causal_trace(RotateAction(),later_bars(),symbol='BTC/USD',max_visible=91)
        trades=trace['closedTrades']
        for t in trades:
            self.assertGreater(t['entryFeeVirtual'],0)
            self.assertGreater(t['exitFeeVirtual'],0)
            self.assertTrue(math.isfinite(t['netProfitVirtual']))
        self.assertTrue(any(t['netProfitVirtual']<0 for t in trades))

if __name__=='__main__':
    unittest.main()
