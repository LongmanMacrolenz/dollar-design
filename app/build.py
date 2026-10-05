#!/usr/bin/env python3
"""Splice the BOM / C&D modules (src/) into the redesigned site page (drawing-sheet base).

    python3 build.py [--base base.html] [--out page.html]      build
    python3 build.py --base base.html --check                  only check that every base anchor is present once

Order of work (each step fails loudly, naming what is missing):
  1. core hooks (CORE_HOOKS below) are applied to the BASE text. Every anchor must occur exactly once in the base.
  2. three blocks are inserted before fixed base anchors:
       CSS    = src/*.css sorted                    before '/* 32 ─ 동작 줄이기'   (inside the base <style>)
       ENGINE = src/e*.js sorted, then src/c*.js    before '/* ───────── 상태 ───────── */'
       VIEW   = src/v*.js sorted, then src/t_*.js   before '/* ───────── 전역 이벤트 ───────── */'
  3. every src/*.hooks.json (sorted by file name) is applied to the spliced page, in file order.
     Each file is a JSON list of {"anchor": str, "replace": str, "count": int = 1}.
     count = how many times the anchor must occur (all are replaced); count 0 = "at least once, replace all".
  4. each block marker must occur exactly once; the output size is printed.
Sheet numbers: one constant SHEET_TOTAL (JS) generated from SHEET_TOTAL here. See INTERFACE.md.
"""
import argparse, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / 'src'

# ── 장 번호 (drawing-set numbering) ──────────────────────────────────────────
# 기존 1–7장은 번호를 그대로 둔다 (본문 곳곳의 '→ 4장', '7장 →' 참조가 유효하게).
# BOM 견적은 4장(주문제작·해외규격 견적) 뒤에 끼운 장 '4A'. 도면 세트에서 발행 뒤 장을 끼울 때 쓰는 방식.
# 하위 장(2-1 … 2-8, 3-1 …, 4A-1 견적서)은 장 수에 세지 않는다. 장 수 = 1, 2, 3, 4, 4A, 5, 6, 7 = 8.
SHEET_TOTAL = 8
SHEETS_ADD = {'bom': ('4A', 'BOM 견적'), 'quote': ('4A-1', 'BOM 견적서')}
SHEET_PARENT = {'quote': 'bom'}          # 하위 장 → 장 색인(#nav)에서 켤 장

# ── 블록 위치 (base anchors) ─────────────────────────────────────────────────
CSS_ANCHOR = '/* 32 ─ 동작 줄이기'
ENGINE_ANCHOR = '/* ───────── 상태 ───────── */'
VIEW_ANCHOR = '/* ───────── 전역 이벤트 ───────── */'

_sheets_js = ', '.join(f"{k}: [{json.dumps(n, ensure_ascii=False)}, {json.dumps(t, ensure_ascii=False)}]" for k, (n, t) in SHEETS_ADD.items())
_parent_js = ', '.join(f'{k}: {json.dumps(v)}' for k, v in SHEET_PARENT.items())

