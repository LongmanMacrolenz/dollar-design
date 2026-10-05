
const FIN_RULES = [
  [/\bCADMIUM\b|\bCAD\.?\s*PL(?:A?T(?:ED|E|ING)?|T)?\b|\bCAD[\s-]*PLATED\b|\bCD\s*PL(?:A?T(?:ED|E|ING)?|T)?\b|카드뮴|カドミ|\bQQ-P-416\b|\bASTM\s*B766\b/, 'CD'],
  [/ZN-?NI\b|ZINC[\s-]*NICKEL|\bZNNI\b|아연\s*-?\s*니켈|亜鉛ニッケル/, 'ZNNI'],
  [/\bFLZN|ZINC\s*FLAKE|GEOMET|DACROMET|DELTA[\s-]*(?:PROTEKT|TONE)|\bMAGNI\b|\bF1136\b|\bF3393\b|지오메트|다크로|아연\s*플레이크/, 'ZF'],
  [/\bTZN\b|\bHDG\b|\bH\.D\.G\b|\bH\.?D\.?\s*GALV|HOT[\s-]*DIP|(?<!ELECTRO[\s-]?|\bE[\s-]?)\bGALV(?:ANI[SZ](?:ED|ING|E)?|D|\.)?(?![A-Z])|(?<!ELECTRO[\s-]?)GALVANI[SZ]|용융|溶融亜鉛|ドブ|FEUERVERZINKT|\bF2329\b/, 'HDG'],
  [/XYLAN|\bPTFE\b|TEFLON|FLUOROPOLYMER|FLUOROCARBON|테프론|불소/, 'PTFE'],
  [/\bYZ\b|YELLOW\s*ZINC|ZINC\s*YELLOW|\bZY\b|\bZYC\b|\bYZP\b|\bYEL(?:LOW)?\.?\s*(?:ZN|ZINC|ZP|ZC|CHROMATE|DICHROMATE|PLT|PLATED)\b|\bZ(?:INC|N)\.?\s*YEL(?:LOW)?\b|YELLOW\s*(?:DI)?CHROMATE|황색\s*아연|有色クロメート|\bGELB/, 'YZ'],
  [/흑색\s*아연|삼가\s*흑|BLACK\s*ZINC|ZINC\s*BLACK|黒亜鉛|\bZB\b/, 'ZB'],
  [/\bZP\b|\bZN\b|\bZINC\b|\bZC\b|\bZNC\b|아연|VERZINKT|ユニクロ|三価|亜鉛|\bFE\/ZN|ELECTRO[\s-]*(?:ZINC|GALV)|\bE-?GALV|\bF1941\b/, 'ZN'],
  [/BLK\s*OX|BLACK\s*OX(?:IDE)?|\bBO\b|\bBLK\b|흑착색|흑염|흑색|黒染め?|SCHWARZ|BRÜNIERT|\bBLACK(?:ENED)?\b|\bOXIDE\b/, 'BO'],
  [/\bPHOS(?:PHATE)?\b|인산염/, 'PH'],
  [/\bPLAIN\b|\bPLN\b|무처리|무도금|생지|生地|\bOILED\b|\bBLANK\b|PASSIVAT|패시베이션|\bUNPLATED\b/, 'PL'],
];
const FIN_KO = { CD: '카드뮴 도금 (RoHS 제한 물질)', ZNNI: '아연-니켈 전기도금', ZF: '아연 플레이크 (ISO 10683)', HDG: '용융아연도금', PTFE: '불소수지(PTFE) 코팅', YZ: '황색아연 (3가)', ZB: '흑색아연 (3가)', ZN: '전기아연도금 (3가 백색)', BO: '흑착색 (흑색 산화피막) + 방청유', PH: '인산염 피막', PL: '무처리' };
// JAM: 얇은 너트. KS B 1012 '3종'(JIS '3種')·'얇은'·'박형'도 얇은 너트로 읽는다 (사양 12장 미결 13번) → ISO 4035로 견적, 일반 높이 너트로 바꾸지 않음
const SPEC_RULES = [
  ['NACE', /\bNACE\b|MR\s*0?175|ISO\s*15156|\bSOUR\b|사워/], ['IMPACT', /\bIMPACT|\bCHARPY|-\s*101\s*°?\s*C|충격\s*시험/], ['CERT', /\b3\.1\b|EN\s*10204|\bMTC\b|MILL\s*(?:TEST\s*)?CERT|밀\s*시트/],
  ['PMI', /\bPMI\b/], ['PATCH', /\bPATCH\b|NYLOK|PRE-?COAT|\bLOCTITE|DRI-?LOC/], ['LH', /\bLH\b|LEFT[\s-]*HAND|왼\s*나사|左ねじ/], ['DRILLED', /\bDRILLED\b|SAFETY\s*WIRE/],
  ['KNURL', /RÄNDEL|RANDEL|KNURL/], ['BAKE', /\bBAKED?\b|베이킹|EMBRITTLEMENT\s*RELIEF/], ['NYLOC', /NYLON\s*INSERT|\bNYLOC\b|\bDIN\s*985\b|\bISO\s*7040\b/],
  ['JAM', /\bJAM\b|\bDIN\s*439\b|\bISO\s*4035\b|3\s*[종種]|얇은|박형|\bTHIN\s*NUTS?\b/], ['CONT', /\bCONT(?:INUOUS)?\.?\s*(?:THD|THREAD)/], ['TAPEND', /\bDOUBLE[\s-]*END|\bTAP[\s-]*END|\bDIN\s*93[89]\b|\bDIN\s*835\b/],
  ['AERO', /\bNAS\s*\d|\bMS\s*\d{5}|\bAN\s*\d{2,4}\b|\bAMS\s*\d{4}|\bUNJ[CF]?\b/],
];
const SPEC_KO = { NACE: 'NACE MR0175 사워', IMPACT: '저온 충격시험', CERT: 'EN 10204 3.1', PMI: 'PMI', PATCH: '나일론 패치', LH: '왼나사', DRILLED: '머리 드릴링', KNURL: '널링 컵', BAKE: '베이킹', NYLOC: '나일론 인서트', JAM: '잼너트', CONT: '전산 스터드', TAPEND: '탭엔드', AERO: '항공 규격' };
const PT_RULES = [['knurled cup', /RÄNDEL|RANDEL|KNURL/], ['half dog', /HALF\s*DOG/], ['dog', /\bDOG\b|봉\s*끝|棒先|\bISO\s*4028\b|\bDIN\s*915\b/], ['cone', /\bCONE\b|원뿔|뾰족\s*끝|とがり先|\bISO\s*4027\b|\bDIN\s*914\b/],
  ['oval', /\bOVAL\b|둥근\s*끝|丸先/], ['flat', /\bFLAT\b|평\s*끝|平先|\bISO\s*4026\b|\bDIN\s*913\b/], ['cup', /\bCUP\b|컵|くぼみ先|오목\s*끝|\bISO\s*4029\b|\bDIN\s*916\b/]];
