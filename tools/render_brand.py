"""Render the brand's HTML share card at its native 1280 × 720 resolution.

The card (app/brand/social.html) uses the home headline, the display face Hahmlet and the
tightening-scene poster (docs/media/boltnote-tighten-poster.webp), so the repository root is served.
Requires Playwright, Chromium and network access to Google Fonts: a card drawn with fallback fonts
is refused. Then run tools/build_all.py to publish assets, and raise ?v= in site/catalog.py SOCIAL_IMAGE
so that messengers which cache the preview by its address (KakaoTalk) fetch the new picture.
"""
import argparse
import functools
import http.server
import os
from pathlib import Path
import sys
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "site"))
from catalog import brand_copy, SOCIAL_NOTE  # noqa: E402

FACES = {"Hahmlet 200", "Hahmlet 700", "Hahmlet 800", "Gothic A1 500"}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", default=os.environ.get("BN_CHROMIUM"), help="Chromium executable (default: the one Playwright installed)")
    args = parser.parse_args()
    copy = brand_copy()
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.chromium or None, args=["--no-sandbox"])
            page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
            response = page.goto(f"http://127.0.0.1:{server.server_port}/app/brand/social.html", wait_until="networkidle")
            assert response.status == 200
            text = page.locator("main").inner_text()
            for part in (*copy["h1"], copy["stamp"], copy["lead"], SOCIAL_NOTE):
                assert part in text, f"share card copy differs from the home: {part}"
            page.evaluate("""([a, b, c]) => Promise.all([document.fonts.load('200 70px "Hahmlet"', a), document.fonts.load('800 70px "Hahmlet"', b),
                document.fonts.load('700 32px "Hahmlet"', c), document.fonts.load('500 20px "Gothic A1"', '체결부품')])""", [*copy["h1"], copy["stamp"]])
            page.evaluate("document.fonts.ready")
            loaded = set(page.evaluate("[...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/[\"']/g, '') + ' ' + f.weight)"))
            assert FACES <= loaded, f"fonts not loaded: {sorted(FACES - loaded)}"
            assert page.locator(".logo").evaluate("img => img.complete && img.naturalWidth > 0")
            assert page.locator(".scene").evaluate("img => img.complete && img.naturalWidth === 1600"), "poster missing"
            page.screenshot(path=str(ROOT / "app" / "brand" / "boltnote-social.png"))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
