"""렌치볼트 계열(접시·버튼·저두·플랜지·별 구멍·인치·숄더)과 멈춤나사(무두볼트) 계열 빌더.

  csk ifhc          접시머리 렌치볼트 (ISO 10642 90° / ASME 82°)
  bhcs ibhc bhflange 버튼머리 (ISO 7380-1 · ASME · ISO 7380-2 플랜지)
  lowhead           저두 렌치볼트 (DIN 7984)
  torx              별(헥사로뷸러) 구멍 나사: 캡·냄비·접시 머리 세 개
  a574 f837         인치 렌치볼트 (ASME B18.3, 1/2"-13 / 5/16"-18)
  shoulder          숄더볼트 (ISO 7379)
  ss iss ss-slot ss-sq ss-soft ss-knurl   멈춤나사: 끝 모양 여러 가지를 나란히
"""
import math

import numpy as np

import bl
import geo
import parts as P
from fams import family
from geo import *

IN = 25.4


# ── 공통 보조 ────────────────────────────────────────────────────────────
def _tri(x):
    """주기 1 삼각파 (0..1)"""
    f = np.mod(x, 1.0)
    return 1 - np.abs(2 * f - 1)


def item(mesh, mat='body', cut=None, **kw):
    kw.setdefault('sharp', 35)
    return dict(mesh=mesh, mat=mat, cut=cut or [], kw=kw)


def put(m, items, x=0.0, y=0.0, z=0.0, rz=0.0):
    """부품 목록을 모델에 놓는다 (x,y,z 이동, rz = 축 둘레 회전)"""
    def tf(g):
        g = g.rotz(rz) if rz else g
        return g.move(x, y, z)
    for it in items:
        m.add(tf(it['mesh']), it['mat'], cut=[tf(c) for c in it['cut']], **it['kw'])
    return m


def place(m, items, L, r, yaw, sx=0.0, sd=0.0, az=-38.0):
    """부품(축 +Z, 머리 쪽 끝이 z=0, 길이 L, 반지름 r)을 눕혀서 놓는다. yaw = 머리 쪽 방위(lie와 같음),
    sx = 화면 오른쪽으로, sd = 화면 안쪽(카메라 반대)으로 옮긴 거리. 바닥에 닿도록 높이는 반지름"""
    a = math.radians(az)
    right = np.array([-math.sin(a), math.cos(a)])
    away = np.array([-math.cos(a), -math.sin(a)])
    w = sx * right + sd * away

    def tf(g):
        return g.move(0, 0, L / 2).roty(-90).rotz(yaw).move(w[0], w[1], r)
    for it in items:
        m.add(tf(it['mesh']), it['mat'], cut=[tf(c) for c in it['cut']], **it['kw'])
    return m


def thread2(d, Pt, z0, z1, rt0=None, rt1=None, N=96, spp=20, lead=45.0, cap0=False, cap1=False):
    """수나사 (geo.thread_rod와 같은 산 모양). 끝 모따기 반지름을 양 끝 따로 (None = 모따기 없음), 끝 막음도 따로"""
    R = d / 2
    h = 0.6 * Pt
    nz = max(8, int(round((z1 - z0) / Pt * spp)) + 1)
    zs = np.linspace(z0, z1, nz)
    th = geo.theta(N)[:, None]
    t = ((zs[None, :] - z0) / Pt - th / TAU) % 1.0
    r = R - h * (1 - geo._prof(t, 0.1, 0.2))
    k = math.tan(math.radians(lead))
    if rt0 is not None:
        r = np.minimum(r, rt0 + (zs[None, :] - z0) * k)
    if rt1 is not None:
        r = np.minimum(r, rt1 + (z1 - zs[None, :]) * k)
    zz = zs
    if cap0:
        r = np.concatenate([np.zeros((N, 1)), r], 1)
        zz = np.concatenate([[z0], zz])
    if cap1:
        r = np.concatenate([r, np.zeros((N, 1))], 1)
        zz = np.concatenate([zz, [z1]])
    P3 = np.stack([r * np.cos(th), r * np.sin(th), np.broadcast_to(zz[None, :], r.shape)], -1)
    return grid(P3, wrap=True)


