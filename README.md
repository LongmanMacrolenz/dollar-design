# 볼트노트

기계엔지니어가 혼자 운영하는 체결부품 견적·공급 사이트입니다.

- **첫 화면**: BOM·단면도 부품표를 붙여 넣거나 파일을 올리면 줄마다 규격(ASTM·ASME·KS·ISO)·등급·필요 서류를 맞춰 보여 줍니다. 엑셀·CSV는 양식에 상관없이 브라우저 안에서 읽고, PDF·사진·도면은 메일로 받습니다. 플랜지 3D 동영상, 문 3개, 카테고리 6개, 플랜트 볼팅 묶음.
- **품목 165종**: 품목마다 한글명·영문 정식명, 확인된 치수표, 견적 사양 입력. 일부 품목은 도면과 CAD(STEP·DXF) 다운로드.
- **목록 견적**: 엑셀·CSV·텍스트 목록을 줄마다 읽어 사양·서류 계획·도면을 붙이고, 판단이 필요한 줄과 공급 불가 줄을 따로 모읍니다. 견적서·C&D 시트·준수 요약을 만듭니다.
- **도면·규격**: B16.5 플랜지 스터드 길이(제조사 공개 차트 3곳 대조 참고값), 규격 대조표, 각인·표기 해석기. API 610 도구는 공개 출처를 확보할 때까지 숨겨 둡니다(`API610_TOOL`).
- **체결부품 규격 사전**: ASTM·ASME·ISO·EN·DIN·KS·JIS 규격, 등급·재질, 나사, 서류·시험, 코팅, 부품 용어 260항목. 사이트 안(`#lib`)과 검색엔진용 정적 페이지(`docs/lib/`)로 냅니다.
- **값의 출처**: 사이트의 모든 수치는 발행 기관 공개 페이지·공식 미리보기·공공 문서(RCSC, NRC, NASA, 미 군사규격 등) 또는 서로 다른 제조·유통사 공개 기술자료 3곳 이상이 일치하는 값만 싣습니다. 확인하지 못한 치수표는 "규격서 확인 중"으로 표시합니다. 규격 원문은 싣지 않습니다.
- **가격·주문**: 공급처 단가가 확인된 품목만 가격을 표시합니다. 통신판매업 신고 전에는 주문 대신 "주문 요청서(확인 후 진행)"를 만듭니다. 화면은 밝게가 기본입니다.

## 파일

| 경로 | 내용 |
|---|---|
| `app/` | **사이트 편집 원본.** `base.html`(바탕)과 `src/`(엔진·화면·도구 모듈), `build.py`, 점검 `tests/`. 설명은 `AGENTS.md`. |
| `tools/` | `build_all.py`(전체 빌드), `sync_lib.py`(규격 사전 반영), `check.py`(올리기 전 점검 한 번에) |
| `site/page.html` | `python3 tools/build_all.py`가 `app/`에서 만드는 사이트 본문(한 파일 웹앱). 글꼴만 Google Fonts에서 불러옵니다. 직접 고치지 않습니다. |
| `site/build.py` | `page.html`을 완전한 HTML 문서로 감싸 `docs/index.html`을 만듭니다. |
| `docs/index.html` | 배포본. 직접 고치지 말고 `python3 tools/build_all.py`로 다시 만듭니다. |
| `docs/_headers` | 응답 헤더(보안 헤더, 캐시) |
| `wrangler.jsonc` | Cloudflare Workers 배포 설정 (`docs/`만 공개) |
| `docs/robots.txt` | 검색 로봇 허용, 사이트맵 위치 |
| `docs/media/` | 첫 화면 동영상·GIF와 움직임 줄이기용 정지 이미지 |
| `site/lib.json` | **규격 사전 원본**(검토를 마친 항목만). 고친 뒤 `python3 tools/sync_lib.py` |
| `site/build_lib.py` | `site/lib.json`으로 `docs/lib/*.html`, `docs/sitemap.xml`을 만들고 `docs/robots.txt`에 사이트맵 줄을 넣습니다. |
| `docs/lib/`, `docs/sitemap.xml` | 규격 사전 정적 페이지와 사이트맵. 직접 고치지 말고 `python3 site/build_lib.py`로 다시 만듭니다. |
| `docs/og.png` | 링크 미리보기 이미지(카카오톡·메신저·SNS 공유 시 표시, 1280×720) |

