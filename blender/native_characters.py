"""Editable rigid-voxel citizens from export-native-characters.mjs.

Importing this module does not change a scene. The caller owns collections,
scene selection, saving and rendering. No city geometry is generated here.
"""
from pathlib import Path
import base64
import gzip
import hashlib
import json
import bpy
from mathutils import Matrix, Vector

SOURCE_CORNERS = [Vector(v) for v in [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]]
BOX_FACES = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
C = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
TEXT_NAME = 'VESPER / native character source.json.gz.base64'


def source_matrix(values):
    """JSON Three matrices use column-major storage; mathutils takes rows."""
    if len(values) != 16:
        raise ValueError('Expected a sixteen-element character matrix')
    return Matrix(tuple(tuple(values[col*4+row] for col in range(4)) for row in range(4)))


def native_matrix(values):
    return C @ source_matrix(values) @ C.inverted()


def native_point(point):
    return Vector((point[0],-point[2],point[1]))


def load_character_export(filename):
    path = Path(filename).resolve()
    payload = path.read_bytes()
    data = json.loads(gzip.decompress(payload) if path.suffix == '.gz' else payload)
    if data.get('schema') != 'neon-district-native-characters' or data.get('version') != 1:
        raise ValueError('Unsupported native character export schema')
    if data['counts']['people'] != len(data['characters']):
        raise ValueError('Character count differs from the exported records')
    if data['initialization']['physicsSteps'] != 0:
        raise ValueError('Native placement input must be the resolved frame-zero capture')
    if not data.get('palette'):
        raise ValueError('The explicit scene-linear character palette is required')
    return data


def embed_character_export(data):
    payload = json.dumps(data,separators=(',',':'),ensure_ascii=False).encode('utf8')
    text = bpy.data.texts.get(TEXT_NAME) or bpy.data.texts.new(TEXT_NAME)
    text.clear()
    # Keep the editable Text datablock in short lines; a megabyte-long single
    # line makes Blender's text insertion and later editor opening expensive.
    text.write(base64.encodebytes(gzip.compress(payload,mtime=0)).decode('ascii'))
    text['encoding'] = 'base64(gzip(utf8-json))'
    text['json_sha256'] = hashlib.sha256(payload).hexdigest()
    return text['json_sha256']


def load_embedded_export():
    text = bpy.data.texts[TEXT_NAME]
    payload = gzip.decompress(base64.b64decode(text.as_string()))
    if hashlib.sha256(payload).hexdigest() != text['json_sha256']:
        raise ValueError('Embedded character source checksum does not match')
    return json.loads(payload)


def character_materials(data):
    materials = {}
    for swatch in data['palette']:
        name = 'CITIZEN / ' + swatch['srgbHex']
        material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        material.use_nodes = True
        color = (*swatch['linearRGB'],1)
        material.diffuse_color = color
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = color
        shader.inputs['Metallic'].default_value = .2
        shader.inputs['Roughness'].default_value = .74
        material['authored_srgb'] = swatch['srgbHex']
        materials[swatch['srgbHex']] = material
    return materials


def _attribute(mesh,name,values,data_type='INT'):
    attribute = mesh.attributes.new(name=name,type=data_type,domain='POINT')
    attribute.data.foreach_set('value',values)


