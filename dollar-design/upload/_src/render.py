#!/usr/bin/env python3
"""썸네일·채널 아트 HTML을 PNG로 렌더링한다.

사용법:
    python3 render.py thumb_a.html 1280x720 ../ep01/thumbnail_A.png

처음 실행할 때 Google Fonts에서 폰트(OFL)를 fonts/ 에 내려받는다.
헤드리스 크롬 경로는 CHROME 환경 변수로 바꿀 수 있다.
"""
import os
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
CHROME = os.environ.get(
    "CHROME", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
)
CSS_URL = (
    "https://fonts.googleapis.com/css2?family=Black+Han+Sans"
    "&family=Noto+Serif+KR:wght@700;900&family=Noto+Sans+KR:wght@700;900"
)
# (패밀리, 굵기) → common.css 가 참조하는 파일 이름
FILES = {
    ("Black Han Sans", "400"): "BlackHanSans.ttf",
    ("Noto Sans KR", "700"): "NotoSansKR-700.ttf",
    ("Noto Sans KR", "900"): "NotoSansKR-900.ttf",
    ("Noto Serif KR", "700"): "NotoSerifKR-700.ttf",
    ("Noto Serif KR", "900"): "NotoSerifKR-900.ttf",
}


def ensure_fonts():
    if all((FONTS / name).exists() for name in FILES.values()):
        return
    FONTS.mkdir(exist_ok=True)
    # 기본 User-Agent로 요청하면 서브셋이 아닌 전체 TTF 주소를 돌려준다.
    css = urllib.request.urlopen(CSS_URL).read().decode()
    for block in re.findall(r"@font-face\s*{[^}]*}", css):
        family = re.search(r"font-family:\s*'([^']+)'", block).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", block).group(1)
        url = re.search(r"url\(([^)]+)\)", block).group(1)
        name = FILES.get((family, weight))
        if name:
            urllib.request.urlretrieve(url, FONTS / name)


def render(html, size, out):
    width, height = size.lower().split("x")
    out = Path(out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            CHROME, "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
            "--force-device-scale-factor=1", "--allow-file-access-from-files",
            "--virtual-time-budget=20000", f"--window-size={width},{height}",
            f"--screenshot={out}", (HERE / html).resolve().as_uri(),
        ],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print(out)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    ensure_fonts()
    render(*sys.argv[1:])
