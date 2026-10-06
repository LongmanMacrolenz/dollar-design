// Read cell values only. No macros, formulas, external links or XML entities
// are executed. Bounds are enforced before ZIP members are decompressed.
import {unzipSync,strFromU8} from 'fflate';
import {roleOf} from './bom_rows.mjs';
const fail=message=>{throw Error(message);};
const decode=s=>String(s||'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const value=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return value>0&&value<=0x10ffff?String.fromCodePoint(value):'';}).replace(/&(lt|gt|quot|apos|amp);/g,(_,k)=>({lt:'<',gt:'>',quot:'"',apos:"'",amp:'&'}[k]));
const attr=(tag,key)=>decode(tag.match(new RegExp('(?:^|\\s)'+key+'=(["\'])(.*?)\\1'))?.[2]||'');
const cellText=xml=>[...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
export function xlsxBOM(bytes){
 if(bytes.length>2*1024*1024)fail('XLSX 파일은 2MB 이내로 나누어 주세요.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)fail('XLSX ZIP 구조를 확인하세요.');
 const count=view.getUint16(end+10,true),expected=new Map();let offset=view.getUint32(end+16,true),expanded=0;
 if(view.getUint16(end+4,true)||view.getUint16(end+6,true))fail('분할 ZIP은 처리하지 않습니다.');
 if(!count||count>300)fail('XLSX 파일의 구성 항목 수를 확인하세요.');
 for(let i=0;i<count;i++){
  if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)fail('XLSX ZIP 인덱스를 확인하세요.');
  if(view.getUint16(offset+8,true)&1)fail('암호화된 XLSX는 직접 확인하세요.');
  const size=view.getUint32(offset+24,true);expanded+=size;
  if(size>4*1024*1024||expanded>12*1024*1024)fail('압축 해제 크기가 큰 XLSX는 표만 분리해 주세요.');
  const name=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(offset+46,offset+46+view.getUint16(offset+28,true)));
  if(expected.has(name))fail('동일 이름의 XLSX 항목이 중복되어 있습니다.');
  expected.set(name,{size,crc:view.getUint32(offset+16,true)});
  offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
 }
 const files=unzipSync(bytes,{filter:file=>/^(?:xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(file.name)});
 for(const [name,data]of Object.entries(files)){
  let crc=-1;for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  if(data.length!==expected.get(name)?.size||((crc^-1)>>>0)!==expected.get(name)?.crc)fail('XLSX 파일의 크기·검증값이 일치하지 않습니다. 원본을 다시 저장하세요.');
 }
 const xml=name=>{if(!files[name])return '';const result=strFromU8(files[name]);if(/<!DOCTYPE|<!ENTITY/i.test(result))fail('XML 외부 참조는 처리하지 않습니다.');return result;};
 const shared=[...xml('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>cellText(m[1]));
 if(shared.length>20000)fail('문자열이 많은 XLSX는 BOM 표만 분리하세요.');
 const workbook=xml('xl/workbook.xml'),rels=xml('xl/_rels/workbook.xml.rels');
 const sheets=[...workbook.matchAll(/<sheet\s([^>]*?)\/?\s*>/g)].map(m=>({name:attr(m[1],'name'),id:attr(m[1],'r:id')}));
 const result=[];
 for(const sheet of sheets){
  const rel=[...rels.matchAll(/<Relationship\s([^>]*?)\/?\s*>/g)].find(m=>attr(m[1],'Id')===sheet.id);
  let path=attr(rel?.[1]||'','Target');if(path.startsWith('/'))path=path.slice(1);else if(!path.startsWith('xl/'))path='xl/'+path;
  if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(path))continue;
  const rows=[];let formulas=false,cells=0;
  for(const row of xml(path).matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)){
   if(rows.length>=500)fail('500행 이상 XLSX 시트는 BOM 표를 나누어 주세요.');
   const values=[];
   for(const m of row[1].matchAll(/<c(?:\s([^>]*?))?>([\s\S]*?)<\/c>/g)){
    if(++cells>16000)fail('XLSX 셀 수가 많습니다. BOM 표만 분리하세요.');
    const reference=attr(m[1]||'','r').match(/^([A-Z]+)\d+$/)?.[1];let column=0;
    if(!reference)fail('XLSX 셀 주소를 확인하세요.');for(const c of reference)column=column*26+c.charCodeAt(0)-64;column--;
    if(column>63)fail('64열 이내 BOM 표로 분리하세요.');
    const value=decode(m[2].match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]||'');
    if(/<f(?:\s|>)/.test(m[2]))formulas=true;
    values[column]=attr(m[1]||'','t')==='s'?shared[Number(value)]||'':attr(m[1]||'','t')==='inlineStr'?cellText(m[2]):value;
   }
   if(values.some(Boolean))rows.push(Array.from({length:values.length},(_,i)=>values[i]||''));
  }
  const header=rows.findIndex(row=>row.some(c=>roleOf(c)==='qty')&&row.some(c=>['desc','type','pn'].includes(roleOf(c))));
  if(header<0){if(rows.length)result.push({name:sheet.name,text:'',context:rows.map(r=>r.join(' | ')).join('\n'),issue:'BOM 머리글을 찾지 못한 시트도 원본 검토가 필요합니다.'});continue;}
  const quote=v=>'"'+v.replaceAll('"','""')+'"';
  result.push({name:sheet.name,text:rows.slice(header).map(row=>row.map(quote).join('\t')).join('\n'),context:rows.slice(0,header).map(row=>row.join(' | ')).join('\n'),issue:formulas?'수식의 저장된 값은 재계산하지 않습니다. 원본에서 수량·단위를 확인하세요.':''});
 }
 if(!result.length)fail('XLSX에서 읽을 수 있는 시트가 없습니다.');
 return result;
}
