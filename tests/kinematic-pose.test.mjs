import assert from 'node:assert/strict';import fs from 'node:fs';import * as CANNON from 'cannon-es';import * as THREE from 'three';
import {getKinematicPoseController} from '../src/kinematic-pose.js';import{createSimulation}from'../src/simulation.js';import{createTrafficController}from'../src/city-life.js';
const results=[],V=(x=0,y=0,z=0)=>new CANNON.Vec3(x,y,z),Q=y=>new CANNON.Quaternion().setFromEuler(0,y,0);
function test(name,fn){try{const evidence=fn();results.push({name,passed:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name,error.message);}}
function world(){const sim=createSimulation({scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()}),controller=getKinematicPoseController(sim.world);return{sim,world:sim.world,controller};}
function car(w){const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:w.sim.physicsMaterial});body.addShape(new CANNON.Box(V(1.4,.64,2.6)));body.position.set(35,.745,9);w.world.addBody(body);return body;}
const listenerCount=(w,name)=>(w._listeners?.[name]||[]).length;
function idle(w,body,frames=180){for(let i=0;i<frames;i++){w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion});w.world.step(1/60);w.controller.clearContactHints(body);}assert.equal(body.sleepState,CANNON.Body.SLEEPING,'Kinematic did not genuinely enter idle sleep');}
function restingReceiver(w,halfExtents,position){const material=new CANNON.Material('resting soft receiver');w.world.addContactMaterial(new CANNON.ContactMaterial(material,w.sim.physicsMaterial,{friction:.65,restitution:0}));const body=new CANNON.Body({mass:16,material,shape:new CANNON.Box(halfExtents),sleepTimeLimit:.5});body.position.copy(position);w.world.addBody(body);return body;}

test('One world controller installs exactly one listener set and disposal is reversible',()=>{
 const w=new CANNON.World(),names=['preStep','postStep','removeBody'],before=names.map(name=>listenerCount(w,name)),a=getKinematicPoseController(w),b=getKinematicPoseController(w);assert.equal(a,b);assert.deepEqual(names.map(name=>listenerCount(w,name)),before.map(n=>n+1));a.dispose();assert.deepEqual(names.map(name=>listenerCount(w,name)),before);assert.notEqual(getKinematicPoseController(w),a);getKinematicPoseController(w).dispose();return{sharedInstance:true,listenersRemoved:true};
});

test('Slow accepted contact pushes wake actual receivers without waking nearby resting objects',()=>{
 const observations=[];
 for(const hints of [true,false]){
  const w=new CANNON.World({gravity:V(0,-9.82,0),allowSleep:true}),controller=getKinematicPoseController(w);
  const floor=new CANNON.Body({mass:0,shape:new CANNON.Plane()});floor.quaternion.setFromEuler(-Math.PI/2,0,0);w.addBody(floor);
  const receiver=new CANNON.Body({mass:1,shape:new CANNON.Box(V(.3,.3,.3)),sleepTimeLimit:.3});receiver.position.set(0,.3,0);w.addBody(receiver);
  const remote=new CANNON.Body({mass:1,shape:new CANNON.Box(V(.3,.3,.3)),sleepTimeLimit:.3});remote.position.set(5,.3,0);w.addBody(remote);
  const driver=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,shape:new CANNON.Box(V(.3,.3,.3)),sleepSpeedLimit:.23});driver.position.set(-.72,.3,0);w.addBody(driver);
  for(let i=0;i<180;i++){controller.setTarget(driver,{});w.step(1/60);controller.clearContactHints(driver);}
  assert.equal(driver.sleepState,CANNON.Body.SLEEPING);assert.equal(receiver.sleepState,CANNON.Body.SLEEPING);assert.equal(remote.sleepState,CANNON.Body.SLEEPING);
  const before=receiver.position.x,receiverLimit=receiver.sleepSpeedLimit;let firstContact=null,firstWake=null,maxPenetration=0;
  for(let i=0;i<240;i++){
   const target=V(-.72+(i+1)*.06/60,.3,0);driver.position.copy(target);
   controller.setTarget(driver,{position:driver.position,velocity:hints?V(.06,0,0):V()});assert.equal(driver.sleepSpeedLimit,0);
   w.step(1/60);assert.deepEqual(driver.position.toArray(),target.toArray());
   const contact=w.contacts.some(c=>(c.bi===driver&&c.bj===receiver)||(c.bj===driver&&c.bi===receiver));if(contact&&firstContact===null)firstContact=i;
   if(receiver.sleepState===CANNON.Body.AWAKE&&firstWake===null)firstWake=i;
   maxPenetration=Math.max(maxPenetration,.6-(receiver.position.x-driver.position.x));
   controller.clearContactHints(driver);assert.equal(driver.sleepSpeedLimit,.23);assert.equal(receiver.sleepSpeedLimit,receiverLimit);assert.equal(remote.sleepState,CANNON.Body.SLEEPING);
  }
  assert.equal(firstWake,firstContact);assert(firstContact!==null);assert(receiver.position.x-before>.10);assert(maxPenetration<.012);
  observations.push({motionHints:hints,speed:.06,firstContact,firstWake,receiverDisplacement:receiver.position.x-before,maxPenetration,remoteStayedAsleep:true});
  for(let i=0;i<240;i++){controller.setTarget(driver,{});w.step(1/60);controller.clearContactHints(driver);}
  assert.equal(driver.sleepState,CANNON.Body.SLEEPING);assert.equal(receiver.sleepState,CANNON.Body.SLEEPING);controller.dispose();
 }
 return{observations};
});

