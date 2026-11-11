"""규격표: 품목별 치수표를 검색에 잡히는 정적 페이지로 만든다 → docs/tables/ (대표 요청 2026-11-10).

올리는 표는 근거 기록이 저장소에 있는 것만이다 (catalog.table_data, app/SOURCE_RULE.md):
  - T2: tools/t2/records/<id>.json 기록이 있는 표. 표마다 정해진 문구(T2_NOTE)를 붙인다.
  - 미터 핵심 품목: app/base.html의 const DIM (발행 기관 공식 미리보기 대조 등, 출처 주석과 묶여 있다).
값을 새로 넣거나 고치지 않는다. 규격서 원문의 표를 옮긴 것이 아니라 값과 규격 번호만 우리 양식으로 정리한다.
출처 사이트·회사 이름, 재고·가격·납기 문구를 쓰지 않는다. 표에 없는 호칭은 추정하지 않는다.
주소는 제품 안내와 같은 고정 경로(site/product-paths.json)를 쓴다: /tables/<slug>, 모음은 /tables/.
"""
import html
import json
import pathlib
import re

from build_lib import header, footer, site_info, brand_strip, CHECKED
from build_products import document, image_for, related_library
from catalog import catalog, declaration, public_label, compact_description, table_data, table_name, TABLE_ALIAS, T2_NOTE

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
e = html.escape
UNIT = {"mm": "mm", "in": "in (인치)"}
TABLE_CSS = """
.tbl-hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:28px;align-items:center;margin:20px 0 8px}
.tbl-hero figure{margin:0;background:#edf0f4;border-radius:12px;padding:16px;text-align:center}.tbl-hero img{width:100%;max-width:340px;height:auto;display:block;margin:auto}
.tbl-hero figcaption{font-size:12px;color:var(--ink-3);margin-top:8px}.tbl-basis{font-size:13.5px;color:var(--ink-2);margin:6px 0 10px}
.dimt{border:1px solid var(--hair-2);border-radius:10px;background:var(--sheet);max-width:100%}
.dimt table{width:auto;min-width:100%;border:0;font-variant-numeric:tabular-nums}
.dimt caption{caption-side:top;text-align:left;font-weight:700;font-size:13px;padding:10px 12px;color:var(--ink-2)}
.dimt th,.dimt td{text-align:right;white-space:nowrap;padding:8px 14px;border-width:1px 0 0 1px}.dimt tr>:first-child{border-left:0}
.dimt thead th{vertical-align:bottom;font-size:14px}.dimt thead th small{display:block;font-weight:400;font-size:11.5px;color:var(--ink-3);white-space:normal;min-width:5.5em;line-height:1.35;margin-top:2px}
.dimt tr>:first-child{position:sticky;left:0;z-index:1;text-align:left;background:#F5F7F3;font-weight:700}
.dimt tbody tr:nth-child(even) td{background:#FAFBF9}
.tbl-extra{font-size:14px;color:var(--ink-2);margin:12px 0 0}.tbl-list{margin:18px 0 0}.tbl-list .card b{font-size:15px}
.tbl-list .card span{font-size:13px}.tbl-search{max-width:720px;margin:20px 0}.tbl-search label{font-weight:700}.tbl-search p{font-size:13px;color:var(--ink-3);margin:0}
.tbl-group h3{font-size:15px;margin:20px 0 10px;color:var(--ink-2)}
@media(max-width:860px){.tbl-hero{grid-template-columns:minmax(0,1fr)}.tbl-hero figure{max-width:320px}.dimt th,.dimt td{padding:7px 10px}}
@media print{header,footer,.bn-strip,.product-actions,.tbl-hero figure,aside,.crumbs,.tbl-more{display:none!important}body{background:#fff}main{padding:0}
.product-grid{display:block}.dimt{overflow:visible!important;border:0}.dimt tr>:first-child{position:static}.dimt th,.dimt td{padding:4px 8px;font-size:11px}}
"""


