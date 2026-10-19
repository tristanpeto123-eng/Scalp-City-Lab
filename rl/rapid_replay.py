"""Orchestrate independently checkpointed, accelerated historical DQN episodes.

All steps are virtual actions against authentic 15-minute archived OHLCV.
NO synthetic 1-second candles, broker API, order placement or signed grades.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from .dqn_experiment import SYMBOLS, PERIOD_MS, run, split_development, validate_snapshot

REPORT_SCHEMA='SCALP_RAPID_RL_REPLAY_V1'
def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def new_training_tail(previous, train):
    """Count newly ending training candles; overlapping windows are not independent."""
    if not previous or not isinstance(previous.get('trainedThrough'),int):
        return len(train)
    delta=train[-1]['t']-previous['trainedThrough']
    return max(0,min(len(train),delta//PERIOD_MS))

def train_replay_batch(*,data_dir,root,episodes=1,seed=7,symbols=SYMBOLS,
                       train_fn=run,now=None):
    if not isinstance(episodes,int) or not 1<=episodes<=50:
        raise ValueError('Episodes must be between 1 and 50')
    if not symbols or len(set(symbols))!=len(symbols) or any(s not in SYMBOLS for s in symbols):
        raise ValueError('Require distinct canonical crypto pupils')
    data_dir,root=Path(data_dir),Path(root)
    latest=root/'rl-rapid'/'latest.json'
    previous=json.loads(latest.read_text()) if latest.exists() else None
    if previous and (previous.get('schema')!=REPORT_SCHEMA or
                     previous.get('paperOrders')!=0 or previous.get('liveOrders')!=0):
        raise ValueError('Incompatible previous RL research manifest')
    previous_by_symbol={p['symbol']:p for p in previous['pupils']} if previous else {}
    # Read and verify ALL requested historical sources before touching checkpoints.
    snapshots={}
    for symbol in symbols:
        data=json.loads((data_dir/(symbol.replace('/','-')+'.json')).read_text())
        if data.get('symbol')!=symbol:
            raise ValueError('Snapshot symbol mismatch')
        bars=validate_snapshot(data)
        training,validation,layout=split_development(bars)
        snapshots[symbol]=(data,training,validation,layout)
    models=root/'models'
    models.mkdir(parents=True,exist_ok=True)
    started=time.perf_counter()
    reports=[]
    for symbol in symbols:
        data,training,validation,layout=snapshots[symbol]
        prior=previous_by_symbol.get(symbol)
        stem=symbol.replace('/','-')
        ckpt=models/(stem+'-dqn.pt')
        if prior:
            if not ckpt.exists() or prior.get('modelSha256')!=sha256(ckpt):
                raise ValueError('RL checkpoint provenance mismatch for '+symbol)
        elif ckpt.exists():
            raise ValueError('Untracked prior RL checkpoint for '+symbol)
        current=train_fn(data,episodes=episodes,seed=seed,
                         outdir=models,prior_checkpoint=ckpt if prior else None)
        saved=models/(stem+'-dqn.pt')
        model_sha=sha256(saved)
        stats=current['training']
        if (current.get('schema')!='SCALP_DQN_DEVELOPMENT_V1' or
            current.get('symbol')!=symbol or current.get('paperOrders')!=0 or
            current.get('liveOrders')!=0 or current.get('champion') is not False or
            current.get('officialGrade') is not None or
            current.get('policySha256')!=model_sha or
            current['splits']['sealedHoldoutTouched'] is not False or
            current.get('previousCheckpointSha256')!=(prior['modelSha256'] if prior else None)):
            raise ValueError('Untrusted DQN training output for '+symbol)
        for k in ('steps','gradientUpdates','simulatedClosedTrades','simulatedOpens'):
            if not isinstance(stats.get(k),int) or stats[k]<0:
                raise ValueError('Missing measured RL metric '+k)
        rate=stats.get('decisionsPerSecond')
        if not isinstance(rate,(int,float)) or not math.isfinite(rate) or rate<0:
            raise ValueError('Invalid measured RL policy speed')
        reports.append({
            'symbol':symbol,'modelSha256':model_sha,
            'initialCheckpointSha256':prior['modelSha256'] if prior else None,
            'sourceSnapshotAt':data.get('generatedAt'),'trainedThrough':training[-1]['t'],
            'validationThrough':validation[-1]['t'],
            'sourceTrainingFingerprint':current['trainingDataSha256'],
            'trainingCandles':len(training),'validationCandles':len(validation),
            'newTrainingTailCandles':new_training_tail(prior,training),
            'episodesThisRun':episodes,
            'decisionsThisRun':stats['steps'],
            'gradientUpdatesThisRun':stats['gradientUpdates'],
            'simulatedClosedTradesThisRun':stats['simulatedClosedTrades'],
            'simulatedOpensThisRun':stats['simulatedOpens'],
            'decisionsPerSecond':rate,
            'simulatedClosesPerSecond':stats['virtualClosesPerSecond'],
            'gradientUpdatesPerSecond':stats['gradientUpdatesPerSecond'],
            'trainingElapsedSeconds':stats['trainingElapsedSeconds'],
            'cumulativeDecisions':stats['steps']+(prior['cumulativeDecisions'] if prior else 0),
            'cumulativeGradientUpdates':stats['gradientUpdates']+
                (prior['cumulativeGradientUpdates'] if prior else 0),
            'laterDevelopmentNetGbp':current['validation']['netProfitGbp'],
            'laterDevelopmentStressedNetGbp':current['validationDoubleCostStress']['netProfitGbp'],
            'laterDevelopmentMaxDrawdownPct':current['validation']['maxDrawdownPct'],
            'positiveUnderStressedCosts':current['validation']['netProfitGbp']>0 and
                current['validationDoubleCostStress']['netProfitGbp']>0,
            'researchOnly':True,'forwardVerified':False,'paperOrders':0
        })
    now=now or datetime.now(timezone.utc).isoformat()
    elapsed=max(1e-6,time.perf_counter()-started)
    result={
        'schema':REPORT_SCHEMA,'generatedAt':now,'cadence':'SCHEDULED_BATCH_NOT_CONTINUOUS',
        'marketBarTimeframe':'15Min','simulationClock':'HISTORICAL_REPLAY',
        'decisionsAreNotBrokerTrades':True,
        'decisionCount':sum(p['decisionsThisRun'] for p in reports),
        'simulatedClosedTrades':sum(p['simulatedClosedTradesThisRun'] for p in reports),
        'gradientUpdates':sum(p['gradientUpdatesThisRun'] for p in reports),
        'batchElapsedSeconds':round(elapsed,4),
        'decisionsPerSecond':round(sum(p['decisionsThisRun'] for p in reports)/elapsed,2),
        'simulatedClosesPerSecond':round(sum(p['simulatedClosedTradesThisRun'] for p in reports)/elapsed,2),
        'newTrainingTailCandles':sum(p['newTrainingTailCandles'] for p in reports),
        'positiveDevelopmentPupils':sum(p['positiveUnderStressedCosts'] for p in reports),
        'pupils':reports,'sealedHoldoutAccessed':False,
        'verifiedForwardGrades':0,'paperOrders':0,'liveOrders':0,'automaticAdmissions':0,
        'claim':'Accelerated DQN historical replay; no one-second market data, broker trades or demonstrated real-world profitability.'
    }
    latest.parent.mkdir(parents=True,exist_ok=True)
    latest.write_text(json.dumps(result,indent=2)+'\n')
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--data-dir',default='validation-data')
    p.add_argument('--root',default='rl-history')
    p.add_argument('--episodes',type=int,default=1)
    p.add_argument('--seed',type=int,default=7)
    p.add_argument('--symbol',choices=['ALL',*SYMBOLS],default='ALL')
    args=p.parse_args()
    symbols=SYMBOLS if args.symbol=='ALL' else (args.symbol,)
    result=train_replay_batch(data_dir=args.data_dir,root=args.root,
                               episodes=args.episodes,seed=args.seed,symbols=symbols)
    print('RAPID_DQN_TRAINING '+json.dumps({k:result[k] for k in (
        'generatedAt','decisionCount','simulatedClosedTrades','gradientUpdates',
        'decisionsPerSecond','simulatedClosesPerSecond','positiveDevelopmentPupils',
        'newTrainingTailCandles','sealedHoldoutAccessed','paperOrders')}))

if __name__=='__main__':
    main()
