"""볼트노트 1쪽 소개서(A4 PDF)를 만든다 → app/brand/boltnote-intro.pdf (tools/build_all.py가 docs/brand/로 복사한다).

영업에서 "보내도 된다"고 한 곳에 첨부하는 자료다 (대표 요청 2026-11-10). 사이트에 이미 적힌 말만 쓴다:
- 문구: app/src/v9_tighten.js BN_TIGHTEN(헤드라인·보조 문구), app/src/v7_ia.js PM_STEPS(하는 일 4단계)
- 연락처·사업자 정보: site/page.html (site_info). 자택 주소는 적지 않는다.
재고·가격·납기 약속, 실적·후기·인증을 적지 않는다. 문구가 바뀌면 이 도구를 다시 돌린다 (사이트 빌드·CI에서는 돌리지 않는다).

사용:  python3 tools/build_all.py && python3 tools/render_intro.py
필요:  Playwright와 Chromium, Google Fonts 접속 (글꼴을 받지 못하면 만들지 않는다)
"""
import argparse
import datetime
import functools
import html
import http.server
import os
from pathlib import Path
import re
import sys
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "site"))
from catalog import brand_copy, SITE_URL  # noqa: E402
from build_lib import site_info  # noqa: E402

OUT = ROOT / "app" / "brand" / "boltnote-intro.pdf"
FACES = {"Hahmlet 200", "Hahmlet 800", "Gothic A1 400", "Gothic A1 700"}
e = html.escape


def steps():
    """사이트의 '하는 일' 4단계 (PM_STEPS)를 그대로 읽는다."""
    source = (ROOT / "app/src/v7_ia.js").read_text(encoding="utf-8")
    block = re.search(r"const PM_STEPS = \[(.*?)\n\];", source, re.S)
    rows = re.findall(r"\['([^']+)',\s*'([^']+)'\]", block.group(1)) if block else []
    if len(rows) != 4:
        raise ValueError("PM_STEPS (4 steps) not found in app/src/v7_ia.js")
    return rows


def quote_days():
    """20줄 이하 견적 회신 영업일 (SHOP.sla가 가리키는 SLA_COPY 항목의 days). 사이트와 같은 값을 쓴다."""
    built = (ROOT / "site/page.html").read_text(encoding="utf-8")
    plan = re.search(r"sla: '(\w+)'", built)
    days = plan and re.search(r"\b" + re.escape(plan.group(1)) + r": \{[^}]*?days: (\d+)", built)
    if not days:
        raise ValueError("SLA days not found in site/page.html (run tools/build_all.py first)")
    return int(days.group(1))


