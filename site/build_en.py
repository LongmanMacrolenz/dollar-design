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

from build_lib import page, site_info, MARK, KAKAO_MARK
from catalog import SITE_URL, table_data, catalog

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
e = html.escape

EN_CSS = """
.en-hero{padding:56px 0 40px;background:#0a0e13;color:#e8ecef}.en-hero .eyebrow{color:#93a0ac}.en-hero h1{color:#fff;font-size:clamp(30px,4.4vw,52px);max-width:900px}
.en-hero p.lead{color:#c3ccd4;max-width:760px;margin:18px 0 0}.en-actions{display:flex;flex-wrap:wrap;gap:12px;margin:26px 0 0;align-items:center}
.en-mail{display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 20px;border-radius:999px;background:#F15A38;color:#10151B;font-weight:800;user-select:all}
.en-actions a.ghost{display:inline-flex;align-items:center;gap:10px;min-height:50px;padding:0 20px;border:1px solid #5A6673;border-radius:999px;color:#F2F3EF;font-weight:800;text-decoration:none}
.en-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.en-grid .box h2{font-size:16px}
.en-steps{counter-reset:s;list-style:none;padding:0;margin:0;display:grid;gap:10px}.en-steps li{counter-increment:s;position:relative;padding:14px 16px 14px 52px;border:1px solid var(--hair-2);border-radius:10px;background:var(--sheet)}
.en-steps li:before{content:counter(s,decimal-leading-zero);position:absolute;left:16px;top:14px;font-weight:800;color:#F15A38}
.en-rfq{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13.5px;background:#edf0f4;padding:18px;border-radius:8px}
.en-note{font-size:13px;color:var(--ink-3)}
@media(max-width:860px){.en-grid{grid-template-columns:minmax(0,1fr)}}
"""


def facts():
    """회신 영업일·경력 연수는 사이트 원본과 같은 값을 쓴다."""
    built = (ROOT / "page.html").read_text(encoding="utf-8")
    plan = re.search(r"sla: '(\w+)'", built).group(1)
    days = int(re.search(r"\b" + re.escape(plan) + r": \{[^}]*?days: (\d+)", built).group(1))
    years = re.search(r"ownerYears: '(\d+)'", built)
    return days, (years.group(1) if years else "")


def header():
    return ('<header><div class="w"><a class="brand" href="/" aria-label="Boltnote home (Korean)">' + MARK + '</a>'
            '<nav class="top" aria-label="Main"><a href="/tables/" lang="ko">규격표 (tables)</a></nav>'
            '<nav class="lang" aria-label="Language"><a href="/" lang="ko" hreflang="ko" title="한국어">KO</a> · <b aria-current="true">EN</b></nav></div></header>')


