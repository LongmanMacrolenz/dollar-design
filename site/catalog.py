"""Read the public catalog's JSON declarations without executing application JS."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SITE_URL = "https://boltnote.boltnote.workers.dev/"
HOME_TITLE = "볼트·너트 구매·BOM 견적 | 볼트노트"
HOME_DESC = "산업설비 볼트·너트 구매와 BOM 견적. 미터·인치, ASTM 스터드·헤비너트의 사양과 서류를 확인합니다."
# 링크를 공유할 때 뜨는 그림(og:image), 1280×720. 원본은 app/brand/social.html → python3 tools/render_brand.py.
# 카카오톡은 그림 주소가 같으면 예전에 만들어 둔 미리보기 그림을 계속 쓴다. 그림을 바꾸면 파일 이름은 두고 ?v= 숫자만 올린다.
SOCIAL_IMAGE = "brand/boltnote-social.png?v=5"
SOCIAL_NOTE = "참고용 렌더링 · 실제 제품 사진 아님"


def brand_copy():
    """홈 조임 장면의 문구와 글자 굵기를 app/src/v9_tighten.js(BN_TIGHTEN)에서 읽는다. 정적 첫 화면·정적 페이지·공유 그림이 같은 문구를 쓴다."""
    source = (ROOT.parent / "app/src/v9_tighten.js").read_text(encoding="utf-8")
    block = re.search(r"const BN_TIGHTEN\s*=\s*\{(.*?)\};", source, re.S)
    found = block and {
        "h1": re.search(r"h1:\s*\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]", block.group(1)),
        "stamp": re.search(r"stamp:\s*'([^']+)'", block.group(1)),
        "lead": re.search(r"lead:\s*'([^']+)'", block.group(1)),
        "w0": re.search(r"\bw0:\s*(\d+)", block.group(1)),
        "w1": re.search(r"\bw1:\s*(\d+)", block.group(1)),
    }
    if not found or not all(found.values()):
        raise ValueError("BN_TIGHTEN copy (h1, stamp, lead, w0, w1) not found in app/src/v9_tighten.js")
    return {"h1": list(found["h1"].groups()), "stamp": found["stamp"].group(1), "lead": found["lead"].group(1),
            "w0": int(found["w0"].group(1)), "w1": int(found["w1"].group(1))}


def display_font_href(text):
    """제목 글꼴(Hahmlet)을 주어진 글자만 담아 요청하는 Google Fonts 주소. 화면의 bnHomeFontInit과 같은 형식."""
    from urllib.parse import quote
    chars = "".join(sorted(set("".join(text.split()))))
    return "https://fonts.googleapis.com/css2?family=Hahmlet:wght@100..900&display=swap&text=" + quote(chars)


def declaration(path, name):
    source = path.read_text(encoding="utf-8")
    match = re.search(r"const " + re.escape(name) + r"\s*=\s*", source)
    if not match:
        raise ValueError(f"Missing JSON declaration: {name}")
    return json.JSONDecoder().raw_decode(source[match.end():])[0]


def catalog():
    source = ROOT.parent / "app/src/ea_catdata.js"
    families = declaration(source, "CAT_F")
    tiles = declaration(source, "CAT_TILES")
    paths = json.loads((ROOT / "product-paths.json").read_text(encoding="utf-8"))
    if set(paths) != set(families) or len(set(paths.values())) != len(paths):
        raise ValueError("Product paths must cover the catalog exactly, without duplicates")
    if any(not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", p) for p in paths.values()):
        raise ValueError("Invalid product path")
    return families, tiles, paths


def product_path(id):
    paths = json.loads((ROOT / "product-paths.json").read_text(encoding="utf-8"))
    return "/products/" + paths[id]


def product_urls():
    families, tiles, paths = catalog()
    return ([SITE_URL + "products/"]
            + [SITE_URL + "products/category/" + t["id"] for t in tiles]
            + [SITE_URL + "products/" + paths[id] for id in families])


# ── 규격표 (정적 치수표 페이지: site/build_tables.py → docs/tables/) ──────────────────────────────
# 검색에 내놓는 표는 근거 기록이 저장소에 있는 것만이다 (app/SOURCE_RULE.md):
#   (a) dims.basis == 'T2' 이고 tools/t2/records/<id>.json 기록이 있는 품목
#   (b) 미터 핵심 품목: 값은 app/base.html의 const DIM, 근거는 그 아래 출처 주석
# 표시 없는 "원문 대조 행" 표와 기록 없는 T2 표는 대상이 아니다 (근거를 다시 확인해 기록을 남긴 뒤에 더한다).
T2_NOTE = "제조·유통사 공개 기술자료 3곳 이상 대조 (규격서 원문 대조 전)"   # app/SOURCE_RULE.md가 정한 문구
T1_NOTE = "발행 기관 공식 미리보기 대조"
# 칸 구성은 품목 장(app/base.html V.family)이 보이는 값과 같다. (DIM 키, 칸 기호, 칸 이름)
# proof: DIM 출처 주석에 그대로 있어야 하는 글자. 주석의 판(edition)이 바뀌면 여기서 빌드가 멈춘다.
TABLE_CORE = {
    "hbf": {"standard": "ISO 4017:2022", "note": T1_NOTE, "proof": ["pitch·hexS·hexK = ISO 4017:2022", "iteh 미리보기 대조"], "din": "DIN 933",
            "cols": [("pitch", "P", "피치 P (보통 나사)"), ("hexS", "s", "2면폭 s"), ("hexK", "k", "머리 높이 k")]},
    "scs": {"standard": "ISO 4762:2004 (M14 이상은 1997판)", "note": T1_NOTE, "proof": ["scs = ISO 4762:2004(M3–M12)·1997(M14–M24)", "iteh 미리보기 대조"],
            "cols": [("pitch", "P", "피치 P (보통 나사)"), ("scsDk", "dk", "머리 지름 dk"), ("scsK", "k", "머리 높이 k"), ("scsS", "s", "육각 구멍 2면폭 s")]},
    "csk": {"standard": "ISO 10642:2004", "note": T1_NOTE, "proof": ["csk = ISO 10642:2004", "iteh 미리보기 대조"],
            "cols": [("pitch", "P", "피치 P (보통 나사)"), ("cskDk", "dk", "머리 지름 dk (이론값)"), ("cskS", "s", "육각 구멍 2면폭 s")]},
    "hn": {"standard": "ISO 4032:2023 (M3·M4는 2012판)", "note": T1_NOTE, "proof": ["nutM = ISO 4032:2023(M3·M4는 2012)", "iteh 미리보기 대조"], "din": "DIN 934",
           "cols": [("pitch", "P", "피치 P (보통 나사)"), ("hexS", "s", "2면폭 s"), ("nutM", "m", "높이 m")]},
    "pw": {"standard": "ISO 7089:2000", "note": T1_NOTE, "proof": ["pw = ISO 7089:2000", "iteh 미리보기 대조"],
           "cols": [("pwD1", "d1", "안지름 d1"), ("pwD2", "d2", "바깥지름 d2"), ("pwH", "h", "두께 h")]},
    "sw": {"standard": "DIN 127 B", "note": T2_NOTE, "proof": ["sw(DIN 127 B, 폐지)는 제조사 표 3곳 일치"],
           "cols": [("swD1", "d1", "안지름 d1"), ("swD2", "d2", "바깥지름 d2"), ("swS", "s", "두께 s")]},
}
TABLE_ALIAS = {"hbp": "hbf"}   # 반나사 육각볼트의 머리 치수는 온나사와 같은 표를 본다 (품목 장도 같은 값을 보인다)


def core_dim():
    """app/base.html의 const DIM과 바로 아래 출처 주석을 읽는다 (JS를 실행하지 않는다). → ({키: {호칭: 값}}, 주석)"""
    source = (ROOT.parent / "app/base.html").read_text(encoding="utf-8")
    block = re.search(r"\nconst DIM = \{\n(.*?)\n\};\n((?://[^\n]*\n)+)", source, re.S)
    if not block:
        raise ValueError("const DIM and its source comment not found in app/base.html")
    dim = {key: {size: (int(v) if re.fullmatch(r"\d+", v) else float(v)) for size, v in re.findall(r"(M\d+):\s*(\d*\.?\d+)", body)}
           for key, body in re.findall(r"^\s*(\w+):\s*\{([^}]*)\}", block.group(1), re.M)}
    return dim, block.group(2)


def table_data():
    """규격표로 올릴 품목 → 표. {id: {u, standard, note, basis, cols[(기호, 이름)], rows[[호칭, 값…]], scope, extra}}"""
    families, tiles, paths = catalog()
    records = {p.stem for p in (ROOT.parent / "tools/t2/records").glob("*.json")}
    out = {}
    for id, f in families.items():
        d = f.get("dims") or {}
        if d.get("basis") == "T2" and id in records:
            if f.get("route") or not d.get("standard") or any(v is None for row in d["rows"] for v in row):
                raise ValueError(f"T2 table is not publishable as recorded: {id}")
            out[id] = {"u": d["u"], "standard": d["standard"], "note": T2_NOTE, "basis": "T2", "cols": [tuple(c) for c in d["cols"]],
                       "rows": d["rows"], "scope": d.get("scope", ""), "extra": ""}
    dim, comment = core_dim()
    for id, spec in TABLE_CORE.items():
        missing = [x for x in spec["proof"] if x not in comment]
        if missing or id not in families or id in out:
            raise ValueError(f"Core table {id}: source comment in app/base.html no longer says {missing}")
        keys = [k for k, _, _ in spec["cols"]]
        sizes = [size for size in dim[keys[0]] if all(size in dim[k] for k in keys)]   # 모든 칸에 값이 있는 호칭만
        extra = []
        if spec.get("din"):   # DIN 933·934는 몇 호칭에서 2면폭이 다르다 (값은 제조사 표 3곳 일치 = T2)
            extra.append(f'{spec["din"]} 2면폭이 다른 호칭: ' + " · ".join(f"{size} {dim['dinS'][size]:g} mm" for size in dim["dinS"]) + f" — {T2_NOTE}.")
        out[id] = {"u": "mm", "standard": spec["standard"], "note": spec["note"], "basis": "T2" if spec["note"] == T2_NOTE else "T1",
                   "cols": [(sym, label) for _, sym, label in spec["cols"]], "rows": [[size] + [dim[k][size] for k in keys] for size in sizes],
                   "scope": "", "extra": " ".join(extra)}
    order = [id for id in families if id in out]
    return {id: out[id] for id in order}


def table_name(f):
    """규격표 제목에 쓰는 품목 이름. 짧은 이름이 있으면 그것을, 한 글자뿐이면(예: '별') 원래 이름을 쓴다."""
    short = f.get("short") or ""
    return short if len(short) >= 2 else f["ko"]


def table_path(id):
    """품목의 규격표 주소 (없으면 None). 주소는 제품 안내와 같은 고정 경로를 쓴다."""
    paths = json.loads((ROOT / "product-paths.json").read_text(encoding="utf-8"))
    target = TABLE_ALIAS.get(id, id)
    return "/tables/" + paths[target] if target in table_data() else None


def table_urls():
    paths = json.loads((ROOT / "product-paths.json").read_text(encoding="utf-8"))
    return [SITE_URL + "tables/"] + [SITE_URL + "tables/" + paths[id] for id in table_data()]


def public_label(value):
    # Old catalog annotations refer to UI implementation, not purchasing terms.
    return (str(value).replace(" (치수 일부 다름, 아래 ksAnnex)", " (치수 일부 다름)")
            .replace("— ksAnnex", "— 규격별 맞변 차이 확인").replace("(사이트키)", ""))


def compact_description(text, limit=80):
    """An excerpt affects metadata only; the complete source remains in the body."""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    excerpt = text[:limit - 1]
    stop = max(excerpt.rfind(". "), excerpt.rfind("。"))
    if stop >= 30:
        return excerpt[:stop + 1]
    stop = excerpt.rfind(" ")
    return (excerpt[:stop] if stop >= 30 else excerpt) + "…"
