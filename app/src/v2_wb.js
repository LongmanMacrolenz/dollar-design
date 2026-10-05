/* ── 4A장 BOM 견적 워크벤치 (#bom) ──
   A 입력 (S0 RFQ 머리 · S1 붙여넣기·파일 · S2 열 인식) · B 줄 검토 (요약 표제란 · 예외 큐 · 목록 · 상세) · C 공급하지 않는 줄 · D 발행·내보내기 */
SHEETS.quote = ['4A-1', '견적서·C&D 문서'];
// 플랜트 BOM 예시 (구역 제목 줄 · 편차 · 충돌 · 수량 확인 · 공급 불가가 섞인 20줄)
const BOM_SAMPLE2 = ['ITEM\tPART NO.\tDESCRIPTION\tQTY\tUOM',
  '\t\tPUMP P-101A (API 610 S-6)\t\t',
  '1\tP-101-01\tSTUD 3/4-10 X 4-3/4 B7/2H\t32\tSET',
  '2\tP-101-02\tHEX NUT A194 GR 4 1-1/8-8UN\t16\tEA',
  '3\tP-101-03\tSTUD B7 3/4-10 X 5 W/2 NUTS HDG\t24\tSET',
  '4\tP-101-04\tHEX BOLT DIN 933 M12X40 8.8 ZP\t50\tEA',
  '5\tP-101-05\tHEX BOLT DIN 933 M12X50 8.8 ZP\t30\tEA',
  '6\tP-101-06\tSHCS M10x30 12.9\t200\tEA',
  '7\tP-101-07\tGASKET SPW 4" CL300 316/GRAPHITE\t2\tEA',
  '\t\tSKID S-201 STRUCTURE\t\t',
  '8\tS-201-01\tHEX BOLT A325 7/8-9 X 3 HDG\t60\tEA',
  '9\tS-201-02\tHEX BOLT A490 1-8 X 4 HDG\t20\tEA',
  '10\tS-201-03\tFW 7/8 F436 THRU HARD\t120\tEA',
  '11\tS-201-04\tHEX NUT M16 HDG\t50\tEA',
  '12\tS-201-05\tHEX BOLT M16X60 8.8 HDG\t50\tEA',
  '13\tS-201-06\tANCHOR BOLT F1554 GR55 1-1/4 X 30 HDG\t8\tEA',
  '14\tS-201-07\t육각너트 1종 M10\t100\tEA',
  '15\tS-201-08\t렌치볼트 M8x25 12.9 흑색\t1 BOX (100)\tEA',
  '16\tS-201-09\tSET SCREW M6x8 컵포인트 45H\t100\tEA',
  '17\tS-201-10\tSTUD A193 B8M CL2 1-8 X 6\t10\tEA',
  '18\tS-201-11\tO-RING AS568-214 VITON\t10\tEA',
  '19\tS-201-12\tTHREADED ROD M16 X 3M HDG\t5\tEA',
  '20\tS-201-13\tWASHER M10 ZP\t0\tEA'].join('\n');
const WB = { cur: null, last: null, g: 0, io: null };          // 초점 줄 · 범위 선택 기준 · G 다음 Q · 도면 지연 관찰자
const wbIsReview = () => state.bom.filter === 'review';
const wbT = (k, l, i = '') => `<span class="wb-k">${k}</span>${l}${i}`;

