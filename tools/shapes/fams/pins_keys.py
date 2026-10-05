"""핀·멈춤링·키 계열 빌더 (평행핀·테이퍼핀·스프링핀·그루브핀·분할핀·클레비스핀·R핀 · C/E형 멈춤링 · 키).

핀·키는 연삭·열처리 면이라 룩을 PL(무처리)·SS·BO … 로 고정해 둡니다.
모든 핀은 축이 +Z인 채로 만들고(`lay()`가 바닥에 눕힘), 납작한 것(멈춤링·키)은 바닥(xy)에 놓은 채 만듭니다.
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import *

YAW = 68.0          # 핀이 화면 오른쪽으로 눕는 방위(도). 클수록 +Z 끝(큰 쪽·머리)이 카메라 쪽을 향함


# ═══════════════════════════════════════════════════════════════════════
# 보조 함수
# ═══════════════════════════════════════════════════════════════════════
class Item:
    """한 개의 물건 = (메시, 재질, 옵션) 목록. lay()로 장면에 놓는다. marks = 놓은 뒤 좌표를 알고 싶은 점들"""

    def __init__(self):
        self.parts = []
        self.marks = {}

    def add(self, mesh, mat='body', **kw):
        self.parts.append((mesh, mat, kw))
        return self


class Placed(list):
    marks = None


def _xf(mesh, roll, tilt, s, d, yaw, lift=0.0):
    mm = mesh.rotz(roll) if roll else mesh
    return mm.roty(-90 + tilt).move(x=s, y=d, z=lift).rotz(yaw)


def lay(item, s=0.0, d=0.0, yaw=YAW, roll=0.0, tilt=0.0):
    """축이 +Z인 물건을 바닥에 눕혀 (mesh, mat, kw) 목록으로 돌려준다 (가장 낮은 점이 z=0이 되도록 자동으로 올림).
    s = 끝쪽(−Z) 방향 이동, d = 옆(카메라 반대쪽이 +) 이동 (둘 다 yaw 방향 틀 기준),
    roll = 축 둘레 회전(도), tilt = 옆축 둘레 기울임(도, +이면 +Z끝이 위로).  yaw: 끝(−Z)이 향하는 방위(도)"""
    z0 = min(_xf(mesh, roll, tilt, s, d, yaw).V[:, 2].min() for mesh, _, _ in item.parts)
    out = Placed()
    for mesh, mat, kw in item.parts:
        kw = dict(kw)
        if kw.get('cut'):
            kw['cut'] = [_xf(c, roll, tilt, s, d, yaw, -z0) for c in kw['cut']]
        out.append((_xf(mesh, roll, tilt, s, d, yaw, -z0), mat, kw))
    out.marks = {k: _xf(Mesh(np.array([v], float)), roll, tilt, s, d, yaw, -z0).V[0] for k, v in item.marks.items()}
    return out


def stand(item, x=0.0, y=0.0, yaw=0.0):
    """축이 +Z인 물건을 바닥에 세운다 (z=0에서 시작한다고 가정). yaw = 제자리 회전(도)"""
    out = Placed()
    for mesh, mat, kw in item.parts:
        kw = dict(kw)
        if kw.get('cut'):
            kw['cut'] = [c.rotz(yaw).move(x, y) for c in kw['cut']]
        out.append((mesh.rotz(yaw).move(x, y), mat, kw))
    return out


def rest_tilt(Rh, r, Ls, hh=0.0):
    """머리 반지름 Rh > 몸통 반지름 r 인 핀이 머리 가장자리와 끝에서 동시에 바닥에 닿도록 하는 기울임(도)"""
    return math.degrees(math.atan2(Rh - r, Ls + hh / 2))


def put(m, placed):
    for mesh, mat, kw in placed:
        m.add(mesh, mat, **kw)
    return m


def at(mesh, x=0.0, y=0.0, z=0.0, yaw=0.0):
    """바닥에 놓인 납작한 메시를 제자리 회전(yaw) 후 이동"""
    return mesh.rotz(yaw).move(x, y, z) if yaw else mesh.move(x, y, z)


def lathe_part(profile, a0, a1, n=48):
    """부분 회전체: 닫힌 (r, z) 고리를 각 a0→a1(도)만 돌리고 양 끝은 평면 마개로 막음 (볼록 단면 한정)"""
    prof = np.asarray(profile, float)
    th = np.radians(np.linspace(a0, a1, n))[:, None]
    r = prof[:, 0][None, :] * np.ones((n, 1))
    z = prof[:, 1][None, :] * np.ones((n, 1))
    P3 = np.stack([r * np.cos(th), r * np.sin(th), z], -1)
    body = grid(P3, wrap=False, wrap_v=True)
    caps = Mesh()
    for ring in (P3[0], P3[-1]):
        c = ring.mean(0)
        k = len(ring)
        caps = caps + Mesh(np.vstack([ring, [c]]), None, [[i, (i + 1) % k, k] for i in range(k)])
    return (body + caps).weld(1e-7)


# 끝 모양 (축 → 바깥으로 (r, 끝면에서 안쪽으로의 깊이 dz) 목록)
def e_flat(c):
    return lambda r: [(0, 0), (max(r - c, 0), 0), (r, c)]


def e_round(c, n=8):
    def f(r):
        pts = [(0, 0), (r - c, 0)]
        for i in range(1, n + 1):
            a = math.pi / 2 * i / n
            pts.append((r - c + c * math.sin(a), c - c * math.cos(a)))
        return pts
    return f


def e_crown(sag, e=0.0, n=8):
    """얕은 구면 지붕(가장자리에서 sag만큼 솟음) + 작은 모따기 e"""
    def f(r):
        xe = r - e
        Rs = (xe * xe + sag * sag) / (2 * sag)
        pts = []
        for x in np.linspace(0, xe, n):
            pts.append((x, -(sag - (Rs - math.sqrt(Rs * Rs - x * x)))))
        if e > 0:
            pts.append((r, e))
        return pts
    return f


def e_dome(h, n=12):
    """둥근 머리: 높이 h, 가장자리에서 수직 (타원 지붕)"""
    def f(r):
        pts = []
        for a in np.linspace(0, math.pi / 2, n):
            pts.append((r * math.sin(a), -(h * math.cos(a)) + 0.0))
        pts[0] = (0, -h)
        pts[-1] = (r, 0)
        return pts
    return f


def lathe_pin(r0, r1, L, end0, end1, z0=0.0, N=96, rmod=None, extra=None):
    """회전체 핀. z0(아래 끝, 반지름 r0) → z0+L(위 끝, 반지름 r1). end0/end1 = e_*() 끝 모양"""
    b = [(r, z0 + dz) for r, dz in end0(r0)]
    t = [(r, z0 + L - dz) for r, dz in end1(r1)][::-1]
    pr = b + (extra or []) + t
    return lathe(pr, N, rmod=rmod)


def blind_thread(D, pitch, depth, z_top, N=96):
    """위(z_top)에서 depth만큼 판 막힌 암나사. (구멍 가장자리 반지름, 메시) — 가장자리는 몸체 회전체의 열린 가장자리와 붙는다"""
    rc = D / 2 + 0.15 * pitch
    zb = z_top - depth
    bore = thread_bore(D, pitch, zb, z_top, N=N, csk0=False, csk1=True)
    ring = bore.V[np.isclose(bore.V[:, 2], zb)]
    c = np.array([0, 0, zb - 0.35 * D / 2])
    k = len(ring)
    cap = Mesh(np.vstack([ring, [c]]), None, [[i, (i + 1) % k, k] for i in range(k)])
    return rc, bore + cap


# ═══════════════════════════════════════════════════════════════════════
# 평행핀 · 인치핀 · 테이퍼핀
# ═══════════════════════════════════════════════════════════════════════
def dowel_h_item(d, L):
    it = Item()
    it.add(lathe_pin(d / 2, d / 2, L, e_round(0.17 * d), e_round(0.17 * d)), 'body', sharp=40)
    return it


def dowel_u_item(d, L):
    it = Item()
    it.add(lathe_pin(d / 2, d / 2, L, e_flat(0.12 * d), e_flat(0.12 * d)), 'body', sharp=30)
    return it


def dowel_it_item(d, L, M, pitch, depth, hardened=True):
    """암나사 평행핀: 아래 끝은 둥근 크라운(경화형)·모따기, 위 끝에 막힌 암나사"""
    r = d / 2
    rc, bore = blind_thread(M, pitch, depth, L)
    b = [(rr, dz) for rr, dz in (e_crown(0.08 * d, 0.08 * d) if hardened else e_flat(0.1 * d))(r)]
    prof = b + [(r, L - 0.1 * d), (r - 0.1 * d, L), (rc, L)]
    body = lathe(prof, 96)
    it = Item()
    it.add(body + bore, 'body', sharp=35)
    return it


def taper_item(d, L, e0=None, e1=None, thread_in=None, thread_out=None, k=1 / 50.0):
    """테이퍼 핀 (1:50). 작은 끝 z=0, 큰 끝 z=L. d = 작은 끝 지름.
    thread_in=(M, pitch, depth): 큰 끝에 암나사. thread_out=(M, pitch, len): 작은 끝에 수나사 토막"""
    r0, r1 = d / 2, d / 2 + L * k / 2
    it = Item()
    e0 = e0 or e_crown(0.06 * d + 0.3, 0.04 * d)
    e1 = e1 or e_crown(0.06 * d + 0.3, 0.04 * d)
    if thread_in:
        M, pt, dep = thread_in
        rc, bore = blind_thread(M, pt, dep, L)
        b = [(r, dz) for r, dz in e0(r0)]
        prof = b + [(r1, L - 0.08 * d), (r1 - 0.08 * d, L), (rc, L)]
        it.add(lathe(prof, 96) + bore, 'body', sharp=35)
    else:
        it.add(lathe_pin(r0, r1, L, e0, e1), 'body', sharp=35)
    if thread_out:
        M, pt, ln = thread_out
        it.add(thread_rod(M, pt, -ln, 1.5, N=64, tip0=True, tip1=False), 'body', sharp=40)
    return it


@family('dowel-h', looks=['PL', 'SS'])
def f_dowel_h(fid):
    m = bl.Model(fid)
    put(m, lay(dowel_h_item(10, 32), s=-4, d=-1, yaw=YAW + 2))
    put(m, lay(dowel_h_item(8, 24), s=2, d=15, yaw=YAW - 6))
    put(m, lay(dowel_h_item(6, 18), s=8, d=29, yaw=YAW - 12))
    return m.view(el=26)


@family('dowel-u', looks=['PL', 'BO', 'ZW', 'PH', 'SS'])
def f_dowel_u(fid):
    m = bl.Model(fid)
    put(m, lay(dowel_u_item(10, 32), s=-4, d=-1, yaw=YAW + 2))
    put(m, lay(dowel_u_item(8, 24), s=2, d=15, yaw=YAW - 6))
    put(m, lay(dowel_u_item(6, 18), s=8, d=29, yaw=YAW - 12))
    return m.view(el=26)


@family('dowel-it', looks=['PL', 'BO', 'SS'])
def f_dowel_it(fid):
    m = bl.Model(fid)
    put(m, lay(dowel_it_item(12, 36, 6, 1.0, 14, hardened=True), s=-2, d=0, yaw=94))
    put(m, lay(dowel_it_item(16, 40, 8, 1.25, 18, hardened=False), s=3, d=-25, yaw=88))
    return m.view(el=30)


@family('taper', looks=['PL', 'BO', 'ZW', 'PH', 'SS'])
def f_taper(fid):
    m = bl.Model(fid)
    put(m, lay(taper_item(5, 46), s=0, d=0, yaw=YAW + 10))
    put(m, lay(taper_item(8, 32), s=8, d=-14, yaw=YAW + 2))
    return m.view(el=28)


@family('taper-th', looks=['PL', 'BO', 'ZW', 'PH'])
def f_taper_th(fid):
    m = bl.Model(fid)
    # 암나사형(큰 끝 구멍이 카메라 쪽) + 수나사형(작은 끝 나사)
    put(m, lay(taper_item(10, 50, thread_in=(5, 0.8, 14)), s=0, d=0, yaw=95))
    put(m, lay(taper_item(10, 50, thread_out=(6, 1.0, 14)), s=14, d=-25, yaw=78))
    return m.view(el=28)


# ═══════════════════════════════════════════════════════════════════════
# 분할 테이퍼 핀 · 스프링핀 · 그루브핀
# ═══════════════════════════════════════════════════════════════════════
def split_taper_item(d, L, split=14.0, spread=12.0, k=1 / 50.0):
    """분할 테이퍼 핀: 작은 끝(z=0)이 갈라져 벌어진 모양. 벌어지는 면 = xz 평면"""
    r0 = d / 2
    rz = lambda z: r0 + z * k / 2
    c = 0.05 * d
    it = Item()
    # 갈라지지 않은 몸통 (split → L)
    prof = [(0, split), (rz(split), split), (rz(L - c), L - c), (rz(L) - c, L), (0, L)]
    it.add(lathe(prof, 96), 'body', sharp=35)
    # 두 갈래: D단면 테이퍼 반쪽, 뿌리(z=split)를 축으로 바깥으로 젖힘
    hp = [(0, 0), (rz(0) - c, 0), (rz(0), c), (rz(split), split), (0, split)]
    for a0, a1, sg in ((-90, 90, -1), (90, 270, 1)):
        h = lathe_part(hp, a0, a1, n=40).move(z=-split)
        h = h.roty(sg * spread).move(z=split)
        it.add(h, 'body', sharp=35)
    return it


def slotted_item(d, t, L, gap=34.0, c0=0.9, c1=0.5, slot_at=0.0):
    """슬롯형 스프링핀(롤핀): 판을 말아 길이 방향 홈이 있는 관. 끝 모따기 (c0 = 안내 쪽(−Z) 큰 모따기)"""
    ro, ri = d / 2, d / 2 - t
    ci = min(0.35 * t, 0.4)
    prof = [(ri, ci), (ri + ci, 0), (ro - c0, 0), (ro, c0), (ro, L - c1), (ro - c1, L), (ri + ci, L), (ri, L - ci)]
    it = Item()
    it.add(lathe_part(prof, slot_at + gap / 2, slot_at + 360 - gap / 2, n=100), 'body', sharp=32)
    return it


def coil_item(d, t, L, turns=2.25, gap=0.035, cd0=1.3, cd1=0.7):
    """코일 스프링핀(스파이럴핀): 판을 두 번 이상 감은 소용돌이 단면, 끝 모따기"""
    ro = d / 2
    n = int(turns * 72) + 1
    phi = np.linspace(0, turns * TAU, n)
    rc = ro - t / 2 - (t + gap) * phi / TAU
    nn = np.array([t / 2, t / 2, -t / 2, -t / 2])
    isbot = np.array([1, 0, 0, 1])
    r = rc[:, None] + nn[None, :]
    cut0 = np.maximum(0, r - (ro - cd0 * t))
    cut1 = np.maximum(0, r - (ro - cd1 * t))
    z = np.where(isbot[None, :] == 1, cut0, L - cut1)
    P3 = np.stack([r * np.cos(phi)[:, None], r * np.sin(phi)[:, None], z], -1)
    body = grid(P3, wrap=False, wrap_v=True)
    n4 = 4
    caps = Mesh(P3[0], [[0, 1, 2, 3]]) + Mesh(P3[-1], [[0, 1, 2, 3]])
    it = Item()
    it.add((body + caps).weld(1e-7), 'body', sharp=35)
    return it


def grooved_item(d, L, half=False, head=False, c0=0.9, c1=0.5, depth=0.95, bulge=0.4, N=180):
    """그루브 핀: 세 줄 V홈(120°)과 홈 옆으로 부풀어 오른 마루. half=True면 한쪽 절반만 홈 (반장)"""
    r = d / 2
    w, wb = math.radians(15), math.radians(10)
    zg = L * 0.5 if half else None

    def rmod(th, rr, z):
        k = np.zeros_like(rr)
        for a in (90, 210, 330):
            dd = np.abs((th - math.radians(a) + math.pi) % TAU - math.pi)
            g = np.maximum(0.0, 1 - dd / w)
            b = np.where((dd > w) & (dd < w + wb), np.sin(math.pi * (dd - w) / wb) ** 1.0, 0.0)
            k = k + (-depth * g + bulge * b)
        if half:
            hz = np.clip((zg + 0.6 - z) / 0.6, 0, 1)
            k = k * hz
        return np.maximum(rr + k, 0.2)

    ex = [(r, zg), (r, zg + 0.6)] if half else []
    if head:   # 둥근 머리(지름 1.55d, 높이 ~0.6d)
        hd = 1.55 * r
        arc = [(hd * math.cos(a), L + 0.4 + 0.55 * r * math.sin(a)) for a in np.linspace(0, math.pi / 2, 10)]
        arc[-1] = (0, arc[-1][1])
        prof = [(rr, dz) for rr, dz in e_flat(c0)(r)] + ex + [(r, L), (hd, L), (hd, L + 0.4)] + arc[1:]
        mesh = lathe(prof, N, rmod=lambda th, rr, z: np.where(z <= L + 1e-6, rmod(th, rr, z), rr))
    else:
        mesh = lathe_pin(r, r, L, e_flat(c0), e_flat(c1), N=N, rmod=rmod, extra=ex)
    it = Item()
    it.add(mesh, 'body', sharp=38)
    return it


@family('splittaper', looks=['PL'])
def f_splittaper(fid):
    m = bl.Model(fid)
    put(m, lay(split_taper_item(8, 50, 15, 13), s=0, d=0, yaw=YAW + 8, roll=90))
    put(m, lay(split_taper_item(6, 36, 11, 13), s=12, d=-17, yaw=YAW - 2, roll=90))
    return m.view(el=34)


@family('spring-sl', looks=['PL', 'SS'])
def f_spring_sl(fid):
    m = bl.Model(fid)
    put(m, lay(slotted_item(10, 1.6, 30), s=-2, d=0, yaw=84, roll=-12))
    put(m, stand(slotted_item(8, 1.3, 16), x=-17, y=-6, yaw=-62))
    return m.view(el=36)


@family('spring-co', looks=['PL', 'SS'])
def f_spring_co(fid):
    m = bl.Model(fid)
    put(m, lay(coil_item(10, 0.9, 30, gap=0.09), s=-2, d=0, yaw=84, roll=0))
    put(m, stand(coil_item(8, 0.8, 16, gap=0.12), x=-17, y=-6, yaw=0))
    return m.view(el=36)


@family('grooved', looks=['PL', 'ZW', 'SS'])
def f_grooved(fid):
    m = bl.Model(fid)
    put(m, lay(grooved_item(8, 30), s=-3, d=0, yaw=84, roll=-30))
    put(m, lay(grooved_item(6, 24, half=True), s=3, d=-15, yaw=74, roll=-30))
    put(m, lay(grooved_item(6, 20, head=True), s=6, d=15, yaw=62, roll=-30))
    return m.view(el=28)


@family('ipin', looks=['PL', 'SS'])
def f_ipin(fid):
    """인치 핀: 다웰핀(크라운+모따기) · 테이퍼 핀(1/4 in per ft) · 슬롯형 스프링핀"""
    d = 6.35
    m = bl.Model(fid)
    dw = Item().add(lathe_pin(d / 2, d / 2, 25.4, e_crown(0.35, 0.3), e_flat(0.45)), 'body', sharp=35)
    put(m, lay(dw, s=-2, d=0, yaw=YAW + 4))
    put(m, lay(taper_item(5.56, 38.1, k=1 / 48.0), s=6, d=-14, yaw=YAW - 2))
    put(m, lay(slotted_item(d, 1.2, 25.4, c0=0.7, c1=0.4), s=-1, d=14, yaw=YAW + 8, roll=-20))
    return m.view(el=28)


# ═══════════════════════════════════════════════════════════════════════
# 분할핀 · 클레비스 핀 · R핀·린치핀 (철사 · 머리붙이 핀)
# ═══════════════════════════════════════════════════════════════════════
def _ss(u):
    return u * u * (3 - 2 * u)


def cotter_item(r, L, dl=3.5):
    """분할핀: 반원 철사 둘을 접은 모양. r = 반원 반지름(철사 폭의 절반), L = 긴 다리 길이(눈 아래부터), dl = 짧은 다리 차이.
    눈 고리가 있는 평면 = xz, 다리 끝이 z=0, 눈은 위(+z)"""
    cf = 4 * r / (3 * math.pi)                         # 반원 중심(도심)에서 평평한 면까지
    c0 = cf + 0.03                                      # 두 다리 평평한 면 사이 0.06mm 틈
    Rc = 1.5 * r + 0.4
    z1 = L
    sl = 1.6 * Rc
    zc = z1 + sl
    pts = []
    for z in np.linspace(0, z1, 8, endpoint=False):     # 왼 다리(긴 쪽)
        pts.append((-c0, z))
    for u in np.linspace(0, 1, 16, endpoint=False):     # 왼쪽 S자
        pts.append((-c0 - (Rc - c0) * _ss(u), z1 + sl * u))
    for a in np.linspace(180, 0, 41):                   # 위쪽 반원 (시계 방향)
        pts.append((Rc * math.cos(math.radians(a)), zc + Rc * math.sin(math.radians(a))))
    for u in np.linspace(0, 1, 16, endpoint=False)[1:]:  # 오른쪽 S자
        pts.append((c0 + (Rc - c0) * (1 - _ss(u)), zc - sl * u))
    for z in np.linspace(z1, dl, 8):                    # 오른 다리(짧은 쪽)
        pts.append((c0, z))
    path = np.array([(x, 0.0, z) for x, z in pts])
    # 마지막 점 중복 제거
    keep = np.r_[True, np.linalg.norm(np.diff(path, axis=0), axis=1) > 1e-6]
    path = path[keep]
    ang = np.radians(np.linspace(90, 270, 17))
    sec = np.c_[cf + r * np.cos(ang), r * np.sin(ang)]
    it = Item()
    it.add(sweep(path, sec, up=(0, 1, 0)), 'body', sharp=40)
    return it


@family('cotter', looks=['PL', 'ZW', 'SS', 'BR'])
def f_cotter(fid):
    m = bl.Model(fid)
    put(m, lay(cotter_item(1.85, 26, 3.5), s=-2, d=0, yaw=YAW + 6, roll=90))
    put(m, lay(cotter_item(1.3, 18, 2.5), s=6, d=-10, yaw=YAW - 6, roll=90))
    return m.view(el=40)


def clevis_item(d, Lg, dk, k, hole, le, washer=None):
    """클레비스 핀: 머리(dk×k) + 몸통(d, 머리 밑에서 Lg) + 끝 분할핀 구멍(지름 hole, 끝에서 le) + 와셔(d1,d2,h) 하나"""
    r, rh = d / 2, dk / 2
    ch = 0.07 * d + 0.3
    prof = [(0, k), (rh - 0.8, k), (rh, k - 0.8), (rh, 0.5), (rh - 0.5, 0), (r + 0.3, 0), (r, -0.3), (r, -Lg + ch), (r - ch, -Lg), (0, -Lg)]
    zh = -Lg + le
    it = Item()
    it.add(lathe(prof, 96), 'body', sharp=35, cut=[cyl(hole / 2, -r - 2, r + 2, N=28).roty(90).move(z=zh)])
    if washer:
        d1, d2, h = washer
        it.add(P.washer_mesh(d1, d2, h, z0=zh + hole / 2 + 0.6, edge=0.2), 'body', sharp=40)
    return it


def headless_pin_item(d, L, hole, le):
    """머리없는 핀(ISO 2340 형): 양 끝 모따기, 양 끝에 분할핀 구멍"""
    r = d / 2
    ch = 0.08 * d + 0.3
    it = Item()
    it.add(lathe_pin(r, r, L, e_flat(ch), e_flat(ch)), 'body', sharp=35,
           cut=[cyl(hole / 2, -r - 2, r + 2, N=28).roty(90).move(z=z) for z in (le, L - le)])
    return it


@family('clevis', looks=['PL', 'BO', 'ZW', 'PH'])
def f_clevis(fid):
    m = bl.Model(fid)
    d = 10
    it = clevis_item(d, 40, 16, 4, 3.4, 5.5, washer=(10.4, 18, 2.5))
    put(m, lay(it, s=-2, d=0, yaw=YAW + 10, roll=-52, tilt=rest_tilt(8, 5, 40, 4)))
    put(m, lay(headless_pin_item(8, 34, 2.9, 4.5), s=2, d=-22, yaw=YAW + 2, roll=-52))
    return m.view(el=30)


def rclip_path(Ls, Rb, rw, leave=160.0, over=7.0):
    """R핀 중심선 (바닥 xy 평면, 철사가 바닥에 닿도록 z=rw). 곧은 다리 → 반시계 고리 → 곧은 다리를 비스듬히 가로지르는 꼬리"""
    pts = []
    for x in np.linspace(0, Ls, 20, endpoint=False):
        pts.append((x, 0.0, rw))
    for a in np.linspace(-90, leave, 60):
        t = math.radians(a)
        pts.append((Ls + Rb * math.cos(t), Rb + Rb * math.sin(t), rw))
    t = math.radians(leave)
    p0 = np.array([Ls + Rb * math.cos(t), Rb + Rb * math.sin(t)])
    tg = np.array([-math.sin(t), math.cos(t)])         # 반시계 방향 접선 (꼬리 방향)
    s_cross = -p0[1] / tg[1]                            # 곧은 다리(y=0)와 만나는 거리
    n = 40
    for s in np.linspace(0, s_cross + over, n)[1:]:
        u = min(s / s_cross, 1.0)
        p = p0 + tg * s
        pts.append((p[0], p[1], rw + 2.05 * rw * _ss(u)))
    return np.array(pts)


def linch_item(d, L, rh, hh, hole, le):
    """린치핀(클랩핀): 둥근 머리 + 몸통 + 끝 구멍. 구멍 중심과 방향 표식(marks)을 남긴다"""
    r = d / 2
    ch = 0.1 * d + 0.3
    prof = [(0, hh), (rh - 1.0, hh), (rh, hh - 1.0), (rh, 0.8), (rh - 0.8, 0), (r, 0), (r, -L + ch), (r - ch, -L), (0, -L)]
    zh = -L + le
    it = Item()
    it.add(lathe(prof, 96), 'body', sharp=35, cut=[cyl(hole / 2, -r - 2, r + 2, N=28).roty(90).move(z=zh)])
    it.marks = dict(H=(0, 0, zh), A=(1, 0, zh), T=(0, 0, zh - 1))
    return it


@family('rclip', looks=['ZW', 'SS'])
def f_rclip(fid):
    m = bl.Model(fid)
    # R핀 (큰 것) — 바닥 위에 납작하게
    rw = 1.2
    path = rclip_path(50, 8.0, rw)
    pts = at(wire(path, rw, n=14), yaw=52)
    m.add(pts, 'body', sharp=40)
    p2 = rclip_path(36, 5.0, 0.9)
    m.add(at(wire(p2, 0.9, n=12), x=3, y=-28, yaw=40), 'body', sharp=40)
    # 린치핀 + 철사 고리
    d, L = 8, 50
    it = linch_item(d, L, 6.0, 3.0, 3.6, 7.0)
    pl = lay(it, s=0, d=24, yaw=52 + 8, roll=-90, tilt=rest_tilt(6.0, 4.0, L, 3.0))
    put(m, pl)
    H, A, T = pl.marks['H'], pl.marks['A'], pl.marks['T']
    up = np.array([0, 0, 1.0])
    tip = T - H
    tip[2] = 0
    tip /= np.linalg.norm(tip)
    ay = np.cross(up, tip)
    Rr, rw2 = 11.0, 1.1
    cb = (rw2 - H[2]) / (2 * Rr)
    sb = math.sqrt(1 - cb * cb)
    e2 = sb * tip + cb * up
    C = H + Rr * e2
    tt = np.linspace(0, TAU, 80, endpoint=False)
    ring = np.array([C + Rr * (math.cos(t) * ay + math.sin(t) * e2) for t in tt])
    m.add(wire(ring, rw2, closed=True, cap=False, n=12), 'body', sharp=40)
    return m.view(el=42)


# ═══════════════════════════════════════════════════════════════════════
# 멈춤링 (C형 축용·구멍용 · E형 · 기타)
# ═══════════════════════════════════════════════════════════════════════
def _arc(cx, cy, r, a0, a1, n):
    t = np.linspace(a0, a1, n)
    return [(cx + r * math.cos(a), cy + r * math.sin(a)) for a in t]


def _line(p, q, n=4):
    return [(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u) for u in np.linspace(0, 1, n)]


def _dedupe(pts, eps=1e-6):
    out = [pts[0]]
    for p in pts[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > eps:
            out.append(p)
    if math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < eps:
        out.pop()
    return out


def c_ring(kind, r, a_back, a_top, gx, lug_r, lug_h, hole_r, s, n_arc=120):
    """C형 멈춤링 (kind='ext' 축용 DIN 471 / 'int' 구멍용 DIN 472), 틈은 +y쪽.
    ext: r = 안쪽 반지름, 귀가 바깥으로.  int: r = 바깥 반지름, 귀가 안쪽으로.
    a_back = 뒤쪽(틈 반대) 폭, a_top = 귀 쪽 폭, gx = 틈 반폭, lug_r = 귀 반폭, lug_h = 귀가 몸통 밖으로 나온 길이"""
    e = (a_back - a_top) / 2
    xl = gx + 2 * lug_r
    pts = []
    if kind == 'ext':
        Ro = r + (a_back + a_top) / 2
        y_in = math.sqrt(r * r - gx * gx)
        y_l = -e + math.sqrt(Ro * Ro - xl * xl)
        y_top = -e + math.sqrt(Ro * Ro - gx * gx)
        y_h = max(y_top, y_l) + lug_h - lug_r
        ts = math.atan2(y_in, gx)
        pts += _line((gx, y_h), (gx, y_in), 5)
        pts += _arc(0, 0, r, ts, -math.pi - ts, n_arc)
        pts += _line((-gx, y_in), (-gx, y_h), 5)
        pts += _arc(-(gx + lug_r), y_h, lug_r, 0, math.pi, 14)
        pts += _line((-xl, y_h), (-xl, y_l), 4)
        p1 = math.atan2(y_l + e, -xl)
        p2 = math.atan2(y_l + e, xl) + TAU
        pts += _arc(0, -e, Ro, p1, p2, n_arc)
        pts += _line((xl, y_l), (xl, y_h), 4)
        pts += _arc(gx + lug_r, y_h, lug_r, 0, math.pi, 14)
    else:
        Ro = r
        Ri = Ro - (a_back + a_top) / 2
        y_top = math.sqrt(Ro * Ro - gx * gx)
        y_li = e + math.sqrt(Ri * Ri - xl * xl)
        y_h = min(y_li, e + math.sqrt(Ri * Ri - gx * gx)) - lug_h + lug_r
        ts = math.atan2(y_li - e, xl)
        pts += _line((gx, y_top), (gx, y_h), 5)
        pts += _arc(gx + lug_r, y_h, lug_r, math.pi, TAU, 14)
        pts += _line((xl, y_h), (xl, y_li), 4)
        pts += _arc(0, e, Ri, ts, -math.pi - ts, n_arc)
        pts += _line((-xl, y_li), (-xl, y_h), 4)
        pts += _arc(-(gx + lug_r), y_h, lug_r, math.pi, TAU, 14)
        pts += _line((-gx, y_h), (-gx, y_top), 5)
        p1 = math.atan2(y_top, -gx)
        p2 = math.atan2(y_top, gx) + TAU
        pts += _arc(0, 0, Ro, p1, p2, n_arc)
    pts = _dedupe(pts)
    holes = [circle2d(hole_r, 24, cx=sx * (gx + lug_r), cy=y_h) for sx in (-1, 1)]
    return extrude(np.array(pts), 0, s, holes=holes)


def e_ring(rg, Ro, s, wp=10.0, tw=6.0, relief=2.0, off=120.0):
    """E형 멈춤링 (DIN 6799). rg = 홈 지름/2 (발 접촉 반지름), Ro = 바깥 반지름. 열림은 +x쪽, 발 3개(뒤 1 + 열림 가장자리 2)"""
    cents = (180.0, 180.0 - off, 180.0 + off)
    a0 = (180.0 - off) - wp

    def rin(th_deg):
        b = 0.0
        for c in cents:
            dd = abs(th_deg - c)
            u = np.clip((wp + tw / 2 - dd) / tw, 0, 1)
            b = max(b, u * u * (3 - 2 * u))
        return rg + relief * (1 - b)
    outer = [(Ro * math.cos(math.radians(a)), Ro * math.sin(math.radians(a))) for a in np.linspace(a0, 360 - a0, 140)]
    inner = [(rin(a) * math.cos(math.radians(a)), rin(a) * math.sin(math.radians(a))) for a in np.linspace(360 - a0, a0, 260)]
    pts = _dedupe(outer + inner)
    return extrude(np.array(pts), 0, s)


def spiral_ring(Rm, w, t, turns, gap=0.03, n_per=72):
    """스파이럴 링: 납작한 철사를 축 방향으로 여러 번 감은 고리 (평균 반지름 Rm, 폭 w, 두께 t)"""
    n = int(turns * n_per) + 1
    phi = np.linspace(0, turns * TAU, n)
    pitch = t + gap
    zc = pitch * phi / TAU + t / 2
    rr = np.array([Rm + w / 2, Rm + w / 2, Rm - w / 2, Rm - w / 2])
    dz = np.array([-t / 2, t / 2, t / 2, -t / 2])
    r = np.broadcast_to(rr[None, :], (n, 4))
    z = zc[:, None] + dz[None, :]
    P3 = np.stack([r * np.cos(phi)[:, None], r * np.sin(phi)[:, None], z], -1)
    body = grid(P3, wrap=False, wrap_v=True)
    caps = Mesh(P3[0], [[0, 1, 2, 3]]) + Mesh(P3[-1], [[0, 1, 2, 3]])
    return (body + caps).weld(1e-7)


def chaikin(path, it=2):
    """열린 꺾은선의 모서리를 둥글게 (양 끝점 유지)"""
    p = np.asarray(path, float)
    for _ in range(it):
        q = [p[0]]
        for a, b in zip(p[:-1], p[1:]):
            q += [0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b]
        q.append(p[-1])
        p = np.array(q)
    return p


def wire_ring_path(R, gap_deg, leg, z):
    """와이어 스냅링 중심선: 큰 원호 + 끝을 안쪽으로 꺾은 짧은 다리 (틈은 +x쪽)"""
    a0, a1 = gap_deg / 2, 360 - gap_deg / 2
    arc = [(R * math.cos(math.radians(a)), R * math.sin(math.radians(a)), z) for a in np.linspace(a0, a1, 110)]
    ea, eb = math.radians(a0), math.radians(a1)
    s = [(R * math.cos(ea) - leg * math.cos(ea) * 0.35 + 0, R * math.sin(ea) - leg * math.sin(ea), z)]
    e = [(R * math.cos(eb) - leg * math.cos(eb) * 0.35, R * math.sin(eb) - leg * math.sin(eb), z)]
    path = np.array(s + arc + e)
    return chaikin(path, 2)


def ring_rot(mesh, deg):
    return mesh.rotz(deg)


@family('ring-ext', looks=['PH', 'BO', 'SS'])
def f_ring_ext(fid):
    m = bl.Model(fid)
    big = c_ring('ext', 13.8, 4.1, 2.3, 1.6, 2.2, 3.6, 1.2, 1.5)
    small = c_ring('ext', 9.1, 3.3, 1.9, 1.3, 1.8, 3.0, 0.9, 1.2)
    m.add(at(big, -13, -7, 0, yaw=80), 'body', sharp=30, bevel=0.12)
    m.add(at(small, 12.5, 7.4, 0, yaw=62), 'body', sharp=30, bevel=0.1)
    return m.view(el=46)


@family('ring-int', looks=['PH', 'BO', 'SS'])
def f_ring_int(fid):
    m = bl.Model(fid)
    big = c_ring('int', 15.5, 3.4, 1.9, 1.6, 2.1, 4.6, 1.2, 1.5)
    small = c_ring('int', 10.5, 2.8, 1.6, 1.3, 1.7, 3.6, 0.9, 1.2)
    m.add(at(big, -13, -7, 0, yaw=80), 'body', sharp=30, bevel=0.12)
    m.add(at(small, 12.5, 7.4, 0, yaw=62), 'body', sharp=30, bevel=0.1)
    return m.view(el=46)


@family('ering', looks=['PH', 'BO', 'ZW', 'SS'])
def f_ering(fid):
    m = bl.Model(fid)
    big = e_ring(4.0, 7.8, 0.8)
    small = e_ring(2.5, 4.9, 0.6)
    m.add(at(big, -5, 3, 0, yaw=165), 'body', sharp=30, bevel=0.08)
    m.add(at(small, 10, -4, 0, yaw=135), 'body', sharp=30, bevel=0.06)
    return m.view(el=46)


@family('ring-misc', looks=['PH', 'BO', 'SS'])
def f_ring_misc(fid):
    m = bl.Model(fid)
    # 와이어 스냅링(DIN 7993 형)
    w = wire(wire_ring_path(11.5, 46, 4.5, 1.1), 1.1, n=12)
    m.add(at(w, -13, 6, 0, yaw=130), 'body', sharp=40)
    # 스파이럴 링
    m.add(at(spiral_ring(9.5, 2.4, 0.9, 3.0, gap=0.12), 15, -2, 0), 'body', sharp=35)
    # 작은 와이어 링
    w2 = wire(wire_ring_path(7.0, 50, 3.2, 0.8), 0.8, n=10)
    m.add(at(w2, 6, 26, 0, yaw=100), 'body', sharp=40)
    return m.view(el=46)


# ═══════════════════════════════════════════════════════════════════════
# 키 (평행 키 · 반달 키 · 인치 키 · 키 스톡 · 머리붙이 경사 키)
# ═══════════════════════════════════════════════════════════════════════
def key_bar(b, h, L, round_ends=0, rev_end=False):
    """직사각 단면 키: 폭 b, 높이 h, 길이 L (x 방향). round_ends: 0 각진 끝(B형) / 2 양쪽 둥근 끝(A형) / 1 한쪽만 둥근 끝(C형)
    바닥 z=0 위에 놓인 압출체 (모서리 둥글림은 bevel)"""
    if round_ends == 2:
        o = stadium2d(L, b, n=18)
    elif round_ends == 1:
        r = b / 2
        pts = [(-L / 2, -b / 2), (L / 2 - r, -b / 2)]
        pts += [(L / 2 - r + r * math.cos(a), r * math.sin(a)) for a in np.radians(np.linspace(-90, 90, 18))[1:-1]]
        pts += [(L / 2 - r, b / 2), (-L / 2, b / 2)]
        o = np.array(pts)
    else:
        o = rect2d(L, b)
    return extrude(o, 0, h)


def woodruff_outline(D, h, n=60):
    R = D / 2
    cy = h - R
    xc = math.sqrt(R * R - cy * cy)
    a0 = math.atan2(-cy, xc)
    a1 = math.pi - a0
    pts = [(R * math.cos(a), cy + R * math.sin(a)) for a in np.linspace(a0, a1, n)]
    return np.array(pts)


def woodruff(b, D, h):
    """반달 키: 반원(조금 작은) 판을 b 두께로 압출. 윤곽은 xy 평면, 두께는 z(−b/2..b/2): 호가 +y"""
    return extrude(woodruff_outline(D, h), -b / 2, b / 2)


def gib_key(b, h, L, H, hl, slope=0.01, ch=0.8):
    """머리붙이 경사 키 (DIN 6887): 옆모습(길이 x · 높이 y) 윤곽을 b 두께로 압출. 머리는 x=L 쪽(큰 끝). 위쪽 면이 1:100로 경사"""
    pts = [(0, 0), (L + hl, 0), (L + hl, H - ch), (L + hl - ch, H), (L + ch, H), (L, H - ch), (L, h), (0, h - slope * L)]
    return extrude(np.array(pts), -b / 2, b / 2)


def flatten(mesh):
    """xy 윤곽을 z 방향으로 압출한 메시를 서 있게 (y→z 위로, 두께는 y)"""
    return mesh.rotx(90)


@family('key-par', looks=['PL', 'SS'])
def f_key_par(fid):
    m = bl.Model(fid)
    ka = key_bar(8, 7, 40, 2)
    kb = key_bar(8, 7, 40, 0)
    kc = key_bar(5, 5, 26, 2)
    m.add(at(ka, 0, 0, 0, yaw=18), 'body', sharp=30, bevel=0.35)
    m.add(at(kb, 4, -17, 0, yaw=12), 'body', sharp=30, bevel=0.35)
    m.add(at(kc, -3, 14, 0, yaw=24), 'body', sharp=30, bevel=0.3)
    return m.view(el=34)


@family('key-wood', looks=['PL', 'SS'])
def f_key_wood(fid):
    m = bl.Model(fid)
    big = flatten(woodruff(6, 22, 9.0))
    m.add(at(big, -8, 4, 0, yaw=28), 'body', sharp=30, bevel=0.4)
    sm = woodruff(3, 13, 5.2)                    # 누운 작은 키 (반달 면이 위)
    m.add(at(sm, 12, -7, 0, yaw=30).move(z=1.5), 'body', sharp=30, bevel=0.3)
    return m.view(el=32)


@family('key-inch', looks=['PL', 'SS'])
def f_key_inch(fid):
    m = bl.Model(fid)
    m.add(at(key_bar(6.35, 6.35, 38.1), 0, 0, 0, yaw=14), 'body', sharp=30, bevel=0.3)
    m.add(at(key_bar(6.35, 4.76, 38.1), 3, -15, 0, yaw=10), 'body', sharp=30, bevel=0.3)
    m.add(at(key_bar(9.525, 9.525, 25.4), -6, 16, 0, yaw=20), 'body', sharp=30, bevel=0.35)
    return m.view(el=34)


@family('keystock', looks=['PL', 'SS'])
def f_keystock(fid):
    m = bl.Model(fid)
    m.add(at(key_bar(10, 8, 120), 0, 0, 0, yaw=0), 'body', sharp=30, bevel=0.2)
    m.add(at(key_bar(10, 8, 34), -22, -17, 0, yaw=4), 'body', sharp=30, bevel=0.2)
    m.add(at(key_bar(10, 8, 22), 26, -17, 0, yaw=-6), 'body', sharp=30, bevel=0.2)
    return m.view(el=32)


@family('key-gib', looks=['PL', 'SS'])
def f_key_gib(fid):
    m = bl.Model(fid)
    g = flatten(gib_key(8, 7, 56, 11, 4))
    m.add(at(g, -20, 0, 0, yaw=10), 'body', sharp=30, bevel=0.3)
    g2 = flatten(gib_key(5, 5, 36, 8, 3))
    m.add(at(g2, 8, -14, 0, yaw=4), 'body', sharp=30, bevel=0.25)
    return m.view(el=30)
