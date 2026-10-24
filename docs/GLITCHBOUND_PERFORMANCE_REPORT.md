# GLITCHBOUND Performance Stabilization Report

**Date:** 2026-10-24
**Audit:** [GLITCHBOUND_PERFORMANCE_AUDIT.md](GLITCHBOUND_PERFORMANCE_AUDIT.md)

## Result

The investigation found one repeatable rendering inefficiency and one likely first-use combat hitch. The local shadow map was being invalidated every animation frame; it now updates on a 45 Hz budget, with immediate refresh after a meaningful player move or terrain-height change. Weapon and representative projectile/impact shader variants now compile asynchronously during browser idle time, without delaying the game's ready transition. A query-gated development overlay provides repeatable local measurements.

The captured stable gameplay frame time was already under 16.7 ms on this machine. Average FPS did not materially improve, so this report does not claim a general FPS gain. The confirmed improvement is approximately 35% fewer shadow refreshes in the measured captures. One post-warm-up first shot was responsive, but its comparison with the earlier hitch is not a controlled experiment.

## Files changed for this performance task

- `src/city-shadows.js` — accumulated frame time and capped shadow refreshes at 45 Hz; preserved immediate movement/height-triggered refresh and existing 2048 map quality.
- `src/main.js` — added development profiler phase markers and game/runtime metrics; passes the RAF timestamp into city shadows; schedules combat shader prewarm after initialization without awaiting it before gameplay readiness.
- `src/weapon-vfx.js` — exposes an off-scene representative clone of the pooled projectile/impact materials for asynchronous shader compilation. The clones share the active geometries and materials.
- `src/audio.js` — reports per-sample fetch, decode, and total load durations in diagnostics; this does not change loading order or playback behavior.
- `src/performance-overlay.js` — development-only `?perf=1` measurements. Transfer bytes are explicitly marked cache-limited instead of being reported as an incorrect total.
- `tests/city-shadows-performance.test.mjs` — confirms first refresh, interval skipping, approximately 45 Hz cadence at 60 Hz input, and immediate update after movement.
- `docs/GLITCHBOUND_PERFORMANCE_AUDIT.md` — findings, baseline, reproducible commands, constraints, and follow-up order.
- `docs/GLITCHBOUND_PERFORMANCE_REPORT.md` — this implementation and validation record.

`src/main.js` and `src/city-shadows.js` already contained extensive local modifications before this task. The items above identify the performance-specific additions; their full diffs also include earlier user changes that were preserved.

## Measurements

Environment: local Vite development server, in-app browser, 1234 × 668 viewport, 1.25 DPR, warm local assets. Frame values use a 360-frame sample and include compositor frame intervals.

| State | Mean | p95 | Max | >33.3 ms | Input-to-frame |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stable on-foot before change | 12.9 ms | 14.0 ms | 27.8 ms | 0 / 360 | — |
| Stable on-foot after shadow cap | 12.9 ms | 14.0 ms | 20.9 ms | 0 / 360 | — |
| Driving after changes | 12.2 ms | 14.0 ms | 20.9 ms | 0 / 360 | 13.9 ms |
| Settled title menu | 12.3 ms | 14.0 ms | 20.9 ms | 0 / 360 | — |
| First shot after shader warm-up | 14.3 ms | 20.8 ms | 41.8 ms | 1 / 360 | 14.5 ms |

The stable on-foot mean stayed effectively unchanged (about 77.6 FPS before and after); driving averaged about 82 FPS. Shadow refreshes fell from about 61.5/s in the baseline to about 40–42/s in later captures. The capture after a first shot had one frame over 33.3 ms, so combat is not described as spike-free.

One earlier no-prewarm shot sample recorded a 458 ms maximum frame and 457 ms long task, with 18/360 frames over 33.3 ms. In the later prewarmed sample, input-to-frame was 14.5 ms and the rolling long-task count did not increase, though the frame maximum was 41.8 ms. The machine/browser state and combat moment were not controlled between these two captures; this is consistent with a first-use shader hitch, but does not prove prewarm alone caused the difference.

