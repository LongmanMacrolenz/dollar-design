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
import struct

ROOT = Path(__file__).resolve().parents[2]


def check_channel(page, BASE, OUT):
  """The channel kit edits local copy and exports assets without sending requests."""
  page.context.grant_permissions(['clipboard-read','clipboard-write'])
  page.goto(BASE+'/admin/channel.html')
  page.locator('#ch-intro').wait_for()
  page.evaluate('localStorage.removeItem("bn-kakao-channel-copy-v1")')
  page.reload();page.locator('#ch-intro').wait_for()
  assert page.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow'
  assert page.locator('#ch-hours').input_value()=='평일 09:00–18:00'
  assert '자동 저장하거나 메시지를 발송하지 않습니다' in page.locator('.channel-warning').inner_text()
  assert page.locator('a[href="https://pf.kakao.com/_ZlHxiX/chat"]').count()==1
  requests=[];page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
  # A draft survives reload, renders as text, and is the value copied/exported.
  draft='BOM 상담 · <img src=x onerror=alert(1)> & 정확한 사양'
  page.locator('#ch-intro').fill(draft)
  page.locator('[data-copy=intro]').click()
  assert page.evaluate('navigator.clipboard.readText()')==draft
  assert page.locator('.channel-preview p').inner_text()==draft
  assert page.locator('.channel-preview p img').count()==0
  page.reload();page.locator('#ch-intro').wait_for()
  assert page.locator('#ch-intro').input_value()==draft
  page.locator('.channel-checklist summary').click();page.locator('[data-check=profile]').check()
  page.reload();page.locator('#ch-intro').wait_for();assert page.locator('[data-check=profile]').is_checked()
  assert page.locator('#check-progress').inner_text()=='1 / 5'
  page.locator('[data-group=chat]').click();assert '09:00–18:00' in page.locator('#ch-welcome').input_value()
  assert '실제 파일' not in page.locator('#ch-welcome').input_value()
  page.locator('[data-copy=bom-template]').click();text=page.evaluate('navigator.clipboard.readText()')
  assert '적용 도면·사양서 번호 / 개정:' in text and '대체품 검토 가능 여부:' in text
  page.locator('[data-group=faq]').click();page.locator('[data-group=faq]').focus();page.keyboard.press('ArrowRight')
  assert page.locator('[data-group=menu]').get_attribute('aria-selected')=='true'
  assert page.locator('#ch-menu-special-url').input_value().endswith('#lib?path=purchase')
  page.locator('[data-action=copy-all]').click();all_text=page.evaluate('navigator.clipboard.readText()')
  assert draft in all_text and '소식 3 · 구매 확인' in all_text and CHANNEL_CHAT in all_text
  with page.expect_download() as dl:page.locator('[data-action=export]').click()
  dl.value.save_as(OUT/'channel-copy.txt');assert (OUT/'channel-copy.txt').read_text()==all_text
  # The copy fallback remains usable when the Clipboard API is unavailable.
  page.evaluate('window.__channelClipboard=navigator.clipboard;Object.defineProperty(navigator,"clipboard",{value:undefined,configurable:true})')
  page.locator('[data-group=profile]').click();page.locator('[data-copy=intro]').click()
  assert page.evaluate('window.__channelClipboard.readText()')==draft
  for action,dimensions in [('profile-image',(400,400)),('cover-image',(1200,600))]:
   with page.expect_download() as dl:page.locator('[data-action='+action+']').click()
   path=OUT/(action+'.png');dl.value.save_as(path);image=path.read_bytes()
   assert image.startswith(b'\x89PNG\r\n\x1a\n') and struct.unpack('>II',image[16:24])==dimensions
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900})
   for group in ['profile','chat','faq','menu','posts']:
    page.locator('[data-group='+group+']').click()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,group)
  assert not requests,requests
  page.once('dialog',lambda d:d.accept());page.locator('[data-action=clear]').click();page.locator('[data-group=profile]').click()
  assert page.locator('#ch-intro').input_value()!=draft and page.locator('#check-progress').inner_text()=='0 / 5'
  print('카카오 입력 자료 · 수정/복사/로컬 저장/PNG/모바일: PASS')


CHANNEL_CHAT='https://pf.kakao.com/_ZlHxiX/chat'


