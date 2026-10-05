/* ── C&D 문서 만들기: cdBuild(items, rfq, prev) → 머리·선언문·행(10열)·GC·기술/상업 분리·준수 요약·공급 불가 목록·서류·도면·개정 ──
   items = bomLine 결과 [{ row, q, m, sec? }] (구역 제목 줄은 { row, section: true }), rfq = 사양 6.5절 Rfq (모두 선택), prev = 이전 Rev 스냅샷(cdSnapshot)
   rfq 추가 필드: quoteNo, rev, date('YYYY-MM-DD[THH:MM]', KST), offerType 'indicative'|'firm', review { ok, by, at } (정식 견적 조건),
   decisions { [행 key]: { status, by, at, reply } }, excluded [lineKey 또는 BOM No], contextText(RFQ 본문에서 문맥 읽기), revNote, preparedBy */

const cdVal = (v, p, x) => typeof v === 'function' ? v(p, x) : v;
const CD_NA_RULES = new Set(['N-NA', 'N-UNREAD', 'N-EXCL', 'A-MERGE', 'X-SCOPE']);
const cdRevNext = r => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; const i = A.indexOf(String(r || '').toUpperCase()); return i >= 0 && i < A.length - 1 ? A[i + 1] : 'A'; };
const cdNorm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const cdLineKeyOf = (raw, pn) => cdHash(cdNorm(raw) + '|' + cdNorm(pn));
const cdSpecKey = q => !q ? '' : [q.type, q.size?.label || '', q.lengthMm ? +q.lengthMm.toFixed(2) : '', q.mat?.code || '', q.fin?.code || '', (q.dimStd || '').replace(/\s*\(.*$/, '')].join('|');
const cdReviewOk = rv => !!(rv && rv.ok === true && rv.by && rv.at);

// 영향 표기 (사양 4.6): 가격 · 납기 · 서류 순서. unpriced = 가격 없는 기술본 표기
function cdImpactText(imp, unpriced = false) {
  const k = imp.kind || 'none', d = imp.replyBy ? new Date(imp.replyBy) : null, dk = d ? cdDateKo(d) : '고객과 합의한 날짜', de = d ? cdDateEn(d) : 'agreed date';
  let pk, pe;
  if (unpriced) { const has = k !== 'none'; pk = has ? '가격 영향 있음 – 가격본 참조' : '가격 영향 없음'; pe = has ? 'Price impact – see priced offer' : 'No price impact'; }
  else ({ pk, pe } = {
    none: { pk: '가격 변동 없음', pe: 'No price impact' },
    tbd: { pk: `가격 회신 예정 ${dk}`, pe: `Price to follow by ${de}` },
    cow: d ? { pk: `준수 시 엔지니어 견적 (회신 예정 ${dk})`, pe: `If compliant: engineer quote (by ${de})` } : { pk: '준수 시 엔지니어 견적 (요청 시 회신)', pe: 'If compliant: engineer quote (on request)' },
    cowtbd: { pk: `제안안·준수안 모두 가격 회신 예정 ${dk}`, pe: `Offered and compliant prices to follow by ${de}` },
    excluded: { pk: '견적에서 제외', pe: 'Excluded from offer' },
    option: { pk: '옵션 (선택 시 금액 변동)', pe: 'Option (price changes if selected)' },
  }[k] || { pk: '가격 변동 없음', pe: 'No price impact' });
  const lk = imp.leadNote ? imp.leadNote.ko : imp.lead ? `납기 +${imp.lead[0]}–${imp.lead[1]}영업일` : '납기 변동 없음';
  const le = imp.leadNote ? imp.leadNote.en : imp.lead ? `Lead +${imp.lead[0]}–${imp.lead[1]} BD` : 'No lead impact';
  const dk2 = imp.docs ? imp.docs.ko : '서류 변동 없음', de2 = imp.docs ? imp.docs.en : 'No document impact';
  if (k === 'none' && !imp.lead && !imp.leadNote && !imp.docs) return unpriced ? { ko: '가격 영향 없음 · 납기·서류 변동 없음', en: 'No price impact · no lead / document impact' } : { ko: '가격·납기·서류 변동 없음', en: 'No price / lead / document impact' };
  return { ko: `${pk} · ${lk} · ${dk2}`, en: `${pe} · ${le} · ${de2}` };
}

function cdBuild(itemsIn, rfq = {}, prev = null) {
  const firmReq = rfq.offerType === 'firm', ok = cdReviewOk(rfq.review);
  let doc = cdBuildPass(itemsIn, rfq, prev, firmReq && ok);
  const blocked = [];
  if (firmReq && !ok) blocked.push({ ko: '운영자 검토 표시(검토자·시각)가 없습니다.', en: 'Operator review flag (reviewer and time) missing.' });
  if (firmReq && ok && doc.unresolvedX.length) blocked.push({ ko: `미해결 충돌 ${doc.unresolvedX.length}건: ${doc.unresolvedX.join(', ')}`, en: `${doc.unresolvedX.length} unresolved conflict item(s): ${doc.unresolvedX.join(', ')}` });
  if (blocked.length && firmReq && ok) doc = cdBuildPass(itemsIn, rfq, prev, false);
  doc.firmRequested = firmReq; doc.firmBlocked = blocked;
  return doc;
}

function cdBuildPass(itemsIn, rfq, prev, firm) {
  const now = cdNow(rfq.date), rctx = cdRfqCtx(rfq);
  const all = (itemsIn || []).filter(Boolean), skipped = all.filter(x => x.section), src = all.filter(x => !x.section && x.q && x.m);
  const quoteNo = rfq.quoteNo || prev?.quoteNo || `BQ-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${cdHash(src.map(x => x.row?.text || '').join('\n')).slice(0, 4).toUpperCase()}`;
  const rev = rfq.rev || (prev ? cdRevNext(prev.rev) : 'A');
  const D = { rfq, ctx: rctx, now, firm, items: null, lines: [], quoteNo, rev };
  // 줄 감싸기 (호출한 쪽의 items는 바꾸지 않는다)
  const seen = {}, excl = new Set((rfq.excluded || []).map(String));
  const L = src.map((it, i) => {
    const raw = it.row?.text ?? it.q.raw, pn = it.row?.pn || '', base = cdLineKeyOf(raw, pn);
    const lineKey = `${base}#${(seen[base] = (seen[base] || 0) + 1)}`;
    return { row: it.row || { text: raw, no: String(i + 1) }, q: it.q, m: it.m, sec: it.sec || null, i, lineKey, ref: String(it.row?.no || i + 1), D };
  });
  // 이전 Rev와 줄 대응 → 이어지는 줄은 이전 lineKey를 물려받는다 (2.11절)
  if (prev?.lines?.length) {
    const lite = L.map(x => ({ lineKey: x.lineKey, ref: x.ref, pn: x.row.pn || '', raw: x.row.text || x.q.raw, specKey: cdSpecKey(x.q) }));
    const mt = cdMatchLines(prev.lines, lite), used = new Set();
    for (const p of mt.pairs) { const x = L[lite.indexOf(p.next)]; x.lineKey = p.prev.lineKey; x.match = p.kind; used.add(x.lineKey); }
    for (const x of L) if (!x.match) { let k = x.lineKey, n = 1; while (used.has(k)) k = x.lineKey.replace(/#\d+$/, '') + '#' + (++n + 100); x.lineKey = k; used.add(k); x.match = 'added'; }
  }
  // 줄 문맥: RFQ → 구역 → 줄 (아래가 덮어쓰고, 덮어쓰면 A-CTX)
  for (const x of L) {
    const lc = cdCtxOf(x.q.raw), sc = x.sec ? { ...x.sec } : {}, c = { ...rctx };
    const extra = [];
    for (const [k, v] of Object.entries({ ...sc, ...lc })) {
      if (v == null || ['text', 'no', 'tags', 'refDocs', 'docs', 'api610'].includes(k)) continue;
      const before = c[k];
      if (before != null && JSON.stringify(before) !== JSON.stringify(v) && ['flange', 'nace', 'exposure', 'mdmtC'].includes(k)) extra.push({ field: k, from: k === 'flange' ? `${before.nps || ''} Cl ${before.cls}` : String(before), to: k === 'flange' ? `${v.nps || ''} Cl ${v.cls}` : String(v) });
      c[k] = v;
    }
    c.docs = cdUniq([...(rctx.docs || []), ...(sc.docs || []), ...(lc.docs || [])]);
    c.refDocs = cdUniq([...(lc.refDocs || [])]);
    c.api610 = x.q.api610 || sc.api610 || rctx.api610 || null;
    x.ctx = c; x.ctxEv = extra;
    x.excluded = excl.has(x.lineKey) || excl.has(x.ref);
  }
  const act = L.filter(x => !x.excluded);
  D.items = L;
  // 엔지니어 견적 회신 예정일 (SLA)
  const nEq = act.filter(x => x.m.status === 'engineer-quote').length;
  for (const x of L) { if (x.m.status !== 'engineer-quote' || x.excluded) continue; const n = cdReplyDays(nEq, x, D); x.replyBy = n == null ? null : cdAddBD(now, n); }

  /* 1) 규칙 평가 → fires */
  const fires = [], gcHit = {};
  const fire = (r, lines, p0, extra = {}) => {
    if (r.out === 'none') return;
    if (r.gc) { (gcHit[r.gc] = gcHit[r.gc] || new Set()); for (const x of lines) gcHit[r.gc].add(x.lineKey); return; }
    const x0 = lines[0], p = { ...p0, ...(r.p && x0 ? r.p(p0, x0) : {}) };
    fires.push({ r, lines, p, g: r.g ? String(r.g(p, x0)) : '', ...extra });
  };
  for (const x of L) {
    const evs = [...(x.m.ev || []), ...x.ctxEv.map(e => ({ rule: 'A-CTX', ...e }))];
    for (const r of CD_RULES) {
      if (!r.ev && !r.when) continue;
      if (x.excluded && r.id !== 'N-EXCL') continue;
      if (x.m.status === 'not-available' && !CD_NA_RULES.has(r.id)) continue;   // 공급하지 않는 줄은 공급 불가·읽지 못함·병합 셀·범위 밖 서류만
      if (r.unless && r.unless(x)) continue;
      const ps = [];
      if (r.ev) { const id = r.ev === true ? r.id : r.ev; for (const e of evs) if (e.rule === id) { const { rule, ...p } = e; ps.push(p); } }
      if (r.when) { const w = r.when(x); if (w) for (const p of Array.isArray(w) ? w : [w]) ps.push(p === true ? {} : p); }
      const seenP = new Set();
      for (const p of ps) { const k = JSON.stringify(p); if (seenP.has(k)) continue; seenP.add(k); fire(r, [x], p); }
    }
  }
  for (const r of CD_RULES) if (r.bom) for (const f of r.bom(act, D)) fire(r, f.lines, f.p);
  for (const r of CD_RULES) if (r.rfq) for (const f of r.rfq(D)) fire(r, [], f.p, { ref: f.ref, req: f.req });

  /* 2) 묶기 → 행 */
  const groups = new Map();
  for (const f of fires) {
    const key = `${f.r.id}|${f.g}`;
    const g = groups.get(key) || { key, r: f.r, fires: [], lines: [], refs: [], reqs: [] };
    g.fires.push(f); for (const x of f.lines) if (!g.lines.includes(x)) g.lines.push(x);
    if (f.ref) g.refs.push(f.ref); if (f.req) g.reqs.push(f.req);
    groups.set(key, g);
  }
  const prevRows = new Map((prev?.cd || []).map(r => [r.key, r]));
  const maxSeq = { C: 0, D: 0, E: 0 }; for (const r of prev?.cd || []) maxSeq[r.type] = Math.max(maxSeq[r.type], r.seq || 0);
  const nAct = act.filter(x => x.m.status !== 'not-available').length, at = cdStamp(now);
  const rows = [];
  const ordered = [...groups.values()].sort((a, b) => (a.lines[0]?.i ?? -1) - (b.lines[0]?.i ?? -1) || CD_RULES.indexOf(a.r) - CD_RULES.indexOf(b.r));
  for (const g of ordered) {
    const r = g.r, lines = g.lines.sort((a, b) => a.i - b.i), x0 = lines[0] || null;
    const p = {};   // 같은 묶음의 params: 값이 여럿이면 '·'로 모은다
    for (const f of g.fires) for (const [k, v] of Object.entries(f.p)) { if (v == null || typeof v === 'object') { if (!(k in p)) p[k] = Array.isArray(v) ? v.join(' · ') : v; continue; } p[k] = p[k] == null ? String(v) : cdUniq([...String(p[k]).split('·'), String(v)]).join('·'); }
    const p0 = g.fires[0].p, type = cdVal(r.type, p0, x0), act0 = cdVal(r.act, p0, x0), queue = cdVal(r.queue, p0, x0), cat = cdVal(r.cat, p0, x0);
    const tag = CD_BASIS_TAG[r.basis] || CD_BASIS_TAG.local;
    const refs = (r.refs || []).map(s => cdFill(s, p));
    const reason = { ko: cdFill(cdVal(r.ko, p, x0), p), en: cdFill(cdVal(r.en, p, x0), p) };
    const offered = r.offer ? r.offer(p, x0, D) : x0 ? cdSameSpec(p, x0) : cdOff('—', '—');
    const rq = g.reqs[0] || (r.req ? r.req(p, x0) : x0 ? (x0.row.text || x0.q.raw) : '—'), required = typeof rq === 'object' ? rq.ko : rq, requiredEn = typeof rq === 'object' ? rq.en : rq;
    // 영향
    let imp = typeof r.imp === 'function' ? r.imp(p, x0) : { kind: r.imp || 'none' };
    const eqLines = lines.filter(x => x.m.status === 'engineer-quote');
    if (imp.kind === 'tbd' && !eqLines.length) imp = { ...imp, kind: 'none' };
    if (imp.kind === 'cow' && eqLines.length) imp = { ...imp, kind: 'cowtbd' };
    if (['tbd', 'cow', 'cowtbd'].includes(imp.kind)) { const ds = lines.map(x => x.replyBy).filter(Boolean); imp.replyBy = ds.length ? new Date(Math.max(...ds.map(Number))).toISOString() : null; }
    if (imp.leadText && x0) imp.leadNote = p.tbd ? { ko: BOM_SHIP_TBD, en: 'Ship date to be confirmed with the supplier' } : { ko: `가능 납기 ${p.date}`, en: `Achievable ${p.dateEn}` };
    const amountDelta = r.id === 'K-TIER' && x0 ? (+p0.amt - (x0.m.amount || 0)) : null;
    const pr = prevRows.get(g.key), dec = rfq.decisions?.[g.key];
    const status = dec?.status && CD_STATUS[dec.status] ? dec.status : pr && !pr.withdrawn && pr.status !== 'WITHDRAWN' ? pr.status : act0 === 'INFO' ? 'INFO' : 'OPEN';
    const seq = pr && pr.type === type ? pr.seq : ++maxSeq[type];
    const lineRef = !x0 ? cdUniq(g.refs).join(' · ') : lines.length > 1 && lines.length === nAct ? '전체 / All' : cdRefText(lines.map(x => x.ref));
    const history = [...(pr?.history || [])];
    if (!pr || pr.status !== status) history.push({ rev, status, at: dec?.at || at, by: dec?.by || (dec ? 'customer' : 'system') });
    rows.push({ no: `${type}-${String(seq).padStart(3, '0')}`, type, seq, key: g.key, ruleId: r.id, cat, action: act0, queue, auto: ['auto', 'gc'].includes(queue), basis: r.basis, scope: r.bom ? 'bom' : r.rfq && !x0 ? 'rfq' : 'line',
      lines: lines.map(x => ({ key: x.lineKey, ref: x.ref, pn: x.row.pn || '' })), lineRefText: lineRef, pnFirst: x0?.row.pn || '',
      required, requiredEn, requiredMore: Math.max(0, lines.length - 1), offered: lines.length > 1 && !r.offer ? { ko: `${offered.ko} 외 ${lines.length - 1}줄 (줄별 사양은 견적서)`, en: `${offered.en} (+${lines.length - 1} more; see quotation lines)` } : offered, reason, refs, refTag: tag, params: p,
      impact: { kind: imp.kind, priceDelta: null, amountDelta, leadDeltaDays: imp.lead ? imp.lead[1] : null, docs: imp.docs || null, replyBy: imp.replyBy || null, text: cdImpactText(imp), textUnpriced: cdImpactText(imp, true) },
      status, statusAt: dec?.at || pr?.statusAt || at, customerReply: dec?.reply || pr?.customerReply || '', repliedBy: dec?.by || pr?.repliedBy || '', closedAt: ['CLOSED', 'WITHDRAWN'].includes(status) ? (dec?.at || at) : null,
      history, firstRev: pr?.firstRev || rev, lastRev: rev, withdrawn: status === 'WITHDRAWN' });
  }
  // 이전 Rev에 있었는데 이번에 없는 행: 지우지 않고 철회(번호 유지, 취소선)
  for (const pr of prev?.cd || []) if (!groups.has(pr.key)) rows.push({ refTag: CD_BASIS_TAG.local, params: {}, pnFirst: '', refs: [], ...pr, requiredMore: Math.max(0, (pr.lines || []).length - 1),
    impact: { kind: pr.impact?.kind || 'none', amountDelta: null, leadDeltaDays: null, text: pr.impact?.text || cdImpactText({ kind: 'none' }), textUnpriced: cdImpactText({ kind: pr.impact?.kind || 'none' }, true) },
    status: 'WITHDRAWN', withdrawn: true, lastRev: pr.withdrawn ? pr.lastRev : rev, closedAt: pr.closedAt || at,
    history: pr.withdrawn ? pr.history : [...(pr.history || []), { rev, status: 'WITHDRAWN', at, by: 'system' }] });
  for (const row of rows) row.cells = cdCells(row, false), row.cellsTech = cdCells(row, true);
  const typeOrder = { D: 0, E: 1, C: 2 };
  rows.sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.seq - b.seq);
  const live = rows.filter(r => !r.withdrawn);
  const byLine = {}; for (const r of live) for (const l of r.lines) (byLine[l.key] = byLine[l.key] || []).push(r);

  /* 3) 줄 준수 코드 (3.11절 complianceOf, 위에서부터 처음 맞는 것) */
  // 미해결 충돌: X 규칙의 C·D 행(E행은 이미 명시한 예외) 중 승인·확인되지 않았고, 그 줄이 다른 E행(미견적 등)으로 정리되지 않은 것
  const unresolvedX = cdUniq(live.filter(r => r.ruleId.startsWith('X-') && r.type !== 'E' && !CD_RESOLVED.has(r.status) && r.lines.some(l => { const x = L.find(y => y.lineKey === l.key); return x && !x.excluded && !(byLine[l.key] || []).some(rr => rr.type === 'E' && rr.ruleId !== r.ruleId); })).map(r => r.no));
  const compOf = x => {
    const rs = byLine[x.lineKey] || [];
    if (x.m.status === 'not-available' || x.excluded || rs.some(r => r.type === 'E')) return 'E';
    if ((x.m.status === 'engineer-quote' && !x.priced) || rs.some(r => r.ruleId.startsWith('X-') && r.type !== 'E' && !CD_RESOLVED.has(r.status))) return 'N';
    if (rs.some(r => r.type === 'D')) return 'D';
    if (rs.some(r => r.type === 'C')) return 'CC';
    return 'C';
  };
  /* 4) 합계 (카탈로그 품목 줄만, 견적함과 같은 식) */
  const tot = bomTotals(act.filter(x => x.m.status === 'catalog'));
  const vatOf = new Map(); act.filter(x => x.m.status === 'catalog').forEach((x, i) => vatOf.set(x.lineKey, tot.lines[i]?.vat ?? 0));
  const refAdd = act.filter(x => x.m.status === 'engineer-quote' && x.m.alt?.price).reduce((a, x) => a + x.m.alt.price * x.m.qty, 0);
  const noRef = act.filter(x => x.m.status === 'engineer-quote' && !x.m.alt?.price).length;
  /* 5) 줄 (3.1절 열 + 스냅샷 필드) */
  for (const x of L) {
    const code = compOf(x), dp = cdDocPlan(x, D), dw = cdDrawing(x, quoteNo), m = x.m;
    D.lines.push({ lineKey: x.lineKey, ref: x.ref, pn: x.row.pn || '', raw: x.row.text || x.q.raw, qtyRaw: x.q.qty?.raw ?? x.row.qty ?? '', match: x.match || null,
      status: x.excluded ? 'excluded' : m.status, compliance: code, ourPn: m.pn || null, name: bomEnLine(x), spec: { ko: m.spec || '', en: cdSpecEn(x.q) }, specKey: cdSpecKey(x.q),
      qty: m.qty, unit: m.unit, unitPrice: m.status === 'catalog' && !x.excluded ? m.price : null, amount: m.status === 'catalog' && !x.excluded ? m.amount : null, vat: vatOf.get(x.lineKey) ?? null,
      make: m.make || null, origin: m.origin || null, makeText: m.make ? `${m.make}${m.origin ? ' / ' + m.origin : ''}` : m.status === 'not-available' || x.excluded ? '—' : cdAvl(D.rfq) ? '발주 후 통보 (귀사 AVL 안에서 선정)' : '발주 후 통보',
      lead: m.lead ? { code: m.lead.code, label: m.lead.label, text: m.lead.text, dispatch: m.lead.dispatch, toCustomer: m.lead.toCustomer, returnable: m.lead.returnable, validityDays: m.lead.validityDays,
        shipDate: m.status === 'catalog' ? ymd(cdShipDate(now, m.leadDays || 0)) : null } : null,
      replyBy: x.replyBy ? ymd(x.replyBy) : null, delivery: m.delivery, pack: m.packPlan?.note || null, indicative: m.indicative || '', reasons: (m.reasons || []).filter(r => r.tone !== 'info').map(r => r.text),
      docPlan: dp, drawing: dw, cd: (byLine[x.lineKey] || []).map(r => r.no), ctx: { flange: x.ctx.flange || null, api610: x.ctx.api610 ? { cls: x.ctx.api610.cls, edition: x.ctx.api610.edition } : null, nace: x.ctx.nace || null, mdmtC: x.ctx.mdmtC ?? null } });
  }
  const lines = D.lines;
  /* 6) GC (4.7절) */
  const gcOut = (list, part) => list.map(g => {
    let on = true, n = null;
    if (Array.isArray(g.cond)) { const s = new Set(); for (const id of g.cond) { const rr = CD_RULE[id]; for (const k of gcHit[rr?.gc] || []) s.add(k); } n = s.size; on = n > 0 || g.id === 'GC-T03'; }
    else if (typeof g.cond === 'function') on = !!g.cond(D);
    if (!on) return null;
    const ko = cdVal(g.ko), en = cdVal(g.en);
    return { id: g.id, part, ko: n != null ? `${ko} (해당 ${n}줄)` : ko, en: n != null ? `${en} (${n} line${n === 1 ? '' : 's'})` : en, n, ph: !!g.ph };
  }).filter(Boolean);
  const gcT = gcOut(CD_GC_T, 'T'), gcC = gcOut(CD_GC_C, 'C');
  /* 7) 집계·선언문 (4.3절) */
  const cnt = { C: 0, CC: 0, D: 0, E: 0, N: 0 }; for (const l of lines) cnt[l.compliance]++;
  const rc = { C: live.filter(r => r.type === 'C').length, D: live.filter(r => r.type === 'D').length, E: live.filter(r => r.type === 'E').length };
  const sumKo = `C ${rc.C}건 · D ${rc.D}건 (승인 필요) · E ${rc.E}건 · 미견적 줄 ${cnt.N}건 (엔지니어 견적, 다음 Rev에 반영)`;
  const sumEn = `C ${rc.C} · D ${rc.D} (approval required) · E ${rc.E} · ${cnt.N} line(s) not yet quoted (engineer quote, next Rev)`;
  const rfqNo = rfq.clientRef?.rfqNo || '(RFQ 번호 미기재)', rfqRev = rfq.clientRef?.rev || '—';
  let statement;
  if (!firm) statement = { kind: 'indicative', ko: '운영자 검토 전 자동 견적입니다. 준수 선언은 정식 견적에서 합니다.', en: 'Indicative, not reviewed; compliance is declared only in the firm offer.' };
  else if (rc.D || rc.E) statement = { kind: 'deviation',
    ko: `이 시트에 적은 항목을 제외하고, 당사 견적 ${quoteNo} (Rev ${rev})는 귀사 RFQ/BOM ${rfqNo} (Rev ${rfqRev}) 및 위 "검토 문서" 목록에 있는 문서의 요구사항을 기재된 그대로 준수합니다. 검토 문서 목록에 없는 문서(참조만 되고 받지 못한 사양서·도면·일반 구매 조건 포함)는 검토하지 않았으며 이 준수 선언에 포함되지 않습니다(GC-T13). Deviation(D) 항목은 귀사의 서면 승인 없이 진행하지 않습니다.`,
    en: `Except for the items listed in this sheet, our Quotation ${quoteNo} Rev ${rev} is in full compliance with the requirements of your RFQ/BOM ${rfqNo} Rev ${rfqRev} and of the documents listed under "Basis of Offer" above, as written. Documents not listed there (including specifications, drawings or general conditions referenced but not received) have not been reviewed and are not covered by this statement (GC-T13). No Deviation (D) item will be executed without your written approval.` };
  else statement = { kind: 'nil',
    ko: `편차 없음 (NIL DEVIATION). 당사 견적 ${quoteNo} (Rev ${rev})는 귀사 RFQ/BOM ${rfqNo} (Rev ${rfqRev}) 및 "검토 문서" 목록에 있는 문서의 요구사항을 기재된 그대로 준수합니다. 아래 확인(C) 항목은 원문 해석을 밝힌 것입니다.`,
    en: `NIL DEVIATION. Our Quotation ${quoteNo} Rev ${rev} is in full compliance with your RFQ/BOM ${rfqNo} Rev ${rfqRev} and the documents listed under "Basis of Offer", as written. The Clarification (C) items below state how the requirements were interpreted.` };
  statement.summary = { ko: sumKo, en: sumEn }; statement.counts = { rows: rc, lines: cnt };
  /* 8) 머리 블록 (4.2절) */
  const ap = [], c0 = rctx;
  if (c0.api610) ap.push(`API 610 ${c0.api610.edition ? api610EdKo(c0.api610.edition) + ' ' : '(판 미기재) '}${c0.api610.cls}`);
  if (c0.nace) ap.push(`NACE ${c0.nace === 'NACE' ? '' : c0.nace}${c0.exposure ? ` (${c0.exposure === 'exposed' ? '노출' : '비노출'})` : ''}`.trim());
  if (c0.mdmtC != null) ap.push(`MDMT ${c0.mdmtC} °C`);
  if (c0.flange) ap.push(`ASME ${c0.flange.std} Class ${c0.flange.cls}${c0.flange.nps ? ` NPS ${c0.flange.nps}` : ''}`);
  const bomHash = cdHash(src.map(x => x.row?.text || '').join('\n'));
  const header = {
    doc: { ko: '기술 확인·편차 목록', en: 'Clarification & Deviation Sheet' }, sheetNo: `${quoteNo}-CD`, rev, date: ymd(now), issuedAt: cdStamp(now),
    project: rfq.project || '—', client: rfq.client || '—', rfqNo: rfq.clientRef?.rfqNo || '—', rfqRev,
    bomRef: { file: rfq.clientRef?.bomFile || '붙여넣은 BOM', rows: src.length, hash: bomHash.slice(0, 8) },
    basis: [{ doc: rfq.clientRef?.bomFile || '붙여넣은 BOM', rev: '-', received: true, reviewed: true }, ...(rfq.basis || []).map(b => ({ doc: b.doc, rev: b.rev || '-', received: b.received !== false, date: b.date || null, reviewed: b.received !== false }))],
    submission: { priced: rfq.submission?.unpriced ? '가격 포함 + 가격 없는 기술본 / Priced + Unpriced' : '가격 포함 / Priced', split: rfq.submission?.splitTechComm ? '기술·상업 분리 / Technical & Commercial' : '통합 / Combined' },
    offerType: firm ? { code: 'firm', ko: '정식 견적', en: 'Firm' } : { code: 'indicative', ko: '자동 견적', en: 'Indicative' },
    quoteNo, applicableSpecs: ap, supplier: { name: '볼트노트', bizNo: SHOP.bizNo || null, ph: !SHOP.bizNo },
    preparedBy: rfq.preparedBy || null, checkedBy: firm ? (rfq.review.checkedBy || '자체 검토 / Self-checked') : null, approvedBy: firm ? rfq.review.by : null, clientReview: null,
  };
  /* 9) 준수 요약 (3.11절) */
  const byCat = Object.fromEntries(Object.keys(CD_CAT).map(k => [k, { C: 0, D: 0, E: 0 }])); for (const r of live) byCat[r.cat][r.type]++;
  const supplied = lines.filter(l => l.docPlan);
  const tiers = {}; for (const l of lines) if (l.lead && l.status !== 'excluded') tiers[l.lead.code] = (tiers[l.lead.code] || 0) + 1;
  const ships = lines.filter(l => l.lead?.shipDate).sort((a, b) => a.lead.shipDate < b.lead.shipDate ? 1 : -1);
  const compliance = {
    head: { project: header.project, rfqNo: header.rfqNo, rfqRev, quoteNo, rev, date: header.date },
    total: lines.length, counts: cnt, sumOk: Object.values(cnt).reduce((a, b) => a + b, 0) === lines.length,
    byStatus: { catalog: lines.filter(l => l.status === 'catalog').length, eq: lines.filter(l => l.status === 'engineer-quote').length, na: lines.filter(l => l.status === 'not-available').length, excluded: lines.filter(l => l.status === 'excluded').length, skipped: skipped.length },
    byCat, cdCount: live.length, rowCounts: rc,
    docs: { mtc31: supplied.filter(l => l.docPlan.plan.some(p => p.code === 'MTC31_FWD' && p.incl)).length, cocOnly: supplied.filter(l => l.docPlan.plan.filter(p => p.incl).every(p => ['COC_F21', 'PACKLIST'].includes(p.code))).length,
      kolasOpt: supplied.filter(l => l.docPlan.plan.some(p => p.code === 'KOLAS' && p.option)).length, mtc32Opt: supplied.filter(l => l.docPlan.plan.some(p => p.code === 'MTC32' && p.option)).length },
    lead: { latest: ships[0] ? { ref: ships[0].ref, date: ships[0].lead.shipDate, label: cdDateKo(new Date(ships[0].lead.shipDate + 'T12:00')) } : null, tiers, eqReply: lines.filter(l => l.replyBy).map(l => l.replyBy).sort().pop() || null },
    statement, list: lines.map(l => ({ ref: l.ref, code: l.compliance, cd: l.cd })),
    listText: lines.map(l => `${l.ref} ${l.compliance}${l.cd.length && l.compliance !== 'C' ? `(${l.cd.join(',')})` : ''}`).join(' · '),
  };
  /* 10) 공급 불가 목록 (3.10절) */
  const naLines = L.filter(x => x.m.status === 'not-available' || x.excluded).map(x => {
    const why = (x.m.ev || []).find(e => e.rule === 'N-NA' || e.rule === 'N-UNREAD')?.why || (x.excluded ? 'excluded' : '');
    const w = CD_NA_WHERE[String(why).startsWith('variant:') ? 'variant' : why] || ['다른 공급처', 'another supplier'];
    const reason = x.excluded ? '귀사 요청으로 견적에서 뺐습니다.' : ((x.m.reasons || []).find(r => r.tone === 'crit') || {}).text || '';
    const elsewhere = x.excluded ? { ko: `BOM No ${x.ref}: 귀사 요청으로 이번 견적에서 뺀 줄입니다.`, en: `Line ${x.ref}: excluded at your request.` }
      : x.m.unreadable ? { ko: `BOM No ${x.ref}: 사양을 읽지 못해 견적에 넣지 않았습니다. 사양을 알려 주시면 견적합니다.`, en: `Line ${x.ref}: specification could not be read; please advise and we will quote.` }
      : { ko: `BOM No ${x.ref}: 이 줄은 저희가 공급하지 않습니다. 이 줄만 ${w[0]}에 문의해 주십시오.`, en: `Line ${x.ref}: we do not supply this item; please source this line only from ${w[1]}.` };
    return { lineKey: x.lineKey, ref: x.ref, pn: x.row.pn || '', raw: x.row.text || x.q.raw || '', qtyRaw: x.q.qty?.raw ?? x.row.qty ?? '', why, reason, elsewhere, unreadable: !!x.m.unreadable, excluded: !!x.excluded };
  });
  const notAvailable = { intro: { ko: SHOP_TERMS.notAvail, en: 'We do not supply the items below. Please source these lines only from another supplier.' }, outro: { ko: '이 목록은 다른 공급처에 그대로 전달하셔도 됩니다.', en: 'This list may be forwarded to another supplier as is.' }, lines: naLines,
    mail: { subject: `[${quoteNo}] 공급 불가 ${naLines.length}건`, body: naLines.map(n => `BOM No ${n.ref}${n.pn ? ` (고객 품번 ${n.pn})` : ''}: ${n.raw || '(품명 칸 비어 있음)'}${n.qtyRaw ? ` · 수량 ${n.qtyRaw}` : ''}\n   ${n.reason}\n   ${n.elsewhere.ko}`).join('\n') + `\n\n${SHOP_TERMS.notAvail}\n이 목록은 다른 공급처에 그대로 전달하셔도 됩니다.` } };
  /* 11) 예외 큐 (2.8절: 구매자가 판단할 줄) */
  const queue = Object.fromEntries(CD_QUEUE_ORDER.map(k => [k, []]));
  for (const r of live) if (CD_QUEUE_ORDER.includes(r.queue) && !CD_RESOLVED.has(r.status)) queue[r.queue].push(r.no);
  const valid = new Date(now); valid.setDate(valid.getDate() + SHOP_TERMS.validityDays);
  return {
    version: CD_VERSION, quoteNo, rev, issuedAt: cdStamp(now), validUntil: ymd(valid), offerType: firm ? 'firm' : 'indicative',
    watermark: firm ? null : { ko: '자동 견적 · 운영자 검토 전', en: 'Indicative – not reviewed' }, seal: firm ? { by: rfq.review.by, at: rfq.review.at } : null,
    header, statement, cols: CD_COLS, rows, gc: { technical: gcT, commercial: gcC },
    technical: { rows: rows.filter(r => !CD_COMM.has(r.cat)).map(r => r.no), gc: gcT.map(g => g.id) }, commercial: { rows: rows.filter(r => CD_COMM.has(r.cat)).map(r => r.no), gc: gcC.map(g => g.id) },
    lines, compliance, notAvailable, queue, unresolvedX,
    totals: { ...tot, words: tot.words, wordsDoc: wonKoDoc(tot.total, '일금'), reference: { supplyMin: tot.sub, supplyMax: tot.sub + refAdd, noRef } },
    skipped: skipped.map(s => ({ ref: s.row?.no, text: s.row?.text, ctx: s.sec ? { flange: s.sec.flange || null, api610: s.sec.api610 ? { cls: s.sec.api610.cls, edition: s.sec.api610.edition } : null, nace: s.sec.nace || null, tags: s.sec.tags || null } : null })),
    revision: { rev, prev: prev?.rev || null, history: [...(prev?.revision?.history || prev?.history || []), { rev, date: ymd(now), desc: rfq.revNote || (prev ? `Rev ${prev.rev} 개정 / Revised` : '최초 발행 / First issue'), by: rfq.preparedBy || null, chk: firm ? rfq.review.by : null }] },
    ctx: { api610: rctx.api610 ? { cls: rctx.api610.cls, edition: rctx.api610.edition } : null, nace: rctx.nace || null, exposure: rctx.exposure || null, mdmtC: rctx.mdmtC ?? null, flange: rctx.flange || null, docs: rctx.docs || [] },
  };
}

// 본문 10열 (4.4절). unpriced = 가격 없는 기술본(8열 표기만 다름)
function cdCells(r, unpriced) {
  const T = CD_TYPE[r.type], C = CD_CAT[r.cat], A = CD_ACT[r.action], S = CD_STATUS[r.status] || CD_STATUS.OPEN, refs = r.refs.length ? r.refs.join('; ') : '';
  const more = r.requiredMore ? ` (외 ${r.requiredMore}줄)` : '', moreEn = r.requiredMore ? ` (+${r.requiredMore} more)` : '';
  return [
    { ko: r.no, en: r.no },
    { ko: r.lineRefText + (r.pnFirst && r.lineRefText !== '전체 / All' ? ` (${r.pnFirst})` : ''), en: r.lineRefText.replace('전체 / All', 'All') + (r.pnFirst && r.lineRefText !== '전체 / All' ? ` (${r.pnFirst})` : '') },
    { ko: r.required + more, en: (r.requiredEn || r.required) + moreEn },
    { ko: r.offered.ko, en: r.offered.en },
    { ko: `${T.ko} ${T.en}`, en: T.en },
    { ko: `${C.ko} ${C.en}`, en: C.en },
    { ko: r.reason.ko + (refs ? ` — 근거: ${refs}` : '') + r.refTag.ko, en: r.reason.en + (refs ? ` — Ref.: ${refs}` : '') + r.refTag.en },
    unpriced ? r.impact.textUnpriced : r.impact.text,
    { ko: `${A.ko} ${A.en} ☐`, en: `${A.en} ☐` },
    { ko: `${S.ko} ${S.en} · ${String(r.statusAt || '').slice(0, 10)}`, en: `${S.en} · ${String(r.statusAt || '').slice(0, 10)}` },
  ];
}

/* ── 가격 없는 기술 제출본 (8.9절): 같은 문서에서 금액을 모두 뺀 사본. 기술 C&D(GC-T)만, 줄은 견적함/미견적 ── */
function cdUnpriced(doc) {
  const tech = doc.rows.filter(r => !CD_COMM.has(r.cat));
  return {
    kind: 'unpriced', version: doc.version, quoteNo: doc.quoteNo, rev: doc.rev, issuedAt: doc.issuedAt, offerType: doc.offerType, watermark: doc.watermark,
    header: { ...doc.header, submission: { priced: '가격 없는 기술본 / Unpriced', split: '기술 C&D / Technical' } },
    statement: { kind: doc.statement.kind, ko: doc.statement.ko, en: doc.statement.en, summary: doc.statement.summary },
    cols: doc.cols, gc: { technical: doc.gc.technical },
    rows: tech.map(r => ({ no: r.no, type: r.type, key: r.key, ruleId: r.ruleId, cat: r.cat, action: r.action, status: r.status, withdrawn: r.withdrawn, lines: r.lines, cells: r.cellsTech, impact: { kind: r.impact.kind, text: r.impact.textUnpriced } })),
    lines: doc.lines.map(l => ({ lineKey: l.lineKey, ref: l.ref, pn: l.pn, raw: l.raw, qtyRaw: l.qtyRaw, status: l.status, compliance: l.compliance, ourPn: l.ourPn, name: l.name, spec: l.spec, qty: l.qty, unit: l.unit,
      quoted: l.status === 'catalog' ? { ko: '견적함', en: 'Quoted' } : l.status === 'engineer-quote' ? { ko: '미견적 (회신 예정)', en: 'Not quoted' } : { ko: '미견적 (공급 범위 밖)', en: 'Not quoted' }, makeText: l.makeText, lead: l.lead ? { label: l.lead.label, toCustomer: l.lead.toCustomer, shipDate: l.lead.shipDate } : null,
      docPlan: l.docPlan ? { plan: l.docPlan.plan.map(p => ({ code: p.code, by: p.by, incl: p.incl, option: p.option, addDays: p.addDays })), text: { ko: l.docPlan.text.ko.replace(/,?\s*실비/g, ', 별도 견적함'), en: l.docPlan.text.en } } : null,
      drawing: l.drawing, cd: l.cd })),
    compliance: { ...doc.compliance }, notAvailable: { intro: doc.notAvailable.intro, outro: doc.notAvailable.outro, lines: doc.notAvailable.lines },
    options: { ko: '운임·옵션 비용(KOLAS 등)은 별도 견적함', en: 'Freight and option costs (KOLAS etc.) quoted separately' },
    footer: { ko: '가격본과 같은 사양·조건입니다.', en: 'Identical in scope to the priced offer.' },
  };
}
const CD_MONEY_RE = /₩|KRW|원정|\d{1,3}(?:,\d{3})+\s*원|\d+\s*원(?![가-힣])/;

/* ── 개정: 스냅샷·줄 대응·비교 (2.11절, 6.5절) ── */
function cdSnapshot(doc) {
  return {
    quoteNo: doc.quoteNo, rev: doc.rev, issuedAt: doc.issuedAt, validUntil: doc.validUntil, offerType: doc.offerType,
    basedOn: { rfqRev: doc.header.rfqRev, bomHash: doc.header.bomRef.hash, engine: 'bom-engine', ruleSet: CD_VERSION },
    lines: doc.lines.map(l => ({ lineKey: l.lineKey, ref: l.ref, pn: l.pn, raw: l.raw, qtyRaw: l.qtyRaw, status: l.status, compliance: l.compliance, ourPn: l.ourPn, name: l.name, spec: l.spec, specKey: l.specKey,
      qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, amount: l.amount, vat: l.vat, tierCode: l.lead?.code || null, shipDate: l.lead?.code === 'OWN_STOCK' ? l.lead.shipDate || null : null, delivery: l.delivery,
      docPlan: l.docPlan ? l.docPlan.plan.filter(p => p.incl).map(p => p.code) : [], options: l.docPlan ? l.docPlan.plan.filter(p => p.option).map(p => p.code) : [], drawingNo: l.drawing?.no || null, cd: l.cd })),
    cd: doc.rows.map(r => ({ no: r.no, type: r.type, seq: r.seq, key: r.key, ruleId: r.ruleId, cat: r.cat, action: r.action, lines: r.lines, status: r.status, statusAt: r.statusAt, customerReply: r.customerReply,
      repliedBy: r.repliedBy, closedAt: r.closedAt, history: r.history, firstRev: r.firstRev, lastRev: r.lastRev, withdrawn: r.withdrawn, required: r.required, offered: r.offered, reason: r.reason, refs: r.refs,
      impact: { kind: r.impact.kind, amountDelta: r.impact.amountDelta, leadDeltaDays: r.impact.leadDeltaDays, text: r.impact.text }, lineRefText: r.lineRefText, queue: r.queue })),
    gc: [...doc.gc.technical, ...doc.gc.commercial].map(g => g.id),
    totals: { supply: doc.totals.supply, sub: doc.totals.sub, ship: doc.totals.ship, vat: doc.totals.vat, total: doc.totals.total, wonKo: doc.totals.wordsDoc, counts: doc.compliance.counts },
    sign: { preparedBy: doc.header.preparedBy, checkedBy: doc.header.checkedBy, approvedBy: doc.header.approvedBy },
    revision: doc.revision, note: doc.revision.history[doc.revision.history.length - 1].desc, diff: null,
  };
}
const cdTok = s => new Set(cdNorm(s).split(/[^A-Z0-9가-힣./-]+/).filter(Boolean));
function cdJaccard(a, b) { const A = cdTok(a), B = cdTok(b); if (!A.size && !B.size) return 1; let n = 0; for (const t of A) if (B.has(t)) n++; return n / (A.size + B.size - n); }
// 이전 Rev 줄 ↔ 새 줄 (4단계): 1 번호+품번+원문 같음 → same, 2 번호(또는 품번) 같고 원문 유사도 ≥ 0.8 → changed, 3 사양 키 같음 → renumbered, 4 나머지 removed / added
function cdMatchLines(prevLines, nextLines) {
  const P = [...(prevLines || [])], N = [...(nextLines || [])], up = new Set(), un = new Set(), pairs = [];
  const take = (kind, test) => { for (const n of N) { if (un.has(n)) continue; const p = P.find(p => !up.has(p) && test(p, n)); if (p) { up.add(p); un.add(n); pairs.push({ prev: p, next: n, kind }); } } };
  take('same', (p, n) => p.ref === n.ref && (p.pn || '') === (n.pn || '') && cdNorm(p.raw) === cdNorm(n.raw));
  take('changed', (p, n) => ((p.ref && p.ref === n.ref) || (p.pn && p.pn === n.pn)) && cdJaccard(p.raw, n.raw) >= .8);
  take('renumbered', (p, n) => (p.specKey && p.specKey === n.specKey) || cdNorm(p.raw) === cdNorm(n.raw));
  return { pairs, added: N.filter(n => !un.has(n)), removed: P.filter(p => !up.has(p)) };
}
function cdQuoteDiff(prev, next) {
  const mt = cdMatchLines(prev.lines, next.lines), F = ['qty', 'unit', 'unitPrice', 'amount', 'status', 'compliance', 'ourPn'];
  const changed = [], renumbered = []; let held = 0, repriced = 0;
  const sum = { added: mt.added.length, removed: mt.removed.length, qty: 0, spec: 0, price: 0, status: 0 };
  for (const { prev: p, next: n, kind } of mt.pairs) {
    const fields = {};
    for (const f of F) if (JSON.stringify(p[f]) !== JSON.stringify(n[f])) fields[f] = [p[f], n[f]];
    if (cdNorm(p.raw) !== cdNorm(n.raw)) fields.raw = [p.raw, n.raw];
    if ((p.spec?.ko || '') !== (n.spec?.ko || '')) fields.spec = [p.spec?.ko || '', n.spec?.ko || ''];
    if (p.ref !== n.ref) renumbered.push({ lineKey: n.lineKey, ref: [p.ref, n.ref] });
    if (p.unitPrice != null && n.unitPrice != null) { if (p.unitPrice === n.unitPrice) held++; else repriced++; }
    if (fields.qty) sum.qty++; if (fields.spec || fields.raw) sum.spec++; if (fields.unitPrice) sum.price++; if (fields.status || fields.compliance) sum.status++;
    if (Object.keys(fields).length) changed.push({ lineKey: n.lineKey, ref: n.ref, kind, fields });
  }
  const pk = new Map((prev.cd || []).map(r => [r.key, r])), nk = new Map((next.cd || []).map(r => [r.key, r]));
  const cd = { added: [...nk.values()].filter(r => !pk.has(r.key)).map(r => r.no), status: [], withdrawn: [], renumbered: [] };
  for (const [k, r] of nk) { const o = pk.get(k); if (!o) continue; if (o.no !== r.no) cd.renumbered.push({ key: k, from: o.no, to: r.no }); if (r.withdrawn && !o.withdrawn) cd.withdrawn.push(r.no); else if (o.status !== r.status) cd.status.push({ no: r.no, from: o.status, to: r.status }); }
  const ds = (next.totals?.supply || 0) - (prev.totals?.supply || 0);
  return { from: prev.rev, to: next.rev, added: mt.added.map(l => l.lineKey), removed: mt.removed.map(l => l.lineKey), changed, renumbered, cd,
    totalDelta: { supply: ds, total: (next.totals?.total || 0) - (prev.totals?.total || 0), pct: prev.totals?.supply ? Math.round(ds / prev.totals.supply * 1000) / 10 : null }, priceHeld: held, repriced, summary: sum };
}
// 발행한 Rev 저장 (브라우저 편의 기능, 없어도 동작). 같은 Rev는 덮어쓰지 않는다 (발행본은 고칠 수 없는 스냅샷)
const CD_STORE_KEY = 'bn.cd.revs';
function cdStoreAll() { try { return JSON.parse(localStorage.getItem(CD_STORE_KEY) || '{}') || {}; } catch (e) { return {}; } }
function cdSaveRev(snap) {
  try {
    const all = cdStoreAll(), list = all[snap.quoteNo] = all[snap.quoteNo] || [];
    if (list.some(r => r.rev === snap.rev)) return { ok: false, why: 'exists' };
    list.push(snap); localStorage.setItem(CD_STORE_KEY, JSON.stringify(all)); return { ok: true };
  } catch (e) { return { ok: false, why: 'storage' }; }
}
const cdLoadRevs = quoteNo => { const l = cdStoreAll()[quoteNo]; return Array.isArray(l) ? l : []; };
const cdLastRev = quoteNo => cdLoadRevs(quoteNo).slice(-1)[0] || null;

/* ── 발행 전 불변 조건 (10.1절 1–12). 결과 [{ no, name, ok, detail }] ── */
const CD_NEG = /않|없|불가|\bnot\b|\bnever\b|\bcannot\b|\bonly forward/i;   // 'BoltNote'의 'Note'에 걸리지 않게 단어 경계
// 문장 단위로: 주어(볼트노트·당사·we·our) + 3.1/2.2 + 발행(issue)이 함께 있고 부정(않·없·not…)이 없는 문장
function cdSelf31Claims(text) {
  return String(text).split(/。\s*|\.\s+(?=[A-Z가-힣"(\[])|\n/).filter(s => /(볼트노트|당사|BoltNote|\bour\b|\bwe\b)/i.test(s) && /(?:EN\s*10204\s*(?:type\s*)?)?\b(3\.1|2\.2)\b/i.test(s) && /발행|issu/i.test(s) && !CD_NEG.test(s));
}
function cdCheck(doc, opt = {}) {
  const out = [], ck = (no, name, ok, detail = '') => out.push({ no, name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });
  const L = doc.lines, live = doc.rows.filter(r => !r.withdrawn), byLine = {}; for (const r of live) for (const l of r.lines) (byLine[l.key] = byLine[l.key] || []).push(r);
  const items = opt.items || null;
  // 1 줄 수
  const s = doc.compliance.byStatus;
  ck(1, '입력 줄 수 = 카탈로그 품목 + 엔지니어 견적 + 공급 불가 + 고객 제외', L.length === s.catalog + s.eq + s.na + s.excluded && (!items || items.filter(x => !x.section).length === L.length), JSON.stringify(s));
  // 2 기본값 흔적
  const miss2 = [];
  if (items) {
    const active = items.filter(x => !x.section);
    active.forEach((x, i) => { const l = L[i]; if (!l || l.status === 'excluded' || l.status === 'not-available') return;   // 공급하지 않는 줄의 기본값은 문서에 남길 대상이 아님
      for (const e of x.m.ev || []) { if (!/^A-/.test(e.rule)) continue; const r = CD_RULE[e.rule];
        if (!r) { miss2.push(`${l.ref}:${e.rule}(규칙 없음)`); continue; }
        if (r.gc) { const g = [...doc.gc.technical, ...doc.gc.commercial].find(g => g.id === r.gc); if (!g) miss2.push(`${l.ref}:${e.rule}→${r.gc} 없음`); continue; }
        if (!(byLine[l.lineKey] || []).some(rr => rr.ruleId === e.rule)) miss2.push(`${l.ref}:${e.rule}`); } });
  }
  ck(2, '기본값 이벤트가 모두 GC 또는 C행에 연결됨', items && !miss2.length, items ? miss2 : 'items 없음');
  // 3 원 사양과 다른 공급은 D행
  const miss3 = [];
  if (items) items.filter(x => !x.section).forEach((x, i) => { const l = L[i]; if (!l || l.status === 'excluded' || l.status === 'not-available') return;
    const ev = (x.m.ev || []).map(e => e.rule), differs = (x.m.alt && !x.m.alt.exact) || ev.includes('S-DIN-WAF') || ev.includes('S-KS-3JONG') ||
      (x.m.ev || []).some(e => e.rule === 'S-KS-1JONG' && CD_WAF_DIFF.includes(e.size)) || (NUTS.has(x.q.type) && x.q.mat?.code === '4') || x.q.mat?.nut === '4';
    if (differs && !(byLine[l.lineKey] || []).some(r => r.type === 'D' || r.type === 'E')) miss3.push(`${l.ref}:${l.raw}`); });
  ck(3, '원 사양과 다른 공급은 모두 D행', items && !miss3.length, items ? miss3 : 'items 없음');
  // 4 금액
  const t = doc.totals, lv = L.reduce((a, l) => a + (l.vat || 0), 0);
  ck(4, '한글 금액 = 합계, 공급가액 + 세액 = 합계, 줄 세액 합 = 세액', t.words === wonKo(t.total) && wonKoNum(t.words) === t.total && t.wordsOk && t.sub + t.ship === t.supply && t.supply + t.vat === t.total && lv + (t.shipVat || 0) === t.vat && wonKoNum(t.wordsDoc) === t.total,
    JSON.stringify({ sub: t.sub, ship: t.ship, vat: t.vat, total: t.total, words: t.words, lv, shipVat: t.shipVat }));
  // 5 준수 코드 집계
  const c = doc.compliance.counts; ck(5, '준수 코드 집계 합 = 줄 수', c.C + c.CC + c.D + c.E + c.N === L.length && doc.compliance.sumOk, JSON.stringify(c));
  // 6 행 번호 유지
  if (opt.prev) { const bad = (opt.prev.cd || []).filter(p => { const n = doc.rows.find(r => r.key === p.key); return !n || n.no !== p.no; }).map(p => p.no); ck(6, '같은 행 key는 Rev가 바뀌어도 같은 번호', !bad.length, bad); }
  else ck(6, '같은 행 key는 Rev가 바뀌어도 같은 번호 (이전 Rev 없음: 번호 중복만 검사)', new Set(doc.rows.map(r => r.no)).size === doc.rows.length && new Set(doc.rows.map(r => r.key)).size === doc.rows.length, '번호·key 중복');
  // 7 문서 사이 줄 수·금액·C&D 건수
  const snap = cdSnapshot(doc), un = cdUnpriced(doc), sumAmt = snap.lines.reduce((a, l) => a + (l.amount || 0), 0);
  ck(7, '견적서·C&D·요약·기술본의 줄 수·금액·C&D 건수가 같음', snap.lines.length === L.length && un.lines.length === L.length && doc.compliance.total === L.length && sumAmt === t.sub && snap.totals.total === t.total &&
    doc.compliance.cdCount === live.length && snap.cd.filter(r => !r.withdrawn).length === live.length && L.every(l => l.cd.every(no => live.some(r => r.no === no))), JSON.stringify({ lines: L.length, snap: snap.lines.length, sumAmt, sub: t.sub }));
  // 8 볼트노트 명의 3.1·2.2 없음 (서류 계획의 3.1·2.2는 모두 제조사 발행)
  const txt = JSON.stringify(doc) + JSON.stringify(un), claims = cdSelf31Claims(txt.replace(/\\n/g, '\n').replace(/","/g, '".\n"'));
  const badPlan = L.filter(l => l.docPlan && l.docPlan.plan.some(p => /MTC3[12]|MTC22/.test(p.code) && /BoltNote/i.test(p.by))).map(l => l.ref);
  ck(8, '볼트노트 명의 EN 10204 3.1·2.2 문구 없음', !claims.length && !badPlan.length, [...claims, ...badPlan]);
  // 9 기술본 금액 0건
  const ut = JSON.stringify(un), hit = ut.match(CD_MONEY_RE);
  ck(9, '가격 없는 기술본에 금액 표기 0건', !hit, hit ? ut.slice(Math.max(0, hit.index - 60), hit.index + 40) : '');
  // 10 정식 견적 조건
  if (doc.offerType === 'firm') {
    const eqNoRow = L.filter(l => l.status === 'engineer-quote' && !(byLine[l.lineKey] || []).some(r => r.ruleId === 'N-NOTQ')).map(l => l.ref);
    ck(10, '정식 견적: 운영자 서명·시각, 미해결 X 0건, N 줄은 모두 미견적 E행', doc.seal?.by && doc.seal?.at && !doc.unresolvedX.length && !eqNoRow.length && c.N === 0, JSON.stringify({ seal: doc.seal, x: doc.unresolvedX, eqNoRow }));
  } else ck(10, '정식 견적 조건 (자동 견적이라 해당 없음)', true);
  // 11 참조 문서
  const miss11 = [];
  L.forEach((l, i) => { const x = items ? items.filter(y => !y.section)[i] : null; if (l.status === 'not-available' || l.status === 'excluded') return; const docs = x ? cdRefDocs(x.q.raw).filter(d => !cdBasisReceived(doc.__rfq || opt.rfq || {}, d)) : [];
    for (const d of docs) if (!(byLine[l.lineKey] || []).some(r => r.ruleId === 'X-REFDOC' && String(r.params.doc).split('·').includes(d))) miss11.push(`${l.ref}:${d}`); });
  for (const b of (opt.rfq?.basis || [])) if (b && b.received === false && !live.some(r => r.ruleId === 'X-REFDOC' && String(r.params.doc).includes(b.doc))) miss11.push(`RFQ:${b.doc}`);
  ck(11, '받지 못한 참조 문서는 모두 X-REFDOC 행', !miss11.length, miss11);
  // 12 자동 견적: 직인·선언문 없음
  ck(12, '자동 견적에는 직인과 준수 선언문이 없음', doc.offerType === 'firm' || (!doc.seal && doc.statement.kind === 'indicative' && !/준수합니다|full compliance|NIL DEVIATION/.test(doc.statement.ko + doc.statement.en)), doc.statement.kind);
  return out;
}

/* ── 테스트 진입점 (페이지 동작에는 쓰지 않음). 결과는 JSON 복제 ── */
// input: 붙여넣은 글(string) 또는 [[원문, 수량, { no, pn, tag, filled }?], …]. 수량 없는 문맥 줄('4" CL300', 'PUMP P-101A API 610 S-6')은 구역 제목
function cdTestItems(input, rfq = {}) {
  if (typeof input === 'string') return cdItems(input, rfq);
  const rc = cdRfqCtx(rfq); let sec = null;
  return input.map(([raw, qty, row], i) => {
    const r = { no: String(i + 1), pn: '', ...(row || {}), text: raw, qty: qty == null ? null : String(qty) }, s = cdSectionOf(r);
    if (s) { sec = { ...s, text: raw, no: r.no }; return { row: r, section: true, sec }; }
    const api = sec?.api610 || rc.api610, L = bomLine(r, {}, api ? { api610: api } : {}); if (sec) L.sec = sec; return L;
  });
}
window.__bomTest.cd = {
  items: (input, rfq = {}) => bomJ(cdTestItems(input, rfq).map(x => ({ section: !!x.section, no: x.row?.no, status: x.m?.status || null, ev: (x.m?.ev || []).map(e => e.rule) }))),
  run(input, rfq = {}, prev = null) {
    const t0 = performance.now(), items = cdTestItems(input, rfq), t1 = performance.now(), doc = cdBuild(items, rfq, prev), t2 = performance.now(), checks = cdCheck(doc, { items, prev, rfq });
    return bomJ({ doc, unpriced: cdUnpriced(doc), snap: cdSnapshot(doc), checks, ms: { engine: Math.round(t1 - t0), cd: Math.round(t2 - t1) } });
  },
  diff: (a, b) => bomJ(cdQuoteDiff(a, b)), match: (a, b) => bomJ(cdMatchLines(a, b)), ctx: t => bomJ(cdCtxOf(t)), refDocs: t => cdRefDocs(t),
  shipDate: (iso, days) => ymd(cdShipDate(cdNow(iso), days || 0)), addBD: (iso, n) => ymd(cdAddBD(cdNow(iso), n)), b165: (cls, nps) => bomJ(cdB165(cls, nps)),
  impact: (imp, unpriced) => cdImpactText(imp, unpriced), refText: a => cdRefText(a), self31: t => cdSelf31Claims(t), money: t => CD_MONEY_RE.test(t),
  rules: () => CD_RULES.map(r => ({ id: r.id, type: typeof r.type === 'function' ? 'fn' : r.type, cat: typeof r.cat === 'function' ? 'fn' : r.cat, act: typeof r.act === 'function' ? 'fn' : r.act, basis: r.basis, gc: r.gc || null, out: r.out || 'row',
    trig: [r.ev && 'ev', r.when && 'when', r.bom && 'bom', r.rfq && 'rfq'].filter(Boolean).join('+'), ko: typeof r.ko === 'function' ? r.ko({}) : r.ko || '', en: typeof r.en === 'function' ? r.en({}) : r.en || '', refs: r.refs || [] })),
  gcList: () => bomJ([...CD_GC_T, ...CD_GC_C].map(g => ({ id: g.id, ko: cdVal(g.ko), en: cdVal(g.en), ph: !!g.ph }))),
  store: snap => { const a = cdSaveRev(snap), b = cdSaveRev(snap); return { first: a, second: b, loaded: cdLoadRevs(snap.quoteNo).length, last: cdLastRev(snap.quoteNo)?.rev || null }; },
  wordsDoc: n => wonKoDoc(n, '일금'),
  // 페이지 shipDate(재고, 지금)와 cdShipDate(지금, 0)이 같은 날을 내는지
  shipCmp: () => { const a = shipDate(true), b = cdShipDate(kstNow(), 0); return [a.label, `${b.getMonth() + 1}/${b.getDate()}(${DOW[b.getDay()]})`]; },
  // 불변 조건 검사가 실제로 잡는지: 정상 문서를 일부러 망가뜨려 실패하는 조건 번호를 돌려준다
  neg(input, rfq = {}, prev = null) {
    const items = cdTestItems(input, rfq), base = cdBuild(items, rfq, prev), clone = () => JSON.parse(JSON.stringify(base));
    const fails = (doc, o = {}) => cdCheck(doc, { items, prev, rfq, ...o }).filter(c => !c.ok).map(c => c.no);
    const T = {};
    T.base = fails(base);
    let d = clone(); d.compliance.byStatus.catalog += 1; T.t1 = fails(d);
    d = clone(); d.rows = d.rows.filter(r => !/^A-/.test(r.ruleId)); T.t2 = fails(d);
    d = clone(); d.rows = d.rows.filter(r => r.type !== 'D'); for (const l of d.lines) l.cd = l.cd.filter(n => !/^D-/.test(n)); d.compliance.cdCount = d.rows.filter(r => !r.withdrawn).length; T.t3 = fails(d);
    d = clone(); d.totals.total += 1; T.t4 = fails(d);
    d = clone(); d.compliance.counts.C += 1; T.t5 = fails(d);
    d = clone(); if (d.rows[0]) { d.rows[0].no = 'C-999'; } T.t6 = fails(d, { prev: cdSnapshot(base) });
    d = clone(); d.compliance.cdCount += 1; T.t7 = fails(d);
    d = clone(); const sup = d.lines.find(l => l.docPlan); if (sup) sup.docPlan.plan.push({ code: 'MTC31_FWD', by: 'BoltNote', incl: true }); T.t8 = fails(d);
    d = clone(); d.statement.en += ' BoltNote will issue the EN 10204 3.1 certificate.'; T.t8b = fails(d);
    d = clone(); const tr = d.rows.find(r => !CD_COMM.has(r.cat)); if (tr) tr.cellsTech[6] = { ko: tr.cellsTech[6].ko + ' 단가 ₩1,000', en: tr.cellsTech[6].en }; T.t9 = fails(d);
    d = clone(); d.offerType = 'firm'; T.t10 = fails(d);
    d = clone(); d.rows = d.rows.filter(r => r.ruleId !== 'X-REFDOC'); T.t11 = fails(d);
    d = clone(); d.statement = { ...d.statement, kind: 'nil', ko: '편차 없음 (NIL DEVIATION). 준수합니다.' }; T.t12 = fails(d);
    return T;
  },
};
