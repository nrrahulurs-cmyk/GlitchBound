import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createAudio } from '../src/audio.js';
import { createSimulation } from '../src/simulation.js';

class Param {
  value = 0;
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
}

class Node {
  constructor() { this.connections = []; }
  connect(destination) { this.connections.push(destination); return destination; }
  disconnect() { this.disconnected = true; }
}

class FakeContext {
  static instances = [];
  constructor() {
    this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000;
    this.destination = new Node(); this.nodes = []; this.sources = [];
    this.listener = { setPosition() {}, setOrientation() {} };
    FakeContext.instances.push(this);
  }
  node(value) { this.nodes.push(value); return value; }
  createGain() { const node = this.node(new Node()); node.gain = new Param(); return node; }
  createDynamicsCompressor() {
    const node = this.node(new Node());
    for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Param();
    node.reduction = 0; return node;
  }
  createPanner() { const node = this.node(new Node()); node.setPosition = (...p) => { node.position = p; }; return node; }
  createOscillator() {
    const node = this.node(new Node()); node.frequency = new Param(); node.start = () => {}; node.stop = () => {};
    node.type = 'sine'; return node;
  }
  createBiquadFilter() { const node = this.node(new Node()); node.frequency = new Param(); return node; }
  createBufferSource() {
    const node = this.node(new Node()); node.start = (...args) => { node.startArgs = args; };
    node.stop = (when) => { node.stopAt = when ?? this.currentTime; };
    this.sources.push(node); return node;
  }
  createBuffer(_channels, length, rate) {
    return { duration: length / rate, getChannelData: () => new Float32Array(length) };
  }
  async decodeAudioData(bytes) {
    const path = new TextDecoder().decode(bytes);
    const durations = { 'vehicle-acceleration.mp3': 15.792, 'character-hurt.mp3': 0.888, 'weapon-gunfire-one-shot.wav': 0.475, 'sci-fi-chase.mp3': 3.6, 'sci-fi-crash.mp3': 9.143 };
    const name = Object.keys(durations).find((key) => path.endsWith(key));
    return { duration: durations[name] ?? 1, label: path };
  }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

async function settle() { await new Promise((resolve) => setImmediate(resolve)); }
function finishProceduralVoices(context) {
  for (const source of context.nodes) {
    // Keep decoded user samples alive for their pause-tail and acceleration checks.
    if (typeof source.start === 'function' && !source.buffer?.label) source.onended?.();
  }
}

const originalContext = globalThis.AudioContext;
const originalFetch = globalThis.fetch;
let fetchCount = 0;
globalThis.AudioContext = FakeContext;
globalThis.fetch = async (request) => {
  fetchCount++;
  return { ok: true, arrayBuffer: async () => new TextEncoder().encode(request.pathname).buffer };
};

try {
  const manifest = JSON.parse(readFileSync(new URL('../public/audio/glitchbound/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.assets.length, 5);
  for (const asset of manifest.assets) {
    const runtimePath = new URL(`../public${asset.path}`, import.meta.url);
    const runtimeHash = createHash('sha256').update(readFileSync(runtimePath)).digest('hex').toUpperCase();
    assert.equal(runtimeHash, asset.sha256, `${asset.id} runtime asset hash matches manifest`);
    if (asset.sourcePath) {
      const sourceHash = createHash('sha256').update(readFileSync(new URL(`../public${asset.sourcePath}`, import.meta.url))).digest('hex').toUpperCase();
      assert.equal(sourceHash, asset.sourceSha256, `${asset.id} preserved source hash matches manifest`);
    }
  }

  const simulationEvents = [];
  const simulation = createSimulation({
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    patrolRoutes: [{ height: 4.1, points: [{ x: 35, z: 0 }] }],
    onEvent: (event) => simulationEvents.push(event),
  });
  simulation.reportCrime('audio mapping test', 1, new THREE.Vector3(35, 1, 2));
  assert.equal(simulationEvents.filter((event) => event.type === 'pursuit').length, 1);
  simulation.reportCrime('repeat alert', 1, new THREE.Vector3(35, 1, 2));
  assert.equal(simulationEvents.filter((event) => event.type === 'pursuit').length, 1, 'persistent response does not re-emit pursuit transition');
  for (let shot = 0; shot < 3; shot++) simulation.shoot(new THREE.Vector3(35, 4.1, 8), new THREE.Vector3(0, 0, -1));
  const destruction = simulationEvents.find((event) => event.type === 'kill');
  assert.deepEqual(destruction.position, [35, 4.1, 0], 'drone destruction reports its world position for the crash sound');
  simulation.dispose();

  const audio = createAudio();
  assert.equal(audio.enabled, false, 'the audio context stays locked until the user toggles sound');
  assert.equal(fetchCount, 0, 'recordings are not fetched before the user gesture');
  assert.equal(await audio.toggle(), true);
  const context = FakeContext.instances.at(-1);
  audio.ui('confirm');
  assert.equal(audio.getState().counts['ui-confirm'], 1, 'menu interface cues work while gameplay is not running');
  finishProceduralVoices(context);
  audio.update(0, { playing: true, inVehicle: false, position: { x: 0, y: 2, z: 0 }, grounded: false });
  await settle();
  assert.equal(audio.getState().samples.loaded.length, 5, 'all gameplay samples decode after the user gesture');

  audio.shot({ x: 1, y: 2, z: 3 });
  audio.damage(); audio.damage();
  audio.pursuit({ x: 4, y: 3, z: 5 });
  audio.crash({ x: 6, y: 4, z: 7 });
  const activeKinds = audio.getState().samples.active.map(({ kind }) => kind).sort();
  assert.deepEqual(activeKinds, ['crash', 'damage', 'pursuit', 'shot']);
  assert.equal(audio.getState().counts.damage, 2, 'health decrements are recorded even when the hurt sample cooldown suppresses a duplicate');
  assert(context.nodes.some((node) => node.position?.join(',') === '1,2,3'), 'weapon playback is positioned at the muzzle');
  assert(context.sources.find((source) => source.buffer?.label?.endsWith('weapon-gunfire-one-shot.wav')).startArgs[2] <= 0.475);

  audio.draw(); audio.jump(); audio.dash(); audio.emp();
  finishProceduralVoices(context);
  audio.service('start', 'clinic'); audio.service('complete', 'clinic'); audio.service('cancel'); audio.vehicle('enter'); audio.vehicle('exit');
  finishProceduralVoices(context);
  audio.vehicle('blocked'); audio.vehicleImpact({ x: 8, y: 1, z: -3 }, 22); audio.explosion({ x: 6, y: 2, z: 4 });
  audio.incomingShot({ x: -2, y: 1, z: 7 }); audio.alert('crime');
  finishProceduralVoices(context);
  audio.alert('cleared');
  audio.reloadStart(); audio.reloadComplete(); audio.brake(); audio.gameOver();
  finishProceduralVoices(context);
  for (const cue of ['weapon-draw', 'jump', 'dash', 'emp', 'service-start', 'service-complete', 'service-cancel', 'vehicle-enter', 'vehicle-exit', 'vehicle-blocked', 'vehicle-impact', 'explosion', 'incoming-shot', 'alert-crime', 'alert-cleared', 'reload-start', 'reload-complete', 'vehicle-brake', 'game-over']) {
    assert(audio.getState().counts[cue] > 0, `${cue} cue is routed through the shared audio engine`);
  }
  assert(context.nodes.some((node) => node.position?.join(',') === '8,1,-3'), 'vehicle impacts use a positioned spatial sound source');
  assert(audio.getState().oneShots.active <= audio.getState().oneShots.limit, 'expanded cues remain within the bounded one-shot voice budget');

  audio.update(0, { playing: true, inVehicle: true, position: { x: 0, y: 1, z: 0 } });
  audio.accelerate(true);
  await settle();
  const acceleration = context.sources.find((source) => source.buffer?.label?.endsWith('vehicle-acceleration.mp3'));
  assert(acceleration, 'vehicle acceleration starts only when the throttle state changes');
  assert.equal(acceleration.startArgs[1], 0.66, 'measured leading silence is skipped');
  audio.accelerate(false);
  assert(Number.isFinite(acceleration.stopAt), 'releasing throttle fades and stops the sample');

  audio.gameOver();
  audio.update(0, { playing: false });
  assert.equal(audio.getState().oneShots.procedural, 3, 'the end-state cue finishes after gameplay audio is stopped');
  const crash = context.sources.find((source) => source.buffer?.label?.endsWith('sci-fi-crash.mp3'));
  assert.equal(crash.stopAt, undefined, 'the long crash tail is retained when gameplay pauses');
  await audio.toggle();
  assert.equal(audio.getState().oneShots.procedural, 0, 'master mute still stops a retained end-state cue immediately');
  assert(Number.isFinite(crash.stopAt), 'master mute stops lingering samples');
  await audio.dispose();
  assert.equal(audio.getState().nodeCount, 0);

  const warn = console.warn;
  console.warn = () => {};
  globalThis.fetch = async (request) => {
    fetchCount++;
    if (request.pathname.endsWith('weapon-gunfire-one-shot.wav')) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(request.pathname).buffer };
  };
  const fallback = createAudio();
  await fallback.toggle();
  fallback.update(0, { playing: true, inVehicle: false });
  await settle();
  fallback.shot({ x: 0, y: 0, z: -1 });
  assert(fallback.getState().samples.failed.includes('shot'));
  assert.equal(fallback.getState().oneShots.procedural, 3, 'a missing gun sample uses the established procedural fallback');
  await fallback.dispose();
  console.warn = warn;
  console.log('PASS audio: samples, spatial cues, menu and gameplay events, cooldowns, bounded voices, pause tail and mute cleanup');
} finally {
  globalThis.AudioContext = originalContext;
  globalThis.fetch = originalFetch;
}
