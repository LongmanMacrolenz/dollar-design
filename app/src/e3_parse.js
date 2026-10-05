
/* ── 한 줄 해석: parseLine(text, qty) ── */
// 품목: 텍스트에서 가장 앞에 나오는 표현을 고르고, 같은 위치면 더 긴 표현을 고른다 (예: STUD … W/2 NUTS → 스터드)
const TYPE_RULES = [
  [/\bSET\s*(?:SCREW|SCR)S?\b|\bS(?:CREW|CR)\s+SET\b|무두\s*(?:볼트|나사)|세트\s*스크[류루]|셋트?\s*스[크쿠][류루]|멈춤\s*나사|止めねじ|イモネジ|\bGRUB\s*SCREW|\bGEWINDESTIFT|\bSSS\b|\bISO\s*402[6-9]\b|\bDIN\s*91[3-6]\b|\bKS\s*B\s*1028\b|\bJIS\s*B\s*1177\b|\bDIN\s*55[13]\b|\bDIN\s*438\b|\bISO\s*776[67]\b|\bISO\s*743[4-6]\b/, 'setscrew'],
  [/\bSHCS\b|\bSCHS\b|\bSHSC\b|\bSOC(?:KET)?\s*(?:HD|HEAD)\s*CAP|\bS(?:CREW|CR)\s+CAP\s+(?:SOCKET|SOC|SKT)\b|\bCAP\s+S(?:CREW|CR)\s+(?:SOCKET|SOC|SKT)\b|\bSOCKET\s+HEAD\s+CAP|렌치\s*볼트|구멍\s*붙이\s*볼트|六角穴付き?ボルト|\bZYLINDERSCHRAUBE|\bISO\s*4762\b|\bISO\s*12474\b|\bDIN\s*912\b|\bJIS\s*B\s*1176\b|\bKS\s*B\s*1003\b|\bNAS\s*1352/, 'shcs'],
  [/\bFHSCS\b|\bFHCS\b|\bFLAT\s*(?:HD|HEAD)\s*(?:SOC|SKT|SOCKET|CAP)|접시\s*머리|접시\s*렌치|皿ボルト|\bSENKSCHRAUBE|\bISO\s*10642\b|\bDIN\s*7991\b|\bJIS\s*B\s*1194\b/, 'fhcs'],
  [/\bBHSCS\b|\bBHCS\b|\bBUTTON\s*(?:HD|HEAD)|버튼\s*(?:머리|볼트)|ボタンボルト|\bISO\s*7380\b/, 'bhcs'],
  [/\bHHCS\b|\bHEX\s*(?:HD|HEAD)?\s*(?:BOLT|CAP\s*SCREW|SCREW|SCR)\b|\bBOLT\s+HEX\b|\bCAP\s*SCR(?:EW)?\s+HEX\b|육각\s*볼트|六角ボルト|SECHSKANTSCHRAUBE|\bISO\s*401[47]\b|\bISO\s*8676\b|\bISO\s*8765\b|\bDIN\s*93[13]\b|\bDIN\s*96[01]\b|\bJIS\s*B\s*1180\b|\bKS\s*B\s*1002\b/, 'hexbolt'],
  [/\bH(?:VY|EAVY)\s*HEX\s*NUTS?\b|\bNUTS?\s+H(?:VY|EAVY)\s*HEX\b|헤비\s*(?:육각)?\s*너트/, 'heavynut'],
  [/\bNUTS?\b|너트|ナット|MUTTER\b|\bISO\s*403[2-6]\b|\bISO\s*8673\b|\bDIN\s*934\b|\bDIN\s*439\b|\bDIN\s*985\b|\bJIS\s*B\s*1181\b|\bKS\s*B\s*1012\b/, 'nut'],
  [/\bSTUDS?\b|스터드|スタッド|\bDIN\s*93[89]\b|\bDIN\s*835\b|\bDIN\s*976\b|\bB18\.31\.2\b/, 'stud'],
  // 'WASHER, LOCK' 'WASHER, SPRING LOCK'처럼 뒤집힌 순서도 와셔보다 길게 잡혀 스프링 와셔가 된다
  [/\bLKWASH|\bLOCK\s*WASHER|\bLOCKWASHER|\bSPRING\s*WASHER|\bWASHERS?\s+(?:SPRING\s+)?LOCK\b|\bWASHERS?\s+SPRING\b|(?:스프링|로크|록)\s*(?:와샤|와셔|워셔)|ばね座金|スプリングワッシャ|\bDIN\s*127\b|\bKS\s*B\s*1324\b|\bJIS\s*B\s*1251\b|\bB18\.21\.1\b/, 'lockwasher'],
  [/\bWASHERS?\b|\bFW\b|\bWSHR\b|와셔|와샤|워셔|座金|ワッシャ|SCHEIBE|\bISO\s*7089\b|\bISO\s*7090\b|\bDIN\s*125\b|\bJIS\s*B\s*1256\b|\bKS\s*B\s*1326\b|\bF436\b/, 'washer'],
  [/\bHANGER\s*RODS?\b|행거\s*볼트|전산\s*볼트|全ねじ|寸切|\bATR\b|\bALL[\s-]*THREAD(?:ED)?\s*ROD|\bTHREADED\s*ROD|\bTHD\s*ROD|GEWINDESTANGE|\bDIN\s*975\b|\bB18\.31\.3\b/, 'rod'],
  [/\bANCHOR\s*(?:BOLT|ROD)S?\b|앵커\s*볼트|アンカーボルト|\bF1554\b/, 'anchor'],
  [/\bEXPANSION\s*ANCHOR|\bWEDGE\s*ANCHOR|\bSLEEVE\s*ANCHOR|\bICC-?ES\b|세트\s*앵커|케미컬\s*앵커/, 'expanchor'],
  [/HELI-?COIL|\bTHREAD(?:ED)?\s*INSERTS?\b|\bINSERTS?\b|헬리\s*코일|인서트/, 'insert'],
  [/\bRIVETS?\b(?!\s*NUT)|리벳(?!\s*너트)|リベット/, 'rivet'],
  [/\bSNAP\s*RINGS?\b|\bRETAINING\s*RINGS?\b|\bCIRCLIPS?\b|스냅\s*링|멈춤\s*링|止め輪|\bDIN\s*47[12]\b/, 'ring'],
  [/\bDOWEL|\bSPRING\s*PINS?\b|\bROLL\s*PINS?\b|\bCOTTER|\bPINS?\b|평행\s*핀|스프링\s*핀|ピン|\bISO\s*8734\b|\bISO\s*8752\b|\bISO\s*2338\b/, 'pin'],
  [/\bO-?RINGS?\b|오\s*링|Oリング|\bAS\s*568/, 'oring'],
  [/\bGASKETS?\b|가스켓|개스킷|ガスケット|\bB16\.20\b/, 'gasket'],
  [/\bKEY\s+(?:PARALLEL|WOODRUFF|TAPER)|\bPARALLEL\s*KEYS?\b|\bDIN\s*6885\b|평행\s*키|\bISO\s*773\b/, 'key'],
  [/\bDISC\s*SPRINGS?\b|\bBELLEVILLE|접시\s*스프링|皿ばね|\bDIN\s*2093\b/, 'discspring'],
  [/\bSELF[\s-]*CLINCH|\bPEM\b|\bCLINCH/, 'clinch'],
  [/なべ小ねじ|小ねじ|\bMACHINE\s*SCREWS?\b|\bMS\s*2469\d|\bPAN\s*(?:HD|HEAD)|냄비\s*머리|십자\s*나사|\bISO\s*7045\b|\bISO\s*1207\b/, 'machinescrew'],
  [/\bS(?:CREW|CR)S?\s+CAP\b|\bCAP\s*S(?:CREW|CR)S?\b/, 'capscrew'],
  [/볼트|\bBOLTS?\b|ボルト|SCHRAUBE/, 'bolt'],
  [/\bSCREWS?\b|나사|ねじ/, 'screw'],
];
/* 같은 품목군이지만 카탈로그 표준품이 아닌 변형 (나비너트·플랜지 볼트·홈붙이 멈춤나사 등).
   표준품(육각너트·ISO 4017 등)으로 바꿔 매칭하지 않고 엔지니어 견적으로 돌린다.
   [키, 정규식, 적용 품목(null = 모두), 바꿀 품목, 이름, 치수 규격, 제외 정규식, 공급 불가 여부] */
