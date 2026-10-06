/* Sales email guide: address and editable examples work with any mail service.
   Free text stays in memory; copying an example is never a receipt confirmation. */
const salesDraft = { number:'', memo:'' };
function salesMailPackage() {
  if (!salesDraft.number) salesDraft.number=rfqNo('Q');
  const subject=`[RFQ] ${salesDraft.number} 체결부품 견적 문의`;
  const memo=salesDraft.memo;
  const requirements=purchaseChecklistText();
  const body=[
    '볼트노트 Sales 담당자님께',`요청번호: ${salesDraft.number}`,
    memo.trim()?memo:[
      '첨부한 BOM·RFQ·도면 기준으로 견적을 요청드립니다.',
      '품목·수량·사양과 특수요건은 첨부 자료를 확인해 주세요.',
      '',
      '요청사항: 단가, 공급 가능 수량, 납기, 서류 제공 범위',
      '희망 시점: [정해진 경우만 적어 주세요]',
      '추가 조건: [필요한 서류·표면처리·대체품 검토 여부 등]',
      '회사 / 담당자: [회사명 / 성함]',
      '회신 연락처: [이메일 또는 전화번호]',
      '',
      '확인이 필요한 사양은 질문으로 안내 부탁드립니다.',
    ].join('\n'),
    requirements,
  ].filter(Boolean).join('\n\n');
  const to=String(CONTACT.rfq||'').trim();
  return {to,subject,body};
}
function salesContactMarkup(home=false) {
  const id=home?'sales-home-copy':'sales-copy-address';
  const address=rfqOk('rfq')?`<p class="sales-recipient" id="sales-email">${esc(String(CONTACT.rfq).trim())}</p><button type="button" class="sales-primary" id="${id}" data-sales-copy="address">이메일 주소 복사 <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>`:'<p class="sales-unset">견적 이메일 확인 후 상담을 연결합니다.</p>';
  const kakao=rfqOk('kakaoChat')?`<a href="${esc(CONTACT.kakaoChat)}" target="_blank" rel="noopener noreferrer">카카오톡으로 문의 <span aria-hidden="true">↗</span></a>`:'';
  return `<section class="sales-contact" aria-label="Sales 이메일 상담">
    <div class="sales-card-top"><span class="sales-label" lang="en">TO / BOLTNOTE SALES</span><span class="sales-envelope" aria-hidden="true">↗</span></div>
    <h2>자료 보내실 곳</h2>
    ${address}
    <p class="sales-attach">사용하시는 메일에서 BOM·RFQ·도면·사진을 첨부하거나 메모를 적어 보내 주세요.</p>
    ${home?'<a class="sales-example-link" href="#list" data-go="list">RFQ 이메일 예시 보기 ↗</a>':'<p class="sales-formats">아래 RFQ 예시는 필요한 내용만 바꿔 사용하세요.</p>'}
    ${kakao?`<div class="sales-chat"><span>사진·짧은 문의는</span>${kakao}<small>${esc(CONTACT.kakaoHours||'')}</small></div>`:''}
    <p class="sales-status" id="sales-status" data-sales-status role="status" aria-live="polite"></p>
  </section>`;
}
function salesExampleMarkup() {
  const p=salesMailPackage();
  return `<section class="sales-example" aria-labelledby="sales-example-heading"><div class="sales-example-heading"><div><p class="sales-label" lang="en">RFQ EMAIL / EXAMPLE</p><h2 id="sales-example-heading">RFQ 이메일 예시</h2></div><p>기존 BOM·요청서가 있으면 그대로 첨부하셔도 됩니다.<br>예시의 모든 항목을 채울 필요는 없습니다.</p></div>
    <div class="sales-example-subject"><span>제목</span><code id="sales-example-subject">${esc(p.subject)}</code><button type="button" data-sales-copy="subject">제목 복사</button></div>
    <div class="sales-example-body"><div class="sales-example-tools"><span>본문</span><button type="button" data-sales-copy="body">본문 복사</button><button type="button" data-sales-download>예시 내려받기</button></div><pre id="sales-example-body" tabindex="0" aria-label="RFQ 이메일 본문">${esc(p.body)}</pre></div>
    <p class="sales-example-note">주소·제목·본문을 원하는 메일 서비스에 붙여 넣고 자료를 첨부해 보내 주세요.</p><p class="sales-status" id="sales-example-status" data-sales-status role="status" aria-live="polite"></p>
  </section>`;
}
function salesPage() {
  if (state.listPrefill) {salesDraft.memo=state.listPrefill;state.listPrefill=null;}
  const requirements=purchaseChecklistText();
  return `<section class="sales-page" aria-labelledby="h-z-a"><div class="bn-wrap sales-wrap">
    <div class="sales-hero"><div class="sales-heading"><p class="sales-label" lang="en">SALES / QUOTATION DESK</p>
      <h1 id="h-z-a" tabindex="-1">BOM·메모·RFQ,<br><em>그대로 보내 주세요.</em></h1>
      <p class="sales-lead">기존 목록이나 요청서로 시작하세요.<br>사양 확인부터 공급처 검토와 견적 회신까지<br>볼트노트 Sales가 이어갑니다.</p>
      <p class="sales-short">정해진 양식 없이, 아는 내용만 보내셔도 됩니다.</p>
    </div>${salesContactMarkup()}</div>
    ${salesExampleMarkup()}
    <div class="sales-options">
      <details class="sales-memo" id="sales-memo-details"${salesDraft.memo?' open':''}><summary><span>파일이 없다면, 메모로 문의하세요.</span><span aria-hidden="true">+</span></summary>
        <div class="sales-option-body"><label for="sales-memo">메일에 담을 내용 <span>선택</span></label>
        <textarea id="sales-memo" rows="5" placeholder="필요한 품목과 수량, 사용 조건을 아는 만큼 적어 주세요.\n예: 기존 설비용 스터드 24개가 필요합니다. 규격은 첨부 사진으로 확인 부탁드립니다." aria-describedby="sales-memo-help">${esc(salesDraft.memo)}</textarea>
        <p id="sales-memo-help">적은 내용이 위의 이메일 예시 본문에 반영됩니다. ‘본문 복사’로 사용하시는 메일에 붙여 넣어 주세요.</p>
        <div class="sales-memo-tools"><button type="button" data-sales-copy="body">메일 본문 복사</button><button type="button" data-sales-download>메모 내려받기</button></div>
        <p class="sales-status" id="sales-memo-status" data-sales-status role="status" aria-live="polite"></p>
        <p class="sales-private">새로고침하면 작성 내용이 사라집니다. 먼저 복사하거나 내려받아 주세요.</p>
      </div></details>
      ${requirements?`<details class="sales-requirements"><summary><span>함께 보낼 특수요건 메모</span><span aria-hidden="true">+</span></summary><div class="sales-option-body"><p>작성해 둔 확인 질문은 메일 본문에 함께 담습니다.</p><pre class="purchase-draft">${esc(requirements)}</pre><div class="sales-memo-tools"><button type="button" data-purchase-download>체크리스트 내려받기</button><a href="#lib?path=purchase" data-go="lib?path=purchase">확인 질문 수정 ↗</a></div></div></details>`:''}
      <details class="sales-manual" id="sales-manual-details"><summary><span>직접 품목을 작성하고 싶으신가요? <small>선택</small></span><span aria-hidden="true">+</span></summary><div class="sales-option-body"><p>표를 붙여 넣어 미리 보거나, 제품을 골라 견적함에 담을 수 있습니다.</p><div class="sales-manual-links"><a href="#products" data-go="products">제품에서 고르기 ↗</a><a href="#cart" data-go="cart">담아 둔 견적함 ↗</a></div><div id="sales-manual-body"></div><div id="ia-filep" class="ia-filep-w" hidden></div></div></details>
    </div>
    <section class="sales-next" aria-label="자료를 보내신 뒤 진행"><p class="sales-label">자료를 보내시면</p><ol><li><span>01</span><div><b>자료 확인</b><p>BOM·메모·RFQ를 읽습니다.</p></div></li><li><span>02</span><div><b>사양·공급 조건 검토</b><p>추가 질문과 공급처 확인을 진행합니다.</p></div></li><li><span>03</span><div><b>견적 회신</b><p>확인한 조건과 편차를 정리해 답합니다.</p></div></li></ol><p class="sales-scope">단가·납기·서류 제공 범위는 공급처 확인 뒤 안내합니다. 상담·거래 범위는 <a href="#about" data-go="about">회사 소개</a>에서 확인하실 수 있습니다.</p></section>
  </div></section>`;
}
function salesInit() {
  const memo=$('sales-memo');
  memo.addEventListener('input',()=>{salesDraft.memo=memo.value;$('sales-example-body').textContent=salesMailPackage().body;});
  const manual=$('sales-manual-details');
  manual.addEventListener('toggle',()=>{if(manual.open&&!$('sb')){$('sales-manual-body').innerHTML=sbBox('list');sbInit('list');}});
}
async function salesCopy(text) {
  try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}
  const previous=document.activeElement,ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch{}ta.remove();previous?.focus({preventScroll:true});return ok;
}
function salesMessage(text,source) {const msg=source?.closest('.sales-contact,.sales-example,.sales-option-body')?.querySelector('[data-sales-status]')||$('sales-status');if(msg)msg.textContent=text;}
document.addEventListener('click',async e=>{
  const copy=e.target.closest('[data-sales-copy]'),download=e.target.closest('[data-sales-download]');
  if(copy){const kind=copy.dataset.salesCopy,p=salesMailPackage(),text=kind==='address'?p.to:kind==='subject'?p.subject:p.body;const ok=await salesCopy(text);if(ok&&kind==='body')purchaseMetrics.handoff++;salesMessage(ok?(kind==='address'?'이메일 주소를 복사했습니다. 사용하시는 메일의 받는 사람에 붙여 넣어 주세요.':kind==='subject'?'제목을 복사했습니다. 사용하시는 메일에 붙여 넣어 주세요.':'본문 전체를 복사했습니다. 사용하시는 메일에 붙여 넣어 주세요.'):'복사가 제한됩니다. 표시된 주소·제목·본문을 선택해 직접 복사하거나 예시를 내려받아 주세요.',copy);return;}
  if(download){const p=salesMailPackage(),url=URL.createObjectURL(new Blob([p.body],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=p.subject.match(/Q-[A-Z0-9-]+/)[0]+'-RFQ.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);salesMessage('본문 전체를 내려받았습니다. 사용하시는 메일에 첨부해 주세요.',download);return;}
});
