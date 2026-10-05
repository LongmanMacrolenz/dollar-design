import test from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {CHECKS} from '../domain.mjs';
const key='LOCAL_TEST_ONLY_'+'x'.repeat(32);
test('real SQLite + synthetic IMAP/SMTP: BOM intake → deduplicated automatic RFQ/C&D → evidence and document gate → changed requirements invalidate offers',async()=>{
 const sockets=await readFile('worker/tests/fake-mail.mjs','utf8');
 const result=await build({entryPoints:['worker/index.mjs'],bundle:true,format:'esm',write:false,external:['cloudflare:workers'],target:'es2022',plugins:[{name:'test-mail',setup(b){b.onResolve({filter:/^cloudflare:sockets$/},()=>({path:'synthetic-mail',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:sockets,loader:'js'}));}}]});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2025-09-01',bindings:{PROCUREMENT_ADMIN_KEY:key,NAVER_APP_PASSWORD:'LOCAL_SYNTHETIC_MAIL_ONLY'},durableObjects:{PROCUREMENT:{className:'ProcurementStore',useSQLite:true}},serviceBindings:{ASSETS:()=>new Response('test')}}));
 const send=async(path,body)=>{const r=await mf.dispatchFetch('https://example.com/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {...await r.json(),httpStatus:r.status};};
 try{
  let state=await send('state');const supplier=state.suppliers.find(s=>s.id==='misumi');await send('suppliers',{...supplier,email:'test-supplier@example.com',contactVerified:true,autoInquiry:true});
  assert.equal((await send('sync',{})).httpStatus,200);
  state=await send('state');assert.equal(state.requests.length,1);assert.equal(state.requests[0].lines[0].qty,20);assert.match(state.requests[0].specialRequirements,/No substitutions/);
  let detail=await send('requests/'+state.requests[0].id),req=detail.request;assert(detail.workflow.pending>0);assert.equal(state.outbox.length,1);assert.match(state.outbox[0].plain,/special:sour/);assert.match(state.outbox[0].cdCSV,/C/);assert(!state.outbox[0].plain.includes('buyer@example.com'));
  for(let i=0;i<8&&state.outbox[0].status!=='accepted';i++)state=await send('state');assert.equal(state.outbox[0].status,'accepted');
  assert.equal((await send('sync',{})).httpStatus,200);await send('workflow/run',{requestId:req.id});assert.equal((await send('state')).outbox.length,1);
  const line=req.lines[0],requirements=detail.requirements[0].rows;
  const offer={requestId:req.id,lineId:line.id,supplierId:'misumi',sku:'TEST-EXACT',unit:'EA',priceBasis:'EA',price:100,packSize:1,minOrderQty:1,availableQty:100,leadDays:3,currency:'KRW',confirmedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000*10).toISOString(),evidenceType:'supplier_reply',evidence:'test supplier quote',documents:'EN10204 3.1 + PMI',checks:Object.fromEntries(CHECKS.map(k=>[k,'confirmed'])),requirementResponses:Object.fromEntries(requirements.map(r=>[r.id,{status:'confirmed',offered:r.required,evidence:'test manufacturer document p.2'}]))};
  await send('settings',{revision:state.settings.revision,markupPct:20,autoInquiries:true,fx:{},logistics:{misumi:{shippingKRW:0,evidence:'test shipping'}}});
  let saved=await send('offers',offer);assert.equal(saved.httpStatus,200);assert.equal((await send('requests/'+req.id)).plan.ready,false);
  req=await send('requests',{...req,basisDocuments:req.basisDocuments.map(d=>({...d,reviewed:true}))});assert.equal(req.httpStatus,200);assert.equal((await send('state')).outbox.length,1);
  detail=await send('requests/'+req.id);saved=await send('offers',{...detail.offers[0],requirementResponses:offer.requirementResponses,checks:offer.checks,confirmedAt:offer.confirmedAt,evidenceType:offer.evidenceType});assert.equal(saved.httpStatus,200);assert.equal((await send('requests/'+req.id)).plan.ready,true);
  saved=await send('offers',{...saved,requirementResponses:{...saved.requirementResponses,grade:{status:'confirmed',offered:'B7',evidence:'test wrong grade'}}});detail=await send('requests/'+req.id);assert.equal(detail.plan.ready,false);assert.equal(detail.workflow.rows.find(r=>r.id==='grade').type,'D');
  assert.equal((await send('quotes',{requestId:req.id,validUntil:new Date(Date.now()+86400000).toISOString(),notes:'test'})).httpStatus,409);
  req=await send('requests',{...req,specialRequirements:'NACE MR0175 · approved origin only · no substitution'});assert.equal(req.httpStatus,200);detail=await send('requests/'+req.id);assert.equal(detail.offers[0].confirmedAt,'');assert.deepEqual(detail.offers[0].requirementResponses,{});assert.equal((await send('state')).outbox.length,2);
  const exportResponse=await mf.dispatchFetch('https://example.com/api/requests/'+req.id+'/workflow.csv',{headers:{Authorization:'Bearer '+key}});assert.equal(exportResponse.status,200);assert.match(await exportResponse.text(),/C/);
 }finally{await mf.dispose();}
});
