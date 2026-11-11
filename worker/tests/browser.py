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


def check_mail(page, BASE, OUT):
  """The customer-mail kit edits local drafts, keeps the checklist, and sends nothing."""
  page.context.grant_permissions(['clipboard-read','clipboard-write'])
  page.goto(BASE+'/admin/mail.html')
  page.locator('#ms-received').wait_for()
  page.evaluate('localStorage.removeItem("bn-mail-copy-v1")')
  page.reload();page.locator('#ms-received').wait_for()
  assert page.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow'
  assert '메일을 보내거나 고객 정보를 저장하지 않습니다' in page.locator('.channel-warning').inner_text()
  requests=[];page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
  # 6 order stages + 2 sales tabs (first contact, suppliers), 19 templates; account numbers never ship in the templates.
  assert page.locator('.channel-nav [role=tab]').count()==8 and page.locator('.channel-field').count()==19
  # First contact asks before sending. The mail I initiate follows the ad-mail format: (광고) subject, sender block with an address blank, opt-out in Korean and English.
  # The text message is a plain notice (no pitch, no ad label) and the address is never shipped in the template.
  assert '보내 드려도 될까요' in page.locator('#mb-reach-call').input_value() and page.locator('#ms-reach-mail').input_value().startswith('(광고) ')
  first=page.locator('#mb-reach-mail').input_value();assert '[사업장 주소]' in first and '수신거부' in first and 'unsubscribe' in first
  assert '견적' not in page.locator('#mb-reach-sms').input_value() and not page.locator('#ms-reach-reply').input_value().startswith('(광고)')
  assert '사전 동의' in page.locator('#panel-reach > p').inner_text() and page.get_by_role('link',name='소개서 PDF',exact=True).get_attribute('href')=='/brand/boltnote-intro.pdf'
  page.locator('[data-group=order]').click();body=page.locator('#mb-order-confirm').input_value()
  assert '[은행 계좌번호' in body and '입금자명' in body
  assert not any(ch.isdigit() for ch in body.split('입금 계좌')[1].split('입금자명')[0]),'account digits must not ship in templates'
  page.locator('[data-copy=order-confirm]').click();assert page.evaluate('navigator.clipboard.readText()')==body
  page.locator('[data-copy-subject=order-confirm]').click();assert page.evaluate('navigator.clipboard.readText()')=='[BNQ-번호] 발주 확인 및 입금 안내 — [건명]'
  # A draft survives reload and the blank counter follows the text.
  page.locator('#mb-order-confirm').fill('테스트 [하나] <img src=x onerror=alert(1)>')
  assert page.locator('[data-count=order-confirm]').inner_text()=='채울 칸 [ ] 3개'   # 제목의 [BNQ-번호]·[건명] + 본문의 [하나]
  page.reload();page.locator('#ms-received').wait_for();page.locator('[data-group=order]').click()
  assert page.locator('#mb-order-confirm').input_value().startswith('테스트 [하나]') and page.locator('#panel-order img').count()==0
  page.once('dialog',lambda d:d.accept());page.locator('[data-reset=order-confirm]').click();assert page.locator('#mb-order-confirm').input_value()==body
  # Checklist marks persist until a new order is started.
  page.locator('[data-check=c-rfq]').check();page.locator('[data-check=c-tax]').check()
  page.reload();page.locator('#ms-received').wait_for();assert page.locator('#check-progress').inner_text()=='2 / 12'
  page.once('dialog',lambda d:d.accept());page.locator('[data-action=new-order]').click();assert page.locator('#check-progress').inner_text()=='0 / 12'
  page.locator('[data-group=receive]').focus();page.keyboard.press('End');assert page.locator('[data-group=supply]').get_attribute('aria-selected')=='true'
  with page.expect_download() as dl:page.locator('[data-action=export]').click()
  dl.value.save_as(OUT/'mail-copy.txt');text=(OUT/'mail-copy.txt').read_text(encoding='utf-8');assert '## 3. 발주·입금' in text and body in text
  assert page.get_by_role('link',name='견적 관리',exact=True).first.get_attribute('href')=='/admin/'
  assert not requests,requests


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


def check_not_found(page, BASE, OUT):
  """An unknown address gets the guide page with a 404 status at any depth, and its links work from there."""
  page.set_viewport_size({'width':1280,'height':800})
  for path in ('/no-such-page','/lib/no-such-entry','/products/category/no-such'):
   response=page.goto(BASE+path);assert response.status==404,(path,response.status)
   assert page.locator('h1').count()==1 and page.locator('h1').inner_text()=='찾으시는 주소가 없습니다',path
   assert page.locator('meta[name=robots]').get_attribute('content')=='noindex,follow' and page.locator('link[rel=canonical]').count()==0
   assert [a.get_attribute('href') for a in page.locator('.cards a').all()]==['/','/products/','/lib/','/#list'],path
  page.locator('.cards a[href="/lib/"]').click();page.wait_for_url(BASE+'/lib/');assert page.locator('h1').count()==1
  assert page.goto(BASE+'/lib/ks-b-2819').status==200   # a real page is untouched

