"""Offline DQN historical experiment; no orders, admissions or grades."""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import math
import random
import time
from collections import deque
from datetime import datetime
from pathlib import Path
import numpy as np
import torch
from torch import nn

SYMBOLS = ('BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD',
           'AVAX/USD','LINK/USD','DOGE/USD','LTC/USD','BCH/USD')
PERIOD_MS = 900_000 # legacy 15-minute experiments remain available
FIVE_MIN_MS = 300_000
WARMUP = 32

def validate_snapshot(data, now_ms=None):
    timeframe=data.get('timeframe')
    if (data.get('symbol') not in SYMBOLS or timeframe not in ('15Min','5Min')
            or data.get('source') != 'ALPACA_KRAKEN_US_US-1'):
        raise ValueError('Untrusted 15-minute historical source')
    rows=data.get('bars')
    if not isinstance(rows,list) or not 2400<=len(rows)<=20000:
        raise ValueError('Require 2400-20000 completed candles')
    now_ms=now_ms if now_ms is not None else int(time.time()*1000)
    interval=FIVE_MIN_MS if timeframe=='5Min' else PERIOD_MS
    prior=None
    clean=[]
    for row in rows:
        try:
            stamp=datetime.fromisoformat(row['t'].replace('Z','+00:00'))
            if stamp.tzinfo is None:
                raise ValueError('Unzoned timestamp')
            t=int(stamp.timestamp()*1000)
            o,h,l,c,v=(float(row[k]) for k in ('o','h','l','c','v'))
        except (KeyError,TypeError,ValueError,OverflowError) as exc:
            raise ValueError('Malformed candle') from exc
        if (not all(map(math.isfinite,(o,h,l,c,v))) or
            min(o,h,l,c)<=0 or v<0 or h<max(o,c,l) or l>min(o,c,h) or
                (prior is not None and t-prior!=interval)):
            raise ValueError('Invalid or noncontiguous candle')
        prior=t
        clean.append({'t':t,'o':o,'h':h,'l':l,'c':c,'v':v})
    if clean[-1]['t']+interval>now_ms-30000:
        raise ValueError('Incomplete or future bar')
    if sum(x['v']==0 for x in clean)/len(clean)>.4:
        raise ValueError('Insufficient volume coverage')
    return clean

def split_development(bars):
    """Train first 60%, validate next 20%; never pass sealed final 20% to model."""
    n=len(bars)
    train_end,dev_end=int(.6*n),int(.8*n)
    if train_end<300 or dev_end-train_end<=WARMUP+2:
        raise ValueError('Insufficient development candles')
    return bars[:train_end],bars[train_end:dev_end],{
        'totalCandles':n,'trainCandles':train_end,
        'validationCandles':dev_end-train_end,'sealedHoldoutCandles':n-dev_end,
        'holdoutStart':bars[dev_end]['t'],'sealedHoldoutTouched':False}

