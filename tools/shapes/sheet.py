#!/usr/bin/env python3
"""docs/media/shape 의 완성 이미지를 접촉 시트(PNG)로 묶는다 (점검용).

    python tools/shapes/sheet.py --out /tmp/sheets [--per 20] [--cols 5]
"""
import argparse
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from render_all import MEDIA, load_catalog  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='/tmp/shape-sheets')
    ap.add_argument('--per', type=int, default=20)
    ap.add_argument('--cols', type=int, default=5)
    ap.add_argument('--cell', default='288x216')
    ap.add_argument('--ids', help='이 품목군만 (쉼표)')
    a = ap.parse_args()
    from PIL import Image, ImageDraw, ImageFont
    F, _ = load_catalog()
    cw, ch = map(int, a.cell.split('x'))
    only = set((a.ids or '').split(',')) - {''}
    files = []
    for fid in F:
        if only and fid not in only:
            continue
        for p in sorted(MEDIA.glob(f'{fid}-*.webp')):
            if re.match(rf'^{re.escape(fid)}-[A-Z]+\.webp$', p.name):
                files.append((p, f'{p.stem}  {F[fid]["ko"][:14]}'))
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 12)
    except Exception:
        font = None
    for n in range(0, len(files), a.per):
        chunk = files[n:n + a.per]
        rows = (len(chunk) + a.cols - 1) // a.cols
        W = Image.new('RGB', (a.cols * cw, rows * (ch + 16)), (255, 255, 255))
        d = ImageDraw.Draw(W)
        for i, (p, label) in enumerate(chunk):
            x, y = (i % a.cols) * cw, (i // a.cols) * (ch + 16)
            W.paste(Image.open(p).convert('RGB').resize((cw, ch)), (x, y + 16))
            d.text((x + 3, y + 2), label, fill=(0, 0, 0), font=font)
        W.save(out / f'sheet{n // a.per:02d}.png')
    print(f'{len(files)}장 → {out}/sheet*.png')


if __name__ == '__main__':
    main()
