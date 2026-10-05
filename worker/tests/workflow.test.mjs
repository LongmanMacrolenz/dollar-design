import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBOM,requirementsFor,matchRequirements,workflowFor,workflowCSV,mailBOM,inquiryConditions,replyTarget} from '../workflow.mjs';
import {assessOffer,CHECKS} from '../domain.mjs';
import {inquiryMessage} from '../templates.mjs';
import {buildMessage,parseMail,base64} from '../mail.mjs';
const raw='품명\t수량\t단위\t규격\t비고\nSTUD BOLT\t20\tEA\tASTM A193 B7M 3/4"-10 UNC LENGTH 150 MM PLAIN\tNACE MR0175 / EN10204 3.1 / PMI / HEAT NO';
const fixture=()=>({id:'request-test',number:'BNQ-TEST',revision:1,customerName:'PRIVATE_CUSTOMER',customerEmail:'private@example.com',lines:parseBOM(raw).lines});
const responses=(line,request)=>Object.fromEntries(requirementsFor(line,request).map(r=>[r.id,{status:'confirmed',offered:r.required,evidence:'synthetic TEST · manufacturer document p.2 / lot TEST'}]));
test('Excel/CSV BOM preserves notes, original row numbers and special requirements without inventing pitch',()=>{
 const result=parseBOM(raw);assert.equal(result.automaticEligible,true);assert.equal(result.lines[0].qty,20);assert.match(result.lines[0].specialRequirements,/HEAT NO/);
 const reqs=requirementsFor(result.lines[0]);assert.equal(reqs.find(r=>r.id==='grade').required,'B7M');assert.equal(reqs.find(r=>r.id==='thread').required,'10 TPI + UNC');assert(reqs.some(r=>r.id==='special:sour'));assert(reqs.some(r=>r.id==='special:trace'));assert(reqs.some(r=>r.id==='special:inspection'));
 const incomplete=parseBOM('품명\t수량\t단위\n육각볼트 M12×50\t10\tEA');assert(requirementsFor(incomplete.lines[0]).find(r=>r.id==='thread').missing);
 const csv=parseBOM('No,Description,Qty,Unit,Remarks\n7,"Bolt, ASTM A193 B7M",10,EA,"PMI\nNACE MR0175"');assert.equal(csv.lines[0].sourceNo,'7');assert(workflowFor({lines:csv.lines}).rows.every(r=>r.no==='7'));assert.match(csv.lines[0].sourceText,/PMI NACE/);
 assert.equal(parseBOM('품명\t수량\n볼트\tA/R').lines.length,0);assert(parseBOM('품명\t수량\n볼트\t0').issues.length);
});
test('specific values and evidence gate quotes; B7 is never treated as B7M, nor 2.2 as 3.1',()=>{
 const req=fixture(),line=req.lines[0];const offer={sku:'TEST',price:100,currency:'KRW',unit:'EA',priceBasis:'EA',packSize:1,minOrderQty:1,availableQty:100,leadDays:3,confirmedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),evidenceType:'supplier_reply',evidence:'test quote',checks:Object.fromEntries(CHECKS.map(k=>[k,'confirmed'])),documents:'3.1, PMI',requirementResponses:responses(line,req)};
 const supplier={id:'misumi',country:'KR'},settings={logistics:{misumi:{shippingKRW:0,evidence:'test delivery'}}};
 assert.equal(assessOffer(line,offer,supplier,settings,new Date(),req).eligible,true);
 const correctDocs=offer.documents;offer.documents='CoC only';assert.equal(assessOffer(line,offer,supplier,settings,new Date(),req).eligible,false);offer.documents=correctDocs;
 offer.requirementResponses.grade.offered='B7';assert.equal(assessOffer(line,offer,supplier,settings,new Date(),req).eligible,false);assert.equal(workflowFor(req,[{...offer,lineId:line.id}]).rows.find(r=>r.id==='grade').type,'D');
 offer.requirementResponses=responses(line,req);offer.requirementResponses.documents.offered='EN10204 2.2';assert(matchRequirements(line,offer,req).find(r=>r.id==='documents').status==='deviation');
 offer.requirementResponses=responses(line,req);offer.requirementResponses['special:sour'].evidence='';assert.equal(assessOffer(line,offer,supplier,settings,new Date(),req).eligible,false);
 offer.requirementResponses=responses(line,req);offer.requirementResponses['special:sour'].offered='NACE: not compliant';assert.equal(matchRequirements(line,offer,req).find(r=>r.id==='special:sour').status,'deviation');
});
test('unread drawings block compliance; changing document revision changes RFQ basis, review alone does not resend',()=>{
 const req=fixture();req.basisDocuments=[{id:'drawing',name:'customer drawing.pdf',reference:'TEST-DWG',revision:'A',reviewed:false}];const line=req.lines[0],offer={requirementResponses:responses(line,req)};
 assert.equal(matchRequirements(line,offer,req).find(r=>r.id==='basis:drawing').status,'clarification');
 const basis=inquiryConditions(req);req.basisDocuments[0].reviewed=true;assert.equal(inquiryConditions(req),basis);assert.equal(matchRequirements(line,offer,req).find(r=>r.id==='basis:drawing').status,'confirmed');
 req.basisDocuments[0].revision='B';assert.notEqual(inquiryConditions(req),basis);
});
test('RFQ packet contains technical C&D questions without customer identity, commercial cost or compliance promises',async()=>{
 const req=fixture();req.lines[0].specialRequirements+='\n=HYPERLINK("bad")';const packet=inquiryMessage(req,{name:'TEST_SUPPLIER'});assert.match(packet.plain,/C&D/);assert.match(packet.plain,/special:sour/);assert(!packet.plain.includes('PRIVATE_CUSTOMER'));assert(!packet.plain.includes('private@example.com'));assert(!packet.plain.includes('20%'));
 const csv=workflowCSV(req,workflowFor(req));assert(csv.startsWith('\uFEFF'));assert(csv.includes('C'));assert(!csv.includes('NIL DEVIATION'));
 const formula=workflowCSV(req,{rows:[{id:'test',required:'=HYPERLINK("bad")',type:'C'}]});assert.match(formula,/'=HYPERLINK/);
 const message=buildMessage({to:'supplier@example.com',...packet,messageId:'test-rfq',attachment:{filename:'TEST-CD.csv',bytes:new TextEncoder().encode(csv)}});const parsed=await parseMail(new TextEncoder().encode(message));assert.equal(parsed.attachments[0].type,'text/csv');assert.match(parsed.attachments[0].bomText,/special:sour/);
});
test('incoming UTF-8 CSV automatically yields a reviewable BOM; PDF/legacy XLS are retained as unread document references',async()=>{
 const mime='From: Buyer <buyer@example.com>\r\nSubject: RFQ BOM\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlease quote.\r\n--b\r\nContent-Type: text/csv; charset=utf-8\r\nContent-Disposition: attachment; filename="bom.csv"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+base64(new TextEncoder().encode(raw))+'\r\n--b--\r\n';
 const mail=await parseMail(new TextEncoder().encode(mime));const intake=mailBOM(mail);assert.equal(intake.lines.length,1);assert.equal(intake.lines[0].qty,20);assert.equal(intake.basisDocuments[0].reviewed,false);
 const unread=mailBOM({...mail,attachments:[{name:'drawing.pdf'},{name:'bom.xls'}]});assert.equal(unread.lines.length,0);assert.equal(unread.basisDocuments.length,2);assert(unread.intakeIssues.length);
});
test('supplier replies link by outgoing Message-ID even without subject tag; an unlinked supplier quotation is not customer intake',()=>{
 const request={id:'request-id',number:'BNQ-TEST'},supplier={id:'misumi',contactVerified:true,email:'supplier@example.com'};
 const out={id:'rfq-test',kind:'inquiry',requestId:request.id,supplierId:supplier.id};
 const linked=replyTarget({from:'SUPPLIER@example.com',subject:'Quotation',inReplyTo:'<rfq-test@naver.com>'},[request],[out],[supplier]);assert.equal(linked.request.id,request.id);assert.equal(linked.inquiry.id,out.id);
 const unlinked=replyTarget({from:supplier.email,subject:'Unrelated quotation'},[request],[out],[supplier]);assert.equal(unlinked.request,undefined);assert.equal(unlinked.supplier.id,supplier.id);
 const wrong=replyTarget({from:'other@example.com',subject:'Quotation',inReplyTo:'<rfq-test@naver.com>'},[request],[out],[supplier]);assert.equal(wrong.request,undefined);
});
test('referenced-but-unreceived drawings cannot be marked compliant; unusual customer values require explicit original-document input',()=>{
 const req=fixture(),line=req.lines[0];line.specialRequirements+=' PER DRAWING TEST-DWG';assert(requirementsFor(line,req).find(r=>r.id==='drawing').missing);
 req.basisDocuments=[{id:'dwg',name:'TEST drawing.pdf',revision:'B',reviewed:true}];assert.equal(requirementsFor(line,req).find(r=>r.id==='drawing').missing,false);
 line.attributes={grade:'CUSTOM-ALLOY-TEST'};assert.equal(requirementsFor(line,req).find(r=>r.id==='grade').required,'CUSTOM-ALLOY-TEST');
});
test('explicit manufacturer part numbers are preserved and checked without treating internal customer codes as manufacturer numbers',()=>{
 const maker=parseBOM('Description\tMPN\tQty\tSpecification\nBolt\tOEM-12345\t10\tISO 4017 M12x1.75x50 8.8 PLAIN').lines[0];assert.equal(maker.attributes.manufacturerPartNo,'OEM-12345');
 const answer={requirementResponses:{manufacturerPartNo:{status:'confirmed',offered:'OEM-OTHER',evidence:'test catalog'}}};assert.equal(matchRequirements(maker,answer).find(r=>r.id==='manufacturerPartNo').status,'deviation');
 const internal=parseBOM('Description\t고객 품번\tQty\nBolt\tINTERNAL-123\t10').lines[0];assert.equal(internal.partReference,'INTERNAL-123');assert.equal(internal.attributes.manufacturerPartNo,undefined);
});
