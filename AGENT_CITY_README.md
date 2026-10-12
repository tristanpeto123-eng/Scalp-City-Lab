# Scalp City Lab · Agent City (WebGL prototype)

## What is actually built

- A separate Three.js 3D city, rendered at `agent-city.html` with real geometries.
- Twelve independent agent buildings with floors, rear walls, side elevations, open front apertures, roof frames, desks, two 3D display panels, overhead signage and animated lights.
- Twelve distinct low-poly robot workers differentiated with role-specific props (scanner, scientist, engineer, tuner, analyst, inspector, archivist, scribe, judge, guardian, commander and paper operator).
- Physical glowing message conduits and animated packets following agent workflow links.
- Mobile touch orbit and pinch zoom; tap/raycast stations, plus an accessible station jump rail.
- Zoom into a building to inspect a decision, current metric, state, and chronological event explanations.
- Built-in, clearly labelled **illustrative** workflow playback. No synthetic demonstrations are presented as real results.
- An additive bridge for observed BT-01 browser events when research floor is open in a compatible browser context; these are display-only signals, never trading approvals.

## Not built yet / constraints

- The Researcher, Optimizer, Validator, Scorer, Risk Manager etc. need actual backend/runtime agent services before their decisions can be displayed as operational truth.
- WalkMyPlan can provide a separate editable architectural plan, but its residential-floorplan service does not export playable agent robots or active Three.js display textures. This prototype models structures directly in the 3D game engine.
- iPhone Safari/WebGL runtime verification still required after GitHub Pages installation; automated local tests do not prove visual quality or performance.
- Scene is procedural and low-poly rather than expensive game-character assets; Blender/Meshy asset sourcing would require a separate approved asset pipeline and human visual review.
- None of this code places brokerage orders, grants risk clearance, or executes trades.

## Installation

Upload `.github/workflows/install-agent-city.yml` to the existing `tristanpeto123-eng/Scalp-City-Lab` repository at that exact path; GitHub Actions will install the preview and run its tests. Only Lab is permitted. The installation adds an **AGENT CITY ↗** portal to the existing research floor. It does not replace `scene3d.js` or alter `Scalp-City-1`.

The installer also writes `DESIGN.md` extension and adjusts Lab service-worker cache with a Lab-only version. To undo, use GitHub to revert the installer commit.

## Live telemetry contract (view only)

The city listens for:

```js
window.ScalpCityAgentCity.ingest({
  agentId: 'BT-01',
  state: 'COMPLETED',
  decision: 'Backtest report received',
  metric: '6 strategies simulated',
  message: 'Report ID BT01-1234'
});
```

Or `BroadcastChannel('scalp-city-lab-telemetry-v1')`. External-origin status is labelled `EXTERNAL EVENT · DISPLAY ONLY`. It does **not** prove independent validation or authorize paper/live execution.

## Interaction QA after deployment

1. Open Agent City from existing research floor.
2. Confirm all 12 buildings and their roof labels render in real 3D.
3. Drag to orbit, pinch to zoom, tap Researcher robot/building, then tap CITY OVERVIEW.
4. Tap BT-01, verify both physical screens and explanatory inspector update.
5. Start SHOW WORKFLOW; verify illuminated message pulses and demo decision changes.
6. Reopen research floor: RUN/STOP and BT-01 backtesting must still function.
7. On iPhone, check canvas frame rate, control reachability, inspector dismiss, and page reload/cached assets.