const VARIANT_RULES = [
  ['wing', /\bWING\s*NUTS?\b|나비\s*너트|蝶\s*ナット|FL(?:Ü|UE?)GELMUTTER|\bDIN\s*315\b|\bASME\s*B18\.17\b/, ['nut', 'heavynut', 'unknown'], 'nut', '나비너트', 'DIN 315'],
  ['flangenut', /\bFLANGE[DS]?\s*(?:HEX\s*)?(?:LOCK\s*)?NUTS?\b|\bHEX\s*FLANGE\s*NUTS?\b|\bNUTS?\s+(?:HEX\s+)?FLANGE[DS]?\b|플랜지\s*너트|フランジ\s*ナット|\bISO\s*4161\b|\bDIN\s*6923\b|\bISO\s*10663\b/, ['nut', 'heavynut'], 'nut', '플랜지 너트', 'ISO 4161 · DIN 6923'],
  ['acorn', /\bACORN\b|\bCAP\s*NUTS?\b|\bDOME[D]?\s*NUTS?\b|\bNUTS?\s+(?:HEX\s+)?(?:ACORN|CAP|DOME)\b|캡\s*너트|袋\s*ナット|HUTMUTTER|\bDIN\s*158[67]\b/, ['nut', 'heavynut'], 'nut', '캡너트 (둥근 머리)', 'DIN 1587'],
  ['coupling', /\bCOUPL(?:ING|ER)\s*NUTS?\b|\bLONG\s*NUTS?\b|\bEXTENSION\s*NUTS?\b|\bROD\s*COUPL(?:ING|ER)S?\b|커플링\s*너트|長\s*ナット|\bDIN\s*6334\b/, ['nut', 'heavynut', 'rod', 'unknown'], 'nut', '커플링(롱) 너트', 'DIN 6334'],
  ['castle', /\bCASTLE\b|\bCASTELLATED\b|\bSLOTTED\s*(?:HEX\s*)?NUTS?\b|홈붙이\s*너트|溝付き?\s*ナット|\bDIN\s*93[57]\b|\bISO\s*7035\b/, ['nut', 'heavynut'], 'nut', '홈붙이(캐슬) 너트', 'DIN 935'],
  ['sqnut', /\bSQ(?:UARE)?\.?\s*NUTS?\b|\bNUTS?\s+SQ(?:UARE)?\b|사각\s*너트|四角\s*ナット|\bDIN\s*55[57]\b|\bDIN\s*562\b/, ['nut', 'heavynut'], 'nut', '사각 너트', 'DIN 557'],
  ['weldnut', /\bWELD\s*NUTS?\b|용접\s*너트|溶接\s*ナット|\bDIN\s*92[89]\b/, ['nut', 'heavynut'], 'nut', '용접 너트', 'DIN 929'],
  ['tnut', /\bT[\s-]?(?:SLOT\s*)?NUTS?\b|T\s*너트|\bDIN\s*508\b/, ['nut', 'heavynut', 'unknown'], 'nut', 'T 너트', 'DIN 508'],
  ['allmetal', /\bALL[\s-]*METAL\s*LOCK|\bPREVAILING[\s-]*TORQUE|\bSTOVER\b|\bTOP[\s-]*LOCK\b|\bCENTER[\s-]*LOCK\b|\bTWO[\s-]*WAY\s*LOCK|\bDIN\s*980\b|\bISO\s*704[23]\b|\bISO\s*7719\b/, ['nut', 'heavynut'], 'nut', '전금속 풀림방지 너트', 'ISO 7042 · DIN 980'],
  ['rivetnut', /\bRIVET\s*NUTS?\b|\bRIVNUTS?\b|\bNUTSERT|리벳\s*너트/, null, 'nut', '리벳 너트 (블라인드 너트)', '제조사 규격', null, true],
  ['flangebolt', /\bHEX\s*FLANGE[D]?\s*(?:HEAD\s*)?(?:BOLTS?|SCREWS?|CAP\s*SCREWS?)\b|\bFLANGE[DS]?\s*(?:HEX\s*)?(?:HEAD\s*)?(?:BOLTS?|SCREWS?)\b|\bHEX\s*(?:HD|HEAD)\s*FLANGE|\bBOLTS?\s+(?:HEX\s+)?FLANGE[D]?\b|플랜지\s*볼트|フランジ\s*(?:付き?)?\s*ボルト|\bISO\s*4162\b|\bDIN\s*6921\b|\bISO\s*15071\b|\bASME\s*B18\.2\.7\b/, ['hexbolt', 'bolt', 'capscrew', 'screw'], 'hexbolt', '육각 플랜지 볼트', 'ISO 4162 · DIN 6921', /\bB7M?\b|\bB8M?\b|\bB16\b|\bL7M?\b|\bA193\b|\bA320\b|W\/\s*2|\bNUTS\b/],
  ['sqbolt', /\bSQ(?:UARE)?\.?\s*(?:HD|HEAD)\b|사각\s*(?:머리)?\s*볼트|四角ボルト/, ['bolt', 'hexbolt', 'capscrew'], 'bolt', '사각머리 볼트', 'ASME B18.2.1 (사각머리)'],
  ['carriage', /\bCARRIAGE\s*BOLTS?\b|\bCUP\s*(?:HEAD|HD)\s*(?:SQ(?:UARE)?\s*NECK\s*)?BOLTS?|\bSQ(?:UARE)?\s*NECK\s*BOLT|마차\s*볼트|根角\s*ボルト|\bDIN\s*603\b|\bASME\s*B18\.5\b/, null, 'bolt', '마차 볼트 (둥근머리 사각목)', 'DIN 603 / ASME B18.5'],
  ['eyebolt', /\bEYE\s*BOLTS?\b|\bEYEBOLTS?\b|아이\s*볼트|アイボルト|\bDIN\s*580\b|\bASME\s*B18\.15\b/, null, 'bolt', '아이볼트', 'DIN 580'],
  ['ubolt', /\bU[\s-]?BOLTS?\b|유\s*볼트|U\s*볼트|Uボルト/, null, 'bolt', 'U볼트', '도면 기준'],
  ['tbolt', /\bT[\s-]?(?:HEAD\s*)?BOLTS?\b|\bHAMMER[\s-]*HEAD\s*BOLTS?\b|T\s*볼트|\bDIN\s*186\b|\bDIN\s*787\b/, null, 'bolt', 'T볼트', 'DIN 186'],
  ['shoulder', /\bSHOULDER\s*(?:SCREW|BOLT|SCR)S?\b|\bSHLDR\b|숄더\s*볼트|段付き?\s*ボルト|\bISO\s*7379\b|\bDIN\s*9841\b/, null, 'shcs', '숄더 볼트', 'ISO 7379'],
  ['lowhead', /\bLOW\s*(?:HEAD|HD)\b|\bLOW[\s-]*PROFILE\s*(?:SOCKET|SHCS|CAP)|저두\s*(?:렌치)?\s*볼트|低頭\s*ボルト|\bDIN\s*7984\b|\bDIN\s*6912\b/, ['shcs', 'capscrew', 'bolt', 'screw'], 'shcs', '저두 렌치볼트', 'DIN 7984'],
  ['torx', /\bTORX\b|\bHEXALOBULAR|\b6-?LOBE|\bISO\s*1457[9]\b|\bISO\s*14580\b|\bISO\s*14583\b|별\s*렌치|별\s*볼트/, null, null, '육각별(TORX) 구멍 머리', 'ISO 14579'],
  ['security', /\bTAMPER|\bSECURITY\b|\bPIN[\s-]*IN[\s-]*(?:HEX|TORX|SOCKET)|\bBREAK[\s-]*AWAY|\bSHEAR\s*(?:HEAD\s*)?BOLTS?\b|\bONE[\s-]*WAY\b|도난\s*방지/, null, null, '도난방지(보안) 머리', '제조사 규격'],
  ['lag', /\bLAG\s*(?:SCREW|BOLT)S?\b|\bCOACH\s*SCREWS?\b|코치\s*볼트|\bDIN\s*571\b/, null, 'screw', '래그 스크루 (목재용)', 'DIN 571'],
  ['tapping', /\bSELF[\s-]*(?:TAPPING|DRILLING|TAP)\b|\bTAPPING\s*SCREWS?\b|\bTEK\s*SCREWS?\b|\bSHEET\s*METAL\s*SCREWS?\b|\bWOOD\s*SCREWS?\b|\bDRYWALL\b|태핑|피스(?![톤])|タッピン|\bISO\s*1481\b|\bISO\s*7049\b|\bDIN\s*7981\b|\bDIN\s*7504\b/, null, 'screw', '태핑 나사', 'ISO 7049'],
  ['thumb', /\bTHUMB\s*SCREWS?\b|\bKNURLED\s*(?:HEAD|THUMB)|\bWING\s*SCREWS?\b|\bWING\s*BOLTS?\b|나비\s*볼트|손\s*나사|ローレット|\bDIN\s*316\b|\bDIN\s*464\b|\bDIN\s*653\b/, null, 'screw', '손나사 (나비·널링 머리)', 'DIN 316'],
  ['softtip', /\bNYLON\s*(?:TIP(?:PED)?|PAD|POINT|PLUG|PELLET)\b|\bNYLON[\s-]*TIPPED|\bBRASS\s*(?:TIP(?:PED)?|PAD)\b|\bPLASTIC\s*TIP|\bSOFT\s*TIP|\bDELRIN\s*TIP|\bNYLOK\s*(?:TIP|PLUG|PELLET)|나일론\s*팁|황동\s*팁/, ['setscrew'], 'setscrew', '소프트 팁 멈춤나사 (나일론·황동 팁)', 'ASME B18.3 (팁은 제조사 사양)'],
  ['sqset', /\bSQ(?:UARE)?\.?\s*(?:HD|HEAD)\b|사각\s*머리|四角\s*(?:頭|止め)|\bASME\s*B18\.6\.2\b|\bDIN\s*47[89]\b/, ['setscrew'], 'setscrew', '사각머리 멈춤나사', 'ASME B18.6.2'],
  ['slotted', /\bSLOT(?:TED)?\b|\bSLTD\b|홈\s*붙이|일자\s*홈|마이너스|すりわり|\bDIN\s*55[13]\b|\bDIN\s*438\b|\bISO\s*776[67]\b|\bISO\s*743[4-6]\b/, ['setscrew'], 'setscrew', '홈붙이 멈춤나사 (일자 홈)', 'ISO 4766 · DIN 551'],
  ['fender', /\bFENDER\b|\bPENNY\s*WASHERS?\b|\bLARGE\s*(?:OD|O\.D\.|DIA)\b|\bOVERSIZE[D]?\s*WASHER|대\s*와[셔샤]|\bISO\s*7093\b|\bDIN\s*9021\b/, ['washer'], 'washer', '대와셔 (큰 바깥지름)', 'ISO 7093 · DIN 9021'],
  ['sqwasher', /\bSQ(?:UARE)?\.?\s*WASHERS?\b|\bPLATE\s*WASHERS?\b|\bBEVEL(?:ED)?\s*WASHERS?\b|\bTAPER(?:ED)?\s*WASHERS?\b|사각\s*와[셔샤]|경사\s*와[셔샤]|\bDIN\s*43[456]\b/, ['washer'], 'washer', '사각·경사 와셔', 'DIN 436'],
  ['tooth', /\bTOOTH(?:ED)?\s*(?:LOCK\s*)?WASHER|\bEXT(?:ERNAL)?\.?\s*TOOTH|\bINT(?:ERNAL)?\.?\s*TOOTH|\bSTAR\s*WASHERS?\b|\bSERRATED\s*(?:LOCK\s*)?WASHERS?\b|이\s*붙이\s*와[셔샤]|\bDIN\s*679[78]\b/, ['washer', 'lockwasher'], 'lockwasher', '톱니 와셔', 'DIN 6798'],
  ['wedgelock', /NORD-?LOCK|WEDGE[\s-]*LOCK|\bHEICO\b|쐐기\s*와[셔샤]/, ['washer', 'lockwasher', 'unknown'], 'lockwasher', '쐐기형 풀림방지 와셔 (제조사 전용품)', '제조사 규격', null, true],
  ['conical', /\bCONICAL\s*(?:SPRING\s*)?WASHERS?\b|\bDIN\s*6796\b/, ['washer', 'lockwasher'], 'lockwasher', '접시형 스프링 와셔', 'DIN 6796'],
  ['sealing', /\bBONDED\s*SEAL|\bDOWTY|\bSEALING\s*WASHERS?\b|\bCOPPER\s*WASHERS?\b|\bFIBER\s*WASHERS?\b|\bNYLON\s*WASHERS?\b|\bRUBBER\s*WASHERS?\b|\bEPDM\s*WASHERS?\b|동\s*와[셔샤]|고무\s*와[셔샤]/, ['washer'], 'washer', '실링·비금속 와셔', '제조사 규격'],
];
/* 체결부품이 아닌 줄 (품목 키워드가 없을 때만 본다): 배관 부품·밸브·공구·기계 부품 */
const NONFAST_RULES = [
  ['pipe', /\bNPTF?\b|\bBSP[PT]?\b|\bNIPPLES?\b|\bPIPE\b|\bELBOWS?\b|\bTEES?\b|\bBUSHINGS?\b|\bUNIONS?\b|\bREDUCERS?\b|\bPLUGS?\b|\bCOUPLINGS?\b|\bFITTINGS?\b|\bSWAGELOK|\bFERRULES?\b|\bSOCKOLET|\bWELDOLET|니플|엘보|배관|플러그|継手|ニップル|プラグ|エルボ/],
  ['valve', /\bVALVES?\b|\bVLV\b|밸브|バルブ/],
  ['tool', /\bALLEN\s*(?:KEY|WRENCH)|\bHEX\s*(?:KEY|WRENCH)\b|\bL[\s-]?KEYS?\b|\bWRENCH(?:ES)?\b|\bSPANNERS?\b|\bSCREW\s*DRIVERS?\b|\bDRIVER\s*BITS?\b|\bSOCKET\s*(?:BIT|SET|WRENCH)S?\b|\bTAPS?\s+(?:SET|DRILL)|\bDRILL\s*BITS?\b|\bTORQUE\s*WRENCH|육각\s*렌치(?!\s*볼트)|렌치\s*(?:키|세트)|스패너|드라이버|六角\s*レンチ|スパナ|ドライバ/],
  ['nonfast', /\bBEARINGS?\b|\bMOTORS?\b|\bBRACKETS?\b|\bBRKT\b|\bPUMPS?\b|\bIMPELLERS?\b|\bSHAFTS?\b|\bGEARS?\b|\bBELTS?\b|\bSEALS?\b|\bGAUGES?\b|\bSENSORS?\b|\bFILTERS?\b|\bHOSES?\b|\bCABLES?\b|\bSPROCKETS?\b|\bPULLEYS?\b|\bHOUSINGS?\b|\bPLATES?\b|\bASSY\b|\bASSEMBLY\b|\bSPRINGS?\b|\bCHAINS?\b|\bLABELS?\b|\bPAINT\b|\bGREASE\b|\bLOCTITE\b|\bSWITCH(?:ES)?\b|\bRELAYS?\b|\bMOUNT\b|\bDWG\b|베어링|모터|브라[켓킷]|브래킷|펌프|샤프트|씰|기어|벨트|도면\s*번호|ベアリング|モーター|ポンプ/],
];
const TYPE_KO = {
  setscrew: '육각 구멍붙이 멈춤나사', shcs: '렌치볼트 (육각 구멍붙이)', fhcs: '접시머리 렌치볼트', bhcs: '버튼머리 렌치볼트', hexbolt: '육각볼트', heavyhexbolt: '헤비 육각볼트',
  nut: '육각너트', heavynut: '헤비 육각너트', stud: '스터드볼트', washer: '평와셔', lockwasher: '스프링 와셔', rod: '전산볼트', anchor: '앵커볼트', bolt: '볼트 (머리 형상 미기재)',
  capscrew: '캡스크루 (머리 형상 미기재)', screw: '나사', machinescrew: '작은 나사', expanchor: '후설치 앵커', insert: '나사 인서트', rivet: '블라인드 리벳', ring: '멈춤링',
  pin: '핀', oring: 'O링', gasket: '개스킷', key: '기계 키', discspring: '접시 스프링', clinch: '클린칭 너트', pipe: '배관 부품 (체결부품 아님)', valve: '밸브 (체결부품 아님)',
  tool: '공구 (체결부품 아님)', nonfast: '체결부품 아님', unknown: '품목 미확인',
};
const THREADED = new Set(['setscrew', 'shcs', 'fhcs', 'bhcs', 'hexbolt', 'heavyhexbolt', 'nut', 'heavynut', 'stud', 'rod', 'anchor', 'bolt', 'capscrew', 'screw', 'machinescrew', 'insert', 'clinch']);
const SOCKET = new Set(['setscrew', 'shcs', 'fhcs', 'bhcs']);
const NUTS = new Set(['nut', 'heavynut', 'clinch']);
const NO_THREAD = new Set(['rivet', 'pin', 'key', 'ring', 'oring', 'gasket', 'discspring', 'pipe', 'valve', 'tool', 'nonfast']);
// 길이가 있어야 하는 품목 (너트·와셔는 길이를 읽지 않는다)
const NEEDS_LEN = new Set(['setscrew', 'shcs', 'fhcs', 'bhcs', 'hexbolt', 'heavyhexbolt', 'stud', 'anchor', 'bolt', 'capscrew', 'screw', 'machinescrew', 'rod']);

