# GLITCHBOUND Performance Audit

**Audit date:** 2026-10-24
**Repository:** `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`
**Scope:** measured runtime performance, lag reproduction, and low-risk stabilization for the existing Three.js game.

## Protected repository baseline

- Branch: `main`
- HEAD at audit start: `6bea17f` (`Ship completed hero assets and ground-contact fixes`)
- The working tree was already heavily modified before the performance work: 26 tracked paths were dirty and there were untracked documents, generated blueprint/assets, audio, Blender scripts and files, and tests. `src/main.js`, `src/city-shadows.js`, `package.json`, art, Blender deliverables and gameplay modules all contained user work. No reset, clean, blanket restore, or commit was performed.
- The performance changes are interleaved with earlier changes in `src/main.js` and `src/city-shadows.js`; this report describes only the performance additions. Preserve the existing local changes when reviewing or applying future patches.

## Architecture and startup

- Vite serves `index.html`; the page loads the single browser entry module `src/main.js`.
- `src/main.js` creates one Three.js scene, perspective camera, `WebGLRenderer`, and the player/city runtime. Renderer pixel ratio is capped at 1.5. The render path is an `EffectComposer` with `RenderPass`, `UnrealBloomPass`, and `OutputPass`.
- Initialization builds the procedural city and static/collision data, then loads ten GLB names through one `Promise.all` in `src/main.js:109`: interceptor, drone, crate, kiosk, mercenary, AV, pulse carbine, ion bolt, muzzle flash, and impact shards. The initial load also creates physics and the 284-citizen crowd, city-life/traffic, player and vehicle, service world, weapon pools, cinematic, local city-shadow proxy, and post-processing passes.
- `ready` is set after those systems are constructed; the game then starts one `renderer.setAnimationLoop(animate)` loop (`src/main.js:157`). The first title action starts the cinematic. The animation function advances gameplay/simulation, city and civilians, traffic/city-life, atmosphere, camera/cinematic, audio and weapon effects, HUD, city shadow, then submits the composer render (`src/main.js:534–595`).
- `src/city.js` owns the procedural city and 284 citizens; `src/city-life.js` updates traffic and scripted city activity; `src/simulation.js` owns gameplay and Cannon physics; `src/city-shadows.js` maintains a local directional shadow proxy; `src/weapon-vfx.js` pools projectile and impact effects. The custom GLB files remain under `public/assets/` and are loaded by URL from `src/main.js`.
- No second animation loop or repeated model-load loop was found in the inspected startup path. Diagnostics reuse `window.__glitchbound` and retain `window.__neon` as an existing compatibility alias.

## Reproduction and measurements

The local Vite page was inspected in the in-app browser at `http://127.0.0.1:4173/`. Measurements below use the same browser viewport (1234 × 668 CSS pixels), device pixel ratio 1.25, local development build, and the development-only `?perf=1` overlay. The overlay averages 360 RAF frame intervals; phase timings use `performance.now()`. These are this machine/browser's observations, not a hardware-independent guarantee.

Before the performance changes, a stable on-foot capture reported:

| Metric | Baseline observation |
| --- | ---: |
| Mean frame interval / derived mean FPS | 12.9 ms / 77.6 FPS |
| p95 / max frame interval | 14.0 ms / 27.8 ms |
| Frames over 33.3 ms | 0 / 360 |
| Main measured phases | simulation 1.7 ms; city + civilians 4.6 ms; city-life 0.7 ms; render + shadow 4.3 ms |
| Scene/workload snapshot | 1,678 objects; 1,431 visible meshes; 31 lights; 2,776 physics bodies; about 3.27 million submitted triangles |
| Shadow map refresh counter | 8,122 updates over about 132 s, roughly 61.5 updates/s |

After the shadow refresh cap, stable captures were generally 12.2–12.9 ms mean, 14.0 ms p95, 20.9–27.8 ms max and 77.6–82.0 derived average FPS. One comparable capture showed 4,948 shadow refreshes over 117.2 s (about 42/s); the later live capture was about 40/s. The approximately 35% reduction in refreshes is directly reflected by the counter. Frame rate did not improve materially in these same-machine samples, so the verified gain is reduced shadow refresh work, not a claimed FPS increase.

Representative post-change states:

