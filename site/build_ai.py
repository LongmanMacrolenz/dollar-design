"""AI·로봇이 읽는 요약 파일 → docs/llms.txt, docs/llms-full.txt (대표 요청 2026-11-18).

llms.txt는 사이트가 무엇이고 어떤 페이지가 있는지를 마크다운으로 압축한 안내 파일이다 (llmstxt.org 형식).
효과는 보조 수단이다: 구글은 쓰지 않는다고 밝혔고 읽어 가는 AI 서비스도 적다. 만드는 품이 작아 같이 만든다.
쓰는 값은 이미 사이트에 공개된 것뿐이다: 상호, 대표 이름, 분야 경력, 사업자 번호, 견적 메일·전화.
집 주소, 재고·가격·납기 약속, 후기·인증, 회사·출처 사이트 이름, 지어낸 숫자는 넣지 않는다.
llms-full.txt에는 규격표를 마크다운 표로 풀어 싣는다. 값은 site/build_tables.py의 표와 같은 것이다(값을 새로 만들지 않는다).
"""
import json
import pathlib
import re

from build_lib import site_info, CHECKED
from build_tables import basis_line, cell
from catalog import SITE_URL, SITE_REV, catalog, table_data, table_name

ROOT = pathlib.Path(__file__).resolve().parent
DOCS = ROOT.parent / "docs"


def header_block(info, years):
    lines = ["# 볼트노트 (Boltnote)", "",
             "> 산업용 볼트·너트·스터드 등 체결부품의 사양을 검토하고 견적·공급하는 사업자 간(B2B) 거래 사이트. "
             "한국 국내 납품, 견적은 원화(KRW). 규격표·규격 사전·제품 구매 안내를 정적 페이지로 공개한다.", "",
             f"- 운영: 볼트노트, 대표 {info['owner']}" + (f" (기계엔지니어, 회전기기 분야 {years}년)" if years else "") if info["owner"] else "- 운영: 볼트노트",
             ]
    if info["bizNo"]:
        lines.append(f"- 사업자등록번호: {info['bizNo']}")
    lines += [f"- 견적 문의 메일: {info['rfq']}"] + ([f"- 전화: {info['tel']}" + (f" ({info['telHours']})" if info["telHours"] else "")] if info["tel"] else [])
    lines += ["- 재고를 두지 않고 주문마다 국내 공급처에서 조달한다. 단가·납기는 공급처 확인 뒤 견적서에 적는다.",
              "- 규격표는 규격서 원문이 아니다. 공개 자료를 대조한 값을 볼트노트 양식으로 정리한 참고 표이며, 표마다 근거 수준을 적는다.",
              f"- 내용 갱신일: {SITE_REV}. 규격표 대조 시기: {CHECKED}.",
              f"- 인용할 때: '볼트노트 규격표', 해당 페이지 주소, 갱신일을 함께 적는다. 사이트: {SITE_URL}", ""]
    return lines


def build():
    info = site_info()
    t = (ROOT / "page.html").read_text(encoding="utf-8")
    m = re.search(r"ownerYears: '(\d+)'", t)
    years = m.group(1) if m else ""
    families, tiles, paths = catalog()
    tables = table_data()
    library = json.loads((ROOT / "lib.json").read_text(encoding="utf-8"))
    head = header_block(info, years)

    sec = ["## 규격표 (치수표)", ""]
    for id, tb in tables.items():
        f = families[id]
        sec.append(f"- [{table_name(f)} 규격표]({SITE_URL}tables/{paths[id]}): {tb['standard']}, {len(tb['rows'])}개 호칭 {tb['rows'][0][0]}–{tb['rows'][-1][0]}, 단위 {tb['u']}")
    sec += ["", "## 제품 구매 안내", "",
            f"- [제품 안내 전체]({SITE_URL}products/): 품목별 확인 조건과 견적에 필요한 정보"]
    sec += [f"- [{t['ko']}]({SITE_URL}products/category/{t['id']})" for t in tiles]
    sec += ["", "## 규격 사전 (규격·등급·재질·용어)", "", f"- [규격 사전 전체]({SITE_URL}lib/): {len(library)}개 항목"]
    sec += [f"- [{x['t']} {x['ko']}]({SITE_URL}lib/{x['id']})" for x in library if x.get("kind") == "std"][:60]
    from build_notes import load as load_notes   # 엔지니어 노트 (site/build_notes.py)
    notes = load_notes()
    if notes:
        sec += ["", "## 엔지니어 노트 (대표 박세중이 쓴 사양 읽기 글)", "", f"- [엔지니어 노트 전체]({SITE_URL}notes/)"]
        sec += [f"- [{n['title']}]({SITE_URL}notes/{n['slug']}): {n['desc']}" for n in notes]
    sec += ["", "## English (same pages in English)", "", f"- [English home, RFQ in English]({SITE_URL}en/): quoted in KRW for delivery within Korea",
            f"- [Dimension tables]({SITE_URL}en/tables/) · [Product guides]({SITE_URL}en/products/) · [Standards glossary]({SITE_URL}en/lib/): each page has the same path under /en/ (e.g. {SITE_URL}en/tables/<slug>)"]
    sec += ["", "## Optional", "",
            f"- [사이트맵]({SITE_URL}sitemap.xml)", ""]
    (DOCS / "llms.txt").write_text("\n".join(head + sec), encoding="utf-8")

    full = list(head) + ["## 규격표 전문", "",
                         "값은 공개 자료를 대조한 참고 값이다. 표에 없는 칸과 호칭은 추정하지 않았다. 설계·검사·계약에는 적용 규격의 최신판과 도면을 기준으로 한다.", ""]
    for id, tb in tables.items():
        f = families[id]
        cols = ["호칭"] + [f"{sym} {label}" for sym, label in tb["cols"]]
        full += [f"### {table_name(f)} ({f['en']})", "", f"- 주소: {SITE_URL}tables/{paths[id]}", f"- {basis_line(tb)}", "",
                 "| " + " | ".join(cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
        full += ["| " + " | ".join([str(r[0])] + [cell(v) for v in r[1:]]) + " |" for r in tb["rows"]]
        full += [""]
    (DOCS / "llms-full.txt").write_text("\n".join(full), encoding="utf-8")
    print(f"wrote llms.txt ({len(tables)} tables, {len(library)} lib entries) + llms-full.txt")


if __name__ == "__main__":
    build()
