/* ── 데이터시트 A4 (cad/src/t_datasheet.js) ──
   고른 형번 한 장(세로 A4)과 품목군 규격표(가로 A4). 도면 한 장 양식: 위쪽 표제란 · 규격 표기 · 대조 · 그림 · A 치수 · B 사양 · C 서류 · D CAD · E 주기 · 출처·개정.
   - 값은 모두 페이지 데이터: 사양(cadSpec)·CAD_CAT·DIM·GRADE·FINISH·weightG. 가격은 없다. 출처는 규격 이름과 판만 (판매처·사이트 이름 없음).
   - 그림 = CAD 파일과 같은 뷰·치수(SVG). 척도 없음 (NTS).
   - C 서류는 trust 모듈(t_trust.js)의 플래그에서만 나온다 (기본 '공급처 확인 중'). PMI 줄은 PMI 플래그가 켜졌을 때만.
   - 공개 사이트: 인쇄 전용 칸에 그리고 print() (document.title = BN_…_DS → 'PDF로 저장' 파일 이름). 틀 안(미러): 스크립트 없는 HTML 파일로 받는다.
   레이아웃·CSS는 cad/trust.md §5 (trust_proto/ds.css)를 그대로 옮기고 그림(.cadv)·규격표 규칙만 더했다. */
