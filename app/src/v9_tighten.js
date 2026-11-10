/* 홈 첫 화면 "조립 장면" (대표 결정 2026-11-10: 파스너의 기능 — 조이고 고정한다 — 을 설명 대신 그림으로 보인다.
   같은 날 대표 요청으로 볼트 한 개에서 "제품이 조립되는 장면"으로 바꿨다: 위아래로 나뉜 펌프 케이싱과 양옆 베어링 하우징).
   화면을 내리면 한 번에 조립된다: ① 떠 있던 케이싱 상부와 베어링 하우징 상부가 함께 내려와 하부와 만난다 →
   ② 테이퍼 다월 핀이 박혀 위치를 잡는다 → ③ 케이싱은 스터드에 캡 너트(cap hex nut), 베어링 하우징은 육각머리 볼트(HHCS)가 돌며 체결된다 →
   ④ 고정 순간 주황빛이 이음매를 한 바퀴 돈다. 글자 사이도 같이 조여진다. 옆의 계산 용지가 두루마리처럼 넘어가며 일반식을 보이고,
      그 아래 인장력–늘어남 곡선(개략도) 위로 예압이 올라간다.
   - 그리는 방식: 라이브러리 없는 WebGL. 형상은 코드로 만든다. 외부 요청이 없고 사진·영상 파일을 쓰지 않는다.
     특정 제품을 그린 것이 아닌 개념 형상이다 (비율·치수는 실제 제품과 다르다). 회사·제품·도면 번호를 적지 않는다.
     체결부품은 DIM의 공칭 치수(스터드·캡 너트·와셔 M16, 육각머리 볼트 M12)를 화면에서 읽히도록 k배 키웠다. 캡 너트는 위가 막힌 육각이다.
     "참고용 실시간 렌더링 · 실제 제품 사진 아님"을 화면에 적는다.
   - 틀리면 안 되는 것 (worker/tests/browser.py check_home이 자세 함수를 확인한다):
     순서 — 상·하부가 만나기 전에는 핀이 들어가지 않고, 핀이 다 들어가기 전에는 체결부품이 오지 않으며, 나사 시작점에 닿기 전에는 돌지 않는다.
     나사 — 오른나사, 한 바퀴에 정확히 1피치 전진(advance = pitch × turns), 좌면에 닿으면 더 돌지도 파고들지도 않는다.
     테이퍼 핀은 1:50. 토크·축력·합격 같은 수치는 주장하지 않는다. 겹쳐 보이는 식은 기호로 쓴 일반식뿐이다 (값을 넣지 않는다).
   - 문구·버튼은 조작 없이 항상 보인다. 움직임 줄이기면 조립된 정지 장면, WebGL이 안 되면 정지 이미지로 바꾼다 (오류를 내지 않는다).
   - 글씨도 같은 이야기를 한다: 「작은 것이,」는 가늘게, 「전부를 붙잡습니다.」는 조립될수록 굵어져 고정 순간 가장 굵다.
     제목 글꼴은 굵기가 이어지는 가변 글꼴 Hahmlet(SIL OFL). bnHomeFontInit이 홈 제목에 쓰인 글자만 Google Fonts에 요청한다.
   - 길이: 무대 높이의 4.6배(휴대폰 4배)를 내리는 동안 조립된다 (대표 요청 2026-11-10: 더 천천히).
   순수 함수 bnTightenPose(p, s)가 스크롤 진행률 p(0–1)와 체결 순번 s(0–1)를 자세로 바꾼다. 화면 연결은 bnTightenInit (V.after.home). */
const BN_TIGHTEN = { stud: 'M16', screw: 'M12', k: 1.9, lift: 78, nutTurns: 9, screwTurns: 7, p0: .04, pa: .3, pb: .42, p2: .84, lag: .3, start: .16, w0: 520, w1: 800,
  h1: ['작은 것이,', '전부를 붙잡습니다.'], stamp: '볼트는, 볼트노트.', lead: '체결부품 조달, BOM부터 정확하게.' };
/* 계산 용지에 적히는 식: 교과서에 있는 일반식을 기호로만 적는다 (값·허용치·합격 여부를 말하지 않는다). 조립 순서대로 구역을 나눈다.
   [구역 이름, [[식(HTML), 설명], …]] */
const BN_TIGHTEN_MATH = [
  ['LOCATE · taper pin', [['d<sub>2</sub> = d<sub>1</sub> + L / 50', 'taper 1:50'], ['τ = 4·F / (π · d²)', 'pin in single shear']]],
  ['THREAD · strength', [['A<sub>s</sub> = (π/4)·(d − 0.9382·P)²', 'tensile stress area'], ['F<sub>p</sub> = S<sub>p</sub> · A<sub>s</sub>', 'proof load'], ['F<sub>u</sub> = R<sub>m</sub> · A<sub>s</sub>', 'ultimate tensile load']]],
  ['TIGHTEN · torque → preload', [['T = K · d · F<sub>i</sub>', 'tightening torque'], ['θ = 360° · x / P', 'turn ↔ axial advance'], ['σ = F<sub>i</sub> / A<sub>s</sub>', 'tensile stress in the bolt'], ['δ = F<sub>i</sub> · L / (A · E)', 'bolt elongation']]],
  ['JOINT · load share', [['F<sub>b</sub> = F<sub>i</sub> + C · F<sub>e</sub>', 'bolt load under external load'], ['C = k<sub>b</sub> / (k<sub>b</sub> + k<sub>m</sub>)', 'joint stiffness ratio']]],
];
/* 인장력–늘어남 곡선 (개략도, 눈금·값 없음): 탄성 직선 → 항복 → 최대 하중 → 파단. 주황 선과 점은 조이는 동안 예압 F_i까지 올라간다.
   곡선의 모양은 설명용이며 특정 재질·등급의 시험 곡선이 아니다. viewBox 240×136, 원점 (28,112) */
