/* BOM 붙여넣기 견적 엔진
   흐름: bomRows(붙여넣은 표) → bomLine(한 줄: parseCore → bomDerive → bomMatch) → drawingFor(SVG 도면)
   페이지(base)에서 쓰는 것 (TypeScript 검사로 확인): DIM, METRIC, GRADE, FINISH, TIERS, FREE_SHIP, SHIP_FEE, STEEL,
   dnum, esc, won, pnOf, variantInfo, weightG, shipDate, 재고 운영 스위치 OWN_STOCK (출고 마감 CUTOFF는 shipDate 안에서만 쓴다).
   도면의 치수선·화살표(bdDimLine·BD_DEFS)는 이 블록 안에 따로 있다.
   페이지 쪽 연결은 build.py의 'BOM hook' 줄 (parsePn·variantInfo·go·setNav·SHEETS). 목록은 INTERFACE.md. */

// 견적 조건: 문구와 숫자는 여기 한 곳에서만 바꾼다.
const SHOP_TERMS = {
  validityDays: 14,
  incoterm: '국내 택배, DAP 고객 지정 장소 (운임 포함 조건)',
  incotermShort: '택배 DAP (지정 장소)',
  freight: `규격품 공급가 ${won(FREE_SHIP)} 이상 무료, 미만 ${won(SHIP_FEE)} (VAT 별도)`,
  bulky: '장척물(1 m 이상)·총중량 30 kg 초과는 화물(경동·대신 등) 착불 또는 별도 운임 안내',
  islands: '제주·도서산간 추가 운임은 주문 전 안내',
  payment: '계좌이체. 처음 거래: 발주 확인 후 선입금(입금 확인 시 출고, 입금 시 세금계산서 발행). 승인된 거래처: 월말 마감, 말일자 월합계 세금계산서 발행 후 [30]일 안에 계좌이체. 공공기관: 납품·검수 후 청구(국가·지방계약법 시행령의 지급 기한). 카드(법인카드, 정부·지자체 구매카드, 개인 신용카드)는 요청 시 결제 링크(카드 결제분은 세금계산서 대신 카드 매출전표)',
  reply: '평일 19시 전 접수분은 당일 21시까지 접수 확인. 20줄 이하 견적은 2영업일 안에, 엔지니어 견적 줄은 줄마다 적은 회신 예정일까지 단가·납기 회신',
  vat: 0.1,
  heavyKg: 30,
  notAvail: '이 항목은 저희가 공급하지 않습니다. 이 줄만 다른 공급처에 문의해 주세요.',
};
// 견적 요청 통로 (Phase 1, b2b_site_changes.json channel.config). 운영자가 채움. 빈 값 = 미설정: 화면에는 .ph 자리표시를 보여 주고,
// 그 값에 의존하는 버튼은 disabled + title='운영 정보 등록 후 사용'. href·mailto는 값이 있을 때만 만든다 (v5_rfq.js rfqC).
// 카카오 비즈니스채널 승인: 대표 확인 2026-10-06. 관리자 화면의 채널 식별자 _ZlHxiX를 사용한다.
const CONTACT = { rfq: 'a8wlhg942@naver.com', tel: '010-2093-0196', fax: '', kakaoChat: 'https://pf.kakao.com/_ZlHxiX/chat', kakaoName: '볼트노트', kakaoHours: '평일 09:00–18:00' };

/* ── 사이트 스위치 (IA 명세 2장, 한 곳). 기본값 = 근거 쪽. 대표만 바꾼다 ──
   ORDER_LIVE: 통신판매업 신고 뒤 ordersOpen + 신고번호 + 사업자번호가 모두 있어야 켜진다 (하나라도 비면 '주문 요청서 (확인 후 진행)').
   PRICE_ON(id): 가격 기준일(priceBasis)이 있고 공급처 단가를 확인한 품목(priceOk)만 가격을 보인다. 기본은 하나도 없음 → 모든 줄이 견적. */
