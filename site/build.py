"""site/page.html(본문 조각)을 배포용 완전한 HTML 문서로 감싼다.

사용법: python3 site/build.py [출력 경로]   (기본값: docs/index.html, Cloudflare 배포 폴더)
도메인을 바꾸면 SITE_URL만 고치면 된다 (검색·링크 미리보기 주소가 함께 바뀐다).
"""
import html
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "page.html"

SITE_URL = "https://boltnote.boltnote.workers.dev/"
SEO_TITLE = "볼트노트 | 산업설비 체결부품 BOM 사양·견적"
SEO_DESC = (
    "컴프레서·블로워·펌프 등 산업기계·설비 체결부품의 BOM을 줄마다 읽어 사양 확인 사항과 견적 조건을 정리합니다. "
    "인치 ASTM·플랜트 볼팅 견적과 도면·규격 정보."
)
OG_IMAGE = "og.png"  # docs/og.png, 1280x720
OG_W, OG_H = 1280, 720


def head_meta() -> str:
    t, d = html.escape(SEO_TITLE), html.escape(SEO_DESC)
    img = SITE_URL + OG_IMAGE
    return (
        f'<meta name="description" content="{d}">\n'
        f'<link rel="canonical" href="{SITE_URL}">\n'
        '<meta property="og:type" content="website">\n'
        '<meta property="og:locale" content="ko_KR">\n'
        '<meta property="og:site_name" content="볼트노트">\n'
        f'<meta property="og:url" content="{SITE_URL}">\n'
        f'<meta property="og:title" content="{t}">\n'
        f'<meta property="og:description" content="{d}">\n'
        f'<meta property="og:image" content="{img}">\n'
        f'<meta property="og:image:width" content="{OG_W}">\n'
        f'<meta property="og:image:height" content="{OG_H}">\n'
        '<meta property="og:image:alt" content="볼트노트: 목록 보내고 견적 받기, ASME/ASTM 플랜트 볼팅, 도면·규격 정보">\n'
        '<meta name="twitter:card" content="summary_large_image">\n'
        f'<meta name="twitter:title" content="{t}">\n'
        f'<meta name="twitter:description" content="{d}">\n'
        f'<meta name="twitter:image" content="{img}">\n'
    )


def build(out: pathlib.Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    body = SRC.read_text(encoding="utf-8")
    m = re.match(r"\s*<title>(.*?)</title>\s*", body, re.S)
    if m:
        body = body[m.end():]
    doc = (
        "<!doctype html>\n"
        '<html lang="ko">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f"<title>{html.escape(SEO_TITLE)}</title>\n"
        "<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style>\n"
        f"{head_meta()}"
        "</head>\n<body>\n"
        f"{body}\n"
        "</body>\n</html>\n"
    )
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out} ({len(doc):,} chars)")


if __name__ == "__main__":
    build(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "docs" / "index.html")
