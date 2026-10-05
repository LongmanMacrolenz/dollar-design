/* ── 견적 요청 통로 Phase 1 (b2b_site_changes.json "channel") ──
   이 페이지는 아무것도 서버로 보내지 않는다: 폼 전송·네트워크 호출 없음, 로그인 없음, 결제창 없음.
   하는 일 세 가지: ① 요청서·발주서 문서를 만들고 ② 파일(엑셀·JSON, 인쇄 PDF)로 내려 주고 ③ 고객의 메일·카카오톡·팩스를 열거나 주소를 보여 준다.
   전송은 고객이 직접 한다. 연락처는 CONTACT(e1_data.js) 한 곳: 빈 값이면 .ph 자리표시만 보이고, 그 값에 기대는 버튼은 disabled.
   mailto·href는 값이 형식에 맞을 때만 만든다. 가짜 접수 주소, 보내지 않았는데 보냈다고 하는 문구, 예시 주소로 가는 링크는 만들지 않는다.
   쓰는 곳: 7장 견적함 #ask(견적 요청서 Q-) · #order(발주서 BO-) · 4장 요청서 제출(Q-) · 4A-1 '정식 견적 요청 보내기'(BQ- Rev, v3/v4).
   이 브라우저에는 마지막 요청번호와 생성 시각만 남긴다(bn.rfq.last). 이름·이메일 같은 입력값은 저장하지 않는다. */
const RFQ_PH = { rfq: '견적 메일 주소', tel: '000-0000-0000', fax: '0505-000-0000', kakaoChat: '카카오톡 채널 채팅 URL' };
const RFQ_UNSET = '운영 정보 등록 후 사용';
// 통신판매업 신고 전(ORDER_LIVE false): 견적함의 BO 문서는 '발주서'가 아니라 '주문 요청서 (확인 후 진행)'. 화면·파일·메일 제목 모두 (IA 명세 11.7)
const RFQ_BO_W = [['[발주]', '[주문요청]'], ['발주서 번호', '요청번호'], ['발주 확인서', '확인 메일'], ['발주처 상호', '상호'], ['발주처', '요청처'], ['발주일', '요청일'], ['발주 정보', '주문 요청 정보'],
  ['발주 담당자', '주문 담당자'], ['발주 문의드립니다', '주문 요청드립니다'], ['발주번호', '요청번호'], ['발주서', '주문 요청서']];
