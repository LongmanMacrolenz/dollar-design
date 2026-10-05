"""Original, illustrative fastener assemblies for the home-page film.

Blender 4.3+: blender -b -t 4 -P tools/render_hero.py -- --out /tmp/hero-frames
Use --frames 24 240 420 600 780 to inspect stills before rendering the film.
Geometry is artistic, not a dimensioned drawing or a tightening procedure.
No reference-document images, tables, dimensions, or third-party models are used.
The film has five chapters at 24 fps: 0, 6.5, 14.5, 21.5, and 28.5 seconds.
Encode the frames to H.264/WebM after rendering; the website uses these local files.
"""
import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', required=True)
parser.add_argument('--frames', nargs='+', type=int)
parser.add_argument('--width', type=int, default=960)
parser.add_argument('--samples', type=int, default=2)
parser.add_argument('--step', type=int, default=3)
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
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.taa_render_samples = args.samples
scene.render.resolution_x = args.width
scene.render.resolution_y = args.width * 3 // 4
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = FPS
scene.render.film_transparent = False
scene.world.color = (0.12, 0.15, 0.2)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.19, 0.23, 0.3, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.38
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
    return mat


steel = material('Machined stainless steel', (.55, .63, .69), .94, .21)
zinc = material('Bright steel', (.71, .74, .77), .88, .25)
iron = material('Dark oxide steel', (.06, .075, .095), .82, .29)
body = material('Satin housing', (.29, .35, .40), .84, .3)
orange = material('Unbranded tool / signal orange', (.9, .18, .045), .36, .28)
blue = material('Unbranded pump / deep blue', (.045, .22, .32), .4, .32)
rubber = material('Rubber hoses and seal', (.011, .017, .023), .0, .5)
floor_mat = material('Charcoal studio', (.009, .015, .023), .08, .65)
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
        obj.data.materials.append(mat)
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
    obj.location = pos
    for face in obj.data.polygons:
        face.use_smooth = abs(face.normal.z) < .5 and sides > 12
    return finish(obj, name, mat, parent)


def profile_radius(radius, angle, sides):
    if sides is None:
        return radius
    return radius * math.cos(math.pi / sides) / math.cos((angle % (TAU / sides)) - math.pi / sides)


def ring(name, outer, inner, height, pos=(0, 0, 0), mat=steel, parent=None,
         outer_sides=None, inner_sides=None, start=0, end=TAU):
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
    return finish(obj, name, mat, parent, .012)


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


