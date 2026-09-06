import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPlayerMovement} from '../src/player-movement.js';
import {createCityLayout} from '../src/city-layout.js';
import {createStreetCollisionLayout} from '../src/street-collisions.js';
const results=[];
function setup({x=0,z=0,ground=()=>0,boxes=[],bounds}={}){
 const position=new THREE.Vector3(x,1.75,z);let queries=0;
 const movement=createPlayerMovement({position,groundHeightAt:ground,getColliders:()=>{queries++;return boxes;},bounds});
 return{position,movement,boxes,get queries(){return queries;}};
}
function run(f,seconds,input={},observe=()=>{},dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++){const state=f.movement.update(dt,input);observe(state,i);}return f.movement.getState();}
function test(name,fn){const details=fn();results.push({test:name,pass:true,...details});console.log('PASS '+name);}
test('Eye height follows real raised pavement and remains grounded while idle',()=>{
 const f=setup({ground:()=>.165});run(f,2);assert(Math.abs(f.position.y-1.915)<1e-9);assert(f.movement.getState().grounded);return{eyeY:f.position.y};
});
test('Acceleration, sprint, diagonal normalization, braking, and frame-rate consistency',()=>{
 const a=setup(),b=setup(),c=setup();run(a,1,{forward:1});run(b,1,{forward:1,strafe:1});run(c,1,{forward:1},()=>{},1/30);
 assert(Math.abs(Math.hypot(b.position.x,b.position.z)-Math.abs(a.position.z))<.02);assert(Math.abs(a.position.z-c.position.z)<.01);
 const start=a.position.z;run(a,.3);assert(Math.abs(a.movement.getState().velocity.z)<1e-8);assert(start-a.position.z<.6);
 const sprint=setup();run(sprint,1,{forward:1,sprint:true});assert(Math.abs(sprint.position.z)>Math.abs(b.position.z)*1.8);return{walkDistance:Math.abs(c.position.z),sprintDistance:Math.abs(sprint.position.z),brakingDistance:start-a.position.z};
});
test('High-speed dash cannot tunnel through a25mm-thick wall',()=>{
 const f=setup({z:2,boxes:[{x:0,y:1.5,z:0,sx:20,sy:3,sz:.025}]});run(f,.5,{forward:1,dash:true},()=>{},.1);
 assert(f.position.z>=.4124&&f.position.z<.42);assert(Math.abs(f.movement.getState().velocity.z)<1e-6);return{stoppedZ:f.position.z};
});
test('Rotated OBB collision preserves tangential movement for smooth wall sliding',()=>{
 const wall={x:0,y:1.5,z:0,sx:.12,sy:3,sz:20,ry:Math.PI/4},f=setup({x:-2,z:2,boxes:[wall]});run(f,1.8,{strafe:1});
 const normal=(f.position.x-f.position.z)/Math.sqrt(2);assert(normal<=-.46+.003);assert(f.position.z>3);assert(f.position.x>1);return{position:f.position.toArray(),normalDistance:normal};
});
test('Two perpendicular walls resolve a corner without jitter or penetration',()=>{
 const f=setup({x:2,z:2,boxes:[{x:0,y:2,z:0,sx:.1,sy:4,sz:20},{x:0,y:2,z:0,sx:20,sy:4,sz:.1}]});run(f,2,{forward:1,strafe:-1});const p=f.position.clone();run(f,1,{forward:1,strafe:-1});
 assert(f.position.x>=.449&&f.position.z>=.449);assert(p.distanceTo(f.position)<.01);return{corner:f.position.toArray()};
});
test('Real curb tops raise feet and descending curbs settle without hovering',()=>{
 const slab={x:0,y:.1,z:-5,sx:8,sy:.2,sz:10},f=setup({z:1,boxes:[slab],ground:(_x,z)=>z<0?.2:0});
 run(f,.7,{forward:1});assert(Math.abs(f.position.y-1.95)<1e-8);assert(f.movement.getState().grounded);
 run(f,1,{forward:-1});assert(f.position.z>.4);assert(Math.abs(f.position.y-1.75)<1e-8);return{end:f.position.toArray()};
});
test('Sequential20cm stairs climb using real tops and stop floating when the stairs end',()=>{
 const boxes=[{x:0,y:.1,z:-.3,sx:4,sy:.2,sz:.6},{x:0,y:.2,z:-.9,sx:4,sy:.4,sz:.6},{x:0,y:.3,z:-5.6,sx:4,sy:.6,sz:8.8}];
 const f=setup({z:1,boxes});run(f,1,{forward:1});assert(Math.abs(f.position.y-2.35)<.002);assert(f.movement.getState().grounded);return{feetY:f.position.y-1.75};
});
test('A50cm ledge blocks walking but can be jumped onto and supports landing',()=>{
 const f=setup({z:2,boxes:[{x:0,y:.25,z:-1,sx:4,sy:.5,sz:4}]});run(f,.6,{forward:1});assert(f.position.z>=1.399);
 assert(f.movement.jump());run(f,.45,{forward:1});run(f,.55);assert(f.position.z<1&&f.position.z>-3);assert(Math.abs(f.position.y-2.25)<.003);assert(f.movement.getState().grounded);return{landed:f.position.toArray()};
});
test('Jump uses pavement height, cannot double jump, and lands without falling through',()=>{
 const f=setup({ground:()=>.165});assert(f.movement.jump());let peak=0;run(f,.18,{},()=>{peak=Math.max(peak,f.position.y);});assert(!f.movement.jump());
 run(f,1,{},()=>{peak=Math.max(peak,f.position.y);});assert(f.movement.getState().grounded);assert(Math.abs(f.position.y-1.915)<.001);assert(peak>2.9&&peak<3.12);return{jumpHeight:peak-1.915};
});
test('A low ceiling stops the head instead of allowing an upward clip',()=>{
 const f=setup({boxes:[{x:0,y:2.08,z:0,sx:10,sy:.2,sz:10}]});f.movement.jump();let head=0;run(f,.8,{},()=>{head=Math.max(head,f.position.y+.15);});assert(head<=1.981);assert(f.movement.getState().grounded);return{maximumHeadY:head};
});
test('Walking off a tall platform causes a real fall and gravity remains active during air dashes',()=>{
 const f=setup({z:1,ground:(_x,z)=>z>=0?1.2:0,boxes:[{x:0,y:.6,z:5,sx:10,sy:1.2,sz:10}]});let airborne=false;
 run(f,.65,{forward:1},state=>airborne||=!state.grounded);assert(airborne);run(f,.5,{dash:true});assert(f.movement.getState().grounded);assert(Math.abs(f.position.y-1.75)<.002);return{finalY:f.position.y};
});
test('Dynamic props block walking; removed support causes a fall on the next update',()=>{
 const boxes=[{id:'BIN',x:0,y:.55,z:0,sx:.75,sy:1.1,sz:.7}],f=setup({z:2,boxes});run(f,.6,{forward:1});assert(f.position.z>=.749);
 boxes.length=0;run(f,.5,{forward:1});assert(f.position.z<0);
 const platform={x:0,y:.5,z:0,sx:3,sy:1,sz:3};boxes.push(platform);f.position.set(0,2.75,0);f.movement.update(1/60,{});assert(f.movement.getState().grounded);
 boxes.length=0;run(f,.05);assert(!f.movement.getState().grounded);run(f,.6);assert(f.movement.getState().grounded);return{final:f.position.toArray()};
});
test('External teleport clears old velocity and never sweeps across the intervening world',()=>{
 const f=setup({boxes:[{x:20,y:2,z:0,sx:2,sy:4,sz:100}]});run(f,.4,{strafe:1});f.position.set(50,1.75,20);
 const state=f.movement.update(1/60,{});assert(f.position.distanceTo(new THREE.Vector3(50,1.75,20))<1e-8);assert.equal(state.distanceMoved,0);assert.equal(state.velocity.length(),0);
});
test('World bounds and large frame gaps stay bounded; collider queries are shared by substeps',()=>{
 const f=setup({bounds:{minX:-2,maxX:2,minZ:-2,maxZ:2}}),before=f.queries;f.movement.update(5,{forward:1,dash:true});
 assert(f.position.z>=-1.6);assert(f.queries-before<=2);assert(Number.isFinite(f.position.y));return{queries:f.queries-before,z:f.position.z};
});
test('The current authored city sidewalk and actual extracted bin stop the player at the visible footprint',()=>{
 const city=createCityLayout(),street=createStreetCollisionLayout(city),bin=street.dynamicProps[0],shapes=[...city.colliders,...street.staticColliders,...street.groundSurfaces,...street.dynamicProps];
 const grid=new Map(),cell=12;
 for(const b of shapes){const c=Math.abs(Math.cos(b.ry||0)),s=Math.abs(Math.sin(b.ry||0)),hx=(c*b.sx+s*b.sz)/2,hz=(s*b.sx+c*b.sz)/2;for(let x=Math.floor((b.x-hx)/cell);x<=Math.floor((b.x+hx)/cell);x++)for(let z=Math.floor((b.z-hz)/cell);z<=Math.floor((b.z+hz)/cell);z++){const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);}}
 const ground=(x,z)=>street.groundSurfaces.reduce((h,b)=>Math.abs(x-b.x)<=b.sx/2&&Math.abs(z-b.z)<=b.sz/2?Math.max(h,b.y+b.sy/2):h,.057);
 const position=new THREE.Vector3(bin.x,1.75,bin.z+2),movement=createPlayerMovement({position,groundHeightAt:ground,bounds:city.bounds,getColliders:(x,z,r)=>{const selected=new Set();for(let ix=Math.floor((x-r)/cell);ix<=Math.floor((x+r)/cell);ix++)for(let iz=Math.floor((z-r)/cell);iz<=Math.floor((z+r)/cell);iz++)for(const c of grid.get(ix+','+iz)||[])selected.add(c);return [...selected];}});
 run({position,movement},.6,{forward:1});assert(position.z-bin.z>=bin.sz/2+.399);assert(Math.abs(position.y-1.915)<.003);return{bin:bin.id,player:position.toArray(),visibleBinFront:bin.z+bin.sz/2};
});
const report={status:'passed',checkedAtUTC:new Date().toISOString(),method:'Production player movement with actual OBB contacts and geometry fixtures for thin walls, corners, curbs, stairs, ledges, jump/ceiling, dynamic supports, teleports, timing, and current authored city bins.',results};

console.log(`Completed player-movement.test.mjs: ${results.length} checks.`);
