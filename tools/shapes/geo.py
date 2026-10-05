"""체결부품 형상 라이브러리 (numpy). 길이 단위 mm. 부품 축은 +Z.

이 모듈은 Blender 없이 돌아갑니다 (mathutils는 압출 윤곽을 삼각형으로 나눌 때만 선택적으로 씁니다).
면의 감는 방향은 신경 쓰지 않습니다. Blender로 넘길 때 recalc_face_normals가 바깥쪽으로 맞춥니다.

  Mesh      꼭짓점 V (n,3), 사각형 Q (m,4), 삼각형 T (k,3)
  grid      (nu, nv, 3) 격자 → 사각형 메시
  lathe     (r, z) 윤곽을 Z축 둘레로 돌린 회전체
  thread_*  나사산 (나선 높이장): 수나사 봉, 암나사 구멍
  polybody  둥근 모서리 다각 기둥 + 30° 모따기 (육각 머리·너트·사각 너트)
  extrude   2D 윤곽(구멍 포함) 압출
  sweep     단면을 경로를 따라 쓸기 (철사·스프링·U볼트)
"""
import math
import numpy as np

TAU = 2 * math.pi


class Mesh:
    def __init__(self, V=None, Q=None, T=None):
        self.V = np.zeros((0, 3)) if V is None else np.asarray(V, float).reshape(-1, 3)
        self.Q = np.zeros((0, 4), int) if Q is None else np.asarray(Q, int).reshape(-1, 4)
        self.T = np.zeros((0, 3), int) if T is None else np.asarray(T, int).reshape(-1, 3)

    def copy(self):
        return Mesh(self.V.copy(), self.Q.copy(), self.T.copy())

    def __add__(self, o):
        n = len(self.V)
        return Mesh(np.vstack([self.V, o.V]), np.vstack([self.Q, o.Q + n]), np.vstack([self.T, o.T + n]))

    def tf(self, M):
        """4x4 행렬(또는 3x3)로 변환한 새 메시"""
        M = np.asarray(M, float)
        V = self.V @ M[:3, :3].T + (M[:3, 3] if M.shape == (4, 4) else 0)
        return Mesh(V, self.Q, self.T)

    def move(self, x=0, y=0, z=0):
        return Mesh(self.V + np.array([x, y, z], float), self.Q, self.T)

    def scale(self, sx, sy=None, sz=None):
        sy = sx if sy is None else sy
        sz = sx if sz is None else sz
        return Mesh(self.V * np.array([sx, sy, sz], float), self.Q, self.T)

    def rotx(self, deg):
        return self.tf(rot_x(deg))

    def roty(self, deg):
        return self.tf(rot_y(deg))

    def rotz(self, deg):
        return self.tf(rot_z(deg))

    def weld(self, eps=1e-6):
        """겹친 꼭짓점을 합치고 찌그러진 면(사각형→삼각형, 삼각형→없음)을 정리"""
        if not len(self.V):
            return self
        key = np.round(self.V / eps).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        V = self.V[first]
        Q = inv[self.Q] if len(self.Q) else self.Q
        T = inv[self.T] if len(self.T) else self.T
        tris = [T] if len(T) else []
        if len(Q):
            a, b, c, d = Q.T
            ab, bc, cd, da, ac, bd = a == b, b == c, c == d, d == a, a == c, b == d
            bad = ab | bc | cd | da | ac | bd
            ok = Q[~bad]
            # 이웃한 두 꼭짓점이 같으면 삼각형으로
            t1 = Q[ab & ~(bc | cd | da | ac | bd)][:, [0, 2, 3]]
            t2 = Q[bc & ~(ab | cd | da | ac | bd)][:, [0, 1, 3]]
            t3 = Q[(cd | da) & ~(ab | bc | ac | bd)][:, [0, 1, 2]]
            tris += [t1, t2, t3]
            Q = ok
        T = np.vstack(tris) if tris else np.zeros((0, 3), int)
        if len(T):
            keep = (T[:, 0] != T[:, 1]) & (T[:, 1] != T[:, 2]) & (T[:, 0] != T[:, 2])
            T = T[keep]
        return Mesh(V, Q, T)

    def bbox(self):
        return self.V.min(0), self.V.max(0)

    def volume(self):
        """부호 있는 부피 (닫힌 메시 점검용; 감는 방향이 섞이면 의미 없음)"""
        V = self.V
        t = [self.T] if len(self.T) else []
        if len(self.Q):
            t += [self.Q[:, [0, 1, 2]], self.Q[:, [0, 2, 3]]]
        if not t:
            return 0.0
        T = np.vstack(t)
        return float(np.einsum('ij,ij->i', V[T[:, 0]], np.cross(V[T[:, 1]], V[T[:, 2]])).sum() / 6)


