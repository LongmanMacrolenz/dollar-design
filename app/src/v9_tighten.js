/* 홈 첫 화면 "조임 장면" (대표 결정 2026-11-10: 파스너의 기능 — 조이고 고정한다 — 을 설명 대신 그림으로 보인다).
   화면을 내리면 너트가 돌아 조여지고, 떨어져 있던 두 판이 붙으며 멈춘다. 글자 사이도 같이 조여진다.
   - 그리는 방식: 라이브러리 없는 WebGL. 형상은 코드로 만든다 (M16×2 공칭: DIM의 피치·맞변·머리 높이·너트 높이·와셔, ISO 68-1 기본 산형).
     외부 요청이 없고 사진·영상 파일을 쓰지 않는다. "참고용 실시간 렌더링 · 실제 제품 사진 아님"을 화면에 적는다.
   - 틀리면 안 되는 것 (tools/test_precision.py와 같은 기준, worker/tests/browser.py check_home이 확인):
     오른나사, 한 바퀴에 정확히 1피치 전진(advance = pitch × turns), 좌면에 닿으면 더 돌지도 파고들지도 않는다,
     판 간격은 너트가 닿은 뒤의 전진량만큼만 줄고 0 아래로 내려가지 않는다. 토크·축력·합격 같은 수치는 주장하지 않는다.
   - 문구·버튼은 조작 없이 항상 보인다. 움직임 줄이기면 조여진 정지 장면, WebGL이 안 되면 정지 이미지로 바꾼다 (오류를 내지 않는다).
   - 글씨도 같은 이야기를 한다 (대표 요청 2026-11-10): 「작은 것이,」는 가늘게, 「전부를 붙잡습니다.」는 조여질수록 굵어져 고정 순간 가장 굵다.
     제목 글꼴은 굵기가 이어지는 가변 글꼴 Hahmlet(SIL OFL). bnHomeFontInit이 홈 제목에 쓰인 글자만 Google Fonts에 요청한다.
   순수 함수 bnTightenPose(p)가 스크롤 진행률 p(0–1)를 자세로 바꾼다. 화면 연결은 bnTightenInit (V.after.home). */
const BN_TIGHTEN = { size: 'M16', free: 9, clamp: 5, p0: .06, p1: .5, p2: .8, plate: 16, len: 80, w0: 520, w1: 800,
  h1: ['작은 것이,', '전부를 붙잡습니다.'], stamp: '볼트는, 볼트노트.', lead: '체결부품 조달, BOM부터 정확하게.' };
const BN_DISPLAY_SEL = '.bn-tighten h1, .bn-tighten-stamp b, .bn-door b, .bn-home .bn-section-head h2, .bn-home .bn-rfq-copy h2';   // zzzzzzzzzz_home.css의 제목 글꼴 규칙과 같은 목록
let bnTightenCleanup = null;

function bnTightenPose(p) {
  const c = BN_TIGHTEN, P = DIM.pitch[c.size], total = c.free + c.clamp;
  p = Math.min(1, Math.max(0, +p || 0));
  // 자유 회전(빠르게) → 접촉 뒤 조임(점점 느리게). 두 구간의 속도가 p1에서 이어지도록 지수를 맞춘다.
  const a = 1.6, k = a * c.free * (c.p2 - c.p1) / ((c.p1 - c.p0) * c.clamp);
  let turns = total;
  if (p <= c.p0) turns = 0;
  else if (p < c.p1) turns = c.free * Math.pow((p - c.p0) / (c.p1 - c.p0), a);
  else if (p < c.p2) turns = c.free + c.clamp * (1 - Math.pow(1 - (p - c.p1) / (c.p2 - c.p1), k));
  return { turns, theta: 2 * Math.PI * turns, advance: P * turns, gap: P * Math.min(c.clamp, Math.max(0, total - turns)), contact: turns >= c.free, seated: p >= c.p2 };
}

