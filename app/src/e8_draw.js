
/* ── 도면: drawingFor({q, m}) → SVG 문자열 ──
   규격 치수표 값으로 직접 그린다 (외부 도면 사용 안 함). 인치는 in [mm], 미터는 mm. 척도 NTS. */
let bomDwgN = 0;
// 치수선 (페이지의 dimLine은 인자·마커 방식이 달라 이 블록 전용으로 둔다). mk = 화살표 marker id
function bdDimLine(x1, y1, x2, y2, label, side = 'top', off = 18, mk = 'ar') {
  const horiz = y1 === y2;
  const ox = horiz ? 0 : (side === 'left' ? -off : off), oy = horiz ? (side === 'top' ? -off : off) : 0;
  const a = [x1 + ox, y1 + oy], b = [x2 + ox, y2 + oy];
  const tx = (a[0] + b[0]) / 2 + (horiz ? 0 : (side === 'left' ? -6 : 6)), ty = (a[1] + b[1]) / 2 + (horiz ? (side === 'top' ? -6 : 14) : 4);
  return `<g class="dim"><line x1="${x1}" y1="${y1}" x2="${a[0]}" y2="${a[1]}" /><line x1="${x2}" y1="${y2}" x2="${b[0]}" y2="${b[1]}" />
    <line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" marker-start="url(#${mk})" marker-end="url(#${mk})" />
    <text x="${tx}" y="${ty}" text-anchor="${horiz ? 'middle' : side === 'left' ? 'end' : 'start'}">${label}</text></g>`;
}
// 화살표 marker + 중심선·치수 스타일. 선택자는 .bom-dwg 안으로 한정 (svg 안 <style>은 문서 전체에 걸린다)
const BD_DEFS = id => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 10 5 0 9z" fill="var(--dim)"/></marker></defs>`
  + '<style>.bom-dwg .cl{stroke:var(--ink-3);stroke-width:.8;stroke-dasharray:10 3 2 3}.bom-dwg .dim line{stroke:var(--dim);stroke-width:.9}.bom-dwg .dim text{fill:var(--dim);font:12px var(--f-mono)}</style>';
