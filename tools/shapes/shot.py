#!/usr/bin/env python3
"""사이트 화면에서 형상 이미지가 제대로 붙는지 스크린샷으로 확인한다 (Playwright 크로미움 필요).

    python tools/shapes/shot.py --out /tmp/shots                         # 대표 몇 곳
    python tools/shapes/shot.py --routes c-hnthin,m-hbf,i-j429,t-nut     # 원하는 경로(#뒤 주소)
    python tools/shapes/shot.py --mobile                                 # 폰 너비(390)도 같이

docs/ 를 임시 서버로 띄워 연다. 이미지 로딩 실패(404)·콘솔 오류가 있으면 알려 준다.
"""
import argparse
import http.server
import pathlib
import socketserver
import sys
import threading

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(ROOT / 'docs'), **k)

        def log_message(self, *a):
            pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--routes', default='c-hnthin,m-hbf,i-j429,t-nut')
    ap.add_argument('--out', default=str(ROOT / 'out' / 'shots'))
    ap.add_argument('--mobile', action='store_true')
    ap.add_argument('--full', action='store_true', help='페이지 전체를 찍는다 (기본은 첫 화면 2000px까지)')
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    srv, port = serve()
    bad = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        sizes = [('d', 1280, 900)] + ([('m', 390, 844)] if a.mobile else [])
        for tag, w, h in sizes:
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
            pg = ctx.new_page()
            fails = []
            pg.on('requestfailed', lambda r: fails.append(r.url))
            pg.on('response', lambda r: fails.append(f'{r.status} {r.url}') if r.status >= 400 else None)
            pg.on('console', lambda m: fails.append('console: ' + m.text) if m.type == 'error' else None)
            pg.on('pageerror', lambda e: fails.append('pageerror: ' + str(e)))
            for r in a.routes.split(','):
                pg.goto(f'http://127.0.0.1:{port}/index.html#{r}')
                pg.wait_for_timeout(1500)
                pg.evaluate('window.scrollTo(0,0)')
                dest = out / f'{r}-{tag}.png'
                pg.screenshot(path=str(dest), full_page=a.full, clip=None if a.full else {'x': 0, 'y': 0, 'width': w, 'height': min(h * 2, 2000)})
                print('저장', dest)
            bad += fails
            ctx.close()
        b.close()
    srv.shutdown()
    for f in bad:
        print('문제:', f)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
