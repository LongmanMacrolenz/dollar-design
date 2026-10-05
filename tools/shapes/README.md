# tools/shapes — 품목 형상 이미지 (현실 같은 렌더링)

품목 165종 각각을 **Blender(Cycles)로 그린 형상 이미지**를 만듭니다. 마감(백색아연·흑착색·용융아연·스테인리스 …)마다 색이 다른 이미지를 만들어,
품목 페이지에서 고객이 마감을 고르면 그 색의 형상이 보이게 합니다. 결과물은 `docs/media/shape/<품목군id>-<룩>.webp` 입니다.

- 이미지는 **참고용 렌더링**입니다. 규격 공칭 치수 기준의 대표 호칭(M12 등)을 그렸고, 실제 공급 제품의 사진이 아닙니다. 사이트에도 그렇게 밝힙니다.
- 사이트 빌드·CI와 무관합니다 (`bpy`가 크기 때문에 CI에서 돌리지 않고, 결과 이미지만 저장소에 올립니다).
- 형상은 규격이 정한 모양(머리·나사산·모따기·구멍·홈)을 따릅니다. 제조사 로고·상표·회사 이름 같은 각인은 넣지 않습니다.

## 준비

```bash
python3.11 -m venv .venv-shapes && .venv-shapes/bin/pip install bpy==4.5.0 pillow numpy   # bpy는 약 370 MB
```

## 쓰는 법

```bash
python tools/shapes/render_all.py --list                          # 등록된 품목군 / 아직 빌더가 없는 품목군
python tools/shapes/render_all.py --info hbf,hn                   # 품목 이름·규격·재질·마감·주의 (모양을 떠올릴 때 읽는다)
python tools/shapes/render_all.py --ids hbf,hn --preview --sheet --out /tmp/prev   # 시험 렌더 + 접촉 시트 (320×240, 24샘플, 한 장 약 5초)
python tools/shapes/render_all.py --all --final                   # 전부 최종 품질 (640×480) → docs/media/shape/*.webp
python tools/shapes/render_all.py --manifest                      # docs/media/shape/ 를 훑어 app/src/v9_shape.js 의 목록 갱신
```

룩(마감 색)은 품목군 데이터의 `fins`·`mats`에서 `looks.py`가 정합니다 (첫째가 기본 이미지). `--looks ZW,BO`로 강제하거나,
빌더에서 `@family('id', looks=['AL', 'ZW'])`로 고정합니다.

## 파일

| 파일 | 내용 |
|---|---|
| `geo.py` | 형상 프리미티브 (numpy). 나사산 `thread_rod`·`thread_bore`, 둥근 모서리 육각 몸체 `polybody`, 회전체 `lathe`, 압출 `extrude`, 쓸기 `sweep`·`wire`, 상자 `box` … |
| `parts.py` | 공용 부품(ISO 공칭 치수표, 육각 머리·너트·와셔) · 구멍 커터(`cut_hex`·`cut_cross`·`cut_slot`·`cut_torx`) |
| `bl.py` | Blender 쪽: `Model`, 마감별 재질(`LOOKS`), 스튜디오 장면(소프트박스·바닥·카메라), `render()` |
| `looks.py` | 마감·재질 라벨 → 룩 매핑 (사이트 `app/src/v9_shape.js`와 같은 규칙) |
| `fams/*.py` | 품목군별 빌더. `@family('id')` 로 등록 |
| `render_all.py` | 실행 도구 |

## 빌더 작성 규약

```python
import bl, parts as P
from fams import family
from geo import *

@family('hn')
def hex_nut(fid):                      # fid = 등록한 id 중 지금 그릴 것 (한 함수가 여러 id를 맡을 수 있음)
    m = bl.Model(fid)
    m.add(P.hex_nut_mesh(12, 18, 10.8), 'body', sharp=24)    # (메시, 재질 키, 각진 모서리 기준 각도)
    return m.view(el=42)               # 보여 줄 자세·카메라를 정한 뒤 돌려준다
```

- **좌표**: 길이 mm. 부품 축은 +Z. **머리(위쪽 끝)는 +Z, 몸통·나사는 −Z 쪽**, 머리 밑면이 z=0 (볼트류). 너트·와셔는 z=0 → +높이.
  바닥에 놓는 일(최저점을 z=0에)은 렌더러가 합니다.
- **자세**: 볼트·핀·스터드처럼 긴 것은 `m.lie(yaw)`로 눕힙니다 (머리가 화면 왼쪽 앞. 머리 윗면의 구멍·홈을 보여야 하면 `yaw`를 85~100으로 올려 끝이 카메라 반대쪽을 향하게).
  너트·와셔·링처럼 납작한 것은 눕히지 말고 바닥에 놓고 `m.view(el=40)`으로 위에서 내려다봅니다. 공중에 뜬 듯한 기울임은 피합니다.
  `m.rotx/roty/rotz(도)`로 직접 돌려도 됩니다. 카메라 기본: 방위 `az=-38`, 고도 `el=24`, 화면 채움 `fill=0.74`.
- **재질 키** (`m.add(mesh, key)`): `'body'` = 마감 룩을 따르는 주 재질(렌더 때 백색아연·흑착색 …로 바뀜).
  고정 재질: `bright`(연삭 가공면: 핀·키), `steel`(방청유 생지 강), `dark`, `rubber`, `nylon`(파랑), `nylonw`(흰색), `brass`, `copper`, `alu`, `ss`,
  `blue yellow red green orange white black`(도장·플라스틱). 룩이 정해진 부품(구리 실링 링 등)은 고정 재질로, 마감에 따라 달라지는 것은 `body`로.
- **모서리**: `sharp=각도`보다 큰 모서리는 각지게, 작은 것은 매끈하게 음영합니다. 나사산은 `sharp=40`, 육각·원통 몸체는 24~35. 날카로운 모서리에는 0.1~0.3 mm 둥글림/모따기를
  넣으면 하이라이트가 살아납니다 (`bevel=폭`은 단순 상자·압출에만. 촘촘한 격자에는 쓰지 말 것).
- **구멍·홈**은 `m.add(mesh, 'body', cut=[커터 메시, …])` (EXACT 불리언 DIFFERENCE). 커터는 대상보다 1 mm쯤 튀어나오게. 촘촘한 나사 메시에는 쓰지 않습니다.
- 메시를 합칠 때 겹치는 꼭짓점은 `weld`되고 면 방향은 Blender가 바깥쪽으로 정리하니 감는 방향은 신경 쓰지 않아도 됩니다. 닫힌 입체만 만드세요(열린 면 금지).
- **크기**: 대표 호칭 하나 (미터 M12, 인치 1/2"). 비례는 ISO·ASME 공칭 치수에 맞춥니다 (`parts.ISO_*`). 한 장면에 두세 개를 놓을 때(볼트+너트+와셔)는 서로 겹치지 않게 옮겨 놓고 서로 맞는 크기로.
- **하지 말 것**: 상표·회사 이름·제조사 각인, 실제 제품 사진을 베끼기. 강도 구분 숫자(8.8 등) 각인은 아직 지원하지 않습니다.

## 점검 (모든 품목군)

접촉 시트(`--sheet`)를 눈으로 봅니다: ① 규격의 모양인가(머리 모양·홈·구멍·모따기) ② 비례가 실제 제품 같은가 ③ 보여 줘야 할 면(구멍·홈·구멍 나사산)이 카메라 쪽인가
④ 뒤집힌 면·구멍 난 면·튀어나온 조각이 없는가 ⑤ 마감 룩(ZW·BO·SS 등)에서 색이 자연스러운가.
