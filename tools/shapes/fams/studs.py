"""스터드볼트 · 전산봉 · 앵커 품목군 형상 (b7 … sleeve). 길이 mm, 축 +Z.

스터드 세트(양끝 너트 2개) / 탭엔드 / 감경 몸통 / 전산봉 / 기초·앵커볼트(L·J) / 웨지·세트·드롭인·슬리브 앵커.
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import *

# ── 치수표 ──────────────────────────────────────────────────────────────────
# 인치 헤비 육각너트 (ASME B18.2.2 / A194 2H): 호칭 → (지름, 피치, 맞변 s, 두께 m)
IN_HEAVY = {
    '1/2': (12.7, 25.4 / 13, 22.23, 12.30),
    '5/8': (15.875, 25.4 / 11, 26.99, 15.08),
    '3/4': (19.05, 2.54, 31.75, 18.65),
    '7/8': (22.225, 25.4 / 9, 36.51, 21.83),
    '1': (25.4, 25.4 / 8, 41.27, 25.0),
}
M20_HEAVY = (20, 2.5, 34.0, 20.0)       # A194M 2H 헤비 육각 (M20)


def _nut(m, D, Pt, s, mh, z0, rot=0.0):
    n = P.hex_nut_mesh(D, s, mh, P=Pt, z0=z0)
    m.add(n.rotz(rot) if rot else n, 'body', sharp=24)


def _washer(m, d1, d2, h, z0):
    m.add(P.washer_mesh(d1, d2, h, z0=z0), 'body', sharp=40)


def _rod(m, d, Pt, z0, z1, **kw):
    m.add(thread_rod(d, Pt, z0, z1, **kw), 'body', sharp=40)


def _drop(m, zf=0.0):
    """모델의 최저점을 z=zf에 맞춘다"""
    lo, _ = m.bbox()
    return m.move(z=zf - lo[2])


def _rest_tilt(m, yaw, big, small, max_deg=8.0):
    """누운 부품이 공중에 뜨지 않게: 굵은 쪽(너트·와셔·머리, 부품 번호 big)과 가는 몸통(small)이 함께 바닥에 닿도록
    봉 방향에 수직인 수평축으로 살짝(수 도) 기울인다. yaw = m.lie()에 준 방위"""
    A = np.vstack([m.parts[i]['mesh'].V for i in big])
    B = np.vstack([m.parts[i]['mesh'].V for i in small])
    a = math.radians(yaw)
    n = np.array([-math.sin(a), math.cos(a), 0.0])
    K = np.array([[0, -n[2], n[1]], [n[2], 0, -n[0]], [-n[1], n[0], 0]])

    def rot(th):
        return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * (K @ K)
    ths = np.radians(np.linspace(-max_deg, max_deg, 641))
    th = min(ths, key=lambda t: abs((A @ rot(t).T)[:, 2].min() - (B @ rot(t).T)[:, 2].min()))
    R3 = rot(th)
    return m.tf(lambda mesh: mesh.tf(R3))


def _slots(ro, z_bot, z_top, w=1.5, n=2):
    """슬리브 아래쪽 쪼갬(슬릿) 커터: 지름 방향으로 긴 상자 n개를 돌려 가며"""
    h = z_top - z_bot + 1.0
    out = []
    for k in range(n):
        out.append(box(2 * ro + 4, w, h, cz=(z_bot - 1.0 + z_top) / 2).rotz(180.0 * k / n))
    return out


def _c_ring(ro, ri, z0, z1, gap_deg=16.0, n=48):
    """한 곳이 터진 C자 고리 (웨지 앵커의 쐐기 클립)"""
    a = np.linspace(math.radians(gap_deg / 2), math.radians(360 - gap_deg / 2), n)
    outline = np.vstack([np.c_[ro * np.cos(a), ro * np.sin(a)], np.c_[ri * np.cos(a[::-1]), ri * np.sin(a[::-1])]])
    return extrude(outline, z0, z1)


# ══ 1. 스터드볼트 + 너트 2개 세트 ════════════════════════════════════════════
# fid: (호칭, 길이/지름, 너트 돌림각)
_SETS = {
    'b7': ('3/4', 6.5, (0, 21)),
    'b7m': ('3/4', 7.0, (8, 33)),
    'b8': ('5/8', 7.0, (14, 2)),
    'l7': ('7/8', 6.0, (26, 5)),
    'mstud': ('M20', 7.0, (0, 17)),
    'b16': ('3/4', 7.0, (19, 38)),
    'b8lt': ('5/8', 8.0, (3, 27)),
    'smo': ('3/4', 6.5, (11, 40)),
    'a453': ('3/4', 7.0, (30, 9)),
    'b6': ('3/4', 6.5, (22, 47)),
}


@family(*_SETS, looks={'b8': ['SS', 'PT'], 'b8lt': ['SS', 'PT'], 'smo': ['SS'], 'a453': ['SS'], 'b6': ['SS']})
def stud_two_nuts(fid):
    """전산 스터드(끝 모따기) + 헤비 육각너트 2개. 양 끝에 나사가 2~3산 돌출하고 가운데는 나사가 그대로 보인다"""
    size, ld, rots = _SETS[fid]
    d, Pt, s, mh = M20_HEAVY if size == 'M20' else IN_HEAVY[size]
    L = ld * d
    ext = 2.6 * Pt
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, L)
    _nut(m, d, Pt, s, mh, ext, rots[0])
    _nut(m, d, Pt, s, mh, L - ext - mh, rots[1])
    return m.lie(70)


@family('tstud', looks=['PL', 'PT'])
def tension_stud(fid):
    """유압 텐셔닝 스터드: 너트 위로 공구가 물릴 여유 나사가 양 끝에 길게 (한쪽이 더 길다)"""
    d, Pt, s, mh = IN_HEAVY['1']
    e0, e1 = 1.55 * d, 1.0 * d
    L = 8.0 * d
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, L, N=72)
    _nut(m, d, Pt, s, mh, e0, 12)
    _nut(m, d, Pt, s, mh, L - e1 - mh, 37)
    return m.lie(70)


@family('stud-rs')
def reduced_shank_stud(fid):
    """감경 몸통 스터드 (DIN 2510): 양 끝 나사 + 가운데는 골지름보다 가는 몸통(완만한 목) + 너트 2개"""
    d, Pt = 20, 2.5
    s, mh = P.ISO_NUT[20]
    L = 9.0 * d
    tl = 2.1 * d                           # 끝 나사 길이
    R = d / 2
    r_root = R - 0.6 * Pt
    r_sh = 0.9 * (R - 0.6 * Pt)            # 감경 몸통 반지름 (골지름의 약 0.9배 → 호칭 지름보다 확실히 가늘다)
    neck = 0.7 * d
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, tl, tip1=False)
    _rod(m, d, Pt, L - tl, L, tip0=False)
    # 몸통: 나사 끝에서 완만하게 가늘어지는 목
    prof = [(0, tl - 1.0), (r_root, tl - 1.0), (r_root, tl), (r_sh, tl + neck), (r_sh, L - tl - neck), (r_root, L - tl), (r_root, L - tl + 1.0), (0, L - tl + 1.0)]
    m.add(lathe(prof, 96), 'body', sharp=40)
    ext = 2.4 * Pt
    _nut(m, d, Pt, s, mh, ext, 6)
    _nut(m, d, Pt, s, mh, L - ext - mh, 24)
    return m.lie(70)


# ── 탭엔드 스터드 ────────────────────────────────────────────────────────────
def _te_stud(fid, d, Pt, b1, shank, b):
    """박힘쪽 b1(짧음) + 나사 없는 몸통 + 너트쪽 b(김). z=0이 박힘쪽 끝"""
    R = d / 2
    r_sh = (d - 0.65 * Pt) / 2             # 나사 없는 몸통 ≈ 유효지름
    L = b1 + shank + b
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, b1)
    _rod(m, d, Pt, L - b, L)
    m.add(cyl(r_sh, b1 - 1.2, L - b + 1.2, N=96), 'body', sharp=40)
    return m


@family('stud-te')
def tap_end_stud(fid):
    """탭엔드 스터드 DIN 939 (박힘쪽 1.25d, 너트쪽 2d+6). M12"""
    d = 12
    m = _te_stud(fid, d, 1.75, b1=1.25 * d, shank=36, b=2 * d + 6)
    return m.lie(70)


@family('istud-te')
def inch_tap_end_stud(fid):
    """인치 탭엔드 스터드 (3/4"-10: 박힘쪽 1.5d·너트쪽 3d)"""
    d, Pt = 19.05, 2.54
    m = _te_stud(fid, d, Pt, b1=1.5 * d, shank=1.7 * d, b=3.0 * d)
    return m.lie(70)


@family('ats')
def all_thread_and_double_end(fid):
    """전산 스터드(앞)와 양끝 나사 스터드(뒤: 가운데 나사 없는 몸통)를 나란히"""
    d, Pt = 15.875, 25.4 / 11               # 5/8"-11
    L = 7.0 * d
    R = d / 2
    r_sh = (d - 0.65 * Pt) / 2
    te = 2.1 * d
    m = bl.Model(fid)
    # 앞: 전산
    _rod(m, d, Pt, 0.0, L)
    # 뒤: 양끝 나사
    back = bl.Model(fid)
    _rod(back, d, Pt, 0.0, te)
    _rod(back, d, Pt, L - te, L)
    back.add(cyl(r_sh, te - 1.2, L - te + 1.2, N=96), 'body', sharp=40)
    back.move(x=0.0, y=2.35 * d, z=0.55 * d)
    m.extend(back)
    m.move(y=-1.1 * d)
    return m.lie(70).view(el=30)


# ══ 2. 전산봉 ═════════════════════════════════════════════════════════════════
@family('tr')
def threaded_rod_1m(fid):
    """전산볼트 DIN 976-1 Form A: 잘린 끝(작은 모따기). M12, 짧게 잘라 보여 줌"""
    d, Pt = 12, 1.75
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, 5.6 * d, rootr=d / 2 - 0.22 * Pt)
    return m.lie(66).view(el=28)


