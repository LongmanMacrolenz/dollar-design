/* ── v9_shape.js: 품목 형상 이미지 (현실 같은 참고용 렌더링) ──
   이미지: docs/media/shape/<품목군id>-<룩>.webp (576×432), 목록 썸네일 docs/media/shape/<id>-s.webp (240×180).
   만드는 법: tools/shapes/README.md (Blender 렌더). 규격 공칭 치수 기준 대표 호칭으로 그린 그림이며 실제 공급품 사진이 아니다 — 화면에도 그렇게 적는다.
   룩(마감 색) 규칙은 tools/shapes/looks.py 와 같게 둔다. 이미지가 없는 품목은 아무것도 보이지 않는다.
   쓰는 곳: 품목 페이지 c-<id> (v7_ia.js), 기존 장 m-·i- (src/shape.hooks.json), 품목 카드 썸네일 (iaFamCard). 이름 접두사 shape…/SHAPE_ */

/* SHAPE_IMG:BEGIN (tools/shapes/render_all.py --manifest 가 만듭니다. 손으로 고치지 않습니다) */
const SHAPE_IMG = {"hbf":["ZW","ZB","BO","PL","HD","GM","SS"],"hbp":["ZW","BO","PL","HD","GM","SS"],"flangebolt":["ZW","ZB","BO","PL","GM","SS"],"hvset":["PL","HD"],"tcbolt":["PL"],"carriage":["ZW","PL","HD","SS"],"tslotbolt":["BO","PL"],"tnut":["BO","PL"],"jack":["PL","BO","ZW","SS"],"eyebolt":["ZW","PL","HD","SS"],"ieyebolt":["PL","HD"],"swingbolt":["ZW","PL","SS"],"sqbolt":["ZW"],"tbolt":["ZW"],"fitbolt":["ZW"],"lag":["ZW"],"cskbolt":["ZW"],"hoistring":["ZW"],"j429":["PL","ZW","BO","HD","ZY"],"a574":["BO","PL","ZW"],"ifhc":["BO","SS"],"ibhc":["BO","SS"],"iss":["BO","PL","SS"],"f593":["SS"],"a307":["PL","HD","MZ"],"a354":["PL","HD","MZ","GM"],"hhb":["PL","HD"],"a325":["PL","HD","MZ","GM"],"f837":["SS"],"ms-inch":["ZW","BO","SS","ZY"],"scs":["BO","ZW","ZB","GM","SS","PL"],"csk":["BO","ZW","ZB","GM","SS"],"bhcs":["BO","ZW","ZB","SS"],"ss":["PL","BO","GM","SS"],"plug910":["PL","ZW","SS","BR"],"lowhead":["BO","ZW","SS"],"shoulder":["BO","SS"],"plug906":["PL","ZW","SS","BR"],"plug908":["PL","ZW","SS","BR"],"plugnpt":["BO","SS","BR"],"plugbar":["PL","SS"],"sealw":["CU","AL","SS"],"bhflange":["ZW"],"torx":["ZW"],"ss-slot":["ZW"],"ss-sq":["ZW"],"ss-soft":["BO"],"ss-knurl":["BO"],"orbplug":["ZW","SS","ZY"],"bondseal":["ZW"],"ms-pan":["ZW","ZB","NI","SS"],"ms-csk":["ZW","ZB","NI","SS"],"ms-truss":["ZW","ZB","NI","SS"],"ms-slot":["ZW","NI","SS","PL"],"tap":["ZW","ZB","NI","SS"],"sems":["ZW","ZB","NI","SS"],"standoff":["NI","ZW","SS"],"blindrivet":["SS","ZW","AL"],"rivnut":["ZW","SS","PL","AL"],"rivstud":["ZW","SS","PL"],"wti":["SS"],"ms-rcsk":["ZW"],"tap-hex":["ZW"],"tap-drill":["ZW"],"tap-form":["ZW"],"thumb":["ZW"],"blindrivet-csk":["ZW","AL","SS"],"solidrivet":["AL","BR","CU","PL"],"clinch":["ZW","AL","BR","SS"],"lockbolt":["ZW","PL"],"keyinsert":["ZW","PL","SS"],"woodinsert":["ZW","BR","SS"],"weldstud":["ZW"],"tr":["ZW","HD","PL","SS"],"coupling":["ZW","HD","PL","SS"],"rod-in":["PL","ZW","HD","PT","SS"],"rod-hanger":["ZW","HD","SS"],"stud-ft":["PL","ZW","HD","PT","SS"],"channelnut":["ZW","HD","SS"],"ubolt":["ZW","HD","PL","SS"],"f1554":["PL","HD","MZ","ZW"],"fbolt":["PL","HD","ZW"],"wedge":["ZW","HD","SS"],"stronganchor":["ZW","HD","SS"],"dropin":["ZW","SS"],"sleeve":["ZW"],"b7":["PL","PT","HD","ZN","GM"],"b7m":["PL","PT","ZN"],"b8":["SS","PT"],"l7":["PL","PT","ZN"],"mstud":["PL","PT","HD","ZN","GM"],"stud-te":["PL","ZW","HD","SS"],"b16":["PL"],"b8lt":["SS","PT"],"smo":["SS"],"istud-te":["PL","SS"],"ats":["PL","PT","HD","SS"],"ksflset":["PL","ZW","HD","SS"],"a453":["SS"],"b6":["SS"],"f468":["NIA"],"tstud":["PL","PT"],"stud-rs":["PL"],"hn":["ZW","ZB","BO","PL","HD","GM","SS"],"hnthin":["ZW","ZB","BO","PL","SS"],"nyloc":["ZW","ZB","SS"],"capnut":["ZW","NI","SS"],"ihn":["ZW","PL","SS","HD","ZY"],"hh":["PL","PT","HD","ZN"],"mhh":["PL","PT","HD","ZN"],"allmetal":["ZW","ZB","PL","SS"],"flangenut":["ZW","ZB","SS"],"castle":["ZW","PL","SS"],"wing":["ZW","SS"],"eyenut":["ZW","PL","HD","SS"],"hn2":["ZW"],"sqnut":["ZW"],"weldnut":["PL"],"fixturenut":["ZW"],"cagenut":["ZW"],"profilenut":["ZW"],"oemnut":["PL","SS"],"pw":["ZW","ZB","HD","BO","GM","PL","SS"],"pwl":["ZW","ZB","HD","BO","GM","PL","SS"],"sw":["ZW","BO","SS","GM"],"ifw":["PL","HD","MZ","GM"],"ilw":["ZW","SS","PL","MZ"],"pws":["ZW","BO","GM","PL","SS"],"thickw":["ZW","BO","PL","SS"],"ipw":["PL","ZW","MZ","HD","SS"],"tooth":["ZW","PL","SS","BO"],"conical":["BO","GM","MZ","SS","PH"],"disc":["MZ","PL","SS","PH"],"taperw":["PL","ZW","HD","SS"],"pwxl":["PL","ZW","HD"],"wedgelock":["ZW","GM","SS"],"sqw":["PL","HD","ZW"],"sphw":["BO","PL","SS"],"dti":["PL","MZ"],"dowel-h":["PL","SS"],"dowel-u":["PL","BO","ZW","SS","PH"],"dowel-it":["PL","BO","SS"],"taper":["PL","BO","ZW","SS","PH"],"spring-sl":["PL","SS"],"cotter":["PL","ZW","SS","BR"],"taper-th":["PL","BO","ZW","PH"],"spring-co":["PL","SS"],"clevis":["PL","BO","ZW","PH"],"ipin":["PL","SS"],"rclip":["ZW","SS"],"grooved":["ZW","PL","SS"],"splittaper":["PL"],"ring-ext":["BO","SS","PH"],"ring-int":["BO","SS","PH"],"key-par":["PL","SS"],"kmnut":["PL","SS"],"mbw":["PL","SS"],"ering":["BO","ZW","SS","PH"],"key-wood":["PL","SS"],"key-inch":["PL","SS"],"keystock":["PL","SS"],"tabw":["PL","ZW","SS"],"ring-misc":["BO","PH","SS"],"key-gib":["PL","SS"],"ilocknut":["PL"]};
/* SHAPE_IMG:END */
const SHAPE_DIR = 'media/shape/';
const SHAPE_NAME = { ZW: '백색아연', ZY: '황색아연', ZB: '흑색아연', BO: '흑착색', PL: '무처리(생지)', HD: '용융아연', GM: '아연 플레이크', ZN: '아연-니켈', NI: '니켈', PT: 'PTFE 코팅', PH: '인산염', MZ: '기계 아연', SS: '스테인리스', BR: '황동', CU: '구리', AL: '알루미늄', NIA: '니켈합금' };
const SHAPE_FIN_RX = [[/스테인리스/, 'SS'], [/옐로우|황색/, 'ZY'], [/흑색아연/, 'ZB'], [/흑착색/, 'BO'], [/아연-니켈|아연 ?니켈/, 'ZN'], [/용융아연/, 'HD'], [/아연 ?플레이크/, 'GM'], [/기계(적)? ?아연/, 'MZ'],
  [/PTFE|불소수지/, 'PT'], [/인산염/, 'PH'], [/니켈/, 'NI'], [/백색아연|전기아연|아연도금/, 'ZW'], [/무처리|무도금|생지|브라이트|방청유|토크계수|갈링|윤활|고착방지/, 'PL']];
