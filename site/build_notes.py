"""엔지니어 노트: 대표(기계엔지니어)가 실무에서 읽은 사양을 글로 정리한 쪽 → docs/notes/ (대표 요청 2026-11-26).

원본은 site/notes/<slug>.md 한 파일에 글 하나다 (쓰는 법과 다음 글 목록은 site/notes/README.md).
  머리(--- 사이): title, desc(80자 이하), date(작성일), updated(수정일, 없으면 작성일), lib(근거로 삼은 규격 사전 항목 id, 쉼표로)
  본문: ## 소제목, ### 작은 제목, 빈 줄로 나눈 문단, "- " 목록, "1. " 번호 목록, **굵게**, [글](주소)
글의 수치·요건은 근거 항목(site/lib.json)에 이미 출처와 함께 있는 것만 쓴다 (app/SOURCE_RULE.md). 근거 항목은 글 끝에 링크로 붙는다.
고객·회사·공급처 이름, 재고·가격·납기 약속을 쓰지 않는다. 한국어 쪽만 만든다(영문 짝 없음).
"""
import html
import json
import pathlib
import re

from build_lib import header, footer, site_info, brand_strip, ad_slot
from build_products import document
from catalog import SITE_URL

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
SRC = ROOT / "notes"
e = html.escape
NOTE_CSS = """
.note{max-width:760px}.note h1{font-size:30px;line-height:1.35;margin:10px 0 12px}.note .byline{font-size:13.5px;color:var(--ink-3);margin:0 0 22px}
.note .byline b{color:var(--ink-2)}.note h2{font-size:21px;margin:34px 0 10px}.note h3{font-size:17px;margin:24px 0 8px}
.note p,.note li{font-size:16px;line-height:1.75;color:var(--ink-1,#1d2330)}.note ul,.note ol{padding-left:22px}.note li{margin:4px 0}
.note .lead{font-size:17px;color:var(--ink-2)}.note-basis{margin:36px 0 0;padding:16px 18px;border:1px solid var(--hair-2);border-radius:10px;background:var(--sheet)}
.note-basis h2{font-size:16px;margin:0 0 8px}.note-basis p{font-size:14px;color:var(--ink-2);margin:6px 0}
.note-cta{margin:22px 0 0;padding:16px 18px;border-radius:10px;background:#edf0f4}.note-cta p{margin:0 0 10px;font-size:15px}
.note-list{max-width:760px;margin:20px 0 0;padding:0;list-style:none}.note-list li{margin:0 0 14px}.note-list a{display:block;padding:16px 18px;border:1px solid var(--hair-2);border-radius:10px;background:var(--sheet);text-decoration:none}
.note-list b{display:block;font-size:17px;color:var(--ink-1,#1d2330)}.note-list span{display:block;font-size:14px;color:var(--ink-2);margin-top:6px}.note-list small{display:block;font-size:12.5px;color:var(--ink-3);margin-top:6px}
@media print{header,footer,.bn-strip,.note-cta,.tr-ad{display:none!important}}
"""
AUTHOR = "박세중 · 기계엔지니어"


def load():
    """site/notes/*.md → 글 목록 (작성일 최신순). README.md는 쓰는 법이라 뺀다."""
    notes = []
    for f in sorted(SRC.glob("*.md")):
        if f.name == "README.md":
            continue
        text = f.read_text(encoding="utf-8")
        m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
        assert m, f"front matter missing: {f.name}"
        meta = dict(line.split(":", 1) for line in m.group(1).splitlines() if line.strip())
        meta = {k.strip(): v.strip() for k, v in meta.items()}
        for k in ("title", "desc", "date", "lib"):
            assert meta.get(k), f"{f.name}: {k} missing"
        assert len(meta["desc"]) <= 80, f"{f.name}: desc longer than 80"
        assert re.fullmatch(r"[a-z0-9-]+", f.stem), f"slug must be lowercase ascii: {f.name}"
        meta.setdefault("updated", meta["date"])
        notes.append({"slug": f.stem, "lib": [x.strip() for x in meta["lib"].split(",") if x.strip()], "body": m.group(2), **{k: v for k, v in meta.items() if k != "lib"}})
    return sorted(notes, key=lambda n: (n["date"], n["slug"]), reverse=True)


def note_urls():
    notes = load()
    return ([SITE_URL + "notes/"] + [SITE_URL + "notes/" + n["slug"] for n in notes]) if notes else []


