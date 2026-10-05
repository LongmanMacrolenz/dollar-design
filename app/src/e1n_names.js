/* 공식 영문 품명 (오너 결정 2 · integ/en_names.json 178개, out_gn/work/gen_names.py로 만든 표 — 손으로 고치지 말고 JSON을 고쳐 다시 만든다)
   키는 scope:id. 한국어 이름으로 찾지 않는다 (이름은 바뀌고 id는 겹친다).
   값 = [영문 공식명, 규격 태그 enStd, 한국어 이름(대조용)].
   JSON의 NEW 'sw'(해수·염화물용 6Mo·수퍼듀플렉스)는 페이지 품목 id 'smo'로 둔다: METRIC 'sw'(스프링와셔, 6번·2-6장·SW- 형번)와 겹치지 않게. */
const BOM_EN = {
  "METRIC:hbf": ["Hexagon Head Screw", "ISO 4017 · KS B 1002", "육각볼트 (온나사)"],
  "METRIC:hbp": ["Hexagon Head Bolt", "ISO 4014 · KS B 1002", "육각볼트 (반나사)"],
  "METRIC:scs": ["Hexagon Socket Head Cap Screw", "ISO 4762 · KS B 1003", "렌치볼트 (육각 구멍붙이)"],
  "METRIC:csk": ["Hexagon Socket Countersunk Head Screw", "ISO 10642 · KS B ISO 10642", "접시머리 렌치볼트"],
  "METRIC:hn": ["Hexagon Regular Nut (Style 1)", "ISO 4032 · KS B 1012", "육각너트 (스타일 1)"],
  "METRIC:pw": ["Plain Washer, Normal Series", "ISO 7089 · KS B 1326", "평와셔"],
  "METRIC:sw": ["Spring Lock Washer", "DIN 127 B · KS B 1324", "스프링와셔"],
  "METRIC:tr": ["Threaded Rod, 1 m", "DIN 976-1 A · DIN 975 (withdrawn)", "전산볼트 (1m)"],
  "METRIC:short:hbf": ["Hexagon Head Screw", "ISO 4017 · KS B 1002", "육각볼트 온나사"],
  "METRIC:short:hbp": ["Hexagon Head Bolt", "ISO 4014 · KS B 1002", "육각볼트 반나사"],
  "METRIC:short:scs": ["Hexagon Socket Head Cap Screw", "ISO 4762 · KS B 1003", "렌치볼트"],
  "METRIC:short:csk": ["Hexagon Socket Countersunk Head Screw", "ISO 10642", "접시머리 렌치볼트"],
  "METRIC:short:pw": ["Plain Washer, Normal Series", "ISO 7089 · KS B 1326", "평와셔"],
  "METRIC:short:sw": ["Spring Lock Washer", "DIN 127 B · KS B 1324", "스프링와셔"],
  "METRIC:short:hn": ["Hexagon Regular Nut (Style 1)", "ISO 4032 · KS B 1012", "육각너트 스타일 1"],
  "METRIC:short:tr": ["Threaded Rod, 1 m", "DIN 976-1 A · DIN 975 (withdrawn)", "전산볼트 1 m"],
  "INCH:b7": ["Stud Bolt with Heavy Hex Nuts, A193 B7 / A194 2H", "ASTM A193 · ASTM A194 · ASME B16.5", "스터드볼트 B7 + 2H 헤비너트"],
  "INCH:b7m": ["Sour Service Stud Bolt, A193 B7M / A194 2HM", "ASTM A193 · ASTM A194 · NACE MR0175", "사워 서비스용 스터드 B7M + 2HM"],
  "INCH:b8": ["Stainless Steel Stud Bolt, A193 B8·B8M / A194 8·8M", "ASTM A193 · ASTM A194 · ASME B16.5", "스테인리스 스터드 B8·B8M + 8·8M"],
  "INCH:l7": ["Low-Temperature Stud Bolt, A320 L7 / A194 7L", "ASTM A320 · ASTM A194 · ASME B16.5", "저온용 스터드 A320 L7 + A194 7L"],
  "INCH:hh": ["Heavy Hex Nut (Nut Only)", "ASTM A194 · ASME B18.2.2", "플랜트용 헤비 육각너트 (단품)"],
  "INCH:a325": ["High Strength Structural Bolt Set, A325·A490", "ASTM F3125 · ASTM A563 · ASTM F436", "고장력 구조용 볼트 세트 (A325·A490)"],
  "INCH:j429": ["Hex Cap Screw, SAE Grade 5·8", "ASME B18.2.1 · SAE J429", "인치 육각볼트 SAE Grade 5·8"],
  "INCH:a574": ["Alloy Steel Socket Head Cap Screw", "ASME B18.3 · ASTM A574", "인치 렌치볼트 (A574)"],
  "INCH:f593": ["Stainless Steel Bolt and Nut", "ASTM F593 · ASTM F594", "인치 스테인리스 볼트·너트 (F593·F594)"],
  "INCH:f1554": ["Anchor Bolt", "ASTM F1554", "기초 앵커볼트 (F1554)"],
  "INCH:fl-set": ["Flange Stud Bolt Set, NPS ${r[0]} Class 150", "ASME B16.5", "플랜지 스터드 세트 NPS ${r[0]} Class 150"],
  "INCH:short:b7": ["Stud Bolt with Heavy Hex Nuts, A193 B7 / A194 2H", "ASTM A193 · ASTM A194 · ASME B16.5", "스터드볼트 B7 + 2H"],
  "INCH:short:b7m": ["Sour Service Stud Bolt, A193 B7M / A194 2HM", "ASTM A193 · ASTM A194 · NACE MR0175", "사워용 스터드 B7M + 2HM"],
  "INCH:short:b8": ["Stainless Steel Stud Bolt, A193 B8·B8M", "ASTM A193 · ASTM A194 · ASME B16.5", "스테인리스 스터드 B8·B8M"],
  "INCH:short:l7": ["Low-Temperature Stud Bolt, A320 L7 / A194 7L", "ASTM A320 · ASTM A194 · ASME B16.5", "저온용 스터드 L7 + 7L"],
  "INCH:short:hh": ["Heavy Hex Nut", "ASTM A194 · ASME B18.2.2", "플랜트용 헤비 육각너트"],
  "INCH:short:a325": ["Structural Bolt Set, A325·A490", "ASTM F3125 · ASTM A563 · ASTM F436", "구조용 볼트 세트 A325·A490"],
  "INCH:short:j429": ["Hex Cap Screw, SAE Gr 5·8", "ASME B18.2.1 · SAE J429", "인치 육각볼트 SAE Gr 5·8"],
  "INCH:short:a574": ["Alloy Steel Socket Head Cap Screw", "ASME B18.3 · ASTM A574", "인치 렌치볼트 A574"],
  "INCH:short:f593": ["Stainless Steel Bolt and Nut", "ASTM F593 · ASTM F594", "인치 스테인리스 F593·F594"],
  "INCH:short:f1554": ["Anchor Bolt", "ASTM F1554", "기초 앵커볼트 F1554"],
  "NEW:b16": ["High-Temperature Stud Bolt, A193 B16 / A194 7", "ASTM A193 · ASTM A194 · ASME B16.5", "고온용 스터드 B16 + A194 7"],
  "NEW:a453": ["High-Temperature Stud Bolt, A453 Grade 660 (A-286)", "ASTM A453 · ASME B16.5", "고온 스터드 A453 660 (A-286)"],
  "NEW:b8lt": ["Cryogenic Stud Bolt, A320 B8·B8M / A194 8·8M", "ASTM A320 · ASTM A194 · ASME B16.5", "극저온 스터드 A320 B8·B8M + 8·8M"],
  "NEW:f468": ["Nickel Alloy Bolt and Nut", "ASTM F468 · ASTM F467", "니켈합금 볼트·너트 (F468·F467)"],
  "NEW:f837": ["Stainless Steel Socket Head Cap Screw", "ASTM F837 · ASME B18.3", "인치 스테인리스 렌치볼트 (F837)"],
  "NEW:ats": ["Continuous Thread and Double-End Stud", "ASME B18.31.2", "전산·양끝 나사 스터드 (B18.31.2)"],
  "NEW:smo": ["Seawater and Chloride Service Bolting, 6Mo·Super Duplex", "ASTM A193 · ASTM A194", "해수·염화물용 6Mo·수퍼듀플렉스 볼팅"],
  "NEW:a354": ["High Strength Hex Bolt and Stud, A354 BC·BD or A449", "ASTM A354 · ASTM A449 · ASME B18.2.1", "고강도 육각볼트·스터드 (A354 BC·BD, A449)"],
  "ENGINE:ss-cup": ["Hexagon Socket Set Screw, Cup Point", "ISO 4029 · DIN 916", "무두볼트 컵 포인트"],
  "ENGINE:ss-flat": ["Hexagon Socket Set Screw, Flat Point", "ISO 4026 · DIN 913", "무두볼트 평끝"],
  "ENGINE:ss-cone": ["Hexagon Socket Set Screw, Cone Point", "ISO 4027 · DIN 914", "무두볼트 원뿔끝"],
  "ENGINE:ss-dog": ["Hexagon Socket Set Screw, Dog Point", "ISO 4028 · DIN 915", "무두볼트 봉끝(도그)"],
  "ENGINE:iss-cup": ["Socket Set Screw, Cup Point", "ASME B18.3 · ASTM F912", "인치 멈춤나사 컵 포인트"],
  "ENGINE:iss-flat": ["Socket Set Screw, Flat Point", "ASME B18.3 · ASTM F912", "인치 멈춤나사 평끝"],
  "ENGINE:iss-cone": ["Socket Set Screw, Cone Point", "ASME B18.3 · ASTM F912", "인치 멈춤나사 원뿔끝"],
  "ENGINE:iss-oval": ["Socket Set Screw, Oval Point", "ASME B18.3 · ASTM F912", "인치 멈춤나사 둥근끝(오벌)"],
  "ENGINE:iss-halfdog": ["Socket Set Screw, Half Dog Point", "ASME B18.3 · ASTM F912", "인치 멈춤나사 하프 도그"],
  "ENGINE:ishc": ["Socket Head Cap Screw (1960 Series)", "ASME B18.3 · ASTM A574", "인치 렌치볼트 (1960 시리즈)"],
  "ENGINE:ifhc": ["Socket Flat Countersunk Head Cap Screw (82°)", "ASME B18.3 · ASTM F835", "인치 접시머리 렌치볼트 (82°)"],
  "ENGINE:ibhc": ["Socket Button Head Cap Screw", "ASME B18.3 · ASTM F835", "인치 버튼머리 렌치볼트"],
  "ENGINE:ihcs": ["Hex Cap Screw", "ASME B18.2.1 · SAE J429", "인치 육각 캡스크루"],
  "ENGINE:ihn": ["Hex Nut", "ASME B18.2.2 · ASTM A563", "인치 육각너트"],
  "ENGINE:ihhn": ["Heavy Hex Nut", "ASME B18.2.2 · ASTM A194", "인치 헤비 육각너트"],
  "ENGINE:istd": ["Flange Stud Bolt, A193 B7 (with A194 2H Heavy Hex Nuts)", "ASME B18.31.2 · ASME B18.2.2", "플랜지 스터드볼트 B7 (+2H 헤비너트)"],
  "ENGINE:ifw": ["Hardened Steel Washer", "ASTM F436", "경화 평와셔 F436"],
  "ENGINE:ilw": ["Helical Spring-Lock Washer, Regular", "ASME B18.21.1", "인치 스프링 와셔 (Regular)"],
  "TYPE:setscrew": ["Hexagon Socket Set Screw", "ISO 4026–4029 · ASME B18.3", "육각 구멍붙이 멈춤나사"],
  "TYPE:shcs": ["Hexagon Socket Head Cap Screw", "ISO 4762 · ASME B18.3", "렌치볼트 (육각 구멍붙이)"],
  "TYPE:fhcs": ["Hexagon Socket Countersunk Head Screw", "ISO 10642 · ASME B18.3", "접시머리 렌치볼트"],
  "TYPE:bhcs": ["Hexagon Socket Button Head Screw", "ISO 7380-1 · ASME B18.3", "버튼머리 렌치볼트"],
  "TYPE:hexbolt": ["Hexagon Head Bolt / Screw", "ISO 4014 · ISO 4017 · ASME B18.2.1", "육각볼트"],
  "TYPE:heavyhexbolt": ["Heavy Hex Bolt", "ASME B18.2.1", "헤비 육각볼트"],
  "TYPE:nut": ["Hexagon Nut", "ISO 4032 · ASME B18.2.2", "육각너트"],
  "TYPE:heavynut": ["Heavy Hex Nut", "ASME B18.2.2 · ASTM A194", "헤비 육각너트"],
  "TYPE:stud": ["Stud Bolt", "ASME B18.31.2 · DIN 976", "스터드볼트"],
  "TYPE:washer": ["Plain Washer", "ISO 7089 · ASME B18.22.1", "평와셔"],
  "TYPE:lockwasher": ["Spring Lock Washer", "DIN 127 · ASME B18.21.1", "스프링 와셔"],
  "TYPE:rod": ["Threaded Rod", "DIN 976-1 · DIN 975 (withdrawn) · ASME B18.31.3", "전산볼트"],
  "TYPE:anchor": ["Anchor Bolt", "ASTM F1554", "앵커볼트"],
  "TYPE:bolt": ["Bolt (Head Type Not Specified)", "", "볼트 (머리 형상 미기재)"],
  "TYPE:capscrew": ["Cap Screw (Head Type Not Specified)", "", "캡스크루 (머리 형상 미기재)"],
  "TYPE:screw": ["Screw", "", "나사"],
  "TYPE:machinescrew": ["Machine Screw", "ISO 7045 · ISO 1207", "작은 나사"],
  "TYPE:expanchor": ["Post-Installed Anchor", "", "후설치 앵커"],
  "TYPE:insert": ["Screw Thread Insert", "", "나사 인서트"],
  "TYPE:rivet": ["Blind Rivet", "", "블라인드 리벳"],
  "TYPE:ring": ["Retaining Ring", "", "멈춤링"],
  "TYPE:pin": ["Pin", "", "핀"],
  "TYPE:oring": ["O-Ring", "", "O링"],
  "TYPE:gasket": ["Gasket", "", "개스킷"],
  "TYPE:key": ["Machine Key", "", "기계 키"],
  "TYPE:discspring": ["Disc Spring", "", "접시 스프링"],
  "TYPE:clinch": ["Self-Clinching Nut", "", "클린칭 너트"],
  "TYPE:pipe": ["Piping Component (Not a Fastener)", "", "배관 부품 (체결부품 아님)"],
  "TYPE:valve": ["Valve (Not a Fastener)", "", "밸브 (체결부품 아님)"],
  "TYPE:tool": ["Tool (Not a Fastener)", "", "공구 (체결부품 아님)"],
  "TYPE:nonfast": ["Not a Fastener", "", "체결부품 아님"],
  "TYPE:unknown": ["Unidentified Item", "", "품목 미확인"],
  "TYPE:label:washer-f436": ["Hardened Steel Washer", "ASTM F436", "경화 평와셔 (ASTM F436)"],
  "TYPE:label:hexbolt-inch": ["Hex Cap Screw", "ASME B18.2.1", "육각 캡스크루"],
  "TYPE:label:hexbolt-partial": ["Hexagon Head Bolt", "ISO 4014 · KS B 1002", "육각볼트 (반나사)"],
  "TYPE:label:hexbolt-full": ["Hexagon Head Screw", "ISO 4017 · KS B 1002", "육각볼트 (온나사)"],
  "TYPE:label:stud-tapend": ["Tap-End Stud", "DIN 938 · ASME B18.31.2", "탭엔드 스터드"],
  "TYPE:label:stud-cont": ["Continuous Thread Stud", "ASME B18.31.2", "전산 스터드"],
  "TYPE:label:stud-nuts": ["Stud Bolt with 2 Heavy Hex Nuts", "ASME B18.31.2 · ASME B18.2.2", "스터드볼트 + 헤비너트 2개"],
  "TYPE:label:stud-cont-nuts": ["Continuous Thread Stud with 2 Heavy Hex Nuts", "ASME B18.31.2 · ASME B18.2.2", "전산 스터드 + 헤비너트 2개"],
  "TYPE:label:nut-jam-inch": ["Hex Jam Nut", "ASME B18.2.2", "육각 잼너트"],
  "TYPE:label:nut-jam-metric": ["Hexagon Thin Nut", "ISO 4035 · DIN 439", "육각 얇은 너트 (잼)"],
  "TYPE:label:nut-nyloc": ["Prevailing Torque Hexagon Nut, Nylon Insert", "ISO 7040 · ISO 10511", "나일론 인서트 너트"],
  "TYPE:label:heavynut-jam": ["Heavy Hex Jam Nut", "ASME B18.2.2", "헤비 육각 잼너트"],
  "TYPE:label:nut-inch": ["Finished Hex Nut", "ASME B18.2.2", "육각너트 (완성품)"],
  "TYPE:label:lockwasher-inch": ["Helical Spring-Lock Washer, Regular", "ASME B18.21.1", "스프링 와셔 (Regular)"],
  "TYPE:label:anchor-L": ["Anchor Bolt (L-Type)", "ASTM F1554", "앵커볼트 (L형)"],
  "TYPE:label:anchor-J": ["Anchor Bolt (J-Type)", "ASTM F1554", "앵커볼트 (J형)"],
  "TYPE:label:anchor-headed": ["Anchor Bolt (Headed)", "ASTM F1554", "앵커볼트 (헤드형)"],
  "TYPE:label:anchor-straight": ["Anchor Bolt (Straight)", "ASTM F1554", "앵커볼트 (직선형)"],
  "TYPE:label:anchor-unspecified": ["Anchor Bolt (Shape Not Specified)", "ASTM F1554", "앵커볼트 (형상 미기재)"],
  "TYPE:label:anchor-suffix": ["Anchor Bolt (L-Type) with Nut and Washer", "ASTM F1554", "앵커볼트 (L형) + 너트·와셔"],
  "TYPE:variant:wing": ["Wing Nut", "DIN 315", "나비너트"],
  "TYPE:variant:flangenut": ["Hexagon Nut with Flange", "ISO 4161 · DIN 6923", "플랜지 너트"],
  "TYPE:variant:acorn": ["Hexagon Domed Cap Nut", "DIN 1587", "캡너트 (둥근 머리)"],
  "TYPE:variant:coupling": ["Hexagon Coupling Nut (Long Nut)", "DIN 6334", "커플링(롱) 너트"],
  "TYPE:variant:castle": ["Hexagon Slotted and Castle Nut", "DIN 935", "홈붙이(캐슬) 너트"],
  "TYPE:variant:sqnut": ["Square Nut", "DIN 557", "사각 너트"],
  "TYPE:variant:weldnut": ["Hexagon Weld Nut", "DIN 929", "용접 너트"],
  "TYPE:variant:tnut": ["T-Slot Nut", "DIN 508", "T 너트"],
  "TYPE:variant:allmetal": ["All-Metal Prevailing Torque Hexagon Nut", "ISO 7042 · DIN 980", "전금속 풀림방지 너트"],
  "TYPE:variant:rivetnut": ["Blind Rivet Nut", "", "리벳 너트 (블라인드 너트)"],
  "TYPE:variant:flangebolt": ["Hexagon Flange Bolt", "ISO 4162 · DIN 6921", "육각 플랜지 볼트"],
  "TYPE:variant:sqbolt": ["Square Head Bolt", "ASME B18.2.1", "사각머리 볼트"],
  "TYPE:variant:carriage": ["Carriage Bolt (Round Head Square Neck)", "DIN 603 · ASME B18.5", "마차 볼트 (둥근머리 사각목)"],
  "TYPE:variant:eyebolt": ["Lifting Eye Bolt", "DIN 580", "아이볼트"],
  "TYPE:variant:ubolt": ["U-Bolt", "", "U볼트"],
  "TYPE:variant:tbolt": ["T-Head Bolt", "DIN 186", "T볼트"],
  "TYPE:variant:shoulder": ["Hexagon Socket Head Shoulder Screw", "ISO 7379", "숄더 볼트"],
  "TYPE:variant:lowhead": ["Hexagon Socket Head Cap Screw, Low Head", "DIN 7984", "저두 렌치볼트"],
  "TYPE:variant:torx": ["Hexalobular Socket Head", "ISO 14579", "육각별(TORX) 구멍 머리"],
  "TYPE:variant:security": ["Tamper-Resistant Head", "", "도난방지(보안) 머리"],
  "TYPE:variant:lag": ["Hexagon Head Wood Screw (Lag Screw)", "DIN 571", "래그 스크루 (목재용)"],
  "TYPE:variant:tapping": ["Tapping Screw", "ISO 7049", "태핑 나사"],
  "TYPE:variant:thumb": ["Thumb Screw (Wing or Knurled Head)", "DIN 316", "손나사 (나비·널링 머리)"],
  "TYPE:variant:softtip": ["Socket Set Screw, Soft Tip (Nylon or Brass)", "ASME B18.3", "소프트 팁 멈춤나사 (나일론·황동 팁)"],
  "TYPE:variant:sqset": ["Square Head Set Screw", "ASME B18.6.2", "사각머리 멈춤나사"],
  "TYPE:variant:slotted": ["Slotted Set Screw", "ISO 4766 · DIN 551", "홈붙이 멈춤나사 (일자 홈)"],
  "TYPE:variant:fender": ["Plain Washer, Large Series", "ISO 7093 · DIN 9021", "대와셔 (큰 바깥지름)"],
  "TYPE:variant:sqwasher": ["Square and Taper Washer", "DIN 436", "사각·경사 와셔"],
  "TYPE:variant:tooth": ["Tooth Lock Washer", "DIN 6797 · DIN 6798", "톱니 와셔"],
  "TYPE:variant:wedgelock": ["Wedge-Locking Washer (Proprietary)", "", "쐐기형 풀림방지 와셔 (제조사 전용품)"],
  "TYPE:variant:conical": ["Conical Spring Washer", "DIN 6796", "접시형 스프링 와셔"],
  "TYPE:variant:sealing": ["Sealing or Non-Metallic Washer", "", "실링·비금속 와셔"],
  "TYPE:point:cup": ["Cup Point", "", "컵 포인트"],
  "TYPE:point:flat": ["Flat Point", "", "평끝"],
  "TYPE:point:cone": ["Cone Point", "", "원뿔끝"],
  "TYPE:point:dog": ["Dog Point", "", "봉끝(도그)"],
  "TYPE:point:half dog": ["Half Dog Point", "", "하프 도그"],
  "TYPE:point:oval": ["Oval Point", "", "둥근끝(오벌)"],
  "TYPE:point:knurled cup": ["Knurled Cup Point", "", "널링 컵"],
  "TYPE:point:soft tip": ["Soft Tip (Nylon or Brass)", "", "소프트 팁 (나일론·황동)"],
  "TYPE:c-shape:육각볼트": ["Hexagon Head Bolt / Screw", "", "육각볼트"],
  "TYPE:c-shape:렌치볼트 (육각 구멍붙이)": ["Hexagon Socket Head Cap Screw", "", "렌치볼트 (육각 구멍붙이)"],
  "TYPE:c-shape:접시머리 볼트": ["Countersunk Head Screw", "", "접시머리 볼트"],
  "TYPE:c-shape:스터드볼트 (양나사·전산)": ["Stud Bolt (Double-End or Continuous Thread)", "", "스터드볼트 (양나사·전산)"],
  "TYPE:c-shape:헤비 육각볼트 (구조용)": ["Heavy Hex Structural Bolt", "", "헤비 육각볼트 (구조용)"],
  "TYPE:c-shape:육각너트 / 헤비너트": ["Hexagon Nut / Heavy Hex Nut", "", "육각너트 / 헤비너트"],
  "TYPE:c-shape:와셔": ["Washer", "", "와셔"],
  "TYPE:c-shape:앵커볼트 (L·J·헤드형)": ["Anchor Bolt (L, J or Headed)", "", "앵커볼트 (L·J·헤드형)"],
  "TYPE:c-shape:특수 형상 (도면 참조)": ["Special Shape (Per Drawing)", "", "특수 형상 (도면 참조)"],
  "TYPE:c-shape:fallback": ["Part Per Drawing", "", "도면 참조품"],
  "TYPE:c-shape:suffix": ["(Made to Order)", "", "(주문제작)"],
  "TYPE:std-row:육각볼트": ["Hexagon Head Bolt / Screw", "", "육각볼트"],
  "TYPE:std-row:렌치볼트": ["Hexagon Socket Head Cap Screw", "", "렌치볼트"],
  "TYPE:std-row:접시머리 렌치볼트": ["Hexagon Socket Countersunk Head Screw", "", "접시머리 렌치볼트"],
  "TYPE:std-row:육각너트": ["Hexagon Nut", "", "육각너트"],
  "TYPE:std-row:헤비 육각너트": ["Heavy Hex Nut", "", "헤비 육각너트"],
  "TYPE:std-row:평와셔": ["Plain Washer", "", "평와셔"],
  "TYPE:std-row:스프링와셔": ["Spring Lock Washer", "", "스프링와셔"],
  "TYPE:std-row:스터드볼트": ["Stud Bolt", "", "스터드볼트"],
  "TYPE:grade:B7S": ["ASTM A193 B7 (Stud Only)", "", "ASTM A193 B7 (스터드만)"],
  "TYPE:grade:F880M": ["316 (per F880 Dimensions and Tests)", "", "316 (F880 치수·시험 준용)"],
  "TYPE:grade:LW188": ["18-8 Stainless Steel", "", "18-8 스테인리스"],
  "TYPE:grade:LWCS": ["Spring Steel", "", "스프링강"],
};
const bomEn = key => { const r = BOM_EN[key]; return r ? { en: r[0], std: r[1], ko: r[2] } : null; };
// 품목군에 en(공식명)·enStd(규격 태그)·enShort(부품표·견적함용 짧은 공식명)를 붙인다. METRIC·INCH의 base en 값과 같다 (최종 확인은 test)
function bomEnSet(f) {
  const scopes = METRIC.includes(f) ? ['METRIC'] : INCH.includes(f) ? ['INCH', 'NEW'] : ['ENGINE'];
  const sc = scopes.find(s => BOM_EN[s + ':' + f.id]); if (!sc) return f;
  const e = bomEn(sc + ':' + f.id), s = bomEn(sc + ':short:' + f.id);
  f.en = e.en; f.enStd = e.std; f.enShort = s ? s.en : e.en;
  return f;
}
METRIC.forEach(bomEnSet); INCH.forEach(bomEnSet);   // BOM_FAMS는 e2_cat.js 끝에서
// 엔진 줄의 품목 이름(q.typeLabel = labelOf)과 같은 갈래로 TYPE 키를 고른다
function bomEnKey(q) {
  if (!q) return 'TYPE:unknown';
  const t = q.type, inch = q.system === 'inch', s = q.sub || {};
  if (q.variant) return 'TYPE:variant:' + q.variant.k;
  if (t === 'washer' && s.f436) return 'TYPE:label:washer-f436';
  if (t === 'hexbolt') return 'TYPE:label:' + (inch ? 'hexbolt-inch' : s.thread === 'partial' ? 'hexbolt-partial' : 'hexbolt-full');
  if (t === 'stud') return 'TYPE:' + (s.tapEnd ? 'label:stud-tapend' : s.cont ? (s.nuts ? 'label:stud-cont-nuts' : 'label:stud-cont') : s.nuts ? 'label:stud-nuts' : 'stud');
  if (t === 'nut' && s.jam) return 'TYPE:label:' + (inch ? 'nut-jam-inch' : 'nut-jam-metric');
  if (t === 'nut' && s.nyloc) return 'TYPE:label:nut-nyloc';
  if (t === 'heavynut' && s.jam) return 'TYPE:label:heavynut-jam';
  if (t === 'nut' && inch) return 'TYPE:label:nut-inch';
  if (t === 'lockwasher' && inch) return 'TYPE:label:lockwasher-inch';
  if (t === 'anchor') return 'TYPE:label:anchor-' + ({ L: 'L', J: 'J', headed: 'headed', straight: 'straight' }[s.shape] || 'unspecified');
  return 'TYPE:' + t;
}
// 줄 품목의 영문명: q.typeLabel의 짝. point = 멈춤나사 끝 형상을 붙일지 (specLine·C&D처럼 '…, Cup Point')
// 화면의 한국어 이름(q.typeLabel)과 짝이 맞지 않으면 (엔진이 나중에 sub를 고친 경우 등) 같은 한국어 이름의 TYPE 항목을 쓴다: 영문은 늘 보이는 한국어의 짝
const BOM_EN_TYPE_KO = new Map(Object.entries(BOM_EN).filter(([k]) => /^TYPE:(?:label:|variant:|[a-z]+$)/.test(k)).reverse().map(([k, v]) => [v[2], k]));
function bomEnType(q, point = false) {
  let key = bomEnKey(q);
  const k0 = bomEn(key), lab = q && q.typeLabel;
  if (lab && (!k0 || (k0.ko !== lab && !(key.startsWith('TYPE:label:anchor-') && lab.startsWith(k0.ko)))) && BOM_EN_TYPE_KO.has(lab)) key = BOM_EN_TYPE_KO.get(lab);
  const e = bomEn(key) || { en: lab && !/[가-힣]/.test(lab) ? lab : 'Item', std: '' };
  let en = e.en;
  if (q && q.type === 'anchor' && !q.variant) { const s = q.sub || {}; en += s.nut ? ' with Nut' + (s.washer ? ' and Washer' : '') : s.washer ? ' with Washer' : ''; }
  if (point && q && q.point && !q.variant) { const p = bomEn('TYPE:point:' + q.point); if (p) en += ', ' + p.en; }
  return { key, en, std: e.std };
}
// 견적서 품명 칸 형식 "<ko> / <en>" (오너 결정 2)
const bomKoEn = (ko, en) => en ? `${ko} / ${en}` : ko;
// 줄의 품명 {ko, en}: 한국어는 지금 화면 그대로(q.typeLabel), 영문은 공식명
// m.catFam (ea_catalog.hooks.json): 카탈로그 확장 품목군. CAT_F(ea_catdata.js)는 엔진 블록 뒤쪽에서 정의되므로 실행 때 읽는다
const bomCatF = m => { try { return (m && m.catFam && CAT_F[m.catFam]) || null; } catch { return null; } };
const bomEnLine = x => { const f = bomCatF(x && x.m); return f ? { ko: f.ko, en: f.en } : { ko: x.q.typeLabel, en: bomEnType(x.q).en }; };
// 카탈로그와 맞은 품목군 (카탈로그 품목 줄, 그리고 m.catFam이 있는 견적 줄): {ko, en, std} | null
function bomEnMatch(m) {
  const cf = bomCatF(m); if (cf && m.status !== 'not-available') return { ko: cf.ko, en: cf.en, std: cf.enStd || '' };
  if (!m || m.status !== 'catalog' || !m.fam) return null;
  const f = METRIC.find(x => x.id === m.fam) || BOM_FAMS.find(x => x.id === m.fam);
  return f && f.en ? { ko: f.name, en: f.en, std: f.enStd || '' } : null;
}
// 견적함 줄의 영문명: 표시 단가 줄은 형번의 품목군, 견적 줄은 담을 때 적은 en → 인치 품목·플랜지 세트·주문제작 모양 순서로 찾는다
function bomEnCart(l) {
  if (!l) return '';
  if (l.type === 'item') { const p = parsePn(l.pn); return p ? p.f.enShort || p.f.en || '' : ''; }
  if (l.en) return l.en;
  const f = INCH.find(x => x.id === l.fam);
  if (f && l.title === f.name) return f.en;
  const m = String(l.title || '').match(/^플랜지 스터드 세트 NPS (\S+) Class (\d+)$/);
  if (m) return bomEn('INCH:fl-set').en.replace('${r[0]}', m[1]).replace(/Class \d+$/, 'Class ' + m[2]);
  if (l.fam === 'custom') {
    const sh = String(l.title || '').replace(/ \(주문제작\)$/, ''), e = bomEn('TYPE:c-shape:' + sh) || (sh === '도면 참조품' ? bomEn('TYPE:c-shape:fallback') : null);
    return e ? `${e.en} ${bomEn('TYPE:c-shape:suffix').en}` : '';
  }
  return '';
}
