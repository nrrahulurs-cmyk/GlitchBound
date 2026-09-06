import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import * as THREE from 'three';
import {createCityPopulation} from '../src/civilian-source.js';
import {createCityLayout} from '../src/city-layout.js';
import {createCivilianSystem} from '../src/civilians.js';
import {createCivilianMotion} from '../src/civilian-motion.js';
import {createGroundHeightSampler} from '../src/ground-height.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';
import {createCityServices} from '../src/city-services.js';
import {createServiceFixtures} from '../src/service-fixtures.js';
import {createServiceWorld} from '../src/service-world.js';
import {createTrafficController} from '../src/city-life.js';
import {createSimulation} from '../src/simulation.js';
import {SCENE_PLACEMENTS} from '../src/asset-placements.js';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const digest=value=>createHash('sha256').update(typeof value==='string'||ArrayBuffer.isView(value)?value:JSON.stringify(value)).digest('hex');
const matrix=value=>new THREE.Matrix4().fromArray(value);
const maxError=(a,b)=>a.reduce((error,value,i)=>Math.max(error,Math.abs(value-b[i])),0);
const groupOrder=['pelvis','torso','head','upperArmL','forearmL','upperArmR','forearmR','thighL','shinL','footL','thighR','shinR','footR','umbrella'];
const parents={pelvis:null,torso:'pelvis',head:'torso',upperArmL:'torso',forearmL:'upperArmL',upperArmR:'torso',forearmR:'upperArmR',thighL:'pelvis',shinL:'thighL',footL:'shinL',thighR:'pelvis',shinR:'thighR',footR:'shinR',umbrella:'forearmR'};
export const SOURCE_TO_BLENDER=new THREE.Matrix4().set(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1).toArray();

/** Both the object transform and its mesh-local coordinates change basis. */
export function toBlenderMatrix(source){const c=matrix(SOURCE_TO_BLENDER);return c.clone().multiply(matrix(source)).multiply(c.clone().invert()).toArray();}

// This offline adapter is deliberately checked against actual runtime matrices
// at every exported workshop sample. It adds no work to the browser animator.
export function animationGroup(piece){
  const side=piece.x<0?'L':'R';
  if(piece.umbrella)return 'umbrella';
  if(piece.motion===1||piece.motion===2)return (piece.y<.3?'foot':piece.y>.57?'thigh':'shin')+side;
  if(piece.motion===3||piece.motion===4)return 'forearm'+side;
  if(Math.abs(piece.x)>=.255&&piece.y>=1.2&&piece.y<1.5)return 'upperArm'+side;
  if(piece.y>=.98)return piece.y>=1.45?'head':'torso';
  return 'pelvis';
}
export function physicalGroup(piece){
  if(piece.umbrella)return 'umbrella';
  if(piece.motion===1||piece.motion===2)return (piece.y>.57?'thigh':'shin')+(piece.motion===1?'L':'R');
  if(piece.motion===3||piece.motion===4)return (piece.y>1.15?'upperArm':'forearm')+(piece.motion===3?'L':'R');
  if(Math.abs(piece.x)>=.255&&piece.y>=1.2&&piece.y<1.5)return 'upperArm'+(piece.x<0?'L':'R');
  return piece.y>=1.45?'head':piece.y<.98?'pelvis':'torso';
}

function manifestVehicle(scene,placement){
  const manifest=JSON.parse(fs.readFileSync(path.join(projectRoot,'blender/asset-manifest.json'),'utf8'));
  const spec=manifest.assets?.interceptor||manifest.interceptor;
  if(!spec?.gltf_min||!spec?.gltf_max)throw new Error('The interceptor manifest must include exact GLB local bounds');
  const vertices=[];for(const x of[spec.gltf_min[0],spec.gltf_max[0]])for(const y of[spec.gltf_min[1],spec.gltf_max[1]])for(const z of[spec.gltf_min[2],spec.gltf_max[2]])vertices.push(x,y,z);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const visual=new THREE.Group(),material=new THREE.MeshBasicMaterial();visual.add(new THREE.Mesh(geometry,material));
  visual.position.set(placement.x,placement.y,placement.z);visual.rotation.y=placement.ry;scene.add(visual);
  return {visual,localBounds:{min:spec.gltf_min,max:spec.gltf_max},dispose(){geometry.dispose();material.dispose();visual.removeFromParent();}};
}

