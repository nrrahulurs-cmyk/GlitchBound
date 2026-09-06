import {createPedestrianTemplate} from '../src/civilian-source.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createCivilianMotion} from '../src/civilian-motion.js';

const pieces=createPedestrianTemplate('#334455',true);
const unit=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)),results=[];
function test(name,fn){try{const detail=fn();results.push({test:name,pass:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}catch(e){results.push({test:name,pass:false,error:e.stack});console.error('FAIL '+name,e.message);}}
function fixture({scale=1,ground=()=>.057,umbrella=false}={}){const motion=createCivilianMotion({scale,phase:2.4,groundHeightAt:ground,umbrella});motion.reset({x:0,z:0,yaw:0});return{motion,x:0,z:0,scale,ground};}
function step(f,{vx=0,vz=0,fleeing=false,blocked=false}={},dt=1/60){const plan=f.motion.plan(dt,{vx,vz,fleeing});if(!blocked){f.x+=plan.dx;f.z+=plan.dz;}return f.motion.update(dt,{x:f.x,z:f.z,groundY:f.ground(f.x,f.z),fleeing});}
function rendered(f){return pieces.filter(p=>!p.umbrella).map(piece=>({piece,matrix:f.motion.writePartMatrix(piece,new THREE.Matrix4())}));}
test('Stationary citizens keep planted feet and invariant authored voxel poses',()=>{
 const f=fixture(),before=rendered(f),phase=f.motion.getState().phase;let maxError=0;
 for(let i=0;i<300;i++){const state=step(f);assert(state.feet.every(foot=>foot.planted));assert.equal(state.distance,0);assert.equal(state.phase,phase);const matrices=rendered(f);for(let j=0;j<matrices.length;j++)for(let k=0;k<16;k++)maxError=Math.max(maxError,Math.abs(before[j].matrix.elements[k]-matrices[j].matrix.elements[k]));}
 assert(maxError<1e-10);return{maxMatrixError:maxError,seconds:5};
});
test('Foot contacts stay fixed while travel drives phase; blocked movement stops the cycle',()=>{
 const f=fixture();let previous=f.motion.getState(),maxSlip=0,plantedPairs=0,maxLift=0;const startPhase=previous.phase;
 for(let i=0;i<480;i++){const state=step(f,{vz:.48});for(let j=0;j<2;j++){const foot=state.feet[j],old=previous.feet[j];if(foot.planted&&old.planted){maxSlip=Math.max(maxSlip,Math.hypot(foot.x-old.x,foot.z-old.z));plantedPairs++;}maxLift=Math.max(maxLift,foot.y-.057);}previous=state;}
 assert(maxSlip<1e-10);assert(maxLift>.03);assert(plantedPairs>300);assert(Math.abs(previous.distance-f.z)<1e-8);assert.notEqual(previous.phase,startPhase);
 const frozenPhase=previous.phase,distance=previous.distance;for(let i=0;i<120;i++)previous=step(f,{vz:.48,blocked:true});assert.equal(previous.phase,frozenPhase);assert.equal(previous.distance,distance);assert(previous.feet.every(foot=>foot.planted));
 return{maxPlantedSlipM:maxSlip,plantedPairs,maxLift,walkedM:distance};
});
test('Acceleration, braking, diagonal velocity and turns are bounded and eased',()=>{
 const f=fixture();let previous=f.motion.getState(),maxAcceleration=0,maxYaw=0;
 for(let i=0;i<180;i++){const state=step(f,i<60?{vx:.5,vz:.5}:i<120?{vz:-.7}:{}),accel=Math.hypot(state.velocity.x-previous.velocity.x,state.velocity.z-previous.velocity.z)*60;maxAcceleration=Math.max(maxAcceleration,accel);maxYaw=Math.max(maxYaw,Math.abs(Math.atan2(Math.sin(state.yaw-previous.yaw),Math.cos(state.yaw-previous.yaw))));assert(Math.hypot(state.velocity.x,state.velocity.z)<=Math.SQRT1_2+1e-8);previous=state;}
 assert(maxAcceleration<=4.60001);assert(maxYaw<=3.8/60+1e-8);assert(Math.hypot(previous.velocity.x,previous.velocity.z)<1e-8);return{maxAcceleration,maxTurnPerFrame:maxYaw};
});
test('Scaled two-bone legs retain their lengths and soles stay above real curb support',()=>{
 const observations=[];
 for(const scale of [.84,1,1.12]){
  const ground=(x,z)=>z>1.5?.165:.057,f=fixture({scale,ground});let maxLengthError=0,maxPenetration=0,maxWidth=0,maxDepth=0;
  for(let i=0;i<420;i++){const state=step(f,{vz:.45});const bounds=new THREE.Box3();for(const item of rendered(f)){const b=unit.clone().applyMatrix4(item.matrix);bounds.union(b);if(item.piece.motion===1||item.piece.motion===2){if(item.piece.y<.3)maxPenetration=Math.max(maxPenetration,Math.max(ground(b.min.x,b.min.z),ground(b.max.x,b.max.z))-b.min.y);}}
   for(const [j,suffix] of ['L','R'].entries()){const h=state.jointPositions['hip'+suffix],k=state.jointPositions['knee'+suffix],foot=state.feet[j],a=new THREE.Vector3(foot.x,foot.y+.135*scale,foot.z);maxLengthError=Math.max(maxLengthError,Math.abs(h.distanceTo(k)-.245*scale),Math.abs(k.distanceTo(a)-.285*scale));}
   maxWidth=Math.max(maxWidth,bounds.max.x-bounds.min.x);maxDepth=Math.max(maxDepth,bounds.max.z-bounds.min.z);
  }
  assert(maxLengthError<1e-7,`leg stretched ${maxLengthError}`);assert(maxPenetration<1e-7,`foot clipped ${maxPenetration}`);assert(maxWidth<1.15*scale);assert(maxDepth<1.15*scale);observations.push({scale,maxLengthError,maxPenetration,maxWidth,maxDepth});
 }
 return{observations};
});
test('Fleeing, turning and stopping keep existing voxel geometry bounded and attached',()=>{
 const f=fixture({umbrella:true}),pole=pieces.find(p=>p.umbrella&&p.sy>1),hand=pieces.find(p=>p.motion===4&&p.y<.9);let maxPoleGap=0,maxWidth=0,maxDepth=0,maxLengthError=0;
 for(let i=0;i<480;i++){
  const state=step(f,i<160?{vz:2.6,fleeing:true}:i<320?{vx:2.6,fleeing:true}:{}),bounds=new THREE.Box3();for(const item of rendered(f))bounds.union(unit.clone().applyMatrix4(item.matrix));maxWidth=Math.max(maxWidth,bounds.max.x-bounds.min.x);maxDepth=Math.max(maxDepth,bounds.max.z-bounds.min.z);
  const p=f.motion.writePartMatrix(pole,new THREE.Matrix4()),h=f.motion.writePartMatrix(hand,new THREE.Matrix4()),base=new THREE.Vector3(0,-.5,0).applyMatrix4(p),handBox=unit.clone().applyMatrix4(h);maxPoleGap=Math.max(maxPoleGap,handBox.distanceToPoint(base));
  for(const [j,suffix] of ['L','R'].entries()){const hip=state.jointPositions['hip'+suffix],knee=state.jointPositions['knee'+suffix],foot=state.feet[j];maxLengthError=Math.max(maxLengthError,Math.abs(knee.distanceTo(new THREE.Vector3(foot.x,foot.y+.135,foot.z))-.285));}
 }
 assert(maxPoleGap<.005);assert(maxWidth<1.6&&maxDepth<1.6);assert(maxLengthError<1e-7);assert(f.motion.getState().feet.every(f=>f.planted));return{maxPoleGap,maxWidth,maxDepth,maxLengthError};
});
const report={checkedAtUTC:new Date().toISOString(),passed:results.every(r=>r.pass),results};if(process.env.CIVILIAN_MOTION_REPORT)fs.writeFileSync(process.env.CIVILIAN_MOTION_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
