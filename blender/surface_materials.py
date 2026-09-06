"""Editable metre-space counterparts of the game's three opaque surface finishes.

Blender Noise/White Noise are deliberately native nodes, not an exact port of
the runtime GLSL hash. Geometry Position supplies metres after object transforms;
world-normal projection keeps the grain scale independent of batch dimensions.
This helper changes only the supplied material datablocks.
"""
import json

REVISION = 'native-surface-finish-01'
SURFACES = {
    'solid': {'name':'Voxel / architectural alloy', 'roughness':.86, 'metallic':.08,
              'roughnessRange':[.80,.92], 'bumpDistanceMetres':.0006, 'bumpStrength':.06},
    'pavement': {'name':'Voxel / rain polished asphalt', 'roughness':.91, 'metallic':.025,
                 'roughnessRange':[.495,.945], 'bumpDistanceMetres':.0008, 'bumpStrength':.08},
    'metal': {'name':'Voxel / weathered small metal panels', 'roughness':.57, 'metallic':.66,
              'roughnessRange':[.47,.83], 'bumpDistanceMetres':.0004, 'bumpStrength':.06},
}


def configure_surface_material(material, kind):
    """Replace one opaque surface graph while retaining its ID and VoxelTint input."""
    settings=SURFACES[kind]
    material.use_nodes=True
    tree=material.node_tree;tree.nodes.clear()
    serial=0
    def node(node_type,label):
        nonlocal serial
        n=tree.nodes.new(node_type);n.name=label;n.label=label
        # A readable left-to-right graph instead of a stack of hidden defaults.
        n.location=(-1800+(serial//9)*260,650-(serial%9)*180);serial+=1
        return n
    def set_input(socket,value):
        if hasattr(value,'node'):tree.links.new(value,socket)
        else:socket.default_value=value
    def math(operation,a,b=0,label=None):
        n=node('ShaderNodeMath',label or operation.replace('_',' ').title());n.operation=operation
        set_input(n.inputs[0],a);set_input(n.inputs[1],b);return n.outputs[0]
    def combine(x,y,z=0,label='World metre projection'):
        n=node('ShaderNodeCombineXYZ',label)
        for key,value in zip('XYZ',(x,y,z)):set_input(n.inputs[key],value)
        return n.outputs['Vector']
    def vector(operation,a,b=None,label='World vector'):
        n=node('ShaderNodeVectorMath',label);n.operation=operation;set_input(n.inputs[0],a)
        if b is not None:set_input(n.inputs[1],b)
        return n.outputs['Vector']
    def mix(factor,a,b,label='Surface blend'):
        n=node('ShaderNodeMixRGB',label);n.blend_type='MIX'
        for i,value in enumerate((factor,a,b)):set_input(n.inputs[i],value)
        return n.outputs['Color']
    def multiply_color(a,b,label):
        n=node('ShaderNodeMixRGB',label);n.blend_type='MULTIPLY';n.inputs[0].default_value=1
        set_input(n.inputs[1],a);set_input(n.inputs[2],b);return n.outputs['Color']
    def smooth(value,minimum,maximum,out_min=0,out_max=1,label='Smooth transition'):
        n=node('ShaderNodeMapRange',label);n.clamp=True;n.interpolation_type='SMOOTHSTEP'
        for key,v in [('Value',value),('From Min',minimum),('From Max',maximum),('To Min',out_min),('To Max',out_max)]:set_input(n.inputs[key],v)
        return n.outputs['Result']
    def noise(uv,scale_vector,label):
        coordinate=vector('MULTIPLY',uv,scale_vector,label+' / metres')
        n=node('ShaderNodeTexNoise',label);n.noise_dimensions='3D'
        n.inputs['Scale'].default_value=1;n.inputs['Detail'].default_value=0;n.inputs['Roughness'].default_value=.5
        tree.links.new(coordinate,n.inputs['Vector']);return n.outputs['Fac']

    out=node('ShaderNodeOutputMaterial','Surface output')
    bs=node('ShaderNodeBsdfPrincipled','Opaque / '+kind)
    bs.inputs['Roughness'].default_value=settings['roughness'];bs.inputs['Metallic'].default_value=settings['metallic']
    tree.links.new(bs.outputs['BSDF'],out.inputs['Surface'])
    tint=node('ShaderNodeVertexColor','Authored voxel color / unchanged');tint.layer_name='VoxelTint'
    geometry=node('ShaderNodeNewGeometry','WORLD POSITION / metres')
    position=node('ShaderNodeSeparateXYZ','World metres / Blender Z up');tree.links.new(geometry.outputs['Position'],position.inputs[0])
    normal=node('ShaderNodeSeparateXYZ','Absolute world normal')
    tree.links.new(vector('ABSOLUTE',geometry.outputs['Normal'],label='Absolute world normal vector'),normal.inputs[0])
    negative_y=math('MULTIPLY',position.outputs['Y'],-1,'Game forward = negative Blender Y')
    horizontal=combine(position.outputs['X'],negative_y,label='Ground projection / game XZ metres')
    side_x=combine(negative_y,position.outputs['Z'],label='East / west wall metres')
    side_y=combine(position.outputs['X'],position.outputs['Z'],label='North / south wall metres')
    face_x=math('GREATER_THAN',normal.outputs['X'],.5,'East / west face')
    face_up=math('GREATER_THAN',normal.outputs['Z'],.8,'Horizontal face')
    uv=mix(face_up,mix(face_x,side_y,side_x,'Select wall plane'),horizontal,'Select face projection')
    grid=vector('FLOOR',vector('SCALE',uv,label='Aggregate / 31 cells per metre'),label='3.2cm aggregate cells')
    # SCALE uses a named scalar socket, unlike the second vector input.
    scale_node=tree.nodes['Aggregate / 31 cells per metre'];scale_node.inputs['Scale'].default_value=31
    grain_node=node('ShaderNodeTexWhiteNoise','Metre-space aggregate value');grain_node.noise_dimensions='3D';tree.links.new(grid,grain_node.inputs['Vector'])
    grain=grain_node.outputs['Value']
    stain=noise(uv,(.63,.18,1),'Broad weathering / 1.6m by 5.6m')
    lower=smooth(position.outputs['Z'],.15,1.9,1,0,'Ground-level dirt height')
    lower=math('MULTIPLY',lower,math('SUBTRACT',1,face_up),'Dirt only on vertical faces')
    lower=math('MULTIPLY',lower,math('ADD',.4,math('MULTIPLY',stain,.6)),'Weathered wall base')
    grain_center=math('SUBTRACT',grain,.5,'Centered aggregate')
    stain_center=math('SUBTRACT',stain,.5,'Centered broad weathering')

    if kind=='solid':
        shade=math('ADD',.96,math('ADD',math('MULTIPLY',grain_center,.08),math('MULTIPLY',stain,.07)),'Concrete grain and mild stains')
        shade=math('MULTIPLY',shade,math('SUBTRACT',1,math('MULTIPLY',lower,.22)),'Concrete base weathering')
        color=multiply_color(tint.outputs['Color'],shade,'Keep authored concrete tint')
        roughness=math('ADD',.86,math('MULTIPLY',stain_center,.12),'Concrete roughness / .80 to .92')
    elif kind=='metal':
        brush_grid=vector('FLOOR',vector('MULTIPLY',uv,(105,5,1),'Brushed metal / metre spacing'),label='Directional brush cells')
        brush=node('ShaderNodeTexWhiteNoise','Directional metal brush');tree.links.new(brush_grid,brush.inputs['Vector'])
        shade=math('MULTIPLY',math('ADD',.95,math('MULTIPLY',brush.outputs['Value'],.1)),math('ADD',.91,math('MULTIPLY',stain,.13)),'Brushed painted metal')
        shade=math('MULTIPLY',shade,math('SUBTRACT',1,math('MULTIPLY',lower,.18)),'Metal lower-edge weathering')
        color=multiply_color(tint.outputs['Color'],shade,'Keep authored metal tint')
        roughness=math('ADD',.57,math('ADD',math('MULTIPLY',stain_center,.2),math('MULTIPLY',lower,.16)),'Metal roughness / .47 to .83')
    else:
        broad=noise(horizontal,(.27,.19,1),'Wet basin / broad metre patches')
        fine=noise(vector('ADD',horizontal,(7.4,7.4,0),'Wet detail offset'),(.83,.83,1),'Wet basin / local variation')
        basin=math('ADD',math('MULTIPLY',broad,.76),math('MULTIPLY',fine,.24),'Wet basin distribution')
        water=smooth(basin,.54,.65,label='Isolated wetness / dry between basins')
        ground=math('MULTIPLY',face_up,math('LESS_THAN',position.outputs['Z'],.5),'Only low horizontal paving')
        water=math('MULTIPLY',water,ground,'Wet patches on actual ground')
        asphalt=math('MULTIPLY',ground,math('LESS_THAN',position.outputs['Z'],.08),'Asphalt versus raised slabs')
        grit=multiply_color(tint.outputs['Color'],math('ADD',1,math('MULTIPLY',grain_center,.20)),'Pavement aggregate tint')
        road=mix(.24,grit,(.016,.024,.031,1),'Dark mineral asphalt / no metal')
        shade=math('MULTIPLY',math('ADD',.91,math('MULTIPLY',stain,.22)),math('SUBTRACT',1,math('MULTIPLY',water,.16)),'Asphalt weathering and wet darkening')
        road=multiply_color(road,shade,'Dry asphalt with isolated darker basins')
        # Raised paving receives staggered 1.2m by .72m slab joints.
        row=math('FLOOR',math('DIVIDE',negative_y,.72),label='Paving slab row')
        offset=math('MULTIPLY',math('MODULO',row,2),.5,'Alternate half-slab offset')
        slab_x=math('ADD',math('DIVIDE',position.outputs['X'],1.2),offset)
        slab_y=math('DIVIDE',negative_y,.72)
        fx=math('FRACT',slab_x);fy=math('FRACT',slab_y)
        edge=math('MINIMUM',math('MINIMUM',fx,math('SUBTRACT',1,fx)),math('MINIMUM',fy,math('SUBTRACT',1,fy)),'Distance to slab joint')
        joint=smooth(edge,.006,.019,1,0,'Narrow slab joints')
        slab=multiply_color(grit,math('SUBTRACT',1,math('MULTIPLY',joint,.34)),'Concrete slab joints')
        color=mix(ground,grit,mix(asphalt,slab,road,'Raised concrete versus road'),'Ground detail only')
        roughness=math('ADD',math('SUBTRACT',.91,math('MULTIPLY',water,.38)),math('MULTIPLY',grain_center,.07),'Paving roughness / dry .91, wet .53')

    tree.links.new(color,bs.inputs['Base Color']);tree.links.new(roughness,bs.inputs['Roughness'])
    bump=node('ShaderNodeBump','Submillimetre aggregate / restrained normal detail')
    bump.inputs['Distance'].default_value=settings['bumpDistanceMetres'];bump.inputs['Strength'].default_value=settings['bumpStrength']
    tree.links.new(grain,bump.inputs['Height']);tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])
    out.location=(1850,350);bs.location=(1500,350);bump.location=(1250,-100)
    material['surface_revision']=REVISION;material['surface_kind']=kind
    material['surface_parameters']=json.dumps({**settings,'coordinateSpace':'world metres','wetness':'horizontal ground patches only' if kind=='pavement' else 'none'})
    return material


def configure_surface_materials(materials):
    for kind in SURFACES:configure_surface_material(materials[kind],kind)
    return materials


def surface_report(materials):
    return {'revision':REVISION,'runtimeReference':'src/surface-materials.js',
            'comparison':'Comparable physical scale and finish using editable Blender noise nodes; not exact GLSL noise or render parity.',
            'surfaces':[{**settings,'kind':kind,'nodes':len(materials[kind].node_tree.nodes),
                         'links':len(materials[kind].node_tree.links)} for kind,settings in SURFACES.items()]}
