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
import bmesh
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector, Matrix, Quaternion

sys.path.insert(0, str(Path(__file__).parent))
from precision_geometry import Thread, UNC34, HEAVY34, MM, ease

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--out', required=True)
p.add_argument('--frames', type=int, nargs='+')
p.add_argument('--width', type=int, default=1200)
p.add_argument('--samples', type=int, default=12)
p.add_argument('--start', type=int, default=0)
p.add_argument('--end', type=int, default=383)
p.add_argument('--track', help='Optional output path for image-space annotation keyframes')
p.add_argument('--track-only', action='store_true', help='Write native-frame projections without rendering')
p.add_argument('--audit', action='store_true', help='Check whole-part framing and comparison geometry without rendering')
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = a.samples
scene.cycles.use_denoising = False  # Denoise using the verified external OIDN release.
scene.cycles.use_adaptive_sampling = True; scene.cycles.adaptive_threshold = .035
scene.cycles.adaptive_min_samples = 8
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
steel = material('Satin machined steel', (.30, .33, .32), .96, .26)
zinc = material('Bright metal with controlled highlights', (.37, .40, .39), .95, .30)
iron = material('Graphite steel', (.14, .17, .16), .92, .29)
paper = material('Warm mineral studio', (.69, .72, .68), .0, .48)
section_mat = material('Illustration cut faces — not a coating', (.32, .14, .065), .50, .38)
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

def precision_nut(parent, spec, width, height, name, cutaway=False):
    """Flat hex faces, conical end chamfers and an exposed helical bore.

    The open sector is an illustration cut, not a damaged or manufactured nut.
    Its radial end faces close the mesh and use a separate section material.
    """
    n = 144 if not cutaway else 96
    start, span = (0, TAU) if not cutaway else (-math.pi/6, TAU*2/3)
    columns = n if not cutaway else n+1
    steps = math.ceil(height/spec.lead*28)
    verts, faces, kinds = [], [], []
    for internal in (False, True):
        for j in range(steps+1):
            z = height*j/steps
            for i in range(columns):
                angle = start+span*i/n
                if internal:
                    r = max(spec.radius_at(angle,z,True), spec.radius*.99-min(z,height-z)*.6)
                else:
                    r = min(profile_radius(width/math.sqrt(3),angle,6),width*.48+min(z,height-z)*math.sqrt(3))
                verts.append((r*math.cos(angle),r*math.sin(angle),z))
    stride=(steps+1)*columns
    for internal in (False,True):
        offset=stride if internal else 0
        for j in range(steps):
            for i in range(n):
                k=(i+1)%columns
                face=(offset+j*columns+i,offset+j*columns+k,offset+(j+1)*columns+k,offset+(j+1)*columns+i)
                faces.append(face[::-1] if internal else face);kinds.append(1 if internal else 0)
    for i in range(n):
        k=(i+1)%columns
        faces.extend([(i,stride+i,stride+k,k), (steps*columns+i,steps*columns+k,stride+steps*columns+k,stride+steps*columns+i)])
        kinds.extend([1,1])
    if cutaway:
        for edge in (0,n):
            for j in range(steps):
                face=(j*columns+edge,(j+1)*columns+edge,stride+(j+1)*columns+edge,stride+j*columns+edge)
                faces.append(face if edge==0 else face[::-1]);kinds.append(2)
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    mesh.materials.append(zinc);mesh.materials.append(section_mat)
    for face,kind in zip(mesh.polygons,kinds):
        face.use_smooth=kind==1;face.material_index=1 if kind==2 else 0
    mesh.set_sharp_from_angle(angle=math.radians(35))
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=parent
    return obj

def show(parent, visible):
    for child in parent.children_recursive:
        if child.type=='MESH': child.hide_render=not visible

def light(name, pos, target, power, size, color=(1,1,1), rectangular=None):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.color = color
    data.shape = 'RECTANGLE' if rectangular else 'DISK'; data.size = size
    if rectangular: data.size_y = rectangular
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
    obj.location = pos; obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()