def create_character(data,character,collection,*,name_prefix='',materials=None,offset=(0,0,0),role='population'):
    """Return {rig, mesh, character, offset}; one mesh and one armature per figure.

    Mesh vertices are the exact captured part poses expressed in root space.
    Each disconnected box has eight vertices, six quads and a single rigid
    bone weight. The live feet remain separate from the physical shin groups.
    Offsets are supplied in Three's X/Y/Z convention and default to zero.
    """
    materials = materials if materials is not None else character_materials(data)
    template = next(item for item in data['templates'] if item['id'] == character['templateId'])
    name = name_prefix + character['id']
    root = native_matrix(character['rootWorldMatrix'])
    root_inverse = root.inverted()
    translation = Matrix.Translation(native_point(offset))
    vertices,faces,face_colors = [],[],[]
    part_ids,instance_ids,group_ids,physical_ids,motions,umbrellas = [],[],[],[],[],[]
    group_names = [group['name'] for group in character['groups']]
    physical_names = list(dict.fromkeys(part['physicalGroup'] for part in character['parts']))
    weights = {name:[] for name in group_names}
    for part in character['parts']:
        piece = template['pieces'][part['localIndex']]
        transform = root_inverse @ native_matrix(part['worldMatrix'])
        start = len(vertices)
        vertices.extend(transform @ (C @ corner) for corner in SOURCE_CORNERS)
        faces.extend(tuple(start+i for i in face) for face in BOX_FACES)
        face_colors.extend([piece['c']]*6)
        indices = list(range(start,start+8))
        weights[part['group']].extend(indices)
        part_ids.extend([part['localIndex']]*8)
        instance_ids.extend([part['instanceIndex']]*8)
        group_ids.extend([group_names.index(part['group'])]*8)
        physical_ids.extend([physical_names.index(part['physicalGroup'])]*8)
        motions.extend([piece['motion']]*8)
        umbrellas.extend([piece['umbrella']]*8)
    mesh_data = bpy.data.meshes.new(name+' / disconnected authored voxels')
    mesh_data.from_pydata(vertices,[],faces)
    mesh_data.update()
    for attribute,values in [('piece_id',part_ids),('runtime_instance_id',instance_ids),('animation_group',group_ids),('physical_group',physical_ids),('motion_tag',motions)]:
        _attribute(mesh_data,attribute,values)
    _attribute(mesh_data,'umbrella',umbrellas,'BOOLEAN')
    mesh_data['animation_group_names'] = json.dumps(group_names)
    mesh_data['physical_group_names'] = json.dumps(physical_names)
    mesh_data['piece_count'] = len(character['parts'])
    slots = {}
    for color in dict.fromkeys(face_colors):
        slots[color] = len(mesh_data.materials)
        mesh_data.materials.append(materials[color])
    for polygon,color in zip(mesh_data.polygons,face_colors):
        polygon.material_index = slots[color]
        polygon.use_smooth = False
    mesh = bpy.data.objects.new(name+' / editable voxel skin',mesh_data)
    collection.objects.link(mesh)
    armature = bpy.data.armatures.new(name+' / live rigid groups')
    rig = bpy.data.objects.new(name+' / rig',armature)
    collection.objects.link(rig)
    rig.matrix_world = translation @ root
    rig.show_in_front = True
    armature.display_type = 'STICK'
    for obj in (rig,mesh):
        obj['civilian_id'] = character['id']
        obj['character_role'] = role
        obj['template_id'] = character['templateId']
        obj['native_character_version'] = 1
    rig['authored_placement'] = json.dumps(character.get('authored',{}),separators=(',',':'))
    rig['resolved_placement'] = json.dumps(character.get('resolved',{}),separators=(',',':'))
    rig['anatomical_joints_three_world'] = json.dumps(character['joints'],separators=(',',':'))
    rig['native_offset_three'] = tuple(offset)
    rig['rig_contract'] = 'Live 13 body groups plus optional held umbrella; physical deaths use 11 body segments with boot/calf shapes.'

    previous_active = bpy.context.view_layer.objects.active
    previous_selected = list(bpy.context.selected_objects)
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        raise RuntimeError('Character construction requires Object Mode')
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.object.mode_set(mode='EDIT')
        for group in character['groups']:
            bone = armature.edit_bones.new(group['name'])
            # A newly allocated EditBone has zero length. Give it an axis
            # before assigning its matrix, or Blender discards that rotation.
            bone.length = .15 if group['name'].startswith('foot') else .23
            bone.matrix = root_inverse @ native_matrix(group['bindWorldMatrix'])
            bone.use_deform = True
            if group['parent']:
                bone.parent = armature.edit_bones[group['parent']]
                bone.use_connect = False
        bpy.ops.object.mode_set(mode='OBJECT')
    finally:
        if rig.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        rig.select_set(False)
        for selected in previous_selected:
            selected.select_set(True)
        bpy.context.view_layer.objects.active = previous_active
    mesh.parent = rig
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mesh.matrix_basis = Matrix.Identity(4)
    for name,indices in weights.items():
        mesh.vertex_groups.new(name=name).add(indices,1,'REPLACE')
    modifier = mesh.modifiers.new('Rigid authored voxel groups','ARMATURE')
    modifier.object = rig
    modifier.use_deform_preserve_volume = False
    for bone in rig.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.bone['animation_group'] = bone.name
    return {'rig':rig,'mesh':mesh,'character':character,'offset':tuple(offset)}


