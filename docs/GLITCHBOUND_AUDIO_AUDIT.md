# GLITCHBOUND Audio Audit

Audit date: 2026-10-24  
Workspace: `C:\Users\Abhinaykumar\OneDrive\Documents\GlitchBound`  
Branch: `main`  
Baseline status: `main...origin/main`; existing user modifications and untracked files are present. They were preserved. No checkpoint or reset was performed.

## Scope and evidence

Inspected the current `src/audio.js`, `src/world-audio.js`, vehicle/input/damage/fire paths in `src/main.js`, drone dispatch and destruction paths in `src/simulation.js`, project package scripts, and existing tests. The five supplied files were found in `C:\Users\Abhinaykumar\Downloads\sfx\` and decoded with Blender 5.2.3's `aud` module. The metrics below come from decoded PCM, not MP3 container estimates.

**Audition limitation:** this execution environment has no exposed audio-listening or Blender MCP tool, and its audio output is not available as perceptual input to the agent. I did not audibly audition the clips. Signal statistics can identify duration, silence, peaks and envelope changes, but cannot prove the sound's perceived character or that a loop point is seamless. Proposed use is therefore provisional and should receive a real in-game listening pass.

## Existing audio architecture

- `src/main.js` constructs one `createAudio()` instance and calls `audio.update()` from the existing frame loop. The browser AudioContext is created only after the user clicks the sound toggle, meeting autoplay restrictions. Sound starts muted.
- `src/audio.js` is the single Web Audio engine. It owns one context, a master gain, compressor limiter, the spatial `createWorldAudio()` system, procedural one-shots, bounded voice tracking, event history, and cleanup. Existing controls are a master sound ON/OFF toggle; there is no separate effects slider.
- `src/world-audio.js` updates the listener from the active camera, procedural rain/district/traffic/machinery sources and a speed-dependent procedural vehicle motor. The procedural motor is already the continuous engine/RPM layer and should remain in place.
- Confirmed local-player damage flows through `damage(amount)` in `src/main.js`, which is called by existing gameplay damage paths. This is the right non-positional player hurt event; collision detection alone is not an adequate trigger.
- `fire()` in `src/main.js` enforces the existing 0.14 second weapon cadence and calls `audio.shot()` once per accepted shot. Keep that cadence and simulation/weapon contracts unchanged.
- `movePlayer()` computes vehicle throttle and currently calls the procedural motor update. A throttle edge can drive a short acceleration accent; do not restart a sample from the frame loop.
- `dispatchDrone()` in `src/simulation.js` transitions patrol drones into a responding state. `damageDrone()` emits `kill` only when a drone is destroyed. Those are the existing pursuit and destruction transitions. `carImpact()` includes routine bumps and is deliberately not a suitable trigger for the long crash effect.
- Pausing/stopping gameplay calls audio lifecycle methods; the sample implementation must respect mute/dispose and retain natural crash tails where possible.

## Supplied clip measurements

All files are stereo. Peak/RMS are decoded float sample amplitudes; clipping fraction counts decoded samples at or above 0.999 (MP3 decoding can overshoot nominal full scale). Silence was estimated using a 0.001 amplitude frame threshold.

| Supplied file | Bytes | Rate | Duration | Peak | RMS | Clipped fraction | Leading / trailing silence | Signal observation |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `car accereletion.mp3` | 315,840 | 24 kHz | 15.792 s | 0.283 | 0.046 | 0 | 0.660 / 0.176 s | Long, changing envelope with several strong swells; not a seamless loop based on the file boundary. |
| `cookiecheese-hurt-sound-531758.mp3` | 28,416 | 48 kHz | 0.888 s | 1.001 | 0.187 | 0.0094% | 0.074 / 0.012 s | Short transient and fast decay; a one-shot candidate. Reduce gain and retain limiter. |
| `gunfiring sound - Copy.mp3` | 149,760 | 24 kHz | 7.488 s | 0.968 | 0.181 | 0 | 0.025 / 0.024 s | Repeated strong transient groups across the recording, rather than one isolated shot; not appropriate to replay whole on every 0.14 s bullet. An early transient appears sufficiently isolated to derive a short single-shot accent; confirm by listening. |
| `ufo chasing.mp3` | 72,000 | 24 kHz | 3.600 s | 0.550 | 0.103 | 0 | 0.128 / 0.060 s | Brief attack followed by a clear decaying envelope; one-shot candidate, not a loop. |
| `ufo crashing - Copy (2).mp3` | 292,571 | 44.1 kHz | 9.143 s | 0.534 | 0.081 | 0 | 0.027 / 0.534 s | Broad decaying tail with low-level energy through most of the final seconds; one destruction event only, no looping or minor-collision use. |

## Existing event mapping and proposed changes

| Runtime asset | Existing game event | Playback | Spatialization / initial gain | Status |
|---|---|---|---|---|
| `vehicle-acceleration.mp3` | Transition into active vehicle throttle from `movePlayer()` | Start once on a throttle edge; stop with a brief fade when throttle releases. No loop, no per-frame restarts or pitch modulation. The procedural motor remains the continuous speed layer. | Center/non-positional; low gain, start near 0.12 | Provisional pending listening; long clip is unsuitable as a loop. |
| `character-hurt.mp3` | Confirmed local health decrement in `damage()` | One-shot with a short repeat guard | Center/non-positional; start near 0.10 because peak is at full scale | Suitable by duration/envelope; audible character unverified. |
| `weapon-gunfire-one-shot.wav` (derived from supplied file; original retained) | Existing accepted `fire()` call | One short early transient plus tail per actual accepted shot; existing 0.14 s fire cooldown remains authoritative | Spatialized close to the current camera/muzzle; start near 0.16; bounded overlapping voices | Derived trim is waveform-based and requires listening confirmation. Never replay the full 7.488 s recording per bullet. |
| `sci-fi-chase.mp3` | First transition of an existing patrol drone to `responding` | One-shot on state edge; no loop/restart while the drone stays in pursuit | Positional at the responding drone; start near 0.10 | Provisional; no continuous-pursuit loop is available/assumed. |
| `sci-fi-crash.mp3` | Existing security-drone destruction `kill` transition | One-shot; preserve the decay tail; never triggered by ordinary car impacts | Positional at destroyed drone; start near 0.09 | Provisional; long tail and overlapping destruction need voice cap/cooldown. |

The volume values are initial per-source gain multipliers before the existing master/compressor, not loudness normalization targets. They require real listening adjustment. Stereo source channels are retained; positional playback uses the existing context's `PannerNode` path and may downmix according to browser behavior.

## Asset handling and repeatability

- Preserve all supplied originals in the Downloads folder and copy them unchanged into `public/audio/glitchbound/` for production-safe static URLs.
- Keep the derived gun one-shot separate, record its source and exact trim range in a machine-readable manifest, and do not overwrite the original recording.
- A manifest will list URLs, event mappings, playback type, gain, spatialization, provenance and validation status.
- A new Unicode source check is not an audio-content detector; no text scan can validate sound. The browser build should verify all referenced files are emitted and accessible.

## Risks and validation

- Main risk is perceptual mismatch because this environment cannot audition audio. The final report must keep the listening item open and must not claim audio quality/playback was perceptually verified.
- The car, gunfire and crash recordings are long relative to their event cadence. Enforce edge triggering, voice limits, no uncontrolled loops, and only use the short derived weapon transient per shot.
- Fetch/decode failure must leave the current procedural engine and the rest of the game running. Audio remains user-gesture initiated and master-mute controlled.
- Changes should be limited to the audio engine, throttle/fire/damage/drone event plumbing, static audio assets/manifest, package/README details, and audio documentation/tests. No physics, vehicle behavior, NPC logic, combat timing/damage or world geometry should change.
- Baseline check runner: `node scripts/test.mjs` (22 existing suites in the prior project audit); production build: `npm run build` (runs `scripts/export-blueprint.mjs` prebuild and can rewrite a locally modified generated blueprint file, so inspect its diff afterward). Node runtime is 24.x. The current test directory has no dedicated audio-engine test.

## Integration sequence

1. Copy and hash the supplied originals; generate a bounded one-shot from an isolated gun transient and document provenance.
2. Extend the existing `src/audio.js` with lazy sample loading, caching, safe fallbacks, bounded one-shots, a short held throttle accent, and positional one-shot playback. Preserve the single context and master mute.
3. Hook the throttle edge and existing damage/fire/drone dispatch/destruction transitions without changing gameplay logic or cadence.
4. Add an audio manifest, focused audio-engine checks where the existing test architecture can support a Web Audio stub, and update the README's former “no recorded ... effects” claim.
5. Run English/source validation, the test suite and production build; inspect emitted static asset paths. Real listening and in-game mix tuning remain separate manual checks.
