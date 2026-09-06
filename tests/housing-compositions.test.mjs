import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createCityLayout} from '../src/city-layout.js';
import {applyHousingCompositions,createHousingComposition} from '../src/housing-compositions.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';
import {createGroundHeightSampler} from '../src/ground-height.js';
import {createPlayerMovement} from '../src/player-movement.js';
import {createCityServices} from '../src/city-services.js';
import {createServiceFixtures,evaluateServiceFixture} from '../src/service-fixtures.js';

const results=[],hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function test(name,run){const evidence=run();results.push({name,pass:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}
const bounds=b=>{const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0));return{minX:b.x-(c*b.sx+s*b.sz)/2,maxX:b.x+(c*b.sx+s*b.sz)/2,minY:b.y-b.sy/2,maxY:b.y+b.sy/2,minZ:b.z-(s*b.sx+c*b.sz)/2,maxZ:b.z+(s*b.sx+c*b.sz)/2};};
const contact=(a,b)=>a.minX<=b.maxX+.0005&&a.maxX>=b.minX-.0005&&a.minY<=b.maxY+.0005&&a.maxY>=b.minY-.0005&&a.minZ<=b.maxZ+.0005&&a.maxZ>=b.minZ-.0005;
const paving=layout=>layout.boxes.filter(b=>b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>=.08&&b.y+b.sy/2<=.4);
const source=createCityLayout();
// Undo the later Iron Docks layer first. This restores its exact old slots and
// removes only its own appended geometry/metadata before the housing fixture.
if(source.ironDocksCompositions){
 const d=source.ironDocksCompositions,boxIds=new Set(d.boxes.map(b=>b.id)),assemblyIds=new Set(d.assemblies.map(a=>a.id)),pathIds=new Set(d.paths.map(p=>p.id)),supportIds=new Set(d.supports.map(s=>s.id));
 assert.equal(d.replacements.length,147);
 source.boxes=source.boxes.slice(0,d.sourceBoxCount);for(const r of d.replacements)source.boxes[r.sourceIndex]=r.original;
 source.colliders=source.colliders.filter(b=>!boxIds.has(b.sourceBoxId));
 source.supports=source.supports.filter(s=>!supportIds.has(s.id));source.blueprint.supports=[...source.supports];
 source.blockCompositions={...source.blockCompositions,
  assemblies:source.blockCompositions.assemblies.filter(a=>!assemblyIds.has(a.id)),paths:source.blockCompositions.paths.filter(p=>!pathIds.has(p.id)),
  addedVoxelModules:source.blockCompositions.addedVoxelModules-d.addedVoxelModules,replacedSourceRecords:source.blockCompositions.replacedSourceRecords-d.replacedSourceRecords};
 delete source.blockCompositions.ironDocksReplacements;delete source.blockCompositions.ironDocksSupportGraphs;
 source.blueprint.blockCompositions=source.blockCompositions;delete source.ironDocksCompositions;delete source.blueprint.ironDocksCompositions;
 assert.equal(source.blockCompositions.assemblies.length,24);assert.equal(source.blockCompositions.addedVoxelModules,1459);
}
// The suite works before the opt-in hook and after root later enables it.
// Restore exactly the declared delta to obtain the same authoritative source.
if(source.housingCompositions){
 const h=source.housingCompositions,ids=new Set(h.boxes.map(b=>b.id));
 source.boxes=source.boxes.slice(0,h.sourceBoxCount);for(const r of h.replacements)source.boxes[r.sourceIndex]=r.original;
 source.colliders=source.colliders.filter(b=>!ids.has(b.sourceBoxId));
 const oldGroups=h.replacedAssemblies;
 assert(oldGroups,'Integrated housing must retain full replaced assembly records');
 source.blockCompositions={...source.blockCompositions,assemblies:[...source.blockCompositions.assemblies.filter(a=>!h.assemblies.some(v=>v.id===a.id)),...oldGroups],
  paths:source.blockCompositions.paths.filter(p=>!h.paths.some(v=>v.id===p.id)),entrances:source.blockCompositions.entrances.filter(p=>!h.entrances.some(v=>v.id===p.id)),
  addedVoxelModules:765,replacedSourceRecords:54};
 const supportIds=new Set(h.supports.map(s=>s.id));source.supports=source.supports.filter(s=>!supportIds.has(s.id));
 source.supports.push(...h.replacedSupports);source.blueprint.supports=[...source.supports];delete source.housingCompositions;delete source.blueprint.housingCompositions;
}
const original={boxes:[...source.boxes],colliders:[...source.colliders],supports:[...source.supports],block:source.blockCompositions};
const groundBefore=createGroundHeightSampler(paving(source)),sitesBefore=createCityServices({layout:source,groundHeightAt:groundBefore}).list();
const fixturesBefore=createServiceFixtures({source,sites:sitesBefore}),recipe=createHousingComposition(source);

