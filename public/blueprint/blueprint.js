const canvas=document.getElementById('drawing'),ctx=canvas.getContext('2d');
const layers={roads:true,parcels:true,buildings:true,signs:true,supports:true,connections:true,props:true};
const data=await fetch('blueprint.json').then(r=>{if(!r.ok)throw new Error('Blueprint data unavailable');return r.json()});
const b=data.bounds,center={x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2};
let scale=1,w=0,h=0,selected=null,drag=null,moved=false;
const color={roads:'#31536c',parcels:'#427c79',buildings:'#70b4d0',signs:'#e5b765',supports:'#da8ba3',connections:'#b591d1'};
const sx=x=>w/2+(x-center.x)*scale,sz=z=>h/2+(z-center.z)*scale;
const world=(x,y)=>({x:center.x+(x-w/2)/scale,z:center.z+(y-h/2)/scale});
const objects=[...(data.buildings||[]).map(o=>({...o,category:'buildings'})),...(data.signs||[]).map(o=>({...o,category:'signs'})),...(data.supports||[]).map(o=>({...o,category:'supports'})),...(data.props||[]).map(o=>({...o,category:'props'}))];
function resize(){const r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,2);w=r.width;h=r.height;canvas.width=w*ratio;canvas.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);draw()}
function fit(){center.x=(b.minX+b.maxX)/2;center.z=(b.minZ+b.maxZ)/2;scale=Math.min((w-110)/(b.maxX-b.minX),(h-100)/(b.maxZ-b.minZ));draw()}
function box(o,fill,stroke){ctx.fillStyle=fill;ctx.strokeStyle=stroke;const x=sx(o.x-o.sx/2),y=sz(o.z-o.sz/2),ww=o.sx*scale,hh=o.sz*scale;if(fill)ctx.fillRect(x,y,ww,hh);if(stroke)ctx.strokeRect(x,y,ww,hh)}
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
  if(layers.connections)for(const o of data.elevatedConnections||[]){ctx.strokeStyle=color.connections;ctx.lineWidth=1;ctx.setLineDash([3,2]);if(o.from&&o.to){ctx.beginPath();ctx.moveTo(sx(o.from.x),sz(o.from.z));ctx.lineTo(sx(o.to.x),sz(o.to.z));ctx.stroke()}else if(Number.isFinite(o.sx)&&Number.isFinite(o.sz))box(o,null,color.connections);ctx.setLineDash([])}
  if(layers.supports)for(const o of data.supports||[]){ctx.fillStyle=color.supports;ctx.fillRect(sx(o.x)-1.6,sz(o.z)-1.6,3.2,3.2)}
  if(layers.props)for(const o of data.props||[])if(o.sx&&o.sz){box(o,'#73c5b955','#a9e2c4');if(scale>2){ctx.fillStyle='#b0decf';ctx.font='8px Consolas,monospace';ctx.fillText(o.id,sx(o.x),sz(o.z)-6)}}
  if(layers.signs)for(const o of data.signs||[]){ctx.strokeStyle=color.signs;ctx.fillStyle=color.signs;const yaw=o.ry||0,dx=Math.cos(yaw)*(o.w||2)/2,dz=-Math.sin(yaw)*(o.w||2)/2;ctx.beginPath();ctx.moveTo(sx(o.x-dx),sz(o.z-dz));ctx.lineTo(sx(o.x+dx),sz(o.z+dz));ctx.stroke();if(scale>1.7){ctx.fillRect(sx(o.x)-1,sz(o.z)-1,2,2);if(o.anchor){ctx.strokeStyle='#bd995177';ctx.beginPath();ctx.moveTo(sx(o.x),sz(o.z));ctx.lineTo(sx(o.anchor.x),sz(o.anchor.z));ctx.stroke()}}}
  for(const d of data.districts||[]){ctx.fillStyle='#092132d9';ctx.font='bold 10px Consolas,monospace';const label=d.name.toUpperCase(),width=ctx.measureText(label).width;ctx.fillRect(sx(d.x)-width/2-7,sz(d.z)-9,width+14,19);ctx.fillStyle=d.themeColor||d.color||'#b5d7e4';ctx.textAlign='center';ctx.fillText(label,sx(d.x),sz(d.z)+4)}
  if(selected){ctx.strokeStyle='#ffe0a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(selected.x),sz(selected.z),Math.max(8,(selected.sx||selected.w||6)*scale*.7),0,Math.PI*2);ctx.stroke()}
  ctx.lineWidth=1;ctx.strokeStyle='#779cae';ctx.fillStyle='#98bdcd';ctx.font='9px Consolas,monospace';ctx.textAlign='center';ctx.beginPath();ctx.moveTo(38,61);ctx.lineTo(38,31);ctx.lineTo(34,40);ctx.moveTo(38,31);ctx.lineTo(42,40);ctx.stroke();ctx.fillText('N',38,23);
  const ruler=scale<1?100:scale<3?50:10;ctx.textAlign='left';ctx.beginPath();ctx.moveTo(30,h-51);ctx.lineTo(30+ruler*scale,h-51);ctx.moveTo(30,h-55);ctx.lineTo(30,h-47);ctx.moveTo(30+ruler*scale,h-55);ctx.lineTo(30+ruler*scale,h-47);ctx.stroke();ctx.fillText(ruler+' M',30,h-60);
  ctx.fillStyle='#698fa2';ctx.font='8px Consolas,monospace';ctx.textAlign='center';for(let x=Math.ceil(lo.x/100)*100;x<hi.x;x+=100)ctx.fillText('X '+x,sx(x),13);
}
function inspect(o){selected=o;const panel=document.getElementById('selection');panel.replaceChildren();if(!o)return;const title=document.createElement('h2');title.textContent=(o.id||o.category)+' / '+(o.text||o.name||o.label||o.category);panel.append(title);const dl=document.createElement('dl');const fields={Position:`${o.x.toFixed(2)}, ${(o.y||0).toFixed(2)}, ${o.z.toFixed(2)} m`,Size:o.sx?`${o.sx.toFixed(2)} × ${(o.sy||0).toFixed(2)} × ${o.sz.toFixed(2)} m`:o.w?`${o.w.toFixed(2)} × ${o.h.toFixed(2)} m`:undefined,Mount:o.mountType,Attached:o.attachedTo,Parcel:o.parcelId||o.chunk,Role:o.role};for(const [key,value]of Object.entries(fields)){if(value===undefined)continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=String(value);dl.append(dt,dd)}panel.append(dl);draw()}
function zoom(factor,x=w/2,y=h/2){const point=world(x,y);scale=Math.max(.3,Math.min(12,scale*factor));center.x=point.x-(x-w/2)/scale;center.z=point.z-(y-h/2)/scale;draw()}
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:center.x,cz:center.z};moved=false;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect(),point=world(e.clientX-r.left,e.clientY-r.top);document.getElementById('coordinates').textContent=`X ${point.x.toFixed(1)} / Z ${point.z.toFixed(1)} M`;if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>3)moved=true;center.x=drag.cx-dx/scale;center.z=drag.cz-dy/scale;draw()});
canvas.addEventListener('pointerup',e=>{if(!moved){const r=canvas.getBoundingClientRect(),point=world(e.clientX-r.left,e.clientY-r.top);let best=null,distance=Infinity;for(const o of objects){if(!layers[o.category])continue;const dd=Math.hypot(o.x-point.x,o.z-point.z);if(dd<distance&&dd<Math.max(8/scale,(o.sx||o.w||0)/2)){best=o;distance=dd}}if(best)inspect(best)}drag=null});
document.querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',()=>{layers[input.dataset.layer]=input.checked;draw()}));
document.getElementById('fit').onclick=fit;document.getElementById('zoom-in').onclick=()=>zoom(1.4);document.getElementById('zoom-out').onclick=()=>zoom(1/1.4);
for(const d of data.districts||[]){const button=document.createElement('button'),dot=document.createElement('i');dot.style.setProperty('--tint',d.themeColor||d.color);button.append(dot,document.createTextNode(d.name));button.onclick=()=>{center.x=d.x;center.z=d.z;scale=Math.min(w,h)/250;draw()};document.getElementById('districts').append(button)}
for(const [value,label]of [[`${b.maxX-b.minX} × ${b.maxZ-b.minZ}`,'metres'],[(data.parcels||[]).length,'parcels'],[(data.buildings||[]).length,'building envelopes'],[(data.signs||[]).length,'mounted signs']]){const el=document.createElement('div');el.className='metric';const strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=value;small.textContent=label;el.append(strong,small);document.getElementById('metrics').append(el)}
document.getElementById('status').textContent='SHARED PLACEMENT DATA / '+(data.roads||[]).length+' ROAD SEGMENTS / '+(data.supports||[]).length+' SUPPORTS';
window.__blueprint={data,select:id=>inspect(objects.find(o=>o.id===id)),snapshot:()=>({selected:selected?.id,scale,center:{...center},layers:{...layers}})};
window.addEventListener('resize',resize);resize();fit();
