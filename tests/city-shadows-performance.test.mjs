import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCityShadows } from '../src/city-shadows.js';

const scene = new THREE.Scene();
const moon = new THREE.DirectionalLight(0xffffff, 1);
moon.position.set(0, 50, 0);
scene.add(moon);
const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap, autoUpdate: true, needsUpdate: false } };
const city = { root: new THREE.Group(), colliders: [], streetColliders: [], groundHeightAt: () => 0.057 };
scene.add(city.root);
const shadows = createCityShadows({ scene, renderer, moon, city });

shadows.update({ x: 0, z: 0 }, 1000);
assert.equal(shadows.getState().shadowUpdates, 1, 'the first frame refreshes the shadow map');
shadows.update({ x: 0, z: 0 }, 1005);
assert.equal(shadows.getState().shadowUpdates, 1, 'sub-interval frames reuse the current shadow map');
assert.equal(shadows.getState().shadowSkippedFrames, 1);
shadows.update({ x: 0, z: 0 }, 1023);
assert.equal(shadows.getState().shadowUpdates, 2, 'the local map refreshes again at the 45 Hz budget');
shadows.update({ x: 5, z: 0 }, 1024);
assert.equal(shadows.getState().shadowUpdates, 3, 'large player movement refreshes immediately');
const beforeCadence = shadows.getState().shadowUpdates;
for (let frame = 0; frame < 60; frame++) shadows.update({ x: 5, z: 0 }, 1024 + frame * (1000 / 60));
const cadenceUpdates = shadows.getState().shadowUpdates - beforeCadence;
assert(cadenceUpdates >= 43 && cadenceUpdates <= 45, `expected a 45 Hz shadow budget at 60 Hz, got ${cadenceUpdates} refreshes`);
shadows.dispose();

console.log('PASS local shadow map refresh is rate-limited without delaying large movement updates');
