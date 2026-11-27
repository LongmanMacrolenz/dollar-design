"""English page for buyers in Korea who work in English → docs/en/index.html (대표 요청 2026-11-11).

대상: 한국에 있는 외국계 공장·플랜트·EPC 현장의 엔지니어와 구매 담당. 해외 판매 페이지가 아니다:
납품은 국내, 견적·세금계산서는 원화(KRW)이며 결제 수단은 바꾸지 않는다.
문구는 사이트에 이미 있는 사실만 영어로 옮긴다(회신 영업일·응대 시간·연락처는 site/page.html에서 읽는다).
재고·가격·납기 약속, 실적·후기·인증, 회사·거래처 이름, 주소는 쓰지 않는다. 메일 앱을 여는 링크(mailto)는 두지 않는다.
"""
import html
import json
import pathlib
import re

from build_lib import page, site_info, MARK, KAKAO_MARK, org_graph
from catalog import SITE_URL, SITE_REV, table_data, catalog

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
e = html.escape

EN_CSS = """
.en-hero{padding:56px 0 40px;background:#0a0e13;color:#e8ecef}.en-hero .eyebrow{color:#93a0ac}.en-hero h1{color:#fff;font-size:clamp(30px,4.4vw,52px);max-width:900px}
.en-hero p.lead{color:#c3ccd4;max-width:760px;margin:18px 0 0}.en-actions{display:flex;flex-wrap:wrap;gap:12px;margin:26px 0 0;align-items:center}
.en-mail{display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 20px;border-radius:999px;background:#F15A38;color:#10151B;font-weight:800;user-select:all}
.en-send{display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 20px;border-radius:999px;background:#F15A38;color:#10151B;font-weight:800;text-decoration:none}
.en-actions a.ghost{display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 20px;border:1px solid #5A6673;border-radius:999px;color:#F2F3EF;font-weight:800;text-decoration:none}
.en-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.en-grid .box h2{font-size:16px}
.en-steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:10px}.en-steps li{counter-increment:s;position:relative;padding:14px 16px 14px 52px;border:1px solid var(--hair-2);border-radius:10px;background:var(--sheet)}
.en-steps li:before{content:counter(s,decimal-leading-zero);position:absolute;left:16px;top:14px;font-weight:800;color:#F15A38}
.en-rfq{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13.5px;background:#edf0f4;padding:18px;border-radius:8px}
.en-note{font-size:13px;color:var(--ink-3)}
.en-hero2{background:#0a0e13;color:#e8ecef;padding:48px 0 0}.en-hero2 .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:center}
.en-hero2 .eyebrow{color:#93a0ac}.en-hero2 h1{color:#fff;font-size:clamp(30px,4.2vw,50px);line-height:1.18;margin:12px 0 0}.en-hero2 h1 span{display:block}.en-hero2 h1 span:first-child{font-weight:300;color:#b9c3cb}
.en-hero2 p.lead{color:#c3ccd4;margin:20px 0 0;max-width:560px}.en-hero2 .inv{font-size:13.5px;color:#93a0ac;margin:14px 0 0}
.en-hero2 figure{margin:0}.en-hero2 figure img{width:100%;height:auto;display:block;border-radius:6px}.en-hero2 figcaption{display:flex;justify-content:space-between;font-size:12px;color:#93a0ac;margin-top:8px}
.en-strip{display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr;border-top:1px solid #26303a;margin-top:36px}.en-strip>*{padding:20px 22px;border-left:1px solid #26303a;color:#c3ccd4;text-decoration:none}.en-strip>*:first-child{border-left:0;padding-left:0}
.en-strip b{display:block;font-size:22px;color:#fff;font-weight:400}.en-strip b small{font-size:13px;margin-left:6px;color:#c3ccd4}.en-strip span{font-size:13px;color:#93a0ac}.en-strip strong{color:#fff;font-weight:500}
.en-sec{padding:56px 0 8px}.en-sec h2{font-size:clamp(24px,3vw,32px);line-height:1.25;margin:6px 0 10px}.en-sec .k{font-size:12px;letter-spacing:.12em;color:#F15A38;font-weight:800;margin:0}.en-sec .sub{color:var(--ink-2);max-width:620px}
.en-review{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:start}
.en-proof{counter-reset:p;list-style:none;padding:0;margin:20px 0 0;display:grid;gap:12px}.en-proof li{display:grid;grid-template-columns:36px 1fr;gap:10px}.en-proof li>span{font-weight:800;color:#F15A38}.en-proof b{display:block}.en-proof p{margin:2px 0 0;font-size:14.5px;color:var(--ink-2)}
.en-reviewer{margin:22px 0 0;padding:16px 18px;border:1px solid var(--hair-2);border-radius:10px;background:var(--sheet)}.en-reviewer .eyebrow{margin:0 0 6px}.en-reviewer b{font-size:17px}.en-reviewer span{display:block;font-size:14px;color:var(--ink-2)}
.en-sheet{border:1px solid var(--hair-2);border-radius:12px;background:#fff;padding:18px 20px}.en-sheet .hd{display:flex;justify-content:space-between;font-size:11.5px;letter-spacing:.08em;color:var(--ink-3);margin-bottom:12px}
.en-sheet .raw{font-family:ui-monospace,Menlo,Consolas,monospace;background:#edf0f4;border-radius:8px;padding:12px 14px;margin:6px 0 14px;font-size:14px}
.en-sheet dl{margin:0;display:grid;gap:10px}.en-sheet dt{font-weight:700;font-size:14px}.en-sheet dt span{color:#F15A38;margin-right:6px}.en-sheet dd{margin:2px 0 0;font-size:14px;color:var(--ink-2)}
.en-sheet .res{margin-top:16px;padding-top:14px;border-top:1px solid var(--hair-2)}.en-sheet .res b{display:block}.en-sheet .res small{color:var(--ink-3);font-size:12.5px}.en-sheet .disc{font-size:12px;color:var(--ink-3);margin:12px 0 0}
.en-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0 10px}.en-tiles a{display:block;padding:18px;border:1px solid var(--hair-2);border-radius:12px;background:var(--sheet);text-decoration:none}
.en-tiles b{display:block;font-size:17px;color:var(--ink-1,#1d2330)}.en-tiles span{display:block;font-size:13px;color:var(--ink-3);margin-top:4px}
.en-links{display:flex;flex-wrap:wrap;gap:10px 18px;margin:14px 0 0}.en-links a{font-weight:700}
.en-contact .ghost{color:#10151B;border-color:#8a96a2}.en-contact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;align-items:start}
.en-about{display:grid;gap:0;border-top:1px solid var(--hair-2);margin-top:18px}.en-about>div{display:grid;grid-template-columns:150px 1fr;gap:16px;padding:12px 0;border-bottom:1px solid var(--hair-2);font-size:14.5px}.en-about .lab{font-weight:800}
@media(max-width:860px){.en-grid,.en-hero2 .grid,.en-review,.en-contact{grid-template-columns:minmax(0,1fr)}.en-tiles{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.en-strip{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.en-strip>*{border-left:0;padding-left:0}.en-about>div{grid-template-columns:minmax(0,1fr);gap:4px}}
"""