test('Recipe exactly reproduces the reviewed 726-module coordinate oracle without mutation',()=>{
 assert.equal(hash(recipe.boxes),'b59fe8d1f1ecc6c1e1d7f7f960d10609f68a0c97dfbfb2325f6dd9fcf2787fe4');
 assert.equal(hash(recipe),hash(createHousingComposition(source)));assert.equal(recipe.boxes.length,726);assert.equal(recipe.replacements.length,117);
 assert.equal(source.boxes.length,original.boxes.length);assert(source.boxes.every((b,i)=>b===original.boxes[i]));assert.equal(source.blockCompositions,original.block);
 return{modules:recipe.boxes.length,replacements:recipe.replacements.length};
});
test('Every one of the 117 changed source slots fails before any application mutation',()=>{
 const pointers={boxes:source.boxes,colliders:source.colliders,supports:source.supports,blueprint:source.blueprint.supports,block:source.blockCompositions};
 for(const r of recipe.replacements){const old=source.boxes[r.sourceIndex];source.boxes[r.sourceIndex]={...old,x:old.x+.00001};
  assert.throws(()=>applyHousingCompositions(source),new RegExp('Housing source slot changed: '+r.sourceIndex));
  assert.equal(source.boxes,pointers.boxes);assert.equal(source.colliders,pointers.colliders);assert.equal(source.supports,pointers.supports);assert.equal(source.blueprint.supports,pointers.blueprint);assert.equal(source.blockCompositions,pointers.block);
  source.boxes[r.sourceIndex]=old;
 }
 const host=source.buildings.find(b=>b.id==='B102'),before=host.sx;host.sx+=.001;assert.throws(()=>applyHousingCompositions(source),/Housing host changed: B102/);host.sx=before;
 return{sourceSlots:117,hostDriftRejected:true};
});
const preserved=Object.fromEntries(['roads','bounds','signs','advertPlacements','streetDetails','buildings'].map(k=>[k,hash(source[k])]));
applyHousingCompositions(source);
const h=source.housingCompositions,byId=new Map(source.boxes.filter(b=>b.id).map(b=>[b.id,b]));
test('Application preserves untouched records, history, service anchors and all mounted campaigns',()=>{
 const changed=new Set(h.replacements.map(r=>r.sourceIndex));assert.equal(source.boxes.length,original.boxes.length+609);
 assert(original.boxes.every((b,i)=>changed.has(i)||source.boxes[i]===b));
 for(const [k,value]of Object.entries(preserved))assert.equal(hash(source[k]),value,k);
 assert.equal(hash(source.blockCompositions.replacements),hash(original.block.replacements));
 assert.deepEqual(source.blockCompositions.paths.slice(0,original.block.paths.length),original.block.paths);
 assert.equal(source.blockCompositions.assemblies.length,24);assert.equal(source.blockCompositions.addedVoxelModules,1459);
 assert.equal(source.blockCompositions.housingReplacements.length,117);assert.equal(source.blockCompositions.replacedSourceRecords,171);
 for(const a of source.blockCompositions.assemblies)for(const id of a.boxIds)assert(byId.has(id),'Dangling native assembly member '+id);
 const ground=createGroundHeightSampler(paving(source)),sites=createCityServices({layout:source,groundHeightAt:ground}).list(),fixtures=createServiceFixtures({source,sites});
 assert.deepEqual(sites,sitesBefore);assert.deepEqual(fixtures,fixturesBefore);
 assert.throws(()=>applyHousingCompositions(source),/already applied/);
 return{netModules:609,assemblies:24,authoredModules:1459,services:sites.length,mechanismParts:fixtures.recipes.reduce((n,r)=>n+r.parts.length,0),signs:source.signs.length,campaigns:source.advertPlacements.length};
});
test('Every physical support-graph edge is in contact and all 726 pieces reach ground or actual host',()=>{
 let pieces=0,edges=0;
 for(const graph of h.supportGraphs){const visited=new Set();
  for(const root of graph.roots){const b=byId.get(root.id),q=bounds(b);if(root.attachedTo==='GROUND')assert(q.minY<=.1855);else{const host=source.buildings.find(v=>v.id===root.attachedTo);assert(host.sections.some(v=>contact(q,bounds(v))));}visited.add(root.id);}
  let change=true;while(change){change=false;for(const e of graph.edges){assert(contact(bounds(byId.get(e.from)),bounds(byId.get(e.to))));if(visited.has(e.to)&&!visited.has(e.from)){visited.add(e.from);change=true;}}}
  assert.equal(visited.size,graph.members);pieces+=visited.size;edges+=graph.edges.length;
  for(const e of graph.externalContacts)assert(contact(bounds(byId.get(e.from)),bounds(byId.get(e.to))));
 }
 assert.equal(pieces,726);assert(h.supportGraphs.at(-1).externalContacts.length>=2);
 const oldIds=new Set(h.replacements.map(r=>r.original.supportId).filter(Boolean));assert(source.supports.every(s=>!oldIds.has(s.id)));
 for(const a of h.assemblies)for(const id of a.supportIds)assert(source.supports.some(s=>s.id===id));
 return{groundedOrAttachedPieces:pieces,verifiedGraphEdges:edges,supportRecords:h.supports.length};
});
function segmentHits(a,b,box,pad=0){const c=Math.cos(box.ry||0),s=Math.sin(box.ry||0),p=[(a.x-box.x)*c-(a.z-box.z)*s,a.y-box.y,(a.x-box.x)*s+(a.z-box.z)*c],q=[(b.x-box.x)*c-(b.z-box.z)*s,b.y-box.y,(b.x-box.x)*s+(b.z-box.z)*c],half=[box.sx/2+pad,box.sy/2+pad,box.sz/2+pad];let lo=.00001,hi=.99999;for(let i=0;i<3;i++){const d=q[i]-p[i];if(Math.abs(d)<1e-9){if(Math.abs(p[i])>half[i])return false;}else{let u=(-half[i]-p[i])/d,v=(half[i]-p[i])/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return false;}}return true;}
test('Road and pedestrian reserves plus all 3888 mounted campaign view rays remain clear',()=>{
 let lanes=0,rays=0;
 for(const road of source.roads){const vertical=road.sz>road.sx;for(const [offset,radius]of[[-6,1.45],[0,1.45],[6,1.45],[-13.4,.45],[-12.7,.45],[12.7,.45],[13.4,.45]]){
  const a={x:vertical?road.x+offset:road.x-road.sx/2,y:1.15,z:vertical?road.z-road.sz/2:road.z+offset},b={x:vertical?road.x+offset:road.x+road.sx/2,y:1.15,z:vertical?road.z+road.sz/2:road.z+offset};
  for(const box of h.boxes)if(box.y-box.sy/2<2.4&&box.y+box.sy/2>.31)assert(!segmentHits(a,b,{...box,sy:box.sy+2.2},radius),'Road obstruction '+box.id);lanes++;
 }}
 for(const ad of source.advertPlacements){const n={x:Math.sin(ad.ry),z:Math.cos(ad.ry)},t={x:Math.cos(ad.ry),z:-Math.sin(ad.ry)};
  for(let u=0;u<9;u++)for(let v=0;v<9;v++){const end={x:ad.x+t.x*ad.w*(u/8-.5)*.992+n.x*.075,y:ad.y+ad.h*(v/8-.5)*.992,z:ad.z+t.z*ad.w*(u/8-.5)*.992+n.z*.075};for(const b of h.boxes)assert(!segmentHits(ad.roadVantage,end,b,.008),'Campaign blocked '+ad.signId+' by '+b.id);rays++;}
 }return{laneSegments:lanes,campaignRays:rays};
});
const fixtures=createServiceFixtures({source,sites:sitesBefore}),physical=createStreetCollisionLayout(source,{excludedBoxIds:new Set(fixtures.removedBoxIds)});
const solids=[...source.colliders,...physical.staticColliders,...physical.groundSurfaces,...fixtures.recipes.flatMap(r=>evaluateServiceFixture(r,{phase:'idle'}).boxes.filter(p=>p.solid))];
const grid=new Map(),cell=8;for(const b of solids){const q=bounds(b);for(let x=Math.floor(q.minX/cell);x<=Math.floor(q.maxX/cell);x++)for(let z=Math.floor(q.minZ/cell);z<=Math.floor(q.maxZ/cell);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);}}
function query(x,z,r=1){const found=new Set();for(let ix=Math.floor((x-r)/cell);ix<=Math.floor((x+r)/cell);ix++)for(let iz=Math.floor((z-r)/cell);iz<=Math.floor((z+r)/cell);iz++)for(const b of grid.get(ix+','+iz)||[])found.add(b);return[...found];}
const ground=createGroundHeightSampler(paving(source));
test('Individual collision boxes include the 366 high facade pieces while ground stays below the landing',()=>{
 assert.equal(h.upperColliders.length,366);assert.deepEqual(source.colliders.slice(0,original.colliders.length),original.colliders);
 for(const c of h.upperColliders){const b=byId.get(c.sourceBoxId);for(const key of['x','y','z','sx','sy','sz','ry'])assert.equal(c[key],b[key]);assert(c.y-c.sy/2>=5.5);}
 assert.equal(ground(-188.8,-259.65),.185);
 const derived=new Set(physical.staticColliders.map(c=>c.sourceIndex));
 for(const b of h.boxes.filter(b=>b.role==='walkable tread'||b.role==='walkable landing slab'))assert(derived.has(source.boxes.indexOf(b)));
 return{upperShapes:366,collisionShapes:solids.length,baseUnderLanding:ground(-188.8,-259.65),landingFloor:h.stairs.landingY};
});
function overlapsBody(p,c){const feet=p.y-1.75;if(c.y+c.sy/2<=feet+.002||c.y-c.sy/2>=feet+1.898)return false;const cs=Math.cos(c.ry||0),sn=Math.sin(c.ry||0),dx=p.x-c.x,dz=p.z-c.z,x=dx*cs-dz*sn,z=dx*sn+dz*cs;return Math.hypot(x-Math.max(-c.sx/2,Math.min(c.sx/2,x)),z-Math.max(-c.sz/2,Math.min(c.sz/2,z)))<.398;}
function walk(points,hz){const p=new THREE.Vector3(points[0].x,ground(points[0].x,points[0].z)+1.75,points[0].z),movement=createPlayerMovement({position:p,groundHeightAt:ground,getColliders:query,bounds:source.bounds});let maxY=p.y-1.75,maxRise=0,frames=0;
 for(const target of points.slice(1)){let arrived=false;for(let frame=0;frame<hz*18;frame++){const d=Math.hypot(target.x-p.x,target.z-p.z);if(d<.055){arrived=true;break;}const old=p.y;movement.update(1/hz,{yaw:Math.atan2(-(target.x-p.x),-(target.z-p.z)),forward:Math.min(.52,d/1.3)});maxY=Math.max(maxY,p.y-1.75);maxRise=Math.max(maxRise,p.y-old);frames++;assert(!query(p.x,p.z,.5).some(c=>overlapsBody(p,c)),'Upright body penetration at '+p.toArray());}assert(arrived,'Movement stalled before '+JSON.stringify(target)+' at '+p.toArray());}
 return{position:{x:p.x,y:p.y-1.75,z:p.z},maxY,maxRise,seconds:frames/hz};}