def join(*meshes):
    out = Mesh()
    for m in meshes:
        out = out + m
    return out


def rot_x(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], float)


def rot_y(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], float)


def rot_z(deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], float)


def grid(P, wrap=False, wrap_v=False):
    """(nu, nv, 3) 점 격자 → 사각형 메시. wrap = u 방향이 한 바퀴(Z축 둘레)"""
    nu, nv = P.shape[:2]
    idx = np.arange(nu * nv).reshape(nu, nv)
    i0 = idx if wrap else idx[:-1]
    i1 = np.roll(idx, -1, axis=0) if wrap else idx[1:]
    if wrap_v:
        a, b = i0, i1
        c, d = np.roll(i1, -1, axis=1), np.roll(i0, -1, axis=1)
    else:
        a, b, c, d = i0[:, :-1], i1[:, :-1], i1[:, 1:], i0[:, 1:]
    Q = np.stack([a.ravel(), b.ravel(), c.ravel(), d.ravel()], 1)
    return Mesh(P.reshape(-1, 3), Q)


def theta(N, th0=0.0):
    return th0 + np.arange(N) * TAU / N


# ── 회전체 ───────────────────────────────────────────────────────────────
def lathe(profile, N=96, th0=0.0, rmod=None):
    """profile: [(r, z), ...] (r=0이면 축 위). rmod(th, r, z) → 반지름을 θ에 따라 바꿈 (널링·톱니)"""
    prof = np.asarray(profile, float).reshape(-1, 2)
    th = theta(N, th0)[:, None]
    r = np.broadcast_to(prof[:, 0][None, :], (N, len(prof))).copy()
    z = np.broadcast_to(prof[:, 1][None, :], (N, len(prof)))
    if rmod is not None:
        r = np.where(r > 1e-9, rmod(th, r, z), r)
    P = np.stack([r * np.cos(th), r * np.sin(th), z], -1)
    return grid(P, wrap=True).weld()


def cyl(r, z0, z1, N=96, ch0=0.0, ch1=0.0, cap=True):
    """원기둥 (끝 모따기 ch0/ch1)"""
    pr = []
    if cap:
        pr.append((0, z0))
    pr += [(r - ch0, z0), (r, z0 + ch0)] if ch0 else [(r, z0)]
    pr += [(r, z1 - ch1), (r - ch1, z1)] if ch1 else [(r, z1)]
    if cap:
        pr.append((0, z1))
    return lathe(pr, N)


def tube(ro, ri, z0, z1, N=96, ch=0.0):
    pr = [(ri + ch, z0), (ro - ch, z0), (ro, z0 + ch), (ro, z1 - ch), (ro - ch, z1), (ri + ch, z1), (ri, z1 - ch), (ri, z0 + ch)]
    pr = [p for i, p in enumerate(pr) if i == 0 or p != pr[i - 1]]
    pr.append(pr[0])
    return lathe(pr, N)


def torus(R, r, N=72, n=20, z=0.0):
    t = np.linspace(0, TAU, n, endpoint=False)
    pr = [(R + r * math.cos(a), z + r * math.sin(a)) for a in t]
    return lathe(pr + [pr[0]], N)


