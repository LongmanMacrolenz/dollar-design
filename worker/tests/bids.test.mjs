import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {parseBidResponse,normalizeBid,isFastener,runBidTasks,bidURL,backfillTasks,dailyTasks,bidsCSV,bidTime,normalizeKey,BID_KEYWORDS} from '../bids.mjs';

// 합성 응답 (실제 공고가 아님). 필드 이름은 나라장터 입찰공고정보서비스 PPSSrch 응답 명세의 이름을 쓴다.
const item=(no,title,extra={})=>({bidNtceNo:no,bidNtceOrd:'000',bidNtceNm:title,ntceKindNm:'등록공고',ntceInsttNm:'시험기관',dminsttNm:'시험수요기관',bidNtceDt:'2026-11-20 10:00:00',bidClseDt:'2099-12-01 10:00:00',opengDt:'2099-12-01 11:00:00',presmptPrce:'12000000',cntrctCnclsMthdNm:'제한경쟁',sucsfbidMthdNm:'적격심사',rgnLmtBidLocplcJdgmBssNm:'',indstrytyLmtYn:'Y',bidNtceDtlUrl:'https://example.com/bid/'+no,ntceSpecDocUrl1:'https://example.com/file/'+no,ntceSpecFileNm1:'규격서.hwp',ntceInsttOfclNm:'담당자',ntceInsttOfclTelNo:'000-0000-0000',...extra});
const page=(items,total=items.length)=>JSON.stringify({response:{header:{resultCode:'00',resultMsg:'NORMAL SERVICE.'},body:{items,numOfRows:100,pageNo:1,totalCount:total}}});

test('응답 읽기: JSON·XML·인증 오류',()=>{
  const ok=parseBidResponse(page([item('R1','육각볼트 구매')]));assert.equal(ok.code,'00');assert.equal(ok.items.length,1);
  const single=parseBidResponse(JSON.stringify({response:{header:{resultCode:'00'},body:{items:{item:item('R2','너트')},totalCount:1}}}));assert.equal(single.items.length,1);
  const xmlErr=parseBidResponse('<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>');
  assert.equal(xmlErr.code,'30');
  const jsonErr=parseBidResponse(JSON.stringify({OpenAPI_ServiceResponse:{cmmMsgHeader:{returnReasonCode:'22',returnAuthMsg:'LIMITED'}}}));assert.equal(jsonErr.code,'22');
  const xml=parseBidResponse('<response><header><resultCode>00</resultCode></header><body><items><item><bidNtceNo>X1</bidNtceNo><bidNtceNm>스터드 볼트 &amp; 너트</bidNtceNm></item></items><totalCount>1</totalCount></body></response>');
  assert.equal(xml.items[0].bidNtceNm,'스터드 볼트 & 너트');
});

test('파스너 공고만 고르고 전압·공구 공고는 버린다',()=>{
  for(const t of ['육각볼트 외 12종 구매','스터드볼트(A193 B7) 구매','앵커볼트 제작 설치','스프링와셔 구매','분할핀 등 소모품','체결구 일괄 구매'])assert.ok(isFastener(t),t);
  for(const t of ['220볼트 전원장치 구매','22킬로볼트 차단기','전산장비 유지보수','나사렛 복지관 비품'])assert.equal(isFastener(t),false,t);
});

test('정규화: 담당자 연락처는 남기지 않고 첨부·확인할 점을 만든다',()=>{
  const r=normalizeBid(item('R3','중소기업자간 경쟁 육각볼트 제조 구매',{rgnLmtBidLocplcJdgmBssNm:'본사 소재지',stdNtceDocUrl:'https://example.com/std'}),'볼트');
  assert.equal(r.id,'R3-000');assert.equal(r.price,12000000);assert.equal(r.files.length,2);assert.equal(r.files[0].name,'표준 공고서');
  const codes=r.flags.map(f=>f.code);for(const c of ['sme','limited','industry','region','maker'])assert.ok(codes.includes(c),c);
  assert.ok(!JSON.stringify(r).includes('담당자')&&!JSON.stringify(r).includes('000-0000-0000'));
  assert.equal(bidTime('2026-11-24 10:00:00'),Date.parse('2026-11-24T10:00:00+09:00'));assert.equal(bidTime('202611241000'),Date.parse('2026-11-24T10:00:00+09:00'));
});

test('조회 주소: http, 키는 한 번만 인코딩, 공고명 검색',()=>{
  assert.equal(normalizeKey('ab%2Bc%3D%3D'),'ab+c==');
  const u=new URL(bidURL('ab%2Bc%3D%3D',{from:Date.parse('2026-11-23T00:00:00+09:00'),to:Date.parse('2026-11-24T06:00:00+09:00'),keyword:'볼트',page:2}));
  assert.equal(u.protocol,'http:');assert.equal(u.searchParams.get('ServiceKey'),'ab+c==');assert.equal(u.searchParams.get('bidNtceNm'),'볼트');
  assert.equal(u.searchParams.get('inqryBgnDt'),'202611230000');assert.equal(u.searchParams.get('inqryEndDt'),'202611240600');assert.equal(u.searchParams.get('pageNo'),'2');
  const now=Date.parse('2026-11-24T06:00:00+09:00');
  assert.equal(dailyTasks(now).length,BID_KEYWORDS.length);
  const back=backfillTasks(now);assert.ok(back.length>=BID_KEYWORDS.length*3);assert.ok(back.every(t=>t.to-t.from<=30*86400000));
});

