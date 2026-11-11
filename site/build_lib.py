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

from catalog import catalog, SITE_URL, SOCIAL_IMAGE, product_path, product_urls, compact_description, brand_copy, display_font_href, table_urls, table_data, table_name, TABLE_ALIAS

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
CHECKED = "2026-10"
KIND = {"std": "규격", "grade": "등급", "mat": "재질", "thread": "나사", "concept": "개념·설계", "doc": "서류", "test": "시험", "coat": "코팅·부식", "part": "부품 용어"}
KIND_ORDER = ["std", "grade", "mat", "thread", "concept", "doc", "test", "coat", "part"]
GUIDE = json.loads((ROOT / "lib-guide.json").read_text(encoding="utf-8"))
e = html.escape


def official_links(x):
    links = {"ASTM": ("ASTM", "https://www.astm.org/"), "ASME": ("ASME", "https://www.asme.org/codes-standards"), "ISO": ("ISO", "https://www.iso.org/standards.html"), "KS": ("국가표준인증 통합정보", "https://standard.go.kr/"), "JIS": ("JISC", "https://www.jisc.go.jp/"), "DIN": ("DIN", "https://www.din.de/en"), "SAE": ("SAE", "https://www.sae.org/standards"), "API": ("API", "https://www.api.org/products-and-services/standards")}
    picked = [f'<a href="{u}" target="_blank" rel="noopener noreferrer">{t} 공식 검색·안내 ↗</a>' for k, (t, u) in links.items() if x.get("org") == k or any(v.startswith(k) for v in x.get("src", []))]
    return '<p class="src">' + ' · '.join(picked) + '</p><p class="src">발행 기관 안내 링크이며 개별 수치의 검증 원문 링크는 아닙니다. <a href="/#lib?path=purchase">구매 결정 경로 → 견적 확인 질문</a></p>'


def site_info() -> dict:
    """site/page.html에서 바닥글에 쓸 사업자 정보를 읽는다 (빈 값이면 표시하지 않음)."""
    t = (ROOT / "page.html").read_text(encoding="utf-8")
    def val(pat):
        m = re.search(pat, t)
        return m.group(1) if m else ""
    return {
        "bizNo": val(r"bizNo: '([^']*)'"), "owner": val(r"ownerName: '([^']*)'"),
        "rfq": val(r"rfq: '([^']*)'"), "tel": val(r"tel: '([^']*)'"), "kakao": val(r"kakaoName: '([^']*)'"), "kakaoChat": val(r"kakaoChat: '([^']*)'"), "kakaoHours": val(r"kakaoHours: '([^']*)'"),
        "mailOrderNo": val(r"mailOrderNo: '([^']*)'"),
        # 전화 응대 시간: SHOP.sla가 가리키는 SLA_COPY 항목의 tel 값 (e1_data.js 한 곳에서만 바꾼다)
        "telHours": val(r"\b" + re.escape(val(r"sla: '(\w+)'") or "parttime") + r": \{[^}]*?tel: '([^']*)'"),
        "analyticsToken": val(r"analyticsToken: '([^']*)'"),
        "funnelCount": val(r"funnelCount: (true|false)") == "true",   # 문의 집계 스위치 (e1_data.js SHOP.funnelCount)
    }


def beacon_tag(info: dict | None = None) -> str:
    """Cloudflare Web Analytics 스크립트. SHOP.analyticsToken(e1_data.js)이 비어 있으면 아무것도 넣지 않는다.
    토큰은 공개 값이며 쿠키 없는 집계용이다. 수동 삽입 스니펫은 type="module"이 필요하다(Cloudflare FAQ). 켜고 끄는 곳은 e1_data.js 한 곳이고, 처리방침(v6_policy.js)도 같은 값을 본다."""
    token = (info or site_info()).get("analyticsToken", "")
    if not token:
        return ""
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,}", token):
        raise ValueError("SHOP.analyticsToken 형식이 이상합니다")
    return f'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{{"token": "{token}"}}\'></script>\n'


