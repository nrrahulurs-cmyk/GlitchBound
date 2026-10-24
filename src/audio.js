import { createWorldAudio, WORLD_AUDIO_LIMITS } from './world-audio.js';

const SAMPLE_SPECS = Object.freeze({
  acceleration: { path: 'audio/glitchbound/vehicle-acceleration.mp3', gain: 0.12, maxVoices: 1, spatial: false, cooldown: 0 },
  damage: { path: 'audio/glitchbound/character-hurt.mp3', gain: 0.10, maxVoices: 1, spatial: false, cooldown: 0.32 },
  shot: { path: 'audio/glitchbound/weapon-gunfire-one-shot.wav', gain: 0.16, maxVoices: 3, spatial: true, cooldown: 0 },
  pursuit: { path: 'audio/glitchbound/sci-fi-chase.mp3', gain: 0.10, maxVoices: 1, spatial: true, cooldown: 2.5 },
  crash: { path: 'audio/glitchbound/sci-fi-crash.mp3', gain: 0.09, maxVoices: 1, spatial: true, cooldown: 2.5 },
});

const sampleBase = () => {
  const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
  return `${base.endsWith('/') ? base : `${base}/`}`;
};

/** One user-gesture-unlocked Web Audio graph for procedural ambience and recorded game effects. */
export function createAudio() {
  let ctx, master, limiter, output, world;
  let enabled = false, disposed = false;
  let latest = { playing: false, inVehicle: false, position: { x: 0, y: 1.75, z: 0 }, yaw: 0, pitch: 0 };
  let motorSpeed = 0, motorDriving = false, accelerationHeld = false, accelerationRecord = null;
  let serial = 0, peakShots = 0, dropped = 0, activeCueKind = null;
  const voices = new Set(), sampleVoices = new Set(), history = [], counts = {};
  const buffers = new Map(), bufferLoads = new Map(), failedBuffers = new Set(), bufferErrors = {}, sampleTimings = {};
  const cooldowns = new Map();

  const remember = (kind, details = {}) => {
    counts[kind] = (counts[kind] || 0) + 1;
    history.push({ id: ++serial, kind, time: ctx?.currentTime || 0, ...details });
    if (history.length > WORLD_AUDIO_LIMITS.history) history.shift();
  };

  function noiseBuffer() {
    if (buffers.has('transient')) return buffers.get('transient');
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.65), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 78131;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = seed / 2147483648 - 1;
    }
    buffers.set('transient', buffer);
    return buffer;
  }

  function init() {
    if (ctx || disposed) return;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.knee.value = 3; limiter.ratio.value = 20;
    limiter.attack.value = 0.003; limiter.release.value = 0.16;
    output = ctx.createGain(); output.gain.value = 0.75;
    master.connect(limiter); limiter.connect(output); output.connect(ctx.destination);
    world = createWorldAudio({ context: ctx, bus: master, onLocomotion: locomotion });
  }

  function voice({ type = 'sine', frequency = 220, end = 80, duration = 0.13, volume = 0.1, noise = false, filter = 1600, filterEnd, delay = 0, position = null }) {
    if (!enabled || !ctx || disposed) return false;
    if (voices.size + sampleVoices.size >= WORLD_AUDIO_LIMITS.oneShots) { dropped++; return false; }
    const source = noise ? ctx.createBufferSource() : ctx.createOscillator();
    const gain = ctx.createGain();
    const nodes = [source, gain];
    const now = ctx.currentTime + delay;
    if (noise) {
      source.buffer = noiseBuffer();
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = filter;
      if (filterEnd) {
        low.frequency.setValueAtTime(filter, now);
        low.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
      }
      source.connect(low); low.connect(gain); nodes.push(low);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, now);
      source.frequency.exponentialRampToValueAtTime(Math.max(15, end), now + duration);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.setValueAtTime(0.00001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.3, volume), now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);
    if (position) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 2; panner.maxDistance = 65; panner.rolloffFactor = 1.3;
      const point = Array.isArray(position)
        ? { x: position[0] || 0, y: position[1] || 0, z: position[2] || 0 }
        : { x: position.x || 0, y: position.y || 0, z: position.z || 0 };
      if (panner.positionX) {
        panner.positionX.setValueAtTime(point.x, now); panner.positionY.setValueAtTime(point.y, now); panner.positionZ.setValueAtTime(point.z, now);
      } else panner.setPosition(point.x, point.y, point.z);
      gain.connect(panner); panner.connect(master); nodes.push(panner);
    } else gain.connect(master);
    const record = { kind: activeCueKind, source, nodes, end: now + duration + 0.025 };
    voices.add(record); peakShots = Math.max(peakShots, voices.size + sampleVoices.size);
    source.onended = () => { for (const node of nodes) node.disconnect(); voices.delete(record); };
    source.start(now); source.stop(record.end);
    return true;
  }

  function ensureSample(name) {
    if (!ctx || disposed || !SAMPLE_SPECS[name]) return Promise.resolve(null);
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (failedBuffers.has(name)) return Promise.resolve(null);
    if (bufferLoads.has(name)) return bufferLoads.get(name);
    const promise = (async () => {
      const loadStarted = performance.now();
      let fetchMs = 0, decodeMs = 0;
      try {
        const base = sampleBase();
        const url = new URL(`${base}${SAMPLE_SPECS[name].path}`, globalThis.location?.href || 'http://localhost/');
        const fetchStarted = performance.now();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        fetchMs = performance.now() - fetchStarted;
        if (disposed || !ctx) return null;
        const decodeStarted = performance.now();
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        decodeMs = performance.now() - decodeStarted;
        if (disposed) return null;
        buffers.set(name, decoded);
        sampleTimings[name] = { fetchMs, decodeMs, totalMs: performance.now() - loadStarted };
        return decoded;
      } catch (error) {
        sampleTimings[name] = { fetchMs, decodeMs, totalMs: performance.now() - loadStarted, failed: true };
        failedBuffers.add(name);
        bufferErrors[name] = String(error?.message || error);
        console.warn(`[GLITCHBOUND audio] Could not load ${name}; procedural fallback remains active.`, error);
        return null;
      } finally {
        bufferLoads.delete(name);
      }
    })();
    bufferLoads.set(name, promise);
    return promise;
  }

  function preloadSamples() {
    void Promise.all(Object.keys(SAMPLE_SPECS).map(ensureSample));
  }

  function playSample(name, { position = null, offset = 0, duration, gainScale = 1 } = {}) {
    if (!enabled || !ctx || disposed || !latest.playing) return { status: 'blocked' };
    const buffer = buffers.get(name);
    if (!buffer) return { status: 'unavailable' };
    const spec = SAMPLE_SPECS[name];
    const now = ctx.currentTime;
    const last = cooldowns.get(name) ?? -Infinity;
    if (now - last < spec.cooldown) return { status: 'blocked' };
    const activeForKind = [...sampleVoices].filter((record) => record.kind === name);
    if (activeForKind.length >= spec.maxVoices || voices.size + sampleVoices.size >= WORLD_AUDIO_LIMITS.oneShots) {
      dropped++;
      return { status: 'blocked' };
    }

    const source = ctx.createBufferSource(); source.buffer = buffer;
    const gain = ctx.createGain();
    const nodes = [source, gain];
    source.connect(gain);
    if (spec.spatial && position) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 2; panner.maxDistance = name === 'shot' ? 55 : 80; panner.rolloffFactor = 1.35;
      const point = Array.isArray(position)
        ? { x: position[0] || 0, y: position[1] || 0, z: position[2] || 0 }
        : { x: position.x || 0, y: position.y || 0, z: position.z || 0 };
      if (panner.positionX) {
        panner.positionX.setValueAtTime(point.x, now); panner.positionY.setValueAtTime(point.y, now); panner.positionZ.setValueAtTime(point.z, now);
      } else panner.setPosition(point.x, point.y, point.z);
      gain.connect(panner); panner.connect(master); nodes.push(panner);
    } else gain.connect(master);

    gain.gain.setValueAtTime(0.00001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.00001, Math.min(0.3, spec.gain * gainScale)), now + 0.006);
    const startOffset = Math.max(0, Math.min(offset, Math.max(0, buffer.duration - 0.001)));
    const playDuration = Math.max(0.001, Math.min(duration ?? (buffer.duration - startOffset), buffer.duration - startOffset));
    const record = { kind: name, source, gain, nodes, end: now + playDuration + 0.05, stopping: false };
    sampleVoices.add(record); cooldowns.set(name, now); peakShots = Math.max(peakShots, voices.size + sampleVoices.size);
    source.onended = () => {
      for (const node of nodes) node.disconnect();
      sampleVoices.delete(record);
      if (accelerationRecord === record) accelerationRecord = null;
    };
    source.start(now, startOffset, playDuration);
    return { status: 'played', record };
  }

  function stopSample(record, fade = 0.12) {
    if (!record || record.stopping || !sampleVoices.has(record)) return;
    record.stopping = true;
    const now = ctx.currentTime;
    record.gain.gain.cancelScheduledValues(now);
    record.gain.gain.setValueAtTime(Math.max(0.00001, record.gain.gain.value), now);
    record.gain.gain.linearRampToValueAtTime(0.00001, now + fade);
    try { record.source.stop(now + fade + 0.02); } catch { /* already scheduled to stop */ }
  }

  function stopSampleVoices({ except = [] } = {}) {
    const kept = new Set(except);
    for (const record of [...sampleVoices]) if (!kept.has(record.kind)) stopSample(record, 0.025);
  }

  function stopVoices({ except = [] } = {}) {
    const kept = new Set(except);
    for (const record of [...voices]) {
      if (kept.has(record.kind)) continue;
      try { record.source.stop(); } catch { /* already ended */ }
      for (const node of record.nodes) node.disconnect();
      voices.delete(record);
    }
  }

  function setAcceleration(active) {
    active = Boolean(active);
    if (active === accelerationHeld || disposed) return;
    accelerationHeld = active;
    if (!active) {
      stopSample(accelerationRecord, 0.16);
      accelerationRecord = null;
      return;
    }
    void ensureSample('acceleration').then(() => {
      if (!accelerationHeld || !enabled || !latest.playing || !latest.inVehicle || accelerationRecord) return;
      const result = playSample('acceleration', { offset: 0.66 });
      if (result.status === 'played') accelerationRecord = result.record;
    });
  }

  function locomotion(event) {
    if (event.type === 'step') {
      const hard = event.surface === 'paver', variation = 1 + Math.sin(serial * 2.399) * 0.065;
      voice({ noise: true, filter: hard ? 3300 : 1250, duration: hard ? 0.065 : 0.115, volume: (hard ? 0.125 : 0.105) * variation });
      voice({ frequency: hard ? 190 : 108, end: hard ? 82 : 48, duration: hard ? 0.075 : 0.11, volume: hard ? 0.095 : 0.08 });
      remember('footstep', { surface: event.surface, distance: event.distance, side: event.side, position: event.position });
    } else {
      voice({ noise: true, filter: 900, duration: 0.15, volume: 0.08 + event.strength * 0.04 });
      voice({ frequency: 78, end: 30, duration: 0.19, volume: 0.09 + event.strength * 0.035 });
      remember('landing', { surface: event.surface, airTime: event.airTime, position: event.position });
    }
  }

  function effect(kind, run) {
    if (!enabled || !ctx || !latest.playing || disposed) return;
    const previous = activeCueKind; activeCueKind = kind;
    try { run(); } finally { activeCueKind = previous; }
    remember(kind);
  }

  function eventReady(key, interval = 0) {
    if (!enabled || !ctx || disposed) return false;
    const now = ctx.currentTime, last = cooldowns.get(key) ?? -Infinity;
    if (now - last < interval) return false;
    cooldowns.set(key, now);
    return true;
  }

  function ui(kind = 'confirm') {
    const interval = kind === 'hover' ? 0.085 : kind === 'error' ? 0.34 : 0.045;
    if (!eventReady(`ui:${kind}`, interval)) return;
    const previous = activeCueKind; activeCueKind = `ui-${kind}`;
    if (kind === 'hover') {
      voice({ frequency: 1180, end: 920, duration: 0.035, volume: 0.018 });
    } else if (kind === 'back') {
      voice({ type: 'triangle', frequency: 610, end: 330, duration: 0.085, volume: 0.045 });
      voice({ frequency: 300, end: 220, duration: 0.07, volume: 0.025, delay: 0.025 });
    } else if (kind === 'error') {
      voice({ type: 'triangle', frequency: 270, end: 185, duration: 0.12, volume: 0.052 });
      voice({ noise: true, filter: 1300, filterEnd: 500, duration: 0.075, volume: 0.025 });
    } else if (kind === 'toggle') {
      voice({ type: 'sine', frequency: 470, end: 760, duration: 0.12, volume: 0.05 });
      voice({ type: 'sine', frequency: 760, end: 1030, duration: 0.1, volume: 0.027, delay: 0.045 });
    } else {
      voice({ type: 'triangle', frequency: 420, end: 680, duration: 0.09, volume: 0.046 });
      voice({ frequency: 840, end: 1050, duration: 0.065, volume: 0.021, delay: 0.035 });
    }
    activeCueKind = previous;
    remember(`ui-${kind}`);
  }

  function serviceCue(phase, serviceType = 'general') {
    const kind = `service-${phase}`;
    if (!eventReady(kind, phase === 'cancel' ? 0.16 : 0.08)) return;
    const previous = activeCueKind; activeCueKind = kind;
    const pitch = serviceType === 'garage' ? 0.82 : serviceType === 'clinic' ? 1.12 : serviceType === 'recharge' ? 1.25 : 1;
    if (phase === 'start') {
      voice({ type: 'triangle', frequency: 340 * pitch, end: 480 * pitch, duration: 0.11, volume: 0.047 });
      voice({ frequency: 650 * pitch, end: 710 * pitch, duration: 0.09, volume: 0.027, delay: 0.085 });
      voice({ noise: true, filter: 1800, filterEnd: 900, duration: 0.095, volume: 0.022, delay: 0.035 });
    } else if (phase === 'complete') {
      [440, 554, 659].forEach((note, index) => voice({ type: 'sine', frequency: note * pitch, end: note * pitch * 1.015, duration: 0.24, volume: index === 2 ? 0.052 : 0.038, delay: index * 0.075 }));
      voice({ frequency: 880 * pitch, end: 1120 * pitch, duration: 0.19, volume: 0.022, delay: 0.16 });
    } else {
      voice({ type: 'triangle', frequency: 420 * pitch, end: 220 * pitch, duration: 0.19, volume: 0.045 });
      voice({ noise: true, filter: 1700, filterEnd: 450, duration: 0.14, volume: 0.028, delay: 0.025 });
    }
    activeCueKind = previous;
    remember(kind, { serviceType });
  }

  return {
    async toggle() {
      init();
      if (!ctx || disposed) return false;
      enabled = !enabled;
      if (enabled && ctx.state === 'suspended') await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(enabled ? 0.55 : 0, ctx.currentTime, 0.025);
      if (enabled) preloadSamples();
      else {
        accelerationHeld = false; accelerationRecord = null;
        stopVoices(); stopSampleVoices();
      }
      world.update(0, { ...latest, distanceMoved: 0, enabled });
      return enabled;
    },
    get enabled() { return enabled; },
    ui,
    update(dt, state = {}) {
      const wasPlaying = latest.playing;
      latest = { ...latest, ...state };
      if (state.speed === undefined) latest.speed = motorSpeed;
      if (state.inVehicle === undefined) latest.inVehicle = motorDriving;
      if (wasPlaying && !latest.playing) {
        stopVoices({ except: ['game-over', 'ui-back', 'service-cancel'] }); setAcceleration(false); stopSampleVoices({ except: ['crash'] });
      }
      world?.update(dt, { ...latest, enabled });
    },
    accelerate(active) { setAcceleration(active); },
    shot(position) {
      effect('shot', () => {
        const result = playSample('shot', { position });
        if (result.status === 'unavailable') {
          voice({ type: 'sawtooth', frequency: 170, end: 35, duration: 0.13, volume: 0.20 });
          voice({ noise: true, filter: 3400, duration: 0.075, volume: 0.13 });
          voice({ type: 'square', frequency: 1000, end: 210, duration: 0.055, volume: 0.022 });
        }
      });
    },
    draw(holster = false) {
      effect(holster ? 'weapon-holster' : 'weapon-draw', () => {
        voice({ noise: true, filter: holster ? 2400 : 1100, filterEnd: holster ? 520 : 3600, duration: 0.15, volume: 0.052 });
        voice({ type: 'triangle', frequency: holster ? 520 : 180, end: holster ? 220 : 460, duration: 0.12, volume: 0.052, delay: 0.025 });
        voice({ type: 'square', frequency: holster ? 880 : 720, end: 390, duration: 0.035, volume: 0.018, delay: 0.11 });
      });
    },
    hit() {
      effect('hit', () => {
        voice({ type: 'triangle', frequency: 880, end: 690, duration: 0.055, volume: 0.064 });
        voice({ type: 'sine', frequency: 1320, end: 1040, duration: 0.04, volume: 0.022, delay: 0.018 });
      });
    },
    jump() {
      effect('jump', () => {
        voice({ noise: true, filter: 700, filterEnd: 2500, duration: 0.16, volume: 0.043 });
        voice({ type: 'triangle', frequency: 100, end: 240, duration: 0.15, volume: 0.055 });
      });
    },
    dash() {
      effect('dash', () => {
        voice({ noise: true, filter: 650, filterEnd: 4600, duration: 0.25, volume: 0.09 });
        voice({ type: 'sawtooth', frequency: 90, end: 680, duration: 0.22, volume: 0.065 });
        voice({ type: 'sine', frequency: 740, end: 260, duration: 0.24, volume: 0.035, delay: 0.035 });
      });
    },
    emp() {
      effect('emp', () => {
        voice({ type: 'sine', frequency: 78, end: 24, duration: 0.62, volume: 0.19 });
        voice({ type: 'sawtooth', frequency: 190, end: 44, duration: 0.42, volume: 0.07 });
        voice({ noise: true, filter: 5200, filterEnd: 280, duration: 0.66, volume: 0.12 });
        voice({ type: 'sine', frequency: 1180, end: 250, duration: 0.48, volume: 0.038, delay: 0.04 });
      });
    },
    service: serviceCue,
    vehicle(kind = 'enter') {
      effect(`vehicle-${kind}`, () => {
        if (kind === 'blocked') {
          voice({ type: 'triangle', frequency: 240, end: 150, duration: 0.12, volume: 0.048 });
          voice({ noise: true, filter: 900, filterEnd: 380, duration: 0.085, volume: 0.025 });
          return;
        }
        const entering = kind === 'enter';
        voice({ noise: true, filter: entering ? 800 : 1450, filterEnd: entering ? 2600 : 620, duration: 0.2, volume: 0.053 });
        voice({ type: 'triangle', frequency: entering ? 260 : 390, end: entering ? 640 : 210, duration: 0.19, volume: 0.055, delay: 0.025 });
        voice({ type: 'square', frequency: 980, end: 420, duration: 0.045, volume: 0.025, delay: 0.14 });
      });
    },
    vehicleImpact(position, speed = 10) {
      effect('vehicle-impact', () => {
        if (!eventReady('vehicle-impact:rate', 0.13)) return;
        const intensity = Math.max(0.32, Math.min(1.25, Math.abs(speed) / 18));
        voice({ noise: true, filter: 1500, filterEnd: 260, duration: 0.19, volume: 0.11 * intensity, position });
        voice({ type: 'triangle', frequency: 145, end: 38, duration: 0.27, volume: 0.13 * intensity, position });
        voice({ type: 'square', frequency: 760, end: 180, duration: 0.065, volume: 0.025 * intensity, delay: 0.015, position });
      });
    },
    explosion(position) {
      effect('explosion', () => {
        voice({ noise: true, filter: 1100, filterEnd: 120, duration: 0.48, volume: 0.13, position });
        voice({ type: 'sine', frequency: 96, end: 22, duration: 0.56, volume: 0.18, position });
        voice({ type: 'triangle', frequency: 340, end: 48, duration: 0.31, volume: 0.06, delay: 0.025, position });
      });
    },
    incomingShot(position) {
      effect('incoming-shot', () => {
        if (!eventReady('incoming-shot:rate', 0.11)) return;
        voice({ noise: true, filter: 4300, filterEnd: 800, duration: 0.055, volume: 0.036, position });
        voice({ type: 'triangle', frequency: 300, end: 105, duration: 0.075, volume: 0.022, delay: 0.006, position });
      });
    },
    alert(kind = 'crime', position = null) {
      effect(`alert-${kind}`, () => {
        if (!eventReady(`alert:rate:${kind === 'cleared' ? 'cleared' : 'active'}`, kind === 'cleared' ? 1.2 : 0.85)) return;
        if (kind === 'cleared') {
          voice({ type: 'sine', frequency: 520, end: 720, duration: 0.2, volume: 0.048, position });
          voice({ type: 'sine', frequency: 780, end: 1040, duration: 0.24, volume: 0.035, delay: 0.12, position });
        } else {
          voice({ type: 'triangle', frequency: 760, end: 520, duration: 0.13, volume: 0.043, position });
          voice({ type: 'triangle', frequency: 690, end: 440, duration: 0.13, volume: 0.037, delay: 0.16, position });
        }
      });
    },
    gameOver() {
      effect('game-over', () => {
        voice({ type: 'sine', frequency: 440, end: 220, duration: 0.7, volume: 0.075 });
        voice({ type: 'triangle', frequency: 330, end: 165, duration: 0.9, volume: 0.062, delay: 0.12 });
        voice({ noise: true, filter: 900, filterEnd: 180, duration: 0.55, volume: 0.035, delay: 0.08 });
      });
    },
    reloadStart() {
      effect('reload-start', () => {
        voice({ noise: true, filter: 1300, filterEnd: 340, duration: 0.12, volume: 0.055 });
        voice({ type: 'square', frequency: 780, end: 460, duration: 0.045, volume: 0.03, delay: 0.055 });
        voice({ type: 'triangle', frequency: 110, end: 76, duration: 0.12, volume: 0.036, delay: 0.09 });
      });
    },
    reloadComplete() {
      effect('reload-complete', () => {
        voice({ type: 'square', frequency: 1120, end: 700, duration: 0.035, volume: 0.035 });
        voice({ type: 'triangle', frequency: 210, end: 420, duration: 0.085, volume: 0.048, delay: 0.018 });
      });
    },
    brake() {
      effect('vehicle-brake', () => {
        voice({ noise: true, filter: 1800, filterEnd: 680, duration: 0.24, volume: 0.052 });
        voice({ type: 'sine', frequency: 310, end: 205, duration: 0.19, volume: 0.034, delay: 0.02 });
      });
    },
    damage() {
      effect('damage', () => {
        const result = playSample('damage');
        if (result.status === 'unavailable') voice({ type: 'triangle', frequency: 70, end: 30, duration: 0.3, volume: 0.19 });
      });
    },
    pursuit(position) {
      effect('pursuit', () => {
        const result = playSample('pursuit', { position });
        if (result.status === 'unavailable') voice({ type: 'triangle', frequency: 420, end: 220, duration: 0.22, volume: 0.06 });
      });
    },
    crash(position) {
      effect('crash', () => {
        const result = playSample('crash', { position });
        if (result.status === 'unavailable') {
          voice({ noise: true, filter: 950, duration: 0.24, volume: 0.14 });
          voice({ type: 'triangle', frequency: 160, end: 32, duration: 0.42, volume: 0.12 });
        }
      });
    },
    motor(speed, driving) {
      motorSpeed = Number.isFinite(speed) ? speed : 0;
      motorDriving = Boolean(driving);
      world?.setMotor(motorSpeed, motorDriving);
      if (!motorDriving) setAcceleration(false);
    },
    getState() {
      const worldState = world?.getState() || null;
      return {
        origin: 'procedural Web Audio plus user-supplied recorded game effects',
        initialized: Boolean(ctx), disposed, enabled, playing: Boolean(latest.playing),
        contextState: ctx?.state || 'uninitialized', time: ctx?.currentTime || 0,
        oneShots: { active: voices.size + sampleVoices.size, procedural: voices.size, samples: sampleVoices.size, peak: peakShots, limit: WORLD_AUDIO_LIMITS.oneShots, dropped },
        samples: { loaded: [...buffers.keys()].filter((name) => name !== 'transient'), failed: [...failedBuffers], errors: { ...bufferErrors }, timings: { ...sampleTimings }, active: [...sampleVoices].map(({ kind, end }) => ({ kind, end })) },
        counts: { ...counts }, events: history.map((event) => ({ ...event })),
        output: { masterTarget: enabled ? 0.55 : 0, limiterThreshold: -12, limiterRatio: 20, limiterReduction: limiter?.reduction || 0 },
        world: worldState,
        nodeCount: disposed ? 0 : (ctx ? 3 : 0) + (worldState?.nodeCount || 0) + [...voices].reduce((n, record) => n + record.nodes.length, 0) + [...sampleVoices].reduce((n, record) => n + record.nodes.length, 0),
      };
    },
    async dispose() {
      if (disposed) return;
      disposed = true; enabled = false; accelerationHeld = false;
      stopVoices(); stopSampleVoices(); world?.dispose();
      master?.disconnect(); limiter?.disconnect(); output?.disconnect();
      if (ctx && ctx.state !== 'closed') await ctx.close();
      buffers.clear(); bufferLoads.clear(); failedBuffers.clear();
    },
  };
}
