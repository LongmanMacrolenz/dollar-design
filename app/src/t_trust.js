/* ── 볼트노트 신뢰·서류 모듈 (cad/trust_data.js, 양식 T1 · 2026-10-01) ──
   MTR(제조사 밀시트·재질성적서, EN 10204 3.1)·추적성·PMI 문구를 공급처 확인 플래그 하나에서 만든다.
   설계 문서: cad/trust.md. 배선(어느 화면의 어느 줄을 바꾸는지)은 trust.md §6.

   이 파일은 공개 사이트에 그대로 실린다.
   - 공급처 이름·연락처·단가·내부 메모를 넣지 않는다 (그 기록은 공급처 장부 artifact에만 둔다).
   - 경쟁사·제조사 이름을 넣지 않는다.

   규칙 (대표 결정 2026-10-01 · 품질 방침)
   1. 품목군마다 상태 'confirmed' | 'on-request' | 'unconfirmed'. 기본값은 모두 'unconfirmed'.
      공급처가 체크리스트(trust.md §4)에 답한 뒤 대표만 바꾼다.
   2. 'confirmed'·'on-request'는 근거(ev)가 있어야 화면에 나온다. 근거가 모자라면 한 단계 낮춰 보여 준다 (cadMtrState).
   3. 볼트노트는 EN 10204 3.1을 발행하지 않는다. 제조사 3.1을 받은 그대로(수정 없이) 전달한다.
      볼트노트 문서는 CoC(ISO 16228 F2.1 형식, 시험값 없음)뿐. 3.2·KOLAS 시험은 요청 시 협의.
   4. PMI나 성분 확인을 '끝냈다'고 표시하는 배지는 없다. PMI(XRF)는 외부 시험기관 의뢰 서비스로, 별도 플래그 pmi.enabled(기본 false) 뒤에 둔다.
   이름: 최상위 이름은 모두 CAD_MTR / CAD_TRUST_ / cadMtr / cadTrust 로 시작한다 (base·src와 겹치지 않음). */

/* ───────── 1. 플래그: CAD_MTR는 base.html (MTR_STATE·PMI_ON 바로 위)에 있다. 한 곳에서만 고친다 ───────── */
// 근거 키 (trust.md §4 체크리스트의 답과 1:1)
const CAD_MTR_OK = {
  finished: '완성품(볼트·너트)의 시험 결과가 실린 제조사 문서 — 히트 화학성분 + 완성품 기계적 시험, 제조부서와 독립된 검사 책임자 서명',
  unaltered: '제조사 상호가 보이는 문서를 수정·가림 없이 고객에게 전달해도 됨 (원본 또는 사본, 원본은 요청 시 확인 가능)',
  perlot: '납품하는 히트·로트마다 그 로트의 문서 (대표 성적서·과거 로트 성적서가 아님)',
  heat: '히트(또는 로트) 번호가 제품 마킹이나 포장 라벨에 있어 문서와 대조됨',
  written: '답을 서면(메일·견적서)으로 받았고, 그 공급처의 실제 성적서 견본(가림 처리본 가능)을 대표가 보고 위 항목을 확인함',
  hard100: '전수 경도시험 기록 (B7M·L7M 볼트·스터드)',
  impact: '샤르피 충격시험 결과가 MTR에 기재 (A320 L7·L7M·L43, A194 7L·7M + 저온 충격시험)',
  rotcap: '아연도금 구조용 볼트 세트의 로트별 회전능력 시험 결과',
};
const CAD_MTR_NEED = { 'on-request': ['finished', 'unaltered'], confirmed: ['finished', 'unaltered', 'perlot', 'heat', 'written'] };

/* ───────── 2. 품목군 ───────── */
const CAD_MTR_GROUPS = [
  { id: 'astm', ko: 'ASTM 합금강 스터드·너트', short: 'B7·B7M 스터드·2H 너트', en: 'ASTM alloy steel studs and nuts', plant: true, scope: 'A193 B7·B7M · A194 2H·2HM·7·7M · ASME B18.31.2 스터드' },
  { id: 'lowtemp', ko: '저온·극저온 볼팅', short: 'A320 저온 볼팅', en: 'Low-temperature bolting', plant: true, scope: 'A320 L7·L7M·L43·B8·B8M · A194 7L·7M + 저온 충격시험' },
  { id: 'hightemp', ko: '고온 볼팅', short: 'B16·A453 고온 볼팅', en: 'High-temperature bolting', plant: true, scope: 'A193 B16 · A453 660 · A194 7·16' },
  { id: 'stainless', ko: '스테인리스 볼팅', short: '스테인리스 볼팅', en: 'Stainless steel fasteners', plant: true, scope: 'ISO 3506 A2·A4 · A193 B8·B8M · A194 8·8M · F593·F594·F837·F879·F880 · 6Mo·수퍼듀플렉스' },
  { id: 'nickel', ko: '니켈합금 볼팅', short: '니켈합금 볼팅', en: 'Nickel alloy fasteners', plant: true, scope: 'F468·F467 (Ni 400·500·625·C-276)' },
  { id: 'structural', ko: '구조용 볼트', short: '구조용 볼트 (F3125·F1554·A354)', en: 'Structural bolting', plant: true, scope: 'F3125 A325·A490 · A563 · F436 · F1554 · A354·A449 · KS F10T·S10T' },
  { id: 'metric', ko: '미터 일반 규격품', short: '미터 규격품', en: 'Metric commodity fasteners', plant: false, scope: 'ISO 898-1 4.6–12.9 볼트·나사 · ISO 898-2 너트 · 와셔 · 전산볼트 · 소켓류·작은나사·리벳' },
  { id: 'inch', ko: '인치 일반 규격품', short: '인치 규격품 (SAE·ASTM 소켓류)', en: 'Inch commodity fasteners', plant: false, scope: 'SAE J429 · ASTM A307·A574·F835·F912 · ASME B18 너트·와셔' },
];
const CAD_MTR_GROUP = Object.fromEntries(CAD_MTR_GROUPS.map(g => [g.id, g]));

// 가족 id → 품목군 (base METRIC·INCH, 엔진 BOM_FAMS, catalog/data). 주의: METRIC 'sw' = 스프링와셔, 해수용 볼팅은 base에서 'smo' (en_names.json에서는 NEW:sw)
const cadMtrIndex = o => { const m = {}; Object.entries(o).forEach(([g, s]) => s.split(/\s+/).filter(Boolean).forEach(k => { m[k] = g; })); return m; };
const CAD_MTR_FAMG = cadMtrIndex({
  metric: `hbf hbp scs csk hn pw sw tr bhcs ss ss-cup ss-flat ss-cone ss-dog flangebolt carriage tslotbolt tnut jack eyebolt swingbolt sqbolt tbolt fitbolt lag cskbolt hoistring
    lowhead shoulder plug906 plug908 plug910 sealw bhflange torx ss-slot ss-sq ss-soft ss-knurl orbplug bondseal ms-pan ms-csk ms-truss ms-slot ms-rcsk tap tap-hex tap-drill tap-form
    sems standoff blindrivet blindrivet-csk solidrivet rivnut rivstud wti thumb clinch lockbolt keyinsert woodinsert weldstud`,
  inch: 'j429 a574 ifhc ibhc iss iss-cup iss-flat iss-cone iss-oval iss-halfdog a307 hhb ms-inch ieyebolt plugnpt plugbar ihcs ihn ilw ishc',
  astm: 'b7 b7m hh ats istd ihhn',
  stainless: 'b8 f593 f837 smo',
  lowtemp: 'l7 b8lt',
  hightemp: 'b16 a453',
  nickel: 'f468',
  structural: 'a325 f1554 a354 hvset tcbolt ifw',
});
// 등급 키·재질 코드 → 품목군 (GRADE 키, 엔진 combos, catalog grades, C&D MAT_KO 코드). 정확히 같은 키만
const CAD_MTR_KEYG = cadMtrIndex({
  metric: '4.6 4.8 8.8 10.9 12.9 010.9 012.9 45H 46 48 88 109 0109 0129 129 N8 N10 N12 H200 H300 200HV 300HV SPR S45H C15E MS48 MS88 TST PST',
  inch: 'A307A A307B A574 F835 F912 J5 J8 J429-2 J429-5 J429-8 J995-5 J995-8 J995G5 J995G8 LWCS A489 F541',
  astm: 'B7 B7M 2H 2HM 7 7M B72H B7S A1942H',
  stainless: `A2 A4 NA2 NA4 WA2 WA4 SA2 SSA2 SSA4 MSA2 TA2 PA2 PA4 LW188 F880 F880M F837 F837M F879 F879M F593-1 F593-2 F594-1 F594-2 F5931 F5932 F5941 F5942
    18-8 SS B8 B8M 8 8M B8MLCUN SDSS CRES`,
  lowtemp: 'L7 L7M L43 7L 7ML A320-B8 A320-B8M',
  hightemp: 'B16 16 A453-660',
  nickel: 'F468 F467 IN718',
  structural: 'A325 A490 A563-DH A563-A A563-C A563A A563DH A354-BC A354-BD BC BD A449 F436 F436-1 F1554-36 F1554-55 F1554-105 F10T F8T S10T',
});
// 등급 표시 문자열(INCH grades, catalog label) → 품목군. 순서가 우선순위 (A320 B8은 스테인리스보다 저온이 먼저)
const CAD_MTR_LABELG = [
  ['lowtemp', /\bA320\b|\bL7M?\b|\bL43\b|\b7M?L\b/],
  ['hightemp', /\bB16\b|\bA453\b|\b660\b|A-286|고온/],
  ['nickel', /\bF46[78]|\bNi\s?\d|니켈/],
  ['stainless', /\bB8|\bF59[34]|\bF8(?:37|79|80)|\b(?:304|316)\b|6Mo|듀플렉스|S3[12]\d{3}|스테인리스|\bA[24]-\d{2}\b/],
  ['astm', /\bB7M?\b|\b2HM?\b|\bA19[34]\b/],
  ['structural', /F3125|A325|A490|F1554|A354|A449|A563|F436|F10T|S10T/],
  ['inch', /\bSAE\b|J429|A307|A574|F835|F912/],
];
// 품목군 전체를 한 줄로 말할 때(홈 띠·3장 머리) 그 품목군에 든 등급 기호. 추가 근거가 하나라도 빠지면 품목군 전체를 낮춰 말한다
const CAD_MTR_GTOK = { astm: 'B7M 2HM 7M', lowtemp: 'L7 L7M L43 7L 7ML' };
const CAD_MTR_CATG = { hex: 'metric', socket: 'metric', sheet: 'metric', inch: 'inch' };   // catalog/data 파일 → 품목군 (가족 표에 없을 때)

