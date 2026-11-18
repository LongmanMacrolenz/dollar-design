"""English counterpart of the static pages → docs/en/tables/, docs/en/products/, docs/en/lib/ (대표 요청 2026-11-18, 전체 영문).

한국어 쪽(site/build_tables.py · build_products.py · build_lib.py)과 같은 데이터에서 만들고, 같은 주소 구조를 /en/ 아래에 둔다:
  /tables/<slug> ↔ /en/tables/<slug>,  /products/<slug> ↔ /en/products/<slug>,  /lib/<id> ↔ /en/lib/<id> (모음·분류 쪽 포함).
영어 문장은 손으로 쓰지 않는다. 한국어 원문을 옮긴 번역 자료가 site/en/*.json에 있고, 이 파일은 그 자료와 표·수치(값을 바꾸지 않는다)를 틀에 넣는다.
  site/en/lib.json       규격 사전 항목별 번역 (t, en_title, sum, facts, watch, eq_notes, status, table)
  site/en/products.json  제품 안내 품목별 번역 (use, notes, std, mats, fins)
  site/en/tables.json    규격표 열 이름·범위 문구 {labels: {한국어: 영어}, texts: {한국어: 영어}}
  site/en/guide.json     규격 사전 주제·읽기 경로 제목과 설명
번역 자료에 빠진 문장이 있으면 빌드가 멈춘다 (영문 쪽에 한국어가 섞여 나가지 않게). tools/check_search.py가 영문 쪽 한글 잔존도 막는다.
재고·가격·납기 약속, 후기·인증, 회사·출처 사이트 이름, 지어낸 숫자는 한국어 쪽과 마찬가지로 쓰지 않는다. 납품은 국내(한국), 견적은 원화(KRW).
"""
import html
import json
import pathlib
import re

from build_lib import page, site_info, MARK, KAKAO_MARK, CHECKED, GUIDE, STL, KIND_ORDER
from build_en import header as en_header, footer as en_footer, EN_CSS
from build_products import document, image_for, TIERS_EN, SYSTEM_EN, QUESTIONS_EN, TITLE_NAMES
from build_tables import TABLE_CSS, cell
from catalog import catalog, declaration, table_data, table_name, TABLE_ALIAS, T2_NOTE, SITE_URL, SITE_REV

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
e = html.escape
H = re.compile(r"[ㄱ-ㆎ가-힣]")
UNIT = {"mm": "mm", "in": "in (inches)"}
KIND_EN = {"std": "Standard", "grade": "Grade", "mat": "Material", "thread": "Thread", "concept": "Concept", "doc": "Document", "test": "Test", "coat": "Coating", "part": "Part"}
T1_EN = "Checked against the issuing body's official preview"
T2_EN = "Cross-checked against three or more manufacturer and distributor datasheets (not yet checked against the original standard)"


def load(name):
    return json.loads((ROOT / "en" / name).read_text(encoding="utf-8"))


LIBT, PRODT, TAB, GUIDE_EN = load("lib.json"), load("products.json"), load("tables.json"), load("guide.json")
NOTE_EN = {"발행 기관 공식 미리보기 대조": T1_EN, "제조·유통사 공개 기술자료 3곳 이상 대조 (규격서 원문 대조 전)": T2_EN}


ORG_EN = {"규격": "Standard", "기타": "Other", "나사": "Thread"}   # 제품 안내 규격 표의 기관 칸에 한국어로 적힌 분류
SRC_EN = {"해석": "interpretation", "적합성평가 관리 등에 관한 법률": "Korean Conformity Assessment Management Act",
          "제조·유통사 공개 기술자료 3곳 이상 대조 (규격서 원문 대조 전)": T2_EN}
SRC_PHRASE = {"BSEE·LBNL 해저 볼트 연구 발표(2016, ISO 15156 인용)": "BSEE·LBNL subsea bolting study presentation (2016, citing ISO 15156)",
              "ASME BPVC Section VIII Division 1 (해석 VIII-1-01-25·VIII-81-68 등)": "ASME BPVC Section VIII Division 1 (interpretations VIII-1-01-25, VIII-81-68, etc.)"}
EQ_STD_EN = {"ASTM A307 Grade C (구)": "ASTM A307 Grade C (old)", "ASTM A325 (폐지)": "ASTM A325 (withdrawn)", "ASTM A370 부록 A3": "ASTM A370 Annex A3",
             "ASTM A490 (폐지)": "ASTM A490 (withdrawn)", "ASTM F1852 (폐지)": "ASTM F1852 (withdrawn)", "ASTM F2280 (폐지)": "ASTM F2280 (withdrawn)",
             "EN 14399 계열": "EN 14399 series", "EN 1514 계열": "EN 1514 series", "ISO 898-1 · ISO 898-2 시험 조항": "ISO 898-1 · ISO 898-2 test clauses"}


