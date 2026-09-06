"""Native task lights anchored to the dock's actual luminous fixture faces.

These editable Cycles lights supply local illumination beneath the exported
shields. Power is a native preview calibration, not runtime photometric parity.
"""
import bpy
import json
from mathutils import Vector


def practical_records(layout):
    powers={'apron task light':120.0,'shielded task light':95.0}
    records=[]
    for box in layout['boxes']:
        if box.get('detail')!='block-craft' or box.get('role') not in powers:
            continue
        assert box['kind']=='window' and box['sy']<.05
        rgb=[int(box['c'].lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
        linear=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
        peak=max(linear)
        records.append({'id':box['id'],'assemblyId':box['assemblyId'],
            'position':[box['x'],-box['z'],box['y']-box['sy']/2-.003],
            'rotationZ':box.get('ry',0),'width':box['sx'],'depth':box['sz'],
            'color':[c/peak for c in linear],'powerWatts':powers[box['role']]})
    assert len(records)==3,'Expected the two apron strips and one process-entry strip'
    return records


def add_practical_lights(layout,collection):
    records=practical_records(layout)
    for record in records:
        name='PRACTICAL / '+record['id']
        assert name not in bpy.data.objects,'Practical already exists: '+name
        data=bpy.data.lights.new(name,'AREA')
        data.shape='RECTANGLE'
        data.size=record['width']
        data.size_y=record['depth']
        data.energy=record['powerWatts']
        data.color=record['color']
        obj=bpy.data.objects.new(name,data)
        collection.objects.link(obj)
        obj.location=record['position']
        obj.rotation_euler=(0,0,record['rotationZ'])
        obj['fixture_source_box']=record['id']
        obj['fixture_assembly']=record['assemblyId']
        obj['emitter_offset_metres']=.003
        obj['lighting_scope']='Native preview calibration at the actual fixture; runtime light pooling is separate.'
    return records


def verify_practical_lights(layout,scene):
    records=practical_records(layout)
    actual=[obj for obj in scene.objects if obj.get('fixture_source_box')]
    assert len(actual)==len(records)
    for record in records:
        obj=next(obj for obj in actual if obj['fixture_source_box']==record['id'])
        assert obj.type=='LIGHT' and obj.data.type=='AREA' and obj.data.shape=='RECTANGLE'
        assert obj['fixture_assembly']==record['assemblyId']
        assert max(abs(obj.matrix_world.translation[i]-record['position'][i]) for i in range(3))<.00001
        assert abs(obj.data.size-record['width'])<.00001 and abs(obj.data.size_y-record['depth'])<.00001
        assert abs(obj.data.energy-record['powerWatts'])<.00001
        assert max(abs(obj.data.color[i]-record['color'][i]) for i in range(3))<.00001
        assert max(abs(obj.rotation_euler[i]-[0,0,record['rotationZ']][i]) for i in range(3))<.00001
        assert not obj.hide_render
        # Check the actual saved luminous mesh face, independently of the
        # record's rotation formula, so matching metadata cannot hide drift.
        parent=bpy.data.objects[record['assemblyId']]
        face_vertices=[]
        for child in parent.children:
            if child.type!='MESH':continue
            ids=json.loads(child.get('source_box_ids','[]'))
            if record['id'] not in ids:continue
            index=ids.index(record['id'])
            vertices=[child.matrix_world@v.co for v in child.data.vertices[index*8:(index+1)*8]]
            bottom=min(v.z for v in vertices)
            face_vertices=[v-Vector((0,0,.003)) for v in vertices if abs(v.z-bottom)<.00001]
        assert len(face_vertices)==4
        corners=[obj.matrix_world@Vector((x*obj.data.size/2,y*obj.data.size_y/2,0)) for x,y in [(-1,-1),(-1,1),(1,1),(1,-1)]]
        assert max(min((corner-v).length for v in face_vertices) for corner in corners)<.00003,'Native emitter differs from saved luminous face: '+record['id']
    return records
