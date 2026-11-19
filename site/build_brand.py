"""Copy original brand assets into the public static deployment."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent


def build():
    source = ROOT / "app" / "brand"
    target = ROOT / "docs" / "brand"
    target.mkdir(exist_ok=True)
    # 소개서 PDF(boltnote-intro.pdf)는 tools/render_intro.py가 만들어 app/brand에 둔다
    for name in ("boltnote-logo.svg", "boltnote-logo-light.svg", "boltnote-mark.svg", "boltnote-social.png", "boltnote-intro.pdf"):
        shutil.copyfile(source / name, target / name)
    # Transition 광고 (site/tr-ad/ → docs/assets/tr-ad/): 한국어 쪽의 광고 자리가 불러온다 (site/build_lib.py TRAD)
    ads_src, ads_dst = ROOT / "site" / "tr-ad", ROOT / "docs" / "assets" / "tr-ad"
    ads_dst.mkdir(parents=True, exist_ok=True)
    for path in sorted(ads_src.rglob("*")):   # 그림(img/*)은 tr-ad.js의 IMG 기본값(/assets/tr-ad/)에 맞춰 같은 폴더에 평평하게 둔다
        if path.is_file():
            shutil.copyfile(path, ads_dst / path.name)
    print("built Boltnote brand assets")


if __name__ == "__main__":
    build()
