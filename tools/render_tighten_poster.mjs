#!/usr/bin/env node
/* 홈 조임 장면의 정지 이미지(대체용 포스터)를 만든다 → docs/media/boltnote-tighten-poster.webp
   WebGL을 쓸 수 없는 브라우저에서 app/src/v9_tighten.js가 이 이미지를 보여 준다.
   실제 홈 화면(docs/index.html)을 헤드리스 브라우저로 열어, 조여진 상태(p = 1)의 그림만(글·버튼 없이) 1600×1000으로 찍는다.
   장면(형상·조명·구도)을 바꿨을 때만 다시 돌린다. 사이트 빌드·CI에서는 돌리지 않는다 (다른 미디어 도구와 같다).

   사용:  python3 tools/build_all.py && node tools/render_tighten_poster.mjs
   필요:  npm ci (playwright), npx playwright install chromium, ffmpeg(libwebp) */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'media', 'boltnote-tighten-poster.webp');
const W = 1600, H = 1000;
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bn-tighten-')), 'poster.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.addInitScript(() => { window.__bnTightenFull = true; });   // 소프트웨어 렌더러에서도 해상도를 낮추지 않는다
await page.goto('file://' + path.join(ROOT, 'docs', 'index.html') + '#home');
await page.waitForFunction(() => window.__tightenTest && document.querySelector('.bn-tighten'));
// 머리띠와 글을 숨겨 무대가 화면 전체(1600×1000)를 차지하게 한다
await page.addStyleTag({ content: '.tb, .tb-mini, .bn-top, .bn-reading-progress { display:none !important } .bn-tighten-inner, .bn-tighten-hint, .bn-tighten-note { visibility:hidden !important } .bn-tighten-stage::after { display:none !important }' });
await page.evaluate(() => dispatchEvent(new Event('resize')));
const state = await page.evaluate(async () => {
  const r = document.querySelector('.bn-tighten'), st = r.querySelector('.bn-tighten-stage');
  scrollTo(0, r.offsetTop + r.offsetHeight - st.offsetHeight);
  for (let i = 0; i < 400 && window.__tightenTest.state().p < .9995; i++) await new Promise(q => setTimeout(q, 50));
  await new Promise(q => setTimeout(q, 1500));   // 고정 순간의 빛 연출이 끝난 뒤
  return { ...window.__tightenTest.state(), stage: [st.clientWidth, st.clientHeight] };
});
if (!state.webgl || state.p < .9995) { await browser.close(); console.error('WebGL 장면을 그리지 못했습니다:', JSON.stringify(state)); process.exit(1); }
await page.locator('.bn-tighten-stage').screenshot({ path: tmp });
await browser.close();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, '-c:v', 'libwebp', '-quality', '84', OUT]);
console.log(`wrote ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size.toLocaleString()} bytes) · canvas ${state.size.join('×')} · stage ${state.stage.join('×')}`);
