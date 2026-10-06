/* ── v7_iadraw.js: 품목 페이지(#c-…)의 2D 치수 도면 칸 ──
   원문 대조 행(f.dims)의 값만 그린다. 값이 없는 호칭·품목은 그림 대신 이유와 견적 방법을 보인다 (없는 치수를 만들어 내지 않는다. SOURCE_RULE.md).
   iaDrawSvg (v7_ia.js)가 맡지 않는 품목의 도면 iaDwMore, 도면이 없을 때의 안내 칸 iaDwNone, 수치 없는 치수 기호 도면 iaDwSym.
   품목 페이지는 3D 형상(v9_shape.js)과 이 칸을 탭으로 묶는다. 이름 접두사 iaDw… / IA_DW… */

const iaDwLab = k => String(k).replace(/^(b1)_939$/, '$1').replace(/^b_(le125|125_200|gt200)$/, 'b').replace('_max_sharp', ' max(이론)').replace('_ref', ' 참고').replace(/_/g, ' ');
// 도면 글자: 표에 분수로 적힌 값은 분수로 (iaCv가 붙인 raw), 나머지는 수
const iaDwFmt = f => { const u = f.sys === 'inch' ? '"' : ''; return v => (typeof v?.raw === 'string' && v.raw.includes('/') ? v.raw : +(+v).toFixed(3)) + u; };
// 호칭 지름: 미터 M8 → 8, 분수 1/4 → 0.25, 번호 크기 #8 → 0.060 + 0.013 × 번호 (ASME B1.1 번호 크기의 기본 바깥지름 정의식)
function iaDwDia(f, size) {
  const sz = String(size), n = sz.match(/^#(\d+)/);
  const d = n ? 0.060 + 0.013 * +n[1] : iaMetricD(sz) || iaQty((sz.match(/^(?:\d+-)?\d+\/\d+|^\d+(?:\.\d+)?/) || [''])[0]);
  return d > 0 ? Object.assign(new Number(d), { key: '호칭 D' }) : null;
}
function iaDwFrame(f, s, body, note, H = 250) {
  const P = 'iaAr', u = f.sys === 'inch' ? 'in' : 'mm';
  return `<svg class="dw ia-dw" viewBox="0 0 560 ${H}" role="img" aria-label="${esc(f.ko)} ${esc(s.size)} 치수 도면"><defs>${marker(P)}</defs>${body}<text class="cap" x="552" y="${H - 8}" text-anchor="end">${esc(f.enStd || '')} · 단위 ${u} · 비례 없음${note ? ' · ' + esc(note) : ''}</text></svg>`;
}
const iaDwLen = s => { const v = iaQty(s.L); return v > 0 ? v : null; };

// 나사류 옆모양 (머리는 왼쪽). o = {head: csk|dome|pan|none, D, A, hh, labs:{D,A,hh}, sock:{w, t, lab}}
function iaDwScrew(f, s, o) {
  const P = 'iaAr', fmt = iaDwFmt(f), cy = 118, x0 = 150, D = +o.D, A = +o.A || D, hh = +o.hh || 0, none = o.head === 'none', csk = o.head === 'csk';
  const L = iaDwLen(s), ref = Math.max(A, D), shown = L || Math.max(hh * 2.8, D * 4.5, ref * 2.2);   // 길이를 고르지 않았으면 모양이 보일 만큼 그린다
  const sc = Math.min(250 / (none || csk ? shown : shown + hh), 112 / ref), hl = none ? 0 : hh * sc, dd = D * sc, aa = A * sc;
  const xh = x0 + hl, xEnd = csk ? x0 + shown * sc : xh + shown * sc, ch = Math.min(3, dd * .16), yb = cy + ref * sc / 2;
  let b = `<path class="cl" d="M${x0 - 14} ${cy}H${r2(xEnd + 14)}"/>`;
  if (o.head === 'csk') b += `<path class="pt" d="M${x0} ${r2(cy - aa / 2)}V${r2(cy + aa / 2)}L${r2(xh)} ${r2(cy + dd / 2)}V${r2(cy - dd / 2)}Z"/>`;
  else if (o.head === 'dome') b += `<path class="pt" d="M${r2(xh)} ${r2(cy - aa / 2)}H${r2(x0 + hl * .5)}Q${x0} ${r2(cy - aa / 2)} ${x0} ${r2(cy - aa * .14)}V${r2(cy + aa * .14)}Q${x0} ${r2(cy + aa / 2)} ${r2(x0 + hl * .5)} ${r2(cy + aa / 2)}H${r2(xh)}Z"/>`;
  else if (o.head === 'pan') { const rr = Math.min(hl * .5, aa * .2); b += `<path class="pt" d="M${r2(xh)} ${r2(cy - aa / 2)}H${r2(x0 + rr)}Q${x0} ${r2(cy - aa / 2)} ${x0} ${r2(cy - aa / 2 + rr)}V${r2(cy + aa / 2 - rr)}Q${x0} ${r2(cy + aa / 2)} ${r2(x0 + rr)} ${r2(cy + aa / 2)}H${r2(xh)}Z"/>`; }
  const sx = none ? x0 : xh;   // 몸통 시작
  b += `<path class="pt" d="M${r2(sx)} ${r2(cy - dd / 2)}H${r2(xEnd - ch)}L${r2(xEnd)} ${r2(cy - dd / 2 + ch)}V${r2(cy + dd / 2 - ch)}L${r2(xEnd - ch)} ${r2(cy + dd / 2)}H${r2(sx)}Z"/>`;
  if (none) b += `<path class="th" d="M${x0} ${r2(cy - dd / 2 + ch + 1)}H${r2(xEnd)}M${x0} ${r2(cy + dd / 2 - ch - 1)}H${r2(xEnd)}"/>`;   // 멈춤나사는 전체가 나사
  if (o.sock) { const w = o.sock.w * sc, t = o.sock.t ? Math.min(o.sock.t * sc, none ? shown * sc : hl) : 0; if (t > 0) b += `<path class="hid" d="M${x0} ${r2(cy - w / 2)}H${r2(x0 + t)}V${r2(cy + w / 2)}H${x0}"/>`; }
  if (!none) b += dimLine(x0, cy - aa / 2, x0, cy + aa / 2, `${o.labs.A} ${fmt(o.A)}`, 'left', 20, P) + dimLine(x0, cy - aa / 2, xh, cy - aa / 2, `${o.labs.hh} ${fmt(o.hh)}`, 'top', 16, P);
  else if (o.sock) b += dimLine(x0, cy - o.sock.w * sc / 2, x0, cy + o.sock.w * sc / 2, `${o.sock.lab} ${fmt(o.sock.v)}`, 'left', 20, P);
  b += dimLine(xEnd, cy - dd / 2, xEnd, cy + dd / 2, `${o.labs.D} ${fmt(o.D)}`, 'right', 24, P);
  b += dimLine(csk || none ? x0 : xh, yb, xEnd, yb, L ? `L ${s.L}${f.sys === 'inch' ? '"' : ''}` : 'L', 'bottom', 18, P);
  if (o.sock && o.sock.t && o.sock.tv) b += `<text class="ds" x="${x0}" y="${r2(yb + 46)}">${esc(o.sock.tLab)} ${esc(fmt(o.sock.tv))}</text>`;
  return iaDwFrame(f, s, b, L ? '' : '길이 L은 주문 사양');
}

// 양끝 나사 스터드: 매입 쪽 b1, 너트 쪽 b (DIN 939식 구분). 길이 L에 따라 b가 달라지는 열은 고른 길이로, 길이를 안 골랐으면 125 이하 열로
function iaDwStud(f, s) {
  const P = 'iaAr', fmt = iaDwFmt(f), cy = 112, x0 = 70, D = iaDwDia(f, s.size), L = iaDwLen(s);
  const b1 = iaCv(f, s.size, 'b1_939'), b = iaCv(f, s.size, L > 200 ? 'b_gt200' : L > 125 ? 'b_125_200' : 'b_le125');
  if (!D || !b1 || !b) return null;
  const shown = L || Math.max((+b + +b1) * 1.6, +D * 8), sc = Math.min(350 / shown, 96 / +D), len = shown * sc, dd = +D * sc, xEnd = x0 + len, ch = Math.min(3, dd * .16), yb = cy + dd / 2;
  let bd = `<path class="cl" d="M${x0 - 14} ${cy}H${r2(xEnd + 14)}"/><path class="pt" d="M${x0 + ch} ${r2(cy - dd / 2)}H${r2(xEnd - ch)}L${r2(xEnd)} ${r2(cy - dd / 2 + ch)}V${r2(cy + dd / 2 - ch)}L${r2(xEnd - ch)} ${r2(cy + dd / 2)}H${x0 + ch}L${x0} ${r2(cy + dd / 2 - ch)}V${r2(cy - dd / 2 + ch)}Z"/>`;
  const t1 = +b1 * sc, t2 = +b * sc, ti = Math.max(ch + 1, dd * .14);
  bd += `<path class="th" d="M${x0} ${r2(cy - dd / 2 + ti)}H${r2(x0 + t1)}M${x0} ${r2(cy + dd / 2 - ti)}H${r2(x0 + t1)}M${r2(xEnd - t2)} ${r2(cy - dd / 2 + ti)}H${xEnd}M${r2(xEnd - t2)} ${r2(cy + dd / 2 - ti)}H${xEnd}"/><path class="eg" d="M${r2(x0 + t1)} ${r2(cy - dd / 2)}V${r2(cy + dd / 2)}M${r2(xEnd - t2)} ${r2(cy - dd / 2)}V${r2(cy + dd / 2)}"/>`;
  bd += dimLine(x0, cy - dd / 2, xEnd, cy - dd / 2, L ? `L ${s.L}` : 'L', 'top', 22, P);
  bd += dimLine(x0, yb, x0 + t1, yb, `${iaDwLab(b1.key)} ${fmt(b1)}`, 'bottom', 20, P) + dimLine(xEnd - t2, yb, xEnd, yb, `${iaDwLab(b.key)} ${fmt(b)}`, 'bottom', 20, P);
  bd += dimLine(xEnd, cy - dd / 2, xEnd, cy + dd / 2, `호칭 D ${fmt(D)}`, 'right', 24, P);
  return iaDwFrame(f, s, bd, L ? '' : '길이 L은 주문 사양', 230);
}

// 캡너트(둥근 모자너트): 위에서 본 육각 s, 옆에서 본 높이 h·둥근 지름 dk
function iaDwCapnut(f, s) {
  const P = 'iaAr', fmt = iaDwFmt(f), sw = iaCv(f, s.size, 's'), h = iaCv(f, s.size, 'h'), dk = iaCv(f, s.size, 'dk_max');
  if (!sw || !h || !dk) return null;
  const sc = Math.min(120 / +h, 130 / (+sw * 1.155)), cy = 120, cx = 150, e = +sw * 1.155 * sc / 2, sf = +sw * sc / 2;
  const pts = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 6 + i * Math.PI / 3; return `${r2(cx + e * Math.cos(a))},${r2(cy + e * Math.sin(a))}`; }).join(' ');
  let b = `<polygon class="ol" points="${pts}"/><circle class="ol" cx="${cx}" cy="${cy}" r="${r2(+dk * sc / 2 * .9)}"/><path class="cl" d="M${r2(cx - e - 12)} ${cy}H${r2(cx + e + 12)}M${cx} ${r2(cy - e - 12)}V${r2(cy + e + 12)}"/>`;
  b += dimLine(cx - sf, cy - e, cx + sf, cy - e, `${iaDwLab(sw.key)} ${fmt(sw)}`, 'top', 14, P);
  const hh = +h * sc, wd = Math.min(+dk, +sw * 1.155) * sc, xm = 390, rise = Math.min(wd / 2, hh * .45), yb = cy + hh / 2, yt = cy - hh / 2;
  b += `<path class="pt" d="M${r2(xm - wd / 2)} ${r2(yb)}V${r2(yt + rise)}A${r2(wd / 2)} ${r2(rise)} 0 0 1 ${r2(xm + wd / 2)} ${r2(yt + rise)}V${r2(yb)}Z"/><path class="cl" d="M${xm} ${r2(yt - 10)}V${r2(yb + 10)}"/>`;
  b += dimLine(xm - wd / 2, yt, xm - wd / 2, yb, `${iaDwLab(h.key)} ${fmt(h)}`, 'left', 18, P) + dimLine(xm - wd / 2, yb, xm + wd / 2, yb, `${iaDwLab(dk.key)} ${fmt(dk)}`, 'bottom', 18, P);
  return iaDwFrame(f, s, b, '둥근 부분 모양은 대표 형상');
}

