/* ── C&D 엔진: 엔진 이벤트(m.ev) + 줄·BOM·RFQ 문맥 → Clarification & Deviation 행 (BOM·C&D 사양 4·5장) ──
   입력: bomLine 결과 items [{ row, q, m }], RFQ 머리 rfq (사양 6.5절 모양, 모두 선택). 출력: cdBuild() 문서 객체.
   원칙
   - 원문과 다르게 공급하는 것은 빠짐없이 행(D)으로, 기본값 가정은 C행이나 일반 Clarification(GC)으로 남긴다 (침묵 = 준수).
   - 근거는 규격 번호·판·조항만 적는다(원문 문장 인용 없음). 근거 수준(basis):
       local    로컬 원문으로 확인한 조항
       second   2차 자료뿐 → 문구 끝에 '(2차, 원문 미대조)', 실제로 다른 것을 공급하지 않으면 유형은 C(확인)
       practice 업계 일반 관행 → '(업계 일반 관행, 원문 미대조)'
       engine   볼트노트 카탈로그·견적 계산 사실 · policy 볼트노트 거래 조건
   - 서류: 제조사 성적서는 고치지 않고 전달, 볼트노트 문서는 CoC(ISO 16228 F2.1 형식)뿐, KOLAS·3.2는 요청 시 제3자 기관.
   - 상업 GC-C12~C17은 운영자가 채우는 자리표시다. 정책 수치를 만들지 않는다. */

const CD_VERSION = 'cd-rules 1.0';
const CD_COLS = [['번호', 'No.'], ['BOM 줄 · 고객 문서·조항', 'Line Ref. · Client Doc. & Clause'], ['고객 요구사항 (원문)', 'Customer Requirement (as written)'], ['당사 제안', 'Offered'],
  ['유형', 'Type'], ['분류', 'Category'], ['사유·근거 조항', 'Reason & Reference (Std. Clause)'], ['영향', 'Impact'], ['고객 조치', 'Customer Action'], ['상태', 'Status']].map(([ko, en]) => ({ ko, en }));
const CD_TYPE = { C: { ko: '확인', en: 'Clarification' }, D: { ko: '편차', en: 'Deviation' }, E: { ko: '예외', en: 'Exception' } };
const CD_CAT = { MAT: { ko: '재질', en: 'Material' }, DIM: { ko: '치수', en: 'Dimension' }, THD: { ko: '나사', en: 'Thread' }, CTG: { ko: '코팅', en: 'Coating' }, DOC: { ko: '서류', en: 'Document' },
  MRK: { ko: '마킹', en: 'Marking' }, PKG: { ko: '포장', en: 'Packing' }, COM: { ko: '상업', en: 'Commercial' }, DLV: { ko: '납기', en: 'Delivery' } };
const CD_COMM = new Set(['COM', 'DLV']);   // 상업 C&D (나머지는 기술 C&D)
const CD_ACT = { APPROVE: { ko: '승인 필요', en: 'Approve' }, CONFIRM: { ko: '확인 필요', en: 'Confirm' }, INFO: { ko: '참고', en: 'Info only' } };
const CD_STATUS = { OPEN: { ko: '열림', en: 'Open' }, ACCEPTED_WB: { ko: '수락(워크벤치)', en: 'Accepted in workbench' }, APPROVED: { ko: '승인', en: 'Approved' }, APPROVED_C: { ko: '조건부 승인', en: 'Approved w/ comments' },
  REJECTED: { ko: '반려', en: 'Rejected' }, CONFIRMED: { ko: '확인됨', en: 'Confirmed' }, ANSWERED: { ko: '회신됨', en: 'Answered' }, WITHDRAWN: { ko: '철회', en: 'Withdrawn' }, CLOSED: { ko: '종결', en: 'Closed' }, INFO: { ko: '참고', en: 'Info' } };
const CD_RESOLVED = new Set(['ACCEPTED_WB', 'APPROVED', 'APPROVED_C', 'CONFIRMED', 'ANSWERED', 'WITHDRAWN', 'CLOSED']);
const CD_COMP = { C: { ko: '원문대로 준수', en: 'Complies as written' }, CC: { ko: '확인 조건부 준수', en: 'Complies subject to confirmation' }, D: { ko: '편차 제안', en: 'Deviation offered' },
  E: { ko: '예외 (공급 범위 제외)', en: 'Exception (not supplied)' }, N: { ko: '미견적 (엔지니어 견적 대기)', en: 'Not yet quoted (engineer quote)' } };
const CD_QUEUE_ORDER = ['conflict', 'unread', 'ambiguous', 'dev', 'qty', 'na'];   // 사양 2.8절 예외 큐 순서
// 사유 칸 끝에 붙는 근거 수준 표시 (원문 대조 안 된 것만 밝힌다)
const CD_BASIS_TAG = { second: { ko: ' (2차, 원문 미대조)', en: ' (secondary source, not checked against the standard)' }, practice: { ko: ' (업계 일반 관행, 원문 미대조)', en: ' (general industry practice, not checked against a standard)' },
  engine: { ko: '', en: '' }, policy: { ko: '', en: '' }, local: { ko: '', en: '' } };

/* ── 작은 도우미 ── */
const cdFill = (t, p) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => p && p[k] != null ? String(p[k]) : '—');
const cdUniq = a => [...new Set(a.filter(v => v != null && v !== ''))];
const cdW = n => '₩' + Math.round(+n || 0).toLocaleString('ko-KR');
const cdKRW = n => 'KRW ' + Math.round(+n || 0).toLocaleString('en-US');
const cdInLab = v => v == null ? '' : inFrac(v) + '"';
const cdD = x => x.q.size?.v ?? null;                                 // 호칭 (인치 in, 미터 mm)
const cdDin = x => x.q.size?.v == null ? null : x.q.system === 'inch' ? x.q.size.v : x.q.size.v / 25.4;
const cdSizeLab = x => !x.q.size ? '' : x.q.system === 'inch' ? inLab(x.q.size.label) : x.q.size.label;
const cdM = (x, ...a) => a.includes(x.q.mat?.code);
const cdF = (x, ...a) => a.includes(x.q.fin?.code);
const cdT = (x, ...a) => a.includes(x.q.type);
const cdSP = (x, k) => (x.q.special || []).includes(k);
const cdS = (x, s) => (x.q.stds || []).includes(s);
const cdR = (x, re) => re.test(x.q.text || '');
const cdIN = x => x.q.system === 'inch';
const cdMM = x => x.q.system === 'metric';
const CD_BOLTS = new Set(['stud', 'hexbolt', 'heavyhexbolt', 'bolt', 'capscrew', 'shcs', 'fhcs', 'bhcs', 'anchor', 'rod']);
// 영업일 (한국 달력: 페이지 isOff = 주말·HOLIDAYS)
function cdAddBD(d0, n) { const d = new Date(d0); d.setHours(12, 0, 0, 0); let k = Math.max(0, Math.round(n || 0)); while (k > 0) { d.setDate(d.getDate() + 1); if (!isOff(d)) k--; } return d; }
// 출고일: shipDate와 같은 계산(마감 CUTOFF 이후·휴일에 확정된 발주는 다음 영업일부터)이되 기준 시각을 받는다 (사양 10.3 납기 시험용)
function cdShipDate(now, days = 0) {
  const d = new Date(now);
  if (isOff(d) || d.getHours() >= CUTOFF) { do { d.setDate(d.getDate() + 1); } while (isOff(d)); }
  let k = days; while (k > 0) { d.setDate(d.getDate() + 1); if (!isOff(d)) k--; }
  return d;
}
const cdDateKo = d => d ? `${d.getMonth() + 1}월 ${d.getDate()}일(${DOW[d.getDay()]})` : '';
const cdDateEn = d => d ? `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}` : '';
// rfq.date: 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:MM' (KST 벽시계) / Date. 없으면 kstNow()
function cdNow(v) {
  if (v instanceof Date) return new Date(v);
  const m = String(v || '').match(/^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 10), +(m[5] || 0)) : kstNow();
}
const cdStamp = d => `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00+09:00`;
// BOM 번호 묶음: 3, 7, 12–19
function cdRefText(refs) {
  const out = [], nums = [];
  for (const r of refs) { if (/^\d+$/.test(r)) nums.push(+r); else out.push(r); }
  const s = cdUniq(nums).sort((a, b) => a - b), seg = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; seg.push(j - i >= 2 ? `${s[i]}–${s[j]}` : j > i ? `${s[i]}, ${s[j]}` : `${s[i]}`); i = j; }
  return [...seg, ...cdUniq(out)].join(', ');
}
// 32비트 FNV-1a (bomQuoteNo와 같은 해시)
function cdHash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

/* ── 영문 사양 문자열 (영문 열·내보내기용, 순서는 3.2절과 같다) ── */
// 품목 영문명: 공식 영문 품명 (e1n_names.js bomEnType; 예전 비공식 CD_TYPE_EN 표를 대신함)
const CD_FIN_EN = { PL: 'plain', BO: 'black oxide + oil', ZN: 'zinc plated', YZ: 'yellow zinc', ZB: 'black zinc', HDG: 'hot-dip galvanized', ZF: 'zinc flake', PTFE: 'fluoropolymer coated', ZNNI: 'zinc-nickel', PH: 'phosphate', CD: 'cadmium' };
function cdMatEn(code, cls) {
  if (!code) return '';
  if (/^(4\.6|4\.8|5\.8|8\.8|9\.8|10\.9|12\.9|010\.9)$/.test(code)) return 'PC ' + code;
  if (/^N(\d+)$/.test(code)) return 'nut PC ' + code.slice(1);
  if (/^A[24]$/.test(code)) return `${code}${cls ? '-' + cls : ''} stainless (ISO 3506)`;
  if (/^(B7M?|B8M?|B16)$/.test(code)) return 'ASTM A193 ' + code;
  if (/^(L7M?|L43)$/.test(code)) return 'ASTM A320 ' + code;
  if (code === '7ML') return 'ASTM A194 7M + low-temperature impact test (7ML as written in the BOM)';   // 7ML 등급·마킹은 허용 출처에 없음 (2026-10 감사)
  if (code === 'L7M-NUT') return 'ASTM A194 7M (low-temperature impact tested) or 2HM, to be confirmed at order';   // L7M 짝 너트 기본값 (e4_core NUT_FOR)
  if (/^(2HM?|7M?L?|8M?|4|3)$/.test(code)) return 'ASTM A194 ' + code;
  if (/^J429-(\d)$/.test(code)) return 'SAE J429 Gr ' + code.slice(-1);
  if (/^J995-(\d)$/.test(code)) return 'SAE J995 Gr ' + code.slice(-1);
  if (/^A563-/.test(code)) return 'ASTM A563 ' + code.slice(5);
  if (/^F1554-/.test(code)) return 'ASTM F1554 Gr ' + code.slice(6);
  if (/^(A325|A490)$/.test(code)) return 'ASTM F3125 ' + code;
  if (/^[A-F]\d{3,4}/.test(code)) return 'ASTM ' + code;
  return /[가-힣]/.test(code) ? '' : code;
}
function cdSpecEn(q) {
  if (!q) return '';
  const nm = bomEnType(q, true), t = nm.en, std = String(q.dimStd || '').replace(/\s*\([^)]*[가-힣][^)]*\)/g, '').trim();
  let thd = '';
  if (q.size) {
    if (q.system === 'metric') thd = `${q.size.label}${q.pitch ? 'x' + q.pitch : ''}${q.tolClass ? '-' + q.tolClass : ''}`;
    else if (q.system === 'inch') thd = `${q.size.label}${q.tpi ? '-' + q.tpi + ' ' + (q.series || '') : ''}${q.tolClass && /^[123][AB]$/.test(q.tolClass) ? '-' + q.tolClass : ''}`.trim();
    else thd = /[가-힣]/.test(q.size.label) ? '' : q.size.label;
  }
  const len = q.lengthIn ? ` x ${inFrac(q.lengthIn)}` : q.lengthMm ? ` x ${+q.lengthMm.toFixed(1)}` : '';
  const nuts = q.type === 'stud' && q.sub?.nuts && !/Nuts$/.test(t) ? ` w/ ${q.sub.nuts} heavy hex nuts` : '';
  const mat = q.mat ? cdMatEn(q.mat.code, q.mat.cls) + (q.type === 'stud' && q.sub?.nuts && q.mat.nut ? ' / ' + cdMatEn(q.mat.nut) : '') : '';
  return [t + nuts, std, thd + len, mat, q.fin ? CD_FIN_EN[q.fin.code] || '' : ''].filter(Boolean).join(', ');
}

