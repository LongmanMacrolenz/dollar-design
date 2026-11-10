"""Validate the built crawlable URL graph, metadata and purchasing entry points."""
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "site"))
from catalog import SITE_URL, HOME_TITLE, HOME_DESC, SOCIAL_IMAGE, SOCIAL_NOTE, brand_copy, catalog, product_urls
from build_lib import site_info


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.title = ""
        self.h1 = 0
        self.meta = {}
        self.canonical = []
        self.links = []
        self.images = []
        self.ld = []
        self.visible = []
        self.tag = None
        self.script = False
        self.style = False
        self.jsonld = False
        self.buffer = ""
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tag = tag
        if tag == "h1": self.h1 += 1
        if tag == "meta": self.meta[attrs.get("name", attrs.get("property"))] = attrs.get("content", "")
        if tag == "link" and attrs.get("rel") == "canonical": self.canonical.append(attrs["href"])
        if tag == "a": self.links.append(attrs.get("href", ""))
        if tag == "img": self.images.append(attrs.get("src", ""))
        if tag == "style": self.style = True
        if tag == "script":
            self.script = True
            self.jsonld = attrs.get("type") == "application/ld+json"
            self.buffer = ""

    def handle_data(self, data):
        if self.tag == "title": self.title += data
        if self.jsonld: self.buffer += data
        if not self.script and not self.style: self.visible.append(data)

    def handle_endtag(self, tag):
        if tag == "script":
            if self.jsonld: self.ld.append(json.loads(self.buffer))
            self.script = self.jsonld = False
        if tag == "style": self.style = False
        self.tag = None


def resolve(path):
    if path == "/": return ROOT / "docs/index.html"
    target = ROOT / "docs" / path.lstrip("/")
    if path.endswith("/"): return target / "index.html"
    if target.suffix: return target
    return target.with_suffix(".html")


