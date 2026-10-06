"""Render our original 16-second sourcing film, native 24 fps, Cycles CPU.

blender -b -t 4 -P tools/render_sourcing_film.py -- --out /tmp/sourcing-frames
The reviewed 3/4-10 basic thread and RCSC heavy-nut envelope are illustration
geometry, not an ASME manufacturing tolerance model or a certified assembly.
"""
import argparse
import ast
import json
import math
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector, Matrix, Quaternion

sys.path.insert(0, str(Path(__file__).parent))
from precision_geometry import Thread, UNC34, HEAVY34, MM, ease

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--out', required=True)
p.add_argument('--frames', type=int, nargs='+')
p.add_argument('--width', type=int, default=960)
p.add_argument('--samples', type=int, default=6)
p.add_argument('--start', type=int, default=0)
p.add_argument('--end', type=int, default=383)
p.add_argument('--track', help='Optional output path for image-space annotation keyframes')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = a.samples
scene.cycles.use_denoising = False  # Denoise using the verified external OIDN release.
scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = .035
scene.cycles.max_bounces = 6; scene.cycles.glossy_bounces = 4
scene.cycles.seed = 41; scene.cycles.use_animated_seed = False
scene.render.use_persistent_data = True
scene.render.resolution_x = a.width; scene.render.resolution_y = a.width * 5 // 8
scene.render.resolution_percentage = 100; scene.render.fps = 24
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.72, .76, .73, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35

# Reuse only our geometry/material helper functions, never an old scene/timeline.
definitions = ast.parse((Path(__file__).parent / 'render_hero.py').read_text())
exec(compile(ast.Module(body=[n for n in definitions.body if isinstance(n, ast.FunctionDef) and n.name == 'material'], type_ignores=[]), 'original material helper', 'exec'))
steel = material('Satin machined steel', (.38, .40, .39), .98, .21)
zinc = material('Bright metal with controlled highlights', (.46, .48, .47), .97, .27)
iron = material('Graphite steel', (.10, .12, .115), .96, .25)
paper = material('Warm mineral studio', (.69, .72, .68), .0, .48)
signal = material('Copper datum accent', (.55, .08, .024), .75, .28)
_mesh_cache = {}; TAU = math.tau
helpers = {'group', 'finish', 'box', 'cylinder', 'ring', 'profile_radius', 'threaded_nut'}
exec(compile(ast.Module(body=[n for n in definitions.body if isinstance(n, ast.FunctionDef) and n.name in helpers], type_ignores=[]), 'original geometry helpers', 'exec'))

def precision_thread(name, parent, spec, length, mat):
    """Native helical mesh: more angular/axial samples, unchanged basic profile."""
    n = 144; steps = math.ceil(length / spec.lead * 28)
    verts = []; faces = []
    for j in range(steps + 1):
        z = length * j / steps
        end = min(1, z / (spec.lead*.65), (length-z) / (spec.lead*.65))
        for i in range(n):
            angle = i * TAU / n
            r = spec.radius_at(angle, z) * (.90 + .10*max(0, end))
            verts.append((r*math.cos(angle), r*math.sin(angle), z))
    for j in range(steps):
        for i in range(n):
            k = (i+1) % n
            faces.append((j*n+i, j*n+k, (j+1)*n+k, (j+1)*n+i))
    faces.extend([tuple(range(n-1, -1, -1)), tuple(steps*n+i for i in range(n))])
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], faces); mesh.update()
    for face in mesh.polygons: face.use_smooth = True
    mesh.set_sharp_from_angle(angle=math.radians(38))
    obj = bpy.data.objects.new(name, mesh); scene.collection.objects.link(obj)
    return finish(obj, name, mat, parent, 0)

def light(name, pos, target, power, size, color=(1,1,1), rectangular=None):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.color = color
    data.shape = 'RECTANGLE' if rectangular else 'DISK'; data.size = size
    if rectangular: data.size_y = rectangular
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
    obj.location = pos; obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()

box('Seamless studio floor', (200,200,.08), (0,0,-.085), paper, bevel=0)
light('Broad key reflection', (-4,-5,7), (0,0,.6), 1000, 5, (1,.97,.91))
light('Long white strip', (3,2,6), (0,0,.5), 1600, 4, (1,1,1), .8)
light('Cool thread edge', (-3,4,3), (0,0,.7), 700, 3, (.80,.89,1), .6)
light('Soft camera fill', (0,-5,2), (0,0,.5), 300, 3)