test('Temporary contact wake thresholds restore on idle, clear, unregister, dynamic conversion, removal and disposal',()=>{
 const paths=['idle','clear','unregister','dynamic-step','dynamic-target','dynamic-clear','remove','dispose'];
 for(const path of paths){
  const w=new CANNON.World(),controller=getKinematicPoseController(w),body=new CANNON.Body({type:CANNON.Body.KINEMATIC,mass:0,sleepSpeedLimit:.23,shape:new CANNON.Box(V(.3,.3,.3))});w.addBody(body);
  controller.setTarget(body,{velocity:V(.03,0,0)});assert.equal(body.sleepSpeedLimit,0);controller.setTarget(body,{velocity:V(.04,0,0)});assert.equal(body.sleepSpeedLimit,0);
  if(path==='idle')controller.setTarget(body,{});
  else if(path==='clear')controller.clearContactHints(body);
  else if(path==='unregister')controller.unregister(body);
  else if(path.startsWith('dynamic')){body.type=CANNON.Body.DYNAMIC;body.mass=4;body.updateMassProperties();if(path==='dynamic-step')w.step(1/60);else if(path==='dynamic-target')controller.setTarget(body,{});else controller.clearContactHints(body);assert.equal(body.mass,4);}
  else if(path==='remove'){
   w.removeBody(body);assert.equal(body.sleepSpeedLimit,.23);assert.equal(controller.getState().registeredBodies,0);
   const second=new CANNON.World(),next=getKinematicPoseController(second);second.addBody(body);next.setTarget(body,{velocity:V(.02,0,0)});assert.equal(body.sleepSpeedLimit,0);next.clearContactHints(body);assert.equal(body.sleepSpeedLimit,.23);next.dispose();
  }else controller.dispose();
  assert.equal(body.sleepSpeedLimit,.23,path);controller.dispose();assert.equal(listenerCount(w,'removeBody'),0);
 }
 return{restoredOriginalLimit:.23,cleanupPaths:paths.length,worldTransferPreserved:true};
});
test('Accepted translation and yaw remain exact at every internal step while solver sees contact velocity',()=>{
 const w=world(),body=car(w),position=V(35,.745,9),quaternion=Q(.4),velocity=V(0,0,-10),angularVelocity=V(0,1.2,0);w.controller.setTarget(body,{position,quaternion,velocity,angularVelocity});const targetP=position.clone(),targetQ=quaternion.clone();position.z=100;velocity.z=100;quaternion.x=3;
 const during=[],solverHints=[],solve=w.world.solver.solve;w.world.solver.solve=function(...args){solverHints.push({v:body.velocity.toArray(),w:body.angularVelocity.toArray()});return solve.apply(this,args)};
 w.world.addEventListener('postStep',()=>during.push({p:body.position.toArray(),q:body.quaternion.toArray()}));w.sim.update(.1,.1,{position:new THREE.Vector3(100,2,100),damage(){},inVehicle:false});assert.equal(during.length,4);for(const frame of during){assert.deepEqual(frame.p,targetP.toArray());assert.deepEqual(frame.q,targetQ.toArray());}for(const hint of solverHints){assert.deepEqual(hint.v,[0,0,-10]);assert.deepEqual(hint.w,[0,1.2,0]);}
 w.controller.clearContactHints(body);assert.equal(body.velocity.length(),0);assert.equal(body.angularVelocity.length(),0);w.world.step(1/60,.1,4);assert(body.position.distanceTo(targetP)<1e-12);w.controller.dispose();w.sim.dispose();return{internalSteps:4,maximumTranslationError:0,maximumQuaternionError:0,solverVelocity:[0,0,-10],solverAngularVelocity:[0,1.2,0]};
});
test('Moving accepted car transfers real contact momentum without a second hull displacement',()=>{
 const observations=[];for(const speed of [0,10]){const w=world(),body=car(w),probe=new CANNON.Body({mass:16,material:w.sim.physicsMaterial,linearDamping:0,angularDamping:0});probe.addShape(new CANNON.Box(V(.24,.24,.24)));probe.position.set(35,.745,6.18);w.world.addBody(probe);
 w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion,velocity:V(0,0,-speed)});let peakForward=0;const contactPositions=[];w.world.addEventListener('postStep',()=>{peakForward=Math.max(peakForward,-probe.velocity.z);contactPositions.push(body.position.toArray())});w.sim.update(.1,.1,{position:new THREE.Vector3(100,2,100),damage(){},inVehicle:false});assert(contactPositions.every(p=>p[2]===9));observations.push({speed,peakProbeForwardSpeed:peakForward,probeDisplacement:6.18-probe.position.z});w.controller.dispose();w.sim.dispose();}
 assert(observations[1].peakProbeForwardSpeed>observations[0].peakProbeForwardSpeed+5);assert(observations[1].probeDisplacement>.25);return{observations};
});
test('A genuinely idle car resumes translation and wakes a sleeping receiver on the first contact step',()=>{
 const w=world(),body=car(w),receiver=restingReceiver(w,V(.3,.3,.3),V(35,.3,0));
 idle(w,body,240);assert.equal(receiver.sleepState,CANNON.Body.SLEEPING);const before={car:body.sleepState,receiver:receiver.sleepState};
 const target=V(35,.745,2.7);body.position.copy(target);w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion,velocity:V(0,0,-8)});assert.equal(body.sleepState,CANNON.Body.AWAKE);
 const poses=[];w.world.addEventListener('postStep',()=>poses.push(body.position.toArray()));w.world.step(1/60,.05,3);
 assert.equal(receiver.sleepState,CANNON.Body.AWAKE);assert(receiver.velocity.z< -1);assert(poses.every(p=>p[0]===35&&p[1]===.745&&p[2]===2.7));
 const evidence={before,after:{car:body.sleepState,receiver:receiver.sleepState},receiverVelocity:receiver.velocity.toArray(),internalSteps:poses.length,acceptedPoseExact:true};w.controller.dispose();w.sim.dispose();return evidence;
});
test('A genuinely idle rotating fixture wakes with angular hints and transfers contact to a sleeping receiver',()=>{
 const w=world(),body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:w.sim.physicsMaterial,shape:new CANNON.Box(V(1.8,.3,.25))});body.position.set(35,.5,0);w.world.addBody(body);
 const receiver=restingReceiver(w,V(.22,.22,.22),V(36.65,.22,-.8));idle(w,body,240);assert.equal(receiver.sleepState,CANNON.Body.SLEEPING);
 body.quaternion.copy(Q(.3));w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion,angularVelocity:V(0,2,0)});assert.equal(body.sleepState,CANNON.Body.AWAKE);w.world.step(1/60);
 assert.equal(receiver.sleepState,CANNON.Body.AWAKE);assert(receiver.velocity.length()>.2);const contacts=w.world.contacts.filter(c=>c.bi===body||c.bj===body).length;assert(contacts>0);assert(body.quaternion.toArray().every((n,i)=>n===Q(.3).toArray()[i]));
 const evidence={contacts,receiverVelocity:receiver.velocity.toArray(),acceptedYaw:.3};w.controller.dispose();w.sim.dispose();return evidence;
});
test('Cached targets detect callers mutating the body first, while unchanged and quaternion-sign-equivalent idle targets stay asleep',()=>{
 const w=world(),body=car(w),original=body.position.clone();idle(w,body);
 const sameQ=body.quaternion.clone();sameQ.x*=-1;sameQ.y*=-1;sameQ.z*=-1;sameQ.w*=-1;w.controller.setTarget(body,{position:body.position,quaternion:sameQ});assert.equal(body.sleepState,CANNON.Body.SLEEPING);
 body.position.x+=.25;w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion});assert.equal(body.sleepState,CANNON.Body.AWAKE);idle(w,body);
 body.quaternion.copy(Q(.2));w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion});assert.equal(body.sleepState,CANNON.Body.AWAKE);idle(w,body);
 body.position.copy(original);body.quaternion.copy(Q(0));w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion});assert.equal(body.sleepState,CANNON.Body.AWAKE);w.controller.clearContactHints(body);assert.equal(body.velocity.length(),0);assert.equal(body.angularVelocity.length(),0);
 idle(w,body);w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion,angularVelocity:V(0,.2,0)});assert.equal(body.sleepState,CANNON.Body.AWAKE);
 w.controller.dispose();w.sim.dispose();return{unchangedIdlePreserved:true,quaternionSignEquivalent:true,preMutatedTranslationAndYawWake:true,resetTargetWake:true,angularHintAloneWakes:true};
});
test('First registration respects existing idle state, moving hints wake, and dynamic bodies retain their own sleep lifecycle',()=>{
 const w=world(),body=car(w);for(let i=0;i<180;i++)w.world.step(1/60);assert.equal(body.sleepState,CANNON.Body.SLEEPING);
 w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion});assert.equal(body.sleepState,CANNON.Body.SLEEPING);w.controller.unregister(body);
 w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion,velocity:V(0,0,-2)});assert.equal(body.sleepState,CANNON.Body.AWAKE);idle(w,body);w.controller.unregister(body);
 w.controller.setTarget(body,{position:V(36,.745,9),quaternion:body.quaternion});assert.equal(body.sleepState,CANNON.Body.AWAKE);w.controller.clearContactHints(body);
 body.type=CANNON.Body.DYNAMIC;body.mass=68;body.updateMassProperties();for(let i=0;i<360;i++)w.world.step(1/60);assert.equal(body.sleepState,CANNON.Body.SLEEPING);
 assert.equal(w.controller.setTarget(body,{velocity:V(3,0,0)}),false);assert.equal(body.sleepState,CANNON.Body.SLEEPING);assert.equal(body.mass,68);assert.equal(w.controller.getState().registeredBodies,0);
 w.controller.dispose();w.sim.dispose();return{firstUnchangedRegistrationSleeps:true,firstMovingRegistrationWakes:true,firstDifferentPoseWakes:true,dynamicSleepUntouched:true};
});
test('Unregistering or changing to dynamic preserves free rigid-body motion and mass',()=>{
 const w=world(),body=car(w);w.controller.setTarget(body,{position:body.position,quaternion:body.quaternion,velocity:V(0,0,-6)});body.type=CANNON.Body.DYNAMIC;body.mass=1200;body.updateMassProperties();const before=body.position.clone();w.world.step(1/60);assert(body.position.distanceTo(before)>.05);assert.equal(w.controller.getState().registeredBodies,0);assert.equal(body.mass,1200);assert.equal(w.controller.setTarget(body,{}),false);w.controller.dispose();w.sim.dispose();return{dynamicMass:1200,noTargetReassertion:true};
});
test('Traffic accepted poses stay fixed through substeps; wrecks unregister and resets restore neutral targets',()=>{
 const w=world(),traffic=createTrafficController({getVehicleBlockers:()=>[],getPlayerPosition:()=>({x:1000,z:1000})});traffic.attachPhysics({world:w.world,material:w.sim.physicsMaterial,groundHeightAt:()=>.057});traffic.update(.1,{x:1000,z:1000});const initial=traffic.vehicles.map(v=>({id:v.id,p:v.body.position.clone(),q:v.body.quaternion.clone()}));let checks=0;
 const observe=()=>{for(const v of traffic.vehicles){if(v.wrecked)continue;const target=initial.find(p=>p.id===v.id);assert(v.body.position.distanceTo(target.p)<1e-12);assert(v.body.quaternion.toArray().every((n,i)=>Math.abs(n-target.q.toArray()[i])<1e-12));checks++;}};w.world.addEventListener('postStep',observe);w.world.step(1/60,.1,4);w.world.removeEventListener('postStep',observe);traffic.afterPhysics();assert(traffic.vehicles.every(v=>v.body.velocity.length()===0));
 const v=traffic.vehicles.find(v=>v.active),hits=traffic.ram({x:v.x,y:.057,z:v.z+5},{x:v.x,y:.057,z:v.z},{yaw:0,speed:12});assert(hits.some(h=>h.id===v.id));assert(v.wrecked);assert.equal(v.body.type,CANNON.Body.DYNAMIC);assert.equal(w.controller.getState().registeredBodies,traffic.vehicles.length-hits.length);const impact=v.body.position.clone();w.world.step(1/60);assert(v.body.position.distanceTo(impact)>.01);
 traffic.reset();assert(traffic.vehicles.every(v=>v.body.type===CANNON.Body.KINEMATIC&&!v.wrecked&&v.body.velocity.length()===0));assert.equal(w.controller.getState().registeredBodies,traffic.vehicles.length);const registered=w.controller.getState().registeredBodies;traffic.dispose();assert.equal(w.controller.getState().registeredBodies,0);w.controller.dispose();w.sim.dispose();return{perStepPoseChecks:checks,trafficBodies:registered,wreckFree:true,resetHintsZero:true};
});
const report={passed:results.every(r=>r.passed),checkedAtUTC:new Date().toISOString(),results};if(process.env.KINEMATIC_POSE_REPORT)fs.writeFileSync(process.env.KINEMATIC_POSE_REPORT,JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