@family('stud-ft')
def threaded_stud_chamfered(fid):
    """미터 전산 스터드 DIN 976-1 Form B: 양끝을 나사 골까지 크게 모따기"""
    d, Pt = 12, 1.75
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, 6.2 * d, rootr=d / 2 - 1.15 * Pt)
    return m.lie(52).view(el=28)


@family('rod-in')
def inch_threaded_rod(fid):
    """인치 전산볼트 1/2"-13 + 헤비 육각너트 하나 (끝은 잘린 모양)"""
    d, Pt, s, mh = IN_HEAVY['1/2']
    L = 6.8 * d
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, L, rootr=d / 2 - 0.25 * Pt)
    _nut(m, d, Pt, s, mh, L - 3.0 * Pt - mh, 14)
    m.lie(70)
    return _rest_tilt(m, 70, [1], [0])


@family('rod-hanger')
def hanger_rod(fid):
    """행거용 3/8"(3부) 전산봉 + 평와셔 + 육각너트 (한쪽 끝)"""
    d, Pt = 9.525, 25.4 / 16
    s, mh = 14.29, 8.33
    w1, w2, wt = 10.3, 22.0, 1.6
    L = 7.6 * d
    ext = 3.2 * Pt
    m = bl.Model(fid)
    _rod(m, d, Pt, 0.0, L, rootr=d / 2 - 0.25 * Pt)
    _nut(m, d, Pt, s, mh, L - ext - mh, 18)
    _washer(m, w1, w2, wt, L - ext - mh - wt - 0.05)
    m.lie(70)
    return _rest_tilt(m, 70, [1, 2], [0]).view(el=28)


