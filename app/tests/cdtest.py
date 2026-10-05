"""C&D 엔진 테스트 (BOM·C&D 사양 10.1 불변 조건, 10.2 규칙 회귀, 10.3 계산, 그 밖의 C&D 산출물).
페이지 조각을 감싸 headless Chromium에 띄우고 window.__bomTest.cd 로 돌린다.
사용: python3 cdtest.py [--page 조각.html] [--out 폴더] [--fails] [--json 파일.json]
   쓰는 파일은 모두 --out 폴더 안 (cd_index.html, 선택 --json). 실패가 하나라도 있으면 exit 1."""
import json, re, sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
from test import wrap, EXE, opt, BANNED  # noqa: E402

PAGE = pathlib.Path(opt('--page', HERE / 'page.html')).resolve()
OUT = pathlib.Path(opt('--out', HERE / 'out')).resolve()
DATE = '2026-10-01T10:00'          # 견적일 고정 (KST 벽시계) → 회신 예정일·출고일이 결정적
R = []                              # [suite, id, name, ok, detail]


def ck(suite, tid, name, ok, detail=''):
    R.append([suite, str(tid), name, bool(ok), '' if ok else str(detail)[:500]])
    return bool(ok)


def live(doc):
    return [r for r in doc['rows'] if not r.get('withdrawn')]


def rules(doc):
    out = {}
    for r in live(doc):
        out.setdefault(r['ruleId'], []).append(r)
    return out


def gcs(doc):
    return {g['id']: g for g in doc['gc']['technical'] + doc['gc']['commercial']}