/* 품목군 찾기. ctx = { fam, grade, mat, nut, cat, system } — 아는 것만 넣는다. 문자열이면 품목군 id 그대로 */
function cadMtrGroupOf(ctx) {
  if (typeof ctx === 'string') return CAD_MTR_GROUP[ctx] ? ctx : null;
  const c = ctx || {};
  if (c.group && CAD_MTR_GROUP[c.group]) return c.group;
  for (const v of [c.grade, c.mat]) {
    if (v == null || v === '') continue;
    const k = String(v).trim();
    if (CAD_MTR_KEYG[k] || CAD_MTR_KEYG[k.toUpperCase()]) return CAD_MTR_KEYG[k] || CAD_MTR_KEYG[k.toUpperCase()];
    const hit = CAD_MTR_LABELG.find(([, re]) => re.test(k));
    if (hit) return hit[0];
  }
  if (c.nut && CAD_MTR_KEYG[c.nut]) return CAD_MTR_KEYG[c.nut];
  if (c.fam && CAD_MTR_FAMG[c.fam]) return CAD_MTR_FAMG[c.fam];
  if (c.cat && CAD_MTR_CATG[c.cat]) return CAD_MTR_CATG[c.cat];
  if (c.system === 'metric' || c.system === 'inch') return c.system;
  return null;
}

// 등급·재질에서 추가 근거가 필요한지 (C&D cdDocPlan의 HARD100·IMPACT 조건과 같은 집합)
const CAD_MTR_HARD = new Set(['B7M', 'L7M']);   // 2HM·7M·7ML 너트 전수 경도는 공개 출처 2곳뿐이라 뺐다 (2026-10 감사, c1 cdDocPlan HARD100과 같은 집합)
const CAD_MTR_IMPACT = new Set(['L7', 'L7M', 'L43', '7L', '7ML']);
// c.extraGrades: 가족 전체 기준으로 볼 때 그 가족의 모든 등급 문자열 (품목군 판정에는 쓰지 않고 추가 근거에만 쓴다)
const cadMtrTokens = c => {
  const s = [c.grade, c.mat, c.nut, c.extraGrades].filter(v => v != null).join(' ').toUpperCase();
  return new Set((s.match(/\b(?:B7M|L7M|L43|L7|2HM|7ML|7M|7L)\b/g) || []));
};
function cadMtrExtras(ctx) {
  const c = typeof ctx === 'string' ? {} : ctx || {}, t = cadMtrTokens(c), out = [];
  const bare = !c.grade && !c.mat && !c.extraGrades;
  if ([...t].some(k => CAD_MTR_HARD.has(k)) || (c.fam === 'b7m' && bare)) out.push('hard100');
  if ([...t].some(k => CAD_MTR_IMPACT.has(k)) || (c.fam === 'l7' && bare)) out.push('impact');
  const struct = c.fam === 'a325' || /A325|A490/.test(String(c.grade || c.mat || ''));
  if (struct && /용융|HDG|F2329|기계적\s*아연|B695|아연도금|\bMZ\b/i.test(String(c.fin || ''))) out.push('rotcap');
  return out;
}

/* 상태 판정. 근거가 모자라면 한 단계씩 내린다: confirmed → on-request → unconfirmed */
function cadMtrState(ctx) {
  const c = typeof ctx === 'string' ? {} : ctx || {};
  const group = cadMtrGroupOf(ctx);
  const famSet = c.fam && Object.prototype.hasOwnProperty.call(CAD_MTR.fam, c.fam);
  const raw = (famSet ? CAD_MTR.fam[c.fam] : null) || (group && CAD_MTR.grp[group]) || CAD_MTR.def;
  const ev = (c.fam && CAD_MTR.ev['fam:' + c.fam]) || (group && CAD_MTR.ev[group]) || null;
  const extras = cadMtrExtras(ctx);
  const ok = new Set(ev && /^\d{4}-\d{2}-\d{2}$/.test(ev.date || '') && (ev.n || 0) >= 1 ? ev.ok || [] : []);
  const has = keys => keys.every(k => ok.has(k));
  let state = raw === 'confirmed' || raw === 'on-request' ? raw : 'unconfirmed';
  if (state === 'confirmed' && !(has(CAD_MTR_NEED.confirmed) && has(extras) && ['original', 'copy'].includes(ev.form) && ['product', 'label'].includes(ev.trace))) state = 'on-request';
  if (state === 'on-request' && !has(CAD_MTR_NEED['on-request'])) state = 'unconfirmed';
  return {
    state, raw, group, extras,
    missing: extras.filter(k => !ok.has(k)),
    form: state === 'confirmed' ? ev.form : null,
    trace: state === 'confirmed' ? ev.trace : null,
    cert: ev && ev.cert === 'cmtr' ? 'cmtr' : '3.1',
    date: state === 'unconfirmed' ? null : ev.date,
    downgraded: state !== raw && raw !== 'unconfirmed',
  };
}
const cadPmiOn = group => !!(CAD_MTR.pmi.enabled && /^\d{4}-\d{2}-\d{2}$/.test(CAD_MTR.pmi.date || '') && (!group || CAD_MTR.pmi.groups.includes(group)));