def page_html(month: str) -> str:
    copy, info = brand_copy(), site_info()
    assert info["rfq"] and info["owner"] and info["bizNo"], "contact details missing in site/page.html"
    kakao = f'<li><b>카카오톡</b><span>채널 「{e(info["kakao"] or "볼트노트")}」 · {e(info["kakaoHours"])}</span></li>' if info["kakaoChat"] else ""
    tel = f'<li><b>전화</b><span>{e(info["tel"])}{" · " + e(info["telHours"]) if info["telHours"] else ""}</span></li>' if info["tel"] else ""
    site = SITE_URL.replace("https://", "").rstrip("/")
    step_html = "".join(f'<li><i>{i + 1:02d}</i><div><b>{e(t)}</b><p>{e(d)}</p></div></li>' for i, (t, d) in enumerate(steps()))
    return f"""<!doctype html>
<html lang="ko"><meta charset="utf-8"><title>볼트노트 소개</title>
<link href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;800&family=Hahmlet:wght@200;800&display=swap" rel="stylesheet">
<style>
@page{{size:A4;margin:0}}*{{box-sizing:border-box}}
body{{position:relative;overflow:hidden;word-break:keep-all;margin:0;width:210mm;height:297mm;font-family:'Gothic A1',sans-serif;color:#17202b;background:#fbfaf7;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.top{{height:90mm;padding:15mm 17mm 0;background:#0a0e13;color:#fff;position:relative;overflow:hidden}}
.top::after{{content:"";position:absolute;right:-22mm;bottom:-30mm;width:120mm;height:120mm;background:url(boltnote-mark.svg) center/contain no-repeat;opacity:.08}}
.bar{{display:flex;justify-content:space-between;align-items:center}}.bar img{{width:44mm}}.bar span{{font-size:9.5pt;letter-spacing:.08em;color:#aeb9c4}}
h1{{margin:16mm 0 0;font-family:'Hahmlet',serif;font-size:31pt;line-height:1.2;font-weight:800;letter-spacing:-.025em}}h1 span{{display:block;font-weight:200;letter-spacing:-.03em}}
.rule{{width:34mm;height:1.6mm;margin:5mm 0 4mm;background:#f15a38}}.lead{{margin:0;font-size:12pt;color:#d5dbe0}}
main{{display:grid;grid-template-columns:1.06fr .94fr;gap:11mm;padding:10mm 17mm 0}}
h2{{margin:0 0 4mm;font-size:9pt;letter-spacing:.14em;color:#f15a38;font-weight:800}}
ol,ul{{list-style:none;margin:0;padding:0}}
.steps li{{display:flex;gap:4.5mm;padding:3.6mm 0;border-top:.25mm solid #dcd8cc}}.steps li:last-child{{border-bottom:.25mm solid #dcd8cc}}
.steps i{{font-style:normal;font-size:9pt;font-weight:800;color:#f15a38;padding-top:.6mm}}.steps b{{font-size:12pt}}.steps p{{margin:1.4mm 0 0;font-size:9.6pt;line-height:1.62;color:#48566a}}
.box{{margin-bottom:8mm}}.items{{display:flex;flex-wrap:wrap;gap:2mm}}.items li{{padding:1.6mm 3.4mm;border:.25mm solid #c9c4b6;border-radius:99mm;font-size:9.6pt;font-weight:700;background:#fff}}
.note{{margin:3.2mm 0 0;font-size:9.4pt;line-height:1.62;color:#48566a}}
.plain li{{position:relative;padding:0 0 2.4mm 4.4mm;font-size:9.8pt;line-height:1.6}}.plain li::before{{content:"";position:absolute;left:0;top:2.3mm;width:1.5mm;height:1.5mm;background:#f15a38}}
.who{{font-size:9.8pt;line-height:1.65;color:#17202b}}
footer{{position:absolute;left:17mm;right:17mm;bottom:13mm;padding:6mm 7mm 5.5mm;border-radius:2.4mm;background:#0a0e13;color:#fff;display:grid;grid-template-columns:1.1fr .9fr;gap:1mm 8mm}}
footer h2{{grid-column:1/-1;margin-bottom:2.4mm}}footer li{{display:flex;gap:3.5mm;font-size:9.8pt;line-height:1.75}}footer b{{flex:none;width:15mm;color:#aeb9c4;font-weight:500}}footer span{{font-weight:700;white-space:nowrap}}
footer p{{grid-column:1/-1;margin:3mm 0 0;padding-top:3mm;border-top:.25mm solid #2b3743;font-size:8.4pt;color:#93a0ac}}
</style>
<body>
<section class="top"><div class="bar"><img class="logo" src="boltnote-logo-light.svg" alt="boltnote"><span>체결부품 견적·공급</span></div>
<h1><span>{e(copy["h1"][0])}</span>{e(copy["h1"][1])}</h1><div class="rule"></div><p class="lead">{e(copy["lead"])} 기존 자료를 그대로 보내 주세요.</p></section>
<main><div><h2>하는 일</h2><ol class="steps">{step_html}</ol></div>
<div><div class="box"><h2>다루는 품목</h2><ul class="items"><li>볼트·나사</li><li>너트</li><li>와셔</li><li>스터드볼트</li><li>핀</li><li>리벳</li></ul>
<p class="note">미터·인치를 함께 봅니다. ASTM 스터드·헤비너트처럼 사양과 서류가 붙는 건은 조건을 먼저 확인합니다.</p></div>
<div class="box"><h2>미리 말씀드립니다</h2><ul class="plain"><li>재고를 두지 않고 주문마다 국내 공급처에서 조달합니다.</li><li>단가와 납기는 공급처 회신을 받은 뒤에 적습니다.</li><li>20줄 이하는 {quote_days()}영업일 안에 견적합니다.</li><li>공급이 어려운 줄은 사유와 함께 알려 드립니다.</li></ul></div>
<div class="box"><h2>운영</h2><p class="who">혼자 운영합니다. 그래서 모든 견적 줄을 대표가 직접 봅니다.</p></div></div></main>
<footer><h2>자료 보내실 곳</h2><ul><li><b>메일</b><span>{e(info["rfq"])}</span></li>{kakao}</ul><ul>{tel}<li><b>사이트</b><span>{e(site)}</span></li></ul>
<p>상호 볼트노트 · 대표 {e(info["owner"])} · 사업자등록번호 {e(info["bizNo"])} · {e(month)} 기준</p></footer>
</body></html>"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--chromium", default=os.environ.get("BN_CHROMIUM"), help="Chromium executable (default: the one Playwright installed)")
    parser.add_argument("--month", default=datetime.date.today().strftime("%Y-%m"), help="문서에 적는 기준 달 (YYYY-MM)")
    args = parser.parse_args()
    page_file = ROOT / "app" / "brand" / ".intro.html"
    page_file.write_text(page_html(args.month), encoding="utf-8")
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT / "app" / "brand")))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.chromium or None, args=["--no-sandbox"])
            page = browser.new_page()
            assert page.goto(f"http://127.0.0.1:{server.server_port}/.intro.html", wait_until="networkidle").status == 200
            page.evaluate("""Promise.all([document.fonts.load('200 31pt "Hahmlet"', '작은'), document.fonts.load('800 31pt "Hahmlet"', '전부'),
                document.fonts.load('400 10pt "Gothic A1"', '견적'), document.fonts.load('700 10pt "Gothic A1"', '견적')])""")
            page.evaluate("document.fonts.ready")
            loaded = set(page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/[\"']/g, '') + ' ' + f.weight)"))
            assert FACES <= loaded, f"fonts not loaded: {sorted(FACES - loaded)}"
            assert page.locator(".logo").evaluate("img => img.complete && img.naturalWidth > 0")
            assert page.evaluate("document.body.scrollHeight <= document.body.clientHeight + 1"), "content does not fit on one A4 page"
            # 본문이 아래 연락처 상자와 겹치지 않고(8 px 이상 떨어짐), 연락처 한 줄이 상자 밖으로 넘치지 않는다
            fit = page.evaluate("""() => { const box = document.querySelector('footer').getBoundingClientRect();
                return { gap: Math.round(box.top - Math.max(...[...document.querySelectorAll('main > div')].map(d => d.lastElementChild.getBoundingClientRect().bottom))),
                  room: Math.round(Math.min(...[...document.querySelectorAll('footer li')].map(li => li.getBoundingClientRect().right - li.querySelector('span').getBoundingClientRect().right))) }; }""")
            assert fit["gap"] >= 8 and fit["room"] >= 0, f"intro layout: text overlaps or overflows the contact box {fit}"
            page.pdf(path=str(OUT), format="A4", print_background=True, prefer_css_page_size=True)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        page_file.unlink(missing_ok=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
