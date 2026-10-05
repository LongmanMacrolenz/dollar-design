#!/usr/bin/env python3
"""looks.py(렌더 쪽)와 app/src/v9_shape.js(사이트 쪽)의 마감·재질 → 룩 규칙이 같은지 카탈로그의 모든 재질·마감 라벨로 비교한다 (Node 필요)."""
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import looks as L  # noqa: E402
from render_all import load_catalog  # noqa: E402

JS = HERE.parent.parent / 'app' / 'src' / 'v9_shape.js'


def main():
    node = shutil.which('node')
    if not node:
        print('건너뜀: node 없음')
        return 0
    F, _ = load_catalog()
    mats = sorted({m for f in F.values() for m in f.get('mats', [])})
    fins = sorted({m for f in F.values() for m in f.get('fins', [])})
    src = JS.read_text(encoding='utf-8')
    a, b = src.index('const SHAPE_FIN_RX'), src.index('// 품목군 id + 고른')
    prog = a and (src[a:b] + f"""
const mats = {json.dumps(mats, ensure_ascii=False)}, fins = {json.dumps(fins, ensure_ascii=False)};
console.log(JSON.stringify({{ mats: mats.map(shapeLookOfMat), fins: fins.map(shapeLookOfFin) }}));""")
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(prog)
    r = subprocess.run([node, t.name], capture_output=True, text=True)
    pathlib.Path(t.name).unlink()
    if r.returncode:
        print(r.stderr)
        return 1
    js = json.loads(r.stdout)
    bad = []
    for m, k in zip(mats, js['mats']):
        if L.look_of_mat(m) != k:
            bad.append(('재질', m, L.look_of_mat(m), k))
    for m, k in zip(fins, js['fins']):
        if L.look_of_fin(m) != k:
            bad.append(('마감', m, L.look_of_fin(m), k))
    for x in bad:
        print('불일치', x)
    print(f'재질 {len(mats)}개 · 마감 {len(fins)}개 비교, 불일치 {len(bad)}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
