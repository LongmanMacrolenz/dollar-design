"""Build useful, crawlable product profiles from the existing public catalog.

Stable URLs are maintained in product-paths.json. These are purchasing guides,
not stock offers; specifications and documents are confirmed during quotation.
"""
import html
import json
import pathlib

from build_lib import page, header, footer, site_info
from catalog import catalog, declaration, public_label, compact_description, SITE_URL

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
e = html.escape
SYSTEM = {"metric": "미터", "inch": "인치", "both": "미터·인치"}
TIERS = {"A": "주력 품목군", "B": "조건부 조달 품목", "C": "원문·도면 검토 품목"}
TITLE_NAMES = {"hn": "Hex Nut", "hh": "Heavy Hex Nut", "ihn": "Inch Hex Nut",
               "b7": "Stud Bolt B7", "b7m": "Stud Bolt B7M", "b8": "Stud Bolt B8/B8M",
               "l7": "Stud Bolt L7", "b16": "Stud Bolt B16", "scs": "Socket Head Cap Screw",
               "pw": "Plain Washer", "tr": "Threaded Rod"}
QUESTIONS = {
    "bolt": ["호칭·피치 또는 산 수와 나사 공차", "머리 형상, 전체 길이 기준과 나사부 길이", "재질 규격·강도 등급, 짝이 되는 너트·와셔"],
    "nut": ["짝이 되는 볼트의 호칭·피치 또는 산 수와 나사 공차", "일반·헤비·낮은 너트 등 형상과 맞변·높이", "너트 재질·등급과 볼트 등급의 조합"],
    "washer": ["볼트 호칭과 필요한 내경·외경·두께", "평·스프링·경사·실링 등 형상과 좌면 조건", "재질·경도와 짝이 되는 볼트·너트"],
    "stud": ["미터·인치 호칭, 피치 또는 산 수와 나사 공차", "길이 측정 기준, 나사부 길이와 양끝 형상", "스터드·너트의 재질 등급과 세트당 너트 수"],
    "pin": ["핀·키·링의 종류와 적용 도면", "축·구멍 또는 홈 치수와 끼워맞춤 요구", "재질·경도와 조립 조건"],
    "rivet": ["리벳·인서트 종류와 적용 도면", "판 두께·그립 범위, 구멍 또는 나사 치수", "본체·심재 재질과 설치 공구 조건"],
}
EXTRA_CSS = """
.product-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:32px;align-items:center;margin:24px 0 32px}
.product-hero figure{margin:0;background:#edf0f4;border-radius:12px;padding:20px;text-align:center}
.product-hero img{width:100%;max-width:576px;height:auto;display:block;margin:auto}.product-hero figcaption{font-size:12px;color:var(--ink-3);margin-top:12px}
.product-en{font-size:18px;color:var(--ink-2);margin:12px 0;overflow-wrap:anywhere}.product-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:22px}
.product-actions>a:not(.cta){padding:10px 0;font-weight:700}.product-meta{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
.product-meta span{padding:5px 10px;border:1px solid var(--hair-2);border-radius:6px;font-size:12px}.product-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,340px);gap:32px}
.product-grid>*{min-width:0}.product-grid table td{overflow-wrap:anywhere}.product-grid details{margin:18px 0;padding:16px;border:1px solid var(--hair-2);background:var(--sheet);border-radius:10px}
.product-grid summary{cursor:pointer;font-weight:700}.product-card{display:grid;grid-template-columns:80px minmax(0,1fr);align-items:center;gap:14px;min-height:120px}
.product-card img{width:80px;height:60px;object-fit:contain}.product-card small{display:block;color:var(--ink-3);margin-top:5px}.product-card b,.product-card span{display:block;overflow-wrap:anywhere}
.category-nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.product-category{scroll-margin-top:24px;margin:32px 0 52px}.product-category h2{font-size:24px}.product-count{font-size:13px;color:var(--ink-3)}
.product-search{max-width:720px;margin:24px 0}.product-search label{font-weight:700}.product-search p{font-size:13px;color:var(--ink-3)}
.product-note{color:var(--ink-2);font-size:14px}.product-intro{max-width:800px}.product-intro p{font-size:17px;color:var(--ink-2)}
.rfq-example{white-space:pre-wrap;overflow-wrap:anywhere;font-family:inherit;font-size:14px;background:#edf0f4;padding:18px;border-radius:8px}
@media(max-width:860px){.product-hero,.product-grid{grid-template-columns:minmax(0,1fr)}.product-hero{gap:20px}.product-hero figure{max-width:640px}.product-hero figure img{max-width:400px}}
"""