function bomNorm(s) {
  let t = unVulgar(s).normalize('NFKC')
    .replace(/[×✕✖＊*]/g, ' X ').replace(/[″“”]/g, '"').replace(/[’′]/g, "'").replace(/''/g, '"').replace(/[‐‑‒–—―−]/g, '-').replace(/[Øø⌀φΦ]/g, ' Ø')
    .replace(/(\d),(\d)(?!\d{2})/g, '$1.$2')
    // .500 → 0.500 (앞에 0이 없는 인치 소수)
    .replace(/(?<![0-9A-WYZa-wyz.])\.(?=\d)/g, '0.');
  return t.toUpperCase().replace(/[,;|]/g, ' ').replace(/\s+/g, ' ').trim();
}
function firstRule(U, rules) {
  let best = null;
  for (const [re, v] of rules) { const m = U.match(re); if (m && (!best || m.index < best.i || (m.index === best.i && m[0].length > best.n))) best = { v, i: m.index, n: m[0].length }; }
  return best;
}
function stdTokens(U) {
  const out = [], add = (i, s) => { if (!out.some(o => o.s === s)) out.push({ i, s }); };
  const R = [[/\bISO\s*(\d{3,5})(?:-(\d))?/g, m => 'ISO ' + m[1] + (m[2] && /^(898|3506|10683|10684|15156)$/.test(m[1]) ? '-' + m[2] : '')], [/\bDIN\s*(\d{2,4})\s*(B)?(?![\w])/g, m => 'DIN ' + m[1] + (m[2] ? ' B' : '')],
    [/\bKS\s*B\s*(\d{4})/g, m => 'KS B ' + m[1]], [/\bJIS\s*B\s*(\d{4})/g, m => 'JIS B ' + m[1]], [/\b(?:ASME\s*)?(B(?:18|16|1)\.\d+(?:\.\d+)?)\b/g, m => 'ASME ' + m[1]],
    [/\bASTM\s*([A-F]\d{2,4}M?)\b/g, m => 'ASTM ' + m[1]], [/\bNAS\s*(\d{3,4})/g, m => 'NAS' + m[1]], [/\bMS\s*(\d{5})/g, m => 'MS' + m[1]], [/\bAN\s*(\d{2,4})(?=[-\s]|$)/g, m => 'AN' + m[1]],
    [/\bAMS\s*(\d{4})/g, m => 'AMS ' + m[1]], [/\bAS\s*568/g, () => 'AS568'], [/\bNACE\s*MR\s*0?175/g, () => 'NACE MR0175'], [/\bEN\s*10204/g, () => 'EN 10204']];
  for (const [re, f] of R) for (const m of U.matchAll(re)) add(m.index, f(m));
  return out.sort((a, b) => a.i - b.i).map(o => o.s);
}
/* 수량: '1,000' '2,500 EA' '(4 EA)' '1 BOX (100)' '2/SET' '0' '-5' 'A/R' '3 M' '1.000'
   issue 코드는 bomMatch가 '수량 확인' 문구로 바꾼다 */