/** Same initialization order as main, ending before any simulation/traffic tick. */
export function createFrameZeroCharacterContext(){
  const layout=createCityLayout(),population=createCityPopulation({districts:layout.districts});
  const authored=structuredClone(population.people);
  const surfaces=layout.boxes.filter(v=>v.kind==='pavement'&&v.sx>=1&&v.sz>=1&&v.y+v.sy/2>=.08&&v.y+v.sy/2<=.4);
  const groundHeightAt=createGroundHeightSampler(surfaces);
  const serviceSource={boxes:layout.boxes,streetDetails:layout.streetDetails,roads:layout.roads,districts:layout.districts,colliders:layout.colliders,buildings:layout.buildings};
  const recipes=createServiceFixtures({source:serviceSource,sites:createCityServices({layout:serviceSource,groundHeightAt}).list()});
  const street=createStreetCollisionLayout(layout,{excludedBoxIds:new Set(recipes.removedBoxIds)});
  const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
  const mesh=new THREE.InstancedMesh(geometry,material,population.people.reduce((n,p)=>n+p.pieces.length,0));scene.add(mesh);
  const staticColliders=[...layout.colliders,...street.staticColliders];
  const civilians=createCivilianSystem({people:population.people,mesh,colliders:staticColliders,groundHeightAt,bounds:layout.bounds});
  const own=SCENE_PLACEMENTS.interceptor,hero=SCENE_PLACEMENTS.mercenary;
  let simulation=null,serviceWorld=null;
  const traffic=createTrafficController({getPlayerPosition:()=>({x:hero.x,y:1.75,z:hero.z}),getVehicleBlockers:()=>[
    {id:own.id,x:own.x,z:own.z,yaw:own.ry,halfWidth:own.sx/2,halfLength:own.sz/2},
    ...(simulation?.streetPhysics.getColliders().filter(c=>c.kind==='vehicle')||[]),
  ]});
  simulation=createSimulation({scene,camera:new THREE.PerspectiveCamera(),colliders:layout.colliders,streetColliders:street.staticColliders,groundSurfaces:surfaces,dynamicProps:street.dynamicProps,groundHeightAt,bounds:layout.bounds,patrolRoutes:layout.patrolRoutes,civilians,getExternalSolids:()=>serviceWorld?.getColliders()||[]});
  const parked=manifestVehicle(scene,SCENE_PLACEMENTS.parkedCar);
  simulation.streetPhysics.addObject({...SCENE_PLACEMENTS.parkedCar,visual:parked.visual,mass:1250,kind:'vehicle'});
  traffic.attachPhysics({world:simulation.world,material:simulation.physicsMaterial,groundHeightAt});
  serviceWorld=createServiceWorld({scene,recipes});serviceWorld.attachPhysics({world:simulation.world,material:simulation.physicsMaterial});
  const ownedCollider={id:own.id,x:own.x,y:own.y+.68,z:own.z,sx:2.8,sy:1.28,sz:5.2,ry:own.ry};
  const dynamicProvider=()=>[...simulation.getSolidProps(),...traffic.getTrafficColliders(),ownedCollider];
  civilians.setObstacleProvider(dynamicProvider);
  return {layout,population,authored,people:population.people,scene,mesh,civilians,simulation,traffic,serviceWorld,recipes,street,staticColliders,dynamicProvider,groundHeightAt,surfaces,ownedCollider,parked,
    dispose(){serviceWorld.dispose();traffic.dispose();simulation.dispose();parked.dispose();mesh.dispose();geometry.dispose();material.dispose();}};
}

function anchorFor(group,state,parts,representative,scale){
  const j=state.jointPositions;
  if(group==='pelvis')return j.hipL.clone().add(j.hipR).multiplyScalar(.5);
  if(group==='torso')return j.waist.clone();
  if(group==='head')return j.neck.clone();
  const side=group.endsWith('L')?'L':'R';
  for(const [prefix,joint]of[['upperArm','shoulder'],['forearm','elbow'],['thigh','hip'],['shin','knee']])if(group.startsWith(prefix))return j[joint+side].clone();
  if(group.startsWith('foot')){const foot=state.feet.find(f=>f.side===side);return new THREE.Vector3(foot.x,foot.y+.135*scale,foot.z);}
  return new THREE.Vector3().setFromMatrixPosition(parts[representative].matrix);
}

