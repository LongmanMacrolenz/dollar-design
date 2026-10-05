import {PDFDocument,rgb} from 'pdf-lib';
import {businessDate,businessTime} from '../dates.mjs';
import fontkit from '@pdf-lib/fontkit';
export async function quotePDF(q,business,fontBytes) {
  const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:false});
  pdf.setTitle(q.number+' · 볼트노트 견적서');pdf.setAuthor('볼트노트');let page,y;
  const navy=rgb(.08,.13,.20),grey=rgb(.36,.41,.45),orange=rgb(.945,.35,.22);
  function newPage(){page=pdf.addPage([595.28,841.89]);y=785;page.drawRectangle({x:42,y:807,width:510,height:3,color:orange});}
  function wrap(value,size,width){const lines=[];for(const original of String(value??'').split('\n')){let line='';for(const c of original.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'')){if(font.widthOfTextAtSize(line+c,size)>width&&line){lines.push(line);line='';}line+=c;}lines.push(line);}return lines;}
  function print(value,{size=10,color=navy,gap=5,width=500}={}){for(const line of wrap(value,size,width)){if(y<size+55)newPage();page.drawText(line,{x:44,y,size,font,color});y-=size+gap;}}
  const won=n=>Number(n).toLocaleString('ko-KR')+'원';newPage();print('boltnote',{size:25});print('견적서',{size:28});y-=10;
  print(q.number,{size:12});print(`수신: ${q.customerName||'고객'} / ${q.customerEmail}`);print(`작성일: ${businessDate(q.createdAt)} · 유효기간: ${businessTime(q.validUntil)}`,{color:grey});y-=15;
  for(const l of q.lines){print(`${l.no}. ${l.description}`,{size:12});print(l.spec,{color:grey});print(`수량 ${l.qty} ${l.unit} · 단가 ${won(l.unitPriceKRW)} · 금액 ${won(l.amountKRW)}`);print(`납기 ${l.leadDays}일 · 서류: ${l.documents||'확인된 별도 서류 없음'}`,{color:grey});y-=13;}
  print(`공급가액 ${won(q.netKRW)}`,{size:13});print(`부가세 ${won(q.vatKRW)}`,{size:13});print(`합계 ${won(q.totalKRW)}`,{size:19});y-=14;print(q.terms,{color:grey});y-=18;print(`${business.name} · 대표 ${business.owner}`);print(`사업자등록번호 ${business.number} · ${business.email}`,{color:grey});
  const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:520,y:28,font,size:8,color:grey}));return pdf.save();
}
