"""Blender(bpy) 쪽: 메시 변환 · 마감별 재질 · 스튜디오 장면 · 렌더.

    Model      부품(메시 + 재질 키)의 묶음. 빌더가 만들고 render()가 그린다
    render()   Model → PNG (Cycles, 소프트박스 조명, 밝은 회색 스튜디오 바닥)

재질 키: 'body'(마감 룩을 따르는 주 재질), 'bright'(광택 가공면), 'dark', 'nylon', 'rubber', 'brass', 'copper', 'alu', 'steel'(무도금 강),
'blue' 'yellow' 'red' 'green' 'orange'(색 표시 도장·플라스틱) 등. 마감 룩(LOOKS)은 body에만 적용된다.
"""
import math
import sys

import bpy  # noqa: E402  (bmesh보다 먼저 가져와야 합니다)
import bmesh  # noqa: E402
import numpy as np
from mathutils import Matrix, Vector

# ── 마감(룩) 사양: base RGB(sRGB 근사), metallic, roughness, 그 밖의 특징 ───────────────────────
# 값은 시각 참고용입니다 (실제 색은 도금 두께·로트·조명에 따라 다릅니다).
LOOKS = {
    'ZW': dict(c=(0.80, 0.84, 0.88), m=1.0, r=0.26, name='백색아연'),                      # 3가 백색(청백색) 아연
    'ZY': dict(c=(0.86, 0.72, 0.30), m=1.0, r=0.30, name='황색아연'),                      # 황색(무지개) 크로메이트
    'ZB': dict(c=(0.035, 0.037, 0.045), m=0.85, r=0.30, name='흑색아연', coat=0.4),        # 흑색 아연
    'BO': dict(c=(0.028, 0.028, 0.030), m=0.55, r=0.46, name='흑착색', coat=0.15),         # 흑색 산화피막 + 방청유
    'PL': dict(c=(0.43, 0.44, 0.46), m=1.0, r=0.38, name='무처리(생지)', coat=0.25),        # 방청유 바른 생지
    'HD': dict(c=(0.56, 0.58, 0.58), m=1.0, r=0.52, name='용융아연', spangle=True),         # 용융아연도금: 꽃무늬·거친 질감
    'GM': dict(c=(0.26, 0.27, 0.29), m=0.9, r=0.42, name='아연 플레이크'),                  # 아연 플레이크: 짙은 은회색 반무광
    'ZN': dict(c=(0.55, 0.57, 0.60), m=1.0, r=0.34, name='아연-니켈'),                      # 아연-니켈: 아연보다 어두운 은색
    'NI': dict(c=(0.84, 0.81, 0.74), m=1.0, r=0.16, name='니켈'),                         # 니켈도금: 따뜻한 은색 광택
    'PT': dict(c=(0.03, 0.10, 0.28), m=0.0, r=0.30, name='PTFE 코팅', spec=0.5),          # 불소수지: 코팅사별 색 (예시: 청색)
    'PH': dict(c=(0.060, 0.064, 0.068), m=0.35, r=0.66, name='인산염'),                   # 인산염 피막 + 방청유: 어두운 무광
    'MZ': dict(c=(0.48, 0.50, 0.50), m=1.0, r=0.60, name='기계 아연'),                      # 기계적 아연도금: 거친 은회색
    'SS': dict(c=(0.76, 0.77, 0.78), m=1.0, r=0.30, name='스테인리스'),                    # 스테인리스
    'BR': dict(c=(0.80, 0.58, 0.22), m=1.0, r=0.26, name='황동'),
    'CU': dict(c=(0.86, 0.46, 0.32), m=1.0, r=0.22, name='구리'),
    'AL': dict(c=(0.80, 0.81, 0.82), m=1.0, r=0.40, name='알루미늄'),
    'NIA': dict(c=(0.60, 0.62, 0.64), m=1.0, r=0.36, name='니켈합금'),                    # 모넬·인코넬: 어두운 은색
}
# 룩과 상관없이 고정인 재질
FIXED = {
    'bright': dict(c=(0.80, 0.81, 0.83), m=1.0, r=0.16),                                    # 연삭·광택 가공면 (핀·키·축)
    'steel': dict(c=(0.42, 0.43, 0.45), m=1.0, r=0.36, coat=0.2),                           # 방청유 생지 강
    'dark': dict(c=(0.03, 0.03, 0.035), m=0.4, r=0.5),
    'rubber': dict(c=(0.015, 0.015, 0.016), m=0.0, r=0.62),
    'nylon': dict(c=(0.06, 0.20, 0.62), m=0.0, r=0.35, spec=0.45),                         # 나일론 링: 파랑
    'nylonw': dict(c=(0.80, 0.80, 0.76), m=0.0, r=0.4, spec=0.4),
    'brass': dict(c=(0.80, 0.58, 0.22), m=1.0, r=0.26),
    'copper': dict(c=(0.86, 0.46, 0.32), m=1.0, r=0.22),
    'alu': dict(c=(0.80, 0.81, 0.82), m=1.0, r=0.40),
    'ss': dict(c=(0.76, 0.77, 0.78), m=1.0, r=0.30),
    'blue': dict(c=(0.03, 0.15, 0.62), m=0.0, r=0.38, spec=0.5),
    'yellow': dict(c=(0.90, 0.68, 0.03), m=0.0, r=0.38, spec=0.5),
    'red': dict(c=(0.70, 0.03, 0.02), m=0.0, r=0.38, spec=0.5),
    'green': dict(c=(0.05, 0.40, 0.12), m=0.0, r=0.38, spec=0.5),
    'orange': dict(c=(0.95, 0.35, 0.03), m=0.0, r=0.38, spec=0.5),
    'white': dict(c=(0.85, 0.85, 0.83), m=0.0, r=0.45, spec=0.4),
    'black': dict(c=(0.02, 0.02, 0.022), m=0.0, r=0.5, spec=0.4),
}