// 엔진 카탈로그 차이 문구(한국어) → 영문 열용 짧은 문장
function cdDiffEn(d) {
  const s = String(d || ''); let m;
  if ((m = s.match(/길이 ([\d.,]+) mm는 비표준 → 표준 ([\d.]+) mm 또는 ([\d.]+) mm/))) return `length ${m[1]} mm is non-standard; standard ${m[2]} or ${m[3]} mm`;
  if ((m = s.match(/길이 ([\d.,]+) mm는 카탈로그 길이 범위 밖 → 표준 ([\d.]+) mm/))) return `length ${m[1]} mm is outside the catalog range; ${m[2]} mm offered`;
  if ((m = s.match(/^길이 ([\d.,]+) mm → 1 m 정척/))) return `length ${m[1]} mm; 1 m standard lengths`;
  if (/재질·등급/.test(s)) return 'grade not in catalog';
  if (/표면처리/.test(s)) return 'finish not in catalog';
  if (/호칭/.test(s)) return 'size outside catalog range';
  return 'catalog difference (see Korean text)';
}
// API 610 자동 매핑 제외 사유(엔진 문구) → 영문
function cdApiWhyEn(w) {
  const s = String(w || ''), m = s.match(/클래스 표기 (\d+)개/);
  return m ? `${m[1]} class designations` : /판 표기 충돌/.test(s) ? 'conflicting editions' : /13709/.test(s) ? 'the ISO 13709 year alone does not fix the API 610 edition'
    : /삭제된 클래스/.test(s) ? 'class removed in the 12th edition' : /자료 확인 중/.test(s) ? 'bolting data for material classes under review' : /자료에 없는 클래스/.test(s) ? 'class not in the data'
    : /ASTM 규격이 없음/.test(s) ? 'no ASTM bolting grade in the table' : 'see Korean text';
}
/* ── 문맥 읽기: RFQ 머리·구역 제목 줄·줄 원문에서 (사양 2.2절) ── */
const CD_STD_PREFIX = /^(ASME|ASTM|ISO|DIN|KS|JIS|API|EN|SAE|ANSI|NACE|MSS|BS|AMS|NAS|MIL|MS\d|AN\d|AWS|AISI|UNS|IFI|NFPA|B\d|A\d|F\d)/;   // 공개 규격은 '참조 문서'가 아님
const CD_REF_RE = /\b(?:PER|AS\s+PER|ACC(?:\.|ORDING)?\s+TO|REF\.?)\s+(?:(?:SPEC(?:IFICATION)?|DWG|DRAWING|STD|STANDARD)\.?\s*)?(?:NO\.?\s*)?([A-Z0-9][A-Z0-9\-_.\/]{2,})|(?:사양서|도면)\s*참조|첨부\s*(?:사양|도면)/g;
function cdRefDocs(text) {
  const U = String(text || '').toUpperCase(), out = [];
  for (const m of U.matchAll(CD_REF_RE)) {
    const doc = m[1] ? m[1].replace(/[.,;)]+$/, '') : null;
    if (doc && CD_STD_PREFIX.test(doc) && !/^(SPEC|DWG|STD)/.test(doc)) continue;   // 공개 규격 참조(ACC. TO ASME B16.5)는 제외
    out.push(doc || '참조 문서 (번호 미기재)');
  }
  return cdUniq(out);
}
function cdCtxOf(text) {
  const raw = String(text || ''), U = raw.toUpperCase(), c = {};
  const fl = U.match(/(?:\bNPS\s*)?(\d{1,2}(?:-\d\/\d)?|\d\/\d)\s*(?:"|IN\b|INCH)?\s*(?:NPS\s*)?(?:CL(?:ASS)?\.?\s*|#)(150|300|400|600|900|1500|2500)\b/) || U.match(/\bNPS\s*(\d{1,2}(?:-\d\/\d)?|\d\/\d)\b.*?\b(150|300|400|600|900|1500|2500)\s*(?:LB|#|CL)/);
  const cl = fl ? null : U.match(/\bB16\.5\b.*?\bCL(?:ASS)?\.?\s*(150|300|400|600|900|1500|2500)\b|\bCL(?:ASS)?\.?\s*(150|300|400|600|900|1500|2500)\s*(?:FLANGE|플랜지|RF\b|RTJ\b)/);
  if (fl) c.flange = { std: /B16\.47/.test(U) ? 'B16.47' : 'B16.5', nps: fl[1], cls: +fl[2], face: /\bRTJ\b|\bRJ\b/.test(U) ? 'RTJ' : /\bRF\b/.test(U) ? 'RF' : null };
  else if (cl) c.flange = { std: 'B16.5', nps: null, cls: +(cl[1] || cl[2]), face: null };
  if (/\bNACE\b|MR\s*0?175|MR\s*0?103|ISO\s*15156|\bSOUR\b|사워/.test(U)) c.nace = /MR\s*0?103/.test(U) ? 'MR0103' : /MR\s*0?175|15156/.test(U) ? 'MR0175' : 'NACE';
  if (/NON[\s-]*EXPOSED|비노출/.test(U)) c.exposure = 'non-exposed'; else if (/\bEXPOSED\b|노출\s*볼팅/.test(U)) c.exposure = 'exposed';   // 비노출을 먼저 본다
  const md = U.match(/\bMDMT\s*[:=]?\s*([-−–])?\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/);
  if (md) { const v = (md[1] ? -1 : 1) * +md[2]; c.mdmtC = md[3] === 'F' ? Math.round((v - 32) / 1.8) : v; }
  const dt = U.match(/DESIGN\s*TEMP\w*\s*[:=]?\s*([-−–])?\s*(\d+)\s*°?\s*C\b/); if (dt) c.designTempC = (dt[1] ? -1 : 1) * +dt[2];
  if (/\bTENSION(?:ER|ING)\b|HYDRAULIC\s*BOLT|텐셔너/.test(U)) c.tensioner = true;
  if (/\bVDRL\b|\bSDRL\b|\bSDDR\b|\bVDR\b|\bITP\b|\bMDR\b|\bMDD\b|DATA\s*BOOK/.test(U)) c.vdrl = true;
  if (/CASING|케이싱/.test(U)) c.part = 'casing'; else if (/AUX(?:ILIARY)?\.?\s*PIPING|보조\s*배관/.test(U)) c.part = 'aux';
  const docs = [];
  if (/\b3\.1\b|EN\s*10204|\bMTC\b|MILL\s*(?:TEST\s*)?CERT|밀\s*시트/.test(U) && !/EN\s*10204\s*(?:TYPE\s*)?3\.2/.test(U)) docs.push('3.1');
  if (/EN\s*10204\s*(?:TYPE\s*)?3\.2|\bTYPE\s*3\.2|\b3\.2\s*(?:CERT|INSP|성적서)/.test(U)) docs.push('3.2');
  if (/EN\s*10204\s*(?:TYPE\s*)?2\.2|\bTYPE\s*2\.2/.test(U)) docs.push('2.2');
  if (/KOLAS/.test(U)) docs.push('KOLAS');
  if (/\bPMI\b/.test(U)) docs.push('PMI');
  if (/ORIGIN|원산지|\bC\/O\b/.test(U)) docs.push('origin');
  if (/3\.1\s*(?:CERT\w*\s*)?(?:ISSUED\s*)?BY\s*(?:THE\s*)?(?:SUPPLIER|VENDOR|SELLER|DISTRIBUTOR|BOLTNOTE)|(?:SUPPLIER|VENDOR|SELLER)(?:'S)?\s*(?:EN\s*10204\s*)?3\.1|(?:공급자|판매자|유통사)\s*(?:명의\s*)?(?:EN\s*10204\s*)?3\.1/.test(U)) docs.push('3.1-self');
  if (docs.length) c.docs = docs;
  const sc = U.match(/원자력|원전|KEPIC|NUCLEAR|ASME\s*(?:SEC(?:TION)?\.?\s*)?III\b|CLASS\s*SOCIETY|선급\s*(?:증명|인증|검사|승인)|(?:KR|ABS|DNV|LR|BV)\s*선급|\bPED\b|2014\/68\/EU|AS\s*9100/);
  if (sc) c.scope = sc[0];
  if (/COLOU?R\s*COD(?:E|ING)|색상\s*코드/.test(U)) c.colorCode = true;
  if (/HEAT\s*(?:NO\.?|NUMBER)\s*(?:STAMP|MARK)|히트\s*번호\s*각인/.test(U)) c.heatStamp = true;
  const api = typeof parseApi610 === 'function' ? parseApi610(raw) : null;
  if (api && api.cls) c.api610 = api;
  const refs = cdRefDocs(raw); if (refs.length) c.refDocs = refs;
  return c;
}
// 구역 제목 줄: 수량 없음 + 체결부품 단어 없음 + 문맥(플랜지·API 610·NACE·MDMT·태그)이 읽힘
const CD_FAST_WORD = /BOLT|STUD|NUT\b|NUTS\b|SCREW|WASHER|\bROD\b|ANCHOR|\bSHCS\b|\bHHCS\b|\bSCS\b|볼트|너트|스터드|와셔|나사|앵커/i;
function cdSectionOf(row) {
  if (!row || (row.qty != null && String(row.qty).trim() !== '')) return null;
  const t = String(row.text || '');
  if (!t.trim() || CD_FAST_WORD.test(t)) return null;
  const c = cdCtxOf(t), tags = t.match(/\b[A-Z]{1,3}-\d{2,4}[A-Z]?(?:\/[A-Z])?\b/g);
  if (tags) c.tags = cdUniq(tags);
  return c.flange || c.api610 || c.nace || c.mdmtC != null || c.part || c.tags ? c : null;
}
/* 붙여넣은 BOM 글 → items. 구역 제목 줄은 견적 줄이 아니라 다음 줄들의 문맥(sec)이 된다.
   API 610 문맥: 줄 > 구역 > RFQ 순서로 bomLine(row, ov, { api610 })에 넘긴다 */
function cdItems(text, rfq = {}, ovOf = null) {
  const parsed = bomRows(text, rfq.roles), rctx = cdRfqCtx(rfq), out = [], seen = {};
  let sec = null;
  for (const r of parsed.rows) {
    const s = cdSectionOf(r);
    if (s) { sec = { ...s, text: r.text, no: r.no }; out.push({ row: r, section: true, sec }); continue; }
    const api = sec?.api610 || rctx.api610 || null;
    const k = `${r.text}§${(seen[r.text] = (seen[r.text] || 0) + 1)}`;
    const L = bomLine(r, (ovOf && ovOf(k, r)) || {}, api ? { api610: api } : {});
    L.key = k; if (sec) L.sec = sec;
    out.push(L);
  }
  return out;
}
// RFQ 머리 문맥 (rfq.context 값 + rfq.contextText 글에서 읽은 값; 직접 넣은 값이 우선)
function cdRfqCtx(rfq = {}) {
  const c0 = rfq.context || {}, fromText = rfq.contextText ? cdCtxOf(rfq.contextText) : {}, c = { ...fromText, ...c0 };
  if (typeof c.api610 === 'string') c.api610 = parseApi610(/API|13709/i.test(c.api610) ? c.api610 : 'API 610 ' + c.api610);
  if (c.flange && typeof c.flange === 'string') c.flange = cdCtxOf(c.flange).flange || null;
  if (c.nace === true) c.nace = 'NACE';
  c.docs = cdUniq([...(fromText.docs || []), ...(c0.docs || [])]);
  return c;
}

/* ── B16.5 볼트 표: 제조사 공개 차트 3곳 대조 참고값 (2026-10 감사, 출처 목록은 감사 기록에 있음).
   base.html B165_*와 같은 값. NPS 22와 Class 600 NPS 8 RTJ는 3곳이 맞지 않아 뺐다.
   [NPS, 볼트 수, 호칭-산수, RF 스터드 길이 in, RTJ 스터드 길이 in | null]. 포인트 포함 여부는 주문 때 확인 */
const CD_B165 = {
  150: [['1/2', 4, '1/2-13', 2.25, null], ['3/4', 4, '1/2-13', 2.5, null], ['1', 4, '1/2-13', 2.5, 3], ['1-1/4', 4, '1/2-13', 2.75, 3.25], ['1-1/2', 4, '1/2-13', 2.75, 3.25], ['2', 4, '5/8-11', 3.25, 3.75], ['2-1/2', 4, '5/8-11', 3.5, 4], ['3', 4, '5/8-11', 3.5, 4], ['3-1/2', 8, '5/8-11', 3.5, 4], ['4', 8, '5/8-11', 3.5, 4], ['5', 8, '3/4-10', 3.75, 4.25], ['6', 8, '3/4-10', 4, 4.5], ['8', 8, '3/4-10', 4.25, 4.75], ['10', 12, '7/8-9', 4.5, 5], ['12', 12, '7/8-9', 4.75, 5.25], ['14', 12, '1-8', 5.25, 5.75], ['16', 16, '1-8', 5.25, 5.75], ['18', 16, '1-1/8-8', 5.75, 6.25], ['20', 20, '1-1/8-8', 6.25, 6.75], ['24', 20, '1-1/4-8', 6.75, 7.25]],
  300: [['1/2', 4, '1/2-13', 2.5, 3], ['3/4', 4, '5/8-11', 3, 3.5], ['1', 4, '5/8-11', 3, 3.5], ['1-1/4', 4, '5/8-11', 3.25, 3.75], ['1-1/2', 4, '3/4-10', 3.5, 4], ['2', 8, '5/8-11', 3.5, 4], ['2-1/2', 8, '3/4-10', 4, 4.5], ['3', 8, '3/4-10', 4.25, 4.75], ['3-1/2', 8, '3/4-10', 4.25, 5], ['4', 8, '3/4-10', 4.5, 5], ['5', 8, '3/4-10', 4.75, 5.25], ['6', 12, '3/4-10', 4.75, 5.5], ['8', 12, '7/8-9', 5.5, 6], ['10', 16, '1-8', 6.25, 6.75], ['12', 16, '1-1/8-8', 6.75, 7.25], ['14', 20, '1-1/8-8', 7, 7.5], ['16', 20, '1-1/4-8', 7.5, 8], ['18', 24, '1-1/4-8', 7.75, 8.25], ['20', 24, '1-1/4-8', 8, 8.75], ['24', 24, '1-1/2-8', 9, 10]],
  600: [['1/2', 4, '1/2-13', 3, 3], ['3/4', 4, '5/8-11', 3.5, 3.5], ['1', 4, '5/8-11', 3.5, 3.5], ['1-1/4', 4, '5/8-11', 3.75, 3.75], ['1-1/2', 4, '3/4-10', 4.25, 4.25], ['2', 8, '5/8-11', 4.25, 4.25], ['2-1/2', 8, '3/4-10', 4.75, 4.75], ['3', 8, '3/4-10', 5, 5], ['3-1/2', 8, '7/8-9', 5.5, 5.5], ['4', 8, '7/8-9', 5.75, 5.75], ['5', 8, '1-8', 6.5, 6.5], ['6', 12, '1-8', 6.75, 6.75], ['8', 12, '1-1/8-8', 7.5, null], ['10', 16, '1-1/4-8', 8.5, 8.5], ['12', 20, '1-1/4-8', 8.75, 8.75], ['14', 20, '1-3/8-8', 9.25, 9.25], ['16', 20, '1-1/2-8', 10, 10], ['18', 20, '1-5/8-8', 10.75, 10.75], ['20', 24, '1-5/8-8', 11.25, 11.5], ['24', 24, '1-7/8-8', 13, 13.25]],
};
function cdB165(cls, nps) {
  const rows = CD_B165[cls]; if (!rows || !nps) return null;
  const r = rows.find(x => x[0] === String(nps)); if (!r) return null;
  const [dl, tpi] = r[2].split(/-(?=\d+$)/);
  return { nps: r[0], n: r[1], thread: r[2], dia: inVal(dl), tpi: +tpi, rf: r[3], rtj: r[4] };
}

/* ── 고정 문구 (근거는 조항 번호만) ── */
const CD_HRC = { '10.9': '32–39 HRC', '12.9': '39–44 HRC', '45H': '45–53 HRC', F912: '45–53 HRC' };   // ISO 898-1·ASTM F912 (A574·J429-8 경도 범위는 공개 출처가 없어 뺐다, 2026-10 감사)
const CD_NA_WHERE = { pipe: ['배관 자재 공급처', 'a piping material supplier'], valve: ['밸브 공급처', 'a valve supplier'], gasket: ['개스킷 공급처', 'a gasket supplier'], oring: ['실(seal) 전문 공급처', 'a seal supplier'],
  tool: ['공구 공급처', 'a tool supplier'], clinch: ['제조사나 공식 대리점', 'the manufacturer or its authorised distributor'], expanchor: ['인증 앵커 제조사나 공식 대리점', 'the certified anchor manufacturer or its distributor'],
  insert: ['인서트 제조사나 공식 대리점', 'the insert manufacturer or its distributor'], rivet: ['리벳 공급처', 'a rivet supplier'], ring: ['기계요소 공급처', 'a machine-element supplier'], pin: ['기계요소 공급처', 'a machine-element supplier'],
  key: ['기계요소 공급처', 'a machine-element supplier'], discspring: ['스프링 공급처', 'a spring supplier'], nonfast: ['해당 부품 공급처나 장비 제조사', 'the part supplier or equipment maker'],
  NAS: ['인증된 항공 부품 유통사', 'a certified aerospace parts distributor'], MS: ['인증된 MS 부품 유통사', 'a certified MS parts distributor'], AN: ['인증된 항공 부품 유통사', 'a certified aerospace parts distributor'],
  aero: ['항공 인증 공급사', 'an aerospace-qualified supplier'], TI: ['티타늄 체결부품 공급처', 'a titanium fastener supplier'], micro: ['초소형 나사 전문 공급처', 'a micro-screw supplier'], big: ['대형 체결부품 제작사', 'a large-fastener maker'],
  partno: ['장비 제조사', 'the equipment maker'], variant: ['제조사나 공식 대리점', 'the manufacturer or its authorised distributor'] };
const CD_TIER_EN = { OWN_STOCK: 'Own stock', PARTNER_STOCK: 'Wholesaler stock', MRO_BACKUP: 'Wholesaler sourcing', IMPORT_VIA_KR_MRO: 'Import', DOMESTIC_MFG: 'Made to order (domestic)', IMPORT_US: 'Import', IMPORT_US_MFG: 'Import, made to order', NO_SOURCE: 'Quote on request' };
const CD_QTY_EN = { ar: 'quantity given as required (A/R)', zero: 'quantity is zero', neg: 'negative quantity', pack: 'pack quantity without pieces per pack', packconv: 'pack quantity converted to pieces',
  per: 'quantity per assembly', pair: 'quantity in pairs', lot: 'quantity in lots', dot3: 'dot may be a thousands separator', frac: 'fractional quantity rounded up', unitM: 'unit M (metres) does not fit this item', none: 'no quantity given',
  exp: 'exponent notation (spreadsheet conversion)', nonnum: 'quantity is not a number', big: 'quantity above 1,000,000' };

/* ── 규칙 표 (사양 5장). 필드:
   id · type C|D|E (또는 p => …) · cat · act APPROVE|CONFIRM|INFO · queue auto|gc|conflict|unread|ambiguous|dev|qty|na · basis
   ev: 엔진 이벤트로 발화(true면 같은 ID, 문자열이면 그 이벤트) · when(x): 줄 조건 → params | false · unless(x): 막는 조건
   bom(lines, D): BOM 전체 검사 → [{ lines, p }] · rfq(D): RFQ 문맥 검사 → [{ p, ref, req }]
   p(p, x): params 보정 · g(p, x): 묶음 키 (같은 키 = 한 행) · gc: 행 대신 GC 항목 · out:'none': 행 없음(엔진 메모)
   ko/en: 템플릿 · offer(p, x, D) → {ko,en} · req(p, x) → 원문 인용 대신 쓸 요구사항 · refs · imp: none|tbd|cow|excluded|option|lead|fn ── */
const CD_RULES = [];
const cdRule = (id, type, cat, act, queue, basis, o) => CD_RULES.push({ id, type, cat, act, queue, basis, ...o });
const cdOff = (ko, en) => ({ ko, en });
const cdSameSpec = (p, x) => ({ ko: x.m.spec || x.q.typeLabel || '', en: cdSpecEn(x.q) });

/* A — 기본값 가정 */
cdRule('A-THD-PITCH', 'C', 'THD', 'CONFIRM', 'auto', 'local', { ev: true, p: p => ({ sp: `${p.size}: ${p.pitch} mm` }), g: () => 'coarse', offer: () => cdOff('ISO 261 보통나사', 'ISO 261 coarse thread'),
  ko: '피치 미기재 → ISO 261 보통나사로 견적했습니다 ({sp}). 가는나사가 필요하면 알려 주십시오.', en: 'Pitch not stated: quoted as ISO 261 coarse thread ({sp}). Advise if fine pitch is required.', refs: ['ISO 261'] });
cdRule('A-THD-TPI', 'C', 'THD', 'CONFIRM', 'auto', 'practice', { ev: true, p: p => ({ st: `${inLab(p.size)} ${p.tpi} TPI ${p.series || ''}`.trim() }), g: p => p.series === '8UN' ? '8UN' : 'UNC', offer: p => cdOff(p.st, p.st),
  ko: '산 수 미기재 → {st}로 견적했습니다. 1" 이하는 UNC, 1" 초과 스터드·헤비너트는 보통 8UN입니다.', en: 'Threads per inch not stated: quoted as {st}. UNC up to 1 in.; studs and heavy nuts above 1 in. are usually 8UN.',
  refs: ['ASME B1.1'] });
cdRule('A-TOL-M', 'C', 'THD', 'INFO', 'gc', 'local', { ev: true, gc: 'GC-T03' });
cdRule('A-TOL-IN', 'C', 'THD', 'INFO', 'gc', 'local', { ev: true, gc: 'GC-T03' });
cdRule('A-TOL-WRONG', 'C', 'THD', 'CONFIRM', 'ambiguous', 'local', { ev: true, g: p => `${p.stated}>${p.to}`,
  ko: '적힌 공차 {stated}는 반대쪽(수나사/암나사) 등급입니다. {to}로 보고 견적했습니다. 맞는지 확인해 주십시오.', en: 'Tolerance {stated} is a class for the mating thread; quoted as {to}. Please confirm.',
  refs: ['ISO 965-1', 'ASME B1.1'] });
cdRule('A-LEN-CONV', 'C', 'DIM', 'CONFIRM', 'auto', 'engine', { ev: true, p: p => ({ cv: `${p.mm} mm → ${inFrac(p.in)}" (${p.in})` }), g: p => `${p.mm}`,
  ko: '길이 {cv}로 환산했습니다(1 in = 25.4 mm). 환산 길이로 견적했습니다.', en: 'Length {cv} converted (1 in. = 25.4 mm) and quoted at the converted length.', refs: [] });
cdRule('A-LEN-ROD', 'C', 'DIM', 'CONFIRM', 'auto', 'practice', { ev: true, offer: () => cdOff('1 m 정척', '1 m standard length'),
  ko: '전산볼트 길이 미기재 → 1 m 정척으로 견적했습니다.', en: 'Threaded rod length not stated: quoted in 1 m standard lengths.', refs: ['DIN 976-1'] });
cdRule('A-LEN-NONE', 'C', 'DIM', 'CONFIRM', 'ambiguous', 'engine', { ev: true,
  ko: '길이가 없습니다. 길이와 길이 기준을 알려 주십시오. 길이가 정해지기 전에는 단가를 확정하지 않습니다.', en: 'Length missing. Please advise length and basis; price is not fixed until then.', refs: [], imp: 'tbd' });
cdRule('A-GRADE', 'C', 'MAT', 'CONFIRM', (p, x) => ['stud', 'heavyhexbolt', 'heavynut'].includes(x.q.type) || cdIN(x) ? 'ambiguous' : 'auto', 'local', { ev: true,
  p: p => ({ mat: p.mat ? MAT_KO[p.mat] || p.mat : null, matEn: p.mat ? cdMatEn(p.mat) || p.mat : null }), g: p => p.mat || 'ask', offer: p => p.mat ? cdOff(p.mat, p.matEn) : cdOff('재질 확인 후 견적', 'To be quoted after material is confirmed'),
  ko: p => p.mat ? '재질·강도 미기재 → {mat}로 가정했습니다. 다른 등급이면 단가가 바뀝니다.' : '재질·강도 등급이 없습니다. 재질을 알려 주십시오.',
  en: p => p.mat ? 'Material/grade not stated: assumed {matEn}. Price changes if another grade is required.' : 'Material/grade not stated. Please advise.',
  refs: ['ISO 898-1/-2/-5', 'ASME B18.2.2', 'ASME B18.2.1'] });
cdRule('A-MATSPEC', 'C', 'MAT', 'INFO', 'auto', 'local', { ev: true, p: p => ({ mat: MAT_KO[p.mat] || p.mat, matEn: cdMatEn(p.mat) }), g: p => p.mat, offer: p => cdOff(p.mat, p.matEn),
  ko: '재질 규격 번호가 없어 제품 규격이 정한 재질 규격 {mat}로 적었습니다.', en: 'Material specification number not stated: {matEn} (as referenced by the product standard).',
  refs: ['ASME B18.3', 'ASME B18.2.2', 'ASME B18.2.1'] });
cdRule('A-SS-ALLOY', 'C', 'MAT', 'CONFIRM', 'auto', 'second', { ev: true, g: p => p.code, offer: p => cdOff(`${p.alloy} (${p.code})`, `${p.alloy} (${p.code})`),
  ko: '스테인리스 강종 미기재 → {alloy}({code})로 가정했습니다. 316(A4)이 필요하면 알려 주십시오.', en: 'Stainless grade not stated: assumed {alloy} ({code}). Advise if 316 (A4) is required.', refs: ['ISO 3506-1/-2'] });
cdRule('A-SS-CLASS', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, p: p => ({ cc: `${p.code}-${p.cls}` }), g: p => `${p.code}-${p.cls}`, offer: p => cdOff(`ISO 3506 ${p.cc}`, `ISO 3506 ${p.cc}`),
  ko: '강도 구분 미기재 → ISO 3506 {cc}로 견적했습니다(볼트·너트 70, 멈춤나사 21H 기본). 다른 강도 구분이면 알려 주십시오.', en: 'Property class not stated: quoted ISO 3506 {cc} (default 70 for bolts/nuts, 21H for set screws). Advise if another class is required.', refs: ['ISO 3506-1/-2'] });
cdRule('A-NUT-GRADE', 'C', 'MAT', 'CONFIRM', 'auto', 'second', { ev: true, p: p => ({ matS: cdMatEn(p.mat), nutKo: p.nut === 'L7M-NUT' ? 'ASTM A194 7M(저온 충격시험) 또는 2HM 헤비너트(주문 때 확인)' : `ASTM A194 ${p.nut} 헤비너트`, nutEn: p.nut === 'L7M-NUT' ? 'ASTM A194 7M (low-temperature impact tested) or 2HM heavy hex nuts (to be confirmed at order)' : `ASTM A194 ${p.nut} heavy hex nuts` }), g: p => `${p.mat}/${p.nut}`, offer: p => cdOff(p.nutKo, p.nutEn),
  ko: '너트 등급 미기재 → {matS} 짝인 {nutKo}로 견적했습니다.', en: 'Nut grade not stated: quoted {nutEn} matching {matS}.',
  refs: ['ASTM A194'] });
cdRule('A-NUT-STYLE', 'C', 'DIM', 'INFO', 'auto', 'second', { ev: true, g: () => 'heavy', offer: () => cdOff('헤비 육각너트 (ASME B18.2.2)', 'Heavy hex nut (ASME B18.2.2)'),
  ko: 'A194 너트는 헤비 육각(ASME B18.2.2)으로 봤습니다. 일반 육각이면 알려 주십시오.', en: 'A194 nuts taken as heavy hex (ASME B18.2.2). Advise if regular hex is required.', refs: ['ASME B18.2.2'] });
cdRule('A-NUT-INCL', 'C', 'COM', 'CONFIRM', 'ambiguous', 'practice', { ev: true, offer: () => cdOff('스터드만 (너트 별도)', 'Studs only (nuts not included)'),
  ko: '너트 포함 여부가 없어 스터드만 견적했습니다. 스터드 하나에 헤비너트 2개가 필요하면 알려 주십시오.', en: 'Nuts not mentioned: studs only quoted. Advise if two heavy hex nuts per stud are required.', refs: [], imp: 'option' });
cdRule('A-FIN', 'C', 'CTG', 'CONFIRM', 'auto', 'local', { ev: true, p: p => ({ finKo: FIN_KO[p.fin] || p.fin, finEn: CD_FIN_EN[p.fin] || p.fin }), g: p => p.fin, offer: p => cdOff(p.finKo, p.finEn),
  ko: '표면처리 미기재 → {finKo}로 견적했습니다.', en: 'Finish not stated: quoted {finEn}.',
  refs: ['ASME B18.2.1', 'ASME B18.2.2', 'ASME B18.3'] });
cdRule('A-FIN-CAT', 'C', 'CTG', 'INFO', 'auto', 'engine', { ev: true, p: p => ({ finKo: FINISH[p.fin]?.label || p.fin, finEn: p.fin }), g: p => p.fin, offer: p => cdOff(p.finKo, p.finEn),
  ko: '표면처리 미기재 → 카탈로그 기본 {finKo}로 공급합니다.', en: 'Finish not stated: supplied in catalog standard finish ({finEn}).', refs: [] });
cdRule('A-POINT', 'C', 'DIM', 'CONFIRM', 'auto', 'second', { ev: true, g: () => 'cup', offer: () => cdOff('컵 포인트', 'Cup point'),
  ko: '끝 형상 미기재 → 컵 포인트로 견적했습니다.', en: 'Point not stated: quoted cup point.', refs: ['ISO 4029', 'ASME B18.3'] });
cdRule('A-HB-THREAD', 'C', 'DIM', 'CONFIRM', 'auto', 'engine', { ev: true, g: () => 'full', offer: () => cdOff('온나사 ISO 4017', 'Full thread ISO 4017'),
  ko: '나사부 길이 표기가 없어 온나사(ISO 4017)로 견적했습니다. 반나사(ISO 4014)가 필요하면 알려 주십시오.', en: 'Thread length not stated: quoted full thread (ISO 4017). Advise if partial thread (ISO 4014) is required.', refs: ['ISO 4014', 'ISO 4017'] });
cdRule('A-DIN-ISO', 'C', 'DIM', p => p.head ? 'CONFIRM' : 'INFO', 'auto', 'engine', { ev: true, g: p => `${p.din}>${p.iso}`, offer: p => cdOff(p.iso, p.iso),
  ko: p => p.head ? '{din} → {iso}로 공급합니다(대체 규격). 머리 치수가 같은지는 확인하지 못했으니 조립 공간을 확인해 주십시오.' : '{din} → {iso}로 공급합니다 (대체 규격, {size}는 2면폭 같음).',
  en: p => p.head ? '{din} supplied as {iso} (replacement standard); head dimensions not confirmed identical, please check fit.' : '{din} supplied as {iso} (replacement standard; same across flats for {size}).', refs: ['ISO 4014/4017/4032/4762/10642', 'ISO 272'] });
cdRule('A-NORM', 'C', 'THD', 'INFO', 'auto', 'local', { ev: true, g: p => `${p.from}>${p.to}`,
  ko: '원문 표기 {from}를 {to}로 읽었습니다.', en: 'Read {from} as {to}.', refs: ['ASME B1.1'] });
cdRule('A-MERGE', 'C', 'COM', 'CONFIRM', 'ambiguous', 'engine', { ev: true, g: () => 'merge',
  ko: '품명 칸이 비어 위 줄(No {from}) 사양을 이어 받았습니다(엑셀 병합 셀). 다른 품목이면 고쳐 주십시오.', en: 'Description blank: specification inherited from line {from} (merged cell). Correct if different.', refs: [] });
cdRule('A-VARIANT', 'C', 'DIM', 'INFO', 'auto', 'engine', { ev: true, g: p => p.variant, p: p => ({ stdEn: String(p.std || '').replace(/\s*\([^)]*[가-힣][^)]*\)/g, '') || 'non-standard' }),
  ko: '{label}은 표준 카탈로그 품목이 아니어서 일반품으로 바꾸지 않고 적힌 사양대로 수배합니다. 치수·재질은 도면이나 제조사 품번으로 확정합니다.',
  en: 'Variant item ({stdEn}) is not a standard catalog item; sourced as written, not substituted. Dimensions and material to be confirmed by drawing or maker\'s P/N.', refs: [], imp: 'tbd' });
cdRule('A-HEAD', 'C', 'DIM', 'CONFIRM', 'ambiguous', 'engine', { ev: true, g: p => p.why,
  ko: p => p.why === 'type' ? '품목명(볼트·너트·와셔·멈춤나사 등)이 없습니다. 품목을 알려 주시면 견적합니다.' : '머리 형상(육각·소켓·접시 등)이 없습니다. 확인 후 견적합니다.',
  en: p => p.why === 'type' ? 'Item type not stated. To be confirmed before pricing.' : 'Head style not stated. To be confirmed before pricing.', refs: [], imp: 'tbd' });
cdRule('A-CTX', 'C', 'COM', 'INFO', 'auto', 'engine', { ev: true, g: p => `${p.field}:${p.to}`,
  ko: '구역·줄 문맥이 RFQ 문맥을 덮어썼습니다: {field} {from} → {to}.', en: 'Section/line context overrides the RFQ context: {field} {from} → {to}.', refs: [] });

/* S — 대체·판·호환 */
cdRule('S-A194-GR4', 'D', 'MAT', 'APPROVE', 'dev', 'local', {
  when: x => (NUTS.has(x.q.type) && cdM(x, '4')) || x.q.mat?.nut === '4' ? { L: cdM(x, 'L7', 'L43') ? 'L' : '', size: cdSizeLab(x) } : false,   // 저온 볼팅(L7·L43)이면 7L
  g: p => `7${p.L}`, offer: (p, x) => cdOff(`헤비 육각너트 ASME B18.2.2, ${cdSizeLab(x)}, ASTM A194 Grade 7${p.L}`, `Heavy hex nut ASME B18.2.2, ${x.q.size?.label || ''}, ASTM A194 Grade 7${p.L}`),
  ko: 'ASTM A194 Grade 4 너트 → Grade 7{L} 너트로 제안합니다. Grade 4는 옛 사양서 등급이라 공급이 어렵고, A194는 구매자 허락 없이 등급을 바꾸지 않으므로 승인 후에만 진행합니다. Grade 4로 꼭 공급해야 하면 알려 주십시오. 공급 가능 여부를 확인해 회신합니다.',
  en: 'ASTM A194 Grade 4 nuts offered as Grade 7{L}. Grade 4 appears in older specifications and is hard to source; A194 grades are not substituted without the purchaser\'s permission, so this proceeds only on approval. If Grade 4 is mandatory, please advise and availability will be confirmed.',
  refs: ['ASTM A194/A194M-26 §1.1'], imp: 'cow' });
cdRule('S-A320-L7-SIZE', 'C', 'MAT', 'CONFIRM', 'auto', 'second', {
  when: x => cdM(x, 'L7', 'L7A', 'L7B', 'L7C') && cdDin(x) != null && cdDin(x) > 2.5 + 1e-6 ? { mat: x.q.mat.code, size: cdSizeLab(x) } : false, g: p => p.mat,
  ko: 'A320 {mat} {size}: L7의 최소 기계적 성질은 2-1/2"[65 mm] 이하에만 정해져 있습니다(공개 기술자료 기준). 굵은 지름에 쓸 등급(L43 등)과 그 적용 범위는 규격서로 확인해 회신합니다. 너트는 A194 7L(저온 충격시험)입니다.',
  en: 'A320 {mat} {size}: L7 minimum properties are specified up to 2-1/2 in. [65 mm] only (published technical data). The grade for larger diameters (e.g. L43) and its size range will be confirmed against the standard and advised. Nuts: A194 7L (low-temperature impact tested).',
  refs: ['ASTM A320'], imp: 'tbd' });
cdRule('S-L7-NUT', 'C', 'MAT', 'INFO', 'auto', 'local', {
  when: x => cdM(x, 'L7', 'L43') && x.q.sub?.nuts && /\bA194\s*(?:GR(?:ADE)?\.?\s*)?7\b(?![LM])|\/\s*7\b(?![LM])/.test(x.q.text) && !/\b7L\b|\bS3\b/.test(x.q.text) ? { mat: x.q.mat.code } : false, g: p => p.mat,
  ko: 'A320 {mat} 볼팅의 너트는 충격 요건을 만족해야 하므로 A194 저온 충격시험 보충 요건을 거친 너트(7L 마킹)로 공급합니다.',
  en: 'Nuts for A320 {mat} bolting must meet impact requirements; supplied as A194 nuts with the low-temperature impact test supplementary requirement (marked 7L).',
  refs: ['ASTM A320/A320M-26 §1.2', 'ASTM A194'] });
cdRule('S-F3125', 'C', 'MAT', 'CONFIRM', 'auto', 'second', { ev: true, when: x => cdS(x, 'ASTM F1852') || cdS(x, 'ASTM F2280') ? { mat: 'F1852/F2280' } : false,
  p: p => ({ g: p.mat === 'A490' ? 'A490' : p.mat === 'A325' ? 'A325' : p.mat }), g: p => p.g,
  ko: '{g}는 ASTM F3125 Grade {g}로 공급합니다. A325·A490·F1852·F2280은 F3125로 통합되었습니다. F3125 A325는 지름과 관계없이 최소 인장 120 ksi입니다(구 A325는 굵은 지름을 105 ksi로 정했습니다).',
  en: '{g} supplied to ASTM F3125 Grade {g}. A325, A490, F1852 and F2280 are consolidated into F3125. F3125 A325 has a minimum tensile strength of 120 ksi in all sizes (the old A325 specified 105 ksi for larger diameters).',
  refs: ['RCSC 2025', 'ASTM F3125'] });
cdRule('S-B18-2-6', 'C', 'DIM', 'INFO', 'auto', 'local', { when: x => cdM(x, 'A325', 'A490') && cdS(x, 'ASME B18.2.1'), g: () => 'b1826',
  ko: '구조용 헤비 육각볼트는 ASME B18.2.1이 아니라 ASME B18.2.6 치수로 공급합니다.', en: 'Structural heavy hex bolts are supplied to ASME B18.2.6 dimensions (not covered by B18.2.1).', refs: ['RCSC 2025 §2.2 Commentary'] });
cdRule('S-B8-CL2', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, p: (p, x) => ({ size: cdSizeLab(x) }),
  g: p => p.mat, ko: 'A193 {mat} Class 2(가공경화)는 지름에 따라 강도가 다릅니다. {size}의 강도 값은 규격서로 확인해 회신하니, 설계 기준값을 알려 주십시오.',
  en: 'A193 {mat} Class 2 (strain hardened) strength varies with diameter. Values for {size} will be confirmed against the standard; please advise your design values.', refs: ['ASTM A193'] });
