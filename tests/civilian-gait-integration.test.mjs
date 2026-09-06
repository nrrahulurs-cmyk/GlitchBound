import {createCityPopulation,createPedestrianTemplate} from '../src/civilian-source.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCivilianSystem} from '../src/civilians.js';
import {createSimulation} from '../src/simulation.js';
import {createCityLayout} from '../src/city-layout.js';

const pieces=umbrella=>createPedestrianTemplate('#334455',umbrella),results=[];
function test(name,fn){try{const result=fn();results.push({test:name,pass:true,...result});console.log('PASS '+name,JSON.stringify(result));}catch(e){results.push({test:name,pass:false,error:e.stack});console.error('FAIL '+name,e.message);}}
function fixture({scale=1,speed=.45,umbrella=false}={}){const person={x:35,z:0,scale,speed,phase:2.4,minZ:-500,maxZ:500,pieces:pieces(umbrella)},mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),person.pieces.length),scene=new THREE.Scene();scene.add(mesh);const civilians=createCivilianSystem({people:[person],mesh,groundHeightAt:()=>.057});const sim=createSimulation({scene,camera:new THREE.PerspectiveCamera(),civilians,groundHeightAt:()=>.057});return{person,mesh,civilians,sim,time:0};}
function step(f,n=1){for(let i=0;i<n;i++){f.time+=1/60;f.sim.update(1/60,f.time,{position:new THREE.Vector3(300,2,300),damage(){},inVehicle:false});f.civilians.update(1/60,f.time,new THREE.Vector3(100,2,100));}}
test('Walking and fleeing deaths preserve every voxel, anatomical joint point and captured bone orientation',()=>{
 const cases=[],configs=[{scale:.84,speed:.45,frames:19},{scale:1.12,speed:-.7,frames:49},{scale:1,speed:.45,frames:88,umbrella:true},{scale:1.02,speed:.5,frames:27,flee:true},{scale:.95,speed:-.5,frames:43,flee:true,umbrella:true},{scale:1,speed:.5,frames:111,flee:true}];
 for(const config of configs){const f=fixture(config);if(config.flee)f.civilians.damage(f.person.id,10,{direction:new THREE.Vector3(.6,0,.8)});step(f,config.frames);
  const pose=f.mesh.instanceMatrix.array.slice(),captured=f.person.gait.getState();f.civilians.damage(f.person.id,100,{direction:new THREE.Vector3(0,0,-1)});f.civilians.update(0,f.time);
  let matrixError=0,jointPointError=0,angleOverrun=0,angles=[];for(let i=0;i<pose.length;i++)matrixError=Math.max(matrixError,Math.abs(pose[i]-f.mesh.instanceMatrix.array[i]));
  for(const joint of f.sim.world.constraints){const a=joint.bodyA.pointToWorldFrame(joint.pivotA),b=joint.bodyB.pointToWorldFrame(joint.pivotB),c=captured.jointPositions[joint.name];jointPointError=Math.max(jointPointError,Math.hypot(a.x-c.x,a.y-c.y,a.z-c.z),a.distanceTo(b));
   const q=joint.bodyA.quaternion.conjugate().mult(joint.bodyB.quaternion);if(joint.ragdollLimits.type==='hinge'){const angle=2*Math.atan2(q.x,q.w);angleOverrun=Math.max(angleOverrun,joint.ragdollLimits.lower-angle,angle-joint.ragdollLimits.upper);}else{const a=joint.bodyA.vectorToWorldFrame(joint.axisA),b=joint.bodyB.vectorToWorldFrame(joint.axisB);const angle=Math.acos(Math.max(-1,Math.min(1,a.dot(b))));angles.push({name:joint.name,angle,limit:joint.ragdollLimits.cone});angleOverrun=Math.max(angleOverrun,angle-joint.ragdollLimits.cone);}}
  assert(matrixError<1e-6);assert(jointPointError<1e-8);
  let maxGap=0,maxRise=0,firstSleep=null;for(let i=0;i<1800;i++){step(f);const p=f.civilians.getPeople()[0];maxGap=Math.max(maxGap,p.physics.maxJointError);maxRise=Math.max(maxRise,p.bodyBounds.min.y-.057);if(firstSleep===null&&p.physics.sleeping)firstSleep=(i+1)/60;}
  const final=f.civilians.getPeople()[0];
  cases.push({...config,matrixError,jointPointError,angleOverrun,angles,maxGap,maxRise,firstSleep,sleeping:final.physics.sleeping,final:final.physics});f.civilians.reset();f.sim.dispose();
 }assert(cases.every(c=>c.angleOverrun<.05&&c.maxGap<.2&&c.maxRise<.5&&c.sleeping),JSON.stringify(cases));return{cases};
});
test('All284 authored citizens keep the original instance count with actual city pavement sampling',()=>{
 const layout=createCityLayout(),people=createCityPopulation({districts:layout.districts}).people,count=people.reduce((n,p)=>n+p.pieces.length,0);
 const surfaces=layout.boxes.filter(v=>v.kind==='pavement'&&v.sx>=1&&v.sz>=1&&v.y+v.sy/2>=.08&&v.y+v.sy/2<=.4);
 const groundHeightAt=(x,z)=>{let h=.057;for(const s of surfaces){const c=Math.cos(s.ry||0),sn=Math.sin(s.ry||0),dx=x-s.x,dz=z-s.z;if(Math.abs(dx*c-dz*sn)<=s.sx/2&&Math.abs(dx*sn+dz*c)<=s.sz/2)h=Math.max(h,s.y+s.sy/2);}return h;};
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),count),civilians=createCivilianSystem({people,mesh,colliders:layout.colliders,groundHeightAt,bounds:layout.bounds});
 for(let i=0;i<30;i++)civilians.update(1/60,i/60,new THREE.Vector3(0,2,20));const times=[];for(let i=0;i<180;i++){const start=performance.now();civilians.update(1/60,(30+i)/60,new THREE.Vector3(0,2,20));times.push(performance.now()-start);}
 const meanMs=times.reduce((a,b)=>a+b)/times.length,p95Ms=times.slice().sort((a,b)=>a-b)[Math.floor(times.length*.95)];assert.equal(mesh.count,count);assert.equal(civilians.getState().alive,284);assert(meanMs<8,`CPU update ${meanMs}`);return{citizens:284,voxelInstances:count,groundSurfaces:surfaces.length,meanMs,p95Ms};
});
const report={checkedAtUTC:new Date().toISOString(),passed:results.every(r=>r.pass),results};if(process.env.CIVILIAN_GAIT_REPORT)fs.writeFileSync(process.env.CIVILIAN_GAIT_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
