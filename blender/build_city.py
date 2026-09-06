"""Build the complete VESPER city as an editable Blender scene.

Run: blender --background --python blender/build_city.py
Save/reopen only, preserving existing viewpoints: append -- --skip-render --preserve-views
Requires Node.js to evaluate the shared deterministic layout in src/city-layout.js.
All city geometry is native editable Blender mesh geometry. Storefront lettering
is editable Blender text; asset props are appended from cyberpunk-assets.blend.
Coordinate conversion from Three.js: (x,y,z) -> Blender (x,-z,y).
"""
from pathlib import Path
import bpy
import json
import math
import subprocess
import shutil
import sys
from collections import defaultdict
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'blender'))
from advert_materials import load_ad_material, material_image, image_quad, panel_dimensions
from surface_materials import configure_surface_materials, configure_surface_material
from native_layout import read_native_layout, read_native_characters
from native_characters import populate_characters, embed_character_export, verify_character
from practical_lights import add_practical_lights
layout=read_native_layout(ROOT)
character_source=read_native_characters(ROOT)
far_lod_count=sum(1 for box in layout['boxes'] if box.get('lod')=='far')
layout['boxes']=[box for box in layout['boxes'] if box.get('lod')!='far']
layout['groups']=defaultdict(list)
for box in layout['boxes']:layout['groups'][box['kind']].append(box)
layout['wires']=[]
preserved_views={'cameras':{},'scenes':{}}
native_path=ROOT/'blender'/'neon-district-city.blend'
if '--preserve-views' in sys.argv and native_path.exists():
    bpy.ops.wm.open_mainfile(filepath=str(native_path))
    for obj in bpy.data.objects:
        if obj.type!='CAMERA':continue
        preserved_views['cameras'][obj.name]={'matrix':[list(row) for row in obj.matrix_world],
            'type':obj.data.type,'lens':obj.data.lens,'ortho_scale':obj.data.ortho_scale,
            'clip_start':obj.data.clip_start,'clip_end':obj.data.clip_end,
            'shift_x':obj.data.shift_x,'shift_y':obj.data.shift_y,'sensor_width':obj.data.sensor_width,'sensor_height':obj.data.sensor_height}
    preserved_views['scenes']={s.name:s.camera.name for s in bpy.data.scenes if s.camera}
bpy.ops.wm.read_factory_settings(use_empty=True)

def collection(name):
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
CITY=collection('01 CITY / editable voxel architecture')
SIGNS=collection('02 NEON / editable signage')
PROPS=collection('03 GAMEPLAY / Blender asset kit')
LIFE=collection('04 STREET LIFE / commuters and traffic')
RIG=collection('05 LIGHTING / cameras and atmosphere')
FRONTS=collection('07 STREET FRONTS / attached entrance assemblies')
SERVICES=collection('08 SERVICE MECHANISMS / editable idle fixtures')
BLOCKS=collection('09 AUTHORED BLOCKS / residential court and market')
CITIZENS=collection('10 CITIZENS / exact resolved runtime population')
# Construct editable rigs before the large architecture graph exists. Their
# source roots are already resolved by the runtime export, so this ordering
# changes no placement and avoids repeated edit-mode updates of city geometry.
print('NATIVE_PHASE citizens',flush=True)
native_people=populate_characters(character_source,CITIZENS)
for citizen in native_people:verify_character(citizen)
character_source_sha=embed_character_export(character_source)
print('NATIVE_PHASE architecture',flush=True)

