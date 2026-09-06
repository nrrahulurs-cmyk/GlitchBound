import assert from 'node:assert/strict';import fs from 'node:fs';import * as THREE from 'three';
import {createCivilianSystem} from '../src/civilians.js';import{createCivilianMotion}from'../src/civilian-motion.js';import{civilianBodyRadius}from'../src/civilian-navigation.js';
const source=fs.readFileSync(new URL('../src/city.js',import.meta.url),'utf8'),template=source.slice(source.indexOf('  function pedestrianTemplate('),source.indexOf('  const people=[];'));
const pieces=umbrella=>new Function('pick',template+';return pedestrianTemplate("#445566",'+umbrella+');')(a=>a[0]),results=[];
function test(name,fn){try{const evidence=fn();results.push({name,passed:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name,error.message);}}
function fixture(specs,colliders=[]){const people=specs.map(p=>({scale:1,phase:0,minZ:-30,maxZ:30,...p,pieces:pieces(p.umbrella||false)})),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),people.reduce((n,p)=>n+p.pieces.length,0)),system=createCivilianSystem({people,mesh,colliders});return{people,mesh,system};}
function run(f,seconds,dt=1/60){let minimumGap=Infinity,maxStep=0;const paths=f.people.map(()=>0),modes=new Set(),previous=f.people.map(p=>({x:p.x,z:p.z}));
 for(let i=0;i<Math.ceil(seconds/dt);i++){f.system.update(dt,i*dt,{x:200,z:200});for(let a=0;a<f.people.length;a++){const p=f.people[a],d=Math.hypot(p.x-previous[a].x,p.z-previous[a].z);paths[a]+=d;maxStep=Math.max(maxStep,d);previous[a]={x:p.x,z:p.z};modes.add(p.crowdMode);for(let b=a+1;b<f.people.length;b++){const q=f.people[b];minimumGap=Math.min(minimumGap,Math.hypot(p.x-q.x,p.z-q.z)-p.crowdRadius-q.crowdRadius);}}}
 assert(minimumGap>=-1e-5,'Living body envelopes overlap '+minimumGap);assert(maxStep<=2.61*dt,'Motion exceeds accepted velocity bound');for(let i=0;i<f.people.length;i++)assert(Math.abs(f.people[i].gait.getState().distance-paths[i])<1e-7,'Gait phase includes rejected translation');return{minimumGap,maxStep,paths,modes:[...modes],final:f.people.map(p=>({id:p.id,x:p.x,z:p.z,speed:p.speed}))};}
