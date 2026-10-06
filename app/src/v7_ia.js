/* ── v7_ia.js: 홈·내비 단순화 (ia/spec.md, 대표 승인 2026-10-01 · DECISIONS 9) ──
   새 경로: home(교체) · products · buy · list · ref · notes · about · t-<칸> · k-<모음> · c-<품목>. 옛 경로는 별칭(iaNorm).
   엔진·견적서·C&D·API 610·해독기·플랜지 계산은 그대로 쓴다. 이 파일은 뷰와 경로뿐이다.
   이름 접두사: ia…(경로·페이지), hm…(홈), sb…(큰 입력칸). 가격은 PRICE_ON(공급처 단가 확인 품목)만, 기본 0개. */

/* ───────── 1. 경로 · 별칭 · 내비 ───────── */
Object.assign(SHEETS, { products: ['P', '제품'], buy: ['P', '규격품 바로 주문'], list: ['L', '목록 견적'], ref: ['R', '도면·규격'], notes: ['R', '규격 노트'], about: ['A', '회사 소개'], t: ['P', '제품'], k: ['P', '모아 보기'], c: ['P', '품목'] });
SHEETS.bom[1] = '목록 줄마다 보기 (엔지니어 화면)';
SHEETS.quote[1] = '견적 요청서·견적서';
SHEETS.custom[1] = '도면·사양서로 요청';
SHEETS.tools[1] = '계산·대조표';
SHEETS.help[1] = '회사 소개';
const IA_ALIAS = { metric: 'products', inch: 'products', help: 'about', cad: 'ref', t: 'products', k: 'products', c: 'products' };
// 옛 홈 구역(jumpTo('z-…')) → 새 경로 (명세 10장 표)
const IA_ZONE = { 'z-a': 'home', 'z-b': 'products', 'z-c': 'k-plant', 'z-d': 'ref', 'z-e': 'notes', 'z-f': 'tools', 'z-g': 'about', 'z-h': 'about' };
const IA_SYS = ['all', 'metric', 'inch'];
state.iaSys = (() => { const v = store.get('iaSys', 'all'); return IA_SYS.includes(v) ? v : 'all'; })();
state.iaBuy = false;
function iaNorm(r) {
  if (r === 'metric' || r === 'inch') { state.iaSys = r; store.set('iaSys', r); }   // 옛 2장·3장 주소: 제품 + 체계 필터
  if (Object.hasOwn(IA_ALIAS, r)) return IA_ALIAS[r];
  if (r.startsWith('lib-')) return typeof LIB_BY !== 'undefined' && Object.hasOwn(LIB_BY, r.slice(4)) ? r : 'lib';   // 사전 항목 (v8_lib.js)
  if (r === 'lib' && !(typeof LIB !== 'undefined' && LIB.length)) return 'home';   // 공개한 항목이 없으면 사전을 열지 않는다
  const m = r.match(/^([tkc])-(.+)$/);
  if (!m) return r;
  const [, k, id] = m;
  if (k === 't') return CAT_TILES.some(t => t.id === id) ? r : 'products';
  if (k === 'k') return Object.hasOwn(CAT_COLL, id) ? r : 'products';
  const f = Object.hasOwn(CAT_F, id) ? CAT_F[id] : null;
  return !f ? 'products' : f.route || r;   // 기존 장이 있는 품목은 그 장(#m-·#i-)으로
}
function iaNavKey(r) {
  if (/^(products|buy|metric|inch)$/.test(r) || /^[tkcmi]-/.test(r)) return 'products';
  if (/^(list|bom|quote|custom)$/.test(r)) return 'list';
  if (/^(ref|tools|notes|cad)$/.test(r)) return 'ref';
  if (/^lib(-|$)/.test(r)) return 'lib';
  if (/^(about|help|privacy|terms)$/.test(r)) return 'about';
  return '';
}
const iaTile = id => CAT_TILES.find(t => t.id === id) || null;
const iaFamTile = id => { const f = Object.hasOwn(CAT_F, id) ? CAT_F[id] : null; return f ? iaTile(f.t) : null; };
function iaTitleOf(r) {
  const m = r.match(/^([tkc])-(.+)$/); if (!m) return null;
  if (m[1] === 't') return (iaTile(m[2]) || {}).ko || null;
  if (m[1] === 'k') return (CAT_COLL[m[2]] || {}).ko || null;
  return (CAT_F[m[2]] || {}).ko || null;
}
function iaAfterNav(r) {
  const home = r === 'home';
  document.body.classList.toggle('ia-at-home', home);
  document.body.dataset.route = r.split('-')[0];
  const t = iaTitleOf(r); if (t) document.title = `볼트노트 · ${t}`;
  iaMenu(false);
  const ml = document.querySelector('.ia-mini-list'); if (ml) ml.hidden = r === 'cart' || r === 'quote';
}
// 장 머리 빵 부스러기: 옛 장 이름 → 새 경로 (제품 › 칸 › 품목)
function iaTrail(trail) {
  const r = state.route || '', fid = /^[mi]-/.test(r) ? r.slice(2) : null, tile = fid ? iaFamTile(fid) : null;
  const MAP = {
    '미터 규격품': [['제품', 'products']], '인치·플랜트 볼트': [['제품', 'products']],
    '주문제작·해외규격 견적': [['목록 견적', 'list'], ['도면·사양서로 요청']],
    'BOM 견적': [['목록 견적', 'list'], ['목록 줄마다 보기 (엔지니어 화면)', 'bom']],
    '규격 도구': [['도면·규격', 'ref'], ['계산·대조표']],
    '고객지원': [['회사 소개', 'about']],
  };
  const out = [];
  trail.forEach(([t, go], i) => {
    const mp = MAP[t];
    if (!mp) { out.push([t, go]); return; }
    if (t === 'BOM 견적' && !go) { out.push(mp[0], [mp[1][0]]); return; }      // 4A장 자체: 마지막 칸은 링크 없음
    if (t === 'BOM 견적') { out.push(...mp); return; }
    out.push(...mp.map(x => [...x]));
    if (/규격품|인치/.test(t) && tile && i < trail.length - 1) out.push([tile.ko, 't-' + tile.id]);
  });
  // 끝 칸이 링크면 링크를 뗀다 (현재 위치)
  if (out.length && out[out.length - 1][1] && out.length === trail.length && !trail[trail.length - 1][1]) out[out.length - 1] = [out[out.length - 1][0]];
  return out;
}

/* ───────── 2. 공용 조각 ───────── */
const IA_PH = t => `<span class="ph">${esc(t)}</span>`;
const iaOwner = () => SHOP.ownerName ? esc(SHOP.ownerName) : IA_PH('대표 이름');
const iaYears = () => SHOP.ownerYears ? esc(SHOP.ownerYears) : IA_PH('n');
const iaBizNo = () => SHOP.bizNo ? `<span class="mono">${esc(SHOP.bizNo)}</span>` : `<span class="ph mono">000-00-00000</span>`;
const iaMailOrder = () => ORDER_LIVE ? `통신판매업 ${esc(SHOP.mailOrderNo)}` : '통신판매업 신고 전 (검증 운영 중)';
function iaBizLink() {
  const d = String(SHOP.bizNo || '').replace(/\D/g, '');
  // 공정위 사업자정보 공개 페이지는 통신판매업 신고 뒤에 조회되므로 ORDER_LIVE일 때만 연결한다
  return d.length === 10 && ORDER_LIVE ? `<a href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${d}" target="_blank" rel="noopener">사업자 정보 확인</a>` : `사업자정보 확인 <span class="ph">통신판매업 신고 후 연결</span>`;
}
// 서류 칸 (cadTrustGroupsBy: 공급처가 확인한 품목군만 이름을 적는다. 기본은 모두 확인 중)
function iaDocsLine(short) {
  let b = null; try { b = typeof cadTrustGroupsBy === 'function' ? cadTrustGroupsBy() : null; } catch { b = null; }
  const names = b ? [...b.confirmed, ...b.confirmedCopy] : [], req = b ? b['on-request'] : [];
  if (!names.length && !req.length) return short ? '제조사 MTR(3.1) 제공 여부는<br>줄마다 확인 후 회신' : '제조사 MTR(3.1) 제공 여부는 줄마다 공급처에 확인한 뒤 견적 때 회신합니다.';
  const seg = [];
  if (names.length) seg.push(`${esc(names.join('·'))}: 제조사 MTR 전달`);
  if (req.length) seg.push(`${esc(req.join('·'))}: 주문 시 요청`);
  return seg.join('<br>') + '<br>그 밖은 줄마다 확인 후 회신';
}
// 선화 썸네일 (손으로 그린 SVG, currentColor). 품목 템플릿이 붙기 전까지 칸·품목 카드에 쓴다
const IA_TH = {
  bolt: '<path d="M7 13h13v22H7zM7 19.5h13M7 28.5h13M20 19h40l3 2.5v5L60 29H20z"/><path d="M36 21h24M36 27h24" stroke-width=".7"/>',
  shcs: '<path d="M8 14h13v20H8zM21 19.5h39l3 2.5v4l-3 2.5H21z"/><path d="M11 20h5v8h-5" stroke-dasharray="2 1.5" stroke-width=".8"/><path d="M38 21.5h22M38 26.5h22" stroke-width=".7"/>',
  set: '<path d="M14 16h44l4 4v8l-4 4H14z"/><path d="M14 19h8v10h-8" stroke-dasharray="2 1.5" stroke-width=".8"/><path d="M14 18h44M14 30h44" stroke-width=".6"/>',
  nut: '<path d="M36 6l15.6 9v18L36 42l-15.6-9V15z"/><circle cx="36" cy="24" r="8"/><path d="M36 14.5a9.5 9.5 0 1 1-9.4 8" stroke-width=".7"/>',
  washer: '<circle cx="36" cy="24" r="17"/><circle cx="36" cy="24" r="8"/>',
  stud: '<path d="M5 20h62v8H5z"/><path d="M14 11h8v26h-8zM50 11h8v26h-8z"/><path d="M5 22h62M5 26h62" stroke-width=".6"/>',
  rod: '<path d="M4 20h64v8H4z"/><path d="M4 21.7h64M4 26.3h64" stroke-width=".6"/>',
  pin: '<path d="M12 18h46l3 3v6l-3 3H12l-3-3v-6z"/><path d="M12 18v12M58 18v12" stroke-width=".6"/>',
  ring: '<path d="M22 37a17 17 0 1 1 28 0"/><path d="M27 33a11 11 0 1 1 18 0"/><circle cx="24" cy="36" r="2"/><circle cx="48" cy="36" r="2"/>',
  key: '<path d="M10 18h52v12H10z"/><path d="M10 20h52" stroke-width=".6"/><path d="M14 18v12M58 18v12" stroke-dasharray="2 1.5" stroke-width=".7"/>',
  rivet: '<path d="M12 11h5v26h-5zM17 18h26v12H17zM43 23h22v2H43z"/><circle cx="66" cy="24" r="2.2"/>',
  insert: '<path d="M14 16h44v16H14z"/><path d="M18 16l4 16M24 16l4 16M30 16l4 16M36 16l4 16M42 16l4 16M48 16l4 16" stroke-width=".8"/>',
  eye: '<circle cx="18" cy="24" r="11"/><circle cx="18" cy="24" r="6"/><path d="M29 20h34v8H29z"/><path d="M42 21.5h21M42 26.5h21" stroke-width=".6"/>',
  plug: '<path d="M10 15h10v18H10zM20 17h30l6 7-6 7H20z"/><path d="M11 21h6v6h-6" stroke-dasharray="2 1.5" stroke-width=".8"/>',
};
const IA_TH_TILE = { bolt: 'bolt', nut: 'nut', washer: 'washer', stud: 'stud', pin: 'pin', rivet: 'rivet' };
const IA_TH_ENG = { shcs: 'shcs', fhcs: 'shcs', bhcs: 'shcs', setscrew: 'set', nut: 'nut', heavynut: 'nut', locknut: 'nut', washer: 'washer', lockwasher: 'washer', discspring: 'washer',
  stud: 'stud', rod: 'rod', anchor: 'rod', expanchor: 'rod', pin: 'pin', ring: 'ring', key: 'key', rivet: 'rivet', insert: 'insert', clinch: 'insert', plug: 'plug', standoff: 'insert' };
