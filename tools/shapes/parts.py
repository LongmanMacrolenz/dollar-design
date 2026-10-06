"""공용 부품 헬퍼 (치수는 ISO 공칭 치수 기준 · 그림용). geo.py의 프리미티브를 조립합니다.

  pitch(d)              미터 보통나사 피치
  ISO_HEX[d]            (맞변 s, 머리 높이 k)      ISO 4017/4014
  ISO_NUT[d]            (맞변 s, 높이 m)           ISO 4032
  ISO_WASH[d]           (안지름, 바깥지름, 두께)    ISO 7089
  ISO_SHCS[d]           (머리 지름 dk, 높이 k, 육각 s, 깊이 t)   ISO 4762
  hex_bolt / hex_nut / washer / ...   Model에 add() 할 메시 목록을 돌려주는 기본형
  cut_hex / cut_cross / cut_slot / cut_torx    구멍 커터 (불리언 DIFFERENCE에 쓴다)
모든 부품은 축이 +Z, 머리(또는 아래 면)가 z=0 근처에서 시작합니다.
"""
import math

import numpy as np

import geo
from geo import (Mesh, TAU, box, circle2d, cyl, dome, extrude, join, lathe, polybody, rpoly_r, sphere, thread_bore, thread_rod, torus, tube)

PITCH = {2: .4, 2.5: .45, 3: .5, 4: .7, 5: .8, 6: 1, 8: 1.25, 10: 1.5, 12: 1.75, 14: 2, 16: 2, 18: 2.5, 20: 2.5, 22: 2.5, 24: 3, 27: 3, 30: 3.5, 36: 4, 42: 4.5, 48: 5}
ISO_HEX = {3: (5.5, 2), 4: (7, 2.8), 5: (8, 3.5), 6: (10, 4), 8: (13, 5.3), 10: (16, 6.4), 12: (18, 7.5), 14: (21, 8.8), 16: (24, 10), 20: (30, 12.5), 24: (36, 15), 30: (46, 18.7), 36: (55, 22.5)}
ISO_NUT = {3: (5.5, 2.4), 4: (7, 3.2), 5: (8, 4.7), 6: (10, 5.2), 8: (13, 6.8), 10: (16, 8.4), 12: (18, 10.8), 14: (21, 12.8), 16: (24, 14.8), 20: (30, 18), 24: (36, 21.5), 30: (46, 25.6), 36: (55, 31)}
ISO_WASH = {3: (3.2, 7, .5), 4: (4.3, 9, .8), 5: (5.3, 10, 1), 6: (6.4, 12, 1.6), 8: (8.4, 16, 1.6), 10: (10.5, 20, 2), 12: (13, 24, 2.5), 14: (15, 28, 2.5), 16: (17, 30, 3), 20: (21, 37, 3), 24: (25, 44, 4), 30: (31, 56, 4), 36: (37, 66, 5)}
ISO_SHCS = {3: (5.5, 3, 2.5, 1.3), 4: (7, 4, 3, 2), 5: (8.5, 5, 4, 2.5), 6: (10, 6, 5, 3), 8: (13, 8, 6, 4), 10: (16, 10, 8, 5), 12: (18, 12, 10, 6), 14: (21, 14, 12, 7), 16: (24, 16, 14, 8), 20: (30, 20, 17, 10), 24: (36, 24, 19, 12)}


def pitch(d):
    return PITCH.get(d, d * 0.15)


# ── 구멍 커터 ────────────────────────────────────────────────────────────
def cut_hex(s, depth, z_top=0.0, cone=True, extra=1.0):
    """육각 구멍 커터: 맞변 s, 위(z_top)에서 depth 만큼 판다. 바닥은 118° 원뿔"""
    R = s / math.sqrt(3)
    body = polybody(6, s, z_top - depth, z_top + extra, rho=0.0, N=48, th0=0.0)
    out = [body]
    if cone:   # 바닥 118° 원뿔 (밑이 육각 안으로 들어가도록 윗면을 조금 올려 겹친다)
        out.append(lathe([(0, z_top - depth - R * 0.35), (R * 0.97, z_top - depth + 0.3), (0, z_top - depth + 0.3)], 24))
    return join(*out)


def cut_torx(d_out, depth, z_top=0.0, lobes=6, extra=1.0):
    """별(헥사로뷸러) 구멍 커터: 바깥 지름 d_out"""
    N = 96
    th = np.arange(N) * TAU / N
    ro, ri = d_out / 2, d_out / 2 * 0.74
    r = (ro + ri) / 2 + (ro - ri) / 2 * np.cos(lobes * th)
    outline = np.c_[r * np.cos(th), r * np.sin(th)]
    return extrude(outline, z_top - depth, z_top + extra)