/* ───────── 3. 문구 (화면·파일·견적 모두 여기서만 읽는다) ───────── */
const CAD_TRUST_COPY = {
  // 볼트노트 문서와 방침: 상태와 관계없이 늘 같은 문장
  always: {
    ko: '볼트노트 CoC(ISO 16228 F2.1 형식) 기본 · EN 10204 3.2·KOLAS 시험은 요청 시 협의 · 볼트노트는 3.1을 직접 발행하지 않습니다',
    en: 'BoltNote CoC (ISO 16228 F2.1 format) as standard · EN 10204 3.2 and KOLAS testing by arrangement on request · BoltNote does not issue 3.1 itself',
  },
  // 서류 한 줄 (품목 장 서류 칸·데이터시트·견적서 서류 계획). {doc} = MTR(EN 10204 3.1) 또는 MTR(제조사 시험성적서)
  mtr: {
    unconfirmed: { ko: '제조사 MTR(EN 10204 3.1) 제공 여부: 공급처 확인 중 — 견적 시 회신', en: 'Manufacturer\'s MTR (EN 10204 3.1): availability being confirmed with the supplier — advised with the quotation' },
    'on-request': { ko: '제조사 {doc}: 주문 시 요청하면 제공 — 비용·납기는 견적서에 표기', en: 'Manufacturer\'s {docEn}: supplied when requested with the order — cost and lead time shown in the quotation' },
    confirmed: { ko: '제조사 MTR 원본(수정 없이) 전달 · 히트번호 추적', en: 'Manufacturer\'s original MTR forwarded unaltered · heat-number traceability' },
    confirmedCopy: { ko: '제조사 MTR 사본(수정 없이) 전달 · 히트번호 추적 · 원본은 요청 시 확인', en: 'Copy of the manufacturer\'s MTR forwarded unaltered · heat-number traceability · original available on request' },
  },
  doc: { '3.1': { ko: 'MTR(EN 10204 3.1)', en: 'MTR (EN 10204 3.1)' }, cmtr: { ko: 'MTR(제조사 시험성적서)', en: 'MTR (manufacturer\'s certified test report)' } },
  // 문자 태그 (배지 아님). .tag.wait = 점선, .tag.doc = 파란 펜
  tag: { unconfirmed: ['wait', 'MTR 확인 중'], 'on-request': ['doc', 'MTR 요청 시'], confirmed: ['doc', 'MTR 3.1'], confirmedCmtr: ['doc', 'MTR'], coc: ['doc', 'CoC'] },
  // 추가 근거 줄: 상태가 확인 중이 아닐 때만 보인다 (확인 중이면 MTR 줄이 이미 '확인 중')
  extra: {
    hard100: { ok: { ko: '전수 경도시험 기록(제조사) 함께 전달', en: '100% hardness test records (manufacturer) included' }, wait: { ko: '전수 경도시험 기록 제공 여부: 공급처 확인 중', en: '100% hardness test records: being confirmed with the supplier' } },
    impact: { ok: { ko: '샤르피 충격시험 결과는 제조사 MTR에 기재', en: 'Charpy impact results stated in the manufacturer\'s MTR' }, wait: { ko: '충격시험 결과의 MTR 기재 여부: 공급처 확인 중', en: 'Impact results on the MTR: being confirmed with the supplier' } },
    rotcap: { ok: { ko: '아연도금 세트 회전능력 시험 결과 함께 전달', en: 'Rotational capacity test results (galvanized sets) included' }, wait: { ko: '아연도금 세트 회전능력 시험 결과 제공 여부: 공급처 확인 중', en: 'Rotational capacity test results (galvanized sets): being confirmed with the supplier' } },
  },
  // 히트번호를 대조하는 곳 (confirmed 근거 ev.trace)
  trace: { product: { ko: '제품 마킹·포장 라벨', en: 'product marking and package labels' }, label: { ko: '포장 라벨', en: 'package labels' } },
  pmi: {
    on: { ko: 'PMI(XRF) 성분 확인: 외부 시험기관 의뢰, 요청 시 (휴대용 XRF는 탄소를 측정하지 못합니다)', en: 'PMI (XRF) alloy verification: by an external testing laboratory, on request (handheld XRF cannot measure carbon)' },
    // 꺼져 있을 때는 고객이 먼저 PMI를 적은 경우에만 (요청서·C&D·워크벤치). 품목 장·홈·데이터시트에는 PMI 줄이 없다
    ask: { ko: 'PMI(성분 확인)는 상시 제공하지 않습니다. 요청하시면 외부 시험기관 의뢰 가능 여부를 견적 때 회신합니다.', en: 'PMI (alloy verification) is not a standing service. On request we will advise with the quotation whether an external laboratory can perform it.' },
    optOn: 'PMI 성분 확인 (요청 시, 외부 시험기관)',
    optAsk: 'PMI 성분 확인 (가능 여부 회신)',
  },
  // 홈 C 구역 띠 (부품표 아래 .note.info.small, nk '서류')
  home: {
    none: 'ASME·ASTM 플랜트 볼트의 제조사 MTR(EN 10204 3.1) 제공 여부는 품목별로 공급처에 확인하고 있습니다. 견적 요청 시 품목마다 회신합니다. 받은 MTR은 수정 없이 전달하며, 볼트노트는 3.1을 직접 발행하지 않습니다.',
    confirmed: '플랜트 볼트 {names}: 제조사 MTR 원본(수정 없이) 전달 · 히트번호 추적',
    confirmedCopy: '플랜트 볼트 {names}: 제조사 MTR 사본(수정 없이) 전달 · 히트번호 추적 · 원본은 요청 시 확인',
    onRequest: '{names}: 제조사 MTR(EN 10204 3.1) 주문 시 요청하면 제공 — 비용·납기는 견적서에 표기',
    rest: '그 밖의 플랜트 볼트: 제조사 MTR 제공 여부 공급처 확인 중 — 견적 시 회신',
  },
  // 홈 G 구역 '합니다' 4번 (상태와 무관한 방침)
  rule: '제조사 MTR(EN 10204 3.1)은 받은 경우 수정 없이 그대로 전달하고, 히트번호를 제품·라벨과 대조합니다. 품목별 제공 여부는 견적 때 알려 드립니다. 저희가 발행하는 문서는 시험값 없는 CoC(ISO 16228 F2.1 형식)입니다.',
  // 3장 머리 (.shd 아래 p.small)
  inchHead: {
    none: '서류 · 볼트노트 CoC(ISO 16228 F2.1 형식) 기본 · 제조사 MTR(EN 10204 3.1) 제공 여부는 품목별로 공급처 확인 중 — 견적 시 회신',
    lead: '서류 · 볼트노트 CoC(ISO 16228 F2.1 형식) 기본',
    confirmed: '제조사 MTR 원본 전달: {names}',
    confirmedCopy: '제조사 MTR 사본 전달 (원본은 요청 시 확인): {names}',
    onRequest: '요청 시 제공: {names}',
    rest: '그 밖의 품목: 공급처 확인 중 — 견적 시 회신',
  },
  // 3-n장 서류 선택 (DOC_OPT 값 '제조사 3.1 사본'의 표시 문구와 도움말). 값은 그대로 둔다 (사양 문자열·C&D 파서 호환)
  docOpt: { unconfirmed: '제조사 MTR (3.1) 요청 — 제공 여부 회신', 'on-request': '제조사 MTR (3.1) 요청 — 비용·납기 견적서 표기', confirmed: '제조사 MTR (3.1) 원본 전달', confirmedCopy: '제조사 MTR (3.1) 사본 전달' },
  docHint: {
    unconfirmed: 'MTR = 제조사 밀시트(EN 10204 3.1). 이 품목은 공급처에 제공 여부를 확인하고 있어 견적 때 회신합니다. 3.2 입회는 비용·납기가 추가됩니다.',
    'on-request': 'MTR = 제조사 밀시트(EN 10204 3.1). 주문 때 요청하시면 받아서 수정 없이 전달합니다. 비용·납기는 견적서에 적습니다. 3.2 입회는 비용·납기가 추가됩니다.',
    confirmed: 'MTR = 제조사 밀시트(EN 10204 3.1). 받은 그대로(수정 없이) 전달하고 히트번호를 제품·라벨과 대조합니다. 3.2 입회는 비용·납기가 추가됩니다.',
  },
  // 사양 문자열 끝의 서류 토막 (플랜지 계산·견본 견적 줄). '3.1'이 남아 있어 C&D 파서가 서류 요청으로 읽는다
  specDoc: { unconfirmed: '제조사 3.1 요청', 'on-request': '제조사 3.1 요청', confirmed: '제조사 3.1 원본', confirmedCopy: '제조사 3.1 사본' },
  // 견적 서류 계획 (cdDocPlan MTC31_FWD)
  plan: {
    label: { ko: '제조사 MTR (EN 10204 3.1, 수정 없이 전달)', short: '제조사 MTR', en: 'Manufacturer\'s MTR (EN 10204 3.1, forwarded unaltered)' },
    note: {
      confirmed: '원본', confirmedCopy: '사본 · 원본은 요청 시 확인',
      'on-request': '요청분 · 비용·납기 견적서 표기',
      unconfirmed: '공급처 확인 중 — 회신 때 확정',
      optUnconfirmed: '제공 여부 공급처 확인 중',
      opt: '요청 시',
    },
    tbdHead: { ko: '확인 중', en: 'TBC' },
    counter: { incl: '제조사 MTR 포함', tbd: '제조사 MTR 확인 중' },
  },
  // 엔진 상태 문구 (e7_status 106행: 고객이 CERT·PMI를 적었을 때)
  status: {
    certUnconfirmed: 'EN 10204 3.1은 공급처에 제공 여부를 확인한 뒤 비용·납기를 정합니다.',
    certKnown: 'EN 10204 3.1은 히트 추적이 되는 로트를 따로 수배해 비용과 납기가 추가됩니다.',
    pmiOn: 'PMI는 외부 시험기관에 의뢰해 비용과 납기가 추가됩니다.',
    pmiAsk: 'PMI는 상시 제공하지 않아 외부 시험기관 의뢰 가능 여부를 견적 때 회신합니다.',
    // e7_status 102행 (F3125 A325·A490): 로트 시험 성적서도 제조사 문서다
    f3125Known: '구조용 고장력 세트(F3125)는 로트 시험 성적서와 함께 견적합니다.',
    f3125Ask: '구조용 고장력 세트(F3125)는 로트 시험 성적서 제공 여부를 공급처에 확인해 견적합니다.',
  },
  // C&D 일반 조건 GC-T10 (서류). '사본으로 전달'을 '받은 경우 … 원본 또는 사본'으로, 제공 여부는 줄별 서류 계획으로
  gcT10: {
    ko: '서류는 주문 시 확정하며 출고 뒤 새로 만들거나 고칠 수 없습니다. 제조사 성적서는 받은 경우 고치지 않고 원본 또는 사본으로 전달하며, 사본에서 바꾸는 것은 실제 납품 수량뿐입니다(EN 10204 §6). 제조사 성적서 제공 여부는 줄별 서류 계획에 적습니다. 볼트노트는 자기 명의로 EN 10204 3.1·2.2를 발행하지 않습니다. 볼트노트 문서는 적합 확인서 CoC(ISO 16228 F2.1 형식, 시험값 없음)입니다. KOLAS 시험과 3.2는 요청 시 제3자 기관을 통해서만 제공합니다.',
    en: 'Documents are fixed at order and cannot be created or amended after shipment. Manufacturer\'s certificates, where received, are forwarded unaltered as the original or a copy; only the delivered quantity may be changed on a copy (EN 10204 §6). Availability of manufacturer\'s certificates is stated per line in the document plan. BoltNote does not issue EN 10204 3.1/2.2 in its own name. BoltNote\'s document is a Certificate of Conformity (ISO 16228 F2.1 format, no test values). KOLAS testing and 3.2 are available on request through third-party bodies only.',
  },
  // 요청서 G칸·워크벤치 서류 선택 표시
  reqForm: {
    cap: '제조사 MTR(밀시트, EN 10204 3.1·2.2)은 받을 수 있는 품목에 한해 받은 그대로 전달합니다. 품목별 제공 여부는 견적 때 회신합니다. 서류는 주문할 때 정해 주세요. 출고 뒤에는 새로 만들거나 고칠 수 없습니다.',
    mtc31: '제조사 MTR (EN 10204 3.1) — 제공 여부 견적 시 회신',
    bom31: '제조사 MTR 3.1 (요청)',
  },
  // 데이터시트 서류 칸
  ds: {
    head: '서류 Documents',
    coc: ['볼트노트 CoC', 'ISO 16228 F2.1 형식 · 주문 규격·수량·히트/로트 번호·첨부 서류 목록 · 시험값 없음', '기본'],
    mtr: ['제조사 MTR', 'EN 10204 3.1'],
    third: ['EN 10204 3.2 · KOLAS 시험', '검사기관 입회(3.2) · 외부 공인시험소(KOLAS) · 비용·납기 별도 · 출고 뒤 소급 불가', '요청 시 협의'],
    pmi: ['PMI (XRF)', '외부 시험기관 의뢰 · 휴대용 XRF는 탄소를 측정하지 못함', '요청 시'],
    decl: ['RoHS·REACH·원산지', '공급처 확인 후 견적서에 기재', '확인 후 기재'],
    foot: '볼트노트는 EN 10204 3.1을 직접 발행하지 않습니다. 서류 상태 기준일 {date} — 최신 상태는 견적서로 확인하세요.',
    state: { unconfirmed: '확인 중', 'on-request': '요청 시', confirmed: '원본 전달', confirmedCopy: '사본 전달' },
  },
};
// 규격이 요구하는 시험 (서류가 아님). base INCH[].docs에 섞여 있던 규격 요구만 뽑았다. 서류 제공 여부는 MTR 상태가 따로 말한다
const CAD_TRUST_REQ = {
  b7m: '전수 경도시험 · 235 HB 이하',
  l7: '샤르피 충격시험 — 기본 시험온도 L7·L43 −101 °C, L7M −73 °C (공개 기술자료 기준)',
  hh: '경도 시험 (ASTM A194)',
  a325: '아연도금 세트는 로트별 회전능력 시험',
  a453: '인장·응력파단·경도 시험 (ASTM A453 요약) · 설계온도별 시험 조건은 견적 때 확인',
  smo: '수퍼듀플렉스는 페라이트량·부식시험 (협의)',
};
// 추적성 설명 (6장 품질 서류 안내 또는 5장 '3.1 성적서 읽는 법' 탭 아래). 상태와 관계없이 참인 문장만
const CAD_TRUST_TRACE = {
  title: '추적성: 히트번호·로트·마킹, 그리고 받으시는 서류',
  lead: 'MTR(밀시트·재질성적서)의 히트번호가 포장 라벨과 볼트노트 CoC까지 같은 번호로 이어지는 것이 추적성입니다.',
  rows: [
    ['히트번호 Heat', '제강사가 한 번에 녹인 쇳물에 붙이는 번호입니다. 화학 성분은 히트 단위로 정해지고, 제강사 밀시트와 볼트 제조사 MTR에 같은 번호가 적힙니다.'],
    ['로트 Lot', '볼트 제조사가 같은 히트의 소재로 같은 공정·같은 열처리 조건에서 만든 묶음입니다. 인장·경도·충격 같은 기계적 시험은 로트에서 뽑은 시료로 합니다.'],
    ['제강사 밀시트와 제조사 MTR', '제강사 밀시트는 소재(봉강)의 성분·성질입니다. 볼트를 고를 때 확인할 문서는 볼트 제조사가 히트 성분에 완성품 시험 결과를 더해 발행한 MTR(EN 10204 3.1)입니다.'],
    ['마킹 Marking', 'ASTM 볼팅의 규격 마킹은 등급 기호(B7·2H 등)와 제조사 식별 기호입니다. 제품마다 히트번호를 각인하는 것은 규격 요구가 아니어서, 보통은 포장 라벨과 포장 명세서로 히트를 이어 갑니다. 개별 각인이 필요하면 주문 때 알려 주세요. 제조사 추가 공정이라 가능 여부를 회신합니다.'],
    ['이어지는 번호', 'MTR의 히트번호 = 포장 라벨의 히트·로트번호 = 볼트노트 CoC에 적은 번호. 서류가 붙는 품목은 한 상자에 한 히트만 담습니다.'],
    ['받으시는 것', '① 볼트노트 CoC(ISO 16228 F2.1 형식): 주문 규격·수량·히트/로트 번호·첨부 서류 목록, 시험값 없음 — 항상. ② 제조사 MTR(EN 10204 3.1): 품목별 상태(확인 중 · 요청 시 · 원본 전달)에 따라. ③ 포장 라벨: 규격·등급·호칭·수량·히트/로트 번호. ④ 요청 시: KOLAS 공인시험성적서(외부 시험소, 시료 기준), EN 10204 3.2(검사기관 입회), 도금·코팅 성적서.'],
    ['받으신 뒤', 'ISO 16228은 원래 포장을 연 뒤의 추적성을 구매자가 이어 가도록 합니다. 상자를 나눠 쓰실 때는 라벨의 히트·로트번호를 함께 옮겨 적어 주세요.'],
    ['하지 않는 일', '3.1을 직접 발행하지 않습니다. 받은 MTR의 숫자·회사명을 고치거나 가리지 않고, 다른 로트의 MTR을 돌려쓰지 않으며, 출고 뒤에 서류를 새로 만들지 않습니다.'],
  ],
  pmiRow: ['PMI (XRF)', '외부 시험기관에 의뢰해 요청 시 성분을 확인하고, 시험기관 결과서를 그대로 첨부합니다. B7과 B7M은 성분이 같은 계열이라 성분 분석으로 구분되지 않고, 304와 304L처럼 탄소만 다른 재질은 휴대용 XRF로 구분하지 못합니다. B7M은 경도 기록으로 확인합니다.'],
};

