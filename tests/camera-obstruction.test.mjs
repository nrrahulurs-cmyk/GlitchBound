import assert from 'node:assert/strict';
import * as THREE from 'three';
import {resolveCameraBoom} from '../src/camera-obstruction.js';
import {createCityLayout} from '../src/city-layout.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';

const V=(x=0,y=1.8,z=0)=>new THREE.Vector3(x,y,z),results=[];
function test(name,fn){try{const detail=fn();results.push({name,passed:true,...detail});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL '+name+' '+e.message);}}
function orientation(b){return b.quaternion?new THREE.Quaternion(...(Array.isArray(b.quaternion)?b.quaternion:[b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w])).normalize():new THREE.Quaternion().setFromAxisAngle(V(0,1,0),b.ry||0);}
function boxDistance(p,b){
 const local=p.clone().sub(V(b.x,b.y,b.z)).applyQuaternion(orientation(b).invert());
 const bounds=new THREE.Box3(V(-b.sx/2,-b.sy/2,-b.sz/2),V(b.sx/2,b.sy/2,b.sz/2));
 return bounds.distanceToPoint(local);
}
function clear(p,boxes,radius=.22){assert(p.isVector3&&p.toArray().every(Number.isFinite));for(const b of boxes)assert(boxDistance(p,b)>=radius-1e-7,`camera ${p.toArray()} is ${boxDistance(p,b)} from ${b.id||JSON.stringify(b)}`);}
function resolve(anchor,desired,boxes,extra={}){return resolveCameraBoom({anchor,desired,getColliders:()=>boxes,...extra});}
const wall=(x=0,z=0)=>({x,y:2,z,sx:.035,sy:4,sz:14});

test('Unobstructed walking and chase compositions remain exact without input mutation',()=>{
 const a=V(1,1.9,3),d=V(2.4,2.2,8.2),p=V(2.3,2.2,8.1),saved=[a.toArray(),d.toArray(),p.toArray()];
 const r=resolve(a,d,[],{previous:p});assert(r.equals(d));assert.notEqual(r,d);assert.deepEqual([a.toArray(),d.toArray(),p.toArray()],saved);
 assert(resolve(V(0,1.6,0),V(0,4.5,8),[]).equals(V(0,4.5,8)));return{position:r.toArray()};
});
test('Both directions stop before a 35 mm wall even across a 200 m sweep',()=>{
 const b=wall(),a=resolve(V(-100),V(100),[b]),c=resolve(V(100),V(-100),[b]);clear(a,[b]);clear(c,[b]);assert(a.x<-.24&&a.x>-.245);assert(c.x>.24&&c.x<.245);return{left:a.x,right:c.x};
});
test('Camera radius protects near-plane edge grazing instead of just the centre ray',()=>{
 const b={x:0,y:2,z:0,sx:2,sy:4,sz:.1};
 const hit=resolve(V(1.1,1.8,-3),V(1.1,1.8,3),[b]);assert(hit.z<-.27);clear(hit,[b]);
 const miss=resolve(V(1.23,1.8,-3),V(1.23,1.8,3),[b]);assert.equal(miss.z,3);return{grazingStop:hit.z,clearance:boxDistance(hit,b)};
});
test('Actual rotated OBB faces block and an empty corner of their AABB stays clear',()=>{
 const b={...wall(),sx:.1,sz:8,ry:Math.PI/4},a=V(-3,2,3),d=V(3,2,-3),r=resolve(a,d,[b]);clear(r,[b]);assert(r.distanceTo(a)<a.distanceTo(d)/2);
 const p=V(2.7,2,-2.7),q=V(2.9,2,-2.7);assert(resolve(p,q,[b]).equals(q));return{stop:r.toArray(),openCorner:q.toArray()};
});
test('Pitch and roll quaternions use true local dimensions',()=>{
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.46,.8,-.35));
 const b={x:1,y:3,z:-2,sx:.12,sy:4,sz:8,quaternion:rotation.toArray()};
 const a=V(-5,0,0).applyQuaternion(rotation).add(V(1,3,-2)),d=V(5,0,0).applyQuaternion(rotation).add(V(1,3,-2));
 const r=resolve(a,d,[b]);clear(r,[b]);const local=r.clone().sub(V(1,3,-2)).applyQuaternion(rotation.clone().invert());assert(local.x<-.282&&local.x>-.29);return{localStop:local.toArray()};
});
test('Informational yaw does not rotate already computed dynamic AABB dimensions',()=>{
 const b={x:0,y:2,z:0,sx:6,sy:4,sz:1,yaw:Math.PI/2};
 const r=resolve(V(2.8,2,-3),V(2.8,2,3),[b]);assert(r.z<-.72);clear(r,[b]);return{stop:r.toArray()};
});
test('A chase rise stops beneath overhead beams and downward booms stay above ground',()=>{
 const ceiling={x:0,y:3.1,z:4,sx:10,sy:.2,sz:7},floor={x:0,y:-.1,z:0,sx:100,sy:.2,sz:100};
 const roof=resolve(V(0,1.6,0),V(0,4.5,8),[ceiling]),ground=resolve(V(0,2,0),V(0,-3,6),[floor]);clear(roof,[ceiling]);clear(ground,[floor]);assert(roof.y<2.78);assert(ground.y>.22);return{ceilingStop:roof.toArray(),groundStop:ground.toArray()};
});
test('An engulfed anchor escapes its contiguous occupied interval without skipping the next wall',()=>{
 const first={x:0,y:2,z:0,sx:2,sy:4,sz:4},second=wall(3),r=resolve(V(0),V(6),[first,second]);clear(r,[first,second]);assert(r.x>1.22&&r.x<2.76);return{escaped:r.toArray()};
});
test('Zero-length and entirely contained booms find a clear surface outside overlapping solids',()=>{
 const boxes=[{x:0,y:2,z:0,sx:2,sy:4,sz:2},{x:1,y:2,z:0,sx:2,sy:4,sz:2}];
 const a=resolve(V(.5),V(.5),boxes),b=resolve(V(.3),V(.7),boxes);clear(a,boxes);clear(b,boxes);assert(a.distanceTo(V(.5))<1.23);return{zeroLength:a.toArray(),contained:b.toArray()};
});
test('Broad-phase requests encompass the full boom rather than only its endpoints',()=>{
 const b=wall(),calls=[];const getColliders=(x,z,range)=>{calls.push({x,z,range});return Math.abs(b.x-x)<=range+b.sx/2&&Math.abs(b.z-z)<=range+b.sz/2?[b]:[];};
 const r=resolveCameraBoom({anchor:V(-60,2,-20),desired:V(60,2,20),getColliders});assert(r.x<0);assert(calls[0].range>63);clear(r,[b]);return{firstQuery:calls[0]};
});
test('Adjacent boxes discovered after contained-anchor recovery cannot capture the camera',()=>{
 const boxes=Array.from({length:9},(_,i)=>({id:'LAYER-'+i,x:i*.34,y:2,z:0,sx:.5,sy:7,sz:7}));
 const getColliders=(x,z,r)=>boxes.filter(b=>Math.abs(x-b.x)<=r+b.sx/2&&Math.abs(z-b.z)<=r+b.sz/2);
 const r=resolveCameraBoom({anchor:V(0),desired:V(.05),getColliders});clear(r,boxes);return{escaped:r.toArray()};
});
test('Fresh moving and removed blocker poses take effect on the next call',()=>{
 const b=wall(),a=V(-3),d=V(3);const hit=resolve(a,d,[b]);assert(hit.x<0);b.z=30;assert(resolve(a,d,[b]).equals(d));b.z=0;b.x=2;const moved=resolve(a,d,[b]);assert(moved.x>1.7&&moved.x<1.77);assert(resolve(a,d,[]).equals(d));return{first:hit.x,moved:moved.x};
});
test('Contained recovery retains neighboring solids instead of oscillating through shared walls',()=>{
 const boxes=Array.from({length:21},(_,i)=>({id:'JOIN-'+i,x:(i-10)*.8,y:2,z:0,sx:1,sy:20,sz:20}));let queries=0;
 const getColliders=(x,z,r)=>{queries++;return boxes.filter(b=>Math.abs(x-b.x)<=r+b.sx/2&&Math.abs(z-b.z)<=r+b.sz/2);};
 const r=resolveCameraBoom({anchor:V(0),desired:V(0),getColliders});clear(r,boxes);assert(queries<25);return{escaped:r.toArray(),queries};
});
test('Previous-camera sweep prevents tunneling when the stopped endpoint remains visible from the anchor',()=>{
 const b={x:0,y:2,z:0,sx:.04,sy:4,sz:2},anchor=V(-3,2,4),previous=V(-3,2,0),desired=V(3,2,0);
 assert(resolve(anchor,desired,[b]).equals(desired));
 const r=resolve(anchor,desired,[b],{previous});clear(r,[b]);assert(r.x<-.24);return{safeTemporalEnd:r.toArray()};
});

