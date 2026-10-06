/* A company introduction, started on arrival. Copy follows the decoded video
   rather than a separate timer; pausing stops both the images and the story. */
const BN_BRAND_STORY = [
  {title:'BOM 한 줄을, 구매 사양으로.', text:'나사 · 재질 · 길이 · 수량을 구분해 읽습니다.', label:'BOM 검토'},
  {title:'짝 부품과 사용 조건까지.', text:'너트 등급 · 도금 후 나사 맞춤 · 요구 서류를 함께 확인합니다.', label:'특수요건'},
  {title:'회신을 사양과 대조합니다.', text:'같은 호칭도 나사 계열이 다르면 편차로 구분합니다.', label:'공급 확인'},
  {title:'견적과 C&D로 답합니다.', text:'확인된 공급 조건과 질문 · 편차 · 제외 사유를 구분합니다.', label:'견적 · C&D'}
];
const BN_SOURCING_PROOF = [
  '<span>요청 사양 예시</span><div><code>3/4″–10 UNC–2A</code><b>ASTM A193 B7</b></div>',
  '<span>추가 확인 항목</span><div><b>너트 등급</b><b>표면처리</b><b>요구 서류</b></div>',
  '<span>나사 계열 대조 예시</span><div><code>UNC 요청</code><i aria-hidden="true">↔</i><code>UNF 후보</code><b class="bn-proof-deviation">불일치</b></div>',
  '<span>결과물 구성</span><div><b>견적 / 확인된 조건</b><b>C&D / 질문 · 편차</b></div>'
];
const BN_SOURCING_KICKER = ['01 / SPECIFICATION','02 / MATING PARTS','03 / THREAD SERIES','04 / QUOTE & C&D'];
function bnSourcingDocuments() {
  return `<svg viewBox="0 0 640 400" role="img" aria-label="확인된 조건을 적는 견적과 질문·편차를 구분하는 C&D의 구성 예시">
    <defs><filter id="bn-doc-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#20372b" flood-opacity=".15"/></filter></defs>
    <g class="bn-result-quote" filter="url(#bn-doc-shadow)"><rect x="42" y="64" width="270" height="203" rx="7" fill="#fbfcf8"/>
      <path d="M62 109H292M62 156H292M62 195H292" stroke="#d4ded4" stroke-width="1"/>
      <text x="62" y="94" fill="#20382a" font-size="25" font-weight="700">견적</text><text x="235" y="93" fill="#758c7d" font-size="13">QUOTE</text>
      <g fill="#344d3b" font-size="18"><text x="62" y="140">사양 · 수량</text><text x="62" y="181">단가 · 납기</text><text x="62" y="220">제공 서류</text></g>
      <g fill="none" stroke="#5f846b" stroke-width="2"><path d="M272 131l5 5 10-10M272 172l5 5 10-10M272 211l5 5 10-10"/></g>
      <text x="62" y="249" fill="#6b8172" font-size="13">확인된 공급 조건을 기록합니다.</text>
    </g>
    <g class="bn-result-cd" filter="url(#bn-doc-shadow)"><rect x="328" y="78" width="270" height="203" rx="7" fill="#fbfcf8"/>
      <path d="M348 123H578M348 200H578" stroke="#d4ded4" stroke-width="1"/>
      <text x="348" y="108" fill="#20382a" font-size="25" font-weight="700">C&amp;D</text><text x="504" y="107" fill="#758c7d" font-size="13">REVIEW</text>
      <text x="348" y="151" fill="#344d3b" font-size="18">UNC 요청 / UNF 후보</text>
      <rect x="348" y="162" width="124" height="25" rx="3" fill="#fff0df"/><text x="357" y="180" fill="#9e552b" font-size="15">나사 계열 편차</text>
      <text x="348" y="227" fill="#344d3b" font-size="18">너트 등급 · 추가 질문</text>
      <text x="348" y="262" fill="#6b8172" font-size="13">질문과 편차를 구분합니다.</text>
    </g>
  </svg>`;
}
function bnBrandMarkup() {
  return `<section class="bn-hero bn-cinema bn-brand-hero" aria-labelledby="h-z-a">
    <div class="bn-wrap bn-brand-layout">
      <div class="bn-brand-copy">
        <p class="bn-brand-eyebrow" lang="en">BOLTNOTE / ENGINEERING SOURCING</p>
        <h1 id="h-z-a" tabindex="-1">체결부품 조달,<br><em>BOM부터 정확하게.</em></h1>
        <p class="bn-brand-lead">볼트노트는 사양·특수요건을 검토하고<br>공급처 확인 결과를 견적으로 연결합니다.</p>
        <div class="bn-actions"><a class="bn-btn" href="${esc(salesMailPackage(false).url||'#list')}" ${rfqOk('rfq')?'data-sales-open data-sales-home target="_blank" rel="noopener noreferrer"':'data-go="list"'} data-purchase-event="start">Sales에 보내기 <span aria-hidden="true">↗</span></a><a class="bn-btn bn-btn-outline" href="#lib?path=purchase" data-go="lib?path=purchase">특수요건 확인 <span aria-hidden="true">↗</span></a></div>
        <p class="bn-brand-scope" lang="en">METRIC &amp; INCH <span>·</span> INDUSTRIAL FASTENERS</p>
      </div>
      <figure class="bn-brand-film">
        <div class="bn-brand-stage">
          <video id="bn-brand-video" width="1200" height="750" autoplay muted loop playsinline preload="none" poster="media/boltnote-sourcing-v2-poster.webp" aria-label="스터드 도면과 입체, 헤비너트 내부 나사의 단면, 같은 지름의 UNC·UNF 피치 비교, 견적과 C&D로 이어지는 볼트노트 조달 소개">
            <source data-src="media/boltnote-sourcing-v2-mobile.mp4" media="(max-width: 700px)" type="video/mp4">
            <source data-src="media/boltnote-sourcing-v2.mp4" media="(min-width: 701px)" type="video/mp4">
          </video>
          <div class="bn-sourcing-drawing" aria-hidden="true">${bnSourcingDrawing('bn-brand-draft')}</div>
          <div class="bn-sourcing-tags" aria-hidden="true"><span data-bn-part="0">UNC · 10 TPI</span><span data-bn-part="1">헤비너트</span><span data-bn-part="2">UNF · 16 TPI</span></div>
          <svg class="bn-sourcing-rulers" viewBox="0 0 640 400" aria-hidden="true">${[10,16].map((n,i)=>`<g data-bn-ruler="${i}"><path class="bn-ruler-line"/><g class="bn-ruler-ticks">${Array.from({length:n+1},()=>'<path/>').join('')}</g><text text-anchor="middle">1″ 구간</text></g>`).join('')}</svg>
          <div class="bn-sourcing-documents" aria-hidden="true">${bnSourcingDocuments()}</div>
          <span class="bn-brand-video-label" lang="en">${BN_SOURCING_KICKER[0]}</span>
          <span class="bn-stage-note" aria-hidden="true"></span>
        </div>
        <figcaption class="bn-brand-caption" aria-live="off"><ol class="bn-brand-story">${BN_BRAND_STORY.map((s,i)=>`<li data-bn-story="${i}" ${i ? 'aria-hidden="true"' : 'data-active="true" aria-hidden="false"'}><span class="bn-brand-count" aria-hidden="true">0${i+1} / 04</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join('')}</ol>
          <div class="bn-sourcing-proof">${BN_SOURCING_PROOF.map((html,i)=>`<div data-bn-proof="${i}" ${i===0?'data-active="true"':'aria-hidden="true"'}>${html}</div>`).join('')}</div>
          <ol class="bn-brand-progress" aria-label="볼트노트의 조달 절차">${BN_BRAND_STORY.map((s,i)=>`<li data-bn-progress="${i}" ${i===0?'data-active="true"':''}><span>${s.label}</span><i aria-hidden="true"></i></li>`).join('')}</ol>
          <div class="bn-brand-foot"><span>형상 · 검토 · 견적 구성 예시</span><button type="button" id="bn-brand-pause" aria-controls="bn-brand-video" aria-label="회사 소개 일시정지"><span aria-hidden="true">Ⅱ</span><span>소개 일시정지</span></button></div>
        </figcaption>
      </figure>
    </div>
  </section>`;
}
function bnEngineeringMarkup() {
  return `<div class="bn-wrap bn-engineering-wrap"><details class="bn-engineering" id="bn-engineering-details"><summary><span>더 깊이 보는 체결부품</span><small>공차 · 헤비너트 · 재료 · 표면처리</small><i aria-hidden="true">+</i></summary><div class="bn-engineering-body">${bnFilmMarkup()}${bnFilmNavigation()}</div></details></div>`;
}
let bnBrandCleanup = null;
function bnBrandInit() {
  bnBrandCleanup?.();
  const root = view().querySelector('.bn-brand-hero');
  if (!root) return;
  const video = root.querySelector('#bn-brand-video');
  const toggle = root.querySelector('#bn-brand-pause');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = navigator.connection;
  const abort = new AbortController(), options = {signal:abort.signal};
  const stories = [...root.querySelectorAll('[data-bn-story]')];
  const progress = [...root.querySelectorAll('[data-bn-progress]')];
  const proofs = [...root.querySelectorAll('[data-bn-proof]')];
  const tags = [...root.querySelectorAll('[data-bn-part]')];
  const rulers=[...root.querySelectorAll('[data-bn-ruler]')].map(element=>({
    line:element.querySelector('.bn-ruler-line'),label:element.querySelector('text'),
    ticks:[...element.querySelectorAll('.bn-ruler-ticks path')],position:null
  }));
  const kicker=root.querySelector('.bn-brand-video-label'), stageNote=root.querySelector('.bn-stage-note');
  let desired = !motion.matches && !connection?.saveData;
  let visible = false, attached = false, frame = null;
  video.muted = true; video.defaultMuted = true;
  // Do not start an unsolicited download for a reduced-motion/data-saving user.
  video.autoplay = desired;
  const writeStyle=(element,name,value)=>{if(element.style.getPropertyValue(name)!==value) element.style.setProperty(name,value);};
  const writeState=(element,name,value)=>{if(element.dataset[name]!==value) element.dataset[name]=value;};
  const update = decodedTime => {
    const time = typeof decodedTime==='number' ? decodedTime : video.currentTime || 0, scene = Math.min(3, Math.floor(time / 4));
    // Static copy changes once per chapter, not 24 times per second on mobile.
    if(root.dataset.story!==String(scene)) {
      root.dataset.story=String(scene);
      [proofs,stories].forEach(items=>items.forEach((item,i)=>{item.dataset.active=String(i===scene);item.setAttribute('aria-hidden',String(i!==scene));}));
      progress.forEach((item,i)=>{item.dataset.active=String(i===scene);});
      kicker.textContent=BN_SOURCING_KICKER[scene];
      stageNote.textContent=scene===1?'내부 나사 · 단면 형상 예시':scene===2?'같은 지름, 다른 피치 · 1″ 구간 비교':'';
      stageNote.dataset.active=String(scene===1 || scene===2);
    }
    const smooth=(start,end)=>{const q=Math.max(0,Math.min(1,(time-start)/(end-start)));return q*q*(3-2*q);};
    const opacity=(desired||video.readyState>=2)?Math.max(1-smooth(.65,2),smooth(15.45,16)):0;
    writeStyle(root,'--bn-draft-opacity',String(opacity));writeState(root,'drawing',String(opacity>.25));
    const resultOpacity=smooth(12.1,12.65)*(1-smooth(15.15,15.65));
    writeStyle(root,'--bn-results-opacity',String(resultOpacity));
    const showRulers=scene===2 && time>8.3 && time<11.85;
    writeState(root,'rulers',String(showRulers));
    if(typeof BN_SOURCING_TRACK!=='undefined' && (scene===1 || scene===2)) {
      const at=Math.min(BN_SOURCING_TRACK.length-2,Math.floor(time*24));
      const left=BN_SOURCING_TRACK[at],right=BN_SOURCING_TRACK[at+1],q=Math.min(1,Math.max(0,(time-left[0])/(right[0]-left[0])));
      const point=index=>({x:(left[1+index*2]+(right[1+index*2]-left[1+index*2])*q)*640,y:(left[2+index*2]+(right[2+index*2]-left[2+index*2])*q)*400});
      tags.forEach((tag,i)=>{
        if(!((i===1&&scene===1&&time>4.3)||(i!==1&&scene===2&&time>8.3))) {writeState(tag,'active','false');return;}
        const p=point(i),x=p.x/640,y=p.y/400;
        writeStyle(tag,'left',`${x*100}%`);writeStyle(tag,'top',`${y*100}%`);
        writeState(tag,'active',String(x>.1 && x<.9 && y>.2 && y<.9));
      });
      if(showRulers) rulers.forEach((ruler,i)=>{
        const p=point(3+i*2),r=point(4+i*2),offset=45;
        const position=[p.x,p.y,r.x,r.y].map(v=>v.toFixed(2)).join(',');
        if(position===ruler.position) return;
        ruler.position=position;
        ruler.line.setAttribute('d',`M${p.x} ${p.y+18}V${p.y+offset}L${r.x} ${r.y+offset}V${r.y+18}`);
        const count=ruler.ticks.length-1;
        ruler.ticks.forEach((tick,j)=>{const x=p.x+(r.x-p.x)*j/count,y=p.y+(r.y-p.y)*j/count+offset;tick.setAttribute('d',`M${x} ${y-4}v8`);});
        ruler.label.setAttribute('x',String((p.x+r.x)/2));ruler.label.setAttribute('y',String((p.y+r.y)/2+offset+19));ruler.label.textContent=`1″ · ${count} TPI`;
      });
    } else tags.forEach(tag=>writeState(tag,'active','false'));
    progress.forEach((item,i)=>{
      writeStyle(item,'--bn-brand-progress',`${Math.max(0,Math.min(1,(time-i*4)/4))*100}%`);
    });
  };
  const updateToggle = () => {
    const label=desired?'소개 일시정지':'소개 계속 보기';
    toggle.setAttribute('aria-label',`회사 ${label}`);
    toggle.innerHTML=`<span aria-hidden="true">${desired?'Ⅱ':'↻'}</span><span>${label}</span>`;
    root.dataset.playing=String(!video.paused);
  };
  const pause = () => {
    video.pause();
    if(frame!==null) {video.cancelVideoFrameCallback?.(frame);frame=null;}
    updateToggle();
  };
  const play = () => {
    if(!desired || !visible || document.hidden || abort.signal.aborted) return;
    if(!attached) {
      attached=true;
      // Assign only the chosen size: no desktop download on mobile.
      const source=[...video.querySelectorAll('source')].find(s=>matchMedia(s.media).matches);
      source.src=source.dataset.src;
      video.preload='auto';video.load();
    }
    video.play()?.catch(error=>{
      if(error.name==='AbortError' || abort.signal.aborted) return;
      desired=false;video.autoplay=false;update();updateToggle();
      // The poster and complete company message remain visible if autoplay is blocked.
    });
  };
  const onFrame = (_now,metadata) => {
    if(abort.signal.aborted || video.paused) return;
    update(metadata.mediaTime);frame=video.requestVideoFrameCallback(onFrame);
  };
  video.addEventListener('play',()=>{
    if(!desired || !visible || document.hidden) {pause();return;}
    updateToggle();
    if(video.requestVideoFrameCallback) {
      if(frame!==null) video.cancelVideoFrameCallback(frame);
      frame=video.requestVideoFrameCallback(onFrame);
    }
  },options);
  video.addEventListener('pause',updateToggle,options);
  // Use one clock while frames are decoded. Mixing currentTime with mediaTime
  // can briefly jump back a chapter at a cut or the end-to-start loop boundary.
  video.addEventListener('timeupdate',()=>{if(!video.requestVideoFrameCallback) update();},options);
  video.addEventListener('seeked',()=>{if(!video.requestVideoFrameCallback || video.paused) update();},options);
  video.addEventListener('error',()=>{desired=false;video.autoplay=false;update();updateToggle();},options);
  toggle.addEventListener('click',()=>{
    desired=!desired;video.autoplay=false;
    if(desired) play();else pause();
    updateToggle();
  },options);
  const honorPreference = () => {
    if(motion.matches || connection?.saveData) {desired=false;video.autoplay=false;pause();}
  };
  motion.addEventListener('change',honorPreference,options);
  connection?.addEventListener('change',honorPreference,options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden) pause();else play();},options);
  // Opening the detailed viewer stops the introduction; two videos never compete.
  const engineering=view().querySelector('#bn-engineering-details');
  engineering?.addEventListener('toggle',()=>{
    if(engineering.open) {desired=false;video.autoplay=false;pause();}
  },options);
  const observer=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(visible) play();else pause();
  },{threshold:.08});
  observer.observe(video);
  const cleanup=()=>{
    abort.abort();observer.disconnect();removed.disconnect();pause();
    video.autoplay=false;video.querySelectorAll('source').forEach(s=>s.removeAttribute('src'));video.load();
    if(bnBrandCleanup===cleanup) bnBrandCleanup=null;
  };
  const removed=new MutationObserver(()=>{if(!root.isConnected) cleanup();});
  removed.observe(view().parentNode,{childList:true});
  bnBrandCleanup=cleanup;
  update();updateToggle();
}