def facts():
    """회신 영업일·경력 연수는 사이트 원본과 같은 값을 쓴다."""
    built = (ROOT / "page.html").read_text(encoding="utf-8")
    plan = re.search(r"sla: '(\w+)'", built).group(1)
    days = int(re.search(r"\b" + re.escape(plan) + r": \{[^}]*?days: (\d+)", built).group(1))
    years = re.search(r"ownerYears: '(\d+)'", built)
    return days, (years.group(1) if years else "")


def header(on: str = ""):
    """한국어 머리(site/build_lib.py header)와 같은 메뉴 순서·같은 단추. 영문 쪽은 규격표·제품·사전·노트가 /en/ 아래 짝이다."""
    nav = [("/en/products/", "Products", "products"), ("/en/tables/", "Dimension tables", "tables"), ("/en/#rfq", "Sales", ""), ("/en/lib/", "Glossary", "lib"), ("/en/notes/", "Notes", "notes"), ("/en/ads/", "Advertise", "ads"), ("/en/#about", "About", "")]
    return ('<header><div class="w"><a class="brand" href="/en/" aria-label="Boltnote home (English)">' + MARK + '</a>'
            '<nav class="top" aria-label="Main">' + "".join('<a href="%s"%s>%s</a>' % (h, ' class="on" aria-current="page"' if k == on else "", t) for h, t, k in nav) + '</nav>'
            '<nav class="lang" aria-label="Language"><a href="@@KO@@" lang="ko" hreflang="ko" title="한국어">KO</a> · <b aria-current="true">EN</b></nav>'
            '<a class="cta" href="/en/#rfq">Send an RFQ →</a></div></header>')