assembly = group('Exploded sourcing set — no tightening procedure')
spec = Thread(UNC34.diameter, UNC34.pitch, .045)
stud = precision_thread('3/4-10 basic-profile stud', assembly, spec, 3.7, iron)
heavy = threaded_nut(assembly, spec, HEAVY34['s']*spec.scale, HEAVY34['m']*spec.scale, zinc, 'Heavy hex reference envelope')
washer = ring('Generic washer — no dimension claim', .98, spec.radius*1.07, .105, mat=zinc, parent=assembly, bevel=.012)
# A second, visibly different thread candidate supports the UNC/UNF comparison.
fine_spec = Thread(19.05, 25.4/16, .045)
fine = precision_thread('UNF candidate basic profile', None, fine_spec, 3.7, steel)
fine.rotation_euler = (math.pi/2, 0, -.47)
fine.location = (1.90, 1.2, .50)

cam = bpy.data.objects.new('Sourcing editorial camera', bpy.data.cameras.new('Camera'))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'PERSP'; cam.data.lens = 52
cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 16
focus = group('Focus target'); cam.data.dof.focus_object = focus

def lerp(start, end, fraction): return Vector(start).lerp(Vector(end), fraction)

def prepare(frame):
    t = frame / 24
    # One continuous product set; movement exposes the thread and mating faces.
    separation = .65 + .55 * math.sin(math.pi * ease(t,3.8,11.8))
    assembly.rotation_euler = (math.radians(71), math.radians(-12), math.radians(-32) + .13*math.sin(TAU*t/16))
    assembly.location = (-.25, 2.0, .65)
    stud.location = (0,0,0); stud.rotation_euler.z = .18 * math.sin(TAU*t/16)
    washer.location = (0,0,3.7+separation*.35)
    heavy.location = (0,0,3.7+separation)
    # Keep the internal and external helical phases aligned without pretending to tighten.
    heavy.rotation_euler.z = TAU * heavy.location.z/spec.lead + stud.rotation_euler.z
    fine.rotation_euler.z = -.47 + .12 * math.sin(TAU*t/16)
    fine.location.x = 1.9 + .18 * math.sin(TAU*t/16)
    # Establishing shot → external/internal thread macro → candidate comparison → lineup.
    wide_pos = (6,-10,7); wide_target = (-.3,.2,1.0)
    macro_pos = (-4.5,-6,4.2); macro_target = (-1.8,-.4,1.2)
    compare_pos = (-5,-9,7); compare_target = (-.3,.2,1.0)
    if t < 4:
        q = ease(t,1,3.9); pos=lerp(wide_pos,macro_pos,q); target=lerp(wide_target,macro_target,q)
    elif t < 8:
        q = ease(t,4.5,7.8); pos=lerp(macro_pos,compare_pos,q); target=lerp(macro_target,compare_target,q)
    elif t < 12:
        q = ease(t,8.2,11.8); pos=lerp(compare_pos,wide_pos,q); target=lerp(compare_target,wide_target,q)
    else:
        pos=Vector(wide_pos); target=Vector(wide_target)
    cam.location = pos; focus.location = target
    cam.rotation_euler = (target-pos).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()

if a.track:
    keys = []
    for frame in range(0,385,6):
        prepare(frame)
        points = [stud.matrix_world @ Vector((0,0,1.4)), heavy.matrix_world @ Vector((0,0,.42)), fine.matrix_world @ Vector((0,0,1.8))]
        coords = [world_to_camera_view(scene, cam, point) for point in points]
        keys.append([frame/24,*[round(value,4) for point in coords for value in (point.x,1-point.y)]])
    Path(a.track).write_text(json.dumps(keys, separators=(',',':'))+'\n')

for frame in a.frames or range(a.start, a.end+1):
    target = out / f'{frame:04d}.png'
    if target.exists() and not a.frames: continue
    scene.frame_set(frame); prepare(frame)
    scene.render.filepath = str(target); bpy.ops.render.render(write_still=True)
    print(f'SOURCING_FRAME {frame:04d}', flush=True)
