"""Read the public catalog's JSON declarations without executing application JS."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
SITE_URL = "https://boltnote.boltnote.workers.dev/"
HOME_TITLE = "볼트·너트 구매·BOM 견적 | 볼트노트"
HOME_DESC = "산업설비 볼트·너트 구매와 BOM 견적. 미터·인치, ASTM 스터드·헤비너트의 사양과 서류를 확인합니다."


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
