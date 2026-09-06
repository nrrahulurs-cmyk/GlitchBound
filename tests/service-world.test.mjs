import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {createCityLayout} from '../src/city-layout.js';
import {createCityServices} from '../src/city-services.js';
import {createServiceFixtures,evaluateServiceFixture} from '../src/service-fixtures.js';
import {createServiceWorld} from '../src/service-world.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';
import {getKinematicPoseController} from '../src/kinematic-pose.js';

const source=createCityLayout(),sites=createCityServices({layout:source}).list(),fixtures=createServiceFixtures({source,sites}),byId=new Map(source.boxes.filter(b=>b.id).map(b=>[b.id,b]));
const removed=new Set(fixtures.removedBoxIds),results=[];
function test(name,fn){try{const evidence=fn();results.push({name,pass:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}catch(error){results.push({name,pass:false});console.error('FAIL '+name,error.stack);}}
const finite=b=>['x','y','z','sx','sy','sz','ry'].every(k=>Number.isFinite(b[k]))&&Math.min(b.sx,b.sy,b.sz)>0;
function overlap(a,b,tolerance=0){if(a.y+a.sy/2<=b.y-b.sy/2+tolerance||a.y-a.sy/2>=b.y+b.sy/2-tolerance)return false;const aa=a.ry||0,ba=b.ry||0,axes=[[Math.cos(aa),-Math.sin(aa)],[Math.sin(aa),Math.cos(aa)],[Math.cos(ba),-Math.sin(ba)],[Math.sin(ba),Math.cos(ba)]];
 const radius=(b,v)=>Math.abs(v[0]*Math.cos(b.ry||0)-v[1]*Math.sin(b.ry||0))*b.sx/2+Math.abs(v[0]*Math.sin(b.ry||0)+v[1]*Math.cos(b.ry||0))*b.sz/2;
 return axes.every(v=>Math.abs((a.x-b.x)*v[0]+(a.z-b.z)*v[1])<radius(a,v)+radius(b,v)-tolerance);}
function rayHit(from,to,b){const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=from.x-b.x,dz=from.z-b.z,ex=to.x-b.x,ez=to.z-b.z,a=[dx*c-dz*s,from.y-b.y,dx*s+dz*c],end=[ex*c-ez*s,to.y-b.y,ex*s+ez*c],h=[b.sx/2,b.sy/2,b.sz/2];let lo=0,hi=1;for(let i=0;i<3;i++){const d=end[i]-a[i];if(Math.abs(d)<1e-10){if(Math.abs(a[i])>h[i])return false;continue;}let t=(-h[i]-a[i])/d,u=(h[i]-a[i])/d;if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return false;}return true;}
const asLocal=(r,b)=>{const c=Math.cos(r.ry),s=Math.sin(r.ry),dx=b.x-r.origin.x,dz=b.z-r.origin.z;return{...b,x:dx*c-dz*s,y:b.y-r.origin.y,z:dx*s+dz*c,ry:(b.ry||0)-r.ry};};

test('All fifteen existing sites own finite recipes and replace only their fifteen old food shutter slats',()=>{
 assert.equal(fixtures.recipes.length,15);assert.equal(removed.size,15);assert.equal(fixtures.removedBoxIds.length,15);
 for(const id of removed)assert.equal(byId.get(id)?.role,'hatch shutter slat');
 const ids=new Set();for(const r of fixtures.recipes){assert(sites.some(s=>s.id===r.id));for(const part of r.parts){assert(finite(part));assert(!ids.has(part.id));ids.add(part.id);}}
 return{sites:15,parts:ids.size,replaced:15};
});
test('Every visible mechanism and luminous cell remains attached to its facade or connected frame across action poses',()=>{
 let poses=0;for(const r of fixtures.recipes)for(const progress of [0,.2,.5,.8,1]){
  const parts=evaluateServiceFixture(r,{phase:'active',progress,vehicle:r.parking}).boxes;
  const assembly=source.streetDetails.assemblies.find(a=>a.id===r.assemblyId),hosts=assembly.boxIds.filter(id=>!removed.has(id)).map(id=>byId.get(id)).filter(Boolean);
  const connected=new Set();let changed=true;while(changed){changed=false;for(let i=0;i<parts.length;i++){if(connected.has(i))continue;if(hosts.some(h=>overlap(parts[i],h,-.006))||[...connected].some(j=>overlap(parts[i],parts[j],-.006))){connected.add(i);changed=true;}}}
  assert.equal(connected.size,parts.length,r.id+' disconnected: '+parts.filter((_,i)=>!connected.has(i)).map(p=>p.role));poses++;
 }return{attachmentPoses:poses};
});
test('Animation preserves box dimensions, terminal sightlines and standing approaches at all fifteen sites',()=>{
 let samples=0;for(const r of fixtures.recipes){const site=sites.find(s=>s.id===r.id),body={...site.approach,y:site.approach.y-.8,sx:.84,sy:1.9,sz:.84};
  for(let i=0;i<=20;i++){const pose=evaluateServiceFixture(r,{phase:'active',progress:i/20,vehicle:r.parking,position:site.approach});for(const [j,p] of pose.boxes.entries()){assert(finite(p));for(const dim of ['sx','sy','sz'])assert.equal(p[dim],r.parts[j][dim]);if(p.solid){assert(!rayHit(site.approach,site.target,p),r.id+' obscures E target '+p.role);assert(!overlap(body,p,.003),r.id+' blocks standing approach '+p.role);}}samples++;}
 }return{poseSamples:samples};
});
test('Food drawers fit all three walking reserves and close behind the shutter without intersecting the meal',()=>{
 const clearances=[];for(const r of fixtures.recipes.filter(r=>r.type==='food')){const assembly=source.streetDetails.assemblies.find(a=>a.id===r.assemblyId),road=source.roads.find(v=>v.name===assembly.road),depth=(road.x-r.origin.x)*r.normal.x+(road.z-r.origin.z)*r.normal.z;let largest=0;
  for(const phase of ['active','success','cancelled'])for(let i=0;i<=40;i++){const pose=evaluateServiceFixture(r,{phase,progress:phase==='active'?i/40:1,closure:phase==='active'?0:i/40}),local=pose.boxes.map(b=>asLocal(r,b)),shutter=local.filter(b=>b.partGroup==='shutter'),food=local.filter(b=>b.role.startsWith('meal')||b.role.startsWith('noodles')||b.role==='garnish');
   for(const b of local.filter(b=>b.solid&&b.y-b.sy/2<2))largest=Math.max(largest,b.z+b.sz/2);
   for(const a of shutter)for(const b of food)assert(!overlap(a,b,.001),r.id+' shutter intersects served food');
  }assert(depth-largest>=14.6,r.id+' violates sidewalk reserve');clearances.push({id:r.id,projection:largest,remaining:depth-largest});
 }return{clearances};
});
test('Garage physical parts clear the real car across parking tolerance and both accepted orientations',()=>{
 let poses=0;for(const r of fixtures.recipes.filter(r=>r.type==='garage'))for(const tx of [-1.05,0,1.05])for(const nz of [-1.05,0,1.05])for(const angle of [-.3,0,.3,Math.PI-.3,Math.PI,Math.PI+.3])for(const progress of [0,.2,.4,.6,.8,1]){
  const c=Math.cos(r.ry),s=Math.sin(r.ry),vehicle={x:r.parking.x+tx*c+nz*s,y:r.parking.y,z:r.parking.z-tx*s+nz*c,yaw:r.parking.yaw+angle},car={...vehicle,y:vehicle.y+.68,sx:2.895,sy:1.364,sz:5.278,ry:vehicle.yaw};
  for(const b of evaluateServiceFixture(r,{phase:'active',progress,vehicle}).boxes.filter(b=>b.solid))assert(!overlap(car,b,.003),r.id+' car collision '+b.role);poses++;
 }return{acceptedCarPoses:poses};
});
test('All fifteen services start and finish with actual street and live fixture colliders in their production LOS provider',()=>{
 const app=createServiceWorld({scene:new THREE.Scene(),recipes:fixtures}),street=createStreetCollisionLayout(source,{excludedBoxIds:removed}),statics=[...source.colliders,...street.staticColliders];
 const service=createCityServices({layout:source,getColliders:(x,z,r)=>[...statics,...app.getColliders()].filter(b=>Math.abs(b.x-x)<=r+(b.sx+b.sz)/2&&Math.abs(b.z-z)<=r+(b.sx+b.sz)/2)});
 assert.deepEqual(service.list().map(s=>s.id),sites.map(s=>s.id),'Runtime site selection diverged');let completions=0,frames=0;
 for(const site of service.list()){
  service.reset();app.reset();const forward=new THREE.Vector3(site.target.x-site.approach.x,site.target.y-site.approach.y,site.target.z-site.approach.z).normalize();
  const ctx={position:site.approach,forward,health:40,energy:15,carIntegrity:20,alive:true,inVehicle:false,vehiclePosition:site.parking,vehicleYaw:site.parking?.yaw,vehicleSpeed:0,damageVersion:0};
  const candidate=service.findInteractable(ctx);assert.equal(candidate?.id,site.id);assert.equal(candidate.available,true,site.id+': '+candidate.reason);assert.equal(service.begin(site.id,ctx).started,true);
  let events=[];for(let i=0;i<Math.ceil(site.duration/.1)+2;i++){app.update(.1,{...service.getState(),events,playing:true,position:ctx.position,vehicle:site.parking});const next=service.update(.1,ctx);events=next.events;assert(!events.some(e=>e.type==='cancelled'),site.id+' fixture caused cancellation: '+next.result?.message);completions+=events.filter(e=>e.type==='completed').length;frames++;}
  assert.equal(service.getState().result?.success,true,site.id+' did not finish');
 }
 assert.equal(completions,15);app.dispose();return{started:15,completed:completions,frames,staticBoxes:statics.length};
});
test('Completion deduplicates, cancellation retracts on pause, and reset restores the exact resting instance matrices',()=>{
 const app=createServiceWorld({scene:new THREE.Scene(),recipes:fixtures}),solid=app.root.children.find(m=>m.name.includes('/ solid parts')),before=solid.instanceMatrix.array.slice(),site=sites.find(s=>s.type==='food');
 app.update(.1,{playing:true,active:{id:site.id,progress:.65}});assert.equal(app.getState().fixtures.find(f=>f.id===site.id).phase,'active');
 const cancel={id:site.id,type:'cancelled',eventId:'test:1'};app.observe([cancel]);app.update(.1,{playing:false,active:null});
 for(let i=0;i<20;i++)app.update(.1,{playing:false,active:null});assert.equal(app.getState().fixtures.find(f=>f.id===site.id).phase,'idle');
 app.observe([cancel]);app.update(.01,{playing:false});assert.equal(app.getState().fixtures.find(f=>f.id===site.id).phase,'idle');
 app.update(.1,{playing:true,active:{id:site.id,progress:.9}});app.update(.01,{playing:true,events:[{id:site.id,type:'completed',eventId:'test:2'}],cooldowns:{[site.id]:90}});
 assert.equal(app.getState().fixtures.find(f=>f.id===site.id).phase,'success');for(let i=0;i<20;i++)app.update(.1,{playing:true,cooldowns:{[site.id]:90}});assert.equal(app.getState().fixtures.find(f=>f.id===site.id).phase,'cooldown');
 app.reset();assert.deepEqual(solid.instanceMatrix.array,before);assert(app.getColliders().every(b=>b.dynamic===false&&b.immovable));app.dispose();app.dispose();return{cancelledReturn:true,duplicateIgnored:true,resetExact:true};
});
test('Exact fixed-size collision shapes match visible parts and remain at accepted poses through multiple Cannon substeps',()=>{
 const world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.82,0)}),app=createServiceWorld({scene:new THREE.Scene(),recipes:fixtures});app.attachPhysics({world});const stats=app.getState();assert.equal(stats.physicsBodies,36);assert.equal(stats.movingBodies,21);
 const site=sites.find(s=>s.type==='food');app.update(.1,{active:{id:site.id,progress:.1},playing:true});app.afterPhysics();app.update(.1,{active:{id:site.id,progress:.1416666667},playing:true});
 const body=world.bodies.find(b=>b.userData.serviceId===site.id&&b.userData.partGroup==='shutter'),target=body.position.clone();assert(body.velocity.length()>.1);
 for(let i=0;i<4;i++){world.step(1/60);assert(body.position.distanceTo(target)<1e-10,'kinematic body overshot visible pose');}
 app.afterPhysics();assert.equal(body.velocity.length(),0);
 const expected=evaluateServiceFixture(fixtures.recipes.find(r=>r.id===site.id),{phase:'active',progress:.1416666667}).boxes.filter(p=>p.partGroup==='shutter'&&p.solid);
 for(let i=0;i<body.shapes.length;i++){const p=body.pointToWorldFrame(body.shapeOffsets[i]),b=expected[i];assert(Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z)<1e-9);assert.equal(body.shapes[i].halfExtents.x,b.sx/2);}
 assert.equal(world.bodies.reduce((n,b)=>n+b.shapes.length,0),app.getColliders().length);const shared=getKinematicPoseController(world);assert.equal(shared.getState().registeredBodies,21);app.dispose();assert.equal(shared.getState().registeredBodies,0);assert.equal(shared.getState().disposed,false);assert.equal(world.bodies.length,0);return{bodies:stats.physicsBodies,movingBodies:stats.movingBodies,substeps:4,sharedControllerRetained:true};
});
if(results.some(r=>!r.pass))process.exitCode=1;
