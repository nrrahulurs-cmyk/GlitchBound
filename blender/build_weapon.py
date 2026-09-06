"""Author/export the M-09 voxel carbine and angular projectile effects in Blender.

All design coordinates use glTF metres: X right, Y up, -Z firing direction.
Blender geometry converts to (x,-z,y); each GLB is exported at its local origin.
Run: blender --background --python blender/build_weapon.py
"""
from pathlib import Path
from datetime import datetime, timezone
import bpy
import hashlib
import json
import math
import random
import struct
import sys
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/assets'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.name='M-09 / weapon workshop'
PALETTE={}

def material(name,color,metal=.7,rough=.36,emission=0):
    m=bpy.data.materials.new('M09 / '+name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    PALETTE[name]=m;return m

material('navy',(.022,.047,.073),.78,.31)
material('ceramic',(.042,.082,.111),.62,.4)
material('steel',(.19,.27,.31),.86,.28)
material('bright steel',(.42,.53,.56),.9,.24)
material('rubber',(.009,.019,.025),.08,.9)
material('black',(.006,.009,.015),.3,.56)
material('cyan',(.025,.76,.95),.35,.28,2.5)
material('white',(.68,.94,1),.2,.24,3.2)
material('amber',(1,.39,.06),.5,.35,.8)
material('magenta',(.75,.045,.25),.45,.35,.65)
material('markings',(.7,.8,.78),.3,.5)

def xyz(p):return(p[0],-p[2],p[1])
def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
def empty(name,coll,parent=None,position=(0,0,0)):
    obj=bpy.data.objects.new(name,None);coll.objects.link(obj);obj.parent=parent;obj.location=xyz(position)
    obj.empty_display_type='PLAIN_AXES';obj.empty_display_size=.035;return obj

class Mesh:
    def __init__(self,name,coll,parent=None,pivot=(0,0,0)):
        self.name=name;self.coll=coll;self.parent=parent;self.pivot=pivot;self.vertices=[];self.faces=[];self.materials=[];self.slots=[];self.boxes=0
    def box(self,pos,size,mat,rx=0,ry=0,rz=0):
        start=len(self.vertices);self.boxes+=1
        for ax,ay,az in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
            x,y,z=ax*size[0]/2,ay*size[1]/2,az*size[2]/2
            y,z=y*math.cos(rx)-z*math.sin(rx),y*math.sin(rx)+z*math.cos(rx)
            x,z=x*math.cos(ry)+z*math.sin(ry),-x*math.sin(ry)+z*math.cos(ry)
            x,y=x*math.cos(rz)-y*math.sin(rz),x*math.sin(rz)+y*math.cos(rz)
            self.vertices.append(xyz((pos[0]+x-self.pivot[0],pos[1]+y-self.pivot[1],pos[2]+z-self.pivot[2])))
        self.faces.extend(tuple(start+i for i in face) for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
        if mat not in self.materials:self.materials.append(mat)
        self.slots.extend([self.materials.index(mat)]*6)
        return self
    def finish(self):
        mesh=bpy.data.meshes.new(self.name+' / authored voxels');mesh.from_pydata(self.vertices,[],self.faces)
        for mat in self.materials:mesh.materials.append(PALETTE[mat])
        for face,slot in zip(mesh.polygons,self.slots):face.material_index=slot
        mesh.update();obj=bpy.data.objects.new(self.name,mesh);self.coll.objects.link(obj);obj.parent=self.parent;obj.location=xyz(self.pivot)
        obj['voxelModules']=self.boxes;obj['designCoordinates']='X right / Y up / -Z forward'
        return obj

weapon_coll=collection('01 M-09 / editable gun parts')
weapon=empty('pulse_carbine',weapon_coll)
weapon['asset']='M-09 KESTREL pulse carbine';weapon['forward']=[0,0,-1];weapon['gripOrigin']=[0,0,0]

# Stepped receiver: broad readable silhouette with attached modular plates.
b=Mesh('receiver',weapon_coll,weapon)
b.box((0,.105,-.155),(.144,.126,.39),'navy')
b.box((0,.124,-.159),(.153,.105,.31),'ceramic')
b.box((0,.171,-.16),(.129,.027,.33),'steel')
b.box((0,.043,-.153),(.114,.022,.36),'black')
b.box((0,.023,-.195),(.10,.04,.129),'navy')
for side in[-1,1]:
    b.box((side*.079,.113,-.188),(.013,.083,.214),'navy')
    b.box((side*.087,.08,-.204),(.006,.014,.176),'cyan')
    b.box((side*.087,.151,-.158),(.007,.014,.223),'steel')
    for z in[-.28,-.227,-.174,-.121]:
        b.box((side*.089,.118,z),(.005,.035,.032),'ceramic')
        b.box((side*.092,.138,z+.011),(.005,.007,.007),'bright steel')
    b.box((side*.081,.091,.002),(.015,.044,.058),'steel')
    b.box((side*.091,.104,.004),(.007,.01,.038),'amber')
    for z in[-.035,-.015,.005]:b.box((side*.085,.061,z),(.007,.006,.012),'black')
b.finish()

b=Mesh('shoulder_stock',weapon_coll,weapon)
b.box((0,.115,.11),(.094,.058,.18),'steel')
b.box((0,.146,.116),(.109,.046,.154),'navy')
b.box((0,.08,.165),(.105,.069,.12),'ceramic')
b.box((0,.116,.218),(.12,.142,.025),'rubber')
b.box((0,.171,.211),(.12,.025,.027),'steel')
for side in[-1,1]:
    b.box((side*.056,.126,.133),(.008,.037,.092),'navy')
    b.box((side*.061,.137,.13),(.005,.01,.073),'cyan')
for y in[.062,.083,.104,.125,.146]:b.box((0,y,.233),(.103,.01,.008),'black')
b.finish()

b=Mesh('pistol_grip',weapon_coll,weapon)
b.box((0,.019,.012),(.083,.045,.072),'steel')
for i in range(6):b.box((0,-.014-i*.027,.018+i*.007),(.085,.033,.077),'rubber' if i>0 else 'steel')
b.box((0,-.17,.055),(.098,.02,.092),'navy')
for side in[-1,1]:
    for i in range(5):b.box((side*.044,-.034-i*.025,.02+i*.007),(.008,.01,.062),'ceramic')
    b.box((side*.049,-.116,.043),(.006,.032,.014),'magenta')
b.finish()

# The rectangular trigger guard has an actual opening around the trigger.
b=Mesh('trigger_guard',weapon_coll,weapon)
b.box((0,.025,-.031),(.068,.022,.099),'navy')
b.box((0,-.017,-.07),(.069,.067,.017),'steel')
b.box((0,-.05,-.037),(.069,.015,.08),'steel')
b.box((0,-.022,.004),(.069,.064,.014),'steel')
b.finish()
b=Mesh('trigger',weapon_coll,weapon,(0,.021,-.027))
b.box((0,.007,-.035),(.014,.035,.012),'black')
b.box((0,-.011,-.027),(.014,.017,.024),'bright steel')
trigger=b.finish();trigger['animationAxis']='local X rotation';trigger['pullRadians']=-.16

b=Mesh('magazine',weapon_coll,weapon,(0,.015,-.195))
b.box((0,-.03,-.197),(.073,.086,.111),'steel')
for i in range(5):b.box((0,-.068-i*.031,-.193+i*.004),(.069,.034,.098),'navy')
b.box((0,-.218,-.174),(.085,.018,.12),'steel')
for side in[-1,1]:
    b.box((side*.038,-.104,-.178),(.007,.125,.025),'black')
    for i in range(4):b.box((side*.043,-.06-i*.032,-.18),(.006,.018,.009),'cyan' if i<3 else 'amber')
    for i in range(5):b.box((side*.037,-.061-i*.029,-.215+i*.004),(.006,.008,.026),'ceramic')
magazine=b.finish();magazine['reloadDirection']=[0,-1,.08]

b=Mesh('handguard',weapon_coll,weapon)
b.box((0,.084,-.424),(.129,.091,.192),'navy')
b.box((0,.043,-.411),(.11,.021,.185),'steel')
for side in[-1,1]:
    b.box((side*.069,.101,-.424),(.012,.069,.158),'ceramic')
    b.box((side*.077,.113,-.424),(.007,.01,.164),'cyan')
    for i in range(6):
        z=-.354-i*.027
        b.box((side*.077,.079,z),(.01,.026,.014),'black')
        b.box((side*.083,.067,z),(.007,.005,.013),'steel')
for i in range(7):b.box((0,.03,-.34-i*.027),(.114,.019,.012),'rubber')
b.box((0,.088,-.531),(.109,.079,.031),'steel')
b.finish()

# Four separated barrel walls define a hollow bore; nothing caps the front.
muzzle_y=.103;muzzle_z=-.746
b=Mesh('barrel_and_open_muzzle',weapon_coll,weapon)
for side in[-1,1]:
    b.box((side*.037,muzzle_y,-.626),(.018,.088,.209),'steel')
    b.box((0,muzzle_y+side*.035,-.626),(.061,.018,.209),'navy')
    b.box((side*.047,muzzle_y,-.699),(.008,.019,.049),'cyan')
    b.box((side*.051,muzzle_y,-.729),(.018,.094,.034),'ceramic')
    b.box((0,muzzle_y+side*.044,-.729),(.086,.014,.034),'steel')
    b.box((side*.047,muzzle_y+side*.037,-.737),(.015,.015,.018),'bright steel')
    b.box((side*.037,muzzle_y,-.576),(.02,.091,.016),'black')
    b.box((side*.048,muzzle_y-.025,-.684),(.011,.012,.011),'amber')
b.finish()
muzzle=empty('muzzle_socket',weapon_coll,weapon,(0,muzzle_y,muzzle_z))
muzzle['forward']=[0,0,-1];muzzle['openingMetres']=[.084,.074];muzzle['boreMetres']=[.056,.052]
eject=empty('eject_socket',weapon_coll,weapon,(.095,.144,-.053));eject['direction']=[1,.3,.1]
empty('support_grip_socket',weapon_coll,weapon,(0,.013,-.403))
empty('sight_socket',weapon_coll,weapon,(0,.218,-.129))

b=Mesh('bolt',weapon_coll,weapon,(.079,.143,-.058))
b.box((.082,.143,-.063),(.022,.034,.079),'black')
b.box((.094,.147,-.066),(.012,.013,.067),'bright steel')
b.box((.108,.146,-.046),(.024,.018,.021),'steel')
b.box((.12,.146,-.046),(.005,.014,.014),'amber')
bolt=b.finish();bolt['recoilDirection']=[0,0,1];bolt['travelMetres']=.042

b=Mesh('top_rail_and_sights',weapon_coll,weapon)
b.box((0,.19,-.198),(.066,.018,.48),'black')
for i in range(17):b.box((0,.202,-.422+i*.027),(.087,.015,.012),'steel')
for z in[-.047,-.406]:
    b.box((0,.218,z),(.065,.025,.05),'navy')
    for side in[-1,1]:b.box((side*.027,.24,z),(.012,.043,.029),'steel')
    b.box((0,.26,z),(.065,.011,.029),'steel')
b.box((0,.224,-.406),(.007,.018,.009),'cyan')
for side in[-1,1]:b.box((side*.024,.24,-.047),(.009,.007,.007),'amber')
b.finish()

b=Mesh('status_display',weapon_coll,weapon)
b.box((-.082,.138,-.058),(.017,.053,.071),'black')
b.box((-.092,.14,-.058),(.006,.039,.054),'cyan')
for i in range(3):b.box((-.096,.145-i*.011,-.057),(.004,.005,.028-i*.006),'black')
b.box((-.092,.111,-.052),(.008,.008,.008),'magenta')
b.finish()

# Pixel manufacturer glyphs are physical 2 mm markings bonded to the receiver.
b=Mesh('serial_and_markings',weapon_coll,weapon)
glyphs=['101111101','111101111','111101111']
for side in[-1,1]:
    for letter,pat in enumerate(glyphs):
        for i,cell in enumerate(pat):
            if cell=='1':b.box((side*.089,.146-(i//3)*.005,-.279+letter*.022+(i%3)*.004),(.002,.003,.003),'markings')
    for i in range(5):b.box((side*.09,.056,-.286+i*.008),(.003,.006,.003),'amber' if i<2 else 'markings')
b.finish()

fx_roots={}
fx_collections=[]
def fx_root(name):
    coll=collection('FX / '+name);fx_collections.append(coll);obj=empty(name.replace('-','_'),coll);fx_roots[name]=obj;return coll,obj

coll,obj=fx_root('ion-bolt')
b=Mesh('ion_bolt_core',coll,obj)
b.box((0,0,.018),(.012,.012,.036),'white')
b.box((0,0,.126),(.022,.022,.19),'white')
b.box((0,0,.324),(.03,.026,.22),'cyan')
b.box((0,0,.542),(.019,.019,.228),'cyan')
b.box((0,0,.729),(.009,.009,.17),'cyan')
for side in[-1,1]:
    b.box((side*.022,0,.447),(.013,.009,.113),'amber')
    b.box((0,side*.02,.394),(.009,.012,.105),'steel')
b.finish();obj['forward']=[0,0,-1];obj['noseAtOrigin']=True

coll,obj=fx_root('muzzle-flash')
b=Mesh('angular_muzzle_prongs',coll,obj)
b.box((0,0,-.073),(.017,.017,.146),'white')
b.box((0,0,-.164),(.009,.009,.037),'cyan')
for i,(dx,dy,length) in enumerate([(-1,.15,.135),(.7,.7,.117),(.7,-.8,.09),(-.3,-1,.075),(.15,1,.10)]):
    for step in range(3):
        fraction=(step+1)/3;size=.016-step*.003
        b.box((dx*.041*fraction,dy*.037*fraction,-length*fraction),(size,size,length*.34),'white' if step==0 else 'cyan' if i%2 else 'amber')
b.finish();obj['forward']=[0,0,-1];obj['lifetimeSeconds']=.045

coll,obj=fx_root('impact-shards');rng=random.Random(90817)
for i in range(10):
    angle=i*math.tau/10;direction=Vector((math.cos(angle),.25+rng.random()*.9,math.sin(angle))).normalized()
    pivot=tuple(v*.012 for v in direction);b=Mesh(f'shard_{i:02d}',coll,obj,pivot)
    size=.01+rng.random()*.012
    shade='white' if i<3 else 'cyan' if i<6 else 'amber' if i<9 else 'steel'
    b.box(pivot,(size,size*.65,size*2.1),shade,rx=i*.37,ry=i*.59,rz=i*.21)
    b.box((pivot[0]+size*.3,pivot[1]+size*.2,pivot[2]+size*.65),(size*.58,size*.6,size),shade,ry=i*.59)
    shard=b.finish();shard['burstDirection']=list(direction);shard['burstSpeed']=1.8+rng.random()*2.8;shard['spin']=[rng.uniform(-9,9) for _ in range(3)]
obj['lifetimeSeconds']=.32

assets={'pulse-carbine':weapon,**fx_roots};metadata={}
scene.frame_set(1);bpy.context.view_layer.update()
for name,root in assets.items():
    bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
    for child in root.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=root
    path=OUT/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,
        export_apply=False,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
    meshes=[o for o in root.children_recursive if o.type=='MESH']
    points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box]
    lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
    metadata[name]={'file':name+'.glb','gltf_min':[lo[0],lo[2],-hi[1]],'gltf_max':[hi[0],hi[2],-lo[1]],
        'dimensions':[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),
        'voxelModules':sum(o.get('voxelModules',0) for o in meshes),'fileBytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'nodes':[o.name for o in [root,*root.children_recursive]]}

# Demonstration keyframes stay editable in Blender; the game drives these parts.
for part,axis,values in[(bolt,1,[(1,0),(3,-.042),(8,0),(60,0)]),(magazine,2,[(1,0),(20,0),(29,-.21),(43,-.21),(52,0),(60,0)])]:
    base=part.location[axis]
    for frame,delta in values:part.location[axis]=base+delta;part.keyframe_insert(data_path='location',index=axis,frame=frame)
    part.location[axis]=base
for frame,angle in[(1,0),(3,-.16),(8,0),(60,0)]:trigger.rotation_euler.x=angle;trigger.keyframe_insert(data_path='rotation_euler',index=0,frame=frame)
scene.frame_start=1;scene.frame_end=60;scene.frame_set(1)

# A restrained workshop composition keeps the hollow muzzle and individual parts readable.
for coll in fx_collections:coll.hide_render=True;coll.hide_viewport=True
world=bpy.data.worlds.new('M-09 / workshop night');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.045,.07,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
rig=collection('90 PREVIEW / studio only')
def area(name,position,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);rig.objects.link(o);o.location=xyz(position);o.rotation_euler=(Vector(xyz((0,.04,-.22)))-o.location).to_track_quat('-Z','Y').to_euler()
area('Soft cool key',(.55,1.1,-.2),95,(.5,.78,1),1.2)
area('Warm edge',(-.8,.55,.2),65,(1,.48,.24),.8)
area('Muzzle rim',(-.4,.4,-1),65,(.16,.76,1),.7)
floor_mat=material('studio slate',(.023,.042,.052),.45,.48)
b=Mesh('Workshop backdrop',rig);b.box((0,-.278,-.2),(3,.02,3),'studio slate');b.finish()
def camera(name,position,target,scale):
    data=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,data);rig.objects.link(o);o.location=xyz(position);o.rotation_euler=(Vector(xyz(target))-o.location).to_track_quat('-Z','Y').to_euler();data.type='ORTHO';data.ortho_scale=scale;return o
scene.camera=camera('M-09 / front three-quarter',(.95,.64,-1.06),(0,.015,-.23),1.42)
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=1700;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
scene.render.filepath=str(ROOT/'blender/pulse-carbine-preview.png')
scene['asset_contract']=json.dumps({'coordinateSystem':'glTF metres, -Z forward, Y up','muzzle_socket':[0,muzzle_y,muzzle_z],'eject_socket':[.095,.144,-.053],'noHands':True})
source_text=bpy.data.texts.new('M-09 / asset contract.json');source_text.write(json.dumps(metadata,indent=2));source_text.use_fake_user=True
native_path=ROOT/'blender/pulse-carbine.blend';bpy.ops.wm.save_as_mainfile(filepath=str(native_path))
if '--skip-render' not in sys.argv:bpy.ops.render.render(write_still=True)

# Verify both file formats independently after reopening their saved data.
bpy.ops.wm.open_mainfile(filepath=str(native_path));loaded=bpy.data.objects['pulse_carbine']
for name,expected in [('muzzle_socket',(0,muzzle_y,muzzle_z)),('eject_socket',(.095,.144,-.053))]:
    o=bpy.data.objects[name];actual=(o.location.x,o.location.z,-o.location.y);assert max(abs(a-b) for a,b in zip(actual,expected))<1e-7
assert all(bpy.data.objects.get(name) for name in ['bolt','magazine','trigger'])
assert all(o.parent==loaded for o in loaded.children)
pieces=[]
for part in loaded.children:
    if part.type!='MESH':continue
    for i in range(0,len(part.data.vertices),8):
        vertices=[part.matrix_world@vertex.co for vertex in part.data.vertices[i:i+8]]
        pieces.append((part.name,[min(p[j] for p in vertices) for j in range(3)],[max(p[j] for p in vertices) for j in range(3)]))
joined={next(i for i,p in enumerate(pieces) if p[0]=='receiver')};pending=list(joined)
while pending:
    current=pending.pop()
    for i,piece in enumerate(pieces):
        if i not in joined and all(pieces[current][1][j]<=piece[2][j]+.004 and pieces[current][2][j]>=piece[1][j]-.004 for j in range(3)):
            joined.add(i);pending.append(i)
connected_parts={pieces[i][0] for i in joined}
assert all(part.name in connected_parts for part in loaded.children if part.type=='MESH'), 'A gun component is not attached to the receiver'
for name in assets:
    data=(OUT/(name+'.glb')).read_bytes();length,kind=struct.unpack_from('<II',data,12);gltf=json.loads(data[20:20+length]);nodes=gltf['nodes']
    assert not any(word in n.get('name','').lower() for n in nodes for word in ['sphere','dome'])
    if name=='pulse-carbine':
        named={n['name']:n for n in nodes}
        for socket,expected in [('muzzle_socket',[0,muzzle_y,muzzle_z]),('eject_socket',[.095,.144,-.053])]:
            assert max(abs(a-b) for a,b in zip(named[socket]['translation'],expected))<1e-6
        assert all(part in named for part in ['bolt','magazine','trigger'])
metadata['contract']={'coordinateSystem':'glTF metres; X right, Y up, -Z forward','gripOrigin':[0,0,0],
    'muzzleSocket':{'node':'muzzle_socket','position':[0,muzzle_y,muzzle_z],'direction':[0,0,-1],'opening':[.084,.074],'bore':[.056,.052]},
    'ejectSocket':{'node':'eject_socket','position':[.095,.144,-.053],'direction':[1,.3,.1]},
    'animationParts':{'bolt':{'axis':'local Z','travel':.042},'magazine':{'direction':[0,-1,.08],'travel':.21},'trigger':{'axis':'local X','angle':-.16}},
    'projectile':'ion-bolt nose at origin; trail extends +Z','flash':'muzzle-flash extends -Z from origin; recommended lifetime45ms',
    'impact':'10 individually named shard meshes with burstDirection, burstSpeed and spin extras; recommended lifetime320ms','handsIncluded':False}
metadata['verification']={'status':'passed','checkedAtUTC':datetime.now(timezone.utc).isoformat(),'freshBlendReopen':True,'glbSocketOrientationVerified':True,'separateAnimationNodesVerified':True,
    'gunComponentsConnected':len(connected_parts),'attachmentToleranceMetres':.004,
    'nativeFile':'pulse-carbine.blend','nativeBytes':native_path.stat().st_size,'nativeSHA256':hashlib.sha256(native_path.read_bytes()).hexdigest()}
(ROOT/'blender/weapon-manifest.json').write_text(json.dumps(metadata,indent=2)+'\n')
print('WEAPON_ASSETS_VERIFIED',json.dumps(metadata),flush=True)
