// Public supplier names were explicitly requested by the owner for private procurement.
// Contacts and commercial terms belong in the private store, never in this file.
import {DomainError} from './domain.mjs';
export const SUPPLIERS = [
  {id:'misumi',name:'한국미스미',home:'https://kr.misumi-ec.com/',country:'KR',domains:['kr.misumi-ec.com']},
  {id:'navimro',name:'나비엠알오',home:'https://www.navimro.com/',country:'KR',domains:['www.navimro.com','navimro.com']},
  {id:'koreabolt',name:'한국볼트',home:'',country:'KR',domains:[]},
  {id:'hwashin',name:'화신볼트',home:'',country:'KR',domains:[]},
  {id:'grainger',name:'Grainger',home:'https://www.grainger.com/',country:'US',domains:['www.grainger.com','grainger.com']},
  {id:'mcmaster',name:'McMaster-Carr',home:'https://www.mcmaster.com/',country:'US',domains:['www.mcmaster.com','mcmaster.com']}
];
export function allowedProductURL(value,supplier) {
  let url; try {url=new URL(value);} catch {throw new DomainError('공식 제품 URL을 입력하세요.');}
  if(url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443') || !supplier.domains.includes(url.hostname.toLowerCase()))
    throw new DomainError('등록된 공급처의 공식 HTTPS 제품 주소만 확인할 수 있습니다.');
  url.hash='';return url.href;
}