class MarketEnv:
    """Gymnasium-style API, action 0=FLAT, 1=LONG; maximum half cash exposure.

    Observation uses only completed candle t. Trading happens at t+1 open,
    reward is marked-to-market equity at t+1 close.
    """
    def __init__(self,bars,fee=.0025,slippage=.001,capital=50.0):
        if len(bars)<=WARMUP+2 or not 0<=fee<=.02 or not 0<=slippage<=.02:
            raise ValueError('Invalid trading environment')
        self.bars,self.fee,self.slippage=bars,fee,slippage
        self.capital=capital
        self.reset()
    def reset(self,*,seed=None,options=None):
        self.i,self.cash,self.units=WARMUP,self.capital,0.0
        self.entry_cost,self.peak,self.max_dd=0.0,self.capital,0.0
        self.trades,self.wins,self.opens=0,0,0
        self.last_virtual_fill=None
        self.realized_profit_virtual=0.0
        return self.observation(),{}
    def equity(self,price):
        return self.cash+self.units*price*(1-self.slippage)*(1-self.fee)
    def observation(self):
        b=self.bars[self.i]
        segment=self.bars[self.i-24:self.i+1]
        prices=np.array([x['c'] for x in segment],dtype=np.float64)
        returns=np.diff(np.log(prices))
        volumes=np.array([x['v'] for x in segment],dtype=np.float64)
        features=[
            returns[-1]*100,returns[-4:].mean()*100,
            returns[-16:].mean()*100,returns[-16:].std()*100,
            (b['c']-b['o'])/b['o']*100,(b['h']-b['l'])/b['c']*100,
            math.log1p(b['v'])-np.log1p(volumes).mean(),
            1.0 if self.units>0 else 0.0,
            (self.peak-self.equity(b['c']))/max(self.peak,1e-9)]
        return np.clip(np.array(features,dtype=np.float32),-10,10)
    def step(self,action):
        if action not in (0,1):
            raise ValueError('Invalid trading action')
        previous=self.equity(self.bars[self.i]['c'])
        previous_dd=100*(self.peak-previous)/max(self.peak,1e-9)
        bar=self.bars[self.i+1]
        self.last_virtual_fill=None
        if action==0 and self.units>0:
            execution_price=bar['o']*(1-self.slippage)
            gross=self.units*execution_price
            fee_paid=gross*self.fee
            proceeds=gross-fee_paid
            realized=proceeds-self.entry_cost
            self.last_virtual_fill={
                'side':'SELL','candleTime':bar['t'],
                'marketOpenPriceUsd':bar['o'],
                'executionPriceUsd':execution_price,
                'quantityCrypto':self.units,
                'feeVirtual':fee_paid,'proceedsVirtual':proceeds,
                'entryCostVirtual':self.entry_cost,
                'realizedProfitVirtual':realized}
            self.cash+=proceeds
            self.trades+=1
            self.wins+=realized>0
            self.realized_profit_virtual+=realized
            self.units,self.entry_cost=0.0,0.0
        elif action==1 and self.units==0:
            notional=(self.cash*.5)/(1+self.fee)
            execution_price=bar['o']*(1+self.slippage)
            self.units=notional/execution_price
            fee_paid=notional*self.fee
            self.opens+=1
            self.entry_cost=notional+fee_paid
            self.cash-=self.entry_cost
            self.last_virtual_fill={
                'side':'BUY','candleTime':bar['t'],
                'marketOpenPriceUsd':bar['o'],
                'executionPriceUsd':execution_price,
                'quantityCrypto':self.units,
                'feeVirtual':fee_paid,'costVirtual':self.entry_cost,
                'realizedProfitVirtual':None}
        self.i+=1
        equity=self.equity(bar['c'])
        self.peak=max(self.peak,equity)
        self.max_dd=max(self.max_dd,100*(self.peak-equity)/self.peak)
        # Net-equity reward plus a small penalty for incremental drawdown.
        current_dd=100*(self.peak-equity)/self.peak
        reward=(100*math.log(max(equity,1e-9)/max(previous,1e-9))
                -.02*max(0.0,current_dd-previous_dd))
        done=self.i>=len(self.bars)-1
        info={'equityGbp':round(equity,4),
              'netProfitGbp':round(equity-self.capital,4),
              'maxDrawdownPct':round(self.max_dd,4),
              'closedTrades':self.trades,'wins':self.wins,
              'openedPositions':self.opens,'openPosition':self.units>0,
              'lastVirtualFill':self.last_virtual_fill,
              'realizedProfitVirtual':round(self.realized_profit_virtual,6)}
        return self.observation(),float(reward),done,False,info

class QNetwork(nn.Module):
    def __init__(self):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(9,64),nn.ReLU(),
                               nn.Linear(64,64),nn.ReLU(),nn.Linear(64,2))
    def forward(self,x):
        return self.net(x)

