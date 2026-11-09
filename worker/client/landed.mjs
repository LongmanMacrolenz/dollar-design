// 수입 원가 계산 화면 (/admin/landed.html). 계산은 landed-calc.mjs, 화면 구조·복사 방식은 mail.mjs와 같다.
// 서버로 아무것도 보내지 않는다. 입력값과 저장한 경우는 이 브라우저(localStorage)에만 둔다.
// 이 주소는 로그인 없이 열리므로 화면에는 숫자를 넣어 두지 않는다. 세율·환율·비용은 받은 견적과 관세사 확인값을 직접 넣는다.
import {NUMBERS,LOCAL_KEYS,STORE_VERSION,MAX_SCENARIOS,blankInput,cleanInput,cleanStore,landedCost,lotTable,shapeWeightKg,summaryText,won,pct,num} from './landed-calc.mjs';

const app=document.querySelector('#landed-app');
const STORAGE='bn-landed-cost-v1';
let input=blankInput(),scenarios=[],persist=true,noticeTimer,saveTimer;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{const store=cleanStore(JSON.parse(localStorage.getItem(STORAGE)||'null'));input=store.current;scenarios=store.scenarios;}catch{persist=false;}
function message(text){clearTimeout(noticeTimer);const el=document.querySelector('#notice');el.textContent=text;el.style.display='block';noticeTimer=setTimeout(()=>el.style.display='none',4500);}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({version:STORE_VERSION,current:input,scenarios}));persist=true;}catch{persist=false;}}
const numeric=new Set(NUMBERS.map(n=>n[0]));
const LOCAL_LABEL={arrival:'항구 도착 비용',broker:'통관 수수료',storage:'보관료',truck:'트럭 운송비',test:'시험·검사비',cut:'절단·가공비',other:'기타 비용'};

// [키, 이름, 도움말, 종류]. 종류: 없으면 숫자, 'text', 선택지 배열, 'check'
const GROUPS=[
  ['goods','1. 물건','공급처 견적서에서 옮겨 적습니다.',[
    ['name','무엇을, 어디서 (메모)','예: 봉재 견적 A안','text'],
    ['qty','수량','팔 때 세는 기준과 같은 단위로'],
    ['unit','단위','kg · 개 · 장 · 본','text'],
    ['priceBasis','가격 기준','견적서의 가격이 무엇에 대한 값인지',[['unit','단위 하나당 가격'],['kg','kg당 가격'],['total','전체 금액']]],
    ['price','가격 (외화)','견적서에 적힌 숫자 그대로'],
    ['currency','통화','USD 등. 표시용입니다.','text'],
    ['weightKg','총 무게 (kg)','kg당 가격일 때 필요합니다. 아래 무게 계산을 쓸 수 있습니다.'],
    ['fx','환율 (외화 1 = 몇 원)','돈을 보낼 때 적용되는 환율'],
    ['fxCustoms','과세환율 (선택)','관세사가 알려 주는 환율. 비우면 위 환율로 계산합니다.'],
    ['fxNote','환율 기준일·출처','예: 11/10 은행 고시','text'],
  ]],
  ['sea','2. 바다 건너오는 비용','포워더(운송 주선 업체) 견적서에서 옮겨 적습니다.',[
    ['freightIncluded','운임이 물건값에 들어 있습니다 (CIF·CFR 견적)','','check'],
    ['freight','해상 운임',''],
    ['insurance','보험료','없으면 비워 둡니다.'],
    ['freightCurrency','운임·보험료의 통화','',[['foreign','외화 (위 환율로 계산)'],['KRW','원화']]],
    ['freightScales','수량이 늘면 운임도 같이 늘어납니다 (소량 혼적 화물)','컨테이너 하나를 통째로 쓰면 표시하지 않습니다.','check'],
  ]],
  ['tax','3. 세금','관세사에게 품목번호로 확인한 값을 넣습니다. 대상이 아니면 0을 넣습니다.',[
    ['dutyPct','관세율 (%)','FTA 세율을 쓰려면 원산지증명서가 필요합니다.'],
    ['adPct','덤핑방지관세율 (%)','나라·품목·수출자에 따라 다릅니다.'],
  ]],
  ['local','4. 한국 도착 후 비용 (원, 부가세 별도)','이번 한 건에 드는 금액입니다. 없는 것은 비워 둡니다.',LOCAL_KEYS.map(k=>[k,LOCAL_LABEL[k],({arrival:'포워더가 청구하는 터미널·서류 비용',broker:'관세사 수수료',storage:'보세창고·임시 보관',truck:'항구에서 고객(또는 절단 업체)까지',test:'공인기관 시험 등',cut:'',other:''})[k]])],
  ['sell','5. 판매','부가세를 뺀 금액으로 적습니다.',[
    ['sellUnit','판매 단가 (원 / 단위)','고객에게 받을 값'],
    ['targetMarginPct','목표 이익률 (%) (선택)','판 값에서 남기고 싶은 비율'],
    ['markupPct','가산율 (%) (선택)','원가에 얹는 비율. 견적 관리 화면의 방식입니다.'],
  ]],
];
const SHAPES=[['round','환봉 (지름)'],['square','각봉 (한 변)'],['hex','육각봉 (맞변)'],['plate','판재 (두께 × 폭)']];
const SHAPE_FIELDS={round:[['wD','지름 (mm)']],square:[['wA','한 변 (mm)']],hex:[['wS','맞변 (mm)']],plate:[['wT','두께 (mm)'],['wW','폭 (mm)']]};

