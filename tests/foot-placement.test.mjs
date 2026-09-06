import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBB} from 'three/addons/math/OBB.js';
import {queryFootSupport,queryBootObstacleEnvelope,selectSupportedTouchdown} from '../src/foot-placement.js';
import {resolveBootClearance,BOOT_CLEARANCE_SKIN} from '../src/boot-clearance.js';

const results=[],dims={halfWidth:.14,halfLength:.2408,height:.3052};
const V=(x,y,z)=>({x,y,z}),near=(a,b,tolerance=1e-8)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
function test(name,run){const detail=run();results.push({name,passed:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}
const tread={id:'tread',x:0,y:.115,z:0,sx:2.1,sy:.13,sz:.36};
const upper={id:'upper',x:0,y:.295,z:-.36,sx:2.1,sy:.13,sz:.36};
const choose=(extra={})=>selectSupportedTouchdown({desired:V(0,.18,0),...dims,surfaces:[tread],colliders:[upper],minTop:.18-1e-8,maxTop:.18+1e-8,...extra});
const contact=(position,surfaces,extra={})=>queryFootSupport({position,...dims,surfaces,...extra});
const envelope=(position,colliders,extra={})=>queryBootObstacleEnvelope({position,...dims,colliders,...extra});

test('Actual heel contact is separate from a center-inside, load-bearing endpoint',()=>{
  const p=V(0,.18,.31682222999997),actual=contact(p,[tread]);
  assert(actual&&!actual.centerInside);near(actual.coverage,(.18-p.z+.2408)/.4816,1e-9);
  const result=choose({desired:p});assert(result.fit);near(result.centerLocal.z,.1);
  assert(result.coverage>.66);assert(result.position.z<.18);near(result.top,.18);
  const short={...tread,sz:.14};assert(!choose({surfaces:[short],colliders:[]}).fit,'A short top cannot erase the 8cm center margin');
  return{originalSupportedArea:actual.coverage,resolvedSupportedArea:result.coverage,resolvedCenterZ:result.centerLocal.z};
});

test('The real 0.9512mm nosing gap stays in the obstacle envelope without becoming sole contact',()=>{
  // Exact static source boxes and failed 30Hz work-motor frame16 position.
  const nose={id:'STREET-VOXEL-160925',x:-189,y:3.051,z:-257.173,sx:2.04,sy:.028,sz:.065,ry:0};
  const lower={id:'STREET-VOXEL-160911',x:-189,y:2.82,z:-256.96,sx:2.1,sy:.13,sz:.36,ry:0};
  const p=V(-189,3.065,-256.8987488),gap=p.z-dims.halfLength-(nose.z+nose.sz/2);
  near(gap,.0009512,1e-10);assert(gap<BOOT_CLEARANCE_SKIN);
  assert.equal(contact(p,[nose]),null,'Skin must not become an actual horizontal contact');
  const obstacle=envelope(p,[nose]);near(obstacle.top,3.065);assert.equal(obstacle.obstacles[0].actualOverlap,false);
  const failedLower=resolveBootClearance({from:p,to:{...p,y:2.885},...dims,colliders:[nose]});assert(failedLower.unresolvedVertical);
  const result=selectSupportedTouchdown({desired:{...p,y:2.885},...dims,surfaces:[lower],colliders:[nose],minTop:2.88,maxTop:2.89});
  assert(result.fit);near(result.top,2.885);assert(result.position.z-dims.halfLength-(nose.z+nose.sz/2)>=BOOT_CLEARANCE_SKIN-1e-9);
  assert.equal(envelope(result.position,[nose]).top,null,'Chosen endpoint must leave the SAME expanded envelope');
  assert(!resolveBootClearance({from:result.position,to:result.position,...dims,colliders:[nose]}).blocked);
  return{actualGap:gap,retainedEnvelopeTop:obstacle.top,endpointZ:result.position.z,endpointGap:result.position.z-dims.halfLength-(nose.z+nose.sz/2)};
});

test('Projected boot dimensions derive the straight, 30-degree and sideways tread outcomes',()=>{
  const straight=choose();assert(straight.fit);near(straight.centerLocal.z,.06230001);assert(straight.coverage>.74);
  for(const yaw of[Math.PI,2*Math.PI]){const reverse=choose({yaw});assert(reverse.fit);near(reverse.centerLocal.z,straight.centerLocal.z);}
  const thirty=choose({yaw:Math.PI/6});assert(!thirty.fit);assert.equal(thirty.reason,'no-fitting-support');
  const projected=.14*Math.sin(Math.PI/6)+.2408*Math.cos(Math.PI/6),minimum=projected-.18+BOOT_CLEARANCE_SKIN;
  assert(minimum>.1&&minimum<.10005,'The 39-micrometre overrun is real, not roundoff');
  for(const yaw of[-Math.PI/2,Math.PI/2]){const sideways=choose({yaw});assert(sideways.fit);near(sideways.centerLocal.z,0);near(sideways.coverage,1);}
  return{straightBias:straight.centerLocal.z,thirtyDegreeRequiredBias:minimum,availableBias:.1,sidewaysFits:true};
});

test('Rotating and translating the entire stair preserves the geometric solution',()=>{
  let cases=0,maximumError=0;
  for(const angle of[-Math.PI/2,-.43,.61,Math.PI/2]){
    const c=Math.cos(angle),s=Math.sin(angle),transform=b=>({...b,x:220+b.x*c+b.z*s,z:-311-b.x*s+b.z*c,ry:angle});
    const a=transform(tread),b=transform(upper),result=choose({desired:V(220,.18,-311),yaw:angle,surfaces:[a],colliders:[b]});
    assert(result.fit);maximumError=Math.max(maximumError,Math.abs(result.centerLocal.z-.06230001));near(result.centerLocal.z,.06230001,3e-8);near(result.centerLocal.x,0,3e-8);
    assert(!choose({desired:V(220,.18,-311),yaw:angle+Math.PI/6,surfaces:[a],colliders:[b]}).fit);cases++;
  }
  return{cases,maximumLocalError:maximumError};
});

test('Flat slabs, same-level seams and low curbs reserve actual top contact',()=>{
  const floor={id:'floor',x:0,y:-.05,z:0,sx:20,sy:.1,sz:20},curb={id:'curb',x:0,y:.0825,z:0,sx:2,sy:.165,sz:2};
  const flat=selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[floor],colliders:[floor]});assert(flat.fit);near(flat.top,0);near(flat.coverage,1);
  const raised=selectSupportedTouchdown({desired:V(0,.165,0),...dims,surfaces:[curb],colliders:[floor,curb]});assert(raised.fit);near(raised.position.y,.165);
  const left={...floor,id:'left',x:-1,sx:2},right={...floor,id:'right',x:1,sx:2};
  const seam=selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[left,right],colliders:[left,right]});assert(seam.fit);near(seam.position.y,0);assert(seam.coverage>.75);
  const overhead={id:'canopy',x:0,y:1,z:0,sx:4,sy:.1,sz:4,walkable:false};
  const covered=selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[floor],colliders:[overhead]});assert(covered.fit);
  return{flatTop:flat.top,curbTop:raised.top,seamCoverage:seam.coverage,overheadPass:true};
});