def train_dqn(bars,*,episodes=5,seed=7,initial_state_dict=None):
    if not 1<=episodes<=50:
        raise ValueError('Episodes must be 1-50')
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    env=MarketEnv(bars)
    policy,target=QNetwork(),QNetwork()
    if initial_state_dict is not None:
        # Model state is an offline research checkpoint, not a verified champion.
        policy.load_state_dict(initial_state_dict,strict=True)
    target.load_state_dict(policy.state_dict())
    optimizer=torch.optim.Adam(policy.parameters(),lr=.0005)
    replay=deque(maxlen=20000)
    steps,updates,closed_trades,opened_positions=0,0,0,0
    started=time.perf_counter()
    epsilon_span=max(1,(len(bars)-WARMUP-1)*episodes*.75)
    for _ in range(episodes):
        obs,_=env.reset()
        done=False
        while not done:
            epsilon=.05+.95*max(0.0,1.0-steps/epsilon_span)
            if random.random()<epsilon:
                action=random.randrange(2)
            else:
                with torch.no_grad():
                    action=int(policy(torch.from_numpy(obs)).argmax().item())
            next_obs,reward,done,_,_=env.step(action)
            replay.append((obs,action,reward,next_obs,done))
            obs=next_obs
            steps+=1
            if len(replay)>=64 and steps%4==0:
                batch=random.sample(replay,64)
                states=torch.from_numpy(np.stack([x[0] for x in batch]))
                acts=torch.tensor([x[1] for x in batch]).long().unsqueeze(1)
                rewards=torch.tensor([x[2] for x in batch],dtype=torch.float32)
                next_states=torch.from_numpy(np.stack([x[3] for x in batch]))
                dones=torch.tensor([x[4] for x in batch],dtype=torch.float32)
                chosen=policy(states).gather(1,acts).squeeze(1)
                with torch.no_grad():
                    target_q=rewards+.99*(1-dones)*target(next_states).max(1).values
                loss=nn.functional.smooth_l1_loss(chosen,target_q)
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(policy.parameters(),1.0)
                optimizer.step()
                updates+=1
            if steps%250==0:
                target.load_state_dict(policy.state_dict())
        closed_trades+=env.trades
        opened_positions+=env.opens
    elapsed=max(time.perf_counter()-started,0.000001)
    return policy,{'steps':steps,'gradientUpdates':updates,'episodes':episodes,
      'simulatedClosedTrades':closed_trades,'simulatedOpens':opened_positions,
      'trainingElapsedSeconds':round(elapsed,4),
      'decisionsPerSecond':round(steps/elapsed,2),
      'virtualClosesPerSecond':round(closed_trades/elapsed,2),
      'gradientUpdatesPerSecond':round(updates/elapsed,2),
      'marketTimeframe':'5Min' if bars[1]['t']-bars[0]['t']==FIVE_MIN_MS else '15Min',
      'cadenceType':'ACCELERATED_HISTORICAL_REPLAY_NOT_REALTIME_1S'}

def evaluate(policy,bars,*,fee=.0025,slippage=.001,strategy='dqn'):
    env=MarketEnv(bars,fee=fee,slippage=slippage)
    obs,_=env.reset()
    done=False
    while not done:
        if strategy=='cash':
            action=0
        elif strategy=='buy_hold':
            action=1
        else:
            with torch.no_grad():
                action=int(policy(torch.from_numpy(obs)).argmax().item())
        obs,_,done,_,info=env.step(action)
    return info