def document(title, description, path, body, crumbs, collection=False):
    url = SITE_URL + path
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage" if collection else "WebPage", "@id": url,
         "name": title, "description": description, "url": url, "inLanguage": "ko",
         "isPartOf": {"@id": SITE_URL + "#website"}, "publisher": {"@id": SITE_URL + "#organization"}},
        {"@type": "Organization", "@id": SITE_URL + "#organization", "name": "볼트노트",
         "alternateName": "Boltnote", "url": SITE_URL, "logo": SITE_URL + "brand/boltnote-mark.svg"},
        {"@type": "WebSite", "@id": SITE_URL + "#website", "name": "볼트노트", "url": SITE_URL},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i, "name": label, "item": SITE_URL.rstrip("/") + link}
            for i, (label, link) in enumerate(crumbs, 1)]},
    ]}
    return page(title, description, path, body, ld).replace("</style>", EXTRA_CSS + "</style>", 1)


def image_for(id, shapes):
    looks = shapes.get(id, [])
    look = next((x for x in ["PL", "SS", *looks] if x in looks and (DOCS / f"media/shape/{id}-{x}.webp").exists()), None)
    return f"/media/shape/{id}-{look}.webp" if look else None


def related_library(id, library):
    return sorted([x for x in library if id in x.get("fam", []) or id in x.get("famko", {})],
                  key=lambda x: (x["kind"] != "part", x["kind"] != "std"))


def card(id, f, paths):
    thumb = f"/media/shape/{id}-s.webp"
    img = f'<img src="{thumb}" width="240" height="180" alt="{e(f["ko"])} 참고 형상" loading="lazy" decoding="async">' if (DOCS / thumb.lstrip("/")).exists() else ""
    return (f'<a class="card product-card" href="/products/{paths[id]}" data-product data-search="{e(f["ko"] + " " + f["en"] + " " + " ".join(x[1] for x in f["std"]))}">'
            + img + f'<div><b>{e(f["ko"])}</b><span lang="en">{e(f["en"])}</span><small>{TIERS[f["p"]]} · {SYSTEM[f["sys"]]}</small></div></a>')


