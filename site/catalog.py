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
SOCIAL_IMAGE = "brand/boltnote-social.png?v=2"
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
