(() => {
  'use strict';
  // 규격표 모음(/tables/)의 찾기: 품목명·영문명·규격 번호로 카드를 거른다 (site/build_tables.py가 인라인으로 넣는다)
  const input = document.getElementById('table-q');
  const cards = Array.from(document.querySelectorAll('[data-table]'));
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const update = () => {
    const words = normalize(input.value).split(' ').filter(Boolean);
    let count = 0;
    for (const card of cards) {
      card.hidden = !words.every(word => normalize(card.dataset.search).includes(word));
      if (!card.hidden) count++;
    }
    for (const group of document.querySelectorAll('[data-table-group]')) group.hidden = !group.querySelector('[data-table]:not([hidden])');
    document.getElementById('table-count').textContent = count ? `${count}개 규격표 · 누르면 표로 이동합니다.` : '찾는 규격표가 없으면 품목 이름이나 규격 번호를 Sales로 보내 주세요.';
  };
  input.addEventListener('input', update);
  document.getElementById('table-search').addEventListener('submit', event => { event.preventDefault(); update(); });
  update();
})();
