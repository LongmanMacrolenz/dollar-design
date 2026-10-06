"""site/page.html(본문 조각)을 배포용 완전한 HTML 문서로 감싼다.

사용법: python3 site/build.py [출력 경로]   (기본값: docs/index.html, Cloudflare 배포 폴더)
공통 도메인·검색 문구는 site/catalog.py에서 관리한다.
"""
import html
import json
import pathlib
import re
import sys

from catalog import catalog, SITE_URL, HOME_TITLE, HOME_DESC
from build_lib import site_info

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "page.html"

SEO_TITLE = HOME_TITLE
SEO_DESC = HOME_DESC
OG_IMAGE = "brand/boltnote-social.png"  # docs/brand/boltnote-social.png, 1280x720
OG_W, OG_H = 1280, 720


def head_meta() -> str:
    t, d = html.escape(SEO_TITLE), html.escape(SEO_DESC)
    img = SITE_URL + OG_IMAGE
    return (
        f'<meta name="description" content="{d}">\n'
        '<meta name="robots" content="index,follow">\n'
        '<link rel="icon" href="/brand/boltnote-mark.svg" type="image/svg+xml">\n'
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
        + '<script type="application/ld+json">' + json.dumps({
            "@context": "https://schema.org", "@graph": [
                {"@type": "Organization", "@id": SITE_URL + "#organization", "name": "볼트노트",
                 "alternateName": "Boltnote", "url": SITE_URL, "logo": SITE_URL + "brand/boltnote-mark.svg"},
                {"@type": "WebSite", "@id": SITE_URL + "#website", "name": "볼트노트", "url": SITE_URL,
                 "publisher": {"@id": SITE_URL + "#organization"}},
                {"@type": "WebPage", "@id": SITE_URL, "url": SITE_URL, "name": SEO_TITLE,
                 "description": SEO_DESC, "inLanguage": "ko", "isPartOf": {"@id": SITE_URL + "#website"}},
            ]}, ensure_ascii=False) + '</script>\n'
    )


def initial_home() -> str:
    """Visible product overview until the interactive homepage initializes."""
    families, tiles, paths = catalog()
    products = ["hbf", "hbp", "hn", "hh", "b7", "b8", "l7", "scs", "pw", "tr"]
    links = ''.join(f'<li><a href="/products/{paths[id]}">{html.escape(families[id]["ko"])} · {html.escape(families[id]["en"])}</a></li>' for id in products)
    categories = ' · '.join(f'<a href="/products/category/{t["id"]}">{html.escape(t["ko"])}</a>' for t in tiles)
    email = html.escape(site_info()["rfq"])
    return ('<main id="view" class="wrap" tabindex="-1"><section class="search-overview" aria-labelledby="initial-home-title">'
            '<h1 id="initial-home-title">산업설비 볼트·너트 구매와 BOM 견적</h1>'
            '<p>볼트노트는 기존 BOM·메모·RFQ를 읽고 체결부품의 사양, 공급 조건과 필요한 서류를 확인합니다. 미터·인치 볼트, 육각너트·헤비너트, ASTM 스터드와 기계 체결부품을 품목별로 살펴보세요.</p>'
            f'<p><a href="/#list">BOM·RFQ로 Sales 문의 →</a> · 견적 이메일 {email}</p>'
            f'<h2>제품별 규격·구매 안내</h2><p>{categories}</p><ul>{links}</ul>'
            '<p><a href="/products/">전체 제품 안내</a> · <a href="/lib/">체결부품 규격·구매 지식 라이브러리</a></p>'
            '<p>주력 품목군, 조건부 조달 품목, 원문·도면 검토 품목을 구분합니다. 재고·단가·납기와 서류 제공 여부는 공급처 확인 뒤 견적서에 적습니다.</p>'
            '<noscript><p>견적은 위 이메일로 기존 자료를 보내 주세요. 제품 안내와 라이브러리는 자바스크립트 없이도 읽을 수 있습니다.</p></noscript>'
            '</section></main>')


def build(out: pathlib.Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    body = SRC.read_text(encoding="utf-8")
    m = re.match(r"\s*<title>(.*?)</title>\s*", body, re.S)
    if m:
        body = body[m.end():]
    anchor = '<main id="view" class="wrap" tabindex="-1"></main>'
    if body.count(anchor) != 1:
        raise ValueError("Expected one interactive main placeholder")
    body = body.replace(anchor, initial_home(), 1)
    doc = (
        "<!doctype html>\n"
        '<html lang="ko">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f"<title>{html.escape(SEO_TITLE)}</title>\n"
        "<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}.search-overview{padding:40px 0;max-width:900px}.search-overview a{overflow-wrap:anywhere}.search-overview li{margin:10px 0}</style>\n"
        f"{head_meta()}"
        "</head>\n<body>\n"
        f"{body}\n"
        "</body>\n</html>\n"
    )
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out} ({len(doc):,} chars)")


if __name__ == "__main__":
    build(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "docs" / "index.html")