/* ───────── 4. 문구 만들기 ───────── */
const cadTrustEsc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]));
const cadTrustFill = (t, p) => String(t).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] != null ? p[k] : ''));
const cadTrustSt = ctx => (ctx && ctx.state && ctx.group !== undefined ? ctx : cadMtrState(ctx));
const cadTrustKey = s => (s.state === 'confirmed' && s.form === 'copy' ? 'confirmedCopy' : s.state);

// MTR 서류 한 줄
function cadTrustLine(ctx, lang = 'ko') {
  const s = cadTrustSt(ctx), C = CAD_TRUST_COPY, d = C.doc[s.cert] || C.doc['3.1'];
  return cadTrustFill(C.mtr[cadTrustKey(s)][lang === 'en' ? 'en' : 'ko'], { doc: d.ko, docEn: d.en });
}
function cadTrustTag(ctx) {
  const s = cadTrustSt(ctx), T = CAD_TRUST_COPY.tag;
  const [cls, text] = s.state === 'confirmed' && s.cert === 'cmtr' ? T.confirmedCmtr : T[s.state];
  return { cls, text };
}
const cadTrustTagHtml = ctx => { const t = cadTrustTag(ctx); return `<span class="tag ${t.cls}">${cadTrustEsc(t.text)}</span>`; };
// 추가 근거 줄 (경도·충격·회전능력). 확인 중 상태에서는 빈 배열
function cadTrustExtraLines(ctx, lang = 'ko') {
  const s = cadTrustSt(ctx), E = CAD_TRUST_COPY.extra, L = lang === 'en' ? 'en' : 'ko';
  if (s.state === 'unconfirmed') return [];
  return s.extras.map(k => ({ key: k, ok: !s.missing.includes(k), text: E[k][s.missing.includes(k) ? 'wait' : 'ok'][L] }));
}
const cadTrustPmiLine = (group, lang = 'ko') => (cadPmiOn(group) ? CAD_TRUST_COPY.pmi.on[lang === 'en' ? 'en' : 'ko'] : '');

