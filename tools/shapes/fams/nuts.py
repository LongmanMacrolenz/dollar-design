"""너트류 22종: 육각 변형(hn2·hnthin·ihn·mhh·hh) · 풀림방지(nyloc·allmetal) · 캐슬·캡·플랜지·나비·아이·커플링 · 사각·용접·지그 ·
T홈·채널·케이지·프로파일 · 펌프 축 너트 · 베어링 로크너트(KM·인치+와셔).

치수는 대표 호칭(M12 / 1/2") 공칭 치수 기준의 그림용 값입니다. 보조 함수(_로 시작)는 이 모듈 안에서만 씁니다.
"""
import math

import numpy as np

import bl
import parts as P
from fams import family
from geo import *


# ── 보조 ────────────────────────────────────────────────────────────────
def _hr(D, pt):
    """육각 구멍 고리 반지름 (hex_nut_mesh·thread_bore의 카운터싱크 시작 반지름과 같다 → weld 됨)"""
    return D / 2 + 0.15 * pt


def _clathe(pts, N=96, rmod=None):
    """(r, z) 윤곽을 닫아서 Z축으로 돌린 닫힌 회전체"""
    pts = [tuple(float(v) for v in p) for p in pts]
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return lathe(pts, N, rmod=rmod)


def _arc(cr, cz, rad, a0, a1, n=8):
    """(r, z) 평면의 원호 점 목록 (각도 도)"""
    return [(cr + rad * math.cos(math.radians(a)), cz + rad * math.sin(math.radians(a))) for a in np.linspace(a0, a1, n)]


# 윤곽 (u, v) = (y, z) 를 x 방향으로 압출할 때 (x, y, z) = (w, u, v)로 바꾸는 행렬
_M_PROFILE = np.array([[0, 0, 1], [1, 0, 0], [0, 1, 0]], float)


def _prism(outline_uv, w0, w1, holes=()):
    return extrude(outline_uv, w0, w1, holes=holes).tf(_M_PROFILE)


def _polar(profile, N, zmod=None):
    """profile [(r, z, w)] 를 Z축 둘레로 돌리되, z 에 w·zmod(θ) 를 더함 (세레이션 톱니)"""
    pr = np.asarray(profile, float)
    th = theta(N)[:, None]
    r = np.broadcast_to(pr[:, 0][None, :], (N, len(pr)))
    z = pr[:, 1][None, :] + (pr[:, 2][None, :] * zmod(th) if zmod is not None else 0.0)
    z = np.broadcast_to(z, r.shape)
    return grid(np.stack([r * np.cos(th), r * np.sin(th), z], -1), wrap=True).weld()


def _hull2(c0, r0, c1, r1, n=14):
    """두 원(중심 c0·c1, 반지름 r0·r1)의 볼록 껍질 윤곽 (반시계). 나비너트 날개용"""
    d = math.hypot(c1[0] - c0[0], c1[1] - c0[1])
    beta = math.atan2(c1[1] - c0[1], c1[0] - c0[0])
    gam = math.acos((r0 - r1) / d)
    pts = []
    for a in np.linspace(beta - gam, beta + gam, n):
        pts.append((c1[0] + r1 * math.cos(a), c1[1] + r1 * math.sin(a)))
    for a in np.linspace(beta + gam, beta - gam + 2 * math.pi, n + 4):
        pts.append((c0[0] + r0 * math.cos(a), c0[1] + r0 * math.sin(a)))
    return np.array(pts)


def _sq_nut(s, m_, D, pt, z0=0.0, rho=0.4, top=0.97, bot=None, ch=25.0):
    """사각너트 (나사 구멍 포함). 맞변 s, 높이 m_. 모따기 원은 맞변 원(s/2)을 넘지 않게"""
    rh = _hr(D, pt)
    body = polybody(4, s, z0, z0 + m_, rc_top=s / 2 * top, rc_bot=None if bot is None else s / 2 * bot, hole_top=rh, hole_bot=rh, rho=rho, ch_deg=ch)
    return body + thread_bore(D, pt, z0, z0 + m_)


