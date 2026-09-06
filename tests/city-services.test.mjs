import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {createCityLayout} from '../src/city-layout.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';
import {createCityServices} from '../src/city-services.js';

const layout=createCityLayout(),baseline=createHash('sha256').update(JSON.stringify(layout)).digest('hex'),results=[];
let blockers=[],externalLOS=true,losCalls=0;
const start=performance.now(),service=createCityServices({layout,getColliders:()=>blockers,lineOfSight:()=>{losCalls++;return externalLOS;}}),initializationMs=performance.now()-start;
const sites=service.list(),type=name=>sites.find(site=>site.type===name),V=p=>new THREE.Vector3(p.x,p.y,p.z);
function context(site){const position={...site.approach},forward=V(site.target).sub(V(position)).normalize();return{position,forward,health:40,energy:15,carIntegrity:20,alive:true,inVehicle:false,vehiclePosition:site.parking?{...site.parking}:undefined,vehicleYaw:site.parking?.yaw,vehicleSpeed:0,damageVersion:0};}
function reset(){service.reset();blockers=[];externalLOS=true;}
function test(name,fn){try{reset();const detail=fn();results.push({name,passed:true,...detail});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL '+name+' '+e.message);}}
function complete(site,ctx=context(site)){assert(service.begin(site.id,ctx).started);let events=[];for(let i=0;i<Math.ceil(site.duration/.1)+1;i++)events.push(...service.update(.1,ctx).events);assert.equal(events.length,1);assert.equal(events[0].type,'completed');return events[0];}
function boxObject(b){return new OBB(V(b),new THREE.Vector3(b.sx/2,b.sy/2,b.sz/2),new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(b.ry||0)));}
function rayHits(from,to,b){const inverse=new THREE.Matrix4().compose(V(b),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),b.ry||0),new THREE.Vector3(1,1,1)).invert();
 const p=V(from).applyMatrix4(inverse),q=V(to).applyMatrix4(inverse),direction=q.clone().sub(p),length=direction.length();direction.normalize();
 const hit=new THREE.Ray(p,direction).intersectBox(new THREE.Box3(new THREE.Vector3(-b.sx/2,-b.sy/2,-b.sz/2),new THREE.Vector3(b.sx/2,b.sy/2,b.sz/2)),new THREE.Vector3());return hit&&hit.distanceTo(p)<length-.026;
}