// 도면을 이 파일이 맡는 품목이면 SVG 글자(또는 그릴 수 없으면 null), 아니면 undefined (iaDrawSvg가 이어서 처리)
function iaDwMore(f, s) {
  if (!f.dims) return undefined;
  const size = s.size, fmtC = (...k) => iaCv(f, size, ...k);
  if (f.eng === 'fhcs') { const D = fmtC('D_max'), A = fmtC('A_max_sharp'), hh = fmtC('H_ref'); return D && A && hh ? iaDwScrew(f, s, { head: 'csk', D, A, hh, labs: { D: iaDwLab(D.key), A: iaDwLab(A.key), hh: iaDwLab(hh.key) } }) : null; }
  if (f.eng === 'bhcs') {
    const D = iaDwDia(f, size);
    if (f.sys === 'inch') { const A = fmtC('A_max'), hh = fmtC('H_max'), J = fmtC('J'); return D && A && hh ? iaDwScrew(f, s, { head: 'dome', D, A, hh, labs: { D: '호칭 D', A: iaDwLab(A.key), hh: iaDwLab(hh.key) }, sock: J ? { w: +J, lab: '육각 구멍 J', v: J } : null }) : null; }
    const A = fmtC('dk'), hh = fmtC('k'), sk = fmtC('s'), t = fmtC('t_min');
    return D && A && hh ? iaDwScrew(f, s, { head: 'dome', D, A, hh, labs: { D: '호칭 d', A: 'dk', hh: 'k' }, sock: sk ? { w: +sk, t: t ? +t : 0, tv: t, tLab: '구멍 깊이 t min', lab: '구멍 s', v: sk } : null }) : null;
  }
  if (f.eng === 'setscrew') { const D = iaDwDia(f, size), J = fmtC('J'), T = fmtC('T_min'); return D && J ? iaDwScrew(f, s, { head: 'none', D, labs: { D: '호칭 D' }, sock: { w: +J, t: T ? +T : 0, tv: T, tLab: '구멍 깊이 T min', lab: '육각 구멍 J', v: J } }) : null; }
  if (f.id === 'ms-pan' || f.id === 'ms-csk') { const D = iaDwDia(f, size), A = fmtC('dk'), hh = fmtC('k'); return D && A && hh ? iaDwScrew(f, s, { head: f.id === 'ms-csk' ? 'csk' : 'pan', D, A, hh, labs: { D: '호칭 d', A: 'dk', hh: 'k' } }) : null; }
  if (f.id === 'stud-te') return iaDwStud(f, s);
  if (f.id === 'capnut') return iaDwCapnut(f, s);
  return undefined;
}

