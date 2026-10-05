"""BOM 엔진 정확도 테스트.
페이지(조각)를 완전한 문서로 감싸 headless Chromium에 띄우고, corpus.json의 모든 줄을 window.__bomTest.parse로 해석한 뒤
기대값(자유 서술)과 필드별로 대조한다. 기대 서술은 아래 규칙으로 표준 코드로 바꾼 뒤 비교한다.
사용: python3 test.py [--page 조각.html] [--out 폴더] [--verbose|--fails] [--json 파일.json]
   --page 기본 integ/page.html, --out 기본 integ/out. 쓰는 파일은 모두 --out 폴더 안 (상대 경로 --json도 --out 기준)."""
import json, re, sys, pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
def opt(name, default):  # --page / --out (공용: holdout·ui_check·interact도 씀)
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv and sys.argv.index(name) + 1 < len(sys.argv) else default
PAGE = pathlib.Path(opt('--page', HERE / 'page.html')).resolve()
OUT = pathlib.Path(opt('--out', HERE / 'out')).resolve()
import os
EXE = os.environ.get('BN_CHROMIUM') or None   # None: playwright 기본 크로미움 (python -m playwright install chromium)
FIELDS = ['type', 'system', 'size', 'pitchOrTpi', 'series', 'tolClass', 'length', 'point', 'drive', 'dimStd', 'material', 'finish', 'status', 'qty', 'ask', 'spec']

def wrap_verify(fragment: str) -> str:  # verify.py와 글자까지 같은 감싸기 (ui_check·interact용)
    m = re.match(r'\s*<title>(.*?)</title>\s*', fragment, re.S)
    return ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'<title>{m.group(1) if m else ""}</title>\n<style>[hidden]{{display:none!important}} body{{margin:0}} img{{max-width:100%}}</style>\n</head>\n<body>\n{fragment[m.end():] if m else fragment}\n</body>\n</html>\n')

def wrap(fragment: str) -> str:  # verify.py와 같은 감싸기
    m = re.match(r'\s*<title>(.*?)</title>\s*', fragment, re.S)
    body = fragment[m.end():] if m else fragment
    return ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            f'<title>{m.group(1) if m else ""}</title>\n<style>[hidden]{{display:none!important}} body{{margin:0}}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')

IN_NUM = {'#0': .06, '#1': .073, '#2': .086, '#3': .099, '#4': .112, '#5': .125, '#6': .138, '#8': .164, '#10': .19, '#12': .216}
def frac(s):
    s = s.strip()
    if s.startswith('#'): return IN_NUM.get(s)
    m = re.fullmatch(r'(\d+)-(\d+)/(\d+)', s)
    if m: return int(m[1]) + int(m[2]) / int(m[3])
    m = re.fullmatch(r'(\d+)/(\d+)', s)
    if m: return int(m[1]) / int(m[2])
    return float(s)

def c_type(e):
    e = e.lower()
    R = [('pipe fitting', 'pipe'), ('valve', 'valve'), ('hand tool', 'tool'), ('set screw', 'setscrew'), ('machine screw', 'machinescrew'), ('countersunk', 'fhcs'), ('button head', 'bhcs'), ('cap screw, proprietary', 'capscrew'),
         ('socket head cap screw', 'shcs'), ('self-clinching', 'clinch'), ('expansion anchor', 'expanchor'), ('anchor rod', 'anchor'), ('stud', 'stud'),
         ('threaded rod', 'rod'), ('heavy hex nut', 'heavynut'), ('heavy hex bolt', 'heavyhexbolt'), ('hex cap screw', 'hexbolt'), ('hex head', 'hexbolt'),
         ('hex bolt', 'hexbolt'), ('bolt, aerospace', 'bolt'), ('lock washer', 'lockwasher'), ('washer', 'washer'), ('nut', 'nut'), ('insert', 'insert'),
         ('rivet', 'rivet'), ('retaining ring', 'ring'), ('pin', 'pin'), ('o-ring', 'oring'), ('gasket', 'gasket'), ('key', 'key'), ('disc spring', 'discspring'), ('eye bolt', 'bolt'), ('not a fastener', 'nonfast')]
    for k, v in R:
        if k in e: return v
    return '?'