/* ── A 구역: 입력 ── */
function wbRfqSum(r) {
  const a = [r.project, r.client && `${r.client} 귀중`, r.rfqNo && `RFQ ${r.rfqNo}${r.rfqRev ? ' Rev ' + r.rfqRev : ''}`, r.api610 && `API 610 ${r.api610}`, r.nace, r.mdmt && `MDMT ${r.mdmt} °C`, r.flange, r.docs?.length && `서류 ${r.docs.join('·')}`, r.offer === 'firm' && '정식 견적 요청'].filter(Boolean);
  return a.length ? esc(a.join(' · ')) : '비어 있음 · 채우면 견적서 수신·건명과 C&D 문맥에 쓰입니다';
}
function wbRfqHtml() {
  const r = state.bom.rfq, v = k => esc(r[k] ?? ''), sel = (k, opts) => opts.map(([val, l]) => `<option value="${val}"${(r[k] || '') === val ? ' selected' : ''}>${l}</option>`).join('');
  const fc = (cls, id, lab, inner, hint = '') => `<div class="fc ${cls}"><label class="flab" for="${id}">${lab}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const inp = (k, ph = '', type = 'text') => `<input class="inp" id="rf-${k}" name="${k}" type="${type}" value="${v(k)}"${ph ? ` placeholder="${esc(ph)}"` : ''}>`;
  return `<details class="acc first wb-rfq"${Object.keys(r).some(k => r[k] && k !== 'review' && (!Array.isArray(r[k]) || r[k].length)) ? ' open' : ''}>
  <summary><span class="wb-rfq-t"><span class="wb-rfq-h"><span class="wb-s">S0</span>RFQ 머리 정보 <small class="faint">선택</small></span><span class="sub" id="wb-rfq-s">${wbRfqSum(r)}</span></span></summary>
  <form class="wb-rfq-f" id="wb-rfq-f" autocomplete="off">
    <fieldset class="tbf"><legend><span class="zl">1</span>수신·건명 <small>견적서 머리에 그대로 찍힙니다</small></legend>
      ${fc('w2', 'rf-project', '건명 (프로젝트)', inp('project', '예: P-101A/B 펌프 교체용 볼트·너트'))}
      ${fc('w2 e', 'rf-client', '수신 (회사·기관)', inp('client', '예: ○○정유 구매팀'))}
      ${fc('w2', 'rf-attn', '참조 (담당자)', inp('attn', '예: 설비팀 김○○ 과장'))}
      ${fc('', 'rf-rfqNo', '귀사 RFQ 번호', inp('rfqNo', 'RFQ-25-0912'))}
      ${fc('e', 'rf-rfqRev', 'RFQ Rev', inp('rfqRev', '1'))}
      ${fc('', 'rf-due', '요구 납기', inp('due', '', 'date'))}
      ${fc('w2', 'rf-place', '납품 장소', inp('place', '예: 울산 ○○공장 자재창고'))}
      ${fc('e lr', 'rf-pay', '대금 지급 조건 (요구)', inp('pay', '예: 납품·검수 후 30일'))}
    </fieldset>
    <fieldset class="tbf"><legend><span class="zl">2</span>적용 사양 <small>줄마다 규칙 판정에 씁니다. 줄 원문이 우선합니다</small></legend>
      ${fc('w2', 'rf-api610', 'API 610 재질 클래스·판', inp('api610', '예: 12th S-6'), '클래스로 볼팅 재질을 정하지 않습니다. 펌프 데이터시트·PO의 볼팅 재질을 엔지니어가 확인해 회신합니다')}
      ${fc('', 'rf-nace', 'NACE', `<select class="inp" id="rf-nace" name="nace">${sel('nace', [['', '해당 없음'], ['MR0175', 'MR0175 / ISO 15156'], ['MR0103', 'MR0103 / ISO 17945']])}</select>`)}
      ${fc('e', 'rf-exposure', '사워 노출 판정', `<select class="inp" id="rf-exposure" name="exposure">${sel('exposure', [['', '미정'], ['exposed', '노출'], ['non-exposed', '비노출']])}</select>`)}
      ${fc('', 'rf-mdmt', 'MDMT (°C)', inp('mdmt', '예: -29', 'number'))}
      ${fc('', 'rf-flange', '플랜지 규격·등급', inp('flange', '예: B16.5 CL300'))}
      <div class="fc w2 e"><span class="flab" id="rf-docs-l">서류 요구</span><div class="choices" role="group" aria-labelledby="rf-docs-l">${BOM_DOCS.filter(([k]) => k !== 'PMI' || PMI_ON || (r.docs || []).includes('PMI')).map(([k, l]) => `<label class="choice"><input type="checkbox" name="docs" value="${k}"${(r.docs || []).includes(k) ? ' checked' : ''}>${l}</label>`).join('')}</div><span class="hint">요구가 없으면 볼트노트 CoC(ISO 16228 F2.1 형식)만 기본으로 드립니다</span></div>
      ${fc('w4 e', 'rf-basis', '검토 문서 (Basis of Offer)', `<textarea class="inp" id="rf-basis" name="basis" rows="3" placeholder="한 줄에 한 문서. 예:&#10;SPEC-BLT-001 Rev 2 받음&#10;SPEC-PNT-003 못 받음">${v('basis')}</textarea>`, '받지 못한 문서는 C&amp;D에 예외(E)로 적고 준수 선언에서 뺍니다')}
      ${fc('w4 e lr', 'rf-text', 'RFQ 본문 (선택)', `<textarea class="inp" id="rf-text" name="text" rows="2" placeholder="메일·RFQ 본문을 붙여 넣으면 NACE·MDMT·서류 요구·참조 문서를 읽습니다">${v('text')}</textarea>`)}
    </fieldset>
    <fieldset class="tbf"><legend><span class="zl">3</span>견적 구분</legend>
      <div class="fc w4 e lr"><div class="choices" role="radiogroup" aria-label="견적 구분">
        <label class="choice"><input type="radio" name="offer" value="indicative"${r.offer !== 'firm' ? ' checked' : ''}>자동 견적 <span class="faint">이 화면에서 만듦, 운영자 검토 전</span></label>
        <label class="choice"><input type="radio" name="offer" value="firm"${r.offer === 'firm' ? ' checked' : ''}>정식 견적 요청 <span class="faint">운영자가 C&amp;D를 검토하고 서명한 뒤 발행</span></label></div>
        <span class="hint">EPC·입찰 제출에는 정식 견적을 쓰세요. 자동 견적에는 직인 자리와 준수 선언문이 없고 '자동 견적 · 운영자 검토 전' 표시가 찍힙니다.</span></div>
    </fieldset>
  </form>
</details>`;
}
function bomMapHtml(p) {
  if (!p || p.mode === 'text' || p.mode === 'empty') return p && p.mode === 'text' ? `<p class="wb-map-t"><span class="wb-s">S2</span>한 줄씩 적은 글로 읽었습니다. 줄 끝에 수량을 <span class="mono">200EA</span>처럼 적거나, 엑셀에서 표를 복사해 붙이면 열을 자동으로 나눕니다.</p>` : '';
  const lab = k => (BOM_ROLES.find(r => r[0] === k) || ['', k])[1], col = i => i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(39 + i);
  const sum = p.roles.map((r, i) => r ? `<span class="nw">${col(i)}→${lab(r)}</span>` : '').filter(Boolean).join(' · ');
  const noDesc = !p.roles.some(r => ['desc', 'type', 'size', 'pn'].includes(r));
  return `<details class="wb-map"${p.header && !state.bom.map && !noDesc ? '' : ' open'}><summary><span class="wb-s">S2</span><b>열 인식</b> <span class="small muted">${p.header ? '머리글로 자동 인식' : '내용으로 추정'}${p.delim === ';' ? ' (세미콜론 구분)' : p.delim === ',' ? ' (쉼표 구분)' : ''}: ${sum || '없음'}</span> <span class="wb-chg">바꾸기</span></summary>
    ${noDesc ? note('warn', '품명·사양 열을 찾지 못했습니다. 아래에서 품명·사양(여러 열 가능)이나 품목·호칭·길이 열을 골라 주세요.') : ''}
    <div class="wb-map-g">${p.cols.map((h, i) => `<div class="field"><label for="bmap-${i}"><span class="mono">${col(i)}</span> ${esc(p.header ? h : String(p.sample[i] || '').slice(0, 16))}</label><select id="bmap-${i}" data-col="${i}">${BOM_ROLES.map(([v, l]) => `<option value="${v}" ${(p.roles[i] || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}</div>
    <p class="small muted">품명·사양과 품번은 여러 열에 줄 수 있습니다 (예: 품명 + 규격). 품목·호칭·길이를 따로 적은 BOM은 각 열에 그 역할을 주면 한 줄로 합쳐 읽습니다.</p>
    ${state.bom.map ? '<button class="btn sm" type="button" data-act="automap">자동 인식으로 되돌리기</button>' : ''}</details>`;
}
const wbInputHtml = () => `<div class="wb-in">${wbRfqHtml()}
  <div class="wb-s1">
    <div class="wb-s1-h"><label for="bom-text"><span class="wb-s">S1</span>BOM 붙여넣기</label>${state.bom.sample ? '<span class="tag ex" id="wb-sample-tag">견본 목록</span>' : ''}<span class="small muted" id="bom-mode"></span></div>
    <textarea id="bom-text" class="wb-ta" spellcheck="false" autocomplete="off" aria-describedby="bom-help">${esc(state.bom.text)}</textarea>
    <p id="bom-help" class="small muted">엑셀·구글 시트에서 번호·품번·품명·수량 열을 복사해 그대로 붙여 넣으세요. 한 줄에 한 품목씩 적어도 됩니다 (예: <span class="mono">SHCS M10x30 12.9 200EA</span>). 줄 수 제한은 없고, 해석은 이 브라우저 안에서만 하며 어디로도 보내지 않습니다.</p>
    <p id="bom-enc" class="small redp" role="status" hidden></p>
    <div class="actions"><label class="btn sm" for="bom-file">파일 열기 (.xlsx .csv .tsv .txt .json)</label><input id="bom-file" class="sr" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,.json">
      <button class="btn sm" type="button" data-act="sample">견본 12줄</button><button class="btn sm" type="button" data-act="sample2">플랜트 견본 20줄</button><button class="btn sm" type="button" data-act="clear">비우기</button>
      <span class="small muted" id="bom-file-msg" role="status" aria-live="polite"></span></div>
  </div>
  <div id="bom-map"></div></div>`;

/* ── B 구역: 요약 표제란 ── */
function bomSumHtml(c) {
  const s = c.sum;
  if (!s.n) return `<div class="empty"><h3>BOM을 붙여 넣으면 줄마다 해석 결과가 여기에 모입니다</h3><p class="muted">견본 목록으로 먼저 살펴보셔도 됩니다.</p><div class="actions"><button class="btn" type="button" data-act="sample">견본 12줄 넣기</button></div></div>`;
  const qs = WB_Q.filter(([k]) => s.byQ[k]).map(([k, l]) => `<button type="button" class="wb-qc" data-qcat="${k}">${l} ${s.byQ[k]}</button>`).join(' · ');
  const r = s.ref, rng = PRICE_ANY() && r && r.supplyMax > r.supplyMin ? `참고 총액 ${won(r.supplyMin)} ~ ${won(r.supplyMax)} (VAT 별도)${r.noRef ? ` · 참고가 없음 ${r.noRef}줄` : ''}` : '';
  const R = s.rows || {};
  return `<div class="wb-tb" role="group" aria-label="BOM 요약">
  <div><span class="lab">전체 Lines</span><b class="big">${s.n}</b><span class="sub">자동 확정 ${s.auto}${c.all.length > s.n ? ` · 구역 제목 줄 ${c.all.length - s.n}` : ''}</span></div>
  <div class="${s.need.length ? 'hot' : ''}"><span class="lab">확인 필요</span><b class="big">${s.need.length}</b><span class="sub">${qs || '없음 · 발행할 수 있습니다'}</span></div>
  <div><span class="lab">엔지니어 견적</span><b class="big">${s.eq.length}</b><span class="sub">${s.lastReply ? `회신 예정 마지막 ${bomMD(s.lastReply)}` : '회신할 줄 없음'}</span></div>
  <div class="e"><span class="lab">공급 불가 · 제외</span><b class="big">${s.na.length} · ${s.ex.length}</b><span class="sub">${s.na.length + s.ex.length ? '<button type="button" class="wb-qc" data-act="tona">C 구역 목록</button>' : '없음'}</span></div>
  ${s.sub > 0 ? `<div><span class="lab">공급가액 VAT 별도</span><b class="mono">${won(s.sub)}</b><span class="sub">${PRICE_LAB()} ${s.cat.filter(v => v.x.m.price != null).length}종${s.ship ? ` · 운임 ${won(s.ship)} 포함` : ' · 운임 무료'}</span></div>
  <div><span class="lab">부가세 10%</span><b class="mono">${won(s.vat)}</b><span class="sub">합계에서 한 번 계산</span></div>
  <div class="s2 e grand"><span class="lab">합계 VAT 포함 · ${PRICE_LAB()}</span><b class="mono">${won(s.total)}</b><span class="sub ko-amt">${esc(s.words)}${s.wordsOk ? '' : ' <b class="redp">한글 금액이 숫자와 다릅니다</b>'}</span></div>`
  : `<div class="s4 e grand"><span class="lab">단가</span><b>공급처 확인 뒤 회신</b><span class="sub">카탈로그 품목 ${s.cat.length}종도 단가 확인 중이라 금액 합계를 만들지 않습니다. 견적서에는 줄마다 '단가 회신 예정'으로 적습니다.</span></div>`}
  <div class="s4 e lr wb-tb-f"><span>카탈로그 품목 <b>${esc(bomCatShipTxt(s, bomMD))}</b></span>${rng ? `<span>${rng}</span>` : ''}<span>C&amp;D 확인 ${R.C || 0} · 편차 ${R.D || 0} · 예외 ${R.E || 0}</span><span>견적번호 <b class="mono">${esc(c.doc.quoteNo)}</b> Rev ${esc(c.doc.rev)}</span></div>
</div>
<div class="actions wb-act"><button class="btn pri" type="button" data-act="defaults"${s.defaults.length ? '' : ' disabled'}>기본값 모두 승인 (${s.defaults.length})</button><a class="btn" href="#quote" data-go="quote">견적서·C&amp;D 보기 <span class="ar">→</span></a><button class="btn" type="button" data-act="tocart">견적함에 담기</button>${s.byQ.conflict ? `<span class="small redp">충돌 ${s.byQ.conflict}건 미해결: 해당 줄은 엔지니어 견적으로 발행됩니다</span>` : ''}</div>`;
}

/* ── B 구역: 목록 ── */
function wbVisible(c) {
  const B = state.bom, f = B.filter, q = String(B.q || '').trim().toLowerCase();
  let L = c.L;
  if (f === 'review') L = L.filter(v => v.need).sort((a, b) => WB_QK[a.cat].n - WB_QK[b.cat].n || a.i - b.i);
  else if (f === 'not-available') L = L.filter(v => v.ex || v.x.m.status === f);
  else if (f !== 'all') L = L.filter(v => !v.ex && v.x.m.status === f);
  if (q) L = L.filter(v => [v.x.row.no, v.x.row.text, v.x.row.pn, v.x.m.pn, ...v.rows.map(r => r.ruleId + ' ' + r.no)].join(' ').toLowerCase().includes(q));
  return L;
}
function wbWhy(v) {
  const r = v.cat !== 'na' && v.qrows.find(rr => rr.queue === v.cat);
  return r ? r.reason.ko : WB_QK[v.cat].w;
}
function bomRowHtml(v, pos, tot) {
  const { x, l } = v, { q, m, row } = x, B = state.bom, st = v.ex ? BOM_ST.excluded : BOM_ST[m.status], on = B.open === v.key, qt = bomQtyTxt(x);
  const ref = bomRef(x), na = m.status === 'not-available', cat = v.cat && WB_QK[v.cat];
  const label = `${wbIsReview() && tot ? `확인 필요 ${tot}건 중 ${pos}번째 · ${cat ? cat.l + ' · ' : ''}` : ''}BOM No ${ref} · ${st[0]}`;
  const price = v.ex ? '<span class="sub">견적에서 뺌</span>' : m.status === 'catalog' ? (m.price == null ? `<b>단가 확인 중</b><span class="sub">${m.qty.toLocaleString()} ${bomUnit(m)} · 견적으로 회신</span>` : `<b class="mono">${won(m.price)}</b><span class="sub">× ${m.qty.toLocaleString()} ${bomUnit(m)}</span><b class="mono amt">${won(m.amount)}</b>`)
    : m.status === 'engineer-quote' ? `<b>회신 예정</b><span class="sub">${l.replyBy ? bomMD(l.replyBy) : '접수 확인 때 안내'}</span>${m.indicative ? `<span class="sub ind">${esc(bomShort(m.indicative, 54))}</span>` : ''}` : '<span class="sub">—</span>';
  const rule = v.qrows.find(r => r.queue === v.cat), many = rule && rule.lines.length > 1;
  const dev = v.q.includes('dev') || v.rows.some(r => r.type === 'D');
  return `<div class="wb-row st-${v.ex ? 'ex' : st[1]}${v.need ? ' need q-' + v.cat : ''}${on ? ' on' : ''}${BOM_SEL.has(v.key) ? ' sel' : ''}" data-k="${esc(v.key)}" role="listitem" tabindex="${(WB.cur ? WB.cur === v.key : pos === 1) ? 0 : -1}" aria-label="${esc(label)}">
  <div class="wb-n"><input type="checkbox" class="wb-ck" data-ck="${esc(v.key)}" aria-label="BOM No ${esc(ref)} 고르기"${BOM_SEL.has(v.key) ? ' checked' : ''}><span class="${ref.length <= 3 ? 'ball' : 'wb-no'}${m.status === 'engineer-quote' ? ' q' : ''}" aria-hidden="true">${esc(ref)}</span></div>
  <div class="wb-b">
    <div class="wb-src"><p class="mono wb-raw">${row.text ? esc(row.text) : '<i>(품명 칸 비어 있음)</i>'}</p><p class="wb-qty">${q.qty ? `수량 ${esc(qt.raw)}${qt.differs && !na ? ` → <b>${esc(qt.calc)}</b>` : ''}` : '수량 없음'}${row.pn ? ` · 고객 품번 <span class="mono">${esc(row.pn)}</span>` : ''}${row.filled ? ` · 위 줄(No ${esc(row.filled)}) 사양 이어받음` : ''}${q.edited.length || B.ov[v.key] ? ' · <b>수정함</b>' : ''}${x.sec ? ` · 구역 ${esc(bomShort(x.sec.text, 30))}` : ''}${m.qtyWarn && !na ? ' <span class="tag warn">수량 확인</span>' : ''}</p></div>
    <div class="wb-chips">${bomChips(q) || '<span class="small muted">읽은 사양 없음</span>'}</div>
    ${na ? `<p class="wb-na-l"><b>${BOM_NA_LINE}</b> · ${esc(bomShort((m.reasons.find(r => r.tone === 'crit') || m.reasons[0] || {}).text || '', 110))}</p>`
      : `<p class="wb-spec">${m.pn ? `<span class="wb-pn mono">${esc(m.pn)}</span> ` : ''}${esc(m.spec)}${wbEnName(x)}</p>
    <p class="wb-meta">${m.lead ? `<span class="tag ${m.lead.code === 'OWN_STOCK' ? 'ok' : m.lead.code === 'NO_SOURCE' ? 'q' : 'wait'}">${esc(m.lead.label)}</span>` : ''}<span>${esc(bomLeadTxt(v))}</span>${m.packPlan?.note ? `<span>${esc(m.packPlan.note)}</span>` : ''}${bomDocTags(l)}${bomCdTags(l, v.rows)}</p>`}
    ${v.need ? `<div class="wb-why">${wbIsReview() ? '' : `<span class="tag ${v.cat === 'conflict' ? 'crit' : 'warn'}">확인 필요 · ${cat.l}</span>`}<span class="wb-why-t">${esc(bomShort(wbWhy(v), 150))}</span>
      <div class="actions"><button class="btn sm" type="button" data-act="accept">${wbT('A', '수락')}</button>${dev ? `<button class="btn sm" type="button" data-act="orig">${wbT('R', '원 사양 견적')}</button>` : ''}<button class="btn sm" type="button" data-act="edit">${wbT('E', '고치기')}</button><button class="btn sm" type="button" data-act="excl">${wbT('X', '제외')}</button>${many ? `<button class="btn sm txt" type="button" data-act="acceptrule">${wbT('⇧A', `같은 규칙 ${rule.lines.length}줄 모두 수락`)}</button>` : ''}</div></div>` : ''}
  </div>
  <div class="wb-pt"><div class="wb-p"><span class="tag ${st[1]}">${st[0]}</span>${!v.ex && !v.need && !na && m.status === 'catalog' ? '<span class="wb-ok">확정</span>' : ''}${price}</div>
  <div class="wb-t"><button type="button" class="wb-th" data-act="open" aria-expanded="${on}" aria-controls="wb-det" aria-label="BOM No ${esc(ref)} ${na ? '사유' : '도면·상세'} 보기"><span class="wb-th-i" data-th="${v.i}"></span><span class="wb-th-c">${na || v.ex ? '사유' : '도면·상세'}</span></button></div></div>
</div>`;
}
const bomShort = (t, n = 96) => { t = String(t); if (t.length <= n) return t; const cut = t.lastIndexOf(' ', n - 1); return t.slice(0, cut > n * .6 ? cut : n - 1).replace(/[\s,·:(]+$/, '') + '…'; };
function bomListHtml(c) {
  const B = state.bom, vis = wbVisible(c), cnt = { review: c.sum.need.length, all: c.L.length, catalog: c.sum.cat.length, 'engineer-quote': c.sum.eq.length, 'not-available': c.sum.na.length + c.sum.ex.length };
  const tab = (k, l) => `<button type="button" role="tab" class="${B.filter === k ? 'on' : ''}" data-filter="${k}" aria-selected="${B.filter === k}" aria-controls="wb-list">${l} <span class="num">${cnt[k]}</span></button>`;
  let body = '';
  if (!c.L.length) body = '<p class="wb-empty">BOM을 붙여 넣으면 여기에 줄별 해석이 나옵니다.</p>';
  else if (!vis.length) body = B.filter === 'review' && !B.q ? `<div class="wb-empty done"><b>확인할 줄이 없습니다. Rev ${esc(c.doc.rev)}를 발행할 수 있습니다.</b><button class="btn pri" type="button" data-act="toissue">D 구역에서 발행하기</button></div>` : '<p class="wb-empty">이 보기에 해당하는 줄이 없습니다.</p>';
  else if (B.filter === 'review') {
    let last = '';
    vis.forEach((v, i) => {
      if (v.cat !== last) { last = v.cat; const k = WB_QK[v.cat], n = vis.filter(w => w.cat === v.cat).length; body += `<div class="wb-gh q-${v.cat}" id="wb-g-${v.cat}" role="presentation"><span class="wb-gn">${k.n}</span><b>${k.l} ${n}줄</b><span>${k.w}</span></div>`; }
      body += bomRowHtml(v, i + 1, vis.length);
    });
  } else {
    const at = new Map(vis.map((v, i) => [v.x, [v, i]])), secOn = B.filter === 'all' && !B.q;
    for (const x of c.all) {
      if (x.section) { if (secOn) body += `<div class="wb-sec" role="presentation"><span class="lab">구역</span><b>${esc(x.row.text)}</b>${x.sec?.api610 ? `<span class="tag info">API 610 ${esc(x.sec.api610.cls || '')}</span>` : ''}<button type="button" class="btn sm txt" data-act="secsel" data-sec="${esc(x.row.text)}">이 구역 줄 고르기</button></div>`; continue; }
      const a = at.get(x); if (a) body += bomRowHtml(a[0], a[1] + 1, vis.length);
    }
  }
  return `<div class="wb-tabs" role="tablist" aria-label="줄 보기">${tab('review', '확인 필요')}${tab('all', '전체')}${tab('catalog', '카탈로그 품목')}${tab('engineer-quote', '엔지니어 견적')}${tab('not-available', '공급 불가·제외')}</div>
<div class="wb-list" id="wb-list" role="list" aria-label="${B.filter === 'review' ? '판단이 필요한 줄' : 'BOM 줄'}">${body}</div>`;
}

/* ── B 구역: 상세 (오른쪽, 좁은 화면은 아래에서 올라오는 시트) ── */
const BOM_MATS = { metric: ['45H', '12.9', '10.9', '010.9', '8.8', '4.8', 'N8', 'A2', 'A4', '200HV', 'SPR'], inch: ['F912', 'F880', 'A574', 'F837', 'F835', 'F879', 'J429-5', 'J429-8', 'F593-1', 'F593-2', 'J995-8', 'A563-A', '2H', 'A563-DH', 'B7', 'B7M', 'L7', 'B8M', 'F436-1', '18-8'] };
const BOM_FINS = ['PL', 'BO', 'ZN', 'YZ', 'HDG', 'ZF', 'PTFE', 'ZNNI'];
const BOM_TYPES = ['setscrew', 'shcs', 'fhcs', 'bhcs', 'hexbolt', 'heavyhexbolt', 'nut', 'heavynut', 'stud', 'washer', 'lockwasher', 'rod', 'anchor'];
const bomOpts = (arr, cur) => arr.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('');
function bomEditHtml(v) {
  const { x } = v, { q, m } = x, ov = state.bom.ov[v.key] || {}, n = v.i;
  const types = [['', '읽은 대로'], ...BOM_TYPES.map(k => [k, TYPE_KO[k]])];
  const mats = [['', '읽은 대로'], ...BOM_MATS[q.system === 'inch' ? 'inch' : 'metric'].map(k => [k, MAT_KO[k] || k])];
  const fins = [['', '읽은 대로'], ...BOM_FINS.map(k => [k, FIN_KO[k]])];
  const pts = [['', '읽은 대로'], ...Object.keys(PT_KO).map(k => [k, PT_KO[k]])];
  return `<form class="wb-ed bm-ed" data-k="${esc(v.key)}" aria-label="BOM No ${esc(bomRef(x))} 고치기">
    <p class="lab">잘못 읽었으면 고치기 · Enter 적용 · Esc 취소</p>
    <div class="wb-ed-g">
      <div class="field"><label for="ed-t-${n}">품목</label><select id="ed-t-${n}" name="type">${bomOpts(types, ov.type || '')}</select></div>
      <div class="field"><label for="ed-s-${n}">호칭</label><input id="ed-s-${n}" name="size" value="${esc(ov.size || '')}" placeholder="${esc(q.size ? threadTxt(q).replace(/-[123][AB]$|-\d[gh]\d?[gh]?$/i, '') + ' (읽은 값)' : q.system === 'inch' ? '예: 3/8-16' : '예: M10')}"></div>
      <div class="field"><label for="ed-l-${n}">길이 (${q.system === 'inch' ? 'in, mm는 mm 붙임' : 'mm'})</label><input id="ed-l-${n}" name="length" value="${esc(ov.length || '')}" placeholder="${esc(q.lengthIn != null ? inFrac(q.lengthIn) + ' (읽은 값)' : q.lengthMm != null ? q.lengthMm + ' (읽은 값)' : q.system === 'inch' ? '예: 1-1/4' : '예: 30')}"></div>
      <div class="field"><label for="ed-q-${n}">수량</label><input id="ed-q-${n}" name="qty" inputmode="decimal" value="${esc(ov.qty || '')}" placeholder="${m.qty.toLocaleString()} (계산 수량)"></div>
      <div class="field"><label for="ed-m-${n}">재질·등급</label><select id="ed-m-${n}" name="mat">${bomOpts(mats, ov.mat || '')}</select></div>
      <div class="field"><label for="ed-f-${n}">표면처리</label><select id="ed-f-${n}" name="fin">${bomOpts(fins, ov.fin || '')}</select></div>
      ${q.type === 'setscrew' || ov.point ? `<div class="field"><label for="ed-p-${n}">끝 형상</label><select id="ed-p-${n}" name="point">${bomOpts(pts, ov.point || '')}</select></div>` : ''}
    </div>
    <div class="actions"><button class="btn sm pri" type="submit">적용</button>${Object.keys(ov).length ? '<button class="btn sm" type="button" data-act="reset">원래대로</button>' : ''}</div>
  </form>`;
}
// 맞은 품목의 공식 영문명: 카탈로그 품목 줄(과 m.catFam이 있는 견적 줄)은 카탈로그 품목군 이름과 규격 태그, 그 밖의 줄은 줄 품목 이름 (오너 결정 2)
function wbEnName(x) {
  const f = bomEnMatch(x.m), en = f ? f.en : bomEnType(x.q, true).en, std = f ? f.std : '';
  return en ? `<span class="wb-en" lang="en">${esc(en)}${std ? ` <span class="tag en-std">${esc(std)}</span>` : ''}</span>` : '';
}
function wbDetHtml(c) {
  const v = c.L.find(w => w.key === state.bom.open);
  if (!v) return wbCheckHtml(c);
  const { x, l } = v, { q, m, row } = x, ref = bomRef(x), st = v.ex ? BOM_ST.excluded : BOM_ST[m.status], dw = !v.ex && drawingFor(x);
  const list = (t, a) => a.length ? `<div class="wb-dl"><span class="lab">${t}</span><ul>${a.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : '';
  const fm = bomEnMatch(m), nm = bomEnLine(x);
  const kv = [['품명', bomKoEn(nm.ko, m.catFam ? nm.en : bomEnType(q, true).en)], ...(fm ? [['카탈로그 품목', `${bomKoEn(fm.ko, fm.en)} (${fm.std})`]] : []), ['정리한 사양', m.spec], ['당사 품번', m.pn], ['납기 티어', m.lead?.text], ['포장', m.packPlan?.note], ['인도 조건', m.status === 'not-available' ? '' : m.delivery], ['서류', l.docPlan?.text?.ko], ['도면 번호', l.drawing?.has ? `${l.drawing.no}${l.drawing.forApproval ? ' · 승인용' : ''}` : ''], ['준수 코드', `${l.compliance} · ${CD_COMP[l.compliance]?.ko || ''}`]].filter(r => r[1]);
  const alt = m.alt ? `<div class="wb-cmp"><span class="lab">${m.alt.price != null ? `가격 비교 · ${PRICE_LAB()}` : '대안 품목'}</span><div><span>${m.alt.exact ? '기본품' : '대안 품목'} <span class="mono">${esc(m.alt.pn)}</span></span><b class="mono">${m.alt.price != null ? `${won(m.alt.price)}/${bomUnit(m)}` : '단가 확인 중'}</b></div>${v.rows.filter(r => r.impact?.kind && r.impact.kind !== 'none').map(r => `<div><span>${esc(r.no)} 준수 시</span><span>${esc(r.impact.text.ko.split(' · ')[0])}</span></div>`).join('')}</div>` : '';
  const cdl = v.rows.length ? `<div class="wb-cdl"><span class="lab">이 줄의 C&amp;D 행</span><ol>${v.rows.map(r => `<li><span class="wb-cd t-${r.type}${CD_RESOLVED.has(r.status) ? ' done' : ''}">${r.no}</span><div><b>${CD_TYPE[r.type].ko} · ${CD_CAT[r.cat].ko} · ${CD_STATUS[r.status].ko}</b><span>${esc(r.reason.ko)}</span>${r.refs.length ? `<span class="sub">근거: ${esc(r.refs.join('; '))}${esc(r.refTag?.ko || '')}</span>` : ''}<span class="sub">영향: ${esc(r.impact.text.ko)}</span>${r.lines.length > 1 && !CD_RESOLVED.has(r.status) && WB_QK[r.queue] ? `<button type="button" class="btn sm txt" data-act="acceptrow" data-row="${esc(r.key)}">이 행 ${r.lines.length}줄 모두 수락</button>` : ''}</div></li>`).join('')}</ol></div>` : '';
  return `<div class="wb-det-line" role="region" aria-label="BOM No ${esc(ref)} 상세">
  <div class="wb-det-h"><span class="${ref.length <= 3 ? 'ball' : 'wb-no'}" aria-hidden="true">${esc(ref)}</span><div><b>BOM No ${esc(ref)}</b><span class="sub">${row.pn ? `고객 품번 ${esc(row.pn)} · ` : ''}<span class="tag ${st[1]}">${st[0]}</span>${v.cat ? ` <span class="tag warn">${WB_QK[v.cat].l}</span>` : ''}</span></div><button type="button" class="btn sm" data-act="close">닫기</button></div>
  <p class="mono wb-raw">${esc(row.text || '(품명 칸 비어 있음)')}</p>
  ${dw ? `<div class="dbox wb-dw">${dw}</div><p class="xs faint">표준 치수표 값으로 그린 참고 도면 (척도 없음) · 도면 번호 ${esc(l.drawing?.no || '')}</p>` : noteSm('', m.status === 'not-available' ? '공급하지 않는 품목이라 도면을 만들지 않습니다.' : v.ex ? '견적에서 뺀 줄입니다.' : q.variant ? '변형품이라 표준 도면이 없습니다. 지어내지 않습니다.' : '호칭을 읽지 못해 도면을 만들 수 없습니다. 아래에서 호칭을 고쳐 주세요.', '도면')}
  <span class="lab">해석 · 점선은 기본값</span><div class="wb-chips">${bomChips(q) || '<span class="small muted">읽은 사양 없음</span>'}</div>
  ${m.status === 'not-available' ? note('crit', `<b>${BOM_NA_LINE}</b>`, '불가') : ''}
  ${m.reasons.map(r => noteSm(r.tone === 'crit' ? 'crit' : r.tone === 'info' ? 'info' : 'warn', esc(r.text))).join('')}
  ${m.tier ? noteSm('info', esc(m.tier.text), '단가') : ''}
  <dl class="kv small">${kv.map(([k, t]) => `<dt>${k}</dt><dd>${esc(t)}</dd>`).join('')}</dl>
  ${alt}${cdl}${list('가정한 값', q.assumptions)}${list('확인할 것', q.questions)}
  ${m.status !== 'not-available' || q.type === 'unknown' || !q.size ? bomEditHtml(v) : ''}
  <div class="actions wb-det-a">${v.need ? `<button class="btn sm" type="button" data-act="accept">${wbT('A', '수락')}</button>` : ''}${v.q.includes('dev') || v.rows.some(r => r.type === 'D') ? `<button class="btn sm" type="button" data-act="orig"${state.bom.orig[v.key] ? ' aria-pressed="true"' : ''}>${wbT('R', state.bom.orig[v.key] ? '편차안으로 되돌리기' : '원 사양 견적')}</button>` : ''}<button class="btn sm" type="button" data-act="excl">${wbT('X', v.ex ? '제외 풀기' : '이 줄 제외')}</button></div>
</div>`;
}
function wbCheckHtml(c) {
  const s = c.sum, d = c.doc, X = d.unresolvedX.length;
  const li = (ok, t) => `<li class="${ok ? 'ok' : 'no'}"><span class="mt">${ok ? '완료' : '남음'}</span><span>${t}</span></li>`;
  return `<div class="wb-chk"><h3>발행 전 점검</h3><p class="small muted">줄을 누르거나 Enter를 누르면 도면·근거·가격 비교·서류·납기가 여기에 나옵니다.</p>
  <ul class="wb-chkl">${li(!s.need.length, s.need.length ? `확인 필요 ${s.need.length}줄` : '확인할 줄 없음')}${li(!X, X ? `미해결 충돌 ${X}건: 해당 줄은 엔지니어 견적으로 발행됩니다` : '미해결 충돌 없음')}${li(!s.eq.length, s.eq.length ? `엔지니어 견적 ${s.eq.length}줄: 회신 예정일을 줄마다 적어 발행합니다` : '엔지니어 견적 줄 없음')}${li(s.wordsOk, s.wordsOk ? '한글 금액 = 숫자 합계' : '한글 금액이 숫자와 다릅니다')}</ul>
  <dl class="kv small"><dt>C&amp;D 행</dt><dd>확인 ${d.statement.counts.rows.C || 0} · 편차 ${d.statement.counts.rows.D || 0} · 예외 ${d.statement.counts.rows.E || 0}</dd><dt>준수 코드</dt><dd>${Object.entries(d.compliance.counts).map(([k, n]) => `${k} ${n}`).join(' · ')}</dd><dt>견적 구분</dt><dd>${esc(d.header.offerType.ko)}${d.firmBlocked?.length ? ' (정식 견적 조건 미충족)' : ''}</dd></dl>
  <p class="small muted">단축키: ↑↓ 줄 · N 다음 미해결 · 1–6 분류 · A 수락 · ⇧A 같은 규칙 · R 원 사양 · E 고치기 · X 제외 · U 되돌리기 · / 찾기 · G Q 견적서 · ? 도움말</p></div>`;
}

/* ── C 구역: 공급하지 않는 줄 (3.10절) ── */
function wbNaHtml(c) {
  const na = c.doc.notAvailable;
  if (!na.lines.length) return `<p class="small muted">공급하지 않는 줄이 없습니다. 볼트·너트·와셔가 아닌 배관 부품·개스킷·O링·공구 같은 줄은 여기에 모아 다른 공급처 안내 문장과 함께 보여 드립니다.</p>`;
  return `<div class="stack">${note('crit', `<b>${BOM_NA_HEAD}</b> — ${esc(na.intro.ko)} ${esc(na.intro.en)}`, '불가')}
<div class="tblw"><table class="tbl mstack wb-nat"><thead><tr><th>BOM No</th><th>고객 품번</th><th>BOM 원문 (고치지 않음)</th><th class="r">수량</th><th>사유</th></tr></thead><tbody>${na.lines.map(l => `<tr><td class="mono" data-l="BOM No">${esc(l.ref)}</td><td class="mono" data-l="고객 품번">${esc(l.pn || '—')}</td><td class="mono wide" data-l="BOM 원문">${esc(l.raw || '(비어 있음)')}</td><td class="r mono" data-l="수량">${esc(l.qtyRaw || '—')}</td><td class="wide" data-l="사유">${esc(l.reason)}<span class="sub">${esc(l.elsewhere.ko)}</span></td></tr>`).join('')}</tbody></table></div>
<p class="small muted">${esc(na.outro.ko)}</p>
<div class="actions"><button class="btn sm" type="button" data-act="nacopy">메일용 복사 (${na.lines.length}건)</button><span class="small muted" id="wb-na-msg" role="status" aria-live="polite"></span></div>
<textarea id="wb-na-copy" class="qd-copy" readonly hidden aria-label="복사할 공급 불가 목록"></textarea></div>`;
}

/* ── D 구역: 발행·내보내기 ── */
function wbOutHtml(c) {
  const d = c.doc, revs = cdLoadRevs(d.quoteNo), r = state.bom.rfq, rv = r.review || {};
  return `<div class="cols c-7-5"><div class="stack">
  <div class="tblock wb-iss" role="group" aria-label="발행 정보">
    <div class="s2"><span class="lab">견적번호 Quotation No.</span><b class="val mono">${esc(d.quoteNo)}</b></div>
    <div><span class="lab">이번 Rev</span><b class="val">${esc(d.rev)}</b><span class="sub">${c.issued ? '발행됨 · 고치면 다음 Rev' : '작성 중'}</span></div>
    <div class="e"><span class="lab">견적 구분</span><b class="val">${esc(d.header.offerType.ko)}</b><span class="sub">${d.offerType === 'firm' ? '운영자 서명' : '운영자 검토 전'}</span></div>
    <div class="s4 e lr"><span class="lab">발행 이력 · 이 브라우저</span>${revs.length ? `<span class="sub">${revs.map(s => `Rev ${esc(s.rev)} · ${esc(String(s.issuedAt).slice(0, 16).replace('T', ' '))} · ${esc(s.offerType === 'firm' ? '정식' : '자동')}`).join('<br>')}</span>` : '<span class="sub">아직 발행한 Rev가 없습니다. 발행한 Rev는 고칠 수 없고, 고치면 다음 Rev로 냅니다.</span>'}</div>
  </div>
  ${(d.firmBlocked || []).map(b => noteSm('warn', esc(b.ko), '정식')).join('')}
  <div class="actions"><button class="btn pri" type="button" data-act="issue" id="wb-issue"${c.issued ? ' disabled' : ''}>${c.issued ? `Rev ${esc(d.rev)} 발행됨` : `Rev ${esc(d.rev)} 발행`}</button><a class="btn" href="#quote" data-go="quote">견적서·C&amp;D 보기 <span class="ar">→</span></a></div>
  <div id="wb-issue-msg" role="status" aria-live="polite"></div>
  <p class="small muted">발행할 때 12가지를 대조합니다: 줄 수 합, 기본값이 GC·C행에 남았는지, 대체 공급마다 D행이 있는지, 한글 금액과 합계, 준수 코드 합, 행 번호 유지, 문서끼리 숫자, 볼트노트 명의 3.1이 없는지, 가격 없는 기술본의 금액, 정식 견적 조건, 받지 못한 참조 문서, 자동 견적의 직인·선언문. 하나라도 틀리면 발행을 멈춥니다.</p>
</div><div class="stack">
  <span class="lab">내보내기 · 같은 Rev에서 만듭니다</span>
  <div class="actions"><button class="btn sm" type="button" data-x="xlsx">엑셀 5시트 (.xlsx)</button><button class="btn sm" type="button" data-x="json">JSON</button><button class="btn sm" type="button" data-x="csv">CSV</button><button class="btn sm" type="button" data-x="mail">메일 텍스트 복사</button></div>
  <p class="small muted">엑셀은 견적 · C&amp;D(고객 회신 칸) · 준수 요약 · 공급 불가 · 해석 원문 다섯 시트입니다. JSON은 다시 넣어 재견적·재주문할 때 씁니다.</p>
  <span class="small muted" id="wb-x-msg" role="status" aria-live="polite"></span>
  <details class="acc wb-op"${rv.by || rv.ok ? ' open' : ''}><summary><span>운영자 검토 · 정식 견적 서명 <small class="faint">볼트노트 운영자 전용</small></span></summary>
    <form class="stack" id="wb-op-f" autocomplete="off">
      <p class="small muted">구매자가 쓰는 칸이 아닙니다. 운영자가 C&amp;D 행·GC·상업 조건과 받지 못한 참조 문서를 검토한 뒤 이름을 적고 검토 완료를 표시하면 정식 견적(직인 자리·준수 선언문 포함)으로 발행할 수 있습니다. 견적 구분이 '정식 견적 요청'이어야 합니다.</p>
      <div class="field"><label for="op-by">검토자</label><input class="inp" id="op-by" name="by" value="${esc(rv.by || '')}" placeholder="이름 · 직위"></div>
      <label class="agree"><input type="checkbox" name="ok"${rv.ok ? ' checked' : ''}><span>C&amp;D·GC·상업 조건을 검토했습니다</span></label>
    </form></details>
</div></div>`;
}

/* ── 화면 ── */
V.bom = () => sheet(zone('A', 'z-a', shd({ trail: [['BOM 견적']], no: SHEETS.bom[0], title: 'BOM 붙여넣기 견적',
  p: 'BOM 표를 그대로 붙여 넣으면 줄마다 규격을 읽고, 단가·납기·서류·도면에 C&amp;D 시트까지 한 번에 만듭니다. 사람이 볼 줄은 판단이 필요한 줄만 남깁니다.' }) + wbInputHtml())
  + zone('B', 'z-b', zh('B', 'z-b', '줄 검토', '판단이 필요한 줄부터 보여 드립니다. 그 밖의 줄은 자동으로 확정했고 전체 탭에 있습니다.') + `<div id="bom-sum" class="wb-sum" aria-live="polite" aria-label="BOM 요약"></div>
<div class="wb-tool" role="toolbar" aria-label="줄 도구"><div class="wb-find"><label class="sr" for="wb-q">줄 찾기 (원문·품번·규칙 ID)</label><input id="wb-q" class="inp" type="search" value="${esc(state.bom.q || '')}" placeholder="원문·품번·규칙 ID 찾기  /" autocomplete="off"></div><button class="btn sm" type="button" data-act="undo" id="wb-undo"${BOM_UNDO.length ? '' : ' disabled'}>${wbT('U', '되돌리기')}</button><button class="btn sm" type="button" data-act="help" aria-expanded="false" aria-controls="wb-help">${wbT('?', '단축키')}</button></div>
<div class="wb-help" id="wb-help" hidden><table class="tbl"><tbody>${[['↓ ↑ · J K', '다음·이전 줄'], ['N', '다음 미해결 줄'], ['1–6', '분류로 이동: 충돌 · 읽지 못함 · 모호 · 편차 · 수량 · 공급 불가'], ['Enter', '상세 열기'], ['A', '이 줄 제안 수락'], ['Shift + A', '같은 규칙 묶음 모두 수락'], ['R', '편차 줄을 원 사양대로 엔지니어 견적'], ['E', '고치기 (Enter 적용, Esc 취소)'], ['X', '이 줄 제외'], ['U', '되돌리기 (최근 20 동작)'], ['/', '찾기'], ['G 다음 Q', '견적서 보기'], ['Ctrl·⌘ + Enter', 'Rev 발행 (발행 버튼으로 이동, Enter로 확정)'], ['?', '이 도움말']].map(([k, t]) => `<tr><td class="mono">${k}</td><td>${t}</td></tr>`).join('')}</tbody></table>
  <label class="agree"><input type="checkbox" id="wb-keys"${state.bom.keys ? ' checked' : ''}><span>한 글자 단축키 쓰기 (끄면 화살표·Enter·Ctrl+Enter만 동작)</span></label></div>
<div class="wb-bulk" id="wb-bulk" hidden></div>
<div class="wb"><div class="wb-main" id="bom-out"></div><aside class="wb-side" aria-label="선택한 줄 상세"><div class="wb-det" id="wb-det" tabindex="-1"></div></aside></div>
<div class="wb-bar" id="wb-bar"></div><p class="sr" id="wb-live" aria-live="polite"></p>`)
  + zone('C', 'z-c', zh('C', 'z-c', '공급하지 않는 줄', '저희가 다루지 않는 품목입니다. 줄을 고치지 않은 원문 그대로 모아 두었으니 이 목록만 다른 공급처에 보내시면 됩니다.') + '<div id="wb-na"></div>')
  + zone('D', 'z-d', zh('D', 'z-d', '발행 · 내보내기', '발행하면 이 BOM의 견적서·C&amp;D 시트·준수 요약·공급 불가 목록·도면 묶음이 같은 Rev로 묶입니다.') + '<div id="wb-out"></div>'));

function wbBulkHtml() {
  const n = BOM_SEL.size; if (!n) return '';
  const mats = [['', '재질 그대로'], ...[...BOM_MATS.metric, ...BOM_MATS.inch].map(k => [k, MAT_KO[k] || k])], fins = [['', '표면처리 그대로'], ...BOM_FINS.map(k => [k, FIN_KO[k]])];
  return `<b>고른 줄 ${n}개</b>
  <label class="sr" for="bk-mat">재질</label><select id="bk-mat" class="inp">${bomOpts(mats, '')}</select>
  <label class="sr" for="bk-fin">표면처리</label><select id="bk-fin" class="inp">${bomOpts(fins, '')}</select>
  <label class="wb-mult" for="bk-mult">수량 ×</label><input id="bk-mult" class="inp qty sm" type="number" min="0" step="0.5" value="1">
  <button class="btn sm pri" type="button" data-act="bulk">한 번에 적용</button><button class="btn sm" type="button" data-act="bulkok">수락</button><button class="btn sm" type="button" data-act="bulkx">제외</button><button class="btn sm" type="button" data-act="bulkin">제외 풀기</button><button class="btn sm txt" type="button" data-act="unsel">고르기 해제</button>`;
}
function wbPaint({ list = true, det = true, focus = null } = {}) {
  const c = bomCompute(), $ = id => document.getElementById(id);
  if (!$('bom-out')) return c;
  $('bom-sum').innerHTML = bomSumHtml(c);
  $('bom-map').innerHTML = bomMapHtml(c.parsed);
  $('bom-mode').textContent = { tsv: '표(탭)로 읽음', csv: 'CSV로 읽음', text: '한 줄씩 읽음', empty: '' }[c.parsed.mode] || '';
  // 깨진 한글 (CP949 바이트가 Latin-1로 보이거나 U+FFFD): 붙여넣기로는 되살릴 수 없어 파일 열기를 안내한다
  const enc = $('bom-enc'), tx = state.bom.text || '';
  if (enc) { const bad = /\uFFFD/.test(tx) || /[\u00A1-\u00FF]{4,}/.test(tx); enc.hidden = !bad; enc.textContent = bad ? '한글이 깨져 보입니다 (CP949·EUC-KR 파일). [파일 열기]로 원본 파일을 열거나, 엑셀에서 CSV UTF-8로 저장한 뒤 붙여 넣어 주세요.' : ''; }
  if (list) { $('bom-out').innerHTML = bomListHtml(c); wbThumbs(c); }
  if (det) { const d = $('wb-det'); d.innerHTML = wbDetHtml(c); d.classList.toggle('on', !!c.L.find(v => v.key === state.bom.open)); document.querySelector('.wb')?.classList.toggle('det-on', d.classList.contains('on')); }
  $('wb-na').innerHTML = wbNaHtml(c);
  $('wb-out').innerHTML = wbOutHtml(c);
  $('wb-bulk').innerHTML = wbBulkHtml(); $('wb-bulk').hidden = !BOM_SEL.size;
  $('wb-undo').disabled = !BOM_UNDO.length;
  const s = c.sum;
  $('wb-bar').innerHTML = s.n ? `<button class="btn sm pri" type="button" data-act="defaults"${s.defaults.length ? '' : ' disabled'}>기본값 모두 승인 (${s.defaults.length})</button><a class="btn sm" href="#quote" data-go="quote">견적서 보기</a><span class="xs">확인 ${s.need.length}${s.sub > 0 ? ` · ${won(s.total)}` : ''}</span>` : '';
  if (focus) wbFocus(focus);
  return c;
}
// 도면 미리보기는 화면에 들어올 때만 그린다 (500줄에서도 빨리)
function wbThumbs(c) {
  if (WB.io) WB.io.disconnect();
  const fill = el => { const x = c.items[+el.dataset.th]; if (!x || el.dataset.done) return; el.dataset.done = 1; const v = c.L[+el.dataset.th]; const svg = !v.ex && drawingFor(x, { thumb: true }); el.innerHTML = svg || ''; el.classList.toggle('none', !svg); };
  const els = document.querySelectorAll('#bom-out [data-th]');
  if (!('IntersectionObserver' in window)) { els.forEach(fill); return; }
  WB.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fill(e.target); WB.io.unobserve(e.target); } }), { rootMargin: '400px 0px' });
  els.forEach(el => WB.io.observe(el));
}
function wbRows() { return [...document.querySelectorAll('#wb-list .wb-row')]; }
function wbFocus(key, scroll = true) {
  const el = document.querySelector(`#wb-list .wb-row[data-k="${CSS.escape(key)}"]`) || wbRows()[0];
  if (!el) return;
  wbRows().forEach(r => r.tabIndex = -1); el.tabIndex = 0; WB.cur = el.dataset.k;
  el.focus({ preventScroll: true }); if (scroll) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}