CSS = """
:root{--paper:#F1F3EF;--sheet:#FBFCFA;--ink:#17202A;--ink-2:#485361;--ink-3:#5C6773;--hair:#B3BDC5;--hair-2:#D8DEE1;--night:#0D141A;--line:#26343F;--tx:#EEF1EC;--tx-2:#AAB7C2;--acc:#F4E15F;--red:#B42B1B;--red-soft:#F7E3DE;--hl-soft:#FAF2BE}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Gothic A1","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;font-size:15px;line-height:1.65;-webkit-text-size-adjust:100%}
a{color:inherit}.w{max-width:1180px;margin:0 auto;padding:0 clamp(16px,2.4vw,32px)}
header{background:var(--night);color:var(--tx);border-bottom:1px solid rgba(255,255,255,.07)}
header .w{display:flex;align-items:center;gap:20px;min-height:64px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;font-size:20px;letter-spacing:-.03em}.brand img{width:190px;height:auto;display:block}
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
:root{--paper:#F5F7FA;--sheet:#fff;--acc:#F15A38;--hl-soft:#FFF1E9}
[hidden]{display:none!important}.w{max-width:1280px}html{scroll-padding-top:20px}a:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
.cta{color:#131C29;border-radius:999px}.library-head{max-width:760px}.eyebrow{font-size:11px;letter-spacing:.08em;color:var(--ink-3);font-weight:700}.intro{margin:14px 0 24px;color:var(--ink-2)}
.library-paths,.library-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 32px}.path,.topic{padding:22px 20px;border-radius:10px;text-decoration:none;display:flex;flex-direction:column;gap:8px}.path{background:var(--night);color:#fff}.path span{color:var(--tx-2);font-size:12px}.path b,.topic b{font-size:17px}.path p,.topic p{font-size:13px;margin:0}.topic{border:1px solid var(--hair-2);background:var(--sheet)}.topic small{font-size:11px;color:var(--ink-3)}.topic p{color:var(--ink-2)}
.library-search{padding:22px 24px;border:1px solid var(--hair-2);background:var(--sheet);border-radius:10px;margin-bottom:32px}.library-search label{font-size:14px;font-weight:700}.q{margin:10px 0}.search-note{font-size:12px;color:var(--ink-3);margin:0}.no-results{border:1px solid var(--hair-2);padding:24px;background:var(--sheet);border-radius:10px}.no-results button{padding:12px 16px;cursor:pointer}
.toc,.entry-tools{display:flex;flex-wrap:wrap;gap:8px 24px;margin:20px 0}.toc a,.entry-tools a{font-size:13px;padding:8px 0}.toc{border-bottom:1px solid var(--hair-2)}.reading{list-style:none;padding:0;margin:0}.reading li{margin:16px 0}.reading li>span{display:block;font-size:12px;font-weight:700;margin-bottom:8px}.chip{min-height:40px;max-width:100%;overflow-wrap:anywhere}.chip.current{background:var(--ink);color:var(--sheet)}.sec>p{color:var(--ink-2);font-size:14px}.cards .card{min-width:0;overflow-wrap:anywhere}
@media(max-width:960px){.library-paths,.library-map{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){.library-paths{grid-template-columns:minmax(0,1fr)}.topic{padding:18px 14px}.topic b{font-size:15px}.library-search{padding:18px}.brand{font-size:18px}nav.top a{padding:10px 8px}}
@media (max-width:860px){.grid{grid-template-columns:minmax(0,1fr)}nav.top{order:3;flex-basis:100%}}
.bn-strip{background:#0a0e13;color:#c3ccd4;padding:44px 0 46px;border-bottom:1px solid #1d2731}
.bn-strip-line{display:flex;align-items:center;gap:12px;margin:0;font-family:"Hahmlet","Gothic A1","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;font-size:clamp(24px,3vw,36px);font-weight:800;letter-spacing:-.025em;line-height:1.2;color:#fff}
.bn-strip-line img{width:34px;height:34px;flex:none}.bn-strip-lead{margin:14px 0 0;font-size:15px;line-height:1.75;max-width:640px}.bn-strip-lead b{color:#f2f3ef}
.bn-strip-actions{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0 0}
.bn-strip-btn{display:inline-flex;align-items:center;gap:14px;min-height:50px;padding:0 22px;border:1px solid #F15A38;border-radius:999px;background:#F15A38;color:#10151B;font-weight:800;font-size:14px;text-decoration:none}
.bn-strip-btn.ghost{background:transparent;border-color:#5A6673;color:#F2F3EF}.bn-strip-btn .bn-kakao{flex:none;margin-left:-8px}.bn-strip-hours{margin:12px 0 0;font-size:12.5px;color:#93A0AC}
"""
MARK = '<img src="/brand/boltnote-logo-light.svg" width="632" height="104" alt="boltnote">'
BEACON = beacon_tag()   # 정적 페이지 435장에 같은 값. page.html을 한 번만 읽는다