def size_ok(e, q):
    s = q.get('size')
    if e.startswith('per ') or e.startswith('unknown'): return not s or s.get('v') is None and 'AS568' not in (s.get('label') or '')
    if not s: return False
    if 'AS568' in e: return 'AS568-214' in (s.get('label') or '')
    if 'NPS' in e: return re.search(r'NPS \d+', e)[0] in (s.get('label') or '')
    if s.get('v') is None: return False
    m = re.match(r'M(\d+(?:\.\d+)?)', e)
    if m: return abs(float(m[1]) - s['v']) < .01 and q['system'] == 'metric'
    m = re.match(r'(#\d+|\d+-\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)', e)
    v = frac(m[1])
    if re.match(r'[#\d\-/.]+\s*(in\b|\(|-|$)', e) and 'mm' not in e.split('(')[0]: return abs(v - s['v']) < .002 and q['system'] == 'inch'
    return abs(v - s['v']) < .01

def pitch_ok(e, q):
    m = re.match(r'(\d+(?:\.\d+)?)\s*TPI', e)
    if m: return q.get('tpi') == float(m[1])
    m = re.match(r'(\d+(?:\.\d+)?)\s*mm', e)
    return bool(m) and q.get('pitch') is not None and abs(q['pitch'] - float(m[1])) < 1e-6

def c_series(e):
    for k, v in [('UNJF', 'UNJF'), ('8UN', '8UN'), ('UNC', 'UNC'), ('UNF', 'UNF'), ('metric coarse', 'coarse'), ('metric fine', 'fine')]:
        if e.startswith(k): return v
    return '?'

def c_tol(e):
    m = re.search(r'\b(5g6g|6g|6H|6AZ|[123][AB])\b', e)
    return m[1] if m else 'OS' if 'oversize' in e else '?'

def len_mm(e):
    if re.match(r'\s*[\d.]+D\b', e): return float(re.search(r'\((\d+(?:\.\d+)?) mm\)', e)[1])
    m = re.match(r'([\d.]+)\s*mm', e)
    if m: return float(m[1])
    m = re.match(r'([\d\-/.]+)\s*ft', e)
    if m: return frac(m[1]) * 304.8
    m = re.match(r'([\d\-/.]+)\s*in', e)
    return frac(m[1]) * 25.4

def drive_ok(e, q):
    d = q.get('drive')
    if not d: return False
    kind = 'socket' if 'socket' in e else 'hex'
    if d['kind'] != kind: return False
    vals = re.findall(r'([\d][\d\-/.]*)\s*(in|mm)\s*(?:key|A/F)', e)
    for v, u in vals:
        x = frac(v)
        dv = d['v'] * (25.4 if d['unit'] == 'in' and u == 'mm' else 1) / (25.4 if d['unit'] == 'mm' and u == 'in' else 1)
        if abs(x - dv) < (.002 if u == 'in' else .05): return True
    return False

STD_RE = re.compile(r'(ISO|DIN|KS B|JIS B|ASME B|ASTM [A-F]|NAS|MS|AN|AS)\s?(\d+(?:\.\d+)*)((?:/\d+)*)')
def std_tokens(s):
    out = []
    for m in STD_RE.finditer(s or ''):
        pre = m[1] + (' ' if m[1] in ('ISO', 'DIN', 'KS B', 'JIS B') else '')
        out.append(pre + m[2])
        out += [pre + x for x in m[3].split('/') if x]
    return out

MAT_R = [('titanium', 'TI'), ('Inconel', 'IN718'), ('F468', 'F468'), ('FKM', 'FKM'), ('graphite', '316/GRAPHITE'), ('aluminium', 'AL'), ('CRES', 'CRES'), ('corrosion-resistant', 'CRES'),
         ('per manufacturer', 'MFR'), ('B7M', 'B7M'), ('L7M', 'L7M'), ('B8M', 'B8M'), ('B16', 'B16'), ('A320 L7', 'L7'), ('A193 B7', 'B7'), ('F1554', 'F1554-55'), ('A307', 'A307A'),
         ('A563', 'A563-DH'), ('F436', 'F436-1'), ('A574', 'A574'), ('F912', 'F912'), ('F880', 'F880'), ('F837', 'F837'), ('F835', 'F835'), ('F879', 'F879'), ('F593 Group 1', 'F593-1'),
         ('F593 Group 2', 'F593-2'), ('F594', 'F594-1'), ('A194 2H', '2H'), ('J995 Grade 8', 'J995-8'), ('J429 Grade 5', 'J429-5'), ('J429 Grade 8', 'J429-8'), ('45H', '45H'),
         ('010.9', '010.9'), ('12.9', '12.9'), ('10.9', '10.9'), ('8.8', '8.8'), ('4.8', '4.8'), ('property class 8', 'N8'), ('200 HV', '200HV'), ('A4', 'A4'), ('A2', 'A2'), ('SUS304', 'A2'),
         ('18-8', '18-8'), ('spring steel', 'SPR'), ('stainless', 'SS')]