test('The complete boot prism rejects closed doors and ceilings, including tilted-input exclusions',()=>{
  const landing={id:'landing',x:-190,y:3.13,z:-261.41,sx:2.1,sy:.13,sz:.42};
  const door={id:'door',x:-190,y:4.195,z:-261.5,sx:1.82,sy:2.23,sz:.14,walkable:false};
  const closed=selectSupportedTouchdown({desired:V(-190,3.195,-261.41),...dims,surfaces:[landing],colliders:[door],minTop:3.19,maxTop:3.20,maxDistance:.1});assert(!closed.fit);
  const opened=selectSupportedTouchdown({desired:V(-190,3.195,-261.41),...dims,surfaces:[landing],colliders:[],minTop:3.19,maxTop:3.20,maxDistance:.1});assert(opened.fit);
  const floor={id:'floor',x:0,y:-.05,z:0,sx:3,sy:.1,sz:3},lowRoof={id:'ceiling',x:0,y:.30,z:0,sx:3,sy:.10,sz:3,walkable:false};
  assert(!selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[floor],colliders:[lowRoof]}).fit);
  for(const modifier of[{dynamic:true},{civilian:true},{walkable:false},{rx:.01},{rz:.01},{quaternion:{x:.01,y:0,z:0,w:Math.sqrt(1-.0001)}}]){
    const s={...floor,...modifier};assert.equal(contact(V(0,0,0),[s]),null);assert(!selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[s]}).fit);
  }
  const yaw=Math.PI/2,quaternion={x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)};
  assert(selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[{...floor,quaternion}]}).fit);
  return{closedDoorRejected:true,openDoorFits:true,lowRoofRejected:true,invalidSupportClasses:6};
});

test('Local obstacles split the center band without requiring one hardcoded downhill face',()=>{
  const platform={id:'platform',x:0,y:0,z:0,sx:4,sy:.2,sz:4},pillar={id:'pillar',x:0,y:1,z:0,sx:.1,sy:2,sz:.1,walkable:false};
  const result=selectSupportedTouchdown({desired:V(0,.1,0),...dims,surfaces:[platform],colliders:[pillar],maxDistance:.5});
  assert(result.fit);near(result.position.y,.1);assert(result.distance>=.1915-1e-9&&result.distance<.192);near(result.coverage,1);
  const narrow={id:'narrow',x:0,y:0,z:0,sx:.2,sy:.2,sz:1},wall={id:'wall',x:0,y:1,z:0,sx:.2,sy:2,sz:2,walkable:false};
  assert(!selectSupportedTouchdown({desired:V(0,.1,0),...dims,surfaces:[narrow],colliders:[wall]}).fit);
  return{nearestClearEndpoint:result.position,distance:result.distance};
});

