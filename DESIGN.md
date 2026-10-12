---
version: alpha
name: "Scalp City"
description: "A cinematic three-dimensional autonomous trading research room where product controls are embedded into a neon physical workstation."
colors:
  ink: "#020208"
  obsidian: "#070610"
  screen: "#03050D"
  violet: "#6F37FF"
  magenta: "#FF2DCE"
  cyan: "#27D7FF"
  green: "#35FFA7"
  red: "#FF315F"
  gold: "#FFD35A"
  text: "#F2EDFF"
  muted: "#8F89A8"
typography:
  display:
    fontFamily: "Haettenschweiler, 'Arial Narrow Bold', 'Arial Narrow', sans-serif"
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
rounded:
  DEFAULT: "0.3125rem"
  sm: "0.1875rem"
  md: "0.375rem"
  lg: "0.5rem"
spacing:
  scene-gutter: "4vw"
  monitor-gap: "1.25vw"
components:
  monitor: {}
  console-key: {}
  dialog: {}
  status-beacon: {}
---

# Scalp City Design System

## Overview

### Creative North Star
Scalp City is a cinematic 3D neon trading room viewed from inside the operator floor: dark purple-black skyline, lit windows, glossy floor grid, physical angled monitors, magenta/cyan/gold practical lighting, a robot at a curved operator desk, and concentric floor rings. The interface should feel like a place the user occupies rather than a dashboard composited on top of a wallpaper.

### Product context and register
- **Audience and primary job:** a single operator runs and watches autonomous strategy research on phone or desktop, inspects QQQ/SPY/IWM, imports data, and saves accumulated knowledge.
- **Target market(s) and evidence:** general English-language personal research tool; no market-specific rules are inferred.
- **Locale(s) and language policy:** English UI, numeric/data labels kept concise.
- **Usage scene:** especially iPhone portrait, full-screen and visually immersive; dense live telemetry must remain legible without scrolling the main scene.
- **Register:** hybrid product/experience. Core actions remain familiar, but the shell is strongly spatial and cinematic.
- **Memorable signature:** a real WebGL research floor where chart canvases are mapped onto physical 3D monitor meshes, the robot faces the workstation, console controls are raycastable hardware on the desk, and near-camera room pillars visibly occlude the skyline during camera movement.
- **Restraint:** charts, log text, forms and session-saving states stay utilitarian and quiet.
- **Anti-references:** generic SaaS dashboards, rounded glass cards, floating app navigation, flat neon wallpaper, and marketing-site hero layouts.
- **Token ownership/runtime mapping:** this file mirrors the canonical values implemented as CSS variables in `styles.css`; 3D emissive colors in `scene3d.js` use the same values.

## Colors
The base world is near-black `ink`/`obsidian`. Violet and magenta create environmental depth; cyan and green communicate data/state; gold marks physical hardware and emphasis; red is reserved for stop/error. Monitor surfaces remain nearly black so charts carry contrast. Focus uses cyan. There is no light theme because the scene identity depends on practical emissive lighting.

## Typography
Display signage uses a condensed industrial fallback stack. Interface copy uses the system sans stack. Charts, telemetry, logs and control legends use the mono stack. Uppercase is reserved for hardware labels and scene signage, not prose.

## Layout
The primary document is one visual viewport occupied by a perspective camera: a framed glass city window and ceiling structure establish the room, a neon sign and three-monitor market bank hang above a physical multi-monitor research wall, and a robot, curved desk, hardware props, floor rings and telemetry slab occupy the foreground. The main scene itself does not scroll; modal terminals own their internal scrolling. Mobile portrait is the primary composition, with monitor edges allowed to crop slightly to reinforce camera proximity rather than compress into a dashboard grid.

## Elevation & Depth
Depth comes from the WebGL camera, fog, floor reflections, 3D monitor frames, physical desk/robot geometry and restrained monitor perspective. Screens are emissive MeshStandardMaterial surfaces recessed inside lit bezels; depth comes from real mesh thickness, mounting arms, room-shell occlusion, cast shadows, fog and camera parallax rather than CSS card shadows. Blur is limited to modal backdrops and atmospheric bloom.

## Shapes
Hardware is mostly squared with small radii and occasional clipped trapezoids; avoid pill-heavy UI. Circular geometry is reserved for physical controls, robot parts and floor rings.

## Components
### Foundational visual states
Interactive controls have explicit hover, focus-visible, pressed and disabled states. Busy state must preserve dimensions. Green indicates active/success, red stop/error, cyan focus/data, gold emphasis.

### Buttons and actions
RUN, DATA, MEM and EXIT are physical WebGL console keys activated by raycasting, not navigation cards. STOP and SYNC are round hardware controls. Hidden semantic button twins own the underlying product actions and disabled state; EXIT remains disabled until a session exists.

### Navigation and data display
There is no conventional tab bar. Ticker monitors are real buttons that switch the main chart. Telemetry stays in the bottom rail. Charts keep semantic text labels outside the canvas where needed.

### Forms and overlays
Data and GitHub configuration use app-owned terminal dialogs with bounded viewport height, Escape dismissal and focus restoration through native `<dialog>`. Native select behavior is intentionally accepted inside the utility terminal. Secret input is masked by default and has a show/hide action.

### Iconography
Use minimal symbols only where they communicate hardware or state. Text labels remain mandatory on all controls.

### Motion
Motion is slow camera parallax, robot idle movement, floor-ring motion and subtle live-light pulsing. Nothing bounces. `prefers-reduced-motion` removes decorative motion while preserving interaction state.

### Content and data visualization
Voice is terse and operational. Charts use green/red candles, gold VWAP and cyan EMA. Numeric telemetry uses tabular mono styling.

## Do's and Don'ts
- **Do:** preserve the feeling of being inside a physical command room.
- **Do:** keep functional IDs and actions stable while moving their presentation into the scene.
- **Don't:** reintroduce floating rounded dashboard cards or a mobile bottom-nav aesthetic.
- **Don't:** use glow as a substitute for depth; depth should come from geometry, lighting and perspective.
- **Do:** if WebGL/CDN loading fails, show the cinematic concept fallback plus a compact functional control strip rather than restoring the old flat dashboard.

## Agent City runtime extension

- This is a second true-WebGL scene (`agent-city.html`), reached through a physical-style portal in the existing research-floor HUD. It deliberately does not replace the working `scene3d.js` room.
- Spatial composition: a central command station, a ring of specialist agent buildings, clear 3+ metre front apertures, and functional luminous data pipes. The focus remains one selected station at a time.
- Each separate building has structural floor/walls/roof, desk hardware, a unique procedural robot, a textured decision monitor, a secondary task display, and a named physical fascia.
- World-space interaction uses raycasting, orbit/touch camera, station quick-jump navigation and inspector evidence. The inspector is secondary to the 3D world.
- Agent telemetry uses a display-only BroadcastChannel bridge, never a permission or risk approval channel. If no observed event exists, demo decisions must be explicitly labelled illustrative.
- No live brokerage credentials, real-money execution or strategy approval capability is permitted in this runtime.
- CPU/GPU budget: max 12 stations, capped pixel ratio, low-poly primitives, no heavy postprocessing, reduced-motion support and a bounded building camera.