# ── 육각 변형: 스타일 2 · 낮은 너트 · 미터 헤비 · 인치 헤비 ──────────────────────────────
@family('hn2', 'hnthin', 'mhh', 'hh')
def hex_nut_variants(fid):
    D, s, h, pt = {
        'hn2': (12, 18.0, 12.3, 1.75),                   # ISO 4033 스타일 2 (M12: 높이 12.3)
        'hnthin': (12, 18.0, 6.0, 1.75),                 # ISO 4035 낮은 너트 (M12: 높이 6)
        'mhh': (20, 34.0, 20.0, 2.5),                    # ASME B18.2.4.6M 헤비 (M20: 맞변 34, 높이 20)
        'hh': (12.7, 22.23, 12.3, 25.4 / 13),            # A194 2H 1/2"-13: 맞변 7/8", 높이 31/64"
    }[fid]
    m = bl.Model(fid)
    m.add(P.hex_nut_mesh(D, s, h, P=pt), 'body', sharp=24)
    return m.view(el=44 if fid == 'hnthin' else 42)


@family('ihn')
def inch_hex_and_jam(fid):
    """1/2"-13 UNC: 육각너트(높이 7/16") + 잼너트(5/16"), 나란히"""
    D, s, pt = 12.7, 19.05, 25.4 / 13
    m = bl.Model(fid)
    a = math.radians(52)                                  # 화면 가로 방향 (카메라 기본 방위 기준)
    ux, uy = math.cos(a), math.sin(a)
    for h, k in ((11.11, -1), (7.94, +1)):
        m.add(P.hex_nut_mesh(D, s, h, P=pt).move(k * 13.0 * ux, k * 13.0 * uy), 'body', sharp=24)
    return m.view(el=42)


# ── 나일론 인서트 너트 ──────────────────────────────────────────────────────
@family('nyloc')
def nylon_insert_nut(fid):
    D, s, H, h1 = 12, 18.0, 12.0, 8.4                     # ISO 10511 계열: 맞변 18, 전체 높이 12 (육각 8.4 + 둥근 목)
    pt = P.pitch(D)
    rh = _hr(D, pt)
    rcol, r_lip, rr = 8.2, 5.9, 1.9
    m = bl.Model(fid)
    hexp = polybody(6, s, 0, h1, rc_top=rcol, rc_bot=s / 2 * 0.95, hole_top=rh, hole_bot=rh) + thread_bore(D, pt, 0, h1)
    m.add(hexp, 'body', sharp=24)
    # 둥근 목(칼라): 위가 둥글게 말려 들어가 나일론 링 가장자리를 물고 있다
    pts = [(r_lip, h1), (rcol, h1), (rcol, H - rr)] + _arc(rcol - rr, H - rr, rr, 0, 90, 9)[1:]
    pts += [(r_lip + 0.25, H), (r_lip, H - 0.25)]
    m.add(_clathe(pts, 128), 'body', sharp=40)
    # 나일론 링: 윗면이 철 가장자리보다 약간 낮고, 안지름이 나사 골지름보다 작다
    ri, zt = 4.5, H - 0.8
    ring = [(ri, h1), (r_lip, h1), (r_lip, zt - 0.5), (r_lip - 0.4, zt), (ri + 0.5, zt), (ri, zt - 0.5)]
    m.add(_clathe(ring, 96), 'nylon', sharp=45)
    return m.view(el=44)


