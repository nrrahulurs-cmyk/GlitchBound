import {createCityPopulation,createPedestrianTemplate} from '../src/civilian-source.js';
import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {createCivilianNavigation} from '../src/civilian-navigation.js';
import {createSimulation} from '../src/simulation.js';
import {createCivilianSystem} from '../src/civilians.js';import {createCityLayout} from '../src/city-layout.js';import {createStreetCollisionLayout} from '../src/street-collisions.js';import{SCENE_PLACEMENTS}from'../src/asset-placements.js';
const results=[];
const pieces=createPedestrianTemplate('#334455',false);
const box=(x,z,sx=1,sz=1,ry=0,y=1,sy=2)=>({x,z,sx,sz,ry,y,sy});
function test(name,fn){try{const evidence=fn();results.push({name,passed:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name,error.message);}}
function fixture({colliders=[],people=[{x:0,z:-2,speed:.5}],groundHeightAt=()=>.057,bounds}={}){const citizens=people.map(p=>({scale:1,phase:0,minZ:-100,maxZ:100,...p,pieces})),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),citizens.length*pieces.length),system=createCivilianSystem({people:citizens,mesh,colliders,groundHeightAt,bounds});return{system,people:citizens,mesh};}
function advance(f,n){for(let i=0;i<n;i++)f.system.update(1/60,i/60,new THREE.Vector3(300,2,300));}