test('실행: 쪽 넘김, 자료 없음, https 재시도, 오류에서 멈춤, 호출 상한',async()=>{
  const calls=[];
  const fetchText=async url=>{calls.push(url);const u=new URL(url),k=u.searchParams.get('bidNtceNm'),p=Number(u.searchParams.get('pageNo'));
    if(k==='볼트'&&u.protocol==='http:')throw new Error('reset');
    if(k==='볼트')return page(p===1?Array.from({length:100},(_,i)=>item('B'+i,'볼트 구매 '+i)):[item('B100','220볼트 전원장치')],101);
    if(k==='너트')return JSON.stringify({response:{header:{resultCode:'03',resultMsg:'NODATA_ERROR'},body:{}}});
    return JSON.stringify({OpenAPI_ServiceResponse:{cmmMsgHeader:{returnReasonCode:'30',returnAuthMsg:'SERVICE_KEY_IS_NOT_REGISTERED_ERROR'}}});};
  const r=await runBidTasks('k',[{from:0,to:1,keyword:'볼트',page:1},{from:0,to:1,keyword:'너트',page:1},{from:0,to:1,keyword:'와셔',page:1}],fetchText);
  assert.equal(r.records.length,100);assert.equal(r.error.code,'30');assert.equal(r.tasks.length,1);assert.equal(r.tasks[0].keyword,'와셔');
  const limited=await runBidTasks('k',Array.from({length:10},()=>({from:0,to:1,keyword:'너트',page:1})),fetchText,3);assert.equal(limited.calls,3);assert.equal(limited.tasks.length,7);
});

test('CSV: 머리글과 확인할 점',()=>{
  const csv=bidsCSV([normalizeBid(item('C1','육각볼트, 너트 구매'),'볼트')]);
  assert.ok(csv.startsWith('﻿공고번호,공고명'));assert.ok(csv.includes('"육각볼트, 너트 구매"'));assert.ok(csv.includes('제한경쟁'));
});

test('Worker: 키 없으면 호출하지 않고, 키가 있으면 모아서 관리자에게만 보여 준다',async()=>{
  const result=await build({entryPoints:['worker/index.mjs'],bundle:true,format:'esm',write:false,external:['cloudflare:workers','cloudflare:sockets'],target:'es2022'});
  const ADMIN='LOCAL_TEST_ONLY_'+'x'.repeat(32);let outbound=0;
  const make=bindings=>new Miniflare(convertV4MiniflareOptions({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2025-09-01',bindings:{PROCUREMENT_ADMIN_KEY:ADMIN,...bindings},durableObjects:{PROCUREMENT:{className:'ProcurementStore',useSQLite:true}},serviceBindings:{ASSETS:async()=>new Response('ok')},
    outboundService:async req=>{outbound++;const u=new URL(req.url);assert.equal(u.hostname,'apis.data.go.kr');const k=u.searchParams.get('bidNtceNm');
      return new Response(k==='스터드'?page([item('S1','스터드볼트(A193 B7) 구매'),item('S2','220볼트 전원장치')]):JSON.stringify({response:{header:{resultCode:'03'},body:{}}}));}}));
  const call=async(mf,path,body,key=ADMIN)=>{const r=await mf.dispatchFetch('https://example.com/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,type:r.headers.get('content-type'),text:await r.text()};};
  const none=make({});
  try{
    const s=JSON.parse((await call(none,'bids')).text);assert.equal(s.state.configured,false);assert.equal(s.bids.length,0);
    await call(none,'bids/run',{});assert.equal(outbound,0);
    assert.equal((await call(none,'bids',null,'wrong')).status,401);
  }finally{await none.dispose();}
  const mf=make({DATA_GO_KR_KEY:'synthetic-key'});
  try{
    let s;for(let i=0;i<4;i++)s=JSON.parse((await call(mf,'bids/run',{})).text);   // 백필은 여러 번에 걸쳐 끝난다
    assert.equal(s.state.configured,true);assert.equal(s.state.pending,0);assert.ok(s.state.lastSuccess);
    assert.deepEqual(s.bids.map(b=>b.id),['S1-000']);assert.equal(s.bids[0].closed,false);
    assert.ok(!JSON.stringify(s).includes('synthetic-key'));
    const csv=await call(mf,'bids.csv');assert.equal(csv.status,200);assert.match(csv.type,/text\/csv/);assert.ok(csv.text.includes('S1-000'));
    const before=outbound;await call(mf,'bids/run',{});assert.equal(outbound,before);   // 할 일이 없으면 부르지 않는다
  }finally{await mf.dispose();}
});
