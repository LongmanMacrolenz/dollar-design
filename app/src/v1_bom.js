/* ── 4A장 BOM 견적 (워크벤치) · 4A-1 견적서 묶음: 상태 · 계산 · 동작 ──
   계산: cdItems(bomRows → bomLine, 구역 제목 줄 문맥) → cdBuild(C&D 문서) (BOM ENGINE 블록).
   화면: v2_wb.js(4A 워크벤치), v3_quote.js(4A-1 문서), v4_out.js(내보내기·인쇄·저장). 이름은 bom·wb·qd 접두사. */
const BOM_SAMPLE = ['No\tPart No.\tDescription\tQty\tUnit',
  '1\tP-1001\tSCR, SET, SKT, CUP PT, 3/8-16 UNC X 1/2 LG, ALLOY STL, BLK OX, ASTM F912\t50\tEA',
  '2\tP-1002\t무두볼트 M6x8 컵포인트 흑색\t100\tEA',
  '3\tP-1003\t렌치볼트 M10x30 12.9\t200\tEA',
  '4\tP-1004\tHHCS 1/2-13 X 2 GR5 ZP\t100\tEA',
  '5\tP-1005\tSTUD B7 W/2 NUTS 3/4-10 X 4-3/4\t32\tSET',
  '6\tP-1006\tFW 1/2 F436 THRU HARD\t100\tEA',
  '7\tP-1007\tHEX BOLT M16x70 10.9 GEOMET\t40\tEA',
  '8\tP-1008\tSTUD 7/8-9 x 5-1/2 B7/2H XYLAN 1424 BLUE\t48\tSET',
  '9\tP-1009\tSHCS M10x37 12.9\t40\tEA',
  '10\tP-1010\tSET SCREW M16x25 ISO 4029 45H ZINC\t20\tEA',
  '11\tP-1011\tHELICOIL INSERT M10x1.5 x 1.5D SST\t50\tEA',
  '12\tP-1012\tGASKET SPW 4" CL300 316/GRAPHITE ASME B16.20\t2\tEA'].join('\n');
// 상태 표시: [글자, 태그 종류]. 색만으로 나누지 않고 언제나 글자를 같이 쓴다 (흑백 인쇄에서도 구분)
const BOM_ST = { catalog: ['카탈로그 품목', 'ok'], 'engineer-quote': ['엔지니어 견적', 'q'], 'not-available': ['공급 불가', 'crit'], excluded: ['제외', 'ex'] };
// 예외 큐 분류 (사양 2.8절 순서 = 단축키 1–6)
const WB_Q = [['conflict', '충돌', '사양끼리 맞지 않는 조합입니다'], ['unread', '읽지 못함', '품목이나 호칭을 읽지 못했습니다'], ['ambiguous', '모호', '읽은 값이 맞는지 확인해 주세요'],
  ['dev', '편차 제안', '원 사양과 다른 품목으로 견적했습니다'], ['qty', '수량 확인', '수량을 그대로 믿기 어렵습니다'], ['na', '공급 불가 확인', '공급하지 않는 줄로 분류했습니다. 잘못 읽은 줄이 아닌지 확인해 주세요']];
const WB_QK = Object.fromEntries(WB_Q.map(([k, l, w], i) => [k, { n: i + 1, l, w }]));
const BOM_NA_LINE = 'Not available — 이 줄은 다른 공급처에서 알아보세요';
const BOM_NA_HEAD = 'Not available';   // 안내 문장(SHOP_TERMS.notAvail)이 바로 뒤에 붙는 자리: 같은 말을 두 번 하지 않게 머리말만
const BOM_DEF = { text: BOM_SAMPLE, sample: true, ov: {}, filter: 'review', map: null, mapHead: null, open: null, file: '', rfq: {}, dec: {}, ok: {}, orig: {}, excl: {}, qno: null, issued: {},
  doc: 'quote', unpriced: false, part: 'all', lang: 'both', keys: true, q: '' };