def cell(value):
    """표의 한 칸. 숫자는 화면(String(v))과 같은 꼴로, 분수 호칭 같은 글자는 그대로."""
    if isinstance(value, bool) or value is None:
        raise ValueError("table cells must be numbers or text")
    if isinstance(value, float):
        text = repr(value)
        return text[:-2] if text.endswith(".0") else text
    return str(value)


def summary(t):
    return f'{t["standard"]} · {t["rows"][0][0]}–{t["rows"][-1][0]} · {len(t["rows"])}개 호칭 · {t["u"]}'


def basis_line(t):
    return (f'치수 근거 {t["standard"]} · {t["note"]}' + (f' · 범위: {t["scope"]}' if t["scope"] else "") + f' · 단위 {t["u"]}')


def table_html(id, f, t):
    head = '<th scope="col">호칭</th>' + "".join(f'<th scope="col">{e(sym)}<small>{e(label)}</small></th>' for sym, label in t["cols"])
    rows = "".join('<tr><th scope="row">' + e(str(row[0])) + "</th>" + "".join(f"<td>{e(cell(v))}</td>" for v in row[1:]) + "</tr>" for row in t["rows"])
    return (f'<p class="tbl-basis" id="basis">{e(basis_line(t))}</p>'
            f'<div class="tw dimt" tabindex="0" role="region" aria-label="{e(table_name(f))} 치수표 (옆으로 밀어 보기)"><table aria-describedby="basis" data-rows="{len(t["rows"])}">'
            f'<caption>{e(table_name(f))} 치수 · 단위 {e(t["u"])}</caption><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>')


def card(id, f, t, paths):
    return (f'<a class="card" href="/tables/{paths[id]}" data-table data-search="{e(" ".join([f["ko"], f["en"], t["standard"], f.get("enStd", "")]))}">'
            f'<b>{e(table_name(f))} 규격표</b><span>{e(summary(t))}</span></a>')


