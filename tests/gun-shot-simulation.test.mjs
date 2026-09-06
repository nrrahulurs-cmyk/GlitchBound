import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSimulation} from '../src/simulation.js';
import {createCivilianSystem} from '../src/civilians.js';
const v=(x,y,z)=>new THREE.Vector3(x,y,z),results=[],fixtures=[];
function fixture(options={}) {
 const pieces=[{x:0,y:1.18,z:0,sx:.5,sy:.72,sz:.3,c:'#338899'},{x:0,y:.58,z:0,sx:.42,sy:.87,sz:.24,c:'#223344'},{x:0,y:1.72,z:0,sx:.32,sy:.32,sz:.3,c:'#ddaa88'}];
 const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial(),mesh=new THREE.InstancedMesh(geometry,material,pieces.length),scene=new THREE.Scene(),events=[];
 const civilians=createCivilianSystem({people:[{x:35,z:0,scale:1,speed:0,phase:0,minZ:-100,maxZ:100,pieces}],mesh,colliders:options.colliders||[],groundHeightAt:()=>.057,bounds:{minX:-100,maxX:100,minZ:-150,maxZ:100}});
 const sim=createSimulation({scene,camera:new THREE.PerspectiveCamera(),civilians,groundHeightAt:()=>.057,...options,onEvent:e=>events.push(e)});
 const f={sim,scene,events,civilians,geometry,material};fixtures.push(f);return f;
}
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const nearVector=(a,b,epsilon=1e-6)=>assert.ok(a.distanceTo(b)<epsilon,`${a.toArray()} != ${b.toArray()}`);
function spheres(scene){let count=0;scene.traverse(o=>{if(o.geometry?.type==='SphereGeometry')count++;});return count;}
function test(name,run){run();results.push({test:name,pass:true});}
try {
 test('Pure camera trace does not damage, emit events, spawn VFX, or mutate caller vectors',()=>{
  const f=fixture(),origin=v(35,1.18,8),direction=v(0,0,-7),before=f.sim.getState(),sceneCount=f.scene.children.length;
  const hit=f.sim.traceShot(origin,direction);assert.equal(hit.targetType,'civilian');assert.equal(hit.target.id,'CIV-001');
  nearVector(origin,v(35,1.18,8));nearVector(direction,v(0,0,-7));assert.equal(f.events.length,0);assert.equal(f.scene.children.length,sceneCount);assert.deepEqual(f.sim.getState(),before);
  hit.point.set(999,999,999);assert(f.sim.traceShot(origin,direction).point.z<1);
 });
 test('Exact offset muzzle converges on camera-selected body point and preserves 60-damage, homicide and reset semantics',()=>{
  const f=fixture(),eye=v(35,1.18,8),direction=v(0,0,-1),muzzle=v(35.47,.94,7.25),aim=f.sim.traceShot(eye,direction).point;
  const first=f.sim.shoot(eye,direction,{muzzleOrigin:muzzle});nearVector(first.origin,muzzle);nearVector(first.aimPoint,aim);nearVector(first.point,aim);near(first.direction.length(),1);assert.equal(first.obstructed,false);
  nearVector(first.origin.clone().addScaledVector(first.direction,first.distance),first.point);assert.equal(f.civilians.getPeople()[0].health,40);
  assert.equal(f.sim.shoot(eye,direction,{muzzleOrigin:muzzle}).killed,true);assert.equal(f.sim.getState().wantedLevel,3);assert.equal(f.sim.getState().civilianCasualties,1);assert.equal(f.events.filter(e=>e.type==='shot').length,2);assert.equal(spheres(f.scene),0);
  f.sim.reset();assert.equal(f.civilians.getPeople()[0].health,100);assert.equal(f.sim.getState().wantedLevel,0);
 });
 test('Camera-clear target is protected by a thin obstacle on the actual muzzle trajectory',()=>{
  const f=fixture({streetColliders:[{id:'test-pole',x:35.5,y:1.5,z:6.7,sx:.22,sy:3,sz:.24,ry:0}]}),eye=v(35,1.18,8),dir=v(0,0,-1),muzzle=v(35.6,1.18,7.4);
  assert.equal(f.sim.traceShot(eye,dir).targetType,'civilian');const hit=f.sim.shoot(eye,dir,{muzzleOrigin:muzzle});assert.equal(hit.targetType,'street-solid');assert.equal(hit.obstructed,true);assert.equal(hit.hit,false);assert.equal(f.civilians.getPeople()[0].health,100);assert.equal(spheres(f.scene),0);
  nearVector(hit.origin.clone().addScaledVector(hit.direction,hit.distance),hit.point);
 });
 test('Eye-to-muzzle cover guard prevents a barrel clipping through a thin wall from damaging the person beyond it',()=>{
  const f=fixture({colliders:[{x:35.37,y:1.2,z:7.5,sx:.25,sy:.9,sz:.1}]}),eye=v(35,1.18,8),dir=v(0,0,-1),muzzle=v(35.6,1.18,7.2);
  assert.equal(f.sim.traceShot(eye,dir).targetType,'civilian');const hit=f.sim.shoot(eye,dir,{muzzleOrigin:muzzle});assert.equal(hit.targetType,'wall');assert.equal(hit.obstructed,true);assert.equal(f.civilians.getPeople()[0].health,100);nearVector(hit.origin,muzzle);near(hit.point.z,7.55);
  nearVector(hit.origin.clone().addScaledVector(hit.direction,hit.distance),hit.point);
 });
 test('A muzzle or eye contained in cover stays blocked at zero distance',()=>{
  const f=fixture({colliders:[{x:35.37,y:1.2,z:7.5,sx:.25,sy:.9,sz:.1}]}),muzzle=v(35.37,1.18,7.5),dir=v(0,0,-1);
  const trace=f.sim.traceShot(muzzle,dir);assert.equal(trace.targetType,'wall');near(trace.distance,0);nearVector(trace.point,muzzle);
  const shot=f.sim.shoot(v(35,1.18,8),dir,{muzzleOrigin:muzzle});near(shot.distance,0);nearVector(shot.point,muzzle);assert.equal(shot.obstructed,true);assert.equal(f.civilians.getPeople()[0].health,100);
  const eyeShot=f.sim.shoot(muzzle,dir,{muzzleOrigin:v(35,1.18,7.2)});near(eyeShot.distance,0);assert.equal(eyeShot.targetType,'wall');assert.equal(f.civilians.getPeople()[0].health,100);
 });
 test('Eye inside opaque cover cannot damage a crate containing the clipped muzzle',()=>{
  const f=fixture({colliders:[{x:-11.1,y:1.1,z:-14.9,sx:1,sy:2,sz:.2}]}),eye=v(-11.1,1.1,-14.9),muzzle=v(-11.1,1.1,-17),dir=v(0,0,-1);
  const contained=f.sim.traceShot(muzzle,dir);assert.equal(contained.targetType,'crate');near(contained.distance,0);const health=contained.target.health;
  const hit=f.sim.shoot(eye,dir,{muzzleOrigin:muzzle});assert.equal(hit.targetType,'wall');assert.equal(hit.hit,false);assert.equal(hit.obstructed,true);near(hit.distance,0);nearVector(hit.point,muzzle);assert.equal(contained.target.health,health);assert.equal(f.events.filter(e=>e.type==='hit').length,0);
 });
 test('Ground rays hit the physical floor and raised pavement top with upward normals',()=>{
  const f=fixture({groundSurfaces:[{id:'raised-ground',x:40,y:.1825,z:8,sx:4,sy:.365,sz:4,kind:'pavement'}]});
  const base=f.sim.traceShot(v(35,2.5,8),v(0,-1,0));assert.equal(base.targetType,'ground');near(base.point.y,.057);nearVector(base.normal,v(0,1,0));
  const slab=f.sim.traceShot(v(40,2.5,8),v(0,-1,0));assert.equal(slab.targetType,'ground');near(slab.point.y,.365);near(slab.distance,2.135);nearVector(slab.normal,v(0,1,0));
 });
 test('Rotated street boxes yield their actual sloped face and a world-space outward normal',()=>{
  const f=fixture({streetColliders:[{id:'angled-metal',x:35,y:1.5,z:4,sx:1,sy:3,sz:.2,ry:Math.PI/4}]});
  const hit=f.sim.traceShot(v(35,1.18,8),v(0,0,-1));assert.equal(hit.targetType,'street-solid');near(hit.point.z,4+Math.SQRT2*.1);nearVector(hit.normal,v(Math.SQRT1_2,0,Math.SQRT1_2));
 });
 test('Player bullets and bullet-triggered drone, crate and delayed chain deaths create no line or sphere effects',()=>{
  const f=fixture();for(let i=0;i<3;i++)f.sim.shoot(v(0,4,-20),v(0,0,-1));assert.equal(f.sim.getState().kills,1);
  for(let i=0;i<2;i++)f.sim.shoot(v(-11.1,1,-13),v(0,0,-1));
  for(let i=0;i<90;i++)f.sim.update(1/60,i/60,{position:v(90,1,90),damage(){}});
  assert.equal(spheres(f.scene),0);assert(f.events.filter(e=>e.type==='shot').length===5);
  let playerLines=0;f.scene.traverse(o=>{if(o.isLine&&o.material.color.getHex()===0x98ffff)playerLines++;});assert.equal(playerLines,0);
  const emp=fixture();emp.sim.emp(v(35,1,8));assert(spheres(emp.scene)>0,'EMP retains its distinct field visualization');
 });
 test('Misses keep the exact muzzle origin and finite unit trajectory without false target hits',()=>{
  const f=fixture(),eye=v(70,3,70),dir=v(0,.2,1).normalize(),muzzle=v(70.4,2.8,69.4),shot=f.sim.shoot(eye,dir,{muzzleOrigin:muzzle});
  assert.equal(shot.hit,false);assert.equal(shot.targetType,'');nearVector(shot.origin,muzzle);near(shot.direction.length(),1);nearVector(shot.point,shot.aimPoint);nearVector(shot.origin.clone().addScaledVector(shot.direction,shot.distance),shot.point);
 });
 test('Live service machinery blocks bullets at its actual rotated pose and leaves the path open when retracted',()=>{
  let fixtures=[{id:'SERVICE-TEST-TOOL',x:35,y:1.5,z:4,sx:1,sy:3,sz:.2,ry:Math.PI/4}];
  const f=fixture({getExternalSolids:()=>fixtures}),eye=v(35,1.18,8),dir=v(0,0,-1);
  const contact=f.sim.traceShot(eye,dir);assert.equal(contact.targetType,'street-solid');near(contact.point.z,4+Math.SQRT2*.1);nearVector(contact.normal,v(Math.SQRT1_2,0,Math.SQRT1_2));
  const shot=f.sim.shoot(eye,dir);assert.equal(shot.hit,false);assert.equal(f.civilians.getPeople()[0].health,100);assert(f.sim.getSolidProps().some(p=>p.id==='SERVICE-TEST-TOOL'));
  const inside=f.sim.traceShot(v(35,1.18,4),dir);assert.equal(inside.targetType,'street-solid');near(inside.distance,0);
  fixtures=[{...fixtures[0],x:37}];assert.equal(f.sim.traceShot(eye,dir).targetType,'civilian');
  fixtures=[];assert(!f.sim.getSolidProps().some(p=>p.id==='SERVICE-TEST-TOOL'));assert.equal(f.sim.traceShot(eye,dir).targetType,'civilian');
 });
 const report={status:'passed',checkedAtUTC:new Date().toISOString(),method:'Production simulation and civilian voxel/physics service; no injected damage. Independent geometry fixtures exercise camera/muzzle parallax, containment, near-cover checks, floor/slab normals, and actual effect geometry through delayed chain explosions.',results};
}finally{for(const f of fixtures){f.sim.dispose();f.geometry.dispose();f.material.dispose();}}

console.log(`Completed gun-shot-simulation.test.mjs: ${results.length} checks.`);