cdRule('S-B8-CL2-OVER', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, p: (p, x) => ({ size: cdSizeLab(x) }), g: p => p.mat,
  ko: '{mat} Class 2 {size}: 이 지름의 Class 2 강도 값은 규격서로 확인 중입니다. 엔지니어가 확인해 회신하니, 필요한 강도(설계 조건)를 알려 주십시오.',
  en: '{mat} Class 2 {size}: Class 2 strength values for this diameter are under review against the standard. An engineer will confirm and reply; please advise the required strength (design conditions).', refs: ['ASTM A193'], imp: 'tbd' });
cdRule('S-B8-CL1', 'C', 'MAT', 'CONFIRM', 'auto', 'second', { ev: true, unless: x => (x.ctx.flange?.cls || 0) >= 400, g: p => p.mat,
  ko: 'Class 미기재 → A193 {mat} Class 1(고용화처리, 항복 30 ksi)로 견적했습니다. 플랜지 등급과 볼트 강도 조합은 설계 조건으로 확인해 주십시오.',
  en: 'Class not stated: quoted A193 {mat} Class 1 (carbide solution treated, 30 ksi yield). Please confirm the combination of bolt strength and flange class against the design conditions.', refs: ['ASTM A193'] });
cdRule('S-B7-SIZE', 'C', 'MAT', 'INFO', 'auto', 'second', { when: x => cdM(x, 'B7') && cdIN(x) && cdD(x) > 2.5 + 1e-6 ? { size: cdSizeLab(x) } : false, g: () => 'b7',
  ko: 'B7 {size}는 2-1/2" 초과라 최소 강도가 115/95 ksi입니다(4" 초과 100/75).', en: 'B7 {size} is over 2-1/2 in.; minimum strength 115/95 ksi (100/75 above 4 in.).', refs: ['ASTM A193'] });
cdRule('S-HDG-NUT10', 'C', 'MAT', 'CONFIRM', 'auto', 'second', {
  bom: (L) => { const out = []; for (const n of L.filter(x => cdMM(x) && NUTS.has(x.q.type) && cdF(x, 'HDG') && (cdM(x, 'N8') || x.q.mat?.def))) {
    const b = L.find(x => x !== n && cdMM(x) && CD_BOLTS.has(x.q.type) && cdF(x, 'HDG') && cdM(x, '8.8') && x.q.size?.label === n.q.size?.label);
    if (b) out.push({ lines: [n], p: { size: n.q.size.label, bLines: b.ref } }); } return out; }, g: () => 'n10',
  ko: '용융아연도금 너트는 도금 후 6AZ로 오버탭합니다. 8.8 볼트(BOM No {bLines})와 조립할 너트에 강도 10이 필요한지 확인해 주십시오. 현재 견적은 강도 8 HDG 너트({size})입니다.',
  en: 'HDG nuts are tapped 6AZ after coating. Please confirm whether property class 10 nuts are required with the 8.8 bolts (line {bLines}). Quoted: class 8 HDG nuts ({size}).', refs: ['ISO 10684 §6.2.2'], imp: 'option' });
cdRule('S-HDG-M8', 'C', 'CTG', 'CONFIRM', 'auto', 'second', { when: x => cdMM(x) && cdF(x, 'HDG') && x.q.size && (cdD(x) < 8 || (x.q.pitch && x.q.pitch < 1.25)) ? { size: x.q.size.label } : false, g: () => 'm8',
  ko: '{size}는 ISO 10684 용융아연도금 적용 범위(M8~M64) 밖으로 알려져 있습니다. 적힌 대로 용융아연 품목으로 견적했으니 나사 맞물림을 확인해 주십시오. 아연 플레이크(ISO 10683)나 스테인리스 A2로 바꿀 수 있습니다.',
  en: '{size} is reported to be outside the ISO 10684 hot-dip galvanizing scope (M8 to M64). Quoted HDG as written; please check thread fit. Zinc flake (ISO 10683) or stainless A2 can be offered instead.', refs: ['ISO 10684 §1'] });
cdRule('S-A490-ZN', 'E', 'CTG', 'APPROVE', 'conflict', 'local', { when: x => cdM(x, 'A490') && cdF(x, 'HDG', 'ZN', 'YZ', 'ZB', 'ZNNI', 'CD') ? { fin: FIN_KO[x.q.fin.code] } : false, g: () => 'a490',
  offer: () => cdOff('원문대로는 공급 불가. 대안: 아연 플레이크 코팅 (ASTM F3393)', 'Not supplied as written. Alternative: zinc flake coating (ASTM F3393)'),
  ko: 'A490(F3125 Grade A490)에는 용융·기계적 아연도금을 포함한 금속 코팅({fin})을 할 수 없습니다(수소취성). 원문대로는 공급할 수 없습니다. 대안은 아연 플레이크 코팅(ASTM F3393)입니다.',
  en: 'Metallic coatings including hot-dip or mechanical zinc are not permitted on A490 (F3125 Grade A490). Cannot be supplied as written. Alternative: zinc flake coating (ASTM F3393).', refs: ['RCSC 2025 §2.8'], imp: 'excluded' });
cdRule('S-HDG-109', 'C', 'CTG', 'CONFIRM', 'auto', 'second', { ev: true, g: () => '109',
  ko: '10.9 용융아연도금은 ISO 10684 범위 안이지만 공정 조건이 붙습니다: 도금 후 6AZ(또는 6AX) 오버탭한 강도 10(또는 12) 너트와 세트로 공급, M27 이상은 고온 아연도금 불가, 전처리·로트 시험은 도금업체 성적서로 증빙합니다. 이 조건으로 견적합니다.',
  en: 'HDG of PC 10.9 is within ISO 10684 but with process conditions: supplied as a set with class 10 (or 12) nuts tapped 6AZ/6AX after coating; no high-temperature galvanizing at M27 and above; pretreatment and lot tests evidenced by the galvanizer\'s certificate. Quoted on this basis.', refs: ['ISO 10684:2004 §1'], imp: 'tbd' });
