// 수입 원가 어림 계산 (화면 없음). /admin/landed.html(landed.mjs)과 worker/tests/landed.test.mjs가 같이 쓴다.
// 세율·환율·비용의 기본값을 두지 않는다. 공급처·포워더·관세사에게 받은 숫자만 넣는다 (AGENTS.md §9: 추정하지 않음).
// 실제 신고 금액은 관세사가 정한다. 이 결과는 들여올지 말지를 판단하기 위한 어림값이다.
// 이 파일과 화면은 공개 저장소·공개 주소에 있으므로 실제 원가·세율·공급처 이름을 코드에 적지 않는다.

export const VAT_RATE=.10;   // 수입 부가세와 도착 후 비용 부가세 (worker/domain.mjs의 견적 부가세와 같은 10%)
export const STORE_VERSION=1;
export const MAX_SCENARIOS=30;
export const LOT_MULTIPLIERS=[.25,.5,1,2,4];

// [키, 화면 이름]. 값은 입력한 문자열 그대로 보관하고 num()으로 읽는다. 빈칸(null)과 0은 다르다.
export const NUMBERS=[
  ['qty','수량'],['price','가격'],['weightKg','총 무게'],['fx','환율'],['fxCustoms','과세환율'],
  ['freight','해상 운임'],['insurance','보험료'],['dutyPct','관세율'],['adPct','덤핑방지관세율'],
  ['arrival','항구 도착 비용'],['broker','통관 수수료'],['storage','보관료'],['truck','트럭 운송비'],['test','시험·검사비'],['cut','절단·가공비'],['other','기타 비용'],
  ['sellUnit','판매 단가'],['targetMarginPct','목표 이익률'],['markupPct','가산율'],
  ['wD','지름'],['wA','한 변'],['wS','맞변'],['wT','두께'],['wW','폭'],['wL','길이'],['wCount','개수'],['wDensity','밀도'],
];
export const LOCAL_KEYS=['arrival','broker','storage','truck','test','cut','other'];
const TEXTS={name:80,unit:12,currency:8,fxNote:80};
const FLAGS=['freightIncluded','freightScales'];
const CHOICES={priceBasis:['unit','kg','total'],freightCurrency:['foreign','KRW'],wShape:['round','square','hex','plate']};

export function blankInput(){
  const o={};
  for(const k of Object.keys(TEXTS))o[k]='';
  for(const [k] of NUMBERS)o[k]='';
  for(const k of FLAGS)o[k]=false;
  for(const [k,list] of Object.entries(CHOICES))o[k]=list[0];
  return o;
}

// 빈칸 → null, "1,234.5" → 1234.5, 숫자가 아니면 NaN
export function num(v){
  if(v==null)return null;
  if(typeof v==='number')return Number.isFinite(v)?v:NaN;
  const s=String(v).replace(/[,\s]/g,'');
  if(!s)return null;
  return /^(\d+\.?\d*|\.\d+)$/.test(s)?Number(s):NaN;
}
export const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
export const pct=n=>(Math.round(n*10)/10).toLocaleString('ko-KR')+'%';
const isKg=unit=>String(unit||'').trim().toLowerCase()==='kg';

