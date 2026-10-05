
// ISO 7380-1 버튼머리 키 (ISO 7380-1:2022 Table 1 s 호칭과 대조: M3–M16 일치)
const BH_MM_KEY = { M3: 2, M4: 2.5, M5: 3, M6: 4, M8: 5, M10: 6, M12: 8, M16: 10 };
const DIN_REPL = { 'DIN 912': 'ISO 4762', 'DIN 913': 'ISO 4026', 'DIN 914': 'ISO 4027', 'DIN 915': 'ISO 4028', 'DIN 916': 'ISO 4029', 'DIN 933': 'ISO 4017', 'DIN 931': 'ISO 4014', 'DIN 934': 'ISO 4032', 'DIN 7991': 'ISO 10642', 'DIN 125': 'ISO 7089' };
// 인치 호칭 표기: 번호 호칭(#10)에는 인치 기호를 붙이지 않는다
const inLab = lab => /^#/.test(String(lab)) ? String(lab) : `${lab}"`;
function driveOf(q) {
  const s = q.size, t = q.type; if (!s || s.v == null) return null;
  if (q.variant) return q.variant.k === 'slotted' ? { kind: 'slot', v: null, unit: '', label: '일자 홈 (드라이버)' } : null;
  if (q.system === 'inch') {
    const d = s.v; let r;
    const sock = (v, lab) => ({ kind: 'socket', v, unit: 'in', label: `육각 구멍 · 키 ${lab}" (${(v * 25.4).toFixed(2)} mm)` });
    const hex = (v, lab, pre) => ({ kind: 'hex', v, unit: 'in', label: `${pre}2면폭 ${lab}" (${(v * 25.4).toFixed(1)} mm)` });
    if (t === 'setscrew') return (r = tbl(SS_IN, d) || tbl(SS_IN_MICRO, d)) && sock(r[1], r[2]);
    if (t === 'shcs') return (r = tbl(SHCS_IN, d)) && sock(r[3], r[4]);
    if (t === 'fhcs') return (r = tbl(FHCS_IN, d)) && sock(r[3], r[4]);
    if (t === 'bhcs') return (r = tbl(BHCS_IN, d)) && sock(r[3], r[4]);
    if (t === 'hexbolt') return (r = tbl(HCS_IN, d)) && hex(r[2], r[1], '육각 ');
    if (t === 'heavyhexbolt') return (r = tbl(HHB_IN, d)) && hex(r[2], r[1], '헤비 육각 ');
    if (t === 'nut') return (r = tbl(HN_IN, d)) && hex(r[2], r[1], '육각 ');
    // 헤비너트 2면폭은 RCSC 표 C-2.1 범위(1/2–1-1/2")만. 그 밖의 크기와 육각볼트·육각너트·헤비 육각볼트·1960 렌치볼트는 허용 출처가 없어 표가 비어 있다 (2026-10 감사)
    if (t === 'heavynut') return (r = hhnIn(d)) && hex(r[2], r[1], '헤비 육각 ');
    if ((t === 'stud' && q.sub.nuts) || (t === 'anchor' && q.sub.nut)) return (r = hhnIn(d)) ? { ...hex(r[2], r[1], '너트: 헤비 육각 '), nut: true } : null;
    return null;
  }
  const k = s.label, sock = v => v && { kind: 'socket', v, unit: 'mm', label: `육각 구멍 · 키 ${v} mm` };
  if (t === 'setscrew') return sock(SS_MM[k]?.[0]);
  if (t === 'shcs') return sock(mmGet('scsS', k));
  if (t === 'fhcs') return sock(DIM.cskS[k]);
  if (t === 'bhcs') return sock(BH_MM_KEY[k]);
  if (['hexbolt', 'heavyhexbolt', 'nut', 'heavynut'].includes(t)) { const v = mmGet('hexS', k); return v && { kind: 'hex', v, unit: 'mm', label: `2면폭 ${v} mm (ISO)${DIM.dinS[k] ? ` · DIN은 ${DIM.dinS[k]} mm` : ''}` }; }
  return null;
}
function stdOf(q, c) {
  const t = q.type, st = c.stds, inch = q.system === 'inch', k = q.size?.label;
  let prim = '';
  if (q.variant) {
    prim = q.variant.std;
    if (q.variant.k === 'slotted') prim = st.find(x => /^DIN (551|553|438)|^ISO (4766|7434|7435|7436)/.test(x)) || (q.system === 'inch' ? 'ASME B18.6.2 (일자 홈)' : 'ISO 4766 · DIN 551');
    const notes = st.filter(x => !prim.includes(x) && !/^(EN 10204|NACE|ASTM |ISO 898|ISO 3506|SAE|AMS)/.test(x)).map(x => `기재 ${x}`);
    return notes.length ? `${prim} (${notes.join(' · ')})` : prim;
  }
  if (inch) {
    if (SOCKET.has(t)) prim = 'ASME B18.3';
    else if (t === 'hexbolt') prim = /\bF467\b|W\/.*NUTS?/.test(c.U) ? 'ASME B18.2.1 / ASME B18.2.2' : 'ASME B18.2.1';
    else if (t === 'heavyhexbolt') prim = 'ASME B18.2.1 (헤비 육각)';
    else if (t === 'nut' || t === 'heavynut') prim = 'ASME B18.2.2';
    else if (t === 'stud') prim = q.sub.nuts ? 'ASME B18.31.2 / ASME B18.2.2' : 'ASME B18.31.2';
    else if (t === 'rod') prim = 'ASME B18.31.3';
    else if (t === 'anchor') prim = 'ASTM F1554 (형상은 도면 기준)';
    else if (t === 'washer') prim = q.sub.f436 ? 'ASTM F436' : st[0] && /^AN/.test(st[0]) ? st[0] : 'ASME B18.22.1';
    else if (t === 'lockwasher') prim = 'ASME B18.21.1';
  } else if (q.system === 'metric') {
    if (t === 'setscrew') prim = { cup: 'ISO 4029', flat: 'ISO 4026', cone: 'ISO 4027', dog: 'ISO 4028', 'knurled cup': 'ISO 4029', oval: 'ISO 4029', 'half dog': 'ISO 4028' }[q.point];
    else if (t === 'shcs') prim = q.series === 'fine' ? 'ISO 12474' : 'ISO 4762';
    else if (t === 'fhcs') prim = 'ISO 10642';
    else if (t === 'bhcs') prim = 'ISO 7380-1';
    else if (t === 'hexbolt' || t === 'heavyhexbolt') {
      let partial = c.sub.partial, full = c.sub.full;
      if (!partial && !full) {
        const f = METRIC.find(m => m.id === 'hbf'), maxF = f.sizes.includes(k) ? Math.max(...f.len(k)) : 150, L = q.lengthMm;
        if (L && L > maxF) partial = true;
        else if (L && ISO4014_MIN[k] && L >= ISO4014_MIN[k]) { q.questions.push('나사부 길이 표기가 없어 온나사(ISO 4017)로 봤습니다. 반나사(ISO 4014)가 필요하면 알려 주세요.'); bomEv(q.ev, 'A-HB-THREAD', { size: k, len: L }); }
      }
      q.sub.thread = partial ? 'partial' : 'full';
      prim = q.series === 'fine' ? (partial ? 'ISO 8765' : 'ISO 8676') : (partial ? 'ISO 4014' : 'ISO 4017');
    } else if (t === 'nut' || t === 'heavynut') prim = q.sub.nyloc ? 'ISO 7040' : q.sub.jam ? 'ISO 4035' : q.series === 'fine' ? 'ISO 8673' : 'ISO 4032';
    else if (t === 'washer') prim = 'ISO 7089';
    else if (t === 'lockwasher') prim = 'DIN 127 B';
    else if (t === 'rod') prim = 'DIN 976-1 A · DIN 975 (폐지)';
    else if (t === 'stud') prim = st.find(s => /^DIN (938|939|835|976)/.test(s)) || 'DIN 976-1';
  }
  if (!prim) prim = st.filter(s => !/^(EN 10204|NACE|AMS|ASTM)/.test(s))[0] || st[0] || '';
  const notes = [], E = q.ev;
  for (const s of st) {
    if (prim.includes(s) || /^(EN 10204|NACE|ASTM |ISO 898|ISO 3506|ISO 1068[34]|ISO 15156|SAE|AMS)/.test(s)) continue;
    if (DIN_REPL[s]) {
      notes.push(`${s} 대체`);
      // DIN 931·933·934는 M10·M12·M14·M22에서 2면폭이 ISO와 다르다 (S-DIN-WAF), 그 밖은 2면폭 같음 (A-DIN-ISO, ISO 272)
      if (q.system === 'metric' && /^DIN 93[134]$/.test(s) && DIM.dinS[k]) bomEv(E, 'S-DIN-WAF', { din: s, iso: DIN_REPL[s], size: k, wafDin: DIM.dinS[k], wafIso: DIM.hexS[k] });
      else bomEv(E, 'A-DIN-ISO', { din: s, iso: DIN_REPL[s], size: k || null, ...(s === 'DIN 7991' ? { head: 'differs' } : {}) });
    }
    else if (/^(KS|JIS)/.test(s)) notes.push(`= ${s}`);
    else notes.push(`기재 ${s}`);
  }
  if (q.system === 'metric' && /DIN 93[13]/.test(st.join()) && DIM.dinS[k]) notes.push(`${k} 2면폭 DIN ${DIM.dinS[k]} / ISO ${DIM.hexS[k]} mm`);
  if (st.includes('DIN 934') && DIM.nutM[k]) { notes.push(`높이 ISO ${DIM.nutM[k]} mm`); if (prim === 'ISO 4032') bomEv(E, 'S-DIN934-H', { size: k, m: DIM.nutM[k] }); }
  if (st.includes('JIS B 1256')) { notes.push('JIS 계열 미기재 → ISO 7089 제안'); bomEv(E, 'A-DIN-ISO', { din: 'JIS B 1256', iso: 'ISO 7089', size: k || null }); }
  if (q.hand === 'LH') notes.push('왼나사');
  return notes.length ? `${prim} (${notes.join(' · ')})` : prim;
}
function parseLine(text, qty) {
  const c = parseCore(text), q = bomDerive(c);
  q.qty = qty == null ? null : typeof qty === 'object' ? qty : parseQty(qty);
  return q;
}
const threadTxt = q => {
  if (!q.size) return '';
  if (q.system === 'metric') return q.size.label + (q.pitch ? '×' + q.pitch : '') + (q.tolClass && q.tolClass !== 'OS' ? '-' + q.tolClass : '') + (q.hand === 'LH' ? ' LH' : '');
  if (q.size.v == null) return q.size.label;
  return `${inLab(q.size.label)}${q.tpi ? `-${q.tpi} ${q.series || ''}${q.tolClass && /^[123][AB]$/.test(q.tolClass) ? '-' + q.tolClass : ''}` : ''}`.trim();
};
function specLine(q) {
  const parts = [q.typeLabel + (q.point ? `, ${PT_KO[q.point]}` : '')];
  if (q.dimStd) parts.push(q.dimStd.replace(/ \(.*$/, ''));
  const th = threadTxt(q); if (th) parts.push(th + (q.lengthLabel ? ` × ${q.system === 'inch' && q.lengthIn ? (q.lengthLabel.includes('ft') ? q.lengthLabel.split(' (')[0] : inFrac(q.lengthIn) + '"') : q.lengthMm + ' mm'}` : ''));
  if (q.mat) parts.push(q.mat.label.replace(/ \(너트 등급 기본값\)/, ''));
  if (q.fin) parts.push(q.fin.label.replace(/ · 기본값$/, ''));
  const sp = q.special.filter(k => ['NACE', 'IMPACT', 'CERT', 'PMI', 'PATCH', 'DRILLED', 'BAKE'].includes(k)).map(k => SPEC_KO[k]);
  if (sp.length) parts.push(sp.join(', '));
  return parts.join(' / ');
}

/* ── 카탈로그 매칭: bomMatch(q) ── */
const ST_GRADES = new Set(['A2', 'A4', 'NA2', 'NA4', 'WA2', 'WA4', 'SA2', 'SSA2', 'SSA4', 'F880', 'F880M', 'F837', 'F837M', 'F879', 'F879M', 'F5931', 'F5932', 'F5941', 'F5942', 'LW188']);
function famFor(q) {
  const t = q.type;
  if (q.variant) return null;
  if (q.system === 'metric') {
    if (t === 'setscrew') return BOM_FAMS.find(f => !f.inch && f.point === (q.point === 'knurled cup' ? 'cup' : q.point === 'half dog' ? 'dog' : q.point));
    const id = { shcs: 'scs', fhcs: 'csk', nut: 'hn', washer: 'pw', lockwasher: 'sw', rod: 'tr' }[t] || (t === 'hexbolt' ? (q.sub.thread === 'partial' ? 'hbp' : 'hbf') : null);
    return id ? METRIC.find(m => m.id === id) : null;
  }
  if (q.system !== 'inch') return null;
  if (t === 'setscrew') return BOM_FAMS.find(f => f.inch && f.point === (q.point === 'knurled cup' ? 'cup' : q.point));
  const id = { shcs: 'ishc', fhcs: 'ifhc', bhcs: 'ibhc', hexbolt: 'ihcs', nut: 'ihn', heavynut: 'ihhn', stud: 'istd', lockwasher: 'ilw' }[t] || (t === 'washer' && q.sub.f436 ? 'ifw' : null);
  return id ? BOM_FAMS.find(f => f.id === id) : null;
}
function gradeFor(q, f) {
  const mc = q.mat?.code, al = q.mat?.alloy === '316';
  if (!mc) return null;
  if (!f.inch) {
    if (f.type === 'setscrew') return { '45H': 'S45H', A2: 'SSA2', A4: 'SSA4' }[mc] || null;
    const bolt = { '4.8': '48', '8.8': '88', '10.9': '109', A2: 'A2', A4: 'A4' };
    return ({ hbf: bolt, hbp: bolt, tr: bolt, scs: { '12.9': '129', '10.9': '109', A2: 'A2', A4: 'A4' }, csk: { '010.9': '0109', '10.9': '0109', A2: 'A2' }, hn: { N8: 'N8', N10: 'N10', A2: 'NA2', A4: 'NA4' },
      pw: { '200HV': 'H200', '300HV': 'H300', A2: 'WA2', A4: 'WA4' }, sw: { SPR: 'SPR', A2: 'SA2' } }[f.id] || {})[mc] || null;
  }
  if (f.type === 'setscrew') return { F912: 'F912', F880: al ? 'F880M' : 'F880' }[mc] || null;
  return ({ ishc: { A574: 'A574', F837: al ? 'F837M' : 'F837' }, ifhc: { F835: 'F835', F879: al ? 'F879M' : 'F879' }, ibhc: { F835: 'F835', F879: al ? 'F879M' : 'F879' },
    ihcs: { 'J429-5': 'J5', 'J429-8': 'J8', 'F593-1': 'F5931', 'F593-2': 'F5932' }, ihn: { 'J995-5': 'J995G5', 'J995-8': 'J995G8', 'A563-A': 'A563A', 'F594-1': 'F5941', 'F594-2': 'F5942' },
    ihhn: { '2H': 'A1942H', 'A563-DH': 'A563DH' }, istd: { B7: (q.mat.nut || '2H') === '2H' ? (q.sub.nuts ? 'B72H' : 'B7S') : null }, ifw: { 'F436-1': 'F436' }, ilw: { '18-8': 'LW188', SPR: 'LWCS' } }[f.id] || {})[mc] || null;
}
function finFor(q, f, g) {
  const c = q.fin?.code; if (!c) return null;
  const st = ST_GRADES.has(g);
  if (!f.inch) return { BO: 'BO', ZN: 'ZW', ZB: 'ZB', HDG: 'HD', ZF: 'GM', PL: st ? 'PA' : 'PL' }[c] || null;
  return { BO: 'BO', ZN: 'ZW', YZ: 'ZY', HDG: 'HI', PL: st ? 'PA' : 'PO' }[c] || null;
}
function sizeCodeFor(q, f) {
  if (!f.inch) return q.size.label;
  const s = q.type === 'washer' ? 'W' : q.type === 'lockwasher' ? 'R' : q.series === 'UNF' ? 'UNF' : (q.series === '8UN' || (q.series === 'UN' && q.tpi === 8)) ? '8UN' : 'UNC';
  return szIn(q.size.v, s);
}
const sizeTxt = (f, sz) => f.inch ? `${inLab(inFrac(dIn(sz), true))} ${({ C: 'UNC', F: 'UNF', U: '8UN' })[sz.slice(-1)] || ''}`.trim() : sz;
const lenTxt = (f, L) => L == null ? '' : f.inch ? `${inFrac(L / 1000)}"${/\./.test(inFrac(L / 1000)) ? ` (${(L / 1000 * 25.4).toFixed(1)} mm)` : ''}` : `${L} mm`;
// 기본 장(2장)과 같은 조합만: 용융아연도금은 M8 이상 (base combosFor, ISO 10684). 인치·BOM 품목군은 그대로
const cbOf = (f, sz) => !f.inch && typeof combosFor === 'function' ? combosFor(f, sz) : f.combos;
function catalogLookup(q) {
  const f = famFor(q); if (!f || !q.size || q.size.v == null) return null;
  const sz = sizeCodeFor(q, f), g = gradeFor(q, f), fin = g ? finFor(q, f, g) : null, cb = cbOf(f, sz);
  const L = f.len ? (f.inch ? (q.lengthIn != null ? Math.round(q.lengthIn * 1000) : null) : q.lengthMm) : null;
  const sizeOk = f.sizes.includes(sz), lens = f.len && sizeOk ? f.len(sz) : [];
  const lenOk = !f.len || lens.includes(L);
  const gOk = !!g && cb.some(c => c[0] === g) && !(f.gmax?.[g] && q.size.v > f.gmax[g] + 1e-6);
  let fin2 = fin, subst = null;
  const addonFin = q.fin && (['PTFE', 'ZNNI', 'PH'].includes(q.fin.code) || (['ZN', 'YZ', 'ZB'].includes(q.fin.code) && SOCKET.has(q.type) && q.type !== 'setscrew' && ['A574', 'F835', '12.9', '10.9', '010.9'].includes(q.mat?.code)));
  if (gOk && !cb.some(c => c[0] === g && c[1] === fin) && (q.finDefault || addonFin)) {
    const cc = cb.filter(c => c[0] === g).sort((a, b) => b[2] - a[2])[0];
    if (cc) { fin2 = cc[1]; subst = addonFin ? null : `표면처리 미기재 → ${FINISH[fin2].label} (카탈로그 기본)`; }
  }
  const comboOk = gOk && cb.some(c => c[0] === g && c[1] === fin2);
  if (sizeOk && lenOk && comboOk) return { f, sz, L, g, fin: fin2, exact: true, sizeOk, diffs: subst ? [subst] : [] };
  // 가장 가까운 카탈로그 품목과 차이 (호칭·계열이 다르면 대안을 만들지 않는다)
  const diffs = [];
  let sz2 = sz;
  if (!sizeOk) {
    const same = f.sizes.filter(x => !f.inch || x.slice(-1) === sz.slice(-1)), pool = same.length ? same : f.sizes;
    sz2 = pool.reduce((a, x) => Math.abs((f.inch ? dIn(x) : dnum(x)) - q.size.v) < Math.abs((f.inch ? dIn(a) : dnum(a)) - q.size.v) ? x : a, pool[0]);
    diffs.push(f.inch && (same.length === 0 || near(dIn(sz2), q.size.v)) ? `${inLab(q.size.label)} ${q.series || ''} 계열은 카탈로그 밖 (산 수가 다르면 맞지 않음)` : `호칭 ${f.inch ? inLab(q.size.label) : q.size.label}: 카탈로그 범위(${sizeTxt(f, f.sizes[0])}–${sizeTxt(f, f.sizes[f.sizes.length - 1])}) 밖`);
  }
  let L2 = L;
  if (f.len) {
    const ls = f.len(sz2);
    if (!ls.includes(L)) {
      if (L == null) { L2 = ls[Math.floor(ls.length / 3)]; diffs.push('길이 미기재'); }
      else {
        const lo = [...ls].filter(x => x < L).pop(), hi = ls.find(x => x > L);
        L2 = lo != null && (hi == null || L - lo <= hi - L) ? lo : hi;
        if (sizeOk) diffs.push(`길이 ${lenTxt(f, L)}는 ${L < ls[0] || L > ls[ls.length - 1] ? '카탈로그 길이 범위 밖' : '비표준'} → 표준 ${[lo, hi].filter(x => x != null).map(x => lenTxt(f, x)).join(' 또는 ')}`);
      }
    }
  }
  const cb2 = cbOf(f, sz2);
  let g2 = gOk && cb2.some(c => c[0] === g) ? g : null, fin3 = fin2, gradeDiff = false, finDiff = false;
  if (!g2) { gradeDiff = true; g2 = cb2[0][0]; if (sizeOk) diffs.push(`재질·등급 ${q.mat ? q.mat.label : '미기재'}은(는) 카탈로그 등급(${[...new Set(cb2.map(c => GRADE[c[0]].label))].join(', ')})에 없음`); }
  if (!cb2.some(c => c[0] === g2 && c[1] === fin3)) {
    const cc = cb2.filter(c => c[0] === g2).sort((a, b) => b[2] - a[2])[0]; fin3 = cc[1]; finDiff = true;
    if (q.fin && sizeOk && !gradeDiff) diffs.push(`${GRADE[g2].label}의 표면처리 ${q.fin.label.replace(/ · 기본값$/, '')}: 카탈로그 밖 (카탈로그: ${cb2.filter(c => c[0] === g2).map(c => FINISH[c[1]].label).join(', ')})`);
  }
  return { f, sz: sz2, L: L2, g: g2, fin: fin3, exact: false, sizeOk, gradeDiff, finDiff, diffs };
}
const viOf = (f, sz, L, g, fin, qty) => f.vi ? f.vi(sz, L, g, fin, qty) : variantInfo(f, sz, L, g, fin, qty);
const wtOf = (f, sz, L) => f.wt ? f.wt(sz, L) : weightG(f, sz, L);
