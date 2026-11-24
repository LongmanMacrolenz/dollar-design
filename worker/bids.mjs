// 나라장터 파스너 입찰공고 수집 (대표 요청 2026-11-24).
// 조달청 「나라장터 입찰공고정보서비스」(공공데이터포털 무료 OpenAPI)의 물품 공고를 공고명 키워드로 찾아 모은다.
// - 키는 Cloudflare Secret DATA_GO_KR_KEY(공공데이터포털 일반 인증키)에서만 읽는다. 키가 없으면 아무것도 호출하지 않는다.
// - 이 서비스는 명세상 SSL이 없어 http로 부른다(https는 연결이 끊긴다). 실패하면 https로 한 번 더 시도한다.
// - 모으는 것은 공개된 공고 정보뿐이다. 담당자 이름·전화·메일은 저장하지 않는다.
// - 참가 자격 표시는 응답 필드·공고명으로 고른 "확인할 점"이다. 자격을 판정하지 않는다(공고문을 봐야 한다).
export const BID_BASE='apis.data.go.kr/1230000/ad/BidPublicInfoService';
export const BID_OPERATION='getBidPblancListInfoThngPPSSrch';   // 물품, 공고명(bidNtceNm) 부분일치 검색
// 공고명 검색어. 서버가 부분일치로 찾고, 아래 FASTENER로 한 번 더 거른다.
export const BID_KEYWORDS=['볼트','너트','스터드','와셔','와샤','앵커','리벳','스크류','스크루','나사','분할핀','스프링핀','평행핀','테이퍼핀','스냅링','멈춤링','패스너','화스너','체결구'];
const FASTENER=/볼트|너트|스터드|와셔|와샤|앵커|리벳|스크[류루]|나사|분할\s*핀|스프링\s*핀|평행\s*핀|테이퍼\s*핀|스냅\s*링|멈춤\s*링|[패화]스너|체결구|fastener|bolt|nut|washer|stud|rivet|screw/i;
// 파스너가 아닌데 검색어가 걸리는 공고명. 걸리면 버린다.
const NOT_FASTENER=[
  /\d+\s*(k|킬로)?\s*볼트(?!\s*(너트|조임|체결))/i,   // 전압(220볼트, 22킬로볼트)
  /볼트\s*(암페어|전압)|킬로볼트|메가볼트/,
  /나사(렛|로\s)|나사\s*(돌리개|드라이버)|나사못?\s*빼/,           // 지명·공구
  /앵커\s*(리그|선박|체인)|앵커리지/,
];
export const RUN_LIMIT=40;            // 한 번 실행에 부를 최대 호출 수 (무료 요금제 하위 요청 50개 아래)
export const ROWS=100;
export const BACKFILL_DAYS=90;
export const WINDOW_DAYS=30;          // 조회 기간 상한(약 1개월)에 맞춘 구간 길이
export const KEEP_DAYS=200;           // 마감 지난 지 이만큼 된 공고는 지운다

const KST=9*3600000;
const pad=n=>String(n).padStart(2,'0');
// 한국 시간 기준 'YYYYMMDDHHMM'
export function apiTime(ms){const d=new Date(ms+KST);return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;}
export function kstDay(ms){return new Date(ms+KST).toISOString().slice(0,10);}
export function kstHour(ms){return new Date(ms+KST).getUTCHours();}
const dayStart=ms=>Date.parse(kstDay(ms)+'T00:00:00+09:00');

// 공공데이터포털 인증키는 Encoding/Decoding 두 모양이 있다. 퍼센트 인코딩된 키는 풀어서 한 번만 인코딩되게 한다.
export function normalizeKey(raw){const k=String(raw||'').trim();if(!k)return '';try{return k.includes('%')?decodeURIComponent(k):k;}catch{return k;}}

export function bidURL(key,{from,to,keyword,page=1},scheme='http'){
  const q=new URLSearchParams({ServiceKey:normalizeKey(key),type:'json',numOfRows:String(ROWS),pageNo:String(page),inqryDiv:'1',inqryBgnDt:apiTime(from),inqryEndDt:apiTime(to),bidNtceNm:keyword});
  return `${scheme}://${BID_BASE}/${BID_OPERATION}?${q}`;
}