test('Fifteen deterministic sites use real access screens across all five outer districts',()=>{
 assert.equal(sites.length,15);for(const name of ['food','clinic','garage','recharge','wayfinding'])assert.equal(sites.filter(s=>s.type===name).length,3);
 for(const site of sites){const box=layout.boxes.find(b=>b.id===site.sourceBoxId),assembly=layout.streetDetails.assemblies.find(a=>a.id===site.assemblyId);assert.equal(box.role,'access display');assert(assembly.boxIds.includes(box.id));assert.equal(site.sourceIndex,layout.boxes.indexOf(box));assert.equal(site.hostBuilding,assembly.hostBuilding);assert(site.target.y>=box.y-box.sy/2&&site.target.y<=box.y+box.sy/2);}
 assert.deepEqual(createCityServices({layout}).list(),sites);return{count:sites.length,initializationMs,types:Object.fromEntries(['food','clinic','garage','recharge','wayfinding'].map(t=>[t,sites.filter(s=>s.type===t).map(s=>s.id)]))};
});
test('All selected screens are visible from their standing position and recorded inspection viewpoint',()=>{
 let rays=0;for(const site of sites)for(const from of [site.approach,site.inspectionVantage]){
  const nearby=layout.boxes.filter(b=>b.lod!=='far'&&!site.ignoreBoxIds.includes(b.id)&&b.y-b.sy/2<5&&Math.abs(b.x-site.target.x)<b.sx/2+b.sz/2+8&&Math.abs(b.z-site.target.z)<b.sx/2+b.sz/2+8);
  const obstruction=nearby.find(b=>rayHits(from,site.target,b));assert(!obstruction,site.id+' blocked by '+JSON.stringify(obstruction));rays++;
 }return{clearRays:rays};
});
test('Proximity, outward side and looking at the actual screen all gate discovery and begin',()=>{
 const site=type('food'),ctx=context(site);assert.equal(service.findInteractable(ctx).id,site.id);assert(service.findInteractable(ctx).available);
 for(const bad of [{...ctx,position:{...ctx.position,x:ctx.position.x+100}},{...ctx,forward:V(ctx.forward).negate()},{...ctx,forward:{x:0,y:0,z:0}},{...ctx,position:{x:site.target.x-site.normal.x,y:ctx.position.y,z:site.target.z-site.normal.z}}]){assert.equal(service.findInteractable(bad),null);assert.equal(service.begin(site.id,bad).started,false);}
 assert.equal(service.begin(site.id,{...ctx,inVehicle:true}).started,false);assert.equal(service.begin(site.id,{...ctx,moving:true}).started,false);return{site:site.id};
});
test('A live obstacle or caller line-of-sight veto blocks the screen without ignoring its whole host building',()=>{
 const site=type('clinic'),ctx=context(site),mid=V(ctx.position).lerp(V(site.target),.5);
 blockers=[{id:'LIVE-PROP',...mid,sx:.8,sy:1.8,sz:.8}];assert.equal(service.findInteractable(ctx).available,false);assert.equal(service.begin(site.id,ctx).started,false);
 blockers=[];externalLOS=false;assert.equal(service.begin(site.id,ctx).started,false);externalLOS=true;assert.equal(service.begin(site.id,ctx).started,true);return{callerLOSInvoked:losCalls>0};
});
test('Food progress emits a single modest heal plus a timed neural benefit, without mutating caller state',()=>{
 const site=type('food'),ctx=context(site),snapshot=JSON.stringify(ctx);assert(service.begin(site.id,ctx).started);let state=service.update(.2,ctx);assert(state.active.progress>0&&state.active.progress<1);assert.equal(state.events.length,0);
 let events=[];for(let i=0;i<35;i++)events.push(...service.update(.1,ctx).events);assert.equal(events.length,1);assert.deepEqual(events[0].outcome,{healthDelta:25,neuralBoost:{duration:45,regenerationMultiplier:1.3}});assert.equal(JSON.stringify(ctx),snapshot);assert.equal(service.getState().active,null);assert.equal(service.getState().completed,1);return{event:events[0]};
});
test('Clinics, recharge terminals and garages emit their named effects only after their full durations',()=>{
 const outcomes={};for(const name of ['clinic','recharge','garage']){service.reset();const site=type(name),event=complete(site);outcomes[name]=event.outcome;}
 assert.deepEqual(outcomes.clinic,{healthRestore:100});assert.deepEqual(outcomes.recharge,{energyDelta:60});assert.deepEqual(outcomes.garage,{repairVehicle:true,integrityRestore:100});return{outcomes};
});
test('Movement, damage, death, driving, turning away and caller interruptions cancel without outcomes',()=>{
 const site=type('clinic'),base=context(site),variants=[['movement',{position:{...base.position,x:base.position.x+.3}}],['damage token',{damageVersion:1}],['health loss',{health:39}],['death',{alive:false}],['vehicle entry',{inVehicle:true}],['driving',{driving:true}],['turn away',{forward:V(base.forward).negate()}],['pause',{paused:true}],['restart',{restarting:true}]];
 for(const [label,change] of variants){service.reset();assert(service.begin(site.id,base).started);service.update(.1,base);const state=service.update(.1,{...base,...change});assert.equal(state.active,null,label);assert.equal(state.events.length,1,label);assert.equal(state.events[0].type,'cancelled',label);assert.equal(service.getState().completed,0,label);assert.equal(service.getState().cooldowns[site.id],undefined,label);}
 service.reset();assert(service.begin(site.id,base).started);assert.equal(service.cancel('Weapon drawn').events.length,1);assert.equal(service.cancel('Weapon drawn').events.length,0);return{cancellationCases:variants.length+1};
});
test('A stationary garage operator can watch the car while repair runs; movement still cancels',()=>{
 const site=type('garage'),ctx=context(site),lookAtCar={...ctx,forward:V(ctx.forward).negate()};
 service.reset();assert.equal(service.begin(site.id,lookAtCar).started,false,'Starting still requires the terminal');
 assert(service.begin(site.id,ctx).started);const observed=service.update(.2,lookAtCar);assert.equal(observed.active.id,site.id);assert.equal(observed.events.length,0);
 const moved=service.update(.1,{...lookAtCar,position:{...ctx.position,x:ctx.position.x+.3}});assert.equal(moved.active,null);assert.equal(moved.events[0].type,'cancelled');assert.equal(service.getState().completed,0);return{inspectionAllowed:true,movementCancels:true};
});
test('Cooldown starts only at successful completion and cannot be bypassed with repeat interaction',()=>{
 const site=type('recharge'),ctx=context(site);complete(site,ctx);assert.equal(service.findInteractable(ctx).available,false);assert(service.findInteractable(ctx).cooldownRemaining>44);assert.equal(service.begin(site.id,ctx).started,false);
 for(let i=0;i<181;i++)service.update(.25,ctx);assert.equal(service.findInteractable(ctx).cooldownRemaining,0);assert(service.begin(site.id,ctx).started);assert.equal(service.begin(site.id,ctx).started,false);return{cooldownSeconds:site.cooldown};
});
test('Full-state clinics, recharge, repairs and already active recovery boosts do not consume service use',()=>{
 for(const [name,change] of [['clinic',{health:100}],['recharge',{energy:100}],['garage',{carIntegrity:100}],['food',{health:100,neuralBoostRemaining:20}]]){const site=type(name);assert.equal(service.begin(site.id,{...context(site),...change}).started,false);}
 assert.equal(service.getState().completed,0);return{checks:4};
});
test('Garage repair requires the actual nearby owned car, correct alignment, no motion and a clear apron',()=>{
 const site=type('garage'),ctx=context(site);
 const variants=[{vehiclePosition:undefined},{vehiclePosition:{...ctx.vehiclePosition,x:ctx.vehiclePosition.x+3}},{vehicleYaw:ctx.vehicleYaw+Math.PI/2},{vehicleSpeed:1}];
 for(const change of variants)assert.equal(service.begin(site.id,{...ctx,...change}).started,false);
 blockers=[{id:'OTHER-CAR',x:site.parking.x,y:.8,z:site.parking.z,sx:2.9,sy:1.3,sz:5.3,ry:site.parking.yaw}];assert.equal(service.begin(site.id,ctx).started,false);
 blockers[0].id='VEHICLE-PLAYER';assert(service.begin(site.id,ctx).started);const state=service.update(.1,{...ctx,vehiclePosition:{...ctx.vehiclePosition,x:ctx.vehiclePosition.x+.10}});assert.equal(state.events[0].type,'cancelled');
 blockers=[];service.reset();assert(service.begin(site.id,{...ctx,vehicleYaw:ctx.vehicleYaw+Math.PI}).started);return{site:site.id,reverseParkingAccepted:true};
});
test('Every garage has a continuous swept oriented route from an actual public road lane',()=>{
 const collision=createStreetCollisionLayout(layout),solids=[...layout.colliders,...collision.staticColliders],checks=[];let poses=0;
 for(const site of sites.filter(s=>s.type==='garage')){
  const route=site.parking.route,road=layout.roads.find(r=>r.name===site.parking.road),start=route[0];assert(Math.abs(start.x-road.x)<=road.sx/2&&Math.abs(start.z-road.z)<=road.sz/2);assert.equal(route.length,65);
  const around=solids.filter(b=>route.some(p=>Math.abs(p.x-b.x)<=b.sx/2+b.sz/2+5&&Math.abs(p.z-b.z)<=b.sx/2+b.sz/2+5));
  for(let index=0;index<route.length-1;index++)for(let sub=0;sub<4;sub++){
   const u=sub/4,a=route[index],b=route[index+1],p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u},yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*u;
   const car=boxObject({...p,y:p.y+.682,sx:2.90,sy:1.30,sz:5.28,ry:yaw});
   const obstruction=around.find(b=>b.y+b.sy/2>p.y-.008+.30&&car.intersectsOBB(boxObject(b),1e-9));assert(!obstruction,site.id+' route hit '+obstruction?.id);poses++;
  }
  checks.push({id:site.id,road:road.name,park:{x:site.parking.x,z:site.parking.z,yaw:site.parking.yaw},sweptPoses:256});
 }assert.equal(checks.length,3);return{checks,sweptPoses:poses};
});
test('Crown directories create real destinations, preserve them in state and cycle between services',()=>{
 const directory=type('wayfinding'),first=complete(directory).outcome.waypoint;assert(sites.some(s=>s.id===first.id&&s.type!=='wayfinding'));assert.deepEqual(service.getState().waypoint,first);
 for(let i=0;i<35;i++)service.update(.25,context(directory));const second=complete(directory).outcome.waypoint;assert.notEqual(first.id,second.id);assert.notEqual(first.id,directory.id);return{first,second};
});
test('Reset clears progress, cooldowns, result and navigation; returned snapshots cannot mutate internals',()=>{
 complete(type('food'));const view=service.list();view[0].target.x=NaN;assert(Number.isFinite(service.list()[0].target.x));const state=service.getState();state.cooldowns[type('food').id]=0;assert(service.getState().cooldowns[type('food').id]>0);
 service.reset();assert.equal(service.getState().active,null);assert.equal(service.getState().result,null);assert.equal(service.getState().waypoint,null);assert.deepEqual(service.getState().cooldowns,{});assert.equal(service.getState().completed,0);return{reset:true};
});
test('Invalid input and delayed frames cannot instantly complete an operation or emit phantom effects',()=>{
 assert.equal(service.findInteractable({position:{x:NaN,y:0,z:0},forward:{x:1,y:0,z:0}}),null);assert.equal(service.begin('missing',{}).started,false);
 const site=type('food'),ctx=context(site);assert(service.begin(site.id,ctx).started);for(const dt of [NaN,Infinity,-1])assert.equal(service.update(dt,ctx).events.length,0);assert.equal(service.getState().active.progress,0);
 const delayed=service.update(3600,ctx);assert.equal(delayed.events.length,0);assert(delayed.active.progress<.11);return{delayedFrameClampedSeconds:.25};
});
test('The service system never changes authored city geometry, blueprint or native asset placements',()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(layout)).digest('hex'),baseline);return{layoutSHA256:baseline};
});

const report={status:results.every(r=>r.passed)?'passed':'failed',checkedAtUTC:new Date().toISOString(),initializationMs,siteCount:sites.length,sites:sites.map(({parking,...site})=>({...site,parking:parking?{...parking,route:undefined}:undefined})),tests:results};
if(report.status==='failed')process.exitCode=1;

console.log(`Completed city-services.test.mjs: ${results.length} checks.`);