def shaft(d, Pt, L, b=None, N=64):
    """머리 밑(z=0)에서 아래로 길이 L인 몸통. b = 나사 길이 (None이면 전체 나사). 민 몸통과 나사 사이는 45° 나사 끝 자국으로 이어짐"""
    if b is None or b >= L - 0.5:
        return [item(thread_rod(d, Pt, -L, 0.0, N=N, tip1=False), sharp=40)]
    R = d / 2
    rr = (R - 0.6 * Pt) * 0.97
    rsh = R * 1.004
    zs = -(L - b)
    sh = lathe([(0, 0.3), (rsh, 0.3), (rsh, zs), (rr, zs - (rsh - rr)), (0, zs - (rsh - rr))], 96)
    return [item(sh, sharp=40), item(thread_rod(d, Pt, -L, zs, N=N, tip1=False), sharp=40)]


def cap_head(dk, k, d, ct=None, N=128, knurl=0, amp=0.15):
    """원통 머리 (머리 밑면 z=0, 윗면 z=k). 윗 모서리는 모따기+둥글림. knurl = 옆면 곧은 널링 이 수"""
    R = dk / 2
    ct = ct or 0.05 * dk
    eb = max(0.4, 0.03 * dk)
    prof = [(0, k), (R - ct, k), (R - 0.2 * ct, k - 0.15 * ct), (R, k - ct), (R, eb), (R - eb, 0), (d / 2 + 0.4, 0), (0, 0)]
    rmod = None
    if knurl:
        N = max(N, knurl * 4)
        N = (N // (knurl * 4)) * knurl * 4

        def rmod(th, r, z):
            w = _tri(th * knurl / TAU)
            return np.where(r > R - 1e-6, r + amp * (2 * w - 1), r)
    return lathe(prof, N, rmod=rmod)


def button_head(dk, k, d, base=0.5, p=2.5, N=128, n=26, flange=None):
    """버튼(돔) 머리. 슈퍼타원 단면 (p가 클수록 윗면이 평평). flange=(바깥지름, 두께)면 머리 밑에 칼라"""
    R = dk / 2
    a = np.linspace(0, math.pi / 2, n)
    e = 2 / p
    if flange:
        Rc, c = flange[0] / 2, flange[1]
        base = c + 0.6
        pr = [(0, 0), (d / 2 + 0.4, 0), (Rc - 0.3, 0), (Rc, 0.3), (Rc, c - 0.3), (Rc - 0.3, c), (R + 0.3, base)]
    else:
        pr = [(0, 0), (d / 2 + 0.4, 0), (R - 0.3, 0), (R, 0.3)]
    pr += [(R * math.cos(t) ** e, base + (k - base) * math.sin(t) ** e) for t in a]
    pr[-1] = (0, k)
    return lathe(pr, N)


def csk_head(d, dk, k, ang=90.0, N=128):
    """접시머리 (밑 꼭대기 z=0 에서 지름 d, 윗면 z=k). 원뿔 반각 ang/2, 윗 모서리는 둥글림"""
    tn = math.tan(math.radians(ang / 2))
    Rh = dk / 2
    zc = (Rh - d / 2) / tn
    rim = 0.25
    if zc > k - rim:
        zc = k - rim
        Rh = d / 2 + zc * tn
    e = min(0.35, k - zc)
    e = max(e, 0.2)
    pr = [(0, k), (Rh - 0.8 * e, k), (Rh - 0.15 * e, k - 0.25 * e), (Rh, k - e)]
    if k - e > zc + 1e-6:
        pr.append((Rh, zc))
    pr += [(d / 2 + 0.05, 0.05), (0, 0)]
    return lathe(pr, N)


def socket_head_items(head, d, Pt, L, b, s, t, k):
    """머리 + 육각 구멍 + 몸통 (머리 높이 k)"""
    return [item(head, cut=[P.cut_hex(s, t, z_top=k)])] + shaft(d, Pt, L, b)


# ── 접시머리 렌치볼트 ────────────────────────────────────────────────────
@family('csk', 'ifhc')
def countersunk(fid):
    if fid == 'csk':          # ISO 10642 M10 × 40 (90°), 나사 길이 b = 2d+6
        d, Pt, dk, k, s, t, L, b, ang = 10.0, 1.5, 20.0, 5.5, 6.0, 3.0, 40.0, 26.0, 90.0
    else:                     # ASME B18.3 3/8"-16 × 1-1/4" (82°), 전체 나사
        d, Pt, dk, k, s, t, L, b, ang = 0.375 * IN, IN / 16, 0.75 * IN, 0.210 * IN, 0.1875 * IN, 0.13 * IN, 1.25 * IN, None, 82.0
    m = bl.Model(fid)
    head = csk_head(d, dk, k, ang)
    put(m, [item(head, cut=[P.cut_hex(s, t, z_top=k)])] + shaft(d, Pt, L - k, b))
    return m.lie(88).view(el=26)


# ── 버튼머리 · 플랜지 버튼머리 ────────────────────────────────────────────
@family('bhcs', 'ibhc')
def button(fid):
    if fid == 'bhcs':         # ISO 7380-1 M8 × 20
        d, Pt, dk, k, s, t, L = 8.0, 1.25, 14.0, 4.4, 5.0, 2.5, 20.0
    else:                     # ASME B18.3 3/8"-16 × 1"
        d, Pt, dk, k, s, t, L = 0.375 * IN, IN / 16, 0.656 * IN, 0.199 * IN, 0.21875 * IN, 0.11 * IN, 1.0 * IN
    m = bl.Model(fid)
    head = button_head(dk, k, d, base=0.55, p=2.5)
    put(m, [item(head, cut=[P.cut_hex(s, t, z_top=k)])] + shaft(d, Pt, L, None))
    return m.lie(86).view(el=28)


@family('bhflange')
def button_flange(fid):
    d, Pt, dk, dc, k, s, t, L = 8.0, 1.25, 14.0, 18.0, 5.6, 5.0, 2.8, 20.0     # ISO 7380-2 M8 × 20
    m = bl.Model(fid)
    head = button_head(dk, k, d, p=2.5, flange=(dc, 1.5))
    put(m, [item(head, cut=[P.cut_hex(s, t, z_top=k)])] + shaft(d, Pt, L, None))
    return m.lie(86).view(el=28)


# ── 저두 렌치볼트 ────────────────────────────────────────────────────────
@family('lowhead')
def low_head(fid):
    d, Pt, dk, k, s, t, L, b = 10.0, 1.5, 16.0, 6.0, 7.0, 3.5, 30.0, 26.0       # DIN 7984 M10 × 30
    m = bl.Model(fid)
    put(m, socket_head_items(cap_head(dk, k, d), d, Pt, L, b, s, t, k))
    return m.lie(88).view(el=26)


# ── 인치 렌치볼트 (A574) · 스테인리스 (F837) ──────────────────────────────
@family('a574', 'f837')
def inch_socket_cap(fid):
    if fid == 'a574':         # 1/2"-13 × 2", 나사 길이 2D+1/2" = 1.5", 머리 옆면 널링
        d, Pt, dk, k, s, t, L, b, kn = 0.5 * IN, IN / 13, 0.75 * IN, 0.5 * IN, 0.375 * IN, 0.25 * IN, 2.0 * IN, 1.5 * IN, 72
    else:                     # 5/16"-18 × 1-1/2", 머리 매끈
        d, Pt, dk, k, s, t, L, b, kn = 0.3125 * IN, IN / 18, 0.469 * IN, 0.3125 * IN, 0.25 * IN, 0.172 * IN, 1.5 * IN, 1.125 * IN, 0
    m = bl.Model(fid)
    put(m, socket_head_items(cap_head(dk, k, d, knurl=kn), d, Pt, L, b, s, t, k))
    return m.lie(88).view(el=26)


# ── 별(헥사로뷸러) 구멍 나사: 캡 · 냄비 · 접시 ────────────────────────────
@family('torx')
def torx_screws(fid):
    d, Pt, L = 5.0, 0.8, 16.0          # M5 × 16, 구멍 T25 (바깥 지름 약 4.4)
    A, tdep = 4.43, 2.3
    m = bl.Model(fid)
    # 캡 머리 (ISO 14579)
    k1 = 5.0
    cap = [item(cap_head(8.5, k1, d), cut=[P.cut_torx(A, tdep, z_top=k1)])] + shaft(d, Pt, L, None)
    # 냄비 머리 (ISO 14583)
    k2 = 3.7
    pan = [item(button_head(10.0, k2, d, base=0.7, p=2.2), cut=[P.cut_torx(A, tdep, z_top=k2)])] + shaft(d, Pt, L, None)
    # 접시 머리 (ISO 14581)
    k3 = 2.85
    csk = [item(csk_head(d, 10.0, k3, 90.0), cut=[P.cut_torx(A, tdep, z_top=k3)])] + shaft(d, Pt, L - k3, None)
    # 머리 구멍이 카메라 쪽을 향하도록 (yaw 105), 화면 가로로 나란히
    place(m, cap, k1 + L, 4.25, 105, sx=-15.0)
    place(m, pan, k2 + L, 5.0, 105, sx=0.0)
    place(m, csk, L, 5.0, 105, sx=15.0)
    return m.view(el=28)


# ── 숄더볼트 (ISO 7379) ──────────────────────────────────────────────────
@family('shoulder')
def shoulder_screw(fid):
    d1, dk, k, s, t = 10.0, 16.0, 7.0, 6.0, 3.5        # 숄더 ⌀10, 머리 ⌀16×7, 육각 6, 나사 M8
    Ls, dth, Pt, lth = 30.0, 8.0, 1.25, 12.0           # 숄더 길이 30, 나사 M8 × 12
    ch, rn, ln = 0.5, 3.3, 1.5                         # 숄더 끝 모따기, 가는 목(릴리프) 반지름·길이
    m = bl.Model(fid)
    Rs = d1 / 2
    sh = lathe([(0, 0.3), (Rs, 0.3), (Rs, -Ls + ch), (Rs - ch, -Ls), (rn, -Ls), (rn, -Ls - ln - 0.4), (0, -Ls - ln - 0.4)], 128)
    rtip = (dth / 2 - 0.6 * Pt) - 0.12 * Pt
    th = thread2(dth, Pt, -(Ls + ln + lth), -(Ls + ln), rt0=rtip, rt1=rtip, N=64, cap0=True)
    put(m, [item(cap_head(dk, k, d1), cut=[P.cut_hex(s, t, z_top=k)]), item(sh, sharp=40), item(th, sharp=40)])
    return m.lie(80).view(el=26)


# ── 멈춤나사 공통 ────────────────────────────────────────────────────────
def cup_tip(rb, rin, depth, z0, teeth=0, ta=0.5, N=96):
    """컵 끝: 바깥 모따기 링(rb) → 평평한 테두리(rin) → 오목한 원뿔. teeth>0이면 테두리·안쪽에 방사 톱니(널링)"""
    th = geo.theta(N)
    w = _tri(th * teeth / TAU) if teeth else np.zeros(N)
    rows = [np.stack([rb * np.cos(th), rb * np.sin(th), np.full(N, z0)], -1)]
    us = [0.0, 0.25, 0.5, 0.75, 1.0]
    for u in us:
        r = rin * (1 - u)
        z = z0 + depth * u + ta * w * (1 - u)
        rows.append(np.stack([r * np.cos(th), r * np.sin(th), z], -1))
    return grid(np.stack(rows, 1), wrap=True)


def set_screw(d, Pt, L, point, s=None, slot=None, t=None, tipmat='nylonw', teeth=0, N=96):
    """멈춤나사 하나. 축 +Z, 공구 쪽 끝 z=0, 끝 모양 쪽 z=-L. point: cup flat cone dog hdog oval soft knurl
    육각 구멍 s (맞변) 또는 일자 홈 slot=(폭, 길이)  ·  t = 구멍 깊이"""
    R = d / 2
    rroot = R - 0.6 * Pt
    rt_top = rroot - 0.12 * Pt
    rt_def = rt_top
    z0 = -L
    tip = None
    plug = None
    if point == 'flat':
        rb = 0.345 * d
        thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=rt_top, N=N)
        tip = lathe([(rb, z0), (0, z0)], N)
    elif point == 'cup':
        rb = min(0.39 * d, rroot - 0.06)
        thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=rt_top, N=N)
        tip = cup_tip(rb, rb - 0.45, (rb - 0.45) * 0.65, z0, N=N)
    elif point == 'knurl':
        rb = min(0.39 * d, rroot - 0.06)
        thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=rt_top, N=N)
        tip = cup_tip(rb, rb - 0.5, (rb - 0.5) * 0.65, z0, teeth=teeth or 24, ta=0.6, N=N)
    elif point == 'cone':
        rb = 0.36 * d
        z0 = -L + (rb - 0.15)
        thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=rt_top, N=N)
        tip = lathe([(rb, z0), (0.15, -L), (0, -L)], N)
    elif point in ('dog', 'hdog'):
        rp = min(0.345 * d, rt_def - 0.15)
        zd = 0.5 * d if point == 'dog' else 0.25 * d
        z0 = -L + zd
        thr = thread2(d, Pt, z0, 0.0, rt0=rt_def, rt1=rt_top, N=N)
        ch = 0.3
        tip = lathe([(rt_def, z0), (rp, z0), (rp, -L + ch), (rp - ch, -L), (0, -L)], N)
    elif point == 'oval':
        rb = min(0.42 * d, rroot - 0.06)
        Ro = 0.52 * d * rb / (0.42 * d)
        a = math.asin(rb / Ro)
        hc = Ro * (1 - math.cos(a))
        z0 = -L + hc
        thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=rt_top, N=N)
        arc = [(Ro * math.sin(q), z0 - hc + Ro * (1 - math.cos(q))) for q in np.linspace(a, 0, 10)]
        arc[-1] = (0, -L)
        tip = lathe(arc, N)
    elif point == 'soft':
        rb = min(0.84 * rroot, rt_top)
        thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=rt_top, N=N)
        tip = lathe([(rb, z0), (0, z0)], N)
        rp = 0.27 * d
        prot = 0.16 * d
        plug = lathe([(0, z0 + 1.2), (rp, z0 + 1.2), (rp, z0 - prot + 0.3), (rp - 0.3, z0 - prot), (0, z0 - prot)], 64)
    else:
        raise ValueError(point)
    body = (thr + tip).weld()
    items = []
    # 공구 쪽 끝 마개 (구멍·홈을 불리언으로 판다). 마개 옆면은 나사 안쪽에 묻힌다
    lid_r = rt_top
    cuts = []
    if slot:
        w, ln = slot
        dc = t + 1.5
        cuts = [P.cut_slot(w, t, ln, z_top=0.0)]
    else:
        Rh = s / math.sqrt(3)
        dc = t + 0.35 * Rh + 1.2
        cuts = [P.cut_hex(s, t, z_top=0.0)]
    lid = lathe([(0, 0), (lid_r, 0), (lid_r - 0.3, -0.3), (lid_r - 0.3, -dc), (0, -dc)], N)
    items.append(item(body, sharp=38))
    items.append(item(lid, cut=cuts, sharp=38))
    if plug is not None:
        items.append(item(plug, tipmat, sharp=40))
    return items


