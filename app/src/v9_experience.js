/* Synchronous routing, native modal search and progressive motion enhancements.
   Product data and the quotation engine remain authoritative. No remote UI dependency. */
const bnNormalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[×*]/g, 'x').replace(/\s+/g, ' ').trim();
const bnFindRecords = [
  ...CAT_TILES.map(t => ({title:t.ko, sub:`${t.en} · ${iaTileN(t)}종`, route:`t-${t.id}`, kind:'제품군', text:bnNormalize(`${t.ko} ${t.en} ${t.subs.map(x => x.ko).join(' ')}`)})),
  ...Object.values(CAT_F).map(f => ({title:f.ko, sub:`${f.en} · ${f.std.map(x => x[1]).join(' · ')}`, route:f.route || `c-${f.id}`, kind:'제품', text:bnNormalize(JSON.stringify(f))})),
  ...LIB.map(x => ({title:x.t, sub:x.ko || x.en || '', route:`lib-${x.id}`, kind:'규격 사전', text:bnNormalize([x.t,x.ko,x.en,x.facts,x.watch].flat(2).join(' '))}))
];
document.body.insertAdjacentHTML('beforeend', `<div class="bn-reading-progress" aria-hidden="true"><i></i></div><button class="bn-top" type="button" aria-label="페이지 맨 위로" hidden>↑</button>
  <dialog class="bn-find" id="bn-find" aria-labelledby="bn-find-title"><div class="bn-find-head"><h2 id="bn-find-title">제품과 규격을 찾습니다.</h2><button class="bn-find-close" type="button" aria-label="검색 닫기">×</button></div><form class="bn-find-form"><label class="sr" for="bn-find-q">제품·규격 통합 검색</label><input id="bn-find-q" type="search" placeholder="예: 육각볼트, ISO 4017, A193 B7" autocomplete="off" spellcheck="false"><button type="submit" aria-label="첫 번째 검색 결과 열기">↗</button></form><p class="bn-find-count" id="bn-find-count" role="status" aria-live="polite" aria-atomic="true"></p><div class="bn-find-results" id="bn-find-results"></div><div class="bn-find-foot"><span>Esc 닫기 · Ctrl / ⌘ K 검색</span><a id="bn-find-all" href="#lib" data-go="lib">규격 사전에서 더 찾기 ↗</a></div></dialog>`);