const BD_STYLE = '<style>.bd-ol{fill:var(--sheet);stroke:var(--ink);stroke-width:1.5;stroke-linejoin:round}.bd-ol2{fill:var(--sheet-2);stroke:var(--ink);stroke-width:1.3;stroke-linejoin:round}.bd-hid{fill:none;stroke:var(--dim);stroke-width:1;stroke-dasharray:5 3}.bd-th{stroke:var(--dim);stroke-width:.7}.bd-tb{fill:none;stroke:var(--hair);stroke-width:1}.bd-k{fill:var(--ink-3);font:9.5px var(--f-sans)}.bd-v{fill:var(--ink);font:11.5px var(--f-mono)}.bd-vs{fill:var(--ink);font:11.5px var(--f-sans)}.bd-n{fill:var(--dim);font:11.5px var(--f-sans)}.bd-tube{fill:none;stroke:var(--ink);stroke-linecap:butt;stroke-linejoin:round}.bd-tubei{fill:none;stroke:var(--sheet);stroke-linecap:butt;stroke-linejoin:round}</style>';
const twEst = (s, fs) => [...String(s)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? fs : fs * .62), 0);
const fitTxt = (s, w, fs) => { s = String(s ?? ''); if (twEst(s, fs) <= w) return s; while (s.length > 1 && twEst(s + '…', fs) > w) s = s.slice(0, -1); return s + '…'; };
function bomDwgCtx(q) {
  const id = 'bd' + (++bomDwgN), inch = q.system === 'inch';
  const nom = v => inch ? `${inFrac(v)}"` : `${+v.toFixed(2)}`;
  const dec = v => inch ? `${v.toFixed(3)}"` : `${+v.toFixed(2)}`;
  const mm = v => inch ? ` [${(v * 25.4).toFixed(v * 25.4 < 10 ? 2 : 1)}]` : '';
  const legend = [];
  // unsrc: 인치 치수표 값이 없어(2026-10 감사로 뺀 값) 그림을 비례 스케치로 그렸을 때 true → 도면 머리에 '규격서 확인 중' 표시
  return { id, inch, legend, unsrc: false, nom: v => nom(v) + mm(v), dec: v => dec(v) + mm(v),
    // 오른쪽 치수는 끝면도와 겹치지 않게 인치는 기호만 쓰고 값은 아래 범례로
    rl: (sym, v, fmt = 'nom') => { if (!inch) return sym === '⌀d' ? `⌀${+v.toFixed(2)}` : `${sym} ${+v.toFixed(2)}`; legend.push(`${sym} = ${fmt === 'nom' ? nom(v) : dec(v)}${mm(v)}`); return sym; },
    dim: (x1, y1, x2, y2, label, side, off) => bdDimLine(x1, y1, x2, y2, esc(label), side, off, id) };
}
const pitchOf = q => q.system === 'inch' ? (q.tpi ? 1 / q.tpi : q.size.v / 8) : (q.pitch || q.size.v * .15);
const hexPts = (cx, cy, R, rot = 0) => Array.from({ length: 6 }, (_, i) => { const a = rot + i * Math.PI / 3; return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
// 원통 몸체 (나사 해칭, 길면 파단선)
function bdShaft(x0, Lp, cy, hh, o = {}) {
  const { tFrom = x0, tTo = x0 + Lp, pp = 6, chL = 0, chR = 0, broken = false } = o;
  let s = '';
  const path = (a, b, cl, cr) => `<path class="bd-ol" d="M${a + cl} ${cy - hh} L${b - cr} ${cy - hh} L${b} ${cy - hh + cr} L${b} ${cy + hh - cr} L${b - cr} ${cy + hh} L${a + cl} ${cy + hh} L${a} ${cy + hh - cl} L${a} ${cy - hh + cl} Z"/>`;
  if (broken) {
    const m = x0 + Lp / 2;
    s += path(x0, m - 5, chL, 0) + path(m + 5, x0 + Lp, 0, chR);
    s += `<path class="bd-th" fill="none" d="M${m - 5} ${cy - hh - 4} q4 ${hh / 2} 0 ${hh} t0 ${hh} M${m + 5} ${cy - hh - 4} q4 ${hh / 2} 0 ${hh} t0 ${hh}"/>`;
  } else s += path(x0, x0 + Lp, chL, chR);
  const step = Math.max(3, pp);
  for (let x = tFrom + 2; x < tTo - 1; x += step) { if (broken && Math.abs(x - (x0 + Lp / 2)) < 8) continue; s += `<line class="bd-th" x1="${x.toFixed(1)}" y1="${cy - hh}" x2="${(x + step * .5).toFixed(1)}" y2="${cy + hh}"/>`; }
  if (tFrom > x0 + 1 || tTo < x0 + Lp - 1) for (const x of [tFrom, tTo]) if (x > x0 + 1 && x < x0 + Lp - 1) s += `<line class="bd-th" x1="${x}" y1="${cy - hh}" x2="${x}" y2="${cy + hh}" stroke-width="1.2"/>`;
  return s;
}
const cline = (x1, x2, cy) => `<line class="cl" x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}"/>`;
// 공통 배치: 측면도 x0=120~430, 끝면도 중심 x=540
const SV = { x0: 165, w: 265, cy: 150, ex: 550, er: 64 };
function fitScale(L, hmax) { const sc = Math.min(130 / hmax, Math.max(SV.w / L, 34 / hmax)); return { sc, broken: L * sc > SV.w + .5, Lp: Math.min(L * sc, SV.w) }; }
function endView(g, ex, cy, R, inner) { return `<circle class="bd-ol" cx="${ex}" cy="${cy}" r="${R.toFixed(1)}"/>${inner}<line class="cl" x1="${ex - R - 10}" y1="${cy}" x2="${ex + R + 10}" y2="${cy}"/><line class="cl" x1="${ex}" y1="${cy - R - 10}" x2="${ex}" y2="${cy + R + 10}"/>`; }

function dwSet(g, q) {
  const inch = g.inch, d = q.size.v, L = (inch ? q.lengthIn : q.lengthMm) || d * 1.5, pt = q.point || 'cup';
  let J, C, P, Qd, R, tip = 0, ang = 90;
  // 인치: 키 J·컵/평 끝지름 C는 표에 있을 때만 값으로 적는다. 오벌 R·하프도그 P·Q·원뿔 각도는 출처가 없어 그림만 비례로 (2026-10 감사)
  let rIn = null;
  if (inch) { rIn = tbl(SS_IN, d) || tbl(SS_IN_MICRO, d) || null; J = rIn ? rIn[1] : d * .45; C = rIn && rIn[3] != null ? rIn[3] : d * .55; R = .75 * d; P = .667 * d; Qd = .25 * d; ang = 90;
    if (!rIn || !['cup', 'flat', 'knurled cup'].includes(pt) || rIn[3] == null) g.unsrc = true; }
  else { const r = SS_MM[q.size.label] || [d * .5, d * .66, d * .25, d * .66, d * .27, d * .52, d * .55]; J = r[0]; C = pt === 'flat' ? r[1] : r[6]; tip = r[2]; P = r[3]; Qd = L >= 2.5 * d ? r[5] : r[4]; R = .75 * d; ang = L < 1.2 * d ? 120 : 90; }
  const { sc, broken, Lp } = fitScale(L, d), x0 = SV.x0, cy = SV.cy, hh = d * sc / 2, xe = x0 + Lp, ch = Math.min(hh * .18, 4);
  let top, tEnd;
  const c = C * sc / 2;
  if (pt === 'cup' || pt === 'knurled cup' || pt === 'flat') { const w = hh - c; tEnd = xe - w; top = `L${xe - w} ${cy - hh} L${xe} ${cy - c} ` + (pt === 'flat' ? `L${xe} ${cy + c}` : `Q${xe - c * 1.1} ${cy} ${xe} ${cy + c}`) + ` L${xe - w} ${cy + hh}`; }
  else if (pt === 'cone') { const len = (hh - tip * sc / 2) / Math.tan(ang / 2 * Math.PI / 180); tEnd = xe - len; top = `L${xe - len} ${cy - hh} L${xe} ${cy - tip * sc / 2} L${xe} ${cy + tip * sc / 2} L${xe - len} ${cy + hh}`; }
  else if (pt === 'oval') { const h = Math.min(hh * .9, R * sc * .5); tEnd = xe - h; top = `L${xe - h} ${cy - hh} Q${xe} ${cy - hh} ${xe} ${cy} Q${xe} ${cy + hh} ${xe - h} ${cy + hh}`; }
  else { const p = P * sc / 2, qq = Qd * sc, w = Math.max(1.5, hh - p); tEnd = xe - qq - w; top = `L${xe - qq - w} ${cy - hh} L${xe - qq} ${cy - p} L${xe} ${cy - p} L${xe} ${cy + p} L${xe - qq} ${cy + p} L${xe - qq - w} ${cy + hh}`; }
  let s = `<path class="bd-ol" d="M${x0} ${cy - hh + ch} L${x0 + ch} ${cy - hh} ${top} L${x0 + ch} ${cy + hh} L${x0} ${cy + hh - ch} Z"/>`;
  const step = Math.max(3, pitchOf(q) * sc);
  for (let x = x0 + ch + 2; x < tEnd - 1; x += step) s += `<line class="bd-th" x1="${x.toFixed(1)}" y1="${cy - hh + 1}" x2="${(x + step / 2).toFixed(1)}" y2="${cy + hh - 1}"/>`;
  if (pt === 'knurled cup') for (let k = -2; k <= 2; k++) s += `<line class="bd-th" x1="${xe - 3}" y1="${cy + k * c / 3}" x2="${xe - c * .6}" y2="${cy + k * c / 3 + 2}"/>`;
  const T = Math.min(L * .5, Math.max(J * 1.1, d * .45)) * sc, sh = J / Math.sqrt(3) * sc;
  s += `<rect class="bd-hid" x="${x0}" y="${(cy - sh).toFixed(1)}" width="${T.toFixed(1)}" height="${(2 * sh).toFixed(1)}"/>` + cline(x0 - 12, xe + 12, cy);
  s += g.dim(x0, cy - hh, xe, cy - hh, `L ${g.nom(L)}`, 'top', 26) + g.dim(x0, cy - hh, x0, cy + hh, inch ? `⌀${g.nom(d)}` : `⌀${d}`, 'left', 20);
  if ((pt === 'cup' || pt === 'flat' || pt === 'knurled cup') && (!inch || (rIn && rIn[3] != null))) s += g.dim(xe, cy - c, xe, cy + c, g.rl(pt === 'flat' ? '⌀C 평끝' : '⌀C 컵', C, 'dec'), 'right', 14);
  if ((pt === 'half dog' || pt === 'dog') && !inch) s += g.dim(xe, cy - P * sc / 2, xe, cy + P * sc / 2, g.rl('⌀P', P, 'dec'), 'right', 14) + g.dim(xe - Qd * sc, cy + hh, xe, cy + hh, `z ${g.dec(Qd)}`, 'bottom', 22);
  if (pt === 'cone' && !inch) s += `<text class="bd-n" x="${xe + 8}" y="${cy + 4}">${ang}°</text>`;
  if (pt === 'oval' && !inch) s += `<text class="bd-n" x="${xe + 8}" y="${cy + 4}">R ${g.dec(R)}</text>`;
  const es = Math.min(SV.er / (d / 2), sc * 1.6), er = d / 2 * es;
  s += endView(g, SV.ex, cy, er, `<polygon class="bd-ol2" points="${hexPts(SV.ex, cy, J / Math.sqrt(3) * es)}"/>`);
  s += `<text class="bd-n" x="${SV.ex}" y="${cy + er + 30}" text-anchor="middle">육각 구멍 키${inch ? (rIn ? ` ${rIn[2]}" (${((inVal(rIn[2]) || J) * 25.4).toFixed(2)} mm)` : ': 규격서 확인 중') : ' ' + J + ' mm'}</text>`;
  s += `<text class="bd-n" x="${x0}" y="${cy + hh + 50}">${esc(threadTxt(q))} · ${PT_KO[pt]}${pt === 'cone' && !inch ? ` ${ang}°` : pt === 'cup' ? ' 118°' : ''}</text>`;
  return s;
}
function dwHead(g, q) {
  const inch = g.inch, d = q.size.v, t = q.type, L = (inch ? q.lengthIn : q.lengthMm) || d * 3, k = q.size.label;
  let A, H, J, LT, ang = inch ? 82 : 90;
  let rIn = null;   // 인치 머리 치수표 행 (없으면 비례 스케치, 값 표기 없음)
  if (inch) { rIn = tbl(t === 'fhcs' ? FHCS_IN : t === 'bhcs' ? BHCS_IN : SHCS_IN, d) || null; A = rIn ? rIn[1] : 1.5 * d; H = rIn ? rIn[2] : d; J = rIn ? rIn[3] : d * .6; LT = L; if (!rIn) g.unsrc = true; }
  else if (t === 'fhcs') { A = DIM.cskDk[k] || 2.24 * d; H = (A - d) / 2; J = DIM.cskS[k] || .6 * d; LT = L; }
  else if (t === 'bhcs') { A = 1.75 * d; H = .55 * d; J = BH_MM_KEY[k] || .6 * d; LT = L; }
  else { A = mmGet('scsDk', k) || 1.5 * d; H = mmGet('scsK', k) || d; J = mmGet('scsS', k) || .75 * d; LT = L > 2 * d + 12 + d ? 2 * d + 12 : L; }
  if (t === 'fhcs') H = (A - d) / 2 / Math.tan(ang / 2 * Math.PI / 180);
  const shankL = t === 'fhcs' ? L - H : L;
  const tot = shankL + H, { sc, broken, Lp: Lp0 } = fitScale(tot, A), x0 = SV.x0, cy = SV.cy;
  const hp = H * sc, Lp = Lp0 - hp, hA = A * sc / 2, hh = d * sc / 2, sx = x0 + hp, xe = sx + Lp;
  let s = '';
  if (t === 'fhcs') s += `<path class="bd-ol" d="M${x0} ${cy - hA} L${sx} ${cy - hh} L${sx} ${cy + hh} L${x0} ${cy + hA} Z"/>`;
  else if (t === 'bhcs') s += `<path class="bd-ol" d="M${sx} ${cy - hA} Q${x0 - hp * .25} ${cy - hA} ${x0} ${cy} Q${x0 - hp * .25} ${cy + hA} ${sx} ${cy + hA} Z"/>`;
  else s += `<rect class="bd-ol" x="${x0}" y="${cy - hA}" width="${hp}" height="${2 * hA}" rx="2"/>`;
  const thr = Math.min(LT, shankL);
  s += bdShaft(sx, Lp, cy, hh, { tFrom: xe - (broken ? Lp * thr / shankL : thr * sc), pp: pitchOf(q) * sc, chR: Math.min(hh * .2, 3), broken });
  const sh = J / Math.sqrt(3) * sc;
  s += `<rect class="bd-hid" x="${x0}" y="${(cy - sh).toFixed(1)}" width="${Math.min(hp * .9, J * 1.2 * sc).toFixed(1)}" height="${(2 * sh).toFixed(1)}"/>` + cline(x0 - 12, xe + 12, cy);
  s += g.dim(t === 'fhcs' ? x0 : sx, cy - hA, xe, cy - hA, `L ${g.nom(L)}${t === 'fhcs' ? ' (전장)' : ''}`, 'top', 26);
  if (!inch || rIn) s += g.dim(x0, cy - hA, x0, cy + hA, `${inch ? 'A' : 'dk'} ${g.dec(A)}`, 'left', 18);
  s += g.dim(xe, cy - hh, xe, cy + hh, g.rl('⌀d', d), 'right', 14);
  // 미터 렌치볼트 k가 표에 없으면(M22 등, 2026-10 감사로 뺀 값) 치수를 적지 않는다
  if (t !== 'fhcs') { if (inch ? !!rIn : t !== 'shcs' || mmGet('scsK', k) != null) s += g.dim(x0, cy + hA, sx, cy + hA, `${inch ? 'H' : 'k'} ${g.dec(H)}`, 'bottom', 22); }
  else s += `<text class="bd-n" x="${x0 + 4}" y="${cy + hA + 22}">${ang}°</text>`;
  if (thr < shankL - 1e-6 && !broken) s += g.dim(xe - thr * sc, cy + hh, xe, cy + hh, `${inch ? 'LT' : 'b'} ${g.dec(thr)}${inch ? ' min' : ' (참고)'}`, 'bottom', 40);
  const es = Math.min(SV.er / (A / 2), sc * 1.4);
  s += endView(g, SV.ex, cy, A / 2 * es, `<polygon class="bd-ol2" points="${hexPts(SV.ex, cy, J / Math.sqrt(3) * es)}"/>`);
  s += `<text class="bd-n" x="${SV.ex}" y="${cy + A / 2 * es + 30}" text-anchor="middle">육각 구멍 키${q.drive ? ' ' + esc(q.drive.label.replace('육각 구멍 · 키 ', '')) : inch ? ': 규격서 확인 중' : ' '}</text>`;
  s += `<text class="bd-n" x="${x0}" y="${cy + hA + 62}">${esc(threadTxt(q))}</text>`;
  return s;
}
function hexDims(q) {
  const inch = q.system === 'inch', d = q.size.v, k = q.size.label, t = q.type;
  if (inch) {
    // 출처 있는 인치 육각 치수는 헤비너트 1/2–1-1/2" (RCSC 2025 표 C-2.1: 2면폭·호칭 높이)뿐. 대각 G는 그림용 계산값(F × 1.1547)이라 적지 않는다.
    // 육각볼트·헤비 육각볼트·육각너트와 그 밖의 헤비너트는 허용 출처 표가 없어 비례 스케치 (src: false → 치수 표기 없음, 2026-10 감사)
    if (t === 'heavynut' || t === 'stud' || t === 'anchor') { const r = hhnIn(d); if (r) return { F: r[2], Fl: r[1], G: r[2] * 1.1547, H: r[4], Hl: r[3], src: true }; }
    const F = 1.5 * d;
    return { F, Fl: '', G: F * 1.1547, H: NUTS.has(t) ? .85 * d : .65 * d, src: false };
  }
  const F = mmGet('hexS', k) || 1.6 * d;
  return { F, Fl: String(F), G: F * 1.1547, H: NUTS.has(t) ? (DIM.nutM[k] || .85 * d) : (mmGet('hexK', k) || .64 * d), src: true };
}
function dwHex(g, q) {
  const inch = g.inch, d = q.size.v, L = (inch ? q.lengthIn : q.lengthMm) || d * 4, hd = hexDims(q);
  let LT = L;
  if (inch) LT = Math.min(L, (L <= 6 ? 2 * d + .25 : 2 * d + .5));   // 그림용 나사부 길이 (B18.2.1 식은 출처가 없어 값으로 적지 않는다)
  if (inch && !hd.src) g.unsrc = true;
  else if (q.sub.thread === 'partial') LT = Math.min(L, L <= 125 ? 2 * d + 6 : L <= 200 ? 2 * d + 12 : 2 * d + 25);
  const tot = L + hd.H, { sc, broken, Lp: Lp0 } = fitScale(tot, hd.G), x0 = SV.x0, cy = SV.cy;
  const hp = hd.H * sc, Lp = Lp0 - hp, hG = hd.G * sc / 2, hh = d * sc / 2, sx = x0 + hp, xe = sx + Lp;
  let s = `<rect class="bd-ol" x="${x0}" y="${cy - hG}" width="${hp}" height="${2 * hG}" rx="1"/><line class="bd-th" x1="${x0}" y1="${cy - hG / 2}" x2="${sx}" y2="${cy - hG / 2}"/><line class="bd-th" x1="${x0}" y1="${cy + hG / 2}" x2="${sx}" y2="${cy + hG / 2}"/>`;
  s += bdShaft(sx, Lp, cy, hh, { tFrom: xe - (broken ? Lp * LT / L : LT * sc), pp: pitchOf(q) * sc, chR: Math.min(hh * .2, 3), broken }) + cline(x0 - 12, xe + 12, cy);
  if (q.special.includes('DRILLED')) s += `<line class="bd-hid" x1="${x0 + hp / 2}" y1="${cy - hG}" x2="${x0 + hp / 2}" y2="${cy + hG}"/>`;
  s += g.dim(sx, cy - hG, xe, cy - hG, `L ${g.nom(L)}`, 'top', 26) + (inch ? '' : g.dim(x0, cy - hG, x0, cy + hG, `G ${g.dec(hd.G)}`, 'left', 18));
  s += (inch ? '' : g.dim(x0, cy + hG, sx, cy + hG, `k ${g.dec(hd.H)}`, 'bottom', 22)) + g.dim(xe, cy - hh, xe, cy + hh, g.rl('⌀d', d), 'right', 14);
  if (LT < L - 1e-6 && !broken && !inch) s += g.dim(xe - LT * sc, cy + hh, xe, cy + hh, `b ${g.dec(LT)} (참고)`, 'bottom', 44);
  const es = Math.min(SV.er / (hd.G / 2), sc * 1.3), R = hd.G / 2 * es;
  s += `<polygon class="bd-ol" points="${hexPts(SV.ex, cy, R)}"/><circle class="bd-hid" cx="${SV.ex}" cy="${cy}" r="${(d / 2 * es).toFixed(1)}"/>` + `<line class="cl" x1="${SV.ex - R - 10}" y1="${cy}" x2="${SV.ex + R + 10}" y2="${cy}"/>`;
  s += `<text class="bd-n" x="${SV.ex}" y="${cy + R + 26}" text-anchor="middle">2면폭${inch ? (hd.src ? ` ${hd.Fl}" (${(hd.F * 25.4).toFixed(1)} mm)` : ': 규격서 확인 중') : ' ' + hd.F + ' mm'}</text>`;
  s += `<text class="bd-n" x="${x0}" y="${cy + hG + 66}">${esc(threadTxt(q))}${q.sub.thread === 'partial' ? ' · 반나사' : q.system === 'metric' ? ' · 온나사' : ''}</text>`;
  return s;
}
function nutSide(x, cy, w, hG) { return `<rect class="bd-ol" x="${x}" y="${cy - hG}" width="${w}" height="${2 * hG}"/><line class="bd-th" x1="${x}" y1="${cy - hG / 2}" x2="${x + w}" y2="${cy - hG / 2}"/><line class="bd-th" x1="${x}" y1="${cy + hG / 2}" x2="${x + w}" y2="${cy + hG / 2}"/>`; }
function dwNut(g, q) {
  const inch = g.inch, d = q.size.v, hd = hexDims(q), cy = SV.cy;
  const sc = Math.min(150 / hd.G, 220 / (hd.G + hd.H * 2)), R = hd.G / 2 * sc, cx = 200;
  let s = `<polygon class="bd-ol" points="${hexPts(cx, cy, R)}"/><circle class="bd-ol" cx="${cx}" cy="${cy}" r="${(d / 2 * sc * .86).toFixed(1)}"/><path class="bd-th" fill="none" d="M${cx + d / 2 * sc} ${cy} A${d / 2 * sc} ${d / 2 * sc} 0 1 1 ${cx} ${cy - d / 2 * sc}"/>`;
  s += `<line class="cl" x1="${cx - R - 12}" y1="${cy}" x2="${cx + R + 12}" y2="${cy}"/><line class="cl" x1="${cx}" y1="${cy - R - 12}" x2="${cx}" y2="${cy + R + 12}"/>`;
  if (inch && !hd.src) g.unsrc = true;
  if (!inch) s += g.dim(cx - R, cy + R * .866, cx + R, cy + R * .866, `G ${g.dec(hd.G)}`, 'bottom', 22);
  if (!inch || hd.src) s += g.dim(cx + R * .5, cy - R * .866, cx + R * .5, cy + R * .866, `F ${inch ? hd.Fl + '"' : hd.F}${inch ? ` [${(hd.F * 25.4).toFixed(1)}]` : ''}`, 'right', R * .5 + 18);
  const sx = 420, w = hd.H * sc;
  s += nutSide(sx, cy, w, R) + (!inch || hd.src ? g.dim(sx, cy - R, sx + w, cy - R, inch ? `H ${hd.Hl}" [${(hd.H * 25.4).toFixed(1)}] (호칭)` : `m ${g.dec(hd.H)}`, 'top', 20) : '');
  s += `<text class="bd-n" x="${cx - R}" y="${cy + R + 58}">${esc(threadTxt(q))}${q.sub.jam ? ' · 잼너트' : ''}${q.hand === 'LH' ? ' · 왼나사 (LH 표시)' : ''}</text>`;
  return s;
}
function dwStud(g, q) {
  const inch = g.inch, d = q.size.v, L = (inch ? q.lengthIn : q.lengthMm) || d * 6, nuts = q.sub.nuts, hd = nuts ? hexDims(q) : null;
  const pitch = pitchOf(q), ptL = pitch * 1.5, tot = L + 2 * ptL;
  const { sc, broken, Lp } = fitScale(tot, nuts ? hd.G : d * 1.6), x0 = SV.x0 - 40, cy = SV.cy, hh = d * sc / 2, pp = ptL * (broken ? Lp / tot : sc), xe = x0 + Lp;
  let s = '';
  if (q.sub.tapEnd) { const bm = d * sc, b = (2 * d + 6) * sc; s += bdShaft(x0, Lp, cy, hh, { tFrom: x0, tTo: x0 + bm, pp: pitch * sc, chL: pp, chR: pp, broken }) + bdShaft(xe - b, b, cy, hh, { pp: pitch * sc, chR: pp }).replace(/<path[^>]*\/>/, ''); s += g.dim(x0, cy + hh, x0 + bm, cy + hh, `bm ≈ ${d} (1d)`, 'bottom', 24); }
  else s += bdShaft(x0, Lp, cy, hh, { pp: pitch * sc, chL: pp, chR: pp, broken });
  s += cline(x0 - 12, xe + 12, cy);
  if (nuts) { const w = hd.H * sc, hG = hd.G * sc / 2; s += nutSide(x0 + pp + 6, cy, w, hG) + nutSide(xe - pp - 6 - w, cy, w, hG); if (hd.src) s += g.dim(xe - pp - 6 - w, cy + hG, xe - pp - 6, cy + hG, inch ? `H ${hd.Hl}" [${(hd.H * 25.4).toFixed(1)}] (호칭)` : `H ${g.dec(hd.H)}`, 'bottom', 22); else g.unsrc = true; }
  const ex = q.sub.cont || q.system === 'metric' ? 0 : pp;
  s += g.dim(x0 + ex, cy - (nuts ? hd.G * sc / 2 : hh), xe - ex, cy - (nuts ? hd.G * sc / 2 : hh), `L ${g.nom(L)}${q.sub.cont || q.system === 'metric' ? '' : ' (포인트 포함 여부는 주문 때 확인)'}`, 'top', 26);
  s += g.dim(xe, cy - hh, xe, cy + hh, g.rl('⌀d', d), 'right', 14);
  if (nuts) {
    const es = Math.min(SV.er / (hd.G / 2), sc * 1.2), R = hd.G / 2 * es, ex2 = SV.ex + 20;
    s += `<polygon class="bd-ol" points="${hexPts(ex2, cy, R)}"/><circle class="bd-hid" cx="${ex2}" cy="${cy}" r="${(d / 2 * es).toFixed(1)}"/>`;
    s += `<text class="bd-n" x="${ex2}" y="${cy + R + 26}" text-anchor="middle">헤비너트 2면폭${inch ? (hd.src ? ' ' + hd.Fl + '"' : ': 규격서 확인 중') : ' ' + hd.F}</text>`;
  }
  s += `<text class="bd-n" x="${x0}" y="${cy + (nuts ? hd.G * sc / 2 : hh) + 64}">${esc(threadTxt(q))}${q.sub.cont ? ' · 전산 스터드' : q.sub.tapEnd ? ' · 탭엔드 스터드' : ''}${nuts ? ` · 헤비너트 ${nuts}개` : ''}</text>`;
  return s;
}
function dwWasher(g, q) {
  const inch = g.inch, d = q.size.v, k = q.size.label;
  let OD, ID, T, Tl;
  let rIn = null;   // F436 치수표 (2026-10 감사로 비어 있음 → 비례 스케치, 값 표기 없음)
  if (inch) { rIn = tbl(F436_IN, d) || null; OD = rIn ? rIn[1] : 2.1 * d; ID = rIn ? rIn[2] : 1.06 * d; T = rIn ? (rIn[3] + rIn[4]) / 2 : .12; Tl = rIn ? `T ${rIn[3].toFixed(3)}–${rIn[4].toFixed(3)}"` : ''; if (!rIn) g.unsrc = true; }
  else { OD = DIM.pwD2[k] || 2 * d; ID = DIM.pwD1[k] || d * 1.08; T = DIM.pwH[k] || .16 * d; Tl = `h ${T}`; }
  const sc = 170 / OD, cx = 210, cy = SV.cy, R = OD / 2 * sc, r = ID / 2 * sc;
  let s = `<circle class="bd-ol" cx="${cx}" cy="${cy}" r="${R}"/><circle class="bd-ol2" cx="${cx}" cy="${cy}" r="${r}"/><line class="cl" x1="${cx - R - 12}" y1="${cy}" x2="${cx + R + 12}" y2="${cy}"/><line class="cl" x1="${cx}" y1="${cy - R - 12}" x2="${cx}" y2="${cy + R + 12}"/>`;
  const lab = !inch || !!rIn;
  if (lab) s += g.dim(cx - R, cy + R, cx + R, cy + R, `OD ${g.dec(OD)}`, 'bottom', 18) + g.dim(cx - r, cy - R, cx + r, cy - R, `ID ${g.dec(ID)}`, 'top', 14);
  const sx = 440, w = Math.max(4, T * sc);
  s += `<rect class="bd-ol" x="${sx}" y="${cy - R}" width="${w}" height="${2 * R}"/><rect class="bd-hid" x="${sx}" y="${cy - r}" width="${w}" height="${2 * r}"/>` + (lab ? g.dim(sx, cy - R, sx + w, cy - R, inch ? Tl + ` [${(T * 25.4).toFixed(2)}]` : Tl, 'top', 14) : '');
  if (q.sub.f436) s += `<text class="bd-n" x="${sx + w + 12}" y="${cy + 4}">F436 마킹면</text>`;
  return s;
}
function dwLock(g, q) {
  const inch = g.inch, d = q.size.v, k = q.size.label;
  let ID, OD, t, b;
  let rIn = null;   // B18.21.1 치수표 (2026-10 감사로 비어 있음 → 비례 스케치, 값 표기 없음)
  if (inch) { rIn = tbl(LW_IN, d) || null; ID = rIn ? rIn[1] : d * 1.01; OD = rIn ? rIn[2] : d * 1.8; t = rIn ? rIn[3] : d * .25; b = rIn ? rIn[4] : d * .4; if (!rIn) g.unsrc = true; }
  else { ID = DIM.swD1[k] || d * 1.02; OD = DIM.swD2[k] || d * 1.8; t = DIM.swS[k] || d * .25; b = (OD - ID) / 2; }
  const sc = 170 / OD, cx = 210, cy = SV.cy, R = OD / 2 * sc, r = ID / 2 * sc, gap = Math.max(3, t * sc * .6);
  let s = `<path class="bd-ol" fill-rule="evenodd" d="M${cx + R} ${cy - gap / 2} A${R} ${R} 0 1 0 ${cx + R} ${cy + gap / 2} L${cx + r} ${cy + gap / 2} A${r} ${r} 0 1 1 ${cx + r} ${cy - gap / 2} Z"/><line class="cl" x1="${cx - R - 12}" y1="${cy}" x2="${cx + R + 12}" y2="${cy}"/>`;
  const lab = !inch || !!rIn;
  if (lab) s += g.dim(cx - R, cy + R, cx + R, cy + R, `OD ${g.dec(OD)} max`, 'bottom', 18) + g.dim(cx - r, cy - R, cx + r, cy - R, `ID ${g.dec(ID)} min`, 'top', 14);
  const sx = 440, w = Math.max(4, t * sc);
  s += `<path class="bd-ol" d="M${sx} ${cy - R} L${sx + w} ${cy - R + 4} L${sx + w} ${cy + R} L${sx} ${cy + R - 4} Z"/>` + (lab ? g.dim(sx, cy - R, sx + w, cy - R, `t ${g.dec(t)}`, 'top', 18) : '');
  if (lab) s += `<text class="bd-n" x="${sx - 20}" y="${cy + R + 28}">단면 ${inch ? 't × b' : 's × b'} = ${g.dec(t)} × ${g.dec(b)}</text>`;
  return s;
}
function dwRod(g, q) {
  const inch = g.inch, d = q.size.v, L = (inch ? q.lengthIn : q.lengthMm) || (inch ? 36 : 1000);
  const { sc, broken, Lp } = fitScale(L, d * 1.6), x0 = SV.x0 - 40, cy = SV.cy, hh = d * sc / 2;
  let s = bdShaft(x0, Lp, cy, hh, { pp: pitchOf(q) * sc, chL: 2, chR: 2, broken }) + cline(x0 - 12, x0 + Lp + 12, cy);
  s += g.dim(x0, cy - hh, x0 + Lp, cy - hh, `L ${inch ? (q.lengthLabel.includes('ft') ? q.lengthLabel : g.nom(L)) : L.toLocaleString() + ' mm'}`, 'top', 26) + g.dim(x0 + Lp, cy - hh, x0 + Lp, cy + hh, g.rl('⌀d', d), 'right', 14);
  s += `<text class="bd-n" x="${x0}" y="${cy + hh + 44}">${esc(threadTxt(q))} · 전체 나사 · ${inch ? '' : '정척 1 m 단위, '}현장 절단 시 끝 나사 정리 필요</text>`;
  return s;
}
function dwAnchor(g, q) {
  const inch = g.inch, d = q.size.v, L = (inch ? q.lengthIn : q.lengthMm) || d * 30, hook = q.sub.hook || (inch ? 4 * d : 4 * d), shape = q.sub.shape;
  const cy = 120, x0 = SV.x0 + 10, Lp = 330, sc = Lp / L, w = Math.max(10, d * sc * 2.2), hk = Math.min(110, Math.max(40, hook * sc * 2.2));
  const thrL = Math.min(L * .25, (inch ? 6 : 150)), tp = thrL / L * Lp;
  let path = `M${x0 + Lp} ${cy} L${x0 + (shape === 'J' ? hk / 2 : 0)} ${cy}`;
  if (shape === 'L') path += ` L${x0} ${cy + hk}`;
  if (shape === 'J') path += ` A${hk / 2} ${hk / 2} 0 0 0 ${x0 + hk / 2} ${cy + hk} L${x0 + hk} ${cy + hk}`;
  let s = `<path class="bd-tube" stroke-width="${w}" d="${path}"/><path class="bd-tubei" stroke-width="${w - 3}" d="${path}"/>`;
  for (let x = x0 + Lp - tp + 2; x < x0 + Lp - 1; x += 4) s += `<line class="bd-th" x1="${x}" y1="${cy - w / 2 + 1.5}" x2="${x + 2}" y2="${cy + w / 2 - 1.5}"/>`;
  if (q.sub.nut) { const hw = w * .9, hG = w * 1.1; s += nutSide(x0 + Lp - tp * .45, cy, hw, hG); if (q.sub.washer) s += `<rect class="bd-ol" x="${x0 + Lp - tp * .45 - 4}" y="${cy - hG * 1.25}" width="4" height="${hG * 2.5}"/>`; }
  s += g.dim(x0, cy - w / 2, x0 + Lp, cy - w / 2, `L ${g.nom(L)} (전장)`, 'top', 26) + g.dim(x0 + Lp - tp, cy + w / 2, x0 + Lp, cy + w / 2, '나사부: 도면 지정', 'bottom', 26);
  if (shape === 'L' || shape === 'J') s += g.dim(x0, cy, x0, cy + hk, `훅 ${g.nom(hook)}`, 'left', 18);
  s += `<text class="bd-n" x="${x0}" y="${cy + hk + 50}">${esc(threadTxt(q))} · ${shape === 'L' ? 'L형' : shape === 'J' ? 'J형' : '직선형'} 앵커 · 끝면 색 표시 (F1554 등급별)</text>`;
  return s;
}
function titleBlock(item, W, H) {
  const { q, m } = item, y = H - 86, x = 8, w = W - 16;
  const cell = (cx, cy, cw, k, v, mono = true) => `<rect class="bd-tb" x="${cx}" y="${cy}" width="${cw}" height="39"/><text class="bd-k" x="${cx + 6}" y="${cy + 13}">${k}</text><text class="${mono ? 'bd-v' : 'bd-vs'}" x="${cx + 6}" y="${cy + 31}">${esc(fitTxt(v, cw - 12, 11.5))}</text>`;
  const pn = m.pn || (m.alt && m.alt.exact ? m.alt.pn + ' (기본품)' : '견적 후 부여');
  const spec = `${threadTxt(q)}${q.lengthLabel ? ' × ' + q.lengthLabel.replace(/ \(.*$/, '') : ''} · ${q.typeLabel}`;
  const c2 = [190, 150, 76, 64]; const c2w = w - c2.reduce((a, b) => a + b, 0);
  let s = cell(x, y, 220, '품번', pn) + cell(x + 220, y, w - 220, '규격', spec, false);
  let cx = x;
  [['재질/등급', q.mat ? q.mat.label : '미기재', false], ['표면처리', q.fin ? q.fin.label.replace(/ · 기본값$/, '') : '—', false], ['단위', q.system === 'inch' ? 'in [mm]' : 'mm'], ['척도', 'NTS']].forEach(([k, v, mono], i) => { s += cell(cx, y + 41, c2[i], k, v, mono !== false); cx += c2[i]; });
  s += cell(cx, y + 41, c2w, '치수 근거', q.dimStd.replace(/ \(.*$/, '') || '—', false);
  return s;
}
function drawingFor(item, opt = {}) {
  const { q, m } = item;
  // 변형품(나비너트·플랜지 볼트 등)은 표준품 도면으로 대신하지 않는다
  if (!q.size || q.size.v == null || m.status === 'not-available' || q.variant) return null;
  const fn = { setscrew: dwSet, shcs: dwHead, fhcs: dwHead, bhcs: dwHead, hexbolt: dwHex, heavyhexbolt: dwHex, bolt: dwHex, capscrew: dwHex, stud: dwStud, nut: dwNut, heavynut: dwNut, washer: dwWasher, lockwasher: dwLock, rod: dwRod, anchor: dwAnchor }[q.type];
  if (!fn) return null;
  const g = bomDwgCtx(q);
  let body; try { body = fn(g, q, m); } catch (e) { return null; }
  if (!body) return null;
  const W = 640, H = 400, title = `${q.typeLabel} ${threadTxt(q)}${q.lengthLabel ? ' × ' + q.lengthLabel.replace(/ \(.*$/, '') : ''} 치수 도면`;
  const unver = g.unsrc ? '<text class="bd-k" x="632" y="16" text-anchor="end">치수: 규격서 확인 중 · 그림은 비례 스케치 (값은 출처 있는 것만)</text>'
    : (q.system === 'metric' && q.type === 'setscrew') || q.type === 'stud' ? '<text class="bd-k" x="632" y="16" text-anchor="end">일부 치수 일반 자료 기준 · 게시 전 원문 대조</text>' : '';
  if (g.legend.length) body += `<text class="bd-n" x="16" y="304">${esc(g.legend.join(' · '))}</text>`;
  return `<svg class="bom-dwg${opt.thumb ? ' thumb' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${g.id}t ${g.id}d"><title id="${g.id}t">${esc(title)}</title><desc id="${g.id}d">${esc(specLine(q))}. 치수 근거 ${esc(q.dimStd)}. 척도 없음.</desc>${BD_DEFS(g.id)}${BD_STYLE}${unver}${body}${titleBlock(item, W, H)}</svg>`;
}
