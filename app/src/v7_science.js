/* Engineering explanations beside the original film. These are schematic
   animations, not FEA, measured S-N curves, or salt-spray hour predictions.
   Numerical strength/envelope references reuse the reviewed library data. */
const BN_SCIENCE_MATERIALS = [
  {id:'8.8',name:'탄소·합금강 / 8.8',strength:800,basis:'공칭 인장강도 · ISO 강도 구분의 의미',source:'lib-pc-steel'},
  {id:'10.9',name:'탄소·합금강 / 10.9',strength:1000,basis:'공칭 인장강도 · ISO 강도 구분의 의미',source:'lib-pc-steel'},
  {id:'A4-80',name:'스테인리스 / A4-80',strength:800,basis:'최소 인장강도 · ISO 3506-1',source:'lib-pc-a2-a4'}
];
const BN_SCIENCE_ENV = [
  {name:'건조 실내',at:36.1,still:37.7,desc:'수분 노출이 적은 조건을 표현합니다. 검정색이라는 이유만으로 흑착색인지 판단할 수는 없습니다.'},
  {name:'습윤·결로',at:38.1,still:39.7,desc:'습윤 노출과 보호층 결함을 표현합니다. 흑착색은 방청유·실링 유지 여부를, 아연계는 백청과 기재의 적청을 구분해 확인합니다.'},
  {name:'염분 노출',at:40.1,still:41.7,desc:'염분과 보호층 결함을 표현합니다. 해안·비말 환경은 코팅 계통·두께·전처리·손상과 실제 노출 조건을 함께 검토합니다.'}
];
let bnScienceState={threadClass:'2',material:'8.8'};
function bnSciencePanel() {
  return `<div class="bn-science" id="bn-science"><div class="bn-science-heading"><span lang="en">ENGINEERING VIEW</span><span id="bn-science-kind">개념 시각화</span></div><div id="bn-science-content"></div></div>`;
}
const bnScienceSVG = (label,inside) => `<div class="bn-science-diagram" tabindex="0" aria-label="${esc(label)} 상세 그림"><svg viewBox="0 0 480 150" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${inside}</svg></div><span class="bn-diagram-hint">↔ 상세 그림은 좌우로 이동해 보세요.</span>`;
function bnScienceSmooth(t,a,b) { const q=Math.max(0,Math.min(1,(t-a)/(b-a)));return q*q*(3-2*q); }
function bnScienceFatigueLoad(t) {
  if(t<.7 || t>=5.3) return 0;
  return bnScienceSmooth(t,.7,1.2)*(1-bnScienceSmooth(t,4.8,5.3))*(.20+.12*Math.sin(2*Math.PI*(t-.7)/.6));
}
function bnScienceCyclicPath() {
  return Array.from({length:145},(_,i)=>{const t=i/24;return `${i?'L':'M'}${(31+t/6*192).toFixed(2)} ${(126-bnScienceFatigueLoad(t)*180).toFixed(2)}`;}).join(' ');
}
function bnScienceContent(index) {
  const mat=BN_SCIENCE_MATERIALS.find(m=>m.id===bnScienceState.material)||BN_SCIENCE_MATERIALS[0];
  const select=`<label class="bn-science-select">재질·등급 <select id="bn-science-material">${BN_SCIENCE_MATERIALS.map(m=>`<option value="${m.id}"${m.id===mat.id?' selected':''}>${m.name}</option>`).join('')}</select></label>`;
  if(index===0) return `<div class="bn-science-drawing"><span>01 / 2D DRAWING</span><i aria-hidden="true">→</i><span>02 / SOLID GEOMETRY</span><i aria-hidden="true">→</i><span>03 / PURCHASE SPEC</span></div><p>도면의 형상에 깊이를 더합니다. 볼트·너트·와셔·키의 규격, 재질, 표면처리는 별도로 지정합니다.</p>`;
  if(index===1) {
    const c=bnScienceState.threadClass;
    return `<div class="bn-science-controls"><div class="bn-science-segments" role="group" aria-label="인치 나사 공차 등급">${['1','2','3'].map(n=>`<button type="button" data-bn-class="${n}" aria-pressed="${n===c}">${n}A / ${n}B</button>`).join('')}</div><span class="bn-science-chip">A 수나사 · B 암나사</span></div>${bnScienceSVG('나사 등급별 유효지름 공차대 개념도',`<line x1="236" y1="22" x2="236" y2="125" class="bn-sv-datum"/><text x="245" y="20">기본 유효지름</text><text x="14" y="57">${c}A</text><rect id="bn-tolerance-a" x="100" y="37" width="108" height="28" rx="2" class="bn-sv-orange"/><text x="14" y="110">${c}B</text><rect id="bn-tolerance-b" x="236" y="90" width="108" height="28" rx="2" class="bn-sv-blue"/><text x="310" y="57" id="bn-thread-allowance">수나사 여유 있음</text>`)}<div class="bn-science-pair"><b>3/4″-10 UNC</b><b>3/4″-16 UNF</b></div><p id="bn-thread-note">공차대 폭과 여유는 설명을 위해 과장했습니다. 실제 한계치·물림 길이·도금 후 치수는 적용 규격과 게이지로 확인합니다.</p><p class="bn-science-status">2A 참조 예 · 3/4″-10 UNC 도금 전 외경 상한 0.7482″<br>기본 0.7500″와의 차이 0.0018″ = 45.72 µm</p><p>이 값은 2A 외경 상한의 예이며 공차대 전체 폭이 아닙니다. 실제 유효지름·리드·도금 후 치수는 별도로 확인합니다.</p>`;
  }
  if(index===2) return `${bnScienceSVG('일반 육각과 헤비 육각의 형상 확인 기준',`<text x="34" y="28">일반 육각</text><text x="270" y="28">헤비 육각 / 3/4″</text><path d="M43 59 H133 V106 H43 Z" class="bn-sv-outline"/><path d="M279 43 H395 V106 H279 Z" class="bn-sv-outline bn-sv-heavy"/><path d="M408 43 V106 M404 43 H415 M404 106 H415" class="bn-sv-datum"/><text x="20" y="138">높이: 적용 규격 확인</text><text x="253" y="138">호칭 높이 0.734″ ≈ 18.64 mm</text>`)}<p>헤비는 2면폭과 높이를 함께 확인합니다. 오른쪽은 RCSC 2025 구조용 헤비너트의 호칭 형상 예입니다. 일반 너트 높이는 개념도로, 실제 치수 비교값이 아닙니다. 플랜트용은 지정 치수 규격을 별도로 확인합니다.</p>`;
  if(index===3) return `${select}<div class="bn-science-charts">${bnScienceSVG('응력과 변형률: 탄성 영역의 하중 및 제거',`<path d="M32 20 V126 H235" class="bn-sv-axis"/><text x="36" y="15">응력 · 개념</text><text x="175" y="145">변형률</text><path d="M32 126 L157 34" class="bn-sv-line"/><path d="M157 34 L207 12" class="bn-sv-unknown"/><circle id="bn-elastic-dot" cx="32" cy="126" r="6" class="bn-sv-orange"/><text x="165" y="51">선형 영역 밖은</text><text x="165" y="68">표현하지 않습니다</text><text x="280" y="22">인장강도 기준값</text><rect x="281" y="52" width="${mat.strength/7}" height="25" rx="2" class="bn-sv-orange"/><text x="280" y="103">${mat.id} · ${mat.strength.toLocaleString()} MPa</text><text x="280" y="127">${mat.id==='A4-80'?'최소값':'공칭값'} / 시험 결과 아님</text>`)}<p>${mat.basis}. 공칭값과 최소값은 같은 판정 기준이 아닙니다. 강도 구분만으로 재질이나 실제 탄성 한도를 확정하지 않습니다.</p></div><p id="bn-elastic-status" class="bn-science-status">무하중 · 원래 형상</p><p>변형을 크게 표현한 탄성 개념도입니다. 인장강도·0.2% 내력을 탄성 한도와 동일하게 취급하지 않으며, 실제 시험곡선은 성적서로 확인합니다.</p>`;
  if(index===4) return `${select}${bnScienceSVG('반복 하중과 S-N 피로 시험곡선 개념',`<path d="M30 20 V126 H231 M273 20 V126 H461" class="bn-sv-axis"/><text x="31" y="15">반복 인장하중</text><path d="${bnScienceCyclicPath()}" class="bn-sv-line"/><circle id="bn-fatigue-dot" cx="31" cy="91" r="5" class="bn-sv-orange"/><text x="163" y="146">시간 · 개념</text><text x="275" y="15">응력 진폭 · 개념</text><path d="M281 39 Q340 97 449 109" class="bn-sv-unknown"/><text x="301" y="66">S–N 곡선: 시험자료 필요</text><text x="328" y="146">반복 횟수 · log N</text>`)}<p>${esc(mat.name)}도 인장강도만으로 피로한도를 정할 수 없습니다. 평균응력·나사 골·전조·예압·굽힘·환경을 함께 봅니다. 점선은 개념도이며 등급별 측정곡선이나 수명 보장이 아닙니다.</p><p class="bn-science-status">균열·파괴 없이 반복 변형 후 복귀</p><p>이번 장면은 제한된 반복하중의 표현입니다. 탄성 범위 안의 하중도 반복되면 피로 손상을 일으킬 수 있습니다.</p>`;
  if(index===5) return `${bnScienceSVG('경도 시험: 별도 시편에 압흔을 남겨 측정',`<path d="M36 101 H239 V124 H36 Z" class="bn-sv-outline"/><path d="M132 20 V55 L114 65 L150 65 L132 55" class="bn-sv-line"/><path d="M36 101 H120 Q132 121 144 101 H239" class="bn-sv-unknown"/><text x="270" y="40">별도 시편</text><text x="270" y="66">압입 → 제거 → 압흔 확인</text><text x="270" y="97">척도·시험력·측정 위치 확인</text>`)}<p>볼트 옆 별도 시편에 압입합니다. 실제 경도시험은 국부적인 영구 압흔을 이용하므로, 압입자를 뺀 뒤에도 시편의 자국은 남습니다. 볼트 자체의 탄성 복귀 장면과 구분했습니다.</p><p class="bn-science-status">HRC · HBW · HV — 규격이 정한 방법으로 판정</p>`;
  return `<div class="bn-science-controls"><label class="bn-science-select">노출 환경 <select id="bn-science-environment">${BN_SCIENCE_ENV.map((e,i)=>`<option value="${i}">${e.name}</option>`).join('')}</select></label><span class="bn-science-chip" id="bn-exposure-label">건조 실내</span></div><div class="bn-coating-key"><span><i class="bare"></i>무코팅</span><span><i class="blue"></i>파랑</span><span><i class="white"></i>하양</span><span><i class="black"></i>검정</span></div><p id="bn-coating-environment-note"></p><p class="bn-science-status">시간 압축 개념도 · 실사용 기간 및 부식률 아님</p><p>세 색은 보호층의 시각적 구분입니다. 같은 부식 진행을 적용해 색상별 성능 순위를 만들지 않았습니다. 손상·수분 노출에 따른 기재 부식 원리를 보여줍니다.</p><details class="bn-science-details"><summary>실제 코팅을 고를 때 확인할 것</summary><dl><dt>파란색의 예: PTFE계 상도</dt><dd>색만으로 PTFE를 식별하지 않습니다. 전처리·하도·두께·밀착·마찰 특성·온도와 화학 환경을 함께 지정합니다.</dd><dt>백색·은색의 예: 아연계</dt><dd>전기아연·용융아연·아연플레이크를 구분합니다. 희생 보호, 백청·적청 기준, 도금 두께와 나사 맞춤을 확인합니다.</dd><dt>검정색의 예: 흑착색 + 방청유</dt><dd>검정 아연계나 다른 코팅일 수도 있습니다. 흑착색은 방청유·실링 상태를 확인하고, 색만으로 해안 환경 적합성을 정하지 않습니다.</dd></dl><p>염수분무 시간은 실제 옥외 수명으로 환산하지 않습니다. 코팅 사양·시험 방법·판정 기준·시험성적서를 비교합니다.</p></details>`;
}
function bnScienceUpdate(root,index,time) {
  const panel=root.querySelector('#bn-science-content');
  if(panel.dataset.chapter!==String(index)) {
    panel.dataset.chapter=String(index);panel.innerHTML=bnScienceContent(index);
  }
  const local=Math.max(0,time-BN_FILM_CHAPTERS[index].start);
  const smooth=(t,a,b)=>{const q=Math.max(0,Math.min(1,(t-a)/(b-a)));return q*q*(3-2*q);};
  if(index===1) {
    const c=bnScienceState.threadClass;
    const widths={1:136,2:98,3:58};const width=widths[c],end=c==='3'?236:211;
    const ext=panel.querySelector('#bn-tolerance-a');ext.setAttribute('x',end-width);ext.setAttribute('width',width);
    panel.querySelector('#bn-tolerance-b').setAttribute('width',width);
    panel.querySelector('#bn-thread-allowance').textContent=c==='3'?'3A 여유 없음':'1A·2A: 같은 여유';
    panel.querySelector('#bn-thread-note').textContent=`${c==='1'?'1등급은 넓은 공차대':c==='2'?'2등급은 일반 체결용':'3등급은 좁은 공차대'}를 보여줍니다. 폭·틈은 과장한 개념도입니다. B1.1의 일반 등급은 A(수)·B(암)이며 C는 없습니다. 실제 한계치·도금 후 치수는 규격과 게이지로 확인합니다.`;
  }
  if(index===3) {
    const load=.65*(smooth(local,.7,2.8)-smooth(local,3.4,5.3));
    const dot=panel.querySelector('#bn-elastic-dot');dot.setAttribute('cx',32+load*156);dot.setAttribute('cy',126-load*115);
    panel.querySelector('#bn-elastic-status').textContent=load<.001?'무하중 · 원래 형상':local<3.4?'탄성 영역의 하중 증가 · 변형 확대 표현':'하중 제거 · 원래 형상으로 복귀';
  }
  if(index===4) {
    const dot=panel.querySelector('#bn-fatigue-dot');dot.setAttribute('cx',31+Math.min(6,local)/6*192);dot.setAttribute('cy',126-bnScienceFatigueLoad(local)*180);
  }
  if(index===6) {
    const env=Math.min(2,Math.floor(local/2));
    panel.querySelector('#bn-science-environment').value=String(env);
    panel.querySelector('#bn-exposure-label').textContent=BN_SCIENCE_ENV[env].name;
    panel.querySelector('#bn-coating-environment-note').textContent=BN_SCIENCE_ENV[env].desc;
  }
}
