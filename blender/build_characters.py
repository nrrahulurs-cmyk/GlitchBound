"""Build the editable character population and finite-motion workshop.

Prepared builder; generation is an explicit separate operation:
  blender --background --python blender/build_characters.py -- \
    --export path/to/native-characters.json.gz --output path/to/characters.blend

The exporter input must be the accepted current-source capture. This script
never changes city geometry or the original complete-city .blend. It saves a
compressed workshop, reopens it, and checks the evaluated voxel vertices.
Optional --render writes one small workshop preview after reopen verification.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from native_characters import (load_character_export,embed_character_export,load_embedded_export,
    populate_characters,add_workshop_clip,character_materials,verify_character,verify_character_materials,native_point)


def collection(scene,name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def box(group,name,center,size,material):
    mesh = bpy.data.meshes.new(name)
    vertices = [(x*size[0]/2,y*size[1]/2,z*size[2]/2) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh.from_pydata([native_point(v) for v in vertices],[],faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name,mesh)
    obj.location = native_point(center)
    group.objects.link(obj)
    return obj


def material(name,color,metal=0,rough=.75):
    item = bpy.data.materials.new(name)
    item.use_nodes = True
    shader = item.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    return item


def camera(scene,group,name,position,target,ortho):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name,data)
    group.objects.link(obj)
    obj.location = native_point(position)
    obj.rotation_euler = (native_point(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    data.type = 'ORTHO'
    data.ortho_scale = ortho
    data.clip_end = 1600
    scene.camera = obj
    return obj


def configure_scene(scene):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 211
    scene.world = bpy.data.worlds.new(scene.name+' / neutral inspection world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.13,.16,.21,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .5
    scene.view_settings.view_transform = 'AgX'


def light(group,name,position,power,size,color,target):
    data = bpy.data.lights.new(name,'AREA')
    data.energy,data.shape,data.size,data.color = power,'DISK',size,color
    obj = bpy.data.objects.new(name,data)
    obj.location = native_point(position)
    obj.rotation_euler = (native_point(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    group.objects.link(obj)


def find_result(character,role,clip=None):
    rig = next(obj for obj in bpy.data.objects if obj.type=='ARMATURE' and obj.get('character_role')==role and obj.get('civilian_id')==character['id'] and (clip is None or obj.get('workshop_clip_id')==clip['id']))
    mesh = next(obj for obj in rig.children if obj.type=='MESH')
    return {'rig':rig,'mesh':mesh,'character':character,'offset':tuple(rig['native_offset_three'])}


def verify_reopened(output):
    bpy.ops.wm.open_mainfile(filepath=str(output))
    data = load_embedded_export()
    population = bpy.data.scenes['VESPER / exact character population']
    workshop = bpy.data.scenes['VESPER / editable motion workshop']
    bpy.context.window.scene = population
    population.frame_set(1)
    population_checks = [verify_character(find_result(character,'population')) for character in data['characters']]
    material_checks = [verify_character_materials(data,find_result(character,'population')) for character in data['characters']]
    bpy.context.window.scene = workshop
    motion_checks = []
    # Every stored 30 Hz pose is tested after reopening, against actual
    # armature-deformed mesh vertices. This is bounded: only four figures move.
    for clip in data['workshop']['clips']:
        source = next(p for p in data['characters'] if p['id']==clip['sourceCivilianId'])
        character = dict(source)
        character.update(clip['binding'])
        result = find_result(character,'workshop',clip)
        material_checks.append(verify_character_materials(data,result))
        maximum = 0
        for frame in clip['frames']:
            workshop.frame_set(1+round(frame['time']*clip['sampleRate']))
            maximum = max(maximum,verify_character(result,frame=frame)['maximumWorldError'])
        motion_checks.append({'clip':clip['id'],'frames':len(clip['frames']),'maximumWorldError':maximum})
    workshop.frame_set(1)
    assert len(population_checks)==284
    assert len(motion_checks)==4
    assert all(len(obj.modifiers)==1 for obj in population.objects if obj.type=='MESH' and obj.get('character_role')=='population')
    return {'status':'passed','population':len(population_checks),'populationVoxelVertices':sum(p['vertices'] for p in population_checks),'maximumPopulationWorldError':max(p['maximumWorldError'] for p in population_checks),'clips':motion_checks,'materials':{'figures':len(material_checks),'faces':sum(check['faces'] for check in material_checks),'maximumLinearColorError':max(check['maximumLinearColorError'] for check in material_checks),'maximumRoughnessError':max(check['maximumRoughnessError'] for check in material_checks),'maximumMetallicError':max(check['maximumMetallicError'] for check in material_checks)},'sourceHashes':data['sourceHashes'],'method':'Fresh reopen; all population vertices and every finite 30 Hz workshop pose evaluated through saved armature modifiers. Every face material and actual Principled color/roughness/metallic input checked.'}


def build(args):
    data = load_character_export(args.export)
    if not data.get('workshop') or len(data['workshop']['clips'])!=4:
        raise ValueError('Workshop builder requires the four finite exported clips')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    population = bpy.context.scene
    population.name = 'VESPER / exact character population'
    configure_scene(population)
    crowd = collection(population,'284 resolved citizens / exact world placement')
    populate_characters(data,crowd)
    print('CHARACTER_BUILD: 284 exact population rigs created',flush=True)
    setup = collection(population,'Population inspection camera')
    camera(population,setup,'All authored district placements',(300,550,200),(0,0,-210),850)
    population['placement_policy'] = '284 exact resolved runtime frame-zero roots; no layout replacement, interpolation or simplified preview people.'
    workshop = bpy.data.scenes.new('VESPER / editable motion workshop')
    configure_scene(workshop)
    bpy.context.window.scene = workshop
    stage = collection(workshop,'Editable terrain and studio lights')
    figures = collection(workshop,'Four finite planner clips / rigid voxel weights')
    floor = material('Workshop / charcoal rubber',(.027,.037,.052),.12,.78)
    curb = material('Workshop / actual 108 mm pavement step',(.16,.21,.25),.1,.83)
    text_material = material('Workshop / legend',(.55,.75,.83),.05,.8)
    palette = character_materials(data)
    offsets = [(-6,0,-6),(6,0,-6),(-6,0,7),(6,0,7)]
    for index,clip in enumerate(data['workshop']['clips']):
        offset = offsets[index]
        add_workshop_clip(data,clip,figures,offset=offset,materials=palette)
        print('CHARACTER_BUILD: keyed '+clip['id'],flush=True)
        base = clip['terrain']['base']
        box(stage,clip['id']+' / floor',(offset[0],base-.05,offset[2]+4),(10,.1,12),floor)
        platform = clip['terrain']['platform']
        if platform:
            # The physical gait path stays within this cropped viewport of the
            # exported much wider support slab; its top/start height is exact.
            box(stage,clip['id']+' / raised pavement',(offset[0],(base+platform['height'])/2,offset[2]+6.25),(10,platform['height']-base,7.5),curb)
        font = bpy.data.curves.new(clip['id']+' / editable label','FONT')
        font.body = f"{clip['sourceCivilianId']}  |  {clip['mode']}\n30 Hz / {clip['duration']} s / rigid voxel groups"
        font.size,font.extrude = .26,0
        font.materials.append(text_material)
        obj = bpy.data.objects.new(font.name,font)
        obj.location = native_point((offset[0]-4.5,.065,offset[2]-1.5))
        stage.objects.link(obj)
    camera(workshop,stage,'Workshop / all four finite clips',(23,27,30),(0,.9,5),37)
    preview_clip = data['workshop']['clips'][0]
    preview_pose = max((frame for frame in preview_clip['frames'] if .7<=frame['time']<=1.7),key=lambda frame:(Vector((frame['feet'][0]['x'],frame['feet'][0]['z']))-Vector((frame['feet'][1]['x'],frame['feet'][1]['z']))).length)
    preview_x = offsets[0][0]+preview_pose['rootWorldMatrix'][12]
    preview_z = offsets[0][2]+preview_pose['rootWorldMatrix'][14]
    camera(workshop,stage,'Workshop / ordinary gait detail',(preview_x+4,3.1,preview_z+3.8),(preview_x,1,preview_z),4.2)
    workshop.camera = bpy.data.objects['Workshop / all four finite clips']
    light(stage,'Workshop / soft key',(4,15,0),2600,12,(.75,.88,1),(0,0,5))
    light(stage,'Workshop / warm rim',(-12,9,14),1900,9,(1,.62,.42),(0,1,5))
    light(stage,'Workshop / fill',(15,8,20),1600,10,(.4,.85,1),(0,1,5))
    workshop['finite_motion_notes'] = json.dumps(data['workshop']['notes'])
    workshop['close_gait_preview_frame'] = 1+round(preview_pose['time']*30)
    workshop['close_gait_preview_clip'] = preview_clip['id']
    workshop['native_character_source_sha256'] = embed_character_export(data)
    workshop.frame_set(1)
    bpy.context.view_layer.update()
    # Check before saving as well, so a transform error cannot replace a valid
    # prior file. The complete fresh-reopen check follows the compressed save.
    for clip in data['workshop']['clips']:
        source = dict(next(p for p in data['characters'] if p['id']==clip['sourceCivilianId']))
        source.update(clip['binding'])
        verify_character(find_result(source,'workshop',clip),frame=clip['frames'][0])
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
    report = verify_reopened(output)
    report.update({'nativeFile':str(output),'nativeBytes':output.stat().st_size,'nativeSHA256':hashlib.sha256(output.read_bytes()).hexdigest(),'inputExport':str(Path(args.export).resolve()),'inputExportSHA256':hashlib.sha256(Path(args.export).read_bytes()).hexdigest(),'blenderVersion':bpy.app.version_string})
    report_path = Path(args.report).resolve() if args.report else output.with_suffix('.report.json')
    report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    if args.render:
        scene = bpy.context.scene
        scene.camera = bpy.data.objects['Workshop / ordinary gait detail']
        scene.frame_set(scene['close_gait_preview_frame'])
        scene.render.filepath = str(output.with_name(output.stem+'-preview.png'))
        scene.render.image_settings.file_format = 'PNG'
        bpy.ops.render.render(write_still=True)
        report['preview'] = {'file':scene.render.filepath,'camera':scene.camera.name,'frame':scene.frame_current,'clip':scene['close_gait_preview_clip'],'time':(scene.frame_current-1)/30}
        report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':report['status'],'nativeFile':str(output),'nativeBytes':report['nativeBytes'],'population':report['population'],'workshopClips':len(report['clips']),'report':str(report_path)}))


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export',required=True,help='Accepted native-characters JSON or gzip from the portable exporter')
    parser.add_argument('--output',required=True,help='Separate editable character workshop .blend')
    parser.add_argument('--report',help='Fresh-reopen verification JSON path')
    parser.add_argument('--render',action='store_true',help='Render one workshop preview after verification')
    arguments = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    build(parser.parse_args(arguments))
