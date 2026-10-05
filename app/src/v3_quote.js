/* ── 4A-1 견적서·C&D 문서 (#quote): 같은 Rev 문서 여섯 가지 ──
   견적서(A4 세로, 공공·기업 양식 필드) · C&D 시트(A4 가로) · 준수 요약 · 공급 불가 목록 · 도면 묶음(A4 가로) · 개정 비교
   가격 없는 기술본(8.9절)은 같은 문서에서 금액을 모두 뺀다. 숫자·문구는 cdBuild 문서 한 곳에서만 읽는다. */
const QD_DOCS = [['quote', '견적서', 'A4 세로'], ['cd', 'C&D 시트', 'A4 가로'], ['comp', '준수 요약', 'A4 세로'], ['na', '공급 불가 목록', 'A4 세로'], ['dwg', '도면 묶음', 'A4 가로'], ['diff', '개정 비교', '화면']];
const QD_CANPRINT = (() => { try { return window.top === window.self; } catch { return false; } })();
const qdPh = t => `<span class="ph">${esc(t)}</span>`;
const qdBiz = () => SHOP.bizNo ? esc(SHOP.bizNo) : qdPh('000-00-00000');
// 인쇄: 문서마다 이름 붙인 쪽(@page) — 방향과 쪽 아래 문서 번호 · Rev · 쪽 번호 (모든 쪽에 반복)
const QD_PG = { quote: ['qdq', 'portrait', '견적서', ''], cd: ['qdc', 'landscape', 'C&D 시트', '-CD'], comp: ['qds', 'portrait', '준수 요약', '-CS'], na: ['qdn', 'portrait', '공급 불가 목록', '-NA'], dwg: ['qdd', 'landscape', '도면 묶음', '-D'], diff: ['qdf', 'portrait', '개정 비교', ''] };
const qdCssStr = t => '"' + String(t).replace(/[\\"]/g, '\\$&').replace(/\n/g, ' ') + '"';
const qdPageCss = d => `<style>${Object.entries(QD_PG).map(([k, [n, o, t, suf]]) => `@page ${n} { size: A4 ${o}; margin: ${o === 'portrait' ? '14mm 12mm 16mm' : '10mm 10mm 13mm'}; @bottom-left { content: ${qdCssStr(`${d.quoteNo}${suf} Rev ${d.rev} · ${t}`)}; font-size: 7.5pt; } @bottom-right { content: counter(page) " / " counter(pages); font-size: 7.5pt; } } .qd-pg-${k} { page: ${n}; }`).join('\n')}</style>`;
const qdDate = v => { const d = bomDay(v); return d ? qYmd(d) : ''; };
const qdIssued = d => bomDay(String(d.issuedAt).slice(0, 10));
// 이중 언어 칸: 병기는 한국어 + 영어(작게), 한국어만, 영어만
const qdBi = (o, lang = state.bom.lang) => !o ? '' : typeof o === 'string' ? esc(o) : lang === 'en' ? esc(o.en || o.ko) : lang === 'ko' || !o.en || o.en === o.ko ? esc(o.ko) : `${esc(o.ko)}<span class="en">${esc(o.en)}</span>`;
const qdSpecOf = q => `${threadTxt(q)}${q.lengthLabel ? ' × ' + q.lengthLabel.replace(/ \(.*$/, '') : ''}`;
// 문서 앞 공통: 워터마크(자동 견적)와 인쇄 바닥 줄(문서 번호 · Rev)
const qdWm = d => d.offerType !== 'firm' ? `<div class="qd-wm" aria-hidden="true"><span>${esc(d.watermark?.ko || '자동 견적 · 운영자 검토 전')}</span></div><p class="qd-stamp"><b>${esc(d.watermark?.ko || '자동 견적 · 운영자 검토 전')}</b> ${esc(d.watermark?.en || 'Indicative – not reviewed')}</p>` : '';
const qdSupplier = (firm, cls = '') => `<table class="qd-sup ${cls}"><colgroup><col class="k0"><col class="k1"><col><col class="k1"><col></colgroup><tbody>
  <tr><th rowspan="${SHOP.addr ? 6 : 5}" class="qd-vl" scope="rowgroup"><span aria-hidden="true">공<br>급<br>자</span><span class="sr">공급자</span></th><th scope="row">등록번호</th><td colspan="3" class="mono">${qdBiz()}</td></tr>
  <tr><th scope="row">상호</th><td>볼트노트</td><th scope="row">성명</th><td class="qd-sign">${SHOP.ownerName ? esc(SHOP.ownerName) : qdPh('대표 이름')} ${firm ? '<span class="qd-seal" role="img" aria-label="직인 자리">(인)</span>' : '<span class="faint">(서명 없음 · 자동 견적)</span>'}</td></tr>
  ${SHOP.addr ? `<tr><th scope="row">사업장 주소</th><td colspan="3">${esc(SHOP.addr)}</td></tr>` : ''}
  <tr><th scope="row">업태</th><td>${qdPh('도매 및 소매업')}</td><th scope="row">종목</th><td>${qdPh('볼트·너트 등 체결부품')}</td></tr>
  <tr><th scope="row">${rfqOk('fax') ? '전화·팩스' : '전화'}</th><td colspan="3" class="mono">${rfqC('tel')}${rfqOk('fax') ? ' · ' + rfqC('fax') : ''}</td></tr>
  <tr><th scope="row">전자우편</th><td class="mono">${rfqC('rfq')}</td><th scope="row">통신판매업</th><td>${qdPh('제0000-지역-0000호')}</td></tr></tbody></table>`;

/* ── 1. 견적서 (A4 세로) ── */
// 견적서·도면 묶음 품명 칸: "<한국어> / <영문 공식명>" (오너 결정 2 · 언어 전환과 무관하게 늘 둘 다)
function qdName(l) {
  const n = l && l.name; if (!n) return '';
  return n.en ? `<b>${esc(n.ko)}</b><span class="qd-nm-en" lang="en"> / ${esc(n.en)}</span>` : `<b>${esc(n.ko)}</b>`;
}
function qdQuoteHtml(c, unp) {
  const d = c.doc, B = state.bom, r = B.rfq, s = c.sum, t = d.totals, qno = d.quoteNo, firm = d.offerType === 'firm', today = qdIssued(d);
  const cat = c.L.filter(v => !v.ex && v.x.m.status === 'catalog'), eq = c.L.filter(v => !v.ex && v.x.m.status === 'engineer-quote');
  const na = c.L.filter(v => v.ex || v.x.m.status === 'not-available');
  const no = v => `<td class="mono qd-no" data-l="순번 (BOM No)">${esc(bomRef(v.x))}${v.x.row.pn ? `<span class="sub qd-pn">${esc(v.x.row.pn)}</span>` : ''}</td>`;
  const th = v => v.l.drawing?.has ? `<button type="button" class="qd-th" data-dw="${v.i}" aria-expanded="false" aria-controls="qdw-${v.i}" aria-label="BOM No ${esc(bomRef(v.x))} 도면 크게 보기"><span class="qd-th-i" data-qth="${v.i}"></span></button>` : '';
  const dwRow = (v, cols) => v.l.drawing?.has ? `<tr class="qd-dwr" id="qdw-${v.i}" hidden><td colspan="${cols}"></td></tr>` : '';
  const docs = l => l.docPlan ? l.docPlan.plan.filter(p => p.incl).map(p => CD_DOC[p.code]?.short || p.code).join(', ') : '';
  const cols1 = unp ? 11 : 14;
  const catRows = cat.map(v => { const { x, l } = v, m = x.m, q = x.q; return `<tr>${no(v)}<td class="wide" data-l="품명">${qdName(l)}</td><td class="mono" data-l="규격">${esc(qdSpecOf(q))}</td><td data-l="재질·강도">${esc(q.mat?.label || '—')}</td><td data-l="표면처리">${esc(q.fin?.label?.replace(/ · 기본값$/, '') || '—')}</td><td data-l="적용규격">${esc((q.dimStd || '—').replace(/ \(.*$/, ''))}</td><td data-l="원산지(제조사)" class="qd-mk">${esc(String(l.makeText).replace(' (귀사 AVL 안에서 선정)', ' (귀사 AVL 내)'))}</td><td data-l="단위">${esc(bomUnit(m))}</td><td class="r num" data-l="수량">${bomQtyCell(x)}</td>${unp ? `<td data-l="견적">견적함 <span class="en">Quoted</span></td>` : `${m.price == null ? '<td class="r num" data-l="단가">회신 예정</td><td class="r num" data-l="공급가액">—</td><td class="r num" data-l="세액">—</td>' : `<td class="r num" data-l="단가">${won(m.price)}</td><td class="r num" data-l="공급가액"><b>${won(m.amount)}</b></td><td class="r num" data-l="세액">${won(l.vat ?? 0)}</td>`}`}<td data-l="비고" class="qd-rm wide"><span class="mono">${esc(m.pn)}</span><span class="sub">${esc(bomLeadTxt(v))}${m.packPlan?.note ? ' · ' + esc(m.packPlan.note) : ''}</span><span class="sub">서류 ${esc(docs(l))}${l.drawing?.has ? ` · 도면 ${esc(l.drawing.no)}` : ''}${l.cd.length ? ` · C&amp;D ${esc(l.cd.join(', '))}` : ''}</span>${!unp && m.tier ? `<span class="sub qd-tier">${esc(m.tier.text)}</span>` : ''}${bomChecks(x).length ? `<span class="sub">확인 ${bomChecks(x).length}건 · C&amp;D 시트</span>` : ''}${th(v)}</td></tr>${dwRow(v, cols1)}`; }).join('');
  const shipRow = !unp && t.ship ? `<tr class="qd-ship"><td class="mono" data-l="순번">—</td><td data-l="품명" colspan="6">운임 (택배, 과세)</td><td data-l="단위">식</td><td class="r num" data-l="수량">1</td><td class="r num" data-l="단가">${won(t.ship)}</td><td class="r num" data-l="공급가액"><b>${won(t.ship)}</b></td><td class="r num" data-l="세액">${won(t.shipVat || 0)}</td><td data-l="비고">공급가 ${won(FREE_SHIP)} 미만</td></tr>` : '';
  const eqRows = eq.map(v => { const { x, l } = v, m = x.m; return `<tr>${no(v)}<td class="wide" data-l="품명·규격">${qdName(l)}<span class="sub">${esc(m.spec)}</span></td><td class="r num" data-l="수량">${bomQtyCell(x)}</td><td class="wide" data-l="사유">${l.reasons.map(t => `<span class="sub">${esc(t)}</span>`).join('') || '—'}</td>${unp ? '<td data-l="견적">미견적 <span class="en">Not quoted</span></td>' : `<td data-l="참고가">${esc(m.indicative || '참고가 없음')}</td>`}<td data-l="회신 예정일">${l.replyBy ? qdDate(l.replyBy) : '고객과 합의'}</td><td data-l="예상 납기">${esc(m.lead?.text || m.leadText || '—')}${th(v)}</td></tr>${dwRow(v, 7)}`; }).join('');
  const naRows = na.map(v => { const { x, l } = v, m = x.m; return `<tr>${no(v)}<td class="mono wide" data-l="BOM 원문">${x.row.text ? esc(x.row.text) : '(품명 칸 비어 있음)'}</td><td class="r num" data-l="수량">${x.q.qty ? esc(x.q.qty.raw || x.q.qty.n) : '—'}</td><td class="wide" data-l="사유">${v.ex ? '귀사 요청으로 견적에서 뺐습니다.' : esc((m.reasons.find(r => r.tone === 'crit') || m.reasons[0] || {}).text || '')}</td></tr>`; }).join('');
  const sumBand = unp ? `<div class="qd-band"><span class="lab">가격 없는 기술 제출본 Unpriced Technical Copy</span><b>금액은 가격본에만 적습니다</b><span>가격본과 같은 사양·조건 · Identical in scope to the priced offer</span></div>`
    : !(t.sub > 0) ? `<div class="qd-band"><span class="lab">합계금액</span><b>단가 회신 예정</b><span>카탈로그 품목 단가를 공급처와 확인하고 있어 금액 합계를 적지 않았습니다. 줄마다 단가를 회신합니다.</span></div>`
    : `<div class="qd-band"><span class="lab">합계금액 (부가가치세 포함)</span><b class="ko-amt">일금 ${esc(t.words)}정</b><span class="mono">(₩${t.total.toLocaleString('ko-KR')})</span>${s.wordsOk ? '' : '<span class="redp">한글 금액과 숫자가 다릅니다. 발행하지 마십시오.</span>'}</div>`;
  // 대금 지급 조건: 운영자가 정한 문구는 그대로, 아직 정하지 않은 숫자([30] 등)만 형광 자리표시 (b2b #43)
  const ownPay = /^자리표시:/.test(SHOP_TERMS.payment) ? qdPh(SHOP_TERMS.payment.replace(/^자리표시:\s*/, '')) : esc(SHOP_TERMS.payment).replace(/\[(\d+)\]/g, (_, n) => qdPh(`[${n}]`));
  const pay = r.pay ? `${esc(r.pay)} (요구) · 당사 조건 ${ownPay}` : ownPay;
  // 운송조건: 견적함(7장)과 같은 규칙 — 장척물(1 m)이 있거나 카탈로그 품목 총중량이 FREIGHT_KG를 넘으면 택배 무료 조건 대신 화물 운임 별도 (최종 통합)
  const fx = cat.filter(v => !v.ex), fKg = fx.reduce((a, v) => a + (v.x.m.weightKg || 0), 0), fLong = fx.some(v => /^화물 \(장척물/.test(v.x.m.delivery || ''));
  const fLim = typeof FREIGHT_KG !== 'undefined' ? FREIGHT_KG : SHOP_TERMS.heavyKg, freight = fLong || fKg > fLim;
  const ship = freight ? `DAP 지정 장소 · ${fLong ? '장척물(1 m)이 있어' : `총중량 약 ${Math.round(fKg)} kg이라`} 택배 대신 화물로 보내며 운임은 별도로 안내합니다` : `${esc(SHOP_TERMS.incoterm)} · ${esc(SHOP_TERMS.freight)}`;
  const terms = [['납품기한', `카탈로그 품목: ${esc(bomCatShipTxt(s, qdDate))} · 엔지니어 견적: 회신 시 확정${r.due ? ` · 요구 납기 ${esc(r.due)}` : ''}`], ['납품장소', r.place ? esc(r.place) : '귀사 지정 장소'],
    ['대금 지급 조건', pay], ['증빙', `계좌이체: 전자세금계산서 · 카드: 카드 매출전표로 갈음(세금계산서 미발행)${ESCROW_ON ? ' · 개인 계좌이체: 현금영수증' : ''}`], ['유효기간', `${qdDate(d.validUntil)}까지 (견적일로부터 ${SHOP_TERMS.validityDays}일)`], ['운송조건', unp ? `${esc(SHOP_TERMS.incoterm)} · 운임 별도 견적함` : ship], ['검수방법', '입고 검사: 마킹 · 2면폭·길이 · 나사 게이지 · 외관·도금 · 성적서 히트번호 대조']];
  const R = d.statement.counts.rows, nDw = d.lines.filter(l => l.drawing?.has).length;
  const notes = [
    '규격 근거: 줄마다 적용규격 칸의 치수 규격을 따릅니다. 원문에 없는 값은 해당 규격의 표준값으로 채웠고 C&amp;D 시트에 밝혔습니다.',
    '서류: 모든 줄에 볼트노트 적합 확인서(CoC, ISO 16228 F2.1 형식, 시험값 없음)를 드립니다. 제조사 EN 10204 3.1은 제조사가 발행한 것을 고치지 않고 사본으로 전달하며, 볼트노트가 대신 발행하지 않습니다. KOLAS 시험과 3.2 입회 검사는 요청하실 때만 외부 시험소·검사기관을 통해 진행합니다.',
    `원산지·제조사: 발주 후 통보합니다${cdAvl(c.rfq) ? ' (귀사 승인 제조사 목록 안에서 선정)' : ''}. 원산지 증빙은 요청 시 드립니다.`,
    unp ? '가격은 가격본에만 적었습니다. 운임과 옵션 비용(KOLAS 등)도 별도 견적함입니다.' : (t.sub > 0 ? `단가는 부가가치세 별도이며 ${PRICE_LAB()}(공급처 확인 기준일 ${esc(SHOP.priceBasis)})입니다. 단가·출고일은 확인 메일로 확정하며, 수량이 바뀌면 단가를 다시 협의합니다.` : '카탈로그 품목 단가는 공급처 확인 뒤 줄마다 회신합니다. 이 견적서에는 금액을 적지 않았습니다.'),
    `C&amp;D 시트 ${esc(d.header.sheetNo)} Rev ${esc(d.rev)}: 확인 ${R.C || 0} · 편차 ${R.D || 0} · 예외 ${R.E || 0}. 편차(D) 항목은 귀사의 서면 승인 없이 진행하지 않습니다.`,
    eq.length ? `엔지니어 견적 ${eq.length}줄은 줄마다 적은 회신 예정일까지 단가·납기를 회신하고 다음 Rev에 반영합니다.` : '',
    '도면은 표준 치수표 값으로 그린 참고 도면(척도 없음)이며, 납품 검사 기준은 각 규격 원문입니다.',
    firm ? '' : '이 견적서는 자동 견적입니다. 운영자 검토 전이며, 준수 선언과 직인은 정식 견적에만 넣습니다.',
  ].filter(Boolean);
  const att = [`C&amp;D 시트 ${esc(d.header.sheetNo)} Rev ${esc(d.rev)}`, `준수 요약 ${esc(qno)}-CS`, `공급 불가 목록 ${esc(qno)}-NA (${d.notAvailable.lines.length}건)`, `도면 묶음 ${esc(qno)}-D (${nDw}장)`, `사업자등록증 사본 ${qdPh('등록 후 첨부')}`, `사업자 명의 통장 사본 ${qdPh('등록 후 첨부')}`];
  return `<article class="qd-doc qd-pg-quote qd-p" id="qd-quote" aria-labelledby="qd-h">${qdWm(d)}
  <header class="qd-hd"><dl class="qd-meta"><dt>견적번호</dt><dd class="mono">${esc(qno)} Rev ${esc(d.rev)}</dd><dt>견적일자</dt><dd>${today ? qYmd(today) : ''}</dd><dt>구분</dt><dd>${firm ? `정식 견적 · 검토 ${esc(d.header.approvedBy || '')}` : '자동 견적 · 운영자 검토 전'}</dd></dl>
    <h2 id="qd-h" class="qd-title">견 적 서<span>QUOTATION${unp ? ' · UNPRICED' : ''}</span></h2></header>
  <div class="qd-two">
    <div class="qd-to"><dl><dt>수신</dt><dd>${r.client ? `${esc(r.client)} 귀중` : `${qdPh('귀사명')} 귀중`}</dd><dt>참조</dt><dd>${r.attn ? `${esc(r.attn)} 귀하` : `${qdPh('담당자')} 귀하`}</dd><dt>건명</dt><dd>${r.project ? esc(r.project) : `BOM 견적 (${c.L.length}줄)`}</dd>${r.rfqNo ? `<dt>귀사 RFQ</dt><dd class="mono">${esc(r.rfqNo)}${r.rfqRev ? ' Rev ' + esc(r.rfqRev) : ''}</dd>` : ''}<dt>유효기간</dt><dd>${qdDate(d.validUntil)}까지</dd></dl>
      <p class="qd-greet">아래와 같이 견적합니다.</p></div>
    ${qdSupplier(firm)}
  </div>
  ${sumBand}
  <table class="qd-terms"><tbody>${[0, 2, 4].map(i => `<tr><th scope="row">${terms[i][0]}</th><td>${terms[i][1]}</td><th scope="row">${terms[i + 1][0]}</th><td>${terms[i + 1][1]}</td></tr>`).join('')}</tbody></table>
  ${cat.length ? `<section class="qd-sec"><h3>1. 카탈로그 품목 <small>${cat.length}종${unp ? '' : ' · 단가 VAT 별도'}</small></h3><div class="tblw qd-tw"><table class="tbl mstack qd-t qd-t1${unp ? ' unp' : ''}">${unp ? '<colgroup><col class="w6"><col class="w9"><col class="w13"><col class="w12"><col class="w9"><col class="w8"><col class="w8"><col class="w4"><col class="w8"><col class="w7"><col class="w16"></colgroup>' : '<colgroup><col class="w6"><col class="w8"><col class="w11"><col class="w10"><col class="w8"><col class="w7"><col class="w7"><col class="w4"><col class="w7"><col class="w6"><col class="w7"><col class="w6"><col class="w13"></colgroup>'}<thead><tr><th>순번</th><th>품명</th><th>규격</th><th>재질·강도</th><th>표면처리</th><th>적용규격</th><th>원산지(제조사)</th><th>단위</th><th class="r">수량</th>${unp ? '<th>견적</th>' : '<th class="r">단가</th><th class="r">공급가액</th><th class="r">세액</th>'}<th>비고</th></tr></thead><tbody>${catRows}${shipRow}<tr class="qd-end"><td colspan="${cols1}">- 이하 여백 -</td></tr></tbody></table></div></section>` : ''}
  ${eq.length ? `<section class="qd-sec"><h3>2. 회신 예정 <small>엔지니어 견적 ${eq.length}줄 · 합계에 넣지 않음</small></h3><div class="tblw qd-tw"><table class="tbl mstack qd-t"><thead><tr><th>순번</th><th>품명·규격</th><th class="r">수량</th><th>사유</th>${unp ? '<th>견적</th>' : '<th>참고가</th>'}<th>회신 예정일</th><th>예상 납기</th></tr></thead><tbody>${eqRows}</tbody></table></div></section>` : ''}
  ${na.length ? `<section class="qd-sec"><h3>3. 공급하지 않는 품목 <small>${na.length}건</small></h3>${noteSm('crit', `<b>${BOM_NA_HEAD}</b> — ${esc(SHOP_TERMS.notAvail)}`, '불가')}<div class="tblw qd-tw"><table class="tbl mstack qd-t"><thead><tr><th>순번</th><th>BOM 원문</th><th class="r">수량</th><th>사유</th></tr></thead><tbody>${naRows}</tbody></table></div></section>` : ''}
  ${unp ? `<p class="qd-unp">${esc(cdUnpriced(d).footer.ko)} <span class="en">${esc(cdUnpriced(d).footer.en)}</span></p>` : !(t.sub > 0) ? '' : `<table class="qd-money"><tbody><tr><th scope="row">공급가액 합계${t.ship ? ' (운임 포함)' : ''}</th><td class="num">${won(t.supply)}</td></tr><tr><th scope="row">부가가치세 (10%)</th><td class="num">${won(t.vat)}</td></tr><tr class="grand"><th scope="row">합계금액</th><td class="num">${won(t.total)}</td></tr></tbody></table>
  ${PRICE_ANY() && t.reference && t.reference.supplyMax > t.reference.supplyMin ? `<p class="qd-ref">참고 총액 (확정 + 회신 예정 줄 참고가): ${won(t.reference.supplyMin)} ~ ${won(t.reference.supplyMax)} · VAT 별도${t.reference.noRef ? ` · 참고가 없음 ${t.reference.noRef}줄` : ''} · 합계금액과 한글 금액에는 넣지 않았습니다</p>` : ''}`}
  <section class="qd-sec qd-notes"><h3>특기사항</h3><ol>${notes.map(n => `<li><span>${n}</span></li>`).join('')}</ol></section>
  <section class="qd-sec qd-att"><h3>첨부서류</h3><ol>${att.map(a => `<li><span>${a}</span></li>`).join('')}</ol></section>
  <dl class="qd-foot"><dt>입금계좌</dt><dd>${qdPh('은행명 · 계좌번호 · 예금주')}</dd><dt>담당자</dt><dd>${SHOP.ownerName ? esc(SHOP.ownerName) : qdPh('대표 이름')} · ${rfqOk('tel') ? esc(CONTACT.tel) : qdPh('000-0000-0000')}</dd></dl>
  ${qdRevTable(d)}
  <p class="qd-line">볼트노트 · 사업자등록번호 ${qdBiz()}${SHOP.addr ? ' · ' + esc(SHOP.addr) : ''}</p>
</article>`;
}
const qdRevTable = d => `<table class="qd-rev"><caption>개정 이력 Revision History</caption><thead><tr><th>Rev</th><th>날짜 Date</th><th>내용 Description</th><th>작성 By</th><th>검토 Chk'd</th></tr></thead><tbody>${d.revision.history.map(h => `<tr><td class="mono">${esc(h.rev)}</td><td class="mono">${esc(h.date || '')}</td><td>${esc(h.desc || '')}</td><td>${h.by ? esc(h.by) : qdPh('작성자')}</td><td>${h.chk ? esc(h.chk) : '—'}</td></tr>`).join('')}</tbody></table>`;

/* ── 2. C&D 시트 (A4 가로, 4장 형식) ── */
function qdCdHtml(c, unp) {
  const d = c.doc, B = state.bom, H = d.header, part = unp ? 'tech' : B.part, lang = B.lang;
  const rows = d.rows.filter(r => part === 'all' || (part === 'tech' ? !CD_COMM.has(r.cat) : CD_COMM.has(r.cat)));
  const cell = (r, i) => { const o = (unp ? r.cellsTech : r.cells)[i]; return [3, 6, 7].includes(i) ? qdBi(o, lang) : esc(lang === 'en' ? o.en : o.ko); };
  const hb = (ko, en, v, cls = '') => `<div class="${cls}"><span class="lab">${ko} ${en}</span><span class="val">${v}</span></div>`;
  const gcT = part !== 'comm' ? d.gc.technical : [], gcC = part !== 'tech' ? d.gc.commercial : [];
  const gcl = list => list.map(g => `<li><b class="mono">${esc(g.id)}</b> ${g.ph ? qdPh(lang === 'en' ? g.en : g.ko) : qdBi({ ko: g.ko, en: g.en }, lang)}</li>`).join('');
  const stmt = d.statement;
  return `<article class="qd-doc qd-pg-cd qd-l" id="qd-cd" aria-labelledby="qd-cd-h">${qdWm(d)}
  <header class="qd-hd"><h2 id="qd-cd-h" class="qd-title sm">기술 확인·편차 목록<span>Clarification &amp; Deviation Sheet${part === 'tech' ? ' · Technical' : part === 'comm' ? ' · Commercial' : ''}${unp ? ' · Unpriced' : ''}</span></h2></header>
  <div class="tblock qd-cdh" role="group" aria-label="C&amp;D 머리 블록">
    ${hb('문서 번호', 'Sheet No.', `<span class="mono">${esc(H.sheetNo)}</span>`)}${hb('개정', 'Rev.', esc(H.rev))}${hb('발행일', 'Date', esc(H.date))}${hb('견적번호', 'Quotation No.', `<span class="mono">${esc(H.quoteNo)} Rev ${esc(H.rev)}</span>`, 'e')}
    ${hb('프로젝트', 'Project', esc(H.project))}${hb('발주처', 'Client', esc(H.client))}${hb('고객 RFQ', 'Client RFQ No. / Rev.', `${esc(H.rfqNo)} / ${esc(H.rfqRev)}`)}${hb('대상 BOM', 'BOM Ref.', `${esc(H.bomRef.file)} · ${H.bomRef.rows}줄 · <span class="mono">${esc(H.bomRef.hash)}</span>`, 'e')}
    ${hb('제출 구분', 'Submission', `${esc(unp ? '가격 없는 기술본 / Unpriced' : H.submission.priced)} · ${part === 'tech' ? '기술 C&amp;D / Technical' : part === 'comm' ? '상업 C&amp;D / Commercial' : esc(H.submission.split)}`)}${hb('견적 구분', 'Offer Type', `${esc(H.offerType.ko)} ${esc(H.offerType.en)}`)}${hb('적용 사양', 'Applicable Specs', H.applicableSpecs.length ? esc(H.applicableSpecs.join(' · ')) : '—', 's2 e')}
    ${hb('공급자', 'Supplier', `볼트노트 · ${qdBiz()}`)}${hb('작성', 'Prepared by', H.preparedBy ? esc(H.preparedBy) : qdPh('작성자'))}${hb('검토', 'Checked by', H.checkedBy ? esc(H.checkedBy) : '—')}${hb('승인', 'Approved by', H.approvedBy ? esc(H.approvedBy) : '—', 'e')}
    <div class="s4 e lr"><span class="lab">검토 문서 Basis of Offer (Documents Reviewed)</span><span class="val small">${H.basis.map(b => `<span class="nw">${esc(b.doc)}${b.rev && b.rev !== '-' ? ' Rev ' + esc(b.rev) : ''} · ${b.received ? '받음 · 검토함' : '<b class="redp">받지 못함 · 검토 안 함</b>'}</span>`).join(' / ')}</span></div>
  </div>
  <div class="qd-stmt ${stmt.kind}">${qdBi({ ko: stmt.ko, en: stmt.en }, lang)}<p class="qd-stmt-s">${qdBi(stmt.summary, lang)}</p></div>
  ${(d.firmBlocked || []).map(b => noteSm('warn', qdBi(b, lang), '정식')).join('')}
  ${gcT.length || gcC.length ? `<section class="qd-sec qd-gc"><h3>일반 확인 사항 <small>General Clarifications · 모든 줄에 적용</small></h3>${gcT.length ? `<p class="lab">기술 GC-T Technical</p><ol class="qd-gcl">${gcl(gcT)}</ol>` : ''}${gcC.length ? `<p class="lab">상업 GC-C Commercial</p><ol class="qd-gcl">${gcl(gcC)}</ol>` : ''}</section>` : ''}
  <section class="qd-sec"><h3>확인·편차 행 <small>${rows.length}행 · 승인이 필요한 순서 D → E → C</small></h3>
  ${rows.length ? `<div class="tblw qd-tw"><table class="tbl mstack qd-cdt"><thead><tr>${d.cols.map((h, i) => `<th class="c${i}">${lang === 'en' ? esc(h.en) : esc(h.ko)}${lang === 'both' ? `<span class="en">${esc(h.en)}</span>` : ''}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr class="t-${r.type}${r.withdrawn ? ' wd' : ''}">${d.cols.map((h, i) => `<td class="c${i}${i === 0 ? ' mono' : ''}${[2, 3, 6, 7].includes(i) ? ' wide' : ''}" data-l="${esc(h.ko)}">${cell(r, i)}${i === 8 ? '<span class="qd-reply" aria-hidden="true">의견</span>' : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="small muted">이 범위에 해당하는 행이 없습니다.</p>`}</section>
  <table class="qd-signs"><caption>서명 Signatures</caption><thead><tr><th></th><th>이름 Name</th><th>직위 Title</th><th>서명 Signature</th><th>날짜 Date</th></tr></thead><tbody>
    <tr><th scope="row">작성 Prepared</th><td>${H.preparedBy ? esc(H.preparedBy) : qdPh('작성자')}</td><td></td><td></td><td></td></tr>
    <tr><th scope="row">검토 Checked</th><td>${H.checkedBy ? esc(H.checkedBy) : ''}</td><td></td><td></td><td></td></tr>
    <tr><th scope="row">승인 Approved</th><td>${H.approvedBy ? esc(H.approvedBy) : ''}</td><td></td><td>${d.offerType === 'firm' ? '<span class="qd-seal sm" role="img" aria-label="직인 자리">(인)</span>' : ''}</td><td></td></tr>
    <tr><th scope="row">고객 검토 Client Review</th><td></td><td></td><td></td><td></td></tr></tbody></table>
  ${qdRevTable(d)}
  ${unp ? `<p class="qd-unp">${esc(cdUnpriced(d).footer.ko)} <span class="en">${esc(cdUnpriced(d).footer.en)}</span></p>` : ''}
</article>`;
}

/* ── 3. 준수 요약 (A4 세로 1장, 3.11절) ── */
function qdCompHtml(c) {
  const d = c.doc, C = d.compliance, h = C.head;
  const codes = ['C', 'CC', 'D', 'E', 'N'], cats = Object.keys(CD_CAT);
  const tierLab = k => BOM_TIER[k]?.label || k;
  return `<article class="qd-doc qd-pg-comp qd-p" id="qd-comp" aria-labelledby="qd-comp-h">${qdWm(d)}
  <header class="qd-hd"><h2 id="qd-comp-h" class="qd-title sm">준수 요약<span>Compliance Summary</span></h2></header>
  <div class="tblock qd-cdh"><div><span class="lab">프로젝트</span><span class="val">${esc(h.project)}</span></div><div><span class="lab">고객 RFQ / Rev</span><span class="val">${esc(h.rfqNo)} / ${esc(h.rfqRev)}</span></div><div><span class="lab">견적번호 / Rev</span><span class="val mono">${esc(h.quoteNo)} / ${esc(h.rev)}</span></div><div class="e"><span class="lab">날짜</span><span class="val">${esc(h.date)}</span></div></div>
  <section class="qd-sec"><h3>줄 집계 <small>전체 ${C.total}줄 · 합계 대조 ${C.sumOk ? '일치' : '<b class="redp">불일치</b>'}</small></h3>
    <div class="tblw qd-tw"><table class="tbl qd-ct"><thead><tr><th>코드</th><th>뜻</th><th class="r">줄 수</th></tr></thead><tbody>${codes.map(k => `<tr><td class="mono"><b>${k}</b></td><td>${esc(CD_COMP[k].ko)} <span class="en">${esc(CD_COMP[k].en)}</span></td><td class="r mono">${C.counts[k] || 0}</td></tr>`).join('')}<tr class="grand"><td colspan="2">합계 = ${codes.map(k => C.counts[k] || 0).join(' + ')}</td><td class="r mono">${codes.reduce((a, k) => a + (C.counts[k] || 0), 0)}</td></tr></tbody></table></div></section>
  <section class="qd-sec"><h3>분류별 C&amp;D <small>확인 C · 편차 D · 예외 E</small></h3>
    <div class="tblw qd-tw"><table class="tbl qd-ct"><thead><tr><th>분류</th><th class="r">C</th><th class="r">D</th><th class="r">E</th></tr></thead><tbody>${cats.map(k => `<tr><td>${esc(CD_CAT[k].ko)} <span class="en">${esc(CD_CAT[k].en)}</span></td>${['C', 'D', 'E'].map(t => `<td class="r mono">${C.byCat[k][t] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
  <div class="cols c-6-6 qd-cols"><section class="qd-sec"><h3>서류</h3><dl class="kv small"><dt>제조사 3.1 사본 포함</dt><dd>${C.docs.mtc31}줄</dd><dt>CoC(F2.1)만</dt><dd>${C.docs.cocOnly}줄</dd><dt>KOLAS 옵션 (요청 시, 외부 시험소)</dt><dd>${C.docs.kolasOpt}줄</dd><dt>3.2 옵션 (요청 시, 검사기관)</dt><dd>${C.docs.mtc32Opt}줄</dd></dl></section>
  <section class="qd-sec"><h3>납기</h3><dl class="kv small"><dt>카탈로그 품목 출고</dt><dd>${esc(bomLatestTxt(d))}</dd>${Object.entries(C.lead.tiers).map(([k, n]) => `<dt>${esc(tierLab(k))}</dt><dd>${n}줄</dd>`).join('')}${C.lead.eqReply ? `<dt>엔지니어 견적 회신</dt><dd>${esc(qdDate(C.lead.eqReply) || String(C.lead.eqReply))}</dd>` : ''}</dl></section></div>
  <div class="qd-stmt ${C.statement.kind}">${qdBi({ ko: C.statement.ko, en: C.statement.en })}<p class="qd-stmt-s">${qdBi(C.statement.summary)}</p></div>
  <table class="qd-signs"><tbody><tr><th scope="row">작성·서명</th><td>${qdPh('작성자')}</td><th scope="row">날짜</th><td>${esc(h.date)}</td></tr></tbody></table>
  <p class="qd-codes"><span class="lab">줄별 준수 코드</span> ${esc(C.listText)}</p>
</article>`;
}

/* ── 4. 공급 불가 목록 (A4 세로, 3.10절) ── */
function qdNaHtml(c) {
  const d = c.doc, N = d.notAvailable;
  return `<article class="qd-doc qd-pg-na qd-p" id="qd-na" aria-labelledby="qd-na-h">${qdWm(d)}
  <header class="qd-hd"><dl class="qd-meta"><dt>문서 번호</dt><dd class="mono">${esc(d.quoteNo)}-NA Rev ${esc(d.rev)}</dd><dt>날짜</dt><dd>${esc(d.header.date)}</dd></dl><h2 id="qd-na-h" class="qd-title sm">공급 불가 목록<span>Items Not Supplied</span></h2></header>
  ${note('crit', `<b>${BOM_NA_HEAD}</b><br>${esc(N.intro.ko)} <span class="en">${esc(N.intro.en)}</span>`, '불가')}
  ${N.lines.length ? `<div class="tblw qd-tw"><table class="tbl mstack qd-t"><thead><tr><th>BOM No</th><th>고객 품번</th><th>BOM 원문 · 수량</th><th>사유</th><th>다른 공급처 안내</th></tr></thead><tbody>${N.lines.map(l => `<tr><td class="mono" data-l="BOM No">${esc(l.ref)}</td><td class="mono" data-l="고객 품번">${esc(l.pn || '—')}</td><td class="wide" data-l="BOM 원문 · 수량"><span class="mono">${esc(l.raw || '(비어 있음)')}</span><span class="sub">수량 ${esc(l.qtyRaw || '—')}</span></td><td class="wide" data-l="사유">${esc(l.reason)}</td><td class="wide" data-l="다른 공급처 안내">${esc(l.elsewhere.ko)}<span class="en">${esc(l.elsewhere.en)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">공급하지 않는 줄이 없습니다.</p>'}
  <p class="qd-out">${esc(N.outro.ko)} <span class="en">${esc(N.outro.en)}</span></p>
</article>`;
}

/* ── 5. 도면 묶음 (A4 가로, 표지 + 1장 1도면) ── */
function qdDwgHtml(c) {
  const d = c.doc, list = c.L.filter(v => v.l.drawing?.has);
  const unitOf = q => q.system === 'inch' ? 'in [mm]' : 'mm';
  return `<article class="qd-doc qd-pg-dwg qd-l" id="qd-dwg" aria-labelledby="qd-dwg-h">${qdWm(d)}
  <header class="qd-hd"><dl class="qd-meta"><dt>견적번호</dt><dd class="mono">${esc(d.quoteNo)} Rev ${esc(d.rev)}</dd><dt>도면 수</dt><dd>${list.length}장</dd></dl><h2 id="qd-dwg-h" class="qd-title sm">도면 묶음<span>Drawing Pack</span></h2></header>
  ${noteSm('info', '표준 치수표 값으로 직접 그린 참고 도면입니다 (척도 없음, NTS). 납품 검사 기준은 각 규격 원문입니다. 다른 곳의 도면을 옮겨 그리지 않았습니다. 비표준 줄은 승인용이며, 제작을 맡을 제조사가 치수·공차를 확인한 뒤 정식 견적에 붙입니다.', '도면')}
  ${list.length ? `<div class="tblw qd-tw"><table class="tbl mstack qd-t"><thead><tr><th>도면 번호</th><th>BOM No</th><th>품명</th><th>규격</th><th>승인 필요</th></tr></thead><tbody>${list.map(v => `<tr><td class="mono" data-l="도면 번호">${esc(v.l.drawing.no)}</td><td class="mono" data-l="BOM No">${esc(bomRef(v.x))}</td><td data-l="품명">${qdName(v.l)}</td><td class="mono" data-l="규격">${esc(qdSpecOf(v.x.q))}</td><td data-l="승인 필요">${v.l.drawing.forApproval ? '<b>승인용</b>' : '참고'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">도면을 만들 줄이 없습니다.</p>'}
  ${list.map(v => { const { x, l } = v, q = x.q, D = l.drawing, rs = v.rows.filter(r => r.type === 'D').map(r => r.no); return `<section class="qd-dsheet" aria-label="도면 ${esc(D.no)}">
    <div class="dbox qd-dw">${drawingFor(x) || ''}</div>
    <div class="qd-dtb">${[['도면 번호', `<span class="mono">${esc(D.no)}</span>`], ['Rev', esc(d.rev)], ['BOM No', esc(bomRef(x))], ['고객 품번', esc(x.row.pn || '—')], ['품명', esc(bomKoEn(l.name?.ko || q.typeLabel, l.name?.en))], ['치수 규격', esc((q.dimStd || '—').replace(/ \(.*$/, ''))], ['나사', `<span class="mono">${esc(threadTxt(q) || '—')}</span>`], ['재질', esc(q.mat?.label || '—')], ['표면처리', esc(q.fin?.label?.replace(/ · 기본값$/, '') || '—')], ['단위 · 척도', `${unitOf(q)} · NTS`]].map(([k, val]) => `<div><span class="lab">${k}</span><b>${val}</b></div>`).join('')}
      <div class="w"><span class="lab">비고</span><b>참고 도면 — 검사 기준은 규격 원문${D.subjectToMfr ? ' · <span class="redp">제조사 확인 전 / Subject to manufacturer confirmation</span>' : ''}</b></div>
      ${D.forApproval ? `<div class="w appr"><span class="lab">승인용 For Approval${rs.length ? ` · ${esc(rs.join(', '))}` : ''}</span><b>고객 서명 ________ 날짜 ________</b></div>` : ''}</div>
  </section>`; }).join('')}
</article>`;
}

/* ── 6. 개정 비교 (화면) ── */
function qdDiffPair(c) {
  const revs = c.revs || [];
  if (c.issued) return revs.length >= 2 ? { a: revs[revs.length - 2], b: revs[revs.length - 1], lab: `Rev ${revs[revs.length - 2].rev} → Rev ${revs[revs.length - 1].rev} (발행본끼리)` } : null;
  return revs.length ? { a: revs[revs.length - 1], b: cdSnapshot(c.doc), lab: `Rev ${revs[revs.length - 1].rev} (발행본) → Rev ${c.doc.rev} (작성 중)` } : null;
}
function qdDiffHtml(c, unp) {
  const P = qdDiffPair(c);
  if (!P) return `<article class="qd-doc qd-pg-diff qd-p" id="qd-diff" aria-labelledby="qd-diff-h"><header class="qd-hd"><h2 id="qd-diff-h" class="qd-title sm">개정 비교<span>Revision Diff</span></h2></header>${noteSm('info', `비교할 발행본이 없습니다. 4A장 D 구역에서 Rev ${esc(c.doc.rev)}를 발행한 뒤 BOM을 고치면, 바뀐 줄·수량·단가·C&amp;D 상태가 여기에 나옵니다.`, '개정')}</article>`;
  const D = cdQuoteDiff(P.a, P.b), S = D.summary, FL = { qty: '수량', unit: '단위', unitPrice: '단가', amount: '금액', status: '상태', compliance: '준수 코드', ourPn: '당사 품번', raw: '원문', spec: '사양' };
  const fmt = (f, v) => v == null || v === '' ? '—' : (f === 'unitPrice' || f === 'amount') ? won(v) : f === 'status' ? (BOM_ST[v]?.[0] || v) : String(v);
  const byKey = (snap, k) => (snap.lines || []).find(l => l.lineKey === k);
  const ch = D.changed.map(x => { const f = Object.entries(x.fields).filter(([k]) => !unp || !['unitPrice', 'amount'].includes(k)); return f.length ? `<tr><td class="mono" data-l="BOM No">${esc(x.ref)}</td><td data-l="대응">${{ same: '같은 줄', changed: '변경', renumbered: '번호만 바뀜' }[x.kind] || esc(x.kind)}</td><td class="wide" data-l="바뀐 칸">${f.map(([k, [a, b]]) => `<span class="nw">${FL[k] || esc(k)} <s>${esc(fmt(k, a))}</s> → <b>${esc(fmt(k, b))}</b></span>`).join('<br>')}</td></tr>` : ''; }).join('');
  const pct = D.totalDelta.pct;
  return `<article class="qd-doc qd-pg-diff qd-p" id="qd-diff" aria-labelledby="qd-diff-h">
  <header class="qd-hd"><h2 id="qd-diff-h" class="qd-title sm">개정 비교<span>${esc(P.lab)}</span></h2></header>
  <div class="tblock qd-cdh"><div><span class="lab">추가 · 삭제</span><span class="val">${S.added} · ${S.removed}</span></div><div><span class="lab">수량 · 사양 변경</span><span class="val">${S.qty} · ${S.spec}</span></div><div><span class="lab">${unp ? '상태 변경' : '단가 · 상태 변경'}</span><span class="val">${unp ? S.status : `${S.price} · ${S.status}`}</span></div><div class="e"><span class="lab">${unp ? 'C&amp;D 새 행' : '합계 변화 (VAT 포함)'}</span><span class="val mono">${unp ? D.cd.added.length : `${D.totalDelta.total >= 0 ? '+' : '−'}${won(Math.abs(D.totalDelta.total))}${pct != null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}`}</span></div></div>
  ${unp ? '' : `<p class="small muted">단가 유지 ${D.priceHeld}줄 · 다시 계산 ${D.repriced}줄. 이전 Rev 유효기간 안이고 사양·수량 구간이 같으면 단가를 유지하는 것이 원칙입니다.</p>`}
  <section class="qd-sec"><h3>바뀐 줄 <small>바뀐 칸만</small></h3>${ch ? `<div class="tblw qd-tw"><table class="tbl mstack qd-t"><thead><tr><th>BOM No</th><th>대응</th><th>이전 → 새 값</th></tr></thead><tbody>${ch}</tbody></table></div>` : '<p class="small muted">바뀐 줄이 없습니다.</p>'}</section>
  ${D.added.length || D.removed.length ? `<section class="qd-sec"><h3>추가·삭제한 줄</h3><ul class="qd-dl">${D.added.map(k => { const l = byKey(P.b, k); return `<li><b>추가</b> BOM No ${esc(l?.ref || '')} <span class="mono">${esc(l?.raw || k)}</span></li>`; }).join('')}${D.removed.map(k => { const l = byKey(P.a, k); return `<li><b class="redp">삭제</b> BOM No ${esc(l?.ref || '')} <s class="mono">${esc(l?.raw || k)}</s></li>`; }).join('')}</ul></section>` : ''}
  <section class="qd-sec"><h3>C&amp;D 변화</h3><ul class="qd-dl">${D.cd.added.length ? `<li><b>새 행</b> ${esc(D.cd.added.join(', '))}</li>` : ''}${D.cd.status.map(x => `<li><b class="mono">${esc(x.no)}</b> ${esc(CD_STATUS[x.from]?.ko || x.from)} → <b>${esc(CD_STATUS[x.to]?.ko || x.to)}</b></li>`).join('')}${D.cd.withdrawn.length ? `<li><b>철회</b> <s>${esc(D.cd.withdrawn.join(', '))}</s> (번호 유지)</li>` : ''}${!D.cd.added.length && !D.cd.status.length && !D.cd.withdrawn.length ? '<li>C&amp;D 행 변화 없음</li>' : ''}</ul></section>
</article>`;
}

/* ── 화면 ── */
function qdDocHtml(c, k = state.bom.doc) {
  const unp = state.bom.unpriced;
  if (k === 'cd') return qdCdHtml(c, unp);
  if (k === 'comp') return qdCompHtml(c);
  if (k === 'na') return qdNaHtml(c);
  if (k === 'dwg') return qdDwgHtml(c);
  if (k === 'diff') return qdDiffHtml(c, unp);
  return qdQuoteHtml(c, unp);
}
function qdBarHtml(c) {
  const B = state.bom, k = B.doc, nDw = c.L.filter(v => !v.ex && v.x.m.status !== 'not-available' && v.l.drawing?.has).length;
  return `<div class="qd-bar" role="toolbar" aria-label="문서 작업">
  <div class="qd-opt"><a class="btn sm" href="#bom" data-go="bom"><span class="ar">←</span> BOM 고치기</a>
    <label class="choice qd-ch"><input type="checkbox" id="qd-unp"${B.unpriced ? ' checked' : ''}>가격 없는 기술본</label>
    ${k === 'cd' ? `<span class="qd-sel"><label for="qd-part">범위</label><select id="qd-part" class="inp"${B.unpriced ? ' disabled' : ''}>${bomOpts([['all', '기술 + 상업'], ['tech', '기술 C&D만'], ['comm', '상업 C&D만']], B.unpriced ? 'tech' : B.part)}</select></span><span class="qd-sel"><label for="qd-lang">언어</label><select id="qd-lang" class="inp">${bomOpts([['both', '한국어 + English'], ['ko', '한국어'], ['en', 'English']], B.lang)}</select></span>` : ''}</div>
  <div class="qd-acts">${c.doc.offerType !== 'firm' ? '<button class="btn sm pri" type="button" data-q="send" aria-controls="qd-send">정식 견적 요청 보내기</button>' : ''}${QD_CANPRINT ? `<button class="btn sm pri" type="button" data-q="print">이 문서 인쇄</button><button class="btn sm" type="button" data-q="printall">묶음 전체 인쇄</button>` : '<span class="small muted qd-noprint">인쇄는 공개 사이트에서 됩니다. 여기서는 엑셀·JSON으로 내려받으세요.</span>'}
    <button class="btn sm" type="button" data-x="xlsx">엑셀 5시트</button><button class="btn sm" type="button" data-x="json">JSON</button><button class="btn sm" type="button" data-x="csv">CSV</button>${c.doc.offerType === 'firm' ? '<button class="btn sm" type="button" data-x="mail">메일 텍스트 복사</button>' : ''}
    <button class="btn sm" type="button" data-q="tsv">엑셀용 복사 (TSV)</button>${c.doc.notAvailable.lines.length ? '<button class="btn sm" type="button" data-q="na">공급 불가 목록 복사</button>' : ''}${k === 'quote' && nDw ? `<button class="btn sm" type="button" data-q="dwall" aria-pressed="false">도면 ${nDw}장 모두 펼치기</button>` : ''}<button class="btn sm" type="button" data-q="cart">견적함에 담기</button></div>
  <span class="small muted" id="qd-msg" role="status" aria-live="polite"></span>
</div>
<textarea id="qd-copy" class="qd-copy" readonly hidden aria-label="복사할 내용"></textarea>`;
}
const qdTabsHtml = (c) => `<div class="qd-tabs" role="tablist" aria-label="문서">${QD_DOCS.map(([k, l, p], i) => { const on = state.bom.doc === k, n = k === 'na' ? c.doc.notAvailable.lines.length : k === 'dwg' ? c.doc.lines.filter(x => x.drawing?.has).length : k === 'cd' ? c.doc.rows.filter(r => !r.withdrawn).length : null;
  return `<button type="button" role="tab" id="qt-${k}" aria-selected="${on}" aria-controls="qd-doc-w" tabindex="${on ? 0 : -1}" data-doc="${k}"><span class="qd-tn mono">4A-1.${i + 1}</span><b>${l}${n != null ? ` <span class="num">${n}</span>` : ''}</b><span class="xs faint">${p}</span></button>`; }).join('')}</div>`;
V.quote = () => {
  const c = bomCompute(), d = c.doc;
  const head = shd({ trail: [['BOM 견적', 'bom'], ['견적서·C&D 문서']], no: SHEETS.quote[0], title: '견적서·C&amp;D 문서',
    p: '4A장에서 고른 내용으로 같은 Rev의 문서 여섯 가지를 만듭니다. 인쇄하면 견적서·요약·공급 불가 목록은 A4 세로, C&amp;D 시트·도면 묶음은 A4 가로로 나갑니다.',
    right: c.L.length ? `<div class="tblock qd-mini" role="group" aria-label="견적 정보"><div><span class="lab">견적번호</span><b class="mono">${esc(d.quoteNo)}</b></div><div><span class="lab">Rev</span><b>${esc(d.rev)}${c.issued ? '' : ' 작성 중'}</b></div><div class="e"><span class="lab">구분</span><b>${esc(d.header.offerType.ko)}</b></div></div>` : '' });
  if (!c.L.length) return sheet(zone('A', 'z-a', head + `<div class="empty"><h2>견적서에 넣을 BOM이 없습니다</h2><p class="muted">BOM을 붙여 넣으면 견적서·C&amp;D 시트가 바로 만들어집니다.</p><a class="btn pri" href="#bom" data-go="bom">BOM 붙여넣기 <span class="ar">→</span> 4A장</a></div>`));
  return sheet(zone('A', 'z-a', head + qdBarHtml(c) + qdTabsHtml(c) + `<div class="qd-doc-w" id="qd-doc-w" role="tabpanel" aria-labelledby="qt-${state.bom.doc}" data-doc="${state.bom.doc}">${qdPageCss(d)}${qdDocHtml(c)}</div><div class="qd-send" id="qd-send" hidden></div>`));
};
function qdThumbs(c) {
  const els = document.querySelectorAll('#qd-doc-w [data-qth]'), fill = el => { if (el.dataset.done) return; el.dataset.done = 1; el.innerHTML = drawingFor(c.items[+el.dataset.qth], { thumb: true }) || ''; };
  if (!('IntersectionObserver' in window)) { els.forEach(fill); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fill(e.target); io.unobserve(e.target); } }), { rootMargin: '300px 0px' });
  els.forEach(el => io.observe(el));
}
V.after.quote = () => {
  const $ = id => document.getElementById(id), B = state.bom;
  if (!bomCompute().L.length) return;
  const paint = (all = false) => {
    const c = bomCompute(), w = $('qd-doc-w');
    if (!w) return;
    const bar = document.querySelector('.qd-bar'); if (bar) { const nb = document.createElement('div'); nb.innerHTML = qdBarHtml(c); bar.replaceWith(nb.firstElementChild); $('qd-copy')?.remove(); document.querySelector('.qd-bar').insertAdjacentHTML('afterend', '<textarea id="qd-copy" class="qd-copy" readonly hidden aria-label="복사할 내용"></textarea>'); }
    document.querySelector('.qd-tabs').outerHTML = qdTabsHtml(c);
    w.dataset.doc = all ? 'all' : B.doc; w.setAttribute('aria-labelledby', 'qt-' + B.doc);
    w.innerHTML = qdPageCss(c.doc) + (all ? QD_DOCS.filter(([k]) => k !== 'diff').map(([k]) => qdDocHtml(c, k)).join('') : qdDocHtml(c));
    // 보낼 방법 칸이 열려 있으면 같은 Rev로 다시 그린다 (정식 견적이 되면 닫는다: 그때는 운영자가 고객에게 보낸다)
    const sw = $('qd-send'); if (sw && !sw.hidden) { if (c.doc.offerType === 'firm') { sw.hidden = true; sw.innerHTML = ''; } else sw.innerHTML = rfqSheetHTML(bomRfqPkg(c)); }
    qdThumbs(c);
  };
  const msg = t => { const m = $('qd-msg'); if (m) m.textContent = t; };
  const openDw = (t, open) => {
    const i = +t.dataset.dw, row = $('qdw-' + i); if (!row) return;
    t.setAttribute('aria-expanded', String(open)); row.hidden = !open;
    if (open && !row.firstElementChild.innerHTML) row.firstElementChild.innerHTML = `<div class="qd-big">${drawingFor(bomCompute().items[i]) || ''}</div>`;
  };
  view().addEventListener('change', e => {
    if (e.target.id === 'qd-unp') { B.unpriced = e.target.checked; bomSave(); paint(); $('qd-unp')?.focus(); }
    if (e.target.id === 'qd-part') { B.part = e.target.value; bomSave(); paint(); $('qd-part')?.focus(); }
    if (e.target.id === 'qd-lang') { B.lang = e.target.value; bomSave(); paint(); $('qd-lang')?.focus(); }
  });
  view().addEventListener('keydown', e => {
    const t = e.target.closest('.qd-tabs [role="tab"]'); if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault(); const ks = QD_DOCS.map(d => d[0]), i = ks.indexOf(t.dataset.doc);
    B.doc = ks[e.key === 'Home' ? 0 : e.key === 'End' ? ks.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : ks.length - 1)) % ks.length]; bomSave(); paint(); $('qt-' + B.doc)?.focus();
  });
  view().addEventListener('click', e => {
    const tab = e.target.closest('[data-doc]');
    if (tab && tab.closest('.qd-tabs')) { B.doc = tab.dataset.doc; bomSave(); paint(); $('qt-' + B.doc)?.focus(); return; }
    const t = e.target.closest('[data-dw]');
    if (t) { openDw(t, t.getAttribute('aria-expanded') !== 'true'); return; }
    if (e.target.closest('[data-x]')) { bomExport(e.target.closest('[data-x]').dataset.x, $('qd-msg'), $('qd-copy')); return; }
    const b = e.target.closest('[data-q]'); if (!b) return;
    const c = bomCompute(), q = b.dataset.q;
    if (q === 'cart') bomToCart(b);
    if (q === 'send') { const sw = $('qd-send'); if (!sw) return; sw.hidden = false; sw.innerHTML = rfqSheetHTML(bomRfqPkg(c)); rfqShow(sw); return; }
    if (q === 'print' && QD_CANPRINT) { try { window.print(); } catch {} }
    if (q === 'printall' && QD_CANPRINT) { paint(true); const back = () => paint(); window.addEventListener('afterprint', back, { once: true }); try { window.print(); } catch { back(); } }
    if (q === 'dwall') {
      const on = b.getAttribute('aria-pressed') !== 'true';
      view().querySelectorAll('[data-dw]').forEach(x => openDw(x, on));
      b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '도면 모두 접기' : `도면 ${view().querySelectorAll('[data-dw]').length}장 모두 펼치기`;
    }
    if (q === 'tsv') bomCopy(bomTsv(c), msg && $('qd-msg'), $('qd-copy'), `${c.L.length}줄과 거래 조건을 복사했습니다. 엑셀에 붙여 넣으세요.`);
    if (q === 'na') { const m = c.doc.notAvailable.mail; bomCopy(`${m.subject}\n\n${m.body}`, $('qd-msg'), $('qd-copy'), `공급 불가 ${c.doc.notAvailable.lines.length}건을 복사했습니다.`); }
  });
  qdThumbs(bomCompute());
};
