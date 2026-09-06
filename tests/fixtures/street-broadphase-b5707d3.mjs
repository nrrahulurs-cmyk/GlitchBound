// Frozen collision-pair oracle from checkpoint b5707d3; do not optimize this fixture.
import * as CANNON from 'cannon-es';
export class LegacyStreetBroadphase extends CANNON.Broadphase {
  constructor(){super();this.useBoundingBoxes=true;this.cell=16;this.staticGrid=new Map();this.staticRecords=new Map();this.globalStatic=new Set();}
  cells(body){
    if(body.aabbNeedsUpdate)body.updateAABB();
    const a=body.aabb,c=this.cell,x0=Math.floor(a.lowerBound.x/c),x1=Math.floor(a.upperBound.x/c),z0=Math.floor(a.lowerBound.z/c),z1=Math.floor(a.upperBound.z/c);
    if(!Number.isFinite(x0+x1+z0+z1)||(x1-x0+1)*(z1-z0+1)>4096)return null;
    const keys=[];for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++)keys.push(x+','+z);return keys;
  }
  removeStatic(body,keys){if(keys)for(const key of keys){const values=this.staticGrid.get(key);values?.delete(body);if(!values?.size)this.staticGrid.delete(key);}else this.globalStatic.delete(body);this.staticRecords.delete(body);}
  collisionPairs(world,p1,p2){
    const present=new Set(world.bodies),moving=[],dynamicGrid=new Map(),globalDynamic=[];
    for(const [body,keys]of this.staticRecords)if(!present.has(body)||body.type!==CANNON.Body.STATIC||body.aabbNeedsUpdate)this.removeStatic(body,keys);
    for(const body of world.bodies){
      if(body.type===CANNON.Body.STATIC){
        if(this.staticRecords.has(body))continue;
        const keys=this.cells(body);this.staticRecords.set(body,keys);
        if(keys)for(const key of keys){if(!this.staticGrid.has(key))this.staticGrid.set(key,new Set());this.staticGrid.get(key).add(body);}else this.globalStatic.add(body);
      }else{
        const keys=this.cells(body);moving.push({body,keys});
        if(keys)for(const key of keys){if(!dynamicGrid.has(key))dynamicGrid.set(key,[]);dynamicGrid.get(key).push(body);}else globalDynamic.push(body);
      }
    }
    const tested=new Set();
    const pair=(a,b)=>{
      if(a===b||(a.type!==CANNON.Body.DYNAMIC&&b.type!==CANNON.Body.DYNAMIC)||!this.needBroadphaseCollision(a,b))return;
      // Simplified corpses release their articulation collision bit. Preserve
      // the same person's umbrella exclusion while other corpses stay solid.
      if(a.userData?.type==='civilian-ragdoll'&&b.userData?.type==='civilian-ragdoll'&&a.userData.civilianId!=null&&a.userData.civilianId===b.userData.civilianId)return;
      const key=a.id<b.id?a.id+','+b.id:b.id+','+a.id;if(tested.has(key))return;tested.add(key);
      this.intersectionTest(a,b,p1,p2);
    };
    for(const{body,keys}of moving){
      if(body.type===CANNON.Body.DYNAMIC&&body.sleepState===CANNON.Body.SLEEPING)continue;
      for(const other of this.globalStatic)pair(body,other);
      for(const other of globalDynamic)pair(body,other);
      if(keys)for(const key of keys){for(const other of this.staticGrid.get(key)||[])pair(body,other);for(const other of dynamicGrid.get(key)||[])pair(body,other);}
      else for(const other of world.bodies)pair(body,other);
    }
  }
  aabbQuery(world,aabb,result=[]){for(const body of world.bodies){if(body.aabbNeedsUpdate)body.updateAABB();if(body.aabb.overlaps(aabb))result.push(body);}return result;}
}
