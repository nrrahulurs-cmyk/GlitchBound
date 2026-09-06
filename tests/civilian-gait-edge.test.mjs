import {createCityPopulation,createPedestrianTemplate} from '../src/civilian-source.js';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createCivilianMotion} from '../src/civilian-motion.js';
import {createCivilianSystem} from '../src/civilians.js';
import {createCityLayout} from '../src/city-layout.js';
const layout=createCityLayout();

const pieces=createPedestrianTemplate('#334455',false);
const boots=pieces.filter(p=>(p.motion===1||p.motion===2)&&p.y<.3).sort((a,b)=>a.x-b.x);
function soleCorners(m){return[-.5,.5].flatMap(x=>[-.5,.5].map(z=>new THREE.Vector3(x,-.5,z).applyMatrix4(m)));}
const groundSurfaces=layout.boxes.filter(v=>v.kind==='pavement'&&v.sx>=1&&v.sz>=1&&v.y+v.sy/2>=.08&&v.y+v.sy/2<=.4);
let queries=0;function realGround(x,z){queries++;let height=.057;for(const v of groundSurfaces){const cs=Math.cos(v.ry||0),sn=Math.sin(v.ry||0),dx=x-v.x,dz=z-v.z;if(Math.abs(dx*cs-dz*sn)<=v.sx/2&&Math.abs(dx*sn+dz*cs)<=v.sz/2)height=Math.max(height,v.y+v.sy/2)}return height;}
function population(ground){const people=createCityPopulation({districts:layout.districts}).people,count=people.reduce((n,p)=>n+p.pieces.length,0);const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),count);return createCivilianSystem({people,mesh,colliders:layout.colliders,groundHeightAt:ground,bounds:layout.bounds});}
const performanceResults=[];for(const [label,sample] of [['constant',()=>.057],['production',realGround]]){const system=population(sample),player=new THREE.Vector3(0,2,20);for(let i=0;i<45;i++)system.update(1/60,i/60,player);const times=[];queries=0;for(let i=0;i<120;i++){const now=performance.now();system.update(1/60,(45+i)/60,player);times.push(performance.now()-now);}times.sort((a,b)=>a-b);performanceResults.push({label,meanMs:times.reduce((a,b)=>a+b)/times.length,medianMs:times[60],p95Ms:times[114],groundQueriesPerFrame:queries/120,groundSurfaces:groundSurfaces.length});}
const geometryResults=[];for(const dt of [1/60,1/30,1/15,.1])for(const scale of [.84,1,1.12])for(const scenario of ['reverse','square','stop-curb']){
 const ground=scenario==='stop-curb'?(x,z)=>z>.3?.165:.057:()=>.057,m=createCivilianMotion({scale,phase:2.4,groundHeightAt:ground,umbrella:true});let x=0,z=0,last=m.reset({x,z,yaw:0}),maxHipAngle=0,maxKneeAngle=0,maxLegError=0,maxContactSlip=0,maxFootStep=0,maxRootDip=0,worst=null;
 let previousSoles=boots.map(p=>soleCorners(m.writePartMatrix(p,new THREE.Matrix4()))),maxRenderedSoleSlip=0,maxRenderedPenetration=0,maxSoleApiError=0,maxPlantedGap=0;
 for(let t=0;t<8;t+=dt){let vx=0,vz=0;if(scenario==='reverse')vz=t<2?2.6:t<4?-2.6:t<6?2.6:0;else if(scenario==='square'){const i=Math.floor(t/1.3)%4;vx=i===1?2.6:i===3?-2.6:0;vz=i===0?2.6:i===2?-2.6:0;}else vz=t<1.4?.45:0;
  const plan=m.plan(dt,{vx,vz,fleeing:scenario!=='stop-curb'});x+=plan.dx;z+=plan.dz;const s=m.update(dt,{x,z,groundY:ground(x,z),fleeing:scenario!=='stop-curb'});
  for(let j=0;j<2;j++){const foot=s.feet[j],old=last.feet[j],suffix=j?'R':'L',h=s.jointPositions['hip'+suffix],k=s.jointPositions['knee'+suffix],a=new THREE.Vector3(foot.x,foot.y+.135*scale,foot.z);const thigh=s.segmentOrientations['thigh'+suffix],shin=s.segmentOrientations['shin'+suffix];maxHipAngle=Math.max(maxHipAngle,new THREE.Vector3(0,1,0).applyQuaternion(thigh).angleTo(new THREE.Vector3(0,1,0)));maxKneeAngle=Math.max(maxKneeAngle,thigh.angleTo(shin));const error=Math.max(Math.abs(h.distanceTo(k)-.245*scale),Math.abs(k.distanceTo(a)-.285*scale));if(error>maxLegError){maxLegError=error;worst={t,x,z,yaw:s.yaw,foot,h:h.toArray(),k:k.toArray()};}const shift=Math.hypot(foot.x-old.x,foot.y-old.y,foot.z-old.z);maxFootStep=Math.max(maxFootStep,shift);if(foot.planted&&old.planted)maxContactSlip=Math.max(maxContactSlip,shift);}
  const soles=boots.map(p=>soleCorners(m.writePartMatrix(p,new THREE.Matrix4())));
  for(let j=0;j<2;j++){const foot=s.feet[j],corners=soles[j],center=corners.reduce((v,p)=>v.addScaledVector(p,.25),new THREE.Vector3());
   const expected=new THREE.Vector3(foot.x+Math.sin(foot.yaw)*.03*scale,foot.y,foot.z+Math.cos(foot.yaw)*.03*scale);maxSoleApiError=Math.max(maxSoleApiError,center.distanceTo(expected));
   for(let k=0;k<4;k++){maxRenderedPenetration=Math.max(maxRenderedPenetration,ground(corners[k].x,corners[k].z)-corners[k].y);if(foot.planted&&last.feet[j].planted)maxRenderedSoleSlip=Math.max(maxRenderedSoleSlip,corners[k].distanceTo(previousSoles[j][k]));}
   if(foot.planted)maxPlantedGap=Math.max(maxPlantedGap,Math.min(...corners.map(p=>p.y-ground(p.x,p.z))));
  }previousSoles=soles;
  maxRootDip=Math.max(maxRootDip,s.groundY-s.originY);last=s;
 }
 geometryResults.push({dt,scale,scenario,maxHipAngle,maxKneeAngle,maxLegError,maxContactSlip,maxFootStep,maxRootDip,maxRenderedSoleSlip,maxRenderedPenetration,maxSoleApiError,maxPlantedGap,worst});
}

for(const r of geometryResults){
 if(r.maxLegError>1e-7||r.maxRenderedSoleSlip>1e-7||r.maxRenderedPenetration>1e-7||r.maxSoleApiError>1e-7||r.maxHipAngle>1.2||r.maxKneeAngle>1.65)throw new Error('Invalid grounded gait: '+JSON.stringify(r));
}
console.log('PASS 36 low-frame-rate reversal, square-turn and curb cases; measured world-space sole contacts, leg lengths and joint limits.');
console.log(JSON.stringify({performanceResults,cases:geometryResults.length}));
if(process.env.CIVILIAN_GAIT_EDGE_REPORT)fs.writeFileSync(process.env.CIVILIAN_GAIT_EDGE_REPORT,JSON.stringify({passed:true,checkedAtUTC:new Date().toISOString(),performanceResults,geometryResults},null,2));
