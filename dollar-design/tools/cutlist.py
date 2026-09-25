#!/usr/bin/env python3
"""컷 지시서(컷_지시서.md)를 읽어 제작용 시트를 만든다.

사용법:
    python3 cutlist.py ../episodes/ep01

만드는 파일 (episodes/epNN/production/):
    cuts.json                 assemble.py가 읽는 컷 데이터
    프롬프트_붙여넣기.md        [STYLE] 같은 표시를 모두 풀어 쓴 컷별 지시문 (GitHub에서 복사 버튼으로 바로 복사)
    캐릭터시트_프롬프트.md       캐릭터 시트 지시문 완성본
    prompts.csv               엑셀·구글 시트용 컷 관리표
    녹음대본.md                배역별 대사와 녹음 파일 이름
"""
import csv
import json
import re
import sys
from pathlib import Path

CUT_HEAD = re.compile(r"^\*\*(C\d{3})\*\*\s+`(\d+:\d{2})`\s+(.+)$")
FIELD = re.compile(r"^- (화면|그림|움직임|소리|편집|수위|팁|주의):\s*(.*)$")
BLOCK_DEF = re.compile(r"^\[([A-Z]+)\]\s*=\s*(.+)$")
LINE = re.compile(r'\*\*([^*]+)\*\*\s*(?:\(([^)]*)\)\s*)?"([^"]+)"')
ANCHOR = re.compile(r'앵커들[^"]*"([^"]+)"')
OVERLAY = re.compile(r"(?:오버레이|→)\s*(\d{2})")
FPS = 24


def parse_duration(rest):
    if "1프레임" in rest:
        return 1 / FPS
    m = re.search(r"([\d.]+)초", rest)
    return float(m.group(1)) if m else 3.0


def parse_method(rest):
    for key in ("영상", "정지", "입", "그래픽"):
        if key in rest.split("·", 1)[-1]:
            return key
    return "정지"


def expand(text, blocks):
    # [SEOJIN]'s 처럼 뒤에 글자가 붙어도 풀리도록 반복 치환
    for _ in range(3):
        text = re.sub(r"\[([A-Z]+)\]", lambda m: blocks.get(m.group(1), m.group(0)), text)
    return text


def parse(md):
    blocks, cuts, cur, section = {}, [], None, ""
    for raw in md.splitlines():
        line = raw.strip()
        if m := BLOCK_DEF.match(line):
            blocks[m.group(1)] = m.group(2).strip()
            continue
        if m := CUT_HEAD.match(line):
            cid, start, rest = m.groups()
            mm, ss = start.split(":")
            cur = {"id": cid, "start": int(mm) * 60 + int(ss), "duration": parse_duration(rest),
                   "method": parse_method(rest), "hero": rest.count("★"), "section": section}
            cuts.append(cur)
            continue
        if cur and (m := FIELD.match(line)):
            key, val = m.groups()
            cur[key] = (cur.get(key, "") + " " + val).strip()
        elif line.startswith("#"):
            cur = None
            if line.startswith("### "):
                section = re.sub(r"\s*\(.*\)\s*$", "", line[4:]).strip()
    return blocks, cuts


def enrich(blocks, cuts):
    by_id = {c["id"]: c for c in cuts}
    for c in cuts:
        pic = c.get("그림", "")
        code = re.findall(r"`([^`]+)`", pic)
        if code:
            c["prompt"] = expand(code[0], blocks)
        elif ref := re.search(r"(C\d{3})", pic):
            src = by_id.get(ref.group(1), {})
            c["prompt"] = src.get("prompt", "")
            c["prompt_note"] = pic
        else:
            c["prompt"] = ""
        motion = re.findall(r"`([^`]+)`", c.get("움직임", ""))
        c["motion"] = motion[0] if motion else ""
        c["negative"] = blocks.get("NEG", "")
        sound = c.get("소리", "")
        c["lines"] = [{"speaker": s.strip(), "note": (n or "").strip(), "text": t.strip()}
                      for s, n, t in LINE.findall(sound)]
        if a := ANCHOR.search(sound):
            c["lines"].insert(0, {"speaker": "앵커들", "note": "겹쳐서", "text": a.group(1)})
        c["overlays"] = OVERLAY.findall(c.get("편집", ""))
    return cuts


SPEAKER_FILE = {"N": "N", "앵커들": "앵커"}


def audio_name(cid, speaker):
    return f"{cid}_{SPEAKER_FILE.get(speaker, speaker.replace(' ', ''))}.wav"


def mmss(sec):
    return f"{int(sec // 60)}:{int(sec % 60):02d}"