def sphere(r, N=48, z=0.0):
    a = np.linspace(-math.pi / 2, math.pi / 2, N // 2 + 1)
    return lathe([(max(r * math.cos(t), 0), z + r * math.sin(t)) for t in a], N)


def dome(r, h, z0=0.0, N=96, n=16):
    """바닥 지름 2r, 높이 h의 둥근 지붕 (타원 단면)"""
    a = np.linspace(0, math.pi / 2, n)
    pr = [(0, z0)] + [(r * math.cos(t), z0 + h * math.sin(t)) for t in a]
    pr[-1] = (0, z0 + h)
    return lathe(pr, N)


# ── 나사산 ───────────────────────────────────────────────────────────────
def _prof(t, wc=0.1, wr=0.2):
    """나사 한 피치의 단면 (1 = 산 꼭대기, 0 = 골). t는 0..1 위상. 약간 둥글린 사다리꼴"""
    wf = (1 - wc - wr) / 2
    t = (t + wc / 2) % 1.0
    f = np.where(t < wc, 1.0,
        np.where(t < wc + wf, 1 - (t - wc) / wf,
        np.where(t < wc + wf + wr, 0.0, (t - wc - wf - wr) / wf)))
    s = f * f * (3 - 2 * f)
    return 0.5 * f + 0.5 * s


def thread_rod(d, P, z0, z1, N=64, spp=20, tip0=True, tip1=True, depth=None, ph=0.0, rootr=None, lead=45.0, cap=True, hand=1):
    """수나사 봉. 바깥 지름 d, 피치 P, z0→z1. 끝은 45° 모따기 (tip0/tip1). 산이 모따기에 잘리며 끝나는 모양"""
    R = d / 2
    h = 0.6 * P if depth is None else depth
    nz = max(8, int(round((z1 - z0) / P * spp)) + 1)
    zs = np.linspace(z0, z1, nz)
    th = theta(N)[:, None]
    t = ((zs[None, :] - z0) / P - hand * th / TAU + ph) % 1.0
    r = R - h * (1 - _prof(t, 0.1, 0.2))
    rtip = (R - h) - 0.12 * P if rootr is None else rootr
    k = math.tan(math.radians(lead))
    if tip0:
        r = np.minimum(r, rtip + (zs[None, :] - z0) * k)
    if tip1:
        r = np.minimum(r, rtip + (z1 - zs[None, :]) * k)
    if cap:
        r = np.concatenate([np.zeros((N, 1)), r, np.zeros((N, 1))], 1)
        zz = np.concatenate([[z0], zs, [z1]])
    else:
        zz = zs
    P3 = np.stack([r * np.cos(th), r * np.sin(th), np.broadcast_to(zz[None, :], r.shape)], -1)
    return grid(P3, wrap=True).weld()


def thread_bore(D, P, z0, z1, N=192, spp=16, rc=None, csk0=True, csk1=True, depth=None, ph=0.0, hand=1):
    """암나사 구멍 (재료 쪽에서 본 안쪽 면). 호칭 D, z0→z1. 양 끝은 45° 카운터싱크 (지름 rc에서 시작)"""
    R = D / 2
    h = 0.55 * P if depth is None else depth
    rc = R + 0.15 * P if rc is None else rc
    nz = max(8, int(round((z1 - z0) / P * spp)) + 1)
    zs = np.linspace(z0, z1, nz)
    th = theta(N)[:, None]
    t = ((zs[None, :] - z0) / P - hand * th / TAU + ph) % 1.0
    r = R - h * _prof(t, 0.25, 0.125)              # 암나사: 안쪽 산(작은 지름 D1) 폭 P/4, 골(큰 지름) 폭 P/8
    if csk0:
        r = np.maximum(r, rc - (zs[None, :] - z0))
    if csk1:
        r = np.maximum(r, rc - (z1 - zs[None, :]))
    P3 = np.stack([r * np.cos(th), r * np.sin(th), np.broadcast_to(zs[None, :], r.shape)], -1)
    return grid(P3, wrap=True)


# ── 둥근 모서리 다각 기둥 ────────────────────────────────────────────────
def rpoly_r(th, n, s, rho=0.0, th0=None):
    """맞변 s인 정n각형(모서리 반지름 rho)의 극좌표 반지름 r(θ). 평면 법선 방향 = th0 + k·2π/n (기본: 꼭짓점이 θ=30° (n=6))"""
    th = np.asarray(th, float)
    a = TAU / n
    if th0 is None:
        th0 = 0.0                                     # 평면 법선이 0°, 360/n°… (육각이면 꼭짓점이 30°, 90°…)
    u = np.mod(th - th0 + a / 2, a) - a / 2          # 가장 가까운 평면 법선에서의 각도 (−a/2..a/2)
    ap = s / 2
    r_flat = ap / np.cos(u)
    if rho <= 0:
        return r_flat
    # 모서리 둥글림: 안쪽 다각형(맞변 s−2ρ) 꼭짓점을 중심으로 반지름 ρ 원
    ai = ap - rho
    half = ai * math.tan(a / 2)                       # 평면의 직선 구간 반 길이
    tang = r_flat * np.sin(np.abs(u))                 # 평면 위 접선 좌표
    corner = np.where(u >= 0, 1, -1)
    cx = ai                                            # 모서리 중심 (평면 좌표계): (ai, ±half)
    cy = half * corner
    # 광선 (cos u, sin u) 와 원 (cx, cy, ρ) 의 교점
    dx, dy = np.cos(u), np.sin(u)
    b = dx * cx + dy * cy
    disc = np.maximum(rho * rho - (cx * cx + cy * cy) + b * b, 0)
    r_c = b + np.sqrt(disc)
    return np.where(tang <= half, r_flat, r_c)


def polybody(n, s, z0, z1, rc_top=None, rc_bot=None, hole_top=None, hole_bot=None, rho=None, ch_deg=30.0, N=None, th0=None, rings=None):
    """둥근 모서리 n각 기둥 (z0..z1). 윗면·아랫면은 30° 모따기 원뿔 (rc = 모따기 시작 원 반지름, None이면 모따기 없음).
    hole_top/hole_bot 반지름을 주면 그 지름의 구멍 고리 (None이면 막힌 면). 구멍 가장자리는 열려 있으니 thread_bore와 weld"""
    N = N or (192 if n == 6 else 48 * n)
    N = (N // (2 * n)) * 2 * n
    rho = 0.035 * s if rho is None else rho
    th = theta(N)
    rp = rpoly_r(th, n, s, rho, th0)
    tn = math.tan(math.radians(ch_deg))

    def ring(r, z):
        return np.stack([r * np.cos(th), r * np.sin(th), np.broadcast_to(z, th.shape)], -1)

    rows = []
    if rc_top is not None:
        zc = z1 - np.maximum(rp - rc_top, 0) * tn
        rows_top = [(np.full(N, rc_top), np.full(N, z1)), (rp, zc)]
    else:
        rows_top = [(rp, np.full(N, z1))]
    if rc_bot is not None:
        zc2 = z0 + np.maximum(rp - rc_bot, 0) * tn
        rows_bot = [(rp, zc2), (np.full(N, rc_bot), np.full(N, z0))]
    else:
        rows_bot = [(rp, np.full(N, z0))]
    seq = []
    if hole_top is None:
        seq.append((np.zeros(N), np.full(N, z1)))
    else:
        seq.append((np.full(N, hole_top), np.full(N, z1)))
    seq += rows_top + rows_bot
    seq.append((np.zeros(N), np.full(N, z0)) if hole_bot is None else (np.full(N, hole_bot), np.full(N, z0)))
    # 구멍 고리와 첫 모따기 원이 같은 높이에서 겹치면(hole==rc) 중복 줄은 weld가 정리
    P3 = np.stack([np.stack([r * np.cos(th), r * np.sin(th), z], -1) for r, z in seq], 1)
    return grid(P3, wrap=True).weld()


# ── 압출 · 쓸기 ──────────────────────────────────────────────────────────
def _tess(outline, holes=()):
    """2D 윤곽(+구멍) 삼각분할 → (점 (n,2), 삼각형 (k,3)). mathutils.geometry.tessellate_polygon 사용"""
    from mathutils import Vector, geometry
    loops = [np.asarray(outline, float)] + [np.asarray(h, float) for h in holes]
    pts = np.vstack(loops)
    polys = [[Vector((p[0], p[1], 0.0)) for p in lp] for lp in loops]
    tris = geometry.tessellate_polygon(polys)
    return pts, np.asarray(tris, int).reshape(-1, 3)


def extrude(outline, z0, z1, holes=(), tess=None):
    """2D 윤곽(반시계, 구멍은 시계 아님 상관없음)을 z0..z1로 압출. 옆면은 윤곽·구멍 모두"""
    outline = np.asarray(outline, float)
    holes = [np.asarray(h, float) for h in holes]
    pts, tri = tess or _tess(outline, holes)
    n = len(pts)
    V = np.vstack([np.c_[pts, np.full(n, z0)], np.c_[pts, np.full(n, z1)]])
    T = np.vstack([tri, tri + n])
    Q = []
    off = 0
    for lp in [outline] + holes:
        m = len(lp)
        for i in range(m):
            a, b = off + i, off + (i + 1) % m
            Q.append([a, b, b + n, a + n])
        off += m
    return Mesh(V, np.array(Q, int), T).weld(1e-7)


def circle2d(r, N=64, cx=0.0, cy=0.0, a0=0.0, a1=TAU, endpoint=False):
    a = np.linspace(a0, a1, N, endpoint=endpoint)
    return np.c_[cx + r * np.cos(a), cy + r * np.sin(a)]


def rect2d(w, h, cx=0.0, cy=0.0, r=0.0, n=6):
    """둥근 모서리 사각형 윤곽"""
    if r <= 0:
        return np.array([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]])
    r = min(r, w / 2, h / 2)
    pts = []
    for (sx, sy, a0) in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
        for a in np.linspace(a0, a0 + 90, n):
            pts.append([cx + sx * (w / 2 - r) + r * math.cos(math.radians(a)) * 1, cy + sy * (h / 2 - r) + r * math.sin(math.radians(a)) * 1])
    # sx, sy는 모서리 위치만; 호는 각 모서리에서 바깥쪽으로
    pts = []
    for (qx, qy, a0) in [(1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)]:
        ccx, ccy = cx + qx * (w / 2 - r), cy + qy * (h / 2 - r)
        for a in np.linspace(a0, a0 + 90, n):
            pts.append([ccx + r * math.cos(math.radians(a)), ccy + r * math.sin(math.radians(a))])
    return np.array(pts)


def stadium2d(L, w, cx=0.0, cy=0.0, n=14):
    """양 끝이 반원인 길쭉한 윤곽 (길이 L 전체, 폭 w), X축 방향"""
    r = w / 2
    pts = []
    for a in np.linspace(-90, 90, n):
        pts.append([cx + L / 2 - r + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))])
    for a in np.linspace(90, 270, n):
        pts.append([cx - L / 2 + r + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))])
    return np.array(pts)