const iaThKey = f => (/eyebolt|eyenut|hoistring|swingbolt/.test(f.id) ? 'eye' : IA_TH_ENG[f.eng] || 'bolt');
const iaTh = (k, w = 72, h = 48) => `<svg viewBox="0 0 72 48" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${IA_TH[k] || IA_TH.bolt}</svg>`;
const iaTileN = t => t.subs.reduce((a, s) => a + s.f.length, 0);
const iaSysOk = (f, sys) => sys === 'all' || f.sys === sys || f.sys === 'both' || (sys === 'metric' ? /metric|both/.test(f.sys) : /inch|both/.test(f.sys));
const iaSysTag = f => `<span class="ia-sys">${f.sys === 'inch' ? '인치' : f.sys === 'both' ? '미터·인치' : '미터'}</span>`;
const iaStdShort = f => esc((f.enStd || (f.std[0] || [])[1] || '').split(' · ').slice(0, 2).join(' · '));
const iaCrumbs = items => `<nav class="crumbs" aria-label="현재 위치"><a href="#home" data-go="home">홈</a>${items.map(([t, go]) => `<span aria-hidden="true">›</span>${go ? `<a href="#${go}" data-go="${go}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}`).join('')}</nav>`;
const iaHead = (crumbs, title, en, p = '', extra = '') => `<div class="shd ia-phd">${iaCrumbs(crumbs)}<div class="shd-t"><div><h1 id="h-z-a" tabindex="-1">${title}${en ? `<span class="h-en" lang="en">${esc(en)}</span>` : ''}</h1>${p ? `<p>${p}</p>` : ''}</div></div>${extra}</div>`;
const iaPage = inner => sheet(zone('A', 'z-a', inner, 'ia-z'));

/* ───────── 3. 홈 (명세 3·4·6장) ───────── */
const IA_MARK = {
  '2H': 'ASTM A194 2H 헤비 육각너트 각인입니다. B7 스터드와 짝을 이룹니다.', '2HM': 'A194 2HM: 경도 상한을 둔 사워 서비스용 너트(NACE MR0175)입니다.',
  'B7': 'ASTM A193 Gr B7(Cr-Mo 강) 스터드 각인입니다. 고온·고압 플랜지에 씁니다.', 'B7M': 'A193 B7M: 경도 상한을 둔 사워 서비스용 B7입니다.',
  'L7': 'ASTM A320 L7: 저온 충격시험을 거친 스터드 재질입니다.', '8.8': 'ISO 898-1 강도 구분 8.8입니다.',
  '10.9': 'ISO 898-1 강도 구분 10.9입니다.', '12.9': 'ISO 898-1 강도 구분 12.9입니다. 렌치볼트에 흔합니다.',
  'A2-70': 'ISO 3506 오스테나이트 스테인리스(304 계열), 인장강도 700 MPa 등급입니다.', 'A4-80': 'ISO 3506 316 계열 스테인리스, 인장강도 800 MPa 등급입니다.',
  'B8M': 'ASTM A193 B8M: 316 스테인리스 스터드입니다.', '8M': 'ASTM A194 8M: 316 스테인리스 너트입니다.',
};
const IA_EX = [['M10x30 8.8 아연', 'M10x30 8.8'], ['3/4-10 x 5-1/2 B7 2H', '3/4-10 B7 2H'], ['DIN 934 M12', ''], ['각인 2H', '각인 2H']];
// 견본 목록 = 펌프 단면도 부품표처럼 (2026-10: 품번이 아니라 고객이 가진 표기로)
const IA_LIST_EX = 'STUD, CASING 7/8-9UNC x 6 B7M/2HM NACE\t16\tEA\nSTUD BOLT 1-1/8"-7UNC x 6-1/2" A320 L7 PTFE\t16\tSET\nSTUD BOLT 3/4"-10UNC x 5-1/2" A193-B7/A194-2H\t24\tSET\nHEX BOLT M16x60 ISO 4014 10.9 HDG\t8\tEA\nDOWEL PIN 8 m6 x 30 ISO 8734\t4\tEA\nSPW GASKET 4" CL300\t6\tEA';
const IA_HOME_PH = 'STUD, CASING 7/8-9UNC x 6 B7M/2HM NACE    16\nHEX BOLT M16x60 ISO 4014 10.9 HDG    8\n엑셀·BOM의 줄을 복사해 그대로 붙여 넣으세요';
function hmH1() {
  return SHOP.hero === 'general'
    ? { h1: '체결부품 목록을 보내 주시면 엔지니어가 줄마다 읽고 견적합니다', sub: '볼트·너트·와셔·스터드부터 핀·멈춤링·리벳까지. 못 구하는 줄은 ‘공급 불가’로 적어 드립니다.' }
    : { h1: '<span class="ia-d">BOM·단면도의 표기 그대로 보내 주세요. <em class="pm-em">규격과 품질문서까지 맞춰 견적합니다</em></span><span class="ia-m">BOM 표기 그대로 보내 주세요. <em class="pm-em">규격·서류까지 맞춰 견적합니다</em></span>',
      sub: '<span class="ia-d">부품표의 볼트·스터드·너트 줄을 기계엔지니어가 ASTM·ASME·KS·ISO 규격과 등급에 맞추고, 줄마다 필요한 서류(제조사 3.1, 경도·충격시험 기록, 코팅 성적서)를 정해 견적합니다. </span><span class="ia-m">줄마다 ASTM·ASME 규격과 등급, 필요한 서류를 맞춰 견적합니다. </span>이 사이트의 품번은 몰라도 됩니다.' };
}
function hmDoors() {
  const pr = PRICE_ANY(), paste = SHOP.listPrimary === 'paste';
  const d2 = !pr ? '<span class="ia-d">품목 단가를 공급처와 확인하고 있습니다. </span>지금은 몇 줄이라도 견적으로 받습니다.' : `가격이 표시된 품목은 ${ORDER_DOC()}를 바로 만들어 보냅니다. <span class="ia-d2">입금은 확인 메일을 받은 뒤.</span>`;
  const b1 = `<button class="btn${paste ? '' : ' pri'}" type="button" data-ia-file aria-expanded="false" aria-controls="ia-filep">파일 그대로 보내기</button>`;
  const b2 = `<button class="btn${paste ? ' pri' : ''}" type="button" data-ia-paste><span class="ia-d">목록 붙여넣기</span><span class="ia-m">여러 줄 입력</span></button>`;
  const door = (n, go, t, p, act) => `<div class="ia-door" role="listitem"><a class="ia-door-h" href="#${go}" data-go="${go}"><span class="ia-bal">${n}</span>${t}<span class="ia-ar" aria-hidden="true">→</span></a><p>${p}</p>${act ? `<div class="actions">${act}</div>` : ''}</div>`;
  const doors = [door(1, 'list', '목록 보내고 견적 받기', `엑셀·PDF·사진 그대로 보내 주세요. <span class="ia-d2">20줄 이하는 ${SLA().days}영업일 안에 견적합니다.</span>`, paste ? b2 + b1 : b1 + b2)];
  if (SHOP.quickOrder) doors.push(door(2, 'buy', '규격품 바로 주문', d2, '<a class="btn ia-dd" href="#buy" data-go="buy">품목 고르기 →</a>'));
  doors.push(door(SHOP.quickOrder ? 3 : 2, 'ref', '도면·규격 보기', `치수 도면, 각인·표기 읽기, 플랜지 볼트 계산. <span class="ia-d2">STEP·DXF도 가입 없이 받습니다.</span>`, '<a class="btn ia-dd" href="#ref" data-go="ref">도면·규격 →</a>'));
  return `<div class="ia-doors${SHOP.quickOrder ? '' : ' two'}" role="list" id="ia-doors">${doors.join('')}</div>`;
}
function hmTrust() {
  const sla = SLA().box.split(' · ');
  return `<section class="ia-trust-w" aria-labelledby="ia-trust-h"><h2 class="sr" id="ia-trust-h">볼트노트 운영 정보</h2><div class="ia-trust" id="ia-trust">
    <div class="ia-tc m1"><span class="lab">검토</span>${iaOwner()} · 기계엔지니어<br>회전기기 분야 ${iaYears()}년<br><span class="ia-d">견적 줄은 모두 직접 읽습니다</span><span class="ia-m">줄마다 직접 확인</span></div>
    <div class="ia-tc m2"><span class="lab">회신</span>${esc(sla[0]).replace('→', '→<br>')}<br>${esc(sla[1] || '')}</div>
    <div class="ia-tc"><span class="lab">공급</span>재고 없이 주문마다<br>국내 도매처에서 조달<br><span class="ia-d">플랜트 볼트는 받아 대조 후 출고</span></div>
    <div class="ia-tc docs"><span class="lab">서류</span>${iaDocsLine(true)}</div>
    <div class="ia-tc biz"><span class="lab">사업자</span>사업자등록번호 ${iaBizNo()}<br>${iaMailOrder()}</div>
    <div class="ia-tc no"><span class="lab">하지 않습니다</span>당일 출고 약속 · 승인 없는 대체품<br><span class="ia-d">3.1 직접 발행 · 받은 도면 공개</span></div>
  </div><p class="ia-bizline">사업자 ${iaBizNo()} · ${ORDER_LIVE ? '통신판매업 신고' : '신고 전'} · <a href="#about" data-go="about">회사 소개 →</a></p><p class="ia-trust-f"><a href="#about" data-go="about">회사 소개 →</a></p></section>`;
}
// 홈과 제품 목록에서 같은 제품군 이미지·실제 카탈로그 수를 사용한다.
const hmTiles = () => `<ul class="bn-products" role="list">${CAT_TILES.map((t, i) => `<li><a class="bn-product" href="#t-${t.id}" data-go="t-${t.id}"><span class="bn-product-visual bn-product-${t.id}" aria-hidden="true"></span><span class="bn-product-info"><span class="bn-product-top"><span class="bn-index">0${i + 1}</span><span class="bn-product-count">${iaTileN(t)}종</span></span><h3>${esc(t.ko)}</h3><span class="bn-product-en" lang="en">${esc(t.en)}</span><span class="bn-product-desc">${t.subs.slice(0, 3).map(s => esc(s.ko.replace(/ \(.*?\)/g, ''))).join(' · ')}</span><span class="bn-product-link">제품 살펴보기 <span aria-hidden="true">↗</span></span></span></a></li>`).join('')}</ul>`;
const hmColls = home => `<div class="ia-colls"><span class="lab">모아 보기</span><a class="hi" href="#k-plant" data-go="k-plant">${esc(CAT_COLL.plant.ko)} →</a><a class="ia-d" href="#k-pump" data-go="k-pump">${esc(CAT_COLL.pump.ko)} →</a><a class="ia-d" href="#k-flange" data-go="k-flange">${esc(CAT_COLL.flange.ko)} →</a>${home ? '<a class="ia-m" href="#products" data-go="products">모아 보기 전체 →</a>' : ''}</div>`;
function sbBox(where) {
  const lg = where === 'list';
  return `<div class="ia-q${lg ? ' lg' : ''}" id="sb-w">
    <label class="lab" for="sb">${lg ? '목록 붙여넣기 · 줄마다 미리 보기' : 'BOM · 단면도 부품표 붙여넣기 (사양 한 줄도 됩니다)'}</label>
    <div class="ia-qrow" id="sb-row"><textarea id="sb" rows="${lg ? 6 : 4}" placeholder="${lg ? '엑셀에서 표를 복사해 붙여 넣거나 한 줄에 한 품목씩 적어 주세요' : esc(IA_HOME_PH)}" autocomplete="off" spellcheck="false" aria-describedby="sb-help" enterkeyhint="search"></textarea><button class="ia-qgo" id="sb-go" type="button">${lg ? '줄마다 읽기' : '찾기'}</button></div>
    <div id="sb-res" class="ia-res-w"></div>
    ${lg ? `<div class="ia-qhelp" id="sb-help"><label class="btn sm" for="sb-file">파일 올리기</label><input type="file" id="sb-file" class="sr" accept="${SB_ACCEPT}"><button class="btn sm txt" type="button" data-sb-ex="__list">견본 목록으로 보기</button><span class="small muted" id="bom-file-msg" aria-live="polite"></span></div><p class="small muted ia-fh">${SB_FILE_HINT}</p>`
      : `<div class="ia-qhelp" id="sb-help"><button type="button" class="chipbtn pm-ex" data-sb-ex="__list">견본 BOM으로 보기</button><label class="btn sm" for="sb-file">파일 올리기</label><input type="file" id="sb-file" class="sr" accept="${SB_ACCEPT}"></div><p class="small ia-fh">${SB_FILE_HINT}</p><p class="small ia-cont" id="sb-cont" hidden></p><p class="small muted" id="bom-file-msg" aria-live="polite" hidden></p>`}
  </div>`;
}
/* ───────── 3b. 홈 (2026-10 고급형 개편) ─────────
   어두운 첫 화면 + 움직이는 그림(GIF, media/). 움직임 줄이기 설정이면 첫 장면 PNG를 보인다.
   점검 스크립트와 기존 동작이 쓰는 id·클래스(#z-a, #sb, #sb-row, .ia-door, #ia-filep, #ia-trust, .ia-tc, .ia-tile, .ia-status …)는 그대로 둔다.
   숫자는 데이터에서 계산한 것만 쓴다 (품목 수, 경력 연수, 견적 영업일). 실적·고객·재고 같은 말은 쓰지 않는다. */
const PM_MEDIA = 'media/';
const pmImg = (n, alt, w, h, eager = false) => `<picture><source srcset="${PM_MEDIA}${n}.png" media="(prefers-reduced-motion: reduce)"><img src="${PM_MEDIA}${n}.gif" alt="${esc(alt)}" width="${w}" height="${h}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"></picture>`;
// 첫 화면 3D: 소리 없는 반복 동영상. 움직임 줄이기 설정이면 멈춘 첫 장면(poster)만 보인다 (V.after.home에서 처리)
const pmVideo = (n, label, w, h) => `<video class="pm-video" width="${w}" height="${h}" muted loop playsinline preload="none" poster="${PM_MEDIA}${n}-poster.jpg" aria-label="${esc(label)}"><source src="${PM_MEDIA}${n}.webm" type="video/webm"><source src="${PM_MEDIA}${n}.mp4" type="video/mp4"></video>`;
const PM_TILE_IMG = { bolt: 'p-bolt', nut: 'p-nut', washer: 'p-washer', stud: 'p-stud', pin: 'p-pin', rivet: 'p-rivet' };
const PM_COLL = {
  plant: ['A193 B7 · B7M · B8M · B16 · A320 L7', '스터드볼트와 헤비 육각너트. 고온·저온·사워 조건의 플랜지 볼팅'],
  pump: ['평행 키 · 다웰핀 · 멈춤링 · 플러그', '펌프·회전기기 정비 때 볼트와 함께 나오는 줄'],
  flange: ['JIS B 2220 10K·20K · A193M B7', 'KS·JIS 관 플랜지용 볼트·너트 세트'],
};
const pmCatN = () => CAT_TILES.reduce((a, t) => a + iaTileN(t), 0);
const pmHead = (eye, id, h, p = '', more = '') => `<div class="pm-head"><div><p class="pm-eye" lang="en">${eye}</p><h2 id="${id}">${h}</h2>${p ? `<p class="pm-lead">${p}</p>` : ''}</div>${more}</div>`;
const pmFacts = () => `<ul class="pm-facts" aria-label="볼트노트 한눈에">${[
  [`${pmCatN()}<small>종</small>`, '체결부품 품목별 규격표'],
  ['CAD', 'STEP·DXF 치수 도면, 가입 없이 받기'],
  [`${iaYears()}<small>년</small>`, '회전기기 분야 기계엔지니어'],
  [`${SLA().days}<small>영업일</small>`, '20줄 이하 목록 견적 회신'],
].map(([b, t]) => `<li><b>${b}</b><span>${t}</span></li>`).join('')}</ul>`;
const pmTiles = () => `<div class="ia-tiles pm-tiles" role="list">${CAT_TILES.map(t => `<a class="ia-tile pm-tile" role="listitem" href="#t-${t.id}" data-go="t-${t.id}"><span class="pm-media">${pmImg(PM_TILE_IMG[t.id] || 'p-bolt', '', 480, 360)}</span><span class="pm-tile-b"><b>${esc(t.ko)}</b><span class="en" lang="en">${esc(t.en)}</span><span class="cnt">${iaTileN(t)}종</span><span class="pm-arr" aria-hidden="true">→</span></span></a>`).join('')}</div>`;
const pmColls = () => `<div class="pm-colls" role="list">${Object.entries(PM_COLL).map(([k, [spec, d]], i) => `<a class="pm-coll${k === 'plant' ? ' hi' : ''}" role="listitem" href="#k-${k}" data-go="k-${k}"><span class="pm-no">0${i + 1}</span><b>${esc(CAT_COLL[k].ko)}</b><span class="pm-spec">${esc(spec)}</span><span class="pm-d">${esc(d)}</span><span class="pm-more">${CAT_COLL[k].f.length}종 보기 <span aria-hidden="true">→</span></span></a>`).join('')}</div>`;
const PM_MATCH = [
  ['규격·등급', 'A193 B7·B7M·B16, A320 L7, A453 660처럼 재질 규격과 등급을 정하고, 짝이 되는 A194 너트 등급까지 맞춥니다. KS·ISO·DIN·JIS 미터 규격도 대응을 봅니다.'],
  ['치수·나사', '호칭, 산 수, 나사 등급(UNC-2A), 스터드 길이 기준(ASME B18.31.2), 인치↔mm, 플랜지 압력 등급별 스터드 길이를 확인합니다.'],
  ['품질문서', '줄마다 필요한 서류를 정합니다. 제조사 3.1 성적서, 사워 서비스 경도 기록(NACE MR0175), 저온 충격시험 값, 코팅 성적서, CoC. 제조사 서류의 제공 여부는 공급처 확인 뒤 견적서에 적습니다.'],
];
const PM_PLANT = [
  'ASME B16.5 Class 150·300·600, RF·RTJ 면 형식별 스터드 길이 계산',
  '고온 B7·B16, 사워 B7M/2HM, 저온 L7/7L, 스테인리스 B8M/8M 조합',
  '조인트 수만큼 스터드 + 헤비너트 2개 세트로 견적',
  '코팅(용융아연도금·PTFE)과 서류 조건을 줄마다 표기',
];
// 플랜트 띠의 표: 플랜지 계산기와 같은 B16.5 Class 300 데이터 (RF, 제조사 공개 차트 3곳 대조 참고값)
function pmB165() {
  const pick = ['2', '3', '4', '6', '8', '10', '12'], rows = (typeof B165_300 !== 'undefined' ? B165_300 : []).filter(r => pick.includes(r[0]));
  if (!rows.length) return '';
  return `<figure class="pm-b165"><figcaption><span class="mono">ASME B16.5 · Class 300 · RF</span><span>제조사 공개 차트 3곳 대조 참고값 · 포인트 포함 여부는 주문 때 확인</span></figcaption>
    <div class="tblw"><table><thead><tr><th>호칭 NPS</th><th>스터드 수</th><th>나사</th><th>스터드 길이</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}"</td><td>${r[1]}</td><td class="mono">${r[2]}</td><td class="mono">${r[3]}"</td></tr>`).join('')}</tbody></table></div>
    <a class="pm-link pm-on-dark" href="#tools" data-go="tools" data-tab="flange">Class 150·300·600 전체 계산 <span aria-hidden="true">→</span></a></figure>`;
}
const PM_STEPS = [
  ['보내기', '엑셀·PDF·사진, 도면 일부도 그대로 보내 주세요. 메일, 카카오톡, 이 사이트 붙여넣기 모두 됩니다.'],
  ['줄마다 읽기', '규격, 재질·강도, 코팅, 서류 조건을 기계엔지니어가 한 줄씩 확인합니다.'],
  ['질문과 확인', '빠진 사양은 한 번에 모아 여쭙고, 단가·납기는 공급처 회신을 받은 뒤에 적습니다.'],
  ['받으시는 것', '견적서, C&D 1장, 공급 불가 목록. 못 구하는 줄은 사유와 함께 적어 드립니다.'],
];
function pmMail() {
  if (!rfqOk('rfq')) return '';
  const subj = '[목록견적] ', body = ['볼트노트 견적 담당자님께', '목록 파일을 첨부합니다.', '필요한 날짜·납품지:', '필요한 서류(3.1, CoC):'].join('\r\n');
  return `<a class="pm-btn ghost" href="${esc('mailto:' + String(CONTACT.rfq).trim() + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body))}">견적 메일 보내기</a>`;
}
/* 홈은 제품 탐색 → 목록 견적 → 현장별 볼팅 → 기술자료 순서로 연결한다.
   이미지에는 규격값을 넣지 않고, 품목 수와 사전 수는 공개 데이터에서 계산한다. */
