"""Original precision fastener film, rendered with physically based studio lighting.

Blender 4.3+: blender -b -t 4 -P tools/render_hero.py -- --out /tmp/frames
Nominal fastener envelopes and the 60-degree basic thread profile come from
reviewed public sources already present in the repository; see precision_geometry.py.
Assemblies are generic equipment examples, not certified equipment or torque procedures.
Render native 24 fps: no optical-flow synthesis of threaded motion.
"""
import argparse
import math
import shutil
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from precision_geometry import (Thread, MM, METRIC12, METRIC16, UNC34, UN8_LARGE, HEX12, SOCKET12, NUT12, WASHER12, HEAVY34, HEAVY_LARGE, engaged_pose, wrench_pose, ratchet_pose)

import bpy
from mathutils import Vector, Matrix

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', required=True)
parser.add_argument('--frames', nargs='+', type=int)
parser.add_argument('--width', type=int, default=1200)
parser.add_argument('--samples', type=int, default=12)
parser.add_argument('--step', type=int, default=1)
parser.add_argument('--engine', choices=['cycles','eevee'], default='cycles')
parser.add_argument('--save-scene', type=str)
parser.add_argument('--audit', action='store_true', help='Audit tool/assembly intersections without rendering')
parser.add_argument('--workbench', action='store_true')
parser.add_argument('--start', type=int, default=0)
parser.add_argument('--end', type=int, default=863)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
FPS, COUNT = 24, 864
TAU = math.tau

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES' if args.engine == 'cycles' else 'BLENDER_EEVEE_NEXT'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = False
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = .12
scene.cycles.adaptive_min_samples = 4
scene.render.use_persistent_data = True
scene.cycles.max_bounces = 5
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 3
scene.cycles.seed = 31
scene.cycles.use_animated_seed = False
scene.render.film_transparent = False
scene.eevee.taa_render_samples = args.samples
scene.render.resolution_x = args.width
scene.render.resolution_y = args.width * 3 // 4
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = FPS
scene.render.film_transparent = False
scene.world.color = (0.12, 0.15, 0.2)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.16, 0.18, 0.20, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.30
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'


def material(name, color, metal=0.0, rough=0.3):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    if metal > .7:
        anisotropy = node.inputs.get('Anisotropic') or node.inputs.get('Anisotropic IOR Level')
        if anisotropy:
            anisotropy.default_value = .25
        noise = mat.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 180
        noise.inputs['Detail'].default_value = 2
        bump = mat.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .16
        bump.inputs['Distance'].default_value = .0006
        mat.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'], node.inputs['Normal'])
    return mat


steel = material('Machined stainless steel', (.30, .34, .38), .98, .23)
zinc = material('Bright steel', (.43, .46, .49), .97, .24)
iron = material('Dark oxide steel', (.055, .060, .066), .91, .28)
body = material('Satin housing', (.22, .25, .28), .9, .30)
orange = material('Unbranded tool / signal orange', (.60, .052, .020), .25, .32)
blue = material('Unbranded pump / deep blue', (.020, .040, .068), .65, .30)
rubber = material('Rubber hoses and seal', (.011, .017, .023), .0, .5)
floor_mat = material('Matte graphite studio', (.015, .020, .026), .0, .42)
line_mat = material('Studio datum lines', (.07, .12, .16), .1, .6)

groups = []


