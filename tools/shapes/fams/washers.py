"""와셔·링류 형상 빌더: 평와셔 변형(대·소·특대·두꺼운·인치·경화), 사각·경사·구면 와셔, 스프링와셔(DIN 127 · 인치),
이붙이·접시형(DIN 6796)·쐐기형·접시 스프링(DIN 2093), DTI, 혀붙이·MB 로크와셔, 실링 링·본디드 씰.

공통 규약: 바닥에 놓고 위에서 내려다본다 (m.view(el=…)). 2~3장 겹치거나 한 장은 기대 세워 두께·구멍이 보이게 한다.
화면 가로 방향(카메라 az=-38° 기준 오른쪽)은 (sin38°, cos38°), 카메라 쪽은 (cos38°, -sin38°).
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import *

_R = math.radians(38)
RIGHT = (math.sin(_R), math.cos(_R))          # 화면 오른쪽 (바닥 평면)
NEAR = (math.cos(_R), -math.sin(_R))          # 카메라 쪽


def at(mesh, right=0.0, near=0.0, z=0.0):
    """화면 기준 위치로 옮김 (오른쪽 right mm, 카메라 쪽 near mm)"""
    return mesh.move(RIGHT[0] * right + NEAR[0] * near, RIGHT[1] * right + NEAR[1] * near, z)


# ── 공용 헬퍼 ────────────────────────────────────────────────────────────
def lean_on(mesh, h, ex, ez, beta=24.0, psi=0.0, center=(0.0, 0.0)):
    """두께 h(z 0..h)인 얇은 판 mesh(또는 메시 목록)를 세워, 뒷면이 모서리(바깥 둘레 반지름 ex, 높이 ez)에 기대게 놓는다.
    beta = 판이 수직에서 눕는 각, psi = 놓이는 방위(도), center = 받치는 와셔 중심"""
    one = not isinstance(mesh, (list, tuple))
    ms = [mesh] if one else list(mesh)
    b = math.radians(beta)
    ms = [q.move(z=-h / 2).roty(90 - beta) for q in ms]
    tz = -min(q.V[:, 2].min() for q in ms)
    tx = (ex * math.cos(b) + ez * math.sin(b) - tz * math.sin(b) + h / 2) / math.cos(b)
    out = [q.move(tx, 0, tz).rotz(psi).move(center[0], center[1], 0) for q in ms]
    return out[0] if one else out


def ground(mesh):
    """최저점이 z=0이 되게 내림"""
    return mesh.move(z=-mesh.V[:, 2].min())


def rest_rot(V, nsamp=44):
    """꼭짓점 V (n,3)의 무게중심이 받침 삼각형 안에 드는 안정한 놓임 자세 → 3x3 회전행렬 (바닥 법선 = +Z)"""
    V = np.asarray(V, float)
    V = V[:: max(1, len(V) // 4000)]
    com = V.mean(0)
    idx = [int(np.argmin(V[:, 2]))]
    d = np.linalg.norm(V - V[idx[0]], axis=1)
    for _ in range(nsamp - 1):
        j = int(np.argmax(d))
        idx.append(j)
        d = np.minimum(d, np.linalg.norm(V - V[j], axis=1))
    S = V[idx]
    best, bh = None, 1e18
    n = len(S)
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                nr = np.cross(S[j] - S[i], S[k] - S[i])
                ln = np.linalg.norm(nr)
                if ln < 1e-9:
                    continue
                nr /= ln
                s = (com - S[i]) @ nr
                if s < 0:
                    nr, s = -nr, -s
                if s >= bh:
                    continue
                if ((S - S[i]) @ nr).min() < -1e-6:
                    continue
                if ((V - S[i]) @ nr).min() < -1e-6:
                    continue
                p = com - s * nr
                c1 = np.cross(S[j] - S[i], p - S[i]) @ nr
                c2 = np.cross(S[k] - S[j], p - S[j]) @ nr
                c3 = np.cross(S[i] - S[k], p - S[k]) @ nr
                if (c1 >= 0 and c2 >= 0 and c3 >= 0) or (c1 <= 0 and c2 <= 0 and c3 <= 0):
                    best, bh = nr, s
    if best is None:
        return np.eye(3)
    z = np.array([0, 0, 1.0])
    v = np.cross(best, z)
    c = float(best @ z)
    sn = np.linalg.norm(v)
    if sn < 1e-9:
        return np.eye(3)
    v /= sn
    ang = math.atan2(sn, c)
    K = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * (K @ K)


def chamfer_poly(pts, e):
    """닫힌 (r,z) 다각형의 모든 꼭짓점을 e 만큼 깎는다 (모서리 둥글림 대용). 반환은 시작점으로 닫힌 목록"""
    pts = [np.asarray(p, float) for p in pts]
    n = len(pts)
    out = []
    for i in range(n):
        p, a, b = pts[i], pts[i - 1], pts[(i + 1) % n]
        la, lb = np.linalg.norm(a - p), np.linalg.norm(b - p)
        ea, eb = min(e, la * 0.45), min(e, lb * 0.45)
        out.append(p + (a - p) / la * ea)
        out.append(p + (b - p) / lb * eb)
    out.append(out[0])
    return [tuple(q) for q in out]


def rounded_lathe(pts, e, N=128):
    return lathe(chamfer_poly(pts, e), N)


def ring_outline(R, tabs, step=2.0):
    """반지름 R 원 윤곽에 직사각 혀를 붙인 닫힌 윤곽(반시계).
    tabs = [(방위°, 폭, 길이(원 바깥으로), 끝 모서리 반지름)]. 길이가 음수면 안쪽으로(구멍의 혀)"""
    segs = []
    for (phi, w, L, rr) in sorted(tabs):
        hw = w / 2
        dl = math.degrees(math.asin(hw / R))
        segs.append((phi - dl, phi + dl, phi, hw, L, rr))
    pts = []
    for k, (a0, a1, phi, hw, L, rr) in enumerate(segs):
        pa = segs[k - 1][1] - (360 if k == 0 else 0)
        n = max(2, int(round((a0 - pa) / step)))
        for a in np.linspace(pa, a0, n, endpoint=False)[1:]:
            pts.append((R * math.cos(math.radians(a)), R * math.sin(math.radians(a))))
        s = 1 if L >= 0 else -1
        u0 = math.sqrt(R * R - hw * hw)
        ue = R + L
        rr = min(rr, hw, abs(L))
        loc = [(u0, -hw)]
        if rr > 1e-6:
            cx = ue - s * rr
            t1 = np.linspace(-90, 0 if s > 0 else -180, 6)
            t2 = np.linspace(0 if s > 0 else 180, 90, 6)
            loc += [(cx + rr * math.cos(math.radians(t)), -hw + rr + rr * math.sin(math.radians(t))) for t in t1]
            loc += [(cx + rr * math.cos(math.radians(t)), hw - rr + rr * math.sin(math.radians(t))) for t in t2]
        else:
            loc += [(ue, -hw), (ue, hw)]
        loc.append((u0, hw))
        c, sn = math.cos(math.radians(phi)), math.sin(math.radians(phi))
        for (u, v) in loc:
            pts.append((u * c - v * sn, u * sn + v * c))
    return np.array(pts)


def lathe_ring(r1, r2, h, e=0.15, N=128, z0=0.0):
    return P.washer_mesh(2 * r1, 2 * r2, h, z0=z0, edge=e, N=N)


# ── 평와셔 변형 ──────────────────────────────────────────────────────────
def _pile(m, mk, h, n=2, lean=True, beta=22.0, psi=30.0, twist=(0.55, 0.3), r_edge=None, kw=None):
    """바닥에 n장 겹쳐(약간 어긋나게) 놓고 한 장은 모서리에 기대 세운다. mk(i) → 메시(z 0..h)"""
    kw = kw or dict(sharp=40)
    cx = cy = 0.0
    for i in range(n):
        mesh = mk(i)
        dx, dy = (twist[0] * i * math.cos(i * 2.2 + 0.5), twist[1] * i * math.sin(i * 2.2 + 0.5))
        m.add(mesh.move(dx, dy, i * h), 'body', **kw)
        cx, cy = dx, dy
    if lean:
        mesh = mk(n)
        R = r_edge if r_edge else (mesh.V[:, 0] ** 2 + mesh.V[:, 1] ** 2).max() ** 0.5
        m.add(lean_on(mesh, h, R, n * h, beta, psi, (cx, cy)), 'body', **kw)
    return m


@family('pwl', 'pws', 'pwxl', 'thickw', 'ipw', 'ifw')
def plain_variants(fid):
    m = bl.Model(fid)
    if fid == 'pwl':                                  # ISO 7093-1 M12: 13 × 37 × 3
        d1, d2, h = 13, 37, 3
        _pile(m, lambda i: lathe_ring(d1 / 2, d2 / 2, h, 0.2), h, n=2, psi=28)
    elif fid == 'pws':                                # ISO 7092 M12: 13 × 20 × 2
        d1, d2, h = 13, 20, 2
        _pile(m, lambda i: lathe_ring(d1 / 2, d2 / 2, h, 0.16), h, n=3, psi=28, beta=20)
    elif fid == 'pwxl':                               # ISO 7094 (DIN 440 R) M12: 13.5 × 44 × 3
        d1, d2, h = 13.5, 44, 3
        _pile(m, lambda i: lathe_ring(d1 / 2, d2 / 2, h, 0.2), h, n=2, psi=30)
    elif fid == 'thickw':                             # DIN 7349 M12 (두꺼운): 13 × 30 × 8, 모서리 둥글림 큼
        d1, d2, h = 13, 30, 8
        _pile(m, lambda i: lathe_ring(d1 / 2, d2 / 2, h, 0.7), h, n=1, psi=25, beta=20)
    elif fid == 'ipw':                                # ASME B18.21.1 1/2": USS 넓은형 + SAE 좁은형
        wide, narrow = (14.3, 34.9, 2.8), (13.5, 27.0, 2.4)
        ws = lathe_ring(wide[0] / 2, wide[1] / 2, wide[2], 0.18)
        nr = lathe_ring(narrow[0] / 2, narrow[1] / 2, narrow[2], 0.16)
        m.add(ws, 'body', sharp=40)
        m.add(nr.move(1.5, 0.8, wide[2]), 'body', sharp=40)
        m.add(lean_on(nr, narrow[2], narrow[1] / 2, wide[2] + narrow[2], 22, 28, (1.5, 0.8)), 'body', sharp=40)
    else:                                             # ifw: ASTM F436 1/2": 14.3 × 27 × 3.4 경화
        d1, d2, h = 14.3, 27.0, 3.4
        _pile(m, lambda i: lathe_ring(d1 / 2, d2 / 2, h, 0.3), h, n=2, psi=30)
    return m.view(el=40)


# ── 사각 와셔 · 경사 와셔 ────────────────────────────────────────────────
def _plate(a, h, hole, r=1.2):
    return extrude(rect2d(a, a, r=r, n=6), 0, h, holes=[circle2d(hole / 2, 72)])


@family('sqw')
def square_washer(fid):
    a, h, hole = 56.0, 8.0, 16.0          # 앵커 플레이트 와셔: 두꺼운 사각 판 + 둥근 구멍
    m = bl.Model(fid)
    _pile(m, lambda i: _plate(a, h, hole).rotz(8 + 24 * i), h, n=3, lean=False, twist=(2.0, 1.2), kw=dict(sharp=15, bevel=0.45))
    return m.view(el=40)


def _wedge(a, hmin, hmax, hole, r=1.0):
    """사각 쐐기 판: x=+a/2 쪽이 두껍다 (hmax), x=-a/2 쪽이 얇다 (hmin). 구멍은 바닥면에 수직"""
    p = extrude(rect2d(a, a, r=r, n=5), 0, 1.0, holes=[circle2d(hole / 2, 72)])
    V = p.V.copy()
    top = V[:, 2] > 0.5
    V[top, 2] = hmin + (hmax - hmin) * (V[top, 0] + a / 2) / a
    return Mesh(V, p.Q, p.T)


@family('taperw')
def taper_washer(fid):
    a, hmax, hole = 40.0, 6.0, 13.5       # DIN 434 (ㄷ형강 8 %): 변 40, 구멍 13.5, 두꺼운 쪽 6.0 → 얇은 쪽 2.8
    hmin = hmax - 0.08 * a
    m = bl.Model(fid)
    w = _wedge(a, hmin, hmax, hole)
    # 두꺼운 쪽(+x)이 화면 오른쪽(방위 52°) / 왼쪽을 향하게 → 옆모습에서 쐐기가 보인다
    m.add(at(w.rotz(40), right=-23, near=7), 'body', sharp=15, bevel=0.3)
    m.add(at(w.rotz(232), right=23, near=-7), 'body', sharp=15, bevel=0.3)
    return m.view(el=28)


# ── 구면 와셔 (DIN 6319 C + D) ───────────────────────────────────────────
@family('sphw')
def spherical_washer(fid):
    r1, c = 6.5, 0.25
    # C형(볼록 구면): 평평한 아랫면 Ø24, 위는 반지름 R=18 구면
    R, ro, wall = 18.0, 12.0, 2.0
    zs = lambda r: wall + (math.sqrt(R * R - r * r) - math.sqrt(R * R - ro * ro))
    rr = np.linspace(ro, r1 + c, 16)
    prof = [(r1 + c, 0), (ro - c, 0), (ro, c), (ro, wall)] + [(r, zs(r)) for r in rr[1:]] + [(r1, zs(r1) - c), (r1, c)]
    Cm = lathe(prof + [prof[0]], 128)
    # D형(오목 원추 자리): 바깥 Ø30, 높이 6.5, 위에서 원추 오목
    ho = 6.5
    prof = [(r1 + c, 0), (15 - c, 0), (15, c), (15, ho - c), (15 - c, ho), (11.2, ho), (r1 + 0.6, 2.4), (r1, 2.0), (r1, c)]
    Dm = lathe(prof + [prof[0]], 128)
    m = bl.Model(fid)
    m.add(at(Dm, right=-19, near=-2), 'body', sharp=38)
    m.add(at(Cm, right=17, near=3), 'body', sharp=38)
    return m.view(el=40)


# ── 스프링와셔 (한 바퀴 나선, 사각 단면) ─────────────────────────────────
def helical_ring(r1, r2, s, rise, a0=3.5, a1=356.5, n=110, rc=0.2, skew=14.0):
    """사각 단면(반지름 방향 r1..r2, 높이 s) 링을 a0→a1(도)로 한 바퀴 돌며 rise 만큼 올라간다. 양 끝은 비스듬히 잘림"""
    sec = [(r1 + rc, 0), (r2 - rc, 0), (r2, rc), (r2, s - rc), (r2 - rc, s), (r1 + rc, s), (r1, s - rc), (r1, rc)]
    th = np.radians(np.linspace(a0, a1, n))
    rings = []
    for i, t in enumerate(th):
        z0 = rise * (t - th[0]) / (th[-1] - th[0])
        row = []
        for (r, z) in sec:
            tt = t
            if i == 0:
                tt = t + math.radians(skew) * (z / s - 0.5)
            elif i == n - 1:
                tt = t - math.radians(skew) * (z / s - 0.5)
            row.append((r * math.cos(tt), r * math.sin(tt), z0 + z))
        rings.append(row)
    Pm = np.array(rings)
    body = grid(Pm, wrap=False, wrap_v=True)
    m_ = len(sec)
    caps = Mesh()
    for ring in (Pm[0], Pm[-1]):
        c = ring.mean(0)
        caps = caps + Mesh(np.vstack([ring, c]), None, [[i, (i + 1) % m_, m_] for i in range(m_)])
    return (body + caps).weld(1e-7)


def _settled(mesh_fn, gap_az):
    """링을 안정하게 놓고 (rest_rot), 갈라진 틈이 방위 gap_az(도)를 향하도록 돌린다"""
    mesh = mesh_fn
    M = rest_rot(mesh.V)
    mesh = mesh.tf(M)
    # 틈의 방향: 시작/끝 단면 중심의 가운데 (원래 방위 0°쪽 반지름 위치)
    gap = (np.array([1.0, 0, 0]) @ M.T)
    az = math.degrees(math.atan2(gap[1], gap[0]))
    return mesh.rotz(gap_az - az)


@family('sw', 'ilw')
def spring_washer(fid):
    if fid == 'sw':                       # DIN 127 B M12: 12.2 × 21.1, 두께 2.5, 자유 높이 약 2s
        r1, r2, s = 6.1, 10.55, 2.5
    else:                                 # ASME B18.21.1 Regular 1/2": 13.0 × 22.0, 두께 3.2
        r1, r2, s = 6.5, 11.0, 3.2
    w = helical_ring(r1, r2, s, s, skew=14.0 if fid == 'sw' else 4.0)
    m = bl.Model(fid)
    a = _settled(w, -5)
    b = _settled(w.rotx(180), 40)
    m.add(at(a, right=-10, near=6), 'body', sharp=40)
    m.add(at(b, right=11, near=-8), 'body', sharp=40)
    return m.view(el=42)


# ── 공용: 둥근 모서리 링 단면 · 굽힘 혀 ─────────────────────────────────
def rr_profile(r1, r2, z0, z1, e, k=4):
    """(r,z) 둥근 모서리 직사각 단면 (닫힌 목록)"""
    e = min(e, (r2 - r1) / 2 - 1e-3, (z1 - z0) / 2 - 1e-3)
    pts = []
    for (cr, cz, a0) in [(r2 - e, z0 + e, -90), (r2 - e, z1 - e, 0), (r1 + e, z1 - e, 90), (r1 + e, z0 + e, 180)]:
        for a in np.linspace(a0, a0 + 90, k + 1):
            pts.append((cr + e * math.cos(math.radians(a)), cz + e * math.sin(math.radians(a))))
    pts.append(pts[0])
    return pts


def round_ring(r1, r2, h, e, N=128, z0=0.0, k=4):
    return lathe(rr_profile(r1, r2, z0, z0 + h, e, k), N)


def bent_tab(w, s, u_start, u_flat, ri=0.9, H=5.0, up=False):
    """+X 방향으로 뻗다가(평평한 부분 u_start..u_flat) 90° 꺾이는 혀. 아래로(up=False) 또는 위로 꺾임. 폭 w(Y), 두께 s"""
    ro = ri + s
    a = np.radians(np.linspace(90, 0, 8))
    outer = [(u_flat + ro * math.cos(t) - 0.0, -ri + ro * math.sin(t)) for t in a]
    a2 = np.radians(np.linspace(0, 90, 8))
    inner = [(u_flat + ri * math.cos(t), -ri + ri * math.sin(t)) for t in a2]
    poly = [(u_start, s)] + [(u_flat, s)] + outer[1:] + [(u_flat + ro, -ri - H), (u_flat + ri, -ri - H)] + inner[:-1] + [(u_flat, 0), (u_start, 0)]
    poly = np.array(poly)
    # outer 첫 점 (u_flat, -ri+ro = s) 은 위에서 이미 넣었으므로 outer[1:]
    if up:
        poly[:, 1] = s - poly[:, 1]
    mesh = extrude(poly, -w / 2, w / 2)
    return mesh.rotx(90)


def _rotz_to(mesh, M, ref, az):
    """M(3x3)으로 놓은 메시를 돌려, 원래 방향 ref가 방위 az(도)를 향하게"""
    v = np.asarray(ref, float) @ M.T
    return mesh.rotz(az - math.degrees(math.atan2(v[1], v[0])))


# ── 이붙이 와셔 (톱니 와셔) ──────────────────────────────────────────────
def tooth_washer(kind, r_in, r_out, s, n=12, twist=18.0, w_root=3.4, w_tip=2.3, root=None):
    """kind 'A' = 바깥 톱니, 'J' = 안쪽 톱니. 톱니는 반지름 축을 중심으로 번갈아 ±twist 비틀림"""
    parts = []
    if kind == 'A':
        root = root or r_in + 2.1
        ring = tube(root + 0.6, r_in, 0.0, s, N=128, ch=0.12)
        u0, u1 = root - 0.2, r_out
        w0, w1 = w_root, w_tip
    else:
        root = root or r_out - 2.6
        ring = tube(r_out, root - 0.6, 0.0, s, N=128, ch=0.12)
        u0, u1 = root + 0.2, r_in
        w0, w1 = w_root, w_tip
    parts.append(ring)
    for k in range(n):
        ang = 360.0 / n * k + 360.0 / n / 2
        tw = twist if k % 2 == 0 else -twist
        c = 0.35
        tip = [(u1, -w1 / 2 + c), (u1, w1 / 2 - c)] if kind == 'A' else [(u1, w1 / 2 - c), (u1, -w1 / 2 + c)]
        if kind == 'A':
            ol = [(u0, -w0 / 2), (u1 - c, -w1 / 2), (u1, -w1 / 2 + c), (u1, w1 / 2 - c), (u1 - c, w1 / 2), (u0, w0 / 2)]
        else:
            ol = [(u0, -w0 / 2), (u0, w0 / 2), (u1 + c, w1 / 2), (u1, w1 / 2 - c), (u1, -w1 / 2 + c), (u1 + c, -w1 / 2)]
        t = extrude(np.array(ol), -s / 2, s / 2).rotx(tw).move(z=s / 2).rotz(ang)
        parts.append(t)
    return parts


@family('tooth')
def tooth_lock(fid):
    # 바깥 톱니 (DIN 6798 A, M12: 13 × 24) 와 안쪽 톱니 (DIN 6797 J: 12.4 × 23)
    A = tooth_washer('A', 6.5, 12.0, 1.0, n=12, twist=20, w_root=3.7, w_tip=2.5)
    J = tooth_washer('J', 6.2, 11.5, 0.8, n=12, twist=18, w_root=3.0, w_tip=1.7)
    m = bl.Model(fid)
    zA = -min(p.V[:, 2].min() for p in A)
    zJ = -min(p.V[:, 2].min() for p in J)
    for p in A:
        m.add(at(p.move(z=zA), right=-14, near=3), 'body', sharp=30)
    for p in J:
        m.add(at(p.move(z=zJ), right=13, near=-4), 'body', sharp=30)
    return m.view(el=42)


# ── 접시형 스프링 와셔 · 접시 스프링 ─────────────────────────────────────
def cone_ring(r1, r2, s, H, e=0.18, N=128):
    """원뿔 링: 바깥 모서리가 z=0, 안쪽 위 모서리가 H (전체 높이). 두께 s(면에 수직), 양 끝은 축과 평행한 원통면"""
    dr = r2 - r1
    lo, hi = 0.0, 1.2
    for _ in range(50):
        al = (lo + hi) / 2
        if dr * math.tan(al) + s / math.cos(al) < H:
            lo = al
        else:
            hi = al
    tv = s / math.cos(lo)
    rise = H - tv
    pts = [(r2, 0), (r2, tv), (r1, H), (r1, rise)]
    return lathe(chamfer_poly(pts, e), N)


@family('conical')
def conical_washer(fid):
    r1, r2, s, H = 6.5, 14.0, 2.5, 3.8      # DIN 6796 M12: 13 × 28 × 2.5, 높이 약 3.6~3.8
    c = cone_ring(r1, r2, s, H)
    m = bl.Model(fid)
    m.add(at(c, right=-16, near=6), 'body', sharp=30)
    m.add(at(ground(c.rotx(180)), right=16, near=-6), 'body', sharp=30)       # 뒤집은 것 (안쪽 모서리가 바닥)
    return m.view(el=22)


@family('disc')
def disc_spring(fid):
    r1, r2, s, H = 10.2, 20.0, 1.5, 3.05    # DIN 2093 B 40: 40 × 20.4 × 1.5, 자유 높이 3.05 (직렬 3장)
    c = cone_ring(r1, r2, s, H, e=0.2, N=144)
    f = c.rotx(180)
    f = f.move(z=-f.V[:, 2].min())
    m = bl.Model(fid)
    stack = [c, f.move(z=H), c.move(z=2 * H)]
    for st in stack:
        m.add(at(st, right=-19, near=-6), 'body', sharp=30)
    m.add(at(c, right=24, near=7), 'body', sharp=30)
    return m.view(el=22)


# ── 쐐기형 풀림방지 와셔 (2장 1조: 안쪽 면 방사형 캠, 바깥 면 방사형 톱니) ─────────
def cam_washer(r1, r2, tb, hcam, ncam=12, nrib=48, hrib=0.3, c=0.15):
    """바깥 면(아래)은 방사형 톱니, 안쪽 면(위)은 방사형 캠(완만한 경사 + 가파른 낙차). 바닥 톱니 끝 z=0"""
    f = np.arange(ncam)
    cam_th = np.concatenate([[(k + 0.02) / ncam, (k + 0.98) / ncam] for k in f])        # 주기 단위 (0..1)
    cam_z = np.tile([0.0, hcam], ncam)
    rib_th = np.arange(nrib * 2) / (nrib * 2)
    rib_z = np.tile([0.0, hrib], nrib)                                                    # 홈(0) / 산(hrib: 아래로 튀어나옴)
    th = np.unique(np.round(np.concatenate([cam_th, rib_th, [0.0]]), 9))
    ext_t = np.concatenate([cam_th - 1, cam_th, cam_th + 1])
    ext_z = np.tile(cam_z, 3)
    zc = np.interp(th, ext_t, ext_z)
    ext_t2 = np.concatenate([rib_th - 1, rib_th, rib_th + 1])
    zr = np.interp(th, ext_t2, np.tile(rib_z, 3))
    zb = hrib - zr                                                                        # 바닥: 산이 z=0, 홈이 hrib
    zt = hrib + tb + zc
    rows = []
    for t, b, u in zip(th, zb, zt):
        a = 2 * math.pi * t
        ca, sa = math.cos(a), math.sin(a)
        sec = [(r1 + c, b), (r2 - c, b), (r2, b + c), (r2, u - c), (r2 - c, u), (r1 + c, u), (r1, u - c), (r1, b + c)]
        rows.append([(r * ca, r * sa, z) for (r, z) in sec])
    return grid(np.array(rows), wrap=True, wrap_v=True).weld(1e-7)


@family('wedgelock')
def wedge_lock(fid):
    r1, r2, tb, hc, hr = 6.6, 12.7, 1.2, 0.9, 0.3
    w = cam_washer(r1, r2, tb, hc, hrib=hr)
    # 위 한 장: x축 둘레로 뒤집어(바깥 톱니가 위로) 아래 한 장의 캠과 맞물리게 얹는다 (캠 주기가 좌우 대칭이라 그대로 맞는다)
    Zs = 2 * (tb + hr) + hc + 0.06
    up = w.rotx(180).move(z=Zs)
    m = bl.Model(fid)
    m.add(at(w, right=-14, near=3), 'body', sharp=35)
    m.add(at(up, right=-14, near=3), 'body', sharp=35)
    m.add(at(w.rotz(15), right=15, near=-4), 'body', sharp=35)       # 캠 면이 위로 보이는 낱장
    return m.view(el=40)


# ── 직접 인장 지시 와셔 (DTI, ASTM F959) ─────────────────────────────────
@family('dti')
def dti_washer(fid):
    r1, r2, h = 10.3, 19.2, 4.0                      # 3/4": 안지름 20.6 × 바깥 38.4, 두께 4.0
    base = P.washer_mesh(2 * r1, 2 * r2, h, edge=0.3, N=160)
    n = 5
    rm = (r1 + r2) / 2 + 0.2
    bumps = []
    for k in range(n):
        a = 360.0 / n * k + 10
        bp = dome(1.0, 1.0, 0.0, N=40, n=10).scale(2.6, 4.4, 1.5).move(z=h - 0.55)
        bumps.append(bp.move(x=rm).rotz(a))
    m = bl.Model(fid)
    # 평평하게 놓은 것(돌기가 위)
    m.add(base, 'body', sharp=40)
    for b in bumps:
        m.add(b, 'body', sharp=40)
    # 세워 기댄 것(돌기 면이 앞)
    lean = lean_on([base] + bumps, h, r2, h, beta=22, psi=26)
    for q in lean:
        m.add(q, 'body', sharp=40)
    return m.view(el=40)


# ── 혀붙이 와셔 (DIN 93: 긴 혀 + 아래로 꺾인 짧은 혀) ─────────────────────
def tab_washer_mesh(R=13.0, Rh=6.5, s=1.0, long_len=13.0, long_w=11.0, nose_w=4.5, nose_h=5.0):
    out = ring_outline(R, [(0, long_w, long_len, 2.2)])
    flat = extrude(out, 0, s, holes=[circle2d(Rh, 72)])
    nose = bent_tab(nose_w, s, u_start=R - 0.4, u_flat=R + 1.8, ri=0.7, H=nose_h, up=False).rotz(180)
    return flat, nose


@family('tabw')
def tab_washer(fid):
    flat, nose = tab_washer_mesh()
    M = rest_rot(join(flat, nose).V)                       # 짧은 혀 끝과 긴 혀 끝 두 모서리로 놓인다
    fl, nz = flat.tf(M), nose.tf(M)
    z0 = min(fl.V[:, 2].min(), nz.V[:, 2].min())
    fl, nz = fl.move(z=-z0), nz.move(z=-z0)
    m = bl.Model(fid)
    for (az, rt, nr) in [(187, -15, 9), (5, 17, -10)]:
        for q in (fl, nz):
            m.add(at(_rotz_to(q, M, [1, 0, 0], az), right=rt, near=nr), 'body', sharp=35)
    return m.view(el=42)


# ── MB 베어링 로크와셔 (ISO 2982-2 / DIN 5406, MB5: M25) ────────────────────
def mb_washer(bent=False, s=1.25, Rb=12.5, Rr=16.0, tab_len=3.0, n=13, tab_w=4.3, nose_w=3.6, nose_len=2.0):
    k_bent = 3
    tabs = [(360.0 / n * k, tab_w, tab_len, 0.8) for k in range(n) if not (bent and k == k_bent)]
    out = ring_outline(Rr, tabs)
    hole = ring_outline(Rb, [(180.0, nose_w, -nose_len, 0.4)])
    flat = extrude(out, 0, s, holes=[hole])
    parts = [flat]
    if bent:
        ang = 360.0 / n * k_bent
        parts.append(bent_tab(tab_w, s, u_start=Rr - 0.5, u_flat=Rr + 0.9, ri=0.8, H=4.2, up=True).rotz(ang))
    return parts


@family('mbw')
def bearing_lock_washer(fid):
    flat = mb_washer(False)
    used = mb_washer(True)
    m = bl.Model(fid)
    for q in flat:
        m.add(at(q.rotz(20), right=-21, near=3), 'body', sharp=35)
    for q in used:
        m.add(at(q.rotz(-35), right=21, near=-4), 'body', sharp=35)
    return m.view(el=42)


# ── 실링 링 (DIN 7603 A 12×18×1.5, 구리·알루미늄) ──────────────────────────
@family('sealw', looks=['CU', 'AL', 'SS'])
def sealing_ring(fid):
    h = 1.5
    m = bl.Model(fid)
    _pile(m, lambda i: round_ring(6.0, 9.0, h, 0.3, N=128), h, n=3, psi=28, beta=20, twist=(0.5, 0.35))
    return m.view(el=40)


# ── 본디드 씰 (금속 와셔 + 안쪽에 붙은 고무) ──────────────────────────────
@family('bondseal')
def bonded_seal(fid):
    metal = round_ring(7.4, 10.0, 1.3, 0.25, N=128, z0=0.3)
    rubber = lathe(rr_profile(6.0, 7.9, 0.0, 1.9, 0.5, k=4), 128)
    m = bl.Model(fid)
    m.add(metal, 'body', sharp=35)
    m.add(rubber, 'rubber', sharp=35)
    lm, lr = lean_on([metal, rubber], 1.9, 10.0, 1.6, beta=22, psi=26)
    m.add(lm, 'body', sharp=35)
    m.add(lr, 'rubber', sharp=35)
    return m.view(el=40)
