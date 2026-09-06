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
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width+margin*2}" height="${depth+margin*2+60}" viewBox="0 0 ${width+margin*2} ${depth+margin*2+60}"><rect width="100%" height="100%" fill="#071b2b"/><style>text{font-family:monospace;fill:#a6cbd9}</style><text x="${margin}" y="34" font-size="19">VESPER CITY / STRUCTURAL BLUEPRINT</text><text x="${margin}" y="52" font-size="9">ACTUAL SHARED PLACEMENTS / METRES / NORTH -Z / REVISION 04</text>`;
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
for(const d of blueprint.districts||[])svg+=`<text x="${x(d.x)}" y="${z(d.z)}" text-anchor="middle" font-size="10" style="paint-order:stroke;stroke:#071b2b;stroke-width:4;fill:${esc(d.themeColor||d.color)}">${esc(d.name.toUpperCase())}</text>`;
svg+=`<rect x="${margin}" y="${margin}" width="${width}" height="${depth}" fill="none" stroke="#7199aa" stroke-width="1"/><path d="M${margin} ${depth+margin+27}h100m-100-4v8m100-8v8" stroke="#adc9d6"/><text x="${margin}" y="${depth+margin+44}" font-size="8">100 M</text><text x="${margin+150}" y="${depth+margin+28}" font-size="8">CYAN: BUILDINGS / GREEN: PARCELS / AMBER: SIGN MOUNTS / ROSE: SUPPORTS</text><text x="${margin+150}" y="${depth+margin+44}" font-size="8">${blueprint.buildings.length} ENVELOPES / ${blueprint.signs.length} MOUNTED SIGNS / ${(blueprint.supports||[]).length} SUPPORTS</text><rect x="${margin+150}" y="${depth+margin+55}" width="11" height="5" fill="#b0e67588" stroke="#c5f68d"/><text x="${margin+170}" y="${depth+margin+61}" font-size="8">LIME: ${frontages.length} WALL-SUPPORTED FRONTS / ${frontages.filter(a=>a.courtyard).length} FACING SERVICE COURTS</text></svg>`;
await writeFile(new URL('city-blueprint.svg',root),svg);
console.log(`Blueprint exported: ${blueprint.buildings.length} envelopes, ${blueprint.signs.length} sign mounts, ${frontages.length} street fronts to ${fileURLToPath(root)}`);