export function landedCost(raw={}){
  const v={},invalid=[];
  for(const [k,label] of NUMBERS){const n=num(raw[k]);if(Number.isNaN(n)||(n!=null&&n>1e13))invalid.push(label);v[k]=Number.isNaN(n)?null:n;}
  if(invalid.length)return {ready:false,missing:[],invalid,warnings:[]};
  const basis=CHOICES.priceBasis.includes(raw.priceBasis)?raw.priceBasis:'unit';
  const weight=v.weightKg??(isKg(raw.unit)?v.qty:null);
  const missing=[];
  if(!(v.qty>0))missing.push('수량');
  if(v.price==null)missing.push('가격');
  if(!(v.fx>0))missing.push('환율');
  if(basis==='kg'&&!(weight>0))missing.push('총 무게');
  if(missing.length)return {ready:false,missing,invalid:[],warnings:[]};

  const fxCustoms=v.fxCustoms>0?v.fxCustoms:v.fx;
  const included=raw.freightIncluded===true,inKRW=raw.freightCurrency==='KRW';
  const freight=included?0:v.freight??0,insurance=included?0:v.insurance??0;
  const toKRW=(amount,rate)=>inKRW?amount:amount*rate;
  const goodsForeign=basis==='unit'?v.price*v.qty:basis==='kg'?v.price*weight:v.price;
  const goodsKRW=Math.round(goodsForeign*v.fx),freightKRW=Math.round(toKRW(freight,v.fx)),insuranceKRW=Math.round(toKRW(insurance,v.fx));
  // 과세가격은 운임·보험료를 더한 값(CIF)으로 본다. 관세·덤핑방지관세는 과세가격에, 부가세는 그 합계에 붙는다.
  const customsValueKRW=Math.round(goodsForeign*fxCustoms+toKRW(freight,fxCustoms)+toKRW(insurance,fxCustoms));
  const dutyKRW=Math.round(customsValueKRW*(v.dutyPct??0)/100),adDutyKRW=Math.round(customsValueKRW*(v.adPct??0)/100);
  const importVatKRW=Math.round((customsValueKRW+dutyKRW+adDutyKRW)*VAT_RATE);
  const local=Object.fromEntries(LOCAL_KEYS.map(k=>[k,v[k]??0]));
  const localKRW=LOCAL_KEYS.reduce((sum,k)=>sum+local[k],0),localVatKRW=Math.round(localKRW*VAT_RATE);
  // 부가세는 돌려받는 세금(매입세액 공제, 일반과세자 기준)이라 원가에 넣지 않고 "준비할 현금"에만 넣는다. tools/quote와 같은 규칙.
  const costKRW=goodsKRW+freightKRW+insuranceKRW+dutyKRW+adDutyKRW+localKRW;
  const unitCostKRW=costKRW/v.qty,cashKRW=costKRW+importVatKRW+localVatKRW;
  const perShipmentKRW=localKRW+(raw.freightScales===true?0:freightKRW);
  const fixedSharePct=costKRW>0?perShipmentKRW/costKRW*100:0;
  const revenueKRW=v.sellUnit==null?null:Math.round(v.sellUnit*v.qty);
  const profitKRW=revenueKRW==null?null:revenueKRW-costKRW;
  const marginPct=revenueKRW>0?profitKRW/revenueKRW*100:null,markupActualPct=revenueKRW!=null&&costKRW>0?profitKRW/costKRW*100:null;
  // 저장소의 두 판매가 방식을 함께 보인다: 이익률(tools/quote, 원가÷(1−이익률)) / 가산율(worker/domain.mjs, 원가×(1+가산율)).
  const priceForMarginKRW=v.targetMarginPct!=null&&v.targetMarginPct<100?Math.ceil(unitCostKRW/(1-v.targetMarginPct/100)):null;
  const priceForMarkupKRW=v.markupPct!=null?Math.ceil(costKRW*(1+v.markupPct/100)/v.qty):null;

  const warnings=[];
  if(!String(raw.fxNote||'').trim())warnings.push('환율의 기준일과 출처를 적어 두세요.');
  if(v.dutyPct==null)warnings.push('관세율이 비어 있습니다. 관세사에게 품목번호로 확인한 값을 넣으세요. 0%가 맞다면 0을 넣으세요.');
  if(v.adPct==null)warnings.push('덤핑방지관세율이 비어 있습니다. 대상 품목이 아니라고 확인했다면 0을 넣으세요.');
  if(!included&&v.freight==null)warnings.push('해상 운임이 비어 있습니다. 물건값에 운임이 들어 있으면 그 칸에 표시하세요.');
  if(included&&(v.freight>0||v.insurance>0))warnings.push('운임이 물건값에 들어 있다고 표시해서, 적어 둔 운임·보험료는 계산에 넣지 않았습니다.');
  if(localKRW===0)warnings.push('한국 도착 후 비용이 모두 비어 있습니다. 통관 수수료와 트럭 운송비는 거의 항상 듭니다.');
  if(v.targetMarginPct!=null&&v.targetMarginPct>=100)warnings.push('목표 이익률은 100%보다 작아야 합니다.');
  if(profitKRW==null)warnings.push('판매 단가를 넣으면 남는 금액이 나옵니다.');
  else if(profitKRW<0)warnings.push('이 판매 단가로는 손해입니다.');
  if(fixedSharePct>=30)warnings.push(`수량과 상관없이 드는 비용이 원가의 ${Math.round(fixedSharePct)}%입니다. 수량을 늘리면 단위 원가가 내려갑니다. 아래 표를 보세요.`);

  return {ready:true,missing:[],invalid:[],warnings,basis,qty:v.qty,unit:String(raw.unit||'').trim(),weightKg:weight,fx:v.fx,fxCustoms,
    goodsKRW,freightKRW,insuranceKRW,customsValueKRW,dutyKRW,adDutyKRW,importVatKRW,local,localKRW,localVatKRW,
    costKRW,unitCostKRW,cashKRW,perShipmentKRW,fixedSharePct,revenueKRW,profitKRW,marginPct,markupActualPct,priceForMarginKRW,priceForMarkupKRW,
    // 견적 관리 화면(/admin/)의 "통관 비용"과 "운송비" 칸에 옮길 값: 물건값 + 통관 비용 + 운송비 = 총 원가
    adminImportCostKRW:costKRW-goodsKRW-local.truck,adminShippingKRW:local.truck};
}

// 수량이 달라질 때의 단위 원가. 가정: 단가는 그대로, 보험료는 물건값을 따라가고, 도착 후 비용은 건당 그대로. 운임은 "수량에 비례" 표시가 있을 때만 늘린다.
export function lotTable(raw={},multipliers=LOT_MULTIPLIERS){
  if(!landedCost(raw).ready)return [];
  const scale=(k,m)=>{const n=num(raw[k]);return n==null||Number.isNaN(n)?raw[k]:n*m;};
  return multipliers.map(m=>{
    const x={...raw,qty:scale('qty',m),weightKg:scale('weightKg',m),insurance:scale('insurance',m)};
    if(raw.priceBasis==='total')x.price=scale('price',m);
    if(raw.freightScales===true)x.freight=scale('freight',m);
    const r=landedCost(x);
    return {multiplier:m,qty:r.qty,costKRW:r.costKRW,unitCostKRW:r.unitCostKRW,profitKRW:r.profitKRW,marginPct:r.marginPct,cashKRW:r.cashKRW};
  });
}

