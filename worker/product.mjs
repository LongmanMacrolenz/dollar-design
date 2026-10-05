import {allowedProductURL} from './suppliers.mjs';
import {DomainError,text} from './domain.mjs';
export async function productCandidate(url,supplier) {
  let next=allowedProductURL(url,supplier),response;
  for(let i=0;i<3;i++) {
    response=await fetch(next,{redirect:'manual',headers:{Accept:'text/html,application/ld+json'},signal:AbortSignal.timeout(12000)});
    if([301,302,303,307,308].includes(response.status)) {
      const location=response.headers.get('location');if(!location) throw new DomainError('상품 주소를 확인하세요.');
      next=allowedProductURL(new URL(location,next).href,supplier);continue;
    }
    break;
  }
  if(!response.ok) throw new DomainError(`공급처 페이지를 읽을 수 없습니다 (${response.status}). 직접 확인한 조건을 등록하세요.`);
  const reader=response.body.getReader();let size=0,html='';const decoder=new TextDecoder();
  for(;;){const {value,done}=await reader.read();if(done) break;size+=value.length;if(size>1500000){await reader.cancel();throw new DomainError('상품 페이지가 큽니다. 직접 확인한 조건을 등록하세요.');}html+=decoder.decode(value,{stream:true});}
  html+=decoder.decode();const products=[];
  function visit(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(visit);return;}if([].concat(v['@type']||[]).includes('Product'))products.push(v);if(v['@graph'])visit(v['@graph']);}
  for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
  const p=products[0],o=[].concat(p?.offers||[])[0];
  return {url:next,supplierId:supplier.id,evidenceType:'website_only',retrievedAt:new Date().toISOString(),description:text(p?.name,1000),sku:text(p?.sku||p?.mpn,160),price:o?.price??'',currency:text(o?.priceCurrency,3),availability:text(o?.availability,300),warning:'웹 가격은 후보입니다. 포장 단위·공급 수량·납기·운송비와 사양을 공급처에 확인하세요.'};
}
