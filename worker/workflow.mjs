import {bomRows,roleOf} from './bom_rows.mjs';
import {DomainError,text} from './domain.mjs';

export const REQUIREMENT_LABELS={standard:'제품·재질 규격',diameter:'호칭',thread:'나사 계열·피치·공차',length:'길이·길이 기준',grade:'재질·등급',finish:'표면처리',documents:'서류',special:'특수요건',drawing:'도면·개정',manufacturerPartNo:'지정 제조사 품번',unit:'거래 단위'};
const normalize=v=>String(v??'').normalize('NFKC').toUpperCase().replace(/[×✕]/g,'X').replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
const unique=a=>[...new Set(a.filter(Boolean))];
const detect=(s,re)=>unique([...s.matchAll(re)].map(m=>m[0].trim()));
// Detection identifies requirements stated by the customer, never test values
// or compliance implied by a material name. Unclassified notes are retained.
const SPECIALS=[
 ['sour',/NACE|MR\s*0175|MR\s*0103|ISO\s*15156|ISO\s*17945|사워|황화수소|H2S/i,'사워 서비스 · 적용 판·환경·경도·시험 근거'],
 ['impact',/CHARPY|IMPACT|충격|저온|\bA320\b|\bL7M?\b|\bL43\b/i,'저온·충격 · 요구 온도·에너지·시편·성적서'],
 ['hardness',/HARDNESS|HARD100|경도|\bB7M\b/i,'경도·검사 범위 · 제조사 기록·로트 대조'],
 ['trace',/TRACE|HEAT\s*(NO|NUMBER)|LOT|히트|로트|추적/i,'히트·로트 추적 · 실물 마킹과 서류 연결'],
 ['coating',/PTFE|XYLAN|ZINC.?NICKEL|ZN.?NI|HDG|GALV|코팅|도금|베이킹|수소취성/i,'표면처리 · 종류·두께·윤활·필요 시험/베이킹'],
 ['inspection',/PMI|KOLAS|ITP|VDRL|SDDR|WITNESS|HOLD\s*POINT|NDT|전수|입회|검사계획/i,'검사·입회·제출문서 · 범위·기관·제출 시점'],
 ['origin',/AVL|APPROVED\s*(VENDOR|MANUFACTURER)|ORIGIN|제조사|원산지|국산|미국산|중국산|중국.*불가/i,'제조사·AVL·원산지 제한 · 허용 목록과 증빙'],
 ['assembly',/\bSET\b|NUTS?\s*\(?2|너트.*2|세트|조립/i,'SET 구성 · 볼트·너트·와셔 개수와 각 부품 사양'],
 ['no_substitution',/NO\s*SUBSTIT|NO\s*ALTERN|대체.*불가|대체.*금지|동등품.*불가/i,'지정품 · 대체 금지'],
 ['other',/CUSTOM|SPECIAL|PER\s*DRAWING|특수|특주|도면품/i,'특주 · 고객 도면·검사 기준']
];
const criterion=(key,label,required,source='고객 BOM',extra={})=>({id:key,label,required:text(required,4000),source,...extra});
export function requirementsFor(line,request={}) {
 const s=normalize([line.description,line.spec,line.requiredDocs,line.specialRequirements,request.specialRequirements].filter(Boolean).join('\n'));
 const requirements=[];
 const standards=detect(s,/\b(?:ASTM|ASME|ISO|DIN|JIS|KS|EN)\s*[A-Z]*\s*\d+(?:[-.:/]\d+)*(?:M)?(?:\s*:\s*\d{4})?/g).filter(x=>!/^EN\s*10204/.test(x));
 if(standards.length)requirements.push(criterion('standard',REQUIREMENT_LABELS.standard,standards.join(' + ')));
 const metric=s.match(/\bM\d+(?:\.\d+)?/);
 const inch=s.match(/\b(?:\d+[- ]\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(?:"|INCH|IN\b)/);
 if(metric||inch)requirements.push(criterion('diameter',REQUIREMENT_LABELS.diameter,(metric||inch)[0]));
 const threads=detect(s,/\b(?:UNC|UNF|UNEF|UNS|UN|8UN|8-UN|ACME|BSPT|BSPP|NPT|NPTF|TR)\b|\b\d+[AB]\b|\b[4-9][GH]\b/g);
 const mt=s.match(/\bM\d+(?:\.\d+)?\s*X\s*(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)/);
 const mtPitch=s.match(/\bM\d+(?:\.\d+)?\s*[-]\s*(\d+(?:\.\d+)?)\s*(?:[-]\s*[4-9][GH])?/);
 const tpi=s.match(/(?:"|INCH|IN)\s*[-]\s*(\d+)\s*(?:UNC|UNF|UN|8UN)\b/);
 if(mt)threads.unshift('PITCH '+mt[1]+' MM');else if(mtPitch)threads.unshift('PITCH '+mtPitch[1]+' MM');
 if(tpi)threads.unshift(tpi[1]+' TPI');
 if(threads.length)requirements.push(criterion('thread',REQUIREMENT_LABELS.thread,threads.join(' + ')));
 const explicitLength=s.match(/(?:LENGTH|LEN|길이)\s*[:=]?\s*(\d+(?:\.\d+)?(?:\s*(?:MM|INCH|IN|"))?)/);
 const mx=s.match(/\bM\d+(?:\.\d+)?\s*X\s*(\d+(?:\.\d+)?)(?!\s*X)/);
 if(mt||explicitLength||mx)requirements.push(criterion('length',REQUIREMENT_LABELS.length,mt?mt[2]+' MM':explicitLength?explicitLength[1]:mx[1]+' MM'));
 const grades=detect(s,/\b(?:B7M|B7|B8M|B8|B16|L7M|L7|L43|2HM|2H|7M|7L|7ML|A[24]-[578]0|SUS\s*\d{3}L?|SS\s*\d{3}L?|S\d{5}|\d{3}L)\b|\b(?:4\.6|4\.8|5\.6|5\.8|6\.8|8\.8|10\.9|12\.9)\b/g);
 if(grades.length){const classes=detect(s,/\bCL(?:ASS)?\s*[-.]?\s*[12]\b/g);requirements.push(criterion('grade',REQUIREMENT_LABELS.grade,[...grades,...classes].join(' + ')));}
 const finishes=detect(s,/\b(?:PLAIN|UNCOATED|BLACK\s*OXIDE|HDG|PTFE|XYLAN|ZN-?NI|ZINC\s*FLAKE|ZINC\s*PLATED|GALVANI[ZS]ED)\b|무도금|용융아연도금|아연도금|흑착색/g);
 if(finishes.length)requirements.push(criterion('finish',REQUIREMENT_LABELS.finish,finishes.join(' + ')));
 const docs=detect(s,/\b(?:EN\s*10204\s*)?[23]\.[12]\b|\bMTR\b|\bMTC\b|\bCOC\b|\bPMI\b|\bKOLAS\b|\bITP\b|\bVDRL\b|\bSDDR\b|성적서|원산지\s*증빙/g);
 if(line.requiredDocs||docs.length)requirements.push(criterion('documents',REQUIREMENT_LABELS.documents,unique([...(line.requiredDocs||'').split(/\s*\+\s*/),...docs]).join(' + ')));
 for(const [key,re,label]of SPECIALS)if(re.test(s))requirements.push(criterion('special:'+key,label,detect(s,new RegExp(re.source,'gi')).join(' + ')));
 if(line.specialRequirements)requirements.push(criterion('special:notes','고객 특기사항 전체',line.specialRequirements));
 if(request.specialRequirements)requirements.push(criterion('special:global','공통 특수요건 전체',request.specialRequirements,'고객 RFQ'));
 requirements.push(criterion('unit',REQUIREMENT_LABELS.unit,line.unit||'EA'));
 for(const key of ['standard','diameter','thread','length','grade','finish','manufacturerPartNo'])if(line.attributes?.[key]){
   const old=requirements.find(r=>r.id===key);const value=criterion(key,REQUIREMENT_LABELS[key],line.attributes[key],'고객 원본 대조 입력');
   if(old)Object.assign(old,value);else requirements.push(value);
 }
 for(const d of request.basisDocuments||[])requirements.push(criterion('basis:'+d.id,'검토 문서 · '+d.name,[d.reference,d.revision].filter(Boolean).join(' / ')||d.name,'고객 문서',{documentId:d.id,reviewed:!!d.reviewed}));
 if(/PER\s*(?:CUSTOMER\s*)?DRAWING|ACCORDING\s*TO\s*DRAWING|도면\s*(참조|품)|첨부\s*도면/i.test(s))requirements.push(criterion('drawing',REQUIREMENT_LABELS.drawing,'고객 도면 원본·개정·요구사항 대조','고객 BOM',{missing:!(request.basisDocuments||[]).some(d=>d.reviewed&&(d.kind==='drawing'||/DRAWING|DWG|도면|\.d[wx]g$/i.test(d.name)))}));
 if(line.requirementsReview){
   const needed={standard:'standard',diameter:'diameter',pitch:'thread',length:'length',grade:'grade',finish:'finish'};
   for(const [check,key]of Object.entries(needed))if((line.checksRequired||Object.keys(needed)).includes(check)&&!requirements.some(r=>r.id===key))requirements.push(criterion(key,REQUIREMENT_LABELS[key],'미지정 · 고객 원본·도면으로 확인','고객 BOM',{missing:true}));
 }
 return requirements;
}
export function matchRequirements(line,offer,request={}) {
 return requirementsFor(line,request).map(r=>{
   const answer=offer?.requirementResponses?.[r.id]||{};
   const offered=text(answer.offered,4000),evidence=text(answer.evidence,4000);
   let status='clarification',reason='공급처의 요건별 답변·근거가 필요합니다.';
   if(r.missing)reason='요청값을 확인해 고객 사양에 먼저 입력하세요.';
   else if(r.documentId&&!r.reviewed)reason='고객 문서의 원본·개정과 검토 완료를 확인하세요.';
   else if(answer.status==='deviation'){status='deviation';reason='고객 요구와 차이가 있습니다. 서면 승인 전에는 채택할 수 없습니다.';}
   else if(answer.status==='confirmed'&&offered&&evidence){
     if(/DOES\s+NOT\s+COMPLY|NOT\s+(?:COMPLIANT|AVAILABLE|SUPPORTED)|NON[- ]COMPLIANT|미충족|불일치|제공\s*불가/i.test(offered)){
       status='deviation';reason='공급처 답변에 요건 미충족·제공 불가가 명시되어 있습니다.';
     }else if(/UNCONFIRMED|TO\s+BE\s+CONFIRMED|미확인|확인\s*중/i.test(offered)){
       reason='미확인 답변은 준수 처리하지 않습니다.';
     }else if(['standard','diameter','thread','length','grade','finish','unit','documents','manufacturerPartNo'].includes(r.id)&&normalize(offered)!==normalize(r.required)){
       status='deviation';reason='제시된 값이 요청값과 다릅니다. 대체·동등성은 자동 승인하지 않습니다.';
     }else{status='confirmed';reason='요건별 회신과 근거를 등록했습니다.';}
   }
   return {...r,status,offered,evidence,reason};
 });
}
export function documentsMatch(required,offered){
 const tokens=detect(normalize(required),/\b[23]\.[12]\b|\bMTR\b|\bMTC\b|\bCOC\b|\bPMI\b|\bKOLAS\b|\bITP\b|\bVDRL\b|\bSDDR\b/g);
 return tokens.length?tokens.every(token=>normalize(offered).includes(token)):normalize(offered).includes(normalize(required));
}
export function workflowFor(request,offers=[]) {
 const rows=request.lines?.flatMap(line=>{
   const choices=offers.filter(o=>o.lineId===line.id);
   const selected=choices.find(o=>matchRequirements(line,o,request).every(r=>r.status==='confirmed'));
   return matchRequirements(line,selected||choices[0],request).map(r=>({...r,lineId:line.id,no:line.sourceNo||line.no,description:line.description,offerId:(selected||choices[0])?.id||'',type:r.status==='deviation'?'D':r.status==='confirmed'?'OK':'C'}));
 })||[];
 return {requestId:request.id,requestRevision:request.revision,rows,pending:rows.filter(r=>r.status!=='confirmed').length,statement:'검토용 C&D 초안. 미회신 항목은 준수 선언이 아닙니다. 편차는 고객 서면 승인 전 채택하지 않습니다.'};
}
export function inquiryConditions(request){return JSON.stringify([(request.lines||[]).map(l=>[l.id,l.no,l.sourceNo||'',l.description,l.qty,l.unit,l.spec,l.partReference||'',l.requiredDocs||'',l.specialRequirements||'',l.unresolved||'',[...(l.checksRequired||[])].sort(),['standard','diameter','thread','length','grade','finish','manufacturerPartNo'].map(k=>l.attributes?.[k]||'')]),request.specialRequirements||'',(request.basisDocuments||[]).map(d=>[d.id,d.name,d.reference||'',d.revision||''])]);}
export function parseBOM(raw,{source='붙여넣기',specialRequirements=''}={}) {
 const value=text(raw,200000);
 if(!value||String(raw).length>200000)throw new DomainError('BOM은 200,000자 이내로 입력하세요.');
 const parsed=bomRows(value);
 if(parsed.rows.length>200)throw new DomainError('BOM은 200줄까지 분석합니다. 나누어 등록하세요.');
 const lines=[],issues=[];
 for(const row of parsed.rows){
  if(row.src.length>3000){issues.push({no:row.no,reason:'한 품목의 원문이 3,000자를 넘습니다. 특수요건을 공통 요건·검토 문서로 나누세요.'});continue;}
  const quantity=String(row.qty||'').match(/^(\d+|\d{1,3}(?:,\d{3})+)\s*(EA|PCS?|개|SET|SETS?|세트|조)?$/i);
  const qty=quantity?Number(quantity[1].replaceAll(',','')):null;
  if(!qty||!Number.isSafeInteger(qty)){issues.push({no:row.no,source:row.src,reason:'거래 단위 기준의 정수 수량을 확인하세요.'});continue;}
  const unit=normalize(row.unit||quantity[2]||'EA').replace(/^(PCS?|개)$/,'EA').replace(/^(SETS?|세트|조)$/,'SET');
  const special=text([specialRequirements,row.src].filter(Boolean).join('\n'),4000);
  const docs=detect(normalize(row.src),/\b(?:EN\s*10204\s*)?[23]\.[12]\b|\bMTR\b|\bMTC\b|\bCOC\b|\bPMI\b|\bKOLAS\b|\bITP\b|\bVDRL\b|\bSDDR\b|성적서/g).join(' + ');
  const pnColumns=parsed.cols.filter(c=>roleOf(c)==='pn');const exactMaker=pnColumns.length===1&&/MPN|MFR|MANUFACTURER|제조사/i.test(pnColumns[0]);
  const line={partReference:row.pn||'',attributes:exactMaker&&row.pn?{manufacturerPartNo:row.pn}:{},id:crypto.randomUUID(),no:lines.length+1,sourceNo:row.no,description:row.text||row.pn||row.src,spec:row.text||row.src,qty,unit,requiredDocs:docs,specialRequirements:special,sourceRef:source,sourceText:row.src,unresolved:row.filled?'병합 셀의 사양 승계를 고객 원본과 대조하세요.':'',checksRequired:['standard','diameter','pitch','length','grade','finish','documents','delivery'],requirementsReview:true};
  lines.push(line);
 }
 if(!lines.length)issues.push({no:'',reason:'품목과 수량을 인식하지 못했습니다. Excel 표를 머리글과 함께 복사하거나 수량·단위를 명시하세요.'});
 return {lines,issues,mode:parsed.mode,automaticEligible:parsed.header&&parsed.roles.includes('qty')&&issues.length===0};
}
export function mailBOM(mail){
 const files=(mail.attachments||[]).filter(a=>a.bomText||a.bomSheets?.length);
 const common=files.length?technicalContext([mail.body,...files.flatMap(a=>a.bomSheets?.map(s=>s.context)||[])].join('\n')):'';
 const sources=files.length?files.flatMap(a=>a.bomSheets?a.bomSheets.map(s=>({value:s.text,source:a.name+' / '+s.name,issue:s.issue})):({value:a.bomText,source:a.name})):[{value:mail.body,source:'메일 본문'}];
 const lines=[],issues=[];
 for(const source of sources){try{const parsed=parseBOM(source.value,{source:source.source});if(parsed.automaticEligible)lines.push(...parsed.lines);else issues.push(...parsed.issues,{reason:source.source+' · 자동 품목 확정 전 원본 확인이 필요합니다.'});if(source.issue)issues.push({reason:source.source+' · '+source.issue});}catch{issues.push({reason:source.source+' · BOM을 수동 확인하세요.'});}}
 const basisDocuments=(mail.attachments||[]).map((a,i)=>({id:'attachment-'+i,name:a.name,reference:'',revision:'',reviewed:false}));
 if(files.length&&mail.body.trim())basisDocuments.push({id:'mail-body',name:'고객 메일 본문 · 공통조건',reference:'원본 메일',revision:'',reviewed:false});
 for(const a of mail.attachments||[])if(a.bomIssue)issues.push({reason:a.name+' · '+a.bomIssue});
 if(files.length&&mail.body.length>4000)issues.push({reason:'본문 공통 조건이 4,000자를 넘습니다. 원본 전체를 검토해 요구사항을 분리하세요.'});
 if(lines.length>200)return {lines:[],intakeIssues:[{reason:'합산 200줄을 초과해 수동 분할이 필요합니다.'}],basisDocuments,specialRequirements:common};
 return {lines:lines.map((l,i)=>({...l,no:i+1})),intakeIssues:issues,basisDocuments,specialRequirements:common};
}
export function technicalContext(value){return text(String(value||'').split(/\r?\n/).filter(line=>{
 if(/회사|COMPANY|담당자|CONTACT|이메일|E-?MAIL|전화|PHONE|주소|ADDRESS|요청처|[^\s]+@[^\s]+/i.test(line))return false;
 if(/[:：|]\s*$/.test(line))return false;
 return /ASTM|ASME|\bISO\b|\bDIN\b|NACE|MR\s*0|저온|충격|경도|PMI|COC|MTR|MTC|3\.[12]|서류|코팅|재질|GRADE|COATING|VDRL|추적|원산지|AVL|납기|DELIVERY|SUBSTIT|대체|도면|SPECIFICATION|특수|SPECIAL|추가\s*설명|REMARK|NOTE|결제|지급|PAYMENT|INCOTERM|DDP|FOB|EXW|포장|PACK|검사|INSPECTION/i.test(line);
 }).join('\n'),4000);}
export function supplierRequest(request){
 const redact=value=>{let result=String(value||'');for(const secret of [request.customerName,request.customerEmail])if(secret?.trim())result=result.split(secret).join('[고객 정보 제외]');return result.replace(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/g,'[이메일 제외]');};
 return {...request,customerName:'',customerEmail:'',specialRequirements:redact(request.specialRequirements),basisDocuments:(request.basisDocuments||[]).map(d=>({...d,name:redact(d.name),reference:redact(d.reference)})),lines:request.lines.map(l=>({...l,description:redact(l.description),spec:redact(l.spec),unresolved:redact(l.unresolved),specialRequirements:redact(l.specialRequirements),requiredDocs:redact(l.requiredDocs),attributes:Object.fromEntries(Object.entries(l.attributes||{}).map(([k,v])=>[k,redact(v)]))}))};
}
export function supplierSearches(line,suppliers){
 const query=[line.partReference,line.description,line.spec,line.requiredDocs].filter(Boolean).join(' ').slice(0,1000);
 return suppliers.filter(s=>s.domains?.length).map(s=>({supplierId:s.id,name:s.name,query,url:'https://www.google.com/search?q='+encodeURIComponent('site:'+s.domains[0]+' '+query),warning:'정확한 후보를 찾기 위한 검색입니다. 가격·준수·재고·납기를 확정하지 않습니다.'}));
}
export function replyTarget(mail,requests,outbox,suppliers){
 const supplier=suppliers.find(s=>s.contactVerified&&s.email?.toLowerCase()===mail.from?.toLowerCase());
 const ids=[...String((mail.inReplyTo||'')+' '+(mail.references||'')).matchAll(/<([a-zA-Z0-9._-]+)@naver\.com>/g)].map(m=>m[1]);
 const inquiry=outbox.find(o=>o.kind==='inquiry'&&supplier?.id===o.supplierId&&ids.includes(o.id));
 const ref=mail.subject.match(/\[(BNQ-[A-Z0-9]+)\]/i)?.[1];
 const request=requests.find(r=>r.id===inquiry?.requestId||ref&&r.number===ref.toUpperCase());
 return {supplier,request,inquiry};
}
const csvCell=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replaceAll('"','""')+'"';
export function workflowCSV(request,workflow){
 const rows=[['문서','BOM 번호','항목 ID','요구사항','공급처 제시값','C/D/OK','근거·미확인 사항'],...workflow.rows.map(r=>[request.number,r.no,r.id,r.required,r.offered,r.type,r.evidence||r.reason])];
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
