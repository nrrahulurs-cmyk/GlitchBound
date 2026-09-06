"""Focused hero export, editable pose workshop, and fresh-reopen verification.

Called by build_assets.py --hero-only. Other GLBs and the complete city are not
regenerated. The existing asset-kit scene receives only the new hero subtree.
"""
from pathlib import Path
import hashlib
import json
import math
import bpy
from mathutils import Vector, Matrix

ROOT_NAME='VEX / VOXEL MERCENARY'
SOURCE_TEXT='VEX / articulated hero source.json'


def descendants(root):
    result=[root]
    for child in root.children:result.extend(descendants(child))
    return result


def clone_tree(root,collection):
    copies={}
    for original in descendants(root):
        copy=original.copy();copy.data=original.data
        collection.objects.link(copy);copies[original]=copy
        if original is not root:copy.parent=copies[original.parent]
    return copies[root]


def solve_leg(horizontal,vertical):
    upper,lower=.29,.34
    distance=math.hypot(horizontal,vertical)
    assert abs(upper-lower)<distance<=upper+lower+1e-8,'Workshop target outside rigid link reach'
    knee=-math.acos(max(-1,min(1,(distance*distance-upper*upper-lower*lower)/(2*upper*lower))))
    hip=math.atan2(horizontal,vertical)-math.atan2(lower*math.sin(knee),upper+lower*math.cos(knee))
    return hip,knee,-hip-knee


def pose_records():
    records=[{'id':'HERO-IDLE','location':[0,0,0],'angles':{},'feet':{'left':[0,0],'right':[0,0]},'stepCount':0}]
    for index,(identity,advance,rise,leading) in enumerate([
        ('HERO-ONE-RISER',0,0,'left'),('HERO-TWO-RISERS',.36,.18,'right')],1):
        record={'id':identity,'location':[index*1.65,advance,rise-.045],'angles':{},'feet':{},'stepCount':index}
        for side in ['left','right']:
            forward=.37 if side==leading else (0 if index==1 else .01)
            foot_height=rise+.18 if side==leading else rise
            hip_height=record['location'][2]+.83
            angles=solve_leg(forward,hip_height-(foot_height+.20))
            for part,angle in zip([side+'_leg',side+'_knee',side+'_foot'],angles):record['angles'][part]=angle
            record['feet'][side]=[record['location'][1]+forward,foot_height]
        records.append(record)
    return records


def apply_pose(root,record):
    root.location=record['location'];root['hero_pose_id']=record['id']
    for obj in descendants(root):
        part=obj.get('hero_part')
        if part:obj.rotation_euler=(record['angles'].get(part,0),0,0)


def palette_record(palette):
    result={}
    for name,mat in palette.items():
        shader=mat.node_tree.nodes.get('Principled BSDF')
        result[name]={key:list(shader.inputs[key].default_value) if key in ['Base Color','Emission Color'] else shader.inputs[key].default_value
                      for key in ['Base Color','Metallic','Roughness','Emission Color','Emission Strength']}
    return result


def source_matrix(source,pose,part):
    chain=[];node=part
    while node:
        chain.append(node);node=source['contract']['parents'].get(node)
    matrix=Matrix.Translation(Vector(pose['location']))
    pivots=source['contract']['pivots']
    for node in reversed(chain):
        parent=source['contract']['parents'].get(node)
        local=Vector(pivots[node])-(Vector(pivots[parent]) if parent else Vector())
        matrix=matrix@Matrix.Translation(local)@Matrix.Rotation(pose['angles'].get(node,0),4,'X')
    return matrix


