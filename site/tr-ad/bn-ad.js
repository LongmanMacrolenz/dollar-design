/* 떠 있는 광고(rail)의 모양 고르기와 닫기·탭 단추 (볼트노트가 만든 파일, 대표 요청 2026-11-19).
   tr-ad.js가 광고를 채운 뒤, 화면의 남는 오른쪽 여백을 재서 모양(data-mode)을 정한다:
     bar(핸드폰) · full(여백 넉넉) · compact(조금 모자람) · tab(여백 없음: 가장자리 탭).
   글의 오른쪽 끝은 CSS 폭으로 안다: 정적 페이지 1248px, 앱 탭 1256px, 앱 홈 1440px (글을 덮지 않게 보수적으로 잡았다).
   쿠키·기기 저장소·외부 요청을 쓰지 않는다. 닫으면 그 화면에서만 가린다 (다른 화면으로 가면 다시 뜬다). */
(() => {
  "use strict";
  if (/^\/en(\/|$)/.test(location.pathname)) return;
  const root = document.documentElement;
  const MODES = ["full", "compact", "tab", "bar"];
  let el = null, closed = false;

  function contentWidth() {
    if (!document.body.dataset.route && !el.hasAttribute("data-app")) return 1248;   // 정적 페이지
    return document.body.dataset.route === "home" ? 1440 : 1256;                        // 앱
  }
  function mode() {
    const vw = root.clientWidth;
    if (vw <= 700) return "bar";
    const margin = (vw - contentWidth()) / 2;
    return margin >= 170 ? "full" : margin >= 130 ? "compact" : "tab";
  }
  function apply() {
    if (!el || !el.querySelector("a")) return;
    if (closed) { el.style.setProperty("display", "none", "important"); MODES.forEach(m => root.classList.remove("bn-rail-" + m)); return; }
    el.style.removeProperty("display");
    const m = mode(), w = m === "full" ? 160 : 120;
    if (el.dataset.mode !== m) el.classList.remove("is-open");
    el.dataset.mode = m;
    MODES.forEach(x => root.classList.toggle("bn-rail-" + x, x === m));
    if (m === "full" || m === "compact") {
      const margin = (root.clientWidth - contentWidth()) / 2;
      el.style.right = Math.max(4, Math.round(margin - w - 8)) + "px";
    } else el.style.removeProperty("right");
  }
  function mount() {
    if (el.dataset.x || !el.querySelector("a")) return;
    el.dataset.x = "1";
    const x = document.createElement("button");
    x.type = "button"; x.className = "bn-ad-x"; x.setAttribute("aria-label", "광고 닫기"); x.textContent = "✕";
    x.addEventListener("click", () => {
      if (el.dataset.mode === "tab") el.classList.remove("is-open"); else { closed = true; apply(); }
    });
    const t = document.createElement("button");
    t.type = "button"; t.className = "bn-ad-tab"; t.setAttribute("aria-label", "광고 펼치기"); t.textContent = "광고 ▸";
    t.addEventListener("click", () => { const open = el.classList.toggle("is-open"); t.setAttribute("aria-expanded", open ? "true" : "false"); });
    el.append(x, t);
    apply();
  }
  function start() {
    el = document.querySelector('.tr-ad[data-slot="rail"]');
    if (!el) return;
    mount();
    if (!el.dataset.x) new MutationObserver(() => { mount(); }).observe(el, { childList: true });
    addEventListener("resize", apply);
    new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ["data-route"] });   // 앱 화면이 바뀌면 글 폭이 달라진다
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