const rfqBoW = s => (ORDER_LIVE || typeof s !== 'string' ? s : RFQ_BO_W.reduce((a, [f, t]) => a.split(f).join(t), s));
const RFQ_URL_MAX = 2000;   // mailto 전체 길이 목표 (메일 프로그램별 한도는 미확인이라 보수적으로)
// 값이 형식에 맞을 때만 '설정됨'. 예시 주소는 설정으로 보지 않는다
function rfqOk(k) {
  const v = String(CONTACT[k] || '').trim(); if (!v) return false;
  if (k === 'rfq') return /^[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[A-Za-z]{2,}$/.test(v) && !/@example\./i.test(v);
  if (k === 'kakaoChat') return /^https:\/\/pf\.kakao\.com\/_[A-Za-z0-9]+(\/chat)?$/.test(v);
  return /^[0-9][0-9\- ]{6,}[0-9]$/.test(v);
}
// 연락처 한 칸: 값이 있으면 값(카카오는 새 창 링크, 전화는 link:true일 때 tel:), 없으면 형광 자리표시
function rfqC(k, o = {}) {
  const id = o.id ? ` id="${o.id}"` : '';
  if (k === 'kakaoChat' && !rfqOk(k) && CONTACT.kakaoName) return `<span${id} data-contact="kakaoChat">${esc(CONTACT.kakaoName)} <span class="small muted">(채널 공개 준비 중)</span></span>`;
  if (!rfqOk(k)) return `<span class="ph${k === 'kakaoChat' ? '' : ' mono'}"${id} data-contact="${k}">${RFQ_PH[k]}</span>`;
  const v = String(CONTACT[k]).trim();
  if (k === 'kakaoChat') return `<a${id} href="${esc(v)}" target="_blank" rel="noopener">${o.label || '볼트노트 채널 1:1 채팅'}</a>`;
  if (k === 'tel' && o.link) return `<a class="mono"${id} href="tel:${esc(v.replace(/[^0-9]/g, ''))}">${esc(v)}</a>`;
  return `<span class="mono"${id}>${esc(v)}</span>`;
}
// 바닥글은 정적 마크업: 값이 정해졌으면 여기서 자리표시를 바꿔 끼운다
document.querySelectorAll('footer [data-contact]').forEach(el => { const k = el.dataset.contact; if (rfqOk(k) || (k === 'kakaoChat' && CONTACT.kakaoName)) el.outerHTML = rfqC(k, { link: true }) + (k === 'tel' && rfqOk(k) ? ` <span class="small">(${esc(SLA().tel)})</span>` : ''); });

// 요청번호 (날짜는 KST): Q-YYMMDD-XXXX 요청 · BO-YYMMDD-XXXX 발주. 끝 4자리는 헷갈리는 글자(0 O 1 I L)를 뺀 31자 중 무작위
// (하루 31⁴ ≈ 92만 가지: 하루 10건이면 겹칠 확률 약 0.005 %). 내려받은 뒤 내용이 바뀌면 같은 번호에 -R1, -R2 …를 붙인다 (rfqCartPaint)
const RFQ_NO_CH = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function rfqNo(kind) {
  const d = kstNow(), p = n => String(n).padStart(2, '0');
  let r = new Uint32Array(4); try { crypto.getRandomValues(r); } catch { r = r.map(() => Math.floor(Math.random() * 1e9)); }
  const no = `${kind}-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${[...r].map(x => RFQ_NO_CH[x % RFQ_NO_CH.length]).join('')}`;
  store.set('rfq.last', { no, t: new Date().toISOString() });   // 번호와 생성 시각만 (try/catch는 store 안)
  return no;
}
const rfqToday = () => ymd(kstNow());

/* ── 메일 (RFC 6068): 제목·본문은 encodeURIComponent (공백 %20, 줄바꿈 %0D%0A). 첨부는 메일 링크로 붙지 않는다 ── */
function rfqMail(pkg) {
  const w = pkg.who || {}, bo = pkg.kind === 'BO', cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  // 상호가 비었을 때: 발주서는 고른 구분대로 ('(상호 미기재 사업자)'), 요청서는 개인
  const coOf = () => w.co || (bo && pkg.ctype && pkg.ctype !== 'ind' ? `(상호 미기재 ${RFQ_CTYPE[pkg.ctype]})` : '개인');
  const subj = rfqBoW(`${bo ? '[발주]' : '[견적요청]'} ${pkg.no} ${cut(coOf(), 40)} · ${pkg.nLabel}`);
  const terms = [pkg.due && `희망 납기: ${pkg.due}`, pkg.area && `${bo ? '납품지' : '납품 지역'}: ${pkg.area}`, pkg.pay && `대금: ${pkg.pay}`].filter(Boolean);
  // short 0 = 전체, 1 = 줄 내용·파일 이름을 빼고 '첨부 파일 참조', 2 = 요청처도 회사·이름만 (2,000자를 넘을 때)
  const make = short => [
    bo ? '볼트노트 발주 담당자님께' : '볼트노트 견적 담당자님께',
    `${bo ? '발주서 번호' : '요청번호'}: ${pkg.no} (${pkg.date})`,
    `${bo ? '발주처' : '요청처'}: ${(short > 1 ? [coOf(), w.name] : [coOf(), w.name, w.mail, w.tel]).filter(Boolean).map(s => cut(s, short > 1 ? 40 : 120)).join(' / ')}`,
    short ? '내용은 첨부 파일 참조' : `내용: ${pkg.content}`,
    pkg.total == null ? '' : bo ? `합계(VAT 포함${pkg.freight ? ', 운임 별도' : ''}): ${pkg.words}` : `자동 견적 합계(참고, VAT 포함${pkg.freight ? ', 운임 별도' : ''}): ${won(pkg.total)}`,
    short > 1 ? terms.map(s => cut(s, 60)).join(' / ') : terms.join(' / '),
    ...(short ? [] : pkg.extra || []),
    `첨부해 주세요: ${pkg.attach}${!short && pkg.files && pkg.files.length ? ` (선택한 파일: ${pkg.files.join(', ')})` : ''}`,
    '메일 링크로는 파일이 붙지 않으니 직접 첨부 부탁드립니다.',
  ].filter(Boolean).map(x => bo ? rfqBoW(x) : x);
  const lines = make(0), build = ls => 'mailto:' + String(CONTACT.rfq).trim() + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(ls.join('\r\n'));
  let url = null;
  if (rfqOk('rfq')) { url = build(lines); for (let s = 1; url.length > RFQ_URL_MAX && s <= 2; s++) url = build(make(s)); }
  return { subj, body: lines.join('\n'), lines, url };
}

/* ── 보낼 방법 칸 #rfq-send (문서 바로 아래에 펼침, 모달 아님). 한 화면에 하나 ── */
let rfqCur = null;
function rfqSheetHTML(pkg) {
  rfqCur = pkg;
  const m = rfqMail(pkg), bo = pkg.kind === 'BO', what = bo ? ORDER_DOC() : '요청서', dis = ` disabled title="${RFQ_UNSET}"`;
  // claude.ai 미러(iframe)에서는 메일 링크·인쇄가 되는지 확인하지 못했다: 메일 버튼을 숨기고 본문 복사만 둔다
  const mail = !QD_CANPRINT ? '<span class="small rs-mirror">메일은 공개 사이트에서 보내 주세요. 여기서는 본문만 복사할 수 있습니다.</span>'
    : m.url ? `<a class="btn sm pri" id="rs-mail" href="${esc(m.url)}" data-rs="mail">메일로 보내기</a>` : `<button class="btn sm" type="button" id="rs-mail"${dis}>메일로 보내기</button>`;
  const addr = QD_CANPRINT ? `<button class="btn sm" type="button" id="rs-copy-addr" data-rs="addr"${rfqOk('rfq') ? '' : dis}>주소 복사</button>` : '';
  const pdf = pkg.printable && QD_CANPRINT ? '<button class="btn sm" type="button" id="rs-pdf" data-rs="pdf">PDF로 저장 (인쇄)</button>' : '<span class="small muted">인쇄는 공개 사이트에서 됩니다.</span>';
  const kakao = rfqOk('kakaoChat') ? `<a class="btn sm" id="rs-kakao" href="${esc(String(CONTACT.kakaoChat).trim())}" target="_blank" rel="noopener">카카오톡으로 문의</a>` : rfqC('kakaoChat');
  return (bo ? rfqBoW : (s => s))(`<section id="rfq-send" class="tblock rfq-send" role="region" aria-labelledby="rfq-send-h">${bo ? `<div class="s4 e rs-h"><h3>${ORDER_LIVE ? '발주서 보내기' : '주문 요청서 보내기 (확인 후 진행)'}</h3></div>` : ''}
  <div class="s4 e rs-h"><h3 id="rfq-send-h" tabindex="-1">보낼 방법을 고르세요 <span class="mono rs-no">${esc(pkg.no)}</span></h3><p>이 페이지는 입력하신 내용을 서버로 보내지 않습니다. 아래 방법 가운데 하나로 직접 보내 주세요. 메일로 보내실 때는 1번에서 받은 파일과 도면을 첨부해 주세요(메일 링크로는 파일이 붙지 않습니다).</p></div>
  <div class="s4 e"><span class="lab">1 · ${what} 내려받기</span><div class="rs-btns"><button class="btn sm" type="button" id="rs-xlsx" data-rs="xlsx">${what} 내려받기 (엑셀)</button><button class="btn sm" type="button" id="rs-json" data-rs="json">JSON 내려받기</button>${pdf}</div><span class="sub">파일 이름 <span class="mono">${esc(pkg.fileBase)}.xlsx</span> · <span class="mono">${esc(pkg.fileBase)}.json</span> — 번호가 이 ${what}의 번호입니다. JSON은 재견적·재주문 때 그대로 씁니다.</span></div>
  <div class="s2"><span class="lab">2 · 메일</span><span class="val">${rfqC('rfq')}</span><div class="rs-btns">${mail}${addr}<button class="btn sm" type="button" id="rs-copy" data-rs="body">본문 복사</button></div><span class="sub">메일 창이 열리지 않으면 주소와 본문을 복사해 쓰세요.</span></div>
  <div class="s2 e"><span class="lab">2 · 카카오톡 채널</span><span class="val">${kakao}</span><span class="sub">첫 메시지: <b>${esc(pkg.first)}</b> <button class="btn sm" type="button" id="rs-first" data-rs="first">복사</button></span><span class="sub">사진·간단 문의용입니다. 정식 견적서·발주 확인서는 메일로 드립니다. 카드번호·주민등록번호는 보내지 마세요.</span></div>
  <div class="s2"><span class="lab">2 · 팩스</span><span class="val">${rfqC('fax')}</span><span class="sub">인쇄한 ${what}를 보내 주세요.</span></div>
  <div class="s2 e"><span class="lab">전화</span><span class="val">${rfqC('tel', { link: true })}</span><span class="sub">통화로 정한 내용은 메일로 다시 확인합니다.</span></div>
  <div class="s4 e lr rs-f"><p>${esc(SLA().recv)}. 답이 없으면 카카오톡이나 전화로 요청번호를 알려 주세요.</p><p class="small muted">보내신 내용은 고객님이 고른 메일·카카오톡·팩스 서비스를 거쳐 볼트노트에 도착합니다. 처리 목적·보관 기간·위탁·국외 이전은 <a href="#privacy" data-go="privacy"><b>개인정보 처리방침</b></a>에 있습니다.</p><span class="small" id="rs-msg" role="status" aria-live="polite"></span><textarea id="rs-ta" class="rs-ta" readonly hidden aria-label="복사할 내용"></textarea></div>
</section>`);
}
// 펼친 칸으로 이동: 제목에 초점
function rfqShow(el, focusId = 'rfq-send-h') {
  if (!el) return;
  el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const h = document.getElementById(focusId) || el.querySelector('h2, h3'); if (h) h.focus({ preventScroll: true });
}
document.addEventListener('click', e => {
  const b = e.target.closest('#rfq-send [data-rs]'); if (!b || !rfqCur) return;
  const pkg = rfqCur, k = b.dataset.rs, msg = document.getElementById('rs-msg'), ta = document.getElementById('rs-ta');
  const say = t => { if (msg) msg.textContent = t; };
  if (['xlsx', 'json', 'pdf', 'mail'].includes(k) && pkg.check) { const bad = pkg.check(); if (bad) { e.preventDefault(); say(bad); return; } }
  if (['xlsx', 'json', 'pdf', 'mail', 'body'].includes(k) && pkg.sent) pkg.sent();   // 이 내용을 내보냈다: 이후 내용이 바뀌면 번호에 -R n
  if (k === 'mail') { say('메일 프로그램을 여는 중입니다. 열리지 않으면 [주소 복사]·[본문 복사]를 써 주세요. 파일은 직접 첨부해 주세요.'); return; }   // <a href="mailto:…"> 기본 동작
  if (k === 'xlsx') { pkg.xlsx(msg); return; }
  if (k === 'json') { pkg.json(msg); return; }
  if (k === 'pdf') { pkg.print(); return; }
  if (k === 'addr') { if (rfqOk('rfq')) bomCopy(String(CONTACT.rfq).trim(), msg, ta, '메일 주소를 복사했습니다.'); return; }
  if (k === 'body') { const m = rfqMail(pkg); bomCopy(`제목: ${m.subj}\n\n${m.body}`, msg, ta, '제목과 본문을 복사했습니다. 메일 창에 붙여 넣고 파일을 첨부해 주세요.'); return; }
  if (k === 'first') bomCopy(pkg.first, msg, ta, '첫 메시지를 복사했습니다.');
});

/* ── 패키지 파일: {no}.xlsx (시트 1개) · {no}.json (schema 1). 엑셀 도구를 못 불러오면 같은 내용을 CSV로 ── */
async function rfqSaveXlsx(pkg, msgEl) {
  const say = t => { if (msgEl) msgEl.textContent = t; }, aoa = pkg.aoa(), name = pkg.fileBase;
  say('엑셀 도구를 불러오는 중…');
  let X = null; try { X = await loadXLSX(); } catch { X = null; }
  if (!X) {
    const r = await bomSaveFile(name + '.csv', '﻿' + aoa.map(row => row.map(bomCsvCell).join(',')).join('\r\n'), 'text/csv');
    say(r === 'saved' ? `엑셀 도구를 불러오지 못해 같은 내용을 ${name}.csv로 저장했습니다.` : (BOM_SAVE_MSG[r] || BOM_SAVE_MSG.fail)(name + '.csv')); return;
  }
  try {
    const wb = X.utils.book_new(), ws = X.utils.aoa_to_sheet(aoa); ws['!cols'] = pkg.cols; X.utils.book_append_sheet(wb, ws, pkg.sheetName);
    const r = await bomSaveFile(name + '.xlsx', new Uint8Array(X.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    say((BOM_SAVE_MSG[r] || BOM_SAVE_MSG.fail)(name + '.xlsx'));
  } catch { say('엑셀 파일을 만들지 못했습니다. JSON으로 내려받아 주세요.'); }
}
async function rfqSaveJson(pkg, msgEl) {
  const r = await bomSaveFile(pkg.fileBase + '.json', JSON.stringify(pkg.jsonObj(), null, 1), 'application/json');
  if (msgEl) msgEl.textContent = (BOM_SAVE_MSG[r] || BOM_SAVE_MSG.fail)(pkg.fileBase + '.json');
}
// 인쇄(PDF로 저장): 문서만 복사해 맨 위에 두고 나머지는 숨긴다. 미러(iframe)에서는 부르지 않는다
function rfqPrint(sel) {
  const src = document.querySelector(sel); if (!QD_CANPRINT || !src) return;
  const w = document.createElement('div'); w.id = 'rfq-print'; w.innerHTML = src.outerHTML.replace(/\sid="[^"]*"/g, '');
  document.body.appendChild(w); document.documentElement.classList.add('rfq-printing');
  let on = true; const done = () => { if (!on) return; on = false; document.documentElement.classList.remove('rfq-printing'); w.remove(); };
  window.addEventListener('afterprint', done, { once: true });
  try { window.print(); } catch { done(); }
  setTimeout(done, 1500);
}
const RFQ_COLS = ['No', '원문', '해석 규격', '품명 영문 (Item name)', '수량', '단위', '상태', '자동 견적 단가(원, VAT 별도)', '비고'];
const rfqTo = () => rfqOk('rfq') ? String(CONTACT.rfq).trim() : '볼트노트 견적 메일 (사이트 6장 문의 칸 참조)';
const rfqCell = (lab, v, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><span class="lab">${lab}</span><b>${v}</b></div>`;
// 표제란 칸: 3열 격자의 마지막 줄 칸에 lr
const rfqCells = cells => cells.map((c, i) => rfqCell(c[0], c[1], i >= cells.length - (cells.length % 3 || 3) ? 'lr' : '')).join('');
const rfqTxt = (v, empty = '—') => (v ? esc(v) : `<span class="faint">${empty}</span>`);
// 다시 넣기용 줄 원문 (BOM 엔진이 읽는 표기): 카탈로그 형번 → 'Hex bolt ISO 4017 M10x30 8.8 ZINC' 꼴 (4A장 JSON 다시 넣기)
// 품목 낱말은 화면 이름이 아니라 엔진이 읽는 낱말이다 (공식 영문명 'Hexagon Head Screw'는 엔진이 품목으로 읽지 않는다). 화면·서류의 영문명은 f.en
const RFQ_PN_WORD = { hbf: 'Hex bolt', hbp: 'Hex bolt', scs: 'Socket head cap screw', csk: 'Countersunk socket screw', hn: 'Hex nut', pw: 'Plain washer', sw: 'Spring lock washer', tr: 'Threaded rod' };
function rfqPnText(p) {
  const s = p.f.std || {}, std = [s.ISO, s.DIN].find(x => x && x !== '—' && !/^BOM/.test(x)) || '';
  const fin = { ZW: 'ZINC', ZB: 'BLACK ZINC', HD: 'HDG', BO: 'BLACK OXIDE', GM: 'GEOMET', PL: 'PLAIN', PA: '' }[p.fin] ?? (FINISH[p.fin]?.short || '');
  const gr = { N8: 'CLASS 8', N10: 'CLASS 10', SPR: '', SA2: 'A2', WA2: 'A2', WA4: 'A4', H200: '200HV', H300: '300HV' }[p.g] ?? (GRADE[p.g]?.label || '');
  return [RFQ_PN_WORD[p.f.id] || p.f.short || '', typeof std === 'string' ? std.split(/\s*[·,/]\s*/)[0] : '', `${p.size}${p.L ? 'x' + p.L : ''}`, gr, fin].filter(Boolean).join(' ');
}

/* ── 7장 견적함: 요청 정보 칸(메모리에만) + 견적 요청서(Q) 또는 발주서(BO) + 보낼 방법 ── */
const rfqCartF = { mode: 'Q', no: { Q: '', BO: '' }, rev: { Q: 0, BO: 0 }, sent: { Q: '', BO: '' }, revMsg: { Q: '', BO: '' }, v: { ctype: 'biz', co: '', name: '', mail: '', tel: '', area: '', due: '', pay: '', place: '', bizno: '', ceo: '', taxmail: '', mtc: false, bpay: '' } };
const RFQ_PAY_Q = ['계좌이체·세금계산서', '카드 결제 링크 요청', '후불 협의 (승인 거래처)'];
const RFQ_CTYPE = { biz: '사업자', pub: '공공기관', ind: '개인' };
const RFQ_PAY_BO = { biz: ['계좌이체 (확인 메일을 받은 뒤)', '카드 결제 링크 요청 (법인카드·구매카드)'], pub: ['납품·검수 후 청구 (기관 지정 채널)', '구매카드 결제 링크 (검수 후)'], ind: ESCROW_ON ? ['계좌이체 · 에스크로(결제대금예치)', '신용카드 결제 링크 요청'] : ['신용카드 결제 링크 요청'] };   // 에스크로 가입 전(ESCROW_ON false)에는 개인 계좌이체·체크카드 선결제를 받지 않는다
const rfqVal = v => ` value="${esc(v || '')}"`;
const rfqReq = '<span class="redp" aria-hidden="true">*</span>';
const rfqRadios = (name, list, cur, lab) => `<span class="flab" id="${name}-l">${lab}</span><div class="choices" role="radiogroup" aria-labelledby="${name}-l">${list.map(t => `<label class="choice"><input type="radio" name="${name}" value="${esc(t)}"${t === cur ? ' checked' : ''}>${esc(t)}</label>`).join('')}</div>`;
function rfqCartForm() {
  const F = rfqCartF, v = F.v;
  if (F.mode !== 'BO') return zh('C', 'z-c', '견적 요청서 만들기', '아래 칸을 채우면 요청서에 바로 들어갑니다. 이름과 이메일만 필수입니다.')
    + `<fieldset class="tbf rq-f">${legend('C', '요청 정보', '* 표시는 필수')}
    ${fc('w2 half l', inp('rq-co', '회사명 (개인은 비움)', `data-k="co" autocomplete="organization"${rfqVal(v.co)}`))}
    ${fc('w2 e half', inp('rq-name', `담당자 ${rfqReq}`, `data-k="name" autocomplete="name" aria-required="true"${rfqVal(v.name)}`))}
    ${fc('w2 half l', inp('rq-mail', `이메일 ${rfqReq}`, `data-k="mail" type="email" autocomplete="email" aria-required="true"${rfqVal(v.mail)}`))}
    ${fc('w2 e half', inp('rq-tel', '전화 (선택)', `data-k="tel" type="tel" autocomplete="tel"${rfqVal(v.tel)}`))}
    ${fc('w2 half l', inp('rq-area', '납품 지역 (시·군, 선택)', `data-k="area" autocomplete="address-level2"${rfqVal(v.area)}`))}
    ${fc('w2 e half', inp('rq-due', '희망 납기 (선택)', `data-k="due" type="date"${rfqVal(v.due)}`))}
    ${fc('w4 e lr', rfqRadios('rq-pay', RFQ_PAY_Q, v.pay, '희망 대금 조건 (선택)'))}
  </fieldset>
  <p class="pi-note rq-pi">이 칸의 정보는 견적 회신과 사양 확인 연락에만 씁니다(개인정보 보호법 제15조 제1항 제4호, 동의 없이 처리). 이 페이지는 입력값을 서버로 보내거나 저장하지 않습니다. 보관 기간·위탁·권리는 <a href="#privacy" data-go="privacy"><b>개인정보 처리방침</b></a>에 있습니다.</p>`;
  const biz = v.ctype !== 'ind';
  return rfqBoW(zh('C', 'z-c', '발주서 만들기', `${PRICE_LAB()}이 표시된 줄만 발주서에 들어갑니다. 가격·출고일은 발주 확인서로 확정합니다. 견적 줄은 [견적 요청 보내기]로 요청해 주세요. 이 화면에서는 결제하지 않습니다. 입금은 확인 메일을 받은 뒤에 합니다.`)
    + `<fieldset class="tbf rq-f">${legend('C', '발주 정보', '* 표시는 필수')}
    ${fc('w4 e', `<span class="flab" id="rq-ctype-l">구분</span><div class="segc" role="radiogroup" aria-labelledby="rq-ctype-l">${Object.entries(RFQ_CTYPE).map(([k, t]) => `<label><input type="radio" name="rq-ctype" value="${k}"${v.ctype === k ? ' checked' : ''}>${t}</label>`).join('')}</div>`)}
    ${fc('w2 half l', inp('rq-co', biz ? `${v.ctype === 'pub' ? '기관명' : '발주처 상호'} ${rfqReq}` : '상호 (개인은 비움)', `data-k="co" autocomplete="organization"${biz ? ' aria-required="true"' : ''}${rfqVal(v.co)}`))}
    ${fc('w2 e half', inp('rq-name', `담당자 ${rfqReq}`, `data-k="name" autocomplete="name" aria-required="true"${rfqVal(v.name)}`))}
    ${fc('w2 half l', inp('rq-mail', `이메일 ${rfqReq}`, `data-k="mail" type="email" autocomplete="email" aria-required="true"${rfqVal(v.mail)}`))}
    ${fc('w2 e half', inp('rq-tel', '전화 (선택)', `data-k="tel" type="tel" autocomplete="tel"${rfqVal(v.tel)}`))}
    ${fc('w4 e', inp('rq-place', `납품지 주소 ${rfqReq}`, `data-k="place" autocomplete="street-address" aria-required="true"${rfqVal(v.place)}`))}
    ${biz ? `${fc('w2 half l', inp('rq-bizno', `${v.ctype === 'pub' ? '기관 고유번호' : '사업자등록번호'} ${rfqReq}`, `data-k="bizno" inputmode="numeric" aria-required="true"${rfqVal(v.bizno)}`))}
    ${fc('w2 e half', inp('rq-ceo', v.ctype === 'pub' ? '기관장 (세금계산서 표기)' : '대표자 성명', `data-k="ceo"${rfqVal(v.ceo)}`))}
    ${fc('w4 e', inp('rq-taxmail', '세금계산서 받을 이메일', `data-k="taxmail" type="email"${rfqVal(v.taxmail)}`))}` : ''}
    ${fc('w4 e', `<span class="flab">필요 서류</span><div class="choices"><label class="choice"><input type="checkbox" checked disabled>CoC 적합 확인서 (ISO 16228 F2.1 형식, 기본)</label><label class="choice"><input type="checkbox" id="rq-mtc"${v.mtc ? ' checked' : ''}>제조사 MTR(3.1) 요청 — 가능 여부를 확인 메일에서 알려 드립니다</label></div>`)}
    ${fc('w4 e lr', rfqRadios('rq-bpay', RFQ_PAY_BO[v.ctype], v.bpay || RFQ_PAY_BO[v.ctype][0], '대금 방법'))}
  </fieldset>
  <p class="pi-note rq-pi">${biz ? '사업자등록번호(기관 고유번호)·대표자 성명·세금계산서 이메일은 세금계산서 발행에만 씁니다. ' : ''}발주 정보는 계약 이행(납품·대금)에 필요한 정보라 동의 없이 처리합니다(개인정보 보호법 제15조 제1항 제4호). 이 페이지는 입력값을 서버로 보내거나 저장하지 않습니다. 보관 기간·위탁·권리는 <a href="#privacy" data-go="privacy"><b>개인정보 처리방침</b></a>에 있습니다.</p>`);
}
// 규격품이 모두 모이는 날 (줄별 출고일 중 가장 늦은 날, 연말을 넘기면 다음 해)
function rfqLastShip(lines) {
  const m0 = kstNow().getMonth() + 1; let best = null, key = -1;
  lines.forEach(l => { const m = l.ship && l.ship.label.match(/^(\d+)\/(\d+)/); if (!m) return; const k = (+m[1] < m0 ? +m[1] + 12 : +m[1]) * 100 + +m[2]; if (k > key) { key = k; best = l.ship; } });
  return best;
}
function rfqCartPkg(cr) {
  const F = rfqCartF, v = F.v, bo = F.mode === 'BO', no = F.no[F.mode] + (F.rev[F.mode] ? `-R${F.rev[F.mode]}` : ''), date = rfqToday();
  const lines = cr.rows.filter(r => r.no && (!bo || (r.l.type === 'item' && r.px))).map(r => r.l.type === 'item' && !r.px
    ? { no: r.no, raw: r.l.pn, spec: `${r.p.f.short} · ${GRADE[r.p.g].label} · ${FINISH[r.p.fin].short}`, en: bomEnCart(r.l), bom: rfqPnText(r.p), qty: r.l.qty, unit: 'EA', status: '견적 요청 (단가 확인 중)', price: null, amount: null, note: '단가 확인 중' }
    : r.l.type === 'item'
    ? { no: r.no, raw: r.l.pn, spec: `${r.p.f.short} · ${GRADE[r.p.g].label} · ${FINISH[r.p.fin].short}`, en: bomEnCart(r.l), bom: rfqPnText(r.p), qty: r.l.qty, unit: 'EA', status: PRICE_LAB(), price: r.v.price, amount: r.v.price * r.l.qty, ship: r.v.ship, note: `${r.v.ship.today ? '오늘 ' : ''}${r.v.ship.label} 출고 예정` }
    : { no: r.no, raw: r.l.title, spec: r.l.spec, en: bomEnCart(r.l), bom: r.l.spec, qty: r.l.qty, unit: r.l.unit || 'EA', status: '견적 요청', price: null, amount: null, note: r.l.reqNo ? `요청서 ${r.l.reqNo}` : '' });
  // 금액: 견적함 합계 상자와 같은 식 (sub + 배송비, 부가세는 합계에 한 번 반올림)
  const sub = cr.sub, fr = cr.freight && sub > 0, ship = sub === 0 || fr ? 0 : sub >= FREE_SHIP ? 0 : SHIP_FEE, vat = Math.round((sub + ship) * .1), total = sub + ship + vat;
  const nI = lines.filter(l => l.price != null).length, nQ = lines.length - nI;
  const who = { co: v.co.trim(), name: v.name.trim(), mail: v.mail.trim(), tel: v.tel.trim() };
  const pay = bo ? v.bpay || RFQ_PAY_BO[v.ctype][0] : v.pay;
  const words = wonKoDoc(total, '일금');
  const check = () => {
    const miss = [];
    if (!who.name) miss.push(['rq-name', '담당자 이름']);
    if (!/^\S+@\S+\.\S+$/.test(who.mail)) miss.push(['rq-mail', '회신받을 이메일']);
    if (bo && v.ctype !== 'ind' && !who.co) miss.push(['rq-co', v.ctype === 'pub' ? '기관명' : '발주처 상호']);
    if (bo && !v.place.trim()) miss.push(['rq-place', '납품지 주소']);
    if (bo && v.ctype !== 'ind' && !/^\d{3}-?\d{2}-?\d{5}$/.test(v.bizno.trim())) miss.push(['rq-bizno', v.ctype === 'pub' ? '기관 고유번호(10자리)' : '사업자등록번호(10자리)']);
    miss.forEach(([id]) => { const el = document.getElementById(id), f = el && el.closest('.field'); if (f) { f.classList.add('err'); el.setAttribute('aria-invalid', 'true'); } });
    if (!miss.length) return '';
    document.getElementById(miss[0][0])?.focus();
    return `${miss.map(x => x[1]).join(', ')}을(를) 위 칸에 적어 주세요.`;
  };
  const head = (bo ? x => x.map(([k, val]) => [rfqBoW(k), val]) : x => x)(bo
    ? [['발주서', no], ['발주일', date], ['구분', RFQ_CTYPE[v.ctype]], ['발주처 상호', who.co || '(개인)'], ['담당자', who.name], ['이메일', who.mail], ['전화', who.tel], ['납품지', v.place.trim()],
      ...(v.ctype !== 'ind' ? [[v.ctype === 'pub' ? '기관 고유번호' : '사업자등록번호', v.bizno.trim()], [v.ctype === 'pub' ? '기관장' : '대표자 성명', v.ceo.trim()], ['세금계산서 받을 이메일', v.taxmail.trim()]] : []),
      ['필요 서류', `CoC 적합 확인서(ISO 16228 F2.1 형식)${v.mtc ? ', 제조사 3.1 사본' : ''}`], ['대금 방법', pay], ['받는 곳', rfqTo()]]
    : [['견적 요청서', no], ['요청일', date], ['요청처(회사)', who.co || '개인'], ['담당자', who.name], ['이메일', who.mail], ['전화', who.tel], ['납품 지역', v.area.trim()], ['희망 납기', v.due], ['희망 대금 조건', pay], ['받는 곳', rfqTo()]]);
  const money = nI ? [[bo ? '공급가액(원)' : `${PRICE_LAB()} 품목 공급가액(원)`, sub], ['배송비(원)', fr ? '화물 운임 별도 안내' : ship], ['부가세(원)', vat], [bo ? '합계(원, VAT 포함)' : '합계(원, VAT 포함, 참고)', total], ...(bo ? [['한글 금액', words]] : [])] : [];
  return {
    kind: bo ? 'BO' : 'Q', no, date, fileBase: no, who, check, lines, sub, ship, vat, total: nI && (bo || !nQ) ? total : null, docTotal: nI ? total : null, freight: fr, words, wordsOk: wonKoOk(total),
    area: bo ? v.place.trim() : v.area.trim(), due: bo ? '' : v.due, pay, ctype: v.ctype,
    content: bo ? `${PRICE_LAB()} 품목 ${lines.length}줄` : `품목 ${lines.length}줄 (${PRICE_LAB()} ${nI}줄 · 견적 ${nQ}줄)`, nLabel: `${bo ? '' : '품목 '}${lines.length}줄`,
    extra: bo ? [`구분: ${RFQ_CTYPE[v.ctype]}${v.bizno.trim() ? ` · ${v.ctype === 'pub' ? '고유번호' : '등록번호'} ${v.bizno.trim()}` : ''}`] : [],
    files: [], attach: bo ? `${no}.xlsx` : `${no}.xlsx, 도면·사양서`, first: bo ? rfqBoW(`발주서 ${no} 발주 문의드립니다`) : `요청번호 ${no} 견적 문의드립니다`,
    printable: true, print: () => rfqPrint('#doc'), sheetName: bo ? (ORDER_LIVE ? '발주' : '주문요청') : '요청',
    cols: bo ? [{ wch: 6 }, { wch: 24 }, { wch: 36 }, { wch: 10 }, { wch: 6 }, { wch: 16 }, { wch: 16 }, { wch: 18 }] : [{ wch: 6 }, { wch: 28 }, { wch: 48 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 18 }, { wch: 24 }],
    aoa: () => [...head, [], bo ? ['No', '형번', '품명·규격', '품명 영문 (Item name)', '수량', '단위', '단가(원, VAT 별도)', '공급가액(원)', '출고 예정'] : RFQ_COLS,
      ...lines.map(l => bo ? [l.no, l.raw, l.spec, l.en || '', l.qty, l.unit, l.price, l.amount, l.note] : [l.no, l.raw, l.spec, l.en || '', l.qty, l.unit, l.status, l.price ?? '', l.note]), [], ...money,
      ['안내', bo ? rfqBoW('발주 확인서(출고 예정일, 입금 계좌 또는 카드 결제 링크)를 받은 뒤 확정됩니다. 이 화면에서는 결제하지 않습니다. 공급처 사정으로 가격이나 납기가 바뀌면 확인 메일에 적고, 그때 취소하셔도 됩니다.') : '단가가 비어 있는 줄은 공급처 확인 뒤 볼트노트가 회신하는 견적서로 정합니다.']],
    jsonObj: () => ({ format: 'boltnote.rfq', schema: 1, kind: bo ? 'order' : 'request', no, date, created: new Date().toISOString(), to: rfqOk('rfq') ? String(CONTACT.rfq).trim() : null, from: who, ...(bo ? { ctype: v.ctype, place: v.place.trim(), tax: v.ctype !== 'ind' ? { no: v.bizno.trim(), ceo: v.ceo.trim(), mail: v.taxmail.trim() } : null, docs: ['COC_F21', ...(v.mtc ? ['MTC31_FWD'] : [])] } : { area: v.area.trim(), due: v.due }), pay,
      lines: lines.map(({ ship: _s, ...l }) => l), totals: nI ? { sub, ship: fr ? null : ship, freightSeparate: fr, vat, total, vatIncluded: true, ...(bo ? { words } : {}) } : null }),
    xlsx: m => rfqSaveXlsx(rfqCur, m), json: m => rfqSaveJson(rfqCur, m),
    sig: JSON.stringify([lines.map(({ ship: _s, ...l }) => l), total, who, pay, v.ctype, v.place, v.bizno, v.ceo, v.taxmail, v.mtc, v.area, v.due]),
    sent() { F.sent[F.mode] = this.sig; F.revMsg[F.mode] = ''; },
  };
}
function rfqCartDoc(pkg) {
  const bo = pkg.kind === 'BO', v = rfqCartF.v, w = pkg.who, ask = '<span class="faint">(위 칸에 입력)</span>';
  if (!pkg.lines.length) return `<div class="doc rfq-doc" id="doc"><div class="doc-in"><h2>${bo ? ORDER_DOC() : '견적 요청서'}</h2><p class="muted">${bo ? `${ORDER_DOC()}는 가격이 표시된 줄로만 만듭니다. 지금 견적함에는 그런 줄이 없습니다. [견적 요청 보내기]로 보내 주세요.` : '요청서에 넣을 품목이 없습니다. 예시 줄은 넣지 않습니다.'}</p></div></div>`;
  const rows = pkg.lines.map(l => bo
    ? `<tr><td class="mono rq-no">${l.no}</td><td class="mono rq-pn">${esc(l.raw)}</td><td class="rq-nm">${esc(l.spec)}${l.en ? `<span class="en-n" lang="en">${esc(l.en)}</span>` : ''}</td><td class="r mono" data-l="수량">${l.qty.toLocaleString()} EA</td><td class="r mono" data-l="단가">${won(l.price)}</td><td class="r mono rq-amt" data-l="공급가액">${won(l.amount)}</td><td class="rq-sh" data-l="출고">${esc(l.note)}</td></tr>`
    : `<tr><td class="mono rq-no">${l.no}</td><td class="rq-nm">${esc(l.price != null ? `${l.spec.split(' · ')[0]} ${l.raw}` : `${l.raw}${l.note ? ` (${l.note})` : ''} — ${l.spec}`)}${l.en ? `<span class="en-n" lang="en">${esc(l.en)}</span>` : ''}</td><td class="r mono" data-l="수량">${l.qty.toLocaleString()} ${esc(l.unit)}</td><td class="r mono" data-l="단가">${l.price != null ? won(l.price) : '회신 예정'}</td><td class="r mono rq-amt" data-l="금액">${l.price != null ? won(l.amount) : '회신 예정'}</td></tr>`).join('');
  // 좁은 화면(≤560px)에서는 줄마다 카드로 쌓는다 (rfq.css .rq-tbl): 형번 / 품명 / 수량 · 단가 · 금액 / 출고
  const tbl = bo ? `<div class="tblw bare rq-tw"><table class="tbl mid6 rq-tbl"><thead><tr><th>No</th><th>형번</th><th>품명·규격</th><th class="r">수량</th><th class="r">단가</th><th class="r">공급가액</th><th>출고 예정</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="tblw bare rq-tw"><table class="tbl mid6 rq-tbl"><thead><tr><th>No</th><th>품명·사양</th><th class="r">수량</th><th class="r">단가</th><th class="r">금액</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const fr = pkg.freight ? ' · 운임 별도' : '';
  const sum = pkg.docTotal == null ? '' : bo
    ? `<div class="rq-sum"><div><span>공급가액</span><b class="mono">${won(pkg.sub)}</b></div><div><span>배송비</span><b class="mono">${pkg.freight ? '화물 운임 별도 안내' : won(pkg.ship)}</b></div><div><span>부가세 10%</span><b class="mono">${won(pkg.vat)}</b></div><div class="grand"><span>합계 (VAT 포함${fr})</span><b class="mono">${won(pkg.docTotal)}</b></div><div class="ko"><span>한글 금액</span><b>${esc(pkg.words)}</b></div></div>${pkg.wordsOk ? '' : noteSm('crit', '한글 금액과 숫자가 다릅니다. 이 발주서는 보내지 마십시오.', '오류')}`
    : `<p class="r num">${PRICE_LAB()} 품목: 공급가액 ${won(pkg.sub)} + 배송비 ${pkg.freight ? '(화물 운임 별도)' : won(pkg.ship)} + 부가세 ${won(pkg.vat)} = 합계 ${won(pkg.docTotal)} (VAT 포함${fr}, 참고)</p>`;
  const cells = bo
    ? [['발주서 번호', esc(pkg.no)], ['발주일', pkg.date], ['구분', RFQ_CTYPE[v.ctype]], ['발주처', rfqTxt(w.co, v.ctype === 'ind' ? '개인' : '—')], ['담당자', w.name ? esc(w.name) : ask], ['이메일', w.mail ? esc(w.mail) : ask], ['전화', rfqTxt(w.tel)], ['납품지', v.place.trim() ? esc(v.place.trim()) : ask],
      ...(v.ctype !== 'ind' ? [[v.ctype === 'pub' ? '기관 고유번호' : '사업자등록번호', rfqTxt(v.bizno.trim())], [v.ctype === 'pub' ? '기관장' : '대표자', rfqTxt(v.ceo.trim())], ['세금계산서 이메일', rfqTxt(v.taxmail.trim())]] : []),
      ['필요 서류', `CoC(F2.1)${v.mtc ? ' · 제조사 3.1 사본' : ''}`], ['대금 방법', esc(pkg.pay)], ['받는 곳', rfqC('rfq')], ['팩스', rfqC('fax')]]
    : [['요청번호', esc(pkg.no)], ['요청일', pkg.date], ['장', '1 / 1'], ['요청처', rfqTxt(w.co, '개인')], ['담당자', w.name ? esc(w.name) : ask], ['이메일', w.mail ? esc(w.mail) : ask], ['전화', rfqTxt(w.tel)], ['납품 지역', rfqTxt(v.area.trim())], ['희망 납기', rfqTxt(v.due)], ['희망 대금 조건', rfqTxt(pkg.pay)], ['받는 곳', rfqC('rfq')], ['팩스', rfqC('fax')]];
  const last = rfqLastShip(pkg.lines);
  const notes = bo
    ? `<p class="small muted">발주 확인서(발주번호, 출고 예정일${last ? ` — 지금 표시 기준 ${last.today ? '오늘 ' : ''}${esc(last.label)}` : ''}, 입금 계좌 또는 카드 결제 링크)를 받은 뒤 확정됩니다. 이 발주서는 이 페이지에서 전송되지 않습니다. 메일로 보내실 때는 내려받은 발주서 파일을 첨부해 주세요.${v.ctype === 'ind' ? (ESCROW_ON ? ` 개인 고객이 상품을 받기 전에 계좌이체·체크카드로 먼저 내실 때는 에스크로(<span class="ph">은행명</span>)를 고르실 수 있고, 받은 날부터 7일 안에 청약철회할 수 있습니다(6장 D).` : ' 개인 고객은 신용카드 결제 링크로 결제하며, 받은 날부터 7일 안에 청약철회할 수 있습니다(6장 D).') : ''}</p>`
    : '<p class="small muted">이 요청서는 이 페이지에서 전송되지 않습니다. 아래에서 보낼 방법을 고르세요. 메일로 보내실 때는 내려받은 요청서 파일(엑셀)과 도면을 첨부해 주세요. 견적함을 고치면 이 요청서도 함께 바뀝니다.</p>';
  return (bo ? rfqBoW : (s => s))(`${bo && !ORDER_LIVE ? `<p class="rq-band"><b>검증 운영 중:</b> 이 요청서는 아직 주문이 아닙니다. 확인 메일로 가격과 출고 예정일을 드린 뒤, 진행하시겠다고 답하시면 그때 주문이 됩니다.</p>` : ''}${bo ? noteSm('info', `발주서 ${esc(pkg.no)}를 만들었습니다. 보낼 방법을 고르세요. 메일로 보내실 때는 내려받은 발주서 파일을 첨부해 주세요. 받는 대로 발주 확인서(출고 예정일, 입금 계좌 또는 카드 결제 링크)를 보내 드립니다. 이 화면에서는 결제하지 않습니다.`, '발주') : ''}
<div class="doc rfq-doc" id="doc"><div class="doc-in"><h2>${bo ? '발주서' : '견적 요청서'}</h2>${tbl}${sum}<div class="doc-tb">${rfqCells(cells)}</div>${notes}</div></div>`);
}
function rfqCartPaint(el, cr) {
  const F = rfqCartF; let pkg = rfqCartPkg(cr);
  // 내려받기·복사·메일로 내보낸 뒤 내용이 바뀌면 같은 번호를 다시 쓰지 않는다: -R1, -R2 … (보낸 파일과 화면 문서가 다른 번호를 갖게)
  if (F.sent[F.mode] && pkg.sig !== F.sent[F.mode]) { const old = pkg.no; F.rev[F.mode]++; F.sent[F.mode] = ''; pkg = rfqCartPkg(cr); F.revMsg[F.mode] = `내려받은 ${pkg.kind === 'BO' ? ORDER_DOC() : '요청서'}(${old})와 내용이 달라져 번호를 ${pkg.no}로 바꿨습니다. 새 파일을 보내 주세요.`; }
  const d = el.querySelector('#rq-doc'), s = el.querySelector('#rq-send');
  if (d) d.innerHTML = (F.revMsg[F.mode] ? noteSm('warn', esc(F.revMsg[F.mode]), '번호 변경') : '') + rfqCartDoc(pkg);
  // 발주서는 '출고 조건 확인'(#ship-ok, 발주서에 필수)이 켜져 있을 때만 내려받기·보낼 방법을 연다
  const okBox = document.getElementById('ship-ok'), held = pkg.kind === 'BO' && okBox && !okBox.checked;
  if (s) { if (pkg.lines.length && !held) s.innerHTML = rfqSheetHTML(pkg); else { s.innerHTML = held && pkg.lines.length ? `<div id="rq-held">${noteSm('warn', rfqBoW('발주서에 필수인 확인란(출고 예정일·품목별 납기 조건)이 꺼져 있어 내려받기·보낼 방법을 닫았습니다. 위 합계 칸에서 다시 체크해 주세요.'), '확인 필요')}</div>` : ''; rfqCur = null; } }
}
function rfqCartShow(el, mode, cr, move) {
  if (!el) return;
  const F = rfqCartF, fresh = !!mode && (mode !== F.mode || !el.querySelector('#rq-form'));
  if (mode) F.mode = mode;
  if (!F.no[F.mode]) F.no[F.mode] = rfqNo(F.mode === 'BO' ? 'BO' : 'Q');
  if (fresh || !el.querySelector('#rq-form')) {
    el.innerHTML = `<div id="rq-form">${rfqCartForm()}</div><div id="rq-doc"></div><div id="rq-send"></div>`;
    const form = el.querySelector('#rq-form');
    const on = ev => {
      const t = ev.target, v = F.v, f = t.closest('.field');
      if (f && f.classList.contains('err')) { f.classList.remove('err'); t.removeAttribute('aria-invalid'); }
      if (t.name === 'rq-ctype') { if (ev.type !== 'change') return; v.ctype = t.value; v.bpay = ''; form.innerHTML = rfqCartForm(); form.querySelector(`[name="rq-ctype"][value="${t.value}"]`)?.focus(); }
      else if (t.name === 'rq-pay' || t.name === 'rq-bpay') { if (ev.type !== 'change') return; v[t.name === 'rq-pay' ? 'pay' : 'bpay'] = t.value; }
      else if (t.id === 'rq-mtc') { if (ev.type !== 'change') return; v.mtc = t.checked; }
      else if (t.dataset.k) { if (ev.type !== 'input') return; v[t.dataset.k] = t.value; }
      else return;
      rfqCartPaint(el, cartRows());
    };
    form.addEventListener('input', on); form.addEventListener('change', on);
  }
  rfqCartPaint(el, cr);
  if (move) rfqShow(el, 'h-z-c');
}

/* ── 4장 주문제작·해외규격 요청서: 제출하면 요청서 문서 + 보낼 방법 (견적 요청서 Q-, 사양 1건 + 첨부 파일 이름) ── */
function rfqCustomShow(el, no, again) {
  const form = document.getElementById('cform'); if (!el || !form) return;
  const g = id => String(document.getElementById(id)?.value || '').trim();
  const pick = n => form.querySelector(`[name="${n}"]:checked`)?.value || '';
  const files = [...(document.getElementById('c-files')?.files || [])].map(f => f.name);
  const docs = [...form.querySelectorAll('[name="docs"]:checked')].map(x => x.value);
  const out = document.getElementById('c-out').textContent, spec = /^왼쪽에 사양을 입력하면/.test(out) ? '(도면·사양서 참조)' : out;
  const qty = Math.max(1, Math.round(+g('c-qty') || 1)), kind = pick('kind'), news = !!document.getElementById('c-news')?.checked, memo = g('c-memo');
  const who = { co: g('c-co'), name: g('c-name'), mail: g('c-mail'), tel: g('c-tel') }, area = g('c-area'), due = g('c-due'), date = rfqToday();
  const head = [['견적 요청서', no], ['요청일', date], ['요청 구분', kind], ['요청처(회사)', who.co || '개인'], ['담당자', who.name], ['이메일', who.mail], ['전화', who.tel], ['납품 지역', area], ['희망 납기', due],
    ['고객 품번·도면', g('c-pn')], ['필요 서류', docs.join(', ')], ['첨부할 파일', files.join(', ') || '(없음)'], ['추가 설명', memo], ['소식 메일 수신', news ? '받겠습니다 (선택 동의)' : '받지 않음'], ['받는 곳', rfqTo()]];
  const line = { no: 1, raw: spec, spec, en: bomEnCart({ fam: 'custom', title: (g('c-shape') || '도면 참조품') + ' (주문제작)' }), bom: spec, qty, unit: 'EA', status: '견적 요청', price: null, note: [g('c-shape'), docs.length ? `서류: ${docs.join(', ')}` : ''].filter(Boolean).join(' · ') };
  const pkg = {
    kind: 'Q', no, date, fileBase: no, who, area, due, pay: '', total: null, files, lines: [line],
    content: `품목 1줄 (${kind || '주문제작·해외규격'})`, nLabel: '품목 1줄', extra: news ? ['소식 메일: 받겠습니다 (선택 동의)'] : [],
    attach: `${no}.xlsx, 도면·사양서`, first: `요청번호 ${no} 견적 문의드립니다`, printable: true, print: () => rfqPrint('#c-doc'), sheetName: '요청',
    cols: [{ wch: 18 }, { wch: 60 }, { wch: 48 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 18 }, { wch: 30 }],
    aoa: () => [...head, [], RFQ_COLS, [line.no, line.raw, line.spec, line.en || '', line.qty, line.unit, line.status, '', line.note]],
    jsonObj: () => ({ format: 'boltnote.rfq', schema: 1, kind: 'request', source: 'custom', no, date, created: new Date().toISOString(), to: rfqOk('rfq') ? String(CONTACT.rfq).trim() : null, from: who, area, due, news,
      lines: [line], spec: { kind, shape: g('c-shape'), pn: g('c-pn'), sys: pick('sys'), hand: pick('hand'), d: g('c-d'), p: g('c-p'), series: g('c-series'), cls: g('c-cls'), L: g('c-L'), lref: g('c-lref'), b: g('c-b'), s: g('c-s'), grade: g('c-grade'), mat: g('c-mat'), env: g('c-env'), fin: g('c-fin'), fin2: g('c-fin2'), rohs: !!document.getElementById('c-rohs')?.checked, nut: g('c-nut'), wsh: g('c-wsh'), docs, memo }, files }),
    xlsx: m => rfqSaveXlsx(rfqCur, m), json: m => rfqSaveJson(rfqCur, m),
  };
  const cells = [['요청번호', esc(no)], ['요청일', date], ['요청 구분', rfqTxt(kind)], ['요청처', rfqTxt(who.co, '개인')], ['담당자', esc(who.name)], ['이메일', esc(who.mail)], ['전화', rfqTxt(who.tel)], ['납품 지역', rfqTxt(area)], ['희망 납기', rfqTxt(due)],
    ['첨부할 파일', files.length ? esc(files.join(', ')) : '<span class="faint">없음</span>'], ['받는 곳', rfqC('rfq')], ['팩스', rfqC('fax')]];
  el.hidden = false;
  el.innerHTML = `<div class="doc rfq-doc" id="c-doc"><div class="doc-in"><h2>견적 요청서</h2>
  <div class="tblw bare"><table class="tbl mid6"><thead><tr><th>No</th><th>품명·사양</th><th class="r">수량</th><th>서류</th></tr></thead><tbody><tr><td class="mono">1</td><td>${esc([g('c-shape'), spec].filter(Boolean).join(' — '))}${line.en ? `<span class="en-n" lang="en">${esc(line.en)}</span>` : ''}${g('c-pn') ? `<span class="sub">고객 품번·도면 ${esc(g('c-pn'))}</span>` : ''}</td><td class="r mono">${qty.toLocaleString()} EA</td><td>${esc(docs.join(', ') || '—')}</td></tr></tbody></table></div>
  ${memo ? `<p class="small">추가 설명: ${esc(memo)}</p>` : ''}<div class="doc-tb">${rfqCells(cells)}</div>
  <p class="small muted">이 요청서는 이 페이지에서 전송되지 않습니다. 아래에서 보낼 방법을 고르세요. 메일로 보내실 때는 내려받은 요청서 파일(엑셀)과 도면을 첨부해 주세요.${files.length ? ' 고르신 파일은 이름만 요청서에 적었습니다.' : ''}${again ? ' 고친 내용으로 다시 만들었습니다.' : ''}</p></div></div>${rfqSheetHTML(pkg)}`;
  rfqShow(el);
}

// 시험용: 지금 열린 보낼 방법 칸의 메일 (제목·본문·mailto)
if (window.__bomTest) window.__bomTest.rfq = { cur: () => (rfqCur ? JSON.parse(JSON.stringify({ ...rfqMail(rfqCur), kind: rfqCur.kind, no: rfqCur.no, fileBase: rfqCur.fileBase })) : null), ok: k => rfqOk(k), pnText: pn => { const p = parsePn(pn); return p ? rfqPnText(p) : null; } };