def c_mat(e):
    for k, v in MAT_R:
        if k in e: return v
    return '?'

FIN_P = [('cadmium', 'CD'), ('zinc-nickel', 'ZNNI'), ('zinc flake', 'ZF'), ('hot-dip', 'HDG'), ('galvaniz', 'HDG'), ('xylan', 'PTFE'), ('ptfe', 'PTFE'), ('fluoropolymer', 'PTFE'), ('yellow zinc', 'YZ'),
         ('trivalent yellow', 'YZ'), ('zinc', 'ZN'), ('black oxide', 'BO'), ('black', 'BO'), ('plain', 'PL'), ('passivat', 'PL'), ('oiled', 'PL')]
def c_fin(e):
    e = e.lower().replace('not stated:', '').strip()
    if not e or e == 'not stated': return 'NS'
    best = None
    for k, v in FIN_P:
        i = e.find(k)
        if i >= 0 and (best is None or i < best[0] or (i == best[0] and len(k) > best[1])): best = (i, len(k), v)
    return best[2] if best else '?'

def check(field, e, q, m):
    if field == 'type': return c_type(e) == q['type'], c_type(e), q['type']
    if field == 'system': return {'mm': 'metric'}.get(e, e) == q['system'], e, q['system']
    if field == 'size': return size_ok(e, q), e, q.get('size')
    if field == 'pitchOrTpi': return pitch_ok(e, q), e, q.get('tpi') or q.get('pitch')
    if field == 'series': return c_series(e) == q.get('series'), c_series(e), q.get('series')
    if field == 'tolClass': return c_tol(e) == q.get('tolClass'), c_tol(e), q.get('tolClass')
    if field == 'length': return q.get('lengthMm') is not None and abs(len_mm(e) - q['lengthMm']) <= max(.3, .005 * len_mm(e)), round(len_mm(e), 2), q.get('lengthMm')
    if field == 'point': return e.split('(')[0].strip() == q.get('point'), e, q.get('point')
    if field == 'drive': return drive_ok(e, q), e, (q.get('drive') or {}).get('label')
    if field == 'dimStd':
        a, b = std_tokens(e), std_tokens(q.get('dimStd'))
        return bool(a and b and (a[0] in b or b[0] in a)), a, q.get('dimStd')
    if field == 'material': return c_mat(e) == (q.get('mat') or {}).get('code'), c_mat(e), (q.get('mat') or {}).get('code')
    if field == 'finish':
        c = c_fin(e)
        if c == 'NS': return bool(q.get('finDefault')), 'NS', q.get('fin')
        return c == (q.get('fin') or {}).get('code'), c, (q.get('fin') or {}).get('code')
    if field == 'status': return e == m['status'], e, m['status']
    if field == 'qty':  # '1000 EA' / '16 SET'
        n, u = e.split()
        return m['qty'] == float(n) and m['unit'] == u, e, f"{m['qty']} {m['unit']}"
    if field == 'ask':  # 이 문구가 질문·수량 확인·사유 중 하나에 있어야 함
        txt = ' '.join(q.get('questions') or []) + ' ' + (m.get('qtyWarn') or '') + ' ' + ' '.join(r['text'] for r in m['reasons'])
        return e in txt, e, txt[:160]
    if field == 'spec': return e in m['spec'], e, m['spec']