def build_causal_trace(policy,development_bars,*,symbol,max_visible=420):
    """Frozen model acts after candle close; simulated fill at next 5m open."""
    if symbol not in SYMBOLS or len(development_bars)<=WARMUP+2:
        raise ValueError('Invalid replay development window')
    period=development_bars[1]['t']-development_bars[0]['t']
    if period!=FIVE_MIN_MS or any(b['t']-a['t']!=period for a,b in
                                   zip(development_bars,development_bars[1:])):
        raise ValueError('Five-minute contiguous bars required')
    subset=development_bars[:max_visible] if max_visible else development_bars
    if len(subset)<=WARMUP+2:
        raise ValueError('Insufficient historical replay bars')
    env=MarketEnv(subset)
    obs,_=env.reset()
    candles=[{'t':b['t'],'o':b['o'],'h':b['h'],'l':b['l'],
              'c':b['c'],'v':b['v']} for b in subset[:WARMUP+1]]
    decisions=[]
    fills=[]
    closed_trades=[]
    active_entry=None
    done=False
    while not done:
        observed_t=subset[env.i]['t']
        with torch.no_grad():
            action=int(policy(torch.from_numpy(obs)).argmax().item())
        obs,reward,done,_,info=env.step(action)
        b=subset[env.i]
        execution=info['lastVirtualFill']
        if execution:
            event=dict(execution)
            event['sourceDecisionTime']=observed_t
            event['closedCandleTime']=b['t']
            event['marketCurrency']='USD'
            event['accountingCurrency']='VIRTUAL_UNITS'
            if event['side']=='BUY':
                if active_entry is not None:
                    raise ValueError('A position cannot be opened twice')
                active_entry=event
                event['tradeOrdinal']=len(closed_trades)+1
            else:
                if active_entry is None:
                    raise ValueError('An unpaired close cannot be recorded')
                units=active_entry['quantityCrypto']
                if not math.isclose(units,event['quantityCrypto'],rel_tol=1e-9):
                    raise ValueError('Entry/exit quantities differ')
                pnl=event['realizedProfitVirtual']
                trade={
                    'tradeOrdinal':len(closed_trades)+1,'symbol':symbol,
                    'entryDecisionTime':active_entry['sourceDecisionTime'],
                    'entryTime':active_entry['candleTime'],
                    'exitDecisionTime':observed_t,'exitTime':event['candleTime'],
                    'entryMarketOpenUsd':active_entry['marketOpenPriceUsd'],
                    'exitMarketOpenUsd':event['marketOpenPriceUsd'],
                    'entryExecutionPriceUsd':active_entry['executionPriceUsd'],
                    'exitExecutionPriceUsd':event['executionPriceUsd'],
                    'quantityCrypto':units,
                    'entryFeeVirtual':active_entry['feeVirtual'],
                    'exitFeeVirtual':event['feeVirtual'],
                    'entryCostVirtual':active_entry['costVirtual'],
                    'exitProceedsVirtual':event['proceedsVirtual'],
                    'netProfitVirtual':pnl,
                    'netReturnPct':100*pnl/active_entry['costVirtual'],
                    'outcome':'WIN' if pnl>0 else ('LOSS' if pnl<0 else 'BREAK_EVEN'),
                    'accountingCurrency':'VIRTUAL_UNITS',
                    'marketCurrency':'USD'}
                closed_trades.append(trade)
                event['tradeOrdinal']=len(closed_trades)
                active_entry=None
            fills.append(event)
        decisions.append({
            'observedCandleTime':observed_t,'action':'LONG' if action else 'FLAT',
            'nextCandleTime':b['t'],'nextOpenPrice':b['o'],
            'reward':round(reward,6),'equityGbp':info['equityGbp'],
            'simulatedClosedTrades':info['closedTrades'],
            'openPosition':info['openPosition'],
            'executionSide':execution['side'] if execution else None,
            'executionPriceUsd':execution['executionPriceUsd'] if execution else None,
            'realizedProfitVirtual':info['realizedProfitVirtual']
        })
        candles.append({'t':b['t'],'o':b['o'],'h':b['h'],'l':b['l'],
                        'c':b['c'],'v':b['v']})
    if len(closed_trades)!=env.trades or len(fills)!=env.trades+env.opens:
        raise ValueError('Simulator fills and trade journal must reconcile')
    return {'schema':'SCALP_CAUSAL_REPLAY_5MIN_V1','symbol':symbol,
        'timeframe':'5Min','source':'ALPACA_KRAKEN_US_US-1',
        'historicalOnly':True,'futureCandlesVisibleAtOnce':False,
        'fillsAreSimulated':True,'forwardPaperVerified':False,
        'paperOrders':0,'liveOrders':0,'heldOutQuarantineTouched':False,
        'tradeJournalSchema':'SCALP_VIRTUAL_TRADE_JOURNAL_V1',
        'marketPriceCurrency':'USD','accountingCurrency':'VIRTUAL_UNITS',
        'simulatedFeeRate':env.fee,'simulatedSlippageRate':env.slippage,
        'startingVirtualBalance':env.capital,
        'closedTrades':closed_trades,'virtualFills':fills,
        'openVirtualEntry':active_entry,
        'warmupCandleCount':WARMUP+1,'candles':candles,'decisions':decisions}

