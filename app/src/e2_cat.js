
/* ── BOM 카탈로그 확장: 미터 멈춤나사 + 인치 규격품 (예시 단가) ──
   형번: 코드-호칭-길이-등급-표면처리. 인치 호칭 코드는 지름 1/1000 in 네 자리 + 계열(C=UNC, F=UNF, U=8UN, W=와셔, R=스프링와셔),
   인치 길이는 1/1000 in 정수. 예) ISSC-0375C-500-F912-BO = 3/8-16 UNC × 1/2" 컵 포인트 F912 흑착색 */
Object.assign(GRADE, {
  S45H: { label: '45H', desc: '합금강 소입·소려, 약 45–53 HRC', mult: 1, std: 'ISO 898-5' },
  SSA2: { label: 'A2-21H', desc: 'SUS304 계열 스테인리스', mult: 2.6, std: 'ISO 3506-3' },
  SSA4: { label: 'A4-21H', desc: 'SUS316 계열 스테인리스', mult: 3.9, std: 'ISO 3506-3' },
  F912: { label: 'ASTM F912', desc: '합금강, 심부 45–53 HRC', mult: 1.25, std: 'ASTM F912' },
  F880: { label: 'ASTM F880 18-8', desc: '오스테나이트 스테인리스 (303·304 계열)', mult: 2.7, std: 'ASTM F880' },
  F880M: { label: '316 (F880 치수·시험 준용)', desc: '316 스테인리스. F880 합금 목록에는 316이 없어 성적서 표기를 확인', mult: 4, std: 'ASTM F880' },
  A574: { label: 'ASTM A574', desc: '합금강, 1/2" 이하 180 ksi · 초과 170 ksi', mult: 1.3, std: 'ASTM A574' },
  F837: { label: 'ASTM F837 18-8', desc: '스테인리스 (304 계열)', mult: 2.7, std: 'ASTM F837' },
  F837M: { label: 'ASTM F837 316', desc: '스테인리스 316', mult: 4, std: 'ASTM F837' },
  F835: { label: 'ASTM F835', desc: '합금강 (버튼·접시머리)', mult: 1.3, std: 'ASTM F835' },
  F879: { label: 'ASTM F879 18-8', desc: '스테인리스 (304 계열)', mult: 2.7, std: 'ASTM F879' },
  F879M: { label: 'ASTM F879 316', desc: '스테인리스 316', mult: 4, std: 'ASTM F879' },
  J5: { label: 'SAE J429 Grade 5', desc: '중탄소강 소입·소려, 머리 방사선 3줄', mult: 1, std: 'SAE J429' },
  J8: { label: 'SAE J429 Grade 8', desc: '합금강 소입·소려, 머리 방사선 6줄', mult: 1.3, std: 'SAE J429' },
  F5931: { label: 'ASTM F593 Group 1 CW', desc: '304 계열 스테인리스, 가공경화', mult: 2.7, std: 'ASTM F593' },
  F5932: { label: 'ASTM F593 Group 2 CW', desc: '316 스테인리스, 가공경화', mult: 4, std: 'ASTM F593' },
  J995G5: { label: 'SAE J995 Grade 5', desc: '탄소강 너트', mult: 1, std: 'SAE J995' },
  J995G8: { label: 'SAE J995 Grade 8', desc: '열처리 너트', mult: 1.25, std: 'SAE J995' },
  A563A: { label: 'ASTM A563 Grade A', desc: '탄소강 너트 (B18.2.2 기본)', mult: .9, std: 'ASTM A563' },
  F5941: { label: 'ASTM F594 Group 1', desc: '304 계열 스테인리스 너트', mult: 2.7, std: 'ASTM F594' },
  F5942: { label: 'ASTM F594 Group 2', desc: '316 스테인리스 너트', mult: 4, std: 'ASTM F594' },
  A1942H: { label: 'ASTM A194 2H', desc: '중탄소강 소입·소려 헤비너트', mult: 1.35, std: 'ASTM A194' },
  A563DH: { label: 'ASTM A563 DH', desc: '열처리 헤비너트 (구조용·앵커)', mult: 1.3, std: 'ASTM A563' },
  B72H: { label: 'A193 B7 + A194 2H × 2', desc: 'Cr-Mo 합금강 스터드 + 헤비너트 2개', mult: 1.35, std: 'ASTM A193 / A194' },
  B7S: { label: 'ASTM A193 B7 (스터드만)', desc: 'Cr-Mo 합금강 스터드', mult: 1.3, std: 'ASTM A193' },
  F436: { label: 'ASTM F436 Type 1', desc: '전체 경화 38–45 HRC', mult: 1.4, std: 'ASTM F436' },
  LW188: { label: '18-8 스테인리스', desc: '302·304 계열 스프링 와셔', mult: 2.7, std: 'ASME B18.21.1' },
  LWCS: { label: '스프링강', desc: '탄소 스프링강 열처리', mult: 1, std: 'ASME B18.21.1' },
});
// 인치 카탈로그 표면처리. 열거되지 않게 넣는다: 홈 표면처리 범례(plgHTML)는 FINISH를 돌며 미터 기호만 보여 준다.
// short·name·note는 견적함 줄·최근 본 형번이 FINISH[fin].short를 쓰기 때문에 필요하다.
for (const [k, v] of Object.entries({
  ZY: { label: '황색아연 (3가, ASTM F1941)', short: '황색아연', name: '3가 황색아연', note: 'ASTM F1941', mult: 1.05, lead: 0 },
  HI: { label: '용융아연도금 (ASTM F2329, 너트 오버탭)', short: '용융아연', name: '용융아연도금 (인치)', note: 'ASTM F2329 · 너트 오버탭 · +5영업일', mult: 1.38, lead: 5 },
  PO: { label: '무도금 (방청유)', short: '무도금', name: '무도금 (방청유)', note: '방청유', mult: .92, lead: 0 },
})) Object.defineProperty(FINISH, k, { value: v, enumerable: false, configurable: true });

