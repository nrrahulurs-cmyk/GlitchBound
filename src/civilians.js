import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const UNIT_BOX = new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
const clamp = THREE.MathUtils.clamp;

function boundsFromMatrix(box,matrix) {
  const e=matrix.elements,rx=(Math.abs(e[0])+Math.abs(e[4])+Math.abs(e[8]))/2,ry=(Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]))/2,rz=(Math.abs(e[2])+Math.abs(e[6])+Math.abs(e[10]))/2;
  box.min.set(e[12]-rx,e[13]-ry,e[14]-rz);box.max.set(e[12]+rx,e[13]+ry,e[14]+rz);return box;
}

/** Voxel body hit tests, civilian movement, and grounded persistent fall poses. */
export function createCivilianSystem({people,mesh,colliders=[],groundHeightAt=()=>.057,bounds}) {
  let elapsed=0;
  let physics=null;
  const physicalDeaths=[];
  const bodyTransform=new THREE.Matrix4(),bodyPosition=new THREE.Vector3(),bodyQuaternion=new THREE.Quaternion(),unitScale=new THREE.Vector3(1,1,1);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Matrix4(),yawMatrix=new THREE.Matrix4();
  const pose=new THREE.Object3D(),color=new THREE.Color(),partBox=new THREE.Box3();
  const inverse=new THREE.Matrix4(),ray=new THREE.Ray(),localRay=new THREE.Ray();
  const intersection=new THREE.Vector3(),worldHit=new THREE.Vector3();
  const grid=new Map(),cell=24;
  for(const obstacle of colliders) {
    if(obstacle.y-obstacle.sy/2>3)continue;
    for(let x=Math.floor((obstacle.x-obstacle.sx/2-2)/cell);x<=Math.floor((obstacle.x+obstacle.sx/2+2)/cell);x++)
      for(let z=Math.floor((obstacle.z-obstacle.sz/2-2)/cell);z<=Math.floor((obstacle.z+obstacle.sz/2+2)/cell);z++) {
        const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(obstacle);
      }
  }
  const obstaclesAt=(x,z)=>grid.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[];
  const blocked=(x,z,r=.48)=>Boolean(bounds&&(x<bounds.minX+r||x>bounds.maxX-r||z<bounds.minZ+r||z>bounds.maxZ-r))||obstaclesAt(x,z).some(b=>Math.abs(x-b.x)<b.sx/2+r&&Math.abs(z-b.z)<b.sz/2+r);
  let instance=0;
  for(let i=0;i<people.length;i++) {
    const p=people[i];p.id=`CIV-${String(i+1).padStart(3,'0')}`;
    p.spawn={x:p.x,z:p.z,speed:p.speed};p.health=100;p.alive=true;p.fleeUntil=0;p.fleeX=0;p.fleeZ=0;
    p.groundY=groundHeightAt(p.x,p.z);p.yaw=p.speed<0?Math.PI:0;p.stride=0;
    p.lastVehicleImpact=-Infinity;p.vehicleContact=false;p.vehicleHitLocked=false;p.fall=null;p.bodyBox=new THREE.Box3();
    p.instanceStart=instance;
    p.parts=p.pieces.map(piece=>({piece,index:instance++,matrix:new THREE.Matrix4()}));
    for(const part of p.parts)mesh.setColorAt(part.index,color.set(part.piece.c));
  }
  mesh.instanceColor.needsUpdate=true;
  const byId=new Map(people.map(p=>[p.id,p]));

  function localPart(p,part,stride=p.stride) {
    const piece=part.piece;
    const leg=piece.motion===1?1:piece.motion===2?-1:0,arm=piece.motion===3?-1:piece.motion===4?1:0;
    const sway=(leg||arm)*stride;
    pose.position.set(piece.x*p.scale,(piece.y-.145+(leg?Math.max(0,-sway)*.035:0))*p.scale,(piece.z+leg*stride*.085+arm*stride*.045)*p.scale);
    pose.scale.set(piece.sx*p.scale,piece.sy*p.scale,piece.sz*p.scale);
    pose.rotation.set((leg*.11+arm*.16)*stride,0,0);pose.updateMatrix();
    return pose.matrix;
  }

  function renderAlive(p) {
    yawMatrix.makeRotationY(p.yaw);yawMatrix.setPosition(p.x,p.groundY,p.z);p.bodyBox.makeEmpty();
    for(const part of p.parts) {
      part.matrix.multiplyMatrices(yawMatrix,localPart(p,part));
      mesh.setMatrixAt(part.index,part.matrix);
      if(!part.piece.umbrella)p.bodyBox.union(boundsFromMatrix(partBox,part.matrix));
    }
  }

  // Body and dropped umbrella settle independently. A canopy cannot hold a
  // horizontal torso in midair; each rigid voxel assembly touches pavement.
  function fallenPose(p,progress,targetYaw,write=true) {
    const eased=progress*progress*(3-2*progress);
    const yaw=p.fall.startYaw+Math.atan2(Math.sin(targetYaw-p.fall.startYaw),Math.cos(targetYaw-p.fall.startYaw))*eased;
    yawMatrix.makeRotationY(yaw);rotation.makeRotationX(eased*Math.PI/2);matrix.multiplyMatrices(yawMatrix,rotation);
    let bodyMin=Infinity,umbrellaMin=Infinity;
    const bodyBounds=new THREE.Box3(),umbrellaBounds=new THREE.Box3();
    for(const part of p.parts) {
      part.matrix.multiplyMatrices(matrix,localPart(p,part,p.fall.stride*(1-eased)));
      const e=part.matrix.elements;e[12]+=p.x;e[14]+=p.z;
      if(part.piece.umbrella){e[12]+=(Math.sin(yaw)*.4+Math.cos(yaw)*.23)*eased;e[14]+=(Math.cos(yaw)*.4-Math.sin(yaw)*.23)*eased;}
      boundsFromMatrix(partBox,part.matrix);
      if(part.piece.umbrella){umbrellaMin=Math.min(umbrellaMin,partBox.min.y);umbrellaBounds.union(partBox);}
      else {bodyMin=Math.min(bodyMin,partBox.min.y);bodyBounds.union(partBox);}
    }
    const floorFor=b=>b.isEmpty()?p.groundY:Math.max(groundHeightAt((b.min.x+b.max.x)/2,(b.min.z+b.max.z)/2),groundHeightAt(b.min.x,b.min.z),groundHeightAt(b.max.x,b.max.z),groundHeightAt(b.min.x,b.max.z),groundHeightAt(b.max.x,b.min.z));
    const bodyLift=floorFor(bodyBounds)-bodyMin,umbrellaLift=Number.isFinite(umbrellaMin)?bodyLift+(floorFor(umbrellaBounds)-umbrellaMin-bodyLift)*eased:0;
    bodyBounds.translate(new THREE.Vector3(0,bodyLift,0));
    for(const part of p.parts) {
      part.matrix.elements[13]+=part.piece.umbrella?umbrellaLift:bodyLift;
      if(write)mesh.setMatrixAt(part.index,part.matrix);
    }
    if(write)p.bodyBox.copy(bodyBounds);
    return bodyBounds;
  }

  function boxBlocked(b) {
    const seen=new Set();
    for(const x of [b.min.x,(b.min.x+b.max.x)/2,b.max.x])for(const z of [b.min.z,(b.min.z+b.max.z)/2,b.max.z])
      for(const c of obstaclesAt(x,z)) {
        if(seen.has(c))continue;seen.add(c);
        if(b.max.y>c.y-c.sy/2+.01&&b.min.y<c.y+c.sy/2&&b.max.x>c.x-c.sx/2&&b.min.x<c.x+c.sx/2&&b.max.z>c.z-c.sz/2&&b.min.z<c.z+c.sz/2)return true;
      }
    return false;
  }

  function startFall(p,direction) {
    p.fall={time:0,duration:.78,startYaw:p.yaw,yaw:p.yaw,stride:p.stride};
    // Try the walking direction first on narrow sidewalks, then alternate
    // directions. The root stays at the impact position throughout the fall.
    const impulseYaw=direction&&Math.hypot(direction.x||0,direction.z||0)>.01?Math.atan2(direction.x,direction.z):p.yaw;
    const candidates=[p.yaw,p.yaw+Math.PI,impulseYaw,p.yaw+Math.PI/2,p.yaw-Math.PI/2];
    for(const candidate of candidates) {
      const finalBox=fallenPose(p,1,candidate,false);
      if(!boxBlocked(finalBox)){p.fall.yaw=candidate;break;}
    }
    fallenPose(p,0,p.fall.yaw);mesh.instanceMatrix.needsUpdate=true;
  }

  function attachPhysics({world,material,groundHeightAt:sampleGround=groundHeightAt}) {
    if(physics?.world===world)return;
    if(physicalDeaths.length)throw new Error('Attach civilian physics before any physical deaths');
    physics={world,material,groundHeightAt:sampleGround};
  }

  function rigidParts(parts,mass,direction,speed,umbrella=false) {
    const bounds=new THREE.Box3();
    for(const part of parts)bounds.union(partBox.copy(UNIT_BOX).applyMatrix4(part.matrix));
    const center=bounds.getCenter(new THREE.Vector3()),body=new CANNON.Body({mass,material:physics.material,
      linearDamping:umbrella?.18:.085,angularDamping:.18,allowSleep:true,sleepSpeedLimit:.22,sleepTimeLimit:1.2});
    body.position.set(center.x,center.y,center.z);
    const groups=new Map();
    for(const part of parts){
      const piece=part.piece;
      const key=umbrella?(piece.sy>.5?'pole':'canopy'):piece.motion?`limb-${piece.motion}`:piece.y>1.62?'head':'torso';
      if(!groups.has(key))groups.set(key,new THREE.Box3());
      groups.get(key).union(partBox.copy(UNIT_BOX).applyMatrix4(part.matrix));
    }
    for(const shape of groups.values()){
      const size=shape.getSize(new THREE.Vector3()),offset=shape.getCenter(new THREE.Vector3()).sub(center);
      body.addShape(new CANNON.Box(new CANNON.Vec3(Math.max(.04,size.x/2),Math.max(.04,size.y/2),Math.max(.04,size.z/2))),new CANNON.Vec3(offset.x,offset.y,offset.z));
    }
    const localOrigin=new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z);
    const members=parts.map(part=>({part,local:part.matrix.clone().premultiply(localOrigin)}));
    physics.world.addBody(body);
    const push=speed>0?Math.min(18,speed*.68):.65,up=speed>0?Math.min(7,.7+speed*.2):.05;
    body.applyImpulse(new CANNON.Vec3((direction?.x||0)*mass*push,mass*(umbrella?up+1.5:up),(direction?.z||0)*mass*push));
    body.angularVelocity.set((direction?.z||.5)*(speed>0?4:1.2),umbrella?2:.35,-(direction?.x||.35)*(speed>0?4:1.2));
    return{body,members,umbrella,frozen:false};
  }

  function renderRigidRecord(record,write=true) {
    const b=record.body;
    bodyPosition.set(b.position.x,b.position.y,b.position.z);bodyQuaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
    bodyTransform.compose(bodyPosition,bodyQuaternion,unitScale);
    const result=new THREE.Box3();
    for(const member of record.members){
      member.part.matrix.multiplyMatrices(bodyTransform,member.local);
      result.union(partBox.copy(UNIT_BOX).applyMatrix4(member.part.matrix));
      if(write)mesh.setMatrixAt(member.part.index,member.part.matrix);
    }return result;
  }

  function freezeRigid(record) {
    if(record.frozen)return;
    const b=record.body,shape=renderRigidRecord(record,false);
    const floor=Math.max(physics.groundHeightAt(shape.min.x,shape.min.z),physics.groundHeightAt(shape.max.x,shape.max.z),physics.groundHeightAt(b.position.x,b.position.z));
    // Bounded cleanup must never leave an airborne frozen body.
    if(shape.min.y>floor+.03)b.position.y-=shape.min.y-floor-.006;
    b.velocity.setZero();b.angularVelocity.setZero();b.mass=0;b.type=CANNON.Body.STATIC;b.updateMassProperties();b.aabbNeedsUpdate=true;b.sleep();record.frozen=true;
  }

  function startPhysicalDeath(p,direction,cause,speed) {
    const bodyParts=p.parts.filter(part=>!part.piece.umbrella),umbrellaParts=p.parts.filter(part=>part.piece.umbrella);
    const records=[rigidParts(bodyParts,68,direction,cause==='vehicle'?Math.abs(speed):0)];
    if(umbrellaParts.length)records.push(rigidParts(umbrellaParts,3,direction,cause==='vehicle'?Math.abs(speed)*.7:0,true));
    p.physical={records,age:0};p.fall={time:0,duration:.78};physicalDeaths.push(p);
    const active=physicalDeaths.filter(person=>person.physical.records.some(record=>!record.frozen));
    while(active.length>24){const oldest=active.shift();oldest.physical.records.forEach(freezeRigid);}
  }

  function updatePhysicalDeath(p,step) {
    p.physical.age+=step;p.fall.time=Math.min(p.fall.duration,p.fall.time+step);
    for(const record of p.physical.records){
      const body=record.body;
      if(body.velocity.length()>45)body.velocity.scale(45/body.velocity.length(),body.velocity);
      // Sleeping bodies keep their mass so later vehicle contacts can wake
      // them. Only the oldest assemblies freeze when the corpse cap is full.
      const bounds=renderRigidRecord(record);
      if(!record.umbrella){p.bodyBox.copy(bounds);p.x=body.position.x;p.z=body.position.z;p.groundY=physics.groundHeightAt(p.x,p.z);}
    }
  }

  function frighten(source,direction) {
    for(const witness of people) {
      if(!witness.alive||Math.hypot(witness.x-source.x,witness.z-source.z)>17)continue;
      let dx=witness.x-source.x,dz=witness.z-source.z;
      if(Math.hypot(dx,dz)<.3){dx=direction?.x||0;dz=direction?.z||Math.sign(witness.speed)||1;}
      const length=Math.hypot(dx,dz)||1;
      witness.fleeX=dx/length;witness.fleeZ=dz/length;witness.fleeUntil=elapsed+5.5;
    }
  }

  function damage(id,amount,{direction,cause='gun',speed=0}={}) {
    const p=byId.get(id);
    if(!p?.alive||!Number.isFinite(amount)||amount<=0)return {hit:false,killed:false};
    p.health=Math.max(0,p.health-amount);p.lastCause=cause;p.lastImpactSpeed=speed;
    const killed=p.health===0;
    frighten(p,direction);
    if(killed){p.alive=false;p.fleeUntil=0;if(physics)startPhysicalDeath(p,direction,cause,speed);else startFall(p,direction);}
    return {hit:true,killed};
  }

  function raycast(origin,direction,maxDistance=200) {
    if(!Number.isFinite(maxDistance)||maxDistance<=0)return null;
    ray.set(origin,direction);let nearest=null,best=maxDistance;
    for(const p of people) {
      if((!p.alive&&!p.physical)||!ray.intersectsBox(p.bodyBox))continue;
      for(const part of p.parts) {
        if(part.piece.umbrella)continue;
        inverse.copy(part.matrix).invert();localRay.copy(ray).applyMatrix4(inverse);
        if(!localRay.intersectBox(UNIT_BOX,intersection))continue;
        worldHit.copy(intersection).applyMatrix4(part.matrix);
        const distance=origin.distanceTo(worldHit);
        if(distance<best){best=distance;nearest={id:p.id,distance,point:worldHit.clone(),corpse:!p.alive};}
      }
    }
    return nearest;
  }

  function impulse(id,direction,point,strength=45){
    const record=byId.get(id)?.physical?.records[0];if(!record||record.frozen)return false;
    const b=record.body;b.wakeUp();b.applyImpulse(new CANNON.Vec3(direction.x*strength,direction.y*strength,direction.z*strength),
      new CANNON.Vec3(point.x-b.position.x,point.y-b.position.y,point.z-b.position.z));return true;
  }

  function vehicleImpact(from,to,{yaw=0,speed=0,halfWidth=1.45,halfLength=2.64}={}) {
    const magnitude=Math.abs(speed),c=Math.cos(yaw),s=Math.sin(yaw),results=[];
    if(![from.x,from.z,to.x,to.z,yaw,magnitude,halfWidth,halfLength].every(Number.isFinite))return results;
    for(const p of people) {
      if(!p.alive)continue;
      let contact=false,entry=null;
      // The four slab axes include the vehicle's side/end axes and the body's
      // voxel axes. This is a swept OBB test, not a broad circle approximation.
      for(const part of p.parts) {
        if(part.piece.umbrella)continue;
        boundsFromMatrix(partBox,part.matrix);
        const vehicleFloor=Math.min(from.y||p.groundY,to.y||p.groundY);
        if(partBox.min.y>vehicleFloor+1.55||partBox.max.y<vehicleFloor-.15)continue;
        const e=part.matrix.elements,px=e[12],pz=e[14];
        let enter=0,leave=1,partContact=true;
        for(const [ax,az] of [[c,-s],[s,c],[e[0],e[2]],[e[8],e[10]]]) {
          if(Math.hypot(ax,az)<1e-9)continue;
          const extent=(Math.abs(ax*e[0]+az*e[2])+Math.abs(ax*e[4]+az*e[6])+Math.abs(ax*e[8]+az*e[10]))/2+halfWidth*Math.abs(ax*c-az*s)+halfLength*Math.abs(ax*s+az*c);
          const a=(from.x-px)*ax+(from.z-pz)*az,b=(to.x-px)*ax+(to.z-pz)*az,d=b-a;
          if(Math.abs(b)>extent)partContact=false;
          if(Math.abs(d)<1e-10){if(Math.abs(a)>extent){enter=2;break;}continue;}
          const t1=(-extent-a)/d,t2=(extent-a)/d;
          enter=Math.max(enter,Math.min(t1,t2));leave=Math.min(leave,Math.max(t1,t2));
          if(enter>leave)break;
        }
        if(partContact&&enter<=leave)contact=true;
        if(enter<=leave&&(entry===null||enter<entry))entry=enter;
      }
      const locked=p.vehicleHitLocked;p.vehicleContact=contact;if(!contact)p.vehicleHitLocked=false;
      if(entry===null||magnitude<4||locked||elapsed-p.lastVehicleImpact<1.2)continue;
      p.lastVehicleImpact=elapsed;
      p.vehicleHitLocked=contact;
      const amount=magnitude>=9?100:Math.round(30+(magnitude-4)*12);
      const direction=new THREE.Vector3(to.x-from.x,0,to.z-from.z).normalize();
      const outcome=damage(p.id,amount,{direction,cause:'vehicle',speed:magnitude});
      if(outcome.hit)results.push({id:p.id,damage:amount,killed:outcome.killed,point:new THREE.Vector3(p.x,p.groundY+.7*p.scale,p.z)});
    }
    return results;
  }

  function move(p,dx,dz) {
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.2));let moved=false;
    for(let i=0;i<steps;i++) {
      const nx=p.x+dx/steps,nz=p.z+dz/steps;
      if(!blocked(nx,nz,.43*p.scale)){p.x=nx;p.z=nz;moved=true;}
      else if(!blocked(p.x,nz,.43*p.scale)){p.z=nz;moved=true;}
      else if(!blocked(nx,p.z,.43*p.scale)){p.x=nx;moved=true;}
    }
    return moved;
  }

  function update(dt,time,playerPosition) {
    elapsed+=Math.max(0,dt);
    const step=Math.min(.1,Math.max(0,dt));
    for(const p of people) {
      if(!p.alive) {
        if(p.physical)updatePhysicalDeath(p,step);
        else if(p.fall.time<p.fall.duration){p.fall.time=Math.min(p.fall.duration,p.fall.time+step);fallenPose(p,p.fall.time/p.fall.duration,p.fall.yaw);}
        continue;
      }
      const fleeing=p.fleeUntil>elapsed,paused=!fleeing&&playerPosition&&Math.hypot(p.x-playerPosition.x,p.z-playerPosition.z)<1.7;
      let dx=fleeing?p.fleeX*2.6*step:0,dz=fleeing?p.fleeZ*2.6*step:paused?0:p.speed*step;
      if(p.health<100){dx*=.78;dz*=.78;}
      const moved=move(p,dx,dz);
      if(!fleeing&&(p.z>p.maxZ||p.z<p.minZ)){p.z=clamp(p.z,p.minZ,p.maxZ);p.speed*=-1;}
      // Blocked witnesses follow their clear sidewalk instead of clipping walls.
      if(fleeing&&!moved){p.fleeX=0;p.fleeZ=Math.sign(p.speed)||1;}
      if(moved&&Math.hypot(dx,dz)>.0001)p.yaw=Math.atan2(dx,dz);
      p.groundY=groundHeightAt(p.x,p.z);p.stride=moved?Math.sin(time*(fleeing?8.4:3.4)+p.phase)*(fleeing?1.3:1):0;
      renderAlive(p);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }

  function reset() {
    elapsed=0;
    for(const person of physicalDeaths)for(const record of person.physical.records)physics.world.removeBody(record.body);
    physicalDeaths.length=0;
    for(const p of people) {
      Object.assign(p,p.spawn,{health:100,alive:true,fall:null,physical:null,fleeUntil:0,fleeX:0,fleeZ:0,lastVehicleImpact:-Infinity,vehicleContact:false,vehicleHitLocked:false,lastCause:null,lastImpactSpeed:0});
      p.yaw=p.speed<0?Math.PI:0;p.stride=0;p.groundY=groundHeightAt(p.x,p.z);renderAlive(p);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }

  function getPeople() {
    return people.map(p=>({id:p.id,x:p.x,y:p.physical?p.physical.records[0].body.position.y:p.groundY,z:p.z,groundY:p.groundY,scale:p.scale,yaw:p.yaw,health:p.health,alive:p.alive,injured:p.alive&&p.health<100,fleeing:p.alive&&p.fleeUntil>elapsed,fallProgress:p.fall?p.fall.time/p.fall.duration:0,physical:Boolean(p.physical),physics:p.physical?{speed:p.physical.records[0].body.velocity.length(),velocity:{...p.physical.records[0].body.velocity},sleeping:p.physical.records[0].body.sleepState===CANNON.Body.SLEEPING,frozen:p.physical.records[0].frozen}:null,instanceStart:p.instanceStart,instanceCount:p.parts.length,vehicleCooldown:Math.max(0,1.2-(elapsed-p.lastVehicleImpact)),cause:p.lastCause||null,aimPoint:{x:p.x,y:p.groundY+1.12*p.scale,z:p.z},bodyBounds:{min:{x:p.bodyBox.min.x,y:p.bodyBox.min.y,z:p.bodyBox.min.z},max:{x:p.bodyBox.max.x,y:p.bodyBox.max.y,z:p.bodyBox.max.z}}}));
  }
  function getState() {
    const alive=people.filter(p=>p.alive).length;
    return {total:people.length,alive,dead:people.length-alive,injured:people.filter(p=>p.alive&&p.health<100).length,fleeing:people.filter(p=>p.alive&&p.fleeUntil>elapsed).length,physicalCorpses:physicalDeaths.length,activeCorpseBodies:physicalDeaths.reduce((n,p)=>n+p.physical.records.filter(record=>!record.frozen).length,0),time:elapsed};
  }
  function getColliders(){
    return people.map(p=>({id:p.id,civilian:true,alive:p.alive,dynamic:Boolean(p.physical),x:(p.bodyBox.min.x+p.bodyBox.max.x)/2,y:(p.bodyBox.min.y+p.bodyBox.max.y)/2,z:(p.bodyBox.min.z+p.bodyBox.max.z)/2,
      sx:p.bodyBox.max.x-p.bodyBox.min.x,sy:p.bodyBox.max.y-p.bodyBox.min.y,sz:p.bodyBox.max.z-p.bodyBox.min.z}));
  }
  reset();
  return {mesh,update,raycast,damage,vehicleImpact,reset,getState,getPeople,getColliders,attachPhysics,impulse};
}