/* 품목 장 서류 칸 (3-n장 dl.kv '서류', 2-n장·catalog 품목 장도 같은 함수).
   f = INCH·METRIC·catalog 가족 객체(id 필요), grade = 고른 등급(없으면 가족 전체 기준).
   돌려주는 것: { state, tag, lines: [{k, text}], html } — html은 <dd> 안에 넣는다 */
function cadTrustFamDocs(f, grade, fin) {
  const grades = Array.isArray(f.grades) ? f.grades.map(g => (g && typeof g === 'object' ? g.label || g.key || '' : String(g))) : [];
  // 등급을 고르기 전(가족 전체)에는 품목군을 가족 기본으로 정하고, 추가 근거만 모든 등급에서 모은다
  const ctx = grade ? { fam: f.id, grade, fin: fin || null } : { fam: f.id, fin: fin || null, extraGrades: grades.join(' ') || null };
  const s = cadMtrState(ctx), lines = [];
  lines.push({ k: 'mtr', text: cadTrustLine(s) });
  const sets = { hard100: CAD_MTR_HARD, impact: CAD_MTR_IMPACT };
  cadTrustExtraLines(s).forEach(x => {
    // 가족 전체 기준이고 일부 등급에만 해당하면 그 등급 기호를 앞에 적는다 (예: L7M: 전수 경도시험 기록 …)
    let who = '';
    if (!grade && sets[x.key] && grades.length) {
      const hit = grades.map(g => [...cadMtrTokens({ grade: g })].filter(k => sets[x.key].has(k)));
      if (hit.some(h => !h.length)) who = [...new Set(hit.flat())].join('·') + ': ';
    }
    lines.push({ k: x.key, text: who + x.text });
  });
  if (CAD_TRUST_REQ[f.id]) lines.push({ k: 'req', text: '규격 요구 · ' + CAD_TRUST_REQ[f.id] });
  lines.push({ k: 'always', text: CAD_TRUST_COPY.always.ko });
  const pmi = cadTrustPmiLine(s.group);
  if (pmi) lines.push({ k: 'pmi', text: pmi });
  const html = `${cadTrustTagHtml(s)} ${cadTrustEsc(lines[0].text)}` + lines.slice(1).map(l => `<br><span class="small${l.k === 'req' ? '' : ' muted'}">${cadTrustEsc(l.text)}</span>`).join('');
  return { state: s.state, tag: cadTrustTag(s), lines, html };
}

/* base INCH 배열에 적용 (go(start) 전에 한 번, 플래그를 바꾼 뒤에도 다시 부르면 된다).
   f.docs / f.docsHtml = 3-n장 서류 칸 (처음 열릴 때 선택되는 첫 등급 기준; 등급을 바꾸면 cadTrustFamDocs로 다시 그린다 — trust.md §6.2-8)
   f.docTag / f.docTagCls = 부품표 서류 태그: 그 가족의 모든 등급 중 가장 낮은 상태 (hh의 7L처럼 다른 품목군 등급이 섞여도 과장하지 않게)
   기존 docTag가 CoC로 시작하던 품목(j429·a574·f593·f837)은 'CoC · ' 접두를 유지해 3-n장 서류 기본 선택(defDoc)이 그대로 CoC가 되게 한다. */
const CAD_MTR_RANK = { unconfirmed: 0, 'on-request': 1, confirmed: 2 };
function cadTrustApplyInch(list) {
  let n = 0;
  (list || []).forEach(f => {
    if (!f || !f.id) return;
    const gs = Array.isArray(f.grades) ? f.grades.map(g => (g && typeof g === 'object' ? g.label || g.key || '' : String(g))).filter(Boolean) : [];
    const r = cadTrustFamDocs(f, gs[0] || null), wasCoC = /^CoC/.test(f.docTag0 || f.docTag || '');
    const worst = (gs.length ? gs.map(g => cadMtrState({ fam: f.id, grade: g })) : [cadMtrState({ fam: f.id })]).sort((a, b) => CAD_MTR_RANK[a.state] - CAD_MTR_RANK[b.state])[0];
    const tag = cadTrustTag(worst);
    if (f.docs0 === undefined) { f.docs0 = f.docs; f.docTag0 = f.docTag; }
    f.docs = r.lines.map(l => l.text).join(' · ');
    f.docsHtml = r.html;
    f.docTag = (wasCoC ? 'CoC · ' : '') + tag.text;
    f.docTagCls = tag.cls;
    n++;
  });
  return n;
}

// 품목군 이름 묶음 (플랜트 품목군만, 상태·형식별)
function cadTrustGroupsBy() {
  const out = { confirmed: [], confirmedCopy: [], 'on-request': [], unconfirmed: [] };
  CAD_MTR_GROUPS.filter(g => g.plant).forEach(g => {
    // 품목군 대표 상태: 품목군의 모든 등급에 참인 것만 말한다 (예: B7M 전수 경도 기록이 확인되지 않으면 astm 전체를 '요청 시'로)
    const s = cadMtrState({ group: g.id, extraGrades: CAD_MTR_GTOK[g.id] || null });
    out[cadTrustKey(s)].push(g.short);
  });
  const famConf = Object.keys(CAD_MTR.fam).filter(id => CAD_MTR_FAMG[id] && CAD_MTR_GROUP[CAD_MTR_FAMG[id]].plant).map(id => [id, cadMtrState({ fam: id })]).filter(([, s]) => s.state !== 'unconfirmed');
  famConf.forEach(([id, s]) => { const nm = (typeof INCH !== 'undefined' && (INCH.find(f => f.id === id) || {}).short) || id; out[cadTrustKey(s)].push(nm); });
  Object.keys(out).forEach(k => { out[k] = [...new Set(out[k])]; });
  return out;
}

