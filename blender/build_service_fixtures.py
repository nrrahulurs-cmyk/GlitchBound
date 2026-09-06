"""Editable voxel service mechanisms, with success and interruption previews.

Run node scripts/export-service-fixtures.mjs first, then:
blender --background --python blender/build_service_fixtures.py
The standalone scene includes actual supporting facade parts. All placements
and key samples derive from the runtime recipe; light/steam are visual effects.
"""
from pathlib import Path
from datetime import datetime, timezone
import bpy, json, math, hashlib
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
data=json.loads((ROOT/'blender/service-fixtures.json').read_text(encoding='utf8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.name='VESPER / exterior service mechanisms'
scene.render.fps=data['fps']
scene.frame_start=1
scene.frame_end=max(f['frame'] for r in data['recipes'] for f in r['frames'])
scene.unit_settings.system='METRIC'
scene.world=bpy.data.worlds.new('Service workshop / neutral fill')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.07,.105,.14,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
materials={}

def xyz(x,y,z): return (x,-z,y)
def linear(color):
    values=[int(color.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)
def material(color,emissive=False,unique=None):
    key=unique or (color,emissive)
    if key in materials:return materials[key]
    mat=bpy.data.materials.new('Service / '+str(unique or color))
    mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF')
    col=(*linear(color),1)
    mat.diffuse_color=col
    shader.inputs['Base Color'].default_value=col
    shader.inputs['Roughness'].default_value=.57
    shader.inputs['Metallic'].default_value=.46
    if emissive:
        shader.inputs['Emission Color'].default_value=col
        shader.inputs['Emission Strength'].default_value=.35
    materials[key]=mat
    return mat

unit=bpy.data.meshes.new('Service / unit voxel')
unit.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
unit.update()

def make_box(part,collection,context=False):
    obj=bpy.data.objects.new(part['id'],unit.copy())
    collection.objects.link(obj)
    obj.location=xyz(part['x'],part['y'],part['z'])
    obj.scale=(part['sx'],part['sz'],part['sy'])
    obj.rotation_euler.z=part.get('ry',0)
    color=part.get('color',part.get('c','#71858c'))
    emissive=part.get('emissive',part.get('kind') in ('window','glow'))
    mat=material(color,emissive,part['id'] if emissive and not context else None)
    obj.data.materials.append(mat)
    obj['partGroup']=part.get('partGroup','context')
    obj['collisionSolid']=part.get('solid',True)
    obj['runtimeSourceId']=part['id']
    obj['attachmentRole']=part.get('role','context')
    return obj

records=[]
for recipe in data['recipes']:
    collection=bpy.data.collections.new(recipe['id']+' / '+recipe['label'])
    scene.collection.children.link(collection)
    origin=bpy.data.objects.new(recipe['id']+' / wall anchor',None)
    collection.objects.link(origin)
    origin.location=xyz(**recipe['origin'])
    origin.empty_display_type='PLAIN_AXES'
    origin.empty_display_size=.25
    origin['hostBuilding']=recipe['hostBuilding']
    origin['runtimeRecipeHash']=data['sourceHash']
    origin['durationSeconds']=recipe['duration']
    for part in recipe['context']:make_box(part,collection,True)
    parts={p['id']:make_box(p,collection) for p in recipe['parts']}
    for frame in recipe['frames']:
        for name,x,y,z,yaw,intensity in frame['parts']:
            obj=parts[name]
            obj.location=xyz(x,y,z)
            obj.rotation_euler.z=yaw
            obj.keyframe_insert('location',frame=frame['frame'])
            obj.keyframe_insert('rotation_euler',frame=frame['frame'])
            if next(p for p in recipe['parts'] if p['id']==name).get('emissive'):
                value=obj.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
                value.default_value=intensity
                value.keyframe_insert('default_value',frame=frame['frame'])
    records.append({'id':recipe['id'],'parts':len(parts),'contextParts':len(recipe['context']),'samples':len(recipe['frames'])})

for obj in bpy.data.objects:
    if obj.animation_data and obj.animation_data.action:
        action=obj.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for point in curve.keyframe_points:point.interpolation='LINEAR'

rig=bpy.data.collections.new('Service workshop / inspection cameras and lights')
scene.collection.children.link(rig)
for service_type in ['food','clinic','garage','recharge','wayfinding']:
    recipe=next(r for r in data['recipes'] if r['type']==service_type)
    distance=9 if service_type=='garage' else 5
    origin=recipe['origin'];n=recipe['normal']
    center=Vector(xyz(origin['x']+n['x']*1.8,origin['y']+1.55,origin['z']+n['z']*1.8))
    camdata=bpy.data.cameras.new('Service camera / '+service_type)
    cam=bpy.data.objects.new('Service camera / '+service_type,camdata);rig.objects.link(cam)
    cam.location=xyz(origin['x']+n['x']*distance+math.cos(recipe['ry'])*3,origin['y']+3.2,origin['z']+n['z']*distance-math.sin(recipe['ry'])*3)
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=42
    camdata.clip_end=2000
    if service_type=='food':scene.camera=cam
    lampdata=bpy.data.lights.new('Service softbox / '+service_type,'AREA');lampdata.energy=600;lampdata.shape='DISK';lampdata.size=5
    lamp=bpy.data.objects.new(lampdata.name,lampdata);rig.objects.link(lamp);lamp.location=cam.location+Vector((0,0,3));lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler()

notes=bpy.data.texts.new('SERVICE MECHANISMS / read me')
notes.write('Shared source: src/service-fixtures.js\nSource SHA256: '+data['sourceHash']+'\n'+
    'Frame 1: resting physical assemblies. After frame 21: full service action, success hold and retraction. Later frames: restart and cancellation at 55%.\n'+
    'Facade geometry is exact context from the city. These are exterior mechanisms; no doorway interior is implied.\n'+
    'Cannon bodies in the web game are static or kinematic box compounds. Native animation is editable, linearly interpolated 20 Hz pose samples; procedural beam/steam effects are represented in the companion JSON and remain runtime effects.\n')
scene.timeline_markers.new('REST / attached mechanisms',frame=1)
scene.timeline_markers.new('START / shared service progress',frame=21)
scene.frame_set(1)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16
scene.render.resolution_x=960;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.view_settings.view_transform='AgX'
path=ROOT/'blender/service-actions.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(path))
bpy.ops.wm.open_mainfile(filepath=str(path))
expected={p['id']:p for r in data['recipes'] for p in r['parts']}
maximum=0
for name,p in expected.items():
    obj=bpy.data.objects[name]
    want=Vector(xyz(p['x'],p['y'],p['z']))
    maximum=max(maximum,(obj.location-want).length)
    if not all(math.isfinite(v) for v in obj.location):raise ValueError('Nonfinite saved object '+name)
if maximum>1e-4:raise ValueError('Native rest pose differs by '+str(maximum))
frames={}
for recipe in data['recipes']:
    for frame in recipe['frames']:
        frames.setdefault(frame['frame'],[]).extend(frame['parts'])
pose_error=0
emission_error=0
sample_count=0
max_movement=0
for frame,samples in sorted(frames.items()):
    bpy.context.scene.frame_set(frame)
    for name,x,y,z,yaw,intensity in samples:
        obj=bpy.data.objects[name]
        pose_error=max(pose_error,(obj.location-Vector(xyz(x,y,z))).length,abs(obj.rotation_euler.z-yaw))
        rest=expected[name]
        max_movement=max(max_movement,(obj.location-Vector(xyz(rest['x'],rest['y'],rest['z']))).length)
        if rest.get('emissive'):
            value=obj.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value
            emission_error=max(emission_error,abs(value-intensity))
        sample_count+=1
if pose_error>1e-4 or emission_error>1e-4 or max_movement<.4:
    raise ValueError('Native animation verification failed: '+str((pose_error,emission_error,max_movement)))
bpy.context.scene.frame_set(1)
report={'status':'passed','checkedAtUTC':datetime.now(timezone.utc).isoformat(),'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
    'sourceHash':data['sourceHash'],'bytes':path.stat().st_size,'sites':records,'partCount':len(expected),'restPoseMaximumErrorMetres':maximum,
    'animationSamplesVerified':sample_count,'animationMaximumPoseError':pose_error,'animationMaximumEmissionError':emission_error,'maximumAuthoredMovementMetres':max_movement,
    'fps':data['fps'],'blender':bpy.app.version_string,'limits':'Editable 20 Hz pose samples. Runtime beam and steam are described in JSON, not baked volumetrics. No render quality claim.'}
(ROOT/'validation/native-service-actions.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report))
