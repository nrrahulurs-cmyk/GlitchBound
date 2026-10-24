# GLITCHBOUND Performance Fix Report

**Date:** 2026-10-24  
**Scope:** Reduce measured startup and recurring rendering work while preserving city layout, assets, gameplay systems, and graphics quality.  
**Baseline:** Branch `main`, HEAD `6bea17f`; the worktree already contained substantial user changes. No reset, clean, commit, asset replacement, or gameplay redesign was performed.

## Findings and changes

### City initialization: repeated full-city scans

`buildingRecords()` in `src/city-blueprint.js` searched the complete 162,262-box city array once for each of 186 eligible building colliders. This was a repeated-scan cost in the synchronous city-layout path, which runs during browser startup and is also shared with exporters.

The function now builds local lookup maps by block ID and by chunk before deriving the same building sections. The filters, ordering, fallbacks, and resulting records remain unchanged. Before and after the change, the complete serialized layout was 35,408,361 bytes with SHA-256 `91e860357bad03322aef55d9a73bb153d040a5909fd8019a30dbbc9db550be4e`; the generated blueprint compared equal to `public/blueprint/blueprint.json`.

Measured on the same local machine:

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| `createCityLayout()` isolated Node run | 1,543 ms | 1,247 ms | 296 ms faster (19%) |
| Browser `createCity()` initialization | 2,541 ms | 1,639 ms | 902 ms faster (36%) |
| Browser module startup to game ready | 3,160 ms | 2,371 ms | 789 ms faster (25%) |

Browser measurements came from the same local Vite session, 1234 × 668 CSS pixels, DPR 1.25. This is a one-machine development-browser comparison, not a production-device guarantee.

### Rendering and shader first-use work

The existing stabilization changes also address work identified in the earlier performance audit:

- `src/city-shadows.js` limits local shadow-map refreshes to a 45 Hz budget while retaining immediate refresh after a significant player movement or height change. No shadow resolution or visual quality was lowered. Recorded refresh frequency fell from about 61.5/s to about 40–42/s (roughly 35% fewer refreshes); measured mean FPS did not materially rise from this change alone.
- `src/main.js` schedules combat shader compilation during browser idle time and does not wait for it before declaring the game ready. `src/weapon-vfx.js` supplies representative pooled projectile and impact materials for that compile. Measured warm-up duration was about 585–1,009 ms. A pre-warmed shot sample was responsive, but the before/after firing samples were not controlled, so causation is not claimed.
- `src/audio.js` records fetch/decode timing for the existing lazy-loaded sounds for diagnostics. It does not change playback or loading behavior.
- `src/performance-overlay.js` exposes opt-in development measurements at `?perf=1`; its selector was absent from production JavaScript output.

An attempted small NPC-navigation allocation reduction was removed because its measured result did not separate from run-to-run variation. No citizen count, update cadence, physics, input, combat behavior, vehicle behavior, or city geometry was reduced.

## Runtime checks

The development game at `http://127.0.0.1:4173/` was opened and inspected. Sound remained off. The settled title-menu sample after the startup optimization reported 11.1 ms mean, 14.0 ms p95, 20.9 ms maximum over 360 frame intervals, and zero long tasks in the latest 60-second window. That corresponds to about 90 derived average FPS for this capture; it does not imply a constant 90 FPS target or represent other hardware.

Representative interactions were exercised in the browser:

- Start the story and skip the intro to reach the gameplay HUD.
- Walk with WASD; a sample reported 14.5 ms mean, 20.8 ms p95, one of 360 intervals over 33.3 ms, and 14.1 ms input-to-next-frame.
- Fire once; the game registered the expected public-discharge alert and a projectile. The overlay later showed no active projectile or impact pool entries.
- Pause and resume; the game returned to the playing state.
- Console inspection returned no captured error or warning entries.

The earlier audit also recorded a driving sample at 12.2 ms mean / 14.0 ms p95 / 20.9 ms max, with 13.9 ms input-to-frame. Repeated long-session restart cycles, target-device GPU timing, and production-preview gameplay were not verified in this pass.

Some interaction captures around intro skip and camera/fire input contained single long frames of about 1.1–1.5 seconds. They were not reproducible under a controlled clean production run, and the local browser overlay does not provide GPU timing. They remain unresolved observations; the settled capture and normal walking sample do not establish that all transition stalls are fixed.

## Validation

- `node scripts/test.mjs` — **27/27 suites passed**, including civilian integration/performance guards, camera and movement, collision, combat, intro cleanup, vehicle visuals, and shadow-refresh cadence.
- Direct Vite production build — **passed**. It was written to a temporary workspace folder and removed after verification. The existing package `prebuild`/`postbuild` hooks were not run because they regenerate or prune already-modified generated assets.
- Production output checks — all 11 local HTML asset references resolved; the development performance-overlay selector was absent from production JavaScript.
- Build output still includes a Vite warning for the 786.95 kB app chunk (278.46 kB gzip). No code splitting or quality reduction was attempted without cold-network or GPU profiling evidence.
- `git diff --check` on the touched city-layout file passed.

## Files for this performance work

- `src/city-blueprint.js` — indexed source boxes during building-record creation; output verified byte-for-byte at the serialized layout level.
- `src/city-shadows.js` — rate-limited the local shadow refresh while retaining movement/height-triggered refresh.
- `src/main.js` — startup/frame diagnostics and idle-scheduled combat shader warm-up.
- `src/weapon-vfx.js` — representative pooled materials for combat shader warm-up.
- `src/audio.js` — diagnostic sample fetch/decode timings only.
- `src/performance-overlay.js` — opt-in development performance overlay.
- `tests/city-shadows-performance.test.mjs` — shadow cadence and movement-trigger test.
- `docs/GLITCHBOUND_PERFORMANCE_AUDIT.md` and `docs/GLITCHBOUND_PERFORMANCE_REPORT.md` — prior audit and stabilization measurements.
- `docs/GLITCHBOUND_PERFORMANCE_FIX_REPORT.md` — this final record.

Several of these paths were already dirty before the current pass because the shared worktree contains earlier localization, branding, gameplay, asset, and documentation changes. This report identifies the performance-specific work; preserve the rest of the local diff.

## Remaining checks

1. Capture a cold production build on the target browser/device with GPU timing and without automation or hot reload.
2. Repeat the intro, weapon first-use, drive, pause/resume, and several restart cycles while recording frame intervals and memory/resource counts.
3. Investigate the rare long transition frames before claiming that all stutter is eliminated.
4. Decide on chunk splitting only after measuring cold-cache network impact; the current app-chunk warning is verified, but its effect on play is not.
