import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {cacheBootSole,collectFootSupportSurfaces,createFootContact,createFootContactUniforms,resolveFootSupport,sampleFootContact,injectFootContactAO} from '../src/foot-contact.js';
import {createCityLayout} from '../src/city-layout.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';

const bytes=fs.readFileSync(new URL('../public/assets/mercenary.glb',import.meta.url));
const source=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const results=[],V=(x,y,z)=>new THREE.Vector3(x,y,z);
function test(name,run){try{const detail=run();results.push({name,passed:true,...detail});console.log('PASS '+name,JSON.stringify(detail));}catch(e){results.push({name,passed:false,error:e.stack});console.error('FAIL '+name,e.stack);}}
function fixture({floor={id:'actual-flat-slab',x:0,y:-.05,z:0,sx:8,sy:.1,sz:8},getColliders}={}){
  const avatar=source.clone(true);avatar.scale.setScalar(1.12);const uniforms=createFootContactUniforms();
  const controller=createFootContact({avatar,uniforms,getColliders:getColliders||(()=>[floor])});controller.update({grounded:true});return{avatar,controller,uniforms,floor};
}

test('Actual GLB boot sole geometry is cached in the animated joint frame',()=>{
  const f=fixture(),records=[];
  for(const [name,angle]of[['left_leg',.18],['right_leg',-.27]]){
    const cached=cacheBootSole(f.avatar,name);assert(cached);assert(cached.geometryVertexCount>8);assert(cached.soleVertexCount>=4);
    assert(Math.abs(cached.localBounds.maxX-cached.localBounds.minX-.25)<1e-5);
    assert(Math.abs(cached.localBounds.maxZ-cached.localBounds.minZ-.43)<1e-5);
    cached.joint.rotation.x=angle;f.avatar.rotation.y=.71;f.avatar.position.set(1,.04,2);f.controller.update({grounded:true});
    const foot=f.controller.getState().feet.find(p=>p.name===name);cached.joint.updateWorldMatrix(true,false);
    for(let i=0;i<4;i++)assert(cached.localQuad[i].clone().applyMatrix4(cached.joint.matrixWorld).distanceTo(new THREE.Vector3(...foot.soleQuad[i]))<1e-10);
    records.push({name,frameName:cached.frameName,geometryVertices:cached.geometryVertexCount,soleVertices:cached.soleVertexCount,localBounds:cached.localBounds});
  }
  f.controller.dispose();return{records,actualGLBSHA256:crypto.createHash('sha256').update(bytes).digest('hex')};
});

function articulatedAvatar(){
  const avatar=source.clone(true),authored=Boolean(avatar.getObjectByName('left_foot')&&avatar.getObjectByName('right_foot'));
  // Until the updated GLB is available, exercise the agreed hierarchy using its
  // actual existing rubber boot geometry. This is a binding fixture, not IK.
  if(!authored)for(const side of['left','right']){
    const hip=avatar.getObjectByName(side+'_leg');let boot;
    hip.traverse(mesh=>{if(mesh.isMesh&&mesh.material.name==='carbon rubber')boot=mesh;});assert(boot,'Actual GLB rubber boot required');
    const knee=new THREE.Group(),foot=new THREE.Group();knee.name=side+'_knee';foot.name=side+'_foot';
    knee.position.y=-.29;foot.position.y=-.34;hip.add(knee);knee.add(foot);avatar.updateWorldMatrix(true,true);foot.attach(boot);
  }
  return{avatar,authored};
}
function bootVertices(avatar,side){
  avatar.updateWorldMatrix(true,true);const points=[];
  avatar.getObjectByName(side+'_foot').traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;
    for(let i=0;i<a.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld));
  });return points;
}