cdRule('S-HDG-HS', 'D', 'CTG', 'APPROVE', 'dev', 'local', { ev: true, p: p => ({ matKo: MAT_KO[p.mat] || p.mat }), g: p => p.mat,
  offer: (p, x) => cdOff(cdMM(x) ? '아연 플레이크 (ISO 10683)' : '아연 플레이크 (ASTM F3393)', cdMM(x) ? 'Zinc flake (ISO 10683)' : 'Zinc flake (ASTM F3393)'),
  ko: '{matKo} 용융아연도금은 수소취성 위험 때문에 표준 조합이 아닙니다. 아연 플레이크를 제안합니다. 원문대로 진행하려면 특별 공정 관리 조건을 따로 합의해야 합니다.',
  en: 'HDG of {mat} is not a standard combination due to hydrogen embrittlement risk. Zinc flake offered. Proceeding as written requires agreed special process control.', refs: ['ISO 10684 §1', 'RCSC 2025'], imp: 'cow' });
cdRule('S-CD', 'D', 'CTG', 'APPROVE', 'dev', 'policy', { ev: true, g: () => 'cd', offer: () => cdOff('아연-니켈 도금', 'Zinc-nickel plating'),
  ko: '카드뮴 도금은 RoHS 제한 물질이라 아연-니켈 도금을 제안합니다. 카드뮴이 꼭 필요하면 지정 처리업체 수배 가능 여부를 회신합니다.',
  en: 'Cadmium is RoHS-restricted; zinc-nickel offered. If cadmium is mandatory, availability of an approved plater will be advised.', refs: ['RoHS (EU 2011/65/EU)'], imp: 'cow' });
cdRule('S-A307', 'D', 'MAT', 'APPROVE', 'dev', 'local', { ev: true, g: p => p.mat, offer: () => cdOff('SAE J429 Grade 5 (승인 시). 주철 플랜지용 A307 Grade B는 대체하지 않고 수배', 'SAE J429 Grade 5 (on approval). A307 Grade B for cast-iron flanges sourced as written'),
  ko: 'A307은 재고 등급이 아닙니다. SAE J429 Grade 5로 바꾸려면 승인이 필요합니다. 주철 플랜지용 A307 Grade B는 바꾸지 않고 수배합니다.', en: 'A307 is not stocked. Substitution by SAE J429 Grade 5 needs approval. A307 Grade B for cast-iron flanges is sourced as written.',
  refs: ['ASTM A307'], imp: 'cow' });
cdRule('S-DIN-WAF', 'D', 'DIM', 'APPROVE', 'dev', 'second', { ev: true, g: p => `${p.din}|${p.size}`,
  offer: (p, x) => cdOff(`${x.m.spec || p.iso}`, cdSpecEn(x.q)),
  ko: '{din} {size}의 2면폭은 {wafDin} mm이고, 공급하는 {iso}는 {wafIso} mm입니다. 렌치·소켓 호환을 확인해 주십시오. DIN 치수가 꼭 필요하면 준수안으로 수배합니다.',
  en: 'Across flats of {din} {size} is {wafDin} mm; offered {iso} is {wafIso} mm. Please check wrench/socket compatibility. DIN dimensions can be sourced if required.', refs: ['DIN 933/931/934', 'ISO 4014/4017/4032'], imp: 'cow' });
cdRule('S-DIN934-H', 'C', 'DIM', 'INFO', 'auto', 'engine', { ev: true, g: () => 'h',
  ko: 'DIN 934 → ISO 4032로 공급합니다. 너트 높이는 ISO 4032 {m} mm로 DIN 934보다 높을 수 있습니다.', en: 'DIN 934 supplied as ISO 4032; nut height {m} mm (may be higher than DIN 934).', refs: ['ISO 4032', 'DIN 934'] });
const CD_WAF_DIFF = ['M10', 'M12', 'M14', 'M22'];
cdRule('S-KS-1JONG', p => CD_WAF_DIFF.includes(p.size) ? 'D' : 'C', 'DIM', p => CD_WAF_DIFF.includes(p.size) ? 'APPROVE' : 'CONFIRM', p => CD_WAF_DIFF.includes(p.size) ? 'dev' : 'auto', 'second', { ev: true,
  g: p => CD_WAF_DIFF.includes(p.size) ? 'D|' + p.size : 'C', offer: (p, x) => cdOff(x.m.spec || 'ISO 4032', cdSpecEn(x.q)),
  ko: 'KS B 1012에서 ISO 4032 너트는 \'스타일 1\'이고, \'1종·2종\'은 부속서의 비ISO 너트(DIN 934 치수)입니다(원문 미대조). 당사는 ISO 4032로 공급합니다({size}). 1종 치수가 필요하면 알려 주십시오.',
  en: 'Under KS B 1012 ISO 4032 nuts are \'style 1\'; \'1종/2종\' (KS types 1/2) are non-ISO annex nuts with DIN 934 dimensions (not checked against KS). Offered: ISO 4032 ({size}). Advise if type 1 dimensions are required.', refs: ['KS B 1012', 'DIN 934'], imp: 'cow' });
cdRule('S-KS-3JONG', 'D', 'DIM', 'APPROVE', 'dev', 'second', { ev: true, g: () => '3', offer: (p, x) => cdOff(`얇은 너트 ISO 4035 ${x.q.size?.label || ''} (높이 약 0.5d, 강도 04·05)`, `Thin nut ISO 4035 ${x.q.size?.label || ''} (height about 0.5d, PC 04/05)`),
  ko: '\'3종\'은 얇은 너트입니다. 일반 높이 너트(ISO 4032)로 바꾸지 않고 얇은 너트 ISO 4035로 제안합니다. 높이·강도가 다르므로 조립 공간과 하중 조건(잼너트 용도인지)을 확인해 주십시오. 3종 치수가 꼭 필요하면 엔지니어 견적으로 수배합니다.',
  en: '\'3종\' (KS type 3) is a thin nut. Not substituted by a regular nut (ISO 4032); offered as ISO 4035 thin nut. Height and strength differ; please confirm space and duty (jam nut use). Type 3 dimensions can be sourced if required.', refs: ['KS B 1012', 'ISO 4035'], imp: 'cow' });
cdRule('S-F738M-A2', 'C', 'MAT', 'CONFIRM', 'auto', 'local', { when: x => cdS(x, 'ASTM F738M') || cdS(x, 'ASTM F836M'), g: () => 'f738',
  ko: 'ASTM F738M·F836M의 A1은 304 계열, A2는 321·347, A4는 316입니다. ISO 3506 A2(304 계열)와 글자는 같지만 재질이 다릅니다. 적힌 ASTM 규격의 강종으로 공급합니다.',
  en: 'In ASTM F738M/F836M, A1 = 304 types, A2 = 321/347, A4 = 316, not the same as ISO 3506 A2 (304 types). Supplied in the alloy of the ASTM specification stated.', refs: ['ASTM F738M-02 Table 1', 'ASTM F836M-02 Table 1'] });
// API 610 (2026-10 감사, INTEGRATE F): 재질 클래스 → 볼팅 매핑과 조항 요약(나사 계열·최소 지름·스터드 기본·보조배관 코팅·마킹·품질 보증·성적서)은
// 공개 출처가 없어 규칙째 뺐다. 남은 규칙은 판·부위·조건을 묻는 질문뿐이며 볼팅 재질은 펌프 데이터시트·PO로 엔지니어가 확인한다.
cdRule('S-API610-ED', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, g: p => p.cls,
  ko: 'API 610 재질 클래스 {cls}에 판(edition)이 없습니다. 판을 알려 주십시오. 재질 클래스별 볼팅은 펌프 데이터시트·PO 기준으로 엔지니어가 확인해 회신합니다.',
  en: 'API 610 material class {cls} stated without edition. Please state the edition; bolting per material class will be confirmed by an engineer against the pump data sheet/PO.',
  refs: ['API 610'] });
cdRule('S-API610-MAT', 'C', 'MAT', 'INFO', 'auto', 'engine', { ev: true, g: p => `${p.edition}|${p.cls}`, p: p => ({ ed: api610EdKo(p.edition), mat: MAT_KO[p.mat] || p.mat, nut: p.nut || '—' }),
  ko: 'API 610 {ed} {cls} 문맥에서 볼팅 재질을 {mat} / 너트 A194 {nut}로 적었습니다. 펌프 데이터시트·PO와 같은지 확인해 주십시오.', en: 'Bolting material in the API 610 {edition} class {cls} context taken as {mat} / nuts A194 {nut}. Please confirm against the pump data sheet/PO.', refs: ['API 610'] });
cdRule('S-API610-PART', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, g: p => p.cls, offer: () => cdOff('부위 확인 후 재질 확정', 'Material fixed after location is confirmed'),
  ko: 'API 610 {cls}: 볼팅이 케이싱·글랜드용인지 접액(내부)용인지 알려 주십시오. 부위에 따라 볼팅 재질이 달라질 수 있습니다.', en: 'API 610 {cls}: please state whether the bolting is case/gland or wetted (internal); the bolting material may differ by location.', refs: ['API 610'] });
cdRule('S-API610-GRADE', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, g: p => `${p.cls}|${p.mat || ''}`, p: p => ({ matKo: p.mat ? `(${cdMatEn(p.mat)})` : '', matEn: p.mat ? ` (${cdMatEn(p.mat)})` : '' }),
  ko: 'API 610 {cls} 문맥의 BOM 등급{matKo}을 구매자 지정으로 보고 적힌 대로 견적했습니다. 펌프 데이터시트와 같은지 확인해 주십시오.', en: 'The grade stated in the BOM{matEn} in the API 610 {cls} context is quoted as stated (purchaser\'s choice). Please confirm against the pump data sheet.', refs: ['API 610'] });
cdRule('S-API610-CHK', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { ev: true, g: p => p.cls, offer: () => cdOff('조건 확인 후 재질 확정', 'Material fixed after conditions are confirmed'),
  ko: 'API 610 {cls}: 사용 조건과 부위를 확인해 주십시오. 확인 전 값은 가정입니다.', en: 'API 610 {cls}: please confirm the service and location conditions; values are assumed until confirmed.', refs: ['API 610'] });
cdRule('S-NACE-EXP', 'C', 'MAT', 'CONFIRM', 'auto', 'second', { ev: true,
  when: x => (cdSP(x, 'NACE') || x.ctx.nace) && x.ctx.exposure !== 'non-exposed' && (cdM(x, 'B7', '2H') || x.q.mat?.nut === '2H' || x.q.mat?.def) ? { mat: x.q.mat?.code || null } : false, g: () => 'nace',
  ko: '사워 서비스 볼팅: 대기에 그대로 노출된 플랜지·케이싱 볼팅(비노출)은 B7/2H가 일반적이고, 보온·매설·플랜지 커버로 대기가 차단되거나 유체에 닿는 \'노출\' 볼팅은 B7M/2HM(22 HRC 이하, 전수 경도)이어야 합니다. 노출 여부를 확인해 주십시오.',
  en: 'Sour-service bolting: atmosphere-exposed (non-exposed) flange/casing bolting is commonly B7/2H; bolting shielded by insulation, burial or flange guards, or wetted, is \'exposed\' and needs B7M/2HM (≤ 22 HRC, 100% hardness tested). Please confirm exposure.',
  refs: ['ISO 15156-2 Annex A', 'NACE MR0175/ISO 15156 Interpretations'] });
cdRule('S-B7M', 'C', 'MAT', 'INFO', 'auto', 'second', { ev: true, p: (p, x) => ({ mat: MAT_KO[p.mat] || p.mat || (x.q.mat?.code), matEn: cdMatEn(p.mat || x.q.mat?.code) }), g: p => p.mat,
  ko: '{mat}: 볼트·스터드 전수 경도시험, 최대 235 HB입니다(공개 기술자료 기준). B7보다 강도가 낮으므로 고압 플랜지는 개스킷 안착 하중을 따로 확인해 주십시오.',
  en: '{matEn}: every bolt/stud hardness tested, 235 HB max (published technical data). Lower strength than B7, so verify gasket seating separately for high-pressure flanges.', refs: ['ASTM A193'] });
cdRule('S-PTFE', 'C', 'CTG', 'CONFIRM', 'auto', 'second', { ev: true, g: () => 'ptfe',
  ko: '불소수지 코팅 조건: 제품명·하도·총 건조도막·색상·사용온도는 코팅 제조사 데이터시트 기준이며, 코팅 후 너트 회전을 확인합니다. 압력 케이싱 볼팅의 코팅은 나사 끼움과 체결에 영향을 줄 수 있습니다. 토크값은 코팅·윤활 조건에 따라 달라 제공하지 않습니다.',
  en: 'Fluoropolymer coating: product, primer, total DFT, color and service temperature per the coating maker\'s data sheet; nut run-on checked after coating. Coating can affect thread fit and tightening of pressure-casing bolting. Torque values are not provided.',
  refs: [], imp: 'tbd' });
cdRule('S-ZN-ASTM', 'C', 'CTG', 'CONFIRM', 'auto', 'practice', { when: x => (cdM(x, 'B7', 'B16', 'L7', 'L43', '2H', '7') || ['2H', '7'].includes(x.q.mat?.nut)) && cdF(x, 'HDG', 'ZN', 'YZ', 'ZB'), g: () => 'zn',
  ko: 'A193·A194 볼팅에 아연 코팅이 지정되어 있습니다. 용융아연 너트는 도금 후 오버탭합니다. 사용 온도와 코팅 사양의 온도 한계를 확인해 주십시오.',
  en: 'Zinc coating is specified on A193/A194 bolting. HDG nuts are overtapped after coating. Please confirm the service temperature and the temperature limit of the coating specification.',
  refs: [] });
cdRule('S-HE-BAKE', 'C', 'CTG', 'CONFIRM', 'auto', 'local', { ev: true,
  p: (p, x) => ({ set: x.q.type === 'setscrew' ? 1 : 0 }), g: p => p.mat === '45H' && p.set ? '45H' : 'bake',
  offer: (p, x) => cdSameSpec(p, x),
  ko: p => p.mat === '45H' && p.set ? '45H 멈춤나사는 인장을 받지 않아 ISO 4042상 전기도금 뒤 베이킹이 필요 없습니다. 적힌 대로 전기아연도금으로 견적했습니다. 기본 표면처리는 흑착색입니다.'
    : '고강도품 전기도금은 수소취성 제거 베이킹(시간·온도 기록)을 조건으로 공급합니다. 인치는 ASTM F1941, 미터는 ISO 4042를 따릅니다.',
  en: p => p.mat === '45H' && p.set ? '45H set screws carry no tensile load, so ISO 4042 requires no baking after electroplating. Quoted zinc electroplated as written; the standard finish is black oxide.'
    : 'Electroplating of high-strength parts is supplied with hydrogen embrittlement relief baking (time/temperature recorded). Inch per ASTM F1941, metric per ISO 4042.',
  refs: ['ASTM F1941', 'ISO 4042'], imp: 'tbd' });
cdRule('S-F1554', 'C', 'MRK', 'CONFIRM', 'auto', 'local', { ev: true, p: p => ({ g: p.mat ? String(p.mat).replace('F1554-', 'Grade ') : '' }), g: p => p.g || 'anchor',
  ko: '앵커볼트 F1554 {g}: 돌출 끝 색상 Gr 36 청색 · 55 황색 · 105 적색(S3 지정 시 각인). Gr 55를 용접하면 S1. 아연도금은 볼트·너트를 같은 공정으로 하고 너트는 A563 기준으로 오버탭합니다. 형상·나사 길이·돌출 길이는 도면 기준입니다.',
  en: 'F1554 {g} anchor bolts: projecting end color Gr 36 blue, 55 yellow, 105 red (stamped if S3). S1 if Gr 55 is welded. Bolts and nuts galvanized by the same process; nuts overtapped per A563. Shape, thread and projection per drawing.',
  refs: ['ASTM F1554-20', 'Iowa DOT IM 453.08'], imp: 'tbd' });
cdRule('S-STUD-LEN-GA', 'C', 'DIM', 'CONFIRM', 'auto', 'local', { ev: true, when: x => cdIN(x) && cdT(x, 'stud') && x.q.lengthLabel && !x.q.sub?.tapEnd && !x.q.sub?.cont, g: () => 'b165',
  ko: '스터드 길이 기준: ASME B16.5 표 길이입니다(포인트 포함 여부는 주문 때 확인). 표에 없는 길이는 B16.5 부록의 계산 방법으로 구합니다. 장비 노즐 플랜지가 표준보다 두꺼우면 장비 GA 도면 길이가 우선합니다. 길이 출처(B16.5 표 / GA 도면 / 실측)를 확인해 주십시오.',
  en: 'Stud length basis: ASME B16.5 tabulated length (whether end points are included is confirmed at order). Lengths not tabulated are calculated by the B16.5 appendix method. Where equipment nozzle flanges are thicker, the GA drawing length governs. Please confirm the length source (B16.5 table / GA drawing / measured).',
  refs: ['ASME B16.5 Appendix C'] });
cdRule('S-TENSION', 'C', 'DIM', 'CONFIRM', 'auto', 'practice', { when: x => cdIN(x) && cdT(x, 'stud') && (x.ctx.tensioner || /TENSION(?:ER|ING)?\b|HYDRAULIC\s*BOLT/.test(x.q.text)) ? { len: x.q.lengthIn ? cdInLab(x.q.lengthIn) : '—' } : false, g: () => 'tension',
  ko: '유압 텐셔너로 체결하는 스터드는 공구 물림 길이만큼 한쪽을 더 길게 만듭니다. BOM 길이 {len}이 그 여유를 포함한 값인지 확인해 주십시오. 텐셔너 제조사 요구 길이가 우선합니다.',
  en: 'Studs for hydraulic tensioning need extra length on one end for the tool. Please confirm whether {len} includes it. The tensioner maker\'s requirement governs.', refs: [] });
cdRule('S-MSTUD-B165', 'C', 'DIM', 'CONFIRM', 'auto', 'local', { when: x => cdMM(x) && cdT(x, 'stud') && (x.ctx.flange?.std === 'B16.5' || /\bCL(?:ASS)?\s*(150|300|600|900|1500|2500)\b|\bNPS\b/.test(x.q.text)) ? { size: x.q.size?.label, inchEq: x.q.size ? cdInLab(Math.round(x.q.size.v / 25.4 * 8) / 8) : '—' } : false, g: () => 'mstud',
  ko: 'B16.5 플랜지의 볼트 지름·볼트 구멍은 인치 기준입니다. 미터 스터드({size})를 쓰는 것인지, 인치 스터드(약 {inchEq})가 필요한지 확인해 주십시오.',
  en: 'B16.5 bolt and hole diameters are inch-based. Please confirm whether metric studs ({size}) are intended or inch studs (about {inchEq}) are required.', refs: ['ASME B16.5'] });
