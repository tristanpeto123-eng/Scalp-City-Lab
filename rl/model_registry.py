"""Immutable model-version snapshots, separate from continuing RL learners.

Freezing is not graduation. Independent signed PAPER examiner + user approval
must happen outside this module before the trading floor accepts any model.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path

SCHEMA='SCALP_IMMUTABLE_MODEL_RELEASE_V1'
def sha(blob):
    return hashlib.sha256(blob).hexdigest()
def freeze_candidate(*,symbol,learned_weights,registry_dir,source_run_sha,
                     owner_release_id=None):
    if not symbol.endswith('/USD') or not symbol.replace('/','').isalnum():
        raise ValueError('Invalid symbol')
    if not isinstance(source_run_sha,str) or len(source_run_sha)!=64 or any(
        c not in '0123456789abcdef' for c in source_run_sha):
        raise ValueError('Source provenance SHA required')
    content=Path(learned_weights).read_bytes()
    if not content or len(content)>100_000_000:
        raise ValueError('Missing/oversized checkpoint')
    digest=sha(content)
    dest=Path(registry_dir)
    model_file=dest/(symbol.replace('/','-')+'-'+digest+'.pt')
    manifest=dest/(symbol.replace('/','-')+'-'+digest+'.json')
    if model_file.exists():
        if model_file.read_bytes()!=content:
            raise ValueError('Existing model bytes do not match immutable digest')
        if not manifest.exists():
            raise ValueError('Missing existing frozen manifest')
        existing=json.loads(manifest.read_text())
        if existing.get('modelSha256')!=digest or existing.get('sourceRunSha256')!=source_run_sha:
            raise ValueError('Frozen manifest or lineage differs')
        return existing
    dest.mkdir(parents=True,exist_ok=True)
    entry={'schema':SCHEMA,'symbol':symbol,'modelSha256':digest,
           'sourceRunSha256':source_run_sha,
           'origin':'RL_LEARNER_CHECKPOINT',
           'modelLocked':True,'continuesLearning':False,
           'parallelResearchLearnerMayContinue':True,
           'graduated':False,'signedGradeVerified':False,
           'tradingFloorAdmitted':False,'paperOrders':0,'liveOrders':0}
    # 'owner_release_id' is for traceability only, never an authorization.
    if owner_release_id:entry['ownerReleaseReference']=str(owner_release_id)[:120]
    model_file.write_bytes(content)
    manifest.write_text(json.dumps(entry,sort_keys=True,indent=2)+'\n')
    return entry

def validate_locked_checkpoint(file,manifest_file):
    data=json.loads(Path(manifest_file).read_text())
    if data.get('schema')!=SCHEMA or data.get('modelLocked') is not True or (
        sha(Path(file).read_bytes())!=data.get('modelSha256')):
        raise ValueError('Locked model failed immutable SHA verification')
    if data.get('tradingFloorAdmitted') or data.get('signedGradeVerified'):
        raise ValueError('This registry cannot itself verify grading')
    return data