def brand_strip(info):
    """한국어 쪽 끝의 볼트노트 띠(site/build_lib.py brand_strip)와 같은 자리·같은 뜻."""
    kakao = (f'<a class="bn-strip-btn ghost" href="{e(info["kakaoChat"])}" target="_blank" rel="noopener noreferrer">{KAKAO_MARK}KakaoTalk <span aria-hidden="true">↗</span></a>' if info.get("kakaoChat") else "")
    return ('<aside class="bn-strip" aria-label="Contact Boltnote"><div class="w">'
            '<p class="bn-strip-line"><img src="/brand/boltnote-mark.svg" width="34" height="34" alt="">An engineer reads the specification. We confirm the supply conditions.</p>'
            '<p class="bn-strip-lead"><b>Send your list as it is.</b> We take it from there: specification check and supplier confirmation.</p>'
            f'<p class="bn-strip-actions"><a class="bn-strip-btn" href="/en/#rfq">Send a BOM / RFQ <span aria-hidden="true">→</span></a>{kakao}</p></div></aside>')


def footer(info):
    return (brand_strip(info) + '<footer><div class="w"><a class="brand" href="/" aria-label="Boltnote home">' + MARK + '</a>'
            f'<div class="r"><span><b>Boltnote (볼트노트)</b> · fastener quotation and supply, Republic of Korea</span>'
            + (f'<span>Business registration no. {e(info["bizNo"])}</span>' if info["bizNo"] else "") + '</div>'
            f'<div class="r"><span>E-mail {e(info["rfq"])}</span>' + (f'<span>Phone {e(info["tel"])} (weekdays 09:00–18:00 KST)</span>' if info["tel"] else "")
            + '<span>Hosting: Cloudflare, Inc. (USA)</span></div>'
            '<div class="r"><span><a href="/#privacy" lang="ko">개인정보 처리방침 (privacy policy, Korean)</a></span><span><a href="/#terms" lang="ko">이용약관 (terms, Korean)</a></span><span><a href="/en/#about">About</a></span></div>'
            '</div></footer>')