# ── 엔진 단위 검사 (window.__bomTest): 금액 한글 표기, 부가세 배분, 포장 조합, 인치 분수, API 610, 납기 티어 ──
# 기대값은 손으로 적은 값이다 (엔진 출력에서 복사하지 않음).
UNIT_JS = r"""() => {
  const T = window.__bomTest, out = [], eq = (a, b) => JSON.stringify(a) === JSON.stringify(b), ck = (name, ok, got) => out.push([name, !!ok, ok ? '' : JSON.stringify(got).slice(0, 300)]);
  if (!T.pack || !T.wonKo || !T.api610) { ck('engine unit API present', false, Object.keys(T)); return out; }
  // d) 한글 금액 (일십·일백·일천처럼 1도 적는 견적서 표기)
  const W = [[0, '영원'], [7, '칠원'], [10, '일십원'], [11, '일십일원'], [100, '일백원'], [1000, '일천원'], [10000, '일만원'], [100000, '일십만원'], [7700, '칠천칠백원'], [68200, '육만팔천이백원'],
    [129800, '일십이만구천팔백원'], [1000000, '일백만원'], [100000000, '일억원'], [123456789, '일억이천삼백사십오만육천칠백팔십구원'], [100010000, '일억일만원'], [1234560, '일백이십삼만사천오백육십원']];
  for (const [n, w] of W) { ck(`wonKo(${n})`, T.wonKo(n) === w, T.wonKo(n)); ck(`wonKoNum(wonKo(${n}))`, T.wonKoNum(T.wonKo(n)) === n, T.wonKoNum(T.wonKo(n))); }
  ck('wonKoDoc(129800)', T.wonKoDoc(129800) === '금 일십이만구천팔백원정 (₩129,800)', T.wonKoDoc(129800));
  ck('wonKoNum(일금 …원정)', T.wonKoNum('일금 일백이십삼만사천오백육십원정') === 1234560, T.wonKoNum('일금 일백이십삼만사천오백육십원정'));
  let seed = 12345, bad = [];
  for (let i = 0; i < 2000; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; const n = seed % (i < 1000 ? 1000000 : 2000000000); if (!T.wonKoOk(n)) bad.push(n); }
  ck('wonKo round trip 2000 numbers', !bad.length, bad.slice(0, 5));
  // d) 부가세: 합계에서 한 번 반올림, 줄 세액 합 = 합계 세액, 한글 금액 = 합계
  ck('vatSplit tie', eq(T.vatSplit([3, 3, 3], 1), [1, 0, 0]), T.vatSplit([3, 3, 3], 1));
  ck('vatSplit remainder', eq(T.vatSplit([15, 15], 3), [2, 1]), T.vatSplit([15, 15], 3));
  bad = [];
  for (let i = 0; i < 300; i++) { const k = 1 + i % 7, a = []; for (let j = 0; j < k; j++) { seed = (seed * 1103515245 + 12345) % 2147483648; a.push(seed % 500000); } const S = a.reduce((x, y) => x + y, 0), v = Math.round(S * .1), sp = T.vatSplit(a, v); if (sp.reduce((x, y) => x + y, 0) !== v || sp.some((x, j) => Math.abs(x - a[j] * .1) > 1)) bad.push([a, v, sp]); }
  ck('vatSplit sums to total VAT (300 sets)', !bad.length, bad.slice(0, 2));
  for (const L of [[['HEX BOLT M10X30 8.8 ZINC', 10]], [['HEX BOLT M10X30 8.8 ZINC', 100], ['HEX NUT M10 8 ZINC', 100], ['STUD 3/4-10 X 4-3/4 B7/2H', 16], ['SHCS M8X25 12.9', 37], ['BALL VALVE 2"', 1]]]) {
    const t = T.totals(L), ship = t.sub === 0 ? 0 : t.sub >= 50000 ? 0 : 4000;
    ck(`totals ${L.length} lines: ship`, t.ship === ship, t);
    ck(`totals ${L.length} lines: vat = round((sub+ship)×0.1)`, t.vat === Math.round((t.sub + t.ship) * .1), t);
    ck(`totals ${L.length} lines: line VAT sum`, t.lines.reduce((a, x) => a + x.vat, 0) + t.shipVat === t.vat, t);
    ck(`totals ${L.length} lines: total`, t.total === t.sub + t.ship + t.vat, t);
    ck(`totals ${L.length} lines: words == number`, t.wordsOk && T.wonKoNum(t.words) === t.total && t.doc.includes(t.total.toLocaleString('ko-KR')), t);
  }
  // c) 포장 조합: 필요 수량 이상 최소 비용, 여유 허용, 같은 값이면 포장 수가 적은 쪽
  const P = (args, ordered, amount, packs) => { const r = T.pack(...args); ck(`pack ${JSON.stringify(args)}`, r && r.ordered === ordered && r.amount === amount && eq(r.packs.map(p => [p.size, p.count]), packs) && r.over === ordered - args[0], r); };
  P([36, [{ size: 2, price: 4000 }, { size: 20, price: 29100 }]], 40, 58200, [[20, 2]]);
  P([71, [{ size: 10, price: 4000 }, { size: 100, price: 29500 }]], 100, 29500, [[100, 1]]);
  P([10, [{ size: 1, price: 100 }, { size: 10, price: 1000 }]], 10, 1000, [[10, 1]]);
  P([5, [{ size: 1, price: 100 }, { size: 10, price: 900 }]], 5, 500, [[1, 5]]);
  P([95, [{ size: 1, price: 100 }], [[1, 1], [100, .88]]], 100, 8800, [[1, 100]]);
  P([3, [{ size: 2, price: 10 }]], 4, 20, [[2, 2]]);
  P([50001, [{ size: 100, price: 8000 }, { size: 1000, price: 70000 }, { size: 1, price: 90 }]], 50001, 3500090, [[1000, 50], [1, 1]]);
  const C = (args, ordered, amount, packs) => { const r = T.packCat(...args); ck(`packCat ${JSON.stringify(args)}`, r && r.ordered === ordered && r.amount === amount && eq(r.packs.map(p => [p.size, p.count]), packs), r); };
  C([95, 50, [[1, 120], [100, 100]]], 100, 10000, [[50, 2]]);
  C([230, 100, [[1, 50], [100, 44]]], 230, 10120, [[100, 2], [1, 30]]);
  C([99, 100, [[1, 100], [100, 99]]], 100, 9900, [[100, 1]]);
  C([16, 1, [[1, 9000]], 'SET'], 16, 144000, [[1, 16]]);
  const pl = T.parse('HEX BOLT M10X30 8.8 ZINC', 95).m;
  ck('catalog packPlan present, BOM qty unchanged', pl.packPlan && pl.qty === 95 && pl.amount === pl.price * 95 && pl.packPlan.ordered >= 95, pl.packPlan);
  // a) 페이지 inchToMm (BOM hook으로 엔진 inVal 사용)
  const I = [['15/16', 23.8125], ['1-1/8', 28.575], ['7/16', 11.1125], ['11/16', 17.4625], ['1 3/8', 34.925], ['3/4"', 19.05], ['.750', 19.05], ['1.1/8', 28.575], ['1½', 38.1], ['1-1/2 in', 38.1], ['0.375', 9.525]];
  for (const [s, mm] of I) ck(`inchToMm(${s})`, Math.abs(T.inchToMm(s) - mm) < 1e-6, T.inchToMm(s));
  ck('inchToMm(abc) is NaN', Number.isNaN(T.inchToMm('abc')), T.inchToMm('abc'));
  // f) API 610
  const A = (t, f) => { const r = T.api610(t); ck(`api610 ${t}`, f(r), r && { cls: r.cls, edition: r.edition, src: r.editionSource, status: r.status, bolting: r.bolting }); };
  // 2026-10 감사 (INTEGRATE F): 재질 클래스 → 볼팅 자료를 뺐다. 클래스가 읽히면 판과 관계없이 엔지니어 견적, 볼팅 값 없음
  A('API 610 C-6', r => r.cls === 'C-6' && r.edition === null && r.editionSource === null && r.status === 'engineer-quote' && r.bolting.stud === null && r.bolting.nut === null && r.caveats.length > 0);
  A('API610 12th S-6', r => r.cls === 'S-6' && r.edition === '12th' && r.editionSource === 'number' && r.status === 'engineer-quote' && r.bolting.stud === null);
  A('Class S-5 per API 610 11th', r => r.cls === 'S-5' && r.edition === '11th' && r.status === 'engineer-quote' && r.bolting.nut === null);
  A('API 610-2010 C-6 STUD', r => r.edition === null && r.status === 'engineer-quote' && r.caveats.some(c => /2010/.test(c)));
  A('API 610 ISO 13709:2003 C-6 nut', r => r.edition === null && r.editionSource === 'iso-ambiguous' && r.status === 'engineer-quote' && r.bolting.stud === null);
  A('ISO 13709:2009 C-6 STUD', r => r.edition === null && r.editionSource === 'iso-ambiguous' && r.status === 'engineer-quote' && r.bolting.stud === null);
  A('API 610 Eleventh edition C-6 STUD', r => r.edition === '11th' && r.editionSource === 'word' && r.status === 'engineer-quote');
  A('API 610 11판 C-6 스터드', r => r.edition === '11th' && r.status === 'engineer-quote');
  A('BOLTING PER API 610', r => r.cls === null && r.status === 'context');
  A('API 610 C-6 S-6 STUD', r => r.status === 'engineer-quote' && /클래스 표기 2개/.test(r.why));
  A('API 610-2021 11th ed C-6 stud', r => r.edition === null && r.editionSource === 'conflict' && r.status === 'engineer-quote');
  A('API 610 12th I-1 STUD', r => r.status === 'engineer-quote' && /삭제/.test(r.why));
  A('API 610 13th C-6 STUD', r => r.status === 'engineer-quote' && r.edition === '13th');
  A('API 610 12판 S-4 LCB 스터드 저온 −50℃', r => r.status === 'engineer-quote' && r.mdmtC === -50 && r.service === 'lowTemp');
  ck('api610 needs context (STUD A2-70 M16 C6)', T.api610('STUD A2-70 M16 C6') === null, T.api610('STUD A2-70 M16 C6'));
  const hdr = T.api610('RFQ: pumps per API 610 12th edition, class S-6'), hs = T.parse('STUD 3/4-10 X 4-1/2 W/2 NUTS', 16, null, { api610: hdr });
  ck('api610 header context → engineer quote, no auto-fill from the class', hs.q.api610 && hs.q.api610.from === 'header' && hs.q.api610.status === 'engineer-quote' && !(hs.q.mat && hs.q.mat.api610) && hs.m.status === 'engineer-quote' && !hs.q.questions.length, [hs.q.api610, hs.q.mat, hs.q.questions]);
  // b) 출고 마감은 페이지 상수 하나
  const tm = T.terms();
  // 재고 운영 스위치 (no-stock validation mode): 자체 재고면 마감 14시(페이지 값), 아니면 도매처 재고 마감 12시 (supply.json PARTNER_STOCK)
  ck('OWN_STOCK switch exposed by terms()', typeof tm.OWN_STOCK === 'boolean', tm.OWN_STOCK);
  ck(`CUTOFF is the page constant (${tm.OWN_STOCK ? '14, own stock' : '12, partner stock'})`, tm.CUTOFF === (tm.OWN_STOCK ? 14 : 12), tm.CUTOFF);
  ck('VAT method documented', tm.BOM_VAT.method === 'total-round' && /반올림/.test(tm.BOM_VAT.gc.ko), tm.BOM_VAT);
  return out;
}"""
BANNED = ['회사 매트릭스', '회사 관행', '사용자 회사', '사용자 제공 매트릭스', 'company matrix', '백만볼트', 'millionbolt', '나비엠알오', 'NAVIMRO', 'navimro',
          '아이마켓', 'imarket', 'MISUMI', '미스미', 'Würth', '뷔르트', 'Grainger', '그레인저', 'MonotaRO', '모노타로', 'Portland Bolt', 'ISO 9001 인증', 'ISO 9001 certified']