function fieldHTML([k,label,help,kind]){
  if(kind==='check')return `<label class="landed-check"><input type="checkbox" data-f="${k}"${input[k]?' checked':''}><span>${esc(label)}${help?`<small>${esc(help)}</small>`:''}</span></label>`;
  const control=Array.isArray(kind)?`<select data-f="${k}">${kind.map(([v,t])=>`<option value="${v}"${input[k]===v?' selected':''}>${esc(t)}</option>`).join('')}</select>`
    :`<input type="text" data-f="${k}" value="${esc(input[k])}" autocomplete="off" spellcheck="false"${kind==='text'?' maxlength="80"':' inputmode="decimal" maxlength="24"'}>`;
  return `<label>${esc(label)}${control}${help?`<small>${esc(help)}</small>`:''}</label>`;
}
function groupHTML([id,title,note,fields]){
  const checks=fields.filter(f=>f[3]==='check'),rest=fields.filter(f=>f[3]!=='check');
  return `<section class="card landed-group" id="g-${id}"><h2>${esc(title)}</h2><p>${esc(note)}</p>${checks.filter(f=>f[0]==='freightIncluded').map(fieldHTML).join('')}<div class="grid">${rest.map(fieldHTML).join('')}</div>${checks.filter(f=>f[0]!=='freightIncluded').map(fieldHTML).join('')}${id==='goods'?weightHTML():''}${id==='tax'?'<p class="muted">부가세 10%는 자동으로 계산합니다. 돌려받는 세금이라 원가에는 넣지 않고 준비할 현금에만 넣습니다 (일반과세자 기준).</p>':''}</section>`;
}
function weightHTML(){
  return `<details class="landed-weight"><summary>치수로 무게 계산하기</summary><div class="grid"><label>모양<select data-f="wShape">${SHAPES.map(([v,t])=>`<option value="${v}"${input.wShape===v?' selected':''}>${esc(t)}</option>`).join('')}</select></label><span id="shape-fields" class="landed-shape">${shapeFieldsHTML()}</span>${[['wL','길이 (mm)'],['wCount','개수'],['wDensity','밀도 (g/cm³)','재질 성적서나 규격의 값을 넣습니다.']].map(f=>fieldHTML(f)).join('')}</div><div class="bar"><b id="weight-out">${weightText()}</b><button type="button" data-action="use-weight">총 무게에 넣기</button></div></details>`;
}
const shapeFieldsHTML=()=>SHAPE_FIELDS[input.wShape].map(f=>fieldHTML(f)).join('');
function weightText(){const w=shapeWeightKg(input);return w==null?'치수·개수·밀도를 넣으면 무게가 나옵니다.':`약 ${(Math.round(w*10)/10).toLocaleString('ko-KR')} kg`;}

