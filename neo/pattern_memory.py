"""NEO: source-grounded, append-only pattern recognition across ten crypto charts.

NEO remembers normalized, time-stamped OHLCV patterns, not chart pixels.
Only completed 5m training candles are eligible for labeled examples.
The validation + final held-out portion never enters the memory bank.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from . import __doc__ as _package_doc
from rl.dqn_experiment import SYMBOLS, FIVE_MIN_MS, validate_snapshot, split_development

SCHEMA='SCALP_NEO_MEMORY_V1'
HISTORY=12
HORIZON=3
CAPACITY=24000
ROUND_TRIP_COST=0.007  # exploratory 0.25% per side + 0.10% slippage per side
def digest(payload):
    return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def pattern_features(bars, i):
    """Exactly 12 completed 5-minute candles ending at index i."""
    if i<HISTORY-1: raise ValueError('NEO needs twelve completed candles')
    chunk=bars[i-HISTORY+1:i+1]
    anchor=chunk[0]['c']
    if anchor<=0: raise ValueError('Invalid price')
    # Each chart shape is stored in scale-independent form.
    features=[]
    for b in chunk:
        features.extend((round(math.log(b['c']/anchor),6),
                         round((b['c']-b['o'])/b['o'],6),
                         round((b['h']-b['l'])/b['c'],6)))
    return features

def sample_key(symbol,bars,i):
    return digest([symbol,[(x['t'],x['o'],x['h'],x['l'],x['c'],x['v'])
                           for x in bars[i-HISTORY+1:i+1]]])

def append_training_history(snapshot,previous=None):
    if snapshot.get('timeframe')!='5Min' or snapshot.get('symbol') not in SYMBOLS:
        raise ValueError('NEO: native 5-minute chart required')
    bars=validate_snapshot(snapshot)
    training,validation,split=split_development(bars)
    symbol=snapshot['symbol']
    original=previous or {'schema':SCHEMA,'symbol':symbol,'patterns':[],
        'initialTrainingEnd':training[-1]['t'],
        'initialDevelopmentStart':validation[0]['t'],
        'source':'ALPACA_KRAKEN_US_US-1'}
    if (original.get('schema')!=SCHEMA or original.get('symbol')!=symbol or
        original.get('source')!='ALPACA_KRAKEN_US_US-1'):
        raise ValueError('NEO: foreign memory not trusted')
    # A moving 30-day window must NEVER migrate prior validation into training.
    bound=original['initialTrainingEnd']
    first_validation=original['initialDevelopmentStart']
    if bound>=first_validation:
        raise ValueError('NEO: invalid immutable development boundary')
    existing=original['patterns']
    if len(existing)>CAPACITY or any(not isinstance(x.get('key'),str) or
                                     len(x.get('features',[]))!=HISTORY*3
                                     or x.get('labelThrough',0)>=first_validation
                                     or x.get('t',0)>=first_validation for x in existing):
        raise ValueError('NEO: memory compromised, oversize or heldout leakage')
    seen={x['key'] for x in existing}
    added=0
    for i in range(HISTORY-1,len(training)-HORIZON):
        if training[i+HORIZON]['t']>bound:break
        key=sample_key(symbol,training,i)
        if key in seen:continue
        if len(existing)>=CAPACITY:raise ValueError('NEO memory capacity reached; archive first')
        features=pattern_features(training,i)
        future_return=math.log(training[i+HORIZON]['c']/training[i]['c'])
        existing.append({'key':key,'t':training[i]['t'],
            'labelThrough':training[i+HORIZON]['t'],
            'features':features,'futureLogReturn':round(future_return,8)})
        seen.add(key);added+=1
    original['patterns']=existing
    original['lastIngestedAt']=datetime.now(timezone.utc).isoformat()
    original['lastSourceSnapshotAt']=snapshot.get('generatedAt')
    original['lastEligibleTrainingCandle']=min(bound,training[-1]['t'])
    original['newPatternCount']=added
    original['sourceBarCount']=len(bars)
    original['trainingOnly']=True
    original['finalHoldoutObserved']=False
    return original

def predict(memory,pattern,asof,top_k=11,embargo=15*FIVE_MIN_MS):
    """Retrieve historical past-only patterns; never reuse an open outcome."""
    if len(pattern)!=HISTORY*3 or top_k<3 or top_k>30:
        raise ValueError('NEO: invalid feature vector/k')
    matches=[]
    for record in memory['patterns']:
        if record['labelThrough']+embargo>=asof:continue
        squared=sum((a-b)**2 for a,b in zip(pattern,record['features']))
        matches.append((squared,record))
    matches.sort(key=lambda x:(x[0],x[1]['t']))
    nearest=matches[:top_k]
    if len(nearest)<top_k:
        return {'action':'FLAT','status':'INSUFFICIENT_PRIOR_PATTERNS',
            'matched':len(nearest),'estimatedNetLogReturn':None,'confidence':None}
    weighted=[1/max(math.sqrt(d),0.0001) for d,_ in nearest]
    weight_total=sum(weighted)
    estimate=sum(w*r['futureLogReturn'] for w,(_,r) in zip(weighted,nearest))/weight_total
    positives=sum(r['futureLogReturn']>ROUND_TRIP_COST for _,r in nearest)
    # Not a probability calibration: measure neighbor agreement only.
    agreement=positives/len(nearest)
    return {'action':'LONG' if estimate>ROUND_TRIP_COST and agreement>=.7 else 'FLAT',
        'status':'HISTORICAL_ANALOGUE_ONLY','matched':len(nearest),
        'estimatedNetLogReturn':round(estimate-ROUND_TRIP_COST,6),
        'confidence':round(agreement,3),
        'referenceLatestTime':max(r['labelThrough'] for _,r in nearest)}

def process_all(input_dir,root):
    input_dir,root=Path(input_dir),Path(root)
    root.mkdir(parents=True,exist_ok=True)
    snapshots={}
    for symbol in SYMBOLS:
        x=json.loads((input_dir/(symbol.replace('/','-')+'.json')).read_text())
        if x.get('symbol')!=symbol or x.get('timeframe')!='5Min':
            raise ValueError('NEO: ten authentic five-minute charts required')
        snapshots[symbol]=x
    prepared=[];totals={'known':0,'new':0}
    # Pre-validate all files before writing any; deterministic chart isolation.
    for symbol,data in snapshots.items():
        p=root/(symbol.replace('/','-')+'.json')
        previous=json.loads(p.read_text()) if p.exists() else None
        state=append_training_history(data,previous)
        prepared.append((p,state))
        totals['known']+=len(state['patterns'])
        totals['new']+=state['newPatternCount']
    for p,state in prepared:
        p.write_text(json.dumps(state,separators=(',',':'))+'\n')
    status={'schema':'SCALP_NEO_STATUS_V1',
        'name':'NEO','mode':'RESEARCH_PATTERN_MEMORY','generatedAt':datetime.now(timezone.utc).isoformat(),
        'symbols':len(prepared),'memorizedLabeledPatterns':totals['known'],
        'newPatternsThisRun':totals['new'],
        'memory':[{ 'symbol':s['symbol'],'patterns':len(s['patterns']),
                    'new':s['newPatternCount'],'sourceBars':s['sourceBarCount'],
                    'initialTrainingEnd':s['initialTrainingEnd'],
                    'firstDevelopmentCandle':s['initialDevelopmentStart']} for _,s in prepared],
        'trainingOnly':True,'paperOrders':0,'liveOrders':0,'teacherGrades':0,
        'finalHoldoutTouched':False,
        'caveat':'Immutable eligible training-pattern bank; not visual pixel memory or demonstrated profitable forecasts.'}
    (root/'latest.json').write_text(json.dumps(status,indent=2)+'\n')
    return status

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--data-dir',default='rl-5m-data/snapshots')
    p.add_argument('--root',default='neo-history/patterns')
    args=p.parse_args()
    result=process_all(args.data_dir,args.root)
    print('NEO_PATTERN_MEMORY '+json.dumps({'total':result['memorizedLabeledPatterns'],
        'new':result['newPatternsThisRun'],'holdoutTouched':False,'paperOrders':0}))
if __name__=='__main__':
    main()
