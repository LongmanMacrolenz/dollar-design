"""site/page.html(본문 조각)을 배포용 완전한 HTML 문서로 감싼다.

사용법: python3 site/build.py [출력 경로]   (기본값: docs/index.html, Cloudflare 배포 폴더)
공통 도메인·검색 문구는 site/catalog.py에서 관리한다.
"""
import html
import json
import pathlib
import re
import sys

from catalog import catalog, brand_copy, display_font_href, SITE_URL, HOME_TITLE, HOME_DESC, SOCIAL_IMAGE
from build_lib import site_info, beacon_tag

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "page.html"

SEO_TITLE = HOME_TITLE
SEO_DESC = HOME_DESC
OG_IMAGE = SOCIAL_IMAGE  # docs/brand/boltnote-social.png, 1280x720 (catalog.py)
OG_W, OG_H = 1280, 720
BOOT_BG = "#0a0e13"     # 홈의 어두운 바탕 (app/src/zzzzzzzzzz_home.css). 휴대폰 브라우저 위쪽 색으로도 쓴다
PAPER_BG = "#f4f3ef"    # 다른 화면의 밝은 바탕 (app/src/zzz_experience.css --paper)
# 첫 그림 전에 도는 작은 스크립트. (1) 저장해 둔 화면 밝기를 먼저 적용해 밝은 화면이 번쩍이지 않게 한다 (app/base.html themePref와 같은 값).
# (2) <html class="bn-boot-home">은 정적으로 붙어 있다. 홈이 아닌 화면(#list 등)으로 바로 들어오면 bn-boot-route로 바꿔 홈 개요가 잠깐 보이지 않게 한다.
#     본 스크립트가 끝까지 돌면 iaAfterNav(app/src/v7_ia.js)가 두 클래스를 지운다. 실패해서 남아 있으면 개요를 다시 보인다.
BOOT_SCRIPT = (
    "(function(){var d=document.documentElement;"
    "try{var t=JSON.parse(localStorage.getItem('bn.theme')||'null');if(t==='dark'||t==='auto')d.setAttribute('data-theme',t);}catch(e){}"
    "try{var h=location.hash.slice(1);if(h&&h!=='home'){d.classList.remove('bn-boot-home');d.classList.add('bn-boot-route');"
    "var m=document.querySelector('meta[name=\"theme-color\"]');if(m&&!d.hasAttribute('data-theme'))m.content='" + PAPER_BG + "';"
    "document.addEventListener('DOMContentLoaded',function(){if(d.classList.contains('bn-boot-route')){d.classList.remove('bn-boot-route');d.classList.add('bn-boot-home');}});}}catch(e){}"
    "})();"
)


def social_alt() -> str:
    """공유 그림의 설명. 그림에 적힌 문구(홈과 같은 문구)를 그대로 읽는다."""
    copy = brand_copy()
    return f"볼트노트 — {' '.join(copy['h1'])} {copy['stamp']} 체결부품으로 조립된 펌프 케이싱의 참고용 렌더링(개념 형상)."


def head_meta() -> str:
    t, d = html.escape(SEO_TITLE), html.escape(SEO_DESC)
    img = SITE_URL + OG_IMAGE
    return (
        f'<meta name="description" content="{d}">\n'
        '<meta name="robots" content="index,follow">\n'
        f'<meta name="theme-color" content="{BOOT_BG}">\n'
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
        f'<meta property="og:image:alt" content="{html.escape(social_alt())}">\n'
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


def boot_font() -> str:
    """첫 그림의 큰 문구에 쓰는 제목 글꼴. 문구 글자만 담아 요청하고, 그리기를 막지 않게 늦게 붙인다. 화면이 뜬 뒤에는 bnHomeFontInit이 더 넓은 글자 묶음을 받는다."""
    copy = brand_copy()
    href = html.escape(display_font_href("".join(copy["h1"]) + copy["stamp"]))
    return ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            f'<link id="bn-boot-font" rel="stylesheet" href="{href}" media="print" onload="this.media=\'all\'">\n'
            f'<noscript><link rel="stylesheet" href="{href}"></noscript>\n')