def thread(parent, radius, length, offset=0, pitch=.1, mat=steel):
    curve = bpy.data.curves.new('Illustrative continuous helical thread', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = pitch * .22
    curve.bevel_resolution = 1
    turns = length / pitch
    n = max(16, int(turns * 20))
    spline = curve.splines.new('POLY')
    spline.points.add(n)
    for i, point in enumerate(spline.points):
        a = turns * TAU * i/n
        point.co = (radius * math.cos(a), radius * math.sin(a), offset + length*i/n, 1)
    obj = bpy.data.objects.new('Thread helix', curve)
    scene.collection.objects.link(obj)
    finish(obj, 'Thread helix', mat, parent, 0)


def bolt(parent, length=1.0, cap=False, mat=zinc):
    root = group('Socket-head cap screw' if cap else 'Hex-head bolt', parent)
    cylinder('Shank', .145, length, (0, 0, length/2), mat, root)
    thread(root, .15, length*.7, .025, .09, mat)
    if cap:
        ring('Actual hex socket in cylindrical head', .26, .13, .32,
             (0, 0, length+.16), mat, root, inner_sides=6)
        cylinder('Socket floor', .14, .06, (0, 0, length+.035), mat, root)
    else:
        cylinder('Hexagonal head', .30, .21, (0, 0, length+.105), mat, root, 6)
    return root


def stud(parent, length=1.25):
    root = group('Stud bolt', parent)
    cylinder('Stud body', .15, length, (0, 0, length/2), iron, root)
    thread(root, .151, length, 0, .095, iron)
    return root


def nut(parent, mat=zinc):
    root = group('Heavy hex nut', parent)
    ring('Hex nut with through bore', .30, .16, .24, (0, 0, .12), mat, root, outer_sides=6)
    thread(root, .168, .19, .024, .075, mat)
    return root


def washer(parent):
    return ring('Flat washer', .36, .165, .045, (0, 0, 0), zinc, parent)


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


def spanner(parent):
    root = group('Combination wrench', parent)
    ring('Box end / hex engagement', .43, .317, .09, (0, 0, 0), steel, root, inner_sides=6)
    box('Wrench handle', (.19, 1.55, .065), (0, .94, 0), steel, root, .022)
    jaw = ring('Open end', .36, .23, .09, (0, 1.78, 0), steel, root, start=2.1, end=7.3)
    return root


def ratchet(parent):
    root = group('Ratchet with socket', parent)
    ring('Hex socket / nut engagement', .34, .305, .35, (0, 0, .05), steel, root, inner_sides=6)
    cylinder('Ratchet head', .31, .13, (0, 0, .29), steel, root)
    cylinder('Direction selector', .085, .025, (0, 0, .365), iron, root)
    box('Ratchet handle', (.19, 1.40, .12), (0, .89, .29), steel, root, .045)
    box('Grip', (.245, .70, .18), (0, 1.30, .29), iron, root, .075)
    return root


def hex_key(parent):
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
            verts.append((x+.118*math.cos(a), y+.118*math.sin(a)*math.cos(angle),
                          z-.118*math.sin(a)*math.sin(angle)))
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
    cutter = box('Temporary keyway cutter', size, pos, None, None, 0)
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
    items = [bolt(root, 1.50), bolt(root, 1.25, True, iron), stud(root, 1.85), nut(root), washer(root),
             cylinder('Dowel pin', .19, 1.30, mat=zinc, parent=root),
             box('Parallel key', (.28, 1.15, .26), (0, 0, 0), zinc, root, .065), clip(root, .58)]
    for item in items:
        item.location.z = 1.15
    def update(t):
        active = min(7, int(t/(6.5/8)))
        local = (t/(6.5/8)) % 1
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


def flange(root, animated=True):
    plate(root, 1.80, .66, .27, 1.43, 8, (0, 0, .82))
    ring('Lower pipe neck', .88, .66, .74, (0, 0, .33), body, root)
    ring('Seal between flange faces', 1.03, .67, .055, (0, 0, 1.00), rubber, root)
    upper = group('Upper flange and pipe', root)
    plate(upper, 1.80, .66, .27, 1.43, 8, (0, 0, 1.17))
    ring('Upper pipe neck', .88, .66, .65, (0, 0, 1.60), body, upper)
    studs, washers, nuts = [], [], []
    for i in range(8):
        a = i*TAU/8
        x, y = 1.43*math.cos(a), 1.43*math.sin(a)
        s = stud(root, 1.10)
        s.location = (x, y, .54)
        n = nut(root)
        n.location = (x, y, .45)
        w = washer(root)
        w.location = (x, y, 1.34)
        n2 = nut(root)
        n2.location = (x, y, 1.36)
        studs.append(s)
        washers.append(w)
        nuts.append(n2)
    def update(t):
        upper.location.z = 1.2*(1-ease(t, .2, 2.0)) if animated else 0
        for i, (s, w, n) in enumerate(zip(studs, washers, nuts)):
            if animated:
                descend(s, t, .55+i*.11, 2.3+i*.11, .54, 1.7)
                descend(w, t, 1.8+i*.10, 3.2+i*.10, 1.34, 1.6)
                p = descend(n, t, 2.3+i*.10, 4.0+i*.10, 1.36, 1.8)
                n.rotation_euler.z = -p*TAU*1.2
    return update, nuts


def flange_scene():
    root = group('02 / flange bolting')
    assemble, nuts = flange(root)
    tool = spanner(root)
    appear_after(tool, 4.0)
    target = nuts[7].location.copy()
    tool.location = (target.x, target.y, 1.5)
    def update(t):
        assemble(t)
        tool.location.z = 1.50 + 1.9*(1-ease(t, 4.0, 4.7))
        cycles = max(0, t-4.7)/1.3
        cycle, phase = math.floor(cycles), cycles % 1
        stroke = TAU/6  # Reindex a six-point wrench by one flat.
        progress = ease(phase, .02, .52)
        start_angle = -TAU*1.2
        nuts[7].rotation_euler.z = start_angle-stroke*(cycle+progress)
        tool.rotation_euler.z = start_angle-stroke*progress+stroke*ease(phase, .72, .86)
        tool.location.z += .27*(ease(phase, .53, .70)-ease(phase, .87, .99))
    return root, update


def bowl_scene():
    root = group('03 / bowl housing assembly')
    lathe(root, [(.85, .0), (1.07, .20), (1.35, .62), (1.42, 1.18), (1.42, 1.50),
                 (1.23, 1.50), (1.23, 1.15), (1.17, .66), (.90, .32), (.66, .29), (.66, .04)])
    plate(root, 1.74, 1.20, .16, 1.53, 8, (0, 0, 1.5), .16)
    lid = group('Bowl cover / aligned bolt holes', root)
    plate(lid, 1.74, .46, .18, 1.53, 8, (0, 0, 1.69), .16)
    ring('Cover neck', .66, .46, .32, (0, 0, 1.93), body, lid)
    screws, washers = [], []
    for i in range(8):
        a = i*TAU/8
        b = bolt(root, .60, True, iron)
        b.location = (1.53*math.cos(a), 1.53*math.sin(a), 1.217)
        screws.append(b)
        w = washer(root)
        w.scale = (.8,)*3
        w.location = (b.location.x, b.location.y, 1.80)
        washers.append(w)
    tool = ratchet(root)
    # Hex-bit socket for the recessed hex in a socket-head screw.
    for child in tool.children:
        if child.name.startswith('Hex socket'):
            child['hero_hidden'] = True
    bit = cylinder('Hex bit seated in cap-screw socket', .115, .27, (0, 0, .05), steel, tool, 6)
    appear_after(tool, 3.8)
    def update(t):
        lid.location.z = 1.45*(1-ease(t, .2, 1.9))
        for i, (b, w) in enumerate(zip(screws, washers)):
            descend(w, t, 1.3+i*.10, 2.6+i*.10, 1.80, 1.4)
            p = descend(b, t, 1.8+i*.10, 3.4+i*.10, 1.217, 1.8)
            b.rotation_euler.z = -p*TAU
        b = screws[7]
        tool.location = (b.location.x, b.location.y, 2.05+1.5*(1-ease(t, 3.8, 4.4)))
        cycles = max(0, t-4.4)/1.15
        cycle, phase = math.floor(cycles), cycles % 1
        progress = ease(phase, .02, .5)
        stroke = TAU/12
        b.rotation_euler.z = -TAU-stroke*(cycle+progress)
        tool.rotation_euler.z = -.6-stroke*progress+stroke*ease(phase, .53, .97)
        bit.rotation_euler.z = b.rotation_euler.z-tool.rotation_euler.z
    return root, update


def shaft_scene():
    root = group('04 / keyed shaft and retaining ring')
    shaft = cylinder('Shaft with real keyway', .40, 3.45, (-.30, 0, 1.14), steel, root)
    shaft.rotation_euler.y = math.pi/2
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    cut(shaft, (-.08, 0, 1.51), (.95, .23, .22))
    for x, length, radius in ((1.50, .20, .34), (1.64, .08, .30), (1.84, .31, .34)):
        seg = cylinder('Shaft end / circlip groove', radius, length, (x, 0, 1.14), steel, root)
        seg.rotation_euler.y = math.pi/2
    key = box('Parallel key seated in shaft keyway', (.86, .22, .20), (-.08, 0, 1.50), zinc, root, .035)
    hub = group('Keyed hub', root)
    h = ring('Hub bore and keyway', 1.04, .415, .80, (0, 0, 0), body, hub)
    cut(h, (-.49, 0, 0), (.21, .24, 1.1))
    face = plate(hub, .97, .415, .075, .72, 6, (0, 0, .43), .12)
    hub.rotation_euler.y = math.pi/2
    hub.location = (.18, 0, 1.14)
    retaining = clip(root, .385)
    retaining.rotation_euler.y = math.pi/2
    retaining.location = (1.64, 0, 1.14)
    screw = bolt(root, .36, True, iron)
    screw.location = (.18, 0, 1.83)
    tool = hex_key(root)
    appear_after(tool, 4.8)
    def update(t):
        key.location.z = 1.50+1.10*(1-ease(t, .2, 1.35))
        hub.location.x = .18+2.5*(1-ease(t, 1.4, 3.0))
        retaining.location.x = 1.64+1.4*(1-ease(t, 3.1, 4.2))
        retaining.scale = (1.0+.14*(1-ease(t, 4.0, 4.3)),)*3
        descend(screw, t, 3.7, 4.9, 1.83, 1.65)
        tool.location = (.18, 0, 2.40 + 1.2*(1-ease(t, 4.8, 5.35)))
        tool.rotation_euler.z = -.5-max(0, t-5.35)*1.5
        screw.rotation_euler.z = tool.rotation_euler.z
    return root, update


def hydraulic_scene():
    root = group('05 / hydraulic torque wrench and reaction arm')
    assemble, nuts = flange(root, False)
    tool = group('Hydraulic torque wrench', root)
    target = nuts[7].location.copy()
    tool.location = (target.x, target.y, 1.51)
    drive = ring('Driven hex socket', .43, .316, .32, (0, 0, .02), iron, tool, inner_sides=6)
    cylinder('Drive head', .46, .27, (0, 0, .32), orange, tool)
    box('Hydraulic cylinder body', (.63, 1.28, .43), (0, - .83, .31), orange, tool, .11)
    box('Actuator top plate', (.47, .86, .035), (0, -.76, .55), iron, tool, .035)
    piston = cylinder('Hydraulic actuator', .18, .55, (0, -1.36, .32), iron, tool)
    piston.rotation_euler.x = math.pi/2
    # Rigid arm bears against the neighbouring nut, not an unsupported block.
    neighbour = nuts[0].location-target
    heading = math.atan2(neighbour.y, neighbour.x)
    length = neighbour.xy.length-.385
    arm = box('Reaction arm / adjacent nut contact', (length, .22, .18),
              (math.cos(heading)*length/2, math.sin(heading)*length/2, .0), iron, tool, .035)
    arm.rotation_euler.z = heading
    pad = box('Reaction contact pad', (.21, .40, .26),
              (math.cos(heading)*length, math.sin(heading)*length, 0), iron, tool, .025)
    pad.rotation_euler.z = heading
    appear_after(tool, .25)
    pump = box('Unbranded hydraulic pump', (.86, .76, .59), (2.2, 1.2, .31), blue, root, .1)
    box('Pump carrying handle', (.12, .65, .12), (2.2, 1.2, .74), iron, root, .035)
    cylinder('Pump gauge', .14, .06, (1.99, 1.04, .65), zinc, root)
    hoses = []
    for i in range(2):
        x = target.x + (-.17 if i == 0 else .17)
        y = target.y-1.39
        hoses.append(path('Hydraulic supply / return hose', [(x, y, 1.87), (x+.4, y-.28, 1.0),
             (2.9+i*.17, -.7, .14), (2.85+i*.12, .8, .16), (2.57, 1.0+i*.18, .52)], .048, rubber, root))
        fitting = cylinder('Hose quick connector', .071, .16, (x, y, 1.86), zinc, root)
        fitting.rotation_euler.x = math.pi/2
        hoses.append(fitting)
    def update(t):
        assemble(t)
        tool.location.z = 1.51+1.2*(1-ease(t, .25, 1.7))
        # The housing/reaction arm stays planted; only the drive advances.
        cycles = max(0, t-1.7)/1.4
        cycle, phase = math.floor(cycles), cycles % 1
        progress = ease(phase, .02, .54)
        drive.rotation_euler.z = -.22*(cycle+progress)
        nuts[7].rotation_euler.z = drive.rotation_euler.z
        piston.location.y = -1.36-.08*(progress-ease(phase, .56, .96))
        for hose in hoses:
            if hose.hide_render != (t < 1.7):
                hose.hide_render = t < 1.7
    return root, update


for maker in (intro, flange_scene, bowl_scene, shaft_scene, hydraulic_scene):
    groups.append(maker())

# Consistent cinematic metal lighting, without any third-party HDRI or texture.
box('Studio floor', (200, 200, .10), (0, 0, -.19), floor_mat, bevel=0)
for i in range(-8, 9):
    box('Datum grid', (.009, 16, .005), (i, 0, -.133), line_mat, bevel=0)
    box('Datum grid', (16, .009, .005), (0, i, -.133), line_mat, bevel=0)
ring('Studio perimeter', 3.9, 3.886, .003, (0, 0, -.126), line_mat)


def light(name, loc, power, color, size, target=(0, 0, 1)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = 'DISK'
    data.size = size
    data.use_shadow = name == 'Large white key'
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
cam.data.lens = 51
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
    starts = (0, 6.5, 14.5, 21.5, 28.5)
    chapter = max(i for i, t in enumerate(starts) if seconds >= t)
    local = seconds-starts[chapter]
    for index, (root, update) in enumerate(groups):
        for obj in (root, *root.children_recursive):
            hidden = index != chapter or bool(obj.get('hero_hidden')) or local < obj.get('hero_after', 0)
            if obj.hide_render != hidden:
                obj.hide_render = hidden
        if index == chapter:
            update(local)
    orbit = .08*math.sin(local*.45)
    distance = 8.8 if chapter == 0 else 9.4
    pullback = 1-ease(local, .2, 3.4)
    if chapter in (1, 2, 3):
        distance += 1.5*pullback
    if chapter == 4:
        distance = 10.2
    cam.location = (distance*.63*math.cos(orbit)-distance*.81*math.sin(orbit),
                    -distance*.81*math.cos(orbit)-distance*.63*math.sin(orbit), 6.8)
    target = Vector((0, 0, 1.30 if chapter == 0 else 1.20))
    if chapter in (1, 2):
        target.z += .60*pullback
    cam.rotation_euler = (target-cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()


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

if args.frames:
    for frame in args.frames:
        prepare(frame)
        scene.render.filepath = str(out/f'{frame:04d}.png')
        bpy.ops.render.render(write_still=True)
        print(f'HERO_FRAME {frame} / {COUNT}', flush=True)
else:
    scene.frame_start, scene.frame_end, scene.frame_step = args.start, args.end, args.step
    scene.render.filepath = str(out) + '/'
    bpy.app.handlers.frame_change_pre.append(lambda current_scene: prepare(current_scene.frame_current))
    bpy.app.handlers.render_post.append(lambda current_scene: print(f'HERO_FRAME {current_scene.frame_current} / {COUNT}', flush=True))
    bpy.ops.render.render(animation=True)