# 대표의 현재·이전 직장 이름처럼 공개 저장소에 적을 수 없는 금지어: 환경 변수 BN_PRIVATE_BANNED('|'로 구분) 또는
# 같은 폴더의 private_banned.txt(한 줄에 하나, git에 올리지 않음)에서 읽는다. 없으면 이 점검은 건너뛴다.
BANNED += [x for x in os.environ.get('BN_PRIVATE_BANNED', '').split('|') if x.strip()]
_pb = pathlib.Path(__file__).with_name('private_banned.txt')
if _pb.exists():
    BANNED += [l.strip() for l in _pb.read_text(encoding='utf-8').splitlines() if l.strip()]
RULE_RE = re.compile(r'^[A-Z]{1,2}-[A-Z0-9]+(?:-[A-Z0-9]+)*$')

def engine_checks(page_text, corpus, res, tm):
    """corpus 결과로 보는 불변 조건 + 엔진 블록 정적 검사. [이름, 통과, 설명] 목록"""
    out = []
    ck = lambda name, ok, got='': out.append([name, bool(ok), '' if ok else str(got)[:300]])
    m = re.search(r'/\* ==== BOM ENGINE START ==== \*/(.*?)/\* ==== BOM ENGINE END ==== \*/', page_text, re.S)
    eng = m.group(1) if m else ''
    ck('engine block found', bool(eng))
    hits = [w for w in BANNED if w.lower() in eng.lower()]
    ck('no banned names / internal-data wording in engine block', not hits, hits)
    ck('no hard-coded cutoff hour in engine block', not re.search(r'14\s*시|14:00', eng), re.findall(r'.{20}(?:14\s*시|14:00).{20}', eng)[:3])
    badrule, noev, tierbad, ownbad = [], [], [], []
    cut = f"{tm['CUTOFF']:02d}:00"   # 출고 마감 = 페이지 CUTOFF (자체 재고 14:00 / 도매처 재고 12:00)
    for l, r in zip(corpus, res):
        q, mm = r['q'], r['m']
        ev = mm.get('ev')
        if not isinstance(ev, list): noev.append(l['raw']); continue
        badrule += [(l['raw'], e) for e in ev if not RULE_RE.match(str(e.get('rule', '')))]
        strings = (q.get('assumptions') or []) + (q.get('questions') or []) + [x['text'] for x in mm['reasons'] if x['tone'] in ('warn', 'crit')]
        if strings and not ev: noev.append(l['raw'])
        if mm['status'] == 'not-available' and not any(e['rule'] in ('N-NA', 'N-UNREAD') for e in ev): noev.append('NA without N-NA: ' + l['raw'])
        if mm.get('qtyWarn') and not any(e['rule'] == 'K-QTY' for e in ev): noev.append('qtyWarn without K-QTY: ' + l['raw'])
        t = mm.get('lead')
        if mm['status'] == 'not-available': ok = t is None
        elif mm['status'] == 'catalog': ok = t and t['code'] in ('OWN_STOCK', 'PARTNER_STOCK', 'MRO_BACKUP') and t['cutoff'] == cut and t['dispatch'][1] == mm['leadDays'] and t['requiresQuote'] is False and t['returnable'] is True and (t['code'] == 'OWN_STOCK') == bool(mm['stock'])
        else: ok = t and t['requiresQuote'] is True and t['label'] in ('자체 재고', '도매처 재고', '국내 제작', '해외 수입', '견적 문의') and (t['code'] != 'NO_SOURCE' or t['toCustomer'] is None)
        if not ok or (t and mm.get('tierCode') != t['code']): tierbad.append((l['raw'], mm['status'], t))
        if not tm['OWN_STOCK'] and (mm.get('stock') or (t and t['code'] == 'OWN_STOCK') or ((mm.get('alt') or {}).get('stock'))): ownbad.append(l['raw'])
    ck('every event has a rule ID', not badrule, badrule[:3])
    ck('lines with warning/question/assumption strings carry events (m.ev)', not noev, noev[:5])
    ck('supply tier invariants (m.lead, m.tierCode)', not tierbad, tierbad[:3])
    ck(f"OWN_STOCK = {str(tm['OWN_STOCK']).lower()}: {'own-stock tier allowed' if tm['OWN_STOCK'] else 'no line has the stock flag or the OWN_STOCK tier'}", not ownbad, ownbad[:3])
    by = {l['raw']: r for l, r in zip(corpus, res)}
    def has(raw, *rules):
        r = by.get(raw)
        got = [e['rule'] for e in r['m']['ev']] if r else None
        ck(f'events {raw} ⊇ {rules}', r and all(x in got for x in rules), got)
    has('SHCS M8X25 A4', 'A-SS-CLASS', 'A-THD-PITCH', 'A-FIN', 'A-TOL-M')
    has('HHCS 1.1/8-7 UNC X 3-1/2 GR5 ZINC', 'A-NORM', 'A-TOL-IN')
    has('육각너트 3종 M10 SUS304', 'S-KS-3JONG', 'K-EQ', 'A-SS-CLASS')
    has('API 610 13th C-6 STUD 3/4-10 X 4-1/2 W/2 NUTS', 'X-API610-NOAUTO')
    has('STUD 1-1/8-7 UNC X 7 W/2 NUTS API 610 12th S-6', 'X-API610-NOAUTO')
    r = by.get('STUD 3/4-10 UNC X 4-1/2 W/2 NUTS API 610 C-6')
    ck('C-6 stud without edition: X-API610-NOAUTO once, no class auto-fill (S-API610-ED/MAT)', r and sum(e['rule'] == 'X-API610-NOAUTO' for e in r['m']['ev']) == 1 and not any(e['rule'] in ('S-API610-ED', 'S-API610-MAT') for e in r['m']['ev']), r and r['m']['ev'])
    return out

