"""T2 치수표(공개 자료 3곳 이상 일치, 규격서 원문 대조 전)를 카탈로그에 반영한다.

    python3 tools/t2/apply.py            tools/t2/records/*.json → app/src/ea_catdata.js 의 해당 품목 dims 로 쓴다
    python3 tools/t2/apply.py --check    카탈로그의 T2 표가 기록과 같은지만 확인한다 (파일은 쓰지 않음)

기록(records/<품목군 id>.json)은 조사 결과 그대로다: 표(cols·rows), 호칭마다 일치한 출처 수(row_support), 쓴 페이지(sources),
버린 행(dropped), 검산(checks), 도면 설명(shape_hint·role_map). 규칙은 app/SOURCE_RULE.md 의 T2.
이 스크립트는 기록이 규칙을 지켰는지 다시 검사하고(출처 3곳 이상·서로 다른 사이트·숫자만·빈 칸 없음), 어기면 반영하지 않는다.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CAT = ROOT / "app" / "src" / "ea_catdata.js"
REC = pathlib.Path(__file__).resolve().parent / "records"
FRAC = re.compile(r"^\d+(?:-\d+/\d+|/\d+)?$")


def load_records():
    out = {}
    for p in sorted(REC.glob("*.json")):
        r = json.loads(p.read_text(encoding="utf-8"))
        if r.get("id") != p.stem:
            raise SystemExit(f"{p.name}: id가 파일 이름과 다릅니다")
        out[r["id"]] = r
    return out


def validate(r):
    """기록이 T2 규칙을 지켰는지 검사한다. 문제 목록을 돌려준다 (빈 목록이면 통과)."""
    e = []
    if r.get("status") not in ("ok", "partial"):
        return ["status가 ok/partial이 아님"]
    cols, rows = r.get("cols") or [], r.get("rows") or []
    if not rows:
        e.append("rows가 비었습니다")
    if r.get("u") not in ("mm", "in"):
        e.append("u는 mm 또는 in")
    keys = [c[0] for c in cols]
    if len(set(keys)) != len(keys) or not (1 <= len(keys) <= 18):
        e.append("cols 키가 겹치거나 18개를 넘습니다")
    if any(not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", k) for k in keys):
        e.append("cols 키는 영문·숫자·_ 만")
    sup = r.get("row_support") or {}
    seen = set()
    for row in rows:
        if len(row) != len(cols) + 1:
            e.append(f"{row[0]!r}: 칸 수가 cols와 다릅니다")
            continue
        if not isinstance(row[0], str) or not row[0]:
            e.append(f"{row!r}: 첫 칸(호칭)이 글자가 아닙니다")
            continue
        if row[0] in seen:
            e.append(f"{row[0]!r}: 호칭이 겹칩니다")
        seen.add(row[0])
        for v in row[1:]:
            ok = (isinstance(v, (int, float)) and not isinstance(v, bool)) or (isinstance(v, str) and FRAC.match(v))
            if not ok:
                e.append(f"{row[0]}: 숫자·분수가 아닌 칸 {v!r}")
        if int(sup.get(row[0], 0)) < 3:
            e.append(f"{row[0]}: 일치한 출처가 3곳 미만")
    srcs = r.get("sources") or []
    if len({s.get("site") for s in srcs if s.get("site")}) < 3:
        e.append("서로 다른 사이트 출처가 3곳 미만")
    # 검증 담당이 서로 베낀 사이트를 묶은 결과(clusters)가 있으면, 묶음 기준으로도 3곳 이상이어야 한다
    if r.get("clusters") is not None and len(r["clusters"]) < 3:
        e.append("서로 독립된 출처 묶음이 3곳 미만")
    if r.get("clusters") is not None and int((r.get("verification") or {}).get("cell_support_min", 0)) < 3:
        e.append("검증된 최소 일치 출처가 3곳 미만")
    for k in ("standard", "shape_hint", "role_map"):
        if not r.get(k):
            e.append(f"{k}가 비었습니다")
    return e


def to_dims(r):
    d = {"u": r["u"], "basis": "T2", "cols": r["cols"], "rows": r["rows"]}
    return d


def main():
    check = "--check" in sys.argv
    recs = load_records()
    lines = CAT.read_text(encoding="utf-8").split("\n")
    i = next(k for k, l in enumerate(lines) if l.startswith("const CAT_F = "))
    s = lines[i]
    dec = json.JSONDecoder()
    bad, changed = [], []
    for fid, r in recs.items():
        errs = validate(r)
        if errs:
            bad.append((fid, errs))
            continue
        key = f'"{fid}":'
        m = s.find(key + '{"id":"' + fid + '"')
        if m < 0:
            bad.append((fid, ["카탈로그에 품목군이 없습니다"]))
            continue
        a = m + len(key)
        obj, end = dec.raw_decode(s, a)
        if obj.get("route"):
            bad.append((fid, ["기존 장(route)이 있는 품목은 대상이 아닙니다"]))
            continue
        new = dict(obj)
        new["p"] = "A"
        new["dims"] = to_dims(r)
        new.pop("dimsHeld", None)
        if new == obj:
            continue
        changed.append(fid)
        s = s[:a] + json.dumps(new, ensure_ascii=False, separators=(",", ":")) + s[end:]
    for fid, errs in bad:
        print(f"반영 안 함 {fid}: " + "; ".join(errs[:4]))
    if check:
        print(f"T2 기록 {len(recs)}건 · 카탈로그와 다른 것 {len(changed)}건 · 규칙 위반 {len(bad)}건" + (f" — 다름: {' '.join(changed)}" if changed else ""))
        return 1 if (changed or bad) else 0
    lines[i] = s
    CAT.write_text("\n".join(lines), encoding="utf-8")
    print(f"T2 기록 {len(recs)}건 → 카탈로그 {len(changed)}건 갱신 · 규칙 위반으로 건너뜀 {len(bad)}건")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
