import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGroundHeightSampler} from '../src/ground-height.js';
import {createCityLayout} from '../src/city-layout.js';

// Preserve the previous full scan as an independent equivalence oracle.
function previous(surfaces,x,z,base=.057){let height=base;for(const v of surfaces){const c=Math.cos(v.ry||0),s=Math.sin(v.ry||0),dx=x-v.x,dz=z-v.z;if(Math.abs(dx*c-dz*s)<=v.sx/2&&Math.abs(dx*s+dz*c)<=v.sz/2)height=Math.max(height,v.y+v.sy/2);}return height;}
const results=[];
function test(name,run){try{const evidence=run();results.push({name,passed:true,...evidence});console.log('PASS '+name,JSON.stringify(evidence));}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name,error);}}
function edges(surfaces,sample){let checks=0;for(const v of surfaces){const c=Math.cos(v.ry||0),s=Math.sin(v.ry||0);for(const dx of[-v.sx/2,0,v.sx/2])for(const dz of[-v.sz/2,0,v.sz/2])for(const epsilon of[-1e-9,0,1e-9]){const x=v.x+dx*c+dz*s+epsilon,z=v.z-dx*s+dz*c-epsilon;assert.equal(sample(x,z),previous(surfaces,x,z));checks++;}}return checks;}

test('Rotated, overlapping and cell-boundary footprints preserve exact edge heights',()=>{
 const surfaces=[{x:-16,y:.1,z:16,sx:8,sy:.2,sz:5,ry:.71},{x:0,y:.08,z:0,sx:32,sy:.05,sz:32},{x:-15.4,y:.21,z:15.6,sx:1.6,sy:.08,sz:2,ry:-.4},{x:32,y:.04,z:-32,sx:3.2,sy:.02,sz:3.1,ry:Math.PI/2}];
 const sample=createGroundHeightSampler(surfaces);let checks=edges(surfaces,sample);
 for(let x=-36;x<=36;x+=.29)for(let z=-36;z<=36;z+=.31){assert.equal(sample(x,z),previous(surfaces,x,z));checks++;}
 return{checks};
});
test('Every authored pavement agrees with the previous scan throughout the full city',()=>{
 const {boxes,bounds}=createCityLayout(),surfaces=boxes.filter(v=>v.kind==='pavement'&&v.sx>=1&&v.sz>=1&&v.y+v.sy/2>=.08&&v.y+v.sy/2<=.4),sample=createGroundHeightSampler(surfaces);let checks=edges(surfaces,sample);
 for(let x=bounds.minX-2;x<=bounds.maxX+2;x+=2.5)for(let z=bounds.minZ-2;z<=bounds.maxZ+2;z+=2.5){assert.equal(sample(x,z),previous(surfaces,x,z));checks++;}
 let seed=29715;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 for(let i=0;i<4000;i++){const x=bounds.minX+rand()*(bounds.maxX-bounds.minX),z=bounds.minZ+rand()*(bounds.maxZ-bounds.minZ),angle=rand()*Math.PI*2;
  for(const dx of[-.1,.1])for(const dz of[-.135,.195]){const px=x+dx*Math.cos(angle)+dz*Math.sin(angle),pz=z-dx*Math.sin(angle)+dz*Math.cos(angle);assert.equal(sample(px,pz),previous(surfaces,px,pz));checks++;}}
 return{surfaces:surfaces.length,checks,exact:true};
});
test('Very large footprints use bounded storage and keep negative/outside queries correct',()=>{
 const surfaces=[{x:0,y:.1,z:0,sx:1e7,sy:.2,sz:1e7},{x:-64,y:.25,z:-64,sx:1,sy:.1,sz:1,ry:.2}],sample=createGroundHeightSampler(surfaces);let checks=edges(surfaces,sample);
 for(const [x,z]of[[-64,-64],[0,0],[5000000,5000000],[5000000.001,5000000],[-1e8,0],[NaN,0],[Infinity,0]]){assert.equal(sample(x,z),previous(surfaces,x,z));checks++;}
 return{checks};
});
const report={passed:results.every(r=>r.passed),checkedAtUTC:new Date().toISOString(),results};
if(process.env.GROUND_HEIGHT_REPORT)fs.writeFileSync(process.env.GROUND_HEIGHT_REPORT,JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