const BN_TIGHTEN_CHART = `<svg viewBox="0 0 240 136" aria-hidden="true"><path class="g" d="M28 16H232M28 40H232M28 64H232M28 88H232M76 8V112M124 8V112M172 8V112M220 8V112"/><path class="ax" d="M28 6V112H234"/>
  <path class="gd" d="M28 18H176M28 47H102"/><path class="gd on" d="M28 64.5H82.1"/>
  <path class="cv" pathLength="1" d="M28 112L110 40C124 27.7 146 19 176 18C192 17.5 204 21 214 29"/><path class="now" pathLength="1" d="M28 112L82.1 64.5"/>
  <path class="mk" d="M211 26l6 6m0-6l-6 6"/><circle class="yp" cx="110" cy="40" r="2"/><circle class="dot" cx="28" cy="112" r="3.4"/>
  <text x="24" y="21" text-anchor="end">F<tspan dy="2" font-size="6">u</tspan></text><text x="24" y="50" text-anchor="end">F<tspan dy="2" font-size="6">p</tspan></text><text class="on" x="24" y="67.5" text-anchor="end">F<tspan dy="2" font-size="6">i</tspan></text>
  <text x="116" y="50">yield</text><text x="182" y="12">max</text><text x="232" y="126" text-anchor="end">δ  elongation →</text><text x="32" y="10">F  tension</text></svg>`;
const BN_DISPLAY_SEL = '.bn-tighten h1, .bn-tighten-stamp b, .bn-door b, .bn-home .bn-section-head h2, .bn-home .bn-rfq-copy h2';   // zzzzzzzzzz_home.css의 제목 글꼴 규칙과 같은 목록
let bnTightenCleanup = null;

/* p: 스크롤 진행률. s: 체결 순번(0 = 가장 먼저, 1 = 가장 나중) — 체결부품이 차례로 돌게 한다. 모두 p2에서 끝난다.
   lift = 상부가 떠 있는 높이, pin = 핀이 들어간 정도(0–1), drop = 체결부품이 나사 시작점까지 내려온 정도(0–1),
   nut·screw = { turns, theta, advance(공칭 mm), left(좌면까지 남은 거리) } */
function bnTightenPose(p, s) {
  const c = BN_TIGHTEN, t01 = v => Math.min(1, Math.max(0, v));
  p = t01(+p || 0); s = t01(+s || 0);
  const a = t01((p - c.p0) / (c.pa - c.p0)), b = t01((p - c.pa) / (c.pb - c.pa));
  const u = p >= c.p2 ? 1 : t01((p - c.pb) / (c.p2 - c.pb) * (1 + c.lag) - s * c.lag), v = t01((u - c.start) / (1 - c.start));
  const run = v >= 1 ? 1 : 1 - Math.pow(1 - v, 1.8);   // 좌면에 가까울수록 느리게
  const part = (size, total) => { const P = DIM.pitch[size], turns = total * run; return { turns, theta: 2 * Math.PI * turns, advance: P * turns, left: P * (total - turns) }; };
  return { lift: p >= c.pa ? 0 : c.lift * Math.pow(1 - a, 2.2), mated: p >= c.pa, pin: p >= c.pb ? 1 : b * b * (3 - 2 * b), drop: t01(u / c.start),
    nut: part(c.stud, c.nutTurns), screw: part(c.screw, c.screwTurns), seated: p >= c.p2 };
}