// 치수 기호 도면 (수치 없음): 규격이 정하는 치수가 모양의 어디를 가리키는지만 보인다. 모양이 확실한 품목만
const IA_DW_SYM = { hhb: 'hex', a307: 'hex' };
function iaDwSym(f) {
  const k = IA_DW_SYM[f.id]; if (!k) return '';
  const P = 'iaAr', cy = 112, x0 = 110, hl = 56, hh = 96, dd = 46, xEnd = 440, xs = x0 + hl, tl = 130;
  let b = `<path class="cl" d="M${x0 - 14} ${cy}H${xEnd + 14}"/>`;
  b += `<path class="pt" d="M${x0 + 6} ${cy - hh / 2}H${xs}V${cy + hh / 2}H${x0 + 6}L${x0} ${cy + hh / 2 - 6}V${cy - hh / 2 + 6}Z"/><path class="eg" d="M${x0} ${cy - hh / 6}H${xs}M${x0} ${cy + hh / 6}H${xs}"/>`;
  b += `<path class="pt" d="M${xs} ${cy - dd / 2}H${xEnd - 4}L${xEnd} ${cy - dd / 2 + 4}V${cy + dd / 2 - 4}L${xEnd - 4} ${cy + dd / 2}H${xs}Z"/>`;
  b += `<path class="th" d="M${xEnd - tl} ${cy - dd / 2 + 5}H${xEnd}M${xEnd - tl} ${cy + dd / 2 - 5}H${xEnd}"/><path class="eg" d="M${xEnd - tl} ${cy - dd / 2}V${cy + dd / 2}"/>`;
  b += dimLine(x0, cy - hh / 2, x0, cy + hh / 2, 'F (2면폭)', 'left', 20, P) + dimLine(x0, cy - hh / 2, xs, cy - hh / 2, 'H (머리 높이)', 'top', 16, P);
  b += dimLine(xEnd, cy - dd / 2, xEnd, cy + dd / 2, 'D (몸통 지름)', 'right', 24, P);
  b += dimLine(xs, cy + hh / 2, xEnd, cy + hh / 2, 'L (머리 아래~끝)', 'bottom', 18, P) + dimLine(xEnd - tl, cy + hh / 2 + 36, xEnd, cy + hh / 2 + 36, 'LT (나사부)', 'bottom', 0, P);
  return `<svg class="dw ia-dw ia-dw-sym" viewBox="0 0 560 250" role="img" aria-label="${esc(f.ko)} 치수 기호 도면 (수치 없음)"><defs>${marker(P)}</defs>${b}<text class="cap" x="552" y="242" text-anchor="end">${esc(f.enStd || '')} · 치수 기호만 · 수치 없음 · 비례 없음</text></svg>`;
}

