#!/usr/bin/env python3
"""모션그래픽 HTML(window.setTime(초)를 가진 페이지)을 프레임 단위로 찍어 영상으로 만든다.

사용법:
    python3 motion_render.py ../motion/ep01_coldopen.html 출력.mp4 [--audio 소리.wav] [--fps 24] [--size 1920x1080]
    python3 motion_render.py ../motion/ep01_coldopen.html 미리보기.png --stills 1,3.5,10,15.8

--stills 를 주면 영상 대신 지정한 시각(초)의 장면들을 한 장에 모은 미리보기 이미지를 만든다.
필요: pip install playwright imageio-ffmpeg
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

try:
    import imageio_ffmpeg
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("먼저 `pip install playwright imageio-ffmpeg` 를 실행하세요.")

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
CHROME = os.environ.get("CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
HERE = Path(__file__).resolve().parent


def open_page(p, html, w, h):
    browser = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--allow-file-access-from-files"])
    page = browser.new_page(viewport={"width": w, "height": h})
    page.goto(Path(html).resolve().as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    return browser, page


def render_video(html, out, fps, w, h, audio):
    with sync_playwright() as p:
        browser, page = open_page(p, html, w, h)
        duration = page.evaluate("window.DURATION")
        frames = round(duration * fps)
        args = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-"]
        if audio:
            args += ["-i", str(audio)]
        args += ["-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(fps)]
        if audio:
            args += ["-c:a", "aac", "-b:a", "256k", "-shortest"]
        args += ["-movflags", "+faststart", str(out)]
        enc = subprocess.Popen(args, stdin=subprocess.PIPE)
        for i in range(frames):
            page.evaluate(f"window.setTime({i / fps})")
            enc.stdin.write(page.screenshot(type="png"))
            if i % (fps * 5) == 0:
                print(f"  {i / fps:5.1f}s / {duration}s", flush=True)
        enc.stdin.close()
        enc.wait()
        browser.close()
    print(out)


def render_stills(html, out, times, w, h):
    tmp = Path(out).with_suffix("")
    shots = []
    with sync_playwright() as p:
        browser, page = open_page(p, html, w, h)
        for i, t in enumerate(times):
            page.evaluate(f"window.setTime({t})")
            f = f"{tmp}_{i}.png"
            page.screenshot(path=f)
            shots.append(f)
        browser.close()
    cols = 2
    inputs = sum((["-i", s] for s in shots), [])
    rows = [f"{''.join(f'[{r * cols + c}]' for c in range(cols) if r * cols + c < len(shots))}"
            for r in range((len(shots) + cols - 1) // cols)]
    parts, names = [], []
    for r, row in enumerate(rows):
        n = row.count("[")
        if n == cols:
            parts.append(f"{row}hstack=inputs={cols}[r{r}]")
        else:
            parts.append(f"{row}pad=iw*{cols}:ih[r{r}]")
        names.append(f"[r{r}]")
    parts.append(f"{''.join(names)}vstack=inputs={len(names)},scale=1600:-1" if len(names) > 1 else f"{names[0]}scale=1600:-1")
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y"] + inputs + ["-filter_complex", ";".join(parts), str(out)], check=True)
    for s in shots:
        os.remove(s)
    print(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("out")
    ap.add_argument("--audio")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--stills")
    a = ap.parse_args()
    w, h = (int(v) for v in a.size.lower().split("x"))
    if a.stills:
        render_stills(a.html, a.out, [float(x) for x in a.stills.split(",")], w, h)
    else:
        render_video(a.html, a.out, a.fps, w, h, a.audio)


if __name__ == "__main__":
    main()
