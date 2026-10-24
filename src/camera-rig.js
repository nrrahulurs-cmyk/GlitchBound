export const CAMERA_CONFIG=Object.freeze({
  mouseSensitivity:.0022,
  thirdPerson:Object.freeze({distance:4.8,targetOffsetY:-.52,shoulderOffset:.82,followRate:16,minPitch:-.85,maxPitch:.85,minBoomPitch:-.48,maxBoomPitch:.12}),
  firstPerson:Object.freeze({minPitch:-1.35,maxPitch:1.35}),
  vehicle:Object.freeze({distance:8.5,targetHeight:1.6,lookAhead:7,speedLookAhead:.12,followRate:8,pitchBias:.10,minPitch:-.42,maxPitch:.58,minBoomPitch:-.08,maxBoomPitch:.58})
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function wrapAngle(angle){
  if(!Number.isFinite(angle))return 0;
  return Math.atan2(Math.sin(angle),Math.cos(angle));
}

export function applyMouseLook(yaw,pitch,dx,dy,limits,sensitivity=CAMERA_CONFIG.mouseSensitivity){
  if(![yaw,pitch,dx,dy,sensitivity,limits?.minPitch,limits?.maxPitch].every(Number.isFinite)||sensitivity<0||limits.minPitch>limits.maxPitch){
    return{yaw:wrapAngle(yaw),pitch:Number.isFinite(pitch)?pitch:0};
  }
  return{
    yaw:wrapAngle(yaw-dx*sensitivity),
    pitch:clamp(pitch-dy*sensitivity,limits.minPitch,limits.maxPitch)
  };
}

/** Keep look active without pointer lock, except while the cursor is on a control. */
export function isMouseLookActive(pointerLocked,overControl=false){
  return Boolean(pointerLocked||!overControl);
}

/** Convert view pitch (positive looks up) into a trailing vehicle boom elevation. */
export function vehicleBoomPitch(lookPitch,config=CAMERA_CONFIG.vehicle){
  const pitch=Number.isFinite(lookPitch)?lookPitch:0;
  return clamp(config.pitchBias-pitch,config.minBoomPitch,config.maxBoomPitch);
}

export function movementFacingYaw(cameraYaw,forward,strafe){
  if(![cameraYaw,forward,strafe].every(Number.isFinite))return null;
  const x=-Math.sin(cameraYaw)*forward+Math.cos(cameraYaw)*strafe;
  const z=-Math.cos(cameraYaw)*forward-Math.sin(cameraYaw)*strafe;
  if(Math.hypot(x,z)<1e-8)return null;
  return wrapAngle(Math.atan2(-x,-z));
}

export function dampYaw(current,target,rate,dt){
  if(![current,target,rate,dt].every(Number.isFinite)||rate<=0||dt<=0)return wrapAngle(current);
  return wrapAngle(current+wrapAngle(target-current)*(1-Math.exp(-rate*dt)));
}

/** Write one over-shoulder camera pose around the character's upper torso. */
export function setThirdPersonCameraPose(position,yaw,pitch,anchor,desired,config=CAMERA_CONFIG.thirdPerson){
  if(!position||!anchor?.set||!desired?.set||![position.x,position.y,position.z,yaw,pitch].every(Number.isFinite))return 0;
  const cameraPitch=clamp(pitch,config.minPitch,config.maxPitch);
  const boomPitch=clamp(cameraPitch,config.minBoomPitch,config.maxBoomPitch);
  const horizontal=config.distance*Math.cos(boomPitch);
  anchor.set(position.x,position.y+config.targetOffsetY,position.z);
  desired.set(
    anchor.x+Math.sin(yaw)*horizontal+Math.cos(yaw)*config.shoulderOffset,
    anchor.y-Math.sin(boomPitch)*config.distance,
    anchor.z+Math.cos(yaw)*horizontal-Math.sin(yaw)*config.shoulderOffset
  );
  return cameraPitch;
}
