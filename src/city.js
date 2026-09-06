import * as THREE from 'three';
import { createCityLayout } from './city-layout.js';
import { ADVERT_CAMPAIGNS } from './advert-campaigns.js';
import { createStreetCollisionLayout } from './street-collisions.js';
import { createCivilianSystem } from './civilians.js';

// The same deterministic voxel modules are exported to the editable Blender scene.
export function createCity(scene) {
  const layout=createCityLayout();
  const {boxes,signs,colliders,bounds,roads,districts,patrolRoutes,chunks,citySize}=layout;
  const {staticColliders:streetColliders,dynamicProps,removedBoxes}=createStreetCollisionLayout(layout);
  const collisionGrid=new Map(),collisionCell=12;let indexedColliders=-1;
  function indexCollisions(){
    collisionGrid.clear();indexedColliders=colliders.length;
    for(const c of [...colliders,...streetColliders]){
      const cs=Math.abs(Math.cos(c.ry||0)),sn=Math.abs(Math.sin(c.ry||0));
      const hx=(cs*c.sx+sn*c.sz)/2,hz=(sn*c.sx+cs*c.sz)/2;
      for(let x=Math.floor((c.x-hx)/collisionCell);x<=Math.floor((c.x+hx)/collisionCell);x++)for(let z=Math.floor((c.z-hz)/collisionCell);z<=Math.floor((c.z+hz)/collisionCell);z++){
        const key=x+','+z;if(!collisionGrid.has(key))collisionGrid.set(key,[]);collisionGrid.get(key).push(c);
      }
    }
  }
  function getCollidersAt(x,z,radius=1){
    if(indexedColliders!==colliders.length)indexCollisions();
    const nearby=new Set();
    for(let ix=Math.floor((x-radius)/collisionCell);ix<=Math.floor((x+radius)/collisionCell);ix++)for(let iz=Math.floor((z-radius)/collisionCell);iz<=Math.floor((z+radius)/collisionCell);iz++)for(const c of collisionGrid.get(ix+','+iz)||[])nearby.add(c);
    return [...nearby];
  }
  const root=new THREE.Group();root.name='KASUMI WARD / concept city';scene.add(root);
  const groundSurfaces=boxes.filter(v=>v.kind==='pavement'&&v.sx>=1&&v.sz>=1&&v.y+v.sy/2>=.08&&v.y+v.sy/2<=.4);
  function groundHeightAt(x,z){let height=.057;for(const v of groundSurfaces)if(Math.abs(x-v.x)<=v.sx/2&&Math.abs(z-v.z)<=v.sz/2)height=Math.max(height,v.y+v.sy/2);return height}
  const cube=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D(),color=new THREE.Color();
  function luminousMaterial(intensity) {
    const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.38,metalness:.15,emissive:0xffffff,emissiveIntensity:intensity});
    // Instance colors must tint emission as well as diffuse. This gives every
    // neon module and tiny window colored HDR radiance for the bloom pass.
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
    };
    material.customProgramCacheKey=()=>`colored-voxel-emission-${intensity}`;
    return material;
  }
  const materials={
    solid:new THREE.MeshStandardMaterial({roughness:.83,metalness:.18}),
    metal:new THREE.MeshStandardMaterial({roughness:.52,metalness:.65}),
    pavement:new THREE.MeshStandardMaterial({roughness:.38,metalness:.48}),
    window:luminousMaterial(.95),glow:luminousMaterial(4.2),
    glass:new THREE.MeshStandardMaterial({roughness:.16,metalness:.75,transparent:true,opacity:.34,depthWrite:false})
  };
  const chunkGroups=new Map();
  for(const chunk of chunks) {
    const near=new THREE.Group(),far=new THREE.Group();near.name=chunk.id+' / detailed';far.name=chunk.id+' / distant skyline';
    root.add(near,far);chunkGroups.set(chunk.id,{...chunk,near,far});
  }
  const targetGroup=(chunk,lod)=>chunkGroups.has(chunk)?chunkGroups.get(chunk)[lod==='far'?'far':'near']:root;
  const batches=new Map();
  for(const box of boxes){if(removedBoxes.has(box))continue;const key=[box.chunk||'core',box.lod||'near',box.kind].join('|');if(!batches.has(key))batches.set(key,[]);batches.get(key).push(box);}
  for(const [key,items] of batches) {
    const [chunk,lod,kind]=key.split('|');
    const mesh=new THREE.InstancedMesh(cube,materials[kind]||materials.solid,items.length);
    mesh.name=`Shared Blender city / ${kind} / ${items.length} voxels`;
    items.forEach((v,i)=>{
      dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(0,v.ry||0,0);dummy.scale.set(v.sx,v.sy,v.sz);dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(v.c));
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
    mesh.castShadow=kind==='solid'||kind==='metal';mesh.receiveShadow=kind!=='glow'&&kind!=='window';
    mesh.computeBoundingSphere();targetGroup(chunk,lod).add(mesh);
  }
  const textureLoader=new THREE.TextureLoader();
  const portrait=textureLoader.load('/assets/advert-portrait.png');portrait.colorSpace=THREE.SRGBColorSpace;portrait.anisotropy=8;
  const campaignMeshes=new Map();
  function fitCampaign(mesh,aspect){
    const {w,h}=mesh.userData.displayPanel;
    const width=Math.min(w,h*aspect),height=width/aspect;
    mesh.scale.set(width/w,height/h,1);
  }
  const campaigns=ADVERT_CAMPAIGNS.map(({file},index)=>{
    const texture=textureLoader.load('/assets/'+file,loaded=>{
      const aspect=loaded.image.width/loaded.image.height;
      for(const mesh of campaignMeshes.get(index)||[])fitCampaign(mesh,aspect);
    });texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
  });
  const animatedSigns=[],adCache=new Map();
  function canvasAd(spec) {
    const cacheKey=[spec.art,spec.text,spec.sub,spec.tint,spec.w/spec.h,spec.vertical].join('|');
    if(adCache.has(cacheKey))return adCache.get(cacheKey);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=Math.round(512*spec.h/spec.w);
    const ctx=canvas.getContext('2d');let state=371+Math.round(spec.x*17+spec.z*11);
    const r=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    if(spec.art==='circuit') {
      const chip=spec.text==='神経回路';
      const cols=44,rows=Math.round(cols*spec.h/spec.w),cw=canvas.width/cols,ch=canvas.height/rows;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
        const nx=(x-cols*.48)/(cols*.42),ny=(y-rows*.44)/(rows*.34),ring=Math.sqrt(nx*nx+ny*ny);
        let fill=['#116a9e','#138bc0','#42c3e6','#217dab','#8dddf0'][Math.floor(r()*5)];
        if(ring>.48&&ring<.8)fill=r()>.4?'#caf6ff':'#98e8ff';
        if(ring<.3)fill=r()>.4?'#ed44c5':'#7a267f';if(r()>.92)fill='#0b355a';
        if(chip){
          const dx=Math.abs(x-cols*.5),dy=Math.abs(y-rows*.36);
          const core=dx<7&&dy<7,wiring=(x%4===0&&dy<12)||(y%4===0&&dx<17);
          fill=core?(dx>5||dy>5?'#b5f580':'#2e8490'):wiring?(r()>.15?'#39cace':'#cfff8c'):'#072e3f';
        }
        ctx.fillStyle=fill;ctx.fillRect(x*cw,y*ch,cw-.7,ch-.7);
      }
      ctx.fillStyle='#c9faff';ctx.font=`900 ${canvas.height*.17}px "Yu Gothic",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(spec.text,canvas.width*.5,canvas.height*.78,canvas.width*.88);
      ctx.fillStyle='#bff3ff';ctx.font=`700 ${canvas.height*.045}px monospace`;ctx.fillText(spec.sub,canvas.width*.5,canvas.height*.94,canvas.width*.92);
    } else if(spec.art==='shop') {
      ctx.fillStyle='#33180e';ctx.fillRect(0,0,canvas.width,canvas.height);
      for(let y=0;y<canvas.height;y+=10)for(let x=0;x<canvas.width;x+=10){ctx.fillStyle=r()>.5?'#56301a':'#432114';ctx.fillRect(x,y,9,9);}
      ctx.fillStyle=spec.tint;ctx.font=`900 ${Math.min(canvas.height*.7,canvas.width/(spec.text.length*.63))}px monospace`;
      ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillText(spec.text,256,canvas.height*.47,490);
      ctx.strokeStyle=spec.tint;ctx.lineWidth=4;ctx.strokeRect(4,4,504,canvas.height-8);
      if(spec.sub){ctx.font=`600 ${canvas.height*.13}px monospace`;ctx.fillText(spec.sub,256,canvas.height*.89,480);}
    } else {
      ctx.fillStyle='#171523';ctx.fillRect(0,0,canvas.width,canvas.height);
      const chars=(spec.vertical||spec.text).split('');ctx.fillStyle=spec.tint;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font=`700 ${Math.min(410,canvas.height*.8/chars.length)}px "Yu Gothic",sans-serif`;
      chars.forEach((char,i)=>ctx.fillText(char,256,canvas.height*(.15+i*.68/chars.length),460));
      ctx.strokeStyle=spec.tint;ctx.lineWidth=8;ctx.strokeRect(5,5,502,canvas.height-10);
      ctx.font=`800 ${Math.min(70,canvas.width/(spec.text.length*.68))}px monospace`;ctx.fillText(spec.text,256,canvas.height*.9,460);
      ctx.globalAlpha=.1;ctx.fillStyle='#000000';
      for(let x=0;x<canvas.width;x+=13)ctx.fillRect(x,0,1,canvas.height);
      for(let y=0;y<canvas.height;y+=13)ctx.fillRect(0,y,canvas.width,1);ctx.globalAlpha=1;
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;adCache.set(cacheKey,texture);return texture;
  }
  for(const spec of signs) {
    const image=spec.art==='portrait'||spec.art==='dancer'||spec.art==='campaign';
    const texture=spec.art==='campaign'?campaigns[spec.adIndex||0]:image?portrait:canvasAd(spec);
    const brightness=spec.art==='campaign'?1.24:image?1.55:1.3;
    const material=new THREE.MeshBasicMaterial({map:texture,color:new THREE.Color().setScalar(brightness),side:THREE.DoubleSide,toneMapped:true});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(spec.w,spec.h),material);
    mesh.position.set(spec.x,spec.y,spec.z);mesh.rotation.y=spec.ry||0;
    // The display sits 25 mm in front of its planned mounting plane, clear of the backing.
    mesh.translateZ(.025);mesh.name=`Billboard / ${spec.text}`;targetGroup(spec.chunk,'near').add(mesh);
    mesh.userData.adArt=spec.art;mesh.userData.adIndex=spec.adIndex;
    if(spec.art==='campaign'){
      const index=spec.adIndex||0;
      mesh.userData.campaignId=ADVERT_CAMPAIGNS[index].id;mesh.userData.displayPanel={w:spec.w,h:spec.h};
      if(!campaignMeshes.has(index))campaignMeshes.set(index,[]);campaignMeshes.get(index).push(mesh);
      fitCampaign(mesh,texture.image?texture.image.width/texture.image.height:ADVERT_CAMPAIGNS[index].aspectRatio);
    }
    if(image)animatedSigns.push({material,phase:spec.x+spec.z,brightness});
  }
  // The renderer owns all weather, haze, reflective surfaces and environmental sky.
  const lamps=[[-13.8,3.4,14,'#ff8430',23,13],[-15,17,5,'#ef2db7',20,19],[16,9,10,'#29caff',21,18],[18,24,-44,'#e736b1',20,22],[-14,4,-36,'#37d4e9',12,12],[14,4,-100,'#ff9b55',13,15]];
  for(const [x,y,z,c,intensity,distance] of lamps){const lamp=new THREE.PointLight(c,intensity,distance,2);lamp.position.set(x,y,z);root.add(lamp);}
  // Emissive signs do not illuminate Standard materials by themselves. Reuse a
  // small pool of local lights at actual mounted signs so their spill reaches
  // the sidewalk and adjacent unlit masonry without adding hundreds of lights.
  const storefrontEmitters=signs.filter(s=>s.chunk&&s.y>2&&s.y<8&&s.w>2.5&&s.h<2.8&&s.mountType==='wall-panel').map(s=>({
    id:s.id,x:s.x+Math.sin(s.ry||0)*1.15,y:s.y-.45,z:s.z+Math.cos(s.ry||0)*1.15,
    color:new THREE.Color(s.tint).lerp(new THREE.Color('#b9d1e1'),.48),
    intensity:Math.min(185,105+s.w*7),distance:44
  }));
  const storefrontLights=Array.from({length:4},(_,i)=>{
    const light=new THREE.PointLight('#a5c9df',0,44,2);light.name='Mounted storefront spill / '+(i+1);
    light.userData.emitterId=null;light.userData.targetIntensity=0;root.add(light);return light;
  });
  let lightingState={nearestEmitters:[],activeLights:0,visibleBlocks:0};
  function selectStorefrontLights(px,pz){
    const inHero=Math.abs(px)<32&&pz> -180&&pz<45;
    const selected=inHero?[]:storefrontEmitters.map(e=>({emitter:e,distance:Math.hypot(e.x-px,e.z-pz)}))
      .filter(e=>e.distance<62).sort((a,b)=>a.distance-b.distance).slice(0,4);
    const targets=new Map(selected.map(e=>[e.emitter.id,e]));
    for(const light of storefrontLights){
      const existing=targets.get(light.userData.emitterId);
      if(existing){light.userData.targetIntensity=existing.emitter.intensity;targets.delete(existing.emitter.id);}
      else light.userData.targetIntensity=0;
    }
    for(const light of storefrontLights){
      if(light.userData.targetIntensity>0)continue;
      const next=targets.values().next().value;
      if(!next)continue;
      const emitter=next.emitter;targets.delete(emitter.id);
      light.position.set(emitter.x,emitter.y,emitter.z);light.color.copy(emitter.color);light.distance=emitter.distance;
      light.intensity=0;light.userData.emitterId=emitter.id;light.userData.targetIntensity=emitter.intensity;
    }
    lightingState={nearestEmitters:selected.map(({emitter,distance})=>({id:emitter.id,distance,position:[emitter.x,emitter.y,emitter.z]})),activeLights:selected.length,
      visibleBlocks:[...chunkGroups.values()].filter(c=>c.near.visible).length};
  }
  let randomState=29715;
  const rand=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
  const pick=a=>a[Math.floor(rand()*a.length)];
  function pedestrianTemplate(coat,umbrella) {
    let umbrellaPart=false;
    const pieces=[],p=(x,y,z,sx,sy,sz,c,motion=0)=>pieces.push({x,y,z,sx,sy,sz,c,motion,umbrella:umbrellaPart});
    for(const side of [-1,1]) {
      const leg=side<0?1:2;
      p(side*.135,.22,.03,.2,.15,.33,'#131e2b',leg);p(side*.135,.36,0,.15,.22,.17,'#263c4d',leg);
      p(side*.135,.55,.025,.19,.12,.21,'#42505b',leg);p(side*.135,.71,0,.18,.28,.21,'#263141',leg);
      p(side*.18,.9,0,.12,.14,.25,'#3e4755');p(side*.29,1.24,0,.22,.21,.28,coat);
      p(side*.34,1.04,0,.15,.25,.19,'#283944',side<0?3:4);p(side*.34,.88,.035,.15,.1,.17,'#9d8c83',side<0?3:4);
      p(side*.26,1.38,0,.19,.12,.32,'#40505a');p(side*.24,1.1,.18,.12,.12,.05,'#625b58');
    }
    p(0,1.14,0,.46,.51,.31,coat);p(-.115,1.15,.17,.19,.49,.05,coat);p(.115,1.15,.17,.19,.49,.05,coat);
    p(0,1.2,.19,.034,.42,.03,'#afaa94');p(0,.89,0,.5,.12,.35,'#1b2938');
    p(0,1.3,-.24,.32,.36,.14,'#263b49');p(0,1.39,-.32,.18,.18,.025,'#723b48');
    p(0,1.49,0,.13,.12,.13,'#a28d83');p(0,1.65,.015,.3,.28,.27,'#9f8e88');p(0,1.82,-.015,.33,.12,.31,'#162a38');
    p(-.13,1.69,0,.05,.19,.29,'#263b46');p(.13,1.69,0,.05,.19,.29,'#263b46');p(0,1.69,.157,.27,.066,.037,'#59ccd6');
    p(.045,1.60,.164,.12,.025,.025,'#5a595a');p(-.26,1.41,.07,.12,.05,.12,'#ae5b57');
    if(umbrella) {
      umbrellaPart=true;
      p(.35,1.93,.1,.035,1.1,.035,'#4a6374');
      for(let ix=-3;ix<=3;ix++)for(let iz=-3;iz<=3;iz++) {
        if(Math.abs(ix)+Math.abs(iz)>4)continue;
        const tier=Math.max(Math.abs(ix),Math.abs(iz));
        p(.2+ix*.26,2.56-tier*.065,iz*.26,.27,.06,.27,pick(['#182a3c','#1b3546','#213e4d','#203248']));
        if(Math.abs(ix)+Math.abs(iz)===4)p(.2+ix*.26,2.525-tier*.065,iz*.26,.27,.025,.27,'#477f94');
      }
      p(.2,2.7,0,.055,.2,.055,'#4a6577');
    }
    return pieces;
  }
  const people=[];
  for(let i=0;i<284;i++) {
    const side=i%2?-1:1,p={x:side*(12+rand()*2.0),z:27-rand()*192,speed:(rand()>.5?1:-1)*(.18+rand()*.44),phase:rand()*12,scale:.91+rand()*.17,minZ:-170,maxZ:34};
    if(i>32){p.x=(rand()-.5)*18;p.z=-65-rand()*98;}
    if(i>=44){
      const index=i-44,avenue=index%6,walkSide=Math.floor(index/6)%2?-1:1;
      p.x=[-310,-210,-90,90,210,310][avenue]+walkSide*(12.7+rand()*.7);
      p.z=135-(Math.floor(index/12)+rand()*.6)*34;p.minZ=-555;p.maxZ=150;p.speed*=1.6;
    }
    const district=districts.reduce((a,d)=>!a||Math.hypot(d.x-p.x,d.z-p.z)<Math.hypot(a.x-p.x,a.z-p.z)?d:a,null)?.name;
    const coatPalette=district==='Lantern Market'?['#b35b49','#ad8856','#567d87']:district==='Iron Docks'?['#c2a04e','#617c89','#b57a4a']:district==='Stacktown'?['#a75492','#7366a6','#61526d']:district==='Meridian East'?['#9dbaae','#719daf','#748752']:['#5d728c','#826977','#7a8376'];
    p.pieces=pedestrianTemplate(pick(coatPalette),i%3===0);people.push(p);
  }
  const pedestrianCount=people.reduce((n,p)=>n+p.pieces.length,0);
  const pedestrian=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({roughness:.74,metalness:.2}),pedestrianCount);
  pedestrian.name='Animated citizens / segmented voxel coats and umbrellas';pedestrian.instanceMatrix.setUsage(THREE.DynamicDrawUsage);pedestrian.frustumCulled=false;root.add(pedestrian);
  const civilians=createCivilianSystem({people,mesh:pedestrian,colliders,groundHeightAt,bounds});
  const traffic=[];
  for(let i=0;i<16;i++)traffic.push({x:(rand()-.5)*(i<9?145:600),y:36+rand()*35,z:i<9?-55-rand()*190:130-rand()*670,speed:(i%2?1:-1)*(2.8+rand()*3.5),range:i<9?105:330});
  const trafficParts=[
    [0,0,0,3.1,.45,1.7,'#2f4257'],[-.3,.36,0,1.7,.5,1.3,'#16364c'],[.3,-.3,0,2.2,.3,1.1,'#102133'],
    [-1.18,-.09,-.91,.65,.4,.53,'#33485b'],[1.18,-.09,-.91,.65,.4,.53,'#33485b'],[-1.18,-.09,.91,.65,.4,.53,'#33485b'],[1.18,-.09,.91,.65,.4,.53,'#33485b'],
    [-1.65,.14,-.61,.6,.17,.18,'#4b5d70'],[-1.65,.14,.61,.6,.17,.18,'#4b5d70'],[1.4,.22,0,.4,.16,1.3,'#405367'],[0,.68,0,.4,.12,.4,'#537083']
  ];
  const craft=new THREE.InstancedMesh(cube,materials.metal,traffic.length*trafficParts.length);craft.frustumCulled=false;root.add(craft);
  const craftGlow=new THREE.InstancedMesh(cube,materials.glow,traffic.length*4);craftGlow.frustumCulled=false;root.add(craftGlow);
  function set(mesh,i,x,y,z,sx,sy,sz,c,rx=0,ry=0) {
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(c)mesh.setColorAt(i,color.set(c));
  }
  let first=true,lodTime=-1;
  function update(dt,time,playerPosition) {
    if(first||time-lodTime>.35) {
      const px=playerPosition?.x??0,pz=playerPosition?.z??29;
      for(const chunk of chunkGroups.values()) {
        const distance=Math.hypot(chunk.x-px,chunk.z-pz);
        chunk.near.visible=distance<250+chunk.radius*.35;
        chunk.far.visible=!chunk.near.visible&&distance<750;
      }
      selectStorefrontLights(px,pz);
      lodTime=time;
    }
    const lightBlend=1-Math.exp(-Math.max(0,dt)*7);
    for(const light of storefrontLights)light.intensity=THREE.MathUtils.lerp(light.intensity,light.userData.targetIntensity,lightBlend);
    civilians.update(dt,time,playerPosition);
    traffic.forEach((p,i)=>{
      p.x+=dt*p.speed;if(p.x>p.range)p.x=-p.range;if(p.x< -p.range)p.x=p.range;
      const yy=p.y+Math.sin(time*.6+i)*.22;
      trafficParts.forEach(([x,y,z,sx,sy,sz,c],j)=>set(craft,i*trafficParts.length+j,p.x+x,yy+y,p.z+z,sx,sy,sz,first?c:null));
      for(let k=0;k<4;k++)set(craftGlow,i*4+k,p.x+(k%2?1.18:-1.18),yy-.32,p.z+(k<2?-.91:.91),.34,.08,.28,first?(k%2?'#ff326c':'#2bd2ff'):null);
    });
    craft.instanceMatrix.needsUpdate=true;craftGlow.instanceMatrix.needsUpdate=true;
    if(first){craft.instanceColor.needsUpdate=true;craftGlow.instanceColor.needsUpdate=true;first=false;}
    for(const {material,phase,brightness} of animatedSigns)material.color.setScalar(brightness+Math.sin(time*.7+phase)*.045);
  }
  update(0,0,new THREE.Vector3(0,2.7,29));
  return {root,colliders,streetColliders,dynamicProps,groundSurfaces,getCollidersAt,bounds,update,groundHeightAt,civilians,roads,districts,patrolRoutes,citySize,
    lighting:{getState:()=>({...lightingState,emitterCount:storefrontEmitters.length,pooledLights:storefrontLights.length})},
    layoutStats:{voxels:boxes.length,signs:signs.length,pedestrians:people.length,pedestrianVoxels:pedestrianCount,blocks:chunks.length,roadLength:citySize.roadLength,streetColliders:streetColliders.length,movableBins:dynamicProps.length}};
}