// 견적 때 알려 주실 치수 (품목 종류별 일반 안내. 규격 수치가 아니다)
const IA_DW_ASK = {
  hexbolt: ['호칭 지름과 산 수(피치)', '길이 L — 머리 아래에서 끝까지', '나사부 길이(전나사 여부)'],
  heavyhexbolt: ['호칭 지름과 산 수(1"를 넘으면 8UN 여부)', '길이 L — 머리 아래에서 끝까지', '나사부 길이'],
  bolt: ['호칭 지름과 피치', '길이 L (머리 모양에 따라 재는 위치가 다름)', '머리 모양·나사부 길이'],
  shcs: ['호칭 지름과 피치', '길이 L — 머리 아래에서 끝까지', '머리 높이 종류(표준·저두)'], fhcs: ['호칭 지름과 피치', '전체 길이 L (접시머리는 머리 포함)'], bhcs: ['호칭 지름과 피치', '길이 L — 머리 아래에서 끝까지'],
  setscrew: ['호칭 지름과 피치', '길이 L', '끝 모양(평·컵·원뿔·도그)'], machinescrew: ['호칭 지름과 피치', '길이 L', '머리 모양·드라이브(십자·일자)'], screw: ['호칭 지름·산 수', '길이 L', '머리·끝 모양'],
  stud: ['호칭 지름과 피치', '전체 길이 L', '양쪽 나사부 길이'], rod: ['호칭 지름과 피치', '전체 길이', '나사 범위(전나사·양끝)'],
  nut: ['호칭 지름과 피치', '2면폭·높이 규격(표준·낮은·헤비)'], heavynut: ['호칭 지름과 산 수', '2면폭·높이 규격'], locknut: ['호칭 지름과 피치', '잠금 방식'],
  washer: ['안지름·바깥지름·두께', '규격(평·스프링·이붙이 등)'], lockwasher: ['호칭 지름', '두께·규격'], discspring: ['안지름·바깥지름·두께', '자유 높이·하중'],
  pin: ['지름', '길이', '공차·끝 모양'], ring: ['적용 축·구멍 지름', '두께', '규격'], key: ['폭 b × 높이 h', '길이', '규격'],
  rivet: ['구멍 지름', '그립 길이(판 두께 합)', '머리 모양'], anchor: ['호칭 지름', '전체 길이·묻힘 깊이', '모재(콘크리트·강재)'], expanchor: ['호칭 지름', '길이·묻힘 깊이', '모재 종류'],
  insert: ['호칭 나사', '삽입 길이', '모재·두께'], plug: ['나사 규격(호칭·산 수)', '머리 모양·드라이브', '재질'], standoff: ['나사 호칭', '길이', '양끝 암·수 구분'], clinch: ['나사 호칭', '판 두께·구멍'],
};
const iaDwAsk = f => IA_DW_ASK[String(f.eng).split(' / ')[0]] || ['호칭 지름과 나사', '길이', '재질·표면처리'];