# ══ 3. KS·JIS 관 플랜지용 볼트 · 너트 · 와셔 세트 ═════════════════════════════
@family('ksflset')
def ks_flange_set(fid):
    d, Pt, L, tl = 16, 2.0, 65.0, 38.0
    s, k = P.ISO_HEX[16]
    ns, nm = P.ISO_NUT[16]
    w1, w2, wt = P.ISO_WASH[16]
    bolt = bl.Model(fid)
    bolt.add(P.hex_head(s, k), 'body', sharp=24)
    bolt.add(cyl(d / 2 * 0.99, -(L - tl) - 1.0, 0.3, N=64), 'body', sharp=40)
    bolt.add(thread_rod(d, Pt, -L, -(L - tl), tip1=False), 'body', sharp=40)
    bolt.lie(70)
    _rest_tilt(bolt, 70, [0], [1, 2])
    lo = bolt.bbox()[0][2]
    az = math.radians(-38.0)
    tc = np.array([math.cos(az), math.sin(az)])             # 카메라 쪽
    rt = np.array([math.sin(-az), math.cos(-az)])            # 화면 오른쪽 (0.62, 0.79)
    # 와셔와 너트는 볼트 앞쪽 오른쪽 바닥에
    pw = 16 * rt + 48 * tc
    pn = 62 * rt + 34 * tc
    nut = P.hex_nut_mesh(d, ns, nm, P=Pt).rotz(10).move(pn[0], pn[1], lo)
    wsh = P.washer_mesh(w1, w2, wt).move(pw[0], pw[1], lo)
    bolt.add(nut, 'body', sharp=24)
    bolt.add(wsh, 'body', sharp=40)
    return bolt.view(el=30)


