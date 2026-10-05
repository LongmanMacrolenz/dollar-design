"""End-to-end quotation flow with synthetic data, local storage and no mail password."""
from pathlib import Path
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
import json
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
  form.get_by_label('품목',exact=True).fill('시험용 육각볼트');form.get_by_label('요청 수량',exact=True).fill('10');form.get_by_label('규격·호칭·피치·길이·재질/등급·표면처리',exact=True).fill('시험 사양 M12×1.75×50')
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
  page.get_by_role('button',name='잠금',exact=True).click();page.get_by_role('button',name='관리자 연결',exact=True).wait_for();assert page.evaluate("sessionStorage.getItem('bn-procurement-key')") is None
  assert not errors,errors
  print(json.dumps({'admin_ui':'PASS','website_price_gate':'PASS','markup_20':'PASS','pdf_download':'PASS','mobile_320_1440':'PASS','js_errors':errors},ensure_ascii=False))
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
