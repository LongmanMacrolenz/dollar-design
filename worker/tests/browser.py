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
  # 6 stages, 11 templates; account numbers never ship in the templates.
  assert page.locator('.channel-nav [role=tab]').count()==6 and page.locator('.channel-field').count()==11
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
  page.locator('[data-group=receive]').focus();page.keyboard.press('End');assert page.locator('[data-group=follow]').get_attribute('aria-selected')=='true'
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
  assert page.locator('#bn-engineering-details').count()==1 and page.locator('.purchase-trust').count()==0
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  # Headline type: the display face is requested for exactly the characters in use; line one stays thin, line two gains weight as the nut tightens.
  font=page.evaluate('()=>{const l=document.getElementById("bn-home-font"),u=l&&new URL(l.href),need=[...new Set([...document.querySelectorAll(".bn-tighten h1, .bn-tighten-stamp b, .bn-door b, .bn-home .bn-section-head h2, .bn-home .bn-rfq-copy h2")].map(e=>e.textContent).join("").replace(/\\s/g,""))],cs=s=>getComputedStyle(document.querySelector(s)),T=window.__tightenTest;return{host:u&&u.host,family:u&&u.searchParams.get("family"),missing:u?need.filter(c=>!u.searchParams.get("text").includes(c)):need,h1:cs(".bn-tighten h1").fontFamily,thin:cs(".bn-tl.bn-thin").fontVariationSettings,heavy:cs(".bn-tl:not(.bn-thin)").fontVariationSettings,want:T.state().pinned?T.cfg.w0:T.cfg.w1}}')
  assert font['host']=='fonts.googleapis.com' and font['family']=='Hahmlet:wght@100..900' and font['missing']==[],font
  assert font['h1'].startswith('Hahmlet') and font['thin']=='"wght" 200' and font['heavy']==f'"wght" {font["want"]}',font
  # Kinematics of the pure pose function: right-hand thread, one pitch per turn, stop at seat, gap closes only after contact.
  data=page.evaluate('()=>{const T=window.__tightenTest;return{pitch:T.pitch,cfg:T.cfg,rows:Array.from({length:1001},(_,i)=>{const s=T.pose(i/1000);return[s.turns,s.advance,s.gap,s.seated,s.theta,s.contact]})}}')
  pitch,cfg,rows=data['pitch'],data['cfg'],data['rows'];total=cfg['free']+cfg['clamp']
  assert pitch==2 and cfg['size']=='M16'
  previous=-1
  for i,(turns,advance,gap,seated,theta,contact) in enumerate(rows):
   p=i/1000
   assert turns>=previous-1e-12,(p,turns,previous);previous=turns
   assert abs(advance-pitch*turns)<1e-9 and abs(theta-2*math.pi*turns)<1e-9,p
   assert -1e-12<=gap<=pitch*cfg['clamp']+1e-9,(p,gap)
   assert abs(gap-(pitch*cfg['clamp'] if turns<cfg['free'] else pitch*(total-turns)))<1e-9,(p,gap,turns)
   assert contact==(turns>=cfg['free']) and seated==(p>=cfg['p2'])
   if seated:assert turns==total and gap==0,(p,turns,gap)
  assert rows[0][0]==0 and rows[int(cfg['p0']*1000)][0]==0 and rows[-1][0]==total
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
   page.evaluate('scrollTo(0,0)');page.wait_for_function('window.__tightenTest.state().p<0.001',timeout=20000)
   assert page.locator('.bn-tighten').get_attribute('data-seated')=='false'
  # Reduced motion: no scroll pinning, the seated still and the full message.
  page.emulate_media(reduced_motion='reduce');page.reload();page.locator('.bn-tighten.is-static').wait_for()
  assert page.locator('.bn-tighten').get_attribute('data-seated')=='true'
  assert page.evaluate('document.querySelector(".bn-tighten").offsetHeight<=innerHeight*1.2')
  assert page.locator('.bn-tighten-stamp').is_visible() and page.locator('.bn-brand-copy a[data-purchase-event=start]').is_visible()
  # No WebGL: the poster replaces the canvas and nothing throws.
  context=page.context.browser.new_context(viewport={'width':1280,'height':800});other=context.new_page();problems=[];other.on('pageerror',lambda e:problems.append(str(e)))
  other.add_init_script('const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:g.call(this,t,...a)}')
  other.goto(BASE+'/#home');other.locator('.bn-tighten.is-fallback.is-static').wait_for()
  poster=other.locator('.bn-tighten-poster');assert poster.is_visible() and poster.get_attribute('src')=='media/boltnote-tighten-poster.webp'
  other.wait_for_function('document.querySelector(".bn-tighten-poster").naturalWidth===1600')
  assert other.locator('.bn-tighten-canvas').is_hidden() and other.locator('.bn-tighten').get_attribute('data-seated')=='true'
  assert not problems,problems;context.close()
  page.emulate_media(reduced_motion='no-preference')
  print('홈 조임 장면 · 문구/CTA/자세 함수/스크롤 고정/움직임 줄이기/WebGL 대체: PASS')


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
