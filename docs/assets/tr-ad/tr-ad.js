/* ==========================================================================
   Transition 광고 — 볼트노트(boltnote.net)에 싣는 자리 광고 (2026-11-19)
   볼트노트의 쪽에 <div class="tr-ad" data-slot="inline|side|foot"></div> 를 두면 이 파일이 채운다.
   - 쿠키·기기 저장소·외부 요청을 쓰지 않는다 (그림은 볼트노트의 자기 파일). 볼트노트의 개인정보 처리방침에 더할 것이 없다.
   - 한국어 쪽에서만 보인다 (주소가 /en/ 으로 시작하면 아무것도 그리지 않는다: Transition 은 한국어 매거진).
   - 한 쪽에 같은 광고가 두 번 나오지 않게, 자리마다 다른 광고를 고른다.
   - 링크는 새 창으로 열고 rel="sponsored noopener" 를 단다 (규격표를 보던 사람이 볼트노트를 잃지 않게, 검색 엔진에는 광고 링크로 알린다).
   ========================================================================== */
(() => {
  "use strict";
  if (window.__trAd) return;
  window.__trAd = true;
  if (/^\/en(\/|$)/.test(location.pathname)) return;

  /* ---------- 설정: 여기만 고친다 ---------- */
  const IMG = window.TR_AD_IMG || "/assets/tr-ad/";   // 볼트노트에 그림을 둔 폴더 (img/ 의 세 파일). preview.html 은 window.TR_AD_IMG 로 바꾼다
  const SITE = "https://transition-radar.com";
  const CAMPAIGN = "2026-11-launch";
  const PRINT_ON = true;                               // 창간호 50부가 다 차면 false (Transition 쪽에서 알려 준다)

  const ADS = {
    print: {
      on: PRINT_ON, img: "cover-01.jpg", shape: "cover",
      kicker: "창간호 종이 잡지 · 선착순 50부",
      title: "에너지·플랜트 매거진 창간호를 무료로 보내 드립니다",
      text: "잡지 값도 우편 요금도 받지 않습니다. 신청하신 순서대로 우편으로 보내고, 50부가 차면 마감합니다.",
      cta: "무료로 신청하기", path: "/print"
    },
    radar: {
      on: true, img: "radar-globe.jpg", shape: "square",
      kicker: "Transition Radar · 세계 플랜트 지도",
      title: "지금 세계에서 짓고 있는 플랜트를 한 지도에",
      text: "수소·LNG·원전·해상풍력·담수화. 사업마다 단계와 EPC, 수주 기록을 출처와 함께 정리합니다.",
      cta: "플랜트 지도 보기", path: "/radar"
    },
    machine: {
      on: true, img: "machine-compressor.jpg", shape: "wide",
      kicker: "Transition 매거진 · 기계의 원리",
      title: "펌프는 액체를, 압축기는 기체를",
      text: "둘 다 압력을 올리는 기계인데 구조는 왜 갈릴까. 플랜트 현장의 기계를 그림으로 풀었습니다.",
      cta: "기사 읽기", path: "/magazine/01/mechanics"
    },
    magazine: {
      on: true, img: "machine-compressor.jpg", shape: "wide",
      kicker: "Transition 매거진",
      title: "공장은 어떻게 돌아가는가",
      text: "암모니아·비료·해수담수화·희토류. 공정과 기계, 우리 삶에 남기는 것까지 따라가는 에너지·플랜트 과학 매거진입니다.",
      cta: "매거진 보기", path: "/magazine/"
    }
  };

  // 쪽의 내용에 맞춰 먼저 보일 광고의 순서. 주소나 data-topic 에 든 말로 고른다
  function order() {
    const hint = (location.pathname + " " + (document.querySelector(".tr-ad[data-topic]")?.dataset.topic || "")).toLowerCase();
    if (/pump|펌프|compress|정비/.test(hint)) return ["machine", "print", "radar", "magazine"];
    if (/stud|flange|plant|a193|a194|asme|스터드|플랜지|플랜트/.test(hint)) return ["radar", "print", "machine", "magazine"];
    return ["print", "radar", "machine", "magazine"];
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const link = (ad, slot, key) => `${SITE}${ad.path}?utm_source=boltnote&utm_medium=banner&utm_campaign=${CAMPAIGN}&utm_content=${slot}-${key}`;

  function card(ad, slot, key) {
    const href = esc(link(ad, slot, key));
    if (slot === "foot") {
      return `<a class="tr-ad-strip" href="${href}" target="_blank" rel="sponsored noopener">
        <span class="tr-ad-label">광고</span>
        <b class="tr-ad-mark">TRANSITION</b>
        <span class="tr-ad-strip-text">${esc(ad.title)}</span>
        <span class="tr-ad-strip-go">${esc(ad.cta)} <span aria-hidden="true">→</span></span></a>`;
    }
    return `<a class="tr-ad-card is-${ad.shape}" href="${href}" target="_blank" rel="sponsored noopener">
      <span class="tr-ad-media"><img src="${IMG}${ad.img}" alt="" loading="lazy" decoding="async"></span>
      <span class="tr-ad-body">
        <span class="tr-ad-top"><span class="tr-ad-label">광고</span><span class="tr-ad-kicker">${esc(ad.kicker)}</span></span>
        <strong class="tr-ad-title">${esc(ad.title)}</strong>
        <span class="tr-ad-text">${esc(ad.text)}</span>
        <span class="tr-ad-go">${esc(ad.cta)} <span aria-hidden="true">↗</span></span>
      </span></a>`;
  }

  function fill() {
    const slots = [...document.querySelectorAll(".tr-ad[data-slot]:not([data-done])")];
    if (!slots.length) return;
    const queue = order().filter(key => ADS[key].on);
    // 띠(foot)는 늘 매거진 전체 안내. 나머지 자리는 순서대로 하나씩 나눠 가진다
    let i = 0;
    for (const el of slots) {
      const slot = el.dataset.slot;
      const key = slot === "foot" ? "magazine" : queue[i++ % queue.length];
      el.innerHTML = card(ADS[key], slot, key);
      el.setAttribute("aria-label", "광고: Transition");
      el.dataset.done = "1";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fill);
  else fill();
  window.trAdFill = fill;   // 볼트노트가 쪽을 바꿀 때(해시 라우팅 등) 새 자리를 둔 뒤 부른다
})();
