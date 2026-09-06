import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {planFootSwing,sampleFootSwing,advanceFootSwing} from '../src/foot-swing.js';
import {resolveBootClearance} from '../src/boot-clearance.js';

const V=(x,y,z)=>new THREE.Vector3(x,y,z),dimensions={halfWidth:.14,halfLength:.2408,height:.3052};
const near=(a,b,tolerance=1e-9)=>assert(Math.abs(a-b)<=tolerance,`${a} != ${b}`),results=[];
const floor={id:'floor',x:0,y:-.05,z:0,sx:20,sy:.1,sz:20};
function test(name,run){const detail=run();results.push({name,passed:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}

test('Flat trapezoidal motion matches an independent closed-form reference and stops exactly',()=>{
  const from=V(0,0,0),to=V(0,0,-2),path=planFootSwing({from,to,...dimensions,colliders:[floor],lift:0,speed:2,acceleration:4});
  assert(path.ok);near(path.length,2);near(path.duration,1.5);
  // 0.5s accelerate, 0.5s cruise, 0.5s decelerate, with no stair geometry.
  const reference=[[0,0,0],[.25,.125,1],[.5,.5,2],[.75,1,2],[1,1.5,2],[1.25,1.875,1],[1.5,2,0]];
  for(const [time,distance,speed] of reference){const value=sampleFootSwing(path,time);near(value.distance,distance);near(value.position.z,-distance);near(value.velocity.length(),speed);}
  for(const time of[path.duration,path.duration+1,100]){const value=sampleFootSwing(path,time);assert(value.done);near(value.position.distanceTo(to),0);near(value.velocity.length(),0);}
  const before=sampleFootSwing(path,-1);near(before.position.distanceTo(from),0);near(before.velocity.length(),0);
  return{duration:path.duration,length:path.length,referenceSamples:reference.length,terminalSpeed:0};
});

test('Short triangular travel and a zero-distance pose have finite exact rest',()=>{
  const path=planFootSwing({from:V(0,0,0),to:V(.09,0,0),...dimensions,lift:0,speed:4,acceleration:4});assert(path.ok);
  near(path.duration,.3);near(path.peak,.6);near(path.cruise,0);
  const halfway=sampleFootSwing(path,.15);near(halfway.position.x,.045);near(halfway.velocity.length(),.6);
  const zero=planFootSwing({from:V(1,2,3),to:V(1,2,3),...dimensions,lift:0});assert(zero.ok);near(zero.duration,0);
  for(const time of[0,1]){const value=sampleFootSwing(zero,time);assert(value.done);assert(value.position.toArray().every(Number.isFinite));near(value.velocity.length(),0);near(value.position.distanceTo(V(1,2,3)),0);}
  return{triangularDuration:path.duration,triangularPeak:path.peak,zeroDuration:zero.duration};
});

test('30, 60 and 120Hz execution uses the same profile and ends without a terminal snap',()=>{
  const path=planFootSwing({from:V(0,0,0),to:V(0,0,-2),...dimensions,colliders:[floor],lift:0,speed:2,acceleration:4});assert(path.ok);
  const traces=new Map();let maximumStepSpeed=0;
  for(const hz of[30,60,120]){
    let position=path.points[0].clone(),elapsed=0,previousDistance=0;const samples=[];
    for(let frame=1;frame<=Math.ceil(path.duration*hz)+2;frame++){
      const value=advanceFootSwing(path,{elapsed,dt:1/hz,actualPosition:position});assert(value.advanced);
      maximumStepSpeed=Math.max(maximumStepSpeed,value.position.distanceTo(position)*hz);assert(value.distance>=previousDistance-1e-9);
      position=value.position;elapsed=value.elapsed;previousDistance=value.distance;samples.push(value);
    }
    const final=samples.at(-1);assert(final.done);near(final.velocity.length(),0);near(final.position.distanceTo(path.points.at(-1)),0);traces.set(hz,samples);
  }
  for(let frame=1;frame<=45;frame++)for(const hz of[60,120]){
    const a=traces.get(30)[frame-1],b=traces.get(hz)[frame*(hz/30)-1];near(a.position.distanceTo(b.position),0,2e-14);near(a.velocity.distanceTo(b.velocity),0,2e-14);
  }
  assert(maximumStepSpeed<=2+1e-10);return{rates:[30,60,120],commonTimes:45,maximumStepSpeed,terminalSpeed:0};
});

test('A solved-foot divergence rejects time advance rather than advancing a hidden trajectory',()=>{
  const path=planFootSwing({from:V(0,0,0),to:V(0,0,-2),...dimensions,lift:0,speed:2,acceleration:4});
  const elapsed=.4,expected=sampleFootSwing(path,elapsed),actual=expected.position.clone().add(V(.025,0,0));
  const before=JSON.stringify(path);const rejected=advanceFootSwing(path,{elapsed,dt:1/30,actualPosition:actual});
  assert(!rejected.advanced);near(rejected.elapsed,elapsed);near(rejected.position.distanceTo(actual),0);near(rejected.distance,expected.distance);assert.equal(JSON.stringify(path),before);
  const accepted=advanceFootSwing(path,{elapsed,dt:1/60,actualPosition:expected.position});assert(accepted.advanced);near(accepted.elapsed,elapsed+1/60);
  assert.throws(()=>advanceFootSwing(path,{elapsed,dt:-1,actualPosition:actual}),TypeError);
  return{rejectedOffset:.025,unchangedElapsed:rejected.elapsed,sourcePathUnchanged:true};
});

test('A real-sized 18cm step has clear executing segments and frame samples in both directions',()=>{
  const step={id:'step',x:0,y:.09,z:0,sx:2.1,sy:.18,sz:.36},solids=[floor,step];
  const endpoints=[[V(0,0,.8),V(0,.18,.06)],[V(0,.18,.06),V(0,0,.8)]];let frames=0,segments=0;
  for(const [from,to] of endpoints){
    const path=planFootSwing({from,to,...dimensions,colliders:solids});assert(path.ok,path.reason);assert(path.duration>0);
    for(let i=1;i<path.points.length;i++){
      const check=resolveBootClearance({from:path.points[i-1],to:path.points[i],...dimensions,colliders:solids});assert(!check.blocked&&!check.unresolved);near(check.position.distanceTo(path.points[i]),0);segments++;
    }
    for(const hz of[30,60,120]){
      let position=from.clone(),elapsed=0;
      for(let i=0;i<Math.ceil(path.duration*hz)+2;i++){
        const value=advanceFootSwing(path,{elapsed,dt:1/hz,actualPosition:position});assert(value.advanced);
        const check=resolveBootClearance({from:position,to:value.position,...dimensions,colliders:solids});assert(!check.blocked&&!check.unresolved,`A ${hz}Hz frame chord must not cut through a step`);
        assert(value.position.distanceTo(position)*hz<=path.speed+1e-8);position=value.position;elapsed=value.elapsed;frames++;
      }
      near(position.distanceTo(to),0);near(sampleFootSwing(path,elapsed).velocity.length(),0);
    }
  }
  return{directions:2,segments,frameSweeps:frames,rates:[30,60,120]};
});

test('Embedded endpoints, tall walls and an obstructed lift return explicit no-fit',()=>{
  const wall={id:'closed-door',x:0,y:1.5,z:0,sx:3,sy:3,sz:.14,walkable:false};
  const blocked=planFootSwing({from:V(0,0,1),to:V(0,0,-1),...dimensions,colliders:[floor,wall]});assert(!blocked.ok&&blocked.reason);
  const embedded=planFootSwing({from:V(0,0,0),to:V(0,0,1),...dimensions,colliders:[wall]});assert(!embedded.ok);assert.match(embedded.reason,/endpoint/);
  const roof={id:'low-roof',x:0,y:.37,z:0,sx:3,sy:.1,sz:3,walkable:false};
  const noLift=planFootSwing({from:V(0,0,0),to:V(0,0,.5),...dimensions,colliders:[floor,roof]});assert(!noLift.ok);assert.match(noLift.reason,/lift/);
  assert.throws(()=>sampleFootSwing(blocked,0),TypeError);assert.throws(()=>planFootSwing({from:V(0,0,0),to:V(1,0,0),...dimensions,speed:0}),TypeError);
  return{wallReason:blocked.reason,embeddedReason:embedded.reason,ceilingReason:noLift.reason};
});

if(process.env.FOOT_SWING_REPORT)fs.writeFileSync(process.env.FOOT_SWING_REPORT,JSON.stringify({status:'passed',scope:'Experimental unwired static-yaw path helper, not gait or live-frame acceptance',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/foot-swing.js',import.meta.url))).digest('hex'),tests:results},null,2)+'\n');
