"""Refresh packed campaigns in the existing city without rebuilding architecture.

Run from the project root: blender --background --python blender/refresh_adverts.py
All catalog PNGs must be present first. Only image panels, campaign materials,
and campaign/blueprint metadata change. The street preview is rendered once.
"""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from array import array
import bpy
import hashlib
import json
import math
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'blender'))
from advert_materials import load_ad_material, material_image, image_quad, panel_dimensions

NODE = shutil.which('node') or r'C:\Program Files\nodejs\node.exe'
script = 'import {createCityLayout} from ' + json.dumps((ROOT / 'src' / 'city-layout.js').as_uri()) + ';'
script += 'import {ADVERT_CAMPAIGNS} from ' + json.dumps((ROOT / 'src' / 'advert-campaigns.js').as_uri()) + ';'
script += 'const city=createCityLayout();process.stdout.write(JSON.stringify({signs:city.signs,blueprint:city.blueprint,advertPlacements:city.advertPlacements,advertCampaigns:ADVERT_CAMPAIGNS}));'
data = json.loads(subprocess.run([NODE, '--input-type=module', '-e', script], capture_output=True, text=True, check=True).stdout)
catalog = data['advertCampaigns']
assert len(catalog) == 16 and [ad['index'] for ad in catalog] == list(range(16))
expected_files = ['advert-portrait.png'] + [ad['file'] for ad in catalog]
for file_name in expected_files:
    assert (ROOT / 'public' / 'assets' / file_name).is_file(), 'Missing campaign: ' + file_name

city_path = ROOT / 'blender' / 'neon-district-city.blend'
bpy.ops.wm.open_mainfile(filepath=str(city_path))
image_objects = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name.endswith(' / editable image campaign')]
by_index = {int(obj.name.split(' / ', 1)[0]): obj for obj in image_objects}
sign_records = [(i, sign) for i, sign in enumerate(data['signs']) if sign.get('art') in ['portrait', 'dancer', 'campaign']]
assert len(by_index) == len(sign_records), 'Image panel count changed; bounded refresh cannot create or remove mounts'
original_matrices = {i: list(value for row in obj.matrix_world for value in row) for i, obj in by_index.items()}
original_scene_counts = {scene.name: len(scene.objects) for scene in bpy.data.scenes}


def static_geometry_digest():
    digest = hashlib.sha256()
    for obj in sorted(bpy.data.objects, key=lambda value: value.name):
        if obj.name.endswith(' / editable image campaign'):
            continue
        digest.update(obj.name.encode())
        digest.update(str(tuple(value for row in obj.matrix_world for value in row)).encode())
        if obj.type == 'MESH':
            values = array('f', [0.0]) * (len(obj.data.vertices) * 3)
            obj.data.vertices.foreach_get('co', values)
            digest.update(values.tobytes())
            digest.update(str((len(obj.data.polygons), len(obj.data.edges))).encode())
    return digest.hexdigest()


def local_sign_pos(sign, dx, dy, dz):
    cosine, sine = math.cos(sign.get('ry', 0)), math.sin(sign.get('ry', 0))
    x = sign['x'] + dx * cosine + dz * sine
    y = sign['y'] + dy
    z = sign['z'] - dx * sine + dz * cosine
    return x, -z, y


before_digest = static_geometry_digest()
materials = {}
for ad in catalog:
    load_ad_material(ROOT, ad['file'], materials)
load_ad_material(ROOT, 'advert-portrait.png', materials, 2.4)
file_by_index = {ad['index']: ad['file'] for ad in catalog}
counts = Counter()
panel_checks = []
for index, sign in sign_records:
    obj = by_index[index]
    file_name = file_by_index[sign.get('adIndex', 0)] if sign.get('art') == 'campaign' else 'advert-portrait.png'
    material = materials[file_name]
    image = material_image(material)
    width, height = panel_dimensions(sign, image)
    old_mesh = obj.data
    mesh = bpy.data.meshes.new(f'{index:02d} / {sign["text"]} / campaign panel')
    mesh.from_pydata(image_quad(sign, image, local_sign_pos), [], [(0, 1, 2, 3)])
    mesh.materials.append(material)
    uv = mesh.uv_layers.new(name='Campaign UV / full uncropped image')
    for i, value in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[i].uv = value
    mesh.update()
    obj.data = mesh
    obj.name = f'{index:02d} / {sign["text"]} / editable image campaign'
    if old_mesh.users == 0:
        bpy.data.meshes.remove(old_mesh)
    obj['sign_id'] = sign['id']
    obj['campaign_asset'] = file_name
    obj['campaign_id'] = sign.get('campaignId', 'portrait')
    obj['image_fit'] = 'contain' if sign.get('art') == 'campaign' else 'preserved landmark'
    obj['source_image_dimensions'] = json.dumps(list(image.size))
    obj['panel_dimensions'] = json.dumps([width, height])
    assert original_matrices[index] == list(value for row in obj.matrix_world for value in row)
    assert width <= sign['w'] * .96 + 1e-7 and height <= sign['h'] * .96 + 1e-7
    if sign.get('art') == 'campaign':
        assert abs(width / height - image.size[0] / image.size[1]) < 1e-7
    counts[file_name] += 1
    panel_checks.append({'signId': sign['id'], 'file': file_name, 'dimensions': [width, height], 'imagePixels': list(image.size), 'fit': obj['image_fit']})

