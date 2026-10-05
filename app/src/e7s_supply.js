/* ── 공급 경로·납기 티어 (supply.json plan.leadTimeRules·sourcingMatrix를 엔진 조건으로 옮김) ──
   dispatch = 발주 확정(입금 확인, 승인 거래처 발주서 접수, 기관 발주 통보)부터 우리 출고까지, toCustomer = 고객 수령까지. 한국 영업일 [최소, 최대].
   출고 마감은 페이지 상수 CUTOFF 하나만 쓴다 (BOM·C&D 사양 12장 미결 1번: 페이지 값을 유지. 자체 재고 운영이면 그 값, 아니면 도매처 재고 마감).
   재고는 카탈로그의 재고 표시(예시 데이터)만 쓰고 재고 수량은 만들지 않는다. OWN_STOCK 티어는 페이지 스위치 OWN_STOCK이 true일 때만 나온다
   (false = 검증 기간: 재고 표시 품목도 도매처 재고로 본다. variantInfo·famVi가 m.stock을 false로 준다). */
const BOM_TIER = {
  OWN_STOCK: { label: '자체 재고', dispatch: [0, 0], toCustomer: [1, 2], returnable: true, requiresQuote: false },
  PARTNER_STOCK: { label: '도매처 재고', dispatch: [1, 2], toCustomer: [2, 3], returnable: true, requiresQuote: false },
  MRO_BACKUP: { label: '도매처 수배', dispatch: [4, 6],   // 도매처 재고 + 도금·인치 수배 (2영업일 초과): '도매처 재고'라고만 쓰지 않는다 (C&D 영문 'Wholesaler sourcing')
  toCustomer: [5, 7], returnable: true, requiresQuote: false },
  IMPORT_VIA_KR_MRO: { label: '해외 수입', dispatch: [15, 20], toCustomer: [16, 21], returnable: false, requiresQuote: false, payFirst: true },
  DOMESTIC_MFG: { label: '국내 제작', dispatch: null, toCustomer: [7, 15], returnable: false, requiresQuote: true, validityDays: 14 },
  IMPORT_US: { label: '해외 수입', dispatch: [6, 11], toCustomer: [7, 12], returnable: false, requiresQuote: true, validityDays: 7 },
  IMPORT_US_MFG: { label: '해외 수입', dispatch: null, toCustomer: [15, 25], returnable: false, requiresQuote: true, validityDays: 7 },
  NO_SOURCE: { label: '견적 문의', dispatch: null, toCustomer: null, returnable: null, requiresQuote: true, sellable: false },
};
// 오너 결정 (2026-10-01): 카탈로그 품목 줄은 도매처 재고를 확인하기 전에 출고일을 날짜로 약속하지 않는다. 자체 재고 티어(OWN_STOCK, 지금은 꺼짐)만 날짜를 쓴다.
// 화면·문서·내보내기가 이 문구 하나를 쓴다. 출고일 계산(m.ship, m.leadDays, m.lead.shipDate)은 그대로 둔다
const BOM_SHIP_TBD = '출고일은 공급처 확인 후 확정';
// 엔지니어 견적 사유의 납기 힌트(LEAD_HINT)를 영업일로 (1주 = 5영업일). mill·lot·make는 기본 납기, 나머지는 더해지는 공정
const LEAD_DAYS = { mill: [15, 30], lot: [10, 20], make: [10, 20], coat: [10, 15], plate: [5, 10], sec: [5, 10], cert: [5, 10] };
const LEAD_ADD = ['coat', 'plate', 'sec', 'cert'];
const bdRange = r => !r ? '' : r[0] === r[1] ? `${r[0]}영업일` : `${r[0]}–${r[1]}영업일`;

/* 줄 하나의 티어. 반환 { code, label, dispatch, toCustomer, cutoff, returnable, requiresQuote, validityDays, shipDate, basis, example, text }
   - 카탈로그 품목: 재고 표시 → OWN_STOCK (페이지 OWN_STOCK이 true일 때만), 수배 2영업일 이내 → PARTNER_STOCK, 그보다 길면(도금·인치 수배) → MRO_BACKUP. 출고일은 shipDate와 같은 계산(m.leadDays)
   - 엔지니어 견적: 사유의 납기 힌트로 정한다. 주문 제작·밀 수배 → DOMESTIC_MFG, 인치(ASTM) 로트·성적서 → IMPORT_US,
     국산 로트·외주 공정 → DOMESTIC_MFG, 확인만 필요(check) → NO_SOURCE(견적 문의).
     카탈로그 기본품과 같은데 확인·추가 공정만 붙은 줄(m.alt.exact)은 그 기본품의 티어 + 공정 일수, 견적 필요
   - 공급 불가 → null */
