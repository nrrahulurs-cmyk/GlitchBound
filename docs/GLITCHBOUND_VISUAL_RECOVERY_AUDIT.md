# GLITCHBOUND visual recovery audit

## Baseline and preservation

- Repository: `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`
- Branch and HEAD at audit: `main`, `6bea17f` (`Ship completed hero assets and ground-contact fixes`).
- The worktree was already substantially modified and had untracked audio, branding, localization and documentation work before this recovery task. `src/main.js`, `README.md`, `index.html`, package files, Blender files, blueprint data and other game systems already had local changes. No reset, clean, blanket restore, branch switch or asset replacement was used.
- The prior task had already changed the initial `thirdPerson` flag to `true` and grouped the existing camera offsets in `src/main.js`; this audit treats that as the current starting state, not as an upstream baseline.

## What the running source actually loads

`index.html` loads `src/main.js`. In `src/main.js`, `GLTFLoader` requests `/assets/<name>.glb` for `interceptor`, `drone`, `crate`, `kiosk`, `mercenary`, `av`, and weapon/effect exports. The checked runtime references and role data are in `src/asset-placements.js` and `blender/asset-manifest.json`.

Fresh recursive searches of the repository and Downloads found only the checked-in project models, Blender source files, unrelated archives and Tripo showcase videos. No Tripo GLB/GLTF/FBX export was present in those locations. The three current reference screenshots were visually inspected. Showcase clips were not frame-decoded. The current Codex execution exposes no Blender MCP tool and no local browser automation surface, so this audit did not reopen a Blender scene or capture the live game.

| Current asset | Actual role | Compatibility facts |
|---|---|---|
| `public/assets/mercenary.glb` | Only independent player hero GLB | Runtime poses query named rigid nodes (`left_arm`, `right_arm`, `left_leg`, `right_leg`) and foot contact reads `left_foot`/`right_foot`. The GLB has no glTF skin or animation clips. It is the existing generated voxel model, not either pictured Tripo hero. |
| `public/assets/interceptor.glb` | One driveable player-car visual and one parked-car visual | Both placements clone the same GLB. The model has one combined mesh and no wheel pivot nodes/animation clips. The authoritative player collision is a separate kinematic Cannon box. It is not either pictured Tripo car. |
| `public/assets/av.glb` | Patrol aircraft | Not an armored road car and must not be used as Car 02. |
| `public/assets/drone.glb`, `crate.glb`, `kiosk.glb`, `relay.glb` | Drone, explosive prop, kiosk and data-relay roles | Unrelated to the requested character/car substitutions. |
| `public/assets/pulse-carbine.glb`, `ion-bolt.glb`, `muzzle-flash.glb`, `impact-shards.glb` | Weapon/effect path | `src/weapon-rig.js` consumes named weapon parts and muzzle socket; preserve its independent view rigs and socket direction. |

Character 02 has no dedicated imported character slot: city citizens are generated as a shared population via `src/city.js`, `src/city-life.js`, and Blender citizen sources. The browser game has one player-controlled road car and one parked physical car. Ambient traffic in `src/city-life.js` is procedural. Therefore the four Tripo meshes cannot be mapped to four existing independent gameplay slots as the brief assumes.

## Camera and aiming path

- Player eye position and the movement controller's shared position are in `src/main.js`; movement direction is computed in `src/player-movement.js` from the supplied yaw (`-sin(yaw), -cos(yaw)` forward convention).
- The single `THREE.PerspectiveCamera`, `updateCamera`, `chaseCamera`, input listeners and fire entry point are in `src/main.js`. The existing first/third-person toggle is `V`; mouse sensitivity was an inline `.0022` radians-per-pixel constant.
- Third person used a fixed-height boom relative to the **eye-height player position**, while `lookPitch` only changed camera rotation. The initial `lookPitch=.30` points upward, so the camera's aiming direction and its shoulder boom height did not track each other. The 5.2 m distance and 1.4 m lateral shoulder offset were also large for the current 2.163 m-tall hero.
- The same `lookYaw` controlled camera orientation, movement direction, hero body rotation, service facing and aim. In free exploration, rotating the camera also rotated the character while stationary; no separate locomotion-facing yaw existed.
- Mouse input selected `event.movementX || clientDelta`, which can substitute a stale screen-coordinate delta for a valid zero pointer-lock delta. Yaw was not normalized. Pitch ranges were magic numbers.
- Car entry reset view yaw/pitch to car heading and car exit reset pitch to `.12`, creating avoidable view discontinuities. The vehicle camera is otherwise separate and already has its own `vehicleLookYaw`.
- `chaseCamera` already uses delta-time exponential follow and `resolveCameraBoom` for obstruction. `tests/camera-obstruction.test.mjs` covers wall/OBB clearance and frame-rate behavior. Keep this as the only world-camera update path; repair its inputs and pose rather than adding a competing controller.
- Third-person fire uses the actual camera world ray for the reticle aim point and `weaponRig.getMuzzle()` for the shot origin; `src/simulation.js` reconciles the muzzle with that target and maintains cover checks. The new camera yaw/pitch must remain the canonical aim direction; when the weapon is drawn, the character body should face that yaw so the muzzle presentation tracks it.

## Confirmed root causes and limits

1. **Model identity gap:** the game still loads its checked-in voxel `mercenary.glb` and `interceptor.glb`; the exact Tripo exports are absent, so matching models are not possible yet.
2. **Requested model-slot mismatch:** there is one player car plus one parked car, not two drivable cars; there is one independent player hero slot, not two independent character GLB slots. Assigning the screenshots to aircraft, random citizens or unrequested new gameplay roles would be a guess.
3. **TPP framing/angle mismatch:** fixed-height chase placement combined with a positive upward startup pitch and a high eye-position anchor creates poor torso framing and inconsistent pitch/boom geometry.
4. **Camera/body coupling:** one yaw drives both camera and hero body, so free look and movement-facing cannot be tuned independently.
5. **Input/transition fragility:** mouse deltas, pitch/sensitivity values and enter/exit camera orientation have no central config and currently allow avoidable discontinuities.
6. **Visual verification limit:** this session cannot drive the user's open localhost browser or Blender through MCP. Code/test validation is available, but real visual acceptance requires a local browser review.

## Repair plan by dependency and risk

1. Correct the single on-foot camera pose to orbit a measured upper-torso focus with configurable distance, shoulder, target height, sensitivity and pitch bounds; retain the current collision resolver.
2. Separate camera/aim yaw from the hero's locomotion-facing yaw; keep the body aligned with aim while the weapon is drawn, and let it turn smoothly toward accepted movement while the weapon is holstered.
3. Use explicit pointer-lock mouse deltas, wrap yaw, clamp pitch by camera mode, and preserve world view direction across vehicle entry/exit. Ease mode transitions through the existing chase path while still resolving obstructions immediately.
4. Add focused deterministic camera-pose/input tests; run the full Node suite and production build without rewriting locally modified blueprint outputs.
5. After the four actual Tripo GLBs are provided, inspect each export and role before writing adapters or loader mappings; preserve original source models and physics.
6. Perform manual browser/Blender visual validation when those tools are available, including corners, jumps, aiming, firing, and vehicle transitions.