# ══ 4. 기초·앵커 볼트 (굽은 봉) ═══════════════════════════════════════════════
def _bend_path(z0, Ls, rb, leg, kind, n_line=8, n_arc=30, n_leg=8):
    """봉 축 중심선: z0 → Ls 직선, 이어서 반지름 rb로 굽어 leg 만큼. L = 90°, J = 180° (되돌아 내려옴). 굽는 쪽은 +x"""
    pts = [(0.0, 0.0, z) for z in np.linspace(z0, Ls, n_line)]
    if kind == 'L':
        for p in np.radians(np.linspace(180, 90, n_arc))[1:]:
            pts.append((rb + rb * math.cos(p), 0.0, Ls + rb * math.sin(p)))
        for t in np.linspace(0, leg, n_leg)[1:]:
            pts.append((rb + t, 0.0, Ls + rb))
    else:
        for p in np.radians(np.linspace(180, 0, 2 * n_arc))[1:]:
            pts.append((rb + rb * math.cos(p), 0.0, Ls + rb * math.sin(p)))
        for t in np.linspace(0, leg, n_leg)[1:]:
            pts.append((2 * rb, 0.0, Ls - t))
    return np.array(pts, float)


def _bent_bolt(m, d, Pt, Lt, Ls, rb, leg, kind, nut, washer, nut_rot=0.0, rootr=None, paint=None):
    """나사 끝(z=0) · 나사부 Lt · 매끈한 몸통 · 굽힘. nut=(s, m), washer=(d1, d2, t) — 너트가 바깥, 와셔가 굽은 쪽"""
    R = d / 2
    ext = 2.6 * Pt
    i0 = len(m.parts)
    _rod(m, d, Pt, 0.0, Lt, tip1=False, rootr=rootr)
    m.add(wire(_bend_path(Lt - 1.0, Ls, rb, leg, kind), R * 0.985, n=40), 'body', sharp=40)
    s, mh = nut
    _nut(m, d, Pt, s, mh, ext, nut_rot)
    if washer:
        _washer(m, *washer, ext + mh + 0.05)
    m.bolt_idx = dict(small=[i0, i0 + 1], big=[i0 + 2, i0 + 3] if washer else [i0 + 2])
    if paint:
        rt = (rootr if rootr is not None else (R - 0.6 * Pt) - 0.12 * Pt)
        k = 0.5 * Pt
        prof = [(0, 0.12), (rt + 0.12, 0.12), (rt + k + 0.12, -k + 0.12), (0, -k + 0.12)]
        m.add(lathe(prof, 64), paint, sharp=60)
    return m


@family('f1554')
def anchor_bolt_f1554(fid):
    """F1554 L형 앵커볼트 3/4"-10 + 헤비 육각너트 + 평와셔. 돌출 끝면은 Grade 36(파랑) 도장"""
    d, Pt, s, mh = IN_HEAVY['3/4']
    m = bl.Model(fid)
    _bent_bolt(m, d, Pt, Lt=4.6 * d, Ls=8.4 * d, rb=2.0 * d, leg=2.8 * d, kind='L', nut=(s, mh), washer=(20.6, 38.0, 4.5), nut_rot=12, paint='blue')
    bi = m.bolt_idx
    m.lie(15)
    return _rest_tilt(m, 15, bi['big'], bi['small']).view(el=26)


