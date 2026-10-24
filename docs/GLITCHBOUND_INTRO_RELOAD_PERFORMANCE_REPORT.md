# GLITCHBOUND Intro and Reload Performance Report

**Date:** 2026-10-24
**Scope:** Reduce replay-time intro work and prevent first-use cinematic shader preparation from landing in a critical shot, while preserving the existing intro and game.

## Root cause and change summary

The previous intro controller rebuilt and disposed the same procedural effect scene on each playback. Its frame path also recreated temporary lookup and math objects. The gameplay shader warmup did not include the intro effect materials, so a fast start could reach the first reveal before those shaders were prepared. These are confirmed source-level problems; the current browser environment did not permit a controlled trace to attribute a particular measured hitch to any one of them.

The intro now keeps a single bounded effect set, resets and reuses it for each replay, reuses scratch math objects and joint lookup data, and includes its material variants in the existing asynchronous compile pass. If the player clicks before compilation finishes, a preparation overlay appears and remains skippable. The main loop, story, shots, cue timing, characters, vehicle, city, audio, and gameplay behavior stay intact.

## Files changed for this task

- `src/cinematics/glitchbound-intro.js` — retained/resettable effect root; reusable camera/effect scratch objects; cached hero-part lookup; removed repeated per-frame helper/vector allocations.
- `src/main.js` — async warmup includes intro materials; start waits only when warmup is still pending; preparation can be skipped; restart cancels active/pending cinematic state; diagnostics expose preparation state.
- `tests/glitchbound-intro.test.mjs` — verifies reuse across skips/replays/natural completion, no accumulating scene nodes, restored handoff/skip state, and terminal disposal.
- `docs/GLITCHBOUND_INTRO_RELOAD_DIAGNOSIS.md` — source findings, measured history, and browser-verification boundary.

The worktree already had numerous local changes and untracked assets before this task. They were preserved. No asset, Blender scene, branding, camera design, physics, NPC logic, vehicle behavior, combat, or city geometry was modified here.

## Measurements and limits

There is no valid before/after browser measurement for this patch. Browser automation is disabled in the current Work session, so I could not measure cold/warm refreshes, intro frame intervals, long tasks, network/decoding, post-intro input response, or memory after repeated replay. I have not claimed an FPS or reload-time improvement.

Previously recorded local development-browser measurements provide context only:

| Historic measurement | Before earlier city-layout optimization | After earlier city-layout optimization |
| --- | ---: | ---: |
| `createCity()` stage | 2,541 ms | 1,639 ms |
| Module startup to ready | 3,160 ms | 2,371 ms |

These values are from the existing performance fix report, not a controlled test of this change. An earlier intro interaction had occasional 1.1–1.5 s frame observations, but they were not reproducible in a clean comparable run and may include automation overhead. Historic settled menu/gameplay captures were smooth; they do not establish that the cinematic is now hitch-free.

## Validation run

- `node tests/glitchbound-intro.test.mjs` — 3/3 intro lifecycle checks passed after the final test edit.
- `node scripts/test.mjs` — 27/27 suites passed, including intro, camera, movement, vehicle, audio, world, and simulation regression suites.
- Production Vite build with the bundled Node 24 runtime (`v24.22.1`) — passed; 71 modules transformed. Output was built directly to a new temporary directory to avoid project lifecycle hooks that regenerate the already-dirty blueprint and prune deployment assets; the verified temporary output was then removed.
- Build output: CSS 40.65 kB (9.51 kB gzip), physics 87.56 kB (25.14 kB gzip), Three.js 535.85 kB (135.35 kB gzip), app 789.09 kB (278.95 kB gzip). Vite retains its warning for chunks above 500 kB.
- Node 24 syntax checks passed for `src/main.js` and `src/cinematics/glitchbound-intro.js`.
- A full-worktree `git diff --check` still reports trailing whitespace in pre-existing dirty files `blender/build_assets.py` and `blender/city-scene-manifest.json`; those unrelated files were not altered. It also reports only line-ending normalization warnings for the pre-existing generated blueprint, audio and stylesheet edits.

## Reload, cache, and restart conclusions

- In-game restart already uses an in-memory reset and does not reload the page or re-fetch the GLBs/audio. The fix makes restart safe if triggered during an intro or its shader-preparation phase.
- Full browser reload still rebuilds the synchronous city and loads the initial GLBs. The earlier city-layout optimization is the measured improvement already present in this checkout. This task did not further restructure initialization because browser/network evidence was unavailable and changing the city build order would risk showing partially initialized content.
- Stable campaign texture requests and cache headers remain unchanged. Their cold/warm behavior is an outstanding browser network check. No service worker or cache-busting was added.

## Manual browser validation still required

On the project browser at `http://127.0.0.1:4173/?perf=1`, capture a clean DevTools Performance + Network + Memory run with no HMR activity:

1. Cold-load and warm-reload separately; note navigation-to-ready, request count/transfer, texture decode, and the `createCity`, GLB, and post-asset timings shown by the profiler.
2. Click `BEGIN THE STORY` immediately after the control becomes active. Confirm `PREPARING STORY SIGNAL` appears only if shader compilation is pending, stays responsive, and can be skipped with the button, Escape, or Space.
3. Record frame intervals and long tasks at the reveal, impact, gunshot, vehicle entry, acceleration, and gameplay handoff.
4. Complete the intro, skip it, then replay it several times. Check for duplicated effects, stale characters/cars, console errors, input/camera recovery, and monotonically growing JS heap or WebGL geometry/texture counts.
5. Restart from gameplay repeatedly and confirm it remains in-memory; separately refresh the browser twice and compare cached asset requests.

Do not treat the current passing CPU tests or successful bundle as a substitute for those visual/GPU/network checks.