const SHOP = {
  ordersOpen: false,        // 통신판매업 신고 뒤 true. 아래 두 값이 다 있어야 실제로 켜짐
  mailOrderNo: '',          // 통신판매업 신고번호
  bizNo: '456-19-02858',    // 사업자등록번호 (등록증 발급 2026-10, 대표 확인). 빈 값이면 .ph '000-00-00000'
  ownerName: '박세중',       // 대표 실명 (대표 확인 2026-10-04). 빈 값이면 .ph '대표 이름'
  addr: '',                 // 사업장 주소. 자택이라 공개하지 않음 (대표 결정 2026-10-04). 빈 값이면 바닥글·견적서에서 주소 칸을 숨김. 통신판매업 신고 때 다시 정함
  ownerYears: '7',          // 회전기기 분야 경력 연수 (대표 확인 2026-10-01). 직장 이름은 쓰지 않음
  hero: 'special',          // 'special' | 'general'
  listPrimary: 'send',      // 'send' 파일 그대로 먼저 | 'paste' 붙여넣기 먼저
  homeLayout: 'doors',      // 'doors' | 'catalog'
  sla: 'parttime',          // 'parttime' 19시→21시 접수 확인 · 20줄 2영업일 | 'fulltime' 4영업시간 · 1영업일
  quickOrder: true,         // false면 문 ②를 숨기고, 가격이 있는 줄도 견적 요청서로 보냄
  priceBasis: '',           // 가격 기준일 'YYYY-MM-DD'. 빈 값이면 가격을 하나도 보이지 않음
  priceOk: [],              // 공급처 단가를 확인한 품목 id (예: 'hbf', 'hn'). 여기 있는 품목만 가격 표시
  minOrder: 0,              // 주문 요청서 최소 공급가(원). 0 = 없음 (대표 결정)
  leadRange: {},            // 품목 id → '2~4' 같은 보통 영업일. 빈 값이면 [n~m] 자리표시
  payLink: false,           // 카드 결제 링크 서비스를 연 뒤 true
  wbPublic: false,          // true면 목록 붙여넣기 뒤 4A 작업대를 바로 보여 줌
};
const ORDER_LIVE = SHOP.ordersOpen && /\S/.test(SHOP.mailOrderNo) && /\S/.test(SHOP.bizNo);
// API 610 재질 클래스 도구 (5장 상세 · 해독 링크 · 검색): 클래스별 볼팅 자료를 공개 출처로 다시 채우기 전까지 숨긴다 (2026-10 감사, INTEGRATE F).
// true로 바꾸면 탭·링크·검색 항목이 다시 나온다. 판별 코드(e0_api610.js, t_api610.js)는 그대로 둔다
const API610_TOOL = false;
// 엔진 카탈로그 품목군(BOM_FAMS) id → 품목 체계 id (가격 스위치는 품목 체계 id로 적는다)
const PRICE_FAM = { 'ss-cup': 'ss', 'ss-flat': 'ss', 'ss-cone': 'ss', 'ss-dog': 'ss', 'iss-cup': 'iss', 'iss-flat': 'iss', 'iss-cone': 'iss', 'iss-oval': 'iss', 'iss-halfdog': 'iss',
  ishc: 'a574', ihcs: 'j429', ihhn: 'hh', istd: 'b7' };
const PRICE_ON = id => /^\d{4}-\d\d-\d\d$/.test(SHOP.priceBasis) && Array.isArray(SHOP.priceOk) && (SHOP.priceOk.includes(id) || SHOP.priceOk.includes(PRICE_FAM[id]));
const PRICE_ANY = () => /^\d{4}-\d\d-\d\d$/.test(SHOP.priceBasis) && Array.isArray(SHOP.priceOk) && SHOP.priceOk.length > 0;
const PRICE_LAB = () => ORDER_LIVE ? '판매가' : '참고가';
const ORDER_DOC = () => ORDER_LIVE ? '발주서' : '주문 요청서';
const SLA_COPY = {
  parttime: { box: '평일 19시 전 접수 → 당일 21시까지 접수 확인 · 20줄 이하 견적 2영업일', recv: '평일 19시 전에 받은 요청은 당일 21시까지 접수 확인 메일을 드립니다', days: 2, tel: '평일 19~21시', telSub: '평일 19~21시에 받습니다. 못 받으면 다시 걸어 드립니다' },
  fulltime: { box: '접수 확인 4영업시간 이내 · 20줄 이하 견적 1영업일', recv: '받은 요청은 4영업시간 안에 접수 확인 메일을 드립니다', days: 1, tel: '평일 09–18시', telSub: '평일 09–18시, 회의·검수 중에는 회신 전화' },
};
const SLA = () => SLA_COPY[SHOP.sla] || SLA_COPY.parttime;

