import {DurableObject} from 'cloudflare:workers';
import {connect} from 'cloudflare:sockets';
import {DomainError,text,email,cleanLines,optimizeOffers,createQuote,customerQuote,DEFAULT_MARKUP_PCT} from './domain.mjs';
import {SUPPLIERS} from './suppliers.mjs';
import {authorized,assertSameOrigin,jsonBody,json} from './security.mjs';
import {MAIL_ACCOUNT,MAX_MAIL_BYTES,MailError,mailErrorMessage,ImapClient,parseMail,quotationSubject,buildMessage,sendSMTP,base64,unbase64} from './mail.mjs';
import {productCandidate} from './product.mjs';
import {businessDate} from './dates.mjs';
import {BUSINESS,quoteMessage,inquiryMessage} from './templates.mjs';

function expectedRevision(body,old){if(old&&body.revision!==old.revision)throw new DomainError('다른 창에서 변경되었습니다. 다시 불러오세요.',409);return body.revision;}
const store=env=>env.PROCUREMENT.get(env.PROCUREMENT.idFromName('boltnote-private-procurement-v1'));
export default {
  async fetch(request,env) {
    const path=new URL(request.url).pathname;
    if(path==='/admin'||path==='/admin/') {
      const url=new URL('/admin/',request.url);const response=await env.ASSETS.fetch(new Request(url,request));
      const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Robots-Tag','noindex, nofollow');
      headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      return new Response(response.body,{status:response.status,headers});
    }
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
    if(!this.get('settings','main')) this.put('settings','main',{markupPct:DEFAULT_MARKUP_PCT,fx:{},logistics:{}});
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
  readiness(){return {account:MAIL_ACCOUNT,mailConfigured:!!this.env.NAVER_APP_PASSWORD,adminConfigured:true,sync:this.get('sync','main'),markupPct:this.get('settings','main').markupPct};}
  plan(id){return optimizeOffers(this.required('request',id),this.list('offer').filter(o=>o.requestId===id),this.list('supplier'),this.get('settings','main'));}
  async fetch(request) {
    const path=new URL(request.url).pathname;
    try {
      if(path==='/scheduled'){await this.sync();await this.flush();return json({ok:true});}
      if(request.method==='GET') {
        if(path==='/api/state')return json({readiness:this.readiness(),requests:this.list('request'),suppliers:SUPPLIERS.map(s=>this.get('supplier',s.id)),settings:this.get('settings','main'),outbox:this.list('outbox'),quotes:this.list('quote').map(customerQuote),mail:this.list('mail').map(({body,...m})=>m),business:BUSINESS});
        let m=path.match(/^\/api\/requests\/([^/]+)$/);if(m)return json({request:this.required('request',m[1]),offers:this.list('offer').filter(o=>o.requestId===m[1]),plan:this.plan(m[1])});
        m=path.match(/^\/api\/mail\/([^/]+)$/);if(m)return json(this.required('mail',m[1]));
        m=path.match(/^\/api\/mail\/([^/]+)\/eml$/);if(m){this.required('mail',m[1]);return new Response(this.blobGet('mail:'+m[1]),{headers:{'Content-Type':'message/rfc822','Content-Disposition':'attachment; filename="request.eml"','Cache-Control':'no-store'}});}
        m=path.match(/^\/api\/quotes\/([^/]+)$/);if(m){const q=this.required('quote',m[1]);return json({quote:customerQuote(q),business:BUSINESS});}
      }
      if(request.method!=='POST')throw new DomainError('지원하지 않는 요청입니다.',405);
      const body=await jsonBody(request);
      if(path==='/api/sync'){await this.sync();return json(this.readiness());}
      if(path==='/api/settings') {
        const markupPct=Number(body.markupPct);if(!Number.isFinite(markupPct)||markupPct<0||markupPct>500)throw new DomainError('가산율을 확인하세요.');
        return json(this.put('settings','main',{markupPct,fx:body.fx||{},logistics:body.logistics||{}},expectedRevision(body,this.get('settings','main'))));
      }
      if(path==='/api/suppliers') {
        const old=this.required('supplier',text(body.id,80));let home=old.home,domains=old.domains;
        if(['koreabolt','hwashin'].includes(old.id)&&body.home) {
          const url=new URL(body.home);if(url.protocol!=='https:'||url.username||url.password||url.port||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)||/\.(local|internal|localhost)$/i.test(url.hostname))throw new DomainError('공식 HTTPS 홈페이지를 확인하세요.');
          home=url.origin;domains=[url.hostname];
        }
        const address=body.email?email(body.email):'';
        return json(this.put('supplier',old.id,{...old,home,domains,email:address,contactVerified:!!address&&body.contactVerified===true},expectedRevision(body,old)));
      }
      if(path==='/api/requests') {
        const id=body.id?text(body.id,80):crypto.randomUUID();const old=this.get('request',id);
        if(body.id&&!old)throw new DomainError('요청을 찾을 수 없습니다.',404);
        const value={...old,number:old?.number||'BNQ-'+id.slice(0,8).toUpperCase(),subject:text(body.subject,1000),customerName:text(body.customerName,200),customerEmail:email(body.customerEmail),lines:cleanLines(body.lines),status:'review',mailId:old?.mailId||'',createdAt:old?.createdAt||new Date().toISOString()};
        return json(this.put('request',id,value,old?expectedRevision(body,old):undefined));
      }
      if(path==='/api/offers') {
        const req=this.required('request',text(body.requestId,80));if(!req.lines.some(l=>l.id===body.lineId))throw new DomainError('품목을 확인하세요.');
        const supplier=this.required('supplier',text(body.supplierId,80));const id=body.id?text(body.id,80):crypto.randomUUID();const old=this.get('offer',id);
        if(old&&(old.requestId!==req.id||old.lineId!==body.lineId))throw new DomainError('공급 조건이 다른 요청에 속합니다.');
        const offer={requestId:req.id,lineId:body.lineId,supplierId:supplier.id,sku:text(body.sku,160),price:body.price,currency:text(body.currency,3).toUpperCase(),unit:text(body.unit,12),priceBasis:body.priceBasis,packSize:body.packSize,minOrderQty:body.minOrderQty,availableQty:body.availableQty,leadDays:body.leadDays,confirmedAt:text(body.confirmedAt,40),expiresAt:text(body.expiresAt,40),evidenceType:text(body.evidenceType,30),evidence:text(body.evidence,8000),checks:body.checks||{},documents:text(body.documents,2000),importCostKRW:body.importCostKRW,importBasis:text(body.importBasis,2000),url:text(body.url,2000)};
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
        return json(this.put('outbox',crypto.randomUUID(),{kind:'inquiry',requestId:req.id,requestRevision:req.revision,supplierId:supplier.id,supplierRevision:supplier.revision,to:supplier.email,...inquiryMessage(req,supplier),status:'draft'}));
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
        const queued=this.put('outbox',out.id,{...out,status:'queued',errorCode:''},out.revision);
        this.ctx.waitUntil(this.deliver(out.id));return json(queued);
      }
      if(path==='/api/outbox/send') {
        if(!this.env.NAVER_APP_PASSWORD)throw new DomainError('네이버 앱 비밀번호 설정이 필요합니다.',503);
        const out=this.required('outbox',body.id);
        if(body.reviewed!==true||out.status!=='draft'||body.revision!==out.revision)throw new DomainError('문의 메일을 확인한 뒤 발송하세요.',409);
        const req=this.required('request',out.requestId),s=this.required('supplier',out.supplierId);
        if(req.revision!==out.requestRevision||s.revision!==out.supplierRevision||!s.contactVerified||s.email!==out.to)throw new DomainError('공급처나 품목이 변경되었습니다. 문의를 다시 작성하세요.',409);
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
        if(quotationSubject(header.subject)) {
          if(!this.sql.exec('SELECT uid FROM mail_seen WHERE uidvalidity=? AND uid=?',client.validity,uid).toArray().length) {
            let mail,raw;if(await client.size(uid)<=MAX_MAIL_BYTES){raw=await client.fetch(uid);mail=await parseMail(raw);}else{mail={...header,body:'메일이 8MB보다 큽니다. 네이버 메일에서 원본과 첨부파일을 직접 확인하세요.',attachments:[],oversized:true};}
            if(!mail.messageId||!this.list('mail').some(m=>m.messageId===mail.messageId)) {
              const id=crypto.randomUUID();if(raw)this.blobPut('mail:'+id,raw);
              this.put('mail',id,{...mail,uid,uidvalidity:client.validity,receivedAt:new Date().toISOString()});
              const ref=mail.subject.match(/\[(BNQ-[A-Z0-9]+)\]/i)?.[1];const linked=ref&&this.list('request').find(r=>r.number===ref.toUpperCase());
              if(!linked)this.put('request',id,{number:'BNQ-'+id.slice(0,8).toUpperCase(),subject:mail.subject,customerName:mail.fromName,customerEmail:mail.from,lines:[],status:'intake',mailId:id,createdAt:new Date().toISOString()});
              else this.put('mail',id,{...this.get('mail',id),requestId:linked.id});
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
      if(out.kind==='quote')this.assertQuoteCurrent(this.required('quote',out.quoteId));
      else {const r=this.required('request',out.requestId),s=this.required('supplier',out.supplierId);if(r.revision!==out.requestRevision||s.revision!==out.supplierRevision||s.email!==out.to)throw new DomainError('문의 조건이 변경되었습니다.',409);}
      out=this.put('outbox',id,{...out,status:'sending',startedAt:new Date().toISOString()});
      const q=out.kind==='quote'?this.required('quote',out.quoteId):null;
      const attachment=q?{filename:q.number+'.pdf',bytes:this.blobGet('pdf:'+q.id)}:undefined;
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