V.home = () => `<div class="bn-home bn-studio" id="z-a">
  ${bnBrandMarkup()}
  <div class="bn-facts bn-wrap" aria-label="카탈로그 안내">
    <div><b>${CAT_TILES.length}<small> PRODUCT CATEGORIES</small></b><span>품목별로 찾는 제품군</span></div>
    <div><b>${pmCatN()}<small> FASTENER TYPES</small></b><span>미터·인치 체결부품</span></div>
    <div><b>CAD<small> STEP &amp; DXF</small></b><span>제공 품목의 도면과 모델</span></div>
    <a href="#lib" data-go="lib"><b>${LIB.length}<small> ENGINEERING NOTES</small></b><span>판단의 근거를 찾는 사전 <i aria-hidden="true">↗</i></span></a>
  </div>
  ${bnEngineeringMarkup()}
  <section class="bn-section bn-lineup" aria-labelledby="bn-h-products">
    <div class="bn-wrap">
      <div class="bn-section-head"><div><p class="bn-eyebrow" lang="en">01 / THE PRODUCT COLLECTION</p><h2 id="bn-h-products">작지만,<br>역할은 분명합니다.</h2></div><div class="bn-section-aside"><p>볼트 하나부터 플랜트 볼팅 세트까지.<br>형상과 용도에 맞는 제품을 살펴보세요.</p><a class="bn-text-link" href="#products" data-go="products">전체 제품 보기 <span aria-hidden="true">↗</span></a></div></div>
      ${purchaseLineup()}<div class="bn-carousel" aria-label="체결부품 제품 라인업">${hmTiles()}</div>
      <div class="bn-carousel-bar"><p class="bn-catalog-note">제품군 이미지입니다. 실제 치수·재질·표면처리는 품목별로 확인하세요.</p><div class="bn-carousel-controls"><span id="bn-product-position" aria-live="polite" aria-atomic="true">01 / 06</span><button type="button" data-bn-products-step="-1" aria-label="이전 제품군" disabled>←</button><button type="button" data-bn-products-step="1" aria-label="다음 제품군">→</button></div></div>
    </div>
  </section>
  <section class="bn-section bn-applications" aria-labelledby="bn-h-applications">
    <div class="bn-wrap"><div class="bn-section-head"><div><p class="bn-eyebrow" lang="en">02 / CONNECTIONS IN CONTEXT</p><h2 id="bn-h-applications">설비는 달라도,<br>체결에는 기준이 있습니다.</h2></div><p>함께 쓰는 부품을 용도별로 모았습니다.<br>조인트 조건과 도면을 함께 확인하세요.</p></div>
      <div class="bn-application-grid">${Object.entries(PM_COLL).map(([k,[spec,d]],i)=>`<a class="bn-application" href="#k-${k}" data-go="k-${k}"><div class="bn-application-image"><img src="media/boltnote-application-${['flange','shaft','flange'][i]}.webp" alt="${['플랜지의 스터드와 헤비 육각너트','키·멈춤링을 사용하는 회전축','플랜지 조인트의 체결부품 구성'][i]}" width="600" height="450" loading="lazy" decoding="async"><span>0${i+1}</span></div><div class="bn-application-body"><h3>${esc(CAT_COLL[k].ko)}</h3><p>${esc(d)}</p><span class="bn-application-link">제품 모아 보기 <i aria-hidden="true">↗</i></span></div></a>`).join('')}</div>
    </div>
  </section>
  <section class="bn-section bn-specs" aria-labelledby="bn-h-specs"><div class="bn-wrap bn-spec-grid">
    <div><p class="bn-eyebrow" lang="en">03 / BEFORE YOU BUY</p><h2 id="bn-h-specs">비슷한 모양.<br>다른 사양.</h2><p class="bn-spec-lead">외형만으로 정하지 않습니다.<br>구매 전에 확인할 기준을 한 번 더 살펴보세요.</p><a class="bn-text-link" href="#lib?path=purchase" data-go="lib?path=purchase">구매·입고 확인 경로 <span aria-hidden="true">↗</span></a></div>
    <div class="bn-spec-list">${[
      ['호칭과 피치','M16과 5/8", UNC와 8UN. 비슷한 굵기여도 나사는 호환되지 않습니다. 미터·인치, 피치·산 수, 나사 공차를 함께 확인합니다.','thread-fit'],
      ['머리 형상과 길이 기준','머리 모양에 따라 길이를 재는 기준과 공구가 달라집니다. 스터드 포인트 포함 여부, 나사부 길이, 좌면과 체결 깊이를 도면으로 확인합니다.','bolt-nut-washer'],
      ['재질·등급과 너트 조합','재질 규격과 강도 등급은 각각 확인합니다. 플랜트 볼팅은 온도·사용 환경을 보고 스터드와 짝이 되는 너트 등급을 함께 정합니다.','material-grade'],
      ['표면처리와 필요한 서류','코팅 조건과 조립 시 나사 끼워맞춤, 추적·검사 서류를 함께 확인합니다. 제조사 서류 제공 여부는 공급처 확인 뒤 견적서에 적습니다.','inspection-documents']
    ].map(([t,d,id],i)=>`<details class="bn-spec"><summary><span>0${i+1}</span><h3>${t}</h3><i aria-hidden="true">+</i></summary><div><p>${d}</p><a href="#lib?topic=${id}" data-go="lib?topic=${id}">관련 지식 살펴보기 <span aria-hidden="true">↗</span></a></div></details>`).join('')}</div>
  </div></section>
  <section class="bn-section bn-resources" aria-labelledby="bn-h-resources"><div class="bn-wrap">
    <div class="bn-section-head"><div><p class="bn-eyebrow" lang="en">04 / KNOWLEDGE, CONNECTED</p><h2 id="bn-h-resources">규격을 알고,<br>판단의 근거를 찾습니다.</h2></div><a class="bn-text-link" href="#lib" data-go="lib">지식 지도 전체 보기 <span aria-hidden="true">↗</span></a></div>
    <div class="bn-knowledge-head"><p><b>${LIB.length}</b>개의 항목을 <b>${LIB_TOPICS.length}</b>개 주제로.<br>품목부터 찾아도, 목적부터 읽어도 됩니다.</p><form id="pm-lib-form" role="search"><label class="sr" for="pm-lib-q">규격 사전에서 찾기</label><input id="pm-lib-q" type="search" placeholder="예: A193 B7, 나사 공차, 3.1" autocomplete="off" spellcheck="false"><button type="submit" aria-label="규격 사전 검색">↗</button></form></div>
    <div class="bn-topic-grid">${LIB_TOPICS.map((t,i)=>`<a class="bn-topic" href="#lib?topic=${t.id}" data-go="lib?topic=${t.id}"><span class="bn-topic-no">0${i+1}</span><span><b>${esc(t.title)}</b><small>${esc(t.en)} · ${t.entries.length}개 항목</small></span><i aria-hidden="true">↗</i></a>`).join('')}</div>
    <div class="bn-reading-paths"><span>목적별로 읽기</span>${LIB_PATHS.map(p=>`<a href="#lib?path=${p.id}" data-go="lib?path=${p.id}">${esc(p.title)} <i aria-hidden="true">↗</i></a>`).join('')}</div>
    <div class="bn-resource-shortcuts"><a href="#ref" data-go="ref"><span>DRAWINGS &amp; CAD</span><h3>형상과 치수를 먼저.</h3><p>제공 품목의 도면 · STEP · DXF</p><i aria-hidden="true">↗</i></a><a href="#tools" data-go="tools"><span>ENGINEERING TOOLS</span><h3>계산과 대조를 함께.</h3><p>스터드 길이 · 재질 · 각인 표기</p><i aria-hidden="true">↗</i></a></div>
  </div></section>
  <section class="bn-section bn-rfq" aria-labelledby="bn-h-rfq"><div class="bn-wrap bn-rfq-grid">
    <div class="bn-rfq-copy"><p class="bn-eyebrow" lang="en">05 / FROM BOM TO QUOTATION</p><h2 id="bn-h-rfq">목록은 그대로.<br>견적은 한 줄씩.</h2><p>엑셀이나 부품표의 표기를 그대로 붙여 넣으세요.<br>규격·등급·수량을 읽고, 확인할 내용을 보여 드립니다.</p><ol class="bn-rfq-points"><li><span>01</span> 목록과 도면을 보냅니다</li><li><span>02</span> 빠진 사양을 함께 확인합니다</li><li><span>03</span> 공급처 확인 뒤 견적서로 답합니다</li></ol><div class="bn-rfq-foot"><a href="#list" data-go="list">목록 견적 화면 열기 <span aria-hidden="true">↗</span></a><button type="button" data-ia-file aria-expanded="false" aria-controls="ia-filep">PDF·도면은 파일로 보내기 <span aria-hidden="true">↗</span></button></div></div>
    <div class="bn-rfq-input"><div class="bn-input-heading"><span class="bn-input-dot" aria-hidden="true"></span><span>빠른 사양 확인</span><small>BOM · 엑셀 · CSV</small></div>${sbBox('home')}<div class="bn-rfq-notice">${ORDER_LIVE?'단가·납기와 제조사 서류 제공 여부는 공급처 확인 뒤 견적서에 적습니다.':'<a class="ia-status" href="#about" data-go="about">검증 운영 중 · 참고 견적을 드립니다 <span aria-hidden="true">↗</span></a>'}</div></div>
  </div><div class="bn-wrap"><div id="ia-filep" class="ia-filep-w" hidden></div></div></section>
  ${purchaseTrust()}<section class="bn-cta" aria-labelledby="bn-h-cta"><div class="bn-wrap"><div><p class="bn-eyebrow" lang="en">LET’S MAKE THE CONNECTION.</p><h2 id="bn-h-cta">목록 하나로,<br>다음 연결을 시작하세요.</h2></div><a class="bn-cta-circle" href="#list" data-go="list"><span aria-hidden="true">↗</span><b>견적 요청</b></a></div></section>
</div>`;

V.after.home = () => {
  sbInit('home'); hmBind();
  bnBrandInit();bnFilmInit();
  const f = $('pm-lib-form');
  if (f) f.addEventListener('submit', e => { e.preventDefault(); go(libURL({ q: $('pm-lib-q').value.trim() })); });
};
function hmBind() {
  const v = view();
  v.addEventListener('click', e => {
    const f = e.target.closest('[data-ia-file]');
    if (f) { iaFileToggle(f); return; }
    const p = e.target.closest('[data-ia-paste]');
    if (p) { const ta = $('sb'); if (!ta) return; sbListMode(true); ta.focus(); ta.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); }
  });
  hmCont();
}
// 이어서: 견적함·지난 요청 (C1)
function hmCont() {
  const el = $('sb-cont'); if (!el) return;
  const n = state.cart.filter(l => !l.sample).length, last = store.get('rfq.last', null);
  const parts = [];
  if (n) parts.push(`<a href="#cart" data-go="cart">견적함 ${n}줄</a>`);
  if (last && typeof last.no === 'string' && /^[A-Z]{1,2}-\d{6}-[A-Z0-9]{4}/.test(last.no)) { const d = new Date(last.t); parts.push(`지난 요청 <span class="mono">${esc(last.no)}</span>${isFinite(d) ? ` (${d.getMonth() + 1}/${d.getDate()})` : ''}`); }
  el.hidden = !parts.length; el.innerHTML = parts.length ? `이어서: ${parts.join(' · ')}` : '';
}

/* 파일 그대로 보내기 판 (명세 12.1): 요청번호·메일·카카오톡. 첨부는 고객 메일 앱에서 */
let iaReqNo = null;
function iaFilePanel() {
  if (!iaReqNo) iaReqNo = rfqNo('Q');
  const dis = ` disabled title="${RFQ_UNSET}"`, subj = `[목록견적] ${iaReqNo} `;
  const body = ['볼트노트 견적 담당자님께', `요청번호: ${iaReqNo}`, '목록 파일을 첨부합니다.', '필요한 날짜·납품지:', '필요한 서류(3.1, CoC):', '코팅·재질 조건:', '목표 단가(선택):'].join('\r\n');
  const mail = rfqOk('rfq') ? `<a class="btn sm pri" id="ia-fp-mail" href="${esc('mailto:' + String(CONTACT.rfq).trim() + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body))}">메일 열기</a>` : `<button class="btn sm pri" type="button" id="ia-fp-mail"${dis}>메일 열기</button>`;
  const kakao = rfqOk('kakaoChat') ? `<a class="btn sm" id="ia-fp-kakao" href="${esc(String(CONTACT.kakaoChat).trim())}" target="_blank" rel="noopener">채널 열기</a>` : `<button class="btn sm" type="button" id="ia-fp-kakao"${dis}>채널 열기</button>`;
  return `<section class="ia-filep" aria-labelledby="ia-fp-h"><h3 id="ia-fp-h">파일 보내기 (메일·카카오톡)</h3>
    <div class="ia-kv"><span>요청번호</span><span><b class="mono" id="ia-fp-no">${esc(iaReqNo)}</b> <button class="btn sm" type="button" data-ia-copy="${esc(iaReqNo)}">번호 복사</button></span>
    <span>메일</span><span>${rfqC('rfq')} <button class="btn sm" type="button" data-ia-copy="${esc(String(CONTACT.rfq || ''))}"${rfqOk('rfq') ? '' : dis}>주소 복사</button> ${mail}</span>
    <span>카카오톡</span><span>${kakao} <span class="small muted">${CONTACT.kakaoHours ? `${esc(CONTACT.kakaoHours)} · ` : ''}첫 메시지에 요청번호를 적어 주세요</span></span></div>
    <p class="small">엑셀·PDF·사진·도면 모두 됩니다. 엑셀 양식은 상관없습니다. 함께 적어 주시면 빨라집니다: 필요한 날짜·납품지 · 필요한 서류(3.1, CoC) · 코팅·재질 조건 · 목표 단가(선택)</p>
    <p class="small muted">받으시는 것: 견적서 · C&amp;D 1장 · 공급 불가 목록. ${esc(SLA().box)}. 보내신 목록과 도면은 견적에만 쓰고 공개하지 않습니다.</p>
    <p class="small ia-fp-msg" id="ia-fp-msg" role="status" aria-live="polite"></p></section>`;
}
function iaFileToggle(btn) {
  const w = $('ia-filep'); if (!w) return;
  const open = w.hidden;
  if (open) { w.innerHTML = iaFilePanel(); w.hidden = false; } else { w.hidden = true; }
  document.querySelectorAll('[data-ia-file]').forEach(b => b.setAttribute('aria-expanded', String(open)));
  if (open) { w.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }
  if (btn && open) w.querySelector('h3')?.setAttribute('tabindex', '-1');
}
document.addEventListener('click', e => {
  const c = e.target.closest('[data-ia-copy]'); if (!c || c.disabled) return;
  const t = c.dataset.iaCopy, msg = $('ia-fp-msg');
  const done = ok => { if (msg) msg.textContent = ok ? `복사했습니다: ${t}` : '복사가 막혀 있습니다. 글자를 길게 눌러 복사해 주세요.'; };
  try { navigator.clipboard.writeText(t).then(() => done(true), () => done(false)); } catch { done(false); }
});