def verify_workshop(source):
    scene=bpy.data.scenes['VEX / articulated hero inspection'];bpy.context.window.scene=scene
    scene.frame_set(1);bpy.context.view_layer.update()
    checks=[]
    for pose in source['poses']:
        root=next(obj for obj in scene.objects if obj.get('hero_pose_id')==pose['id'])
        objects={obj['hero_part']:obj for obj in descendants(root) if obj.get('hero_part')}
        assert set(objects)==set(source['contract']['pivots'])
        error=0;vertices=0;faces=0
        for part,obj in objects.items():
            records=[record for record in source['boxes'] if record['part']==part]
            assert len(obj.data.vertices)==len(records)*8 and len(obj.data.polygons)==len(records)*6
            expected_parent=source['contract']['parents'].get(part)
            assert obj.parent is (objects[expected_parent] if expected_parent else root)
            transform=source_matrix(source,pose,part);pivot=Vector(source['contract']['pivots'][part])
            for index,record in enumerate(records):
                for j,point in enumerate(record['vertices']):
                    expected=transform@(Vector(point)-pivot)
                    actual=obj.matrix_world@obj.data.vertices[index*8+j].co
                    error=max(error,(actual-expected).length);vertices+=1
                for face in obj.data.polygons[index*6:(index+1)*6]:
                    material=obj.data.materials[face.material_index]
                    expected=source['palette'][record['material']]
                    shader=material.node_tree.nodes.get('Principled BSDF')
                    assert shader and material.name.split('.')[0]==record['material']
                    for key,value in expected.items():
                        socket=shader.inputs[key];assert not socket.is_linked
                        actual=socket.default_value
                        delta=max(abs(actual[i]-value[i]) for i in range(len(value))) if isinstance(value,list) else abs(actual-value)
                        assert delta<1e-6,'Wrong saved hero material '+part+' '+key
                    faces+=1
        assert error<1e-5,'Wrong saved hero pose '+pose['id']+' '+str(error)
        sole_checks=[]
        for side in ['left','right']:
            foot=objects[side+'_foot']
            points=[foot.matrix_world@v.co for v in foot.data.vertices]
            sole=[p for p in points if p.z<min(q.z for q in points)+.00001]
            intended=pose['feet'][side][1]
            assert abs(min(p.z for p in points)-intended)<1e-5
            assert max(p.z for p in sole)-min(p.z for p in sole)<1e-5
            sole_checks.append({'side':side,'height':min(p.z for p in points),'targetHeight':intended})
        checks.append({'pose':pose['id'],'vertices':vertices,'faces':faces,'maximumWorldError':error,'soles':sole_checks})
    return checks


def verify_rejects_mutations(source):
    """Actual saved-object mutations must fail the same source verifier."""
    scene=bpy.data.scenes['VEX / articulated hero inspection']
    root=next(obj for obj in scene.objects if obj.get('hero_pose_id')=='HERO-IDLE')
    knee=next(obj for obj in descendants(root) if obj.get('hero_part')=='left_knee')
    material=knee.data.materials[knee.data.polygons[0].material_index]
    shader=material.node_tree.nodes.get('Principled BSDF')
    checks=[]
    def reject(name,mutate,restore):
        mutate()
        try:
            try:verify_workshop(source)
            except AssertionError:checks.append({'mutation':name,'rejected':True})
            else:raise RuntimeError('Hero verifier accepted mutation: '+name)
        finally:restore()
    angle=knee.rotation_euler.x
    reject('knee transform displaced',lambda:setattr(knee.rotation_euler,'x',angle+.10),lambda:setattr(knee.rotation_euler,'x',angle))
    slot=knee.data.polygons[0].material_index
    # frame_set/depsgraph refresh can invalidate a cached MeshPolygon wrapper;
    # address the original mesh and polygon index again when restoring it.
    reject('wrong saved face material slot',lambda:setattr(knee.data.polygons[0],'material_index',(slot+1)%len(knee.data.materials)),lambda:setattr(knee.data.polygons[0],'material_index',slot))
    color=tuple(shader.inputs['Base Color'].default_value)
    reject('wrong saved material color',lambda:setattr(shader.inputs['Base Color'],'default_value',(1,0,0,1)),lambda:setattr(shader.inputs['Base Color'],'default_value',color))
    rough=shader.inputs['Roughness'].default_value
    reject('wrong saved material roughness',lambda:setattr(shader.inputs['Roughness'],'default_value',rough+.01),lambda:setattr(shader.inputs['Roughness'],'default_value',rough))
    verify_workshop(source)
    return checks


def stage_box(collection,name,center,size,color):
    vertices=[(center[0]+x*size[0]/2,center[1]+y*size[1]/2,center[2]+z*size[2]/2)
              for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    material=bpy.data.materials.new(name+' finish');material.use_nodes=True
    shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.86
    mesh.materials.append(material);obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj)
    return obj