def populate_characters(data,collection):
    """Create all exact resolved population placements; no animation keys."""
    materials = character_materials(data)
    return [create_character(data,person,collection,materials=materials) for person in data['characters']]


def _curves(rig):
    action = rig.animation_data.action if rig.animation_data else None
    if action is None:
        return []
    if hasattr(action,'fcurves'):
        return action.fcurves
    return action.layers[0].strips[0].channelbag(rig.animation_data.action_slot).fcurves


def add_workshop_clip(data,clip,collection,*,offset=(0,0,0),materials=None):
    """Build one editable figure and key only root/group transforms at 30 Hz."""
    source = next(p for p in data['characters'] if p['id'] == clip['sourceCivilianId'])
    character = dict(source)
    character.update(clip['binding'])
    result = create_character(data,character,collection,name_prefix=clip['mode']+' / ',materials=materials,offset=offset,role='workshop')
    rig = result['rig']
    rig['workshop_clip_id'] = clip['id']
    rig['sample_rate'] = clip['sampleRate']
    rig['planner_rate'] = clip['plannerRate']
    rig['finite_clip_duration'] = clip['duration']
    rig['animation_policy'] = 'Finite accepted-distance planner samples; no cyclic replay and no per-voxel animation.'
    rig['workshop_binding_root_three'] = json.dumps(clip['binding']['rootWorldMatrix'])
    rig.rotation_mode = 'QUATERNION'
    translation = Matrix.Translation(native_point(offset))
    previous_quaternions = {}
    for frame in clip['frames']:
        number = 1 + round(frame['time']*clip['sampleRate'])
        root = native_matrix(frame['rootWorldMatrix'])
        rig.matrix_world = translation @ root
        if 'root' in previous_quaternions and rig.rotation_quaternion.dot(previous_quaternions['root']) < 0:
            rig.rotation_quaternion.negate()
        previous_quaternions['root'] = rig.rotation_quaternion.copy()
        for channel in ('location','rotation_quaternion','scale'):
            rig.keyframe_insert(data_path=channel,frame=number,group='Accepted world root')
        desired = {}
        for group,local in zip(character['groups'],frame['groups']):
            parent = group['parent']
            desired[group['name']] = (desired[parent] if parent else Matrix.Identity(4)) @ native_matrix(local)
            pose_bone = rig.pose.bones[group['name']]
            rest = pose_bone.bone.matrix_local
            if parent:
                parent_rest = rig.pose.bones[parent].bone.matrix_local
                basis = rest.inverted() @ parent_rest @ desired[parent].inverted() @ desired[group['name']]
            else:
                basis = rest.inverted() @ desired[group['name']]
            pose_bone.matrix_basis = basis
            if group['name'] in previous_quaternions and pose_bone.rotation_quaternion.dot(previous_quaternions[group['name']]) < 0:
                pose_bone.rotation_quaternion.negate()
            previous_quaternions[group['name']] = pose_bone.rotation_quaternion.copy()
            for channel in ('location','rotation_quaternion','scale'):
                pose_bone.keyframe_insert(data_path=channel,frame=number,group=group['name'])
    for curve in _curves(rig):
        curve.extrapolation = 'CONSTANT'
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
    result['clip'] = clip
    return result