function bindCharacter(person){
  const state=person.gait.getState(),unitScale=new THREE.Vector3(person.scale,person.scale,person.scale);
  const root=new THREE.Matrix4().compose(new THREE.Vector3(person.x,person.groundY,person.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),state.yaw),unitScale);
  const groups=[],byName=new Map();
  for(const name of groupOrder){
    const representative=person.parts.findIndex(part=>animationGroup(part.piece)===name);if(representative<0)continue;
    const position=anchorFor(name,state,person.parts,representative,person.scale),orientation=state.segmentOrientations[name];
    if(!orientation)throw new Error('Missing runtime orientation '+name);
    const world=new THREE.Matrix4().compose(position,orientation,unitScale),parent=byName.get(parents[name]);
    const record={name,parent:parents[name],representativePart:representative,bindWorldMatrix:world.toArray(),bindParentMatrix:(parent?matrix(parent.bindWorldMatrix):root.clone()).invert().multiply(world).toArray()};
    groups.push(record);byName.set(name,record);
  }
  const parts=person.parts.map((part,localIndex)=>{const group=animationGroup(part.piece),bind=byName.get(group);return {localIndex,instanceIndex:part.index,group,physicalGroup:physicalGroup(part.piece),worldMatrix:part.matrix.toArray(),localBindMatrix:matrix(bind.bindWorldMatrix).invert().multiply(part.matrix).toArray()};});
  let error=0;for(const part of parts)error=Math.max(error,maxError(matrix(byName.get(part.group).bindWorldMatrix).multiply(matrix(part.localBindMatrix)).elements,part.worldMatrix));
  if(error>1e-10)throw new Error('Native frame-zero grouping mismatch '+person.id+': '+error);
  return {rootWorldMatrix:root.toArray(),groups,parts,error,joints:Object.fromEntries(Object.entries(state.jointPositions).map(([name,p])=>[name,p.toArray()]))};
}

/** Four finite workshop clips, sampled from real accepted-distance gait poses. */
export function createWorkshopSamples(authored){
  const ordinary=authored.findIndex(p=>!p.pieces.some(v=>v.umbrella)),umbrella=authored.findIndex(p=>p.pieces.some(v=>v.umbrella));
  const clips=[];let maximumReconstructionError=0,sampledPartMatrices=0;
  for(const sourceIndex of[ordinary,umbrella])for(const mode of['walk-stop-turn','flee-curb']){
    const source=authored[sourceIndex],terrain=mode==='flee-curb'?{base:.057,platform:{minX:-20,maxX:20,minZ:2.5,maxZ:20,height:.165}}:{base:.057,platform:null};
    const ground=(x,z)=>terrain.platform&&x>=-20&&x<=20&&z>=2.5&&z<=20?.165:.057;
    const gait=createCivilianMotion({scale:source.scale,phase:source.phase,umbrella:source.pieces.some(p=>p.umbrella),groundHeightAt:ground});
    let x=0,z=0;gait.reset({x,z,yaw:0,groundY:ground(x,z)});
    const person={id:`CIV-${String(sourceIndex+1).padStart(3,'0')}`,x,z,groundY:ground(x,z),scale:source.scale,gait,parts:source.pieces.map((piece,index)=>({piece,index,matrix:gait.writePartMatrix(piece,new THREE.Matrix4())}))};
    const binding=bindCharacter(person),initialInverse=binding.parts.map(p=>matrix(p.worldMatrix).invert());
    const frames=[],duration=mode==='flee-curb'?5:7,steps=duration*60;
    const controls=mode==='flee-curb'?[{until:3.3,vx:0,vz:2.6,fleeing:true},{until:5,vx:0,vz:0,fleeing:true}]:[{until:2,vx:0,vz:.7,fleeing:false},{until:3,vx:0,vz:0,fleeing:false},{until:5,vx:.7,vz:0,fleeing:false},{until:7,vx:0,vz:0,fleeing:false}];
    for(let frame=0;frame<=steps;frame++){
      const time=frame/60;
      if(frame){const command=controls.find(c=>(frame-1)/60<c.until)||controls.at(-1);
        const desired=gait.plan(1/60,command);x+=desired.dx;z+=desired.dz;gait.update(1/60,{x,z,groundY:ground(x,z),fleeing:command.fleeing});
      }
      if(frame%2)continue;
      const actual=person.parts.map(p=>gait.writePartMatrix(p.piece,new THREE.Matrix4())),worlds=new Map();
      for(const group of binding.groups){const index=group.representativePart;worlds.set(group.name,actual[index].clone().multiply(initialInverse[index]).multiply(matrix(group.bindWorldMatrix)));}
      for(const part of binding.parts){maximumReconstructionError=Math.max(maximumReconstructionError,maxError(worlds.get(part.group).clone().multiply(matrix(part.localBindMatrix)).elements,actual[part.localIndex].elements));sampledPartMatrices++;}
      const state=gait.getState(),root=new THREE.Matrix4().compose(new THREE.Vector3(x,ground(x,z),z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),state.yaw),new THREE.Vector3(source.scale,source.scale,source.scale));
      frames.push({time,rootWorldMatrix:root.toArray(),groups:binding.groups.map(group=>(group.parent?worlds.get(group.parent):root).clone().invert().multiply(worlds.get(group.name)).toArray()),feet:state.feet,phase:state.phase,distance:state.distance,speed:state.speed});
    }
    clips.push({id:person.id+'-'+mode,sourceCivilianId:person.id,sourceIndex,mode,scale:source.scale,terrain,controls,sampleRate:30,plannerRate:60,duration,binding:{rootWorldMatrix:binding.rootWorldMatrix,groups:binding.groups,parts:binding.parts,joints:binding.joints},frames});
  }
  if(maximumReconstructionError>1e-9)throw new Error('Workshop group adapter is not rigid: '+maximumReconstructionError);
  return {clips,verification:{maximumReconstructionError,sampledPartMatrices},notes:['World root movement is accepted unblocked on the declared workshop terrain; these are not recordings of city routes.','Only group transforms are keyed. Mesh-local part binds stay fixed for the entire clip.','Shoes are independent live groups; the physical shin retains separate calf/boot collision shapes.']};
}