def page_html(id, f, t, families, tiles, tables, paths, library, shapes, info):
    tile = next(x for x in tiles if x["id"] == f["t"])
    name, slug = table_name(f), paths[id]
    short_std = re.split(r"[:(=]| - ", t["standard"])[0].strip()   # 제목·설명에는 규격 번호만 (판·범위 설명은 본문의 근거 줄에)
    if len(short_std) > 24:
        short_std = " ".join(short_std.split()[:2])
    title = f"{name} 규격표 ({short_std}) 치수 | 볼트노트"
    if len(title) > 70:
        title = f"{name} 규격표·치수 | 볼트노트"
    span, count = f'{t["rows"][0][0]}–{t["rows"][-1][0]}', len(t["rows"])
    desc = next(x for x in (f"{name} 규격표. {short_std} 기준 {span} {count}개 호칭의 치수를 표로 정리했습니다.",
                            f"{name} 규격표. {span} {count}개 호칭의 치수를 표로 정리했습니다.",
                            f"{name} 규격표. {count}개 호칭의 치수를 표로 정리했습니다.") if len(x) <= 80)
    breadcrumb = [("홈", "/"), ("규격표", "/tables/"), (tile["ko"], f'/tables/#{tile["id"]}'), (name, "/tables/" + slug)]
    crumbs = " › ".join(f'<a href="{url}">{e(label)}</a>' for label, url in breadcrumb[:-1]) + " › " + e(name)
    image = image_for(id, shapes)
    visual = (f'<figure><img src="{image}" width="576" height="432" alt="{e(name)} 참고용 3D 형상">'
              '<figcaption>참고용 렌더링 · 실제 제품 사진 아님</figcaption></figure>') if image else ""
    also = [k for k, v in TABLE_ALIAS.items() if v == id]
    extra = " ".join(x for x in [t["extra"]] + [f'{families[k]["ko"]}도 머리 치수는 이 표의 값을 씁니다.' for k in also] if x)
    how = ("서로 다른 제조·유통사의 공개 기술자료 3곳 이상에서 값이 정확히 일치한 칸만 실었습니다. 규격서 원문과는 아직 대조하지 않았습니다."
           if t["note"] == T2_NOTE else "규격 발행 기관의 공식 미리보기에서 확인한 값입니다.")
    limits = [how] + ([f'범위: {t["scope"]}'] if t["scope"] else []) + [
        "규격서 원문의 표가 아닙니다. 값과 규격 번호만 볼트노트 양식으로 정리했습니다.",
        "표에 없는 호칭과 칸은 추정하지 않고 싣지 않았습니다.",
        "설계·검사·계약에는 적용 규격의 최신판과 도면을 기준으로 하세요. 규격이 개정되면 값이 달라질 수 있습니다.",
        f"대조 시기 {CHECKED}."]
    related = related_library(id, library)
    sub = next((s for s in tile["subs"] if id in s["f"]), None)
    near = [k for k in (sub["f"] if sub else []) if k in tables and k != id]
    near += [k for k in tables if families[k]["t"] == f["t"] and k != id and k not in near]
    body = (header("tables") + f'<main><div class="w"><p class="crumbs">{crumbs}</p>'
            + '<section class="tbl-hero"><div><p class="eyebrow">FASTENER DIMENSION TABLE</p>'
            + f'<h1>{e(name)} 규격표</h1><p class="product-en" lang="en">{e(f["en"])}</p>'
            + f'<div class="product-meta"><span>{e(t["standard"])}</span><span>{len(t["rows"])}개 호칭 · {e(str(t["rows"][0][0]))}–{e(str(t["rows"][-1][0]))}</span><span>단위 {e(UNIT[t["u"]])}</span></div>'
            + f'<p class="lead">{e(name)}의 호칭별 치수를 한 표로 정리했습니다. 규격서 원문이 아니라, 공개 자료로 대조한 값을 볼트노트 양식으로 옮긴 참고 표입니다.</p>'
            + f'<div class="product-actions"><a class="cta" href="/#list">이 품목 견적 문의 →</a><a href="/products/{slug}">구매 안내 보기</a><a href="/#c-{id}">2D 도면·사양 선택 ↗</a></div></div>{visual}</section>'
            + '<div class="product-grid"><article><h2 id="table">치수표</h2>' + table_html(id, f, t)
            + (f'<p class="tbl-extra">{e(extra)}</p>' if extra else "")
            + (f'<h2>이 품목은</h2><p>{e(public_label(f["use"]))}</p>' if f.get("use") else "")
            + '<h2 id="basis-detail">이 표의 근거와 한계</h2><ul class="f">' + "".join(f"<li>{e(x)}</li>" for x in limits) + "</ul>"
            + '<h2>표에 없는 호칭·길이가 필요하면</h2><p>BOM이나 도면을 그대로 보내 주세요. 적용 규격과 요구 치수를 기준으로 확인한 뒤 견적합니다.</p>'
            + '<a class="cta" href="/#list">이메일 주소·RFQ 예시 보기 →</a>'
            + '</article><aside><div class="box dark"><h2>견적에서 확인하는 조건</h2>'
            + '<p>표의 치수는 참고용입니다. 재질·강도, 표면처리, 길이와 서류 조건은 요청 사양으로 확인합니다.</p><p>재고·단가·납기는 공급처 확인 뒤 견적서에 적습니다.</p><a class="cta" href="/#list">Sales 문의 →</a></div>'
            + ('<div class="box"><h2>관련 규격·구매 지식</h2><div class="chips">' + "".join(f'<a class="chip" href="/lib/{x["id"]}">{e(x["t"])}</a>' for x in related[:8]) + "</div></div>" if related else "")
            + '<div class="box"><h2>규격표 모음</h2><p>볼트·너트·와셔·핀 종류별 규격표를 한곳에서 찾습니다.</p><a href="/tables/">규격표 전체 보기 →</a></div></aside></div>'
            + ('<section class="product-category tbl-more"><h2>같은 종류의 다른 규격표</h2><div class="cards tbl-list">' + "".join(card(k, families[k], tables[k], paths) for k in near[:6]) + "</div></section>" if near else "")
            + "</div></main>" + brand_strip(info) + footer(info))
    return document(title, desc, "tables/" + slug, body, breadcrumb).replace("</style>", TABLE_CSS + "</style>", 1)