const row=(label,value,cls='')=>`<tr${cls?` class="${cls}"`:''}><th scope="row">${label}</th><td class="n">${value}</td></tr>`;
function resultHTML(){
  const r=landedCost(input);
  if(!r.ready)return `<h2>결과</h2><p class="empty" id="r-empty">${r.invalid.length?`숫자로 읽을 수 없는 칸이 있습니다: ${esc(r.invalid.join(', '))}`:`아직 빠진 값: ${esc(r.missing.join(', '))}. 넣으면 바로 계산합니다.`}</p>`;
  const unit=esc(r.unit||'단위'),lots=lotTable(input);
  const profit=r.profitKRW==null?'<span class="muted">판매 단가를 넣으세요</span>':`<span class="${r.profitKRW<0?'bad':'good'}">${won(r.profitKRW)}</span>`;
  return `<h2>결과</h2>
  <p class="landed-big"><span>단위 원가 (${unit} 하나당)</span><b class="amount" id="r-unit">${won(r.unitCostKRW)}</b></p>
  <dl class="landed-kv"><div><dt>총 원가</dt><dd id="r-cost">${won(r.costKRW)}</dd></div><div><dt>남는 금액</dt><dd id="r-profit">${profit}</dd></div><div><dt>이익률</dt><dd id="r-margin">${r.marginPct==null?'—':pct(r.marginPct)}</dd></div><div><dt>준비할 현금 (부가세 포함)</dt><dd id="r-cash">${won(r.cashKRW)}</dd></div></dl>
  <div class="table"><table><caption>원가가 이렇게 쌓입니다</caption><tbody>
    ${row('물건값',won(r.goodsKRW))}${row(input.freightIncluded?'운임·보험료 (물건값에 포함)':'해상 운임·보험료',won(r.freightKRW+r.insuranceKRW))}${row('관세',won(r.dutyKRW))}${row('덤핑방지관세',won(r.adDutyKRW))}${row('한국 도착 후 비용',won(r.localKRW))}${row('총 원가',`<b>${won(r.costKRW)}</b>`)}
    ${row('수입 부가세 (돌려받음)',won(r.importVatKRW),'muted')}${row('도착 후 비용 부가세 (돌려받음)',won(r.localVatKRW),'muted')}
  </tbody></table></div>
  ${r.priceForMarginKRW!=null||r.priceForMarkupKRW!=null?`<h3>이만큼 받아야 합니다</h3><ul class="landed-list">${r.priceForMarginKRW!=null?`<li>이익률 ${pct(num(input.targetMarginPct))}를 남기려면 <b id="r-price-margin">${won(r.priceForMarginKRW)}</b> / ${unit}</li>`:''}${r.priceForMarkupKRW!=null?`<li>가산율 ${pct(num(input.markupPct))}로 팔면 <b id="r-price-markup">${won(r.priceForMarkupKRW)}</b> / ${unit}</li>`:''}</ul>`:''}
  ${r.warnings.length?`<h3>확인할 것</h3><ul class="landed-list landed-warn" id="r-warnings">${r.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}
  <h3>수량이 달라지면</h3><div class="table"><table id="r-lots"><thead><tr><th scope="col">수량</th><th scope="col" class="n">단위 원가</th><th scope="col" class="n">남는 금액</th><th scope="col" class="n">준비할 현금</th></tr></thead><tbody>${lots.map(l=>`<tr${l.multiplier===1?' class="landed-now"':''}><th scope="row">${l.qty.toLocaleString('ko-KR')} ${unit}${l.multiplier===1?' (지금)':''}</th><td class="n">${won(l.unitCostKRW)}</td><td class="n">${l.profitKRW==null?'—':won(l.profitKRW)}</td><td class="n">${won(l.cashKRW)}</td></tr>`).join('')}</tbody></table></div>
  <p class="muted">단가는 수량과 상관없이 같고, 한국 도착 후 비용은 건당 그대로라고 가정한 값입니다.${input.freightScales?'':' 운임도 그대로라고 가정했습니다.'}</p>
  <h3>견적 관리 화면에 옮길 값</h3><p id="r-admin">통관 비용 <b>${won(r.adminImportCostKRW)}</b> · 운송비 <b>${won(r.adminShippingKRW)}</b><br><span class="muted">물건값 + 통관 비용 + 운송비 = 총 원가가 되도록 나눈 값입니다.</span></p>`;
}
// 입력하는 동안 화면 위에 따라오는 요약 줄. 자세한 결과는 아래 "결과" 상자에 있다 (화면 낭독은 그쪽을 읽는다).
function barHTML(){
  const r=landedCost(input);
  if(!r.ready)return '<span class="landed-bar-empty">수량·가격·환율을 넣으면 결과가 여기에 따라옵니다.</span>';
  const item=(label,value,cls='')=>`<span><small>${label}</small><b${cls?` class="${cls}"`:''}>${value}</b></span>`;
  return item(`단위 원가${r.unit?' / '+esc(r.unit):''}`,won(r.unitCostKRW))+item('남는 금액',r.profitKRW==null?'—':won(r.profitKRW),r.profitKRW==null?'':r.profitKRW<0?'bad':'good')+item('이익률',r.marginPct==null?'—':pct(r.marginPct))+item('준비할 현금',won(r.cashKRW));
}
function scenariosHTML(){
  return `<h2>저장한 경우 비교</h2><p>지금 입력한 값을 이름 붙여 저장해 두고 나란히 비교합니다. 예: 수입 / 국내 사입.</p>
  <div class="bar"><label class="landed-name">이름<input type="text" id="sc-name" maxlength="60" autocomplete="off" value="${esc(input.name)}"></label><button type="button" data-action="save-scenario">지금 값 저장</button></div>
  ${scenarios.length?`<div class="table"><table id="sc-table"><thead><tr><th scope="col">이름</th><th scope="col" class="n">단위 원가</th><th scope="col" class="n">남는 금액</th><th scope="col" class="n">이익률</th><th scope="col"></th></tr></thead><tbody>${scenarios.map((s,i)=>{const r=landedCost(s.input);return `<tr><th scope="row">${esc(s.name)}</th><td class="n">${r.ready?won(r.unitCostKRW)+(r.unit?' / '+esc(r.unit):''):'—'}</td><td class="n">${r.ready&&r.profitKRW!=null?won(r.profitKRW):'—'}</td><td class="n">${r.ready&&r.marginPct!=null?pct(r.marginPct):'—'}</td><td><div class="row-actions"><button type="button" data-load="${i}">불러오기</button><button type="button" data-delete="${i}">삭제</button></div></td></tr>`;}).join('')}</tbody></table></div>`:'<p class="empty">아직 저장한 경우가 없습니다.</p>'}`;
}
function render(){
  app.innerHTML=`<section class="channel-intro"><span class="channel-label">BOLTNOTE / LANDED COST</span><h1>들여오면 얼마가 드는지,<br>먼저 계산합니다.</h1><p>받은 견적의 숫자를 넣으면 단위 원가, 남는 금액, 준비할 현금이 나옵니다. 주문을 받기 전에 손해가 아닌지 확인하는 용도입니다.</p><p class="channel-warning">어림 계산 도구입니다. 아무것도 서버로 보내지 않습니다. 세율·환율은 관세사와 은행에서 확인한 값을 넣으세요. 실제 세액과 비용은 청구서로 확인합니다.</p></section>
  <div class="channel-tools"><a class="button" href="/admin/">견적 관리</a><a class="button" href="/admin/mail.html">메일 문안</a><button type="button" data-action="copy">결과 복사</button><button type="button" data-action="export">결과 내려받기</button><button type="button" data-action="practice">연습용 숫자 넣기</button></div>
  <p class="channel-local">${persist?'입력한 값과 저장한 경우는 이 브라우저에만 저장됩니다.':'브라우저 저장을 사용할 수 없습니다. 결과를 내려받아 보관해 주세요.'}</p>
  <div class="landed-bar" id="landed-bar" aria-hidden="true">${barHTML()}</div>
  <div class="landed-layout"><div>${GROUPS.map(groupHTML).join('')}</div><div class="landed-side"><section class="card landed-result" id="landed-result" aria-live="polite">${resultHTML()}</section><section class="card" id="landed-scenarios">${scenariosHTML()}</section></div></div>
  <footer class="channel-footer">이 화면의 주소는 로그인 없이 열립니다. 그래서 화면에는 어떤 숫자도 들어 있지 않고, 입력한 값은 이 기기에만 남습니다. 공용 컴퓨터에서 썼다면 아래 버튼으로 지우세요.<div class="bar"><button type="button" data-action="clear">이 브라우저에 저장된 값 모두 지우기</button></div></footer>`;
}
const refresh=()=>{document.querySelector('#landed-result').innerHTML=resultHTML();document.querySelector('#landed-bar').innerHTML=barHTML();document.querySelector('#weight-out').textContent=weightText();};
function set(k,value){input[k]=value;refresh();clearTimeout(saveTimer);saveTimer=setTimeout(save,250);}
async function copy(text){try{if(!navigator.clipboard?.writeText)throw Error('clipboard');await navigator.clipboard.writeText(text);message('결과를 복사했습니다.');}catch{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;top:0;left:0;opacity:0';document.body.append(ta);ta.select();const ok=document.execCommand('copy');ta.remove();message(ok?'결과를 복사했습니다.':'브라우저 복사가 제한됩니다. 결과를 내려받아 주세요.');}}
function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

app.addEventListener('input',e=>{
  const k=e.target.dataset.f;if(!k||!(k in input))return;
  if(e.target.type==='checkbox'){set(k,e.target.checked);return;}
  if(e.target.tagName==='SELECT')return;
  set(k,e.target.value);
  if(k==='name'){const name=document.querySelector('#sc-name');if(name)name.value=e.target.value;}
});
app.addEventListener('change',e=>{
  const k=e.target.dataset.f;if(!k||e.target.tagName!=='SELECT')return;
  set(k,cleanInput({[k]:e.target.value})[k]);
  if(k==='wShape'){document.querySelector('#shape-fields').innerHTML=shapeFieldsHTML();refresh();}
});
app.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
  const action=b.dataset.action;
  if(action==='use-weight'){const w=shapeWeightKg(input);if(w==null){message('치수·개수·밀도를 먼저 넣어 주세요.');return;}const text=String(Math.round(w*1000)/1000);document.querySelector('[data-f="weightKg"]').value=text;set('weightKg',text);message('총 무게에 넣었습니다.');return;}
  if(action==='copy'){save();await copy(summaryText(input));return;}
  if(action==='export'){save();download(summaryText(input),'boltnote-landed-cost.txt');message('결과를 내려받았습니다.');return;}
  if(action==='practice'){if(Object.entries(input).some(([k,v])=>numeric.has(k)&&v!=='')&&!confirm('지금 입력한 값을 연습용 숫자로 바꿀까요?'))return;
    input={...blankInput(),name:'연습용 숫자 (실제 시세 아님)',qty:'1000',unit:'kg',price:'1',currency:'USD',fx:'1000',fxNote:'연습용',freight:'100',insurance:'10',dutyPct:'10',adPct:'0',arrival:'100000',broker:'50000',truck:'150000',sellUnit:'2000',targetMarginPct:'20',markupPct:'20'};
    save();render();message('연습용 숫자를 넣었습니다. 실제 시세가 아닙니다.');return;}
  if(action==='save-scenario'){const name=document.querySelector('#sc-name').value.trim().slice(0,60);if(!name){message('저장할 이름을 적어 주세요.');return;}
    const at=scenarios.findIndex(s=>s.name===name);if(at<0&&scenarios.length>=MAX_SCENARIOS){message(`저장은 ${MAX_SCENARIOS}개까지입니다. 쓰지 않는 것을 지워 주세요.`);return;}
    const entry={name,input:cleanInput(input)};if(at<0)scenarios.push(entry);else scenarios[at]=entry;save();document.querySelector('#landed-scenarios').innerHTML=scenariosHTML();message(at<0?'저장했습니다.':'같은 이름의 값을 바꿔 저장했습니다.');return;}
  if(b.dataset.load){const s=scenarios[Number(b.dataset.load)];if(!s)return;input=cleanInput(s.input);save();render();message(`「${s.name}」을(를) 불러왔습니다.`);return;}
  if(b.dataset.delete){const i=Number(b.dataset.delete),s=scenarios[i];if(!s||!confirm(`「${s.name}」을(를) 지울까요?`))return;scenarios.splice(i,1);save();document.querySelector('#landed-scenarios').innerHTML=scenariosHTML();return;}
  if(action==='clear'){if(!confirm('이 브라우저에 저장된 입력값과 저장한 경우를 모두 지울까요?'))return;clearTimeout(saveTimer);input=blankInput();scenarios=[];try{localStorage.removeItem(STORAGE);}catch{}render();message('모두 지웠습니다.');}
}catch(err){message(err.message||'다시 시도해 주세요.');}});
addEventListener('pagehide',()=>{clearTimeout(saveTimer);save();});
render();