assert before_digest == static_geometry_digest(), 'Static architecture, mounts, or non-image asset geometry changed'
assert original_scene_counts == {scene.name: len(scene.objects) for scene in bpy.data.scenes}
for ad in catalog[4:]:
    placements = [p for p in data['advertPlacements'] if p['campaignId'] == ad['id']]
    assert counts[ad['file']] == 4 and len(set(p['district'] for p in placements)) == 2
for file_name in expected_files:
    assert counts[file_name] >= 1, 'A preserved or new campaign has no native placement: ' + file_name

blueprint_text = bpy.data.texts.get('VESPER / authoritative city blueprint.json')
assert blueprint_text
blueprint_text.clear()
blueprint_text.write(json.dumps(data['blueprint'], indent=2, ensure_ascii=False))
for sign in data['blueprint']['signs']:
    marker = bpy.data.objects.get(sign['id'] + ' / panel')
    if marker:
        marker['record'] = json.dumps(sign, ensure_ascii=False)
campaign_text = bpy.data.texts.get('VESPER / advert campaign catalog.json') or bpy.data.texts.new('VESPER / advert campaign catalog.json')
campaign_text.clear()
campaign_text.write(json.dumps({'campaigns': catalog, 'placements': data['advertPlacements']}, indent=2, ensure_ascii=False))
campaign_text.use_fake_user = True
for scene in bpy.data.scenes:
    scene['campaign_assets'] = json.dumps(sorted(expected_files))
    scene['campaign_count'] = len(catalog)
    scene['new_campaign_placements'] = len(data['advertPlacements'])
bpy.ops.wm.save_as_mainfile(filepath=str(city_path))

# Verify the self-contained result after reopening the saved file.
bpy.ops.wm.open_mainfile(filepath=str(city_path))
assert before_digest == static_geometry_digest()
assert original_scene_counts == {scene.name: len(scene.objects) for scene in bpy.data.scenes}
for file_name in expected_files:
    image = next((image for image in bpy.data.images if Path(image.filepath).name == file_name), None)
    assert image and image.packed_file and image.size[0] > 0 and image.size[1] > 0, 'Packed image missing after reopen: ' + file_name
for check in panel_checks:
    obj = next(obj for obj in bpy.data.objects if obj.get('sign_id') == check['signId'] and obj.get('campaign_asset'))
    assert obj['campaign_asset'] == check['file'] and len(obj.data.vertices) == 4
    assert list(material_image(obj.data.materials[0]).size) == check['imagePixels']

manifest_path = ROOT / 'blender' / 'city-scene-manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['bytes'] = city_path.stat().st_size
manifest['sha256'] = hashlib.sha256(city_path.read_bytes()).hexdigest()
manifest['packedImages'] = expected_files
manifest['advertCampaigns'] = [{**ad, 'nativePlacements': counts[ad['file']], 'imagePixels': next(check['imagePixels'] for check in panel_checks if check['file'] == ad['file'])} for ad in catalog]
manifest['newAdvertPlacements'] = len(data['advertPlacements'])
manifest['advertImagePanels'] = len(sign_records)
manifest['advertSourceCatalog'] = 'src/advert-campaigns.js; embedded as VESPER / advert campaign catalog.json'
manifest['verification'] += ' Campaign refresh preserved static geometry and object counts; fresh reopen verified all17 packed images,48 new placements, and uncropped actual-aspect campaign planes.'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
report = {'status': 'passed', 'checkedAtUTC': datetime.now(timezone.utc).isoformat(),
          'method': 'Bounded replacement of existing image-plane mesh data and materials. Original portrait geometry retained; all16 campaign designs use actual PNG aspect and complete UV bounds. Static architecture and mount geometry checked before and after fresh reopen.',
          'packedImages': expected_files, 'campaigns': manifest['advertCampaigns'], 'newPlacements': data['advertPlacements'],
          'imagePanels': len(sign_records), 'staticGeometrySHA256': before_digest, 'staticGeometryUnchanged': True,
          'sceneObjectCountsUnchanged': True, 'citySHA256': manifest['sha256'], 'freshReopenVerified': True, 'panelChecks': panel_checks}
(ROOT / 'validation' / 'ad-native-integration.json').write_text(json.dumps(report, indent=2) + '\n')
print('ADVERT_REFRESH_VERIFIED', json.dumps({'panels': len(sign_records), 'packedImages': len(expected_files), 'newPlacements': len(data['advertPlacements']), 'staticGeometryUnchanged': True}), flush=True)
scene = bpy.data.scenes['VESPER / street composition']
scene.render.filepath = str(ROOT / 'blender' / 'city-scene-preview.png')
bpy.ops.render.render(write_still=True, scene=scene.name)
print('ADVERT_STREET_PREVIEW_RENDERED', flush=True)