test('Rounding a corner prioritizes a visible inward boom when temporal collision would hide the player',()=>{
 const b={x:0,y:2,z:0,sx:.2,sy:4,sz:4},anchor=V(-2,2,-3),desired=V(-2,2,2),previous=V(2,2,0),radius=.23;
 // Match main.chaseCamera's target, inward snap decision and interpolation.
 const target=resolve(anchor,desired,[b],{radius}),oldDistance=previous.distanceTo(anchor),distance=target.distanceTo(anchor);
 const candidate=distance<oldDistance-.03?target:previous.clone().lerp(target,1-Math.exp(-14/60));
 const r=resolve(anchor,candidate,[b],{radius,previous}),visible=resolve(anchor,r,[b],{radius});
 clear(r,[b],radius);assert(r.distanceTo(visible)<1e-8);assert(r.x<-.333);
 // An inward snap is explicitly allowed here: enforcing this old-camera
 // segment again would put the camera back behind the wall.
 const temporal=resolve(previous,r,[b],{radius});assert(temporal.distanceTo(r)>.5);
 return{camera:r.toArray(),anchorToCameraClear:true,temporalConstraintDeliberatelyRelaxed:true};
});
test('Outward interpolation remains safe at 20, 30, 60 FPS and during a long frame',()=>{
 const boxes=[wall(),{x:-2,y:3,z:4,sx:8,sy:.1,sz:1}],anchor=V(-2,1.8,0);let count=0;
 for(const dt of [1/20,1/30,1/60,.1]){let current=V(-2,2.1,5);for(let i=0;i<200;i++){
  const angle=i*.05,desired=anchor.clone().add(V(Math.sin(angle)*5,.3,Math.cos(angle)*5)),target=resolve(anchor,desired,boxes);
  const eased=current.clone().lerp(target,1-Math.exp(-14*dt));current=resolve(anchor,eased,boxes,{previous:current});clear(current,boxes);assert(resolve(anchor,current,boxes).distanceTo(current)<1e-8);count++;
 }}return{safeFrames:count};
});
test('Malformed positions, bounds and optional state never poison the result with NaN',()=>{
 const invalid=[null,{},wall(NaN),{...wall(),sy:0},{...wall(),sz:-2},{...wall(),ry:Infinity},{...wall(),quaternion:[0,0,0,0]},{...wall(),cameraCollision:false},{...wall(),enabled:false}];
 const d=V(3);assert(resolve(V(-3),d,invalid).equals(d));
 for(const options of [{},{anchor:V(NaN),desired:d},{anchor:V(1),desired:V(Infinity)},{anchor:V(NaN),desired:V(NaN)},{anchor:V(-2),desired:d,radius:NaN},{anchor:V(-2),desired:d,radius:-1},{anchor:V(-2),desired:d,previous:V(NaN)}]){const r=resolveCameraBoom({...options,getColliders:()=>null});assert(r.toArray().every(Number.isFinite));}
 return{invalidRecords:invalid.length};
});
test('Production frontage, canopy and building corners protect representative camera booms',()=>{
 const layout=createCityLayout(),street=createStreetCollisionLayout(layout),boxes=[...layout.colliders,...street.staticColliders];let checks=0,shortened=0;
 const hosts=layout.blueprint.buildings.filter((_,i)=>i%13===0);
 for(const host of hosts){
  const anchor=V(host.x+host.sx/2+.65,1.9,host.z),desired=V(host.x+host.sx/2-4,2.2,host.z+2);
  const local=boxes.filter(b=>Math.abs(b.x-anchor.x)<b.sx/2+10&&Math.abs(b.z-anchor.z)<b.sz/2+10);
  const r=resolve(anchor,desired,local);clear(r,local);if(r.distanceTo(desired)>.1)shortened++;checks++;
 }assert(checks>=10&&shortened===checks);return{booms:checks,shortened,productionColliders:boxes.length};
});

const report={generatedAt:new Date().toISOString(),passed:results.every(r=>r.passed),total:results.length,results};
if(!report.passed)process.exitCode=1;

console.log(`Completed camera-obstruction.test.mjs: ${results.length} checks.`);