# ── 10.2 규칙 회귀 세트 (사양 표 번호 그대로). expect = [(규칙, 유형|None)], absent = 나오면 안 되는 규칙
#    note = 사양과 다르게 구현한 점 (보고서에 그대로 옮김)
C102 = [
    (1, [['HEX NUT A194 GR 4 1-1/8-8UN', 10]], {}, [('S-A194-GR4', 'D')], [], None),
    (2, [['STUD A320 L7 2-3/4-8UN X 18 W/2 NUTS A194 7', 8]], {}, [('S-A320-L7-SIZE', 'C'), ('S-L7-NUT', 'C'), ('Q-IMPACT', 'C')], [], '사양은 D(L43 제안). L43의 4" 상한은 공개 출처가 없어(2026-10 감사, INTEGRATE H) 등급·범위를 묻는 C(확인)로 냄'),
    (3, [['HEX BOLT A325 7/8-9 X 3 HDG', 50]], {}, [('S-F3125', 'C'), ('L-WASHER', 'C')], [], None),
    (4, [['HEX BOLT A490 1-8 X 4 HDG', 20]], {}, [('S-A490-ZN', 'E')], [], None),
    (5, [['STUD A193 B8M CL2 1-8 X 6', 10]], {}, [('S-B8-CL2', 'C')], ['S-B8-CL2-OVER'], 'reasonNoValues'),
    (6, [['STUD A193 B8M CL.2 1-3/4-8 X 10', 4]], {}, [('S-B8-CL2-OVER', 'C')], [], '사양은 D(Class 2B·Class 1 제안). Class 2·2B 값은 공개 출처가 2곳 이하라(2026-10 감사, INTEGRATE H) 값 없이 C(확인)로 냄'),
    (7, [['HEX BOLT M6X20 8.8 HDG', 100]], {}, [('S-HDG-M8', 'C')], [], '사양은 D. ISO 10684 범위 근거가 2차 자료뿐이고 원문(용융아연 M6)대로 공급하므로 C(확인)로 냄'),
    (8, [['HEX BOLT M16X60 8.8 HDG', 50], ['HEX NUT M16 HDG', 50]], {}, [('S-HDG-NUT10', 'C')], [], None),
    (9, [['HEX BOLT DIN 933 M12X40 8.8 ZP', 50]], {}, [('S-DIN-WAF', 'D')], [], 'waf19/18'),
    ('10a', [['육각너트 1종 M10', 100]], {}, [('S-KS-1JONG', 'D')], [], None),
    ('10b', [['육각너트 3종 M10', 100]], {}, [('S-KS-3JONG', 'D')], [], 'not4032'),
    (11, [['STUD 1-1/8-8 X 7 B7/2H', 16]], {'context': {'api610': 'API 610 S-6'}}, [('X-API610-NOAUTO', 'C'), ('S-STUD-LEN-GA', 'C')], ['S-API610-ED', 'S-API610-THD'], '2026-10 감사(INTEGRATE F): API 610 재질 클래스 자료·조항 규칙을 빼서 판 질문(S-API610-ED)·나사 계열(S-API610-THD) 대신 X-API610-NOAUTO(엔지니어 확인)'),
    (12, [['STUD 3/4-10 X 4-3/4 B7/2H XYLAN 1070 BLUE', 32]], {}, [('S-PTFE', 'C'), ('S-STUD-LEN-GA', 'C')], [], None),
    (13, [['ANCHOR BOLT F1554 GR55 1-1/4 X 30 HDG', 8]], {}, [('S-F1554', 'C')], [], None),
    (14, [['STUD B7 3/4-10 X 5 W/2 NUTS HDG', 32]], {'context': {'nace': 'MR0175'}}, [('X-NACE-ZN', 'C'), ('S-ZN-ASTM', 'C'), ('S-NACE-EXP', 'C')], [], None),
    ('15a', [['SHCS M10X30 12.9', 20]], {'context': {'nace': 'MR0175'}}, [('X-NACE-HARD', 'D')], [], 'hrc'),
    ('15b', [['SHCS M10X30 12.9', 20]], {'context': {'nace': 'MR0175', 'exposure': 'non-exposed'}}, [], ['X-NACE-HARD'], None),
    (16, [['SHCS 1/2-13 X 2 ALLOY ZINC', 50]], {}, [('S-SOCKET-PLATE', 'C'), ('S-HE-BAKE', 'C')], [], None),
    ('17a', [['HEX BOLT M16X70 10.9 HDG', 20]], {}, [('S-HDG-109', 'C')], [], 'eq'),
    ('17b', [['HEX BOLT M16X70 12.9 HDG', 20]], {}, [('S-HDG-HS', 'D')], [], None),
    (18, [['STUD M20 X 150 B7', 16]], {'context': {'flange': 'B16.5 CL 300'}}, [('S-MSTUD-B165', 'C')], [], None),
    (19, [['STUD 3/4-10 X 5 B7/2H MTC EN 10204 3.1B', 16]], {}, [('S-ED-31B', 'C'), ('Q-31-FWD', 'C')], [], None),
    (20, [['무두볼트 M6x8', 20]], {}, [('A-THD-PITCH', 'C'), ('A-POINT', 'C'), ('A-FIN', 'C'), ('A-GRADE', 'C')], [], 'noqueue'),
    (21, [['HHCS 1/2-13 X 2 GR5 ZP', 100]], {}, [], [], 'gconly'),
    (22, [['NIPPLE 1/2 NPT SCH80', 2]], {}, [('N-NA', 'E')], [], None),
    (23, [['STUD B8 5/8-11 X 4', 16]], {'context': {'flange': 'B16.5 CL 600'}}, [('X-LOWSTR', 'C')], ['S-B8-CL1'], None),
    (24, [['STUD 1-1/8-7 UNC X 8 B7', 16], ['HVY HEX NUT 1-1/8-8UN 2H', 32]], {}, [('L-SERIES', 'C')], [], None),
    (25, [['STUD B7 3/4-10 X 5', 32], ['HEX NUT 3/4-10 A194 8', 64]], {}, [('L-NUT-PAIR', 'C')], [], None),
    (26, [['HEX BOLT ISO 4017 M8X100 8.8', 50]], {}, [('S-LEN-RANGE', 'C')], [], None),
    (27, [['SHCS M10X37 12.9', 50]], {}, [('S-CAT-ALT', 'D')], [], 'alt35'),
    (28, [['HEX BOLT M10X30 8.8 ZP', 'A/R']], {}, [('K-QTY', 'C')], [], None),
    (29, 'No\tDescription\tQty\n1\tHEX BOLT M10X30 8.8 ZP\t10\n2\t\t20', {}, [('A-MERGE', 'C')], [], None),
    (30, [['STUD 1-1/8 B7 X 8', 16]], {}, [('A-THD-TPI', 'C')], [], '8un'),
    (31, [['STUD 3/4-10 X 5 B7 PER SPEC SPEC-BLT-001', 16]], {'offerType': 'firm', 'review': {'ok': True, 'by': 'OP', 'at': '2026-10-01T15:00'}}, [('X-REFDOC', 'E')], [], 'stmtA'),
    (32, [['STUD B7 1-8 X 7', 16]], {'context': {'mdmtC': -60}}, [('X-MDMT', 'C')], [], '사양은 D. B7 무충격 최저온도(−48 °C, B31.3) 값은 공개 출처가 없어 뺐고(2026-10 감사, INTEGRATE H), 0 °C 아래 MDMT면 값 없이 확인 질문 C로 냄'),
    (33, [['STUD B7 3/4-10 X 5', 32], ['HVY HEX NUT 3/4-10 2H', 32]], {}, [('L-NUT-QTY', 'C')], [], 'need64'),
    ('34a', [['4" CL300', None], ['STUD B7 3/4-10 X 4-1/2', 16]], {}, [], ['L-FLANGE'], None),
    ('33b', [['4" CL300', None], ['STUD B7 3/4-10 X 4-1/2', 16], ['HVY HEX NUT 3/4-10 2H', 16]], {}, [('L-NUT-QTY', 'C')], ['L-FLANGE'], 'flangesets'),
    ('34b', [['4" CL300', None], ['STUD B7 5/8-11 X 4-3/4', 16]], {}, [('L-FLANGE', 'C')], [], None),
    ('34c', [['4" CL300', None], ['STUD B7 3/4-10 X 4-3/4', 16]], {}, [('L-FLANGE', 'C')], [],
     '사양 10.2 #34는 이 줄에서 L-FLANGE가 없어야 한다고 적었지만, 제조사 공개 차트 3곳 대조 참고값(NPS 4 Class 300: 8 × 3/4-10, RF 4.50" · RTJ 5.00")과 맞지 않아 발화함. 표 값을 따름'),
    (35, [['STUD B7 1-1/2-8 X 12 FOR TENSIONER', 8]], {}, [('S-TENSION', 'C')], [], None),
    (36, [['HEX BOLT M10X30 8.8 ZP', 100]], {'commercial': {'requiredValidityDays': 90, 'paymentTerms': '납품 후 60일 현금 (선급 결제 불가)'}}, [('K-VALIDITY', 'D'), ('K-PAY', 'D')], [], None),
    (37, [['HEX BOLT M10X30 8.8 ZP', 100], ['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'submission': {'unpriced': True, 'splitTechComm': True}}, [], [], 'unpriced'),
    (38, [['HEX BOLT M10X30 8.8 ZP', 100]], {'avl': {'makers': ['승인 제조사 A', '승인 제조사 B']}}, [('Q-MAKE', 'C')], [], None),
]


# 10.2 밖의 규칙도 한 번씩 발화하는지 (입력, RFQ, 기대 규칙)
MORE = [
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'context': {'requiredDate': '2026-10-02'}}, 'K-LEAD'),
    ([['HEX BOLT M10X30 8.8 ZP FOR NUCLEAR SERVICE', 10]], {}, 'X-SCOPE'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'context': {'vdrl': True}}, 'Q-VDRL'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS COLOR CODE', 16]], {}, 'M-COLOR'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS MTC 3.1 HEAT NO STAMP', 16]], {}, 'M-HEAT'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS MTC 3.1 HEAT NO STAMP', 16]], {}, 'Q-31-LOT'),
    ([['STUD B7 3-8UN X 20 W/2 NUTS', 4]], {}, 'S-B7-SIZE'),
    ([['SHCS M10X30 A2 ASTM F738M', 10]], {}, 'S-F738M-A2'),
    ([['SHCS M10X30 A2 ASTM F738M', 10]], {}, 'A-SS-CLASS'),
    ([['HEX BOLT M12X50 10.9 ASTM F1136', 10]], {}, 'S-ED-F3393'),
    ([['HEX NUT M12 DIN 934 8 ZP', 100]], {}, 'S-DIN934-H'),
    ([['SHCS M12X40 12.9 DIN 912', 50]], {}, 'A-DIN-ISO'),
    ([['SHCS 1/2-13 X 2 HDG', 10]], {}, 'X-HDG-3A'),
    ([['STUD L7M 3-8UN X 20', 4]], {}, 'X-L7M-SIZE'),
    ([['STUD L7M 3-8UN X 20', 4]], {}, 'S-B7M'),
    ([['HEX BOLT A325 7/8-9 X 3 ASME B18.2.1', 10]], {}, 'S-B18-2-6'),
    ([['HEX BOLT M10X30 8.8 ZP', 60], ['HEX BOLT M10X30 8.8 ZP', 60]], {}, 'K-DUP'),
    ([['HEX BOLT M10X30 8.8 ZP', 96]], {}, 'K-TIER'),
    ([['HEX BOLT M10X30 8.8 ZP', 96]], {}, 'K-PACK'),
    ([['THREADED ROD M16 X 1000 4.8 ZP', 10]], {}, 'K-FREIGHT'),
    ([['HEX BOLT M10 8.8', 10]], {}, 'A-LEN-NONE'),
    ([['WING NUT M8', 10]], {}, 'A-VARIANT'),
    ([['BOLT M10X30 8.8', 10]], {}, 'A-HEAD'),
    ([['XYZ 123', 10]], {}, 'N-UNREAD'),
    ([['PUMP CASING (API 610 S-6)', None], ['SHCS M16X60 12.9', 8]], {}, 'X-API610-NOAUTO'),   # S-API610-STUD·S-API610-H4·M-API610은 2026-10 감사(INTEGRATE F)로 뺐다
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16, {'tag': 'P-101A'}]], {}, 'M-TAG'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16, {'tag': 'P-101A'}]], {}, 'M-KIT'),
    ([['HEX BOLT M16X60 8.8 HDG', 50], ['HEX NUT M16 8 ZP', 50]], {}, 'L-FIN-MATCH'),
    ([['4" CL300 NACE', None], ['STUD B7 3/4-10 X 4-1/2', 16]], {'context': {'flange': 'B16.5 CL 600 NPS 6'}}, 'A-CTX'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'commercial': {'ld': '0.5%/week, max 10%'}}, 'K-LD'),
    ([['SET SCREW 1/4-20 X 1/2 45H ZINC', 100]], {}, 'S-HE-BAKE'),
    ([['STUD A193 B8M 3/4-10 X 5', 16]], {'context': {'docs': ['origin']}}, 'Q-ORIGIN'),
    ([['STUD A193 B8M 3/4-10 X 5', 16]], {}, 'S-B8-CL1'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'context': {'docs': ['PMI']}}, 'Q-PMI'),
    ([['HEX BOLT M10X30 8.8 CD PLATED', 10]], {}, 'S-CD'),
    ([['HEX BOLT A307 GR B 3/4-10 X 3', 10]], {}, 'S-A307'),
    ([['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'context': {'api610': 'API 610 13th C-6'}}, 'X-API610-NOAUTO'),
    ([['HEX BOLT M10X1.25X30 8.8', 10]], {}, 'S-FINE'),
    ([['HHCS 1/2-13 UNC-2B X 2 GR5', 10]], {}, 'A-TOL-WRONG'),
    ([['STUD 3/4-10 X 120MM B7', 10]], {}, 'A-LEN-CONV'),
    ([['THREADED ROD M12 4.8 ZP', 10]], {}, 'A-LEN-ROD'),
    ([['SHCS M8X20 STAINLESS', 10]], {}, 'A-SS-ALLOY'),
    ([['SCHS M8X20 12.9', 10]], {}, 'A-NORM'),
    ([['STUD 3/4-10 X 5', 16]], {'context': {'api610': 'API 610 12th D-1'}}, 'X-API610-NOAUTO'),   # S-API610-CHK·PART·MAT은 재질 클래스 자료가 비어 있어 발화하지 않음 (2026-10 감사)
    ([['HEX BOLT 1/2-13 X 2', 10]], {'context': {'api610': 'API 610 12th C-6'}}, 'X-API610-NOAUTO'),
]


def tmore(pg):
    for lines, rfq, want in MORE:
        r = run(pg, lines, {'date': DATE, **rfq})
        ru = rules(r['doc'])
        ck('rules+', want, f"{want}: {' + '.join(l[0] for l in lines)}", want in ru and all(c['ok'] for c in r['checks']), [sorted(ru), [c for c in r['checks'] if not c['ok']]])


def t102(pg):
    for no, lines, rfq, expect, absent, extra in C102:
        r = run(pg, lines, {'date': DATE, **rfq})
        doc, ru = r['doc'], rules(r['doc'])
        bad = []
        for rid, typ in expect:
            if rid not in ru: bad.append(f'{rid} 없음 (있는 규칙: {sorted(ru)})')
            elif typ and not any(x['type'] == typ for x in ru[rid]): bad.append(f"{rid} 유형 {[x['type'] for x in ru[rid]]} ≠ {typ}")
        for rid in absent:
            if rid in ru: bad.append(f'{rid}가 나오면 안 됨')
        if any(not c['ok'] for c in r['checks']): bad.append('불변 조건 실패: ' + str([c for c in r['checks'] if not c['ok']]))
        if extra == 'reasonNoValues':   # 2026-10 감사: B8M Class 2 지름별 값은 공개 출처 2곳뿐이라 문구에 값을 싣지 않고 규격서 확인으로 묻는다
            t = ru.get('S-B8-CL2', [{}])[0].get('reason', {}).get('ko', '')
            if '100 / 항복 80' in t or 'ksi' in t or '규격서로 확인' not in t: bad.append('B8M Cl.2 문구에 출처 없는 값이 있거나 확인 문구가 없음: ' + t)
        if extra == 'waf19/18':
            t = ru['S-DIN-WAF'][0]['reason']['ko'] if 'S-DIN-WAF' in ru else ''
            if '19 mm' not in t or '18 mm' not in t: bad.append('2면폭 19→18 mm 없음')
        if extra == 'not4032':
            l = doc['lines'][0]
            if l['ourPn'] or 'ISO 4035' not in ru['S-KS-3JONG'][0]['offered']['ko']: bad.append(f"3종 너트가 ISO 4032로 매칭됨 또는 ISO 4035 제안 없음: {l['ourPn']}")
        if extra == 'hrc':
            if '39–44 HRC' not in ru['X-NACE-HARD'][0]['reason']['ko'] or '1,100 MPa' not in ru['X-NACE-HARD'][0]['reason']['ko']: bad.append('HRC·강도 비교 문구 없음')
        if extra == 'eq' and doc['lines'][0]['status'] != 'engineer-quote': bad.append('10.9 HDG가 엔지니어 견적이 아님')
        if extra == 'noqueue' and any(doc['queue'][k] for k in doc['queue']): bad.append(f"큐가 비어야 함: {doc['queue']}")
        if extra == 'gconly':
            l = doc['lines'][0]
            if l['cd'] or l['compliance'] != 'C' or (gcs(doc).get('GC-T03') or {}).get('n') != 1: bad.append(f"A-TOL-IN GC만 → 준수 C 기대: cd={l['cd']} code={l['compliance']} gc={gcs(doc).get('GC-T03')}")
        if extra == 'alt35' and '35' not in ru['S-CAT-ALT'][0]['offered']['ko']: bad.append('35 mm 대안 없음')
        if extra == '8un' and '8UN' not in json.dumps(ru['A-THD-TPI'][0]['params'], ensure_ascii=False): bad.append('8UN 아님')
        if extra == 'stmtA':
            if doc['offerType'] != 'firm' or doc['statement']['kind'] != 'deviation': bad.append(f"정식 견적 선언문 (가) 기대: {doc['offerType']} {doc['statement']['kind']} {doc['firmBlocked']}")
        if extra == 'flangesets' and '플랜지 2조 × 8개' not in ru['L-NUT-QTY'][0]['reason']['ko']: bad.append('B16.5 플랜지 조 수(2조 × 8개) 없음: ' + ru['L-NUT-QTY'][0]['reason']['ko'])
        if extra == 'need64':
            p = ru['L-NUT-QTY'][0]['params']
            if str(p.get('need')) != '64' or str(p.get('nn')) != '32': bad.append(f'필요 64 / 있음 32 기대: {p}')
        if extra == 'unpriced':
            u = json.dumps(r['unpriced'], ensure_ascii=False)
            if re.search(r'₩|KRW|원정|\d{1,3}(,\d{3})+\s*원', u) or any('unitPrice' in l or 'amount' in l for l in r['unpriced']['lines']): bad.append('기술본에 금액')
            if any(l['quoted']['en'] not in ('Quoted', 'Not quoted') for l in r['unpriced']['lines']): bad.append('Quoted / Not quoted 표기 없음')
            if not r['unpriced']['footer']['ko'].startswith('가격본과 같은'): bad.append('기술본 끝 문장 없음')
            if any(x['cat'] in ('COM', 'DLV') for x in r['unpriced']['rows']): bad.append('기술본에 상업 행')
        note = extra if extra and len(extra) > 12 else ''
        ck('10.2', no, f"#{no} {lines if isinstance(lines, str) else ' + '.join(l[0] for l in lines)}" + (f' [{note}]' if note else ''), not bad, bad)


RULE_LIST = []
SEEN = set()                        # 시험 중 행이나 GC로 나온 규칙 ID (커버리지 보고용)


def run(pg, lines, rfq=None, prev=None):
    r = pg.evaluate('([l, r, p]) => window.__bomTest.cd.run(l, r, p)', [lines, rfq or {}, prev])
    SEEN.update(x['ruleId'] for x in r['doc']['rows'])
    return r


# ── 10.1 불변 조건: 정상 문서에서 모두 통과 + 일부러 망가뜨린 문서에서 해당 조건이 실패
MIX = [['HEX BOLT DIN 933 M12X40 8.8 ZP', 50, {'pn': 'P-1001'}], ['STUD B7 3/4-10 X 5 PER SPEC SPEC-BLT-001', 32], ['HVY HEX NUT 3/4-10 2H', 64],
       ['NIPPLE 1/2 NPT SCH80', 2], ['무두볼트 M6x8', 20], ['SHCS M10X37 12.9', 50], ['HEX BOLT M16X70 10.9 HDG', 20], ['HHCS 1/2-13 X 2 GR5 ZP', 100],
       ['육각너트 3종 M10', 100], ['STUD 1-1/8 B7 X 8', 'A/R'], ['HEX NUT A194 GR 4 1-1/8-8UN', 10], ['HEX BOLT M10X30 8.8 ZP', 120]]


def t101(pg):
    scen = {
        'S1 자동 견적 (혼합 12줄)': (MIX, {'date': DATE}),
        'S2 받지 못한 참조 문서 + RFQ 머리': (MIX, {'date': DATE, 'project': 'P-101A/B 교체', 'clientRef': {'rfqNo': 'RFQ-25-0912', 'rev': '1', 'bomFile': 'BOM_P101.xlsx'},
                                       'basis': [{'doc': 'SPEC-PNT-003', 'rev': '0', 'received': False}, {'doc': 'RFQ-25-0912 본문', 'received': True}]}),
        'S3 받은 참조 문서': (MIX, {'date': DATE, 'basis': [{'doc': 'SPEC-BLT-001', 'rev': '2', 'received': True}]}),
        'S4 가격 없는 기술본': (MIX, {'date': DATE, 'submission': {'unpriced': True}}),
    }
    for name, (lines, rfq) in scen.items():
        r = run(pg, lines, rfq)
        for c in r['checks']: ck('10.1', c['no'], f"{name}: {c['name']}", c['ok'], c['detail'])
        if name.startswith('S3'): ck('10.1', 11, 'S3: 받은 문서는 X-REFDOC를 만들지 않음', 'X-REFDOC' not in rules(r['doc']), list(rules(r['doc'])))
        if name.startswith('S2'):
            ru = rules(r['doc'])
            ck('10.1', 11, 'S2: RFQ 검토 문서 중 받지 못한 것(SPEC-PNT-003)과 BOM 참조(SPEC-BLT-001) 모두 X-REFDOC', len(ru.get('X-REFDOC', [])) == 2 and any('SPEC-PNT-003' in x['lineRefText'] for x in ru['X-REFDOC']), [x['lineRefText'] for x in ru.get('X-REFDOC', [])])
    # 정식 견적: 검토 표시 없으면 자동 견적으로 내림, 있으면 정식 (N 줄 → 미견적 E행)
    r0 = run(pg, MIX, {'date': DATE, 'offerType': 'firm'})
    ck('10.1', 10, '정식 견적 요청 + 검토 표시 없음 → 자동 견적으로 발행, 사유 표시', r0['doc']['offerType'] == 'indicative' and r0['doc']['firmBlocked'] and r0['doc']['watermark']['ko'] == '자동 견적 · 운영자 검토 전', r0['doc']['firmBlocked'])
    rv = {'ok': True, 'by': '운영자', 'at': '2026-10-01T15:00'}
    r1 = run(pg, MIX, {'date': DATE, 'offerType': 'firm', 'review': rv})
    d1 = r1['doc']
    ck('10.1', 10, '정식 견적 (검토 표시 있음): 직인 칸·선언문 (가), N 줄 0, 미견적 E행', d1['offerType'] == 'firm' and d1['seal'] and d1['statement']['kind'] == 'deviation' and d1['compliance']['counts']['N'] == 0 and 'N-NOTQ' in rules(d1) and not d1['watermark'],
       {'offer': d1['offerType'], 'blocked': d1['firmBlocked'], 'counts': d1['compliance']['counts']})
    for c in r1['checks']: ck('10.1', c['no'], f"S5 정식 견적: {c['name']}", c['ok'], c['detail'])
    # 미해결 충돌(X, C/D 행)이 있는 바로 공급 줄 → 정식 견적 막힘, 고객 확인(decisions) 뒤 통과
    xl = [['STUD B7 1-8 X 7', 16], ['HEX BOLT M10X30 8.8 ZP', 100]]
    r2 = run(pg, xl, {'date': DATE, 'offerType': 'firm', 'review': rv, 'context': {'mdmtC': -60}})
    key = next((x['key'] for x in r2['doc']['rows'] if x['ruleId'] == 'X-MDMT'), None)
    ck('10.1', 10, '미해결 X-MDMT가 있으면 정식 견적 불가 (자동 견적으로 내림)', r2['doc']['offerType'] == 'indicative' and any('미해결 충돌' in b['ko'] for b in r2['doc']['firmBlocked']), r2['doc']['firmBlocked'])
    r3 = run(pg, xl, {'date': DATE, 'offerType': 'firm', 'review': rv, 'context': {'mdmtC': -60}, 'decisions': {key: {'status': 'CONFIRMED', 'by': '고객', 'at': '2026-10-02T09:00', 'reply': 'B7 유지 (실내 설치)'}}})
    ck('10.1', 10, '고객이 X-MDMT를 확인하면 정식 견적 발행, 행 상태 CONFIRMED·회신 기록', r3['doc']['offerType'] == 'firm' and all(c['ok'] for c in r3['checks']) and any(x['status'] == 'CONFIRMED' and x['customerReply'] for x in r3['doc']['rows']),
       [r3['doc']['offerType'], r3['doc']['firmBlocked'], [c for c in r3['checks'] if not c['ok']]])
    # 망가뜨린 문서
    T = pg.evaluate('([l, r]) => window.__bomTest.cd.neg(l, r)', [MIX, {'date': DATE}])
    ck('10.1', '-', '음성 시험: 원본 문서는 실패 0건', T['base'] == [], T['base'])
    for t, want in [('t1', 1), ('t2', 2), ('t3', 3), ('t4', 4), ('t5', 5), ('t6', 6), ('t7', 7), ('t8', 8), ('t8b', 8), ('t9', 9), ('t10', 10), ('t11', 11), ('t12', 12)]:
        ck('10.1', want, f'음성 시험 {t}: 문서를 망가뜨리면 조건 {want}가 실패', want in T[t], T[t])


# ── 10.3 계산 시험
def t103(pg):
    W = [(7700, '칠천칠백'), (68200, '육만팔천이백'), (129800, '일십이만구천팔백'), (10000, '일만'), (100010000, '일억일만'), (0, '영'), (1, '일'), (1000000, '일백만'), (20000000, '이천만')]
    got = pg.evaluate('(W) => W.map(([n]) => [window.__bomTest.cd.wordsDoc(n), window.__bomTest.wonKoNum(window.__bomTest.cd.wordsDoc(n))])', W)
    for (n, w), (doc, back) in zip(W, got):
        ck('10.3', f'한글 {n:,}', f'한글 금액 {n:,} → 일금 {w}원정', doc == f'일금 {w}원정 (₩{n:,})' and back == n, [doc, back])
    P = [((36, [{'size': 2, 'price': 4000}, {'size': 20, 'price': 29100}]), 58200, {20: 2}), ((71, [{'size': 10, 'price': 4000}, {'size': 100, 'price': 29500}]), 29500, {100: 1}),
         ((70, [{'size': 10, 'price': 4000}, {'size': 100, 'price': 29500}]), 28000, {10: 7})]
    for (need, packs), amt, combo in P:
        r = pg.evaluate('([n, p]) => window.__bomTest.pack(n, p)', [need, packs])
        c = {p['size']: p['count'] for p in r['packs']}
        ck('10.3', f'포장 {need}', f'포장 최적화 필요 {need} → ₩{amt:,} {combo}', r['amount'] == amt and c == combo and r['ordered'] >= need, r)
    packs = [{'size': 10, 'price': 4000}, {'size': 100, 'price': 29500}]
    r = pg.evaluate('([n, p]) => window.__bomTest.pack(n, p)', [25003, packs])
    best = min(k100 * 29500 + -(-max(0, 25003 - 100 * k100) // 10) * 4000 for k100 in range(0, 252))   # 전수 탐색
    ck('10.3', '포장 25003', f'포장 최적화 큰 수량 경로 25,003개 → 전수 탐색 최솟값 ₩{best:,}', r['amount'] == best and r['ordered'] >= 25003, r)
    # 세액: 줄 세액 합 = 세액 합계, 운임 줄 과세 (엔진 결정: BOM_VAT.method = 'total-round')
    rr = run(pg, [['HEX BOLT M10X30 8.8 ZP', 7], ['HEX NUT M10 8 ZP', 13], ['SHCS M8X25 12.9', 9]], {'date': DATE})
    t = rr['doc']['totals']; lv = sum(l['vat'] or 0 for l in rr['doc']['lines'])
    ck('10.3', '세액', f"세액: 줄 세액 합 + 운임 세액 = 세액 합계, 운임 과세 (sub {t['sub']:,} + ship {t['ship']:,}, vat {t['vat']:,}, method {t['method']})",
       t['ship'] > 0 and t['shipVat'] > 0 and lv + t['shipVat'] == t['vat'] and t['vat'] == round((t['sub'] + t['ship']) * .1) and t['total'] == t['supply'] + t['vat'], t)
    ck('10.3', '세액', '합계 한글 금액 = 숫자 (견적서 띠)', rr['doc']['totals']['wordsOk'] and rr['doc']['totals']['wordsDoc'].startswith('일금 ') and rr['doc']['totals']['wordsDoc'].endswith(f"(₩{t['total']:,})"), t['wordsDoc'])
    # 납기: 금요일 16시 발주 확정 → 다음 영업일부터 (토·일·10/5 대체공휴일 건너뜀). 마감은 페이지 CUTOFF (자체 재고 14시 / 협력사 재고 12시)
    own = pg.evaluate('window.__bomTest.terms().OWN_STOCK')
    D = [('2026-10-02T16:00', 0, '2026-10-06'), ('2026-10-02T10:00', 0, '2026-10-02'), ('2026-10-08T16:00', 0, '2026-10-12'), ('2026-10-02T16:00', 2, '2026-10-08'), ('2026-10-03T09:00', 0, '2026-10-06'),
         ('2026-10-02T12:30', 0, '2026-10-02' if own else '2026-10-06')]   # 12:00–14:00: 자체 재고 마감 전, 협력사 재고 마감 후
    for iso, n, want in D:
        g = pg.evaluate('([i, n]) => window.__bomTest.cd.shipDate(i, n)', [iso, n])
        ck('10.3', '납기', f'출고일 {iso} 발주 확정 + {n}영업일 → {want}', g == want, g)
    a, b = pg.evaluate('() => window.__bomTest.cd.shipCmp()')
    ck('10.3', '납기', '페이지 shipDate(재고)와 C&D 출고일 계산이 지금 시각에서 같음', a == b, [a, b])
    rr = run(pg, [['HEX BOLT M10X30 8.8 ZP', 10]], {'date': '2026-10-02T16:00'})
    l = rr['doc']['lines'][0]
    # 재고 표시 품목: 자체 재고면 OWN_STOCK 10/6(화), 재고가 없으면(검증 기간) 협력사 재고 PARTNER_STOCK 10/6부터 2영업일 = 10/8(목)
    tier, want = ('OWN_STOCK', '2026-10-06') if own else ('PARTNER_STOCK', '2026-10-08')
    ck('10.3', '납기', f'금요일 16시 견적의 재고 표시 줄({tier}) 출고 예정 = {want}', l['lead']['code'] == tier and l['lead']['shipDate'] == want, l['lead'])


# ── 그 밖의 C&D 산출물 (사양 3.8–3.11, 4.2–4.7, 6.4–6.5, 8.9, 2.11)
def tmisc(pg, corpus):
    r = run(pg, MIX, {'date': DATE, 'project': 'P-101A/B 교체', 'client': '○○정유', 'clientRef': {'rfqNo': 'RFQ-25-0912', 'rev': '1', 'bomFile': 'BOM_P101.xlsx'}})
    d = r['doc']
    ck('4.4', 'cols', '본문 열은 정확히 10열 (머리글·행·기술본 행)', len(d['cols']) == 10 and all(len(x['cells']) == 10 and len(x['cellsTech']) == 10 for x in d['rows']) and all(len(x['cells']) == 10 for x in r['unpriced']['rows']))
    ck('4.4', 'order', '행 순서 D → E → C, 같은 유형 안에서 번호 순', [x['type'] for x in d['rows']] == sorted([x['type'] for x in d['rows']], key='DEC'.index) and all(a['seq'] < b['seq'] for a, b in zip(d['rows'], d['rows'][1:]) if a['type'] == b['type']))
    ck('4.4', 'no', '번호 형식 C-001 / D-001 / E-001', all(re.fullmatch(r'[CDE]-\d{3}', x['no']) for x in d['rows']))
    ck('4.6', 'impact', '영향 칸: 가격 · 납기 · 서류 순서 (또는 "가격·납기·서류 변동 없음")', all(x['impact']['text']['ko'] == '가격·납기·서류 변동 없음' or len(x['impact']['text']['ko'].split(' · ')) == 3 for x in d['rows']), [x['impact']['text']['ko'] for x in d['rows']])
    ck('4.6', 'impact-u', '기술본 영향 칸: 가격 영향 있음 – 가격본 참조 / 가격 영향 없음', all(x['cells'][7]['ko'].startswith(('가격 영향 있음 – 가격본 참조', '가격 영향 없음')) for x in r['unpriced']['rows']))
    ck('4.2', 'header', '머리 블록: 문서 번호 {견적번호}-CD, Rev, 프로젝트, RFQ, BOM 해시 8자, 검토 문서, 견적 구분', d['header']['sheetNo'] == d['quoteNo'] + '-CD' and d['header']['rev'] == 'A' and d['header']['rfqNo'] == 'RFQ-25-0912'
       and len(d['header']['bomRef']['hash']) == 8 and d['header']['basis'][0]['doc'] == 'BOM_P101.xlsx' and d['header']['offerType']['code'] == 'indicative', d['header'])
    ck('4.3', 'stmt', '자동 견적 선언문 = 운영자 검토 전 문구, 집계 한 줄', d['statement']['kind'] == 'indicative' and d['statement']['summary']['ko'].startswith('C ') and '미견적 줄' in d['statement']['summary']['ko'])
    G = gcs(d)
    ck('4.7', 'gc-t', 'GC-T01·T02·T04·T07·T08·T09·T13 항상, T03 (해당 n줄)', all(k in G for k in ['GC-T01', 'GC-T02', 'GC-T04', 'GC-T07', 'GC-T08', 'GC-T09', 'GC-T13']) and '(해당 ' in G['GC-T03']['ko'], list(G))
    cph = [G[f'GC-C{n}'] for n in range(12, 18)]
    ck('4.7', 'gc-c', 'GC-C12~C17은 자리표시 (정책 수치 없음)', all(g['ph'] and '[자리표시' in g['ko'] and not re.search(r'\d', re.sub(r'GC-C\d+', '', g['ko'])) for g in cph), [g['ko'] for g in cph])
    ck('4.7', 'gc-c01', 'GC-C01은 엔진 부가세 결정(BOM_VAT.gc)과 같은 문구', G['GC-C01']['ko'].startswith('통화는 원(KRW)'))
    ck('4.1', 'split', '기술/상업 분리: COM·DLV 행과 GC-C는 상업, 나머지 기술', set(d['technical']['rows']) | set(d['commercial']['rows']) == {x['no'] for x in d['rows']} and all(x['cat'] in ('COM', 'DLV') for x in d['rows'] if x['no'] in d['commercial']['rows'])
       and all(g.startswith('GC-T') for g in d['technical']['gc']) and all(g.startswith('GC-C') for g in d['commercial']['gc']))
    ko_in_en = sorted({(x['ruleId'], i) for x in d['rows'] for i in range(3, 10) if re.search('[가-힣]', re.sub(r"'[123]종(?:/[123]종)?'", '', x['cells'][i]['en']))})
    ck('4.1', 'bilingual', '영문 열(4–10열)에 한국어가 남지 않음 (KS 등급 표기 \'n종\' 인용은 예외)', not ko_in_en, ko_in_en)
    # 서류 계획 (HARD RULE 5)
    plans = [l['docPlan'] for l in d['lines'] if l['docPlan']]
    okp = all(p['plan'][0]['code'] == 'COC_F21' and p['plan'][0]['by'] == 'BoltNote' and p['plan'][0]['incl'] for p in plans)
    okm = all(x['by'] == 'manufacturer' for p in plans for x in p['plan'] if x['code'].startswith('MTC3') or x['code'].startswith('MTC2')) if False else all(x['by'] in ('manufacturer',) for p in plans for x in p['plan'] if x['code'] in ('MTC31_FWD', 'MTC22_FWD'))
    okk = all(x['onRequest'] and 'third-party' in x['by'] and not x['incl'] for p in plans for x in p['plan'] if x['code'] in ('KOLAS', 'MTC32'))
    okb = all(x['code'] in ('COC_F21', 'PACKLIST', 'ITP_DIST', 'MDR') for p in plans for x in p['plan'] if x['by'] == 'BoltNote')
    ck('3.8', 'docs', 'HARD RULE 5: 볼트노트 문서는 CoC(F2.1)뿐, 3.1·2.2는 제조사 발행 사본, KOLAS·3.2는 요청 시 제3자 (기본 미포함)', okp and okm and okk and okb, [okp, okm, okk, okb])
    ck('3.8', 'docs-na', '공급 불가 줄은 서류 계획 없음', all(l['docPlan'] is None for l in d['lines'] if l['status'] == 'not-available'))
    r31 = run(pg, [['STUD B7 3/4-10 X 5 W/2 NUTS', 16]], {'date': DATE, 'context': {'docs': ['3.1', 'KOLAS', '3.2']}})
    p = {x['code']: x for x in r31['doc']['lines'][0]['docPlan']['plan']}
    ck('3.8', 'docs-req', 'RFQ가 3.1·KOLAS·3.2를 요구하면: 3.1 사본 포함(제조사), KOLAS·3.2 포함(요청, 제3자) + Q-31-FWD·Q-KOLAS·Q-32 행', (p['MTC31_FWD']['incl'] or p['MTC31_FWD'].get('tbd')) and p['KOLAS']['incl'] and p['MTC32']['incl'] and {'Q-31-FWD', 'Q-KOLAS', 'Q-32'} <= set(rules(r31['doc'])), [p, list(rules(r31['doc']))])
    rs = run(pg, [['STUD B7 3/4-10 X 5 W/2 NUTS 3.1 CERT ISSUED BY SUPPLIER', 16]], {'date': DATE})
    ck('3.8', 'docs-self', '"3.1 issued by supplier" 요구 → Q-31-SELF (E), 제조사 3.1 사본으로 대신', 'Q-31-SELF' in rules(rs['doc']) and rules(rs['doc'])['Q-31-SELF'][0]['type'] == 'E' and all(c['ok'] for c in rs['checks']), list(rules(rs['doc'])))
    # 도면 (3.9)
    dw = {l['raw']: l['drawing'] for l in d['lines']}
    ck('3.9', 'dwg', '카탈로그 줄 도면 번호 {견적번호}-D{BOM No}, 공급 불가 줄은 없음, 비표준 길이(M10X37 대안)는 승인용·제조사 확인 전',
       dw['HHCS 1/2-13 X 2 GR5 ZP']['no'] == f"{d['quoteNo']}-D8" and dw['NIPPLE 1/2 NPT SCH80'] is None and (dw['SHCS M10X37 12.9'] or {}).get('forApproval') is True, dw)
    rv = run(pg, [['WING NUT M8', 10]], {'date': DATE})
    ck('3.9', 'dwg-var', '변형품(나비너트)은 표준 도면 없음으로 둠 (지어내지 않음)', rv['doc']['lines'][0]['drawing'] in (None,) or rv['doc']['lines'][0]['drawing']['has'] is False, rv['doc']['lines'][0]['drawing'])
    # 공급 불가 목록 (3.10)
    na = d['notAvailable']
    ck('3.10', 'na', '공급 불가 목록: 줄마다 "이 줄만 … 문의해 주십시오" 문장, 안내·끝 문장, 메일 제목', na['lines'] and all('이 줄만' in x['elsewhere']['ko'] and '배관 자재 공급처' in x['elsewhere']['ko'] for x in na['lines'])
       and na['intro']['ko'] and na['outro']['ko'].startswith('이 목록은') and na['mail']['subject'].endswith('공급 불가 1건'), na)
    rx = run(pg, MIX, {'date': DATE, 'excluded': ['5']})
    ck('3.10', 'excl', '고객 제외 줄(X): N-EXCL E행, 준수 E, 공급 불가 목록에 "귀사 요청으로 제외", 합계에서 빠짐', 'N-EXCL' in rules(rx['doc']) and rx['doc']['lines'][4]['compliance'] == 'E' and any(x['excluded'] for x in rx['doc']['notAvailable']['lines'])
       and all(c['ok'] for c in rx['checks']), [list(rules(rx['doc'])), rx['doc']['lines'][4]['compliance']])
    # 준수 요약 (3.11)
    cs = d['compliance']
    ck('3.11', 'sum', '준수 요약: C+CC+D+E+N = 줄 수, 분류별 C/D/E, 서류 집계, 가장 늦은 출고일, 줄별 코드 목록', cs['sumOk'] and sum(cs['counts'].values()) == len(d['lines']) and sum(sum(v.values()) for v in cs['byCat'].values()) == cs['cdCount']
       and cs['lead']['latest'] and len(cs['list']) == len(d['lines']) and cs['docs']['kolasOpt'] > 0, cs)
    # 자동/정식 (2.10)
    ck('2.10', 'wm', "자동 견적 워터마크 '자동 견적 · 운영자 검토 전', 직인 없음", d['offerType'] == 'indicative' and d['watermark']['ko'] == '자동 견적 · 운영자 검토 전' and d['seal'] is None)
    eqs = [l for l in d['lines'] if l['status'] == 'engineer-quote']
    ck('2.10', 'sla', '엔지니어 견적 줄 회신 예정일 (1~20줄: 국내 1영업일 10/2, 수입·코팅 4영업일 10/8)', all(l['replyBy'] in ('2026-10-02', '2026-10-08') for l in eqs) and any(l['replyBy'] == '2026-10-02' for l in eqs), [(l['ref'], l['replyBy'], l['lead']['code'] if l['lead'] else None) for l in eqs])
    # 개정 (2.11, P3)
    A = run(pg, MIX, {'date': DATE})
    mix2 = [list(x) for x in MIX]
    mix2[0][0] = 'HEX BOLT DIN 933 M12X40 8.8 ZP PLTD'  # 원문 조금 고침 (같은 번호·품번, 유사도 7/8) + 수량 변경
    mix2[0][1] = 80
    del mix2[3]                                         # 니플 삭제 → 뒤 줄 번호 밀림
    mix2.append(['HEX BOLT M20X100 8.8 HDG', 10])       # 추가
    B = run(pg, mix2, {'date': '2026-10-05T10:00'}, A['snap'])
    db, df = B['doc'], pg.evaluate('([a, b]) => window.__bomTest.cd.diff(a, b)', [A['snap'], B['snap']])
    ck('2.11', 'rev', 'Rev B: 개정 문자 B, 개정 이력 2줄, 같은 key 행은 같은 번호 (불변 조건 6)', db['rev'] == 'B' and len(db['revision']['history']) == 2 and next(c for c in B['checks'] if c['no'] == 6)['ok'], [db['rev'], db['revision']['history'], [c for c in B['checks'] if not c['ok']]])
    na_a = next(x['no'] for x in A['doc']['rows'] if x['ruleId'] == 'N-NA')
    ck('2.11', 'withdrawn', f'사라진 행은 철회로 남고 번호 유지 (N-NA {na_a}, 취소선)', any(x['withdrawn'] and x['ruleId'] == 'N-NA' and x['no'] == na_a and x['status'] == 'WITHDRAWN' for x in db['rows']), [(x['no'], x['ruleId'], x['withdrawn']) for x in db['rows'] if x['withdrawn']])
    ch1 = next((c for c in df['changed'] if c['ref'] == '1'), {})
    ck('2.11', 'diff', '비교: 추가 1 · 삭제 1 · 1번 줄 변경(원문·수량) · 번호 밀림 · 합계 Δ · 철회 행', df['summary']['added'] == 1 and df['summary']['removed'] == 1 and ch1.get('kind') == 'changed' and 'qty' in ch1.get('fields', {}) and 'raw' in ch1.get('fields', {})
       and len(df['renumbered']) >= 1 and df['totalDelta']['supply'] == B['snap']['totals']['supply'] - A['snap']['totals']['supply'] and na_a in df['cd']['withdrawn'], [df['summary'], ch1, df['cd']])
    ka = {l['ref']: l['lineKey'] for l in A['snap']['lines']}
    kb = {l['raw']: l['lineKey'] for l in B['snap']['lines']}
    ck('2.11', 'linekey', '고친 줄(같은 번호·품번, 유사도 ≥ 0.8)은 이전 lineKey를 이어받음', kb['HEX BOLT DIN 933 M12X40 8.8 ZP PLTD'] == ka['1'], [kb.get('HEX BOLT DIN 933 M12X40 8.8 ZP PLTD'), ka.get('1')])
    m = pg.evaluate('([a, b]) => window.__bomTest.cd.match(a, b)', [
        [{'ref': '1', 'pn': 'A', 'raw': 'HEX BOLT M10X30 8.8', 'specKey': 'k1'}, {'ref': '2', 'pn': '', 'raw': 'HEX NUT M10 8.8 ZP DIN 934', 'specKey': 'k2'}, {'ref': '3', 'pn': '', 'raw': 'WASHER M10', 'specKey': 'k3'}, {'ref': '4', 'pn': '', 'raw': 'PIN 6X20', 'specKey': 'k4'}],
        [{'ref': '1', 'pn': 'A', 'raw': 'HEX BOLT M10X30 8.8', 'specKey': 'k1'}, {'ref': '2', 'pn': '', 'raw': 'HEX NUT M10 8.8 ZP DIN 934 GR', 'specKey': 'k2b'}, {'ref': '7', 'pn': '', 'raw': 'FLAT WASHER M10', 'specKey': 'k3'}, {'ref': '9', 'pn': '', 'raw': 'GASKET 4IN', 'specKey': 'k9'}]])
    kinds = sorted((p['prev']['ref'], p['next']['ref'], p['kind']) for p in m['pairs'])
    ck('2.11', 'match', '줄 대응 4단계: 동일 / 변경(유사도) / 번호만 바뀜(사양 키) / 삭제·추가', kinds == [('1', '1', 'same'), ('2', '2', 'changed'), ('3', '7', 'renumbered')] and [x['ref'] for x in m['removed']] == ['4'] and [x['ref'] for x in m['added']] == ['9'], [kinds, m['removed'], m['added']])
    st = pg.evaluate('(s) => window.__bomTest.cd.store(s)', A['snap'])
    ck('2.11', 'store', '발행 Rev 저장: 처음 저장됨, 같은 Rev 다시 저장은 거절(덮어쓰지 않음), 다시 읽힘', st['first']['ok'] and not st['second']['ok'] and st['second']['why'] == 'exists' and st['loaded'] >= 1 and st['last'] == 'A', st)
    # 줄 수 많은 BOM: 코퍼스 224줄을 한 BOM으로
    lines = [[l['raw'], l['qty']] for l in corpus['lines']]
    rc = run(pg, lines, {'date': DATE})
    for c in rc['checks']: ck('corpus', c['no'], f"코퍼스 224줄 한 BOM: {c['name']}", c['ok'], c['detail'])
    ck('corpus', 'perf', f"코퍼스 224줄: 엔진 {rc['ms']['engine']} ms + C&D {rc['ms']['cd']} ms (목표 3,000 ms 이내)", rc['ms']['engine'] + rc['ms']['cd'] < 3000, rc['ms'])
    evs = pg.evaluate('(L) => window.__bomTest.cd.items(L)', lines)
    ids = {r['id'] for r in pg.evaluate('() => window.__bomTest.cd.rules()')}
    seen = {e for it in evs for e in it['ev']}
    ck('corpus', 'cover', f'코퍼스에 나온 엔진 이벤트 {len(seen)}종이 모두 규칙 표에 있음', seen <= ids, sorted(seen - ids))
    for t in corpus['tables']:
        rt = run(pg, t['text'], {'date': DATE})
        ck('corpus', 'table', f"표 붙여넣기 '{t['name']}': 불변 조건 통과", all(c['ok'] for c in rt['checks']), [c for c in rt['checks'] if not c['ok']])
    # 구역 제목 줄 (2.2/2.3): API 610 문맥이 다음 줄들에 적용
    tsv = 'No\tDescription\tQty\n1\tPUMP P-101A (API 610 S-6)\t\n2\tSTUD 1-1/8-8 X 7 B7/2H\t16\n3\t4" CL300\t\n4\tSTUD B7 5/8-11 X 4-3/4\t16'
    rs = run(pg, tsv, {'date': DATE})
    ru = rules(rs['doc'])
    ck('2.2', 'section', '구역 제목 줄: 견적 줄에서 빼고(건너뜀 2), API 610 S-6 → X-API610-NOAUTO, 4" CL300 → L-FLANGE', len(rs['doc']['skipped']) == 2 and len(rs['doc']['lines']) == 2 and 'X-API610-NOAUTO' in ru and 'L-FLANGE' in ru and all(c['ok'] for c in rs['checks']),
       [rs['doc']['skipped'], list(ru)])
    # 규칙 표 형식
    RL = pg.evaluate('() => window.__bomTest.cd.rules()')
    badr = [x['id'] for x in RL if not re.fullmatch(r'[ASXQMKNL]-[A-Z0-9]+(?:-[A-Z0-9]+)*', x['id']) or x['basis'] not in ('local', 'second', 'practice', 'engine', 'policy')
            or (x['out'] == 'row' and not x['gc'] and (not x['ko'] or not x['en'])) or not isinstance(x['refs'], list)]
    ck('5', 'table', f'규칙 표 {len(RL)}개: ID 형식, 근거 수준, KO/EN 템플릿, 근거 목록', not badr, badr)
    fam = {k: sum(1 for x in RL if x['id'][0] == k) for k in 'ASXQMKNL'}
    ck('5', 'families', f'규칙 계열 A·S·X·Q·M·K·N·L 모두 있음 {fam}', all(fam.values()), fam)
    sec2 = [x['id'] for x in RL if x['basis'] in ('second', 'practice') and x['type'] in ('D', 'E')]
    ck('5', 'evidence', '2차 자료·관행 근거 규칙 중 D는 실제로 다른 것을 공급·제안하는 S-DIN-WAF·S-KS-3JONG(·S-KS-1JONG M10/12/14/22)뿐', set(sec2) <= {'S-DIN-WAF', 'S-KS-3JONG'}, sec2)
    txt = json.dumps(RL, ensure_ascii=False) + json.dumps(pg.evaluate('() => window.__bomTest.cd.gcList()'), ensure_ascii=False)
    hits = [w for w in BANNED + ['MR-024', 'Aramco', 'Santos', 'Petrobras', 'Eurolink', 'Southwest Bolt', 'Xylan', 'EIL', 'BHEL', 'Chevron'] if w.lower() in txt.lower()]
    ck('rules', 'banned', '규칙·GC 문구에 경쟁사·제3자 이름·문서 번호 없음', not hits, hits)


def tstatic():
    src = ''.join((HERE.parent / 'src' / f).read_text(encoding='utf-8') for f in ('c1_cd.js', 'c2_cdbuild.js'))
    hits = [w for w in BANNED + ['MR-024', 'Aramco', 'Santos', 'Petrobras', 'Eurolink', 'Southwest', 'Xylan', 'BHEL', 'Chevron', '회사 매트릭스'] if w.lower() in src.lower()]
    ck('static', 'banned', 'c*.js에 금지 이름·문구 없음', not hits, hits)
    ck('static', 'cutoff', 'c*.js에 출고 마감 시각 하드코딩 없음 (CUTOFF만)', not re.search(r'14\s*시|14:00', src), re.findall(r'.{20}(?:14\s*시|14:00).{20}', src)[:3])
    ck('static', 'dialog', 'c*.js에 alert/confirm/prompt 없음', not re.search(r'\b(alert|confirm|prompt)\s*\(', src))
    page = PAGE.read_text(encoding='utf-8')
    ck('static', 'block', 'c1_cd.js·c2_cdbuild.js가 엔진 블록 안에 한 번씩', page.count('/* ── c1_cd.js ── */') == 1 and page.count('/* ── c2_cdbuild.js ── */') == 1 and page.index('/* ── c2_cdbuild.js ── */') < page.index('/* ==== BOM ENGINE END ==== */'))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'cd_index.html').write_text(wrap(PAGE.read_text(encoding='utf-8')), encoding='utf-8')
    corpus = json.loads((HERE / 'corpus.json').read_text(encoding='utf-8'))
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE)
        pg = b.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto((OUT / 'cd_index.html').as_uri() + '#home')
        t101(pg); t102(pg); t103(pg); tmisc(pg, corpus); tmore(pg)
        global RULE_LIST
        RULE_LIST = pg.evaluate('() => window.__bomTest.cd.rules()')
        # 브라우저 저장소가 막힌 경우에도 예외 없이 동작 (try/catch)
        pg2 = b.new_page(); e2 = []
        pg2.on('pageerror', lambda e: e2.append(str(e)))
        pg2.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });")
        pg2.goto((OUT / 'cd_index.html').as_uri() + '#home')
        st = pg2.evaluate('() => { const r = window.__bomTest.cd.run([["HEX BOLT M10X30 8.8 ZP", 10]], { date: "2026-10-01" }); return window.__bomTest.cd.store(r.snap); }')
        ck('2.11', 'store-blocked', '저장소가 막혀도 오류 없이 { ok: false, why: storage }', st['first'] == {'ok': False, 'why': 'storage'} and st['loaded'] == 0 and not [e for e in e2 if 'blocked' not in e], [st, e2[:3]])
        b.close()
    tstatic()
    RL = json.loads(json.dumps(RULE_LIST))
    gc_map = {x['id']: x['gc'] for x in RL if x['gc']}
    # 2026-10 감사(INTEGRATE F): API 610 재질 클래스 자료를 비워 둔 동안 판·부위·조건 질문 규칙은 발화할 수 없다 (자료를 다시 채우면 이 목록을 지운다)
    DORMANT = {'S-API610-ED', 'S-API610-MAT', 'S-API610-PART', 'S-API610-GRADE', 'S-API610-CHK'}
    unfired = sorted(x['id'] for x in RL if x['out'] == 'row' and not x['gc'] and x['id'] not in SEEN and x['id'] not in DORMANT)
    ck('coverage', 'rules', f"규칙 표 {len(RL)}개 중 행 규칙 {sum(1 for x in RL if x['out'] == 'row' and not x['gc'])}개가 시험에서 한 번 이상 발화 (GC 규칙 {len(gc_map)}개, 엔진 메모 K-EQ 제외)", not unfired, unfired)
    ck('page', 'errors', '페이지 오류 0건', not errs, errs[:5])
    fails = [x for x in R if not x[3]]
    suites = {}
    for s, _, _, ok, _ in R: suites.setdefault(s, [0, 0]); suites[s][0] += ok; suites[s][1] += 1
    report = {'page': str(PAGE), 'checks': f'{len(R) - len(fails)}/{len(R)} passed', 'suites': {k: f'{v[0]}/{v[1]}' for k, v in suites.items()},
              '10.2': f"{sum(1 for x in R if x[0] == '10.2' and x[3])}/{sum(1 for x in R if x[0] == '10.2')} cases",
              '10.1 invariants passing on good docs': sorted({x[1] for x in R if x[0] == '10.1' and x[3] and x[1] != '-'}, key=lambda s: int(s) if s.isdigit() else 99),
              'failures': [f'[{f[0]} {f[1]}] {f[2]} :: {f[4]}' for f in fails[:25]]}
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if '--fails' in sys.argv or fails:
        for f in fails: print('FAIL', f)
    if '--verbose' in sys.argv:
        for x in R: print('ok  ' if x[3] else 'FAIL', x[0], x[1], x[2])
    if '--json' in sys.argv: (OUT / sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(R, ensure_ascii=False, indent=1), encoding='utf-8')
    sys.exit(0 if not fails else 1)


if __name__ == '__main__':
    main()