/* ── 인치 나사 기본 데이터. 2026-10 감사 (audit/e1_inch.json): 번호 호칭 지름·UNC·UNF 산 수는 NIST Handbook H28 (1969) Part I 표 2.7–2.9와 대조(T1) ── */
const IN_NUM = { '#0': .06, '#1': .073, '#2': .086, '#3': .099, '#4': .112, '#5': .125, '#6': .138, '#8': .164, '#10': .19, '#12': .216 };
// [기본 지름 in, UNC TPI, UNF TPI]
const UN_TPI = [[.06, null, 80], [.073, 64, 72], [.086, 56, 64], [.099, 48, 56], [.112, 40, 48], [.125, 40, 44], [.138, 32, 40], [.164, 32, 36], [.19, 24, 32], [.216, 24, 28],
  [.25, 20, 28], [.3125, 18, 24], [.375, 16, 24], [.4375, 14, 20], [.5, 13, 20], [.5625, 12, 18], [.625, 11, 18], [.75, 10, 16], [.875, 9, 14], [1, 8, 12],
  [1.125, 7, 12], [1.25, 7, 12], [1.375, 6, 12], [1.5, 6, 12], [1.75, 5, null], [2, 4.5, null], [2.25, 4.5, null], [2.5, 4, null], [2.75, 4, null], [3, 4, null],
  [3.25, 4, null], [3.5, 4, null], [3.75, 4, null], [4, 4, null], [4.5, null, null], [5, null, null], [6, null, null]];   // UNC는 4"까지 (H28 표 2.8). 4-1/2·5·6"의 4산은 4UN (표 2.11)
const near = (a, b, t = .002) => Math.abs(a - b) <= t;
// 유니코드 분수 글자 (½ ¾ …): NFKC는 '1½'을 '11⁄2'로 바꿔 11/2로 읽히므로 먼저 '1-1/2'로 푼다
const VULGAR = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const unVulgar = s => String(s ?? '').replace(/(\d)[ \t]?([½¼¾⅛⅜⅝⅞])/g, (_, w, f) => w + '-' + VULGAR[f]).replace(/[½¼¾⅛⅜⅝⅞]/g, f => VULGAR[f]).replace(/⁄/g, '/');
/* 인치 표기 → 숫자. 읽는 것: '1-1/8' '1 3/8' '15/16' '7/16' '11/16' '0.375' '.750' '3/4"' '1-1/2 in' '#10' '1½'
   '1.1/8'(점을 대분수 구분으로 쓴 표기 → 1-1/8, 분모 2·4·8·16·32·64의 진분수만). 못 읽으면 NaN.
   페이지 inchToMm도 BOM hook(e0_inch.hooks.json)으로 이 함수를 쓴다 (예전 정규식은 '15/16'을 1-5/16로 읽었다). */
