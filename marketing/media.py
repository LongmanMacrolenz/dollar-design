"""Render readable Korean cards, original product illustrations and subtitles."""
from __future__ import annotations

import json
import math
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .content import MarketingError, ROOT, TARGET_SECONDS

FONT = ROOT / "worker/assets/GothicA1-Regular.ttf"
NAVY = "#16334a"
ORANGE = "#c66a38"


def run(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        # ffmpeg receives only local media paths; never pass authentication to it.
        raise MarketingError("영상 도구 실행 실패: " + result.stderr[-1200:])
    return result.stdout


def probe(path):
    return json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                           "-of", "json", str(path)]))


def sha256_file(path):
    import hashlib
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def wrap(draw, text, font, width):
    lines = []
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split():
            candidate = (line + " " + word).strip()
            if draw.textlength(candidate, font=font) <= width:
                line = candidate
                continue
            if line:
                lines.append(line)
                line = ""
            for char in word:
                candidate = line + char
                if line and draw.textlength(candidate, font=font) > width:
                    lines.append(line)
                    line = char
                else:
                    line = candidate
        if line:
            lines.append(line)
    return lines


def draw_lines(draw, text, xy, font, width, fill, max_lines):
    lines = wrap(draw, text, font, width)
    if len(lines) > max_lines:
        raise MarketingError("화면 문구가 카드 영역을 넘습니다. 줄이거나 분리하세요.")
    x, y = xy
    line_height = int(font.size * 1.5)
    for line in lines:
        draw.text((x, y), line, fill=fill, font=font)
        y += line_height
    return y


