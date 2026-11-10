/* 문의 집계 (정적 페이지: 사전·제품). app/src/v9_count.js와 같은 규칙이다: 이름 하나만 보내고, 페이지마다 이름별 한 번,
   자동화 브라우저·추적 거부 신호·「이 브라우저는 세지 않기」(bn.nocount)에서는 보내지 않는다. 이름은 worker/index.mjs COUNT_EVENTS에 있어야 한다.
   site/build_lib.py page()가 SHOP.funnelCount가 켜졌을 때만 주석을 떼고 넣는다. */
(function(){var sent={};
function ok(){try{if(navigator.webdriver&&!window.__bnCountTest)return false;if(navigator.globalPrivacyControl||navigator.doNotTrack==='1')return false;if(localStorage.getItem('bn.nocount')==='1')return false;}catch(e){}return /^https?:$/.test(location.protocol);}
function count(name){if(sent[name]||!ok())return;sent[name]=1;try{if(!navigator.sendBeacon||!navigator.sendBeacon('/count',name))fetch('/count',{method:'POST',body:name,keepalive:true}).catch(function(){});}catch(e){}}
count('s-view');
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(h==='/#list')count('s-list');else if(h.indexOf('https://pf.kakao.com/')===0)count('s-kakao');},true);
})();
