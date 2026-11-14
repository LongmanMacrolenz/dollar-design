import {DurableObject} from 'cloudflare:workers';
import {connect} from 'cloudflare:sockets';
import {DomainError,text,email,cleanLines,lineConditions,optimizeOffers,createQuote,customerQuote,DEFAULT_MARKUP_PCT} from './domain.mjs';
import {SUPPLIERS} from './suppliers.mjs';
import {authorized,assertSameOrigin,jsonBody,json} from './security.mjs';
import {MAIL_ACCOUNT,MAX_MAIL_BYTES,MailError,mailErrorMessage,ImapClient,parseMail,quotationSubject,buildMessage,sendSMTP,base64,unbase64} from './mail.mjs';
import {productCandidate} from './product.mjs';
import {businessDate} from './dates.mjs';
import {BUSINESS,quoteMessage,inquiryMessage} from './templates.mjs';
import {parseBOM,mailBOM,workflowFor,workflowCSV,requirementsFor,supplierSearches,inquiryConditions,replyTarget,supplierRequest} from './workflow.mjs';

function expectedRevision(body,old){if(old&&body.revision!==old.revision)throw new DomainError('다른 창에서 변경되었습니다. 다시 불러오세요.',409);return body.revision;}
const store=env=>env.PROCUREMENT.get(env.PROCUREMENT.idFromName('boltnote-private-procurement-v1'));
// 문의 집계 (대표 요청 2026-11-10). 공개 주소 /count는 화면·버튼 이름 하나만 받아 날짜별 합계에 1을 더한다.
// 누가 보냈는지(IP·쿠키·기기·참조 주소)는 읽지도 저장하지도 않는다. 이름 목록은 app/src/v9_count.js, site/count.js, worker/client/admin.mjs와 같다.
// probe는 배포 확인용이다(관리자 화면에 보이지 않는다).
export const COUNT_EVENTS=['visit','home','list','materials','copy','rfq','kakao','tel','mail','s-view','s-list','s-kakao','en','probe'];
const COUNT_DAILY_MAX=20000;   // 하루 합계 상한: Durable Object 무료 쓰기 한도(10만 줄/일) 아래에 둔다. 넘으면 버린다
const COUNT_PER_MINUTE=60;     // 격리 단위마다 분당 상한: 과한 요청이 저장소까지 가지 않게 한다
const COUNT_BOT=/bot|crawl|spider|headless|preview|monitor/i;
let countMinute=0,countSeen=0;
const countDone=(status=204)=>new Response(null,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function shortText(request,max){   // 본문을 max바이트까지만 읽는다 (더 길면 null)
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return null;}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
  return new TextDecoder().decode(bytes);
}
async function countPing(request,env){
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
  const site=request.headers.get('sec-fetch-site');
  try{assertSameOrigin(request);if(site&&site!=='same-origin')throw new DomainError('같은 사이트에서 요청하세요.',403);}catch{return countDone(403);}
  const name=await shortText(request,32);
  if(name===null||!COUNT_EVENTS.includes(name))return countDone(400);
  if(COUNT_BOT.test(request.headers.get('user-agent')||''))return countDone();   // 자동 프로그램: 받되 세지 않는다
  const minute=Math.floor(Date.now()/60000);if(minute!==countMinute){countMinute=minute;countSeen=0;}
  if(++countSeen>COUNT_PER_MINUTE)return countDone();
  try{const saved=await store(env).fetch(new Request('https://private/count',{method:'POST',body:name}));return countDone(saved.ok?204:503);}catch{return countDone(503);}
}
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    // 정식 주소는 https://boltnote.net 하나다. 예전 workers.dev 주소와 www는 영구 이동(301)한다.
    // 소유 확인 파일과 /api/ 는 예전 주소에서도 그대로 둔다(검색엔진 재확인·관리 도구 호환).
    {
      const u=new URL(request.url);
      if((u.hostname==='boltnote.boltnote.workers.dev'||u.hostname==='www.boltnote.net')&&(request.method==='GET'||request.method==='HEAD')
        &&!path.startsWith('/api/')&&path!=='/googlee7950c29a2b5a35e.html'&&path!=='/naver873356c1ec7239a24ea882fae7172928.html'&&path!=='/naver12f5e4657429cd6bc694712c3b3be88b.html') {
        return Response.redirect('https://boltnote.net'+u.pathname+u.search,301);
      }
    }
    if(path==='/googlee7950c29a2b5a35e.html'||path==='/naver873356c1ec7239a24ea882fae7172928.html'||path==='/naver12f5e4657429cd6bc694712c3b3be88b.html') {
      // Serve uploaded ownership files at their exact URLs, without asset URL normalization.
      const url=new URL(request.url);url.pathname=path.slice(0,-5);
      return env.ASSETS.fetch(new Request(url,request));
    }
    if(path==='/admin'||path==='/admin/') {
      const url=new URL('/admin/',request.url);const response=await env.ASSETS.fetch(new Request(url,request));
      const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Robots-Tag','noindex, nofollow');
      headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      return new Response(response.body,{status:response.status,headers});
    }
    if(path==='/count') return countPing(request,env);   // 공개: 이름 하나만 받는다. 관리자 키가 없어도 동작한다
    if(!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if(!env.PROCUREMENT_ADMIN_KEY||env.PROCUREMENT_ADMIN_KEY.length<32) return json({error:'관리자 비밀키 설정이 필요합니다.',code:'ADMIN_NOT_CONFIGURED'},503);
    if(!await authorized(request,env.PROCUREMENT_ADMIN_KEY)) return json({error:'관리자 인증이 필요합니다.'},401);
    try {
      if(request.method!=='GET') assertSameOrigin(request);
      return await store(env).fetch(request);
    } catch(e){return json({error:e instanceof DomainError?e.message:'요청을 처리하지 못했습니다.'},e.status||500);}
  },
  async scheduled(_event,env,ctx) {
    if(!env.NAVER_APP_PASSWORD||!env.PROCUREMENT_ADMIN_KEY) return;
    ctx.waitUntil(store(env).fetch(new Request('https://private/scheduled',{method:'POST'})));
  }
};

