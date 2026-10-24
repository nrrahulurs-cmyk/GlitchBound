# GLITCHBOUND custom asset and camera report

## Result

The three supplied visual references were reviewed. The actual Tripo meshes were not present in the repository, OneDrive workspace or Downloads search scope, so no character or vehicle model was fabricated, overwritten, or reported as integrated. Four Tripo showcase MP4 files exist in Downloads, but this execution did not expose a video decoder or Blender MCP endpoint to inspect their frames or scene contents.

One independent, low-risk camera change was completed: on-foot gameplay now starts in the existing third-person over-shoulder mode. The existing first-person toggle (`V`), mouse-look, vehicle camera, movement and physics paths remain in place. The third-person distance, vertical offset, shoulder offset and follow rate are now grouped as named tuning values in `src/main.js` without changing their prior values.

## Replacement status

| Requested model | Status | Existing runtime mapping |
|---|---|---|
| Character 01, brown-haired cyberpunk male | Blocked: export missing | Current playable hero is `public/assets/mercenary.glb`, loaded from `/assets/mercenary.glb` by `src/main.js`. |
| Character 02, blue-haired cyberpunk character | Blocked: export and entity role missing | No second discrete character GLB slot exists. Civilians use the shared city instancing/character source pipeline. |
| Car 01, cyan/magenta `990` racer | Blocked: export missing | Current drivable car uses `public/assets/interceptor.glb`; a parked car also clones this same model. |
| Car 02, armored cyan-lit car | Blocked: export and separate drivable slot missing | The game has one player-controlled car and a parked physical car. Ambient traffic is procedural; `public/assets/av.glb` is a patrol aircraft, not a road-car slot. |

Expected incoming runtime paths are listed in [`GLITCHBOUND_CUSTOM_ASSET_MAP.md`](./GLITCHBOUND_CUSTOM_ASSET_MAP.md). No incoming model's rig, animation, materials, dimensions, pivots or wheel nodes can be certified until its actual file is available.

## Camera and controls

- On-foot default: third person.
- `V`: toggle first-person and third-person views.
- Mouse: existing pointer-lock look; right-drag remains the fallback when pointer lock is unavailable.
- Third-person follows the current player controller with delta-time smoothing and collision-aware boom recovery (`src/camera-obstruction.js`). The camera tuning and tested pose/input math now live in `src/camera-rig.js`; the torso-focused framing uses 4.8 m distance, a -0.52 m focus offset from the eye position, 0.82 m shoulder offset, follow rate 16, and sensitivity 0.0022 radians per pixel.
- Vehicle chase camera and its look controls are unchanged.
- First-run notification and README now identify third person as the default.

This is the existing camera system configured to start in its third-person mode, with separated camera yaw and character locomotion/aim facing and preserved aim direction when entering or leaving the vehicle. A full visual review of the running browser scene was not available in this execution, so camera framing and aiming still require manual gameplay confirmation.

## Compatibility and integration gaps

- `mercenary.glb` is a rigid named-part hero, not a skinned/animated GLB. Runtime poses query `left_arm`, `right_arm`, `left_leg`, `right_leg`; foot contact uses `left_foot`/`right_foot`. Character imports need a rig adapter or compatible node mapping.
- The hero holds the weapon through a custom runtime weapon rig rather than a named Tripo hand socket. The existing muzzle/socket and camera-ray contracts must be preserved and tested.
- `interceptor.glb` has no separate wheel pivots or animation clips. Existing vehicle mechanics are a kinematic box independent from the visual model. Verify wheel geometry and visible ground contact before attempting any wheel animation.
- Player and parked cars currently share `interceptor.glb`. Separate visuals require an explicit asset reference for each placement.
- Car 02 requires a confirmed role and runtime vehicle slot; do not replace the aircraft or procedural traffic by assumption.
- Character 02 requires a confirmed entity role; do not assign it to a random civilian or change an existing playable role.
- The current Codex tool list exposes no Blender MCP tools. Blender scenes were not opened or edited as part of this task.

## Files changed in this task

- `src/main.js` — set third person as the initial on-foot mode, grouped existing third-person camera tuning values, updated first-run guidance.
- `README.md` — clarified that third person is the default and `V` toggles camera mode.
- `docs/GLITCHBOUND_CUSTOM_ASSET_MAP.md` — verified current model-to-runtime map, missing exports, Blender/browser contracts and ordered integration checklist.
- `docs/GLITCHBOUND_CUSTOM_ASSET_REPORT.md` — this status and validation report.

The worktree was already dirty on branch `main` at commit `6bea17f` before this task. Existing local changes were preserved; no reset, cleanup, blanket restore, asset replacement or Blender save was performed.

## Validation

- Regression suite: **23/23 suites passed** via the bundled Node 24 runtime running `scripts/test.mjs` directly.
- Production Vite build: **passed** with 66 modules transformed. It emitted the existing advisory that the minified main chunk exceeds 500 kB. The build was run directly with Vite, skipping npm lifecycle hooks because the prebuild script rewrites tracked blueprint outputs that were already dirty before this task.
- `npm` itself is unavailable in this shell. The bundled Node executable and the repository's installed dependencies were used instead; no dependency install or lockfile change was made.
- Browser visual/input review: **not run**. The current Codex Work session does not expose local browser automation, so default camera framing, mouse-look, aiming, and vehicle transitions still need a hands-on browser check.
- Blender inspection: **not run** for the same environment constraint; no Blender MCP tool was listed. No `.blend` content was saved or changed.
