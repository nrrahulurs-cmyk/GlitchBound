"""Render three bounded inspection views without resaving the pose workshop."""
from pathlib import Path
import hashlib
import json
import sys
import time
import bpy

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'blender'))
from hero_articulation import SOURCE_TEXT,descendants,verify_workshop
path=ROOT/'blender/hero-pose-workshop.blend'
before=hashlib.sha256(path.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(path))
source=json.loads(bpy.data.texts[SOURCE_TEXT].as_string());verify_workshop(source)
scene=bpy.data.scenes['VEX / articulated hero inspection'];bpy.context.window.scene=scene
views=[]
for camera,file,solo in [('Hero three poses','hero-pose-preview.png',False),
                         ('Hero knee and ankle','hero-knee-preview.png',True),
                         ('Hero side articulation','hero-side-preview.png',True)]:
    for root in [obj for obj in scene.objects if obj.get('hero_pose_id')]:
        hidden=solo and root['hero_pose_id']!='HERO-ONE-RISER'
        for part in descendants(root):part.hide_render=hidden
    scene.camera=bpy.data.objects[camera];scene.render.filepath=str(ROOT/'blender'/file)
    start=time.monotonic();bpy.ops.render.render(write_still=True)
    image=ROOT/'blender'/file
    views.append({'camera':camera,'file':'blender/'+file,'sha256':hashlib.sha256(image.read_bytes()).hexdigest(),
                  'seconds':time.monotonic()-start,'onlyRaisedPose':solo})
assert hashlib.sha256(path.read_bytes()).hexdigest()==before
report_path=ROOT/'validation/hero-articulation-native.json';report=json.loads(report_path.read_text())
report['renderStatus']='captured; visual review pending'
report['renders']={'workshopSHA256':before,'engine':'Cycles CPU','samples':scene.cycles.samples,'threads':2,
                   'resolution':[scene.render.resolution_x,scene.render.resolution_y],'views':views,'nativeUnchanged':True}
report_path.write_text(json.dumps(report,indent=2))
print('HERO_RENDER '+json.dumps(report['renders']),flush=True)
