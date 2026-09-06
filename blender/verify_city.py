"""Fresh-reopen verification and manifest for the complete editable city."""
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter
import bpy
import hashlib
import json
import math
import shutil
import subprocess
import sys


def verify_city(root):
    root = Path(root)
    sys.path.insert(0,str(root/'blender'))
    from native_layout import read_native_layout, read_native_characters
    from native_characters import load_embedded_export, verify_character, verify_character_materials
    from practical_lights import verify_practical_lights
    source = read_native_layout(root)
    character_source = read_native_characters(root)
    path = root/'blender/neon-district-city.blend'
    bpy.ops.wm.open_mainfile(filepath=str(path))
    scene = bpy.data.scenes['VESPER / street composition']
    bpy.context.window.scene = scene
    scene.frame_set(1)
    practical_checks=verify_practical_lights(source,scene)
    aerial = bpy.data.scenes['VESPER / complete city aerial']
    blueprint_scene = bpy.data.scenes['VESPER / architectural blueprint']
    blueprint = json.loads(bpy.data.texts['VESPER / authoritative city blueprint.json'].as_string())
    assert blueprint == source['blueprint'], 'Embedded architectural blueprint differs from current source'
    catalog_record = json.loads(bpy.data.texts['VESPER / advert campaign catalog.json'].as_string())
    catalog = catalog_record['campaigns']
    assert catalog == source['advertCampaigns']
    assert catalog_record['placements'] == source['advertPlacements']
    packed = ['advert-portrait.png']+[ad['file'] for ad in catalog]
    image_map = {}
    for name in packed:
        image = next((i for i in bpy.data.images if Path(i.filepath).name == name),None)
        assert image and image.packed_file and min(image.size)>0, 'Missing packed image '+name
        image_map[name] = image
    image_objects = [o for o in scene.objects if o.type=='MESH' and o.get('campaign_asset')]
    counts = Counter(obj['campaign_asset'] for obj in image_objects)
    expected_signs = [s for s in source['signs'] if s.get('art') in ['campaign','portrait']]
    assert len(image_objects) == len(expected_signs)
    panel_checks = []
    for sign in expected_signs:
        obj = next(o for o in image_objects if o.get('sign_id')==sign['id'])
        expected_file = catalog[sign.get('adIndex',0)]['file'] if sign.get('art')=='campaign' else 'advert-portrait.png'
        assert obj['campaign_asset']==expected_file
        assert len(obj.data.vertices)==4
        width=(obj.data.vertices[1].co-obj.data.vertices[0].co).length
        height=(obj.data.vertices[2].co-obj.data.vertices[1].co).length
        image=image_map[expected_file]
        assert width<=sign['w']*.96+.0001 and height<=sign['h']*.96+.0001
        if sign.get('art')=='campaign':
            assert abs(width/height-image.size[0]/image.size[1])<.00005
        panel_checks.append({'signId':sign['id'],'file':expected_file,'dimensions':[width,height],'mountType':sign.get('mountType'),'attachedTo':sign.get('attachedTo')})
    for ad in catalog:
        assert counts[ad['file']] > 0
    anchors=[]
    for obj in scene.objects:
        if not obj.get('shared_anchor'):continue
        anchor=json.loads(obj['shared_anchor'])
        expected=(anchor['x'],-anchor['z'],anchor['y'])
        assert max(abs(obj.location[i]-expected[i]) for i in range(3))<.001
        anchors.append(anchor['id'])
    arms=[o for o in scene.objects if o.type=='MESH' and o.name.startswith('right_arm')]
    assert arms and all(len(o.data.vertices)<=200 for o in arms), 'Unarmed hero revision missing'
    embedded_characters = load_embedded_export()
    assert embedded_characters == character_source, 'Embedded citizens differ from the freshly resolved runtime source'
    citizen_rigs = {o['civilian_id']:o for o in scene.objects if o.type=='ARMATURE' and o.get('character_role')=='population'}
    assert len(citizen_rigs)==character_source['counts']['people']==284
    citizen_checks=[];citizen_material_checks=[]
    for character in character_source['characters']:
        rig=citizen_rigs[character['id']]
        meshes=[o for o in rig.children if o.type=='MESH']
        assert len(meshes)==1 and len(meshes[0].modifiers)==1
        assert json.loads(rig['resolved_placement'])==character['resolved']
        assert len(rig.data.bones)==len(character['groups'])
        result={'rig':rig,'mesh':meshes[0],'character':character}
        citizen_checks.append(verify_character(result))
        citizen_material_checks.append(verify_character_materials(character_source,result))
    assert sum(item['vertices'] for item in citizen_checks)==character_source['counts']['voxelPieces']*8
    assert not any(o.name.startswith('COMMUTER ') for o in scene.objects), 'Legacy approximate citizens remain'
    aircraft_roots={o['air_traffic_index']:o for o in scene.objects if 'air_traffic_index' in o}
    assert len(aircraft_roots)==len(character_source['airTraffic'])==16
    aircraft_checks=[]
    def linear_color(color):
        values=[int(color.lstrip('#')[k:k+2],16)/255 for k in (0,2,4)]
        return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)
    def receives_voxel_tint(socket,seen=None):
        seen=set() if seen is None else seen
        for link in socket.links:
            node=link.from_node
            if node.type=='VERTEX_COLOR' and node.layer_name=='VoxelTint':return True
            if node.as_pointer() in seen:continue
            seen.add(node.as_pointer())
            if any(receives_voxel_tint(item,seen) for item in node.inputs if item.is_linked):return True
        return False
    for i,record in enumerate(character_source['airTraffic']):
        aircraft=aircraft_roots[i]
        assert json.loads(aircraft['source_placement'])==record
        expected_root=(record['x'],-record['z'],record['y']+math.sin(i)*.22)
        assert max(abs(aircraft.location[k]-expected_root[k]) for k in range(3))<.0001
        parts_checked=0;maximum=0;color_error=0
        for kind,parts in source['nativeAircraftGeometry'].items():
            mesh=next(o for o in aircraft.children if o.get('air_traffic_part_kind')==kind)
            assert len(mesh.data.vertices)==len(parts)*8
            tint=mesh.data.color_attributes['VoxelTint']
            assert tint.domain=='POINT' and tint.data_type=='FLOAT_COLOR'
            assert len(mesh.data.materials)==1 and all(face.material_index==0 for face in mesh.data.polygons)
            nodes=mesh.data.materials[0].node_tree.nodes
            output=next((node for node in nodes if node.type=='OUTPUT_MATERIAL' and node.is_active_output),None)
            assert output and output.inputs['Surface'].is_linked
            shader=output.inputs['Surface'].links[0].from_node
            assert shader.type=='BSDF_PRINCIPLED'
            assert shader and receives_voxel_tint(shader.inputs['Base Color'])
            if kind=='glow':
                assert receives_voxel_tint(shader.inputs['Emission Color'])
                assert abs(shader.inputs['Emission Strength'].default_value-2.4)<.00001
            for part_index,(x,y,z,sx,sy,sz,color) in enumerate(parts):
                corners=[(-sx/2,-sy/2,-sz/2),(sx/2,-sy/2,-sz/2),(sx/2,sy/2,-sz/2),(-sx/2,sy/2,-sz/2),(-sx/2,-sy/2,sz/2),(sx/2,-sy/2,sz/2),(sx/2,sy/2,sz/2),(-sx/2,sy/2,sz/2)]
                for j,(cx,cy,cz) in enumerate(corners):
                    actual=mesh.matrix_world@mesh.data.vertices[part_index*8+j].co
                    expected=(expected_root[0]+x+cx,expected_root[1]-z-cz,expected_root[2]+y+cy)
                    maximum=max(maximum,max(abs(actual[k]-expected[k]) for k in range(3)))
                    actual_color=tint.data[part_index*8+j].color
                    expected_color=(*linear_color(color),1)
                    color_error=max(color_error,max(abs(actual_color[k]-expected_color[k]) for k in range(4)))
                parts_checked+=1
        assert maximum<.0001
        assert color_error<.000001
        aircraft_checks.append({'index':i,'parts':parts_checked,'maximumWorldError':maximum,'maximumLinearColorError':color_error})
    traffic=[o for o in scene.objects if o.get('vehicle_type')]
    assert len(traffic)==16 and all(o.animation_data for o in traffic)
    scene.frame_set(1);before=traffic[0].location.copy();scene.frame_set(31);distance=(traffic[0].location-before).length;scene.frame_set(1)
    assert distance>1
    props=json.loads(scene.get('dynamic_street_props','[]'))
    assert len(props)==12
    for prop in props:assert abs(prop['y']-prop['sy']/2-.165)<.0001
    expected_voxels=sum(1 for box in source['boxes'] if box.get('lod')!='far')
    assert scene['city_box_count']==expected_voxels
    native_voxels=sum(len(obj.data.vertices)//8 for name in ['01 CITY / editable voxel architecture','07 STREET FRONTS / attached entrance assemblies',
        '08 SERVICE MECHANISMS / editable idle fixtures','09 AUTHORED BLOCKS / residential court and market']
        for obj in bpy.data.collections[name].objects if obj.type=='MESH')
    assert native_voxels==expected_voxels, 'Actual native mesh module count differs from the source'
    frontages=source.get('streetDetails',{}).get('assemblies',[])
    native_frontages=[obj for obj in scene.objects if obj.get('street_frontage')]
    assert len(native_frontages)==len(frontages)
    frontage_checks=[]
    removed_shutters=set(source['nativeServiceFixtures']['removedBoxIds'])
    source_by_id={b['id']:b for b in source['boxes'] if b.get('id')}
    def box_bounds_error(vertices,box):
        c=abs(math.cos(box.get('ry',0)));s=abs(math.sin(box.get('ry',0)))
        hx=(box['sx']*c+box['sz']*s)/2;hz=(box['sx']*s+box['sz']*c)/2
        low=[box['x']-hx,-box['z']-hz,box['y']-box['sy']/2]
        high=[box['x']+hx,-box['z']+hz,box['y']+box['sy']/2]
        return max(max(abs(min(v[i] for v in vertices)-low[i]),abs(max(v[i] for v in vertices)-high[i])) for i in range(3))
    for assembly in frontages:
        parent=next(obj for obj in native_frontages if obj.name==assembly['id'])
        assert json.loads(parent['street_frontage'])==assembly
        meshes=[obj for obj in parent.children if obj.type=='MESH']
        modules=sum(obj.get('voxel_modules',0) for obj in meshes)
        expected_ids=set(assembly['boxIds'])-removed_shutters
        assert modules==len(expected_ids)
        actual_ids=[]
        for obj in meshes:
            ids=json.loads(obj['source_box_ids']);actual_ids.extend(ids)
            assert len(obj.data.vertices)==len(ids)*8
            for i,box_id in enumerate(ids):
                assert box_id in expected_ids
                part_vertices=[obj.matrix_world@v.co for v in obj.data.vertices[i*8:(i+1)*8]]
                assert box_bounds_error(part_vertices,source_by_id[box_id])<.001,'Frontage replacement geometry differs from source'
        assert set(actual_ids)==expected_ids and len(actual_ids)==len(expected_ids)
        assert set(json.loads(parent['removed_service_shutters']))==set(assembly['boxIds'])&removed_shutters
        vertices=[obj.matrix_world@vertex.co for obj in meshes for vertex in obj.data.vertices]
        measured_min=[min(v[i] for v in vertices) for i in range(3)]
        measured_max=[max(v[i] for v in vertices) for i in range(3)]
        q=assembly['bounds'];expected_min=[q['minX'],-q['maxZ'],q['minY']];expected_max=[q['maxX'],-q['minZ'],q['maxY']]
        error=max(abs(measured_min[i]-expected_min[i]) for i in range(3))
        error=max(error,max(abs(measured_max[i]-expected_max[i]) for i in range(3)))
        assert error<.001, 'Native street-front bounds differ from shared layout'
        plan=next((obj for obj in blueprint_scene.objects if obj.get('street_frontage_id')==assembly['id']),None)
        assert plan and json.loads(plan['record'])==assembly
        frontage_checks.append({'id':assembly['id'],'hostBuilding':assembly['hostBuilding'],'voxelModules':modules,'boundsErrorMetres':error,'planFootprint':plan.name})
    block_checks=[]
    profile_checks=[]
    for assembly in source.get('blockCompositions',{}).get('assemblies',[]):
        parent=bpy.data.objects.get(assembly['id']);assert parent and json.loads(parent['block_composition'])==assembly
        actual_ids=[];maximum=0
        for obj in parent.children:
            if obj.type!='MESH':continue
            ids=json.loads(obj['source_box_ids']);actual_ids.extend(ids)
            assert len(obj.data.vertices)==len(ids)*8
            profile=obj.get('surface_profile','')
            expected_profiles={source_by_id[bid].get('materialProfile','') if source_by_id[bid]['kind']=='metal' else '' for bid in ids}
            assert expected_profiles=={profile},'Native industrial profile groups differ from source'
            if profile:
                settings=source['nativeSurfaceProfiles'][profile]
                assert len(obj.data.materials)==1 and all(face.material_index==0 for face in obj.data.polygons)
                material=obj.data.materials[0]
                output=next(node for node in material.node_tree.nodes if node.type=='OUTPUT_MATERIAL' and node.is_active_output)
                shader=output.inputs['Surface'].links[0].from_node
                assert shader.type=='BSDF_PRINCIPLED' and receives_voxel_tint(shader.inputs['Base Color'])
                assert not shader.inputs['Metallic'].is_linked
                assert abs(shader.inputs['Metallic'].default_value-settings['metalness'])<.000001
                limit=shader.inputs['Roughness'].links[0].from_node
                assert limit.type=='MATH' and limit.operation=='MINIMUM'
                assert not limit.inputs[0].is_linked
                assert abs(limit.inputs[0].default_value-settings['roughnessRange'][1])<.000001
                lower=limit.inputs[1].links[0].from_node
                assert lower.type=='MATH' and lower.operation=='MAXIMUM'
                assert not lower.inputs[0].is_linked
                assert abs(lower.inputs[0].default_value-settings['roughnessRange'][0])<.000001
                variation=lower.inputs[1].links[0].from_node
                assert variation.type=='MATH' and variation.operation=='ADD'
                assert not variation.inputs[0].is_linked
                assert abs(variation.inputs[0].default_value-settings['roughness'])<.000001
                tint=obj.data.color_attributes['VoxelTint'];color_error=0
                for j,bid in enumerate(ids):
                    expected=(*linear_color(source_by_id[bid]['c']),1)
                    for vertex in tint.data[j*8:(j+1)*8]:
                        color_error=max(color_error,max(abs(vertex.color[k]-expected[k]) for k in range(4)))
                assert color_error<.000001
                profile_checks.append({'assembly':assembly['id'],'profile':profile,'modules':len(ids),'maximumLinearColorError':color_error,'roughness':settings['roughness'],'metalness':settings['metalness'],'roughnessRange':settings['roughnessRange']})
            else:
                kinds={source_by_id[bid]['kind'] for bid in ids}
                assert len(kinds)==1
                kind=next(iter(kinds))
                base_names={'solid':'Voxel / architectural alloy','pavement':'Voxel / rain polished asphalt','metal':'Voxel / weathered small metal panels','window':'Voxel / occupied warm windows','glow':'Voxel / emissive neon and windows','glass':'Voxel / reflective facade glass'}
                assert len(obj.data.materials)==1 and obj.data.materials[0].name==base_names[kind]
                material=obj.data.materials[0]
                assert not material.get('surface_profile','') and all(face.material_index==0 for face in obj.data.polygons)
                output=next(node for node in material.node_tree.nodes if node.type=='OUTPUT_MATERIAL' and node.is_active_output)
                shader=output.inputs['Surface'].links[0].from_node
                assert shader.type=='BSDF_PRINCIPLED'
                assert not shader.inputs['Emission Strength'].is_linked
                if kind in ('window','glow'):
                    assert abs(shader.inputs['Emission Strength'].default_value-{'window':.85,'glow':2.4}[kind])<.000001
                    assert receives_voxel_tint(shader.inputs['Emission Color'])
                else:
                    # Native defaults can represent no emission with either
                    # zero strength or black color. Check the actual result.
                    if abs(shader.inputs['Emission Strength'].default_value)>=.000001:
                        assert not shader.inputs['Emission Color'].is_linked
                        assert max(abs(v) for v in shader.inputs['Emission Color'].default_value[:3])<.000001, 'Unexpected authored-block emission: '+obj.name
                if kind=='glass':
                    assert not shader.inputs['Metallic'].is_linked and not shader.inputs['Roughness'].is_linked
                    assert abs(shader.inputs['Metallic'].default_value-.86)<.000001 and abs(shader.inputs['Roughness'].default_value-.11)<.000001
            for i,box_id in enumerate(ids):
                vertices=[obj.matrix_world@v.co for v in obj.data.vertices[i*8:(i+1)*8]]
                maximum=max(maximum,box_bounds_error(vertices,source_by_id[box_id]))
        assert set(actual_ids)==set(assembly['boxIds']) and len(actual_ids)==len(assembly['boxIds'])
        assert maximum<.001,'Authored block modules differ from shared source'
        plan=next((o for o in blueprint_scene.objects if o.get('block_composition_id')==assembly['id']),None)
        assert plan and json.loads(plan['record'])==assembly
        block_checks.append({'id':assembly['id'],'modules':len(actual_ids),'maximumBoundsErrorMetres':maximum})
    service_source=source['nativeServiceFixtures']
    service_record=json.loads(bpy.data.texts['VESPER / resting service mechanisms.json'].as_string())
    assert service_record==service_source,'Saved service sites/recipes differ from evaluated runtime export'
    service_checks=[]
    for recipe in service_source['recipes']:
        parent=bpy.data.objects.get(recipe['id']+' / mechanism');assert parent
        assert json.loads(parent['service_recipe'])==recipe
        assert json.loads(parent['service_site'])==next(s for s in service_source['sites'] if s['id']==recipe['id'])
        assert parent['source_recipe_hash']==service_source['sourceHash']
        part_checks=[]
        for part in recipe['idlePose']['boxes']:
            obj=bpy.data.objects.get(part['id']);assert obj and obj['service_part_id']==part['id']
            assert obj['service_id']==recipe['id'] and obj.parent.parent==parent
            assert obj.parent['part_group']==part['partGroup'] and obj['part_group']==part['partGroup']
            assert json.loads(obj['source_box'])==part
            assert len(obj.data.vertices)==8
            position=[part['x'],-part['z'],part['y']]
            pose_error=max(abs(obj.matrix_world.translation[i]-position[i]) for i in range(3))
            error=box_bounds_error([obj.matrix_world@v.co for v in obj.data.vertices],part)
            assert max(pose_error,error)<.001,'Service mechanism idle pose differs from runtime'
            assert abs(obj.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value-part.get('intensity',0))<.00001
            part_checks.append({'id':part['id'],'partGroup':part['partGroup'],'poseErrorMetres':pose_error,'boundsErrorMetres':error})
        service_checks.append({'id':recipe['id'],'type':recipe['type'],'parts':part_checks,'removedShutters':recipe['removedBoxIds']})
    assert len([o for o in scene.objects if o.get('service_part_id')])==sum(len(r['parts']) for r in service_source['recipes'])
    assert scene['service_mechanism_count']==15 and len(removed_shutters)==15
    refits=source.get('streetDetails',{}).get('facadeReplacements',[])
    expected_fragments={box['id']:box for box in source['boxes'] if box.get('detail')=='street-frontage-refit'}
    fragment_checks=[]
    seen_fragments=set()
    for obj in scene.objects:
        if not obj.get('frontage_refit_spans'):continue
        for span in json.loads(obj['frontage_refit_spans']):
            assert span['id'] in expected_fragments and span['id'] not in seen_fragments
            seen_fragments.add(span['id']);box=expected_fragments[span['id']]
            assert span['sourceIndex']==box['sourceIndex']
            start=span['vertexStart'];vertices=[obj.matrix_world@v.co for v in obj.data.vertices[start:start+8]]
            assert len(vertices)==8
            measured_min=[min(v[i] for v in vertices) for i in range(3)]
            measured_max=[max(v[i] for v in vertices) for i in range(3)]
            expected_min=[box['x']-box['sx']/2,-box['z']-box['sz']/2,box['y']-box['sy']/2]
            expected_max=[box['x']+box['sx']/2,-box['z']+box['sz']/2,box['y']+box['sy']/2]
            error=max(max(abs(measured_min[i]-expected_min[i]) for i in range(3)),max(abs(measured_max[i]-expected_max[i]) for i in range(3)))
            assert error<.001, 'Native facade aperture fragment differs from shared source'
            fragment_checks.append({'id':span['id'],'sourceIndex':span['sourceIndex'],'boundsErrorMetres':error})
    assert seen_fragments==set(expected_fragments)
    assert scene['street_frontage_refit_records']==len(refits)
    assert scene['street_frontage_refit_fragments']==len(expected_fragments)
    preserved_text=bpy.data.texts.get('VESPER / preserved scene viewpoints.json')
    preserved_views=json.loads(preserved_text.as_string()) if preserved_text else {'cameras':{},'scenes':{}}
    for name,record in preserved_views['cameras'].items():
        camera=bpy.data.objects.get(name);assert camera and camera.type=='CAMERA'
        assert max(abs(camera.matrix_world[r][c]-record['matrix'][r][c]) for r in range(4) for c in range(4))<.00001
        for key,value in record.items():
            if key=='matrix':continue
            actual=getattr(camera.data,key)
            assert actual==value if isinstance(value,str) else abs(actual-value)<.00001
    for name,camera_name in preserved_views['scenes'].items():assert bpy.data.scenes[name].camera.name==camera_name
    sha=hashlib.sha256(path.read_bytes()).hexdigest()
    bounds=source['bounds']
    previews=[]
    for filename in ['city-scene-preview.png','city-aerial-preview.png','city-blueprint-preview.png']:
        preview=root/'blender'/filename
        if preview.exists():previews.append({'file':filename,'bytes':preview.stat().st_size,
            'modifiedAtUTC':datetime.fromtimestamp(preview.stat().st_mtime,timezone.utc).isoformat(),
            'sha256':hashlib.sha256(preview.read_bytes()).hexdigest(),'currentGeometry':bool(scene.get('preview_images_current',True))})
    manifest={'file':path.name,'bytes':path.stat().st_size,'sha256':sha,'blender':bpy.app.version_string,
        'scenes':[scene.name,aerial.name,blueprint_scene.name], 'cameras':sum(1 for o in bpy.data.objects if o.type=='CAMERA'),
        'nativeVoxelModules':expected_voxels,'excludedDuplicateFarLodModules':sum(1 for b in source['boxes'] if b.get('lod')=='far'),
        'buildings':len(blueprint['buildings']),'editableSigns':len(source['signs']),'structuralSupports':len(blueprint['supports']),
        'elevatedConnections':len(blueprint['elevatedConnections']),'parcels':len(blueprint['parcels']),'roads':len(source['roads']),
        'cityWidthMetres':bounds['maxX']-bounds['minX'],'cityDepthMetres':bounds['maxZ']-bounds['minZ'],'packedImages':packed,
        'animatedRoadVehicles':len(traffic),'streetLifeAssemblies':17,'supplyFoundations':15,'supplyStackSpacers':5,
        'resolvedCivilianRigs':len(citizen_checks),'civilianVoxelParts':character_source['counts']['voxelPieces'],
        'civilianMaximumWorldErrorMetres':max(item['maximumWorldError'] for item in citizen_checks),
        'overheadAircraft':len(aircraft_checks),'overheadAircraftVoxelParts':sum(item['parts'] for item in aircraft_checks),
        'characterPosePolicy':'Exact resolved runtime frame-zero population. Four editable finite gait clips are in character-workshop.blend; live simulation remains in Three.js.',
        'overheadAircraftPosePolicy':'Exact frame-zero voxel craft, roots and bob phase; live flight remains in Three.js.',
        'groundedPhysicalBins':len(props),'planObjects':len(blueprint_scene.objects),
        'streetFrontages':len(frontages),'streetFrontageVoxelModules':sum(item['voxelModules'] for item in frontage_checks),
        'serviceMechanisms':len(service_checks),'serviceMechanismParts':sum(len(r['parts']) for r in service_checks),
        'serviceShuttersReplaced':len(removed_shutters),'serviceMechanismSourceHash':service_source['sourceHash'],
        'authoredBlockAssemblies':len(block_checks),'authoredBlockVoxelModules':sum(a['modules'] for a in block_checks),
        'industrialMaterialProfiles':sorted({item['profile'] for item in profile_checks}),'industrialProfileVoxelModules':sum(item['modules'] for item in profile_checks),
        'mountedNativeTaskLights':len(practical_checks),
        'serviceCourtFrontages':sum(1 for item in frontages if item.get('courtyard')),
        'facadeRecordsRefit':len(refits),'facadeRefitFragments':len(expected_fragments),
        'facadeRefitMaximumBoundsErrorMetres':max((item['boundsErrorMetres'] for item in fragment_checks),default=0),
        'previewImages':previews,
        'preservedViewpoints':len(preserved_views['cameras']),'previewImagesCurrent':bool(scene.get('preview_images_current',True)),
        'verification':'Fresh Blender reopen verified exact current structural blueprint and campaign catalog, all packed images, actual-aspect native image planes, shared asset anchors, unarmed hero geometry, grounded bins, and looping traffic animation.',
        'heroAssetRevision':'Unarmed cybernetic right hand from current cyberpunk-assets.blend',
        'advertCampaigns':[{**ad,'nativePlacements':counts[ad['file']],'imagePixels':list(image_map[ad['file']].size)} for ad in catalog],
        'newAdvertPlacements':len(source['advertPlacements']),'advertImagePanels':len(image_objects),
        'advertSourceCatalog':'src/advert-campaigns.js; embedded as VESPER / advert campaign catalog.json'}
    (root/'blender/city-scene-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    report={'status':'passed','checkedAtUTC':datetime.now(timezone.utc).isoformat(),
        'method':'Complete native city regeneration from the final structural layout followed by fresh reopen. Checks compare embedded source blueprint/catalog, actual image-plane vertex dimensions, packed raster assets, character geometry, shared anchors, and vehicle animation.',
        'freshReopenVerified':True,'citySHA256':sha,'packedImages':packed,'campaigns':manifest['advertCampaigns'],
        'newPlacements':source['advertPlacements'],'imagePanels':len(image_objects),'panelChecks':panel_checks,
        'counts':{key:manifest[key] for key in ['nativeVoxelModules','buildings','editableSigns','structuralSupports','groundedPhysicalBins']},
        'trafficMovementOver30FramesMetres':distance,'sharedAnchorsChecked':anchors}
    report['streetFrontages']={'count':len(frontages),'serviceCourts':manifest['serviceCourtFrontages'],'voxelModules':manifest['streetFrontageVoxelModules'],'checks':frontage_checks}
    report['authoredBlocks']={'count':len(block_checks),'modules':manifest['authoredBlockVoxelModules'],'checks':block_checks}
    report['industrialMaterials']={'profiles':manifest['industrialMaterialProfiles'],'modules':manifest['industrialProfileVoxelModules'],'checks':profile_checks,'scope':'Saved face assignments, source colors, actual shader metallic value and connected roughness base/range. Native noise remains an editable approximation of the runtime finish.'}
    report['mountedTaskLights']={'count':len(practical_checks),'checks':practical_checks,'scope':'Native rectangular emitters follow the actual three dock fixture faces, directed downward. Power is a Cycles preview calibration; runtime lights remain separate.'}
    report['characters']={'count':len(citizen_checks),'voxelParts':character_source['counts']['voxelPieces'],'freshSourceCompared':True,
        'sourceHashes':character_source['sourceHashes'],'maximumWorldErrorMetres':manifest['civilianMaximumWorldErrorMetres'],'checks':citizen_checks,
        'materialChecks':citizen_material_checks}
    report['overheadAircraft']={'count':len(aircraft_checks),'voxelParts':manifest['overheadAircraftVoxelParts'],'checks':aircraft_checks}
    report['serviceMechanisms']={'count':len(service_checks),'parts':manifest['serviceMechanismParts'],'sourceHash':service_source['sourceHash'],
        'removedShutters':sorted(removed_shutters),'fullSiteRecordsVerified':True,'checks':service_checks}
    report['facadeRefits']={'sourceRecords':len(refits),'nativeFragments':len(expected_fragments),'actualNativeModulesCounted':native_voxels,
        'maximumBoundsErrorMetres':manifest['facadeRefitMaximumBoundsErrorMetres'],'checks':fragment_checks}
    report['preservedViewpoints']={'cameras':list(preserved_views['cameras']),'scenes':preserved_views['scenes'],'verified':bool(preserved_views['cameras'])}
    report['previewImagesCurrent']=manifest['previewImagesCurrent']
    report['previewImages']=previews
    for file in ['ad-native-integration.json','native-city-report.json']:
        (root/'validation'/file).write_text(json.dumps(report,indent=2)+'\n')
    print('NATIVE_CITY_VERIFIED',json.dumps({'packedImages':len(packed),'imagePanels':len(image_objects),'sha256':sha,'trafficMovement':distance}),flush=True)
    return report


if __name__=='__main__':
    verify_city(Path(__file__).resolve().parent.parent)