def product_html(id, f, families, tiles, paths, library, shapes, info):
    category = next(t for t in tiles if t["id"] == f["t"])
    related = related_library(id, library)
    intro = f.get("use") or next((x["sum"] for x in related if x["kind"] == "part"), f["notes"][0]["d"])
    name = f["ko"]
    title = f'{name} ({TITLE_NAMES.get(id, f["en"])}) 규격·견적 | 볼트노트'
    if len(title) > 70:
        title = f'{name} 규격·구매·견적 | 볼트노트'
    desc = compact_description(f'{name} 구매·견적 안내. {f["en"]}. 사양·규격과 필요한 서류를 확인하고 BOM·RFQ로 문의하세요.')
    image = image_for(id, shapes)
    visual = (f'<figure><img src="{image}" width="576" height="432" alt="{e(name)} 참고용 3D 형상" fetchpriority="high">'
              '<figcaption>참고용 렌더링 · 실제 제품 사진 아님<br>치수·재질·표면처리는 요청 사양으로 확인합니다.</figcaption></figure>') if image else ""
    notes = "".join(f'<li>{("<b>" + e(public_label(n["t"])) + "</b> ") if n.get("t") else ""}{e(public_label(n["d"]))}</li>' for n in f["notes"])
    standards = "".join(f'<tr><th scope="row">{e(org)}</th><td>{e(public_label(std))}</td></tr>' for org, std in f["std"])
    questions = QUESTIONS[f["t"]] + ["표면처리·사용 환경과 프로젝트 특수요건", "수량·단위, 필요한 날짜·납품지와 검사·추적 서류"]
    context = ("적용 원문·도면과 공급 조건을 먼저 검토하는 품목입니다." if f["p"] == "C" else
               "호칭·재질·표면처리와 공급 조건에 따라 조달 가능 여부를 확인합니다.")
    related_products = [k for k, x in families.items() if x["sg"] == f["sg"] and k != id][:6]
    options = ""
    for key, label in [("mats", "재질·강도 표기"), ("fins", "표면처리 표기")]:
        if f.get(key):
            options += f'<h3>{label}</h3><p>{e(" · ".join(public_label(v) for v in f[key]))}</p>'
    if options:
        options = '<details><summary>견적 검토 시 구분할 재질·표면처리</summary>' + options + '<p class="product-note">카탈로그의 검토 항목입니다. 모든 조합의 공급을 뜻하지 않습니다. 적용 규격·사용 조건과 공급처 회신을 함께 확인합니다.</p></details>'
    breadcrumb = [("홈", "/"), ("제품", "/products/"), (category["ko"], "/products/category/" + category["id"]), (name, "/products/" + paths[id])]
    crumbs = ' › '.join(f'<a href="{url}">{e(label)}</a>' for label, url in breadcrumb[:-1]) + " › " + e(name)
    example = f'품목: {name} / {f["en"]}\n적용 규격·판본: [BOM·도면의 표기]\n호칭·피치·길이: [원래 표기 그대로]\n재질·등급 / 표면처리: [요구 사양]\n수량·단위 / 필요 날짜·납품지: [요청 조건]\n특수요건·필요 서류 / 첨부: [BOM·RFQ·도면]'
    body = (header("products") + f'<main><div class="w"><p class="crumbs">{crumbs}</p>'
            + '<section class="product-hero"><div><p class="eyebrow">FASTENER PRODUCT GUIDE</p>'
            + f'<h1>{e(name)}</h1><p class="product-en" lang="en">{e(f["en"])}</p>'
            + f'<div class="product-meta"><span>{TIERS[f["p"]]}</span><span>{SYSTEM[f["sys"]]} 표기 확인</span></div><p class="lead">{e(public_label(intro))}</p>'
            + f'<div class="product-actions"><a class="cta" href="/#list">BOM·RFQ로 Sales 문의 →</a><a href="/#c-{id}">2D 도면·사양 선택 보기 ↗</a></div></div>{visual}</section>'
            + '<div class="product-grid"><article><h2>적용 규격·구매 시 구분할 표기</h2>'
            + '<p class="product-note">아래 규격은 같은 치수·요건을 보장하는 대체 규격 목록이 아닙니다. BOM의 규격과 판본, 도면 요구를 기준으로 대조합니다.</p>'
            + f'<table><caption class="sr">{e(name)} 카탈로그 규격 표기</caption><thead><tr><th>기관·기준</th><th>규격과 적용 범위</th></tr></thead><tbody>{standards}</tbody></table>'
            + f'<h2>구매 전에 확인할 차이</h2><ul class="f">{notes}</ul>{options}'
            + '<h2>이 품목의 RFQ에 넣을 내용</h2><p>새 양식을 작성할 필요 없이 기존 BOM·메모·요청서를 보내세요. 빠진 사양은 확인 질문으로 이어갑니다.</p>'
            + f'<pre class="rfq-example">{e(example)}</pre><a class="cta" href="/#list">이메일 주소·RFQ 예시 보기 →</a>'
            + '<p class="src">기존 공개 카탈로그의 규격 표기·안내를 정리했습니다. 개별 품목 검토일은 별도 기록되지 않았습니다. 설계·계약에는 적용 규격 원문과 고객 도면을 확인하며, 공개 치수표의 범위 밖 값은 추정하지 않습니다.</p>'
            + '</article><aside><div class="box dark"><h2>견적에서 확인하는 조건</h2>'
            + f'<p>{context}</p><p>재고·단가·납기와 제조사 서류 제공 여부는 공급처 확인 뒤 견적서에 적습니다.</p><a class="cta" href="/#list">Sales 문의 →</a></div>'
            + '<div class="box"><h2>사양 확인 질문</h2><ul class="f">' + ''.join(f'<li>{e(q)}</li>' for q in questions) + '</ul></div>'
            + ('<div class="box"><h2>관련 규격·구매 지식</h2><div class="chips">' + ''.join(f'<a class="chip" href="/lib/{x["id"]}">{e(x["t"])}</a>' for x in related[:8]) + '</div></div>' if related else '')
            + '<div class="box"><h2>구매 결정 경로</h2><p>단위 → 나사 → 재질·등급 → 코팅·환경 → 서류 순서로 확인합니다.</p><a href="/#lib?path=purchase">라이브러리에서 확인하기 →</a></div></aside></div>'
            + ('<section class="product-category"><h2>함께 비교할 품목</h2><p class="product-note">참고용 렌더링 · 실제 제품 사진 아님</p><div class="cards">' + ''.join(card(k, families[k], paths) for k in related_products) + '</div></section>' if related_products else '')
            + '</div></main>' + footer(info))
    return document(title, desc, "products/" + paths[id], body, breadcrumb)


