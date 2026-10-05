"""End-to-end quotation flow with synthetic data, local storage and no mail password."""
from pathlib import Path
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
import json
import io
import zipfile
import os
import socket
import subprocess
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def check(BASE, OUT):
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('BN_CHROMIUM') or None,headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/admin');page.get_by_label('관리자 비밀키',exact=True).fill('wrong-key-that-is-at-least-32-characters')
  page.get_by_role('button',name='관리자 연결',exact=True).click();page.get_by_text('관리자 인증이 필요합니다.').wait_for()
  page.get_by_label('관리자 비밀키',exact=True).fill('LOCAL_TEST_ONLY_'+'x'*32);page.get_by_role('button',name='관리자 연결',exact=True).click()
  page.get_by_role('button',name='직접 등록',exact=True).wait_for();assert page.get_by_role('button',name='메일 수집',exact=True).is_disabled()
  page.get_by_role('button',name='직접 등록',exact=True).click();form=page.locator('#request-form')
  form.get_by_label('고객명',exact=True).fill('한국어 UI 검증');form.get_by_label('회신 이메일',exact=True).fill('customer@example.com');form.get_by_label('요청 제목',exact=True).fill('UI 검증 견적')
  form.get_by_label('품목',exact=True).fill('시험용 육각볼트');form.get_by_label('요청 수량',exact=True).fill('10');form.get_by_label('규격·호칭·피치·길이·재질/등급·표면처리',exact=True).fill('ISO 4017 M12×1.75×50 8.8 PLAIN')
  form.get_by_role('button',name='품목·고객 저장',exact=True).click()
  page.locator('.request').first.wait_for()
  page.get_by_role('button',name='공급처·원가 설정',exact=True).click();settings=page.locator('#settings-form')
  settings.locator('[name=misumi-shipping]').fill('0');settings.locator('[name=misumi-evidence]').fill('합성 테스트 · 묶음 무료 배송')
  settings.get_by_role('button',name='원가 기준 저장',exact=True).click();page.get_by_text('저장했습니다.',exact=True).wait_for()
  page.get_by_role('button',name='요청·조달',exact=True).click();page.get_by_role('button',name='공급처 조건 등록',exact=True).click()
  offer=page.locator('#offer-form');offer.get_by_label('공급처 품번',exact=True).fill('UI-TEST-01');offer.get_by_label('매입 단가',exact=True).fill('100');offer.get_by_label('가격 기준',exact=True).select_option('EA')
  for title,value in [('포장당 수량','1'),('최소 주문 수량','1'),('공급 가능 수량','100'),('확인된 납기 (일)','3')]:offer.get_by_label(title,exact=True).fill(value)
  offer.get_by_label('공급처 확인 일시',exact=True).fill((datetime.now()-timedelta(minutes=5)).strftime('%Y-%m-%dT%H:%M'));offer.get_by_label('공급처 견적 유효기간',exact=True).fill((datetime.now()+timedelta(days=10)).strftime('%Y-%m-%dT%H:%M'))
  offer.get_by_label('가격·조건 근거',exact=True).select_option('website_only');offer.get_by_label('회신·견적서의 근거 (문서 번호·메일 날짜·확인 조건)',exact=True).fill('합성 테스트 회신')
  for c in offer.locator('input[type=checkbox]').all():c.check()
  for row in offer.locator('[data-criterion]').all():
   row.locator('[name=response-status]').select_option('confirmed');row.get_by_label('공급처 제시값',exact=True).fill(row.locator('pre').inner_text());row.get_by_label('요건별 근거 · 문서·페이지·회신',exact=True).fill('합성 제조사 규격 대조 문서 p.2')
  offer.get_by_role('button',name='조건 저장·검증',exact=True).click();page.get_by_text('공급처 확인 근거',exact=True).wait_for();assert page.locator('#quote-form').count()==0
  page.get_by_role('button',name='수정',exact=True).first.click();offer=page.locator('#offer-form');offer.get_by_label('가격·조건 근거',exact=True).select_option('supplier_reply');offer.get_by_role('button',name='조건 저장·검증',exact=True).click()
  quote=page.locator('#quote-form');quote.wait_for();assert '1,000원' in page.locator('.amount').inner_text()
  quote.get_by_label('고객 견적 유효기간 (공급처 기간 이내)',exact=True).fill((datetime.now()+timedelta(days=2)).strftime('%Y-%m-%dT%H:%M'))
  quote.get_by_label('결제·납기 기산일·배송지·서류 등 고객에게 안내할 조건',exact=True).fill('UI 검증용 조건 · 실제 견적이 아닙니다.')
  quote.get_by_role('button',name='견적서 작성',exact=True).click();page.get_by_text('고객 견적서',exact=True).wait_for()
  summary=page.locator('details summary').first;summary.click();assert '1,320원' in summary.inner_text();assert page.get_by_role('button',name='검토 후 고객 발송',exact=True).first.is_disabled()
  with page.expect_download() as dl:page.get_by_role('button',name='PDF 다운로드',exact=True).first.click()
  dl.value.save_as(OUT/'quote.pdf');assert (OUT/'quote.pdf').read_bytes().startswith(b'%PDF-')
  page.screenshot(path=str(OUT/'quote-desktop.png'),full_page=True)
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(80)
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
  page.get_by_role('button',name='요청·조달',exact=True).click();form=page.locator('#request-form')
  form.get_by_label('품목',exact=True).fill('시험용 와셔');form.get_by_label('규격·호칭·피치·길이·재질/등급·표면처리',exact=True).fill('시험 무나사 와셔 사양');form.get_by_label('필요 서류',exact=True).fill('MTR')
  form.get_by_text('이 품목에서 확인할 항목',exact=True).click();form.locator('[name=required-pitch]').uncheck()
  assert form.locator('[name=required-documents]').is_disabled() and form.locator('[name=required-documents]').is_checked()
  assert form.locator('[name=required-delivery]').is_disabled() and form.locator('[name=required-delivery]').is_checked()
  form.get_by_role('button',name='품목·고객 저장',exact=True).click();page.get_by_text('모든 품목의 사양과 공급 조건을 먼저 확인하세요.',exact=True).wait_for();assert page.locator('#quote-form').count()==0
  page.get_by_role('button',name='수정',exact=True).first.click();offer=page.locator('#offer-form')
  assert offer.locator('[name=check-pitch]').is_disabled();assert not offer.locator('[name=check-documents]').is_checked();assert offer.get_by_label('공급처 확인 일시',exact=True).input_value()==''
  assert 'MTR' in page.locator('#offer-request-summary').inner_text();assert '다시 확인' in page.locator('#offer-request-summary').inner_text()
  offer.locator('[name=check-standard]').check();offer.get_by_label('공급처 확인 일시',exact=True).fill(datetime.now().strftime('%Y-%m-%dT%H:%M'));offer.get_by_label('가격·조건 근거',exact=True).select_option('supplier_reply')
  offer.get_by_label('공급처',exact=True).select_option('grainger');assert not offer.locator('[name=check-standard]').is_checked();assert offer.get_by_label('공급처 확인 일시',exact=True).input_value()=='';assert offer.get_by_label('가격·조건 근거',exact=True).input_value()==''
  # Full BOM workflow: UTF-8 import, preserved special notes, private supplier
  # RFQ/C&D, duplicate protection and a visibly rejected material substitution.
  page.get_by_role('button',name='공급처·원가 설정',exact=True).click()
  supplier=page.locator('.supplier-form[data-id=misumi]');supplier.get_by_label('공식 견적 이메일',exact=True).fill('supplier@example.com');supplier.locator('[name=contactVerified]').check();supplier.get_by_role('button',name='연락처 저장',exact=True).click();page.get_by_text('저장했습니다.',exact=True).wait_for()
  page.get_by_role('button',name='요청·조달',exact=True).click();page.get_by_role('button',name='직접 등록',exact=True).click()
  form=page.locator('#request-form');form.get_by_label('고객명',exact=True).fill('BOM 원문 검증');form.get_by_label('회신 이메일',exact=True).fill('buyer@example.com');form.get_by_label('요청 제목',exact=True).fill('특수요건 BOM 검증')
  page.get_by_text('표 붙여넣기로 품목 입력',exact=True).click()
  csv='품명,수량,단위,규격,비고\nStud bolt,20,EA,"ASTM A193 B7M 3/4\"\"-10 UNC LENGTH 150 MM PLAIN",NACE MR0175 / EN10204 3.1 / PMI'
  page.locator('#bom-file').set_input_files({'name':'synthetic-bom.csv','mimeType':'text/csv','buffer':csv.encode()})
  page.wait_for_function('()=>document.getElementById("paste").value.includes("NACE")')
  page.get_by_role('button',name='BOM 분석·품목으로 읽기',exact=True).click()
  page.wait_for_function("()=>document.querySelector('[data-line] textarea[name=specialRequirements]').value.includes('NACE')")
  assert form.locator('[data-line]').count()==1
  assert 'NACE' in form.get_by_label('품목 특수요건·비고 원문',exact=True).input_value()
  form.get_by_role('button',name='품목·고객 저장',exact=True).click();page.get_by_text('BOM → 공급처 RFQ → C&D',exact=True).wait_for()
  assert page.locator('#quote-form').count()==0
  auth={'Authorization':'Bearer '+'LOCAL_TEST_ONLY_'+'x'*32}
  state=page.request.get(BASE+'/api/state',headers=auth).json();request=next(r for r in state['requests'] if r['subject']=='특수요건 BOM 검증');out=[o for o in state['outbox'] if o.get('requestId')==request['id']]
  assert len(out)==1 and out[0]['status']=='draft';assert 'C&D' in out[0]['plain'];assert 'buyer@example.com' not in out[0]['plain']
  for _ in range(2):
   page.get_by_role('button',name='공급처 문의 자동 생성',exact=True).click();page.get_by_text('BOM → 공급처 RFQ → C&D',exact=True).wait_for();page.wait_for_function('()=>!document.getElementById("app").inert')
  assert len([o for o in page.request.get(BASE+'/api/state',headers=auth).json()['outbox'] if o.get('requestId')==request['id']])==1
  with page.expect_download() as dl:page.get_by_role('button',name='C&D CSV 다운로드',exact=True).click()
  dl.value.save_as(OUT/'workflow-cd.csv');assert 'special:sour' in (OUT/'workflow-cd.csv').read_text(encoding='utf-8-sig')
  page.get_by_role('button',name='공급처 조건 등록',exact=True).click();offer=page.locator('#offer-form')
  offer.get_by_label('공급처 품번',exact=True).fill('TEST-WRONG-GRADE');offer.get_by_label('매입 단가',exact=True).fill('100');offer.get_by_label('가격 기준',exact=True).select_option('EA')
  for title,value in [('포장당 수량','1'),('최소 주문 수량','1'),('공급 가능 수량','100'),('확인된 납기 (일)','3')]:offer.get_by_label(title,exact=True).fill(value)
  offer.get_by_label('공급처 확인 일시',exact=True).fill(datetime.now().strftime('%Y-%m-%dT%H:%M'));offer.get_by_label('공급처 견적 유효기간',exact=True).fill((datetime.now()+timedelta(days=10)).strftime('%Y-%m-%dT%H:%M'));offer.get_by_label('가격·조건 근거',exact=True).select_option('supplier_reply');offer.get_by_label('회신·견적서의 근거 (문서 번호·메일 날짜·확인 조건)',exact=True).fill('합성 공급처 견적');offer.get_by_label('제공하기로 확인된 서류',exact=True).fill('EN10204 3.1 + PMI')
  for checkbox in offer.locator('input[type=checkbox]').all():checkbox.check()
  for row in offer.locator('[data-criterion]').all():
   row.locator('[name=response-status]').select_option('confirmed');row.get_by_label('공급처 제시값',exact=True).fill('B7' if row.get_attribute('data-criterion')=='grade' else row.locator('pre').inner_text());row.get_by_label('요건별 근거 · 문서·페이지·회신',exact=True).fill('합성 제조사 문서 p.2')
  offer.get_by_role('button',name='조건 저장·검증',exact=True).click();page.get_by_role('cell',name='D · 편차',exact=True).wait_for();assert page.locator('#quote-form').count()==0
  page.screenshot(path=str(OUT/'workflow-desktop.png'),full_page=True)
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
  # Native XLSX import uses worksheet values without a remote script.
  page.get_by_role('button',name='직접 등록',exact=True).click();page.get_by_text('표 붙여넣기로 품목 입력',exact=True).click()
  buffer=io.BytesIO()
  with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:
   archive.writestr('xl/workbook.xml','<workbook><sheets><sheet name="BOM" r:id="rId1"/></sheets></workbook>')
   archive.writestr('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
   cells=[['Description','Qty','Unit','Specification','Notes'],['Test bolt','10','EA','ISO 4017 M12x1.75x50 8.8 PLAIN','PMI']]
   archive.writestr('xl/worksheets/sheet1.xml','<worksheet><sheetData>'+''.join('<row>'+''.join('<c r="'+chr(65+j)+str(i+1)+'" t="inlineStr"><is><t>'+value+'</t></is></c>' for j,value in enumerate(row))+'</row>' for i,row in enumerate(cells))+'</sheetData></worksheet>')
  page.locator('#bom-file').set_input_files({'name':'synthetic-bom.xlsx','mimeType':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','buffer':buffer.getvalue()})
  page.wait_for_function('()=>document.getElementById("paste").value.includes("Test bolt")')
  page.get_by_role('button',name='BOM 분석·품목으로 읽기',exact=True).click();page.wait_for_function('()=>document.querySelector("[data-line] textarea[name=specialRequirements]").value.includes("PMI")')
  assert page.locator('[data-line]').count()==1 and page.locator('#request-form [name=qty]').input_value()=='10'
  assert page.locator('[data-basis] [name=basis-name]').input_value()=='synthetic-bom.xlsx'
  assert not page.locator('[data-basis] [name=basis-reviewed]').is_checked()
  page.get_by_role('button',name='잠금',exact=True).click();page.get_by_role('button',name='관리자 연결',exact=True).wait_for();assert page.evaluate("sessionStorage.getItem('bn-procurement-key')") is None
  # Exercise failed intake + retry with synthetic responses. No mailbox or
  # password is connected; the real API's authentication was checked above.
  state=page.request.get(BASE+'/api/state',headers={'Authorization':'Bearer '+'LOCAL_TEST_ONLY_'+'x'*32}).json()
  state['readiness']['mailConfigured']=True
  state['readiness']['sync']=None
  attempts=[]
  def sync_response(route):
   attempts.append(True)
   if len(attempts)==1:
    state['readiness']['sync']={'status':'error','errorCode':'IMAP_UIDVALIDITY_MISSING'}
    route.fulfill(status=500,json={'error':'네이버 로그인은 성공했지만 메일함 식별 정보를 확인하지 못했습니다.','code':'IMAP_UIDVALIDITY_MISSING'})
   else:
    state['readiness']['sync']={'status':'connected','lastSuccess':'2026-10-05T15:30:00Z'}
    route.fulfill(json={'imported':0})
  page.route('**/api/state',lambda route:route.fulfill(json=state))
  page.route('**/api/sync',sync_response)
  page.get_by_label('관리자 비밀키',exact=True).fill('LOCAL_TEST_ONLY_'+'x'*32);page.get_by_role('button',name='관리자 연결',exact=True).click()
  page.locator('.banner').filter(has_text='수집 확인 전').wait_for()
  page.get_by_role('button',name='메일 수집',exact=True).click()
  banner=page.locator('.banner').filter(has_text='메일 수집 오류');banner.wait_for();assert 'IMAP_UIDVALIDITY_MISSING' in banner.inner_text()
  page.get_by_role('button',name='메일 수집',exact=True).click()
  banner=page.locator('.banner').filter(has_text='메일 수집 연결 성공');banner.wait_for();assert 'IMAP_UIDVALIDITY_MISSING' not in banner.inner_text();assert '2026-10-06 00:30 KST' in banner.inner_text(),banner.inner_text()
  assert len(attempts)==2
  assert not errors,errors
  print(json.dumps({'admin_ui':'PASS','website_price_gate':'PASS','markup_20':'PASS','pdf_download':'PASS','mobile_320_1440':'PASS','spec_change_reconfirmation':'PASS','mail_status_retry':'PASS','js_errors':errors},ensure_ascii=False))
  browser.close()


def main():
 with tempfile.TemporaryDirectory(prefix='bn-procurement-browser-') as directory:
  out=Path(directory)
  with socket.socket() as listener:
   listener.bind(('127.0.0.1',0));port=listener.getsockname()[1]
  base=f'http://127.0.0.1:{port}'
  env={**os.environ,'XDG_CONFIG_HOME':str(out/'config'),'WRANGLER_LOG_PATH':str(out/'logs'),'WRANGLER_SEND_METRICS':'false'}
  with (out/'worker.log').open('w') as log:
   process=subprocess.Popen(['node',str(ROOT/'node_modules/wrangler/bin/wrangler.js'),'dev','--local','--ip','127.0.0.1','--port',str(port),'--persist-to',str(out/'storage'),'--var','PROCUREMENT_ADMIN_KEY:LOCAL_TEST_ONLY_'+'x'*32],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   try:
    for attempt in range(90):
     if process.poll() is not None:raise RuntimeError('Local worker exited before readiness')
     try:
      with urllib.request.urlopen(base+'/admin',timeout=1) as response:
       if response.status==200:break
     except Exception:time.sleep(.5)
    else:raise RuntimeError('Local worker readiness timeout')
    check(base,out)
   except Exception:
    print((out/'worker.log').read_text()[-5000:]);raise
   finally:
    process.terminate()
    try:process.wait(timeout=10)
    except subprocess.TimeoutExpired:process.kill();process.wait()


if __name__=='__main__':main()
