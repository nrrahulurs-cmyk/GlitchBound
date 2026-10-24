"""Report Japanese-script text in the currently open Blender file.

Run with: blender --background <file.blend> --python blender/check_english_text.py
This scans datablock text and names only; it does not inspect image pixels.
"""

import bpy
import sys
import unicodedata


JAPANESE_RANGES = (
    (0x3040, 0x309F),  # Hiragana
    (0x30A0, 0x30FF),  # Katakana
    (0x31F0, 0x31FF),  # Katakana phonetic extensions
    (0x3400, 0x4DBF),  # CJK Extension A
    (0x4E00, 0x9FFF),  # CJK Unified Ideographs
    (0xF900, 0xFAFF),  # CJK compatibility ideographs
    (0xFF66, 0xFF9D),  # Halfwidth Katakana
    (0x1AFF0, 0x1AFFF),  # Kana extended-B
    (0x1B000, 0x1B16F),  # Kana supplement and extended-A
    (0x20000, 0x2FA1F),  # CJK extensions and compatibility supplement
)
JAPANESE_MARKS = {0x3005, 0x3006, 0x3007, 0x303B}


def japanese_characters(value):
    for character in value:
        codepoint = ord(character)
        if codepoint in JAPANESE_MARKS or any(start <= codepoint <= end for start, end in JAPANESE_RANGES):
            yield character


def inspect(label, value, findings):
    if not value:
        return
    characters = list(dict.fromkeys(japanese_characters(str(value))))
    if characters:
        details = ', '.join(
            'U+{:04X} {} ({})'.format(ord(character), unicodedata.name(character, 'UNNAMED CHARACTER'), character)
            for character in characters
        )
        findings.append('{}: {}'.format(label, details))


def inspect_property(label, value, findings):
    if isinstance(value, str):
        inspect(label, value, findings)
    elif hasattr(value, 'items'):
        for key, nested in value.items():
            inspect(label + ' key', key, findings)
            inspect_property(label + ' / ' + str(key), nested, findings)
    elif isinstance(value, (list, tuple)) or type(value).__name__ == 'IDPropertyArray':
        for index, nested in enumerate(value):
            inspect_property('{}[{}]'.format(label, index), nested, findings)


def main():
    findings = []
    for scene in bpy.data.scenes:
        inspect('Scene name "{}"'.format(scene.name), scene.name, findings)
        for marker in scene.timeline_markers:
            inspect('Timeline marker in "{}"'.format(scene.name), marker.name, findings)
    for collection in bpy.data.collections:
        inspect('Collection name', collection.name, findings)
    for obj in bpy.data.objects:
        inspect('Object name', obj.name, findings)
        if obj.data is not None:
            inspect('Object data name for "{}"'.format(obj.name), obj.data.name, findings)
        if obj.type == 'FONT' and hasattr(obj.data, 'body'):
            inspect('Font object body "{}"'.format(obj.name), obj.data.body, findings)
    for text in bpy.data.texts:
        inspect('Text datablock name', text.name, findings)
        inspect('Text datablock body "{}"'.format(text.name), text.as_string(), findings)
    for datablocks in (bpy.data.materials, bpy.data.actions, bpy.data.fonts, bpy.data.worlds):
        for datablock in datablocks:
            inspect('{} name'.format(type(datablock).__name__), datablock.name, findings)
    for datablocks in (bpy.data.objects, bpy.data.collections, bpy.data.scenes, bpy.data.materials,
                       bpy.data.actions, bpy.data.fonts, bpy.data.worlds, bpy.data.texts):
        for datablock in datablocks:
            for key, value in datablock.items():
                inspect_property('{} "{}" property {}'.format(type(datablock).__name__, datablock.name, key),
                                 value, findings)

    if findings:
        print('Japanese-script text found in Blender datablocks:')
        for finding in findings:
            print('  ' + finding)
        print('Image pixels and packed image lettering were not inspected.')
        return 1
    print('No Japanese-script text found in scanned Blender datablocks.')
    print('Image pixels and packed image lettering were not inspected.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