def card(scene, index, count, target, preview=False):
    im = Image.new("RGB", (1920, 1080), "#f6f5ef")
    draw = ImageDraw.Draw(im)
    font = lambda size: ImageFont.truetype(str(FONT), size)
    draw.rectangle((0, 0, 1920, 122), fill=NAVY)
    draw.text((80, 28), "BOLTNOTE / FASTENERS", font=font(42), fill="white")
    draw.text((1640, 32), f"{index + 1:02d} / {count:02d}", font=font(36), fill="#cbd8df")
    title_bottom = draw_lines(draw, scene["title"], (80, 166), font(68), 1670, NAVY, 2)
    draw.rounded_rectangle((1080, 390, 1840, 865), radius=22, fill="white")
    product = Image.open(ROOT / scene["asset"]).convert("RGB")
    product.thumbnail((720, 430), Image.Resampling.LANCZOS)
    im.paste(product, (1460 - product.width // 2, 625 - product.height // 2))
    draw.text((1130, 880), "참고용 렌더링 · 실제 제품 사진 아님", font=font(30), fill=NAVY)
    y = max(410, title_bottom + 38)
    for bullet in scene["bullets"]:
        draw.ellipse((84, y + 22, 100, y + 38), fill=ORANGE)
        y = draw_lines(draw, bullet, (126, y), font(43), 850, NAVY, 4) + 35
    if y > 908:
        raise MarketingError("화면의 본문이 자막 영역과 겹칩니다.")
    draw.rectangle((0, 955, 1920, 1080), fill=NAVY)
    if preview:
        draw.text((1315, 130), "구성 미리보기 · 음성 미연결", font=font(27), fill=ORANGE)
    im.save(target)


def thumbnail(episode, target):
    im = Image.new("RGB", (1280, 720), NAVY)
    draw = ImageDraw.Draw(im)
    font = lambda size: ImageFont.truetype(str(FONT), size)
    draw.text((64, 48), "BOLTNOTE / FASTENERS", font=font(31), fill="#cbd8df")
    title = episode["title"].split(" | ")[0]
    if episode["topic_id"] == "hex-bolt-order":
        title = "육각볼트\n주문서에서 빠지는 것"
    draw_lines(draw, title, (64, 156), font(65), 1120,
               "white", 4)
    draw.rounded_rectangle((64, 558, 700, 650), radius=18, fill=ORANGE)
    draw.text((94, 579), "체결부품 구매 · 사양 확인", font=font(39), fill="white")
    im.save(target)


def srt_time(seconds):
    millis = round(seconds * 1000)
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    seconds, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def subtitles(episode, target):
    cues, events, elapsed = [], [], 0.0
    for scene, duration in zip(episode["scenes"], episode["scene_seconds"]):
        sentences = re.split(r"(?<=[.!?])\s+", scene["narration"])
        chunks = []
        for sentence in sentences:
            # Bound caption length without silently omitting any characters.
            while len(sentence) > 64:
                split = sentence.rfind(" ", 20, 64)
                split = split if split >= 20 else 60
                chunks.append(sentence[:split].strip())
                sentence = sentence[split:].strip()
            if sentence:
                chunks.append(sentence)
        total = sum(len(c) for c in chunks)
        offset = 0.0
        for chunk in chunks:
            length = duration * len(chunk) / total
            # Two readable lines; time follows the synthesized scene boundary.
            if len(chunk) > 32:
                split = chunk.rfind(" ", 12, 35)
                split = split if split >= 12 else len(chunk) // 2
                chunk = chunk[:split].rstrip() + "\n" + chunk[split:].lstrip()
            cues.append(f"{len(cues)+1}\n{srt_time(elapsed+offset)} --> "
                        f"{srt_time(elapsed+offset+length)}\n{chunk}\n")
            events.append((elapsed+offset, elapsed+offset+length, chunk))
            offset += length
        elapsed += duration
    target.write_text("\n".join(cues), encoding="utf-8")
    # Explicit script resolution prevents libass's SRT default from scaling
    # captions into the illustration panel, particularly on 720p outputs.
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,Gothic A1,42,&H00FFFFFF,&H00FFFFFF,&H0016334A,&H0016334A,0,0,0,0,100,100,0,0,1,0,0,2,100,100,22,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    def ass_time(value):
        centis = round(value * 100)
        hours, centis = divmod(centis, 360000)
        minutes, centis = divmod(centis, 6000)
        seconds, centis = divmod(centis, 100)
        return f"{hours}:{minutes:02d}:{seconds:02d}.{centis:02d}"
    dialogues = []
    for start, end, caption in events:
        caption = caption.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", r"\N")
        dialogues.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{caption}")
    target.with_suffix(".ass").write_text(header + "\n".join(dialogues) + "\n", encoding="utf-8")


def align_scenes(episode, alignment, audio_seconds):
    chars = alignment.get("characters", [])
    starts = alignment.get("character_start_times_seconds", [])
    ends = alignment.get("character_end_times_seconds", [])
    if "".join(chars) != episode["narration"] or not len(chars) == len(starts) == len(ends):
        raise MarketingError("음성 서비스의 문자 시간표가 대본과 다릅니다. 임의 자막 동기화를 하지 않습니다.")
    if not chars or not all(math.isfinite(x) and 0 <= x <= audio_seconds + 1 for x in starts + ends):
        raise MarketingError("음성 서비스의 시간표가 잘못되었습니다.")
    if any(a > b for a, b in zip(starts, ends)) or any(a > b for a, b in zip(starts, starts[1:])):
        raise MarketingError("음성 시간표가 역순입니다.")
    boundaries, offset = [0.0], 0
    for scene in episode["scenes"][:-1]:
        offset += len(scene["narration"]) + 2
        boundaries.append(float(starts[offset]))
    boundaries.append(audio_seconds)
    if any(b <= a for a, b in zip(boundaries, boundaries[1:])):
        raise MarketingError("내레이션 장면 경계가 잘못되었습니다.")
    return [b - a for a, b in zip(boundaries, boundaries[1:])]


def filter_path(path):
    return str(path.resolve()).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def render(episode, directory, audio=None, alignment=None, preview=False, width=1920):
    if width not in (1280, 1920):
        raise MarketingError("지원하는 영상 폭은 1280 또는 1920입니다.")
    directory = Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    if not preview and (audio is None or alignment is None):
        raise MarketingError("공개용 영상에는 AI 내레이션과 실제 장면 시간표가 필요합니다.")
    duration = float(TARGET_SECONDS)
    voice = None
    if audio is not None:
        source = probe(audio)
        if not any(s["codec_type"] == "audio" for s in source["streams"]):
            raise MarketingError("내레이션 파일에 오디오가 없습니다.")
        original = float(source["format"]["duration"])
        tempo = original / TARGET_SECONDS
        if not .8 <= tempo <= 1.2:
            raise MarketingError("자연스러운 속도 조절로 5~6분을 맞출 수 없습니다. 대본 또는 음성 속도를 수정하세요.")
        boundaries = align_scenes(episode, alignment, original)
        episode["scene_seconds"] = [value / tempo for value in boundaries]
        voice = directory / "narration.wav"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(audio),
             "-af", f"atempo={tempo:.8f},loudnorm=I=-16:TP=-1.5:LRA=11,apad", "-t", str(duration),
             "-ar", "48000", "-ac", "1", str(voice)])
    cards = directory / "cards"
    cards.mkdir(exist_ok=True)
    concat = ["ffconcat version 1.0"]
    for i, (scene, seconds) in enumerate(zip(episode["scenes"], episode["scene_seconds"])):
        path = cards / f"{i:02d}.png"
        card(scene, i, len(episode["scenes"]), path, preview)
        concat.extend([f"file 'cards/{path.name}'", f"duration {seconds:.9f}"])
    concat.append(f"file 'cards/{len(episode['scenes'])-1:02d}.png'")
    timeline = directory / "cards.ffconcat"
    timeline.write_text("\n".join(concat) + "\n")
    caption = directory / "captions.srt"
    subtitles(episode, caption)
    thumbnail(episode, directory / "thumbnail.png")
    output = directory / "video.mp4"
    # Keep the typography fixed. Progress motion makes each section's pacing visible.
    vf = ("[0:v]fps=24[base];[base][2:v]overlay="
          f"x='-1920+1920*t/{duration}':y=948:eval=frame:shortest=1,"
          f"ass=filename='{filter_path(caption.with_suffix('.ass'))}':fontsdir='{filter_path(FONT.parent)}',"
          f"scale={width}:{width*9//16}:flags=lanczos[v]")
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
               "-i", str(timeline)]
    command += ["-i", str(voice)] if voice else ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono"]
    command += ["-f", "lavfi", "-i", f"color=c={ORANGE}:s=1920x8:r=24", "-filter_complex", vf,
                "-map", "[v]", "-map", "1:a:0", "-t", str(duration), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                "-threads", "4", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
                "-map_metadata", "-1", "-movflags", "+faststart", str(output)]
    run(command)
    (directory / "episode.json").write_text(json.dumps(episode, ensure_ascii=False, indent=2) + "\n")
    (directory / "narration.txt").write_text(episode["narration"] + "\n")
    media = {"schema": 1, "preview": preview, "voice": "none" if preview else "ai",
             "duration": duration, "episode_sha256": sha256_file(directory / "episode.json"),
             "files": {name: sha256_file(directory / name)
                       for name in ("video.mp4", "thumbnail.png", "captions.srt")}}
    (directory / "media.json").write_text(json.dumps(media, indent=2) + "\n")
    verify_media(directory, allow_preview=preview)
    return media