@family('fbolt')
def foundation_bolt(fid):
    """기초볼트(KS B 1016): L형과 J형을 나란히. M16 + 육각너트 + 평와셔"""
    d, Pt = 16, 2.0
    ns, nm = P.ISO_NUT[16]
    wash = P.ISO_WASH[16]
    kw = dict(d=d, Pt=Pt, Lt=3.2 * d, Ls=8.5 * d, rb=1.7 * d, nut=(ns, nm), washer=wash)
    mL = bl.Model(fid)
    _bent_bolt(mL, kind='L', leg=3.4 * d, nut_rot=8, **kw)
    mJ = bl.Model(fid)
    _bent_bolt(mJ, kind='J', leg=3.0 * d, nut_rot=27, **kw)
    mJ.move(y=3.9 * d, z=0.0)
    n0 = len(mL.parts)
    big = mL.bolt_idx['big'] + [n0 + i for i in mJ.bolt_idx['big']]
    small = mL.bolt_idx['small'] + [n0 + i for i in mJ.bolt_idx['small']]
    mL.extend(mJ)
    mL.lie(24)
    return _rest_tilt(mL, 24, big, small).view(el=30)


# ══ 5. 후설치 앵커 ═══════════════════════════════════════════════════════════
@family('wedge')
def wedge_anchor(fid):
    """웨지 앵커 M12×100: 아래 끝은 쐐기(콘) + 터진 클립 고리, 위쪽은 나사 + 와셔 + 너트"""
    d, Pt, L = 12, 1.75, 100.0
    R = d / 2
    nut_s, nut_m = P.ISO_NUT[12]
    w1, w2, wt = P.ISO_WASH[12]
    tl = 46.0                                 # 나사부 길이 (위쪽)
    rn = R + 0.2                              # 선단(쐐기) 반지름
    r_neck = R - 1.0                          # 클립이 감싸는 가는 목
    zc0, zc1 = 4.6, 4.6 + 1.25 * d            # 클립 구간
    Rs = R * 0.99
    prof = [(0, 0), (rn - 1.4, 0), (rn, 1.4), (rn, zc0 - 0.6), (r_neck, zc0), (r_neck, zc1),
            (Rs, zc1 + 1.0), (Rs, L - tl + 1.0), (0, L - tl + 1.0)]
    m = bl.Model(fid)
    m.add(lathe(prof, 96), 'body', sharp=40)
    _rod(m, d, Pt, L - tl, L, tip0=False)
    clip = _c_ring(R + 0.3, r_neck + 0.02, zc0 - 0.2, zc1).rotz(-60)
    m.add(clip, 'body', sharp=30)
    ext = 2.8 * Pt
    _nut(m, d, Pt, nut_s, nut_m, L - ext - nut_m, 7)
    _washer(m, w1, w2, wt, L - ext - nut_m - wt - 0.05)
    m.lie(70)
    return _rest_tilt(m, 70, [3, 4], [0, 1, 2]).view(el=26)


@family('stronganchor')
def set_anchor(fid):
    """세트앙카(수나사형 타격 슬리브 앵커): 쐐기(콘) 달린 스터드 + 아래가 쪼개진 슬리브 파이프 + 와셔 + 너트"""
    d, Pt = 10, 1.5
    R = d / 2
    ns, nm = P.ISO_NUT[10]
    w1, w2, wt = P.ISO_WASH[10]
    ro, ri = 6.5, 5.25
    z_s0, z_s1 = 4.0, 47.0                    # 슬리브
    rcone = ri - 0.1
    top = z_s1 + wt + nm + 6.0
    prof = [(0, 0), (2.4, 0), (rcone, 19.0), (R - 0.06, 20.5), (R - 0.06, 38.0), (0, 38.0)]
    m = bl.Model(fid)
    m.add(lathe(prof, 64), 'body', sharp=40)
    _rod(m, d, Pt, 36.0, top, tip0=False)
    m.add(tube(ro, ri, z_s0, z_s1, N=96, ch=0.5), 'body', sharp=35, cut=_slots(ro, z_s0, z_s0 + 18.0, 1.5, 2))
    _washer(m, w1, w2, wt, z_s1 + 0.05)
    _nut(m, d, Pt, ns, nm, z_s1 + wt + 0.1, 13)
    m.lie(70)
    return _rest_tilt(m, 70, [3, 4], [0, 1, 2]).view(el=28)


