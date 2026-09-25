#!/usr/bin/env python3
"""컷 데이터(cuts.json)와 그림·영상·녹음 파일을 모아 영상을 자동으로 조립한다.

사용법:
    python3 cutlist.py ../episodes/ep01              # 먼저 cuts.json 만들기
    python3 assemble.py ../episodes/ep01             # 1920x1080 가편집본
    python3 assemble.py ../episodes/ep01 --size 1280x720 --out 애니매틱.mp4

읽는 폴더 (episodes/epNN/):
    assets/C001.png|jpg|webp   정지 그림 (입 모양 컷은 C007.png + C007_b.png)
    assets/C001.mp4|mov        이미지→영상으로 만든 움직이는 컷 (그림보다 우선)
    audio/C008_서진.wav|mp3    녹음 파일. 컷 번호로 시작하면 그 컷에 놓인다
    overlays/NN_*.png          편집 그래픽. 컷 지시서의 '오버레이 NN'대로 얹는다

규칙:
    - 녹음이 있으면 컷 길이 = max(지시서 길이, 녹음 길이 + 0.5초). 그래서 녹음에 맞춰 영상이 늘어난다.
    - 그림이 없는 컷은 자리표시 카드(컷 번호, 화면 설명, 대사)로 채운다. 전부 없으면 애니매틱이 된다.
    - 정지 그림에는 천천히 확대되는 카메라 움직임을 넣는다.
결과: output/ 폴더에 영상과 timing.md(실제 컷 시작 시간, 유튜브 챕터 목록).
"""
import argparse
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

try:
    import imageio_ffmpeg
except ImportError:
    sys.exit("영상 도구가 없습니다. 먼저 `pip install imageio-ffmpeg` 를 실행하세요.")

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 24
HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "upload" / "_src"
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp")
VID_EXT = (".mp4", ".mov", ".webm")
AUD_EXT = (".wav", ".mp3", ".m4a", ".aac", ".ogg")
OPAQUE_CARDS = {"13", "15"}          # 화면 전체를 덮는 카드
FULL_FRAME = {"01", "06", "07", "08", "09", "14", "16"}
GAUGES = ("02", "03", "04", "05")
# 1920x1080 기준 위치 (x, y, 폭). None 이면 가운데
PLACEMENT = {"02": (900, 60, 960), "03": (900, 60, 960), "04": (900, 60, 960), "05": (900, 60, 960),
             "10": (None, 560, 1200), "11": (None, None, 600), "12": (None, None, 240)}


