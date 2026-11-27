"""광고 문의 페이지 → docs/ads/index.html, docs/en/ads/index.html (대표 요청 2026-11-27: 개인사업자 광고를 받아 사이트를 키운다).

실제 방문자 수·클릭 수·단가는 싣지 않는다(확인된 값이 없고, 지어내지 않는다: AGENTS.md 3번). 단가·기간·게재 위치는 문의 뒤 안내한다.
광고는 모두 '광고'로 표시하고, 견적 안내보다 앞에 두지 않고, 팝업·소리·자동 재생·쿠키를 쓰지 않는다(Transition 광고와 같은 규칙, site/tr-ad).
광고주 정보는 그 문의 응대에만 쓴다. 한국어 쪽은 site/build_lib.py의 머리·바닥, 영문 쪽은 site/build_en.py의 머리·바닥을 쓴다.
"""
import html
import pathlib

from build_lib import header, footer, site_info, brand_strip, ad_slot
from build_products import document

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"
e = html.escape
CSS = """
.ads{max-width:820px}.ads h1{font-size:30px;line-height:1.3;margin:10px 0 12px}.ads h2{font-size:21px;margin:34px 0 10px}
.ads p,.ads li{font-size:16px;line-height:1.75}.ads .lead{font-size:17px;color:var(--ink-2)}
.ads-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin:12px 0}.ads-grid .box{margin:0}
.ads-mail{white-space:pre-wrap;overflow-wrap:anywhere;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13.5px;background:#edf0f4;padding:18px;border-radius:8px}
.ads-addr{display:inline-flex;align-items:center;min-height:48px;padding:0 20px;border-radius:999px;background:#F15A38;color:#10151B;font-weight:800;user-select:all}
@media(max-width:700px){.ads-grid{grid-template-columns:minmax(0,1fr)}}@media print{header,footer,.bn-strip{display:none!important}}
"""
KO = {
    "title": "광고 문의 | 볼트노트", "desc": "볼트노트 광고 문의. 체결부품·공구·정비 관련 개인사업자와 소규모 업체의 광고를 받습니다.",
    "crumb": "광고 문의", "eyebrow": "ADVERTISE", "h1": "광고 문의",
    "lead": "볼트노트는 플랜트·설비 정비와 구매 담당자가 볼트·너트·스터드의 규격과 사양을 찾아보는 사이트입니다. 체결부품, 공구, 측정·교정, 소재·가공, 정비 서비스를 하는 개인사업자와 소규모 업체의 광고를 받습니다.",
    "who_h": "이런 분께 맞습니다", "yes_h": "받는 광고", "no_h": "받지 않는 광고",
    "yes": ["산업용 체결부품·소재·가공품, 공구·측정기, 교정·검사 서비스", "설비 정비·시공, 플랜트 부품 공급, 관련 교육·행사", "사업자등록이 있는 개인사업자·소규모 업체"],
    "no": ["도박·성인·대출·투자 권유, 불법·허위 정보", "근거 없는 최고·1위 표현, 인증·후기를 꾸민 문구", "볼트노트가 추천하거나 보증하는 것처럼 보이는 표현"],
    "how_h": "광고는 이렇게 나갑니다", "how": ["광고는 모두 \"광고\"로 표시합니다. 본문이나 견적 안내와 섞이지 않습니다.",
        "견적 문의 안내보다 앞에 두지 않고, 팝업·소리·자동 재생은 쓰지 않습니다.", "이미지와 문구는 광고주가 보내 주시고, 게재 전에 문구를 함께 확인합니다.",
        "게재 위치와 형식은 사이트 안의 광고 자리(페이지 본문 끝, 옆 칸, 바닥 띠 등) 가운데 광고 내용에 맞게 정합니다.", "광고를 누르면 광고주가 정한 주소로 이동합니다. 볼트노트에 직접 싣는 광고는 방문자 정보를 따로 수집하지 않습니다."],
    "price_h": "단가와 기간", "price": "단가, 기간, 게재 위치는 문의 주신 뒤 안내합니다. 방문자 수나 클릭 수 같은 통계는 확인된 값만 말씀드리며, 이 페이지에는 싣지 않습니다.",
    "send_h": "문의 방법", "send_p": "아래 주소로 메일을 보내 주세요. 카카오톡으로도 받습니다. 평일 09:00–18:00에 확인하고 영업일 기준으로 회신합니다.",
    "tpl_h": "메일 예시", "cta": "광고 문의 메일 쓰기는 아래 예시를 복사해 쓰세요.", "priv": "문의에 적어 주신 업체 정보는 그 문의에 답하는 데만 씁니다.",
    "tpl": "제목: [광고 문의] 업체명 · 업종 · 희망 기간\n\n업체명 / 사업자등록 여부:\n담당자 · 연락처:\n광고할 내용(제품·서비스):\n연결할 주소(홈페이지 등):\n희망 시기·기간:\n보유한 이미지·문구:",
    "links": [("/products/", "제품"), ("/lib/", "규격 사전"), ("/notes/", "엔지니어 노트")],
}
EN = {
    "title": "Advertise on Boltnote", "desc": "Advertise on Boltnote. We accept ads from small businesses and sole proprietors in fasteners, tools and plant maintenance.",
    "crumb": "Advertise", "eyebrow": "ADVERTISE", "h1": "Advertise on Boltnote",
    "lead": "Boltnote is a site where plant maintenance engineers and buyers in Korea look up bolt, nut and stud standards and specifications. We accept ads from small businesses and sole proprietors in fasteners, tools, measurement and calibration, materials and machining, and maintenance services.",
    "who_h": "Who it suits", "yes_h": "Ads we accept", "no_h": "Ads we do not accept",
    "yes": ["Industrial fasteners, materials and machined parts, tools and gauges, calibration and inspection services", "Plant maintenance and installation, plant parts supply, related training and events", "Businesses with a business registration, including sole proprietors"],
    "no": ["Gambling, adult content, loans, investment solicitation, illegal or false information", "Unsupported claims such as \"best\" or \"No. 1\", or invented certifications and reviews", "Wording that looks as if Boltnote recommends or guarantees the advertiser"],
    "how_h": "How ads are shown", "how": ["Every ad is labelled \"Ad\" and kept apart from content and the quotation guidance.",
        "Ads never come before the RFQ guidance, and we use no pop-ups, sound or auto-play.", "You send the image and wording, and we check the wording together before it goes live.",
        "Placement and format are chosen from the ad positions on the site (end of the page, side column, bottom strip and so on) to suit the ad.", "A click goes to the address you set. Ads placed directly on Boltnote collect no visitor data."],
    "price_h": "Price and period", "price": "Price, period and placement are given after your inquiry. We quote traffic or click figures only when they are confirmed, and do not publish them on this page.",
    "send_h": "How to inquire", "send_p": "Send an e-mail to the address below. KakaoTalk also works. We check on weekdays 09:00–18:00 KST and reply within business days.",
    "tpl_h": "E-mail example", "cta": "Copy the example below into your own e-mail.", "priv": "Company details in your inquiry are used only to answer that inquiry.",
    "tpl": "Subject: [Ad inquiry] Company · business type · period\n\nCompany / business registration:\nContact person · phone:\nWhat you want to advertise (product or service):\nAddress to link to (website etc.):\nDesired start and period:\nImages and wording you have:",
    "links": [("/en/products/", "Products"), ("/en/lib/", "Glossary"), ("/en/notes/", "Engineer notes")],
}


