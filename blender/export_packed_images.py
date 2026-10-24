"""Export a read-only copy of packed images for visual inspection.

Run with: blender --background <file.blend> --python blender/export_packed_images.py -- <output-dir>
The open .blend is not saved or modified.
"""

import bpy
import re
import sys
from pathlib import Path


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args:
        raise SystemExit('Pass an output directory after --.')
    output_dir = Path(args[0]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    packed = [image for image in bpy.data.images if image.packed_file]
    for index, image in enumerate(packed, 1):
        stem = re.sub(r'[^A-Za-z0-9._-]+', '_', Path(image.name).stem).strip('._') or 'image'
        path = output_dir / '{:02d}_{}.png'.format(index, stem)
        image.filepath_raw = str(path)
        image.file_format = 'PNG'
        image.save()
        print('PACKED_IMAGE {} {} {}x{}'.format(path.name, image.name, image.size[0], image.size[1]))
    print('PACKED_IMAGE_TOTAL {}'.format(len(packed)))


if __name__ == '__main__':
    main()