const CAD_DS_DISCLAIM = '실제 납품품은 규격 공차 범위 안에서 이 데이터시트·모델과 다를 수 있습니다. 최종 사양은 견적서·주문 확인서 기준입니다. 이 데이터시트에는 가격이 없습니다.';
const cadDsYmd = () => { const k = cadKst(); return `${k.y}-${cadP2(k.mo)}-${cadP2(k.d)}`; };
const cadDsCssStr = t => '"' + String(t).replace(/[\\"]/g, '\\$&').replace(/\n/g, ' ') + '"';

// 치수표 행: catalog 열 x · x_min · x_max를 한 행으로 (계산용 열 제외). fmt = 값 표기 (인치는 분수 + [mm])
function cadDsDimRows(cols, row, fmt, skip = []) {
  const by = new Map();
  cols.forEach(([key, ko]) => {
    if (skip.includes(key)) return;
    const m = key.match(/^(.*?)(?:_(min|max))?$/), base = m[1], side = m[2] || 'nom';
    if (!by.has(base)) by.set(base, { sym: base.replace(/_.*$/, ''), name: '', nom: null, min: null, max: null, unv: false });
    const r = by.get(base);
    const nm = ko.replace(/\s*\((?:호칭|호칭=최대|기본|최대|최소|최대 = d|참고|이론 최대|최소)\)|\s*최소$|\s*최대$/g, '').trim();
    if (!r.name || side === 'nom') r.name = nm;
    if (row[key] != null) r[side] = fmt(row[key], key);
    if ((row.u || []).includes(key)) r.unv = true;
  });
  return [...by.values()].filter(r => r.nom != null || r.min != null || r.max != null);
}
const cadDsMm = v => typeof v === 'number' ? String(+v.toFixed(3)) : String(v);
const cadDsIn = v => typeof v === 'number' ? cadIn(v) : /^\d/.test(v) ? cadIn(cadFracVal(v)) : String(v);

// 사양 → 데이터시트 기록 (trust.md §5.3 모양)
function cadDsRec(spec, built) {
  const f = spec.f, e = cadE, ymd = cadDsYmd(), main = spec.parts[0], p = main.part.p, inch = spec.sys === 'i';
  const groups = [], spr = [];
  let eq = [], mass = '', supply = '';
  if (!inch) {
    const size = spec.size, d = dnum(size), P = DIM.pitch[size];
    const base = [{ sym: 'd', name: '나사 호칭 지름', nom: size }, ...(f.kind === 'washer' ? [] : [{ sym: 'P', name: '피치 (보통나사)', nom: cadDsMm(P) }])];
    if (f.len) base.push({ sym: 'L', name: f.id === 'csk' ? '호칭 길이 (머리 포함 전장)' : '호칭 길이 (머리 밑부터)', nom: String(spec.L) });
    if (f.kind === 'rod') base.push({ sym: 'L', name: '길이 (정척)', nom: '1000' });
    if (p.b) base.push({ sym: 'b', name: '나사부 길이 (참고)', nom: cadDsMm(p.b) });
    let rows = [];
    if (spec.rowTk && CAD_CAT.t[spec.rowTk]) rows = cadDsDimRows(CAD_CAT.t[spec.rowTk].cols, cadRow(spec.rowTk, size), cadDsMm, ['b_le125', 'b_125_200', 'b_gt200', 'b_ref', 'fullThreadToL', 'fullThreadToL_2004', 'As']);
    else if (f.id === 'pw') rows = [{ sym: 'd1', name: '안지름', nom: cadDsMm(DIM.pwD1[size]) }, { sym: 'd2', name: '바깥지름', nom: cadDsMm(DIM.pwD2[size]) }, { sym: 'h', name: '두께', nom: cadDsMm(DIM.pwH[size]) }];
    else if (f.id === 'sw') rows = [{ sym: 'd1', name: '안지름', nom: cadDsMm(DIM.swD1[size]) }, { sym: 'd2', name: '바깥지름', nom: cadDsMm(DIM.swD2[size]) }, { sym: 's', name: '두께 (단면)', nom: cadDsMm(DIM.swS[size]) }];
    if (spec.rowTk === 'csk') rows = rows.filter(r => r.sym !== 'k').concat([{ sym: 'k', name: '머리 높이 (이론, (dk − d)/2)', nom: cadDsMm((DIM.cskDk[size] - d) / 2) }]);
    groups.push({ name: '', rows: [...base, ...rows] });
    const din = DIM.dinS && DIM.dinS[size], hexy = ['hbf', 'hbp', 'hn'].includes(f.id);
    eq = [['ISO', f.std.ISO], ['KS', f.std.KS], ['DIN', f.std.DIN, hexy && din ? `${size} 2면폭 ${din} (ISO ${DIM.hexS[size]}) — 다름` : ''], ['JIS', f.std.JIS]];
    const w = weightG(f, size, spec.L);
    mass = `${w < 10 ? w.toFixed(2) : w.toFixed(1)} g/개 · ${w < 10 ? w.toFixed(2) : w.toFixed(1)} kg/1000개 <span class="ds-sub">계산값 (근사) · 사이트 표시값과 같은 식 · 강재 7.85 g/cm³ 기준</span>`;
    supply = `포장 ${packOf(f, size)}${f.kind === 'rod' ? '본' : '개'} 단위 (예시) · 출고일은 주문 시 사이트·견적서 표시 기준`;
    const G = GRADE[spec.g] || {}, F = FINISH[spec.fin] || {};
    spr.push(['나사', `${e(spec.thread.replace('x', ' × '))} (ISO 965-1)${p.b ? ` · 나사부 b ${e(cadDsMm(p.b))} (참고)` : f.kind === 'bolt' ? ' · 온나사' : ''}`],
      ['강도 · 재질', `<b>${e(G.label || spec.g)}</b> — ${e(G.desc || '')} (계열) · 기계적 성질은 ${e(G.std || '')} 참조`],
      ['표면처리', `${e(F.label || spec.fin)} — ${e(F.note || '')} · 두께·등급은 견적 시 확인`]);
  } else {
    const dIn = spec.parts[0].part.p.d / 25.4, r = spec.rows || {};
    const fmtRows = (tk, row, skip) => cadDsDimRows(CAD_CAT.t[tk].cols, row, cadDsIn, skip || []);
    if (spec.parts.some(x => x.key === 'stud')) {
      groups.push({ name: '스터드 (ASME B18.31.2 · B16.5 길이)', rows: [{ sym: 'd', name: '호칭 지름', nom: cadIn(dIn) }, { sym: 'n', name: '인치당 산 수', nom: String(Math.round(25.4 / p.P * 100) / 100) },
        { sym: 'L', name: '길이 (포인트 포함 여부는 주문 때 확인)', nom: cadIn(spec.Lin) }, { sym: 'pt', name: '포인트 (1–2산, 모델은 1.5산)', nom: cadIn(1.5 * p.P / 25.4) }] });
    } else if (spec.parts.some(x => x.key === 'rod')) {
      groups.push({ name: '', rows: [{ sym: 'd', name: '호칭 지름', nom: cadIn(dIn) }, { sym: 'n', name: '인치당 산 수', nom: String(Math.round(25.4 / p.P * 100) / 100) }, { sym: 'L', name: '전장', nom: cadIn(spec.Lin) }, { sym: 'b', name: '나사부 길이', nom: '도면 지정' }] });
    } else if (r.bolt) {
      const tk = f.id === 'a325' ? 'sb' : f.id === 'a354' ? 'hb' : ['a574', 'f837'].includes(f.id) ? 'shcs' : 'hcs';
      groups.push({ name: spec.parts.length > 1 ? '볼트' : '', rows: [{ sym: 'd', name: '호칭 지름', nom: cadIn(dIn) }, { sym: 'L', name: '길이 (머리 밑부터)', nom: cadIn(spec.Lin) }, ...fmtRows(tk, r.bolt, ['As_UNC', 'As_UNF', 'J', ...(spec.parts.length > 1 ? ['E_max', 'E_min', 'J_min', 'dw_min', 'dw_max'] : [])])] });
    }
    if (r.nut) groups.push({ name: f.id === 'hh' ? '' : '헤비 육각너트 (ASME B18.2.2 Table 10)', rows: [...(f.id === 'hh' ? [{ sym: 'D', name: '호칭 지름', nom: cadIn(dIn) }] : []), ...fmtRows('hhn', r.nut)] });
    if (r.washer) groups.push({ name: '경화 와셔 (ASTM F436 Table 2)', rows: [{ sym: 'OD', name: '바깥지름', nom: cadIn(r.washer[1]) }, { sym: 'ID', name: '안지름', nom: cadIn(r.washer[2]) }, { sym: 'T', name: '두께', min: cadIn(r.washer[3]), max: cadIn(r.washer[4]) }] });
    eq = (f.std || []).slice(0, 4).map((s, i) => [i === 0 ? '기준' : '관련', s]);
    // 질량: catalog massG (head + perInShank·L, 너트 개당). 없으면 같은 식으로 계산
    const mk = tk => { const t = CAD_CAT.t[tk]; return t ? Object.keys(t.rows).find(s => Math.abs(t.rows[s].d - dIn) < 1e-4) : null; };
    const MI = CAD_CAT.inMass || {}, nutG = (MI.hhn || {})[mk('hhn')] || null, Lin = spec.Lin;
    let g = null, parts = '';
    if (spec.parts.some(x => x.key === 'stud')) { const sm = (CAD_CAT.studMass || {})[mk('hhn')] || (CAD_CAT.studMass || {})[spec.size]; if (sm) { const st = sm[0] * Lin; g = st + 2 * (nutG || sm[1]); parts = `스터드 ${st.toFixed(0)} + 너트 ${(nutG || sm[1]).toFixed(0)} × 2`; } }
    else if (f.id === 'hh') g = nutG;
    else if (spec.parts.some(x => x.key === 'rod')) g = Math.PI / 4 * p.d * p.d * p.L * 7.85e-3;
    else { const tk = f.id === 'a325' ? 'sb' : f.id === 'a354' ? 'hb' : f.id === 'f837' ? 'shcs837' : f.id === 'a574' ? 'shcs' : 'hcs', key = (() => { const t = CAD_CAT.t[tk]; return t ? Object.keys(t.rows).find(s => Math.abs(t.rows[s].d - dIn) < 1e-4) : null; })(), mm = (MI[tk] || {})[key] || ((MI.shcs || {})[mk('shcs')] && tk === 'shcs837' ? MI.shcs[mk('shcs')] : null);
      if (mm) { g = mm[0] + mm[1] * Lin; if (f.id === 'a325' && nutG && r.washer) { const wg = Math.PI / 4 * ((r.washer[1] * 25.4) ** 2 - (r.washer[2] * 25.4) ** 2) * ((r.washer[3] + r.washer[4]) / 2 * 25.4) * 7.85e-3; parts = `볼트 ${g.toFixed(0)} + 너트 ${nutG.toFixed(0)} + 와셔 ${wg.toFixed(0)}`; g += nutG + wg; } } }
    mass = g ? `${g < 10 ? g.toFixed(2) : g.toFixed(0)} g/${parts ? '세트' : '개'}${parts ? ` (${parts} g)` : ''} <span class="ds-sub">계산값 (근사) · 강재 7.85 g/cm³ 기준${/b8|smo|f468|f593|f837|a453|b8lt/.test(f.id) ? ' (스테인리스·니켈합금은 재질 밀도에 따라 다름)' : ''}</span>` : '<span class="ds-sub">계산 자료 없음 — 견적 시 회신</span>';
    supply = `${e(f.lead || '')} · ${e(typeof LEAD_TIER !== 'undefined' && LEAD_TIER[f.lead] || '')} · 견적 후 판매 (형번은 견적서에서 확정)`;
    const LT = r.bolt ? (r.bolt.LT || (spec.Lin <= 6 ? r.bolt.LT_le6 : r.bolt.LT_gt6) || r.bolt.LT_min) : null;
    spr.push(['나사', `${e(spec.thread)} (ASME B1.1)${spec.parts.some(x => x.key === 'nut') ? ` · 너트 ${e(spec.threadNut)}` : ''}${LT ? ` · 나사부 LT ${e(cadIn(LT))}` : ''}`],
      ['강도 · 재질', spec.grade ? `<b>${e(spec.grade)}</b> — 성질은 ${e((f.std || [])[0] || '')} 참조` : `${e((f.std || [])[0] || '')} 참조`],
      ['표면처리', spec.fin ? `${e(spec.fin)} — 두께·등급은 견적 시 확인` : '견적 시 확인']);
  }
  spr.push(['질량', mass], ['포장 · 공급', supply]);
  const docs = typeof cadTrustDsDocsHtml === 'function'
    ? cadTrustDsDocsHtml({ fam: f.id, grade: inch ? spec.grade : spec.g, fin: spec.fin }, ymd)
    : `<p>제조사 MTR(EN 10204 3.1) 제공 여부: 공급처 확인 중 — 견적 시 회신</p><p class="cad-ds-foot">볼트노트 CoC(ISO 16228 F2.1 형식) 기본 · EN 10204 3.2·KOLAS 시험은 요청 시 협의 · 볼트노트는 3.1을 직접 발행하지 않습니다</p>`;
  // 세트(부품 여럿)는 오른쪽 칸을 부품 이름만 두어 파일 이름이 한 줄에 들어가게 하고, 형식은 zip 줄에 한 번 적는다
  const many = spec.parts.length > 1;
  const files = [...spec.parts.map(x => [`${x.stem}.step · .dxf`, many ? (x.label || '').replace(/ \(.*\)$/, '') : 'STEP AP214 · DXF R12 · mm']), [`${spec.stem}_README.txt`, '한국어·English'], [`${spec.stem}.zip`, many ? '위 파일 전부 · STEP AP214 · DXF R12 · mm' : '위 파일 전부']];
  const notes = ((CAD_CAT.notes || {})[f.id] || []).slice(0, spec.parts.length > 1 ? 1 : 2);
  const multi = spec.parts.length > 1 ? ` · 그림은 ${spec.parts[0].label || '주 부품'}` : '';
  return {
    title: { ko: spec.nameKo, en: spec.nameEn, pn: spec.pn, stem: spec.stem, std: inch ? `${spec.std} · ${spec.thread}${spec.Lin ? ' × ' + cadIn(spec.Lin, false) : ''}` : `${spec.std} · ${spec.size}${f.len ? ' × ' + spec.L : ''} · ${spec.gradeLabel} · ${spec.finLabel}`,
      rev: CAD_REV.rev, date: ymd, units: inch ? 'in [mm]' : 'mm' },
    desig: { en: spec.desigEn, ko: spec.desigKo },
    eq, drawSvg: CAD_G.toSvg(cadDispPart(main.part), { esc: cadE, label: `${spec.stem} 정면도·평면도` }), drawNote: `CAD와 같은 뷰 (3각법 · 축 가로로 표시)${multi}`,
    dims: { groups, caption: `단위 ${inch ? 'in [mm]' : 'mm'} · ${spec.src.join(' · ')} · 호칭값, 한 값만 있는 항목은 그 한계값` },
    spec: spr, docsHtml: docs,
    cad: { files, spec: `단위 mm${inch ? ' (인치 값 × 25.4)' : ''} · ${cadOriginTxt(spec, 'ko')}`, order: spec.quote ? '견적 품목: 형상 참고용 파일이며 형번은 견적서에서 확정됩니다.' : '사이트 검색창에 형번을 넣으면 이 품목으로 갑니다. BOM에는 파일 이름의 형번(BN_ 뒤)을 그대로 쓰세요.' },
    notes, sources: spec.src, gen: CAD_VER, rev: [[CAD_REV.rev, CAD_REV.date, CAD_REV.log]],
  };
}

function cadDsHtml(rec) {
  const e = cadE, tb = rec.title;
  const eq = (rec.eq || []).map(([k, v, diff]) => `<div><span class="ds-lab">${e(k)}</span><b class="${diff ? 'redp' : ''}">${e(v)}</b>${diff ? `<span class="ds-sub redp">${e(diff)}</span>` : ''}</div>`).join('');
  const dim = rec.dims.groups.map(g => (g.name ? `<tr class="ds-grp"><th colspan="5" scope="rowgroup">${e(g.name)}</th></tr>` : '') + g.rows.map(r =>
    `<tr${r.unv ? ' class="ds-unv"' : ''}><td class="ds-sym">${e(r.sym)}</td><td>${e(r.name)}${r.unv ? ' <span class="ds-sub">원문 미대조 — 참고값</span>' : ''}</td><td class="ds-n">${e(r.nom ?? '')}</td><td class="ds-n">${e(r.min ?? '')}</td><td class="ds-n">${e(r.max ?? '')}</td></tr>`).join('')).join('');
  const spec = rec.spec.map(([k, v]) => `<dt>${e(k)}</dt><dd>${v}</dd>`).join('');
  const files = rec.cad.files.map(([n, note]) => `<li><span>${e(n)}</span><span>${e(note)}</span></li>`).join('');
  const notes = [...(rec.notes || []), CAD_DS_DISCLAIM].map(n => `<li>${e(n)}</li>`).join('');
  const revs = rec.rev.map(r => `<tr><td class="mono">${e(r[0])}</td><td class="mono">${e(r[1])}</td><td>${e(r[2])}</td></tr>`).join('');
  // 쪽 아래 문서 번호 · Rev · 쪽. 크기·여백도 여기서 다시 준다 (사이트의 이름 없는 @page가 뒤에 와도 이 문서가 이기게)
  const pageCss = `<style>@page cadds { size: A4 portrait; margin: 9mm 9mm 11mm; @bottom-left { content: ${cadDsCssStr(`DS-${tb.stem} Rev ${tb.rev} · 데이터시트 · 설계 참고용`)}; font-size: 7pt; } @bottom-right { content: counter(page) " / " counter(pages); font-size: 7pt; } }</style>`;
  const nDim = rec.dims.groups.reduce((n, g) => n + g.rows.length + (g.name ? 1 : 0), 0), compact = nDim > 16 || rec.dims.groups.length > 2 || (rec.notes || []).length > 3;   // 부품 셋(볼트·너트·와셔) 세트는 늘 촘촘하게
  return `${pageCss}<article class="cad-ds${compact ? ' ds-compact' : ''}" lang="ko" aria-label="데이터시트 ${e(tb.stem)}">
  <header class="ds-tb">
    <div class="ds-brand"><span class="ds-lab">데이터시트 Data sheet</span><b>볼트노트</b><span class="ds-en">BOLTNOTE</span></div>
    <div class="ds-name"><span class="ds-lab">품명 Name</span><b>${e(tb.ko)}</b><span class="ds-en">${e(tb.en)}</span></div>
    <div class="ds-pn ds-e"><span class="ds-lab">${tb.pn ? '형번 Part no.' : '견적 품목 · 형번은 견적서에서 확정'}</span><b>${e(tb.pn || tb.stem)}</b><span class="ds-en">CAD ${e(tb.stem)}</span></div>
    <div class="ds-row2 ds-lr">
      <div><span class="ds-lab">규격 Standard</span><b>${e(tb.std)}</b></div>
      <div><span class="ds-lab">문서 번호 Doc no.</span><b>DS-${e(tb.stem)}</b></div>
      <div><span class="ds-lab">Rev</span><b>${e(tb.rev)}</b></div>
      <div><span class="ds-lab">날짜 Date</span><b>${e(tb.date)}</b></div>
      <div><span class="ds-lab">단위 · 척도 · 투상</span><b>${e(tb.units)} · NTS · 3각법</b></div>
    </div>
  </header>
  <section><p class="ds-desig">${e(rec.desig.en)}<span class="ds-ko">${e(rec.desig.ko)}</span></p></section>
  ${eq ? `<section class="ds-eq" aria-label="규격 대조">${eq}</section>` : ''}
  <figure class="ds-draw" style="margin:0">${rec.drawSvg || '<p class="ds-sub">그림 없음</p>'}<figcaption class="ds-cap"><span>척도 없음 (NTS) · ${e(rec.drawNote || '')}</span><span>${e(CAD_NOTE_KO)}</span></figcaption></figure>
  <div class="ds-mid">
    <section><h2><span class="ds-zl">A</span>치수 · 선택 크기</h2><table class="ds-dim"><thead><tr><th scope="col">기호</th><th scope="col">항목</th><th scope="col" class="ds-n">호칭</th><th scope="col" class="ds-n">최소</th><th scope="col" class="ds-n">최대</th></tr></thead><tbody>${dim}</tbody><caption>${e(rec.dims.caption)}</caption></table></section>
    <div class="ds-col"><section><h2><span class="ds-zl">B</span>나사 · 재질 · 표면처리 · 질량 · 포장</h2><dl class="ds-spec">${spec}</dl></section>
      <section><h2><span class="ds-zl">E</span>주기</h2><ol class="ds-notes">${notes}</ol></section></div>
  </div>
  <div class="ds-low">
    <section><h2><span class="ds-zl">C</span>서류</h2>${rec.docsHtml}</section>
    <section class="ds-cad"><h2><span class="ds-zl">D</span>CAD 파일</h2><ul>${files}</ul><p class="ds-model">${e(CAD_NOTE_KO)}</p><p>${e(rec.cad.spec)}</p><p>${e(CAD_DWG_KO)}</p><p>${e(rec.cad.order)}</p></section>
  </div>
  <footer class="ds-foot">
    <div class="ds-src"><span class="ds-lab">치수 출처 (규격 원문 · 판)</span>${e(rec.sources.join(' · '))}<span class="ds-sub">설계 참고용 · 최종 사양은 견적서·주문 확인서 기준 · 생성 ${e(rec.gen)}</span></div>
    <div><span class="ds-lab">개정 Revision</span><table><tbody>${revs}</tbody></table></div>
  </footer>
</article>`;
}

/* 품목군 규격표 (가로 A4): 사이트가 파는 호칭 전부. 값 = 위 데이터시트와 같은 행 */
function cadDsTableRec(f) {
  if (!f || !CAD_FAM[f.id]) return null;
  const meta = CAD_FAM[f.id], metric = METRIC.includes(f), ymd = cadDsYmd();
  let cols = [], rows = [], caption = '';
  if (metric) {
    const tk = { hbf: 'hbf', hbp: 'hbp', scs: 'scs', csk: 'csk', hn: 'hn' }[f.id];
    const C = tk ? CAD_CAT.t[tk].cols.filter(([k]) => !/^(b_|fullThread|As)/.test(k)) : [];
    cols = [['size', '호칭'], ['P', '피치'], ...(f.id === 'pw' ? [['d1', '안지름 d1'], ['d2', '바깥지름 d2'], ['h', '두께 h']] : f.id === 'sw' ? [['d1', '안지름 d1'], ['d2', '바깥지름 d2'], ['s', '두께 s']] : C), ...(f.len ? [['L', '길이 L (mm)']] : [])];
    rows = f.sizes.map(size => {
      const r = tk ? cadRow(tk, size) : null, o = { size, P: DIM.pitch[size], unv: r && !r.v };
      if (f.id === 'pw') Object.assign(o, { d1: DIM.pwD1[size], d2: DIM.pwD2[size], h: DIM.pwH[size] });
      if (f.id === 'sw') Object.assign(o, { d1: DIM.swD1[size], d2: DIM.swD2[size], s: DIM.swS[size] });
      if (r) C.forEach(([k]) => { if (r[k] != null) o[k] = r[k]; });
      if (f.len) { const ls = f.len(size); o.L = ls.length ? `${ls[0]}–${ls[ls.length - 1]}` : ''; }
      return o;
    });
    caption = `단위 mm · ${meta.src.join(' · ')} · 호칭값과 최소·최대 · 길이는 이 사이트가 파는 범위`;
  } else {
    const kind = meta.kind, tk = { hcs: 'hcs', hb: 'hb', sset: 'sb', ishc: 'shcs', hnut: 'hhn', stud: 'hhn' }[kind];
    if (!tk) return null;
    const C = CAD_CAT.t[tk].cols.filter(([k]) => !/^(As|J$)/.test(k));
    cols = [['size', kind === 'stud' ? '호칭 (스터드 · 짝 헤비너트)' : '호칭'], ...C.map(([k, ko]) => [k, (kind === 'stud' ? '너트 ' : '') + ko])];
    rows = f.sizes.map(size => { const r = cadRowD(tk, typeof dnumIn === 'function' ? dnumIn(size) : NaN), o = { size: typeof fmtIn === 'function' ? fmtIn(size) : size, unv: !r || !r.v, none: !r }; if (r) C.forEach(([k]) => { if (r[k] != null) o[k] = cadDsIn(r[k]).replace(/ \[.*\]$/, ''); }); return o; });
    caption = `단위 in · ${CAD_SRC_IN[kind].join(' · ')} · 빈 칸 = 자료 없음 (CAD·데이터시트 없음, 견적 시 회신)`;
  }
  return { table: true, f, title: { ko: f.name, en: meta.en, stem: `BN_${cadSafe(f.code)}_TABLE`, std: meta.std, rev: CAD_REV.rev, date: ymd, units: metric ? 'mm' : 'in' },
    cols, rows, caption, notes: ((CAD_CAT.notes || {})[f.id] || []).slice(0, 3), sources: metric ? meta.src : CAD_SRC_IN[meta.kind],
    mtr: typeof cadTrustLine === 'function' ? cadTrustLine({ fam: f.id }) : '제조사 MTR(EN 10204 3.1) 제공 여부: 공급처 확인 중 — 견적 시 회신',
    always: typeof CAD_TRUST_COPY !== 'undefined' ? CAD_TRUST_COPY.always.ko : '볼트노트 CoC(ISO 16228 F2.1 형식) 기본 · EN 10204 3.2·KOLAS 시험은 요청 시 협의 · 볼트노트는 3.1을 직접 발행하지 않습니다', gen: CAD_VER };
}
function cadDsTableHtml(rec) {
  const e = cadE, tb = rec.title, fm = v => typeof v === 'number' ? String(+v.toFixed(3)) : String(v ?? '');
  const pageCss = `<style>@page caddt { size: A4 landscape; margin: 9mm 9mm 11mm; @bottom-left { content: ${cadDsCssStr(`${tb.stem} Rev ${tb.rev} · 표준 규격표 · 설계 참고용`)}; font-size: 7pt; } @bottom-right { content: counter(page) " / " counter(pages); font-size: 7pt; } }</style>`;
  return `${pageCss}<article class="cad-ds cad-dt" lang="ko" aria-label="규격표 ${e(tb.stem)}">
  <header class="ds-tb">
    <div class="ds-brand"><span class="ds-lab">표준 규격표 Dimension table</span><b>볼트노트</b><span class="ds-en">BOLTNOTE</span></div>
    <div class="ds-name"><span class="ds-lab">품명 Name</span><b>${e(tb.ko)}</b><span class="ds-en">${e(tb.en)}</span></div>
    <div class="ds-pn ds-e"><span class="ds-lab">규격 Standard</span><b>${e(tb.std)}</b><span class="ds-en">${e(tb.stem)}</span></div>
    <div class="ds-row2 ds-lr"><div><span class="ds-lab">문서 번호</span><b>${e(tb.stem)}</b></div><div><span class="ds-lab">Rev</span><b>${e(tb.rev)}</b></div><div><span class="ds-lab">날짜</span><b>${e(tb.date)}</b></div><div><span class="ds-lab">단위</span><b>${e(tb.units)}</b></div><div><span class="ds-lab">가격</span><b>없음 (견적서 기준)</b></div></div>
  </header>
  <div class="tblw"><table class="ds-dim ds-big"><thead><tr>${rec.cols.map(([, ko]) => `<th scope="col">${e(ko)}</th>`).join('')}</tr></thead><tbody>${rec.rows.map(r => `<tr${r.unv ? ' class="ds-unv"' : ''}>${rec.cols.map(([k], i) => i ? `<td class="ds-n">${e(fm(r[k]))}</td>` : `<th scope="row" class="ds-sym">${e(r.size)}${r.unv && !r.none ? ' <span class="ds-sub">원문 미대조</span>' : ''}</th>`).join('')}</tr>`).join('')}</tbody><caption>${e(rec.caption)}</caption></table></div>
  <ol class="ds-notes">${[...rec.notes, `서류: ${rec.mtr} · ${rec.always}`, CAD_NOTE_KO + ' (CAD 파일은 품목 장에서 호칭·길이를 고른 뒤 받습니다)', CAD_DS_DISCLAIM].map(n => `<li>${e(n)}</li>`).join('')}</ol>
  <footer class="ds-foot"><div class="ds-src"><span class="ds-lab">치수 출처 (규격 원문 · 판)</span>${e(rec.sources.join(' · '))}<span class="ds-sub">설계 참고용 · 생성 ${e(rec.gen)}</span></div><div></div></footer>
</article>`;
}

// 데이터시트 CSS (trust_proto/ds.css + 그림·규격표 규칙). 공개 사이트는 인쇄할 때만 <style>로 붙이고, 미러 파일에는 그대로 넣는다
const CAD_DS_CSS = `.cad-ds { --ds-lw: .45mm; color: var(--ink); background: var(--sheet); font-family: var(--f-sans); font-size: 13px; line-height: 1.45; border: 1.5px solid var(--ink); padding: 14px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; max-width: 210mm; margin: 0 auto; word-break: keep-all; overflow-wrap: break-word; }
.cad-ds.cad-dt { max-width: 297mm; }
.cad-ds * { box-sizing: border-box; }
.cad-ds .ds-lab { display: block; font-family: var(--f-mono); font-size: 12px; letter-spacing: .03em; color: var(--ink-3); text-transform: uppercase; line-height: 1.3; }
.cad-ds .mono { font-family: var(--f-mono); font-variant-numeric: tabular-nums; }
.cad-ds .ds-en { display: block; font-size: 12px; color: var(--ink-2); font-weight: 400; }
.cad-ds .redp { color: var(--red); }
.cad-ds .tag { display: inline-flex; align-items: center; min-height: 20px; padding: 0 6px; font-family: var(--f-mono); font-size: 12px; border: 1px solid var(--blue); color: var(--blue); border-radius: 2px; white-space: nowrap; }
.cad-ds .tag.wait { border: 1px dashed var(--ink-3); color: var(--ink-2); }
.cad-ds h2 { margin: 0 0 4px; font-size: 13px; font-weight: 800; letter-spacing: -.01em; display: flex; gap: 8px; align-items: baseline; }
.cad-ds h2 .ds-zl { font-family: var(--f-cond); font-weight: 600; font-size: 14px; color: var(--ink-3); }
.cad-ds table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.cad-ds th, .cad-ds td { text-align: left; vertical-align: top; padding: 3px 6px; border-bottom: 1px solid var(--hair-2); }
.cad-ds thead th { font-family: var(--f-mono); font-size: 12px; font-weight: 400; color: var(--ink-3); border-bottom: 1px solid var(--ink); }
.cad-ds .ds-sub { display: block; font-size: 12px; color: var(--ink-2); }
.cad-ds p { margin: 0; }
.cad-ds .ds-tb { display: grid; grid-template-columns: 1.1fr 2.2fr 1.5fr; border: var(--ds-lw) solid var(--ink); }
.cad-ds .ds-tb > div { padding: 5px 8px 6px; border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink); min-width: 0; }
.cad-ds .ds-tb > .ds-e { border-right: 0; }
.cad-ds .ds-tb > .ds-lr { border-bottom: 0; }
.cad-ds .ds-tb .ds-brand b { display: block; font-size: 15px; font-weight: 800; }
.cad-ds .ds-tb .ds-name b { display: block; font-size: 18px; font-weight: 800; letter-spacing: -.02em; line-height: 1.25; }
.cad-ds .ds-tb .ds-pn b { display: block; font-family: var(--f-mono); font-size: 15px; font-weight: 700; overflow-wrap: anywhere; line-height: 1.25; }
.cad-ds .ds-tb .ds-row2 { grid-column: 1 / -1; display: grid; grid-template-columns: 2.2fr 1.6fr .6fr 1fr 1.4fr; padding: 0; border-right: 0; }
.cad-ds .ds-tb .ds-row2 > div { padding: 4px 8px 5px; border-right: 1px solid var(--ink); min-width: 0; }
.cad-ds .ds-tb .ds-row2 > div:last-child { border-right: 0; }
.cad-ds .ds-tb .ds-row2 b { font-family: var(--f-mono); font-size: 12.5px; font-weight: 700; overflow-wrap: anywhere; }
.cad-ds .ds-eq { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); border: 1px solid var(--ink); }
.cad-ds .ds-eq > div { padding: 3px 8px 4px; border-right: 1px solid var(--hair); min-width: 0; }
.cad-ds .ds-eq > div:last-child { border-right: 0; }
.cad-ds .ds-eq b { font-family: var(--f-mono); font-size: 12.5px; font-weight: 400; }
.cad-ds .ds-desig { font-family: var(--f-mono); font-size: 12.5px; }
.cad-ds .ds-desig .ds-ko { font-family: var(--f-sans); display: block; color: var(--ink-2); }
.cad-ds .ds-draw { border: 1px solid var(--hair); padding: 6px; position: relative; }
.cad-ds .ds-draw svg { display: block; width: 100%; height: auto; max-height: 62mm; overflow: hidden; }
.cad-ds .ds-draw .ds-cap { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--ink-3); font-family: var(--f-mono); }
.cad-ds .ds-mid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.cad-ds .ds-col { display: grid; gap: 10px; min-width: 0; }
.cad-ds .ds-dim td.ds-n, .cad-ds .ds-dim th.ds-n { text-align: right; font-family: var(--f-mono); white-space: nowrap; }
.cad-ds .ds-dim .ds-sym { font-family: var(--f-mono); font-weight: 700; white-space: nowrap; }
.cad-ds .ds-dim tr.ds-grp th { font-family: var(--f-sans); font-size: 12px; font-weight: 800; color: var(--ink); background: var(--sheet-2); border-bottom: 1px solid var(--hair); }
.cad-ds .ds-dim tr.ds-unv td, .cad-ds .ds-dim tr.ds-unv th { background: var(--hl-soft); }
.cad-ds .ds-dim caption { caption-side: bottom; text-align: left; font-size: 12px; color: var(--ink-3); padding-top: 3px; }
.cad-ds .ds-big thead th { white-space: normal; vertical-align: bottom; }
.cad-ds dl.ds-spec { margin: 0; display: grid; grid-template-columns: auto 1fr; border-top: 1px solid var(--ink); }
.cad-ds dl.ds-spec dt { font-family: var(--f-mono); font-size: 12px; color: var(--ink-3); padding: 4px 8px 4px 0; border-bottom: 1px solid var(--hair-2); white-space: nowrap; }
.cad-ds dl.ds-spec dd { margin: 0; padding: 4px 0; border-bottom: 1px solid var(--hair-2); min-width: 0; }
.cad-ds .ds-low { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.cad-ds .cad-ds-docs th[scope="row"] { width: 27%; font-weight: 700; white-space: nowrap; }
.cad-ds .cad-ds-docs td.ds-st { width: 15%; white-space: nowrap; font-family: var(--f-mono); font-size: 12px; }
.cad-ds .cad-ds-foot { margin: 4px 0 0; font-size: 12px; color: var(--ink-2); }
.cad-ds .ds-cad ul { margin: 0; padding: 0; list-style: none; border-top: 1px solid var(--ink); }
.cad-ds .ds-cad li { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 3px 0; border-bottom: 1px solid var(--hair-2); font-family: var(--f-mono); font-size: 12px; overflow-wrap: anywhere; }
.cad-ds .ds-cad li span:last-child { color: var(--ink-3); white-space: nowrap; }
.cad-ds .ds-cad p { margin: 4px 0 0; font-size: 12px; }
.cad-ds .ds-cad .ds-model { font-weight: 700; }
.cad-ds ol.ds-notes { margin: 0; padding: 0 0 0 1.4em; font-size: 12px; display: grid; gap: 1px; }
.cad-ds ol.ds-notes li::marker { font-family: var(--f-mono); color: var(--ink-3); }
.cad-ds .ds-foot { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 12px; border-top: var(--ds-lw) solid var(--ink); padding-top: 6px; font-size: 12px; }
.cad-ds .ds-foot table td, .cad-ds .ds-foot table th { padding: 2px 6px; }
.cad-ds .ds-foot .ds-src { color: var(--ink-2); }
.cad-ds .tblw { overflow-x: auto; }
.cad-ds-print { display: none; }
.cad-ds-hint { max-width: 210mm; margin: 0 auto 10px; padding: 8px 12px; border: 1px solid var(--blue); background: var(--blue-soft); color: var(--ink); font: 13px/1.5 var(--f-sans); border-radius: 2px; }
@media screen and (max-width: 680px) {
  .cad-ds { padding: 10px; }
  .cad-ds .ds-tb { grid-template-columns: 1fr; }
  .cad-ds .ds-tb > div { border-right: 0; }
  .cad-ds .ds-tb .ds-row2 { grid-template-columns: 1fr 1fr; }
  .cad-ds .ds-tb .ds-row2 > div { border-bottom: 1px solid var(--ink); }
  .cad-ds .ds-tb .ds-row2 > div:nth-child(2n) { border-right: 0; }
  .cad-ds .ds-mid, .cad-ds .ds-low, .cad-ds .ds-foot { grid-template-columns: minmax(0, 1fr); }
  .cad-ds .cad-ds-docs th[scope="row"], .cad-ds .cad-ds-docs td.ds-st { width: auto; white-space: normal; }
  .cad-ds .ds-dim { display: block; overflow-x: auto; }
}
@page cadds { size: A4 portrait; margin: 9mm 9mm 11mm; }
@page caddt { size: A4 landscape; margin: 9mm 9mm 11mm; }
@media print {
  :root, :root:not([data-theme="light"]), :root[data-theme="dark"] { --paper: #FFFFFF; --sheet: #FFFFFF; --sheet-2: #EEEEEE; --ink: #000000; --ink-2: #222222; --ink-3: #444444; --hair: #8A8A8A; --hair-2: #BBBBBB;
    --red: #B42B1B; --blue: #000000; --blue-soft: #FFFFFF; --hl-soft: #F2F2F2; --dim: #000000; color-scheme: light; }
  body.cad-ds-printing > :not(.cad-ds-print) { display: none !important; }
  .cad-ds-print { display: block !important; page: cadds; }
  .cad-ds-print.dt { page: caddt; }
  .cad-ds-hint { display: none !important; }
  .cad-ds { page: cadds; -webkit-print-color-adjust: exact; print-color-adjust: exact; max-width: none; margin: 0; border-width: .5mm; padding: 3.5mm; gap: 2.4mm; font-size: 8pt; line-height: 1.3; break-inside: avoid; }
  .cad-ds.cad-dt { page: caddt; break-inside: auto; }
  .cad-ds.cad-dt thead { display: table-header-group; }
  .cad-ds.cad-dt tr { break-inside: avoid; }
  .cad-ds .ds-lab, .cad-ds .ds-en, .cad-ds .ds-sub, .cad-ds thead th, .cad-ds .tag, .cad-ds .ds-draw .ds-cap, .cad-ds dl.ds-spec dt, .cad-ds .cad-ds-docs td.ds-st,
  .cad-ds .ds-cad li, .cad-ds .ds-cad p, .cad-ds ol.ds-notes, .cad-ds .ds-foot, .cad-ds .cad-ds-foot, .cad-ds .ds-dim caption, .cad-ds .ds-dim tr.ds-grp th { font-size: 7pt; }
  .cad-ds .tag { min-height: 0; padding: 0 1.2mm; }
  .cad-ds h2 { font-size: 9pt; margin-bottom: 1mm; }
  .cad-ds h2 .ds-zl { font-size: 9.5pt; }
  .cad-ds th, .cad-ds td { padding: .3mm 1.4mm; }
  .cad-ds .ds-tb .ds-name b { font-size: 13pt; }
  .cad-ds .ds-tb .ds-pn b { font-size: 11.5pt; }
  .cad-ds .ds-tb .ds-brand b { font-size: 11pt; }
  .cad-ds .ds-tb .ds-row2 b, .cad-ds .ds-eq b, .cad-ds .ds-desig { font-size: 8pt; }
  .cad-ds .ds-tb > div, .cad-ds .ds-tb .ds-row2 > div { padding: .8mm 2mm 1mm; }
  .cad-ds .ds-draw { padding: 1.5mm; }
  .cad-ds .ds-draw svg { max-height: 40mm; }
  .cad-ds .ds-col { gap: 2.4mm; }
  .cad-ds .ds-mid, .cad-ds .ds-low, .cad-ds .ds-foot { gap: 3.5mm; }
  .cad-ds .ds-mid { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); }   /* 치수표 항목 칸이 세 줄로 접히지 않게 (F837 등) */
  .cad-ds dl.ds-spec dt, .cad-ds dl.ds-spec dd { padding: .6mm 1.5mm .6mm 0; }
  .cad-ds .ds-cad li { padding: .5mm 0; }
  .cad-ds.ds-compact .ds-draw svg { max-height: 28mm; }
  .cad-ds.ds-compact { gap: 1.4mm; }
  .cad-ds.ds-compact .ds-col, .cad-ds.ds-compact .ds-mid, .cad-ds.ds-compact .ds-low { gap: 2mm; }
  .cad-ds.ds-compact th, .cad-ds.ds-compact td { padding: .15mm 1.2mm; }
}`;

// 미러에서 받는 독립 HTML (스크립트 없음, 밝은 종이 문서). 토큰 = 페이지 첫 :root 블록 (밝은 값), 없으면 기본값
function cadDsTokens() {
  try { const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n'), m = css.match(/:root \{[\s\S]*?\n\}/); if (m) return m[0]; } catch { /* 문서 없음 */ }
  return ':root { --paper: #F1F3EF; --sheet: #FBFCFA; --sheet-2: #F5F7F3; --ink: #17202A; --ink-2: #485361; --ink-3: #5C6773; --hair: #B3BDC5; --hair-2: #D8DEE1; --dim: #2B5A80; --red: #B42B1B; --blue: #285E95; --blue-soft: #E0E9F2; --hl-soft: #FAF2BE; --f-sans: "Gothic A1", sans-serif; --f-mono: "B612", monospace; --f-cond: "Barlow Condensed", sans-serif; }';
}
function cadDsFile(rec) {
  const body = rec.table ? cadDsTableHtml(rec) : cadDsHtml(rec), name = rec.table ? rec.title.stem : rec.title.stem + '_DS';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${cadE(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=B612:wght@400;700&family=Barlow+Condensed:wght@600&family=Gothic+A1:wght@400;700;800&display=swap">
<style>${cadDsTokens()}
html, body { margin: 0; background: var(--paper); color: var(--ink); color-scheme: light; }
body { padding: 16px; font-family: var(--f-sans); }
@media print { body { padding: 0; background: #FFFFFF; } }
${CAD_DS_CSS}</style></head>
<body><p class="cad-ds-hint">인쇄: Ctrl+P (Mac ⌘P) → 대상 <b>PDF로 저장</b> · 용지 A4${rec.table ? ' 가로' : ''} · 여백 기본값. 이 안내는 인쇄되지 않습니다.</p>
${body}
</body></html>`;
}
// 공개 사이트 인쇄: 인쇄 전용 칸에 그리고 print(). 틀 안이면 false (호출한 쪽이 HTML 파일로 대신 준다)
function cadDsPrint(rec) {
  if (!CAD_PUBLIC || typeof window.print !== 'function') return false;
  if (!document.getElementById('cad-ds-css')) { const st = document.createElement('style'); st.id = 'cad-ds-css'; st.textContent = CAD_DS_CSS; document.head.appendChild(st); }
  document.querySelectorAll('.cad-ds-print').forEach(n => n.remove());
  const box = document.createElement('div'); box.className = 'cad-ds-print' + (rec.table ? ' dt' : ''); box.innerHTML = rec.table ? cadDsTableHtml(rec) : cadDsHtml(rec);
  document.body.appendChild(box); document.body.classList.add('cad-ds-printing');
  const t0 = document.title; document.title = rec.table ? rec.title.stem : rec.title.stem + '_DS';   // 'PDF로 저장'이 이 이름을 제안
  const done = () => { box.remove(); document.body.classList.remove('cad-ds-printing'); document.title = t0; };
  window.addEventListener('afterprint', done, { once: true });
  try { window.print(); } catch { done(); }
  return true;
}
