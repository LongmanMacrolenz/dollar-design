/* 소재 문의 화면 (#materials, 대표 결정 2026-11-10). 심·봉재·판재·단조재는 카탈로그 품목이 아니라 "문의만 받는" 입구다.
   - 재고·가격·납기·서류 제공을 약속하지 않는다. 등급·두께 범위·원산지도 적지 않는다 (AGENTS.md §3·§4).
   - 카드 버튼은 견적 문의 화면(#list)의 메모에 문안을 채워 준다. 손님이 이미 적어 둔 메모는 지우지 않고 뒤에 덧붙인다.
   - 메모가 있으면 기본 본문 전체가 메모로 바뀌므로(v9_sales.js), 문안에 요청사항·담당자·연락처 줄을 직접 넣는다.
   - 목록 분석기는 체결부품만 읽는다 (PLATE·SHAFT 줄은 "공급 불가"로 표시됨, e3_parse.js). 소재는 이 화면의 문안으로 받는다.
   이 파일은 v9_sales.js보다 먼저 붙으므로 salesDraft는 클릭 처리 안에서만 쓴다. */
Object.assign(SHEETS, { materials: ['L', '소재 문의'] });
const MATERIAL_INQ = [
  { id: 'shim', ko: '심', en: 'Shim', d: '틈을 메우고 높이를 맞추는 얇은 판입니다.', ask: ['재질', '두께', '크기 또는 도면', '수량'],
    lines: ['재질: [모르면 사용 조건을 적어 주세요]', '두께: [ ]', '크기 또는 도면: [ ]', '수량: [ ]'] },
  { id: 'bar', ko: '봉재', en: 'Bar stock', d: '가공하기 전의 둥근·각·육각 막대입니다.', ask: ['재질 규격', '단면 모양과 치수', '길이(절단 길이)', '수량', '열처리 상태'],
    lines: ['재질 규격: [ ]', '단면 모양과 치수: [둥근·각·육각 / 치수]', '길이(절단 길이): [ ]', '수량: [ ]', '열처리 상태: [정해진 경우만]'] },
  { id: 'plate', ko: '판재', en: 'Plate', d: '필요한 크기로 잘라 쓰는 금속판입니다.', ask: ['재질 규격', '두께', '폭 × 길이(절단 치수)', '수량'],
    lines: ['재질 규격: [ ]', '두께: [ ]', '폭 × 길이(절단 치수): [ ]', '수량: [ ]'] },
  { id: 'forged', ko: '단조재', en: 'Forged bar · plate', d: '두드려 성형한 봉·판 형태의 소재입니다.', ask: ['재질 규격', '치수 또는 도면', '열처리·검사 요구', '수량'],
    lines: ['재질 규격: [ ]', '치수 또는 도면: [ ]', '열처리·검사 요구: [ ]', '수량: [ ]'] },
];
const materialMemo = m => [`${m.ko}(${m.en}) 견적을 요청드립니다.`, '', ...m.lines, '필요한 서류: [성적서 필요 여부 등]', '사용처·조건: [ ]', '',
  '요청사항: 단가, 공급 가능 수량, 납기, 서류 제공 범위', '희망 시점: [정해진 경우만 적어 주세요]', '회사 / 담당자: [회사명 / 성함]', '회신 연락처: [이메일 또는 전화번호]'].join('\n');
// 제품 화면 맨 아래의 안내 상자 (거르기를 눌러도 다시 그려지지 않는 자리에 둔다)
const materialsEntry = () => `<div class="ia-box blue mat-entry"><p><b>소재도 문의할 수 있습니다.</b> 심(Shim)·봉재(Bar stock)·판재(Plate)·단조재는 카탈로그 품목이 아닙니다. 사양을 받아 공급처를 확인한 뒤 회신합니다. 재고·납기·공급 보장을 뜻하지 않습니다.</p><div class="actions"><a class="btn pri" href="#materials" data-go="materials">소재 문의 →</a></div></div>`;
V.materials = () => iaPage(iaHead([['Sales · 견적 문의', 'list'], ['소재 문의']], '소재 문의', 'Materials',
  '심·봉재·판재·단조재, 사양만 알려 주세요. 볼트노트는 소재를 쌓아 두고 팔지 않습니다. 보내 주신 사양으로 공급처를 확인한 뒤, 가능 여부와 조건을 견적으로 회신합니다.')
  + `<h2 class="sr">문의할 수 있는 소재</h2><div class="purchase-scope-grid mat-grid">${MATERIAL_INQ.map(m => `<article><span class="purchase-badge" lang="en">${esc(m.en)}</span><h3>${esc(m.ko)}</h3><p>${esc(m.d)}</p><p class="mat-ask-t">적어 주실 것</p><ul class="mat-ask">${m.ask.map(a => `<li>${esc(a)}</li>`).join('')}</ul><button type="button" class="btn pri" data-material-inquiry="${m.id}" data-purchase-event="start">${esc(m.ko)} 문의 문안 만들기 →</button></article>`).join('')}</div>
  <p class="purchase-note">필요한 서류와 사용 조건, 희망 시점을 함께 적어 주세요. 성적서가 필요하면 규격 사전의 <a href="#lib-t-mtr" data-go="lib-t-mtr">밀시트(MTR)</a>, <a href="#lib-t-en10204-types" data-go="lib-t-en10204-types">성적서 종류 2.1·2.2·3.1·3.2</a>, <a href="#lib-t-heat-lot" data-go="lib-t-heat-lot">히트 번호·로트 추적</a>을 먼저 읽어 보세요.</p>
  <div class="ia-box blue"><p><b>약속하지 않는 것.</b> 단가·납기·서류 제공 범위는 공급처 확인 뒤 견적서에 적습니다. 재고·납기·공급을 보장하는 안내가 아닙니다.</p><p>목록 분석 기능은 체결부품만 읽습니다. 소재는 이 화면의 문안으로 보내 주세요.</p><div class="actions"><a class="btn" href="#list" data-go="list">견적 문의 화면으로 →</a></div></div>`);
INDEX.push({ t: '소재 문의', s: '심 · 봉재 · 판재 · 단조재 — 사양을 받아 공급처를 확인', k: '소재 문의 원소재 심 shim 심플레이트 라이너 봉재 환봉 각봉 육각봉 bar stock round bar 판재 철판 plate 단조재 단조 forged forging material', go: 'materials', g: '도구·안내' });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-material-inquiry]'), m = b && MATERIAL_INQ.find(x => x.id === b.dataset.materialInquiry);
  if (!m) return;
  const memo = salesDraft.memo.trim(), text = materialMemo(m);
  if (!memo || MATERIAL_INQ.some(x => materialMemo(x) === memo)) { state.listPrefill = text; state.listTopic = '소재'; }   // 비었거나 손대지 않은 문안이면 바꾼다
  else if (!memo.includes(text)) state.listPrefill = memo + '\n\n' + text;   // 적어 둔 메모는 지우지 않고 덧붙인다. 제목의 주제는 그대로 둔다
  go('list');
});