def count_tag(info: dict | None = None) -> str:
    """문의 집계 스크립트 (site/count.js). 사전·제품 페이지를 연 횟수와 문의 버튼을 누른 횟수를 이름만 /count로 보낸다.
    SHOP.funnelCount(e1_data.js)가 꺼져 있으면 넣지 않는다. 처리방침 B항(v6_policy.js)이 같은 값을 본다. 404 안내 페이지에는 넣지 않는다."""
    if not (info or site_info()).get("funnelCount"):
        return ""
    source = re.sub(r"/\*.*?\*/\s*", "", (ROOT / "count.js").read_text(encoding="utf-8"), count=1, flags=re.S)
    return "<script>" + source.strip() + "</script>\n"


COUNT = count_tag()
BRAND = brand_copy()    # 홈 조임 장면과 같은 문구 (app/src/v9_tighten.js). 정적 페이지 끝의 띠가 쓴다
# 띠의 한 줄(도장 문구)만 제목 글꼴로 쓴다. 그 글자만 담아 요청하고, 페이지 아래쪽이라 그리기를 막지 않게 늦게 붙인다. 모든 페이지가 같은 주소라 한 번 받으면 다시 받지 않는다
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;700;800&display=swap" rel="stylesheet">'
         f'<link href="{html.escape(display_font_href(BRAND["stamp"]))}" rel="stylesheet" media="print" onload="this.media=\'all\'">')


