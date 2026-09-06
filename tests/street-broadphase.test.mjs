import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';import * as CANNON from 'cannon-es';
import {StreetBroadphase} from '../src/street-broadphase.js';import {LegacyStreetBroadphase} from './fixtures/street-broadphase-b5707d3.mjs';
import {createCityLayout} from '../src/city-layout.js';import {createStreetCollisionLayout} from '../src/street-collisions.js';import {createCivilianSystem} from '../src/civilians.js';import {createSimulation} from '../src/simulation.js';
import {getKinematicPoseController} from '../src/kinematic-pose.js';
const results=[],D=CANNON.Body.DYNAMIC,K=CANNON.Body.KINEMATIC,S=CANNON.Body.STATIC;
const key=(a,b)=>a.id<b.id?a.id+','+b.id:b.id+','+a.id;
const allowed=(a,b)=>(a.type===D||b.type===D)&&!(a.userData?.type==='civilian-ragdoll'&&b.userData?.type==='civilian-ragdoll'&&a.userData.civilianId!=null&&a.userData.civilianId===b.userData.civilianId);
function pairs(bp,world,filter=false){const a=[],b=[];bp.collisionPairs(world,a,b);const result=a.flatMap((body,i)=>!filter||allowed(body,b[i])?[key(body,b[i])]:[]);assert.equal(new Set(result).size,result.length,'Duplicate candidate pair');return result.sort();}
function orderedPairs(bp,world){const a=[],b=[];bp.collisionPairs(world,a,b);return a.map((body,i)=>body.id+'>'+b[i].id);}
function oracles(world){const current=new StreetBroadphase(),old=new LegacyStreetBroadphase(),naive=new CANNON.NaiveBroadphase();naive.useBoundingBoxes=true;let snapshots=0,totalPairs=0;return{current,old,naive,check(){const expected=pairs(old,world),reference=pairs(naive,world,true),actual=pairs(current,world);assert.deepEqual(expected,reference,'Legacy grid differs from policy-filtered Cannon Naive');assert.deepEqual(actual,reference,'New grid lost or added a candidate pair');assert.deepEqual(orderedPairs(current,world),orderedPairs(old,world),'Ordered pair orientation differs from legacy first visit');snapshots++;totalPairs+=actual.length;return actual.length},stats:()=>({snapshots,totalPairs,orderedPairsIdentical:true})};}
function box(world,{x=0,y=1,z=0,sx=1,sy=1,sz=1,type=D,mass=1,yaw=0,group=1,mask=-1}={}){const body=new CANNON.Body({mass:type===D?mass:0,type,collisionFilterGroup:group,collisionFilterMask:mask});body.addShape(new CANNON.Box(new CANNON.Vec3(sx/2,sy/2,sz/2)));body.position.set(x,y,z);body.quaternion.setFromEuler(.13,yaw,.07);world.addBody(body);return body;}
function test(name,fn){try{const evidence=fn();results.push({name,passed:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name,error.message);}}
test('Random rotated multicell bodies retain every unordered pair against legacy and CannonNaive',()=>{
 const world=new CANNON.World();let seed=1776;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),bodies=[];
 for(let i=0;i<170;i++)bodies.push(box(world,{x:(random()-.5)*90,y:random()*10,z:(random()-.5)*90,sx:.08+random()*28,sy:.1+random()*7,sz:.08+random()*28,yaw:random()*6.28,type:i<100?S:i<150?D:K,group:1<<(i%3),mask:i%7===0?1:-1}));
 const check=oracles(world);for(let frame=0;frame<25;frame++){for(const b of bodies)if(b.type!==S){b.position.x+=random()-.5;b.position.z+=random()-.5;b.aabbNeedsUpdate=true;if(b.type===D&&frame%7===0)b.sleep();else if(frame%7===1)b.wakeUp();}check.check();}return check.stats();
});
test('Infinite ground, global moving boxes and sleeping receivers obey canonical ownership',()=>{
 const world=new CANNON.World(),floor=new CANNON.Body({mass:0});floor.addShape(new CANNON.Plane());floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
 box(world,{x:-100,y:0,z:-100,sx:100000,sy:2,sz:100000});const sleeping=box(world,{x:16,y:1,z:16});sleeping.sleep();const car=box(world,{x:16,y:1,z:16,type:K,sx:3,sz:5});box(world,{x:-16,z:0,sx:32,sz:32,type:S});
 const check=oracles(world);check.check();assert(pairs(check.current,world).includes(key(sleeping,car)),'Kinematic contact cannot see a sleeping dynamic receiver');car.sleep();check.check();car.wakeUp();check.check();return check.stats();
});
test('Collision masks and same-civilian umbrella exclusions preserve cross-corpse contacts',()=>{
 const world=new CANNON.World(),parts=[];for(let i=0;i<8;i++){const body=box(world,{x:i*.05,z:0,type:i===7?K:D,group:i<3?4:1,mask:i<3?~4:-1});if(i<7)body.userData={type:'civilian-ragdoll',civilianId:i<5?'CIV-001':'CIV-002'};parts.push(body);}const check=oracles(world);check.check();const set=pairs(check.current,world);assert(!set.includes(key(parts[3],parts[4])));assert(set.includes(key(parts[4],parts[5])));return check.stats();
});
test('Remove, readd, type conversion, rotated static relocation and external AABB refresh stay coherent',()=>{
 const world=new CANNON.World(),wall=box(world,{x:0,z:0,type:S,sx:40,sz:.12}),moving=box(world,{x:0,z:0}),car=box(world,{x:0,z:0,type:K});const check=oracles(world);check.check();
 world.removeBody(wall);check.check();world.addBody(wall);check.check();wall.position.x=-42;wall.quaternion.setFromEuler(0,1.2,0);wall.aabbNeedsUpdate=true;check.check();car.type=D;car.mass=1000;car.updateMassProperties();check.check();car.type=S;car.mass=0;car.updateMassProperties();car.aabbNeedsUpdate=true;check.check();
 // An external query may consume the dirty flag before collisionPairs. The
 // optimized cache also checks changed AABB extents, matching Cannon directly.
 wall.position.copy(moving.position);wall.aabbNeedsUpdate=true;wall.updateAABB();assert.deepEqual(pairs(check.current,world),pairs(check.naive,world,true));
 return{...check.stats(),externalAabbRefresh:true};
});
test('Accepted moving kinematics wake and push sleeping dynamics through real world contacts',()=>{
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,0,0)});world.broadphase=new StreetBroadphase();world.allowSleep=true;
 const receiver=box(world,{x:0,y:1,z:0,mass:16}),car=box(world,{x:0,y:1,z:1.75,type:K,sx:2,sy:2,sz:3}),controller=getKinematicPoseController(world);receiver.sleep();
 controller.setTarget(car,{position:car.position,quaternion:car.quaternion,velocity:new CANNON.Vec3(0,0,-8)});world.step(1/60);const first=receiver.sleepState;world.step(1/60);assert.notEqual(receiver.sleepState,CANNON.Body.SLEEPING);assert(receiver.velocity.length()>.1);assert.equal(car.position.z,1.75);controller.clearContactHints(car);controller.dispose();return{firstSleepState:first,afterSleepState:receiver.sleepState,speed:receiver.velocity.length(),carPosition:car.position.toArray()};
});
test('Production city with24 articulated deaths retains pairs through motion, sleep, wake and reset',()=>{
 const layout=createCityLayout(),street=createStreetCollisionLayout(layout),source=fs.readFileSync(new URL('../src/city.js',import.meta.url),'utf8');
 const people=new Function('districts',source.slice(source.indexOf('  let randomState='),source.indexOf('  const pedestrianCount='))+';return people;')(layout.districts),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),people.reduce((n,p)=>n+p.pieces.length,0));
 const groundHeightAt=(x,z)=>street.groundSurfaces.reduce((height,b)=>{const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z;return Math.abs(dx*c-dz*s)<=b.sx/2&&Math.abs(dx*s+dz*c)<=b.sz/2?Math.max(height,b.y+b.sy/2):height;},.057);
 const civilians=createCivilianSystem({people,mesh,colliders:[...layout.colliders,...street.staticColliders],groundHeightAt,bounds:layout.bounds}),simulation=createSimulation({scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),colliders:layout.colliders,streetColliders:street.staticColliders,groundSurfaces:street.groundSurfaces,dynamicProps:street.dynamicProps,groundHeightAt,civilians});
 const selected=civilians.getPeople().sort((a,b)=>Math.hypot(a.x,a.z+170)-Math.hypot(b.x,b.z+170)).slice(0,24);for(const p of selected)civilians.damage(p.id,100,{cause:'gun',direction:{x:.35,y:0,z:1}});const world=simulation.world,bodiesAtLoad=world.bodies.length,check=oracles(world);check.check();
 const player={position:new THREE.Vector3(0,1.8,-170),damage(){},inVehicle:false};for(let i=0;i<120;i++){simulation.update(1/60,i/60,player);civilians.update(1/60,i/60,player.position);if(i%20===0)check.check();}
 const timing=(bp,iterations=100)=>{for(let i=0;i<20;i++)pairs(bp,world);const a=[],b=[],t=performance.now();for(let i=0;i<iterations;i++){a.length=b.length=0;bp.collisionPairs(world,a,b);}return(performance.now()-t)/iterations;};
 const oldMs=timing(check.old),newMs=timing(check.current);for(const body of world.bodies)if(body.type===D)body.sleep();check.check();const corpse=world.bodies.find(b=>b.userData?.type==='civilian-ragdoll');corpse.wakeUp();check.check();simulation.reset();check.check();const stats={...check.stats(),bodiesAtLoad,selected:24,meanCollisionPairsMs:{legacy:oldMs,optimized:newMs,ratio:newMs/oldMs},note:'Bounded CPU microbenchmark on one settled-in-progress production snapshot; this is not browser FPS.'};
 simulation.dispose();mesh.geometry.dispose();mesh.material.dispose();return stats;
});
const report={passed:results.every(r=>r.passed),checkedAtUTC:new Date().toISOString(),oracleCheckpoint:'b5707d3',results};if(process.env.STREET_BROADPHASE_REPORT)fs.writeFileSync(process.env.STREET_BROADPHASE_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