def check_boot(page, BASE, OUT):
  """Before JavaScript the home already shows the dark hero copy; nothing jumps when the app takes over; other routes do not flash home text."""
  browser=page.context.browser
  # No JavaScript: the static overview is the whole page, with one keyword h1 and the footer below the first screen.
  context=browser.new_context(viewport={'width':1280,'height':800},java_script_enabled=False);still=context.new_page();still.goto(BASE+'/')
  assert still.locator('html').get_attribute('class')=='bn-boot-home' and still.locator('h1').count()==1
  assert still.locator('#initial-home-title').inner_text()=='산업설비 볼트·너트 구매와 BOM 견적'
  assert ' '.join(still.locator('.bn-boot-line').inner_text().split())=='작은 것이, 전부를 붙잡습니다.' and still.locator('.bn-boot-lead').inner_text()=='체결부품 조달, BOM부터 정확하게.'
  assert still.locator('.bn-boot-btn[href="/#list"]').is_visible() and still.locator('.bn-boot-more a[href="/products/hex-nut"]').is_visible()
  assert still.evaluate('getComputedStyle(document.body).backgroundColor')=='rgb(10, 14, 19)' and still.locator('meta[name="theme-color"]').get_attribute('content')=='#0a0e13'
  assert still.evaluate('document.querySelector("footer.foot").getBoundingClientRect().top>=innerHeight')
  context.close()
  # With JavaScript: the boot classes are gone, the browser colour follows the screen, and layout shift stays small on both routes.
  observer='window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:"layout-shift",buffered:true})'
  read='({cls:window.__cls,html:document.documentElement.className,theme:document.documentElement.getAttribute("data-theme"),meta:document.querySelector("meta[name=theme-color]").content,bg:getComputedStyle(document.body).backgroundColor,overview:document.querySelectorAll(".search-overview").length})'
  for size in ({'width':390,'height':844},{'width':1280,'height':800}):
   for route,ready,colour in (('','.bn-tighten','rgb(10, 14, 19)'),('#list','#sales-email','rgb(244, 243, 239)')):
    context=browser.new_context(viewport=size);live=context.new_page();live.add_init_script(observer);live.goto(BASE+'/'+route);live.locator(ready).wait_for();live.wait_for_timeout(1500)
    state=live.evaluate(read)
    assert state['html']=='' and state['overview']==0 and state['meta']==state['bg']==colour,(size,route,state)
    assert state['cls']<0.1,(size,route,state)
    context.close()
  # A saved dark theme is set by the head script (no light flash) and the browser colour follows it.
  context=browser.new_context(viewport={'width':1280,'height':800});dark=context.new_page()
  dark.add_init_script('try{localStorage.setItem("bn.theme",JSON.stringify("dark"))}catch(e){}');dark.goto(BASE+'/#list');dark.locator('#sales-email').wait_for()
  state=dark.evaluate(read);assert state['theme']=='dark' and state['meta']==state['bg'] and state['bg']!='rgb(244, 243, 239)',state
  context.close()

def check_phone_bar(page, BASE, OUT):
  """The sticky phone bar keeps its four items on one row at common phone widths, with the cart still named."""
  page.emulate_media(reduced_motion='no-preference')
  for width in (320,360,390):
   page.set_viewport_size({'width':width,'height':780});page.goto(BASE+'/#products');page.locator('#ia-pbody').wait_for()
   page.evaluate('scrollTo(0,900)');page.locator('#tb-mini.on').wait_for()
   page.wait_for_function('getComputedStyle(document.querySelector("#tb-mini")).transform==="none"||new DOMMatrix(getComputedStyle(document.querySelector("#tb-mini")).transform).m42===0')
   boxes=page.locator('#tb-mini > *').evaluate_all('els=>els.map(e=>{const r=e.getBoundingClientRect();return[Math.round(r.top),Math.round(r.left),Math.round(r.right),Math.round(r.height)]})')
   assert len(boxes)==4 and len({b[0] for b in boxes})==1,(width,boxes)   # one row
   assert all(boxes[i][2]<=boxes[i+1][1]+1 for i in range(3)) and boxes[-1][2]<=width,(width,boxes)   # left to right, inside the screen
   assert page.locator('#tb-mini').bounding_box()['height']<=64,width
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
   assert '견적함' in page.locator('#tb-mini a[data-go=cart]').inner_text() and page.locator('#tb-mini .bn-logo').bounding_box()['width']>=70,width
  page.set_viewport_size({'width':1280,'height':800});page.evaluate('scrollTo(0,0)')

def check_materials(page, BASE, OUT):
  """The materials entrance is inquiry-only: four cards prefill the RFQ memo, never drop a typed memo, and promise nothing."""
  page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':1280,'height':800})
  page.goto(BASE+'/#materials');page.reload();page.locator('.mat-grid').wait_for()   # hash navigation keeps JS state, so start from a fresh document
  requests=[];page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
  assert '소재 문의' in page.title() and page.locator('#view h1').count()==1 and page.locator('#h-z-a').inner_text().startswith('소재 문의')
  assert page.locator('.mat-grid article').count()==4 and [b.get_attribute('data-material-inquiry') for b in page.locator('[data-material-inquiry]').all()]==['shim','bar','plate','forged']
  text=page.locator('#view').inner_text()
  for word in ('재고 보유','당일 출고','바로 공급','보증합니다','저희가 공급'):assert word not in text,word
  assert '공급처 확인 뒤 견적서에 적습니다' in text and '보장하는 안내가 아닙니다' in text and '체결부품만 읽습니다' in text
  assert [a.get_attribute('href') for a in page.locator('.purchase-note a').all()]==['#lib-t-mtr','#lib-t-en10204-types','#lib-t-heat-lot']
  # A card fills the memo with its template, opens the memo, and changes only the topic word of the subject.
  before=page.evaluate('window.__purchaseMetrics.start')
  page.locator('[data-material-inquiry=shim]').click();page.locator('#sales-memo').wait_for()
  assert page.evaluate('location.hash')=='#list' and page.evaluate('window.__purchaseMetrics.start')==before+1
  assert page.locator('#sales-memo-details').get_attribute('open') is not None
  memo=page.locator('#sales-memo').input_value()
  assert memo.startswith('심(Shim) 견적을 요청드립니다.') and '요청사항: 단가, 공급 가능 수량, 납기, 서류 제공 범위' in memo and '회사 / 담당자' in memo and '회신 연락처' in memo
  subject=page.locator('#sales-example-subject').inner_text();assert subject.startswith('[RFQ] Q-') and subject.endswith(' 소재 견적 문의'),subject
  assert memo in page.locator('#sales-example-body').inner_text()
  # An untouched template is replaced by the next card.
  page.goto(BASE+'/#materials');page.locator('.mat-grid').wait_for();page.locator('[data-material-inquiry=plate]').click();page.locator('#sales-memo').wait_for()
  memo=page.locator('#sales-memo').input_value();assert memo.startswith('판재(Plate) 견적을 요청드립니다.') and '심(Shim)' not in memo
  # Emptying the memo returns the subject to fasteners; a typed memo is kept and the template is appended after it.
  page.locator('#sales-memo').fill('');assert page.locator('#sales-example-subject').inner_text().endswith(' 체결부품 견적 문의')
  page.locator('#sales-memo').fill('기존 설비용 스터드 24개가 필요합니다.')
  page.goto(BASE+'/#materials');page.locator('.mat-grid').wait_for();page.locator('[data-material-inquiry=bar]').click();page.locator('#sales-memo').wait_for()
  memo=page.locator('#sales-memo').input_value()
  assert memo.startswith('기존 설비용 스터드 24개가 필요합니다.\n\n봉재(Bar stock) 견적을 요청드립니다.'),memo
  assert page.locator('#sales-example-subject').inner_text().endswith(' 체결부품 견적 문의')
  page.goto(BASE+'/#materials');page.locator('.mat-grid').wait_for();page.locator('[data-material-inquiry=bar]').click();page.locator('#sales-memo').wait_for()
  assert page.locator('#sales-memo').input_value()==memo   # the same template is not appended twice
  # Entrances: the home footer links and a box under the product list that survives the filter redraw.
  page.goto(BASE+'/#home');page.locator('.bn-home-links').wait_for();assert page.locator('.bn-home-links a[href="#materials"]').count()==1
  page.goto(BASE+'/#products');page.locator('.mat-entry').wait_for();assert page.locator('.mat-entry a[href="#materials"]').count()==1
  page.locator('[data-ia-sys=inch]').click();assert page.locator('.mat-entry').count()==1;page.locator('[data-ia-sys=all]').click()
  page.set_viewport_size({'width':390,'height':844})
  for route in ('materials','products'):
   page.goto(BASE+'/#'+route);page.locator('.mat-grid' if route=='materials' else '.mat-entry').wait_for();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),route
  page.set_viewport_size({'width':1280,'height':800})
  assert not requests,requests
  page.goto(BASE+'/#home');page.reload()   # leave no memo behind