def body_html(c, info, en):
    items = lambda xs: "<ul>" + "".join(f"<li>{e(x)}</li>" for x in xs) + "</ul>"
    kakao = f'<p><a class="cta" href="{e(info["kakaoChat"])}" target="_blank" rel="noopener noreferrer">KakaoTalk ↗</a></p>' if info.get("kakaoChat") else ""
    return (f'<article class="ads"><p class="eyebrow">{c["eyebrow"]}</p><h1>{e(c["h1"])}</h1><p class="lead">{e(c["lead"])}</p>'
            f'<h2>{e(c["who_h"])}</h2><div class="ads-grid"><div class="box"><h3>{e(c["yes_h"])}</h3>{items(c["yes"])}</div><div class="box"><h3>{e(c["no_h"])}</h3>{items(c["no"])}</div></div>'
            f'<h2>{e(c["how_h"])}</h2>{items(c["how"])}<h2>{e(c["price_h"])}</h2><p>{e(c["price"])}</p>'
            f'<h2>{e(c["send_h"])}</h2><p>{e(c["send_p"])}</p><p><span class="ads-addr" title="Select to copy">{e(info["rfq"])}</span></p>{kakao}'
            f'<h2>{e(c["tpl_h"])}</h2><p>{e(c["cta"])}</p><pre class="ads-mail">{e(c["tpl"])}</pre><p>{e(c["priv"])}</p>'
            + '<p>' + " · ".join(f'<a href="{h}">{e(t)}</a>' for h, t in c["links"]) + '</p></article>')


def build():
    info = site_info()
    from build_en import header as en_header, footer as en_footer
    ko = (header("ads") + f'<main><div class="w"><p class="crumbs"><a href="/">홈</a> › {e(KO["crumb"])}</p>' + body_html(KO, info, False) + "</div></main>"
          + brand_strip(info) + ad_slot("foot") + footer(info))
    en = (en_header("ads") + f'<main><div class="w"><p class="crumbs"><a href="/en/">Home</a> › {e(EN["crumb"])}</p>' + body_html(EN, info, True) + "</div></main>" + en_footer(info))
    for path, c, body, crumbs, lang in (("ads/", KO, ko, [("홈", "/"), (KO["crumb"], "/ads/")], "ko"), ("en/ads/", EN, en, [("Home", "/en/"), (EN["crumb"], "/en/ads/")], "en")):
        out = DOCS / path
        out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(document(c["title"], c["desc"], path, body, crumbs, True, lang=lang).replace("</style>", CSS + "</style>", 1), encoding="utf-8")
    print("wrote ads inquiry page (ko, en)")


def ads_urls():
    from catalog import SITE_URL
    return [SITE_URL + "ads/", SITE_URL + "en/ads/"]


if __name__ == "__main__":
    build()
