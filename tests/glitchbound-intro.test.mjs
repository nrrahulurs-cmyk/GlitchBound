import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGlitchboundIntro, GLITCHBOUND_INTRO_DURATION } from '../src/cinematics/glitchbound-intro.js';

let count = 0;
function test(name, run) {
  run();
  count++;
  console.log(`PASS ${name}`);
}

function fixture() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, 16 / 9, 0.08, 520);
  camera.position.set(-0.5, 1.2, 32);
  camera.lookAt(-0.5, 42, -100);
  scene.add(camera);

  const hero = new THREE.Group();
  hero.position.set(1.2, 0.057, 26.8);
  for (const name of ['head', 'torso', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'left_knee', 'right_knee']) {
    const part = new THREE.Group();
    part.name = name;
    hero.add(part);
  }
  scene.add(hero);

  const vehicle = new THREE.Group();
  vehicle.position.set(-3.8, 0.065, 23.5);
  vehicle.rotation.y = -0.2;
  scene.add(vehicle);
  const controller = createGlitchboundIntro({ scene, camera, hero, vehicle, groundHeightAt: () => 0.057 });
  return { scene, camera, hero, vehicle, controller };
}

test('the live-scene intro completes its story cues and removes temporary VFX before handoff', () => {
  const f = fixture();
  const originalChildren = f.scene.children.length;
  const originalCar = f.vehicle.position.clone();
  assert.equal(f.controller.start(), true);
  assert.equal(f.scene.children.length, originalChildren + 1);

  const cues = [];
  let state;
  for (let frame = 0; frame < 300 && !state?.finished; frame++) {
    state = f.controller.update(0.05);
    cues.push(...state.events.map((event) => event.type));
  }

  assert.equal(state.finished, true);
  assert.equal(state.skipped, false);
  assert.equal(state.active, false);
  assert.equal(state.elapsed, GLITCHBOUND_INTRO_DURATION);
  assert(state.vehicle.speed > 5, 'the player should inherit real forward speed at the chase handoff');
  assert(state.vehicle.z < originalCar.z - 19, 'the actual vehicle should escape down the street');
  assert.deepEqual(cues, ['ufo-reveal', 'beam-strike', 'impact', 'fire', 'vehicle-entry', 'accelerate', 'acceleration-release']);
  assert.equal(f.hero.visible, false, 'the hero is seated inside the vehicle at natural handoff');
  assert.equal(f.scene.children.length, originalChildren, 'the temporary saucer, beam and impact effects are removed');
  f.controller.dispose();
  f.controller.dispose();
  assert.equal(f.scene.children.length, originalChildren);
});

test('skip restores the original hero and vehicle and repeated starts do not accumulate scene objects', () => {
  const f = fixture();
  const originalChildren = f.scene.children.length;
  const originalHero = f.hero.position.clone();
  const originalCar = f.vehicle.position.clone();
  const retainedRoot = f.controller.prewarmRoot;
  const retainedResources = [];
  retainedRoot.traverse((object) => {
    if (object.geometry) retainedResources.push(object.geometry);
    if (Array.isArray(object.material)) retainedResources.push(...object.material);
    else if (object.material) retainedResources.push(object.material);
  });

  assert.equal(f.controller.start(), true);
  f.controller.update(10.2);
  assert.notDeepEqual(f.vehicle.position.toArray(), originalCar.toArray());
  const trail = f.scene.getObjectByName('Bounded temporary cyan escape trail');
  assert.equal(trail.visible, true);
  assert.equal(trail.geometry.getAttribute('position').count, 30);
  const skipped = f.controller.skip();
  assert.equal(skipped.finished, true);
  assert.equal(skipped.skipped, true);
  assert.deepEqual(f.vehicle.position.toArray(), originalCar.toArray());
  assert.deepEqual(f.hero.position.toArray(), originalHero.toArray());
  assert.equal(f.hero.visible, true);
  assert.equal(f.scene.children.length, originalChildren);

  assert.equal(f.controller.start(), true);
  assert.equal(f.controller.prewarmRoot, retainedRoot);
  assert.deepEqual(retainedResources, (() => {
    const resources = [];
    retainedRoot.traverse((object) => {
      if (object.geometry) resources.push(object.geometry);
      if (Array.isArray(object.material)) resources.push(...object.material);
      else if (object.material) resources.push(object.material);
    });
    return resources;
  })());
  const active = f.controller.update(0.5);
  assert.equal(active.active, true);
  assert.equal(f.scene.children.length, originalChildren + 1);
  const skippedAgain = f.controller.skip();
  assert.equal(skippedAgain.skipped, true);
  assert.equal(f.scene.children.length, originalChildren);
  assert.equal(f.controller.start(), true, 'the same retained effect set can replay after a second skip');
  let replay;
  for (let frame = 0; frame < 300 && !replay?.finished; frame++) replay = f.controller.update(0.05);
  assert.equal(replay.finished, true);
  assert.equal(f.controller.prewarmRoot, retainedRoot);
  assert.equal(f.scene.children.length, originalChildren, 'natural completion detaches rather than destroys the reusable VFX');
  assert.equal(retainedRoot.visible, false);
  f.controller.dispose();
  assert.equal(f.scene.children.length, originalChildren);
  assert.equal(f.controller.start(), false, 'disposed intro controllers cannot be replayed');
});

test('required live scene references fail clearly without mutating a scene', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  assert.throws(() => createGlitchboundIntro({ scene, camera }), /live scene, camera, VEX character, and K-77 vehicle/);
  assert.equal(scene.children.length, 0);
});

console.log(`\n${count} GLITCHBOUND intro checks passed.`);