def linear(hex_color):
    rgb=[int(hex_color.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)

def material(name, color=None, emissive=0, roughness=.6, metallic=.2):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=roughness;bs.inputs['Metallic'].default_value=metallic
    if color:
        col=(*linear(color),1);bs.inputs['Base Color'].default_value=col;m.diffuse_color=col
        if emissive:bs.inputs['Emission Color'].default_value=col
    else:
        attr=m.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='VoxelTint'
        m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
        if emissive:m.node_tree.links.new(attr.outputs['Color'],bs.inputs['Emission Color'])
    if emissive:bs.inputs['Emission Strength'].default_value=emissive
    return m

mats={
 'solid':material('Voxel / architectural alloy',roughness=.86,metallic=.08),
 'pavement':material('Voxel / rain polished asphalt',roughness=.91,metallic=.025),
 'glow':material('Voxel / emissive neon and windows',emissive=2.4,roughness=.3,metallic=.15),
 'glass':material('Voxel / reflective facade glass',roughness=.11,metallic=.86),
 'metal':material('Voxel / weathered small metal panels',roughness=.57,metallic=.66),
 'window':material('Voxel / occupied warm windows',emissive=.85,roughness=.35,metallic=.2),
}
configure_surface_materials(mats)
profile_mats={}
for profile_id,settings in layout['nativeSurfaceProfiles'].items():
    item=material('Voxel / industrial finish / '+profile_id,roughness=settings['roughness'],metallic=settings['metalness'])
    configure_surface_material(item,'metal',{'id':profile_id,**settings})
    profile_mats[profile_id]=item

def surface_profile(box):
    key=box.get('materialProfile','') if box['kind']=='metal' else ''
    if key and key not in profile_mats:raise ValueError('Unknown native material profile '+key)
    return key

def to_blender(x,y,z):return (x,-z,y)

class Batch:
    def __init__(self):self.verts=[];self.faces=[];self.colors=[]
    def box(self,v):
        n=len(self.verts);sx,sy,sz=v['sx']/2,v['sy']/2,v['sz']/2
        rot=v.get('ry',0);cs,sn=math.cos(rot),math.sin(rot)
        for x,y,z in [(-sx,-sy,-sz),(sx,-sy,-sz),(sx,sy,-sz),(-sx,sy,-sz),
                      (-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]:
            self.verts.append(to_blender(v['x']+x*cs+z*sn,v['y']+y,v['z']-x*sn+z*cs))
        self.faces.extend(tuple(n+i for i in f) for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        self.colors.extend([(*linear(v['c']),1)]*8)
    def finish(self,name,mat,coll):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.verts,[],self.faces);mesh.materials.append(mat)
        attr=mesh.color_attributes.new(name='VoxelTint',type='FLOAT_COLOR',domain='POINT')
        attr.data.foreach_set('color',[v for color in self.colors for v in color])
        mesh.update();obj=bpy.data.objects.new(name,mesh);coll.objects.link(obj);return obj

batches=defaultdict(Batch)
refit_spans=defaultdict(list)
for kind,items in layout['groups'].items():
    for v in items:
        if v.get('detail') in ['street-craft','block-craft','service-mechanism']:continue
        # Independent sections keep the native geometry practical to edit.
        section=int(math.floor(v['z']/27));side='WEST' if v['x']< -16 else 'EAST' if v['x']>16 else 'AVENUE'
        if abs(v['x'])>45:side+=f' / outer {int(abs(v["x"])//45):02d}'
        key=(kind,section,side)
        if v.get('detail')=='street-frontage-refit':
            refit_spans[key].append({'id':v['id'],'sourceIndex':v['sourceIndex'],'vertexStart':len(batches[key].verts)})
        batches[key].box(v)
for (kind,section,side),batch in batches.items():
    obj=batch.finish(f'{side} / block {section:+03d} / {kind}',mats[kind],CITY)
    if refit_spans[(kind,section,side)]:
        obj['frontage_refit_spans']=json.dumps(refit_spans[(kind,section,side)])
frontage_by_id={box['id']:box for box in layout['boxes'] if box.get('detail')=='street-craft'}
for assembly in layout.get('streetDetails',{}).get('assemblies',[]):
    parent=bpy.data.objects.new(assembly['id'],None);FRONTS.objects.link(parent)
    parent['street_frontage']=json.dumps(assembly,ensure_ascii=False)
    parent['removed_service_shutters']=json.dumps([bid for bid in assembly['boxIds'] if bid in layout['nativeServiceFixtures']['removedBoxIds']])
    parts=defaultdict(Batch)
    for box_id in assembly['boxIds']:
        if box_id not in frontage_by_id:continue
        box=frontage_by_id[box_id];parts[box['kind']].box(box)
    for kind,batch in parts.items():
        obj=batch.finish(assembly['id']+' / '+kind,mats[kind],FRONTS);obj.parent=parent
        obj['street_frontage_id']=assembly['id'];obj['voxel_modules']=len(batch.verts)//8
        obj['source_box_ids']=json.dumps([bid for bid in assembly['boxIds'] if bid in frontage_by_id and frontage_by_id[bid]['kind']==kind])

block_by_id={box['id']:box for box in layout['boxes'] if box.get('detail')=='block-craft'}
for assembly in layout.get('blockCompositions',{}).get('assemblies',[]):
    parent=bpy.data.objects.new(assembly['id'],None);BLOCKS.objects.link(parent)
    parent['block_composition']=json.dumps(assembly,ensure_ascii=False)
    parts=defaultdict(Batch)
    for box_id in assembly['boxIds']:
        box=block_by_id[box_id];parts[(box['kind'],surface_profile(box))].box(box)
    for (kind,profile),batch in parts.items():
        obj=batch.finish(assembly['id']+' / '+kind+(' / '+profile if profile else ''),profile_mats[profile] if profile else mats[kind],BLOCKS);obj.parent=parent
        obj['block_composition_id']=assembly['id'];obj['voxel_modules']=len(batch.verts)//8
        obj['surface_profile']=profile
        obj['source_box_ids']=json.dumps([bid for bid in assembly['boxIds'] if block_by_id[bid]['kind']==kind and surface_profile(block_by_id[bid])==profile])

service_materials={}
for recipe in layout['nativeServiceFixtures']['recipes']:
    parent=bpy.data.objects.new(recipe['id']+' / mechanism',None);SERVICES.objects.link(parent)
    parent.location=to_blender(**recipe['origin']);parent.rotation_euler.z=recipe['ry']
    parent['service_id']=recipe['id'];parent['service_recipe']=json.dumps(recipe,ensure_ascii=False)
    parent['service_site']=json.dumps(next(s for s in layout['nativeServiceFixtures']['sites'] if s['id']==recipe['id']))
    parent['source_recipe_hash']=layout['nativeServiceFixtures']['sourceHash']
    groups={}
    for group_id in sorted(set(p['partGroup'] for p in recipe['parts'])):
        group=bpy.data.objects.new(recipe['id']+' / '+group_id,None);SERVICES.objects.link(group)
        group.parent=parent;group['service_id']=recipe['id'];group['part_group']=group_id;groups[group_id]=group
    for part in recipe['idlePose']['boxes']:
        intensity=part.get('intensity',0);key=(part['color'],intensity)
        if key not in service_materials:
            service_materials[key]=material('Service / '+part['color']+' / '+str(intensity),part['color'],emissive=intensity,roughness=.57,metallic=.46)
            service_materials[key].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=intensity
        batch=Batch();batch.box({'x':0,'y':0,'z':0,'sx':part['sx'],'sy':part['sy'],'sz':part['sz'],'c':part['color']})
        obj=batch.finish(part['id'],service_materials[key],SERVICES)
        obj.parent=groups[part['partGroup']];obj.location=to_blender(**part['local'])
        obj['service_id']=recipe['id'];obj['service_part_id']=part['id'];obj['part_group']=part['partGroup']
        obj['runtime_source_module']='src/service-fixtures.js';obj['source_box']=json.dumps(part)
        obj['collision_solid']=part.get('solid',True);obj['voxel_modules']=1

sign_mats={}
poster_mats={}
text_fit=[]
campaign_catalog=layout['nativeAdvertCampaigns']
campaign_files={ad['index']:ad['file'] for ad in campaign_catalog}
for ad in campaign_catalog:load_ad_material(ROOT,ad['file'],poster_mats)
load_ad_material(ROOT,'advert-portrait.png',poster_mats,2.4)
plate_mat=material('Signage / midnight enamel','#050d19',roughness=.35,metallic=.5)
def neon(tint):
    if tint not in sign_mats:sign_mats[tint]=material('Neon '+tint,tint,emissive=3.0,roughness=.3)
    return sign_mats[tint]

def local_sign_pos(sign,dx,dy,dz):
    ry=sign['ry'];cs,sn=math.cos(ry),math.sin(ry)
    return to_blender(sign['x']+dx*cs+dz*sn,sign['y']+dy,sign['z']-dx*sn+dz*cs)

for index,s in enumerate(layout['signs']):
    name=f'{index:02d} / {s["text"]}'
    # Separate editable boxes form sign housings and luminous outline.
    batch=Batch()
    def sb(dx,dy,dz,w,h,d,c):
        p=local_sign_pos(s,dx,dy,dz)
        batch.box({'x':p[0],'y':p[2],'z':-p[1],'sx':w,'sy':h,'sz':d,'ry':s['ry'],'c':c})
    sb(0,0,-.08,s['w']+.16,s['h']+.16,.13,'#071521')
    housing=batch.finish(name+' / enclosure',mats['solid'],SIGNS)
    batch=Batch()
    for dx in [-s['w']/2+.04,s['w']/2-.04]:sb(dx,0,.01,.038,s['h']-.08,.027,s['tint'])
    for dy in [-s['h']/2+.04,s['h']/2-.04]:sb(0,dy,.01,s['w']-.08,.038,.027,s['tint'])
    batch.finish(name+' / neon border',mats['glow'],SIGNS)
    if s.get('art') in ['portrait','dancer','campaign']:
        file_name=campaign_files[int(s.get('adIndex',0))] if s.get('art')=='campaign' else 'advert-portrait.png'
        mat=poster_mats[file_name]
        image=material_image(mat)
        mesh=bpy.data.meshes.new(name+' / campaign panel')
        mesh.from_pydata(image_quad(s,image,local_sign_pos),[],[(0,1,2,3)])
        mesh.materials.append(mat);uv=mesh.uv_layers.new(name='Portrait UV')
        for i,p in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=p
        obj=bpy.data.objects.new(name+' / editable image campaign',mesh);SIGNS.objects.link(obj)
        obj['campaign_asset']=file_name
        obj['sign_id']=s['id'];obj['campaign_id']=s.get('campaignId','portrait')
        obj['image_fit']='contain' if s.get('art')=='campaign' else 'preserved landmark'
        obj['source_image_dimensions']=json.dumps(list(image.size));obj['panel_dimensions']=json.dumps(panel_dimensions(s,image))
        continue
    text_rows=[(s['text'],s['h']*.08,s['h']*.38,s['w']*.9),(s['sub'],-s['h']*.29,s['h']*.095,s['w']*.9)]
    if s.get('vertical'):
        glyphs=str(s['vertical'])
        text_rows=[('\n'.join(glyphs),s['h']*.08,min(s['w']*.7,s['h']/max(1,len(glyphs)*1.5)),s['w']*.86),
                   (s['text'],-s['h']*.39,s['h']*.075,s['w']*.9)]
    for text,offset,size,maxwidth in text_rows:
        data=bpy.data.curves.new(name+' / lettering','FONT');data.body=text;data.align_x='CENTER';data.align_y='CENTER'
        data.size=size;data.extrude=.004;data.space_character=1.12;data.materials.append(neon(s['tint']))
        obj=bpy.data.objects.new(text,data);SIGNS.objects.link(obj)
        obj.location=local_sign_pos(s,0,offset,.045)
        obj.rotation_euler=(Matrix.Rotation(s['ry'],4,'Z')@Matrix.Rotation(math.pi/2,4,'X')).to_euler()
        text_fit.append((obj,maxwidth))

# Resolve all font bounds in one evaluation pass for large city sign counts.
bpy.context.view_layer.update()
for obj,maxwidth in text_fit:
    width=max(v[0] for v in obj.bound_box)-min(v[0] for v in obj.bound_box)
    if width>maxwidth:obj.scale.x=maxwidth/width

wire_mat=material('Overhead utilities / insulated cable','#152438',roughness=.9)
for i,points in enumerate(layout['wires']):
    data=bpy.data.curves.new(f'Catenary cable {i:02d}','CURVE');data.dimensions='3D';data.bevel_depth=.035;data.bevel_resolution=0
    spline=data.splines.new('POLY');spline.points.add(len(points)-1)
    for dest,src in zip(spline.points,points):dest.co=(*to_blender(src['x'],src['y'],src['z']),1)
    data.materials.append(wire_mat);obj=bpy.data.objects.new(data.name,data);CITY.objects.link(obj)

# Native Blender props share their mesh data, with independently editable transforms.
with bpy.data.libraries.load(str(ROOT/'blender'/'cyberpunk-assets.blend'),link=False) as (src,dst):
    dst.objects=[n for n in src.objects if n in ['K-77 INTERCEPTOR','VIGIL SECURITY DRONE','KASUMI DATA RELAY','VOLTA EXPLOSIVE CELL','NIGHT MARKET NOODLES','AEON / ARMORED PATROL AV','VEX / VOXEL MERCENARY','head','torso','left_arm','right_arm','left_leg','right_leg']]
templates={obj.name:obj for obj in dst.objects if obj}

def prop(template,name,pos,rotation=0,height=None):
    base=templates[template];obj=base.copy();obj.data=base.data;obj.name=name;PROPS.objects.link(obj)
    obj.location=to_blender(*pos);obj.rotation_euler=(0,0,rotation);obj.scale=(1,1,1)
    if template in ['K-77 INTERCEPTOR','AEON / ARMORED PATROL AV','VIGIL SECURITY DRONE']:
        obj.data=obj.data.copy()
        for slot in obj.material_slots:
            slot.material=slot.material.copy()
            bs=slot.material.node_tree.nodes.get('Principled BSDF')
            if bs:
                factor=.48 if template=='K-77 INTERCEPTOR' else .35 if template=='AEON / ARMORED PATROL AV' else 1
                bs.inputs['Emission Strength'].default_value*=factor
                if template in ['VIGIL SECURITY DRONE','AEON / ARMORED PATROL AV'] and any(tint in slot.material.name for tint in ['hot magenta','signal red']):
                    bs.inputs['Base Color'].default_value=(.025,.85,1,1)
                    bs.inputs['Emission Color'].default_value=(.025,.85,1,1)
    for child in base.children:
        copy=child.copy();copy.data=child.data;copy.parent=obj;PROPS.objects.link(copy)
    if height:
        bounds=[Vector(v) for v in base.bound_box];low=min(v.z for v in bounds);high=max(v.z for v in bounds)
        factor=height/(high-low);obj.scale=(factor,factor,factor);obj.location.z-=low*factor
    return obj
asset_names={'interceptor':'K-77 INTERCEPTOR','mercenary':'VEX / VOXEL MERCENARY',
             'av':'AEON / ARMORED PATROL AV','kiosk':'NIGHT MARKET NOODLES'}
for anchor in layout['nativePlacements'].values():
    obj=prop(asset_names[anchor['asset']],anchor['id']+' / '+anchor['role'],
             (anchor['x'],anchor['y'],anchor['z']),anchor.get('ry',0))
    scale=anchor.get('scale',1);obj.scale=(scale,scale,scale)
    obj['shared_anchor']=json.dumps(anchor)
patrol_routes=layout.get('patrolRoutes',[])
patrol_spawns=[(route['points'][0]['x'],route.get('height',4.1+(i%3)*.2),route['points'][0]['z'])
               for i,route in enumerate(patrol_routes)] if patrol_routes else [(0,3.8,-28),(-3,4.3,-55),(3,3.7,-90),(0,4.2,-120)]
for i,p in enumerate(patrol_spawns):
    prop('VIGIL SECURITY DRONE',f'NEUTRAL SECURITY {i+1:02d} / patrol drone',p,0,.7)
supply_layout=layout.get('nativeSupply',{})
for i,support in enumerate(supply_layout.get('foundations',[])):
    batch=Batch()
    batch.box({**support,'sx':support['sx']-.04,'sy':support['sy']-.05,'sz':support['sz']-.04,
               'y':support['groundY']+(support['sy']-.05)/2,'c':'#101e2b'})
    batch.box({**support,'sy':.05,'y':support['topY']-.025,'c':'#253440'})
    obj=batch.finish('GROUNDED SUPPLY / '+support['id'],mats['solid'],PROPS)
    obj['support_id']=support['id']
    prop('VOLTA EXPLOSIVE CELL',f'SUPPLY {i+1:02d} / lower energy cell',(support['x'],support['topY'],support['z']),0,1.35)
for i,support in enumerate(supply_layout.get('stackSpacers',[])):
    batch=Batch();batch.box(support);batch.finish('STACK SPACER / '+support['id'],mats['solid'],PROPS)
    prop('VOLTA EXPLOSIVE CELL',f'SUPPLY STACK {i+1:02d} / upper energy cell',
         (support['x'],support['y']+support['sy']/2,support['z']),0,1.35)

# The overhead craft also use their actual runtime voxel kit and population.
# Their frame-zero placement includes the runtime's per-craft vertical phase.
for i,aircraft in enumerate(character_source['airTraffic']):
    title=f'AIR TRAFFIC {i+1:02d} / shared voxel courier'
    aircraft_root=bpy.data.objects.new(title,None);LIFE.objects.link(aircraft_root)
    aircraft_root.location=to_blender(aircraft['x'],aircraft['y']+math.sin(i)*.22,aircraft['z'])
    aircraft_root['air_traffic_index']=i
    aircraft_root['source_placement']=json.dumps(aircraft)
    aircraft_root['pose_policy']='Exact runtime frame zero; editable root. Live flight continues in the Three.js runtime.'
    for kind,parts in layout['nativeAircraftGeometry'].items():
        batch=Batch()
        for x,y,z,sx,sy,sz,c in parts:batch.box({'x':x,'y':y,'z':z,'sx':sx,'sy':sy,'sz':sz,'c':c})
        mesh=batch.finish(title+' / '+kind,mats['glow' if kind=='glow' else 'metal'],LIFE)
        mesh.parent=aircraft_root
        mesh['air_traffic_part_kind']=kind

# Rain remains seeded independently of character placement.
import random
rng=random.Random(84719)

# Renderer-independent street-life geometry is shared with the running game.
life_layout=layout.get('nativeLife') or {}
max_traffic_frame=1800
def loop_curves(obj):
    action=obj.animation_data.action
    if hasattr(action,'fcurves'):curves=action.fcurves
    else:curves=action.layers[0].strips[0].channelbag(obj.animation_data.action_slot).fcurves
    for curve in curves:
        for key in curve.keyframe_points:key.interpolation='LINEAR'
        curve.modifiers.new('CYCLES')

def animate_traffic(obj,vehicle):
    global max_traffic_frame
    points=vehicle.get('routePoints',[])
    if len(points)<2:return
    lengths=[];offsets=[];length=0
    for i,a in enumerate(points):
        b=points[(i+1)%len(points)];offsets.append(length)
        segment=math.hypot(b['x']-a['x'],b['z']-a['z']);lengths.append(segment);length+=segment
    start=vehicle.get('distance',0)%length;speed=max(.1,vehicle.get('speed',7))
    distances=sorted(set([0,length]+[(offset-start)%length for offset in offsets]))
    previous_yaw=None
    for distance in distances:
        offset=(start+distance)%length;index=len(offsets)-1
        while index>0 and offsets[index]>offset:index-=1
        a=points[index];b=points[(index+1)%len(points)];t=(offset-offsets[index])/max(.001,lengths[index])
        x=a['x']+(b['x']-a['x'])*t;z=a['z']+(b['z']-a['z'])*t
        yaw=math.atan2(-(b['x']-a['x']),-(b['z']-a['z']))
        if previous_yaw is not None:
            while yaw-previous_yaw>math.pi:yaw-=math.tau
            while yaw-previous_yaw< -math.pi:yaw+=math.tau
        previous_yaw=yaw;frame=1+distance/speed*30
        obj.location=to_blender(x,vehicle.get('y',0),z);obj.rotation_euler.z=yaw
        obj.keyframe_insert(data_path='location',frame=frame);obj.keyframe_insert(data_path='rotation_euler',index=2,frame=frame)
        max_traffic_frame=max(max_traffic_frame,math.ceil(frame))
    loop_curves(obj)

for index,vehicle in enumerate(life_layout.get('vehicles',[])):
    title=f'TRAFFIC {index+1:02d} / {vehicle.get("type","vehicle")} / {vehicle.get("region","")}'
    vehicle_root=bpy.data.objects.new(title,None);LIFE.objects.link(vehicle_root)
    vehicle_root.location=to_blender(vehicle['x'],vehicle.get('y',0),vehicle['z'])
    vehicle_root.rotation_euler=(0,0,vehicle.get('yaw',0))
    vehicle_root['vehicle_type']=vehicle.get('type','vehicle');vehicle_root['district']=vehicle.get('region','')
    pieces=defaultdict(Batch)
    for piece in vehicle.get('boxes',[]):pieces[piece.get('kind','solid')].box(piece)
    for kind,batch in pieces.items():
        obj=batch.finish(title+' / '+kind,mats.get(kind,mats['solid']),LIFE);obj.parent=vehicle_root
    animate_traffic(vehicle_root,vehicle)
activity_batches=defaultdict(Batch)
motion_batches={}
for piece in life_layout.get('props',[]):
    motion=piece.get('motion') or ''
    if motion.startswith('hologram:') or motion.startswith('crown:'):
        _,cx,cz=motion.split(':');cx=float(cx);cz=float(cz)
        key=(motion,piece.get('kind','solid'))
        if key not in motion_batches:motion_batches[key]={'batch':Batch(),'x':cx,'z':cz}
        local={**piece,'x':piece['x']-cx,'z':piece['z']-cz};motion_batches[key]['batch'].box(local)
        continue
    kind=piece.get('kind','solid');section=(kind,int(piece['x']//60),int(piece['z']//60))
    activity_batches[section].box(piece)
for (kind,x,z),batch in activity_batches.items():batch.finish(f'ACTIVITY / {x:+03d} {z:+03d} / {kind}',mats.get(kind,mats['solid']),LIFE)
for (motion,kind),item in motion_batches.items():
    obj=item['batch'].finish('ANIMATED ACTIVITY / '+motion,mats.get(kind,mats['solid']),LIFE)
    obj.location=to_blender(item['x'],0,item['z'])
    speed=.3 if motion.startswith('crown:') else .65
    obj.rotation_euler.z=0;obj.keyframe_insert(data_path='rotation_euler',index=2,frame=1)
    obj.rotation_euler.z=math.tau;obj.keyframe_insert(data_path='rotation_euler',index=2,frame=1+math.tau/speed*30)
    loop_curves(obj)

def light(name,kind,pos,color,power,size=5,target=None):
    data=bpy.data.lights.new(name,kind);data.energy=power;data.color=color
    if kind=='AREA':data.shape='DISK';data.size=size
    if kind=='POINT':data.shadow_soft_size=1.6
    obj=bpy.data.objects.new(name,data);RIG.objects.link(obj);obj.location=to_blender(*pos)
    if target:obj.rotation_euler=(Vector(to_blender(*target))-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj
light('Blue hour / overhead softbox','AREA',(0,100,-35),(.34,.59,1),42000,120,(0,0,-60))
light('City moon','SUN',(-40,90,40),(.49,.7,1),.95,target=(0,0,-50))
light('Magenta skyline fill','AREA',(45,35,-35),(1,.13,.39),14000,70,(0,20,-65))
light('Noodle bar / warm pavement','AREA',(-13,4,20),(1,.33,.06),520,7,(-5,0,24))
light('Portrait / neon bounce','AREA',(-15,20,12),(1,.03,.34),2400,10,(0,2,22))
light('Hero / cyan edge','AREA',(8,3,19),(.025,.72,1),270,5,(1,1,25))
add_practical_lights(layout,RIG)
searchlight=light('PATROL / volumetric searchlight','SPOT',(14,32.5,-8),(.47,.72,1),5000,target=(10,0,-15))
searchlight.data.spot_size=.698;searchlight.data.spot_blend=.75
for side in [-1,1]:
    for i,z in enumerate([18,-10,-38,-72,-105,-137]):
        light(f'Neon bounce {side:+d} {i}','POINT',(side*13,5,z),(.03,.73,1) if side<0 else (1,.035,.22),560)
world=bpy.data.worlds.new('VESPER / blue night');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.037,.067,.13,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.17;bpy.context.scene.world=world

# A finite mist volume provides the concept's blue atmospheric perspective.
mist=bpy.data.materials.new('ATMOSPHERE / cold city mist');mist.use_nodes=True
nodes=mist.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');volume=nodes.new('ShaderNodeVolumePrincipled')
volume.inputs['Density'].default_value=.0017;volume.inputs['Color'].default_value=(.31,.47,.61,1)
volume.inputs['Anisotropy'].default_value=.18;mist.node_tree.links.new(volume.outputs['Volume'],out.inputs['Volume'])
batch=Batch();batch.box({'x':0,'y':85,'z':-102,'sx':210,'sy':174,'sz':344,'c':'#132838'})
mist_obj=batch.finish('ATMOSPHERE / finite blue mist volume',mist,RIG);mist_obj.display_type='WIRE'
rain_mat=material('WEATHER / fine rain','#527d95',emissive=.16,roughness=.3)
rain_bs=rain_mat.node_tree.nodes.get('Principled BSDF');rain_bs.inputs['Alpha'].default_value=.25
batch=Batch()
for i in range(1600):
    batch.box({'x':rng.uniform(-32,32),'y':rng.uniform(2,65),'z':rng.uniform(-170,38),
      'sx':.009,'sy':rng.uniform(.23,.63),'sz':.012,'c':'#527d95'})
batch.finish('WEATHER / editable rain streaks',rain_mat,RIG)

def camera(name,pos,target,lens):
    data=bpy.data.cameras.new(name);data.lens=lens;data.clip_end=1000
    obj=bpy.data.objects.new(name,data);RIG.objects.link(obj);obj.location=to_blender(*pos)
    obj.rotation_euler=(Vector(to_blender(*target))-obj.location).to_track_quat('-Z','Y').to_euler();return obj
street_camera=camera('CAM 01 / concept composition',(-.5,1.2,32),(-.5,42,-100),15.6)
bounds=layout.get('bounds',{'minX':-100,'maxX':100,'minZ':-260,'maxZ':45})
center_x=(bounds['minX']+bounds['maxX'])/2;center_z=(bounds['minZ']+bounds['maxZ'])/2
extent=max(bounds['maxX']-bounds['minX'],bounds['maxZ']-bounds['minZ'])
overview=camera('CAM 02 / complete city aerial',(center_x+extent*.87,extent*1.07,center_z+extent*1.09),(center_x,15,center_z),40)
overview.data.type='ORTHO';overview.data.ortho_scale=extent*1.68;overview.data.clip_end=4000
camera('CAM 03 / district human scale',(-3,1.8,18),(-1,8,-48),22)
topview=camera('CAM 04 / city map',(center_x,extent*1.8,center_z),(center_x,0,center_z),50)
topview.data.type='ORTHO';topview.data.ortho_scale=extent*1.8;topview.data.clip_end=4000
scene=bpy.context.scene;scene.name='VESPER / street composition';scene.camera=street_camera
scene.render.fps=30;scene.frame_start=1;scene.frame_end=max_traffic_frame;scene.frame_set(1)
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True
scene.render.resolution_x=1680;scene.render.resolution_y=945;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'blender'/'city-scene-preview.png')
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.65
# Convenient opening state: solid material colors with the street camera selected.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.clip_end=1000;area.spaces.active.shading.color_type='MATERIAL'
            area.spaces.active.region_3d.view_distance=130
            area.spaces.active.region_3d.view_location=Vector((0,65,25))
scene['source_layout']='Exact seeded voxel layout from src/city-layout.js'
scene['coordinate_mapping']='Three.js (x,y,z) -> Blender (x,-z,y)'
scene['city_box_count']=sum(len(items) for items in layout['groups'].values())
scene['description']='Editable VESPER city with shared structural blueprint, animated street traffic and original voxel art.'
scene['native_civilian_count']=len(native_people)
scene['native_civilian_voxel_count']=character_source['counts']['voxelPieces']
scene['native_character_source_sha256']=character_source_sha
scene['native_aircraft_count']=len(character_source['airTraffic'])
scene['driveable_bounds']=json.dumps(bounds)
scene['excluded_duplicate_far_lod_boxes']=far_lod_count
scene['campaign_assets']=json.dumps(sorted(poster_mats))
scene['campaign_count']=len(campaign_catalog)
campaign_text=bpy.data.texts.new('VESPER / advert campaign catalog.json')
campaign_text.write(json.dumps({'campaigns':campaign_catalog,'placements':layout.get('advertPlacements',[])},indent=2,ensure_ascii=False));campaign_text.use_fake_user=True
scene['street_life_vehicles']=len(life_layout.get('vehicles',[]))
scene['street_life_prop_modules']=len(life_layout.get('props',[]))
scene['dynamic_street_props']=json.dumps(layout.get('nativeDynamicProps',[]))
scene['structural_support_count']=len(layout.get('supports',[]))
scene['placement_corrections']=json.dumps(layout.get('placementCorrections',{}))
scene['shared_asset_placements']=json.dumps(layout['nativePlacements'])
scene['street_frontage_count']=len(layout.get('streetDetails',{}).get('assemblies',[]))
scene['street_frontage_voxels']=layout.get('streetDetails',{}).get('voxelCount',0)
scene['street_frontage_refit_records']=len(layout.get('streetDetails',{}).get('facadeReplacements',[]))
scene['street_frontage_refit_fragments']=sum(len(spans) for spans in refit_spans.values())
scene['service_mechanism_count']=len(layout['nativeServiceFixtures']['recipes'])
scene['service_mechanism_voxels']=sum(len(r['parts']) for r in layout['nativeServiceFixtures']['recipes'])
scene['service_shutter_replacements']=json.dumps(layout['nativeServiceFixtures']['removedBoxIds'])
scene['block_composition_count']=len(layout.get('blockCompositions',{}).get('assemblies',[]))
service_text=bpy.data.texts.new('VESPER / resting service mechanisms.json')
service_text.write(json.dumps(layout['nativeServiceFixtures'],indent=2,ensure_ascii=False));service_text.use_fake_user=True
scene['preview_images_current']='--skip-render' not in sys.argv
aerial_scene=scene.copy();aerial_scene.name='VESPER / complete city aerial';aerial_scene.use_fake_user=True;aerial_scene.camera=overview
aerial_scene.world=world.copy();aerial_scene.world.name='VESPER / aerial blue hour'
aerial_scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
aerial_rig=bpy.data.collections.new('06 AERIAL / exclusive overview lighting');aerial_scene.collection.children.link(aerial_rig)
aerial_sun_data=bpy.data.lights.new('Aerial / architectural fill','SUN');aerial_sun_data.energy=2.2;aerial_sun_data.color=(.58,.74,1)
aerial_sun_data.angle=.24
aerial_sun=bpy.data.objects.new(aerial_sun_data.name,aerial_sun_data);aerial_rig.objects.link(aerial_sun);aerial_sun.rotation_euler=(.45,-.35,-.5)
aerial_scene.render.resolution_x=1600;aerial_scene.render.resolution_y=1100
aerial_scene.view_settings.exposure=1.35
aerial_scene.render.filepath=str(ROOT/'blender'/'city-aerial-preview.png')
sys.path.insert(0,str(ROOT/'blender'))
from build_blueprint import build_blueprint_scene
if 'blueprint' not in layout:
    raise RuntimeError('The shared layout must include its authoritative structural blueprint before export.')
blueprint_scene=build_blueprint_scene(layout,layout['blueprint'],ROOT/'blender')
for name,record in preserved_views['cameras'].items():
    obj=bpy.data.objects.get(name)
    if not obj:
        data=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,data);RIG.objects.link(obj)
    obj.matrix_world=Matrix(record['matrix'])
    for key,value in record.items():
        if key!='matrix':setattr(obj.data,key,value)
for name,camera_name in preserved_views['scenes'].items():
    if name in bpy.data.scenes and camera_name in bpy.data.objects:bpy.data.scenes[name].camera=bpy.data.objects[camera_name]
if preserved_views['cameras']:
    record=bpy.data.texts.new('VESPER / preserved scene viewpoints.json');record.write(json.dumps(preserved_views,indent=2));record.use_fake_user=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'neon-district-city.blend'),compress=True)
print('CITY_COMPLETE',scene['city_box_count'],'voxel modules,',len(layout['signs']),'editable signs,',len(bpy.data.objects),'objects')
if '--skip-render' not in sys.argv:
    bpy.ops.render.render(write_still=True,scene=scene.name)
    # A second render shows the full expanded street network and neighborhood scale.
    bpy.ops.render.render(write_still=True,scene=aerial_scene.name)
    bpy.ops.render.render(write_still=True,scene=blueprint_scene.name)
from verify_city import verify_city
verify_city(ROOT)