const szIn = (d, series) => String(Math.round(d * 1000)).padStart(4, '0') + ({ UNC: 'C', UNF: 'F', '8UN': 'U', W: 'W', R: 'R' }[series] || 'C');
const inOfCode = c => ({ d: +String(c).slice(0, 4) / 1000, s: { C: 'UNC', F: 'UNF', U: '8UN', W: 'W', R: 'R' }[String(c)[4]] });
const inSizes = list => list.map(([n, s]) => szIn(typeof n === 'number' ? n : inVal(n), s || 'UNC'));
const steps = (a, b, st) => { const o = []; for (let v = a; v <= b + 1e-9; v += st) o.push(Math.round(v * 1000)); return o; };
const lenPick = (list, lo, hi) => list.filter(c => c / 1000 >= lo - .002 && c / 1000 <= hi + .002);
const IN3 = 25.4 ** 3 * STEEL; // in³ → g (강)
// 치수표가 없는 인치 품목의 단가·운임 추정용 질량 (내부 근사: 호칭 지름의 비례식, 치수값이 아니며 화면에 치수로 내지 않는다. 2026-10 감사로 표 값을 뺀 품목)
const IN_EST = { headHex: d => .866 * (1.5 * d) ** 2 * .65 * d, headSock: d => Math.PI / 4 * (1.5 * d) ** 2 * d, nut: d => (.866 * (1.5 * d) ** 2 - Math.PI / 4 * d * d) * .85 * d,
  washer: d => Math.PI / 4 * ((2.1 * d) ** 2 - (1.06 * d) ** 2) * .12, lock: d => Math.PI * 1.4 * d * .4 * d * .25 * d };

function bomPrice(f, w, g, fin, qty) {
  const raw = ((f.base ?? 14) + 6.2 * w) * GRADE[g].mult * FINISH[fin].mult * (f.prem || 1);
  const tier = (TIERS.filter(t => qty >= t[0]).pop() || TIERS[0])[1];   // 수량 0·1 미만도 첫 단가 구간 (base unitPrice와 같게)
  const p = raw * tier;
  return p < 100 ? Math.max(5, Math.round(p)) : Math.round(p / 10) * 10;
}
// variantInfo의 BOM hook이 부르는 함수 (this = 품목군)
function famVi(size, L, g, fin, qty = 100) {
  const combo = this.combos.find(c => c[0] === g && c[1] === fin);
  // listed = 카탈로그 재고 표시(예시). 자체 재고 운영(페이지 OWN_STOCK)일 때만 우리 재고, 아니면 도매처 재고라 수배 일수(leadExtra)가 붙지 않는다
  const listed = !!(combo && combo[2]) && this.stockIf(size, L), stock = OWN_STOCK && listed;
  const ship = shipDate(stock, FINISH[fin].lead + (listed ? 0 : this.leadExtra || 0));
  return { pn: pnOf(this, size, L, g, fin), price: bomPrice(this, this.wt(size, L), g, fin, qty), stock, listed, ship, pack: this.pack(size) };
}
// short: 견적함 줄·최근 본 형번·검색 제안이 p.f.short를 쓴다
const mkFam = o => Object.assign({ kind: 'bolt', inch: true, prem: 1.5, leadExtra: 5, base: 14, pack: () => 50, stockIf: () => true, gmax: {} }, o, { vi: famVi, short: o.short || o.name });
const dIn = c => inOfCode(c).d;

