"""Validate the built crawlable URL graph, metadata and purchasing entry points."""
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "site"))
from catalog import SITE_URL, HOME_TITLE, HOME_DESC, catalog, product_urls


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
        assert "noindex" not in doc.meta.get("robots", ""), file
        assert doc.ld, f"Missing structured data: {file}"
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