function bomTierOf(q, m) {
  if (!m || m.status === 'not-available') return null;
  const cut = `${String(CUTOFF).padStart(2, '0')}:00`;
  const mk = (code, x) => { const T = BOM_TIER[code]; return { code, label: T.label, dispatch: T.dispatch, toCustomer: T.toCustomer, cutoff: null, returnable: T.returnable, requiresQuote: T.requiresQuote, validityDays: T.validityDays ?? null, shipDate: null, basis: '', example: false, ...x }; };
  // 카탈로그 기본 티어 (stock: 재고 표시, n: 출고까지 영업일)
  const catTier = (stock, n) => {
    const code = stock ? 'OWN_STOCK' : n <= 2 ? 'PARTNER_STOCK' : 'MRO_BACKUP', T = BOM_TIER[code];
    const dispatch = stock ? [n, n] : [Math.max(1, n - (T.dispatch[1] - T.dispatch[0])), n];
    return { code, dispatch, toCustomer: [dispatch[0] + T.toCustomer[0] - T.dispatch[0], dispatch[1] + T.toCustomer[1] - T.dispatch[1]] };
  };
  if (m.status === 'catalog') {
    const c = catTier(m.stock, m.leadDays ?? 0);
    const t = mk(c.code, { dispatch: c.dispatch, toCustomer: c.toCustomer, cutoff: cut, shipDate: m.ship?.label || null, example: true,
      basis: m.stock ? '카탈로그 재고 표시 (예시)' : '카탈로그 수배 납기 (예시)' });
    // 자체 재고가 없으면(검증 기간) 도매처 재고 줄은 '도매처 재고 확인 후 출고 (보통 1–2영업일)'
    // 2영업일보다 긴 줄(MRO_BACKUP: 도금·인치 수배)은 '도매처 재고'만 쓰지 않고 무엇이 붙어 늦는지 적는다
    const head = !OWN_STOCK && c.code === 'PARTNER_STOCK' ? `${t.label} 확인 후 출고 (예상 ${bdRange(c.dispatch)})` : c.code === 'MRO_BACKUP' ? `${t.label} · 도매처 재고 확인 후 ${m.finCode && FINISH[m.finCode]?.lead ? '도금' : '수배'} 포함 예상 ${bdRange(c.dispatch)} 출고` : `${t.label} · 예상 ${bdRange(c.dispatch)} 출고`;
    t.text = c.dispatch[1] === 0 ? `${t.label} · 평일 ${CUTOFF}시까지 발주 확정 시 당일 출고` : c.code === 'OWN_STOCK' ? `${head}${t.shipDate ? ` · ${t.shipDate} 출고 예정` : ''}` : `${head} · ${BOM_SHIP_TBD}`;
    return t;
  }
  // 엔지니어 견적
  const warn = m.reasons.filter(r => r.tone === 'warn'), leads = new Set(warn.filter(r => r.lead).map(r => r.lead));
  const base = ['mill', 'make', 'lot'].filter(k => leads.has(k)).map(k => LEAD_DAYS[k]).sort((a, b) => b[1] - a[1])[0] || null;
  const add = LEAD_ADD.filter(k => leads.has(k)).reduce((a, k) => [a[0] + LEAD_DAYS[k][0], a[1] + LEAD_DAYS[k][1]], [0, 0]);
  const processed = ['coat', 'plate', 'sec'].some(k => leads.has(k)) || warn.some(r => r.kind === 'addon');
  // 카탈로그 기본품 + 확인·추가 공정만
  if (m.alt && m.alt.exact && !base) {
    const n = m.alt.stock ? 0 : 2, c = catTier(m.alt.stock, n);
    const dispatch = [c.dispatch[0] + add[0], c.dispatch[1] + add[1]];
    // 외주 공정(코팅·도금·후가공)이 붙으면 '도매처 재고'가 아니라 국내 외주 공정품 (국내 제작)으로 표시한다
    if (processed && add[1]) c.code = 'DOMESTIC_MFG';
    const t = mk(c.code, { dispatch, toCustomer: [dispatch[0] + 1, dispatch[1] + (c.code === 'OWN_STOCK' ? 2 : 1)], requiresQuote: true, returnable: processed ? false : true,
      validityDays: SHOP_TERMS.validityDays, example: true, basis: `카탈로그 기본품 ${m.alt.pn}${add[1] ? ' + 추가 공정·서류' : ' (확인 후 확정)'}` });
    t.text = c.code === 'DOMESTIC_MFG' ? `${t.label} (기본품 + 외주 공정) · 확인 후 ${bdRange(dispatch)} 출고 (견적 시 확정)` : `${t.label} · 확인 후 ${bdRange(dispatch)} 출고 (견적 시 확정)`;
    return t;
  }
  let code;
  if (leads.has('make') || leads.has('mill')) code = 'DOMESTIC_MFG';
  else if (q.system === 'inch' && (leads.has('lot') || leads.has('cert'))) code = 'IMPORT_US';
  else if (['lot', 'coat', 'plate', 'sec', 'cert'].some(k => leads.has(k))) code = 'DOMESTIC_MFG';
  else code = 'NO_SOURCE';
  if (code === 'NO_SOURCE') return Object.assign(mk(code, { basis: '공급처 확인 전' }), { text: '견적 문의 · 사양 확인 후 공급처와 납기를 회신' });
  const dispatch = base || add[1] ? [(base ? base[0] : 0) + add[0], (base ? base[1] : 0) + add[1]] : null;
  const t = mk(code, { dispatch, toCustomer: dispatch ? [dispatch[0] + 1, dispatch[1] + 1] : BOM_TIER[code].toCustomer, basis: `견적 사유의 납기 힌트 (${[...leads].filter(k => LEAD_DAYS[k]).map(k => LEAD_HINT[k]).join(', ')})` });
  t.text = `${t.label} · 고객 수령까지 약 ${bdRange(t.toCustomer)} (견적 시 확정)`;
  return t;
}
// 주문 전체 납기: 줄별 고객 수령 상한의 최댓값 (사양 3.6). 카탈로그 품목 줄만 보거나(onlyCatalog) 전부 본다
function bomOrderLead(items, onlyCatalog = true) {
  const ls = (items || []).filter(x => x?.m?.lead?.toCustomer && (!onlyCatalog || x.m.status === 'catalog'));
  if (!ls.length) return null;
  const hi = ls.reduce((a, x) => x.m.lead.toCustomer[1] > a.m.lead.toCustomer[1] ? x : a);
  return { toCustomerMax: hi.m.lead.toCustomer[1], line: hi.row?.no ?? null, code: hi.m.lead.code };
}

