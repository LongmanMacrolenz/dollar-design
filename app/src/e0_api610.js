/* API 610 재질 클래스 표기 읽기 (판별 틀)
 * 2026-10 감사 (INTEGRATE F): Annex H 재질 클래스 → 볼팅 매핑, 각주·주석, 판별 수정 규칙, 조항 요약은 공개 출처로 확인되지 않아 모두 뺐다.
 *   남긴 사실 (공개 자료): 12판 2021년 1월 발행 · 12판에서 I-1·I-2·S-1·S-3 클래스 삭제 · 13판 2026년 6월 발행(현행판).
 *   자료를 다시 채울 때는 같은 모양(classes · modifiers · rules)으로 넣으면 판별(parseApi610)과 도구(t_api610.js)가 그대로 쓴다.
 * classes가 비어 있는 판은 '자료 확인 중'이라 볼팅 등급을 자동으로 정하지 않는다 (엔지니어 확인).
 */
const API610_NODATA = { year: null, iso: null, source: '자료 확인 중', status: '자료 확인 중', classes: {}, rules: [] };
const API610 = {
  editions: {
    '8th': { ...API610_NODATA },
    '9th': { ...API610_NODATA },
    '10th': { ...API610_NODATA },
    '11th': { ...API610_NODATA },
    '12th': { ...API610_NODATA, year: '2021 (1월 발행)', removed: ['I-1', 'I-2', 'S-1', 'S-3'] },
    '13th': { ...API610_NODATA, year: '2026 (6월 발행, 현행판)' }
  }
};

