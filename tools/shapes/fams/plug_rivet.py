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
    put(a, 0, 12)
    put(b, 3, -16)
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