def src_en(s):
    """근거 목록 한 줄. 'ASME … 해석 …'(ASME 해석 번호)처럼 한글이 섞인 것만 옮긴다."""
    if not H.search(s):
        return s
    if s in SRC_PHRASE:
        return SRC_PHRASE[s]
    out = s
    for ko, en in SRC_EN.items():
        out = out.replace(ko, en)
    if H.search(out):
        raise KeyError(f"missing source translation: {s}")
    return out


def tr_label(ko):
    if ko not in TAB["labels"]:
        raise KeyError(f"missing column label translation: {ko}")
    return TAB["labels"][ko]


def tr_text(ko):
    """규격표의 범위·추가 문구·규격 표기. 한글이 없으면 그대로 둔다."""
    if not H.search(ko):
        return ko
    if ko not in TAB["texts"]:
        raise KeyError(f"missing text translation: {ko}")
    return TAB["texts"][ko]


def lib_title(x):
    return LIBT[x["id"]].get("t", x["t"])


def lib_sub(x):
    return x.get("en") or LIBT[x["id"]]["en_title"]


CTA = '<a class="cta" href="/en/#rfq">Send a BOM or RFQ →</a>'
NOTE_REF = "Reference rendering · not a product photo"


def strip_html(info):
    """Bottom contact strip (English). Same facts as the Korean strip; no stock, price or lead-time promises."""
    kakao = (f'<a class="bn-strip-btn ghost" href="{e(info["kakaoChat"])}" target="_blank" rel="noopener noreferrer">{KAKAO_MARK}KakaoTalk <span aria-hidden="true">↗</span></a>'
             if info.get("kakaoChat") else "")
    return ('<aside class="bn-strip" aria-label="Contact Boltnote"><div class="w">'
            '<p class="bn-strip-line"><img src="/brand/boltnote-mark.svg" width="34" height="34" alt="">Boltnote · fasteners for plants in Korea</p>'
            '<p class="bn-strip-lead"><b>Send your BOM or RFQ as it is.</b> We check the specification and the supplier; quotations are in KRW for delivery within Korea.</p>'
            f'<p class="bn-strip-actions"><a class="bn-strip-btn" href="/en/#rfq">Send a BOM or RFQ <span aria-hidden="true">→</span></a>{kakao}</p>'
            '</div></aside>')


def crumbs_html(items):
    return " › ".join(f'<a href="{u}">{e(t)}</a>' if u else e(t) for t, u in items)


def finish(title, desc, path, body, crumbs, extra=None, main_entity=None, collection=False, css=""):
    return document(title, desc, path, body, crumbs, collection, extra=extra, main_entity=main_entity, lang="en").replace("</style>", css + "</style>", 1)


def compact(desc, limit=155):
    return desc if len(desc) <= limit else desc[: limit - 1].rsplit(" ", 1)[0] + "…"