/* ───────── 4. 큰 입력칸 smartBox (명세 7장) ───────── */
const SB_MAX = 300, SB_AUTO = 50;
const sbLines = raw => String(raw || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const sbIsList = raw => sbLines(raw).length >= 2 || /\t/.test(String(raw || '').trim());
// 판정 (window.__hmTest.kind로 시험)
function sbKind(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'empty';
  if (sbIsList(raw)) return sbLines(raw).length > SB_MAX ? 'toolong' : 'list';
  const first = t.split(/\s+/)[0].toUpperCase();
  if (parsePn(first)) return 'pn';
  const mk = t.toUpperCase().replace(/^각인\s*/, '').trim();
  if (Object.hasOwn(IA_MARK, mk)) return 'mark';
  const res = sbSearch(t);
  if (SPEC_RE.test(t) && !/^M\d/i.test(t)) return 'spec';
  if (res.length && res.every(r => r.g === '도구·안내')) return 'help';
  if (res.length) return 'items';
  return 'none';
}
const sbQtyOf = t => { const m = String(t).match(/(\d[\d,]*)\s*(개|ea|pcs|조|세트|set)\b/i) || String(t).match(/(\d[\d,]*)\s*(개|조|세트)/); return m ? Math.max(1, +m[1].replace(/,/g, '')) : null; };
const sbMulti = t => (String(t).match(/\d+\s*(개|ea|pcs|조|세트|set)\b/gi) || []).length >= 2 || (String(t).match(/[,;]/g) || []).length >= 2 && (String(t).match(/\bM\d+|\d\/\d/gi) || []).length >= 2;
function sbItemRow(it) {
  const p = it.preset ? parsePn(it.preset) : null, px = p && PRICE_ON(p.f.id);
  const th = iaTh(it.g === '인치·플랜트' ? 'stud' : p ? (p.f.kind === 'nut' ? 'nut' : /washer|spring/.test(p.f.kind) ? 'washer' : p.f.kind === 'rod' ? 'rod' : p.f.id === 'scs' || p.f.id === 'csk' ? 'shcs' : 'bolt') : it.g === '도구·안내' ? 'set' : 'bolt', 56, 38);
  const q = p ? (sbQtyOf($('sb')?.value || '') || packOf(p.f, p.size)) : 1, i = sbItems.indexOf(it);
  const v = p ? variantInfo(p.f, p.size, p.L, p.g, p.fin, q) : null;
  const pr = p ? (px ? `<span class="p mono">${won(v.price)}/EA</span><span class="xs faint">${PRICE_LAB()} · VAT 별도</span>` : '<span class="tag q">견적 · 단가 확인 중</span>') : '';
  const act = p
    ? `<label class="sr" for="sb-q${i}">수량</label><input class="qty" id="sb-q${i}" type="number" min="1" step="1" inputmode="numeric" value="${q}"><button class="btn sm" type="button" data-add="${esc(v.pn)}" data-qty-from="sb-q${i}">담기</button>${px && SHOP.quickOrder ? `<button class="btn sm pri" type="button" data-sb-quick="${esc(v.pn)}" data-qty-from="sb-q${i}">바로 ${ORDER_DOC()}</button>` : `<button class="btn sm" type="button" data-sb-rq1="${esc(v.pn)}" data-qty-from="sb-q${i}">견적 요청서로</button>`}<button class="btn sm txt" type="button" data-sb-pick="${i}">보기 →</button>`
    : `<button class="btn sm" type="button" data-sb-pick="${i}">보기 →</button>`;
  return `<div class="ia-ritem"><span class="th">${th}</span><div class="nmw"><button class="nm" type="button" data-sb-pick="${i}">${esc(it.t)}</button><span class="sub">${esc(it.s || '')}</span></div><div class="pr">${pr}${act}</div></div>`;
}
let sbItems = [];
// 검색이 비면 숫자·호칭을 뺀 낱말로 품목만 다시 찾는다 ('다웰핀 8x30' → 경화 평행핀)
function sbSearch(t) {
  const r = search(t); if (r.length) return r;
  const terms = String(t).toLowerCase().split(/[\s,]+/).filter(x => /[a-z가-힣]/.test(x) && !/^(m?\d|\d)/.test(x) && !/^(개|ea|pcs|조|세트|set)$/.test(x));
  if (!terms.length) return [];
  return INDEX.filter(e => /^[cmi]-/.test(e.go) && terms.every(x => e.k.includes(x) || e.t.toLowerCase().includes(x))).slice(0, 6);
}
function sbOneHTML(raw) {
  const t = raw.trim(), kind = sbKind(t);
  sbItems = kind === 'empty' ? [] : sbSearch(t);
  const groups = (list, label) => list.length ? `<div class="rh">${label}</div>${list.map(sbItemRow).join('')}` : '';
  const items = sbItems.filter(r => r.g !== '도구·안내'), help = sbItems.filter(r => r.g === '도구·안내');
  const quoteBtn = label => `<button class="btn sm" type="button" data-sb-addraw="1">${label}</button>`;
  let h = '';
  if (kind === 'mark') {
    const k = t.toUpperCase().replace(/^각인\s*/, '').trim();
    h = `<div class="rh">안내 · 각인 ${esc(k)}</div><div class="rpad"><p>${esc(IA_MARK[k])}</p><div class="actions"><a class="btn sm" href="#tools" data-go="tools" data-tab="mark">머리 마킹 읽기 →</a><a class="btn sm txt" href="#ref" data-go="ref">도면·규격 →</a></div></div>` + groups(items.slice(0, 3), '품목');
  } else if (kind === 'spec') {
    let dec = ''; try { dec = renderDecoded(decode(t)); } catch { dec = ''; }
    h = `<div class="rh">사양 한 줄로 읽었습니다</div><div class="rpad ia-dec">${dec}<div class="actions"><button class="btn sm pri" type="button" data-sb-addraw="1">이 줄을 견적함에 담기</button><button class="btn sm txt" type="button" data-sb-dec="1">표기 읽기 전체 →</button></div></div>` + groups(items.slice(0, 4), '품목 제안');
  } else if (kind === 'help') {
    h = groups(help, '안내');
  } else if (kind === 'none') {
    h = `<div class="rpad"><p>맞는 품목을 찾지 못했습니다. 엔지니어가 읽고 회신합니다.</p><div class="actions">${quoteBtn('이 문장 그대로 견적함에 담기')}</div></div>`;
  } else if (kind === 'pn' || kind === 'items') {
    const its = items.slice(0, 6);
    const priced = its.filter(r => r.preset && parsePn(r.preset) && PRICE_ON(parsePn(r.preset).f.id)), rest = its.filter(r => !priced.includes(r));
    h = groups(priced, PRICE_LAB()) + groups(rest, '견적') + groups(help.slice(0, 2), '규격 정보');
  }
  if (sbMulti(t)) h += `<div class="rpad"><p class="small">한 줄에 여러 품목이 있는 것 같습니다.</p><div class="actions"><button class="btn sm" type="button" data-sb-split="1">쉼표에서 줄 나누기</button></div></div>`;
  return h ? `<div class="ia-res" role="region" aria-label="입력 결과">${h}</div>` : '';
}
// 줄마다 필요한 서류 (C&D 서류 계획과 같은 함수): 포함 · 확인 중(제조사 문서, 공급처 확인 전) · 3.1 요청 시. 제공 여부는 견적서에 줄마다 적는다
const SB_DOC_SHOW = ['MTC31_FWD', 'HARD100', 'IMPACT', 'COAT', 'MTC22_FWD', 'COC_F21'];
function sbDocs(x) {
  let dp = null;
  try {   // 미리보기 줄에는 C&D 줄 문맥(x.ctx)이 없으므로 그 줄의 원문 문맥만 붙인다 (cdBuild의 RFQ·구역 문맥은 견적 단계에서)
    const c = cdCtxOf(x.q.raw) || {};
    dp = cdDocPlan({ ...x, ctx: x.ctx || { ...c, docs: c.docs || [] }, excluded: false }, { rfq: {}, firm: false });
  } catch (e) { dp = null; }
  if (!dp || !Array.isArray(dp.plan)) return [];
  const mat = !!(x.q.mat && x.q.mat.code);
  return dp.plan.filter(p => SB_DOC_SHOW.includes(p.code) && (p.incl || p.tbd || (p.option && p.code === 'MTC31_FWD' && mat)))
    .sort((a, b) => SB_DOC_SHOW.indexOf(a.code) - SB_DOC_SHOW.indexOf(b.code))
    .map(p => ({ t: (CD_DOC[p.code] || {}).short || p.code, s: p.incl ? '' : p.tbd ? '확인 중' : '요청 시' }));
}
// 엔진 사유 중 고객에게 의미 있는 것만 (카탈로그 범위 안내는 뺀다)
const sbNote = m => ((m.reasons || []).find(r => r.tone === 'warn' && !/^카탈로그/.test(r.text)) || {}).text || '';
// 목록 (P4): 엔진으로 줄마다 읽어 요약만 보인다. 기본 버튼은 언제나 견적 요청서
function sbListData(text) {
  let L = [];
  try { L = bomItems(text, {}).items.filter(x => !x.section); }
  catch { try { L = bomRows(text).rows.map(r => bomLine(r)); } catch { L = []; } }
  return L.map((x, i) => {
    const m = x.m || {}, st = m.status, px = st === 'catalog' && PRICE_ON(m.fam) && m.price != null;
    const k = st === 'not-available' ? 'x' : px ? 'p' : 'q';
    const r0 = (m.reasons || [])[0];
    const why = k === 'x' ? `공급 불가${r0 ? ' · ' + String(r0.text).split(/[.。]/)[0].slice(0, 40) : ''}` : k === 'p' ? `${PRICE_LAB()} ${won(m.price)}` : st === 'catalog' ? '규격품 · 단가 확인 중' : '견적';
    return { i: i + 1, t: (x.row && x.row.text) || '', qty: m.qty != null ? `${m.qty.toLocaleString()} ${m.unit === 'SET' ? 'SET' : 'EA'}` : '—', k, why, pn: px ? m.pn : null, unread: !!m.unreadable,
      spec: k === 'x' || m.unreadable ? '' : String(m.spec || ''), docs: k === 'x' ? [] : sbDocs(x), note: k === 'x' ? '' : sbNote(m) };
  });
}
function sbListHTML(text, force) {
  const n = sbLines(text).length;
  if (n > SB_MAX) return `<div class="ia-res" role="region" aria-label="목록 읽기 결과"><div class="rpad"><p>${SB_MAX}줄까지 화면에서 읽습니다. 더 긴 목록은 파일 그대로 보내 주세요.</p><div class="actions"><button class="btn sm pri" type="button" data-ia-file>파일 그대로 보내기</button></div></div></div>`;
  if (n > SB_AUTO && !force) return `<div class="ia-res" role="region" aria-label="목록 읽기 결과"><div class="rpad"><p aria-live="polite">목록 ${n}줄입니다. [목록 읽기]를 누르면 줄마다 읽습니다.</p><div class="actions"><button class="btn sm pri" type="button" data-sb-read="1">목록 읽기</button><button class="btn sm txt" type="button" data-sb-one="1">한 줄로 찾기</button></div></div></div>`;
  const rows = sbListData(text), c = { p: 0, q: 0, x: 0 }; rows.forEach(r => c[r.k]++);
  const f = sbListData.f || '', shown = rows.filter(r => !f || r.k === f), unread = rows.filter(r => r.unread).length;
  return `<div class="ia-res" role="region" aria-label="목록 읽기 결과"><div class="rh" aria-live="polite">목록 ${rows.length}줄을 읽었습니다 · <button type="button" class="btn txt sm" data-sb-one="1">한 줄로 찾기</button></div><div class="rpad">
    <div class="ia-lchips">${c.p ? `<button type="button" class="ia-lchip${f === 'p' ? ' on' : ''}" data-sb-lf="p" aria-pressed="${f === 'p'}">${PRICE_LAB()} ${c.p}줄</button>` : ''}<button type="button" class="ia-lchip${f === 'q' ? ' on' : ''}" data-sb-lf="q" aria-pressed="${f === 'q'}">견적 ${c.q}줄</button>${c.x ? `<button type="button" class="ia-lchip no${f === 'x' ? ' on' : ''}" data-sb-lf="x" aria-pressed="${f === 'x'}">공급 불가 ${c.x}줄</button>` : ''}${f ? '<button type="button" class="ia-lchip" data-sb-lf="">전체</button>' : ''}</div>
    <div class="ia-lrows">${shown.slice(0, 6).map(r => `<div class="ia-lrow"><span class="mono faint">${r.i}</span><span class="t">${esc(r.t)}</span><span class="q">${esc(r.qty)}</span><span class="k k-${r.k}">${esc(r.why)}</span>${r.spec || r.docs.length ? `<div class="ia-lm">${r.spec ? `<span class="ia-lspec"><span class="lab">맞춘 규격</span>${esc(r.spec)}</span>` : ''}${r.note ? `<span class="ia-lnote">${esc(r.note)}</span>` : ''}${r.docs.length ? `<span class="ia-ldocs"><span class="lab">필요 서류</span>${r.docs.map(d => `<span class="ia-ldoc${d.s ? ' s' : ''}">${esc(d.t)}${d.s ? `<small>${d.s}</small>` : ''}</span>`).join('')}</span>` : ''}</div>` : ''}</div>`).join('')}${shown.length > 6 ? `<p class="small faint">… ${shown.length - 6}줄 더</p>` : ''}</div>
    ${unread ? `<p class="small">읽지 못한 줄 ${unread} — 그대로 보내셔도 됩니다. 엔지니어가 읽습니다.</p>` : ''}
    <p class="small">받으시는 것: 견적서(줄마다 단가·납기 범위·서류 계획) · C&amp;D 1장 · 공급 불가 목록. 서류는 줄마다 필요한 것을 적은 것이고, 제조사 서류의 제공 여부는 공급처 확인 뒤 견적서에 적습니다.</p>
    <div class="actions"><button type="button" class="btn pri" data-sb-rq="1">견적 요청서 만들기 →</button>${c.p && SHOP.quickOrder ? `<button type="button" class="btn txt" data-sb-ponly="1">${PRICE_LAB()} ${c.p}줄만 ${ORDER_DOC()} 하기</button>` : ''}<button type="button" class="btn txt" data-sb-wb="1">줄마다 자세히 보기 (엔지니어 화면)</button></div>
    <p class="xs faint">읽기는 이 브라우저 안에서만 합니다. 보내기는 다음 단계에서 고르십니다.</p>
  </div></div>`;
}
let sbT = null, sbForce = false, sbWhere = 'home';
function sbListMode(on) {
  const ta = $('sb'), row = $('sb-row'), go = $('sb-go'); if (!ta) return;
  row.classList.toggle('list', on);
  if (on && ta.rows < 5) ta.rows = 5;
  go.textContent = sbWhere === 'home' ? '줄마다 맞춰 보기' : on ? '목록 읽기' : (sbWhere === 'list' ? '줄마다 읽기' : '찾기');
  ta.setAttribute('enterkeyhint', on ? 'enter' : 'search');
}
function sbFit() {
  const ta = $('sb'); if (!ta) return;
  const n = sbLines(ta.value).length, list = sbIsList(ta.value) || ta.value.includes('\n');
  sbListMode(list || sbWhere === 'list');
  ta.rows = list || sbWhere === 'list' ? Math.min(8, Math.max(sbWhere === 'list' ? 6 : 5, n + 1)) : sbWhere === 'home' ? 4 : 1;   // 홈: 처음부터 BOM 몇 줄이 들어갈 크기
}
function sbRun(force) {
  const ta = $('sb'), out = $('sb-res'); if (!ta || !out) return;
  const v = ta.value;
  try { out.innerHTML = !v.trim() ? '' : sbIsList(v) ? sbListHTML(v, force || sbForce) : sbOneHTML(v); }
  catch (e) { out.innerHTML = ''; }   // 판정 실패는 조용히 비운다 (명세 7.1: 일반 검색으로 내림)
}
function sbInit(where) {
  sbWhere = where; sbForce = false; sbListData.f = '';
  const ta = $('sb'); if (!ta) return;
  if (state.listPrefill) { ta.value = state.listPrefill; state.listPrefill = null; }
  sbFit(); if (ta.value.trim()) sbRun();
  ta.addEventListener('input', () => { sbFit(); sbForce = false; clearTimeout(sbT); sbT = setTimeout(() => sbRun(), sbIsList(ta.value) ? 250 : 120); });
  ta.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter는 무시
    const list = sbIsList(ta.value) || $('sb-row').classList.contains('list');
    if (!list) { e.preventDefault(); sbRun(); return; }
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); sbForce = true; sbRun(true); }
  });
  $('sb-go').addEventListener('click', () => { sbForce = true; sbRun(true); });
  const row = $('sb-row');
  row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drop'); });
  row.addEventListener('dragleave', () => row.classList.remove('drop'));
  row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('drop'); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) sbFile(f); });
  const fi = $('sb-file'); if (fi) fi.addEventListener('change', () => { if (fi.files[0]) sbFile(fi.files[0]); fi.value = ''; });
  const w = $('sb-w');
  w.addEventListener('click', e => {
    const ex = e.target.closest('[data-sb-ex]');
    if (ex) { ta.value = ex.dataset.sbEx === '__list' ? IA_LIST_EX : ex.dataset.sbEx; sbFit(); sbRun(); ta.focus(); return; }
  });
  w.addEventListener('click', sbResClick);
}
// 파일 올리기 하나로: 엑셀·CSV는 화면에서 읽고(양식 무관: 한 행을 한 줄 글로 읽는다), 그 밖의 파일은 메일로 받는다
const SB_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt,.json,.pdf,.png,.jpg,.jpeg,.heic,.webp,.dwg,.dxf,.step,.stp,.zip,image/*,application/pdf';
const SB_FILE_HINT = '엑셀·CSV는 양식에 상관없이 이 화면에서 바로 줄마다 읽습니다(어디에도 보내지 않습니다). PDF·사진·도면은 메일로 받습니다.';
function sbFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase(), msg = $('bom-file-msg');
  if (msg) msg.hidden = false;
  if (!['xlsx', 'xls', 'csv', 'tsv', 'txt', 'json'].includes(ext)) {
    if (msg) msg.textContent = '';
    $('sb-res').innerHTML = `<div class="ia-res" role="region" aria-label="파일"><div class="rpad"><p><b>${esc(file.name)}</b>: PDF·사진·도면은 이 화면에서 읽지 못해 메일로 받습니다. <b>메일 열기</b>를 누른 뒤 이 파일을 첨부해 주세요.</p></div></div>`;
    const fp = $('ia-filep'); if (fp && fp.hidden) iaFileToggle(); else fp?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    return;
  }
  bomOpenFile(file, t => { const ta = $('sb'); ta.value = t; sbFit(); sbForce = true; sbRun(true); });
}
function sbResClick(e) {
  const ta = $('sb'); if (!ta) return;
  const b = e.target.closest('[data-sb-pick]');
  if (b) { const it = sbItems[+b.dataset.sbPick]; if (it) iaPick(it); return; }
  if (e.target.closest('[data-sb-addraw]')) {
    const raw = ta.value.trim(); if (!raw) return;
    addQuote({ fam: '', title: '사양 한 줄 (원문)', spec: raw, qty: sbQtyOf(raw) || 1, unit: 'EA' });
    toast('견적함에 견적 줄을 담았습니다'); return;
  }
  if (e.target.closest('[data-sb-dec]')) { state.decPrefill = ta.value.trim(); go('ref'); return; }
  if (e.target.closest('[data-sb-split]')) { ta.value = ta.value.split(/\s*[,;]\s*/).filter(Boolean).join('\n'); sbFit(); sbRun(); return; }
  if (e.target.closest('[data-sb-read]')) { sbForce = true; sbRun(true); return; }
  if (e.target.closest('[data-sb-one]')) { ta.value = sbLines(ta.value).join(' '); sbListMode(false); sbFit(); sbRun(); return; }
  const lf = e.target.closest('[data-sb-lf]');
  if (lf) { sbListData.f = lf.dataset.sbLf; sbForce = true; sbRun(true); return; }
  if (e.target.closest('[data-sb-rq]')) { iaToQuote(ta.value); return; }
  if (e.target.closest('[data-sb-wb]')) { bomNewText(ta.value); go('bom'); return; }
  if (e.target.closest('[data-sb-ponly]')) {
    const pns = sbListData(ta.value).filter(r => r.pn); let n = 0;
    pns.forEach(r => { const m = String(r.qty).match(/[\d,]+/); if (addItem(r.pn, m ? +m[0].replace(/,/g, '') : 1)) n++; });
    toast(`견적함에 ${n}줄을 담았습니다`); go('cart'); return;
  }
  const r1 = e.target.closest('[data-sb-rq1]');
  if (r1) { const qty = Math.max(1, Math.round(+($(r1.dataset.qtyFrom) || {}).value || 1)); if (addItem(r1.dataset.sbRq1, qty)) { go('cart'); setTimeout(() => $('ask')?.click(), 60); } return; }
  const q = e.target.closest('[data-sb-quick]');
  if (q) { const qty = Math.max(1, Math.round(+($(q.dataset.qtyFrom) || {}).value || 1)); if (addItem(q.dataset.sbQuick, qty)) { go('cart'); setTimeout(() => $('order')?.click(), 60); } }
}
// 붙여넣은 목록 → 견적 요청서 (4A-1 요청 칸까지 바로)
function iaToQuote(text) {
  bomNewText(String(text || '').trim()); state.bom.doc = 'quote'; bomSave();
  go('quote');
  setTimeout(() => { const s = document.querySelector('[data-q="send"]'); if (s) { s.click(); setTimeout(() => $('qd-send')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }), 60); } }, 30);
}
// 검색 결과 하나로 가기 (머리글 찾기와 같은 규칙)
function iaPick(it) {
  if (it.preset) applyPreset(it.preset);
  if (it.prefill) state.prefill = it.prefill;
  state.inchPreset = it.isize || null;
  if (it.tab) state.tab = it.tab;
  if (it.jump) { jumpTo(it.jump); return; }
  go(it.go);
  if (it.zone) { const z = $(it.zone); if (z) { z.scrollIntoView({ block: 'start' }); const h = z.querySelector('h2'); if (h) h.focus({ preventScroll: true }); } }
}
// 머리글 찾기 칸에 여러 줄을 붙여 넣으면 목록 견적의 큰 칸으로 (명세 8.3)
$('q').addEventListener('paste', e => {
  const t = (e.clipboardData || window.clipboardData)?.getData('text') || '';
  if (!/\n/.test(t.trim())) return;
  e.preventDefault(); state.listPrefill = t; $('q').value = ''; go(state.route === 'home' ? 'home' : 'list');
});
window.__hmTest = { kind: sbKind, list: t => sbListData(t).map(r => ({ k: r.k, why: r.why })), isList: sbIsList };