function inVal(s) {
  s = unVulgar(s).normalize('NFKC').trim().replace(/\s*(?:"|''|IN(?:CH(?:ES)?)?\.?)$/i, '').trim(); let m;
  if (/^#/.test(s)) return IN_NUM[s.replace(/\s/g, '')] ?? NaN;
  if ((m = s.match(/^(\d+)(?:\s*-\s*|\s+)(\d+)\/(\d+)$/))) return +m[3] ? +m[1] + m[2] / m[3] : NaN;
  if ((m = s.match(/^(\d+)\.(\d{1,2})\/(2|4|8|16|32|64)$/)) && +m[2] < +m[3]) return +m[1] + m[2] / m[3];
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[2] ? m[1] / m[2] : NaN;
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) ? +s : NaN;
}
// 띄어 쓴 대분수 (1–6 + 2·4·8·16분의 진분수): '1 3/8' — 파서 정규식 조각
const MIXED_IN = '[1-6]\\s(?:1\\/2|[13]\\/4|[1357]\\/8|(?:[13579]|1[135])\\/16)';

/* 구조화 이벤트 (C&D 시트가 읽는다). 엔진이 가정·질문·사유 문자열을 쌓는 자리마다 { rule, ...params }를 같이 쌓는다.
   규칙 ID는 BOM·C&D 사양 5장 표와 5.9 이관표. 같은 줄에서 rule·params가 모두 같은 이벤트는 한 번만 둔다.
   엔진 자체 ID: K-EQ(사양 표에 행이 없는 엔지니어 견적 사유, why = 'mill'|'lot'|'make'|'sec'|'size'|'item'|'matspec'),
   A-SS-CLASS(ISO 3506 강도 구분 기본값), S-API610-GRADE(API 610 재질 클래스와 함께 등급이 적힘; 2026-10 감사 뒤 클래스 자료가 비어 있어 쓰이지 않음). */
function bomEv(E, rule, params = {}) {
  if (!E) return;
  const e = { rule, ...params }, k = JSON.stringify(e);
  if (!E.some(x => JSON.stringify(x) === k)) E.push(e);
}
const unRow = d => UN_TPI.find(r => near(r[0], d));
// 분수 표기: 0.375 → 3/8, 1.125 → 1-1/8, 0.19 → #10
function inFrac(v, num = false) {
  if (num) { const k = Object.keys(IN_NUM).find(k => near(IN_NUM[k], v, .0015)); if (k) return k; }
  const w = Math.floor(v + 1e-9), f = v - w;
  for (const den of [2, 4, 8, 16, 32, 64]) { const n = Math.round(f * den); if (Math.abs(f - n / den) < .0011) { if (n === 0) return String(w); if (n === den) return String(w + 1); const g = (a, b) => b ? g(b, a % b) : a; const k = g(n, den); return (w ? w + '-' : '') + `${n / k}/${den / k}`; } }
  return v.toFixed(3);
}
const bomFmtIn = v => `${inFrac(v)}"`;   // 페이지의 fmtIn('1/2-13' → 1/2"-13)과 이름이 겹쳐 bom 접두사
const fmtInMm = v => `${inFrac(v)}" [${(v * 25.4).toFixed(v * 25.4 < 10 ? 2 : 1)}]`;
const tbl = (rows, d) => rows.find(r => near(r[0], d, .0015));

/* ── 인치 육각 구멍붙이 멈춤나사 (ASME B18.3 치수 계열) [d, 키 J(in), J 표기, 컵·평 끝지름 C max]
   2026-10 감사 (audit/e1_inch.json): 제조·유통사 공개 표 3곳 이상 일치(T2)만 남김 — J는 #4–3/4 (BBI·Packer·Fuller·Brassland),
   C max는 #4·#6·#8·#10·1/4·5/16·3/8·1/2 (BBI·Packer·Brassland). #5·7/16·5/8·3/4의 C(공개 표 2곳), 7/8·1 행(2곳), 오벌 R·하프도그 P·Q·
   최적 길이 B·콘 90° 길이 Y 열(1곳 이하)은 출처가 모자라 뺐다 (규격서 확인 중). 도면은 뺀 값 없이 비례 스케치로 그린다 (e8_draw.js) ── */
const SS_IN = [
  [.112, .05, '0.050', .061], [.125, .0625, '1/16', null], [.138, .0625, '1/16', .074], [.164, .078, '5/64', .087], [.19, .094, '3/32', .102],
  [.25, .125, '1/8', .132], [.3125, .156, '5/32', .172], [.375, .188, '3/16', .212], [.4375, .219, '7/32', null], [.5, .25, '1/4', .291],
  [.625, .312, '5/16', null], [.75, .375, '3/8', null],
];
// #0–#3 키: 공개 표 2곳(Packer·Fuller)뿐이라 뺐다 (2026-10 감사). 빈 표로 둔다 (e6_match·e8_draw가 이름으로 찾는다)
const SS_IN_MICRO = [];

/* ── 인치 육각 구멍붙이 볼트 1960 시리즈 (ASME B18.3) [d, 머리지름 A max, 머리높이 H max, 키 J, J 표기, 최소 나사부 LT]
   2026-10 감사: 허용 출처 표가 없어 (제조사 공개 표 0곳, 이전 근거는 무단 사본) 값을 모두 뺐다. 견적·도면은 치수 없이 진행 (규격서 확인 중) ── */
const SHCS_IN = [];
/* ── 인치 접시머리 렌치볼트 (82°) [d, A max, H ref, J, J 표기] — 2026-10 감사: Global Supply·HASM·Packer 공개 표 일치(T2). #12 행은 1곳(HASM)뿐이라 뺐다 ── */
const FHCS_IN = [[.164, .359, .112, .094, '3/32'], [.19, .411, .127, .125, '1/8'], [.25, .531, .161, .156, '5/32'], [.3125, .656, .198, .188, '3/16'],
  [.375, .781, .234, .219, '7/32'], [.4375, .844, .234, .25, '1/4'], [.5, .938, .251, .312, '5/16'], [.625, 1.188, .324, .375, '3/8']];
/* ── 인치 버튼머리 렌치볼트 [d, A max, H max, J, J 표기] — 2026-10 감사: Global Supply·Fuller·Packer 공개 표 일치(T2).
   7/16 행(1곳)과 '최대 표준 길이' 열(Fuller 1곳)은 뺐다. 공급 길이 범위는 e2_cat.js ibhc의 영업 규칙 ── */
const BHCS_IN = [[.164, .312, .087, .094, '3/32'], [.19, .361, .101, .125, '1/8'], [.25, .437, .132, .156, '5/32'], [.3125, .547, .166, .188, '3/16'],
  [.375, .656, .199, .219, '7/32'], [.5, .875, .265, .312, '5/16'], [.625, 1, .331, .375, '3/8']];
/* ── 인치 육각 캡스크루 (ASME B18.2.1) [d, 2면폭 F 표기, F max, 대각 G max, 머리높이 H 표기, H max, LT(L≤6), LT(L>6)]
   2026-10 감사: 허용 출처 표가 없어 (공개 제조사 표 미확보, 2면폭 표·나사부 길이 식은 무단 사본에서만 확인) 값을 모두 뺐다 (규격서 확인 중) ── */
const HCS_IN = [];
/* ── 인치 헤비 육각볼트 (ASME B18.2.1) [d, F 표기, F max, G max, 머리 H 표기, H max, LT(L≤6), LT(L>6)]
   2026-10 감사: 허용 출처 표가 없어 값을 모두 뺐다. RCSC 표 C-2.1은 구조용(B18.2.6) 볼트·헤비너트만 다룬다 (규격서 확인 중) ── */
const HHB_IN = [];
/* ── 인치 육각너트 (ASME B18.2.2) [d, F 표기, F max, G max, H max, 잼너트 H1 max]
   2026-10 감사: 공개 표는 2곳(Birmingham Fastener, Atlanta Rod = APTP 같은 표)뿐이고 잼너트 H1은 없어 값을 모두 뺐다 (카탈로그 ihn 표와 같은 판단) ── */
const HN_IN = [];
/* ── 인치 헤비 육각너트 [d, 2면폭 F 표기, F(기본 = 최대), 높이 H 표기, H(기본)] — RCSC 2025 표 C-2.1 (헤비 육각너트 W·H2, 1/2–1-1/2")와 대조 (T1)
   2026-10 감사: 대각 G max·높이 H max·헤비 잼 H1 열, 1/4–7/16·9/16·1-5/8" 이상 행, 2-1/2" 초과 공식(F = 1.5D + 1/8 …)은 허용 출처가 없어 뺐다.
   H 열은 예전 'H max'가 아니라 RCSC의 호칭 높이(H 표기의 소수)다 ── */
const HHN_IN = [
  [.5, '7/8', .875, '31/64', .484], [.625, '1-1/16', 1.0625, '39/64', .609], [.75, '1-1/4', 1.25, '47/64', .734], [.875, '1-7/16', 1.4375, '55/64', .859],
  [1, '1-5/8', 1.625, '63/64', .984], [1.125, '1-13/16', 1.8125, '1-7/64', 1.109], [1.25, '2', 2, '1-7/32', 1.219], [1.375, '2-3/16', 2.1875, '1-11/32', 1.344],
  [1.5, '2-3/8', 2.375, '1-15/32', 1.469],
];
// 표 밖 크기는 null (공식으로 값을 만들지 않는다)
const hhnIn = d => tbl(HHN_IN, d) || null;
/* ── ASTM F436 경화 평와셔 [d, OD, ID, T min, T max] — 2026-10 감사: 허용 공개 표가 2곳(J.H. Botts·Wrought Washer)뿐이라 값을 모두 뺐다
   (카탈로그 ifw 표와 같은 판단). 크기 범위 1/4–4"는 F436-24 범위 조항(store.astm.org)으로 확인되며, 엔진 품목군 호칭은 e2_cat.js에 따로 둔다 ── */
const F436_IN = [];
// ASME B18.21.1 일반(regular) 스프링 와셔 [d, ID min, OD max, 두께 t, 폭 b] — 2026-10 감사: 허용 출처 표가 없어 값을 모두 뺐다 (metric #813, 카탈로그 ilw와 같은 판단)
const LW_IN = [];

/* ── 미터 멈춤나사 ISO 4026–4029 (DIN 913–916) ──
   [호칭, 키 s, 평끝 dp max, 원뿔 dt max, 봉끝 dp max, 봉 길이 z (짧은·긴 중앙값), 컵 dz max]
   ISO 4026–4029:2003 미리보기(iteh) Table 1과 대조 (2026-10 감사). 원뿔 dt M3·M4·M5는 0.75·1·1.25로 고침 */
const SS_MM = {
  M3: [1.5, 2, .75, 2, .88, 1.63, 1.4], M4: [2, 2.5, 1, 2.5, 1.13, 2.13, 2], M5: [2.5, 3.5, 1.25, 3.5, 1.38, 2.63, 2.5], M6: [3, 4, 1.5, 4, 1.63, 3.13, 3],
  M8: [4, 5.5, 2, 5.5, 2.13, 4.15, 5], M10: [5, 7, 2.5, 7, 2.63, 5.15, 6], M12: [6, 8.5, 3, 8.5, 3.13, 6.15, 8], M16: [8, 12, 4, 12, 4.15, 8.18, 10],
  M20: [10, 15, 5, 15, 5.15, 10.18, 14], M24: [12, 18, 6, 18, 6.15, 12.22, 16],
};
// 카탈로그 밖 호칭의 미터 치수 (견적·도면용). pitch = ISO 262:2023, hexS·hexK = ISO 4017:2022 Table 3, scs = ISO 4762:1997 Table 1 (미리보기 대조, 2026-10 감사)
const MM_EXT = {
  pitch: { M1: .25, 'M1.2': .25, 'M1.4': .3, 'M1.6': .35, M2: .4, 'M2.5': .45, M27: 3, M30: 3.5, M33: 3.5, M36: 4, M42: 4.5, M48: 5 },
  hexS: { M27: 41, M30: 46, M36: 55 }, hexK: { M27: 17, M30: 18.7, M36: 22.5 },
  scsDk: { M30: 45, M36: 54 }, scsK: { M30: 30, M36: 36 }, scsS: { M30: 22, M36: 27 },
};
const FINE_MM = { M8: [1], M10: [1.25, 1], M12: [1.5, 1.25], M14: [1.5], M16: [1.5], M18: [1.5, 2], M20: [1.5, 2], M22: [1.5, 2], M24: [2], M27: [2], M30: [2], M36: [3] };
const mmPitch = s => DIM.pitch[s] ?? MM_EXT.pitch[s];
const mmGet = (k, s) => (DIM[k] && DIM[k][s]) ?? (MM_EXT[k] && MM_EXT[k][s]);
// ISO 4014 표준 길이 하한 (반나사 볼트가 존재하는 최소 L): ISO 4014:2022 Figure 1 주 d (5d M5–M8, 4.5d M10, 4d M12–M22, 3.75d M24–M60)를 가까운 표준 길이로 맞춘 값 (미리보기 대조)
const ISO4014_MIN = { M5: 25, M6: 30, M8: 40, M10: 45, M12: 50, M14: 55, M16: 65, M20: 80, M22: 90, M24: 90, M30: 110, M36: 140 };