def sweep(path, section, closed=False, cap=True, up=(0, 0, 1), scale=None):
    """section (m,2) 단면을 path (n,3) 따라 쓸기. 단면 x = 경로의 법선, y = 종법선.
    scale: 길이 n 배열이면 점마다 단면 배율"""
    path = np.asarray(path, float)
    sec = np.asarray(section, float)
    n, m = len(path), len(sec)
    tang = np.gradient(path, axis=0)
    if closed:
        tang = np.roll(path, -1, 0) - np.roll(path, 1, 0)
    tang /= np.linalg.norm(tang, axis=1)[:, None]
    up = np.asarray(up, float)
    N = np.zeros((n, 3)); B = np.zeros((n, 3))
    t0 = tang[0]
    nn = np.cross(up, t0)
    if np.linalg.norm(nn) < 1e-6:
        nn = np.cross((1, 0, 0), t0)
    nn /= np.linalg.norm(nn)
    N[0] = nn
    B[0] = np.cross(t0, nn)
    for i in range(1, n):          # 평행 이동 틀
        v = np.cross(tang[i - 1], tang[i])
        s = np.linalg.norm(v)
        if s < 1e-9:
            N[i], B[i] = N[i - 1], B[i - 1]
        else:
            v /= s
            ang = math.asin(min(1, s))
            c, sn = math.cos(ang), math.sin(ang)
            def rodr(x):
                return x * c + np.cross(v, x) * sn + v * np.dot(v, x) * (1 - c)
            N[i], B[i] = rodr(N[i - 1]), rodr(B[i - 1])
    sc = np.ones(n) if scale is None else np.asarray(scale, float)
    P = path[:, None, :] + sc[:, None, None] * (sec[None, :, 0:1] * N[:, None, :] + sec[None, :, 1:2] * B[:, None, :])
    ms = grid(P, wrap=closed, wrap_v=True)
    if cap and not closed:
        c0 = Mesh(np.vstack([P[0], path[:1]]), None, np.array([[i, (i + 1) % m, m] for i in range(m)]))
        c1 = Mesh(np.vstack([P[-1], path[-1:]]), None, np.array([[i, (i + 1) % m, m] for i in range(m)]))
        ms = ms + c0 + c1
    return ms.weld(1e-7)


