/* 정적 라이브러리: 본문 검색, 공유 가능한 검색 주소, 자바스크립트 없이도 주제·항목 링크 유지 */
(() => {
  const q = document.getElementById('q'), cards = [...document.querySelectorAll('.card')];
  const norm = s => s.normalize('NFKC').toLowerCase().replace(/[\s·.\-/_,()"'×]+/g, '');
  const hay = cards.map(c => norm(c.dataset.s));
  const draw = () => {
    const value = q.value.trim(), all = norm(value), words = value.split(/\s+/).map(norm).filter(Boolean);
    cards.forEach((c, i) => { c.hidden = !!all && !(hay[i].includes(all) || words.every(w => hay[i].includes(w))); });
    document.querySelectorAll('.sec').forEach(s => { s.hidden = ![...s.querySelectorAll('.card')].some(c => !c.hidden); });
    const count = cards.filter(c => !c.hidden).length;
    document.getElementById('count').textContent = `${count}개 항목${value ? ` · “${value}”` : ''}`;
    document.getElementById('empty').hidden = count > 0;
    document.getElementById('overview').hidden = !!value;
    const u = new URL(location.href);
    if (value) u.searchParams.set('q', value); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
  };
  q.value = (new URLSearchParams(location.search).get('q') || '').slice(0, 200);
  q.addEventListener('input', ev => { if (!ev.isComposing) draw(); });
  q.addEventListener('compositionend', draw);
  document.getElementById('search').addEventListener('submit', ev => {
    ev.preventDefault(); draw(); document.getElementById('count').scrollIntoView({ block: 'start' });
  });
  document.getElementById('reset').addEventListener('click', () => { q.value = ''; draw(); q.focus(); });
  draw();
})();
