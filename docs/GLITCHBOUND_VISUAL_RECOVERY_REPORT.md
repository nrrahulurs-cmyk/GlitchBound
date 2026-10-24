# GLITCHBOUND visual recovery report

## Confirmed findings

The repository is on branch `main` at `6bea17f` with extensive pre-existing tracked and untracked changes. This task preserved those changes and modified only the camera path and its focused tests/docs. No destructive Git operation was used.

The reference screenshots are clear visual targets, but the matching Tripo model exports are not present in the project, searched OneDrive workspace, or Downloads. The current game therefore cannot be loading those exact assets:

| Requested design | Model the game currently loads | Actual integration status |
|---|---|---|
| Car 01: cyan/magenta `990` racer | `public/assets/interceptor.glb` | Existing generated interceptor still loads; no Tripo car substituted. |
| Car 02: blue-purple armored car | No independent second drivable car model slot; current parked car also clones `interceptor.glb` | Not integrated. Ambient traffic is procedural and `public/assets/av.glb` is an aircraft. |
| Character 01: brown-haired male | `public/assets/mercenary.glb` through `/assets/mercenary.glb` | Existing generated voxel hero still loads; no Tripo character substituted. |
| Character 02: blue-haired character | No second discrete character GLB slot; the city population is shared instanced citizen geometry | Not integrated or assigned to a role. |

Expected incoming export paths are recorded in [`GLITCHBOUND_CUSTOM_ASSET_MAP.md`](./GLITCHBOUND_CUSTOM_ASSET_MAP.md). The Tripo scenes' materials, textures, origin, axes, dimensions, hierarchy, skins, clips and wheel nodes remain unverified because the actual files are absent. Screenshots and MP4s were not used as runtime meshes. No Blender MCP tool is available in this execution, so no scene was opened or saved here.

## Model transforms and runtime contracts

No model transform was changed in this task. Existing values, verified from `src/asset-placements.js` and `blender/asset-manifest.json`:

- Player hero: `mercenary.glb`, runtime scale `1.12`, placement `(1.2, 0.057, 26.8)`, Y rotation `0`; bounds approximately `1.263 × 2.163 × 0.824 m` at runtime. `position.y` is the player eye height (`ground + 1.75 m`); the avatar root is positioned at `position.y - 1.75 m`.
- Player and parked vehicle visuals: the same `interceptor.glb` is cloned for both; bounds approximately `2.895 × 1.364 × 5.278 m`. The physics body is a separate kinematic box with half-extents `(1.4, 0.64, 2.60) m` and remains authoritative.
- Hero pose currently depends on named rigid nodes for arms/legs and foot-contact names; the existing GLB has no skin or animation clips. The interceptor currently has a combined mesh and no named wheel pivot hierarchy or wheel animation.

The corrected camera uses a torso focus offset of `-0.52 m` from the shared eye-position vector, then a `4.8 m` boom with `0.82 m` shoulder offset. It keeps the current avatar and car model transforms and collision shapes untouched.

## Camera and input corrections

`src/camera-rig.js` now owns the testable camera tuning and math:

- Mouse sensitivity: `0.0022` radians per pixel.
- TPP aim pitch limits: `-0.85` to `+0.85` radians. Camera boom elevation is separately bounded to `-0.48` to `+0.12` radians so looking upward does not drive the camera below ground; down-aim raises the boom smoothly.
- Third-person boom: `4.8 m` distance, `0.82 m` right-shoulder offset, `-0.52 m` torso-focus offset, follow rate `16`.
- FPP pitch remains available through `V`; the TPP mode remains the default.
- Mouse yaw is normalized, horizontal/vertical deltas are handled independently, and pointer-lock movement is read directly instead of falling back to stale screen coordinates. Unlocked right-drag uses screen-coordinate deltas.
- Movement still uses camera yaw on the ground plane. The displayed character has a separate `playerYaw`: while holstered it turns smoothly toward accepted movement; when the weapon is drawn it follows camera aim so the muzzle and reticle relationship remains coherent.
- Vehicle entry retains the view heading relative to the vehicle; exit restores the same world heading and preserves pitch. The existing vehicle camera remains the sole active camera and now adds up to `4 m` of look-ahead at speed.
- `chaseCamera` and `resolveCameraBoom` remain the only third-person/chase collision path. Camera mode changes ease through that path while the obstruction resolver still constrains the candidate to a clear boom.
- `window.__glitchbound` snapshot now reports camera view, yaw, pitch and player yaw; the `window.__neon` compatibility alias remains intact.

Weapon damage, fire rate, ammunition, muzzle socket and cover checks were not changed. Shot aim continues to use the active camera's center ray and the existing muzzle origin in `src/weapon-rig.js`/`src/simulation.js`.

## Files changed in this recovery task

- `src/camera-rig.js` — centralized view/input tuning, yaw wrapping, camera-relative facing and torso-focused TPP pose.
- `src/main.js` — use the camera rig math, separate player facing, improve mouse input and mode transitions, add vehicle look-ahead, preserve heading at vehicle entry/exit, expose camera diagnostics.
- `tests/camera-rig.test.mjs` — deterministic camera pose, input-axis, pitch-bound, movement-facing and frame-rate-stable turn checks.
- `docs/GLITCHBOUND_VISUAL_RECOVERY_AUDIT.md` — actual code/asset findings and root causes.
- `docs/GLITCHBOUND_VISUAL_RECOVERY_REPORT.md` — this implementation and verification record.
- `docs/GLITCHBOUND_CUSTOM_ASSET_REPORT.md` — corrected its camera values to match this recovery so prior docs do not contradict the current source.

Original GLB and Blender files, physics, vehicle handling, NPC logic, combat outcomes, city geometry and unrelated audio/brand/localization changes were left unchanged.

## Validation and evidence

The focused `tests/camera-rig.test.mjs` suite passes **5/5 checks**, and the full repository regression runner passes **24/24 suites**. The production Vite build completes successfully (67 modules transformed). Vite reports that the main JavaScript chunk exceeds 500 kB; this is a bundle-size warning, not a build failure.

The local development server at `http://127.0.0.1:4173/` returned HTTP 200 and the expected title, `GLITCHBOUND — After the signal`. No browser screenshots/captures or Blender previews were produced: browser use is disabled in Work settings and no Blender MCP tool is exposed. Manual review remains necessary for TPP framing from all sides, mouse movement, jumps, tight corners, firing and car transitions. The exact Tripo models also need to be supplied before their fidelity or behavior can be accepted.

`node --check` passed for `src/main.js` and `src/camera-rig.js`; `git diff --check` passed for the changed source and documentation. The `npm` executable is not on this environment's PATH, so the test runner and Vite production build were invoked directly with the configured bundled Node runtime. Lifecycle hooks were not run; this avoided invoking the blueprint generator, which can rewrite existing dirty generated files.

## Remaining acceptance items

1. Provide the four actual textured GLB exports and editable Blender/FBX sources if available.
2. Confirm Character 02's entity role and whether Car 02 should be an alternate player car or a newly enterable vehicle. Current code has neither a second imported character slot nor a second drivable vehicle slot.
3. Review the running game in a real browser at 30/60/120 Hz and verify mouse-look, torso framing, body facing, aiming, collision recovery and entry/exit transitions.
4. Reopen the actual Blender source scenes and inspect each imported export's materials, textures, axes, pivots, rigging and animation before changing any asset or runtime mapping.
