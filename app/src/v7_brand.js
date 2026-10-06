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
function bnBrandMarkup() {
  return `<section class="bn-hero bn-cinema bn-brand-hero" aria-labelledby="h-z-a">
    <div class="bn-wrap bn-brand-layout">
      <div class="bn-brand-copy">
        <p class="bn-brand-eyebrow" lang="en">BOLTNOTE / ENGINEERING SOURCING</p>
        <h1 id="h-z-a" tabindex="-1">체결부품 조달,<br><em>BOM부터 정확하게.</em></h1>
        <p class="bn-brand-lead">볼트노트는 사양·특수요건을 검토하고<br>공급처 확인 결과를 견적으로 연결합니다.</p>
        <div class="bn-actions"><a class="bn-btn" href="#list" data-go="list" data-purchase-event="start">BOM 견적 요청 <span aria-hidden="true">↗</span></a><a class="bn-btn bn-btn-outline" href="#lib?path=purchase" data-go="lib?path=purchase">특수요건 확인 <span aria-hidden="true">↗</span></a></div>
        <p class="bn-brand-scope" lang="en">METRIC &amp; INCH <span>·</span> INDUSTRIAL FASTENERS</p>
      </div>
      <figure class="bn-brand-film">
        <div class="bn-brand-stage">
          <video id="bn-brand-video" width="960" height="600" autoplay muted loop playsinline preload="none" poster="media/boltnote-sourcing-poster.webp" aria-label="스터드·헤비너트의 도면과 입체, 외부·내부 나사 확대, UNC·UNF 후보 대조로 이어지는 볼트노트 조달 소개">
            <source data-src="media/boltnote-sourcing-mobile.mp4" media="(max-width: 700px)" type="video/mp4">
            <source data-src="media/boltnote-sourcing.mp4" media="(min-width: 701px)" type="video/mp4">
          </video>
          <div class="bn-sourcing-drawing" aria-hidden="true">${bnSourcingDrawing('bn-brand-draft')}</div>
          <div class="bn-sourcing-tags" aria-hidden="true"><span data-bn-part="0">UNC · 10 TPI</span><span data-bn-part="1">헤비너트</span><span data-bn-part="2">UNF · 16 TPI</span></div>
          <span class="bn-brand-video-label" lang="en">FROM BOM TO QUOTATION</span>
        </div>
        <figcaption class="bn-brand-caption" aria-live="off"><ol class="bn-brand-story">${BN_BRAND_STORY.map((s,i)=>`<li data-bn-story="${i}" ${i ? 'aria-hidden="true"' : 'data-active="true" aria-hidden="false"'}><span class="bn-brand-count" aria-hidden="true">0${i+1} / 04</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join('')}</ol>
          <div class="bn-sourcing-proof">${BN_SOURCING_PROOF.map((html,i)=>`<div data-bn-proof="${i}" ${i===0?'data-active="true"':'aria-hidden="true"'}>${html}</div>`).join('')}</div>
          <ol class="bn-brand-progress" aria-label="볼트노트의 조달 절차">${BN_BRAND_STORY.map((s,i)=>`<li data-bn-progress="${i}" ${i===0?'data-active="true"':''}><span>${s.label}</span><i aria-hidden="true"></i></li>`).join('')}</ol>
          <div class="bn-brand-foot"><span>형상·사양 검토 예시</span><button type="button" id="bn-brand-pause" aria-controls="bn-brand-video" aria-label="회사 소개 일시정지"><span aria-hidden="true">Ⅱ</span><span>소개 일시정지</span></button></div>
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
  let desired = !motion.matches && !connection?.saveData;
  let visible = false, attached = false, frame = null;
  video.muted = true; video.defaultMuted = true;
  // Do not start an unsolicited download for a reduced-motion/data-saving user.
  video.autoplay = desired;
  const update = decodedTime => {
    const time = typeof decodedTime==='number' ? decodedTime : video.currentTime || 0, scene = Math.min(3, Math.floor(time / 4));
    root.dataset.story = String(scene);
    proofs.forEach((item,i)=>{item.dataset.active=String(i===scene);item.setAttribute('aria-hidden',String(i!==scene));});
    const fade=Math.max(0,Math.min(1,(time-.8)/1.3));
    const opacity=(desired||video.readyState>=2)?1-fade*fade*(3-2*fade):0;
    root.style.setProperty('--bn-draft-opacity',String(opacity));root.dataset.drawing=String(opacity>.25);
    if(typeof BN_SOURCING_TRACK!=='undefined') {
      const at=Math.min(BN_SOURCING_TRACK.length-2,Math.floor(time*4));
      const left=BN_SOURCING_TRACK[at],right=BN_SOURCING_TRACK[at+1],q=Math.min(1,Math.max(0,(time-left[0])/(right[0]-left[0])));
      tags.forEach((tag,i)=>{
        const x=left[1+i*2]+(right[1+i*2]-left[1+i*2])*q,y=left[2+i*2]+(right[2+i*2]-left[2+i*2])*q;
        tag.style.left=`${x*100}%`;tag.style.top=`${y*100}%`;
        tag.dataset.active=String(time>2.2 && x>.1 && x<.9 && y>.2 && y<.9 && ((i===1&&scene===1)||(i!==1&&scene===2)));
      });
    }
    stories.forEach((item,i)=>{
      item.dataset.active=String(i===scene);
      item.setAttribute('aria-hidden',String(i!==scene));
    });
    progress.forEach((item,i)=>{
      item.dataset.active=String(i===scene);
      item.style.setProperty('--bn-brand-progress',`${Math.max(0,Math.min(1,(time-i*4)/4))*100}%`);
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