def verify_character(result,*,frame=None,tolerance=.0002):
    """Check evaluated mesh vertices, not merely saved bone/property metadata.

    For a workshop frame, pass its exported frame record after scene.frame_set.
    This is suitable for a fresh reopen because it reads the saved modifier rig.
    """
    character,mesh = result['character'],result['mesh']
    translation = Matrix.Translation(native_point(result.get('offset',(0,0,0))))
    group_world = {}
    if frame is not None:
        root = source_matrix(frame['rootWorldMatrix'])
        for group,local in zip(character['groups'],frame['groups']):
            group_world[group['name']] = (group_world[group['parent']] if group['parent'] else root) @ source_matrix(local)
    bpy.context.view_layer.update()
    evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    snapshot = evaluated.to_mesh()
    maximum = 0
    try:
        if len(snapshot.vertices) != len(character['parts'])*8:
            raise AssertionError('Voxel topology changed for '+character['id'])
        for index,part in enumerate(character['parts']):
            world = group_world[part['group']] @ source_matrix(part['localBindMatrix']) if frame is not None else source_matrix(part['worldMatrix'])
            for corner_index,corner in enumerate(SOURCE_CORNERS):
                expected = translation @ C @ world @ corner
                actual = evaluated.matrix_world @ snapshot.vertices[index*8+corner_index].co
                maximum = max(maximum,(expected-actual).length)
        if maximum > tolerance:
            raise AssertionError(f"{character['id']} native voxel drift {maximum:.9g} m exceeds {tolerance} m")
    finally:
        evaluated.to_mesh_clear()
    return {'id':character['id'],'vertices':len(character['parts'])*8,'maximumWorldError':maximum}


def verify_character_materials(data,result,*,tolerance=1e-6):
    """Inspect each saved face assignment and its actual render shader inputs."""
    character,mesh = result['character'],result['mesh'].data
    template = next(item for item in data['templates'] if item['id']==character['templateId'])
    palette = {item['srgbHex']:item['linearRGB'] for item in data['palette']}
    if len(mesh.polygons)!=len(character['parts'])*6:
        raise AssertionError('Expected six saved quadrilateral faces per voxel')
    maximum_color,maximum_roughness,maximum_metallic = 0,0,0
    checked = {}
    for index,part in enumerate(character['parts']):
        expected_color = template['pieces'][part['localIndex']]['c']
        for face_index in range(index*6,index*6+6):
            polygon = mesh.polygons[face_index]
            if len(polygon.vertices)!=4 or polygon.material_index>=len(mesh.materials):
                raise AssertionError('Invalid voxel face topology/material slot')
            material = mesh.materials[polygon.material_index]
            if material is None or not material.use_nodes:
                raise AssertionError('Citizen face has no node-based render material')
            key = (material.as_pointer(),expected_color)
            if key not in checked:
                shader = material.node_tree.nodes.get('Principled BSDF')
                output = next((node for node in material.node_tree.nodes if node.type=='OUTPUT_MATERIAL' and node.is_active_output),None)
                if shader is None or output is None or not output.inputs['Surface'].is_linked or output.inputs['Surface'].links[0].from_node!=shader:
                    raise AssertionError('Citizen render output does not use its inspected Principled shader')
                for socket in ('Base Color','Roughness','Metallic'):
                    if shader.inputs[socket].is_linked:
                        raise AssertionError('Unexpected link overrides the citizen '+socket+' input')
                actual = shader.inputs['Base Color'].default_value
                color_error = max(abs(actual[i]-value) for i,value in enumerate((*palette[expected_color],1)))
                roughness_error = abs(shader.inputs['Roughness'].default_value-.74)
                metallic_error = abs(shader.inputs['Metallic'].default_value-.2)
                checked[key] = (color_error,roughness_error,metallic_error)
            color_error,roughness_error,metallic_error = checked[key]
            maximum_color = max(maximum_color,color_error)
            maximum_roughness = max(maximum_roughness,roughness_error)
            maximum_metallic = max(maximum_metallic,metallic_error)
    if max(maximum_color,maximum_roughness,maximum_metallic)>tolerance:
        raise AssertionError(f"{character['id']} saved shader inputs differ from the runtime palette/material: {maximum_color}, {maximum_roughness}, {maximum_metallic}")
    return {'id':character['id'],'faces':len(mesh.polygons),'maximumLinearColorError':maximum_color,'maximumRoughnessError':maximum_roughness,'maximumMetallicError':maximum_metallic}
