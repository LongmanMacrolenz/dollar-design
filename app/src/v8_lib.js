/* ── v8_lib.js: 체결부품 규격 사전 (2026-10, 대표 요청: 엔지니어 고객이 믿고 찾아오는 사전) ──
   경로: lib (첫 화면: 찾기 · 분류 · 기관) · lib-<id> (항목). 데이터는 ea_lib.js의 LIB (검토를 마친 항목만).
   규격 원문은 옮기지 않고 사실·값만 우리 말로 적는다. 항목은 고객이 BOM에 쓰는 말(aka)로도 찾힌다. */
Object.assign(SHEETS, { lib: ['R', '규격 사전'] });
const LIB_BY = Object.fromEntries((typeof LIB !== 'undefined' ? LIB : []).map(e => [e.id, e]));
const LIB_KIND = { std: '규격', grade: '등급', mat: '재질', thread: '나사', concept: '개념·설계', doc: '서류', test: '시험', coat: '코팅·부식', part: '부품 용어' };
const LIB_KIND_GRP = [['std', '규격'], ['grade', '등급·재질', ['grade', 'mat']], ['thread', '나사'], ['concept', '개념·설계'], ['doc', '서류·시험', ['doc', 'test']], ['coat', '코팅·부식'], ['part', '부품 용어']];
const LIB_ORGS = ['ASTM', 'ASME', 'ISO', 'EN', 'DIN', 'KS', 'JIS', 'SAE', 'API', 'NACE'];
const LIB_POP = ['gr-b7', 'gr-b7m', 'gr-2h', 'gr-l7', 'pc-8-8', 'pc-10-9', 't-en10204-types', 't-overtap', 't-8un', 'din-933', 't-sour', 't-stud-length'];
const LIB_CHECKED = '2026-10';
const libE = id => (Object.hasOwn(LIB_BY, id) ? LIB_BY[id] : null);
const LIB_TOPICS = LIB_GUIDE.topics;
const LIB_PATHS = LIB_GUIDE.paths;
const libDefaults = () => ({ q: '', kind: '', org: '', topic: '', path: '', limit: 24 });
const libTopic = id => LIB_TOPICS.find(x => x.id === id);
const libPath = id => LIB_PATHS.find(x => x.id === id);
const libTopicOf = id => LIB_TOPICS.find(x => x.entries.includes(id));
const libState = () => state.lib || (state.lib = libDefaults());
function libReadRoute(route) {
  const p = new URLSearchParams(route.includes('?') ? route.slice(route.indexOf('?') + 1) : ''), st = libDefaults();
  st.q = (p.get('q') || '').slice(0, 200);
  st.kind = LIB_KIND_GRP.some(x => x[0] === p.get('kind')) ? p.get('kind') : '';
  st.org = LIB_ORGS.includes(p.get('org')) ? p.get('org') : '';
  st.topic = libTopic(p.get('topic')) ? p.get('topic') : '';
  st.path = libPath(p.get('path')) ? p.get('path') : '';
  state.lib = st;
}
function libURL(st = libState()) {
  const p = new URLSearchParams();
  for (const k of ['topic', 'path', 'q', 'kind', 'org']) if (st[k]) p.set(k, st[k]);
  return 'lib' + (p.size ? '?' + p.toString() : '');
}
const libKindOk = (e, k) => !k || (LIB_KIND_GRP.find(g => g[0] === k)?.[2] || [k]).includes(e.kind);
const libNorm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s·.\-/_,()"'×]+/g, '');
const libHay = e => (e._h ||= libNorm([e.t, e.ko, e.en, ...(e.aka || []), e.sum, ...(e.facts || []), ...(e.watch || [])].join(' ')));
// Exact designations first; all words may also match independently in the explanation.
function libFind(q, kind, org, topic = '', path = '') {
  const n = libNorm(q), words = String(q || '').trim().split(/\s+/).map(libNorm).filter(Boolean);
  const ids = libTopic(topic)?.entries, pathIDs = libPath(path)?.steps.flatMap(x => x.entries);
  const L = LIB.filter(e => libKindOk(e, kind) && (!org || e.org === org) && (!ids || ids.includes(e.id)) && (!pathIDs || pathIDs.includes(e.id)));
  if (!n) return L;
  return L.map(e => {
    const t = libNorm(e.t), a = (e.aka || []).map(libNorm), ko = libNorm(e.ko), hay = libHay(e);
    const s = t === n || a.includes(n) ? 0 : t.startsWith(n) || a.some(x => x.startsWith(n)) ? 1 : t.includes(n) || ko.includes(n) || a.some(x => x.includes(n)) ? 2 : hay.includes(n) || words.every(x => hay.includes(x)) ? 3 : 9;
    return [s, e];
  }).filter(([s]) => s < 9).sort((x, y) => x[0] - y[0] || x[1].t.localeCompare(y[1].t, 'ko')).map(([, e]) => e);
}
const libBadge = e => `<span class="lib-org">${esc(e.org === '-' ? '공통' : e.org)}</span><span class="lib-kind">${esc(LIB_KIND[e.kind] || e.kind)}</span>${e.status && !/^현행/.test(e.status) ? `<span class="lib-st">${esc(e.status.split(' ')[0])}</span>` : ''}`;
const libCard = e => `<a class="lib-card" role="listitem" href="#lib-${e.id}" data-go="lib-${e.id}"><span class="lib-bd">${libBadge(e)}</span><b>${nwText(e.t)}</b><span class="lib-ko">${esc(e.ko || '')}</span><span class="lib-sum">${esc(e.sum || '')}</span><span class="lib-card-next">핵심 · 구매 시 주의 <span aria-hidden="true">↗</span></span></a>`;
const libLink = id => { const e = libE(id); return e ? `<a class="lib-chip" href="#lib-${e.id}" data-go="lib-${e.id}">${nwText(e.t)}</a>` : ''; };
const libActive = st => !!(st.q || st.kind || st.org || st.topic || st.path);
function libIcon(i) {
  const shapes = [
    '<path d="m12 8 8-4 8 4v9l-8 4-8-4zM20 21v15m-5-11h10m-10 5h10m-10 5h10"/>',
    '<path d="M10 7v30m20-30v30M10 9l20 6-20 6 20 6-20 6m0-18 20 6m-20 6 20 6"/>',
    '<path d="m20 4 14 8v16l-14 8-14-8V12zM6 12l14 8 14-8M20 20v16"/>',
    '<path d="M5 16h30v7H5zM5 27h30v7H5zM13 8h14v8H13zm3 8v22m8-22v22M13 38h14"/>',
    '<path d="M4 17h32v12H4zM13 17v-4h14v4M31 13v20M8 17v12"/>',
    '<path d="M5 21h30v6H5zM15 8h10v13H15zm0 19v7h10v-7M20 8V3m0 31v5"/>',
    '<path d="m20 4 12 7v14l-12 7-12-7V11zM8 11l12 7 12-7M20 18v14m-14 4h28"/>',
    '<path d="M10 4h15l7 7v25H10zM25 4v8h7M15 18h12m-12 6h12m-12 6h8"/>'
  ];
  return `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[i]}</svg>`;
}
function libOverview() {
  return `<div id="lib-overview"${libActive(libState()) ? ' hidden' : ''}>
    <section class="lib-section" aria-labelledby="lib-paths-h"><div class="lib-section-head"><div><span class="lab">START WITH YOUR TASK</span><h2 id="lib-paths-h">무엇을 확인하고 계신가요?</h2></div><p>목적에 맞는 순서로 읽어보세요.</p></div><div class="lib-path-grid">${LIB_PATHS.map((p, i) => `<a class="lib-path-card" href="#lib?path=${p.id}" data-go="lib?path=${p.id}"><span class="lib-path-no">0${i + 1} <span>${esc(p.audience)}</span></span><h3>${esc(p.title)} <span aria-hidden="true">↗</span></h3><p>${esc(p.desc)}</p><span class="lib-path-count">${p.steps.length}단계 읽기</span></a>`).join('')}</div></section>
    <section class="lib-section" aria-labelledby="lib-topics-h"><div class="lib-section-head"><div><span class="lab">EXPLORE BY TOPIC</span><h2 id="lib-topics-h">체결부품 지식의 전체 지도</h2></div><p>부품의 형태부터 조립과 검증까지.</p></div><div class="lib-topic-grid">${LIB_TOPICS.map((p, i) => `<a class="lib-topic-card" href="#lib?topic=${p.id}" data-go="lib?topic=${p.id}">${libIcon(i)}<span class="lib-topic-en" lang="en">${esc(p.en)}</span><h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p><span class="lib-topic-bottom">${p.entries.length}개 항목 <span aria-hidden="true">→</span></span></a>`).join('')}</div></section>
    <div class="lib-pop"><span class="lab">바로 찾는 규격·용어</span>${LIB_POP.map(libLink).join('')}</div></div>`;
}
function libPathHTML(p, active = '') {
  return `<section class="lib-route-panel" aria-label="${esc(p.title)} 읽기 순서"><div class="lib-route-head"><div><span class="lab">GUIDED READING · ${esc(p.audience)}</span><h2>${esc(p.title)}</h2><p>${esc(p.desc)}</p></div><a href="#lib" data-go="lib">전체 지식 지도 ↗</a></div><ol class="lib-steps">${p.steps.map((s, i) => `<li><span class="lib-step-no">0${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.desc)}</p><div class="lib-chips">${s.entries.map(id => id === active ? `<span class="lib-chip on" aria-current="page">${nwText(libE(id).t)}</span>` : libLink(id)).join('')}</div></div></li>`).join('')}</ol></section>`;
}
function libListHTML() {
  const st = libState(), L = libFind(st.q, st.kind, st.org, st.topic, st.path), limit = st.limit || 24;
  return `<p class="lib-count" aria-live="polite" aria-atomic="true">${L.length}개 항목${st.q ? ` · “${esc(st.q)}”` : ''}${L.length > limit ? ` · ${limit}개 표시` : ''}</p>${L.length ? `<div class="lib-grid" role="list">${L.slice(0, limit).map(libCard).join('')}</div>${L.length > limit ? `<button class="btn lib-more" type="button" data-lib-more>항목 더 보기 (${L.length - limit}개 남음)</button>` : ''}` : `<div class="lib-empty"><h3>현재 조건에 맞는 항목이 없습니다.</h3><p>검색어를 줄이거나 주제·분류·기관 조건을 해제해 보세요.</p><button class="btn" type="button" data-lib-reset>검색 조건 모두 지우기</button><p>사전에 없는 사양은 <a href="#list" data-go="list">목록 견적</a>에 표기 그대로 보내 주세요.</p></div>`}`;
}
function libIndex() {
  const st = libState(), topic = libTopic(st.topic), path = libPath(st.path);
  const seg = (k, v, t) => `<button type="button" class="lib-f${(st[k] || '') === v ? ' on' : ''}" data-lib-f="${k}" data-v="${v}" aria-pressed="${(st[k] || '') === v}">${esc(t)}</button>`;
  return iaPage(iaHead([['규격 사전']], '체결부품 지식 라이브러리', 'FASTENER KNOWLEDGE LIBRARY', '부품을 고르고, 도면을 읽고, 구매 조건을 정리할 때. 규격과 실무 지식을 필요한 순서로 찾아보세요.')
    + `${purchaseGuide()}<section class="lib-search-panel" aria-label="지식 검색"><form id="lib-search-form" role="search"><label for="lib-q">규격 번호, 품목 이름, 궁금한 개념으로 찾기</label><div class="lib-search"><input id="lib-q" type="search" value="${esc(st.q)}" placeholder="예: A193 B7, 토크 예압, 핀, EN 10204 3.1" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="200"><button type="submit" aria-label="라이브러리 검색">검색 <span aria-hidden="true">→</span></button></div></form><p>${LIB.length}개 항목 · 규격·개념·구매 시 주의까지 검색합니다.</p></section>
    ${libOverview()}${path ? libPathHTML(path) : ''}${topic ? `<section class="lib-topic-intro"><span class="lab">${esc(topic.en)}</span><h2>${esc(topic.title)}</h2><p>${esc(topic.desc)}</p><div class="lib-chips">${topic.featured.map(libLink).join('')}</div></section>` : ''}
    <section class="lib-browse" aria-labelledby="lib-browse-h"><aside class="lib-topic-nav"><h2>주제별 탐색</h2><nav aria-label="라이브러리 주제"><a href="#lib" data-go="lib"${!st.topic && !st.path ? ' aria-current="page"' : ''}>전체 지식 <span>${LIB.length}</span></a>${LIB_TOPICS.map(t => `<a href="#lib?topic=${t.id}" data-go="lib?topic=${t.id}"${st.topic === t.id ? ' aria-current="page"' : ''}>${esc(t.title)}<span>${t.entries.length}</span></a>`).join('')}</nav><p>번호를 알고 있다면 검색,<br>처음 살펴본다면 주제부터.</p></aside>
    <div class="lib-results-main"><div class="lib-section-head"><h2 id="lib-browse-h">${path ? '경로에 포함된 항목' : topic ? esc(topic.title) + ' 항목' : '전체 규격·용어'}</h2><button class="lib-reset" type="button" data-lib-reset${libActive(st) ? '' : ' hidden'}>조건 초기화 ↺</button></div><div class="lib-fs"><div class="lib-fr" role="group" aria-label="분류">${seg('kind', '', '전체 분류')}${LIB_KIND_GRP.map(([k, t]) => seg('kind', k, t)).join('')}</div><details class="lib-org-filter"${st.org ? ' open' : ''}><summary>발행 기관으로 좁히기${st.org ? ' · ' + esc(st.org) : ''}</summary><div class="lib-fr" role="group" aria-label="기관">${seg('org', '', '모든 기관')}${LIB_ORGS.filter(o => LIB.some(e => e.org === o)).map(o => seg('org', o, o)).join('')}</div></details></div><div id="lib-res">${libListHTML()}</div></div></section>
    <p class="small muted lib-foot">근거: 발행 기관 공개 페이지·공식 미리보기·공공 문서, 일부 값은 제조·유통사 공개 기술자료 3곳 이상 대조 · 확인 ${LIB_CHECKED}. 계약·설계에는 해당 규격 원문과 프로젝트 사양을 확인하세요. 틀린 곳은 <a href="#about" data-go="about" data-ia-fix="1">알려 주세요</a>.</p>`);
}
function libProductLinks(fam) {
  const matches = LIB.filter(e => (e.fam || []).includes(fam));
  if (!matches.length) return '';
  const picked = [...matches.filter(e => e.kind === 'part'), ...matches.filter(e => e.kind !== 'part')].slice(0, 5);
  return `<section class="lib-product-context"><span class="lab">RELATED KNOWLEDGE</span><h3>이 품목을 이해하는 규격·지식</h3><div class="lib-chips">${picked.map(e => libLink(e.id)).join('')}</div><a class="lib-context-all" href="#lib" data-go="lib">라이브러리에서 더 살펴보기 →</a></section>`;
}
function libEntry(e) {
  const topic = libTopicOf(e.id), paths = LIB_PATHS.filter(p => p.steps.some(s => s.entries.includes(e.id)));
  const path = paths.find(p => p.id === libState().path) || paths[0];
  const back = libURL();
  const fams = (e.fam || []).filter(id => Object.hasOwn(CAT_F, id));
  const same = (typeof LIB !== 'undefined' ? LIB : []).filter(x => x.org === e.org && x.kind === e.kind), i = same.indexOf(e);
  const nav = (x, lab) => x ? `<a href="#lib-${x.id}" data-go="lib-${x.id}"><span class="lab">${lab}</span>${nwText(x.t)}</a>` : '<span></span>';
  const tbl = e.table && Array.isArray(e.table.rows) && e.table.rows.length ? `<figure class="lib-tbl" id="lib-table" tabindex="-1"><figcaption>${esc(e.table.cap || '')}</figcaption><div class="tblw"><table class="tbl"><thead><tr>${(e.table.head || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${e.table.rows.map(r => `<tr>${r.map(c => `<td>${nwText(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${e.table.note ? `<p class="small muted">${esc(e.table.note)}</p>` : ''}</figure>` : '';
  return iaPage(iaHead([['규격 사전', back], ...(topic ? [[topic.title, 'lib?topic=' + topic.id]] : []), [e.t]], nwText(e.t), '', '', `<div class="lib-hd"><p class="lib-bd">${libBadge(e)}</p><p class="lib-kot">${esc(e.ko || '')}</p>${e.en ? `<p class="lib-en" lang="en">${esc(e.en)}</p>` : ''}</div>`)
    + `<div class="lib-entry-tools"><a href="#${back}" data-go="${back}">← 목록으로 돌아가기</a><a href="/lib/${e.id}">이 항목의 공유 페이지 ↗</a></div><nav class="lib-entry-toc" aria-label="항목 안에서 이동"><a href="#lib-core" data-lib-jump="lib-core">핵심</a>${e.table?.rows?.length ? '<a href="#lib-table" data-lib-jump="lib-table">표·조건</a>' : ''}${e.watch?.length ? '<a href="#lib-watch" data-lib-jump="lib-watch">구매 시 주의</a>' : ''}<a href="#lib-source" data-lib-jump="lib-source">근거</a></nav><div class="lib-body"><div class="lib-main">
      <p class="lib-lead">${esc(e.sum || '')}</p>
      ${e.status ? `<p class="lib-stl${/^현행/.test(e.status) ? ' ok' : ''}"><span class="lab">상태</span>${esc(e.status)}</p>` : ''}
      <h2 class="lib-h" id="lib-core" tabindex="-1">핵심</h2><ul class="lib-facts">${(e.facts || []).map(f => `<li>${nwText(f)}</li>`).join('')}</ul>
      ${tbl}
      ${(e.watch || []).length ? `<section class="lib-watch" id="lib-watch" tabindex="-1"><h2 class="lib-h">BOM·구매 때 주의</h2><ul>${e.watch.map(w => `<li>${nwText(w)}</li>`).join('')}</ul></section>` : ''}
      ${(e.eq || []).length ? `<h2 class="lib-h">대응·대체 규격</h2><ul class="lib-eq">${e.eq.map(q => `<li><b>${nwText(q.std || '')}</b>${q.note ? ` <span>${esc(q.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}
      <p class="small muted lib-src" id="lib-source" tabindex="-1">근거: ${(e.src || []).map(s => nwText(s)).join(' · ')} · 라이브러리 일괄 검토 ${LIB_CHECKED} (개별 항목 검토일 미기록). 규격 원문을 옮긴 것이 아니라 요점을 정리한 것입니다. 프로젝트 판본·허용차·사용 조건은 원문과 공급처 서류로 확인해야 합니다. 미확인 값은 추정하지 마세요.</p>${purchaseSourceLinks(e)}<button class="btn" type="button" data-purchase-entry="${e.id}">이 항목을 견적 확인 질문에 연결 →</button>
    </div><aside class="lib-side">
      ${topic ? `<div class="lib-box lib-topic-context"><span class="lab">지식 지도에서의 위치</span><h2 class="lib-h">${esc(topic.title)}</h2><p>${esc(topic.desc)}</p><a href="#lib?topic=${topic.id}" data-go="lib?topic=${topic.id}">이 주제 전체 보기 →</a></div>` : ''}
      ${path ? `<div class="lib-box lib-reading"><h2 class="lib-h">함께 읽기 · ${esc(path.title)}</h2><ol>${path.steps.map((s, i) => `<li><span>0${i + 1} ${esc(s.title)}</span><div class="lib-chips">${s.entries.map(id => id === e.id ? `<span class="lib-chip on" aria-current="page">${nwText(e.t)}</span>` : libLink(id)).join('')}</div></li>`).join('')}</ol><a href="#lib?path=${path.id}" data-go="lib?path=${path.id}">읽기 경로 전체 보기 →</a></div>` : ''}
      ${(e.rel || []).some(libE) ? `<div class="lib-box"><h2 class="lib-h">관련 항목</h2><div class="lib-chips">${e.rel.map(libLink).join('')}</div></div>` : ''}
      ${fams.length ? `<div class="lib-box"><h2 class="lib-h">관련 품목</h2><ul class="lib-fams">${fams.map(id => `<li><a href="#c-${id}" data-go="c-${id}">${esc(CAT_F[id].ko)} <span aria-hidden="true">→</span></a></li>`).join('')}</ul></div>` : ''}
      <div class="lib-box lib-cta"><h2 class="lib-h">이 규격이 들어간 BOM이 있으신가요?</h2><p>표기 그대로 붙여 넣으면 줄마다 규격·등급과 필요한 서류를 맞춰 견적합니다.</p><a class="btn pri" href="#list" data-go="list">목록 견적으로 →</a></div>
    </aside></div>
    <nav class="lib-pn" aria-label="같은 분류의 앞뒤 항목">${nav(same[i - 1], '이전')}${nav(same[i + 1], '다음')}</nav>`);
}
V.lib = id => { const e = id ? libE(id) : null; return e ? libEntry(e) : libIndex(); };
V.after.lib = id => {
  const e = id ? libE(id) : null;
  if (e) {
    document.title = `${e.t} · ${e.ko || ''} | 볼트노트 규격 사전`;
    view().addEventListener('click', ev => {
      const a = ev.target.closest('[data-lib-jump]'); if (!a) return;
      ev.preventDefault(); const target = $(a.dataset.libJump);
      target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
    });
    return;
  }
  const st = libState(), q = $('lib-q'), res = $('lib-res');
  const label = libTopic(st.topic)?.title || libPath(st.path)?.title;
  document.title = (label ? label + ' · ' : '') + '체결부품 지식 라이브러리 | 볼트노트';
  let t = null;
  const draw = () => {
    if (!q.isConnected) return;
    res.innerHTML = libListHTML();
    $('lib-overview').hidden = libActive(st);
    view().querySelectorAll('[data-lib-reset]').forEach(b => b.hidden = !libActive(st));
    history.replaceState(null, '', '#' + libURL(st));
  };
  const search = () => { clearTimeout(t); if (!q.isConnected) return; st.q = q.value.trim(); st.limit = 24; draw(); };
  q.addEventListener('input', ev => { if (ev.isComposing) return; clearTimeout(t); t = setTimeout(search, 120); });
  q.addEventListener('compositionend', search);
  $('lib-search-form').addEventListener('submit', ev => { ev.preventDefault(); search(); $('lib-browse-h').scrollIntoView({ block: 'start' }); });
  view().addEventListener('click', ev => {
    if (ev.target.closest('[data-lib-reset]')) { clearTimeout(t); go('lib'); $('lib-q')?.focus(); return; }
    if (ev.target.closest('[data-lib-more]')) {
      const old = res.querySelectorAll('.lib-card').length;
      st.limit = (st.limit || 24) + 24; draw();
      res.querySelectorAll('.lib-card')[old]?.focus({ preventScroll: true }); return;
    }
    const b = ev.target.closest('[data-lib-f]'); if (!b) return;
    clearTimeout(t); st.q = q.value.trim(); st.limit = 24; st[b.dataset.libF] = b.dataset.v;
    view().querySelectorAll(`[data-lib-f="${b.dataset.libF}"]`).forEach(x => { const on = x.dataset.v === b.dataset.v; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    draw();
  });
};
// 공개한 항목이 없으면(대표 확인 전) 머리글·바닥글의 사전 링크를 뺀다
// 기존 미터·인치 상세 화면에도 같은 지식 입구를 제공한다.
for (const name of ['m', 'i']) {
  const after = V.after[name];
  V.after[name] = id => {
    after?.(id);
    const left = view().querySelector('.fam-l'), context = libProductLinks(id);
    if (left && context && !left.querySelector('.lib-product-context')) left.insertAdjacentHTML('beforeend', context);
  };
}
if (!LIB_BY || !Object.keys(LIB_BY).length) document.querySelectorAll('[data-lib]').forEach(a => a.remove());
// 검색 색인: 머리글 찾기에서도 사전 항목이 나오게
(typeof LIB !== 'undefined' ? LIB : []).forEach(e => INDEX.push({ t: `${e.t} · ${e.ko || ''}`, s: e.sum ? e.sum.slice(0, 60) : '', k: [e.t, e.ko, e.en, ...(e.aka || [])].join(' ').toLowerCase(), go: 'lib-' + e.id, g: '규격 사전' }));
