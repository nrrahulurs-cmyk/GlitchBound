# GLITCHBOUND final runtime verification

**Verification date:** 2026-10-24  
**Repository:** `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`  
**Branch/base:** `main` at `6bea17f`; existing modified and untracked files were preserved.

## Result

The camera/input repair already present in the working tree is integrated into `src/main.js` and was exercised in the browser. The requested Tripo vehicle replacement is blocked because the actual model exports are absent and Car B has no existing drivable slot. The original interceptor remains the runtime model; no screenshots were passed off as models and no gameplay behavior or traffic system was replaced to simulate integration.

## Confirmed causes and source changes in the working tree

### Vehicle replacement

`init()` in `src/main.js` loads `/assets/interceptor.glb` and clones it for the player vehicle and parked prop. The player is the only enterable car; the parked object is a physical street prop. Procedural traffic comes from `src/city-life.js` and is unrelated to the GLB car.

The required paths below are not present:

- `public/assets/tripo/car-01-990-cyan-magenta.glb`
- `public/assets/tripo/car-02-armored-blue.glb`

Consequently, there is no verified successful Tripo load, no replaced visual to compare, and no basis to say obsolete visuals were detached. Car B has no existing player entity, controller, or selection path. These are unresolved input/architecture blockers, not regressions fixed by relabeling the old asset.

`src/vehicle-visual-registry.js` adds stable visual registrations and duplicate-ID rejection. `src/main.js` registers the current player and parked visuals and exposes their source path via the existing diagnostic snapshot. `tests/vehicle-visual-registry.test.mjs` covers both distinct roots, their current shared source path, stable IDs, and duplicate rejection. This diagnostic change is not a car replacement.

### Camera and controls

In the committed baseline, the game started in FPP and `mousemove` ignored movement unless pointer lock or right-drag was active. Pointer-lock loss paused the game. In a browser that denied pointer lock, moving the mouse alone therefore did not rotate the view. The player-facing yaw also shared the camera yaw.

The working-tree repair centralizes the camera math/configuration in `src/camera-rig.js`, starts on foot in TPP, separates camera yaw/pitch from body yaw and vehicle look yaw, handles pointer-lock errors/loss, and falls back to unlocked mouse client-coordinate deltas. It uses camera yaw for normalized ground-plane movement, the existing single camera loop, the existing vehicle camera branch, and the existing camera-obstruction resolver. Combat still uses the active camera direction with the current muzzle origin.

## Live browser evidence

- `http://127.0.0.1:4173/` loaded and rendered the GLITCHBOUND title/start screen, city, minimap, HUD, player and existing interceptor.
- Starting from the title screen produced the live game HUD. Pressing `V` changed the accessibility state to `FIRST PERSON`; a screenshot showed the first-person weapon and city view.
- With pointer lock unavailable, the game displayed its right-drag fallback message. A live mouse drag changed the view. The automation drag holds the primary button and also engages firing, so it is unsuitable for an isolated vertical-look or combat-accuracy check. The browser run was reloaded afterward to restore a fresh game state.
- The returned browser log set contained a Vite HMR websocket connection error. The game still rendered; no application exception appeared in that returned set. This is a development-server connection warning, not proof of production behavior.
- Blender MCP was available and successfully read the active Blender scene. The open scene was the unsaved `blender/cyberpunk-assets.blend` project and contained the existing K-77 interceptor without Tripo imports. No object was edited and no scene was saved.

## Automated validation

The production build passed. The fresh full-suite run completed with one existing timing assertion failing; the camera and vehicle-specific suites passed. This current run supersedes the earlier 25/25 result recorded in the previous vehicle-repair report.

- Regression suite: **24/25 suites passed**. `camera-rig.test.mjs`, `camera-obstruction.test.mjs`, and `vehicle-visual-registry.test.mjs` passed.
- The remaining failure is `civilian-gait-integration.test.mjs`: its unrelated CPU timing assertion requires a mean update below 8 ms. The isolated rerun measured **8.516 ms** and failed that threshold. The first full run overlapped the production build and measured 8.627 ms. The NPC/crowd implementation is outside this camera/vehicle repair scope, so it was not modified and the test was not weakened.
- Production Vite build: **passed**, 68 modules transformed. The existing main-chunk-over-500-kB warning remains.
- `npm` is not available on PATH in this execution. Tests/build use the configured Node 24 runtime and direct Vite CLI. The Vite lifecycle hooks were avoided because `prebuild` can rewrite dirty generated blueprint files and `postbuild` prunes deployment assets.
- Repository-wide `git diff --check` reports pre-existing trailing whitespace in already-dirty `blender/build_assets.py` and `blender/city-scene-manifest.json`; neither file was changed for this repair.

## Still unverified

- Actual Tripo GLB loading, render ownership, scale/orientation, wheels, textures, damage compatibility, and detachment of old visuals; the exports are missing.
- Car B driving and transitions; there is no second enterable vehicle entity.
- A controlled horizontal and vertical mouse-look comparison with pointer lock or right-button drag, movement in each camera-relative direction, obstruction recovery, and first/third-person transitions after vehicle exit.
- Controlled weapon aim-to-hit/damage, full vehicle steering/reverse/brake/collision/restart, and network request inspection after adding the real models.
- A full Blender render/reopen pass of updated Tripo assets; there were no new Blender assets to inspect.

## Required next implementation order

1. Place the actual textured Tripo car exports at the paths above and inspect their dimensions, hierarchy, axes, materials/textures and wheel pivots.
2. Confirm Car B's intended role before adding a second vehicle controller or assigning it to the parked prop.
3. Replace only the defined render model while preserving physics, damage, entry/exit, parked behavior and traffic.
4. Run the existing test/build commands and browser checks with the actual assets, including camera, weapon, driving, collision and restart acceptance.