function sourceHashes(){
  const names=fs.readdirSync(path.join(projectRoot,'src')).filter(name=>name.endsWith('.js')).map(name=>'src/'+name);
  names.push('blender/asset-manifest.json','package.json','scripts/export-native-characters.mjs');
  return Object.fromEntries(names.sort().map(name=>[name,digest(fs.readFileSync(path.join(projectRoot,name)))]));
}

export function createNativeCharacterExport({includeWorkshop=true,onRuntimeReady}={}){
  const context=createFrameZeroCharacterContext();
  try{
    onRuntimeReady?.(context);
    const {authored,people,population,mesh,civilians,simulation,traffic,serviceWorld}=context;
    const templates=[],templateByHash=new Map();let maximumReconstructionError=0,maximumUploadRoundingError=0;
    const characters=people.map((person,i)=>{
      const hash=digest(authored[i].pieces);let templateId=templateByHash.get(hash);
      if(!templateId){templateId='TEMPLATE-'+String(templates.length+1).padStart(3,'0');templateByHash.set(hash,templateId);templates.push({id:templateId,sha256:hash,pieces:authored[i].pieces.map((p,index)=>({...p,index,animationGroup:animationGroup(p),physicalGroup:physicalGroup(p)}))});}
      const binding=bindCharacter(person);maximumReconstructionError=Math.max(maximumReconstructionError,binding.error);
      for(const part of person.parts)for(let n=0;n<16;n++)maximumUploadRoundingError=Math.max(maximumUploadRoundingError,Math.abs(part.matrix.elements[n]-mesh.instanceMatrix.array[part.index*16+n]));
      const {pieces,...placement}=authored[i];
      return{id:person.id,templateId,authored:placement,resolved:{x:person.x,z:person.z,groundY:person.groundY,yaw:person.yaw,scale:person.scale,crowdRadius:person.crowdRadius},rootWorldMatrix:binding.rootWorldMatrix,groups:binding.groups,parts:binding.parts,joints:binding.joints};
    });
    const dynamic=context.dynamicProvider(),navigation=civilians.getNavigationState(),services=serviceWorld.getColliders();
    return {schema:'neon-district-native-characters',version:1,coordinateSystem:{source:'Three.js Y-up, metres',native:'Blender Z-up, metres',matrixStorage:'column-major',sourceToNative:SOURCE_TO_BLENDER,conversion:'Convert object matrices C*M*inverse(C) and mesh-local coordinates C*v; part matrices transform a centred unit cube.'},sourceHashes:sourceHashes(),
      authoredPopulationSHA256:digest(authored),airTrafficSHA256:digest(population.airTraffic),rng:population.rng,
      counts:{people:people.length,umbrellaPeople:people.filter(p=>p.pieces.some(v=>v.umbrella)).length,voxelPieces:mesh.count,templates:templates.length,airTraffic:population.airTraffic.length},
      palette:[...new Set(templates.flatMap(t=>t.pieces.map(p=>p.c)))].sort().map(srgbHex=>({srgbHex,linearRGB:new THREE.Color(srgbHex).toArray()})),
      colorPolicy:'Piece c values are sRGB hex strings. Assign palette.linearRGB to Blender scene-linear material inputs; these are the same values used by Three instance colors.',templates,characters,airTraffic:population.airTraffic,
      initialization:{worldTime:simulation.world.time,physicsSteps:simulation.world.stepnumber,trafficTimeAdvanced:false,civilianTimeAdvanced:false,order:['static navigation constructor/reset','traffic occupancy initialization','simulation and street props','manifest-bounded parked vehicle','grounded traffic physics attachment','idle service mechanisms','live obstacle provider with spawn clearance'],navigation,
        staticColliderCount:context.staticColliders.length,staticCollidersSHA256:digest(context.staticColliders),dynamicColliderCount:dynamic.length,dynamicColliders:dynamic,dynamicCollidersSHA256:digest(dynamic),groundSurfaces:context.surfaces.map(({x,y,z,sx,sy,sz,ry})=>({x,y,z,sx,sy,sz,ry})),serviceSolidParts:services.length,removedStaticServiceBoxIds:context.recipes.removedBoxIds,traffic:traffic.getTrafficState(),ownedNavigationHull:context.ownedCollider,parkedLocalManifestBounds:context.parked.localBounds,supplySupports:simulation.getSupportProps(),supplySupportPolicy:'Physical foundations are retained as context, but are not added to living navigation: that matches main initialization.'},
      verification:{maximumReconstructionError,maximumUploadRoundingError,instanceFloat32SHA256:digest(new Uint8Array(mesh.instanceMatrix.array.buffer,mesh.instanceMatrix.array.byteOffset,mesh.instanceMatrix.array.byteLength)),instanceColorFloat32SHA256:digest(new Uint8Array(mesh.instanceColor.array.buffer,mesh.instanceColor.array.byteOffset,mesh.instanceColor.array.byteLength)),allMatricesFinite:characters.every(p=>p.parts.every(part=>part.worldMatrix.every(Number.isFinite))),canonicalMatrices:'Actual Float64 p.parts matrices; GPU instance upload is Float32 and has its own hash. JSON preserves numeric values but normalizes signed zero.'},
      workshop:includeWorkshop?createWorkshopSamples(authored):null};
  }finally{context.dispose();}
}

