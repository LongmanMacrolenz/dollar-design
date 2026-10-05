"""체결부품 규격 사전의 정적 페이지를 만든다 (검색엔진·링크 공유용).

사용법: python3 site/build_lib.py            (site/lib.json → docs/lib/*.html, docs/sitemap.xml, docs/robots.txt)
- 주소는 확장자 없이 쓴다(/lib/<id>). Cloudflare 정적 배포가 .html 주소를 확장자 없는 주소로 307 이동시키므로, 표준 주소·사이트맵·내부 링크를 처음부터 그 주소로 둔다.
- 사이트 안의 사전(#lib)과 같은 데이터(site/lib.json)를 쓴다. 데이터는 검토를 마친 항목만 들어 있다.
- 사업자 정보(상호·대표·사업자등록번호·연락처)는 site/page.html의 SHOP·CONTACT 값을 그대로 읽어 바닥글에 넣는다.
- 규격 원문은 싣지 않는다. 항목은 사실과 값을 우리 말로 정리한 것이다.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
SITE_URL = "https://boltnote.boltnote.workers.dev/"
CHECKED = "2026-10"
KIND = {"std": "규격", "grade": "등급", "mat": "재질", "thread": "나사", "concept": "개념·설계", "doc": "서류", "test": "시험", "coat": "코팅·부식", "part": "부품 용어"}
KIND_ORDER = ["std", "grade", "mat", "thread", "concept", "doc", "test", "coat", "part"]
GUIDE = json.loads((ROOT / "lib-guide.json").read_text(encoding="utf-8"))
e = html.escape


def site_info() -> dict:
    """site/page.html에서 바닥글에 쓸 사업자 정보를 읽는다 (빈 값이면 표시하지 않음)."""
    t = (ROOT / "page.html").read_text(encoding="utf-8")
    def val(pat):
        m = re.search(pat, t)
        return m.group(1) if m else ""
    return {
        "bizNo": val(r"bizNo: '([^']*)'"), "owner": val(r"ownerName: '([^']*)'"),
        "rfq": val(r"rfq: '([^']*)'"), "tel": val(r"tel: '([^']*)'"), "kakao": val(r"kakaoName: '([^']*)'"), "kakaoChat": val(r"kakaoChat: '([^']*)'"),
        "mailOrderNo": val(r"mailOrderNo: '([^']*)'"),
    }


CSS = """
:root{--paper:#F1F3EF;--sheet:#FBFCFA;--ink:#17202A;--ink-2:#485361;--ink-3:#5C6773;--hair:#B3BDC5;--hair-2:#D8DEE1;--night:#0D141A;--line:#26343F;--tx:#EEF1EC;--tx-2:#AAB7C2;--acc:#F4E15F;--red:#B42B1B;--red-soft:#F7E3DE;--hl-soft:#FAF2BE}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Gothic A1","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;font-size:15px;line-height:1.65;-webkit-text-size-adjust:100%}
a{color:inherit}.w{max-width:1180px;margin:0 auto;padding:0 clamp(16px,2.4vw,32px)}
header{background:var(--night);color:var(--tx);border-bottom:1px solid rgba(255,255,255,.07)}
header .w{display:flex;align-items:center;gap:20px;min-height:64px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;font-size:20px;letter-spacing:-.03em}.brand svg{width:30px;height:30px;color:var(--acc)}
nav.top{display:flex;gap:4px;flex:1;flex-wrap:wrap}nav.top a{color:var(--tx-2);text-decoration:none;font-weight:600;padding:8px 12px;border-radius:8px}nav.top a:hover,nav.top a.on{color:#fff;background:rgba(255,255,255,.06)}
.cta{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:9px;background:var(--acc);color:var(--ink);font-weight:800;text-decoration:none}
main{padding:28px 0 64px}.crumbs{font-size:13px;color:var(--ink-3);margin-bottom:10px}.crumbs a{color:var(--ink-2)}
h1{margin:0;font-size:clamp(26px,3.2vw,40px);line-height:1.2;letter-spacing:-.035em}h2{font-size:17px;margin:26px 0 10px;letter-spacing:-.02em}
.bd{display:flex;flex-wrap:wrap;gap:4px;margin:12px 0 6px}.org,.kind,.st{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:5px;font-size:11.5px;font-weight:800}.org{background:var(--ink);color:var(--sheet)}.kind{border:1px solid var(--hair);color:var(--ink-2)}.st{background:var(--red-soft);color:var(--red)}
.ko{font-size:17px;font-weight:800;color:var(--ink-2);margin:0}.en{font-size:13.5px;color:var(--ink-3);margin:4px 0 0}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,300px);gap:28px 40px;align-items:start;margin-top:18px}
.lead{font-size:17px;line-height:1.75;margin:0}.stl{color:var(--red);font-size:14px}.stl.ok{color:var(--ink-2)}
ul.f{margin:0;padding:0;list-style:none;display:grid;gap:8px}ul.f li{position:relative;padding-left:18px}ul.f li:before{content:"";position:absolute;left:2px;top:.72em;width:7px;height:7px;border-radius:2px;background:var(--ink-3)}
.watch{margin-top:24px;padding:4px 18px 14px;border-left:4px solid var(--acc);border-radius:0 12px 12px 0;background:var(--hl-soft)}
table{border-collapse:collapse;width:100%;background:var(--sheet);font-size:14px}th,td{border:1px solid var(--hair-2);padding:7px 10px;text-align:left;vertical-align:top}th{background:#F5F7F3}.tw{overflow-x:auto}
.box{padding:4px 18px 16px;border:1px solid var(--hair-2);border-radius:12px;background:var(--sheet);margin-bottom:14px}.box h2{font-size:15px;margin:14px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{display:inline-flex;align-items:center;min-height:32px;padding:0 12px;border:1px solid var(--hair);border-radius:8px;background:var(--sheet);font-weight:700;font-size:13.5px;text-decoration:none}
.dark{background:var(--night);border-color:var(--night);color:var(--tx)}.dark h2{color:#fff}.dark p{color:var(--tx-2);font-size:14px}
.src{font-size:12.5px;color:var(--ink-3);margin-top:24px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:12px}.card{display:flex;flex-direction:column;gap:4px;padding:15px 17px;border:1px solid var(--hair-2);border-radius:12px;background:var(--sheet);text-decoration:none}.card b{font-size:16px}.card span{font-size:13.5px;color:var(--ink-2)}
.q{width:100%;min-height:52px;padding:0 16px;border:1.5px solid var(--hair);border-radius:12px;font-size:16px;margin:16px 0 8px;background:var(--sheet)}
.sec{margin-top:28px}.sec>h2{display:flex;gap:8px;align-items:baseline}.sec>h2 small{font-size:12.5px;color:var(--ink-3);font-weight:600}
footer{background:var(--night);color:var(--tx-2);font-size:13px;padding:36px 0}footer b{color:var(--tx)}footer .r{display:flex;flex-wrap:wrap;gap:4px 16px;padding:10px 0;border-top:1px solid var(--line)}footer a{color:var(--tx-2)}
:root{--paper:#F5F7FA;--sheet:#fff;--acc:#FF6B35;--hl-soft:#FFF1E9}
[hidden]{display:none!important}.w{max-width:1280px}html{scroll-padding-top:20px}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.cta{color:#131C29}.library-head{max-width:760px}.eyebrow{font-size:11px;letter-spacing:.08em;color:var(--ink-3);font-weight:700}.intro{margin:14px 0 24px;color:var(--ink-2)}
.library-paths,.library-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 32px}.path,.topic{padding:22px 20px;border-radius:10px;text-decoration:none;display:flex;flex-direction:column;gap:8px}.path{background:var(--night);color:#fff}.path span{color:var(--tx-2);font-size:12px}.path b,.topic b{font-size:17px}.path p,.topic p{font-size:13px;margin:0}.topic{border:1px solid var(--hair-2);background:var(--sheet)}.topic small{font-size:11px;color:var(--ink-3)}.topic p{color:var(--ink-2)}
.library-search{padding:22px 24px;border:1px solid var(--hair-2);background:var(--sheet);border-radius:10px;margin-bottom:32px}.library-search label{font-size:14px;font-weight:700}.q{margin:10px 0}.search-note{font-size:12px;color:var(--ink-3);margin:0}.no-results{border:1px solid var(--hair-2);padding:24px;background:var(--sheet);border-radius:10px}.no-results button{padding:12px 16px;cursor:pointer}
.toc,.entry-tools{display:flex;flex-wrap:wrap;gap:8px 24px;margin:20px 0}.toc a,.entry-tools a{font-size:13px;padding:8px 0}.toc{border-bottom:1px solid var(--hair-2)}.reading{list-style:none;padding:0;margin:0}.reading li{margin:16px 0}.reading li>span{display:block;font-size:12px;font-weight:700;margin-bottom:8px}.chip{min-height:40px;max-width:100%;overflow-wrap:anywhere}.chip.current{background:var(--ink);color:var(--sheet)}.sec>p{color:var(--ink-2);font-size:14px}.cards .card{min-width:0;overflow-wrap:anywhere}
@media(max-width:960px){.library-paths,.library-map{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.library-paths{grid-template-columns:minmax(0,1fr)}.topic{padding:18px 14px}.topic b{font-size:15px}.library-search{padding:18px}.brand{font-size:18px}nav.top a{padding:10px 8px}}
@media (max-width:860px){.grid{grid-template-columns:minmax(0,1fr)}nav.top{order:3;flex-basis:100%}}
"""
MARK = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5.5 32.6 12.75v14.5L20 34.5 7.4 27.25v-14.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="20" cy="20" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700;800&display=swap" rel="stylesheet">'


def page(title: str, desc: str, path: str, body: str, ld: dict | None = None) -> str:
    url = SITE_URL + path
    return (
        '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{e(title)}</title>\n<meta name=\"description\" content=\"{e(desc)}\">\n<link rel=\"canonical\" href=\"{url}\">\n"
        f'<meta property="og:type" content="article"><meta property="og:site_name" content="볼트노트"><meta property="og:locale" content="ko_KR">'
        f'<meta property="og:url" content="{url}"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">'
        f'<meta property="og:image" content="{SITE_URL}og.png"><meta name="twitter:card" content="summary_large_image">\n'
        + (f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n' if ld else "")
        + f"{FONTS}\n<style>{CSS}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n"
    )


ON = ' class="on" aria-current="page"'
STL = {True: "stl ok", False: "stl"}   # 현행은 회색, 폐지·대체는 붉은색


def header(on: str = "lib") -> str:
    nav = [("/#products", "제품", ""), ("/#list", "목록 견적", ""), ("/lib/", "규격 사전", "lib"), ("/#about", "회사 소개", "")]
    return ('<header><div class="w"><a class="brand" href="/">' + MARK + '볼트노트</a><nav class="top" aria-label="주 메뉴">'
            + "".join(f'<a href="{h}"{ON if k == on else ""}>{t}</a>' for h, t, k in nav)
            + '</nav><a class="cta" href="/#list">목록 견적 →</a></div></header>')


def footer(info: dict) -> str:
    r1 = ["<b>볼트노트 · 체결부품 견적·공급</b>", "상호 볼트노트"]
    if info["owner"]: r1.append(f"대표 {e(info['owner'])}")
    if info["bizNo"]: r1.append(f"사업자등록번호 {e(info['bizNo'])}")
    r1.append(f"통신판매업 {e(info['mailOrderNo'])}" if info["mailOrderNo"] else "통신판매업 신고 전 (검증 운영 중)")
    r2 = []
    if info["tel"]: r2.append(f'전화 <a href="tel:{re.sub(r"[^0-9]", "", info["tel"])}">{e(info["tel"])}</a> (평일 19~21시)')
    if info["rfq"]: r2.append(f'견적 메일 <a href="mailto:{e(info["rfq"])}">{e(info["rfq"])}</a>')
    if info["kakaoChat"]: r2.append(f'카카오톡 <a href="{e(info["kakaoChat"])}">{e(info["kakao"] or "볼트노트")} 채널</a>')
    elif info["kakao"]: r2.append(f"카카오톡 {e(info['kakao'])} (채널 공개 준비 중)")
    r2.append("호스팅 Cloudflare, Inc. (미국)")
    r3 = ['<a href="/#privacy"><b>개인정보 처리방침</b></a>', '<a href="/#terms">이용약관</a>', '<a href="/#about">회사 소개</a>']
    return ('<footer><div class="w">' + "".join(f'<div class="r">{" ".join(f"<span>{x}</span>" for x in row)}</div>' for row in (r1, r2, r3))
            + f'<div class="r"><span>규격 사전은 발행 기관 공개 자료·공식 미리보기·공공 문서와, 일부 값은 제조·유통사 공개 기술자료 3곳 이상을 대조해 요점을 정리한 것입니다 (확인 {CHECKED}). 계약·설계에는 규격 원문을 확인하세요.</span></div></div></footer>')


def badges(x: dict) -> str:
    st = x.get("status", "")
    return (f'<span class="org">{e("공통" if x["org"] == "-" else x["org"])}</span><span class="kind">{e(KIND.get(x["kind"], x["kind"]))}</span>'
            + (f'<span class="st">{e(st.split(" ")[0])}</span>' if st and not st.startswith("현행") else ""))


def entry_html(x: dict, by: dict, info: dict) -> str:
    topic = next(t for t in GUIDE["topics"] if x["id"] in t["entries"])
    path = next((p for p in GUIDE["paths"] if any(x["id"] in s["entries"] for s in p["steps"])), None)
    reading = ""
    if path:
        for i, step in enumerate(path["steps"], 1):
            chips = "".join(f'<span class="chip current" aria-current="page">{e(by[r]["t"])}</span>' if r == x["id"]
                            else f'<a class="chip" href="/lib/{r}">{e(by[r]["t"])}</a>' for r in step["entries"])
            reading += f'<li><span>0{i} {e(step["title"])}</span><div class="chips">{chips}</div></li>'
        reading = (f'<div class="box"><h2>함께 읽기 · {e(path["title"])}</h2><ol class="reading">{reading}</ol>'
                   f'<a href="/#lib?path={path["id"]}">읽기 경로 전체 보기 →</a></div>')
    tbl = ""
    t = x.get("table")
    if t and t.get("rows"):
        tbl = (f'<h2 id="table">{e(t.get("cap", ""))}</h2><div class="tw"><table><thead><tr>' + "".join(f"<th>{e(h)}</th>" for h in t.get("head", []))
               + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{e(str(c))}</td>" for c in r) + "</tr>" for r in t["rows"]) + "</tbody></table></div>"
               + (f'<p class="src">{e(t["note"])}</p>' if t.get("note") else ""))
    rel = [by[r] for r in x.get("rel", []) if r in by]
    fams = x.get("famko", {})
    body = (header() + '<main><div class="w">'
            + f'<p class="crumbs"><a href="/">홈</a> › <a href="/lib/">규격 사전</a> › <a href="/lib/#topic-{topic["id"]}">{e(topic["title"])}</a> › {e(x["t"])}</p><h1>{e(x["t"])}</h1>'
            + f'<p class="bd">{badges(x)}</p><p class="ko">{e(x.get("ko", ""))}</p>' + (f'<p class="en" lang="en">{e(x["en"])}</p>' if x.get("en") else "")
            + f'<div class="entry-tools"><a href="/#lib-{x["id"]}">사이트에서 이 항목 보기 ↗</a><a href="/lib/#topic-{topic["id"]}">← 주제 목록으로</a></div>'
            + '<nav class="toc" aria-label="항목 안에서 이동"><a href="#core">핵심</a>'
            + ('<a href="#table">표·조건</a>' if tbl else '') + ('<a href="#watch">구매 시 주의</a>' if x.get("watch") else '')
            + '<a href="#source">근거</a></nav><div class="grid"><article>'
            + f'<p class="lead">{e(x.get("sum", ""))}</p>' + (f'<p class="{STL[x["status"].startswith("현행")]}">상태: {e(x["status"])}</p>' if x.get("status") else "")
            + '<h2 id="core">핵심</h2><ul class="f">' + "".join(f"<li>{e(f)}</li>" for f in x.get("facts", [])) + "</ul>" + tbl
            + ('<section class="watch" id="watch"><h2>BOM·구매 때 주의</h2><ul class="f">' + "".join(f"<li>{e(w)}</li>" for w in x["watch"]) + "</ul></section>" if x.get("watch") else "")
            + ('<h2>대응·대체 규격</h2><ul class="f">' + "".join(f'<li><b>{e(q.get("std", ""))}</b> {e(q.get("note", ""))}</li>' for q in x["eq"]) + "</ul>" if x.get("eq") else "")
            + f'<p class="src" id="source">근거: {e(" · ".join(x.get("src", [])))} · 확인 {CHECKED}. 규격 원문을 옮긴 것이 아니라 요점을 정리한 것입니다.</p>'
            + "</article><aside>"
            + f'<div class="box"><h2>지식 지도 · {e(topic["title"])}</h2><p>{e(topic["desc"])}</p><a href="/lib/#topic-{topic["id"]}">이 주제 전체 보기 →</a></div>' + reading
            + ('<div class="box"><h2>관련 항목</h2><div class="chips">' + "".join(f'<a class="chip" href="/lib/{r["id"]}">{e(r["t"])}</a>' for r in rel) + "</div></div>" if rel else "")
            + ('<div class="box"><h2>관련 품목</h2><div class="chips">' + "".join(f'<a class="chip" href="/#c-{e(k)}">{e(v)}</a>' for k, v in fams.items()) + "</div></div>" if fams else "")
            + '<div class="box dark"><h2>이 규격이 들어간 BOM이 있으신가요?</h2><p>표기 그대로 보내 주시면 줄마다 규격·등급과 필요한 서류를 맞춰 견적합니다.</p><a class="cta" href="/#list">목록 견적으로 →</a></div>'
            + "</aside></div></div></main>" + footer(info))
    ld = {"@context": "https://schema.org", "@type": "DefinedTerm", "name": x["t"], "alternateName": [x.get("ko", "")] + x.get("aka", [])[:6],
          "description": x.get("sum", ""), "url": f"{SITE_URL}lib/{x['id']}",
          "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "볼트노트 체결부품 규격 사전", "url": f"{SITE_URL}lib/"}}
    return page(f'{x["t"]} · {x.get("ko", "")} | 볼트노트 규격 사전', x.get("sum", ""), f'lib/{x["id"]}', body, ld)


def index_html(L: list, info: dict) -> str:
    by = {x["id"]: x for x in L}
    secs = []
    for topic in GUIDE["topics"]:
        cards = []
        for id in topic["entries"]:
            x = by[id]
            search = " ".join([x["t"], x.get("ko", ""), x.get("en", ""), *x.get("aka", []),
                               x.get("sum", ""), *x.get("facts", []), *x.get("watch", [])])
            cards.append(f'<a class="card" href="/lib/{id}" data-s="{e(search)}"><b>{e(x["t"])}</b><span>{e(x.get("ko", ""))}</span></a>')
        secs.append(f'<section class="sec" id="topic-{topic["id"]}"><h2>{e(topic["title"])} <small>{len(cards)}개</small></h2>'
                    + f'<p>{e(topic["desc"])}</p><div class="cards">' + "".join(cards) + "</div></section>")
    paths = "".join(f'<a class="path" href="/#lib?path={p["id"]}"><span>{e(p["audience"])}</span><b>{e(p["title"])} ↗</b><p>{e(p["desc"])}</p><span>{len(p["steps"])}단계 읽기</span></a>' for p in GUIDE["paths"])
    topics = "".join(f'<a class="topic" href="#topic-{t["id"]}"><small>{e(t["en"])}</small><b>{e(t["title"])}</b><p>{e(t["desc"])}</p><small>{len(t["entries"])}개 항목 →</small></a>' for t in GUIDE["topics"])
    js = '<script>' + (ROOT / "lib-index.js").read_text(encoding="utf-8") + '</script>'
    body = (header() + '<main><div class="w"><p class="crumbs"><a href="/">홈</a> › 규격 사전</p>'
            + '<div class="library-head"><p class="eyebrow">FASTENER KNOWLEDGE LIBRARY</p><h1>체결부품 지식 라이브러리</h1>'
            + '<p class="intro">부품을 고르고, 도면을 읽고, 구매 조건을 정리할 때. 규격과 실무 지식을 필요한 순서로 찾아보세요.</p></div>'
            + f'<form class="library-search" id="search" role="search"><label for="q">규격 번호, 품목 이름, 궁금한 개념으로 찾기</label><input class="q" id="q" type="search" placeholder="예: A193 B7, 토크 예압, 핀, EN 10204 3.1" maxlength="200" autocomplete="off"><p class="search-note">{len(L)}개 항목 · 규격·개념·구매 시 주의까지 검색합니다. Enter를 누르면 검색 결과로 이동합니다.</p></form>'
            + '<div id="overview"><h2>무엇을 확인하고 계신가요?</h2><div class="library-paths">' + paths + '</div>'
            + '<h2>체결부품 지식의 전체 지도</h2><nav class="library-map" aria-label="라이브러리 주제">' + topics + '</nav></div>'
            + f'<p class="search-note" id="count" aria-live="polite" aria-atomic="true">{len(L)}개 항목</p>'
            + '<div class="no-results" id="empty" hidden><p>현재 검색어에 맞는 항목이 없습니다. 단어를 줄여 다시 찾아보세요.</p><button id="reset" type="button">검색 지우기</button><p>사전에 없는 사양은 <a href="/#list">목록 견적</a>에 보내 주세요.</p></div>'
            + "".join(secs) + "</div></main>" + footer(info) + js)
    ld = {"@context": "https://schema.org", "@type": "DefinedTermSet", "name": "볼트노트 체결부품 규격 사전", "url": f"{SITE_URL}lib/",
          "hasDefinedTerm": [{"@type": "DefinedTerm", "name": x["t"], "url": f"{SITE_URL}lib/{x['id']}"} for x in L]}
    return page("체결부품 지식 라이브러리 | 볼트노트", f"체결부품 규격과 실무 지식 {len(L)}개 항목. 주제별 탐색과 BOM·플랜지·기계 조립·구매 확인 읽기 경로", "lib/", body, ld)


def main() -> None:
    L = json.loads((ROOT / "lib.json").read_text(encoding="utf-8"))
    by = {x["id"]: x for x in L}
    info = site_info()
    out = DOCS / "lib"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.html"):
        old.unlink()
    for x in L:
        (out / f'{x["id"]}.html').write_text(entry_html(x, by, info), encoding="utf-8")
    (out / "index.html").write_text(index_html(L, info), encoding="utf-8")
    urls = [SITE_URL, SITE_URL + "lib/"] + [f'{SITE_URL}lib/{x["id"]}' for x in L]
    (DOCS / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (DOCS / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}sitemap.xml\n", encoding="utf-8")
    print(f"wrote {len(L)} entry pages + index, sitemap ({len(urls)} urls)")


if __name__ == "__main__":
    main()