const bnFindDialog = $('bn-find'), bnFindInput = $('bn-find-q');
let bnFindTimer;
function bnRenderFind() {
  const query=bnNormalize(bnFindInput.value), terms=query.split(' ').filter(Boolean);
  const records=query ? bnFindRecords.filter(r => terms.every(t => r.text.includes(t)))
    .sort((a,b) => Number(bnNormalize(b.title) === query)-Number(bnNormalize(a.title) === query)) : bnFindRecords.slice(0,CAT_TILES.length);
  const results=records.slice(0,12);
  $('bn-find-count').textContent=query ? `${records.length}개 결과${records.length>12?' · 먼저 12개를 보여 드립니다':''}` : '제품군부터 살펴보세요.';
  $('bn-find-results').innerHTML=results.length ? results.map(r=>`<a href="#${esc(r.route)}" data-go="${esc(r.route)}"><span><b>${esc(r.title)}</b><small>${esc(r.sub)}</small></span><i>${esc(r.kind)}</i><span aria-hidden="true">↗</span></a>`).join('') : '<p class="bn-find-empty">일치하는 항목이 없습니다.<br>규격 번호나 품목 이름을 바꿔 보거나, BOM 그대로 견적을 요청하세요.</p><a href="#list" data-go="list">목록 견적 요청 ↗</a>';
  const route=libURL({q:bnFindInput.value.trim(),topic:'',path:'',kind:'all',org:'all'});
  $('bn-find-all').href='#'+route; $('bn-find-all').dataset.go=route;
}
function bnOpenFind() {
  iaMenu(false);
  if (!bnFindDialog.open) { bnRenderFind(); bnFindDialog.showModal(); }
  bnFindInput.focus(); bnFindInput.select();
}
bnFindDialog.querySelector('.bn-find-close').addEventListener('click',()=>bnFindDialog.close());
bnFindDialog.addEventListener('click',e=> { if(e.target === bnFindDialog) bnFindDialog.close(); });
bnFindDialog.addEventListener('keydown',e=> { if(e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); bnFindDialog.close(); } });
bnFindDialog.addEventListener('close',()=> { if(!bnFindDialog.open) clearTimeout(bnFindTimer); });
bnFindInput.addEventListener('input',()=> { clearTimeout(bnFindTimer); bnFindTimer=setTimeout(bnRenderFind,120); });
bnFindDialog.querySelector('form').addEventListener('submit',e=> { e.preventDefault(); clearTimeout(bnFindTimer); bnRenderFind(); bnFindDialog.querySelector('.bn-find-results a')?.click(); });
bnFindInput.addEventListener('keydown',e=> { if(e.key==='ArrowDown') { e.preventDefault(); bnFindDialog.querySelector('.bn-find-results a')?.focus(); } });
document.addEventListener('keydown',e=> { if((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase()==='k') { e.preventDefault(); bnOpenFind(); } });
document.addEventListener('click',e=> { if(e.target.closest('[data-bn-find]')) bnOpenFind(); });
$('mini-find').addEventListener('click',e=> { e.stopImmediatePropagation(); bnOpenFind(); });

let bnMenuSession=null;
iaMenuHTML = () => `<div class="bn-menu-head"><span><img class="bn-logo bn-logo-ink" src="/brand/boltnote-logo.svg" width="632" height="104" alt="boltnote"><img class="bn-logo bn-logo-white" src="/brand/boltnote-logo-light.svg" width="632" height="104" alt="" aria-hidden="true"></span><button class="bn-menu-close" type="button" data-bn-menu-close>메뉴 닫기 <span aria-hidden="true">×</span></button></div>
  <div class="bn-menu-body"><nav class="bn-menu-links" aria-label="전체 메뉴">${[['products','제품 라인업'],['lib','규격 사전'],['ref','도면·규격'],['list','목록 견적'],['about','회사 소개']].map(([route,title],i)=>`<a href="#${route}" data-go="${route}"${iaNavKey(state.route)===route?' aria-current="page"':''}><span>0${i+1}</span><b>${title}</b><i aria-hidden="true">↗</i></a>`).join('')}</nav><div><p class="bn-menu-caption" lang="en">EXPLORE THE COLLECTION</p><nav class="bn-menu-products" aria-label="제품군">${CAT_TILES.map(t=>`<a href="#t-${t.id}" data-go="t-${t.id}">${esc(t.ko)}<small>${iaTileN(t)}종</small></a>`).join('')}</nav><div class="bn-menu-knowledge"><p class="bn-menu-caption" lang="en">ENGINEERING PATHS</p>${LIB_PATHS.map(p=>`<a href="#lib?path=${p.id}" data-go="lib?path=${p.id}">${esc(p.title)}<span aria-hidden="true">↗</span></a>`).join('')}</div></div></div><div class="bn-menu-contact"><span>볼트노트 · 체결부품 견적·공급</span>${rfqOk('rfq')?`<a href="mailto:${esc(CONTACT.rfq)}">${esc(CONTACT.rfq)}</a>`:''}<a href="#list" data-go="list">BOM 그대로 견적 요청 ↗</a></div>`;
iaMenu = (open, restore=true) => {
  const button=$('ia-menu-b'), menu=$('ia-menu');
  if(open && !bnMenuSession) {
    menu.innerHTML=iaMenuHTML(); menu.hidden=false;
    const locked=[$('view'),document.querySelector('footer.foot'),$('tb-mini'),document.querySelector('#tb .tb-grid')].filter(Boolean);
    bnMenuSession={focus:document.activeElement,overflow:document.documentElement.style.overflow,locked:locked.map(el=>[el,el.inert])};
    locked.forEach(el=> { el.inert=true; }); document.documentElement.style.overflow='hidden';
    button.setAttribute('aria-expanded','true'); button.setAttribute('aria-label','전체 메뉴 닫기');
    menu.querySelector('[data-bn-menu-close]').addEventListener('click',()=>iaMenu(false));
    menu.querySelector('[data-bn-menu-close]').focus();
    if(!reduced()) menu.animate([{opacity:0,transform:'translateY(-12px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.22,1,.36,1)'});
  } else if(!open) {
    menu.hidden=true; button.setAttribute('aria-expanded','false'); button.setAttribute('aria-label','전체 메뉴 열기');
    if(bnMenuSession) {
      const session=bnMenuSession; bnMenuSession=null;
      session.locked.forEach(([el,inert])=> { el.inert=inert; });
      document.documentElement.style.overflow=session.overflow;
      if(restore && session.focus?.isConnected) session.focus.focus({preventScroll:true});
    }
  }
};
document.addEventListener('keydown',e=> {
  if(!bnMenuSession || e.key!=='Tab') return;
  const links=[...$('ia-menu').querySelectorAll('a,button')],first=links[0],last=links.at(-1);
  if(e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); }
});
$('ia-menu-b').setAttribute('aria-label','전체 메뉴 열기');
document.querySelector('.cartbtn').setAttribute('aria-label','견적함 열기');

let bnPageAbort=null, bnRevealObserver=null, bnPageAnimation=null;
function bnEnhancePage() {
  bnPageAbort?.abort(); bnRevealObserver?.disconnect(); bnPageAnimation?.cancel();
  bnPageAbort=new AbortController(); const eventOptions={signal:bnPageAbort.signal};
  const root=view();
  if(!reduced()) {
    bnPageAnimation=root.animate([{opacity:.25,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'});
    bnRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=> {
      if(!entry.isIntersecting) return;
      if(!reduced()) entry.target.animate([{opacity:.35,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
      bnRevealObserver.unobserve(entry.target);
    }),{threshold:.12});
    root.querySelectorAll('.bn-section-head,.bn-application,.bn-topic,.bn-rfq-input').forEach(el=>bnRevealObserver.observe(el));
  }
  root.querySelectorAll('[data-bn-scroll]').forEach(b=>b.addEventListener('click',()=> {
    const target=$(b.dataset.bnScroll); if(!target) return;
    target.setAttribute('tabindex','-1'); target.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});
  },eventOptions));
  const track=root.querySelector('.bn-carousel .bn-products');
  if(track) {
    track.id='bn-product-track'; const prev=root.querySelector('[data-bn-products-step="-1"]'),next=root.querySelector('[data-bn-products-step="1"]');
    prev.setAttribute('aria-controls',track.id); next.setAttribute('aria-controls',track.id);
    const step=()=>track.firstElementChild.getBoundingClientRect().width+parseFloat(getComputedStyle(track).gap);
    const status=()=> { const i=Math.max(1,Math.min(CAT_TILES.length,Math.round(track.scrollLeft/step())+1)); $('bn-product-position').textContent=`${String(i).padStart(2,'0')} / ${String(CAT_TILES.length).padStart(2,'0')}`; prev.disabled=track.scrollLeft<2; next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-2; };
    for(const button of [prev,next]) button.addEventListener('click',()=>track.scrollBy({left:Number(button.dataset.bnProductsStep)*step(),behavior:reduced()?'instant':'smooth'}),eventOptions);
    track.addEventListener('scroll',status,{...eventOptions,passive:true});
    window.addEventListener('resize',status,eventOptions); status();
    let drag=null,dragged=false;
    track.addEventListener('pointerdown',e=> { if(e.pointerType!=='mouse' || e.button!==0) return; drag={id:e.pointerId,x:e.clientX,left:track.scrollLeft}; dragged=false; },eventOptions);
    track.addEventListener('pointermove',e=> {
      if(!drag) return; const distance=e.clientX-drag.x;
      if(Math.abs(distance)>8) { dragged=true; track.classList.add('bn-dragging'); track.setPointerCapture(drag.id); }
      if(dragged) { e.preventDefault(); track.scrollLeft=drag.left-distance; }
    },eventOptions);
    const finish=()=> { if(!drag) return; if(track.hasPointerCapture(drag.id)) track.releasePointerCapture(drag.id); drag=null; track.classList.remove('bn-dragging'); };
    track.addEventListener('pointerup',finish,eventOptions); track.addEventListener('pointercancel',finish,eventOptions);
    track.addEventListener('click',e=> { if(dragged) { e.preventDefault(); e.stopImmediatePropagation(); dragged=false; } },{...eventOptions,capture:true});
    track.addEventListener('dragstart',e=>e.preventDefault(),eventOptions);
  }
  bnUpdateReading();
}
const bnOriginalGo=go;
go = (route,push=true) => {
  if(bnFindDialog.open) bnFindDialog.close();
  iaMenu(false,false);
  // Keep routing synchronous: tool tabs, presets and BOM handlers use the new DOM immediately.
  bnOriginalGo(route,push); bnEnhancePage();
};
let bnReadingFrame=0;
function bnUpdateReading() {
  const extent=document.documentElement.scrollHeight-innerHeight;
  document.querySelector('.bn-reading-progress').style.setProperty('--bn-read',`${extent>0?Math.min(100,Math.max(0,scrollY/extent*100)):0}%`);
  document.querySelector('.bn-top').hidden=scrollY<innerHeight;
}
window.addEventListener('scroll',()=> { if(!bnReadingFrame) bnReadingFrame=requestAnimationFrame(()=> { bnReadingFrame=0; bnUpdateReading(); }); },{passive:true});
window.addEventListener('resize',bnUpdateReading);
document.querySelector('.bn-top').addEventListener('click',()=> { const h=view().querySelector('h1'); h?.focus({preventScroll:true}); scrollTo({top:0,behavior:reduced()?'instant':'smooth'}); });