const SHAPE_STAINLESS = /\bA[24]\b|스테인리스|STS|SUS|\b304|\b316|18-8|F59[34]|F837|F87[89]|F880|\bB8|S3\d{4}|S32\d{3}|\b410\b|1\.4\d{3}|\bSS\b/i;
// 재질이 룩을 정해 버리는 경우(스테인리스·황동·구리·알루미늄·니켈합금)만. 나머지는 표면처리가 정한다
function shapeLookOfMat(m) {
  m = String(m || '');
  if (/황동|CuZn/i.test(m)) return 'BR';
  if (/^구리$/.test(m)) return 'CU';
  if (/알루미늄/.test(m) && !SHAPE_STAINLESS.test(m)) return 'AL';
  if (/\bNi\s*\d|F468|니켈합금/.test(m) && !SHAPE_STAINLESS.test(m)) return 'NIA';
  return SHAPE_STAINLESS.test(m) ? 'SS' : null;
}
function shapeLookOfFin(f) { f = String(f || ''); for (const [rx, k] of SHAPE_FIN_RX) if (rx.test(f)) return k; return null; }
// 품목군 id + 고른 재질·표면처리 → 그 품목에 이미지가 있는 룩 (없으면 기본 룩). pick = 고객이 칩으로 직접 고른 룩
function shapeLook(id, mat, fin, pick) {
  const list = Object.hasOwn(SHAPE_IMG, id) ? SHAPE_IMG[id] : null;
  if (!list || !list.length) return null;
  if (pick && list.includes(pick)) return pick;
  const want = shapeLookOfMat(mat) || shapeLookOfFin(fin);
  return want && list.includes(want) ? want : list[0];
}
const shapeHas = id => Object.hasOwn(SHAPE_IMG, id) && SHAPE_IMG[id].length > 0;
const shapeThumb = (id, w = 96, h = 72) => shapeHas(id) ? `<img src="${SHAPE_DIR}${id}-s.webp" width="${w}" height="${h}" alt="" loading="lazy" decoding="async">` : '';
state.shapePick = state.shapePick || {};   // 품목군 id → 고객이 칩으로 고른 룩 (재질·표면처리 칸을 바꾸면 지운다)
function shapeFigHtml(id, name, look) {
  const list = SHAPE_IMG[id], nm = SHAPE_NAME[look] || look;
  return `<figure class="shp"><div class="shp-img"><img src="${SHAPE_DIR}${id}-${look}.webp" width="576" height="432" alt="${esc(name)} 형상 렌더링 · ${esc(nm)}" decoding="async" onerror="this.closest('.shp').hidden=true"></div>
    ${list.length > 1 ? `<div class="shp-looks" role="group" aria-label="마감 색 미리보기"><span class="lab">마감 색</span>${list.map(k => `<button type="button" class="chipbtn${k === look ? ' on' : ''}" data-shp="${k}" aria-pressed="${k === look}">${esc(SHAPE_NAME[k] || k)}</button>`).join('')}</div>` : ''}
    <figcaption><b>형상 · ${esc(nm)}</b><span>참고용 렌더링입니다. 규격 공칭 형상의 대표 호칭 그림이며 실제 제품 사진이 아닙니다. 색은 도금·로트에 따라 다릅니다.</span></figcaption></figure>`;
}
// 3D 형상이 있으면 2D 치수 도면은 접어 둔다: 첫 화면은 3D, 도면은 '치수 도면 (2D) 보기'를 눌러 펼친다.
// 도면 칸(.dbox)은 그대로 두고 details로 감싸기만 하므로, 호칭·길이를 바꿀 때 다시 그리는 코드는 그대로 동작한다.
function shapeFold2d(slot) {
  const box = slot.nextElementSibling;
  if (!box || !box.classList.contains('dbox') || box.closest('details.shp-2d')) return;
  const d = document.createElement('details'); d.className = 'shp-2d';
  const s = document.createElement('summary'); s.textContent = '치수 도면 (2D) 보기'; d.append(s);
  box.before(d); d.append(box);
}
// 자리 #shp-slot 에 그림을 넣거나 바꾼다. 같은 룩이면 그대로 둔다 (칸을 바꿀 때마다 깜박이지 않게)
function shapeShow(id, name, mat, fin) {
  const slot = document.getElementById('shp-slot'); if (!slot) return;
  const look = shapeLook(id, mat, fin, state.shapePick[id]);
  if (!look) { slot.innerHTML = ''; slot.dataset.look = ''; return; }
  shapeFold2d(slot);
  slot.dataset.id = id; slot.dataset.name = name; slot.dataset.mat = mat || ''; slot.dataset.fin = fin || '';
  if (slot.dataset.look === look && slot.dataset.shown === id) return;
  slot.dataset.look = look; slot.dataset.shown = id;
  slot.innerHTML = shapeFigHtml(id, name, look);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-shp]'), slot = b && b.closest('#shp-slot'); if (!slot) return;
  state.shapePick[slot.dataset.id] = b.dataset.shp;
  shapeShow(slot.dataset.id, slot.dataset.name, slot.dataset.mat, slot.dataset.fin);
});
