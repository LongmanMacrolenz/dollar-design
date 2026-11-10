/* 홈 아래 구역의 조임 장면 (대표 요청 2026-11-10: 첫 화면의 "내리면 조여진다"를 입구 3개·제품군·문의 구역에도. 다 조여지면 화면이 흔들린다).
   구역마다 모양은 다르지만 규칙은 하나다: 그 구역을 화면에 붙잡아 두고(sticky), 내리는 만큼 조임 정도가 0→1로 찬 뒤, 다 찬 순간에 한 번 "쾅".
   - doors  = 판 3장. 너트가 01→02→03 차례로 돌며 판 사이의 빛나는 틈이 닫힌다. 가로로 세게 흔들린다.
   - lineup = 제품 타일이 하나씩 내려앉고 제목이 굵어진다. 세로로 쿵 내려앉는다.
   - rfq    = 순서 01·02·03이 켜지고 문의 카드가 도장처럼 찍힌다. 화면이 한 번 부푼다.
   - 방향: 위에서 내려오면 내릴수록, 아래에서 올라오면 올릴수록 조여진다 (올릴 때도 같은 체험). 도중에 되돌리면 풀린다.
     방향은 구역이 화면 밖에 있을 때만 바꾼다 (보이는 동안에는 튀지 않는다).
   - 붙잡는 방식: 내용이 한 화면에 들어가면 가운데(center), 길면 위에 맞춰(top) 붙잡는다. 꼭 보여야 할 부분(data-scene-need)도 안 들어가면 붙잡지 않고 정지 상태로 둔다.
   - 기본값은 조여진 정지 상태다 (CSS --e:1, data-seated="true"). 움직임 줄이기·스크립트 없음이면 그대로 보이고 흔들림도 없다.
   - 내용·링크·읽는 순서는 바꾸지 않는다. transform·opacity·글자 굵기만 움직이므로 자리(레이아웃)가 밀리지 않는다.
   순수 함수 bnSceneQ(mode, p)가 붙잡힌 구간의 진행률을 조임 진행으로 바꾼다. 화면 연결은 bnScenesInit (V.after.home). 흔들림은 bnImpact (첫 화면도 함께 쓴다). */
const BN_SCENE = { seat: .8, release: .72, tau: 110 };   // seat: 이만큼 내리면 다 조여진다(나머지는 조여진 채 머문다). release: 되돌릴 때 풀리는 지점
/* 흔들림: [시점 0–1, x px, y px, 회전°, 확대]. 휴대폰에서는 조금 약하게 한다 */
const BN_SHAKES = {
  kick: { ms: 400, f: [[0, 0, 0, 0, 0], [.14, -8, 3, -.18, 0], [.34, 6, -2, .12, 0], [.56, -3, 1, -.05, 0], [.78, 1, 0, 0, 0], [1, 0, 0, 0, 0]] },
  slam: { ms: 560, f: [[0, 0, 0, 0, 0], [.1, -13, 5, -.32, 0], [.26, 10, -4, .26, 0], [.44, -7, 3, -.16, 0], [.62, 4, -1, .08, 0], [.8, -2, 0, 0, 0], [1, 0, 0, 0, 0]] },
  thud: { ms: 480, f: [[0, 0, 0, 0, 0], [.12, 0, 15, 0, 0], [.32, 0, -7, 0, 0], [.54, 0, 4, 0, 0], [.76, 0, -1.5, 0, 0], [1, 0, 0, 0, 0]] },
  punch: { ms: 460, f: [[0, 0, 0, 0, 0], [.14, 0, 0, 0, .026], [.36, 0, 0, 0, -.008], [.6, 0, 0, 0, .005], [1, 0, 0, 0, 0]] },
};
let bnScenesCleanup = null;

const bnSceneQ = (mode, p) => { p = Math.min(1, Math.max(0, +p || 0)); return mode === 'up' ? 1 - p : p; };

/* 조여진 순간의 "쾅": 지금 화면에 보이는 홈 구역들을 함께 흔든다 (머리띠는 그대로 둔다). 흔들림의 중심은 화면 가운데다.
   scene에는 is-hit을 붙여 CSS가 번쩍임·주황 막대를 다시 그리게 한다. 움직임 줄이기에서는 아무것도 하지 않는다. */
function bnImpact(scene, kind) {
  if (reduced()) return;
  scene.classList.remove('is-hit'); void scene.offsetWidth; scene.classList.add('is-hit');
  const home = scene.closest('.bn-home'), def = BN_SHAKES[kind] || BN_SHAKES.kick, k = innerWidth <= 820 ? .65 : 1;
  for (const el of home ? home.children : [scene]) {
    const r = el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight || !el.animate) continue;
    const origin = `${(innerWidth / 2 - r.left).toFixed(1)}px ${(innerHeight / 2 - r.top).toFixed(1)}px`;
    el.animate(def.f.map(([offset, x, y, a, s]) => ({ offset, transformOrigin: origin, transform: `translate3d(${x * k}px, ${y * k}px, 0) rotate(${a * k}deg) scale(${1 + s * k})` })), { duration: def.ms, easing: 'linear' });
  }
}