# ── 전금속 풀림방지 너트 (위쪽이 타원으로 눌린 프리베일링 토크형) ───────────────────────────
@family('allmetal')
def all_metal_lock_nut(fid):
    D, s, H, h1 = 12, 18.0, 13.0, 9.2                     # ISO 7042: 높이 약 13
    pt = P.pitch(D)
    rh = _hr(D, pt)
    ri, rb = 5.45, 8.2
    m = bl.Model(fid)
    hexp = polybody(6, s, 0, h1, rc_top=rb, rc_bot=s / 2 * 0.95, hole_top=rh, hole_bot=rh) + thread_bore(D, pt, 0, h1)
    m.add(hexp, 'body', sharp=24)

    def squeeze(th, r, z):                                # 위로 갈수록 한쪽(x 방향)이 눌려 타원이 된다
        u = np.clip((z - h1) / (H - h1), 0, 1) ** 1.1
        k = np.where(r < 6.6, 0.30, 0.11)
        return r * (1 - k * u * (0.5 + 0.5 * np.cos(2 * th)))

    pts = [(ri, h1), (rb, h1), (7.9, h1 + 1.6), (7.6, H - 1.0), (7.3, H - 0.45), (6.9, H - 0.1), (6.6, H),
           (ri + 0.55, H), (ri + 0.1, H - 0.4)]
    pts += [(ri, h1 + (H - 0.8 - h1) * f) for f in (0.8, 0.6, 0.4, 0.2)]
    m.add(_clathe(pts, 128, rmod=squeeze), 'body', sharp=40)
    m.rotz(-38)                                           # 눌린 방향(x)이 카메라 쪽, 평평한 면이 정면
    return m.view(el=44)


# ── 캐슬너트 (육각 아래 + 홈 6개 원통 위) ───────────────────────────────────────
@family('castle')
def castle_nut(fid):
    D, s, H, h1 = 12, 19.0, 12.0, 7.0                     # DIN 935 M12: 맞변 19
    pt = P.pitch(D)
    rh = _hr(D, pt)
    ro, ri, ch = 8.9, 5.5, 0.8
    m = bl.Model(fid)
    hexp = polybody(6, s, 0, h1, rc_top=ro, rc_bot=s / 2 * 0.95, hole_top=rh, hole_bot=rh) + thread_bore(D, pt, 0, h1)
    m.add(hexp, 'body', sharp=24)
    ring = _clathe([(ri, h1), (ro, h1), (ro, H - ch), (ro - ch, H), (ri + 0.4, H), (ri, H - 0.4)], 144)
    n = 3.6                                               # 홈 폭
    cutters = [box(2 * ro + 4, n, (H - h1) + 1.5, cz=(H + h1) / 2 + 0.25).rotz(a) for a in (30, 90, 150)]
    m.add(ring, 'body', sharp=35, cut=cutters)
    return m.view(el=45)


# ── 캡너트 (둥근 모자) ───────────────────────────────────────────────────
@family('capnut')
def cap_nut(fid):
    D, s, hh, H = 12, 19.0, 12.0, 22.0                    # DIN 1587 M12: 전체 높이 22, 맞변 19
    pt = P.pitch(D)
    rh = _hr(D, pt)
    rcz = 8.7
    m = bl.Model(fid)
    zb = 10.0                                             # 막힌 나사 깊이
    hexp = polybody(6, s, 0, hh, rc_top=rcz, rc_bot=s / 2 * 0.95, hole_bot=rh) + thread_bore(D, pt, 0, zb)
    hexp = hexp + lathe([(0, zb), (rh, zb)], 192)
    m.add(hexp, 'body', sharp=24)
    zc = hh + 1.6
    dome = [(0, hh), (rcz, hh), (rcz, zc)]
    b = H - zc
    dome += [(rcz * math.cos(math.radians(a)), zc + b * math.sin(math.radians(a))) for a in np.linspace(8, 90, 20)]
    dome[-1] = (0, H)
    m.add(lathe(dome, 128), 'body', sharp=45)
    return m.view(el=36)