const BOM_QTY_MAX = 1000000;   // 이보다 많은 수량은 확정하지 않고 '수량 확인' (견적함 CART_QTY_MAX와 같은 값)
const QTY_UNIT = /(SETS?|세트|조|EA|PCS?\.?|PC|개|本|個|STK\.?|STÜCK|M|LG|BOX(?:ES)?|BX|PKGS?|PACKS?|PK|BAGS?|CTNS?|CARTONS?|박스|봉|팩|PRS?|PAIRS?|쌍|LOTS?|ROLLS?)/;
function parseQty(q) {
  const raw = String(q ?? '').trim();
  if (!raw) return null;
  let s = raw.normalize('NFKC').toUpperCase().replace(/[()（）]/g, m => /[(（]/.test(m) ? ' (' : ') ').replace(/\s+/g, ' ').trim();
  if (/^(A\s*\/\s*R|AR|AS\s*REQ(?:UIRED|'D|D)?\.?|AS\s*NEEDED|필요량|소요량|適量|REF\.?|참고)$/.test(s)) return { n: 1, unit: 'EA', raw, issue: 'ar' };
  const dot3 = /^\d{1,3}\.\d{3}(?:\s|$)/.test(s) && !/^\d+\.\d{3}\s*M\b/.test(s);
  s = s.replace(/(\d)[,，](?=\d{3}(?:\D|$))/g, '$1');
  const neg = /^-\s*\d/.test(s);
  // 지수 표기 (엑셀이 '1E+03'으로 바꾼 수량): 값으로 읽되 확정하지 않는다 (수량 확인)
  const ex = s.match(/^([+-]?\d+(?:\.\d+)?E[+-]?\d{1,3})(?![\d.])/);
  if (ex) { const v = Number(ex[1]); return { n: Number.isFinite(v) ? v : 0, unit: 'EA', raw, issue: v < 0 ? 'neg' : v === 0 ? 'zero' : 'exp' }; }
  // 숫자가 없는 수량 ('abc', 'TBD'): 1개로 계산하되 수량 확인으로 둔다
  if (!/\d/.test(s)) return { n: 1, unit: 'EA', raw, issue: 'nonnum' };
  const mix = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\b/);   // '2 1/2'
  if (mix && +mix[3]) s = String(+mix[1] + mix[2] / mix[3]) + s.slice(mix[0].length);
  const per = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(SETS?|ASSY|ASSEMBLY|UNITS?|대|조|세트|EA)\b/);
  if (per) return { n: +per[1], unit: 'EA', raw, issue: 'per', per: per[2] };
  const m = s.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + QTY_UNIT.source + '?'));
  if (!m) return null;
  const n = +m[1], u = m[2] || '';
  const r = { n: neg ? -n : n, unit: /SET|세트|조/.test(u) ? 'SET' : /^M$/.test(u) ? 'M' : 'EA', raw };
  if (/BOX|BX|PKG|PACK|PK|BAG|CTN|CARTON|박스|봉|팩|ROLL/.test(u)) {
    // 입수: '1 BOX (100)' '2 BOX X 100' 'BOX OF 100' '100EA/BOX'
    const k = s.match(/\(\s*(\d+)\s*(?:EA|PCS?|개)?\s*(?:\/\s*\w+)?\s*\)|\bX\s*(\d+)\s*(?:EA|PCS?|개)?\b|\bOF\s*(\d+)\b|(\d+)\s*(?:EA|PCS?|개)\s*\/\s*(?:BOX|BX|PK|PKG|BAG|CTN)/);
    const per2 = k ? +(k[1] || k[2] || k[3] || k[4]) : null;
    if (per2 && per2 > 1) Object.assign(r, { n: n * per2, unit: 'EA', issue: 'packconv', pack: { n, u, per: per2 } });
    else Object.assign(r, { issue: 'pack', pack: { n, u } });
  } else if (/PR|PAIR|쌍/.test(u)) r.issue = 'pair';
  else if (/LOT/.test(u)) r.issue = 'lot';
  if (neg) r.issue = 'neg';
  else if (n === 0) r.issue = 'zero';
  else if (dot3 && !r.issue) r.issue = 'dot3';
  else if (r.unit !== 'M' && !r.issue && n % 1) r.issue = 'frac';
  if (!r.issue && r.n > BOM_QTY_MAX) r.issue = 'big';
  return r;
}
const fracVal = inVal;

