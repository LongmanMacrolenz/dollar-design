/* Original pre-rendered assemblies. No remote player, tracking, or 3D dependency.
   The film is an illustration of applications, not a tightening procedure. */
const BN_FILM_CHAPTERS = [
  {start:0,still:3.8,label:'2D → 3D',en:'FROM DRAWING TO SOLID',title:'형상에서, 구매 사양으로.',parts:'볼트 · 너트 · 와셔 · 키 / 도면에서 입체로',check:'형상 · 규격 · 재질 · 표면처리를 함께 지정하세요.',link:'lib?topic=bolt-nut-washer'},
  {start:6,still:9.5,label:'나사 공차',en:'THREAD SERIES & FIT',title:'UNC와 UNF. 공차까지.',parts:'3/4″-10 UNC · 3/4″-16 UNF / 1A·2A·3A와 1B·2B·3B',check:'호칭 · 산 수 · A/B 등급 · 도금 후 치수를 확인하세요.',link:'lib-t-inch-class'},
  {start:12,still:15.5,label:'헤비너트',en:'HEAVY HEX GEOMETRY',title:'같은 호칭, 다른 너트.',parts:'2면폭과 높이 · 물림 길이 / RCSC 구조용 호칭 형상 예',check:'헤비 형상 · 높이 · 등급 · 지정 치수 규격을 확인하세요.',link:'lib-p-heavy-hex-nut'},
  {start:18,still:20.9,label:'탄성·인장',en:'ELASTIC LOAD & RECOVERY',title:'늘어나고, 돌아옵니다.',parts:'탄성 영역의 인장 · 하중 제거 / 인장강도 기준값 별도 표시',check:'인장강도와 탄성 한도를 구분하고 성적서를 확인하세요.',link:'lib-t-yield-tensile'},
  {start:24,still:26.7,label:'반복하중',en:'CYCLIC LOAD & FATIGUE',title:'한 번의 강도, 반복의 조건.',parts:'반복 인장과 S–N 개념도 / 피로한도는 시험 조건으로 확인',check:'평균응력 · 예압 · 전조 · 나사 골 · 환경을 확인하세요.',link:'lib-t-fatigue'},
  {start:30,still:34.9,label:'경도 시험',en:'HARDNESS ON A COUPON',title:'작은 압흔으로 확인합니다.',parts:'별도 시편 압입 · 압입자 제거 · 남는 압흔 / 볼트는 그대로',check:'시험 척도 · 하중 · 측정 위치와 표면처리를 확인하세요.',link:'lib-t-hardness'},
  {start:36,still:41.7,label:'표면처리',en:'PROTECTIVE LAYERS',title:'색보다, 보호층의 사양.',parts:'건조 · 습윤 · 염분 / 무코팅과 보호층의 부식 원리 개념도',check:'코팅 계통 · 두께 · 손상 · 나사 맞춤 · 시험 기준을 확인하세요.',link:'lib?path=purchase'}
];
function bnFilmMarkup() {
  return `<figure class="bn-film">
    <div class="bn-film-controls">
    <div class="bn-film-chapters" style="--bn-chapter-count:${BN_FILM_CHAPTERS.length}" role="group" aria-label="체결부품 영상 장면 선택">${BN_FILM_CHAPTERS.map((chapter, i) => `<button type="button" data-bn-scene="${i}" aria-pressed="false" aria-controls="bn-film-video"><span class="bn-film-chapter-no" aria-hidden="true">0${i+1}</span><span>${chapter.label}</span><span class="bn-film-track" aria-hidden="true"><i></i></span></button>`).join('')}</div>
    <button class="bn-film-play" id="bn-film-play" type="button" aria-controls="bn-film-video" aria-label="규격·재료 영상 재생"><span aria-hidden="true">▶</span><span>재생</span></button>
    </div>
    <div class="bn-film-stage">
      <video id="bn-film-video" width="1200" height="900" muted loop playsinline preload="none" poster="media/boltnote-engineering-poster.webp" aria-label="2D에서 3D로 변하는 체결부품, 나사 공차, 헤비너트, 탄성·반복하중, 경도 시편과 보호층의 3D 개념 영상">
        <source data-src="media/boltnote-engineering-mobile.mp4" media="(max-width: 700px)" type="video/mp4">
        <source data-src="media/boltnote-engineering.webm" type="video/webm">
        <source data-src="media/boltnote-engineering.mp4" type="video/mp4">
      </video>
      <div class="bn-film-badge"><span aria-hidden="true"></span><span lang="en">ENGINEERING IN VIEW</span></div>
      <div class="bn-film-corner" aria-hidden="true">BOLTNOTE<br>ENGINEERING SERIES</div>
    </div>
    <figcaption class="bn-film-caption"><span class="bn-film-number" id="bn-film-number" aria-hidden="true">01 / 07</span><div><span id="bn-film-en" lang="en">ENGINEERED CONNECTIONS</span><strong id="bn-film-title">형상 · 공차 · 재료 · 표면처리</strong><p id="bn-film-parts">규격과 시험을 이해하는 일곱 장면</p></div></figcaption>
    ${bnSciencePanel()}
  </figure>`;
}
function bnFilmNavigation() {
  return `<div class="bn-wrap bn-film-navigation">
    <p class="bn-film-note">규격·재료·시험 원리를 설명하는 개념 영상입니다. 변형·공차 폭·부식 진행은 확대 표현이며 실제 시험값이나 수명 예측이 아닙니다. 조립 검증·토크 계산·현장 시공 인증을 대신하지 않습니다.</p><a class="bn-film-check" id="bn-film-check" href="#lib?path=purchase" data-go="lib?path=purchase"><span>구매 전 확인</span><b id="bn-film-check-text">호칭 · 피치 · 길이 · 등급을 함께 확인하세요.</b><i aria-hidden="true">↗</i></a>
  </div>`;
}
let bnFilmCleanup = null;
function bnFilmInit() {
  if (bnFilmCleanup) bnFilmCleanup();
  const root = view().querySelector('.bn-cinema');
  if (!root) return;
  const video = root.querySelector('#bn-film-video'), toggle = root.querySelector('#bn-film-play');
  const buttons = [...root.querySelectorAll('[data-bn-scene]')];
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const plantVideo = view().querySelector('.pm-video');
  const abort = new AbortController(), eventOptions = {signal: abort.signal};
  let desired = false; // Quote first: load video only after an explicit play or chapter selection.
  let visible = true, plantVisible = false, attached = false, pendingSeek = null;
  let filePromise = null, fileURL = null;
  const updateToggle = () => {
    const playing = !video.paused && !video.ended;
    root.dataset.playing = String(playing);
    toggle.setAttribute('aria-label', `규격·재료 영상 ${playing ? '일시정지' : '재생'}`);
    toggle.innerHTML = `<span aria-hidden="true">${playing ? 'Ⅱ' : '▶'}</span><span>${playing ? '일시정지' : '재생'}</span>`;
  };
  const updateScene = () => {
    const posterOnly = video.readyState === 0 && pendingSeek === null;
    const time = posterOnly ? BN_FILM_CHAPTERS[0].still : video.currentTime;
    const index = BN_FILM_CHAPTERS.reduce((current, chapter, i) => time >= chapter.start ? i : current, 0);
    const chapter = BN_FILM_CHAPTERS[index];
    const checklist=root.querySelector('#bn-film-check');
    checklist.href='#'+chapter.link;checklist.dataset.go=chapter.link;
    root.querySelector('#bn-film-check-text').textContent=chapter.check;
    root.dataset.scene = String(index);
    root.querySelector('#bn-film-number').textContent = posterOnly ? '미리보기' : `0${index+1} / 0${BN_FILM_CHAPTERS.length}`;
    root.querySelector('#bn-film-en').textContent = chapter.en;
    root.querySelector('#bn-film-title').textContent = chapter.title;
    root.querySelector('#bn-film-parts').textContent = chapter.parts;
    bnScienceUpdate(root,index,time);
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(!posterOnly && i === index));
      const end = BN_FILM_CHAPTERS[i+1]?.start || video.duration || 42;
      const progress = posterOnly ? 0 : Math.max(0, Math.min(1, (time - BN_FILM_CHAPTERS[i].start)/(end-BN_FILM_CHAPTERS[i].start)));
      button.style.setProperty('--film-progress', `${progress*100}%`);
    });
  };
  const play = () => {
    if (!desired || !visible || document.hidden || abort.signal.aborted) return;
    const promise = video.play();
    if (promise) promise.catch(error => {
      if (!abort.signal.aborted && !(error.name === 'AbortError' && (!visible || document.hidden))) { desired = false; updateToggle(); }
    });
  };
  const attach = () => {
    if (attached) return;
    attached = true;
    video.querySelectorAll('source').forEach(source => {
      if (!source.media || matchMedia(source.media).matches) source.src = source.dataset.src;
    });
    video.preload = 'metadata';
    video.load();
  };
  const loading = active => {
    video.setAttribute('aria-busy', String(active));
    const badge = root.querySelector('.bn-film-badge > span:last-child');
    badge.lang = active ? 'ko' : 'en';
    badge.textContent = active ? '선택한 장면을 불러옵니다' : 'ENGINEERING IN VIEW';
  };
  const loadFile = () => {
    if (filePromise || fileURL) return;
    // A complete local media object supports seeking even on static hosts
    // that do not serve HTTP byte ranges. Fetch only after a scene is chosen.
    const source = [...video.querySelectorAll('source')].find(item =>
      (!item.media || matchMedia(item.media).matches) && video.canPlayType(item.type));
    if (!source) return;
    const url = new URL(source.dataset.src, document.baseURI).href;
    video.dataset.fileSrc = url;
    video.pause(); loading(true);
    filePromise = fetch(url, {signal: abort.signal, cache: 'force-cache'}).then(response => {
      if (!response.ok) throw new Error('Film unavailable');
      return response.blob();
    }).then(file => {
      if (abort.signal.aborted) return;
      fileURL = URL.createObjectURL(file);
      attached = true;
      video.src = fileURL;
      video.load();
    }).catch(error => {
      if (abort.signal.aborted || error.name === 'AbortError') return;
      filePromise = null; pendingSeek = null; desired = false;
      loading(false); updateToggle();
      root.querySelector('#bn-film-parts').textContent = '장면을 불러오지 못했습니다. 장면 버튼을 다시 눌러 주세요.';
    });
  };
  root.querySelector('#bn-science').addEventListener('click', event => {
    const button=event.target.closest('[data-bn-class]');
    if(!button) return;
    bnScienceState.threadClass=button.dataset.bnClass;
    root.querySelector('#bn-science-content').dataset.chapter='';
    updateScene();
    root.querySelector(`[data-bn-class="${bnScienceState.threadClass}"]`)?.focus({preventScroll:true});
  },eventOptions);
  root.querySelector('#bn-science').addEventListener('change', event => {
    if(event.target.id==='bn-science-material') {
      bnScienceState.material=event.target.value;
      root.querySelector('#bn-science-content').dataset.chapter='';updateScene();
      root.querySelector('#bn-science-material')?.focus({preventScroll:true});
    }
    if(event.target.id==='bn-science-environment') {
      const environment=BN_SCIENCE_ENV[Number(event.target.value)];
      pendingSeek=desired?environment.at:environment.still;
      if(fileURL && video.currentSrc===fileURL && video.readyState>=1) {
        video.currentTime=pendingSeek;pendingSeek=null;
      } else loadFile();
    }
  },eventOptions);
  // Synchronize schematic cursors with decoded frames, never a free-running timer.
  let frameCallback=null;
  const frameUpdate=()=>{
    if(abort.signal.aborted || video.paused) return;
    updateScene();
    frameCallback=video.requestVideoFrameCallback(frameUpdate);
  };
  if(video.requestVideoFrameCallback) video.addEventListener('play',()=>{
    if(frameCallback!==null) video.cancelVideoFrameCallback(frameCallback);
    frameCallback=video.requestVideoFrameCallback(frameUpdate);
  },eventOptions);
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null) {
      if (!fileURL || video.currentSrc !== fileURL) { loadFile(); return; }
      video.currentTime = pendingSeek; pendingSeek = null;
    }
    loading(false);
    updateScene(); play();
  }, eventOptions);
  video.addEventListener('timeupdate', updateScene, eventOptions);
  video.addEventListener('seeked', updateScene, eventOptions);
  video.addEventListener('play', updateToggle, eventOptions);
  video.addEventListener('pause', updateToggle, eventOptions);
  video.addEventListener('error', () => { desired = false; updateToggle(); }, eventOptions);
  toggle.addEventListener('click', () => {
    desired = video.paused;
    if (desired) { attach(); play(); } else { video.pause(); }
  }, eventOptions);
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    // A paused/reduced-motion visitor gets a representative engineering still.
    pendingSeek = desired ? BN_FILM_CHAPTERS[index].start + .1 : BN_FILM_CHAPTERS[index].still;
    if (fileURL && video.currentSrc === fileURL && video.readyState >= 1) {
      video.currentTime = pendingSeek; pendingSeek = null; play();
    } else loadFile();
  }, eventOptions));
  preference.addEventListener('change', () => {
    if (preference.matches) { desired = false; video.pause(); plantVideo?.pause(); }
  }, eventOptions);
  const playPlant = () => {
    if (!plantVideo) return;
    if (plantVisible && !preference.matches && !navigator.connection?.saveData && !document.hidden) {
      const promise = plantVideo.play();
      if (promise) promise.catch(() => {});
    } else plantVideo.pause();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause(); else play();
    playPlant();
  }, eventOptions);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { if (desired) attach(); play(); } else video.pause();
  }, {threshold: .08});
  intersection.observe(video);
  const plantIntersection = new IntersectionObserver(entries => {
    plantVisible = entries[0].isIntersecting;
    playPlant();
  }, {threshold: .15});
  if (plantVideo) plantIntersection.observe(plantVideo);
  const cleanup = () => {
    abort.abort(); if(frameCallback!==null) video.cancelVideoFrameCallback?.(frameCallback); intersection.disconnect(); plantIntersection.disconnect(); removed.disconnect();
    plantVideo?.pause();
    video.pause();
    video.removeAttribute('src');
    video.querySelectorAll('source').forEach(source => source.removeAttribute('src'));
    video.load();
    if (fileURL) URL.revokeObjectURL(fileURL);
    if (bnFilmCleanup === cleanup) bnFilmCleanup = null;
  };
  const removed = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
  // Navigation replaces the #view element itself, so watch its stable parent.
  removed.observe(view().parentNode, {childList: true});
  bnFilmCleanup = cleanup;
  updateScene();
  updateToggle();
}
