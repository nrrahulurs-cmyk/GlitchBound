import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {createNativeCharacterExport,toBlenderMatrix,SOURCE_TO_BLENDER} from '../scripts/export-native-characters.mjs';
import {createCivilianMotion} from '../src/civilian-motion.js';
import {createCivilianRagdoll} from '../src/civilian-ragdoll.js';
import {SCENE_PLACEMENTS} from '../src/asset-placements.js';

const results=[],hash=value=>createHash('sha256').update(typeof value==='string'||ArrayBuffer.isView(value)?value:JSON.stringify(value)).digest('hex');
const M=a=>new THREE.Matrix4().fromArray(a),error=(a,b)=>a.reduce((n,v,i)=>Math.max(n,Math.abs(v-b[i])),0);
const corners=[];for(const x of[-.5,.5])for(const y of[-.5,.5])for(const z of[-.5,.5])corners.push(new THREE.Vector3(x,y,z));
function test(name,run){try{const detail=run();results.push({name,passed:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL '+name,e.stack);}}
let truth;
const data=createNativeCharacterExport({onRuntimeReady(c){
  truth={world:c.simulation.world,people:c.people.map(p=>({id:p.id,matrices:p.parts.map(part=>part.matrix.toArray()),pieces:p.pieces,scale:p.scale,yaw:p.yaw,joints:structuredClone(p.gait.getState().jointPositions),orientations:Object.fromEntries(Object.entries(p.gait.getState().segmentOrientations).map(([name,q])=>[name,{x:q.x,y:q.y,z:q.z,w:q.w}]))})),authored:structuredClone(c.authored),upload:c.mesh.instanceMatrix.array.slice(),colors:c.mesh.instanceColor.array.slice(),dynamic:c.dynamicProvider(),staticCount:c.staticColliders.length,service:c.serviceWorld.getColliders(),navigation:c.civilians.getNavigationState(),states:{worldTime:c.simulation.world.time,physicsSteps:c.simulation.world.stepnumber,civilian:c.civilians.getState(),traffic:c.traffic.getTrafficState()}};
}});

test('All source people and actual frame-zero instance matrices survive export exactly',()=>{
  assert.equal(data.counts.people,284);assert.equal(data.counts.voxelPieces,14785);assert.equal(data.counts.umbrellaPeople,95);assert.equal(data.counts.airTraffic,16);
  assert.equal(data.authoredPopulationSHA256,'4f52a788f418be78eeb6580990a5acde38aaa1a05b76f15c394c733440c826f3');assert.equal(data.airTrafficSHA256,'51d1a7454635d9df5a8c7c4848a287fb1437fedb10d7122a016e1552a8c40f46');
  assert.equal(hash(truth.authored),data.authoredPopulationSHA256);assert.equal(data.rng.drawsTotal,6549);
  let checked=0;for(const [i,person] of data.characters.entries()){
    assert.equal(person.id,truth.people[i].id);const template=data.templates.find(t=>t.id===person.templateId);
    assert.deepEqual({...person.authored,pieces:template.pieces.map(({index,animationGroup,physicalGroup,...piece})=>piece)},truth.authored[i]);
    for(const part of person.parts){assert.deepEqual(part.worldMatrix,truth.people[i].matrices[part.localIndex]);for(let n=0;n<16;n++)assert.equal(Math.fround(part.worldMatrix[n]),truth.upload[part.instanceIndex*16+n]);const swatch=data.palette.find(p=>p.srgbHex===template.pieces[part.localIndex].c);for(let n=0;n<3;n++)assert.equal(Math.fround(swatch.linearRGB[n]),truth.colors[part.instanceIndex*3+n]);checked++;}
  }
  assert.equal(hash(new Uint8Array(truth.upload.buffer)),data.verification.instanceFloat32SHA256);assert.equal(hash(new Uint8Array(truth.colors.buffer)),data.verification.instanceColorFloat32SHA256);assert.equal(truth.world.bodies.length,0,'exporter leaked its physics context');
  return{people:data.characters.length,exactVoxelMatrices:checked,float32Hash:data.verification.instanceFloat32SHA256};
});

test('Initial clearance uses the exact live provider poses without advancing time',()=>{
  assert.equal(truth.states.worldTime,0);assert.equal(truth.states.physicsSteps,0);assert.equal(truth.states.civilian.time,0);assert.equal(truth.states.civilian.dead,0);
  assert(truth.states.traffic.every(v=>v.speed===0&&!v.wrecked));assert.deepEqual(data.initialization.dynamicColliders,truth.dynamic);assert.equal(data.initialization.staticColliderCount,truth.staticCount);
  for(const service of truth.service)assert(truth.dynamic.some(c=>c.id===service.id),'missing live service box '+service.id);
  assert(truth.dynamic.some(c=>c.kind==='bin'));assert(truth.dynamic.some(c=>c.id==='VEHICLE-PARKED'));
  assert.deepEqual(data.initialization.ownedNavigationHull,{id:'VEHICLE-PLAYER',x:SCENE_PLACEMENTS.interceptor.x,y:SCENE_PLACEMENTS.interceptor.y+.68,z:SCENE_PLACEMENTS.interceptor.z,sx:2.8,sy:1.28,sz:5.2,ry:SCENE_PLACEMENTS.interceptor.ry});
  const hull=truth.dynamic.find(c=>c.id==='VEHICLE-PARKED'),bounds=data.initialization.parkedLocalManifestBounds,placement=SCENE_PLACEMENTS.parkedCar;
  const center=new THREE.Vector3(...bounds.min).add(new THREE.Vector3(...bounds.max)).multiplyScalar(.5).applyAxisAngle(new THREE.Vector3(0,1,0),placement.ry).add(new THREE.Vector3(placement.x,placement.y,placement.z));
  assert(Math.hypot(center.x-hull.x,center.y-hull.y,center.z-hull.z)<1e-10);
  assert(Math.abs(hull.sx-(bounds.max[0]-bounds.min[0]))<1e-10);assert(Math.abs(hull.sz-(bounds.max[2]-bounds.min[2]))<1e-10);
  const changed=data.characters.filter(p=>p.authored.x!==p.resolved.x||p.authored.z!==p.resolved.z),audit=data.initialization.navigation.spawnCorrections;
  for(const p of changed)assert(audit.some(c=>c.id===p.id&&c.resolved),'unrecorded initialization clearance '+p.id);
  assert(audit.every(c=>c.resolved));assert(data.initialization.supplySupports.foundations.length>0);
  return{staticColliders:truth.staticCount,dynamicColliders:truth.dynamic.length,serviceSolids:truth.service.length,changedSpawns:changed.length,recordedCorrections:audit.length,worldSteps:0};
});

test('Editable group hierarchy and Blender basis reconstruct every original voxel corner',()=>{
  let maxMatrix=0,maxCorner=0,count=0;const c=M(SOURCE_TO_BLENDER);
  for(const person of data.characters){const worlds=new Map();
    for(const group of person.groups){const world=(group.parent?worlds.get(group.parent):M(person.rootWorldMatrix)).clone().multiply(M(group.bindParentMatrix));maxMatrix=Math.max(maxMatrix,error(world.elements,group.bindWorldMatrix));worlds.set(group.name,world);}
    for(const part of person.parts){const world=worlds.get(part.group).clone().multiply(M(part.localBindMatrix)),native=M(toBlenderMatrix(world.elements));maxMatrix=Math.max(maxMatrix,error(world.elements,part.worldMatrix));
      for(const corner of corners){const expected=corner.clone().applyMatrix4(M(part.worldMatrix)).applyMatrix4(c),actual=corner.clone().applyMatrix4(c).applyMatrix4(native);maxCorner=Math.max(maxCorner,expected.distanceTo(actual));count++;}
    }
  }
  assert(maxMatrix<1e-9);assert(maxCorner<1e-9);return{voxelCorners:count,maximumMatrixError:maxMatrix,maximumNativeCornerError:maxCorner};
});

test('Exported live and physical groups agree with the production ragdoll handoff',()=>{
  let checked=0;
  for(const source of[truth.people.find(p=>p.pieces.length===35),truth.people.find(p=>p.pieces.length===86)]){
    const person=data.characters.find(p=>p.id===source.id),world=new CANNON.World(),parts=source.pieces.map((piece,index)=>({piece,index,matrix:M(source.matrices[index])}));
    const ragdoll=createCivilianRagdoll({world,parts,id:source.id,yaw:source.yaw,scale:source.scale,jointPositions:source.joints,segmentOrientations:source.orientations});
    try{assert.equal(ragdoll.joints.length,10);assert.equal(ragdoll.records.filter(r=>!r.umbrella).length,11);
      for(const record of ragdoll.records)for(const member of record.members){const part=person.parts[member.part.index];assert.equal(part.physicalGroup,record.name);
        const body=record.body,actual=new THREE.Matrix4().compose(new THREE.Vector3(...body.position.toArray()),new THREE.Quaternion(...body.quaternion.toArray()),new THREE.Vector3(1,1,1)).multiply(member.local);
        assert(error(actual.elements,part.worldMatrix)<1e-10);checked++;
      }
      for(const side of['L','R']){assert(person.groups.some(g=>g.name==='foot'+side));assert(ragdoll.records.find(r=>r.name==='shin'+side).body.shapes.length===2);}
    }finally{ragdoll.dispose();assert.equal(world.constraints.length,0);assert.equal(world.bodies.length,0);}
  }
  return{ordinaryAndUmbrellaParts:checked,jointedBodyGroups:11,liveBodyGroups:13,rigidDroppedUmbrella:true};
});

test('Compact workshop hierarchy matches replayed walk, stop, turn, flee and curb poses',()=>{
  let matrixChecks=0,maximumError=0,maximumSolePenetration=0,plantedComparisons=0,maxPlantedSlip=0;
  for(const clip of data.workshop.clips){
    const source=truth.authored[clip.sourceIndex],platform=clip.terrain.platform,ground=(x,z)=>platform&&x>=platform.minX&&x<=platform.maxX&&z>=platform.minZ&&z<=platform.maxZ?platform.height:clip.terrain.base;
    const gait=createCivilianMotion({scale:source.scale,phase:source.phase,umbrella:source.pieces.some(p=>p.umbrella),groundHeightAt:ground});let x=0,z=0,distance=0,priorFeet=null;
    gait.reset({x,z,yaw:0,groundY:ground(x,z)});
    for(let tick=0;tick<=clip.duration*clip.plannerRate;tick++){
      if(tick){const control=clip.controls.find(command=>(tick-1)/clip.plannerRate<command.until)||clip.controls.at(-1),accepted=gait.plan(1/clip.plannerRate,control);x+=accepted.dx;z+=accepted.dz;distance+=Math.hypot(accepted.dx,accepted.dz);gait.update(1/clip.plannerRate,{x,z,groundY:ground(x,z),fleeing:control.fleeing});}
      if(tick%2)continue;const frame=clip.frames[tick/2],worlds=new Map(),root=M(frame.rootWorldMatrix);assert(Math.abs(root.elements[12]-x)<1e-10);assert(Math.abs(root.elements[14]-z)<1e-10);assert(Math.abs(frame.distance-distance)<1e-9);
      for(const [i,group]of clip.binding.groups.entries())worlds.set(group.name,(group.parent?worlds.get(group.parent):root).clone().multiply(M(frame.groups[i])));
      for(const part of clip.binding.parts){const actual=gait.writePartMatrix(source.pieces[part.localIndex],new THREE.Matrix4()),exported=worlds.get(part.group).clone().multiply(M(part.localBindMatrix));maximumError=Math.max(maximumError,error(actual.elements,exported.elements));matrixChecks++;
        if(part.group.startsWith('foot'))for(const corner of corners){const point=corner.clone().applyMatrix4(exported);maximumSolePenetration=Math.max(maximumSolePenetration,ground(point.x,point.z)-point.y);}
      }
      for(const foot of frame.feet){const previous=priorFeet?.find(f=>f.side===foot.side);if(previous?.planted&&foot.planted){maxPlantedSlip=Math.max(maxPlantedSlip,Math.hypot(foot.x-previous.x,foot.y-previous.y,foot.z-previous.z));plantedComparisons++;}}
      priorFeet=frame.feet;assert(!('parts'in frame),'per-voxel animation was emitted');
    }
    assert(clip.frames.at(-1).speed<.03,'workshop stop never settled');
    if(clip.mode==='flee-curb')assert(clip.frames.some(f=>f.feet.some(foot=>foot.y>.15)),'curb clip never reached pavement');
    else assert(clip.frames.at(-1).rootWorldMatrix[12]>.8,'turn clip did not translate sideways');
  }
  assert(maximumError<1e-9);assert(maximumSolePenetration<1e-8);assert(maxPlantedSlip<1e-9);assert(plantedComparisons>100);
  return{clips:4,groupFrames:data.workshop.clips.reduce((n,c)=>n+c.frames.length,0),matrixChecks,maximumError,maximumSolePenetration,plantedComparisons,maxPlantedSlip};
});

test('Portable CLI writes explicit gzip output and a small reproducible summary',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'neon-native-export-')),output=path.join(temp,'characters.json.gz'),summary=path.join(temp,'summary.json');
  try{
    const script=fileURLToPath(new URL('../scripts/export-native-characters.mjs',import.meta.url)),result=spawnSync(process.execPath,[script,'--output',output,'--summary',summary,'--no-workshop'],{cwd:temp,encoding:'utf8',maxBuffer:2*1024*1024});
    assert.equal(result.status,0,result.stderr);const bytes=fs.readFileSync(output),decoded=JSON.parse(gunzipSync(bytes)),report=JSON.parse(fs.readFileSync(summary,'utf8'));
    assert.equal(decoded.workshop,null);assert.equal(decoded.characters.length,284);assert.equal(report.sha256,hash(bytes));assert.equal(report.bytes,bytes.length);assert.equal(decoded.verification.instanceFloat32SHA256,data.verification.instanceFloat32SHA256);assert.equal(hash(decoded.characters),hash(data.characters),'second initialization changed serialized character matrices');assert(fs.statSync(summary).size<50000);
    return{gzipBytes:bytes.length,summaryBytes:fs.statSync(summary).size,independentWorkingDirectory:true,secondInitializationMatricesIdentical:true};
  }finally{for(const file of[output,summary])if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(temp);}
});

const report={schema:'native-character-export-tests',sourceHashes:data.sourceHashes,status:results.every(r=>r.passed)?'passed':'failed',tests:results};
if(process.env.NATIVE_CHARACTER_EXPORT_REPORT)fs.writeFileSync(process.env.NATIVE_CHARACTER_EXPORT_REPORT,JSON.stringify(report,null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