// 미터 나사: M10 / M8x1.25x20 / M6-1.0 x 16LG / M12 x 1M / M10x1.5 x 1.5D / M16x2.0-6g x 80 / M10-30 / M8-1.25-25
const QTY_AHEAD = '(?!\\s*(?:PCS?|EA|개|SETS?|本|個|STK)\\b)';
function parseMetric(U) {
  let mm = null;
  for (const x of U.matchAll(/(?<![A-Z0-9.\/#-])M\s?(\d{1,2}(?:\.\d{1,2})?)(?![\d.])/g)) {
    // M3AA(모터 형번)처럼 바로 뒤에 글자가 붙으면 나사 호칭이 아니다 (X·LH·L50은 허용)
    const nx = U.slice(x.index + x[0].length);
    if (/^[A-Z]/.test(nx) && !/^(?:X|LH\b|L\d|LG\b|L\b|P\d)/.test(nx)) continue;
    mm = x; break;
  }
  if (!mm) return null;
  const size = 'M' + mm[1], d = parseFloat(mm[1]);
  let pos = mm.index + mm[0].length, tol = null; const toks = [];
  const tokRe = new RegExp('^\\s*(X|-|P)\\s*(\\d+(?:\\.\\d+)?)(?![\\d.\\/])\\s*(MM\\b|M\\b|D\\b|LG\\b|L\\b)?' + QTY_AHEAD);
  for (let k = 0; k < 4; k++) {
    const rest = U.slice(pos); let r;
    if ((r = rest.match(/^\s*-\s*([3-8]\s?[GHEF](?:\s?[3-8][GHEF])?)(?![\w])/))) { tol = r[1].replace(/\s/g, ''); pos += r[0].length; continue; }
    r = rest.match(tokRe);
    // 'M8-1.25-25'처럼 대시로 이어 쓴 표기만 두 번째 대시를 받는다 ('M8X30-12.9'의 -12.9는 강도 구분)
    if (!r || (r[1] === '-' && toks.length && toks[toks.length - 1].sep !== '-')) break;
    toks.push({ sep: r[1], raw: r[2], v: +r[2], unit: (r[3] || '').trim() }); pos += r[0].length;
  }
  const coarse = mmPitch(size), fine = FINE_MM[size] || [];
  const pitchy = t => !t.unit && (t.sep === 'P' || ((t.v === coarse || fine.includes(t.v) || (/\./.test(t.raw) && t.v <= d * .25 + .5 && t.v <= 6)) && (/\./.test(t.raw) || t.v <= d * .25)));
  let pitch = null, len = null;
  if (toks.length && pitchy(toks[0])) { pitch = toks[0].v; toks.shift(); }
  if (toks.length) { const t = toks[0]; len = { v: t.unit === 'M' ? t.v * 1000 : t.unit === 'D' ? t.v * d : t.v, raw: t.raw + (t.unit === 'M' ? ' m' : t.unit === 'D' ? 'D' : ''), byD: t.unit === 'D' }; }
  if (!len) { const r = U.slice(mm.index).match(/(?:\bL\s*=\s*|\bL(?=\d)|길이\s*:?\s*)(\d+(?:\.\d+)?)(?![\d.])/); if (r) len = { v: +r[1], raw: r[1] }; }
  return { size, d, pitch, len, tol, end: pos, start: mm.index };
}
// 인치 나사: 3/8-16 UNC-3A / #10-32 / 10-32 / 0.375-16 / .500-13 / 1-1/8-8UN-2A / 1-8 / 3/4-10 UCN
const SERIES_FIX = { UCN: 'UNC', NUC: 'UNC', UNCC: 'UNC', NC: 'UNC', 'N.C.': 'UNC', NF: 'UNF', 'N.F.': 'UNF', UFN: 'UNF', NEF: 'UNEF' };
// '1 3/8-6 UNC'처럼 띄어 쓴 대분수는 먼저 대분수로 본다. 산 수가 그 지름의 UNC·UNF·8UN이 아니고 계열도 없으면
// ('2 3/8-16'의 2가 수량일 수 있음) 대분수로 읽지 않고 예전처럼 분수 부분만 읽는다.
const INCH_THD_TAIL = '"?\\s*-\\s*(\\d{1,3}(?:\\.5)?)(?![\\d\\/.])\\s*(UNJF|UNJC|UNJ|UNEF|UNC|UNF|8UN|UNS|UNR|UN|UCN|NUC|UFN|NEF|NC|NF|N\\.C\\.|N\\.F\\.)?(?![A-Z])(?:\\s*-?\\s*([123])\\s*([AB])(?![\\w]))?';
const INCH_THD_RE = [new RegExp('(?<![\\w.\\/-])(' + MIXED_IN + '|#\\s?\\d{1,2}|\\d+\\.\\d+|\\d+-\\d+\\/\\d+|\\d+\\/\\d+|\\d{1,2})' + INCH_THD_TAIL, 'g'),
  new RegExp('(?<![\\w.\\/-])(#\\s?\\d{1,2}|\\d+\\.\\d+|\\d+-\\d+\\/\\d+|\\d+\\/\\d+|\\d{1,2})' + INCH_THD_TAIL, 'g')];
function parseInch(U) { return inchScan(U, INCH_THD_RE[0]) || inchScan(U, INCH_THD_RE[1]); }
function inchScan(U, re) {
  for (const m of U.matchAll(re)) {
    const mixed = /^\d\s\d/.test(m[1]);
    let dRaw = mixed ? m[1].replace(/\s+/, '-') : m[1].replace(/\s/g, ''), num = false;
    const tpi = +m[2];
    // 6-32 · 10-24 · 4-40처럼 '#' 없이 쓴 번호 호칭: 정수 + 산 수 20 이상이면 번호 호칭 (1-8 · 2-4.5 같은 인치 지름과 산 수 범위가 겹치지 않음)
    if (/^\d{1,2}$/.test(dRaw)) {
      if (tpi >= 20 && IN_NUM['#' + dRaw] != null) { dRaw = '#' + dRaw; num = true; }
      else if (+dRaw > 6) continue;
    }
    const dia = fracVal(dRaw);
    if (!(dia >= .05 && dia <= 6.5) || !(tpi >= 4 && tpi <= 90)) continue;
    if (/\./.test(m[1]) && !UN_TPI.some(r => near(r[0], dia, .003))) continue;
    if (mixed) { const r = unRow(dia); if (!(r && (m[3] || tpi === r[1] || tpi === r[2] || (tpi === 8 && dia > 1) || (tpi === 4 && dia > 4)))) return null; }   // 4" 초과 4산 = 4UN (H28 표 2.11)
    const s0 = m[3] || null, series = s0 && SERIES_FIX[s0] ? SERIES_FIX[s0] : s0;
    return { d: UN_TPI.find(r => near(r[0], dia, .003))?.[0] ?? dia, dRaw, tpi, series, seriesRaw: s0, num, tol: m[4] ? m[4] + m[5] : null, start: m.index, end: m.index + m[0].length, mixed: mixed ? m[1] : null };
  }
  return null;
}
// 나사 뒤 길이: 'X 1-1/4' 'X 2.00' 'X 120MM' 'LG 3' 'L=2' (오타 한 단어는 건너뜀: '3/4-10 UCN X 3' → UCN은 위에서 처리)
function parseInchLen(rest) {
  const r = rest.match(/^\s*(?:[A-Z][A-Z0-9]{0,4}\.?\s+(?=X\b|X\s*\d))?(?:X|LG\.?|L\s*=|LENGTH)\s*(\d+-\d+\/\d+|\d+\s\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(?![\d\/])\s*("|IN\b|INCH(?:ES)?\b|FT\b|'|MM\b|LG\b|LONG\b)?/);
  if (!r) return null;
  const v = fracVal(r[1]), u = r[2] || '';
  if (!isFinite(v)) return null;
  if (/MM/.test(u)) return { v: v / 25.4, raw: r[1] + ' mm', mm: v };
  const ft = /FT|'/.test(u);
  return { v: ft ? v * 12 : v, raw: r[1] + (ft ? ' ft' : '"'), ft };
}
// 숫자 표기 없는 인치 호칭: FW 1/2 F436, LKWASH 3/8, EXPANSION ANCHOR 1/2 X 5-1/2, F436 1", 1/4 NF
function parseBareInch(U) {
  const m = U.match(new RegExp('(?<![\\w.\\/-])(' + MIXED_IN + '|#\\s?\\d{1,2}|\\d+-\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?="|\\s*IN(?:CH)?\\b))"?(?![\\w\\/-])(?:\\s*(UNC|UNF|8UN|UCN|NC|NF)\\b)?'));
  if (!m) return null;
  const v = fracVal(/^#/.test(m[1]) ? m[1].replace(/\s/g, '') : m[1]);
  const s0 = m[2] || null;
  return isFinite(v) && v > 0 ? { d: v, dRaw: m[1], series: s0 && SERIES_FIX[s0] ? SERIES_FIX[s0] : s0, seriesRaw: s0, start: m.index, end: m.index + m[0].length } : null;
}
// 나사 뒤에 떨어져 있는 길이: 'M16 STUD x 150' '육각볼트 M10 30L' 'HHCS 1/2-13 GR5 X 2'
function looseLen(rest, inch) {
  let r = rest.match(new RegExp('\\bX\\s*(\\d+-\\d+\\/\\d+|\\d+\\s\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)(?![\\d\\/.])\\s*(MM\\b|M\\b|"|IN\\b|INCH(?:ES)?\\b|FT\\b|\'|LG\\b|L\\b|LONG\\b|D\\b)?' + QTY_AHEAD));
  if (r && r[2] !== 'D') return lenFrom(r[1], r[2], inch);
  r = rest.match(new RegExp('(?<![\\w.\\/-])(\\d+-\\d+\\/\\d+|' + MIXED_IN + '|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(MM)?\\s*' + (inch ? '"?\\s*(?:LG|LONG)\\b' : '(?:L|LG|LONG)\\b')));
  if (r) return lenFrom(r[1], r[2] || '', inch);
  return null;
}
function lenFrom(s, u = '', inch) {
  const v = fracVal(s); if (!isFinite(v) || v <= 0) return null;
  u = (u || '').trim();
  if (inch) {
    if (u === 'MM') return { in: v / 25.4, raw: s + ' mm', mmStated: v };
    if (u === 'FT' || u === "'") return { in: v * 12, raw: s + ' ft', ft: true };
    return { in: v, raw: s + '"' };
  }
  if (u === '"' || u === 'IN' || /^INCH/.test(u)) return { mm: v * 25.4, raw: s + '"', inStated: v };
  if (u === 'M') return { mm: v * 1000, raw: s + ' m' };
  return { mm: v, raw: s };
}