const PT_KO = { cup: '컵 포인트', flat: '평끝', cone: '원뿔끝', dog: '봉끝(도그)', 'half dog': '하프 도그', oval: '둥근끝(오벌)', 'knurled cup': '널링 컵', 'soft tip': '소프트 팁 (나일론·황동)' };
const SS_MM_STD = { cup: ['ISO 4029', 'DIN 916', 'SSC'], flat: ['ISO 4026', 'DIN 913', 'SSF'], cone: ['ISO 4027', 'DIN 914', 'SSN'], dog: ['ISO 4028', 'DIN 915', 'SSD'] };
const SET_LEN_MM = [3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const SS_IN_CODE = { cup: 'ISSC', flat: 'ISSF', cone: 'ISSN', oval: 'ISSV', 'half dog': 'ISSH' };
const SS_IN_SIZES = inSizes([['#4'], ['#4', 'UNF'], ['#6'], ['#6', 'UNF'], ['#8'], ['#8', 'UNF'], ['#10'], ['#10', 'UNF'], ['1/4'], ['1/4', 'UNF'], ['5/16'], ['5/16', 'UNF'], ['3/8'], ['3/8', 'UNF'], ['7/16'], ['1/2'], ['1/2', 'UNF'], ['5/8'], ['3/4'], ['7/8'], ['1']]);
const SS_LEN_IN = [188, 250, 313, 375, 438, 500, 625, 750, 875, 1000, 1250, 1500, 1750, 2000];
const SOCK_IN_SIZES = inSizes([['#4'], ['#6'], ['#8'], ['#10'], ['#10', 'UNF'], ['1/4'], ['5/16'], ['3/8'], ['7/16'], ['1/2'], ['5/8'], ['3/4'], ['7/8'], ['1'], ['1-1/4'], ['1-1/2']]);
const HEADSOCK_IN_SIZES = inSizes([['#8'], ['#10'], ['#10', 'UNF'], ['1/4'], ['5/16'], ['3/8'], ['7/16'], ['1/2'], ['5/8']]);
const UNC_IN_SIZES = inSizes([['1/4'], ['5/16'], ['3/8'], ['7/16'], ['1/2'], ['9/16'], ['5/8'], ['3/4'], ['7/8'], ['1'], ['1-1/8'], ['1-1/4'], ['1-1/2']]);
const STUD_IN_SIZES = inSizes([['1/2'], ['5/8'], ['3/4'], ['7/8'], ['1'], ['1-1/8', '8UN'], ['1-1/4', '8UN'], ['1-3/8', '8UN'], ['1-1/2', '8UN']]);

const BOM_FAMS = [
  ...['cup', 'flat', 'cone', 'dog'].map(pt => mkFam({
    id: 'ss-' + pt, code: SS_MM_STD[pt][2], inch: false, prem: 1, leadExtra: 0, base: 10, type: 'setscrew', point: pt, draw: 'set',
    name: `무두볼트 ${PT_KO[pt]}`, std: `${SS_MM_STD[pt][0]} (= ${SS_MM_STD[pt][1]})`, sizes: Object.keys(SS_MM),
    len: s => SET_LEN_MM.filter(l => l >= Math.max(3, dnum(s)) && l <= Math.min(60, dnum(s) * 5)),
    combos: [['S45H', 'PL', 1], ['S45H', 'BO', 1], ['SSA2', 'PA', 1], ['SSA4', 'PA', 0]],
    stockIf: s => dnum(s) <= 12, pack: s => dnum(s) <= 6 ? 100 : dnum(s) <= 12 ? 50 : 25,
    wt: (s, L) => Math.PI / 4 * dnum(s) ** 2 * L * .82 * STEEL,
  })),
  ...Object.keys(SS_IN_CODE).map(pt => mkFam({
    id: 'iss-' + pt.replace(' ', ''), code: SS_IN_CODE[pt], type: 'setscrew', point: pt, draw: 'set', base: 10,
    name: `인치 멈춤나사 ${PT_KO[pt]}`, std: 'ASME B18.3', sizes: SS_IN_SIZES,
    len: c => { const d = dIn(c); return lenPick(SS_LEN_IN, Math.max(.1875, d / 2), Math.min(2, Math.max(.5, 4 * d))); },
    combos: [['F912', 'BO', 1], ['F880', 'PA', 1], ['F880M', 'PA', 0]], gmax: { F880: .5, F880M: .5 },
    stockIf: (c, L) => dIn(c) <= .5 && L <= 1000, pack: c => dIn(c) <= .25 ? 100 : 50,
    wt: (c, L) => Math.PI / 4 * dIn(c) ** 2 * L / 1000 * .85 * IN3,
  })),
  mkFam({ id: 'ishc', code: 'ISHC', type: 'shcs', draw: 'shcs', name: '인치 렌치볼트 (1960 시리즈)', std: 'ASME B18.3', sizes: SOCK_IN_SIZES,
    len: c => { const d = dIn(c); return lenPick([250, 313, 375, 500, 625, 750, 875, ...steps(1, 4, .25), 4500, 5000, 5500, 6000], Math.max(.25, d), Math.min(6, Math.max(1, 8 * d))); },
    combos: [['A574', 'BO', 1], ['F837', 'PA', 1], ['F837M', 'PA', 0]], gmax: { F837: 1, F837M: 1 },
    stockIf: (c, L) => dIn(c) <= .75 && L <= 3000,
    wt: (c, L) => { const d = dIn(c); return (Math.PI / 4 * d * d * L / 1000 * .9 + IN_EST.headSock(d) * .9) * IN3; } }),
  mkFam({ id: 'ifhc', code: 'IFHC', type: 'fhcs', draw: 'fhcs', name: '인치 접시머리 렌치볼트 (82°)', std: 'ASME B18.3', sizes: HEADSOCK_IN_SIZES,
    len: c => { const d = dIn(c); return lenPick([375, 500, 625, 750, 875, 1000, 1250, 1500, 1750, 2000, 2500, 3000], Math.max(.375, 1.25 * d), Math.min(3, 6 * d)); },
    combos: [['F835', 'BO', 1], ['F879', 'PA', 1], ['F879M', 'PA', 0]],
    stockIf: (c, L) => dIn(c) <= .5 && L <= 2000,
    wt: (c, L) => { const d = dIn(c); return Math.PI / 4 * d * d * L / 1000 * .95 * IN3; } }),
  mkFam({ id: 'ibhc', code: 'IBHC', type: 'bhcs', draw: 'bhcs', name: '인치 버튼머리 렌치볼트', std: 'ASME B18.3', sizes: HEADSOCK_IN_SIZES,
    // 공급 길이: 영업 규칙 (4d, 최대 2"). B18.3 '최대 표준 길이'는 공개 출처 1곳(Fuller)뿐이라 2026-10 감사로 뺐다
    len: c => { const d = dIn(c); return lenPick([250, 313, 375, 500, 625, 750, 875, 1000, 1250, 1500, 1750, 2000], Math.max(.25, .75 * d), Math.min(2, 4 * d)); },
    combos: [['F835', 'BO', 1], ['F879', 'PA', 1], ['F879M', 'PA', 0]],
    stockIf: (c, L) => dIn(c) <= .5,
    wt: (c, L) => { const d = dIn(c), r = tbl(BHCS_IN, d); return (Math.PI / 4 * d * d * L / 1000 * .9 + (r ? Math.PI / 4 * r[1] ** 2 * r[2] : IN_EST.headSock(d) * .35) * .6) * IN3; } }),
  mkFam({ id: 'ihcs', code: 'IHCS', type: 'hexbolt', draw: 'hex', name: '인치 육각 캡스크루', std: 'ASME B18.2.1', sizes: UNC_IN_SIZES, base: 18,
    len: c => { const d = dIn(c); return lenPick([500, 625, 750, 875, ...steps(1, 6, .25), 6500, 7000, 7500, 8000], Math.max(.5, 1.5 * d), Math.min(8, Math.max(3, 12 * d))); },
    combos: [['J5', 'ZW', 1], ['J5', 'ZY', 1], ['J5', 'PO', 1], ['J5', 'HI', 0], ['J8', 'ZY', 1], ['J8', 'PO', 1], ['F5931', 'PA', 1], ['F5932', 'PA', 1]],
    stockIf: (c, L) => dIn(c) <= .75 && L <= 4000, pack: c => dIn(c) <= .5 ? 50 : 25,
    wt: (c, L) => { const d = dIn(c); return (Math.PI / 4 * d * d * L / 1000 * .93 + IN_EST.headHex(d)) * IN3; } }),
  mkFam({ id: 'ihn', code: 'IHN', kind: 'nut', type: 'nut', draw: 'nut', name: '인치 육각너트', std: 'ASME B18.2.2', sizes: UNC_IN_SIZES, base: 7,
    combos: [['J995G5', 'ZW', 1], ['J995G8', 'ZW', 1], ['J995G8', 'ZY', 1], ['A563A', 'PO', 1], ['F5941', 'PA', 1], ['F5942', 'PA', 1]],
    stockIf: c => dIn(c) <= 1, pack: c => dIn(c) <= .5 ? 100 : 50,
    wt: c => { const d = dIn(c); return IN_EST.nut(d) * IN3; } }),
  mkFam({ id: 'ihhn', code: 'IHHN', kind: 'nut', type: 'heavynut', draw: 'nut', name: '인치 헤비 육각너트', std: 'ASME B18.2.2', sizes: STUD_IN_SIZES, base: 9,
    combos: [['A1942H', 'PO', 1], ['A1942H', 'HI', 0], ['A563DH', 'PO', 1], ['A563DH', 'HI', 1]],
    stockIf: c => dIn(c) <= 1, pack: c => dIn(c) <= .75 ? 50 : 25,
    wt: c => { const d = dIn(c), r = hhnIn(d); return (r ? (.866 * r[2] ** 2 - Math.PI / 4 * d * d) * r[4] : IN_EST.nut(d)) * IN3; } }),
  mkFam({ id: 'istd', code: 'ISTD', kind: 'stud', type: 'stud', draw: 'stud', name: '플랜지 스터드볼트 B7 (+2H 헤비너트)', std: 'ASME B18.31.2 / B18.2.2', sizes: STUD_IN_SIZES, base: 40,
    len: c => { const d = dIn(c); return lenPick(steps(2, 16, .25), Math.max(2, 3 * d), Math.min(16, 4 + 8 * d)); },
    combos: [['B72H', 'PO', 1], ['B7S', 'PO', 1]],
    stockIf: (c, L) => dIn(c) <= 1 && L <= 8000, pack: () => 1,
    wt: (c, L, g) => { const d = dIn(c), r = hhnIn(d); return (Math.PI / 4 * d * d * L / 1000 * .9 + 2 * (r ? (.866 * r[2] ** 2 - Math.PI / 4 * d * d) * r[4] : IN_EST.nut(d))) * IN3; } }),
  mkFam({ id: 'ifw', code: 'IFW', kind: 'washer', type: 'washer', draw: 'washer', name: '경화 평와셔 F436', std: 'ASTM F436', sizes: [.25, .3125, .375, .4375, .5, .5625, .625, .75, .875, 1, 1.125, 1.25, 1.375, 1.5].map(d => szIn(d, 'W')), base: 6,   // 호칭만 (F436 범위 1/4–4", F436-24 범위 조항). 치수는 규격서 확인 중
    combos: [['F436', 'PO', 1], ['F436', 'HI', 1]], stockIf: c => dIn(c) <= 1, pack: c => dIn(c) <= .75 ? 100 : 50,
    wt: c => IN_EST.washer(dIn(c)) * IN3 }),
  mkFam({ id: 'ilw', code: 'ILW', kind: 'washer', type: 'lockwasher', draw: 'spring', name: '인치 스프링 와셔 (Regular)', std: 'ASME B18.21.1', sizes: [.19, .25, .3125, .375, .4375, .5, .625, .75, .875, 1].map(d => szIn(d, 'R')), base: 4,   // 호칭만. 치수는 규격서 확인 중
    combos: [['LW188', 'PA', 1], ['LWCS', 'ZW', 1]], pack: () => 100,
    wt: c => IN_EST.lock(dIn(c)) * IN3 }),
];
// 공식 영문 품명 (e1n_names.js, ENGINE scope) · 한국어만 있는 등급 이름의 영문 (TYPE grade:*)
BOM_FAMS.forEach(bomEnSet);
['B7S', 'F880M', 'LW188', 'LWCS'].forEach(k => { const e = bomEn('TYPE:grade:' + k); if (GRADE[k] && e) GRADE[k].en = e.en; });