## 배포

Cloudflare Workers(정적 파일, 무료)가 `main` 브랜치의 `docs/` 폴더를 배포합니다. 설정은 `wrangler.jsonc`에 있습니다.

| 설정 (Cloudflare 대시보드 → Worker `boltnote` → Settings → Build) | 값 |
|---|---|
| Git 저장소 | `LongmanMacrolenz/dollar-design` |
| 프로덕션 브랜치 | `main` |
| 빌드 명령 | `exit 0` |
| 배포 명령 | `npx wrangler deploy` |
| 미리보기 빌드 | 쓰지 않음. 이 저장소에서는 PR 미리보기 빌드가 실패하지만 공개 배포에는 영향이 없습니다. 공개 배포는 main 빌드만 사용합니다. |

`wrangler.jsonc`의 `name`은 대시보드의 Worker 이름과 같아야 합니다. `docs/_headers`의 보안·캐시 헤더도 함께 적용됩니다.

검색 제목·설명과 링크 미리보기(og 태그)는 `site/build.py` 맨 위의 `SITE_URL`, `SEO_TITLE`, `SEO_DESC`에서 바꿉니다. 도메인을 사면 `SITE_URL`만 고치면 됩니다.

GitHub Pages는 약관상 온라인 사업·전자상거래 사이트에 쓸 수 없으므로 게시를 끕니다.

## 공개 전에 바꿔야 할 것

- 사업자 정보는 반영했습니다: 사업자등록번호 456-19-02858, 대표 박세중, 견적 메일, 전화 010-2093-0196(평일 19~21시). 바닥글·회사 소개·견적서 공급자 칸·C&D에 들어갑니다(`SHOP`, `CONTACT`).
- 카카오톡 채널은 이름(볼트노트)만 보입니다. 채널을 공개한 날 `CONTACT.kakaoChat`에 채팅 주소를 넣어 버튼과 바닥글을 연결합니다.
- 사업장 주소는 자택이라 표시하지 않습니다(`SHOP.addr` 빈 값이면 바닥글·견적서에서 숨김). 통신판매업 신고 전에 자택 주소로 할지 비상주 사무실로 할지 정합니다. 신고하면 공정위 사업자정보 공개 페이지에 신고 주소가 나오고, 사이트에도 표시해야 합니다.
- 통신판매업 신고번호가 들어가면 주문 접수와 공정위 사업자정보 확인 링크가 켜집니다. 팩스는 없어서 숨겼습니다.
- 공급처 단가가 확인되면 품목군별로 가격을 켭니다. 납기 범위는 자리표시입니다.
- 견적 요청은 사이트가 요청서 파일을 만들고 고객이 메일·카카오톡으로 보내는 방식입니다. 메일·전화는 반영했고 카카오톡 채팅 주소만 남았습니다.

## 작업 방법 (사람·ChatGPT·Claude 공통)

`AGENTS.md`에 저장소 지도, 고치는 순서, 사이트 글 규칙, **값의 출처 규칙**이 있습니다. 요약:

```bash
python3 tools/build_all.py   # app/ → site/page.html → docs/
python3 tools/check.py       # 빌드 일치 · 문법 · 금지어 · 엔진 점검 (pip install playwright, python -m playwright install chromium)
```

브랜치를 따로 만들어 Pull Request로 올립니다. PR마다 같은 점검(GitHub Actions)이 돕니다. `main`에 합치면 Cloudflare가 곧바로 배포하므로 병합은 대표가 합니다.
