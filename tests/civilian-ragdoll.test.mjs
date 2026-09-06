import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {createCivilianSystem} from '../src/civilians.js';
import {createSimulation} from '../src/simulation.js';
import {createCityLayout} from '../src/city-layout.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';

const source=fs.readFileSync(new URL('../src/city.js',import.meta.url),'utf8');
const template=source.slice(source.indexOf('  function pedestrianTemplate('),source.indexOf('  const people=[];'));
const pieces=new Function('pick',template+';return pedestrianTemplate("#334455",true)')(array=>array[0]);
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),results=[],fixtures=[];
function test(name,fn){try{const detail=fn();results.push({test:name,pass:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}catch(e){results.push({test:name,pass:false,error:e.stack});console.error('FAIL '+name,e.message);}}
function fixture({count=1,x=35,z=0,ground=.057,extra={},bodyPieces=pieces,scale=1}={}){
 const people=Array.from({length:count},(_,i)=>({x:x+i*3,z,speed:0,phase:0,scale,minZ:-600,maxZ:600,pieces:bodyPieces}));
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),people.length*bodyPieces.length),scene=new THREE.Scene();scene.add(mesh);
 const civilians=createCivilianSystem({people,mesh,groundHeightAt:()=>ground});
 const sim=createSimulation({scene,camera:new THREE.PerspectiveCamera(),civilians,groundHeightAt:()=>ground,...extra});
 const f={people,mesh,civilians,sim,time:0};fixtures.push(f);return f;
}
function advance(f,seconds,observe=()=>{}){for(let i=0;i<Math.round(seconds*60);i++){f.sim.update(1/60,f.time,{position:V(300,2,300),damage(){},inVehicle:false});f.time+=1/60;f.civilians.update(1/60,f.time,V(300,2,300));observe(f.civilians.getPeople()[0]);}}
test('Actual rendered86-voxel figure becomes11 segments and10 joints without pose discontinuity',()=>{
 const f=fixture();f.people[0].speed=.4;f.people[0].phase=.7;f.civilians.update(.03,.8,V(300,2,300));const before=f.mesh.instanceMatrix.array.slice();
 f.civilians.damage('CIV-001',100,{direction:V(0,0,1)});f.civilians.update(0,.8);const after=f.mesh.instanceMatrix.array;
 let error=0;for(let i=0;i<before.length;i++)error=Math.max(error,Math.abs(before[i]-after[i]));assert(error<1e-6);
 const state=f.civilians.getPeople()[0].physics,joints=f.sim.world.constraints;assert.equal(state.segments,11);assert.equal(joints.length,10);assert.equal(joints.filter(j=>j.ragdollLimits.type==='hinge').length,4);assert(state.maxJointError<1e-8);
 assert(Math.abs(f.people[0].physical.records.filter(r=>!r.umbrella).reduce((sum,r)=>sum+r.body.mass,0)-68)<1e-8);
 return{matrixError:error,segments:state.segments,joints:joints.length};
});
test('Bullet death collapses, articulates, settles on pavement and sleeps with bounded joint drift',()=>{
 const f=fixture();f.civilians.damage('CIV-001',100,{direction:V(0,0,1)});let maxGap=0,peakSpeed=0,peakHeight=0,maxArticulation=0,maxHingeOverrun=0;
 advance(f,18,p=>{maxGap=Math.max(maxGap,p.physics.maxJointError);peakSpeed=Math.max(peakSpeed,p.physics.speed);peakHeight=Math.max(peakHeight,p.bodyBounds.max.y);assert(Number.isFinite(p.x+p.z+p.physics.speed));
  for(const joint of f.sim.world.constraints){const q=joint.bodyA.quaternion.conjugate().mult(joint.bodyB.quaternion);maxArticulation=Math.max(maxArticulation,2*Math.acos(Math.min(1,Math.abs(q.w))));
   if(joint.ragdollLimits.type==='hinge'){const angle=2*Math.atan2(q.x,q.w),{lower,upper}=joint.ragdollLimits;maxHingeOverrun=Math.max(maxHingeOverrun,lower-angle,angle-upper);}}
 });
 const p=f.civilians.getPeople()[0];
 assert(maxGap<.15,`joint gap ${maxGap}`);assert(p.bodyBounds.max.y<1.15,`resting head ${p.bodyBounds.max.y}`);assert(Math.abs(p.bodyBounds.min.y-.057)<.065);assert(p.physics.sleeping,'ragdoll never slept');assert(maxArticulation>.3);assert(maxHingeOverrun<.03,`joint stop overrun ${maxHingeOverrun}`);
 return{maxGap,peakSpeed,peakHeight,maxArticulation,maxHingeOverrun,restingHeight:p.bodyBounds.max.y,sleeping:p.physics.sleeping};
});
test('Different walking strides and civilian scales dissipate limb motion before assembly sleep',()=>{
 const observations=[];
 for(const [scale,phase,speed] of [[.84,.3,.4],[1.025,1.2,-.4],[1.12,2.4,.4],[1,3.1,-.4]]){
  const f=fixture({scale,bodyPieces:pieces.filter(p=>!p.umbrella)});f.people[0].phase=phase;f.people[0].speed=speed;f.civilians.update(.01,.8,V(300,2,300));
  f.civilians.damage('CIV-001',100,{direction:V(0,0,-1)});advance(f,18);const p=f.civilians.getPeople()[0];
  observations.push({scale,phase,speed,asleep:p.physics.sleeping,restY:p.bodyBounds.min.y,comSpeed:p.physics.speed});
 }
 assert(observations.every(p=>p.asleep),JSON.stringify(observations));return{observations};
});
test('Accepted forward and reverse contact-velocity kinematic-car impacts have restrained launches',()=>{
 const observations=[];
 for(const sign of[-1,1]){
  const f=fixture(),car=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:f.sim.physicsMaterial});car.addShape(new CANNON.Box(new CANNON.Vec3(1.4,.64,2.6)));car.position.set(35,.745,-sign*7);f.sim.world.addBody(car);
  let killed=false,maxUp=0,maxBottom=0,maxGap=0;
  for(let i=0;i<240;i++){
   const previous=V(car.position.x,.065,car.position.z),next=previous.clone();if(i<100)next.z+=sign*18/60;
   const hits=f.civilians.vehicleImpact(previous,next,{yaw:sign>0?Math.PI:0,speed:18,halfWidth:1.45,halfLength:2.64});killed||=hits.some(h=>h.killed);
   car.position.z=next.z;car.velocity.set(0,0,(next.z-previous.z)*60);car.aabbNeedsUpdate=true;
   advance(f,1/60,p=>{if(p.physics){maxUp=Math.max(maxUp,p.physics.velocity.y);maxBottom=Math.max(maxBottom,p.bodyBounds.min.y);maxGap=Math.max(maxGap,p.physics.maxJointError);}});
   car.position.z=next.z;car.aabbNeedsUpdate=true;
  }
  const p=f.civilians.getPeople()[0];assert(killed);assert(sign*p.z>3);assert(maxUp<=3.21,`up ${maxUp}`);assert(maxBottom<3,`launch bottom ${maxBottom}`);assert(maxGap<.25,`joint gap ${maxGap}`);
  advance(f,14);assert(f.civilians.getPeople()[0].bodyBounds.min.y>-.025);observations.push({sign,maxUp,maxBottom,maxGap,travel:p.z,corrections:p.physics.correctionCount});
 }
 return{observations};
});
test('Actual authored building and raised sidewalk stop a thrown articulated body',()=>{
 const city=createCityLayout(),street=createStreetCollisionLayout(city),bin=street.dynamicProps[0],x=bin.x+1.9,z=bin.z-5;
 const near=[...city.colliders,...street.staticColliders].filter(b=>Math.abs(b.x-x)<b.sx/2+10&&Math.abs(b.z-z)<b.sz/2+12),grounds=street.groundSurfaces.filter(b=>Math.abs(b.x-x)<b.sx/2+10&&Math.abs(b.z-z)<b.sz/2+12);
 const f=fixture({x,z,ground:.165,extra:{streetColliders:near,groundSurfaces:grounds}});f.civilians.damage('CIV-001',100,{direction:V(-1,0,0),cause:'vehicle',speed:18});let minX=x,maxGap=0;
 advance(f,12,p=>{minX=Math.min(minX,p.bodyBounds.min.x);maxGap=Math.max(maxGap,p.physics.maxJointError);});const p=f.civilians.getPeople()[0];
 assert(p.bodyBounds.min.y>.02);assert(minX>-18,`passed through west buildings ${minX}`);assert(maxGap<.3);return{authoredShapes:near.length,raisedSurfaces:grounds.length,minX,maxGap,restingBottom:p.bodyBounds.min.y};
});
test('Sleeping limbs wake on a later impulse, corpse raycasts remain physical, and reset removes all joints',()=>{
 const f=fixture(),baseline=f.sim.world.bodies.length;f.civilians.damage('CIV-001',100,{direction:V(0,0,1)});advance(f,18);const p=f.civilians.getPeople()[0];
 assert(p.physics.sleeping);
 const b=p.bodyBounds,rayOrigin=V((b.min.x+b.max.x)/2,b.max.y+2,(b.min.z+b.max.z)/2);let hit=f.civilians.raycast(rayOrigin,V(0,-1,0));
 if(!hit){const part=f.people[0].parts.find(p=>p.piece.y>1.6&&!p.piece.umbrella),at=new THREE.Vector3().setFromMatrixPosition(part.matrix);hit=f.civilians.raycast(at.clone().add(V(0,2,0)),V(0,-1,0));}
 assert(hit?.corpse);assert(f.civilians.impulse(p.id,V(0,1,0),hit.point,45));advance(f,.2);assert(!f.civilians.getPeople()[0].physics.sleeping);assert.equal(f.civilians.damage(p.id,100).hit,false);
 f.sim.reset();assert.equal(f.sim.world.constraints.length,0);assert.equal(f.sim.world.bodies.length,baseline);assert.equal(f.civilians.getState().alive,1);return{corpseHit:true,remainingJoints:f.sim.world.constraints.length};
});
test('A later moving car wakes a settled production ragdoll through real solver contact',()=>{
 const f=fixture();f.civilians.damage('CIV-001',100,{direction:V(0,0,1)});advance(f,18);
 const before=f.civilians.getPeople()[0];assert(before.physics.sleeping);
 const umbrella=f.people[0].physical.records.find(r=>r.umbrella);assert.equal(umbrella.body.sleepState,CANNON.Body.SLEEPING);
 const car=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:f.sim.physicsMaterial});car.addShape(new CANNON.Box(new CANNON.Vec3(1.4,.64,2.6)));car.position.set(before.x,.745,before.z+4.5);car.velocity.set(0,0,-8);f.sim.world.addBody(car);
 let sawWake=false,maxGap=0,framesAfterWake=0,raisedBudgetAfterWake=false;advance(f,.8,p=>{sawWake||=!p.physics.sleeping;if(sawWake){framesAfterWake++;if(f.sim.world.solver.iterations===12)raisedBudgetAfterWake=true;if(framesAfterWake>1)assert(raisedBudgetAfterWake);}maxGap=Math.max(maxGap,p.physics.maxJointError);});const after=f.civilians.getPeople()[0];
 assert(sawWake);assert(before.z-after.z>1);assert(maxGap<.3);return{displacement:before.z-after.z,maxGap,allLimbsWoke:sawWake,raisedBudgetWithinOneStep:raisedBudgetAfterWake};
});
test('Different active corpses keep mutual collisions while excluding only their own overlapping limbs',()=>{
 const f=fixture({count:2});for(const p of f.civilians.getPeople())f.civilians.damage(p.id,100,{direction:V(0,0,1)});
 const a=f.people[0].physical.records,b=f.people[1].physical.records;
 for(const record of b){record.body.position.x-=3;record.body.aabbNeedsUpdate=true;}
 const first=[],second=[];f.sim.world.broadphase.collisionPairs(f.sim.world,first,second);
 const ownIds=new Set(a.map(r=>r.body.id)),otherIds=new Set(b.map(r=>r.body.id));let mutual=0;
 for(let i=0;i<first.length;i++){const aa=ownIds.has(first[i].id),ab=ownIds.has(second[i].id),ba=otherIds.has(first[i].id),bb=otherIds.has(second[i].id);assert(!(aa&&ab||ba&&bb));if(aa&&bb||ba&&ab)mutual++;}
 assert(mutual>0);
 for(const p of f.people)p.physical.ragdoll.simplify();
 const retiredA=[],retiredB=[];f.sim.world.broadphase.collisionPairs(f.sim.world,retiredA,retiredB);let retiredMutual=0;
 for(let i=0;i<retiredA.length;i++){const a=retiredA[i].userData,b=retiredB[i].userData;if(a?.type==='civilian-ragdoll'&&b?.type==='civilian-ragdoll'){assert.notEqual(a.civilianId,b.civilianId,'retired compound collided with its own held umbrella');retiredMutual++;}}
 assert(retiredMutual>0);return{mutualBroadphasePairs:mutual,retiredMutualPairs:retiredMutual,ownLimbAndUmbrellaPairs:0};
});
test('Retirement caps joints, preserves airborne pose and momentum, and keeps simplified bodies dynamic',()=>{
 const f=fixture({count:27});
 // Begin with an elevated authored pose over the unchanged production floor.
 for(const p of f.people){for(const part of p.parts){part.matrix.elements[13]+=4;f.mesh.setMatrixAt(part.index,part.matrix);}p.bodyBox.translate(V(0,4,0));for(const joint of Object.values(p.gait.getState().jointPositions))joint.y+=4;}
 const before=f.mesh.instanceMatrix.array.slice();
 for(const p of f.civilians.getPeople())f.civilians.damage(p.id,100,{direction:V(0,0,1),cause:'vehicle',speed:18});f.civilians.update(0,0);
 const state=f.civilians.getState();assert.equal(state.activeRagdolls,24);assert.equal(state.activeCorpseBodies,294);assert.equal(state.ragdollJoints,240);assert.equal(f.sim.world.constraints.length,240);assert.equal(state.dead,27);assert.equal(state.simplifiedCorpses,3);
 let matrixError=0;for(let i=0;i<before.length;i++)matrixError=Math.max(matrixError,Math.abs(before[i]-f.mesh.instanceMatrix.array[i]));assert(matrixError<1e-6);
 for(const p of f.people.slice(0,3)){assert(p.physical.ragdoll.getState().simplified);assert(p.bodyBox.min.y>4);assert(p.physical.records.every(r=>r.body.collisionFilterGroup===1&&r.body.type===CANNON.Body.DYNAMIC));assert(Math.abs(p.physical.records[0].body.velocity.z-14.94)<1e-8);}
 const groups=f.people.slice(3).map(p=>p.physical.ragdoll.collisionGroup);assert.equal(new Set(groups).size,24);
 advance(f,18);const retired=f.civilians.getPeople()[0];assert(retired.bodyBounds.min.y<.12&&retired.bodyBounds.min.y>-.02);assert(retired.physics.sleeping);
 assert(f.civilians.impulse(retired.id,V(0,1,0),V(retired.x,retired.y,retired.z),45));advance(f,.05);assert(!f.civilians.getPeople()[0].physics.sleeping);
 f.sim.reset();assert.equal(f.sim.world.constraints.length,0);return{activeAssemblies:state.activeRagdolls,activeBodies:state.activeCorpseBodies,joints:state.ragdollJoints,simplified:state.simplifiedCorpses,matrixError,retiredRestY:retired.bodyBounds.min.y};
});
test('Joint-budget retirement prefers a settled corpse and preserves elevated support without lowering it',()=>{
 const f=fixture({count:25}),ledge=new CANNON.Body({mass:0,material:f.sim.physicsMaterial});ledge.addShape(new CANNON.Box(new CANNON.Vec3(1,.4,4)));ledge.position.set(38,1,0);f.sim.world.addBody(ledge);
 const supported=f.people[1];for(const part of supported.parts)part.matrix.elements[13]+=1.4;supported.bodyBox.translate(V(0,1.4,0));for(const joint of Object.values(supported.gait.getState().jointPositions))joint.y+=1.4;
 f.civilians.damage(f.people[0].id,100,{direction:V(0,0,1)});
 f.civilians.damage(supported.id,100,{direction:V(0,0,1)});advance(f,18);assert(supported.physical.ragdoll.getState().sleeping);
 const oldest=f.civilians.getPeople()[0];f.civilians.impulse(oldest.id,V(0,1,0),V(oldest.x,oldest.y,oldest.z),45);assert(!f.people[0].physical.ragdoll.getState().sleeping);
 const bottom=supported.bodyBox.min.y;assert(bottom>1.3);
 for(const p of f.people.filter(p=>p.alive))f.civilians.damage(p.id,100,{direction:V(0,0,1),cause:'vehicle',speed:18});f.civilians.update(0,f.time);
 assert(supported.physical.ragdoll.getState().simplified);assert(Math.abs(supported.bodyBox.min.y-bottom)<1e-6);assert(supported.physical.ragdoll.getState().sleeping);
 assert(f.people[0].physical.ragdoll.getState().articulated);
 assert.equal(f.civilians.getState().activeRagdolls,24);return{supportHeight:1.4,beforeBottom:bottom,afterBottom:supported.bodyBox.min.y};
});
test('Production update raises the solver budget on death and wake, restoring seven after rest and reset',()=>{
 const f=fixture();advance(f,1/60);assert.equal(f.sim.world.solver.iterations,7);
 f.civilians.damage('CIV-001',100,{direction:V(0,0,1)});assert(f.civilians.needsArticulatedSolver());advance(f,1/60);assert.equal(f.sim.world.solver.iterations,12);
 advance(f,18);assert(!f.civilians.needsArticulatedSolver());advance(f,1/60);assert.equal(f.sim.world.solver.iterations,7);
 const p=f.civilians.getPeople()[0];f.civilians.impulse(p.id,V(0,1,0),V(p.x,p.y,p.z),45);assert(f.civilians.needsArticulatedSolver());advance(f,1/60);assert.equal(f.sim.world.solver.iterations,12);
 f.sim.reset();assert(!f.civilians.needsArticulatedSolver());assert.equal(f.sim.world.solver.iterations,7);
 return{neutral:7,death:12,sleeping:7,explicitWake:12,reset:7};
});
test('Every flat-boot and calf shape preserves its exact physical pose during retirement',()=>{
 const f=fixture({bodyPieces:pieces.filter(p=>!p.umbrella)});f.people[0].speed=.45;advance(f,50/60);f.civilians.damage('CIV-001',100,{direction:V(0,0,1)});
 function corners(){const out=[];for(const r of f.people[0].physical.records)for(let i=0;i<r.body.shapes.length;i++){const b=r.body,shape=b.shapes[i],q=b.quaternion.mult(b.shapeOrientations[i]),o=b.quaternion.vmult(b.shapeOffsets[i]);o.vadd(b.position,o);for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=q.vmult(new CANNON.Vec3(x*shape.halfExtents.x,y*shape.halfExtents.y,z*shape.halfExtents.z));v.vadd(o,v);out.push(v);}}return out;}
 const before=corners();assert.equal(before.length,13*8);assert(Math.min(...before.map(p=>p.y))>=.057-1e-8);
 f.people[0].physical.ragdoll.simplify();const after=corners();assert.equal(after.length,before.length);let error=0;for(let i=0;i<before.length;i++)error=Math.max(error,before[i].distanceTo(after[i]));assert(error<1e-8);
 return{retainedShapes:13,maximumWorldCornerError:error,minimumInitialShapeY:Math.min(...before.map(p=>p.y))};
});
for(const f of fixtures){f.civilians.reset();f.sim.dispose();}
const report={checkedAtUTC:new Date().toISOString(),passed:results.every(r=>r.pass),method:'Actual86-piece authored civilian template, production Cannon world/conditional12-awake7-asleep solver at60Hz, real street shapes and accepted-motion kinematic car contacts; no browser overrides or scripted fall animation.',physicsModel:{massKg:68,segments:11,joints:10,maxArticulatedAssemblies:24,retirement:'Persistent movable compound plus separate umbrella, current pose and linear momentum retained; angular momentum uses Cannon box-inertia approximation.',limits:'Coarse voxel box contacts; same-person overlapping limb/umbrella collisions excluded. A shared upward-momentum guard bounds energy injected by a position-controlled kinematic car; this is a game physics model, not human biomechanics.'},results};
if(process.env.CIVILIAN_RAGDOLL_REPORT)fs.writeFileSync(process.env.CIVILIAN_RAGDOLL_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
