"""Durable, fail-closed Alpaca PAPER-only order intent journal.

Single process on ONE trusted private host / persistent filesystem. The
file lock covers the broker POST, and the committed INTENT survives ambiguous
broker responses. Never use GitHub Actions ephemeral storage as a writer.
"""
from __future__ import annotations

from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path

GENESIS = '0' * 64
KINDS = {'INTENT', 'ACK'}
SCHEMA = 'SCALP_PAPER_INTENT_CHAIN_V1'
MAX_BYTES = 8 * 1024 * 1024


class JournalError(Exception):
    pass


def _canon(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def _digest(value):
    return hashlib.sha256(_canon(value).encode('ascii')).hexdigest()


class PaperIntentJournal:
    def __init__(self, root):
        self.root = Path(root)
        if not self.root.is_absolute() or self.root.is_symlink():
            raise JournalError('Private persistent journal root must be absolute and not a symlink')
        self.journal = self.root / 'paper-intents.jsonl'
        self.lockfile = self.root / 'paper-intents.lock'
        self._locked = False
        self._fd = None

    def _prepare(self):
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        if self.root.is_symlink() or self.root.stat().st_mode & 0o077:
            raise JournalError('Private journal directory cannot be accessible by other users')
        for file in (self.journal, self.lockfile):
            if file.is_symlink():
                raise JournalError('Refusing symlink in private paper journal')

    @contextmanager
    def writer(self):
        """Exclusive advisory lock, must be held through the broker request."""
        self._prepare()
        fd = os.open(self.lockfile, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        try:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise JournalError('Concurrent paper writer already owns this host volume') from exc
            self._fd = fd
            self._locked = True
            self.read_verified()
            try:
                yield self
            finally:
                self._locked = False
                self._fd = None
                fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)

    def read_verified(self):
        self._prepare()
        if not self.journal.exists():
            return []
        if self.journal.is_symlink():
            raise JournalError('Refusing symlinked journal')
        if self.journal.stat().st_size > MAX_BYTES:
            raise JournalError('Paper journal exceeds safe bounded history')
        data = self.journal.read_bytes()
        if data and not data.endswith(b'\n'):
            raise JournalError('Truncated journal record: order safety cannot be established')
        out, prev = [], GENESIS
        intents, acked = set(), set()
        for i, raw in enumerate(data.splitlines(), 1):
            try:
                obj = json.loads(raw)
            except (ValueError, UnicodeDecodeError) as exc:
                raise JournalError('Corrupted journal record') from exc
            if (not isinstance(obj, dict) or set(obj) !=
                {'schema', 'seq', 'prev', 'kind', 'data', 'sha256'} or
                obj['schema'] != SCHEMA or obj['seq'] != i or
                obj['prev'] != prev or obj['kind'] not in KINDS or
                not isinstance(obj['data'], dict)):
                raise JournalError('Journal chain sequence/structure mismatch')
            calculated = _digest({k: obj[k] for k in obj if k != 'sha256'})
            if obj['sha256'] != calculated:
                raise JournalError('Journal hash chain altered')
            record = obj['data']
            client = record.get('clientOrderId')
            if not isinstance(client, str) or not client.startswith('SCALPDEMO5M-'):
                raise JournalError('Unrecognised broker order namespace')
            if obj['kind'] == 'INTENT':
                if client in intents or not _valid_intent(record):
                    raise JournalError('Duplicate or invalid model-bound paper intent')
                intents.add(client)
            else:
                if client not in intents or client in acked or not _valid_ack(record):
                    raise JournalError('Out-of-order or malformed paper acknowledgement')
                acked.add(client)
            out.append(obj)
            prev = calculated
        return out

    def unresolved(self):
        records = self.read_verified()
        intents = {x['data']['clientOrderId'] for x in records if x['kind'] == 'INTENT'}
        acked = {x['data']['clientOrderId'] for x in records if x['kind'] == 'ACK'}
        return intents - acked

    def append(self, kind, data):
        if not self._locked or self._fd is None:
            raise JournalError('Only exclusive host writer may mutate the intent journal')
        if kind not in KINDS or not isinstance(data, dict):
            raise JournalError('Invalid journal event')
        old = self.read_verified()
        if self.unresolved():
            raise JournalError('Unresolved previous order: human broker reconciliation required')
        if kind == 'INTENT':
            if not _valid_intent(data):
                raise JournalError('Invalid or unsigned frozen model intent')
            if any(x['data']['clientOrderId'] == data['clientOrderId'] for x in old):
                raise JournalError('Repeated client order ID cannot re-submit')
        else:
            if not _valid_ack(data) or not old or old[-1]['kind'] != 'INTENT' or (
                old[-1]['data']['clientOrderId'] != data['clientOrderId']
            ):
                raise JournalError('ACK must reconcile the immediately preceding intent')
        obj = {'schema': SCHEMA, 'seq': len(old) + 1,
               'prev': old[-1]['sha256'] if old else GENESIS,
               'kind': kind, 'data': data}
        obj['sha256'] = _digest(obj)
        line = (_canon(obj) + '\n').encode('ascii')
        if self.journal.exists() and self.journal.stat().st_size + len(line) > MAX_BYTES:
            raise JournalError('Journal full, no orders')
        flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW
        fd = os.open(self.journal, flags, 0o600)
        try:
            if os.fstat(fd).st_mode & 0o077:
                raise JournalError('Journal file permissions expose private evidence')
            os.write(fd, line)
            os.fsync(fd)
        finally:
            os.close(fd)
        # Ensure first creation is durable across a host restart.
        dirfd = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(dirfd)
        finally:
            os.close(dirfd)
        return obj

    def export_observer_receipt(self):
        """Sanitized READ ONLY envelope; no secrets/account ID or authority."""
        records = self.read_verified()
        return {
            'schema': 'SCALP_PAPER_OBSERVER_RECEIPT_V1',
            'source': SCHEMA,
            'paperOnly': True, 'brokerOrdersSubmitted': False,
            'verifiedHashChain': True,
            'modelIntents': [
                {'clientOrderId': r['data']['clientOrderId'],
                 'symbol': r['data']['symbol'],
                 'modelSha256': r['data']['modelSha256'],
                 'accountFingerprint': r['data']['accountFingerprint'],
                 'paperOnly': True,
                 'readOnlyProvenance': True,
                 'chainSha256': r['sha256']}
                for r in records if r['kind'] == 'INTENT'
            ],
            'unresolvedClientIds': sorted(self.unresolved()),
            'latestChainHash': records[-1]['sha256'] if records else GENESIS,
            'forwardVerified': False, 'teacherGrades': 0, 'liveOrders': 0
        }


def _is_sha(value):
    return (isinstance(value, str) and len(value) == 64 and
            all(x in '0123456789abcdef' for x in value))


def _valid_intent(x):
    return (isinstance(x.get('clientOrderId'), str) and
            x['clientOrderId'].startswith('SCALPDEMO5M-') and
            x.get('side') in ('buy', 'sell') and
            isinstance(x.get('symbol'), str) and x['symbol'].endswith('/USD') and
            _is_sha(x.get('modelSha256')) and
            _is_sha(x.get('accountFingerprint')) and
            isinstance(x.get('sourceCandleMs'), int) and x['sourceCandleMs'] > 0 and
            x.get('paperOnly') is True and x.get('liveOrders') == 0 and
            x.get('maxOrderUsd') == 10.0)


def _valid_ack(x):
    return (isinstance(x.get('clientOrderId'), str) and
            x['clientOrderId'].startswith('SCALPDEMO5M-') and
            isinstance(x.get('brokerOrderId'), str) and bool(x['brokerOrderId']) and
            isinstance(x.get('providerStatus'), str) and bool(x['providerStatus']) and
            x.get('paperOnly') is True)
