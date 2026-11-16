"""Checkpoint before transfer, reconcile remote IDs and resume the same session."""
from __future__ import annotations

import fcntl
import json
import os
import re
import shutil
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path

from .content import (MarketingError, auto_key, build_episode, digest, load_catalog, next_day,
                      publish_at, select_topic)
from .media import render, verify_media
from .services import YouTube
from .voice import LocalVoice


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as stream:
        os.chmod(temporary, 0o600)
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temporary, path)


@contextmanager
def lock(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    with (root / "run.lock").open("a") as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise MarketingError("같은 작업 폴더에서 제작·업로드가 이미 실행 중입니다.") from None
        yield


def markers(video):
    text = video.get("snippet", {}).get("description", "")
    fields = dict(re.findall(r"^BN_(AUTO|TOPIC|DAY|KEY)=([^\r\n]+)$", text, re.M))
    return fields if fields.get("AUTO") == "1" else {}


def matching_day(videos, channel_id, day):
    key = auto_key(channel_id, day)
    matches = [v for v in videos if markers(v).get("KEY") == key or markers(v).get("DAY") == day.isoformat()]
    if len(matches) > 1:
        raise MarketingError("같은 공개일의 관리 영상이 이미 여러 개입니다. 추가 업로드를 중단합니다.")
    return matches[0] if matches else None


def initial_state(channel_id):
    return {"schema": 1, "channel_id": channel_id, "completed": [], "pending": None}


def read_state(root, channel_id):
    path = Path(root) / "state/journal.json"
    state = json.loads(path.read_text()) if path.exists() else initial_state(channel_id)
    if state.get("schema") != 1 or state.get("channel_id") != channel_id:
        raise MarketingError("저장된 작업 상태의 버전 또는 채널이 다릅니다.")
    return state


def save_state(root, state):
    write_json(Path(root) / "state/journal.json", state)


def future(day, now=None):
    if (publish_at(day) - (now or datetime.now(timezone.utc))).total_seconds() < 3600:
        raise MarketingError("예약 공개까지 1시간 이상 남은 날짜를 선택하세요. 지난 날짜로 자동 변경하지 않습니다.")


def preview(root, topic_id=None, day=None, width=1280):
    catalog = load_catalog()
    topic = next((t for t in catalog["topics"] if t["id"] == topic_id), None) if topic_id else catalog["topics"][0]
    if topic is None:
        raise MarketingError("주제 목록에 없는 식별자입니다.")
    episode = build_episode(topic, day or next_day())
    render(episode, Path(root), preview=True, width=width)
    return {"status": "preview_only", "seconds": episode["seconds"], "topic": topic["id"]}


def prepare(root, day=None, youtube=None, voice=None, renderer=render):
    """Create media/session, then let the workflow durably save this checkpoint."""
    root = Path(root)
    youtube = youtube or YouTube.from_env()
    voice = voice or LocalVoice.from_env()
    channel_id = youtube.credentials["channel_id"]
    catalog = load_catalog()
    with lock(root):
        state = read_state(root, channel_id)
        channel, videos = youtube.inventory()  # fail closed if the read is incomplete
        if state["pending"]:
            pending = state["pending"]
            if pending["phase"] not in ("prepared", "uploading", "uploaded"):
                raise MarketingError("복구할 수 없는 업로드 상태입니다. 새 업로드를 만들지 않습니다.")
            verify_media(root / "pending")
            # Upload completion can have been accepted even when a job was interrupted.
            remote = matching_day(videos, channel_id, date.fromisoformat(pending["day"]))
            if remote:
                if markers(remote).get("KEY") != pending["key"]:
                    raise MarketingError("복구 대상 날짜에 다른 관리 영상이 있습니다.")
                pending.update(phase="uploaded", video_id=remote["id"])
                save_state(root, state)
            elif pending["phase"] != "uploaded":
                future(date.fromisoformat(pending["day"]))
            return {"status": "resume", "skip": False, "day": pending["day"], "topic": pending["topic_id"]}
        day = day or next_day()
        remote = matching_day(videos, channel_id, day)
        if remote:
            youtube.verify_schedule(remote["id"], {"channel_id": channel_id,
                                    "publish_at": publish_at(day).isoformat().replace("+00:00", "Z"),
                                    "key": auto_key(channel_id, day)})
            return {"status": "already_exists", "skip": True, "day": day.isoformat(), "video_id": remote["id"]}
        future(day)
        used = {markers(v).get("TOPIC") for v in videos}
        used.update(item["topic_id"] for item in state["completed"])
        topic = select_topic(catalog, used)
        episode = build_episode(topic, day, channel_id)
        identity = {"key": episode["key"], "topic_id": topic["id"], "source_sha256": topic["source_sha256"],
                    "narration_sha256": digest(episode["narration"]), "voice_profile": voice.profile}
        pending_dir = root / "pending"
        if pending_dir.exists():
            # An interrupted render before session creation is safe to reuse only
            # after its source identity is confirmed; never silently delete user files.
            manifest = pending_dir / "episode-source.json"
            if not manifest.is_file() or json.loads(manifest.read_text()) != identity:
                raise MarketingError("기존 제작 폴더가 이번 작업과 다릅니다. 보존하고 별도로 확인하세요.")
        pending_dir.mkdir(parents=True, exist_ok=True)
        write_json(pending_dir / "episode-source.json", identity)
        raw_audio, alignment_path = pending_dir / "ai-voice.wav", pending_dir / "alignment.json"
        if raw_audio.is_file() and alignment_path.is_file():
            alignment = json.loads(alignment_path.read_text())
        else:
            alignment = voice.speak(episode, raw_audio)
            write_json(alignment_path, alignment)
        renderer(episode, pending_dir, audio=raw_audio, alignment=alignment, preview=False)
        verify_media(pending_dir)
        episode = json.loads((pending_dir / "episode.json").read_text())
        encrypted_session = youtube.begin_upload(episode, pending_dir / "video.mp4")
        state["pending"] = {"phase": "prepared", "day": day.isoformat(), "key": episode["key"],
                            "topic_id": topic["id"], "channel_id": channel_id,
                            "encrypted_session": encrypted_session, "video_id": None}
        save_state(root, state)
        return {"status": "prepared", "skip": False, "day": day.isoformat(), "topic": topic["id"],
                "channel": channel["snippet"]["title"], "checkpoint_required_before_transfer": True}


def upload(root, youtube=None):
    """Resume a saved session. This function never calls videos.insert."""
    root = Path(root)
    youtube = youtube or YouTube.from_env()
    channel_id = youtube.credentials["channel_id"]
    with lock(root):
        state = read_state(root, channel_id)
        pending = state.get("pending")
        if not pending:
            raise MarketingError("전송 전에 저장된 제작·업로드 세션이 필요합니다.")
        directory = root / "pending"
        verify_media(directory)
        episode = json.loads((directory / "episode.json").read_text())
        if episode["key"] != pending["key"] or episode["channel_id"] != channel_id:
            raise MarketingError("대본과 저장된 세션의 채널·작업 식별자가 다릅니다.")
        youtube.channel()
        if not pending.get("video_id"):
            _, videos = youtube.inventory()
            remote = matching_day(videos, channel_id, date.fromisoformat(pending["day"]))
            if remote:
                if markers(remote).get("KEY") != pending["key"]:
                    raise MarketingError("전송 전에 같은 날짜의 다른 관리 영상이 발견되었습니다.")
                pending.update(phase="uploaded", video_id=remote["id"])
                save_state(root, state)
        if not pending.get("video_id"):
            future(date.fromisoformat(pending["day"]))
            pending["phase"] = "uploading"
            save_state(root, state)

            def progress(offset, total):
                pending["uploaded_bytes"] = offset
                pending["total_bytes"] = total
                save_state(root, state)

            result = youtube.upload(pending["encrypted_session"], directory / "video.mp4", progress)
            pending.update(phase="uploaded", video_id=result["id"])
            save_state(root, state)  # persist ID before thumbnail/verification retries
        youtube.verify_schedule(pending["video_id"], episode)
        youtube.thumbnail(pending["video_id"], directory / "thumbnail.png")
        completed = {"key": episode["key"], "day": pending["day"], "topic_id": pending["topic_id"],
                     "video_id": pending["video_id"], "publish_at": episode["publish_at"]}
        archive = root / "published" / (pending["day"] + "-" + pending["topic_id"])
        archive.mkdir(parents=True, exist_ok=True)
        for name in ("video.mp4", "thumbnail.png", "captions.srt", "narration.txt", "episode.json", "media.json"):
            shutil.copyfile(directory / name, archive / name)
        state["completed"].append(completed)
        state["pending"] = None
        save_state(root, state)
        # This directory is owned by the pipeline, evidenced by episode-source.json.
        shutil.rmtree(directory)
        report = {"status": "scheduled", **completed}
        write_json(root / "report.json", report)
        return report


def verify_checkpoint(repo, cache_key, token, transport=None):
    """Cache/save may only warn on failure; verify persistence before transferring."""
    from .services import Transport, expect
    import urllib.parse
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo) or not token:
        raise MarketingError("체크포인트 확인에 저장소 이름과 GitHub Actions 토큰이 필요합니다.")
    transport = transport or Transport()
    url = f"https://api.github.com/repos/{repo}/actions/caches?" + urllib.parse.urlencode({"key": cache_key})
    for attempt in range(3):
        result = expect(transport.request("GET", url, {"Authorization": "Bearer " + token,
                        "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}),
                        "GitHub 업로드 체크포인트 확인").json()
        found = [item for item in result.get("actions_caches", [])
                 if item.get("key") == cache_key and item.get("size_in_bytes", 0) > 0]
        if found:
            return {"status": "checkpoint_saved", "cache_key": cache_key}
        if attempt < 2:
            import time
            time.sleep(2 ** (attempt + 1))
    raise MarketingError("업로드 재개 상태의 외부 저장을 확인하지 못했습니다. 영상 전송을 시작하지 않습니다.")
