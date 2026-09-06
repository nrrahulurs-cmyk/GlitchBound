const canvas=document.getElementById('drawing'),ctx=canvas.getContext('2d');
const layers={roads:true,parcels:true,buildings:true,frontages:true,assemblies:true,routes:true,entrances:true,signs:true,supports:true,connections:true,props:true};
const data=await fetch('blueprint.json').then(r=>{if(!r.ok)throw new Error('Blueprint data unavailable');return r.json()});
const b=data.bounds,center={x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2};
let scale=1,w=0,h=0,selected=null,drag=null,moved=false;
const color={roads:'#31536c',parcels:'#427c79',buildings:'#70b4d0',frontages:'#c5f68d',assemblies:'#c09cd7',routes:'#f0d28b',entrances:'#b3f1d4',signs:'#e5b765',supports:'#da8ba3',connections:'#b591d1'};
const sx=x=>w/2+(x-center.x)*scale,sz=z=>h/2+(z-center.z)*scale;
const world=(x,y)=>({x:center.x+(x-w/2)/scale,z:center.z+(y-h/2)/scale});
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
const groupShape=(record,category)=>{
  const q=record.bounds;if(!q||!['minX','maxX','minY','maxY','minZ','maxZ'].every(k=>Number.isFinite(q[k])))return null;
  return {...record,category,x:(q.minX+q.maxX)/2,y:(q.minY+q.maxY)/2,z:(q.minZ+q.maxZ)/2,sx:q.maxX-q.minX,sy:q.maxY-q.minY,sz:q.maxZ-q.minZ,record};
};
const frontages=(data.streetDetails?.assemblies||[]).map(o=>groupShape(o,'frontages')).filter(Boolean);
const assemblies=(data.blockCompositions?.assemblies||[]).map(o=>groupShape(o,'assemblies')).filter(Boolean);
const routes=(data.blockCompositions?.paths||[]).map(record=>{
  const points=(record.points||[]).filter(finitePoint);if(points.length<2)return null;
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),ys=points.map(p=>Number.isFinite(p.y)?p.y:0),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.z-points[i].z,(p.y||0)-(points[i].y||0)),0);
  return{...record,points,category:'routes',x:(minX+maxX)/2,z:(minZ+maxZ)/2,y:Math.min(...ys),sx:maxX-minX,sz:maxZ-minZ,minY:Math.min(...ys),maxY:Math.max(...ys),length,record};
}).filter(Boolean);
const entrances=(data.blockCompositions?.entrances||[]).map(record=>{
  const approach=record.approach;if(!finitePoint(approach))return null;
  return{...record,...approach,category:'entrances',y:approach.y??record.levelY??0,record};
}).filter(Boolean);
const objects=[...(data.buildings||[]).map(o=>({...o,category:'buildings'})),...frontages,...assemblies,...routes,...entrances,...(data.signs||[]).map(o=>({...o,category:'signs'})),...(data.supports||[]).map(o=>({...o,category:'supports'})),...(data.props||[]).map(o=>({...o,category:'props'}))];
const counts={frontages:frontages.length,assemblies:assemblies.length,routes:routes.length,entrances:entrances.length};
function resize(){const r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,2);w=r.width;h=r.height;canvas.width=w*ratio;canvas.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);draw()}
function fit(){center.x=(b.minX+b.maxX)/2;center.z=(b.minZ+b.maxZ)/2;scale=Math.min((w-110)/(b.maxX-b.minX),(h-100)/(b.maxZ-b.minZ));draw()}
function box(o,fill,stroke){ctx.fillStyle=fill;ctx.strokeStyle=stroke;const x=sx(o.x-o.sx/2),y=sz(o.z-o.sz/2),ww=o.sx*scale,hh=o.sz*scale;if(fill)ctx.fillRect(x,y,ww,hh);if(stroke)ctx.strokeRect(x,y,ww,hh)}
function routeLine(o,stroke,width){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();o.points.forEach((p,i)=>i?ctx.lineTo(sx(p.x),sz(p.z)):ctx.moveTo(sx(p.x),sz(p.z)));ctx.stroke()}
function draw(){
  ctx.fillStyle='#071b2b';ctx.fillRect(0,0,w,h);
  const grid=scale>2?10:50,lo=world(0,0),hi=world(w,h);
  ctx.lineWidth=.5;ctx.strokeStyle='#183b52';
  for(let x=Math.floor(lo.x/grid)*grid;x<hi.x;x+=grid){ctx.beginPath();ctx.moveTo(sx(x),0);ctx.lineTo(sx(x),h);ctx.stroke()}
  for(let z=Math.floor(lo.z/grid)*grid;z<hi.z;z+=grid){ctx.beginPath();ctx.moveTo(0,sz(z));ctx.lineTo(w,sz(z));ctx.stroke()}
  ctx.strokeStyle='#527d91';ctx.setLineDash([5,5]);ctx.strokeRect(sx(b.minX),sz(b.minZ),(b.maxX-b.minX)*scale,(b.maxZ-b.minZ)*scale);ctx.setLineDash([]);
  if(layers.roads)for(const r of data.roads||[]){box(r,'#153349','#2a5269');ctx.strokeStyle='#43647a';ctx.setLineDash([3,6]);ctx.beginPath();if(r.sz>r.sx){ctx.moveTo(sx(r.x),sz(r.z-r.sz/2));ctx.lineTo(sx(r.x),sz(r.z+r.sz/2))}else{ctx.moveTo(sx(r.x-r.sx/2),sz(r.z));ctx.lineTo(sx(r.x+r.sx/2),sz(r.z))}ctx.stroke();ctx.setLineDash([])}
  if(layers.parcels){ctx.setLineDash([4,3]);for(const p of data.parcels||[])box(p,null,'#437871');ctx.setLineDash([])}
  if(layers.buildings)for(const o of data.buildings||[]){ctx.lineWidth=.75;box(o,'#17415b','#6aa6bc');if(scale>1.5){ctx.fillStyle='#8fc0d0';ctx.font='8px Consolas,monospace';ctx.textAlign='center';ctx.fillText(o.id||'',sx(o.x),sz(o.z)+3)}}
  if(layers.frontages)for(const o of frontages){ctx.lineWidth=.8;box(o,'#b0e67524',color.frontages)}
  if(layers.assemblies)for(const o of assemblies){ctx.lineWidth=1;box(o,'#9274b130',color.assemblies);if(scale>5){ctx.fillStyle='#c6b3da';ctx.font='8px Consolas,monospace';ctx.textAlign='center';ctx.fillText(o.id,sx(o.x),sz(o.z)-4)}}
  if(layers.connections)for(const o of data.elevatedConnections||[]){ctx.strokeStyle=color.connections;ctx.lineWidth=1;ctx.setLineDash([3,2]);if(o.from&&o.to){ctx.beginPath();ctx.moveTo(sx(o.from.x),sz(o.from.z));ctx.lineTo(sx(o.to.x),sz(o.to.z));ctx.stroke()}else if(Number.isFinite(o.sx)&&Number.isFinite(o.sz))box(o,null,color.connections);ctx.setLineDash([])}
  if(layers.supports)for(const o of data.supports||[]){ctx.fillStyle=color.supports;ctx.fillRect(sx(o.x)-1.6,sz(o.z)-1.6,3.2,3.2)}
  if(layers.props)for(const o of data.props||[])if(o.sx&&o.sz){box(o,'#73c5b955','#a9e2c4');if(scale>2){ctx.fillStyle='#b0decf';ctx.font='8px Consolas,monospace';ctx.fillText(o.id,sx(o.x),sz(o.z)-6)}}
  if(layers.signs)for(const o of data.signs||[]){ctx.strokeStyle=color.signs;ctx.fillStyle=color.signs;const yaw=o.ry||0,dx=Math.cos(yaw)*(o.w||2)/2,dz=-Math.sin(yaw)*(o.w||2)/2;ctx.beginPath();ctx.moveTo(sx(o.x-dx),sz(o.z-dz));ctx.lineTo(sx(o.x+dx),sz(o.z+dz));ctx.stroke();if(scale>1.7){ctx.fillRect(sx(o.x)-1,sz(o.z)-1,2,2);if(o.anchor){ctx.strokeStyle='#bd995177';ctx.beginPath();ctx.moveTo(sx(o.x),sz(o.z));ctx.lineTo(sx(o.anchor.x),sz(o.anchor.z));ctx.stroke()}}}
  if(layers.routes)for(const o of routes){routeLine(o,'#f0d28b20',Math.max(1,(o.width||0)*scale));ctx.setLineDash([5,3]);routeLine(o,color.routes,1.2);ctx.setLineDash([]);if(scale>3)for(const p of o.points){ctx.fillStyle=color.routes;ctx.fillRect(sx(p.x)-1.4,sz(p.z)-1.4,2.8,2.8)}}
  if(layers.entrances)for(const o of entrances){ctx.lineWidth=1;box(o,'#b3f1d426',color.entrances);ctx.fillStyle=color.entrances;ctx.beginPath();ctx.moveTo(sx(o.x),sz(o.z)-4);ctx.lineTo(sx(o.x)+4,sz(o.z));ctx.lineTo(sx(o.x),sz(o.z)+4);ctx.lineTo(sx(o.x)-4,sz(o.z));ctx.closePath();ctx.fill();if(finitePoint(o.target)){ctx.strokeStyle=color.entrances;ctx.beginPath();ctx.moveTo(sx(o.x),sz(o.z));ctx.lineTo(sx(o.target.x),sz(o.target.z));ctx.stroke()}if(scale>4){ctx.fillStyle=color.entrances;ctx.font='9px Consolas,monospace';ctx.textAlign='left';ctx.fillText('Y '+o.y.toFixed(3),sx(o.x)+7,sz(o.z)-5)}}
  for(const d of data.districts||[]){ctx.fillStyle='#092132d9';ctx.font='bold 10px Consolas,monospace';const label=d.name.toUpperCase(),width=ctx.measureText(label).width;ctx.fillRect(sx(d.x)-width/2-7,sz(d.z)-9,width+14,19);ctx.fillStyle=d.themeColor||d.color||'#b5d7e4';ctx.textAlign='center';ctx.fillText(label,sx(d.x),sz(d.z)+4)}
  if(selected&&layers[selected.category]){ctx.strokeStyle='#ffe0a0';ctx.lineWidth=2;if(selected.category==='routes')routeLine(selected,'#ffe0a0',3);else if(['assemblies','frontages','entrances'].includes(selected.category))box(selected,null,'#ffe0a0');else{ctx.beginPath();ctx.arc(sx(selected.x),sz(selected.z),Math.max(8,(selected.sx||selected.w||6)*scale*.7),0,Math.PI*2);ctx.stroke()}}
  ctx.lineWidth=1;ctx.strokeStyle='#779cae';ctx.fillStyle='#98bdcd';ctx.font='9px Consolas,monospace';ctx.textAlign='center';ctx.beginPath();ctx.moveTo(38,61);ctx.lineTo(38,31);ctx.lineTo(34,40);ctx.moveTo(38,31);ctx.lineTo(42,40);ctx.stroke();ctx.fillText('N',38,23);
  const ruler=scale<1?100:scale<3?50:10;ctx.textAlign='left';ctx.beginPath();ctx.moveTo(30,h-51);ctx.lineTo(30+ruler*scale,h-51);ctx.moveTo(30,h-55);ctx.lineTo(30,h-47);ctx.moveTo(30+ruler*scale,h-55);ctx.lineTo(30+ruler*scale,h-47);ctx.stroke();ctx.fillText(ruler+' M',30,h-60);
  ctx.fillStyle='#698fa2';ctx.font='8px Consolas,monospace';ctx.textAlign='center';for(let x=Math.ceil(lo.x/100)*100;x<hi.x;x+=100)ctx.fillText('X '+x,sx(x),13);
}
const pointLabel=p=>`${p.x.toFixed(2)}, ${(p.y||0).toFixed(3)}, ${p.z.toFixed(2)} m`;
function focusObjects(list){if(!list.length)return;const minX=Math.min(...list.map(o=>o.x-(o.sx||o.w||2)/2)),maxX=Math.max(...list.map(o=>o.x+(o.sx||o.w||2)/2)),minZ=Math.min(...list.map(o=>o.z-(o.sz||2)/2)),maxZ=Math.max(...list.map(o=>o.z+(o.sz||2)/2));center.x=(minX+maxX)/2;center.z=(minZ+maxZ)/2;scale=Math.max(.3,Math.min(24,(w-110)/Math.max(5,maxX-minX),(h-100)/Math.max(5,maxZ-minZ)));draw()}
function inspect(o){
  selected=o||null;const panel=document.getElementById('selection');panel.replaceChildren();
  if(!o){panel.textContent='Click a footprint, route, entrance, sign or support to inspect its coordinates and attachment.';draw();return null;}
  const title=document.createElement('h2');title.textContent=(o.id||o.category)+' / '+(o.text||o.name||o.label||o.category);panel.append(title);
  const dl=document.createElement('dl'),route=o.category==='routes',group=o.category==='assemblies'||o.category==='frontages';
  const fields={Layer:o.category,Position:pointLabel(o),Size:!route&&o.sx?`${o.sx.toFixed(2)} × ${(o.sy||0).toFixed(2)} × ${o.sz.toFixed(2)} m`:o.w?`${o.w.toFixed(2)} × ${o.h.toFixed(2)} m`:undefined,
    Extent:group?`${o.bounds.minY.toFixed(3)}–${o.bounds.maxY.toFixed(3)} m Y`:undefined,Modules:o.boxIds?.length,Supports:o.supportIds?.length,
    Host:o.hostBuilding||o.hostBuildings?.join(', '),Mount:o.mountType,Attached:o.attachedTo,Parcel:o.parcelId||o.chunk,Role:o.role,
    Length:route?o.length.toFixed(2)+' m':undefined,Width:route?o.width.toFixed(2)+' m':undefined,Floors:route?`${o.minY.toFixed(3)}–${o.maxY.toFixed(3)} m Y`:undefined,
    Access:route&&o.routeType==='pedestrian'?(o.id==='DOCKS-CONTAINER-CROSS-AISLE'?'Single-person pedestrian passage':'Pedestrian passage'):undefined,
    Headroom:route&&o.clearHeight?o.clearHeight.toFixed(2)+' m planned':undefined,Floor:o.category==='entrances'?o.y.toFixed(3)+' m Y':undefined,Door:o.category==='entrances'?(o.closed?'Closed exterior entrance':'Residential entrance approach'):undefined};
  if(o.id==='HOUSING-B102-STAIR'&&data.housingCompositions?.stairs){const stair=data.housingCompositions.stairs;fields.Stair=`${stair.steps} × ${stair.rise.toFixed(2)} m rises`;fields.Going=stair.going.toFixed(2)+' m';fields.Landing=stair.landingY.toFixed(3)+' m Y';}
  for(const[key,value]of Object.entries(fields)){if(value===undefined||value==='')continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=String(value);dl.append(dt,dd)}panel.append(dl);
  const actions=document.createElement('div');actions.className='selection-actions';const focus=document.createElement('button');focus.textContent='FOCUS PLACEMENT';focus.onclick=()=>focusObjects([o]);actions.append(focus);
  for(const id of new Set([o.hostBuilding,...(o.hostBuildings||[]),o.assemblyId].filter(Boolean))){const host=objects.find(v=>v.id===id);if(!host||host===o)continue;const button=document.createElement('button');button.textContent='INSPECT '+id;button.onclick=()=>inspect(host);actions.append(button)}panel.append(actions);
  if(route){const points=document.createElement('details'),label=document.createElement('summary');label.textContent=o.points.length+' authored waypoints';points.append(label);o.points.forEach((p,i)=>{const line=document.createElement('code');line.textContent=(i+1)+'. '+pointLabel(p);points.append(line)});points.className='placement-points';panel.append(points);}
  const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Exact placement record';pre.textContent=JSON.stringify(o.record||o,null,2);details.append(summary,pre);panel.append(details);draw();return o;
}
function zoom(factor,x=w/2,y=h/2){const point=world(x,y);scale=Math.max(.3,Math.min(24,scale*factor));center.x=point.x-(x-w/2)/scale;center.z=point.z-(y-h/2)/scale;draw()}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz,t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0;return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)}
function pick(point){
  const candidates=[];for(const o of objects){if(!layers[o.category])continue;let distance,rank;
    if(o.category==='routes'){distance=Math.min(...o.points.slice(1).map((p,i)=>distanceToSegment(point,o.points[i],p)))*scale;if(distance>Math.max(6,(o.width||0)*scale/2))continue;rank=1;}
    else if(o.category==='entrances'){distance=Math.hypot(o.x-point.x,o.z-point.z)*scale;if(distance>Math.max(7,(o.sx||1)*scale/2))continue;rank=0;}
    else if(['buildings','assemblies','frontages','props'].includes(o.category)&&o.sx&&o.sz){const dx=Math.max(0,Math.abs(point.x-o.x)-o.sx/2),dz=Math.max(0,Math.abs(point.z-o.z)-o.sz/2);distance=Math.hypot(dx,dz)*scale;if(distance>4)continue;rank=o.category==='buildings'?5:o.category==='props'?3:2;distance+=Math.sqrt(o.sx*o.sz)*.001;}
    else{distance=Math.hypot(o.x-point.x,o.z-point.z)*scale;if(distance>7)continue;rank=distance<2?0:4;}
    candidates.push({o,rank,distance});
  }candidates.sort((a,b)=>a.rank-b.rank||a.distance-b.distance);return candidates[0]?.o||null;
}
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:center.x,cz:center.z};moved=false;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),point=world(e.clientX-r.left,e.clientY-r.top);document.getElementById('coordinates').textContent=`X ${point.x.toFixed(1)} / Z ${point.z.toFixed(1)} M`;if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>3)moved=true;center.x=drag.cx-dx/scale;center.z=drag.cz-dy/scale;draw()});
canvas.addEventListener('pointerup',e=>{if(!moved){const r=canvas.getBoundingClientRect();inspect(pick(world(e.clientX-r.left,e.clientY-r.top)))}drag=null});
canvas.addEventListener('pointercancel',()=>{drag=null});
document.querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',()=>{layers[input.dataset.layer]=input.checked;draw()}));
document.getElementById('fit').onclick=fit;document.getElementById('zoom-in').onclick=()=>zoom(1.4);document.getElementById('zoom-out').onclick=()=>zoom(1/1.4);
for(const d of data.districts||[]){const button=document.createElement('button'),dot=document.createElement('i');dot.style.setProperty('--tint',d.themeColor||d.color);button.append(dot,document.createTextNode(d.name));button.onclick=()=>{center.x=d.x;center.z=d.z;scale=Math.min(w,h)/250;draw()};document.getElementById('districts').append(button)}
for(const [chunk,label]of[['block-15','HOUSING COURT'],['block-0','MARKET BLOCK'],['block-8','IRON DOCKS YARD']]){const group=assemblies.filter(o=>o.chunk===chunk);if(!group.length)continue;const button=document.createElement('button');button.textContent=label;button.onclick=()=>focusObjects(group);document.getElementById('authored-views').append(button)}
for(const [value,label]of [[`${b.maxX-b.minX} × ${b.maxZ-b.minZ}`,'metres'],[(data.parcels||[]).length,'parcels'],[(data.buildings||[]).length,'building envelopes'],[(data.signs||[]).length,'mounted signs'],[assemblies.length,'authored assemblies'],[routes.length,'walking routes']]){const el=document.createElement('div');el.className='metric';const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=value;small.textContent=label;el.append(strong,small);document.getElementById('metrics').append(el)}
document.getElementById('status').textContent='SHARED PLACEMENTS / '+(data.roads||[]).length+' ROADS / '+assemblies.length+' AUTHORED ASSEMBLIES / '+routes.length+' WALKING ROUTES';
window.__blueprint={data,objects,select:id=>inspect(objects.find(o=>o.id===id)),focus:id=>{const o=objects.find(o=>o.id===id);if(o){inspect(o);focusObjects([o])}return Boolean(o)},
  setLayer:(name,visible)=>{if(!Object.hasOwn(layers,name))return false;layers[name]=Boolean(visible);const input=document.querySelector('[data-layer="'+name+'"]');if(input)input.checked=layers[name];draw();return true},
  snapshot:()=>({selected:selected?.id,selectedCategory:selected?.category,selection:selected?{id:selected.id,category:selected.category,x:selected.x,y:selected.y,z:selected.z,sx:selected.sx,sy:selected.sy,sz:selected.sz,record:selected.record||selected}:null,scale,center:{...center},layers:{...layers},counts:{...counts},visibleCounts:Object.fromEntries(Object.entries(counts).map(([key,value])=>[key,layers[key]?value:0]))})};
window.addEventListener('resize',resize);resize();fit();