def check_sales(page, BASE, OUT):
  """Sales shows an address and RFQ example without launching a mail client."""
  page.context.grant_permissions(['clipboard-read','clipboard-write'])
  page.emulate_media(reduced_motion='reduce')
  page.goto(BASE+'/#list');page.locator('#sales-copy-address').wait_for()
  requests=[];page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
  for width,height in [(320,668),(390,844),(768,1024),(1440,900)]:
   page.set_viewport_size({'width':width,'height':height});page.evaluate('document.fonts.ready')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   button=page.locator('#sales-copy-address').bounding_box();assert button['y']+button['height']<=height,(width,button)
   assert page.locator('.sales-page input:visible,.sales-page textarea:visible,.sales-page select:visible').count()==0
   assert page.locator('#sb').count()==0
  assert page.locator('#sales-email').inner_text()=='a8wlhg942@naver.com'
  assert page.locator('.sales-page a[href^="mailto:"]').count()==0
  assert page.locator('#sales-example-heading').inner_text()=='RFQ 이메일 예시'
  subject=page.locator('#sales-example-subject').inner_text();assert subject.startswith('[RFQ] Q-')
  body=page.locator('#sales-example-body').text_content()
  assert '단가, 공급 가능 수량, 납기, 서류 제공 범위' in body
  assert '모든 항목을 채울 필요는 없습니다' in page.locator('.sales-example-heading').inner_text()
  assert page.locator('.sales-chat a').get_attribute('href')==CHANNEL_CHAT
  pages=len(page.context.pages)
  page.locator('#sales-copy-address').click();page.locator('#sales-status').filter(has_text='이메일 주소를 복사').wait_for()
  assert page.evaluate('navigator.clipboard.readText()')=='a8wlhg942@naver.com'
  page.locator('[data-sales-copy=subject]').click();page.locator('#sales-example-status').filter(has_text='제목을 복사').wait_for()
  assert page.evaluate('navigator.clipboard.readText()')==subject
  page.locator('.sales-example [data-sales-copy=body]').click();page.locator('#sales-example-status').filter(has_text='본문 전체를 복사').wait_for()
  assert page.evaluate('navigator.clipboard.readText()')==body
  assert page.evaluate('window.__purchaseMetrics.handoff>=1')
  assert page.url.endswith('#list') and len(page.context.pages)==pages
  page.locator('#sales-memo-details summary').click()
  memo='RFQ 원문 그대로\n스터드 24 EA · 대체 불가\n<img src=x onerror=alert(1)> & 특수요건'
  page.locator('#sales-memo').fill(memo)
  assert memo in page.locator('#sales-example-body').text_content()
  page.locator('#sales-memo-details [data-sales-copy=body]').click();page.locator('#sales-memo-status').filter(has_text='본문 전체를 복사').wait_for()
  text=page.evaluate('navigator.clipboard.readText()');assert memo in text
  assert page.locator('.sales-page img').count()==0
  with page.expect_download() as dl:page.locator('.sales-example [data-sales-download]').click()
  dl.value.save_as(OUT/'sales-memo.txt');assert (OUT/'sales-memo.txt').read_text()==text
  long_memo=('고객 원문 RFQ · 특수요건·개정·수량 확인\n'*120)+'END-요구사항-보존'
  page.locator('#sales-memo').fill(long_memo)
  page.locator('.sales-example [data-sales-copy=body]').click()
  copied=page.evaluate('navigator.clipboard.readText()');assert long_memo in copied and copied.endswith('END-요구사항-보존')
  assert long_memo in page.locator('#sales-example-body').text_content()
  assert page.evaluate('(memo)=>!JSON.stringify(localStorage).includes(memo)',long_memo)
  # Clipboard API fallback and blocked copying preserve the complete body.
  page.evaluate('window.__salesClipboard=navigator.clipboard;Object.defineProperty(navigator,"clipboard",{value:undefined,configurable:true})')
  page.locator('.sales-example [data-sales-copy=body]').click()
  assert page.evaluate('window.__salesClipboard.readText()')==copied
  page.evaluate('document.execCommand=()=>false')
  page.locator('.sales-example [data-sales-copy=body]').click();page.locator('#sales-example-status').filter(has_text='복사가 제한됩니다').wait_for()
  assert long_memo in page.locator('#sales-example-body').text_content()
  with page.expect_download() as dl:page.locator('#sales-memo-details [data-sales-download]').click()
  dl.value.save_as(OUT/'sales-long.txt');assert long_memo in (OUT/'sales-long.txt').read_text()
  page.reload();page.locator('#sales-copy-address').wait_for();assert page.locator('#sales-memo').input_value()==''
  page.locator('#sales-manual-details summary').click();page.locator('#sb').wait_for()
  page.locator('[data-sb-ex=__list]').click();page.locator('[data-sb-rq]').wait_for()
  page.locator('#sales-manual-details summary').click();assert not page.locator('#sb').is_visible()
  page.goto(BASE+'/#sales');page.locator('#sales-copy-address').wait_for();assert page.url.endswith('#list')
  page.goto(BASE+'/#home');page.locator('#sales-home-copy').wait_for();assert page.locator('#sb').count()==0
  primary=page.locator('.bn-brand-copy a[data-purchase-event=start]')
  assert primary.get_attribute('href')=='#list' and primary.get_attribute('target') is None
  primary.click();page.locator('#sales-email').wait_for()
  assert page.url.endswith('#list') and len(page.context.pages)==pages
  assert page.locator('#sales-example-heading').is_visible()
  assert page.evaluate('window.__purchaseMetrics.start>=1')
  page.locator('header nav a[data-go=list]').click();page.locator('#sales-copy-address').wait_for()
  assert page.locator('.sales-page input:visible,.sales-page textarea:visible').count()==0
  # Prepared specification questions appear in the visible, copied example.
  page.goto(BASE+'/#lib?path=purchase');page.locator('[data-purchase-line]').fill('RFQ line 12')
  page.locator('[data-purchase-field="3"]').fill('사용 조건 원문 · 개정 B · 대체 불가')
  page.locator('[data-purchase-continue]').click();page.locator('.sales-requirements').wait_for()
  page.locator('.sales-example [data-sales-copy=body]').click()
  page.locator('#sales-example-status').filter(has_text='본문 전체를 복사').wait_for()
  copied=page.evaluate('navigator.clipboard.readText()');assert 'RFQ line 12' in copied and '사용 조건 원문 · 개정 B · 대체 불가' in copied
  assert copied==page.locator('#sales-example-body').text_content()
  assert not requests,requests
  print('Sales · 내부 이동/주소·RFQ 예시 복사/메모 보존/선택 분석/특수요건: PASS')


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
  assert page.get_by_role('link',name='카카오 채널',exact=True).get_attribute('href')=='/admin/channel.html'
  check_channel(page,BASE,OUT)
  check_sales(page,BASE,OUT)
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
