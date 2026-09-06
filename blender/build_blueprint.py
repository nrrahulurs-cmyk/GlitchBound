"""Create an editable architectural plan scene from the shared city blueprint.

Used by build_city.py. All plan lines, footprints, dimensions and labels are
native Blender geometry/text, independent of the game or a browser canvas.
"""
import bpy
import json
import math
from pathlib import Path


def build_blueprint_scene(layout, blueprint, output_dir):
    bounds=blueprint.get('bounds',layout['bounds'])
    scene=bpy.data.scenes.new('VESPER / architectural blueprint')
    scene.use_fake_user=True
    scene['source']='Shared city blueprint: roads, footprints, setbacks and structure anchors'
    scene['bounds']=json.dumps(bounds)
    output_dir=Path(output_dir)
    layers={}
    for name in ['01 Sheet and grid','02 Road corridors','03 Building footprints','04 Parcels and setbacks',
                 '05 Structural supports','06 Districts and labels','07 Dimensions and legend',
                 '08 Signs and scene anchors','09 Elevated connections','10 Street frontages','11 Authored block circulation']:
        c=bpy.data.collections.new('PLAN / '+name);scene.collection.children.link(c);layers[name]=c

    colors={'paper':'#071b2b','grid':'#123348','road':'#133d51','road_edge':'#5cc8df',
            'building':'#24506a','building_edge':'#bddbeb','setback':'#48687f',
            'support':'#ffbb58','district':'#a785d9','text':'#d8ecf5','muted':'#78a4b8',
            'sign':'#ff86cb','prop':'#82e0ae','connection':'#cdad6f','frontage':'#c5f68d','block':'#f4a777','walk':'#81dfcb'}
    materials={}
    for key,hex_color in colors.items():
        rgb=[int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
        m=bpy.data.materials.new('PLAN / '+key);m.use_nodes=True;m.diffuse_color=(*rgb,1)
        nodes=m.node_tree.nodes;nodes.clear();em=nodes.new('ShaderNodeEmission');out=nodes.new('ShaderNodeOutputMaterial')
        em.inputs['Color'].default_value=(*rgb,1);em.inputs['Strength'].default_value=1
        m.node_tree.links.new(em.outputs[0],out.inputs['Surface']);materials[key]=m

    def rect(name,x,z,sx,sz,key,layer,height=0):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata([(x-sx/2,-z-sz/2,height),(x+sx/2,-z-sz/2,height),
                          (x+sx/2,-z+sz/2,height),(x-sx/2,-z+sz/2,height)],[],[(0,1,2,3)])
        mesh.materials.append(materials[key]);obj=bpy.data.objects.new(name,mesh);layers[layer].objects.link(obj);return obj

    def line(name,points,key,layer,width=.25,height=.1,close=False):
        data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=width;data.bevel_resolution=0
        spline=data.splines.new('POLY');spline.points.add(len(points)-1)
        for p,(x,z) in zip(spline.points,points):p.co=(x,-z,height,1)
        spline.use_cyclic_u=close;data.materials.append(materials[key])
        obj=bpy.data.objects.new(name,data);layers[layer].objects.link(obj);return obj

    def label(name,text,x,z,size=4,key='text',layer='06 Districts and labels',rotation=0,align='CENTER',height=.7):
        data=bpy.data.curves.new(name,'FONT');data.body=text;data.size=size;data.align_x=align;data.align_y='CENTER'
        data.space_character=1.05;data.materials.append(materials[key])
        obj=bpy.data.objects.new(name,data);layers[layer].objects.link(obj);obj.location=(x,-z,height);obj.rotation_euler.z=rotation
        return obj

    def aabb(record):
        record=record.get('bounds',record.get('footprint',record))
        if isinstance(record,dict) and all(k in record for k in ['minX','maxX','minZ','maxZ']):
            return ((record['minX']+record['maxX'])/2,(record['minZ']+record['maxZ'])/2,
                    record['maxX']-record['minX'],record['maxZ']-record['minZ'])
        if isinstance(record,dict) and 'x' in record and 'z' in record:
            return (record['x'],record['z'],record.get('sx',record.get('width',1)),record.get('sz',record.get('depth',1)))
        return None

    def outline(name,box,key,layer,width=.28,height=.2,expand=0):
        x,z,sx,sz=box;sx+=expand*2;sz+=expand*2
        return line(name,[(x-sx/2,z-sz/2),(x+sx/2,z-sz/2),(x+sx/2,z+sz/2),(x-sx/2,z+sz/2)],key,layer,width,height,True)

    min_x,max_x,min_z,max_z=[bounds[k] for k in ['minX','maxX','minZ','maxZ']]
    cx=(min_x+max_x)/2;cz=(min_z+max_z)/2;span_x=max_x-min_x;span_z=max_z-min_z
    rect('Blueprint sheet',cx,cz,span_x+190,span_z+190,'paper','01 Sheet and grid',-1)
    for x in range(math.floor(min_x/25)*25,math.ceil(max_x/25)*25+1,25):
        line(f'Grid X {x}',[(x,min_z),(x,max_z)],'grid','01 Sheet and grid',.10,-.5)
    for z in range(math.floor(min_z/25)*25,math.ceil(max_z/25)*25+1,25):
        line(f'Grid Z {z}',[(min_x,z),(max_x,z)],'grid','01 Sheet and grid',.10,-.5)
    outline('City study boundary',(cx,cz,span_x,span_z),'text','07 Dimensions and legend',.55,.02)

    roads=blueprint.get('roads',layout.get('roads',[]))
    for i,road in enumerate(roads):
        box=aabb(road)
        if not box:continue
        name=road.get('name',road.get('id',f'Road {i+1}'))
        rect(name,*box,'road','02 Road corridors',0)
        outline(name+' / edges',box,'road_edge','02 Road corridors',.25,.05)
        x,z,sx,sz=box
        pts=[(x,z-sz/2),(x,z+sz/2)] if sz>sx else [(x-sx/2,z),(x+sx/2,z)]
        line(name+' / centerline',pts,'muted','02 Road corridors',.12,.07)

    footprints=blueprint.get('buildings',blueprint.get('footprints',layout.get('colliders',[])))
    for i,building in enumerate(footprints):
        box=aabb(building)
        if not box:continue
        name=str(building.get('id',building.get('name',f'B{i+1:03d}')))
        obj=rect(name,*box,'building','03 Building footprints',.12)
        obj['record']=json.dumps(building,ensure_ascii=False)
        outline(name+' / footprint',box,'building_edge','03 Building footprints',.25,.19)
        if min(box[2],box[3])>9:
            label(name+' / ID',name,box[0],box[1],min(3.2,box[2]/max(3,len(name))*.9),height=.3)

    for i,parcel in enumerate(blueprint.get('parcels',[])):
        box=aabb(parcel)
        if box:
            obj=outline(str(parcel.get('id',f'Parcel {i+1}')),box,'setback','04 Parcels and setbacks',.20,.24)
            obj['record']=json.dumps(parcel,ensure_ascii=False)
    for i,setback in enumerate(blueprint.get('setbacks',[])):
        box=aabb(setback)
        if box:outline(f'Setback {i+1}',box,'setback','04 Parcels and setbacks',.17,.24)

    supports=blueprint.get('supports',blueprint.get('foundations',[]))
    for i,support in enumerate(supports):
        box=aabb(support)
        if not box and isinstance(support.get('anchor'),dict):box=aabb(support['anchor'])
        if not box:continue
        x,z,sx,sz=box;sx=max(sx,.65);sz=max(sz,.65)
        obj=rect(str(support.get('id',f'Support {i+1}')),x,z,sx,sz,'support','05 Structural supports',.45)
        obj['record']=json.dumps(support,ensure_ascii=False)

    for support in layout.get('nativeSupply',{}).get('foundations',[]):
        obj=rect(support['id'],*aabb(support),'support','05 Structural supports',.48)
        obj['record']=json.dumps(support,ensure_ascii=False)
    for assembly in layout.get('nativeLife',{}).get('assemblies',[]):
        anchor=assembly.get('anchor',{})
        if 'x' in anchor and 'z' in anchor:
            obj=outline(assembly['id'],(anchor['x'],anchor['z'],1.4,1.4),'support','05 Structural supports',.25,.53)
            obj['record']=json.dumps(assembly,ensure_ascii=False)

    for sign in blueprint.get('signs',[]):
        ry=sign.get('ry',0);dx=math.cos(ry)*sign['w']/2;dz=-math.sin(ry)*sign['w']/2
        obj=line(sign['id']+' / panel',[(sign['x']-dx,sign['z']-dz),(sign['x']+dx,sign['z']+dz)],
                 'sign','08 Signs and scene anchors',.16,.56)
        obj['record']=json.dumps(sign,ensure_ascii=False)
        anchor=sign.get('anchor')
        if anchor:
            line(sign['id']+' / wall tie',[(anchor['x'],anchor['z']),(sign['x'],sign['z'])],
                 'support','08 Signs and scene anchors',.11,.55)

    for record in blueprint.get('props',[]):
        if record.get('mountType')=='powered flight':continue
        obj=outline(record['id'],aabb(record),'prop','08 Signs and scene anchors',.32,.60)
        obj['record']=json.dumps(record,ensure_ascii=False)
    for vehicle in layout.get('nativeLife',{}).get('vehicles',[]):
        ry=vehicle.get('yaw',0);sx=vehicle.get('width',2);sz=vehicle.get('length',4)
        cs,sn=math.cos(ry),math.sin(ry)
        points=[(vehicle['x']+dx*cs+dz*sn,vehicle['z']-dx*sn+dz*cs)
                for dx,dz in [(-sx/2,-sz/2),(sx/2,-sz/2),(sx/2,sz/2),(-sx/2,sz/2)]]
        line(vehicle['id']+' / vehicle footprint',points,'prop','08 Signs and scene anchors',.24,.62,True)

    for connection in blueprint.get('elevatedConnections',[]):
        points=[(connection[k]['x'],connection[k]['z']) for k in ['from','to'] if k in connection]
        if len(points)==2:
            obj=line(connection['id'],points,'connection','09 Elevated connections',.35,.64)
            obj['record']=json.dumps(connection,ensure_ascii=False)

    frontages=blueprint.get('streetDetails',{}).get('assemblies',[])
    for frontage in frontages:
        box=aabb(frontage);obj=rect(frontage['id']+' / footprint',*box,'frontage','10 Street frontages',.67)
        obj['street_frontage_id']=frontage['id'];obj['record']=json.dumps(frontage,ensure_ascii=False)
        outline(frontage['id']+' / outline',box,'frontage','10 Street frontages',.24,.69)
        anchor=frontage['anchor']
        line(frontage['id']+' / wall anchor',[(anchor['x'],anchor['z']),(box[0],box[1])],'frontage','10 Street frontages',.15,.68)

    authored=blueprint.get('blockCompositions',{})
    for assembly in authored.get('assemblies',[]):
        obj=outline(assembly['id']+' / authored footprint',aabb(assembly),'block','11 Authored block circulation',.22,.74)
        obj['block_composition_id']=assembly['id'];obj['record']=json.dumps(assembly,ensure_ascii=False)
    for path in authored.get('paths',[]):
        obj=line(path['id'],[(p['x'],p['z']) for p in path['points']],'walk','11 Authored block circulation',.28,.78)
        obj['walk_path_id']=path['id'];obj['record']=json.dumps(path,ensure_ascii=False)

    districts=blueprint.get('districts',layout.get('districts',[]))
    for district in districts:
        box=aabb(district)
        if 'bounds' in district and box:outline(district.get('name','District')+' / bounds',box,'district','06 Districts and labels',.65,.55)
        x=district.get('x',box[0] if box else 0);z=district.get('z',box[1] if box else 0)
        label('District / '+district.get('name',''),district.get('name','').upper(),x,z,7,'district',height=.9)

    # Dimension chains, scale bar, north arrow and sheet title remain editable.
    layer='07 Dimensions and legend'
    line('Dimension / width',[(min_x,max_z+28),(max_x,max_z+28)],'text',layer,.28,.6)
    for x in [min_x,max_x]:line('Width extension',[(x,max_z+15),(x,max_z+35)],'text',layer,.22,.6)
    label('Width dimension',f'{span_x:.0f} m',cx,max_z+23,6,layer=layer)
    line('Dimension / depth',[(min_x-30,min_z),(min_x-30,max_z)],'text',layer,.28,.6)
    for z in [min_z,max_z]:line('Depth extension',[(min_x-37,z),(min_x-15,z)],'text',layer,.22,.6)
    label('Depth dimension',f'{span_z:.0f} m',min_x-38,cz,6,layer=layer,rotation=math.pi/2)
    label('Sheet title','VESPER / ARCHITECTURAL BLUEPRINT',min_x,min_z-62,13,layer=layer,align='LEFT')
    label('Sheet subtitle','GROUND PLAN  /  METERS  /  25 m GRID',min_x,min_z-42,5,'muted',layer,align='LEFT')
    legend=[('road_edge','ROAD CORRIDORS'),('building_edge','BUILDING FOOTPRINTS'),('setback','PARCELS / SETBACKS'),('support','STRUCTURAL ANCHORS')]
    for i,(key,text) in enumerate(legend):
        x=min_x+i*175;z=max_z+60
        line('Legend '+text,[(x,z),(x+12,z)],key,layer,.8,.7)
        label('Legend label '+text,text,x+18,z,3.9,key,layer,align='LEFT')
    for i,(key,text) in enumerate([('sign','MOUNTED SIGN PANELS'),('prop','GROUND ASSET FOOTPRINTS'),('connection','ELEVATED CONNECTIONS')]):
        x=min_x+i*225;z=max_z+75
        line('Legend '+text,[(x,z),(x+12,z)],key,layer,.8,.7)
        label('Legend label '+text,text,x+18,z,3.9,key,layer,align='LEFT')
    line('Legend street frontages',[(min_x,max_z+87),(min_x+12,max_z+87)],'frontage',layer,.8,.7)
    label('Legend label street frontages',f'{len(frontages)} WALL-SUPPORTED FRONTS / {sum(1 for a in frontages if a.get("courtyard"))} SERVICE-COURT ENTRIES',min_x+18,max_z+87,3.9,'frontage',layer,align='LEFT')
    line('Legend authored blocks',[(min_x+460,max_z+87),(min_x+472,max_z+87)],'block',layer,.8,.7)
    label('Legend label authored blocks',f'{len(authored.get("assemblies",[]))} AUTHORED ASSEMBLIES / WALK ROUTES',min_x+478,max_z+87,3.6,'block',layer,align='LEFT')
    line('Scale / 100m',[(min_x,min_z-20),(min_x+100,min_z-20)],'text',layer,.6,.6)
    for x in [min_x,min_x+50,min_x+100]:line('Scale tick',[(x,min_z-24),(x,min_z-16)],'text',layer,.3,.6)
    label('Scale label','0                50               100 m',min_x+50,min_z-11,3.5,'muted',layer)
    line('North arrow',[(max_x-15,min_z-15),(max_x-15,min_z-48)],'text',layer,.5,.6)
    line('North tip',[(max_x-21,min_z-39),(max_x-15,min_z-48),(max_x-9,min_z-39)],'text',layer,.5,.6)
    label('North label','N',max_x-15,min_z-58,7,layer=layer)

    data=bpy.data.cameras.new('CAM PLAN / orthographic architectural sheet');data.type='ORTHO';data.ortho_scale=max(span_x,span_z)+180;data.clip_end=4000
    camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);camera.location=(cx,-cz,1200)
    scene.camera=camera
    world=bpy.data.worlds.new('PLAN / neutral background');world.color=(.01,.02,.03);scene.world=world
    scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.use_denoising=False
    scene.render.resolution_x=2200;scene.render.resolution_y=2200;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(output_dir/'city-blueprint-preview.png')
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0
    data_text=bpy.data.texts.new('VESPER / authoritative city blueprint.json')
    data_text.write(json.dumps(blueprint,indent=2,ensure_ascii=False));data_text.use_fake_user=True
    support_text=bpy.data.texts.new('VESPER / street life and supply supports.json')
    support_text.write(json.dumps({'assemblies':layout.get('nativeLife',{}).get('assemblies',[]),
                                  'supply':layout.get('nativeSupply',{})},indent=2,ensure_ascii=False))
    support_text.use_fake_user=True
    scene['building_count']=len(footprints);scene['support_count']=len(supports)
    scene['sign_count']=len(blueprint.get('signs',[]));scene['road_count']=len(roads)
    scene['street_frontage_count']=len(frontages)
    return scene