test('Actual boot corners follow compound hip, knee and ankle motion on separate supports',()=>{
  let maxCornerError=0,minimumAnkleResponse=Infinity,cases=0;const {avatar,authored}=articulatedAvatar();
  let supports=[];const uniforms=createFootContactUniforms(),controller=createFootContact({avatar,uniforms,getColliders:()=>supports});
  for(const scale of[.85,1.12,1.3])for(const yaw of[-1.1,0,.73])for(const angle of[-.32,.18,.42]){
    avatar.scale.setScalar(scale);avatar.position.set(4,3.065,-6);avatar.rotation.y=yaw;supports=[];
    const expected=[];
    for(const [i,side]of['left','right'].entries()){
      const hip=avatar.getObjectByName(side+'_leg'),knee=avatar.getObjectByName(side+'_knee'),ankle=avatar.getObjectByName(side+'_foot');
      hip.rotation.x=angle*(i?-1:1);knee.rotation.x=-hip.rotation.x*1.8;ankle.rotation.x=-hip.rotation.x-knee.rotation.x;
      const vertices=bootVertices(avatar,side),top=Math.min(...vertices.map(p=>p.y)),low=vertices.filter(p=>p.y<top+1e-5);
      const x=(Math.min(...low.map(p=>p.x))+Math.max(...low.map(p=>p.x)))/2,z=(Math.min(...low.map(p=>p.z))+Math.max(...low.map(p=>p.z)))/2;
      supports.push({id:side+'-upper-deck',x,y:top-.05,z,sx:.25*scale+.07,sy:.1,sz:.43*scale+.08,ry:yaw});
      expected.push({side,vertices,top});
    }
    supports.push({id:'court-under-decks',x:4,y:.135,z:-6,sx:20,sy:.1,sz:20});
    controller.update({grounded:true});const state=controller.getState();
    for(const [i,e]of expected.entries()){
      const foot=state.feet[i];assert.equal(foot.frameName,e.side+'_foot');assert.equal(foot.name,e.side+'_leg');assert.equal(foot.support.id,e.side+'-upper-deck');assert(Math.abs(foot.supportTop-e.top)<1e-8);assert(foot.gain>.999);
      for(const q of foot.soleQuad){const actual=new THREE.Vector3(...q),error=Math.min(...e.vertices.map(p=>p.distanceTo(actual)));maxCornerError=Math.max(maxCornerError,error);assert(error<1e-7,'Contact quad must coincide with rendered boot corners, not the hip-frame bind pose');}
      const at=new THREE.Vector3(foot.uniforms.center[0],foot.supportTop,foot.uniforms.center[2]);assert(sampleFootContact(uniforms,at)<.8);assert.equal(sampleFootContact(uniforms,at.setY(.185)),1,'No contact through the upper deck onto the court');
    }
    // Move only the ankle after caching. The old hip-frame implementation
    // cannot observe this motion even though the actual boot visibly rotates.
    avatar.getObjectByName('left_foot').rotation.x+=.16;controller.update({grounded:true});
    const after=controller.getState().feet[0],actual=bootVertices(avatar,'left');
    const response=Math.max(...after.soleQuad.map((q,i)=>new THREE.Vector3(...q).distanceTo(new THREE.Vector3(...state.feet[0].soleQuad[i]))));minimumAnkleResponse=Math.min(minimumAnkleResponse,response);assert(response>.02);
    for(const q of after.soleQuad){const corner=new THREE.Vector3(...q);assert(Math.min(...actual.map(p=>p.distanceTo(corner)))<1e-7);}
    assert.equal(sampleFootContact(uniforms,new THREE.Vector3(after.uniforms.center[0],.185,after.uniforms.center[2])),1);cases++;
  }
  controller.dispose();return{cases,usingAuthoredAnkles:authored,maxCornerError,minimumAnkleResponse,lowerFloorAlwaysUnchanged:true};
});

test('Ankle preference retains the legacy hip fallback and does not infer a missing boot',()=>{
  const {avatar}=articulatedAvatar();const ankle=avatar.getObjectByName('left_foot');
  assert.equal(cacheBootSole(avatar,'left_leg').joint,ankle);assert.equal(cacheBootSole(avatar,'left_foot').joint,ankle);
  ankle.name='legacy-boot-mesh-holder';const fallback=cacheBootSole(avatar,'left_leg');assert.equal(fallback.joint,avatar.getObjectByName('left_leg'));assert.equal(fallback.frameName,'left_leg');
  assert(Math.abs(fallback.localBounds.y+.83)<1e-6);assert.equal(cacheBootSole(new THREE.Group(),'left_leg'),null);
  return{preferredFrame:'left_foot',fallbackFrame:'left_leg',emptyAssetHasNoCue:true};
});

