"""Official HTTPS APIs, owner OAuth and resumable uploads; no login scraping."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import time
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from .content import MarketingError

SCOPES = ("https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly")
API = "https://www.googleapis.com/youtube/v3/"
TOKEN = "https://oauth2.googleapis.com/token"
CHUNK = 8 * 1024 * 1024


@dataclass
class Reply:
    status: int
    headers: dict
    body: bytes

    def json(self):
        try:
            return json.loads(self.body)
        except (ValueError, UnicodeError):
            raise MarketingError("외부 서비스가 올바른 JSON 응답을 반환하지 않았습니다.") from None


class Transport:
    def request(self, method, url, headers=None, body=None):
        class SameHostRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, request, fp, code, msg, response_headers, new_url):
                original = urllib.parse.urlsplit(request.full_url)
                target = urllib.parse.urlsplit(new_url)
                if target.scheme != "https" or target.hostname != original.hostname:
                    raise MarketingError("외부 인증 요청의 다른 호스트 리디렉션을 차단했습니다.")
                return super().redirect_request(request, fp, code, msg, response_headers, new_url)
        request = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
        try:
            opener = urllib.request.build_opener(SameHostRedirect())
            with opener.open(request, timeout=120) as response:
                data = response.read(40 * 1024 * 1024 + 1)
                if len(data) > 40 * 1024 * 1024:
                    raise MarketingError("외부 응답이 허용 크기를 넘었습니다.")
                return Reply(response.status, dict(response.headers), data)
        except urllib.error.HTTPError as error:
            return Reply(error.code, dict(error.headers), error.read(65536))
        except (urllib.error.URLError, TimeoutError, OSError):
            # Do not log bearer tokens, session URLs, request bodies or raw errors.
            raise MarketingError("HTTPS 연결 실패: " + urllib.parse.urlsplit(url).hostname) from None


def expect(reply, service, statuses=(200,)):
    if reply.status not in statuses:
        raise MarketingError(f"{service} 요청 실패 (HTTP {reply.status}). 권한·할당량·서비스 상태를 확인하세요.")
    return reply


def need_env(names):
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        raise MarketingError("보안 설정에 필요한 값이 없습니다: " + ", ".join(missing))
    return {name: os.environ[name] for name in names}


def seal_session(url, refresh_token):
    key = base64.urlsafe_b64encode(hashlib.sha256(("boltnote-youtube-session-v1:" + refresh_token).encode()).digest())
    return Fernet(key).encrypt(url.encode()).decode()


def open_session_secret(encrypted, refresh_token):
    key = base64.urlsafe_b64encode(hashlib.sha256(("boltnote-youtube-session-v1:" + refresh_token).encode()).digest())
    try:
        url = Fernet(key).decrypt(encrypted.encode()).decode()
    except (InvalidToken, UnicodeError, ValueError):
        raise MarketingError("저장된 업로드 세션을 복호화할 수 없습니다. 새 업로드를 만들지 않습니다.") from None
    validate_session_url(url)
    return url


def validate_session_url(url):
    parsed = urllib.parse.urlsplit(url)
    try:
        port = parsed.port
    except ValueError:
        raise MarketingError("업로드 주소의 포트가 잘못되었습니다.") from None
    if parsed.scheme != "https" or parsed.hostname not in ("www.googleapis.com", "youtube.googleapis.com") \
            or parsed.username or parsed.password or port not in (None, 443) \
            or not parsed.path.startswith("/upload/"):
        raise MarketingError("예상하지 않은 업로드 목적지입니다. 인증을 전송하지 않습니다.")


class YouTube:
    def __init__(self, credentials, transport=None):
        self.credentials = credentials
        self.transport = transport or Transport()
        self.access_token = None
        self.token_expires = 0

    @classmethod
    def from_env(cls, transport=None):
        values = need_env(("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN", "YOUTUBE_CHANNEL_ID"))
        return cls({"client_id": values["YOUTUBE_CLIENT_ID"], "client_secret": values["YOUTUBE_CLIENT_SECRET"],
                    "refresh_token": values["YOUTUBE_REFRESH_TOKEN"], "channel_id": values["YOUTUBE_CHANNEL_ID"]}, transport)

    def auth(self):
        if self.access_token and time.monotonic() < self.token_expires:
            return {"Authorization": "Bearer " + self.access_token}
        payload = urllib.parse.urlencode({"client_id": self.credentials["client_id"],
                                         "client_secret": self.credentials["client_secret"],
                                         "refresh_token": self.credentials["refresh_token"],
                                         "grant_type": "refresh_token"}).encode()
        reply = self.transport.request("POST", TOKEN, {"Content-Type": "application/x-www-form-urlencoded"}, payload)
        data = expect(reply, "Google OAuth").json()
        if not data.get("access_token"):
            raise MarketingError("YouTube OAuth가 접근 토큰을 반환하지 않았습니다.")
        if data.get("scope") and not set(SCOPES).issubset(set(data["scope"].split())):
            raise MarketingError("연결된 계정에 업로드와 채널 읽기 권한이 모두 필요합니다.")
        self.access_token = data["access_token"]
        self.token_expires = time.monotonic() + max(0, int(data.get("expires_in", 3600)) - 120)
        return {"Authorization": "Bearer " + self.access_token}

    def get(self, resource, **params):
        reply = self.transport.request("GET", API + resource + "?" + urllib.parse.urlencode(params), self.auth())
        return expect(reply, "YouTube 채널 읽기").json()

    def channel(self):
        data = self.get("channels", part="id,snippet,contentDetails", mine="true")
        matches = [x for x in data.get("items", []) if x["id"] == self.credentials["channel_id"]]
        if len(matches) != 1:
            raise MarketingError("OAuth로 연결된 채널이 지정한 채널과 다릅니다. 업로드를 중단합니다.")
        return matches[0]

    def inventory(self):
        channel = self.channel()
        playlist = channel["contentDetails"]["relatedPlaylists"]["uploads"]
        ids, token = [], None
        for _ in range(200):
            params = {"part": "contentDetails", "playlistId": playlist, "maxResults": 50}
            if token:
                params["pageToken"] = token
            data = self.get("playlistItems", **params)
            ids.extend(item["contentDetails"]["videoId"] for item in data.get("items", []))
            token = data.get("nextPageToken")
            if not token:
                break
        else:
            raise MarketingError("채널 목록을 끝까지 읽지 못했습니다. 일부 결과로 중복 판단하지 않습니다.")
        videos = []
        for offset in range(0, len(ids), 50):
            requested = set(ids[offset:offset+50])
            items = self.get("videos", part="id,snippet,status,processingDetails", id=",".join(requested)).get("items", [])
            if {v["id"] for v in items} != requested:
                raise MarketingError("일부 소유 영상의 상태를 읽지 못했습니다. 중복 확인이 불완전합니다.")
            videos.extend(items)
        return channel, videos

    def begin_upload(self, episode, video_path):
        payload = {"snippet": {"title": episode["title"], "description": episode["description"],
                               "tags": episode["tags"], "categoryId": "27", "defaultLanguage": "ko",
                               "defaultAudioLanguage": "ko"},
                   "status": {"privacyStatus": "private", "publishAt": episode["publish_at"],
                              "selfDeclaredMadeForKids": False, "containsSyntheticMedia": True}}
        headers = {**self.auth(), "Content-Type": "application/json; charset=utf-8",
                   "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(Path(video_path).stat().st_size)}
        reply = self.transport.request("POST", "https://www.googleapis.com/upload/youtube/v3/videos?"
                                       "uploadType=resumable&part=snippet,status&notifySubscribers=true", headers,
                                       json.dumps(payload, ensure_ascii=False).encode())
        expect(reply, "YouTube 업로드 세션", (200, 201))
        url = next((value for key, value in reply.headers.items() if key.lower() == "location"), None)
        if not url:
            raise MarketingError("YouTube가 재개 가능한 업로드 주소를 반환하지 않았습니다.")
        validate_session_url(url)
        return seal_session(url, self.credentials["refresh_token"])

    @staticmethod
    def offset(reply, total):
        if reply.status == 308:
            value = next((v for k, v in reply.headers.items() if k.lower() == "range"), "")
            if not value:
                return 0
            match = re.fullmatch(r"bytes=0-(\d+)", value)
            if not match or not 0 < int(match[1]) + 1 <= total:
                raise MarketingError("YouTube 재개 오프셋이 잘못되었습니다.")
            return int(match[1]) + 1
        expect(reply, "YouTube 업로드 상태", (200, 201))
        if not reply.json().get("id"):
            raise MarketingError("업로드 완료 응답에 영상 ID가 없습니다.")
        return None

    def upload(self, encrypted_session, video_path, progress=None):
        url = open_session_secret(encrypted_session, self.credentials["refresh_token"])
        path = Path(video_path)
        total = path.stat().st_size
        # Always ask the server. Local offsets do not establish remote acceptance.
        def status():
            reply = self.transport.request("PUT", url, {**self.auth(), "Content-Length": "0",
                                           "Content-Range": f"bytes */{total}"}, b"")
            self.offset(reply, total)
            return reply
        reply = status()
        offset = self.offset(reply, total)
        if offset is None:
            return reply.json()
        recovery_attempts = 0
        with path.open("rb") as stream:
            while offset < total:
                stream.seek(offset)
                chunk = stream.read(CHUNK)
                end = offset + len(chunk) - 1
                try:
                    reply = self.transport.request("PUT", url, {**self.auth(), "Content-Type": "video/mp4",
                                                   "Content-Length": str(len(chunk)),
                                                   "Content-Range": f"bytes {offset}-{end}/{total}"}, chunk)
                    if reply.status in (429, 500, 502, 503, 504):
                        raise MarketingError("일시적인 업로드 오류")
                except MarketingError:
                    recovery_attempts += 1
                    if recovery_attempts > 3:
                        raise MarketingError("업로드 접수 상태가 불명확합니다. 저장된 세션만 재개하며 새 영상을 만들지 않습니다.") from None
                    time.sleep(min(2 ** recovery_attempts, 8))
                    reply = status()
                new_offset = self.offset(reply, total)
                if new_offset is None:
                    return reply.json()
                if new_offset < offset or new_offset > total:
                    raise MarketingError("업로드 재개 위치가 범위를 벗어났습니다.")
                if new_offset == offset:
                    recovery_attempts += 1
                    if recovery_attempts > 3:
                        raise MarketingError("업로드가 진전되지 않습니다. 기존 세션을 보존합니다.")
                else:
                    recovery_attempts = 0
                offset = new_offset
                if progress:
                    progress(offset, total)
        # 308 at the end is not a successful completion. Preserve this session.
        reply = status()
        if self.offset(reply, total) is not None:
            raise MarketingError("전체 바이트가 전송됐지만 완료가 확인되지 않았습니다.")
        return reply.json()

    def thumbnail(self, video_id, path):
        headers = {**self.auth(), "Content-Type": "image/png"}
        reply = self.transport.request("POST", "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?"
                                       + urllib.parse.urlencode({"videoId": video_id, "uploadType": "media"}),
                                       headers, Path(path).read_bytes())
        return expect(reply, "YouTube 썸네일").json()

    def verify_schedule(self, video_id, episode):
        items = self.get("videos", part="id,snippet,status,processingDetails", id=video_id).get("items", [])
        if len(items) != 1 or items[0]["snippet"]["channelId"] != episode["channel_id"]:
            raise MarketingError("업로드된 영상의 소유 채널을 확인할 수 없습니다.")
        video = items[0]
        status = video["status"]
        if status.get("uploadStatus") in ("failed", "rejected", "deleted"):
            raise MarketingError("YouTube가 영상 처리 또는 게시를 거절했습니다.")
        scheduled = status.get("privacyStatus") == "private" and status.get("publishAt") == episode["publish_at"]
        already_public = status.get("privacyStatus") == "public" and datetime.now(timezone.utc) >= \
            datetime.fromisoformat(episode["publish_at"].replace("Z", "+00:00"))
        if not (scheduled or already_public):
            raise MarketingError("요청한 예약 공개 상태를 확인하지 못했습니다. 추가 업로드를 하지 않습니다.")
        marker = re.search(r"^BN_KEY=([^\r\n]+)$", video["snippet"].get("description", ""), re.M)
        if not marker or marker[1] != episode["key"]:
            raise MarketingError("업로드 영상의 관리 식별자가 일치하지 않습니다.")
        return video