def group(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


def finish(obj, name, mat, parent=None, bevel=0.018):
    obj.name = name
    obj.parent = parent
    if mat:
        if not obj.data.materials:
            obj.data.materials.append(mat)
        else:
            obj.material_slots[0].link = 'OBJECT'
            obj.material_slots[0].material = mat
    if bevel:
        mod = obj.modifiers.new('Machined edge highlights', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = 'ANGLE'
        mod = obj.modifiers.new('Surface normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj


def box(name, size, pos, mat=steel, parent=None, bevel=.035):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = pos
    return finish(obj, name, mat, parent, bevel)


def cylinder(name, radius, height, pos=(0, 0, 0), mat=steel, parent=None, sides=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=height)
    obj = bpy.context.object
    if sides==6:
        # Blender's primitive starts on +Y; our hex openings start on +X.
        obj.data.transform(Matrix.Rotation(-math.pi/2,4,'Z'))
    obj.location = pos
    for face in obj.data.polygons:
        face.use_smooth = abs(face.normal.z) < .5 and sides > 12
    return finish(obj, name, mat, parent, .004)


def profile_radius(radius, angle, sides):
    if sides is None:
        return radius
    return radius * math.cos(math.pi / sides) / math.cos((angle % (TAU / sides)) - math.pi / sides)


def ring(name, outer, inner, height, pos=(0, 0, 0), mat=steel, parent=None,
         outer_sides=None, inner_sides=None, start=0, end=TAU, bevel=.012):
    n = 96
    closed = abs(end - start - TAU) < .0001
    steps = n if closed else n + 1
    verts, faces = [], []
    for radius, z, sides in ((outer, -height/2, outer_sides), (outer, height/2, outer_sides),
                              (inner, -height/2, inner_sides), (inner, height/2, inner_sides)):
        for i in range(steps):
            a = start + (end - start) * i / n
            r = profile_radius(radius, a, sides)
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(n):
        j = (i + 1) % steps
        faces += [(i, j, steps+j, steps+i), (2*steps+i, 3*steps+i, 3*steps+j, 2*steps+j),
                  (steps+i, steps+j, 3*steps+j, 3*steps+i), (i, 2*steps+i, 2*steps+j, j)]
    if not closed:
        faces += [(0, steps, 3*steps, 2*steps), (n, 2*steps+n, 3*steps+n, steps+n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = pos
    for index, face in enumerate(mesh.polygons):
        face.use_smooth = index % 4 < 2 and outer_sides is None
    return finish(obj, name, mat, parent, bevel)


def path(name, points, radius, mat, parent=None):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    return finish(obj, name, mat, parent, 0)


_mesh_cache = {}


def thread_body(parent, spec, length, name='External basic-profile thread', material=zinc, tip_ratio=.88):
    key = ('thread', spec, round(length,6),tip_ratio)
    if key not in _mesh_cache:
        n, steps = 72, max(16, math.ceil(length/spec.lead*16))
        verts, faces = [], []
        for j in range(steps+1):
            z = length*j/steps
            fade = min(1, z/(spec.lead*.55), (length-z)/(spec.lead*.55))
            for i in range(n):
                a = i*TAU/n
                end_ratio=tip_ratio if z < length/2 else .88
                r = spec.radius_at(a,z)*(end_ratio+(1-end_ratio)*max(0,fade))
                verts.append((r*math.cos(a),r*math.sin(a),z))
        for j in range(steps):
            for i in range(n):
                k=(i+1)%n
                faces.append((j*n+i,j*n+k,(j+1)*n+k,(j+1)*n+i))
        faces += [tuple(range(n-1,-1,-1)),tuple(steps*n+i for i in range(n))]
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        for f in mesh.polygons: f.use_smooth=True
        mesh.set_sharp_from_angle(angle=math.radians(35))
        _mesh_cache[key]=mesh
    obj=bpy.data.objects.new(name,_mesh_cache[key]);scene.collection.objects.link(obj)
    return finish(obj,name,material,parent,0)


def threaded_nut(parent, spec, width, height, material=zinc, name='Nut with matching internal thread'):
    key=('nut',spec,round(width,6),round(height,6))
    if key not in _mesh_cache:
        n, steps=72,max(16,math.ceil(height/spec.lead*16))
        verts,faces=[],[]
        for side in (0,1):
            for j in range(steps+1):
                z=height*j/steps
                for i in range(n):
                    a=i*TAU/n
                    if side==0:
                        r=profile_radius(width/math.sqrt(3),a,6)
                        chamfer=min(z,height-z)*math.tan(math.pi/3)
                        r=min(r,width*.48+chamfer)
                    else:
                        r=spec.radius_at(a,z,True)
                        r=max(r,spec.radius*.99-(min(z,height-z)*.6))
                    verts.append((r*math.cos(a),r*math.sin(a),z))
        stride=(steps+1)*n
        for side in (0,1):
            for j in range(steps):
                for i in range(n):
                    k=(i+1)%n;off=side*stride
                    f=(off+j*n+i,off+j*n+k,off+(j+1)*n+k,off+(j+1)*n+i)
                    faces.append(f if side==0 else f[::-1])
        for i in range(n):
            k=(i+1)%n
            faces.append((i,stride+i,stride+k,k))
            faces.append((steps*n+i,steps*n+k,stride+steps*n+k,stride+steps*n+i))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
        for f in mesh.polygons: f.use_smooth=True
        mesh.set_sharp_from_angle(angle=math.radians(35))
        _mesh_cache[key]=mesh
    root=group(name,parent);obj=bpy.data.objects.new(name+' solid',_mesh_cache[key]);scene.collection.objects.link(obj)
    finish(obj,name+' solid',material,root,0)
    return root


def bolt(parent, length=None, cap=False, mat=zinc):
    spec=METRIC12
    length=length if length is not None else (SOCKET12['length'] if cap else HEX12['length'])*MM
    root=group('ISO 4762 M12 cap screw' if cap else 'ISO 4017 M12 hex screw',parent)
    thread_body(root,spec,length,material=mat)
    if cap:
        outer=SOCKET12['dk']*MM/2; height=SOCKET12['k']*MM
        socket=SOCKET12['s']*MM/math.sqrt(3)
        ring('ISO 4762 actual recessed hex',outer,socket,height,(0,0,length+height/2),mat,root,inner_sides=6,bevel=0)
        cylinder('Socket bottom',socket+.003,height-SOCKET12['depth']*MM,(0,0,length+(height-SOCKET12['depth']*MM)/2),mat,root)
    else:
        head=cylinder('ISO 4017 hex head, s=18 mm',HEX12['s']*MM/math.sqrt(3),HEX12['k']*MM,(0,0,length+HEX12['k']*MM/2),mat,root,6)
    return root


def stud(parent, length=1.666875, spec=UNC34):
    root=group('Stud bolt with continuous matching pitch',parent)
    thread_body(root,spec,length,material=iron)
    return root


def nut(parent, mat=zinc, spec=UNC34, dimensions=HEAVY34):
    return threaded_nut(parent,spec,dimensions['s']*spec.scale,dimensions['m']*spec.scale,mat,'Heavy hex nut / matching thread')


def washer(parent, metric=False):
    if metric:
        return ring('ISO 7089 size 12 washer',WASHER12['od']*MM/2,WASHER12['id']*MM/2,WASHER12['t']*MM,(0,0,0),zinc,parent)
    # Equipment washer envelope: no F436/dimensional-standard claim.
    return ring('Equipment washer / drawing specified',.355,.188,.05,(0,0,0),zinc,parent)


def clip(parent, radius=.40):
    root = group('External retaining ring', parent)
    ring('Open spring retaining ring', radius, radius*.8, .055,
         (0, 0, 0), iron, root, start=.24, end=TAU-.24)
    for a in (.24, TAU-.24):
        ring('Plier eye', .10, .034, .055, (radius*.92*math.cos(a), radius*.92*math.sin(a), 0), iron, root)
    return root


def plate(parent, radius, bore, height, bolt_circle, holes, pos, hole_radius=.18):
    curve = bpy.data.curves.new('Flange with genuine through holes', 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = height/2
    curve.bevel_depth = .012
    curve.bevel_resolution = 2
    circles = [(0, 0, radius, False), (0, 0, bore, True)]
    circles += [(bolt_circle*math.cos(i*TAU/holes), bolt_circle*math.sin(i*TAU/holes), hole_radius, True) for i in range(holes)]
    for x, y, r, reverse in circles:
        spline = curve.splines.new('POLY')
        spline.points.add(63)
        for i, point in enumerate(spline.points):
            a = (-1 if reverse else 1)*i*TAU/64
            point.co = (x+r*math.cos(a), y+r*math.sin(a), 0, 1)
        spline.use_cyclic_u = True
    obj = bpy.data.objects.new('Flange / circular bolt pattern', curve)
    scene.collection.objects.link(obj)
    obj.location = pos
    return finish(obj, 'Flange / circular bolt pattern', body, parent, 0)


def lathe(parent, points, name='Bowl housing'):
    n, verts, faces = 96, [], []
    for r, z in points:
        verts += [(r*math.cos(i*TAU/n), r*math.sin(i*TAU/n), z) for i in range(n)]
    for j in range(len(points)):
        k = (j+1) % len(points)
        for i in range(n):
            h = (i+1) % n
            faces.append((j*n+i, j*n+h, k*n+h, k*n+i))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    for face in mesh.polygons:
        face.use_smooth = True
    return finish(obj, name, body, parent, .014)


def spanner(parent, width=HEAVY34['s']*MM):
    root = group('Combination wrench', parent)
    ring('Box end / hex engagement', .43, width/math.sqrt(3)+.002, .09, (0, 0, 0), steel, root, inner_sides=6,bevel=0)
    # Cranked box end: the handle clears the adjacent seated studs during the swing.
    neck=box('Offset wrench neck',(.19,math.hypot(.60,.48),.065),
             (0,.63,.24),steel,root,.018)
    neck.rotation_euler.x=math.atan2(.48,.60)
    box('Raised wrench handle',(.19,1.36,.065),(0,1.48,.48),steel,root,.022)
    ring('Open end',.36,.23,.09,(0,2.15,.48),steel,root,start=2.1,end=7.3)
    return root


def ratchet(parent):
    root = group('Ratchet with socket', parent)
    ring('Hex socket / nut engagement', .34, .305, .35, (0, 0, .05), steel, root, inner_sides=6)
    cylinder('Ratchet head', .31, .13, (0, 0, .29), steel, root)
    cylinder('Direction selector', .085, .025, (0, 0, .365), iron, root)
    box('Ratchet handle', (.19, 1.40, .12), (0, .89, .29), steel, root, .045)
    box('Grip', (.245, .70, .18), (0, 1.30, .29), iron, root, .075)
    return root


def hex_key(parent, width=4*MM):
    root = group('L-shaped hex key / actual six-sided bar', parent)
    centers = [(0, 0, 0, 0), (0, 0, .43, 0)]
    for index in range(1, 9):
        angle = index*math.pi/16
        centers.append((0, .14-.14*math.cos(angle), .43+.14*math.sin(angle), angle))
    centers.append((0, .88, .57, math.pi/2))
    verts, faces = [], []
    for x, y, z, angle in centers:
        for index in range(6):
            a = index*TAU/6
            verts.append((x+width/math.sqrt(3)*math.cos(a), y+width/math.sqrt(3)*math.sin(a)*math.cos(angle),
                          z-width/math.sqrt(3)*math.sin(a)*math.sin(angle)))
    for section in range(len(centers)-1):
        for index in range(6):
            nxt = (index+1) % 6
            faces.append((section*6+index, section*6+nxt, (section+1)*6+nxt, (section+1)*6+index))
    faces += [tuple(range(5,-1,-1)), tuple((len(centers)-1)*6+index for index in range(6))]
    mesh = bpy.data.meshes.new('Six-sided hex key')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new('Six-sided hex key', mesh)
    scene.collection.objects.link(obj)
    finish(obj, 'Six-sided hex key', steel, root, .005)
    return root


def cut(obj, pos, size):
    cutter = box('Temporary keyway cutter', size, pos, None, obj.parent, 0)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('True keyway', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def ease(t, start, end):
    x = max(0, min(1, (t-start)/(end-start)))
    return x*x*(3-2*x)


def descend(obj, t, start, end, final, distance=1.5):
    p = ease(t, start, end)
    obj.location.z = final + distance*(1-p)
    return p


def appear_after(root, seconds):
    for obj in (root, *root.children_recursive):
        obj['hero_after'] = seconds


def intro():
    root = group('01 / fastener collection')
    items = [bolt(root), bolt(root, cap=True, mat=iron), stud(root), nut(root), washer(root,True),
             cylinder('Dowel pin', .19, 1.30, mat=zinc, parent=root),
             box('Parallel key', (.28, 1.15, .26), (0, 0, 0), zinc, root, .065), clip(root, .58)]
    for item in items:
        item.location.z = 1.15
    def update(t):
        active = min(7, int(t/(6/8)))
        local = (t/(6/8)) % 1
        for i, item in enumerate(items):
            if item.hide_render != (i != active):
                item.hide_render = i != active
            for child in item.children_recursive:
                if child.hide_render != (i != active):
                    child.hide_render = i != active
        item = items[active]
        item.scale = (1.7,)*3
        item.rotation_euler = (.40, -.40, -.3 + local*.8)
        item.location.z = 1.04 + .055*math.sin(local*math.pi)
        if active in (0, 1, 2):
            item.location.z = .15
        if active == 3:
            item.scale = (3.2,)*3
        if active == 4:
            item.scale = (3.1,)*3
    return root, update


def thread_scene():
    # A stationary sectioned nut makes the matching flanks visible.
    # This is a basic-profile section illustration, not a tolerance gauge.
    root=group('02 / right-hand thread engagement / section illustration')
    # Seamless studio cove behind the low-angle section camera.
    profile=[(5+3*math.sin(i*math.pi/48),3-3*math.cos(i*math.pi/48)) for i in range(25)]
    profile.append((8,15))
    vertices=[(x,y,z) for x in (-40,40) for y,z in profile]
    n=len(profile)
    mesh=bpy.data.meshes.new('Seamless section backdrop')
    mesh.from_pydata(vertices,[],[(i,i+1,n+i+1,n+i) for i in range(n-1)])
    mesh.update()
    for face in mesh.polygons: face.use_smooth=True
    backdrop=bpy.data.objects.new('Section studio cove',mesh)
    scene.collection.objects.link(backdrop)
    finish(backdrop,'Section studio cove',floor_mat,root,0)
    spec=Thread(16,2,MM*3)
    receiver=threaded_nut(root,spec,24*spec.scale,14.8*spec.scale,zinc,'M16 x 2 / sectioned nut')
    receiver.location.z=1.30
    solid=receiver.children[0];solid.data=solid.data.copy()
    cut(solid,(0,-2,14.8*spec.scale/2),(4,4,3))
    screw=stud(root,50*spec.scale,spec)
    def update(t):
        turns=1-ease(t,.35,3.35)
        z,angle=engaged_pose(spec,.30,turns,1.30)
        screw.location.z=z;screw.rotation_euler.z=angle
    return root,update


def flange(root, spec=UNC34, dimensions=HEAVY34):
    plate(root,1.80,.66,.27,1.43,8,(0,0,.80),spec.radius+.018)
    ring('Lower pipe neck',.88,.66,.66,(0,0,.335),body,root)
    ring('Gasket seated between flange faces',1.03,.67,.04,(0,0,.955),rubber,root)
    upper=group('Aligned upper flange and pipe',root)
    plate(upper,1.80,.66,.27,1.43,8,(0,0,1.11),spec.radius+.018)
    ring('Upper pipe neck',.88,.66,.60,(0,0,1.545),body,upper)
    nut_h=dimensions['m']*spec.scale
    nuts=[];washers=[];studs=[];lower_nuts=[]
    # Assembly envelope is generic, with no ASME B16.5 pressure-class claim.
    for i in range(8):
        a=i*TAU/8;x,y=1.43*math.cos(a),1.43*math.sin(a)
        st=stud(root,1.666875,spec);st.location=(x,y,.20);studs.append(st)
        lowerw=washer(root);lowerw.location=(x,y,.640)
        lower=nut(root,spec=spec,dimensions=dimensions)
        z,angle=engaged_pose(spec,.615-nut_h,0,.20)
        lower.location=(x,y,z);lower.rotation_euler.z=angle;lower_nuts.append(lower)
        w=washer(root);w.location=(x,y,1.27);washers.append(w)
        n=nut(root,spec=spec,dimensions=dimensions)
        z,angle=engaged_pose(spec,1.295,0,.20)
        n.location=(x,y,z);n.rotation_euler.z=angle;nuts.append(n)
    return upper,nuts,washers,studs,lower_nuts


def flange_scene():
    root=group('03 / matched flange bolting')
    upper,nuts,washers,_,_=flange(root)
    tool=spanner(root);appear_after(tool,1.55)
    target=nuts[7].location.copy()
    def update(t):
        upper.location.z=0
        z,angle,lift,tool_angle=wrench_pose(UNC34,1.295,t,2.1,reference=.20)
        # Only the selected nut is driven; all other fasteners remain seated.
        nuts[7].location.z=z;nuts[7].rotation_euler.z=angle
        tool.location=(target.x,target.y,z+.18+lift+.70*(1-ease(t,1.55,2.10)))
        tool.rotation_euler.z=tool_angle
    return root,update


def bowl_scene():
    root=group('04 / socket screw into a threaded housing')
    lathe(root,[(.85,0),(1.07,.20),(1.35,.62),(1.42,1.18),(1.42,1.35),
                (1.23,1.35),(1.23,1.15),(1.17,.66),(.90,.32),(.66,.29),(.66,.04)])
    plate(root,1.74,1.20,.30,1.53,8,(0,0,1.50),METRIC12.radius+.003)
    lid=group('Housing cover with clearance holes',root)
    plate(lid,1.74,.46,.18,1.53,8,(0,0,1.76),WASHER12['id']*MM/2)
    ring('Cover neck',.66,.46,.32,(0,0,1.99),body,lid)
    ring('Cover gasket',1.40,1.20,.020,(0,0,1.66),rubber,root)
    seat=1.85+WASHER12['t']*MM
    length=SOCKET12['length']*MM
    screws=[];washers=[]
    for i in range(8):
        a=i*TAU/8;x,y=1.53*math.cos(a),1.53*math.sin(a)
        w=washer(root,True);w.location=(x,y,1.85+WASHER12['t']*MM/2);washers.append(w)
        # Actual matching threaded bore, with no solid material in the screw path.
        receiver=threaded_nut(root,METRIC12,.27,.30,body,'Tapped housing M12 x 1.75')
        receiver.location=(x,y,1.35)
        b=bolt(root,cap=True,mat=iron)
        z,angle=engaged_pose(METRIC12,seat-length,0,1.35)
        b.location=(x,y,z);b.rotation_euler.z=angle;screws.append(b)
    tool=group('Ratchet body and driven hex bit',root)
    cylinder('Ratchet head',.18,.08,(0,0,.17),steel,tool)
    cylinder('Direction selector',.046,.018,(0,0,.22),iron,tool)
    box('Forged ratchet handle',(.095,1.12,.06),(0,.65,.17),steel,tool,.018)
    box('Ratchet grip',(.135,.55,.10),(0,1.00,.17),iron,tool,.038)
    drive=group('Drive holding its position on the return stroke',tool)
    cylinder('Hex bit',SOCKET12['s']*MM/math.sqrt(3)*.985,.15,(0,0,0),steel,drive,6)
    cylinder('Bit socket carrier',.125,.12,(0,0,.12),steel,drive)
    appear_after(tool,1.05)
    def update(t):
        lid.location.z=0
        b=screws[7]
        z,angle,handle=ratchet_pose(METRIC12,seat-length,t,1.70,reference=1.35)
        b.location.z=z;b.rotation_euler.z=angle
        socket_top=z+length+SOCKET12['k']*MM
        tool.location=(b.location.x,b.location.y,socket_top-.030+.50*(1-ease(t,1.05,1.70)))
        tool.rotation_euler.z=handle
        drive.rotation_euler.z=angle-handle
    return root,update


def shaft_scene():
    root = group('05 / keyed shaft and retaining ring')
    root.location.z=-.10
    shaft = cylinder('Shaft with real keyway', .40, 3.45, (-.30, 0, 1.14), steel, root)
    shaft.rotation_euler.y = math.pi/2
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    cut(shaft, (.18, 0, 1.51), (.70, .23, .22))
    for x, length, radius in ((1.50, .20, .34), (1.64, .08, .308), (1.84, .31, .34)):
        seg = cylinder('Shaft end / circlip groove', radius, length, (x, 0, 1.14), steel, root)
        seg.rotation_euler.y = math.pi/2
    key = box('Parallel key seated in shaft keyway', (.64, .22, .20), (.18, 0, 1.50), zinc, root, .035)
    hub = group('Keyed hub', root)
    h = ring('Hub bore and keyway', 1.04, .415, .80, (0, 0, 0), body, hub)
    cut(h, (-.49, 0, 0), (.21, .24, 1.1))
    face = plate(hub, .97, .415, .075, .72, 6, (0, 0, .43), .12)
    cutter=cylinder('Radial tapped-hole cutter',.078,.75,(-.78,0,0),None,hub)
    cutter.rotation_euler.y=math.pi/2
    bpy.context.view_layer.objects.active=h
    mod=h.modifiers.new('Real radial bore','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    hub.rotation_euler.y = math.pi/2
    hub.location = (.18, 0, 1.14)
    retaining = clip(root, .385)
    retaining.rotation_euler.y = math.pi/2
    retaining.location = (1.64, 0, 1.14)
    spacer=ring('Axial retaining sleeve / hub to retaining ring',.55,.415,1.6125-.66,((1.6125+.66)/2,0,1.14),zinc,root)
    spacer.rotation_euler.y=math.pi/2
    set_spec=Thread(8,1.25);set_length=30*MM;set_seat=1.60
    screw=group('ISO 4026 M8 flat-point set screw',root)
    body_screw=thread_body(screw,set_spec,set_length,material=iron,tip_ratio=.6875)
    body_screw.data=body_screw.data.copy()
    recess=cylinder('Set screw hex recess cutter',4*MM/math.sqrt(3),.13,(0,0,set_length-.01),None,screw,6)
    bpy.context.view_layer.objects.active=body_screw
    mod=body_screw.modifiers.new('Actual internal hex recess','BOOLEAN');mod.operation='DIFFERENCE';mod.object=recess
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(recess,do_unlink=True)
    receiver=threaded_nut(hub,set_spec,.19,.58,body,'Matching M8 hub bore')
    receiver.location=(-.46,0,0);receiver.rotation_euler.y=-math.pi/2
    screw.location=(.18,0,set_seat)
    appear_after(screw,4.10)
    tool=hex_key(root,4*MM*.985);appear_after(tool,4.65)
    def update(t):
        key.location.z=1.50+.65*(1-ease(t,.1,.85))
        hub.location.x=.18+2.15*(1-ease(t,.9,2.3))
        retaining.location.x=1.64+.80*(1-ease(t,2.4,3.65))
        expand=1+.14*(1-ease(t,3.5,3.90))
        retaining.scale=(expand,expand,1)
        turns=1-ease(t,5.10,5.65)
        z,angle=engaged_pose(set_spec,set_seat,turns,set_seat)
        screw.location.z=z;screw.rotation_euler.z=angle
        tool.location=(.18,0,z+set_length-.045+.5*(1-ease(t,4.65,5.10)))
        tool.rotation_euler.z=angle

    return root, update


def hydraulic_scene():
    root = group('06 / hydraulic torque wrench and reaction arm')
    upper, nuts, washers, studs, lower_nuts = flange(root, UN8_LARGE, HEAVY_LARGE)
    tool = group('Hydraulic torque wrench', root)
    target = nuts[7].location.copy()
    tool.location = (target.x, target.y, 1.51)
    drive = ring('Driven hex socket', .43, HEAVY_LARGE['s']*UN8_LARGE.scale/math.sqrt(3)+.002, .32, (0, 0, .02), iron, tool, inner_sides=6,bevel=0)
    ring('Drive head / protruding stud clearance', .46, UN8_LARGE.radius+.014, .27,
         (0, 0, .32), orange, tool)
    box('Hydraulic cylinder body', (.63, 1.28, .43), (0, - .89, .61), orange, tool, .11)
    box('Actuator top plate', (.47, .86, .035), (0, -.76, .85), iron, tool, .035)
    piston = cylinder('Hydraulic actuator', .18, .55, (0, -1.36, .62), iron, tool)
    piston.rotation_euler.x = math.pi/2
    box('Fixed hydraulic manifold',(.53,.24,.26),(0,-1.31,.94),orange,tool,.025)
    # Rigid arm bears against the neighbouring nut, not an unsupported block.
    neighbour = nuts[0].location-target
    heading = math.atan2(neighbour.y, neighbour.x)
    # Clock the neighbouring pair together so the pad bears on a flat face.
    # Rotating its stud and both nuts equally preserves their mating thread phase.
    clocking=heading+math.pi-math.pi/6-nuts[0].rotation_euler.z
    for part in (nuts[0],studs[0],lower_nuts[0]):
        part.rotation_euler.z+=clocking
    facing=HEAVY_LARGE['s']*UN8_LARGE.scale/2
    length = neighbour.xy.length-facing-.105
    arm = box('Reaction arm / adjacent nut contact', (length-.24, .22, .18),
              (math.cos(heading)*(length+.24)/2, math.sin(heading)*(length+.24)/2, .32), iron, tool, .035)
    arm.rotation_euler.z = heading
    pad = box('Reaction contact pad', (.21, .40, .55),
              (math.cos(heading)*length, math.sin(heading)*length, .145), iron, tool, .025)
    pad.rotation_euler.z = heading
    appear_after(tool, .25)
    pump = box('Unbranded hydraulic pump', (.86, .76, .59), (2.2, 1.2, .31), blue, root, .1)
    box('Pump carrying handle', (.12, .65, .12), (2.2, 1.2, .74), iron, root, .035)
    cylinder('Pump gauge', .14, .06, (1.99, 1.04, .65), zinc, root)
    hoses = []
    for i in range(2):
        x = target.x + (-.17 if i == 0 else .17)
        y = target.y-1.59
        hoses.append(path('Hydraulic supply / return hose', [(x, y, 2.46), (x, y-.50, 2.40), (x+.4, y-.90, 1.0),
             (2.9+i*.17, -.7, .14), (2.85+i*.12, .8, .16), (2.79, 1.0+i*.18, .52)], .048, rubber, root))
        fitting = cylinder('Hose quick connector', .071, .16, ((-.17 if i==0 else .17), -1.51, .98), zinc, tool)
        fitting.rotation_euler.x = math.pi/2
        hoses.append(fitting)
        pump_fitting=cylinder('Pump hose connector',.071,.16,(2.71,1.0+i*.18,.52),zinc,root)
        pump_fitting.rotation_euler.y=math.pi/2
        hoses.append(pump_fitting)
    def update(t):
        tool.location.z = 1.48+.60*(1-ease(t, .25, 1.5))
        # The reaction pad is stationary. The drive and nut share pitch advance.
        elapsed=max(0,t-1.5)/.7
        cycle=min(4,int(elapsed));phase=elapsed%1 if cycle<4 else 1
        stroke=ease(phase,.03,.48) if cycle<4 else 0
        progress=min(1,(cycle+stroke)/4)
        z,angle=engaged_pose(UN8_LARGE,1.295,.12*(1-progress),.20)
        nuts[7].location.z=z;nuts[7].rotation_euler.z=angle
        drive.rotation_euler.z=angle
        tool.location.z+=z-1.295
        piston.location.y=-1.36-.06*(stroke-ease(phase,.52,.98)) if cycle<4 else -1.36
        for hose in hoses:
            if hose.hide_render != (t < 1.7):
                hose.hide_render = t < 1.7
    return root, update


for maker in (intro, thread_scene, flange_scene, bowl_scene, shaft_scene, hydraulic_scene):
    groups.append(maker())

# Consistent cinematic metal lighting, without any third-party HDRI or texture.
box('Studio floor', (200, 200, .10), (0, 0, -.05), floor_mat, bevel=0)


def light(name, loc, power, color, size, target=(0, 0, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = 'RECTANGLE'
    data.size_y = size*.45
    data.size = size
    data.use_shadow = True
    data.shadow_filter_radius = .35
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z', 'Y').to_euler()


light('Large white key', (1, -4, 7), 1500, (1, .96, .91), 5)
light('Cool edge', (-4, 1, 5), 1750, (.63, .82, 1), 4)
light('Soft white strip', (4, 4, 6), 1900, (1, 1, 1), 3)
light('Warm edge', (4, -2, 2.5), 650, (1, .48, .27), 3)
cam_data = bpy.data.cameras.new('Camera')
cam = bpy.data.objects.new('Camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 70
cam.data.dof.use_dof = True
cam.data.dof.aperture_fstop = 8
cam.data.clip_end = 300

# Bake constant bevels/curves once instead of evaluating them for each frame.
bpy.ops.object.select_all(action='DESELECT')
geometry = [obj for obj in scene.objects if obj.type in {'MESH', 'CURVE'}]
for obj in geometry:
    obj.select_set(True)
bpy.context.view_layer.objects.active = geometry[0]
bpy.ops.object.convert(target='MESH')


def prepare(frame):
    seconds = frame/FPS
    starts = (0, 6, 10, 17, 23, 30)
    chapter = max(i for i, t in enumerate(starts) if seconds >= t)
    local = seconds-starts[chapter]
    for index, (root, update) in enumerate(groups):
        for obj in (root, *root.children_recursive):
            hidden = index != chapter or bool(obj.get('hero_hidden')) or local < obj.get('hero_after', 0)
            if obj.hide_render != hidden:
                obj.hide_render = hidden
        if index == chapter:
            update(local)
    camera_time=min(local,{1:3.35,2:5.55,3:5.15,4:5.9,5:4.6}.get(chapter,local))
    orbit = .08*math.sin(camera_time*.45)
    distance = 9.6 if chapter == 0 else 11.8
    pullback = 1-ease(local, .2, 3.4)
    if chapter in (2, 3, 4):
        distance += 1.5*pullback
    if chapter == 5:
        distance = 11.5
    cam.location = (distance*.63*math.cos(orbit)-distance*.81*math.sin(orbit),
                    -distance*.81*math.cos(orbit)-distance*.63*math.sin(orbit), 6.8)
    target = Vector((0, 0, 1.30 if chapter == 0 else 1.20))
    if chapter in (2, 3):
        target.z += .60*pullback
    if chapter == 1:
        target=Vector((0,0,1.75))
        cam.location=(3.3,-5.3,2.9)
    # Close inspection cut once the flange's selected nut has seated.
    if chapter == 2 and local >= 5.55:
        target=Vector((1.011,-1.011,1.50))
        cam.location=target+Vector((3.15,-4.35,2.70))
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.dof.focus_distance = (target-cam.location).length
    bpy.context.view_layer.update()


if args.audit:
    from precision_audit import audit_tools
    audit_tools(groups,prepare,FPS)
    print('HERO_AUDIT PASS',flush=True)
    sys.exit(0)

if args.workbench:
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'MATCAP'
    scene.display.shading.studio_light = 'metal_shiny.exr'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.curvature_ridge_factor = 1.3
    scene.display.shading.curvature_valley_factor = 1.2
    scene.display.shading.background_type = 'WORLD'
    scene.display.render_aa = '16'

if args.save_scene:
    prepare(300)
    bpy.ops.wm.save_as_mainfile(filepath=args.save_scene)

frames=args.frames or range(args.start,args.end+1,args.step)
pending=out/'.pending'
pending.mkdir(exist_ok=True)
previous_state=None
previous_frame=None
for frame in frames:
    target=out/f'{frame:04d}.png'
    if target.exists() and not args.frames:
        continue
    scene.frame_set(frame)
    prepare(frame)
    # A deliberate still hold has exactly the same geometry and camera state.
    # Reuse that rendered state rather than recomputing an identical image.
    state=tuple((obj.name,tuple(round(value,10) for row in obj.matrix_world for value in row))
                for obj in scene.objects if not obj.hide_render and obj.type in {'MESH','LIGHT','CAMERA'})
    state+=(('focus',round(cam.data.dof.focus_distance,10)),)
    if state==previous_state and previous_frame and previous_frame.is_file():
        shutil.copyfile(previous_frame,target)
        previous_frame=target
        print(f'HERO_HOLD {frame} / {COUNT}',flush=True)
        continue
    temporary=pending/target.name
    scene.render.filepath=str(temporary)
    bpy.ops.render.render(write_still=True)
    if not temporary.is_file():
        raise RuntimeError(f'Render produced no frame: {frame}')
    temporary.replace(target)
    previous_state=state
    previous_frame=target
    print(f'HERO_FRAME {frame} / {COUNT}',flush=True)