# ───────── 규격표 ─────────
def table_page(id, f, t, ctx):
    families, tiles, tables, paths, library = ctx["families"], ctx["tiles"], ctx["tables"], ctx["paths"], ctx["library"]
    tile = next(x for x in tiles if x["id"] == f["t"])
    name, slug = f["en"], paths[id]
    standard = tr_text(t["standard"])
    short_std = re.split(r"[:(=]| - ", standard)[0].strip()
    if len(short_std) > 24:
        short_std = " ".join(short_std.split()[:2])
    count, span = len(t["rows"]), f'{t["rows"][0][0]}–{t["rows"][-1][0]}'
    unit = UNIT[t["u"]]
    title = f"{name} dimension table ({short_std}) | Boltnote"
    if len(title) > 70:
        title = f"{name} dimensions | Boltnote"
    desc = compact(f"{name} dimension table. {standard}: {count} nominal sizes ({span}), units {t['u']}. Reference values, not the standard text.")
    how = T2_EN if t["note"] == T2_NOTE else T1_EN
    scope = tr_text(t["scope"]) if t["scope"] else ""
    extra = tr_text(t["extra"]) if t["extra"] else ""
    also = [k for k, v in TABLE_ALIAS.items() if v == id]
    if also:
        extra = " ".join(x for x in [extra] + [f'{families[k]["en"]} uses the head dimensions of this table too.' for k in also] if x)
    facts = (f"The {name} dimension table covers {count} nominal sizes ({span}, units {t['u']}) of {standard}. "
             f"{'Only values that matched in three or more manufacturer and distributor datasheets are listed; they have not yet been checked against the original standard' if t['note'] == T2_NOTE else 'Values were checked against the issuing body’s official preview'}. Updated {SITE_REV}.")
    basis = f"Basis: {standard} · {how}" + (f" · Scope: {scope}" if scope else "") + f" · Units {t['u']}"
    head = '<th scope="col">Nominal size</th>' + "".join(f'<th scope="col">{e(sym)}<small>{e(tr_label(label))}</small></th>' for sym, label in t["cols"])
    rows = "".join('<tr><th scope="row">' + e(str(r[0])) + "</th>" + "".join(f"<td>{e(cell(v))}</td>" for v in r[1:]) + "</tr>" for r in t["rows"])
    table = (f'<p class="tbl-basis" id="basis">{e(basis)}</p><div class="tw dimt" tabindex="0" role="region" aria-label="{e(name)} dimension table (scroll sideways)">'
             f'<table aria-describedby="basis" data-rows="{count}"><caption>{e(name)} dimensions · units {e(t["u"])}</caption><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table></div>')
    limits = [how] + ([f"Scope: {scope}"] if scope else []) + [
        "This is not a table from the original standard. Only the values and the standard number are arranged in Boltnote's own format.",
        "Nominal sizes and columns that could not be confirmed are left out, not estimated.",
        "For design, inspection and contracts, use the latest edition of the applicable standard and your drawing. Values can change when a standard is revised.",
        f"Checked {CHECKED}.",
        f"To cite this table: Boltnote {name} dimension table, {SITE_URL}en/tables/{slug}, updated {SITE_REV}. Give the basis line above with it."]
    image = image_for(id, ctx["shapes"])
    visual = (f'<figure><img src="{image}" width="576" height="432" alt="{e(name)} reference 3D shape"><figcaption>{NOTE_REF}</figcaption></figure>') if image else ""
    related = [x for x in library if id in x.get("fam", []) or id in x.get("famko", {})][:8]
    sub = next((s for s in tile["subs"] if id in s["f"]), None)
    near = [k for k in (sub["f"] if sub else []) if k in tables and k != id]
    near += [k for k in tables if families[k]["t"] == f["t"] and k != id and k not in near]
    cards = "".join(f'<a class="card" href="/en/tables/{paths[k]}"><b>{e(families[k]["en"])} dimension table</b><span>{e(tr_text(tables[k]["standard"]))} · {len(tables[k]["rows"])} sizes · {e(tables[k]["u"])}</span></a>' for k in near[:6])
    crumbs = [("Home", "/en/"), ("Dimension tables", "/en/tables/"), (tile["en"], f'/en/tables/#{tile["id"]}'), (name, f"/en/tables/{slug}")]
    use = ctx["prod"].get(id, {}).get("use", "")
    body = (en_header("tables") + f'<main><div class="w"><p class="crumbs">{crumbs_html(crumbs[:-1])} › {e(name)}</p>'
            '<section class="tbl-hero"><div><p class="eyebrow">FASTENER DIMENSION TABLE</p>'
            f'<h1>{e(name)} dimension table</h1>'
            f'<div class="product-meta"><span>{e(standard)}</span><span>{count} sizes · {e(span)}</span><span>Units {e(unit)}</span></div>'
            f'<p class="lead">Nominal-size dimensions of {e(name)} in one table. Not the standard text: values cross-checked in public sources and arranged in Boltnote’s format, for reference.</p><p class="tbl-facts">{e(facts)}</p>'
            f'<div class="product-actions">{CTA}<a href="/en/products/{slug}">Buying guide</a></div></div>{visual}</section>'
            '<div class="product-grid"><article><h2 id="table">Dimensions</h2>' + table
            + (f'<p class="tbl-extra">{e(extra)}</p>' if extra else "")
            + f'<div class="tbl-quote"><p><b>Need {e(name)} to this standard?</b> Send the BOM or drawing as it is. We check against the applicable standard and then quote in KRW for delivery within Korea.</p>{CTA}</div>'
            + (f'<h2>About this item</h2><p>{e(use)}</p>' if use else "")
            + '<h2 id="basis-detail">Basis and limits of this table</h2><ul class="f">' + "".join(f"<li>{e(x)}</li>" for x in limits) + "</ul>"
            + '<h2>Sizes or lengths not in the table</h2><p>Send the BOM or drawing as it is. We check the required dimensions against the applicable standard before quoting.</p></article>'
            '<aside><div class="box dark"><h2>What we confirm in a quotation</h2><p>Dimensions in the table are for reference. Material and strength, surface treatment, length and documents are confirmed against your specification.</p>'
            f'<p>Stock, price and lead time are written into the quotation after the supplier confirms them.</p>{CTA}</div>'
            + ('<div class="box"><h2>Related standards and knowledge</h2><div class="chips">' + "".join(f'<a class="chip" href="/en/lib/{x["id"]}">{e(lib_title(x))}</a>' for x in related) + "</div></div>" if related else "")
            + '<div class="box"><h2>All dimension tables</h2><p>Bolts, nuts, washers, pins and more, one table per type.</p><a href="/en/tables/">Browse all dimension tables →</a></div></aside></div>'
            + (f'<section class="product-category tbl-more"><h2>Other tables of the same kind</h2><div class="cards tbl-list">{cards}</div></section>' if near else "")
            + "</div></main>" + strip_html(ctx["info"]) + en_footer(ctx["info"]))
    dataset = {"@type": "Dataset", "@id": SITE_URL + "en/tables/" + slug + "#dataset", "name": f"{name} dimension table",
               "description": facts, "url": SITE_URL + "en/tables/" + slug, "inLanguage": "en", "dateModified": SITE_REV, "isAccessibleForFree": True,
               "creator": {"@id": SITE_URL + "#organization"}, "publisher": {"@id": SITE_URL + "#organization"},
               "keywords": [name, standard, "dimension table", "fastener dimensions"], "measurementTechnique": how, "temporalCoverage": CHECKED,
               "variableMeasured": [{"@type": "PropertyValue", "name": f"{sym} {tr_label(label)}", "unitText": t["u"]} for sym, label in t["cols"]]}
    return finish(title, desc, f"en/tables/{slug}", body, crumbs, [dataset], dataset["@id"], css=TABLE_CSS)