def wire(path, r, closed=False, cap=True, n=12, **kw):
    """둥근 철사"""
    return sweep(path, circle2d(r, n), closed=closed, cap=cap, **kw)


def helix(R, pitch, turns, n_per=48, z0=0.0, a0=0.0):
    n = int(turns * n_per) + 1
    a = a0 + np.linspace(0, turns * TAU, n)
    return np.c_[R * np.cos(a), R * np.sin(a), z0 + pitch * a / TAU]


def arc3(R, a0, a1, n=48, z=0.0, cx=0.0, cy=0.0):
    a = np.radians(np.linspace(a0, a1, n))
    return np.c_[cx + R * np.cos(a), cy + R * np.sin(a), np.full(n, z)]


def box(sx, sy, sz, r=0.0, rb=None, cx=0, cy=0, cz=0, n=5):
    """중심 (cx,cy,cz) 직육면체. r = 세로 모서리 반지름, rb = 윗·아랫 모서리 둥글림 (기본 r)"""
    if r <= 0 and not rb:
        return extrude(rect2d(sx, sy), -sz / 2, sz / 2).move(cx, cy, cz)
    r = min(r, sx / 2, sy / 2)
    rb = r if rb is None else rb
    rb = min(rb, sz / 2, sx / 2, sy / 2)
    ang = np.radians(np.linspace(90, 0, n))
    lv = [(-sz / 2 + rb * (1 - math.sin(a)), rb * (1 - math.cos(a))) for a in ang]
    lv += [(sz / 2 - rb * (1 - math.sin(a)), rb * (1 - math.cos(a))) for a in ang[::-1]]
    rings = []
    for z, ins in lv:
        o = rect2d(sx - 2 * ins, sy - 2 * ins, r=max(r - ins, 1e-3), n=max(n, 4))
        rings.append(np.c_[o, np.full(len(o), z)])
    body = grid(np.stack(rings, 1), wrap=True)
    caps = Mesh()
    for ring in (rings[0], rings[-1]):
        m = len(ring)
        caps = caps + Mesh(np.vstack([ring, [[0, 0, ring[0, 2]]]]), None, [[i, (i + 1) % m, m] for i in range(m)])
    return (body + caps).weld(1e-7).move(cx, cy, cz)