test('Non-umbrella envelope contains all rotating body voxels during walk, flee, reversal and stop',()=>{
 let largestRatio=0,corners=0;const matrix=new THREE.Matrix4();
 for(const umbrella of[false,true])for(const scale of[.84,1,1.12])for(const dt of[1/60,1/15]){const body=pieces(umbrella),radius=civilianBodyRadius(body,scale),gait=createCivilianMotion({scale,umbrella});let x=0,z=0;gait.reset({x,z});
  for(let i=0;i<Math.ceil(8/dt);i++){const t=i*dt,v=t<2?[0,.6]:t<4?[2.6,0]:t<6?[-2.6,0]:[0,0],plan=gait.plan(dt,{vx:v[0],vz:v[1],fleeing:t>=2&&t<6});x+=plan.dx;z+=plan.dz;gait.update(dt,{x,z,groundY:.057,fleeing:t>=2&&t<6});
   for(const piece of body)if(!piece.umbrella){gait.writePartMatrix(piece,matrix);const e=matrix.elements;for(const a of[-.5,.5])for(const b of[-.5,.5])for(const c of[-.5,.5]){const px=e[0]*a+e[4]*b+e[8]*c+e[12],pz=e[2]*a+e[6]*b+e[10]*c+e[14],ratio=Math.hypot(px-x,pz-z)/radius;largestRatio=Math.max(largestRatio,ratio);corners++;assert(ratio<=1+1e-8,'Rotating voxel exceeds reserved body envelope');}}
  }
 }return{largestRatio,corners,unitBodyRadius:civilianBodyRadius(pieces(false),1)};
});
test('Opposing walkers pass on separate wall-clear sides at60 and15Hz',()=>{
 const cases=[];for(const dt of[1/60,1/15]){const f=fixture([{x:0,z:-3,speed:.7},{x:0,z:3,speed:-.7}]),proof=run(f,14,dt);assert(f.people[0].z>2&&f.people[1].z< -2,'Opposing walkers deadlocked');assert(proof.modes.includes('pass'));cases.push({dt,...proof});}return{cases};
});
test('A faster following walker eases down before the leader without intersection',()=>{
 const f=fixture([{x:0,z:0,speed:.3},{x:0,z:-4,speed:1.1}]),proof=run(f,14);assert(f.people[0].z>3);assert(f.people[1].z>1);assert(f.people[1].z<f.people[0].z-1.45);assert(proof.modes.includes('follow'));return proof;
});
test('Narrow head-on corridor gives deterministic right-of-way and a bounded retreat',()=>{
 const walls=[-1,1].map(side=>({x:side*.8,y:1,z:0,sx:.2,sy:2,sz:40})),f=fixture([{x:0,z:-3,speed:.65},{x:0,z:3,speed:-.65}],walls),proof=run(f,16);
 assert(proof.modes.includes('reverse'),'No one yielded the narrow corridor');assert(f.people[1].speed>0,'Later ID did not retain its retreat route');assert(f.people[0].z>2&&f.people[1].z>3,'Narrow lane remained deadlocked');assert(f.people.every(p=>Math.abs(p.x)<=.26001),'Passing crossed the corridor walls');return proof;
});
test('Crowd reservations prevent a stationary turn or faster crossing from entering a neighbor',()=>{
 const f=fixture([{x:0,z:0,speed:0},{x:0,z:2,speed:0},{x:-4,z:1,speed:0}]);f.people[1].fleeUntil=50;f.people[1].fleeX=0;f.people[1].fleeZ=-1;f.people[2].fleeUntil=50;f.people[2].fleeX=1;f.people[2].fleeZ=0;
 const proof=run(f,4,1/15);assert(proof.paths[0]===0,'Stationary civilian was displaced');assert(proof.paths[1]+proof.paths[2]>1,'Crossing crowd never progressed');return proof;
});
test('Larger authored body clearance is recorded and exactly restored on restart',()=>{
 const f=fixture([{x:0,z:0,speed:.6},{x:.8,z:0,speed:-.6},{x:0,z:1,speed:.2}]),initial=f.people.map(p=>[p.x,p.z]),audit=f.system.getNavigationState().spawnCorrections;
 assert(audit.length>=2);assert(audit.every(p=>p.resolved&&p.bodyRadius>.44));run(f,3);f.system.reset();assert.deepEqual(f.people.map(p=>[p.x,p.z]),initial);assert.deepEqual(f.system.getNavigationState().spawnCorrections,audit);return{corrections:audit};
});
test('Both route endpoints reverse intent once while inertial gait brakes and turns',()=>{
 const cases=[];for(const dt of[1/60,1/15])for(const sign of[-1,1]){const f=fixture([{x:0,z:sign*149.5,speed:sign*.806848994,minZ:-150,maxZ:150}]);let reversals=0,lastSign=sign,clampedFrames=0;
  for(let i=0;i<Math.ceil(8/dt);i++){f.system.update(dt,i*dt,{x:200,z:200});const p=f.people[0];assert(Math.abs(p.z)<=150+1e-8);if(Math.sign(p.speed)!==lastSign){reversals++;lastSign=Math.sign(p.speed);}if(Math.abs(Math.abs(p.z)-150)<1e-7)clampedFrames++;}
  assert.equal(reversals,1);assert(f.people[0].z*sign<146,'Civilian stuck at its route endpoint');cases.push({dt,sign,reversals,endpointSeconds:clampedFrames*dt,finalZ:f.people[0].z});
 }return{cases};
});
const report={passed:results.every(r=>r.passed),checkedAtUTC:new Date().toISOString(),results};if(process.env.CIVILIAN_CROWD_REPORT)fs.writeFileSync(process.env.CIVILIAN_CROWD_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