// 홈 C 구역 띠
function cadTrustHomeHtml() {
  const H = CAD_TRUST_COPY.home, b = cadTrustGroupsBy(), names = a => a.map(cadTrustEsc).join(' · ');
  const parts = [];
  if (b.confirmed.length) parts.push(cadTrustFill(H.confirmed, { names: `<b>${names(b.confirmed)}</b>` }));
  if (b.confirmedCopy.length) parts.push(cadTrustFill(H.confirmedCopy, { names: `<b>${names(b.confirmedCopy)}</b>` }));
  if (b['on-request'].length) parts.push(cadTrustFill(H.onRequest, { names: `<b>${names(b['on-request'])}</b>` }));
  const body = parts.length ? parts.join('<br>') + (b.unconfirmed.length ? '<br>' + cadTrustEsc(H.rest) : '') : cadTrustEsc(H.none);
  return `<div class="note info small cad-trust-strip"><span class="nk">서류</span> ${body}</div>`;
}
// 3장 머리 아래 한 줄
function cadTrustInchHeadHtml() {
  const H = CAD_TRUST_COPY.inchHead, b = cadTrustGroupsBy();
  if (!b.confirmed.length && !b.confirmedCopy.length && !b['on-request'].length) return `<p class="small cad-trust-head">${cadTrustEsc(H.none)}</p>`;
  const seg = [H.lead];
  if (b.confirmed.length) seg.push(cadTrustFill(H.confirmed, { names: b.confirmed.join('·') }));
  if (b.confirmedCopy.length) seg.push(cadTrustFill(H.confirmedCopy, { names: b.confirmedCopy.join('·') }));
  if (b['on-request'].length) seg.push(cadTrustFill(H.onRequest, { names: b['on-request'].join('·') }));
  if (b.unconfirmed.length) seg.push(H.rest);
  return `<p class="small cad-trust-head">${cadTrustEsc(seg.join(' · '))}</p>`;
}
// 3-n장 서류 선택
const cadTrustDocOpt = ctx => CAD_TRUST_COPY.docOpt[cadTrustKey(cadTrustSt(ctx))];
const cadTrustDocHint = ctx => CAD_TRUST_COPY.docHint[cadTrustSt(ctx).state];
const cadTrustSpecDoc = ctx => CAD_TRUST_COPY.specDoc[cadTrustKey(cadTrustSt(ctx))];

/* 견적 서류 계획: cdDocPlan의 MTC31_FWD 항목 하나를 상태에 맞게 고친다.
   requested = 고객이 3.1을 요구했는지(want31), certDays = LEAD_DAYS.cert 같은 추가 납기.
   돌려주는 것: { incl, option, tbd, note, addDays } — tbd 줄은 '포함'도 '옵션'도 아닌 '확인 중'으로 따로 적는다 */
function cadTrustPlanMtr(ctx, requested, certDays) {
  const s = cadTrustSt(ctx), N = CAD_TRUST_COPY.plan.note;
  if (requested) {
    if (s.state === 'confirmed') return { incl: true, option: false, tbd: false, note: N[cadTrustKey(s)], addDays: certDays || null };
    if (s.state === 'on-request') return { incl: true, option: false, tbd: false, note: N['on-request'], addDays: certDays || null };
    return { incl: false, option: false, tbd: true, note: N.unconfirmed, addDays: null };
  }
  return { incl: false, option: true, tbd: false, note: s.state === 'unconfirmed' ? N.optUnconfirmed : N.opt, addDays: s.state === 'unconfirmed' ? null : certDays || null };
}

/* cdDocPlan 감싸기 (c1_cd.js를 고치지 않고 배선할 때): cdDocPlan = cadTrustWrapDocPlan(cdDocPlan);
   원래 함수가 만든 계획에서 MTC31_FWD 한 줄만 상태에 맞게 바꾸고 text를 다시 만든다. 직접 고칠 때는 trust.md §6.4의 diff를 쓴다 */
function cadTrustPlanText(plan, docs) {
  const D = docs || (typeof CD_DOC !== 'undefined' ? CD_DOC : {}), sh = p => (D[p.code] && D[p.code].short) || (p.code === 'MTC31_FWD' ? CAD_TRUST_COPY.plan.label.short : p.code);
  const bd = r => (r ? ` +${r[0]}–${r[1]}영업일` : ''), bdEn = r => (r ? ` +${r[0]}–${r[1]} BD` : '');
  const incl = plan.filter(p => p.incl), tbd = plan.filter(p => p.tbd), opt = plan.filter(p => p.option), H = CAD_TRUST_COPY.plan.tbdHead;
  return {
    ko: `포함: ${incl.map(p => sh(p) + (p.addDays ? `(${bd(p.addDays).trim()})` : '')).join(', ')}${tbd.length ? ` · ${H.ko}: ${tbd.map(sh).join(', ')}` : ''}${opt.length ? ` · 옵션: ${opt.map(p => sh(p) + `(요청 시${p.code === 'KOLAS' || p.code === 'MTC32' ? ', 실비' : ''}${p.addDays ? ',' + bd(p.addDays) : ''})`).join(', ')}` : ''}`,
    en: `Incl.: ${incl.map(p => p.code).join(', ')}${tbd.length ? ` · ${H.en}: ${tbd.map(p => p.code).join(', ')}` : ''}${opt.length ? ` · Options: ${opt.map(p => p.code + bdEn(p.addDays)).join(', ')}` : ''}`,
  };
}
function cadTrustWrapDocPlan(orig) {
  if (typeof orig !== 'function' || orig.cadTrust) return orig;
  const f = function (x, D) {
    const r = orig(x, D);
    if (!r || !Array.isArray(r.plan)) return r;
    const ctx = cadTrustCtxOfLine(x), p = r.plan.find(q => q.code === 'MTC31_FWD');
    if (p) {
      const keep = p.incl && p.note && !/3\.1/.test(p.note) ? p.note : '';   // 예: '제작을 맡은 업체 명의'
      const m = cadTrustPlanMtr(ctx, !!p.incl, p.addDays || null);
      Object.assign(p, { incl: m.incl, option: m.option, tbd: m.tbd, note: [m.note, keep].filter(Boolean).join(' · '), addDays: m.addDays });
    }
    // 제조사 경도 기록·충격시험 결과도 제조사 문서다: 근거(hard100·impact)가 없으면 '포함'이 아니라 '확인 중'
    const s = cadMtrState(ctx), K = { HARD100: 'hard100', IMPACT: 'impact' };
    r.plan.forEach(q => {
      if (!K[q.code] || !q.incl) return;
      if (s.state === 'unconfirmed' || s.missing.includes(K[q.code]) || !s.extras.includes(K[q.code])) Object.assign(q, { incl: false, option: false, tbd: true, note: CAD_TRUST_COPY.plan.note.unconfirmed });
    });
    r.text = cadTrustPlanText(r.plan);
    return r;
  };
  f.cadTrust = true;
  return f;
}

/* C&D 규칙 덮어쓰기. c1_cd.js가 CD_RULES·CD_RULE·CD_DOC·CD_GC_T를 만든 뒤 한 번 부른다: cadTrustPatchCd(CD_RULE, CD_DOC, CD_GC_T).
   규칙의 ko·en·act·g·imp·offer는 (p, x) 함수를 받으므로, 줄마다 그 줄 재질의 품목군 상태로 문장이 갈린다.
   x.q.mat.code / x.q.mat.nut / x.q.type 만 읽는다. 바꾸는 규칙: Q-31-FWD, Q-31-LOT, Q-31-SELF, Q-PMI, Q-IMPACT, Q-VDRL */
