import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {resolveBootClearance} from '../src/boot-clearance.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z),dimensions={halfWidth:.14,halfLength:.2408,height:.34},results=[];
function test(name,run){const detail=run();results.push({name,passed:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}
const floor={id:'floor',x:0,y:-.05,z:0,sx:40,sy:.1,sz:40};
const wall={id:'wall',x:0,y:1.5,z:0,sx:.02,sy:3,sz:20};
const solve=(from,to,colliders,extra={})=>resolveBootClearance({from,to,...dimensions,colliders,...extra});

test('A thin tall wall blocks a whole-frame crossing while preserving tangent travel',()=>{
  const r=solve(V(1,0,0),V(-1,0,2),[floor,wall]);
  assert(r.blocked&&!r.unresolved);assert(r.position.x>=.15);assert(Math.abs(r.position.z-2)<1e-9);assert.equal(r.position.y,0);
  assert(r.contacts.some(c=>c.id==='wall'&&c.normal.x>0));
  return{position:r.position.toArray(),contacts:r.contacts.length};
});

test('A rotated thin OBB blocks the boot by its real face rather than its AABB',()=>{
  const yaw=Math.PI/4,normal=V(Math.sin(yaw),0,Math.cos(yaw)),tangent=V(Math.cos(yaw),0,-Math.sin(yaw));
  const c={id:'rotated-wall',x:0,y:1.5,z:0,sx:8,sy:3,sz:.015,ry:yaw},bootYaw=-.28;
  const from=normal.clone(),to=normal.clone().negate().addScaledVector(tangent,.7),r=solve(from,to,[c],{yaw:bootYaw});
  const right=V(Math.cos(bootYaw),0,-Math.sin(bootYaw)),forward=V(Math.sin(bootYaw),0,Math.cos(bootYaw));
  const support=dimensions.halfWidth*Math.abs(right.dot(normal))+dimensions.halfLength*Math.abs(forward.dot(normal))+c.sz/2;
  assert(r.blocked&&!r.unresolved);assert(r.position.dot(normal)>=support-1e-8);assert(Math.abs(r.position.dot(tangent)-.7)<1e-8);
  return{normalClearance:r.position.dot(normal)-support,tangentTravel:r.position.dot(tangent)};
});

test('Real supporting tops and clearance above risers stay open; low swings do not pass through risers',()=>{
  const step={id:'riser',x:0,y:.09,z:0,sx:4,sy:.18,sz:.36};
  const low=solve(V(0,.05,1),V(0,.05,-1),[floor,step]);assert(low.blocked&&!low.unresolved);assert(low.position.z>=.18+dimensions.halfLength);
  const raised=solve(V(0,.181,1),V(0,.181,-1),[floor,step]);assert(!raised.blocked);assert(raised.position.distanceTo(V(0,.181,-1))<1e-12);
  const supported=solve(V(0,.18,.05),V(.25,.18,-.05),[floor,step]);assert(!supported.blocked);assert.equal(supported.position.y,.18);
  assert(!solve(V(0,.18-2e-8,.05),V(.25,.18-2e-8,-.05),[step]).blocked,'GLB float32 contact noise must not trigger a sideways floor escape');
  const overhead={id:'overhead',x:0,y:2,z:0,sx:5,sy:.2,sz:5};assert(!solve(V(0,0,1),V(0,0,-1),[floor,overhead]).blocked);
  return{blockedLowZ:low.position.z,raisedPathClear:true,ownTopContactClear:true};
});

test('Contact skin allows leaving/sliding while preventing inward tunnelling; initial overlap is explicit',()=>{
  const near=dimensions.halfWidth+wall.sx/2+.0002;
  const inward=solve(V(near,0,0),V(-1,0,0),[wall]);assert(inward.blocked);assert(inward.position.x>=near-1e-9);
  const outward=solve(V(near,0,0),V(1,0,.5),[wall]);assert(!outward.blocked);assert(outward.position.distanceTo(V(1,0,.5))<1e-9);
  const tangent=solve(V(near,0,0),V(near,0,1),[wall]);assert(!tangent.blocked);assert.equal(tangent.position.z,1);
  const inside=solve(V(.02,0,0),V(.02,0,0),[wall]);assert(inside.blocked&&!inside.unresolved);assert(inside.position.x>=.15);assert(inside.contacts.some(c=>c.kind==='initial-overlap'));
  return{inwardStop:inward.position.x,initialRecovery:inside.position.x};
});

test('Two-face corners preserve both constraints and vertical conflicts never rewrite requested height',()=>{
  const front={id:'front',x:0,y:1.5,z:0,sx:20,sy:3,sz:.02};
  const corner=solve(V(1,0,1),V(-1,0,-1),[wall,front]);assert(corner.blocked&&!corner.unresolved);assert(corner.position.x>=.15);assert(corner.position.z>=.2508);
  const ceiling={id:'ceiling',x:0,y:.9,z:0,sx:5,sy:.2,sz:5};const up=solve(V(0,0,0),V(0,.8,0),[ceiling]);
  assert(up.blocked&&up.unresolvedVertical&&up.unresolved);assert.equal(up.position.y,.8);assert(up.contacts.some(c=>c.kind==='vertical'&&c.normal.y<0));
  const below=solve(V(0,.1,0),V(0,-.02,0),[floor]);assert(below.unresolvedVertical);assert.equal(below.position.y,-.02);
  const initialFloor=solve(V(0,-.02,0),V(0,-.02,0),[floor]);assert(initialFloor.unresolvedVertical);assert.equal(initialFloor.position.x,0);assert.equal(initialFloor.position.z,0);
  const escapeFloor=solve(V(0,-.02,0),V(0,.02,0),[floor]);assert(!escapeFloor.unresolved);assert.equal(escapeFloor.position.y,.02);
  return{corner:corner.position.toArray(),verticalConflictsReported:true};
});

test('Only valid upright static solids participate, including unwalkable vertical surfaces',()=>{
  for(const ignored of[{...wall,dynamic:true},{...wall,civilian:true},{...wall,rx:.2},{...wall,rz:.2},{...wall,sx:NaN}])assert(!solve(V(1,0,0),V(-1,0,0),[ignored]).blocked);
  assert(solve(V(1,0,0),V(-1,0,0),[{...wall,walkable:false}]).blocked);
  assert.throws(()=>solve(V(0,0,0),V(1,0,0),[],{height:0}),TypeError);
  return{dynamicAABBsExcluded:true,unwalkableWallStillSolid:true};
});

test('Recorded upper-entry boot sweep stays in front of the real closed door',()=>{
  // Actual primary-render samples447→448 from the rejected Bil66zmG run;
  // constants keep this outcome fixture portable without a private raw capture.
  const door={id:'STREET-VOXEL-160982',x:-190,y:4.195,z:-261.5,sx:1.82,sy:2.23,sz:.14};
  const r=solve(V(-190.26424398539172,3.4112764740852697,-260.87200990730173),V(-190.34860043241866,3.2795261201783696,-261.2426233419658),[door],{yaw:-6.059385140874382,height:.3052000010013581});
  const front=-261.43,yaw=-6.059385140874382,projectedHalf=Math.abs(Math.sin(yaw))*dimensions.halfWidth+Math.abs(Math.cos(yaw))*dimensions.halfLength;
  assert(r.blocked&&!r.unresolved);assert(r.position.z-projectedHalf>=front-1e-8);assert.equal(r.position.y,3.2795261201783696);
  return{resolvedSole:r.position.toArray(),frontGap:r.position.z-projectedHalf-front};
});

const bytes=fs.readFileSync(new URL('../public/assets/mercenary.glb',import.meta.url));
const asset=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
test('Actual authored boot vertices remain outside tall walls at varied yaw and diagonal approaches',()=>{
  const foot=asset.getObjectByName('left_foot');assert(foot,'This test requires the actual articulated Blender foot');asset.updateWorldMatrix(true,true);
  const inverse=foot.matrixWorld.clone().invert(),local=[],box=new THREE.Box3();foot.traverse(mesh=>{if(!mesh.isMesh)return;const m=inverse.clone().multiply(mesh.matrixWorld),a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++){const p=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(m);local.push(p);box.expandByPoint(p);}
  });
  const scale=1.12,soleCenter=V((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2),dims={halfWidth:(box.max.x-box.min.x)*scale/2,halfLength:(box.max.z-box.min.z)*scale/2,height:(box.max.y-box.min.y)*scale};
  let cases=0,minimumGap=Infinity;
  for(const yaw of[-1.1,-.35,0,.8])for(const slide of[-.7,0,.7]){
    const r=solve(V(1,0,0),V(-1,0,slide),[wall],{...dims,yaw});assert(r.blocked&&!r.unresolved);
    const q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),yaw);
    for(const p of local){const world=p.clone().sub(soleCenter).multiplyScalar(scale).applyQuaternion(q).add(r.position);const gap=world.x-wall.sx/2;minimumGap=Math.min(minimumGap,gap);assert(gap>=-1e-8,'Actual visible boot vertex must stay on the starting side of wall');}
    cases++;
  }
  return{cases,actualVertices:local.length,minimumGap,dimensions:dims,assetSHA256:crypto.createHash('sha256').update(bytes).digest('hex')};
});

const report={status:'passed',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/boot-clearance.js',import.meta.url))).digest('hex'),tests:results};
if(process.env.BOOT_CLEARANCE_REPORT)fs.writeFileSync(process.env.BOOT_CLEARANCE_REPORT,JSON.stringify(report,null,2)+'\n');
