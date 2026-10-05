"""Path-traced product renders of the gold hoops (Blender Cycles, CPU).

usage: python3 render.py <shot> <res> <samples> [frame_start frame_end]
shots: main, front, side, detail, turntable
"""
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
shot = sys.argv[1] if len(sys.argv) > 1 else 'main'
RES = int(sys.argv[2]) if len(sys.argv) > 2 else 800
SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 64
F0 = int(sys.argv[4]) if len(sys.argv) > 4 else 1
F1 = int(sys.argv[5]) if len(sys.argv) > 5 else 1

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def srgb(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# ------------------------------------------------------------------ render settings
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.02
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 12
scene.cycles.glossy_bounces = 8
scene.cycles.caustics_reflective = False
scene.cycles.caustics_refractive = False
scene.cycles.blur_glossy = 0.5
scene.render.threads_mode = 'AUTO'
scene.render.resolution_x = RES
scene.render.resolution_y = RES
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = float(os.environ.get('EXPO', '-1.2'))
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'

# ------------------------------------------------------------------ world: photographed studio HDRI
world = bpy.data.worlds.new('studio')
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
tex = nt.nodes.new('ShaderNodeTexEnvironment')
tex.image = bpy.data.images.load(os.path.join(ROOT, 'hdr', 'studio.exr'))
mapn = nt.nodes.new('ShaderNodeMapping')
mapn.inputs['Rotation'].default_value[2] = 1.9
coord = nt.nodes.new('ShaderNodeTexCoord')
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 1.2
out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(coord.outputs['Generated'], mapn.inputs['Vector'])
nt.links.new(mapn.outputs['Vector'], tex.inputs['Vector'])
nt.links.new(tex.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

# ------------------------------------------------------------------ materials
def gold_material():
    m = bpy.data.materials.new('polished gold')
    m.use_nodes = True
    n = m.node_tree.nodes
    l = m.node_tree.links
    p = n['Principled BSDF']
    p.inputs['Base Color'].default_value = (srgb(1.0), srgb(0.79), srgb(0.30), 1)
    p.inputs['Metallic'].default_value = 1.0
    p.inputs['Specular Tint'].default_value = (srgb(1.0), srgb(0.9), srgb(0.66), 1)
    # polish: faint roughness variation streaked along the hoop, plus plating waviness in the bump
    tc = n.new('ShaderNodeTexCoord')
    wave = n.new('ShaderNodeTexNoise')
    wave.inputs['Scale'].default_value = 60.0
    wave.inputs['Detail'].default_value = 6.0
    mapn = n.new('ShaderNodeMapping')
    mapn.inputs['Scale'].default_value = (1.0, 1.0, 22.0)
    l.new(tc.outputs['Object'], mapn.inputs['Vector'])
    l.new(mapn.outputs['Vector'], wave.inputs['Vector'])
    ramp = n.new('ShaderNodeMapRange')
    ramp.inputs['To Min'].default_value = 0.075
    ramp.inputs['To Max'].default_value = 0.13
    l.new(wave.outputs['Fac'], ramp.inputs['Value'])
    l.new(ramp.outputs['Result'], p.inputs['Roughness'])
    blob = n.new('ShaderNodeTexNoise')
    blob.inputs['Scale'].default_value = 7.0
    blob.inputs['Detail'].default_value = 3.0
    l.new(tc.outputs['Object'], blob.inputs['Vector'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.035
    bump.inputs['Distance'].default_value = 0.02
    l.new(blob.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m


def surface_material():
    # glossy white acrylic like the listing photo's reflective base
    m = bpy.data.materials.new('white acrylic')
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (0.92, 0.92, 0.915, 1)
    # glossy where the jewellery sits, matte up the sweep so no softbox streaks show in the backdrop
    n, l = m.node_tree.nodes, m.node_tree.links
    geo = n.new('ShaderNodeNewGeometry')
    sep = n.new('ShaderNodeSeparateXYZ')
    rr = n.new('ShaderNodeMapRange')
    rr.inputs['From Min'].default_value = 0.05
    rr.inputs['From Max'].default_value = 0.8
    rr.inputs['To Min'].default_value = 0.06
    rr.inputs['To Max'].default_value = 0.7
    l.new(geo.outputs['Position'], sep.inputs['Vector'])
    l.new(sep.outputs['Z'], rr.inputs['Value'])
    l.new(rr.outputs['Result'], p.inputs['Roughness'])
    p.inputs['IOR'].default_value = 1.5
    p.inputs['Specular IOR Level'].default_value = 0.6
    # a little self-illumination keeps the sweep an even, seamless white like a light table
    p.inputs['Emission Color'].default_value = (1, 1, 1, 1)
    p.inputs['Emission Strength'].default_value = float(os.environ.get('CYC_EMIT', '0.55'))
    return m


def emitter(name, strength, color=(1, 1, 1)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    n.clear()
    e = n.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = (*color, 1)
    e.inputs['Strength'].default_value = strength
    o = n.new('ShaderNodeOutputMaterial')
    m.node_tree.links.new(e.outputs['Emission'], o.inputs['Surface'])
    return m


GOLD = gold_material()

# ------------------------------------------------------------------ hoops
bpy.ops.wm.obj_import(filepath=os.path.join(HERE, 'hoop.obj'), forward_axis='NEGATIVE_Z', up_axis='Y')
parts = [o for o in bpy.context.selected_objects if o.type == 'MESH']
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
hoop = bpy.context.view_layer.objects.active
hoop.name = 'hoop L'
hoop.data.materials.clear()
hoop.data.materials.append(GOLD)
for poly in hoop.data.polygons:
    poly.use_smooth = True
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
hoop.location.z = hoop.dimensions.z / 2
hoop.location.x = 0
hoop.location.y = 0

pivot = bpy.data.objects.new('turntable', None)
scene.collection.objects.link(pivot)
SEP = 0.8
hoop.parent = pivot
hoop.location.x = -SEP
hoop.rotation_euler[2] = 0.22
hoop2 = hoop.copy()
hoop2.data = hoop.data
hoop2.name = 'hoop R'
scene.collection.objects.link(hoop2)
hoop2.parent = pivot
hoop2.location.x = SEP

# ------------------------------------------------------------------ cyclorama + light tent
def cyclorama():
    verts, faces = [], []
    prof = []
    for k in range(0, 41):                     # floor from the front to the bend
        prof.append((-14 + k * 0.4, 0.0))
    R = 3.0
    for k in range(1, 31):                     # quarter-circle sweep
        a = k / 30 * math.pi / 2
        prof.append((2.0 + R * math.sin(a), R - R * math.cos(a)))
    for k in range(1, 11):
        prof.append((5.0, 3.0 + k * 1.2))
    X = 20
    for (y, z) in prof:
        verts.append((-X, y, z))
        verts.append((X, y, z))
    for i in range(len(prof) - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    me = bpy.data.meshes.new('cyc')
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new('cyclorama', me)
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    ob.data.materials.append(surface_material())
    return ob


cyclorama()


def card(name, size, loc, mat, look=(0, 0, 0.8)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ob.data.materials.append(mat)
    ob.visible_camera = False
    return ob


def area(name, size, loc, power, color=(1, 1, 1), look=(0, 0, 0.8)):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = size
    ld.energy = power
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ld.cycles.is_caustics_light = False
    ob.visible_camera = False
    ob.visible_glossy = True
    return ob


area('top softbox', (6, 2.4), (0, -1, 9), 2600)
area('key strip', (1.6, 6), (-7, -5, 3), 1400, (1.0, 0.96, 0.9))
area('rim strip', (1.2, 5), (7, 3, 3), 900)
area('front fill', (5, 3), (0, -10, 2.5), 700, (1.0, 0.97, 0.93))
card('reflector L', (4, 6), (-6, 1, 3), emitter('tent', 1.6, (1.0, 0.97, 0.92)))
card('flag R', (2.2, 5), (5.5, -6.5, 2.0), emitter('black', 0.0))
card('flag L', (2.2, 3), (-4.5, -7.5, 0.6), emitter('black2', 0.0))

# ------------------------------------------------------------------ camera
cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = bpy.data.objects.new('focus', None)
scene.collection.objects.link(target)


def aim(loc, look, lens, fstop=None, focus=None):
    cam.location = loc
    target.location = look
    d = Vector(look) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = lens
    cam_data.sensor_width = 36
    if fstop:
        cam_data.dof.use_dof = True
        cam_data.dof.aperture_fstop = fstop
        cam_data.dof.focus_object = focus or target
    else:
        cam_data.dof.use_dof = False


H = hoop.dimensions.z
mid = (0, 0, H * 0.46)


def orbit(az_deg, el_deg, dist, look=mid):
    az, el = math.radians(az_deg), math.radians(el_deg)
    return (look[0] + dist * math.sin(az) * math.cos(el), look[1] - dist * math.cos(az) * math.cos(el), look[2] + dist * math.sin(el))


if shot == 'main':
    pivot.rotation_euler[2] = -0.45
    aim(orbit(0, 9, 12.5), (0, 0, H * 0.42), 148, 8.0)
elif shot == 'front':
    pivot.rotation_euler[2] = 0.0
    aim(orbit(0, 6, 12.5), (0, 0, H * 0.42), 148, 11.0)
elif shot == 'side':
    pivot.rotation_euler[2] = math.radians(72)
    aim(orbit(0, 7, 12.5), (0, 0, H * 0.45), 148, 8.0)
elif shot == 'detail':
    pivot.rotation_euler[2] = 0.55
    hoop2.hide_render = True
    focus = bpy.data.objects.new('focus2', None)
    scene.collection.objects.link(focus)
    hoop.parent = None
    hoop.location = (0, 0, hoop.location.z)
    hoop.rotation_euler[2] = 0.5
    focus.location = (0, 0, H * 0.82)
    aim(orbit(-8, 14, 4.2, (0, 0, H * 0.66)), (0, 0, H * 0.66), 100, 2.8, focus)
elif shot == 'turntable':
    aim(orbit(0, 9, 12.5), (0, 0, H * 0.42), 140, 8.0)
    NF = 180
    scene.frame_start, scene.frame_end = 1, NF
    pivot.rotation_euler[2] = -0.45
    pivot.keyframe_insert('rotation_euler', index=2, frame=1)
    pivot.rotation_euler[2] = -0.45 + 2 * math.pi
    pivot.keyframe_insert('rotation_euler', index=2, frame=NF + 1)
    for fc in pivot.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'

os.makedirs(os.path.join(ROOT, 'renders', shot), exist_ok=True)
if shot == 'turntable':
    for f in range(F0, F1 + 1):
        scene.frame_set(f)
        scene.render.filepath = os.path.join(ROOT, 'renders', shot, f'f{f:04d}.png')
        bpy.ops.render.render(write_still=True)
else:
    scene.render.filepath = os.path.join(ROOT, 'renders', shot, f'{shot}_{RES}.png')
    bpy.ops.render.render(write_still=True)
print('DONE', shot)
