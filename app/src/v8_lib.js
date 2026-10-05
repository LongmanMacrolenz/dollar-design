/* ── v8_lib.js: 체결부품 규격 사전 (2026-10, 대표 요청: 엔지니어 고객이 믿고 찾아오는 사전) ──
   경로: lib (첫 화면: 찾기 · 분류 · 기관) · lib-<id> (항목). 데이터는 ea_lib.js의 LIB (검토를 마친 항목만).
   규격 원문은 옮기지 않고 사실·값만 우리 말로 적는다. 항목은 고객이 BOM에 쓰는 말(aka)로도 찾힌다. */
Object.assign(SHEETS, { lib: ['R', '규격 사전'] });
const LIB_BY = Object.fromEntries((typeof LIB !== 'undefined' ? LIB : []).map(e => [e.id, e]));
const LIB_KIND = { std: '규격', grade: '등급', mat: '재질', thread: '나사', concept: '개념·설계', doc: '서류', test: '시험', coat: '코팅·부식', part: '부품 용어' };
const LIB_KIND_GRP = [['std', '규격'], ['grade', '등급·재질', ['grade', 'mat']], ['thread', '나사·치수', ['thread', 'concept']], ['doc', '서류·시험', ['doc', 'test']], ['coat', '코팅·부식'], ['part', '부품 용어']];
const LIB_ORGS = ['ASTM', 'ASME', 'ISO', 'EN', 'DIN', 'KS', 'JIS', 'SAE', 'API', 'NACE'];
const LIB_POP = ['gr-b7', 'gr-b7m', 'gr-2h', 'gr-l7', 'pc-8-8', 'pc-10-9', 't-en10204-types', 't-overtap', 't-8un', 'din-933', 't-sour', 't-stud-length'];
const LIB_CHECKED = '2026-10';
const libE = id => (Object.hasOwn(LIB_BY, id) ? LIB_BY[id] : null);
const libKindOk = (e, k) => !k || (LIB_KIND_GRP.find(g => g[0] === k)?.[2] || [k]).includes(e.kind);
const libNorm = s => String(s || '').toLowerCase().replace(/[\s·.\-/_,()"']+/g, '');
const libHay = e => (e._h ||= libNorm([e.t, e.ko, e.en, ...(e.aka || []), e.sum].join(' ')));
// 찾기 점수: 제목·별칭 앞부분 일치가 먼저, 본문 일치는 뒤에
function libFind(q, kind, org) {
  const n = libNorm(q), L = (typeof LIB !== 'undefined' ? LIB : []).filter(e => libKindOk(e, kind) && (!org || e.org === org));
  if (!n) return L;
  return L.map(e => {
    const t = libNorm(e.t), a = (e.aka || []).map(libNorm), ko = libNorm(e.ko);
    const s = t === n || a.includes(n) ? 0 : t.startsWith(n) || a.some(x => x.startsWith(n)) ? 1 : t.includes(n) || ko.includes(n) || a.some(x => x.includes(n)) ? 2 : libHay(e).includes(n) ? 3 : 9;
    return [s, e];
  }).filter(([s]) => s < 9).sort((x, y) => x[0] - y[0] || x[1].t.localeCompare(y[1].t, 'ko')).map(([, e]) => e);
}
const libBadge = e => `<span class="lib-org">${esc(e.org === '-' ? '공통' : e.org)}</span><span class="lib-kind">${esc(LIB_KIND[e.kind] || e.kind)}</span>${e.status && !/^현행/.test(e.status) ? `<span class="lib-st">${esc(e.status.split(' ')[0])}</span>` : ''}`;
const libCard = e => `<a class="lib-card" role="listitem" href="#lib-${e.id}" data-go="lib-${e.id}"><span class="lib-bd">${libBadge(e)}</span><b>${nwText(e.t)}</b><span class="lib-ko">${esc(e.ko || '')}</span><span class="lib-sum">${esc(e.sum || '')}</span></a>`;
const libLink = id => { const e = libE(id); return e ? `<a class="lib-chip" href="#lib-${e.id}" data-go="lib-${e.id}">${nwText(e.t)}</a>` : ''; };
function libListHTML() {
  const st = state.lib || (state.lib = { q: '', kind: '', org: '' });
  const L = libFind(st.q, st.kind, st.org);
  return `<p class="lib-count" aria-live="polite">${L.length}개 항목${st.q ? ` · “${esc(st.q)}”` : ''}</p>${L.length ? `<div class="lib-grid" role="list">${L.map(libCard).join('')}</div>` : `<div class="ia-box thin"><p>찾는 항목이 없습니다. 표기 그대로 <a href="#list" data-go="list">목록 견적</a>에 붙여 넣으시면 엔지니어가 읽고 회신합니다. 사전에 넣었으면 하는 항목은 <a href="#about" data-go="about" data-ia-fix="1">알려 주세요</a>.</p></div>`}`;
}
function libIndex() {
  const st = state.lib || (state.lib = { q: '', kind: '', org: '' }), n = (typeof LIB !== 'undefined' ? LIB : []).length;
  const seg = (k, v, t) => `<button type="button" class="lib-f${(st[k] || '') === v ? ' on' : ''}" data-lib-f="${k}" data-v="${v}" aria-pressed="${(st[k] || '') === v}">${esc(t)}</button>`;
  return iaPage(iaHead([['규격 사전']], '체결부품 규격 사전', 'Fastener Standards Library',
    `ASTM·ASME·ISO·EN·DIN·KS·JIS의 규격과 등급, 나사, 서류·시험, 코팅, 부품 용어 ${n}개를 기계엔지니어가 정리했습니다. 규격 원문이 아니라 BOM을 읽고 살 때 확인할 사실과 값만 적습니다.`)
    + `<div class="lib-search"><label class="sr" for="lib-q">규격 사전에서 찾기</label><input id="lib-q" type="search" value="${esc(st.q)}" placeholder="예: B7M, 2H, 8.8, EN 10204 3.1, 렌치볼트, 오버탭" autocomplete="off" spellcheck="false" enterkeyhint="search"></div>
    <div class="lib-fs"><div class="lib-fr" role="group" aria-label="분류">${seg('kind', '', '전체')}${LIB_KIND_GRP.map(([k, t]) => seg('kind', k, t)).join('')}</div><div class="lib-fr" role="group" aria-label="기관">${seg('org', '', '모든 기관')}${LIB_ORGS.filter(o => (typeof LIB !== 'undefined' ? LIB : []).some(e => e.org === o)).map(o => seg('org', o, o)).join('')}</div></div>
    ${!st.q && !st.kind && !st.org ? `<div class="lib-pop"><span class="lab">자주 찾는 항목</span>${LIB_POP.map(libLink).join('')}</div>` : ''}
    <div id="lib-res">${libListHTML()}</div>
    <p class="small muted lib-foot">근거: 발행 기관 공개 페이지·공식 미리보기·공공 문서, 일부 값은 제조·유통사 공개 기술자료 3곳 이상 대조 · 확인 ${LIB_CHECKED}. 판이 바뀌면 값이 달라질 수 있으니 계약·설계에는 규격 원문을 확인하세요. 틀린 곳은 <a href="#about" data-go="about" data-ia-fix="1">알려 주시면</a> 확인해 고칩니다.</p>`);
}
function libEntry(e) {
  const fams = (e.fam || []).filter(id => Object.hasOwn(CAT_F, id));
  const same = (typeof LIB !== 'undefined' ? LIB : []).filter(x => x.org === e.org && x.kind === e.kind), i = same.indexOf(e);
  const nav = (x, lab) => x ? `<a href="#lib-${x.id}" data-go="lib-${x.id}"><span class="lab">${lab}</span>${nwText(x.t)}</a>` : '<span></span>';
  const tbl = e.table && Array.isArray(e.table.rows) && e.table.rows.length ? `<figure class="lib-tbl"><figcaption>${esc(e.table.cap || '')}</figcaption><div class="tblw"><table class="tbl"><thead><tr>${(e.table.head || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${e.table.rows.map(r => `<tr>${r.map(c => `<td>${nwText(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${e.table.note ? `<p class="small muted">${esc(e.table.note)}</p>` : ''}</figure>` : '';
  return iaPage(iaHead([['규격 사전', 'lib'], [e.t]], nwText(e.t), '', '', `<div class="lib-hd"><p class="lib-bd">${libBadge(e)}</p><p class="lib-kot">${esc(e.ko || '')}</p>${e.en ? `<p class="lib-en" lang="en">${esc(e.en)}</p>` : ''}</div>`)
    + `<div class="lib-body"><div class="lib-main">
      <p class="lib-lead">${esc(e.sum || '')}</p>
      ${e.status ? `<p class="lib-stl${/^현행/.test(e.status) ? ' ok' : ''}"><span class="lab">상태</span>${esc(e.status)}</p>` : ''}
      <h2 class="lib-h">핵심</h2><ul class="lib-facts">${(e.facts || []).map(f => `<li>${nwText(f)}</li>`).join('')}</ul>
      ${tbl}
      ${(e.watch || []).length ? `<section class="lib-watch"><h2 class="lib-h">BOM·구매 때 주의</h2><ul>${e.watch.map(w => `<li>${nwText(w)}</li>`).join('')}</ul></section>` : ''}
      ${(e.eq || []).length ? `<h2 class="lib-h">대응·대체 규격</h2><ul class="lib-eq">${e.eq.map(q => `<li><b>${nwText(q.std || '')}</b>${q.note ? ` <span>${esc(q.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      <p class="small muted lib-src">근거: ${(e.src || []).map(s => nwText(s)).join(' · ')} · 확인 ${LIB_CHECKED}. 규격 원문을 옮긴 것이 아니라 요점을 정리한 것입니다.</p>
    </div><aside class="lib-side">
      ${(e.rel || []).some(libE) ? `<div class="lib-box"><h2 class="lib-h">관련 항목</h2><div class="lib-chips">${e.rel.map(libLink).join('')}</div></div>` : ''}
      ${fams.length ? `<div class="lib-box"><h2 class="lib-h">관련 품목</h2><ul class="lib-fams">${fams.map(id => `<li><a href="#c-${id}" data-go="c-${id}">${esc(CAT_F[id].ko)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul></div>` : ''}
      <div class="lib-box lib-cta"><h2 class="lib-h">이 규격이 들어간 BOM이 있으신가요?</h2><p>표기 그대로 붙여 넣으면 줄마다 규격·등급과 필요한 서류를 맞춰 견적합니다.</p><a class="btn pri" href="#list" data-go="list">목록 견적으로 →</a></div>
    </aside></div>
    <nav class="lib-pn" aria-label="같은 분류의 앞뒤 항목">${nav(same[i - 1], '이전')}${nav(same[i + 1], '다음')}</nav>`);
}
V.lib = id => { const e = id ? libE(id) : null; return e ? libEntry(e) : libIndex(); };
V.after.lib = id => {
  const e = id ? libE(id) : null;
  if (e) { document.title = `${e.t} · ${e.ko || ''} | 볼트노트 규격 사전`; return; }
  document.title = '체결부품 규격 사전 | 볼트노트';
  const q = $('lib-q'), res = $('lib-res'), st = state.lib;
  let t = null;
  const draw = () => { res.innerHTML = libListHTML(); };
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { st.q = q.value.trim(); draw(); const p = view().querySelector('.lib-pop'); if (p) p.hidden = !!st.q; }, 120); });
  view().addEventListener('click', ev => {
    const b = ev.target.closest('[data-lib-f]'); if (!b) return;
    st[b.dataset.libF] = b.dataset.v;
    view().querySelectorAll(`[data-lib-f="${b.dataset.libF}"]`).forEach(x => { const on = x.dataset.v === b.dataset.v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    const p = view().querySelector('.lib-pop'); if (p) p.hidden = !!(st.q || st.kind || st.org);
    draw();
  });
};
// 공개한 항목이 없으면(대표 확인 전) 머리글·바닥글의 사전 링크를 뺀다
if (!LIB_BY || !Object.keys(LIB_BY).length) document.querySelectorAll('[data-lib]').forEach(a => a.remove());
// 검색 색인: 머리글 찾기에서도 사전 항목이 나오게
(typeof LIB !== 'undefined' ? LIB : []).forEach(e => INDEX.push({ t: `${e.t} · ${e.ko || ''}`, s: e.sum ? e.sum.slice(0, 60) : '', k: [e.t, e.ko, e.en, ...(e.aka || [])].join(' ').toLowerCase(), go: 'lib-' + e.id, g: '규격 사전' }));