Steady-state JS phases were approximately: city/civilians 4.6–4.8 ms, simulation 1.6–2.0 ms, city life 0.8–0.9 ms, and render plus shadow submission 3.5–5.9 ms. That leaves city/civilian work as the largest measured per-frame JavaScript subsystem; it was not changed because the clean CPU gait integration remained below its 8 ms test bound and no repeatable update-loop regression was isolated.

A separate cold initialization measurement shows the one-time synchronous city build (`createCity`) takes 2,665 ms. City-life setup took 11.9 ms, atmosphere setup 3.0 ms, GLB loading/parsing/batching 177.1 ms, remaining post-asset initialization 486.4 ms, and total module-to-ready 3,436.5 ms. This explains the startup pause; it is not a gameplay-frame cost. The current evidence does not subdivide the city build enough to safely change its construction architecture in this stabilization patch.

With sound enabled, all five lazily loaded SFX decoded. The slowest per-sample fetch/decode measured 99.5/43.9 ms on the first local load and 43.4/37.9 ms on a cache-warm repeat. Resource Timing entries increased from 27 to 32. These numbers are local and cache-sensitive; audio was returned to OFF after validation.

## Validation

- Tests: `scripts/test.mjs` completed with **27/27 suites passing**. The sequential final run passed the civilian integration performance guard as well as the new shadow cadence test.
- Production build: direct Vite build completed successfully. Final output: CSS 40.65 kB (9.51 kB gzip); physics 87.56 kB (25.14 kB gzip); Three.js 535.85 kB (135.35 kB gzip); app 786.72 kB (278.34 kB gzip). Vite warns about chunks over 500 kB. No manual chunking change was made without cold-network evidence.
- Production overlay check: after the final build, the profiler implementation and overlay selector are absent from production assets; no production stylesheet import is required for the overlay.
- Development browser: `?perf=1` overlay appeared and reported metrics. Console inspection returned only Vite connection debug messages; no browser error or warning entries were present in the captured log set.
- Existing controls/physics/camera paths were not altered by these performance changes. The complete test suite includes camera-rig, camera-obstruction, player movement, vehicle visual registry, intro lifecycle, city simulation, and weapon simulation tests.
- A production preview page could not be reached on a separate local preview port in this environment. Therefore production runtime, GPU execution time, and visual shadow quality after a long/high-speed drive are not claimed as browser-verified.

## Memory, lifecycle, and gameplay impact

- The profiler and its panel are opt-in and development-only. A production-bundle search confirms their code and selector are absent.
- Combat prewarm uses representative clones that share pooled resources; the clones are kept outside the scene and are used only by `renderer.compileAsync`. No asset is duplicated or disposed.
- Recorded sound samples remain lazy-loaded after audio is enabled; the profiler now shows their decoded count and per-sample fetch/decode timings. Performance is not changed by recording the durations.
- The existing intro tests pass the skip/finish/replay cleanup checks. No gameplay system, city geometry, citizen/traffic count, physics behavior, camera movement, vehicle control, weapon behavior, or graphics quality was removed or reduced.
- Heap samples ranged from roughly 236–310 MB in stable play, with temporary higher readings during reinitialization/intro. This is not enough to certify the absence of a browser/GPU memory leak; long repeated sessions should still be checked.

## Remaining risks and next checks

1. Profile a cold production launch and first intro on a clean target browser to determine whether the large initial long tasks reproduce independently of HMR or automation.
2. Subdivide `createCity` startup into measured construction stages before refactoring it; preserve asset and collision contracts.
3. Run GPU timer profiling on the target device; current triangle/draw-call metrics are CPU submission counts only.
4. Inspect shadow stability in fast vehicle traversal, tall occluders, and both camera modes.
5. Repeat weapon firing, pause/resume, death/reconnect and intro replay while tracking heap and WebGL resources over several minutes.
6. Consider code splitting only after a cold-cache network profile confirms the large chunks affect startup; current Vite warning is the verified limitation.