def cut_cross(size, z_top=0.0, depth=None, extra=1.0, wr=0.19, taper=0.42):
    """십자홈(필립스) 커터: size = 날개 끝 사이 길이. 윤곽 하나로 이어진 12각 십자를 아래로 갈수록 오므려 판다
    (날개 두 개를 겹쳐 한 메시에 넣으면 자기교차 메시가 되어 불리언이 몸체를 지워 버린다)"""
    depth = depth or size * 0.55
    L, w = size / 2, size * wr / 2
    o = np.array([(L, -w), (L, w), (w, w), (w, L), (-w, L), (-w, w), (-L, w), (-L, -w), (-w, -w), (-w, -L), (w, -L), (w, -w)])
    zs = [z_top + extra, z_top, z_top - depth]
    sc = [1.0, 1.0, taper]
    side = geo.grid(np.stack([np.c_[o * k, np.full(len(o), z)] for z, k in zip(zs, sc)], 1), wrap=True)
    pts, tri = geo._tess(o)
    top = Mesh(np.c_[pts, np.full(len(pts), zs[0])], None, tri)
    bot = Mesh(np.c_[pts * taper, np.full(len(pts), zs[-1])], None, tri)
    return (side + top + bot).weld(1e-7)


def cut_slot(width, depth, length, z_top=0.0, extra=1.0):
    """일자 홈 커터 (X 방향)"""
    return box(length, width, depth + extra, cz=z_top - depth / 2 + extra / 2)


# ── 기본 부품 ────────────────────────────────────────────────────────────
def hex_head(s, k, z0=0.0, chamfer=True, washer_face=True, rho=None):
    """육각 머리 (머리 밑면 z0, 윗면 z0+k). 윗면 30° 모따기, 와셔면 선택"""
    rc = s / 2 * 0.95
    body = polybody(6, s, z0, z0 + k, rc_top=rc if chamfer else None, rc_bot=rc * 0.97 if washer_face else None, rho=rho)
    out = [body]
    if washer_face:
        out.append(cyl(s / 2 * 0.95, z0 - 0.5, z0 + 0.3, N=96))
    return join(*out)


def hex_nut_mesh(D, s, m, P=None, z0=0.0, chamfer_both=True, rho=None):
    """육각 너트 (나사 구멍 포함). z0 → z0+m"""
    P = P or pitch(D)
    rc = s / 2 * 0.95
    rh = D / 2 + 0.15 * P
    body = polybody(6, s, z0, z0 + m, rc_top=rc, rc_bot=rc if chamfer_both else None, hole_top=rh, hole_bot=rh, rho=rho)
    return body + thread_bore(D, P, z0, z0 + m)


def washer_mesh(d1, d2, h, z0=0.0, edge=0.12, N=128):
    """평와셔: 안지름 d1, 바깥지름 d2, 두께 h. 모서리 둥글림"""
    e = min(edge, h * 0.3)
    pr = [(d1 / 2 + e, z0), (d2 / 2 - e, z0), (d2 / 2, z0 + e), (d2 / 2, z0 + h - e), (d2 / 2 - e, z0 + h), (d1 / 2 + e, z0 + h), (d1 / 2, z0 + h - e), (d1 / 2, z0 + e), (d1 / 2 + e, z0)]
    return lathe(pr, N)


def hex_bolt(d, L, s=None, k=None, P=None, thread_len=None):
    """육각 볼트 부품 목록 [(mesh, kwargs)]. 규약: 머리 밑면 z=0, 머리 윗면 z=k, 몸통은 z=0 → -L (끝)"""
    s0, k0 = ISO_HEX.get(int(d), (d * 1.6, d * 0.65))
    s, k = s or s0, k or k0
    P = P or pitch(d)
    parts = [(hex_head(s, k, z0=0.0), dict(sharp=24))]
    tl = L if thread_len is None else min(thread_len, L)
    if tl < L:   # 민 몸통 끝을 45° 원뿔로 나사 골 지름까지 좁히고, 나사 봉은 그 안에 묻는다 (계단처럼 끊기지 않게)
        zb, r, rr = -(L - tl), d / 2 * 0.99, d / 2 - 0.6 * P
        parts.append((lathe([(0, 0.2), (r, 0.2), (r, zb), (rr, zb - (r - rr)), (0, zb - (r - rr))], 64), dict(sharp=40)))
        parts.append((thread_rod(d, P, -L, zb - (r - rr) * 0.5, tip1=False), dict(sharp=40)))
    else:
        parts.append((thread_rod(d, P, -L, 0.0, tip1=False), dict(sharp=40)))
    return parts
