import assert from 'node:assert/strict';
import * as THREE from 'three';
import {applyMouseLook,CAMERA_CONFIG,dampYaw,isMouseLookActive,movementFacingYaw,setThirdPersonCameraPose,vehicleBoomPitch,wrapAngle} from '../src/camera-rig.js';

const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} is not within ${tolerance} of ${b}`);
let count=0;
function test(name,run){run();count++;console.log(`PASS ${name}`)}

test('Mouse yaw and pitch are independent, consistently signed, and sensitivity-scaled',()=>{
  const yaw=applyMouseLook(0,0,100,0,CAMERA_CONFIG.thirdPerson);
  const pitch=applyMouseLook(0,0,0,100,CAMERA_CONFIG.thirdPerson);
  near(yaw.yaw,-.22);near(yaw.pitch,0);near(pitch.yaw,0);near(pitch.pitch,-.22);
});

test('Mouse-look works without pointer lock and ignores interactive controls',()=>{
  assert.equal(isMouseLookActive(false,false),true);
  assert.equal(isMouseLookActive(false,true),false);
  assert.equal(isMouseLookActive(true,true),true);
});

test('Vehicle boom pitch follows the same up/down mouse convention as on-foot look',()=>{
  const baseline=vehicleBoomPitch(-.12);
  near(baseline,.22);
  assert.ok(vehicleBoomPitch(.2)<baseline,'mouse-up input lowers the boom to look higher');
  assert.ok(vehicleBoomPitch(-.3)>baseline,'mouse-down input raises the boom to look lower');
  near(vehicleBoomPitch(.58),CAMERA_CONFIG.vehicle.minBoomPitch);
  near(vehicleBoomPitch(-.42),.52);
});

test('Mouse pitch clamps to the selected camera mode while yaw wraps continuously',()=>{
  const result=applyMouseLook(Math.PI-.01,0,-20,10000,CAMERA_CONFIG.thirdPerson);
  assert.ok(result.yaw>=-Math.PI&&result.yaw<=Math.PI);near(result.pitch,CAMERA_CONFIG.thirdPerson.minPitch);
  near(wrapAngle(9*Math.PI),Math.PI);
});

test('Camera-relative movement facing matches forward, strafe, diagonal, and rotated camera inputs',()=>{
  near(movementFacingYaw(0,1,0),0);
  near(movementFacingYaw(0,0,1),-Math.PI/2);
  near(movementFacingYaw(0,1,1),-Math.PI/4);
  near(movementFacingYaw(Math.PI/2,1,0),Math.PI/2);
  assert.equal(movementFacingYaw(0,0,0),null);
});

test('Smoothed body turning takes the shortest angular path and is frame-rate stable',()=>{
  const start=Math.PI-.1,target=-Math.PI+.1,rate=12,duration=.5;
  const at30=Array.from({length:15},(_,i)=>i).reduce(yaw=>dampYaw(yaw,target,rate,1/30),start);
  const at120=Array.from({length:60},(_,i)=>i).reduce(yaw=>dampYaw(yaw,target,rate,1/120),start);
  near(at30,at120,1e-9);assert.ok(Math.abs(wrapAngle(at30-start))<.3);assert.ok(Math.abs(wrapAngle(target-at30))<.1);
  near(dampYaw(0,Math.PI,0,1),0);
});

test('Third-person boom targets the torso, offsets behind/right, and follows pitch around the focus',()=>{
  const position=new THREE.Vector3(10,1.75,20),anchor=new THREE.Vector3(),desired=new THREE.Vector3();
  const pitch=setThirdPersonCameraPose(position,0,-.12,anchor,desired);
  near(pitch,-.12);near(anchor.y,1.23);near(desired.x,.82+10);near(desired.y,anchor.y+Math.sin(.12)*4.8);near(desired.z,20+Math.cos(.12)*4.8);
  setThirdPersonCameraPose(position,Math.PI/2,-.12,anchor,desired);
  near(desired.x,10+4.8*Math.cos(.12));near(desired.z,20-.82);
  const up=setThirdPersonCameraPose(position,0,1,anchor,desired);
  near(up,CAMERA_CONFIG.thirdPerson.maxPitch);
  assert.ok(desired.y>anchor.y-CAMERA_CONFIG.thirdPerson.distance*.2);
});

console.log(`Completed camera-rig.test.mjs: ${count} checks.`);
