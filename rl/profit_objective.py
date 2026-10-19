"""Research-only profit objective for each 5-minute DQN pupil.

Net profit after transaction costs is the primary outcome. Development scores
are descriptive and must never sign a Teacher grade or authorize broker orders.
"""
from __future__ import annotations
import math

OBJECTIVE_ID = 'MAXIMISE_NET_PROFIT_AFTER_FEES_AND_SLIPPAGE_V1'
MAX_DEVELOPMENT_DRAWDOWN_PCT = 8.0
MIN_DEVELOPMENT_CLOSED_TRADES = 5

def assess_profit_objective(validation, stress, benchmarks, *,
                            max_drawdown_pct=MAX_DEVELOPMENT_DRAWDOWN_PCT,
                            min_closed_trades=MIN_DEVELOPMENT_CLOSED_TRADES):
    """Audit *frozen* policy after training; do not feed dev results into DQN.

    Profitability is measured against the same reference capital and windows.
    Flat cash is a legitimate action and produces 0 GBP gain (not a penalty).
    """
    if not isinstance(min_closed_trades,int) or min_closed_trades<1:
        raise ValueError('Invalid sample adequacy gate')
    if not math.isfinite(max_drawdown_pct) or not 0<max_drawdown_pct<=100:
        raise ValueError('Invalid drawdown gate')
    if not isinstance(benchmarks,dict) or set(benchmarks)<{'cash','buy_hold'}:
        raise ValueError('Missing passive benchmarks')
    def number(obj,key):
        value=obj.get(key) if isinstance(obj,dict) else None
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
            raise ValueError('Profit evidence missing or non-finite: '+key)
        return float(value)
    normal = number(validation,'netProfitGbp')
    stressed = number(stress,'netProfitGbp')
    cash = number(benchmarks['cash'],'netProfitGbp')
    passive = number(benchmarks['buy_hold'],'netProfitGbp')
    drawdown = number(validation,'maxDrawdownPct')
    closes = number(validation,'closedTrades')
    if closes<0 or closes!=int(closes) or drawdown<0:
        raise ValueError('Invalid historical trade metrics')
    if abs(cash)>0.0001:
        raise ValueError('Cash baseline must have zero simulated profit')
    edge = normal-max(cash,passive)
    reasons=[]
    if normal<=0:reasons.append('NOT_PROFITABLE_AFTER_COSTS')
    if stressed<=0:reasons.append('NOT_PROFITABLE_UNDER_STRESS')
    if edge<=0:reasons.append('NO_EDGE_VS_CASH_AND_BUY_HOLD')
    if drawdown>max_drawdown_pct:reasons.append('DRAWDOWN_EXCEEDS_LIMIT')
    if closes<min_closed_trades:reasons.append('INSUFFICIENT_CLOSED_TRADES')
    passed=not reasons
    return {
      'objectiveId':OBJECTIVE_ID,
      'primaryMetric':'NET_GBP_RETURN_AFTER_FEES_SLIPPAGE',
      'researchStatus':'DEVELOPMENT_PROFIT_GATE_PASSED_UNVERIFIED' if passed
                       else 'DEVELOPMENT_PROFIT_GATE_FAILED',
      'developmentGatePassed':passed,'reasons':reasons,
      'normalNetGbp':round(normal,4),
      'stressedNetGbp':round(stressed,4),
      'cashNetGbp':round(cash,4),'buyHoldNetGbp':round(passive,4),
      'excessVsBestPassiveGbp':round(edge,4),
      'maxDrawdownPct':round(drawdown,4),
      'closedTrades':int(closes),'minimumClosedTrades':min_closed_trades,
      'drawdownLimitPct':max_drawdown_pct,
      'automaticPromotion':False,'brokerOrders':0,
      'forwardVerified':False,
      'validationOnlyNotTrainingReward':True,
      'note':'Overlapping historical development windows are not independent proof; a final sealed holdout and real forward PAPER fills remain separate.'
    }
