"""Private Railway commissioning host: never places even demo-money orders.

This intentionally runs without the PyTorch executor installed. Broker access
is GET-only. Shared Alpaca PAPER credentials can be referenced from the
existing Teacher service through Railway's secret reference mechanism.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PAPER = 'https://paper-api.alpaca.markets'
APP = 'SCALP_SHARED_PAPER_COMMISSION_V1'
JOURNAL_DIR = Path('/data/scalp-paper')
MAX_HISTORY = 500
EXPECTED_DISABLED = ('', 'OFF', 'NO', 'false', '0')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise ValueError('Unexpected PAPER redirect')


def _broker_get(path, key, secret, transport=None):
    if path not in ('/v2/account', '/v2/positions',
                    '/v2/orders?status=all&limit=500'):
        raise ValueError('Only approved PAPER GET endpoints can be requested')
    url = PAPER + path
    if transport is not None:
        return transport(url, 'GET', {'APCA-API-KEY-ID': key,
                                      'APCA-API-SECRET-KEY': secret})
    req = urllib.request.Request(url, method='GET',
       headers={'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret,
                'Accept': 'application/json'})
    with urllib.request.build_opener(NoRedirect).open(req, timeout=8) as response:
        if response.status != 200:
            raise ValueError('Broker preflight refused request')
        return json.load(response)


def _source_credentials(env):
    raw = env.get('SCALP_EXISTING_TEACHER_PAPER_CREDENTIALS_JSON', '')
    symbol = env.get('SCALP_EXISTING_TEACHER_SOURCE_SYMBOL', 'BTC/USD')
    if not re.fullmatch(r'(BTC|ETH|SOL|XRP|ADA|AVAX|LINK|DOGE|LTC|BCH)/USD', symbol):
        return None, 'INVALID_SOURCE_SYMBOL'
    if not raw:
        return None, 'CREDENTIAL_REFERENCE_MISSING'
    try:
        parsed = json.loads(raw)
        entry = parsed.get(symbol)
        if (not isinstance(parsed, dict) or
            not isinstance(entry, dict) or
            not isinstance(entry.get('key'), str) or
            not isinstance(entry.get('secret'), str) or
            not entry['key'] or not entry['secret']):
            return None, 'PAPER_CREDENTIAL_SOURCE_NOT_FOUND'
        return (entry['key'], entry['secret'], symbol), 'SOURCE_CONFIGURED'
    except (TypeError, ValueError):
        return None, 'PAPER_CREDENTIAL_REFERENCE_INVALID'


def private_storage_status(root=JOURNAL_DIR):
    if not root.is_absolute() or root.is_symlink():
        return False
    try:
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        if root.is_symlink():
            return False
        mode = stat.S_IMODE(root.stat().st_mode)
        if mode & 0o077:
            return False
        # Permanent canary proves the mount is writable. No raw account data.
        canary = root / 'read-only-host-ready'
        if canary.is_symlink():
            return False
        if not canary.exists():
            fd = os.open(canary, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                         os.O_NOFOLLOW, 0o600)
            try:
                os.write(fd, b'PAPER_READ_ONLY_HOST_V1\\n')
                os.fsync(fd)
            finally:
                os.close(fd)
        if canary.read_bytes() != b'PAPER_READ_ONLY_HOST_V1\\n':
            return False
        return True
    except OSError:
        return False


def read_only_preflight(env, transport=None):
    """GET-only report. Missing expected account UUID blocks commissioning."""
    source, status = _source_credentials(env)
    response = {'status': status, 'accountFingerprint': None,
                'accountIdentityPinned': False, 'paperOrdersSubmitted': 0,
                'liveOrdersSubmitted': 0, 'brokerWriteEnabled': False,
                'teacherGradingEnabled': False, 'brokerEndpoint': 'PAPER_ONLY'}
    if source is None:
        return response
    key, secret, symbol = source
    try:
        account = _broker_get('/v2/account', key, secret, transport)
        orders = _broker_get('/v2/orders?status=all&limit=500', key, secret, transport)
        positions = _broker_get('/v2/positions', key, secret, transport)
        if (not isinstance(account, dict) or
            account.get('status') != 'ACTIVE' or
            not isinstance(account.get('id'), str) or not account['id'] or
            not isinstance(orders, list) or len(orders) >= MAX_HISTORY or
            not isinstance(positions, list) or
            account.get('trading_blocked') not in (False, None) or
            account.get('account_blocked') not in (False, None)):
            return {**response, 'status': 'PAPER_ACCOUNT_HISTORY_OR_STATUS_UNVERIFIED'}
        expected = env.get('SCALP_DEMO_PAPER_ACCOUNT_ID', '')
        verified = bool(expected and expected == account['id'])
        fingerprint = hashlib.sha256(account['id'].encode('utf8')).hexdigest()[:12]
        return {**response, 'status': 'PAPER_READ_ONLY_ACCOUNT_VERIFIED'
                if verified else 'PAPER_ACCOUNT_OBSERVED_AWAITING_ID_PIN',
                'accountFingerprint': fingerprint,
                'accountIdentityPinned': verified,
                'mappedCredentialSymbol': symbol,
                'historicalOrderCount': len(orders),
                'openPositionCount': len(positions)}
    except (ValueError, TypeError, OSError, urllib.error.URLError):
        return {**response, 'status': 'PAPER_ACCOUNT_READ_ONLY_PREFLIGHT_FAILED'}


def report_status(env=None, root=JOURNAL_DIR, transport=None):
    env = env if env is not None else os.environ
    storage_ok = private_storage_status(root)
    remote = read_only_preflight(env, transport) if (
        storage_ok and env.get('SCALP_READ_ONLY_ACCOUNT_PREFLIGHT') == 'YES') else {
           'status':'GET_ONLY_PREFLIGHT_NOT_REQUESTED',
           'brokerWriteEnabled':False,'paperOrdersSubmitted':0}
    return {'schema': APP, 'service': 'SCALP_PAPER_PASSIVE_COMMISSIONER',
            'storageReady': storage_ok, 'writerEnabled':False,
            'mode':'READ_ONLY_COMMISSIONING','paperOrdersSubmitted':0,
            'liveOrdersSubmitted':0,'account':remote}


class Handler(BaseHTTPRequestHandler):
    state = {}
    def do_GET(self):
        if self.path != '/health':
            self.send_error(404)
            return
        body = json.dumps(type(self).state, sort_keys=True).encode()
        self.send_response(200 if type(self).state.get('storageReady') else 503)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # No URLs, account IDs, query params or credentials in logs.
        pass


def main():
    port = int(os.environ.get('PORT', '8080'))
    if not 1 <= port <= 65535:
        raise SystemExit('Invalid private health port')
    Handler.state = report_status()
    status = Handler.state
    print('SCALP_PAPER_COMMISSION '+json.dumps({
        'mode':'READ_ONLY','storageReady':status['storageReady'],
        'paperOrdersSubmitted':0,
        'accountStatus':status['account']['status'],
        'accountFingerprint':status['account'].get('accountFingerprint')
    }),flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()


if __name__ == '__main__':
    main()