export class ProcurementStore extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);this.env=env;this.sql=ctx.storage.sql;this.ctx=ctx;
    this.sql.exec('CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(kind,id))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS blobs (id TEXT NOT NULL,part INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(id,part))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS mail_seen (uidvalidity INTEGER NOT NULL,uid INTEGER NOT NULL,message_id TEXT NOT NULL,PRIMARY KEY(uidvalidity,uid))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS counts (day TEXT NOT NULL,event TEXT NOT NULL,n INTEGER NOT NULL,PRIMARY KEY(day,event))');this.countDay='';   // 문의 집계: 날짜(KST)·항목·횟수뿐이다
    if(!this.get('settings','main')) this.put('settings','main',{markupPct:DEFAULT_MARKUP_PCT,fx:{},logistics:{},autoInquiries:true});
    for(const supplier of SUPPLIERS) if(!this.get('supplier',supplier.id)) this.put('supplier',supplier.id,{...supplier,email:'',contactVerified:false});
    this.syncing=null;this.sending=new Set();
  }
  get(kind,id) {const row=this.sql.exec('SELECT data,revision FROM documents WHERE kind=? AND id=?',kind,id).toArray()[0];return row?{...JSON.parse(row.data),revision:row.revision}:null;}
  list(kind) {return this.sql.exec('SELECT data,revision FROM documents WHERE kind=? ORDER BY updated DESC',kind).toArray().map(r=>({...JSON.parse(r.data),revision:r.revision}));}
  put(kind,id,data,expected) {
    const old=this.get(kind,id);if(expected!=null&&old?.revision!==expected) throw new DomainError('다른 창에서 변경되었습니다. 다시 불러오세요.',409);
    const value={...data,id,updatedAt:new Date().toISOString()};delete value.revision;const rev=(old?.revision||0)+1;
    this.sql.exec('INSERT INTO documents VALUES(?,?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated=excluded.updated',kind,id,JSON.stringify(value),rev,value.updatedAt);
    return {...value,revision:rev};
  }
  blobPut(id,bytes) {this.ctx.storage.transactionSync(()=>{this.sql.exec('DELETE FROM blobs WHERE id=?',id);for(let i=0;i<bytes.length;i+=65536)this.sql.exec('INSERT INTO blobs VALUES(?,?,?)',id,i/65536,bytes.slice(i,i+65536).buffer);});}
  blobGet(id) {const rows=this.sql.exec('SELECT data FROM blobs WHERE id=? ORDER BY part',id).toArray();let size=0;for(const r of rows)size+=r.data.byteLength;const bytes=new Uint8Array(size);let p=0;for(const r of rows){bytes.set(new Uint8Array(r.data),p);p+=r.data.byteLength;}return bytes;}
  required(kind,id){const value=this.get(kind,id);if(!value)throw new DomainError('항목을 찾을 수 없습니다.',404);return value;}
  count(name){
    if(!COUNT_EVENTS.includes(name))throw new DomainError('집계 항목이 아닙니다.',400);
    const day=businessDate(Date.now());
    if(day!==this.countDay){this.countDay=day;this.sql.exec('DELETE FROM counts WHERE day<?',businessDate(Date.now()-400*86400000));}   // 약 13개월 지난 합계는 지운다
    if(this.sql.exec('SELECT COALESCE(SUM(n),0) AS n FROM counts WHERE day=?',day).toArray()[0].n>=COUNT_DAILY_MAX)return false;
    this.sql.exec('INSERT INTO counts VALUES(?,?,1) ON CONFLICT(day,event) DO UPDATE SET n=n+1',day,name);return true;
  }
  counts(days=90){const from=businessDate(Date.now()-(days-1)*86400000);return {today:businessDate(Date.now()),from,rows:this.sql.exec('SELECT day,event,n FROM counts WHERE day>=? ORDER BY day DESC,event',from).toArray().map(r=>[r.day,r.event,r.n])};}
  readiness(){return {account:MAIL_ACCOUNT,mailConfigured:!!this.env.NAVER_APP_PASSWORD,adminConfigured:true,sync:this.get('sync','main'),markupPct:this.get('settings','main').markupPct};}
  plan(id){return optimizeOffers(this.required('request',id),this.list('offer').filter(o=>o.requestId===id),this.list('supplier'),this.get('settings','main'));}
  workflow(id){return workflowFor(this.required('request',id),this.list('offer').filter(o=>o.requestId===id));}
  assertInquiryCurrent(out){
    const r=this.required('request',out.requestId),s=this.required('supplier',out.supplierId);
    if((out.requestBasis?inquiryConditions(r)!==out.requestBasis:r.revision!==out.requestRevision)||s.revision!==out.supplierRevision||!s.contactVerified||s.email!==out.to)throw new DomainError('공급처나 품목·특수요건이 변경되었습니다. 문의를 다시 작성하세요.',409);
  }
  async inquiryBatch(requestId,{automatic=false}={}){
    const req=this.required('request',requestId);
    if(!req.lines?.length)throw new DomainError('BOM 품목을 먼저 확인하세요.');
    const settings=this.get('settings','main'),out=[],skipped=[];
    const basis=inquiryConditions(req);
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(basis)));
    const hash=[...digest].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24);
    if(inquiryConditions(this.required('request',requestId))!==basis)throw new DomainError('BOM이 변경되었습니다. 다시 분석하세요.',409);
    for(const s of this.list('supplier')){
      if(!s.contactVerified||!s.email||s.autoInquiry===false){skipped.push({supplierId:s.id,reason:'공식 견적 연락처·자동 문의 대상 확인이 필요합니다.'});continue;}
      const id='rfq-'+req.id+'-'+s.id+'-'+hash+'-'+s.revision;
      const old=this.get('outbox',id);if(old){out.push(old);continue;}
      const canQueue=automatic&&settings.autoInquiries!==false&&!!this.env.NAVER_APP_PASSWORD&&(!req.intakeIssues?.length||req.intakeReviewed===true);
      const safe=supplierRequest(req),packet=workflowFor(safe);
      const o=this.put('outbox',id,{kind:'inquiry',requestId:req.id,requestRevision:req.revision,requestBasis:basis,supplierId:s.id,supplierRevision:s.revision,to:s.email,...inquiryMessage(safe,s),status:canQueue?'queued':'draft',automatic:canQueue,cdCSV:workflowCSV(safe,packet),cdFilename:req.number+'-RFQ-CD.csv'});
      out.push(o);if(canQueue)this.ctx.waitUntil(this.deliver(o.id));
    }
    return {outbox:out,skipped,workflow:this.workflow(req.id)};
  }
  async fetch(request) {
    const path=new URL(request.url).pathname;
    try {
      if(path==='/scheduled'){await this.sync();await this.flush();return json({ok:true});}
      if(path==='/count')return json({counted:this.count(await request.text())});   // Worker의 countPing만 부른다 (밖에서는 /api/*만 여기로 온다)
      if(request.method==='GET') {
        if(path==='/api/counts')return json(this.counts());
        if(path==='/api/state')return json({readiness:this.readiness(),requests:this.list('request'),suppliers:SUPPLIERS.map(s=>this.get('supplier',s.id)),settings:this.get('settings','main'),outbox:this.list('outbox'),quotes:this.list('quote').map(customerQuote),mail:this.list('mail').map(({body,...m})=>m),business:BUSINESS});
        let m=path.match(/^\/api\/requests\/([^/]+)$/);if(m){const req=this.required('request',m[1]);return json({request:req,offers:this.list('offer').filter(o=>o.requestId===m[1]),plan:this.plan(m[1]),workflow:this.workflow(m[1]),requirements:req.lines?.map(l=>({lineId:l.id,rows:requirementsFor(l,req),searches:supplierSearches(l,this.list('supplier'))}))||[],replies:this.list('mail').filter(m=>m.requestId===req.id),inquiries:this.list('outbox').filter(o=>o.requestId===req.id&&o.kind==='inquiry')});}
        m=path.match(/^\/api\/requests\/([^/]+)\/workflow.csv$/);if(m){const req=this.required('request',m[1]);return new Response(workflowCSV(req,this.workflow(req.id)),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${req.number}-CD.csv"`,'Cache-Control':'no-store'}});}
        m=path.match(/^\/api\/mail\/([^/]+)$/);if(m)return json(this.required('mail',m[1]));
        m=path.match(/^\/api\/mail\/([^/]+)\/eml$/);if(m){this.required('mail',m[1]);return new Response(this.blobGet('mail:'+m[1]),{headers:{'Content-Type':'message/rfc822','Content-Disposition':'attachment; filename="request.eml"','Cache-Control':'no-store'}});}
        m=path.match(/^\/api\/quotes\/([^/]+)$/);if(m){const q=this.required('quote',m[1]);return json({quote:customerQuote(q),business:BUSINESS});}
      }
      if(request.method!=='POST')throw new DomainError('지원하지 않는 요청입니다.',405);
      const body=await jsonBody(request);
      if(path==='/api/sync'){await this.sync();return json(this.readiness());}
      if(path==='/api/bom/preview')return json(parseBOM(body.raw,{specialRequirements:body.specialRequirements,source:body.source||'고객 BOM'}));
      if(path==='/api/workflow/run')return json(await this.inquiryBatch(body.requestId,{automatic:true}));
      if(path==='/api/settings') {
        const markupPct=Number(body.markupPct);if(!Number.isFinite(markupPct)||markupPct<0||markupPct>500)throw new DomainError('가산율을 확인하세요.');
        return json(this.put('settings','main',{markupPct,fx:body.fx||{},logistics:body.logistics||{},autoInquiries:body.autoInquiries!==false},expectedRevision(body,this.get('settings','main'))));
      }
      if(path==='/api/suppliers') {
        const old=this.required('supplier',text(body.id,80));let home=old.home,domains=old.domains;
        if(['koreabolt','hwashin'].includes(old.id)&&body.home) {
          const url=new URL(body.home);if(url.protocol!=='https:'||url.username||url.password||url.port||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)||/\.(local|internal|localhost)$/i.test(url.hostname))throw new DomainError('공식 HTTPS 홈페이지를 확인하세요.');
          home=url.origin;domains=[url.hostname];
        }
        const address=body.email?email(body.email):'';
        return json(this.put('supplier',old.id,{...old,home,domains,email:address,contactVerified:!!address&&body.contactVerified===true,autoInquiry:body.autoInquiry!==false},expectedRevision(body,old)));
      }
      if(path==='/api/requests') {
        const id=body.id?text(body.id,80):crypto.randomUUID();const old=this.get('request',id);
        if(body.id&&!old)throw new DomainError('요청을 찾을 수 없습니다.',404);
        if(String(body.specialRequirements||'').length>4000)throw new DomainError('공통 특수요건은 4,000자 이내로 입력하세요.');
        const basisDocuments=Array.isArray(body.basisDocuments)?body.basisDocuments.map(d=>({id:text(d.id,80)||crypto.randomUUID(),name:text(d.name,200),kind:['drawing','specification','bom','other'].includes(d.kind)?d.kind:'other',reference:text(d.reference,200),revision:text(d.revision,100),reviewed:d.reviewed===true})):old?.basisDocuments||[];
        if(basisDocuments.length>50||basisDocuments.some(d=>!d.name)||new Set(basisDocuments.map(d=>d.id)).size!==basisDocuments.length)throw new DomainError('검토 문서의 이름·고유 번호와 50개 이내 목록을 확인하세요.');
        const value={...old,number:old?.number||'BNQ-'+id.slice(0,8).toUpperCase(),subject:text(body.subject,1000),customerName:text(body.customerName,200),customerEmail:email(body.customerEmail),lines:cleanLines(body.lines).map(l=>({...l,requirementsReview:!old?.lines?.some(before=>before.id===l.id)||old.lines.find(before=>before.id===l.id)?.requirementsReview||l.requirementsReview||!!l.specialRequirements||!!body.specialRequirements||!!basisDocuments.length})),specialRequirements:text(body.specialRequirements,4000),basisDocuments,intakeReviewed:body.intakeReviewed===true,status:'review',mailId:old?.mailId||'',createdAt:old?.createdAt||new Date().toISOString()};
        const revision=old?expectedRevision(body,old):undefined;
        const saved=this.ctx.storage.transactionSync(()=>{
          const saved=this.put('request',id,value,revision);
          if(old)for(const offer of this.list('offer').filter(o=>o.requestId===id)){
            const before=old.lines.find(l=>l.id===offer.lineId),after=saved.lines.find(l=>l.id===offer.lineId);
            if(lineConditions(before)!==lineConditions(after)||old.specialRequirements!==saved.specialRequirements||JSON.stringify(old.basisDocuments||[])!==JSON.stringify(saved.basisDocuments||[]))this.put('offer',offer.id,{...offer,checks:{},requirementResponses:{},confirmedAt:'',evidenceType:'',confirmationReset:'고객 사양·수량·서류 요구가 변경되었습니다. 공급처 조건을 다시 확인하세요.'},offer.revision);
          }
          return saved;
        });
        if(saved.lines.some(l=>l.requirementsReview))await this.inquiryBatch(saved.id,{automatic:true});
        return json(saved);
      }
      if(path==='/api/offers') {
        const req=this.required('request',text(body.requestId,80));if(!req.lines.some(l=>l.id===body.lineId))throw new DomainError('품목을 확인하세요.');
        const supplier=this.required('supplier',text(body.supplierId,80));const id=body.id?text(body.id,80):crypto.randomUUID();const old=this.get('offer',id);
        if(old&&(old.requestId!==req.id||old.lineId!==body.lineId))throw new DomainError('공급 조건이 다른 요청에 속합니다.');
        const requirementResponses={};for(const r of requirementsFor(req.lines.find(l=>l.id===body.lineId),req)){const v=body.requirementResponses?.[r.id];if(v)requirementResponses[r.id]={status:['confirmed','clarification','deviation'].includes(v.status)?v.status:'clarification',offered:text(v.offered,4000),evidence:text(v.evidence,4000)};}
        const offer={requestId:req.id,lineId:body.lineId,supplierId:supplier.id,sku:text(body.sku,160),price:body.price,currency:text(body.currency,3).toUpperCase(),unit:text(body.unit,12),priceBasis:body.priceBasis,packSize:body.packSize,minOrderQty:body.minOrderQty,availableQty:body.availableQty,leadDays:body.leadDays,confirmedAt:text(body.confirmedAt,40),expiresAt:text(body.expiresAt,40),evidenceType:text(body.evidenceType,30),evidence:text(body.evidence,8000),checks:body.checks||{},requirementResponses,documents:text(body.documents,2000),importCostKRW:body.importCostKRW,importBasis:text(body.importBasis,2000),url:text(body.url,2000)};
        return json(this.put('offer',id,offer,old?expectedRevision(body,old):undefined));
      }
      if(path==='/api/candidate')return json(await productCandidate(body.url,this.required('supplier',body.supplierId)));
      if(path==='/api/quotes') {
        if(!text(body.notes,4000))throw new DomainError('결제·납기 기산일·배송지 등 고객에게 안내할 조건을 적으세요.');
        const req=this.required('request',body.requestId),settings=this.get('settings','main'),plan=this.plan(req.id);
        const quote=createQuote(req,plan,{markupPct:settings.markupPct,validUntil:body.validUntil,notes:body.notes});
        const id=crypto.randomUUID();return json(customerQuote(this.put('quote',id,{...quote,number:'BN-'+businessDate(new Date()).replaceAll('-','')+'-'+id.slice(0,6).toUpperCase(),requestRevision:req.revision,settingsRevision:settings.revision,offerRevisions:plan.selected.map(c=>({id:c.offer.id,revision:c.offer.revision})),status:'draft'})));
      }
      if(path==='/api/inquiries') {
        const req=this.required('request',body.requestId),supplier=this.required('supplier',body.supplierId);
        if(!req.lines?.length)throw new DomainError('품목을 먼저 확인하세요.');
        if(!supplier.email||!supplier.contactVerified)throw new DomainError('공식 공급처 연락처를 확인해 등록하세요.');
        return json(this.put('outbox',crypto.randomUUID(),{kind:'inquiry',requestId:req.id,requestRevision:req.revision,requestBasis:inquiryConditions(req),supplierId:supplier.id,supplierRevision:supplier.revision,to:supplier.email,...inquiryMessage(supplierRequest(req),supplier),cdCSV:workflowCSV(supplierRequest(req),workflowFor(supplierRequest(req))),cdFilename:req.number+'-RFQ-CD.csv',status:'draft'}));
      }
      if(path==='/api/quotes/send') {
        const q=this.required('quote',body.id);this.assertQuoteCurrent(q);
        if(!this.env.NAVER_APP_PASSWORD)throw new DomainError('네이버 앱 비밀번호 설정이 필요합니다.',503);
        if(body.revision!==q.revision||body.reviewed!==true)throw new DomainError('최종 견적을 확인한 뒤 발송하세요.',409);
        const id='quote-'+q.id;const existing=this.get('outbox',id);if(existing)return json(existing);
        const bytes=unbase64(String(body.pdf||''));if(bytes.length<100||bytes.length>2*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new DomainError('견적서 PDF를 확인하세요.');
        this.blobPut('pdf:'+q.id,bytes);const out=this.put('outbox',id,{kind:'quote',quoteId:q.id,quoteRevision:q.revision,to:q.customerEmail,...quoteMessage(customerQuote(q)),status:'queued'});
        this.ctx.waitUntil(this.deliver(out.id));return json(out);
      }
      if(path==='/api/outbox/retry') {
        if(!this.env.NAVER_APP_PASSWORD)throw new DomainError('네이버 앱 비밀번호 설정이 필요합니다.',503);
        const out=this.required('outbox',body.id);
        if(out.status!=='failed'||body.reviewed!==true)throw new DomainError('발송 실패가 확인된 메일만 재시도할 수 있습니다.',409);
        expectedRevision(body,out);
        const queued=this.put('outbox',out.id,{...out,status:'queued',automatic:false,errorCode:''},out.revision);
        this.ctx.waitUntil(this.deliver(out.id));return json(queued);
      }
      if(path==='/api/outbox/send') {
        if(!this.env.NAVER_APP_PASSWORD)throw new DomainError('네이버 앱 비밀번호 설정이 필요합니다.',503);
        const out=this.required('outbox',body.id);
        if(body.reviewed!==true||out.status!=='draft'||body.revision!==out.revision)throw new DomainError('문의 메일을 확인한 뒤 발송하세요.',409);
        this.assertInquiryCurrent(out);
        const queued=this.put('outbox',out.id,{...out,status:'queued'},out.revision);this.ctx.waitUntil(this.deliver(out.id));return json(queued);
      }
      throw new DomainError('요청을 찾을 수 없습니다.',404);
    }catch(e){return json({error:e instanceof DomainError?e.message:e instanceof MailError?mailErrorMessage(e.code):'요청을 처리하지 못했습니다.',code:e.code||undefined},e.status||500);}
  }
  assertQuoteCurrent(q) {
    const req=this.required('request',q.requestId),settings=this.get('settings','main');
    if(req.revision!==q.requestRevision||settings.revision!==q.settingsRevision||q.offerRevisions.some(o=>this.get('offer',o.id)?.revision!==o.revision))throw new DomainError('품목 또는 공급 조건이 변경되었습니다. 견적서를 다시 작성하세요.',409);
    if(Date.parse(q.validUntil)<=Date.now())throw new DomainError('견적 유효기간이 지났습니다.',409);
    const plan=this.plan(req.id);if(!plan.ready)throw new DomainError('공급 조건을 다시 확인하세요.',409);
  }
  socket(hostname,port){return connect({hostname,port},{secureTransport:'on',allowHalfOpen:false});}
  async sync() {
    if(this.syncing)return this.syncing;
    if(!this.env.NAVER_APP_PASSWORD)throw new DomainError('네이버 앱 비밀번호 설정이 필요합니다.',503);
    this.syncing=this.syncMail();try{return await this.syncing;}finally{this.syncing=null;}
  }
  async syncMail() {
    const socket=this.socket('imap.naver.com',993),client=new ImapClient(socket);let imported=0;
    try {
      await client.open(this.env.NAVER_APP_PASSWORD);const prev=this.get('sync','main');let lastUID=prev?.uidvalidity===client.validity?prev.lastUID||0:0;
      for(const uid of await client.search(lastUID)) {
        const header=await parseMail(await client.fetch(uid,true));
        if(quotationSubject(header.subject)||replyTarget(header,this.list('request'),this.list('outbox'),this.list('supplier')).inquiry) {
          if(!this.sql.exec('SELECT uid FROM mail_seen WHERE uidvalidity=? AND uid=?',client.validity,uid).toArray().length) {
            let mail,raw;if(await client.size(uid)<=MAX_MAIL_BYTES){raw=await client.fetch(uid);mail=await parseMail(raw);}else{mail={...header,body:'메일이 8MB보다 큽니다. 네이버 메일에서 원본과 첨부파일을 직접 확인하세요.',attachments:[],oversized:true};}
            if(!mail.messageId||!this.list('mail').some(m=>m.messageId===mail.messageId)) {
              const id=crypto.randomUUID();if(raw)this.blobPut('mail:'+id,raw);
              this.put('mail',id,{...mail,uid,uidvalidity:client.validity,receivedAt:new Date().toISOString()});
              const {request:linked,supplier,inquiry}=replyTarget(mail,this.list('request'),this.list('outbox'),this.list('supplier'));
              if(!linked&&!supplier){const intake=mailBOM(mail);const req=this.put('request',id,{number:'BNQ-'+id.slice(0,8).toUpperCase(),subject:mail.subject,customerName:mail.fromName,customerEmail:mail.from,...intake,status:intake.lines.length?'review':'intake',mailId:id,createdAt:new Date().toISOString()});if(intake.lines.length)await this.inquiryBatch(req.id,{automatic:true});}
              else this.put('mail',id,{...this.get('mail',id),requestId:linked?.id||'',supplierId:supplier?.id||'',inquiryId:inquiry?.id||'',replyReview:linked?'발신자 진위·회신 원문·품번·각 요건을 검토하세요. 자동 준수 판정하지 않습니다.':'어느 고객 요청의 회신인지 확인하세요. 공급처 회신을 새 고객 BOM으로 처리하거나 다른 공급처에 전달하지 않습니다.'});
              imported++;
            }
            this.sql.exec('INSERT OR IGNORE INTO mail_seen VALUES(?,?,?)',client.validity,uid,mail.messageId||'');
          }
        }
        lastUID=uid;this.put('sync','main',{uidvalidity:client.validity,lastUID,lastSuccess:new Date().toISOString(),imported,status:'connected'});
      }
      this.put('sync','main',{uidvalidity:client.validity,lastUID,lastSuccess:new Date().toISOString(),imported,status:'connected'});return {imported};
    }catch(e){const old=this.get('sync','main')||{};this.put('sync','main',{...old,lastAttempt:new Date().toISOString(),status:'error',errorCode:e.code||'MAIL_CONNECTION_ERROR'});throw e;}
    finally{await client.close();}
  }
  async deliver(id) {
    if(this.sending.has(id))return;this.sending.add(id);
    let out=this.required('outbox',id);
    try {
      if(out.status!=='queued')return;
      if(!this.env.NAVER_APP_PASSWORD)throw new MailError('NAVER_NOT_CONFIGURED');
      if(out.automatic&&(this.get('settings','main').autoInquiries===false||this.get('supplier',out.supplierId)?.autoInquiry===false))throw new DomainError('자동 문의 설정이 해제되었습니다.',409);
      if(out.kind==='quote')this.assertQuoteCurrent(this.required('quote',out.quoteId));
      else this.assertInquiryCurrent(out);
      out=this.put('outbox',id,{...out,status:'sending',startedAt:new Date().toISOString()});
      const q=out.kind==='quote'?this.required('quote',out.quoteId):null;
      const attachment=q?{filename:q.number+'.pdf',bytes:this.blobGet('pdf:'+q.id)}:out.cdCSV?{filename:out.cdFilename,bytes:new TextEncoder().encode(out.cdCSV),type:'text/csv'}:undefined;
      const req=q?this.required('request',q.requestId):null;const reply=req?.mailId?this.get('mail',req.mailId)?.messageId:undefined;
      const message=buildMessage({...out,attachment,messageId:id,replyToMessageId:reply});
      await sendSMTP(this.socket('smtp.naver.com',465),this.env.NAVER_APP_PASSWORD,out.to,message);
      this.put('outbox',id,{...out,status:'accepted',acceptedAt:new Date().toISOString(),errorCode:''});
    }catch(e){this.put('outbox',id,{...out,status:e.deliveryUnknown?'delivery_unknown':'failed',errorCode:e.code||'CONDITIONS_CHANGED',finishedAt:new Date().toISOString()});}
    finally{this.sending.delete(id);}
  }
  async flush() {
    for(const out of this.list('outbox')) {
      if(out.status==='sending'&&Date.now()-Date.parse(out.startedAt)>300000&&!this.sending.has(out.id))this.put('outbox',out.id,{...out,status:'delivery_unknown',errorCode:'INTERRUPTED_DURING_SEND'});
      // Unknown or failed deliveries require a new explicit owner decision.
      if(out.status==='queued')await this.deliver(out.id);
    }
  }
}