def page(title: str, desc: str, path: str, body: str, ld: dict | None = None, index: bool = True, lang: str = "ko", alternates: dict | None = None) -> str:
    """정적 페이지의 공통 틀. index=False는 검색에 넣지 않는 페이지(404 안내)로, 표준 주소와 og:url을 내지 않는다."""
    url = SITE_URL + path
    desc = compact_description(desc)
    return (
        f'<!doctype html>\n<html lang="{lang}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<link rel="icon" href="/brand/boltnote-mark.svg" type="image/svg+xml">\n'
        + ('<meta name="robots" content="index,follow">\n' if index else '<meta name="robots" content="noindex,follow">\n')
        + f"<title>{e(title)}</title>\n<meta name=\"description\" content=\"{e(desc)}\">\n" + (f"<link rel=\"canonical\" href=\"{url}\">\n" if index else "")
        + "".join(f'<link rel="alternate" hreflang="{k}" href="{SITE_URL}{v}">\n' for k, v in (alternates or {}).items())
        +
        f'<meta property="og:type" content="article"><meta property="og:site_name" content="{"Boltnote" if lang == "en" else "볼트노트"}"><meta property="og:locale" content="{"en_US" if lang == "en" else "ko_KR"}">'
        + (f'<meta property="og:url" content="{url}">' if index else "") + f'<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">'
        f'<meta property="og:image" content="{SITE_URL}{SOCIAL_IMAGE}"><meta name="twitter:card" content="summary_large_image">\n'
        + (f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n' if ld else "")
        + f"{FONTS}\n<style>{CSS}</style>\n{BEACON}</head>\n<body>\n{body}\n{COUNT if index else ''}</body>\n</html>\n"
    )


ON = ' class="on" aria-current="page"'
STL = {True: "stl ok", False: "stl"}   # 현행은 회색, 폐지·대체는 붉은색


def header(on: str = "lib") -> str:
    nav = [("/products/", "제품", "products"), ("/tables/", "규격표", "tables"), ("/#list", "Sales", ""), ("/lib/", "규격 사전", "lib"), ("/#about", "회사 소개", ""), ("/en/", "English", "en")]
    return ('<header><div class="w"><a class="brand" href="/" aria-label="Boltnote · 볼트노트 홈">' + MARK + '</a><nav class="top" aria-label="주 메뉴">'
            + "".join(f'<a href="{h}"{ON if k == on else ""}>{t}</a>' for h, t, k in nav)
            + '</nav><a class="cta" href="/#list">Sales 문의 →</a></div></header>')


# 카카오톡 표시: 노란 바탕에 검은 말풍선 (app/src/v9_sales.js BN_KAKAO_BUBBLE과 같은 모양)
KAKAO_MARK = ('<svg class="bn-kakao" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#FEE500"/>'
              '<path fill="#191919" d="M12 5.6c-3.9 0-7 2.4-7 5.5 0 2 1.3 3.7 3.3 4.7l-.7 2.7c-.1.4.3.7.6.4l3.2-2.1c.2 0 .4 0 .6 0 3.9 0 7-2.500 7-5.700s-3.100-5.500-7-5.500z"/></svg>')


def brand_strip(info: dict) -> str:
    """모든 정적 페이지의 끝(꼬리말 앞)에 붙는 볼트노트 띠. 검색으로 들어온 방문자는 홈을 보지 않으므로, 여기서 누가 하는 곳인지와 문의하는 길을 보인다.
    문구는 이미 사이트에 있는 것만 쓴다: 도장 문구·리드는 조임 장면(brand_copy), 설명 한 줄은 홈 견적 구역(app/src/v7_ia.js)과 같다. 재고·가격·납기를 약속하지 않는다.
    카카오톡 버튼은 채널 주소(CONTACT.kakaoChat)가 있을 때만 나온다 (대표 결정 2026-11-10: 정적 페이지에도 크게 보인다)."""
    kakao = hours = ""
    if info.get("kakaoChat"):
        kakao = f'<a class="bn-strip-btn ghost" href="{e(info["kakaoChat"])}" target="_blank" rel="noopener noreferrer">{KAKAO_MARK}카카오톡으로 문의 <span aria-hidden="true">↗</span></a>'
        if info.get("kakaoHours"): hours = f'<p class="bn-strip-hours">카카오톡 응대 {e(info["kakaoHours"])}</p>'
    return ('<aside class="bn-strip" aria-label="볼트노트 문의"><div class="w">'
            f'<p class="bn-strip-line"><img src="/brand/boltnote-mark.svg" width="34" height="34" alt="">{e(BRAND["stamp"])}</p>'
            f'<p class="bn-strip-lead"><b>{e(BRAND["lead"])}</b> 기존 자료를 그대로 보내 주세요. 사양 확인과 공급처 검토는 볼트노트가 이어갑니다.</p>'
            f'<p class="bn-strip-actions"><a class="bn-strip-btn" href="/#list">BOM·RFQ 보내기 <span aria-hidden="true">→</span></a>{kakao}</p>{hours}'
            '</div></aside>')


def not_found_html(info: dict) -> str:
    """없는 주소로 들어왔을 때의 안내 (docs/404.html, wrangler.jsonc의 not_found_handling이 404 상태로 내보낸다).
    어느 깊이의 주소에서도 나오므로 링크는 모두 루트(/)에서 시작한다. 검색에 넣지 않는다(noindex, 사이트맵에 없음)."""
    links = [("/", "홈", "볼트노트 첫 화면"), ("/products/", "제품", "품목별 규격·구매 안내"), ("/lib/", "규격 사전", "체결부품 규격과 실무 지식"), ("/#list", "Sales 문의", "BOM·메모·RFQ 보내기")]
    body = (header("none") + '<main><div class="w"><p class="eyebrow">404</p><h1>찾으시는 주소가 없습니다</h1>'
            '<p class="intro">주소가 바뀌었거나 잘못 입력되었습니다. 아래에서 다시 찾아보세요.</p><div class="cards">'
            + "".join(f'<a class="card" href="{h}"><b>{t}</b><span>{d}</span></a>' for h, t, d in links)
            + '</div></div></main>' + brand_strip(info) + footer(info))
    return page("주소를 찾을 수 없습니다 | 볼트노트", "찾으시는 주소가 없습니다. 홈, 제품, 규격 사전, Sales 문의로 이동할 수 있습니다.", "404", body, index=False)


def footer(info: dict) -> str:
    r1 = ["<b>볼트노트 · 체결부품 견적·공급</b>", "상호 볼트노트"]
    if info["owner"]: r1.append(f"대표 {e(info['owner'])}")
    if info["bizNo"]: r1.append(f"사업자등록번호 {e(info['bizNo'])}")
    if info["mailOrderNo"]: r1.append(f"통신판매업 {e(info['mailOrderNo'])}")
    r2 = []
    if info["tel"]: r2.append(f'전화 <a href="tel:{re.sub(r"[^0-9]", "", info["tel"])}">{e(info["tel"])}</a>' + (f' ({e(info["telHours"])})' if info.get("telHours") else ""))
    if info["rfq"]: r2.append(f'견적 메일 <a href="/#list">{e(info["rfq"])}</a>')
    if info["kakaoChat"]: r2.append(f'카카오톡 <a href="{e(info["kakaoChat"])}">{e(info["kakao"] or "볼트노트")} 채널</a>')
    elif info["kakao"]: r2.append(f"카카오톡 {e(info['kakao'])} (채널 공개 준비 중)")
    r2.append("호스팅 Cloudflare, Inc. (미국)")
    r3 = ['<a href="/#privacy"><b>개인정보 처리방침</b></a>', '<a href="/#terms">이용약관</a>', '<a href="/#about">회사 소개</a>']
    return ('<footer><div class="w"><a class="brand" href="/" aria-label="Boltnote · 볼트노트 홈">' + MARK + '</a>' + "".join(f'<div class="r">{" ".join(f"<span>{x}</span>" for x in row)}</div>' for row in (r1, r2, r3))
            + f'<div class="r"><span>규격 사전은 발행 기관 공개 자료·공식 미리보기·공공 문서와, 일부 값은 제조·유통사 공개 기술자료 3곳 이상을 대조해 요점을 정리한 것입니다 (확인 {CHECKED}). 계약·설계에는 규격 원문을 확인하세요.</span></div></div></footer>')


def table_links(ids) -> dict:
    """품목 id들 가운데 규격표(site/build_tables.py)가 있는 것 → {주소: 품목 이름}. 반나사 육각볼트는 온나사 표를 본다."""
    if not hasattr(table_links, "known"):
        families, tiles, paths = catalog()
        table_links.known = {id: ("/tables/" + paths[id], table_name(families[id])) for id in table_data()}
    found = {}
    for id in ids:
        link = table_links.known.get(TABLE_ALIAS.get(id, id))
        if link:
            found[link[0]] = link[1]
    return found


def badges(x: dict) -> str:
    st = x.get("status", "")
    return (f'<span class="org">{e("공통" if x["org"] == "-" else x["org"])}</span><span class="kind">{e(KIND.get(x["kind"], x["kind"]))}</span>'
            + (f'<span class="st">{e(st.split(" ")[0])}</span>' if st and not st.startswith("현행") else ""))


def entry_title(x: dict) -> str:
    """검색 결과에 보이는 제목. 영문 제목과 한국어 이름이 같은 말로 시작하면 한 번만 쓴다 (예: 분할핀 · 분할핀 (코터핀))."""
    t, ko = x["t"], x.get("ko", "")
    head = lambda s: s.split(" (")[0].strip()
    name = t if not ko or ko == t else ko if head(ko) == head(t) else f"{t} · {ko}"
    return f"{name} | 볼트노트 규격 사전"


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
    tables = table_links(fams)
    body = (header() + '<main><div class="w">'
            + f'<p class="crumbs"><a href="/">홈</a> › <a href="/lib/">규격 사전</a> › <a href="/lib/#topic-{topic["id"]}">{e(topic["title"])}</a> › {e(x["t"])}</p><h1>{e(x["t"])}</h1>'
            + f'<p class="bd">{badges(x)}</p><p class="ko">{e(x.get("ko", ""))}</p>' + (f'<p class="en" lang="en">{e(x["en"])}</p>' if x.get("en") else "")
            + f'<div class="entry-tools"><a href="/#lib-{x["id"]}">사이트에서 이 항목 보기 ↗</a><a href="/lib/#topic-{topic["id"]}">← 주제 목록으로</a><a href="/#list">BOM·RFQ 보내기 →</a></div>'
            + '<nav class="toc" aria-label="항목 안에서 이동"><a href="#core">핵심</a>'
            + ('<a href="#table">표·조건</a>' if tbl else '') + ('<a href="#watch">구매 시 주의</a>' if x.get("watch") else '')
            + '<a href="#source">근거</a></nav><div class="grid"><article>'
            + f'<p class="lead">{e(x.get("sum", ""))}</p>' + (f'<p class="{STL[x["status"].startswith("현행")]}">상태: {e(x["status"])}</p>' if x.get("status") else "")
            + '<h2 id="core">핵심</h2><ul class="f">' + "".join(f"<li>{e(f)}</li>" for f in x.get("facts", [])) + "</ul>" + tbl
            + ('<section class="watch" id="watch"><h2>BOM·구매 때 주의</h2><ul class="f">' + "".join(f"<li>{e(w)}</li>" for w in x["watch"]) + "</ul></section>" if x.get("watch") else "")
            + ('<h2>대응·대체 규격</h2><ul class="f">' + "".join(f'<li><b>{e(q.get("std", ""))}</b> {e(q.get("note", ""))}</li>' for q in x["eq"]) + "</ul>" if x.get("eq") else "")
            + official_links(x)
            + f'<p class="src" id="source">근거: {e(" · ".join(x.get("src", [])))} · 라이브러리 일괄 검토 {CHECKED} (개별 항목 검토일 미기록). 프로젝트 판본·허용차·사용 조건은 규격 원문과 공급처 서류로 확인해야 합니다. 미확인 값은 추정하지 마세요.</p>'
            + "</article><aside>"
            + f'<div class="box"><h2>지식 지도 · {e(topic["title"])}</h2><p>{e(topic["desc"])}</p><a href="/lib/#topic-{topic["id"]}">이 주제 전체 보기 →</a></div>' + reading
            + ('<div class="box"><h2>관련 항목</h2><div class="chips">' + "".join(f'<a class="chip" href="/lib/{r["id"]}">{e(r["t"])}</a>' for r in rel) + "</div></div>" if rel else "")
            + ('<div class="box"><h2>관련 품목</h2><div class="chips">' + "".join(f'<a class="chip" href="{product_path(k)}">{e(v)}</a>' for k, v in fams.items()) + "</div></div>" if fams else "")
            + ('<div class="box"><h2>관련 규격표</h2><div class="chips">' + "".join(f'<a class="chip" href="{link}">{e(label)} 규격표</a>' for link, label in tables.items()) + "</div></div>" if tables else "")
            + '<div class="box dark"><h2>이 규격이 들어간 BOM이 있으신가요?</h2><p>표기 그대로 보내 주시면 줄마다 규격·등급과 필요한 서류를 맞춰 견적합니다.</p><a class="cta" href="/#list">Sales로 보내기 →</a></div>'
            + "</aside></div></div></main>" + brand_strip(info) + footer(info))
    ld = {"@context": "https://schema.org", "@type": "DefinedTerm", "name": x["t"], "alternateName": [x.get("ko", "")] + x.get("aka", [])[:6],
          "description": x.get("sum", ""), "url": f"{SITE_URL}lib/{x['id']}",
          "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "볼트노트 체결부품 규격 사전", "url": f"{SITE_URL}lib/"}}
    return page(entry_title(x), x.get("sum", ""), f'lib/{x["id"]}', body, ld)


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
            + '<div class="no-results" id="empty" hidden><p>현재 검색어에 맞는 항목이 없습니다. 단어를 줄여 다시 찾아보세요.</p><button id="reset" type="button">검색 지우기</button><p>사전에 없는 사양은 <a href="/#list">Sales</a>로 보내 주세요.</p></div>'
            + "".join(secs) + "</div></main>" + brand_strip(info) + footer(info) + js)
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
    (DOCS / "404.html").write_text(not_found_html(info), encoding="utf-8")   # 사이트맵에 넣지 않는다
    urls = [SITE_URL, SITE_URL + "lib/"] + [f'{SITE_URL}lib/{x["id"]}' for x in L] + product_urls() + table_urls() + [SITE_URL + "en/"]
    (DOCS / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n", encoding="utf-8")
    (DOCS / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE_URL}sitemap.xml\n", encoding="utf-8")
    print(f"wrote {len(L)} entry pages + index, sitemap ({len(urls)} urls)")


if __name__ == "__main__":
    main()