function bnTightenMarkup() {
  const c = BN_TIGHTEN;
  const line = (t, n) => `<span class="bn-tl${n ? '' : ' bn-thin'}">${[...t].map((ch, i, a) => `<span class="bn-tc${ch === ' ' ? ' sp' : ''}" style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</span>`;
  return `<section class="bn-tighten" id="bn-tighten" aria-labelledby="h-z-a" data-seated="false" style="--p:0;--e:0;--m:0;--r:0;--t:0;--w:${c.w0}">
    <div class="bn-tighten-stage">
      <canvas class="bn-tighten-canvas" aria-hidden="true"></canvas>
      <img class="bn-tighten-poster" alt="" width="1600" height="1000" decoding="async" hidden>
      <div class="bn-tighten-math" aria-hidden="true" lang="en">
        <div class="bn-math-head"><b>BOLTED JOINT</b><span>calc sheet · general formulas · symbols only</span></div>
        <div class="bn-math-roll"><div class="bn-math-strip">${BN_TIGHTEN_MATH.map(([name, rows], n) => `<i>0${n + 1} · ${name}</i>${rows.map(([f, t]) => `<p><b>${f}</b><small>${t}</small></p>`).join('')}`).join('')}</div></div>
        <figure class="bn-math-chart">${BN_TIGHTEN_CHART}<figcaption>TENSION — ELONGATION · schematic, not to scale</figcaption></figure>
      </div>
      <div class="bn-wrap bn-tighten-inner">
        <div class="bn-brand-copy bn-tighten-copy">
          <p class="bn-tighten-eyebrow" lang="en">BOLTNOTE <span>/</span> INDUSTRIAL FASTENERS</p>
          <h1 id="h-z-a" tabindex="-1" aria-label="${c.h1.join(' ')}"><span aria-hidden="true">${c.h1.map(line).join('')}</span></h1>
          <p class="bn-tighten-stamp"><svg viewBox="0 0 104 104" width="30" height="30" aria-hidden="true"><path fill="#F15A38" fill-rule="evenodd" d="M28 4H72L94 34V40L83 51L98 66V77L73 100H28L2 52Z M36 23V49L66 39V33Z M36 58V85L66 75V69Z"/></svg><b>${c.stamp}</b></p>
          <p class="bn-tighten-lead">${c.lead}</p>
          <div class="bn-actions"><a class="bn-btn" href="#list" data-go="list" data-purchase-event="start">BOM·RFQ 보내기 <span aria-hidden="true">↗</span></a><a class="bn-btn bn-btn-outline" href="#products" data-go="products">제품 보기 <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>
      <p class="bn-tighten-hint" aria-hidden="true"><i></i>내려서 조립해 보세요</p>
      <p class="bn-tighten-note">참고용 실시간 렌더링 · 실제 제품 사진 아님 · 개념 형상</p>
    </div>
  </section>`;
}

/* ── 형상: 격자(grid)로 면을 만들고 법선은 이웃 점의 차로 구한다. 면마다 격자를 나눠 모서리를 날카롭게 둔다.
   부품은 모두 자기 축을 x로 두고 만든다 (세워 쓰는 것은 렌더러가 축을 돌려 놓는다). 좌표 단위는 mm (개념 형상) ── */
function bnTightenParts() {
  const c = BN_TIGHTEN, k = c.k, TAU = Math.PI * 2, PI = Math.PI;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function builder() {
    const pos = [], nor = [], ao = [], idx = [];
    function grid(nu, nv, f, wrap) {
      const base = pos.length / 3, V = [], W = nu + 1;
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) V.push(f(i, j));
      const at = (i, j) => V[j * W + i];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const ip = wrap ? (i >= nu ? 1 : i + 1) : Math.min(nu, i + 1), im = wrap ? (i <= 0 ? nu - 1 : i - 1) : Math.max(0, i - 1);
        const A = at(ip, j), B = at(im, j), C = at(i, Math.min(nv, j + 1)), D = at(i, Math.max(0, j - 1)), v = at(i, j);
        const ux = A[0] - B[0], uy = A[1] - B[1], uz = A[2] - B[2], vx = C[0] - D[0], vy = C[1] - D[1], vz = C[2] - D[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
        pos.push(v[0], v[1], v[2]); nor.push(nx / l, ny / l, nz / l); ao.push(v[3] ?? 1);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = base + j * W + i, b = a + 1, e = a + W, g = e + 1; idx.push(a, b, e, b, g, e); }
    }
    // 축(x) 둘레의 띠: sections = [{x, r(a), ao}]
    const ring = (nu, sec) => grid(nu, sec.length - 1, (i, j) => { const a = i / nu * TAU, q = sec[j], r = typeof q.r === 'function' ? q.r(a) : q.r; return [q.x, r * Math.cos(a), r * Math.sin(a), q.ao ?? 1]; }, true);
    // 반쪽 회전체 (up: y ≥ 0 쪽). 축 x, 반지름 R(x). 양 끝은 구멍(bore)까지 막는다
    function half(R, x0, x1, nx, up, bore) {
      const a0 = up ? 0 : PI, na = 30, pt = (x, r, i, o) => { const a = a0 + PI * i / na; return [x, r * Math.sin(a), r * Math.cos(a), o]; };
      grid(na, nx, (i, j) => { const x = x0 + (x1 - x0) * j / nx; return pt(x, R(x), i, 1); }, false);
      [x0, x1].forEach(x => grid(na, 1, (i, j) => pt(x, j ? R(x) : bore, i, j ? 1 : .45), false));
    }
    // 판: x0…x1, y0…y1, z는 ±W(x). faces: t 윗면, b 아랫면, s 옆면, e 끝면
    function slab(W, x0, x1, y0, y1, nx, faces) {
      const X = j => x0 + (x1 - x0) * j / nx, has = f => !faces || faces.includes(f);
      for (const [f, y] of [['t', y1], ['b', y0]]) if (has(f)) grid(1, nx, (i, j) => [X(j), y, (i ? 1 : -1) * W(X(j))], false);
      if (has('s')) for (const sg of [1, -1]) grid(1, nx, (i, j) => [X(j), i ? y1 : y0, sg * W(X(j))], false);
      if (has('e')) for (const x of [x0, x1]) grid(1, 1, (i, j) => [x, j ? y1 : y0, (i ? 1 : -1) * W(x)], false);
    }
    // 수평 원판 (y 높이, 중심 cx·cz). r0 > 0이면 고리
    const disc = (cx, y, cz, r, r0 = 0, o = 1) => grid(20, 1, (i, j) => { const a = i / 20 * TAU, q = j ? r : r0; return [cx + q * Math.cos(a), y, cz + q * Math.sin(a), o]; }, true);
    return { grid, ring, half, slab, disc, done: () => ({ pos: new Float32Array(pos), nor: new Float32Array(nor), ao: new Float32Array(ao), idx: new Uint16Array(idx) }) };
  }
  const hexRf = S => a => (S / 2) / Math.cos(((a % (TAU / 6)) + TAU / 6) % (TAU / 6) - TAU / 12);
  // 육각 몸체 한쪽 끝의 30° 모따기: 면(안쪽 반지름 r0 – 모따기 원) + 원뿔과 육각의 교선
  function hexEnd(b, S, x, dir, r0, aoFace) {
    const hexR = hexRf(S), rch = .47 * S, cmax = (S / 2 / Math.cos(TAU / 12) - rch) * Math.tan(TAU / 12), n = 5;
    b.ring(48, [{ x, r: r0, ao: aoFace }, { x, r: rch, ao: 1 }]);
    b.ring(48, Array.from({ length: n + 1 }, (_, i) => { const t = i / n * cmax; return { x: x + dir * t, r: a => Math.min(hexR(a), rch + t / Math.tan(TAU / 12)) }; }));
    return x + dir * cmax;
  }
  // ISO 68-1 기본 산형: 골 평탄부 P/4, 플랭크 30°, 산 평탄부 P/8. 오른나사 = 각도가 늘면 +x로 전진. tip: 모따기할 끝 (1 = x1, -1 = x0)
  function thread(b, x0, x1, P, rM, seg, tip) {
    const rm = rM - .5413 * P, nu = Math.ceil((x1 - x0) / P * seg), rEnd = rm - .12 * P, xe = tip > 0 ? x1 : x0;
    [[0, 0, .25, 0], [.25, 0, .5625, 1], [.5625, 1, .6875, 1], [.6875, 1, 1, 0]].forEach(([f0, h0, f1, h1]) => b.grid(nu, 1, (i, j) => {
      const a = i / seg * TAU, f = j ? f1 : f0, h = j ? h1 : h0, x = Math.min(x1, x0 + P * (i / seg + f)), r = Math.min(rm + (rM - rm) * h, rEnd + Math.abs(xe - x));   // 끝 45° 모따기
      return [x, r * Math.cos(a), r * Math.sin(a), .42 + .58 * h];
    }, false));
    b.ring(24, [{ x: xe, r: .01 }, { x: xe, r: rEnd }]);
  }
  /* 치수 (세운 부품의 x = 높이. 케이싱 맞댐면이 0) */
  const P = DIM.pitch[c.stud] * k, d = parseFloat(c.stud.slice(1)) * k, rM = d / 2, S = DIM.hexS[c.stud] * k, WH = DIM.pwH[c.stud] * k, W1 = DIM.pwD1[c.stud] * k / 2, W2 = DIM.pwD2[c.stud] * k / 2;
  const Ps = DIM.pitch[c.screw] * k, ds = parseFloat(c.screw.slice(1)) * k, Ss = DIM.hexS[c.screw] * k, Ks = DIM.hexK[c.screw] * k;
  const T = 30, Tb = 22, seat = T + WH, top = seat + c.nutTurns * P;          // 케이싱·베어링 하우징 플랜지 두께, 캡 너트 좌면 높이, 스터드 끝
  const XC = 204, Rc = x => 70 + 78 * sm(170, 86, Math.abs(x)), Wc = x => Rc(x) + 74, zStud = x => Rc(x) + 37;   // 케이싱: 길이의 반, 몸통 반지름, 플랜지 폭의 반
  const XB = 292, LB = 48, Rb = 74, Wb = 124, zScrew = 99, RS = 26;           // 베어링 하우징 중심·길이의 반·반지름·플랜지 폭의 반, 축 반지름
  // 스터드: 하부 플랜지에 심겨 있다 (x −T−5 … top). 위쪽이 나사부
  const stud = builder();
  stud.ring(24, [{ x: -T - 5, r: .01 }, { x: -T - 5, r: rM - 1.4 }, { x: -T - 3.6, r: rM }]); stud.ring(24, [{ x: -T - 3.6, r: rM }, { x: T - 8, r: rM }]);
  thread(stud, T - 8 - P, top, P, rM, 20, 1);
  // 캡 너트 (자체 좌표 0 = 좌면): 위가 막힌 육각 너트 (대표 지적 2026-11-10: 끝은 둥글지 않고 육각이다). 스터드 끝을 덮는다
  const nut = builder(), hexR = hexRf(S), Hd = 1.6 * d;   // 높이: 스터드가 들어갈 깊이(nutTurns × P)에 막힌 윗벽을 더한 것보다 크다
  const n0 = hexEnd(nut, S, 0, 1, rM, .6), n1 = hexEnd(nut, S, Hd, -1, .01, 1);
  nut.ring(48, [{ x: n0, r: hexR }, { x: n1, r: hexR }]);
  nut.ring(24, [{ x: 0, r: rM, ao: .3 }, { x: 4, r: rM, ao: .2 }]);
  // 평와셔 (0 … WH)
  const washer = builder(), wb = .5;
  washer.ring(32, [{ x: 0, r: W2 - wb }, { x: wb, r: W2 }]); washer.ring(32, [{ x: wb, r: W2 }, { x: WH - wb, r: W2 }]); washer.ring(32, [{ x: WH - wb, r: W2 }, { x: WH, r: W2 - wb }]);
  washer.ring(32, [{ x: WH, r: W2 - wb }, { x: WH, r: S / 2 + 1, ao: .55 }, { x: WH, r: W1, ao: .4 }]);
  // 육각머리 볼트 (0 = 머리 밑 좌면, 몸통은 −x). 아래쪽이 나사부
  const screw = builder(), hexRs = hexRf(Ss), sLen = Tb + c.screwTurns * Ps + 5, s1 = hexEnd(screw, Ss, Ks, -1, .01, 1);
  screw.ring(48, [{ x: s1, r: hexRs }, { x: 1.2, r: hexRs }]); screw.ring(48, [{ x: 1.2, r: hexRs }, { x: 1.2, r: .46 * Ss }, { x: 0, r: .46 * Ss }, { x: 0, r: ds / 2, ao: .5 }]);
  screw.ring(24, [{ x: 0, r: ds / 2 }, { x: -Tb + 4, r: ds / 2 }]);
  thread(screw, -sLen, -Tb + 4, Ps, ds / 2, 20, -1);
  // 테이퍼 핀 1:50 (0 = 상부 플랜지 윗면. 굵은 끝이 위로 조금 나온다)
  const pin = builder(), Lp = 2 * T + 14, d2 = 20, d1 = d2 - Lp / 50, xp = 7 - Lp;
  pin.ring(24, [{ x: xp, r: .01 }, { x: xp, r: d1 / 2 - 1.3 }, { x: xp + 1.3, r: d1 / 2 }]); pin.ring(24, [{ x: xp + 1.3, r: d1 / 2 }, { x: 5.6, r: d2 / 2 }]);
  pin.ring(24, [{ x: 5.6, r: d2 / 2 }, { x: 7, r: d2 / 2 - 1.4 }, { x: 7, r: .01 }]);
  // 케이싱 하부·상부 (몸통 반쪽 + 플랜지). 맞댐면은 따로 만든다 (열려 있을 때 빛난다)
  const NX = 48, lower = builder(), upper = builder(), faceL = builder(), faceU = builder(), pit = builder(), holes = builder();
  lower.half(Rc, -XC, XC, NX, false, RS + 12); lower.slab(Wc, -XC, XC, -T, 0, NX, 'bse');
  upper.half(Rc, -XC, XC, NX, true, RS + 12); upper.slab(Wc, -XC, XC, 0, T, NX, 'tse');
  faceL.slab(Wc, -XC, XC, -T, 0, NX, 't'); faceU.slab(Wc, -XC, XC, 0, T, NX, 'b');
  // 하부 맞댐면의 속(어두운 자리): 축이 놓이는 홈과 임펠러 자리
  pit.slab(() => RS + 9, -XC, XC, 0, .3, 1, 't'); pit.slab(() => 128, -34, 34, 0, .35, 1, 't');
  // 베어링 하우징 하부·상부 (중심을 0에 두고 만들어 양쪽에 놓는다)
  const bLower = builder(), bUpper = builder(), bFaceL = builder(), bFaceU = builder(), bHoles = builder();
  bLower.half(() => Rb, -LB, LB, 4, false, RS + 5); bLower.slab(() => Wb, -LB, LB, -Tb, 0, 2, 'bse');
  bUpper.half(() => Rb, -LB, LB, 4, true, RS + 5); bUpper.slab(() => Wb, -LB, LB, 0, Tb, 2, 'tse');
  bFaceL.slab(() => Wb, -LB, LB, -Tb, 0, 2, 't'); bFaceU.slab(() => Wb, -LB, LB, 0, Tb, 2, 'b');
  // 축과 임펠러
  const shaft = builder(), imp = builder();
  shaft.ring(32, [{ x: -XB - LB - 14, r: .01 }, { x: -XB - LB - 14, r: RS }, { x: XB + LB + 14, r: RS }]);
  shaft.ring(32, [{ x: XB + LB + 14, r: RS }, { x: XB + LB + 14, r: RS - 7 }, { x: XB + LB + 78, r: RS - 7 }, { x: XB + LB + 78, r: .01 }]);
  imp.ring(48, [{ x: -44, r: RS }, { x: -30, r: 46 }, { x: -15, r: 108 }, { x: 15, r: 108 }, { x: 30, r: 46 }, { x: 44, r: RS }]);
  // 흡입·토출 노즐 (하부에 붙는다. 0 = 케이싱 쪽, 끝에 플랜지)
  const nozzle = (r, L, rf) => { const b = builder(); b.ring(40, [{ x: 0, r }, { x: L - 24, r }]); b.ring(40, [{ x: L - 24, r }, { x: L - 24, r: rf }]); b.ring(40, [{ x: L - 24, r: rf }, { x: L, r: rf }]);
    b.ring(40, [{ x: L, r: rf }, { x: L, r: r - 9 }]); b.ring(40, [{ x: L, r: r - 9, ao: .5 }, { x: L - 70, r: r - 9, ao: .12 }]); return b.done(); };
  // 받침: 바닥판과 다리
  const base = builder();
  base.slab(() => 186, -XB - LB - 16, XB + LB + 16, -192, -180, 1);
  for (const x of [-112, 112]) base.slab(() => 124, x - 40, x + 40, -180, -60, 1, 'se');
  for (const x of [-XB, XB]) base.slab(() => 66, x - 34, x + 34, -180, -40, 1, 'se');
  // 체결 위치. 순번 s는 앞줄 왼쪽부터 차례로
  const sx = [-150, -90, -30, 30, 90, 150], studs = [], screws = [], pins = [];
  [1, -1].forEach((sg, row) => sx.forEach((x, i) => studs.push({ x, z: sg * zStud(x), s: (row * sx.length + i) / (2 * sx.length - 1) })));
  [-XB, XB].forEach((x0, e) => [1, -1].forEach((sg, row) => [-26, 26].forEach((dx, i) => screws.push({ x: x0 + dx, z: sg * zScrew, s: (e * 4 + row * 2 + i) / 7 }))));
  pins.push({ x: -184, z: zStud(184), big: 1 }, { x: 184, z: -zStud(184), big: 1 });
  [-XB, XB].forEach(x0 => pins.push({ x: x0, z: zScrew }, { x: x0, z: -zScrew }));
  // 구멍 자리 (어두운 원판): 상부 플랜지 윗면의 스터드·핀 구멍, 베어링 하우징 상부의 볼트·핀 구멍
  studs.forEach(q => holes.disc(q.x, T + .25, q.z, rM + 1.6, 0, .2)); pins.filter(q => q.big).forEach(q => holes.disc(q.x, T + .25, q.z, d2 / 2 + .6, 0, .2));
  [1, -1].forEach(sg => { [-26, 26].forEach(dx => bHoles.disc(dx, Tb + .25, sg * zScrew, ds / 2 + 1.4, 0, .2)); bHoles.disc(0, Tb + .25, sg * zScrew, d2 * .4 + .6, 0, .2); });
  return { dims: { k, P, Ps, T, Tb, WH, seat, XB }, studs, screws, pins,
    stud: stud.done(), nut: nut.done(), washer: washer.done(), screw: screw.done(), pin: pin.done(), lower: lower.done(), upper: upper.done(), faceL: faceL.done(), faceU: faceU.done(), pit: pit.done(), holes: holes.done(),
    bLower: bLower.done(), bUpper: bUpper.done(), bFaceL: bFaceL.done(), bFaceU: bFaceU.done(), bHoles: bHoles.done(), shaft: shaft.done(), imp: imp.done(), nozS: nozzle(60, 120, 98), nozD: nozzle(48, 120, 84), base: base.done() };
}

/* ── 렌더러: 스튜디오 조명(소프트박스)을 식으로 계산해 금속 반사를 만든다 ── */
function bnTightenRenderer(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const N = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); }, X = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const v3 = v => `vec3(${v.map(x => x.toFixed(4)).join(',')})`;
  // 방향(dir)에 놓인 사각 조명판. size = 반각의 탄젠트 [가로, 세로]
  const LIGHTS = [
    { dir: [.2, 1, .45], size: [1.1, .55], col: [1, .99, .97], k: 2.4 },       // 위 큰 소프트박스
    { dir: [.9, .22, .62], size: [.09, 1.2], col: [.96, .98, 1], k: 3.6 },     // 오른쪽 세로 띠
    { dir: [.1, .12, 1], size: [.06, 1.1], col: [.85, .92, 1], k: 2.2 },       // 정면 가는 띠
    { dir: [-.75, .3, .55], size: [.16, 1], col: [.72, .82, 1], k: 1.5 },      // 왼쪽 푸른 띠
    { dir: [.55, -.12, -.82], size: [1, .8], col: [.5, .58, .7], k: .42 },      // 축 방향 면에 비치는 넓은 벽
    { dir: [.35, -.62, .7], size: [.5, .16], col: [1, .36, .16], k: 1.5 },     // 브랜드 주황 림 (아래)
  ].map(L => { const c = N(L.dir), t1 = N(X(c, Math.abs(c[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), t2 = X(t1, c); return `col += ${v3(L.col.map(x => x * L.k))} * pane(d, ${v3(c)}, ${v3(t1)}, ${v3(t2)}, vec2(${L.size.join(',')}), s);`; }).join('\n');
  const VS = `attribute vec3 aP, aN; attribute float aA; uniform mat4 uVP, uM; uniform vec2 uShift; varying vec3 vP, vN; varying float vA;
void main(){ vec4 w = uM * vec4(aP, 1.); vP = w.xyz; vN = (uM * vec4(aN, 0.)).xyz; vA = aA; vec4 c = uVP * w; c.xy += uShift * c.w; gl_Position = c; }`;
  // uOrbit = (주황빛이 도는 각도, 세기): 고정 순간 빛이 장면을 한 바퀴 돈다. uSeam = 이음매(맞댐면 높이)에 그 빛이 맺히는 정도
  const FS = `precision highp float; varying vec3 vP, vN; varying float vA; uniform vec3 uCam, uTint, uEmis; uniform float uRough, uSeam; uniform vec2 uOrbit;
float pane(vec3 d, vec3 c, vec3 t1, vec3 t2, vec2 hs, float s){ float f = dot(d, c); if (f <= 0.) return 0.; vec2 q = abs(vec2(dot(d, t1), dot(d, t2)) / f); vec2 e = smoothstep(hs + s, hs - s, q); return e.x * e.y; }
vec3 env(vec3 d, float r){ float s = .03 + r * .85;
  vec3 col = mix(vec3(.010, .012, .016), vec3(.055, .064, .08), smoothstep(-.25, .9, d.y));
  col += vec3(.85, .92, 1.) * .09 * exp(-pow(d.y * 5.5, 2.)) * (1. - r);
  ${LIGHTS}
  vec3 c = normalize(vec3(cos(uOrbit.x), .3, sin(uOrbit.x))), t1 = normalize(cross(c, vec3(0., 1., 0.))), t2 = cross(t1, c);
  col += vec3(1., .44, .14) * 7. * uOrbit.y * pane(d, c, t1, t2, vec2(.2, .9), s + .06);
  return col; }
void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float g = fract(sin(floor(vP.y * 2.2) * 91.7) * 43758.5) - .5; n = normalize(n + vec3(0., g, 0.) * uRough * uRough * .16);   // 주물·가공 결
  vec3 v = normalize(uCam - vP); float nv = clamp(dot(n, v), 0., 1.);
  vec3 f = uTint + (1. - uTint) * pow(1. - nv, 5.);
  vec3 col = env(reflect(-v, n), uRough) * f;
  col += uTint * uRough * .56 * (.25 + .75 * max(dot(n, normalize(vec3(.22, 1., .34))), 0.));   // 거친 면(주물)의 퍼지는 빛: 형태가 어둠에 묻히지 않게
  col *= mix(.22, 1., vA) * mix(1., .34, uRough * 2. * smoothstep(430., 900., length(vP.xz)));   // 거친 면은 가운데에서 멀수록 어둡게 (체결부에 시선이 가도록)
  col += uEmis * vA * vA;
  float da = atan(vP.z, vP.x) - uOrbit.x; da = atan(sin(da), cos(da));
  col += vec3(2.8, .56, .08) * uSeam * uOrbit.y * exp(-da * da * 2.4) * exp(-vP.y * vP.y / 256.);
  col = 1. - exp(-col * 1.3); gl_FragColor = vec4(pow(col, vec3(.4545)), 1.); }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.bindAttribLocation(prog, 0, 'aP'); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n), u = { VP: U('uVP'), M: U('uM'), Shift: U('uShift'), Cam: U('uCam'), Tint: U('uTint'), Emis: U('uEmis'), Rough: U('uRough'), Seam: U('uSeam'), Orbit: U('uOrbit') };
  const parts = bnTightenParts(), D = parts.dims;
  const buf = m => { const mk = (data, target = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; }; return { p: mk(m.pos), n: mk(m.nor), a: mk(m.ao), i: mk(m.idx, gl.ELEMENT_ARRAY_BUFFER), count: m.idx.length }; };
  const B = {}; for (const [name, m] of Object.entries(parts)) if (m && m.pos) B[name] = buf(m);
  const aN = gl.getAttribLocation(prog, 'aN'), aA = gl.getAttribLocation(prog, 'aA');
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  // 행렬 (열 우선)
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
  const persp = (fy, asp, n, f) => { const t = 1 / Math.tan(fy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const look = (e, c) => { const z = N([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = N(X([0, 1, 0], z)), y = X(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
  // 놓기: 부품의 축(자기 x)을 axis 방향으로 세우고, 자기 축 둘레로 spin만큼 돌린 뒤 (x, y, z)로 옮긴다. 오른손 좌표를 지킨다 (나사 방향이 뒤집히지 않게)
  const AX = { x: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], y: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], z: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], nz: [[0, 0, -1], [0, 1, 0], [1, 0, 0]] };
  const place = (x, y, z, axis = 'x', spin = 0, sc = 1) => { const [bx, by, bz] = AX[axis], c = Math.cos(spin) * sc, s = Math.sin(spin) * sc;
    return new Float32Array([bx[0] * sc, bx[1] * sc, bx[2] * sc, 0, c * by[0] + s * bz[0], c * by[1] + s * bz[1], c * by[2] + s * bz[2], 0, -s * by[0] + c * bz[0], -s * by[1] + c * bz[1], -s * by[2] + c * bz[2], 0, x, y, z, 1]); };
  function draw(b, m, tint, rough, emis = [0, 0, 0], seam = 0) {
    gl.uniformMatrix4fv(u.M, false, m); gl.uniform3fv(u.Tint, tint); gl.uniform1f(u.Rough, rough); gl.uniform3fv(u.Emis, emis); gl.uniform1f(u.Seam, seam);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.a); gl.enableVertexAttribArray(aA); gl.vertexAttribPointer(aA, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
  }
  const C = BN_TIGHTEN, body = [.27, .3, .345], cap = [.33, .365, .415], mach = [.62, .64, .67], steel = [.80, .82, .85], darkc = [.03, .034, .04], bronze = [.74, .6, .4], hot = [2.6, .52, .07];
  /* vw: { p, bob(첫 화면에서 기다릴 때 상부가 떠서 흔들리는 높이), px, py, narrow, orbit: [각도, 세기] } */
  function render(vw) {
    const w = canvas.width, h = canvas.height, asp = w / h, wide = !vw.narrow;   // narrow = 글이 아래, 그림이 위 (CSS 820px 분기와 같다)
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const az = (1.2 - .2 * vw.p) + vw.px * .05, el = (.5 - .12 * vw.p) - vw.py * .035, dist = 3080 * Math.max(1, (wide ? 1.5 : .9) / asp) * (1 - .05 * vw.p);
    const tgt = [0, 14, 0], eye = [tgt[0] + dist * Math.cos(el) * Math.cos(az), tgt[1] + dist * Math.sin(el), tgt[2] + dist * Math.cos(el) * Math.sin(az)];
    gl.uniformMatrix4fv(u.VP, false, mul(persp(.36, asp, 300, 9000), look(eye, tgt)));
    gl.uniform2f(u.Shift, wide ? .2 : 0, wide ? -.04 : .4);   // 넓은 화면: 글(왼쪽)과 계산 용지(오른쪽) 사이에 놓는다 gl.uniform3fv(u.Cam, eye); gl.uniform2f(u.Orbit, vw.orbit[0], vw.orbit[1]);
    const q0 = bnTightenPose(vw.p), lift = q0.lift + vw.bob, k = D.k, open = lift > .02, glow = hot.map(x => x * (open ? Math.exp(-lift / 13) : 0)), I = place(0, 0, 0), up = place(0, lift, 0);
    // 고정된 것: 받침, 하부, 축, 노즐, 스터드
    draw(B.base, I, [.12, .135, .155], .5);
    draw(B.lower, I, body, .42, undefined, 1); draw(B.faceL, I, mach, .3, glow); draw(B.pit, I, darkc, .6);
    draw(B.nozS, place(-52, -84, -100, 'nz'), body, .42); draw(B.nozD, place(52, -84, 100, 'z'), body, .42);
    draw(B.shaft, I, steel, .16); draw(B.imp, I, bronze, .24);
    for (const x of [-D.XB, D.XB]) { const m = place(x, 0, 0); draw(B.bLower, m, body, .42, undefined, 1); draw(B.bFaceL, m, mach, .3, glow); }
    for (const q of parts.studs) draw(B.stud, place(q.x, 0, q.z, 'y'), steel, .16);
    // 내려오는 것: 케이싱 상부, 베어링 하우징 상부 (같이 내려온다)
    draw(B.upper, up, cap, .42, undefined, 1); draw(B.faceU, up, mach, .3, glow); draw(B.holes, up, darkc, .6);
    for (const q of parts.studs) draw(B.washer, place(q.x, D.T + lift, q.z, 'y'), [.7, .72, .75], .24);
    for (const x of [-D.XB, D.XB]) { const m = place(x, lift, 0); draw(B.bUpper, m, cap, .42, undefined, 1); draw(B.bFaceU, m, mach, .3, glow); draw(B.bHoles, m, darkc, .6); }
    // 핀: 상·하부가 만난 뒤에 박힌다
    const pinUp = (1 - q0.pin) * 132 + lift * .35;
    for (const q of parts.pins) draw(B.pin, place(q.x, (q.big ? D.T : D.Tb) + lift + pinUp, q.z, 'y', 0, q.big ? 1 : .8), steel, .14);
    // 캡 너트·육각머리 볼트: 나사 시작점까지 내려온 뒤 돌며 조여진다 (시계 방향 = 위에서 볼 때. 한 바퀴에 1피치)
    for (const q of parts.studs) { const f = bnTightenPose(vw.p, q.s); draw(B.nut, place(q.x, D.seat + f.nut.left * k + (1 - f.drop) * 96 + lift * .7, q.z, 'y', -f.nut.theta), steel, .12); }
    for (const q of parts.screws) { const f = bnTightenPose(vw.p, q.s); draw(B.screw, place(q.x, D.Tb + f.screw.left * k + (1 - f.drop) * 84 + lift * .7, q.z, 'y', -f.screw.theta), steel, .14); }
  }
  const info = gl.getExtension('WEBGL_debug_renderer_info'), name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return { gl, render, soft: /swiftshader|llvmpipe|software/i.test(name), lose: () => gl.getExtension('WEBGL_lose_context')?.loseContext() };
}

function bnTightenInit() {
  bnTightenCleanup?.();
  const root = view().querySelector('.bn-tighten');
  if (!root) return;
  const stage = root.querySelector('.bn-tighten-stage'), canvas = root.querySelector('canvas'), poster = root.querySelector('.bn-tighten-poster');
  const abort = new AbortController(), opt = { signal: abort.signal, passive: true };
  const still = reduced(), auto = !!navigator.webdriver, narrowMq = matchMedia('(max-width: 820px)');
  let R = null;
  try { R = bnTightenRenderer(canvas); } catch (e) { R = null; }
  const fallback = () => { R = null; root.classList.add('is-fallback'); poster.src = 'media/boltnote-tighten-poster.webp'; poster.hidden = false; canvas.hidden = true; };
  if (!R) fallback();
  if (still || !R) root.classList.add('is-static');
  const pinned = !root.classList.contains('is-static');
  let target = pinned ? 0 : 1, cur = target, raf = 0, last = 0, live = false, visible = true, seated = null, sweepAt = -1e9, idleAt = performance.now(), px = 0, py = 0, tx = 0, ty = 0;
  // 느린 기기: 그림 해상도를 낮춰 끊기지 않게 한다 (다시 올리지는 않는다). __bnTightenFull은 포스터 캡처 도구(tools/render_tighten_poster.mjs)가 켠다
  let quality = R?.soft && !window.__bnTightenFull ? .6 : 1, slow = 0, counted = 0;
  const C = BN_TIGHTEN;
  function layout() {
    // 머리띠가 따라오면(sticky) 그 아래에 무대를 붙이고, 따라오지 않으면(휴대폰) 첫 화면에서 머리띠 높이만큼 무대를 줄여 버튼이 한 화면에 들어오게 한다
    const tb = document.querySelector('.tb'), sticky = tb && getComputedStyle(tb).position === 'sticky', th = tb ? tb.offsetHeight : 0;
    root.style.setProperty('--tight-top', (sticky ? th : 0) + 'px'); root.style.setProperty('--tight-head', (sticky ? 0 : th) + 'px');
    root.style.setProperty('--tight-mini', ($('tb-mini')?.offsetHeight || 0) + 'px');   // 휴대폰 고정 막대 높이: 렌더링 안내를 그 아래에 둔다
    const roll = root.querySelector('.bn-math-roll'), strip = root.querySelector('.bn-math-strip');
    if (roll && strip) root.style.setProperty('--roll', Math.max(0, strip.offsetHeight - roll.clientHeight) + 'px');   // 계산 용지가 창을 지나 넘어갈 길이
    resize(); measure(); request();
  }
  function resize() {
    if (!R) return;
    const cw = stage.clientWidth, ch = stage.clientHeight, k = Math.min(2, devicePixelRatio || 1, Math.sqrt(2.6e6 / Math.max(1, cw * ch))) * quality;   // 최대 약 260만 화소
    const w = Math.max(2, Math.round(cw * k)), h = Math.max(2, Math.round(ch * k));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }
  function measure() {
    if (!pinned) return;
    const r = root.getBoundingClientRect(), top = parseFloat(root.style.getPropertyValue('--tight-top')) || 0, span = root.offsetHeight - stage.offsetHeight;
    target = span > 0 ? Math.min(1, Math.max(0, (top - r.top) / span)) : 1;
  }
  function paint(now) {
    const ease = Math.min(1, Math.max(0, (cur - .01) / (C.p2 - .01))), e = ease * ease * (3 - 2 * ease);
    root.style.setProperty('--p', cur.toFixed(4)); root.style.setProperty('--e', e.toFixed(4)); root.style.setProperty('--w', String(Math.round(C.w0 + (C.w1 - C.w0) * e)));
    root.style.setProperty('--m', Math.min(1, Math.max(0, (cur - C.pa) / (C.p2 - C.pa))).toFixed(4));   // 상·하부가 만난 뒤부터 고정까지
    root.style.setProperty('--r', Math.min(1, Math.max(0, cur / C.p2)).toFixed(4));                      // 계산 용지가 넘어간 정도: 조립 내내 조금씩
    root.style.setProperty('--t', Math.pow(Math.min(1, Math.max(0, (cur - C.pb) / (C.p2 - C.pb))), 2.2).toFixed(4));   // 곡선 위의 예압: 조일수록, 끝에서 빠르게 오른다
    const s = cur >= C.p2 - 1e-4;
    if (s !== seated) { if (s && seated === false && pinned) { sweepAt = now; bnImpact(root, 'slam'); } seated = s; root.dataset.seated = String(s); }   // 고정 순간: 화면이 흔들리고 주황빛이 한 바퀴 돈다 (v9_tighten_scenes.js)
    if (!R) return false;
    // 첫 화면에서 기다릴 때: 떠 있는 상부가 조금 오르내린다
    const idle = pinned && !auto && cur < .02 && now - idleAt < 9000, bob = idle ? 5 * (1 - Math.cos((now - idleAt) / 2100 * Math.PI * 2)) * Math.min(1, (9000 - (now - idleAt)) / 1500) : 0;
    const sw = (now - sweepAt) / 2200, sweeping = sw >= 0 && sw < 1;   // 고정 순간: 주황빛이 이음매를 따라 한 바퀴 돈다 (보는 쪽 왼편에서 시작해 앞을 지나 뒤로 돌아온다)
    px += (tx - px) * .08; py += (ty - py) * .08;
    const moving = Math.abs(tx - px) + Math.abs(ty - py) > .002;
    R.render({ p: cur, bob, px, py, narrow: narrowMq.matches, orbit: [2.5 - (sweeping ? sw : 0) * Math.PI * 2, sweeping ? Math.pow(Math.sin(sw * Math.PI), .35) : 0] });
    return idle || sweeping || moving;
  }
  function frame(now) {
    raf = 0;
    if (!root.isConnected) return cleanup();
    const fresh = !live || !last, gapMs = now - last, dt = fresh ? 16 : Math.min(64, gapMs); last = now;
    if (!fresh && R && quality > .42 && !window.__bnTightenFull) {   // 이어지는 프레임이 계속 느리면(평균 34 ms 초과) 해상도를 낮춘다
      slow += gapMs; counted++;
      if (counted >= 20) { if (slow / counted > 34) { quality *= .75; resize(); } slow = counted = 0; }
    }
    cur += (target - cur) * (1 - Math.exp(-dt / 110)); if (Math.abs(target - cur) < .0004) cur = target;
    const more = paint(now);
    live = visible && !document.hidden && (cur !== target || more);
    if (live) request();
  }
  function request() { if (!raf) raf = requestAnimationFrame(frame); }
  function cleanup() { abort.abort(); io?.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0; try { R?.lose(); } catch (e) {} if (bnTightenCleanup === cleanup) bnTightenCleanup = null; }
  bnTightenCleanup = cleanup;
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { last = 0; request(); } }, { threshold: 0 }) : null;
  io?.observe(root);
  addEventListener('scroll', () => { if (!root.isConnected) return cleanup(); measure(); request(); }, opt);
  addEventListener('resize', layout, opt);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; request(); } }, opt);
  stage.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || still) return; const r = stage.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width * 2 - 1; ty = (e.clientY - r.top) / r.height * 2 - 1; if (cur < .02 && performance.now() - idleAt > 9000) idleAt = performance.now(); request(); }, opt);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback(); }, { signal: abort.signal });
  window.__tightenTest = { pose: bnTightenPose, cfg: C, pitch: { nut: DIM.pitch[C.stud], screw: DIM.pitch[C.screw] }, state: () => ({ p: cur, target, webgl: !!R, pinned, seated, quality, size: [canvas.width, canvas.height] }) };
  layout();
}

/* 홈 제목 글꼴: 홈 제목들(BN_DISPLAY_SEL)에 실제로 쓰인 글자만 골라 Google Fonts에 요청한다 (text= → 작은 파일 하나).
   문구가 바뀌면 글자 목록도 저절로 바뀐다. 글꼴이 오기 전이나 받지 못하면 기본 글꼴로 보인다. 데이터 절약 모드에서는 요청하지 않는다. */
function bnHomeFontInit() {
  if (navigator.connection?.saveData) return;
  const chars = [...new Set([...view().querySelectorAll(BN_DISPLAY_SEL)].map(el => el.textContent).join('').replace(/\s/g, ''))].sort().join('');
  if (!chars) return;
  const href = 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@100..900&display=swap&text=' + encodeURIComponent(chars);
  let link = document.getElementById('bn-home-font');
  if (link?.getAttribute('href') === href) return;
  if (!link) { link = document.createElement('link'); link.id = 'bn-home-font'; link.rel = 'stylesheet'; document.head.appendChild(link); }
  link.href = href;
}
