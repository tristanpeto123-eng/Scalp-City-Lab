"""Shared-account pilot: one PAPER writer with persistent lock and owner gates.

Only appropriate for one private process on one durable volume. Not a
distributed lock, not enabled on ephemeral GitHub Actions runners. Teacher
must consume READ-ONLY broker/ledger evidence on the same account.
"""
from __future__ import annotations

import hashlib
import math
import os
from pathlib import Path

from paper_sandbox.paper_executor import (
    PREFIX, FailClosed, preflight, paper_decision
)
from paper_sandbox.shared_ledger import PaperIntentJournal, JournalError


FINAL = {'filled', 'canceled', 'cancelled', 'expired', 'rejected', 'done_for_day'}


def _owned_history(snapshot, journal, symbol):
    """Fail closed on unknown demo broker events or unowned pooled inventory."""
    orders,positions=snapshot['orders'],snapshot['positions']
    events=journal.read_verified()
    intents={e['data']['clientOrderId']:e['data'] for e in events if e['kind']=='INTENT'}
    acks={e['data']['clientOrderId']:e['data'] for e in events if e['kind']=='ACK'}
    expected_hash=hashlib.sha256(snapshot['account']['id'].encode()).hexdigest()
    if journal.unresolved():
        raise FailClosed('Unresolved prior demo POST; external reconciliation required')
    for o in orders:
        if not isinstance(o,dict):
            raise FailClosed('Untrusted paper broker order')
        client=o.get('client_order_id','')
        if o.get('status') not in FINAL:
            raise FailClosed('Outstanding PAPER order; exclusive writer cannot proceed')
        if client.startswith(PREFIX):
            if client not in intents or client not in acks:
                raise FailClosed('Unattributed previous pupil PAPER order')
            bound=intents[client]
            ack=acks[client]
            if (bound['accountFingerprint']!=expected_hash or
                bound['symbol']!=o.get('symbol') or
                bound['side']!=o.get('side') or
                o.get('id')!=ack['brokerOrderId']):
                raise FailClosed('Pupil broker order differs from durable model-bound ledger')
        elif o.get('symbol')==symbol:
            # Even historical Teacher orders in the same symbol may have
            # incurred shared coin-denominated fees; no safe allocation yet.
            raise FailClosed('Shared symbol used by Teacher: inventory/fee attribution ambiguous')
    if len(positions)>1 or any(
        p.get('symbol','').replace('/','') != symbol.replace('/','')
        for p in positions
    ):
        raise FailClosed('Foreign/pooled position in shared PAPER account')
    if positions:
        # Reject any holding without positive, source-confirmed DEMO inventory.
        net_units=0.0
        for order in orders:
            if not order.get('client_order_id','').startswith(PREFIX):
                continue
            try:
                qty=float(order.get('filled_qty',''))
            except (ValueError, TypeError) as exc:
                raise FailClosed('Unverified quantity in broker order') from exc
            if not math.isfinite(qty) or qty<0:
                raise FailClosed('Invalid broker filled quantity')
            net_units+=qty if order.get('side')=='buy' else -qty
        try:
            held=float(positions[0]['qty'])
        except (ValueError, KeyError, TypeError) as exc:
            raise FailClosed('Invalid broker PAPER position quantity') from exc
        # Crypto fees may be deducted in coin. Bound tolerated difference
        # conservatively; never claim exact cost or use as grade evidence.
        if not math.isfinite(held) or held<=0 or net_units<=0 or (
            held>net_units+1e-8 or net_units-held>max(1e-8,net_units*.02)
        ):
            raise FailClosed('Pooled position ownership or CFEE cannot be established')
    return {'sourceBoundOrders':len(intents),'acknowledgedOrders':len(acks),
            'teacherObservationOnly':True,'unresolved':0,'paperOnly':True}


def _runtime_gates(env):
    if env.get('GITHUB_ACTIONS')=='true':
        raise FailClosed('Ephemeral GitHub Actions cannot be the shared PAPER account writer')
    if env.get('SCALP_SHARED_ACCOUNT_MODE')!='SINGLE_WRITER_TEACHER_READ_ONLY':
        raise FailClosed('Shared account not pinned to single-writer read-only-Teacher mode')
    if env.get('SCALP_SHARED_PAPER_APPROVED')!='EXACT_SHARED_PAPER_PILOT_V1':
        raise FailClosed('Explicit PAPER-only owner activation release is absent')
    if env.get('SCALP_SHARED_TEACHER_WRITES_OFF')!='YES':
        raise FailClosed('Teacher independent paper writer is not confirmed disabled')
    if env.get('SCALP_DEMO_PAPER_ENABLED')!='YES_DEMO_ONLY':
        raise FailClosed('Existing tiny demo PAPER execution switch is OFF')
    path=env.get('SCALP_SHARED_ACCOUNT_JOURNAL_DIR','')
    if not path.startswith('/data/') or path.endswith('/..') or '/../' in path:
        raise FailClosed('Private persistent /data journal required; never GitHub/temporary disk')
    return PaperIntentJournal(path)


def shared_cycle(*,env,model_file,now=None,transport=None,execute=False):
    """Review-only unless every dedicated shared-account gate is satisfied."""
    snapshot=preflight(env=env,transport=transport,shared_mode=True)
    if not execute:
        return {'status':'SHARED_PAPER_PREFLIGHT_ONLY',
          'accountFingerprint':snapshot['accountFingerprint'],
          'historicalOrders':len(snapshot['orders']),
          'paperOnly':True,'teacherReadOnly':True,
          'paperOrdersSubmitted':0,'liveOrders':0,
          'warning':'No account sharing or broker order enabled by preflight'}
    journal=_runtime_gates(env)
    try:
        with journal.writer():
            # Re-read account under the exclusive SAME-HOST journal lock.
            snapshot=preflight(env=env,transport=transport,shared_mode=True)
            provenance=_owned_history(snapshot,journal,env.get('SCALP_DEMO_SYMBOL','BTC/USD'))
            result=paper_decision(
                env=env,model_file=model_file,now=now,transport=transport,
                execute=True,shared_mode=True,
                on_intent=lambda event: journal.append('INTENT',event),
                on_ack=lambda event: journal.append('ACK',event)
            )
            return {**result,'singleWriter':True,
              'teacherReadOnly':True,'provenance':provenance,
              'privateAuditChainHash':journal.export_observer_receipt()['latestChainHash']}
    except JournalError as exc:
        raise FailClosed('Shared account durable audit blocked: '+str(exc)) from exc