const approach=h.paths.find(p=>p.id==='HOUSING-ROAD-TO-STAIR').points,stair=h.paths.find(p=>p.id==='HOUSING-STAIR-TO-LANDING').points,landing=h.paths.find(p=>p.id==='HOUSING-LANDING-SHARED-WALK').points;
for(const hz of[15,60])test('Actual controller reaches landing and continuously descends at '+hz+' Hz',()=>{
 const circuit=walk([...approach,...stair.slice(1),...landing,...landing.slice(0,-1).reverse(),...stair.slice(0,-1).reverse()],hz);
 assert(Math.abs(circuit.maxY-3.065)<.003);assert(Math.abs(circuit.position.y-.185)<.003);assert(circuit.maxRise<=.181);
 return{hz,...circuit};
});
test('Off-center stairs, retained seating approach and walking under the landing remain usable',()=>{
 for(const offset of[-.2,.2]){const route=[stair[0],...stair.slice(1,-3),{x:-189,y:3.065,z:-258.3}].map(p=>({...p,x:p.x+offset}));const result=walk([...route,...route.slice(0,-1).reverse()],60);assert(Math.abs(result.maxY-3.065)<.003);assert(Math.abs(result.position.y-.185)<.003);}
 const seat=walk(h.paths.find(p=>p.id==='HOUSING-STAIR-TO-EXISTING-SEAT').points,60);assert(Math.abs(seat.position.y-.185)<.003);
 const under=walk([{x:-184.6,z:-259.5},{x:-190.3,z:-259.5}],60);assert(Math.abs(under.maxY-.185)<.003);
 return{stairOffsets:[-.2,.2],seat:seat.position,underLanding:under.position};
});
console.log(JSON.stringify({status:'passed',groups:results.length,scope:'Isolated housing recipe with production static layout, service recipes and upright movement; no browser or visual acceptance.'}));