| Scenario | Mean / p95 / max | >33.3 ms frames | Input-to-next-frame | Notes |
| --- | --- | ---: | ---: | --- |
| On-foot, weapon holstered | 12.9 / 14.0 / 20.9 ms | 0 / 360 | — | 77.6 average FPS; 598 calls and about 3.02M submitted triangles in that capture. |
| Driving | 12.2 / 14.0 / 20.9 ms | 0 / 360 | 13.9 ms | 82.0 average FPS; 443 calls and about 2.96M triangles in that capture. |
| First shot after combat shader warm-up | 14.3 / 20.8 / 41.8 ms | 1 / 360 | 14.5 ms | No new long-task entry appeared in the rolling counter; this short sequence had one frame spike. |

The latest cold/HMR initialization stage capture reported `createCity` at 2,665 ms, city-life creation at 11.9 ms, atmosphere creation at 3.0 ms, ten GLB loading plus parsing/batching at 177.1 ms, remaining post-asset initialization at 486.4 ms, and game-ready at 3,436.5 ms. The synchronous procedural city build is the largest measured startup stage and aligns with the observed multi-second loading stall. The earlier game-ready readings were 2.69–3.56 s. Navigation timing showed DOMContentLoaded 5.76 s and load 5.83 s in one capture; `readyMs` is measured from module startup while navigation timings use the document time origin, so those values are not directly comparable. Resource Timing listed 27 matching asset entries before audio was enabled and 32 after the five lazy sound files loaded. Byte totals were cache-limited and are deliberately not presented as download size.

The measured combat shader prewarm took 1,008 ms of wall-clock time across its asynchronous compile requests. This is readiness duration, not a claim of one 1-second main-thread task. Once the 360-frame sample had settled, the menu measured 12.3 ms mean, 14.0 ms p95, 20.9 ms max, and 0/360 frames over 33.3 ms.

With audio enabled by a user gesture, all five sound samples decoded successfully. The first local preload reported a slowest per-sample fetch of 99.5 ms and decode of 43.9 ms; after a reload/cache-warm run these were 43.4 ms and 37.9 ms. These are local browser/cache observations, not cold-network guarantees. Audio was returned to OFF after the check.

### Long tasks and memory

- Initial/intro runs produced intermittent long-task maxima between roughly 2.5 s and 7.8 s in early captures. Those stalls did not reproduce in later stable frames; a later rolling 60-second window showed three tasks with a 217 ms worst task. One observed first shot without prewarm had a 458 ms maximum frame and a 457 ms long task, with 18 of 360 frames above 33.3 ms. The later first-shot sample after prewarm was 14.5 ms input-to-frame with one 41.8 ms frame. The before/after shots were not a controlled identical run, so prewarm is promising but the improvement is not claimed as proven causality.
- Chromium `performance.memory` snapshots ranged from about 236–310 MB in stable play. During reinitialization/intro/HMR, snapshots temporarily reached about 1.4–1.67 GB and later fell substantially. This is evidence of transient heap pressure and garbage collection, not by itself proof of a retained leak.
- WebGL resource snapshots were about 199–275 geometries and 77 textures after entering gameplay; menu snapshots were lower. Counts are browser/scene-state snapshots and do not prove unique GPU allocations because assets share resources.
- Browser WebGL GPU timer queries were unavailable through the current browser automation surface. `renderer.info` values are CPU-side render submissions, not GPU execution time.

## Measured bottlenecks and source findings

1. **Confirmed avoidable shadow work:** `src/city-shadows.js` set `LightShadow.needsUpdate` and `renderer.shadowMap.needsUpdate` on every animation frame despite using a single local 2048² directional shadow map and a spatially stable shadow-proxy selection. This requested unnecessary repeated shadow rendering. The refresh is now budgeted to 45 Hz while preserving immediate refresh after substantial player movement or a large ground-height change.
2. **First-use combat shader work:** the first weapon draw/shot included a large one-off long task in one observed capture; later shots were much smoother. The weapon VFX pool has representative flight and impact material families, so one representative can be compiled asynchronously before combat use. The browser does not expose GPU timer queries here, and the two first-shot runs were not controlled; treat compilation as a likely contributor, not a fully isolated root cause.
3. **CPU work is measurable but not currently above its guardrail in the clean run:** city plus civilian updates averaged about 4.6–4.8 ms per frame for the 284 authored citizens and city work; simulation was about 1.6–2.0 ms and city-life about 0.8–0.9 ms. Existing CPU gait tests use an 8 ms bound and passed in the uncontented suite. Avoid reducing crowd or traffic behavior without a repeatable hardware profile.
4. **Rendering remains substantial:** roughly 3.0M submitted triangles, 443–801 render calls depending on active scene/effects and composer passes, about 1,431 visible meshes, and 31 lights. These counts warrant GPU profiling on target hardware, but no evidence here justifies removing geometry, lights, bloom, custom assets, or city density.
5. **Synchronous city construction dominates cold initialization:** a stage profile measured `createCity(scene)` at 2.665 s, versus 177 ms for the ten GLBs and their parse/batch work, about 12 ms for city-life creation, and 3 ms for atmosphere creation. This is a one-time startup cost, not a per-frame cost. It is not yet subdivided into city-generation substeps, so it is not safe to prescribe a targeted internal rewrite from this one stage timer.
6. **Large production JavaScript chunks:** Vite warns that the Three.js chunk is 535.85 kB and the app chunk is about 786 kB minified. Gzip output is about 135.35 kB for Three.js and 278.21 kB for the app bundle. This is a deployment/startup optimization opportunity; the current audit did not add dependency or manual chunking changes without a measured cold-network profile.