// 응답을 {code,message,items,total}로 바꾼다. 인증·쿼터 오류는 type=json이어도 XML로 오는 일이 있다.
export function parseBidResponse(body){
  const t=String(body||'').trim();
  if(t.startsWith('{')){
    let p;try{p=JSON.parse(t);}catch{return {code:'PARSE',message:'응답을 읽지 못했습니다.',items:[],total:0};}
    const err=p.OpenAPI_ServiceResponse?.cmmMsgHeader;if(err)return {code:String(err.returnReasonCode||'ERR'),message:String(err.returnAuthMsg||err.errMsg||''),items:[],total:0};
    const r=p.response||p,header=r.header||{},bodyPart=r.body||{};
    let items=bodyPart.items??[];if(items&&!Array.isArray(items))items=items.item??[];if(items&&!Array.isArray(items))items=[items];
    return {code:String(header.resultCode??''),message:String(header.resultMsg??''),items:(items||[]).filter(x=>x&&typeof x==='object'),total:Number(bodyPart.totalCount||0)};
  }
  if(t.startsWith('<')){
    const tag=n=>(t.match(new RegExp(`<${n}>([^<]*)</${n}>`))||[])[1]||'';
    if(t.includes('cmmMsgHeader'))return {code:tag('returnReasonCode')||'ERR',message:tag('returnAuthMsg')||tag('errMsg'),items:[],total:0};
    const items=[...t.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>Object.fromEntries([...m[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map(x=>[x[1],x[2].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')])));
    return {code:tag('resultCode'),message:tag('resultMsg'),items,total:Number(tag('totalCount')||0)};
  }
  return {code:'PARSE',message:'응답 형식을 알 수 없습니다.',items:[],total:0};
}
export const okCode=c=>c==='00'||c==='0';
// 오류 코드별 안내 (공공데이터포털 공통 오류)
export function bidErrorText(code,message=''){
  const known={'30':'등록되지 않은 인증키입니다. 키 값(Decoding)과 활용 신청 승인 여부를 확인하세요.','31':'활용 기간이 끝난 키입니다.','22':'하루 호출 한도를 넘었습니다. 내일 이어서 모읍니다.','20':'이 서비스의 활용 신청이 승인되지 않았습니다.','32':'등록되지 않은 IP입니다.','12':'서비스가 없거나 주소가 바뀌었습니다.','HTTP':'조달청 서버에 연결하지 못했습니다.','PARSE':'응답을 읽지 못했습니다.'};
  return known[code]||message||'알 수 없는 오류';
}

const pick=(o,...names)=>{for(const n of names){const v=o[n];if(v!=null&&String(v).trim()!=='')return String(v).trim();}return '';};
const num=v=>{const n=Number(String(v||'').replace(/[^\d.]/g,''));return Number.isFinite(n)&&n>0?Math.round(n):null;};
const yes=v=>/^y/i.test(String(v||''));

export function isFastener(title){const t=String(title||'');return FASTENER.test(t)&&!NOT_FASTENER.some(r=>r.test(t));}

// 확인할 점: 응답 필드와 공고명에서 고른다. 판정이 아니라 공고문에서 볼 곳을 알려 준다.
export function bidFlags(rec){
  const f=[];const text=`${rec.title} ${rec.method} ${rec.bidMethod}`;
  if(/중소기업자?\s*간|중기간|직접\s*생산/.test(text))f.push({code:'sme',label:'중소기업자간 경쟁 가능성 · 직접생산확인 필요 여부 확인'});
  if(/제한/.test(rec.method))f.push({code:'limited',label:'제한경쟁 · 참가 자격 확인'});
  if(rec.industryLimited)f.push({code:'industry',label:'업종(면허) 제한 있음'});
  if(rec.region)f.push({code:'region',label:'지역 제한: '+rec.region});
  if(/수의|견적/.test(rec.method))f.push({code:'quote',label:'수의계약·견적 제출 방식'});
  if(rec.international)f.push({code:'intl',label:'국제입찰'});
  if(/취소/.test(rec.kind))f.push({code:'cancel',label:'취소 공고'});
  if(/제조/.test(text))f.push({code:'maker',label:'제조업체 한정 여부 확인'});
  return f;
}

export function normalizeBid(item,keyword=''){
  const no=pick(item,'bidNtceNo'),ord=pick(item,'bidNtceOrd')||'000';
  const files=[];
  for(let i=1;i<=10;i++){const url=pick(item,'ntceSpecDocUrl'+i),name=pick(item,'ntceSpecFileNm'+i);if(url)files.push({name:name||('첨부 '+i),url});}
  const std=pick(item,'stdNtceDocUrl');if(std&&!files.some(x=>x.url===std))files.unshift({name:'표준 공고서',url:std});
  const rec={
    id:`${no}-${ord}`,no,ord,title:pick(item,'bidNtceNm'),kind:pick(item,'ntceKindNm'),
    noticeOrg:pick(item,'ntceInsttNm'),demandOrg:pick(item,'dminsttNm'),
    noticeAt:pick(item,'bidNtceDt','rgstDt'),closeAt:pick(item,'bidClseDt'),openAt:pick(item,'opengDt'),
    price:num(pick(item,'presmptPrce')),budget:num(pick(item,'asignBdgtAmt')),
    method:pick(item,'cntrctCnclsMthdNm'),bidMethod:pick(item,'sucsfbidMthdNm'),
    region:pick(item,'rgnLmtBidLocplcJdgmBssNm'),industryLimited:yes(item.indstrytyLmtYn),international:yes(item.intrbidYn),
    category:pick(item,'prdctClsfcNoNm','dtilPrdctClsfcNoNm'),
    url:pick(item,'bidNtceDtlUrl','bidNtceUrl'),files,keyword,
  };
  rec.flags=bidFlags(rec);
  return rec;
}

// 날짜 문자열('2026-11-24 10:00:00', '2026/11/24 10:00', '202611241000')을 시각으로. 모르면 null
export function bidTime(s){
  const m=String(s||'').match(/(\d{4})\D?(\d{2})\D?(\d{2})(?:\D*(\d{2})\D?(\d{2}))?/);
  if(!m)return null;const t=Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]||'00'}:${m[5]||'00'}:00+09:00`);return Number.isFinite(t)?t:null;
}

// 할 일 목록: [{from,to,keyword,page}]. 백필은 30일 구간 × 검색어, 매일은 전날 0시~지금 × 검색어
export function backfillTasks(now,days=BACKFILL_DAYS){
  const tasks=[];const end=now;let start=dayStart(now-days*86400000);
  while(start<end){const to=Math.min(start+WINDOW_DAYS*86400000-60000,end);for(const keyword of BID_KEYWORDS)tasks.push({from:start,to,keyword,page:1});start+=WINDOW_DAYS*86400000;}
  return tasks;
}
export function dailyTasks(now){const from=dayStart(now-86400000);return BID_KEYWORDS.map(keyword=>({from,to:now,keyword,page:1}));}

// 한 번 실행: 할 일을 limit 호출까지 처리한다. fetchText(url)는 본문 문자열을 돌려준다(시험에서 바꿔 끼운다).
// 반환: {records, tasks(남은 할 일), calls, error}
export async function runBidTasks(key,tasks,fetchText,limit=RUN_LIMIT){
  const queue=[...tasks],records=[];let calls=0,error=null;
  while(queue.length&&calls<limit){
    const t=queue[0];let body=null;
    for(const scheme of ['http','https']){
      if(calls>=limit)break;calls++;
      try{body=await fetchText(bidURL(key,t,scheme));break;}catch{body=null;}
    }
    if(body==null){error={code:'HTTP',message:bidErrorText('HTTP')};break;}
    const r=parseBidResponse(body);
    if(r.code==='03'||(okCode(r.code)&&!r.items.length)){queue.shift();continue;}   // 03: 자료 없음
    if(!okCode(r.code)){error={code:r.code,message:bidErrorText(r.code,r.message)};break;}
    for(const item of r.items){const rec=normalizeBid(item,t.keyword);if(rec.no&&isFastener(rec.title))records.push(rec);}
    queue.shift();
    if(t.page*ROWS<r.total&&t.page<20)queue.unshift({...t,page:t.page+1});
  }
  return {records,tasks:queue,calls,error};
}

export function bidsCSV(bids){
  const cols=[['공고번호','id'],['공고명','title'],['공고종류','kind'],['공고기관','noticeOrg'],['수요기관','demandOrg'],['공고일시','noticeAt'],['마감일시','closeAt'],['개찰일시','openAt'],['추정가격','price'],['배정예산','budget'],['계약방법','method'],['낙찰방법','bidMethod'],['지역제한','region'],['확인할 점','flags'],['첨부','files'],['공고 상세','url']];
  const cell=v=>{const s=Array.isArray(v)?v.map(x=>x.label||`${x.name} ${x.url}`).join(' / '):String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
  return '﻿'+[cols.map(c=>c[0]).join(','),...bids.map(b=>cols.map(c=>cell(b[c[1]])).join(','))].join('\r\n');
}