def tables_index(ctx):
    families, tiles, tables, paths = ctx["families"], ctx["tiles"], ctx["tables"], ctx["paths"]
    sections = []
    for tile in tiles:
        groups, count = [], 0
        for sub in tile["subs"]:
            ids = [k for k in sub["f"] if k in tables and families[k]["t"] == tile["id"]]
            count += len(ids)
            if ids:
                groups.append(f'<section class="tbl-group"><h3>{e(sub["en"])}</h3><div class="cards tbl-list">' + "".join(
                    f'<a class="card" href="/en/tables/{paths[k]}"><b>{e(families[k]["en"])} dimension table</b><span>{e(tr_text(tables[k]["standard"]))} · {len(tables[k]["rows"])} sizes · {e(tables[k]["u"])}</span></a>' for k in ids) + "</div></section>")
        if groups:
            sections.append(f'<section class="product-category" id="{tile["id"]}"><h2>{e(tile["en"])} <span class="product-count">{count} tables</span></h2>' + "".join(groups) + "</section>")
    body = (en_header("tables") + '<main><div class="w"><p class="crumbs"><a href="/en/">Home</a> › Dimension tables</p>'
            '<div class="product-intro"><p class="eyebrow">FASTENER DIMENSION TABLES</p><h1>Fastener dimension tables</h1>'
            f'<p>Nominal-size dimensions of bolts, nuts, washers, studs, pins and rivets, one table per type. {len(tables)} tables so far.</p></div>'
            f'<div class="product-actions">{CTA}<a href="/en/products/">Product guides</a><a href="/en/lib/">Standards glossary</a></div>'
            '<nav class="category-nav" aria-label="Types">' + "".join(f'<a class="chip" href="#{t["id"]}">{e(t["en"])}</a>' for t in tiles if any(families[k]["t"] == t["id"] for k in tables)) + "</nav>"
            '<p class="product-note">These are not tables from the original standards. Each value was either checked against the issuing body’s official preview or matched in three or more manufacturer and distributor datasheets, and each table states its basis. Items and sizes without a confirmed basis are not listed; for those we quote from your drawing or standard number.</p>'
            + "".join(sections) + "</div></main>" + strip_html(ctx["info"]) + en_footer(ctx["info"]))
    return finish("Fastener dimension tables (bolts, nuts, washers, pins) | Boltnote",
                  "Dimension tables for bolts, nuts, washers, studs, pins and rivets. Nominal sizes cross-checked in public sources, basis stated per table.",
                  "en/tables/", body, [("Home", "/en/"), ("Dimension tables", "/en/tables/")], collection=True, css=TABLE_CSS)


# ───────── 제품 안내 ─────────
def product_card(id, f, paths):
    thumb = f"/media/shape/{id}-s.webp"
    img = f'<img src="{thumb}" width="240" height="180" alt="{e(f["en"])} reference shape" loading="lazy" decoding="async">' if (DOCS / thumb.lstrip("/")).exists() else ""
    return (f'<a class="card product-card" href="/en/products/{paths[id]}">' + img
            + f'<div><b>{e(f["en"])}</b><small>{TIERS_EN[f["p"]]} · {SYSTEM_EN[f["sys"]]}</small></div></a>')