# ── 무두볼트 (ISO 4026~4029): 평·컵·원뿔·봉 끝 ─────────────────────────────
@family('ss')
def set_screws(fid):
    d, Pt, s, t, L = 8.0, 1.25, 4.0, 4.0, 14.0           # M8 × 14, 육각 4
    m = bl.Model(fid)
    mk = lambda kd: set_screw(d, Pt, L, kd, s=s, t=t)
    # 뒤줄: 컵·평 끝이 카메라 쪽 / 앞줄: 원뿔·봉 끝은 옆모습
    place(m, mk('cup'), L, d / 2, -48, sx=-14.0, sd=11.0)
    place(m, mk('flat'), L, d / 2, -48, sx=14.0, sd=11.0)
    place(m, mk('cone'), L, d / 2, 72, sx=-14.0, sd=-8.0)
    place(m, mk('dog'), L, d / 2, 72, sx=14.0, sd=-8.0)
    return m.view(el=34)


# ── 인치 멈춤나사 ────────────────────────────────────────────────────────
@family('iss')
def inch_set_screws(fid):
    d, Pt, s, t, L = 0.25 * IN, IN / 20, 0.125 * IN, 0.17 * IN, 0.5 * IN       # 1/4"-20 × 1/2", 육각 1/8"
    m = bl.Model(fid)
    mk = lambda kd: set_screw(d, Pt, L, kd, s=s, t=t)
    place(m, mk('cup'), L, d / 2, -48, sx=-9.0, sd=9.0)
    place(m, mk('flat'), L, d / 2, -48, sx=9.0, sd=9.0)
    place(m, mk('cone'), L, d / 2, 72, sx=-17.0, sd=-5.0)
    place(m, mk('oval'), L, d / 2, 72, sx=0.0, sd=-5.0)
    place(m, mk('hdog'), L, d / 2, 72, sx=17.0, sd=-5.0)
    return m.view(el=34)