def main():
    files = [ROOT / "docs/index.html", *sorted((ROOT / "docs/lib").glob("*.html")), *sorted((ROOT / "docs/products").rglob("*.html"))]
    urls = [x.text for x in ET.parse(ROOT / "docs/sitemap.xml").findall("{*}url/{*}loc")]
    assert len(urls) == len(set(urls)), "Duplicate sitemap URLs"
    families, tiles, paths = catalog()
    kakao = site_info().get("kakaoChat", "")
    assert len(files) == len(urls), "Sitemap and generated pages disagree"
    canonical = set()
    product_titles = set()
    product_descs = set()
    for file in files:
        source = file.read_text(encoding="utf-8")
        doc = Document(source)
        assert len(doc.canonical) == 1 and doc.canonical[0] in urls, file
        url = doc.canonical[0]
        assert url not in canonical, f"Duplicate canonical: {url}"
        canonical.add(url)
        assert resolve(urlsplit(url).path) == file, (url, file)
        assert doc.h1 == 1 and doc.title.strip(), file
        assert 0 < len(doc.meta["description"]) <= 80, file
        assert doc.meta["og:description"] == doc.meta["description"], file
        assert doc.meta["og:title"] == doc.title, file
        assert doc.meta["og:url"] == url, file
        assert doc.meta["og:image"] == SITE_URL + SOCIAL_IMAGE, file   # 공유 그림 주소는 한 곳(catalog.py)에서만 정한다
        assert "noindex" not in doc.meta.get("robots", ""), file
        assert doc.ld, f"Missing structured data: {file}"
        if file != files[0]:   # 정적 페이지(사전·제품)는 끝의 볼트노트 띠에 문의 길 두 개를 둔다: 사이트 안의 Sales 화면과 카카오톡 채널
            assert "/#list" in doc.links and (not kakao or kakao in doc.links), f"Missing inquiry links: {file}"
        for href in [*doc.links, *doc.images]:
            parsed = urlsplit(href)
            if parsed.scheme or parsed.netloc or not parsed.path: continue
            assert parsed.path.startswith("/"), (file, href)
            assert resolve(parsed.path).exists(), (file, href)
        if "products" in file.parts:
            text = " ".join(doc.visible)
            assert "/#list" in doc.links and "BOM" in text, file
            assert "mailto:" not in " ".join(doc.links), file
            assert "참고용 렌더링 · 실제 제품 사진 아님" in text, file
            assert doc.title not in product_titles and doc.meta["description"] not in product_descs, file
            product_titles.add(doc.title); product_descs.add(doc.meta["description"])
            if file.parent.name == "products" and file.stem != "index":
                id = next(k for k, v in paths.items() if v == file.stem)
                assert families[id]["ko"] in text and families[id]["en"] in text, file
                assert "/#c-" + id in doc.links, file
                assert "공급처 확인 뒤 견적서" in text, file
                assert len(text) > 700, f"Thin product guide: {file}"
    assert canonical == set(urls)
    # 공유 그림: 파일이 있고, 그림 원본(app/brand/social.html)이 홈과 같은 문구와 렌더링 표기를 쓰며, 홈의 그림 설명이 그 문구를 읽는다
    copy, card = brand_copy(), (ROOT / "app/brand/social.html").read_text(encoding="utf-8")
    assert resolve("/" + SOCIAL_IMAGE.split("?")[0]).exists() and "?v=" in SOCIAL_IMAGE, "share image"
    assert all(part in card for part in (*copy["h1"], copy["stamp"], copy["lead"], SOCIAL_NOTE)), "share card copy differs from the home (app/brand/social.html)"
    assert copy["stamp"] in Document(files[0].read_text(encoding="utf-8")).meta["og:image:alt"], "share image alt"
    # 없는 주소 안내(404.html): 검색에 넣지 않고(noindex·표준 주소 없음·사이트맵에 없음), 어느 깊이에서도 링크가 풀리게 루트 주소만 쓴다
    missing = Document((ROOT / "docs/404.html").read_text(encoding="utf-8"))
    assert "noindex" in missing.meta.get("robots", "") and not missing.canonical and "og:url" not in missing.meta, "404 page must stay out of search"
    assert missing.h1 == 1 and missing.title.strip() and not any(urlsplit(u).path in ("/404", "/404.html") for u in urls), "404 page shape"
    assert {"/", "/products/", "/lib/", "/#list"} <= set(missing.links), "404 page links"
    for href in [*missing.links, *missing.images]:
        parsed = urlsplit(href)
        if parsed.scheme or parsed.netloc or not parsed.path: continue
        assert parsed.path.startswith("/") and resolve(parsed.path).exists(), ("docs/404.html", href)
    assert set(product_urls()) <= canonical
    directory = Document((ROOT / "docs/products/index.html").read_text())
    assert {"/products/" + x for x in paths.values()} <= set(directory.links)
    for tile in tiles:
        category = Document((ROOT / f'docs/products/category/{tile["id"]}.html').read_text())
        assert {"/products/" + paths[k] for k, f in families.items() if f["t"] == tile["id"]} <= set(category.links)
    home = Document((ROOT / "docs/index.html").read_text())
    assert home.title == HOME_TITLE and home.meta["description"] == HOME_DESC
    assert "/products/hex-nut" in home.links and "/products/stud-bolt-b7" in home.links
    assert "Disallow: /\n" not in (ROOT / "docs/robots.txt").read_text()
    assert SITE_URL + "sitemap.xml" in (ROOT / "docs/robots.txt").read_text()
    for name, expected in [("googlee7950c29a2b5a35e.html", 53), ("naver873356c1ec7239a24ea882fae7172928.html", 67)]:
        assert len((ROOT / "docs" / name).read_bytes()) == expected, name
    print(f"{len(families)} product guides, {len(tiles)} categories, {len(urls)} canonical URLs: metadata and public links PASS")


if __name__ == "__main__":
    main()
