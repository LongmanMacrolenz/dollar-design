#!/usr/bin/env node
/* 견적서 도구 (대표 전용) — 사이트(#quote) 견적서 양식 그대로 PDF·메일 문안·내부 원가표를 만든다.

   사용:  node tools/quote/make_quote.mjs <입력.json> [--out 폴더] [--no-pdf]
   입력:  tools/quote/example.json 을 복사해 채운다 (설명은 tools/quote/README.md).
   로컬:  tools/quote/local.json (git 무시) 에 입금계좌·업태·종목처럼 저장소에 두지 않는 값을 적는다.
   출력:  out/<번호>.pdf (옵션 전체), out/<번호>-<옵션>.pdf (옵션이 둘 이상일 때 옵션별), out/<번호>…_메일.txt,
          out/<번호>_내부원가.txt (고객에게 보내지 않는 원가·이익), out/<번호>.calc.json
   규칙:  AGENTS.md 9번과 같다 — 원 단위 올림, 부가세는 공급가액 합계×10% 반올림 1회(줄 세액은 사이트 bomVatSplit로 배분),
          운임·통관은 단가에 섞지 않고 별도 줄 1회, 고객 문서에 공급처 이름·원가·가산율을 쓰지 않는다.
   PDF는 docs/index.html(빌드 결과)을 헤드리스 브라우저로 열어 사이트 CSS를 그대로 쓰고, 한글 금액·세액 배분은 app/src/e1m_money.js의 함수를 읽어 실행한다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const inputPath = args.find(a => !a.startsWith('--'));
const flag = name => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] || true) : null; };
if (!inputPath) { console.error('사용법: node tools/quote/make_quote.mjs <입력.json> [--out 폴더] [--no-pdf]'); process.exit(2); }
const OUT = path.resolve(flag('--out') || path.join(HERE, 'out'));
const NO_PDF = args.includes('--no-pdf');

// ── 입력 ─────────────────────────────────────────────────────────────────
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const Q = readJson(path.resolve(inputPath));
const LOCAL = fs.existsSync(path.join(HERE, 'local.json')) ? readJson(path.join(HERE, 'local.json')) : {};
const warn = [];
const fail = m => { console.error('입력 오류: ' + m); process.exit(1); };

// 사업자 공개 정보는 사이트 원본(site/page.html의 SHOP·CONTACT)에서 읽는다. 업태·종목·입금계좌는 local.json.
const PAGE = fs.readFileSync(path.join(ROOT, 'site', 'page.html'), 'utf8');
const pv = re => (PAGE.match(re) || [])[1] || '';
const SUP = {
  bizNo: pv(/bizNo: '([^']*)'/), name: '볼트노트', owner: pv(/ownerName: '([^']*)'/),
  tel: pv(/tel: '([^']*)'/), email: pv(/rfq: '([^']*)'/),
  bizType: LOCAL.bizType || '', bizItem: LOCAL.bizItem || '', account: LOCAL.account || '',
  ...(LOCAL.supplier || {}),
};
if (!SUP.account) warn.push('입금계좌가 없습니다 (tools/quote/local.json의 account). 견적서 입금계좌 칸이 비어 나갑니다.');
if (!SUP.bizType || !SUP.bizItem) warn.push('업태·종목이 없습니다 (local.json의 bizType·bizItem). 공급자 표가 비어 나갑니다.');

const NO = Q.number || fail('number(견적번호)가 없습니다');
const REV = Q.rev || 'A';
const ISSUED = Q.issued || new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(ISSUED)) fail('issued는 YYYY-MM-DD 형식입니다');
const koDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${y}. ${m}. ${d}.`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const VALID_DAYS = Q.validDays ?? 14;
const VALID = Q.validUntil || addDays(ISSUED, VALID_DAYS);
const CUST = { name: '', attn: '담당자 귀하', email: '', subject: '', ...(Q.customer || {}) };
if (!CUST.name) fail('customer.name(수신처)이 없습니다');
const P = { marginPct: 25, dutyPct: 0, clearanceFeeKRW: 0, domesticShipKRW: 0, fx: {}, ...(Q.pricing || {}) };
if (!(P.marginPct >= 0 && P.marginPct < 100)) fail('pricing.marginPct는 0 이상 100 미만입니다');
const MARGIN = P.marginPct / 100, DUTY = (P.dutyPct || 0) / 100;
const LEAD = { days: null, maxDays: null, basis: '입금 확인 다음 영업일부터', ...(Q.lead || {}) };
const OPTIONS = Array.isArray(Q.options) && Q.options.length ? Q.options : fail('options가 비었습니다');
const MULTI = OPTIONS.length > 1;

// ── 금액 (사이트와 같은 규칙: 원 단위 올림, 판매가 = 원가 ÷ (1 − 이익률)) ──
const won = n => Math.round(n).toLocaleString('ko-KR') + '원';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sell = cost => Math.ceil(cost / (1 - MARGIN));
const fxOf = cur => { if (cur === 'KRW') return 1; const r = P.fx && P.fx[cur]; if (!(r > 0)) fail(`pricing.fx.${cur} 환율이 없습니다`); return r; };

for (const o of OPTIONS) {
  if (!o.key) fail('options[].key(예: "A")가 없습니다');
  if (!Array.isArray(o.lines) || !o.lines.length) fail(`옵션 ${o.key}의 lines가 비었습니다`);
  o.rows = o.lines.map((l, i) => {
    const b = { pack: 1, currency: 'KRW', ...(l.buy || {}) };
    if (!(l.qty > 0)) fail(`옵션 ${o.key} ${i + 1}번 줄의 qty`);
    if (!(b.pack > 0) || !(b.price >= 0)) fail(`옵션 ${o.key} ${i + 1}번 줄의 buy.pack·buy.price`);
    const packs = Math.ceil(l.qty / b.pack), buy = packs * b.pack;
    const goods = Math.round(b.price * packs * fxOf(b.currency));
    const duty = b.currency === 'KRW' ? 0 : Math.round(goods * DUTY);
    const cost = goods + duty;
    const unitPrice = Math.ceil(sell(cost) / l.qty);   // l.unit 은 단위(EA), unitPrice 는 단가
    return { ...l, unit: l.unit || 'EA', buy: b, packs, buyQty: buy, goods, duty, cost, unitPrice, amount: unitPrice * l.qty };
  });
}
// 운임·통관 줄 (선택). 해외 운송비(외화)·관세·통관수수료·국내 배송을 원가로 모아 1회 판매가로 만든다.
let SHIP = null;
if (Q.shipping) {
  const s = Q.shipping, f = s.foreign;
  const foreignKRW = f ? Math.round(f.amount * fxOf(f.currency || 'USD')) : 0;
  const duty = f ? Math.round(foreignKRW * DUTY) : 0;
  const cost = foreignKRW + duty + (P.clearanceFeeKRW || 0) + (P.domesticShipKRW || 0) + (s.krw || 0);
  SHIP = { label: s.label || '운임·통관 (해외 운송, 관세·통관수수료, 국내 배송 포함 · 1회)', remark: s.remark || '일부만 주문해도 1회 부과', foreignKRW, duty, cost, sellKRW: sell(cost) };
}
function totals(keys) {
  const rows = keys.flatMap(k => OPTIONS.find(o => o.key === k).rows);
  const sub = rows.reduce((a, r) => a + r.amount, 0);
  const supply = sub + (SHIP ? SHIP.sellKRW : 0), vat = Math.round(supply * 0.1);   // bomVatTotal과 같은 식
  const cost = rows.reduce((a, r) => a + r.cost, 0) + (SHIP ? SHIP.cost : 0);
  return { keys, sub, supply, vat, total: supply + vat, cost, profit: supply - cost, amounts: [...rows.map(r => r.amount), ...(SHIP ? [SHIP.sellKRW] : [])] };
}
const ALL = OPTIONS.map(o => o.key);
const T = Object.fromEntries([...ALL.map(k => [k, totals([k])]), ['ALL', totals(ALL)]]);
const variants = MULTI ? [['ALL', ALL, NO], ...ALL.map(k => [k, [k], `${NO}-${k}`])] : [['ALL', ALL, NO]];

// 한글 금액(wonKo)·줄 세액 배분(bomVatSplit)은 사이트 원본 app/src/e1m_money.js에서 함수 본문을 읽어 그대로 실행한다 (복사본을 두지 않아 어긋나지 않음).
const MONEY_SRC = fs.readFileSync(path.join(ROOT, 'app', 'src', 'e1m_money.js'), 'utf8');
function siteFn(name) {
  const start = MONEY_SRC.indexOf(`function ${name}(`);
  if (start < 0) fail(`app/src/e1m_money.js에서 ${name}를 찾지 못했습니다`);
  let i = MONEY_SRC.indexOf('{', start), depth = 0;
  for (; i < MONEY_SRC.length; i++) { if (MONEY_SRC[i] === '{') depth++; else if (MONEY_SRC[i] === '}' && --depth === 0) break; }
  const consts = (MONEY_SRC.match(/^const KO_D = .*$/m) || [''])[0];
  return new Function(`${consts}\n${MONEY_SRC.slice(start, i + 1)}\nreturn ${name};`)();
}
const wonKo = siteFn('wonKo'), bomVatSplit = siteFn('bomVatSplit');
if (wonKo(129800) !== '일십이만구천팔백원' || bomVatSplit([100, 200], 30).join() !== '10,20') fail('사이트 금액 함수 자체 점검 실패');

// ── 문서 조각 (클래스는 app/src/v3_quote.js의 #quote 양식과 같다) ─────────────
const th13 = '<th>순번</th><th>품명</th><th>규격</th><th>재질·강도</th><th>표면처리</th><th>적용규격</th><th>원산지(제조사)</th><th>단위</th><th class="r">수량</th><th class="r">단가</th><th class="r">공급가액</th><th class="r">세액</th><th>비고</th>';
const colg = '<colgroup><col class="w6"><col class="w8"><col class="w11"><col class="w10"><col class="w8"><col class="w7"><col class="w7"><col class="w4"><col class="w7"><col class="w6"><col class="w7"><col class="w6"><col class="w13"></colgroup>';
const leadText = () => LEAD.days ? `${LEAD.basis} ${LEAD.days}영업일${LEAD.maxDays ? ` (통관·운송 지연 시 최대 ${LEAD.maxDays}영업일)` : ''}` : '견적서 회신 때 확정';

function optSection(o, no, vats) {
  const c = T[o.key];
  const rows = o.rows.map((r, i) => `<tr><td class="mono qd-no" data-l="순번">${MULTI ? `${o.key}-${i + 1}` : i + 1}</td><td class="wide" data-l="품명"><b>${esc(r.name)}</b>${r.nameEn ? `<span class="qd-nm-en"> / ${esc(r.nameEn)}</span>` : ''}</td><td class="mono" data-l="규격">${esc(r.spec)}</td><td data-l="재질·강도">${esc(r.mat || o.mat || '')}</td><td data-l="표면처리">${esc(r.fin || o.fin || '')}</td><td data-l="적용규격">${esc(r.std || '')}</td><td class="qd-mk" data-l="원산지(제조사)">${esc(r.origin || '발주 후 통보').replace(' ', '<br>')}</td><td data-l="단위">${esc(r.unit)}</td><td class="r num" data-l="수량">${r.qty} ${esc(r.unit)}</td><td class="r num" data-l="단가">${won(r.unitPrice)}</td><td class="r num" data-l="공급가액"><b>${won(r.amount)}</b></td><td class="r num" data-l="세액">${won(vats[i])}</td><td class="qd-rm wide" data-l="비고">${r.note ? `<span class="sub">${esc(r.note)}</span>` : ''}${LEAD.days ? `<span class="sub">납기 ${esc(LEAD.basis)} ${LEAD.days}영업일</span>` : ''}</td></tr>`).join('');
  const ship = SHIP ? `<tr class="qd-ship"><td class="mono" data-l="순번">—</td><td data-l="품명" colspan="6">${esc(SHIP.label)}</td><td data-l="단위">식</td><td class="r num" data-l="수량">1</td><td class="r num" data-l="단가">${won(SHIP.sellKRW)}</td><td class="r num" data-l="공급가액"><b>${won(SHIP.sellKRW)}</b></td><td class="r num" data-l="세액">${won(vats[vats.length - 1])}</td><td class="qd-rm wide" data-l="비고"><span class="sub">${esc(SHIP.remark)}</span></td></tr>` : '';
  const title = MULTI ? `${no}. ${esc(o.title || '옵션 ' + o.key)}` : '견적 내역';
  return `<section class="qd-sec qd-opt"><h3>${title} <small>${o.rows.length}종 · 단가 VAT 별도${SHIP ? ' · 운임·통관 별도 줄' : ''}</small></h3><div class="tblw qd-tw"><table class="tbl mstack qd-t qd-t1">${colg}<thead><tr>${th13}</tr></thead><tbody>${rows}${ship}<tr class="qd-end"><td colspan="13">- 이하 여백 -</td></tr></tbody></table></div>
  <table class="qd-money"><tbody><tr><th scope="row">공급가액 합계${SHIP ? ' (운임·통관 포함)' : ''}</th><td class="num">${won(c.supply)}</td></tr><tr><th scope="row">부가가치세 (10%)</th><td class="num">${won(c.vat)}</td></tr><tr class="grand"><th scope="row">합계${MULTI ? ` (옵션 ${o.key})` : ''}</th><td class="num">${won(c.total)}</td></tr></tbody></table></section>`;
}
const band = (o, ko) => `<div class="qd-band"><span class="lab">${MULTI ? esc(o.title || '옵션 ' + o.key) + ' · ' : ''}합계금액 (부가가치세 포함)</span><b class="ko-amt">일금 ${esc(ko)}정</b><span class="mono">(₩${T[o.key].total.toLocaleString('ko-KR')})</span></div>`;

function notesFor(keys) {
  const n = [...(Q.notes || [])];
  if (Q.autoNotes !== false) {
    if (SHIP) n.push('운임·통관 줄에는 해외 운송비, 관세·통관수수료, 국내 배송비가 들어 있으며 단가에는 넣지 않았습니다. ' + (keys.length > 1 ? '옵션을 함께 주문하시거나 일부 품목만 주문하셔도 이 줄은 1회만 부과합니다.' : '일부 품목만 주문하셔도 이 줄은 1회 부과합니다.') + ' 단가는 이 줄을 제외한 금액입니다.');
    if (keys.length > 1) n.push(`옵션을 모두 함께 주문하시는 경우: 공급가액 ${won(T.ALL.supply)} · 부가세 ${won(T.ALL.vat)} · 합계 ${won(T.ALL.total)}${SHIP ? ' (운임·통관 1회 포함)' : ''}.`);
    n.push(`납기: ${leadText()}.`);
    n.push('서류: 별도 요청이 없어 제조사 성적서는 포함하지 않았습니다. 필요하시면 알려 주세요. 제공 가능 여부를 확인해 안내드립니다.');
    n.push('단가는 부가가치세 별도입니다. 수량이 바뀌면 단가를 다시 협의합니다.');
  }
  return n;
}
const sup = () => `<table class="qd-sup "><colgroup><col class="k0"><col class="k1"><col><col class="k1"><col></colgroup><tbody>
  <tr><th rowspan="5" class="qd-vl" scope="rowgroup"><span aria-hidden="true">공<br>급<br>자</span><span class="sr">공급자</span></th><th scope="row">등록번호</th><td colspan="3" class="mono">${esc(SUP.bizNo)}</td></tr>
  <tr><th scope="row">상호</th><td>${esc(SUP.name)}</td><th scope="row">성명</th><td class="qd-sign">${esc(SUP.owner)} <span class="qd-seal" role="img" aria-label="직인 자리">(인)</span></td></tr>
  <tr><th scope="row">업태</th><td>${esc(SUP.bizType)}</td><th scope="row">종목</th><td>${esc(SUP.bizItem)}</td></tr>
  <tr><th scope="row">전화</th><td colspan="3" class="mono">${esc(SUP.tel)}</td></tr>
  <tr><th scope="row">전자우편</th><td colspan="3" class="mono">${esc(SUP.email)}</td></tr></tbody></table>`;

function articleFor(keys, no, calc) {
  const opts = keys.map(k => OPTIONS.find(o => o.key === k));
  const dft = {
    '납품기한': leadText(), '납품장소': '귀사 지정 장소',
    '대금 지급 조건': '계좌이체. 처음 거래: 발주 확인 후 선입금(입금 확인 시 출고, 입금 시 세금계산서 발행)', '증빙': '계좌이체: 전자세금계산서',
    '유효기간': `${koDate(VALID)}까지 (견적일로부터 ${VALID_DAYS}일)`, '운송조건': SHIP ? 'DAP 지정 장소 · 택배 (운임은 견적서의 운임·통관 줄에 포함)' : 'DAP 지정 장소 · 택배',
  };
  const terms = Object.entries({ ...dft, ...(Q.terms || {}) });
  const revs = Q.revisions || [{ rev: REV, date: ISSUED, desc: '최초 발행 / First issue' }];
  return `<article class="qd-doc qd-pg-quote qd-p" id="qd-quote" aria-labelledby="qd-h">
  <header class="qd-hd"><dl class="qd-meta"><dt>견적번호</dt><dd class="mono">${esc(no)} Rev ${esc(REV)}</dd><dt>견적일자</dt><dd>${koDate(ISSUED)}</dd><dt>구분</dt><dd>정식 견적 · 검토 ${esc(SUP.owner)}</dd></dl>
    <h2 id="qd-h" class="qd-title">견 적 서<span>QUOTATION</span></h2></header>
  <div class="qd-two">
    <div class="qd-to"><dl><dt>수신</dt><dd>${esc(CUST.name)} 귀중</dd><dt>참조</dt><dd>${esc(CUST.attn)}</dd><dt>건명</dt><dd>${esc(CUST.subject)}${MULTI ? ` (${keys.length > 1 ? '옵션 ' + keys.join('·') : '옵션 ' + keys[0]})` : ''}</dd><dt>유효기간</dt><dd>${koDate(VALID)}까지</dd></dl>
      <p class="qd-greet">아래와 같이 견적합니다.</p></div>
    ${sup()}
  </div>
  ${opts.map(o => band(o, calc[o.key].ko)).join('')}
  <table class="qd-terms"><tbody>${terms.filter((_, i) => i % 2 === 0).map((_, j) => { const a = terms[2 * j], b = terms[2 * j + 1]; return `<tr><th scope="row">${esc(a[0])}</th><td>${esc(a[1])}</td>${b ? `<th scope="row">${esc(b[0])}</th><td>${esc(b[1])}</td>` : '<th></th><td></td>'}</tr>`; }).join('')}</tbody></table>
  ${opts.map((o, i) => optSection(o, i + 1, calc[o.key].vats)).join('')}
  ${keys.length > 1 ? `<p class="qd-ref">옵션을 모두 함께 주문하시는 경우${SHIP ? ' (운임·통관 1회)' : ''}: 공급가액 ${won(T.ALL.supply)} · 부가세 ${won(T.ALL.vat)} · 합계 ${won(T.ALL.total)}</p>` : ''}
  <section class="qd-sec qd-notes"><h3>특기사항</h3><ol>${notesFor(keys).map(n => `<li><span>${esc(n)}</span></li>`).join('')}</ol></section>
  <dl class="qd-foot"><dt>입금계좌</dt><dd>${esc(SUP.account)}</dd><dt>담당자</dt><dd>${esc(SUP.owner)} · ${esc(SUP.tel)}</dd></dl>
  <table class="qd-rev"><caption>개정 이력 Revision History</caption><thead><tr><th>Rev</th><th>날짜 Date</th><th>내용 Description</th><th>작성 By</th><th>검토 Chk'd</th></tr></thead><tbody>${revs.map(r => `<tr><td class="mono">${esc(r.rev)}</td><td class="mono">${esc(r.date)}</td><td>${esc(r.desc)}</td><td>${esc(SUP.owner)}</td><td>${esc(SUP.owner)}</td></tr>`).join('')}</tbody></table>
  <p class="qd-line">${esc(SUP.name)} · 사업자등록번호 ${esc(SUP.bizNo)}</p>
</article>`;
}
const FONT = path.join(ROOT, 'worker', 'assets', 'GothicA1-Regular.ttf');
const pageCss = no => `@page qdq { size: A4 portrait; margin: 12mm 12mm 14mm; @bottom-left { content: "${no} Rev ${REV} · 견적서"; font-size: 7.5pt; } @bottom-right { content: counter(page) " / " counter(pages); font-size: 7.5pt; } } .qd-pg-quote { page: qdq; }
@font-face { font-family: 'Gothic A1'; src: url('file://${FONT}'); font-weight: 100 900; }
@media print {
  .qd-t1:not(.unp) col:nth-child(1) { width: 5%; } .qd-t1:not(.unp) col:nth-child(2) { width: 11%; } .qd-t1:not(.unp) col:nth-child(3) { width: 8%; } .qd-t1:not(.unp) col:nth-child(4) { width: 9%; }
  .qd-t1:not(.unp) col:nth-child(5) { width: 8%; } .qd-t1:not(.unp) col:nth-child(6) { width: 9%; } .qd-t1:not(.unp) col:nth-child(7) { width: 7%; } .qd-t1:not(.unp) col:nth-child(8) { width: 4%; }
  .qd-t1:not(.unp) col:nth-child(9) { width: 6%; } .qd-t1:not(.unp) col:nth-child(10) { width: 9%; } .qd-t1:not(.unp) col:nth-child(11) { width: 9%; } .qd-t1:not(.unp) col:nth-child(12) { width: 7%; } .qd-t1:not(.unp) col:nth-child(13) { width: 8%; }
  .qd-t td.num, .qd-t1 td:nth-child(8), .qd-t1 td.qd-no { white-space: nowrap !important; }
  .qd-t1 td.qd-no { font-size: 9pt !important; }
  .qd-t1 td.qd-mk { white-space: normal; font-size: 6.5pt !important; }
  .qd-t1 td.num { font-size: 6.5pt; }
  .qd-sup col.k0 { width: 5%; } .qd-sup col.k1 { width: 19%; } .qd-sup th { white-space: nowrap; font-size: 7pt; padding-left: 2px; padding-right: 2px; } .qd-sup td { overflow-wrap: anywhere; }
  .qd-band { padding: 4px 10px; } .qd-doc { gap: 7px; }
  .qd-money th, .qd-money td { padding-top: 2px; padding-bottom: 2px; }
  .qd-t tr { break-inside: avoid; }
  .qd-opt { break-inside: avoid; }
}
body, .qd-doc, .qd-doc * { font-family: 'Gothic A1', 'Noto Sans KR', sans-serif !important; } .mono, .mono * { font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, 'Gothic A1', monospace !important; }`;

// ── 메일 문안 ─────────────────────────────────────────────────────────────
function mailFor(keys, no) {
  const opts = keys.map(k => OPTIONS.find(o => o.key === k));
  const block = o => { const c = T[o.key]; return [MULTI ? `■ ${o.title || '옵션 ' + o.key}` : '■ 견적 내역',
    ...o.rows.map(r => `- ${r.spec} ${r.qty}${r.unit}${r.note ? ` (${r.note})` : ''}: 단가 ${won(r.unitPrice)} / 금액 ${won(r.amount)}`),
    ...(SHIP ? [`- ${SHIP.label}: ${won(SHIP.sellKRW)}`] : []),
    `- 공급가액 ${won(c.supply)} + 부가세 ${won(c.vat)} = 합계 ${won(c.total)}`].join('\n'); };
  const M = Q.mail || {};
  const lines = [
    `받는 사람: ${CUST.email || '(고객 이메일)'}`, `첨부: ${no}.pdf`, '', '[제목]', `[${no}] ${CUST.name}님 견적서 — ${CUST.subject}`, '', '[본문]',
    `안녕하세요, ${CUST.name} ${CUST.attn.replace(/ 귀하$/, '')}님.`, `${SUP.name} ${SUP.owner}입니다. 견적 문의 감사합니다.`, '',
    ...(M.intro ? [M.intro, ''] : []),
    opts.map(block).join('\n\n'), '',
    ...(SHIP ? [`※ 운임·통관 줄은 단가와 별도이며 1회만 부과합니다. ${keys.length > 1 ? '옵션을 함께 주문하시거나 일부 품목만 주문하셔도 같습니다.' : '일부 품목만 주문하셔도 같습니다.'}`] : []),
    ...(keys.length > 1 ? [`※ 옵션을 모두 함께 주문하시는 경우: 공급가액 ${won(T.ALL.supply)} + 부가세 ${won(T.ALL.vat)} = 합계 ${won(T.ALL.total)}`] : []),
    ...(M.extra ? ['', ...[].concat(M.extra)] : []), '',
    `납기는 ${leadText()}입니다.`, `견적 유효기간은 ${koDate(VALID)}까지입니다.`,
    M.payment || '처음 거래라 발주 확인 후 선입금으로 진행하며, 입금 확인 후 출고하고 전자세금계산서를 발행합니다. 입금 계좌는 첨부 견적서에 있습니다.', '',
    keys.length > 1 ? '옵션을 선택해 회신해 주시면 발주를 확인해 드리겠습니다.' : '확인해 주시면 발주를 확인해 드리겠습니다.',
    '볼트노트를 어떻게 알게 되셨는지 한 줄 알려 주시면 안내에 참고하겠습니다.', '감사합니다.', '',
    `${SUP.name} · ${SUP.owner}`, `사업자등록번호 ${SUP.bizNo}`, SUP.email, SUP.tel,
  ];
  return lines.join('\n') + '\n';
}

// ── 내부 원가표 (고객에게 보내지 않는다) ──────────────────────────────────
function internalSheet() {
  const L = ['※ 내부용입니다. 고객에게 보내지 마세요. 저장소에도 올리지 마세요 (out/ 폴더는 git 무시).',
    `견적 ${NO} Rev ${REV} · 이익률 ${P.marginPct}% (공급가액 기준, 판매가 = 원가 ÷ ${(1 - MARGIN).toFixed(2)}) · 환율 ${Object.entries(P.fx || {}).map(([c, r]) => `1${c}=${r}원`).join(', ') || '없음'}`,
    `관세 ${P.dutyPct || 0}% · 통관·정산 수수료 ${won(P.clearanceFeeKRW || 0)} · 국내 배송 ${won(P.domesticShipKRW || 0)} · 수입 부가세는 매입세액 공제라 원가에서 제외`, ''];
  if (SHIP) L.push(`운임·통관 줄 원가 = 해외 운송 ${won(SHIP.foreignKRW)} + 관세 ${won(SHIP.duty)} + 수수료 ${won(P.clearanceFeeKRW || 0)} + 국내 ${won(P.domesticShipKRW || 0)}${Q.shipping.krw ? ` + 기타 ${won(Q.shipping.krw)}` : ''} = ${won(SHIP.cost)} → 줄 판매가 ${won(SHIP.sellKRW)}`, '');
  for (const o of OPTIONS) {
    o.rows.forEach((r, i) => L.push(`${MULTI ? o.key + '-' : ''}${i + 1} ${r.spec} ${r.qty}${r.unit} | 매입 ${r.buyQty}${r.unit}(${r.packs}×${r.buy.pack}, ${r.buy.price} ${r.buy.currency}/팩) = ${won(r.goods)} + 관세 ${won(r.duty)} = ${won(r.cost)} | 단가 ${won(r.unitPrice)} × ${r.qty} = ${won(r.amount)} | 남는 수량 ${r.buyQty - r.qty}`));
    const c = T[o.key]; L.push(`→ ${MULTI ? '옵션 ' + o.key + '만' : '합계'}: 공급가액 ${won(c.supply)} − 원가 ${won(c.cost)} = 이익 ${won(c.profit)} (${c.supply ? (c.profit / c.supply * 100).toFixed(1) : 0}%) · 고객 입금액 ${won(c.total)}`, '');
  }
  if (MULTI) { const c = T.ALL; L.push(`→ 옵션 모두: 공급가액 ${won(c.supply)} − 원가 ${won(c.cost)} = 이익 ${won(c.profit)} (${(c.profit / c.supply * 100).toFixed(1)}%) · 고객 입금액 ${won(c.total)}`); }
  L.push('', '미반영 비용: 카드 해외결제 수수료, 입고검사 시간, 남는 수량 재고. 관세·수수료가 가정과 다르면 입력 JSON의 pricing만 바꿔 다시 만듭니다.');
  if (warn.length) L.push('', ...warn.map(w => '경고: ' + w));
  return L.join('\n');
}

// ── 실행 ────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });
for (const [, keys, no] of variants) fs.writeFileSync(path.join(OUT, `${no}_메일.txt`), mailFor(keys, no));
const sheet = internalSheet();   // 입력 단계 경고까지 포함
fs.writeFileSync(path.join(OUT, `${NO}_내부원가.txt`), sheet);
fs.writeFileSync(path.join(OUT, `${NO}.calc.json`), JSON.stringify({ number: NO, rev: REV, issued: ISSUED, validUntil: VALID, totals: T, ship: SHIP, options: OPTIONS.map(o => ({ key: o.key, rows: o.rows })) }, null, 1));
console.log(sheet);
const warnAtSheet = warn.length;

if (!NO_PDF) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch();
  for (const [v, keys, no] of variants) {
    const pg = await b.newPage({ viewport: { width: 1000, height: 1400 } });
    await pg.goto('file://' + path.join(ROOT, 'docs', 'index.html') + '#quote');
    await pg.waitForFunction(() => document.querySelector('.qd-doc-w') || document.querySelector('#qd-quote'), null, { timeout: 20000 }).catch(() => fail('docs/index.html에서 견적서 영역(.qd-doc-w)을 찾지 못했습니다. python3 tools/build_all.py 로 먼저 빌드하세요'));
    const calc = Object.fromEntries(keys.map(k => [k, { vats: bomVatSplit(T[k].amounts, T[k].vat), ko: wonKo(T[k].total) }]));
    const ok = await pg.evaluate(({ article, css }) => {
      const w = document.querySelector('.qd-doc-w') || document.querySelector('#qd-quote')?.parentElement; if (!w) return false;
      w.innerHTML = article; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); return true;
    }, { article: articleFor(keys, no, calc), css: pageCss(no) });
    if (!ok) fail('견적서 영역을 바꾸지 못했습니다');
    await pg.emulateMedia({ media: 'print' }); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
    const scale = (Q.pdf || {})[v === 'ALL' ? 'scale' : 'singleScale'] ?? (v === 'ALL' && MULTI ? 0.9 : 0.8);
    await pg.pdf({ path: path.join(OUT, `${no}.pdf`), preferCSSPageSize: true, printBackground: true, scale });
    await pg.close();
    console.log(`PDF ${no}.pdf (scale ${scale})`);
  }
  await b.close();
}
for (const w of new Set(warn.slice(warnAtSheet))) console.warn('경고: ' + w);   // PDF 단계에서 생긴 경고만 (입력 경고는 위 원가표에 있음)
console.log(`출력 폴더: ${OUT}`);
