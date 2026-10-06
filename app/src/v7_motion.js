/* Original pre-rendered assemblies. No remote player, tracking, or 3D dependency.
   The film is an illustration of applications, not a tightening procedure. */
const BN_FILM_CHAPTERS = [
  {start: 0, still: .3, label: '체결부품', en: 'FASTENER COLLECTION', title: '연결마다, 필요한 부품.', parts: '볼트 · 스터드 · 너트 · 와셔 · 핀 · 키 · 멈춤링', check: '형상과 적용 규격을 먼저 정합니다.', link: 'lib?topic=bolt-nut-washer'},
  {start: 6, still: 8.7, label: '나사 맞물림', en: 'MATCHED THREADS', title: '같은 호칭. 같은 피치.', parts: 'M16×2 기본 나사형상 단면 · 회전과 전진을 같은 피치로 연결', check: '호칭 · 피치 · 미터/인치 · 나사 공차를 확인하세요.', link: 'lib?topic=thread-fit'},
  {start: 10, still: 15.2, label: '플랜지', en: 'FLANGE CONNECTION', title: '나사와 좌면을 맞춥니다.', parts: '3/4"-10 UNC 스터드 · 헤비 육각너트 / 링 스패너', check: '길이 기준 · 너트 조합 · 플랜지와 가스켓 조건을 확인하세요.', link: 'lib?path=flange'},
  {start: 17, still: 21.8, label: '보울 하우징', en: 'THREADED HOUSING', title: '하우징의 나사에 맞게.', parts: 'M12×1.75 렌치볼트 · 평와셔 / 라쳇 · 육각 비트', check: '머리 형상 · 나사 깊이 · 길이 · 공구 치수를 확인하세요.', link: 'lib?path=machine'},
  {start: 23, still: 28.7, label: '샤프트', en: 'SHAFT & HUB', title: '키와 홈. 위치를 잡습니다.', parts: '평행 키 · 축용 멈춤링 · 평끝 멈춤나사 / 육각 렌치', check: '키 · 홈 · 멈춤링과 멈춤나사 끝 형상을 도면으로 확인하세요.', link: 'lib?path=machine'},
  {start: 30, still: 34.5, label: '대형 볼팅', en: 'HYDRAULIC DRIVE', title: '구동과 반력을 함께.', parts: '1-1/2"-8 UN 스터드 · 헤비 육각너트 / 유압 토크렌치', check: '목표 토크는 윤활 · 마찰 · 가스켓 등 조인트 조건에 따라 정합니다.', link: 'lib?path=purchase'}
];
const BN_FILM_PARTS = [
  ['육각볼트', 'HEX BOLT'], ['렌치볼트', 'SOCKET-HEAD CAP SCREW'], ['스터드볼트', 'STUD BOLT'],
  ['헤비 육각너트', 'HEAVY HEX NUT'], ['평와셔', 'FLAT WASHER'], ['다웰핀', 'DOWEL PIN'],
  ['평행 키', 'PARALLEL KEY'], ['축용 멈춤링', 'EXTERNAL RETAINING RING']
];
function bnFilmMarkup() {
  return `<figure class="bn-film">
    <div class="bn-film-stage">
      <video id="bn-film-video" width="1200" height="900" muted loop playsinline preload="none" poster="media/boltnote-precision-poster.webp" aria-label="주요 체결부품과 플랜지·보울 하우징·샤프트 조립, 렌치·라쳇·유압 토크렌치의 3D 적용 장면">
        <source data-src="media/boltnote-precision-mobile.mp4" media="(max-width: 700px)" type="video/mp4">
        <source data-src="media/boltnote-precision.webm" type="video/webm">
        <source data-src="media/boltnote-precision.mp4" type="video/mp4">
      </video>
      <div class="bn-film-badge"><span aria-hidden="true"></span><span lang="en">FASTENERS IN MOTION</span></div>
      <div class="bn-film-corner" aria-hidden="true">BOLTNOTE<br>APPLICATION SERIES</div>
    </div>
    <figcaption class="bn-film-caption"><span class="bn-film-number" id="bn-film-number" aria-hidden="true">01 / 06</span><div><span id="bn-film-en" lang="en">ENGINEERED CONNECTIONS</span><strong id="bn-film-title">플랜지 · 보울 · 샤프트</strong><p id="bn-film-parts">체결부품과 공구의 적용 장면</p></div></figcaption>
  </figure>`;
}
function bnFilmNavigation() {
  return `<div class="bn-wrap bn-film-navigation">
    <div class="bn-film-chapters" style="--bn-chapter-count:${BN_FILM_CHAPTERS.length}" role="group" aria-label="체결부품 영상 장면 선택">${BN_FILM_CHAPTERS.map((chapter, i) => `<button type="button" data-bn-scene="${i}" aria-pressed="false" aria-controls="bn-film-video"><span class="bn-film-chapter-no" aria-hidden="true">0${i+1}</span><span>${chapter.label}</span><span class="bn-film-track" aria-hidden="true"><i></i></span></button>`).join('')}</div>
    <button class="bn-film-play" id="bn-film-play" type="button" aria-controls="bn-film-video" aria-label="조립 영상 재생"><span aria-hidden="true">▶</span><span>재생</span></button>
    <p class="bn-film-note">공칭 형상과 체결 동작을 보여 주는 참고 장면입니다. 실제 조인트의 치수·공차·토크는 도면과 적용 규격으로 확인합니다.</p><a class="bn-film-check" id="bn-film-check" href="#lib?path=purchase" data-go="lib?path=purchase"><span>구매 전 확인</span><b id="bn-film-check-text">호칭 · 피치 · 길이 · 등급을 함께 확인하세요.</b><i aria-hidden="true">↗</i></a>
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
  let desired = !preference.matches && !navigator.connection?.saveData;
  let visible = true, plantVisible = false, attached = false, pendingSeek = null;
  let filePromise = null, fileURL = null;
  const updateToggle = () => {
    const playing = !video.paused && !video.ended;
    root.dataset.playing = String(playing);
    toggle.setAttribute('aria-label', `조립 영상 ${playing ? '일시정지' : '재생'}`);
    toggle.innerHTML = `<span aria-hidden="true">${playing ? 'Ⅱ' : '▶'}</span><span>${playing ? '일시정지' : '재생'}</span>`;
  };
  const updateScene = () => {
    const posterOnly = video.readyState === 0 && pendingSeek === null;
    const time = posterOnly ? BN_FILM_CHAPTERS.at(-1).still : video.currentTime;
    const index = BN_FILM_CHAPTERS.reduce((current, chapter, i) => time >= chapter.start ? i : current, 0);
    const chapter = BN_FILM_CHAPTERS[index];
    const checklist=root.querySelector('#bn-film-check');
    checklist.href='#'+chapter.link;checklist.dataset.go=chapter.link;
    root.querySelector('#bn-film-check-text').textContent=chapter.check;
    root.dataset.scene = String(index);
    root.querySelector('#bn-film-number').textContent = posterOnly ? '미리보기' : `0${index+1} / 06`;
    const part = BN_FILM_PARTS[Math.min(7, Math.floor(time / (6 / 8)))];
    root.querySelector('#bn-film-en').textContent = index === 0 ? part[1] : chapter.en;
    root.querySelector('#bn-film-title').textContent = index === 0 ? part[0] : chapter.title;
    root.querySelector('#bn-film-parts').textContent = index === 0 ? '주요 품목을 하나씩 살펴보세요.' : chapter.parts;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(!posterOnly && i === index));
      const end = BN_FILM_CHAPTERS[i+1]?.start || video.duration || 36;
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
    badge.textContent = active ? '선택한 장면을 불러옵니다' : 'FASTENERS IN MOTION';
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
    // A paused/reduced-motion visitor gets a representative tool/assembly still.
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
    abort.abort(); intersection.disconnect(); plantIntersection.disconnect(); removed.disconnect();
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
