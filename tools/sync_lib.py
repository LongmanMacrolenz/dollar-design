"""규격 사전 데이터를 사이트에 반영한다.

    python3 tools/sync_lib.py            site/lib.json을 검사하고 app/src/ea_lib.js를 다시 만든다
    python3 tools/sync_lib.py --check    검사만 하고, ea_lib.js가 lib.json과 맞는지 확인한다 (파일은 쓰지 않음)

규격 사전의 원본은 `site/lib.json`이다 (항목 배열). 항목을 고치거나 더할 때는 lib.json을 고친 뒤 이 스크립트를 돌린다.
이 스크립트가 하는 일:
  1. 항목 규칙을 검사한다 (필수 칸, 종류·기관 값, 길이 제한, 표 모양, 금지어, 연결 id).
  2. 품목군 이름(famko)을 채운다. 새 품목군 id는 이미 lib.json 어딘가에 이름이 있어야 한다.
  3. app/src/ea_lib.js를 만든다 (사이트 안의 #lib).
그 다음 `python3 tools/build_all.py`로 사이트와 정적 페이지(docs/lib)를 만든다.
규칙의 근거와 항목 모양은 app/LIB_SPEC.md에 있다.
"""
import json
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LIB_JSON = ROOT / "site" / "lib.json"
EA_LIB = ROOT / "app" / "src" / "ea_lib.js"
GUIDE_JSON = ROOT / "site" / "lib-guide.json"
EA_GUIDE = ROOT / "app" / "src" / "ea_lib_guide.js"

KINDS = {"std", "grade", "mat", "thread", "concept", "doc", "test", "coat", "part"}
ORGS = {"ASTM", "ASME", "ISO", "EN", "DIN", "KS", "JIS", "SAE", "API", "NACE", "-"}
# 사이트에 쓰면 안 되는 말: 재고·출고 약속, 서비스 약속, 가격. 직장·거래처 이름은 환경 변수 BN_PRIVATE_BANNED('|'로 구분)에서 더한다.
BANNED = re.compile("|".join(
    ["재고 보유", "당일 출고", "저희가 (공급|보유|검사|시험)", "PMI (서비스|해 드|실시)", "보증합니다", "협력사", "바로 공급", "가격", "₩"]
    + [re.escape(x) for x in os.environ.get("BN_PRIVATE_BANNED", "").split("|") if x.strip()]))
HEADER = ("/* 체결부품 규격 사전 데이터 (자동 생성: tools/sync_lib.py · 원본은 site/lib.json). "
          "손으로 고치지 말고 site/lib.json을 고친 뒤 다시 만든다 */\n")


def load():
    return json.loads(LIB_JSON.read_text(encoding="utf-8"))


def validate(entries):
    errs, warns = [], []
    ids = [e.get("id") for e in entries]
    idset = set(ids)
    famko = {}
    for e in entries:
        famko.update(e.get("famko") or {})
    seen = set()
    for e in entries:
        i = e.get("id", "?")
        if i in seen:
            errs.append(f"{i}: id가 겹칩니다")
        seen.add(i)
        for k in ("id", "t", "ko", "kind", "org", "sum", "facts", "src"):
            if not e.get(k):
                errs.append(f"{i}: {k} 칸이 비었습니다")
        if e.get("kind") not in KINDS:
            errs.append(f"{i}: kind {e.get('kind')!r}")
        if e.get("org") not in ORGS:
            errs.append(f"{i}: org {e.get('org')!r}")
        if len(e.get("ko", "")) > 40:
            warns.append(f"{i}: ko {len(e['ko'])}자 (40자 이하)")
        if len(e.get("sum", "")) > 160:
            warns.append(f"{i}: sum {len(e['sum'])}자 (160자 이하)")
        if len(e.get("facts", [])) < 3:
            warns.append(f"{i}: facts {len(e.get('facts', []))}줄 (3줄 이상)")
        txt = json.dumps({k: v for k, v in e.items() if k != "famko"}, ensure_ascii=False)
        m = BANNED.search(txt)
        if m:
            errs.append(f"{i}: 금지어 {m.group(0)!r}")
        for r in e.get("rel", []):
            if r not in idset:
                errs.append(f"{i}: rel {r!r} 항목이 없습니다")
        for f in e.get("fam", []):
            if f not in famko:
                errs.append(f"{i}: 품목군 {f!r}의 이름(famko)이 어느 항목에도 없습니다")
        t = e.get("table")
        if t:
            head = t.get("head", [])
            if not isinstance(t.get("rows"), list) or any(len(r) != len(head) for r in t["rows"]):
                errs.append(f"{i}: 표 줄 길이가 머리글과 다릅니다")
            if len(t.get("rows", [])) > 12:
                warns.append(f"{i}: 표 {len(t['rows'])}줄 (12줄 이하)")
    return errs, warns, famko