test('Circle clearance uses the rotated box and the grid includes its rotated endpoints',()=>{
 const nav=createCivilianNavigation({colliders:[box(8,8,12,.06,Math.PI/4)]});assert(nav.blocked(11.8,4.2,.3));assert(!nav.blocked(11.8,8,.3));assert(nav.blocked(8,8,.3));
 const tangent=createCivilianNavigation({colliders:[box(0,0)]});assert(!tangent.blocked(.9,.9,.4));assert(tangent.blocked(.75,.75,.4));return{rotatedEndpoint:true,outsideRotatedFootprint:true,roundedCornerClearance:true};
});
test('Small accepted substeps stop at thin barriers and allow sliding along solid shelves',()=>{
 const nav=createCivilianNavigation({colliders:[box(0,0,8,.03)]}),p={x:0,z:-2,scale:1};const moved=nav.move(p,0,8);assert(p.z<-.44);assert(moved.distance<1.6);assert(!nav.blocked(p.x,p.z,.44));
 const before={...p};nav.move(p,1,.8);assert(p.x>before.x+.8);assert(p.z<-.44);return{stoppedZ:p.z,slidX:p.x};
});
test('Overhead objects and low curbs respect actual support height while taller props block',()=>{
 const nav=createCivilianNavigation({colliders:[box(0,0,2,2,0,3,.2),box(3,0,2,2,0,.17,.24),box(6,0,2,2,0,.5,.9)]});assert(!nav.blocked(0,0));assert(!nav.blocked(3,0));assert(nav.blocked(6,0));
 const raised=createCivilianNavigation({colliders:[box(0,0,2,2,0,.27,.22)],groundHeightAt:()=>.165});assert(!raised.blocked(0,0));return{overheadClear:true,curbClear:true,tallFurnitureBlocked:true};
});
test('Dynamic bins, parked vehicles and fixtures refresh once per frame without teleporting living citizens',()=>{
 const f=fixture(),obstacle=box(0,0,1,1,Math.PI/3);let calls=0;f.system.setObstacleProvider(()=>{calls++;return[obstacle]},{resolveSpawns:false});advance(f,1);assert.equal(calls,2);
 const before=f.system.getPeople()[0];obstacle.x=before.x;obstacle.z=before.z;advance(f,1);const overlap=f.system.getPeople()[0];assert(Math.hypot(overlap.x-before.x,overlap.z-before.z)<.02,'A moving obstacle teleported a civilian');assert.equal(calls,3);
 obstacle.x=50;advance(f,120);assert(Math.abs(f.system.getPeople()[0].z-before.z)>.1);assert.equal(calls,123);return{providerCalls:calls,updateFrames:122,noPerFrameDepenetration:true};
});
test('Blocked ordinary walkers reverse, brake, and advance gait by accepted travel only',()=>{
 const f=fixture({colliders:[box(0,0,8,.05)]}),p=f.people[0];let min=-2,max=-2,previous={x:p.x,z:p.z},distance=0;
 for(let i=0;i<540;i++){f.system.update(1/60,i/60,new THREE.Vector3(300,2,300));distance+=Math.hypot(p.x-previous.x,p.z-previous.z);previous={x:p.x,z:p.z};min=Math.min(min,p.z);max=Math.max(max,p.z);assert(p.z<-.44);}
 assert(p.speed<0);assert(p.z<max-.6);assert(Math.abs(p.gait.getState().distance-distance)<1e-8);return{furthestZ:max,finalZ:p.z,acceptedDistance:distance,gaitDistance:p.gait.getState().distance};
});
test('Initialization and reset minimally resolve obstacle and crowd overlaps deterministically',()=>{
 const wall=box(0,0,1,1),f=fixture({colliders:[wall],people:[{x:0,z:0,speed:0},{x:0,z:0,speed:0},{x:4,z:0,speed:0}]});const first=f.system.getPeople();
 const nav=createCivilianNavigation({colliders:[wall]});assert(first.every(p=>!nav.blocked(p.x,p.z,.44)));assert(Math.hypot(first[0].x-first[1].x,first[0].z-first[1].z)>=.9);assert.equal(first[2].x,4);assert.equal(first[2].z,0);assert(Math.max(...f.system.getNavigationState().spawnCorrections.map(c=>c.distance))<1.1);
 f.system.reset();assert.deepEqual(f.system.getPeople().map(p=>[p.x,p.z]),first.map(p=>[p.x,p.z]));return{corrections:f.system.getNavigationState().spawnCorrections};
});
test('All284 authored citizens start and travel clear of real shelves, rotated solids and static vehicle placements',()=>{
 const layout=createCityLayout(),street=createStreetCollisionLayout(layout),colliders=[...layout.colliders,...street.staticColliders],surfaces=street.groundSurfaces;
 const groundHeightAt=(x,z)=>{let h=.057;for(const b of surfaces){const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z;if(Math.abs(dx*c-dz*s)<=b.sx/2&&Math.abs(dx*s+dz*c)<=b.sz/2)h=Math.max(h,b.y+b.sy/2);}return h;};
 const people=createCityPopulation({districts:layout.districts}).people,count=people.reduce((n,p)=>n+p.pieces.length,0),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),count),system=createCivilianSystem({people,mesh,colliders,groundHeightAt,bounds:layout.bounds});
 const vehicles=[SCENE_PLACEMENTS.interceptor,SCENE_PLACEMENTS.parkedCar].map(p=>({...p,y:p.y+p.sy/2})),props=[...street.dynamicProps,...vehicles];system.setObstacleProvider(()=>props);const nav=createCivilianNavigation({colliders,groundHeightAt,bounds:layout.bounds});nav.setObstacleProvider(()=>props);
 const initial=system.getPeople();for(const p of initial)assert(!nav.blocked(p.x,p.z,.44*p.scale,1.85*p.scale),'Spawn overlap '+p.id);for(let i=0;i<initial.length;i++)for(let j=i+1;j<initial.length;j++)assert(Math.hypot(initial[i].x-initial[j].x,initial[i].z-initial[j].z)>=.44*(initial[i].scale+initial[j].scale)+.0199,'Initial crowd overlap');
 let checks=0;const timing=[];for(let i=0;i<360;i++){const start=performance.now();system.update(1/60,i/60,new THREE.Vector3(0,2,25));timing.push(performance.now()-start);if(i%15===0)for(const p of system.getPeople()){assert(!nav.blocked(p.x,p.z,.44*p.scale,1.85*p.scale),'Trajectory enters solid '+p.id);checks++;}}
 const shelf=street.staticColliders.find(b=>b.sourceIndex&&layout.boxes[b.sourceIndex]?.detail==='street-frontage'&&b.y>.4&&b.y<1.4&&b.sy>.1);assert(shelf,'Actual shelf fixture missing');
 // Reproduce the recorded CIV-026 flight from the road toward the noodle-shop
 // goods. Its desired path enters real frontage; accepted movement must not.
 const start=system.getPeople().find(p=>p.id==='CIV-026');assert(nav.blocked(start.x-5,start.z-2.5,.44*start.scale,1.85*start.scale));system.damage(start.id,60,{direction:new THREE.Vector3(-1,0,-.5)});
 let fleeDistance=0,last=start;
 for(let i=0;i<360;i++){system.update(1/60,(360+i)/60,new THREE.Vector3(0,2,25));const p=system.getPeople().find(p=>p.id===start.id);assert(!nav.blocked(p.x,p.z,.44*p.scale,1.85*p.scale),'CIV-026 entered shelf during flight');fleeDistance+=Math.hypot(p.x-last.x,p.z-last.z);last=p;}
 assert(fleeDistance>1);assert(last.x>start.x-5);
 const audit=system.getNavigationState();assert(audit.spawnCorrections.every(c=>c.resolved));system.reset();const reset=system.getPeople();assert.deepEqual(reset.map(p=>[p.x,p.z]),initial.map(p=>[p.x,p.z]));
 return{citizens:initial.length,staticObstacles:colliders.length,trajectoryChecks:checks+360,shelfFlee:{id:start.id,distance:fleeDistance,start:[start.x,start.z],end:[last.x,last.z]},corrections:audit.spawnCorrections,meanUpdateMs:timing.reduce((a,b)=>a+b)/timing.length};
});
test('World restart restores destroyed obstacles before resolving original civilian spawns',()=>{
 const f=fixture({people:[{x:-11.1,z:-17,speed:0}]}),scene=new THREE.Scene();scene.add(f.mesh);
 const sim=createSimulation({scene,camera:new THREE.PerspectiveCamera(),civilians:f.system,groundHeightAt:()=>.057});
 try{
  f.system.setObstacleProvider(()=>sim.getSolidProps());const before=f.system.getPeople()[0];assert(Math.hypot(before.x+11.1,before.z+17)>.5);
  const origin=new THREE.Vector3(-11.1,5,-17),direction=new THREE.Vector3(0,-1,0);assert.equal(sim.traceShot(origin,direction).targetType,'crate');
  sim.shoot(origin,direction);sim.shoot(origin,direction);f.system.reset();const open=f.system.getPeople()[0];assert(Math.hypot(open.x+11.1,open.z+17)<1e-8);
  sim.reset();const restored=f.system.getPeople()[0];assert.deepEqual([restored.x,restored.z],[before.x,before.z]);
  return{destroyedAreaInitiallyClear:true,restoredSpawn:[restored.x,restored.z]};
 }finally{sim.dispose();f.mesh.geometry.dispose();f.mesh.material.dispose();}
});
const report={passed:results.every(r=>r.passed),checkedAtUTC:new Date().toISOString(),results};if(process.env.CIVILIAN_NAVIGATION_REPORT)fs.writeFileSync(process.env.CIVILIAN_NAVIGATION_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