def run(snapshot,*,episodes=5,seed=7,outdir=None,prior_checkpoint=None,trace_out=None):
    symbol=snapshot.get('symbol')
    bars=validate_snapshot(snapshot)
    training,validation,split=split_development(bars)
    prior_state=None
    previous_sha=None
    if prior_checkpoint is not None:
        previous_bytes=Path(prior_checkpoint).read_bytes()
        previous_sha=hashlib.sha256(previous_bytes).hexdigest()
        prior_state=torch.load(io.BytesIO(previous_bytes),map_location='cpu',weights_only=True)
    policy,train_stats=train_dqn(training,episodes=episodes,seed=seed,
                                  initial_state_dict=prior_state)
    baseline=evaluate(policy,validation)
    stress=evaluate(policy,validation,fee=.005,slippage=.002)
    comparisons={name:evaluate(policy,validation,strategy=name)
                 for name in ('cash','buy_hold')}
    buffer=io.BytesIO()
    torch.save(policy.state_dict(),buffer)
    report={
        'schema':'SCALP_DQN_DEVELOPMENT_V1','symbol':symbol,
        'modelType':'DEEP_Q_NETWORK',
        'policySha256':hashlib.sha256(buffer.getvalue()).hexdigest(),
        'trainingDataSha256':hashlib.sha256(
            json.dumps(training,sort_keys=True).encode()).hexdigest(),
        'seed':seed,'training':train_stats,'marketTimeframe':snapshot['timeframe'],
        'splits':split,
        'previousCheckpointSha256':previous_sha,
        'cumulativeGradientUpdatesVerified':False,
        'validation':baseline,'validationDoubleCostStress':stress,
        'benchmarks':comparisons,
        'status':'EXPERIMENTAL_HISTORICAL_RESEARCH_ONLY',
        'paperOrders':0,'liveOrders':0,'officialGrade':None,
        'champion':False,'admissions':0,
        'warning':'Untouched final holdout and independent paper fills NOT tested.'}
    if trace_out:
        if snapshot['timeframe']!='5Min':
            raise ValueError('Visual replay requires genuine 5Min bars')
        trace=build_causal_trace(policy,validation,symbol=symbol,max_visible=420)
        trace['policySha256']=report['policySha256']
        location=Path(trace_out)
        location.parent.mkdir(parents=True,exist_ok=True)
        location.write_text(json.dumps(trace,separators=(',',':'))+'\n')
    if outdir:
        target=Path(outdir)
        target.mkdir(parents=True,exist_ok=True)
        stem=symbol.replace('/','-')
        (target/(stem+'-dqn.pt')).write_bytes(buffer.getvalue())
        (target/(stem+'-dqn.json')).write_text(json.dumps(report,indent=2)+'\n')
    return report

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--symbol',choices=SYMBOLS,required=True)
    parser.add_argument('--data-dir',default='validation-data')
    parser.add_argument('--outdir',default='dqn-artifacts')
    parser.add_argument('--episodes',type=int,default=5)
    parser.add_argument('--seed',type=int,default=7)
    args=parser.parse_args()
    file=Path(args.data_dir)/(args.symbol.replace('/','-')+'.json')
    print(json.dumps(run(json.loads(file.read_text()),episodes=args.episodes,
                         seed=args.seed,outdir=args.outdir),indent=2))

if __name__=='__main__':
    main()
