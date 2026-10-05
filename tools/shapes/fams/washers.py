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
    """두께 h(z 0..h)인 얇은 판 mesh를 세워, 뒷면이 모서리(바깥 둘레 반지름 ex, 높이 ez)에 기대게 놓는다.
    beta = 판이 수직에서 눕는 각, psi = 놓이는 방위(도), center = 받치는 와셔 중심"""
    b = math.radians(beta)
    M = mesh.move(z=-h / 2).roty(90 - beta)
    tz = -M.V[:, 2].min()
    tx = (ex * math.cos(b) + ez * math.sin(b) - tz * math.sin(b) + h / 2) / math.cos(b)
    return M.move(tx, 0, tz).rotz(psi).move(center[0], center[1], 0)


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
    tabs = sorted(tabs)
    pts = []
    prev_end = None
    first_start = None
    segs = []
    for (phi, w, L, rr) in tabs:
        hw = w / 2
        dl = math.degrees(math.asin(hw / R))
        segs.append((phi - dl, phi + dl, phi, hw, L, rr))
    for k, (a0, a1, phi, hw, L, rr) in enumerate(segs):
        pa = segs[k - 1][1] - (360 if k == 0 else 0)
        n = max(2, int((a0 - pa) / step))
        for a in np.linspace(pa, a0, n, endpoint=False)[(1 if k > 0 else 0):] if False else np.linspace(pa, a0, n, endpoint=False):
            pts.append((R * math.cos(math.radians(a)), R * math.sin(math.radians(a))))
        u0 = math.sqrt(R * R - hw * hw)
        s = 1 if L >= 0 else -1
        ue = R + L
        rr = min(rr, hw, abs(L))
        loc = [(u0, -hw)]
        if rr > 1e-6:
            for t in np.linspace(-90, 0, 5):
                loc.append((ue - s * rr + s * rr * math.cos(math.radians(t)) if s > 0 else ue + rr - rr * math.cos(math.radians(t)),
                            -hw + rr + rr * math.sin(math.radians(t))))
            for t in np.linspace(0, 90, 5):
                loc.append((ue - s * rr + s * rr * math.cos(math.radians(t)) if s > 0 else ue + rr - rr * math.cos(math.radians(t)),
                            hw - rr + rr * math.sin(math.radians(t))))
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
def _pile(m, mk, h, n=2, lean=True, beta=22.0, psi=30.0, twist=(0.55, 0.3), r_edge=None):
    """바닥에 n장 겹쳐(약간 어긋나게) 놓고 한 장은 모서리에 기대 세운다. mk(i) → 메시(z 0..h)"""
    top = None
    cx = cy = 0.0
    for i in range(n):
        mesh = mk(i)
        dx, dy = (twist[0] * i * math.cos(i * 2.2 + 0.5), twist[1] * i * math.sin(i * 2.2 + 0.5))
        m.add(mesh.move(dx, dy, i * h), 'body', sharp=40)
        cx, cy = dx, dy
    if lean:
        mesh = mk(n)
        R = r_edge if r_edge else (mesh.V[:, 0] ** 2 + mesh.V[:, 1] ** 2).max() ** 0.5
        m.add(lean_on(mesh, h, R, n * h, beta, psi, (cx, cy)), 'body', sharp=40)
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