cdRule('S-ED-31B', 'C', 'DOC', 'INFO', 'auto', 'local', { when: x => { const m = x.q.text.match(/\b3\.1\.?([ABC])\b/); return m ? { req: '3.1.' + m[1], to: m[1] === 'B' ? '3.1' : '3.2' } : false; }, g: p => p.req,
  ko: '{req}는 EN 10204:2004 기준으로 {to}입니다(3.1이 구 3.1.B를, 3.2가 구 3.1.A·3.1.C를 대체).', en: '{req} corresponds to {to} under EN 10204:2004 (3.1 replaces 3.1.B; 3.2 replaces 3.1.A and 3.1.C).', refs: ['EN 10204:2004 Foreword'] });
cdRule('S-ED-F3393', 'C', 'CTG', 'INFO', 'auto', 'second', { when: x => ['ASTM F1136', 'ASTM F2833', 'ASTM F3019'].find(s => cdS(x, s)) ? { req: ['ASTM F1136', 'ASTM F2833', 'ASTM F3019'].find(s => cdS(x, s)) } : false, g: p => p.req,
  ko: '{req}는 현행 ASTM F3393(아연 플레이크)으로 공급합니다. F1136·F2833·F3019가 F3393으로 통합되었습니다.', en: '{req} supplied to current ASTM F3393 (zinc flake), which consolidates F1136, F2833 and F3019.', refs: ['ASTM F3393-20'] });
cdRule('S-CAT-ALT', 'D', p => /재질|등급/.test(p.d) ? 'MAT' : /표면/.test(p.d) ? 'CTG' : 'DIM', 'APPROVE', 'dev', 'engine', { ev: true, unless: x => !(x.m.alt && !x.m.alt.exact),   // 대안이 없으면 행 없음 (엔지니어 견적 사유일 뿐)
  p: (p, x) => { const d = p.why === 'rodlen' ? [`길이 ${p.len} mm → 1 m 정척`] : [].concat(p.diff || []); return { d: d.join(' · '), dEn: d.map(cdDiffEn).join('; ') }; }, g: (p, x) => x.lineKey,
  offer: (p, x) => cdOff(x.m.alt.label + (x.m.alt.pn ? ` (${x.m.alt.pn})` : ''), `Catalog alternative ${x.m.alt.pn || ''}`.trim()),
  ko: '카탈로그 대안을 제안합니다: {d}. 원 사양 그대로는 엔지니어 견적입니다.', en: 'Catalog alternative offered ({dEn}). The as-specified item is engineer-quoted.', refs: [], imp: 'cow' });
cdRule('S-LEN-RANGE', 'C', 'DIM', 'CONFIRM', 'auto', 'second', { when: x => {
  if (!cdMM(x) || !cdT(x, 'hexbolt') || !x.q.lengthMm || !x.q.size) return false;
  const d = x.q.size.v, L = x.q.lengthMm, std = /ISO 4014|DIN 931/.test(x.q.dimStd) ? 'ISO 4014' : 'ISO 4017';
  // ISO 4014 하한은 ISO4014_MIN (ISO 4014:2022 Figure 1 주 d를 표준 길이로 맞춘 값). 표에 없는 호칭은 하한을 보지 않는다
  const max = std === 'ISO 4017' ? Math.min(10 * d, 200) : Math.min(10 * d, 500), min = std === 'ISO 4017' ? 2 * d : ISO4014_MIN[x.q.size.label] ?? null;
  return L > max + 1e-6 || (min != null && L < min - 1e-6) ? { size: x.q.size.label, len: L, std, rng: min != null ? `${min}–${max} mm` : `≤ ${max} mm` } : false; }, g: p => p.std,
  ko: '{size}×{len} mm는 {std} 표준 길이 범위({rng}) 밖이라 주문 생산입니다.', en: '{size} x {len} is outside the {std} standard length range ({rng}); made to order.', refs: ['ISO 4014:2022', 'ISO 4017:2022'], imp: 'tbd' });
cdRule('S-FINE', 'C', 'THD', 'CONFIRM', 'ambiguous', 'engine', { ev: true, g: () => 'fine', p: p => ({ sp: `${p.size}×${p.pitch}` }),
  ko: '가는나사({sp} mm)로 읽었습니다. 피치 값이 길이가 아니라 피치가 맞는지 확인해 주십시오.', en: 'Read as fine pitch ({sp} mm). Please confirm the value is the pitch, not the length.', refs: [], imp: 'tbd' });
cdRule('S-SOCKET-PLATE', 'C', 'THD', 'CONFIRM', 'auto', 'local', { when: x => cdIN(x) && SOCKET.has(x.q.type) && cdD(x) <= 1 && cdF(x, 'ZN', 'YZ', 'ZB', 'ZNNI'), g: () => '3a',
  ko: '소켓 제품의 나사가 3A이면 도금 여유가 없어 도금 전에 나사 치수를 조정해야 합니다. 이 조건으로 견적했으니 나사 등급을 확인해 주십시오.', en: 'If the socket product threads are class 3A, there is no plating allowance and threads must be sized before plating; quoted on that basis. Please confirm the thread class.',
  refs: ['ASME B1.1'], imp: 'tbd' });
cdRule('S-F880-316', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { when: x => cdM(x, 'F880') && x.q.mat?.alloy === '316', g: () => 'f880',
  ko: 'ASTM F880 합금 목록에 316이 없어 F880 치수·시험을 준용한 316으로 공급합니다. 성적서 표기를 확인해 주십시오.', en: '316 is not in the ASTM F880 alloy list; supplied as 316 to F880 dimensions/tests. Please check certificate wording.', refs: ['ASTM F880'] });

/* X — 사양 충돌 */
cdRule('X-NACE-HARD', 'D', 'MAT', 'APPROVE', 'conflict', 'local', {
  when: x => (cdSP(x, 'NACE') || x.ctx.nace) && x.ctx.exposure !== 'non-exposed' && cdM(x, 'A574', 'F912', 'F835', '12.9', '10.9', '45H', 'J429-8') ? { mat: x.q.mat.code, hrc: CD_HRC[x.q.mat.code] || '제품 규격 경도', hrcEn: CD_HRC[x.q.mat.code] || 'per product standard', ys: { '12.9': '1,100', '10.9': '940' }[x.q.mat.code] || '' } : false, g: p => p.mat,
  p: (p, x) => ({ it: x.q.type === 'setscrew' ? '멈춤나사' : SOCKET.has(x.q.type) ? '소켓볼트' : x.q.type === 'stud' ? '스터드' : '볼트', itEn: x.q.type === 'setscrew' ? 'set screws' : SOCKET.has(x.q.type) ? 'socket screws' : x.q.type === 'stud' ? 'studs' : 'bolts',
    cmp: p.ys ? `; ${p.mat} 항복 약 ${p.ys} MPa` : '', cmpEn: p.ys ? `; PC ${p.mat} yield about ${p.ys} MPa` : '' }),
  offer: p => cdOff(`① B7M 소재(최대 235 HB, 인장 100 ksi)로 가공한 ${p.it} ② 고용화 316 (A193 B8M Class 1, 항복 30 ksi) — 설계 확인 후`, `(1) ${p.itEn} machined from B7M (≤ 235 HB, 100 ksi tensile), (2) solution-annealed 316 (A193 B8M Class 1, 30 ksi yield) — subject to design check`),
  ko: '사양 충돌: {mat}(규격 경도 {hrc})는 사워 \'노출\' 볼팅의 저합금강 경도 상한 22 HRC를 만족할 수 없습니다. 두 대안 모두 {mat}보다 강도가 크게 낮아(대안 ① 인장 약 690 MPa, ② 항복 약 205 MPa{cmp}) 귀사 설계 확인 없이 바꿀 수 없습니다. 비노출 볼팅으로 판정되면 이 행은 철회합니다.',
  en: 'Conflict: {mat} (specified hardness {hrcEn}) cannot meet the 22 HRC limit for low-alloy steel bolting exposed to sour service. Both alternatives are much weaker than {mat} (alternative (1) tensile about 690 MPa, (2) yield about 205 MPa{cmpEn}) and cannot be substituted without your design check. Withdrawn if the bolting is confirmed non-exposed.',
  refs: ['ISO 15156-2 Annex A', 'ISO 898-1'], imp: 'cow' });
cdRule('X-NACE-ZN', 'C', 'CTG', 'CONFIRM', 'conflict', 'engine', { when: x => (cdSP(x, 'NACE') || x.ctx.nace) && cdF(x, 'HDG', 'ZN', 'YZ', 'ZB', 'ZNNI', 'CD') ? { fin: FIN_KO[x.q.fin.code], finEn: CD_FIN_EN[x.q.fin.code] } : false, g: () => 'zn',
  ko: '사워 환경 볼팅에 아연·카드뮴 코팅({fin})이 지정되어 있습니다. 코팅 사양을 다시 확인해 주십시오.',
  en: 'Zinc/cadmium coating ({finEn}) is specified on sour-service bolting. Please reconfirm the coating.', refs: [] });
cdRule('X-L7M-SIZE', 'C', 'MAT', 'CONFIRM', 'conflict', 'local', { when: x => cdM(x, 'L7M') && cdDin(x) > 2.5 + 1e-6 ? { size: cdSizeLab(x) } : false, g: () => 'l7m',
  ko: 'L7M {size}: 굵은 지름은 기계적 성질의 적용 범위를 규격서로 확인해야 합니다. L43은 니켈이 1 %를 넘어 ISO 15156-2 저합금강 조건에 들지 않습니다. 엔지니어 검토 후 회신합니다.', en: 'L7M {size}: the size range of the mechanical properties must be confirmed against the standard for larger diameters. L43 contains more than 1 % Ni and falls outside the ISO 15156-2 low-alloy steel conditions. Engineer review required.', refs: ['ISO 15156-2'], imp: 'tbd' });
cdRule('X-LOWSTR', 'C', 'MAT', 'CONFIRM', 'auto', 'engine', { when: x => ((cdM(x, 'B8', 'B8M') && !x.q.mat.cls2) || cdM(x, 'A307B')) && (x.ctx.flange?.cls || 0) >= 400 ? { mat: MAT_KO[x.q.mat.code] || x.q.mat.code, fcls: x.ctx.flange.cls } : false, g: p => p.mat,
  ko: '볼트 강도와 플랜지 등급 조합은 설계 조건으로 확인합니다({mat} 볼팅, 플랜지 Class {fcls}). 확인해 주십시오.', en: 'The combination of bolt strength and flange class is confirmed against the design conditions ({mat} bolting, flange Class {fcls}). Please confirm.', refs: [] });
cdRule('X-HDG-3A', 'C', 'THD', 'CONFIRM', 'conflict', 'local', { when: x => cdF(x, 'HDG') && (x.q.tolClass === '3A' || (cdIN(x) && SOCKET.has(x.q.type))), g: () => '3a',
  ko: '3A 나사는 여유가 없어 용융아연도금을 할 수 없습니다. 나사 등급과 표면처리를 확인해 주십시오.', en: '3A threads have no allowance and cannot be hot-dip galvanized. Please confirm thread class and finish.', refs: ['ASME B1.1'] });
cdRule('X-API610-NOAUTO', 'C', 'MAT', 'CONFIRM', 'conflict', 'engine', { ev: true, g: p => `${p.edition}|${p.cls}`, p: p => ({ ed: p.edition ? api610EdKo(p.edition) : '판 미기재', edEn: p.edition || 'edition not stated', whyEn: cdApiWhyEn(p.why) }),
  ko: 'API 610 {ed} {cls}는 자동으로 매핑하지 않습니다({why}). 엔지니어가 펌프 데이터시트·PO의 볼팅 재질을 확인해 회신합니다.', en: 'API 610 {edEn} {cls} is not auto-mapped ({whyEn}). An engineer will confirm the bolting material against the pump data sheet/PO and reply.', refs: ['API 610'], imp: 'tbd' });
cdRule('X-SCOPE', 'E', 'DOC', 'INFO', 'conflict', 'policy', { when: x => x.ctx.scope ? { kw: x.ctx.scope } : false, g: p => p.kw,
  offer: () => cdOff('해당 용도 서류는 공급하지 않음', 'Documentation for this service not supplied'),
  ko: '{kw} 용도 서류는 공급 범위가 아닙니다. 해당 인증을 갖춘 공급사를 이용해 주십시오.', en: 'Documentation for {kw} service is outside our scope; please use a supplier holding that qualification.', refs: ['EN 10204:2004 Annex ZA'], imp: 'excluded' });
// X-MDMT (2026-10 감사, INTEGRATE H): B7 무충격시험 최저온도 값(B31.3)은 공개 출처가 없어 뺐다. 0 °C 아래 MDMT가 적히면 값 없이 확인 질문만 한다
cdRule('X-MDMT', 'C', 'MAT', 'CONFIRM', 'conflict', 'engine', { when: x => {
  const c = x.q.mat?.code; if (x.ctx.mdmtC == null || x.ctx.mdmtC >= 0 || c !== 'B7') return false;
  return { mdmt: x.ctx.mdmtC, mat: MAT_KO[c] || c, lowAlt: 'L7' }; }, g: p => p.mat,
  offer: () => cdOff('A320 L7 (충격시험) + A194 7L 너트 (확인 후)', 'A320 L7 (impact tested) with A194 7L nuts (on confirmation)'),
  ko: '설계 최저온도(MDMT) {mdmt} °C가 적혀 있습니다. {mat}을(를) 이 온도에서 충격시험 없이 쓸 수 있는지는 적용 코드로 확인해야 합니다. A320 {lowAlt}(충격시험) + A194 7L 너트가 필요한지 확인해 주십시오. 현재 견적은 원문 재질 그대로입니다.',
  en: 'MDMT {mdmt} °C is stated. Whether {mat} can be used at this temperature without impact testing must be confirmed under the applicable code. Please confirm whether A320 {lowAlt} (impact tested) with A194 7L nuts is required. Quoted as written.', refs: [], imp: 'option' });
cdRule('X-REFDOC', 'E', 'DOC', 'CONFIRM', 'conflict', 'policy', {
  when: x => { const docs = (x.ctx.refDocs || []).filter(d => !cdBasisReceived(x.D.rfq, d)); return docs.length ? docs.map(doc => ({ doc })) : false; }, g: p => p.doc,
  rfq: D => (D.rfq.basis || []).filter(b => b && b.doc && b.received === false).map(b => ({ p: { doc: b.doc + (b.rev ? ` Rev ${b.rev}` : '') }, ref: `${b.doc}${b.rev ? ' R' + b.rev : ''} (참조만, 받지 못함)`, req: { ko: `${b.doc}${b.rev ? ' Rev ' + b.rev : ''} 참조`, en: `${b.doc}${b.rev ? ' Rev ' + b.rev : ''} referenced` } })),
  offer: () => cdOff('BOM 원문 기준으로 견적. 문서는 받은 뒤 검토', 'Quoted on the BOM text; document to be reviewed on receipt'),
  ko: '참조 문서 {doc}를 받지 못해 검토하지 않았습니다(GC-T13). BOM 원문 기준으로 견적했고, 문서를 받으면 검토해 다음 Rev에 C&D로 반영합니다. 문서에 추가 시험·코팅·서류·포장 요구가 있으면 가격·납기가 바뀔 수 있습니다.',
  en: 'Referenced document {doc} was not received and has not been reviewed (GC-T13). Quoted on the BOM text; on receipt it will be reviewed and reflected in the next Rev. Additional test, coating, document or packing requirements may change price and lead time.', refs: ['GC-T13'], imp: 'tbd' });

/* Q — 품질 서류 (HARD RULE 5: 제조사 성적서는 전달만, 볼트노트 문서는 CoC F2.1) */
cdRule('Q-COC', 'C', 'DOC', 'INFO', 'gc', 'local', { gc: 'GC-T10', when: x => x.m.status !== 'not-available' });
cdRule('Q-31-FWD', 'C', 'DOC', 'INFO', 'auto', 'local', { ev: true, when: x => (x.ctx.docs || []).includes('3.1') && x.m.status !== 'not-available', g: () => '31', offer: () => cdOff(CD_DOC.MTC31_FWD.ko, CD_DOC.MTC31_FWD.en),
  ko: '제조사 EN 10204 3.1 사본을 아무것도 고치지 않고 전달합니다(납품 수량은 볼트노트 CoC와 거래명세서에 적습니다). 제품 각인·라벨의 히트번호와 대조하고, 가능한 경우 한 상자에 한 히트만 담습니다.' + (MTR_OK ? '' : ' 공급처가 이 품목의 3.1을 발행하는지 확인한 뒤 회신합니다.'),
  en: 'Manufacturer\'s EN 10204 3.1 forwarded as an unaltered copy (the delivered quantity is stated on BoltNote\'s CoC and the delivery note); heat numbers matched to marking/labels; one heat per box where possible.' + (MTR_OK ? '' : ' Availability of the 3.1 from the supplier to be confirmed.'), refs: ['EN 10204:2004 §6'], imp: p => ({ kind: 'none', docs: { ko: '제조사 3.1 사본 포함', en: 'Mfr. 3.1 copy incl.' } }) });
cdRule('Q-31-LOT', 'C', 'DOC', 'CONFIRM', 'auto', 'engine', { when: x => (cdSP(x, 'CERT') || (x.ctx.docs || []).includes('3.1')) && (x.m.reasons || []).some(r => r.lead === 'cert'), g: () => 'lot',
  ko: '재고품에는 3.1이 없어 3.1이 있는 로트로 수배합니다.', en: 'Stock lacks 3.1; a certified lot will be sourced.', refs: [], imp: () => ({ kind: 'tbd', lead: LEAD_DAYS.cert }) });
cdRule('Q-31-SELF', 'E', 'DOC', 'APPROVE', 'conflict', 'local', { when: x => (x.ctx.docs || []).includes('3.1-self'), g: () => 'self',
  offer: () => cdOff('제조사(또는 제작을 맡은 업체) 명의 EN 10204 3.1 사본 전달', 'EN 10204 3.1 issued by the manufacturer (or the shop making the part), forwarded as a copy'),
  ko: '볼트노트는 자기 명의로 EN 10204 3.1을 발행하지 않습니다(3.1은 제조자의 독립 검사 책임자가 검증하고, 유통업자는 전달만 합니다). 제조사 명의 3.1 사본으로 대신합니다.',
  en: 'BoltNote does not issue EN 10204 3.1 in its own name (3.1 is validated by the manufacturer\'s independent inspection representative; intermediaries only forward). Manufacturer\'s 3.1 copy offered instead.', refs: ['EN 10204:2004 §2.4, §4.1, §6'], imp: 'excluded' });
cdRule('Q-32', 'C', 'DOC', 'CONFIRM', 'auto', 'local', { when: x => (x.ctx.docs || []).includes('3.2') && x.m.status !== 'not-available', g: () => '32',
  ko: '3.2는 제조사 검사 책임자와 귀사 검사원(또는 법규가 지정한 검사원)이 함께 서명합니다. 제3자 기관 비용은 실비로 귀사 부담, 납기 1~4주 추가, 출고 뒤에는 받을 수 없습니다. 검사원·검사기관을 주문 전에 알려 주십시오.',
  en: '3.2 is co-signed by the manufacturer\'s authorized inspection representative and the purchaser\'s authorized inspection representative (or the inspector designated by official regulations). Third-party cost at actuals to the purchaser, +1–4 weeks; not available after shipment. Please nominate the inspector or body before order.', refs: ['EN 10204:2004 §4.2'], imp: () => ({ kind: 'option', lead: [5, 20] }) });