const STAINLESS = new Set(['A2', 'A4', 'F880', 'F837', 'F879', 'F593-1', 'F593-2', 'F594-1', 'F594-2', '18-8', 'B8', 'B8M', 'SS', 'A320-B8', 'A320-B8M', 'B8MLCUN', 'SDSS']);
const MAT_KO = {
  TI: '티타늄 Grade 5 (Ti-6Al-4V)', IN718: '인코넬 718 (AMS 5662)', F468: 'ASTM F468 니켈-구리 합금 400 (모넬)', FKM: 'FKM (바이톤)', '316/GRAPHITE': '316 와인딩 / 흑연 충전재', AL: '알루미늄 몸체 / 강 맨드럴',
  CRES: 'CRES (내식강)', MFR: '제조사 카탈로그 사양', B7M: 'ASTM A193 B7M (235 HBW 이하)', L7M: 'ASTM A320 L7M (235 HBW 이하, 충격시험)', B8M: 'ASTM A193 B8M (316)', B8: 'ASTM A193 B8 (304)',
  B16: 'ASTM A193 B16 (Cr-Mo-V 고온용)', 'A453-660': 'ASTM A453 Grade 660 (A-286, 고온용)', 'A320-B8': 'ASTM A320 B8 (304, 저온용)', 'A320-B8M': 'ASTM A320 B8M (316, 저온용)',
  B8MLCUN: 'ASTM A193 B8MLCuN (6Mo, S31254)', SDSS: '수퍼듀플렉스 스테인리스 (S32760 등)', L43: 'ASTM A320 L43', L7: 'ASTM A320 L7 (−101 °C 충격시험)', B7: 'ASTM A193 B7 (Cr-Mo, 125 ksi ≤ 2-1/2")', A307A: 'ASTM A307 Grade A (60 ksi)', A307B: 'ASTM A307 Grade B',
  'A563-DH': 'ASTM A563 Grade DH', 'A563-A': 'ASTM A563 Grade A', 'A563-C': 'ASTM A563 Grade C', A325: 'ASTM F3125 A325', A490: 'ASTM F3125 A490', 'A354-BC': 'ASTM A354 Grade BC', 'A354-BD': 'ASTM A354 Grade BD', A449: 'ASTM A449',
  A574: 'ASTM A574 합금강 (1/2" 이하 180 ksi · 초과 170 ksi)', F912: 'ASTM F912 합금강 (45–53 HRC)', F880: 'ASTM F880 스테인리스', F837: 'ASTM F837 스테인리스', F835: 'ASTM F835 합금강', F879: 'ASTM F879 스테인리스',
  'F593-1': 'ASTM F593 Group 1 (304) CW', 'F593-2': 'ASTM F593 Group 2 (316) CW', 'F594-1': 'ASTM F594 Group 1 (304)', 'F594-2': 'ASTM F594 Group 2 (316)', 'F436-1': 'ASTM F436 Type 1 (전체 경화 38–45 HRC)',
  '2H': 'ASTM A194 2H', '2HM': 'ASTM A194 2HM', '7': 'ASTM A194 Grade 7', '7L': 'ASTM A194 7L (저온 충격시험)', '7ML': 'ASTM A194 7M + 저온 충격시험 (BOM 표기 7ML)', 'L7M-NUT': 'ASTM A194 7M(저온 충격시험) 또는 2HM — 주문 때 확인', '8M': 'ASTM A194 8M', '8': 'ASTM A194 8',
  'J429-5': 'SAE J429 Grade 5', 'J429-8': 'SAE J429 Grade 8', 'J429-2': 'SAE J429 Grade 2', 'J995-5': 'SAE J995 Grade 5', 'J995-8': 'SAE J995 Grade 8',
  '45H': '강 45H (ISO 898-5, 450 HV 이상)', '12.9': '12.9 합금강 (SCM435, ISO 898-1)', '10.9': '10.9 합금강 (ISO 898-1)', '010.9': '010.9 합금강 (접시머리 감소 하중)', '8.8': '8.8 탄소강 소입·소려 (ISO 898-1)',
  '4.8': '4.8 탄소강 (ISO 898-1)', '4.6': '4.6 탄소강', N8: '너트 강도 8 (ISO 898-2)', N10: '너트 강도 10 (ISO 898-2)', N12: '너트 강도 12', '200HV': '강 200 HV', '300HV': '강 300 HV',
  A2: '스테인리스 A2 (SUS304, ISO 3506)', A4: '스테인리스 A4 (SUS316, ISO 3506)', SPR: '스프링강', '18-8': '18-8 스테인리스', SS: '스테인리스 (강종 미기재)',
};
// L7M 짝 너트 기본값은 L7M-NUT ("7M(저온 충격시험) 또는 2HM — 주문 때 확인"): 7ML 등급·마킹은 허용 출처에 없음 (2026-10 감사)
const NUT_FOR = { B7: '2H', B7M: '2HM', L7: '7L', L7M: 'L7M-NUT', B8M: '8M', B8: '8', B16: '7', L43: '7L' };