# ── 플랜지 너트 (세레이션) ────────────────────────────────────────────────
@family('flangenut')
def flange_nut(fid):
    D, s, H, dc = 12, 18.0, 11.8, 29.8                    # ISO 4161 M12: 맞변 18, 플랜지 지름 약 29.8
    pt = P.pitch(D)
    rh = _hr(D, pt)
    rf = dc / 2
    zr = 2.5                                              # 플랜지 가장자리 두께
    tn = math.tan(math.radians(15))
    zt = lambda r: zr + (rf - 0.35 - r) * tn              # 위쪽 면은 안쪽으로 15° 올라간다
    nt, A = 42, 0.7                                       # 세레이션 톱니 수, 높이

    def saw(th):                                          # 한 방향 톱니 (래칫): 바닥에서 아래로 튀어나온 능선
        return -A * ((th * nt / TAU) % 1.0)

    prof = [(rh, 0.0, 0.0), (9.4, 0.0, 0.0), (10.4, 0.0, 1.0), (rf, 0.0, 1.0), (rf, zr - 0.25, 0.0), (rf - 0.35, zr, 0.0),
            (9.2, zt(9.2), 0.0), (rh, zt(rh), 0.0)]
    m = bl.Model(fid)
    m.add(_polar(prof, nt * 8, saw), 'body', sharp=38)
    hexp = polybody(6, s, 1.5, H, rc_top=s / 2 * 0.95, hole_top=rh, hole_bot=rh) + thread_bore(D, pt, 0, H)
    m.add(hexp, 'body', sharp=24)
    return m.view(el=34)


# ── 나비너트 ────────────────────────────────────────────────────────────
@family('wing')
def wing_nut(fid):
    D, pt = 12, P.pitch(12)                               # DIN 315 M12 계열: 너비 약 60, 높이 약 30
    rh = _hr(D, pt)
    hubr, hubh = 10.8, 13.5
    m = bl.Model(fid)
    hub = _clathe([(rh, 0), (hubr - 0.8, 0), (hubr, 0.8), (hubr, hubh - 1.2), (hubr - 1.2, hubh), (rh, hubh)], 128)
    m.add(hub + thread_bore(D, pt, 0, hubh), 'body', sharp=35)
    wing = _hull2((9.5, 7.2), 7.2, (25.0, 21.5), 5.2)    # 안쪽 큰 원 + 바깥 작은 원의 볼록 껍질: 비스듬히 선 귀 모양
    wing[:, 0] = np.maximum(wing[:, 0], 8.0)              # 허브 안쪽(나사 구멍 쪽)으로는 들어가지 않게 자른다
    t = 5.2
    for sg in (1, -1):
        w = extrude(wing * np.array([sg, 1.0]), -t / 2, t / 2).rotx(90)
        m.add(w, 'body', sharp=40, bevel=0.55)
    m.rotz(30)                                            # 날개 면이 카메라를 보도록
    return m.view(el=34)


# ── 인양용 아이너트 ──────────────────────────────────────────────────────
@family('eyenut')
def eye_nut(fid):
    D, pt = 12, P.pitch(12)                               # DIN 582 M12: 전체 높이 53, 고리 바깥 54·안 30
    rh = _hr(D, pt)
    rc, hc = 15.0, 12.5
    Rm, rt = 20.5, 6.0
    zc = Rm + rt                                          # 고리 아래 끝이 z=0
    m = bl.Model(fid)
    collar = _clathe([(rh, 0), (rc - 0.8, 0), (rc, 0.8), (rc, hc - 2.0), (rc - 1.5, hc), (rh, hc)], 128)
    m.add(collar, 'body', sharp=35)
    ring = torus(Rm, rt, N=112, n=28).rotx(90).move(z=zc)
    m.add(ring, 'body', sharp=45, cut=[cyl(rh, -1.0, hc + 6.0, N=96)])
    m.add(thread_bore(D, pt, 0, hc), 'body', sharp=40)
    m.rotz(-105)                                          # 고리 면이 카메라를 향하도록
    return m.view(el=26, fill=0.8)


