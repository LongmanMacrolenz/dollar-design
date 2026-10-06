/* A company introduction, started on arrival. Copy follows the decoded video
   rather than a separate timer; pausing stops both the images and the story. */
const BN_BRAND_STORY = [
  {title:'BOM을 읽고.', text:'나사 · 재질 · 등급 · 표면처리. 구매 사양부터 확인합니다.', label:'BOM 검토'},
  {title:'특수요건을 짚고.', text:'사용 조건과 요구 서류, 빠진 사양을 함께 확인합니다.', label:'특수요건'},
  {title:'공급처에 확인하고.', text:'사양 · 수량 · 납기 · 서류의 제공 가능 여부를 확인합니다.', label:'공급 확인'},
  {title:'견적에 정확히 담습니다.', text:'확인된 조건과 미확인 사항 · 편차를 견적과 C&D로 구분합니다.', label:'견적 · C&D'}
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
          <video id="bn-brand-video" width="1200" height="900" autoplay muted loop playsinline preload="none" poster="media/boltnote-brand-poster.webp" aria-label="볼트노트 회사 소개: 체결부품 사양 검토에서 공급처 확인과 견적까지">
            <source data-src="media/boltnote-brand-mobile.mp4" media="(max-width: 700px)" type="video/mp4">
            <source data-src="media/boltnote-brand.mp4" media="(min-width: 701px)" type="video/mp4">
          </video>
          <span class="bn-brand-video-label" lang="en">FROM BOM TO QUOTATION</span>
        </div>
        <figcaption class="bn-brand-caption" aria-live="off"><ol class="bn-brand-story">${BN_BRAND_STORY.map((s,i)=>`<li data-bn-story="${i}" ${i ? 'aria-hidden="true"' : 'data-active="true" aria-hidden="false"'}><span class="bn-brand-count" aria-hidden="true">0${i+1} / 04</span><div><strong>${s.title}</strong><p>${s.text}</p></div></li>`).join('')}</ol>
          <ol class="bn-brand-progress" aria-label="볼트노트의 조달 절차">${BN_BRAND_STORY.map((s,i)=>`<li data-bn-progress="${i}" ${i===0?'data-active="true"':''}><span>${s.label}</span><i aria-hidden="true"></i></li>`).join('')}</ol>
          <div class="bn-brand-foot"><span>제품·재료 원리의 3D 시각화</span><button type="button" id="bn-brand-pause" aria-controls="bn-brand-video" aria-label="회사 소개 일시정지"><span aria-hidden="true">Ⅱ</span><span>소개 일시정지</span></button></div>
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
  let desired = !motion.matches && !connection?.saveData;
  let visible = false, attached = false, frame = null;
  video.muted = true; video.defaultMuted = true;
  // Do not start an unsolicited download for a reduced-motion/data-saving user.
  video.autoplay = desired;
  const update = () => {
    const time = video.currentTime || 0, scene = Math.min(3, Math.floor(time / 4));
    root.dataset.story = String(scene);
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
      desired=false;video.autoplay=false;updateToggle();
      // The poster and complete company message remain visible if autoplay is blocked.
    });
  };
  const onFrame = () => {
    if(abort.signal.aborted || video.paused) return;
    update();frame=video.requestVideoFrameCallback(onFrame);
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
  video.addEventListener('timeupdate',update,options);
  video.addEventListener('seeked',update,options);
  video.addEventListener('error',()=>{desired=false;video.autoplay=false;updateToggle();},options);
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
