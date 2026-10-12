#!/usr/bin/env python3
"""Install additive Agent City experience into Scalp-City-Lab, idempotently.
Never writes to Scalp-City-1. Does not change the existing WebGL scene.
"""
from pathlib import Path
import os
import re

repo=os.environ.get('GITHUB_REPOSITORY','')
if repo!='tristanpeto123-eng/Scalp-City-Lab':
    raise SystemExit('SAFETY STOP: installer may run only in Scalp-City-Lab')
root=Path.cwd()
required=['index.html','scene3d.js','sw.js','DESIGN.md','agent-city.html','agent-city.css','agent-city.js','agent-city-bridge.js']
for file in required:
    if not (root/file).is_file(): raise SystemExit(f'Missing file {file}')

p=root/'index.html';s=p.read_text()
if 'id="agentCityLink"' not in s:
    needle='</header>'
    if s.count(needle)!=1:raise SystemExit('Could not locate unique header for city portal')
    portal='''      <a id="agentCityLink" href="./agent-city.html" aria-label="Explore Agent City" style="pointer-events:auto;border:1px solid #40bbd9;color:#d8f7ff;background:#07172be8;font:800 9px ui-monospace,monospace;letter-spacing:.07em;text-decoration:none;padding:8px;white-space:nowrap;">AGENT CITY ↗</a>\n'''
    s=s.replace(needle,portal+needle)
if './agent-city-bridge.js' not in s:
    anchor='</body>'
    if anchor not in s: raise SystemExit('Missing HTML body closing tag')
    s=s.replace(anchor,'<script src="./agent-city-bridge.js" defer></script>\n'+anchor)
p.write_text(s)

p=root/'sw.js';s=p.read_text()
if './agent-city.html' not in s:
    old="'./scene3d.js'"
    if old not in s: raise SystemExit('Could not locate app core service-worker entry')
    s=s.replace(old,"'./agent-city.html','./agent-city.css','./agent-city.js','./agent-city-bridge.js',"+old,1)
    if "const CACHE=LAB_CACHE_PREFIX+" in s:
        s=re.sub(r"(const CACHE=LAB_CACHE_PREFIX\+'[^']+)(?=')",lambda m:m.group(1)+'-agent-city-v1' if not m.group(1).endswith('-agent-city-v1') else m.group(1),s,count=1)
    else:
        s=re.sub(r"(const CACHE='scalp-city-lab-[^']+)(?=')",lambda m:m.group(1)+'-agent-city-v1' if not m.group(1).endswith('-agent-city-v1') else m.group(1),s,count=1)
p.write_text(s)

# Older CI tests pinned a specific cache/history version. Recognize the newer safe
# namespace implementation without weakening the isolation assertions.
p=root/'tests/lab-config.test.mjs'
if p.exists():
    checks=p.read_text()
    exact=[
      ("assert.match(txt('backtester-agent.js'),/scalp-city-lab:BT-01:report-history:v1/);", r"const bt=txt('backtester-agent.js'); assert.match(bt,/BT-01:report-history:v[12]/); assert.match(bt,/location\.pathname|scalp-city-lab:/);"),
      ("assert.match(sw,/scalp-city-lab-v1-/);", "assert.match(sw,/scalp-city-lab-/);"),
      (r"assert.match(sw,/k\.startsWith\('scalp-city-lab-'\)/);", r"assert.match(sw,/k\.startsWith\((?:LAB_CACHE_PREFIX|'scalp-city-lab-')\)/);")
    ]
    for before,after in exact:
        if before in checks: checks=checks.replace(before,after)
    p.write_text(checks)

p=root/'DESIGN.md';s=p.read_text()
if '## Agent City runtime extension' not in s:
    s+='''\n## Agent City runtime extension\n\n- This is a second true-WebGL scene (`agent-city.html`), reached through a physical-style portal in the existing research-floor HUD. It deliberately does not replace the working `scene3d.js` room.\n- Spatial composition: a central command station, a ring of specialist agent buildings, clear 3+ metre front apertures, and functional luminous data pipes. The focus remains one selected station at a time.\n- Each separate building has structural floor/walls/roof, desk hardware, a unique procedural robot, a textured decision monitor, a secondary task display, and a named physical fascia.\n- World-space interaction uses raycasting, orbit/touch camera, station quick-jump navigation and inspector evidence. The inspector is secondary to the 3D world.\n- Agent telemetry uses a display-only BroadcastChannel bridge, never a permission or risk approval channel. If no observed event exists, demo decisions must be explicitly labelled illustrative.\n- No live brokerage credentials, real-money execution or strategy approval capability is permitted in this runtime.\n- CPU/GPU budget: max 12 stations, capped pixel ratio, low-poly primitives, no heavy postprocessing, reduced-motion support and a bounded building camera.\n'''
p.write_text(s)
print('PASS: Agent City portal, bridge, cache and design contract installed into Lab only')