def build_stage(scene,source):
    stage=bpy.data.collections.new('02 POSE SUPPORTS / .18 m risers');scene.collection.children.link(stage)
    stage_box(stage,'Matte inspection ground',(1.65,.2,-.08),(6.2,3.1,.16),(.07,.10,.14))
    for pose in source['poses']:
        x=pose['location'][0]
        for tread in range(pose['stepCount']):
            height=.18*(tread+1)
            stage_box(stage,pose['id']+' / tread '+str(tread+1),(x,.48+tread*.36,height/2),(1.0,.36,height),(.20,.24,.27))
        text=bpy.data.curves.new(pose['id'],'FONT');text.body=pose['id'].replace('HERO-','').replace('-',' ')
        text.size=.10;text.align_x='CENTER';obj=bpy.data.objects.new(pose['id']+' / label',text);stage.objects.link(obj)
        obj.location=(x,1.17,.004);obj.rotation_euler.z=math.pi
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    world=bpy.data.worlds.new('Hero neutral inspection world');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.18,.22,.29,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;scene.world=world
    for name,position,power,color in [('Warm key',(0,3,5),900,(1,.83,.67)),('Cool fill',(4,-2,4),700,(.50,.76,1))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=4;data.color=color
        obj=bpy.data.objects.new(name,data);stage.objects.link(obj);obj.location=position
        obj.rotation_euler=(Vector((1.65,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    for name,position,target,scale in [('Hero three poses',(6,7,4.4),(1.65,.12,1),5.8),
                                       ('Hero knee and ankle',(4.3,3,1.2),(1.65,.12,.6),1.7),
                                       ('Hero side articulation',(5.5,.0,1.6),(1.65,.20,.83),2.8)]:
        data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale
        obj=bpy.data.objects.new(name,data);stage.objects.link(obj);obj.location=position
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.camera=bpy.data.objects['Hero three poses']


def hero_metadata(root,path,contract):
    root.location=(0,0,0);bpy.context.view_layer.update()
    meshes=[obj for obj in descendants(root) if obj.type=='MESH']
    points=[obj.matrix_world@v.co for obj in meshes for v in obj.data.vertices]
    lo=[min(v[i] for v in points) for i in range(3)];hi=[max(v[i] for v in points) for i in range(3)]
    return {'blender_min':lo,'blender_max':hi,'gltf_min':[lo[0],lo[2],-hi[1]],'gltf_max':[hi[0],hi[2],-lo[1]],
            'vertices':sum(len(obj.data.vertices) for obj in meshes),'faces':sum(len(obj.data.polygons) for obj in meshes),
            'material_count':sum(len(obj.data.materials) for obj in meshes),'file_bytes':path.stat().st_size,
            'hierarchy':[obj.name for obj in descendants(root)],'articulation':contract}


def patch_kit(root_path,workshop_path,source):
    kit=root_path/'blender/cyberpunk-assets.blend'
    bpy.ops.wm.open_mainfile(filepath=str(kit))
    old=bpy.data.objects[ROOT_NAME];location=old.matrix_world.copy();collections=list(old.users_collection)
    def unrelated_snapshot(hero):
        excluded=set(descendants(hero));records=[]
        for obj in sorted(bpy.data.objects,key=lambda o:o.name):
            if obj in excluded:continue
            entry={'name':obj.name,'type':obj.type,'parent':obj.parent.name if obj.parent else None,
                   'matrix':[list(row) for row in obj.matrix_world],'hideRender':obj.hide_render}
            if obj.type=='MESH':
                entry['vertices']=[list(v.co) for v in obj.data.vertices]
                entry['faces']=[{'indices':list(f.vertices),'material':f.material_index} for f in obj.data.polygons]
                entry['materials']=[]
                for material in obj.data.materials:
                    shader=material.node_tree.nodes.get('Principled BSDF')
                    entry['materials'].append({'name':material.name,'values':{key:list(shader.inputs[key].default_value) if key in ['Base Color','Emission Color'] else shader.inputs[key].default_value
                         for key in ['Base Color','Metallic','Roughness','Emission Color','Emission Strength']}})
            elif obj.type=='LIGHT':entry['light']={'type':obj.data.type,'energy':obj.data.energy,'color':list(obj.data.color)}
            elif obj.type=='CAMERA':entry['camera']={'type':obj.data.type,'lens':obj.data.lens,'orthoScale':obj.data.ortho_scale}
            records.append(entry)
        return hashlib.sha256(json.dumps(records,sort_keys=True,separators=(',',':')).encode()).hexdigest(),len(records)
    before_snapshot,unrelated_count=unrelated_snapshot(old)
    for obj in reversed(descendants(old)):bpy.data.objects.remove(obj,do_unlink=True)
    names=[ROOT_NAME]+list(source['contract']['pivots'])
    with bpy.data.libraries.load(str(workshop_path),link=False) as (src,dst):dst.objects=[name for name in src.objects if name in names]
    appended=[obj for obj in dst.objects if obj];hero=next(obj for obj in appended if obj.name==ROOT_NAME)
    for obj in appended:
        for collection in collections:collection.objects.link(obj)
    hero.matrix_world=location;hero['hero_pose_id']='ASSET-KIT-HERO'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(kit),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(kit));bpy.context.view_layer.update()
    saved=bpy.data.objects[ROOT_NAME];parts={obj.get('hero_part'):obj for obj in descendants(saved) if obj.get('hero_part')}
    assert set(parts)==set(source['contract']['pivots'])
    inverse=saved.matrix_world.inverted();maximum=0
    for part,obj in parts.items():
        boxes=[box for box in source['boxes'] if box['part']==part]
        expected=[vertex for box in boxes for vertex in box['vertices']]
        assert len(expected)==len(obj.data.vertices)
        for vertex,point in zip(obj.data.vertices,expected):maximum=max(maximum,((inverse@obj.matrix_world@vertex.co)-Vector(point)).length)
        for index,box in enumerate(boxes):
            for face in obj.data.polygons[index*6:(index+1)*6]:
                material=obj.data.materials[face.material_index];shader=material.node_tree.nodes.get('Principled BSDF')
                assert material.name.split('.')[0]==box['material']
                for key,value in source['palette'][box['material']].items():
                    socket=shader.inputs[key];assert not socket.is_linked
                    actual=socket.default_value
                    assert (max(abs(actual[i]-value[i]) for i in range(len(value))) if isinstance(value,list) else abs(actual-value))<1e-6
    assert maximum<1e-5
    after_snapshot,_=unrelated_snapshot(saved)
    assert after_snapshot==before_snapshot,'Focused export changed another asset, light, camera or gallery transform'
    return {'sha256':hashlib.sha256(kit.read_bytes()).hexdigest(),'bytes':kit.stat().st_size,'maximumRestWorldError':maximum,'heroParts':len(parts),
            'unrelatedObjectsPreserved':unrelated_count,'unrelatedObjectGeometryMaterialTransformSHA256':after_snapshot,'heroFaceMaterialsVerified':True}


def build_focused_hero(root_path,factory,palette,render=False):
    root_path=Path(root_path);hero=factory();bpy.context.view_layer.update()
    contract=json.loads(hero['hero_articulation'])
    source={'contract':contract,'boxes':json.loads(hero['hero_box_records']),'palette':palette_record(palette),'poses':pose_records()}
    export_path=root_path/'public/assets/mercenary.glb'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in descendants(hero):obj.select_set(True)
    bpy.context.view_layer.objects.active=hero
    bpy.ops.export_scene.gltf(filepath=str(export_path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False,export_extras=True)
    metadata=hero_metadata(hero,export_path,contract)
    scene=bpy.context.scene;scene.name='VEX / articulated hero inspection'
    hero_collection=hero.users_collection[0]
    roots=[hero]+[clone_tree(hero,hero_collection) for _ in source['poses'][1:]]
    for obj,pose in zip(roots,source['poses']):apply_pose(obj,pose)
    build_stage(scene,source)
    text=bpy.data.texts.new(SOURCE_TEXT);text.write(json.dumps(source,separators=(',',':')))
    workshop=root_path/'blender/hero-pose-workshop.blend'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(workshop),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(workshop))
    fresh=json.loads(bpy.data.texts[SOURCE_TEXT].as_string());assert fresh==source
    checks=verify_workshop(fresh)
    negative_checks=verify_rejects_mutations(fresh)
    kit=patch_kit(root_path,workshop,source)
    manifest_path=root_path/'blender/asset-manifest.json';manifest=json.loads(manifest_path.read_text())
    manifest['mercenary']=metadata;manifest_path.write_text(json.dumps(manifest,indent=2))
    report={'status':'passed','method':'Focused authored hero GLB; compressed pose workshop and asset-kit hero replacement, both freshly reopened. No complete-city regeneration.',
            'glbSHA256':hashlib.sha256(export_path.read_bytes()).hexdigest(),'workshopSHA256':hashlib.sha256(workshop.read_bytes()).hexdigest(),
            'workshopBytes':workshop.stat().st_size,'contract':contract,'modules':len(source['boxes']),'poseChecks':checks,'authoredPoses':source['poses'],
            'negativeVerifierControls':negative_checks,'assetKit':kit,
            'renderStatus':'pending','scope':'Three authored rigid-link poses, not accepted live gait. Non-leg geometry and rest bounds are checked separately against the published GLB.'}
    report_path=root_path/'validation/hero-articulation-native.json';report_path.write_text(json.dumps(report,indent=2))
    print('HERO_ARTICULATION '+json.dumps({k:v for k,v in report.items() if k not in ['contract','poseChecks']}),flush=True)
    if render:
        bpy.ops.wm.open_mainfile(filepath=str(workshop));scene=bpy.data.scenes['VEX / articulated hero inspection'];bpy.context.window.scene=scene
        scene.render.filepath=str(root_path/'blender/hero-pose-preview.png');bpy.ops.render.render(write_still=True)
