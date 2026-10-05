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
from geo import (Mesh, TAU, arc3, box, circle2d, cyl, extrude, grid, join, lathe, polybody, rect2d, sweep, theta, thread_rod, tube, wire)


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


def prism_xz(poly, y0, y1):
    """XZ 평면의 다각형 윤곽(x, z)을 y0..y1 로 압출 (닫힌 입체)"""
    out = extrude(np.asarray(poly, float), -0.5, 0.5, holes=())
    # extrude 는 윤곽(x,y)을 z 방향으로 압출 → 윤곽 y 를 높이로, 압출 방향을 −y 로 돌린다
    out = out.scale(1, 1, (y1 - y0)).move(0, 0, (y0 + y1) / 2)
    return out.rotx(90)


# ═════════════════════════════ 나사산 ═════════════════════════════
def _tri(t, wc, wr):
    """산 꼭대기 폭 wc · 골 폭 wr 인 삼각 단면 (1 = 산, 0 = 골), t 는 0..1 위상"""
    wf = (1 - wc - wr) / 2
    t = (t + wc / 2) % 1.0
    return np.where(t < wc, 1.0,
           np.where(t < wc + wf, 1 - (t - wc) / wf,
           np.where(t < wc + wf + wr, 0.0, (t - wc - wf - wr) / wf)))


def sharp_shank(d, Pt, z0, z1, rc=None, point='cone', lp=None, rt=0.18, N=72, spp=14, wc=0.05, wr=0.12, hand=1,
                lobe=0.0, drill=None, thread_from=None, ramp=0.0, flat_ch=0.6):
    """뾰족·굵은 산의 태핑형 나사 몸통 (z0 = 끝, z1 = 머리 쪽).
    point: 'cone' 원뿔 끝(C형) / 'flat' 평단(F형, 작은 모따기) / 'drill' 드릴 날 끝 / 'form' 성형 나사 진입부(원뿔, 3엽)
    lobe: 단면이 둥근 삼각형(3엽)이 되는 정도 · thread_from: 이 z보다 위는 민 몸통(나사산 없음, 반지름 R)"""
    R = d / 2
    rc = R * 0.70 if rc is None else rc
    nz = max(16, int(round((z1 - z0) / Pt * spp)) + 1)
    zs = np.linspace(z0, z1, nz)[None, :]
    th = theta(N)[:, None]
    t = ((zs - z0) / Pt - hand * th / TAU) % 1.0
    f = _tri(t, wc, wr)
    lob = 1.0 - lobe * (0.5 - 0.5 * np.cos(3 * th))
    amp = np.ones_like(zs)
    if thread_from is not None:                     # 위쪽은 나사산이 서서히 사라져 민 몸통이 된다
        amp = 1.0 - _ss((zs - thread_from) / max(ramp, 1e-6)) if ramp > 0 else (zs <= thread_from) * 1.0
    r_th = lob * (rc + (R - rc) * f * amp + (R - rc) * (1 - amp) * 0.0)
    if thread_from is not None:
        r_th = lob * np.where(amp < 1, rc + (R - rc) * (f * amp + (1 - amp)), rc + (R - rc) * f)
    if point in ('cone', 'form'):
        lp = lp or 2.6 * Pt
        env = np.minimum(1.0, (rt + (zs - z0) * (R - rt) / lp) / R)
        r = env * r_th
    elif point == 'flat':
        r = np.minimum(r_th, rc * 0.85 + (zs - z0) * 1.0 + 0.0)
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
        dome = [(R * math.sin(a), zb + f * (1 - math.sin(a) ** 2) ** 1.0 * 1.0) for a in np.linspace(0, math.pi / 2, 18)]
        # 포물선 대신 완만한 구면: z = zb + f * (1 - (r/R)^2)
        dome = [(R * s, zb + f * (1 - s * s)) for s in np.linspace(0, 1, 18)][::-1]
        prof = [(0, k)] + dome[::-1][1:] if False else [(0, k)] + [(R * s, zb + f * (1 - s * s)) for s in np.linspace(0.06, 1, 17)] + [(R, zc), (Rs, 0.0), (0, 0.0)]
    return lathe(prof, N), k


# ═════════════════════════════ 홈 커터 ═════════════════════════════
def cross_cut(size, z_top, depth=None, ang=0.0):
    """십자홈(+): P.cut_cross 에 각도 선택"""
    c = P.cut_cross(size, z_top=z_top, depth=depth)
    return c.rotz(ang) if ang else c


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


# 비슷한 작은나사 묶음 배치: (종류, 길이, x, y, yaw)
def _row(items, yaw=88.0):
    return [lay(machine_screw(**kw), yaw=yw, x=x, y=y) for kw, x, y, yw in items]


@family('ms-pan')
def ms_pan(fid):
    d = 5
    subs = [lay(machine_screw('pan', d, 25, name='a'), yaw=90, x=-15, y=-8),
            lay(machine_screw('pan', d, 16, name='b'), yaw=82, x=0, y=0),
            lay(machine_screw('pan', d, 10, name='c'), yaw=74, x=14, y=6)]
    return collect(fid, *subs).view(el=30, fill=0.8)


@family('ms-csk')
def ms_csk(fid):
    d = 5
    subs = [lay(machine_screw('csk', d, 25, name='a'), yaw=90, x=-15, y=-8),
            lay(machine_screw('csk', d, 16, name='b'), yaw=82, x=0, y=0),
            lay(machine_screw('csk', d, 10, name='c'), yaw=74, x=14, y=6)]
    return collect(fid, *subs).view(el=30, fill=0.8)


@family('ms-truss')
def ms_truss(fid):
    d = 5
    subs = [lay(machine_screw('truss', d, 25, name='a'), yaw=90, x=-15, y=-8),
            lay(machine_screw('truss', d, 16, name='b'), yaw=82, x=0, y=0),
            lay(machine_screw('truss', d, 10, name='c'), yaw=74, x=14, y=6)]
    return collect(fid, *subs).view(el=30, fill=0.8)


@family('ms-rcsk')
def ms_rcsk(fid):
    d = 5
    subs = [lay(machine_screw('rcsk', d, 25, name='a'), yaw=90, x=-15, y=-8),
            lay(machine_screw('rcsk', d, 16, name='b'), yaw=82, x=0, y=0),
            lay(machine_screw('rcsk', d, 10, name='c'), yaw=74, x=14, y=6)]
    return collect(fid, *subs).view(el=30, fill=0.8)


@family('ms-slot')
def ms_slot(fid):
    d = 5
    subs = [lay(machine_screw('cheese', d, 22, recess='slot', name='a'), yaw=90, x=-15, y=-8),
            lay(machine_screw('pan', d, 16, recess='slot', name='b'), yaw=82, x=0, y=0),
            lay(machine_screw('csk', d, 14, recess='slot', name='c'), yaw=74, x=15, y=6)]
    return collect(fid, *subs).view(el=30, fill=0.8)


@family('ms-inch')
def ms_inch(fid):
    d, Pt = 4.826, 25.4 / 24                       # #10-24 UNC
    a = machine_screw('pan', d, 19.05, Pt=Pt, name='a')
    b = machine_screw('pan', d, 19.05, recess='slot', Pt=Pt, name='b')
    nut = bl.Model('n')
    nut.add(P.hex_nut_mesh(d, 9.525, 3.175, P=Pt, rho=0.2), 'body', sharp=24)
    subs = [lay(a, yaw=88, x=-9, y=-6), lay(b, yaw=80, x=6, y=2), stand(nut, x=-8, y=22, yaw=15)]
    return collect(fid, *subs).view(el=32, fill=0.8)