# ── 커플링너트 (롱너트) ──────────────────────────────────────────────────
@family('coupling')
def coupling_nut(fid):
    D, s, h = 12, 19.0, 36.0                              # DIN 6334: 높이 3d, M12 맞변 19
    m = bl.Model(fid)
    m.add(P.hex_nut_mesh(D, s, h), 'body', sharp=24)
    return m.view(el=46)


# ── 사각너트 ────────────────────────────────────────────────────────────
@family('sqnut')
def square_nut(fid):
    D, s, h = 12, 19.0, 10.0                              # DIN 557 M12: 맞변 19, 높이 10
    m = bl.Model(fid)
    m.add(_sq_nut(s, h, D, P.pitch(D)), 'body', sharp=24)
    m.rotz(12)
    return m.view(el=42)


# ── 용접너트 (육각, 용접면 돌기 3개) — 돌기가 보이도록 용접면을 위로 ────────────────────────
@family('weldnut', looks=['PL'])
def weld_nut(fid):
    D, s, h = 12, 19.0, 10.0                              # DIN 929 M12: 맞변 19
    pt = P.pitch(D)
    rh = _hr(D, pt)
    m = bl.Model(fid)
    # 바닥 쪽 = 모따기 면, 위쪽 = 용접면(평평, 모서리만 살짝 깎음) + 돌기 3개 (번갈아 있는 모서리)
    body = polybody(6, s, 0, h, rc_top=s / 2 * 0.995, rc_bot=s / 2 * 0.95, hole_top=rh, hole_bot=rh) + thread_bore(D, pt, 0, h)
    m.add(body, 'body', sharp=24)
    pim = [(0, h - 0.3), (2.2, h - 0.3), (2.2, h), (1.55, h + 1.1), (1.25, h + 1.3), (0, h + 1.3)]
    for a in (30, 150, 270):
        x, y = 8.3 * math.cos(math.radians(a)), 8.3 * math.sin(math.radians(a))
        m.add(lathe(pim, 48).move(x, y), 'body', sharp=40)
    m.rotz(-8)
    return m.view(el=40)


# ── 지그용 높은 육각너트 (1.5d, 칼라붙이) ─────────────────────────────────────
@family('fixturenut')
def fixture_nut(fid):
    D, s, h = 12, 19.0, 18.0                              # DIN 6331 M12: 높이 1.5d, 맞변 19, 칼라 지름 약 25
    pt = P.pitch(D)
    rh = _hr(D, pt)
    rcol, tc = 12.5, 3.0
    m = bl.Model(fid)
    collar = _clathe([(rh, 0), (rcol - 0.5, 0), (rcol, 0.5), (rcol, tc - 0.4), (rcol - 0.4, tc), (rh, tc)], 128)
    m.add(collar, 'body', sharp=38)
    hexp = polybody(6, s, tc, h, rc_top=s / 2 * 0.93, hole_top=rh, hole_bot=rh) + thread_bore(D, pt, 0, h)
    m.add(hexp, 'body', sharp=24)
    return m.view(el=44)


# ── T홈 너트 (공작기계 T홈 · DIN 508) ───────────────────────────────────────
@family('tnut')
def t_slot_nut(fid):
    D, pt = 12, P.pitch(12)                               # DIN 508 M12 × 홈 14: 머리(넓은 쪽) 폭 22, 목 폭 약 13.5, 전체 높이 16
    rh = _hr(D, pt)
    L, hb, hn_, wb, wn = 34.0, 7.0, 16.0, 22.0, 13.5
    a, b = wb / 2, wn / 2
    prof = [(-a + 0.6, 0), (a - 0.6, 0), (a, 0.6), (a, hb - 0.6), (a - 0.6, hb), (b, hb), (b, hn_ - 0.6), (b - 0.6, hn_),
            (-b + 0.6, hn_), (-b, hn_ - 0.6), (-b, hb), (-a + 0.6, hb), (-a, hb - 0.6), (-a, 0.6)]
    body = _prism(np.array(prof), -L / 2, L / 2)
    m = bl.Model(fid)
    m.add(body, 'body', sharp=30, bevel=0.35, cut=[cyl(rh, -1.0, hn_ + 1.0, N=96)])
    m.add(thread_bore(D, pt, 0, hn_), 'body', sharp=40)
    m.rotz(70)
    return m.view(el=40)