def check_landed(page, BASE, OUT):
  """The landed-cost calculator works only from typed numbers, keeps them in this browser, and sends nothing."""
  page.context.grant_permissions(['clipboard-read','clipboard-write'])
  page.set_viewport_size({'width':1280,'height':800})
  page.goto(BASE+'/admin/landed.html');page.locator('[data-f=qty]').wait_for()
  page.evaluate('localStorage.removeItem("bn-landed-cost-v1")');page.reload();page.locator('[data-f=qty]').wait_for()
  assert page.locator('meta[name=robots]').get_attribute('content')=='noindex,nofollow'
  assert '아무것도 서버로 보내지 않습니다' in page.locator('.channel-warning').inner_text()
  requests=[];page.on('request',lambda r:requests.append(r.url) if '/api/' in r.url else None)
  # Nothing ships prefilled: every box starts empty and no result is shown until quantity, price and rate are typed.
  assert all(v=='' for v in page.locator('#landed-app input[type=text]').evaluate_all('els=>els.map(e=>e.value)'))
  assert '빠진 값: 수량, 가격, 환율' in page.locator('#r-empty').inner_text() and page.locator('#r-unit').count()==0
  for key,value in {'qty':'1000','unit':'kg','price':'1','currency':'USD','fx':'1000','fxNote':'시험','freight':'100','insurance':'10','dutyPct':'10','adPct':'0','arrival':'100000','broker':'50000','truck':'150000','sellUnit':'2000','targetMarginPct':'20','markupPct':'20'}.items():page.locator(f'[data-f={key}]').fill(value)
  result=lambda:[page.locator(s).inner_text() for s in ('#r-unit','#r-cost','#r-profit','#r-margin','#r-cash')]
  assert result()==['1,521원','1,521,000원','479,000원','24%','1,673,100원'],result()
  assert page.locator('#r-price-margin').inner_text()=='1,902원' and page.locator('#r-price-markup').inner_text()=='1,826원'
  assert '통관 비용 371,000원 · 운송비 150,000원' in page.locator('#r-admin').inner_text()
  assert page.locator('#r-lots tbody tr').count()==5 and '2,751원' in page.locator('#r-lots tbody tr').first.inner_text()
  assert '1,521원' in page.locator('#landed-bar').inner_text()
  # Anti-dumping duty, freight already in the price, and a non-number change the result at once.
  page.locator('[data-f=adPct]').fill('30');assert page.locator('#r-cost').inner_text()=='1,854,000원'
  page.locator('[data-f=adPct]').fill('0');page.locator('[data-f=freightIncluded]').check()
  assert page.locator('#r-cost').inner_text()=='1,400,000원' and '계산에 넣지 않았습니다' in page.locator('#r-warnings').inner_text()
  page.locator('[data-f=freightIncluded]').uncheck();assert page.locator('#r-cost').inner_text()=='1,521,000원'
  page.locator('[data-f=price]').fill('1x');assert '숫자로 읽을 수 없는 칸' in page.locator('#r-empty').inner_text();page.locator('[data-f=price]').fill('1')
  # Weight from dimensions needs a typed density.
  page.locator('.landed-weight summary').click();page.locator('[data-f=wShape]').select_option('plate')
  for key,value in {'wT':'10','wW':'1000','wL':'2000','wCount':'1'}.items():page.locator(f'[data-f={key}]').fill(value)
  assert '넣으면 무게가 나옵니다' in page.locator('#weight-out').inner_text()
  page.locator('[data-f=wDensity]').fill('8');assert page.locator('#weight-out').inner_text()=='약 160 kg'
  page.locator('[data-action=use-weight]').click();assert page.locator('[data-f=weightKg]').input_value()=='160'
  # Saved cases persist, their names render as text, and a reload restores the inputs.
  page.locator('#sc-name').fill('<img src=x onerror=alert(1)> 수입');page.locator('[data-action=save-scenario]').click();page.locator('#sc-table tbody tr').wait_for()
  page.reload();page.locator('[data-f=qty]').wait_for()
  assert page.locator('[data-f=qty]').input_value()=='1000' and page.locator('#r-unit').inner_text()=='1,521원'
  assert page.locator('#sc-table tbody tr').count()==1 and '<img src=x' in page.locator('#sc-table tbody th').inner_text() and page.locator('#landed-app img').count()==0
  page.locator('[data-f=qty]').fill('500');assert page.locator('#r-unit').inner_text()=='1,942원'
  page.locator('[data-load="0"]').click();assert page.locator('[data-f=qty]').input_value()=='1000'
  page.locator('[data-action=copy]').click();text=page.evaluate('navigator.clipboard.readText()');assert '총 원가: 1,521,000원' in text and '어림 계산입니다' in text
  with page.expect_download() as dl:page.locator('[data-action=export]').click()
  dl.value.save_as(OUT/'landed.txt');assert (OUT/'landed.txt').read_text(encoding='utf-8')==text
  for width in (320,390,768,1440):
   page.set_viewport_size({'width':width,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.set_viewport_size({'width':1280,'height':800})
  assert page.get_by_role('link',name='견적 관리',exact=True).first.get_attribute('href')=='/admin/'
  page.once('dialog',lambda d:d.accept());page.locator('[data-action=clear]').click()
  assert page.locator('[data-f=qty]').input_value()=='' and page.locator('#sc-table').count()==0 and page.evaluate('localStorage.getItem("bn-landed-cost-v1")') is None
  assert not requests,requests

def check_home(page, BASE, OUT):
  """The home hero keeps its message and CTA visible; the tightening pose obeys thread kinematics; fallbacks render."""
  import math
  page.emulate_media(reduced_motion='no-preference');page.set_viewport_size({'width':1280,'height':800})
  page.goto(BASE+'/#home');page.locator('.bn-tighten h1').wait_for();page.wait_for_function('window.__tightenTest')
  assert page.locator('#view h1').count()==1 and page.locator('#h-z-a').get_attribute('aria-label')=='작은 것이, 전부를 붙잡습니다.'
  assert page.locator('#h-z-a').inner_text().replace('\n','').replace('\xa0',' ')=='작은 것이,전부를 붙잡습니다.'
  assert '참고용 실시간 렌더링 · 실제 제품 사진 아님' in page.locator('.bn-tighten-note').inner_text()
  cta=page.locator('.bn-brand-copy a[data-purchase-event=start]');assert cta.get_attribute('href')=='#list' and cta.is_visible()
  box=cta.bounding_box();assert box['y']+box['height']<=800,box   # CTA is on the first screen without scrolling
  assert [a.get_attribute('href') for a in page.locator('.bn-door').all()]==['#products','#lib','#list']
  assert page.locator('#sales-home-copy').count()==1 and page.locator('#bn-brand-video').count()==0 and page.locator('#sb').count()==0
  # The contact panel carries a business card (logo, name, address to copy) and a KakaoTalk button with its speech-bubble mark; no mailto anywhere.
  assert page.locator('.sales-biz #sales-email').inner_text()=='a8wlhg942@naver.com' and page.locator('.sales-biz img.sales-biz-logo').get_attribute('alt')=='볼트노트'
  assert page.locator('.sales-chat a.sales-kakao svg').count()==1 and page.locator('.sales-contact a[href^="mailto:"]').count()==0
  assert page.locator('#bn-engineering-details').count()==1 and page.locator('.purchase-trust').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Headline type: the display face is requested for exactly the characters in use; line one stays thin, line two gains weight as the nut tightens.
  font=page.evaluate('()=>{const l=document.getElementById("bn-home-font"),u=l&&new URL(l.href),need=[...new Set([...document.querySelectorAll(".bn-tighten h1, .bn-tighten-stamp b, .bn-door b, .bn-home .bn-section-head h2, .bn-home .bn-rfq-copy h2")].map(e=>e.textContent).join("").replace(/\\s/g,""))],cs=s=>getComputedStyle(document.querySelector(s)),T=window.__tightenTest;return{host:u&&u.host,family:u&&u.searchParams.get("family"),missing:u?need.filter(c=>!u.searchParams.get("text").includes(c)):need,h1:cs(".bn-tighten h1").fontFamily,thin:cs(".bn-tl.bn-thin").fontVariationSettings,heavy:cs(".bn-tl:not(.bn-thin)").fontVariationSettings,want:T.state().pinned?T.cfg.w0:T.cfg.w1}}')
  assert font['host']=='fonts.googleapis.com' and font['family']=='Hahmlet:wght@100..900' and font['missing']==[],font
  assert font['h1'].startswith('Hahmlet') and font['thin']=='"wght" 200' and font['heavy']==f'"wght" {font["want"]}',font
  # The pure pose function. Order: halves meet -> taper pins go in -> fasteners come down -> they turn. Threads: one pitch per turn, stop at the seat.
  data=page.evaluate('()=>{const T=window.__tightenTest;return{pitch:T.pitch,cfg:T.cfg,sets:[0,.5,1].map(s=>Array.from({length:1001},(_,i)=>{const q=T.pose(i/1000,s);return[q.lift,q.pin,q.drop,q.nut.turns,q.nut.advance,q.nut.theta,q.nut.left,q.screw.turns,q.screw.advance,q.screw.left,q.mated,q.seated]}))}}')
  pitch,cfg=data['pitch'],data['cfg']
  assert pitch=={'nut':2,'screw':1.75} and cfg['stud']=='M16' and cfg['screw']=='M12' and 0<cfg['p0']<cfg['pa']<cfg['pb']<cfg['p2']<1
  for rows in data['sets']:
   previous=None
   for i,(lift,pin,drop,nt,na,ntheta,nleft,st,sa,sleft,mated,seated) in enumerate(rows):
    p=i/1000
    assert 0<=lift<=cfg['lift']+1e-9 and 0<=pin<=1 and 0<=drop<=1 and 0<=nt<=cfg['nutTurns'] and 0<=st<=cfg['screwTurns'],p
    assert abs(na-pitch['nut']*nt)<1e-9 and abs(sa-pitch['screw']*st)<1e-9 and abs(ntheta-2*math.pi*nt)<1e-9,p
    assert abs(nleft-pitch['nut']*(cfg['nutTurns']-nt))<1e-9 and abs(sleft-pitch['screw']*(cfg['screwTurns']-st))<1e-9 and nleft>=-1e-12 and sleft>=-1e-12,p
    assert mated==(p>=cfg['pa']) and seated==(p>=cfg['p2']) and (lift==0)==mated,p
    if pin>0:assert lift==0,p            # pins only after the halves have met
    if drop>0:assert pin==1,p            # fasteners only after the pins are home
    if nt>0 or st>0:assert drop==1,p     # no turning before the thread start
    if seated:assert nt==cfg['nutTurns'] and st==cfg['screwTurns'] and nleft==0 and sleft==0,p
    if previous:assert lift<=previous[0]+1e-12 and pin>=previous[1]-1e-12 and drop>=previous[2]-1e-12 and nt>=previous[3]-1e-12 and st>=previous[4]-1e-12,p
    previous=(lift,pin,drop,nt,st)
   assert rows[0][0]==cfg['lift'] and rows[0][3]==0 and rows[-1][3]==cfg['nutTurns'] and rows[-1][7]==cfg['screwTurns']
  later=[next(i for i,r in enumerate(rows) if r[3]>0) for rows in data['sets']];assert later[0]<later[1]<later[2],later   # fasteners start one after another
  assert page.locator('.bn-tighten-math p').count()>=8 and page.locator('.bn-tighten-math').get_attribute('aria-hidden')=='true'
  assert page.locator('.bn-math-roll .bn-math-strip').count()==1 and page.locator('.bn-math-chart svg path.cv').count()==1 and page.locator('.bn-math-chart svg path.now').count()==1   # the calc sheet roll and the tension curve
  state=page.evaluate('window.__tightenTest.state()')
  if state['pinned']:
   # Scrolling drives the scene; the stamp appears only once seated and the hero releases afterwards.
   assert state['webgl'] and page.locator('.bn-tighten').get_attribute('data-seated')=='false'
   page.evaluate('()=>{const r=document.querySelector(".bn-tighten"),s=r.querySelector(".bn-tighten-stage");scrollTo(0,r.offsetTop+r.offsetHeight-s.offsetHeight)}')
   page.wait_for_function('window.__tightenTest.state().p>0.999',timeout=20000)
   assert page.locator('.bn-tighten').get_attribute('data-seated')=='true'
   page.wait_for_function('getComputedStyle(document.querySelector(".bn-tighten-stamp")).opacity==="1"')
   assert page.locator('.bn-tighten-stamp').inner_text().strip()=='볼트는, 볼트노트.'
   assert page.evaluate('getComputedStyle(document.querySelector(".bn-tl:not(.bn-thin)")).fontVariationSettings')==f'"wght" {cfg["w1"]}' and cfg['w0']<cfg['w1']
   roll=page.evaluate('()=>{const c=getComputedStyle(document.querySelector(".bn-tighten"));return{m:+c.getPropertyValue("--m"),r:+c.getPropertyValue("--r"),t:+c.getPropertyValue("--t")}}')
   assert roll=={'m':1,'r':1,'t':1},roll   # seated: the sheet has rolled all the way and the preload marker is at F_i
   page.wait_for_function('Math.abs(document.querySelector(".bn-math-strip").getBoundingClientRect().bottom-document.querySelector(".bn-math-roll").getBoundingClientRect().bottom)<=1.5',timeout=20000)   # the end of the sheet meets the end of its window, also after a late font changed its length
   page.evaluate('scrollTo(0,0)');page.wait_for_function('window.__tightenTest.state().p<0.001',timeout=20000)
   assert page.locator('.bn-tighten').get_attribute('data-seated')=='false'
  # Scenes below the hero: each one is held in place, tightens with the scroll, and hits exactly once when it seats.
  page.wait_for_function('window.__sceneTest')
  scenes=page.evaluate('()=>{const tb=document.querySelector(".tb"),top=getComputedStyle(tb).position==="sticky"?tb.offsetHeight:0;return [...document.querySelectorAll(".bn-scene")].map(el=>({kind:el.dataset.scene,top,y0:el.getBoundingClientRect().top+scrollY-top,span:el.offsetHeight-el.querySelector(".bn-scene-stage").offsetHeight}))}')
  assert [s['kind'] for s in scenes]==['doors','lineup','rfq'] and all(s['span']>200 for s in scenes),scenes
  scene=lambda kind:page.evaluate('k=>__sceneTest.state().find(s=>s.kind===k)',kind)
  seat='k=>__sceneTest.state().find(s=>s.kind===k).seated'
  assert all(scene(s['kind'])['pin'] and scene(s['kind'])['seated'] is False for s in scenes)
  for s in scenes:
   k=s['kind'];page.evaluate('y=>scrollTo(0,y)',s['y0']+s['span']*.4)
   page.wait_for_function('k=>Math.abs(__sceneTest.state().find(s=>s.kind===k).q-.4)<.01',arg=k,timeout=20000)
   mid=page.evaluate('k=>{const el=document.querySelector(`.bn-scene[data-scene="${k}"]`);return{e:+el.style.getPropertyValue("--e"),seated:el.dataset.seated,top:el.querySelector(".bn-scene-stage").getBoundingClientRect().top}}',k)
   assert abs(mid['e']-.5)<.02 and mid['seated']=='false' and abs(mid['top']-s['top'])<=1,(k,mid)
   if k=='lineup':   # halfway: all six product images have been dealt out small and are on screen at once
    dealt=page.evaluate('()=>{const t=document.querySelector(".bn-lineup .bn-products").getBoundingClientRect();return [...document.querySelectorAll(".bn-lineup .bn-products>li")].map(li=>{const r=li.getBoundingClientRect();return r.left>=t.left-2&&r.right<=t.right+2&&r.width>20&&+getComputedStyle(li).opacity>.9})}')
    assert dealt==[True]*6,dealt
   page.evaluate('y=>scrollTo(0,y)',s['y0']+s['span']*.95);page.wait_for_function(seat,arg=k,timeout=20000)
   after=scene(k);assert after['hits']==1 and after['mode']=='down' and page.locator(f'.bn-scene[data-scene="{k}"]').get_attribute('data-seated')=='true',(k,after)
   assert page.locator(f'.bn-scene[data-scene="{k}"].is-hit').count()==1 and page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if k=='lineup':   # seated: the heading is at full weight, tiles are back at full size, and the carousel can be paged
    assert page.evaluate('getComputedStyle(document.querySelector(".bn-lineup .bn-grow")).fontWeight')=='800'
    page.wait_for_function('()=>{const t=document.querySelector(".bn-lineup .bn-products"),a=t.children[0],b=t.children[5];return Math.abs(a.getBoundingClientRect().width-a.offsetWidth)<1&&b.getBoundingClientRect().left>t.getBoundingClientRect().right}',timeout=20000)
    assert page.locator('[data-bn-products-step="1"]').is_enabled()
  # Scrolling up from below: a scene that has gone past starts loose again and tightens as the page moves up.
  page.evaluate('scrollTo(0,document.documentElement.scrollHeight)')
  page.wait_for_function('__sceneTest.state().slice(0,2).every(s=>s.mode==="up"&&!s.seated&&s.q<.001)',timeout=20000)
  for s in reversed(scenes[:2]):
   k=s['kind'];page.evaluate('y=>scrollTo(0,y)',s['y0']+s['span']*.6)
   page.wait_for_function('k=>Math.abs(__sceneTest.state().find(s=>s.kind===k).q-.4)<.01',arg=k,timeout=20000)
   assert scene(k)['mode']=='up' and scene(k)['seated'] is False and scene(k)['hits']==1,(k,scene(k))
   page.evaluate('y=>scrollTo(0,y)',s['y0']+s['span']*.05);page.wait_for_function(seat,arg=k,timeout=20000);assert scene(k)['hits']==2,(k,scene(k))
  # Turning back mid-scene loosens it without a hit; tightening again hits again.
  doors=scenes[0];page.evaluate('y=>scrollTo(0,y)',doors['y0']+doors['span']*.7)
  page.wait_for_function('k=>!__sceneTest.state().find(s=>s.kind===k).seated',arg='doors',timeout=20000);assert scene('doors')['hits']==2
  page.evaluate('y=>scrollTo(0,y)',doors['y0']);page.wait_for_function(seat,arg='doors',timeout=20000);assert scene('doors')['hits']==3
  page.evaluate('scrollTo(0,0)')
  # Reduced motion: no scroll pinning, the seated still and the full message.
  page.emulate_media(reduced_motion='reduce');page.reload();page.locator('.bn-tighten.is-static').wait_for()
  assert page.locator('.bn-tighten').get_attribute('data-seated')=='true'
  assert page.evaluate('document.querySelector(".bn-tighten").offsetHeight<=innerHeight*1.2')
  assert page.locator('.bn-tighten-stamp').is_visible() and page.locator('.bn-brand-copy a[data-purchase-event=start]').is_visible()
  still=page.evaluate('()=>[...document.querySelectorAll(".bn-scene")].map(el=>[el.dataset.seated,el.classList.contains("is-live")||el.classList.contains("is-pin"),el.style.getPropertyValue("--e"),getComputedStyle(el.querySelector(".bn-scene-stage")).position])')
  assert still==[['true',False,'','static']]*3,still   # no pinning, no loose state: the seated layout as written
  # No WebGL: the poster replaces the canvas and nothing throws.
  context=page.context.browser.new_context(viewport={'width':1280,'height':800});other=context.new_page();problems=[];other.on('pageerror',lambda e:problems.append(str(e)))
  other.add_init_script('const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:g.call(this,t,...a)}')
  other.goto(BASE+'/#home');other.locator('.bn-tighten.is-fallback.is-static').wait_for()
  poster=other.locator('.bn-tighten-poster');assert poster.is_visible() and poster.get_attribute('src')=='media/boltnote-tighten-poster.webp'
  other.wait_for_function('document.querySelector(".bn-tighten-poster").naturalWidth===1600')
  assert other.locator('.bn-tighten-canvas').is_hidden() and other.locator('.bn-tighten').get_attribute('data-seated')=='true'
  assert not problems,problems;context.close()
  page.emulate_media(reduced_motion='no-preference')
  # Phone: the scenes still hold and seat, and nothing overflows sideways.
  page.set_viewport_size({'width':390,'height':844});page.goto(BASE+'/#lib');page.goto(BASE+'/#home');page.wait_for_function('window.__sceneTest')
  phone=page.evaluate('()=>{const el=document.querySelector(".bn-doors-sec");return{pins:__sceneTest.state().map(s=>s.pin),y:el.getBoundingClientRect().top+scrollY+(el.offsetHeight-el.querySelector(".bn-scene-stage").offsetHeight)*.95}}')
  assert all(phone['pins']),phone
  page.evaluate('y=>scrollTo(0,y)',phone['y']);page.wait_for_function('__sceneTest.state()[0].seated',timeout=20000)
  assert page.evaluate('__sceneTest.state()[0].hits')==1 and page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Laptop-height windows: every scene must still be held and animated (the product section used to fall back to a still here).
  for size in ({'width':1536,'height':730},{'width':1366,'height':650}):
   page.set_viewport_size(size);page.goto(BASE+'/#lib');page.goto(BASE+'/#home');page.wait_for_function('window.__sceneTest')
   assert all(page.evaluate('__sceneTest.state().map(s=>s.pin)')),(size,page.evaluate('__sceneTest.state()'))
  page.set_viewport_size({'width':1280,'height':800})
  print('홈 조립 장면 · 문구/CTA/자세 함수(순서·나사)/스크롤 고정/아래 구역 조임·흔들림/올릴 때/움직임 줄이기/WebGL 대체: PASS')


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
  assert page.title()==page.locator('meta[property="og:title"]').get_attribute('content')
  assert 'BOM' in page.title() and page.locator('a[href="/products/"]').count()>0
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


def check_english(page, BASE, OUT):
  """English page for buyers in Korea: lang en, the address and KakaoTalk visible, no mail-app link, fits a phone, linked from the Korean menu."""
  context=page.context.browser.new_context(viewport={'width':320,'height':740});tab=context.new_page();problems=[];tab.on('pageerror',lambda e:problems.append(str(e)))
  assert tab.goto(BASE+'/en/').status==200 and tab.locator('html').get_attribute('lang')=='en' and tab.locator('h1').count()==1
  assert tab.locator('.en-mail').inner_text()=='a8wlhg942@naver.com' and tab.locator('a[href^="https://pf.kakao.com/"]').count()==1 and tab.locator('a[href^="mailto:"]').count()==0
  text=tab.locator('main').inner_text();assert 'KRW' in text and 'We hold no stock' in text and '1 business day' in text
  assert tab.evaluate('document.documentElement.scrollWidth<=innerWidth') and tab.locator('a[href="/tables/"]').count()>=1
  tab.goto(BASE+'/lib/iso-4032');assert tab.locator('nav.top a[href="/en/"]').inner_text()=='English'
  assert not problems,problems
  context.close()
  print('영문 페이지 · lang/연락처/mailto 없음/320 폭/메뉴 연결: PASS')


def check_tables(page, BASE, OUT):
  """Dimension table pages: the index filters, every table states its basis, and a 17-column table scrolls inside its frame without widening the page."""
  browser=page.context.browser;context=browser.new_context(viewport={'width':1280,'height':900});tab=context.new_page();problems=[];tab.on('pageerror',lambda e:problems.append(str(e)))
  wide=lambda:tab.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert tab.goto(BASE+'/tables/').status==200 and tab.locator('h1').inner_text()=='체결부품 규격표'
  assert tab.locator('nav.top a.on').inner_text()=='규격표' and '규격서 원문의 표가 아닙니다' in tab.locator('main').inner_text()
  total=tab.locator('[data-table]').count();assert total>=70 and tab.locator('#table-count').inner_text().startswith(f'{total}개 규격표')
  tab.locator('#table-q').fill('DIN 6921');assert tab.locator('#table-count').inner_text().startswith('1개 규격표') and tab.locator('[data-table]:visible').count()==1
  assert tab.locator('[data-table]:visible').get_attribute('href')=='/tables/hexagon-flange-bolt' and tab.locator('#bolt').is_visible() and not tab.locator('#washer').is_visible()
  tab.locator('#table-q').fill('없는규격표');assert '찾는 규격표가 없으면' in tab.locator('#table-count').inner_text() and tab.locator('[data-table]:visible').count()==0
  tab.locator('#table-q').fill('');assert tab.locator('[data-table]:visible').count()==total
  for width in (320,390,768,1280):
   tab.set_viewport_size({'width':width,'height':800});assert wide(),('tables index',width)
  # The widest table (17 columns): only the frame scrolls, and the size column stays in view.
  tab.goto(BASE+'/tables/cross-recessed-truss-head-screw');frame=tab.locator('.dimt')
  assert '제조·유통사 공개 기술자료 3곳 이상 대조 (규격서 원문 대조 전)' in tab.locator('#basis').inner_text() and tab.locator('.dimt thead th').count()==18
  for width in (320,390,1280):
   tab.set_viewport_size({'width':width,'height':800});assert wide(),('wide table',width)
   assert frame.evaluate('e=>e.scrollWidth>e.clientWidth'),width
   frame.evaluate('e=>e.scrollLeft=400')
   assert frame.evaluate('e=>{const a=e.getBoundingClientRect(),b=e.querySelector("tbody th").getBoundingClientRect();return Math.abs(a.left-b.left)<3&&b.width>20}'),('size column stays',width)
  # A core metric table checked against the publisher's preview, at phone width.
  tab.set_viewport_size({'width':320,'height':800});tab.goto(BASE+'/tables/hex-nut')
  assert '발행 기관 공식 미리보기 대조' in tab.locator('#basis').inner_text() and tab.locator('.dimt tbody tr').count()==12 and wide()
  assert tab.locator('.dimt tbody tr').first.inner_text().split()==['M3','0.5','5.5','2.4'] and tab.locator('a.cta[href="/#list"]').first.is_visible()
  # Ways in: the product guide of the partial-thread bolt points at the shared table, and a table without a record has no page.
  tab.set_viewport_size({'width':1280,'height':900});tab.goto(BASE+'/products/hex-bolt-partial-thread')
  tab.locator('article a[href="/tables/hex-bolt-full-thread"]').click();tab.wait_for_url('**/tables/hex-bolt-full-thread');assert tab.locator('h1').inner_text()=='육각볼트 규격표'
  assert tab.goto(BASE+'/lib/iso-4032').status==200 and tab.locator('aside a.chip[href="/tables/hex-nut"]').count()==1
  assert tab.goto(BASE+'/tables/taper-pin').status==404 and tab.goto(BASE+'/tables/no-such-table').status==404
  assert not problems,problems
  context.close()
  print('규격표 · 모음 찾기/근거 문구/17칸 표 휴대폰 폭/길 연결/없는 표 404: PASS')

def check_count(page, BASE, OUT):
  """Funnel counter: silent under automation by default. Switched on, it sends one name per screen or button, once per page load,
  never anything else; the owner's browser and tracking-refusal signals opt out; totals show on the administrator tab."""
  browser=page.context.browser;KEY='LOCAL_TEST_ONLY_'+'x'*32
  NAMES={'visit','home','list','materials','copy','rfq','kakao','tel','mail','s-view','s-list','s-kakao'}
  UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'   # the Worker ignores a headless user agent
  def session(*scripts):
   context=browser.new_context(viewport={'width':1280,'height':800},user_agent=UA);context.grant_permissions(['clipboard-read','clipboard-write'])
   context.route('https://pf.kakao.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body='<title>channel</title>'))
   for script in scripts:context.add_init_script(script)
   sent=[];context.on('request',lambda r:sent.append((r.method,r.post_data)) if r.url.split('?')[0]==BASE+'/count' else None)
   return context,context.new_page(),sent
  def walk(tab):
   tab.goto(BASE+'/');tab.locator('.bn-tighten').wait_for();tab.locator('[data-go="list"]:visible').first.click();tab.locator('#sales-copy-address').wait_for()
   tab.locator('#sales-copy-address').click();tab.locator('#sales-status').filter(has_text='이메일 주소를 복사').wait_for()
   tab.goto(BASE+'/lib/astm-a193');tab.locator('.bn-strip').wait_for();tab.wait_for_timeout(400)
  def settled(tab,sent,expected):
   for _ in range(40):
    if len(sent)>=len(expected):break
    tab.wait_for_timeout(100)
   tab.wait_for_timeout(300);assert [body for _,body in sent]==expected,sent
  # 1) Automation default (what every other check runs under): nothing is sent.
  context,tab,sent=session();walk(tab);assert sent==[],sent;context.close()
  # 2) Switched on: names only, one per page load, in the order of the visit.
  context,tab,sent=session('window.__bnCountTest=true')
  tab.goto(BASE+'/');tab.locator('.bn-tighten').wait_for();settled(tab,sent,['visit','home'])
  tab.locator('[data-go="list"]:visible').first.click();tab.locator('#sales-copy-address').wait_for();settled(tab,sent,['visit','home','list'])
  for _ in range(2):tab.locator('#sales-copy-address').click();tab.locator('#sales-status').filter(has_text='이메일 주소를 복사').wait_for()
  tab.locator('.sales-example [data-sales-copy="body"]').click();settled(tab,sent,['visit','home','list','copy','rfq'])
  with context.expect_page() as popup:tab.locator('.sales-chat a').click()
  popup.value.close();tab.locator('[data-go="home"]:visible').first.click();tab.locator('.bn-tighten').wait_for()
  settled(tab,sent,['visit','home','list','copy','rfq','kakao'])   # back on the home: already counted in this page load
  tab.goto(BASE+'/lib/astm-a193');tab.locator('.bn-strip').wait_for();settled(tab,sent,['visit','home','list','copy','rfq','kakao','s-view'])
  tab.locator('.bn-strip-btn[href="/#list"]').click();tab.locator('#sales-copy-address').wait_for()
  settled(tab,sent,['visit','home','list','copy','rfq','kakao','s-view','s-list','visit','list'])
  assert all(method=='POST' and body in NAMES for method,body in sent),sent
  context.close()
  # 3) Opt-outs: the owner's switch (set on the administrator tab) and a tracking-refusal signal.
  for refuse in ('try{localStorage.setItem("bn.nocount","1")}catch(e){}','Object.defineProperty(Navigator.prototype,"globalPrivacyControl",{get:()=>true})'):
   context,tab,sent=session('window.__bnCountTest=true',refuse);walk(tab);assert sent==[],(refuse,sent);context.close()
  # 4) Totals: only the administrator reads them, and they match the walk above (nothing else in this run counted).
  assert page.request.get(BASE+'/api/counts').status==401
  totals=page.request.get(BASE+'/api/counts',headers={'Authorization':'Bearer '+KEY}).json()
  today={name:n for day,name,n in totals['rows'] if day==totals['today']}
  assert today=={'visit':2,'home':1,'list':2,'copy':1,'rfq':1,'kakao':1,'s-view':1,'s-list':1},today
  context=browser.new_context(viewport={'width':1280,'height':900});admin=context.new_page();problems=[];admin.on('pageerror',lambda e:problems.append(str(e)))
  admin.goto(BASE+'/admin');admin.get_by_label('관리자 비밀키',exact=True).fill(KEY);admin.get_by_role('button',name='관리자 연결',exact=True).click()
  admin.get_by_role('button',name='문의 집계',exact=True).click();admin.locator('#counts').wait_for()
  read=lambda name:admin.locator(f'#counts [data-count="{name}"]').first.inner_text()
  assert (read('opened'),read('list'),read('contact'),read('copy'),read('kakao'),read('s-view'))==('3','2','2','1','1','1')
  assert '100번 중 66.7번' in admin.locator('#counts').inner_text() and 'probe' not in admin.locator('#counts').inner_text()
  admin.get_by_role('button',name='최근 7일',exact=True).click();assert admin.get_by_role('button',name='최근 7일',exact=True).get_attribute('aria-current')=='true' and read('list')=='2'
  skip=admin.get_by_label('이 브라우저에서 내가 연 것은 세지 않기',exact=True)
  skip.check();assert admin.evaluate('localStorage.getItem("bn.nocount")')=='1'
  admin.reload();admin.get_by_role('button',name='문의 집계',exact=True).click();admin.locator('#counts').wait_for();assert skip.is_checked()
  skip.uncheck();assert admin.evaluate('localStorage.getItem("bn.nocount")') is None
  admin.set_viewport_size({'width':360,'height':740});assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not problems,problems
  context.close()
  print('문의 집계 · 자동화 기본 꺼짐/이름만 한 번씩/세지 않기·추적 거부/관리자 합계: PASS')

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
  assert page.get_by_role('link',name='메일 문안',exact=True).get_attribute('href')=='/admin/mail.html'
  assert page.get_by_role('link',name='수입 원가 계산',exact=True).get_attribute('href')=='/admin/landed.html'
  check_channel(page,BASE,OUT)
  check_mail(page,BASE,OUT)
  check_landed(page,BASE,OUT)
  check_home(page,BASE,OUT)
  check_sales(page,BASE,OUT)
  check_materials(page,BASE,OUT)
  check_phone_bar(page,BASE,OUT)
  check_boot(page,BASE,OUT)
  check_not_found(page,BASE,OUT)
  check_tables(page,BASE,OUT)
  check_english(page,BASE,OUT)
  check_count(page,BASE,OUT)
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