export function exportSummary(data){return{schema:data.schema,version:data.version,counts:data.counts,authoredPopulationSHA256:data.authoredPopulationSHA256,airTrafficSHA256:data.airTrafficSHA256,sourceHashes:data.sourceHashes,initialization:{worldTime:data.initialization.worldTime,physicsSteps:data.initialization.physicsSteps,staticColliderCount:data.initialization.staticColliderCount,dynamicColliderCount:data.initialization.dynamicColliderCount,serviceSolidParts:data.initialization.serviceSolidParts,spawnCorrections:data.initialization.navigation.spawnCorrections},verification:data.verification,workshop:data.workshop?{clips:data.workshop.clips.length,frames:data.workshop.clips.reduce((n,c)=>n+c.frames.length,0),...data.workshop.verification}:null};}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
  if(args.includes('--help'))console.log('node scripts/export-native-characters.mjs --output <characters.json.gz> [--summary <report.json>] [--no-workshop]\nPaths resolve from the current directory. No Blender file is opened or changed.');
  else{
    const output=option('--output');if(!output)throw new Error('An explicit --output path is required; importing this module writes nothing.');
    const data=createNativeCharacterExport({includeWorkshop:!args.includes('--no-workshop')}),json=JSON.stringify(data),bytes=output.endsWith('.gz')?gzipSync(json,{level:9}):Buffer.from(json);
    fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,bytes);
    const summary={...exportSummary(data),output:path.resolve(output),bytes:bytes.length,sha256:digest(bytes)};
    const report=option('--summary');if(report){fs.mkdirSync(path.dirname(path.resolve(report)),{recursive:true});fs.writeFileSync(report,JSON.stringify(summary,null,2)+'\n');}
    console.log(JSON.stringify({output:summary.output,bytes:summary.bytes,sha256:summary.sha256,counts:data.counts,verification:data.verification,workshop:summary.workshop}));
  }
}
