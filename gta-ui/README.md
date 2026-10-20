# Scalp City / 3D phone-world UI test

**Status:** isolated UI experiment. It adds no broker execution paths, no account keys, no training mutations and no changes to the Lab main branch.

## Start

From the repository root, serve the files over HTTP (not file://) and open /gta-ui/.

    python3 -m http.server 8000

Then visit http://localhost:8000/gta-ui/. An HTTPS static host also works. The WebGL world loads the same pinned Three.js CDN used by the existing Scalp City scene, so an internet connection is needed to load its renderer.

## Controls

- Desktop: WASD to walk; drag on the scene to look around; Shift to walk faster; E within lift range to travel to the next floor; P to show/hide the phone.
- iPhone/touch: drag scene to look; hold on-screen arrows to walk; tap Enter Lift near the door; tap Phone for apps; tap Floors for quick travel.
- Tap a robot to inspect its department and open the associated existing functional application.
- On the phone, choose an app icon. An original Lab page opens in an embedded browser. Expand to run it full-size. Phone Home returns to the app grid.

## Floors

1. Mission Control: overview and operations.
2. Research Lab: historical training and NEO pattern analysis.
3. Robot Academy: ten illustrative robot pupils.
4. Teacher's Office: examination / evidence verification.
5. Trading Floor: read-only PAPER gate status, no trading functionality.
6. Operations: scheduler telemetry and 5-minute replay.

The rooms have no opaque ceiling. Floor changes are teleports, rather than loading an additional whole simulation.

## Truthful data and route policy

The phone's Lab, Academy, Teacher, Mission Control, Replay, NEO and Agent City apps embed their existing source files via same-origin iframes. Their working forms and internal tabs remain owned by those pages.

As inspected on the parent Lab main branch, the navigation advertises training-monitor.html and trading-floor.html but those routes are absent from the checked tree. Their phone icons therefore display explicit read-only native views rather than a 404 or fictional execution. The monitor fetches the saved research-data/training-monitor.json; the PAPER desk fetches research-data/robot-academy.json. Published/last-lesson timestamps are displayed and previously measured evaluations per second must not be described as live throughput. Historical training progress does not authorise forward-paper access or predict profit.

Robot movement, lighting, props and screens are illustrative unless independently connected to verified telemetry. This interface does not issue orders.

## QA

The GitHub Actions workflow .github/workflows/gta-phone-ui.yml checks JavaScript syntax and runs a no-dependency route/safety smoke test. For the visual acceptance pass, verify:
- iPhone portrait: drag camera without accidental teleport, walk using arrows, open phone and switch apps.
- Desktop: WASD, click robots without camera reset, approach lift and use E, then use Floor menu.
- Phone apps: embedded Academy and Teacher retain their real controls; full-size view / collapse work.
- Failure fallback: app phone and floor selector still work if WebGL/CDN is unavailable.
- Verify no calls to paper/live brokerage were added by this UI.

## Isolation

Source branch: test/gta-phone-world-v1 in Scalp-City-Lab. A separate repository cannot currently be created through the available GitHub connector, so this branch is deliberately isolated until an empty repository is supplied or a maintainer creates it. No merge, GitHub Pages setting change or production deployment has been performed.
