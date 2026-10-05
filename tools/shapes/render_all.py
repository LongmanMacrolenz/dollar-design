#!/usr/bin/env python3
"""품목군 형상 이미지를 만든다 (Blender Cycles). 사이트에 올라가는 파일은 docs/media/shape/<id>-<룩>.webp.

    python tools/shapes/render_all.py --list                       등록된 품목군·빠진 품목군
    python tools/shapes/render_all.py --ids hbf,hn --preview       시험용 (320×240, 낮은 샘플) → out/shapes-preview/*.png
    python tools/shapes/render_all.py --ids hbf --preview --sheet  + 접촉 시트(contact.png)
    python tools/shapes/render_all.py --all --final                전부 최종 품질 → docs/media/shape/*.webp
    python tools/shapes/render_all.py --manifest                   docs/media/shape/를 훑어 app/src/v9_shape.js의 목록을 갱신

필요: pip install bpy==4.5.0 pillow numpy (Python 3.11). 사이트 빌드·CI와는 무관합니다 (결과 이미지만 저장소에 올립니다).
룩(마감 색)은 품목군 데이터(mats·fins)에서 looks.py가 정합니다. --looks ZW,BO 로 강제할 수도 있습니다.
"""
import argparse
import json
import pathlib
import re
import sys
import time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

CATDATA = ROOT / 'app' / 'src' / 'ea_catdata.js'
MEDIA = ROOT / 'docs' / 'media' / 'shape'
MANIFEST_JS = ROOT / 'app' / 'src' / 'v9_shape.js'


def load_catalog():
    s = CATDATA.read_text(encoding='utf-8')
    dec = json.JSONDecoder()

    def grab(name):
        i = s.index(f'const {name} =') + len(f'const {name} =')
        while s[i] in ' \n':
            i += 1
        return dec.raw_decode(s, i)[0]
    return grab('CAT_F'), grab('CAT_TILES')


def plan(args, F, REG):
    import looks as L
    import fams
    ids = list(REG) if args.all else [i for i in (args.ids or '').split(',') if i]
    for i in ids:
        if i not in F:
            sys.exit(f'카탈로그에 없는 품목군: {i}')
        if i not in REG:
            sys.exit(f'등록된 빌더가 없는 품목군: {i}')
    jobs = []
    for i in ids:
        lk = [x for x in (args.looks or '').split(',') if x] or L.family_looks(F[i], fams.LOOKS.get(i))
        if args.default_only:
            lk = lk[:1]
        jobs += [(i, k) for k in lk]
    if args.shard:
        a, n = map(int, args.shard.split('/'))
        jobs = jobs[a::n]
    return jobs


