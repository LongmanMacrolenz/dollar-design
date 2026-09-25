# 1화 제작 폴더

| 단계 | 누가 | 할 일 | 볼 파일 | 결과를 넣을 곳 |
|---|---|---|---|---|
| 1 | 본인 | 캐릭터 시트 7장 뽑기 | [production/캐릭터시트_프롬프트.md](production/캐릭터시트_프롬프트.md) | `assets/sheets/sheet_01.png` ~ `sheet_07.png` |
| 2 | 본인 | 배역별 녹음 (63줄) | [production/녹음대본.md](production/녹음대본.md) | `audio/C008_서진.wav` 처럼 표의 파일 이름 그대로 |
| 3 | 본인 | 100컷 그림·영상 뽑기 | [production/프롬프트_붙여넣기.md](production/프롬프트_붙여넣기.md) | `assets/C001.png`, 움직이는 컷은 `assets/C001.mp4` |
| 4 | **자동** | 가편집본 조립 | `tools/assemble.py` | `output/ep01_가편집.mp4` + `output/timing.md` |
| 5 | 본인 | 마무리 편집, 업로드 | [컷_지시서.md](컷_지시서.md) 8장, `upload/업로드_키트.md` | YouTube |

## 파일을 올리는 방법

GitHub 웹에서 이 폴더의 `assets/` 또는 `audio/`로 들어가 **Add file → Upload files**로 끌어다 놓으면 됩니다. 한 번에 100개까지 올릴 수 있습니다. 올린 뒤 "1화 조립해 줘"라고 말하면 가편집본을 만들어 드립니다.

- 그림이 없는 컷은 자리표시 카드로 채워지므로, **일부만 올려도 조립할 수 있습니다.** 10컷씩 올리면서 확인해도 됩니다.
- 녹음을 넣으면 컷 길이가 녹음에 맞춰 자동으로 늘어나고, 유튜브 챕터 시간이 `output/timing.md`에 새로 계산됩니다.
- 영상 파일(`output/`)은 용량이 커서 저장소에 올리지 않습니다.

## 파일 이름 규칙

| 종류 | 이름 | 예 |
|---|---|---|
| 정지 그림 | `컷번호.png` (jpg, webp도 가능) | `C012.png` |
| 입 모양 컷 | 입 닫은 그림 `컷번호.png` + 입 연 그림 `컷번호_b.png` | `C007.png`, `C007_b.png` |
| 움직이는 컷 | `컷번호.mp4` (그림보다 우선) | `C026.mp4` |
| 녹음 | `컷번호_배역.wav` (mp3, m4a도 가능) | `C045_투키디데스.wav` |

## 직접 조립하려면 (선택)

```
pip install imageio-ffmpeg
cd dollar-design/tools
python3 cutlist.py ../episodes/ep01
python3 assemble.py ../episodes/ep01
```

컷 지시서를 고쳤다면 `cutlist.py`부터 다시 실행하세요.
