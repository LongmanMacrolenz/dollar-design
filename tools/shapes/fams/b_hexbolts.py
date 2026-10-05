"""육각·플랜지·사각머리 볼트와 그 세트, 아이볼트·호이스트 링.

담당 품목군: hbp flangebolt j429 a307 hhb f593 a354 f468 sqbolt hvset tcbolt a325 eyebolt ieyebolt hoistring

설계 메모
  · 부품은 축 +Z(머리 +Z, 끝 −Z, 머리 밑면 z=0)로 '항목(it)' 목록으로 만든 뒤, lay()로 눕히고 place()로 바닥에 늘어놓는다.
  · lay()는 머리(또는 고리)의 가장자리와 끝이 함께 바닥에 닿도록 몇 도 기울여 공중에 뜨지 않게 한다.
  · 세트 품목은 볼트 앞쪽(카메라 쪽)에 너트·와셔를 가로로 늘어놓는다 (서로 겹치지 않게).
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import *

IN = 25.4


# ── 항목(부품) 도우미 ────────────────────────────────────────────────────
def it(mesh, mat='body', **kw):
    return dict(mesh=mesh, mat=mat, kw=kw)


def tf(items, fn):
    for i in items:
        i['mesh'] = fn(i['mesh'])
        if i['kw'].get('cut'):
            i['kw']['cut'] = [fn(c) for c in i['kw']['cut']]
    return items


def mv(items, x=0.0, y=0.0, z=0.0):
    return tf(items, lambda m: m.move(x, y, z))


def bbox(items):
    return (np.min([i['mesh'].V.min(0) for i in items], 0), np.max([i['mesh'].V.max(0) for i in items], 0))


def ground(items):
    return mv(items, z=-bbox(items)[0][2])


def place(items, x, y):
    """바닥에 놓고 가로세로 중심을 (x, y)로"""
    lo, hi = bbox(items)
    return mv(items, x - (lo[0] + hi[0]) / 2, y - (lo[1] + hi[1]) / 2, -lo[2])


def lay(items, A=None, B=None, lim=12.0):
    """+Z 축 부품을 눕힌다 (머리 → −X, 끝 → +X). A·B = 바닥에 닿아야 할 두 무리(꼭짓점 선택 함수)이고,
    둘의 최저점이 같아지도록 Y축 둘레로 기울인다 (기본: A = 머리 쪽, B = 끝 쪽)"""
    tf(items, lambda m: m.roty(-90))
    V = np.vstack([i['mesh'].V for i in items])
    V = V[::max(1, len(V) // 40000)]
    xmax = V[:, 0].max()
    A = A or (lambda v: v[:, 0] < 0)
    B = B or (lambda v: v[:, 0] > 0.85 * xmax)
    a, b = V[A(V)], V[B(V)]

    def f(deg):
        c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        return (-s * a[:, 0] + c * a[:, 2]).min() - (-s * b[:, 0] + c * b[:, 2]).min()
    if f(-lim) < 0 < f(lim):
        lo, hi = -lim, lim
        for _ in range(40):
            mid = (lo + hi) / 2
            if f(mid) < 0:
                lo = mid
            else:
                hi = mid
        tf(items, lambda m: m.roty(hi))
    return ground(items)


def build(fid, items, yaw=0.0, **cam):
    m = bl.Model(fid)
    for i in items:
        m.add(i['mesh'], i['mat'], **i['kw'])
    m.rotz(yaw)
    return m.view(**cam)


def row(groups, cx, cy, gap=7.0):
    """바닥 부품 묶음을 X 방향으로 나란히 (중심 cx, cy)"""
    ws = [bbox(g)[1][0] - bbox(g)[0][0] for g in groups]
    x = cx - (sum(ws) + gap * (len(ws) - 1)) / 2
    out = []
    for g, w in zip(groups, ws):
        out += place(g, x + w / 2, cy)
        x += w + gap
    return out


# ── 공용 부품 ────────────────────────────────────────────────────────────
def hex_head(s, k, wf=True, dbl=False, marks=0, mark_w=0.7, mark_d=0.4):
    """육각 머리 항목 목록. 밑면 z=0, 윗면 z=k. wf=와셔면(밑 0.5 mm 원판), dbl=밑 모서리도 30° 모따기(와셔면 없는 거친 육각볼트)
    marks = 윗면 방사선 홈 개수 (3 = Grade 5, 6 = Grade 8)"""
    rc = s / 2 * 0.95
    body = polybody(6, s, 0.0, k, rc_top=rc, rc_bot=(rc * 0.97 if (wf or dbl) else None))
    cut = []
    if marks:
        r0, r1 = s * 0.10, rc * 1.0
        for j in range(marks):
            a = 30.0 + 360.0 * j / marks
            cut.append(box(r1 - r0, mark_w, mark_d + 1.2, cx=(r0 + r1) / 2, cz=k - mark_d + (mark_d + 1.2) / 2).rotz(a))
    out = [it(body, sharp=26, **(dict(cut=cut) if cut else {}))]
    if wf:
        out.append(it(cyl(rc, -0.5, 0.35, N=96), sharp=40))
    return out


def shaft(d, L, tl, Pt, tip=True):
    """볼트 몸통 (머리 밑면 z=0 → 끝 z=−L), 나사부 길이 tl. 나사 앞에 러너웃 원뿔이 있는 반나사 / tl>=L 이면 온나사"""
    R = d / 2
    if tl >= L - 1e-6:
        return [it(thread_rod(d, Pt, -L, 0.6, tip1=False, tip0=tip), sharp=40)]
    zs = -(L - tl)
    Rs = R * 0.985
    Rr = R - 0.6 * Pt
    dz = (Rs - Rr + 0.15) / math.tan(math.radians(30))
    shank = lathe([(0, 0.6), (Rs, 0.6), (Rs, zs), (Rr + 0.1, zs - dz), (0, zs - dz)], 72)
    return [it(shank, sharp=36), it(thread_rod(d, Pt, -L, zs + 1.2, tip1=False, tip0=tip), sharp=40)]


def hex_bolt_items(d, L, s, k, tl, Pt, **hk):
    return hex_head(s, k, **hk) + shaft(d, L, tl, Pt)


def nut_items(D, s, m, Pt):
    return [it(P.hex_nut_mesh(D, s, m, P=Pt), sharp=26)]


def washer_items(d1, d2, h):
    return [it(P.washer_mesh(d1, d2, h), sharp=40)]


def bolt_set(fid, bolt, loose, yaw, gap=7.0, shift=0.0, **cam):
    """눕힌 볼트 + 앞쪽(카메라 쪽, −y)에 가로로 늘어놓은 너트·와셔"""
    bolt = lay(bolt)
    lo, hi = bbox(bolt)
    ymax = max(bbox(g)[1][1] - bbox(g)[0][1] for g in loose)
    cx = (lo[0] + hi[0]) / 2 + shift
    items = bolt + row(loose, cx, lo[1] - gap - ymax / 2, gap)
    return build(fid, items, yaw, **cam)


# ── hbp: 반나사 육각볼트 (ISO 4014 / DIN 931) ────────────────────────────
@family('hbp')
def hex_bolt_partial(fid):
    d, L = 12, 60
    s, k = P.ISO_HEX[12]
    items = lay(hex_bolt_items(d, L, s, k, 2 * d + 6, P.pitch(d)))
    return build(fid, items, 75, fill=0.82)


# ── flangebolt: 육각 플랜지 볼트 (세레이션 좌면, DIN 6921) ───────────────
def tri_wave(th, n):
    ph = (th * n / TAU) % 1.0
    return np.abs(2 * ph - 1)          # 1 = 골(높음), 0 = 마루(바닥에 닿음)


def flange_head(s, k, dc, c, nser=40, sd=0.45):
    """육각 + 원판(플랜지). 밑면 z=0 (세레이션 마루), 윗면 z=k. dc=플랜지 지름, c=가장자리 두께"""
    ro = dc / 2
    N = nser * 8
    th = theta(N)
    w = tri_wave(th, nser)
    tn = math.tan(math.radians(12))
    rh = s / 2 * 0.88

    def zt(r):
        return c + (ro - r) * tn
    rows = [(0.0, zt(rh), 0), (rh, zt(rh), 0), (ro - 0.9, zt(ro - 0.9), 0), (ro - 0.3, c + 0.02, 0), (ro, c - 0.45, 0),
            (ro, 0.75, 0), (ro - 0.25, 0.0, sd), (ro - 4.5, 0.0, sd), (ro - 5.5, 0.5, 0), (5.6, 1.1, 0), (0.0, 1.1, 0)]
    Pg = np.stack([np.stack([r * np.cos(th), r * np.sin(th), z + a * w], -1) for r, z, a in rows], 1)
    flange = grid(Pg, wrap=True).weld()
    hexp = polybody(6, s, zt(rh) - 0.6, k, rc_top=s / 2 * 0.95)
    return [it(flange, sharp=38), it(hexp, sharp=26)]


@family('flangebolt')
def flange_bolt(fid):
    d, L = 10, 40
    Pt = P.pitch(d)
    head = flange_head(15, 9.6, 24.5, 2.3)
    items = lay(head + shaft(d, L, 2 * d + 6, Pt))
    return build(fid, items, 22, el=28)


# ── 인치 육각볼트 계열 ───────────────────────────────────────────────────
def inch_bolt(d_in, tpi, L_in, s_in, k_in, tl_in, **hk):
    d = d_in * IN
    return hex_bolt_items(d, L_in * IN, s_in * IN, k_in * IN, tl_in * IN, IN / tpi, **hk)


@family('j429')
def sae_cap_screw(fid):
    # 1/2"-13 x 2" 육각 캡스크루 두 개: Grade 5 (방사선 3줄), Grade 8 (6줄). 머리 윗면이 보이게 눕힘
    g5 = inch_bolt(0.5, 13, 2.0, 0.75, 0.3125, 1.25, wf=True, marks=3)
    g8 = inch_bolt(0.5, 13, 2.0, 0.75, 0.3125, 1.25, wf=True, marks=6)
    g5 = mv(g5, y=-15.5)
    g8 = mv(g8, y=15.5)
    items = lay(g5 + g8)
    return build(fid, items, 104, el=30)


@family('a307')
def a307_bolt(fid):
    # 1/2"-13 x 3" 일반 육각볼트: 와셔면 없이 머리 밑도 30° 모따기, 표시 없음
    items = lay(inch_bolt(0.5, 13, 3.0, 0.75, 0.34375, 1.25, wf=False, dbl=True))
    return build(fid, items, 78, fill=0.82)


@family('hhb')
def heavy_hex_bolt(fid):
    # 1"-8 x 4" 헤비 육각볼트: 맞변 1-5/8", 머리 높이 43/64"
    items = lay(inch_bolt(1.0, 8, 4.0, 1.625, 0.671875, 2.25, wf=True))
    return build(fid, items, 78, fill=0.82)


@family('f593', looks=['SS'])
def f593_set(fid):
    # 스테인리스 1/2"-13 x 2" 볼트 + F594 육각너트 (맞변 3/4", 높이 7/16")
    bolt = inch_bolt(0.5, 13, 2.0, 0.75, 0.3125, 1.25, wf=True)
    nut = nut_items(0.5 * IN, 0.75 * IN, 0.4375 * IN, IN / 13)
    return bolt_set(fid, bolt, [nut], 76, gap=14, shift=8, el=34)


@family('f468', looks=['NIA'])
def f468_set(fid):
    # 니켈합금 5/8"-11 x 2-1/2" 볼트 + F467 육각너트 (맞변 15/16", 높이 35/64")
    bolt = inch_bolt(0.625, 11, 2.5, 0.9375, 0.390625, 1.5, wf=True)
    nut = nut_items(0.625 * IN, 0.9375 * IN, 0.546875 * IN, IN / 11)
    return bolt_set(fid, bolt, [nut], 76, gap=14, shift=8, el=34)


@family('a354')
def a354_set(fid):
    # 3/4"-10 헤비 육각볼트 x 3-1/2" + 같은 굵기의 양끝 나사 스터드 (A354 BC·BD / A449)
    d = 0.75 * IN
    Pt = IN / 10
    bolt = lay(inch_bolt(0.75, 10, 3.5, 1.25, 0.46875, 2.0, wf=True))
    lo, hi = bbox(bolt)
    Ls = 3.0 * IN
    stud = tf([it(thread_rod(d, Pt, 0.0, Ls), sharp=40)], lambda m: m.roty(90))     # 축 +X
    stud = place(stud, (lo[0] + hi[0]) / 2 + 6, lo[1] - 8 - d / 2)
    return build(fid, bolt + stud, 76, el=28)


@family('a325')
def a325_set(fid):
    # 3/4"-10 x 3" 구조용 볼트(헤비 육각, 짧은 나사부) + A563 DH 헤비 육각너트 + F436 와셔 1장
    bolt = inch_bolt(0.75, 10, 3.0, 1.25, 0.46875, 1.25, wf=True)
    nut = nut_items(0.75 * IN, 1.25 * IN, 0.734375 * IN, IN / 10)
    wash = washer_items(0.8125 * IN, 1.469 * IN, 3.9)
    return bolt_set(fid, bolt, [nut, wash], 76, gap=14, shift=10, el=34)


# ── sqbolt: 사각머리 볼트 ────────────────────────────────────────────────
@family('sqbolt')
def square_bolt(fid):
    d, L = 12, 60
    s, k = 19.0, 8.0
    head = polybody(4, s, 0.0, k, rc_top=s / 2 * 0.99, rho=0.012 * s, ch_deg=24)
    items = [it(head, sharp=30)] + shaft(d, L, 2 * d + 6, P.pitch(d))
    return build(fid, lay(items), 72, el=28)


# ── hvset: 마찰접합용 고장력 볼트 세트 (M20 F10T: 볼트 + 너트 + 와셔 2장) ─────
@family('hvset')
def hv_set(fid):
    d, L = 20, 80
    Pt = 2.5
    bolt = hex_bolt_items(d, L, 32, 13, 33, Pt, wf=True)
    nut = nut_items(d, 32, 20, Pt)
    w1 = washer_items(21, 37, 4.0)
    w2 = washer_items(21, 37, 4.0)
    return bolt_set(fid, bolt, [nut, w1, w2], 76, gap=16, shift=14, el=36)


# ── tcbolt: 토크전단형(TC) 볼트 세트 (M20 S10T) ───────────────────────────
def tc_bolt_items(d=20, Lg=72.0, tl=42.0):
    """둥근 머리 + 몸통 + 나사부 + 브레이크넥 홈 + 스플라인 핀테일. 머리 밑면 z=0"""
    Pt = P.pitch(d)
    R = d / 2
    dk, k = 35.0, 13.0
    Rc = 30.0
    rs = dk / 2 - 1.5
    ks = k - (Rc - math.sqrt(Rc * Rc - rs * rs))
    prof = [(0, 0), (dk / 2 - 0.8, 0), (dk / 2, 0.8), (dk / 2, ks - 1.5)]
    for a in np.linspace(0, 90, 5)[1:]:
        prof.append((dk / 2 - 1.5 + 1.5 * math.cos(math.radians(a)), ks - 1.5 + 1.5 * math.sin(math.radians(a))))
    for r in np.linspace(rs, 0, 12)[1:]:
        prof.append((r, k - (Rc - math.sqrt(Rc * Rc - r * r))))
    head = lathe(prof, 128)
    zs = -(Lg - tl)                               # 몸통/나사 경계
    zt = -Lg                                     # 나사 끝
    Rs = R * 0.985
    Rr = R - 0.6 * Pt
    dz = (Rs - Rr + 0.15) / math.tan(math.radians(30))
    shank = lathe([(0, 0.6), (Rs, 0.6), (Rs, zs), (Rr + 0.1, zs - dz), (0, zs - dz)], 72)
    out = [it(head, sharp=36), it(shank, sharp=36), it(thread_rod(d, Pt, zt, zs + 1.2, tip1=True, tip0=False), sharp=40)]
    # 브레이크넥 홈 (지름 14.4) + 스플라인 핀테일 (바깥 지름 16, 12줄)
    rn, rp = 7.2, 8.0
    neck = lathe([(0, zt + 1.0), (rn, zt + 1.0), (rn, zt - 3.2), (0, zt - 3.2)], 48)
    za, zb = zt - 2.6, zt - 2.6 - 17.0
    sp = lathe([(0, za), (rp - 0.6, za), (rp, za - 0.6), (rp, zb + 1.2), (rp - 1.2, zb), (0, zb)], 144,
               rmod=lambda th, r, z: r - 0.9 * (1 - (np.clip(np.cos(12 * th) * 2.2, -1, 1) * 0.5 + 0.5)))
    out += [it(neck, sharp=36), it(sp, sharp=34)]
    return out


@family('tcbolt')
def tc_set(fid):
    bolt = tc_bolt_items()
    nut = nut_items(20, 34, 20, 2.5)
    wash = washer_items(21, 40, 4.5)
    return bolt_set(fid, bolt, [nut, wash], 70, gap=15, shift=2, el=34)


# ── 아이볼트 ─────────────────────────────────────────────────────────────
def ring_yz(zc, ri, a, b, n=120, m=28):
    """YZ 평면의 고리 (중심 높이 zc, 구멍 반지름 ri, 단면 타원: 반경 방향 반지름 a·두께(X) 방향 반지름 b). ro(φ)로 바깥 반지름을 바꿀 수 있다"""
    phi = np.linspace(0, TAU, n, endpoint=False)[:, None]
    psi = np.linspace(0, TAU, m, endpoint=False)[None, :]
    Rr = ri + a
    Pg = np.stack([b * np.sin(psi) + 0 * phi, (Rr + a * np.cos(psi)) * np.cos(phi), zc + (Rr + a * np.cos(psi)) * np.sin(phi)], -1)
    return grid(Pg, wrap=True, wrap_v=True)


@family('eyebolt')
def din580(fid):
    # DIN 580 M12: 눈 안지름 30, 바깥 54, 칼라 지름 30, 칼라 높이 10, 전체 높이 53, 나사 길이 20.5
    d = 12
    Pt = P.pitch(d)
    ri, a, b = 15.0, 6.0, 5.4
    zc = 53 - 27.0
    ring = ring_yz(zc, ri, a, b)
    collar = lathe([(0, 0), (13.8, 0), (15.0, 0.9), (15.0, 6.0), (13.0, 8.4), (9.0, 10.6), (0, 10.6)], 96)
    items = [it(ring, sharp=50), it(collar, sharp=34), it(thread_rod(d, Pt, -21.0, 0.8, tip1=False), sharp=40)]
    items = lay(items, A=lambda v: v[:, 0] < -14, B=lambda v: v[:, 0] >= -14)
    return build(fid, items, 62, el=34)


def forged_eye(shoulder, d=12.7, tpi=13, Ls=38.1):
    """단조 아이볼트 (ASME B18.15). 고리는 둥근 철사 모양. shoulder=True 어깨형(Type 2, 칼라 있음), False 일자형(Type 1, 칼라 없음)"""
    Pt = IN / tpi
    ri, w = 14.5, 5.8                                  # 구멍 반지름, 철사 반지름
    zc = 40.0 if shoulder else 38.0
    zt = zc - ri                                       # 구멍 아래 끝 (목이 여기까지 올라가 고리와 만난다)
    items = [it(ring_yz(zc, ri, w, w), sharp=50), it(thread_rod(d, Pt, -Ls, 1.0, tip1=False), sharp=40)]
    if shoulder:
        r_sh = 12.5
        body = lathe([(0, 0), (r_sh - 1, 0), (r_sh, 1.0), (r_sh, 4.0), (r_sh - 1.5, 5.5), (8.2, 15.0), (7.4, zt - 1.0), (0, zt - 1.0)], 96)
    else:
        body = lathe([(0, 0.0), (d / 2, 0.0), (d / 2 + 0.9, 5.0), (d / 2 + 2.6, 15.0), (d / 2 + 2.4, zt - 1.0), (0, zt - 1.0)], 96)
    items.append(it(body, sharp=34))
    return items


@family('ieyebolt')
def forged_eyebolts(fid):
    sh = forged_eye(True)
    pl = forged_eye(False)
    sh = mv(sh, y=-34)
    pl = mv(pl, y=34)
    items = lay(sh + pl, A=lambda v: v[:, 0] < -14, B=lambda v: v[:, 0] >= -14)
    return build(fid, items, 62, el=34)


# ── hoistring: 회전형 인양 고리 ──────────────────────────────────────────
@family('hoistring')
def hoist_ring(fid):
    d, Pt = 12, 1.75
    base = lathe([(0, 0), (18.0, 0), (19.0, 0.9), (19.0, 5.2), (16.5, 8.0), (0, 8.0)], 120)
    sleeve = cyl(14.5, 7.5, 21.0, N=96, ch1=1.0)
    bush = lathe([(0, 0.0), (11.2, 0.0), (11.2, 2.2), (0, 2.2)], 72)            # 볼트 머리 밑 부싱 링
    hx = hex_head(19, 8.0, wf=False)
    hx = mv(hx, z=21.0)
    bolt = shaft(d, 24.0, 24.0, Pt)                                              # 아래로 24 mm 나사
    bolt = mv(bolt, z=1.0)
    items = [it(base, 'body', sharp=36), it(sleeve, 'body', sharp=36)]
    items += mv([it(bush, 'steel', sharp=36)], z=21.0)
    items += [dict(i, mat='dark') for i in hx] + [dict(i, mat='steel') for i in bolt]
    for sgn in (-1, 1):                                                          # 고리 걸이 귀
        items.append(it(box(10, 9, 10, r=2.0, rb=1.5, cy=sgn * 18.0, cz=14.5), 'body', sharp=34))
    # 고리: 곧은 다리 + 반타원
    zl = 24.0
    path = [(0.0, -18.0, 13.5), (0.0, -18.0, zl)]
    ph = np.linspace(math.pi, 0.0, 41)[1:-1]
    path += [(0.0, 18.0 * math.cos(t), zl + 15.0 * math.sin(t)) for t in ph]
    path += [(0.0, 18.0, zl), (0.0, 18.0, 13.5)]
    path = np.array(path, float)
    # 곡선 위 점을 촘촘하게 다시 뽑는다 (곧은 구간도 조금씩 나눔)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    cum = np.r_[0, np.cumsum(seg)]
    u = np.linspace(0, cum[-1], 90)
    path = np.stack([np.interp(u, cum, path[:, i]) for i in range(3)], 1)
    items.append(it(wire(path, 4.6, n=18), 'body', sharp=50))
    items = lay(items, A=lambda v: v[:, 0] < -30, B=lambda v: v[:, 0] > -8)
    return build(fid, items, 70, el=32)