function bnTightenMarkup() {
  const c = BN_TIGHTEN;
  const line = (t, n) => `<span class="bn-tl${n ? '' : ' bn-thin'}">${[...t].map((ch, i, a) => `<span class="bn-tc${ch === ' ' ? ' sp' : ''}" style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</span>`;
  return `<section class="bn-tighten" id="bn-tighten" aria-labelledby="h-z-a" data-seated="false" style="--p:0;--e:0;--w:${c.w0}">
    <div class="bn-tighten-stage">
      <canvas class="bn-tighten-canvas" aria-hidden="true"></canvas>
      <img class="bn-tighten-poster" alt="" width="1600" height="1000" decoding="async" hidden>
      <div class="bn-wrap bn-tighten-inner">
        <div class="bn-brand-copy bn-tighten-copy">
          <p class="bn-tighten-eyebrow" lang="en">BOLTNOTE <span>/</span> INDUSTRIAL FASTENERS</p>
          <h1 id="h-z-a" tabindex="-1" aria-label="${c.h1.join(' ')}"><span aria-hidden="true">${c.h1.map(line).join('')}</span></h1>
          <p class="bn-tighten-stamp"><svg viewBox="0 0 104 104" width="30" height="30" aria-hidden="true"><path fill="#F15A38" fill-rule="evenodd" d="M28 4H72L94 34V40L83 51L98 66V77L73 100H28L2 52Z M36 23V49L66 39V33Z M36 58V85L66 75V69Z"/></svg><b>${c.stamp}</b></p>
          <p class="bn-tighten-lead">${c.lead}</p>
          <div class="bn-actions"><a class="bn-btn" href="#list" data-go="list" data-purchase-event="start">BOM·RFQ 보내기 <span aria-hidden="true">↗</span></a><a class="bn-btn bn-btn-outline" href="#products" data-go="products">제품 보기 <span aria-hidden="true">↗</span></a></div>
        </div>
      </div>
      <p class="bn-tighten-hint" aria-hidden="true"><i></i>내려서 조여 보세요</p>
      <p class="bn-tighten-note">참고용 실시간 렌더링 · 실제 제품 사진 아님 · ${c.size}×${DIM.pitch[c.size]} 공칭 형상</p>
    </div>
  </section>`;
}

/* ── 형상: 격자(grid)로 면을 만들고 법선은 이웃 점의 차로 구한다. 면마다 격자를 나눠 모서리를 날카롭게 둔다 ── */
function bnTightenParts() {
  const c = BN_TIGHTEN, s = c.size, TAU = Math.PI * 2;
  const P = DIM.pitch[s], d = parseFloat(s.slice(1)), S = DIM.hexS[s], K = DIM.hexK[s], M = DIM.nutM[s], W1 = DIM.pwD1[s] / 2, W2 = DIM.pwD2[s] / 2, WH = DIM.pwH[s];
  const T = c.plate, rM = d / 2, rm = rM - .5413 * P, xEnd = c.len - T, xt0 = 6, HY = 210, ZN = 35, ZF = 300;
  const hexR = a => (S / 2) / Math.cos(((a % (TAU / 6)) + TAU / 6) % (TAU / 6) - TAU / 12);
  // 큰 사각 판: 위아래(y ±HY)와 뒤(z −ZF)는 화면 밖으로 이어지고, 앞 모서리(z +ZN)만 볼트 가까이 보인다
  const sq = a => Math.min(HY / Math.max(1e-6, Math.abs(Math.cos(a))), (Math.sin(a) > 0 ? ZN : ZF) / Math.max(1e-6, Math.abs(Math.sin(a))));
  const PLATE_A = [...new Set([...Array.from({ length: 96 }, (_, i) => i / 96 * TAU), Math.atan2(ZN, HY), Math.PI - Math.atan2(ZN, HY), Math.PI + Math.atan2(ZF, HY), TAU - Math.atan2(ZF, HY)])].sort((a, b) => a - b);
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
    // nu가 배열이면 그 각도들을 쓴다 (사각 판의 모서리를 정확히 지나게)
    const ring = (nu, sec) => { const A = Array.isArray(nu) ? [...nu, nu[0] + TAU] : null, n = A ? A.length - 1 : nu; return grid(n, sec.length - 1, (i, j) => { const a = A ? A[i] : i / n * TAU, q = sec[j], r = typeof q.r === 'function' ? q.r(a) : q.r; return [q.x, r * Math.cos(a), r * Math.sin(a), q.ao ?? 1]; }, true); };
    return { grid, ring, done: () => ({ pos: new Float32Array(pos), nor: new Float32Array(nor), ao: new Float32Array(ao), idx: new Uint16Array(idx) }) };
  }
  // 육각 몸체 한쪽 끝의 30° 모따기: 면(안쪽 반지름 r0 – 모따기 원) + 원뿔과 육각의 교선
  function hexEnd(b, x, dir, r0, aoFace) {
    const rch = .47 * S, cmax = (S / 2 / Math.cos(TAU / 12) - rch) * Math.tan(TAU / 12), n = 7;
    b.ring(96, [{ x, r: r0, ao: aoFace }, { x, r: rch, ao: 1 }]);
    b.ring(96, Array.from({ length: n + 1 }, (_, i) => { const t = i / n * cmax; return { x: x + dir * t, r: a => Math.min(hexR(a), rch + t / Math.tan(TAU / 12)) }; }));
    return x + dir * cmax;
  }
  // 볼트: 머리(x −T−K … −T) + 원통부 + 나사부(xt0 … xEnd). 고정되어 돌지 않는다.
  const bolt = builder(), xh = hexEnd(bolt, -T - K, 1, .01, 1);
  bolt.ring(96, [{ x: xh, r: hexR }, { x: -T, r: hexR }]);
  bolt.ring(48, [{ x: -T, r: rM }, { x: xt0 + P, r: rM }]);
  const turns = (xEnd - xt0) / P, seg = 64, nu = Math.ceil(turns * seg), rEnd = rm - .25;
  // ISO 68-1 기본 산형: 골 평탄부 P/4, 플랭크 30°, 산 평탄부 P/8. 오른나사 = 각도가 늘면 +x로 전진
  [[0, 0, .25, 0], [.25, 0, .5625, 1], [.5625, 1, .6875, 1], [.6875, 1, 1, 0]].forEach(([f0, h0, f1, h1]) => bolt.grid(nu, 1, (i, j) => {
    const a = i / seg * TAU, f = j ? f1 : f0, h = j ? h1 : h0, x0 = xt0 + P * (i / seg + f), x = Math.min(x0, xEnd);
    const r = Math.min(rm + (rM - rm) * h, rEnd + (xEnd - x));   // 끝 45° 모따기
    return [x, r * Math.cos(a), r * Math.sin(a), .42 + .58 * h];
  }, false));
  bolt.ring(48, [{ x: xEnd, r: .01 }, { x: xEnd, r: rEnd }]);
  // 너트 (자체 좌표 x 0 … M, 0 = 와셔 쪽 면). 양쪽 모따기 + 구멍 입구 접시
  const nut = builder(), rcs = rM + .9, n0 = hexEnd(nut, 0, 1, rM, .6), n1 = hexEnd(nut, M, -1, rcs, 1);
  nut.ring(96, [{ x: n0, r: hexR }, { x: n1, r: hexR }]);
  nut.ring(48, [{ x: M, r: rcs, ao: .8 }, { x: M - .9, r: rM, ao: .35 }]);
  // 평와셔 (x 0 … WH)
  const washer = builder(), wb = .3;
  washer.ring(64, [{ x: 0, r: W2 - wb }, { x: wb, r: W2 }]); washer.ring(64, [{ x: wb, r: W2 }, { x: WH - wb, r: W2 }]); washer.ring(64, [{ x: WH - wb, r: W2 }, { x: WH, r: W2 - wb }]);
  washer.ring(64, [{ x: WH, r: W2 - wb }, { x: WH, r: S / 2 + .6, ao: .55 }, { x: WH, r: W1, ao: .4 }]); washer.ring(64, [{ x: WH, r: W1, ao: .3 }, { x: 0, r: W1, ao: .3 }]);
  // 판 (x 0 … T): 큰 사각 판, 모서리 모따기, 볼트 구멍
  function plate(front) {
    const b = builder(), bv = 1.4, rh = rM + .7, A = PLATE_A;
    b.ring(A, [{ x: 0, r: a => sq(a) - bv }, { x: bv, r: sq }]); b.ring(A, [{ x: bv, r: sq }, { x: T - bv, r: sq }]); b.ring(A, [{ x: T - bv, r: sq }, { x: T, r: a => sq(a) - bv }]);
    b.ring(A, [{ x: T, r: a => sq(a) - bv }, { x: T, r: W2 + 12 }, { x: T, r: W2 + 2, ao: front ? .45 : 1 }, { x: T, r: rh, ao: front ? .25 : 1 }]);
    b.ring(A, [{ x: 0, r: a => sq(a) - bv }, { x: 0, r: rh }]); b.ring(48, [{ x: T, r: rh, ao: .3 }, { x: 0, r: rh, ao: .3 }]);
    return b.done();
  }
  // 판 사이의 빛: 간격만큼 늘어나는 띠 (x 0 … 1을 간격으로 늘린다) + 앞 모서리 둘레로 번지는 빛(halo, 덧셈 합성)
  const glow = builder(); glow.ring(PLATE_A, [[0, .05], [.3, .3], [.5, 1], [.7, .3], [1, .05]].map(([x, ao]) => ({ x, r: a => sq(a) - 2, ao })));
  const halo = builder(), HW = 34, hn = 12;
  halo.grid(hn, 1, (i, j) => { const t = i / hn * 2 - 1; return [t * HW, j ? HY : -HY, ZN + .5, Math.exp(-t * t * 5.5)]; }, false);
  return { dims: { P, d, S, K, M, WH, T, xEnd }, bolt: bolt.done(), nut: nut.done(), washer: washer.done(), plateA: plate(false), plateB: plate(true), glow: glow.done(), halo: halo.done() };
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
  const FS = `precision highp float; varying vec3 vP, vN; varying float vA; uniform vec3 uCam, uTint, uEmis; uniform float uRough, uSweep, uFlash;
float pane(vec3 d, vec3 c, vec3 t1, vec3 t2, vec2 hs, float s){ float f = dot(d, c); if (f <= 0.) return 0.; vec2 q = abs(vec2(dot(d, t1), dot(d, t2)) / f); vec2 e = smoothstep(hs + s, hs - s, q); return e.x * e.y; }
vec3 env(vec3 d, float r){ float s = .03 + r * .85;
  vec3 col = mix(vec3(.010, .012, .016), vec3(.055, .064, .08), smoothstep(-.25, .9, d.y));
  col += vec3(.85, .92, 1.) * .09 * exp(-pow(d.y * 5.5, 2.)) * (1. - r);
  ${LIGHTS}
  vec3 c = normalize(vec3(.62, .3, mix(-1.5, 1.5, uSweep))), t1 = normalize(cross(c, vec3(0., 1., 0.))), t2 = cross(t1, c);
  col += vec3(1., .97, .92) * 5. * uFlash * pane(d, c, t1, t2, vec2(.11, 1.2), s + .05);
  return col; }
void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
  float g = fract(sin(floor(vP.y * 7.) * 91.7) * 43758.5) - .5; n = normalize(n + vec3(0., g, 0.) * uRough * uRough * .22);   // 판의 가공 결
  vec3 v = normalize(uCam - vP); float nv = clamp(dot(n, v), 0., 1.);
  vec3 f = uTint + (1. - uTint) * pow(1. - nv, 5.);
  vec3 col = env(reflect(-v, n), uRough) * f;
  col += uTint * uRough * .16 * max(dot(n, normalize(vec3(.22, 1., .34))), 0.);
  col *= mix(.22, 1., vA) * mix(1., .38, uRough * 2. * smoothstep(34., 230., length(vP.yz)));   // 거친 판은 볼트에서 멀수록 어둡게 (볼트에 시선이 가도록)
  col += uEmis * vA * vA;
  col = 1. - exp(-col * 1.3); gl_FragColor = vec4(pow(col, vec3(.4545)), 1.); }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS); if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.bindAttribLocation(prog, 0, 'aP'); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const U = n => gl.getUniformLocation(prog, n), u = { VP: U('uVP'), M: U('uM'), Shift: U('uShift'), Cam: U('uCam'), Tint: U('uTint'), Emis: U('uEmis'), Rough: U('uRough'), Sweep: U('uSweep'), Flash: U('uFlash') };
  const parts = bnTightenParts(), D = parts.dims;
  const buf = m => { const mk = (data, target = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; }; return { p: mk(m.pos), n: mk(m.nor), a: mk(m.ao), i: mk(m.idx, gl.ELEMENT_ARRAY_BUFFER), count: m.idx.length }; };
  const B = { bolt: buf(parts.bolt), nut: buf(parts.nut), washer: buf(parts.washer), plateA: buf(parts.plateA), plateB: buf(parts.plateB), glow: buf(parts.glow), halo: buf(parts.halo) };
  const aN = gl.getAttribLocation(prog, 'aN'), aA = gl.getAttribLocation(prog, 'aA');
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  // 행렬 (열 우선)
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
  const persp = (fy, asp, n, f) => { const t = 1 / Math.tan(fy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  const look = (e, c) => { const z = N([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = N(X([0, 1, 0], z)), y = X(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]); };
  // 모델: x로 옮기고 x축 둘레로 돌린다 (sx = x 방향 배율)
  const model = (x, ang = 0, sx = 1) => { const c = Math.cos(ang), s = Math.sin(ang); return new Float32Array([sx, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, x, 0, 0, 1]); };
  function draw(b, m, tint, rough, emis = [0, 0, 0]) {
    gl.uniformMatrix4fv(u.M, false, m); gl.uniform3fv(u.Tint, tint); gl.uniform1f(u.Rough, rough); gl.uniform3fv(u.Emis, emis);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.p); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.n); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.a); gl.enableVertexAttribArray(aA); gl.vertexAttribPointer(aA, 1, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i); gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
  }
  const total = BN_TIGHTEN.free + BN_TIGHTEN.clamp;
  /* st: { turns, gap } (bnTightenPose 결과에 흔들림을 더한 값), view: { p, px, py, flash, sweep } */
  function render(st, vw) {
    const w = canvas.width, h = canvas.height, asp = w / h, wide = !vw.narrow;   // narrow = 글이 아래, 그림이 위 (CSS 820px 분기와 같다)
    gl.viewport(0, 0, w, h); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const az = (1.10 - .12 * vw.p) + vw.px * .05, el = (.17 + .05 * vw.p) - vw.py * .035, dist = 318 * Math.max(1, (wide ? 1.5 : .92) / asp) * (1 - .08 * vw.p);
    const tgt = [20, 0, 0], eye = [tgt[0] + dist * Math.cos(el) * Math.cos(az), tgt[1] + dist * Math.sin(el), tgt[2] + dist * Math.cos(el) * Math.sin(az)];
    gl.uniformMatrix4fv(u.VP, false, mul(persp(.36, asp, 40, 2400), look(eye, tgt)));
    gl.uniform2f(u.Shift, wide ? .46 : -.12, wide ? 0 : .44); gl.uniform3fv(u.Cam, eye); gl.uniform1f(u.Sweep, vw.sweep); gl.uniform1f(u.Flash, vw.flash);
    const gap = st.gap, xNut = D.T + D.WH + D.P * (total - st.turns);   // 너트의 와셔 쪽 면. 조일수록 −x(머리 쪽)로 간다
    const steel = [.80, .82, .85], dark = [.105, .12, .14], lit = Math.min(1, gap / 2.5), hot = [2.6, .52, .07];
    draw(B.plateA, model(-D.T), dark, .42);
    draw(B.plateB, model(gap), dark, .42);
    if (gap > .02) draw(B.glow, model(0, 0, gap), [0, 0, 0], 1, hot.map(x => x * lit));
    draw(B.bolt, model(0), steel, .16);
    draw(B.washer, model(gap + D.T), [.7, .72, .75], .24);
    draw(B.nut, model(xNut, -st.turns * Math.PI * 2), steel, .12);   // 시계 방향(보는 쪽 +x 기준)으로 돌며 조여진다
    if (gap > .02) {   // 틈에서 번지는 빛: 색만 더하고(알파는 그대로) 깊이는 쓰지 않는다
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); gl.depthMask(false);
      draw(B.halo, model(gap / 2), [0, 0, 0], 1, [.15, .034, .006].map(x => x * lit * Math.min(1, gap / 6 + .35)));
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
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
    const pose = bnTightenPose(cur), ease = Math.min(1, Math.max(0, (cur - .01) / (C.p2 - .01))), e = ease * ease * (3 - 2 * ease);
    root.style.setProperty('--p', cur.toFixed(4)); root.style.setProperty('--e', e.toFixed(4)); root.style.setProperty('--w', String(Math.round(C.w0 + (C.w1 - C.w0) * e)));
    const s = cur >= C.p2 - 1e-4;
    if (s !== seated) { if (s && seated === false && pinned) { sweepAt = now; root.classList.remove('is-hit'); void root.offsetWidth; root.classList.add('is-hit'); } seated = s; root.dataset.seated = String(s); }
    if (!R) return false;
    // 첫 화면에서 기다릴 때: 너트가 조금 돌았다 풀렸다 한다 (회전과 전진은 같은 피치로 묶인다)
    const idle = pinned && !auto && cur < .02 && now - idleAt < 9000, wob = idle ? .09 * (1 - Math.cos((now - idleAt) / 1900 * Math.PI * 2)) * Math.min(1, (9000 - (now - idleAt)) / 1500) : 0;
    const sw = (now - sweepAt) / 900, sweeping = sw >= 0 && sw < 1;
    px += (tx - px) * .08; py += (ty - py) * .08;
    const moving = Math.abs(tx - px) + Math.abs(ty - py) > .002;
    R.render({ turns: pose.turns + wob, gap: pose.gap }, { p: cur, px, py, narrow: narrowMq.matches, sweep: sweeping ? sw : 0, flash: sweeping ? Math.sin(sw * Math.PI) : 0 });
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
  window.__tightenTest = { pose: bnTightenPose, cfg: C, pitch: DIM.pitch[C.size], state: () => ({ p: cur, target, webgl: !!R, pinned, seated, quality, size: [canvas.width, canvas.height] }) };
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
