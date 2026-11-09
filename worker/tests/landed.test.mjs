// All prices, rates and costs below are synthetic round numbers for testing the arithmetic. None is a real quote or tax rate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {blankInput,num,landedCost,lotTable,shapeWeightKg,cleanInput,cleanStore,summaryText,MAX_SCENARIOS} from '../client/landed-calc.mjs';

const base=()=>({...blankInput(),qty:'1000',unit:'kg',price:'1',currency:'USD',fx:'1000',fxNote:'시험',freight:'100',insurance:'10',dutyPct:'10',adPct:'0',arrival:'100000',broker:'50000',truck:'150000',sellUnit:'2000',targetMarginPct:'20',markupPct:'20'});

test('blank and zero are different, and text that is not a number is rejected',()=>{
  assert.equal(num(''),null);assert.equal(num('  '),null);assert.equal(num('0'),0);assert.equal(num('1,234.5'),1234.5);assert.equal(num('.5'),.5);
  assert.ok(Number.isNaN(num('12a')));assert.ok(Number.isNaN(num('-5')));assert.ok(Number.isNaN(num('1e9')));
  const r=landedCost({...base(),price:'abc'});assert.equal(r.ready,false);assert.deepEqual(r.invalid,['가격']);
});
test('nothing is assumed: quantity, price and exchange rate must be entered',()=>{
  const r=landedCost(blankInput());assert.equal(r.ready,false);assert.deepEqual(r.missing,['수량','가격','환율']);
  assert.deepEqual(landedCost({...base(),priceBasis:'kg',unit:'개'}).missing,['총 무게']);
  assert.deepEqual(lotTable(blankInput()),[]);
});
test('FOB-style quote: freight and insurance join the customs value; VAT is cash, not cost',()=>{
  const r=landedCost(base());
  assert.equal(r.goodsKRW,1000000);assert.equal(r.freightKRW,100000);assert.equal(r.insuranceKRW,10000);
  assert.equal(r.customsValueKRW,1110000);assert.equal(r.dutyKRW,111000);assert.equal(r.adDutyKRW,0);
  assert.equal(r.importVatKRW,122100);assert.equal(r.localKRW,300000);assert.equal(r.localVatKRW,30000);
  assert.equal(r.costKRW,1521000);assert.equal(r.unitCostKRW,1521);assert.equal(r.cashKRW,1673100);
  assert.equal(r.revenueKRW,2000000);assert.equal(r.profitKRW,479000);assert.ok(Math.abs(r.marginPct-23.95)<1e-9);
  assert.equal(r.adminImportCostKRW+r.adminShippingKRW+r.goodsKRW,r.costKRW);assert.equal(r.adminShippingKRW,150000);
});
test('the two selling-price rules of the repository are both shown',()=>{
  const r=landedCost(base());
  assert.equal(r.priceForMarginKRW,1902);   // ceil(1521 / (1 - 0.20)), tools/quote
  assert.equal(r.priceForMarkupKRW,1826);   // ceil(1521000 * 1.20 / 1000), worker/domain.mjs
  assert.equal(landedCost({...base(),targetMarginPct:'100'}).priceForMarginKRW,null);
  assert.ok(landedCost({...base(),targetMarginPct:'100'}).warnings.some(w=>w.includes('100%보다 작아야')));
});
test('anti-dumping duty is charged on the customs value and raises VAT with it',()=>{
  const r=landedCost({...base(),adPct:'30'});
  assert.equal(r.adDutyKRW,333000);assert.equal(r.importVatKRW,Math.round((1110000+111000+333000)*.1));assert.equal(r.costKRW,1521000+333000);
  assert.equal(r.profitKRW,2000000-1854000);
});
test('freight already in the price (CIF) is not counted twice, and says so',()=>{
  const r=landedCost({...base(),freightIncluded:true});
  assert.equal(r.freightKRW,0);assert.equal(r.insuranceKRW,0);assert.equal(r.customsValueKRW,1000000);assert.equal(r.costKRW,1000000+100000+300000);
  assert.ok(r.warnings.some(w=>w.includes('계산에 넣지 않았습니다')));
});
test('won freight is not converted; a customs exchange rate changes taxes but not what is paid',()=>{
  const won=landedCost({...base(),freight:'120000',insurance:'',freightCurrency:'KRW'});
  assert.equal(won.freightKRW,120000);assert.equal(won.customsValueKRW,1120000);
  const r=landedCost({...base(),fxCustoms:'1100'});
  assert.equal(r.goodsKRW,1000000);assert.equal(r.customsValueKRW,1221000);assert.equal(r.dutyKRW,122100);assert.equal(r.costKRW,1000000+100000+10000+122100+300000);
});
test('price per kg and whole-lot price',()=>{
  const perKg=landedCost({...base(),qty:'10',unit:'본',priceBasis:'kg',price:'2',weightKg:'500',freight:'',insurance:'',arrival:'',broker:'',truck:'',dutyPct:'0'});
  assert.equal(perKg.goodsKRW,1000000);assert.equal(perKg.unitCostKRW,100000);
  assert.equal(landedCost({...base(),priceBasis:'kg',weightKg:''}).goodsKRW,1000000);   // 단위가 kg이면 수량을 무게로 쓴다
  assert.equal(landedCost({...base(),priceBasis:'total',price:'1000'}).goodsKRW,1000000);
});
test('missing rates are flagged instead of guessed',()=>{
  const r=landedCost({...base(),dutyPct:'',adPct:'',fxNote:'',sellUnit:'',arrival:'',broker:'',truck:''});
  assert.equal(r.dutyKRW,0);assert.equal(r.profitKRW,null);assert.equal(r.marginPct,null);
  for(const part of ['관세율이 비어','덤핑방지관세율이 비어','기준일과 출처','도착 후 비용이 모두 비어','판매 단가를 넣으면'])assert.ok(r.warnings.some(w=>w.includes(part)),part);
  assert.ok(landedCost({...base(),sellUnit:'1000'}).warnings.some(w=>w.includes('손해')));
});
test('per-shipment costs make small lots expensive',()=>{
  const rows=lotTable(base());
  assert.deepEqual(rows.map(r=>r.qty),[250,500,1000,2000,4000]);
  for(let i=1;i<rows.length;i++)assert.ok(rows[i].unitCostKRW<rows[i-1].unitCostKRW);
  assert.equal(rows[2].unitCostKRW,1521);
  assert.equal(rows[0].costKRW,250000+100000+2500+Math.round(352500*.1)+300000);   // 운임은 그대로, 보험료는 물건값을 따라감
  const scaled=lotTable({...base(),freightScales:true});
  assert.equal(scaled[0].costKRW,250000+25000+2500+27750+300000);
  const flat=lotTable({...base(),freight:'',insurance:'',arrival:'',broker:'',truck:''});
  assert.ok(flat.every(r=>r.unitCostKRW===flat[0].unitCostKRW));   // 건당 비용이 없으면 수량과 무관
  assert.ok(Math.abs(landedCost(base()).fixedSharePct-400000/1521000*100)<1e-9);   // 26%: 경고 없음
  assert.ok(!landedCost(base()).warnings.some(w=>w.includes('수량과 상관없이 드는 비용')));
  assert.ok(landedCost({...base(),qty:'250',insurance:'2.5'}).warnings.some(w=>w.includes('수량과 상관없이 드는 비용이 원가의 58%')));
});
test('weight from dimensions needs every value, including density',()=>{
  const round=shapeWeightKg({wShape:'round',wD:'50',wL:'1000',wCount:'2',wDensity:'8'});
  assert.ok(Math.abs(round-Math.PI/4*2500*1000*2*8/1e6)<1e-9);
  assert.equal(shapeWeightKg({wShape:'square',wA:'10',wL:'1000',wCount:'1',wDensity:'8'}),.8);
  assert.ok(Math.abs(shapeWeightKg({wShape:'hex',wS:'10',wL:'1000',wCount:'1',wDensity:'8'})-Math.sqrt(3)/2*100*1000*8/1e6)<1e-12);
  assert.equal(shapeWeightKg({wShape:'plate',wT:'10',wW:'1000',wL:'2000',wCount:'1',wDensity:'8'}),160);
  assert.equal(shapeWeightKg({wShape:'round',wD:'50',wL:'1000',wCount:'2'}),null);
  assert.equal(shapeWeightKg({wShape:'plate',wT:'10',wL:'2000',wCount:'1',wDensity:'8'}),null);
});
test('stored values are cleaned before use',()=>{
  const c=cleanInput({qty:5,name:'x'.repeat(200),priceBasis:'nope',freightIncluded:'yes',extra:'<script>',wShape:'plate'});
  assert.equal(c.qty,'5');assert.equal(c.name.length,80);assert.equal(c.priceBasis,'unit');assert.equal(c.freightIncluded,false);assert.equal('extra' in c,false);assert.equal(c.wShape,'plate');
  assert.deepEqual(cleanStore(null),{current:blankInput(),scenarios:[]});assert.deepEqual(cleanStore({version:2,current:base()}).current,blankInput());
  const store=cleanStore({version:1,current:base(),scenarios:[{name:' 수입 ',input:base()},{name:'',input:base()},null,...Array.from({length:40},(_,i)=>({name:'n'+i,input:{}}))]});
  assert.equal(store.scenarios.length,MAX_SCENARIOS);assert.equal(store.scenarios[0].name,'수입');assert.equal(store.current.qty,'1000');
});
test('the text summary carries the numbers, the admin hand-off values and the caveat',()=>{
  const text=summaryText({...base(),name:'시험 A'});
  for(const part of ['시험 A','총 원가: 1,521,000원','단위 원가: 1,521원 / kg','준비할 현금(부가세 포함): 1,673,100원','남는 금액: 479,000원','통관 비용: 371,000원 / 운송비: 150,000원','어림 계산입니다'])assert.ok(text.includes(part),part);
  assert.ok(summaryText(blankInput()).includes('빠진 값: 수량, 가격, 환율'));
});