def build():
    info, (days, years) = site_info(), facts()
    families, tiles, paths = catalog()
    n_tables = len(table_data())
    kakao = (f'<a class="ghost" href="{e(info["kakaoChat"])}" target="_blank" rel="noopener noreferrer">{KAKAO_MARK}KakaoTalk channel ↗</a>'
             if info.get("kakaoChat") else "")
    rfq = ("Subject: RFQ – [project / plant name] – [number of lines] lines\n\n"
           "Company / plant: [name, site in Korea]\nContact: [name, e-mail, phone]\nDelivery to: [city / site in Korea]   Needed by: [date]\n\n"
           "Line | Description | Standard | Size | Grade / material | Finish | Qty\n"
           "1    | Stud bolt w/ 2 heavy hex nuts | ASME B18.31.2 / B18.2.2 | 3/4\"-10UNC x 120 mm | A193 B7 / A194 2H | HDG | 64 sets\n"
           "2    | [ ] | [ ] | [ ] | [ ] | [ ] | [ ]\n\n"
           "Documents required: [e.g. EN 10204 3.1 mill certificate, CoC]\nSpecial requirements: [NACE, impact test, PMI, marking …]\n"
           "Attachments: [BOM .xlsx / drawing / photo]")
    from catalog import catalog as _cat
    n_items = len(families)
    tile_cards = "".join(f'<a href="/en/products/category/{t["id"]}"><b>{e(t["en"])}</b><span>{sum(1 for f in families.values() if f["t"] == t["id"])} product guides</span></a>' for t in tiles)
    body = (header() + '<main style="padding-top:0">'
            # hero (한국어 홈 첫 화면과 같은 구성: 제목·소개·단추·그림·띠)
            '<section class="en-hero2"><div class="w"><div class="grid"><div>'
            '<p class="eyebrow">BOLTNOTE / INDUSTRIAL FASTENERS</p>'
            '<h1><span>An engineer reads the specification,</span><span>and sources your fasteners.</span></h1>'
            '<p class="lead">A mechanical engineer reads your BOM and drawings for plants and maintenance in Korea line by line, and returns the supplier-confirmed result as a quotation and a clarification &amp; deviation (C&amp;D) list. '
            'Mixed lists of bolts, nuts, washers and special materials, and English RFQs, are accepted as they are.</p>'
            '<div class="en-actions" id="rfq"><a class="en-send" href="#contact">Send a BOM / drawing →</a><a class="ghost" href="/en/tables/">Dimension tables →</a></div>'
            '<p class="inv">Excel, PDF, photos or the e-mail text as it is. No need to reformat anything.</p>'
            '</div><figure><img src="/media/boltnote-hero.webp" alt="Examples of hex bolts, socket screws, studs, nuts, washers and pins" width="1536" height="1024" fetchpriority="high" decoding="async">'
            '<figcaption><span>METRIC &amp; INCH</span><span>Reference rendering · not a product photo</span></figcaption></figure></div>'
            f'<div class="en-strip"><p>Reading the specification,<br><strong>confirming supply conditions.</strong></p><div><b>{len(tiles)}<small>product groups</small></b><span>From bolts to machine fasteners</span></div>'
            f'<div><b>{n_items}<small>item guides</small></b><span>Standards and dimensions per item</span></div><a href="/en/lib/"><b>Glossary ↗</b><span>Threads, materials, documents</span></a></div>'
            '</div></section><div class="w">'
            # 01 review
            '<section class="en-sec"><div class="en-review"><div><p class="k">01 / ENGINEER TO ENGINEER</p><h2>Send your list.<br>This is how we read it.</h2>'
            '<p class="sub">We do not judge by the designation alone. Confirmed conditions go on the quotation; questions and deviations go on the C&amp;D list.</p>'
            '<ol class="en-proof">'
            '<li><span>01</span><div><b>Reading the specification</b><p>Standard, material, grade and thread are checked line by line. Anything unclear comes back as a question.</p></div></li>'
            '<li><span>02</span><div><b>Mixed lists on one sheet</b><p>BOMs mixing bolts, nuts, washers and special materials are accepted as they are. No need to ask several places separately.</p></div></li>'
            '<li><span>03</span><div><b>English RFQs</b><p>English BOMs and RFQs are read line by line; questions and deviations are collected on the C&amp;D list.</p></div></li>'
            '<li><span>04</span><div><b>Required documents</b><p>We ask suppliers whether the required documents, such as mill certificates, can be provided, and state the result in the quotation.</p></div></li></ol>'
            + (f'<div class="en-reviewer"><p class="eyebrow">REVIEWED BY</p><b>Park Sejung <small>Mechanical engineer</small></b>'
               f'<span>{e(years)} years in rotating equipment · Owner of Boltnote</span><span>Reviews every quoted line personally.</span><a href="/en/#about">About Boltnote ↗</a></div>' if years and info.get("owner") else "")
            + '</div><div class="en-sheet"><div class="hd"><span>SPECIFICATION / REVIEW NOTE</span><span>Fictional review example</span></div>'
            '<p class="k" style="color:var(--ink-3);font-size:12.5px;letter-spacing:0;font-weight:600">A line in the BOM</p><p class="raw">STUD BOLT · 3/4"-10 UNC-2A<br>ASTM A193 B7</p>'
            '<dl><div><dt><span>01</span>Thread</dt><dd>Designation, pitch and external thread tolerance are told apart.</dd></div>'
            '<div><dt><span>02</span>Material and mating parts</dt><dd>The stud grade and the matching nut requirement are checked.</dd></div>'
            '<div><dt><span>03</span>Further questions</dt><dd>Length, quantity, finish and required documents are confirmed.</dd></div></dl>'
            '<div class="res"><b>Confirmed conditions go on the quotation.<br>Questions and deviations are kept apart.</b><small>Price, lead time and whether the manufacturer can provide documents are stated after the supplier confirms.</small></div>'
            '<p class="disc">An example of how we review. It is not a real customer document or a supply decision.</p></div></div></section>'
            # 02 products
            '<section class="en-sec"><p class="k">02 / FASTENER COLLECTION</p><h2>Start with the part you need.</h2>'
            '<p class="sub">Industrial fasteners in metric and inch standards. Check the item that fits the shape and the use.</p>'
            f'<div class="en-tiles">{tile_cards}</div>'
            '<p class="en-note">Reference renderings of each group, not product photos. Check dimensions, material and finish per item.</p>'
            f'<nav class="en-links" aria-label="Resources"><a href="/en/products/">All products →</a><a href="/en/lib/">Glossary ↗</a><a href="/en/tables/">Dimension tables ↗</a><a href="/en/notes/">Engineer notes →</a></nav></section>'
            # 03 contact (한국어 홈의 「지금 가지고 계신 자료로 시작하세요」)
            '<section class="en-sec" id="contact"><div class="en-contact"><div><p class="k">03 / START WITH YOUR LIST</p><h2>Start with<br>the documents you have.</h2>'
            '<p class="sub">BOMs, RFQs, drawings and photos, as they are. No need to send the same request to several places.</p>'
            '<ol class="en-steps"><li><b>Check the documents</b> — each line is read, and missing specifications are asked in one go.</li>'
            '<li><b>Confirm with suppliers</b> — once we have your answers, we confirm the conditions with suppliers.</li>'
            '<li><b>Quotation</b> — confirmed conditions go on the quotation; unconfirmed conditions and deviations go on the C&amp;D list. Lines we cannot supply are listed with the reason.</li></ol></div>'
            f'<div><h2 style="font-size:20px">Where to send it</h2><div class="en-actions"><span class="en-mail" title="Select to copy">{e(info["rfq"])}</span>{kakao}</div>'
            f'<p class="en-note">Weekdays 09:00–18:00 KST. Up to 20 lines are quoted within {days} business day{"s" if days > 1 else ""}; for longer lists we tell you the reply date first.</p>'
            '<h2 style="font-size:20px;margin-top:22px">RFQ example</h2><p class="en-note">Copy it into your own e-mail and replace the brackets. Your existing format is fine too.</p>'
            f'<pre class="en-rfq">{e(rfq)}</pre></div></div></section>'
            # About (한국어 「회사 소개」)
            '<section class="en-sec" id="about"><p class="k">ABOUT</p><h2>About Boltnote</h2><div class="en-about">'
            + (f'<div><span class="lab">Who</span><span>Park Sejung, mechanical engineer, {e(years)} years in rotating equipment. A one-person business, so the owner personally looks at every quoted line.</span></div>' if years and info.get("owner") else "")
            + '<div><span class="lab">How we work</span><span>Business-to-business quotation and supply. An order is placed after the quotation and an e-mail confirmation. We hold no stock; each order is sourced from suppliers in Korea. Delivery is within Korea; quotations, orders and Korean tax invoices are in KRW.</span></div>'
            f'<div><span class="lab">Replies</span><span>Weekdays 09:00–18:00 KST. Up to 20 lines are quoted within {days} business day{"s" if days > 1 else ""}.</span></div>'
            '<div><span class="lab">Documents</span><span>Mill certificates and other documents are quoted only when the supplier confirms they can be provided. Nothing is ordered automatically from this website.</span></div>'
            '<div><span class="lab">We do</span><span>Check specification, mating parts and documents line by line · list lines we cannot supply with the reason · state any change in the confirmation e-mail</span></div>'
            '<div><span class="lab">We do not</span><span>Promise same-day shipping · substitute without approval · issue mill certificates ourselves · disclose drawings we receive</span></div>'
            '<div><span class="lab">Review principle</span><span>We read standard, material, grade and dimensions against what the drawing and BOM state, and ask before quoting if in doubt. The final judgement of the design and its fitness for use rests with the designer; substitutions and deviations proceed only with approval.</span></div>'
            '</div><p class="en-note" style="margin-top:22px">The quotation tool, privacy policy and terms are available in Korean only. Korean-speaking colleagues can use the '
            '<a href="/#list" lang="ko">Sales inquiry page (Korean)</a>.</p></section>'
            '</div></main>' + footer(info))
    title = "Fasteners for plants in Korea – RFQ in English | Boltnote"
    desc = "Bolts, nuts and studs for plants in Korea. Send your BOM or RFQ in English; quoted in KRW."
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": SITE_URL + "en/", "name": title, "description": desc, "url": SITE_URL + "en/", "inLanguage": "en", "dateModified": SITE_REV,
         "publisher": {"@id": SITE_URL + "#organization"}},
        *org_graph(info)]}
    out = DOCS / "en"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page(title, desc, "en/", body, ld, lang="en", alternates={"ko": "", "en": "en/", "x-default": ""}).replace("</style>", EN_CSS + "</style>", 1), encoding="utf-8")
    print("wrote English page")


if __name__ == "__main__":
    build()