# ── 채널 너트 (스프링 달린 C형강 채널용) ─────────────────────────────────────
@family('channelnut')
def channel_nut(fid):
    D, pt = 10, P.pitch(10)                               # 1/2" 채널 너트 크기: 길이 38, 폭 22, 두께 11
    rh = _hr(D, pt)
    L, W, T = 38.0, 22.0, 11.0
    Rs, rw, Hs, turns = 7.6, 0.9, 25.0, 5.0
    m = bl.Model(fid)
    # 스프링: 양 끝 코일이 촘촘한 원통 코일
    u = np.linspace(0, 1, 420)
    zz = rw + (Hs - 2 * rw) * (u - 0.07 * np.sin(TAU * u))
    ang = u * turns * TAU
    path = np.c_[Rs * np.cos(ang), Rs * np.sin(ang), zz]
    m.add(wire(path, rw, n=10), 'body', sharp=50)
    z0 = Hs
    plate = extrude(rect2d(L, W, r=1.4), z0, z0 + T)
    m.add(plate, 'body', sharp=30, bevel=0.35, cut=[cyl(rh, z0 - 1.0, z0 + T + 3.0, N=96)])
    m.add(thread_bore(D, pt, z0, z0 + T), 'body', sharp=40)
    # 채널 입술에 걸리는 윗면 양 끝의 톱니 능선
    nt, y0, pitch_t, ht = 10, -W / 2 + 0.7, (W - 1.4) / 10, 1.5
    zt = z0 + T
    out = [(y0, zt - 0.6), (y0 + nt * pitch_t, zt - 0.6)]
    for i in range(nt, 0, -1):
        out.append((y0 + i * pitch_t, zt))
        out.append((y0 + (i - 0.5) * pitch_t, zt + ht))
    out.append((y0, zt))
    for sg in (1, -1):
        xa, xb = sorted((sg * (L / 2 - 7.0), sg * (L / 2 - 1.0)))
        m.add(_prism(np.array(out), xa, xb), 'body', sharp=30)
    m.rotz(32)
    return m.view(el=40)


# ── 케이지 너트 (판넬·랙용: 사각 스프링 클립 + 사각 너트) ───────────────────────────
@family('cagenut')
def cage_nut(fid):
    D, pt = 6, 1.0                                        # M6 케이지 너트 (사각 구멍 9.5)
    t = 0.8                                               # 클립 판 두께
    Wd, Lb = 11.8, 22.0
    m = bl.Model(fid)
    base = extrude(rect2d(Lb, Wd, r=1.0), 0, t, holes=[circle2d(3.5, 48)])
    m.add(base, 'body', sharp=40)
    for sg in (1, -1):                                    # 너트를 감싸는 옆벽 + 너트 윗면 가장자리를 덮는 안쪽 접이
        m.add(box(13.0, t, 6.8, cy=sg * (Wd / 2 - t / 2), cz=6.8 / 2, rb=0.15), 'body', sharp=40, bevel=0.1)
        m.add(box(13.0, 1.7, t, cy=sg * (Wd / 2 - t - 0.8), cz=6.8 - t / 2, rb=0.15), 'body', sharp=40, bevel=0.1)
    ang, wl = 30.0, 8.5
    for sg in (1, -1):                                    # 구멍에 걸리는 양 끝의 기울어진 스프링 날개
        wing = box(wl, Wd - 2.4, t, rb=0.1)
        wing = wing.roty(-sg * ang)
        cx = sg * (Lb / 2 + wl / 2 * math.cos(math.radians(ang)) - 0.5)
        cz = wl / 2 * math.sin(math.radians(ang)) + t / 2
        m.add(wing.move(cx, 0, cz), 'body', sharp=40, bevel=0.1)
    nut = _sq_nut(10.0, 5.0, D, pt, z0=t + 0.05, rho=0.3, top=0.92, bot=0.98)
    m.add(nut, 'steel', sharp=24)
    m.rotz(24)
    return m.view(el=42)


