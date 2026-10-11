#!/usr/bin/env python3
"""Patch a fresh Scalp-City-1 source COPY for Scalp-City-Lab only.

The source repository is never written by this script. Abort unless target
checkout/repository identity is exactly Scalp-City-Lab.
"""
from pathlib import Path
import json
import os

root = Path.cwd()
repo = os.environ.get('GITHUB_REPOSITORY', '')
if repo and repo != 'tristanpeto123-eng/Scalp-City-Lab':
    raise SystemExit(f'ABORT: wrong GitHub repository: {repo}')
if root.name.casefold() != 'scalp-city-lab' and not (repo == 'tristanpeto123-eng/Scalp-City-Lab'):
    raise SystemExit('ABORT: working directory must be Scalp-City-Lab')
required = ['app.js','index.html','scene3d.js','sw.js','manifest.webmanifest','backtester-agent.js','training-worker.js','cfd-engine.js']
for name in required:
    if not (root/name).is_file():
        raise SystemExit(f'ABORT: missing required imported source file {name}')

def patch(name, old, new):
    p = root/name
    s = p.read_text(encoding='utf-8')
    if old not in s:
        if new in s: return
        raise SystemExit(f'ABORT: expected source pattern not present in {name}: {old[:90]!r}')
    p.write_text(s.replace(old,new),encoding='utf-8')

patch('app.js','const DB_NAME = "scalp-city-v1";','const DB_NAME = "scalp-city-lab-v1";')
patch('app.js','"scalpCityGithubMeta"','"scalpCityLabGithubMeta"')
patch('app.js','path:"knowledge",token:""','path:"knowledge-lab",token:""')
patch('app.js','||"knowledge"','||"knowledge-lab"')
patch('app.js','$("#ghRepo").value=g.repo||"";','$("#ghRepo").value=g.repo||"Scalp-City-Lab";')
patch('app.js',
      'const g=state.github;if(!g.owner||!g.repo)throw new Error("Set owner and repository");',
      'const g=state.github;if(!g.owner||!g.repo)throw new Error("Set owner and repository");if(g.owner!=="tristanpeto123-eng"||g.repo!=="Scalp-City-Lab"||g.branch!=="main"||g.path!=="knowledge-lab")throw new Error("LAB SAFETY LOCK: GitHub memory writes/reads restricted to Scalp-City-Lab main, knowledge-lab prefix");')
patch('app.js',
      'const base=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;',
      'const [filePath,...queryParts]=path.split("?");const query=queryParts.length?"?"+queryParts.join("?"):"";const base=`https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}${query}`;')
patch('app.js',
      '$("#sessionPnl").textContent=(state.sessionPnl>=0?"+£":"-£")+Math.abs(state.sessionPnl).toFixed(0);',
      '$("#sessionPnl").textContent="SIM "+(state.sessionPnl>=0?"+":"-")+Math.abs(state.sessionPnl).toFixed(0)+" pts";')
patch('app.js','log("V1 ready · enter to start training","good")','log("LAB simulation ready · training uses synthetic data unless CSV imported","good")')
patch('backtester-agent.js',"const HISTORY_KEY='scalp-city:BT-01:report-history:v1';","const HISTORY_KEY='scalp-city-lab:BT-01:report-history:v1';")
patch('index.html','<title>Research Floor — Scalp City</title>','<title>Scalp City Lab — Simulation Only</title>')
patch('index.html','<span>SCALP CITY / RESEARCH FLOOR</span>','<span>SCALP CITY LAB / SIMULATION ONLY</span>')
patch('index.html','name="apple-mobile-web-app-title" content="Scalp City"','name="apple-mobile-web-app-title" content="Scalp Lab"')
patch('index.html','id="ghRepo" placeholder="Scalp-City-1"','id="ghRepo" placeholder="Scalp-City-Lab"')
patch('index.html','id="ghPath" value="knowledge"','id="ghPath" value="knowledge-lab"')
patch('index.html','<span id="sessionPnl">+£0</span>','<span id="sessionPnl">SIM +0 pts</span>')
patch('index.html','Scalp City ships with deterministic synthetic QQQ/SPY/IWM candles. Replace any node with your own CSV.','Simulation only: deterministic synthetic QQQ/SPY/IWM candles, NOT live prices. Replace any node with your own historical CSV.')
patch('scene3d.js','LIVE NODE / 1m','REPLAY NODE / 1m')
patch('scene3d.js','SIMULATED / SESSION','CANDIDATE SUM / NOT ACCOUNT PNL')
patch('sw.js',"const CACHE='scalp-city-v1-", "const CACHE='scalp-city-lab-v1-")
patch('sw.js',"keys.filter(k=>k!==CACHE)","keys.filter(k=>k.startsWith('scalp-city-lab-')&&k!==CACHE)")
manifest_path = root/'manifest.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest.update({
    'id':'/Scalp-City-Lab/',
    'name':'Scalp City Lab — Simulation Only',
    'short_name':'Scalp Lab',
    'description':'Isolated research and simulation environment; no live trading',
})
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for ticker in ('SPY','QQQ','IWM'):
    (root/f'knowledge-champions-{ticker}.json').write_text(json.dumps({'symbol':ticker,'champion':None},indent=2)+'\n',encoding='utf-8')
(root/'knowledge-manifest.json').write_text(json.dumps({'schemaVersion':'1.0','updatedAt':None,'totalSessions':0,'lastSessionId':None,'bestOverall':None},indent=2)+'\n',encoding='utf-8')
print('PASS: isolated Lab code, GitHub path restrictions, PWA identity and cache safely patched')
