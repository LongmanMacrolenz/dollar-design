"""site/page.html(본문 조각)을 GitHub Pages용 완전한 HTML 문서로 감싼다.

사용법: python3 site/build.py [출력 경로]   (기본값: docs/index.html, GitHub Pages 배포 폴더)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "page.html"


def build(out: pathlib.Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    body = SRC.read_text(encoding="utf-8")
    m = re.match(r"\s*<title>(.*?)</title>\s*", body, re.S)
    title = m.group(1) if m else "볼트노트"
    if m:
        body = body[m.end():]
    doc = (
        "<!doctype html>\n"
        '<html lang="ko">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{title}</title>\n"
        '<meta name="description" content="KS·ISO·DIN·JIS 미터 체결부품 즉시 견적과 ASME·ASTM 플랜트 볼팅 사양 검토 주문제작.">\n'
        "</head>\n<body>\n"
        f"{body}\n"
        "</body>\n</html>\n"
    )
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out} ({len(doc):,} bytes)")


if __name__ == "__main__":
    build(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "docs" / "index.html")