/* ───────── 5. 제품 · 칸 · 모음 · 바로 주문 (명세 9장) ───────── */
const iaFamPriced = f => PRICE_ON(f.id);
function iaFamAct(f) {
  if (f.route) return `<a class="btn sm" href="#${f.route}" data-go="${f.route}">보기 →</a>`;
  if (f.p === 'A') return `<a class="btn sm" href="#c-${f.id}" data-go="c-${f.id}">보기 →</a>`;
  return `<a class="btn sm" href="#c-${f.id}" data-go="c-${f.id}" data-ia-spec="1">사양 적어 담기</a>`;
}
const iaFamCard = f => `<div class="ia-fam"><span class="th${shapeHas(f.id) ? ' ph' : ''}">${shapeHas(f.id) ? shapeThumb(f.id) : iaTh(iaThKey(f), 64, 42)}</span>
  <span class="nm"><a href="#${f.route || 'c-' + f.id}" data-go="${f.route || 'c-' + f.id}">${esc(f.ko)}</a><span class="en" lang="en">${esc(f.en)}</span></span>
  <span class="meta"><span class="purchase-badge">${purchaseScope(f)}</span>${iaSysTag(f)}<span>${iaStdShort(f)}</span></span>
  <span class="act">${iaFamPriced(f) ? `<span class="pv">${PRICE_LAB()} 확인 품목</span>` : '<span class="tag q">견적</span>'}${iaFamAct(f)}<button class="purchase-link" type="button" data-purchase-product="${f.id}">사양·서류 확인 →</button></span></div>`;