def product_page(id, f, ctx):
    families, tiles, paths, library, tables = ctx["families"], ctx["tiles"], ctx["paths"], ctx["library"], ctx["tables"]
    p = PRODT[id]
    category = next(t for t in tiles if t["id"] == f["t"])
    related = [x for x in library if id in x.get("fam", []) or id in x.get("famko", {})]
    related.sort(key=lambda x: (x["kind"] != "part", x["kind"] != "std"))
    part = next((x for x in related if x["kind"] == "part"), None)
    intro = p.get("use") or (LIBT[part["id"]]["sum"] if part else p["notes"][0]["d"])
    name = f["en"]
    title = f"{name} specifications and quotation | Boltnote"
    if len(title) > 70:
        title = f"{name} | Boltnote"
    desc = compact(f"Buying guide for {name}: applicable standards, what to specify, and how to send a BOM or RFQ for a quotation in KRW (delivery within Korea).")
    image = image_for(id, ctx["shapes"])
    visual = (f'<figure><img src="{image}" width="576" height="432" alt="{e(name)} reference 3D shape" fetchpriority="high">'
              f'<figcaption>{NOTE_REF}<br>Dimensions, material and surface treatment are confirmed against your specification.</figcaption></figure>') if image else ""
    notes = "".join(f'<li>{("<b>" + e(n["t"]) + "</b> ") if n["t"] else ""}{e(n["d"])}</li>' for n in p["notes"])
    standards = "".join(f'<tr><th scope="row">{e(ORG_EN.get(org, org))}</th><td>{e(txt)}</td></tr>' for (org, _), txt in zip(f["std"], p["std"]))
    questions = QUESTIONS_EN[f["t"]] + ["Surface treatment, service environment and project-specific requirements", "Quantity and unit, required date and delivery site, inspection and traceability documents"]
    context = ("A specification-led item: we review the applicable standard text, drawing and supply conditions first." if f["p"] == "C" else
               "Whether we can source it depends on nominal size, material, surface treatment and supply conditions, which we confirm.")
    options = ""
    for key, label in [("mats", "Material and strength designations"), ("fins", "Surface treatment designations")]:
        if p.get(key):
            options += f'<h3>{label}</h3><p>{e(" · ".join(p[key]))}</p>'
    if options:
        options = ('<details><summary>Materials and surface treatments we distinguish when reviewing</summary>' + options
                   + '<p class="product-note">These are review items, not a statement that every combination is available. Confirm against the applicable standard and your service conditions.</p></details>')
    target = TABLE_ALIAS.get(id, id)
    tnote = ""
    if target in tables:
        t = tables[target]
        tname = families[target]["en"]
        lead = (f"For head dimensions, see the {e(tname)} table." if target != id else
                f'Nominal-size dimensions of {e(tr_text(t["standard"]))}: {len(t["rows"])} sizes, {e(str(t["rows"][0][0]))}–{e(str(t["rows"][-1][0]))}.')
        tnote = f'<h2>Dimension table</h2><p>{lead} <a href="/en/tables/{paths[target]}">Open the {e(tname)} dimension table →</a></p>'
    near = [k for k, x in families.items() if x["sg"] == f["sg"] and k != id][:6]
    crumbs = [("Home", "/en/"), ("Products", "/en/products/"), (category["en"], "/en/products/category/" + category["id"]), (name, "/en/products/" + paths[id])]
    example = (f"Item: {name}\nApplicable standard and edition: [as written in your BOM or drawing]\nNominal size, pitch, length: [exactly as written]\n"
               "Material and grade / surface treatment: [your requirement]\nQuantity and unit / required date and delivery site: [your request]\nDocuments: [e.g. EN 10204 3.1, CoC]")
    body = (en_header("products") + f'<main><div class="w"><p class="crumbs">{crumbs_html(crumbs[:-1])} › {e(name)}</p>'
            '<section class="product-hero"><div><p class="eyebrow">FASTENER PRODUCT GUIDE</p>'
            f'<h1>{e(name)}</h1><div class="product-meta"><span>{TIERS_EN[f["p"]]}</span><span>Check {SYSTEM_EN[f["sys"]]} designations</span></div>'
            f'<p class="lead">{e(intro)}</p><div class="product-actions">{CTA}</div></div>{visual}</section>'
            '<div class="product-grid"><article><h2>Applicable standards and designations to distinguish</h2>'
            '<p class="product-note">The standards below are not a list of interchangeable substitutes with the same dimensions and requirements. We compare against the standard and edition in your BOM and the drawing requirements.</p>'
            f'<table><caption class="sr">{e(name)} catalog standard designations</caption><thead><tr><th>Body / basis</th><th>Standard and scope</th></tr></thead><tbody>{standards}</tbody></table>'
            + tnote + f'<h2>Differences to check before buying</h2><ul class="f">{notes}</ul>{options}'
            '<h2>What to put in the RFQ for this item</h2><p>No new form is needed: send your existing BOM, notes or request. Missing specifications come back as questions.</p>'
            f'<pre class="rfq-example">{e(example)}</pre>{CTA}'
            '<p class="src">Compiled from the public catalog designations and guidance. A review date is not recorded per item. For design and contracts, check the applicable standard text and your drawing; do not estimate unconfirmed values.</p>'
            '</article><aside><div class="box dark"><h2>What we confirm in a quotation</h2>'
            f'<p>{context}</p><p>Stock, price, lead time and whether manufacturer documents are available are written into the quotation after the supplier confirms them.</p>{CTA}</div>'
            '<div class="box"><h2>Specification questions</h2><ul class="f">' + "".join(f"<li>{e(q)}</li>" for q in questions) + "</ul></div>"
            + ('<div class="box"><h2>Related standards and knowledge</h2><div class="chips">' + "".join(f'<a class="chip" href="/en/lib/{x["id"]}">{e(lib_title(x))}</a>' for x in related[:8]) + "</div></div>" if related else "")
            + '</aside></div>'
            + ('<section class="product-category"><h2>Items to compare</h2><p class="product-note">' + NOTE_REF + '</p><div class="cards">' + "".join(product_card(k, families[k], paths) for k in near) + "</div></section>" if near else "")
            + "</div></main>" + strip_html(ctx["info"]) + en_footer(ctx["info"]))
    return finish(title, desc, "en/products/" + paths[id], body, crumbs)


