/* Purchase questions stay separate from the source BOM. No customer data or analytics leave this page. */
const purchaseDraft = { line:'', values:['','','','','',''], references:[] };
const PURCHASE_STEPS = [
 ['단위 체계','미터 / 인치 / 도면 확인 필요','t-inch-mm'],
 ['나사 표기','호칭 · 피치/TPI · 공차 · 내외나사','t-inch-designation'],
 ['등급과 재질','볼트/너트 등급 · 규격 판본 · 대체 허용','pc-steel'],
 ['표면처리·사용 조건','코팅 계통 · 온도 · 염분 · 사워 서비스','t-hdg'],
 ['필요한 서류','CoC / MTR / EN 10204 · 히트/로트 · 시험','t-en10204-types'],
 ['견적 줄 확인','수량 · 도면 개정 · 희망일 · 추가 확인 질문','t-heat-lot']
];
function purchaseScope(f) {
  if (!['A','B'].includes(f.p)) return '원문 검토 품목';
  return /^(hbf|hbp|hn|pw|sw|scs|b7|hh|mhh)$/.test(f.id) ? '주력 품목군' : '조건부 조달 품목';
}
function purchaseLineup() {
 return `<div class="purchase-scope-grid">${[
 ['주력 품목군','육각볼트·너트·와셔·표준 볼팅','반복 검토의 중심 품목입니다. 나사·등급·길이·표면처리와 필요한 서류를 확인합니다.'],
 ['조건부 조달 품목','특수 재질·코팅·축 체결부품','사용 조건과 도면, 제조사 증빙을 받은 뒤 조달 여부를 확인합니다.'],
 ['원문 검토 품목','특수 규격·대체·도면 제작 요구','프로젝트 사양·규격 판본·수락 기준을 먼저 검토합니다. 원문 제공이 필요할 수 있습니다.']
 ].map(([t,k,d])=>`<article><span class="purchase-badge">${t}</span><h3>${k}</h3><p>${d}</p><a href="#lib?path=purchase" data-go="lib?path=purchase">사양·서류 확인 →</a> <a href="#list" data-go="list">BOM 견적 요청 →</a></article>`).join('')}</div><p class="purchase-note">주력은 검토 우선순위입니다. 카탈로그는 탐색 범위이며 재고·납기·공급 보장을 뜻하지 않습니다. 모든 품목의 조달 가능 여부는 견적별로 확인합니다.</p>`;
}
function purchaseGuide() {
 if (libState().path !== "purchase") return `<section class="purchase-guide"><p class="lab">START WITH A PURCHASE DECISION</p><h2>지식을, 구매 조건으로.</h2><p>단위 → 나사 표기 → 등급·재질 → 표면처리·사용 조건 → 서류 → BOM 확인 질문</p><a class="btn pri" href="#lib?path=purchase" data-go="lib?path=purchase">6단계 구매 결정 경로 →</a></section>`;
 return `<section class="purchase-guide" aria-labelledby="purchase-guide-h"><p class="lab">PURCHASE DECISION → BOM</p><h2 id="purchase-guide-h">특수요건을 견적 줄에 연결하세요.</h2><p>도면·고객 요구를 그대로 적으세요. 모르는 값은 비워 두면 ‘미확인’으로 남습니다. 원래 BOM은 수정하지 않습니다.</p><label>BOM 줄 번호 / 품목 식별자<input class="inp" data-purchase-line value="${esc(purchaseDraft.line)}" placeholder="예: 12번 줄 · 스터드볼트" maxlength="200"></label><ol class="purchase-question-grid">${PURCHASE_STEPS.map(([t,h,id],i)=>`<li><label><b>0${i+1} ${t}</b><input class="inp" data-purchase-field="${i}" value="${esc(purchaseDraft.values[i])}" placeholder="${h}" maxlength="1200"></label><a href="#lib-${id}" data-go="lib-${id}">확인할 지식 ↗</a></li>`).join('')}</ol>${purchaseDraft.references.length?`<p>연결한 참고 항목: ${purchaseDraft.references.map(esc).join(' · ')}</p>`:''}<div class="bn-actions"><button class="btn pri" type="button" data-purchase-continue>BOM 견적 요청으로 →</button><button class="btn" type="button" data-purchase-download>확인 질문 내려받기</button><button class="btn" type="button" data-purchase-clear>질문 초기화</button></div><p class="purchase-note">입력은 이 페이지의 메모리에만 남습니다. 새로고침 전에 체크리스트를 내려받아 BOM·도면과 함께 메일에 첨부하세요. 여러 품목은 줄별로 문서를 저장해 주세요.</p></section>`;
}
function purchaseChecklistText() {
 if (!purchaseDraft.line && !purchaseDraft.values.some(Boolean) && !purchaseDraft.references.length) return '';
 return ['[특수요건 확인 질문 — 원본 BOM 별첨]',`연결할 BOM 줄: ${purchaseDraft.line || '미확인 — 줄 번호 확인 필요'}`,...PURCHASE_STEPS.map(([t],i)=>`${t}: ${purchaseDraft.values[i] || '미확인 — 공급처/고객 확인 필요'}`),...purchaseDraft.references.map(x=>`참고 항목: ${x}`),'값·대체·서류·납기는 확인 전 확정하지 않습니다.'].join('\n');
}
const PURCHASE_OFFICIAL = {ASTM:['ASTM 공식 규격 검색','https://www.astm.org/'],ASME:['ASME 공식 규격 검색','https://www.asme.org/codes-standards'],ISO:['ISO 공식 규격 검색','https://www.iso.org/standards.html'],KS:['국가표준인증 통합정보','https://standard.go.kr/'],JIS:['JISC 공식 표준 정보','https://www.jisc.go.jp/'],DIN:['DIN 공식 표준 정보','https://www.din.de/en'],SAE:['SAE 공식 규격 검색','https://www.sae.org/standards'],API:['API 공식 규격 정보','https://www.api.org/products-and-services/standards']};
function purchaseSourceLinks(e) {
 const orgs = Object.keys(PURCHASE_OFFICIAL).filter(k=>k===e.org || (e.src||[]).some(x=>x.startsWith(k)));
 return `<div class="purchase-source-links">${orgs.map(k=>{const [t,u]=PURCHASE_OFFICIAL[k];return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`;}).join(' ')}<p class="purchase-note">링크는 발행 기관의 검색·안내 페이지입니다. 항목의 전체 내용이나 개별 수치를 검증하는 원문 링크는 아닙니다. 필요한 판본·수치는 구매 또는 정식 열람한 원문에서 확인하세요.</p></div>`;
}
function purchaseTrust() {
 return `<section class="bn-section purchase-trust"><div class="bn-wrap"><p class="bn-eyebrow">06 / HOW WE VERIFY</p><h2>확인한 것과,<br>확인할 것을 분리합니다.</h2><div class="purchase-scope-grid"><article><h3>공급 절차</h3><p>BOM 원문 보존 → 사양 질문 → 공급처 회신·근거 대조 → C&D 확인 → 견적. 미확인 단가·재고·납기는 확정하지 않습니다.</p></article><article><h3>문의·서류 확인 범위</h3><p>사양 누락과 공급 가능 여부를 확인합니다. 설계 승인·현장 시공 인증·자체 시험 성적 발급은 제공 범위가 아닙니다. 제조사 문서의 품목·등급·히트/로트 연결을 확인하며 미제공 서류는 명시합니다.</p><a href="#about" data-go="about">문의 시간·운영 범위 →</a></article><article><h3>사업자 정보</h3><p>볼트노트 · 대표 ${esc(SHOP.ownerName)}<br>사업자등록번호 ${esc(SHOP.bizNo)}</p><p>${ORDER_LIVE?'운영 정보와 거래 조건을 확인해 주세요.':'검증 운영 중 · 참고 견적. 통신판매업 신고번호는 등록 전입니다.'}</p><a href="#about" data-go="about">회사·거래 안내 →</a></article></div><details class="purchase-sample"><summary>견적·C&D 작성 예시 보기</summary><p><strong>가상·익명 형식 샘플</strong> — 실제 고객 사례·공급 회신·견적 가격이 아닙니다.</p><div class="tblw"><table class="tbl"><thead><tr><th>BOM 줄</th><th>요청</th><th>견적에 적을 상태</th><th>C&D / 다음 확인</th></tr></thead><tbody><tr><td>DEMO-01</td><td>스터드 + 헤비너트 / 재질·수량은 고객 BOM 참조</td><td>단가·납기·서류: 공급처 확인 전</td><td>C: 나사 공차·코팅·문서 종류 미확인 → 고객 질문</td></tr><tr><td>DEMO-02</td><td>도면 지정 부품 / 대체 불가</td><td>공급 제안 대조 전 · 견적 보류</td><td>D: 공급 제안이 도면과 다를 때 기록 → 차이·근거·고객 승인 필요</td></tr></tbody></table></div><p>C는 확인 질문, D는 요청과 제안의 차이입니다. 차이를 숨기거나 승인 없이 대체하지 않습니다. 실제 고객 사례는 동의와 사실 검증 후 공개합니다.</p></details></div></section>`;
}
// Session-local diagnostics: counts only; no BOM, identities, destinations or external tracking.
const purchaseMetrics = {homeViews:0, listViews:0, start:0, prepared:0, handoff:0, checklist:0};
const purchaseHomeView=V.home;
V.home=()=>{purchaseMetrics.homeViews++;return purchaseHomeView();};
window.__purchaseMetrics = purchaseMetrics;
document.addEventListener('input',e=>{
 if(e.target.matches('[data-purchase-line]')) purchaseDraft.line=e.target.value;
 if(e.target.matches('[data-purchase-field]')) purchaseDraft.values[Number(e.target.dataset.purchaseField)]=e.target.value;
});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-purchase-product],[data-purchase-entry],[data-purchase-continue],[data-purchase-download],[data-purchase-clear]');
 if(e.target.closest('[data-purchase-event="start"]')) purchaseMetrics.start++;
 if(e.target.closest('[data-sb-rq],[data-q="send"]')) purchaseMetrics.prepared++;
 if(e.target.closest('[data-rs="mail"]')) purchaseMetrics.handoff++;
 if(!b)return;
 if(b.hasAttribute('data-purchase-product')) {const f=CAT_F[b.dataset.purchaseProduct]; if(f)purchaseDraft.references.push(f.ko);go('lib?path=purchase');}
 if(b.hasAttribute('data-purchase-entry')) {const x=libE(b.dataset.purchaseEntry);if(x)purchaseDraft.references.push(x.t+' — '+((x.watch||[]).slice(0,2).join(' / ') || '프로젝트 판본과 적용 범위 확인'));go('lib?path=purchase');}
 if(b.hasAttribute('data-purchase-continue')) {purchaseMetrics.start++;go('list');}
 if(b.hasAttribute('data-purchase-clear')) {purchaseDraft.line='';purchaseDraft.values.fill('');purchaseDraft.references=[];go('lib?path=purchase');}
 if(b.hasAttribute('data-purchase-download')) {
  const body=purchaseChecklistText() || ['[특수요건 확인 질문]',...PURCHASE_STEPS.map(([t])=>t+': 미확인')].join('\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF'+body],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Boltnote-requirements.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);purchaseMetrics.checklist++;
 }
});
const purchaseOriginalList=V.list;
V.list=()=>{purchaseMetrics.listViews++;return purchaseOriginalList()+ (purchaseChecklistText()?`<section class="purchase-guide"><h2>함께 보낼 특수요건</h2><pre class="purchase-draft">${esc(purchaseChecklistText())}</pre><button class="btn" type="button" data-purchase-download>체크리스트 내려받기</button><a href="#lib?path=purchase" data-go="lib?path=purchase">질문 수정 →</a><p>요청서·원본 BOM과 함께 첨부해 주세요. 이 문서는 서버로 자동 전송되지 않습니다.</p></section>`:'');};
