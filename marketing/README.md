# Fasteners 일일 YouTube 마케팅

한국어 AI 내레이션·자막과 직접 만든 제품 렌더링으로 **5분 30초 영상**을 만들고, 연결한 채널에 **매일 한국 시간 오후 8시** 예약 공개합니다. 검토된 주제는 30개입니다. 모든 주제를 쓰면 새 출처·대본을 검토하여 추가할 때까지 중단합니다.

음성은 CPU에서 실행하는 한국어 신경망 모델입니다. **OpenAI·ElevenLabs 계정, 음성 API 키, 건당 음성 API 요금이 필요하지 않습니다.** 대본도 검토된 편집 자료를 사용하므로 언어 모델 API를 호출하지 않습니다. 음성은 유료 서비스보다 기계적으로 들릴 수 있으며, 약어·규격 발음은 실제 샘플로 확인해야 합니다.

## 비용과 실행 장소

- 한국어 음성 모델 다운로드·로컬 추론: 별도 음성 API 이용료 없음.
- YouTube Data API: 할당량 적용, 통상 할당량 안에서 별도 호출 이용료 없음.
- 이 공개 저장소의 GitHub Actions 표준 Ubuntu 실행기: 공개 저장소 무료 범위 사용. 유료 실행기·비공개 저장소로 옮기면 GitHub의 요금·한도를 다시 확인합니다.
- 영상 렌더링에는 CPU·저장 공간이 필요합니다. 개인 서버에서 돌리면 해당 서버 운영 비용은 별도입니다.

Codex 클라우드는 개발·검증 장소입니다. 매일 실행하는 곳은 GitHub Actions이며, **코드를 기본 브랜치에 병합하고 채널 설정과 `MARKETING_ENABLED=true`를 등록해야** 일일 실행이 활성화됩니다.

## 먼저 무료 샘플 만들기

Python 3.12+, ffmpeg·ffprobe가 필요합니다. 저장소에는 음성 모델·생성 영상·인증 파일을 커밋하지 않습니다.

```bash
python -m venv .venv-marketing
source .venv-marketing/bin/activate
python -m pip install -r marketing/requirements.txt
python -m marketing setup-model
python -m marketing sample --out out/marketing-sample
```

`video.mp4`, `thumbnail.png`, `captions.srt`, `narration.txt`를 확인합니다. `sample`은 API 호출이나 업로드를 하지 않습니다. `preview`는 음성 없는 구성 미리보기이며 게시용으로 사용할 수 없습니다. 샘플을 다시 만들 때는 새 출력 폴더를 지정합니다.

## YouTube 연결: 필요한 값은 Google에서만 받습니다

### 1. Google OAuth 클라이언트 JSON 다운로드

