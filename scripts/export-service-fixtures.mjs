import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCityLayout} from '../src/city-layout.js';
import {createCityServices} from '../src/city-services.js';
import {createServiceFixtures,evaluateServiceFixture} from '../src/service-fixtures.js';

const layout=createCityLayout();
const pavement=layout.boxes.filter(b=>b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>=.08&&b.y+b.sy/2<=.4);
const groundHeightAt=(x,z)=>pavement.reduce((h,b)=>{
 const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z;
 return Math.abs(dx*c-dz*s)<=b.sx/2&&Math.abs(dx*s+dz*c)<=b.sz/2?Math.max(h,b.y+b.sy/2):h;
},.057);
const sites=createCityServices({layout,groundHeightAt}).list();
const fixtures=createServiceFixtures({source:layout,sites});
const boxesById=new Map(layout.boxes.filter(b=>b.id).map(b=>[b.id,b]));
const fps=20;
const result={version:1,coordinates:'Three.js metres, X right / Y up; Blender (x,-z,y)',fps,
 sourceHash:createHash('sha256').update(await fs.readFile(new URL('../src/service-fixtures.js',import.meta.url))).digest('hex'),
 removedBoxIds:fixtures.removedBoxIds,recipes:[]};
for(const recipe of fixtures.recipes){
 const site=sites.find(s=>s.id===recipe.id),assembly=layout.streetDetails.assemblies.find(a=>a.id===recipe.assemblyId);
 const vehicle=recipe.parking?{...recipe.parking,y:groundHeightAt(recipe.parking.x,recipe.parking.z)+.008}:null;
 const sample=(frame,state)=>{
  const pose=evaluateServiceFixture(recipe,{...state,elapsed:frame/fps,position:site.approach,vehicle});
  for(const p of pose.boxes)if(!['x','y','z','sx','sy','sz','ry'].every(k=>Number.isFinite(p[k])))throw new Error('Nonfinite native pose '+p.id);
  return{frame,phase:state.phase,progress:state.progress||0,closure:state.closure||0,
   parts:pose.boxes.filter(p=>p.partGroup!=='fixed'||p.emissive).map(p=>[p.id,p.x,p.y,p.z,p.ry,p.intensity||0]),effects:pose.effects};
 };
 const frames=[sample(1,{phase:'idle'})];
 const durationFrames=Math.round(recipe.duration*fps);
 for(let i=0;i<=durationFrames;i++)frames.push(sample(21+i,{phase:'active',progress:i/durationFrames}));
 const success=21+durationFrames;
 for(let i=1;i<=30;i++)frames.push(sample(success+i,{phase:'success',progress:1,closure:Math.max(0,(i-15)/15)}));
 frames.push(sample(success+31,{phase:'cooldown'}));
 const cancelled=success+60;
 for(let i=0;i<=Math.ceil(durationFrames*.55);i++)frames.push(sample(cancelled+i,{phase:'active',progress:i/durationFrames}));
 const retract=cancelled+Math.ceil(durationFrames*.55);
 for(let i=1;i<=12;i++)frames.push(sample(retract+i,{phase:'cancelled',progress:.55,closure:i/12}));
 frames.push(sample(retract+13,{phase:'idle'}));
 result.recipes.push({...recipe,context:assembly.boxIds.filter(id=>!fixtures.removedBoxIds.includes(id)).map(id=>boxesById.get(id)).filter(Boolean),frames});
}
const target=new URL('../blender/service-fixtures.json',import.meta.url);
await fs.writeFile(target,JSON.stringify(result));
console.log(`Exported ${result.recipes.length} service mechanisms, ${result.recipes.reduce((n,r)=>n+r.parts.length,0)} parts and ${result.recipes.reduce((n,r)=>n+r.frames.length,0)} native pose samples.`);
