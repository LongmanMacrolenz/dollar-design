/* ── 내보내기·복사·발행 (4A 워크벤치와 4A-1 문서 공용) ──
   파일 저장: claude 'downloads' 기능 → 없으면 Blob + <a download>. 거절('declined')은 조용히 넘어간다.
   엑셀 5시트(8.7절) · JSON(QuoteRevision 6.5절) · CSV · 메일 텍스트. 가격 없는 기술본이면 금액 칸을 만들지 않는다. */
async function bomSaveFile(filename, data, mime) {
  let d = null;
  try { d = await window.claude?.use?.('downloads'); } catch { d = null; }
  if (d) {
    try { await d.save({ filename, data }); return 'saved'; }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') return 'declined';
      if (code === 'rate_limited') return 'busy';
      if (code === 'rejected_extension' || code === 'extension_not_enabled') return 'format';
      if (code === 'too_large') return 'large';
      if (!['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(code)) return 'fail';
    }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = filename; a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
    return 'saved';
  } catch { return 'fail'; }
}
const BOM_SAVE_MSG = { saved: n => `${n} 파일을 내보냈습니다`, declined: () => '', busy: () => '다른 저장 확인 창이 열려 있습니다. 잠시 뒤 다시 눌러 주세요.', format: () => '이 화면에서는 이 형식으로 저장할 수 없습니다.', large: () => '파일이 너무 큽니다. 줄을 나눠 내보내 주세요.', fail: () => '파일을 저장하지 못했습니다.' };
// 클립보드 복사, 막히면 읽기 전용 칸에 선택해 둔다
function bomCopy(txt, msgEl, ta, done) {
  const msg = t => { if (msgEl) msgEl.textContent = t; };
  const fallback = () => { if (ta) { ta.hidden = false; ta.value = txt; ta.focus(); ta.select(); } msg('자동 복사가 막혀 있어 아래 칸에 내용을 선택해 두었습니다. Ctrl+C로 복사하세요.'); };
  try { navigator.clipboard.writeText(txt).then(() => { if (ta) ta.hidden = true; msg(done); }, fallback); } catch { fallback(); }
}

/* ── 줄 표 (TSV·CSV·엑셀 ① 견적 시트 공용) ── */
function bomLineTable(c, unp = state.bom.unpriced) {
  const qno = c.doc.quoteNo;
  const H = ['BOM No', '고객 품번', '상태', '준수 코드', 'BOM 원문', '정리한 사양', '품명 영문 (Item name)', '당사 품번', '제조사·원산지', 'BOM 수량', '견적 수량', '단위', '포장', ...(unp ? ['견적 여부'] : ['단가(원, VAT 별도)', '공급가액(원)', '세액(원)']), '납기 티어', '출고·회신 예정', '인도 조건', '서류', 'C&D', '도면 번호 · 치수 근거', '사유·확인할 것'];
  const rows = c.L.map(v => {
    const { x, l } = v, m = x.m, na = m.status === 'not-available', st = v.ex ? '제외' : BOM_ST[m.status][0];
    const dim = x.q.dimStd ? x.q.dimStd.replace(/ \(.*$/, '') : '';
    return [bomRef(x), x.row.pn || '', st, l.compliance, x.row.text, na ? '' : m.spec, l.name?.en || '', m.pn || '', l.makeText, x.q.qty ? x.q.qty.raw || x.q.qty.n : '', na || v.ex ? '' : m.qty, bomUnit(m), m.packPlan?.note || '',
      ...(unp ? [l.status === 'catalog' ? '견적함 Quoted' : '미견적 Not quoted'] : [l.unitPrice ?? '', l.amount ?? '', l.vat ?? '']),
      m.lead?.label || '', l.lead?.shipDate ? (l.lead.code === 'OWN_STOCK' ? l.lead.shipDate : BOM_SHIP_TBD) : l.replyBy || '', na ? '' : m.delivery, l.docPlan?.text?.ko || '', (l.cd || []).join(', '),
      !na && l.drawing?.has ? `${bomDwgRef(qno, x)} · ${dim}` : dim,
      [...(unp ? [] : m.reasons.map(r => r.text)), ...(unp ? m.reasons.filter(r => !/\d원|₩/.test(r.text)).map(r => r.text) : []), ...(!unp && m.tier ? [m.tier.text] : []), ...(!na ? bomChecks(x) : [])].join(' ')];
  });
  return { H, rows };
}
function bomTermsRows(c, unp = state.bom.unpriced) {
  const d = c.doc, t = d.totals, s = c.sum, r = state.bom.rfq;
  return [['견적번호', `${d.quoteNo} Rev ${d.rev}`], ['견적일', qYmd(qdIssued(d))], ['유효기간', `${qYmd(bomDay(d.validUntil))}까지 (${SHOP_TERMS.validityDays}일)`], ['견적 구분', `${d.header.offerType.ko} ${d.header.offerType.en}`],
    ['수신', r.client || ''], ['건명', r.project || ''],
    ...(unp ? [['가격', '가격본에만 적음 (가격 없는 기술본)']] : [['공급가액(원)', t.sub], ['운임(원)', t.ship], ['부가세(원)', t.vat], ['합계(원, VAT 포함)', t.total], ['한글 금액', t.wordsDoc]]),
    ['납기', `카탈로그 품목: ${bomCatShipTxt(s, x => x)} · 엔지니어 견적: 회신 시 확정`], ['인도 조건', SHOP_TERMS.incoterm], ['운임', unp ? '별도 견적함' : `${SHOP_TERMS.freight}. ${SHOP_TERMS.bulky}`],
    ['대금 지급 조건', SHOP_TERMS.payment], ['증빙', '계좌이체: 전자세금계산서 · 카드: 카드 매출전표'], ['회신', SHOP_TERMS.reply], ['공급 불가', SHOP_TERMS.notAvail], ['서류', '볼트노트 CoC(ISO 16228 F2.1 형식) 기본. 제조사 3.1은 사본 전달. KOLAS·3.2는 요청 시 외부 기관']];
}
const bomCell = v => String(v ?? '').replace(/[\t\n]/g, ' ');
function bomTsv(c) {
  const { H, rows } = bomLineTable(c);
  return [H.join('\t'), ...rows.map(r => r.map(bomCell).join('\t')), '', ...bomTermsRows(c).map(r => r.map(bomCell).join('\t'))].join('\n');
}
const bomCsvCell = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function bomCsv(c) {
  const { H, rows } = bomLineTable(c);
  return '﻿' + [H, ...rows, [], ...bomTermsRows(c)].map(r => r.map(bomCsvCell).join(',')).join('\r\n');
}
function bomMail(c) {
  const d = c.doc, s = c.sum, r = state.bom.rfq, unp = state.bom.unpriced, R = d.statement.counts.rows, na = d.notAvailable;
  const subj = `[${d.quoteNo} Rev ${d.rev}] 볼트노트 BOM 견적 (${d.header.offerType.ko}${unp ? ', 가격 없는 기술본' : ''})`;
  const body = [`${r.client ? r.client + ' ' : ''}${r.attn ? r.attn + ' 귀하' : '담당자님'}`, '', `보내 주신 BOM ${s.n}줄의 견적을 드립니다.${r.project ? ` (건명: ${r.project})` : ''}`, '',
    `견적번호 ${d.quoteNo} Rev ${d.rev} · 유효기간 ${d.validUntil}까지`,
    ...(unp ? [] : s.sub > 0 ? [`합계 (VAT 포함): ${won(s.total)} · ${d.totals.wordsDoc}`, `공급가액 ${won(s.sub)} · 운임 ${won(s.ship)} · 부가세 ${won(s.vat)}`] : ['단가: 공급처 확인 뒤 줄마다 회신']),
    `카탈로그 품목 ${s.cat.length}줄 · 엔지니어 견적 ${s.eq.length}줄${s.lastReply ? ` (회신 예정 마지막 ${bomMD(s.lastReply)})` : ''} · 공급 불가 ${s.na.length}줄${s.ex.length ? ` · 제외 ${s.ex.length}줄` : ''}`,
    `C&D 시트 ${d.header.sheetNo}: 확인 ${R.C || 0} · 편차 ${R.D || 0} (승인 필요) · 예외 ${R.E || 0}`,
    ...(d.offerType === 'firm' ? [] : ['', '이 견적은 자동 견적입니다 (운영자 검토 전). 정식 견적이 필요하시면 회신 주십시오.']),
    ...(na.lines.length ? ['', `공급 불가 ${na.lines.length}건 (이 줄만 다른 공급처에 문의해 주십시오):`, ...na.lines.map(l => `- BOM No ${l.ref}${l.pn ? ` (${l.pn})` : ''}: ${l.raw}${l.qtyRaw ? ` · ${l.qtyRaw}` : ''}`)] : []),
    '', '첨부: 견적서 · C&D 시트 · 준수 요약 · 공급 불가 목록 · 도면 묶음 (인쇄본 또는 엑셀 5시트)', '', '볼트노트 드림'];
  return `${subj}\n\n${body.join('\n')}`;
}

// 구매자 → 볼트노트 방향의 견적 요청 (b2b #45). bomMail은 볼트노트가 고객에게 보내는 문장이라 정식 견적(firm)에서만 쓴다.
// 자동 견적 Rev를 그대로 요청 패키지로 쓴다: 엑셀 5시트·JSON(bomExport) + 인쇄(PDF). 보낼 방법 칸은 v5_rfq.js
function bomRfqPkg(c) {
  const d = c.doc, s = c.sum, r = state.bom.rfq, unp = state.bom.unpriced, base = `${d.quoteNo}-Rev${d.rev}${unp ? '-unpriced' : ''}`;
  return {
    kind: 'BQ', no: `${d.quoteNo} Rev ${d.rev}`, date: ymd(qdIssued(d)), fileBase: base,
    who: { co: r.client || '', name: r.attn || '', mail: '', tel: '' },
    content: `카탈로그 품목 ${s.cat.length}줄 · 엔지니어 견적 ${s.eq.length}줄 · 공급 불가 ${s.na.length}줄${s.ex.length ? ` · 제외 ${s.ex.length}줄` : ''}`,
    nLines: s.n, nLabel: `BOM ${s.n}줄`,
    // 가격 없는 줄(엔지니어 견적)이 있거나 가격 없는 기술본이면 합계를 메일에 적지 않는다
    total: !unp && !s.eq.length && s.cat.length ? s.total : null,
    due: r.due || '', area: r.place || '', pay: r.pay || '',
    files: [], attach: `${base}.xlsx, 도면·사양서`,
    extra: [], first: `요청번호 ${d.quoteNo} Rev ${d.rev} 견적 문의드립니다`,
    xlsx: msgEl => bomExport('xlsx', msgEl), json: msgEl => bomExport('json', msgEl),
    printable: QD_CANPRINT, print: () => { try { window.print(); } catch {} },
  };
}
const bomRfqMail = c => rfqMail(bomRfqPkg(c));

/* ── 엑셀 5시트 (8.7절): ① 견적 ② C&D ③ 요약 ④ 공급 불가 ⑤ 해석 원문 ── */
function bomWorkbook(X, c) {
  const d = c.doc, unp = state.bom.unpriced, wb = X.utils.book_new();
  const add = (name, aoa, cols) => { const ws = X.utils.aoa_to_sheet(aoa); if (cols) ws['!cols'] = cols; X.utils.book_append_sheet(wb, ws, name); return ws; };
  const T = bomLineTable(c, unp);
  add('견적', [[`견적서 ${d.quoteNo} Rev ${d.rev}${unp ? ' · 가격 없는 기술본' : ''}`], ...bomTermsRows(c, unp), [], T.H, ...T.rows], T.H.map((h, i) => ({ wch: i === 4 || i === 5 ? 48 : i === 6 ? 36 : i === T.H.length - 1 ? 60 : 14 })));
  const rows = (unp ? cdUnpriced(d).rows : d.rows);
  const hidden = ['ruleId', 'lineKeys', ...(unp ? [] : ['priceDelta']), 'leadDeltaDays', 'customerReply', 'repliedBy', 'closedAt', 'sheetHash'];
  const sheetHash = cdHash(JSON.stringify([d.quoteNo, d.rev, rows.map(r => r.key + r.status)]));
  const cdH = [...d.cols.map(h => `${h.ko} / ${h.en}`), ...hidden];
  const cdRows = rows.map(r => { const full = d.rows.find(x => x.key === r.key) || r; return [...r.cells.map(o => o.ko), full.ruleId, (full.lines || []).map(l => l.key).join(' '), ...(unp ? [] : [full.impact?.amountDelta ?? '']), full.impact?.leadDeltaDays ?? '', full.customerReply || '', full.repliedBy || '', full.closedAt || '', sheetHash]; });
  add('C&D', [[`${d.header.sheetNo} Rev ${d.rev} · ${d.header.offerType.ko}`], [`고객 조치(9열)·상태(10열)에는 아래 코드만 적어 주십시오. 조치: ${Object.values(CD_ACT).map(a => `${a.ko} ${a.en}`).join(' / ')} · 상태: ${Object.values(CD_STATUS).map(a => `${a.ko} ${a.en}`).join(' / ')}. 회신은 customerReply 칸에 적어 그대로 돌려보내 주시면 됩니다.`], [d.statement.ko], [], cdH, ...cdRows],
    cdH.map((h, i) => i < 10 ? { wch: [8, 12, 34, 40, 12, 12, 48, 30, 14, 14][i] } : h === 'customerReply' || h === 'repliedBy' ? { wch: 24 } : { wch: 14, hidden: true }));
  const C = d.compliance;
  add('요약', [['준수 요약', `${C.head.quoteNo} Rev ${C.head.rev}`, C.head.date], ['프로젝트', C.head.project], ['고객 RFQ / Rev', `${C.head.rfqNo} / ${C.head.rfqRev}`], [], ['코드', '뜻', '줄 수'], ...['C', 'CC', 'D', 'E', 'N'].map(k => [k, CD_COMP[k].ko, C.counts[k] || 0]), ['합계', C.sumOk ? '일치' : '불일치', C.total], [],
    ['분류', 'C', 'D', 'E'], ...Object.keys(CD_CAT).map(k => [CD_CAT[k].ko, C.byCat[k].C, C.byCat[k].D, C.byCat[k].E]), [], ['제조사 3.1 사본 포함', C.docs.mtc31], ['CoC(F2.1)만', C.docs.cocOnly], ['KOLAS 옵션', C.docs.kolasOpt], ['3.2 옵션', C.docs.mtc32Opt], [],
    ['카탈로그 품목 출고', bomLatestTxt(d)], ...Object.entries(C.lead.tiers).map(([k, n]) => [BOM_TIER[k]?.label || k, n]), [], ['줄별 준수 코드', C.listText], [], [C.statement.ko]], [{ wch: 22 }, { wch: 40 }, { wch: 12 }, { wch: 8 }]);
  const N = d.notAvailable;
  add('공급 불가', [[N.intro.ko], [N.intro.en], [], ['BOM No', '고객 품번', 'BOM 원문', '수량', '사유', '다른 공급처 안내'], ...N.lines.map(l => [l.ref, l.pn, l.raw, l.qtyRaw, l.reason, l.elsewhere.ko]), [], [N.outro.ko]], [{ wch: 8 }, { wch: 14 }, { wch: 44 }, { wch: 10 }, { wch: 60 }, { wch: 50 }]);
  const roles = c.parsed.roles || [], lab = k => (BOM_ROLES.find(r => r[0] === k) || ['', k])[1];
  add('해석 원문', [['열 매핑', roles.map((r, i) => r ? `${i < 26 ? String.fromCharCode(65 + i) : i + 1}→${lab(r)}` : '').filter(Boolean).join(' · ') || '한 줄씩 읽음'], [],
    ['BOM No', 'BOM 원문', '품목', '품목 영문 (Item)', '나사·호칭', '길이', '공차', '재질', '표면처리', '치수 규격', '기본값으로 채운 것', '확인할 것', '규칙 ID (이벤트)', '고친 값'],
    ...c.L.map(({ x, key }) => { const q = x.q; return [bomRef(x), x.row.text, q.typeLabel, bomEnType(q, true).en, threadTxt(q), q.lengthLabel || '', q.tolLabel || '', q.mat?.label || '', q.fin?.label || '', q.dimStd || '', q.assumptions.join(' / '), q.questions.join(' / '), [...new Set((x.m.ev || []).map(e => e.rule))].join(' '), state.bom.ov[key] ? JSON.stringify(state.bom.ov[key]) : '']; })],
    [{ wch: 8 }, { wch: 48 }, { wch: 16 }, { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 24 }]);
  return wb;
}
async function bomExport(kind, msgEl, ta) {
  const c = bomCompute(), d = c.doc, unp = state.bom.unpriced, base = `${d.quoteNo}-Rev${d.rev}${unp ? '-unpriced' : ''}`;
  const say = t => { if (msgEl && t != null) msgEl.textContent = t; };
  const done = (r, name) => say((BOM_SAVE_MSG[r] || BOM_SAVE_MSG.fail)(name));
  if (kind === 'mail') { bomCopy(bomMail(c), msgEl, ta, '메일 제목과 본문을 복사했습니다. 메일 창에 붙여 넣으세요.'); return; }
  if (kind === 'json') {
    const out = unp ? { format: 'boltnote.quote-revision', kind: 'unpriced', unpriced: cdUnpriced(d) } : { format: 'boltnote.quote-revision', kind: 'priced', revision: cdSnapshot(d), bom: { text: state.bom.text, map: state.bom.map, ov: state.bom.ov }, rfq: state.bom.rfq };
    done(await bomSaveFile(base + '.json', JSON.stringify(out, null, 1), 'application/json'), base + '.json'); return;
  }
  if (kind === 'csv') { done(await bomSaveFile(base + '.csv', bomCsv(c), 'text/csv'), base + '.csv'); return; }
  if (kind === 'xlsx') {
    say('엑셀 도구를 불러오는 중…');
    let X; try { X = await loadXLSX(); } catch { say('엑셀 도구를 불러오지 못했습니다. CSV나 엑셀용 복사(TSV)를 써 주세요.'); return; }
    try { const buf = X.write(bomWorkbook(X, c), { type: 'array', bookType: 'xlsx' }); done(await bomSaveFile(base + '.xlsx', new Uint8Array(buf), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), base + '.xlsx'); }
    catch { say('엑셀 파일을 만들지 못했습니다.'); }
  }
}

/* ── Rev 발행: 12가지 대조(cdCheck)를 모두 통과해야 이 브라우저에 스냅샷으로 남긴다 ── */
function bomIssue(msgEl) {
  const c = bomCompute(), d = c.doc, B = state.bom, say = h => { if (msgEl) msgEl.innerHTML = h; };
  if (c.issued) { say(noteSm('info', `Rev ${esc(d.rev)}는 이미 발행했습니다. BOM이나 판단을 고치면 다음 Rev로 발행합니다.`, '발행')); return; }
  let checks; try { checks = cdCheck(d, { items: c.all, prev: c.prev, rfq: c.rfq }); } catch (e) { checks = [{ no: 0, name: '대조 실행', ok: false, detail: String(e) }]; }
  const bad = checks.filter(k => !k.ok);
  if (bad.length) { say(note('crit', `발행을 멈췄습니다. 대조 ${checks.length}가지 중 ${bad.length}가지가 맞지 않습니다.<ul class="wb-bad">${bad.map(k => `<li><b>${k.no}.</b> ${esc(k.name)}${k.detail ? ` <span class="xs">${esc(k.detail.slice(0, 160))}</span>` : ''}</li>`).join('')}</ul>`, '중단')); return; }
  const r = cdSaveRev(cdSnapshot(d));
  if (!r.ok) { say(noteSm('warn', r.why === 'exists' ? `Rev ${esc(d.rev)}는 이미 이 브라우저에 발행되어 있습니다.` : '이 브라우저 저장소가 막혀 발행본을 남기지 못했습니다. JSON으로 내려받아 보관해 주세요.', '발행')); return; }
  B.qno = d.quoteNo; B.issued = { ...B.issued, [`${d.quoteNo}|${d.rev}`]: c.baseKey }; bomSave();
  wbPaint();
  const m = document.getElementById('wb-issue-msg'); if (m) m.innerHTML = note('ok', `Rev ${esc(d.rev)}를 발행했습니다. 대조 ${checks.length}가지를 모두 통과했습니다. 견적서·C&amp;D 문서는 4A-1장에서 인쇄하거나 내려받으세요.`, '발행');
  toast(`Rev ${d.rev}를 발행했습니다`);
}
// 내보내기 버튼 (4A D 구역)
document.addEventListener('click', e => {
  const b = e.target.closest('#wb-out [data-x]'); if (!b) return;
  bomExport(b.dataset.x, document.getElementById('wb-x-msg'), null);
});

/* ── 홈 B 구역: 4A장으로 들어가는 표제란 한 줄 ── */
function bomHomeEntry() {
  return `<div class="wb-home" role="group" aria-labelledby="wbh-h">
  <div class="wbh-no"><span class="bub" aria-hidden="true"><b>BOM</b><i>4A</i></span><span class="lab">장 Sheet</span></div>
  <div class="wbh-t"><h3 id="wbh-h">BOM 붙여넣기 견적</h3><p>BOM 표를 그대로 붙여 넣으면 줄마다 규격을 읽고, 단가·납기·서류·도면에 C&amp;D 시트까지 한 번에 만듭니다.</p></div>
  <div class="wbh-out"><span class="lab">나오는 문서</span><span>견적서 · C&amp;D 시트 · 준수 요약 · 공급 불가 목록 · 도면 묶음 · 엑셀 5시트</span></div>
  <div class="wbh-go"><a class="btn pri" href="#bom" data-go="bom">BOM 붙여넣기 <span class="ar">→</span> 4A장</a><span class="sub">엑셀·CSV 파일도 열 수 있고, 해석은 이 브라우저 안에서만 합니다</span></div>
</div>`;
}

// 시험용 (성능·화면 대조): 붙여넣기 → 계산 → 그리기 시간. 화면에서 쓰지 않는다
if (window.__bomTest) window.__bomTest.view = {
  paint(text) {
    if (state.route !== 'bom') go('bom');
    const ta = document.getElementById('bom-text'), t0 = performance.now();
    ta.value = text; bomNewText(text, false);
    const c = bomCompute(), t1 = performance.now();
    wbPaint(); void document.body.offsetHeight; const t2 = performance.now();
    return { lines: c.L.length, rows: document.querySelectorAll('#wb-list .wb-row').length, compute: Math.round(t1 - t0), render: Math.round(t2 - t1), total: Math.round(t2 - t0), engine: Math.round(c.ms.items), cd: Math.round(c.ms.cd), need: c.sum.need.length };
  },
  quote() { const t0 = performance.now(); go('quote'); void document.body.offsetHeight; return Math.round(performance.now() - t0); },
  state: () => JSON.parse(JSON.stringify({ filter: state.bom.filter, dec: state.bom.dec, ok: state.bom.ok, excl: state.bom.excl, orig: state.bom.orig })),
};
// 공식 영문 품명 시험용 (out_gn/work/en_check.py): 표·품목군·줄 이름
if (window.__bomTest) window.__bomTest.en = {
  map: () => JSON.parse(JSON.stringify(BOM_EN)),
  fams: () => [...METRIC, ...INCH, ...BOM_FAMS].map(f => ({ id: f.id, set: METRIC.includes(f) ? 'METRIC' : INCH.includes(f) ? 'INCH' : 'ENGINE', name: f.name, short: f.short, en: f.en, enStd: f.enStd, enShort: f.enShort })),
  line: (raw, qty) => { const L = bomLine({ text: raw, qty: String(qty) }); const t = bomEnType(L.q), k = bomEn(t.key); return { ko: L.q.typeLabel, key: t.key, keyKo: k ? k.ko : null, en: t.en, enPt: bomEnType(L.q, true).en, cd: cdSpecEn(L.q), match: bomEnMatch(L.m), status: L.m.status, fam: L.m.fam }; },
  cart: l => bomEnCart(l),
  grades: () => ['B7S', 'F880M', 'LW188', 'LWCS'].map(k => [k, GRADE[k].label, GRADE[k].en]),
};
