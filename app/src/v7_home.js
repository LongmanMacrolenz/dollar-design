/* Company home. Counts and contact details come from the public catalog.
   The example is a reading guide, never a customer record or supply promise.
   BN_HOME_COPY is also read by site/catalog.py for the no-JavaScript entrance. */
const BN_HOME_COPY = {
  "h1": ["도면 속 사양을,", "필요한 체결부품으로."],
  "lead": "볼트·너트·스터드와 산업용 체결부품. 기계엔지니어가 규격과 요구 조건을 검토하고, 공급처 확인 결과를 견적으로 안내합니다."
};

function hmCompanyHero() {
  return `<section class="bn-company-hero" aria-labelledby="h-z-a"><div class="bn-wrap">
    <div class="bn-company-hero-grid">
      <div class="bn-company-copy"><p class="bn-kicker" lang="en"><span></span> BOLTNOTE / INDUSTRIAL FASTENERS</p>
        <h1 id="h-z-a" tabindex="-1">${BN_HOME_COPY.h1.map(t=>`<span>${esc(t)}</span>`).join('')}</h1>
        <p class="bn-company-lead">${esc(BN_HOME_COPY.lead)}</p>
        <div class="bn-actions"><a class="bn-btn" href="#list" data-go="list" data-purchase-event="start">견적 문의 <span aria-hidden="true">↗</span></a><a class="bn-btn bn-btn-outline" href="#products" data-go="products">취급 제품 보기 <span aria-hidden="true">↗</span></a></div>
        <p class="bn-company-invitation">기존 BOM·RFQ·사진으로 시작하셔도 됩니다.</p>
      </div>
      <figure class="bn-company-visual"><div class="bn-company-image"><img src="media/boltnote-hero.webp" alt="육각볼트, 렌치볼트, 스터드, 너트, 와셔와 핀의 형상 예시" width="1536" height="1024" fetchpriority="high" decoding="async"><span class="bn-visual-index" lang="en">FIG. 01 / THE ESSENTIALS</span></div><figcaption><span lang="en">METRIC &amp; INCH</span><span>참고용 렌더링 · 실제 제품 사진 아님</span></figcaption></figure>
    </div>
    <div class="bn-company-strip"><p>사양을 읽고,<br><strong>공급 조건을 확인합니다.</strong></p><div><b>${CAT_TILES.length}<small>개 제품군</small></b><span>볼트부터 기계 체결부품까지</span></div><div><b>${pmCatN()}<small>종 카탈로그</small></b><span>품목별 규격·치수 안내</span></div><a href="#lib" data-go="lib"><b>규격 사전 <i aria-hidden="true">↗</i></b><span>나사·재질·서류의 확인 기준</span></a></div>
  </div></section>`;
}

function hmCompanyReview() {
  return `<section class="bn-company-review bn-company-section" aria-labelledby="bn-h-review"><div class="bn-wrap bn-company-review-grid">
    <div><p class="bn-kicker" lang="en">02 / THE ENGINEERING APPROACH</p><h2 id="bn-h-review">같은 이름이어도,<br>사양은 다릅니다.</h2><p class="bn-section-description">호칭 하나로 판단하지 않습니다.<br>도면의 표기와 사용 조건을 함께 읽습니다.</p><a class="bn-text-link" href="#lib?path=purchase" data-go="lib?path=purchase">구매 전 확인할 것 <span aria-hidden="true">↗</span></a></div>
    <div class="bn-review-sheet"><div class="bn-review-sheet-head"><span lang="en">SPECIFICATION / REVIEW NOTE</span><span>가상 사양 검토 예시</span></div>
      <p class="bn-review-label">BOM에 적힌 한 줄</p><p class="bn-review-raw"><code>STUD BOLT · 3/4"-10 UNC-2A<br>ASTM A193 B7</code></p>
      <dl class="bn-review-checks"><div><dt><span>01</span> 나사</dt><dd>호칭 · 산 수 · 외나사 공차를 구분합니다.</dd></div><div><dt><span>02</span> 재질·짝 부품</dt><dd>스터드 등급과 짝이 되는 너트 조건을 확인합니다.</dd></div><div><dt><span>03</span> 추가 질문</dt><dd>길이 · 수량 · 표면처리 · 요구 서류를 확인합니다.</dd></div></dl>
      <div class="bn-review-result"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 3v11h15m-6-6 6 6-6 6"/></svg><p><b>확인된 조건은 견적에.<br>질문과 편차는 따로.</b><small>단가·납기·제조사 서류 제공 여부는 공급처 확인 뒤 안내합니다.</small></p></div>
      <p class="bn-review-disclaimer">검토 방식을 설명하는 예시입니다. 실제 고객 자료나 공급 가능 판정이 아닙니다.</p>
    </div>
  </div></section>`;
}

function hmCompanyExpertise() {
  return `<section class="bn-company-expertise bn-company-section" aria-labelledby="bn-h-expertise"><div class="bn-wrap">
    <div class="bn-company-section-head"><div><p class="bn-kicker" lang="en">03 / ENGINEER TO ENGINEER</p><h2 id="bn-h-expertise">작은 것이,<br>전부를 붙잡습니다.</h2></div><div class="bn-expertise-intro"><p>볼트노트는 기계엔지니어가 운영하는<br>체결부품 견적·공급 사업자입니다.</p><p>회전기기 분야 ${iaYears()}년의 경험으로,<br>대표 ${iaOwner()}이 견적 사양을 직접 검토합니다.</p><a class="bn-text-link" href="#about" data-go="about">볼트노트 소개 <span aria-hidden="true">↗</span></a></div></div>
    <div class="bn-company-principles">${[
      ['01','사양을 먼저 확인합니다.','나사 계열, 재질·등급, 길이 기준과 표면처리를 함께 검토합니다.'],
      ['02','차이를 기록합니다.','요청과 공급 제안이 다르면 차이와 확인 질문을 구분합니다. 대체품은 고객 승인 후 진행합니다.'],
      ['03','확인한 범위를 적습니다.','공급 조건과 제조사 서류 제공 범위를 확인하고, 미확인 사항은 견적에서 구분합니다.']
    ].map(([n,t,d])=>`<article><span>${n}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
    <div class="bn-company-resources"><a href="#lib" data-go="lib"><span lang="en">ENGINEERING NOTES</span><b>규격을 이해하는 자료</b><span>나사 · 재질 · 표면처리 · 품질문서 <i aria-hidden="true">↗</i></span></a><a href="#ref" data-go="ref"><span lang="en">DRAWINGS &amp; CAD</span><b>형상과 치수를 보는 자료</b><span>제공 품목의 도면 · STEP · DXF <i aria-hidden="true">↗</i></span></a></div>
    ${bnEngineeringMarkup()}
    <nav class="bn-home-links" aria-label="추가 문의·도구"><a href="#tools" data-go="tools">계산·대조 도구 ↗</a><a href="#materials" data-go="materials">소재 문의 ↗</a></nav>
  </div></section>`;
}