def initial_home() -> str:
    """자바스크립트가 홈을 그리기 전의 첫 그림. 조임 장면과 같은 자리에 같은 문구를 두어 바뀔 때 번쩍이거나 밀리지 않게 한다.
    검색 엔진과 자바스크립트를 끈 방문자는 이 내용을 그대로 본다 (검색 전용으로 숨긴 본문은 없다, site/SEARCH.md).
    클래스는 bn-boot-*만 쓴다: .bn-tighten·.bn-brand-copy·#h-z-a는 본 화면의 것이라 여기서 쓰면 시험이 헷갈린다. 모양은 app/src/zzzzzzzzzz_home.css."""
    families, tiles, paths = catalog()
    copy = brand_copy()
    products = ["hbf", "hbp", "hn", "hh", "b7", "b8", "l7", "scs", "pw", "tr"]
    links = ''.join(f'<li><a href="/products/{paths[id]}">{html.escape(families[id]["ko"])} · {html.escape(families[id]["en"])}</a></li>' for id in products)
    categories = ' · '.join(f'<a href="/products/category/{t["id"]}">{html.escape(t["ko"])}</a>' for t in tiles)
    email = html.escape(site_info()["rfq"])
    return ('<main id="view" class="wrap" tabindex="-1"><section class="search-overview bn-boot" aria-labelledby="initial-home-title">'
            '<div class="bn-boot-stage"><div class="bn-wrap bn-boot-copy">'
            '<p class="bn-boot-eyebrow" lang="en">BOLTNOTE <span>/</span> INDUSTRIAL FASTENERS</p>'
            f'<p class="bn-boot-line"><span>{html.escape(copy["h1"][0])}</span><span>{html.escape(copy["h1"][1])}</span></p>'
            '<h1 id="initial-home-title">산업설비 볼트·너트 구매와 BOM 견적</h1>'
            f'<p class="bn-boot-lead">{html.escape(copy["lead"])}</p>'
            '<p class="bn-boot-actions"><a class="bn-boot-btn" href="/#list">BOM·RFQ 보내기 <span aria-hidden="true">↗</span></a>'
            '<a class="bn-boot-btn ghost" href="/products/">제품 보기 <span aria-hidden="true">↗</span></a></p>'
            '</div></div><div class="bn-wrap bn-boot-more">'
            '<p>볼트노트는 기존 BOM·메모·RFQ를 읽고 체결부품의 사양, 공급 조건과 필요한 서류를 확인합니다. 미터·인치 볼트, 육각너트·헤비너트, ASTM 스터드와 기계 체결부품을 품목별로 살펴보세요.</p>'
            f'<p><a href="/#list">BOM·RFQ로 Sales 문의 →</a> · 견적 이메일 {email}</p>'
            f'<h2>제품별 규격·구매 안내</h2><p>{categories}</p><ul>{links}</ul>'
            '<p><a href="/products/">전체 제품 안내</a> · <a href="/lib/">체결부품 규격·구매 지식 라이브러리</a></p>'
            '<p>주력 품목군, 조건부 조달 품목, 원문·도면 검토 품목을 구분합니다. 재고·단가·납기와 서류 제공 여부는 공급처 확인 뒤 견적서에 적습니다.</p>'
            '<noscript><p>견적은 위 이메일로 기존 자료를 보내 주세요. 제품 안내와 라이브러리는 자바스크립트 없이도 읽을 수 있습니다.</p></noscript>'
            '</div></section></main>')


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
        '<html lang="ko" class="bn-boot-home">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f"<title>{html.escape(SEO_TITLE)}</title>\n"
        "<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style>\n"
        f"{head_meta()}"
        f"{boot_font()}"
        f"<script>{BOOT_SCRIPT}</script>\n"
        f"{beacon_tag()}"
        "</head>\n<body>\n"
        f"{body}\n"
        "</body>\n</html>\n"
    )
    out.write_text(doc, encoding="utf-8")
    print(f"wrote {out} ({len(doc):,} chars)")


if __name__ == "__main__":
    build(pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "docs" / "index.html")
