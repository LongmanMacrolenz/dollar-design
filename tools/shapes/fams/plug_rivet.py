"""플러그 · 블라인드 리벳 · 리벳너트 · 인서트 · 클린칭 · 스탠드오프 품목군 빌더.

담당 id: plug910 plug906 plug908 plugnpt plugbar orbplug blindrivet blindrivet-csk lockbolt solidrivet
         rivnut rivstud wti keyinsert woodinsert clinch standoff

이 모듈의 보조 함수
  body_rows     (반지름, 높이) 줄들을 쌓은 회전·극좌표 몸체. 줄마다 반지름이 θ에 따라 달라도 된다
                (육각 구멍·육각 몸체·널링·나사산을 한 장의 닫힌 메시로 만든다)
  thread_rows   수나사(테이퍼 포함) 줄들
  socket_rows   육각 구멍 줄들
  put / ground  장면에서 부품을 놓는 위치 (화면 가로·깊이 방향)
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import *
from geo import _prof

# 카메라 기본 방위(az=-38)에서의 화면 가로(오른쪽)·카메라 쪽 단위벡터 (바닥 평면)
_RIGHT = np.array([math.cos(math.radians(52)), math.sin(math.radians(52))])
_TOCAM = np.array([math.cos(math.radians(-38)), math.sin(math.radians(-38))])


# ── 공용 보조 ────────────────────────────────────────────────────────────
def ground(m):
    lo, _ = m.bbox()
    return m.move(z=-lo[2])


def put(m, sx=0.0, sd=0.0, z=0.0):
    """sx = 화면 오른쪽으로, sd = 카메라 쪽으로 (mm)"""
    v = _RIGHT * sx + _TOCAM * sd
    return m.move(float(v[0]), float(v[1]), z)


def scene(name, *models, **cam):
    out = bl.Model(name)
    for m in models:
        out.extend(m)
    return out.view(**cam)


def body_rows(rows, N=192):
    """rows = [(r, z), …]  r·z는 숫자 또는 길이 N 배열(θ마다). 위에서 아래로든 아래에서 위로든 상관없다. r=0 줄은 축 위의 점"""
    th = theta(N)
    pts = []
    for r, z in rows:
        r = np.broadcast_to(np.asarray(r, float), th.shape)
        z = np.broadcast_to(np.asarray(z, float), th.shape)
        pts.append(np.stack([r * np.cos(th), r * np.sin(th), z], -1))
    return grid(np.stack(pts, 1), wrap=True).weld()


def arc(cr, cz, rad, a0, a1, n=5):
    a = np.radians(np.linspace(a0, a1, n))
    return [(cr + rad * math.cos(t), cz + rad * math.sin(t)) for t in a]


def thread_rows(N, R, Pt, z0, z1, depth=None, spp=16, tip0=True, tip1=True, hand=1, crest=(0.1, 0.2), lead=45.0, ph=0.0):
    """수나사 줄들. R = 바깥 반지름(숫자) 또는 z → 반지름 함수 (테이퍼). z0→z1"""
    th = theta(N)[:, None]
    nz = max(8, int(round((z1 - z0) / Pt * spp)) + 1)
    zs = np.linspace(z0, z1, nz)
    Rf = R if callable(R) else (lambda z: np.full(np.shape(z), float(R)))
    h = 0.6 * Pt if depth is None else depth
    t = ((zs[None, :] - z0) / Pt - hand * th / TAU + ph) % 1.0
    r = Rf(zs)[None, :] - h * (1 - _prof(t, *crest))
    k = math.tan(math.radians(lead))
    if tip0:
        r = np.minimum(r, (float(Rf(np.array([z0]))[0]) - h - 0.12 * Pt) + (zs[None, :] - z0) * k)
    if tip1:
        r = np.minimum(r, (float(Rf(np.array([z1]))[0]) - h - 0.12 * Pt) + (z1 - zs[None, :]) * k)
    return [(r[:, j], float(zs[j])) for j in range(nz)]


def hex_r(N, s, rho=0.0):
    return rpoly_r(theta(N), 6, s, rho, 0.0)


def socket_rows(N, s, z_top, depth, mouth=0.35, cone=0.35):
    """육각 구멍 (맞변 s, 위 z_top에서 depth 깊이). 입구 모따기 + 바닥 원뿔"""
    rh = hex_r(N, s)
    R = s / math.sqrt(3)
    return [(rh + mouth, z_top), (rh, z_top - mouth), (rh, z_top - depth), (0.0, z_top - depth - cone * R)]


def taper_R(d_big, z_big, taper=1 / 16):
    """z_big에서 지름 d_big, 작은 쪽으로 지름 기울기 taper (테이퍼 나사 1:16) → 반지름 함수"""
    return lambda z: d_big / 2 - (z_big - np.asarray(z, float)) * taper / 2


def hex_head_mesh(s, k, z0=0.0, rc_bot=True, rho=None):
    rc = s / 2 * 0.95
    return polybody(6, s, z0, z0 + k, rc_top=rc, rc_bot=rc if rc_bot else None, rho=rho)


# ═══ DIN 910 · 909 육각머리 플러그 ═══════════════════════════════════════
def _din910():
    """M16×1.5 칼라붙이 육각머리 플러그. 머리 밑면 z=0, 머리 윗면 z=k, 나사는 아래(−Z)"""
    d, Pt, L = 16.0, 1.5, 12.0
    s, k, cd, ct = 19.0, 7.0, 22.0, 1.6
    m = bl.Model('din910')
    m.add(hex_head_mesh(s, k, 0.0, rc_bot=False), 'body', sharp=26)
    cr = cd / 2
    m.add(lathe([(0, -ct), (cr - 0.3, -ct), (cr, -ct + 0.3), (cr, -0.1), (cr - 0.3, 0.1), (0, 0.1)], 128), 'body', sharp=30)
    m.add(body_rows([(0.0, -ct - L)] + thread_rows(96, d / 2, Pt, -ct - L, 0.0, tip1=False, spp=18) + [(0.0, 0.0)], 96), 'body', sharp=40)
    return m


def _din909():
    """R3/8 테이퍼 나사 육각머리 플러그 (칼라 없음)"""
    Pt, L = 1.337, 14.0
    s, k = 19.0, 8.0
    m = bl.Model('din909')
    m.add(hex_head_mesh(s, k, 0.0, rc_bot=True), 'body', sharp=26)
    rows = [(0.0, -L)] + thread_rows(96, taper_R(16.66, 0.0), Pt, -L, 0.3, depth=0.64 * Pt, tip1=False, spp=18) + [(0.0, 0.3)]
    m.add(body_rows(rows, 96), 'body', sharp=40)
    return m


@family('plug910')
def plug_910(fid):
    a = ground(_din910().lie(78))
    b = ground(_din909().lie(78))
    put(a, -2, 15)
    put(b, 10, -20)
    return scene(fid, a, b, el=26)


# ═══ DIN 906 육각구멍 테이퍼 플러그 ══════════════════════════════════════
def _din906(N=192):
    """R3/8 (지름 16.66, 피치 1.337) 원뿔 나사. 윗면 z=L, 끝 z=0"""
    Pt, L = 1.337, 13.0
    s, t = 8.0, 7.0
    rows = [(0.0, 0.0)] + thread_rows(N, taper_R(16.66, L), Pt, 0.0, L, depth=0.64 * Pt, spp=16) + socket_rows(N, s, L, t)
    m = bl.Model('din906')
    m.add(body_rows(rows, N), 'body', sharp=38)
    return m


@family('plug906')
def plug_906(fid):
    st = ground(_din906())
    li = ground(_din906().lie(95))
    put(st, -9, -4)
    put(li, 12, 8)
    return scene(fid, st, li, el=32)


# ═══ DIN 908 칼라붙이 육각구멍 플러그 + 구리 실링 링 ═════════════════════════
def _din908(N=192, with_ring=True):
    """M14×1.5. 머리 밑면 z=0, 윗면 z=k, 나사는 아래. 칼라 밑(−1.5…0)에 구리 실링 링"""
    d, Pt, L = 14.0, 1.5, 12.0
    dk, k, s, t = 17.4, 4.2, 7.0, 7.5
    rk = dk / 2
    rows = [(0.0, -L)] + thread_rows(N, d / 2, Pt, -L, 0.0, tip1=False, spp=16)
    rows += [(rk - 0.5, 0.0), (rk, 0.5), (rk, k - 0.7)] + arc(rk - 0.7, k - 0.7, 0.7, 0, 90, 5)
    rows += socket_rows(N, s, k, t)
    m = bl.Model('din908')
    m.add(body_rows(rows, N), 'body', sharp=38)
    if with_ring:
        m.add(P.washer_mesh(14.5, 18.4, 1.5, z0=-1.5, edge=0.25), 'copper', sharp=40)
    return m


@family('plug908')
def plug_908(fid):
    st = ground(_din908())
    li = ground(_din908().lie(95))
    put(st, -9, -4)
    put(li, 14, 8)
    return scene(fid, st, li, el=32)


# ═══ NPT 육각구멍 파이프 플러그 (낮은 머리) ═════════════════════════════════
def _npt_plug(N=192):
    """1/2-14 NPT. 끝 z=0, 머리 밑면 z=L, 머리 윗면 z=L+hh"""
    Pt, L, hh = 25.4 / 14, 15.0, 2.6
    rh = 11.6
    rows = [(0.0, 0.0)] + thread_rows(N, taper_R(21.34, L), Pt, 0.0, L, depth=0.75 * Pt, tip1=False, spp=16)
    rows += [(rh - 0.5, L), (rh, L + 0.5), (rh, L + hh - 0.6)] + arc(rh - 0.6, L + hh - 0.6, 0.6, 0, 90, 4)
    rows += socket_rows(N, 9.525, L + hh, 9.0)
    m = bl.Model('npt')
    m.add(body_rows(rows, N), 'body', sharp=38)
    return m


@family('plugnpt')
def plug_npt(fid):
    st = ground(_npt_plug())
    li = ground(_npt_plug().lie(95))
    put(st, -11, -4)
    put(li, 14, 8)
    return scene(fid, st, li, el=32)


# ═══ 바스톡 파이프 플러그 (육각머리 · 둥근머리) ═══════════════════════════════
def _bar_hex(N=192):
    """1/2 NPT 바스톡 육각머리 플러그. 끝 z=0, 머리 밑면 z=L"""
    Pt, L = 25.4 / 14, 17.0
    s, k = 22.2, 9.5
    m = bl.Model('barhex')
    rows = [(0.0, 0.0)] + thread_rows(96, taper_R(21.34, L), Pt, 0.0, L + 0.3, depth=0.75 * Pt, tip1=False, spp=16) + [(0.0, L + 0.3)]
    m.add(body_rows(rows, 96), 'body', sharp=40)
    m.add(hex_head_mesh(s, k, L, rc_bot=True), 'body', sharp=26)
    return m


def _bar_round(N=192):
    """1/2 NPT 바스톡 둥근머리 플러그: 둥근 머리 + 양쪽 렌치 평면"""
    Pt, L, hh = 25.4 / 14, 17.0, 9.5
    R, w = 12.0, 20.5
    th = theta(N)
    rflat = np.minimum(R, (w / 2) / np.maximum(np.abs(np.sin(th)), 1e-6))
    rows = [(0.0, 0.0)] + thread_rows(N, taper_R(21.34, L), Pt, 0.0, L, depth=0.75 * Pt, tip1=False, spp=16)
    rows += [(rflat * 0.94, L), (rflat, L + 0.4), (rflat, L + hh - 1.5)]
    for a in np.linspace(0, 90, 6)[1:]:
        c = math.cos(math.radians(a)); sn = math.sin(math.radians(a))
        rows.append((rflat - 1.5 * (1 - c), L + hh - 1.5 + 1.5 * sn))
    rows.append((0.0, L + hh))
    m = bl.Model('barround')
    m.add(body_rows(rows, N), 'body', sharp=38)
    return m


@family('plugbar')
def plug_bar(fid):
    a = ground(_bar_hex().lie(70))
    b = ground(_bar_round().lie(104))
    put(a, -6, 14)
    put(b, 12, -16)
    return scene(fid, a, b, el=28)


# ═══ O링 보스 플러그 (SAE J1926 / ISO 11926) ═══════════════════════════════
def _orb(N=192):
    """3/4-16 UNF. 머리 밑면 z=0, 아래로: O링 · 백업 링 · 나사"""
    d, Pt, L = 19.05, 25.4 / 16, 11.0
    rn, neck = 8.3, 4.4            # 목 반지름, 목 길이(머리 밑 ~ 나사 시작)
    rk, k = 12.4, 6.5
    s, t = 9.525, 7.0
    rows = [(0.0, -neck - L)] + thread_rows(N, d / 2, Pt, -neck - L, -neck, tip1=False, spp=16, depth=0.62 * Pt)
    rows += [(rn, -neck), (rn, 0.0), (rk - 0.5, 0.0), (rk, 0.5), (rk, k - 0.8)] + arc(rk - 0.8, k - 0.8, 0.8, 0, 90, 5)
    rows += socket_rows(N, s, k, t)
    m = bl.Model('orb')
    m.add(body_rows(rows, N), 'body', sharp=38)
    cs = 1.31
    m.add(torus(rn + cs, cs, N=96, n=16, z=-cs + 0.06), 'rubber', sharp=60)
    m.add(P.washer_mesh(2 * (rn + 0.1), 21.2, 0.9, z0=-neck + 0.45, edge=0.15), 'nylonw', sharp=40)
    return m


@family('orbplug', looks=['ZW', 'ZY', 'SS'])
def plug_orb(fid):
    st = ground(_orb())
    li = ground(_orb().lie(95))
    put(st, -10, -4)
    put(li, 16, 8)
    return scene(fid, st, li, el=30)


# ═══ 블라인드 리벳 (설치 전: 몸통 + 맨드릴) ══════════════════════════════════
def _blind_rivet(head='dome', closed=False, d=4.8, L=12.0, tail=20.0):
    """머리 밑면 z=0, 몸통은 아래(−Z) L, 맨드릴 꼬리는 머리 위로 tail. head = 'dome' | 'csk'. closed = 몸통 끝이 막힌 밀폐형"""
    r = d / 2
    rb = 1.52                       # 맨드릴 구멍 반지름 (맨드릴 줄기 1.45)
    hd = 9.5 / 2
    if head == 'dome':              # 돔 머리: 둥근 지붕
        kd, rim = 1.5, 0.28
        top = [(r, 0.0), (hd, 0.0), (hd, rim)] + [(rb + (hd - 0.12 - rb) * math.cos(a), rim + (kd - rim) * math.sin(a)) for a in np.radians(np.linspace(0, 90, 9))]
        ztop = kd
    else:                           # 120° 접시머리: 아래가 원뿔, 윗면은 평평
        kc = (hd - r) / math.tan(math.radians(60))
        top = [(r, 0.0), (hd - 0.1, kc - 0.06), (hd, kc), (rb, kc)]
        ztop = kc
    if closed:
        zb = -L - 0.6
        dome_pts = [(r * math.cos(a), -L + 1.2 - 1.8 * math.sin(a)) for a in np.radians(np.linspace(90, 0, 8))]
        prof = dome_pts + top + [(rb, -3.5), (0.0, -3.5)]
    else:
        prof = [(rb, -L), (r - 0.18, -L), (r, -L + 0.18)] + top + [(rb, -L)]
    body = lathe(prof, 96)
    # 맨드릴: 머리(원뿔) + 줄기 (꼬리는 머리 위로 길게)
    mh = [(0.0, -L - 2.3), (0.7, -L - 2.15), (1.5, -L - 1.55), (2.0, -L - 0.7), (2.1, -L - 0.25), (2.1, -L)]
    st = [(1.45, -L), (1.45, tail - 0.25), (1.2, tail), (0.0, tail)]
    if closed:
        mand = lathe([(0.0, -3.0), (1.45, -3.0), (1.45, tail - 0.25), (1.2, tail), (0.0, tail)], 48)
    else:
        mand = lathe(mh + st, 48)
    m = bl.Model('blindrivet')
    m.add(body, 'body', sharp=32)
    m.add(mand, 'bright', sharp=40)
    return m


@family('blindrivet', looks=['AL', 'ZW', 'SS'])
def blind_rivet(fid):
    a = ground(_blind_rivet('dome', tail=16).lie(66))
    b = ground(_blind_rivet('dome', L=16, tail=15).lie(100))
    put(a, -5, 8)
    put(b, 9, -9)
    return scene(fid, a, b, el=26)


@family('blindrivet-csk', looks=['AL', 'ZW', 'SS'])
def blind_rivet_csk(fid):
    a = ground(_blind_rivet('csk', tail=16).lie(66))
    b = ground(_blind_rivet('dome', closed=True, tail=16).lie(66))
    put(a, -2, 8)
    put(b, 6, -9)
    return scene(fid, a, b, el=26)


# ═══ 스웨이지 록볼트 ════════════════════════════════════════════════════════
def _lockbolt(collar_on=True):
    """5/16 핀: 머리 밑면 z=0, 아래로 그립 → 록 홈 → 파단홈 → 풀 홈 꼬리. 칼라는 록 홈에 압착"""
    r, grip = 3.97, 14.0
    pr = [(0.0, 4.6), (2.5, 4.45), (4.8, 3.9), (6.0, 2.9), (6.35, 1.8), (6.35, 0.6), (6.0, 0.0), (r + 0.5, 0.0), (r, -0.5), (r, -grip)]
    z = -grip
    for _ in range(8):                                # 록 홈 (고리 V 홈)
        pr += [(r, z - 0.35), (r - 0.85, z - 1.1), (r - 0.85, z - 1.3), (r, z - 2.05)]
        z -= 2.4
        pr.append((r, z))
    pr += [(r - 0.6, z - 0.4), (2.55, z - 1.0), (2.55, z - 1.8)]       # 파단 홈
    z -= 1.8
    rt = 3.0
    pr += [(rt, z - 0.5)]
    z -= 0.5
    for _ in range(8):                                # 풀 홈 (가는 홈)
        pr += [(rt, z - 0.25), (rt - 0.4, z - 0.55), (rt, z - 0.85)]
        z -= 1.1
        pr.append((rt, z))
    pr += [(rt - 0.5, z - 0.5), (0.0, z - 0.5)]
    m = bl.Model('lockbolt')
    m.add(lathe(pr, 96), 'body', sharp=36)
    if collar_on:
        zc0, hc = -grip + 0.0, 11.0
        rf, rc0 = 6.3, 5.7
        cp = [(0.0, zc0), (rf - 0.3, zc0), (rf, zc0 - 0.3), (rf, zc0 - 1.3), (rc0 + 0.6, zc0 - 1.7), (rc0 + 0.1, zc0 - 3.0),
              (rc0 - 0.15, zc0 - 5.5), (rc0 - 0.2, zc0 - 8.0), (rc0 - 0.05, zc0 - hc + 0.8), (rc0 - 0.45, zc0 - hc), (0.0, zc0 - hc)]
        m.add(lathe(cp, 96), 'alu', sharp=36)
    return m


def _collar_loose(h=11.0):
    ro, ri, rf = 5.95, 4.1, 6.35
    pr = [(ri + 0.3, 0.0), (rf - 0.3, 0.0), (rf, -0.3), (rf, -1.3), (ro + 0.3, -1.5), (ro, -1.9), (ro, -h + 0.4), (ro - 0.4, -h), (ri + 0.3, -h), (ri, -h + 0.3), (ri, -0.3), (ri + 0.3, 0.0)]
    m = bl.Model('collar')
    m.add(lathe(pr, 96), 'alu', sharp=36)
    return m


@family('lockbolt', looks=['ZW', 'PL'])
def lockbolt(fid):
    a = ground(_lockbolt().lie(68))
    c = ground(_collar_loose().lie(104))          # 칼라만 따로 (눕혀 둠: 구멍이 보이게)
    put(a, 4, -10)
    put(c, -12, 26)
    return scene(fid, a, c, el=26)


# ═══ 솔리드 리벳 (둥근머리 DIN 660 · 접시머리 DIN 661) ═════════════════════════
def _solid_round(d=8.0, L=20.0):
    r, rb, k = d / 2, 7.0, 5.6
    hk = k - 0.35
    Rs = (rb * rb + hk * hk) / (2 * hk)
    phi0 = math.asin(rb / Rs)
    cap = [(Rs * math.sin(p), 0.35 + hk - Rs + Rs * math.cos(p)) for p in np.linspace(phi0, 0.0, 14)]
    pr = [(0.0, -L), (r - 0.7, -L), (r - 0.1, -L + 0.5), (r, -L + 1.2), (r, 0.0), (rb - 0.3, 0.0), (rb, 0.3)] + cap
    m = bl.Model('solidrivet-r')
    m.add(lathe(pr, 96), 'body', sharp=36)
    return m


def _solid_csk(d=8.0, L=20.0):
    r, rb = d / 2, 7.0
    kc = rb - r
    dome = [(rb * (1 - t), kc + 0.4 + 0.55 * (1 - (1 - t) ** 2)) for t in np.linspace(0.02, 1.0, 9)]      # 살짝 볼록한 윗면
    pr = [(0.0, -L), (r - 0.7, -L), (r - 0.1, -L + 0.5), (r, -L + 1.2), (r, 0.0), (rb, kc), (rb, kc + 0.4)] + dome
    m = bl.Model('solidrivet-c')
    m.add(lathe(pr, 96), 'body', sharp=36)
    return m


@family('solidrivet', looks=['PL', 'AL', 'CU', 'BR'])
def solid_rivet(fid):
    a = ground(_solid_round().lie(66))
    b = ground(_solid_csk().lie(66))
    put(a, 0, 10)
    put(b, 6, -14)
    return scene(fid, a, b, el=26)


# ═══ 리벳너트 · 리벳볼트 (블라인드 너트 / 스터드) ═══════════════════════════════
_N = 192


def _ribbed(rb, amp=0.2, n=24):
    return rb + amp * np.cos(n * theta(_N))


def _body_outline(round_body, rb, s_hex, L, ribs=True, groove=True):
    """리벳너트·리벳볼트 몸통 옆면 줄들: 아래 끝 → 위 (머리 밑면 z=0). 반환 (rows, 마지막 반지름)"""
    if round_body:
        rows = [(rb - 0.5, -L), (rb, -L + 0.5)]
        if groove:                                  # 변형부 (얇은 홈)
            rows += [(rb, -L + 6.0), (rb - 0.25, -L + 6.8), (rb - 0.25, -L + 9.2), (rb, -L + 10.0)]
        if ribs:
            rows += [(rb, -4.6), (_ribbed(rb), -4.0), (_ribbed(rb), -0.05), (rb, 0.0)]
        else:
            rows += [(rb, 0.0)]
    else:
        rh = hex_r(_N, s_hex)
        rows = [(rh * 0.93, -L), (rh, -L + 0.5), (rh, 0.0)]
    return rows


def _flange_rows(rf, hh):
    return [(rf - 0.4, 0.0), (rf, 0.4), (rf, hh - 0.4), (rf - 0.4, hh)]


def _rivnut(round_body=True, D=6.0, Pt=1.0, L=16.0):
    rb, rf, hh, s_hex = 4.5, 6.4, 1.4, 9.0
    rc = D / 2 + 0.15 * Pt
    rows = [(rc, -L)] + _body_outline(round_body, rb, s_hex, L) + _flange_rows(rf, hh) + [(rc, hh)]
    mesh = (body_rows(rows, _N) + thread_bore(D, Pt, -L, hh, N=_N)).weld()
    m = bl.Model('rivnut')
    m.add(mesh, 'body', sharp=34)
    return m


@family('rivnut', looks=['ZW', 'SS', 'AL', 'PL'])
def rivnut(fid):
    a = ground(_rivnut(True))
    b = ground(_rivnut(False).lie(80))
    put(a, -9, -2)
    put(b, 12, 6)
    return scene(fid, a, b, el=38)


def _rivstud(round_body=True, D=6.0, Pt=1.0, L=14.0, Ls=16.0):
    rb, rf, hh, s_hex = 4.5, 6.4, 1.4, 9.0
    rows = [(0.0, -L)] + _body_outline(round_body, rb, s_hex, L) + _flange_rows(rf, hh)
    rows += thread_rows(_N, D / 2, Pt, hh, hh + Ls, tip0=False, tip1=True, spp=16) + [(0.0, hh + Ls)]
    m = bl.Model('rivstud')
    m.add(body_rows(rows, _N), 'body', sharp=36)
    return m


@family('rivstud', looks=['ZW', 'SS', 'PL'])
def rivstud(fid):
    a = ground(_rivstud(True))
    b = ground(_rivstud(False).lie(78))
    put(a, -9, -2)
    put(b, 17, 8)
    return scene(fid, a, b, el=30)


# ═══ 와이어 나사 인서트 (코일 인서트) ═════════════════════════════════════════
def _coil(Rc=4.25, Pc=1.25, turns=9.0, a=0.68, b=0.56, n_per=56, tang=True):
    """마름모 단면 철사를 감은 코일. 축 +Z, 아래 끝 z=0, 위 끝에 탱(안쪽으로 굽은 꼬리)"""
    n = int(turns * n_per) + 1
    ang = np.linspace(0, turns * TAU, n)
    z = Pc * ang / TAU
    sec = [(a, 0.0), (0.0, b), (-a, 0.0), (0.0, -b)]
    P3 = np.zeros((n, 4, 3))
    for j, (dr, dz) in enumerate(sec):
        rr = Rc + dr
        P3[:, j, 0] = rr * np.cos(ang)
        P3[:, j, 1] = rr * np.sin(ang)
        P3[:, j, 2] = z + dz
    ms = grid(P3, wrap=False, wrap_v=True)
    for i, c in ((0, (Rc * math.cos(ang[0]), Rc * math.sin(ang[0]), z[0])), (n - 1, (Rc * math.cos(ang[-1]), Rc * math.sin(ang[-1]), z[-1]))):
        ms = ms + Mesh(np.vstack([P3[i], [c]]), None, np.array([[k, (k + 1) % 4, 4] for k in range(4)]))
    if tang:
        aE = ang[-1]
        d = np.array([math.cos(aE), math.sin(aE), 0.0])
        p0 = np.array([Rc * math.cos(aE), Rc * math.sin(aE), z[-1]])
        path = np.array([p0 - d * (Rc - 0.9) * t for t in np.linspace(0, 1, 8)])
        ms = ms + sweep(path, [(0.62, 0.0), (0.0, b), (-0.62, 0.0), (0.0, -b)], cap=True)
    return ms.weld(1e-6)


@family('wti', looks=['SS'])
def wire_insert(fid):
    def one():
        m = bl.Model('wti')
        m.add(_coil(), 'body', sharp=30)
        return m
    a = ground(one())
    b = ground(one().lie(72))
    put(a, -8, -3)
    put(b, 10, 6)
    return scene(fid, a, b, el=36)


# ═══ 키 잠금 인서트 ═════════════════════════════════════════════════════════
def _keyinsert(D=8.0, Pi=1.25, Do=12.0, Po=1.75, L=12.0):
    """안 나사 + 바깥 나사 인서트, 윗면에 키 4개. 아래 z=0, 윗면 z=L"""
    rc = D / 2 + 0.15 * Pi
    rows = [(rc, 0.0)] + thread_rows(_N, Do / 2, Po, 0.0, L, spp=16) + [(rc, L)]
    mesh = (body_rows(rows, _N) + thread_bore(D, Pi, 0.0, L, N=_N)).weld()
    m = bl.Model('keyinsert')
    m.add(mesh, 'body', sharp=36)
    for k in range(4):
        key = box(3.2, 2.0, 4.0, r=0.25, rb=0.25, cx=5.6, cz=L - 0.9).rotz(45 + 90 * k)
        m.add(key, 'bright', sharp=40)
    return m


@family('keyinsert', looks=['SS', 'ZW', 'PL'])
def key_insert(fid):
    a = ground(_keyinsert())
    b = ground(_keyinsert().lie(70))
    put(a, -8, -3)
    put(b, 10, 8)
    return scene(fid, a, b, el=36)


# ═══ 목재·플라스틱용 인서트 너트 ══════════════════════════════════════════════
def _wood_flanged(D=6.0, Pt=1.0, L=14.0):
    """플랜지 달린 인서트: 바깥은 굵고 날카로운 산(칼날 나사), 안은 암나사. 플랜지 밑면 z=0"""
    Ro, Po, dep = 5.5, 2.6, 1.85
    rf, hh = 7.4, 1.6
    rc = D / 2 + 0.15 * Pt
    rows = [(rc, -L)] + thread_rows(_N, Ro, Po, -L, 0.0, depth=dep, crest=(0.01, 0.10), tip1=False, spp=24)
    rows += [(rf - 0.4, 0.0), (rf, 0.4), (rf, hh - 0.4), (rf - 0.4, hh), (rc, hh)]
    mesh = (body_rows(rows, _N) + thread_bore(D, Pt, -L, hh, N=_N)).weld()
    m = bl.Model('wood-flange')
    m.add(mesh, 'body', sharp=40)
    return m


def _tee_nut(D=6.0, Pt=1.0):
    """가시너트(티너트): 둥근 플랜지 + 통 + 플랜지 밑면의 삼각 가시 4개. 플랜지 밑면 z=0, 가시는 아래"""
    rf, tf = 9.6, 1.1
    rb, hb = 5.5, 7.5
    rc = D / 2 + 0.15 * Pt
    ztop = tf + hb
    rows = [(rc, 0.0), (rf - 0.4, 0.0), (rf, 0.35), (rf, tf - 0.3), (rf - 0.3, tf), (rb + 0.5, tf), (rb, tf + 0.3),
            (rb, ztop - 0.4), (rb - 0.4, ztop), (rc, ztop)]
    mesh = (body_rows(rows, _N) + thread_bore(D, Pt, 0.0, ztop, N=_N)).weld()
    m = bl.Model('teenut')
    m.add(mesh, 'body', sharp=36)
    for k in range(4):
        tri = np.array([[-1.9, 0.3], [1.9, 0.3], [0.25, -4.8], [-0.25, -4.8]])
        pr = extrude(tri, -0.6, 0.6).rotx(90).move(0, 7.4, 0).rotz(45 + 90 * k - 90)
        m.add(pr, 'body', sharp=40)
    return m


@family('woodinsert', looks=['ZW', 'BR', 'SS'])
def wood_insert(fid):
    a = ground(_wood_flanged())
    b = ground(_tee_nut().rotx(180))         # 가시가 위로 (통이 아래)
    put(a, -12, -2)
    put(b, 13, 4)
    return scene(fid, a, b, el=36)


# ═══ 셀프클린칭 너트 · 스터드 · 스탠드오프 (압입형) ═══════════════════════════════
def _clinch_part(kind, D, Pt, rh, t, rp, ring_in, Lb, name):
    """머리(플랜지) 윗면 둘레에 톱니 클린칭 링 + 홈(언더컷), 가운데 파일럿(너트·스탠드오프) 또는 나사 줄기(스터드).
    kind = 'nut' (파일럿 높이 Lb, 안 나사 관통) | 'stud' (나사 길이 Lb)"""
    ring_h = 0.45
    n_t = 32
    th = theta(_N)
    saw = 2 * np.abs((n_t * th / TAU) % 1.0 - 0.5)        # 0..1 삼각파
    zt = t + ring_h + 0.28 * saw
    zg = t - 0.5                                             # 언더컷 홈 바닥
    rows = [(rh - 0.4, 0.0), (rh, 0.4), (rh, t + ring_h - 0.1), (rh - 0.18, zt), (ring_in + 0.12, zt), (ring_in, zg + 0.0)]
    if kind == 'nut':
        rc = D / 2 + 0.15 * Pt
        top = t + ring_h + Lb
        rows = [(rc, 0.0)] + rows + [(rp + 0.25, zg), (rp, zg + 0.25), (rp, top - 0.4), (rp - 0.4, top), (rc, top)]
        mesh = (body_rows(rows, _N) + thread_bore(D, Pt, 0.0, top, N=_N, spp=12)).weld()
    else:
        top = t + ring_h + Lb
        rows = [(0.0, 0.0)] + rows + thread_rows(_N, D / 2, Pt, zg, top, tip0=False, tip1=True, spp=14) + [(0.0, top)]
        mesh = body_rows(rows, _N)
    m = bl.Model(name)
    m.add(mesh, 'body', sharp=34)
    return m


@family('clinch', looks=['ZW', 'SS', 'AL', 'BR'])
def clinch(fid):
    nut = ground(_clinch_part('nut', 5.0, 0.8, 4.9, 3.0, 3.5, 3.95, 2.4, 'cnut'))
    stud = ground(_clinch_part('stud', 5.0, 0.8, 4.6, 2.4, 2.9, 3.85, 14.0, 'cstud'))
    sdf = ground(_clinch_part('nut', 4.0, 0.7, 5.0, 2.4, 3.4, 4.1, 12.0, 'csdf'))
    put(sdf, -15, -6)
    put(nut, 0, 8)
    put(stud, 14, -5)
    return scene(fid, sdf, nut, stud, el=34)


# ═══ 육각 서포트 (스페이서): 암-수 · 암-암 ═══════════════════════════════════════
def _hex_standoff(male, D=4.0, Pt=0.7, s=7.0, L=20.0, Ls=8.0, depth=11.0):
    """육각 몸통 z=0…L. male=True: 아래 암나사(depth) + 위 수나사 스터드 Ls. False: 양쪽 관통 암나사"""
    rc = D / 2 + 0.15 * Pt
    rc_ch = s / 2 * 0.95
    rh = hex_r(_N, s)
    zc = np.maximum(rh - rc_ch, 0) * math.tan(math.radians(30))
    rows = [(rc, 0.0), (rc_ch, 0.0), (rh, zc), (rh, L - zc), (rc_ch, L), ((0.0 if male else rc), L)]
    m = bl.Model('standoff')
    body = body_rows(rows, _N)
    if male:
        mesh = (body + thread_bore(D, Pt, 0.0, depth, N=_N, csk1=True) + lathe([(rc, depth), (0.0, depth)], _N)).weld()
        m.add(mesh, 'body', sharp=36)
        m.add(body_rows([(0.0, L - 0.6)] + thread_rows(_N, D / 2, Pt, L - 0.6, L + Ls, tip0=False, tip1=True, spp=16) + [(0.0, L + Ls)], _N), 'body', sharp=36)
    else:
        m.add((body + thread_bore(D, Pt, 0.0, L, N=_N)).weld(), 'body', sharp=36)
    return m


@family('standoff')
def standoff(fid):
    a = ground(_hex_standoff(False))
    b = ground(_hex_standoff(True))
    put(a, -9, 3)
    put(b, 9, -3)
    return scene(fid, a, b, el=34)
