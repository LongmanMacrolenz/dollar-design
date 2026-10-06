"""사이트를 처음부터 끝까지 만든다.

    python3 tools/build_all.py           app/ → site/page.html → docs/index.html · docs/lib · docs/sitemap.xml
    python3 tools/build_all.py --check   저장소에 올라 있는 결과물이 지금 원본에서 만든 것과 같은지 확인한다 (파일은 바꾸지 않음)

순서:
  1. app/build.py          app/base.html + app/src/*  → site/page.html (본문 조각)
  2. site/build.py         site/page.html             → docs/index.html (배포용 문서)
  3. site/build_lib.py     site/lib.json + site/page.html → docs/lib/*.html, docs/sitemap.xml, docs/robots.txt
  4. site/build_products.py 공개 카탈로그 → docs/products/**/*.html
규격 사전 데이터(site/lib.json)를 고쳤다면 먼저 `python3 tools/sync_lib.py`를 돌려 app/src/ea_lib.js를 맞춘다.
"""
import filecmp
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY = sys.executable


def run(*args, cwd=ROOT):
    r = subprocess.run([PY, *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        print(r.stdout + r.stderr)
        sys.exit(f"실패: {' '.join(args)}")
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ""


def build(root: pathlib.Path):
    """root 안에서 세 단계를 모두 돈다 (root가 저장소면 실제 파일을, 임시 복사본이면 비교용을 만든다)."""
    print(run("app/build.py", "--base", "app/base.html", "--out", "site/page.html", cwd=root))
    print(run("site/build.py", cwd=root))
    print(run("site/build_lib.py", cwd=root))
    print(run("site/build_products.py", cwd=root))
    print(run("site/build_brand.py", cwd=root))
    r = subprocess.run(["node", str(ROOT / "tools/build_admin.mjs"), "--out", str(root / "docs/admin")], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stdout + r.stderr)
    print(r.stdout.strip())


def tree(root: pathlib.Path):
    keep = [root / "site" / "page.html", root / "docs" / "index.html", root / "docs" / "sitemap.xml", root / "docs" / "robots.txt"]
    keep += sorted((root / "docs" / "lib").glob("*.html"))
    keep += sorted((root / "docs" / "products").rglob("*.html"))
    keep += sorted((root / "docs" / "brand").glob("*"))
    keep += sorted((root / "docs" / "admin").glob("*"))
    return keep


def main():
    reader = subprocess.run(["node", str(ROOT / "tools/build_bom_reader.mjs"), *(["--check"] if "--check" in sys.argv else [])], capture_output=True, text=True)
    if reader.returncode:
        print(reader.stdout + reader.stderr)
        return 1
    if "--check" not in sys.argv:
        build(ROOT)
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        t = pathlib.Path(tmp)
        for d in ("app", "site", "docs"):
            shutil.copytree(ROOT / d, t / d, ignore=shutil.ignore_patterns("__pycache__", "out"))
        build(t)
        bad = []
        for f in tree(t):
            rel = f.relative_to(t)
            mine = ROOT / rel
            if not mine.exists() or not filecmp.cmp(f, mine, shallow=False):
                bad.append(str(rel))
        old = {p.relative_to(ROOT) for p in (ROOT / "docs" / "lib").glob("*.html")} - {p.relative_to(t) for p in (t / "docs" / "lib").glob("*.html")}
        bad += [f"{p} (원본에 없는 항목의 낡은 페이지)" for p in sorted(old)]
        old_products = {p.relative_to(ROOT) for p in (ROOT / "docs/products").rglob("*.html")} - {p.relative_to(t) for p in (t / "docs/products").rglob("*.html")}
        bad += [f"{p} (원본에 없는 품목의 낡은 페이지)" for p in sorted(old_products)]
        if bad:
            print("다름 — `python3 tools/build_all.py`를 실행해 결과물을 다시 만들고 함께 올리세요:")
            for b in bad[:20]:
                print("  ", b)
            return 1
        print("결과물이 원본과 같습니다")
        return 0


if __name__ == "__main__":
    sys.exit(main())
