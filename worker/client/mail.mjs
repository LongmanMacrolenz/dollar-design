// 거래 단계별 메일 문안·수주 체크리스트 화면 (/admin/mail.html). 문안은 mail-content.mjs, 화면 구조·복사 방식은 channel.mjs와 같다.
// 서버로 아무것도 보내지 않고, 수정 문구·체크 표시는 이 브라우저(localStorage)에만 둔다. 계좌번호·고객 정보는 입력하지 않는다.
import {GROUPS,FIELDS,CHECKLIST} from './mail-content.mjs';

const app=document.querySelector('#mail-app');
const STORAGE='bn-mail-copy-v1';
const ids=new Set(FIELDS.flatMap(f=>[f.id+'.subject',f.id+'.body']));
let values={},checked=[],group=GROUPS[0][0],persist=true,noticeTimer,saveTimer;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');if(saved&&saved.version===1){for(const [k,v] of Object.entries(saved.values||{}))if(ids.has(k)&&typeof v==='string'&&v.length<=20000)values[k]=v;checked=(Array.isArray(saved.checked)?saved.checked:[]).filter(id=>CHECKLIST.some(c=>c[0]===id));}}catch{persist=false;}
const field=id=>FIELDS.find(f=>f.id===id);
const val=(id,part)=>values[id+'.'+part]??field(id)[part];
function message(text){clearTimeout(noticeTimer);const el=document.querySelector('#notice');el.textContent=text;el.style.display='block';noticeTimer=setTimeout(()=>el.style.display='none',4500);}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,values,checked}));persist=true;}catch{persist=false;}}
const blanks=id=>(val(id,'subject')+val(id,'body')).match(/\[[^\]]*\]/g)?.length||0;
function fieldHTML(f){return `<article class="card channel-field" data-field="${f.id}"><label for="ms-${f.id}">${esc(f.title)}</label>
  <input id="ms-${f.id}" data-edit="${f.id}.subject" value="${esc(val(f.id,'subject'))}" spellcheck="false" maxlength="300" aria-label="${esc(f.title)} 제목">
  <textarea id="mb-${f.id}" data-edit="${f.id}.body" class="multiline" spellcheck="false" maxlength="20000" aria-label="${esc(f.title)} 본문">${esc(val(f.id,'body'))}</textarea>
  <div class="bar"><span class="channel-count" data-count="${f.id}">채울 칸 [ ] ${blanks(f.id)}개</span><div class="row-actions"><button type="button" data-reset="${f.id}">기본 문구</button><button type="button" data-copy-subject="${f.id}">제목 복사</button><button type="button" data-copy="${f.id}">본문 복사</button></div></div>
  ${f.note?`<p class="channel-note">${esc(f.note)}</p>`:''}</article>`;}
