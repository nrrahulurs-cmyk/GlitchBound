import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createCityLayout} from '../src/city-layout.js';
import {createIronDocksComposition,applyIronDocksCompositions} from '../src/iron-docks-compositions.js';
import {createCityServices} from '../src/city-services.js';
import {createServiceFixtures,evaluateServiceFixture} from '../src/service-fixtures.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';
import {createGroundHeightSampler} from '../src/ground-height.js';
import {createPlayerMovement} from '../src/player-movement.js';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),results=[];
function test(name,run){const evidence=run();results.push({name,passed:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}
const extent=b=>{const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0));return{minX:b.x-(c*b.sx+s*b.sz)/2,maxX:b.x+(c*b.sx+s*b.sz)/2,minY:b.y-b.sy/2,maxY:b.y+b.sy/2,minZ:b.z-(s*b.sx+c*b.sz)/2,maxZ:b.z+(s*b.sx+c*b.sz)/2};};
const contact=(a,b,e=.0001)=>a.minX<=b.maxX+e&&a.maxX>=b.minX-e&&a.minY<=b.maxY+e&&a.maxY>=b.minY-e&&a.minZ<=b.maxZ+e&&a.maxZ>=b.minZ-e;
function overlap(a,b,pad=0){
 if(a.y+a.sy/2<=b.y-b.sy/2-pad||b.y+b.sy/2<=a.y-a.sy/2-pad)return false;
 const c=Math.cos(a.ry||0),s=Math.sin(a.ry||0),d=Math.cos(b.ry||0),t=Math.sin(b.ry||0),aa=[[c,-s],[s,c]],bb=[[d,-t],[t,d]],delta=[b.x-a.x,b.z-a.z];
 for(const axis of[...aa,...bb]){const dot=v=>axis[0]*v[0]+axis[1]*v[1];if(Math.abs(dot(delta))>=Math.abs(dot(aa[0]))*a.sx/2+Math.abs(dot(aa[1]))*a.sz/2+Math.abs(dot(bb[0]))*b.sx/2+Math.abs(dot(bb[1]))*b.sz/2+pad)return false;}return true;
}
function ray(a,b,box,pad=0){
 const c=Math.cos(box.ry||0),s=Math.sin(box.ry||0),ox=a.x-box.x,oz=a.z-box.z,ex=b.x-box.x,ez=b.z-box.z;
 const p=[c*ox-s*oz,a.y-box.y,s*ox+c*oz],q=[c*ex-s*ez,b.y-box.y,s*ex+c*ez],h=[box.sx/2+pad,box.sy/2+pad,box.sz/2+pad];
 let lo=.00001,hi=.99999;for(let i=0;i<3;i++){const d=q[i]-p[i];if(Math.abs(d)<1e-9){if(Math.abs(p[i])>h[i])return false;}else{let u=(-h[i]-p[i])/d,v=(h[i]-p[i])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return false;}}return true;
}
const paving=layout=>layout.boxes.filter(b=>b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>=.08&&b.y+b.sy/2<=.4);
const source=createCityLayout();
// Works with the production hook enabled: reconstruct the exact input layer.
if(source.ironDocksCompositions){
 const d=source.ironDocksCompositions,ids=new Set(d.boxes.map(b=>b.id)),groups=new Set(d.assemblies.map(a=>a.id)),paths=new Set(d.paths.map(p=>p.id)),supports=new Set(d.supports.map(s=>s.id));
 source.boxes=source.boxes.slice(0,d.sourceBoxCount);for(const r of d.replacements)source.boxes[r.sourceIndex]=r.original;
 source.colliders=source.colliders.filter(b=>!ids.has(b.sourceBoxId));source.supports=source.supports.filter(s=>!supports.has(s.id));source.blueprint.supports=[...source.supports];
 source.blockCompositions={...source.blockCompositions,assemblies:source.blockCompositions.assemblies.filter(a=>!groups.has(a.id)),paths:source.blockCompositions.paths.filter(p=>!paths.has(p.id)),addedVoxelModules:source.blockCompositions.addedVoxelModules-d.addedVoxelModules,replacedSourceRecords:source.blockCompositions.replacedSourceRecords-d.replacedSourceRecords};
 delete source.blockCompositions.ironDocksReplacements;delete source.blockCompositions.ironDocksSupportGraphs;source.blueprint.blockCompositions=source.blockCompositions;
 delete source.ironDocksCompositions;delete source.blueprint.ironDocksCompositions;
}
const original={boxes:source.boxes,colliders:source.colliders,supports:source.supports,block:source.blockCompositions,housing:source.housingCompositions};
const recipe=createIronDocksComposition(source),oldGround=createGroundHeightSampler(paving(source)),sitesBefore=createCityServices({layout:source,groundHeightAt:oldGround}).list(),fixturesBefore=createServiceFixtures({source,sites:sitesBefore});
test('Portable factory reproduces all 954 audited voxel modules without source mutation',()=>{
 assert.equal(hash(recipe.boxes),'8bf66ae65637f929855f5f6a4600c2dd21a695913378c678189a61034d66476e');assert.deepEqual(recipe,createIronDocksComposition(source));
 assert.equal(source.boxes,original.boxes);assert.equal(source.blockCompositions,original.block);assert.equal(recipe.boxes.length,954);assert.equal(recipe.replacements.length,147);
 assert(recipe.boxes.every(b=>b.materialProfile in recipe.materials));return{modules:954,replacements:147,materialProfiles:Object.keys(recipe.materials)};
});
test('Every replaced/retained source slot and all four hosts reject drift before any mutation',()=>{
 const slots=[...new Set([...recipe.replacements.map(r=>r.sourceIndex),101696,...recipe.preservedContainerSlots])];
 const pointers={boxes:source.boxes,colliders:source.colliders,supports:source.supports,blueprint:source.blueprint.supports,block:source.blockCompositions};
 for(const index of slots){const old=source.boxes[index];source.boxes[index]={...old,y:old.y+.00001};assert.throws(()=>applyIronDocksCompositions(source),new RegExp('Iron Docks source slot changed: '+index));source.boxes[index]=old;
  assert.equal(source.boxes,pointers.boxes);assert.equal(source.colliders,pointers.colliders);assert.equal(source.supports,pointers.supports);assert.equal(source.blueprint.supports,pointers.blueprint);assert.equal(source.blockCompositions,pointers.block);
 }
 for(const id of['B074','B075','B076','B077']){const host=source.buildings.find(b=>b.id===id),old=host.sections[0].sy;host.sections[0].sy+=.001;assert.throws(()=>applyIronDocksCompositions(source),new RegExp('Iron Docks host changed: '+id));host.sections[0].sy=old;}
 const r=recipe.replacements[0],old=source.boxes[r.sourceIndex];source.boxes[r.sourceIndex]={...old,unexpected:'new support binding'};assert.throws(()=>applyIronDocksCompositions(source),/source slot changed/);source.boxes[r.sourceIndex]=old;
 return{sourceSlots:slots.length,hostRecords:4,unexpectedFieldsRejected:true};
});
const preserved=Object.fromEntries(['roads','bounds','signs','advertPlacements','streetDetails','buildings','housingCompositions','patrolRoutes'].map(k=>[k,hash(source[k])]));
applyIronDocksCompositions(source);const d=source.ironDocksCompositions,byId=new Map(source.boxes.filter(b=>b.id).map(b=>[b.id,b]));
test('Integration preserves housing, all old slots outside 147 replacements, 15 services and 48 campaigns',()=>{
 const changed=new Set(d.replacements.map(r=>r.sourceIndex));assert.equal(source.boxes.length,original.boxes.length+807);assert(original.boxes.every((b,i)=>changed.has(i)||source.boxes[i]===b));
 for(const [key,value]of Object.entries(preserved))assert.equal(hash(source[key]),value,key);assert.deepEqual(source.colliders.slice(0,original.colliders.length),original.colliders);
 assert.equal(source.housingCompositions,original.housing);assert.deepEqual(source.blockCompositions.replacements,original.block.replacements);assert.deepEqual(source.blockCompositions.housingReplacements,original.block.housingReplacements);
 assert.deepEqual(source.blockCompositions.paths.slice(0,original.block.paths.length),original.block.paths);assert.deepEqual(source.blockCompositions.entrances,original.block.entrances);
 assert.equal(source.blockCompositions.assemblies.length,31);assert.equal(source.blockCompositions.addedVoxelModules,2413);assert.equal(source.blockCompositions.replacedSourceRecords,318);
 assert.equal(source.blueprint.blockCompositions,source.blockCompositions);assert.equal(source.blueprint.ironDocksCompositions,d);
 for(const a of source.blockCompositions.assemblies)for(const id of a.boxIds)assert(byId.has(id),'Missing shared/native member '+id);
 const ground=createGroundHeightSampler(paving(source)),sites=createCityServices({layout:source,groundHeightAt:ground}).list(),fixtures=createServiceFixtures({source,sites});
 assert.deepEqual(sites,sitesBefore);assert.deepEqual(fixtures,fixturesBefore);assert.equal(source.advertPlacements.length,48);assert.throws(()=>applyIronDocksCompositions(source),/already applied/);
 return{netModules:807,assemblies:31,authoredModules:2413,services:sites.length,mechanismParts:fixtures.recipes.reduce((n,r)=>n+r.parts.length,0),campaigns:48};
});
test('All 954 actual support paths reach retained hulls, roof, host walls or grade',()=>{
 let connected=0,edges=0;for(const graph of d.supportGraphs){const visited=new Set();
  for(const root of graph.roots){const b=byId.get(root.id),e=extent(b);if(root.attachedTo==='GROUND')assert(e.minY<=oldGround(b.x,b.z)+.0001);else if(root.attachedTo.startsWith('SOURCE-'))assert(contact(e,extent(original.boxes[Number(root.attachedTo.slice(7))])));else{const host=source.buildings.find(b=>b.id===root.attachedTo);assert(host.sections.some(s=>contact(e,extent(s))));}visited.add(root.id);}
  let change=true;while(change){change=false;for(const edge of graph.edges){assert(contact(extent(byId.get(edge.from)),extent(byId.get(edge.to))));if(visited.has(edge.to)&&!visited.has(edge.from)){visited.add(edge.from);change=true;}}}
  assert.equal(visited.size,graph.members);connected+=visited.size;edges+=graph.edges.length;
 }assert.equal(connected,954);assert.equal(edges,503);assert.equal(d.supports.length,451);
 for(const a of d.assemblies)for(const id of a.supportIds){assert(source.supports.some(s=>s.id===id));assert(source.blueprint.supports.some(s=>s.id===id));}
 for(const b of d.boxes)for(const h of source.buildings)if(h.id!==d.assemblies.find(a=>a.id===b.assemblyId).hostBuilding)assert(!overlap(b,h,-.005),'Unrelated building '+h.id+' / '+b.id);
 const protectedRecords=original.boxes.filter(b=>b.chunk==='block-8'&&(b.detail==='district-theme'||b.connectionId||b.supportId));
 for(const b of d.boxes)for(const p of protectedRecords)assert(!overlap(b,p,-.004),'Retained structure intersected by '+b.id);
 return{pieces:954,edges,roots:451,protectedThemeRecords:protectedRecords.length};
});
test('Road/sidewalk reservations, all mounted ads and 9702 existing entrance rays stay clear',()=>{
 let lanes=0,adRays=0,entranceRays=0;for(const road of source.roads){const vertical=road.sz>road.sx;for(const[offset,radius]of[[-6,1.45],[0,1.45],[6,1.45],[-13.4,.45],[-12.7,.45],[12.7,.45],[13.4,.45]]){
  const a={x:vertical?road.x+offset:road.x-road.sx/2,y:1.15,z:vertical?road.z-road.sz/2:road.z+offset},b={x:vertical?road.x+offset:road.x+road.sx/2,y:1.15,z:vertical?road.z+road.sz/2:road.z+offset};
  for(const part of d.boxes)if(part.y-part.sy/2<2.4&&part.y+part.sy/2>.31)assert(!ray(a,b,{...part,sy:part.sy+2.2},radius),'Road obstruction '+part.id);lanes++;
 }}for(const sign of source.signs)for(const b of d.boxes)assert(!overlap(b,{...sign,sx:sign.w,sy:sign.h,sz:.05},-.003),'Artwork intersection '+sign.id);
 for(const sign of source.advertPlacements){const n={x:Math.sin(sign.ry),z:Math.cos(sign.ry)},t={x:Math.cos(sign.ry),z:-Math.sin(sign.ry)};for(let u=0;u<9;u++)for(let v=0;v<9;v++){
  const end={x:sign.x+t.x*sign.w*(u/8-.5)*.992+n.x*.075,y:sign.y+sign.h*(v/8-.5)*.992,z:sign.z+t.z*sign.w*(u/8-.5)*.992+n.z*.075};for(const b of d.boxes)assert(!ray(sign.roadVantage,end,b,.008),'Blocked '+sign.signId);adRays++;
 }}for(const a of source.streetDetails.assemblies){const n={x:Math.sin(a.ry),z:Math.cos(a.ry)},t={x:Math.cos(a.ry),z:-Math.sin(a.ry)},door=a.boxIds.map(id=>byId.get(id)).find(b=>b.role==='closed inset door');
  for(const angle of[-.75,0,.75])for(let u=0;u<7;u++)for(let v=0;v<6;v++){
   const from={x:a.inspectionVantage.x+t.x*angle,y:a.inspectionVantage.y,z:a.inspectionVantage.z+t.z*angle},to={x:door.x+t.x*(u/6-.5)*2.5+n.x*.08,y:a.groundY+.5+v*.39,z:door.z+t.z*(u/6-.5)*2.5+n.z*.08};for(const b of d.boxes)assert(!ray(from,to,b,.001),'Entrance blocked '+a.id);entranceRays++;
  }
 }for(const site of sitesBefore.filter(s=>s.parking))for(const p of site.parking.route)for(const b of d.boxes)assert(!overlap(b,{x:p.x,y:p.y+.7,z:p.z,sx:2.9,sy:1.4,sz:5.28,ry:p.yaw},.04),'Garage route blocked '+site.id);
 return{laneSegments:lanes,campaignRays:adRays,entranceRays,retainedGarageRoutes:sitesBefore.filter(s=>s.parking).length};
});
const fixtures=createServiceFixtures({source,sites:sitesBefore}),physical=createStreetCollisionLayout(source,{excludedBoxIds:new Set(fixtures.removedBoxIds)}),ground=createGroundHeightSampler(paving(source));
const solids=[...source.colliders,...physical.staticColliders,...physical.groundSurfaces,...fixtures.recipes.flatMap(r=>evaluateServiceFixture(r,{phase:'idle'}).boxes.filter(b=>b.solid))];
const grid=new Map(),CELL=8;for(const b of solids){const e=extent(b);for(let x=Math.floor(e.minX/CELL);x<=Math.floor(e.maxX/CELL);x++)for(let z=Math.floor(e.minZ/CELL);z<=Math.floor(e.maxZ/CELL);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);}}
function query(x,z,r=1){const set=new Set();for(let ix=Math.floor((x-r)/CELL);ix<=Math.floor((x+r)/CELL);ix++)for(let iz=Math.floor((z-r)/CELL);iz<=Math.floor((z+r)/CELL);iz++)for(const b of grid.get(ix+','+iz)||[])set.add(b);return[...set];}
function circle(x,z,b,r=.398){const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z,lx=dx*c-dz*s,lz=dx*s+dz*c;return Math.hypot(lx-Math.max(-b.sx/2,Math.min(b.sx/2,lx)),lz-Math.max(-b.sz/2,Math.min(b.sz/2,lz)))<r;}
test('124 upper colliders match visible boxes and ground stays unchanged below the canopy',()=>{
 assert.equal(d.upperColliders.length,124);assert.deepEqual(paving(source),paving({...source,boxes:original.boxes}));assert.equal(ground(184,-28.8),.185);
 for(const c of d.upperColliders){const b=byId.get(c.sourceBoxId);for(const k of['x','y','z','sx','sy','sz','ry'])assert.equal(c[k],b[k]);assert(c.y-c.sy/2>=5.5);}
 assert.equal(original.colliders.length+124,source.colliders.length);return{upperColliders:124,canopyBaseGround:ground(184,-28.8)};
});
test('Four declared pedestrian widths are clear against actual static solids',()=>{
 const measured=[];for(const route of d.paths){let samples=0;for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],count=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06);for(let k=0;k<=count;k++){
   const t=k/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,feet=ground(x,z);samples++;
   for(const c of query(x,z,route.width/2+.1))if(!(c.kind==='pavement'&&c.y+c.sy/2<=feet+.30)&&c.y+c.sy/2>feet+.03&&c.y-c.sy/2<feet+1.9)assert(!circle(x,z,c,route.width/2),'Declared path width blocked '+route.id+' / '+c.id);
  }
 }assert.equal(route.vehicleRoute,false);measured.push({id:route.id,width:route.width,samples});}return{routes:measured};
});
test('Production player controller completes all four route round trips at 15 and 60 Hz',()=>{
 const runs=[];for(const route of d.paths)for(const hz of[15,60]){
  const points=[...route.points,...route.points.slice(0,-1).reverse()],p=new THREE.Vector3(points[0].x,ground(points[0].x,points[0].z)+1.75,points[0].z),movement=createPlayerMovement({position:p,groundHeightAt:ground,getColliders:query,bounds:source.bounds});let frames=0,distance=0;
  for(const target of points.slice(1)){let arrived=false;for(let f=0;f<hz*30;f++){
   const delta=Math.hypot(target.x-p.x,target.z-p.z);if(delta<.07){arrived=true;break;}const before=p.clone();movement.update(1/hz,{yaw:Math.atan2(-(target.x-p.x),-(target.z-p.z)),forward:Math.min(.62,delta/1.2),jump:false});distance+=p.distanceTo(before);frames++;
   const feet=p.y-1.75;for(const c of query(p.x,p.z,.6))if(c.y+c.sy/2>feet+.003&&c.y-c.sy/2<feet+1.898)assert(!circle(p.x,p.z,c),'Body penetration '+route.id+' / '+c.id);
  }assert(arrived,'Stalled before '+JSON.stringify(target)+' at '+p.toArray());}
  assert(Math.abs(p.y-1.75-ground(p.x,p.z))<.003);runs.push({id:route.id,hz,seconds:frames/hz,distanceMetres:distance});
 }return{runs,scope:'CPU accepted input fixture; no browser keyboard or vehicle-route claim'};
});
console.log(JSON.stringify({status:'passed',groups:results.length,geometrySHA256:hash(d.boxes),results}));
