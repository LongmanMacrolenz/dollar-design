import {escapeHTML as h} from './security.mjs';
import {businessTime} from './dates.mjs';
import {MAIL_ACCOUNT} from './mail.mjs';
import {requirementsFor,workflowFor} from './workflow.mjs';
export const BUSINESS={name:'볼트노트',owner:'박세중',number:'456-19-02858',email:MAIL_ACCOUNT};
const won=n=>Number(n).toLocaleString('ko-KR')+'원';
export function quoteMessage(q) {
  const heading=`[${q.number}] ${q.customerName||'고객'}님 견적서`;
  const plain=[heading,'',...q.lines.map(l=>`${l.no}. ${l.description} / ${l.spec} / ${l.qty} ${l.unit} / 단가 ${won(l.unitPriceKRW)} / 금액 ${won(l.amountKRW)} / 납기 ${l.leadDays}일 / 서류 ${l.documents||'확인된 별도 서류 없음'}`),'',`공급가액 ${won(q.netKRW)}`,`부가세 ${won(q.vatKRW)}`,`합계 ${won(q.totalKRW)}`,`유효기간 ${businessTime(q.validUntil)}`,q.terms,'',`${BUSINESS.name} · ${BUSINESS.owner} · 사업자등록번호 ${BUSINESS.number}`,MAIL_ACCOUNT].join('\n');
  const html=`<h1>${h(heading)}</h1><table border="1" cellpadding="8" cellspacing="0"><thead><tr>${['품목·사양','수량','단가','금액','납기·서류'].map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${q.lines.map(l=>`<tr><td>${h(l.description)}<br>${h(l.spec)}</td><td>${l.qty} ${h(l.unit)}</td><td>${won(l.unitPriceKRW)}</td><td>${won(l.amountKRW)}</td><td>${l.leadDays}일<br>${h(l.documents)}</td></tr>`).join('')}</tbody></table><p>공급가액 ${won(q.netKRW)} · 부가세 ${won(q.vatKRW)} · 합계 <strong>${won(q.totalKRW)}</strong></p><p>유효기간 ${h(businessTime(q.validUntil))}</p><p>${h(q.terms).replace(/\n/g,'<br>')}</p><p>${BUSINESS.name} · ${BUSINESS.owner} · ${BUSINESS.number}<br>${MAIL_ACCOUNT}</p>`;
  return {subject:heading,plain,html};
}
export function inquiryMessage(request,supplier) {
  const subject=`[${request.number}] 공급 가능 여부·매입 견적 문의`;
  const plain=[`${supplier.name} 담당자님께`,'아래 품목의 공급 가능 여부와 매입 조건을 확인 부탁드립니다.','',...request.lines.map(l=>`${l.sourceNo||l.no}. ${l.description}\n사양: ${l.spec}\n수량: ${l.qty} ${l.unit}\n필요 서류: ${l.requiredDocs||'별도 요청 없음'}\n미확인 사양: ${l.unresolved||'없음'}\n${requirementsFor(l,request).map(r=>`[${r.id}] ${r.label}: ${r.required}\n→ 제시값 / 준수·차이 / 근거 문서·페이지를 항목별로 회신해 주세요.`).join('\n')}`),'','C&D · 공급처 확인 요청',...workflowFor(request).rows.filter(r=>r.type!=='OK').map(r=>`${r.type} | BOM ${r.no} | ${r.id} | ${r.reason}`),'','품번, 규격·호칭·피치·길이·재질/등급·표면처리 일치 여부, 개당/포장당 단가와 통화, 포장 수량, 최소 주문량, 공급 가능 수량, 납기, 견적 유효기간, 제공 가능한 서류, 운송비와 통관 비용(해외)을 회신 부탁드립니다.','조건이 다른 대체품은 차이를 명시해 주세요. 편차는 고객 서면 승인 전 채택하지 않습니다. 제조사 시험성적서의 실제 로트·품번·시험 항목과 납품품의 연결 근거를 요청합니다.','',`${BUSINESS.name} · ${BUSINESS.owner}`,MAIL_ACCOUNT].join('\n');
  return {subject,plain,html:`<pre style="white-space:pre-wrap;font-family:sans-serif">${h(plain)}</pre>`};
}