// 2D 칸에 그림이 없을 때의 안내 (그림이 있으면 이 함수는 쓰이지 않는다)
function iaDwNone(f, s) {
  const sym = iaDwSym(f), hasTable = !!(f.dims && f.dims.rows && f.dims.rows.length), size = s && s.size ? s.size : '';
  const why = hasTable
    ? (iaRowOf(f, size) ? '이 품목은 도면 대신 치수표로 확인합니다. 아래 치수표에서 호칭 줄을 고르세요.' : `이 호칭(${esc(size)})은 규격 원문 대조 값이 없어 도면을 그리지 않습니다. 다른 호칭을 고르세요.`)
    : f.dimsHeld ? `치수표는 규격 원문 대조를 마친 뒤 싣습니다${f.gate ? ` (${esc(f.gate)})` : ''}.`
    : '이 품목의 표준 치수표는 규격서 원문과 대조한 값만 싣는 원칙 때문에 아직 싣지 않았습니다. 없는 치수를 추정해서 그리지 않습니다.';
  return `<div class="ia-nd">${sym}<p class="ia-nd-h"><b>2D 치수 도면</b><span class="tag q">${hasTable ? '치수표' : '준비 중'}</span></p><p class="small">${why}</p>
    <p class="small"><b>견적 때 알려 주실 치수</b></p><ul class="ia-nd-ask small">${iaDwAsk(f).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <div class="actions">${hasTable ? '<button type="button" class="btn sm" data-shp-jump="z-b">치수표 보기 ↓</button>' : ''}<a class="btn sm" href="#custom" data-go="custom">도면·규격 번호 보내 견적 요청</a></div></div>`;
}
