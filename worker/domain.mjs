export const DEFAULT_MARKUP_PCT=20;
export class DomainError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const text=(v,max=1000)=>String(v??'').trim().slice(0,max);
export function money(value,field='금액') {
  const n=Number(value);
  if(value==null || value==='' || !Number.isFinite(n) || n<0 || n>1e12) throw new DomainError(`${field}을 확인하세요.`);
  return n;
}
export function quantity(value) {
  const n=Number(value);
  if(!Number.isSafeInteger(n) || n<=0 || n>100000000) throw new DomainError('수량은 1 이상의 정수로 입력하세요.');
  return n;
}
export function email(value) {
  const v=text(value,254);
  if(/[\r\n]/.test(v) || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v)) throw new DomainError('메일 주소를 확인하세요.');
  return v;
}
export function cleanLines(lines) {
  if(!Array.isArray(lines) || !lines.length || lines.length>200) throw new DomainError('품목을 1–200줄 등록하세요.');
  const result=lines.map((l,i)=>({id:text(l.id,80)||crypto.randomUUID(),no:i+1,description:text(l.description,2000),qty:quantity(l.qty),unit:text(l.unit,12)||'EA',spec:text(l.spec,3000),requiredDocs:text(l.requiredDocs,1000),checksRequired:[...new Set([...(Array.isArray(l.checksRequired)?l.checksRequired.filter(k=>CHECKS.includes(k)):CHECKS),'documents','delivery'])],unresolved:text(l.unresolved,2000)}));
  if(result.some(l=>!l.description) || new Set(result.map(l=>l.id)).size!==result.length) throw new DomainError('품목 이름과 고유 번호를 확인하세요.');
  return result;
}
export function lineConditions(line){
  if(!line)return '';
  return JSON.stringify([line.description,line.qty,line.unit,line.spec,line.requiredDocs,line.unresolved,[...new Set([...(line.checksRequired||CHECKS),'documents','delivery'])].sort()]);
}
export const CHECKS=['standard','diameter','pitch','length','grade','finish','documents','delivery'];
export function assessOffer(line,offer,supplier,settings,now=new Date()) {
  const reasons=[];
  if(!offer.confirmedAt || !['supplier_reply','supplier_quote'].includes(offer.evidenceType) || !text(offer.evidence,8000)) reasons.push('공급처 확인 근거');
  const confirmed=Date.parse(offer.confirmedAt),expires=Date.parse(offer.expiresAt);
  if(!Number.isFinite(confirmed) || confirmed>now.getTime()+60000) reasons.push('확인 일시');
  if(!Number.isFinite(expires) || expires<now.getTime()) reasons.push('견적 유효기간');
  if(!Number.isFinite(Number(offer.availableQty)) || Number(offer.availableQty)<line.qty) reasons.push('요청 수량 공급 가능 여부');
  if(offer.leadDays==null || offer.leadDays==='' || !Number.isFinite(Number(offer.leadDays)) || Number(offer.leadDays)<0) reasons.push('납기');
  if(!text(offer.sku,160)) reasons.push('공급처 품번');
  if(text(offer.unit,12)!==line.unit) reasons.push('EA·SET 등 거래 단위');
  if(!['EA','PACK'].includes(offer.priceBasis)) reasons.push('개당·포장당 가격 기준');
  for(const key of new Set([...(line.checksRequired||CHECKS),'documents','delivery'])) if(offer.checks?.[key]!=='confirmed') reasons.push(`사양 확인: ${key}`);
  if(line.unresolved) reasons.push('고객 사양 미확인');
  if(text(line.requiredDocs)&&!text(offer.documents))reasons.push('요청한 서류의 공급 조건');
  const currency=text(offer.currency,3).toUpperCase();
  let fx=currency==='KRW'?1:Number(settings.fx?.[currency]?.rate);
  if(currency!=='KRW' && (!Number.isFinite(fx)||fx<=0||!text(settings.fx?.[currency]?.source)||!Number.isFinite(Date.parse(settings.fx?.[currency]?.date))||Date.parse(settings.fx?.[currency]?.date)>now.getTime()+60000)) reasons.push('환율·출처·기준일');
  if(supplier.country!=='KR' && (offer.importCostKRW==null || offer.importCostKRW==='' || !text(offer.importBasis))) reasons.push('통관 비용·근거');
  const logistics=settings.logistics?.[supplier.id];
  if(!logistics || logistics.shippingKRW==null || logistics.shippingKRW==='' || !text(logistics.evidence)) reasons.push('운송비·근거');
  else try{money(logistics.shippingKRW,'운송비');}catch(e){reasons.push(e.message);}
  let price,pack,minimum,importCost;
  try {price=money(offer.price,'단가');if(price<=0) reasons.push('단가');pack=quantity(offer.packSize);minimum=quantity(offer.minOrderQty);importCost=supplier.country==='KR'?0:money(offer.importCostKRW,'통관 비용');} catch(e){reasons.push(e.message);}
  if(reasons.length) return {eligible:false,reasons:[...new Set(reasons)]};
  const packs=Math.ceil(Math.max(line.qty,minimum)/pack),buyQty=packs*pack;
  if(Number(offer.availableQty)<buyQty) return {eligible:false,reasons:['포장·최소 주문량을 포함한 공급 수량']};
  const basis=offer.priceBasis==='PACK'?'PACK':'EA';
  const goodsKRW=price*(basis==='PACK'?packs:buyQty)*fx;
  if(!Number.isFinite(goodsKRW)||goodsKRW>1e12)return {eligible:false,reasons:['환산 금액을 확인하세요.']};
  return {eligible:true,reasons:[],packs,buyQty,goodsKRW,baseCostKRW:goodsKRW+importCost,importCostKRW:importCost,fx};
}
export function optimizeOffers(request,offers,suppliers,settings,now=new Date()) {
  if(!request.lines?.length) throw new DomainError('품목 사양을 먼저 등록하세요.');
  const candidates=request.lines.map(line=>offers.filter(o=>o.lineId===line.id).map(offer=>{
    const supplier=suppliers.find(s=>s.id===offer.supplierId);
    return {line,offer,supplier,assessment:supplier?assessOffer(line,offer,supplier,settings,now):{eligible:false,reasons:['공급처 등록']}};
  }));
  const missing=candidates.map((list,i)=>list.some(c=>c.assessment.eligible)?null:{lineId:request.lines[i].id,no:request.lines[i].no,description:request.lines[i].description,reasons:[...new Set(list.flatMap(c=>c.assessment.reasons))]}).filter(Boolean);
  if(missing.length) return {ready:false,missing,candidates};
  const ids=[...new Set(candidates.flat().filter(c=>c.assessment.eligible).map(c=>c.supplier.id))];
  if(ids.length>12) throw new DomainError('한 요청에서는 공급처 12곳까지 조합할 수 있습니다.');
  let best=null;
  // Enumerating supplier subsets accounts for one consolidated shipment per supplier.
  // A per-line cheapest-price pick can otherwise create extra shipping charges.
  for(let mask=1;mask<(1<<ids.length);mask++) {
    const allowed=new Set(ids.filter((_,i)=>mask&(1<<i)));
    const selected=[];let cost=0,valid=true;
    for(const list of candidates) {
      const eligible=list.filter(c=>c.assessment.eligible&&allowed.has(c.supplier.id));
      if(!eligible.length){valid=false;break;}
      eligible.sort((a,b)=>a.assessment.baseCostKRW-b.assessment.baseCostKRW || Number(a.offer.leadDays)-Number(b.offer.leadDays));
      selected.push(eligible[0]);cost+=eligible[0].assessment.baseCostKRW;
    }
    if(!valid) continue;
    const grouped=new Map();
    for(const c of selected){const key=c.supplier.id+'\0'+c.offer.sku;const old=grouped.get(key)||{qty:0,stock:Infinity};old.qty+=c.assessment.buyQty;old.stock=Math.min(old.stock,Number(c.offer.availableQty));grouped.set(key,old);}
    if([...grouped.values()].some(g=>g.qty>g.stock))continue;
    const used=[...new Set(selected.map(c=>c.supplier.id))];
    let shipping=0;
    for(const id of used) shipping+=money(settings.logistics[id].shippingKRW,'운송비');
    cost+=shipping;
    if(!best || cost<best.costKRW) best={selected,used,costKRW:cost,shippingKRW:shipping};
  }
  if(!best)return {ready:false,candidates,missing:request.lines.map(l=>({lineId:l.id,no:l.no,description:l.description,reasons:['동일 공급처·품번의 전체 매입 수량을 공급처에 확인하세요.']}))};
  return {ready:true,...best,candidates,missing:[]};
}
export function createQuote(request,plan,terms,now=new Date()) {
  if(!plan.ready) throw new DomainError('모든 품목의 공급 조건을 확인한 뒤 견적서를 작성하세요.',409);
  const markup=terms.markupPct==null?DEFAULT_MARKUP_PCT:money(terms.markupPct,'가산율');
  if(markup>500) throw new DomainError('가산율을 확인하세요.');
  const shippingShare=plan.shippingKRW/plan.selected.length;
  const lines=plan.selected.map(c=>{
    const cost=c.assessment.baseCostKRW+shippingShare;
    const unitPriceKRW=Math.ceil(cost*(1+markup/100)/c.line.qty);
    return {no:c.line.no,description:c.line.description,spec:c.line.spec,qty:c.line.qty,unit:c.line.unit,unitPriceKRW,amountKRW:unitPriceKRW*c.line.qty,leadDays:Number(c.offer.leadDays),documents:text(c.offer.documents,2000)};
  });
  const netKRW=lines.reduce((sum,l)=>sum+l.amountKRW,0),vatKRW=Math.round(netKRW*.10);
  const validUntil=text(terms.validUntil,30);
  if(!Number.isFinite(Date.parse(validUntil)) || Date.parse(validUntil)<now.getTime()) throw new DomainError('견적 유효기간을 확인하세요.');
  if(plan.selected.some(c=>Date.parse(c.offer.expiresAt)<Date.parse(validUntil))) throw new DomainError('고객 견적 유효기간이 공급처 견적 유효기간을 넘습니다.');
  return {requestId:request.id,createdAt:now.toISOString(),customerName:text(request.customerName,200),customerEmail:email(request.customerEmail),subject:text(request.subject,300),lines,netKRW,vatKRW,totalKRW:netKRW+vatKRW,validUntil,terms:text(terms.notes,4000),markupPct:markup,costKRW:plan.costKRW,selection:plan.selected.map(c=>({lineId:c.line.id,offerId:c.offer.id,supplierId:c.supplier.id,buyQty:c.assessment.buyQty}))};
}
export function customerQuote(quote) {
  const keys=['id','revision','number','status','requestId','createdAt','customerName','customerEmail','subject','lines','netKRW','vatKRW','totalKRW','validUntil','terms'];
  return Object.fromEntries(keys.filter(k=>quote[k]!==undefined).map(k=>[k,quote[k]]));
}
