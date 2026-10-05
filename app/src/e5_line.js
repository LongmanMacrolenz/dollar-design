
// 원문에서 읽은 값만 담는다 (기본값은 bomDerive에서 채운다). force: 사용자가 고친 품목·호칭 {type, size}
function parseCore(text, force = {}) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim();
  let U = bomNorm(raw);
  const pnM = U.match(/\b(?:OEM\s*)?P\s*\/\s*N\.?\s*:?\s*([A-Z0-9][A-Z0-9.\-]*)/);
  const partNo = pnM ? pnM[1] : null;
  if (pnM) U = (U.slice(0, pnM.index) + ' ' + U.slice(pnM.index + pnM[0].length)).replace(/\s+/g, ' ').trim();
  // notes: 화면용 문자열, ev: 같은 자리의 구조화 이벤트 (bomDerive가 q.assumptions·q.ev로 옮긴다)
  const notes = [], ev = [], nt = (text, rule, p) => { notes.push(text); bomEv(ev, rule, p); };
  // '1.1/8'처럼 점을 대분수 구분으로 쓴 표기 → '1-1/8' (분모 2·4·8·16·32·64의 진분수만, 성적서 '3.1' 표기가 있는 줄은 건드리지 않음)
  if (!/EN\s*10204|CERT|\bMTC\b|MILL/.test(U)) U = U.replace(/(?<![\w.\/-])([1-9]\d?)\.(\d{1,2})\/(2|4|8|16|32|64)(?![\d\/.])/g, (s0, w, n, d) => {
    if (+n >= +d) return s0;
    const to = `${w}-${n}/${d}`; nt(`${s0} → ${to} (점을 대분수 구분으로 읽음)`, 'A-NORM', { from: s0, to }); return to;
  });
  const t = firstRule(U, TYPE_RULES);
  let type = t ? t.v : 'unknown';
  if (type === 'shcs' && /\bSCHS\b|\bSHSC\b/.test(U)) nt('SCHS → SHCS(렌치볼트) 오타로 읽음', 'A-NORM', { from: U.match(/\bSCHS\b|\bSHSC\b/)[0], to: 'SHCS' });
  if (type === 'bolt' && /육각|\bHEX\b|六角/.test(U)) type = 'hexbolt';
  if (type === 'capscrew') type = /\bSOC(?:KET)?\b|\bSKT\b/.test(U) ? 'shcs' : /\bHEX\b|육각/.test(U) ? 'hexbolt' : /\bFLAT\s*(?:HD|HEAD)\b/.test(U) ? 'fhcs' : /\bBUTTON\b/.test(U) ? 'bhcs' : type;
  if (type === 'hexbolt' && /\bH(?:VY|EAVY)\s*HEX\b/.test(U) && !/\bNUTS?\b/.test(U)) type = 'heavyhexbolt';
  if (type === 'nut' && /\bH(?:VY|EAVY)\b|헤비/.test(U)) type = 'heavynut';
  if (type === 'nut' && /\bA194\b|\b2HM?\b/.test(U)) { type = 'heavynut'; nt('A194 등급 너트 → 헤비 육각으로 봄 (플랜트 관례, 일반 육각이면 알려 주세요)', 'A-NUT-STYLE', { from: 'nut', to: 'heavynut' }); }
  // 변형품 (나비너트·플랜지 볼트·홈붙이 멈춤나사 등)
  let variant = null;
  for (const [k, re, types, vt, label, std, not, na] of VARIANT_RULES) {
    if ((!types || types.includes(type)) && re.test(U) && !(not && not.test(U))) { variant = { k, label, std, na: !!na, from: type }; if (vt) type = vt; break; }
  }
  // 체결부품이 아닌 줄
  let nonfast = null;
  if (!variant && (type === 'unknown' || (['bolt', 'screw', 'capscrew'].includes(type) && /\bNPTF?\b|\bBSP[PT]?\b/.test(U)))) {
    // 가장 앞에 나온 표현으로 정한다 (BALL VALVE … NPT → 밸브)
    const nf = firstRule(U, NONFAST_RULES.map(([k, re]) => [re, k])); if (nf) { nonfast = nf.v; type = nf.v; }
  }
  if (force.type && force.type !== type) { type = force.type; if (variant && force.type !== variant.from) variant = null; nonfast = null; }
  const c = { raw, U, partNo, type, typeRule: t ? t.n : 0, stds: stdTokens(U), special: SPEC_RULES.filter(([, re]) => re.test(U)).map(([k]) => k), system: 'unknown', size: null, pitch: null, tpi: null, series: null, tol: null, len: null, sub: {}, notes, ev, variant, nonfast };
  let R0 = U, tEnd = 0;
  const blank = (a, b) => { R0 = R0.slice(0, a) + ' '.repeat(Math.max(0, b - a)) + R0.slice(b); };
  const setInch = (it, L) => {
    Object.assign(c, { system: 'inch', size: { v: it.d, label: inFrac(it.d, true), unit: 'in', raw: it.dRaw }, tpi: it.tpi, series: it.series === 'UNR' ? 'UNC' : it.series === 'UN' && it.tpi === 8 ? '8UN' : it.series, tol: it.tol });
    if (it.num) nt(`${it.dRaw.slice(1)}-${it.tpi} → ${it.dRaw}-${it.tpi} 번호 호칭으로 읽음`, 'A-NORM', { from: `${it.dRaw.slice(1)}-${it.tpi}`, to: `${it.dRaw}-${it.tpi}` });
    if (it.seriesRaw && SERIES_FIX[it.seriesRaw]) nt(`${it.seriesRaw} → ${it.series}${/^N[CF]$/.test(it.seriesRaw) ? ' (구 American National 표기)' : ' 오타로 읽음'}`, 'A-NORM', { from: it.seriesRaw, to: it.series });
    if (L) { c.len = { in: L.v, raw: L.raw, ft: L.ft, mmStated: L.mm }; if (L.mm) nt(`길이 ${L.mm} mm → ${(L.v).toFixed(3)}" 로 환산`, 'A-LEN-CONV', { mm: L.mm, in: +L.v.toFixed(3) }); }
  };
  const mt = NO_THREAD.has(type) ? null : parseMetric(U), it = NO_THREAD.has(type) ? null : parseInch(U);
  const useM = mt && (!it || mt.start <= it.start);
  if (useM) {
    Object.assign(c, { system: 'metric', size: { v: mt.d, label: mt.size, unit: 'mm' }, pitch: mt.pitch, tol: mt.tol ? canonTol(mt.tol) : null });
    if (mt.len) c.len = { mm: mt.len.v, raw: mt.len.raw, byD: mt.len.byD };
    blank(mt.start, mt.end); tEnd = mt.end;
  } else if (it) {
    setInch(it, parseInchLen(U.slice(it.end)));
    blank(it.start, it.end); tEnd = it.end;
  } else if (!NO_THREAD.has(type) || ['rivet', 'pin', 'key', 'ring', 'oring', 'gasket', 'discspring'].includes(type)) {
    let m;
    if ((m = U.match(/\bAN\s*960[A-Z]*-?(\d{1,3})(L)?\b/))) {
      const k = m[1], d = k.length === 3 && k.endsWith('16') ? +k[0] / 16 : IN_NUM['#' + k];
      Object.assign(c, { system: 'inch', size: d ? { v: d, label: inFrac(d, true), unit: 'in', note: `AN960 대시 ${k}` } : null });
    } else if (type === 'clinch' && (m = U.match(/\b[A-Z]{1,4}-?(0?\d{3})-\d\b/))) {
      const P = { 440: ['#4', 40], 632: ['#6', 32], 832: ['#8', 32], '032': ['#10', 32], '024': ['#10', 24], '0420': ['1/4', 20], '0518': ['5/16', 18], '0616': ['3/8', 16] }[m[1]];
      if (P) { const d = IN_NUM[P[0]] ?? fracVal(P[0]); Object.assign(c, { system: 'inch', size: { v: d, label: P[0], unit: 'in' }, tpi: P[1], series: inferSeries(d, P[1]) }); }
    } else if (type === 'oring' && (m = U.match(/\bAS\s*568[A-Z]?-?(\d{3})/))) {
      Object.assign(c, { system: 'inch', size: { v: null, label: 'AS568-' + m[1], unit: 'in' } });
    } else if (type === 'gasket') {
      const n = U.match(/(?:NPS\s*)?(\d+(?:-\d\/\d)?|\d\/\d)\s*"|\bNPS\s*(\d+(?:-\d\/\d)?)/), cl = U.match(/\bCL(?:ASS)?\s*(\d{3,4})\b/);
      if (n) Object.assign(c, { system: 'inch', size: { v: null, label: `NPS ${n[1] || n[2]}${cl ? ', Class ' + cl[1] : ''}`, unit: 'in' } });
    } else if (type === 'key' && (m = U.match(/(?<![\w.])(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)/))) {
      Object.assign(c, { system: 'metric', size: { v: +m[1], label: `${m[1]} × ${m[2]} mm`, unit: 'mm' }, len: { mm: +m[3], raw: m[3] } });
    } else if ((type === 'rivet' || type === 'pin') && (m = U.match(/(?<![\w.])(\d+(?:\.\d+)?)\s*(?:[A-Z]\d{1,2}\s*)?X\s*(\d+(?:\.\d+)?)/))) {
      Object.assign(c, { system: 'metric', size: { v: +m[1], label: `${m[1]} mm`, unit: 'mm' }, len: { mm: +m[2], raw: m[2] } });
    } else if (type === 'ring' && (m = U.match(/Ø\s*(\d+(?:\.\d+)?)|\bDIN\s*47[12]\s+(\d+)\b/))) {
      Object.assign(c, { system: 'metric', size: { v: +(m[1] || m[2]), label: `축 지름 ${m[1] || m[2]} mm`, unit: 'mm' } });
    } else if (type === 'discspring' && (m = U.match(/\bDIN\s*2093\s*([ABC])\s*-?\s*(\d{2,3})\b|\b([ABC])\s*(\d{2,3})\b/))) {
      Object.assign(c, { system: 'metric', size: { v: +(m[2] || m[4]), label: `바깥지름 ${m[2] || m[4]} mm, 계열 ${m[1] || m[3]}`, unit: 'mm' } });
    } else if (!NO_THREAD.has(type) && !/\bNAS\s*\d|\bMS\s*\d{5}/.test(U) && (m = parseBareInch(U))) {
      Object.assign(c, { system: 'inch', size: { v: m.d, label: inFrac(m.d, true), unit: 'in', raw: m.dRaw } });
      if (m.series) { const r = unRow(m.d); c.series = m.series; c.tpi = m.series === '8UN' ? 8 : r ? (m.series === 'UNF' ? r[2] : r[1]) : null; c.tpiFromSeries = true; if (SERIES_FIX[m.seriesRaw]) nt(`${m.seriesRaw} → ${m.series}${/^N[CF]$/.test(m.seriesRaw) ? ' (구 American National 표기)' : ''}`, 'A-NORM', { from: m.seriesRaw, to: m.series }); }
      const L = parseInchLen(U.slice(m.end)); if (L) { c.len = { in: L.v, raw: L.raw, ft: L.ft, mmStated: L.mm }; if (L.mm) nt(`길이 ${L.mm} mm → ${L.v.toFixed(3)}" 로 환산`, 'A-LEN-CONV', { mm: L.mm, in: +L.v.toFixed(3) }); }
      blank(m.start, m.end); tEnd = m.end;
    }
  }
  // 사용자가 고친 호칭
  if (force.size) {
    const F = bomNorm(force.size), fm = /^M/.test(F) ? parseMetric(F) : null, fi = fm ? null : parseInch(F) || parseInch(F.replace(/^(\d{1,2})-/, '#$1-'));
    const fb = fm || fi ? null : parseBareInch(F) || (/^\d+(?:\.\d+)?$/.test(F) && c.system !== 'inch' ? parseMetric('M' + F) : null);
    const wasSys = c.system;
    if (fm || (fb && fb.size)) { const x = fm || fb; Object.assign(c, { system: 'metric', size: { v: x.d, label: x.size, unit: 'mm' }, pitch: x.pitch, tpi: null, series: null, tol: x.tol ? canonTol(x.tol) : null }); if (x.len) c.len = { mm: x.len.v, raw: x.len.raw }; }
    else if (fi) { const keep = c.len; setInch(fi, parseInchLen(F.slice(fi.end))); if (!c.len || c.len === keep) c.len = keep; }
    else if (fb) { Object.assign(c, { system: 'inch', size: { v: fb.d, label: inFrac(fb.d, true), unit: 'in' }, pitch: null, tpi: null, series: fb.series, tol: null }); if (fb.series) { const r = unRow(fb.d); c.tpi = fb.series === 'UNF' ? r?.[2] : r?.[1]; c.tpiFromSeries = true; } }
    // 단위계가 바뀌면 길이를 그 단위로 다시 본다 (원문 길이 숫자가 다른 단위로 읽혔을 수 있음)
    if (c.len && wasSys !== c.system && wasSys !== 'unknown') c.len = c.system === 'inch' ? (c.len.in != null ? c.len : { in: c.len.mm / 25.4, raw: c.len.raw }) : (c.len.mm != null ? c.len : { mm: c.len.in * 25.4, raw: c.len.raw });
  }
  // 나사 뒤에 떨어져 있는 길이 ('M16 STUD x 150', '육각볼트 M10 30L')
  if (!c.len && c.size && (NEEDS_LEN.has(type) || variant?.k === 'coupling')) {
    const L = looseLen(U.slice(tEnd), c.system === 'inch');
    if (L) { c.len = L.in != null ? { in: L.in, raw: L.raw, ft: L.ft, mmStated: L.mmStated } : { mm: L.mm, raw: L.raw }; if (L.mmStated) nt(`길이 ${L.mmStated} mm → ${L.in.toFixed(3)}" 로 환산`, 'A-LEN-CONV', { mm: L.mmStated, in: +L.in.toFixed(3) }); }
  }
  for (const s of c.stds) { const i = R0.indexOf(s.replace(/^(NAS|MS|AN)/, '$1')); if (i >= 0) blank(i, i + s.length); }
  R0 = R0.replace(/\b(?:ISO|DIN|KS\s*B|JIS\s*B)\s*\d+/g, ' ');
  if (c.system === 'unknown') {
    if (c.stds.some(s => /^(ISO|DIN|KS|JIS)/.test(s))) c.system = 'metric';
    else if (c.stds.some(s => /^(ASME|ASTM|NAS|MS|AN|AMS|AS568|SAE)/.test(s))) c.system = 'inch';
  }
  c.R0 = R0;
  c.mat = parseMat(U, R0, type, c.system);
  c.fin = parseFin(U);
  if (type === 'setscrew') { const p = PT_RULES.find(([, re]) => re.test(U)); c.point = variant?.k === 'softtip' ? 'soft tip' : p ? p[0] : null; }
  if (type === 'stud') c.sub = { nuts: /NUTS?\b|ナット|너트|\/\s*(?:A194\s*)?(?:2HM?|7M?L?|8M?)\b|\bA194\b|\b2HM?\b|個付/.test(U) ? 2 : 0, cont: c.special.includes('CONT'), tapEnd: c.special.includes('TAPEND') };
  if (type === 'anchor') { const h = U.match(/(\d+(?:-\d+\/\d+)?|\d+\/\d+)\s*"?\s*HOOK/); c.sub = { shape: /\bJ-?(?:TYPE|BOLT|BENT)\b/.test(U) ? 'J' : /\bL-?(?:TYPE|BENT)\b|HOOK/.test(U) ? 'L' : /HEADED|HEAVY\s*HEX\s*HEAD/.test(U) ? 'headed' : 'straight', hook: h ? fracVal(h[1]) : null, nut: /NUT/.test(U), washer: /WASHER|F436/.test(U) }; }
  if (type === 'washer') c.sub = { f436: /\bF436\b/.test(U) || /HARDENED/.test(U) && c.system === 'inch' };
  if (NUTS.has(type)) c.sub = { jam: c.special.includes('JAM'), nyloc: c.special.includes('NYLOC') };
  if (type === 'hexbolt' || type === 'heavyhexbolt') c.sub = { partial: /\bISO\s*4014\b|\bDIN\s*931\b|\bISO\s*8765\b|PARTIAL|반나사|HALF\s*THREAD/.test(U), full: /\bISO\s*4017\b|\bDIN\s*933\b|\bISO\s*8676\b|FULL\s*THREAD|온나사|全ねじ/.test(U) };
  c.noSpec = /\bNO\s*SPEC\b|사양\s*없음/.test(U) || (!!partNo && !c.size);
  c.pipeThread = /\bNPTF?\b|\bBSP[PT]?\b/.test(U);
  c.api610 = parseApi610(raw);   // 줄에 API 610 재질 클래스가 적혀 있으면 (없으면 null)
  return c;
}

// ISO 3506 강도 구분 기본값 (BOM·C&D 사양 12장 미결 12번 결정): 볼트·스터드·너트 70, 멈춤나사 21H. 원문에 없으면 가정으로 표시한다.
const SS_CLASS_DEFAULT = { setscrew: '21H', hexbolt: '70', heavyhexbolt: '70', shcs: '70', fhcs: '70', bhcs: '70', stud: '70', rod: '70', bolt: '70', capscrew: '70', nut: '70', heavynut: '70' };
// 기본값·파생값 채우기 (원문 값 c + 수정값 ov). ctx = { api610 } 견적 머리(RFQ)에서 읽은 문맥 (줄에 적힌 값이 우선)
function bomDerive(c0, ov = {}, ctx = {}) {
  const c = { ...c0, sub: { ...c0.sub }, special: [...c0.special] };
  const A = [], Q = [], conf = {}, E = (c0.ev || []).map(e => ({ ...e }));
  // 문자열과 이벤트를 같은 자리에서 함께 쌓는다
  const asm = (text, rule, p) => { A.push(text); bomEv(E, rule, p); }, ask = (text, rule, p) => { Q.push(text); bomEv(E, rule, p); };
  // 품목·호칭 수정(ov.type·ov.size)은 parseCore(text, force)에서 이미 반영했다
  if (ov.length != null && ov.length !== '') {
    // '120mm'·'4-3/4"'·'2 in'처럼 단위를 붙이면 그 단위로, 없으면 이 줄의 단위계로 읽는다
    const L = String(ov.length).trim().toUpperCase().replace(/\s+/g, ' '), mU = L.match(/^(.*?)\s*(MM|"|IN|INCH|M)$/), num = mU ? mU[1] : L, u = mU ? mU[2] : '';
    const inch = c.system === 'inch', v = /\//.test(num) || inch && !u ? fracVal(num.replace(/\s+(?=\d+\/)/, '-')) : parseFloat(num);
    if (isFinite(v) && v > 0) {
      if (inch) c.len = u === 'MM' ? { in: v / 25.4, raw: ov.length, mmStated: v } : u === 'M' ? { in: v * 1000 / 25.4, raw: ov.length, mmStated: v * 1000 } : { in: v, raw: ov.length };
      else c.len = u === '"' || u === 'IN' || u === 'INCH' ? { mm: v * 25.4, raw: ov.length, inStated: v } : u === 'M' ? { mm: v * 1000, raw: ov.length } : { mm: v, raw: ov.length };
    }
  }
  if (ov.mat) c.mat = { code: ov.mat, stated: true, edited: true, nut: c.mat?.nut };
  if (ov.fin) c.fin = { code: ov.fin, label: FIN_KO[ov.fin], stated: true, edited: true };
  if (ov.point) c.point = ov.point;
  const type = c.type, sys = c.system, inch = sys === 'inch';
  const q = { raw: c.raw, text: c.U, partNo: c.partNo, type, typeLabel: TYPE_KO[type] || type, sub: c.sub, system: sys, size: c.size, pitch: null, tpi: null, series: null, hand: c.special.includes('LH') ? 'LH' : 'RH', variant: c.variant, nonfast: c.nonfast, pipeThread: c.pipeThread,
    tolClass: null, tolLabel: '', lengthMm: null, lengthIn: null, lengthLabel: '', point: null, drive: null, dimStd: '', stds: c.stds, mat: null, fin: null, finDefault: false, special: c.special,
    noSpec: c.noSpec, assumptions: A, questions: Q, ev: E, conf, edited: Object.keys(ov).filter(k => ov[k] != null && ov[k] !== '') };
  conf.type = type === 'unknown' ? 0 : ['bolt', 'screw', 'capscrew'].includes(type) ? .55 : .95;
  for (const n of c.notes || []) A.push(n);   // 이벤트는 위에서 c0.ev로 옮겼다
  // 나사
  if (c.size && sys === 'metric' && THREADED.has(type)) {
    const coarse = mmPitch(c.size.label);
    q.pitch = c.pitch ?? coarse ?? null;
    q.series = q.pitch && coarse && Math.abs(q.pitch - coarse) > 1e-6 ? 'fine' : 'coarse';
    q.pitchLabel = q.pitch ? `${q.pitch} mm (${q.series === 'fine' ? '가는나사' : '보통나사'}${c.pitch == null ? ', 기본값' : ''})` : '';
    if (c.pitch == null && q.pitch) asm(`피치 미기재 → 보통나사 ${q.pitch} mm`, 'A-THD-PITCH', { size: c.size.label, pitch: q.pitch });
    conf.thread = c.pitch != null ? .95 : .75;
  } else if (c.size && inch && c.size.v && (THREADED.has(type) || type === 'expanchor')) {
    q.tpi = c.tpi; q.series = c.series;
    if (!q.tpi && THREADED.has(type)) { const r = unRow(c.size.v); if (r && (r[1] || (c.size.v > 1 && ['stud', 'heavynut'].includes(type)))) { const s8 = c.size.v > 1 && ['stud', 'heavynut'].includes(type); q.tpi = s8 ? 8 : r[1]; asm(`산 수 미기재 → ${q.tpi} TPI (${s8 ? '8UN' : 'UNC'}) 가정`, 'A-THD-TPI', { size: c.size.label, tpi: q.tpi, series: s8 ? '8UN' : 'UNC' }); ask('인치 나사 산 수(TPI)를 확인해 주세요.', 'A-THD-TPI', { size: c.size.label, tpi: q.tpi, series: s8 ? '8UN' : 'UNC' }); } }
    if (q.tpi && !q.series) q.series = inferSeries(c.size.v, q.tpi);
    q.pitchLabel = q.tpi ? `${q.tpi} TPI ${q.series || ''}`.trim() : '';
    if (c.tpiFromSeries && q.tpi) asm(`산 수 미기재 → ${q.series} 표준 ${q.tpi} TPI`, 'A-THD-TPI', { size: c.size.label, tpi: q.tpi, series: q.series });
    conf.thread = c.tpi && !c.tpiFromSeries ? .95 : q.tpi ? .7 : 0;
  }
  conf.size = c.size ? .95 : 0;
  // 길이
  if (c.len) {
    if (c.len.mm != null) { q.lengthMm = c.len.mm; q.lengthLabel = c.len.byD ? `${c.len.raw} (${c.len.mm} mm)` : `${c.len.mm.toLocaleString()} mm`; }
    else { q.lengthIn = c.len.in; q.lengthMm = c.len.mmStated ?? c.len.in * 25.4; q.lengthLabel = c.len.mmStated ? `${(+c.len.mmStated.toFixed(2)).toLocaleString()} mm (${c.len.in.toFixed(3)}")` : lenLabelIn(c.len.in, c.len.ft); }
    conf.length = .95;
  } else if (type === 'rod' && sys === 'metric') { q.lengthMm = 1000; q.lengthLabel = '1,000 mm (기본값)'; asm('길이 미기재 → 1 m 정척', 'A-LEN-ROD', { len: 1000 }); conf.length = .6; }
  if (type === 'stud' && q.lengthLabel) q.lengthLabel += c.sub.tapEnd ? ' (박는 쪽 bm 제외)' : c.sub.cont || sys === 'metric' ? ' (끝에서 끝)' : ' (포인트 포함 여부는 주문 때 확인)';
  if (type === 'fhcs' && q.lengthLabel) q.lengthLabel += ' (머리 포함 전장)';
  if (type === 'setscrew' && q.lengthLabel) q.lengthLabel += ' (전장)';
  if (type === 'stud' && inch && !c.sub.nuts && !c.sub.cont) ask('너트(A194 2H 헤비너트 2개) 포함 여부를 확인해 주세요. 지금은 스터드만으로 계산했습니다.', 'A-NUT-INCL');
  if (type === 'stud' && /スタッド|스터드/.test(c.raw) && inch) ask('스터드 길이에 양끝 포인트를 포함하는지 확인해 주세요.', 'S-STUD-LEN-GA');
  // API 610 재질 클래스 (줄에 적힌 것 우선, 없으면 견적 머리 문맥)
  // 머리 문맥은 머리 원문 + 이 줄 원문으로 다시 읽는다 (부위·사용 조건·적힌 등급은 줄마다 다르다)
  q.api610 = c.api610 || (ctx.api610 ? { ...(ctx.api610.raw ? parseApi610(`${ctx.api610.raw} | ${c.raw}`) || ctx.api610 : ctx.api610), from: 'header' } : null);
  // 재질
  q.mat = c.mat ? { ...c.mat } : null;
  const api = q.api610 && bomApi610Mat(q.api610, type, q.mat, c.sub);
  if (api) q.mat = api;   // 재질이 적혀 있지 않은 스터드·너트: API 610 클래스 값 (판이 없으면 가정으로 표시)
  if (q.mat && type === 'stud' && !q.mat.nut && c.sub.nuts) { q.mat.nut = NUT_FOR[q.mat.code] || null; q.mat.nutDefault = true; }
  if (q.mat) {
    q.mat.label = MAT_KO[q.mat.code] || q.mat.code;
    if (q.mat.code === 'F880' && q.mat.alloy === '316') q.mat.label = 'ASTM F880 준용 316 스테인리스';
    if (['F837', 'F879'].includes(q.mat.code) && q.mat.alloy === '316') q.mat.label += ' (316)';
    if (/^A[24]$/.test(q.mat.code) && q.mat.cls) q.mat.label = q.mat.label.replace(/ \(/, `-${q.mat.cls} (`);
    if (q.mat.code === '45H' && sys === 'metric' && /SCM/.test(c.U)) q.mat.label = 'SCM435 → 45H (ISO 898-5)';
    if (q.mat.code === 'B8M' && q.mat.cls2) q.mat.label = 'ASTM A193 B8M Class 2 (316 가공경화, 3/4" 이하 110 ksi)';
    if (type === 'stud' && c.sub.nuts && q.mat.nut) { const nl = MAT_KO[q.mat.nut] || 'A194 ' + q.mat.nut, [nb, nn] = nl.split(' — ');   // L7M-NUT: "… 또는 2HM — 주문 때 확인"
      q.mat.label += ` / ${nb} × 2${q.mat.nutDefault || nn ? ` (${[q.mat.nutDefault && '너트 등급 기본값', nn].filter(Boolean).join(' · ')})` : ''}`; }
    // ISO 3506 강도 구분이 없는 미터 스테인리스: 볼트·너트 70, 멈춤나사 21H를 기본값으로 쓰고 가정으로 남긴다
    if (sys === 'metric' && /^A[24]$/.test(q.mat.code) && !q.mat.cls && SS_CLASS_DEFAULT[type] && !q.variant) {
      q.mat.cls = SS_CLASS_DEFAULT[type]; q.mat.clsDefault = true;
      q.mat.label = q.mat.label.replace(/ \(/, `-${q.mat.cls} (`);
      asm(`강도 구분 미기재 → ${q.mat.code}-${q.mat.cls} (ISO 3506 기본값)`, 'A-SS-CLASS', { code: q.mat.code, cls: q.mat.cls });
    }
    if (q.mat.api610) asm(q.mat.api610Note, q.api610.edition ? 'S-API610-MAT' : 'S-API610-ED', { cls: q.api610.cls, edition: q.api610.edition, mat: q.mat.code, nut: q.mat.nut || null });
    else if (q.mat.def) asm(`재질 미기재 → ${q.mat.label}`, 'A-GRADE', { mat: q.mat.code });
    else if (q.mat.specDefault && !q.mat.stated) asm(`재질 규격 미기재 → ${q.mat.label}`, 'A-MATSPEC', { mat: q.mat.code });
    else if (q.mat.specDefault) asm(`재질 규격 번호 미기재 → ${q.mat.label}`, 'A-MATSPEC', { mat: q.mat.code });
    if (q.mat.nutDefault && c.sub.nuts && q.mat.nut && !q.mat.api610) asm(`너트 등급 미기재 → ${q.mat.nut === 'L7M-NUT' ? 'A194 7M(저온 충격시험) 또는 2HM — 주문 때 확인' : 'A194 ' + q.mat.nut}`, 'A-NUT-GRADE', { mat: q.mat.code, nut: q.mat.nut });
    conf.mat = q.mat.def ? .55 : q.mat.specDefault ? .75 : q.mat.api610 && !q.api610.edition ? .7 : .95;
  } else conf.mat = 0;
  const steelHard = q.mat && ['12.9', '10.9', '010.9', 'A574', 'F912', 'F835', '45H'].includes(q.mat.code);
  const stainless = q.mat && STAINLESS.has(q.mat.code);
  // 표면처리
  if (c.fin) { q.fin = { ...c.fin }; conf.fin = .95; }
  else if ((THREADED.has(type) && !['insert', 'clinch'].includes(type) || ['washer', 'lockwasher'].includes(type)) && !c.special.includes('AERO')) {
    const code = stainless ? 'PL' : (SOCKET.has(type) && (inch || steelHard) && !(type === 'setscrew' && !inch)) ? 'BO' : 'PL';
    const label = stainless ? '무처리 (패시베이션)' : code === 'BO' ? '흑착색 + 방청유 (소켓 제품 기본)' : type === 'setscrew' ? '무처리 + 방청유 (공급 상태)' : '무처리 (방청유)';
    q.fin = { code, label: label + ' · 기본값', stated: false }; q.finDefault = true; conf.fin = .6;
    asm(`표면처리 미기재 → ${label}`, 'A-FIN', { fin: code });
  }
  if (q.fin && c.special.includes('PATCH')) q.fin.label += ' + 나일론 패치';
  // 끝 형상
  if (type === 'setscrew') { q.point = c.point || 'cup'; if (!c.point) asm('끝 형상 미기재 → 컵 포인트', 'A-POINT', { point: 'cup' }); conf.point = c.point ? .95 : .6; }
  // 공차
  const hdg = q.fin && q.fin.code === 'HDG';
  const ext = !NUTS.has(type);
  const wrongSide = c.tol && THREADED.has(type) && (/^[123][AB]$/.test(c.tol) ? (ext ? /B$/.test(c.tol) : /A$/.test(c.tol)) : (ext ? /[GH]$/.test(c.tol) && /H/.test(c.tol) : /[eghf]$/.test(c.tol)));
  if (wrongSide) {
    const fix = /^[123][AB]$/.test(c.tol) ? c.tol[0] + (ext ? 'A' : 'B') : ext ? '6g' : '6H';
    q.tolClass = fix; q.tolLabel = `${fix} (기재 ${c.tol}는 ${ext ? '내나사(너트)' : '수나사(볼트)'} 등급 → 확인)`;
    ask(`${ext ? '수나사(볼트)' : '내나사(너트)'}에 ${ext ? '내나사' : '수나사'} 공차 등급 ${c.tol}가 적혀 있습니다. ${fix}로 봤습니다. 맞는지 확인해 주세요.`, 'A-TOL-WRONG', { stated: c.tol, to: fix });
  } else if (c.tol) { q.tolClass = c.tol; q.tolLabel = `${c.tol} (기재)`; }
  else if (THREADED.has(type) && !['insert', 'clinch'].includes(type) && c.size) {
    if (sys === 'metric') {
      if (NUTS.has(type)) q.tolClass = hdg ? '6AZ' : '6H';
      else q.tolClass = SOCKET.has(type) && type !== 'setscrew' && q.mat && q.mat.code === '12.9' ? '5g6g' : '6g';
      q.tolLabel = q.tolClass + (q.tolClass === '6AZ' ? ' (용융아연 후 오버탭, ISO 10684)' : hdg ? ' (도금 전 기준, 너트는 오버탭 6AZ)' : q.tolClass === '5g6g' ? ' (기본값, ISO 4762 12.9)' : ' (기본값)');
      bomEv(E, 'A-TOL-M', { tol: q.tolClass });
    } else if (inch) {
      if (NUTS.has(type)) q.tolClass = hdg ? 'OS' : '2B';
      else q.tolClass = SOCKET.has(type) ? (c.size.v > 1 ? '2A' : '3A') : '2A';
      q.tolLabel = q.tolClass === 'OS' ? '용융아연 후 오버탭 (ASTM A563)' : `${q.tolClass}${type === 'stud' && c.sub.nuts ? ' / 너트 2B' : ''} (${hdg && q.tolClass === '2A' ? '도금 전 기준, 짝 너트 오버탭' : SOCKET.has(type) ? '기본값, ASME B18.3' : '기본값, ASME B1.1'})`;
      if (SOCKET.has(type) && q.fin && ['ZN', 'YZ', 'ZNNI'].includes(q.fin.code)) q.tolLabel += ' · 3A는 도금 여유 없음';
      bomEv(E, 'A-TOL-IN', { tol: q.tolClass });
    }
  }
  if (c.tol && type === 'stud' && c.sub.nuts) q.tolLabel = `${c.tol} (기재) / 너트 2B`;
  // 길이 표기, 체결 공구, 치수 근거
  q.drive = driveOf(q);
  if (q.drive && q.drive.unit === 'in') { const lab = (q.drive.label.match(/([\d\-\/.]+)"/) || [])[1], nv = lab ? fracVal(lab) : NaN; if (isFinite(nv)) q.drive.label = q.drive.label.replace(/\([\d.]+ mm\)/, `(${(nv * 25.4).toFixed(2)} mm)`); }
  if (q.mat && q.mat.assumed) asm(`스테인리스 강종 미기재 → ${q.mat.code === 'A4' ? 'SUS316 (A4)' : 'SUS304 (A2)'}로 가정`, 'A-SS-ALLOY', { alloy: q.mat.code === 'A4' ? '316' : '304', code: q.mat.code });
  q.typeLabel = labelOf(q, c);
  q.dimStd = stdOf(q, c);
  // 질문
  if (q.variant && !q.variant.na) ask(`표준 카탈로그 품목이 아닌 ${q.variant.label}입니다. 치수·재질을 도면이나 제조사 품번으로 알려 주시면 정확히 수배합니다.`, 'A-VARIANT', { variant: q.variant.k, label: q.variant.label, std: q.variant.std });
  if (!c.size && THREADED.has(type) && !c.noSpec && !/\bNAS|\bMS\d|\bAN\d/.test(c.stds.join(' '))) ask('호칭(지름·나사)을 읽지 못했습니다. 지름과 피치(산 수)를 확인해 주세요.', 'N-UNREAD', { why: 'size' });
  if (c.size && !q.lengthLabel && ['setscrew', 'shcs', 'fhcs', 'bhcs', 'hexbolt', 'heavyhexbolt', 'stud', 'anchor', 'bolt', 'capscrew'].includes(type)) ask('길이가 없습니다. 길이와 길이 기준을 알려 주세요.', 'A-LEN-NONE');
  if (!q.mat && THREADED.has(type) && c.size) ask('재질·강도 등급을 확인해 주세요.', 'A-GRADE', { mat: null });
  // 얇은 너트 표기 (KS '3종'·얇은·박형): 일반 높이 너트로 바꾸지 않고 ISO 4035 얇은 너트로 견적
  if (NUTS.has(type) && sys === 'metric' && /3\s*[종種]|얇은|박형/.test(c.raw)) bomEv(E, 'S-KS-3JONG', { size: c.size?.label || null });
  else if (NUTS.has(type) && sys === 'metric' && (/[124]\s*[종種]/.test(c.raw) || c.stds.includes('KS B 1012'))) bomEv(E, 'S-KS-1JONG', { size: c.size?.label || null });
  if (q.api610) bomApi610Ev(q, E, ask, Q);
  return q;
}

function labelOf(q, c) {
  const t = q.type, inch = q.system === 'inch';
  if (q.variant) return q.variant.label;
  if (t === 'washer' && q.sub.f436) return '경화 평와셔 (ASTM F436)';
  if (t === 'hexbolt') return inch ? '육각 캡스크루' : q.sub.thread === 'partial' ? '육각볼트 (반나사)' : '육각볼트 (온나사)';
  if (t === 'stud') return q.sub.tapEnd ? '탭엔드 스터드' : (q.sub.cont ? '전산 스터드' : '스터드볼트') + (q.sub.nuts ? ' + 헤비너트 2개' : '');
  if (t === 'nut' && q.sub.jam) return inch ? '육각 잼너트' : '육각 얇은 너트 (잼)';
  if (t === 'nut' && q.sub.nyloc) return '나일론 인서트 너트';
  if (t === 'heavynut' && q.sub.jam) return '헤비 육각 잼너트';
  if (t === 'nut' && inch) return '육각너트 (완성품)';
  if (t === 'lockwasher' && inch) return '스프링 와셔 (Regular)';
  if (t === 'anchor') return `앵커볼트 (${{ L: 'L형', J: 'J형', headed: '헤드형', straight: '직선형' }[q.sub.shape] || '형상 미기재'})${q.sub.nut ? ' + 너트' : ''}${q.sub.washer ? '·와셔' : ''}`;
  return TYPE_KO[t] || t;
}