/* ── 포장 조합 (사양 3.3): 필요 수량 이상을 가장 싸게. 여유 허용, 같은 값이면 포장 수가 적은 쪽, 그다음 여유가 적은 쪽 ──
   반환 packPlan = { need, packs: [{ size, count, price(포장 1개 값) }], ordered, over, unit(실제 개당 값), amount, uom, packCount, base, note }
   BOM 견적 수량·금액(m.qty·m.amount)은 바꾸지 않는다. packPlan은 안내다 (여유가 생기면 K-PACK 이벤트). */
// 일반형 (도매처·수입품 포장 가격): packs = [{ size, price }] 포장 1개 값(원, VAT 별도), breaks = [[최소 총개수, 배수], …] (선택)
function bomPackBest(need, packs, breaks = null, uom = 'EA') {
  need = Math.max(0, Math.ceil(+need || 0));
  const P = (packs || []).filter(p => p && p.size >= 1 && isFinite(p.price) && p.price >= 0).map(p => ({ size: Math.round(p.size), price: +p.price }));
  if (!P.length) return null;
  const mult = n => breaks && breaks.length ? ([...breaks].sort((a, b) => a[0] - b[0]).filter(b => n >= b[0]).pop() || [0, 1])[1] : 1;
  const maxN = Math.max(...P.map(p => p.size));
  // 아주 큰 수량: 개당 가장 싼 포장으로 먼저 채우고 나머지(최대 포장 2개분 이상)만 계산
  let fixed = null, rest = need;
  if (need > 20000) {
    const big = P.reduce((a, p) => p.price / p.size < a.price / a.size ? p : a), k = Math.floor((need - 2 * maxN) / big.size);
    if (k > 0) { fixed = { i: P.indexOf(big), count: k }; rest = need - k * big.size; }
  }
  const fixN = fixed ? fixed.count * P[fixed.i].size : 0, fixCost = fixed ? fixed.count * P[fixed.i].price : 0;
  const hiT = breaks ? Math.max(0, ...breaks.map(b => b[0] - fixN).filter(t => t > rest)) : 0, top = Math.max(rest, hiT) + maxN;
  // g[n] = 정확히 n개를 만드는 최소 (값, 포장 수)
  const g = new Array(top + 1).fill(null); g[0] = { cost: 0, packs: 0, prev: -1, i: -1 };
  for (let n = 1; n <= top; n++) for (let i = 0; i < P.length; i++) {
    if (n < P[i].size) continue; const b = g[n - P[i].size]; if (!b) continue;
    const c = { cost: b.cost + P[i].price, packs: b.packs + 1, prev: n - P[i].size, i }, cur = g[n];
    if (!cur || c.cost < cur.cost - 1e-9 || (Math.abs(c.cost - cur.cost) < 1e-9 && c.packs < cur.packs)) g[n] = c;
  }
  let best = null;
  for (let n = rest; n <= top; n++) {
    if (!g[n]) continue;
    const tot = n + fixN, cost = Math.round((g[n].cost + fixCost) * mult(tot)), k = g[n].packs + (fixed ? fixed.count : 0);
    if (!best || cost < best.cost || (cost === best.cost && (k < best.k || (k === best.k && n < best.n)))) best = { n, cost, k };
  }
  if (need === 0) best = { n: 0, cost: 0, k: 0 };
  const cnt = P.map(() => 0); if (fixed) cnt[fixed.i] += fixed.count;
  for (let n = best.n; n > 0; n = g[n].prev) cnt[g[n].i]++;
  const m = mult(best.n + fixN);
  const chosen = P.map((p, i) => ({ size: p.size, count: cnt[i], price: Math.round(p.price * m) })).filter(p => p.count).sort((a, b) => b.size - a.size);
  const amount = chosen.reduce((a, p) => a + p.count * p.price, 0), ordered = best.n + fixN;
  return bomPackOut(need, chosen, ordered, amount, uom, null, null);
}
// 카탈로그 (낱개 판매, 수량 구간 단가): pk = 표준 포장 입수, unitAt(n) = n개 주문 시 개당 값 (TIERS 반영된 카탈로그 단가)
function bomPackCatalog(need, pk, unitAt, uom = 'EA') {
  need = Math.max(0, Math.ceil(+need || 0)); pk = Math.max(1, Math.round(pk || 1));
  const packsOf = n => Math.floor(n / pk) + n % pk;   // 낱개는 하나씩 센다
  const cands = new Set([need, Math.ceil(need / pk) * pk]);
  for (const [t] of TIERS) if (t > need) { cands.add(t); cands.add(Math.ceil(t / pk) * pk); }
  let best = null;
  for (const n of cands) {
    if (n < need) continue;
    const u = n ? unitAt(n) : 0, amount = u * n, k = packsOf(n);
    if (!best || amount < best.amount || (amount === best.amount && (k < best.k || (k === best.k && n < best.n)))) best = { n, u, amount, k };
  }
  const full = pk > 1 ? Math.floor(best.n / pk) : 0, loose = best.n - full * pk;
  const packs = [...(full ? [{ size: pk, count: full, price: best.u * pk }] : []), ...(loose ? [{ size: 1, count: loose, price: best.u }] : [])];
  return bomPackOut(need, packs, best.n, best.amount, uom, need ? unitAt(need) * need : 0, pk);
}
// pk: 카탈로그 표준 포장 입수 (일반형은 null)
function bomPackOut(need, packs, ordered, amount, uom, base, pk) {
  const u = uom === 'SET' ? '세트' : '개', over = ordered - need;
  const combo = packs.map(p => p.size > 1 ? `${p.size.toLocaleString()}${u}입 × ${p.count.toLocaleString()}` : `낱개 ${p.count.toLocaleString()}${u}`).join(' + ') || '없음';
  const plan = { need, packs, ordered, over, unit: ordered ? Math.round(amount / ordered) : 0, amount, uom, packCount: packs.reduce((a, p) => a + p.count, 0), base, combo };
  if (!over) plan.note = packs.some(p => p.size > 1) ? `${combo} (필요 ${need.toLocaleString()}${u})` : pk === 1 ? `${need.toLocaleString()}${u} (낱개 판매 품목)` : pk ? `낱개 ${need.toLocaleString()}${u} (${pk.toLocaleString()}${u}입 포장 미만)` : combo;
  else if (base != null && base > amount) plan.note = `필요 ${need.toLocaleString()}${u} → ${ordered.toLocaleString()}${u} (${combo}), 여유 ${over.toLocaleString()}${u}. 합계 ${won(amount)}으로 ${need.toLocaleString()}${u} 주문(${won(base)})보다 ${won(base - amount)} 쌉니다.`;
  else if (base != null) plan.note = `필요 ${need.toLocaleString()}${u} → ${ordered.toLocaleString()}${u} (${combo}), 여유 ${over.toLocaleString()}${u}. 금액은 같고 포장 수가 적습니다.`;
  else plan.note = `필요 ${need.toLocaleString()}${u} → 공급 ${ordered.toLocaleString()}${u} (${combo}), 여유 ${over.toLocaleString()}${u}, 실제 개당 ${won(plan.unit)}`;
  return plan;
}