# ── 알루미늄 프로파일용 T너트·볼트 ────────────────────────────────────────────
@family('profilenut')
def profile_t_nut(fid):
    D, pt = 6, 1.0                                        # 30시리즈(홈 8) M6 슬롯 너트: 20 × 15.5 × 5
    rh = _hr(D, pt)
    L, W, T = 20.0, 15.5, 5.0
    a = W / 2
    prof = [(-a, 0), (a, 0), (a, 3.0), (a - 1.9, T), (-a + 1.9, T), (-a, 3.0)]
    m = bl.Model(fid)
    nut = _prism(np.array(prof), -L / 2, L / 2)
    m.add(nut, 'body', sharp=30, bevel=0.25, cut=[cyl(rh, -1.0, T + 1.0, N=96)])
    m.add(thread_bore(D, pt, 0, T), 'body', sharp=40)
    # 장면은 화면 기준 좌표(x'=오른쪽, y'=안쪽)로 짜고, 마지막에 카메라 방위에 맞춰 돌린다
    m.rotz(-8).move(-5.0, -7.0, 0)
    # 뒤에 눕혀 놓은 M6×14 버튼머리 육각 구멍 볼트 (ISO 7380)
    dk, k, sx, Ls = 10.5, 3.3, 4.0, 14.0
    head = lathe([(0, k), (dk / 2 - 1.5, k), (dk / 2 - 0.55, k - 0.4), (dk / 2, k - 1.4), (dk / 2, 0.4), (dk / 2 - 0.4, 0), (0, 0)], 96)
    scr = bl.Model(fid + '-screw')
    scr.add(head, 'body', sharp=35, cut=[P.cut_hex(sx, 2.2, z_top=k)])
    scr.add(thread_rod(D, pt, -Ls, 0.0, tip1=False), 'body', sharp=40)
    scr.roty(-90).move(3.0, 10.0, dk / 2)                 # 머리가 왼쪽, 머리 밑이 바닥에 닿게
    m.extend(scr)
    m.rotz(44)
    return m.view(el=42)


# ── 펌프 축 너트 (임펠러 너트: 칼라 + 렌치 평면 + 둥근 캡) ────────────────────────────
@family('oemnut', looks=['SS', 'PL'])
def impeller_nut(fid):
    m = bl.Model(fid)
    rc, hc = 19.0, 6.0                                    # 칼라: 지름 38, 두께 6, 가장자리에 풀림방지 홈 4개
    rb, hb, H = 15.0, 20.0, 29.5                          # 몸통 지름 30, 둥근 캡 윗면 29.5
    collar = _clathe([(0, 0), (rc - 0.9, 0), (rc, 0.9), (rc, hc - 0.5), (rc - 0.5, hc), (0, hc)], 128)
    notch = [box(5.5, 5.4, 4.6, cx=rb + 2.75, cz=hc - 3.4 + 2.3).rotz(a) for a in (45, 135, 225, 315)]
    m.add(collar, 'body', sharp=40, cut=notch)
    zc = hb
    prof = [(0, hc), (rb, hc), (rb, zc)]
    b = H - zc
    prof += [(rb * math.cos(math.radians(a)), zc + b * math.sin(math.radians(a))) for a in np.linspace(6, 90, 20)]
    prof[-1] = (0, H)
    flats = [box(8.0, 40.0, hb - hc + 2.0, cx=sg * (11.8 + 4.0), cz=(hb + hc) / 2 + 0.3) for sg in (1, -1)]
    m.add(lathe(prof, 144), 'body', sharp=40, cut=flats)
    m.rotz(-30)
    return m.view(el=36)


