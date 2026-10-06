"""마감·재질 라벨 → 렌더 룩(bl.LOOKS 키) 매핑. 사이트(app/src/v9_shape.js)의 같은 규칙과 맞춰 둡니다."""
import re

STAINLESS = re.compile(r'\bA[24]\b|스테인리스|STS|SUS|\b304|\b316|18-8|F59[34]|F837|F87[89]|F880|\bB8|S3\d{4}|S32\d{3}|\b410\b|1\.4\d{3}|\bSS\b', re.I)
BRASS = re.compile(r'황동|CuZn|brass', re.I)
COPPER = re.compile(r'^구리$|copper', re.I)
ALU = re.compile(r'알루미늄|alumin', re.I)
NIALLOY = re.compile(r'\bNi\s*\d|F468|니켈합금', re.I)

FIN_RULES = [
    (re.compile(r'스테인리스'), 'SS'),
    (re.compile(r'옐로우|황색'), 'ZY'),
    (re.compile(r'흑색아연'), 'ZB'),
    (re.compile(r'흑착색'), 'BO'),
    (re.compile(r'아연-니켈|아연 ?니켈'), 'ZN'),
    (re.compile(r'용융아연'), 'HD'),
    (re.compile(r'아연 ?플레이크'), 'GM'),
    (re.compile(r'기계(적)? ?아연'), 'MZ'),
    (re.compile(r'PTFE|불소수지'), 'PT'),
    (re.compile(r'인산염'), 'PH'),
    (re.compile(r'니켈'), 'NI'),
    (re.compile(r'백색아연|전기아연|아연도금'), 'ZW'),
    (re.compile(r'무처리|무도금|생지|브라이트|방청유|토크계수|갈링|윤활|고착방지'), 'PL'),
]


def look_of_fin(fin):
    for rx, k in FIN_RULES:
        if rx.search(fin or ''):
            return k
    return None


def look_of_mat(mat):
    """재질이 룩을 정해 버리는 경우(스테인리스·황동·구리·알루미늄·니켈합금)만 돌려준다"""
    m = mat or ''
    if BRASS.search(m):
        return 'BR'
    if COPPER.search(m):
        return 'CU'
    if ALU.search(m) and not STAINLESS.search(m):
        return 'AL'
    if NIALLOY.search(m) and not STAINLESS.search(m):
        return 'NIA'
    if STAINLESS.search(m):
        return 'SS'
    return None


def look_for(mat, fin):
    return look_of_mat(mat) or look_of_fin(fin) or None


def family_looks(f, override=None):
    """품목군 f(dict: mats, fins …)에서 만들 룩 목록 (첫째가 기본 이미지). override = 빌더가 정한 고정 목록"""
    if override:
        return list(override)
    out = []
    for fin in f.get('fins', []):
        k = look_of_fin(fin)
        if k and k not in out:
            out.append(k)
    for mat in f.get('mats', []):
        k = look_of_mat(mat)
        if k and k not in out:
            out.append(k)
    for k in ('ZY', 'PH'):               # 황색아연은 황동처럼 보이고 인산염은 짙은 무광이라 모양이 안 읽힌다: 대표(첫째) 이미지에서는 뒤로
        if k in out and len(out) > 1:
            out.remove(k)
            out.append(k)
    return out or ['ZW']
