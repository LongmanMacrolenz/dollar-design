
const NA_TYPE = {
  insert: '나사 인서트(헬리코일)와 전용 탭·삽입 공구는 취급하지 않습니다.',
  rivet: '리벳은 나사 체결부품 범위 밖이라 취급하지 않습니다.',
  ring: '멈춤링(스냅링)은 취급하지 않습니다.',
  pin: '핀(평행핀·스프링핀)은 취급하지 않습니다.',
  oring: '체결부품이 아닌 실(seal) 부품입니다. 실 전문 공급처에서 구매해 주세요.',
  gasket: '개스킷은 체결부품이 아닙니다. 개스킷 공급처에 문의해 주세요. 같은 플랜지의 스터드볼트는 여기서 견적할 수 있습니다.',
  key: '기계 키는 취급하지 않습니다.',
  discspring: '접시 스프링은 스프링 요소라 취급하지 않습니다.',
  clinch: '클린칭 너트는 제조사 전용 부품입니다. 제조사나 공식 대리점에서 구매해 주세요.',
  expanchor: '인증(ICC-ES 등) 받은 후설치 앵커는 지정 제조사 제품이어야 합니다. 그 제조사에서 구매해 주세요.',
  pipe: '배관 부품(NPT 관용 나사 니플·플러그·엘보 등)은 체결부품이 아니라 취급하지 않습니다. 배관 자재 공급처에 문의해 주세요.',
  valve: '밸브는 체결부품이 아니라 취급하지 않습니다. 밸브 공급처에 문의해 주세요.',
  tool: '공구(육각 렌치·스패너·드라이버 등)는 취급하지 않습니다. 공구상에서 구매해 주세요.',
  nonfast: '체결부품(볼트·너트·와셔·멈춤나사 등)이 아닌 품목입니다. 해당 부품 공급처나 장비 제조사에 문의해 주세요.',
};
// 3장 품목군의 공급 구분(base INCH f.lead)을 견적 사유의 납기 힌트로 바꾼다: 같은 재질이 3장과 4A장에서 같은 티어로 보이게 (최종 통합)
const BOM_LEAD_OF = { '국내 제작': 'mill', '해외 수입': 'lot', '견적 문의': 'check' };
const bomFamLead = (id, dflt) => { const f = typeof INCH !== 'undefined' ? INCH.find(x => x.id === id) : null; return (f && BOM_LEAD_OF[f.lead]) || dflt; };
// 인치 재질 코드 → 3장 품목군 id (공급 구분을 맞출 때만 쓴다)
const bomInchFamOf = (mc, t) => {
  if (!mc) return null;
  if (['heavynut', 'nut'].includes(t) && /^(2HM?|7M?L?|8M?)$/.test(mc)) return 'hh';
  return { B7: 'b7', B7M: 'b7m', B8: 'b8', B8M: 'b8', L7: 'l7', L7M: 'l7', L43: 'l7', B16: 'b16', 'A453-660': 'a453', 'A320-B8': 'b8lt', 'A320-B8M': 'b8lt', B8MLCUN: 'smo', SDSS: 'smo',
    A325: 'a325', A490: 'a325', A574: 'a574', F912: 'a574', F835: 'a574', 'F593-1': 'f593', 'F593-2': 'f593', 'F594-1': 'f593', 'F594-2': 'f593', F837: 'f837', F879: 'f837', F880: 'f837',
    F468: 'f468', 'A354-BC': 'a354', 'A354-BD': 'a354', A449: 'a354' }[mc] || (/^J429|^J995/.test(mc) ? 'j429' : /^F1554/.test(mc) ? 'f1554' : null);
};
const LEAD_HINT = { coat: '코팅 외주 +2–3주', plate: '도금 외주 +1–2주', mill: '밀 수배 3–6주', lot: '로트 수배 2–4주', sec: '후가공 +1–2주', cert: '성적서 로트 +1–2주', make: '주문 제작 2–4주', check: '확인 후 회신' };
// 수량을 그대로 믿기 어려운 경우의 안내 (parseQty의 issue 코드)
function qtyWarnOf(qq, qty, unitKo) {
  if (!qq) return '수량이 없어 1개로 계산했습니다. 수량을 알려 주세요.';
  const p = qq.pack;
  return {
    ar: `수량이 '${qq.raw}'(필요량)이라 1개로 계산했습니다. 필요 수량을 알려 주세요.`,
    zero: '수량이 0입니다. 금액 0원으로 두었습니다. 필요 없는 줄이면 지우고, 필요하면 수량을 알려 주세요.',
    neg: `수량이 음수(${qq.raw})입니다. 금액 0원으로 두었습니다. 수량을 확인해 주세요.`,
    pack: p && `포장 단위 ${p.u}의 입수(한 포장에 몇 개인지)가 없어 ${qty.toLocaleString()}${unitKo}로 계산했습니다. ${p.u}당 개수를 알려 주세요.`,
    packconv: p && `${p.n} ${p.u} × ${p.per}개 → ${qty.toLocaleString()}${unitKo}로 계산했습니다. 입수가 맞는지 확인해 주세요.`,
    per: `'${qq.raw}'는 ${qq.per}당 수량으로 보입니다. 지금은 ${qty.toLocaleString()}${unitKo}로 계산했습니다. ${qq.per} 수를 곱한 총수량을 알려 주세요.`,
    pair: `단위 '${qq.raw}'(쌍)를 개수로 바꾸지 않았습니다(${qty.toLocaleString()}${unitKo}). 맞는지 확인해 주세요.`,
    lot: `단위 '${qq.raw}'(로트)를 개수로 바꿀 수 없어 ${qty.toLocaleString()}${unitKo}로 계산했습니다. 개수를 알려 주세요.`,
    dot3: `'${qq.raw}'를 ${qq.n.toLocaleString()}개로 읽었습니다. 천 단위(${Math.round(qq.n * 1000).toLocaleString()}개)라면 수량을 고쳐 주세요.`,
    frac: `수량 ${qq.raw}에 소수가 있어 ${qty.toLocaleString()}${unitKo}로 올렸습니다.`,
    exp: `수량 '${qq.raw}'는 지수 표기(엑셀 변환)로 보여 ${qty.toLocaleString()}${unitKo}로 읽었습니다. 실제 수량을 확인해 주세요.`,
    nonnum: `수량 '${qq.raw}'를 숫자로 읽지 못해 1${unitKo}로 계산했습니다. 수량을 알려 주세요.`,
    big: `수량 ${qty.toLocaleString()}${unitKo}는 ${BOM_QTY_MAX.toLocaleString()}개를 넘습니다. 맞는 수량인지 확인해 주세요.`,
    unitM: `단위 M(미터)는 이 품목에 맞지 않아 ${qty.toLocaleString()}${unitKo}로 계산했습니다. 개수를 확인해 주세요.`,
  }[qq.issue] || null;
}
// 구조화 이벤트: m.ev = q.ev(해석·기본값) + 이 함수의 사유·수량·납기 이벤트. 규칙 ID는 e1_data.js bomEv 주석과 INTERFACE.md 8절.
function bomMatch(q, qtyIn) {
  const qq = qtyIn ?? q.qty;
  const t = q.type, s = q.size, inch = q.system === 'inch', mc = q.mat?.code, fc = q.fin?.code, sp = k => q.special.includes(k), U = q.text;
  const d = s?.v;
  let qty = !qq ? 1 : qq.n <= 0 ? 0 : Math.max(1, Math.ceil(qq.n - 1e-9));
  const unit = t === 'stud' && q.sub.nuts ? 'SET' : qq?.unit === 'SET' ? 'SET' : 'EA', unitKo = unit === 'SET' ? '세트' : '개';
  const R = [], E = (q.ev || []).map(e => ({ ...e })), ev = (rule, p) => bomEv(E, rule, p);
  let qtyIssue = qq?.issue || null, rodPieces = null;
  // 전산볼트를 미터(M)로 적으면 1 m 정척 개수로 바꾼다
  if (qq?.unit === 'M' && qq.n > 0) {
    if (t === 'rod') { rodPieces = Math.ceil(qq.n - 1e-9); qty = rodPieces; }
    else qtyIssue = qtyIssue || 'unitM';
  }
  const res = { status: 'catalog', reasons: R, qty, unit, qtyStated: !!qq, qtyRaw: qq?.raw ?? '', qtyWarn: null, fam: null, pn: null, price: null, amount: null, stock: false, ship: null, leadDays: null, leadText: '', delivery: SHOP_TERMS.incotermShort,
    diffs: [], alt: null, indicative: '', weightKg: null, spec: specLine(q), tier: null, lead: null, tierCode: null, packPlan: null, ev: E };
  res.qtyWarn = qtyWarnOf(qq && { ...qq, issue: qtyIssue }, qty, unitKo);
  if (res.qtyWarn) ev('K-QTY', { issue: qq ? qtyIssue : 'none', raw: qq?.raw ?? '', qty });
  if (rodPieces != null) res.qtyNote = `${qq.raw} → 1 m 정척 ${rodPieces}개`;
  // NA(문구, why) · EQ(문구, 납기 힌트, 종류, [규칙 ID, params]): 문자열 사유와 이벤트를 함께 쌓는다
  const NA = (text, why) => { res.status = 'not-available'; R.push({ tone: 'crit', text }); ev(res.unreadable ? 'N-UNREAD' : 'N-NA', { why }); };
  const EQ = (text, lead = 'check', kind = 'other', e = null) => { if (res.status !== 'not-available') res.status = 'engineer-quote'; R.push({ tone: 'warn', text, lead, kind }); if (e) ev(e[0], e[1] || {}); };
  // 1) 공급하지 않는 것
  if (NA_TYPE[t]) NA(NA_TYPE[t] + (t === 'pipe' && q.pipeThread ? ' (NPT·BSP는 관용 테이퍼 나사로, 볼트 나사(UN·M)와 다릅니다.)' : ''), t);
  else if (q.variant?.na) NA(`${q.variant.label}은(는) 제조사 전용 품목이라 취급하지 않습니다. 제조사나 공식 대리점에서 구매해 주세요.`, 'variant:' + q.variant.k);
  else if (/\bNAS\s*\d/.test(U)) NA(`항공 규격(${q.stds.find(x => /^NAS/.test(x)) || 'NAS'}) 부품은 인증 공급원 추적성이 필요합니다. 항공 부품 유통사에서 구매해 주세요.`, 'NAS');
  else if (/\bMS\s*\d{5}/.test(U)) NA(`군·항공 규격(${q.stds.find(x => /^MS/.test(x)) || 'MS'}) 부품입니다. 인증된 MS 부품 유통사에서 구매해 주세요.`, 'MS');
  else if (/\bAN\s*\d{2,4}\b/.test(U)) NA(`항공 AN 규격(${q.stds.find(x => /^AN/.test(x)) || 'AN'}) 부품은 취급하지 않습니다.`, 'AN');
  else if (/\bUNJ|\bAMS\s*\d{4}/.test(U) || mc === 'IN718') NA('AMS 니켈 초합금·UNJ 나사 같은 항공 사양은 공급 범위 밖입니다.', 'aero');
  else if (mc === 'TI') NA('티타늄은 공급 재질 범위 밖입니다.', 'TI');
  else if (!q.raw) { res.unreadable = true; NA('품명·사양 칸이 비어 있습니다.', 'empty'); }
  else if (q.noSpec || (t === 'unknown' && !s)) { res.unreadable = !q.noSpec; NA(q.partNo ? `치수·재질 없이 제조사 품번(${q.partNo})만 있습니다. 장비 제조사에 사양을 받아 주시거나 이 줄은 제조사에서 구매해 주세요.` : '품목과 사양을 읽지 못했습니다.', q.partNo ? 'partno' : q.noSpec ? 'nospec' : 'unknown'); }
  else if (s && d != null && THREADED.has(t) && (q.system === 'metric' ? d < 2 : d < .086)) NA(q.system === 'metric' ? `M2 미만 초소형 나사(${s.label})는 공급 범위 밖입니다.` : `#2 미만 초소형 나사(${inLab(s.label)})는 공급 범위 밖입니다.`, 'micro');
  else if (s && d != null && (inch ? d > 4 : d > 64)) NA(inch ? `지름 4" 초과(${inLab(s.label)})는 공급 범위 밖입니다.` : `M64 초과는 공급 범위 밖입니다.`, 'big');
  if (res.status === 'not-available') {
    R.push({ tone: 'crit', text: res.unreadable ? '이 줄은 견적에 넣지 않았습니다. BOM 원본에서 사양을 확인해 다시 붙여 넣거나 아래에서 고쳐 주세요.' : SHOP_TERMS.notAvail });
    res.leadText = '공급 불가'; res.delivery = '—'; return res;
  }
  // 2) 엔지니어 견적 사유
  if (!s) EQ('호칭을 읽지 못했습니다. 엔지니어가 원문을 보고 사양을 확인해 회신합니다.', 'check', 'other', ['N-UNREAD', { why: 'size' }]);
  if (q.variant) EQ(`카탈로그 품목이 아닙니다: ${q.variant.label} (${q.variant.std}). 일반 ${TYPE_KO[q.variant.from] && q.variant.from !== 'unknown' ? TYPE_KO[q.variant.from].replace(/ \(.*\)$/, '') + ' ' : ''}카탈로그품으로 바꾸지 않고 적힌 사양 그대로 수배해 회신합니다.`, 'lot', 'other', ['A-VARIANT', { variant: q.variant.k, label: q.variant.label, std: q.variant.std }]);
  if (sp('NACE') && ['A574', 'F912', 'F835', '12.9', '10.9', '45H', 'J429-8'].includes(mc)) EQ(`사양 충돌: ${MAT_KO[mc] || mc}의 경도는 22 HRC를 크게 넘어 NACE MR0175/ISO 15156의 저합금강 상한(22 HRC)을 만족할 수 없습니다. B7M 상당 특수 소켓볼트나 고용화 316 같은 대안을 제시하고 승인 후 진행합니다.`, 'mill', 'other', ['X-NACE-HARD', { mat: mc }]);
  else if (sp('NACE') || ['B7M', 'L7M'].includes(mc)) EQ('사워 서비스(NACE MR0175 / ISO 15156): 235 HBW 이하 경도 기록과 3.1 성적서가 있는 히트 로트를 주문마다 수배합니다.', 'mill', 'other', [sp('NACE') ? 'S-NACE-EXP' : 'S-B7M', { mat: mc || null }]);
  if (sp('IMPACT') || ['L7', 'L7M', 'L43'].includes(mc)) EQ('저온용 볼팅은 샤르피 충격시험 로트와 성적서가 필요합니다. 너트도 충격시험품(A194 7L 또는 7M + 저온 충격시험)이어야 합니다.', 'mill', 'other', ['Q-IMPACT', { mat: mc || null }]);
  if (['B8', 'B8M'].includes(mc)) { const dIn = d == null ? null : inch ? d : d / 25.4;
    EQ(`A193 ${mc}${q.mat.cls2 ? ' Class 2' : ''}는 지름에 따라 강도가 달라 로트별로 수배합니다.`, 'lot', 'other', [!q.mat.cls2 ? 'S-B8-CL1' : dIn != null && dIn > 1.5 ? 'S-B8-CL2-OVER' : 'S-B8-CL2', { mat: mc, size: s?.label || null }]); }
  if (mc === 'B16') EQ('고온용 A193 B16은 재고가 없어 제강사 수배품입니다.', bomFamLead('b16', 'mill'), 'other', ['K-EQ', { why: 'mill', mat: mc }]);
  if (mc === 'F468') EQ('특수 합금(니켈-구리 400, ASTM F468/F467)은 주문별로 수배하며 3.1 성적서를 함께 드립니다.', bomFamLead('f468', 'mill'), 'other', ['K-EQ', { why: 'mill', mat: mc }]);
  if (mc === 'A453-660') EQ('고온용 A453 Grade 660 (A-286)은 재고가 없어 주문마다 공급처를 확인해 회신합니다.', bomFamLead('a453', 'check'), 'other', ['K-EQ', { why: 'mill', mat: mc }]);
  if (mc === 'A320-B8' || mc === 'A320-B8M') EQ(`저온용 ${MAT_KO[mc]}은 재고가 없어 주문마다 수배합니다. Class와 시험 온도를 확인합니다.`, bomFamLead('b8lt', 'mill'), 'other', ['K-EQ', { why: 'mill', mat: mc }]);
  if (mc === 'B8MLCUN' || mc === 'SDSS') EQ(`해수·염화물용 ${MAT_KO[mc]} 볼팅은 재고가 없어 주문마다 공급처를 확인해 회신합니다.`, bomFamLead('smo', 'check'), 'other', ['K-EQ', { why: 'mill', mat: mc }]);
  if (/^A307/.test(mc)) EQ('A307은 재고가 없습니다. SAE J429 Grade 5 용융아연으로 바꾸려면 구매자 승인이 필요합니다.', 'lot', 'other', ['S-A307', { mat: mc }]);
  if (/^A354|^A449$/.test(mc || '')) EQ(`${MAT_KO[mc]}는 재고 등급이 아닙니다. 등급별 로트로 수배합니다.`, bomFamLead('a354', 'lot'), 'other', ['K-EQ', { why: 'lot', mat: mc }]);
  if (q.mat?.unknown) EQ(`재질 규격 ${mc}: 카탈로그 밖입니다. 규격을 확인해 수배합니다.`, 'lot', 'other', ['K-EQ', { why: 'matspec', mat: mc }]);
  if (q.sub.jam || q.sub.nyloc) EQ(`${q.sub.jam ? '잼너트' : '나일론 인서트 너트'}는 견적 품목입니다.`, 'lot', 'other', ['K-EQ', { why: 'item', item: q.sub.jam ? 'jam' : 'nyloc' }]);
  if (q.mat?.def && !q.api610?.cls && (q.system === 'inch' ? ['hexbolt', 'heavyhexbolt', 'nut', 'heavynut', 'stud', 'bolt'] : ['hexbolt', 'heavyhexbolt', 'stud', 'bolt']).includes(t)) EQ(`강도 등급·재질이 적혀 있지 않습니다. ${q.mat.label}로 가정했으니 맞는지 확인해 주세요.`, 'check', 'assume', ['A-GRADE', { mat: q.mat.code }]);
  if (mc === 'A325' || mc === 'A490') EQ('구조용 고장력 세트(F3125)는 로트 시험 성적서와 함께 견적합니다.', 'lot', 'other', ['S-F3125', { mat: mc }]);
  if (/^F1554/.test(mc) || t === 'anchor') EQ('성형 앵커볼트는 도면(나사 길이·굽힘 형상)을 확인한 뒤 제작합니다.', 'make', 'other', ['S-F1554', { mat: mc || null }]);
  if (sp('CERT') || sp('PMI')) { EQ(`${[sp('CERT') && 'EN 10204 3.1', sp('PMI') && 'PMI'].filter(Boolean).join('·')}은 히트 추적이 되는 로트를 따로 수배·검사해 비용과 납기가 추가됩니다.`, 'cert', 'addon'); if (sp('CERT')) ev('Q-31-FWD'); if (sp('PMI')) ev('Q-PMI'); }
  if (sp('PATCH')) EQ('나일론 패치는 외주 후처리이며 최소 로트가 있습니다.', 'sec', 'addon', ['K-MOQ', { proc: 'PATCH' }]);
  if (q.hand === 'LH') EQ('왼나사는 재고가 없어 특별 주문입니다.', 'make', 'other', ['K-EQ', { why: 'make', item: 'LH' }]);
  if (sp('DRILLED')) EQ('안전와이어용 머리 드릴링은 2차 가공입니다.', 'sec', 'addon', ['K-EQ', { why: 'sec', item: 'DRILLED' }]);
  if (q.point === 'knurled cup') EQ('널링 컵(자체 풀림 방지형)은 표준 끝 형상이 아닌 변형품입니다.', 'make', 'other', ['K-EQ', { why: 'make', item: 'knurled cup' }]);
  if (fc === 'CD') EQ('카드뮴 도금은 RoHS 제한 물질이라 재고가 없습니다. 아연-니켈 등 대체 도금을 제안하고 승인 후 진행합니다. 카드뮴이 꼭 필요하면(항공·군수 도면) 지정 처리업체 수배 가능 여부를 회신합니다.', 'plate', 'other', ['S-CD', { fin: fc }]);
  if (fc === 'PTFE') { EQ(`${q.fin.label}: 외부 코팅업체에서 로트 단위로 처리합니다. 비용과 납기가 추가됩니다.`, 'coat', 'addon', ['S-PTFE', { fin: fc }]); ev('K-MOQ', { proc: 'PTFE' }); }
  if (fc === 'ZNNI') EQ('아연-니켈 도금은 외주 처리 로트입니다.', 'plate', 'addon', ['Q-COAT', { fin: fc }]);
  if (fc === 'PH') EQ('인산염 피막은 외주 처리입니다.', 'plate', 'addon', ['Q-COAT', { fin: fc }]);
  if (['ZN', 'YZ', 'ZB'].includes(fc) && (t === 'setscrew' || (SOCKET.has(t) && ['A574', 'F835', '12.9', '10.9', '010.9', 'F912'].includes(mc)))) EQ(t === 'setscrew' && mc === '45H'
    ? '45H 멈춤나사는 인장을 받지 않아 ISO 4042상 전기도금 뒤 베이킹이 필요 없습니다. 기본은 흑착색이며 전기아연도금도 주문할 수 있습니다.'
    : '고경도 소켓 제품 전기도금은 도금 후 베이킹과 나사 공차(3A는 도금 여유 없음) 관리가 필요합니다.', 'plate', t === 'setscrew' ? 'other' : 'addon', ['S-HE-BAKE', { mat: mc || null, fin: fc }]);
  if (q.system === 'metric' && q.series === 'fine' && THREADED.has(t)) EQ(`가는나사(피치 ${q.pitch} mm)는 카탈로그 밖입니다(${q.dimStd.replace(/ \(.*/, '')}). ${q.pitch}가 길이가 아니라 피치가 맞는지도 확인합니다.`, 'lot', 'other', ['S-FINE', { size: s.label, pitch: q.pitch }]);
  if (q.system === 'metric' && fc === 'HDG' && ['10.9', '12.9'].includes(mc)) EQ(`${mc} 용융아연도금은 ISO 10684 특별 공정 관리가 필요해 카탈로그 조합이 아닙니다.`, 'lot', 'other', [mc === '10.9' ? 'S-HDG-109' : 'S-HDG-HS', { mat: mc }]);
  if (inch && fc === 'HDG' && mc === 'J429-8') EQ('Grade 8 용융아연도금은 공정 조건을 확인합니다. 아연 플레이크를 제안합니다.', 'lot', 'other', ['S-HDG-HS', { mat: mc }]);
  if (t === 'rod' && inch) EQ('인치 전산볼트(ATR) 정척은 카탈로그 품목이 아닙니다. 절단·나사 가공 기준으로 견적합니다.', 'lot', 'other', ['K-EQ', { why: 'item', item: 'rod-inch' }]);
  // 미터 전산볼트 카탈로그는 1 m 정척: 다른 길이를 1 m 품목으로 바꿔 팔지 않는다
  const rodLen = t === 'rod' && q.system === 'metric' && q.lengthMm && Math.abs(q.lengthMm - 1000) > 1 && rodPieces == null ? q.lengthMm : null;
  if (rodLen) EQ(rodLen > 1000 ? `길이 ${rodLen.toLocaleString()} mm 전산볼트는 카탈로그(1 m 정척) 밖입니다. ${rodLen / 1000} m 장척을 수배하거나, 승인하시면 1 m 정척 여러 개로 공급합니다.` : `길이 ${rodLen.toLocaleString()} mm는 1 m 정척을 잘라 끝 나사를 정리하는 절단 가공입니다.`, rodLen > 1000 ? 'lot' : 'sec', 'rodlen', ['S-CAT-ALT', { why: 'rodlen', len: rodLen }]);
  if (t === 'stud' && (q.system === 'metric' || q.sub.tapEnd)) EQ(q.sub.tapEnd ? '탭엔드(양나사) 스터드는 카탈로그 품목이 아닙니다.' : '미터 스터드는 견적 품목입니다.', 'make', 'other', ['K-EQ', { why: 'make', item: q.sub.tapEnd ? 'tapend' : 'stud-metric' }]);
  if (t === 'heavyhexbolt') EQ(`머리 달린 ${mc && /^B/.test(mc) ? 'A193 ' + mc + ' ' : ''}헤비 육각볼트는 주문 제작입니다(플랜트 볼팅은 스터드가 재고 형태).`, 'make', 'other', ['K-EQ', { why: 'make', item: 'heavyhexbolt' }]);
  if (t === 'bhcs' && q.system === 'metric') EQ('미터 버튼머리(ISO 7380)는 견적 품목입니다.', 'lot', 'other', ['K-EQ', { why: 'item', item: 'bhcs-metric' }]);
  if (t === 'machinescrew') EQ('작은 나사는 견적 품목입니다.', 'lot', 'other', ['K-EQ', { why: 'item', item: 'machinescrew' }]);
  if (['bolt', 'capscrew', 'screw'].includes(t) && s && !q.variant) EQ('머리 형상(육각·소켓·접시 등)이 적혀 있지 않습니다. 확인한 뒤 견적합니다.', 'check', 'other', ['A-HEAD', { why: 'head' }]);
  if (t === 'unknown' && s) EQ('품목명(볼트·너트·와셔·멈춤나사 등)이 적혀 있지 않습니다. 원문을 보고 품목을 확인해 회신합니다.', 'check', 'other', ['A-HEAD', { why: 'type' }]);
  if (s && d != null && q.system === 'metric' && d > 24 && THREADED.has(t)) EQ(`${s.label}는 M24 초과로 주문별 수배품입니다.`, 'lot', 'other', ['K-EQ', { why: 'size', size: s.label }]);
  if (s && d != null && inch && ['stud', 'heavynut'].includes(t) && d > 1.5) EQ(`${inLab(s.label)}는 1-1/2" 초과 ${t === 'stud' ? '스터드' : '헤비너트'}로 주문 제작합니다.`, 'make', 'other', ['K-EQ', { why: 'size', size: s.label }]);
  if (s && d != null && inch && ['hexbolt', 'nut'].includes(t) && d > 1.5) EQ(`${inLab(s.label)}는 1-1/2" 초과로 주문별 수배품입니다.`, 'lot', 'other', ['K-EQ', { why: 'size', size: s.label }]);
  // API 610: 판·클래스를 자동으로 매핑하지 않는 경우 (2026-10 감사 뒤 재질 클래스 자료가 비어 있어 클래스가 적힌 줄은 모두 여기로 온다)
  if (q.api610?.cls && q.api610.status === 'engineer-quote') EQ(`API 610 ${q.api610.edition ? api610EdKo(q.api610.edition) + ' ' : ''}${q.api610.cls}는 자동으로 매핑하지 않습니다(${q.api610.why}). 펌프 데이터시트·PO의 볼팅 재질을 확인해 엔지니어가 회신합니다.`, 'check', 'other', ['X-API610-NOAUTO', { cls: q.api610.cls, edition: q.api610.edition, why: q.api610.why }]);
  // 3) 카탈로그 조회
  const hit = s ? catalogLookup(q) : null;
  if (hit) {
    const { f, sz, L, g, fin } = hit;
    const v = viOf(f, sz, L, g, fin, Math.max(1, qty));
    res.fam = f.id; res.family = f.name; res.diffs = hit.diffs;
    const w = wtOf(f, sz, L);
    if (hit.exact && res.status === 'catalog') {
      Object.assign(res, { pn: v.pn, price: v.price, amount: v.price * qty, stock: v.stock, ship: v.ship, weightKg: w * qty / 1000, grade: g, finCode: fin, sz, L });
      // 출고까지 영업일: 재고품도 도금 공정(FINISH lead)이 붙으면 그만큼 늦다 (shipDate와 같은 계산)
      res.leadDays = (v.stock ? 0 : 2 + (f.vi && !v.listed ? f.leadExtra || 0 : 0)) + FINISH[fin].lead;
      res.leadText = v.ship.today ? `오늘 출고 (평일 ${CUTOFF}시까지 발주 확정 시)` : `${v.ship.label} 출고 예정${v.stock ? '' : ` · 수배 영업일 ${res.leadDays}일`}`;
      if (hit.diffs.length) { R.push({ tone: 'info', text: hit.diffs.join(' · ') }); ev('A-FIN-CAT', { fin }); }
      // 단가 구간: 다음 구간까지 올리면 합계가 더 싸지는 경우 알려 준다 (예: 99개 > 100개)
      const nx = TIERS.find(x => x[0] > qty);
      if (nx && qty > 0) { const v2 = viOf(f, sz, L, g, fin, nx[0]); if (v2.price * nx[0] <= v.price * qty) { res.tier = { qty: nx[0], price: v2.price, amount: v2.price * nx[0], text: `${nx[0].toLocaleString()}${unitKo}부터 단가 구간이 바뀝니다. ${nx[0].toLocaleString()}${unitKo}로 주문하면 합계 ${won(v2.price * nx[0])}로 지금(${won(v.price * qty)})보다 쌉니다.` }; ev('K-TIER', { n: nx[0], amt: v2.price * nx[0] }); } }
      // 포장 조합: 필요 수량 이상을 가장 싸게 (여유 허용, 같은 값이면 포장 수가 적은 쪽). 견적 수량·금액은 BOM 수량 그대로 두고 안내만 한다
      if (qty > 0) { res.packPlan = bomPackCatalog(qty, v.pack, n => viOf(f, sz, L, g, fin, n).price, unit); if (res.packPlan.over > 0) ev('K-PACK', { qb: qty, qq: res.packPlan.ordered, over: res.packPlan.over }); }
    } else {
      if (!hit.exact) EQ(`카탈로그에 같은 조합이 없습니다: ${hit.diffs.join(' · ')}`, R.length ? R[R.length - 1].lead : inch ? bomFamLead(bomInchFamOf(mc, t), 'lot') : 'lot', 'other', ['S-CAT-ALT', { diff: hit.diffs }]);
      const eqs = R.filter(r => r.tone === 'warn'), u = unit === 'SET' ? '세트' : 'EA';
      const kinds = new Set(eqs.map(r => r.kind || 'other'));
      const altOk = hit.sizeOk && !hit.gradeDiff && !hit.finDiff && !q.sub.jam && !q.sub.nyloc && q.hand !== 'LH' && q.point !== 'knurled cup' && !(q.mat && (q.mat.unknown || ['B7M', 'L7M', 'L7', 'L43', 'B8', 'B8M', 'B16', 'F468', 'A307A', 'A307B', 'TI'].includes(q.mat.code)));
      if (rodLen && altOk) {
        const n1 = Math.ceil(rodLen / 1000 - 1e-9) * Math.max(1, qty), v1 = viOf(f, sz, L, g, fin, n1);
        res.alt = { pn: v1.pn, price: v1.price, label: `${f.name} ${sizeTxt(f, sz)} · ${GRADE[g].label} · ${FINISH[fin].label} × ${n1}개 (총 ${(n1).toLocaleString()} m)`, exact: false, stock: v1.stock, ship: v1.ship };
        res.indicative = rodLen > 1000 ? `대안: 1 m 정척 ${v1.pn} × ${n1}개 = ${won(v1.price * n1)} (승인 시)` : `1 m 정척 ${v1.pn} ${won(v1.price)}/EA + 절단비 별도`;
      } else if (altOk) {
        res.alt = { pn: v.pn, price: v.price, label: `${f.name} ${sizeTxt(f, sz)}${L != null ? ' × ' + lenTxt(f, L) : ''} · ${GRADE[g].label} · ${FINISH[fin].label}`, exact: hit.exact, stock: v.stock, ship: v.ship };
        if (hit.exact && [...kinds].every(k => k === 'addon')) res.indicative = `기본품 ${v.pn} ${won(v.price)}/${u} + 추가 공정·서류 별도`;
        else if (hit.exact && kinds.has('assume') && [...kinds].every(k => k !== 'other')) res.indicative = `${GRADE[g].label} 가정 시 ${v.pn} ${won(v.price)}/${u} (등급 확인 후 확정)`;
        else if (!hit.exact) res.indicative = `대안 ${v.pn} ${won(v.price)}/${u} (차이 승인 시)`;
        else res.alt = null;
      }
      res.weightKg = w * qty / 1000;
    }
  } else if (res.status === 'catalog') EQ('카탈로그 품목군이 아닙니다. 사양을 확인해 단가를 회신합니다.', 'lot', 'other', ['K-EQ', { why: 'item', item: t }]);
  if (res.status === 'engineer-quote') {
    const hints = [...new Set(R.filter(r => r.lead).map(r => LEAD_HINT[r.lead]))];
    res.leadText = `회신일은 접수 확인 때 안내 · 납기 ${hints.join(', ') || '회신 시 확정'}`;
  }
  const kg = res.weightKg || 0;
  if (t === 'rod' || (q.lengthMm || 0) >= 1000) { res.delivery = '화물 (장척물, 운임 별도)'; ev('K-FREIGHT', { why: 'long' }); }
  else if (kg > SHOP_TERMS.heavyKg) { res.delivery = `화물 (약 ${Math.round(kg)} kg, 운임 별도)`; ev('K-FREIGHT', { why: 'heavy', kg: Math.round(kg) }); }
  // 공급 경로·납기 티어 (supply.json leadTimeRules). 재고 표시는 예시 데이터라 재고 수량은 만들지 않는다
  res.lead = bomTierOf(q, res); res.tierCode = res.lead ? res.lead.code : null;
  if (res.lead && res.lead.returnable === false) ev('K-NONRET', { tier: res.lead.code, days: res.lead.validityDays || SHOP_TERMS.validityDays });
  return res;
}
// 줄 하나를 견적 줄로: 해석 + 매칭 + 수정값
// ctx = { api610 }: 견적 머리(RFQ)에서 읽은 문맥 (parseApi610 결과). 줄에 API 610이 적혀 있으면 줄 값이 우선
function bomLine(row, ov = {}, ctx = {}) {
  const c = parseCore(row.text, { type: ov.type || null, size: ov.size || null }), q = bomDerive(c, ov, ctx);
  const qty = ov.qty ? parseQty(String(ov.qty)) : row.qty != null && row.qty !== '' ? parseQty(row.qty) : null;
  q.qty = qty;
  if (row.filled) { q.questions.unshift(`품명·사양 칸이 비어 있어 위 줄(No ${row.filled}) 사양을 이어 받았습니다 (엑셀 병합 셀). 다른 품목이면 고쳐 주세요.`); bomEv(q.ev, 'A-MERGE', { from: row.filled }); }
  const m = bomMatch(q, qty);
  if (m.qtyWarn && m.status !== 'not-available') q.questions.push(m.qtyWarn);
  return { row, q, m };
}