def listing_html(families, tiles, paths, info, category=None):
    selected = [category] if category else tiles
    label = category["ko"] if category else "볼트·너트·체결부품"
    title = f'{label} 구매·규격·견적 안내 | 볼트노트'
    desc = f'{label} 제품별 규격과 구매 확인 사항. 기존 BOM·메모·RFQ로 사양·공급 조건과 서류를 문의하세요.'
    path = "products/category/" + category["id"] if category else "products/"
    sections = []
    for tile in selected:
        count = sum(f["t"] == tile["id"] for f in families.values())
        groups = []
        for sub in tile["subs"]:
            ids = [id for id in sub["f"] if families[id]["t"] == tile["id"]]
            groups.append(f'<section data-product-group><h3>{e(sub["ko"])}</h3><div class="cards">' + ''.join(card(id, families[id], paths) for id in ids) + '</div></section>')
        sections.append(f'<section class="product-category" id="{tile["id"]}" data-product-category><h2><a href="/products/category/{tile["id"]}">{e(tile["ko"])}</a> <span class="product-count">{count}개 품목</span></h2><p lang="en">{e(tile["en"])}</p>' + ''.join(groups) + '</section>')
    crumbs = [("홈", "/"), ("제품", "/products/")] + ([(category["ko"], "/" + path)] if category else [])
    body = (header("products") + '<main><div class="w"><p class="crumbs"><a href="/">홈</a> › <a href="/products/">제품 안내</a></p>'
            + f'<div class="product-intro"><p class="eyebrow">FASTENER PRODUCT DIRECTORY</p><h1>{e(label)} 구매 안내</h1><p>모양이 비슷해도 규격과 용도는 다릅니다. 품목별로 사양·도면·구매 확인 사항을 읽고, 기존 BOM·RFQ를 Sales로 보내세요.</p></div>'
            + '<div class="product-actions"><a class="cta" href="/#list">BOM·RFQ로 Sales 문의 →</a><a href="/#products">도면·사양 선택 카탈로그 ↗</a></div>'
            + '<nav class="category-nav" aria-label="제품군">' + ''.join(f'<a class="chip" href="/products/category/{t["id"]}">{e(t["ko"])}</a>' for t in tiles) + '</nav>'
            + '<p class="product-note">주력 품목군 · 조건부 조달 품목 · 원문·도면 검토 품목을 구분합니다. 품목 수는 탐색 분류이며 재고·공급 확약이 아닙니다. 실제 가능 여부와 납기는 견적 시 확인합니다.</p>'
            + '<form class="product-search" role="search" id="product-search"><label for="product-q">품목명·영문명·규격으로 찾기</label><input class="q" id="product-q" type="search" placeholder="예: 육각너트, Hex Nut, A193 B7" autocomplete="off"><p id="product-count" aria-live="polite">제품 카드를 누르면 구매 안내로 이동합니다.</p></form>'
            + '<p class="product-note">참고용 렌더링 · 실제 제품 사진 아님</p>' + ''.join(sections) + '</div></main>' + footer(info)
            + '<script>' + (ROOT / "product-index.js").read_text(encoding="utf-8") + '</script>')
    return document(title, compact_description(desc), path, body, crumbs, True)


def main():
    families, tiles, paths = catalog()
    library = json.loads((ROOT / "lib.json").read_text(encoding="utf-8"))
    shapes = declaration(ROOT.parent / "app/src/v9_shape.js", "SHAPE_IMG")
    info = site_info()
    out = DOCS / "products"
    (out / "category").mkdir(parents=True, exist_ok=True)
    for old in out.rglob("*.html"):
        old.unlink()
    for id, f in families.items():
        (out / (paths[id] + ".html")).write_text(product_html(id, f, families, tiles, paths, library, shapes, info), encoding="utf-8")
    for tile in tiles:
        (out / "category" / (tile["id"] + ".html")).write_text(listing_html(families, tiles, paths, info, tile), encoding="utf-8")
    (out / "index.html").write_text(listing_html(families, tiles, paths, info), encoding="utf-8")
    print(f"wrote {len(families)} product guides + {len(tiles)} categories + directory")


if __name__ == "__main__":
    main()
