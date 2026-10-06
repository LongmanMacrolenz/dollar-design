"""품목군(165종)별 형상 빌더 등록부.

    @family('hbf', 'hbp')               # 품목군 id 여러 개를 한 함수가 맡아도 됨 (fid로 구분)
    def hex_bolts(fid): ...             # → bl.Model 반환 (이미 놓인 자세로)

빌더가 돌려주는 Model은 부품 축이 +Z인 채로 만들고, 마지막에 .rotx/.roty/.rotz로 보여 줄 자세를 잡습니다.
Model.cam = dict(az=…, el=…, fill=…)을 넣으면 카메라(방위·고도·화면 채움)를 바꿀 수 있습니다.
fams 폴더의 모든 모듈은 import 때 자동으로 읽힙니다.
"""
import importlib
import pkgutil

REG = {}
LOOKS = {}      # 품목군 id → 만들 룩 목록 (없으면 looks.py가 mats·fins에서 정함)


def family(*ids, looks=None):
    """looks: 리스트(모든 id에 적용) 또는 {id: 리스트}. 첫째가 기본 이미지"""
    def deco(fn):
        for i in ids:
            if looks is not None:
                LOOKS[i] = list(looks[i] if isinstance(looks, dict) else looks) if (not isinstance(looks, dict) or i in looks) else None
                if LOOKS[i] is None:
                    del LOOKS[i]
            if i in REG:
                raise RuntimeError(f'품목군 {i} 가 두 번 등록됨: {REG[i].__module__}.{REG[i].__name__} / {fn.__module__}.{fn.__name__}')
            REG[i] = fn
        return fn
    return deco


def load_all():
    for m in pkgutil.iter_modules(__path__):
        importlib.import_module(f'{__name__}.{m.name}')
    return REG
