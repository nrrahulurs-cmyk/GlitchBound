# GLITCHBOUND Story Intro Design

## Scope and verified project mapping

The intro is a reversible, real-time scene animation over the existing city. It does not play either MP4, create a second renderer loop, change city geometry, or run gameplay damage logic.

Verified runtime assets and contracts:

- `public/assets/mercenary.glb` is the playable VEX voxel character. Its hierarchy has `head`, `torso`, `left_arm`, `right_arm`, two leg chains, and the top-level `VEX / VOXEL MERCENARY` node. The file has no animation clips or skin, so the intro uses the same named transforms the runtime already animates.
- `public/assets/interceptor.glb` is the K-77 Interceptor. It is one static mesh node (`K-77 INTERCEPTOR`) with no animation clips, skin, or named wheel nodes. The intro can move the whole car and add a temporary exhaust trail; authored wheel rotation is unavailable in this export.
- `public/assets/pulse-carbine.glb` contains the existing `muzzle_socket`; `src/weapon-rig.js` already attaches the third-person held weapon to the VEX character.
- `src/weapon-vfx.js` provides bounded, render-only projectile effects. The cinematic can use one ion bolt without calling simulation damage.
- `src/audio.js` already maps the user-supplied chase, impact, gunfire, and acceleration recordings. They remain subject to the existing sound toggle and browser audio policy.
- The Blender MCP session is connected to Blender 5.2.3. Its open `cyberpunk-assets.blend` scene contains the K-77 Interceptor and VEX character. Read-only scene inspection confirmed the expected characters and vehicle.

## Story beats and timing

Target duration: 13.8 seconds. All timing is elapsed-time based.

| Time | Beat | Camera and action |
| --- | --- | --- |
| 0.0–2.1 s | City and hero | Begin on the live title-screen city view, then move low toward VEX and the parked K-77. |
| 2.1–4.5 s | UFO reveal | Tilt and reframe to a temporary stylized saucer above the street; play the existing pursuit sound if enabled. |
| 4.5–5.8 s | Energy strike | A temporary beam hits clear pavement beside the hero. Use a bounded flash, sparks, smoke, ring ripple, and restrained camera impulse; no physics or permanent damage. |
| 5.8–7.6 s | Counterattack | Animate VEX's available arm/head transforms, raise the actual third-person M-09 rig, and fire one render-only ion bolt toward the saucer. |
| 7.6–9.5 s | Vehicle entry | Move VEX along a short path to the K-77, then cut behind the vehicle and hide the character during the unsupported seat transition. |
| 9.5–13.8 s | Escape and handoff | Accelerate the existing K-77 down the existing street with a temporary cyan exhaust trail, reveal the GLITCHBOUND wordmark, and hand control to the actual vehicle state. |

`Escape`, `Space`, or the visible **Skip intro** control ends the sequence immediately. Skipping restores the starting car and character transforms and enters the normal on-foot game. Natural completion hands off in the existing in-car gameplay state. Both routes restore the normal camera and HUD.

## Controller and dependencies

`src/cinematics/glitchbound-intro.js` owns one explicit controller with `start`, `update`, `skip`, `getState`, and `dispose`. It uses the existing `scene`, `camera`, avatar, vehicle, weapon rig, and weapon VFX objects. Intro-only saucer/beam/impact/exhaust resources are created for a run and disposed at completion or skip. The main Three.js animation loop remains the only loop.

The intro remains outside the gameplay `mode` state so movement, shooting, service interactions, and physics do not advance during the sequence. The controller updates after the gameplay camera function, then normal camera control resumes after the handoff. The playback UI and skip listeners are installed once in `src/main.js`.

## Validation results

- The focused intro suite passes 3 checks: cue order and natural handoff, skip restoration and repeat-start cleanup (including the 30-point escape trail), and required live-scene input validation.
- The repository test runner passes all 26 suites.
- The production Vite build succeeds. Vite emits its existing large-chunk advisory for the 784 kB main JS bundle.
- In the localhost browser, the title CTA starts the intro, the saucer reveal and beam/impact render, natural completion reaches the K-77 driving HUD, and Skip returns to the on-foot HUD with VEX visible. The refreshed bundle had no browser console errors or warnings.
- Existing camera/gameplay tests pass. No manual first-person/third-person driving session was run as part of this intro verification.

The two MP4 files were supplied as local files. Direct in-app-browser playback was blocked by the browser's file-URL policy, and the installed VLC entry did not expose a window. Per the user's direction, implementation proceeds from the written six-beat storyboard. Direct frame-by-frame comparison to either MP4 therefore remains unverified.