계정 소유자의 컴퓨터에서 진행합니다.

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 선택하거나 만듭니다.
2. API 및 서비스 → 라이브러리 → **YouTube Data API v3**를 사용 설정합니다.
3. Google Auth Platform의 Branding·Audience·Data Access에서 앱 동의 화면을 설정합니다. 외부 앱의 테스트 단계에서는 업로드할 Google 계정을 테스트 사용자에 추가합니다.
4. [API 및 서비스 → 사용자 인증 정보](https://console.cloud.google.com/apis/credentials)에서 OAuth 클라이언트 ID → **데스크톱 앱**을 만듭니다. JSON을 다운로드하여 저장소 밖에 보관합니다. 일반 API 키나 서비스 계정 JSON으로는 개인 YouTube 채널 업로드를 연결할 수 없습니다.
5. 대상 채널의 ID는 [YouTube 고급 계정 설정](https://www.youtube.com/account_advanced)에서 확인합니다. `UC`로 시작하는 채널 ID를 사용합니다.

JSON 안의 `client_id`가 `YOUTUBE_CLIENT_ID`, `client_secret`이 `YOUTUBE_CLIENT_SECRET`입니다. 값을 채팅이나 공개 저장소에 붙이지 마세요.

### 2. Google 로그인으로 갱신 토큰 생성

아래 명령은 **본인 컴퓨터**에서 실행합니다. 본인의 브라우저와 같은 컴퓨터의 루프백 콜백을 사용하므로 원격 Codex 터미널에서 로그인 완료를 기다리는 방식은 사용할 수 없습니다.

```bash
python -m marketing connect-youtube \
  --client-secrets "$HOME/Downloads/client_secret_desktop.json" \
  --output "$HOME/boltnote-youtube-owner.json" \
  --channel-id UC본인채널ID
```

브라우저에서 채널 계정으로 로그인하여 업로드·채널 읽기 권한을 승인합니다. 프로그램이 채널을 확인하고 `refresh_token`을 포함한 파일을 권한 0600으로 저장합니다. **`YOUTUBE_REFRESH_TOKEN`은 콘솔에서 찾는 값이 아니라 이 로그인으로 생성하는 값**입니다. 비밀값은 터미널에 출력하지 않습니다.

외부 OAuth 앱이 **Testing** 상태이면 YouTube 권한의 갱신 토큰이 일반적으로 7일 후 만료됩니다. 지속 운영 전 Google의 게시·검증 요구 사항을 확인해 Production 구성으로 전환합니다. 또한 신규·미감사 YouTube API 프로젝트는 업로드가 비공개로 제한될 수 있습니다. 공개 예약 운영에 필요한 [YouTube API 감사 조건](https://developers.google.com/youtube/v3/docs/videos/insert)을 먼저 확인합니다. 썸네일 설정에는 채널의 해당 기능 사용 자격도 필요합니다. 프로그램은 예약 상태를 확인하지 못하면 완료로 처리하지 않습니다.

### 3. GitHub에 연결 정보 등록

GitHub CLI를 설치하고 `gh auth login`으로 저장소 설정 권한이 있는 계정에 로그인합니다.

```bash
python -m marketing configure-github \
  --credentials "$HOME/boltnote-youtube-owner.json" \
  --repo LongmanMacrolenz/dollar-design
```

이 명령은 연결 채널을 먼저 확인하고 값을 표준 입력으로만 전달합니다. 처음에는 일일 실행을 끈 상태로 등록합니다. 수동으로 입력한다면 저장소 → Settings → Secrets and variables → Actions에 아래 값을 등록합니다.

| 종류 | 이름 | 어디에서 받나 |
|---|---|---|
| Variable | `YOUTUBE_CLIENT_ID` | 다운로드한 OAuth JSON의 `client_id` |
| Variable | `YOUTUBE_CHANNEL_ID` | 연결한 채널의 `UC…` ID |
| Variable | `MARKETING_ENABLED` | 처음에는 `false` |
| Secret | `YOUTUBE_CLIENT_SECRET` | OAuth JSON의 `client_secret` |
| Secret | `YOUTUBE_REFRESH_TOKEN` | 로그인으로 생성한 소유자 JSON의 `refresh_token` |

GitHub Secret은 저장 후 원래 값을 다시 보여주지 않습니다. 수정하려면 원본 파일의 값으로 교체합니다. 이름·등록 여부는 `gh secret list --repo LongmanMacrolenz/dollar-design`으로 확인할 수 있습니다.

### 4. 첫 예약 공개 확인 후 일일 실행 켜기

PR 병합 후 Actions → **Fasteners daily marketing** → Run workflow에서 기본 브랜치와 `mode=publish`를 선택합니다. 날짜를 비우면 한국 기준 다음 날 오후 8시로 예약합니다. `mode=preview`는 음성 없는 구성 확인만 실행합니다.

YouTube Studio에서 대상 채널·제목·한국어 음성·자막·썸네일과 실제 예약 공개를 확인합니다. 이후 아래 명령으로 일일 실행을 켭니다.

```bash
gh variable set MARKETING_ENABLED --repo LongmanMacrolenz/dollar-design --body true
```

매일 오전 7시 KST에 **다음 날 오후 8시** 영상을 미리 제작·전송합니다. GitHub 예약 실행은 지연될 수 있으므로 37시간 여유를 둡니다. 공개 시각은 YouTube의 예약 공개가 담당합니다. 중단하려면 같은 변수를 `false`로 바꿉니다. 이미 YouTube에 예약된 영상의 공개는 이 변수만으로 취소되지 않으며 Studio에서 별도로 변경합니다.

## 운영과 복구

- 채널의 모든 업로드를 읽어 날짜·관리 키·사용한 주제를 확인합니다. 채널 목록이 불완전하거나 같은 날짜 영상이 여러 개면 새 업로드를 중단합니다.
- YouTube가 발급한 재개 세션 주소는 갱신 토큰으로 암호화합니다. 미디어 전송 전에 GitHub 캐시 저장을 API로 확인합니다. 중간 접수 결과가 불명확해도 같은 세션을 조회·재개하며 새 영상을 삽입하지 않습니다.
- 영상 ID를 먼저 저장하므로 썸네일 실패 후 재시도에서 영상이 중복 생성되지 않습니다. Actions의 실패 실행을 다시 실행하면 저장된 작업을 먼저 복구합니다.
- GitHub 캐시는 영구 데이터베이스가 아닙니다. 진행 중인 작업의 캐시를 지우지 마세요. 세션 만료·캐시 소실·마커를 지운 수동 편집은 Studio에서 접수 상태를 확인한 뒤 관리자가 처리합니다. 프로그램이 자동으로 기존 영상을 삭제하거나 새 업로드로 대체하지 않습니다.
- Actions 결과물은 7일 보관하며 공개용 영상·썸네일·자막·대본만 포함합니다. 토큰·세션·인증 파일은 업로드하지 않습니다. 보관이 필요하면 결과물을 별도로 내려받습니다.
- 주제별 원문 해시가 바뀌면 제작이 중단됩니다. `site/lib.json`의 공개 근거와 `app/SOURCE_RULE.md`에 따라 내용을 다시 검토한 뒤 catalog를 갱신합니다. 유료 규격 전문·타사 자료·고객 주문 자료를 영상에 넣지 않습니다.
- 자막의 장면 경계는 생성 음성의 실제 길이로 맞춥니다. 장면 안의 문장별 시간은 추정치이며 단어 단위 강제 정렬은 아닙니다.

```bash
python -m marketing topics
python -m unittest discover -s marketing/tests -v
python -m marketing doctor
```

## 음성 출처와 라이선스

한국어 음성: [Mycroft mimic3-voices ko_KO/kss_low](https://github.com/MycroftAI/mimic3-voices/tree/b239a9084e21fbaa7ac78ea6e31f5de1c31c8f42/voices/ko_KO/kss_low), **CC0**. [라이선스 사본](third-party/mimic3-ko-CC0.txt)을 보관합니다. 변환 ONNX 모델은 [sherpa-onnx 공식 릴리스](https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models)를 사용합니다. 런타임은 sherpa-onnx(Apache-2.0), 포함된 발음 데이터는 eSpeak NG의 해당 라이선스가 적용됩니다. 다운받은 원본 번들의 안내와 의존성 라이선스를 보존합니다.

압축 파일 SHA-256: `f015d1d15a52ed00d6fe22757c5ef4a74283c53daf829c838fa5c22616ed789c`. 모델·토큰 파일도 검사하며, 모델이 바뀌어도 조용히 새 파일을 사용하지 않습니다.