const cadTrustCtxOfLine = x => {
  const q = (x && x.q) || {};
  return { mat: q.mat ? q.mat.code || null : null, nut: q.mat ? q.mat.nut || null : null, system: q.system || null, fin: q.fin ? q.fin.code || null : null };
};
function cadTrustCdText(id, x) {
  const s = cadMtrState(cadTrustCtxOfLine(x)), Tk = s.trace ? CAD_TRUST_COPY.trace[s.trace] : CAD_TRUST_COPY.trace.label;
  const T = {
    'Q-31-FWD': {
      confirmed: [`제조사 EN 10204 3.1(MTR) 원본을 수정 없이 전달합니다. 히트번호를 ${Tk.ko}과 대조하고, 서류가 붙는 품목은 한 상자에 한 히트만 담습니다.`,
        `The manufacturer's original EN 10204 3.1 (MTR) is forwarded unaltered. Heat numbers are matched to ${Tk.en}; one heat per box for certified items.`],
      confirmedCopy: [`제조사 EN 10204 3.1(MTR) 사본을 수정 없이 전달합니다(사본에서 바꾸는 것은 실제 납품 수량뿐, 원본은 요청 시 확인). 히트번호를 ${Tk.ko}과 대조하고, 서류가 붙는 품목은 한 상자에 한 히트만 담습니다.`,
        `A copy of the manufacturer's EN 10204 3.1 (MTR) is forwarded unaltered (only the delivered quantity may be changed; original available on request). Heat numbers are matched to ${Tk.en}; one heat per box for certified items.`],
      'on-request': ['제조사 EN 10204 3.1(MTR)은 주문 시 요청에 따라 공급처에서 받아 수정 없이 전달합니다. 비용과 추가 납기는 견적서 해당 줄에 적습니다.',
        'The manufacturer\'s EN 10204 3.1 (MTR) is obtained from the supplier when requested with the order and forwarded unaltered. Cost and added lead time are shown on the quotation line.'],
      unconfirmed: ['이 품목의 제조사 EN 10204 3.1(MTR) 제공 여부는 공급처에 확인하고 있습니다. 가능 여부, 원본·사본, 비용, 추가 납기를 회신 때 알려 드리며, 확인 전에는 3.1을 약속하지 않습니다.',
        'Availability of the manufacturer\'s EN 10204 3.1 (MTR) for this item is being confirmed with the supplier. We will advise availability, original or copy, cost and added lead time; no 3.1 is committed until confirmed.'],
    },
    'Q-31-LOT': {
      known: ['재고품에는 3.1이 없어, 3.1이 있는 로트로 수배합니다.', 'Stock lacks 3.1; a certified lot will be sourced.'],
      unconfirmed: ['재고품에는 3.1이 없습니다. 3.1이 있는 로트를 구할 수 있는지 공급처에 확인해 회신합니다.', 'Stock lacks 3.1. We will check with the supplier whether a certified lot is available and advise.'],
    },
    'Q-31-SELF': {
      known: ['볼트노트는 자기 명의로 EN 10204 3.1을 발행하지 않습니다(3.1은 제조자의 독립 검사 책임자가 검증하고, 유통업자는 전달만 합니다). 제조사 명의 3.1을 수정 없이 전달합니다.',
        'BoltNote does not issue EN 10204 3.1 in its own name (3.1 is validated by the manufacturer\'s independent inspection representative; intermediaries only forward). The manufacturer\'s 3.1 is forwarded unaltered instead.'],
      unconfirmed: ['볼트노트는 자기 명의로 EN 10204 3.1을 발행하지 않습니다(3.1은 제조자의 독립 검사 책임자가 검증하고, 유통업자는 전달만 합니다). 제조사 명의 3.1을 받을 수 있는지 공급처에 확인해 회신합니다.',
        'BoltNote does not issue EN 10204 3.1 in its own name (3.1 is validated by the manufacturer\'s independent inspection representative; intermediaries only forward). We will check whether the manufacturer\'s 3.1 is available and advise.'],
    },
    'Q-PMI': {
      on: ['PMI(XRF) 성분 확인은 외부 시험기관에 의뢰해 요청 시 수행하고, 시험기관 결과서를 그대로 첨부합니다. 비용은 실비, 납기는 견적서에 적습니다. B7과 B7M은 성분이 같은 계열이라 성분 분석으로 구분되지 않고, 304와 304L처럼 탄소만 다른 재질은 휴대용 XRF로 구분하지 못합니다. B7M은 경도 기록으로 확인합니다.',
        'PMI (XRF) by an external testing laboratory on request; the laboratory report is attached unaltered. Cost at actuals; lead time on the quotation. B7 and B7M have the same chemistry family and cannot be told apart by chemical analysis; handheld XRF cannot distinguish materials differing only in carbon, such as 304/304L. B7M is verified by hardness records.'],
      ask: [CAD_TRUST_COPY.pmi.ask.ko + ' 참고로 B7과 B7M은 성분 분석으로 구분되지 않고, 304와 304L은 휴대용 XRF로 구분하지 못합니다.',
        CAD_TRUST_COPY.pmi.ask.en + ' Note: B7 and B7M cannot be told apart by chemical analysis, and handheld XRF cannot distinguish 304 from 304L.'],
    },
    'Q-IMPACT': {
      known: ['저온용 볼팅은 제조사 3.1에 샤르피 결과를 포함합니다. 기본 시험온도는 L7·L43 −101 °C, L7M −73 °C이고, L7은 평균 27 J(20 ft-lbf) 이상입니다(공개 기술자료 기준).',
        'Low-temperature bolting: Charpy results in the manufacturer\'s 3.1. Default test temperature L7/L43 −101 °C, L7M −73 °C; L7 average ≥ 27 J (20 ft-lbf) (published technical data).'],
      unconfirmed: ['A320 저온 볼팅은 샤르피 충격시험이 규격 요구입니다(기본 시험온도 L7·L43 −101 °C, L7M −73 °C이고 L7은 평균 27 J(20 ft-lbf) 이상, 공개 기술자료 기준). 시험 결과가 실린 제조사 3.1을 받을 수 있는지는 공급처 확인 후 회신합니다.',
        'A320 low-temperature bolting requires Charpy impact testing (default L7/L43 −101 °C, L7M −73 °C; L7 average ≥ 27 J (20 ft-lbf); published technical data). Whether the manufacturer\'s 3.1 with impact results is available will be advised after supplier confirmation.'],
    },
    'Q-VDRL': {
      all: ['귀사 서류 요구 목록(VDRL/SDDR)에 대해: 제공 = CoC(F2.1), 포장 명세서, 유통 단계 검사 계획서, 서류 묶음(편철). 제조사 3.1·코팅 성적서 사본 = 줄별 서류 계획대로(공급처 확인 중인 줄은 회신 때 확정). 제공 불가 = 볼트노트 명의 제조 공정 ITP·열처리 절차서(제조사 문서로만 가능). 제출 일정은 발주 후 협의합니다.',
        'Against your VDRL/SDDR: provided = CoC (F2.1), packing list, distribution-stage inspection plan, compiled dossier. Manufacturer\'s 3.1 and coating certificate copies = per the line document plan (lines still being confirmed with suppliers are settled in our reply). Not provided = manufacturing ITP or heat-treatment procedures in BoltNote\'s name (manufacturer documents only). Schedule to be agreed after PO.'],
    },
  }[id];
  if (!T) return null;
  let key;
  if (id === 'Q-31-FWD') key = cadTrustKey(s);
  else if (id === 'Q-PMI') key = cadPmiOn(s.group) ? 'on' : 'ask';
  else if (id === 'Q-IMPACT') key = s.state === 'confirmed' && !s.missing.includes('impact') ? 'known' : 'unconfirmed';
  else if (id === 'Q-VDRL') key = 'all';
  else key = s.state === 'unconfirmed' ? 'unconfirmed' : 'known';
  return { key, state: s.state, ko: T[key][0], en: T[key][1] };
}
function cadTrustPatchCd(rules, docs, gcT) {
  if (!rules) return 0;
  const gc = Array.isArray(gcT) ? gcT.find(g => g && g.id === 'GC-T10') : null;
  if (gc) Object.assign(gc, { ko: CAD_TRUST_COPY.gcT10.ko, en: CAD_TRUST_COPY.gcT10.en });
  const R = Array.isArray(rules) ? Object.fromEntries(rules.map(r => [r.id, r])) : rules;
  let n = 0;
  const txt = id => ({ ko: (p, x) => (cadTrustCdText(id, x) || {}).ko || '', en: (p, x) => (cadTrustCdText(id, x) || {}).en || '' });
  const set = (id, extra) => { if (!R[id]) return; Object.assign(R[id], txt(id), extra || {}); n++; };
  set('Q-31-FWD', {
    act: (p, x) => (cadTrustCdText('Q-31-FWD', x).state === 'unconfirmed' ? 'CONFIRM' : 'INFO'),
    g: (p, x) => '31-' + cadTrustCdText('Q-31-FWD', x).key,
    offer: (p, x) => {
      const t = cadTrustCdText('Q-31-FWD', x);
      return t.state === 'unconfirmed' ? { ko: '제조사 MTR(EN 10204 3.1) — 공급처 확인 후 회신', en: 'Manufacturer\'s MTR (EN 10204 3.1) — to be confirmed with the supplier' }
        : { ko: CAD_TRUST_COPY.plan.label.ko, en: CAD_TRUST_COPY.plan.label.en };
    },
    imp: (p, x) => (cadTrustCdText('Q-31-FWD', x).state === 'unconfirmed' ? { kind: 'tbd', docs: { ko: '제조사 MTR 확인 중', en: 'Mfr. MTR TBC' } } : { kind: 'none', docs: { ko: '제조사 MTR 포함', en: 'Mfr. MTR incl.' } }),
  });
  set('Q-31-LOT', { g: (p, x) => 'lot-' + cadTrustCdText('Q-31-LOT', x).key });
  set('Q-31-SELF', {
    g: (p, x) => 'self-' + cadTrustCdText('Q-31-SELF', x).key,
    offer: (p, x) => (cadTrustCdText('Q-31-SELF', x).key === 'unconfirmed'
      ? { ko: '제조사(또는 제작을 맡은 업체) 명의 EN 10204 3.1 — 제공 여부 공급처 확인 후 회신', en: 'EN 10204 3.1 issued by the manufacturer (or the shop making the part) — availability to be confirmed with the supplier' }
      : { ko: '제조사(또는 제작을 맡은 업체) 명의 EN 10204 3.1 수정 없이 전달', en: 'EN 10204 3.1 issued by the manufacturer (or the shop making the part), forwarded unaltered' }),
  });
  set('Q-PMI', {
    g: (p, x) => 'pmi-' + cadTrustCdText('Q-PMI', x).key,
    imp: (p, x) => (cadTrustCdText('Q-PMI', x).key === 'on' ? { kind: 'option' } : { kind: 'tbd' }),
  });
  set('Q-IMPACT', {
    g: (p, x) => 'impact-' + cadTrustCdText('Q-IMPACT', x).key,
    imp: (p, x) => ({ kind: 'tbd', docs: cadTrustCdText('Q-IMPACT', x).key === 'known' ? { ko: '충격시험 결과 (제조사 3.1)', en: 'Impact results (mfr. 3.1)' } : { ko: '충격시험 결과 (공급처 확인 중)', en: 'Impact results (TBC with supplier)' } }),
  });
  set('Q-VDRL');
  if (docs && docs.MTC31_FWD) Object.assign(docs.MTC31_FWD, CAD_TRUST_COPY.plan.label);
  return n;
}
// 엔진 상태 문구 (e7_status 106행 대체). sp = 고객이 적은 특수 요구 집합 판정 함수, x = 엔진 줄
function cadTrustStatusText(hasCert, hasPmi, x) {
  const s = cadMtrState(cadTrustCtxOfLine(x)), S = CAD_TRUST_COPY.status, out = [];
  if (hasCert) out.push(s.state === 'unconfirmed' ? S.certUnconfirmed : S.certKnown);
  if (hasPmi) out.push(cadPmiOn(s.group) ? S.pmiOn : S.pmiAsk);
  return out.join(' ');
}
const cadTrustF3125Text = x => (cadMtrState(cadTrustCtxOfLine(x)).state === 'unconfirmed' ? CAD_TRUST_COPY.status.f3125Ask : CAD_TRUST_COPY.status.f3125Known);