# ── 핵심 연결 (base 문자열 → 바꿀 문자열). base 트랙은 anchor를 글자 그대로 지켜야 한다 ──
CORE_HOOKS = [
    # 엔진: BOM 카탈로그 품목군(BOM_FAMS)도 형번으로 읽고, 단가·출고는 품목군의 vi()로
    ('parsePn: BOM_FAMS 형번',
     "  const f = METRIC.find(m => m.code === parts[0]);\n",
     "  const f = METRIC.find(m => m.code === parts[0]) || BOM_FAMS.find(m => m.code === parts[0]); /* BOM hook */\n"),
    ('variantInfo: 품목군 vi()',
     "function variantInfo(f, size, L, g, fin, qty = 100) {\n",
     "function variantInfo(f, size, L, g, fin, qty = 100) {\n  if (f.vi) return f.vi(size, L, g, fin, qty); /* BOM hook: BOM_FAMS 품목군 */\n"),
    # 장 번호·경로
    ('SHEETS·SHEET_TOTAL·SHEET_PARENT',
     "function normRoute(r) {\n",
     "/* BOM hook: 장 수 하나로 (머리글 · 장 머리 · setNav). 끼운 장 4A, 하위 장은 세지 않는다 */\n"
     f"const SHEET_TOTAL = {SHEET_TOTAL};\n"
     f"Object.assign(SHEETS, {{ {_sheets_js} }});\n"
     f"const SHEET_PARENT = {{ {_parent_js} }};   // 하위 장 → 장 색인에서 켤 장\n"
     "function normRoute(r) {\n"),
    ('setNav: 하위 장은 부모 장 색인',
     "  const key = r.startsWith('m-') ? 'metric' : r.startsWith('i-') ? 'inch' : r;\n",
     "  const key = r.startsWith('m-') ? 'metric' : r.startsWith('i-') ? 'inch' : SHEET_PARENT[r] || r; /* BOM hook */\n"),
    ('setNav: 하위 장 번호',
     "  let [no, nm] = SHEETS[key] || SHEETS.home;\n",
     "  let [no, nm] = SHEETS[r] || SHEETS[key] || SHEETS.home; /* BOM hook: 하위 장은 제 번호·이름 */\n"),
    ('setNav: 장 수',
     "  $('sheet-no').textContent = `${no} / 7`;\n",
     "  $('sheet-no').textContent = `${no} / ${SHEET_TOTAL}`; /* BOM hook */\n"),
    ('shd: 장 머리 장 수',
     '<span class="sheetno">장 ${no} / 7</span>',
     '<span class="sheetno">장 ${no} / ${SHEET_TOTAL}</span>'),
    ('머리글 장 칸 (첫 화면)',
     '<b id="sheet-no">1 / 7</b>',
     f'<b id="sheet-no">1 / {SHEET_TOTAL}</b>'),
    ('go(): 경로 → 화면',
     "cart: V.cart, help: V.help }[name] || V.home;",
     "cart: V.cart, help: V.help, bom: V.bom, quote: V.quote }[name] || (Object.hasOwn(SHEETS, name) && Object.hasOwn(V, name) && V[name]) || V.home; /* BOM hook */"),
    # 장 색인·홈·검색·바닥글
    # IA 개편(out_h, 2026-10-01): 옛 장 색인 #nav 8칸이 내비 4칸(제품 · 목록 견적 · 도면·규격 · 회사 소개)으로 바뀌어 '장 색인 #nav: 4A' 훅은 없앴다.
    # 4A 작업대는 '목록 견적' 아래 '목록 줄마다 보기 (엔지니어 화면)'로 연결된다 (src/v7_ia.js).
    ('홈 A 주문 길: 4칸',
     '<nav class="tb-route za-route" aria-label="주문 방법">',
     '<nav class="tb-route za-route r4" aria-label="주문 방법">'),
    ('홈 A 주문 길: BOM 견적',
     '<b>도면·사양서 보내기 <i>4장</i></b><span>주문제작·해외규격</span></a>\n',
     '<b>도면·사양서 보내기 <i>4장</i></b><span>주문제작·해외규격</span></a>\n'
     '    <a href="#bom" data-go="bom"><b>BOM 붙여넣기 견적 <i>4A장</i></b><span>엑셀 BOM을 줄마다 읽어 견적서로</span></a>\n'),
    ('홈 B: BOM 견적 들어가기',
     "zone('A', 'z-a', homeA()) + zone('B', 'z-b', zoneB())",
     "zone('A', 'z-a', homeA()) + zone('B', 'z-b', zoneB() + bomHomeEntry())"),
    ('검색 색인',
     " ['주문제작·해외규격 견적', '도면·사양서 첨부', '주문제작 견적 도면 특수 비규격', 'custom'],\n",
     " ['BOM 붙여넣기 견적', '엑셀 BOM → 줄별 해석 · 견적서 · 도면', 'bom 엑셀 붙여넣기 일괄 자재 목록 리스트 견적서 부품표 xlsx csv', 'bom'],\n"
     " ['주문제작·해외규격 견적', '도면·사양서 첨부', '주문제작 견적 도면 특수 비규격', 'custom'],\n"),
    # IA 개편: 바닥글이 사업자 정보·대금·정책 링크로 줄어 '바닥글 쇼핑' 훅은 없앴다 (4A 링크는 #list 페이지에).
]
BASE_ANCHORS = [CSS_ANCHOR, ENGINE_ANCHOR, VIEW_ANCHOR] + [a for _, a, _ in CORE_HOOKS]
MARKERS = ['BOM CSS START', 'BOM CSS END', 'BOM ENGINE START', 'BOM ENGINE END', 'BOM VIEW START', 'BOM VIEW END']


