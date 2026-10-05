/* ── 금액: 한글 금액·공급가액·부가세·합계 (BOM·C&D 사양 3.5절) ──
   한글 금액은 합계와 같은 변수에서 만들고(wonKo(total)), 다시 숫자로 읽어 같은지 확인한다(wordsOk). */
const KO_D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], KO_S = ['', '십', '백', '천'], KO_B = ['', '만', '억', '조', '경'];
// 129800 → '일십이만구천팔백원'. 견적서 관행대로 '일십·일백·일천'처럼 1도 적는다 (고쳐 쓰기 방지). 0 → '영원'
function wonKo(n) {
  n = Math.round(+n || 0);
  if (n < 0) return '마이너스 ' + wonKo(-n);
  if (n === 0) return '영원';
  let out = '';
  for (let g = 0; n > 0; g++, n = Math.floor(n / 10000)) {
    const part = n % 10000; if (!part) continue;
    let s = '';
    for (let i = 3; i >= 0; i--) { const d = Math.floor(part / 10 ** i) % 10; if (d) s += KO_D[d] + KO_S[i]; }
    out = s + KO_B[g] + out;
  }
  return out + '원';
}
// 견적서 합계 띠 표기: 129800 → '금 일십이만구천팔백원정 (₩129,800)'. pre는 '금'(기본) 또는 '일금'
const wonKoDoc = (n, pre = '금') => `${pre} ${wonKo(n)}정 (₩${Math.round(+n || 0).toLocaleString('ko-KR')})`;
// 한글 금액 → 숫자 ('금 …원정 (₩…)', '일금 …원정', '…원' 모두). 못 읽으면 NaN
function wonKoNum(s) {
  let t = String(s ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').replace(/^(?:일금|금)/, '').replace(/원정?$/, '');
  const neg = t.startsWith('마이너스'); if (neg) t = t.slice(4);
  if (!t) return NaN;
  if (t === '영') return 0;
  let total = 0, sec = 0, num = 0;
  for (const ch of t) {
    const d = KO_D.indexOf(ch), u = KO_S.indexOf(ch), b = KO_B.indexOf(ch);
    if (d > 0) num = d;
    else if (u > 0) { sec += (num || 1) * 10 ** u; num = 0; }
    else if (b > 0) { total += (sec + num || 1) * 10000 ** b; sec = 0; num = 0; }
    else return NaN;
  }
  total += sec + num;
  return neg ? -total : total;
}
const wonKoOk = n => wonKoNum(wonKo(n)) === Math.round(+n || 0);

/* 부가세 (사양 12장 미결 9번 결정): BOM_VAT.method = 'total-round'
   공급가액 합계(운임 포함) × 10%를 원 단위로 반올림해 한 번 계산한다. 견적함 합계 상자가 같은 식
   (Math.round((sub + ship) × .1))을 쓰므로 BOM 요약·견적서·청구 금액이 원 단위까지 같다.
   줄 세액은 이 합계 세액을 줄 공급가액 비율로 나눈 값이고, 원 미만 끝수는 큰 나머지 순으로 1원씩 배분한다 → 줄 세액의 합 = 합계 세액.
   (줄마다 절사해 더하는 방식으로 바꾸려면 견적함 합계 식도 함께 바꿔야 한다. 세금계산서 발행 방식과 같게 맞출 것) */
const BOM_VAT = {
  rate: SHOP_TERMS.vat, method: 'total-round',
  gc: {
    id: 'GC-C01',
    ko: '통화는 원(KRW)입니다. 단가는 부가가치세 별도입니다. 부가세는 공급가액 합계(운임 포함)에 10%를 곱해 원 단위로 반올림해 한 번 계산하고, 줄별 세액은 그 합계 세액을 줄 공급가액 비율로 나눠 적어 줄 세액의 합이 합계 세액과 같습니다. 한글 금액은 합계 금액과 같습니다.',
    en: 'Prices in KRW, excluding VAT. VAT is computed once on the total supply amount (incl. freight) at 10%, rounded to the won; line VAT is that total allocated pro rata, so line VAT adds up to the total. The amount in words equals the total.',
  },
};
const bomVatTotal = supply => Math.round(supply * BOM_VAT.rate);
// 합계 세액을 줄 공급가액 비율로 나눈다 (합이 정확히 vat). 끝수는 나머지가 큰 줄부터, 같으면 금액이 큰 줄부터
function bomVatSplit(amounts, vat) {
  const S = amounts.reduce((a, x) => a + x, 0);
  if (!S) return amounts.map(() => 0);
  const exact = amounts.map(x => vat * x / S), out = exact.map(x => Math.floor(x + 1e-9));
  let left = vat - out.reduce((a, x) => a + x, 0);
  const order = exact.map((x, i) => [x - out[i], amounts[i], i]).sort((a, b) => b[0] - a[0] || b[1] - a[1] || a[2] - b[2]);
  for (const [, , i] of order) { if (left <= 0) break; out[i]++; left--; }
  return out;
}
/* 견적 합계: items = bomLine 결과 [{ row, q, m }]. 확정 합계에는 카탈로그 품목(catalog) 줄만 넣는다 (참고가·회신 예정 줄 제외).
   반환 { sub(줄 공급가액 합), ship(운임), supply(sub+ship), vat, total, lines[{ no, supply, vat }], shipVat, words, doc, wordsOk, method }
   sub·ship·vat·total은 견적함 합계 상자와 같은 식이다. */
function bomTotals(items) {
  const cat = (items || []).filter(x => x && x.m && x.m.status === 'catalog');
  const sub = cat.reduce((a, x) => a + (x.m.amount || 0), 0);
  const ship = sub === 0 ? 0 : sub >= FREE_SHIP ? 0 : SHIP_FEE;
  const supply = sub + ship, vat = bomVatTotal(supply), total = supply + vat;
  const split = bomVatSplit([...cat.map(x => x.m.amount || 0), ship], vat);
  const words = wonKo(total);
  return { sub, ship, supply, vat, total, lines: cat.map((x, i) => ({ no: x.row?.no ?? null, supply: x.m.amount || 0, vat: split[i] })), shipVat: split[split.length - 1],
    words, doc: wonKoDoc(total), wordsOk: wonKoNum(words) === total, method: BOM_VAT.method };
}