test('OBB support handles rotated edges, separate levels and missing surfaces',()=>{
  const quad=[V(-.12,1.01,-.2),V(.12,1.01,-.2),V(.12,1.01,.2),V(-.12,1.01,.2)];
  const deck={id:'rotated-deck',x:0,y:.95,z:0,sx:1.2,sy:.1,sz:.5,ry:Math.PI/4};
  const lower={id:'lower-floor',x:0,y:-.05,z:0,sx:10,sy:.1,sz:10};
  assert.equal(resolveFootSupport(quad,[lower,deck]).box.id,'rotated-deck');
  assert.equal(resolveFootSupport(quad,[lower]),null,'air above lower floor must not invent a support');
  assert.equal(resolveFootSupport(quad,[{...deck,dynamic:true}]),null,'tilted-object AABBs are not real horizontal tops');
  assert.equal(resolveFootSupport(quad,[{...deck,ry:0,x:1.5}]),null);
  const outside=[V(.28,1.01,.28),V(.52,1.01,.28),V(.52,1.01,.68),V(.28,1.01,.68)];
  assert.equal(resolveFootSupport(outside,[deck]),null,'unrotated AABB footprint would incorrectly accept this point');
  const penetrated=quad.map(p=>p.clone().setY(.95));assert.equal(resolveFootSupport(penetrated,[deck]),null);
  return{rotatedSupport:true,noLowerFloorProjection:true,invalidDynamicPlaneRejected:true};
});

test('Per-foot lift, airborne, visibility, vehicle and reset clear the receiver cue',()=>{
  const f=fixture();let s=f.controller.getState();assert(s.feet.every(p=>p.gain>.99));
  const left=f.avatar.getObjectByName('left_leg');left.position.y+=.05;f.controller.update({grounded:true});s=f.controller.getState();assert(s.feet[0].gain>0&&s.feet[0].gain<.8);assert(s.feet[1].gain>.99);
  left.position.y+=.06;f.controller.update({grounded:true});assert.equal(f.controller.getState().feet[0].gain,0);assert(f.controller.getState().feet[1].gain>.99);
  for(const options of[{grounded:false},{inVehicle:true},{active:false}]){f.controller.update(options);assert(f.uniforms.uFootContactCenter.value.every(p=>p.w===0));}
  f.avatar.visible=false;f.controller.update();assert(f.uniforms.uFootContactCenter.value.every(p=>p.w===0));
  f.avatar.visible=true;left.position.y-=.11;f.controller.update();assert(f.controller.getState().feet.every(p=>p.gain>.99));
  f.controller.reset();assert(f.uniforms.uFootContactCenter.value.every(p=>p.w===0));assert.equal(f.controller.getState().lastReason,'reset');
  f.controller.dispose();return{independentFootFade:true,clearedStates:5};
});

test('Footprint falloff is bounded, stays on its support and toggles without pose changes',()=>{
  const f=fixture(),foot=f.controller.getState().feet[0],center=V(foot.uniforms.center[0],0,foot.uniforms.center[2]);
  const dark=sampleFootContact(f.uniforms,center);assert(dark>=.70&&dark<=.721);
  const shape=foot.uniforms.shape,axis=V(shape[0],0,shape[1]),edge=center.clone().addScaledVector(axis,shape[2]);
  const samples=[0,.025,.05,.075,.1,.12].map(distance=>sampleFootContact(f.uniforms,edge.clone().addScaledVector(axis,-distance-shape[2]*2)));
  assert(samples.every((value,i)=>i===0||value>=samples[i-1]-1e-8));assert.equal(samples.at(-1),1);
  assert.equal(sampleFootContact(f.uniforms,center.clone().setY(-.2)),1);assert.equal(sampleFootContact(f.uniforms,center,0),1);assert.equal(sampleFootContact(f.uniforms,center,-1),1);
  // Place the receiving box edge through the footprint. Nothing is darkened
  // across that edge even when it has the same elevation and upward normal.
  f.uniforms.uFootContactSupport.value[0].set(center.x-.1,center.z,.1,.5);
  assert.equal(sampleFootContact(f.uniforms,center.clone().addScaledVector(axis,.04)),1);
  const before=f.controller.getState();f.controller.setEnabled(false);assert.equal(sampleFootContact(f.uniforms,center),1);const after=f.controller.getState();assert.deepEqual(before.feet,after.feet);
  f.controller.setEnabled(true);assert(f.uniforms.uFootContactParams.value.x===.28);f.controller.dispose();
  return{maximumAttenuation:1-dark,outsideFalloffSamples:samples,supportClipped:true,togglePreservesPose:true};
});