test('Missing, removed and distant supports return explicit no-fit without mutation',()=>{
  const frozen=Object.freeze({...tread}),snapshot=JSON.stringify(frozen);
  assert(choose({surfaces:[frozen]}).fit);assert.equal(JSON.stringify(frozen),snapshot);
  const removed=choose({surfaces:[],colliders:[tread,upper]});assert(!removed.fit);assert.equal(removed.position,null);assert.equal(removed.reason,'no-eligible-support');
  assert(!choose({desired:V(100,.18,100),maxDistance:.5}).fit);
  assert(!choose({minTop:.5,maxTop:1}).fit);
  assert.equal(envelope(V(100,0,100),[tread]).top,null);
  assert.throws(()=>choose({halfWidth:0}),TypeError);assert.throws(()=>choose({minTop:1,maxTop:0}),TypeError);
  return{removedReason:removed.reason,immutableInput:true};
});

const bytes=fs.readFileSync(new URL('../public/assets/mercenary.glb',import.meta.url));
const avatar=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
test('Actual Blender-authored boot mesh bounds have no positive-volume collision at accepted treads',()=>{
  avatar.updateWorldMatrix(true,true);const foot=avatar.getObjectByName('left_foot');assert(foot);
  const inverse=foot.matrixWorld.clone().invert(),modules=[],bounds=new THREE.Box3();
  foot.traverse(mesh=>{if(!mesh.isMesh)return;const transform=inverse.clone().multiply(mesh.matrixWorld),box=new THREE.Box3();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++)box.expandByPoint(new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(transform));
    modules.push(box);bounds.union(box);
  });
  const scale=1.12,center=new THREE.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2);
  const actual={halfWidth:(bounds.max.x-bounds.min.x)*scale/2,halfLength:(bounds.max.z-bounds.min.z)*scale/2,height:(bounds.max.y-bounds.min.y)*scale};
  near(actual.halfWidth,.14,1e-7);near(actual.halfLength,.2408,1e-7);
  let accepted=0,rejected=0,checkedModules=0;
  for(const stairYaw of[0,.61,-Math.PI/2])for(const relativeYaw of[0,.12,Math.PI/6,Math.PI/2,-Math.PI/2,Math.PI]){
    const c=Math.cos(stairYaw),s=Math.sin(stairYaw),rotate=b=>({...b,x:40+b.x*c+b.z*s,z:-70-b.x*s+b.z*c,ry:stairYaw}),a=rotate(tread),b=rotate(upper),yaw=stairYaw+relativeYaw;
    const r=choose({desired:V(40,.18,-70),...actual,yaw,surfaces:[a],colliders:[b]});
    if(!r.fit){rejected++;continue;}
    const rotation=new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(yaw));
    const obstacle=new OBB(new THREE.Vector3(b.x,b.y,b.z),new THREE.Vector3(b.sx,b.sy,b.sz).multiplyScalar(.5),new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(stairYaw)));
    for(const module of modules){
      const localCenter=module.getCenter(new THREE.Vector3()).sub(center).multiplyScalar(scale).applyMatrix3(rotation).add(new THREE.Vector3(r.position.x,r.position.y,r.position.z));
      const half=module.getSize(new THREE.Vector3()).multiplyScalar(scale/2),body=new OBB(localCenter,half,rotation);
      assert(!body.intersectsOBB(obstacle,1e-12),'Actual visible boot module must not overlap the higher tread');checkedModules++;
    }
    accepted++;
  }
  // Each material mesh can contain more than one voxel. Its enclosing OBB is
  // conservative; a clear mesh bound guarantees every enclosed voxel is clear.
  assert(accepted>=12&&rejected>=3);return{accepted,rejected,checkedConservativeMeshBounds:checkedModules,actualDimensions:actual,assetSHA256:crypto.createHash('sha256').update(bytes).digest('hex')};
});

test('Normalized support orientation and inherited vertical tolerance are explicit',()=>{
  const yaw=.61,quaternion={x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},floor={id:'floor',x:0,y:-.05,z:0,sx:3,sy:.1,sz:3,quaternion};
  const result=selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[floor]});assert(result.fit);assert.equal(result.support,floor);near(result.supportYaw,yaw);
  near(contact(V(0,0,0),[floor]).supportYaw,yaw);near(envelope(V(0,0,0),[floor]).obstacles[0].yaw,yaw);
  const micro=top=>({id:'micro-slab',x:0,y:top-.05,z:0,sx:3,sy:.1,sz:3,walkable:false});
  const small=selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[floor],colliders:[micro(.0004)],maxDistance:0});assert(small.fit);
  const larger=selectSupportedTouchdown({desired:V(0,0,0),...dims,surfaces:[floor],colliders:[micro(.0006)],maxDistance:0});assert(!larger.fit);
  assert.throws(()=>choose({minTop:'low'}),TypeError);
  return{normalizedYaw:result.supportYaw,originalRecordRetained:true,acceptedMicroTop:.0004,rejectedMicroTop:.0006};
});

if(process.env.FOOT_PLACEMENT_REPORT)fs.writeFileSync(process.env.FOOT_PLACEMENT_REPORT,JSON.stringify({status:'passed',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/foot-placement.js',import.meta.url))).digest('hex'),tests:results},null,2)+'\n');
