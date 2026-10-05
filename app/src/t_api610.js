/* 5장 규격 도구 · 상세 11: API 610 재질 클래스 → 볼팅
   - 데이터와 판별은 엔진 트랙의 e0_api610.js(API610, API610_ALIASES, parseApi610)를 읽기만 한다. 다시 선언하지 않는다.
     parseApi610이 없을 때만 이 모듈 안의 a6ParseFb를 쓴다.
   - 등록: TABS·TOOL·INDEX에 더한다(5장 탭 11번째, 기본 10개 뒤). 이벤트는 document에 위임해서 탭을 다시 그려도 그대로 동작한다.
   - 원칙: 자료가 없는 판은 값을 자동으로 정하지 않는다(noAutoMap). 2026-10 감사(INTEGRATE F)로 클래스별 볼팅 자료·조항 요약을 모두 뺐고,
     도구는 e1_data.js의 API610_TOOL 스위치가 false인 동안 탭·검색에 등록하지 않는다 (코드는 다시 채울 때를 위해 남김).
   - 'BOM에 넣기': state.bom.text(4A장 BOM 견적)에 한 줄을 붙이고 go('bom'). 워크벤치가 없으면 문구만 만든다. */
(() => {
  if (typeof API610 === 'undefined' || !API610.editions || typeof TOOL === 'undefined' || !Array.isArray(TABS)) return;
  if (typeof API610_TOOL !== 'undefined' && !API610_TOOL) return;   // 2026-10 감사: 볼팅 자료를 다시 채울 때까지 도구를 숨긴다
  const AL = typeof API610_ALIASES !== 'undefined' ? API610_ALIASES : {};
  const EDS = ['8th', '9th', '10th', '11th', '12th', '13th'];
  const NOAUTO = AL.noAutoMap || ['9th', '10th', '13th'];
  const CODES = AL.validCodes || ['I-1', 'I-2', 'S-1', 'S-3', 'S-4', 'S-5', 'S-6', 'S-8', 'S-9', 'C-6', 'A-7', 'A-8', 'D-1', 'D-2'];
  const ED_YR = { '12th': '2021', '13th': '2026' };   // 공개 자료로 확인한 연도만 (12판 2021년 1월, 13판 2026년 6월)
  const PARTS = [['stud', '케이싱·글랜드 스터드 + 너트'], ['wetted', '접액(내부) 볼트']];
  const SVCS = [['general', '일반'], ['sour', '사워 (H2S)'], ['lowTemp', '저온'], ['sourLowTemp', '사워 + 저온'], ['hf', 'HF (불산)']];
  const SVC_TOK = { general: '', sour: ' SOUR', lowTemp: ' LOW TEMP', sourLowTemp: ' SOUR LOW TEMP', hf: ' HF' };
  const EX = ['C-6', 'API 610 12th S-6 casing stud', 'API610 C6 MATL', 'Class S-5C per API 610 11th', 'API 610-2010 D-1', 'API 610 12th S-1', 'API 610 13th A-8', 'ISO 13709:2003 S-6'];
  const TITLE = 'API 610 재질 클래스 → 볼팅';
  const lowSvc = s => s === 'lowTemp' || s === 'sourLowTemp';
  const edKo = ed => ed ? ed.replace(/(st|nd|rd|th)$/, '') + '판' : '판 미확인';
  const astm = s => s == null ? '' : String(s).replace(/ASTM\s+/g, '');
  const clean = s => astm(s).replace(/\s*\([^)]*\)\s*$/, '').trim();          // 'A194 7L (업계 일반 관행, 원문 미대조)' → 'A194 7L'
  const simple = s => /^A(?:193|194|320)\s+[0-9A-Z]+$/.test(s);
  const label = (list, v) => (list.find(x => x[0] === v) || list[0])[1];

  // 판의 자료 상태: ok(공개 출처로 확인) · practice(관행, 확인 중) · nodata(자료 확인 중)
  const src = ed => {
    const E = API610.editions[ed];
    if (!E || !Object.keys(E.classes || {}).length) return ['nodata', '자료 확인 중'];
    return E.status === 'verified' ? ['ok', '자료 확인됨'] : ['practice', '자료 확인 중'];
  };
  const srcTag = ed => { const [k, t] = src(ed); return `<span class="tag ${k === 'ok' ? 'a6-ok' : k === 'practice' ? 'wait' : 'warn'}">${t}</span>`; };
  // 판·클래스 하나: state ok · nodata · removed(그 판에서 삭제) · notListed(8판 관행 자료에 없음) · absent
  const rowOf = (ed, cls) => {
    const E = API610.editions[ed];
    if (!E || !Object.keys(E.classes || {}).length) return { ed, state: 'nodata' };
    if ((E.removed || []).includes(cls)) return { ed, state: 'removed' };
    if ((E.notListed || []).includes(cls)) return { ed, state: 'notListed' };
    const C = E.classes[cls];
    if (!C) return { ed, state: 'absent' };
    return { ed, state: 'ok', C, stud: C.studs?.astm ?? null, nut: C.nuts?.astm ?? null, wetted: C.other?.astm ?? null };
  };
  const classesIn = U => {
    const re = AL.classCode ? new RegExp(AL.classCode.source, 'gi') : /(?<![A-Z0-9])([ISCAD])\s*-?\s*([1-9])(?![0-9])/gi, out = [];
    for (const m of String(U).toUpperCase().matchAll(re)) { const c = `${m[1].toUpperCase()}-${m[2]}`; if (CODES.includes(c) && !out.includes(c)) out.push(c); }
    return out;
  };

  /* parseApi610이 없을 때만 쓰는 간이 판별 (같은 모양의 결과) */
  const a6ParseFb = text => {
    let U = String(text ?? '').normalize('NFKC').toUpperCase();
    for (const [re, to] of AL.normalize || []) U = U.replace(re, to);
    if (!(AL.context || /API\s*-?\s*610|ISO\s*13709/i).test(U)) return null;
    const out = { std: 'API 610', cls: null, suffix: null, edition: null, editionSource: null, editionNote: '', part: 'unspecified', service: 'general', mdmtC: null,
      status: 'context', why: null, bolting: { stud: null, nut: null, wetted: null, assumed: false, basis: null }, perEdition: [], explicit: [], questions: [], caveats: [] };
    const eds = new Set(), num = { 8: '8th', 9: '9th', 10: '10th', 11: '11th', 12: '12th', 13: '13th' };
    for (const re of [/(?<![0-9])(8|9|10|11|12|13)\s*(?:ST|ND|RD|TH)(?![A-Z])/, /(?<![0-9])(8|9|10|11|12|13)\s*판/, /\bED(?:ITION|N)?\.?\s*(8|9|10|11|12|13)(?![0-9])/]) { const m = U.match(re); if (m) eds.add(num[m[1]]); }
    const y = U.match(/API\s*-?\s*610\s*[-:\/(,]?\s*((?:19|20)\d{2})(?![0-9])/), ys = { 2021: '12th', 2026: '13th' };   // 공개 자료로 확인한 연도만
    if (y && ys[y[1]]) eds.add(ys[y[1]]);
    const iso = U.match(/ISO\s*13709\s*[:\-]\s*(\d{4})/);
    if (eds.size === 1 && !iso) { out.edition = [...eds][0]; out.editionSource = 'number'; }
    else if (eds.size > 1) { out.editionSource = 'conflict'; out.why = `판 표기 충돌 (${[...eds].map(edKo).join(' / ')})`; }
    else if (iso) { out.editionSource = 'iso-ambiguous'; out.why = 'ISO 13709 연도 표기만으로는 API 610 판을 정할 수 없음'; }
    out.part = /WETTED|INTERNAL|IMPELLER|접액|내부/.test(U) ? 'wetted' : /STUD|스터드|GLAND|글랜드|CASING/.test(U) ? 'stud' : /\bNUTS?\b|너트/.test(U) ? 'nut' : 'unspecified';
    const sour = /SOUR|H2S|NACE|MR\s*-?\s*0(?:103|175)|사워/.test(U), low = /LOW[\s-]*TEMP|MDMT|저온/.test(U), hf = /\bHF\b|불산/.test(U);
    out.service = hf ? 'hf' : sour && low ? 'sourLowTemp' : sour ? 'sour' : low ? 'lowTemp' : 'general';
    const t = U.match(/(?:^|[\s(=:])(-\s?\d{1,3})\s*(?:°\s*)?C(?![A-Z0-9])/); if (t) out.mdmtC = +t[1].replace(/\s/g, '');
    const cls = classesIn(U); if (!cls.length) return out;
    out.cls = cls[0];
    out.perEdition = EDS.map(ed => { const r = rowOf(ed, out.cls); return { ed, state: r.state, stud: r.stud, nut: r.nut, wetted: r.wetted }; });
    const NQ = w => { out.status = 'engineer-quote'; out.why = out.why || w; };
    if (cls.length > 1) NQ(`클래스 표기 ${cls.length}개 (${cls.join(', ')})`);
    if (out.editionSource === 'conflict' || out.editionSource === 'iso-ambiguous') NQ(out.why);
    let r = null;
    if (out.edition) {
      r = rowOf(out.edition, out.cls);
      if (NOAUTO.includes(out.edition) || r.state === 'nodata') NQ(`${edKo(out.edition)} 원문 데이터 없음`);
      else if (r.state !== 'ok') NQ(`${edKo(out.edition)} 자료에 없는 클래스`);
    } else if (out.status !== 'engineer-quote') {
      const a = rowOf('11th', out.cls), b = rowOf('12th', out.cls);
      if (a.state === 'ok' && b.state === 'ok' && a.stud === b.stud && a.nut === b.nut) { r = a; out.bolting.basis = '11th=12th'; } else NQ('판에 따라 결과가 다름 (판 미기재)');
      out.questions.push('API 610 판(edition)을 알려 주세요.');
    }
    if (r && r.state === 'ok' && out.status !== 'engineer-quote') {
      Object.assign(out.bolting, { stud: r.stud, nut: r.nut, wetted: r.wetted, assumed: !out.edition });
      out.status = out.edition && out.edition !== '8th' ? 'mapped' : 'confirm';
      if (out.part === 'wetted' ? !r.wetted : !r.stud) NQ('표에 볼팅 ASTM 규격이 없음');
      if (r.C.ask && out.status !== 'engineer-quote') { out.status = 'confirm'; out.questions.push(r.C.ask); }
    }
    if (out.service !== 'general' && out.status !== 'engineer-quote') {
      const M = API610.editions[out.edition || '12th']?.modifiers?.[out.service];
      if (out.service === 'sour' && out.part !== 'wetted') { if (M?.studs) Object.assign(out.bolting, { stud: M.studs, nut: M.nuts }); out.status = 'confirm'; }
      else if (out.edition === '8th' && M?.studs) { Object.assign(out.bolting, { stud: M.studs, nut: M.nuts }); out.status = 'confirm'; }
      else NQ('사용 조건 볼팅은 11·12판 표에 등급이 없음');
    }
    if (out.status === 'engineer-quote') { out.reference = { ...out.bolting }; out.bolting = { stud: null, nut: null, wetted: null, assumed: false, basis: null }; }
    return out;
  };
  const parse = t => (typeof parseApi610 === 'function' ? parseApi610 : a6ParseFb)(t);
  const ctxText = t => /API\s*-?\s*(?:STD\.?\s*)?610|ISO\s*13709/i.test(t) ? t : 'API 610 ' + t;

  /* 상태 (이 브라우저에만 저장) */
  const DEF = { text: 'C-6', ed: '', part: 'stud', svc: 'general', mdmt: '', size: '', len: '', unit: 'in', qty: '' };
  const st = state.a6 = (() => {
    const s = store.get('a6', null), o = { ...DEF, cmp: null, rules: false };
    if (!s || typeof s !== 'object') return o;
    for (const k of Object.keys(DEF)) if (typeof s[k] === 'string') o[k] = s[k];
    if (o.ed && !EDS.includes(o.ed)) o.ed = '';
    if (!PARTS.some(p => p[0] === o.part)) o.part = 'stud';
    if (!SVCS.some(p => p[0] === o.svc)) o.svc = 'general';
    if (o.unit !== 'mm') o.unit = 'in';
    return o;
  })();
  const save = () => { const { cmp, rules, ...keep } = st; store.set('a6', keep); };
  // 문구에서 읽은 판·부위·사용 조건을 선택에 반영 (적혀 있을 때만)
  const syncFrom = rp => {
    if (!rp) return;
    if (rp.edition) st.ed = rp.edition;
    else if (rp.editionSource === 'conflict' || /^iso/.test(rp.editionSource || '')) st.ed = '';
    if (rp.part === 'wetted') st.part = 'wetted'; else if (rp.part === 'stud' || rp.part === 'nut') st.part = 'stud';
    if (rp.service && rp.service !== 'general') st.svc = rp.service;
    if (rp.mdmtC != null) st.mdmt = String(rp.mdmtC);
    st.cmp = null;
  };

  /* 모델: 고른 판·부위·조건으로 다시 판별해 워크벤치와 같은 판정을 쓴다 */
  const model = () => {
    const raw = st.text.trim(), rp = raw ? parse(ctxText(raw)) : null, cls = rp && rp.cls || null;
    const mdmt = st.mdmt.trim() !== '' && isFinite(+st.mdmt) ? Math.round(+st.mdmt) : null;
    const M = { raw, rp, cls, ed: st.ed, mdmt, all: raw ? classesIn(ctxText(raw)) : [] };
    if (!cls) return M;
    const md = lowSvc(st.svc) && mdmt != null && mdmt < 0 ? ` ${mdmt} °C` : '';
    M.P = parse(`API 610 ${st.ed ? st.ed.toUpperCase() + ' ' : ''}${cls} ${st.part === 'wetted' ? 'WETTED' : 'CASING STUD'}${SVC_TOK[st.svc]}${md}`) || a6ParseFb(`API 610 ${cls}`);
    // 문구의 판 표기가 충돌하거나(11th와 12th 함께) ISO 13709:2003처럼 판을 가릴 수 없으면, 판을 고르기 전까지 엔지니어 견적으로 둔다
    if (!st.ed && rp && (rp.editionSource === 'conflict' || /^iso/.test(rp.editionSource || '')) && rp.why) {
      M.amb = rp.why;
      M.P = { ...M.P, status: 'engineer-quote', why: rp.why, reference: M.P.bolting, bolting: { stud: null, nut: null, wetted: null, assumed: false, basis: null },
        questions: ['문구의 판 표기로는 판을 정할 수 없습니다. 데이터시트나 PO에서 API 610 판(edition)을 확인해 주세요.'] };
    }
    M.row = st.ed ? rowOf(st.ed, cls) : null;
    M.known = !!(M.row && M.row.state === 'ok' && !NOAUTO.includes(st.ed));
    const ref = ['12th', '11th', '8th'].map(e => rowOf(e, cls)).find(r => r.state === 'ok');
    M.C = M.known ? M.row.C : ref ? ref.C : null;
    return M;
  };

  /* ── 화면 조각 ── */
  const ST = { mapped: ['ok', '판 확인 · 표 값 그대로'], confirm: ['info', '확인할 것 있음'], 'engineer-quote': ['warn', '엔지니어 확인 후 견적'], context: ['wait', '클래스 없음'] };
  const pressed = (v, cur) => `aria-pressed="${v === cur}"`;
  const formHTML = M => `<fieldset class="tbf a6-f">${legend('A', '조회 조건', '문구를 붙여 넣거나 아래에서 고릅니다')}
    ${fc('w4 e', `<label for="a6-in">재질 클래스 또는 RFQ 문구</label><input id="a6-in" class="a6-q" value="${esc(st.text)}" autocomplete="off" spellcheck="false" placeholder="예: C-6 · API 610 12th S-6 casing stud">
      <span class="hint">C6, CL C-6, MATL CLASS S-6, S-5C처럼 적혀 있어도 읽습니다. 문구에 판·부위·사용 조건이 있으면 아래 선택에 반영합니다.</span>
      <div class="dec-ex a6-ex"><span>예:</span>${EX.map(t => `<button type="button" class="chipbtn" data-a6-ex="${esc(t)}">${esc(t)}</button>`).join('')}</div>`)}
    ${fc('w4 e', `<span class="flab" id="a6-cls-l">클래스 고르기</span><div class="opts a6-cls" role="group" aria-labelledby="a6-cls-l">${CODES.map(c => `<button type="button" data-a6-cls="${c}" ${pressed(c, M.cls)}>${c}</button>`).join('')}</div>`)}
    ${fc('w2', `<span class="flab" id="a6-ed-l">판 (edition)</span><div class="opts txt a6-eds" role="group" aria-labelledby="a6-ed-l"><button type="button" data-a6-ed="" ${pressed('', st.ed)}>모름</button>${EDS.map(ed => { const k = src(ed)[0]; return `<button type="button" data-a6-ed="${ed}" ${pressed(ed, st.ed)}>${edKo(ed)}<span class="x">${k === 'ok' ? '자료 확인됨' : '자료 확인 중'}</span></button>`; }).join('')}</div>
      <span class="hint">데이터시트·PO·도면 표제란의 'API 610 11th', 'API 610 12판' 같은 표기에서 찾습니다.</span>`)}
    ${fc('w2 e', `<span class="flab" id="a6-pt-l">부위</span><div class="opts txt" role="group" aria-labelledby="a6-pt-l">${PARTS.map(([v, l]) => `<button type="button" data-a6-pt="${v}" ${pressed(v, st.part)}>${l}</button>`).join('')}</div>`)}
    ${fc('w3 lr', `<span class="flab" id="a6-sv-l">사용 조건</span><div class="opts txt" role="group" aria-labelledby="a6-sv-l">${SVCS.map(([v, l]) => `<button type="button" data-a6-sv="${v}" ${pressed(v, st.svc)}>${l}</button>`).join('')}</div>`)}
    ${fc('e lr', `<label for="a6-md">MDMT (°C)</label><input id="a6-md" class="qty" value="${esc(st.mdmt)}" inputmode="text" autocomplete="off" placeholder="−46"${lowSvc(st.svc) ? '' : ' disabled'}><span class="hint">저온일 때 최저설계금속온도</span>`)}
  </fieldset>`;

  const bomLineOf = M => {
    if (!M.cls) return null;
    const P = M.P, b = P && P.status !== 'engineer-quote' && !P.bolting.assumed ? P.bolting : null, wet = st.part === 'wetted';
    const sz = st.size.trim().replace(/\s+/g, ' '), metric = /^M\d/i.test(sz);
    let len = st.len.trim();
    if (len && st.unit === 'mm' && !metric && !/mm$/i.test(len)) len += 'MM';
    if (len && st.unit === 'in' && metric && !/["']|in$/i.test(len)) len += '"';
    const mat = wet ? (b && b.wetted ? astm(b.wetted) : '') : b && simple(clean(b.stud)) && simple(clean(b.nut)) ? `${clean(b.stud)} / ${clean(b.nut)}` : 'W/2 NUTS';
    const ctx = M.amb ? M.raw.replace(/\s+/g, ' ') : `API 610${st.ed ? ' ' + st.ed : ''} ${M.cls}`;   // 판 표기가 모호하면 원문 그대로 넘겨 워크벤치도 같은 판단을 하게
    const desc = [wet ? 'BOLT' : 'STUD', sz, len && `x ${len}`, mat].filter(Boolean).join(' ')
      + ` — ${ctx}${wet ? ' WETTED' : ''}${SVC_TOK[st.svc]}${lowSvc(st.svc) && M.mdmt != null ? ` MDMT ${M.mdmt}C` : ''}`;
    const n = parseInt(st.qty, 10), unit = wet ? 'EA' : 'SET';
    return { desc, qty: n > 0 ? n : null, unit, text: n > 0 ? `${desc}  ${n} ${unit}` : desc };
  };
  const bomNo = () => (typeof SHEETS !== 'undefined' && SHEETS.bom ? SHEETS.bom[0] : '4A');
  const bomHTML = M => { const L = bomLineOf(M); return `<fieldset class="tbf a6-b">${legend('B', 'BOM 줄 만들기', `${bomNo()}장 BOM 견적으로 보냅니다`)}
    ${fc('w2', `<label for="a6-sz">호칭 · 나사</label><input id="a6-sz" value="${esc(st.size)}" placeholder="3/4-10UNC · M20" autocomplete="off" spellcheck="false">`)}
    ${fc('w2 e', `<label for="a6-qty">수량</label><input id="a6-qty" class="qty" type="number" min="1" inputmode="numeric" value="${esc(st.qty)}" placeholder="16"><span class="hint" id="a6-qh">${st.part === 'wetted' ? '개수 (EA)' : '스터드 1개 + 너트 2개 = 1세트'}</span>`)}
    ${fc('w4 e', `<span class="flab" id="a6-len-l">길이</span><div class="a6-len"><input id="a6-len" aria-labelledby="a6-len-l" value="${esc(st.len)}" placeholder="4-3/4 · 120" autocomplete="off" spellcheck="false"><div class="segc" role="radiogroup" aria-label="길이 단위"><label><input type="radio" name="a6-unit" value="in"${st.unit === 'in' ? ' checked' : ''}>in</label><label><input type="radio" name="a6-unit" value="mm"${st.unit === 'mm' ? ' checked' : ''}>mm</label></div></div>`)}
    ${fc('w4 e lr', `<span class="lab">BOM에 들어갈 줄</span><div class="spec-out" id="a6-line">${L ? esc(L.text) : ''}</div>
      <div class="actions"><button class="btn pri" type="button" data-a6-act="bom"${L ? '' : ' disabled'}>BOM에 넣기 → ${bomNo()}장</button><button class="btn" type="button" data-a6-act="copy"${L ? '' : ' disabled'}>문구 복사</button></div>
      <p class="small muted" id="a6-msg" aria-live="polite">등급은 자료가 확인된 경우에만 적습니다. 그 밖에는 등급 없이 넣고, 워크벤치가 같은 질문을 붙입니다.</p>`)}
  </fieldset>`; };

  // 결과 표제란: 클래스 · 판 · 부위·조건 · 판정 / 볼팅
  const tbHTML = M => {
    if (!M.cls) return `<div class="a6-none">${note('info', M.raw ? `재질 클래스를 읽지 못했습니다. C-6처럼 적거나 위에서 고르세요. API 610 재질 클래스는 ${CODES.join(' · ')}입니다.` : '재질 클래스를 넣거나 고르면 판별 볼팅이 나옵니다.', '입력')}</div>`;
    const P = M.P, [tg, tl] = ST[P.status] || ST.confirm, eq = P.status === 'engineer-quote', wet = st.part === 'wetted', b = P.bolting;
    let main, sub = '', lab = '볼팅 ASTM 규격·등급';
    if (eq) { main = '등급을 자동으로 정하지 않습니다'; sub = '엔지니어가 펌프 데이터시트·PO의 볼팅 재질을 확인한 뒤 회신합니다.'; }
    else {
      main = wet ? astm(b.wetted) : `${astm(b.stud)} / ${astm(b.nut)}`;
      sub = wet ? (b.stud ? `케이싱·글랜드 스터드 ${astm(b.stud)} / ${astm(b.nut)}` : '') : b.wetted ? `접액 볼트 ${astm(b.wetted)}` : '';
      if (b.assumed) lab = '참고 값 · 11판·12판 공통, 판이 확인되면 확정';
      else if (st.ed === '8th') lab = '8판 · 자료 확인 중';
    }
    const ed = st.ed ? `<span class="val">${edKo(st.ed)}${ED_YR[st.ed] ? ` <span class="a6-yr">${ED_YR[st.ed]}</span>` : ''}</span><span class="sub">${srcTag(st.ed)}</span>` : `<span class="val">판 미확인</span><span class="sub">아래 판별 비교를 보세요</span>`;
    return `<div class="tblock a6-tb">
      <div><span class="lab">재질 클래스 Class</span><span class="big">${esc(M.cls)}${M.rp && M.rp.suffix ? `<small> ${esc(M.rp.suffix)}</small>` : ''}</span><span class="sub">${esc(M.C ? M.C.desc : '')}</span></div>
      <div class="m-e"><span class="lab">판 Edition</span>${ed}</div>
      <div><span class="lab">부위 · 사용 조건</span><span class="val">${label(PARTS, st.part)}</span><span class="sub">${label(SVCS, st.svc)}${lowSvc(st.svc) && M.mdmt != null ? ` · MDMT ${M.mdmt} °C` : ''}</span></div>
      <div class="e"><span class="lab">판정</span><span class="val"><span class="tag ${tg}">${tl}</span></span><span class="sub">${esc(P.why || (P.status === 'mapped' ? '확인된 표 값을 그대로 씁니다.' : ''))}</span></div>
      <div class="s4 e lr a6-ans"><span class="lab">${lab}</span><span class="a6-spec${eq ? ' no' : ''}">${esc(main)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</div>
    </div>`;
  };

  // 판단 주석: 판 상태 · 문구에서 읽은 것 · 사용 조건
  const notesOf = M => {
    const out = [], P = M.P, rp = M.rp, cls = M.cls, ed = st.ed;
    if (M.all.length > 1) out.push(['info', `문구에 클래스가 ${M.all.length}개 있습니다(${M.all.join(', ')}). 첫 번째 ${cls}로 봅니다. 줄마다 따로 확인합니다.`]);
    if (rp && rp.editionNote) out.push(['info', rp.editionNote]);
    if (rp && (rp.editionSource === 'conflict' || /^iso/.test(rp.editionSource || '')) && rp.why) out.push(['warn', `${rp.why}. 판을 정하지 않고 비교표로 봅니다.`]);
    if (rp && rp.edition && rp.edition !== ed) out.push(['info', `문구에는 ${edKo(rp.edition)}이 적혀 있지만 위에서 고른 ${ed ? edKo(ed) : '판 모름'}으로 봅니다.`]);
    (rp && rp.caveats || []).filter(c => /비금속 마모부|저온 변형/.test(c)).forEach(c => out.push(['info', c]));
    if (rp && rp.gradeMismatch) out.push(['info', `문구의 등급 ${rp.gradeMismatch.stated}은 표 기본값(${astm(rp.gradeMismatch.table)})과 다릅니다. 구매자가 지정한 등급이면 그대로 견적합니다.`]);
    if (!ed) {
      // 판 표기가 모호한 경우(M.amb)는 위 주석 하나로 충분하다
      const a = rowOf('11th', cls), b = rowOf('12th', cls), same = a.state === 'ok' && b.state === 'ok' && a.stud === b.stud && a.nut === b.nut;
      if (M.amb) { /* 없음 */ }
      else if (same && P.status !== 'engineer-quote') out.push(['info', '판이 정해지지 않아 등급을 확정하지 않습니다. 판이 확인되면 이 값으로 확정합니다.']);
      else out.push(['warn', '판이 정해지지 않았습니다. 데이터시트나 PO의 API 610 판과 볼팅 재질을 알려 주세요.']);
    } else if (M.row.state === 'removed') out.push(['warn', `${edKo(ed)}에서는 ${cls} 클래스가 빠졌습니다. 이전 판으로 산 펌프라면 판을 다시 확인해 주세요.`]);
    else if (NOAUTO.includes(ed) || M.row.state === 'nodata') out.push(['warn', `${edKo(ed)} 재질 클래스별 볼팅 자료는 확인 중이라 등급을 자동으로 정하지 않습니다. 펌프 데이터시트·PO의 볼팅 재질을 확인해 회신합니다.`]);
    else if (M.row.state === 'absent') out.push(['warn', `${edKo(ed)} 자료에는 ${cls}가 없습니다. 엔지니어가 확인합니다.`]);
    if (st.svc === 'sour') out.push(['info', '사워 서비스 볼팅의 경도 제한과 노출 판정은 구매자 사양(NACE MR0175/ISO 15156 또는 MR0103)으로 확인합니다.']);
    if (lowSvc(st.svc)) out.push(['warn', 'MDMT와 충격시험 기준을 알려 주시면 그 온도에 맞는 등급을 검토합니다.']);
    if (st.svc === 'hf') out.push(['warn', 'HF 서비스 볼팅은 구매자 사양으로 확인합니다.']);
    return out;
  };

  // 부품표: 번호 원 | 부위 | ASTM 규격·등급 | 재질·근거  (고른 판에 자료가 있을 때)
  const partsHTML = M => {
    const C = M.row.C, E = API610.editions[st.ed], wet = st.part === 'wetted';
    const rows = [['케이싱·글랜드 스터드', C.studs, !wet], ['너트', C.nuts, !wet], [C.other?.part || '접액 체결구', C.other, wet]];
    return `<div class="stack"><h3 class="nl-h">부품표 · 일반 조건 <small>${esc(edKo(st.ed))} · ${esc(E.source || '')}</small></h3>${st.svc !== 'general' ? `<p class="small muted">고른 사용 조건(${esc(label(SVCS, st.svc))})에서는 아래 사용 조건별 볼팅이 이 표보다 먼저입니다.</p>` : ''}
      <div class="tblw"><table class="tbl mstack a6-pl"><thead><tr><th>번호</th><th>부위</th><th>ASTM 규격·등급</th><th>재질 · 근거</th></tr></thead><tbody>
      ${rows.map(([nm, x, on], i) => `<tr${on ? ' class="hot"' : ''}><td class="no"><span class="ball" aria-hidden="true">${i + 1}</span></td><td data-l="부위"><b>${esc(nm)}</b></td>
        <td class="mono a6-g" data-l="ASTM 규격·등급">${x && x.astm ? esc(astm(x.astm)) : '<span class="redp">표에 ASTM 규격 없음</span>'}</td>
        <td data-l="재질 · 근거">${esc(x ? x.material || '' : '')}${x && x.alt ? `<span class="sub">대체: ${esc(x.alt)}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  };
  // 사용 조건별 (고른 판)
  const svcHTML = M => {
    const E = API610.editions[st.ed], MO = E.modifiers || {}, r = M.row;
    const stat = m => !m ? '' : m.status === 'engineer-quote' ? '<span class="tag warn">엔지니어 확인</span>' : m.status === 'confirm' ? '<span class="tag info">확인 필요</span>' : st.ed === '8th' ? '<span class="tag wait">관행 값</span>' : '<span class="tag a6-ok">표 값</span>';
    const rows = SVCS.map(([k, l]) => {
      if (k === 'general') return { k, l, v: r.stud ? `${astm(r.stud)} / ${astm(r.nut)}` : '표에 ASTM 규격 없음', w: '일반 사용 (위 부품표)', t: st.ed === '8th' ? '<span class="tag wait">관행 값</span>' : '<span class="tag a6-ok">표 값</span>' };
      const m = MO[k]; if (!m) return { k, l, v: '—', w: '이 판 자료에 없음', t: '' };
      const w = [m.when, m.wetted ? (/^접액/.test(m.wetted) ? m.wetted : `접액 볼팅: ${m.wetted}`) : '', m.practice ? `참고: ${m.practice.replace(/ASTM /g, '')}` : '', m.ask ? `확인할 것: ${m.ask}` : '', m.ref ? `근거 ${m.ref}` : ''].filter(Boolean);
      return { k, l, v: m.studs ? `${clean(m.studs)} / ${clean(m.nuts)}` : '표에 등급 없음', w: w.join('\n'), t: stat(m) };
    });
    return `<div class="stack"><h3 class="nl-h">사용 조건별 볼팅 <small>${esc(edKo(st.ed))} · 고른 조건은 칠한 줄</small></h3>
      <div class="tblw"><table class="tbl mstack a6-sv"><thead><tr><th>조건</th><th>스터드 / 너트</th><th>적용 범위 · 확인할 것</th><th>판정</th></tr></thead><tbody>
      ${rows.map(x => `<tr${x.k === st.svc ? ' class="hot"' : ''}><th scope="row">${esc(x.l)}</th><td class="mono a6-g" data-l="스터드 / 너트">${esc(x.v)}</td>
        <td data-l="적용 범위 · 확인할 것">${x.w.split('\n').map((s, i) => i ? `<span class="sub">${esc(s)}</span>` : esc(s)).join('')}</td><td data-l="판정">${x.t}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  };
  const leftHTML = M => {
    if (!M.cls) return '';
    const rp = M.rp, read = [];
    if (rp && !/^(?:CL(?:ASS)?\.?\s*)?[ISCAD]\s*-?\s*[1-9]$/i.test(M.raw)) {
      read.push(`<b class="mono">${esc(M.cls)}</b>`);
      if (rp.edition) read.push(edKo(rp.edition));
      if (rp.part === 'wetted') read.push('접액 볼트'); else if (rp.part !== 'unspecified') read.push('케이싱·글랜드 스터드');
      if (rp.service && rp.service !== 'general') read.push(label(SVCS, rp.service));
      if (rp.mdmtC != null) read.push(`MDMT ${rp.mdmtC} °C`);
    }
    return (read.length ? `<p class="small muted a6-read">문구에서 읽은 것: ${read.join(' · ')}</p>` : '')
      + `<div class="checks">${notesOf(M).map(([t, h]) => noteSm(t, esc(h))).join('')}</div>`
      + (M.known ? partsHTML(M) + svcHTML(M) : '');
  };
  const askHTML = M => {
    if (!M.cls) return '';
    const qs = [...(M.P.questions || [])];
    const mo = st.svc !== 'general' && API610.editions[st.ed || '12th']?.modifiers?.[st.svc];
    if (mo && mo.ask && !qs.some(q => q.includes(mo.ask))) qs.push(mo.ask);
    const list = [...new Set(qs)], eq = M.P.status === 'engineer-quote';
    return `<div class="stack"><h3 class="nl-h">확인할 것 <small>${list.length ? `${list.length}건 · 견적 전에 답을 받습니다` : '없음'}</small></h3>${list.length
      ? `<ul class="miss-l">${list.map(q => `<li><span class="miss-k">확인</span><span></span><span>${esc(q)}</span></li>`).join('')}</ul>` : ''}
      ${eq ? '<p class="small muted">펌프 데이터시트나 PO의 재질·볼팅 칸을 함께 보내 주시면 엔지니어 확인이 빨라집니다.</p>'
      : list.length ? '' : '<p class="small muted">이 조건에서는 따로 여쭐 것이 없습니다. 구매자 사양에 다른 등급이 적혀 있으면 그 등급이 먼저입니다.</p>'}</div>`;
  };

  // 판별 비교: 8판–13판. 판마다 다른 값 = 붉은 삼각형, 자료 없음 = 빗금
  const CMP_ROWS = [['stud', '케이싱·글랜드 스터드'], ['nut', '너트'], ['wetted', '접액 체결구'], ['sour', '사워 · 비접액 스터드 / 너트'], ['lowTemp', '저온 스터드 / 너트'], ['sourLowTemp', '사워 + 저온'], ['hf', 'HF (불산)']];
  const cellOf = (ed, cls, key) => {
    const r = rowOf(ed, cls);
    if (r.state === 'nodata') return { k: 'nd', t: '자료 확인 중 — 엔지니어 확인' };
    if (r.state === 'removed') return { k: 'x', t: `${edKo(ed)}에서 삭제된 클래스` };
    if (r.state === 'notListed') return { k: 'x', t: '관행 자료에 없음' };
    if (r.state === 'absent') return { k: 'x', t: '이 판에 없음' };
    if (key === 'stud' || key === 'nut' || key === 'wetted') return r[key] ? { k: 'v', t: astm(r[key]) } : { k: 'n', t: '표에 ASTM 규격 없음' };
    const m = API610.editions[ed].modifiers?.[key];
    if (!m) return { k: 'n', t: '—' };
    if (m.studs) return { k: 'v', t: `${clean(m.studs)} / ${clean(m.nuts)}`, sub: m.when };
    return { k: 'n', t: '표에 등급 없음 → 엔지니어 확인', sub: m.practice ? `참고: ${m.practice.replace(/ASTM /g, '')}` : '' };
  };
  const cmpHTML = M => {
    if (!M.cls) return '';
    let difN = 0;
    const body = CMP_ROWS.map(([key, nm]) => {
      const cells = EDS.map(ed => ({ ed, ...cellOf(ed, M.cls, key) }));
      const dif = new Set(cells.filter(c => c.k !== 'nd').map(c => c.t)).size > 1;
      if (dif) difN++;
      return `<tr><th scope="row">${esc(nm)}</th>${cells.map(c => `<td class="${[c.k === 'nd' ? 'hatch nd' : '', dif && c.k !== 'nd' ? 'dif' : '', c.ed === st.ed ? 'on' : ''].filter(Boolean).join(' ')}">${dif && c.k !== 'nd' ? '<i class="a6-tri" aria-hidden="true"></i><span class="sr">판마다 다름: </span>' : ''}<span class="a6-v">${esc(c.t)}</span>${c.sub ? `<span class="sub">${esc(c.sub)}</span>` : ''}</td>`).join('')}</tr>`;
    }).join('');
    const open = st.cmp != null ? st.cmp : !M.known;
    const head = EDS.map(ed => `<th scope="col"${ed === st.ed ? ' class="on"' : ''}><b>${edKo(ed)}${ED_YR[ed] ? ` <span class="a6-yr">${ED_YR[ed]}</span>` : ''}</b>${srcTag(ed)}</th>`).join('');
    return `<details class="acc first a6-cmp"${open ? ' open' : ''}><summary><span>판별 비교 · 8판–13판 <small>${difN ? `판마다 다른 줄 ${difN}개` : '자료가 있는 판에서는 모두 같음'}</small></span></summary>
      <div class="tblw a6-cw"><table class="tbl a6-ct"><caption class="sr">API 610 ${esc(M.cls)} 판별 볼팅 비교. 붉은 삼각형은 판마다 다른 값, 빗금 칸은 자료 없음.</caption>
      <thead><tr><th scope="col">${esc(M.cls)}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="a6-leg"><span><i class="a6-tri" aria-hidden="true"></i>판마다 다른 값</span><span><i class="a6-sw hatch" aria-hidden="true"></i>자료 확인 중 — 엔지니어 확인 (값을 자동으로 정하지 않음)</span><span class="only-m">표는 옆으로 밀어 봅니다.</span></p></details>`;
  };

  // 주기 + 고른 판의 볼팅 조항
  const NOTES = [
    'API 610 재질 클래스별 볼팅 자료는 공개 출처로 확인 중이라 이 도구는 등급을 자동으로 정하지 않습니다. 구매자 데이터시트와 PO 사양이 늘 먼저입니다.',
    'API 610 12판은 2021년 1월에 나왔고, 12판에서 I-1·I-2·S-1·S-3 클래스가 빠졌습니다. 13판은 2026년 6월에 나온 현행판입니다.',
    '사워 서비스에서 경도 제한을 적용할지, NACE MR0103과 MR0175(ISO 15156) 가운데 무엇을 따를지, 볼팅이 "노출"인지는 구매자가 정합니다.',
    '성적서가 필요하면 주문할 때 적어 주세요. 기본 서류는 볼트노트 CoC(적합 확인서, ISO 16228 F2.1 형식)이고, EN 10204 3.1은 제조사가 발행한 것을 고치지 않고 그대로 전달합니다.',
    '펌프 재질 클래스는 펌프 부품에만 해당합니다. 배관 플랜지 볼팅(ASME B16.5)과 섞이지 않게 BOM에서 부위를 확인합니다.',
    '판은 판 번호·연도 표기로만 가립니다. 표 번호나 문서 개정 번호로는 판을 짐작하지 않습니다.',
  ];
  const notesHTML = M => {
    if (!M.cls) return '';
    const own = M.known ? (M.row.C.notes || []).map(n => `${M.cls} · ${edKo(st.ed)}: ${n}`) : [];
    const gen = [...NOTES];
    const E = st.ed ? API610.editions[st.ed] : null, rules = E && (E.rules || []).filter(r => r.ref && r.ref !== '—');
    const right = !st.ed ? '<p class="small muted">판별 조항 요약은 공개 출처로 확인 중이라 싣지 않습니다.</p>'
      : !rules || !rules.length ? `<p class="small muted">${edKo(st.ed)} 조항 요약은 공개 출처로 확인 중이라 싣지 않습니다.</p>`
      : `<details class="acc first a6-rl"${st.rules ? ' open' : ''}><summary><span>조항 ${rules.length}건 펼쳐 보기 <small>나사 · 최소 지름 · 각인 · 사워 · 저온 · 성적서</small></span></summary>
        <dl class="kv a6-rules">${rules.map(r => `<dt>${esc(r.ref)}</dt><dd>${esc(r.rule)}</dd>`).join('')}</dl><p class="small muted a6-rc">'번호 추정'은 문단 순서로 짐작한 조항 번호입니다. 문장은 원문을 옮긴 것이 아니라 요지를 정리한 것입니다.</p></details>`;
    return `<div class="cols c-7-5 a6-bot"><div class="stack"><h3 class="nl-h">주기 <small>이 표를 쓸 때 지킬 것</small></h3><ol class="nl">${[...own, ...gen].map(n => `<li>${esc(n)}</li>`).join('')}</ol></div>
      <div class="stack"><h3 class="nl-h">볼팅 조항 <small>${st.ed ? esc(edKo(st.ed)) : '판 미확인'}</small></h3>${right}</div></div>`;
  };

  const a6View = () => {
    const M = model();
    return `<div class="a6" id="a6">
      <p class="a6-lead">펌프 데이터시트나 BOM에 'API 610 C-6'처럼 재질 클래스만 적혀 있을 때, 클래스와 판(edition)을 읽어 견적 질문을 정리합니다. 클래스별 볼팅 자료는 확인 중이라 등급은 엔지니어가 확인합니다.</p>
      ${formHTML(M)}
      <p class="sr" id="a6-live" aria-live="polite"></p>
      <div id="a6-tb">${tbHTML(M)}</div>
      <div class="cols c-7-5 a6-mid"><div class="stack lg" id="a6-l">${leftHTML(M)}</div><div class="stack lg"><div id="a6-ask">${askHTML(M)}</div>${bomHTML(M)}</div></div>
      <div id="a6-cmp">${cmpHTML(M)}</div>
      <div id="a6-nt">${notesHTML(M)}</div>
    </div>`;
  };

  /* ── 다시 그리기 ── */
  const line = M => {
    const L = bomLineOf(M), out = $('a6-line');
    if (out) out.textContent = L ? L.text : '';
    document.querySelectorAll('#a6 [data-a6-act]').forEach(b => { b.disabled = !L; });
    const qh = $('a6-qh'); if (qh) qh.textContent = st.part === 'wetted' ? '개수 (EA)' : '스터드 1개 + 너트 2개 = 1세트';
    return L;
  };
  const paint = () => {
    const M = model(), set = (id, h) => { const el = $(id); if (el) el.innerHTML = h; };
    set('a6-tb', tbHTML(M)); set('a6-l', leftHTML(M)); set('a6-ask', askHTML(M)); set('a6-cmp', cmpHTML(M)); set('a6-nt', notesHTML(M));
    const pr = (sel, cur) => document.querySelectorAll(`#a6 [${sel}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(sel) === cur)));
    pr('data-a6-cls', M.cls || ''); pr('data-a6-ed', st.ed); pr('data-a6-pt', st.part); pr('data-a6-sv', st.svc);
    const md = $('a6-md'); if (md) { md.disabled = !lowSvc(st.svc); if (md.value !== st.mdmt) md.value = st.mdmt; }
    const live = $('a6-live'); if (live) live.textContent = M.cls ? `${M.cls} · ${edKo(st.ed)} · ${(ST[M.P.status] || ST.confirm)[1]}` : '재질 클래스를 읽지 못했습니다';
    line(M);
  };
  const setText = (t, reset) => {
    st.text = t;
    if (reset) Object.assign(st, { ed: '', part: 'stud', svc: 'general', mdmt: '' });
    const rp = t.trim() ? parse(ctxText(t.trim())) : null; if (rp) syncFrom(rp);
    const inp = $('a6-in'); if (inp && inp.value !== t) inp.value = t;
  };

  /* ── BOM에 넣기 / 복사 ── */
  const toBom = () => {
    const L = bomLineOf(model()), msg = $('a6-msg');
    if (!L) return;
    const B = state.bom, ok = B && typeof B === 'object' && typeof bomSave === 'function' && typeof V.bom === 'function' && typeof SHEETS !== 'undefined' && SHEETS.bom;
    if (!ok) {
      try { sessionStorage.setItem('bn.a6.line', L.text); } catch {}
      if (msg) msg.textContent = 'BOM 견적 장이 없어 문구만 만들었습니다. 복사해서 쓰세요.';
      return;
    }
    const cur = String(B.text || '');
    if (B.sample || !cur.trim()) B.text = L.text;
    else {
      let r = null; try { r = typeof bomRows === 'function' ? bomRows(cur, B.map) : null; } catch { r = null; }
      if (r && (r.mode === 'tsv' || r.mode === 'csv') && Array.isArray(r.roles) && r.roles.length) {
        // 표 BOM: 같은 열 배치로 한 행을 만든다 (품명 칸에 문구, 수량·단위·번호 칸에 값)
        const d = r.delim || '\t', cells = Array(r.roles.length).fill(''), at = k => r.roles.indexOf(k);
        let di = at('desc'); if (di < 0) di = at('pn'); if (di < 0) di = 0;
        cells[di] = L.desc;
        if (L.qty) { if (at('qty') >= 0) cells[at('qty')] = String(L.qty); else cells[di] = L.text; }
        if (L.qty && at('unit') >= 0) cells[at('unit')] = L.unit;
        if (at('no') >= 0 && at('no') !== di) cells[at('no')] = String((r.rows || []).length + 1);
        const q = c => d !== '\t' && /[",;\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
        B.text = cur.replace(/\s+$/, '') + '\n' + cells.map(q).join(d);
      } else B.text = cur.replace(/\s+$/, '') + '\n' + L.text;
    }
    B.sample = false; B.open = null; B.filter = 'all';
    bomSave();
    toast(`BOM 끝에 한 줄을 넣었습니다 → ${bomNo()}장`);
    go('bom');
  };
  const copy = () => {
    const L = bomLineOf(model()), el = $('a6-line'); if (!L || !el) return;
    const fail = () => { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('복사가 막혀 있어 문구를 선택해 두었습니다'); };
    try { navigator.clipboard.writeText(L.text).then(() => toast('BOM 문구를 복사했습니다'), fail); } catch { fail(); }
  };

  /* ── 이벤트 (document에 위임) ── */
  let tmr = 0;
  const onInput = e => {
    const t = e.target; if (!t || !t.closest || !t.closest('#a6')) return;
    if (t.id === 'a6-in') { if (e.type !== 'input') return; clearTimeout(tmr); tmr = setTimeout(() => { setText(t.value, false); save(); paint(); }, 160); return; }
    if (t.id === 'a6-md') { st.mdmt = t.value.trim().replace(/^[−–]/, '-'); save(); clearTimeout(tmr); tmr = setTimeout(paint, 200); return; }
    if (t.id === 'a6-sz') { st.size = t.value; const u = /^\s*M\d/i.test(t.value) ? 'mm' : /\d/.test(t.value) ? 'in' : st.unit; if (u !== st.unit) { st.unit = u; document.querySelectorAll('#a6 input[name="a6-unit"]').forEach(x => { x.checked = x.value === u; }); } }
    else if (t.id === 'a6-len') st.len = t.value;
    else if (t.id === 'a6-qty') st.qty = t.value;
    else if (t.name === 'a6-unit') st.unit = t.value === 'mm' ? 'mm' : 'in';
    else return;
    save(); line(model());
  };
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#a6 button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.a6Ex != null) setText(d.a6Ex, true);
    else if (d.a6Cls) setText(d.a6Cls, false);
    else if (d.a6Ed != null) { st.ed = d.a6Ed; st.cmp = null; }
    else if (d.a6Pt) st.part = d.a6Pt;
    else if (d.a6Sv) st.svc = d.a6Sv;
    else if (d.a6Act === 'bom') { toBom(); return; }
    else if (d.a6Act === 'copy') { copy(); return; }
    else return;
    save(); paint();
  });
  document.addEventListener('toggle', e => {
    const c = e.target && e.target.classList; if (!c) return;
    if (c.contains('a6-cmp')) st.cmp = e.target.open; else if (c.contains('a6-rl')) st.rules = e.target.open;
  }, true);

  /* ── 등록: 5장 탭 · 검색 ── */
  TABS.push(['api610', TITLE, 'API 610']);
  TOOL.api610 = a6View;
  if (typeof INDEX !== 'undefined') INDEX.push({ t: TITLE, s: 'C-6 · S-6 · A-8 · D-1 재질 클래스 · 판 읽기', k: ['api 610 api610 iso 13709 펌프 pump 재질 클래스 material class matl 케이싱 글랜드 스터드 casing gland stud 접액 wetted 사워 저온 hf edition 판', ...CODES, ...CODES.map(c => c.replace('-', ''))].join(' ').toLowerCase(), go: 'tools', tab: 'api610', g: '도구·안내' });
  // 머리글 검색에서 이 도구를 고르면, 검색어(클래스·판이 들어 있으면)를 그대로 넘겨 받는다
  const fromSearch = v => { if (/610|13709|(?<![A-Z0-9])[ISCAD]\s*-?\s*[1-9](?![0-9])/i.test(v || '')) { setText(String(v).trim(), true); save(); } };
  const sug = $('suggest'), qIn = $('q');
  if (sug && qIn) {
    sug.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-i]'); if (b && b.textContent.includes(TITLE)) fromSearch(qIn.value); }, true);
    qIn.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const on = sug.querySelector('button.on'), hit = on ? on.textContent.includes(TITLE) : typeof search === 'function' && (search(qIn.value)[0] || {}).t === TITLE;
      if (hit) fromSearch(qIn.value);
    });
  }
})();