def index_html(families, tiles, tables, paths, info):
    title = "볼트·너트 규격표 모음 (치수표) | 볼트노트"
    desc = "볼트·너트·와셔·핀 규격표 모음. 종류별 호칭 치수를 공개 자료로 대조해 표로 정리했습니다."
    sections = []
    for tile in tiles:
        groups, count = [], 0
        for sub in tile["subs"]:
            ids = [k for k in sub["f"] if k in tables and families[k]["t"] == tile["id"]]
            count += len(ids)
            if ids:
                groups.append(f'<section class="tbl-group" data-table-group><h3>{e(sub["ko"])}</h3><div class="cards tbl-list">' + "".join(card(k, families[k], tables[k], paths) for k in ids) + "</div></section>")
        if groups:
            sections.append(f'<section class="product-category" id="{tile["id"]}" data-table-group><h2>{e(tile["ko"])} <span class="product-count">{count}개 규격표</span></h2>' + "".join(groups) + "</section>")
    body = (header("tables") + '<main><div class="w"><p class="crumbs"><a href="/">홈</a> › 규격표</p>'
            + '<div class="product-intro"><p class="eyebrow">FASTENER DIMENSION TABLES</p><h1>체결부품 규격표</h1>'
            + f'<p>볼트·너트·와셔·스터드·핀·리벳의 호칭별 치수를 종류마다 한 표로 정리했습니다. 지금 {len(tables)}종이 있습니다.</p></div>'
            + '<div class="product-actions"><a class="cta" href="/#list">BOM·RFQ로 Sales 문의 →</a><a href="/products/">제품 구매 안내</a><a href="/lib/">규격 사전</a></div>'
            + '<nav class="category-nav" aria-label="종류">' + "".join(f'<a class="chip" href="#{t["id"]}">{e(t["ko"])}</a>' for t in tiles if any(families[k]["t"] == t["id"] for k in tables)) + "</nav>"
            + '<p class="product-note">규격서 원문의 표가 아닙니다. 발행 기관의 공식 미리보기로 확인했거나, 서로 다른 제조·유통사의 공개 기술자료 3곳 이상에서 값이 일치한 칸만 실었습니다. '
              '표마다 근거를 적었습니다. 근거를 확인하지 못한 품목과 호칭은 싣지 않았으며, 그런 품목은 도면이나 규격 번호를 기준으로 견적합니다.</p>'
            + '<form class="tbl-search" role="search" id="table-search"><label for="table-q">품목명·영문명·규격 번호로 찾기</label>'
              '<input class="q" id="table-q" type="search" placeholder="예: 플랜지 볼트, Washer, DIN 6921" autocomplete="off"><p id="table-count" aria-live="polite">규격표를 누르면 표로 이동합니다.</p></form>'
            + "".join(sections) + "</div></main>" + brand_strip(info) + footer(info)
            + "<script>" + (ROOT / "table-index.js").read_text(encoding="utf-8") + "</script>")
    return document(title, compact_description(desc), "tables/", body, [("홈", "/"), ("규격표", "/tables/")], True).replace("</style>", TABLE_CSS + "</style>", 1)


def main():
    families, tiles, paths = catalog()
    tables = table_data()
    library = json.loads((ROOT / "lib.json").read_text(encoding="utf-8"))
    shapes = declaration(ROOT.parent / "app/src/v9_shape.js", "SHAPE_IMG")
    info = site_info()
    out = DOCS / "tables"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.html"):
        old.unlink()
    for id, t in tables.items():
        (out / (paths[id] + ".html")).write_text(page_html(id, families[id], t, families, tiles, tables, paths, library, shapes, info), encoding="utf-8")
    (out / "index.html").write_text(index_html(families, tiles, tables, paths, info), encoding="utf-8")
    print(f"wrote {len(tables)} dimension tables + index")


if __name__ == "__main__":
    main()