def main():
    verbose = '--verbose' in sys.argv
    out = OUT; out.mkdir(parents=True, exist_ok=True)
    (out / 'test_index.html').write_text(wrap(PAGE.read_text(encoding='utf-8')), encoding='utf-8')
    corpus = json.loads((HERE / 'corpus.json').read_text(encoding='utf-8'))['lines']
    errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE)
        pg = b.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto((out / 'test_index.html').resolve().as_uri() + '#home')
        pg.wait_for_function('window.__bomTest && typeof window.__bomTest.parse === "function"')
        res = pg.evaluate('(L) => L.map(l => window.__bomTest.parse(l.raw, l.qty))', corpus)
        tables = json.loads((HERE / 'corpus.json').read_text(encoding='utf-8')).get('tables', [])
        tres = pg.evaluate('''(T) => T.map(t => { const r = window.__bomTest.rows(t.text); return r.rows.map(row => { const x = window.__bomTest.parse(row.text, row.qty, row); return { no: row.no, pn: row.pn, text: row.text, qty: x.m.qty, status: x.m.status, ask: (x.q.questions || []).join(' ') + ' ' + (x.m.qtyWarn || '') }; }); })''', tables)
        drawn = pg.evaluate('(L) => L.map(l => { const r = window.__bomTest.parse(l.raw, l.qty); const s = window.__bomTest.draw(l.raw, l.qty); return r.m.status === "not-available" || r.q.variant ? null : !!s; })', corpus)
        units = pg.evaluate(UNIT_JS)
        tm = pg.evaluate('window.__bomTest.terms()')
        b.close()
    tot = {f: [0, 0] for f in FIELDS}; fails = []
    for i, (l, r) in enumerate(zip(corpus, res)):
        for f in FIELDS:
            if f not in l['expect']: continue
            ok, exp, got = check(f, l['expect'][f], r['q'], r['m'])
            tot[f][1] += 1; tot[f][0] += bool(ok)
            if not ok: fails.append((i + 1, f, l['raw'], exp, got))
    nodraw = [corpus[i]['raw'] for i, d in enumerate(drawn) if d is False]
    tfails, tok = [], 0
    for t, rows in zip(tables, tres):
        good = len(rows) == len(t['expect'])
        why = [] if good else [f"rows {len(rows)} != {len(t['expect'])}"]
        for ex, r in zip(t['expect'], rows):
            for k, v in ex.items():
                ok = (v.upper() in r['text'].upper()) if k == 'has' else (v in r['ask']) if k == 'ask' else (str(r[k]) == v if k != 'qty' else float(r['qty']) == float(v))
                if not ok: good = False; why.append(f"{k}: want {v!r} got {r.get(k if k not in ('has',) else 'text')!r}")
        tok += good
        if not good: tfails.append((t['name'], why, rows))
    allc = sum(v[0] for v in tot.values()); alln = sum(v[1] for v in tot.values())
    report = {'lines': len(corpus), 'fields': {f: f'{v[0]}/{v[1]} = {100 * v[0] / v[1]:.1f}%' for f, v in tot.items() if v[1]},
              'overall': f'{allc}/{alln} = {100 * allc / alln:.1f}%', 'page_errors': errs[:5],
              'tables': f'{tok}/{len(tables)} table layouts read correctly',
              'drawings': f'{sum(1 for d in drawn if d)}/{sum(1 for d in drawn if d is not None)} supplied lines have a drawing', 'missing_drawings': nodraw}
    units += engine_checks(PAGE.read_text(encoding='utf-8'), corpus, res, tm)
    ufail = [u for u in units if not u[1]]
    report['units'] = f'{len(units) - len(ufail)}/{len(units)} engine unit checks passed'
    if ufail: report['unit_failures'] = [f'{u[0]}: {u[2]}' for u in ufail[:12]]
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if verbose or '--fails' in sys.argv:
        for f in fails: print('FAIL', f)
        for f in tfails: print('TABLE FAIL', f)
    if '--json' in sys.argv: (out / sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(res, ensure_ascii=False, indent=1))  # 상대 경로는 --out 안
    pct = lambda f: tot[f][0] / tot[f][1]
    ok = pct('type') >= .95 and pct('size') >= .95 and pct('status') >= .95 and allc / alln >= .9 and not errs and not tfails and not ufail
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
