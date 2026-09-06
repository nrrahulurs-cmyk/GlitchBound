"""NEON DISTRICT original voxel prop kit.

Run with Blender 5.x: blender --background --python build_assets.py
Each prop is authored in Blender coordinates (+Y is vehicle forward, Z is up),
then exported as an independent GLB in glTF coordinates (-Z forward, Y up).
Geometry is consolidated into one mesh per prop with a small material palette.
"""
from pathlib import Path
import math
import json
import random
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'public' / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

PALETTE = {}
def material(name, color, metallic=0.0, roughness=0.5, emission=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = min(emission, 5.0)
    PALETTE[name] = m

material('midnight ceramic', (0.019, 0.035, 0.075), .7, .31)
material('titanium navy', (.065, .105, .16), .78, .34)
material('gunmetal edge', (.20, .255, .32), .85, .28)
material('carbon rubber', (.013, .018, .026), .12, .92)
material('obsidian glass', (.018, .15, .21), .8, .14)
material('ion cyan', (.025, .85, 1.0), .25, .26, 3.2)
material('hot magenta', (1.0, .015, .21), .2, .3, 2.7)
material('hazard amber', (1.0, .35, .025), .2, .5, 1.1)
material('pale markings', (.68, .8, .83), .25, .45)
material('display black', (.003, .012, .023), .15, .35)
material('acid green', (.3, 1.0, .05), .1, .35, 2.6)
material('paper cream', (.82, .69, .48), .0, .8)
material('armor charcoal', (.012, .019, .028), .72, .34)
material('armor graphite', (.031, .043, .055), .72, .37)
material('armor bluegrey', (.075, .100, .121), .7, .4)
material('armor steel', (.14, .185, .21), .78, .3)
material('armor worn edge', (.22, .24, .25), .8, .37)
material('headlight white', (.68, .94, 1.0), .2, .25, 4.0)
material('signal red', (1.0, .006, .012), .2, .3, 3.4)
material('warm skin', (.24, .135, .091), .0, .78)
material('black fabric', (.013, .019, .023), .05, .96)
material('weathered khaki', (.16, .133, .095), .05, .8)

class Builder:
    def __init__(self, name):
        self.name = name
        self.verts = []
        self.faces = []
        self.slots = []
        self.face_materials = []

    def poly(self, vertices, faces, mat):
        if mat not in self.slots:
            self.slots.append(mat)
        slot = self.slots.index(mat)
        offset = len(self.verts)
        self.verts.extend(vertices)
        self.faces.extend(tuple(offset+i for i in f) for f in faces)
        self.face_materials.extend([slot]*len(faces))

    def box(self, pos, size, mat, rot=0):
        x,y,z = pos
        sx,sy,sz = (v*.5 for v in size)
        vertices = []
        for vx,vy,vz in [(-sx,-sy,-sz),(sx,-sy,-sz),(sx,sy,-sz),(-sx,sy,-sz),
                         (-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]:
            vertices.append((x+vx*math.cos(rot)-vy*math.sin(rot),
                             y+vx*math.sin(rot)+vy*math.cos(rot), z+vz))
        self.poly(vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)

    def wheel(self, x,y,z, radius, depth, mat, segments=12):
        vertices = []
        for dx in [-depth/2, depth/2]:
            for i in range(segments):
                a = 2*math.pi*i/segments
                vertices.append((x+dx,y+radius*math.sin(a),z+radius*math.cos(a)))
        faces = [tuple(reversed(range(segments))), tuple(range(segments,segments*2))]
        for i in range(segments):
            j = (i+1)%segments
            faces.append((i,j,j+segments,i+segments))
        self.poly(vertices, faces, mat)

    def finish(self):
        mesh = bpy.data.meshes.new(self.name+' geometry')
        mesh.from_pydata(self.verts, [], self.faces)
        for name in self.slots:
            mesh.materials.append(PALETTE[name])
        for poly,slot in zip(mesh.polygons,self.face_materials):
            poly.material_index = slot
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        bpy.context.collection.objects.link(obj)
        return obj

def interceptor():
    """Low, broad voxel street interceptor based on the approved concept silhouette."""
    b=Builder('K-77 INTERCEPTOR');rng=random.Random(77312)
    armor=['armor charcoal']*5+['armor graphite']*4+['armor bluegrey']*2+['titanium navy']
    b.box((0,0,.42),(2.25,4.72,.35),'armor charcoal')
    b.box((0,-.07,.675),(2.39,4.87,.28),'armor graphite')
    b.box((0,0,.265),(2.02,4.53,.15),'carbon rubber')
    # Hundreds of separate modular surface panels break up broad planes.
    for row in range(32):
        y=-2.42+row*.153
        halfwidth=1.17 + .14*max(0,1-abs(y)/2.7)
        height=.79+.11*(1-abs(y)/2.5)
        if y>1.25:height-=.055*(y-1.25)
        for side in [-1,1]:
            for col in range(3):
                x=side*(halfwidth-col*.135)
                z=height+col*.055
                b.box((x,y,z),(.143,.149,.115),rng.choice(armor))
            b.box((side*(halfwidth+.045),y,height-.135),(.13,.15,.11),rng.choice(armor))
            b.box((side*(halfwidth+.025),y,.48),(.11,.151,.13),rng.choice(armor))
        # Hood / engine deck tiled in visible 0.15 m voxels.
        if y>.68 or y<-.94:
            for col in range(13):
                x=-.93+col*.155
                top=height+.08
                if y< -1.05:top+=max(0,(y+2.4))*.07
                b.box((x,y,top),(.151,.15,.10),rng.choice(armor))
    # Windshield and rear glass have a five-step raked shape, a compact cabin.
    for tier in range(5):
        z=.98+tier*.072
        width=1.94-tier*.095;length=1.91-tier*.17
        b.box((0,-.21,z),(width,length,.085),'obsidian glass')
        for side in [-1,1]:
            b.box((side*(width/2+.025),-.21,z),(.07,length+.015,.083),'armor graphite')
            b.box((side*(width/2),-.66+tier*.03,z),(.095,.07,.09),'armor bluegrey')
    for row in range(8):
        for col in range(11):
            b.box((-.765+col*.153,-.66+row*.145,1.333),(.149,.14,.052),rng.choice(armor))
    # Six stepped rear engine louvers, white front optics and red rear light bar.
    for i in range(6):
        b.box((0,-1.17-i*.145,1.17-i*.04),(1.82+i*.035,.091,.05),'armor charcoal')
        b.box((0,-1.224-i*.145,1.18-i*.04),(1.72,.021,.022),'armor steel')
    b.box((0,-2.505,.735),(1.37,.04,.14),'display black')
    for j in range(11):
        b.box((-.60+j*.12,-2.531,.763),(.112,.027,.046),'signal red')
        b.box((-.60+j*.12,-2.534,.701),(.112,.024,.022),'signal red')
    b.box((0,2.535,.65),(1.97,.16,.17),'carbon rubber')
    b.box((0,2.62,.591),(2.21,.085,.09),'armor graphite')
    for side in [-1,1]:
        # Tiny modular bumper teeth / rear diffuser and readable fender seams.
        for i in range(6):
            b.box((side*(.29+i*.18),-2.52,.40),(.09,.19,.22),'armor charcoal')
            b.box((side*(.43+i*.134),2.57,.824),(.106,.032,.069),'headlight white')
        b.box((side*.98,-2.52,.60),(.51,.031,.092),'hazard amber')
        b.box((side*.93,-2.40,.305),(.38,.30,.13),'armor bluegrey')
        b.box((side*.93,-2.565,.30),(.27,.022,.060),'ion cyan')
        b.box((side*1.35,-.03,.365),(.08,2.45,.065),'ion cyan')
        for i in range(13):
            y=-.88+i*.135
            b.box((side*1.35,y,.73),(.037,.059,.115),'armor steel')
        b.box((side*1.357,-.24,.66),(.025,.84,.055),'display black')
        b.box((side*1.364,.00,.67),(.016,.23,.024),'ion cyan')
        b.box((side*1.02,.54,1.075),(.20,.24,.095),'armor graphite')
        b.box((side*1.066,.67,1.075),(.126,.027,.030),'headlight white')
        b.box((side*1.12,-.42,.94),(.06,.24,.054),'armor steel')
        for y in [-1.60,1.60]:
            b.wheel(side*1.20,y,.445,.445,.32,'carbon rubber',16)
            b.wheel(side*1.367,y,.445,.347,.025,'armor graphite',12)
            b.wheel(side*1.386,y,.445,.24,.025,'armor bluegrey',8)
            b.wheel(side*1.408,y,.445,.125,.025,'armor charcoal',8)
            b.wheel(side*1.426,y,.445,.065,.016,'ion cyan',8)
            for i in range(20):
                a=i/20*math.tau
                yy=y+math.sin(a)*.324;zz=.445+math.cos(a)*.324
                b.box((side*1.412,yy,zz),(.042,.074,.074),'ion cyan')
                b.box((side*1.20,y+math.sin(a)*.425,.445+math.cos(a)*.425),(.35,.055,.049),'carbon rubber')
            for i in range(8):
                a=i/8*math.tau
                b.box((side*1.416,y+math.sin(a)*.206,.445+math.cos(a)*.206),(.022,.065,.065),'armor steel')
            # Block stair wheel arches mirror the concept's broad shoulder profile.
            for delta,z,width in [(-.53,.68,.13),(-.43,.90,.18),(-.27,1.015,.20),(0,1.057,.35),(.27,1.015,.20),(.43,.90,.18),(.53,.68,.13)]:
                b.box((side*1.294,y+delta,z),(.27,width,.092),rng.choice(armor))
                b.box((side*1.434,y+delta,z-.042),(.027,width,.034),'armor bluegrey')
        for i in range(8):
            b.box((side*1.305,-2.30+i*.055,.60),(.075,.032,.105),'armor steel')
    # Hood technical decal made from tiny native voxels, no texture dependency.
    for ix in range(6):
        for iy in range(3):
            if (ix+iy)%3:
                b.box((-.18+ix*.066,1.09+iy*.071,.995),(.034,.039,.012),'pale markings')
    for i in range(18):
        b.box((-.76+i*.089,2.602,.669),(.041,.017,.059),'armor steel')
    return b.finish()

def mercenary():
    """Concept hero: heavily segmented armor, pixel hair and cybernetic arms."""
    b=Builder('VEX / VOXEL MERCENARY');rng=random.Random(417)
    # Grounded tactical boots, lower/upper leg segments, exposed knee joints.
    for side in [-1,1]:
        x=side*.192
        b.box((x,.055,.10),(.25,.43,.20),'carbon rubber')
        for j in range(3):
            b.box((x,.11-j*.105,.20+j*.035),(.23,.11,.065),'armor graphite')
        b.box((x,0,.38),(.22,.26,.39),'black fabric')
        b.box((x,.014,.665),(.26,.29,.28),'armor charcoal')
        for j in range(4):
            b.box((x,.15,.29+j*.076),(.23,.068,.056),'armor bluegrey')
            b.box((x+side*.126,.01,.3+j*.07),(.065,.23,.065),'armor graphite')
        b.box((x,.174,.60),(.22,.13,.17),'armor steel')
        b.box((x,.248,.62),(.105,.018,.066),'armor charcoal')
        b.box((x+side*.138,-.01,.72),(.102,.21,.17),'weathered khaki')
        b.box((x+side*.195,.10,.75),(.035,.044,.051),'hazard amber')
    b.box((0,0,.835),(.53,.35,.24),'black fabric')
    b.box((0,0,.954),(.58,.39,.105),'armor graphite')
    for i in range(6):
        b.box((-.242+i*.098,.209,.966),(.071,.056,.053),'armor steel')
    b.box((0,.252,.969),(.089,.027,.065),'ion cyan')
    b.box((0,0,1.174),(.54,.34,.46),'black fabric')
    # Individual chest and rib armor tiles avoid a single box torso.
    for side in [-1,1]:
        b.box((side*.161,.166,1.286),(.245,.105,.19),'armor graphite')
        b.box((side*.17,.214,1.32),(.20,.057,.13),'armor bluegrey')
        for j in range(3):
            b.box((side*.18,.192,1.12+j*.06),(.205,.07,.04),'armor charcoal')
            b.box((side*.283,-.015,1.08+j*.11),(.07,.27,.072),'armor steel')
        b.box((side*.33,0,1.35),(.17,.39,.23),'armor graphite')
        b.box((side*.38,.025,1.445),(.17,.33,.086),'armor bluegrey')
        b.box((side*.38,-.05,1.50),(.11,.12,.035),'armor worn edge')
    b.box((-.13,.245,1.32),(.043,.025,.085),'ion cyan')
    b.box((.17,.252,1.32),(.092,.018,.052),'hazard amber')
    b.box((-.195,.24,1.075),(.13,.15,.17),'weathered khaki')
    b.box((.17,.24,1.055),(.13,.14,.18),'armor graphite')
    # Left armored arm and hand; right cyberarm has small exposed metal segments.
    for side in [-1,1]:
        x=side*.42
        b.box((x,0,1.205),(.19,.23,.30),'black fabric')
        b.box((x+side*.03,.025,1.22),(.21,.25,.18),'armor bluegrey')
        b.box((x+side*.025,.022,1.075),(.17,.20,.11),'armor steel')
        for j in range(5):
            bx=x+side*.02+j*side*.006;z=1.019-j*.045
            b.box((bx,.054+j*.009,z),(.175,.20,.037),'armor graphite' if j%2 else 'armor steel')
            if side==1:b.box((bx+.097,.135+j*.009,z),(.023,.066,.025),'ion cyan')
        b.box((x+side*.052,.112,.777),(.15,.18,.13),'carbon rubber')
        for j in range(3):
            b.box((x+side*.064,.215,.794-j*.034),(.13,.06,.025),'armor graphite')
    # Neck, human face, optic implant and irregular dark block hair.
    b.box((0,0,1.455),(.22,.23,.12),'armor charcoal')
    b.box((0,.015,1.638),(.30,.285,.30),'warm skin')
    b.box((0,.178,1.636),(.10,.057,.10),'warm skin')
    b.box((0,.176,1.55),(.20,.045,.058),'armor charcoal')
    b.box((-.073,.17,1.69),(.072,.032,.027),'display black')
    b.box((.085,.179,1.69),(.08,.049,.066),'armor graphite')
    b.box((.092,.209,1.692),(.048,.016,.027),'ion cyan')
    b.box((-.171,.02,1.656),(.05,.10,.13),'armor graphite')
    b.box((.171,.02,1.656),(.05,.10,.13),'armor bluegrey')
    b.box((0,-.03,1.775),(.335,.31,.13),'carbon rubber')
    for ix in range(6):
        for iy in range(6):
            x=-.172+ix*.061;y=-.19+iy*.061;z=1.83+rng.random()*.055
            b.box((x,y,z),(.066,.068,.067+rng.random()*.04),rng.choice(['carbon rubber','armor charcoal']))
    for i in range(7):
        b.box((-.18+i*.055,-.157,1.764),(.041,.058,.12),'carbon rubber')
    # Backpack: visible red glyph in the exact rear-facing concept position.
    b.box((0,-.248,1.25),(.40,.18,.40),'armor charcoal')
    b.box((0,-.35,1.265),(.29,.062,.29),'armor graphite')
    b.box((0,-.387,1.276),(.19,.022,.22),'signal red')
    b.box((0,-.403,1.278),(.12,.014,.153),'display black')
    for dx,dz in [(-.033,.04),(-.033,0),(-.033,-.04),(0,.04),(.033,.04),(.033,0),(0,-.04)]:
        b.box((dx,-.414,1.278+dz),(.025,.013,.025),'signal red')
    for side in [-1,1]:
        b.box((side*.236,-.215,1.24),(.09,.12,.34),'weathered khaki')
        for j in range(4):b.box((side*.242,-.285,1.12+j*.071),(.081,.031,.043),'armor graphite')
    # Export six joint-centered parts, preserving simple runtime walking animation.
    root=bpy.data.objects.new('VEX / VOXEL MERCENARY',None)
    bpy.context.collection.objects.link(root)
    pivots={'left_leg':(-.192,0,.83),'right_leg':(.192,0,.83),
            'left_arm':(-.36,0,1.40),'right_arm':(.36,0,1.40),
            'head':(0,0,1.47),'torso':(0,0,1.03)}
    parts={name:Builder(name) for name in pivots}
    cube_faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    for index in range(0,len(b.verts),8):
        verts=b.verts[index:index+8];x,y,z=[sum(v[k] for v in verts)/8 for k in range(3)]
        if z<.81 and abs(x)<.34:part='left_leg' if x<0 else 'right_leg'
        elif (abs(x)>.335 and z<1.55):part='left_arm' if x<0 else 'right_arm'
        elif z>1.44 and abs(x)<.28:part='head'
        else:part='torso'
        px,py,pz=pivots[part]
        mat=b.slots[b.face_materials[(index//8)*6]]
        parts[part].poly([(vx-px,vy-py,vz-pz) for vx,vy,vz in verts],cube_faces,mat)
    for name,part in parts.items():
        obj=part.finish();obj.parent=root;obj.location=pivots[name]
    return root

def av():
    """Broad heavy hovering patrol craft, detailed above and below for street views."""
    b=Builder('AEON / ARMORED PATROL AV');rng=random.Random(919)
    armor=['armor charcoal']*5+['armor graphite']*4+['armor bluegrey']*2
    b.box((0,0,1.03),(3.45,6.6,.69),'armor charcoal')
    b.box((0,-.30,1.55),(2.78,4.9,.39),'armor graphite')
    b.box((0,.95,.57),(2.82,4.53,.34),'carbon rubber')
    # Raked angular command cabin and windshield.
    for i in range(4):
        b.box((0,1.32+i*.30,1.64-i*.11),(2.35-i*.12,.39,.26),'obsidian glass')
        for side in [-1,1]:b.box((side*(1.26-i*.061),1.32+i*.30,1.66-i*.11),(.13,.42,.28),'armor graphite')
    for row in range(24):
        y=-3.30+row*.28
        for col in range(13):
            x=-1.68+col*.28
            if abs(x)<1.1 and y>.9:continue
            b.box((x,y,1.40 if abs(x)>1.4 else 1.77),(.266,.266,.105),rng.choice(armor))
    for side in [-1,1]:
        # Two massive engine nacelles joined by a plated wing.
        b.box((side*2.14,-.16,1.1),(1.66,5.90,.37),'armor graphite')
        b.box((side*2.90,-.20,1.20),(.23,5.51,.44),'armor charcoal')
        for end in [-1,1]:
            x=side*2.31;y=end*2.70
            b.box((x,y,1.03),(1.43,2.18,.80),'armor charcoal')
            b.box((x,y,1.50),(1.12,1.73,.19),'armor bluegrey')
            for row in range(7):
                for col in range(5):b.box((x-.48+col*.24,y-.8+row*.26,1.63),(.225,.245,.10),rng.choice(armor))
            b.box((x,y,.57),(1.17,1.50,.17),'armor steel')
            b.box((x,y,.43),(.87,1.10,.15),'display black')
            for j in range(7):
                b.box((x-.36+j*.12,y,.331),(.087,.79,.046),'ion cyan')
            b.box((x,y,.29),(.46,.70,.043),'headlight white')
            # Outboard red rectangular patrol signals, small end grille panels.
            b.box((x+side*.747,y,1.11),(.045,.67,.30),'display black')
            for iy in [-.18,0,.18]:b.box((x+side*.781,y+iy,1.14),(.027,.11,.11),'signal red')
            for j in range(7):
                b.box((x-.46+j*.15,y+end*1.107,1.03),(.063,.049,.30),'armor steel')
            b.box((x,y+end*1.14,1.42),(.65,.04,.085),'headlight white' if end==1 else 'signal red')
        for y in [-1.40,-.95,-.50,-.05,.40,.85,1.30]:
            b.box((side*2.13,y,.55),(.48,.16,.19),'armor steel')
            b.box((side*2.13,y,.444),(.27,.091,.032),'hot magenta')
        b.box((side*.83,-3.28,.66),(.23,1.39,.20),'armor graphite')
        b.box((side*.83,-4.00,.66),(.21,.078,.16),'signal red')
        for i in range(7):
            b.box((side*1.61,-2.75+i*.68,1.52),(.13,.25,.19),'armor steel')
            b.box((side*1.71,-2.75+i*.68,1.54),(.018,.12,.062),'ion cyan')
    # Underside inspection panels and a protruding searchlight gimbal.
    for row in range(14):
        for col in range(8):
            b.box((-1.225+col*.35,-2.5+row*.37,.414),(.33,.35,.087),rng.choice(armor))
    b.box((0,2.58,.398),(.87,.97,.31),'armor steel')
    b.box((0,2.62,.216),(.59,.60,.09),'display black')
    b.box((0,2.62,.147),(.43,.44,.055),'headlight white')
    b.box((0,-.37,1.907),(1.50,.45,.14),'armor charcoal')
    for side in [-1,1]:
        b.box((side*.53,-.37,1.992),(.37,.35,.045),'signal red' if side==-1 else 'ion cyan')
        b.box((side*.91,-2.64,1.99),(.06,.08,.36),'armor steel')
        b.box((side*.91,-2.64,2.185),(.091,.10,.043),'ion cyan')
    return b.finish()

def drone():
    b=Builder('VIGIL SECURITY DRONE')
    b.box((0,0,.33),(.64,.75,.33),'midnight ceramic')
    b.box((0,.03,.545),(.50,.58,.10),'titanium navy')
    b.box((0,.37,.34),(.5,.05,.18),'display black')
    b.box((0,.408,.355),(.22,.02,.095),'hot magenta')
    b.box((0,.422,.355),(.066,.015,.056),'pale markings')
    b.box((0,0,.60),(.07,.27,.018),'ion cyan')
    for side in [-1,1]:
        b.box((side*.52,0,.32),(.63,.18,.13),'gunmetal edge')
        b.box((side*.66,0,.36),(.25,.82,.12),'midnight ceramic')
        for end in [-1,1]:
            x,y=side*.68,end*.38
            b.box((x,y,.39),(.48,.46,.12),'titanium navy')
            b.box((x,y,.46),(.33,.31,.04),'display black')
            b.box((x,y,.492),(.44,.055,.025),'carbon rubber',rot=.4)
            b.box((x,y,.492),(.055,.4,.025),'carbon rubber',rot=.4)
            b.box((x,y,.52),(.09,.09,.06),'ion cyan')
            b.box((x,y,.298),(.27,.25,.065),'ion cyan')
            b.box((x,y,.263),(.15,.14,.015),'pale markings')
            for dx in [-.205,.205]:
                b.box((x+dx,y,.475),(.05,.43,.085),'midnight ceramic')
            for dy in [-.21,.21]:
                b.box((x,y+dy,.475),(.42,.045,.085),'midnight ceramic')
        b.box((side*.2,.15,.135),(.11,.12,.19),'gunmetal edge')
        b.box((side*.2,.28,.064),(.16,.42,.10),'midnight ceramic')
        b.box((side*.2,.50,.064),(.065,.065,.065),'hot magenta')
        b.box((side*.22,-.35,.64),(.04,.04,.23),'gunmetal edge')
        b.box((side*.22,-.35,.76),(.06,.06,.045),'hazard amber')
        for i in range(3):
            b.box((side*.332,-.14+i*.11,.4),(.016,.052,.09),'hazard amber')
    b.box((0,-.4,.29),(.28,.04,.11),'ion cyan')
    return b.finish()

def relay():
    b=Builder('KASUMI DATA RELAY')
    b.box((0,0,.075),(.91,.73,.15),'carbon rubber')
    b.box((0,0,.185),(.78,.63,.10),'gunmetal edge')
    b.box((0,0,.65),(.64,.55,.95),'midnight ceramic')
    b.box((0,0,1.255),(.80,.57,.64),'titanium navy')
    b.box((0,.3,1.31),(.66,.041,.40),'display black')
    b.box((0,.325,1.335),(.57,.015,.285),'obsidian glass')
    # Actual geometry screen graphics, legible in glTF without textures.
    for i,width in enumerate([.38,.26,.43,.32]):
        b.box((-.23+width/2,.34,1.435-i*.059),(width,.011,.014),'ion cyan')
    for i in range(4):
        b.box((.245,.342,1.416-i*.047),(.024,.014,.024),'acid green')
    b.box((0,.357,1.10),(.54,.16,.10),'midnight ceramic')
    for row in range(2):
        for col in range(8):
            b.box((-.227+col*.064,.425,1.125-row*.039),(.046,.011,.018),'gunmetal edge')
    b.box((.325,.32,1.05),(.095,.07,.08),'hot magenta')
    for side in [-1,1]:
        b.box((side*.385,0,1.27),(.05,.59,.6),'midnight ceramic')
        b.box((side*.352,.32,1.32),(.02,.019,.38),'ion cyan')
        b.box((side*.302,.288,.65),(.025,.026,.58),'ion cyan')
        for i in range(6):
            b.box((side*.336,-.015,.54+i*.062),(.015,.26,.025),'gunmetal edge')
    b.box((0,.285,.71),(.31,.019,.38),'titanium navy')
    b.box((0,.30,.78),(.23,.015,.036),'hazard amber')
    for i in range(3):
        b.box((-.08+i*.08,.31,.60),(.034,.016,.059),'pale markings')
    b.box((0,-.08,1.63),(.70,.45,.12),'midnight ceramic')
    b.box((0,.153,1.63),(.57,.014,.035),'ion cyan')
    b.box((-.26,-.12,1.735),(.045,.045,.15),'gunmetal edge')
    b.box((-.26,-.12,1.82),(.078,.078,.026),'hot magenta')
    b.box((.19,-.16,1.73),(.12,.12,.1),'gunmetal edge')
    b.box((.19,-.16,1.79),(.08,.08,.035),'ion cyan')
    # Rear panel and cable loops in block language.
    b.box((0,-.29,1.23),(.46,.045,.42),'midnight ceramic')
    for i in range(5):
        b.box((0,-.318,1.08+i*.066),(.34,.016,.018),'gunmetal edge')
    b.box((.25,-.31,.6),(.035,.065,.77),'carbon rubber')
    b.box((.13,-.31,.22),(.25,.065,.035),'carbon rubber')
    return b.finish()

def crate():
    b=Builder('VOLTA EXPLOSIVE CELL')
    b.box((0,0,.445),(.77,.77,.77),'midnight ceramic')
    b.box((0,0,.05),(.89,.89,.10),'carbon rubber')
    b.box((0,0,.845),(.89,.89,.11),'titanium navy')
    for side in [-1,1]:
        b.box((side*.385,0,.45),(.10,.77,.73),'gunmetal edge')
        b.box((0,side*.385,.45),(.77,.10,.73),'gunmetal edge')
        b.box((0,side*.444,.46),(.61,.031,.56),'midnight ceramic')
        b.box((side*.444,0,.46),(.031,.61,.56),'midnight ceramic')
        b.box((0,side*.465,.45),(.39,.018,.26),'hazard amber')
        b.box((side*.465,0,.45),(.018,.39,.26),'hot magenta')
        b.box((0,side*.481,.45),(.085,.015,.18),'display black')
        b.box((0,side*.49,.39),(.047,.013,.025),'hazard amber')
        for col in [-1,1]:
            b.box((col*.27,side*.46,.46),(.034,.028,.43),'ion cyan')
            b.box((side*.46,col*.27,.46),(.028,.034,.43),'ion cyan')
        for z in [.14,.77]:
            b.box((0,side*.455,z),(.65,.025,.045),'gunmetal edge')
            for i in range(5):
                b.box((-.25+i*.125,side*.472,z),(.055,.014,.032),'hazard amber')
    for x in [-.385,.385]:
        for y in [-.385,.385]:
            b.box((x,y,.45),(.13,.13,.9),'titanium navy')
            b.box((x,y,.89),(.06,.06,.02),'pale markings')
    b.box((0,0,.914),(.40,.31,.038),'display black')
    for i in range(3):
        b.box((-.12+i*.12,0,.94),(.04,.21,.017),'hot magenta')
    return b.finish()

def kiosk():
    b=Builder('NIGHT MARKET NOODLES')
    b.box((0,0,.09),(2.8,1.65,.18),'carbon rubber')
    b.box((0,0,.63),(2.6,1.45,1.04),'midnight ceramic')
    b.box((0,.25,1.20),(2.95,1.22,.13),'gunmetal edge')
    b.box((0,.87,1.19),(2.85,.04,.045),'ion cyan')
    for side in [-1,1]:
        b.box((side*1.24,-.5,1.78),(.12,.12,1.2),'gunmetal edge')
        b.box((side*1.26,.54,1.79),(.095,.095,1.28),'gunmetal edge')
        b.box((side*1.26,.6,1.78),(.028,.025,1.06),'hot magenta')
    b.box((0,-.03,2.44),(3.18,1.94,.20),'midnight ceramic')
    b.box((0,.94,2.49),(3.06,.055,.06),'hot magenta')
    b.box((0,.952,2.31),(2.76,.065,.23),'hazard amber')
    # Pixel glyphs on the sign.
    patterns=['111101111101101','110101110101110','111100110100111','110101110101110','111100110100111']
    for letter,pat in enumerate(patterns):
        for i,d in enumerate(pat):
            if d=='1':
                b.box((-.95+letter*.45+(i%3)*.076,.994,2.384-(i//3)*.037),(.056,.016,.026),'display black')
    b.box((0,-.67,1.69),(2.35,.14,.88),'titanium navy')
    for i in range(5):
        b.box((-.92+i*.45,-.572,1.75),(.31,.045,.48),'paper cream')
        for row in range(4):
            b.box((-.94+i*.45,-.545,1.89-row*.075),(.17,.012,.018),'display black')
    for x in [-.88,-.36,.16]:
        b.box((x,.35,1.315),(.31,.28,.12),'paper cream')
        b.box((x,.35,1.383),(.24,.21,.018),'hazard amber')
        b.box((x+.035,.35,1.41),(.012,.37,.012),'pale markings',rot=.2)
    b.box((.96,.24,1.42),(.34,.3,.35),'midnight ceramic')
    b.box((.96,.398,1.48),(.28,.015,.17),'ion cyan')
    for i in range(9):
        b.box((-.95+i*.24,.744,.69),(.15,.018,.35),'titanium navy')
    b.box((0,.76,.34),(2.42,.018,.025),'hot magenta')
    return b.finish()

builders = [('interceptor',interceptor),('drone',drone),('relay',relay),('crate',crate),('kiosk',kiosk),('mercenary',mercenary),('av',av)]
objects=[]
metadata={}
for file_name,build in builders:
    obj=build()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    for child in obj.children_recursive:child.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(ASSETS/(file_name+'.glb')), export_format='GLB',
                              use_selection=True, export_yup=True, export_apply=True,
                              export_cameras=False, export_lights=False)
    meshes=[item for item in [obj]+list(obj.children_recursive) if item.type=='MESH']
    points=[item.matrix_world@Vector(p) for item in meshes for p in item.bound_box]
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    metadata[file_name]={'blender_min':lo,'blender_max':hi,
      'gltf_min':[lo[0],lo[2],-hi[1]],'gltf_max':[hi[0],hi[2],-lo[1]],
      'vertices':sum(len(item.data.vertices) for item in meshes),'faces':sum(len(item.data.polygons) for item in meshes),
      'material_count':sum(len(item.data.materials) for item in meshes),'file_bytes':(ASSETS/(file_name+'.glb')).stat().st_size}
    objects.append(obj)

# Save an editable, arranged gallery with lighting and a camera for review.
for obj,x in zip(objects,[-7,-2,0,2,5,8,0]):
    obj.location.x=x
objects[-1].location.y=-7
objects[-1].location.z=2

world=bpy.data.worlds.new('Midnight atmosphere')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.024,.033,.065,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.36
bpy.context.scene.world=world

def area(name,location,color,power,size):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=location
    obj.rotation_euler=(Vector((1,0,.5))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Cold key',(0,4,9),(.38,.79,1),1600,8)
area('Magenta rim',(0,-5,6),(1,.04,.32),1900,7)
area('Warm market',(8,3,6),(1,.52,.20),750,5)

camera_data=bpy.data.cameras.new('Asset kit overview')
camera=bpy.data.objects.new('Asset kit overview',camera_data);bpy.context.collection.objects.link(camera)
camera.location=(15,20,14);camera.rotation_euler=(Vector((0,-2,1))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=23
scene=bpy.context.scene;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.render.filepath=str(ROOT/'blender'/'asset-kit-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender'/'cyberpunk-assets.blend'))
(ROOT/'blender'/'asset-manifest.json').write_text(json.dumps(metadata,indent=2))
print('ASSET_MANIFEST '+json.dumps(metadata))
bpy.ops.render.render(write_still=True)