function parseMat(U, R0, type, sys) {
  const has = re => re.test(U), R = (code, x = {}) => ({ code, stated: true, ...x });
  const ss316 = has(/\bSUS\s*316|\bSTS\s*316|\b316L?\b|\bA4(?:-\d\d)?\b/);
  const ss = ss316 || has(/\bSUS\s*30[34]|\bSTS\s*30[34]|\bSTS\b|\b30[34]L?\b|\b18-8\b|\bA2(?:-\d\d)?\b|\bSST\b|\bSS\b|STAINLESS|스텐|스테인리스|서스|\bSUS\b|ステンレス|\bINOX\b|\bF59[34]\b|\bF837\b|\bF879\b|\bF880\b/);
  const ssGrade = has(/\bA[24](?:-\d\d)?\b|30[34]|316|18-8/);
  const alloy = ss316 ? '316' : ss ? '304' : null;
  let m;
  if (has(/TITANIUM|\bTI-?6AL|\bTI\s*GR/)) return R('TI');
  if (has(/INCONEL|ALLOY\s*718|AMS\s*5662/)) return R('IN718');
  if (has(/MONEL|\bF468\b|ALLOY\s*400|N04400/)) return R('F468', { nut: has(/\bF467\b/) ? 'F467' : null });
  if (type === 'oring') return has(/VITON|FKM/) ? R('FKM') : null;
  if (type === 'gasket') return has(/GRAPHITE/) ? R('316/GRAPHITE') : null;
  if (type === 'rivet') return has(/\bAL\b|ALUMIN/) ? R('AL') : null;
  if (has(/\bCRES\b|\bMS\s*2469\d-?C/)) return R('CRES');
  if (type === 'clinch') return R('MFR', { stated: false });
  const nutG = (U.match(/\bA194[\s-]*(?:GR(?:ADE)?\.?\s*)?(2HM|2H|7ML|7M|7L|7|8MA|8M|8|4|3)\b/) || U.match(/\b(?:B7M?|B8M?|B16|L7M?|L43)\s*\/\s*(?:A194\s*)?(2HM|2H|7ML|7M|7L|7|8M|8)\b/) || U.match(/\b(2HM|2H|7ML|8M)\b/) || [])[1] || null;
  // 3장 추가 품목군(base INCH a453 · b8lt · smo)의 재질: B8·B7 규칙이나 B7 기본값으로 덮이지 않게 먼저 읽는다 (최종 통합)
  if (has(/\bA453\b|\bA-?286\b|\bS66286\b/) || (has(/\bGR(?:ADE)?\.?\s*660\b/) && !has(/\bA19[34]\b/))) return R('A453-660', { nut: nutG });
  if (has(/\bB8MLCUN\b|\b6\s*MO\b|\bS31254\b|\b254\s*SMO\b/)) return R('B8MLCUN', { nut: nutG });
  if (has(/\bS3276\d\b|\bS32750\b|SUPER\s*DUPLEX|[수슈]퍼\s*듀플렉스|\bZERON\b/)) return R('SDSS', { nut: nutG });
  if (has(/\bA320\b/) && has(/\bB8M?\b/)) return R(has(/\bB8M\b/) ? 'A320-B8M' : 'A320-B8', { cls: (U.match(/\bCL(?:ASS)?\.?\s*(1A|1|2)\b/) || [])[1] || null, nut: nutG });
  const plant = [['B7M', /\bB7M\b/], ['L7M', /\bL7M\b/], ['B8M', /\bB8M\b/], ['B8', /\bB8\b/], ['B16', /\bB16\b/], ['L43', /\bL43\b/], ['L7', /\bL7\b/], ['B7', /\bB7\b/]].find(([, re]) => re.test(U));
  if (plant) return R(plant[0], { cls2: plant[0].startsWith('B8') && /\bCL(?:ASS)?\.?\s*2\b/.test(U), nut: nutG === '7' && /IMPACT|L7/.test(U) ? '7L' : nutG, nutDefault: !nutG });
  if (NUTS.has(type) && nutG) return R(nutG);
  if ((m = U.match(/\bF1554\s*(?:GR(?:ADE)?\.?\s*)?(36|55|105)\b/))) return R('F1554-' + m[1]);
  if (has(/\bF1554\b/)) return R('F1554-36', { gradeDefault: true });
  if ((m = U.match(/\bA307\s*(?:GR(?:ADE)?\.?\s*)?([AB])?(?![\w])/))) return R('A307' + (m[1] || 'A'));
  if ((m = U.match(/\bA563\s*(?:GR(?:ADE)?\.?\s*)?(DH3|DH|C3|C|A)\b/))) return R('A563-' + m[1]);
  if ((m = U.match(/\bA354\s*(?:GR(?:ADE)?\.?\s*)?(BC|BD)\b/))) return R('A354-' + m[1]);
  if (has(/\bA449\b/)) return R('A449');
  if (has(/\bA325\b/)) return R('A325'); if (has(/\bA490\b/)) return R('A490');
  for (const c of ['A574', 'F912', 'F880', 'F837', 'F835', 'F879']) if (new RegExp('\\b' + c + '\\b').test(U)) return R(c, { alloy });
  if (has(/\bF593\b/)) return R(ss316 ? 'F593-2' : 'F593-1', { alloy });
  if (has(/\bF594\b/)) return R(ss316 ? 'F594-2' : 'F594-1', { alloy });
  if (type === 'washer' && has(/\bF436\b/)) return R('F436-1');
  if ((m = U.match(/\bASTM\s*([A-F]\d{2,4})\b/)) && !/^(A193|A194|A320|A307|A563|A325|A490|A574|F912|F880|F837|F835|F879|F593|F594|F436|F1554|F468|F467|A354|A449|F3125|F2329|F1941|F1136|F3393|A153|B695|B633|F844)$/.test(m[1])) return R('ASTM ' + m[1], { unknown: true });
  if ((m = U.match(/\b(?:SAE\s*)?(?:J429\s*)?GR(?:ADE)?\.?\s*([258])\b|\bJ429\s*(?:GR(?:ADE)?\.?\s*)?([258])\b/))) { const g = m[1] || m[2]; return R((NUTS.has(type) ? 'J995-' : 'J429-') + g); }
  if ((m = U.match(/\b(14H|22H|33H|45H)\b/))) return R('45H', { cls: m[1] });
  if (ss) {
    if (sys === 'inch') {
      const c = { setscrew: 'F880', shcs: 'F837', fhcs: 'F879', bhcs: 'F879', hexbolt: ss316 ? 'F593-2' : 'F593-1', heavyhexbolt: ss316 ? 'F593-2' : 'F593-1', nut: ss316 ? 'F594-2' : 'F594-1', heavynut: ss316 ? 'F594-2' : 'F594-1', lockwasher: '18-8', washer: '18-8', stud: ss316 ? 'B8M' : 'B8', rod: ss316 ? 'B8M' : 'B8' }[type] || 'SS';
      return R(c, { alloy, specDefault: c !== 'SS' && c !== '18-8' });
    }
    if (['washer', 'lockwasher'].includes(type)) return R(ss316 ? 'A4' : 'A2', { alloy, assumed: !ssGrade });
    if (!THREADED.has(type) || ['insert', 'machinescrew', 'screw'].includes(type)) return R(ss316 ? 'A4' : has(/\bA2\b|30[34]/) ? 'A2' : 'SS', { alloy });
    return R(ss316 ? 'A4' : 'A2', { alloy, cls: (U.match(/\bA[24]-(\d\d)\b/) || [])[1] || null, assumed: !ssGrade });
  }
  if ((m = U.match(/(?:^|[^\d.])(0?(?:4\.6|4\.8|5\.6|5\.8|6\.8|8\.8|9\.8|10\.9|12\.9))(?![\d])/)) && THREADED.has(type) && sys !== 'inch') {
    let c = m[1].replace(/^0/, ''); if (type === 'fhcs' && c === '10.9') c = '010.9'; if (NUTS.has(type)) c = 'N' + parseInt(c); return R(c);
  }
  if (NUTS.has(type) && sys !== 'inch' && (m = R0.match(/(?:^|\s)(?:CL(?:ASS)?\.?\s*|強度区分\s*|강도\s*(?:구분)?\s*)?(04|05|5|6|8|10|12)(?=\s|$)/))) return R('N' + parseInt(m[1]));
  if ((m = U.match(/\b(200|300)\s*HV\b/))) return R(m[1] + 'HV');
  if (has(/SPRING\s*(?:STEEL|STL)|스프링\s*강|ばね鋼|FEDERSTAHL/) && ['lockwasher', 'washer', 'ring', 'discspring', 'pin'].includes(type)) return R('SPR');
  if (/\bNAS\s*\d|\bMS\s*\d{5}|\bAN\s*\d{2,4}\b|\bAMS\s*\d{4}/.test(U)) return null;
  const alloyKw = has(/\bALLOY\b|\bSCM\s*4\d\d|合金|합금강|\bCR-?MO/);
  if (sys === 'inch' && SOCKET.has(type)) return R({ setscrew: 'F912', shcs: 'A574', fhcs: 'F835', bhcs: 'F835' }[type], { stated: alloyKw, specDefault: true });
  if (sys === 'metric' || sys === 'unknown') {
    const d = { setscrew: '45H', shcs: '12.9', fhcs: '010.9', hexbolt: '8.8', heavyhexbolt: '8.8', nut: 'N8', washer: '200HV', lockwasher: 'SPR', rod: '4.8', stud: '8.8', ring: 'SPR', discspring: 'SPR' }[type];
    if (d && sys === 'metric') return { code: d, stated: alloyKw && ['setscrew', 'shcs'].includes(type), def: true };
    if (d && ['ring', 'discspring'].includes(type)) return { code: d, stated: false, def: true };
  }
  if (sys === 'inch') {
    const d = { hexbolt: 'J429-5', nut: 'A563-A', heavynut: '2H', stud: 'B7', lockwasher: 'SPR', washer: has(/HARDENED/) ? 'F436-1' : null }[type];
    if (d) return { code: d, stated: false, def: true, nut: type === 'stud' ? '2H' : null, nutDefault: true };
  }
  if (has(/SPRING\s*STEEL|스프링강/)) return R('SPR');
  return null;
}
function parseFin(U) {
  for (const [re, c] of FIN_RULES) if (re.test(U)) {
    let label = FIN_KO[c];
    if (c === 'ZF') { const m = U.match(/\bFLZN(NC|YC)?(?:-(\d+)H)?(?:-(L|NL))?/); if (m) label = `아연 플레이크${m[1] === 'NC' ? ', 6가 크롬 무함유' : ''}${m[2] ? `, 염수분무 ${m[2]} h` : ''}${m[3] === 'L' ? ', 윤활 포함' : ''} (ISO 10683 표기)`; else if (/GEOMET/.test(U)) label = '아연 플레이크 (지오메트계, ISO 10683)'; }
    if (c === 'HDG') label = /\bTZN\b/.test(U) ? '용융아연도금 (ISO 10684 기호 tZn)' : '용융아연도금';
    if (c === 'PTFE' && /XYLAN/.test(U)) { const m = U.match(/XYLAN\s*(\d{4})?\s*(BLUE|GREEN|BLACK|RED|GREY|GRAY)?/); label = `Xylan${m[1] ? ' ' + m[1] : ''} 불소수지 코팅${m[2] ? ' (' + ({ BLUE: '청색', GREEN: '녹색', BLACK: '흑색', RED: '적색' }[m[2]] || m[2]) + ')' : ''}, 인산염 전처리`; }
    if (c === 'ZN' && /BAKE/.test(U)) label = '전기아연도금 + 수소취성 제거 베이킹';
    return { code: c, label, stated: true };
  }
  return null;
}
const canonTol = t => /[GHEF]/i.test(t) ? t.replace(/([0-9])([A-Z])/gi, (_, n, l) => n + (/[GE]/i.test(l) ? l.toLowerCase() : l.toUpperCase())) : t.toUpperCase();
function inferSeries(d, tpi) { const r = unRow(d); if (r && tpi === r[1]) return 'UNC'; if (r && tpi === r[2]) return 'UNF'; if (tpi === 8) return '8UN'; return 'UN'; }
const lenLabelIn = (v, ft) => ft ? `${(v / 12).toFixed(v % 12 ? 2 : 0)} ft (${Math.round(v * 25.4).toLocaleString()} mm)` : `${inFrac(v)}" (${(v * 25.4).toFixed(v * 25.4 >= 100 ? 1 : 2)} mm)`;
