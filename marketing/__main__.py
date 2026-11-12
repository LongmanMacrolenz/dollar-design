"""python -m marketing: preview, prepare, upload, doctor and account connection."""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

from . import oauth, pipeline
from .content import MarketingError, ROOT, load_catalog
from .media import FONT, render, verify_media
from .services import YouTube
from .voice import LocalVoice, setup_model


def doctor():
    missing = [name for name in ("ffmpeg", "ffprobe") if not shutil.which(name)]
    if missing or not FONT.is_file():
        raise MarketingError("필요한 영상 도구 또는 한국어 글꼴이 없습니다: " + ", ".join(missing))
    load_catalog()
    channel = YouTube.from_env().channel()
    LocalVoice.from_env().check()
    return {"status": "connection_verified", "channel": channel["snippet"]["title"],
            "channel_id": channel["id"], "language": "ko", "publish_time": "20:00 Asia/Seoul"}


def configure_github(credentials_file, repo, enable=False):
    """Send values to gh on stdin, never as visible command arguments/logs."""
    credentials = json.loads(Path(credentials_file).expanduser().read_text())
    YouTube(credentials).channel()
    secret_values = {"YOUTUBE_CLIENT_SECRET": credentials["client_secret"],
                     "YOUTUBE_REFRESH_TOKEN": credentials["refresh_token"]}
    variables = {"YOUTUBE_CLIENT_ID": credentials["client_id"], "YOUTUBE_CHANNEL_ID": credentials["channel_id"],
                 "MARKETING_ENABLED": "true" if enable else "false"}
    if not shutil.which("gh"):
        raise MarketingError("계정 소유자 컴퓨터에 GitHub CLI가 필요합니다.")
    for name, value in secret_values.items():
        result = subprocess.run(["gh", "secret", "set", name, "--repo", repo], input=value.encode(),
                                capture_output=True)
        if result.returncode:
            raise MarketingError("GitHub Secret 저장 실패: " + name)
    for name, value in variables.items():
        result = subprocess.run(["gh", "variable", "set", name, "--repo", repo], input=value.encode(),
                                capture_output=True)
        if result.returncode:
            raise MarketingError("GitHub Variable 저장 실패: " + name)
    return {"status": "github_configured", "enabled": enable, "secret_names": list(secret_values),
            "variable_names": list(variables)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("topics")
    sub.add_parser("doctor")
    sub.add_parser("setup-model")
    p = sub.add_parser("verify-checkpoint")
    p.add_argument("--repo", required=True)
    p.add_argument("--key", required=True)
    p = sub.add_parser("preview")
    p.add_argument("--out", type=Path, default=ROOT / "out/marketing-preview")
    p.add_argument("--topic")
    p.add_argument("--day", type=date.fromisoformat)
    p.add_argument("--width", type=int, choices=(1280, 1920), default=1280)
    p = sub.add_parser("sample")
    p.add_argument("--out", type=Path, default=ROOT / "out/marketing-sample")
    p.add_argument("--topic")
    p.add_argument("--day", type=date.fromisoformat)
    p = sub.add_parser("prepare")
    p.add_argument("--root", type=Path, default=ROOT / "out/marketing")
    p.add_argument("--day", type=date.fromisoformat)
    p = sub.add_parser("upload")
    p.add_argument("--root", type=Path, default=ROOT / "out/marketing")
    p = sub.add_parser("verify")
    p.add_argument("directory", type=Path)
    p.add_argument("--allow-preview", action="store_true")
    p = sub.add_parser("connect-youtube")
    p.add_argument("--client-secrets", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--channel-id")
    p.add_argument("--no-browser", action="store_true")
    p = sub.add_parser("configure-github")
    p.add_argument("--credentials", type=Path, required=True)
    p.add_argument("--repo", default="LongmanMacrolenz/dollar-design")
    p.add_argument("--enable", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "topics":
            report = [{"id": t["id"], "title": t["title"]} for t in load_catalog()["topics"]]
        elif args.command == "setup-model":
            report = setup_model()
        elif args.command == "sample":
            from .content import build_episode, next_day
            catalog = load_catalog()
            topic = next((t for t in catalog["topics"] if t["id"] == args.topic), None) if args.topic else catalog["topics"][0]
            if not topic:
                raise MarketingError("주제 목록에 없는 식별자입니다.")
            if args.out.exists() and any(args.out.iterdir()):
                raise MarketingError("기존 샘플 폴더를 덮어쓰지 않습니다. 새 출력 폴더를 지정하세요.")
            args.out.mkdir(parents=True, exist_ok=True)
            episode = build_episode(topic, args.day or next_day())
            voice = LocalVoice()
            pipeline.write_json(args.out / "episode-source.json", {"voice_profile": voice.profile})
            path = args.out / "ai-voice.wav"
            alignment = voice.speak(episode, path)
            render(episode, args.out, audio=path, alignment=alignment, width=1280)
            report = {"status": "sample_only", "seconds": 330, "topic": topic["id"], "speech_api_cost": 0}
        elif args.command == "preview":
            report = pipeline.preview(args.out, args.topic, args.day, args.width)
        elif args.command == "prepare":
            report = pipeline.prepare(args.root, args.day)
            output = os.environ.get("GITHUB_OUTPUT")
            if output:
                with open(output, "a") as stream:
                    stream.write("skip=" + str(report["skip"]).lower() + "\n")
        elif args.command == "upload":
            report = pipeline.upload(args.root)
        elif args.command == "verify":
            report = verify_media(args.directory, args.allow_preview)
        elif args.command == "doctor":
            report = doctor()
        elif args.command == "verify-checkpoint":
            report = pipeline.verify_checkpoint(args.repo, args.key, os.environ.get("GH_TOKEN"))
        elif args.command == "connect-youtube":
            report = oauth.connect(args.client_secrets, args.output, args.channel_id, not args.no_browser)
        else:
            report = configure_github(args.credentials, args.repo, args.enable)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (MarketingError, OSError, json.JSONDecodeError, KeyError) as error:
        # OSError/KeyError may contain paths or provider payload details: redact them.
        message = str(error) if isinstance(error, MarketingError) else "설정·입력 파일을 읽을 수 없습니다. 파일과 형식을 확인하세요."
        print("중단: " + message, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
