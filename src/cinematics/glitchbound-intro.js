import * as THREE from 'three';

export const GLITCHBOUND_INTRO_DURATION = 13.8;

const CUES = [
  { at: 2.15, type: 'ufo-reveal' },
  { at: 4.48, type: 'beam-strike' },
  { at: 5.12, type: 'impact' },
  { at: 7.08, type: 'fire' },
  { at: 9.08, type: 'vehicle-entry' },
  { at: 9.48, type: 'accelerate' },
  { at: 12.72, type: 'acceleration-release' },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = (value) => value * value * (3 - 2 * value);
const between = (value, start, end) => smooth(clamp((value - start) / (end - start), 0, 1));
const EMPTY_EVENTS = Object.freeze([]);

function cloneTransform(object) {
  return {
    position: object.position.clone(),
    quaternion: object.quaternion.clone(),
    rotation: object.rotation.clone(),
    scale: object.scale.clone(),
    visible: object.visible,
  };
}

function restoreTransform(object, saved) {
  if (!object || !saved) return;
  object.position.copy(saved.position);
  object.quaternion.copy(saved.quaternion);
  object.scale.copy(saved.scale);
  object.visible = saved.visible;
  object.updateMatrixWorld(true);
}

function disposeGroup(group) {
  if (!group) return;
  group.removeFromParent();
  const geometries = new Set();
  const materials = new Set();
  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function createEffects() {
  const root = new THREE.Group();
  root.name = 'GLITCHBOUND intro temporary effects';
  root.visible = false;

  const hull = new THREE.MeshStandardMaterial({
    color: '#142b3b', metalness: 0.72, roughness: 0.25,
    emissive: '#052738', emissiveIntensity: 1.1,
  });
  const cyan = new THREE.MeshBasicMaterial({
    color: '#53f3ff', toneMapped: false, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const magenta = new THREE.MeshBasicMaterial({
    color: '#ff48d9', toneMapped: false, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const saucer = new THREE.Group();
  saucer.name = 'Temporary saucer';
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.85, 0.42, 28), hull);
  disc.name = 'Saucer hull';
  saucer.add(disc);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.92, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), cyan);
  dome.name = 'Saucer canopy';
  dome.scale.y = 0.58;
  dome.position.y = 0.19;
  saucer.add(dome);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.075, 8, 40), cyan);
  rim.name = 'Saucer cyan rim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.08;
  saucer.add(rim);
  const underside = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.045, 6, 32), magenta);
  underside.rotation.x = Math.PI / 2;
  underside.position.y = -0.23;
  saucer.add(underside);
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), index % 2 ? cyan : magenta);
    light.position.set(Math.cos(angle) * 1.43, -0.06, Math.sin(angle) * 1.43);
    saucer.add(light);
  }
  const saucerLight = new THREE.PointLight('#3deaff', 14, 22, 2);
  saucerLight.position.y = -0.4;
  saucer.add(saucerLight);
  root.add(saucer);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: '#9bfaff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.82, 1, 16, 1, true), beamMaterial);
  beam.name = 'Temporary energy beam';
  beam.visible = false;
  root.add(beam);

  const impactRingMaterial = new THREE.MeshBasicMaterial({
    color: '#6ffaff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    side: THREE.DoubleSide,
  });
  const impactRing = new THREE.Mesh(new THREE.RingGeometry(0.18, 1, 40), impactRingMaterial);
  impactRing.name = 'Temporary impact ripple';
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.visible = false;
  root.add(impactRing);

  const smokeMaterial = new THREE.MeshBasicMaterial({ color: '#415565', transparent: true, opacity: 0, depthWrite: false });
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 8), smokeMaterial);
  smoke.name = 'Temporary impact smoke';
  smoke.visible = false;
  root.add(smoke);

  const flash = new THREE.PointLight('#b9ffff', 0, 13, 2);
  flash.name = 'Temporary impact flash';
  flash.visible = false;
  root.add(flash);

  const sparkCount = 28;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkVelocities = Array.from({ length: sparkCount }, (_, index) => {
    const angle = index * 2.399963229728653;
    const speed = 1.15 + (index % 5) * 0.24;
    return new THREE.Vector3(Math.cos(angle) * speed, 1.15 + (index % 4) * 0.28, Math.sin(angle) * speed);
  });
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({
    color: '#ffc56b', size: 0.12, transparent: true, opacity: 0,
    depthWrite: false, toneMapped: false, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.name = 'Bounded temporary impact sparks';
  sparks.visible = false;
  root.add(sparks);

  const trailCount = 30;
  const trailPositions = new Float32Array(trailCount * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMaterial = new THREE.PointsMaterial({
    color: '#52edff', size: 0.19, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, sizeAttenuation: true,
  });
  const exhaustTrail = new THREE.Points(trailGeometry, trailMaterial);
  exhaustTrail.name = 'Bounded temporary cyan escape trail';
  exhaustTrail.visible = false;
  root.add(exhaustTrail);

  return { root, saucer, saucerLight, beam, impactRing, smoke, flash, sparks, sparkPositions, sparkVelocities, exhaustTrail, trailPositions };
}

export function createGlitchboundIntro({ scene, camera, hero, vehicle, weaponRig, groundHeightAt = () => 0 }) {
  if (!scene?.add || !camera?.isCamera || !hero?.isObject3D || !vehicle?.isObject3D) {
    throw new TypeError('The story intro needs the live scene, camera, VEX character, and K-77 vehicle.');
  }

  let active = false;
  let disposed = false;
  let elapsed = 0;
  let cueIndex = 0;
  let saved = null;
  let effects = createEffects();
  let events = EMPTY_EVENTS;
  let initialCameraPosition = new THREE.Vector3();
  let initialCameraTarget = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const heroFocus = new THREE.Vector3();
  const carFocus = new THREE.Vector3();
  const impactFocus = new THREE.Vector3();
  const doorFocus = new THREE.Vector3();
  const chaseLook = new THREE.Vector3();
  const chaseEye = new THREE.Vector3();
  const beamDirection = new THREE.Vector3();
  const beamUp = new THREE.Vector3(0, 1, 0);
  const trailOrigin = new THREE.Vector3();
  let initialCameraFov = camera.fov;
  let vehicleYaw = 0;
  let heroYaw = 0;
  let heroParts = [];
  for (const name of ['head', 'torso', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'left_knee', 'right_knee']) {
    const object = hero.getObjectByName(name);
    if (object) heroParts.push({ object, transform: null });
  }

  let homeCar = new THREE.Vector3();
  let homeHero = new THREE.Vector3();
  let forward = new THREE.Vector3();
  let right = new THREE.Vector3();
  let door = new THREE.Vector3();
  let impact = new THREE.Vector3();
  let saucerHome = new THREE.Vector3();
  const cameraShots = [
    { at: 0, position: new THREE.Vector3(), target: initialCameraTarget, fov: 66 },
    { at: 1.72, position: new THREE.Vector3(), target: carFocus, fov: 58 },
    { at: 3.55, position: new THREE.Vector3(), target: saucerHome, fov: 57 },
    { at: 5.18, position: new THREE.Vector3(), target: impactFocus, fov: 49 },
    { at: 5.82, position: new THREE.Vector3(), target: heroFocus, fov: 43 },
    { at: 7.48, position: new THREE.Vector3(), target: saucerHome, fov: 48 },
    { at: 8.68, position: new THREE.Vector3(), target: doorFocus, fov: 48 },
    { at: 9.56, position: chaseEye, target: chaseLook, fov: 56 },
    { at: GLITCHBOUND_INTRO_DURATION, position: chaseEye, target: chaseLook, fov: 68 },
  ];
  const heroPartByName = new Map();
  for (const part of heroParts) heroPartByName.set(part.object.name, part);
  let vehicleSpeed = 0;

  function captureStart() {
    camera.updateWorldMatrix(true, false);
    initialCameraPosition.copy(camera.position);
    camera.getWorldDirection(cameraDirection);
    initialCameraTarget.copy(camera.position).addScaledVector(cameraDirection, 48);
    initialCameraFov = camera.fov;
    saved = { hero: cloneTransform(hero), vehicle: cloneTransform(vehicle) };
    heroParts.forEach((part) => { part.transform = cloneTransform(part.object); });
    homeCar.copy(vehicle.position);
    homeHero.copy(hero.position);
    vehicleYaw = vehicle.rotation.y;
    heroYaw = hero.rotation.y;
    forward.set(-Math.sin(vehicleYaw), 0, -Math.cos(vehicleYaw)).normalize();
    right.set(Math.cos(vehicleYaw), 0, -Math.sin(vehicleYaw)).normalize();
    door.copy(homeCar).addScaledVector(right, 2.04).addScaledVector(forward, 0.25);
    impact.copy(homeCar).addScaledVector(right, 4.25).addScaledVector(forward, 0.8);
    impact.y = groundHeightAt(impact.x, impact.z) + 0.018;
    saucerHome.copy(impact).add(cameraOffset.set(-1.7, 12.2, -6.4));
    heroFocus.set(homeHero.x,homeHero.y+1.05,homeHero.z);
    carFocus.set(homeCar.x,homeCar.y+1.1,homeCar.z);
    impactFocus.set(impact.x,impact.y+.75,impact.z);
    doorFocus.set(door.x,door.y+.9,door.z);
    cameraShots[0].position.copy(initialCameraPosition);
    cameraShots[1].position.copy(homeCar).add(cameraOffset.set(6.2,3.2,10.5));
    cameraShots[2].position.copy(homeCar).add(cameraOffset.set(4.5,4.1,7.2));
    cameraShots[3].position.copy(impact).add(cameraOffset.set(7,2.8,4.4));
    cameraShots[4].position.copy(homeHero).add(cameraOffset.set(3.2,1.9,3.8));
    cameraShots[5].position.copy(homeHero).add(cameraOffset.set(2.2,1.6,3.1));
    cameraShots[6].position.copy(door).add(cameraOffset.set(4.1,1.7,2.8));
    vehicleSpeed = 0;
  }

  function restoreHeroParts() {
    heroParts.forEach((part) => restoreTransform(part.object, part.transform));
  }

  function setHeroPartX(name, offset) {
    const part=heroPartByName.get(name),base=part?.transform;
    if(part&&base)part.object.rotation.x=base.rotation.x+offset;
  }

  function cleanupEffects() {
    if (!effects) return;
    effects.root.visible = false;
    effects.root.removeFromParent();
  }

  function resetEffects() {
    const { root, saucer, beam, impactRing, smoke, flash, sparks, exhaustTrail, sparkPositions, trailPositions } = effects;
    root.position.set(0,0,0);
    root.visible = false;
    saucer.position.copy(saucerHome);
    saucer.visible = false;
    beam.visible = false;beam.material.opacity = 0;
    impactRing.position.set(impact.x,impact.y+.026,impact.z);impactRing.visible = false;impactRing.scale.setScalar(1);impactRing.material.opacity=0;
    smoke.position.set(impact.x,impact.y+.44,impact.z);smoke.visible=false;smoke.scale.setScalar(1);smoke.material.opacity=0;
    flash.position.set(impact.x,impact.y+.5,impact.z);flash.intensity=0;flash.visible=false;
    sparks.visible=false;sparks.material.opacity=0;sparkPositions.fill(0);
    exhaustTrail.visible=false;exhaustTrail.material.opacity=0;trailPositions.fill(0);
    sparks.geometry.attributes.position.needsUpdate=true;exhaustTrail.geometry.attributes.position.needsUpdate=true;
  }

  function vehicleSnapshot(speed = vehicleSpeed) {
    return {
      x: vehicle.position.x,
      y: groundHeightAt(vehicle.position.x, vehicle.position.z) + 0.008,
      z: vehicle.position.z,
      yaw: vehicleYaw,
      speed,
    };
  }

  function state({ finished = false, skipped = false, events = EMPTY_EVENTS } = {}) {
    const time = elapsed;
    return {
      active,
      elapsed: time,
      duration: GLITCHBOUND_INTRO_DURATION,
      progress: time / GLITCHBOUND_INTRO_DURATION,
      caption: time < 2.1 ? 'KASUMI WARD / 23:49'
        : time < 4.48 ? 'A SIGNAL ABOVE THE GRID'
          : time < 5.8 ? 'IMPACT — EASTERN CARRIAGEWAY'
            : time < 7.6 ? 'TARGET ACQUIRED'
              : time < 9.48 ? 'MOVE. NOW.'
                : time < 12.0 ? 'NO WAY BACK'
                  : 'AFTER THE SIGNAL',
      titleOpacity: between(time, 11.75, 12.55),
      driving: time >= 9.48 && !skipped,
      vehicle: vehicleSnapshot(skipped ? 0 : vehicleSpeed),
      finished,
      skipped,
      events,
    };
  }

  function applyHero(time, dt) {
    const run = between(time, 7.62, 8.95);
    const enter = time >= 9.08;
    hero.visible = !enter;
    const t = between(time, 7.62, 8.95);
    hero.position.lerpVectors(homeHero, door, t);
    hero.position.y = groundHeightAt(hero.position.x, hero.position.z);

    const aimTarget = time < 7.62 ? saucerHome : door;
    const dx = aimTarget.x - hero.position.x;
    const dz = aimTarget.z - hero.position.z;
    const aimYaw = Math.atan2(-dx, -dz);
    const aim = between(time, 5.25, 6.35) * (1 - between(time, 7.62, 8.1));
    const reaction = between(time, 5.02, 5.14) * (1 - between(time, 5.42, 5.9));
    hero.rotation.y = THREE.MathUtils.lerp(heroYaw, aimYaw, Math.max(aim, run));
    hero.rotation.z = reaction * 0.09;

    const gait = Math.sin((time - 7.62) * 9.5) * run * 0.34;
    setHeroPartX('head', -0.10 * reaction - 0.12 * aim);
    setHeroPartX('torso', -0.08 * reaction + 0.035 * run);
    setHeroPartX('right_arm', 1.12 * aim - 0.30 * reaction - 0.18 * run);
    setHeroPartX('left_arm', 0.82 * aim - 0.20 * reaction + 0.16 * run);
    setHeroPartX('left_leg', gait);
    setHeroPartX('right_leg', -gait);
    setHeroPartX('left_knee', Math.max(0, -gait) * 0.46);
    setHeroPartX('right_knee', Math.max(0, gait) * 0.46);

    weaponRig?.update(time < 9.08 ? dt : 0, {
      time,
      bob: 0,
      moving: false,
      lookYaw: hero.rotation.y,
      lookPitch: -0.14,
      drawn: aim > 0.08,
      active: !enter,
      thirdPerson: true,
      reloadTime: 0,
    });
  }

  function applyVehicle(time) {
    const drive = clamp((time - 9.48) / (GLITCHBOUND_INTRO_DURATION - 9.48), 0, 1);
    const distance = 20 * drive * drive;
    vehicleSpeed = (40 / (GLITCHBOUND_INTRO_DURATION - 9.48)) * drive;
    vehicle.position.copy(homeCar).addScaledVector(forward, distance);
    vehicle.position.y = groundHeightAt(vehicle.position.x, vehicle.position.z) + 0.008;
    vehicle.rotation.set(0, vehicleYaw, time < 9.48 ? 0 : -Math.min(0.025, vehicleSpeed * 0.0015));
    return drive;
  }

  function applyEffects(time, drive) {
    const { saucer, saucerLight, beam, impactRing, smoke, flash, sparks, sparkPositions, sparkVelocities, exhaustTrail, trailPositions } = effects;
    saucer.visible = time >= 2.15 && time < 10.9;
    saucer.position.copy(saucerHome);
    saucer.position.y += Math.sin(time * 1.2) * 0.16;
    saucer.rotation.y = time * 0.2;
    saucerLight.intensity = 10 + Math.sin(time * 3.4) * 2;

    const beamAlpha = between(time, 4.48, 4.72) * (1 - between(time, 5.14, 5.48));
    beam.visible = beamAlpha > 0.001;
    beamDirection.copy(saucer.position).sub(impact);
    const beamLength = Math.max(0.001, beamDirection.length());
    beam.position.copy(impact).addScaledVector(beamDirection, 0.5);
    beam.quaternion.setFromUnitVectors(beamUp, beamDirection.normalize());
    beam.scale.y = beamLength;
    beam.material.opacity = beamAlpha * 0.62;

    const impactAge = time - 5.12;
    const impactActive = impactAge >= 0 && impactAge < 0.92;
    const normalized = clamp(impactAge / 0.92, 0, 1);
    impactRing.visible = impactActive;
    impactRing.scale.setScalar(0.75 + normalized * 2.5);
    impactRing.material.opacity = impactActive ? 0.72 * (1 - normalized) : 0;
    smoke.visible = impactActive;
    smoke.scale.setScalar(0.45 + normalized * 1.6);
    smoke.position.y = impact.y + 0.36 + normalized * 0.55;
    smoke.material.opacity = impactActive ? 0.23 * (1 - normalized) : 0;
    flash.intensity = impactAge >= 0 ? 18 * Math.exp(-Math.max(0, impactAge) * 11) : 0;
    flash.visible = flash.intensity > 0.05;
    sparks.visible = impactActive;
    sparks.material.opacity = impactActive ? 1 - normalized : 0;
    for (let index = 0; index < sparkVelocities.length; index++) {
      const age = Math.max(0, impactAge);
      const velocity = sparkVelocities[index];
      sparkPositions[index * 3] = impact.x + velocity.x * age;
      sparkPositions[index * 3 + 1] = impact.y + 0.08 + velocity.y * age - 2.6 * age * age;
      sparkPositions[index * 3 + 2] = impact.z + velocity.z * age;
    }
    sparks.geometry.attributes.position.needsUpdate = true;

    exhaustTrail.visible = drive > 0.04;
    exhaustTrail.material.opacity = exhaustTrail.visible ? 0.62 * (1 - drive * 0.22) : 0;
    trailOrigin.copy(vehicle.position).addScaledVector(forward, -1.7);
    for (let index = 0; index < trailPositions.length / 3; index++) {
      const along = index / (trailPositions.length / 3 - 1);
      const flutter = Math.sin(time * 17 + index * 1.73);
      trailPositions[index * 3] = trailOrigin.x - forward.x * along * 3.8 + right.x * flutter * 0.11;
      trailPositions[index * 3 + 1] = trailOrigin.y + 0.18 + (1 - along) * 0.13 + Math.cos(time * 14 + index * 1.3) * 0.045;
      trailPositions[index * 3 + 2] = trailOrigin.z - forward.z * along * 3.8 + right.z * flutter * 0.11;
    }
    exhaustTrail.geometry.attributes.position.needsUpdate = true;
  }

  function applyCamera(time, drive) {
    chaseLook.copy(vehicle.position).addScaledVector(forward,2);chaseLook.y+=1.15;
    chaseEye.copy(vehicle.position).addScaledVector(forward,-7.4);chaseEye.y+=3.1;
    let index = 0;
    while (index < cameraShots.length - 2 && time > cameraShots[index + 1].at) index++;
    const a = cameraShots[index];
    const b = cameraShots[index + 1];
    const blend = smooth(clamp((time - a.at) / (b.at - a.at), 0, 1));
    camera.position.lerpVectors(a.position, b.position, blend);
    camera.fov = THREE.MathUtils.lerp(a.fov, b.fov, blend) + drive * 1.6;
    if (time >= 5.12 && time < 5.72) {
      const shake = Math.exp(-(time - 5.12) * 12) * 0.035;
      camera.position.x += Math.sin(time * 47) * shake;
      camera.position.y += Math.cos(time * 39) * shake * 0.45;
    }
    camera.lookAt(lookTarget.lerpVectors(a.target,b.target,blend));
    camera.updateProjectionMatrix();
  }

  function start() {
    if (active||disposed) return false;
    captureStart();
    resetEffects();scene.add(effects.root);effects.root.visible=true;
    elapsed = 0;
    cueIndex = 0;
    active = true;
    return true;
  }

  function update(dt) {
    if (!active) return null;
    const previous = elapsed;
    elapsed = clamp(elapsed + (Number.isFinite(dt) ? Math.max(0, dt) : 0), 0, GLITCHBOUND_INTRO_DURATION);
    events = EMPTY_EVENTS;
    while (cueIndex < CUES.length && CUES[cueIndex].at <= elapsed) {
      if (CUES[cueIndex].at > previous) {
        if(events===EMPTY_EVENTS)events=[];
        events.push({ ...CUES[cueIndex], position: impact.clone(), target: saucerHome.clone() });
      }
      cueIndex++;
    }
    const drive = applyVehicle(elapsed);
    applyHero(elapsed, dt);
    applyEffects(elapsed, drive);
    applyCamera(elapsed, drive);
    if (elapsed >= GLITCHBOUND_INTRO_DURATION) {
      active = false;
      hero.visible = false;
      restoreHeroParts();
      cleanupEffects();
      return state({ finished: true, events });
    }
    return state({ events });
  }

  function skip() {
    if (!active) return null;
    active = false;
    elapsed = Math.min(elapsed, GLITCHBOUND_INTRO_DURATION);
    restoreTransform(hero, saved?.hero);
    restoreTransform(vehicle, saved?.vehicle);
    restoreHeroParts();
    cleanupEffects();
    vehicleSpeed = 0;
    return state({ finished: true, skipped: true });
  }

  function getState() {
    return state();
  }

  function dispose() {
    if (active) skip();
    cleanupEffects();
    if(effects){disposeGroup(effects.root);effects=null}
    disposed=true;
  }

  return { start, update, skip, getState, dispose, prewarmRoot: effects.root };
}