def render(entries, famko):
    clean = []
    for e in entries:
        c = {k: v for k, v in e.items() if k != "famko" and v not in (None, "", [], {})}
        clean.append(c)
    body = json.dumps(clean, ensure_ascii=False, separators=(",", ":"))
    return HEADER + "const LIB = " + body + ";\n", clean


def guide_text(entries):
    """One editorial map for the interactive and shareable static library."""
    guide = json.loads(GUIDE_JSON.read_text(encoding="utf-8"))
    ids = {x["id"] for x in entries}
    covered = []
    for group in ("topics", "paths"):
        seen = set()
        for x in guide[group]:
            if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", x["id"]) or x["id"] in seen:
                raise ValueError(f"lib-guide {group}: 잘못되거나 겹친 id {x['id']}")
            seen.add(x["id"])
            if not x.get("title") or not x.get("desc"):
                raise ValueError(f"lib-guide: 제목·설명 누락 {x['id']}")
            refs = x.get("entries", []) + x.get("featured", [])
            for step in x.get("steps", []):
                if not step.get("title") or not step.get("entries"):
                    raise ValueError(f"lib-guide: 빈 읽기 단계 {x['id']}")
                refs += step["entries"]
            if not refs or set(refs) - ids:
                raise ValueError(f"lib-guide: 없는 항목 {x['id']}: {set(refs) - ids}")
            if group == "topics":
                if not set(x["featured"]).issubset(x["entries"]):
                    raise ValueError(f"lib-guide: 주제 밖 추천 항목 {x['id']}")
                covered += x["entries"]
    if set(covered) != ids or len(covered) != len(ids):
        raise ValueError("lib-guide: 모든 항목을 정확히 한 주제에 분류해야 합니다")
    if BANNED.search(json.dumps(guide, ensure_ascii=False)):
        raise ValueError("lib-guide: 금지어")
    return ("/* 자동 생성: tools/sync_lib.py · 원본 site/lib-guide.json */\n"
            + "const LIB_GUIDE = " + json.dumps(guide, ensure_ascii=False, separators=(",", ":")) + ";\n")


def main():
    check = "--check" in sys.argv
    entries = load()
    errs, warns, famko = validate(entries)
    for w in warns:
        print("주의", w)
    for e in errs:
        print("오류", e)
    if errs:
        print(f"{len(entries)}항목 · 오류 {len(errs)}건 — 고친 뒤 다시 실행하세요")
        return 1
    # 품목군 이름 채우기 (새 항목이 fam만 적어도 정적 페이지에 이름이 나오게)
    for e in entries:
        if e.get("fam"):
            e["famko"] = {f: famko[f] for f in e["fam"]}
    text, clean = render(entries, famko)
    try:
        guide = guide_text(entries)
    except (ValueError, KeyError) as error:
        print("오류", error)
        return 1
    if check:
        same = (EA_LIB.exists() and EA_LIB.read_text(encoding="utf-8") == text
                and EA_GUIDE.exists() and EA_GUIDE.read_text(encoding="utf-8") == guide)
        print(f"{len(clean)}항목 · 사전·탐색 데이터 {'맞음' if same else '다름 — python3 tools/sync_lib.py를 실행하세요'}")
        return 0 if same else 1
    EA_LIB.write_text(text, encoding="utf-8")
    EA_GUIDE.write_text(guide, encoding="utf-8")
    LIB_JSON.write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(clean)}항목 → {EA_LIB.relative_to(ROOT)} ({len(text):,}자), famko 채움")
    return 0


if __name__ == "__main__":
    sys.exit(main())
