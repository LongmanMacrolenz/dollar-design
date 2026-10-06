"""작은나사·태핑나사·조립나사·손나사·특수 머리 볼트류 빌더.

ms-pan ms-csk ms-truss ms-slot ms-rcsk ms-inch / tap tap-hex tap-drill tap-form / sems thumb /
carriage tslotbolt tbolt cskbolt / jack fitbolt lag swingbolt / ubolt weldstud

공통 방식: 각 나사를 부품 축 +Z(머리 위)로 만든 하위 Model(`sub`)로 짓고, `lay()`로 바닥에 눕혀
(머리 가장자리와 끝이 함께 바닥에 닿도록 살짝 기울임) 한 장면에 모은다.
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import Mesh, TAU, box, circle2d, cyl, extrude, grid, lathe, sweep, theta, thread_rod, torus, wire


# ═════════════════════════════ 공통 도우미 ═════════════════════════════
def _ss(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def _rest_angle(sub, split=0.0):
    """roty(-90)으로 눕힌 하위 모델이 머리 쪽(꼭짓점 x<=-split)과 몸통 쪽 양쪽으로 바닥에 닿는 기울기(도)"""
    H, S = [], []
    for p in sub.parts:
        V = p['mesh'].V
        V = V[::max(1, len(V) // 6000)]
        H.append(V[V[:, 0] <= -split + 1e-6])
        S.append(V[V[:, 0] > -split + 1e-6])
    H, S = np.vstack(H), np.vstack(S)
    if not len(H) or not len(S):
        return 0.0

    def g(a):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        return (-s * H[:, 0] + c * H[:, 2]).min() - (-s * S[:, 0] + c * S[:, 2]).min()
    lo, hi = -30.0, 30.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if g(mid) > 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def lay(sub, yaw=88.0, x=0.0, y=0.0, split=0.0, rest=True):
    """축 +Z·머리 위로 지은 하위 모델을 바닥에 눕힌다: 머리 왼쪽(-X), yaw = 바닥 위 방위. (x, y)로 옮긴다."""
    sub.roty(-90)
    if rest:
        sub.roty(_rest_angle(sub, split))
    sub.rotz(yaw)
    lo, _ = sub.bbox()
    sub.move(x, y, -lo[2])
    return sub


def stand(sub, x=0.0, y=0.0, yaw=0.0):
    """세운다(자세 그대로, 바닥에 놓기만)"""
    sub.rotz(yaw)
    lo, _ = sub.bbox()
    sub.move(x, y, -lo[2])
    return sub


def collect(name, *subs):
    m = bl.Model(name)
    for s in subs:
        m.extend(s)
    return m


def prism_xz(poly, t0, t1):
    """XZ 평면의 다각형 윤곽(x, z)을 y 방향 t0..t1 두께로 압출 (닫힌 입체)"""
    return extrude(np.asarray(poly, float), t0, t1).rotx(90)


def prism_yz(poly, t0, t1):
    """YZ 평면의 다각형 윤곽(y, z)을 x 방향 t0..t1 두께로 압출"""
    m = extrude(np.asarray(poly, float), t0, t1)
    return Mesh(m.V[:, [2, 0, 1]], m.Q, m.T)


def chaikin(poly, it=2):
    """닫힌 다각형의 모서리를 깎아 둥글린다 (Chaikin)"""
    p = np.asarray(poly, float)
    for _ in range(it):
        q = np.roll(p, -1, 0)
        p = np.stack([0.75 * p + 0.25 * q, 0.25 * p + 0.75 * q], 1).reshape(-1, 2)
    return p


def at(r, c, az=-38.0):
    """화면 기준 위치 → 바닥 좌표 (x, y): r = 화면 오른쪽, c = 카메라 쪽(화면에서는 아래쪽)으로 mm"""
    a = math.radians(az)
    d = (math.cos(a), math.sin(a))                  # 물체에서 카메라 쪽 방향
    rt = (-d[1], d[0])                              # 화면 오른쪽 방향
    return r * rt[0] + c * d[0], r * rt[1] + c * d[1]


# ═════════════════════════════ 나사산 ═════════════════════════════
def _tri(t, wc, wr):
    """산 꼭대기 폭 wc · 골 폭 wr 인 삼각 단면 (1 = 산, 0 = 골), t 는 0..1 위상"""
    wf = (1 - wc - wr) / 2
    t = (t + wc / 2) % 1.0
    return np.where(t < wc, 1.0,
           np.where(t < wc + wf, 1 - (t - wc) / wf,
           np.where(t < wc + wf + wr, 0.0, (t - wc - wf - wr) / wf)))


def sharp_shank(d, Pt, z0, z1, rc=None, point='cone', lp=None, rt=0.18, N=72, spp=14, wc=0.05, wr=0.12, hand=1,
                lobe=0.0, drill=None):
    """뾰족·굵은 산의 태핑형 나사 몸통 (z0 = 끝, z1 = 머리 쪽).
    point: 'cone' 원뿔 끝(C형) / 'flat' 평단(F형, 작은 모따기) / 'drill' 드릴 날 끝 / None 모따기 없음
    lobe: 단면이 둥근 삼각형(3엽)이 되는 정도 (성형 나사). drill = (드릴 반지름, 드릴 길이, 전이 길이, 비틀림 rad/mm)"""
    R = d / 2
    rc = R * 0.70 if rc is None else rc
    nz = max(16, int(round((z1 - z0) / Pt * spp)) + 1)
    zs = np.linspace(z0, z1, nz)[None, :]
    th = theta(N)[:, None]
    t = ((zs - z0) / Pt - hand * th / TAU) % 1.0
    f = _tri(t, wc, wr)
    lob = 1.0 - lobe * (0.5 - 0.5 * np.cos(3 * th))
    r_th = lob * (rc + (R - rc) * f)
    if point == 'cone':
        lp = lp or 2.6 * Pt
        env = np.minimum(1.0, (rt + (zs - z0) * (R - rt) / lp) / R)
        r = env * r_th
    elif point == 'flat':
        r = np.minimum(r_th, rc * 0.8 + (zs - z0) * 1.0)
    elif point == 'drill':
        Rd, ld, lt, tw = drill
        u = th - tw * (zs - z0)
        w = _ss((np.cos(2 * u) + 0.25) / 0.85)
        tip = np.minimum(1.0, (0.10 + (zs - z0) * math.tan(math.radians(59))) / Rd)
        rdr = Rd * (0.52 + 0.48 * w) * tip
        b = _ss((zs - (z0 + ld)) / lt)
        rth = rc + (R - rc) * f * b
        r = (1 - b) * rdr + b * rth
    else:
        r = r_th
    r = np.concatenate([np.zeros((N, 1)), r, np.zeros((N, 1))], 1)
    zz = np.concatenate([[z0], zs[0], [z1]])
    P3 = np.stack([r * np.cos(th), r * np.sin(th), np.broadcast_to(zz[None, :], r.shape)], -1)
    return grid(P3, wrap=True).weld()


# ═════════════════════════════ 머리 ═════════════════════════════
def head_pan(dk, k, Rs, z0f=0.16, n=2.4, N=96):
    """냄비머리: 윗면이 완만하게 둥글고 모서리가 둥근 머리 (밑면 z=0, 윗면 z=k)"""
    R = dk / 2
    z0 = z0f * k
    ph = np.linspace(0, math.pi / 2, 24)
    top = [(R * math.sin(a) ** (2 / n), z0 + (k - z0) * math.cos(a) ** (2 / n)) for a in ph]
    top[0] = (0.0, k)
    zb = min(0.3, 0.7 * z0)
    prof = top + [(R, zb), (R - 0.22, 0.0), (Rs * 0.99, 0.0), (0.0, 0.0)]
    return lathe(prof, N)


def head_cheese(dk, k, Rs, N=96):
    R = dk / 2
    prof = [(0, k), (R - 0.4, k), (R - 0.12, k - 0.07), (R, k - 0.32), (R, 0.28), (R - 0.2, 0.0), (Rs * 0.99, 0.0), (0, 0.0)]
    return lathe(prof, N)


def head_csk(dk, d, f=0.0, N=96, ang=90.0):
    """접시머리(90°): 원뿔이 몸통(지름 d)에서 z=0 으로 시작. f>0 이면 위가 볼록한 둥근접시. (메시, 윗높이 k) 반환"""
    R = dk / 2
    Rs = d / 2 * 0.99
    zc = (R - Rs) / math.tan(math.radians(ang / 2))
    if f <= 0:
        k = zc + 0.34
        prof = [(0, k), (R - 0.22, k), (R - 0.04, k - 0.1), (R, zc + 0.1), (R, zc), (Rs, 0.0), (0, 0.0)]
    else:
        zb = zc + 0.1
        k = zb + f
        dome = [(R * s, zb + f * (1 - s * s)) for s in np.linspace(0, 1, 18)]    # 중심 → 가장자리
        prof = dome + [(R, zc), (Rs, 0.0), (0, 0.0)]
    return lathe(prof, N), k


# ═════════════════════════════ 홈 커터 ═════════════════════════════
def cross_cut(size, z_top, depth=None, ang=0.0, wr=0.19, taper=0.42, extra=1.0):
    """십자홈(+) 커터: 윤곽 하나로 이어진 12각 십자를 아래로 갈수록 오므려(taper) 판다.
    (P.cut_cross 는 날개 두 개가 서로 겹친 메시라 불리언이 비어 버려서 따로 만든다.) size = 날개 끝 사이 길이"""
    from geo import _tess
    depth = depth or size * 0.55
    L, w = size / 2, size * wr / 2
    o = np.array([(L, -w), (L, w), (w, w), (w, L), (-w, L), (-w, w), (-L, w), (-L, -w), (-w, -w), (-w, -L), (w, -L), (w, -w)])
    zs = [z_top + extra, z_top, z_top - depth]
    sc = [1.0, 1.0, taper]
    P3 = np.stack([np.c_[o * s_, np.full(len(o), z)] for z, s_ in zip(zs, sc)], 1)
    side = grid(P3, wrap=True)
    pts, tri = _tess(o)
    top = Mesh(np.c_[pts, np.full(len(pts), zs[0])], None, tri)
    bot = Mesh(np.c_[pts * taper, np.full(len(pts), zs[-1])], None, tri)
    m = (side + top + bot).weld(1e-7)
    return m.rotz(ang) if ang else m


def slot_cut(width, depth, length, z_top, ang=25.0):
    return P.cut_slot(width, depth, length, z_top=z_top).rotz(ang)


# ═════════════════════════════ 작은나사 ═════════════════════════════
def machine_screw(kind, d, L, recess='cross', Pt=None, name='ms', hex_nut=False):
    """kind: pan | csk | rcsk | truss | cheese · 길이 L: pan·truss·cheese 는 머리 밑부터, csk·rcsk 는 전장.
    recess: cross | slot (홈 폭·깊이는 머리에 맞춤). 반환: 하위 Model (축 +Z, 머리 위)"""
    Pt = Pt or P.pitch(d)
    s = bl.Model(name)
    Rs = d / 2
    if kind == 'pan':
        dk, k = (2.0 * d, 0.77 * d)
        head = head_pan(dk, k, Rs)
        ztop = k
    elif kind == 'truss':
        dk, k = (2.2 * d, 0.56 * d)
        head = head_pan(dk, k, Rs, z0f=0.17, n=2.15)
        ztop = k
    elif kind == 'cheese':
        dk, k = (1.7 * d, 0.66 * d)
        head = head_cheese(dk, k, Rs)
        ztop = k
    elif kind == 'csk':
        dk = 1.86 * d
        head, ztop = head_csk(dk, d)
    elif kind == 'rcsk':
        dk = 1.86 * d
        head, ztop = head_csk(dk, d, f=0.115 * dk)
    else:
        raise ValueError(kind)
    if recess == 'cross':
        size = {'pan': 0.56, 'truss': 0.50, 'cheese': 0.55, 'csk': 0.55, 'rcsk': 0.54}[kind] * dk
        cut = cross_cut(size, ztop, depth=min(0.62 * size, ztop * 0.8 + 0.4))
    else:
        width = max(0.22 * d, 0.9)
        depth = {'pan': 0.42, 'truss': 0.5, 'cheese': 0.42, 'csk': 0.4, 'rcsk': 0.4}[kind] * ztop + 0.3
        cut = slot_cut(width, depth, dk * 1.3, ztop)
    s.add(head, 'body', sharp=35, cut=[cut])
    Lt = L if kind in ('pan', 'truss', 'cheese') else L - ztop
    s.add(thread_rod(d, Pt, -Lt, 0.0, tip1=False), 'body', sharp=40)
    return s


# 머리 방향을 맞춘 작은나사 세 개: 화면에서 왼쪽 위(긴 것) → 오른쪽 아래(짧은 것)로 계단 배치
TRIO = [((-9, -15), 90), ((0, 0), 84), ((9, 15), 78)]


def trio(fid, makers, slots=TRIO, view=None):
    subs = []
    for mk, ((r, c), yw) in zip(makers, slots):
        x, y = at(r, c)
        subs.append(lay(mk, yaw=yw, x=x, y=y))
    return collect(fid, *subs).view(**(view or dict(el=30, fill=0.82)))


def _ms_trio(fid, kind, d=5, lens=(25, 16, 10), recess='cross'):
    return trio(fid, [machine_screw(kind, d, L, recess=recess, name=n) for L, n in zip(lens, 'abc')])


@family('ms-pan')
def ms_pan(fid):
    return _ms_trio(fid, 'pan')


@family('ms-csk')
def ms_csk(fid):
    return _ms_trio(fid, 'csk')


@family('ms-truss')
def ms_truss(fid):
    return _ms_trio(fid, 'truss')


@family('ms-rcsk')
def ms_rcsk(fid):
    return _ms_trio(fid, 'rcsk')


@family('ms-slot')
def ms_slot(fid):
    d = 5
    return trio(fid, [machine_screw('cheese', d, 22, recess='slot', name='a'),
                      machine_screw('pan', d, 16, recess='slot', name='b'),
                      machine_screw('csk', d, 14, recess='slot', name='c')])


@family('ms-inch')
def ms_inch(fid):
    d, Pt = 4.826, 25.4 / 24                       # #10-24 UNC, 3/4"
    a = machine_screw('pan', d, 19.05, Pt=Pt, name='a')
    b = machine_screw('pan', d, 19.05, recess='slot', Pt=Pt, name='b')
    nut = bl.Model('n')
    nut.add(P.hex_nut_mesh(d, 9.525, 3.175, P=Pt, rho=0.2), 'body', sharp=24)
    xa, ya = at(-8, -12)
    xb, yb = at(4, 6)
    xn, yn = at(22, 14)
    subs = [lay(a, yaw=88, x=xa, y=ya), lay(b, yaw=82, x=xb, y=yb), stand(nut, x=xn, y=yn, yaw=15)]
    return collect(fid, *subs).view(el=32, fill=0.82)


# ═════════════════════════════ 태핑나사 ═════════════════════════════
def tapping_screw(kind, d, L, Pt, head='pan', recess='cross', name='t', point='cone', drill=None, lobe=0.0, rc=None,
                  wc=0.05, wr=0.12, lp=None, rt=0.18):
    """kind 머리: pan | csk | rcsk | hex(와셔붙이) | hexplain. 길이 L: csk·rcsk 는 전장, 나머지는 머리 밑부터"""
    s = bl.Model(name)
    Rs = d / 2
    if head == 'pan':
        dk, k = 1.9 * d, 0.73 * d
        hd = head_pan(dk, k, Rs, z0f=0.16)
        ztop = k
        size = 0.55 * dk
        s.add(hd, 'body', sharp=35, cut=[cross_cut(size, ztop, depth=min(0.62 * size, ztop * 0.8 + 0.4))])
    elif head in ('csk', 'rcsk'):
        dk = 2.0 * d
        hd, ztop = head_csk(dk, d, f=(0.1 * dk if head == 'rcsk' else 0.0))
        size = 0.53 * dk
        s.add(hd, 'body', sharp=35, cut=[cross_cut(size, ztop, depth=min(0.62 * size, ztop * 0.8 + 0.4))])
    elif head == 'hex':
        sw, kk = {4.2: (7.0, 2.8), 4.8: (8.0, 3.1), 5.5: (8.0, 3.4), 6.3: (10.0, 4.0)}.get(d, (1.6 * d, 0.65 * d))
        dc, c = 1.55 * sw, max(0.9, 0.2 * d)
        fl = lathe([(0, 0), (dc / 2 - 0.25, 0), (dc / 2, 0.25), (dc / 2, c - 0.15), (dc / 2 - 0.2, c), (sw / 2 * 0.8, c + 0.45), (0, c + 0.45)], 128)
        s.add(fl, 'body', sharp=35)
        s.add(P.hex_head(sw, kk, z0=c + 0.2, washer_face=False), 'body', sharp=24)
        ztop = c + 0.2 + kk
    else:   # hexplain
        sw, kk = {4.2: (7.0, 2.8), 4.8: (8.0, 3.1), 5.5: (8.0, 3.4), 6.3: (10.0, 4.0)}.get(d, (1.6 * d, 0.65 * d))
        s.add(P.hex_head(sw, kk, z0=0.0, washer_face=False), 'body', sharp=24)
        ztop = kk
    Lt = L - ztop if head in ('csk', 'rcsk') else L
    s.add(sharp_shank(d, Pt, -Lt, 0.0, point=point, drill=drill, lobe=lobe, rc=rc, wc=wc, wr=wr, lp=lp, rt=rt), 'body', sharp=40)
    return s


@family('tap')
def tap(fid):
    d, Pt = 4.2, 1.4                                # ST4.2
    return trio(fid, [tapping_screw('', d, 22, Pt, head='pan', name='a'),
                      tapping_screw('', d, 19, Pt, head='csk', name='b'),
                      tapping_screw('', d, 16, Pt, head='rcsk', name='c')])


@family('tap-hex')
def tap_hex(fid):
    d, Pt = 5.5, 1.8                                # ST5.5
    a = tapping_screw('', d, 32, Pt, head='hex', name='a')
    b = tapping_screw('', d, 22, Pt, head='hexplain', name='b')
    return trio(fid, [a, b], slots=[((-6, -10), 84), ((6, 10), 76)])


@family('tap-drill')
def tap_drill(fid):
    d, Pt = 4.8, 1.6                                # ST4.8, 드릴 날 끝
    dr = (1.55, 5.2, 2.6, 0.55)
    a = tapping_screw('', d, 32, Pt, head='hex', point='drill', drill=dr, name='a')
    b = tapping_screw('', d, 25, Pt, head='pan', point='drill', drill=dr, name='b')
    return trio(fid, [a, b], slots=[((-6, -10), 70), ((6, 10), 80)])


@family('tap-form')
def tap_form(fid):
    d, Pt = 5.0, 0.8                                # M5 나사산 성형 (3엽)
    kw = dict(point='cone', lobe=0.17, rc=0.80 * d / 2, wc=0.14, wr=0.2, lp=3.2, rt=1.5)
    a = tapping_screw('', d, 20, Pt, head='pan', name='a', **kw)
    b = tapping_screw('', d, 14, Pt, head='pan', name='b', **kw)
    xa, ya = at(-6, -8)
    xb, yb = at(17, 10)
    # 하나는 눕혀 옆모습, 하나는 머리로 세워 끝(3엽 단면)이 위에서 보이게
    return collect(fid, lay(a, yaw=62, x=xa, y=ya), stand(b.rotx(180), x=xb, y=yb, yaw=20)).view(el=34, fill=0.82)


# ═════════════════════════════ 와셔 조립 나사 (셈스) ═════════════════════════════
def spring_washer(d1, d2, t, z_low, a0=10.0, a1=354.0, n=64):
    """분할형 스프링와셔 (한 바퀴 나선, 양 끝이 t 만큼 어긋남). z_low = 가장 낮은 면"""
    Rm, w = (d1 + d2) / 4, (d2 - d1) / 2
    a = np.radians(np.linspace(a0, a1, n))
    path = np.c_[Rm * np.cos(a), Rm * np.sin(a), z_low + t / 2 + t * (a - a[0]) / TAU]
    sec = [(-w / 2, -t / 2), (w / 2, -t / 2), (w / 2, t / 2), (-w / 2, t / 2)]
    return sweep(path, sec, closed=False, cap=True)


def sems_screw(L, washers, name='a', d=5):
    """팬머리 십자 조립 나사: 가는 목에 느슨하게 끼운 와셔 (washers: 'spring' 스프링와셔, 'flat' 평와셔)"""
    Pt = P.pitch(d)
    s = bl.Model(name)
    s.add(head_pan(10.0, 3.85, 2.1), 'body', sharp=35, cut=[cross_cut(5.6, 3.85, depth=3.0)])
    z = 0.0
    parts = []
    for w in washers:
        if w == 'spring':
            parts.append(spring_washer(5.2, 8.7, 1.2, z - 2.4 - 0.05))
            z -= 2.5
        else:
            zc = z - 0.2 - 0.5
            fw = P.washer_mesh(4.9, 10.0, 1.0, z0=zc - 0.5).move(0, 0, -zc).rotx(3.5).move(0, 0, zc)
            parts.append(fw)
            z -= 1.5
    neck = -z + 0.6
    s.add(cyl(2.1, -neck - 0.2, 0.2, N=48), 'body', sharp=40)                   # 와셔가 끼워지는 가는 목
    s.add(thread_rod(d, Pt, -L, -neck, tip1=False), 'body', sharp=40)
    for m_ in parts:
        s.add(m_, 'body', sharp=40)
    return s


@family('sems')
def sems(fid):
    a = sems_screw(16, ('spring', 'flat'), name='a')
    b = sems_screw(12, ('flat',), name='b')
    xa, ya = at(-6, -9)
    xb, yb = at(7, 10)
    subs = [lay(a, yaw=86, split=-5.0, x=xa, y=ya), lay(b, yaw=76, split=-2.0, x=xb, y=yb)]
    return collect(fid, *subs).view(el=32, fill=0.82)


# ═════════════════════════════ 손나사 ═════════════════════════════
def knurl_head(Rk, k, collar_r, collar_h, Rs, n=48, depth=0.5, N=192, slot=(1.6, 2.2)):
    z_k0, z_k1 = collar_h, k - 0.9

    def rmod(th, r, z):
        tooth = np.abs(((th * n / TAU) % 1.0) - 0.5) * 2.0
        gate = ((z >= z_k0 - 1e-6) & (z <= z_k1 + 1e-6)).astype(float)
        blend = _ss((r - 0.9 * Rk) / (0.1 * Rk)) * gate
        return r - depth * tooth * blend
    prof = [(0, k), (Rk - 0.9, k), (Rk, k - 0.9), (Rk, z_k0), (collar_r, z_k0), (collar_r, 0.25), (collar_r - 0.25, 0.0), (Rs, 0.0), (0, 0.0)]
    head = lathe(prof, N, rmod=rmod)
    return head, [P.cut_slot(slot[0], slot[1], 2 * Rk + 2, z_top=k).rotz(25)]


def knurled_screw(d=6, L=20, name='k'):
    s = bl.Model(name)
    head, cut = knurl_head(10.0, 8.0, 8.0, 1.8, d / 2)
    s.add(head, 'body', sharp=30, cut=cut)
    s.add(thread_rod(d, P.pitch(d), -L, 0.0, tip1=False), 'body', sharp=40)
    return s


def wing_screw(d=6, L=20, name='w'):
    s = bl.Model(name)
    hub = lathe([(0, 0), (7.6, 0), (8.0, 0.35), (8.0, 2.0), (6.3, 2.7), (5.2, 3.6), (5.2, 11.0), (4.2, 11.8), (0, 11.8)], 96)
    s.add(hub, 'body', sharp=35)
    half = [(0, 2.0), (6.0, 2.0), (8.0, 3.8), (14.5, 6.5), (19.5, 10.5), (20.8, 13.5), (20.0, 16.6), (17.8, 18.4), (14.8, 18.0),
            (11.0, 14.2), (7.6, 11.0), (4.0, 10.0), (0, 10.0)]
    poly = chaikin(half + [(-y, z) for y, z in half[1:-1][::-1]], 2)
    s.add(prism_yz(poly, -1.8, 1.8), 'body', sharp=30)
    s.add(thread_rod(d, P.pitch(d), -L, 0.2, tip1=False), 'body', sharp=40)
    return s


@family('thumb')
def thumb(fid):
    xa, ya = at(-18, -6)
    xb, yb = at(14, 8)
    subs = [lay(knurled_screw(name='k'), yaw=84, x=xa, y=ya), lay(wing_screw(name='w'), yaw=128, x=xb, y=yb)]
    return collect(fid, *subs).view(el=38, fill=0.82)


# ═════════════════════════════ 사각목·해머헤드 볼트 ═════════════════════════════
def dome_head(dk, k, zb=0.6, N=96, Rs=0.0):
    """구면 둥근 머리 (마차볼트): 밑면 z=0, 가장자리 높이 zb, 꼭대기 k"""
    R, h = dk / 2, k - zb
    Rsph = (R * R + h * h) / (2 * h)
    amax = math.asin(R / Rsph)
    pts = [(Rsph * math.sin(a), zb + Rsph * math.cos(a) - (Rsph - h)) for a in np.linspace(0, amax, 26)]
    pts[0] = (0.0, k)
    prof = pts + [(R, zb - 0.15), (R - 0.25, 0.0), (Rs, 0.0), (0, 0.0)]
    return lathe(prof, N)


def square_neck(sq, top, bot, r=0.5, rb=0.6):
    """사각 목: 변 sq, z=bot..top"""
    return box(sq, sq, top - bot, r=r, rb=rb, cz=(top + bot) / 2)


def plain_shank(d, z0, z1, N=64):
    return cyl(d / 2 * 0.99, z0, z1, N=N, cap=False)


@family('carriage')
def carriage(fid):
    d, L = 10, 50
    sq, nh = 10.0, 6.5
    s = bl.Model('a')
    s.add(dome_head(24.0, 6.4), 'body', sharp=35)
    s.add(square_neck(sq, 0.8, -nh), 'body', sharp=30)
    b = 2 * d + 6
    s.add(plain_shank(d, -(L - b) - 0.5, -nh + 0.3), 'body')
    s.add(thread_rod(d, P.pitch(d), -L, -(L - b)), 'body', sharp=40)
    x, y = at(0, 0)
    return collect(fid, lay(s, yaw=80, x=x, y=y)).view(el=28, fill=0.8)


@family('cskbolt')
def cskbolt(fid):
    d, L = 10, 45
    sq, nh = 10.0, 6.0
    s = bl.Model('a')
    head, k = head_csk(19.6, d)
    s.add(head, 'body', sharp=35)
    s.add(square_neck(sq, 2.7, -nh), 'body', sharp=30)
    b = 2 * d + 6
    s.add(plain_shank(d, -(L - b) - 0.5, -nh + 0.3), 'body')
    s.add(thread_rod(d, P.pitch(d), -L, -(L - b)), 'body', sharp=40)
    x, y = at(0, 0)
    return collect(fid, lay(s, yaw=80, x=x, y=y)).view(el=28, fill=0.8)


@family('tslotbolt')
def tslotbolt(fid):
    d, L = 12, 50
    k = 8.0
    s = bl.Model('a')
    w = 11.0                                        # 홈 안쪽 방(챔버)에 들어가는 머리: 폭 22 × 길이 26 × 높이 8
    poly = [(-w + 2.2, 0), (w - 2.2, 0), (w, 2.2), (w, k - 0.7), (w - 0.7, k), (-w + 0.7, k), (-w, k - 0.7), (-w, 2.2)]
    s.add(prism_xz(poly, -13.0, 13.0), 'body', sharp=30)
    s.add(thread_rod(d, P.pitch(d), -L, 0.3, tip1=False), 'body', sharp=40)
    x, y = at(0, 0)
    return collect(fid, lay(s, yaw=72, x=x, y=y)).view(el=28, fill=0.8)


@family('tbolt')
def tbolt(fid):
    d, L = 12, 50
    s = bl.Model('a')
    s.add(box(13.0, 36.0, 7.5, r=3.0, rb=1.2, cz=3.75), 'body', sharp=30)         # 해머헤드: 긴 막대
    s.add(square_neck(12.0, 0.8, -8.0, r=0.4, rb=0.5), 'body', sharp=30)           # 사각 목
    b = 2 * d + 6
    s.add(plain_shank(d, -(L - b) - 0.5, -7.7), 'body')
    s.add(thread_rod(d, P.pitch(d), -L, -(L - b)), 'body', sharp=40)
    x, y = at(0, 0)
    return collect(fid, lay(s, yaw=80, x=x, y=y)).view(el=28, fill=0.8)


# ═════════════════════════════ 잭볼트 · 리머볼트 · 래그 · 스윙볼트 ═════════════════════════════
@family('jack')
def jack(fid):
    d, Pt = 12, 1.75
    s_, k_ = P.ISO_HEX[12]
    # A: 끝이 평평(작은 모따기) + 잼너트
    a = bl.Model('a')
    a.add(P.hex_head(s_, k_), 'body', sharp=24)
    a.add(thread_rod(d, Pt, -75, 0.2, tip1=False, rootr=5.3), 'body', sharp=40)
    a.add(P.hex_nut_mesh(d, s_, 6.0, P=Pt), 'body', sharp=24)                 # 잼너트(얇은 너트)가 위치를 고정
    a.parts[-1]['mesh'] = a.parts[-1]['mesh'].move(0, 0, -38.0)
    # B: 끝이 원뿔
    b = bl.Model('b')
    b.add(P.hex_head(s_, k_), 'body', sharp=24)
    b.add(thread_rod(d, Pt, -48, 0.2, tip1=False, rootr=1.2, lead=47), 'body', sharp=40)
    xa, ya = at(-8, -13)
    xb, yb = at(2, 13)
    return collect(fid, lay(a, yaw=64, x=xa, y=ya), lay(b, yaw=58, x=xb, y=yb)).view(el=28, fill=0.84)


@family('fitbolt')
def fitbolt(fid):
    d, Pt = 12, 1.75
    ds = 13.0                                       # 연삭 몸통 지름 (나사 호칭보다 1 mm 큼)
    s = bl.Model('a')
    s.add(P.hex_head(19.0, 8.0), 'body', sharp=24)
    s.add(cyl(ds / 2, -42.0, 0.3, N=96, ch0=0.7, cap=True), 'bright', sharp=35)  # 정밀 연삭 몸통
    s.add(cyl(5.3, -46.0, -41.0, N=64), 'body', sharp=40)                         # 나사 쪽으로 가는 홈(릴리프)
    s.add(thread_rod(d, Pt, -61.0, -45.0, tip1=True), 'body', sharp=40)
    x, y = at(0, 0)
    return collect(fid, lay(s, yaw=82, x=x, y=y)).view(el=28, fill=0.8)


@family('lag')
def lag(fid):
    D, L = 12.7, 76.2                               # 1/2" x 3" (in당 6산)
    Pt = 25.4 / 6
    s = bl.Model('a')
    s.add(P.hex_head(19.05, 7.94, washer_face=False), 'body', sharp=24)
    s.add(plain_shank(D, -L / 2 - 0.5, 0.2, N=96), 'body')
    s.add(sharp_shank(D, Pt, -L, -L / 2, rc=0.68 * D / 2, point='cone', lp=9.0, rt=0.35, N=96, spp=16, wc=0.04, wr=0.08), 'body', sharp=40)
    x, y = at(0, 0)
    return collect(fid, lay(s, yaw=82, x=x, y=y)).view(el=28, fill=0.8)


def _eye_outline(R, zc, wn, n=40):
    """눈(원 R, 중심 높이 zc)이 목(폭 wn, z=0)으로 이어지는 평판 윤곽 (x, z)"""
    px, pz = wn / 2, 0.0
    dx, dz = px - 0.0, pz - zc
    dist = math.hypot(dx, dz)
    phi = math.atan2(dz, dx)
    al = math.acos(R / dist)
    ang_r = phi + al                                # 오른쪽 접점의 각도 (원 위)
    ang_r = phi + al if math.cos(phi + al) > math.cos(phi - al) else phi - al
    ang_l = math.pi - ang_r
    pts = [(-px, pz), (px, pz)]
    for a in np.linspace(ang_r, ang_l, n):
        pts.append((R * math.cos(a), zc + R * math.sin(a)))
    return np.array(pts)


@family('swingbolt')
def swingbolt(fid):
    d, L = 10, 62
    Pt = P.pitch(d)
    R, zc, t, hole = 11.5, 15.5, 8.0, 10.4
    s = bl.Model('a')
    out = _eye_outline(R, zc, 9.0)
    eye = extrude(out, -t / 2, t / 2, holes=[circle2d(hole / 2, 40, cx=0.0, cy=zc)]).rotx(90)
    s.add(eye, 'body', sharp=30)
    s.add(cyl(6.0, -0.6, 2.4, N=64, ch0=0.5, ch1=0.8), 'body', sharp=35)            # 목 어깨
    b = 2 * d + 6
    s.add(plain_shank(d, -(L - b) - 0.5, 1.0), 'body')
    s.add(thread_rod(d, Pt, -L, -(L - b)), 'body', sharp=40)
    # 힌지: 받침(밑판 + 귀 두 장) + 핀. 눈은 두 귀 사이에 들어가 핀으로 걸려 돈다.
    # 축(z)은 볼트 방향, x 는 바닥 쪽(눕히면 위), y 는 핀 방향
    gap, lt, Rl, hx = 0.8, 6.0, 8.5, 18.0                 # 귀 간격 여유, 귀 두께, 귀 둥근 끝 반지름, 구멍 중심에서 밑판 윗면까지
    ya, yb = t / 2 + gap, t / 2 + gap + lt                 # 귀가 차지하는 |y| 범위
    aa = np.radians(np.linspace(-90, 90, 24))
    lug = [(-hx, zc - Rl)] + [(Rl * math.cos(a), zc + Rl * math.sin(a)) for a in aa] + [(-hx, zc + Rl)]
    for sg in (1, -1):
        m = extrude(np.array(lug), ya, yb, holes=[circle2d(hole / 2, 40, cx=0.0, cy=zc)]).rotx(90)   # y = -w
        s.add(m if sg == -1 else m.scale(1, -1, 1), 'steel', sharp=30)
    s.add(box(5.0, 2 * yb + 8.0, 2 * Rl + 12.0, r=1.2, rb=0.6, cx=-hx - 2.5, cz=zc), 'steel', sharp=30)    # 밑판
    y0, y1 = -yb, yb + 2.6
    pin = cyl(hole / 2 - 0.2, y0, y1, N=64, ch1=0.5)
    ph = cyl(7.4, y0 - 3.0, y0 + 0.4, N=64, ch0=0.5)
    s.add((pin + ph).rotx(-90).move(0, 0, zc), 'bright', sharp=35)
    s.add(torus(hole / 2 + 0.55, 0.9, N=48, n=10, z=yb + 1.6).rotx(-90).move(0, 0, zc), 'steel', sharp=40)
    return collect(fid, lay(s, yaw=84, x=0, y=0, rest=False)).view(el=30, fill=0.8)


# ═════════════════════════════ U볼트 · 용접 볼트 ═════════════════════════════
@family('ubolt')
def ubolt(fid):
    d = 10
    Pt = P.pitch(d)
    Rc = 35.0                                        # 중심선 반지름: 관 바깥지름 60 + 봉 지름 10 → 간격 70
    zc, zt = 42.0, 30.0                              # 굽힘 중심 높이, 나사 끝 높이
    s_, m_ = P.ISO_NUT[d]
    s = bl.Model('a')
    a = np.radians(np.linspace(180, 0, 90))
    path = np.vstack([[[-Rc, 0, zt - 0.2], [-Rc, 0, zt + 4.0], [-Rc, 0, zc - 3.0]],
                      np.c_[Rc * np.cos(a), np.zeros_like(a), zc + Rc * np.sin(a)],
                      [[Rc, 0, zc - 3.0], [Rc, 0, zt + 4.0], [Rc, 0, zt - 0.2]]])
    s.add(wire(path, d / 2 * 0.96, n=20), 'body', sharp=40)
    for sx in (-1, 1):
        s.add(thread_rod(d, Pt, 0.5, zt, tip1=False).move(sx * Rc, 0, 0), 'body', sharp=40)
        s.add(P.hex_nut_mesh(d, s_, m_, P=Pt).move(sx * Rc, 0, 0), 'body', sharp=24)
    return stand(collect(fid, s), yaw=34).view(el=24, fill=0.82)


@family('weldstud')
def weldstud(fid):
    d, L = 8, 30
    Pt = P.pitch(d)
    R, k = 7.0, 3.6                                  # 용접 쪽 머리 지름 14, 두께 3.6

    def stud(L, name):
        s = bl.Model(name)
        prof = [(0, 0), (R - 0.3, 0), (R, 0.3), (R, k - 0.45), (R - 0.45, k), (3.8, k), (3.2, k + 0.5), (1.9, k + 2.1), (1.0, k + 2.6), (0, k + 2.7)]
        s.add(lathe(prof, 96), 'body', sharp=30)
        s.add(thread_rod(d, Pt, -L, 0.2, tip1=False), 'body', sharp=40)
        return s
    a = stud(30, 'a')
    b = stud(22, 'b')
    xa, ya = at(-12, -4)
    xb, yb = at(16, 10)
    a = lay(a, yaw=100, x=xa, y=ya)
    b = stand(b.rotx(180), x=xb, y=yb)               # 세움: 용접면(작은 돌기)이 아래, 나사가 위
    return collect(fid, a, b).view(el=28, fill=0.82)