def srgb2lin(c):
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c)


_MATS = {}
TEX = dict(bump=0.035, scale=8.0, rscale=1.0, rvar=0.035)   # 표면 요철: 범프 세기·크기, 거칠기 얼룩 크기·폭


def material(key, look=None):
    """재질 키(+룩) → Blender 재질 (캐시)"""
    spec = LOOKS.get(look or 'ZW') if key == 'body' else FIXED.get(key)
    if spec is None:
        spec = FIXED['steel']
    ck = (key, look if key == 'body' else None)
    if ck in _MATS:
        return _MATS[ck]
    mat = bpy.data.materials.new(f'{key}-{look or ""}')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    base = srgb2lin(spec['c'])
    bsdf.inputs['Base Color'].default_value = (*base, 1)
    bsdf.inputs['Metallic'].default_value = spec['m']
    bsdf.inputs['Roughness'].default_value = spec['r']
    if 'spec' in spec:
        bsdf.inputs['Specular IOR Level'].default_value = spec['spec']
    if spec.get('coat'):
        bsdf.inputs['Coat Weight'].default_value = spec['coat']
        bsdf.inputs['Coat Roughness'].default_value = 0.25
    # 미세한 표면 요철 (CG 같은 완벽한 매끈함을 없앰)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = TEX['scale'] if spec.get('m', 0) > 0.5 else TEX['scale'] / 2
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.7
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    bump = nt.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = TEX['bump']
    bump.inputs['Distance'].default_value = 0.05
    nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    # 거칠기도 살짝 흔든다
    rmix = nt.nodes.new('ShaderNodeMapRange')
    rmix.inputs['From Min'].default_value = 0.3
    rmix.inputs['From Max'].default_value = 0.7
    rmix.inputs['To Min'].default_value = max(spec['r'] - TEX['rvar'], 0.04)
    rmix.inputs['To Max'].default_value = min(spec['r'] + TEX['rvar'], 1.0)
    noise2 = nt.nodes.new('ShaderNodeTexNoise')
    noise2.inputs['Scale'].default_value = TEX['rscale']
    noise2.inputs['Detail'].default_value = 3.0
    nt.links.new(tc.outputs['Object'], noise2.inputs['Vector'])
    nt.links.new(noise2.outputs['Fac'], rmix.inputs['Value'])
    nt.links.new(rmix.outputs['Result'], bsdf.inputs['Roughness'])
    if spec.get('spangle'):                     # 용융아연: 꽃무늬(스팽글) 명암 얼룩
        vor = nt.nodes.new('ShaderNodeTexVoronoi')
        vor.inputs['Scale'].default_value = 0.22
        vor.feature = 'F1'
        nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*srgb2lin((0.47, 0.49, 0.50)), 1)
        ramp.color_ramp.elements[1].color = (*srgb2lin((0.64, 0.66, 0.66)), 1)
        nt.links.new(vor.outputs['Distance'], ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
        bump.inputs['Strength'].default_value = 0.10     # 꽃무늬는 색 얼룩 위주, 요철은 약하게 (세게 하면 망치 자국처럼 보임)
        noise.inputs['Scale'].default_value = 4.0
    _MATS[ck] = mat
    return mat


# ── 모델 ────────────────────────────────────────────────────────────────
class Model:
    """parts: [dict(mesh=Mesh, mat='body'|…, sharp=각도, bevel=폭, cut=[Mesh…])]"""

    def __init__(self, name='model'):
        self.name = name
        self.parts = []
        self.cam = {}

    def add(self, mesh, mat='body', sharp=32.0, bevel=0.0, cut=None, smooth=True):
        self.parts.append(dict(mesh=mesh, mat=mat, sharp=sharp, bevel=bevel, cut=cut or [], smooth=smooth))
        return self

    def extend(self, other):
        self.parts += other.parts
        return self

    def tf(self, fn):
        for p in self.parts:
            p['mesh'] = fn(p['mesh'])
            p['cut'] = [fn(c) for c in p['cut']]
        return self

    def move(self, x=0, y=0, z=0):
        return self.tf(lambda m: m.move(x, y, z))

    def rotx(self, d):
        return self.tf(lambda m: m.rotx(d))

    def roty(self, d):
        return self.tf(lambda m: m.roty(d))

    def rotz(self, d):
        return self.tf(lambda m: m.rotz(d))

    def lie(self, yaw=70.0, tilt=True, lim=12.0):
        """머리가 위(+Z), 몸통이 아래(−Z)인 부품을 눕힌다 (머리가 왼쪽, 끝이 오른쪽). yaw = 바닥 위 방위(도).
        기본 70° = 머리가 화면 왼쪽 앞, 끝이 오른쪽 뒤 (카메라 기본 방위 −38° 기준).
        tilt: 머리가 몸통보다 굵으면 머리 모서리만 바닥에 닿고 끝이 뜨므로, 머리 쪽과 끝 쪽의 최저점이 같아지게 몇 도(±lim) 기울인다"""
        self.roty(-90)
        if tilt:
            V = np.vstack([p['mesh'].V for p in self.parts])
            V = V[:: max(1, len(V) // 40000)]
            a, bb = V[V[:, 0] < 0], V[V[:, 0] > 0.85 * V[:, 0].max()]
            if len(a) and len(bb):
                def f(deg):
                    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
                    return (-s * a[:, 0] + c * a[:, 2]).min() - (-s * bb[:, 0] + c * bb[:, 2]).min()
                if f(-lim) < 0 < f(lim):
                    lo, hi = -lim, lim
                    for _ in range(40):
                        mid = (lo + hi) / 2
                        lo, hi = (mid, hi) if f(mid) < 0 else (lo, mid)
                    self.roty(hi)
        return self.rotz(yaw)

    def view(self, **cam):
        """카메라 힌트 (az 방위, el 고도, fill 화면 채움)"""
        self.cam = dict(getattr(self, 'cam', None) or {}, **cam)
        return self

    def copy(self):
        o = Model(self.name)
        o.cam = dict(getattr(self, 'cam', None) or {})
        o.parts = [dict(p, mesh=p['mesh'].copy(), cut=[c.copy() for c in p['cut']]) for p in self.parts]
        return o

    def bbox(self):
        lo = np.min([p['mesh'].V.min(0) for p in self.parts], 0)
        hi = np.max([p['mesh'].V.max(0) for p in self.parts], 0)
        return lo, hi


def _to_object(part, name, mat_obj, collection):
    m = part['mesh']
    me = bpy.data.meshes.new(name)
    faces = [tuple(int(i) for i in q) for q in m.Q] + [tuple(int(i) for i in t) for t in m.T]
    me.from_pydata([tuple(v) for v in m.V], [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if part['bevel'] > 0:
        edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(35)]
        if edges:
            bmesh.ops.bevel(bm, geom=edges, offset=part['bevel'], segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if part['sharp'] is not None:
        lim = math.radians(part['sharp'])
        for e in bm.edges:
            if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
                e.smooth = False
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = part['smooth']
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    ob.data.materials.append(mat_obj)
    if part['cut']:
        for k, c in enumerate(part['cut']):
            cm = bpy.data.meshes.new(f'{name}-cut{k}')
            cm.from_pydata([tuple(v) for v in c.V], [], [tuple(int(i) for i in q) for q in c.Q] + [tuple(int(i) for i in t) for t in c.T])
            cm.update()
            cb = bmesh.new(); cb.from_mesh(cm)
            bmesh.ops.remove_doubles(cb, verts=cb.verts, dist=1e-5)
            bmesh.ops.recalc_face_normals(cb, faces=cb.faces)
            cb.to_mesh(cm); cb.free()
            co = bpy.data.objects.new(f'{name}-cut{k}', cm)
            collection.objects.link(co)
            md = ob.modifiers.new(f'bool{k}', 'BOOLEAN')
            md.object = co
            md.operation = 'DIFFERENCE'
            md.solver = 'EXACT'
            md.use_self = True            # 커터가 스스로 겹쳐도 몸체가 사라지지 않게
            dg = bpy.context.evaluated_depsgraph_get()
            ev = ob.evaluated_get(dg)
            nm = bpy.data.meshes.new_from_object(ev)
            ob.modifiers.remove(md)
            old = ob.data
            ob.data = nm
            ob.data.materials.clear()
            ob.data.materials.append(mat_obj)
            bpy.data.objects.remove(co)
            bpy.data.meshes.remove(cm)
            bpy.data.meshes.remove(old)
            # 불리언 결과의 날카로운 모서리를 다시 표시
            bm = bmesh.new(); bm.from_mesh(ob.data)
            lim = math.radians(part['sharp'] if part['sharp'] is not None else 32)
            for e in bm.edges:
                e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > lim)
            bm.to_mesh(ob.data); bm.free()
            for p in ob.data.polygons:
                p.use_smooth = part['smooth']
    return ob


# ── 장면 ────────────────────────────────────────────────────────────────
_SETUP = {}


_KEEP = set()     # 마감만 바꿔 다시 그릴 때 재사용하는(불리언까지 끝낸) 메시 이름
_CONV = {}        # 모델 번호 → [(메시, 재질 키)]
THREADS = None    # 렌더 스레드 수 (None = 자동). 여러 프로세스를 동시에 돌리면 고정하는 편이 빠르다
_UID = [0]


def _reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.name not in _KEEP:
            bpy.data.meshes.remove(me)
    for l in list(bpy.data.lights):
        bpy.data.lights.remove(l)
    for c in list(bpy.data.cameras):
        bpy.data.cameras.remove(c)


def _setup_render(sc, w, h, samples):
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.05
    cy.adaptive_min_samples = 8
    cy.use_light_tree = False
    cy.max_bounces = 6
    cy.diffuse_bounces = 2
    cy.glossy_bounces = 5
    cy.transmission_bounces = 2
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_indirect = 8.0
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Filmic' if 'Filmic' in [x.identifier for x in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    try:
        sc.view_settings.look = 'None'
    except Exception:
        pass
    if THREADS:
        sc.render.threads_mode = 'FIXED'
        sc.render.threads = THREADS
    else:
        sc.render.threads_mode = 'AUTO'
    sc.render.use_persistent_data = False


def _world(sc, bg):
    w = bpy.data.worlds.get('studio') or bpy.data.worlds.new('studio')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bgn = nt.nodes.new('ShaderNodeBackground')
    # 위는 밝고 아래는 약간 어두운 그라데이션 (금속에 비치는 하늘)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    mp = nt.nodes.new('ShaderNodeMapRange')
    mp.inputs['From Min'].default_value = 0.0
    mp.inputs['From Max'].default_value = 1.0
    nt.links.new(sep.outputs['Z'], mp.inputs['Value'])
    nt.links.new(mp.outputs['Result'], ramp.inputs['Fac'])
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*srgb2lin(SKY['bot']), 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*srgb2lin(SKY['top']), 1)
    nt.links.new(ramp.outputs['Color'], bgn.inputs['Color'])
    bgn.inputs['Strength'].default_value = SKY['strength']
    nt.links.new(bgn.outputs['Background'], out.inputs['Surface'])


def _area(name, loc, target, size, power, color=(1, 1, 1), shape='RECTANGLE', sy=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.shape = shape
    ld.size = size
    if shape == 'RECTANGLE':
        ld.size_y = sy or size
    ld.energy = power
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


LUM = 0.02  # 조명 전체 배율 (바닥이 약 #eef0f2로 나오도록 보정)
SKY = dict(top=(0.80, 0.82, 0.85), bot=(0.10, 0.11, 0.12), strength=1.0)   # 월드(금속에 비치는 하늘)
RIG = dict(key=1800, fill=500, rim=900, top=700)                            # 조명 상대 세기


def render(model, path, look='ZW', size=(640, 480), samples=64, az=-38.0, el=24.0, fill=0.74, bg=(0.93, 0.94, 0.95), shadow=True, lens=105.0, yaw=0.0):
    """Model을 그려 path(PNG)에 저장. az/el = 카메라 방위·고도(도), fill = 화면 채움 비율"""
    sc = bpy.context.scene
    _reset_scene()
    _setup_render(sc, size[0], size[1], samples)
    _world(sc, bg)
    col = sc.collection
    if not hasattr(model, '_uid'):
        _UID[0] += 1
        model._uid = _UID[0]
    if model._uid not in _CONV:                 # 같은 모델을 다른 마감으로 다시 그릴 때는 변환(불리언·모따기)을 건너뛴다
        for me, _ in sum(_CONV.values(), []):
            _KEEP.discard(me.name)
            bpy.data.meshes.remove(me)
        _CONV.clear()
        conv = []
        for i, p in enumerate(model.parts):
            ob = _to_object(p, f'{model.name}-{i}', material(p['mat'], look), col)
            me = ob.data
            me.name = f'keep-{model._uid}-{i}'
            _KEEP.add(me.name)
            conv.append((me, p['mat']))
            bpy.data.objects.remove(ob, do_unlink=True)
        _CONV[model._uid] = conv
    objs = []
    for i, (me, mk) in enumerate(_CONV[model._uid]):
        ob = bpy.data.objects.new(f'{model.name}-{i}', me)
        col.objects.link(ob)
        me.materials.clear()
        me.materials.append(material(mk, look))
        objs.append(ob)
    # 위치: 바닥(z=0)에 올려놓고, 가로세로 중심은 원점
    lo, hi = model.bbox()
    ctr = (lo + hi) / 2
    dz = -lo[2]
    for ob in objs:
        ob.location = (-ctr[0], -ctr[1], dz)
    ext = hi - lo
    D = float(np.linalg.norm(ext))
    # 바닥
    gm = bpy.data.meshes.new('floor')
    S = D * 25
    gm.from_pydata([(-S, -S, 0), (S, -S, 0), (S, S, 0), (-S, S, 0)], [], [(0, 1, 2, 3)])
    go = bpy.data.objects.new('floor', gm)
    col.objects.link(go)
    gmat = bpy.data.materials.new('floor')
    gmat.use_nodes = True
    gb = gmat.node_tree.nodes['Principled BSDF']
    gb.inputs['Base Color'].default_value = (*srgb2lin(bg), 1)
    gb.inputs['Roughness'].default_value = 0.55
    gb.inputs['Specular IOR Level'].default_value = 0.35
    gm.materials.append(gmat)
    if not shadow:
        go.visible_shadow = False
    # 카메라: 대상 주변을 도는 위치, 투영 범위가 fill 비율이 되도록 거리를 조절
    cam_d = bpy.data.cameras.new('cam')
    cam_d.lens = lens
    cam_d.sensor_width = 36
    cam_d.clip_start = 1
    cam_d.clip_end = D * 200
    cam = bpy.data.objects.new('cam', cam_d)
    col.objects.link(cam)
    sc.camera = cam
    # 투영 맞추기에 쓸 꼭짓점 (이동 반영)
    pts = np.vstack([p['mesh'].V for p in model.parts]) - np.array([ctr[0], ctr[1], -dz])
    pts = pts[:: max(1, len(pts) // 20000)]
    tgt = np.array([0, 0, ext[2] / 2 * 0.9 + 0.0])
    tgt[2] = (hi[2] - lo[2]) / 2
    a, e = math.radians(az), math.radians(el)
    dirv = np.array([math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)])
    fwd = -dirv
    right = np.cross(fwd, [0, 0, 1]); right /= np.linalg.norm(right)
    upv = np.cross(right, fwd)
    aspect = size[0] / size[1]
    sw = 36.0
    sh = sw / aspect
    # 화면 중심은 투영 경계상자의 중심으로 (대상 중심이 아니라)
    def fit(dist):
        c = tgt + dirv * dist
        rel = pts - c
        zc = rel @ fwd
        x = (rel @ right) / zc * lens
        y = (rel @ upv) / zc * lens
        return x.min(), x.max(), y.min(), y.max()
    lo_d, hi_d = D * 0.5, D * 60
    for _ in range(40):
        mid = (lo_d + hi_d) / 2
        x0, x1, y0, y1 = fit(mid)
        wd, ht = x1 - x0, y1 - y0
        if wd / sw > fill or ht / sh > fill:
            lo_d = mid
        else:
            hi_d = mid
    dist = hi_d
    x0, x1, y0, y1 = fit(dist)
    # 투영 중심 보정: 카메라를 옆으로 이동
    cx_off = (x0 + x1) / 2 / lens * dist
    cy_off = (y0 + y1) / 2 / lens * dist
    cpos = tgt + dirv * dist + right * cx_off + upv * cy_off
    cam.location = Vector(cpos)
    cam.rotation_euler = Vector(fwd).to_track_quat('-Z', 'Y').to_euler()
    # 조명 (크기에 비례). 정면 위 왼쪽 키 + 오른쪽 필 + 뒤 림 + 위 커다란 소프트박스
    k = D
    P = lambda x: x * k * k * LUM    # 1 BU = 1 m 로 본 와트: 크기에 비례해 키운다
    az_k = math.radians(az + 55)
    _area('key', (k * 2.2 * math.cos(az_k), k * 2.2 * math.sin(az_k), k * 2.4), (0, 0, ext[2] / 2), k * 2.0, P(RIG['key']), sy=k * 1.4)
    az_f = math.radians(az - 80)
    _area('fill', (k * 2.6 * math.cos(az_f), k * 2.6 * math.sin(az_f), k * 1.0), (0, 0, ext[2] / 2), k * 2.5, P(RIG['fill']), sy=k * 1.2)
    az_r = math.radians(az + 180)
    _area('rim', (k * 2.4 * math.cos(az_r), k * 2.4 * math.sin(az_r), k * 1.8), (0, 0, ext[2] / 2), k * 1.6, P(RIG['rim']), sy=k * 0.8)
    _area('top', (0, 0, k * 3.2), (0, 0, 0), k * 3.5, P(RIG['top']), shape='SQUARE')
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    bpy.data.materials.remove(gmat)
    return path
