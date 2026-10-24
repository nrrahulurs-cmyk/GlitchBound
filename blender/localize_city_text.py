"""Update saved city text from the shared English source without rebuilding geometry.

Dry run: blender --background blender/neon-district-city.blend --python blender/localize_city_text.py
Write:   blender --background blender/neon-district-city.blend --python blender/localize_city_text.py -- --write
"""

from pathlib import Path
import bpy
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'blender'))
from native_layout import read_native_layout


REPLACEMENTS = {
    '\u795e\u7d4c\u56de\u8def': 'NEURAL CIRCUIT',
    '\u8a18\u61b6': 'MEMORY',
    '\u5922': 'DREAMS',
    '\u8996\u899a': 'OPTICS',
    '\u4fee\n\u7406': 'REPAIR',
    '\u591c\n\u5e02': 'MARKET',
    '\u96fb\n\u8133': 'CYBERNETICS',
    '\u8a3a\n\u7642': 'CLINIC',
    '\u97f3\n\u697d': 'MUSIC',
    '\u9eba\n\u5c4b': 'NOODLES',
    '\u4fee\u7406': 'REPAIR',
    '\u591c\u5e02': 'NIGHT MARKET',
    '\u96fb\u8133': 'CYBERNETICS',
    '\u8a3a\u7642': 'CLINIC',
    '\u97f3\u697d': 'MUSIC',
    '\u9eba\u5c4b': 'NOODLES',
}
SIGN_CURVE_RE = re.compile(r'^(\d+) / .* / lettering(?:\.(\d+))?$')
LETTERING_SUFFIX_RE = re.compile(r' / lettering(\.\d+)?$')
GROUP_SUFFIXES = (
    ' / enclosure', ' / neon border', ' / campaign panel', ' / editable image campaign',
)


def replace_known(value):
    result = str(value)
    for original, english in REPLACEMENTS.items():
        result = result.replace(original, english)
    return result


def geometry_counts():
    meshes = list(bpy.data.meshes)
    return {
        'objects': len(bpy.data.objects),
        'meshes': len(meshes),
        'vertices': sum(len(mesh.vertices) for mesh in meshes),
        'polygons': sum(len(mesh.polygons) for mesh in meshes),
    }


def source_group_name(current_name, index, sign_name):
    prefix = '{:02d} / '.format(index)
    if not current_name.startswith(prefix):
        return None
    lettering = LETTERING_SUFFIX_RE.search(current_name)
    if lettering:
        return prefix + sign_name + ' / lettering' + (lettering.group(1) or '')
    for suffix in GROUP_SUFFIXES:
        if current_name.endswith(suffix):
            return prefix + sign_name + suffix
    return None


def main():
    write = '--write' in sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else False
    layout = read_native_layout(ROOT)
    signs = layout.get('signs', [])
    before_geometry = geometry_counts()
    source_font_objects = {}
    for obj in bpy.data.objects:
        if obj.type != 'FONT' or obj.data is None:
            continue
        match = SIGN_CURVE_RE.match(obj.data.name)
        if match:
            source_font_objects.setdefault(int(match.group(1)), []).append((int(match.group(2) or 0), obj))

    changed_bodies = 0
    changed_names = 0
    changed_curves = 0
    font_fits = []
    for index, sign in enumerate(signs):
        sign_name = str(sign.get('text', 'SIGN'))
        for datablock in list(bpy.data.objects) + list(bpy.data.meshes) + list(bpy.data.curves):
            new_name = source_group_name(datablock.name, index, sign_name)
            if new_name and new_name != datablock.name:
                datablock.name = new_name
                changed_names += 1

        rows = source_font_objects.get(index, [])
        if not rows:
            continue
        vertical = sign.get('vertical')
        glyphs = str(vertical) if vertical else ''
        desired_rows = ['\n'.join(glyphs), sign_name] if vertical else [sign_name, str(sign.get('sub', ''))]
        if len(rows) != len(desired_rows):
            raise RuntimeError('Sign {} has {} Blender text rows; expected {}'.format(index, len(rows), len(desired_rows)))
        for row_index, obj in sorted(rows, key=lambda pair: pair[0]):
            if row_index >= len(desired_rows):
                raise RuntimeError('Unexpected text row {} for sign {}'.format(row_index, index))
            desired = desired_rows[row_index]
            if obj.data.body != desired:
                obj.data.body = desired
                changed_bodies += 1
            if desired and obj.name != desired:
                obj.name = desired
                changed_names += 1
            if vertical:
                max_width = sign['w'] * .86 if row_index == 0 else sign['w'] * .9
            else:
                max_width = sign['w'] * .9
            font_fits.append((obj, max_width))

    bpy.context.view_layer.update()
    for obj, _ in font_fits:
        obj.scale.x = 1.0
    bpy.context.view_layer.update()
    for obj, max_width in font_fits:
        width = max(vertex[0] for vertex in obj.bound_box) - min(vertex[0] for vertex in obj.bound_box)
        if width > 0:
            obj.scale.x = min(1.0, max_width / width)

    named_groups = (
        bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.collections,
        bpy.data.scenes, bpy.data.materials, bpy.data.actions, bpy.data.fonts,
        bpy.data.worlds, bpy.data.cameras, bpy.data.lights,
    )
    for datablocks in named_groups:
        for datablock in datablocks:
            updated = replace_known(datablock.name)
            if updated != datablock.name:
                datablock.name = updated
                changed_names += 1
    for text in bpy.data.texts:
        updated_name = replace_known(text.name)
        if updated_name != text.name:
            text.name = updated_name
            changed_names += 1
        updated_body = replace_known(text.as_string())
        if text.name == 'VESPER / authoritative city blueprint.json':
            updated_body = (ROOT / 'public' / 'blueprint' / 'blueprint.json').read_text(encoding='utf-8')
        if updated_body != text.as_string():
            text.clear()
            text.write(updated_body)
            changed_curves += 1

    current_blueprint = json.loads((ROOT / 'public' / 'blueprint' / 'blueprint.json').read_text(encoding='utf-8'))
    current_sign_records = {record.get('id'): record for record in current_blueprint.get('signs', [])}
    changed_records = 0
    for obj in bpy.data.objects:
        record_text = obj.get('record')
        if not isinstance(record_text, str):
            continue
        try:
            previous_record = json.loads(record_text)
        except (TypeError, ValueError):
            updated = replace_known(record_text)
        else:
            current_record = current_sign_records.get(previous_record.get('id'))
            updated = json.dumps(current_record, ensure_ascii=False) if current_record else replace_known(record_text)
        if updated != record_text:
            obj['record'] = updated
            changed_records += 1

    after_geometry = geometry_counts()
    if before_geometry != after_geometry:
        raise RuntimeError('Geometry/object counts changed: {} -> {}'.format(before_geometry, after_geometry))
    print('CITY_TEXT_UPDATE signs={} text_bodies={} renamed_datablocks={} text_datablocks={} object_records={}'.format(
        len(signs), changed_bodies, changed_names, changed_curves, changed_records))
    print('GEOMETRY_COUNTS {}'.format(json.dumps(after_geometry, sort_keys=True)))
    if write:
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
        print('SAVED {}'.format(bpy.data.filepath))
    else:
        print('DRY_RUN: file not saved; rerun with -- --write to apply.')


if __name__ == '__main__':
    main()