def contact_sheet(files, out, F, cols=4, cell=(320, 240)):
    from PIL import Image, ImageDraw, ImageFont
    rows = (len(files) + cols - 1) // cols
    W = Image.new('RGB', (cols * cell[0], rows * (cell[1] + 18)), (255, 255, 255))
    d = ImageDraw.Draw(W)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 12)
    except Exception:
        font = None
    for n, (p, label) in enumerate(files):
        im = Image.open(p).convert('RGB').resize(cell)
        x, y = (n % cols) * cell[0], (n // cols) * (cell[1] + 18)
        W.paste(im, (x, y + 18))
        d.text((x + 4, y + 3), label, fill=(0, 0, 0), font=font)
    W.save(out)


def write_manifest():
    """docs/media/shape/*.webp 를 훑어 v9_shape.js 의 SHAPE_IMG 블록을 갱신"""
    found = {}
    for p in sorted(MEDIA.glob('*.webp')):
        m = re.match(r'^(.+)-([A-Z]+)\.webp$', p.name)
        if m:
            found.setdefault(m.group(1), []).append(m.group(2))
    F, _ = load_catalog()
    ordered = {i: found[i] for i in F if i in found}
    # 기본 룩이 맨 앞이 되도록 looks.py 순서를 따른다
    import looks as L
    for i in ordered:
        want = L.family_looks(F[i])
        ordered[i] = [k for k in want if k in ordered[i]] + [k for k in ordered[i] if k not in want]
    body = 'const SHAPE_IMG = ' + json.dumps(ordered, ensure_ascii=False, separators=(',', ':')) + ';'
    s = MANIFEST_JS.read_text(encoding='utf-8')
    new = re.sub(r'(/\* SHAPE_IMG:BEGIN[^\n]*\*/\n).*?(\n/\* SHAPE_IMG:END \*/)', lambda m: m.group(1) + body + m.group(2), s, flags=re.S)
    if new == s and body not in s:
        sys.exit('v9_shape.js 에 SHAPE_IMG:BEGIN / END 표시가 없습니다')
    MANIFEST_JS.write_text(new, encoding='utf-8')
    print(f'목록 갱신: 품목군 {len(ordered)}종, 이미지 {sum(len(v) for v in ordered.values())}장')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--ids')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--looks')
    ap.add_argument('--default-only', action='store_true', help='룩은 기본 하나만')
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--final', action='store_true')
    ap.add_argument('--size')
    ap.add_argument('--samples', type=int)
    ap.add_argument('--out')
    ap.add_argument('--sheet', action='store_true')
    ap.add_argument('--shard', help='i/n: 작업을 n개로 나눈 i번째만')
    ap.add_argument('--list', action='store_true')
    ap.add_argument('--info', help='품목군 id: 이름·규격·재질·마감·주의사항 출력')
    ap.add_argument('--manifest', action='store_true')
    ap.add_argument('--skip-existing', action='store_true')
    ap.add_argument('--quality', type=int, default=78)
    a = ap.parse_args()

    if a.manifest:
        write_manifest()
        return
    F, _ = load_catalog()
    if a.info:
        for i in a.info.split(','):
            f = F.get(i)
            if not f:
                print(i, '없음')
                continue
            print(f'== {i}  {f["ko"]}  /  {f["en"]}   [{f.get("enStd", "")}]  계통={f["sys"]}')
            print('   재질:', ' | '.join(f.get('mats', [])) or '-')
            print('   마감:', ' | '.join(f.get('fins', [])) or '-')
            for n in f.get('notes', []):
                print('   ·', n.get('d', ''))
        return
    import fams
    REG = fams.load_all()
    if a.list:
        miss = [i for i in F if i not in REG]
        print(f'등록 {len(REG)}종 / 카탈로그 {len(F)}종 · 빠진 {len(miss)}종')
        for i in miss:
            print(f'  빠짐  {i:14s} {F[i]["ko"]}')
        return
    jobs = plan(a, F, REG)
    if not jobs:
        sys.exit('할 일이 없습니다 (--ids 또는 --all)')
    import bl
    from PIL import Image
    prev = a.preview or not a.final
    size = tuple(map(int, (a.size or ('320x240' if prev else '640x480')).split('x')))
    samples = a.samples or (24 if prev else 72)
    out = pathlib.Path(a.out) if a.out else (ROOT / 'out' / 'shapes-preview' if prev else MEDIA)
    out.mkdir(parents=True, exist_ok=True)
    built, sheet, t0 = {}, [], time.time()
    for n, (fid, look) in enumerate(jobs, 1):
        ext = 'png' if prev else 'webp'
        dest = out / f'{fid}-{look}.{ext}'
        if a.skip_existing and dest.exists():
            continue
        t1 = time.time()
        try:
            if fid not in built:
                built = {fid: REG[fid](fid)}
            model = built[fid]
            cam = getattr(model, 'cam', None) or {}
            tmp = out / f'.{fid}-{look}.png'
            bl.render(model, tmp, look=look, size=size, samples=samples, **cam)
        except Exception as e:  # 한 품목이 실패해도 나머지는 계속
            import traceback
            print(f'[{n}/{len(jobs)}] {fid}-{look} 실패: {e}', file=sys.stderr)
            traceback.print_exc()
            built = {}
            continue
        if prev:
            tmp.replace(dest)
        else:
            Image.open(tmp).convert('RGB').save(dest, 'WEBP', quality=a.quality, method=6)
            tmp.unlink()
        sheet.append((dest, f'{fid}-{look}  {F[fid]["ko"][:18]}'))
        print(f'[{n}/{len(jobs)}] {dest.name}  {time.time() - t1:.1f}s', flush=True)
    if a.sheet and sheet:
        contact_sheet(sheet, out / 'contact.png', F)
        print('접촉 시트:', out / 'contact.png')
    print(f'끝: {len(sheet)}장, {time.time() - t0:.0f}초')


if __name__ == '__main__':
    main()