@family('sleeve')
def sleeve_anchor(fid):
    """슬리브 앵커(너트형) M10: 긴 슬리브(위 턱, 아래 쪼갬) + 아래 콘 너트 + 나사 스터드 + 와셔 + 너트"""
    d, Pt = 10, 1.5
    R = d / 2
    ns, nm = P.ISO_NUT[10]
    w1, w2, wt = P.ISO_WASH[10]
    ro, ri = 6.2, 5.1
    z_s0, z_s1 = 5.0, 70.0
    top = z_s1 + 1.0 + wt + nm + 5.0
    m = bl.Model(fid)
    _rod(m, d, Pt, -1.5, top)
    # 콘 너트 (아래가 넓고 위로 좁아짐)
    cone = lathe([(0, 0), (ro + 0.7, 0), (ro + 0.7, 1.4), (ro + 0.5, 4.0), (R + 0.5, z_s0 + 11), (0, z_s0 + 11)], 64)
    m.add(cone, 'body', sharp=40)
    # 슬리브: 위쪽에 턱(칼라), 아래 3분의 1은 쪼개져 있다
    sl = lathe([(ri, z_s0 + 0.0), (ro - 0.4, z_s0), (ro, z_s0 + 0.4), (ro, z_s1 - 1.0), (ro + 1.8, z_s1 - 0.5), (ro + 1.8, z_s1 + 1.0), (ri, z_s1 + 1.0), (ri, z_s0)], 96)
    m.add(sl, 'body', sharp=35, cut=_slots(ro + 1.8, z_s0, z_s0 + 26.0, 2.2, 2))
    _washer(m, w1, w2, wt, z_s1 + 1.05)
    _nut(m, d, Pt, ns, nm, z_s1 + 1.1 + wt, 9)
    m.lie(70)
    return _rest_tilt(m, 70, [3, 4], [0, 1, 2]).view(el=28)


@family('dropin')
def drop_in_anchor(fid):
    """드롭인 앵커 M10 (바깥 14 × 길이 36): 위는 암나사 구멍, 아래는 4갈래로 쪼개져 안에 쐐기 플러그. 서 있는 것과 누운 것"""
    D, Pt = 10.0, 1.5
    ro, H = 7.0, 36.0
    rc = D / 2 + 0.15 * Pt                     # thread_bore 끝 고리 반지름
    rb = 4.15                                  # 나사 아래 매끈한 구멍
    Zt = H - 21.0                              # 나사 구간 아래 끝
    zs = Zt - (rc - rb)

    def build(name):
        mm = bl.Model(name)
        outer = lathe([(rc, H), (ro - 0.6, H), (ro, H - 0.6), (ro, 0.9), (ro - 0.9, 0.0), (rb, 0.0), (rb, zs), (rc, Zt), (rc, H)], 192)
        mm.add(outer, 'body', sharp=35, cut=_slots(ro, 0.0, 13.0, 1.6, 2))
        mm.add(thread_bore(D, Pt, Zt, H, N=192, rc=rc), 'body', sharp=40)
        plug = lathe([(0, 1.6), (2.3, 1.6), (rb - 0.03, 11.0), (0, 11.0)], 64)
        mm.add(plug, 'body', sharp=40)
        return mm

    lying = build(fid).lie(95)                 # 쪼개진 아래 끝이 오른쪽 안쪽을 향하게
    zf = lying.bbox()[0][2]
    stand = build(fid)
    stand.rotz(15).move(x=20.0, y=12.0)
    stand = _drop(stand, zf)
    lying.move(x=0, y=-10.0)
    lying.extend(stand)
    return lying.view(az=-38, el=36, fill=0.72)
