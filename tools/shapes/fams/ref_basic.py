"""기준 예시: 육각볼트(hbf) · 육각너트(hn) · 평와셔(pw) · 렌치볼트(scs). 다른 빌더를 만들 때 이 파일의 방식을 따르세요."""
import math

import bl
import parts as P
from fams import family
from geo import *


@family('hbf')
def hex_bolt_full(fid):
    d, L = 12, 48
    m = bl.Model(fid)
    for mesh, kw in P.hex_bolt(d, L):
        m.add(mesh, 'body', **kw)
    return m.lie(70)                      # 눕힘: 머리가 화면 왼쪽 앞


@family('hn')
def hex_nut(fid):
    D = 12
    s, mm = P.ISO_NUT[D]
    m = bl.Model(fid)
    m.add(P.hex_nut_mesh(D, s, mm), 'body', sharp=24)
    return m.view(el=42)                  # 바닥에 놓고 위에서 조금 더 내려다봄 (구멍이 보임)


@family('pw')
def plain_washer(fid):
    d1, d2, h = P.ISO_WASH[12]
    m = bl.Model(fid)
    m.add(P.washer_mesh(d1, d2, h), 'body', sharp=40)
    return m.view(el=40)


@family('scs')
def socket_cap(fid):
    d, L = 12, 40
    dk, k, s, t = P.ISO_SHCS[d]
    m = bl.Model(fid)
    # 머리: 윗면 z=k, 밑면 z=0. 윗 모서리 둥글림. 육각 구멍은 불리언으로 판다
    head = lathe([(0, k), (dk / 2 - 0.9, k), (dk / 2 - 0.2, k - 0.15), (dk / 2, k - 0.9), (dk / 2, 0.5), (dk / 2 - 0.5, 0), (d / 2 + 0.5, 0), (0, 0)], 128)
    m.add(head, 'body', sharp=35, cut=[P.cut_hex(s, t, z_top=k)])
    m.add(thread_rod(d, P.pitch(d), -L, 0.0, tip1=False), 'body', sharp=40)
    return m.lie(88)                      # 머리 윗면(육각 구멍)이 보이도록 끝이 카메라 반대쪽을 향함