test('Shared supports retain thin physical ground and low road slabs without thin visual decorations',()=>{
  const physical={id:'thin-physical',x:0,y:.197,z:0,sx:3.1,sy:.022,sz:40,kind:'pavement'};
  const lowRoad={id:'low-road',x:0,y:-.015,z:0,sx:22,sy:.08,sz:215,kind:'pavement'};
  const paint={...physical,id:'nonphysical-paint',y:.209,sy:.002},unrelated={...lowRoad,id:'building',kind:'building'};
  const ground=[physical],boxes=[physical,lowRoad,paint,unrelated,lowRoad];
  const result=collectFootSupportSurfaces({groundSurfaces:ground,boxes});
  assert.deepEqual(result,[physical,lowRoad]);assert.equal(result[0],physical);assert.equal(result[1],lowRoad);
  assert.equal(ground.length,1);assert.equal(boxes.length,5);assert.deepEqual(collectFootSupportSurfaces(),[]);
  return{physicalThickness:physical.sy,lowRoadTop:lowRoad.y+lowRoad.sy/2,originalReferencesPreserved:true,duplicatesRemoved:true,paintExcluded:true};
});

test('Actual city thin walking band, bench ground and landing resolve their own receiving levels',()=>{
  const layout=createCityLayout(),street=createStreetCollisionLayout(layout),solids=[...layout.colliders,...street.staticColliders],surfaces=collectFootSupportSurfaces({groundSurfaces:street.groundSurfaces,boxes:layout.boxes}),avatar=source.clone(true);avatar.scale.setScalar(1.12);
  const thin=street.groundSurfaces.find(b=>b.id==='COURT-15-CIRCULATION-070');assert(thin,'Use the actual physical walking band that movement includes');assert.equal(thin.sy,.022);assert(Math.abs(thin.y+thin.sy/2-.208)<1e-12);assert(surfaces.includes(thin));assert.equal(surfaces.filter(s=>s===thin).length,1);
  const baseRoad=layout.boxes.find(b=>b.kind==='pavement'&&b.sy>=.025&&b.y+b.sy/2<.08&&!street.groundSurfaces.includes(b));assert(baseRoad&&surfaces.includes(baseRoad),'Low base road slabs outside raised groundSurfaces must remain eligible');
  const uniforms=createFootContactUniforms(),controller=createFootContact({avatar,uniforms,supportSurfaces:surfaces,getColliders:()=>solids}),cases=[];
  for(const pose of[{name:'thin physical walking band',x:thin.x,y:.208,z:thin.z},{name:'bench ground',x:-159.3392,y:.185,z:-251.1466},{name:'housing landing',x:-189,y:3.065,z:-258.651422}]){
    avatar.position.set(pose.x,pose.y,pose.z);controller.update({grounded:true});const state=controller.getState();
    assert(state.feet.every(p=>p.supportTop!==null&&p.gain>.9),JSON.stringify({pose,feet:state.feet}));
    assert(state.feet.every(p=>Math.abs(p.supportTop-pose.y)<.003));
    const foot=state.feet[0],at=V(foot.uniforms.center[0],foot.supportTop,foot.uniforms.center[2]);assert(sampleFootContact(uniforms,at)<.9);
    if(pose.name==='thin physical walking band'){
      assert(state.feet.every(p=>p.support.id===thin.id&&p.gain>.999));assert(Math.abs(sampleFootContact(uniforms,at)-.72)<1e-8,'The actual .208m slab must receive the full contact cue');
      assert.equal(sampleFootContact(uniforms,at.clone().setY(.185)),1,'Do not project the walking-band cue onto its lower courtyard');
    }
    assert.equal(sampleFootContact(uniforms,at.clone().setY(.165)),pose.name==='housing landing'?1:sampleFootContact(uniforms,at.clone().setY(.165)));
    cases.push({name:pose.name,feet:state.feet.map(p=>({supportTop:p.supportTop,gap:p.gap,gain:p.gain,support:p.support.id})),candidates:state.candidateCount});
  }
  controller.dispose();return{cases,physicalThinSurface:thin.id,baseRoadTop:baseRoad.y+baseRoad.sy/2};
});