# ── 일자 홈 멈춤나사 (ISO 4766 평 · 7434 원뿔 · 7435 봉) ────────────────────
@family('ss-slot')
def slotted_set_screws(fid):
    d, Pt, L = 6.0, 1.0, 10.0                              # M6 × 10, 홈 폭 1.0 깊이 1.6
    m = bl.Model(fid)
    mk = lambda kd: set_screw(d, Pt, L, kd, slot=(1.15, 8.0), t=1.7)
    place(m, mk('flat'), L, d / 2, 118, sx=0.0, sd=8.0)            # 홈이 정면으로 보이게
    place(m, mk('cone'), L, d / 2, 74, sx=-10.0, sd=-5.0)
    place(m, mk('dog'), L, d / 2, 74, sx=10.0, sd=-5.0)
    return m.view(el=30)


# ── 사각머리 멈춤나사 ────────────────────────────────────────────────────
def square_head_set_screw(d, Pt, L, F, H, N=96):
    """사각 머리(맞변 F, 높이 H) + 전체 나사 + 컵 끝. 머리 밑면 z=0"""
    R = d / 2
    rroot = R - 0.6 * Pt
    rb = min(0.39 * d, rroot - 0.06)
    z0 = -L
    thr = thread2(d, Pt, z0, 0.0, rt0=rb, rt1=None, N=N)
    tip = cup_tip(rb, rb - 0.5, (rb - 0.5) * 0.65, z0, N=N)
    body = (thr + tip).weld()
    head = polybody(4, F, 0.0, H, rc_top=F / 2 * 0.97, rho=0.04 * F, N=192)
    return [item(body, sharp=38), item(head, sharp=30)]


