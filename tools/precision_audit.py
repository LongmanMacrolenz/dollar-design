"""Optional Blender audit of the actual transformed tool/assembly meshes.

Run render_hero.py --audit before rendering. Thread kinematics have a separate
standard-library test. This catches tool interference; it is not a certification.
"""
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def audit_tools(groups,prepare,fps):
    cache={}
    def geometry(obj):
        key=(obj.name,tuple(round(v,8) for row in obj.matrix_world for v in row))
        if key not in cache:
            verts=[obj.matrix_world@v.co for v in obj.data.vertices]
            bounds=tuple((min(v[i] for v in verts),max(v[i] for v in verts)) for i in range(3))
            tree=BVHTree.FromPolygons(verts,[tuple(p.vertices) for p in obj.data.polygons],all_triangles=False)
            cache[key]=(bounds,tree,verts)
        return cache[key]
    def intersects(a,b):
        ab,at,_=geometry(a);bb,bt,_=geometry(b)
        if any(ab[i][1]<bb[i][0]-1e-8 or bb[i][1]<ab[i][0]-1e-8 for i in range(3)):
            return False
        return bool(at.overlap(bt))

    jobs=[(2,'Combination wrench',range(291,372,3)),
          (3,'Ratchet body and driven hex bit',range(450,528,3)),
          (4,'L-shaped hex key',range(678,691,2)),
          (5,'Hydraulic torque wrench',range(757,826,3))]
    for chapter,name,frames in jobs:
        root=groups[chapter][0]
        tool=next(o for o in root.children_recursive if o.type=='EMPTY' and o.name.startswith(name))
        meshes=[o for o in tool.children_recursive if o.type=='MESH']
        targets=[o for o in root.children_recursive if o.type=='MESH' and o not in meshes]
        checked=0
        for frame in frames:
            prepare(frame)
            for mesh in meshes:
                for target in targets:
                    if chapter==5 and mesh.name.startswith('Hose quick connector') and target.name.startswith('Hydraulic supply / return hose'):
                        # The rubber hose is intentionally crimped into its quick connector.
                        continue
                    if chapter==5 and mesh.name.startswith('Reaction contact pad') and target.parent.name.startswith('Heavy hex nut'):
                        # An intentional flat-face contact is checked below instead.
                        continue
                    if intersects(mesh,target):
                        raise RuntimeError(f'Tool interference at frame {frame}: {mesh.name} / {target.name}')
                    checked+=1
            if chapter==5:
                pad=next(m for m in meshes if m.name.startswith('Reaction contact pad'))
                # The front of the pad must reach the neighbouring nut's nearest face.
                # Its clocked flat and the pad are perpendicular to this direction.
                heading=pad.matrix_world.to_quaternion()@Vector((1,0,0))
                _,_,pv=geometry(pad)
                neighbour=min((o for o in root.children if o.type=='EMPTY' and o.name.startswith('Heavy hex nut') and o.location.z>1),
                              key=lambda o:(o.location-Vector((1.43,0,1.295))).length)
                nv=[v for m in neighbour.children_recursive if m.type=='MESH' for v in geometry(m)[2]]
                gap=min(v.dot(heading) for v in nv)-max(v.dot(heading) for v in pv)
                if abs(gap)>1e-6:
                    raise RuntimeError(f'Reaction pad does not meet the neighbouring flat: {gap}')
        print(f'HERO_AUDIT {name}: {len(frames)} poses / {checked} mesh pairs',flush=True)