def verify_media(directory, allow_preview=False):
    directory = Path(directory)
    media = json.loads((directory / "media.json").read_text())
    if media.get("preview") and not allow_preview:
        raise MarketingError("음성 미연결 구성 미리보기는 업로드할 수 없습니다.")
    if not allow_preview and media.get("voice") != "ai":
        raise MarketingError("AI 내레이션을 연결한 영상이 아닙니다.")
    if sha256_file(directory / "episode.json") != media["episode_sha256"]:
        raise MarketingError("영상 제작 후 대본 또는 게시 정보가 변경되었습니다.")
    for name, expected in media["files"].items():
        if Path(name).name != name or sha256_file(directory / name) != expected:
            raise MarketingError("영상·썸네일·자막 무결성 검증 실패.")
    result = probe(directory / "video.mp4")
    videos = [s for s in result["streams"] if s["codec_type"] == "video"]
    audios = [s for s in result["streams"] if s["codec_type"] == "audio"]
    seconds = float(result["format"]["duration"])
    if len(videos) != 1 or not audios or not 300 <= seconds <= 360:
        raise MarketingError("영상이 5~6분 또는 영상·음성 스트림 요건을 만족하지 않습니다.")
    if videos[0]["width"] not in (1280, 1920) or videos[0]["height"] * 16 != videos[0]["width"] * 9:
        raise MarketingError("영상 해상도 또는 화면 비율이 잘못되었습니다.")
    audio_seconds = float(audios[0].get("duration", seconds))
    if abs(audio_seconds - seconds) > .2:
        raise MarketingError("영상과 내레이션의 길이가 다릅니다.")
    return media
