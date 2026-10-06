/* Sales handoff: existing customer files go through the customer's email app.
   Free text stays in memory; opening a draft is never a receipt confirmation. */
const salesDraft = { number:'', memo:'' };
function salesMailPackage(withMemo=true) {
  if (!salesDraft.number) salesDraft.number=rfqNo('Q');
  const subject=`[RFQ] ${salesDraft.number} 체결부품 견적 문의`;
  const memo=withMemo?salesDraft.memo:'';
  const requirements=withMemo?purchaseChecklistText():'';
  const body=[
    '볼트노트 Sales 담당자님께',`요청번호: ${salesDraft.number}`,
    memo.trim()?memo:'BOM·RFQ·도면 등 견적 자료를 첨부합니다.',
    requirements,
  ].filter(Boolean).join('\n\n');
  const to=String(CONTACT.rfq||'').trim();
  const base=`mailto:${to}?subject=${encodeURIComponent(subject)}`;
  const full=base+'&body='+encodeURIComponent(body.replace(/\r?\n/g,'\r\n').toWellFormed());
  const needsCopy=full.length>RFQ_URL_MAX;
  return {subject,body,needsCopy,url:rfqOk('rfq')?(needsCopy?base:full):null};
}
function salesContactMarkup(home=false) {
  const pkg=salesMailPackage(!home),id=home?'sales-home-mail':'sales-mail';
  const mail=pkg.url?`<a class="sales-primary" id="${id}" data-sales-open${home?' data-sales-home':''} href="${esc(pkg.url)}" target="_blank" rel="noopener noreferrer">이메일로 자료 보내기 <span aria-hidden="true">↗</span></a>`:'<p class="sales-unset">견적 이메일 확인 후 상담을 연결합니다.</p>';
  const kakao=rfqOk('kakaoChat')?`<a href="${esc(CONTACT.kakaoChat)}" target="_blank" rel="noopener noreferrer">카카오톡으로 문의 <span aria-hidden="true">↗</span></a>`:'';
  return `<section class="sales-contact" aria-label="Sales 이메일 상담">
    <div class="sales-card-top"><span class="sales-label" lang="en">TO / BOLTNOTE SALES</span><span class="sales-envelope" aria-hidden="true">↗</span></div>
    <h2>가지고 계신 자료 그대로.</h2>
    <p class="sales-formats">BOM · RFQ · 도면 · 사진 · 메모</p>
    ${mail}
    <p class="sales-attach">메일을 열고 기존 파일을 첨부해 보내 주세요.</p>
    <div class="sales-address"><span>${rfqC('rfq')}</span>${rfqOk('rfq')?'<button type="button" data-sales-copy="address" aria-label="Sales 이메일 주소 복사">주소 복사</button>':''}</div>
    ${kakao?`<div class="sales-chat"><span>사진·짧은 문의는</span>${kakao}<small>${esc(CONTACT.kakaoHours||'')}</small></div>`:''}
    <p class="sales-status" id="sales-status" role="status" aria-live="polite"></p>
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
    <div class="sales-options">
      <details class="sales-memo" id="sales-memo-details"${salesDraft.memo?' open':''}><summary><span>파일이 없다면, 메모로 문의하세요.</span><span aria-hidden="true">+</span></summary>
        <div class="sales-option-body"><label for="sales-memo">메일에 담을 내용 <span>선택</span></label>
        <textarea id="sales-memo" rows="5" placeholder="필요한 품목과 수량, 사용 조건을 아는 만큼 적어 주세요.\n예: 기존 설비용 스터드 24개가 필요합니다. 규격은 첨부 사진으로 확인 부탁드립니다." aria-describedby="sales-memo-help">${esc(salesDraft.memo)}</textarea>
        <p id="sales-memo-help">메모를 적은 뒤 위의 ‘이메일로 자료 보내기’를 누르세요. ${salesMailPackage().needsCopy?'긴 본문은 전체를 복사한 뒤 메일에 붙여 넣습니다.':'메모가 메일 본문에 들어갑니다.'}</p>
        <div class="sales-memo-tools"><button type="button" data-sales-copy="body">메일 본문 복사</button><button type="button" data-sales-download>메모 내려받기</button></div>
        <p class="sales-private">작성 내용은 이 페이지의 메모리에만 남습니다. 새로고침 전에 보내거나 내려받아 주세요.</p>
      </div></details>
      ${requirements?`<details class="sales-requirements"><summary><span>함께 보낼 특수요건 메모</span><span aria-hidden="true">+</span></summary><div class="sales-option-body"><p>작성해 둔 확인 질문은 메일 본문에 함께 담습니다.</p><pre class="purchase-draft">${esc(requirements)}</pre><div class="sales-memo-tools"><button type="button" data-purchase-download>체크리스트 내려받기</button><a href="#lib?path=purchase" data-go="lib?path=purchase">확인 질문 수정 ↗</a></div></div></details>`:''}
      <details class="sales-manual" id="sales-manual-details"><summary><span>직접 품목을 작성하고 싶으신가요? <small>선택</small></span><span aria-hidden="true">+</span></summary><div class="sales-option-body"><p>표를 붙여 넣어 미리 보거나, 제품을 골라 견적함에 담을 수 있습니다.</p><div class="sales-manual-links"><a href="#products" data-go="products">제품에서 고르기 ↗</a><a href="#cart" data-go="cart">담아 둔 견적함 ↗</a></div><div id="sales-manual-body"></div><div id="ia-filep" class="ia-filep-w" hidden></div></div></details>
    </div>
    <section class="sales-next" aria-label="자료를 보내신 뒤 진행"><p class="sales-label">자료를 보내시면</p><ol><li><span>01</span><div><b>자료 확인</b><p>BOM·메모·RFQ를 읽습니다.</p></div></li><li><span>02</span><div><b>사양·공급 조건 검토</b><p>추가 질문과 공급처 확인을 진행합니다.</p></div></li><li><span>03</span><div><b>견적 회신</b><p>확인한 조건과 편차를 정리해 답합니다.</p></div></li></ol><p class="sales-scope">단가·납기·서류 제공 범위는 공급처 확인 뒤 안내합니다. 상담·거래 범위는 <a href="#about" data-go="about">회사 소개</a>에서 확인하실 수 있습니다.</p></section>
  </div></section>`;
}
function salesInit() {
  const memo=$('sales-memo');
  memo.addEventListener('input',()=>{salesDraft.memo=memo.value;const p=salesMailPackage(),a=$('sales-mail');if(a&&p.url)a.href=p.url;$('sales-memo-help').textContent=p.needsCopy?'긴 메모는 전체를 복사한 뒤 메일에 붙여 넣습니다. 위의 ‘이메일로 자료 보내기’를 누르세요.':'메모가 메일 본문에 들어갑니다. 위의 ‘이메일로 자료 보내기’를 누르세요.';});
  const manual=$('sales-manual-details');
  manual.addEventListener('toggle',()=>{if(manual.open&&!$('sb')){$('sales-manual-body').innerHTML=sbBox('list');sbInit('list');}});
}
async function salesCopy(text) {
  try {if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{}
  const previous=document.activeElement,ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(ta);ta.select();let ok=false;try{ok=document.execCommand('copy');}catch{}ta.remove();previous?.focus({preventScroll:true});return ok;
}
function salesMessage(text) {const msg=$('sales-status');if(msg)msg.textContent=text;}
document.addEventListener('click',async e=>{
  const copy=e.target.closest('[data-sales-copy]'),download=e.target.closest('[data-sales-download]'),mail=e.target.closest('[data-sales-open]');
  if(copy){const address=copy.dataset.salesCopy==='address',text=address?String(CONTACT.rfq).trim():salesMailPackage().body;const ok=await salesCopy(text);salesMessage(ok?(address?'이메일 주소를 복사했습니다.':'본문 전체를 복사했습니다. 메일에 붙여 넣어 주세요.'):'복사가 제한됩니다. 이메일 주소나 메모를 선택해 직접 복사해 주세요.');return;}
  if(download){const p=salesMailPackage(),url=URL.createObjectURL(new Blob([p.body],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=p.subject.match(/Q-[A-Z0-9-]+/)[0]+'-RFQ.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);salesMessage('메모 전체를 내려받았습니다. 메일에 첨부해 주세요.');return;}
  if(!mail||e.defaultPrevented||e.button!==0)return;
  const p=salesMailPackage(!mail.hasAttribute('data-sales-home'));
  if(!p.url){e.preventDefault();return;}
  if(p.needsCopy){const ok=await salesCopy(p.body);salesMessage(ok?'긴 본문 전체를 복사했습니다. 열린 메일에 붙여 넣고 파일을 첨부해 주세요.':'긴 메모는 본문을 복사하거나 내려받아 메일에 첨부해 주세요.');purchaseMetrics.handoff++;}
  else {purchaseMetrics.handoff++;salesMessage('메일을 열고 자료를 첨부해 주세요. 실제 발송은 메일에서 완료합니다.');}
});