function render(){
  app.innerHTML=`<section class="channel-intro"><span class="channel-label">BOLTNOTE / CUSTOMER MAIL</span><h1>접수부터 세금계산서까지,<br>보낼 메일을 여기서 꺼내 쓰세요.</h1><p>단계별 문안을 고쳐서 복사한 뒤 메일 서비스에 붙여 넣습니다. 대괄호 [ ]는 보내기 전에 채웁니다.</p><p class="channel-warning">초안 도구입니다. 메일을 보내거나 고객 정보를 저장하지 않습니다. 계좌번호·고객 연락처는 이 화면에 적지 마세요.</p></section>
  <div class="channel-tools"><a class="button" href="/admin/">견적 관리</a><a class="button" href="/admin/channel.html">카카오 채널 자료</a><a class="button" href="/admin/landed.html">수입 원가 계산</a><a class="button" href="/brand/boltnote-intro.pdf">소개서 PDF</a><button type="button" data-action="export">전체 문안 내려받기</button></div>
  <p class="channel-local">${persist?'수정 문구와 체크 표시는 이 브라우저에만 저장됩니다.':'브라우저 저장을 사용할 수 없습니다. 전체 문안을 내려받아 보관해 주세요.'}</p>
  <details class="card channel-checklist" open><summary>수주 체크리스트 <span class="badge" id="check-progress">${checked.length} / ${CHECKLIST.length}</span></summary><p>한 건을 접수부터 마감까지 따라갑니다. 다음 건을 시작할 때 <b>새 건 시작</b>으로 표시를 지웁니다.</p><div class="channel-checks">${CHECKLIST.map(([id,text])=>`<label><input type="checkbox" data-check="${id}"${checked.includes(id)?' checked':''}>${esc(text)}</label>`).join('')}</div><div class="bar"><button type="button" data-action="new-order">새 건 시작 (체크 지우기)</button></div></details>
  <div class="channel-layout"><nav class="channel-nav" role="tablist" aria-label="거래 단계">${GROUPS.map(([id,title])=>`<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${id===group}" tabindex="${id===group?0:-1}" data-group="${id}">${title}</button>`).join('')}</nav><div>${GROUPS.map(([id,title,note])=>`<section class="channel-panel" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}"${id===group?'':' hidden'}><div class="bar"><h2>${title}</h2></div><p>${esc(note)}</p>${FIELDS.filter(f=>f.group===id).map(fieldHTML).join('')}</section>`).join('')}</div></div>
  <footer class="channel-footer">문안 규칙: 재고·납기·서류를 지어 약속하지 않습니다. 공급처 이름·매입 조건은 고객 메일에 쓰지 않습니다. 접수 확인은 메일을 실제로 읽은 뒤에만 보냅니다. 모르는 곳에는 동의 없이 광고 메일을 보내지 않고(전화로 먼저 묻습니다), 광고 문자는 보내지 않습니다.<div class="bar"><button type="button" data-action="clear">이 브라우저의 수정 문구 지우기</button></div></footer>`;
}
function allText(){return `볼트노트 거래 메일 문안\n\n`+GROUPS.map(([id,title])=>`## ${title}\n\n`+FIELDS.filter(f=>f.group===id).map(f=>`[${f.title}]\n제목: ${val(f.id,'subject')}\n\n${val(f.id,'body')}`).join('\n\n')).join('\n\n');}
async function copy(text){try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);message('복사했습니다. 메일에 붙여 넣고 [ ] 칸을 채우세요.');}catch{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();message(ok?'복사했습니다. 메일에 붙여 넣고 [ ] 칸을 채우세요.':'브라우저 복사가 제한됩니다. 문구를 선택해 복사하세요.');}}
function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function switchGroup(id,focus=false){group=id;for(const [name] of GROUPS){const tab=document.querySelector('#tab-'+name);tab.setAttribute('aria-selected',String(name===id));tab.tabIndex=name===id?0:-1;document.querySelector('#panel-'+name).hidden=name!==id;}if(focus)document.querySelector('#tab-'+id).focus();}
app.addEventListener('input',e=>{const k=e.target.dataset.edit;if(!ids.has(k))return;values[k]=e.target.value;const id=k.split('.')[0];document.querySelector(`[data-count="${id}"]`).textContent=`채울 칸 [ ] ${blanks(id)}개`;clearTimeout(saveTimer);saveTimer=setTimeout(save,250);});
app.addEventListener('change',e=>{const id=e.target.dataset.check;if(!CHECKLIST.some(c=>c[0]===id))return;checked=checked.filter(c=>c!==id);if(e.target.checked)checked.push(id);document.querySelector('#check-progress').textContent=`${checked.length} / ${CHECKLIST.length}`;save();});
app.addEventListener('keydown',e=>{if(!e.target.dataset.group)return;const keys=['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const i=GROUPS.findIndex(g=>g[0]===group),n=e.key==='Home'?0:e.key==='End'?GROUPS.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+GROUPS.length)%GROUPS.length;switchGroup(GROUPS[n][0],true);});
app.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
  if(b.dataset.group){switchGroup(b.dataset.group);return;}
  if(b.dataset.copy){save();await copy(val(b.dataset.copy,'body'));return;}
  if(b.dataset.copySubject){save();await copy(val(b.dataset.copySubject,'subject'));return;}
  if(b.dataset.reset){if(!confirm('이 문안을 기본 문구로 되돌릴까요?'))return;delete values[b.dataset.reset+'.subject'];delete values[b.dataset.reset+'.body'];save();render();return;}
  const action=b.dataset.action;
  if(action==='export'){save();download(allText(),'boltnote-mail-templates.txt');message('전체 문안을 내려받았습니다.');}
  if(action==='new-order'){if(!confirm('체크 표시를 모두 지우고 새 건을 시작할까요?'))return;checked=[];save();render();}
  if(action==='clear'){if(!confirm('이 브라우저의 수정 문구와 체크 표시를 지우고 기본 문안으로 돌아갈까요?'))return;clearTimeout(saveTimer);values={};checked=[];try{localStorage.removeItem(STORAGE);}catch{}render();message('기본 문안으로 돌아왔습니다.');}
}catch(err){message(err.message||'다시 시도해 주세요.');}});
addEventListener('pagehide',()=>{clearTimeout(saveTimer);save();});
render();