## Diagnostic instrumentation added

`src/performance-overlay.js` adds a development-only overlay, enabled only by `?perf=1` while `import.meta.env.DEV` is true. It reports RAF frame intervals, p95/max and >33 ms counts, input-to-frame latency, JavaScript phase timings, render calls/triangles, scene counts, shadow refreshes, physics-body count, WebGL resource counts, supported JS heap readings, active combat/intro effects, and observed long tasks. It separately displays the ten-GLB load duration and lazy audio sample fetch/decode timings recorded by `src/audio.js` after sound is enabled. Resource Timing is labeled as cache-limited; it does not report a misleading byte total. The overlay code and styles are created only when enabled, and no CSS import is shipped for the overlay.

The final production bundle was searched to confirm the overlay's code and selector were absent. The overlay source module itself still exists in the repository and the production build is free to tree-shake its development-only import.

## Commands and side effects

| Task | Command | Notes |
| --- | --- | --- |
| Existing dev server | Open `http://127.0.0.1:4173/` | This server was already running. `npm run dev` invokes `predev`, which runs `scripts/export-blueprint.mjs` and can rewrite dirty generated blueprint files. |
| Tests | `npm run test` (or `node scripts/test.mjs`) | Runs suites sequentially; the CPU-heavy civilian integration check can be noisy under competing builds. |
| Production build with current scripts | `npm run build` | Runs `prebuild` blueprint export and `postbuild` deployment pruning; both can rewrite/remove generated outputs. |
| Side-effect-limited build used here | `node node_modules/vite/bin/vite.js build --configLoader native` | Builds directly without the npm lifecycle export/prune scripts. Vite completes successfully but keeps its >500 kB chunk warning. |
| Local gameplay profiler | `http://127.0.0.1:4173/?perf=1` | Dev-only; refresh resets its 360-frame sampling window. |

No Blender MCP operation was needed for this runtime audit. A production browser preview could not be reached on a separate local preview port in this environment; the production build artifacts and development runtime were inspected instead.

## Risks and compatibility constraints

- Preserve the existing dirty `main` worktree, custom GLBs, textures, audio, Blender files, generated assets, and concurrent gameplay/camera/localization/audio/cinematic changes. Do not use reset, clean, or blanket restore commands.
- Keep the single animation loop and current physics time step. Do not change camera look, vehicle behavior, NPC counts, combat, city geometry, or display quality to improve a synthetic metric.
- Shadow refresh is lower-rate, but a movement/height threshold forces an immediate shadow selection/update. Visually inspect rapid movement, tall-building shadow changes, and the vehicle camera in both FPP and third person on the target display.
- Resource Timing and `performance.memory` vary with cache, browser, extensions, and garbage collection. The WebGL counters do not reveal GPU timing.
- Validate the production server on the user's actual browser after deploy; this environment did not verify a production preview page.

## Recommended follow-up order

1. Repeat cold-start and intro captures in a clean browser session, with no HMR or DevTools automation load, to identify whether the multi-second long tasks reproduce.
2. Run a production preview on a target device with WebGL GPU timing support; capture the same on-foot, dense-city, driving, and repeated-combat states.
3. Visually check shadow refresh at speed, tall occluders, FPP/third-person camera movement, and pause/resume/restart.
4. If CPU remains limiting, profile city/civilian per-stage work before changing update rates; preserve all 284 citizens and their collision decisions until evidence supports a safe simulation LOD.
5. If GPU remains limiting, profile bloom, resolution, lights, material overdraw and mesh submission separately before considering quality presets or LOD.
6. If startup remains limiting, capture cold asset network/decode timings and inspect Vite chunking; keep source assets and existing build/export conventions intact.
