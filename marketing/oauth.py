"""Run on the account owner's computer: desktop OAuth with state and PKCE."""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from .content import MarketingError, ROOT
from .pipeline import write_json
from .services import API, SCOPES, TOKEN, Transport, expect


def connect(client_file, output, expected_channel=None, open_browser=True, transport=None):
    transport = transport or Transport()
    output = Path(output).expanduser().resolve()
    if output.is_relative_to(ROOT):
        raise MarketingError("OAuth 비밀 파일은 공개 저장소 밖의 경로에 저장하세요.")
    if output.exists():
        raise MarketingError("기존 OAuth 파일을 덮어쓰지 않습니다. 다른 출력 경로를 선택하세요.")
    app = json.loads(Path(client_file).expanduser().read_text()).get("installed")
    if not app or not app.get("client_id") or not app.get("client_secret"):
        raise MarketingError("Google Cloud의 데스크톱 앱 OAuth 클라이언트 JSON이 필요합니다.")
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    result = {}

    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # callback query includes the short-lived authorization code

        def do_GET(self):
            parsed = urllib.parse.urlsplit(self.path)
            query = urllib.parse.parse_qs(parsed.query)
            if parsed.path != "/oauth/callback" or query.get("state") != [state]:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid OAuth state.")
                return
            if query.get("error") or not query.get("code"):
                result["error"] = True
            else:
                result["code"] = query["code"][0]
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write("승인을 받았습니다. 터미널에서 채널 확인 결과를 확인하세요.".encode())

    with HTTPServer(("127.0.0.1", 0), Callback) as server:
        server.timeout = 1
        redirect = f"http://127.0.0.1:{server.server_port}/oauth/callback"
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
            "client_id": app["client_id"], "redirect_uri": redirect, "response_type": "code",
            "scope": " ".join(SCOPES), "state": state, "code_challenge": challenge,
            "code_challenge_method": "S256", "access_type": "offline", "prompt": "consent",
        })
        print("이 명령은 계정 소유자의 컴퓨터에서 실행하세요. 승인 주소 (비밀키 포함 없음):\n" + url, flush=True)
        if open_browser:
            webbrowser.open(url)
        deadline = time.monotonic() + 600
        while not result and time.monotonic() < deadline:
            server.handle_request()
    if result.get("error") or not result.get("code"):
        raise MarketingError("YouTube 승인이 취소되었거나 10분 안에 완료되지 않았습니다.")
    payload = urllib.parse.urlencode({"client_id": app["client_id"], "client_secret": app["client_secret"],
                                     "code": result["code"], "code_verifier": verifier,
                                     "redirect_uri": redirect, "grant_type": "authorization_code"}).encode()
    token = expect(transport.request("POST", TOKEN,
                   {"Content-Type": "application/x-www-form-urlencoded"}, payload), "Google OAuth 승인").json()
    if not token.get("refresh_token") or not token.get("access_token"):
        raise MarketingError("오프라인 갱신 권한이 없습니다. 오프라인 액세스 동의로 다시 연결하세요.")
    if token.get("scope") and not set(SCOPES).issubset(set(token["scope"].split())):
        raise MarketingError("YouTube 업로드와 채널 읽기 권한을 모두 승인해야 합니다.")
    channels = expect(transport.request("GET", API + "channels?part=id,snippet&mine=true",
                      {"Authorization": "Bearer " + token["access_token"]}), "YouTube 채널 확인").json().get("items", [])
    if expected_channel:
        channels = [c for c in channels if c["id"] == expected_channel]
    if len(channels) != 1:
        raise MarketingError("연결할 채널을 하나로 확인할 수 없습니다. --channel-id로 지정하세요.")
    channel = channels[0]
    write_json(output, {"client_id": app["client_id"], "client_secret": app["client_secret"],
                        "refresh_token": token["refresh_token"], "channel_id": channel["id"],
                        "scope": list(SCOPES)})
    os.chmod(output, 0o600)
    print("연결된 채널:", channel["snippet"]["title"], channel["id"])
    print("비밀값은 출력하지 않았습니다. 권한 0600 파일에 저장했습니다:", output)
    return {"channel_id": channel["id"], "credentials_file": str(output)}