state.bom = (() => {
  const b = store.get('bom', null);
  if (!b || typeof b.text !== 'string') return JSON.parse(JSON.stringify(BOM_DEF));
  const s = { ...JSON.parse(JSON.stringify(BOM_DEF)), ...b };
  for (const k of ['ov', 'rfq', 'dec', 'ok', 'orig', 'excl', 'issued']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
  if (!Array.isArray(s.map)) s.map = null;
  if (!['review', 'all', 'catalog', 'engineer-quote', 'not-available'].includes(s.filter)) s.filter = 'review';
  return s;
})();
const BOM_KEEP = ['text', 'sample', 'ov', 'filter', 'map', 'mapHead', 'file', 'rfq', 'dec', 'ok', 'orig', 'excl', 'qno', 'issued', 'doc', 'unpriced', 'part', 'lang', 'keys'];
const bomSave = () => { const B = state.bom; store.set('bom', Object.fromEntries(BOM_KEEP.map(k => [k, B[k]]))); };
// 새 BOM을 넣으면 줄에 묶인 판단(수락·제외·원 사양·고친 값)과 견적번호를 비운다
function bomNewText(t, sample = false) {
  Object.assign(state.bom, { text: t, sample, map: null, mapHead: null, open: null, ov: {}, dec: {}, ok: {}, orig: {}, excl: {}, qno: null, file: '', q: '' });
  BOM_UNDO.length = 0; BOM_SEL.clear(); bomSave();
}

/* ── 되돌리기 (최근 20 동작). 붙여넣은 글은 textarea 자체 되돌리기에 맡긴다 ── */
const BOM_UNDO = [];
const BOM_SEL = new Set();          // 고른 줄 (화면 안에서만)
function bomDo(label, fn) {
  const B = state.bom;
  BOM_UNDO.push({ label, s: JSON.stringify({ ov: B.ov, dec: B.dec, ok: B.ok, orig: B.orig, excl: B.excl }) });
  if (BOM_UNDO.length > 20) BOM_UNDO.shift();
  fn(); bomSave();
}
function bomUndo() {
  const u = BOM_UNDO.pop(); if (!u) return null;
  Object.assign(state.bom, JSON.parse(u.s)); bomSave(); return u.label;
}

/* ── 견적번호·날짜 ── */
function bomQuoteNo(text) { const d = kstNow(); return `BQ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${cdHash(text).slice(0, 4).toUpperCase()}`; }
const qYmd = d => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;   // 페이지의 ymd(2026-10-01)와 이름이 겹쳐 q 접두사
// 'YYYY-MM-DD' 또는 Date → Date (시간대 영향 없이 날짜만)
const bomDay = v => { if (!v) return null; if (v instanceof Date) return v; const m = String(v).match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
const bomMD = v => { const d = bomDay(v); return d ? `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})` : ''; };
const bomRef = x => x.row.no || String((x.n || x.row.i + 1));
const bomDwgRef = (qno, x) => `${qno}-D${bomRef(x)}`;
const bomUnit = m => m.unit === 'SET' ? '세트' : 'EA';

/* ── RFQ 머리 (S0) → cdBuild rfq ── */
const BOM_DOCS = [['3.1', '제조사 3.1 사본'], ['2.2', '제조사 2.2 사본'], ['KOLAS', 'KOLAS 시험'], ['3.2', '3.2 입회 검사'], ['PMI', 'PMI'], ['origin', '원산지 증빙']];
function bomBasis(t) {
  return String(t || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
    const no = /못\s*받|받지\s*못|미수령|언급만|참조만|not\s*received/i.test(s);
    const rev = (s.match(/\bRev\.?\s*([A-Z0-9]+)/i) || [])[1] || '';
    const doc = s.replace(/\(.*?\)/g, '').replace(/\bRev\.?\s*[A-Z0-9]+/i, '').replace(/받음|못\s*받음|받지\s*못함|미수령|언급만|참조만/g, '').replace(/[·,]\s*$/, '').trim();
    return { doc: doc || s, rev, received: !no };
  });
}
function bomRfq(B = state.bom) {
  const r = B.rfq || {}, ctx = {};
  if (r.api610) ctx.api610 = r.api610;
  if (r.nace) ctx.nace = r.nace;
  if (r.exposure) ctx.exposure = r.exposure;
  if (r.mdmt !== '' && r.mdmt != null && !isNaN(+r.mdmt)) ctx.mdmtC = +r.mdmt;
  if (r.flange) ctx.flange = r.flange;
  if (Array.isArray(r.docs) && r.docs.length) ctx.docs = r.docs;
  if (r.due) ctx.requiredDate = r.due;
  const firm = r.offer === 'firm', rv = r.review || {};
  return {
    project: r.project || '', client: r.client || '', clientRef: { rfqNo: r.rfqNo || '', rev: r.rfqRev || '', bomFile: B.file || undefined },
    basis: bomBasis(r.basis), context: ctx, contextText: r.text || '', offerType: firm ? 'firm' : 'indicative',
    review: rv.ok && rv.by ? { ok: true, by: rv.by, at: rv.at || '' } : undefined, decisions: B.dec, roles: B.map || undefined, preparedBy: r.attnBy || null,
  };
}

/* ── 계산: 줄(cdItems) 캐시 → C&D 문서(cdBuild) 캐시 ── */
let bomCacheI = null, bomCacheD = null, bomCacheV = null;
// '원 사양 그대로' (R): 카탈로그 대안 대신 원 사양을 엔지니어 견적으로. 편차 행(D)은 그대로 남아 '반려'로 기록된다
function bomKeepOrig(m) {
  return { ...m, status: 'engineer-quote', pn: null, price: null, amount: null, packPlan: null, tier: null, stock: false, ship: null, leadDays: null,
    indicative: m.price != null ? (PRICE_ON(m.fam) ? `편차안 ${m.pn} ${won(m.price)}/${bomUnit(m)} (참고) · 원 사양은 회신 후 확정` : `편차안 ${m.pn} · 원 사양은 회신 후 확정`) : m.indicative,
    reasons: [{ tone: 'warn', text: '원 사양 그대로 견적을 요청하셨습니다. 원 사양 수배 가능 여부와 단가·납기를 회신합니다.', lead: 'check', kind: 'other' }, ...(m.reasons || [])],
    leadText: '견적 회신 · 원 사양 수배 확인 후 납기 확정',
    lead: { code: 'NO_SOURCE', label: '견적 문의', dispatch: null, toCustomer: null, cutoff: null, returnable: null, requiresQuote: true, validityDays: null, shipDate: null, basis: '원 사양 유지 요청', example: false, text: '견적 문의 · 원 사양 수배 확인 후 회신' },
    tierCode: 'NO_SOURCE', ev: [...(m.ev || []), { rule: 'K-EQ', why: 'item' }], keptOrig: true };
}
/* 가격 스위치 (IA 명세 7.1 '가격 표시 규칙'): 공급처 단가를 확인한 품목(PRICE_ON)만 가격을 보인다.
   그 밖의 카탈로그 줄은 상태(규격품)는 그대로 두고 단가·금액·수량 단가 안내·포장 금액을 지우고 '단가 확인 중'으로 둔다.
   견적 줄의 대안 품목 참고가도 같은 규칙. 엔진 결과(window.__bomTest)는 바꾸지 않는다 (화면 계산에서만). */
const bomPxPn = pn => { const p = pn && parsePn(pn); return !!p && PRICE_ON(p.f.id); };
const bomNoWon = s => String(s || '').replace(/\s*[·,]?\s*(?:합계\s*)?₩[\d,]+(?:\/[A-Z가-힣]+)?(?:으로)?/g, '').replace(/\s{2,}/g, ' ').trim();
function bomPriceHold(m) {
  if (!m) return m;
  let o = m;
  if (m.status === 'catalog' && m.price != null && !PRICE_ON(m.fam)) {
    o = { ...m, price: null, amount: null, tier: null, priceHeld: true, indicative: '',
      packPlan: m.packPlan ? { ...m.packPlan, amount: null, unit: null, base: null, packs: (m.packPlan.packs || []).map(k => ({ ...k, price: null })), note: String(m.packPlan.note || '').replace(/\.?\s*합계 ₩[\s\S]*$/, '.').replace(/,\s*실제 개당 ₩[\d,]+/, '') } : null,
      ev: (m.ev || []).filter(e => e.rule !== 'K-TIER') };
  }
  if (o.alt && o.alt.price != null && !bomPxPn(o.alt.pn)) o = { ...o, alt: { ...o.alt, price: null }, indicative: o.indicative ? bomNoWon(o.indicative) : o.indicative };
  if (o.indicative && /₩/.test(o.indicative) && !(o.alt && o.alt.price != null)) o = { ...o, indicative: bomNoWon(o.indicative) };
  return o;
}
/* 붙여넣은 글 → 줄 (cdItems와 같은 방식 + 구역 제목 판정 보강).
   수량이 없고 문맥(플랜지·API 610·태그)이 있어도, 품목을 읽을 수 있는 줄(GASKET SPW 4" CL300 등)은 구역 제목이 아니라 견적 줄로 둔다
   (사양 2.3: 품명만 있고 수량·호칭이 없는 행만 구역 제목) */
function bomItems(text, rfq, ovOf) {
  const parsed = bomRows(text, rfq.roles), rctx = cdRfqCtx(rfq), out = [], seen = {};
  let sec = null;
  for (const r of parsed.rows) {
    let s = cdSectionOf(r);
    if (s) { const t = parseCore(r.text, {}).type; if (t && t !== 'unknown' && t !== 'nonfast') s = null; }
    if (s) { sec = { ...s, text: r.text, no: r.no }; out.push({ row: r, section: true, sec }); continue; }
    const api = sec?.api610 || rctx.api610 || null;
    const k = `${r.text}§${(seen[r.text] = (seen[r.text] || 0) + 1)}`;
    const L = bomLine(r, (ovOf && ovOf(k, r)) || {}, api ? { api610: api } : {});
    L.key = k; if (sec) L.sec = sec;
    out.push(L);
  }
  return { parsed, items: out };
}
function bomCompute() {
  const B = state.bom, rfq = bomRfq(B);
  const ik = JSON.stringify([B.text, B.map, B.ov, B.orig, rfq.context, rfq.contextText]);
  if (!bomCacheI || bomCacheI.key !== ik) {
    const t0 = performance.now();
    const { parsed, items: all } = bomItems(B.text, rfq, k => B.ov[k]);
    let n = 0;
    for (const x of all) { if (x.section) continue; x.n = ++n; if (B.orig[x.key] && x.m.status === 'catalog') x.m = bomKeepOrig(x.m); x.m = bomPriceHold(x.m); }
    bomCacheI = { key: ik, parsed, all, items: all.filter(x => !x.section), ms: performance.now() - t0 };
    bomCacheD = null;
  }
  // 발행한 Rev 그대로면 그 Rev를 다시 만들고(같은 날짜·번호), 고쳤으면 다음 Rev 초안
  const I = bomCacheI, qno = B.qno || bomQuoteNo(B.text), revs = cdLoadRevs(qno), last = revs[revs.length - 1] || null;
  const baseKey = cdHash(JSON.stringify([ik, B.dec, B.excl, B.rfq, qno]));
  const issued = !!(last && B.issued[`${qno}|${last.rev}`] === baseKey), prev = issued ? revs[revs.length - 2] || null : last;
  if (issued) { rfq.rev = last.rev; rfq.date = String(last.issuedAt).slice(0, 16); }
  const dk = JSON.stringify([ik, B.dec, B.excl, B.rfq, qno, revs.length, issued]);
  if (!bomCacheD || bomCacheD.key !== dk) {
    const t0 = performance.now();
    // cdBuild와 같은 방식의 줄 열쇠 (원문|품번 해시 #같은 원문 몇 번째)
    const seen = {};
    const lk = I.items.map(x => { const b = cdLineKeyOf(x.row?.text ?? x.q.raw, x.row?.pn || ''); return `${b}#${(seen[b] = (seen[b] || 0) + 1)}`; });
    rfq.quoteNo = qno; rfq.excluded = I.items.map((x, i) => B.excl[x.key] ? lk[i] : null).filter(Boolean);
    let doc = cdBuild(I.all, rfq, prev);
    // 이전 Rev에서 물려받은 줄 열쇠가 달라 제외가 빠졌으면 문서의 열쇠로 한 번 더
    const miss = I.items.map((x, i) => B.excl[x.key] && doc.lines[i] && doc.lines[i].status !== 'excluded' ? doc.lines[i].lineKey : null).filter(Boolean);
    if (miss.length) { rfq.excluded = [...rfq.excluded, ...miss]; doc = cdBuild(I.all, rfq, prev); }
    bomCacheD = { key: dk, doc, rfq, qno, prev, issued, baseKey, revs, ms: performance.now() - t0 };
    bomCacheV = null;
  }
  const D = bomCacheD, vk = D.key + JSON.stringify(B.ok);
  if (bomCacheV && bomCacheV.key === vk) return bomCacheV;
  const doc = D.doc;
  const L = I.items.map((x, i) => ({ x, l: doc.lines[i], i, key: x.key, q: [], rows: [], qrows: [] }));
  const byLK = new Map(L.map(v => [v.l.lineKey, v]));
  for (const r of doc.rows) if (!r.withdrawn) for (const ln of r.lines) { const v = byLK.get(ln.key); if (v) v.rows.push(r); }
  for (const v of L) {
    v.qrows = v.rows.filter(r => WB_QK[r.queue] && !CD_RESOLVED.has(r.status));
    v.q = WB_Q.map(([k]) => k).filter(k => v.qrows.some(r => r.queue === k));
    v.ex = v.l.status === 'excluded';
    v.need = !v.ex && !B.ok[v.key] && v.q.length > 0;
    v.cat = v.need ? v.q[0] : null;
  }
  const res = { key: vk, qno: D.qno, prev: D.prev, issued: D.issued, baseKey: D.baseKey, revs: D.revs, rfq: D.rfq, parsed: I.parsed, all: I.all, items: I.items, L, doc, ms: { items: I.ms, cd: D.ms } };
  res.sum = bomSummary(res);
  return (bomCacheV = res);
}
// 카탈로그 품목 줄의 출고일 (오너 결정 2026-10-01): 날짜는 모든 줄이 자체 재고 티어(OWN_STOCK, 지금은 꺼짐)일 때만. 아니면 BOM_SHIP_TBD
const bomShipOk = leads => leads.length > 0 && leads.every(L => L && L.code === 'OWN_STOCK' && L.shipDate);
// 4A 요약·견적서 납품기한·엑셀 '납기' 칸 공용: 카탈로그 품목 줄 출고일 문구 (날짜 형식 fmt)
const bomCatShipTxt = (s, fmt) => !s.cat.length ? '—' : s.shipOk && s.lastShip ? `${fmt(s.lastShip)} 출고 (가장 늦은 줄)` : BOM_SHIP_TBD;
// 준수 요약 '카탈로그 품목 출고' 칸 (화면·엑셀 공용)
const bomLatestTxt = d => { const C = d.compliance; if (!C.lead.latest) return '—'; return bomShipOk(d.lines.filter(l => l.lead?.shipDate).map(l => l.lead)) ? `${C.lead.latest.label} (BOM No ${C.lead.latest.ref})` : BOM_SHIP_TBD; };
// 요약: 줄 수·큐·합계 (합계는 cdBuild의 bomTotals = 견적함과 같은 식: VAT = round((공급가 + 운임) × 0.1))
function bomSummary(c) {
  const L = c.L, st = s => L.filter(v => !v.ex && v.x.m.status === s);
  const cat = st('catalog'), eq = st('engineer-quote'), na = st('not-available'), ex = L.filter(v => v.ex), need = L.filter(v => v.need);
  const byQ = Object.fromEntries(WB_Q.map(([k]) => [k, need.filter(v => v.cat === k).length]));
  const t = c.doc.totals;
  const lastShip = cat.map(v => v.l.lead?.shipDate).filter(Boolean).sort().pop() || null;
  const shipOk = bomShipOk(cat.map(v => v.l.lead));   // 자체 재고 줄뿐일 때만 마지막 출고일을 날짜로 쓴다 (BOM_SHIP_TBD)
  const lastReply = eq.map(v => v.l.replyBy).filter(Boolean).sort().pop() || null;
  // 기본값 모두 승인 대상: 모호·편차·공급 불가 확인 (충돌·읽지 못함·수량 확인은 사람이 고른다: 수량은 기본값이 아니다)
  const defaults = need.filter(v => !v.q.includes('conflict') && !v.q.includes('qty') && v.cat !== 'unread');
  return { n: L.length, cat, eq, na, ex, need, byQ, auto: L.filter(v => !v.ex && !v.need && v.x.m.status !== 'not-available' && v.x.m.status !== 'engineer-quote').length,
    sub: t.sub, ship: t.ship, vat: t.vat, total: t.total, words: t.wordsDoc, wordsOk: t.wordsOk && wonKoNum(t.wordsDoc) === t.total, ref: t.reference,
    lastShip, shipOk, lastReply, rows: c.doc.statement.counts.rows, defaults, qtyChk: L.filter(v => !v.ex && v.x.m.status !== 'not-available' && v.x.m.qtyWarn) };
}

/* ── 동작 (모두 되돌리기 한 단계) ── */
const bomNowStamp = () => cdStamp(kstNow());
const BOM_BY = '구매자 (워크벤치)';
// 한 줄 수락: 이 줄의 제안을 모두 받아들인다. 행의 모든 줄이 수락되면 그 C&D 행은 '수락(워크벤치)'
function bomAcceptLines(keys, { keepD = false } = {}) {
  const c = bomCompute(), B = state.bom, set = new Set(keys);
  for (const k of set) B.ok[k] = 1;
  const touched = new Map();
  for (const v of c.L) if (set.has(v.key)) for (const r of v.qrows) touched.set(r.key, r);
  const okOf = new Map(c.L.map(v => [v.l.lineKey, !!B.ok[v.key]]));
  for (const r of touched.values()) {
    if (keepD && r.type === 'D') continue;                     // 기본값 승인: 편차는 대안 가격으로 두고 D행은 열림
    if (r.lines.every(l => okOf.get(l.key))) B.dec[r.key] = { status: 'ACCEPTED_WB', by: BOM_BY, at: bomNowStamp() };
  }
}
// 규칙 묶음 수락 (Shift+A): 같은 C&D 행(규칙 + 묶음 열쇠)에 속한 줄만
function bomAcceptRow(row) { state.bom.dec[row.key] = { status: 'ACCEPTED_WB', by: BOM_BY, at: bomNowStamp() }; }
// 기본값 모두 승인 (사양 2.9절): 모호·공급 불가 확인 → 수락 (수량 확인 줄은 줄 편집에서만), 편차 → 대안 가격 + D행 열림, 충돌·읽지 못함은 그대로
function bomAcceptDefaults() { const s = bomCompute().sum; bomAcceptLines(s.defaults.map(v => v.key), { keepD: true }); return s.defaults.length; }
// 원 사양 그대로 (R): 편차 줄을 엔지니어 견적으로. 묶음의 모든 줄이 원 사양이면 D행은 '반려'
function bomKeepOrigLines(keys) {
  const c = bomCompute(), B = state.bom, set = new Set(keys);
  for (const k of set) { B.orig[k] = 1; B.ok[k] = 1; }
  const origOf = new Map(c.L.map(v => [v.l.lineKey, !!B.orig[v.key]]));
  for (const v of c.L) if (set.has(v.key)) for (const r of v.rows) if (r.type === 'D' && r.lines.every(l => origOf.get(l.key))) B.dec[r.key] = { status: 'REJECTED', by: BOM_BY, at: bomNowStamp(), reply: '편차 반려 · 기재 사양대로 견적 요청' };
}
function bomExclude(keys, on) { const B = state.bom; for (const k of keys) { if (on) B.excl[k] = 1; else delete B.excl[k]; } }
function bomSetOv(key, ov) { const B = state.bom; if (ov && Object.keys(ov).length) B.ov[key] = ov; else delete B.ov[key]; delete B.ok[key]; }
// 고른 줄 일괄 수정: 재질·표면처리·수량 배수
function bomBulk(keys, { mat, fin, mult }) {
  const c = bomCompute(), B = state.bom;
  for (const v of c.L) {
    if (!keys.includes(v.key)) continue;
    const ov = { ...(B.ov[v.key] || {}) };
    if (mat) ov.mat = mat; if (fin) ov.fin = fin;
    if (mult && mult !== 1) ov.qty = String(Math.max(0, Math.round(v.x.m.qty * mult)));
    B.ov[v.key] = ov; delete B.ok[v.key];
  }
}

/* ── 견적함에 담기: 몇 번을 눌러도 같은 결과 (이 BOM에서 담았던 줄과 처음 방문 예시 줄을 지우고 다시 담는다) ── */
function bomToCart(btn) {
  const c = bomCompute(); let a = 0, b = 0, z = 0, zp = 0, zq = 0;
  const before = state.cart.filter(l => l.bom).length;
  state.cart = state.cart.filter(l => !l.bom && !l.sample);
  const ref = x => `BOM No ${bomRef(x)}${x.row.pn ? ' · 고객 품번 ' + x.row.pn : ''}`;
  c.L.forEach(({ x, ex, need, q }) => {
    if (ex) return;
    if (need && q.includes('qty') && x.m.status !== 'not-available') { zq++; return; }   // 고객이 주지 않은 수량은 담지 않는다 (줄에서 수량을 고치거나 수락한 뒤 담기)
    if (x.m.status === 'catalog') {
      if (!(x.m.qty > 0)) z++;
      else if (parsePn(x.m.pn)) { state.cart.push({ type: 'item', pn: x.m.pn, qty: x.m.qty, bom: true, ref: ref(x) }); a++; }
      else zp++;   // 2장 형번 규칙에 없는 조합 (엔진과 기본 장이 어긋난 경우): 조용히 빼지 않고 알린다
    } else if (x.m.status === 'engineer-quote') {
      state.cart.push({ type: 'quote', fam: 'bom', bom: true, title: `${bomEnLine(x).ko} (${ref(x)})`, en: bomEnLine(x).en, spec: `${x.m.spec} / 원문: ${x.row.text} / 확인: ${x.m.reasons.filter(r => r.tone !== 'info').map(r => r.text).join(' ')}`, qty: Math.max(1, x.m.qty), unit: bomUnit(x.m) }); b++;
    }
  });
  saveCart();
  toast(`${before ? '이 BOM 줄을 새로 바꿔 ' : ''}카탈로그 품목 ${a}종, 견적 요청 ${b}건을 견적함에 담았습니다${c.sum.na.length ? ` · 공급 불가 ${c.sum.na.length}건 제외` : ''}${z ? ` · 수량 0인 ${z}줄 제외` : ''}${zp ? ` · 형번 확인이 필요한 ${zp}줄 제외` : ''}${zq ? ` · 수량 확인이 필요한 ${zq}줄 제외 (4A에서 수량을 고친 뒤 다시 담기)` : ''}`);
  if (btn) btn.textContent = '다시 담기 (최신 BOM으로 바꿈)';
}
// 검색에서 고른 BOM 카탈로그 형번 (IHCS-… 등): 품목 장이 없으므로 한 포장 수량으로 견적함에 담는다 (단가·출고는 품목군 vi())
function bomPnToCart(pn) {
  const p = parsePn(pn); if (!p) return false;
  const n = Math.max(1, +(p.f.pack ? p.f.pack(p.size) : 1) || 1);
  if (addItem(pn, n)) { toast(`${pn} ${n.toLocaleString()}개(1포장)를 견적함에 담았습니다. 수량은 7장에서 고칠 수 있습니다`); return true; }
  return false;
}

/* ── 머리글 검색 보강 (최종 통합; v1_search.hooks.json #3) ──
   품목 장이 없는 BOM 카탈로그 품목(무두볼트·인치 캡스크루·인치 너트 …)은 검색어를 엔진으로 읽어 형번과 예시 단가를 보여 준다.
   형번을 직접 친 경우나, 같은 품목군의 2장 규격품 제안이 이미 있으면 더하지 않는다. */
function bomSearchMore(raw, res) {
  if (res.some(r => r.g === '형번') || raw.length < 4 || !/\d/.test(raw)) return;
  try {
    const { q, m } = bomLine({ i: 0, no: null, pn: null, text: raw, qty: null, unit: null, src: raw, filled: null });
    const p = m.status === 'catalog' && m.pn ? parsePn(m.pn) : null;
    if (!p || res.some(r => r.go === 'm-' + p.f.id)) return;
    const s = `${p.f.short} ${q.system === 'inch' ? inLab(q.size.label) : q.size.label}${m.L ? ' × ' + (p.f.inch ? `${inFrac(m.L / 1000)}"` : m.L) : ''} · ${PRICE_ON(p.f.id) ? `${PRICE_LAB()} ${won(m.price)}/EA` : '견적 · 단가 확인 중'}`;
    res.unshift(METRIC.includes(p.f) ? { t: m.pn, s, go: 'm-' + p.f.id, preset: m.pn, g: '형번' } : { t: m.pn, s: s + ' → 견적함에 1포장 담기 (7장)', go: 'cart', bomPn: m.pn, g: '형번' });
  } catch (e) { /* 검색은 엔진 오류로 멈추지 않는다 */ }
}
// 검색 색인: 4A-1 문서 (고르면 그 문서 탭으로)와, 품목 장이 없는 BOM 카탈로그 품목군 (→ 4A장)
if (typeof INDEX !== 'undefined') {
  INDEX.push({ t: 'C&D 시트 (확인·편차 목록)', s: 'BOM 줄마다 확인할 것과 다르게 공급하는 것 · 고객 회신 칸', k: 'c&d cd clarification deviation 편차 확인 시트 고객 회신 승인 tbe 기술 평가', go: 'quote', bomDoc: 'cd', g: '도구·안내' });
  INDEX.push({ t: '견적서·C&D 문서', s: '견적서 · C&D 시트 · 준수 요약 · 공급 불가 목록 · 도면 묶음 · 개정 비교', k: '견적서 quotation c&d cd clarification deviation 편차 확인 시트 준수 compliance 요약 공급 불가 도면 묶음 개정 비교 rev 기술본 unpriced 4a-1', go: 'quote', bomDoc: 'quote', g: '도구·안내' });
  BOM_FAMS.forEach(f => INDEX.push({ t: f.name, s: `${f.std} · 형번 ${f.code} · 호칭까지 적으면 형번이 나옵니다 → 목록 줄마다 보기`, k: [f.name, f.short, f.en, f.enStd, f.code, f.std, f.inch ? '인치 inch' : ''].join(' ').toLowerCase(), go: 'bom', g: f.inch ? '인치·플랜트' : '규격품' }));
}
// 3장 인치 품목군 가운데 자주 쓰는 치수·기본 사양이 BOM 카탈로그(카탈로그 품목, 예시 단가)에도 있는 것 (최종 통합; v1_search.hooks.json #4)
const BOM_INCH_CAT = { b7: ['istd'], hh: ['ihhn'], j429: ['ihcs', 'ihn'], a574: ['ishc'], f593: ['ihcs', 'ihn'], f837: ['ishc'], a325: ['ifw'] };
function bomInchCatNote(f) {
  const fs = (BOM_INCH_CAT[f.id] || []).map(id => BOM_FAMS.find(x => x.id === id)).filter(Boolean);
  if (!fs.length) return '';
  // 공급 구분이 둘로 나뉜다: 기본 사양(BOM 카탈로그 형번)은 도매처 재고, 나머지는 이 장 '공급·납기' 구분. 4A 견적서와 같은 말을 쓴다
  return `<dt>기본 사양</dt><dd><b>도매처 재고</b> · ${esc(LEAD_TIER['도매처 재고'])}. 자주 쓰는 치수의 기본 사양(형번 <span class="mono">${fs.map(x => esc(x.code) + '-…').join(' · ')}</span>)만 해당하며, <a href="#bom" data-go="bom">4A장 BOM 견적</a>에서 형번이 나오고, 출고일은 공급처 확인 후 확정합니다. 그 밖의 치수·코팅·서류 지정은 위 '공급·납기' 구분(${esc(f.lead)})대로 견적합니다.</dd>`;
}

/* ── 파일 열기 (S1): SheetJS는 cdnjs에서 필요할 때만 ── */
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (loadXLSX.p) return loadXLSX.p;
  return (loadXLSX.p = new Promise((res, rej) => {
    const s = document.createElement('script'), to = setTimeout(() => { loadXLSX.p = null; rej(new Error('timeout')); }, 15000);
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => { clearTimeout(to); window.XLSX ? res(window.XLSX) : (loadXLSX.p = null, rej(new Error('missing'))); };
    s.onerror = () => { clearTimeout(to); loadXLSX.p = null; s.remove(); rej(new Error('load')); };
    document.head.appendChild(s);
  }));
}
// CSV·TSV·TXT: UTF-8로 읽고 깨진 글자(U+FFFD)가 1% 넘으면 EUC-KR(CP949)로 다시 읽는다
async function bomReadText(file) {
  const buf = await file.arrayBuffer(); let t = new TextDecoder('utf-8').decode(buf);
  const bad = (t.match(/\uFFFD/g) || []).length;
  if (bad && bad / Math.max(1, t.length) > .01) { try { t = new TextDecoder('euc-kr').decode(buf); } catch {} }
  return t.replace(/^﻿/, '');
}
// 지난 요청·견적 JSON (b2b FAQ '다시 주문'): BOM 견적 JSON(boltnote.quote-revision, 가격본)은 붙여 넣었던 BOM 원문을,
// 견적함·4장 요청서 JSON(boltnote.rfq)은 줄 원문과 수량을 표로 되돌린다. 다른 JSON이면 null
function bomJsonText(t) {
  let o; try { o = JSON.parse(t); } catch { return null; }
  if (o && o.format === 'boltnote.quote-revision' && typeof o.bom?.text === 'string' && o.bom.text.trim()) return o.bom.text;
  if (o && o.format === 'boltnote.rfq' && Array.isArray(o.lines) && o.lines.length) {
    const cell = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();
    return ['품명·규격\t수량\t단위', ...o.lines.map(l => [cell(l.bom || l.raw), cell(l.qty), cell(l.unit)].join('\t'))].join('\n');
  }
  return null;
}
function bomOpenFile(file, setText) {
  const msg = document.getElementById('bom-file-msg'); if (!file) return;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  msg.textContent = `${file.name} 읽는 중…`;
  const fail = t => { msg.textContent = t; };
  if (ext === 'xlsx' || ext === 'xls') {
    loadXLSX().then(X => file.arrayBuffer().then(buf => {
      const wb = X.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
      const tsv = X.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false }).split('\n').filter(l => l.replace(/\t/g, '').trim()).join('\n');
      setText(tsv, file.name); msg.textContent = `${file.name} · 첫 시트 ${tsv.split('\n').length}줄을 읽었습니다${wb.SheetNames.length > 1 ? ` (시트 ${wb.SheetNames.length}개 중 첫 시트)` : ''}`;
    })).catch(() => fail('엑셀을 읽는 도구를 불러오지 못했습니다. 엑셀에서 표를 복사해 위 칸에 붙여 넣어 주세요.'));
  } else if (['csv', 'tsv', 'txt'].includes(ext)) bomReadText(file).then(t => { setText(t, file.name); msg.textContent = `${file.name}을(를) 읽었습니다`; }, () => fail('파일을 읽지 못했습니다.'));
  else if (ext === 'json') bomReadText(file).then(t => { const s = bomJsonText(t); if (s == null) { fail('볼트노트에서 내려받은 견적·요청서 JSON만 열 수 있습니다.'); return; } setText(s, file.name); msg.textContent = `${file.name} · 지난 견적·요청의 BOM ${s.split('\n').length}줄을 다시 넣었습니다`; }, () => fail('파일을 읽지 못했습니다.'));
  else fail('.xlsx, .xls, .csv, .tsv, .txt, .json 파일만 열 수 있습니다. PDF·사진은 4장 견적 요청서에 첨부해 보내 주세요.');
}

