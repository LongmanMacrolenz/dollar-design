"""올리기 전 점검을 한 번에 돈다.

    python3 tools/check.py            전부
    python3 tools/check.py --fast     브라우저가 필요한 엔진 점검은 건너뜀

1. 규격 사전 데이터(site/lib.json)가 규칙에 맞고 app/src/ea_lib.js와 같은가       (tools/sync_lib.py --check)
2. 저장소의 결과물(site/page.html, docs/…)이 원본에서 만든 것과 같은가            (tools/build_all.py --check)
3. 사이트 스크립트에 문법 오류가 없는가                                             (Node가 있을 때)
4. 사이트·사전 페이지에 금지어가 없는가 (재고·출고 약속, 서비스 약속, 가격 표시 등)
5. app/tests의 엔진 점검 3종이 통과하는가                                          (playwright 크로미움이 있을 때)
6. 홈페이지 체결 영상의 피치·좌면·공구 복귀 동작이 맞는가                          (Python 표준 라이브러리)
   (T2 치수표가 tools/t2/records 의 조사 기록과 같은지도 본다)
하나라도 실패하면 종료 코드 1. 브라우저 경로는 환경 변수 BN_CHROMIUM(없으면 playwright 기본).
직장 이름 같은 비공개 금지어는 환경 변수 BN_PRIVATE_BANNED('이름1|이름2') 또는 app/tests/private_banned.txt에서 읽는다.
"""
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
PY = sys.executable
FAILED = []


def step(name, ok, detail=""):
    print(("통과  " if ok else "실패  ") + name + (f" — {detail}" if detail else ""))
    if not ok:
        FAILED.append(name)


def run(args, **kw):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True, **kw)


def banned_words():
    base = ["재고 보유", "당일 출고", "저희가 공급", "저희가 보유", "PMI 서비스", "보증합니다", "협력사", "바로 공급", "₩"]
    extra = [x for x in os.environ.get("BN_PRIVATE_BANNED", "").split("|") if x.strip()]
    f = ROOT / "app" / "tests" / "private_banned.txt"
    if f.exists():
        extra += [l.strip() for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
    return base, extra


def main():
    fast = "--fast" in sys.argv

    r = run([PY, "tools/sync_lib.py", "--check"])
    step("규격 사전 데이터", r.returncode == 0, (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else "")

    r = run([PY, "tools/t2/apply.py", "--check"])
    step("T2 치수표가 조사 기록과 같음", r.returncode == 0, (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else "")

    r = run([PY, "tools/build_all.py", "--check"])
    step("결과물이 원본과 같음", r.returncode == 0, "" if r.returncode == 0 else (r.stdout + r.stderr).strip()[-600:])

    r = run([PY, "tools/test_precision.py"])
    step("체결 영상의 피치·좌면·공구 동작", r.returncode == 0,
         "6종 물리 조건" if r.returncode == 0 else (r.stdout + r.stderr).strip()[-600:])

    r = run([PY, "tools/test_material_film.py"])
    step("규격·재료 영상의 탄성 복귀·반복하중·장면 경계", r.returncode == 0,
         "5종 표현 조건" if r.returncode == 0 else (r.stdout + r.stderr).strip()[-600:])

    node = shutil.which("node")
    if node:
        r = run(["node", "tools/build_bom_reader.mjs", "--check"])
        step("BOM 표 읽기 원본 일치", r.returncode == 0, "" if r.returncode == 0 else r.stderr[-600:])
        r = run(["npm", "run", "test:procurement"])
        step("견적·메일·접근 제어 점검", r.returncode == 0, "" if r.returncode == 0 else (r.stdout + r.stderr).strip()[-1000:])
    page = (ROOT / "docs" / "index.html").read_text(encoding="utf-8")
    if node:
        scripts = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", page, re.S)
        bad = []
        for i, js in enumerate(scripts):
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as t:
                t.write(js)
            r = subprocess.run([node, "--check", t.name], capture_output=True, text=True)
            os.unlink(t.name)
            if r.returncode:
                bad.append(f"스크립트 {i + 1}: {r.stderr.strip().splitlines()[0] if r.stderr.strip() else '문법 오류'}")
        step("스크립트 문법", not bad, "; ".join(bad) if bad else f"{len(scripts)}개")
    else:
        print("건너뜀  스크립트 문법 (node 없음)")

    base, extra = banned_words()
    texts = {"docs/index.html": page}
    for p in sorted((ROOT / "docs" / "lib").glob("*.html")):
        texts[str(p.relative_to(ROOT))] = p.read_text(encoding="utf-8")
    hits = []
    for name, t in texts.items():
        visible = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S) if name != "docs/index.html" else t
        for w in base:
            # 사이트 본문 스크립트에는 주석·시험용 문구에 같은 말이 있을 수 있어 정적 페이지만 엄격히 본다
            if name != "docs/index.html" and w in visible:
                hits.append(f"{name}: {w}")
        for w in extra:
            if w in t:
                hits.append(f"{name}: (비공개 금지어)")
    step("금지어 없음 (정적 페이지 전체·사이트 본문의 비공개 금지어)", not hits, "; ".join(hits[:5]))

    if fast:
        print("건너뜀  엔진 점검 3종 (--fast)")
    else:
        try:
            import playwright  # noqa: F401
            have = True
        except ImportError:
            have = False
        if not have:
            print("건너뜀  엔진 점검 3종 (playwright 없음: pip install playwright && python -m playwright install chromium)")
        else:
            r = run([PY, "worker/tests/browser.py"])
            step("견적 관리 실제 브라우저 흐름", r.returncode == 0, "" if r.returncode == 0 else (r.stdout + r.stderr).strip()[-1000:])
            out = pathlib.Path(tempfile.mkdtemp(prefix="bn-check-"))
            for name in ("test.py", "holdout.py", "cdtest.py"):
                r = run([PY, f"app/tests/{name}", "--page", str(ROOT / "site" / "page.html"), "--out", str(out / name)])
                tail = (r.stdout + r.stderr).strip().splitlines()
                step(f"엔진 점검 {name}", r.returncode == 0, "" if r.returncode == 0 else " | ".join(tail[-4:])[:500])
            shutil.rmtree(out, ignore_errors=True)

    print()
    if FAILED:
        print("실패한 점검:", ", ".join(FAILED))
        return 1
    print("모든 점검 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