def listing_page(ctx, category=None):
    families, tiles, paths = ctx["families"], ctx["tiles"], ctx["paths"]
    selected = [category] if category else tiles
    label = category["en"] if category else "Bolts, nuts and fasteners"
    path = "en/products/category/" + category["id"] if category else "en/products/"
    sections = []
    for tile in selected:
        count = sum(f["t"] == tile["id"] for f in families.values())
        groups = []
        for sub in tile["subs"]:
            ids = [i for i in sub["f"] if families[i]["t"] == tile["id"]]
            groups.append(f'<section><h3>{e(sub["en"])}</h3><div class="cards">' + "".join(product_card(i, families[i], paths) for i in ids) + "</div></section>")
        sections.append(f'<section class="product-category" id="{tile["id"]}"><h2><a href="/en/products/category/{tile["id"]}">{e(tile["en"])}</a> <span class="product-count">{count} items</span></h2>' + "".join(groups) + "</section>")
    crumbs = [("Home", "/en/"), ("Products", "/en/products/")] + ([(category["en"], "/" + path)] if category else [])
    body = (en_header("products") + '<main><div class="w"><p class="crumbs"><a href="/en/">Home</a> › <a href="/en/products/">Products</a></p>'
            f'<div class="product-intro"><p class="eyebrow">FASTENER PRODUCT DIRECTORY</p><h1>{e(label)}: buying guides</h1>'
            '<p>Similar shapes can differ in standard and use. Read each item’s specification and buying checks, then send your existing BOM or RFQ.</p></div>'
            f'<div class="product-actions">{CTA}<a href="/en/tables/">Dimension tables</a></div>'
            '<nav class="category-nav" aria-label="Product groups">' + "".join(f'<a class="chip" href="/en/products/category/{t["id"]}">{e(t["en"])}</a>' for t in tiles) + "</nav>"
            '<p class="product-note">Items are grouped as core families, conditionally sourced items, and items reviewed from the standard text or drawing. Counts are a browsing aid, not a stock or supply commitment; availability and lead time are confirmed in the quotation.</p>'
            f'<p class="product-note">{NOTE_REF}</p>' + "".join(sections) + "</div></main>" + strip_html(ctx["info"]) + en_footer(ctx["info"]))
    return finish(f"{label}: buying guides, standards, quotation | Boltnote", compact(f"{label}: specifications and buying checks per item. Send your BOM, notes or RFQ in English; quoted in KRW for delivery within Korea."),
                  path, body, crumbs, collection=True)


# ───────── 규격 사전 ─────────
def official_links(x):
    links = {"ASTM": ("ASTM", "https://www.astm.org/"), "ASME": ("ASME", "https://www.asme.org/codes-standards"), "ISO": ("ISO", "https://www.iso.org/standards.html"),
             "KS": ("Korean Standards (KS)", "https://standard.go.kr/"), "JIS": ("JISC", "https://www.jisc.go.jp/"), "DIN": ("DIN", "https://www.din.de/en"),
             "SAE": ("SAE", "https://www.sae.org/standards"), "API": ("API", "https://www.api.org/products-and-services/standards")}
    picked = [f'<a href="{u}" target="_blank" rel="noopener noreferrer">{t}: official search ↗</a>' for k, (t, u) in links.items() if x.get("org") == k or any(v.startswith(k) for v in x.get("src", []))]
    return '<p class="src">' + " · ".join(picked) + '</p><p class="src">These links go to the issuing bodies; they are not the verification source of individual values.</p>'