const iaFilt = (state.iaFilt = state.iaFilt || {});
function iaFilterBar() {
  return `<div class="ia-filt" role="group" aria-label="거르기"><span class="ia-seg" role="group" aria-label="체계">${[['all', '전체'], ['metric', '미터'], ['inch', '인치']].map(([k, t]) => `<button type="button" data-ia-sys="${k}" aria-pressed="${state.iaSys === k}">${t}</button>`).join('')}</span>
    <label class="ia-chk"><input type="checkbox" id="ia-buyonly"${state.iaBuy ? ' checked' : ''}> 바로 주문 가능한 것만</label>
    <label class="ia-chk"><input type="checkbox" id="ia-cadonly"${iaFilt.cad ? ' checked' : ''}> CAD 있음</label></div>`;
}
const iaFamOk = f => iaSysOk(f, state.iaSys) && (!state.iaBuy || iaFamPriced(f)) && (!iaFilt.cad || iaCadFam(f));
function iaBindFilter(redraw) {
  view().addEventListener('click', e => {
    const s = e.target.closest('[data-ia-sys]');
    if (s) { state.iaSys = s.dataset.iaSys; store.set('iaSys', state.iaSys); redraw(); document.querySelector(`[data-ia-sys="${state.iaSys}"]`)?.focus(); }
  });
  view().addEventListener('change', e => {
    if (e.target.id === 'ia-buyonly') { state.iaBuy = e.target.checked; redraw(); $('ia-buyonly')?.focus(); }
    if (e.target.id === 'ia-cadonly') { iaFilt.cad = e.target.checked; redraw(); $('ia-cadonly')?.focus(); }
  });
}
function iaRedraw(fn) { return () => { const v = view(), y = window.scrollY; v.innerHTML = fn(); window.scrollTo(0, y); }; }
function iaTileBody(t) {
  const fams = id => CAT_F[id];
  const groups = t.subs.map(s => ({ s, list: s.f.map(fams).filter(Boolean).filter(iaFamOk) }));
  const shown = groups.reduce((a, g) => a + g.list.length, 0);
  const cross = t.cross.map(fams).filter(Boolean).filter(iaFamOk);
  if (!shown) return `<div class="ia-box"><p>이 조건에 맞는 품목이 없습니다.${state.iaBuy && !PRICE_ANY() ? ' 품목 단가를 공급처와 확인하고 있습니다. 몇 줄이라도 견적으로 받습니다.' : ''}</p><div class="actions"><button class="btn" type="button" data-ia-reset="1">거르기 지우기</button><a class="btn" href="#list" data-go="list">목록 붙여넣기 →</a></div></div>`;
  return `<div class="ia-sgs">${groups.map(g => `<section class="ia-sg"><h3>${esc(g.s.ko)}<span class="cnt">${g.list.length === g.s.f.length ? `${g.s.f.length}종` : `${g.list.length} / ${g.s.f.length}종`}</span></h3>${g.list.length ? `<div class="ia-fams">${g.list.map(iaFamCard).join('')}</div>` : '<p class="small faint ia-none">이 조건에 맞는 품목이 없습니다.</p>'}</section>`).join('')}</div>
  ${cross.length ? `<section class="ia-sg ia-cross"><h3>다른 칸에도 있는 품목<span class="cnt">${cross.length}종</span></h3><p class="small">${cross.map(f => `<a href="#${f.route || 'c-' + f.id}" data-go="${f.route || 'c-' + f.id}">${esc(f.ko)}</a>`).join(' · ')}</p></section>` : ''}`;
}
V.t = id => {
  const t = iaTile(id) || CAT_TILES[0], n = iaTileN(t);
  return iaPage(iaHead([['제품', 'products'], [t.ko]], esc(t.ko), t.en, `${n}종 · 하위 묶음 ${t.subs.length}개. 미터·인치는 아래 거르기로 고릅니다. 페이지가 아직 없는 품목도 [사양 적어 담기]로 견적함에 넣을 수 있습니다.`)
    + iaFilterBar() + `<div id="ia-tbody">${iaTileBody(t)}</div>`);
};
V.after.t = id => {
  const t = iaTile(id) || CAT_TILES[0];
  const redraw = () => { const b = $('ia-tbody'); if (b) b.innerHTML = iaTileBody(t); document.querySelectorAll('[data-ia-sys]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.iaSys === state.iaSys))); };
  iaBindFilter(redraw);
  view().addEventListener('click', e => { if (e.target.closest('[data-ia-reset]')) { state.iaSys = 'all'; state.iaBuy = false; iaFilt.cad = false; store.set('iaSys', 'all'); const c1 = $('ia-buyonly'), c2 = $('ia-cadonly'); if (c1) c1.checked = false; if (c2) c2.checked = false; redraw(); } });
};
function iaProductsBody() {
  const sys = state.iaSys;
  const pages = Object.values(CAT_F).filter(f => (f.route || f.p === 'A') && iaSysOk(f, sys) && sys !== 'all');
  return `${hmTiles()}
  <div class="ia-plist">${CAT_TILES.map(t => { const subs = t.subs.map(s => [s, s.f.filter(id => CAT_F[id] && iaSysOk(CAT_F[id], sys)).length]).filter(([, k]) => k);
    return `<section class="ia-pl"><h3><a href="#t-${t.id}" data-go="t-${t.id}">${esc(t.ko)}</a><span class="cnt">${subs.reduce((a, [, k]) => a + k, 0)}종</span></h3><p class="small muted">${subs.map(([s, k]) => `${esc(s.ko)} ${k}`).join(' · ')}</p></section>`; }).join('')}</div>
  ${pages.length ? `<section class="ia-sg"><h3>${sys === 'metric' ? '미터' : '인치'} 품목 중 치수 페이지가 있는 것<span class="cnt">${pages.length}종</span></h3><div class="ia-fams">${pages.map(iaFamCard).join('')}</div></section>` : ''}
  ${hmColls(false)}`;
}
V.products = () => iaPage(iaHead([['제품']], '제품', 'Products', `${Object.keys(CAT_F).length}종을 6칸에 나눴습니다. 미터·인치는 칸이 아니라 거르기로 고릅니다. 바로 주문은 공급처 단가를 확인한 품목에만 열립니다.`)
  + `<div class="ia-filt" role="group" aria-label="체계"><span class="ia-seg" role="group" aria-label="체계">${[['all', '전체'], ['metric', '미터'], ['inch', '인치']].map(([k, t]) => `<button type="button" data-ia-sys="${k}" aria-pressed="${state.iaSys === k}">${t}</button>`).join('')}</span><a class="small" href="#buy" data-go="buy">규격품 바로 주문 →</a></div>
  ${purchaseLineup()}<div id="ia-pbody">${iaProductsBody()}</div>`);
V.after.products = () => iaBindFilter(() => { const b = $('ia-pbody'); if (b) b.innerHTML = iaProductsBody(); document.querySelectorAll('[data-ia-sys]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.iaSys === state.iaSys))); });
V.buy = () => {
  const pf = Object.values(CAT_F).filter(iaFamPriced), steps = ['담기', `${ORDER_DOC()} 만들기`, '메일·카카오톡으로 보내기', '확인 메일', '입금'];
  return iaPage(iaHead([['제품', 'products'], ['바로 주문']], '규격품 바로 주문', 'Order Standard Parts',
    `가격이 표시된 품목을 담고 ${ORDER_DOC()}를 만들어 메일·카카오톡으로 보내 주세요. 공급처를 확인해 출고 예정일과 입금 안내를 확인 메일로 드립니다.`)
    + `<div class="ia-box">${ORDER_LIVE ? '' : '<p class="ia-pencil">검증 운영 중: 주문 요청서는 확인 메일을 주고받은 뒤 주문이 됩니다.</p>'}
      <div class="ia-steps"><span class="lab">주문은 이렇게 됩니다</span>${steps.map((s, i) => `<span class="s"><span class="ia-bal sm">${i + 1}</span>${s}</span>`).join('<span class="arw" aria-hidden="true">→</span>')}</div>
      <p class="small muted">대금 계좌이체·전자세금계산서 · 카드는 요청 시 결제 링크 │ 배송비 견적함에서 계산 │ 바뀌면 확인 메일에 적고, 그때 취소해도 비용 없음</p></div>`
    + (pf.length ? `<section class="ia-sg"><h3>가격이 표시된 품목<span class="cnt">${pf.length}종 · 기준일 ${esc(SHOP.priceBasis)}</span></h3><div class="ia-fams">${pf.map(iaFamCard).join('')}</div></section>`
      : `<div class="ia-box thin"><p>품목 단가를 공급처와 확인하고 있습니다. 몇 줄이라도 견적으로 받습니다.</p><div class="actions"><a class="btn" href="#products" data-go="products">품목 전체 보기 →</a><a class="btn pri" href="#list" data-go="list">목록 붙여넣기 →</a></div></div>`));
};
const IA_KTXT = {
  plant: 'A193·A194·A320·A453 스터드와 헤비너트, B16.5 플랜지 볼트 계산, 줄마다 서류 계획. 품목은 볼트·너트·스터드 칸에 걸쳐 있습니다.',
  pump: '케이싱·글랜드·베어링 하우징 스터드와 너트, 베어링 로크너트·와셔, 키, 플러그, 평행핀, 멈춤링.' + (API610_TOOL ? ' API 610 펌프 볼트 표는 계산·대조표에 있습니다.' : ''),
  flange: 'KS·JIS 10K·20K 플랜지 볼트·너트 세트, 미터 스터드, 미터 헤비너트.',
};
V.k = id => {
  const c = CAT_COLL[id] || CAT_COLL.plant, key = CAT_COLL[id] ? id : 'plant', list = c.f.map(x => CAT_F[x]).filter(Boolean);
  const A = zone('A', 'z-a', iaHead([['제품', 'products'], ['모아 보기'], [c.ko]], esc(c.ko), c.en, IA_KTXT[key] || '')
    + `<div class="ia-fams wide">${list.map(iaFamCard).join('')}</div>
    <div class="ia-box blue"><p><b>목록이 있으시면</b> 줄마다 서류 계획(제조사 3.1 제공 여부는 공급처 확인 후 회신)과 공급 불가 줄을 적어 견적합니다.</p><div class="actions"><a class="btn pri" href="#list" data-go="list">목록 보내고 견적 받기 →</a>${key === 'plant' ? '<a class="btn" href="#k-plant" data-jump="ia-fl">플랜지 스터드 길이 계산 ↓</a>' : key === 'pump' && API610_TOOL ? '<a class="btn" href="#tools" data-go="tools" data-tab="api610">API 610 펌프 볼트 →</a>' : '<a class="btn" href="#custom" data-go="custom">도면·사양서로 요청 →</a>'}</div></div>`, 'ia-z');
  if (key !== 'plant') return sheet(A);
  // 플랜트 볼팅 모음 = 옛 3장(인치·플랜트 볼트)의 부품표·플랜지 계산·견적 전 확인·사용 조건 표 (명세 9.4, 10장 #inch·z-c)
  return sheet(A
    + zone('B', 'z-b', zh('B', 'z-b', `인치·플랜트 볼트 ${INCH.length}종 · 플랜지 볼트 계산`, 'ASME·ASTM·SAE 규격품은 사양을 확인한 뒤 견적으로 드립니다. 원 안 번호는 품목 번호입니다.') + bomInch(true)
      + `<h3 class="fl-h" id="ia-fl" tabindex="-1">플랜지 볼팅 세트 · ASME B16.5 Class 150·300·600</h3><div class="cols c-7-5">${flangeFig()}${flangeCtl(0)}</div>`)
    + zone('C', 'z-c', zh('C', 'z-c', '사용 조건별로 고르는 볼트·너트', '온도, 사워(H2S), 해수, 구조용처럼 자주 받는 조건에 흔히 쓰는 조합입니다.', xref('tools', '등급별 성질표 → 계산·대조표', 'plant')) + `<details class="acc desk first" open><summary>사용 조건 ${SVC.length}가지 표 펼치기</summary>${svcGuideHTML()}</details>`)
    + zone('D', 'z-d', zh('D', 'z-d', '견적 전에 확인하는 6가지', '인치·플랜트 사양서를 받으면 이 여섯 가지를 먼저 봅니다. 빠진 칸은 견적 전에 질문으로 돌려 드립니다.')
      + `<div class="cols c-7-5">${checksNl()}<div class="stack">${note('info', NOTE_1_14)}<div class="actions"><a class="btn pri" href="#custom" data-go="custom">도면·사양서로 요청 →</a></div></div></div>`));
};
V.after.k = id => { if (!CAT_COLL[id] || id === 'plant') flangeInit(); };

/* ───────── 6. 품목 페이지 c-<id> (A: 치수표 · 도면 · CAD / B·C: 사양 정보 + 견적 요청) ───────── */
state.iaSel = {};
const iaRows = f => (f.dims && f.dims.rows) || [];
function iaSelOf(f) {
  const s = state.iaSel[f.id] || (state.iaSel[f.id] = {});
  const rows = iaRows(f);
  if (s.size == null) s.size = rows.length ? rows[Math.floor(rows.length / 2)][0] : '';
  if (s.L == null) s.L = '';
  if (s.mat == null) s.mat = f.mats[0] || '';
  if (s.fin == null) s.fin = f.fins[0] || '';
  if (!(s.qty >= 1)) s.qty = 1;
  if (s.unit == null) s.unit = 'EA';
  if (s.memo == null) s.memo = '';
  return s;
}
// 규격 칸(좁은 4칸)에는 규격 번호만: 'KS B 1012 6각 너트 및 …' → 'KS B 1012'. 번호가 없는 값('제조사 규격 …')은 그대로 자른다
const iaStdCut = v => {
  let t = String(v).split(/\s*[(\[]|\s+—\s+|\s*;\s*/)[0].split(' · ').slice(0, 2).join(' · ').trim();
  const w = t.split(' '), i = w.findIndex(x => /[가-힣]/.test(x));
  if (i >= 2 && /\d/.test(w.slice(0, i).join(' '))) t = w.slice(0, i).join(' ').replace(/\s*·$/, '');
  return t.length > 28 ? t.slice(0, 27) + '…' : t;
};
const iaRowOf = (f, size) => iaRows(f).find(r => r[0] === size) || null;
const iaColVal = (f, size, key) => { const r = iaRowOf(f, size); if (!r) return null; const i = f.dims.cols.findIndex(c => c[0] === key); return i < 0 ? null : r[i + 1]; };
const iaNum = v => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? +v : null);
const iaMetricD = size => { const m = String(size).match(/^M(\d+(?:\.\d+)?)/i); return m ? +m[1] : iaNum(size); };
// 단순 치수 도면 (원문 대조 행의 값만). 템플릿이 없는 품목은 그리지 않는다
// 치수 값: 숫자, 또는 인치 분수 글자('7/16', '1-1/8')를 수로. 못 읽으면 null (그리지 않음)
const iaQty = v => { if (typeof v === 'number') return isFinite(v) ? v : null; const m = String(v ?? '').trim().match(/^(?:(\d+)[- ])?(\d+)\/(\d+)$|^(\d+(?:\.\d+)?)$/); return !m ? null : m[4] ? +m[4] : (m[1] ? +m[1] : 0) + m[2] / m[3]; };
// 값은 수로 계산하고, 표에 분수로 적힌 값('7/16')은 그림에도 분수로 적는다 (Number 객체에 원문 raw와 열 이름 key를 붙임: 그림 글자는 표의 열 이름)
const iaCv = (f, size, ...keys) => { for (const k of keys) { const r = iaColVal(f, size, k), v = iaQty(r); if (v > 0) return Object.assign(new Number(v), { raw: r, key: k }); } return null; };
const IA_DRAW = {
  pin: (f, s) => { const d = iaCv(f, s.size, 'd', 'd1', 'dn'), L = iaQty(s.L) || iaCv(f, s.size, 'lMinStd'); return d ? { k: 'pin', d, L: L || null } : null; },
  washer: (f, s) => { const a = iaCv(f, s.size, 'd1', 'ID'), b = iaCv(f, s.size, 'd2', 'OD'), h = iaCv(f, s.size, 'h', 'T_min'); return a && b && h && b > a ? { k: 'washer', a, b, h, inch: f.sys === 'inch' } : null; },
  nut: (f, s) => { if (f.id === 'capnut') return null;   /* 캡너트는 v7_iadraw.js가 둥근 모양으로 그린다 (육각너트 모양으로 다시 그려지지 않게 비움) */
    const sw = iaCv(f, s.size, 's', 'F'), m = iaCv(f, s.size, 'm', 'h', 'l', 'H'); return sw && m ? { k: 'nut', s: sw, m, d: iaMetricD(s.size), inch: f.sys === 'inch' } : null; },
  key: (f, s) => { const b = iaCv(f, s.size, 'b'), h = iaCv(f, s.size, 'h'), L = iaQty(s.L) || iaCv(f, s.size, 'lMin'); return b && h && L ? { k: 'key', b, h, L } : null; },
};
const IA_DRAW_OF = { pin: 'pin', washer: 'washer', nut: 'nut', key: 'key' };
function iaDrawSvg(f, s) {
  const more = iaDwMore(f, s); if (more !== undefined) return more;   // 나사류·스터드·캡너트 (v7_iadraw.js)
  const kind = IA_DRAW_OF[f.eng] && !/^(cotter|clevis|rclip|ipin|grooved|splittaper|spring-co|taper|taper-th)$/.test(f.id) && !/^(tnut|rivnut|channelnut|wing|castle|eyenut|cagenut|weldnut|sqnut|fixturenut|profilenut|oemnut|flangenut|allmetal|hn2)$/.test(f.id) && !/^(sealw|bondseal|dti|taperw|sphw|sqw|pwxl)$/.test(f.id) ? IA_DRAW_OF[f.eng] : null;
  const g = kind && f.dims ? IA_DRAW[kind](f, s) : null; if (!g) return null;
  const P = 'iaAr', u = f.sys === 'inch' ? '"' : '', fmt = v => typeof v?.raw === 'string' && v.raw.includes('/') ? `${v.raw}${u}` : `${+(+v).toFixed(3)}${u}`;
  let b = '', W = 520, H = 250, cy = 122;
  if (g.k === 'pin' || g.k === 'key') {
    const len = g.L || (g.k === 'pin' ? g.d * 6 : 0), dia = g.k === 'pin' ? g.d : g.h, sc = Math.min(360 / len, 120 / dia), w = len * sc, h = dia * sc, x0 = (W - w) / 2, y0 = cy - h / 2, ch = g.k === 'pin' ? Math.min(h * .18, 6) : 0;
    b += `<path class="ol" d="M${r2(x0 + ch)} ${r2(y0)}H${r2(x0 + w - ch)}L${r2(x0 + w)} ${r2(y0 + ch)}V${r2(y0 + h - ch)}L${r2(x0 + w - ch)} ${r2(y0 + h)}H${r2(x0 + ch)}L${r2(x0)} ${r2(y0 + h - ch)}V${r2(y0 + ch)}Z"/>`;
    if (g.k === 'pin') b += `<path class="cl" d="M${r2(x0 - 14)} ${cy}H${r2(x0 + w + 14)}"/>`;
    b += dimLine(x0, y0, x0 + w, y0, g.L ? `${g.k === 'pin' ? 'l' : 'L'} ${fmt(len)}` : 'l', 'top', 26, P);   // 길이를 안 골랐으면 기호만
    b += dimLine(x0 + w, y0, x0 + w, y0 + h, `${g.k === 'pin' ? 'd' : 'h'} ${fmt(dia)}`, 'right', 26, P);
    if (g.k === 'key') b += `<text class="ds" x="${r2(x0)}" y="${r2(y0 + h + 24)}">b ${fmt(g.b)} (폭)</text>`;
  } else if (g.k === 'washer') {
    H = 268;   // 아래 치수 글자(d2·OD)와 캡션이 겹치지 않게
    const sc = 150 / g.b, R = g.b * sc / 2, r = g.a * sc / 2, cx = 170, t = Math.max(g.h * sc, 3);
    b += `<circle class="ol" cx="${cx}" cy="${cy}" r="${r2(R)}"/><circle class="ol" cx="${cx}" cy="${cy}" r="${r2(r)}"/><path class="cl" d="M${cx - R - 12} ${cy}H${r2(cx + R + 12)}M${cx} ${r2(cy - R - 12)}V${r2(cy + R + 12)}"/>`;
    b += dimLine(cx - R, cy + R, cx + R, cy + R, `${g.b.key || 'd2'} ${fmt(g.b)}`, 'bottom', 22, P) + dimLine(cx - r, cy - R, cx + r, cy - R, `${g.a.key || 'd1'} ${fmt(g.a)}`, 'top', 18, P);
    const sx = 380; b += `<path class="ol" d="M${sx} ${r2(cy - R)}h${r2(t)}V${r2(cy - r)}h${r2(-t)}ZM${sx} ${r2(cy + r)}h${r2(t)}V${r2(cy + R)}h${r2(-t)}Z"/><path class="cl" d="M${sx - 20} ${cy}H${r2(sx + t + 20)}"/>` + dimLine(sx, cy - R, sx + t, cy - R, `${(g.h.key || 'h').replace('_min', ' min')} ${fmt(g.h)}`, 'top', 18, P);
  } else if (g.k === 'nut') {
    const sc = Math.min(140 / (g.s * 1.155), 120 / g.m), cx = 160, e = g.s * 1.155 * sc / 2, sf = g.s * sc / 2;   // 옆면(높이 m·길이 l)이 그림 칸 안에 들어오게
    const pts = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 6 + i * Math.PI / 3; return `${r2(cx + e * Math.cos(a))},${r2(cy + e * Math.sin(a))}`; }).join(' ');
    b += `<polygon class="ol" points="${pts}"/>${g.d && !g.inch ? `<circle class="ol" cx="${cx}" cy="${cy}" r="${r2(g.d * sc / 2)}"/>` : ''}<path class="cl" d="M${r2(cx - e - 12)} ${cy}H${r2(cx + e + 12)}M${cx} ${r2(cy - e - 12)}V${r2(cy + e + 12)}"/>`;
    b += dimLine(cx - sf, cy - e, cx + sf, cy - e, `${g.s.key || 's'} ${fmt(g.s)}`, 'top', 14, P);
    const sx = 360, mh = g.m * sc; b += `<path class="ol" d="M${sx} ${r2(cy - e)}h${r2(mh)}V${r2(cy + e)}h${r2(-mh)}Z"/><path class="eg" d="M${sx} ${r2(cy - sf / 2)}h${r2(mh)}M${sx} ${r2(cy + sf / 2)}h${r2(mh)}"/>` + dimLine(sx, cy - e, sx + mh, cy - e, `${g.m.key || 'm'} ${fmt(g.m)}`, 'top', 18, P);
  }
  return `<svg class="dw ia-dw" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(f.ko)} ${esc(s.size)} 치수 도면"><defs>${marker(P)}</defs>${b}<text class="cap" x="${W - 8}" y="${H - 8}" text-anchor="end">${esc(f.enStd || '')} · 단위 ${f.sys === 'inch' ? 'in' : 'mm'} · 비례 없음 · 원문 대조 값</text></svg>`;
}
// CAD: 기존 26종은 각 장에서. 새 품목은 원문 대조 치수가 생성기에 그대로 맞는 것만 (iaCadNew)
const IA_CAD_NEW = { hnthin: 'nut', pwl: 'washer' };
const iaCadFam = f => !!(f.route && typeof CAD_FAM !== 'undefined' && CAD_FAM[f.id]) || !!(IA_CAD_NEW[f.id] && f.dims);
function iaDimsHTML(f, s) {
  if (!f.dims) return f.dimsHeld ? `<div class="note info small"><span class="nk">도면 기준 견적</span><span>이 품목의 상세 치수는 적용 규격과 고객 도면을 기준으로 확인합니다${f.gate ? ` (${esc(f.gate)})` : ''}. 공개 치수표 대신 요구 사양으로 견적을 검토합니다.</span></div>`
    : `<div class="note info small"><span class="nk">치수</span><span>표준 치수표는 싣지 않았습니다. 도면이나 규격 번호를 보내 주시면 그 기준으로 견적합니다.</span></div>`;
  const cols = f.dims.cols, u = f.dims.u || (f.sys === 'inch' ? 'in' : 'mm');
  return `<div class="tblw ia-dimt"><table class="tbl mid"><caption>${f.dims.basis === 'T2' ? `치수 근거 ${esc(f.enStd || '')} · 제조·유통사 공개 기술자료 3곳 이상 대조 (규격서 원문 대조 전)` : `치수 근거 ${esc(f.enStd || '')} · 원문 대조 행만`} · 단위 ${esc(u)}${f.dims.dropped ? ` · 원문 미대조 ${f.dims.dropped}행은 싣지 않음` : ''}</caption><thead><tr><th scope="col">호칭</th>${cols.map(([k, ko]) => `<th scope="col" class="r"><span class="mono">${esc(k)}</span><span class="sub">${esc(ko)}</span></th>`).join('')}</tr></thead><tbody>${f.dims.rows.map(r => `<tr${r[0] === s.size ? ' aria-current="true" class="on"' : ''} data-ia-size="${esc(r[0])}"><th scope="row" class="mono">${esc(r[0])}</th>${r.slice(1).map(v => `<td class="r mono">${v == null ? '<span class="faint">—</span>' : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function iaSpecText(f, s) {
  return [f.short || f.ko, (f.std[0] || [])[1] ? String(f.std[0][1]).split(/[ (]/).slice(0, 2).join(' ') : '', s.size && (s.L ? `${s.size} × ${s.L}` : s.size), s.mat, s.fin, s.memo && `메모: ${s.memo}`].filter(Boolean).join(' / ');
}
function iaCfgHTML(f, s) {
  const rows = iaRows(f), lens = f.lens || [];
  const sel = (id, lab, val, opts, free) => opts.length
    ? `<div class="row"><label class="lab" for="${id}">${lab}</label><select id="${id}" class="ia-sel">${opts.map(o => `<option value="${esc(o)}"${String(o) === String(val) ? ' selected' : ''}>${esc(o)}</option>`).join('')}${free ? `<option value="__free"${val && !opts.includes(val) ? ' selected' : ''}>직접 적기</option>` : ''}</select></div>`
    : `<div class="row"><label class="lab" for="${id}">${lab}</label><input id="${id}" class="ia-in" value="${esc(val)}" autocomplete="off"></div>`;
  return `<fieldset class="ia-cfg"><legend>견적 사양</legend>
    ${sel('ia-size', '호칭', s.size, rows.map(r => r[0]), false)}
    ${lens.length ? sel('ia-len', `길이 (${f.sys === 'inch' ? 'in' : 'mm'})`, s.L, ['', ...lens.map(String)], false) : (/pin|key|rivet|stud|rod|bolt|screw|hexbolt|shcs|fhcs|bhcs|setscrew|machinescrew|anchor/.test(f.eng) ? `<div class="row"><label class="lab" for="ia-len">길이</label><input id="ia-len" class="ia-in" value="${esc(s.L)}" placeholder="${f.sys === 'inch' ? '예: 2-1/2' : '예: 30'}" autocomplete="off"></div>` : '')}
    ${sel('ia-mat', '재질·강도', s.mat, f.mats, false)}
    ${sel('ia-fin', '표면처리', s.fin, f.fins, false)}
    <div class="row ia-qrow2"><label class="lab" for="ia-qty">수량</label><span><input id="ia-qty" class="qty" type="number" min="1" step="1" inputmode="numeric" value="${s.qty}"><select id="ia-unit" class="ia-sel" aria-label="단위">${['EA', 'SET', 'BOX'].map(x => `<option${x === s.unit ? ' selected' : ''}>${x}</option>`).join('')}</select></span></div>
    <div class="row"><label class="lab" for="ia-memo">메모 (선택)</label><input id="ia-memo" class="ia-in" value="${esc(s.memo)}" placeholder="필요한 서류·코팅·납기 조건" autocomplete="off"></div>
    <p class="ia-spec-out mono" id="ia-spec-out" aria-live="polite">${esc(iaSpecText(f, s))}</p>
    <div class="ia-tiers-q" aria-hidden="true"><span>견적 후 확정</span><span>견적 후 확정</span><span>견적 후 확정</span><span>견적 후 확정</span></div>
    <p class="small muted">수량별 단가는 사양 확인 뒤 회신합니다. ${PRICE_ON(f.id) ? `${PRICE_LAB()} 기준일 ${esc(SHOP.priceBasis)}.` : '공급처 단가 확인 전이라 가격을 적지 않았습니다.'}</p>
    <div class="ia-ship"><span class="tag q">견적</span><b>${esc(f.tier || '견적 문의')}</b><span class="t">${SHOP.leadRange[f.id] ? `납기 참고 ${esc(SHOP.leadRange[f.id])}영업일 · 견적 시 확정` : '납기는 공급처 확인 뒤 견적서에 안내합니다'}</span></div>
    <div class="actions"><button class="btn pri" type="button" id="ia-add">견적함에 담기</button><a class="btn" href="#custom" data-go="custom">도면 첨부해 요청</a></div>
  </fieldset>`;
}
V.c = id => {
  const f = CAT_F[id]; if (!f) return V.products();
  const t = iaTile(f.t), s = iaSelOf(f), dw = iaDrawSvg(f, s);
  const sub = t && t.subs.find(x => x.id === f.sg);
  const stdrow = f.std.length ? `<div class="stdrow ia-stdrow">${f.std.slice(0, 5).map(([k, v], i) => `<div${i === 0 ? ' class="on"' : ''}><span class="lab">${esc(k)}${i === 0 ? ' 기준' : ''}</span><b>${esc(iaStdCut(v))}</b></div>`).join('')}</div>` : '';
  const safety = f.safety ? note(f.safety[0], esc(f.safety[1]), f.safety[0] === 'crit' ? '불가' : '안전') : '';
  // naText는 조건부 안내(제조사 품번·상표가 지정된 줄): 품목 자체는 사양을 적어 견적 요청할 수 있다
  const na = f.naText ? note('warn', esc(f.naText), '안내') : '';
  const notes = (f.notes.length ? `<div class="fnote"><h3>이 품목에서 자주 확인하는 것</h3><dl>${f.notes.map(n => `<dt${n.red ? ' class="redp"' : ''}>${esc(n.t || '확인')}</dt><dd>${esc(n.d)}</dd>`).join('')}</dl></div>` : '') + libProductLinks(f.id);
  const docs = (() => { try { return cadTrustLine({ fam: f.id, cat: f.g, system: f.sys === 'inch' ? 'inch' : 'metric' }); } catch { return '제조사 MTR(EN 10204 3.1) 제공 여부: 공급처 확인 중 — 견적 시 회신'; } })();
  const kv = [['규격', f.std.map(x => x[1]).join(' · ')], ['체계', f.sys === 'inch' ? '인치' : f.sys === 'both' ? '미터·인치' : '미터'], ['공급 구분', f.tier || '견적 문의'], ['서류', `CoC 기본 · ${docs}`], ...(f.use ? [['용도', f.use]] : []), ...(f.quoteNote ? [['견적', f.quoteNote]] : [])];
  const mode = f.p === 'A' ? (f.dims ? '치수표 · 도면' : '사양 견적') : f.p === 'B' ? '사양 견적' : '인식 후 견적';
  const cad = f.p === 'A' ? `<div class="cad-blk ia-cad" id="ia-cad">${iaCadFam(f) ? '' : `<section class="cad-blk-in"><div class="cad-hd"><h3>CAD · 데이터시트</h3><span class="tag doc">도면 기반 검토</span></div><p class="note warn small"><span class="nk">제공 범위</span><span>이 품목은 자동 STEP·DXF 다운로드 대상이 아닙니다. 고객 도면과 규격 번호로 요구 형상을 검토합니다.</span></p></section>`}</div>` : '';
  return sheet(zone('A', 'z-a', shd({ trail: [['제품', 'products'], ...(t ? [[t.ko, 't-' + t.id]] : []), [f.ko]], no: 'P', title: `${esc(f.ko)}<span class="h-en" lang="en">${esc(f.en)}${f.enStd ? ` <span class="tag en-std">${esc(f.enStd)}</span>` : ''}</span>`, p: `${sub ? esc(sub.ko) + ' · ' : ''}${mode}${f.use ? ' · ' + esc(f.use) : ''}`, right: stdrow, below: safety + na })
    + `<div class="fam ia-cfam"><div class="fam-l"><div id="shp-slot"></div><div class="dbox" id="ia-draw">${iaDwBox(f, s, dw)}</div><dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${f.mats.length || f.fins.length ? `<p class="small muted">재질·강도: ${esc(f.mats.join(' · ') || '견적 시 확인')} │ 표면처리: ${esc(f.fins.join(' · ') || '견적 시 확인')}</p>` : ''}${notes}${cad}</div>
      <div class="fam-r">${iaCfgHTML(f, s)}</div></div>`, 'ia-z')
    + (f.p === 'A' ? zone('B', 'z-b', `<div class="listbar"><h2 id="h-z-b" tabindex="-1">치수표</h2></div>${iaDimsHTML(f, s)}`) : '')
    + zone(f.p === 'A' ? 'C' : 'B', f.p === 'A' ? 'z-c' : 'z-b', `<div class="listbar"><h2>서류·납기</h2></div><p class="small">${esc(CAD_TRUST_COPY ? CAD_TRUST_COPY.always.ko : '')}</p><p class="small muted">재고를 두지 않습니다. 주문마다 국내 도매처에서 조달하고, 납기는 공급처를 확인한 뒤 견적서에 적습니다.</p>`));
};
V.after.c = id => {
  const f = CAT_F[id]; if (!f) return;
  const s = iaSelOf(f);
  shapeShow(f.id, f.ko, s.mat, s.fin);
  const upd = (redrawDw = true) => {
    const o = $('ia-spec-out'); if (o) o.textContent = iaSpecText(f, s);
    if (redrawDw) { const d = $('ia-draw'), svg = iaDrawSvg(f, s); if (d) d.innerHTML = iaDwBox(f, s, svg); document.querySelectorAll('[data-ia-size]').forEach(tr => { const on = tr.dataset.iaSize === s.size; tr.classList.toggle('on', on); if (on) tr.setAttribute('aria-current', 'true'); else tr.removeAttribute('aria-current'); }); iaCadMount(f, s); }
  };
  view().addEventListener('change', e => {
    const k = { 'ia-size': 'size', 'ia-len': 'L', 'ia-mat': 'mat', 'ia-fin': 'fin', 'ia-unit': 'unit' }[e.target.id];
    if (k) { s[k] = e.target.value === '__free' ? '' : e.target.value; upd(k === 'size' || k === 'L'); if (k === 'mat' || k === 'fin') { state.shapePick[f.id] = null; shapeShow(f.id, f.ko, s.mat, s.fin); } }
    if (e.target.id === 'ia-qty') { s.qty = Math.max(1, Math.round(+e.target.value || 1)); e.target.value = s.qty; }
  });
  view().addEventListener('input', e => { if (e.target.id === 'ia-memo' || (e.target.id === 'ia-len' && e.target.tagName === 'INPUT')) { s[e.target.id === 'ia-memo' ? 'memo' : 'L'] = e.target.value.trim(); upd(e.target.id === 'ia-len'); } });
  view().addEventListener('click', e => {
    const tr = e.target.closest('[data-ia-size]');
    if (tr) { s.size = tr.dataset.iaSize; const se = $('ia-size'); if (se) se.value = s.size; upd(true); return; }
    if (e.target.closest('#ia-add')) {
      const q = Math.max(1, Math.round(+($('ia-qty') || {}).value || s.qty || 1)); s.qty = q;
      if (q > CART_QTY_MAX) { toast(`한 줄 수량은 ${CART_QTY_MAX.toLocaleString()}개까지 담습니다. 더 많으면 견적 요청서로 보내 주세요.`); return; }
      addQuote({ fam: f.id, title: f.ko, en: f.en, spec: iaSpecText(f, s), qty: q, unit: s.unit === 'SET' ? '세트' : s.unit === 'BOX' ? 'BOX' : 'EA' });
      toast(`견적함에 견적 줄을 담았습니다 · ${f.short || f.ko}`);
    }
  });
  iaCadMount(f, s);
  if (state.iaSpecFocus) { state.iaSpecFocus = false; ($('ia-size') || $('ia-memo'))?.focus({ preventScroll: false }); }
};
document.addEventListener('click', e => { if (e.target.closest('[data-ia-spec]')) state.iaSpecFocus = true; }, true);
// 새 품목 CAD: 원문 대조 치수가 기존 생성기(육각 너트·평와셔)에 그대로 맞는 것만. 나머지는 'CAD 준비 중'
function iaCadMount(f, s) {
  const el = $('ia-cad'); if (!el || !IA_CAD_NEW[f.id] || typeof CAD_G === 'undefined' || typeof cadBlockHtml !== 'function') return;
  const spec = iaCadSpec(f, s); let built = null, sp = spec;
  if (sp.ok) { try { built = cadBuild(sp); } catch { sp = { ok: false, code: 'nogen', msg: 'CAD 준비 중', fam: f.id }; } }
  CAD_ST.spec = sp; CAD_ST.built = built; CAD_ST.ctx = { f: { id: f.id } };
  el.innerHTML = cadBlockHtml(sp, built);
  // A4 데이터시트·규격표는 기존 26개 품목 장 전용 (치수표·질량식이 그 품목 자료에 묶여 있음): 새 품목은 STEP·DXF·zip·BOM 문구만
  el.querySelectorAll('[data-cad="print"], [data-cad="dshtml"], [data-cad="table"]').forEach(x => x.remove());
  el.querySelector('.cad-hint')?.remove();
  const hd = el.querySelector('#cad-h'), tg = el.querySelector('.cad-hd .tag.doc'); if (hd) hd.textContent = 'CAD'; if (tg) tg.textContent = 'STEP · DXF';
  el.querySelector('.cad-btns')?.insertAdjacentHTML('afterend', '<p class="small muted">제공 형식: STEP·DXF. A4 데이터시트는 이 품목의 제공 범위에 포함되지 않습니다.</p>');
  if (!el.dataset.cadOn) { el.dataset.cadOn = '1'; el.addEventListener('click', cadOnClick); }
}
function iaCadSpec(f, s) {
  const no = msg => ({ ok: false, code: 'nodata', msg: msg || CAD_MSG.nodata, fam: f.id });
  const size = s.size, d = iaMetricD(size), P = iaNum(iaColVal(f, size, 'pitch')) || DIM.pitch[size], nut = IA_CAD_NEW[f.id] === 'nut';
  if (!(d > 0) || (nut && !(P > 0))) return no();
  const fmt = cadMmTxt, th = `${size}x${+P}-6H`, thName = 'BN_THREAD_' + th.toUpperCase();
  let part, origin, simp, std, desig, en = f.en;
  if (IA_CAD_NEW[f.id] === 'nut') {
    const sw = iaColVal(f, size, 's'), m = iaColVal(f, size, 'm'), dw = iaColVal(f, size, 'dw_min');
    if (!(sw > 0 && m > 0 && dw > 0)) return no();
    part = CAD_G.make('hexNut', { D: d, P, s: sw, m, dw, fmt, thLab: th.toUpperCase(), thName });
    origin = CAD_ORIGIN.nut; std = 'ISO 4035'; desig = 'Hexagon thin nut';
    simp = [['너트 구멍 = 호칭 지름 D, 양면 30° 모따기 원 = 좌면 지름 dw 최소', 'Nut bore at nominal D; both 30° chamfers end at dw min']];
  } else {
    const d1 = iaColVal(f, size, 'd1'), d2 = iaColVal(f, size, 'd2'), h = iaColVal(f, size, 'h');
    if (!(d1 > 0 && d2 > d1 && h > 0)) return no();
    part = CAD_G.make('washer', { d1, d2, h, fmt }); origin = CAD_ORIGIN.washer; std = 'ISO 7093-1'; desig = 'Plain washer, large series';
    simp = [['모서리 모따기·버 생략', 'No edge chamfers']];
  }
  const stem = 'BN_' + cadSafe(`${f.id.toUpperCase()}-${size}`), lenKo = size;
  const desigEn = `${desig} ${std} - ${size}`;
  return { ok: true, sys: 'm', fam: f.id, f: { id: f.id, name: f.ko }, quote: true, pn: stem.slice(3), stem, size, L: null, g: '', fin: '', nameKo: f.ko, nameEn: en, std, stdAll: std,
    gradeLabel: '', finLabel: '', desigEn, desigKo: `${f.ko} ${std} ${lenKo}`, thread: IA_CAD_NEW[f.id] === 'nut' ? th : '—', origin, simp, rowTk: null, dimSrc: `${std} (catalog/data, 원문 대조 행)`, src: [std],
    bom: [stem, `${f.ko} / ${en}`, `${std} ${lenKo}`].join('\t'),
    parts: [{ key: 'main', label: '', stem, part, origin, desc: `${desigEn}; simplified model`, color: CAD_FIN_RGB.ZW, titleEn: desigEn }] };
}

// 시험용: 새 품목 CAD (원문 대조 행 → 생성기). 모든 호칭을 만들어 파일 문자열을 돌려준다 (out_h/work/cadnew.py가 OCC·ezdxf로 검사)
window.__iaTest = { cadNew: () => Object.keys(IA_CAD_NEW).flatMap(id => { const f = CAT_F[id]; return iaRows(f).map(r => { const sp = iaCadSpec(f, { size: r[0] }); if (!sp.ok) return { id, size: r[0], ok: false, msg: sp.msg };
  const b = cadBuild(sp), x = b.files[0]; return { id, size: r[0], ok: true, stem: sp.stem, kind: x.part.part.kind, p: { ...x.part.part.p, fmt: undefined }, vol: x.vol, step: x.step.text, dxf: x.dxf.text, stepName: x.step.name, dxfName: x.dxf.name }; }); }) };
/* ───────── 7. 목록 견적 · 도면·규격 · 규격 노트 · 회사 소개 ───────── */
V.list = () => iaPage(iaHead([['목록 견적']], '목록 보내고 견적 받기', 'Send a List for Quotation',
  '엑셀·PDF·사진·메일 본문 그대로 보내 주세요. 줄마다 가격·납기·서류 계획을 적어 답합니다.', ORDER_LIVE ? '' : '<p class="ia-pencil">검증 운영 중: 참고 견적을 드립니다. 정식 견적과 주문은 확인 메일로 이어집니다.</p>')
  + `<div class="ia-two${SHOP.listPrimary === 'paste' ? ' rev' : ''}"><div class="ia-col"><h2 class="ia-h2"><span class="ia-bal sm">A</span>보내기 (메일·카카오톡)</h2><div id="ia-filep" class="ia-filep-w">${iaFilePanel()}</div></div>
    <div class="ia-col"><h2 class="ia-h2"><span class="ia-bal sm">B</span>보내기 전에 미리 보기 (선택)</h2>${sbBox('list')}</div></div>
  <div class="ia-box thin ia-recv"><p><span class="lab">받으시는 것</span>1 견적서 (줄마다 단가·납기 범위·서류 계획) · 2 C&amp;D 1장 · 3 공급 불가 목록 <button class="btn sm txt" type="button" data-ia-sample="1">견적서 견본 보기 →</button></p>
    <p><span class="lab">회신</span>${esc(SLA().recv)}. 20줄 이하는 ${SLA().days}영업일 안에 견적합니다.</p>
    <p class="redp"><span class="lab">받지 않는 품목</span>원자력 Q·A등급, 선급, 항공·방산, PED 주요 부품</p>
    <p><a href="#custom" data-go="custom">카탈로그에 없는 모양·길이·해외 규격 → 도면·사양서로 요청</a> · <a href="#bom" data-go="bom">목록 줄마다 자세히 보기 (엔지니어 화면) →</a></p></div>`);
V.after.list = () => {
  sbInit('list');
  view().addEventListener('click', e => {
    if (e.target.closest('[data-ia-sample]')) { bomNewText(BOM_SAMPLE, true); state.bom.doc = 'quote'; bomSave(); go('quote'); return; }
    const f = e.target.closest('[data-ia-file]'); if (f) $('ia-filep')?.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  });
};
V.ref = () => iaPage(iaHead([['도면·규격']], '도면·규격 보기', 'Drawings and Standards', '치수 도면, 각인·표기 읽기, 규격 대조표, 플랜지 계산을 가입 없이 씁니다.')
  + `<section class="ia-rsec"><h2 class="ia-h2">도면·CAD</h2><div class="ia-rtiles">${CAT_TILES.map(t => `<a href="#t-${t.id}" data-go="t-${t.id}">${iaTh(IA_TH_TILE[t.id], 64, 40)}<span>${esc(t.ko)}</span></a>`).join('')}</div>
    <p class="small muted">기존 ${typeof CAD_FAM !== 'undefined' ? Object.keys(CAD_FAM).length : 26}개 품목은 품목 페이지에서 치수 도면과 STEP·DXF·A4 데이터시트를 받습니다. 새 품목은 원문 대조를 마친 치수표부터 싣고, 생성기에 맞는 품목(지금 ${Object.keys(IA_CAD_NEW).length}종)은 STEP·DXF도 받습니다. 그 밖의 품목은 고객 도면으로 요구 형상을 검토합니다. DWG는 제공하지 않습니다. DXF R12는 AutoCAD에서 바로 열립니다.</p></section>
  <section class="ia-rsec" id="ia-dec"><h2 class="ia-h2">표기·사양 읽기</h2><p class="small muted">해외 도면·사양서의 한 줄을 항목별로 나누고, 빠진 칸은 빗금으로, 맞지 않는 조합은 검토 의견으로 표시합니다. 이 화면 안에서만 읽습니다.</p>
    <div class="dec-in"><label class="sr" for="dec-in">사양 표기</label><input id="dec-in" value="${esc('1-1/8"-7 UNC-2A x 6-1/2" ASTM A193 B7 / 2H HDG')}" spellcheck="false" autocomplete="off"><button class="btn pri" type="button" id="dec-go">읽기</button></div>
    <div class="dec-ex" id="dec-ex"></div><div class="dec-out" id="dec-out" aria-live="polite"></div>
    <div class="actions"><button class="btn sm" type="button" id="ia-dec-add">이 줄을 견적함에 담기</button></div></section>
  <section class="ia-rsec"><h2 class="ia-h2">계산·대조표</h2><div class="ia-tools">${[['flange', '플랜지 스터드 길이 (B16.5)'], ...(API610_TOOL ? [['api610', 'API 610 펌프 볼트']] : []), ['str', '강도 등급 대조'], ['din', 'DIN↔ISO 2면폭'], ['conv', '인치↔mm'], ['mark', '머리 마킹 읽기'], ['plate', '표면처리 기호'], ['cert', '3.1 성적서 읽는 법'], ['mat', '재질 대조'], ['std', '규격 대조'], ['plant', '플랜트 볼팅 성질표']].map(([k, t]) => `<a href="#tools" data-go="tools" data-tab="${k}">${t}</a>`).join('')}</div></section>
  <section class="ia-rsec"><h2 class="ia-h2">규격 노트 <span class="small muted" id="ia-notes-new"></span></h2><ol class="ia-notesl">${NOTES.slice().sort((a, b) => b.no - a.no).slice(0, 3).map(n => `<li><span class="mono">${esc(n.date || '')}</span><span><b>${esc(n.std || '')}</b> ${esc(String(n.txt || '').replace(/<[^>]+>/g, ''))}</span></li>`).join('')}</ol><p class="small"><a href="#notes" data-go="notes">${NOTES.length}건 모두 보기 →</a> · 틀린 곳을 알려 주시면 확인해 고칩니다.</p></section>`);
V.after.ref = () => {
  decInit();
  if (state.decPrefill) applyDecPrefill();
  $('ia-dec-add').addEventListener('click', () => { const v = ($('dec-in') || {}).value || ''; if (!v.trim()) return; const r = decode(v); addQuote({ fam: '', title: '사양 한 줄 (표기 읽기)', spec: v.trim(), qty: (r.pre && +r.pre.qty) || 1, unit: 'EA' }); toast('견적함에 견적 줄을 담았습니다'); });
  const seen = store.get('notesSeen', null), n = typeof seen === 'number' ? NOTES.filter(x => x.no > seen).length : 0, el = $('ia-notes-new'); if (el && n) el.textContent = `새 노트 ${n}건`;
};
V.notes = () => iaPage(iaHead([['도면·규격', 'ref'], ['규격 노트']], '규격 노트', 'Standards Notes', '바뀐 규격과 자주 틀리는 표기를 기록합니다. 틀린 곳을 알려 주시면 확인해 고칩니다.')
  + `<div class="tblw bare"><table class="revt" id="revt"><thead><tr><th>번호</th><th>기록일</th><th>규격 · 판</th><th>내용</th><th>볼트노트 처리</th><th>구역</th></tr></thead><tbody id="revt-b"></tbody></table></div>
<p class="rev-msg" id="rev-msg"></p>
<button class="btn sm rev-more" type="button" id="rev-more" aria-controls="revt" aria-expanded="false">노트 전체 보기 (${NOTES.length}건)</button>`);
V.after.notes = () => revInit();
V.about = () => {
  const h = V.help(), i = h.indexOf('<section class="zone', h.indexOf('<section class="zone') + 1);
  const rules = zone('R', 'z-r', homeG().replace('<span class="zl" aria-hidden="true">G</span><h2 id="h-z-g"', '<span class="zl" aria-hidden="true">R</span><h2 id="h-z-r"'), 'tight');
  return i > 0 ? h.slice(0, i) + rules + h.slice(i) : h;
};
V.after.about = () => V.after.help();
function iaAboutTop() {
  return `<div class="ia-about tblock">
    <div class="s2"><span class="lab">누가</span><span>${iaOwner()} · 기계엔지니어 · 회전기기 분야 ${iaYears()}년. 혼자 운영합니다. 그래서 모든 견적 줄을 대표가 직접 봅니다.</span></div>
    <div class="s2 e"><span class="lab">운영 방식</span><span>검증 운영 중입니다: 참고 견적을 드리고, 주문은 확인 메일을 주고받은 뒤에 됩니다. 재고를 두지 않고 주문마다 국내 도매처에서 조달합니다. 플랜트 품목은 대표가 받아 각인·히트번호·서류를 대조한 뒤 출고합니다.</span></div>
    <div class="s2"><span class="lab">회신 약속</span><span>${esc(SLA().recv)}. 20줄 이하는 ${SLA().days}영업일 안에 견적합니다. 답이 없으면 카카오톡으로 요청번호를 보내 주세요.</span></div>
    <div class="s2 e"><span class="lab">서류</span><span>${iaDocsLine(false)} ${esc(CAD_TRUST_COPY.always.ko)}.</span></div>
    <div class="s2"><span class="lab">합니다</span><span>사양·짝 부품·서류를 줄마다 확인 · 공급 불가 줄은 이유와 함께 적음 · 바뀐 점은 확인 메일에 적고 그때 취소 가능</span></div>
    <div class="s2 e redp"><span class="lab">하지 않습니다</span><span>당일 출고 약속 · 승인 없는 대체품 · 3.1 직접 발행 · 받은 도면 공개 · 원자력·선급·항공 품목</span></div>
    <div class="s4 e"><span class="lab">대금·사업자 서류</span><span>계좌이체(확인 메일을 받은 뒤) · 카드는 요청 시 결제 링크 · 전자세금계산서. 사업자등록증·통장 사본은 요청하시면 메일로 드립니다. 사업자등록번호 ${iaBizNo()} · ${iaMailOrder()} · ${iaBizLink()}</span></div>
  </div>`;
}
function iaCartLead() {
  return `담은 품목을 견적 요청서로 보냅니다. ${PRICE_ANY() ? `${PRICE_LAB()}가 표시된 줄은 ${ORDER_DOC()}로도 보낼 수 있습니다.` : '품목 단가를 공급처와 확인하고 있어 지금은 모든 줄을 견적으로 받습니다.'} 이 화면에서는 결제하지 않습니다. 입금은 확인 메일을 받은 뒤에 합니다.`;
}

/* 4A 작업대 위 나눔 막대 (명세 12.3, 보기만) + 버튼 2개 */
function iaWbBar() {
  let c; try { c = bomCompute(); } catch { return ''; }
  if (!c || !c.L || !c.L.length) return '';
  const s = c.sum, priced = s.cat.filter(v => v.x.m.price != null), rest = s.cat.length - priced.length + s.eq.length;
  return `<div class="ia-wb"><div class="ia-wbbar" role="group" aria-label="목록 나눔">${priced.length ? `<span>${PRICE_LAB()} ${priced.length}줄</span>` : ''}<span class="q">견적 ${rest}줄</span><span>확인 필요 ${s.need.length}줄</span>${s.na.length ? `<span class="x">공급 불가 ${s.na.length}줄</span>` : ''}</div>
    <div class="actions"><button class="btn pri" type="button" data-ia-wbrq="1">견적 요청서 만들기 (${s.cat.length + s.eq.length}줄)</button>${priced.length && SHOP.quickOrder ? `<button class="btn" type="button" data-ia-wbpo="1">${PRICE_LAB()} ${priced.length}줄 → ${ORDER_DOC()}</button>` : ''}</div></div>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-ia-wbrq]')) { go('quote'); setTimeout(() => { const b = document.querySelector('[data-q="send"]'); if (b) { b.click(); setTimeout(() => $('qd-send')?.scrollIntoView({ block: 'start' }), 60); } }, 30); return; }
  if (e.target.closest('[data-ia-wbpo]')) { let n = 0; try { bomCompute().sum.cat.filter(v => v.x.m.price != null && v.x.m.pn).forEach(v => { if (addItem(v.x.m.pn, v.x.m.qty || 1)) n++; }); } catch {} toast(`견적함에 ${n}줄을 담았습니다`); go('cart'); }
});

/* 화면의 장 번호 참조('→ 4장', '6장 D' …)를 페이지 이름으로 (명세 8.1·16.2). 문서·내보내기 파일은 그대로. 새로 그려지는 화면 글자에만.
   신고 전(ORDER_LIVE false)에는 고객 주문 문서를 가리키는 '발주서'도 '주문서'로 (17.3 AC-L2: 신고 전 화면에 '발주서' 0회). 신고 뒤에는 원문 그대로 */
const IA_SHEET_RX = [[/→\s*4A장/g, '→ 목록 줄마다 보기'], [/4A장 D 구역에서/g, '목록 화면의 발행 칸에서'], [/4A장(?: BOM)? (견적|작업)/g, '목록 견적 화면'], [/4A장에서/g, '목록 화면에서'],
  [/→\s*[23]장/g, '→ 제품'], [/→\s*4장/g, '→ 도면·사양서로 요청'], [/→\s*5장/g, '→ 계산·대조표'], [/→\s*6장/g, '→ 회사 소개'], [/→\s*7장/g, '→ 견적함'], [/7장 →/g, '견적함 →'],
  [/5장 상세 (\d+)/g, '계산·대조표 상세 $1'], [/6장 품질 서류/g, '회사 소개의 품질 서류'], [/6장 고객지원/g, '회사 소개'], [/6장 안내/g, '회사 소개 안내'], [/6장 ([A-H])(?![A-Za-z])/g, '회사 소개 $1'],
  [/4장 요청서/g, '도면·사양서 요청서'], [/4장 견적 요청서/g, '도면·사양서 요청서'], [/3장 C(?![A-Za-z])/g, '플랜트 볼팅 모음'], [/4A장 BOM 화면/g, '목록 줄마다 보기 화면']];
const IA_PO_RX = ORDER_LIVE ? [] : [[/요청서·발주서 칸/g, '견적 요청서·주문 요청서 칸'], [/발주서/g, '주문서']];
const iaUnSheetText = t => IA_PO_RX.reduce((a, [rx, r]) => a.replace(rx, r), IA_SHEET_RX.reduce((a, [rx, r]) => a.replace(rx, r), t));
const iaNeedsRw = v => !!v && (v.includes('장') || (!ORDER_LIVE && v.includes('발주서')));
function iaUnSheetNode(n) {
  if (n.nodeType === 3) { const v = n.nodeValue; if (iaNeedsRw(v) && !n.parentElement?.closest('.qd-doc-w, .rfq-doc, #doc, textarea')) { const nv = iaUnSheetText(v); if (nv !== v) n.nodeValue = nv; } return; }
  if (n.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.nodeName) || n.closest?.('.qd-doc-w, .rfq-doc, #doc')) return;
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT); let x;
  while ((x = w.nextNode())) { const v = x.nodeValue; if (iaNeedsRw(v) && !x.parentElement?.closest('.qd-doc-w, .rfq-doc, #doc, textarea')) { const nv = iaUnSheetText(v); if (nv !== v) x.nodeValue = nv; } }
}
if ('MutationObserver' in window) new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') iaUnSheetNode(m.target); else m.addedNodes.forEach(iaUnSheetNode); } })
  .observe(document.body, { childList: true, subtree: true, characterData: true });

/* ───────── 8. 머리글 메뉴(폰) · 바닥글 · 검색 색인 ───────── */
function iaMenuHTML() {
  return `<div class="ia-mdoors"><a href="#list" data-go="list">① 목록 보내고 견적 받기</a>${SHOP.quickOrder ? '<a href="#buy" data-go="buy">② 규격품 바로 주문</a>' : ''}<a href="#ref" data-go="ref">${SHOP.quickOrder ? '③' : '②'} 도면·규격 보기</a>${typeof LIB !== 'undefined' && LIB.length ? `<a href="#lib" data-go="lib">${SHOP.quickOrder ? '④' : '③'} 체결부품 규격 사전</a>` : ''}</div>
    <div class="ia-chips2">${CAT_TILES.map(t => `<a href="#t-${t.id}" data-go="t-${t.id}">${esc(t.ko)}</a>`).join('')}</div>
    <p><a class="bluep" href="#k-plant" data-go="k-plant"><b>${esc(CAT_COLL.plant.ko)} →</b></a> · <a href="#products" data-go="products">모아 보기 전체 →</a></p>
    <p class="small muted"><a href="#about" data-go="about">회사 소개</a> · 메일 ${rfqC('rfq')} · 카카오톡 ${rfqC('kakaoChat')} · 전화 ${rfqC('tel', { link: true })}</p>`;
}
function iaMenu(open) {
  const b = $('ia-menu-b'), m = $('ia-menu'); if (!b || !m) return;
  if (open) m.innerHTML = iaMenuHTML();
  m.hidden = !open; b.setAttribute('aria-expanded', String(open));
}
$('ia-menu-b').addEventListener('click', () => iaMenu($('ia-menu').hidden));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('ia-menu').hidden) { iaMenu(false); $('ia-menu-b').focus(); } });
// 바닥글·상태 칸: 스위치 값으로 채운다 (빈 값이면 .ph 그대로)
if (SHOP.ownerName) document.querySelectorAll('[data-ia="owner"]').forEach(el => { el.outerHTML = esc(SHOP.ownerName); });
if (SHOP.bizNo) document.querySelectorAll('[data-ia="bizno"]').forEach(el => { el.outerHTML = `<span class="mono">${esc(SHOP.bizNo)}</span>`; });
if (SHOP.addr) document.querySelectorAll('[data-ia="addr"]').forEach(el => { el.lastElementChild.textContent = SHOP.addr; el.hidden = false; });
document.querySelectorAll('[data-ia="mailorder"]').forEach(el => { el.innerHTML = iaMailOrder() + (ORDER_LIVE ? ` · ${iaBizLink()}` : ''); });
if (ORDER_LIVE) { const st = $('ia-stc'); if (st) st.hidden = true; }
// 검색 색인: 옛 홈 구역 항목을 새 경로로, 165종 품목·칸·모음·새 페이지를 더한다
INDEX.forEach(e => {
  if (e.go === 'home' && e.jump && Object.hasOwn(IA_ZONE, e.jump)) { e.go = IA_ZONE[e.jump]; e.jump = null; }
  if (e.go === 'inch' && e.zone === 'z-c') e.go = 'k-plant';   // 사용 조건 표는 플랜트 볼팅 모음 C 구역
  if (e.go === 'inch' && !e.zone) e.go = 'k-plant';
  if (e.go === 'help') e.go = 'about';
  if (e.go === 'custom' && e.t === '주문제작·해외규격 견적') e.t = '도면·사양서로 요청 (주문제작·해외규격)';
  if (e.go === 'bom') e.t = '목록 줄마다 보기 (엔지니어 화면)';
});
Object.values(CAT_F).filter(f => !f.route).forEach(f => INDEX.push({ t: f.ko, s: `${f.en} · ${(f.std[0] || [])[1] || ''}`.slice(0, 90), k: (f.kw + ' ' + f.std.map(x => x[1]).join(' ')).toLowerCase(), go: 'c-' + f.id, g: f.sys === 'inch' ? '인치·플랜트' : '규격품' }));
CAT_TILES.forEach(t => INDEX.push({ t: t.ko, s: `제품 · ${iaTileN(t)}종`, k: `${t.ko} ${t.en} ${t.subs.map(s => s.ko).join(' ')}`.toLowerCase(), go: 't-' + t.id, g: '도구·안내' }));
Object.entries(CAT_COLL).forEach(([k, c]) => INDEX.push({ t: c.ko, s: '모아 보기', k: `${c.ko} ${c.en} 모음`.toLowerCase(), go: 'k-' + k, g: '도구·안내' }));
[['목록 보내고 견적 받기', '엑셀·PDF·사진 그대로', '목록 견적 엑셀 파일 사진 보내기 bom 리스트 부품표', 'list'], ['도면·규격 보기', '도면 · 표기 읽기 · 계산', '도면 cad step dxf 데이터시트 규격 표기 읽기', 'ref'], ['규격 노트', '바뀐 규격과 자주 틀리는 표기', '규격 노트 개정 변경', 'notes'], ['회사 소개', '누가 · 운영 방식 · 사업자 서류', '회사 소개 사업자 서류 사업자등록증 통장 사본 대표', 'about'], ['규격품 바로 주문', '주문 요청서', '바로 주문 주문 요청서 발주', 'buy']]
  .forEach(([t, s, k, go]) => INDEX.push({ t, s, k, go, g: '도구·안내' }));
