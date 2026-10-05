import {DomainError} from './domain.mjs';
export async function authorized(request,key) {
  if(typeof key!=='string'||key.length<32) return false;
  const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  const digest=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
  const [a,b]=await Promise.all([digest(key),digest(supplied)]);
  let diff=0;for(let i=0;i<a.length;i++) diff|=a[i]^b[i];return diff===0;
}
export function assertSameOrigin(request) {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) throw new DomainError('같은 사이트에서 요청하세요.',403);
}
export async function jsonBody(request,max=3*1024*1024) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new DomainError('JSON 요청이 필요합니다.',415);
  const reader=request.body?.getReader();if(!reader) throw new DomainError('요청 내용이 없습니다.');
  const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done) break;size+=value.length;if(size>max){await reader.cancel();throw new DomainError('요청 내용이 너무 큽니다.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new DomainError('요청 내용을 확인하세요.');}
}
export function json(data,status=200) {return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