// 치수(mm)와 밀도(g/cm³)로 무게(kg). 밀도 기본값은 두지 않는다. 값이 빠지면 null.
export function shapeWeightKg(raw={}){
  const g=k=>{const n=num(raw[k]);return n>0?n:null;};
  const L=g('wL'),count=g('wCount'),density=g('wDensity');
  const area=raw.wShape==='square'?(g('wA')??0)**2:raw.wShape==='hex'?Math.sqrt(3)/2*(g('wS')??0)**2:raw.wShape==='plate'?(g('wT')??0)*(g('wW')??0):Math.PI/4*(g('wD')??0)**2;
  if(!(area>0)||!L||!count||!density)return null;
  return area*L*count*density/1e6;
}

export function cleanInput(o){
  const out=blankInput();
  if(!o||typeof o!=='object')return out;
  for(const [k,max] of Object.entries(TEXTS))if(typeof o[k]==='string')out[k]=o[k].slice(0,max);
  for(const [k] of NUMBERS)if(typeof o[k]==='string'||typeof o[k]==='number')out[k]=String(o[k]).slice(0,24);
  for(const k of FLAGS)out[k]=o[k]===true;
  for(const [k,list] of Object.entries(CHOICES))if(list.includes(o[k]))out[k]=o[k];
  return out;
}
export function cleanStore(saved){
  if(!saved||typeof saved!=='object'||saved.version!==STORE_VERSION)return {current:blankInput(),scenarios:[]};
  const scenarios=(Array.isArray(saved.scenarios)?saved.scenarios:[]).filter(s=>s&&typeof s.name==='string'&&s.name.trim()).slice(0,MAX_SCENARIOS).map(s=>({name:s.name.trim().slice(0,60),input:cleanInput(s.input)}));
  return {current:cleanInput(saved.current),scenarios};
}

export function summaryText(raw={},r=landedCost(raw)){
  const head=`볼트노트 수입 원가 어림 계산${String(raw.name||'').trim()?' — '+String(raw.name).trim():''}`;
  if(!r.ready)return head+'\n\n아직 계산할 수 없습니다. 빠진 값: '+[...r.missing,...r.invalid].join(', ');
  const unit=r.unit||'단위',cur=String(raw.currency||'').trim()||'외화';
  const lines=[head,'',
    `수량: ${r.qty.toLocaleString('ko-KR')} ${unit}`,
    `환율: ${cur} 1 = ${r.fx.toLocaleString('ko-KR')}원${r.fxCustoms!==r.fx?` (과세환율 ${r.fxCustoms.toLocaleString('ko-KR')}원)`:''}${String(raw.fxNote||'').trim()?' · '+String(raw.fxNote).trim():''}`,'',
    `물건값: ${won(r.goodsKRW)}`,
    raw.freightIncluded===true?'운임·보험료: 물건값에 포함':`해상 운임: ${won(r.freightKRW)} / 보험료: ${won(r.insuranceKRW)}`,
    `과세가격(어림): ${won(r.customsValueKRW)}`,
    `관세: ${won(r.dutyKRW)} / 덤핑방지관세: ${won(r.adDutyKRW)}`,
    `한국 도착 후 비용: ${won(r.localKRW)}`,'',
    `총 원가: ${won(r.costKRW)}`,
    `단위 원가: ${won(r.unitCostKRW)} / ${unit}`,
    `준비할 현금(부가세 포함): ${won(r.cashKRW)} — 수입 부가세 ${won(r.importVatKRW)}, 도착 후 비용 부가세 ${won(r.localVatKRW)} 포함`];
  if(r.revenueKRW!=null)lines.push('',`판매 금액: ${won(r.revenueKRW)}`,`남는 금액: ${won(r.profitKRW)}${r.marginPct==null?'':` (이익률 ${pct(r.marginPct)})`}`);
  if(r.priceForMarginKRW!=null)lines.push(`이익률 ${pct(num(raw.targetMarginPct))}를 남기려면: ${won(r.priceForMarginKRW)} / ${unit}`);
  if(r.priceForMarkupKRW!=null)lines.push(`가산율 ${pct(num(raw.markupPct))}로 팔면: ${won(r.priceForMarkupKRW)} / ${unit}`);
  lines.push('',`견적 관리 화면에 옮길 값 — 통관 비용: ${won(r.adminImportCostKRW)} / 운송비: ${won(r.adminShippingKRW)}`);
  if(r.warnings.length)lines.push('','확인할 것:',...r.warnings.map(w=>'- '+w));
  lines.push('','어림 계산입니다. 실제 세액과 비용은 관세사·포워더의 청구서로 확인합니다.');
  return lines.join('\n');
}
