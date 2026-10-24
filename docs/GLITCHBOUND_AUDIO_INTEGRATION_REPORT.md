# GLITCHBOUND Audio Integration Report

Date: 2026-10-24  
Scope: integrate the five user-supplied gameplay recordings without changing physics, movement, combat timing, damage, NPC behavior or city content.

## Result

The five supplied recordings are copied unchanged to `public/audio/glitchbound/`. The existing single Web Audio engine now lazily fetches and caches the runtime samples after the existing sound-toggle user gesture. Existing procedural sounds remain as fallbacks when an asset fails to load. The master toggle and limiter still govern all output.

| Asset | Hook | Playback behavior |
|---|---|---|
| Vehicle acceleration | Edge from inactive to active vehicle throttle | One sample while throttle is held; skip measured 0.66 second leading silence; fade when released. The existing speed-sensitive procedural motor remains responsible for continuous RPM/idle behavior. No loop or pitch-shifting claim. |
| Character hurt | Confirmed local health decrement | Centered one-shot with a 0.32 second repeat guard and reduced gain. Vehicle and NPC damage do not route to this local-player sound. |
| Weapon gunfire | Existing accepted weapon fire call after cooldown/ammo checks | A 0.475 second stereo derivative from source seconds 0.025–0.50 plays at the muzzle, with short fades and at most three overlapping sample voices. The 7.488 second source is preserved and never replayed per bullet. |
| Sci-fi chase | First transition of a security drone into its existing responding state | One spatial one-shot at the drone, with a 2.5 second repeat guard; no loop or per-frame playback. |
| Sci-fi crash | Existing security-drone destruction event | One spatial one-shot at the destroyed drone; the 9.143 second tail is retained. It does not play on ordinary vehicle bumps. |

Initial gains are in `public/audio/glitchbound/manifest.json`. They are intentionally category-specific and conservative under the existing master gain and compressor; no loudness normalization was applied.

## Changed files

- `src/audio.js` — added lazy fetch/decode/cache, bounded sample voices, local/spatial sample playback, throttle-edge handling, master-mute cleanup, and fallbacks within the existing audio context.
- `src/main.js` — routes accepted fire, throttle state edges and confirmed local damage through that engine; clears throttle audio state on pause, game end and on-foot transitions.
- `src/simulation.js` — emits a pursuit transition once when a patrol begins responding and includes the world position in existing drone-destruction events. No new entity or gameplay behavior was added.
- `public/audio/glitchbound/` — five unchanged user recordings, one derived gunfire WAV transient, and a machine-readable manifest with event mapping, gains, provenance and hashes.
- `scripts/derive-audio-transient.py` — reproducible Blender `aud`-decoder derivative utility. It writes a new PCM file and never edits the source.
- `tests/audio-samples.test.mjs` — checks manifest hashes, existing pursuit/destruction event transitions, sample decoding after unlock, positional source placement, the hurt cooldown, throttle release, missing-file procedural fallback, pause-tail retention and mute/dispose cleanup using a fake Web Audio context.
- `docs/GLITCHBOUND_AUDIO_AUDIT.md` — source architecture, event findings, decoded clip measurements and audit limitations.
- `README.md` — documents the hybrid procedural/recorded audio system and manifest/audit links.

## Verification performed

- Decoded all five supplied recordings with Blender 5.2.3's `aud` module. Verified sample rate, stereo channels, PCM duration, peak/RMS, clipping fraction and leading/trailing low-level silence. Detailed values and measurement method are in the [audio audit](GLITCHBOUND_AUDIO_AUDIT.md).
- Derived `weapon-gunfire-one-shot.wav` from 0.025–0.50 seconds of the supplied gun recording with a 6 ms fade-in and 55 ms fade-out. Its output is stereo 24 kHz PCM, 0.475 seconds, 45,644 bytes. The source MP3 remains unchanged beside it. The derivative's SHA-256 is checked by the test suite against the manifest.
- `node tests/audio-samples.test.mjs` passed. It includes actual `createSimulation()` transition checks for one pursuit event per response transition and a positioned kill event.
- A simulated 404 for the derived gun sample still produces the existing procedural shot, while the failed asset is surfaced in audio diagnostics.
- `node scripts/test.mjs` passed all **23/23** suites, including the new audio suite.
- `node scripts/check-english.mjs` passed with 116 source files. This text-only scanner does not inspect sound or image pixels.
- Production Vite build passed with 66 modules transformed. The existing advisory for the 760 kB application chunk remains. The prebuild blueprint export reported 185 envelopes, 646 sign mounts, 77 street fronts, 31 authored assemblies, 15 walking routes and 2 entrances; its generated JSON was byte-identical to the saved prebuild baseline.
- Served the generated `dist/` with Vite preview and fetched the manifest and every mapped audio URL plus the retained gun source. All returned HTTP 200 with non-empty bodies; MP3 files were `audio/mpeg` and the derivative was `audio/wav`. The built `index.html` title was `GLITCHBOUND — After the signal`.
- The normal `pnpm run build` wrapper could not run in this environment: it moved the existing local Vite/Three/Cannon packages to `node_modules/.ignored`, then package reinstall failed because registry network access is denied. Those exact local copies were preserved and linked back into `node_modules`; Vite 7.3.6 was then invoked directly to run the same blueprint-export, production-build and postbuild steps successfully. No tracked dependency metadata was changed by that recovery.

