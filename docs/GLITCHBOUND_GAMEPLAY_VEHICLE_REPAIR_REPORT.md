# GLITCHBOUND gameplay and vehicle repair report

## Outcome

This repair confirms that the requested Tripo vehicle replacement cannot be completed from the available files. The game currently has one drivable vehicle, one parked physical vehicle, and separate procedural traffic. The two requested Tripo GLBs are missing, and Car B has no existing drivable slot. I did not substitute screenshots/videos, reassign the patrol aircraft or parked vehicle, remove traffic, or claim model replacement.

A small, safe code repair adds stable render-only vehicle registration and duplicate-ID diagnostics. It does not alter vehicle physics, movement, damage, camera, traffic, or gameplay state.

## Confirmed causes and exact references

- `src/main.js` `init()` directly loads `/assets/interceptor.glb`; it clones this same loaded model into the player (`VEHICLE-PLAYER`) and parked (`VEHICLE-PARKED`) visuals. This is why both original interceptor appearances remain.
- `src/asset-placements.js` has only the player car and the parked physical prop. `src/main.js` `interact()` only enters/exits the player car at `carPosition`; there is one player kinematic body. No second drivable controller or selection/spawn flow exists.
- `src/city-life.js` `createTrafficVehicle()` and `createTrafficController()` author route-based voxel traffic independently. This traffic is expected and remains intact.
- The exact custom export targets are `public/assets/tripo/car-01-990-cyan-magenta.glb` and `public/assets/tripo/car-02-armored-blue.glb`. Neither exists in the project or searched export locations. Existing `public/assets/interceptor.glb` is the only imported road car; `public/assets/av.glb` is an aircraft.
- All ten current runtime GLBs responded with HTTP 200 from the local Vite server. This rules out missing current URL responses but does not verify browser-side GLTF parsing or rendering.

## Changes made

- `src/vehicle-visual-registry.js` — registers one visual-only model per stable placement ID, records its model path/role, and rejects duplicate IDs before scene insertion.
- `src/main.js` — registers the existing player and parked visual roots and includes their registry in `window.__glitchbound.snapshot().vehicles`.
- `tests/vehicle-visual-registry.test.mjs` — checks the two distinct current roots, their shared current source path, unique stable IDs, and duplicate rejection.
- `docs/GLITCHBOUND_GAMEPLAY_VEHICLE_REPAIR.md` — records the repository audit, confirmed architecture, risks and repair order.
- `docs/GLITCHBOUND_GAMEPLAY_VEHICLE_REPAIR_REPORT.md` — this result and validation record.

All pre-existing staged, unstaged and untracked work was preserved. No Blender, GLB, physics, traffic, car-control, camera, combat or unrelated gameplay asset was changed.

## Validation

Baseline before the registry change: **24/24** test suites passed; production Vite build passed. After the registry change, the full regression runner passes **25/25 suites**, including 11 vehicle-registry assertions. The production Vite build passes with 68 modules transformed. It still reports that the minified main chunk exceeds 500 kB.

`node --check` passes for `src/main.js` and `src/vehicle-visual-registry.js`; the targeted tracked source diff and all new files pass whitespace checks. A repository-wide `git diff --check` still reports pre-existing trailing whitespace in the already-dirty `blender/build_assets.py` and `blender/city-scene-manifest.json`; those unrelated files were left unchanged. The game HTML and all ten existing runtime GLB endpoints returned HTTP 200 from the local Vite server. `npm` is unavailable on PATH, so checks used the configured bundled Node 24 runtime and direct Vite CLI; npm lifecycle hooks were skipped to avoid regenerating pre-existing dirty blueprint outputs.

Browser gameplay, console/network panel, actual scene rendering, and Blender scene inspection remain **UNVERIFIED**. The browser automation surface is disabled in this Work session; no Blender MCP tool or Blender CLI is available. Required manual checks after asset delivery: inspect both model requests/rendered placements, camera/input, enter/drive/exit, collision, restart, weapon behavior, and unrelated traffic.

## Remaining blockers

1. Supply `public/assets/tripo/car-01-990-cyan-magenta.glb` and `public/assets/tripo/car-02-armored-blue.glb` (or actual exports and editable source files elsewhere).
2. Confirm what Car B replaces or how it becomes drivable. The current parked vehicle is not enterable; making it a second car changes gameplay and needs explicit role mapping.
3. Visually inspect exported model scale/origin/forward axis/materials/wheels and verify the game in a real browser and Blender before acceptance.
