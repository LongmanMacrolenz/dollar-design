import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {quotePDF} from '../client/pdf.mjs';
import {PDFDocument} from 'pdf-lib';
import {CHECKS} from '../domain.mjs';
const LOCAL_KEY='LOCAL_TEST_ONLY_'+'x'.repeat(32);

test('real Worker SQLite flow: authentication, stale revisions, supplier gating, quote privacy and mail readiness',async()=>{
  const result=await build({entryPoints:['worker/index.mjs'],bundle:true,format:'esm',write:false,external:['cloudflare:workers','cloudflare:sockets'],target:'es2022'});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2025-09-01',bindings:{PROCUREMENT_ADMIN_KEY:LOCAL_KEY},durableObjects:{PROCUREMENT:{className:'ProcurementStore',useSQLite:true}},serviceBindings:{ASSETS:async()=>new Response('<html>public asset</html>',{headers:{'Content-Type':'text/html'}})}}));
  try{
    const send=async(path,body,key=LOCAL_KEY)=>{const r=await mf.dispatchFetch('https://example.com/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {...await r.json(),httpStatus:r.status};};
    assert.equal((await send('state',null,'wrong')).httpStatus,401);
    assert.equal((await mf.dispatchFetch('https://example.com/')).status,200);
    const state=await send('state');assert.equal(state.readiness.mailConfigured,false);assert.equal(state.settings.markupPct,20);assert.equal(state.suppliers.length,6);
    const line={id:'line-test',description:'시험용 볼트',spec:'시험 사양',qty:10,unit:'EA'};
    const req=await send('requests',{customerName:'테스트',customerEmail:'customer@example.com',subject:'시험 견적',lines:[line]});assert.equal(req.httpStatus,200);
    assert.equal((await send('requests',{...req,revision:999})).httpStatus,409);
    assert.equal((await send('inquiries',{requestId:req.id,supplierId:'koreabolt'})).httpStatus,400);
    const settings=await send('settings',{revision:state.settings.revision,markupPct:20,logistics:{misumi:{shippingKRW:0,evidence:'시험 무료 운송'}},fx:{}});assert.equal(settings.httpStatus,200);
    const offer=await send('offers',{requestId:req.id,lineId:'line-test',supplierId:'misumi',sku:'TEST-01',unit:'EA',priceBasis:'EA',price:100,packSize:1,minOrderQty:1,availableQty:100,leadDays:3,currency:'KRW',confirmedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000*10).toISOString(),evidenceType:'supplier_reply',evidence:'시험 회신',checks:Object.fromEntries(CHECKS.map(k=>[k,'confirmed']))});assert.equal(offer.httpStatus,200);
    const q=await send('quotes',{requestId:req.id,validUntil:new Date(Date.now()+86400000).toISOString(),notes:'시험 조건'});assert.equal(q.httpStatus,200);assert.equal(q.netKRW,1200);assert.equal(q.totalKRW,1320);assert.equal(q.costKRW,undefined);assert.equal(q.selection,undefined);assert.equal(q.offerRevisions,undefined);
    assert.equal((await send('sync',{})).httpStatus,503);
    const changed=await send('offers',{...offer,price:120});assert.equal(changed.httpStatus,200);
    assert.equal((await send('quotes/send',{id:q.id,revision:q.revision,reviewed:true,pdf:'not-a-pdf'})).httpStatus,409);
    const badOrigin=await mf.dispatchFetch('https://example.com/api/settings',{method:'POST',headers:{Origin:'https://evil.example',Authorization:'Bearer '+LOCAL_KEY}});assert.equal(badOrigin.status,403);
    const admin=await mf.dispatchFetch('https://example.com/admin');assert.match(admin.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(admin.headers.get('x-robots-tag'),/noindex/);
  }finally{await mf.dispose();}
});
test('Korean customer PDF embeds its full Korean font, paginates and has no private prices',async()=>{
  const lines=Array.from({length:40},(_,i)=>({no:i+1,description:'한국어 시험 볼트',spec:'사양 확인 · M12×1.75 · 표면처리 확인',qty:10,unit:'EA',unitPriceKRW:120,amountKRW:1200,leadDays:3,documents:'서류 없음 확인'}));
  const bytes=await quotePDF({number:'BN-TEST',customerName:'테스트',customerEmail:'customer@example.com',createdAt:new Date().toISOString(),validUntil:new Date().toISOString(),lines,netKRW:48000,vatKRW:4800,totalKRW:52800,terms:'결제·배송 조건 테스트'},{name:'볼트노트',owner:'테스트',number:'TEST',email:'test@example.com'},await readFile('worker/assets/GothicA1-Regular.ttf'));
  assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');assert(bytes.length<2*1024*1024);const pdf=await PDFDocument.load(bytes);assert(pdf.getPageCount()>1);assert.equal(pdf.getTitle(),'BN-TEST · 볼트노트 견적서');
});
