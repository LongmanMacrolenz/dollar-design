import test from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {xlsxBOM} from '../xlsx.mjs';
import {mailBOM,supplierRequest,workflowFor,workflowCSV} from '../workflow.mjs';
import {parseMail,base64} from '../mail.mjs';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function workbook({formula=false,two=false}={}){
 const rows=[['견적 요청서','TEST-RFQ'],['요청처(회사)','PRIVATE_CUSTOMER'],['이메일','private@example.com'],...Array.from({length:12},()=>['검토 메타데이터','test']),['필요 서류','EN10204 3.1 / PMI'],['Description','Qty','Unit','Specification','Notes'],['Stud bolt','20','EA','ASTM A193 B7M 3/4"-10 UNC LENGTH 150 MM PLAIN','NACE MR0175']];
 const sheet='<worksheet><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr">'+(formula&&i===rows.length-1&&j===1?'<f>10+10</f>':'')+'<is><t>'+escape(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
 const files={'xl/workbook.xml':strToU8('<workbook><sheets><sheet name="BOM" r:id="rId1"/>'+(two?'<sheet name="BOM2" r:id="rId2"/>':'')+'</sheets></workbook>'),'xl/_rels/workbook.xml.rels':strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/>'+(two?'<Relationship Id="rId2" Target="worksheets/sheet2.xml"/>':'')+'</Relationships>'),'xl/worksheets/sheet1.xml':strToU8(sheet)};
 if(two)files['xl/worksheets/sheet2.xml']=strToU8(sheet);
 return zipSync(files);
}
test('XLSX reads actual worksheet cells below RFQ metadata, preserves every BOM sheet and flags formulas without executing them',()=>{
 const sheets=xlsxBOM(workbook({two:true}));assert.equal(sheets.length,2);assert.match(sheets[0].text,/B7M/);assert.match(sheets[0].context,/EN10204/);assert(!sheets[0].text.includes('PRIVATE_CUSTOMER'));
 const parsed=mailBOM({body:'No substitutions',attachments:[{name:'bom.xlsx',bomSheets:sheets}]});assert.equal(parsed.lines.length,2);assert.equal(parsed.lines[1].qty,20);assert.match(parsed.specialRequirements,/3.1/);assert(!parsed.specialRequirements.includes('private@example.com'));assert(!parsed.specialRequirements.includes('PRIVATE_CUSTOMER'));
 assert.match(xlsxBOM(workbook({formula:true}))[0].issue,/수식/);
});
test('XLSX MIME attachment yields real BOM rows; untrusted expansion and XML entities are rejected',async()=>{
 const raw='From: Test <buyer@example.com>\r\nSubject: RFQ BOM\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\nContent-Disposition: attachment; filename="bom.xlsx"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+base64(workbook())+'\r\n--b--\r\n';
 const mail=await parseMail(new TextEncoder().encode(raw));assert.equal(mailBOM(mail).lines.length,1);
 const bomb=workbook(),view=new DataView(bomb.buffer);for(let i=0;i<bomb.length-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,100*1024*1024,true);break;}assert.throws(()=>xlsxBOM(bomb),/압축 해제/);
 const entity=zipSync({'xl/workbook.xml':strToU8('<!DOCTYPE root [<!ENTITY bad SYSTEM "file:///test">]><workbook/>')});assert.throws(()=>xlsxBOM(entity),/외부 참조/);
});
test('supplier packet redacts explicit customer identities even inside copied notes or document filenames',()=>{
 const req={number:'BNQ-TEST',customerName:'PRIVATE_CUSTOMER',customerEmail:'private@example.com',specialRequirements:'NACE · contact private@example.com',basisDocuments:[{id:'doc',name:'PRIVATE_CUSTOMER drawing.pdf',reviewed:false}],lines:[{id:'line',no:1,description:'test',qty:1,unit:'EA',specialRequirements:'PRIVATE_CUSTOMER · other@example.com · NACE'}]};
 const safe=supplierRequest(req),csv=workflowCSV(safe,workflowFor(safe));assert(!csv.includes('PRIVATE_CUSTOMER'));assert(!csv.includes('private@example.com'));assert(!csv.includes('other@example.com'));assert(csv.includes('NACE'));
});
