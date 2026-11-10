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
    print("built Boltnote brand assets")


if __name__ == "__main__":
    build()