/* ── 줄 표시 조각 (워크벤치·견적서 공용) ── */
const bomQtyTxt = x => { const { q, m } = x; const raw = q.qty ? String(q.qty.raw || q.qty.n) : ''; const calc = `${m.qty.toLocaleString()} ${bomUnit(m)}`; return { raw, calc, differs: !!q.qty && raw.replace(/\s+/g, ' ').toUpperCase() !== calc.toUpperCase() && raw.replace(/[,\s]|EA|PCS?\.?|SETS?|세트|개|조|本|個/gi, '') !== String(m.qty) }; };
const bomChecks = x => [...(x.m.qtyWarn ? [x.m.qtyWarn] : []), ...x.q.questions.filter(t => t !== x.m.qtyWarn)];
function bomQtyCell(x) {
  const { m } = x, qt = bomQtyTxt(x);
  return `${m.qty.toLocaleString()} ${bomUnit(m)}${qt.differs ? `<span class="sub">BOM: ${esc(qt.raw)}</span>` : ''}${m.qtyWarn ? `<span class="tag warn">수량 확인</span>` : ''}`;
}
// 해석 칩: 기본값으로 채운 칸은 점선 + '기본값'
function bomChips(q) {
  const defIn = re => q.assumptions.some(a => re.test(a));
  const chip = (k, v, def = false, mono = false) => v ? `<span class="wb-chip${def ? ' def' : ''}"><i>${k}</i><span class="${mono ? 'mono' : ''}">${esc(v)}</span>${def ? '<em>기본값</em>' : ''}</span>` : '';
  const th = q.system === 'metric' && q.size ? `${q.size.label}${q.pitch ? ' × ' + q.pitch : ''}${q.series === 'fine' ? ' 가는나사' : ''}` : q.system === 'inch' && q.size ? (q.size.v == null ? q.size.label : `${inLab(q.size.label)}${q.tpi ? '-' + q.tpi + ' ' + (q.series || '') : ''}`) : q.size ? q.size.label : '';
  return [
    chip('품목', q.type === 'unknown' ? '읽지 못함' : q.typeLabel + (q.point && !q.variant ? ' · ' + PT_KO[q.point] : ''), q.type === 'setscrew' && defIn(/끝 형상/)),
    chip(THREADED.has(q.type) ? '나사' : '호칭', th + (q.hand === 'LH' ? ' LH' : ''), defIn(/피치 미기재|산 수 미기재/), true),
    chip('길이', q.lengthLabel, defIn(/길이 미기재/), true),
    chip('공차', q.tolClass ? q.tolClass === 'OS' ? '오버탭' : q.tolClass : '', !!q.tolClass && !/기재\)/.test(q.tolLabel), true),
    chip('렌치', q.drive ? q.drive.label.replace(/^육각 구멍 · /, '육각 구멍 ').replace(/^너트: /, '너트 ') : ''),
    chip('규격', q.dimStd ? q.dimStd.replace(/ \(.*$/, '') : '', false),
    chip('재질', q.mat ? q.mat.label : '', !!q.mat && (q.mat.def || q.mat.specDefault && !q.mat.stated)),
    chip('표면처리', q.fin ? q.fin.label.replace(/ · 기본값$/, '') : '', q.finDefault),
    ...q.special.filter(k => !['CONT', 'TAPEND', 'AERO', 'JAM', 'NYLOC'].includes(k)).map(k => `<span class="wb-chip sp"><i>요구</i>${esc(SPEC_KO[k])}</span>`),
  ].join('');
}
// 서류 계획 짧게: 포함은 서류 태그, 옵션은 개수
function bomDocTags(l) {
  const p = l?.docPlan?.plan; if (!p) return '';
  const inc = p.filter(d => d.incl), opt = p.filter(d => d.option);
  return inc.map(d => `<span class="tag doc">${esc(CD_DOC[d.code]?.short || d.code)}</span>`).join('') + (opt.length ? `<span class="wb-opt">옵션 ${opt.map(d => esc(CD_DOC[d.code]?.short || d.code)).join('·')}</span>` : '');
}
const bomCdTags = (l, rows) => (l?.cd || []).map(no => { const r = rows && rows.find(x => x.no === no); return `<span class="wb-cd t-${no[0]}${r && CD_RESOLVED.has(r.status) ? ' done' : ''}" title="${esc(r ? `${CD_TYPE[r.type].ko} · ${CD_CAT[r.cat].ko} · ${CD_STATUS[r.status].ko}` : no)}">${no}</span>`; }).join('');
// 납기 칸: 티어 이름 + 출고일(자체 재고만 날짜, 아니면 BOM_SHIP_TBD) 또는 회신 예정일
function bomLeadTxt(v) {
  const { x, l } = v, m = x.m, L = m.lead;
  if (v.ex) return '견적에서 제외';
  if (m.status === 'not-available' || !L) return '—';
  if (m.status === 'catalog') return `${L.label} · ${L.code !== 'OWN_STOCK' ? BOM_SHIP_TBD : m.ship ? (m.ship.today ? '오늘 출고' : `${m.ship.label} 출고`) : bomMD(l.lead?.shipDate) + ' 출고'}`;
  const rng = L.toCustomer ? ` · 수령 ${L.toCustomer[0]}–${L.toCustomer[1]}영업일` : '';
  return `${L.label}${rng}${l.replyBy ? ` · 회신 ${bomMD(l.replyBy)}` : ''}`;
}