def load_render():
    spec = importlib.util.spec_from_file_location("render", SRC / "render.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.ensure_fonts()
    return mod


def run(args):
    r = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y"] + args, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-2000:])


def media_duration(path):
    r = subprocess.run([FFMPEG, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0


def find(folder, stem, exts):
    for ext in exts:
        p = folder / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def mmss(sec):
    return f"{int(sec // 60):02d}:{int(sec % 60):02d}"


def placeholder(render, cut, size, out):
    speech = "\n".join(f"{l['speaker']}: {l['text']}" for l in cut["lines"])
    q = urllib.parse.urlencode({
        "kind": "card", "id": cut["id"], "t": mmss(cut["start"]), "m": cut["method"], "h": cut["hero"],
        "d": cut.get("화면") or cut.get("편집", ""), "o": cut.get("편집", "") if cut.get("화면") else "", "s": speech,
    }, quote_via=urllib.parse.quote)
    render.render(f"ov.html?{q}", size, out)


def overlay_file(ov_dir, num):
    hits = sorted(ov_dir.glob(f"{num}_*.png"))
    return hits[0] if hits else None


def build_segment(cut, ctx):
    cid, W, H = cut["id"], ctx["W"], ctx["H"]
    k = W / 1920
    seg = ctx["tmp"] / f"{cid}.mp4"
    audios = sorted(p for p in ctx["audio"].glob(f"{cid}_*") if p.suffix.lower() in AUD_EXT) if ctx["audio"].exists() else []
    audio_len = sum(media_duration(p) for p in audios)
    dur = max(cut["duration"], audio_len + 0.5) if audios else cut["duration"]

    overlays = [o for o in cut["overlays"] if overlay_file(ctx["ov"], o)]
    base_card = next((o for o in overlays if o in OPAQUE_CARDS), None)
    stack = [o for o in overlays if o not in OPAQUE_CARDS]
    gauges = [o for o in stack if o in GAUGES]
    if len(gauges) > 1:                  # '02 → 03' 처럼 적힌 게이지는 마지막 상태만 얹는다
        stack = [o for o in stack if o not in gauges[:-1]]

    video = find(ctx["assets"], cid, VID_EXT)
    still = find(ctx["assets"], cid, IMG_EXT)
    still_b = find(ctx["assets"], f"{cid}_b", IMG_EXT)
    inputs, vf, kind = [], [], "still"
    if video:
        inputs = ["-i", str(video)]
        vf.append(f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},"
                  f"tpad=stop_mode=clone:stop_duration={dur:.3f},setsar=1[base]")
        kind = "video"
    elif still:
        frames = max(1, round(dur * FPS))
        if still_b:
            lst = ctx["tmp"] / f"{cid}_lip.txt"
            flips = max(1, round(dur / 0.16))
            lst.write_text("".join(f"file '{(still if i % 2 == 0 else still_b).resolve()}'\nduration 0.16\n" for i in range(flips))
                           + f"file '{still.resolve()}'\n")
            inputs = ["-f", "concat", "-safe", "0", "-i", str(lst)]
            vf.append(f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},setsar=1[base]")
            kind = "lip"
        else:
            inputs = ["-i", str(still)]
            vf.append(f"[0:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                      f"zoompan=z='min(1+0.06*on/{frames},1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                      f":d={frames}:s={W}x{H}:fps={FPS},setsar=1[base]")
            kind = "image"
    else:
        img = ctx["tmp"] / f"{cid}_card.png"
        if base_card:
            shutil.copy(overlay_file(ctx["ov"], base_card), img)
            kind = "card"
        elif cut["method"] == "그래픽" and stack:
            ctx["render"].render("ov.html?kind=blank", f"{W}x{H}", img)
            kind = "graphic"
        else:
            placeholder(ctx["render"], cut, f"{W}x{H}", img)
            kind = "placeholder"
        inputs = ["-loop", "1", "-i", str(img)]
        vf.append(f"[0:v]scale={W}:{H},fps={FPS},setsar=1[base]")

    last = "base"
    for i, num in enumerate(stack, start=1):
        inputs += ["-loop", "1", "-i", str(overlay_file(ctx["ov"], num))]
        if num in FULL_FRAME:
            vf.append(f"[{i}:v]scale={W}:{H}[o{i}]")
            x, y = "0", "0"
        else:
            px, py, pw = PLACEMENT.get(num, (None, None, 800))
            vf.append(f"[{i}:v]scale={round(pw * k)}:-1[o{i}]")
            x = str(round(px * k)) if px is not None else "(W-w)/2"
            y = str(round(py * k)) if py is not None else "(H-h)/2"
        vf.append(f"[{last}][o{i}]overlay={x}:{y}:shortest=0[v{i}]")
        last = f"v{i}"

    n_inputs = sum(1 for a in inputs if a == "-i")
    if audios:
        for a in audios:
            inputs += ["-i", str(a)]
        joined = "".join(f"[{n_inputs + j}:a]aresample=48000,aformat=channel_layouts=stereo[a{j}];" for j in range(len(audios)))
        joined += "".join(f"[a{j}]" for j in range(len(audios))) + f"concat=n={len(audios)}:v=0:a=1[ac];"
        vf.append(joined + f"[ac]adelay=250|250,apad,atrim=0:{dur:.3f}[aout]")
    else:
        inputs += ["-f", "lavfi", "-i", f"anullsrc=r=48000:cl=stereo"]
        vf.append(f"[{n_inputs}:a]atrim=0:{dur:.3f}[aout]")

    run(inputs + ["-filter_complex", ";".join(vf), "-map", f"[{last}]", "-map", "[aout]",
                  "-t", f"{dur:.3f}", "-r", str(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                  "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", str(seg)])
    return {"id": cid, "dur": round(dur * FPS) / FPS, "kind": kind, "section": cut.get("section", ""),
            "audio": [a.name for a in audios]}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episode")
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--out", default=None)
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()

    ep = Path(a.episode).resolve()
    cuts = json.loads((ep / "production" / "cuts.json").read_text(encoding="utf-8"))
    W, H = (int(v) for v in a.size.lower().split("x"))
    out_dir = ep / "output"
    tmp = out_dir / "_segments"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    ctx = {"W": W, "H": H, "tmp": tmp, "assets": ep / "assets", "audio": ep / "audio", "ov": ep / "overlays",
           "render": load_render()}

    with ThreadPoolExecutor(max_workers=a.jobs) as pool:
        results = list(pool.map(lambda c: build_segment(c, ctx), cuts))

    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{tmp / (r['id'] + '.mp4')}'\n" for r in results))
    out = Path(a.out) if a.out else out_dir / f"{ep.name}_가편집.mp4"
    if not out.is_absolute():
        out = out_dir / out
    run(["-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", "-movflags", "+faststart", str(out)])

    t, rows, chapters, seen = 0.0, [], [], set()
    for r in results:
        if r["section"] and r["section"] not in seen:
            seen.add(r["section"])
            chapters.append(f"{mmss(t)} {r['section']}")
        rows.append(f"| {r['id']} | {mmss(t)} | {r['dur']:.2f} | {r['kind']} | {', '.join(r['audio'])} |")
        t += r["dur"]
    kinds = {k: sum(1 for r in results if r["kind"] == k) for k in sorted({r["kind"] for r in results})}
    (out_dir / "timing.md").write_text(
        f"# 조립 결과\n\n- 파일: `{out.name}`\n- 총 길이: {mmss(t)}\n- 컷 종류: {kinds}\n\n"
        "## 유튜브 챕터 (설명란에 붙여넣기)\n\n```\n" + "\n".join(chapters) + "\n```\n\n"
        "## 컷별 실제 시간\n\n| 컷 | 시작 | 길이(초) | 사용한 것 | 녹음 |\n|---|---|---|---|---|\n" + "\n".join(rows) + "\n",
        encoding="utf-8")
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"{out}  ({mmss(t)}, {kinds})")


if __name__ == "__main__":
    sys.exit(main())
