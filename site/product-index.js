(() => {
  'use strict';
  const input = document.getElementById('product-q');
  const cards = Array.from(document.querySelectorAll('[data-product]'));
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const update = () => {
    const words = normalize(input.value).split(' ').filter(Boolean);
    let count = 0;
    for (const card of cards) {
      card.hidden = !words.every(word => normalize(card.dataset.search).includes(word));
      if (!card.hidden) count++;
    }
    for (const group of document.querySelectorAll('[data-product-group],[data-product-category]')) {
      group.hidden = !group.querySelector('[data-product]:not([hidden])');
    }
    document.getElementById('product-count').textContent = count ? `${count}개 품목 · 제품 카드를 누르면 구매 안내로 이동합니다.` : '찾는 품목이 없으면 기존 BOM·RFQ를 Sales로 보내 주세요.';
  };
  input.addEventListener('input', update);
  document.getElementById('product-search').addEventListener('submit', event => { event.preventDefault(); update(); });
  update();
})();