def write_sheets(ep_dir, blocks, cuts, md):
    out = ep_dir / "production"
    out.mkdir(exist_ok=True)
    (out / "cuts.json").write_text(json.dumps(cuts, ensure_ascii=False, indent=1), encoding="utf-8")

    neg = blocks.get("NEG", "")
    p = ["# 컷별 그림 지시문 — 붙여넣기용\n",
         "컷_지시서.md의 `[STYLE]` 같은 표시를 모두 풀어 쓴 완성본입니다. 회색 상자 오른쪽 위의 복사 버튼을 누르면 그대로 복사됩니다.\n",
         "**제외할 요소(네거티브)** — 모든 컷에 공통으로 넣으세요:\n", f"```\n{neg}\n```\n",
         "**파일 이름** — 뽑은 그림은 `컷번호.png`(예: `C001.png`), 영상은 `컷번호.mp4`로 저장해 `episodes/ep01/assets/`에 넣습니다. "
         "입 모양 컷은 입 닫은 그림을 `C007.png`, 입 연 그림을 `C007_b.png`로 저장합니다.\n"]
    for c in cuts:
        star = " ★" * c["hero"]
        p.append(f"\n## {c['id']} · {mmss(c['start'])} · {c['method']}{star}\n")
        p.append(f"{c.get('화면', '')}\n")
        if c.get("prompt_note"):
            p.append(f"> {c['prompt_note']}\n")
        if c["prompt"]:
            p.append(f"그림:\n```\n{c['prompt']}\n```\n")
        elif c["method"] == "그래픽":
            p.append("그림: 없음 (편집 그래픽만)\n")
        if c["motion"]:
            p.append(f"움직임 (이미지→영상):\n```\n{c['motion']}\n```\n")
        if c["method"] == "입" and c["prompt"]:
            p.append(f"입 연 그림 (`{c['id']}_b.png`):\n```\n{c['prompt']}, mouth slightly open, speaking\n```\n")
        if c.get("팁"):
            p.append(f"팁: {expand(c['팁'].replace('`', ''), blocks)}\n")
    (out / "프롬프트_붙여넣기.md").write_text("\n".join(p), encoding="utf-8")

    sheet = re.search(r"## 3\. 캐릭터 시트.*?```\n(.*?)```", md, re.S)
    s = ["# 캐릭터 시트 지시문 — 붙여넣기용\n",
         "가장 먼저 만드세요. 결과물은 `episodes/ep01/assets/sheets/`에 저장하고, 이후 모든 컷에서 '참조 이미지(캐릭터 레퍼런스)'로 넣습니다.\n",
         f"제외할 요소:\n```\n{neg}\n```\n"]
    names = ["서진", "아버지", "투키디데스", "달러", "아테네 사절", "멜로스 원로", "소품"]
    for i, line in enumerate(l for l in (sheet.group(1) if sheet else "").splitlines() if l.strip()):
        label = names[i] if i < len(names) else f"시트 {i + 1}"
        s.append(f"\n## {i + 1}. {label}  →  `sheet_{i + 1:02d}.png`\n```\n{expand(line.strip(), blocks)}\n```\n")
    (out / "캐릭터시트_프롬프트.md").write_text("\n".join(s), encoding="utf-8")

    with open(out / "prompts.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["컷", "시작", "길이(초)", "방식", "핵심", "화면", "그림 지시문", "움직임", "편집", "완료"])
        for c in cuts:
            w.writerow([c["id"], mmss(c["start"]), round(c["duration"], 2), c["method"], "★" * c["hero"],
                        c.get("화면", ""), c["prompt"], c["motion"], c.get("편집", ""), ""])

    roles = {}
    for c in cuts:
        for ln in c["lines"]:
            roles.setdefault(ln["speaker"], []).append((c["id"], ln))
    r = ["# 1화 녹음 대본 — 배역별\n",
         "- 한 줄 = 파일 하나. 오른쪽 파일 이름 그대로 저장해서 `episodes/ep01/audio/`에 넣으면, 편집 스크립트가 컷 자리에 자동으로 놓습니다.\n",
         "- 형식은 wav 또는 mp3. 줄 앞뒤로 0.3초쯤 여유를 두고 녹음하세요.\n",
         "- 톤은 컷_지시서.md 7장(녹음 디렉션)을 보세요.\n"]
    for role, items in roles.items():
        label = "기록자 (N)" if role == "N" else role
        r.append(f"\n## {label} — {len(items)}줄\n")
        r.append("| 컷 | 대사 | 파일 이름 |\n|---|---|---|")
        for cid, ln in items:
            note = f"({ln['note']}) " if ln["note"] else ""
            r.append(f"| {cid} | {note}{ln['text']} | `{audio_name(cid, role)}` |")
    (out / "녹음대본.md").write_text("\n".join(r) + "\n", encoding="utf-8")
    return out


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ep_dir = Path(sys.argv[1]).resolve()
    md = (ep_dir / "컷_지시서.md").read_text(encoding="utf-8")
    blocks, cuts = parse(md)
    cuts = enrich(blocks, cuts)
    out = write_sheets(ep_dir, blocks, cuts, md)
    lines = sum(len(c["lines"]) for c in cuts)
    print(f"{len(cuts)}컷, 대사 {lines}줄, 스타일 블록 {len(blocks)}개 → {out}")


if __name__ == "__main__":
    main()
