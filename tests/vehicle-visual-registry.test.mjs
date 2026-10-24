import assert from 'node:assert/strict';
import * as THREE from 'three';
import {getVehicleVisualRegistry,registerVehicleVisual} from '../src/vehicle-visual-registry.js';

const scene=new THREE.Scene();
const player=new THREE.Group();player.name='player car model';player.position.set(-3.8,.065,23.5);
const parked=new THREE.Group();parked.name='parked car model';parked.position.set(-9.2,.065,-74);
registerVehicleVisual(scene,player,{id:'VEHICLE-PLAYER',asset:'interceptor',role:'player vehicle spawn'});
registerVehicleVisual(scene,parked,{id:'VEHICLE-PARKED',asset:'interceptor',role:'parking strip'});

const registry=getVehicleVisualRegistry(scene);
assert.equal(registry.count,2);
assert.deepEqual(registry.duplicateIds,[]);
assert.deepEqual(registry.vehicles.map(vehicle=>vehicle.id),['VEHICLE-PLAYER','VEHICLE-PARKED']);
assert.deepEqual(registry.vehicles.map(vehicle=>vehicle.modelPath),['/assets/interceptor.glb','/assets/interceptor.glb']);
assert.notEqual(player,parked,'separate placement visuals must not share the same Object3D');
assert.equal(player.parent,scene);assert.equal(parked.parent,scene);

const rejected=new THREE.Group();
assert.throws(()=>registerVehicleVisual(scene,rejected,{id:'VEHICLE-PLAYER',asset:'tripo-car-a'}),/Duplicate vehicle visual registration/);
assert.equal(rejected.parent,null,'a duplicate must be rejected before scene registration');
assert.equal(getVehicleVisualRegistry(scene).count,2);
assert.throws(()=>registerVehicleVisual(scene,new THREE.Group(),{id:'',asset:'car'}),/stable id and asset key/);

console.log('Completed vehicle-visual-registry.test.mjs: 11 assertions.');
