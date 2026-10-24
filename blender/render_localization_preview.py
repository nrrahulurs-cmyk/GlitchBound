"""Render a temporary preview of the updated Blender city text.

Run with: blender --background blender/neon-district-city.blend --python blender/render_localization_preview.py -- <output.png>
Render settings change only in memory; the .blend file is not saved.
"""

import bpy
import sys
from pathlib import Path


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args:
        raise SystemExit('Pass an output PNG path after --.')
    scene = bpy.data.scenes.get('VESPER / street composition')
    if scene is None or scene.camera is None:
        raise RuntimeError('The Vesper street scene or its saved camera is missing.')
    output = Path(args[0]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 4
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True, scene=scene.name)
    print('LOCALIZATION_PREVIEW {}'.format(output))


if __name__ == '__main__':
    main()
