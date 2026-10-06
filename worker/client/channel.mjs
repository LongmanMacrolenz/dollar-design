import {CHANNEL,GROUPS,FIELDS,CHECKLIST} from './channel-content.mjs';

const app=document.querySelector('#channel-app');
const STORAGE='bn-kakao-channel-copy-v1';
const allowed=new Set(FIELDS.map(f=>f.id));
let values={},checked=[],group='profile',persist=true,noticeTimer,saveTimer;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try {
  const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
  if(saved&&saved.version===1){
    for(const [id,value] of Object.entries(saved.values||{}))if(allowed.has(id)&&typeof value==='string'&&value.length<=20000)values[id]=value;
    checked=(Array.isArray(saved.checked)?saved.checked:[]).filter(id=>CHECKLIST.some(c=>c[0]===id));
  }
}catch{persist=false;}
const value=id=>values[id]??FIELDS.find(f=>f.id===id).value;
function message(text){clearTimeout(noticeTimer);const el=document.querySelector('#notice');el.textContent=text;el.style.display='block';noticeTimer=setTimeout(()=>el.style.display='none',4500);}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,values,checked}));persist=true;}catch{persist=false;}const el=document.querySelector('#channel-local');if(el)el.textContent=persist?'수정 내용과 체크 표시는 이 브라우저에만 저장됩니다.':'브라우저 저장을 사용할 수 없습니다. 전체 자료를 내려받아 보관해 주세요.';}
function count(field){const len=Array.from(value(field.id)).length;return `${len}자${field.recommended?` · 권장 ${field.recommended}자 이내`:''}`;}
function fieldHTML(f){return `<article class="card channel-field" data-field="${f.id}"><label for="ch-${f.id}">${esc(f.title)}</label><textarea id="ch-${f.id}" data-edit="${f.id}" class="${value(f.id).includes('\n')?'multiline':''}" spellcheck="false" maxlength="20000">${esc(value(f.id))}</textarea><div class="bar"><span class="channel-count${f.recommended&&Array.from(value(f.id)).length>f.recommended?' long':''}" data-count="${f.id}">${count(f)}</span><div class="row-actions"><button type="button" data-reset="${f.id}">기본 문구</button><button type="button" data-copy="${f.id}">복사</button></div></div>${f.note?`<p class="channel-note">${esc(f.note)}</p>`:''}</article>`;}
function render(){
  app.innerHTML=`<section class="channel-intro"><span class="channel-label">BOLTNOTE / KAKAO BUSINESS CHANNEL</span><h1>채널 운영에 필요한 내용,<br>여기서 준비하세요.</h1><p>프로필, 상담 메시지, FAQ와 공지를 수정하고 복사해 카카오 관리자 화면에 입력합니다.</p><p class="channel-warning">입력 자료 준비 페이지입니다. 카카오 설정에 자동 저장하거나 메시지를 발송하지 않습니다.</p></section>
  <div class="channel-tools"><a class="button primary" href="${CHANNEL.manager}" target="_blank" rel="noopener noreferrer">카카오 관리자 열기 ↗</a><a class="button" href="${CHANNEL.profile}" target="_blank" rel="noopener noreferrer">공개 채널 보기 ↗</a><button type="button" data-action="export">전체 자료 내려받기</button><button type="button" data-action="copy-all">전체 복사</button></div>
  <p class="channel-local" id="channel-local">${persist?'수정 내용과 체크 표시는 이 브라우저에만 저장됩니다.':'브라우저 저장을 사용할 수 없습니다. 전체 자료를 내려받아 보관해 주세요.'}</p>
  <details class="card channel-checklist"><summary>채널 입력 순서 <span class="badge" id="check-progress">${checked.length} / ${CHECKLIST.length}</span></summary><p>카카오에서 직접 적용한 항목을 표시하세요. 체크 표시는 자동 연결 검증 결과가 아닙니다.</p><div class="channel-checks">${CHECKLIST.map(([id,text])=>`<label><input type="checkbox" data-check="${id}"${checked.includes(id)?' checked':''}>${esc(text)}</label>`).join('')}</div></details>
  <div class="channel-layout"><nav class="channel-nav" role="tablist" aria-label="카카오 입력 항목">${GROUPS.map(([id,title])=>`<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${id===group}" tabindex="${id===group?0:-1}" data-group="${id}">${title}</button>`).join('')}<small>채널 승인 확인 ${CHANNEL.confirmed}<br>채널 ID ${CHANNEL.id}</small></nav><div>${GROUPS.map(([id,title,note])=>`<section class="channel-panel" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}"${id===group?'':' hidden'}><div class="bar"><h2>${title}</h2><button type="button" data-copy-group="${id}">이 항목 전체 복사</button></div><p>${note}</p>${id==='profile'?profileAssets():''}${FIELDS.filter(f=>f.group===id).map(fieldHTML).join('')}</section>`).join('')}</div></div>
  <section class="card channel-instructions"><h2>카카오에서 마무리할 설정</h2><ol><li><a href="${CHANNEL.manager}" target="_blank" rel="noopener noreferrer">관리자 화면</a>에서 프로필·소개·연락처·홈페이지를 입력합니다. 업종은 실제 사업과 맞는 체결부품 도소매 관련 분류를 선택합니다.</li><li><a href="${CHANNEL.chats}" target="_blank" rel="noopener noreferrer">채팅 관리</a>에 들어가 관리자 추가 인증을 마친 뒤 실제 운영 요일·시간, 환영·부재중 메시지와 사용 가능한 상담 메뉴를 설정합니다.</li><li><a href="${CHANNEL.posts}" target="_blank" rel="noopener noreferrer">소식 관리</a>에서 회사 소개와 BOM 접수 안내를 게시합니다. 첫 소식이 이미 있으면 내용을 확인해 수정하거나 중복되지 않게 추가합니다.</li><li>고객 계정으로 채널 추가와 1:1 상담을 열고, BOM·특수요건·규격 사전 링크가 원하는 화면으로 이동하는지 확인합니다.</li></ol><p class="muted">사업장 주소는 공개하지 않습니다. 방문 매장 등록, 쿠폰 할인, 유료 광고·메시지 예산은 이 자료에 포함하지 않습니다.</p></section>
  <footer class="channel-footer">이 페이지는 공개 회사 문구를 준비하는 도구입니다. 고객 BOM, 공급처 회신, 매입 조건, 계정 비밀번호를 입력하지 마세요. 카카오 상담 내용은 현재 견적 관리 시스템에 자동 수집되지 않습니다. 정식 BOM은 홈페이지 또는 이메일로 접수합니다.<div class="bar"><button type="button" data-action="clear">이 브라우저의 채널 초안 지우기</button></div></footer>`;
}
function profileAssets(){return `<div class="channel-preview"><img src="/brand/boltnote-mark.svg" alt="볼트노트 브랜드 심벌"><div><strong>${esc(value('name'))}</strong><p>${esc(value('intro'))}</p><a class="channel-route" href="${CHANNEL.chat}" target="_blank" rel="noopener noreferrer">1:1 상담 링크 ↗</a></div></div><div class="card"><h3>기존 브랜드 이미지</h3><p>현재 홈페이지 로고로 PNG를 만듭니다. 업로드 화면에서 자르기와 배치를 확인해 주세요.</p><div class="channel-assets"><button type="button" data-action="profile-image">프로필 PNG · 400×400</button><button type="button" data-action="cover-image">소개 표지 PNG · 1200×600</button></div></div>`;}
function textFor(fields){return fields.map(f=>`[${f.title}]\n${value(f.id)}`).join('\n\n');}
function allText(){return `볼트노트 카카오 채널 입력 자료\n채널: ${CHANNEL.profile}\n상담: ${CHANNEL.chat}\n관리자: ${CHANNEL.manager}\n\n`+GROUPS.map(([id,title])=>`## ${title}\n\n${textFor(FIELDS.filter(f=>f.group===id))}`).join('\n\n');}
async function copy(text){try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);message('복사했습니다. 카카오 입력 칸에 붙여 넣으세요.');}catch{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(ta);const previous=document.activeElement;ta.select();const ok=document.execCommand('copy');ta.remove();previous?.focus();if(ok)message('복사했습니다. 카카오 입력 칸에 붙여 넣으세요.');else{message('브라우저 복사가 제한됩니다. 문구를 선택해 복사하거나 전체 자료를 내려받으세요.');}}}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function imageDownload(cover){
  await document.fonts.ready;
  const logo=new Image();logo.src=cover?'/brand/boltnote-logo.svg':'/brand/boltnote-mark.svg';await logo.decode();
  const c=document.createElement('canvas');c.width=cover?1200:400;c.height=cover?600:400;
  const ctx=c.getContext('2d');ctx.fillStyle='#f6f4ef';ctx.fillRect(0,0,c.width,c.height);
  if(!cover){ctx.drawImage(logo,72,72,256,256);}else{
    ctx.drawImage(logo,72,68,350,350*104/632);ctx.fillStyle='#142234';ctx.font='bold 60px BN, sans-serif';ctx.fillText('체결부품 조달,',72,265);ctx.fillStyle='#e54b28';ctx.fillText('BOM부터 정확하게.',72,350);
    ctx.fillStyle='#526170';ctx.font='24px BN, sans-serif';ctx.fillText('사양·특수요건 검토 → 공급처 확인 → 견적·C&D',72,440);
    ctx.fillStyle='#142234';ctx.font='20px BN, sans-serif';ctx.fillText('boltnote.boltnote.workers.dev',72,530);
  }
  const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error('이미지 파일을 만들지 못했습니다.');
  download(blob,cover?'boltnote-kakao-cover.png':'boltnote-kakao-profile.png');message('PNG를 내려받았습니다. 카카오에서 업로드해 주세요.');
}
function switchGroup(id,focus=false){group=id;for(const [name] of GROUPS){const tab=document.querySelector('#tab-'+name);tab.setAttribute('aria-selected',String(name===id));tab.tabIndex=name===id?0:-1;document.querySelector('#panel-'+name).hidden=name!==id;}if(focus)document.querySelector('#tab-'+id).focus();}
app.addEventListener('input',e=>{const id=e.target.dataset.edit;if(!allowed.has(id))return;values[id]=e.target.value;const f=FIELDS.find(f=>f.id===id),counter=document.querySelector(`[data-count="${id}"]`);counter.textContent=count(f);counter.classList.toggle('long',!!f.recommended&&Array.from(value(id)).length>f.recommended);if(id==='name')document.querySelector('.channel-preview strong').textContent=value(id);if(id==='intro')document.querySelector('.channel-preview p').textContent=value(id);clearTimeout(saveTimer);saveTimer=setTimeout(save,250);});
app.addEventListener('change',e=>{const id=e.target.dataset.check;if(!CHECKLIST.some(c=>c[0]===id))return;checked=checked.filter(c=>c!==id);if(e.target.checked)checked.push(id);document.querySelector('#check-progress').textContent=`${checked.length} / ${CHECKLIST.length}`;save();});
app.addEventListener('keydown',e=>{if(!e.target.dataset.group)return;const keys=['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const index=GROUPS.findIndex(g=>g[0]===group),next=e.key==='Home'?0:e.key==='End'?GROUPS.length-1:(index+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+GROUPS.length)%GROUPS.length;switchGroup(GROUPS[next][0],true);});
app.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
  if(b.dataset.group){switchGroup(b.dataset.group);return;}
  if(b.dataset.copy){save();await copy(value(b.dataset.copy));return;}
  if(b.dataset.copyGroup){save();await copy(textFor(FIELDS.filter(f=>f.group===b.dataset.copyGroup)));return;}
  if(b.dataset.reset){if(!confirm('이 항목을 기본 문구로 되돌릴까요?'))return;delete values[b.dataset.reset];save();render();document.querySelector('#ch-'+b.dataset.reset)?.focus();return;}
  const action=b.dataset.action;
  if(action==='copy-all'){save();await copy(allText());}
  if(action==='export'){save();download(new Blob([allText()],{type:'text/plain;charset=utf-8'}),'boltnote-kakao-channel.txt');message('전체 입력 자료를 내려받았습니다.');}
  if(action==='profile-image'||action==='cover-image'){b.disabled=true;await imageDownload(action==='cover-image');b.disabled=false;}
  if(action==='clear'){if(!confirm('이 브라우저의 수정 문구와 체크 표시를 지우고 기본 자료로 돌아갈까요?'))return;clearTimeout(saveTimer);values={};checked=[];try{localStorage.removeItem(STORAGE);}catch{}render();message('채널 초안을 지웠습니다. 카카오에 저장한 설정은 바뀌지 않습니다.');}
}catch(err){b.disabled=false;message(err.message||'다시 시도해 주세요.');}});
addEventListener('pagehide',()=>{clearTimeout(saveTimer);save();});
render();