function bnScenesInit() {
  bnScenesCleanup?.();
  const home = view().querySelector('.bn-home'), els = home ? [...home.querySelectorAll('.bn-scene')] : [];
  if (!els.length || reduced()) return;   // 움직임 줄이기: CSS 기본값(조여진 정지 상태) 그대로
  const abort = new AbortController(), opt = { signal: abort.signal, passive: true }, S = BN_SCENE;
  const scenes = els.map(el => ({ el, stage: el.querySelector('.bn-scene-stage'), body: el.querySelector('.bn-scene-body'), need: el.querySelector(el.dataset.sceneNeed || '.bn-scene-body'),
    kind: el.dataset.scene, pin: '', mode: 'down', span: 0, target: 0, cur: 0, shown: -1, seated: null, hits: 0 }));
  let raf = 0, last = 0, top = 0, laidW = 0, laidH = 0;
  function layout() {
    laidW = innerWidth; laidH = innerHeight;
    // 머리띠가 따라오면(sticky) 그 아래에 붙잡고, 휴대폰처럼 고정 막대(.tb-mini)가 덮으면 그 높이만큼 내용을 내린다
    const tb = document.querySelector('.tb'), sticky = !!tb && getComputedStyle(tb).position === 'sticky';
    top = sticky ? tb.offsetHeight : 0;
    const mini = sticky ? 0 : ($('tb-mini')?.offsetHeight || 0);
    for (const s of scenes) {
      const c = s.el.classList, was = s.pin;
      s.el.style.setProperty('--scene-top', top + 'px'); s.el.style.setProperty('--scene-mini', mini + 'px');
      s.el.style.setProperty('--e', '1'); s.shown = -1;   // 조여진 모양으로 놓고 잰다 (풀린 모양의 이동·확대가 높이 계산에 섞이지 않게). 아래에서 다시 그린다
      c.add('is-live', 'is-pin', 'is-center'); const room = s.stage.offsetHeight;   // 한 화면 높이 (100svh − 머리띠)
      c.remove('is-center');                                                        // 위에 맞춘 상태로 내용 높이를 잰다
      const need = (s.need || s.body).getBoundingClientRect().bottom - s.stage.getBoundingClientRect().top;
      const center = s.el.dataset.scenePin !== 'top' && s.body.offsetHeight + mini + 32 <= room;
      s.pin = center ? 'center' : need + 12 <= room ? 'top' : '';
      c.toggle('is-center', center); c.toggle('is-pin', !!s.pin); c.toggle('is-live', !!s.pin);
      s.span = s.pin ? s.el.offsetHeight - s.stage.offsetHeight : 0;
      if (!s.pin) { s.el.style.removeProperty('--e'); s.el.dataset.seated = 'true'; s.seated = null; }
      else if (!was) { s.seated = null; s.cur = -1; }
    }
    measure(); for (const s of scenes) { if (s.cur < 0) s.cur = s.target; } paint(); request();
  }
  function measure() {
    const vh = innerHeight;
    for (const s of scenes) {
      if (!s.pin) continue;
      const r = s.el.getBoundingClientRect(), p = s.span > 0 ? (top - r.top) / s.span : 1, away = r.bottom <= 0 ? 'up' : r.top >= vh ? 'down' : '';
      if (away && away !== s.mode) { s.mode = away; s.cur = bnSceneQ(away, p); }   // 화면 밖에서만 방향을 바꾼다. 이때 조임은 0이다 (위로 지나갔으면 p=1, 아래에 있으면 p=0)
      s.target = bnSceneQ(s.mode, p);
    }
  }
  function paint() {
    for (const s of scenes) {
      if (!s.pin || s.cur === s.shown) continue;
      s.shown = s.cur;
      s.el.style.setProperty('--e', Math.min(1, s.cur / S.seat).toFixed(4));
      const on = s.cur >= (s.seated ? S.release : S.seat) - 1e-4;   // 한 번 조여지면 조금 되돌려도 바로 풀리지 않는다 (경계에서 깜박이지 않게)
      if (on === s.seated) continue;
      const first = s.seated === null; s.seated = on; s.el.dataset.seated = String(on);
      if (on && !first) { s.hits++; bnImpact(s.el, s.el.dataset.impact); }   // 처음 그릴 때 이미 조여져 있으면(중간에서 새로 고침) 흔들지 않는다
    }
  }
  function frame(now) {
    raf = 0;
    if (!home.isConnected) return cleanup();
    const dt = last ? Math.min(64, now - last) : 16; last = now;
    let more = false;
    for (const s of scenes) {
      if (!s.pin) continue;
      s.cur += (s.target - s.cur) * (1 - Math.exp(-dt / S.tau)); if (Math.abs(s.target - s.cur) < .0004) s.cur = s.target;
      if (s.cur !== s.target) more = true;
    }
    paint();
    if (more && !document.hidden) request(); else last = 0;
  }
  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  function cleanup() { abort.abort(); if (raf) cancelAnimationFrame(raf); raf = 0; if (bnScenesCleanup === cleanup) bnScenesCleanup = null; }
  bnScenesCleanup = cleanup;
  addEventListener('scroll', () => { if (!home.isConnected) return cleanup(); measure(); request(); }, opt);
  // 휴대폰에서 주소창이 접히고 펴질 때도 resize가 온다. 무대 높이는 svh라 그때 변하지 않으므로 다시 재지 않는다 (내리는 도중에 자리가 바뀌지 않게)
  addEventListener('resize', () => { if (innerWidth === laidW && Math.abs(innerHeight - laidH) < 140 && matchMedia('(pointer: coarse)').matches) { measure(); request(); } else layout(); }, opt);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; request(); } }, opt);
  document.fonts?.ready.then(() => { if (home.isConnected && !abort.signal.aborted) layout(); });   // 제목 글꼴이 오면 높이가 조금 달라진다
  window.__sceneTest = { cfg: S, q: bnSceneQ, state: () => scenes.map(s => ({ kind: s.kind, pin: s.pin, mode: s.mode, q: s.cur, target: s.target, seated: s.seated, hits: s.hits })) };
  layout();
}