box('Seamless studio floor', (200,200,.08), (0,0,-.085), paper, bevel=0)
light('Broad key reflection', (-4,-5,7), (0,0,.6), 850, 5, (1,.97,.93))
light('Long white strip', (3,2,6), (0,0,.5), 1000, 4, (1,1,1), .65)
light('Cool thread edge', (-3,4,3), (0,0,.7), 600, 3, (.86,.94,1), .6)
light('Soft camera fill', (0,-5,2), (0,0,.5), 180, 3)

assembly = group('Exploded sourcing set — no tightening procedure')
spec = Thread(UNC34.diameter, UNC34.pitch, .045)
stud = precision_thread('3/4-10 basic-profile stud', assembly, spec, 3.7, iron)
heavy = precision_nut(assembly, spec, HEAVY34['s']*spec.scale, HEAVY34['m']*spec.scale, 'Heavy hex reference envelope')
washer = ring('Generic washer — no dimension claim', .98, spec.radius*1.07, .105, mat=zinc, parent=assembly, bevel=.012)

macro = group('Section study — no engagement or tolerance approval')
macro_stud = precision_thread('External thread section study', macro, spec, 1.65, iron)
macro_washer = ring('Separated washer section study', .98, spec.radius*1.07, .105, mat=zinc, parent=macro, bevel=.012)
macro_nut = precision_nut(macro,spec,HEAVY34['s']*spec.scale,HEAVY34['m']*spec.scale,'Heavy nut open illustration section',cutaway=True)

# Comparison controls diameter, length, material and angle; pitch alone differs.
comparison = group('Equal-diameter thread series comparison')
fine_spec = Thread(19.05, 25.4/16, .045)
coarse = precision_thread('UNC requested basic profile',comparison,spec,3.7,steel)
fine = precision_thread('UNF candidate basic profile',comparison,fine_spec,3.7,steel)

cam = bpy.data.objects.new('Sourcing editorial camera', bpy.data.cameras.new('Camera'))
scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'PERSP'; cam.data.lens = 52
cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 18
focus = group('Focus target'); cam.data.dof.focus_object = focus

def lerp(start, end, fraction): return Vector(start).lerp(Vector(end), fraction)

def prepare(frame):
    t = (frame / 24) % 16
    phase=min(3,int(t/4)) if t<16 else 0
    show(assembly,phase in (0,3));show(macro,phase==1);show(comparison,phase==2)
    cam.data.type='ORTHO' if phase==2 else 'PERSP';cam.data.ortho_scale=5.35
    cam.data.dof.use_dof=phase!=2
    cam.data.lens=58
    # Whole-set editorial shot. All ends stay within the frame, including the loop.
    turn=.12*math.sin(TAU*t/16)
    assembly.rotation_euler=(math.radians(72),math.radians(-8),math.radians(-24)+turn)
    assembly.location=(-.12,2.1,.8)
    stud.location=(0,0,0);stud.rotation_euler.z=.10*math.sin(TAU*t/16)
    separation=.58+.12*math.sin(TAU*t/16)
    washer.location=(0,0,3.7+separation*.35);heavy.location=(0,0,3.7+separation)
    heavy.rotation_euler.z=TAU*heavy.location.z/spec.lead+stud.rotation_euler.z
    wide_target=assembly.location+assembly.rotation_euler.to_matrix()@Vector((0,0,2.45))
    wide_pos=wide_target+Vector((6,-9.8,7.0))
    if phase==0:
        q=ease(t,.6,3.9)
        pos=Vector(wide_pos)-Vector((.3,-.5,.25))*q;target=Vector(wide_target)
    elif phase==1:
        q=ease(t,4.1,7.9)
        macro.rotation_euler=(0,math.pi/2,.06+.07*q);macro.location=(-1.55,.1,.9)
        macro_washer.location=(0,0,2.02+.18*q)
        macro_nut.location=(0,0,2.65+.25*q)
        macro_nut.rotation_euler.z=.04*q
        cam.data.lens=48
        pos=lerp((2.8,-6.5,4.9),(1.7,-5.6,4.2),q);target=Vector((.4,.1,.85))
    elif phase==2:
        q=ease(t,8.1,11.8)
        for obj,y in [(coarse,-.94),(fine,.94)]:
            obj.rotation_mode='QUATERNION'
            obj.rotation_quaternion=Quaternion((0,1,0),math.pi/2)@Quaternion((0,0,1),TAU*q)
            obj.location=(-1.85,y,.72)
        pos=Vector((0,-8,9));target=Vector((0,0,.72))
    else:
        # Space above the parts is reserved for readable quotation / C&D cards.
        q=ease(t,12,12.7)*(1-ease(t,15.35,16))
        pos=Vector(wide_pos)+(Vector(wide_pos)-Vector(wide_target))*(.5*q)
        target=Vector(wide_target)+Vector((0,0,2.4*q))
    cam.location = pos; focus.location = target
    cam.rotation_euler = (target-pos).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()