/* 파싱용 별칭 (함수 없음, 데이터만) */
const API610_ALIASES = {
  context: /API\s*(?:STD\.?|STANDARD)?\s*-?\s*610|ISO\s*13709/i,
  normalize: [
    [/[\u2010-\u2015\u2212]/g, '-'], // 각종 대시·마이너스 → '-'
    [/(API\s*(?:STD\.?\s*)?-?\s*610)(?=[A-Z가-힣])/gi, '$1 '], // 'API610C6' → 'API610 C6'
    [/MAT'L/gi, 'MATL']
  ],
  classCode: /(?<![A-Z0-9])(?:CL(?:ASS)?\.?\s*|MAT(?:ERIA)?L\.?\s*(?:CL(?:ASS)?\.?\s*)?)?([ISCAD])\s*-?\s*([1-9])(?![0-9])(C(?![A-Z0-9])|\s*LC[B23](?![A-Z0-9]))?/gi,
  validCodes: ['I-1', 'I-2', 'S-1', 'S-3', 'S-4', 'S-5', 'S-6', 'S-8', 'S-9', 'C-6', 'A-7', 'A-8', 'D-1', 'D-2'],
  codes: {
    I1: 'I-1', 'I-1': 'I-1', I2: 'I-2', 'I-2': 'I-2', S1: 'S-1', 'S-1': 'S-1', S3: 'S-3', 'S-3': 'S-3',
    S4: 'S-4', 'S-4': 'S-4', S5: 'S-5', 'S-5': 'S-5', S6: 'S-6', 'S-6': 'S-6', S8: 'S-8', 'S-8': 'S-8',
    S9: 'S-9', 'S-9': 'S-9', C6: 'C-6', 'C-6': 'C-6', A7: 'A-7', 'A-7': 'A-7', A8: 'A-8', 'A-8': 'A-8',
    D1: 'D-1', 'D-1': 'D-1', D2: 'D-2', 'D-2': 'D-2'
  },
  examples: { // 원문 표기 → 정규 코드
    'C6': 'C-6', 'C-6': 'C-6', 'C 6': 'C-6', 'CL C-6': 'C-6', 'CL.C6': 'C-6', 'CLASS C-6': 'C-6', 'MATL C-6': 'C-6',
    'MATL CLASS C-6': 'C-6', 'API610 C6 MATL': 'C-6', 'API 610 C-6 MATL': 'C-6', 'API610 C-6 재질': 'C-6',
    'S6': 'S-6', 'S-6': 'S-6', 'API610 S-6 재질': 'S-6', 'S-5C': 'S-5', 'S-4 LCB': 'S-4'
  },
  codeSuffix: {},   // 2026-10 감사: 접미사(C, LCB 등)의 뜻은 공개 출처로 확인되지 않아 해석하지 않는다
  editionPatterns: [
    { by: 'number', re: /(?<![0-9])(8|9|10|11|12|13)\s*(?:ST|ND|RD|TH)?\s*\.?\s*ED(?:ITION|N)?\.?(?![A-Z])/i },
    { by: 'number', re: /\bED(?:ITION|N)?\.?\s*(?:NO\.?\s*)?(8|9|10|11|12|13)(?![0-9])/i },
    { by: 'number', re: /(?<![0-9])(?:제\s*)?(8|9|10|11|12|13)\s*판(?!매)/ },
    { by: 'word', re: /\b(EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|THIRTEENTH)\b/i },
    { by: 'year', re: /API\s*(?:STD\.?\s*)?-?\s*610\s*[-:\/(,]?\s*((?:19|20)\d{2})(?![0-9])/i },
    { by: 'iso', re: /ISO\s*13709\s*[:\-]\s*(2003|2009)/i }
  ],
  editionNumber: { 8: '8th', 9: '9th', 10: '10th', 11: '11th', 12: '12th', 13: '13th' },
  editionWords: { EIGHTH: '8th', NINTH: '9th', TENTH: '10th', ELEVENTH: '11th', TWELFTH: '12th', THIRTEENTH: '13th' },
  editionYears: { 2021: '12th', 2026: '13th' },            // 공개 자료로 확인한 연도만 (12판 2021년 1월, 13판 2026년 6월)
  yearNote: { 2026: '13판 (2026년 6월 발행, 현행판)' },
  isoEditions: {},                                          // ISO 13709 연도 ↔ API 610 판 대응은 확인 중
  noAutoMap: ['8th', '9th', '10th', '11th', '12th', '13th'], // 재질 클래스 볼팅 자료 확인 중: 어느 판도 자동 매핑하지 않음
  keywords: {
    sour: /SOUR|WET\s*H2S|H2S|NACE|MR\s*-?\s*0103|MR\s*-?\s*0175|15156|사워|황화수소/i,
    lowTemp: /LOW[\s-]*TEMP|CRYO|MDMT|저온|극저온|A320|\bL7M?\b|\b7M?L\b/i,
    hf: /\bHF\b|HYDROFLUORIC|HF\s*ALKY|불산|불화수소/i,
    temp: /(?:^|[\s(=:])(-\s?\d{1,3}(?:\.\d)?)\s*(?:°\s*|DEG\.?\s*)([CF])(?![A-Z])|(?:^|[\s(=:])(-\s?\d{1,3})\s*℃|(?:^|[\s(=:])(-\d{1,3})([CF])(?![A-Z0-9])/i
  },
  parts: {
    stud: /STUD|스터드|GLAND|글랜드|CASE\s*BOLT|CASING/i,
    nut: /\bNUTS?\b|너트/i,
    wetted: /WETTED|INTERNAL|IMPELLER|BOWL|DIFFUSER|SOCKET|CAP\s*SCREW|SHCS|F837|접액|내부/i,
    bolt: /BOLT(?:ING)?|볼트|SCREW/i
  },
  explicitGrade: /\b(?:A\s*193\s*(?:GR\.?\s*)?(B7M?|B8M?|B6|B16)|A\s*320\s*(?:GR\.?\s*)?(L7M?|L43)|A\s*194\s*(?:GR\.?\s*)?(2HM?|7M?L?|8M?|6)|F\s*837)\b/gi,
  tableRef: /TABLE\s*H[.\-]\s*([1-4])/i // 판 판별에 쓰지 않음
};

/* ── API 610 표기 읽기: parseApi610(text) ──
   BOM 한 줄이나 RFQ 머리('API 610 C-6', 'API610 12th S-6', 'Class S-5 per API 610 11th')에서 재질 클래스·판(edition)을 읽는다.
   'API 610'·'ISO 13709' 문맥이 없으면 null (문맥 없는 'S6'·'C6'은 클래스로 읽지 않음).
   판이 없으면 판을 가정하지 않는다: edition null. 재질 클래스 볼팅 자료가 비어 있는 동안(2026-10 감사)은 클래스가 읽혀도 status 'engineer-quote'.
   반환 { std, cls, suffix, edition, editionSource, editionNote, part, service, mdmtC, status, why,
          bolting: { stud, nut, wetted, assumed, basis }, perEdition[], explicit[], questions[], caveats[] }
   status: 'mapped' (판 확인, 표 그대로) · 'confirm' (확인 1건 이상) · 'engineer-quote' (자동 매핑 안 함) · 'context' (클래스 없이 API 610만 적힘) */
const API610_EDS = ['8th', '9th', '10th', '11th', '12th', '13th'];
const api610EdKo = ed => ed ? ed.replace(/(st|nd|rd|th)$/, '') + '판' : '판 미기재';
// 판·클래스 하나의 볼팅 행. state: ok · nodata(자료 확인 중) · removed(그 판에서 삭제) · notListed · absent
function api610Row(ed, cls) {
  const E = API610.editions[ed];
  if (E && (E.removed || []).includes(cls)) return { ed, state: 'removed' };
  if (!E || !Object.keys(E.classes || {}).length) return { ed, state: 'nodata', note: E ? E.status : '자료 없음' };
  if ((E.notListed || []).includes(cls)) return { ed, state: 'notListed' };
  const C = E.classes[cls];
  if (!C) return { ed, state: 'absent' };
  return { ed, state: 'ok', stud: C.studs?.astm ?? null, nut: C.nuts?.astm ?? null, wetted: C.other?.astm ?? null, ask: C.ask || null, desc: C.desc };
}
function parseApi610(text) {
  const A = API610_ALIASES;
  let U = String(text ?? '').normalize('NFKC').toUpperCase();
  for (const [re, to] of A.normalize) U = U.replace(re, to);
  if (!A.context.test(U)) return null;
  const out = { std: 'API 610', raw: String(text ?? '').trim(), cls: null, suffix: null, edition: null, editionSource: null, editionNote: '', part: 'unspecified', service: 'general', mdmtC: null,
    status: 'context', why: null, bolting: { stud: null, nut: null, wetted: null, assumed: false, basis: null }, perEdition: [], explicit: [], questions: [], caveats: [] };
  // 클래스 (validCodes에 있는 것만: A2-70·C4-70·S31803·A193 같은 표기는 걸러짐)
  const cls = [];
  for (const m of U.matchAll(A.classCode)) {
    const code = `${m[1].toUpperCase()}-${m[2]}`;
    if (!A.validCodes.includes(code)) continue;
    if (!cls.includes(code)) cls.push(code);
    if (m[3] && !out.suffix) out.suffix = m[3].trim();
  }
  // 판 후보: 번호·서수('12TH')·단어·연도·ISO 13709
  const cand = []; let isoAmb = null;
  for (const p of A.editionPatterns) {
    const m = U.match(p.re); if (!m) continue;
    if (p.by === 'number') cand.push({ ed: A.editionNumber[+m[1]], by: 'number' });
    else if (p.by === 'word') cand.push({ ed: A.editionWords[m[1].toUpperCase()], by: 'word' });
    else if (p.by === 'year') { const ed = A.editionYears[m[1]]; if (ed) cand.push({ ed, by: 'year', year: +m[1] }); else out.caveats.push(`연도 ${m[1]}은(는) 판으로 바꿀 수 없습니다.`); }
    else if (p.by === 'iso') { const eds = A.isoEditions[m[1]] || []; if (eds.length === 1) cand.push({ ed: eds[0], by: 'iso' }); else isoAmb = eds; }
  }
  const ord = U.match(/(?<![0-9])(8|9|10|11|12|13)\s*(?:ST|ND|RD|TH)(?![A-Z])/);
  if (ord) cand.push({ ed: A.editionNumber[+ord[1]], by: 'number' });
  const eds = [...new Set(cand.map(c => c.ed).filter(Boolean))];
  if (eds.length === 1 && !isoAmb) {
    const c = cand.find(x => x.ed === eds[0]);
    out.edition = eds[0]; out.editionSource = c.by;
    if (c.year && A.yearNote[c.year]) out.editionNote = `연도 ${c.year} → ${api610EdKo(eds[0])} (${A.yearNote[c.year]})`;
  } else if (eds.length > 1 || (isoAmb && eds.length)) {
    out.editionSource = 'conflict'; out.why = `판 표기 충돌 (${[...eds, ...(isoAmb || [])].map(api610EdKo).join(' / ')})`;
  } else if (isoAmb) { out.editionSource = 'iso-ambiguous'; out.why = 'ISO 13709 연도 표기만으로는 API 610 판을 정할 수 없음'; }
  // 부위·사용 조건·직접 적힌 등급
  const P = A.parts, K = A.keywords;
  out.part = P.wetted.test(U) ? 'wetted' : P.stud.test(U) ? 'stud' : P.nut.test(U) ? 'nut' : 'unspecified';
  const sour = K.sour.test(U), low = K.lowTemp.test(U), hf = K.hf.test(U);
  out.service = hf ? 'hf' : sour && low ? 'sourLowTemp' : sour ? 'sour' : low ? 'lowTemp' : 'general';
  const t = U.match(K.temp);
  if (t) { const v = parseFloat((t[1] || t[3] || t[4]).replace(/\s/g, '')), u = t[2] || t[5] || 'C'; out.mdmtC = Math.round(u.toUpperCase() === 'F' ? (v - 32) * 5 / 9 : v); }
  for (const m of U.matchAll(A.explicitGrade)) out.explicit.push(m[0].replace(/\s+/g, ' ').trim());
  out.caveats.push('API 610 재질 클래스별 볼팅 자료는 확인 중입니다. 펌프 데이터시트·PO의 볼팅 재질이 우선합니다.');
  if (!cls.length) return out;   // 'context': 클래스 없이 API 610 문맥만 (나사·최소 지름 규칙에 쓰임)
  out.cls = cls[0];
  out.perEdition = API610_EDS.map(ed => api610Row(ed, out.cls));
  const row = ed => out.perEdition.find(r => r.ed === ed);
  const NQ = why => { out.status = 'engineer-quote'; out.why = out.why || why; };
  if (cls.length > 1) NQ(`클래스 표기 ${cls.length}개 (${cls.join(', ')})`);
  if (out.editionSource === 'conflict' || out.editionSource === 'iso-ambiguous') NQ(out.why);
  let r = null;
  if (out.edition) {
    r = row(out.edition);
    if (r.state === 'removed') NQ(`${api610EdKo(out.edition)}에서 삭제된 클래스`);
    else if (A.noAutoMap.includes(out.edition) || r.state === 'nodata') NQ(`${api610EdKo(out.edition)} 재질 클래스 볼팅 자료 확인 중`);
    else if (r.state !== 'ok') NQ(`${api610EdKo(out.edition)} 자료에 없는 클래스`);
  } else if (out.status !== 'engineer-quote') {
    // 판 미기재: 11판·12판 자료가 모두 있고 값이 같을 때만 그 값으로 견적하고 판을 묻는다 (자료가 비어 있는 동안은 엔지니어 확인)
    const a = row('11th'), b = row('12th');
    if (a.state === 'ok' && b.state === 'ok' && a.stud === b.stud && a.nut === b.nut) { r = { ...a, ed: null }; out.bolting.basis = '11th=12th'; out.questions.push('API 610 판(edition)을 알려 주세요.'); }
    else NQ('재질 클래스 볼팅 자료 확인 중 (판 미기재)');
  }
  if (r && r.state === 'ok') {
    Object.assign(out.bolting, { stud: r.stud, nut: r.nut, wetted: r.wetted, assumed: !out.edition, basis: out.bolting.basis || out.edition });
    if (out.status !== 'engineer-quote') out.status = out.edition && out.edition !== '8th' && !out.editionNote.startsWith('2020') ? 'mapped' : 'confirm';
    if (out.part === 'wetted' ? !r.wetted : !r.stud) NQ('표에 볼팅 ASTM 규격이 없음');
    if (r.ask && out.status !== 'engineer-quote') { out.status = 'confirm'; out.questions.push(r.ask); }
  }
  // 사용 조건: 판별 수정 규칙(modifiers)이 있는 판만 그 값으로 바꾸고, 없으면 엔지니어 견적 (자료 확인 중)
  if (out.service !== 'general' && out.status !== 'engineer-quote') {
    const ed = out.edition || '12th', M = API610.editions[ed]?.modifiers?.[out.service];
    if (M?.studs) { Object.assign(out.bolting, { stud: M.studs, nut: M.nuts }); out.status = 'confirm'; if (M.ask) out.questions.push(`${M.ask}을(를) 확인해 주세요.`); }
    else NQ('사용 조건별 볼팅 자료 확인 중');
  }
  if (out.service !== 'general' && out.mdmtC != null) out.caveats.push(`설계 최저 온도(MDMT) ${out.mdmtC} °C로 읽었습니다.`);
  if (out.part === 'unspecified' && out.status !== 'engineer-quote') { out.status = 'confirm'; out.questions.push('케이싱·글랜드 스터드인가요, 접액(내부) 볼트인가요?'); }
  // 직접 적힌 등급은 구매자 지정으로 보고 기본값과 비교만 한다
  const want = out.part === 'wetted' ? out.bolting.wetted : out.bolting.stud;
  for (const g of out.explicit) {
    const code = g.match(/\b(B7M?|B8M?|B6|B16|L7M?|L43)\b/)?.[1];
    if (code && want && !new RegExp(`\\b${code}\\b`).test(want)) { if (out.status === 'mapped') out.status = 'confirm'; out.questions.push(`적힌 등급 ${g}이(가) API 610 ${out.edition ? api610EdKo(out.edition) + ' ' : ''}${out.cls} 기본(${want})과 다릅니다. 구매자 지정이면 그대로 견적합니다.`); out.gradeMismatch = { stated: g, table: want }; break; }
  }
  // 자동 매핑하지 않는 경우 표 값은 참고로만 남기고 bolting은 비운다
  if (out.status === 'engineer-quote') { out.reference = { stud: out.bolting.stud, nut: out.bolting.nut, wetted: out.bolting.wetted }; out.bolting = { stud: null, nut: null, wetted: null, assumed: false, basis: null }; }
  return out;
}

/* 엔진 연결: API 610 클래스에서 재질 코드 만들기 (재질이 적혀 있지 않은 스터드·너트만) */
const api610Code = astm => (String(astm || '').match(/^ASTM A(?:193|320) (B7M?|B8M?|B16|L7M?|L43)$/) || String(astm || '').match(/^ASTM A194 (2HM?|7M?L?|8M?)$/) || [])[1] || null;
function bomApi610Mat(api, type, mat, sub) {
  if (!api || !api.cls || api.status === 'engineer-quote' || api.part === 'wetted') return null;
  if (mat && !mat.def && !mat.specDefault) return null;   // 적힌 재질(구매자 지정)이 우선
  const stud = api610Code(api.bolting.stud), nut = api610Code(api.bolting.nut);
  const ed = api.edition ? `${api610EdKo(api.edition)}${api.edition === '8th' ? '(원문 미대조, 업계 일반 관행)' : ''} ` : '';
  const how = api.edition ? '재질 클래스 자료 기준' : '판 미기재, 판 확인 필요';
  if (type === 'stud' && stud) return { code: stud, stated: false, api610: true, nut: sub.nuts ? nut : null, nutDefault: false,
    api610Note: `API 610 ${ed}${api.cls} → ${api.bolting.stud.replace('ASTM ', '')}${sub.nuts && nut ? ' / ' + api.bolting.nut.replace('ASTM ', '') : ''} (${how})` };
  if (['nut', 'heavynut'].includes(type) && nut) return { code: nut, stated: false, api610: true, api610Note: `API 610 ${ed}${api.cls} → ${api.bolting.nut.replace('ASTM ', '')} (${how})` };
  return null;
}
/* API 610 문맥의 질문·이벤트 (bomDerive가 부른다). ask(text, rule, params)는 질문 문자열과 이벤트를 함께 쌓는다.
   2026-10 감사: API 610 조항(나사 계열, 압력 케이싱 최소 지름)에 기댄 질문은 공개 출처가 없어 뺐다 */
function bomApi610Ev(q, E, ask, Q) {
  const a = q.api610, ed = a.edition, p = { cls: a.cls, edition: ed };
  for (const t of a.questions) {
    const rule = /판\(edition\)|저작권 연도/.test(t) ? 'S-API610-ED' : /접액\(내부\) 볼트/.test(t) ? 'S-API610-PART' : /사워 서비스/.test(t) ? 'S-NACE-EXP' : /적힌 등급/.test(t) ? 'S-API610-GRADE' : 'S-API610-CHK';
    // 재질 가정(S-API610-ED)과 판 질문은 같은 일이라 이벤트를 하나만 둔다
    if (E.some(e => e.rule === rule)) Q.push(t); else ask(t, rule, p);
  }
  // 줄 재질이 적혀 있고 표 기본값과 다르면 (구매자 지정으로 보고 그대로 견적, 확인만)
  const tbl = api610Code(a.bolting.stud);
  if (q.type === 'stud' && q.mat && !q.mat.api610 && q.mat.stated && tbl && q.mat.code !== tbl && !a.gradeMismatch)
    ask(`적힌 재질 ${q.mat.label}이(가) API 610 ${ed ? api610EdKo(ed) + ' ' : ''}${a.cls} 기본(${a.bolting.stud})과 다릅니다. 구매자 지정이면 그대로 견적합니다.`, 'S-API610-GRADE', { ...p, mat: q.mat.code, table: tbl });
}

