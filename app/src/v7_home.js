/* Company home. Counts and contact details come from the public catalog.
   The example is a reading guide, never a customer record or supply promise.
   BN_HOME_COPY is also read by site/catalog.py for the no-JavaScript entrance. */
const BN_HOME_COPY = {
  "h1": ["엔지니어가 사양을 읽고,", "체결부품을 구해 드립니다."],
  "lead": "플랜트·정비 볼팅의 BOM·도면을 기계엔지니어 박세중이 한 줄씩 읽고, 공급처 확인 결과를 견적서와 C&D 리스트로 드립니다. 볼트·너트·와셔·특수재가 섞인 목록도, 영문 RFQ도 한 번에 받습니다."
};

function hmCompanyHero() {
  return `<section class="bn-company-hero" aria-labelledby="h-z-a"><div class="bn-wrap">
    <div class="bn-company-hero-grid">
      <div class="bn-company-copy"><p class="bn-kicker" lang="en"><span></span> BOLTNOTE / INDUSTRIAL FASTENERS</p>
        <h1 id="h-z-a" tabindex="-1">${BN_HOME_COPY.h1.map(t=>`<span>${esc(t)}</span>`).join('')}</h1>
        <p class="bn-company-lead">${esc(BN_HOME_COPY.lead)}</p>
        <div class="bn-actions"><a class="bn-btn" href="#list" data-go="list" data-purchase-event="start">BOM·도면 보내기 <span aria-hidden="true">↗</span></a><a class="bn-btn bn-btn-outline" href="/tables/">규격표 보기 <span aria-hidden="true">↗</span></a></div>
        <p class="bn-company-invitation">엑셀·PDF·사진·메일 본문 그대로 보내 주세요. 형식을 맞추실 필요 없습니다.</p>
      </div>
      <figure class="bn-company-visual"><div class="bn-company-image"><img src="media/boltnote-hero.webp" alt="육각볼트, 렌치볼트, 스터드, 너트, 와셔와 핀의 형상 예시" width="1536" height="1024" fetchpriority="high" decoding="async"><span class="bn-visual-index" lang="en">FIG. 01 / THE ESSENTIALS</span></div><figcaption><span lang="en">METRIC &amp; INCH</span><span>참고용 렌더링 · 실제 제품 사진 아님</span></figcaption></figure>
    </div>
    <div class="bn-company-strip"><p>사양을 읽고,<br><strong>공급 조건을 확인합니다.</strong></p><div><b>${CAT_TILES.length}<small>개 제품군</small></b><span>볼트부터 기계 체결부품까지</span></div><div><b>${pmCatN()}<small>종 카탈로그</small></b><span>품목별 규격·치수 안내</span></div><a href="#lib" data-go="lib"><b>규격 사전 <i aria-hidden="true">↗</i></b><span>나사·재질·서류의 확인 기준</span></a></div>
  </div></section>`;
}

function hmCompanyReview() {
  return `<section class="bn-company-review bn-company-section" aria-labelledby="bn-h-review"><div class="bn-wrap bn-company-review-grid">
    <div><p class="bn-kicker" lang="en">01 / ENGINEER TO ENGINEER</p><h2 id="bn-h-review">목록을 보내 주시면,<br>이렇게 읽어 드립니다.</h2><p class="bn-section-description">호칭 하나로 판단하지 않습니다.<br>확인된 조건은 견적서에, 질문과 편차는 C&amp;D 리스트에 따로 적습니다.</p>
      <ol class="bn-proof">${[
        ['사양 읽기','규격·재질·등급·나사를 줄마다 확인하고, 모호한 곳은 질문으로 돌려드립니다.'],
        ['섞인 목록 한 장으로','볼트·너트·와셔·특수재가 섞인 BOM을 그대로 받습니다. 여러 곳에 나눠 문의하지 않으셔도 됩니다.'],
        ['영문 RFQ','영문 BOM·RFQ를 줄마다 읽고, 질문과 편차는 C&D 리스트로 정리합니다.'],
        ['요구 서류 확인','성적서 등 요구 서류는 공급처에 제공 여부를 확인해 견적서에 적습니다.']
      ].map(([t,d],i)=>`<li><span>0${i+1}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></li>`).join('')}</ol><div class="bn-reviewer"><p class="bn-kicker" lang="en">REVIEWED BY</p><b>${iaOwner()} <small>기계엔지니어</small></b><span>회전기기 분야 ${iaYears()}년 · 볼트노트 대표</span><span>견적 사양을 직접 검토합니다.</span><a class="bn-text-link" href="#about" data-go="about">볼트노트 소개 <span aria-hidden="true">↗</span></a></div></div>
    <div class="bn-review-sheet"><div class="bn-review-sheet-head"><span lang="en">SPECIFICATION / REVIEW NOTE</span><span>가상 사양 검토 예시</span></div>
      <p class="bn-review-label">BOM에 적힌 한 줄</p><p class="bn-review-raw"><code>STUD BOLT · 3/4"-10 UNC-2A<br>ASTM A193 B7</code></p>
      <dl class="bn-review-checks"><div><dt><span>01</span> 나사</dt><dd>호칭 · 산 수 · 외나사 공차를 구분합니다.</dd></div><div><dt><span>02</span> 재질·짝 부품</dt><dd>스터드 등급과 짝이 되는 너트 조건을 확인합니다.</dd></div><div><dt><span>03</span> 추가 질문</dt><dd>길이 · 수량 · 표면처리 · 요구 서류를 확인합니다.</dd></div></dl>
      <div class="bn-review-result"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 3v11h15m-6-6 6 6-6 6"/></svg><p><b>확인된 조건은 견적에.<br>질문과 편차는 따로.</b><small>단가·납기·제조사 서류 제공 여부는 공급처 확인 뒤 안내합니다.</small></p></div>
      <p class="bn-review-disclaimer">검토 방식을 설명하는 예시입니다. 실제 고객 자료나 공급 가능 판정이 아닙니다.</p>
    </div>
  </div></section>`;
}