def annotation_points(frame):
    phase=min(3,int(frame/96)) if frame<384 else 0
    stud_point=coarse.matrix_world@Vector((0,0,1.85)) if phase==2 else stud.matrix_world@Vector((0,0,1.6))
    nut_point=macro_nut.matrix_world@Vector((0,0,.42)) if phase==1 else heavy.matrix_world@Vector((0,0,.42))
    # Common one-inch interval on both comparison parts. Tick marks are image
    # projections of that same physical interval, never a tolerance measurement.
    points=[stud_point,nut_point,fine.matrix_world@Vector((0,0,1.85))]
    for obj in (coarse,fine):
        points.extend([obj.matrix_world@Vector((0,0,1.20)),obj.matrix_world@Vector((0,0,1.20+25.4*spec.scale))])
    return points

if a.audit:
    assert spec.diameter==fine_spec.diameter and not spec.compatible(fine_spec)
    assert math.isclose(25.4/spec.pitch,10) and math.isclose(25.4/fine_spec.pitch,16)
    for obj in (stud,heavy,washer,macro_stud,macro_nut,macro_washer,coarse,fine):
        mesh=bmesh.new();mesh.from_mesh(obj.data)
        assert all(edge.is_manifold for edge in mesh.edges),(obj.name,'open or overlapping surface edges')
        assert mesh.calc_volume(signed=True)>0,(obj.name,'inverted surface winding')
        mesh.free()
    bounds=[]
    for frame in range(384):
        prepare(frame)
        for obj in (stud,heavy,washer,macro_stud,macro_nut,macro_washer,coarse,fine):
            if obj.hide_render: continue
            coords=[world_to_camera_view(scene,cam,obj.matrix_world@Vector(v)) for v in obj.bound_box]
            xs=[c.x for c in coords];ys=[1-c.y for c in coords]
            assert min(xs)>.035 and max(xs)<.965 and min(ys)>.06 and max(ys)<.965,(frame,obj.name,min(xs),max(xs),min(ys),max(ys))
            bounds.append([frame,obj.name,round(min(xs),3),round(max(xs),3),round(min(ys),3),round(max(ys),3)])
    prepare(0);start=[list(cam.location),list(cam.rotation_euler),list(assembly.rotation_euler)]
    prepare(384);end=[list(cam.location),list(cam.rotation_euler),list(assembly.rotation_euler)]
    assert all(abs(v-w)<1e-6 for row,last in zip(start,end) for v,w in zip(row,last))
    print('SOURCING_AUDIT_PASS closed surfaces; 384 full-part bounds; controlled 10/16 TPI comparison; loop pose')
    sys.exit(0)

if a.track:
    keys = []
    for frame in range(385):
        prepare(frame)
        points = annotation_points(frame)
        coords = [world_to_camera_view(scene, cam, point) for point in points]
        keys.append([frame/24,*[round(value,4) for point in coords for value in (point.x,1-point.y)]])
    Path(a.track).write_text(json.dumps(keys, separators=(',',':'))+'\n')

if a.track_only:
    if not a.track: raise ValueError('--track-only requires --track')
    print('SOURCING_TRACK_PASS 385 native-frame projections')
    sys.exit(0)

for frame in a.frames or range(a.start, a.end+1):
    target = out / f'{frame:04d}.png'
    if target.exists() and not a.frames: continue
    scene.frame_set(frame); prepare(frame)
    scene.render.filepath = str(target); bpy.ops.render.render(write_still=True)
    print(f'SOURCING_FRAME {frame:04d}', flush=True)
