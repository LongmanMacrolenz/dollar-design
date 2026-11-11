/* ── 문의 집계 (대표 요청 2026-11-10): 방문이 문의까지 얼마나 가는지 센다 ──
   보내는 것은 화면·버튼의 이름 하나뿐이다 (POST /count, 본문 예: list). 입력 내용·주소·참조 주소·식별값을 보내지 않는다.
   서버(worker/index.mjs countPing)는 날짜·이름·횟수만 저장하고, 합계는 관리자 화면(/admin → 문의 집계)에서 본다.
   - 페이지를 연 동안 이름마다 한 번만 보낸다 (여러 번 눌러도 1건 = 방문 기준).
   - 보내지 않는 경우: 스위치(SHOP.funnelCount) 꺼짐, 자동화 브라우저, 추적 거부 신호(GPC·Do Not Track),
     관리자 화면에서 켠 「이 브라우저는 세지 않기」(localStorage bn.nocount).
   - 이름 목록은 worker/index.mjs COUNT_EVENTS와 같아야 한다 (en은 영문 페이지 site/count.js 전용). 처리방침 B항(v6_policy.js)이 이 동작을 적는다.
   window.__bnCountTest는 자동 점검(worker/tests/browser.py)이 켜는 스위치다. */
const BN_COUNT_NAMES = ['visit', 'home', 'list', 'materials', 'copy', 'rfq', 'kakao', 'tel', 'mail'];
const BN_COUNT_VIEWS = { home: 'home', list: 'list', materials: 'materials' };
const bnCounted = new Set();
function bnCountAllowed() {
  if (!COUNT_ON || !/^https?:$/.test(location.protocol)) return false;
  if (navigator.webdriver && !window.__bnCountTest) return false;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return false;
  try { if (localStorage.getItem('bn.nocount') === '1') return false; } catch {}
  return true;
}
function bnCount(name) {
  if (!BN_COUNT_NAMES.includes(name) || bnCounted.has(name) || !bnCountAllowed()) return;
  bnCounted.add(name);
  try { if (!navigator.sendBeacon?.('/count', name)) fetch('/count', { method: 'POST', body: name, keepalive: true }).catch(() => {}); } catch {}
}
// 화면: iaAfterNav(v7_ia.js)가 화면이 바뀔 때마다 부른다
function bnCountView(route) { bnCount('visit'); const name = BN_COUNT_VIEWS[route]; if (name) bnCount(name); }   // visit = 홈페이지를 연 횟수 (어느 화면으로 들어왔든 1건)
// 누름: 카카오톡·전화·메일 링크, 주소 복사(명함·Sales·견적 보내기 창·회사 소개·파일 보내기 창), RFQ 본문·제목 복사와 내려받기
document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  const href = t.closest('a[href]')?.getAttribute('href') || '';
  if (href.startsWith('https://pf.kakao.com/')) bnCount('kakao');
  else if (href.startsWith('tel:')) bnCount('tel');
  else if (href.startsWith('mailto:')) bnCount('mail');
  const b = t.closest('[data-sales-copy],[data-sales-download],#rs-copy-addr,#rs-copy,#copy-mail,[data-ia-copy]');
  if (!b || b.disabled) return;
  if (b.dataset.salesCopy) bnCount(b.dataset.salesCopy === 'address' ? 'copy' : 'rfq');
  else if (b.hasAttribute('data-sales-download') || b.id === 'rs-copy') bnCount('rfq');
  else if (!b.dataset.iaCopy || b.dataset.iaCopy === CONTACT.rfq) bnCount('copy');
}, true);
