import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCityLayout } from '../src/city-layout.js';
import { createCityBlueprint } from '../src/city-blueprint.js';

const layout=createCityLayout(),blueprint=layout.blueprint||createCityBlueprint(layout);
if(!blueprint.bounds||!blueprint.buildings?.length||!blueprint.signs?.length)throw new Error('Incomplete structural blueprint');
const root=new URL('../public/blueprint/',import.meta.url);await mkdir(root,{recursive:true});
await writeFile(new URL('blueprint.json',root),JSON.stringify(blueprint,null,2));
const b=blueprint.bounds,width=b.maxX-b.minX,depth=b.maxZ-b.minZ,margin=80;
const x=v=>v-b.minX+margin,z=v=>v-b.minZ+margin;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const rect=(o,fill,stroke,dash='')=>`<rect x="${x(o.x-o.sx/2)}" y="${z(o.z-o.sz/2)}" width="${o.sx}" height="${o.sz}" fill="${fill}" stroke="${stroke}" stroke-width=".7" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width+margin*2}" height="${depth+margin*2+90}" viewBox="0 0 ${width+margin*2} ${depth+margin*2+90}"><rect width="100%" height="100%" fill="#071b2b"/><style>text{font-family:monospace;fill:#a6cbd9}</style><text x="${margin}" y="34" font-size="19">VESPER CITY / STRUCTURAL BLUEPRINT</text><text x="${margin}" y="52" font-size="9">ACTUAL SHARED PLACEMENTS / METRES / NORTH -Z / REVISION 05</text>`;
for(let xx=b.minX;xx<=b.maxX;xx+=50)svg+=`<path d="M${x(xx)} ${z(b.minZ)}V${z(b.maxZ)}" stroke="#1a3a50" stroke-width=".5"/><text x="${x(xx)}" y="${margin-10}" font-size="7" text-anchor="middle">${xx}</text>`;
for(let zz=b.minZ;zz<=b.maxZ;zz+=50)svg+=`<path d="M${x(b.minX)} ${z(zz)}H${x(b.maxX)}" stroke="#1a3a50" stroke-width=".5"/><text x="${margin-9}" y="${z(zz)}" font-size="7" text-anchor="end">${zz}</text>`;
for(const r of blueprint.roads)svg+=rect(r,'#17364c','#31576d');
for(const p of blueprint.parcels||[])svg+=rect(p,'none','#487f75','3 3');
for(const p of blueprint.buildings)svg+=rect(p,'#1a4158','#68aac2');
for(const s of blueprint.supports||[])svg+=`<circle cx="${x(s.x)}" cy="${z(s.z)}" r="1.5" fill="#da8ba3"/>`;
for(const p of blueprint.props||[])if(p.sx&&p.sz)svg+=rect(p,'#73c5b955','#a9e2c4');
for(const s of blueprint.signs)svg+=`<circle cx="${x(s.x)}" cy="${z(s.z)}" r=".9" fill="#efc073"/>`;
const frontages=blueprint.streetDetails?.assemblies||[];
svg+='<g id="street-frontages" aria-label="Wall-supported storefront and service-front footprints">';
for(const a of frontages){
  const q=a.bounds,shape={x:(q.minX+q.maxX)/2,z:(q.minZ+q.maxZ)/2,sx:q.maxX-q.minX,sz:q.maxZ-q.minZ};
  svg+=`<g id="${esc(a.id)}"><title>${esc(a.id+' / '+a.district+' / '+a.label+' / attached to '+a.hostBuilding+(a.courtyard?' / courtyard':' / street'))}</title>${rect(shape,'#b0e67588','#c5f68d')}<path d="M${x(a.anchor.x)} ${z(a.anchor.z)}L${x(shape.x)} ${z(shape.z)}" stroke="#c5f68d" stroke-width=".6"/></g>`;
}
svg+='</g>';
const assemblies=blueprint.blockCompositions?.assemblies||[],routes=blueprint.blockCompositions?.paths||[],entrances=blueprint.blockCompositions?.entrances||[];
svg+='<g id="authored-block-assemblies" aria-label="Full extents of authored architectural assemblies">';
for(const a of assemblies){
  const q=a.bounds;if(!q)continue;
  const shape={x:(q.minX+q.maxX)/2,z:(q.minZ+q.maxZ)/2,sx:q.maxX-q.minX,sz:q.maxZ-q.minZ};
  const host=a.hostBuilding||(a.hostBuildings||[]).join(', ')||'ground';
  svg+=`<g id="${esc(a.id)}" data-type="authored-assembly" data-host="${esc(host)}"><title>${esc(a.id+' / '+a.label+' / host '+host+' / '+a.boxIds.length+' modules / Y '+q.minY.toFixed(3)+'–'+q.maxY.toFixed(3)+' m / full group extent')}</title>${rect(shape,'#9274b130','#c09cd7')}</g>`;
}
svg+='</g><g id="authored-walking-routes" aria-label="Authored walking paths with their declared widths and floor levels">';
for(const route of routes){
  const points=route.points||[];if(points.length<2)continue;
  const d=points.map((p,i)=>(i?'L':'M')+x(p.x)+' '+z(p.z)).join(' '),levels=points.map(p=>p.y||0),length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.z-points[i].z,(p.y||0)-(points[i].y||0)),0);
  svg+=`<g id="${esc(route.id)}" data-type="walking-route" data-access="${esc(route.routeType||'walking')}" data-width="${route.width}" data-floor-min="${Math.min(...levels)}" data-floor-max="${Math.max(...levels)}"><title>${esc(route.id+' / '+(route.label||'Walking route')+' / width '+route.width+' m / length '+length.toFixed(2)+' m / floor Y '+Math.min(...levels).toFixed(3)+'–'+Math.max(...levels).toFixed(3)+' m'+(route.vehicleRoute===false?' / pedestrian passage':''))}</title><path d="${d}" fill="none" stroke="#f0d28b22" stroke-width="${route.width}"/><path d="${d}" fill="none" stroke="#f0d28b" stroke-width=".9" stroke-dasharray="2 1.4"/>`;
  for(const p of points)svg+=`<circle cx="${x(p.x)}" cy="${z(p.z)}" r=".4" fill="#f0d28b"><title>${esc('X '+p.x.toFixed(3)+' / Y '+(p.y||0).toFixed(3)+' / Z '+p.z.toFixed(3))}</title></circle>`;
  svg+='</g>';
}
svg+='</g><g id="authored-entrance-approaches" aria-label="Ground and upper-level exterior entrance approaches">';
for(const entrance of entrances){
  const p=entrance.approach;if(!p)continue;const floor=p.y??entrance.levelY??0;
  svg+=`<g id="${esc(entrance.id)}" data-type="entrance-approach" data-floor-y="${floor}"><title>${esc(entrance.id+' / host '+entrance.hostBuilding+' / floor Y '+floor.toFixed(3)+' m / '+(entrance.closed?'closed exterior entrance':'entrance approach'))}</title>${rect(p,'#b3f1d42b','#b3f1d4')}<path d="M${x(p.x)} ${z(p.z)-1.2}l1.2 1.2-1.2 1.2-1.2-1.2Z" fill="#b3f1d4"/>`;
  if(entrance.target)svg+=`<path d="M${x(p.x)} ${z(p.z)}L${x(entrance.target.x)} ${z(entrance.target.z)}" stroke="#b3f1d4" stroke-width=".6"/>`;
  svg+='</g>';
}
svg+='</g>';
for(const d of blueprint.districts||[])svg+=`<text x="${x(d.x)}" y="${z(d.z)}" text-anchor="middle" font-size="10" style="paint-order:stroke;stroke:#071b2b;stroke-width:4;fill:${esc(d.themeColor||d.color)}">${esc(d.name.toUpperCase())}</text>`;
svg+=`<rect x="${margin}" y="${margin}" width="${width}" height="${depth}" fill="none" stroke="#7199aa" stroke-width="1"/><path d="M${margin} ${depth+margin+27}h100m-100-4v8m100-8v8" stroke="#adc9d6"/><text x="${margin}" y="${depth+margin+44}" font-size="8">100 M</text><text x="${margin+150}" y="${depth+margin+28}" font-size="8">CYAN: BUILDINGS / GREEN: PARCELS / AMBER: SIGN MOUNTS / ROSE: SUPPORTS</text><text x="${margin+150}" y="${depth+margin+44}" font-size="8">${blueprint.buildings.length} ENVELOPES / ${blueprint.signs.length} MOUNTED SIGNS / ${(blueprint.supports||[]).length} SUPPORTS</text><rect x="${margin+150}" y="${depth+margin+55}" width="11" height="5" fill="#b0e67588" stroke="#c5f68d"/><text x="${margin+170}" y="${depth+margin+61}" font-size="8">LIME: ${frontages.length} WALL-SUPPORTED FRONTS / ${frontages.filter(a=>a.courtyard).length} FACING SERVICE COURTS</text><rect x="${margin+150}" y="${depth+margin+72}" width="11" height="5" fill="#9274b130" stroke="#c09cd7"/><text x="${margin+170}" y="${depth+margin+78}" font-size="8">VIOLET: ${assemblies.length} AUTHORED GROUP EXTENTS / GOLD: ${routes.length} WALKING ROUTES</text><path d="M${margin+150} ${depth+margin+92}h11" stroke="#b3f1d4" stroke-width="2"/><text x="${margin+170}" y="${depth+margin+96}" font-size="8">MINT: ${entrances.length} ENTRANCE APPROACHES / FLOOR HEIGHTS IN PLACEMENT TITLES</text></svg>`;
await writeFile(new URL('city-blueprint.svg',root),svg);
console.log(`Blueprint exported: ${blueprint.buildings.length} envelopes, ${blueprint.signs.length} sign mounts, ${frontages.length} street fronts, ${assemblies.length} authored assemblies, ${routes.length} walking routes and ${entrances.length} entrances to ${fileURLToPath(root)}`);
