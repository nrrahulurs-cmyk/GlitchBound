# GLITCHBOUND Intro and Reload Diagnosis

**Date:** 2026-10-24
**Repository state:** branch `main`, HEAD `6bea17f`; the worktree was already heavily modified before this task. No reset, clean, checkout, or commit was used.

## Verification boundary

I inspected the running code paths and the previously recorded performance work. I could not reproduce a fresh load, cinematic playback, restart, or second refresh in a live browser in this execution: browser use is disabled in the current Work settings. Therefore the source-level causes below are confirmed, but their individual contribution to the reported stutter is not newly isolated with a browser trace. Do not treat the historic samples as measurements of this patch.

Existing local measurements are recorded in [GLITCHBOUND_PERFORMANCE_FIX_REPORT.md](GLITCHBOUND_PERFORMANCE_FIX_REPORT.md) and [GLITCHBOUND_PERFORMANCE_REPORT.md](GLITCHBOUND_PERFORMANCE_REPORT.md). The most comparable earlier startup capture measured `createCity()` at 2,541 ms and module-to-ready at 3,160 ms before the city-layout optimization; after that change, it measured 1,639 ms and 2,371 ms. Those figures document the earlier optimization, not a before/after result for this intro patch. A prior intro/skip interaction also had a 1.1–1.5 s single-frame observation that did not reproduce consistently and could include automation overhead.

## Architecture and lifecycle

- `index.html` loads the Vite entry module `src/main.js`.
- `init()` in `src/main.js` creates the WebGL renderer, scene, camera, composer, synchronous city, city life, atmosphere, player and vehicle systems, then awaits ten GLBs with one `Promise.all`: interceptor, drone, crate, kiosk, mercenary, AV, pulse carbine, ion bolt, muzzle flash, and impact shards.
- `src/cinematics/glitchbound-intro.js` is a 13.8-second in-engine Three.js sequence. It animates the existing hero and vehicle, camera, and a bounded procedural saucer, beam, impact, 28-spark burst, and 30-point escape trail. It is not a video.
- The intro and gameplay share one renderer and the single `renderer.setAnimationLoop(animate)` loop. No second RAF loop or `window.location.reload()` call exists in the inspected runtime.
- Intro completion and skip transfer the existing vehicle/player state into gameplay. `restart()` is an in-memory state reset; it does not reload the document or reinitialize the renderer, GLBs, city, or event-listener set.
- `src/audio.js` creates its AudioContext on user interaction and caches sample promises and decoded buffers. The five authored sound files load after sound is enabled; restart does not reload or decode them again.

## Findings

### Intro playback

1. **Procedural effect churn on every replay (confirmed in the pre-fix source).** `start()` constructed the saucer, beam, impact, spark, and trail geometries/materials. Skip/completion disposed them. Replaying rebuilt the same small scene and forced its material programs through first-use compilation again. This is a repeatable source-level cost even though its exact frame-time impact was not captured in this environment.
2. **Per-frame temporary allocation and lookup work (confirmed in the pre-fix source).** Hero joint updates built a `Map` and helper closure repeatedly. Camera/effect updates created temporary vectors and camera-shot structures in the active cinematic path. These were avoidable recurring CPU/GC costs.
3. **First-visible shader preparation was not tied to intro readiness.** Combat shader prewarming existed, but it did not include the intro's procedural materials and the start action did not wait for that work. A visible first-use shader hitch is plausible; the prior firing/intro spikes do not prove this was the measured cause.
4. **The gameplay scene remains active during the intro.** The shared loop still updates the menu city, city life/citizens, atmosphere, and audio while the cinematic updates. Historic phase samples put city/civilian work around 4.6–4.8 ms/frame. There is no new browser trace showing this exceeds the budget during the intro.

### Startup, restart, and full refresh

1. **Synchronous city construction is the largest previously measured startup stage.** `createCity(scene)` builds the procedural city/layout and rendered batches before the GLBs load. The latest documented comparison reduced it from 2,541 ms to 1,639 ms while preserving the generated layout; module-to-ready went from 3,160 ms to 2,371 ms. Other historic captures vary and are listed in the existing reports.
2. **GLB loading is awaited once before the start control is enabled.** Prior stage instrumentation measured the ten-model load/parse/batch stage at about 177 ms and remaining post-asset initialization at about 486 ms. The current turn did not repeat those timings.
3. **City campaign textures start loading asynchronously during `createCity()`.** Sixteen campaign WebP files plus a portrait WebP total about 6.12 MiB on disk (individual files about 225–477 KiB). They are useful world artwork but are not intro-specific. Browser network/decode overlap with intro playback could not be captured. They remain unchanged pending an actual network/visual trace; deferring them without checking visible campaign coverage risks blank billboards.
4. **In-game restart is already safe and in-memory.** The existing `restart()` resets systems and actors; it creates no new renderer, animation loop, GLTF loader, or listeners. The task-specific addition now cancels an active or shader-preparing intro before this reset.
5. **A full page refresh necessarily rebuilds the application.** No service worker or runtime cache-busting query parameter is present. `vercel.json` gives fixed-name GLB/WebP/PNG assets `public, max-age=3600, must-revalidate`. This permits reuse while fresh and revalidation after expiry; actual response headers, request duplication, and warm-cache transfer were not inspectable in this session.
6. **Bundle size remains a known startup trade-off.** Vite's production output warns that the Three.js chunk is about 535.85 kB and the app chunk about 789 kB before gzip. No dynamic splitting was added without browser evidence that cold-network JS delivery is the limiting stage.

## Changes made for this recovery

- The cinematic effect root is now allocated once with the intro controller, reused across play/skip/replay, reset to a clean hidden state between runs, and detached after playback. Its geometries/materials are disposed only when the controller itself is disposed.
- Stable scratch vectors and camera-shot records are reused in the intro update path. Hero-part lookups are indexed once. Event arrays and impact/target clones are created only on cue frames, not every frame.
- Existing asynchronous shader preparation now includes the retained intro effect root. If the player starts before idle preparation completes, the overlay displays `PREPARING STORY SIGNAL`; it starts playback when preparation resolves, or after a logged fallback if compilation fails. The player can skip during preparation.
- Restart cancels active/pending intro state so no cinematic transform or overlay survives the reset.

## Compatibility and risk notes

- The 13.8-second sequence, cue timestamps, effect counts, vehicle chase handoff, assets, audio cues, camera shots, and main render loop remain in place.
- The reusable effect objects stay allocated for the lifetime of the intro controller. This deliberately trades a small bounded retained allocation for avoiding repeated creation and shader setup. Final controller disposal still releases those VFX resources.
- City construction, campaign image loading, GLB URLs, cache headers, physics, controls, NPC logic, and city geometry were not changed in this task.
- Current visual and WebGL GPU behavior remains browser-unverified. See the manual capture sequence in the performance report.