def die(msg):
    sys.exit('build.py: ' + msg)


def check_base(base, where):
    bad = [(a, base.count(a)) for a in BASE_ANCHORS if base.count(a) != 1]
    for a, n in bad:
        print(f'  anchor found {n}x (need 1) in {where}: {a!r}', file=sys.stderr)
    return not bad


def cat(paths):
    out = []
    for p in paths:
        t = p.read_text(encoding='utf-8')
        out.append(f'/* ── {p.name} ── */\n' + t + ('' if t.endswith('\n') else '\n'))
    return ''.join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--base', default=str(HERE / 'base.html'))
    ap.add_argument('--out', default=str(HERE / 'page.html'))
    ap.add_argument('--check', action='store_true', help='only check the base anchors')
    a = ap.parse_args()
    base_p = pathlib.Path(a.base)
    base = base_p.read_text(encoding='utf-8')
    if not check_base(base, base_p):
        die(f'base anchors missing or ambiguous in {base_p} (see above)')
    if a.check:
        print(f'base ok: {len(BASE_ANCHORS)} anchors found once each in {base_p}')
        return

    p = base
    # 1. core hooks on the base
    for name, anchor, repl in CORE_HOOKS:
        p = p.replace(anchor, repl, 1)
    # 2. blocks
    css = cat(sorted(SRC.glob('*.css')))
    eng = cat(sorted(SRC.glob('e*.js')) + sorted(SRC.glob('c*.js')))
    vw = cat(sorted(SRC.glob('v*.js')) + sorted(SRC.glob('t_*.js')))
    for m in MARKERS:
        for blk in (css, eng, vw):
            if m in blk:
                die(f'block marker {m!r} found inside src/ — remove it, build.py adds the markers')
    p = p.replace(CSS_ANCHOR, f'/* ==== BOM CSS START ==== */\n{css}/* ==== BOM CSS END ==== */\n\n{CSS_ANCHOR}', 1)
    p = p.replace(ENGINE_ANCHOR, f'/* ==== BOM ENGINE START ==== */\n{eng}/* ==== BOM ENGINE END ==== */\n\n{ENGINE_ANCHOR}', 1)
    p = p.replace(VIEW_ANCHOR, f'/* ==== BOM VIEW START ==== */\n{vw}/* ==== BOM VIEW END ==== */\n\n{VIEW_ANCHOR}', 1)
    # 3. module hooks
    nmod = 0
    for hf in sorted(SRC.glob('*.hooks.json')):
        try:
            hooks = json.loads(hf.read_text(encoding='utf-8'))
        except json.JSONDecodeError as e:
            die(f'{hf.name}: invalid JSON: {e}')
        if not isinstance(hooks, list):
            die(f'{hf.name}: must be a JSON list of {{"anchor","replace","count"}}')
        for i, h in enumerate(hooks):
            anchor, repl, want = h.get('anchor'), h.get('replace'), h.get('count', 1)
            if not isinstance(anchor, str) or not anchor or not isinstance(repl, str):
                die(f'{hf.name} #{i}: needs string "anchor" and "replace"')
            n = p.count(anchor)
            if n == 0:
                die(f'{hf.name} #{i}: anchor not found: {anchor[:120]!r}')
            if want and n != want:
                die(f'{hf.name} #{i}: anchor found {n}x, "count" says {want}: {anchor[:120]!r}')
            p = p.replace(anchor, repl)
            nmod += 1
    # 4. checks
    for m in MARKERS:
        if p.count(m) != 1:
            die(f'marker {m!r} occurs {p.count(m)}x (need exactly 1)')
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(p, encoding='utf-8')
    print(f'built {out} {len(p.encode())} bytes · base {base_p.name} · {len(CORE_HOOKS)} core hooks · {nmod} module hooks '
          f'· css {len(css.encode())} · engine {len(eng.encode())} · view {len(vw.encode())} bytes · SHEET_TOTAL {SHEET_TOTAL}')


if __name__ == '__main__':
    main()