const wbLive = t => { const el = document.getElementById('wb-live'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = t; }); } };
// 동작 뒤 초점: 같은 줄, 큐에서 빠졌으면 그 자리의 다음 줄
function wbAfter(key, msg) {
  const keys = wbRows().map(r => r.dataset.k), at = keys.indexOf(key);
  wbPaint();
  const now = wbRows().map(r => r.dataset.k);
  const next = now.includes(key) ? key : now[Math.min(Math.max(at, 0), now.length - 1)];
  if (next) wbFocus(next); else document.getElementById('wb-list')?.focus();
  if (msg) { wbLive(msg); toast(msg); }
}

V.after.bom = () => {
  const $ = id => document.getElementById(id), ta = $('bom-text'), B = state.bom;
  WB.cur = null; BOM_SEL.clear();
  let tm;
  ta.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { B.text = ta.value; B.sample = false; if (B.map && ta.value.split('\n')[0] !== B.mapHead) B.map = null; bomSave(); $('wb-sample-tag')?.remove(); wbPaint(); }, 220); });
  const setText = (t, file = '') => { ta.value = t; bomNewText(t, false); B.file = file || ''; bomSave(); $('wb-sample-tag')?.remove(); wbPaint(); };
  // S0: RFQ 머리 (입력 즉시 저장, 계산은 잠깐 쉰 뒤)
  let rt;
  const rfqFrom = () => {
    const f = $('wb-rfq-f'), fd = new FormData(f), r = { ...B.rfq };
    for (const k of ['project', 'client', 'attn', 'rfqNo', 'rfqRev', 'due', 'place', 'pay', 'api610', 'nace', 'exposure', 'mdmt', 'flange', 'basis', 'text', 'offer']) r[k] = String(fd.get(k) ?? '').trim();
    r.docs = fd.getAll('docs').map(String);
    B.rfq = r; bomSave(); $('wb-rfq-s').innerHTML = wbRfqSum(r);
    clearTimeout(rt); rt = setTimeout(() => wbPaint(), 300);
  };
  $('wb-rfq-f').addEventListener('input', rfqFrom);
  $('wb-rfq-f').addEventListener('change', rfqFrom);
  $('wb-rfq-f').addEventListener('submit', e => e.preventDefault());
  // 운영자 검토 (D 구역 안, 다시 그려지므로 view에 위임)
  view().addEventListener('change', e => {
    const f = e.target.closest('#wb-op-f');
    if (f) { const fd = new FormData(f), by = String(fd.get('by') || '').trim(), ok = !!fd.get('ok') && !!by; B.rfq = { ...B.rfq, review: { ok, by, at: ok ? bomNowStamp() : '' } }; bomSave(); wbPaint(); if (!!fd.get('ok') && !by) document.getElementById('wb-issue-msg').innerHTML = noteSm('warn', '검토자 이름을 먼저 적어 주세요.', '정식'); return; }
    const s = e.target.closest('[data-col]');
    if (s) {
      const c = bomCompute(), col = +s.dataset.col, roles = [...c.parsed.roles];
      if (s.value && !BOM_MULTI.has(s.value)) roles.forEach((r, i) => { if (r === s.value) roles[i] = ''; });
      roles[col] = s.value; B.map = roles; B.mapHead = String(B.text).split('\n')[0]; bomSave(); wbPaint();
      document.getElementById('bmap-' + col)?.focus();
      return;
    }
    if (e.target.id === 'bom-file') { bomOpenFile(e.target.files[0], setText); return; }
    if (e.target.id === 'wb-keys') { B.keys = e.target.checked; bomSave(); return; }
    const ck = e.target.closest('.wb-ck');
    if (ck) { /* 클릭에서 처리 */ }
  });
  // 찾기
  let qt;
  $('wb-q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { B.q = e.target.value; wbPaint({ det: false }); }, 150); });
  $('wb-q').addEventListener('keydown', e => { if (e.key === 'Escape') { e.target.value = ''; B.q = ''; wbPaint({ det: false }); } if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); wbFocus(wbRows()[0]?.dataset.k || ''); } });
  const open = (key, toggle = true) => {
    B.open = toggle && B.open === key ? null : key;
    wbPaint({ list: false });
    wbRows().forEach(r => { const on = r.dataset.k === B.open; r.classList.toggle('on', on); r.querySelector('[data-act="open"]')?.setAttribute('aria-expanded', String(on)); });
    if (B.open) { WB.cur = key; if (matchMedia('(max-width: 1020px)').matches) $('wb-det').focus({ preventScroll: true }); }
  };
  const act = (name, key) => {
    const c = bomCompute(), v = key && c.L.find(w => w.key === key);
    if (name === 'accept' && v) { bomDo('수락', () => bomAcceptLines([key])); wbAfter(key, `BOM No ${bomRef(v.x)} 제안을 수락했습니다`); return; }
    if (name === 'acceptrule' && v) { const r = v.qrows.find(rr => rr.queue === v.cat) || v.qrows[0]; if (!r) return; bomDo('규칙 묶음 수락', () => bomAcceptRow(r)); wbAfter(key, `${r.no} 묶음 ${r.lines.length}줄을 수락했습니다`); return; }
    if (name === 'orig' && v) { if (B.orig[key]) bomDo('편차안으로', () => { delete B.orig[key]; for (const r of v.rows) if (B.dec[r.key]?.status === 'REJECTED') delete B.dec[r.key]; }); else bomDo('원 사양 견적', () => bomKeepOrigLines([key])); wbAfter(key, B.orig[key] ? `BOM No ${bomRef(v.x)}: 원 사양대로 엔지니어 견적으로 바꿨습니다` : `BOM No ${bomRef(v.x)}: 편차안으로 되돌렸습니다`); return; }
    if (name === 'excl' && v) { const on = !B.excl[key]; bomDo(on ? '제외' : '제외 풀기', () => bomExclude([key], on)); wbAfter(key, on ? `BOM No ${bomRef(v.x)}를 견적에서 뺐습니다` : `BOM No ${bomRef(v.x)}를 다시 넣었습니다`); return; }
    if (name === 'edit' && v) { if (B.open !== key) open(key, false); const f = $('wb-det').querySelector('.wb-ed select, .wb-ed input'); if (f) f.focus(); return; }
  };
  view().addEventListener('click', e => {
    const t = e.target, B = state.bom;
    const fb = t.closest('[data-filter]');
    if (fb) { B.filter = fb.dataset.filter; bomSave(); wbPaint({ det: false }); document.querySelector(`[data-filter="${B.filter}"]`)?.focus(); return; }
    const qc = t.closest('[data-qcat]');
    if (qc) { B.filter = 'review'; bomSave(); wbPaint({ det: false }); const g = $('wb-g-' + qc.dataset.qcat); if (g) { g.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); const r = g.nextElementSibling; if (r) wbFocus(r.dataset.k, false); } return; }
    const ck = t.closest('.wb-ck');
    if (ck) {
      const keys = wbRows().map(r => r.dataset.k), i = keys.indexOf(ck.dataset.ck);
      if (e.shiftKey && WB.last != null && keys.includes(WB.last)) { const j = keys.indexOf(WB.last); keys.slice(Math.min(i, j), Math.max(i, j) + 1).forEach(k => ck.checked ? BOM_SEL.add(k) : BOM_SEL.delete(k)); }
      else ck.checked ? BOM_SEL.add(ck.dataset.ck) : BOM_SEL.delete(ck.dataset.ck);
      WB.last = ck.dataset.ck;
      wbRows().forEach(r => { const s = BOM_SEL.has(r.dataset.k); r.classList.toggle('sel', s); const c2 = r.querySelector('.wb-ck'); if (c2) c2.checked = s; });
      $('wb-bulk').innerHTML = wbBulkHtml(); $('wb-bulk').hidden = !BOM_SEL.size;
      return;
    }
    const a = t.closest('[data-act]'), row = t.closest('.wb-row');
    if (!a) { if (row && !t.closest('a, button, input, select, textarea, label')) { open(row.dataset.k, false); wbFocus(row.dataset.k, false); } return; }
    const name = a.dataset.act, key = row ? row.dataset.k : B.open;
    if (name === 'sample') { ta.value = BOM_SAMPLE; bomNewText(BOM_SAMPLE, true); wbPaint(); return; }
    if (name === 'sample2') { ta.value = BOM_SAMPLE2; bomNewText(BOM_SAMPLE2, false); B.filter = 'review'; bomSave(); wbPaint(); return; }
    if (name === 'clear') { ta.value = ''; bomNewText('', false); wbPaint(); ta.focus(); return; }
    if (name === 'automap') { B.map = null; bomSave(); wbPaint(); return; }
    if (name === 'tocart') { bomToCart(a); return; }
    if (name === 'open' && row) { open(row.dataset.k); wbFocus(row.dataset.k, false); return; }
    if (name === 'close') { const k = B.open; B.open = null; wbPaint({ list: false }); wbRows().forEach(r => r.classList.remove('on')); if (k) wbFocus(k); return; }
    if (name === 'reset' && B.open) { const k = B.open; bomDo('원래대로', () => bomSetOv(k, null)); wbAfter(k, '원래 읽은 값으로 되돌렸습니다'); return; }
    if (name === 'defaults') { let n = 0; bomDo('기본값 모두 승인', () => { n = bomAcceptDefaults(); }); wbAfter(WB.cur || '', `${n}줄의 기본값을 승인했습니다. 편차 행은 고객 승인 전까지 열림으로 둡니다`); return; }
    if (name === 'acceptrow') { const c = bomCompute(), r = c.doc.rows.find(rr => rr.key === a.dataset.row); if (r) { bomDo('행 수락', () => bomAcceptRow(r)); wbAfter(B.open, `${r.no} 묶음 ${r.lines.length}줄을 수락했습니다`); } return; }
    if (['accept', 'acceptrule', 'orig', 'excl', 'edit'].includes(name)) { act(name, key); return; }
    if (name === 'undo') { const l = bomUndo(); wbAfter(WB.cur || '', l ? `되돌렸습니다: ${l}` : '되돌릴 동작이 없습니다'); return; }
    if (name === 'help') { const h = $('wb-help'), on = h.hidden; h.hidden = !on; a.setAttribute('aria-expanded', String(on)); return; }
    if (name === 'secsel') { const c = bomCompute(); c.L.filter(v => v.x.sec && v.x.sec.text === a.dataset.sec).forEach(v => BOM_SEL.add(v.key)); wbPaint({ det: false }); return; }
    if (name === 'unsel') { BOM_SEL.clear(); wbPaint({ det: false }); return; }
    if (name === 'bulk') { const mat = $('bk-mat').value, fin = $('bk-fin').value, mult = +$('bk-mult').value || 1, keys = [...BOM_SEL]; bomDo('일괄 수정', () => bomBulk(keys, { mat, fin, mult })); wbAfter(WB.cur || keys[0], `고른 ${keys.length}줄을 한 번에 고쳤습니다`); return; }
    if (name === 'bulkok') { const keys = [...BOM_SEL]; bomDo('고른 줄 수락', () => bomAcceptLines(keys)); wbAfter(WB.cur || keys[0], `고른 ${keys.length}줄을 수락했습니다`); return; }
    if (name === 'bulkx' || name === 'bulkin') { const keys = [...BOM_SEL], on = name === 'bulkx'; bomDo(on ? '고른 줄 제외' : '고른 줄 제외 풀기', () => bomExclude(keys, on)); wbAfter(WB.cur || keys[0], `고른 ${keys.length}줄을 ${on ? '견적에서 뺐습니다' : '다시 넣었습니다'}`); return; }
    if (name === 'tona') { $('z-c').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); $('h-z-c').focus({ preventScroll: true }); return; }
    if (name === 'toissue') { $('z-d').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); $('wb-issue')?.focus({ preventScroll: true }); return; }
    if (name === 'nacopy') { const m = bomCompute().doc.notAvailable.mail; bomCopy(`${m.subject}\n\n${m.body}`, $('wb-na-msg'), $('wb-na-copy'), `공급 불가 ${bomCompute().doc.notAvailable.lines.length}건을 메일용으로 복사했습니다.`); return; }
    if (name === 'issue') { bomIssue($('wb-issue-msg')); return; }
  });
  view().addEventListener('submit', e => {
    const f = e.target.closest('.wb-ed'); if (!f) return; e.preventDefault();
    const ov = {}; new FormData(f).forEach((v, k) => { if (String(v).trim()) ov[k] = String(v).trim(); });
    const k = f.dataset.k; bomDo('고치기', () => bomSetOv(k, ov)); wbAfter(k, '고친 값으로 다시 맞췄습니다');
  });
  // 키보드 (사양 7.2절): 목록에 초점이 있을 때만, 입력 칸 안에서는 동작하지 않는다
  view().addEventListener('keydown', e => {
    const t = e.target, B = state.bom;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('z-d').scrollIntoView({ block: 'start', behavior: 'auto' }); const b = $('wb-issue'); if (b && !b.disabled) { b.focus(); $('wb-issue-msg').innerHTML = noteSm('info', `Enter를 누르면 Rev ${esc(bomCompute().doc.rev)}를 발행합니다. 취소하려면 Esc 또는 다른 곳을 누르세요.`, '발행'); } return; }
    if (t.closest('.wb-ed') && e.key === 'Escape') { e.preventDefault(); const k = B.open; B.open = null; wbPaint({ list: false }); wbRows().forEach(r => r.classList.remove('on')); if (k) wbFocus(k); return; }
    if (t.id === 'wb-det' && e.key === 'Escape') { const k = B.open; B.open = null; wbPaint({ list: false }); wbRows().forEach(r => r.classList.remove('on')); if (k) wbFocus(k); return; }
    if (!t.closest('#wb-list') || (t.matches('input, textarea, select') && !t.matches('.wb-ck'))) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const rows = wbRows(), row = t.closest('.wb-row'), i = row ? rows.indexOf(row) : -1, key = row?.dataset.k, k = e.key, one = B.keys;
    const go = j => { const r = rows[Math.max(0, Math.min(rows.length - 1, j))]; if (r) wbFocus(r.dataset.k); };
    if (WB.g && (k === 'q' || k === 'Q')) { WB.g = 0; e.preventDefault(); go_('quote'); return; }
    WB.g = 0;
    if (k === 'ArrowDown' || (one && (k === 'j' || k === 'J'))) { e.preventDefault(); go(i + 1); return; }
    if (k === 'ArrowUp' || (one && (k === 'k' || k === 'K'))) { e.preventDefault(); go(i - 1); return; }
    if (k === 'Home') { e.preventDefault(); go(0); return; }
    if (k === 'End') { e.preventDefault(); go(rows.length - 1); return; }
    if (k === 'Enter' && row && !t.closest('button')) { e.preventDefault(); open(key, false); return; }
    if (k === ' ' && row && !t.closest('button, input')) { e.preventDefault(); const c = row.querySelector('.wb-ck'); if (c) c.click(); return; }
    if (k === 'Escape' && B.open) { const kk = B.open; B.open = null; wbPaint({ list: false }); wbRows().forEach(r => r.classList.remove('on')); wbFocus(kk); return; }
    if (!one) return;
    if (k === '?') { e.preventDefault(); const h = $('wb-help'); h.hidden = !h.hidden; return; }
    if (k === '/') { e.preventDefault(); $('wb-q').focus(); return; }
    if (k === 'g' || k === 'G') { WB.g = 1; return; }
    if (k === 'u' || k === 'U') { e.preventDefault(); const l = bomUndo(); wbAfter(key || '', l ? `되돌렸습니다: ${l}` : '되돌릴 동작이 없습니다'); return; }
    if (/^[1-6]$/.test(k)) { e.preventDefault(); const cat = WB_Q[+k - 1][0]; if (B.filter !== 'review') { B.filter = 'review'; bomSave(); wbPaint({ det: false }); } const g = $('wb-g-' + cat); if (g && g.nextElementSibling) wbFocus(g.nextElementSibling.dataset.k); else wbLive(`${WB_Q[+k - 1][1]} 분류에 남은 줄이 없습니다`); return; }
    if (k === 'n' || k === 'N') { e.preventDefault(); const c = bomCompute(), need = c.L.filter(v => v.need).sort((a, b) => WB_QK[a.cat].n - WB_QK[b.cat].n || a.i - b.i); if (!need.length) { wbLive('미해결 줄이 없습니다'); return; } const cur = need.findIndex(v => v.key === key); const nx = need[(cur + 1) % need.length]; if (!document.querySelector(`#wb-list .wb-row[data-k="${CSS.escape(nx.key)}"]`)) { B.filter = 'review'; bomSave(); wbPaint({ det: false }); } wbFocus(nx.key); return; }
    if (!row) return;
    if (k === 'A') { e.preventDefault(); act('acceptrule', key); return; }
    if (k === 'a') { e.preventDefault(); act('accept', key); return; }
    if (k === 'r' || k === 'R') { e.preventDefault(); act('orig', key); return; }
    if (k === 'e' || k === 'E') { e.preventDefault(); act('edit', key); return; }
    if (k === 'x' || k === 'X') { e.preventDefault(); act('excl', key); return; }
  });
  view().addEventListener('keydown', e => { if (e.target.id === 'wb-issue' && e.key === 'Escape') { $('wb-issue-msg').innerHTML = ''; wbFocus(WB.cur || ''); } });
  const go_ = r => go(r);
  wbPaint();
  if (B.open) document.querySelector(`#wb-list .wb-row[data-k="${CSS.escape(B.open)}"]`)?.classList.add('on');
};
