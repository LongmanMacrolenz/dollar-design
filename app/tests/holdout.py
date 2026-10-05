"""Lines NOT in corpus.json: quick generalization check (printed for manual review).
Usage: python3 holdout.py [--page fragment.html] [--out dir]   (defaults integ/page.html, integ/out; writes only <out>/test_index.html)"""
import json, sys, pathlib
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from test import wrap, EXE, PAGE, OUT
H = pathlib.Path(__file__).parent
LINES = [
 ('HEX HEAD CAP SCREW 5/16-18 X 1 GR 5 ZINC', '100'), ('Socket Set Screw, Cup Point, ASME B18.3, 1/4-20 x 1/4, Alloy Steel', '50'),
 ('Hex Cap Screw per ASME B18.2.1, 1/2-13 x 4, ASTM A354 Grade BD, plain finish', '20'), ('Hex Nut, ASME B18.2.2, 3/4-16, SAE J995 Grade 5, Steel', '40'),
 ('0.250-20 x 0.375 cone point SSS CW ASTM F880', '50000'), ('M8 x 20 DIN 912 A2', '100'), ('볼트 M12x50 SUS316', '30'), ('와셔 M10 SUS', '100'),
 ('너트 M10 SUS304', '100'), ('렌치볼트 M5x12', '200'), ('STUD BOLT 1/2-13UNC x 3-1/4 A193 B7 c/w 2 A194 2H', '24'), ('1/2 UNC x 2-1/2 HHCS GR8', '10'),
 ('M16 x 100 HEX BOLT 8.8 HDG', '20'), ('SPRING WASHER M6 ZINC', '500'), ('CAP SCREW 3/8-16 X 1 SOCKET HEAD ALLOY', '50'), ('Hex Socket Set Screw M4x5 flat point A2', '100'),
 ('1/4"-20 x 1" SHCS', '100'), ('3/4-10 x 4 1/2 STUD B7', '16'), ('JAM NUT 5/8-11 GR5 ZP', '50'), ('NYLOC NUT M8 ZP', '200'), ('THREADED ROD 3/8-16 X 36 ZINC', '10'),
 ('六角穴付ボルト M6×15 SUS304', '100'), ('M10 육각볼트 L=40 아연', '100'), ('HHCS 7/16-14 X 1-3/4 GR8 PLAIN', '20'),
]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE); pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    OUT.mkdir(parents=True, exist_ok=True); (OUT / 'test_index.html').write_text(wrap(PAGE.read_text(encoding='utf-8')), encoding='utf-8')
    pg.goto((OUT / 'test_index.html').resolve().as_uri()); pg.wait_for_function('window.__bomTest')
    res = pg.evaluate('(L) => L.map(([t, q]) => window.__bomTest.parse(t, q))', LINES); b.close()
for (t, _), r in zip(LINES, res):
    q, m = r['q'], r['m']
    print(t); print('   ', q['typeLabel'], '|', (q.get('size') or {}).get('label'), q.get('pitchLabel'), '|', q.get('tolClass'), '|', q.get('lengthLabel'), '|', (q.get('drive') or {}).get('label'), '|', q['dimStd'], '|', (q.get('mat') or {}).get('code'), '|', (q.get('fin') or {}).get('code'))
    print('   ', m['status'], m.get('pn'), m.get('price'), '|', [x['text'][:80] for x in m['reasons']], '| Q:', q['questions'])
print('errors', errs)