def footer(info):
    return ('<footer><div class="w"><a class="brand" href="/" aria-label="Boltnote home">' + MARK + '</a>'
            f'<div class="r"><span><b>Boltnote (볼트노트)</b> · fastener quotation and supply, Republic of Korea</span>'
            + (f'<span>Business registration no. {e(info["bizNo"])}</span>' if info["bizNo"] else "") + '</div>'
            f'<div class="r"><span>E-mail {e(info["rfq"])}</span>' + (f'<span>Phone {e(info["tel"])} (weekdays 09:00–18:00 KST)</span>' if info["tel"] else "")
            + '<span>Hosting: Cloudflare, Inc. (USA)</span></div>'
            '<div class="r"><span><a href="/#privacy" lang="ko">개인정보 처리방침 (privacy policy, Korean)</a></span><span><a href="/#terms" lang="ko">이용약관 (terms, Korean)</a></span></div>'
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
    body = (header() + '<main style="padding-top:0"><section class="en-hero"><div class="w">'
            '<p class="eyebrow">BOLTNOTE · INDUSTRIAL FASTENERS · KOREA</p>'
            '<h1>Bolts, nuts and studs for your plant in Korea — quoted in English.</h1>'
            '<p class="lead">Send your BOM or RFQ in English as it is: Excel, PDF, a drawing or a photo. We read every line — standard, size, '
            'grade, coating and documents — and source it from suppliers in Korea. Quotations and tax invoices are issued in Korean won (KRW).</p>'
            f'<div class="en-actions"><span class="en-mail" title="Select to copy">{e(info["rfq"])}</span>{kakao}</div>'
            f'<p class="en-note" style="color:#93a0ac;margin-top:14px">Weekdays 09:00–18:00 KST. Up to 20 lines are quoted within {days} business day{"s" if days > 1 else ""}; for longer lists we tell you the reply date first.</p>'
            '</div></section><div class="w">'
            '<h2 style="font-size:24px;margin-top:40px">Who this is for</h2>'
            '<p>Engineers and buyers at foreign-owned plants, EPC sites and maintenance contractors in Korea who work with English BOMs and '
            'ASTM / ASME / ISO / DIN designations, and who need a Korean supplier that reads them line by line.</p>'
            '<div class="en-grid">'
            '<div class="box"><h2>Metric and inch</h2><p>Hex bolts and nuts, socket screws, washers, threaded rod, pins and rivets in metric sizes; '
            'inch UNC/UNF and 8UN fasteners, including ASTM A193 / A194 / A320 studs with heavy hex nuts for flanged joints.</p></div>'
            '<div class="box"><h2>Read line by line</h2><p>Each line is checked for standard and edition, size and pitch, length basis, grade, coating and '
            'required documents. Missing specifications are collected into one question list instead of being guessed.</p></div>'
            '<div class="box"><h2>Told up front</h2><p>We hold no stock: every order is sourced from suppliers in Korea. Prices and lead times are written only '
            'after the supplier confirms them. Lines we cannot supply are listed with the reason.</p></div></div>'
            '<h2 style="font-size:24px;margin-top:36px">How it works</h2><ol class="en-steps">'
            '<li><b>Send</b> — e-mail the BOM, RFQ, drawing or photo in English. No form to fill in.</li>'
            '<li><b>Line check</b> — a mechanical engineer reads every line against the stated standard and grade.</li>'
            '<li><b>Questions</b> — open points (length basis, coating, certificates …) come back as one list.</li>'
            '<li><b>Quotation</b> — a quotation in KRW with a clarification &amp; deviation sheet and a list of lines that cannot be supplied.</li></ol>'
            '<h2 style="font-size:24px;margin-top:36px">RFQ example</h2><p>Copy it into your own e-mail and replace the brackets. Your existing format is fine too.</p>'
            f'<pre class="en-rfq">{e(rfq)}</pre>'
            '<h2 style="font-size:24px;margin-top:36px">Good to know</h2><ul class="f">'
            '<li>Delivery is within Korea. Quotations, orders and Korean tax invoices are in KRW for companies registered in Korea.</li>'
            '<li>Orders are confirmed by e-mail after the quotation; nothing is ordered automatically from this website.</li>'
            '<li>Mill certificates and other documents are quoted only when the supplier confirms they can be provided.</li>'
            + (f'<li>One-person business: the owner, a mechanical engineer with {e(years)} years in rotating equipment, reviews every line personally.</li>' if years else '')
            + '</ul>'
            f'<h2 style="font-size:24px;margin-top:36px">Dimension tables</h2><p>{n_tables} fastener dimension tables (hex bolts and nuts, socket screws, washers, pins, rings …) '
            'with the basis of each table stated. Labels are in Korean; sizes and values are in mm or inch as in the standard.</p>'
            '<p><a class="cta" href="/tables/">Open the dimension tables →</a></p>'
            '<p class="en-note" style="margin-top:28px">The rest of this website is in Korean. Korean-speaking colleagues can use the '
            '<a href="/#list" lang="ko">Sales inquiry page (Korean)</a> or the <a href="/products/" lang="ko">product guides (Korean)</a>.</p>'
            '</div></main>' + footer(info))
    title = "Fasteners for plants in Korea – RFQ in English | Boltnote"
    desc = "Bolts, nuts and studs for plants in Korea. Send your BOM or RFQ in English; quoted in KRW."
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": SITE_URL + "en/", "name": title, "description": desc, "url": SITE_URL + "en/", "inLanguage": "en",
         "publisher": {"@id": SITE_URL + "#organization"}},
        {"@type": "Organization", "@id": SITE_URL + "#organization", "name": "볼트노트", "alternateName": "Boltnote", "url": SITE_URL,
         "logo": SITE_URL + "brand/boltnote-mark.svg"}]}
    out = DOCS / "en"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page(title, desc, "en/", body, ld, lang="en", alternates={"ko": "", "en": "en/", "x-default": ""}).replace("</style>", EN_CSS + "</style>", 1), encoding="utf-8")
    print("wrote English page")


if __name__ == "__main__":
    build()