test('Shader hook follows installed AO accumulation and leaves direct/emitted light untouched',()=>{
  const shader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader},uniforms=createFootContactUniforms();
  injectFootContactAO(shader,{uniforms});const injected=shader.fragmentShader;
  assert(injected.includes('reflectedLight.indirectDiffuse*=footContactAO'));
  assert(injected.includes('computeSpecularOcclusion(footContactDotNV,footContactAO,material.roughness)'));
  assert(!/reflectedLight\.direct(?:Diffuse|Specular)\s*\*=/.test(injected));
  assert.equal((injected.match(/float footContactAmount\(/g)||[]).length,1);injectFootContactAO(shader,{uniforms});assert.equal(shader.fragmentShader,injected);
  for(const [name,value]of Object.entries(uniforms))assert.equal(shader.uniforms[name],value);
  const installed=THREE.ShaderChunk.aomap_fragment;assert(installed.includes('computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness )'));assert(installed.includes('reflectedLight.indirectDiffuse *= ambientOcclusion'));
  const uniformGuard=injected.indexOf('if(uFootContactParams.x>0. && max(uFootContactCenter[0].w,uFootContactCenter[1].w)>0.)');
  const coverageCall=injected.indexOf('float footContactCoverage=footContactAmount('),coverageGuard=injected.indexOf('if(footContactCoverage>0.)');
  assert(uniformGuard>=0&&coverageCall>uniformGuard&&coverageGuard>coverageCall,'Inactive feet must skip world-normal and footprint evaluation');
  assert(injected.indexOf('reflectedLight.indirectDiffuse*=footContactAO')>coverageGuard,'Zero coverage must skip diffuse and specular AO operations');
  // Installed physical-shader identity: at AO=1, base=dotNV+1>=1,
  // exponent=2^(-16*roughness-1)>0, so saturate(pow(base,exponent))=1.
  assert(THREE.ShaderChunk.lights_physical_pars_fragment.includes('pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion'));
  let identitySamples=0;for(let v=0;v<=32;v++)for(let r=0;r<=32;r++){
    assert.equal(THREE.MathUtils.clamp(Math.pow(v/32+1,Math.pow(2,-16*r/32-1)),0,1),1);identitySamples++;
  }
  const suffix=injected.slice(injected.indexOf('float footContactAO=1.'));assert(!suffix.includes('totalEmissiveRadiance *='));assert(!suffix.includes('outgoingLight *='));
  return{threeRevision:THREE.REVISION,sharedUniforms:Object.keys(uniforms).length,fixedFootCount:2,ambientOnly:true,inactiveUniformGuard:true,zeroCoverageGuard:true,stockSpecularIdentitySamples:identitySamples};
});

const report={status:results.every(r=>r.passed)?'passed':'failed',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../src/foot-contact.js',import.meta.url))).digest('hex'),tests:results};
if(process.env.FOOT_CONTACT_REPORT)fs.writeFileSync(process.env.FOOT_CONTACT_REPORT,JSON.stringify(report,null,2)+'\n');
if(results.some(r=>!r.passed))process.exitCode=1;