## Listening and remaining review

**Perceptual listening was not available in this execution environment.** The clips were analyzed from decoded PCM but not audibly previewed. The 15.792 second acceleration, 7.488 second multi-transient gunfire, 3.600 second chase and 9.143 second crash are not looped based on their filenames or file boundaries. The early gunfire transient is a waveform-selected candidate, not a perceptually approved edit.

Before calling the mix final, listen in the running game with headphones/speakers and adjust the manifest's suggested gains if needed. In particular:

1. Hold/release throttle briefly and continuously; confirm the acceleration clip is recognizable, responsive, and not an irritating long overlay. The procedural motor should still cover idle and speed changes.
2. Tap and hold fire; confirm the derived sound is a clean gunshot, remains aligned to the muzzle, and does not accumulate or sound clipped at the existing fire rate.
3. Take repeated confirmed damage; confirm the hurt clip is clear but not startling and the cooldown feels right.
4. Trigger a wanted response and destroy a patrol drone; check distance attenuation, pursuit transition behavior and the crash tail. Verify minor vehicle impacts do not trigger the crash clip.
5. Toggle sound off, pause during a crash tail, and resume; confirm mute stops all effects and that an already-playing crash tail can finish during pause.

No Blender scene or image texture was changed; the gameplay hooks are in the existing browser Three.js simulation. No real browser audio device test was possible here, so the automated Web Audio stub and static HTTP checks do not substitute for that listening pass.

## Expanded gameplay and interface sound pass

The shared audio engine now covers the existing high-value action and interface transitions with original procedural cues. This is an event map only; it does not add or alter gameplay systems.

| Existing event | Audio feedback |
|---|---|
| Button hover/focus, confirm, back, sound enable and unavailable action | Quiet short interface tones with hover/error rate guards; UI cues can play on the title screen once sound is enabled. |
| Weapon draw/holster, accepted hit, reload start/completion | Mechanical slide and latch, crisp hit confirmation, and separate magazine/rack cues. |
| Jump, dash, EMP, landing | Brief lift, filtered velocity sweep, layered low-frequency pulse, and the existing surface-aware landing cue. |
| Service start, successful completion and interruption | A soft terminal handshake, resolved service-type-pitched chord, and a distinct descending abort cue. No per-frame progress tones. |
| Vehicle entry/exit, blocked exit, impact and handbrake | Mechanical latch/door movement, restrained denial tone, speed-scaled spatial impact, and a short brake scrub. The existing engine/motor and user acceleration clip remain separate. |
| Incoming hostile fire, crime/wanted transition, wanted cleared, destructible-cell explosion and game over | Spatial filtered threat transients, rate-limited alert motifs, a layered distant explosion, and a restrained end-state descent. |

Procedural cues use the same unlocked Web Audio graph, master control, limiter, cleanup and bounded one-shot budget as the recorded samples. Actions play only at existing state transitions; no frame loop produces one-shot calls. Collision and threat cues are spatialized at their event position, and UI hover/error effects have cooldowns. No weapon damage, ability timing, collision response, vehicle behavior, security logic, service outcome or other gameplay rule changed.

`tests/audio-samples.test.mjs` now covers UI audio before gameplay starts, action-cue routing, spatial vehicle impact, voice-budget bounds and lifecycle cleanup in addition to the five recorded samples. The procedural timbres were designed and validated structurally; they still need an in-game listening and mix-level review on speakers/headphones because this environment cannot audition Web Audio output.

### Final verification after the expanded cue pass

- `node tests/audio-samples.test.mjs` passed, including the game-over tail across the playing-to-ended transition and immediate stop on master mute.
- `node scripts/test.mjs` passed all **23/23** suites.
- `node scripts/check-english.mjs` passed all 116 scanned source files.
- The production Vite build completed successfully and deployment pruning retained 18 runtime images. The existing advisory for the approximately 768 kB app chunk remains; this audio change does not introduce a build failure.
- `git diff --check` reported no whitespace errors in the changed audio, integration, test and report files. The existing working tree contains unrelated prior project changes and they were preserved.