def lib_page(x, ctx):
    by, families, paths, tables = ctx["by"], ctx["families"], ctx["paths"], ctx["tables"]
    tr = LIBT[x["id"]]
    topic = next(t for t in GUIDE["topics"] if x["id"] in t["entries"])
    ti = GUIDE["topics"].index(topic)
    topic_en = GUIDE_EN["topics"][ti]
    path = next((p for p in GUIDE["paths"] if any(x["id"] in s["entries"] for s in p["steps"])), None)
    reading = ""
    if path:
        pe = GUIDE_EN["paths"][GUIDE["paths"].index(path)]
        for i, (step, se) in enumerate(zip(path["steps"], pe["steps"]), 1):
            chips = "".join(f'<span class="chip current" aria-current="page">{e(lib_title(by[r]))}</span>' if r == x["id"] else f'<a class="chip" href="/en/lib/{r}">{e(lib_title(by[r]))}</a>' for r in step["entries"])
            reading += f'<li><span>0{i} {e(se["title"])}</span><div class="chips">{chips}</div></li>'
        reading = f'<div class="box"><h2>Read together · {e(pe["title"])}</h2><ol class="reading">{reading}</ol></div>'
    tbl = ""
    t = tr.get("table")
    if t and t.get("rows"):
        tbl = (f'<h2 id="table">{e(t.get("cap", ""))}</h2><div class="tw"><table><thead><tr>' + "".join(f"<th>{e(h)}</th>" for h in t.get("head", []))
               + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{e(str(c))}</td>" for c in r) + "</tr>" for r in t["rows"]) + "</tbody></table></div>"
               + (f'<p class="src">{e(t["note"])}</p>' if t.get("note") else ""))
    rel = [by[r] for r in x.get("rel", []) if r in by]
    fams = [k for k in x.get("famko", {})]
    tlinks = {}
    for k in fams:
        tk = TABLE_ALIAS.get(k, k)
        if tk in tables:
            tlinks["/en/tables/" + paths[tk]] = families[tk]["en"]
    status = tr.get("status", "")
    is_current = bool(x.get("status", "").startswith("현행"))
    badge = (f'<span class="org">{e("Common" if x["org"] == "-" else x["org"])}</span><span class="kind">{KIND_EN.get(x["kind"], x["kind"])}</span>'
             + (f'<span class="st">{e(status.split(" ")[0])}</span>' if status and not is_current else ""))
    title_x = lib_title(x)
    sub = lib_sub(x)
    page_title = f"{title_x} · {sub} | Boltnote standards glossary" if sub and sub != title_x else f"{title_x} | Boltnote standards glossary"
    if len(page_title) > 110:
        page_title = f"{title_x} | Boltnote standards glossary"
    crumbs = [("Home", "/en/"), ("Standards glossary", "/en/lib/"), (topic_en["title"], f'/en/lib/#topic-{topic["id"]}'), (title_x, f'/en/lib/{x["id"]}')]
    eq = x.get("eq") or []
    eqn = tr.get("eq_notes", [])
    body = (en_header("lib") + f'<main><div class="w"><p class="crumbs">{crumbs_html(crumbs[:-1])} › {e(title_x)}</p><h1>{e(title_x)}</h1>'
            f'<p class="bd">{badge}</p><p class="en" lang="en">{e(sub)}</p>'
            f'<div class="entry-tools"><a href="/en/lib/#topic-{topic["id"]}">← Back to topic</a>{CTA}</div>'
            '<nav class="toc" aria-label="On this page"><a href="#core">Key points</a>' + ('<a href="#table">Table</a>' if tbl else "") + ('<a href="#watch">Buying checks</a>' if tr.get("watch") else "") + '<a href="#source">Basis</a></nav><div class="grid"><article>'
            f'<p class="lead">{e(tr["sum"])}</p>' + (f'<p class="{STL[is_current]}">Status: {e(status)}</p>' if status else "")
            + '<h2 id="core">Key points</h2><ul class="f">' + "".join(f"<li>{e(f)}</li>" for f in tr["facts"]) + "</ul>" + tbl
            + ('<section class="watch" id="watch"><h2>Checks for BOMs and buying</h2><ul class="f">' + "".join(f"<li>{e(w)}</li>" for w in tr["watch"]) + "</ul></section>" if tr.get("watch") else "")
            + ('<h2>Equivalent and superseding standards</h2><ul class="f">' + "".join(f'<li><b>{e(EQ_STD_EN.get(q.get("std", ""), q.get("std", "")))}</b> {e(n)}</li>' for q, n in zip(eq, eqn)) + "</ul>" if eq else "")
            + official_links(x)
            + f'<p class="src" id="source">Basis: {e(" · ".join(src_en(s) for s in x.get("src", [])))} · library-wide review {CHECKED} (no per-item review date). Project edition, tolerances and service conditions must be confirmed against the standard text and supplier documents. Do not estimate unconfirmed values.</p>'
            "</article><aside>"
            f'<div class="box"><h2>Knowledge map · {e(topic_en["title"])}</h2><p>{e(topic_en["desc"])}</p><a href="/en/lib/#topic-{topic["id"]}">See the whole topic →</a></div>' + reading
            + ('<div class="box"><h2>Related entries</h2><div class="chips">' + "".join(f'<a class="chip" href="/en/lib/{r["id"]}">{e(lib_title(r))}</a>' for r in rel) + "</div></div>" if rel else "")
            + ('<div class="box"><h2>Related items</h2><div class="chips">' + "".join(f'<a class="chip" href="/en/products/{paths[k]}">{e(families[k]["en"])}</a>' for k in fams if k in paths) + "</div></div>" if fams else "")
            + ('<div class="box"><h2>Related dimension tables</h2><div class="chips">' + "".join(f'<a class="chip" href="{link}">{e(label)} dimension table</a>' for link, label in tlinks.items()) + "</div></div>" if tlinks else "")
            + '<div class="box dark"><h2>Is this standard in your BOM?</h2><p>Send it as written. We match the standard, grade and required documents line by line before quoting.</p>' + CTA + "</div>"
            "</aside></div></div></main>" + strip_html(ctx["info"]) + en_footer(ctx["info"]))
    ld = {"@context": "https://schema.org", "@type": "DefinedTerm", "name": title_x, "alternateName": [x for x in [sub] + [a for a in x.get("aka", []) if not H.search(a)][:6] if x],
          "description": tr["sum"], "url": f"{SITE_URL}en/lib/{x['id']}", "inLanguage": "en", "dateModified": SITE_REV,
          "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "Boltnote fastener standards glossary", "url": f"{SITE_URL}en/lib/"}}
    return page(page_title, tr["sum"], f'en/lib/{x["id"]}', body, ld, lang="en")


def lib_index(ctx):
    L, by = ctx["library"], ctx["by"]
    secs = []
    for topic, te in zip(GUIDE["topics"], GUIDE_EN["topics"]):
        cards = "".join(f'<a class="card" href="/en/lib/{i}"><b>{e(lib_title(by[i]))}</b><span>{e(lib_sub(by[i]))}</span></a>' for i in topic["entries"])
        secs.append(f'<section class="sec" id="topic-{topic["id"]}"><h2>{e(te["title"])} <small>{len(topic["entries"])} entries</small></h2><p>{e(te["desc"])}</p><div class="cards">{cards}</div></section>')
    topics = "".join(f'<a class="topic" href="#topic-{t["id"]}"><small>{e(t["en"])}</small><b>{e(te["title"])}</b><p>{e(te["desc"])}</p><small>{len(t["entries"])} entries →</small></a>' for t, te in zip(GUIDE["topics"], GUIDE_EN["topics"]))
    body = (en_header("lib") + '<main><div class="w"><p class="crumbs"><a href="/en/">Home</a> › Standards glossary</p>'
            '<div class="library-head"><p class="eyebrow">FASTENER KNOWLEDGE LIBRARY</p><h1>Fastener standards and knowledge glossary</h1>'
            '<p class="intro">For choosing parts, reading drawings and setting buying conditions: standards and practical knowledge, in the order you need them.</p></div>'
            '<h2>Map of fastener knowledge</h2><nav class="library-map" aria-label="Topics">' + topics + "</nav>"
            f'<p class="search-note">{len(L)} entries</p>' + "".join(secs) + "</div></main>" + strip_html(ctx["info"]) + en_footer(ctx["info"]))
    ld = {"@context": "https://schema.org", "@type": "DefinedTermSet", "name": "Boltnote fastener standards glossary", "url": f"{SITE_URL}en/lib/", "inLanguage": "en",
          "hasDefinedTerm": [{"@type": "DefinedTerm", "name": lib_title(x), "url": f"{SITE_URL}en/lib/{x['id']}"} for x in L]}
    return page("Fastener standards and knowledge glossary | Boltnote", f"{len(L)} entries on fastener standards, grades, materials and buying checks, by topic.", "en/lib/", body, ld, lang="en")


def main():
    families, tiles, paths = catalog()
    tables = table_data()
    library = json.loads((ROOT / "lib.json").read_text(encoding="utf-8"))
    shapes = declaration(ROOT.parent / "app/src/v9_shape.js", "SHAPE_IMG")
    ctx = {"families": families, "tiles": tiles, "paths": paths, "tables": tables, "library": library, "by": {x["id"]: x for x in library},
           "shapes": shapes, "info": site_info(), "prod": PRODT}
    for sub in ("tables", "products", "lib"):
        out = DOCS / "en" / sub
        out.mkdir(parents=True, exist_ok=True)
        for old in out.rglob("*.html"):
            old.unlink()
    (DOCS / "en/products/category").mkdir(parents=True, exist_ok=True)
    for id, t in tables.items():
        (DOCS / "en/tables" / (paths[id] + ".html")).write_text(table_page(id, families[id], t, ctx), encoding="utf-8")
    (DOCS / "en/tables/index.html").write_text(tables_index(ctx), encoding="utf-8")
    for id, f in families.items():
        (DOCS / "en/products" / (paths[id] + ".html")).write_text(product_page(id, f, ctx), encoding="utf-8")
    for tile in tiles:
        (DOCS / "en/products/category" / (tile["id"] + ".html")).write_text(listing_page(ctx, tile), encoding="utf-8")
    (DOCS / "en/products/index.html").write_text(listing_page(ctx), encoding="utf-8")
    for x in library:
        (DOCS / "en/lib" / (x["id"] + ".html")).write_text(lib_page(x, ctx), encoding="utf-8")
    (DOCS / "en/lib/index.html").write_text(lib_index(ctx), encoding="utf-8")
    print(f"wrote English site: {len(tables)} tables, {len(families)} product guides + {len(tiles)} categories, {len(library)} glossary entries + indexes")


if __name__ == "__main__":
    main()