@family('ss-sq')
def square_set_screws(fid):
    m = bl.Model(fid)
    a = square_head_set_screw(0.375 * IN, IN / 16, 1.0 * IN, 0.375 * IN, 0.265 * IN)
    b = square_head_set_screw(0.25 * IN, IN / 20, 0.625 * IN, 0.25 * IN, 0.196 * IN)
    place(m, a, 1.0 * IN, 0.375 * IN / 2, 80, sx=-6.0, sd=8.0)
    place(m, b, 0.625 * IN, 0.25 * IN / 2, -50, sx=14.0, sd=-8.0)     # 작은 것은 컵 끝이 카메라 쪽
    return m.view(el=30)


# ── 소프트 팁 멈춤나사 (나일론 · 황동 팁) ──────────────────────────────────
@family('ss-soft', looks=['BO'])
def soft_tip_set_screws(fid):
    d, Pt, s, t, L = 8.0, 1.25, 4.0, 4.0, 16.0
    m = bl.Model(fid)
    mk = lambda mat: set_screw(d, Pt, L, 'soft', s=s, t=t, tipmat=mat)
    # 나일론·황동 팁이 3/4 정면으로 보이게, 가운데 뒤는 구멍 쪽이 정면
    place(m, mk('nylonw'), L, d / 2, 12, sx=-12.0, sd=-5.0)
    place(m, mk('brass'), L, d / 2, 12, sx=12.0, sd=-5.0)
    place(m, mk('nylonw'), L, d / 2, 120, sx=0.0, sd=10.0)
    return m.view(el=30)


# ── 널링 컵 포인트 멈춤나사 ──────────────────────────────────────────────
@family('ss-knurl', looks=['BO'])
def knurled_cup_set_screws(fid):
    d, Pt, s, t, L = 8.0, 1.25, 4.0, 4.0, 14.0
    m = bl.Model(fid)
    mk = lambda: set_screw(d, Pt, L, 'knurl', s=s, t=t, teeth=24)
    place(m, mk(), L, d / 2, -55, sx=-8.0, sd=2.0)          # 널링 컵이 보이게
    place(m, mk(), L, d / 2, 70, sx=10.0, sd=-3.0)          # 옆모습
    return m.view(el=32)
