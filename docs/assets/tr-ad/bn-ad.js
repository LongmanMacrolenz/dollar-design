/* 오른쪽 세로 배너(rail)의 닫기 단추 (볼트노트가 만든 파일, 대표 요청 2026-11-19).
   tr-ad.js가 광고를 채운 뒤 ✕를 단다. 누르면 그 화면에서만 가린다. 쿠키·기기 저장소·외부 요청을 쓰지 않는다 (다른 화면으로 가면 다시 뜬다). */
(() => {
  "use strict";
  if (/^\/en(\/|$)/.test(location.pathname)) return;
  const mount = el => {
    if (el.dataset.x || !el.querySelector("a")) return;
    el.dataset.x = "1";
    const b = document.createElement("button");
    b.type = "button"; b.className = "bn-ad-x"; b.setAttribute("aria-label", "광고 닫기"); b.textContent = "✕";
    b.addEventListener("click", () => el.style.setProperty("display", "none", "important"));
    el.appendChild(b);
  };
  const start = () => document.querySelectorAll('.tr-ad[data-slot="rail"]').forEach(el => {
    mount(el);
    if (!el.dataset.x) new MutationObserver(() => mount(el)).observe(el, { childList: true });
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
