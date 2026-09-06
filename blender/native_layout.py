"""Evaluate the runtime's city, physical bins and resting service mechanisms.

Both the native builder and fresh-reopen verifier use this exact export. The
source city and its original frontage/blueprint records remain unchanged.
"""
from pathlib import Path
import json
import shutil
import subprocess


def read_native_layout(root):
    root = Path(root).resolve()
    module = lambda name: json.dumps((root/'src'/name).as_uri())
    script = 'import {createCityLayout} from '+module('city-layout.js')+';const city=createCityLayout();'
    script += 'const life=await import('+module('city-life.js')+');city.nativeLife=life.createCityLifeLayout();city.nativeTrafficRoutes=life.CITY_TRAFFIC_ROUTES;'
    script += 'const simulation=await import('+module('simulation.js')+');city.nativeSupply=simulation.createSupplySupportLayout();'
    script += 'const anchors=await import('+module('asset-placements.js')+');city.nativePlacements=anchors.SCENE_PLACEMENTS;'
    script += 'const adverts=await import('+module('advert-campaigns.js')+');city.nativeAdvertCampaigns=adverts.ADVERT_CAMPAIGNS;'
    script += 'const service=await import('+module('city-services.js')+');const fixtures=await import('+module('service-fixtures.js')+');'
    script += '''
const pavement=city.boxes.filter(b=>b.kind==='pavement'&&b.sx>=1&&b.sz>=1&&b.y+b.sy/2>=.08&&b.y+b.sy/2<=.4);
const groundHeightAt=(x,z)=>pavement.reduce((h,b)=>{
 const c=Math.cos(b.ry||0),s=Math.sin(b.ry||0),dx=x-b.x,dz=z-b.z;
 return Math.abs(dx*c-dz*s)<=b.sx/2&&Math.abs(dx*s+dz*c)<=b.sz/2?Math.max(h,b.y+b.sy/2):h;
},.057);
const sites=service.createCityServices({layout:city,groundHeightAt}).list();
const assembly=fixtures.createServiceFixtures({source:city,sites});
const removed=new Set(assembly.removedBoxIds);
if(sites.length!==15||removed.size!==15||city.boxes.filter(b=>removed.has(b.id)).length!==15)
 throw new Error('Native service export requires exactly fifteen existing sites and shutter replacements');
const recipes=assembly.recipes.map(recipe=>{
 const site=sites.find(s=>s.id===recipe.id);
 const vehicle=recipe.parking?{...recipe.parking,y:groundHeightAt(recipe.parking.x,recipe.parking.z)+.008}:null;
 return {...recipe,idlePose:fixtures.evaluateServiceFixture(recipe,{phase:'idle',elapsed:0,position:site.approach,vehicle})};
});
const fs=await import('node:fs/promises'),crypto=await import('node:crypto');
'''
    script += 'const sourceHash=crypto.createHash("sha256").update(await fs.readFile(new URL('+module('service-fixtures.js')+'))).digest("hex");'
    script += 'city.nativeServiceFixtures={version:assembly.version,sites,sourceHash,removedBoxIds:assembly.removedBoxIds,recipes};'
    script += 'const streets=await import('+module('street-collisions.js')+');const physicalStreet=streets.createStreetCollisionLayout(city);'
    script += '''
city.nativeSourceBoxCount=city.boxes.length;
city.boxes=city.boxes.filter(b=>!physicalStreet.removedBoxes.has(b)&&!removed.has(b.id))
 .concat(physicalStreet.dynamicProps.flatMap(prop=>prop.parts))
 .concat(recipes.flatMap(recipe=>recipe.idlePose.boxes.map(part=>({...part,c:part.color,
  kind:part.emissive?'window':'metal',detail:'service-mechanism',serviceId:recipe.id}))));
city.nativeDynamicProps=physicalStreet.dynamicProps;
process.stdout.write(JSON.stringify(city));
'''
    node = shutil.which('node') or r'C:\Program Files\nodejs\node.exe'
    return json.loads(subprocess.run([node,'--input-type=module','-e',script],capture_output=True,text=True,encoding='utf-8',check=True).stdout)
