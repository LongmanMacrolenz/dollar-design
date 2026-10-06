"""Render the brand's HTML share card at its native 1280 × 720 resolution.

Requires Playwright and Chromium. Then run tools/build_all.py to publish assets.
"""
import argparse
import functools
import http.server
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", default="/usr/bin/chromium")
    args = parser.parse_args()
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT / "app" / "brand"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=args.chromium)
            page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
            response = page.goto(f"http://127.0.0.1:{server.server_port}/social.html")
            assert response.status == 200
            page.evaluate("document.fonts.load(\'700 48px \"Gothic A1\"\', \'설비를 잇는 체결부품\')")
            page.evaluate("document.fonts.ready")
            assert page.locator(".logo").evaluate("img => img.complete && img.naturalWidth > 0")
            assert page.evaluate("document.fonts.check(\'700 48px \"Gothic A1\"\', \'설비를 잇는 체결부품\')")
            page.screenshot(path=str(ROOT / "app" / "brand" / "boltnote-social.png"))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    main()