/* 데이터시트 서류 칸. ctx = { fam, grade, fin } (cadMtrState와 같은 형식)
   돌려주는 것: 행 [{k, name, std, state, text}] — 렌더러는 cadTrustDsDocsHtml */
function cadTrustDsDocs(ctx) {
  const s = cadMtrState(ctx), D = CAD_TRUST_COPY.ds, rows = [];
  rows.push({ k: 'coc', name: D.coc[0], std: D.coc[1], state: D.coc[2], text: '' });
  rows.push({ k: 'mtr', name: D.mtr[0], std: s.cert === 'cmtr' ? '제조사 시험성적서' : D.mtr[1], state: D.state[cadTrustKey(s)], text: cadTrustLine(s), tag: cadTrustTag(s) });
  cadTrustExtraLines(s).forEach(x => rows.push({ k: x.key, name: '', std: '', state: x.ok ? '포함' : '확인 중', text: x.text }));
  rows.push({ k: 'third', name: D.third[0], std: D.third[1], state: D.third[2], text: '' });
  if (cadPmiOn(s.group)) rows.push({ k: 'pmi', name: D.pmi[0], std: D.pmi[1], state: D.pmi[2], text: '' });
  rows.push({ k: 'decl', name: D.decl[0], std: D.decl[1], state: D.decl[2], text: '' });
  return { state: s.state, group: s.group, rows, foot: cadTrustFill(D.foot, { date: CAD_MTR.updated || '(출력일)' }) };
}
function cadTrustDsDocsHtml(ctx, printedYmd) {
  const d = cadTrustDsDocs(ctx), e = cadTrustEsc;
  const foot = CAD_MTR.updated ? d.foot : cadTrustFill(CAD_TRUST_COPY.ds.foot, { date: printedYmd || '(출력일)' });
  return `<table class="cad-ds-docs"><thead><tr><th scope="col">서류</th><th scope="col">발행·기준</th><th scope="col">상태</th></tr></thead><tbody>${d.rows.map(r =>
    `<tr class="r-${r.k}"><th scope="row">${e(r.name)}</th><td>${r.text ? e(r.text) + (r.std && !r.text.includes(r.std) ? `<span class="ds-sub">${e(r.std)}</span>` : '') : e(r.std)}</td><td class="ds-st">${r.tag ? `<span class="tag ${r.tag.cls}">${e(r.state)}</span>` : e(r.state)}</td></tr>`).join('')}</tbody></table><p class="cad-ds-foot">${e(foot)}</p>`;
}

// 추적성 설명 블록 (6장 E 구역 품질 서류 안내 아래, 또는 5장 cert 탭 아래)
function cadTrustTraceHtml() {
  const T = CAD_TRUST_TRACE, e = cadTrustEsc, rows = T.rows.slice();
  if (cadPmiOn()) rows.splice(rows.length - 1, 0, T.pmiRow);
  return `<div class="stack cad-trace"><h3>${e(T.title)}</h3><p class="small">${e(T.lead)}</p><dl class="kv">${rows.map(([k, v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl></div>`;
}

/* ───────── 5. 배선 (cad/trust_wire.js — src/t_trust.js 끝에 붙는다. 위 1–4절은 cad/trust_data.js 그대로) ─────────
   VIEW 블록에서 페이지 시작(go(start)) 전에 한 번 실행된다. c1_cd.js·v*.js를 고치지 않고 런타임에 문구를 플래그로 바꾼다.
   - INCH 품목: f.docs / f.docsHtml (3-n장 서류 칸, 첫 등급 기준) · f.docTag / f.docTagCls (부품표 서류 태그 = 가족의 가장 낮은 상태)
   - C&D: Q-31-FWD · Q-31-LOT · Q-31-SELF · Q-PMI · Q-IMPACT · Q-VDRL 문구, GC-T10, MTC31_FWD 표시 이름
   - cdDocPlan: MTC31_FWD · HARD100 · IMPACT는 근거가 없으면 '포함'이 아니라 '확인 중'
   화면 문구 자리(홈 띠·3장 머리·3-n 서류 칸·서류 선택 이름·도움말·옛 3.1 문구)는 src/cad_trust.hooks.json이 바꾼다. */
try { cadTrustApplyInch(INCH); } catch (e) { console.warn('trust: INCH', e); }
try { if (typeof CD_RULE !== 'undefined') cadTrustPatchCd(CD_RULE, typeof CD_DOC !== 'undefined' ? CD_DOC : null, typeof CD_GC_T !== 'undefined' ? CD_GC_T : null); } catch (e) { console.warn('trust: C&D rules', e); }
try { if (typeof cdDocPlan === 'function') cdDocPlan = cadTrustWrapDocPlan(cdDocPlan); } catch (e) { console.warn('trust: doc plan', e); }
// 3-n장에서 등급을 바꾸면 서류 칸·도움말·'제조사 3.1' 선택지 이름을 그 등급의 품목군 상태로 다시 쓴다 (hh·ats처럼 등급마다 품목군이 다른 가족)
function cadTrustInchDocs(f, grade, fin) {
  const dd = document.getElementById('i-docs'); if (dd) dd.innerHTML = cadTrustFamDocs(f, grade, fin).html;
  const h = document.getElementById('i-doc-h'); if (h) h.textContent = cadTrustDocHint({ fam: f.id, grade });
  const sel = document.getElementById('i-doc');
  if (sel) [...sel.options].forEach(o => { if (o.value === '제조사 3.1 사본') o.textContent = cadTrustDocOpt({ fam: f.id, grade }); });
}
// 시험용 (tests only): 플래그 객체와 다시 적용
window.__cadTrustTest = { CAD_MTR, apply: () => cadTrustApplyInch(INCH), state: ctx => cadMtrState(ctx), line: ctx => cadTrustLine(ctx) };
