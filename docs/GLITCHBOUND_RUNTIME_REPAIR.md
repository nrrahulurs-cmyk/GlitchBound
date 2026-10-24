# GLITCHBOUND runtime repair audit

**Inspection date:** 2026-10-24  
**Repository:** `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`  
**Branch and base:** `main`, `6bea17f` (`Ship completed hero assets and ground-contact fixes`)

This audit records the existing dirty worktree and the live runtime. It does not replace prior user changes. No reset, clean, checkout, asset deletion, or Blender save was performed.

## Confirmed vehicle path and blocker

`index.html` imports `/src/main.js`. `init()` in `src/main.js` loads `interceptor.glb` from `/assets/interceptor.glb` with the other required runtime GLBs. It clones that same loaded scene for the player vehicle (`VEHICLE-PLAYER`) and parked prop (`VEHICLE-PARKED`). The separate player body is a kinematic Cannon box. `movePlayer()`, `interact()`, `restart()` and the vehicle branch of `updateCamera()` control that one enterable vehicle. The parked car is handled by street physics and cannot be entered.

`src/city-life.js` creates and updates procedural route traffic independently. It must remain intact. `public/assets/av.glb` is the patrol aircraft; it is not a road-car substitute.

The requested exports are absent from the searched repository and configured project/export locations documented in [GLITCHBOUND_CUSTOM_ASSET_MAP.md](GLITCHBOUND_CUSTOM_ASSET_MAP.md):

- `public/assets/tripo/car-01-990-cyan-magenta.glb`
- `public/assets/tripo/car-02-armored-blue.glb`
- `public/assets/tripo/character-01-brown-hair.glb`
- `public/assets/tripo/character-02-blue-hair.glb`

The supplied screenshots identify appearance references only. They do not provide model geometry, textures, materials, hierarchy, scale, wheel pivots, or animation data. No matching exports were found in the repository, `Downloads`, `OneDrive\Documents`, or `Desktop` during the asset search recorded in the custom asset map. Therefore neither requested car can be swapped to its actual Tripo model. There is also no second drivable slot or vehicle-selection contract for Car B. Creating one would be a gameplay change and cannot be inferred from the reference images.

The source uses `registerVehicleVisual()` in `src/vehicle-visual-registry.js` to record the stable placement ID and actual asset path and reject duplicate registrations. This improves observability; it does not pretend the current `interceptor.glb` is a Tripo replacement. The current browser car remains the existing interceptor.

## Confirmed camera/input failure path

The committed source at `HEAD` had these behaviors:

- `thirdPerson` defaulted to `false`, so the normal on-foot startup was first person.
- The `mousemove` handler changed yaw/pitch only when pointer lock was active or a right-button drag was in progress. If pointer lock was denied or unavailable, ordinary mouse movement was ignored.
- Pointer-lock loss while playing immediately paused the game, and no pointer-lock error recovery path reported a usable fallback.
- Camera yaw and player facing were represented by the same `lookYaw`, leaving movement-facing and camera-facing coupled.

The current working-tree repair addresses that path in the live entry point rather than a disconnected camera example:

- `src/camera-rig.js` centralizes sensitivity, pitch limits, TPP framing, yaw wrapping, mouse-delta math and movement-facing yaw.
- `src/main.js` starts on foot in third person and stores `lookYaw`, `lookPitch`, `playerYaw` and `vehicleLookYaw` separately.
- `mousemove` uses pointer-lock deltas when locked and client-coordinate deltas when unlocked; it applies each input-event delta once, without multiplying by frame time. The pointer-lock error/loss handlers preserve a right-drag fallback and clear/recover input state.
- `movePlayer()` continues to use camera yaw for ground-plane movement and turns the body toward movement while holstered; drawn-weapon facing follows camera yaw.
- One `updateCamera()` handles on-foot FPP/TPP and the existing separate vehicle-camera state. It uses the existing `resolveCameraBoom()` obstruction path and the existing frame loop; no competing camera loop was added.
- `fire()` still derives its ray from the active camera and supplies the current muzzle origin to the existing simulation shot path.

## Browser and Blender inspection

The live app was opened from `http://127.0.0.1:4173/` in the in-app browser and in Chrome. The title and startup screen showed GLITCHBOUND. Starting the game displayed the live city and on-foot HUD. The first-person toggle was exercised with `V`; the accessibility tree changed to `FIRST PERSON`, and the captured frame showed the first-person weapon/city composition. Mouse motion was exercised with the pointer-lock fallback and changed the live view. The first-person toggle back to TPP and full vehicle-driving acceptance sequence were not completed in a controlled session.

The browser automation environment reported that pointer lock was unavailable and showed the game's fallback prompt. Its drag gesture holds the primary mouse button, which also activates weapon fire; the test was stopped and the page was reloaded to restore a clean game state. The HMR websocket warning belongs to the local Vite development connection. It did not prevent the HTML, city, HUD, or WebGL scene from rendering. The captured console set contained that HMR connection error and no game-code exception.

Blender MCP is available in this execution (Blender 5.2.3 LTS, add-on 1.8). The current live scene was read without editing or saving: `blender/cyberpunk-assets.blend` was open and marked unsaved by the application; it contained the existing K-77 interceptor and no Tripo imports. This supersedes the earlier asset-map note that Blender MCP was unavailable in a prior execution. No live Blender scene was modified.

## Project commands and compatibility

`package.json` declares Node `24.x`, Three.js `0.180.0`, Cannon ES `0.20.0`, and Vite `7.3.6`. Available scripts are `dev`, `build`, `preview`, `test`, and `check:english`. The `predev` and `prebuild` hooks run `scripts/export-blueprint.mjs`, which may rewrite already-dirty generated blueprint outputs; use the direct Vite CLI for a non-mutating build check. The `postbuild` hook prunes deployment assets, so it is not run during this audit.

Preserve these existing contracts during later model integration:

- Player and parked vehicle placement IDs and their independent physics roles.
- The player Cannon body, movement, damage, entry/exit and restart behavior.
- Procedural traffic routes and instance system in `src/city-life.js`.
- Blender Z-up/+Y-forward to glTF Y-up/-Z-forward conversion recorded in `blender/README.md` and `blender/asset-manifest.json`.
- Existing hero node names and weapon/muzzle socket contracts used by the player pose, foot-contact and weapon-rig modules.
- `window.__neon` while introducing/retaining `window.__glitchbound` for diagnostics compatibility.
- Existing licenses, third-party notices, asset sources, and all pre-existing dirty work.

## Remaining integration and validation gaps

1. Obtain the real textured Car A and Car B GLB exports, plus the two character exports if those remain in scope. Inspect their scale, origin, facing, textures, hierarchy and animation/wheel pivots before changing any loader.
2. Confirm whether Car B is an alternate selection for the current player car or a genuinely additional enterable car. The present project has no second drivable entity.
3. Replace the player visual only after Car A exists; preserve the parked vehicle unless its mapping is explicitly defined. Attach the replacement before removing the old visual and do not dispose shared source resources.
4. Validate both views with controlled mouse motion, all camera-relative directions, corners/obstruction recovery, aiming/hits, and enter/exit/drive/restart. Browser automation's primary-button drag couples mouse movement to firing, so use pointer lock or a right-button drag for an isolated live camera test.
5. Validate GLB parsing, scene registration, screenshots, asset requests, and restart behavior with the actual supplied models. Build/test success alone does not prove model integration.