cdRule('Q-KOLAS', 'C', 'DOC', 'CONFIRM', 'auto', 'policy', { when: x => (x.ctx.docs || []).includes('KOLAS') && x.m.status !== 'not-available', g: () => 'kolas',
  ko: 'KOLAS 공인시험성적서는 외부 공인시험소가 발행하며 시험한 시료에만 해당합니다. 로트 대표성이 필요하면 시험소 샘플링을 추가합니다. 비용은 실비이고 납기가 1~2주 늘어납니다.',
  en: 'KOLAS test reports are issued by an external accredited laboratory and apply to the tested samples only; laboratory sampling can be added for lot representativeness. Cost at actuals; +1–2 weeks.', refs: [], imp: () => ({ kind: 'option', lead: [5, 10] }) });
cdRule('Q-PMI', 'C', 'DOC', 'CONFIRM', 'auto', 'policy', { ev: true, when: x => (x.ctx.docs || []).includes('PMI') && x.m.status !== 'not-available', g: () => 'pmi',
  ko: (PMI_ON ? 'PMI는 외부 비파괴검사 업체로 수행합니다.' : 'PMI는 요청 시 가능 여부를 회신합니다(외부 검사업체 확인 후).') + ' B7과 B7M은 성분이 같은 계열이라 성분 분석으로 구분되지 않고, 304와 304L처럼 탄소만 다른 재질은 휴대용 XRF로 구분하지 못합니다. B7M은 경도 기록으로 확인합니다.',
  en: (PMI_ON ? 'PMI by an external NDT contractor.' : 'PMI on request: availability to be confirmed (external inspection company).') + ' B7 and B7M have the same chemistry family and cannot be told apart by chemical analysis; handheld XRF cannot distinguish materials differing only in carbon, such as 304/304L. B7M is verified by hardness records.', refs: [], imp: 'option' });
cdRule('Q-IMPACT', 'C', 'DOC', 'INFO', 'auto', 'second', { ev: true, g: () => 'impact',
  ko: '저온용 볼팅은 제조사 3.1에 샤르피 결과를 포함합니다. 기본 시험온도는 L7·L43 −101 °C, L7M −73 °C이고, L7은 평균 27 J(20 ft-lbf) 이상입니다(공개 기술자료 기준).',
  en: 'Low-temperature bolting: Charpy results in the manufacturer\'s 3.1. Default test temperature L7/L43 −101 °C, L7M −73 °C; L7 average ≥ 27 J (20 ft-lbf) (published technical data).',
  refs: ['ASTM A320'], imp: () => ({ kind: 'tbd', docs: { ko: '충격시험 결과 (제조사 3.1)', en: 'Impact results (mfr. 3.1)' } }) });
cdRule('Q-COAT', 'C', 'DOC', 'INFO', 'auto', 'local', { ev: true, when: x => x.m.status !== 'not-available' && cdF(x, 'HDG', 'ZF', 'PTFE', 'ZNNI', 'PH'), g: () => 'coat', offer: () => cdOff(CD_DOC.COAT.ko, CD_DOC.COAT.en),
  ko: '도금·코팅업체 성적서 사본을 첨부합니다. 고강도품은 베이킹 기록을 함께 붙입니다.', en: 'Coating/plating certificate copies attached; baking records for high-strength parts.', refs: [], imp: () => ({ kind: 'none', docs: { ko: '코팅 성적서 사본 포함', en: 'Coating cert. copy incl.' } }) });
cdRule('Q-ORIGIN', 'C', 'DOC', 'INFO', 'auto', 'policy', { when: x => ((x.ctx.docs || []).includes('origin') || x.D.rfq.avl?.originProof) && x.m.status !== 'not-available', g: () => 'origin',
  ko: '원산지는 수입품이면 수입신고필증의 원산지와 밀시트로, 국산이면 제조사 서류로 증빙합니다.', en: 'Origin evidenced by the import declaration and mill certificate (imports) or by manufacturer\'s documents (domestic).', refs: [] });
cdRule('Q-MAKE', 'C', 'DOC', 'CONFIRM', 'auto', 'policy', { when: x => x.m.status !== 'not-available' && !x.m.make && (x.D.firm || cdAvl(x.D.rfq)) ? { make: cdAvl(x.D.rfq) ? '발주 후 통보 (귀사 AVL 안에서 선정)' : '발주 후 통보' } : false, g: () => 'make',
  ko: '제조사·원산지: {make}. 확정 전 줄은 발주 후 [자리표시: 통보 기한] 안에 제조사명·주소·원산지를 알리며, 귀사 승인 제조사 목록(AVL)·원산지 제한 안에서만 고릅니다. 목록 밖 제조사밖에 없으면 D행으로 따로 승인을 받습니다.',
  en: 'Make & origin: to be advised after PO. Manufacturer name, address and origin will be advised within [placeholder: notice period], chosen only within your AVL/origin restrictions; otherwise a separate D item will request approval.', refs: [] });
cdRule('Q-VDRL', 'C', 'DOC', 'CONFIRM', 'auto', 'policy', { when: x => x.ctx.vdrl && x.m.status !== 'not-available', g: () => 'vdrl',
  ko: '귀사 서류 요구 목록(VDRL/SDDR)에 대해: 제공 = CoC(F2.1), 제조사 3.1 사본, 코팅 성적서 사본, 포장 명세서, 유통 단계 검사 계획서, 서류 묶음(편철). 제공 불가 = 볼트노트 명의 제조 공정 ITP·열처리 절차서(제조사 문서로만 가능). 제출 일정은 발주 후 협의합니다.',
  en: 'Against your VDRL/SDDR: provided = CoC (F2.1), manufacturer\'s 3.1 copies, coating certificate copies, packing list, distribution-stage inspection plan, compiled dossier. Not provided = manufacturing ITP or heat-treatment procedures in BoltNote\'s name (manufacturer documents only). Schedule to be agreed after PO.', refs: [] });

/* M — 마킹·포장 */
cdRule('M-MARK', 'C', 'MRK', 'INFO', 'gc', 'local', { gc: 'GC-T06', when: x => x.m.status !== 'not-available' && THREADED.has(x.q.type) });
cdRule('M-PKG', 'C', 'PKG', 'INFO', 'gc', 'practice', { gc: 'GC-T11', when: x => x.m.status !== 'not-available' });
cdRule('M-TAG', 'C', 'PKG', 'CONFIRM', 'auto', 'practice', { when: x => { const t = cdUniq([x.row?.tag, ...(x.sec?.tags || [])]); return t.length ? { tags: t.join('·') } : false; }, g: () => 'tag',
  ko: '포장 라벨에 귀사 PO·라인·태그({tags})를 표기합니다.', en: 'Package labels will show your PO, line and tag ({tags}).', refs: [] });
cdRule('M-KIT', 'C', 'PKG', 'INFO', 'auto', 'policy', { when: x => (x.sec?.tags || x.row?.tag) && cdT(x, 'stud', 'nut', 'heavynut', 'washer', 'hexbolt'), g: () => 'kit',
  ko: '옵션: 조인트별 키트 포장(조인트마다 스터드·너트·와셔를 한 봉투에 담고 조인트 번호 라벨). 포장비는 [자리표시: 운영자 입력]입니다.', en: 'Option: joint-kit packing (studs, nuts and washers per joint in one bag labelled with the joint no.). Packing charge: [placeholder].', refs: [], imp: 'option' });
cdRule('M-COLOR', 'C', 'MRK', 'CONFIRM', 'auto', 'practice', { when: x => x.ctx.colorCode && x.m.status !== 'not-available', g: () => 'color',
  ko: '귀사 색상 코드를 스터드 끝과 너트에 칠합니다. 기준표를 보내 주십시오.', en: 'Your color code will be applied to stud ends and nuts; please provide the code table.', refs: [], imp: 'tbd' });
cdRule('M-HEAT', 'C', 'MRK', 'CONFIRM', 'auto', 'local', { when: x => x.ctx.heatStamp && cdT(x, 'stud', 'hexbolt', 'heavyhexbolt'), g: () => 'heat',
  ko: 'ASTM 볼팅 마킹은 등급 기호와 제조사 식별 기호입니다. 히트번호 개별 각인은 따로 지정해야 하며, 기본은 라벨·포장 명세서로 히트를 추적합니다(GC-T11). 개별 각인이 필요하면 제조사 추가 공정으로 수배합니다.',
  en: 'ASTM bolting marking is the grade symbol and maker\'s mark. Individual heat-number stamping must be specified separately; by default heat traceability is by label and packing list (GC-T11), and individual stamping can be arranged as an extra operation.', refs: ['RCSC 2025 Fig. C-2.1'], imp: 'option' });

/* K — 상업·수량·납기 */
cdRule('K-PACK', 'C', 'COM', 'INFO', 'auto', 'engine', { ev: true, p: (p, x) => ({ combo: x.m.packPlan?.combo || '', comboEn: (x.m.packPlan?.packs || []).map(k => k.size > 1 ? `${k.size}-pc pack × ${k.count}` : `${k.count} loose`).join(' + ') }), g: (p, x) => x.lineKey,
  ko: 'BOM 수량 {qb} → 포장 단위로 {qq} ({combo}, 여유 {over})를 주문하면 더 싸거나 포장 수가 적습니다(옵션). 견적 수량은 BOM 수량 그대로입니다.', en: 'BOM qty {qb}; ordering {qq} ({comboEn}, {over} over) by pack is cheaper or uses fewer packs (option). Quoted quantity is as per BOM.', refs: [], imp: 'option' });
cdRule('K-TIER', 'C', 'COM', 'INFO', 'auto', 'engine', { ev: true, p: p => ({ amtKo: cdW(p.amt), amtEn: cdKRW(p.amt) }), g: (p, x) => x.lineKey,
  ko: '수량을 {n}로 늘리면 합계가 {amtKo}로 지금보다 쌉니다(옵션).', en: 'Increasing to {n} lowers the total to {amtEn} (option).', refs: [], imp: 'option' });
cdRule('K-QTY', 'C', 'COM', 'CONFIRM', 'qty', 'engine', { ev: true, p: (p, x) => ({ warn: x.m.qtyWarn || '', why: CD_QTY_EN[p.issue] || p.issue }), g: p => p.issue,
  ko: '{warn}', en: 'Quantity \'{raw}\': {why}; quoted as {qty}. Please confirm.', refs: [], imp: 'tbd' });
cdRule('K-NONRET', 'C', 'COM', 'CONFIRM', 'auto', 'policy', { ev: true, p: p => ({ tl: BOM_TIER[p.tier]?.label || p.tier, tlEn: CD_TIER_EN[p.tier] || p.tier }), g: p => `${p.tl}|${p.days}`,
  ko: '{tl} 품목이라 따로 협의한 사업자 거래 조건(GC-C08)에서는 반품할 수 없습니다(불량 제외). 견적 유효기간은 {days}일입니다.', en: '{tlEn} item: non-returnable under business order terms (defects excepted, GC-C08). Validity {days} days.', refs: ['GC-C08'] });
cdRule('K-FREIGHT', 'C', 'DLV', 'INFO', 'auto', 'policy', { ev: true, p: p => ({ whyKo: p.why === 'long' ? '장척물(1 m 이상)' : `총중량 약 ${p.kg} kg`, whyEn: p.why === 'long' ? 'long item (≥ 1 m)' : `about ${p.kg} kg` }), g: p => p.why,
  ko: '{whyKo}이라 화물로 보내며 운임은 별도입니다.', en: 'Shipped by freight ({whyEn}); freight charged separately.', refs: ['GC-C03'], imp: () => ({ kind: 'tbd' }) });
cdRule('K-MOQ', 'C', 'COM', 'INFO', 'auto', 'engine', { ev: true, g: p => p.proc, p: p => ({ procKo: { PATCH: '나일론 패치', PTFE: '불소수지 코팅' }[p.proc] || p.proc }),
  ko: '{procKo} 공정은 최소 로트가 있어 소량이면 로트 비용이 단가에 나뉘어 들어갑니다.', en: '{proc} has a minimum lot; lot cost is spread over small quantities.', refs: [], imp: 'tbd' });
cdRule('K-UOM-SET', 'C', 'COM', 'INFO', 'auto', 'engine', { when: x => x.m.unit === 'SET' && x.m.status !== 'not-available' ? { n: x.q.sub?.nuts || 2 } : false, g: p => p.n, offer: p => cdOff(`1 SET = 스터드 1 + 헤비너트 ${p.n}`, `1 SET = 1 stud + ${p.n} heavy hex nuts`),
  ko: '1 SET = 스터드 1 + 헤비너트 {n}. 단가와 수량은 SET 기준입니다.', en: '1 SET = 1 stud + {n} heavy hex nuts. Price and quantity per SET.', refs: [] });
cdRule('K-LEAD', 'D', 'DLV', 'APPROVE', 'dev', 'engine', { when: x => {
  const req = x.D.ctx.requiredDate || x.D.rfq.requiredDate, L = x.m.lead; if (!req || !L || !L.toCustomer) return false;
  const can = cdAddBD(x.D.now, L.toCustomer[1]), rq = cdNow(req); if (!(can > rq)) return false;
  // 오너 결정 (2026-10-01): 자체 재고가 아닌 카탈로그 품목 줄은 가능 날짜 대신 '출고일은 공급처 확인 후 확정' (BOM_SHIP_TBD)
  const tbd = x.m.status === 'catalog' && L.code !== 'OWN_STOCK';
  return { req: ymd(rq), ...(tbd ? {} : { date: cdDateKo(can), dateEn: cdDateEn(can) }), tier: L.label, tierEn: CD_TIER_EN[L.code] || L.code, tbd,
    canKo: tbd ? BOM_SHIP_TBD : `가능 납기 ${cdDateKo(can)}`, canEn: tbd ? 'ship date to be confirmed with the supplier' : `achievable ${cdDateEn(can)}` }; }, g: p => `${p.tier}|${p.tbd ? 'tbd' : p.date}`,
  offer: p => cdOff(`${p.canKo} (${p.tier})`, `${p.canEn[0].toUpperCase()}${p.canEn.slice(1)} (${p.tierEn})`), req: p => `요구 납기 ${p.req}`,
  ko: '요구 납기 {req} → {canKo} ({tier}).', en: 'Required {req} → {canEn} ({tierEn}).', refs: ['GC-C04'], imp: () => ({ kind: 'none', leadText: true }) });
cdRule('K-DUP', 'C', 'COM', 'INFO', 'auto', 'engine', { bom: L => {
  const by = {}, tierAt = n => [...TIERS].reverse().find(r => n >= r[0]) || TIERS[0];
  for (const x of L) if (x.m.status === 'catalog' && x.m.pn && x.m.qty > 0) (by[x.m.pn] = by[x.m.pn] || []).push(x);
  return Object.values(by).filter(a => a.length > 1).map(a => { const n = a.reduce((s, x) => s + x.m.qty, 0), t = tierAt(n), t1 = Math.max(...a.map(x => tierAt(x.m.qty)[1]));
    return t && t[1] < t1 ? { lines: a, p: { pn: a[0].m.pn, n, tier: `${t[0].toLocaleString()}개 이상`, tierEn: `${t[0].toLocaleString()}+ pcs` } } : null; }).filter(Boolean); }, g: p => p.pn,
  ko: '같은 사양({pn})이 여러 줄에 있습니다. 합산 {n}개면 단가 구간이 {tier}로 내려갑니다(옵션). 견적서 줄은 고객 번호대로 나눠 둡니다.', en: 'Identical item ({pn}) on several lines; combined qty {n} reaches the {tierEn} price tier (option). Quote lines are kept per customer line.', refs: [], imp: 'option' });
cdRule('K-VALIDITY', 'D', 'COM', 'APPROVE', 'dev', 'policy', { rfq: D => { const r = +D.rfq.commercial?.requiredValidityDays; return r > SHOP_TERMS.validityDays ? [{ p: { req: r, days: SHOP_TERMS.validityDays }, ref: 'RFQ', req: { ko: `요구 유효기간 ${r}일`, en: `Required validity ${r} days` } }] : []; }, g: () => 'validity',
  offer: p => cdOff(`유효기간 ${p.days}일 (연장 조건: [자리표시: 운영자 입력]; 수입품은 GC-C15 조건)`, `Validity ${p.days} days (extension: [placeholder]; imports per GC-C15)`),
  ko: '요구 유효기간 {req}일 → 당사 {days}일. 연장 가능 범위는 [자리표시: 운영자 입력]입니다.', en: 'Required validity {req} days → offered {days} days. Extension: [placeholder: operator to set].', refs: ['GC-C02', 'GC-C15'] });
cdRule('K-PAY', 'D', 'COM', 'APPROVE', 'dev', 'policy', { rfq: D => { const t = D.rfq.commercial?.paymentTerms; return t ? [{ p: { req: t }, ref: 'RFQ', req: { ko: `대금 지급 조건: ${t}`, en: `Payment terms: ${t}` } }] : []; }, g: () => 'pay',
  offer: () => cdOff('당사 대금 지급 조건 (GC-C06)', 'Our payment terms (GC-C06)'),
  ko: '귀사 대금 지급 조건({req})에 대한 당사 제안은 GC-C06입니다. 조건이 맞지 않는 부분은 협의합니다.', en: 'Against your payment terms ({req}), our offer is the GC-C06 payment terms; differences to be agreed.', refs: ['GC-C06'] });
cdRule('K-LD', 'D', 'COM', 'APPROVE', 'dev', 'policy', { rfq: D => { const c = D.rfq.commercial || {}, out = [];
  if (c.ld) out.push({ p: { item: '지체상금', itemEn: 'liquidated damages', req: c.ld, reqEn: c.ld, gc: 'GC-C13' }, ref: 'RFQ', req: { ko: `지체상금: ${c.ld}`, en: `Liquidated damages: ${c.ld}` } });
  if (c.warrantyMonths) out.push({ p: { item: '하자보증', itemEn: 'warranty', req: `${c.warrantyMonths}개월`, reqEn: `${c.warrantyMonths} months`, gc: 'GC-C12' }, ref: 'RFQ', req: { ko: `하자보증 ${c.warrantyMonths}개월`, en: `Warranty ${c.warrantyMonths} months` } });
  if (c.bondRequired) out.push({ p: { item: '이행보증', itemEn: 'performance bond', req: '요구', reqEn: 'required', gc: 'GC-C13' }, ref: 'RFQ', req: { ko: '이행보증 요구', en: 'Performance bond required' } });
  return out; }, g: p => p.item, offer: p => cdOff(`${p.gc} [자리표시: 운영자 입력]`, `${p.gc} [placeholder]`),
  ko: '귀사 {item} 조건({req})에 대해 당사 조건은 {gc}입니다.', en: 'Your {itemEn} terms ({reqEn}): our terms per {gc}.', refs: ['GC-C12', 'GC-C13', 'GC-C14'] });

