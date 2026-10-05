# 홈페이지 체결 영상

`render_hero.py`는 직접 만든 형상과 조명으로 36초·24 fps 영상을 만듭니다.
`docs/media/boltnote-precision*`가 배포 파일이고, 홈페이지 제어는
`app/src/v7_motion.js`에 있습니다. 원본 프레임·Blender 장면·외부 패키지는
저장소 밖에 둡니다. 사이트 빌드나 환경 시작 시 영상을 다시 렌더링하지 않습니다.

## 형상과 동작의 범위

- ISO 68-1의 60° 기본 형상과 기존에 검토한 공칭 치수를 사용합니다.
  `precision_geometry.py`에 치수 원본 위치가 있습니다. 미터 볼트·너트·와셔는
  `app/base.html`의 `DIM`과 `app/src/t_cad.js`, 헤비 육각너트는
  `app/src/e1_data.js`의 `HHN_IN`(공개 RCSC 표), M8 평끝 멈춤나사는
  같은 파일의 ISO 4026 공식 미리보기 대조 값을 따릅니다.
- 나사 회전과 축 방향 이동은 동일한 피치로 연결합니다. 렌치는 풀린 상태에서
  재배치하고, 라쳇 복귀 중 비트와 나사는 회전하지 않습니다. 좌면·키에 닿은
  뒤에는 움직임을 멈춥니다. 유압 렌치는 인접 너트에 반력을 받습니다.
- 플랜지·하우징·축은 적용을 설명하는 일반 조립 예시입니다. 플랜지 압력 등급,
  제조 공차, 실제 체결 토크 또는 검사 합격을 주장하지 않습니다. 실제 조인트는
  도면과 적용 규격으로 확인합니다. 첨부 문서의 유료 표·그림은 사용하지 않습니다.

## 다시 만들기

Blender 4.3+, ffmpeg(libx264·libvpx-vp9·libwebp), Python의 numpy·Pillow와
Intel Open Image Denoise CPU 배포판이 필요합니다. OIDN은 공식 프로젝트의
공개 배포판을 별도 작업 디렉터리에 설치합니다.

```bash
python3 tools/test_precision.py
blender -b -t 4 -P tools/render_hero.py -- --audit --out /tmp/boltnote-audit
blender -b -t 4 -P tools/render_hero.py -- --out /tmp/boltnote-raw --width 1200 --samples 8
python3 tools/denoise_hero.py /tmp/boltnote-raw /tmp/boltnote-clean --oidn /path/to/oidn/bin/oidnDenoise
python3 tools/encode_hero.py /tmp/boltnote-clean
python3 tools/build_all.py
python3 tools/check.py
```

배포 포스터는 같은 유압 렌치 장면을 1600×1200·32 samples로 별도 렌더링합니다.
전체 영상 프레임이 완성된 뒤 다음처럼 더 큰 포스터를 선택할 수 있습니다.

```bash
blender -b -t 4 -P tools/render_hero.py -- --frames 818 --width 1600 --samples 32 --out /tmp/boltnote-poster
python3 tools/denoise_hero.py /tmp/boltnote-poster /tmp/boltnote-poster-clean --oidn /path/to/oidn/bin/oidnDenoise
python3 tools/encode_hero.py /tmp/boltnote-clean --poster /tmp/boltnote-poster-clean/0818.png
```

특정 장면만 점검할 때는 렌더 명령에 `--frames 24 175 330 530 688 818`을
추가합니다. 전체 렌더는 이미 완성된 프레임을 건너뛰고 중단 지점에서 이어갑니다.
형상·조명 설정을 바꾸면 영향을 받는 기존 프레임을 지운 뒤 다시 만듭니다.

`--audit`는 실제로 변환된 Blender 메시를 검사합니다. 렌치 27개 자세,
라챗 26개 자세, 육각렌치 7개 자세, 유압 렌치 23개 자세에서 공구와
조립체의 간섭을 확인하며 유압 반력 패드가 인접 너트의 평면에 닿는지도
검사합니다. 호스 크림프와 반력 패드의 의도적인 접촉을 구분합니다.
Blender는 스크립트 예외에도 종료 코드가 0일 수 있으므로 로그의
`HERO_AUDIT PASS`를 확인해야 합니다. 제조 공차·실제 토크의 검증은 아닙니다.

인코더는 0000–0863의 모든 프레임을 요구하며, 864프레임·36초인지 확인합니다.
광학 흐름 보간을 사용하지 않습니다. 같은 형상과 카메라가 유지되는 의도적인
정지 구간만 동일한 렌더를 재사용합니다. 1200×900 H.264·WebM, 800×600 모바일
H.264, 포스터와 적용 이미지 두 장을 만듭니다.

배포 전 실제 브라우저에서 자동 재생·정지·여섯 장면 선택·관련 사전 링크·
화면 밖 정지·페이지 이탈·모션 줄이기·데이터 절약·모바일 재생을 확인합니다.
