"""Build scripts only from the finite, reviewed editorial catalog.

There is no ungrounded language-model generation or automatic standards scraping.
Changing a source snapshot invalidates its episodes until the catalog is reviewed.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
KST = ZoneInfo("Asia/Seoul")
TARGET_SECONDS = 330
SOURCE_FIELDS = ("id", "t", "sum", "watch", "src")
SITE = "https://boltnote.boltnote.workers.dev"


class MarketingError(Exception):
    """Actionable errors whose messages must never contain credentials."""


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def source_digest(entry):
    return digest({key: entry.get(key) for key in SOURCE_FIELDS})


def load_catalog(path=None):
    catalog = json.loads((path or ROOT / "marketing/catalog.json").read_text())
    if catalog.get("schema") != 1 or catalog.get("language") != "ko" or not catalog.get("topics"):
        raise MarketingError("한국어 편집 목록의 버전 또는 주제 목록이 잘못되었습니다.")
    library = {row["id"]: row for row in json.loads((ROOT / "site/lib.json").read_text())}
    seen = set()
    for topic in catalog["topics"]:
        slug = topic["id"]
        if not re.fullmatch(r"[a-z][a-z0-9-]{1,70}", slug) or slug in seen:
            raise MarketingError("주제 식별자가 잘못되었거나 중복되었습니다.")
        seen.add(slug)
        source = library.get(topic["source_id"])
        if not source or source_digest(source) != topic["source_sha256"]:
            raise MarketingError(f"출처가 변경되었습니다. 대본 근거를 다시 검토하세요: {slug}")
        asset = (ROOT / topic["asset"]).resolve()
        if not asset.is_relative_to(ROOT / "docs/media/shape") or asset.suffix != ".webp" or not asset.is_file():
            raise MarketingError(f"참고 렌더링 이미지가 없습니다: {slug}")
        for field in ("title", "hook", "definition", "comparison", "pitfall", "example",
                      "question", "inspection", "keywords"):
            if not topic.get(field):
                raise MarketingError(f"주제에 필요한 편집 항목이 없습니다: {slug}/{field}")
    return catalog


def publish_at(day: date):
    return datetime.combine(day, time(20), KST).astimezone(timezone.utc)


def next_day(now=None):
    return ((now or datetime.now(timezone.utc)).astimezone(KST).date() + timedelta(days=1))


def select_topic(catalog, used):
    for topic in catalog["topics"]:
        if topic["id"] not in used:
            return topic
    raise MarketingError("검토된 주제를 모두 사용했습니다. 새 주제를 추가하기 전 재탕 업로드를 중단합니다.")


def auto_key(channel_id, day):
    return "bn-" + hashlib.sha256(f"{channel_id}:{day.isoformat()}".encode()).hexdigest()[:24]


def validate_copy(episode):
    text = json.dumps(episode, ensure_ascii=False)
    banned = ["재고 보유", "당일 출고", "PMI 서비스", "보증합니다", "바로 공급",
              "Grainger", "McMaster", "한국미스미", "나비엠알오", "한국볼트", "화신볼트"]
    banned += [v.strip() for v in os.environ.get("BN_PRIVATE_BANNED", "").split("|") if v.strip()]
    private = ROOT / "app/tests/private_banned.txt"
    if private.is_file():
        banned += [v.strip() for v in private.read_text().splitlines() if v.strip()]
    if any(word.casefold() in text.casefold() for word in banned):
        raise MarketingError("대본에 공개하면 안 되는 문구가 있습니다. 내용은 로그에 출력하지 않습니다.")
    if not 1 <= len(episode["title"]) <= 100 or len(episode["description"]) > 5000:
        raise MarketingError("YouTube 제목 또는 설명 길이 제한을 초과했습니다.")
    if not 1800 <= len(episode["narration"]) <= 6500:
        raise MarketingError("대본 분량이 5~6분 편집 범위를 벗어났습니다.")


def build_episode(topic, day, channel_id="preview"):
    name = topic["title"]
    keywords = topic["keywords"]
    specs = " · ".join(keywords)
    scenes = []

    def add(title, narration, bullets, kind="product"):
        scenes.append({"title": title, "narration": narration, "bullets": bullets,
                       "asset": topic["asset"], "kind": kind})

    add(name, f"안녕하세요. 볼트노트입니다. 오늘은 {name}을 살펴봅니다. {topic['hook']} "
        "설계자와 구매 담당자가 같은 부품을 떠올리고 있는지 확인하는 방법을 정리하겠습니다. "
        "실제 체결 조건은 고객 도면과 적용 규격으로 확인해야 합니다.", ["Fasteners 실무", "사양 확인 → 견적 → 납품"])
    add("이름만 보고 주문하지 않습니다", f"체결부품은 이름 하나로 주문 조건이 완성되지 않습니다. "
        f"{topic['hook']} 요청한 내용과 공급처가 제안한 내용을 항목별로 대조해야 합니다. "
        "한 항목이라도 빠졌다면 단가를 받기 전에 질문을 남겨 두는 편이 이후의 확인을 줄입니다.",
        ["품명", specs])
    add("먼저 용어를 정리합니다", f"이 주제의 기본 개념입니다. {topic['definition']} "
        "용어를 알고 있다는 것과 특정 제품의 조건을 확인했다는 것은 구분해야 합니다. "
        "도면의 표현을 그대로 기록하고, 현물과 문서에서 확인할 항목을 따로 표시해 보겠습니다.",
        [topic["definition"]])
    add("비슷해 보여도 구분합니다", f"다음으로 비교할 점입니다. {topic['comparison']} "
        "눈으로 비슷해 보이거나 자주 쓰는 이름이라는 이유로 같은 제품이라고 판단하지 않습니다. "
        "기존 품목을 대체할 때에도 고객이 요구한 항목과 공급 제안의 차이를 먼저 적습니다.",
        [topic["comparison"]], "compare")
    add("도면과 BOM을 함께 봅니다", f"실무에서는 도면과 부품 목록을 함께 읽습니다. "
        f"이번 주제에서는 {specs}을 구분해 기록합니다. 도면의 개정 번호와 참조 사양도 확인합니다. "
        "예전 주문서의 한 줄을 복사했더라도 이번 요청에 그대로 적용되는지는 별도로 대조합니다.",
        ["도면 개정", specs], "checklist")
    add("확인 질문을 구체적으로 적습니다", f"공급처에 묻는 질문은 짧아도 구체적이어야 합니다. "
        f"{topic['question']} 공급처가 회신할 때는 제시한 조건과 그 근거를 함께 받습니다. "
        "확인되지 않은 항목은 확인 대기로 남기고, 빈칸을 관행이나 추측으로 채우지 않습니다.",
        [topic["question"]], "checklist")
    add("자주 놓치는 부분", f"이번 주제에서 주의할 부분입니다. {topic['pitfall']} "
        "문제가 생긴 뒤에 조건을 찾으면 납기와 비용 협의까지 다시 해야 할 수 있습니다. "
        "구매 단계에서 확인 질문을 한 번 더 남기고, 공급처 회신을 주문 조건과 연결합니다.",
        [topic["pitfall"]], "compare")
    add("가상 BOM 사례", f"실제 고객 자료를 사용하지 않은 가상 사례를 보겠습니다. {topic['example']} "
        "이 사례의 목적은 정답을 추측하는 것이 아니라 빠진 정보를 찾는 것입니다. "
        "한 줄에 모든 내용을 억지로 넣기보다 필요한 확인 질문을 별도 메모로 남겨도 됩니다.",
        ["가상 사례 · 실제 주문 아님", topic["example"]], "checklist")
    add("빠진 항목을 질문으로 바꿉니다", f"가상 사례에서 아직 확인하지 못한 부분을 질문으로 바꿉니다. "
        f"{topic['question']} 요청 수량과 단위, 필요한 서류, 희망 납품일도 함께 확인합니다. "
        "희망일은 고객의 요청이고 공급 가능한 날짜는 공급처가 확인해야 하는 조건입니다.",
        ["미확인 → 질문", "수량 · 단위 · 서류 · 희망일"], "checklist")
    add("공급 제안을 원문과 대조합니다", "회신을 받으면 원래 요청과 공급 제안을 나란히 놓습니다. "
        "일치하는 부분, 추가 확인이 필요한 부분, 요구와 다른 부분을 구분합니다. "
        f"이번 주제에서도 {specs}을 항목별로 봅니다. 가격이 좋다는 이유만으로 "
        "확인되지 않은 조건을 만족한 것으로 바꾸지는 않습니다.", ["일치", "추가 확인", "편차"], "compare")
    add("대체는 서면으로 확인합니다", "대체 제안이 있다면 차이와 근거를 고객에게 설명합니다. "
        "고객의 서면 승인으로 요구 사양이 바뀌면 그 개정 내용을 다시 공급처에 전달합니다. "
        "소프트웨어나 체크 표시가 설계 승인을 대신하지 않습니다. 바뀐 사양으로 가격과 납기, "
        "문서 제공 조건도 다시 확인해야 합니다.", ["차이 기록", "고객 서면 승인", "개정 사양 재확인"], "checklist")
    add("문서 제공 조건도 주문 사양입니다", "필요한 검사 문서는 주문 전에 종류와 제공 조건을 확인합니다. "
        "발행 주체, 대상 품목, 검사 범위와 납품 제품의 연결 근거를 살펴봅니다. "
        "서류 제공 여부는 공급처 회신을 확인한 뒤 견적서에 적습니다. 아직 확보하지 않은 "
        "성적서나 시험 결과를 이미 제공할 수 있는 것처럼 안내하지 않습니다.", ["종류 · 발행자", "품목 · 로트 연결", "제공 조건 확인"], "checklist")
    add("포장과 수량을 구분합니다", "다음은 주문 수량입니다. 개당 단가와 포장당 단가를 구분하고 "
        "포장 수량, 최소 주문 수량, 공급 가능한 수량을 확인합니다. 세트로 요청했다면 구성품의 "
        "개수와 사양도 따로 적습니다. 납품 수량과 실제 매입 수량이 다른 경우에는 남는 수량과 "
        "비용 처리까지 내부 기록으로 남깁니다.", ["EA / PACK / SET", "최소 주문량", "실제 공급 가능 수량"], "checklist")
    add("입고 때 다시 확인합니다", f"입고 단계에서 확인할 내용입니다. {topic['inspection']} "
        "견적 단계에서 확인한 조건과 실제 받은 물품이 연결되는지 대조합니다. "
        "확인하지 못한 검사는 완료라고 표시하지 않고, 필요한 검사 방법과 판정 기준을 "
        "적용 규격 및 합의한 검사 계획에서 확인합니다.", [topic["inspection"]], "checklist")
    add("기록을 남기면 추적할 수 있습니다", "확인한 내용은 주문 번호와 연결해 보관합니다. "
        "공급처 회신, 품목과 포장 라벨, 필요한 사진과 문서를 함께 대조할 수 있어야 합니다. "
        "고객 이름이나 공급처 매입 조건이 있는 자료를 마케팅 영상에 쓰지는 않습니다. "
        "오늘 화면은 직접 만든 참고 렌더링이며 실제 납품품 사진이 아닙니다.", ["주문 · 회신 · 라벨 · 문서", "참고용 렌더링"], "checklist")
    add("가격과 납기는 확인된 조건으로", "최종 견적에는 확인된 사양과 공급 조건을 적습니다. "
        "배송과 필요한 문서, 검수 조건을 포함하고 납기의 시작 기준도 분명히 합니다. "
        "이 영상은 재고나 출고일, 특정 제품의 적합성을 약속하지 않습니다. "
        "실제 견적은 고객 요청과 공급처 확인 결과를 바탕으로 개별 안내합니다.", ["확인된 사양", "배송 · 서류 · 납기 조건"], "checklist")
    add("오늘의 체크리스트", f"오늘 내용을 다시 정리합니다. {topic['definition']} "
        f"비교할 점입니다. {topic['comparison']} 구매 단계에서는 {topic['question']} "
        "확인된 내용과 미확인 내용을 구분하면 고객과 공급처가 같은 조건으로 대화할 수 있습니다.",
        ["용어 구분", "원문 대조", "근거 확인"], "checklist")
    add("기존 BOM 그대로 Sales에", "체결부품 견적 검토가 필요하면 기존 BOM이나 메모, RFQ를 "
        "볼트노트 Sales에 그대로 보내 주세요. 별도 양식을 먼저 채울 필요는 없습니다. "
        "설명란의 Sales 안내에서 이메일 주소와 요청 예시를 확인할 수 있습니다. "
        "다음 영상에서도 체결부품의 확인 질문을 하나씩 정리하겠습니다. 감사합니다.",
        ["BOM · 메모 · RFQ 그대로", "설명란 Sales 안내"], "cta")

    narration = "\n\n".join(scene["narration"] for scene in scenes)
    seconds = [TARGET_SECONDS * len(scene["narration"]) / len(narration.replace("\n\n", ""))
               for scene in scenes]
    sources = [f"{SITE}/lib/{topic['source_id']}", f"{SITE}/#lib"]
    description = (f"{name} — 체결부품 구매·사양 확인 실무.\n\n"
                   "기존 BOM·메모·RFQ로 견적 문의:\n"
                   f"{SITE}/?utm_source=youtube&utm_medium=video&utm_campaign=fasteners-daily#list\n\n"
                   "출처·확인 범위:\n" + "\n".join(sources) + "\n"
                   "볼트노트 규격 사전에서 검토한 개념과 구매 확인 질문을 설명합니다. "
                   "규격 전문·치수표를 재게시하지 않습니다. 적용 판과 실제 조건은 도면·규격·공급처 문서로 확인합니다.\n"
                   "참고용 렌더링 · 실제 제품 사진 아님. 사례는 가상이며 공급 실적이나 재고를 뜻하지 않습니다.\n"
                   "내레이션은 AI 음성으로 제작합니다.\n\n"
                   f"#Fasteners #체결부품 #볼트노트\nBN_AUTO=1\nBN_TOPIC={topic['id']}\n"
                   f"BN_DAY={day.isoformat()}\nBN_KEY={auto_key(channel_id, day)}")
    episode = {"schema": 1, "topic_id": topic["id"], "day": day.isoformat(),
               "key": auto_key(channel_id, day), "channel_id": channel_id,
               "publish_at": publish_at(day).isoformat().replace("+00:00", "Z"),
               "title": name + " | 볼트노트 Fasteners", "description": description,
               "tags": ["Fasteners", "체결부품", "볼트노트", *keywords],
               "language": "ko", "seconds": TARGET_SECONDS, "scenes": scenes,
               "scene_seconds": seconds, "narration": narration,
               "source_id": topic["source_id"], "source_sha256": topic["source_sha256"]}
    validate_copy(episode)
    return episode