/* N — 공급 불가·읽지 못함·제외·미견적 */
cdRule('N-NA', 'E', 'COM', 'INFO', 'na', 'policy', { ev: true, p: (p, x) => { const t = (x.m.reasons.find(r => r.tone === 'crit') || {}).text || ''; return { reason: t, tail: /문의해 주세요|구매해 주세요/.test(t) ? '' : ' 이 줄만 다른 공급처에 문의해 주십시오.' }; }, g: p => p.why,
  offer: () => cdOff('공급하지 않음', 'Not supplied'), ko: '{reason}{tail}', en: 'We do not supply this item; please source this line only elsewhere.', refs: [], imp: 'excluded' });
cdRule('N-UNREAD', 'C', 'COM', 'CONFIRM', 'unread', 'engine', { ev: true, g: p => p.why === 'size' ? 'size' : 'item',
  ko: p => p.why === 'size' ? '호칭(지름·나사)을 읽지 못했습니다. 지름과 피치(산 수)를 알려 주시면 견적합니다.' : '품목과 사양을 읽지 못했습니다. 사양을 알려 주시면 견적합니다.',
  en: p => p.why === 'size' ? 'Size could not be read; please advise diameter and pitch.' : 'Item and specification could not be read; please advise.', refs: [], imp: 'tbd' });
cdRule('N-EXCL', 'E', 'COM', 'INFO', 'auto', 'policy', { when: x => x.excluded, g: () => 'excl', offer: () => cdOff('견적에서 제외', 'Excluded'),
  ko: '귀사 요청으로 견적에서 뺐습니다.', en: 'Excluded at your request.', refs: [], imp: 'excluded' });
cdRule('N-NOTQ', 'E', 'COM', 'INFO', 'auto', 'policy', { when: x => x.D.firm && !x.excluded && x.m.status === 'engineer-quote' && !x.priced ? { reply: cdDateKo(x.replyBy), replyEn: cdDateEn(x.replyBy) } : false, g: p => p.reply,
  offer: () => cdOff('미견적 Not quoted', 'Not quoted'), ko: '이 줄은 이번 Rev에서 미견적입니다. 단가·납기는 {reply}까지 회신해 다음 Rev에 반영합니다.', en: 'Not quoted in this Rev; price and lead time to follow by {replyEn}, reflected in the next Rev.', refs: ['GC-C09'], imp: 'tbd' });

/* L — 줄 사이 일관성 (BOM 전체) */
const CD_NUT_PAIR = { B7: ['2H', '7', '2HM'], B7M: ['2HM', '7M'], L7: ['7L', '7'], L43: ['7L', '7'], L7M: ['7M', '2HM', '7ML'], B8: ['8', '8M'], B8M: ['8M'], B16: ['7', '2H'],
  '8.8': ['N8', 'N10', 'N12'], '10.9': ['N10', 'N12'], '12.9': ['N12'], A325: ['A563-DH', 'A563-C', 'A563-D', '2H'], A490: ['A563-DH', 'A563-DH3', '2H'], 'F1554-36': ['A563-A', 'A563-C', 'A563-D', 'A563-DH', '2H'], 'F1554-55': ['A563-A', 'A563-C', 'A563-D', 'A563-DH', '2H'] };
const cdSzKey = x => !x.q.size || x.q.size.v == null ? null : x.q.system === 'inch' ? 'in' + x.q.size.v.toFixed(4) : 'mm' + x.q.size.v;
const cdThd = x => x.q.system === 'inch' ? `${x.q.size.label}-${x.q.tpi || '?'} ${x.q.series || ''}`.trim() : `${x.q.size.label}×${x.q.pitch || '?'}`;
function cdPairs(L) {   // 같은 호칭의 볼트·스터드 줄과 너트 줄
  const by = {};
  for (const x of L) { if (x.m.status === 'not-available') continue; const k = cdSzKey(x); if (!k) continue; const g = by[k] = by[k] || { b: [], n: [], w: [] };
    if (CD_BOLTS.has(x.q.type) && x.q.type !== 'rod' && x.q.type !== 'anchor' || x.q.type === 'anchor') g.b.push(x); else if (NUTS.has(x.q.type)) g.n.push(x); else if (['washer', 'lockwasher'].includes(x.q.type)) g.w.push(x); }
  return Object.values(by).filter(g => g.b.length && g.n.length);
}
const cdRefs = a => cdRefText(a.map(x => x.ref));
cdRule('L-NUT-PAIR', 'C', 'MAT', 'CONFIRM', 'auto', 'local', { bom: L => { const out = [];
  for (const g of cdPairs(L)) for (const b of g.b) { const rec = CD_NUT_PAIR[b.q.mat?.code]; if (!rec) continue;
    const bad = g.n.filter(n => n.q.mat?.code && n.q.mat.stated !== false && !n.q.mat.def && !rec.includes(n.q.mat.code));
    if (bad.length) out.push({ lines: [b, ...bad], p: { bLines: b.ref, bolt: cdMatEn(b.q.mat.code), nLines: cdRefs(bad), nutG: cdUniq(bad.map(n => cdMatEn(n.q.mat.code))).join('·'), rec: b.q.mat.code === 'L7M' ? cdMatEn('L7M-NUT') : rec.map(cdMatEn).join(' / '), recKo: b.q.mat.code === 'L7M' ? 'ASTM A194 7M(저온 충격시험) 또는 2HM — 주문 때 확인' : rec.map(cdMatEn).join(' / ') } }); }
  return out; }, g: p => `${p.bolt}|${p.nLines}`,
  ko: 'BOM No {bLines}의 {bolt} 볼팅과 No {nLines}의 {nutG} 너트는 일반적인 짝이 아닙니다(권장 너트: {recKo}). 확인해 주십시오.', en: '{bolt} on line {bLines} and {nutG} nuts on line {nLines} are not a usual pairing (recommended: {rec}). Please confirm.',
  refs: ['RCSC 2025 Table 2.2', 'ASTM A563/A563M-26 §1.2', 'ASTM A194'] });
cdRule('L-SERIES', 'C', 'THD', 'CONFIRM', 'auto', 'local', { bom: L => { const out = [];
  for (const g of cdPairs(L)) for (const b of g.b) { const bad = g.n.filter(n => b.q.system === n.q.system && (b.q.system === 'inch' ? b.q.tpi && n.q.tpi && b.q.tpi !== n.q.tpi : b.q.pitch && n.q.pitch && Math.abs(b.q.pitch - n.q.pitch) > 1e-6));
    if (bad.length) out.push({ lines: [b, ...bad], p: { bLines: b.ref, s1: cdThd(b), nLines: cdRefs(bad), s2: cdUniq(bad.map(cdThd)).join('·') } }); }
  return out; }, g: p => `${p.s1}|${p.nLines}`,
  ko: 'BOM No {bLines}({s1})와 No {nLines}({s2})의 나사 계열이 달라 체결되지 않습니다.', en: 'Thread series differ between line {bLines} ({s1}) and line {nLines} ({s2}); they will not assemble.', refs: ['ASME B1.1'] });
cdRule('L-FIN-MATCH', 'C', 'CTG', 'CONFIRM', 'auto', 'local', { bom: L => { const out = [];
  for (const g of cdPairs(L)) { const hb = g.b.filter(x => cdF(x, 'HDG')), hn = g.n.filter(x => cdF(x, 'HDG')), pb = g.b.filter(x => !cdF(x, 'HDG')), pn = g.n.filter(x => !cdF(x, 'HDG'));
    if (hb.length && pn.length) out.push({ lines: [...hb, ...pn], p: { nLines: cdRefs(pn) } });
    else if (hn.length && pb.length) out.push({ lines: [...pb, ...hn], p: { nLines: cdRefs(hn) } }); }
  return out; }, g: p => p.nLines,
  ko: '용융아연 볼트에는 도금 후 오버탭한 HDG 너트를 짝지으며, 볼트·너트는 같은 아연 공정이어야 합니다. No {nLines} 너트의 표면처리를 확인해 주십시오.', en: 'HDG bolts require HDG nuts overtapped after coating, with the same zinc process for bolts and nuts. Please confirm the finish of nuts on line {nLines}.', refs: ['RCSC 2025', 'Iowa DOT IM 453.08'] });
cdRule('L-WASHER', 'C', 'MAT', 'CONFIRM', 'auto', 'local', { bom: L => { const s = L.filter(x => cdM(x, 'A325', 'A490') && x.m.status !== 'not-available');
  return s.length && !L.some(x => ['washer'].includes(x.q.type) && x.m.status !== 'not-available') ? [{ lines: s, p: {} }] : []; }, g: () => 'f436',
  ko: '구조용 고장력 세트의 F436 와셔는 구멍 형식·재질·조임 방법에 따라 필요합니다(RCSC 6장). BOM에 와셔 줄이 없어 확인합니다.', en: 'F436 washers for structural high-strength assemblies are required depending on hole type, material and installation method (RCSC Chapter 6). No washer line in the BOM; please confirm.', refs: ['RCSC 2025 §6.1–6.2'] });
cdRule('L-NUT-QTY', 'C', 'COM', 'CONFIRM', 'auto', 'practice', { bom: L => { const out = [];
  for (const g of cdPairs(L)) { const b = g.b.filter(x => ['stud', 'hexbolt', 'heavyhexbolt', 'bolt'].includes(x.q.type) && !(x.q.type === 'stud' && x.q.sub?.nuts)), n = g.n.filter(x => !x.q.special.includes('JAM') && !x.q.sub?.jam && b.some(y => y.q.system === x.q.system && (x.q.system === 'inch' ? y.q.tpi === x.q.tpi : true)));
    if (!b.length || !n.length) continue;
    const studs = b.filter(x => x.q.type === 'stud').reduce((a, x) => a + x.m.qty, 0), bolts = b.filter(x => x.q.type !== 'stud').reduce((a, x) => a + x.m.qty, 0), need = studs * 2 + bolts, nn = n.reduce((a, x) => a + x.m.qty, 0);
    // B16.5 볼트 표가 있는 플랜지 문맥이면 플랜지 조 수도 함께 적는다 (스터드 수 ÷ 플랜지 1조 볼트 수)
    const f = b[0].ctx.flange, t = f && f.std === 'B16.5' && b.every(x => x.q.type === 'stud' && JSON.stringify(x.ctx.flange) === JSON.stringify(f)) ? cdB165(f.cls, f.nps) : null;
    const fl = t && studs % t.n === 0 ? { ko: ` (B16.5 NPS ${f.nps} Class ${f.cls} 플랜지 ${studs / t.n}조 × ${t.n}개)`, en: ` (B16.5 NPS ${f.nps} Class ${f.cls}: ${studs / t.n} flange joint(s) × ${t.n})` } : { ko: '', en: '' };
    if (need !== nn) out.push({ lines: [...b, ...n], p: { bLines: cdRefs(b), nb: studs + bolts, need, nLines: cdRefs(n), nn, fl: fl.ko, flEn: fl.en, basis: studs && bolts ? '스터드 × 2 + 볼트 × 1' : studs ? '스터드 × 2' : '볼트 × 1', basisEn: studs && bolts ? 'studs × 2 + bolts × 1' : studs ? 'studs × 2' : 'bolts × 1' } }); }
  return out; }, g: p => `${p.bLines}|${p.nLines}`,
  ko: 'BOM No {bLines}의 볼트·스터드 {nb}개{fl}에는 너트 {need}개가 필요한데({basis}) No {nLines} 너트는 {nn}개입니다. 수량을 확인해 주십시오. 견적은 BOM 수량대로 했습니다.', en: '{nb} bolts/studs on line {bLines}{flEn} need {need} nuts ({basisEn}); line {nLines} has {nn}. Please confirm quantity; quoted as per BOM.', refs: [] });
cdRule('L-FLANGE', 'C', 'DIM', 'CONFIRM', 'auto', 'second', { bom: L => { const out = [];
  for (const x of L) { const f = x.ctx.flange; if (!f || f.std !== 'B16.5' || !cdIN(x) || !cdT(x, 'stud') || !x.q.size) continue;
    const t = cdB165(f.cls, f.nps); if (!t) continue;
    const dOk = Math.abs(t.dia - x.q.size.v) < 1e-3 && (!x.q.tpi || x.q.tpi === t.tpi), len = x.q.lengthIn, lOk = len == null || [t.rf, t.rtj].some(v => v != null && Math.abs(v - len) < .01);
    const qOk = !x.m.qty || x.m.qty % t.n === 0;
    if (!dOk || !lOk || !qOk) out.push({ lines: [x], p: { nps: f.nps, cls: f.cls, n: t.n, dia: `${inFrac(t.dia)}"-${t.tpi}`, lenTab: `${inFrac(t.rf)}" RF${t.rtj ? ` · ${inFrac(t.rtj)}" RTJ` : ''}`, req: `${cdThd(x)} × ${len ? inFrac(len) + '"' : '—'}, ${x.m.qty}개`, reqEn: `${cdThd(x)} x ${len ? inFrac(len) + '"' : '—'}, ${x.m.qty} pcs`,
      qn: qOk ? '' : ` 수량 ${x.m.qty}개는 플랜지 1조 볼트 수 ${t.n}의 배수가 아닙니다.`, qnEn: qOk ? '' : ` Quantity ${x.m.qty} is not a multiple of ${t.n} bolts per flange.` } }); }
  return out; }, g: p => `${p.nps}|${p.cls}|${p.req}`,
  ko: 'NPS {nps} Class {cls} 플랜지의 B16.5 볼팅은 {n} × {dia}, 스터드 길이 {lenTab}입니다(제조사 공개 차트 3곳 대조 참고값). BOM은 {req}입니다.{qn} RTJ·두꺼운 장비 노즐·텐셔너 여유가 이유라면 그대로 두고, 아니면 확인해 주십시오.',
  en: 'B16.5 bolting for NPS {nps} Class {cls}: {n} × {dia}, stud length {lenTab} (reference values cross-checked against three makers\' published charts). BOM states {reqEn}.{qnEn} Leave as is if due to RTJ, a thick equipment nozzle or tensioner allowance; otherwise please confirm.', refs: ['ASME B16.5'] });
// 엔진 메모 (행을 만들지 않는 이벤트): K-EQ = 엔지니어 견적 사유(수배 품목). 줄은 준수 코드 N + 회신 예정일로 남는다
cdRule('K-EQ', 'C', 'COM', 'INFO', 'auto', 'engine', { ev: true, out: 'none' });
const CD_RULE = Object.fromEntries(CD_RULES.map(r => [r.id, r]));