def inline(s):
    s = e(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{e(m.group(2))}">{m.group(1)}</a>', s)


def markdown(text):
    out, block = [], []

    def flush():
        if not block:
            return
        if all(re.match(r"- ", x) for x in block):
            out.append("<ul>" + "".join(f"<li>{inline(x[2:])}</li>" for x in block) + "</ul>")
        elif all(re.match(r"\d+\. ", x) for x in block):
            out.append("<ol>" + "".join(f"<li>{inline(re.sub(r'^[0-9]+[.] ', '', x))}</li>" for x in block) + "</ol>")
        else:
            out.append("<p>" + inline(" ".join(block)) + "</p>")
        block.clear()

    for line in text.splitlines():
        line = line.rstrip()
        if line.startswith("## ") or line.startswith("### "):
            flush()
            tag = "h3" if line.startswith("### ") else "h2"
            out.append(f"<{tag}>{inline(line.split(' ', 1)[1])}</{tag}>")
        elif not line:
            flush()
        else:
            block.append(line)
    flush()
    return "".join(out)


def note_html(n, by, info):
    title = f'{n["title"]} | 볼트노트 엔지니어 노트'
    path = "notes/" + n["slug"]
    crumbs = [("홈", "/"), ("엔지니어 노트", "/notes/"), (n["title"], "/" + path)]
    missing = [x for x in n["lib"] if x not in by]
    assert not missing, f'{n["slug"]}: unknown lib ids {missing}'
    basis = "".join(f'<a class="chip" href="/lib/{x}">{e(by[x]["t"])}</a>' for x in n["lib"])
    srcs = sorted({s for x in n["lib"] for s in by[x].get("src", [])})
    dates = f'작성 {n["date"]}' + (f' · 수정 {n["updated"]}' if n["updated"] != n["date"] else "")
    article = {"@type": "TechArticle", "@id": SITE_URL + path + "#article", "headline": n["title"], "description": n["desc"], "url": SITE_URL + path,
               "inLanguage": "ko", "datePublished": n["date"], "dateModified": n["updated"], "author": {"@id": SITE_URL + "#owner"},
               "publisher": {"@id": SITE_URL + "#organization"}, "citation": srcs}
    body = (header("notes") + f'<main><div class="w"><p class="crumbs"><a href="/">홈</a> › <a href="/notes/">엔지니어 노트</a> › {e(n["title"])}</p>'
            + f'<article class="note"><p class="eyebrow">ENGINEER NOTE</p><h1>{e(n["title"])}</h1>'
            + f'<p class="byline">글 <b>{AUTHOR}</b> · <time datetime="{n["date"]}">{dates}</time></p>'
            + markdown(n["body"])
            + '<section class="note-basis"><h2>이 글의 근거</h2>'
            + '<p>글의 수치와 요건은 아래 규격 사전 항목에 출처와 함께 정리한 것만 썼습니다. 항목마다 근거 규격과 해석 번호가 적혀 있습니다.</p>'
            + f'<div class="chips">{basis}</div>'
            + f'<p>근거 문서: {e(" · ".join(srcs))}</p>'
            + '<p>일반 안내입니다. 실제 설계·발주는 적용 코드와 사양서, 규격의 적용 판이 우선합니다.</p></section>'
            + '<div class="note-cta"><p><b>비슷한 사양이 적힌 BOM·RFQ가 있으신가요?</b> 그대로 보내 주시면 줄마다 읽고, 확인할 점은 C&amp;D 리스트로 정리해 견적과 함께 드립니다.</p><a class="cta" href="/#list">BOM·RFQ 보내기 →</a></div>'
            + '</article></div></main>' + brand_strip(info) + ad_slot("foot") + footer(info))
    return document(title, n["desc"], path, body, crumbs, extra=[article], main_entity=article["@id"]).replace("</style>", NOTE_CSS + "</style>", 1)


def index_html(notes, info):
    title = "엔지니어 노트: 볼트 사양 읽는 법 | 볼트노트"
    desc = "기계엔지니어 박세중이 RFQ·BOM에서 실제로 만난 볼팅 사양을 읽고 확인하는 법을 정리합니다."
    items = "".join(f'<li><a href="/notes/{n["slug"]}"><b>{e(n["title"])}</b><span>{e(n["desc"])}</span><small>작성 {n["date"]} · 글 {AUTHOR}</small></a></li>' for n in notes)
    body = (header("notes") + '<main><div class="w"><p class="crumbs"><a href="/">홈</a> › 엔지니어 노트</p>'
            + '<div class="product-intro"><p class="eyebrow">ENGINEER NOTES</p><h1>엔지니어 노트</h1>'
            + '<p>견적 요청에서 만난 사양 한 줄을 어떻게 읽고, 무엇을 되묻고, 견적서와 C&amp;D 리스트에 어떻게 적는지 정리합니다. 수치는 규격 사전에 출처와 함께 정리한 것만 씁니다.</p></div>'
            + f'<ul class="note-list">{items}</ul>'
            + '<div class="product-actions"><a class="cta" href="/#list">BOM·RFQ로 Sales 문의 →</a><a href="/lib/">규격 사전</a><a href="/tables/">규격표</a></div>'
            + "</div></main>" + brand_strip(info) + ad_slot("foot") + footer(info))
    return document(title, desc, "notes/", body, [("홈", "/"), ("엔지니어 노트", "/notes/")], True).replace("</style>", NOTE_CSS + "</style>", 1)


def main():
    notes = load()
    by = {x["id"]: x for x in json.loads((ROOT / "lib.json").read_text(encoding="utf-8"))}
    info = site_info()
    out = DOCS / "notes"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.html"):
        old.unlink()
    for n in notes:
        (out / (n["slug"] + ".html")).write_text(note_html(n, by, info), encoding="utf-8")
    (out / "index.html").write_text(index_html(notes, info), encoding="utf-8")
    print(f"wrote {len(notes)} engineer notes + index")


if __name__ == "__main__":
    main()
