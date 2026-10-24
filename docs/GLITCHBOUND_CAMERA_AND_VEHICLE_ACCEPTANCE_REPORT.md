# GLITCHBOUND Camera and Vehicle Acceptance Report

## Result summary

The camera/input repair is implemented in the local working tree and its CPU regression tests pass. The local browser loads the rebranded startup scene and renders TPP gameplay without console errors or warnings. The two custom Tripo cars are **not integrated**: their GLB exports are missing, and the project has no second drivable-car slot. No substitute model was fabricated.

The baseline is branch `main` at `6bea17f`. The worktree had many pre-existing unstaged and untracked project changes; all were kept. This task did not reset or clean Git state, alter physics or NPC/traffic behavior, or modify/save Blender objects.

## Root causes confirmed

- `src/main.js` requests `/assets/interceptor.glb` and clones it for `VEHICLE-PLAYER` and `VEHICLE-PARKED`. `src/asset-placements.js` identifies those two placements. The player collision body remains a separate Cannon box with half-extents `(1.4, 0.64, 2.60)`.
- `src/city-life.js` separately builds each ambient vehicle from box parts in `createTrafficVehicle(type)`. Its 16 authored routes include four `sport` routes. Copying GLBs into the asset folder or changing only the player-car loader would not affect these spawned visuals.
- The requested exports are absent: `public/assets/tripo/car-01-990-cyan-magenta.glb` and `public/assets/tripo/car-02-armored-blue.glb`. The live Blender scene was checked through Blender MCP; it has the existing K-77 interceptor and kit assets, not the Tripo cars. Blender reports version 5.2.3 LTS and addon 1.8. The active Blender file had an unsaved-change marker; it was left untouched.
- In committed `HEAD`, first person was the default, right-drag used `movementX`/`movementY` rather than a tracked screen-coordinate fallback, driving was excluded from mouse look, car entry/exit reset the view, the third-person boom was disconnected from pitch, and camera yaw also set the avatar's facing while idle.

## Camera/input repair in the current source

- `src/camera-rig.js` holds camera tuning and pure math for sensitivity, yaw wrapping, pitch limits, camera-relative facing, smooth body turning, torso-targeted TPP placement, mouse-look eligibility and vehicle boom pitch.
- `src/main.js` defaults to TPP; uses pointer-lock relative deltas and ordinary cursor screen deltas when unlocked; suppresses look over interactive controls; stores independent on-foot and vehicle look state; preserves view heading/pitch through vehicle entry/exit; and exposes active/vehicle look values in `window.__glitchbound.snapshot().camera` while retaining `window.__neon`. The embedded browser's read-only evaluation bridge did not expose custom globals, so the snapshot values were verified in source but not read at runtime.
- The existing obstruction path (`chaseCamera()` and `resolveCameraBoom()`) remains in use. Player movement, vehicle physics, combat outcomes, city geometry and NPC/traffic logic were not altered by this camera repair.
- `tests/camera-rig.test.mjs` covers sensitivity and axis sign, input gating, vehicle pitch convention, yaw wrap/pitch clamps, camera-relative facing, frame-rate-stable turning and TPP pose.

## Vehicle mapping and current status

| Intended asset | Requested runtime path | Existing role available | Status |
|---|---|---|---|
| Car A: cyan/hot-pink `990` racer | `public/assets/tripo/car-01-990-cyan-magenta.glb` | Existing `VEHICLE-PLAYER` visual; possible targeted `sport` traffic once real asset and dimensions are verified | Missing; not wired |
| Car B: blue-purple armored car | `public/assets/tripo/car-02-armored-blue.glb` | No second enterable/drivable road-car slot; traffic is currently procedural | Missing; no role assigned |

`public/assets/interceptor.glb` remains the current player and parked-car visual. This report does not claim either Tripo car appears in gameplay. On asset delivery, inspect axes, bounds, materials, packed textures, pivots and exact gameplay role before changing the asset manifest or traffic factory. Preserve the original model files and the existing physics/collision contracts.

## Verification performed

- Full project test runner: `node scripts/test.mjs` via the configured Node 24 runtime — **25/25 suites passed**, including 7 camera-rig checks, 18 camera-obstruction checks and 11 vehicle-visual-registry assertions.
- Production Vite build: `node node_modules/vite/bin/vite.js build --configLoader native` — **passed**, 68 modules transformed. Vite emitted its existing bundle-size warning: `index-BzstYpXi.js` is 771.10 kB and `three-Cq9HT4EC.js` is 534.85 kB after minification.
- Syntax: `node --check src/main.js` and `node --check src/camera-rig.js` — passed.
- Live browser: `http://127.0.0.1:4173/` reported title `GLITCHBOUND — After the signal`; the startup screen and gameplay frame were visually inspected. The active gameplay screenshot showed the third-person character and HUD. Pointer lock was rejected, but after the fallback fix a mouse drag visibly rotated the camera and scene; browser console warning/error logs were empty. The page asset inventory showed the existing `interceptor.glb`, `mercenary.glb`, props, aircraft and weapon/effect GLBs; no Tripo vehicle request appeared. The inventory does not expose HTTP response status, so it is not treated as a complete failed-request report.
- The browser drag smoke test confirmed mouse movement changes camera view without pointer lock. A full 360° orbit, ordinary unpressed cursor movement, vehicle steering/camera, enter/exit, firing alignment, pause/restart input recovery, and traffic visuals still need a standard-browser manual pass.
- Build was run directly rather than through npm lifecycle hooks so `prebuild` would not regenerate already-dirty blueprint files and `postbuild` would not prune assets as a side effect.

## Manual acceptance steps

1. Open `http://127.0.0.1:4173/` in Chrome or Edge, choose **ENTER GLITCHBOUND**, then move the mouse over the game without holding a button. Confirm horizontal orbit responds and vertical look is bounded and intuitive. Moving over a menu button should not rotate the camera.
2. Walk forward/sideways/backward at multiple camera headings; sprint, jump, aim and fire. Confirm movement follows camera heading and the reticle/shot direction remains coherent.
3. Enter the existing interceptor, move the mouse to orbit the vehicle view, accelerate/steer/reverse/brake, then exit. Confirm the view direction carries through both transitions.
4. Pause, resume and restart; confirm keys/mouse state are cleared and handlers do not accumulate.
5. After receiving the real Tripo exports, verify Car A on the intended drivable car and targeted ambient sports traffic; decide and test Car B's actual role before claiming a second drivable slot.

## Remaining work, ordered by dependency

1. Deliver the real Car A and Car B GLBs, plus editable sources/textures if available; confirm Car B's intended role.
2. Measure and inspect models, then wire the exact player/traffic visual factory paths without creating duplicate meshes or changing collision behavior.
3. Run spawn/reset/despawn checks and a full browser acceptance pass in a browser that permits pointer lock or unlocked cursor movement.