/* ── 일반 Clarification (사양 4.7). cond: 'always' | 규칙 ID 목록(해당 줄 수를 붙임) | fn(D) ── */
const CD_GC_T = [
  ['GC-T01', 'always', '사양 해석은 귀사 BOM 원문 기준입니다. 원문에 없는 값은 해당 제품 규격의 표준값으로 채웠고, 줄마다 그 내용을 C행으로 밝혔습니다.', 'Specifications are interpreted from the BOM text as written. Values not stated were filled with the default of the applicable product standard and are listed as C items.'],
  ['GC-T02', 'always', '판(edition)이 적히지 않은 규격은 견적일 현재 유효한 판을 적용합니다. 판에 따라 요구가 달라지는 경우만 따로 C행으로 적습니다.', 'Standards cited without edition are applied in the edition current at quotation date. Edition-dependent items are listed separately.'],
  ['GC-T03', ['A-TOL-M', 'A-TOL-IN'], '나사: 인치는 ASME B1.1 (볼트·스터드 2A, 너트 2B), 미터는 ISO 261 보통나사 (볼트 6g, 너트 6H, ISO 4762 12.9는 5g6g)입니다. 용융아연도금 너트는 도금 후 오버탭합니다(인치 ASTM A563, 미터 ISO 10684 6AZ).', 'Threads: inch to ASME B1.1 (bolts/studs 2A, nuts 2B); metric ISO 261 coarse (bolts 6g, nuts 6H, ISO 4762 PC 12.9: 5g6g). Hot-dip galvanized nuts are tapped oversize after coating (ASTM A563 / ISO 10684 6AZ).'],
  ['GC-T04', 'always', '길이 기준: 육각볼트·렌치볼트는 머리 아래 자리면부터, 접시머리는 머리 포함 전장, 멈춤나사는 전장, 인치 스터드는 ASME B16.5 표 길이 기준(포인트 포함 여부는 주문 때 확인), 미터 스터드는 끝에서 끝까지입니다.', 'Length basis: hex and socket head screws from under the head; flat head overall; set screws overall; inch studs per the ASME B16.5 tabulated length (whether points are included is confirmed at order); metric studs end to end.'],
  ['GC-T05', D => D.lines.some(l => l.drawing?.has), '도면은 규격 치수표 값으로 그린 참고 도면(척도 없음)입니다. 검사 기준은 각 규격 원문입니다. "승인용" 도장이 있는 도면만 승인 대상입니다.', 'Drawings are reference drawings generated from standard dimension tables (NTS). Acceptance is to the standards. Only drawings stamped "For Approval" require approval.'],
  ['GC-T06', ['M-MARK'], '마킹은 재질 규격이 정한 등급 기호와 실제 제조사의 식별 기호입니다. 볼트노트 기호는 각인하지 않습니다.', 'Marking per the material specification: grade symbol and the actual manufacturer\'s identification. No BoltNote mark is stamped.'],
  ['GC-T07', 'always', '입고 검사: 마킹, 2면폭·길이, 나사 게이지(GO/NO-GO), 외관·도금 상태, 성적서 히트번호 대조. 제3자 검사는 C&D에 적은 경우만 포함합니다.', 'Incoming inspection: marking, across flats and length, thread gauging (GO/NO-GO), visual and coating, heat number vs certificate. Third-party inspection only where listed.'],
  ['GC-T08', 'always', '고착방지제·윤활제와 체결 토크값은 공급 범위가 아닙니다. 같은 예압에 필요한 토크는 윤활 조건에 따라 크게 달라집니다.', 'Anti-seize, lubricants and tightening torque values are not in scope. Torque for a given preload varies widely with lubrication.'],
  ['GC-T09', 'always', '대체 사양은 D행에 적은 것만 제안하며 서면 승인 후에만 진행합니다.', 'Substitutes are only those listed as D items and proceed only after written approval.'],
  ['GC-T10', ['Q-COC'], '서류는 주문 시 확정하며 출고 뒤 새로 만들거나 고칠 수 없습니다. 제조사 성적서는 아무것도 고치지 않고 사본으로 전달하며, 실제 납품 수량은 볼트노트 CoC와 거래명세서에 적습니다. 볼트노트는 자기 명의로 EN 10204 3.1·2.2를 발행하지 않습니다. 볼트노트 문서는 적합 확인서 CoC(ISO 16228 F2.1 형식, 시험값 없음)입니다. KOLAS 시험과 3.2는 요청 시 제3자 기관을 통해서만 제공합니다.', 'Documents are fixed at order and cannot be created or amended after shipment. Manufacturer\'s certificates are forwarded as unaltered copies; the delivered quantity is stated on BoltNote\'s CoC and the delivery note. BoltNote does not issue EN 10204 3.1/2.2 in its own name. BoltNote\'s document is a Certificate of Conformity (ISO 16228 F2.1 format, no test values). KOLAS testing and 3.2 are available on request only, through third parties.'],
  ['GC-T11', ['M-PKG'], '포장: 재질·호칭별로 나눠 담고, 서류가 붙는 품목은 한 상자에 한 히트만 담습니다. 라벨: 규격·등급·호칭·수량·히트/로트 번호(+ 귀사 PO·라인 번호).', 'Packing: separated by material and size; one heat per box for certified items. Label: spec, grade, size, qty, heat/lot (+ PO and line no.).'],
  ['GC-T12', D => D.items.some(x => x.m.status !== 'not-available' && (SOCKET.has(x.q.type) || ['hexbolt', 'heavyhexbolt', 'nut', 'heavynut', 'stud'].includes(x.q.type))), '렌치 크기(육각 구멍 키)·2면폭은 적용 치수 규격의 표값입니다. DIN 규격과 2면폭이 다른 호칭은 D행으로 따로 적습니다.', 'Hex key and across-flats sizes are per the applicable dimensional standard tables. Sizes where DIN across flats differ are listed as D items.'],
  ['GC-T13', 'always', '이 견적은 "검토 문서" 목록에 있는 문서만 근거로 합니다. 목록에 없는 문서(참조만 되고 받지 못한 사양서·도면·VDRL·일반 구매 조건 등)는 검토하지 않았으며, 받으면 검토해 다음 Rev에 C&D로 반영합니다.', 'This offer is based only on the documents listed under "Basis of Offer". Documents not listed (including specifications, drawings, VDRL or general conditions referenced but not received) have not been reviewed; on receipt they will be reviewed and reflected in the next Rev.'],
  ['GC-T14', D => D.firm, '볼트노트는 유통업자입니다. 제조 공정 검사(Hold·Witness 지점이 있는 ITP)는 제조사 문서로만 제공합니다. 볼트노트의 검사는 GC-T07 입고 검사이며, 고객 입회는 [자리표시: 사전 통보 기간] 전 통보 시 출고 전 검사로 받습니다.', 'BoltNote is a distributor. Manufacturing inspection (ITP with hold/witness points) is available only as the manufacturer\'s document. BoltNote\'s inspection is the incoming inspection in GC-T07; client witness of pre-dispatch inspection on [placeholder: notice period] notice.'],
].map(([id, cond, ko, en]) => ({ id, cond, ko, en, part: 'T' }));
const CD_PH = (ko, en) => ({ ko: `[자리표시 — ${ko}: 운영자 입력]`, en: `[placeholder — ${en}: to be set by the operator]` });
const CD_GC_C = [
  ['GC-C01', () => BOM_VAT.gc.ko, () => BOM_VAT.gc.en],
  ['GC-C02', () => `견적 유효기간은 견적일로부터 ${SHOP_TERMS.validityDays}일입니다(RFQ가 더 긴 기간을 요구하면 K-VALIDITY 행을 따릅니다). 유효기간이 더 짧은 줄(수입품 등)은 줄에 표시합니다.`, () => `Validity ${SHOP_TERMS.validityDays} days from quotation date (where the RFQ requires longer, see the K-VALIDITY item). Lines with shorter validity (e.g., imports) are marked.`],
  ['GC-C03', () => `인도 조건: ${SHOP_TERMS.incoterm} (Incoterms® 2020 DAP + 지정 장소). 장척물(1 m 이상)·총중량 ${SHOP_TERMS.heavyKg} kg 초과는 화물로 보내며 운임은 별도입니다.`, () => 'Delivery: domestic courier, DAP named place (Incoterms® 2020). Long (≥ 1 m) or > 30 kg shipments by freight, charged separately.'],
  // 셈법은 페이지 shipDate()와 같다: 마감 전 확정분은 그날부터, 마감 뒤·쉬는 날 확정분은 다음 영업일부터 한국 영업일로 센다
  ['GC-C04', () => `납기는 발주 확정(입금·카드 결제 확인, 승인 거래처는 ${ORDER_LIVE ? '발주서' : '주문서'} 접수, 공공기관은 발주 통보) 시점부터 한국 영업일로 셉니다. 평일 ${CUT_T}(한국 시간)까지 확정된 발주는 그날부터, 그 뒤나 쉬는 날에 확정된 발주는 다음 영업일부터 셉니다. 줄별 납기 등급을 따르며, 따로 요청하지 않으면 분할 출하합니다.`, () => `Lead time counts in Korean business days from order confirmation (receipt of payment, or receipt of PO for approved accounts and public buyers): orders confirmed by ${CUT_T} KST on a business day count from that day, later or on a non-business day from the next business day; per line tier. Partial shipments unless instructed otherwise.`],
  ['GC-C05', () => '수량은 BOM 수량 그대로입니다. 예비품·여유분은 넣지 않았습니다. 포장 단위로 늘리면 더 싼 경우는 줄마다 옵션으로 적었습니다.', () => 'Quantities as per BOM; no spares or contingency included. Where a pack round-up is cheaper it is shown per line as an option.'],
  ['GC-C06', () => `대금 지급 조건: ${SHOP_TERMS.payment}. RFQ 대금 지급 조건과 다르면 K-PAY 행으로 적습니다.`, () => 'Payment terms: bank transfer. New accounts: prepayment after order confirmation (dispatch on receipt of payment; tax invoice at payment). Approved accounts: month-end closing, consolidated month-end tax invoice, payment by transfer within [30] days. Public buyers: invoice after delivery and inspection (statutory payment periods). Cards (corporate cards, government purchase cards, personal credit cards): payment link on request (the card slip replaces the tax invoice). Where different from the RFQ terms, see the K-PAY item.'],
  ['GC-C07', () => '세금계산서는 사업자·기관에 전자 발급합니다(공급일 기준, 승인 거래처는 말일자 월합계). 카드(법인카드·구매카드 포함)로 결제하면 카드 매출전표가 증빙이 되어 세금계산서를 따로 발급하지 않습니다. 같은 거래에 두 증빙을 함께 발급하지 않습니다.', () => 'Electronic tax invoices are issued to businesses and public bodies (on the supply date; consolidated at month-end for approved accounts). For card payments (incl. corporate and purchase cards) the card slip is the evidence and no tax invoice is issued. Both are never issued for the same transaction.'],
  ['GC-C08', () => '반품·검수: 이 조건은 따로 협의한 사업자·기관 거래(확정 견적, 귀사 발주 조건)에 적용합니다. 사이트 표시 가격 그대로의 자동 견적·발주는 개인 고객과 같은 교환·반품 조건(사이트 회사 소개의 교환·반품, 전자상거래법 청약철회)을 따릅니다. 받으신 뒤 지체 없이 검수하고, 수량 부족·외관 하자는 [3]영업일 안에 알려 주십시오. 규격품은 미개봉에 한해 반품을 협의하며, 수입품과 주문 제작품은 반품할 수 없습니다(불량·오배송은 교환 또는 환불). 개인 고객은 전자상거래법의 청약철회 규정이 우선하며, 주문제작품은 발주 때 따로 동의를 받은 경우에만 철회가 제한됩니다.', () => 'Returns and inspection: these terms apply to separately negotiated business and public-body transactions (firm quotations, your purchase terms). Automatic quotations and orders at the prices shown on the site follow the same exchange and return terms as individual customers (exchanges and returns on the site About page; withdrawal under the E-Commerce Act). Please inspect without delay on receipt and report shortages or visible defects within [3] business days. Unopened standard items may be returned by agreement; imported and made-to-order items are non-returnable (defective or wrongly shipped items are replaced or refunded). For individual consumers the withdrawal rules of the E-Commerce Act prevail; for made-to-order items withdrawal is limited only where separately agreed at order.'],
  ['GC-C09', () => '엔지니어 견적 줄은 줄마다 적은 회신 예정일까지 단가·납기를 회신하고 다음 Rev에 반영합니다.', () => 'Engineer-quote lines: price and lead time by the reply date shown per line, reflected in the next Rev.'],
  ['GC-C10', () => `공급 불가 줄은 견적에서 뺐습니다. ${SHOP_TERMS.notAvail}`, () => 'Not-available lines are excluded; please source those lines only from another supplier.'],
  ['GC-C11', () => '보내 주신 BOM·도면은 견적과 주문 처리에만 쓰며 공개하지 않습니다.', () => 'BOMs and drawings are used only for quotation and order processing and are never published.'],
  ['GC-C12', () => '품질 보증: ' + CD_PH('보증 기간·범위', 'warranty period and scope').ko, () => 'Warranty: ' + CD_PH('보증 기간·범위', 'warranty period and scope').en, true],
  ['GC-C13', () => '지체상금·보증증권: ' + CD_PH('지체상금 요율·상한, 보증증권 조건', 'LD rate and cap, bonds').ko, () => 'Liquidated damages and bonds: ' + CD_PH('', 'LD rate and cap, bonds').en, true],
  ['GC-C14', () => '책임 한도: ' + CD_PH('책임 한도', 'limitation of liability').ko, () => 'Limitation of liability: ' + CD_PH('', 'limitation of liability').en, true],
  ['GC-C15', () => '가격 조정: ' + CD_PH('수입품 기준 환율·조정 폭·상한', 'import FX basis, band and cap').ko, () => 'Price adjustment: ' + CD_PH('', 'import FX basis, band and cap').en, true],
  ['GC-C16', () => '상업 조건 적용 범위: ' + CD_PH('귀사 일반 구매 조건과의 관계', 'relation to your general terms').ko, () => 'Order of precedence: ' + CD_PH('', 'relation to your general terms').en, true],
  ['GC-C17', () => '포장 조건: ' + CD_PH('기본 포장·수출 포장 범위', 'standard and export packing').ko, () => 'Packing terms: ' + CD_PH('', 'standard and export packing').en, true],
].map(([id, ko, en, ph]) => ({ id, cond: 'always', ko, en, part: 'C', ph: !!ph }));

/* ── 서류 계획 (사양 3.8, HARD RULE 5) ── */
const CD_DOC = {
  COC_F21: { ko: 'CoC 적합 확인서 (ISO 16228 F2.1 형식, 시험값 없음)', short: 'CoC(F2.1)', en: 'Certificate of Conformity (ISO 16228 F2.1 format, no test values)', by: 'BoltNote' },
  MTC31_FWD: { ko: '제조사 EN 10204 3.1 사본 (수정 없이 전달)', short: '제조사 3.1 사본', en: 'Manufacturer\'s EN 10204 3.1 copy (forwarded unaltered)', by: 'manufacturer' },
  MTC22_FWD: { ko: '제조사 EN 10204 2.2 사본 (수정 없이 전달)', short: '제조사 2.2 사본', en: 'Manufacturer\'s EN 10204 2.2 copy (forwarded unaltered)', by: 'manufacturer' },
  HARD100: { ko: '전수 경도시험 기록 (제조사)', short: '전수 경도 기록', en: '100% hardness test record (manufacturer)', by: 'manufacturer' },
  IMPACT: { ko: '샤르피 충격시험 결과 (제조사 3.1에 포함)', short: '충격시험 결과', en: 'Charpy impact results (in manufacturer\'s 3.1)', by: 'manufacturer' },
  COAT: { ko: '도금·코팅 성적서 사본', short: '코팅 성적서 사본', en: 'Coating/plating certificate copy', by: 'coater' },
  KOLAS: { ko: 'KOLAS 공인시험성적서 (외부 시험소, 시험 시료에 한정)', short: 'KOLAS', en: 'KOLAS accredited test report (external lab, tested samples only)', by: 'third-party lab' },
  MTC32: { ko: 'EN 10204 3.2 (제조사와 귀사 검사원 또는 귀사가 지정한 검사기관 공동 서명)', short: '3.2', en: 'EN 10204 3.2 (co-signed by the manufacturer and the purchaser\'s inspector or designated inspection body)', by: 'third-party inspection body' },
  ORIGIN: { ko: '원산지 증빙 (수입신고필증·제조사 서류)', short: '원산지 증빙', en: 'Origin evidence (import declaration / manufacturer documents)', by: 'customs / manufacturer' },
  PACKLIST: { ko: '포장 명세서 (상자별 BOM No·히트/로트·수량)', short: '포장 명세서', en: 'Packing list (per box: line, heat/lot, qty)', by: 'BoltNote' },
  ITP_DIST: { ko: '유통 단계 검사 계획서 (입고 검사·히트 대조·포장 확인)', short: '유통 단계 검사 계획서', en: 'Distribution-stage inspection plan', by: 'BoltNote' },
  MDR: { ko: '서류 묶음 (편철·색인)', short: '서류 묶음', en: 'Compiled document dossier (binding and index)', by: 'BoltNote' },
};
function cdDocPlan(x, D) {
  if (x.m.status === 'not-available' || x.excluded) return null;
  const docs = x.ctx.docs || [], mc = x.q.mat?.code, nut = x.q.mat?.nut, plan = [], add = (code, o = {}) => plan.push({ code, by: CD_DOC[code].by, incl: true, option: false, addDays: null, price: null, ...o });
  add('COC_F21');
  // 사워(NACE)·저온(충격시험) 등급은 경도·충격 값이 제조사 3.1에 실려 오므로 3.1을 '필요'로 둔다 (2026-10, 대표 지적: 줄마다 필요한 서류를 정확히)
  const testGrade = ['B7M', 'L7', 'L7M', 'L43', '2HM', '7M', '7L', '7ML'].includes(mc) || ['2HM', '7M', '7L', '7ML', 'L7M-NUT'].includes(nut) || cdSP(x, 'NACE') || cdSP(x, 'IMPACT');
  const want31 = cdSP(x, 'CERT') || docs.includes('3.1') || docs.includes('3.1-self') || testGrade;
  if (want31) add('MTC31_FWD', { addDays: (x.m.reasons || []).some(r => r.lead === 'cert') ? LEAD_DAYS.cert : null, note: x.m.lead?.code === 'DOMESTIC_MFG' ? '제작을 맡은 업체 명의' : '' });
  else add('MTC31_FWD', { incl: false, option: true, addDays: x.m.status === 'catalog' ? LEAD_DAYS.cert : null, note: '요청 시 3.1이 있는 로트로 수배' });
  if (docs.includes('2.2')) add('MTC22_FWD');
  if (['B7M', 'L7M'].includes(mc)) add('HARD100');   // 2HM·7M 너트 전수 경도는 공개 출처 2곳뿐이라 서류 계획에서 뺐다 (2026-10 감사)
  if (['L7', 'L7M', 'L43', '7L', '7ML'].includes(mc) || ['7L', '7ML', 'L7M-NUT'].includes(nut) || cdSP(x, 'IMPACT')) add('IMPACT');
  const hiZn = cdF(x, 'ZN', 'YZ', 'ZB', 'ZNNI') && cdM(x, '10.9', '12.9', '010.9', 'A574', 'F912', 'F835', '45H', 'J429-8', 'A354-BD');
  if (cdF(x, 'HDG', 'ZF', 'PTFE', 'ZNNI', 'PH') || hiZn) add('COAT', { note: hiZn ? '베이킹 기록 포함' : '' });
  add('KOLAS', { incl: docs.includes('KOLAS'), option: !docs.includes('KOLAS'), onRequest: true, addDays: [5, 10], note: '실비, 외부 공인시험소' });
  add('MTC32', { incl: docs.includes('3.2'), option: !docs.includes('3.2'), onRequest: true, addDays: [5, 20], note: '귀사 승인 기관, 귀사 비용' });
  if (docs.includes('origin') || D.rfq.avl?.originProof) add('ORIGIN');
  if (D.firm) add('PACKLIST');
  if (x.ctx.vdrl) { add('ITP_DIST'); add('MDR'); }
  const incl = plan.filter(p => p.incl), opt = plan.filter(p => p.option);
  const bd = r => r ? ` +${r[0]}–${r[1]}영업일` : '', bdEn = r => r ? ` +${r[0]}–${r[1]} BD` : '';
  return { plan, text: { ko: `포함: ${incl.map(p => CD_DOC[p.code].short + (p.addDays ? `(${bd(p.addDays).trim()})` : '')).join(', ')}${opt.length ? ` · 옵션: ${opt.map(p => CD_DOC[p.code].short + `(요청 시${p.code === 'KOLAS' || p.code === 'MTC32' ? ', 실비' : ''}${p.addDays ? ',' + bd(p.addDays) : ''})`).join(', ')}` : ''}`,
    en: `Incl.: ${incl.map(p => p.code).join(', ')}${opt.length ? ` · Options: ${opt.map(p => p.code + bdEn(p.addDays)).join(', ')}` : ''}` } };
}
// 도면 (사양 3.9). 표준 치수값으로 그린 SVG만 (타사 도면 복사 없음)
function cdDrawing(x, quoteNo) {
  if (x.m.status === 'not-available' || x.excluded) return null;
  const no = `${quoteNo}-D${x.ref}`;
  if (x.q.variant) return { no: null, has: false, note: { ko: '표준 도면 없음 (변형품)', en: 'No standard drawing (variant)' } };
  let has = false; try { has = !!drawingFor(x); } catch (e) { has = false; }
  if (!has) return { no: null, has: false, note: { ko: '도면 없음', en: 'No drawing' } };
  const nonstd = !!(x.q.sub?.tapEnd || x.q.type === 'anchor' || (x.m.alt && !x.m.alt.exact && (x.m.diffs || []).some(d => /길이/.test(d))) || (x.m.ev || []).some(e => e.rule === 'S-CAT-ALT' && e.why === 'rodlen'));
  return { no, has: true, std: !nonstd, forApproval: nonstd, subjectToMfr: nonstd,
    note: nonstd ? { ko: '승인용 · 제조사 확인 전', en: 'For approval · subject to manufacturer confirmation' } : { ko: '참고 도면 (NTS)', en: 'Reference drawing (NTS)' } };
}
const cdAvl = rfq => !!(rfq?.avl && ((rfq.avl.makers || []).length || (rfq.avl.excludedOrigins || []).length || rfq.avl.originProof));
const cdNormDoc = s => String(s || '').toUpperCase().replace(/[^A-Z0-9가-힣]/g, '');
const cdBasisReceived = (rfq, doc) => (rfq?.basis || []).some(b => b && b.received !== false && cdNormDoc(b.doc) && (cdNormDoc(doc).includes(cdNormDoc(b.doc)) || cdNormDoc(b.doc).includes(cdNormDoc(doc))));
// 엔지니어 견적 회신 예정일 (사양 2.10 SLA 표): 국내 1~20줄 1 · 21~100줄 3 · 101줄 이상 5영업일, 수입·코팅·3.2는 공급처 회신 + 1 (보통 상한 4·5영업일, 101줄 이상은 협의)
function cdReplyDays(nEq, x, D) {
  const ext = ['IMPORT_US', 'IMPORT_US_MFG', 'IMPORT_VIA_KR_MRO'].includes(x.m.lead?.code) || (x.m.reasons || []).some(r => r.lead === 'coat') || (x.ctx.docs || []).includes('3.2');
  if (ext) return nEq > 100 ? null : nEq > 20 ? 5 : 4;
  return nEq > 100 ? 5 : nEq > 20 ? 3 : 1;
}