# ── 베어링 로크너트 KM (바깥에 홈 4개) ───────────────────────────────────────
def _slotted_ring(D, pt, ro, B, bslot, hslot, ch, N=192):
    """바깥에 축 방향 홈 4개가 있는 원형 너트 → (몸체, 홈 커터들, 나사)"""
    rh = _hr(D, pt)
    ring = _clathe([(rh, 0), (ro - ch, 0), (ro, ch), (ro, B - ch), (ro - ch, B), (rh, B)], N)
    cut = [box(hslot + 2.0, bslot, B + 2.0, cx=ro - hslot + (hslot + 2.0) / 2, cz=B / 2).rotz(a) for a in (0, 90, 180, 270)]
    return ring, cut, thread_bore(D, pt, 0, B)


@family('kmnut')
def km_nut(fid):
    D, pt = 40, 1.5                                       # KM8: M40×1.5, 바깥지름 58, 폭 9, 홈 폭 7·깊이 2.2
    ring, cut, thr = _slotted_ring(D, pt, 29.0, 9.0, 7.0, 2.2, 0.8)
    m = bl.Model(fid)
    m.add(ring, 'body', sharp=35, cut=cut)
    m.add(thr, 'body', sharp=40)
    m.rotz(-38)
    return m.view(el=46)


# ── 인치 베어링 로크너트(N·AN) + 로크와셔(W) ───────────────────────────────────
def _lock_washer(r_in, r_body, r_tab, ntab, hw_deg, tw, skip=(), tang_deg=180.0, tang_r=None, tang_w=4.4):
    """내부 키 탭 1개 + 바깥 탭 ntab 개인 평 와셔 (z=0..tw). skip = 비워 둘 탭 번호"""
    n = 1800
    th = np.linspace(0, TAU, n, endpoint=False)
    pitch_a = TAU / ntab
    k = np.round(th / pitch_a).astype(int) % ntab
    d = np.abs(((th + pitch_a / 2) % pitch_a) - pitch_a / 2)
    in_tab = (d < math.radians(hw_deg)) & ~np.isin(k, list(skip))
    ro = np.where(in_tab, r_tab, r_body)
    outline = np.c_[ro * np.cos(th), ro * np.sin(th)]
    tang_r = tang_r if tang_r is not None else r_in - 2.3
    dt = np.abs(((th - math.radians(tang_deg) + math.pi) % TAU) - math.pi)
    ri = np.where(dt < tang_w / 2 / r_in, tang_r, r_in)
    hole = np.c_[ri * np.cos(th), ri * np.sin(th)]
    return extrude(outline, 0, tw, holes=[hole])


@family('ilocknut', looks=['PL'])
def inch_locknut_pair(fid):
    D, pt = 40.0, 25.4 / 18                               # AN08/N08: 1.5748"-18 UNS, 바깥 약 56, 두께 8
    ro, B = 28.0, 8.0
    tw = 1.2
    m = bl.Model(fid)
    # 와셔: 탭 12개 중 0번 탭은 너트 홈으로 꺾어 올린 모양으로 따로 세운다
    wsh = _lock_washer(20.4, 26.2, 31.4, 12, 5.8, tw, skip=(0,), tang_deg=180.0)
    m.add(wsh, 'body', sharp=40)
    rtab = 26.2
    bent = box(1.2, 5.6, 7.4, cx=rtab, cz=7.4 / 2, rb=0.15)
    m.add(bent, 'body', sharp=40)
    ring, cut, thr = _slotted_ring(D, pt, ro, B, 6.35, 2.4, 0.7)
    m.add(ring.move(z=tw), 'body', sharp=35, cut=[c.move(z=tw) for c in cut])
    m.add(thr.move(z=tw), 'body', sharp=40)
    m.rotz(-36)                                           # 꺾인 탭과 너트 홈이 카메라 쪽
    return m.view(el=44)
