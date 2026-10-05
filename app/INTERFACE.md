# BOM / C&D integration — interface (written by the scaffold step)

이 문서가 쓰던 작업 폴더 경로는 저장소 기준으로 바뀌었습니다: `app/` = 예전 `I`(base.html, build.py, src/), `app/tests/` = 점검 스크립트.

Everything below was checked against `base0.html` (frozen) and `base.html` (identical to base0 when this was written).

---

## 1. Commands (exact)

Replace `out_X` with your track's out dir (section 2). Every script writes **only** into the dir you give it.

```sh
# build (default --base $I/base.html, default --out $I/page.html; parent dirs are created)
python3 $I/build.py --out $I/out_X/page.html
python3 $I/build.py --base $I/base0.html --out $I/out_s/page.html      # scaffold reference build on the frozen base

# base track: check that every anchor build.py needs is still in base.html exactly once (no output file)
python3 $I/build.py --base $I/base.html --check

# engine corpus test: 224 lines (197 original + 27 engine-track regression lines), 100 % on every field, 9/9 tables,
# 104/104 engine unit checks ("units": money, VAT split, pack plans, inchToMm, API 610, tiers, events, banned wording), 0 page errors (exit 0 = pass)
python3 $I/test.py --page $I/out_X/page.html --out $I/out_X/t            # add --fails to list failures, --json name.json (written inside --out)

# hold-out lines (not in the corpus; printed for review, no pass/fail)
python3 $I/holdout.py --page $I/out_X/page.html --out $I/out_X/t

# page check: node --check, page errors, horizontal overflow on every route (light/dark x 1360/400), screenshots
python3 $S/verify.py $I/out_X/page.html $I/out_X/v

# functional test on the verify build (cart remove-once, VAT totals, cutoff display)
python3 $S/func.py file://$I/out_X/v/index.html

# C&D engine test (spec 10.1 invariants incl. negative tamper tests, 10.2 rule regression, 10.3 calculations, C&D outputs, corpus-wide build); exit 1 on any failure
python3 $I/cdtest.py --page $I/out_X/page.html --out $I/out_X/t         # --fails, --verbose, --json name.json (inside --out); writes cd_index.html

# BOM UI regression (15 checks, exit 1 on any failure) and interaction report (prints JSON, no pass/fail)
python3 $I/ui_check.py --page $I/out_X/page.html --out $I/out_X/ui
python3 $I/interact.py --page $I/out_X/page.html --out $I/out_X/ia

# views track's own checks (not shared scripts; they live in its out dir and write only there)
python3 $I/out_v/t/feat.py $I/out_X/page.html     # 41 feature checks: keyboard, queue, undo, bulk, Rev issue/diff, docs, unpriced scan, exports, print guard, search, mobile
python3 $I/out_v/t/perf.py                         # paint timings for 20/100/500-line BOMs (reads out_v/page.html)
```
`ui_check.py` / `interact.py` were moved to the 4A workbench markup by the views track (selectors only, plus one click on the `전체` tab after load, because the workbench opens on the `확인 필요` tab and the checks index rows in BOM order).

Defaults for `test.py`, `holdout.py`, `ui_check.py`, `interact.py`: `--page $I/page.html`, `--out $I/out`.
Files they write: `test_index.html` (test, holdout), `ui_index.html` (ui_check), `ia_index.html` + `b.csv` + `b.xlsx` (interact).
`ui_check.py` / `interact.py` wrap the fragment byte-for-byte like `verify.py` (`test.wrap_verify`), so they no longer depend on a previous verify run.

Scaffold results (build of `base0.html`, `out_s/`): test.py 197/197 (1978/1978 fields, 9/9 tables, 158/158 drawings, exit 0);
verify.py 0 problems on all 27 routes; ui_check 15/15; func.py identical to base0 alone; holdout 24 lines, output identical to the old page.
`interact.py` reported `cart_item_rows: 0` — stale selector `#cart-lines table` (in the new base `#cart-lines` *is* the `<tbody>`). Fixed by the views track (`#cart-lines tr` → 10).

## 2. Out dirs (one per track, never write into another's)

| dir | track |
|---|---|
| `$I/out_s` | scaffold |
| `$I/out_e` | engine (e*.js) |
| `$I/out_c` | C&D (c*.js + its views) |
| `$I/out_v` | views (v*.js, *.css) |
| `$I/out_b` | base (base.html) |
| `$I/out_a` | API 610 (e0_api610.js) |
| `$I/out_f` | final integration |

Suggested sub dirs: `t/` tests, `v/` verify, `ui/` ui_check, `ia/` interact.

## 3. What build.py does

1. **Core hooks** (`CORE_HOOKS` in build.py) are applied to the **base text**. Each anchor must occur exactly once in the base, otherwise build exits non-zero and lists the anchor.
2. **Blocks** are inserted before fixed base anchors, wrapped in markers that build.py adds (never put markers in src/):

| block | content (sorted by file name) | inserted before | why there |
|---|---|---|---|
| `/* ==== BOM CSS START/END ==== */` | `src/*.css` | `/* 32 ─ 동작 줄이기` (inside the base `<style>`) | after all base component + responsive CSS, before reduced-motion |
| `/* ==== BOM ENGINE START/END ==== */` | `src/e*.js`, then `src/c*.js` | `/* ───────── 상태 ───────── */` | data + calc helpers exist; must run before `state` because the cart filter calls `parsePn` (→ `BOM_FAMS`) |
| `/* ==== BOM VIEW START/END ==== */` | `src/v*.js`, then `src/t_*.js` | `/* ───────── 전역 이벤트 ───────── */` | `V`, `sheet/zone/shd`, `state`, `store`, cart and the search `INDEX` exist; init (`go(start)`) has not run yet |

   Each source file is prefixed with `/* ── name ── */`.
3. **Module hooks**: every `src/*.hooks.json` (sorted) is applied to the spliced page (so it may target base text **or** text inside the blocks).
4. Each marker must occur exactly once; prints the output size.

The whole `<script>` is one IIFE (`'use strict'`). All src files share that single scope with the base:
**a top-level name that the base already declares is a SyntaxError** (`node --check` in verify.py catches it).
Already renamed for that reason: engine `fmtIn` → `bomFmtIn`, engine `shaft()` → `bdShaft()`, quote `ymd` → `qYmd`.
Prefix new top-level names (`bom…`, `bd…`, `cd…`, `q…`).

## 4. Base anchors (base track: keep these byte-identical)

Shown as JSON strings (`\n` = newline). Each must occur exactly once in base.html. `python3 $I/build.py --check` verifies all 18.

```
block CSS     "/* 32 ─ 동작 줄이기"
block ENGINE  "/* ───────── 상태 ───────── */"
block VIEW    "/* ───────── 전역 이벤트 ───────── */"
parsePn       "  const f = METRIC.find(m => m.code === parts[0]);\n"
variantInfo   "function variantInfo(f, size, L, g, fin, qty = 100) {\n"
SHEETS        "function normRoute(r) {\n"
setNav key    "  const key = r.startsWith('m-') ? 'metric' : r.startsWith('i-') ? 'inch' : r;\n"
setNav no     "  let [no, nm] = SHEETS[key] || SHEETS.home;\n"
setNav total  "  $('sheet-no').textContent = `${no} / 7`;\n"
shd total     "<span class=\"sheetno\">장 ${no} / 7</span>"
header total  "<b id=\"sheet-no\">1 / 7</b>"
go() map      "cart: V.cart, help: V.help }[name] || V.home;"
#nav link     "<i>4</i><span>주문제작<span class=\"lg\">·해외규격 견적</span></span></a>\n"
home route    "<nav class=\"tb-route za-route\" aria-label=\"주문 방법\">"
home route+   "<b>도면·사양서 보내기 <i>4장</i></b><span>주문제작·해외규격</span></a>\n"
home zone B   "zone('A', 'z-a', homeA()) + zone('B', 'z-b', zoneB())"
search INDEX  " ['주문제작·해외규격 견적', '도면·사양서 첨부', '주문제작 견적 도면 특수 비규격', 'custom'],\n"
footer        "<li><a href=\"#custom\" data-go=\"custom\">주문제작·해외규격 견적</a></li>"
```

**Module-hook anchor on base text (engine track, `src/e0_inch.hooks.json`)** — not covered by `--check`; the build fails with the file name if it changes:
the whole base `inchToMm` function, i.e. the 5 lines starting `const inchToMm = s => { // "1-1/4" → 31.75` and ending `};`.
The hook replaces it with `const inchToMm = s => inVal(s) * 25.4;` (engine parser: the old regex read `15/16` as 1-5/16, and could not read `.750`, `1.1/8`, `3/4"`, `1½`).
If the base track rewrites `inchToMm` itself, delete the hook file or tell the engine track; do not keep two parsers.

**Module-hook anchors on base text (views track, `src/v1_search.hooks.json`)** — not covered by `--check`; the build fails with the file name if they change. Both are in the header search (`search()` / `initSearch()`):
`  if (pn) res.push({ t: first, s: \`${pn.f.short} · 형번\`, go: 'm-' + pn.f.id, preset: first, g: '형번' });` and `    if (it.preset) applyPreset(it.preset);\n`.
Effect: a BOM catalog part number (IHCS-…, ISSC-…; no family sheet) is offered as `형번 → 견적함에 1포장 담기 (7장)` and, when picked, goes into the cart with one pack (`bomPnToCart`). METRIC part numbers keep going to their family sheet. Both anchors exist once in base0.html and in the current base.html.

Also keep (not anchors, but the modules call them): the base names in section 7, `SHEETS` as a mutable object literal, `V` / `V.after`, the `go()` → `V.after[name](arg)` contract, and `#cart-lines`, `#totals`, `.cart-n`, `#cutoff`, `[data-go]`, `[data-rm]`, `[data-add]` used by func.py / ui_check.py.

## 5. What the core hooks do

| hook | effect |
|---|---|
| parsePn | `METRIC.find(...) \|\| BOM_FAMS.find(...)` — BOM catalog part numbers (ISSC-…, IHCS-…, SSC-…) are valid cart items |
| variantInfo | `if (f.vi) return f.vi(size, L, g, fin, qty)` — BOM families price/ship themselves (`famVi` in e2_cat.js) |
| SHEETS | before `normRoute`: `const SHEET_TOTAL = 8; Object.assign(SHEETS, { bom: ["4A","BOM 견적"], quote: ["4A-1","BOM 견적서"] }); const SHEET_PARENT = { quote: "bom" };` |
| setNav key / no | nav highlight = `SHEET_PARENT[r] \|\| r`; number/name = `SHEETS[r] \|\| SHEETS[key]` (sub-sheets show their own number) |
| setNav / shd / header total | `/ 7` → `/ ${SHEET_TOTAL}` (header static markup gets the number from build.py) |
| go() map | adds `bom: V.bom, quote: V.quote`, then falls back to `(Object.hasOwn(SHEETS, name) && Object.hasOwn(V, name) && V[name])` — any registered sheet routes to `V[name]`; inherited names (`#constructor`, `#__proto__`, `#toString`) never match (finalize-2; base `normRoute` also uses `Object.hasOwn(SHEETS, r)`) |
| #nav | `<a href="#bom" data-go="bom"><i>4A</i><span>BOM<span class="lg"> 붙여넣기</span> 견적</span></a>` after sheet 4 |
| home route | `za-route` gets class `r4` + a 4th cell “BOM 붙여넣기 견적 · 4A장” (CSS for `.r4` is in bom.css) |
| home zone B | `zoneB() + bomHomeEntry()` (entry block, defined in v1_bom.js) |
| search INDEX | entry “BOM 붙여넣기 견적” → `bom` (group 도구·안내) |
| footer | “BOM 붙여넣기 견적” link in 쇼핑 |

## 6. Sheet numbers (drawing-set scheme)

- One source: `SHEET_TOTAL` in build.py (→ JS `const SHEET_TOTAL`, and the static header `1 / 8`). Everything that prints “장 n / N” uses it: header `#sheet-no` (setNav), sheet head crumbs (`shd`), first paint.
- Existing sheets keep their numbers 1–7, so every “→ 2장”, “4장”, “7장 →” reference in the base copy stays true.
- The BOM workbench is an **inserted sheet `4A`** (placed after 4 주문제작·해외규격 견적, the other quotation sheet) — how a drawing set adds a sheet after issue without renumbering.
- Sub-sheets do not count toward the total (same as the base: 2-1…2-8, 3-1…3-10). BOM sub-sheets: `4A-1` (`#quote`). v2_wb.js renames it at load to `SHEETS.quote = ['4A-1', '견적서·C&D 문서']` because the route now holds all six documents (quotation, C&D sheet, compliance summary, not-available list, drawing pack, revision diff) as tabs `4A-1.1`…`4A-1.6` — no extra routes, so verify.py's route list is unchanged. Next free: `4A-2`, `4A-3`.
- Count = 1, 2, 3, 4, 4A, 5, 6, 7 → **8**. Only a new top-level sheet changes it (edit `SHEET_TOTAL` in build.py; lead decides).

## 7. Globals

**Engine (`e*.js`) needs from the base** (found with the TypeScript checker, not by grep):
`DIM, METRIC, GRADE, FINISH, TIERS, FREE_SHIP, SHIP_FEE, STEEL, dnum, esc, won, pnOf, variantInfo, weightG, shipDate`, and the stock switch `OWN_STOCK` (§14).
The cutoff constant is `CUTOFF` in the base (KST hour, `OWN_STOCK ? 14 : 12` — §14; `CUT_T` = `'HH:00'`). It is the **only** cutoff: the engine reads it directly (`m.leadText` “오늘 출고 (평일 ${CUTOFF}시까지 발주 확정 시)” — own stock only, `m.lead.cutoff` = `CUT_T`, `m.lead.text`) and through `shipDate()` (which also skips `HOLIDAYS`). The engine has no cutoff literal (test.py checks this), and since task 2 the base has none either: the strip `#cutoff`, the 1장 title block, the footer (`[data-sc="hours"]`), 1장 G and 6장 A all print `CUTOFF`/`CUT_T`.
The engine **extends** base data at load: `Object.assign(GRADE, {...})` (inch/set-screw grades) and adds `FINISH.ZY/HI/PO` as **non-enumerable** (so the home finish legend `plgHTML`, which iterates `FINISH`, still shows only the metric codes). Every added FINISH has `label, short, name, note, mult, lead`; every `BOM_FAMS` family has `short` (the cart row, recent list and search read `p.f.short`, `FINISH[fin].short`, `GRADE[g].label`).

**Views (`v*.js`) additionally use**: `V, V.after, state, store, saveCart, toast, view, parsePn, kstNow, sheet, zone, shd, SHEETS`.
Page helpers available for new views: `$()` (getElementById), `esc, won, note(tone, html, nk), noteSm, sheet(zones), zone(letter, id, inner), zh(letter, id, title, sub, xref), shd({trail, no, title, p, right, below}), xref, zref, ball, nwText, tagShip, shipHTML, phone(), reduced(), jumpTo(id), go(route)`.
`note()` returns `<div class="note tone"><span class="nk">…</span><span>text</span></div>` — tones `info | warn | crit | ok`; the text argument is HTML (escape it yourself).

**Engine top-level names other modules may call**: `SHOP_TERMS` (quote terms, VAT 0.1, validity 14 days), `BOM_FAMS`, `BOM_ROLES`, `BOM_MULTI`, `bomRows`, `parseCore`, `bomDerive`, `bomMatch`, `bomLine`, `parseQty`, `specLine(q)`, `threadTxt(q)`, `drawingFor`, `inVal`, `inFrac`,
`API610`, `API610_ALIASES`, `parseApi610`, `api610Row`, `api610EdKo` (e0_api610.js, engine track),
`wonKo`, `wonKoDoc`, `wonKoNum`, `wonKoOk`, `BOM_VAT`, `bomVatTotal`, `bomVatSplit`, `bomTotals` (e1m_money.js),
`BOM_TIER`, `LEAD_DAYS`, `bomTierOf`, `bomOrderLead`, `bomPackBest`, `bomPackCatalog` (e7s_supply.js), `bomEv` (e1_data.js). Details in 8.1–8.7.
**C&D top-level names** (c1_cd.js, c2_cdbuild.js; all prefixed `cd`/`CD_`): `cdBuild`, `cdItems`, `cdCtxOf`, `cdRfqCtx`, `cdSectionOf`, `cdUnpriced`, `cdSnapshot`, `cdMatchLines`, `cdQuoteDiff`, `cdSaveRev`, `cdLoadRevs`, `cdLastRev`, `cdCheck`, `cdImpactText`, `cdSpecEn`, `cdDocPlan`, `cdDrawing`, `cdB165`, `cdShipDate`, `cdAddBD`, `cdNow`, `CD_RULES`, `CD_RULE`, `CD_GC_T`, `CD_GC_C`, `CD_COLS`, `CD_TYPE`, `CD_CAT`, `CD_ACT`, `CD_STATUS`, `CD_COMP`, `CD_DOC`, `CD_B165`. Details in 8.8.
**View top-level names** (v1_bom.js state/compute/actions, v2_wb.js 4A workbench, v3_quote.js 4A-1 documents, v4_out.js exports/issue/home entry; prefixes `bom` `wb` `qd`, upper-case `BOM_`/`WB_`/`QD_`): see 8.9. `V.bom`, `V.after.bom`, `V.quote`, `V.after.quote`; state in `state.bom` (8.9), saved with `store.set('bom', …)` (localStorage key `bn.bom`). Names other modules use: `state.bom.{text, sample, map}`, `bomSave()`, `bomCompute()`, `bomHomeEntry()` (core hook), `loadXLSX()`, `bomQuoteNo()`, `qYmd()`, `BOM_SAMPLE`.

## 8. Engine API

```
bomRows(text, roles?)  → { rows, cols, sample, roles, mode: 'tsv'|'csv'|'text'|'empty', delim, header }
    row = { i, no, pn, text, qty: string|null, unit, src, filled: 'No'|null }   (filled = merged-cell row that inherited the line above)
    roles: per column one of BOM_ROLES keys '', no, pn, type, desc, size, len, qty, unit, mat, fin ('desc' and 'pn' may repeat)
bomLine(row, ov = {})  → { row, q, m }        ov = user overrides {type, size, length, qty, mat, fin, point}
    = parseCore(row.text, {type: ov.type, size: ov.size})   // only what the text says
      → bomDerive(core, ov)                                  // defaults, derived values, questions → q
      → q.qty = parseQty(ov.qty ?? row.qty)
      → bomMatch(q, q.qty)                                   // catalog match, status, price, lead time → m
drawingFor({q, m}, {thumb?})  → SVG string | null   (null for not-available, variants, unknown size/type)
```

**q** (what the line says, normalised): `raw, text, partNo, type, typeLabel, sub{}, system 'metric'|'inch', size{v, label, unit 'mm'|'in', raw}|null, pitch, tpi, series 'UNC'|'UNF'|'8UN'|'coarse'|'fine'|…, pitchLabel, hand, tolClass ('6g' '6H' '5g6g' '2A' '3A' '2B' …), tolLabel, lengthMm, lengthIn, lengthLabel, point, drive{kind 'hex'|'socket', v, unit, label}, dimStd, stds[], mat{code, label, stated, alloy}, fin{code, label, stated}, finDefault, variant{k, label, std, na, from}|null, nonfast, pipeThread, special[], noSpec, assumptions[], questions[], conf{type, thread, size, length, mat, fin, point: 0–1}, edited[], qty{n, unit, raw, issue?}`.
`q.type` ∈ `hexbolt heavyhexbolt bolt capscrew shcs fhcs bhcs setscrew machinescrew stud rod anchor nut heavynut washer lockwasher insert clinch expanchor rivet pin key ring discspring oring gasket pipe valve tool nonfast unknown`.

**m** (our answer): `status` ∈ **`'catalog'`** (바로 공급, has pn/price) | **`'engineer-quote'`** (엔지니어 견적, reasons say why) | **`'not-available'`** (공급 불가, reasons say why);
`reasons[{tone 'warn'|'crit', text, kind?: 'assume'|'addon'|'rodlen'|'other', lead?}], qty (int, ≥0), unit 'EA'|'SET', qtyStated, qtyRaw, qtyWarn|null, qtyNote, fam (family id)|null, family, pn|null, price (unit price, VAT excluded, example)|null, amount|null, stock, ship{label '10/2(금)', today}|null, leadDays, leadText, delivery, diffs[], alt{pn, price, label, exact, stock, ship}|null, indicative, weightKg, spec, tier{qty, price, amount, text}|null, grade, finCode, sz, L, unreadable`.
Totals: views compute `sub = Σ amount (catalog)`, `ship = sub ≥ FREE_SHIP ? 0 : SHIP_FEE`, `vat = round((sub + ship) × SHOP_TERMS.vat)`, `total = sub + ship + vat` — the same formula as the base cart, so BOM summary, quote and cart agree (sample BOM: 354,860 + 0 + 35,486 = 390,346원).

**`window.__bomTest`** (tests only, set at load by e9_rows.js):
`parse(raw, qty, row?) → {q, m}` · `match(q) → m` · `rows(text, roles?) → bomRows result` · `qty(s) → parseQty` · `draw(raw, qty) → SVG|null`. All results are JSON-cloned.

### 8.1 Engine track step 1: new fields (added only; every existing name and meaning is unchanged)

```
bomLine(row, ov = {}, ctx = {})      ctx = { api610: parseApi610(RFQ header text) }  (optional; a line's own API 610 text wins)
q.ev        events from parsing + defaults (also copied into m.ev)            q.api610   parseApi610 result for the line (or header, from: 'header') | null
q.mat.cls / q.mat.clsDefault   ISO 3506 class default (see below)           q.mat.api610 / q.mat.api610Note   material taken from an API 610 class
m.ev        ALL events of the line (q.ev first, then match events)          m.lead     supply tier object (8.3)      m.tierCode  = m.lead.code | null
m.packPlan  pack combination (8.4) | null                                     m.tier     UNCHANGED: price-break hint { qty, price, amount, text } (rule K-TIER)
m.leadDays  now = shipDate business days incl. coating lead for stock items too (was 0 for stock + HDG); always equals m.lead.dispatch[1] on catalog lines
```
Naming note: the step-1 task asked for the supply tier under `m.tier`, but `m.tier` is the existing price-break hint read by `v1_bom.js` (lines 33/86/123), `v3_quote.js` (21/83) and `ui_check.py` (`tier_hint`). To avoid breaking them the supply tier is `m.lead` + `m.tierCode` (the BOM/C&D spec §6.2 names). The lead may rename at integration.

Parser fixes (a): `inVal` reads `15/16`, `1-1/8`, `7/16`, `11/16`, `1 3/8`, `3/4"`, `.750`, `1.1/8` (dot as mixed-number separator, binary proper fractions only), `1½`, `1-1/2 in`.
Thread/length parsers read `1 3/8-6 UNC` as 1-3/8 (only if the TPI is that size's UNC/UNF/8UN or a series is written; `2 3/8-16 UNC` stays 3/8-16), `2 1/2 LG`, `F436 1 1/2"`, `1½-8UN`. `1.1/8` in a line is rewritten to `1-1/8` with an A-NORM note (not on lines that mention EN 10204/CERT/MTC/MILL).
Thin nuts (e): `3종`·`3種`·`얇은`·`박형`·`THIN NUT` set special `JAM` → ISO 4035, engineer quote (never swapped for ISO 4032). ISO 3506 class (e): metric A2/A4 with no class gets `70` (bolts, screws, studs, rods, nuts) or `21H` (set screws), label `A2-70 (…)`, assumption string + event `A-SS-CLASS`.

### 8.2 Structured events (`m.ev`, rule IDs from BOM/C&D spec §5 and the §5.9 migration table)

Shape `{ rule: 'A-THD-PITCH', ...params }` (flat). Every place that pushes an assumption, question or warn/crit reason string also pushes an event; the strings are kept. An event identical in rule **and** params is stored once per line (so a default that produces both an assumption and a question is one event). Consumers group by `rule`.

| where | rules (params) |
|---|---|
| parseCore notes | `A-NORM {from,to}` (SCHS, number size 10-32, UCN/NC/NF, `1.1/8`), `A-NUT-STYLE {from,to}`, `A-LEN-CONV {mm,in}` |
| bomDerive | `A-THD-PITCH {size,pitch}`, `A-THD-TPI {size,tpi,series}`, `A-TOL-M {tol}` / `A-TOL-IN {tol}` (default class; no string, for GC-T03), `A-TOL-WRONG {stated,to}`, `A-LEN-ROD {len}`, `A-NUT-INCL`, `S-STUD-LEN-GA`, `A-GRADE {mat}` (`mat: null` = “재질 확인” question), `A-MATSPEC {mat}`, `A-NUT-GRADE {mat,nut}`, `A-SS-ALLOY {alloy,code}`, `A-SS-CLASS {code,cls}`, `A-FIN {fin}`, `A-POINT {point}`, `A-VARIANT {variant,label,std}`, `N-UNREAD {why:'size'}`, `A-LEN-NONE`, `S-KS-3JONG {size}`, `S-KS-1JONG {size}` |
| stdOf | `A-HB-THREAD {size,len}`, `A-DIN-ISO {din,iso,size[,head]}`, `S-DIN-WAF {din,iso,size,wafDin,wafIso}`, `S-DIN934-H {size,m}` |
| API 610 (bomDerive) | `S-API610-ED {cls,edition:null,mat,nut}`, `S-API610-MAT {cls,edition,mat,nut}`, `S-API610-PART`, `S-API610-GRADE`, `S-API610-THD {series}`, `S-API610-MIN {size}`, `S-NACE-EXP`, `S-API610-CHK` (other class question) |
| bomMatch | `N-NA {why}` / `N-UNREAD {why}` (why = type key, `variant:k`, NAS, MS, AN, aero, TI, micro, big, partno, nospec, empty, unknown), `A-VARIANT`, `X-NACE-HARD {mat}`, `S-NACE-EXP` / `S-B7M {mat}`, `Q-IMPACT {mat}`, `S-B8-CL1` / `S-B8-CL2` / `S-B8-CL2-OVER {mat,size}`, `S-A307`, `S-F3125`, `S-F1554`, `Q-31-FWD`, `Q-PMI`, `K-MOQ {proc}`, `S-CD`, `S-PTFE`, `Q-COAT {fin}`, `S-HE-BAKE {mat,fin}`, `S-FINE {size,pitch}`, `S-HDG-109` / `S-HDG-HS {mat}`, `S-CAT-ALT {diff}` / `{why:'rodlen',len}`, `A-HEAD {why:'head'|'type'}`, `X-API610-NOAUTO {cls,edition,why}`, `A-FIN-CAT {fin}`, `K-TIER {n,amt}`, `K-PACK {qb,qq,over}`, `K-QTY {issue,raw,qty}`, `K-FREIGHT {why:'long'|'heavy',kg}`, `K-NONRET {tier,days}` |
| bomLine | `A-MERGE {from}` (merged-cell row) |

Engine-defined IDs (not rows in spec §5; give them a template or treat as engineer-quote notes): `K-EQ {why:'mill'|'lot'|'make'|'sec'|'size'|'item'|'matspec', mat?|item?|size?}` (engineer-quote reasons with no spec rule: B16, F468, A354/A449, unknown ASTM spec, jam/nyloc, LH, drilled head, knurled cup, inch rod, metric/tap-end stud, heavy hex bolt, metric button head, machine screw, oversize, non-catalog family), `A-SS-CLASS`, `S-API610-MAT`, `S-API610-PART`, `S-API610-GRADE`, `S-API610-CHK`.

### 8.3 Supply tier `m.lead` (supply.json leadTimeRules / sourcingMatrix; `BOM_TIER` in e7s_supply.js)

`m.lead = { code, label, dispatch:[min,max]|null, toCustomer:[min,max]|null, cutoff:CUT_T|null, returnable:true|false|null, requiresQuote, validityDays|null, shipDate|null, basis, example, text }` — business days (Korean calendar), `null` for not-available lines.
- label ∈ 자체 재고 (OWN_STOCK) · 협력사 재고 (PARTNER_STOCK) · 협력사 수배 (MRO_BACKUP, catalog lines only; finalize-2 §16) · 국내 제작 (DOMESTIC_MFG) · 해외 수입 (IMPORT_US, IMPORT_US_MFG, IMPORT_VIA_KR_MRO) · 견적 문의 (NO_SOURCE).
- catalog lines: example stock flag → OWN_STOCK **only when the page switch `OWN_STOCK` is true** (§14; otherwise `m.stock` is false and the flag only drops the inch sourcing days, `v.listed`); else lead ≤ 2 days → PARTNER_STOCK, longer (coating, inch lead) → MRO_BACKUP. `dispatch[1] = m.leadDays` (same as the shown ship date), `cutoff` = page `CUTOFF`, `example: true` (stock is example data; no stock counts are invented).
- engineer-quote lines, by the reasons' `lead` hints: make/mill → DOMESTIC_MFG; inch lot/cert → IMPORT_US; metric lot, coat, plate, sec, cert → DOMESTIC_MFG; only `check` → NO_SOURCE (견적 문의, ranges null). A line whose catalog item is exact (`m.alt.exact`) and only needs confirmation/extra process keeps that item's tier with `requiresQuote: true` and the process days added. Ranges come from `LEAD_DAYS` (= the `LEAD_HINT` texts, 1 week = 5 days) so they agree with `m.leadText`.
- `bomOrderLead(items, onlyCatalog = true)` → `{ toCustomerMax, line, code }` (order lead = max of line upper bounds).

### 8.4 Pack plan `m.packPlan` (spec §3.3)

`{ need, packs:[{ size, count, price }], ordered, over, unit, amount, uom, packCount, base, combo, note }` — `price` per pack, `unit` = effective price per piece (amount/ordered, rounded), `base` = amount for exactly `need` (catalog only).
Cheapest combination covering `need`; overage allowed; ties → fewer packs, then less overage. Set on catalog lines (`qty > 0`): pack = the family's standard pack, loose pieces allowed, price per piece from the catalog tiers (`TIERS`). **`m.qty` and `m.amount` stay the BOM quantity**; the plan is advice (event `K-PACK` when `over > 0`). General form for partner/import pack prices: `bomPackBest(need, [{size, price}], breaks?, uom?)` (DP; `breaks = [[minPieces, mult]]` on total pieces; need > 20000 pre-fills with the cheapest pack per piece).

### 8.5 Money (spec §3.5; e1m_money.js)

- `wonKo(129800)` → `'일십이만구천팔백원'` (일십·일백·일천 written out, `0` → `'영원'`); `wonKoDoc(n, pre = '금')` → `'금 일십이만구천팔백원정 (₩129,800)'` (`pre: '일금'` for the public form); `wonKoNum(s)` reads it back; `wonKoOk(n)` self-check.
- **VAT decision (spec §12 #9): `BOM_VAT.method = 'total-round'`** — VAT = `Math.round((sub + ship) × 0.1)` once on the total, exactly the cart's formula, so BOM summary, quote and payment agree to the won. Line VAT (for forms with a 세액 column) = that total allocated pro rata, remainders to the largest fractions (`bomVatSplit`), so line VAT always sums to the total. `BOM_VAT.gc` = `{ id: 'GC-C01', ko, en }` note for the C&D sheet. Switching to per-line truncation needs the cart formula changed in the same commit.
- `bomTotals(items)` → `{ sub, ship, supply, vat, total, lines:[{ no, supply, vat }], shipVat, words, doc, wordsOk, method }` (catalog lines only; same `sub/ship/vat/total` as the views' `bomSummary`). Views: print `doc` and show an error if `!wordsOk`.

### 8.6 API 610 (e0_api610.js)

- Data wording: the 8th-edition values are “8판: 원문 미대조 (업계 일반 관행)”; values unchanged. Renamed keys: `editions['8th'].status: 'practice'` (was `'matrix'`), `notListed` (was `notInMatrix`).
- `parseApi610(text)` → `null` without an `API 610`/`ISO 13709` context, else `{ std, raw, cls, suffix, edition|null, editionSource: 'number'|'word'|'year'|'iso'|'iso-ambiguous'|'conflict'|null, editionNote, part: 'stud'|'nut'|'wetted'|'unspecified', service: 'general'|'sour'|'lowTemp'|'sourLowTemp'|'hf', mdmtC, status: 'mapped'|'confirm'|'engineer-quote'|'context', why, bolting: { stud, nut, wetted, assumed, basis }, perEdition: [{ ed, state, stud, nut, wetted }], explicit[], questions[], caveats[], reference? }`.
  Reads `API 610 C-6`, `API610 12th S-6`, `Class S-5 per API 610 11th`, `API 610-2010`, `11판`, `Eleventh`, `ISO 13709:2009`. **No edition → `edition: null`, never assumed**: bolting is filled only when the 11th and 12th editions agree (`assumed: true`, `basis: '11th=12th'`) with an edition question; otherwise engineer-quote. 9th/10th/13th, classes removed in the 12th, conflicting editions, ISO 13709:2003, Ni-Cu (no ASTM), low-temperature/HF service → `status: 'engineer-quote'` (`bolting` emptied, table values in `reference`).
- Engine use: an inch/metric stud or nut with no stated grade takes B7 / 2H from the class (`q.mat.api610`), with the assumption string; a stated grade wins and a mismatch is asked (`S-API610-GRADE`). `X-API610-NOAUTO` makes the line engineer-quote.

### 8.7 `window.__bomTest` additions

`parse(raw, qty, row?, ctx?)`, `inch(s)`, `inchToMm(s)` (page function), `api610(text)`, `pack(need, packs, breaks?, uom?)`, `packCat(need, pk, [[minQty, unitPrice]…], uom?)`, `wonKo`, `wonKoDoc`, `wonKoNum`, `wonKoOk`, `vatSplit(amounts, vat)`, `totals([[raw, qty]…])`, `terms()` → `{ CUTOFF, OWN_STOCK, BOM_VAT, BOM_TIER }`.

### 8.8 C&D engine (engine track step 2; `src/c1_cd.js` rules/data, `src/c2_cdbuild.js` build/revision/checks)

No e*.js file was changed for C&D. Rules fire from `m.ev` events **or** from predicates on `q`/`m`/context (spec 6.3 allows both), so events the engine does not emit (S-A194-GR4, S-A320-L7-SIZE, S-L7-NUT, S-A490-ZN, S-HDG-M8, S-ZN-ASTM, S-SOCKET-PLATE, X-NACE-ZN, X-LOWSTR, X-MDMT, X-REFDOC, …) needed no engine edit.

**Entry points**
```
cdItems(text, rfq?, ovOf?)  → items   // bomRows + bomLine, with section-title rows ('PUMP P-101A (API 610 S-6)', '4" CL300': no qty, no fastener word, a context found)
                                       // turned into { row, section: true, sec } and their context (sec) attached to the following items; API 610 context passed to bomLine (line > section > RFQ)
cdBuild(items, rfq = {}, prev = null) → doc      // items = bomLine results (views: bomCompute().items work as is); prev = a snapshot of the previous Rev (cdSnapshot)
cdUnpriced(doc) → unpriced technical copy (8.9)  · cdSnapshot(doc) → QuoteRevision (6.5)  · cdQuoteDiff(prevSnap, nextSnap) → QuoteDiff  · cdMatchLines(prevLines, nextLines)
cdCheck(doc, { items, prev, rfq }) → [{ no 1–12, name, ok, detail }]   // spec 10.1 invariants; run before publishing
cdSaveRev(snap) → { ok } | { ok:false, why:'exists'|'storage' } (localStorage 'bn.cd.revs', try/catch, never overwrites an issued Rev) · cdLoadRevs(quoteNo) · cdLastRev(quoteNo)
```
**rfq** (all optional; spec 6.5 shape): `quoteNo` (views pass `bomQuoteNo(...)`; default BQ-YYMMDD-hash4 from the BOM text), `rev`, `date` ('YYYY-MM-DD[THH:MM]' KST wall clock; default `kstNow()`), `project`, `client`, `clientRef { rfqNo, rev, bomFile }`, `basis [{ doc, rev, received, date }]`, `context { api610 ('API 610 S-6' text or parseApi610 object), nace ('MR0175'|'MR0103'|true), exposure ('exposed'|'non-exposed'), mdmtC, designTempC, flange ('B16.5 CL 300' text or {std,cls,nps}), docs ['3.1','2.2','3.2','KOLAS','PMI','origin','3.1-self'], requiredDate, tensioner, vdrl }`, `contextText` (RFQ body text, read with `cdCtxOf`), `submission { unpriced, splitTechComm }`, `commercial { requiredValidityDays, paymentTerms, ld, warrantyMonths, bondRequired }`, `avl { makers[], excludedOrigins[], originProof }`, `offerType 'indicative'|'firm'`, `review { ok: true, by, at, checkedBy? }` (**operator review flag; firm needs it**), `decisions { [row key]: { status, by, at, reply } }` (customer replies / workbench acceptance), `excluded [lineKey | BOM No]` (customer-excluded lines → N-EXCL), `revNote`, `preparedBy`, `roles` (column roles for cdItems).

**doc** = `{ version 'cd-rules 1.0', quoteNo, rev, issuedAt, validUntil, offerType, watermark {ko,en}|null, seal {by,at}|null, firmRequested, firmBlocked [{ko,en}], header (4.2), statement { kind 'indicative'|'deviation'(가)|'nil'(나), ko, en, summary {ko,en}, counts }, cols (10 headers {ko,en}), rows [CdRow], gc { technical [GC-T…], commercial [GC-C…] }, technical { rows: [no], gc: [id] }, commercial { rows, gc }, lines [line], compliance (3.11), notAvailable (3.10), queue { conflict, unread, ambiguous, dev, qty, na: [row no] }, unresolvedX [row no], totals (bomTotals + wordsDoc '일금 …원정 (₩…)' + reference {supplyMin, supplyMax, noRef}), skipped [section rows], revision { rev, prev, history [{rev,date,desc,by,chk}] }, ctx }`.
- `doc.lines[i]` is the i-th non-section item: `{ lineKey ('fnv8#n', inherited from the previous Rev when matched), ref (BOM No), pn, raw, qtyRaw, status catalog|engineer-quote|not-available|excluded, compliance C|CC|D|E|N, ourPn, spec {ko,en}, specKey, qty, unit, unitPrice, amount, vat, make, origin, makeText, lead {code,label,text,dispatch,toCustomer,returnable,validityDays,shipDate}, replyBy (SLA 2.10: 1–20 EQ lines 1 BD, 21–100 3 BD, 101+ 5 BD; import/coating/3.2 4–5 BD or null = agreed date), delivery, pack, indicative, reasons, docPlan { plan [{code, by, incl, option, onRequest?, addDays, note}], text {ko,en} }, drawing { no '{quoteNo}-D{BOM No}', has, std, forApproval, subjectToMfr, note } | null, cd [row no], ctx }`.
- **CdRow** (6.4): `{ no 'C-001'|'D-001'|'E-001', type, seq, key 'RULE|group' (stable across Revs), ruleId, cat MAT|DIM|THD|CTG|DOC|MRK|PKG|COM|DLV, action APPROVE|CONFIRM|INFO, queue, auto, basis, scope line|bom|rfq, lines [{key, ref, pn}], lineRefText ('3, 7, 12–19' | '전체 / All' | RFQ doc ref), required (as written) + requiredEn, requiredMore, offered {ko,en}, reason {ko,en}, refs [clause refs only], refTag, params, impact { kind none|tbd|cow|cowtbd|excluded|option, amountDelta, leadDeltaDays, docs, replyBy, text {ko,en}, textUnpriced {ko,en} }, status (4.5 codes), statusAt, customerReply, repliedBy, closedAt, history, firstRev, lastRev, withdrawn, cells [10 × {ko,en}], cellsTech [10 × {ko,en}] }`. `cells` are exactly the 10 columns of 4.4 (No · Line Ref · Requirement · Offered · Type · Category · Reason & Ref · Impact (4.6: 가격 · 납기 · 서류) · Customer Action ☐ · Status). Rows are sorted D → E → C, then number. Rows that disappear in a later Rev stay as `WITHDRAWN` with their number.
- **Compliance code** (3.11 order): E (not-available, excluded, or an E row) → N (engineer quote not priced, or an unresolved X row of type C/D) → D → CC (a C row) → C (GC only / nothing).
- **Indicative vs firm**: `offerType: 'firm'` is honoured only with `review { ok: true, by, at }` and no unresolved X (C/D) rows; otherwise the doc is issued as indicative with `firmBlocked` reasons. Firm adds N-NOTQ E rows ('미견적 Not quoted' + reply date) for every engineer-quote line, Q-MAKE, GC-T14, PACKLIST, statement (가)/(나) and `seal`. Indicative: watermark '자동 견적 · 운영자 검토 전 / Indicative – not reviewed', no seal, no compliance statement.
- **Unpriced copy** (8.9): technical rows + GC-T only, lines with `quoted` 견적함/미견적, impact 'Price impact – see priced offer' / 'No price impact', no amounts anywhere (cdCheck #9 scans for ₩, KRW, 원정, amount patterns).

**Rule table** `CD_RULES` (122 entries: A 25, S 46, X 9, Q 12, M 7, K 13 incl. the K-EQ note, N 4, L 6; 5 map to GC items: A-TOL-M, A-TOL-IN → GC-T03, Q-COC → GC-T10, M-MARK → GC-T06, M-PKG → GC-T11; basis local 59 · second 15 · practice 7 · engine 24 · policy 17; `window.__bomTest.cd.rules()` lists them). Fields: `id, type (C|D|E or fn), cat, act, queue, basis (local | second | practice | engine | policy), ev (fire on m.ev) and/or when(x) / bom(lines) / rfq(D), p (params), g (group key → one row), gc (GC item instead of a row), offer, req, ko/en templates, refs (standard numbers and clauses only, never text), imp`. Evidence rule: a rule backed only by secondary sources is **C (confirm)** with '(2차, 원문 미대조)' unless we actually supply something different (S-DIN-WAF, S-KS-1JONG M10/12/14/22, S-KS-3JONG stay D because the substitution is a fact). Deliberate differences from spec 5: S-HDG-M8 and X-MDMT are C (spec D), S-HDG-NUT10 is C in both cases, S-A194-GR4 offers 7L (not 7) when the bolting is L7/L43 or the MDMT is below the B7 no-impact limit used by X-MDMT (about −48 °C, secondary source), S-API610-ED text says "assumed per 12th Table H.1, 11th and earlier not checked" (absorb1 rejected the 11→12 comparison), S-J429-2 not implemented (site-review evidence only, and the base NOTES no.1 states a length condition instead). K-EQ events make no row (the line is N with a reply date). Rules on not-available lines: only N-NA, N-UNREAD, N-EXCL, A-MERGE, X-SCOPE.
**GC**: GC-T01…T14 per 4.7 (+ GC-T15/T16 for API 610 context: §6.1.37.4 quality and §6.12.1.8 bolting certificates), conditional items print '(해당 n줄)'. GC-C01 = `BOM_VAT.gc`, GC-C02…C11 from SHOP_TERMS / spec, **GC-C12…C17 are placeholders** (`ph: true`, '[자리표시 — …: 운영자 입력]', no numbers).
**Doc plan** (HARD RULE 5): every supplied line gets COC_F21 (BoltNote, ISO 16228 F2.1, no test values); MTC31_FWD / MTC22_FWD are always `by: 'manufacturer'` (forwarded unaltered; incl. when the line or RFQ asks for 3.1, else option); KOLAS and MTC32 are `onRequest`, by a third-party lab / inspection body, included only when requested; HARD100, IMPACT, COAT by grade/finish; ORIGIN, PACKLIST (firm), ITP_DIST + MDR (VDRL). No BoltNote-issued 3.1/2.2 anywhere (cdCheck #8). '3.1 issued by supplier' in a line/RFQ → Q-31-SELF (E).
**L-rules / B16.5**: `CD_B165` = ASME B16.5-2020 Tables 7C/10C/15C (Class 150/300/600, absorb2 dataPatches; own copy so it works on base0 too). L-FLANGE checks stud size/TPI/length (RF or RTJ) and quantity multiple against the table when a flange context with NPS is known (line, section row '4" CL300', or RFQ); L-NUT-QTY adds the flange-joint count when the table applies.

**`window.__bomTest.cd`** (tests only): `run(input, rfq?, prev?) → { doc, unpriced, snap, checks, ms }` (input = pasted text or `[[raw, qty, {no, pn, tag}?], …]`; a row with no qty and a context is a section title), `items`, `neg` (tamper tests per invariant), `diff`, `match`, `ctx`, `refDocs`, `shipDate(iso, days)`, `addBD`, `b165`, `impact`, `refText`, `self31`, `money`, `rules`, `gcList`, `store`, `wordsDoc`, `shipCmp`.

**Views (not done here)**: suggested route `SHEETS.cd = ['4A-2', 'C&D 시트']`, `SHEET_PARENT.cd = 'bom'`; build with `cdBuild(bomCompute().items, rfq, cdLastRev(qno))`, print `row.cells` (or `cellsTech` for the unpriced copy), show `doc.watermark`, `doc.firmBlocked`, `doc.queue`; run `cdCheck` before 'Rev 발행' and block on any `ok:false`; save with `cdSaveRev(cdSnapshot(doc))`.

### 8.9 Views (views track; `src/v1_bom.js` … `src/v4_out.js`, `src/bom.css`)

**State** `state.bom` (persisted as `bn.bom`, try/catch through `store`): `text, sample, file, map, mapHead` (S1/S2), `rfq` (S0 RFQ header fields: `project client attn rfqNo rfqRev due place pay api610 nace exposure mdmt flange docs[] basis text offer('indicative'|'firm') review{ok,by,at}`), `ov {[itemKey]: {type,size,length,qty,mat,fin,point}}` (edits), `dec {[CdRow.key]: {status, by, at, reply?}}` (→ `rfq.decisions`), `ok {[itemKey]:1}` (line accepted by the buyer), `orig {[itemKey]:1}` (R: keep the original spec → engineer quote), `excl {[itemKey]:1}` (→ `rfq.excluded` line keys), `qno` (sticky quote number after the first issue), `issued {[qno|rev]: hash}` (which draft state each Rev was issued from), `filter` (`review` | `all` | `catalog` | `engineer-quote` | `not-available`), `open` (selected line), `doc` (`quote` | `cd` | `comp` | `na` | `dwg` | `diff`), `unpriced`, `part` (`all` | `tech` | `comm`), `lang` (`both` | `ko` | `en`), `keys` (single-letter shortcuts on), `q` (line search). `itemKey` = `` `${row.text}§${n}` `` (same as cdItems), so edits/decisions survive quantity changes.

**Compute** `bomCompute()` → `{ qno, prev, issued, rfq, parsed, all (items incl. section rows), items, L, doc, sum, ms }` with three caches (items · cdBuild doc · view model). Items come from `bomItems(text, rfq, ovOf)` = cdItems plus one guard: a row without quantity that cdSectionOf calls a section title stays a line when the engine can read an item type (e.g. `GASKET SPW 4" CL300` is a not-available line, not a section; spec 2.3 'no qty and no size'). `L[i] = { x: item, l: doc.lines[i], rows (live C&D rows of the line), qrows (unresolved rows with an exception-queue code), q (queue codes in 2.8 order), need, cat, ex }`. A line needs judgement when it has an unresolved queue row and is not accepted (`ok`) or excluded. `sum` = counts (`n auto need byQ cat eq na ex`), money from `doc.totals` (= bomTotals = cart formula), `words` (`일금 …원정 (₩…)`) + `wordsOk`, `lastShip`, `lastReply`, reference total, `defaults` (lines the one-click accept touches).
Issued Revs: `cdSaveRev(cdSnapshot(doc))` after `cdCheck` (all 12 must pass); while nothing changed since an issue the doc is rebuilt as that Rev (same date, `prev` = the Rev before it), any change makes the next Rev a draft (`prev` = last issued). Diff tab = `cdQuoteDiff(last issued, draft)` (or the last two issued Revs).

**Actions** (each one undo step, `BOM_UNDO` max 20; text typing uses the textarea's own undo): `bomAcceptLines(keys, {keepD})` (A; a row whose lines are all accepted → `ACCEPTED_WB`), `bomAcceptRow(row)` (⇧A, by `CdRow.key`), `bomAcceptDefaults()` (spec 2.9: ambiguous/qty/na → accepted, deviations → line accepted with the D row left `OPEN`, conflict/unread untouched), `bomKeepOrigLines(keys)` (R: line → engineer quote via `bomKeepOrig(m)`, `K-EQ` event, D rows of fully-kept groups → `REJECTED` 'buyer keeps the spec as written'), `bomExclude(keys, on)` (X), `bomSetOv(key, ov)` (E), `bomBulk(keys, {mat, fin, mult})`, `bomToCart()`, `bomPnToCart(pn)`, `bomIssue()`, `bomExport(kind)` (`xlsx` 5 sheets per spec 8.7 · `json` QuoteRevision (priced) or `cdUnpriced` (unpriced) · `csv` UTF-8 BOM · `mail` clipboard), `bomSaveFile(name, data, mime)` (downloads capability → Blob + `<a download>` fallback; `declined` ignored).
Keyboard (spec 7.2) works only with focus in the line list: ↑↓/J K, Home/End, N, 1–6, Enter, Space (select), A, ⇧A, R, E (Esc cancels), X, U, /, G then Q, ? ; Ctrl/⌘+Enter (anywhere on 4A) moves focus to the issue button with an inline 'Enter to issue' line (no dialog). Single-letter keys can be switched off (WCAG 2.1.4).
Printing: `window.print()` only when `window.top === window.self`; otherwise the toolbar says printing works on the public site. Each document is a named page (`@page qdq/qdc/qds/qdn/qdd/qdf`, A4 portrait or landscape) generated with the document number + Rev in the bottom-left margin box and `n / N` bottom-right (style element inside `#qd-doc-w`).
Test hook: `window.__bomTest.view = { paint(text) → timings, quote() → ms, state() }`.

## 9. How a module adds a route or a hook

**A. Sub-sheet / route without touching the base** (preferred; works from any `v*.js`, `c*.js` or `t_*.js`):
```js
SHEETS.cd = ['4A-2', 'C&D 시트'];        // number + name for header, crumbs, <title>; makes normRoute accept '#cd'
SHEET_PARENT.cd = 'bom';                  // which #nav tab lights up
V.cd = () => sheet(zone('A', 'z-a', shd({ trail: [['BOM 견적', 'bom'], ['C&D']], no: SHEETS.cd[0], title: 'C&D 시트' }) + `…`));
V.after.cd = () => { view().addEventListener('click', e => { … }); };   // #view is a fresh element on every go()
```
Route names: lowercase, **no dash** (`m-…`/`i-…` are the base's family routes; `go()` splits on `-`). Tested: `#cdx` → header `4A-2 / 8`, nav “BOM 견적” on, `V.after` runs.

**B. `src/<module>.hooks.json`** — for markup or code that must change in place:
```json
[
  { "anchor": "<exact text in the spliced page>", "replace": "<new text — usually the anchor plus your addition>", "count": 1 }
]
```
- Files apply in sorted file-name order, entries in list order, after the core hooks and blocks.
- `count` (default 1) = exact number of occurrences required; all of them are replaced. `count: 0` = at least one, replace all.
- Missing anchor or wrong count → build exits 1: `build.py: <file> #<index>: anchor not found: '…'`.
- Keep the anchor inside `replace` when other modules might hook the same spot. Prefer anchors inside your own block over base text; if you anchor on base text, add it to section 4 and tell the base track.
- A new **top-level** sheet also needs a `#nav` link (hooks.json on the `#nav` anchor) and a `SHEET_TOTAL` change in build.py (lead).

**C. Search entry from a module**: `INDEX.push({ t, s, k: 'lower-case keywords', go: 'route', g: '도구·안내' })` at load (the view block runs after `INDEX` is built).

## 10. CSS notes (views track)

- The scaffold's temporary token bridge and old-class compat block are **gone**; bom.css uses base tokens and classes only (`.tblock .tbl .tblw .mstack .note .tag .btn .ball .bub .kv .choices fieldset.tbf details.acc`). New classes: `wb-*` (4A workbench), `qd-*` (4A-1 documents), `wbh-*` (home entry). The base parts-list classes `.bom/.bom-h/.bom-f` are not reused.
- `.tb-route.za-route.r4` (4-cell home route, 2×2 at ≤680px) is kept; in the 4-cell row the sheet reference sits above the label so labels do not wrap at 1360.
- Engine drawings (`svg.bom-dwg`) carry their own scoped `<style>`.
- Breakpoints: 1020 (single column; line detail becomes a bottom sheet), 720 (workbench phone layout: line cards, 44 px buttons, fixed bottom bar `기본값 모두 승인 · 견적서`), 680 (base phone layout; document tables flow label:value inline).
- Print (`@media print`, only when `#qd-doc-w` is on the page): page chrome hidden, light print tokens, tables unstacked, `thead` repeats, rows do not split, indicative watermark repeats on every page (position: fixed).

## 11. Open items found by the scaffold (not fixed here)

- ~~`e0_api610.js` contains “회사 매트릭스”~~ — fixed by the engine track (step 1): rewritten as “8판: 원문 미대조 (업계 일반 관행)”; test.py scans the engine block for banned wording and names.
- ~~Old views in their own layout~~ — rebuilt by the views track (8.9, 10). The quotation title is an `h2`; each route has one `h1`.
- ~~No print button / file save~~ — added under hard rule 9 (8.9).
- ~~BOM catalog part numbers in search route to `m-ihcs`~~ — routed to the cart (section 4, `v1_search.hooks.json`). The engine cannot read its own catalog part numbers from BOM text (`HBF-M10-30-88-ZW` → unknown); a pasted part-number-only line lands in the exception queue as 'unread'. Engine track: consider `parsePn` in `parseCore`.
- C&D (engine step 2) open items: operator price entry for engineer-quote lines (`x.priced`) is not wired, so a firm offer lists every engineer-quote line as '미견적 Not quoted' (N-NOTQ); the `spec`/`doc`/`tag`/`dwg` column roles of spec 2.4 do not exist in `bomRows` yet, so M-TAG/M-KIT only fire from section tags or `row.tag`; price-hold across Revs (2.11) is reported (`priceHeld`/`repriced`) but not applied; VAT is the engine's `total-round` decision (spec 10.3 asks per-line truncation — needs the operator's/tax adviser's choice); spec 10.2 #34 expects no L-FLANGE for `3/4-10 X 4-3/4` at NPS 4 Class 300, but B16.5-2020 Table 10C gives RF 4.50" / RTJ 5.00", so it fires (table wins).
- Views track open items: (1) the xlsx C&D sheet cannot carry dropdowns or per-cell locks (SheetJS community edition does not write data validation or per-cell unlock styles, so protecting the sheet would also lock the reply columns), so columns 9/10 get a written code list instead and the sheet is left unprotected; reading a returned customer xlsx (re-quote path c) is not built. (2) Firm offers are gated by a page-local "운영자 검토" checkbox (`state.bom.rfq.review`) that anyone can tick in this static page — the real gate needs a server/operator login. (3) Operator queue, SLA timers, supplier RFQ export (spec 7.6) and PDF/photo table import (pdf.js) are not built; CSV/TSV/TXT files are read as UTF-8 with an EUC-KR retry. (4) No virtual scrolling: the 500-line `전체` tab paints in about 0.8 s (thumbnails are drawn lazily when they scroll into view).

## 12. Final integration (lead, out_f) — what changed at assembly

Full edit log: `out_f/work/EDITS.txt`; summary in `FINAL.md`. Pre-assembly copies: `out_f/work/src_orig/`, `out_f/work/base.before_final.html`, `out_f/work/build.py.orig`, `out_f/work/INTERFACE.before_final.md`.

**More base-text anchors used by module hooks** (not covered by `--check`; the build names the file if one breaks). Keep byte-identical:
- `src/t_api610.hooks.json`: `<a href="#tools" data-go="tools" data-tab="cert">받으실 3.1 성적서 읽는 법</a><a href="#tools" data-go="tools">규격 도구 전체 → 5장</a></p>` (home F) and `<dt>나사</dt><dd>${thread}</dd>` (V.inchFam).
- `src/v1_search.hooks.json` #2: `  const seen = new Set();\n  return res.filter(r => { const k = r.t + r.go + (r.tab || '') + (r.jump || '');` (end of `search()`), #3: `${esc(LEAD_TIER[f.lead])}</dd>` (V.inchFam 공급·납기 row).

**Base top-level names added by the base track** (modules must not redeclare): step 1 `nearLen, LEN_4014, combosFor, FREIGHT_KG, hdNote, PAIR_G, pairList, pairPn, inchThread, FAM_KW, GRADE_KW, FIN_KW`; step 2 `LEAD_TIER, CUT_T, INCH_ADD, B165_300, B165_600, B165_CLASS, FL_SET, flangeChecks, SVC, svcGuideHTML, DOC_OPT, sizeCap, B8_CL2, inchWarn, REQ_DOCS, QDOCS, QRULES, qdocHTML, PLANT_PROPS, A194_NUTS, A320_IMPACT, A320_IMPACT_NOTE, F1554_GRADES, F1554_NOTE, MARKS, degC`. Modules read `TABS`, `TOOL`, `INDEX`, `INCH`, `LEAD_TIER`, `FREIGHT_KG`, `combosFor`.

**New names at assembly**: engine `cbOf` (e6), `BOM_LEAD_OF`, `bomFamLead`, `bomInchFamOf` (e7_status); views `bomSearchMore`, `BOM_INCH_CAT`, `bomInchCatNote` (v1_bom). Search items may carry `bomDoc` (opens that 4A-1 tab) and `bomPn` (cart).

**Engine ↔ base rules now shared**: metric catalog combinations come from base `combosFor` (no HDG below M8); the supply tier of engineer-quote lines for B16, A453 660, A320 B8/B8M, 6Mo/super duplex, F468, A354/A449 and the generic S-CAT-ALT reason on inch lines follows the base `INCH[].lead` of the matching family; the quotation's 운송조건 uses the cart's freight rule (`FREIGHT_KG`, 1 m rod). New grade codes: `A453-660`, `A320-B8`, `A320-B8M`, `B8MLCUN`, `SDSS`.

**Tools tabs**: base has 10, `t_api610` adds the 11th; `t_api610.css` lays out 11 (4×3 wide, 3×4 ≤1020, 2×6 ≤680, last tab fills the row). A 12th tab needs new rules. The inch-page link computes the tab number (`5장 상세 ${TABS.findIndex(...) + 1}`).

**#nav**: the 4A label is `BOM<span class="lg"> 붙여넣기 견적</span>` (phones show `4A BOM`).

## 13. B2B flow (out_g track): quote-request channel, privacy page

Source: `b2b_site_changes.json` (51 places + `channel`), `b2b_flow.md`, `DECISIONS.md` 3–5. Edit script for the base: `out_g/work/apply_base.py` (re-runnable from `out_g/work/base.before_g.html`). Pre-edit copies: `out_g/work/src_before_g/`, `out_g/work/INTERFACE.before_g.md`. No build.py anchor changed (`--check` 18/18).

**Config (one place, `src/e1_data.js`, right under `SHOP_TERMS`)**: `const CONTACT = { rfq: '', tel: '', fax: '', kakaoChat: '' };`. Empty = not set: the page shows `.ph` placeholders (`견적 메일 주소`, `000-0000-0000`, `0505-000-0000`, `카카오톡 채널 채팅 URL`) and every control that needs the value is `disabled` with `title="운영 정보 등록 후 사용"`. `mailto:`/`tel:`/Kakao `href` are built only when `rfqOk(k)` (format check; `@example.*` never counts). No domain is assumed (DECISIONS 4: free Naver mailbox during validation), so the placeholders do not say `@도메인`.
`SHOP_TERMS.payment` and `.reply` now hold real B2B wording (bank transfer; `[30]` days is an operator value shown as `.ph` on the quotation; reply = 접수 확인 4영업시간).

**New files**: `src/v5_rfq.js` (channel), `src/v6_policy.js` (6-1 privacy, 6-2 terms), `src/rfq.css`.
**New top-level names** (modules and base must not redeclare): `CONTACT`; `RFQ_PH, RFQ_UNSET, RFQ_URL_MAX, RFQ_COLS, RFQ_PAY_Q, RFQ_PAY_BO, RFQ_CTYPE, rfqOk, rfqC, rfqNo, rfqToday, rfqMail, rfqCur, rfqSheetHTML, rfqShow, rfqSaveXlsx, rfqSaveJson, rfqPrint, rfqTo, rfqCell, rfqCells, rfqTxt, rfqPnText, rfqCartF, rfqVal, rfqReq, rfqRadios, rfqCartForm, rfqLastShip, rfqCartPkg, rfqCartDoc, rfqCartPaint, rfqCartShow, rfqCustomShow` (v5); `bomRfqPkg, bomRfqMail` (v4); `bomJsonText` (v1); `PV_PH, pvTable` (v6).
**Base → module calls** (base.html now calls these at run time; the build always includes src/): `rfqC`, `rfqOk`, `RFQ_UNSET` (6장 G 문의), `rfqNo('Q')` + `rfqCustomShow(el, no, again)` (4장 submit), `rfqCartShow(el, mode, cartRows(), move)` (7장 C 구역, `showDoc(move, mode)` with mode `'Q'` from `#ask`, `'BO'` from `#order`, none = repaint).

**Package object** (`pkg`, what the send sheet works on): `{ kind 'Q'|'BO'|'BQ', no, date, fileBase, who {co,name,mail,tel}, area, due, pay, content, nLabel, total|null (VAT incl.; null when any line has no price), words (BO: '일금 …원정 (₩…)'), freight, extra[], files[] (names only), attach, first (Kakao first message), printable, print(), xlsx(msgEl), json(msgEl), check()? (returns a message and marks fields when required fields are empty) }`. Builders: `rfqCartPkg` (7장), inline in `rfqCustomShow` (4장), `bomRfqPkg(c)` (4A-1, reuses `bomExport('xlsx'|'json')`).
**Send sheet** `#rfq-send` (`section.tblock.rfq-send`, below the document, not a modal): `#rs-xlsx`, `#rs-json`, `#rs-pdf` (hidden when `!QD_CANPRINT`), `#rs-mail` (`<a href="mailto:…">` when set, disabled `<button>` when not; hidden in an iframe mirror), `#rs-copy-addr`, `#rs-copy` (subject + body), `#rs-first`, `#rs-kakao` (only when set), fax/phone placeholders, `#rs-msg`, `#rs-ta` (copy fallback). One delegated document click listener; `rfqCur` = the pkg on screen.
**mailto**: `'mailto:' + CONTACT.rfq + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(lines.join('\r\n'))`; over 2,000 chars it drops the line summary and file names ('내용은 첨부 파일 참조'), then shortens 요청처. Subjects: `[견적요청] {no} {회사|개인} · 품목 n줄` / `[발주] {no} …` / `[견적요청] BQ-… Rev A … · BOM n줄`.
**Files**: `{no}.xlsx` one sheet (`요청` or `발주`; header rows + `No · 원문 · 해석 규격 · 수량 · 단위 · 상태 · 자동 견적 단가 · 비고`; CSV fallback when SheetJS cannot load), `{no}.json` = `{ format: 'boltnote.rfq', schema: 1, kind: 'request'|'order', no, date, from, …, lines[{no, raw, spec, bom, qty, unit, status, price, amount, note}], totals }`. BOM requests keep the existing 5-sheet xlsx and `boltnote.quote-revision` JSON. Request numbers `Q-YYMMDD-XXXX` / `BO-YYMMDD-XXXX` (KST; 4 characters from `RFQ_NO_CH`, 31 symbols without 0 O 1 I L, `crypto.getRandomValues`) — finalize-2, was 3 random digits. 7장: once a document has been exported (xlsx, json, pdf, mail, body copy) and its content then changes, the number gets `-R1`, `-R2` … and a '번호 변경' note (`rfqCartF.rev/sent/revMsg`, `pkg.sig`, `pkg.sent()`). `store` key `rfq.last` = `{ no, t }` only.
**Re-order**: 4A file open accepts `.json` (`bomJsonText`): `boltnote.quote-revision` (priced) → its BOM text; `boltnote.rfq` → `품명·규격 / 수량 / 단위` table from `line.bom` (catalog part numbers are written as engine-readable text by `rfqPnText`, e.g. `Hex bolt ISO 4017 M10x30 8.8 ZINC`, which the engine matches back to the same part number).
**4A-1 toolbar**: `[data-q="send"] 정식 견적 요청 보내기` only when `doc.offerType !== 'firm'`; `[data-x="mail"] 메일 텍스트 복사` (supplier → customer, `bomMail`) only when firm. Sheet container `#qd-send`.
**Routes**: `SHEETS.privacy = ['6-1', '개인정보 처리방침']`, `SHEETS.terms = ['6-2', '이용약관']`, parent `help` (no change to SHEET_TOTAL). Linked from the footer 정책 list, 6장 G, the 4장 notice and every send sheet. verify.py's default route list does not include them; pass `--routes privacy,terms`.
**4장 form**: consent checkboxes `c-agree`, `c-agree-tel`, `c-custom-ok` are gone (notice `p.pi-note` in `#c-pi-f`, legal basis 개인정보 보호법 §15①4·6); optional `#c-news` (소식 메일, default off) and `#c-area` (납품 지역) added; the phone number goes into the request when filled. Result container `#c-send` after the form.
**Tests**: `out_g/work/rfq_check.py <page> <out>` (54 checks: channel.tests, no network sends, placeholders, mailto round-trip with a filled-CONTACT copy, 300-line BOM URL ≤ 2,000, mirror, file names = request numbers, re-import, privacy page, opened-state overflow light/dark × 400/1360). `out_g/work/run_all_g.sh` = the 17 suite commands on `out_g` + `verify --routes privacy,terms,…` + rfq_check. `ui_check.py` tsv check accepts `대금 지급 조건` (renamed from `결제 조건`); `out_f/work/feat_f.py` still expects `결제조건` and the indicative `메일 텍스트 복사` button, and `out_f/work/behave2_f.py` expects 13 FAQ items (now 16) — use `out_g/work/feat_g.py` and `out_g/work/behave2_g.py` (run_all_g.sh does). `out_g/walk/` holds copies of walk.py, corpus_cart.py and bom25.tsv.

## 14. No-stock validation mode (out_gs track): the `OWN_STOCK` switch

During validation the owner holds no inventory and sources every order from domestic wholesalers. One switch in the base, next to the cut-off constant, decides which supply promise the whole page makes:

```js
const OWN_STOCK = false;                                        // base.html, the only place (engine, C&D and views read it)
const FREE_SHIP = 50000, SHIP_FEE = 4000, CUTOFF = OWN_STOCK ? 14 : 12;   // the one cut-off: own stock 14:00 (page value), partner stock 12:00 (supply.json PARTNER_STOCK)
const CUT_T = `${String(CUTOFF).padStart(2, '0')}:00`;
const STOCK_COPY = OWN_STOCK ? { …today's sentences… } : { …partner-stock sentences… };   // every stock-dependent sentence, keyed by the place that prints it
```
Flip = change `false` to `true` on that one line and rebuild. Nothing else changes.

| | `OWN_STOCK = false` (now) | `OWN_STOCK = true` |
|---|---|---|
| catalog stock flag (example data) | `v.stock = false`, `v.listed = true` (base `variantInfo`, engine `famVi`) | `v.stock = v.listed` (as before) |
| ship date | `shipDate(false, finish lead)` = from the cut-off day + 2 BD (+ coating days); `v.listed` items get no inch sourcing days (`leadExtra`) | as before (stock: same day before the cut-off, else next BD) |
| tier `m.lead` | never `OWN_STOCK`. Former own-stock lines → `PARTNER_STOCK` dispatch 1–2, toCustomer 2–3, text `협력사 재고 확인 후 출고 (보통 1–2영업일) · {date} 출고 예정`; with a coating (> 2 BD) → `MRO_BACKUP` (label also 협력사 재고) | as before |
| cut-off | 12:00, worded `발주 확정·입금 확인 마감` | 14:00 (`오늘 출고 발주 확정 마감`, as before) |
| strip `#cutoff`, lamp | `발주 확정·입금 확인 마감 12:00까지 n시간` / after: `지금 발주 확정분 {date} 출고 예정`, lamp `12:00 마감 지남` | as before |
| 1장 title block | `발주 확정 마감 Cutoff`, `지금 확정하면 출고 예정 {date}`, `협력사 재고 확인 후 · 도금품은 품목별 표시`; `--cut` from CUTOFF | as before (`--cut` .5556 from CUTOFF) |
| item pages (`shipHTML`) | `[협력사 재고] {date} 출고 예정 · 협력사 재고 확인 후 출고 (보통 1–2영업일) · 포장 n` (coated: `(약 n영업일)`); no per-combo `협력사 재고` mark | as before |
| cart, 1장 G, 6장 A, footer, search hint | partner-stock wording, no same-day promise (`STOCK_COPY.shipOk / do0 / dont3 / help0 / about / hours / fine`) | as before |

New names (modules must not redeclare): base `OWN_STOCK`, `STOCK_COPY`; `shipDate()` also returns `days` (business days it counted); `variantInfo()` / `famVi()` also return `listed`. Static footer cells carry `data-sc="about"` / `data-sc="hours"` and are filled at start from `STOCK_COPY`. `__bomTest.terms()` returns `OWN_STOCK`.
Layout fix found while testing: the top strip's two optional cells now hide up to 1160 px (was 1100 px); the old page overflowed by up to 7 px at 1101–1107 px after the cut-off.

**Tests** (both settings): `out_gs/work/run_all_gs.sh <outdir> <base>` = the 17 suite commands + verify_b2b + rfq + `stock_check.py`; `out_gs` = `OWN_STOCK = false` (integ/base.html), `out_gs1` = `true` (`out_gs1/work/base_own.html`, the one line flipped by sed). `stock_check.py <page> <out> --ref <old page>`: no same-day / 자체 재고 / 14:00 wording on 54 screens at 6 fixed clock times (false), engine output and visible text identical to the old page (true), only former OWN_STOCK lines changed tier, strip fits at 400–1360 px. Expectations changed deliberately (tier only, no parsing expectation): `test.py` (CUTOFF unit check and the catalog tier invariant follow `terms().OWN_STOCK`; new check: no OWN_STOCK tier when false), `cdtest.py` (the Friday-16:00 catalog line: OWN_STOCK 10/6 ↔ PARTNER_STOCK 10/8; one added 12:30 cut-off case), `out_gs/work/behave2_gs.py` (cart tier labels). `corpus.json` has no tier fields and is unchanged.
Edit script for the base: `out_gs/work/apply_base_gs.py` (re-runnable from `out_gs/work/base.before_gs.html`). Pre-edit copies: `out_gs/work/src_before_gs/`, `test.before_gs.py`, `cdtest.before_gs.py`, `INTERFACE.before_gs.md`, `page.before_gs.html`.

## 15. Official English names (out_gn track): `en_names.json` → `BOM_EN`

Source: `en_names.json` (178 items, DECISIONS 2). Format rules: titles show the Korean name with the English name as a smaller second line plus the `enStd` tag; the quotation 품명 is `"<ko> / <en>"`. Korean names are unchanged.
Edit scripts: `out_gn/work/apply_base_gn.py` (re-runs from `out_gn/work/base.before_gn.html`, 41 edits, `--check` 18/18) and `out_gn/work/gen_names.py` (writes `src/e1n_names.js` from the JSON + `out_gn/work/e1n_names.tmpl.js`; never edit the data block by hand). Pre-edit copies: `out_gn/work/src_before_gn/`, `INTERFACE.before_gn.md`, `page.before_gn.html`, `build.before_gn.py` (build.py unchanged).

**Id collision (DECISIONS 2)**: the JSON's NEW `sw` (해수·염화물용 6Mo·수퍼듀플렉스 볼팅) is the page family **`smo`** (base `INCH.push({ id: 'smo' … })`, route `#i-smo`, `BOM_NO.smo = 23`, `sheetOf` → `3-15`), already renamed when absorb2 was integrated. METRIC `sw` (스프링와셔) keeps `#m-sw`, `BOM_NO.sw = 6`, `2-6`. The map is keyed `scope:id`, and the generator writes the seawater entry as `NEW:smo`, so no lookup can hit the spring washer. `#i-sw` is not a route (normRoute → `inch`). en_check tests all three.

**Data** (`src/e1n_names.js`, engine block, runs right after e1m_money.js): `BOM_EN['SCOPE:id'] = [en, enStd, ko]` with scopes `METRIC`, `INCH`, `NEW`, `ENGINE`, `TYPE` and sub-ids `short:<id>`, `fl-set`, `label:*`, `variant:*`, `point:*`, `c-shape:*`, `std-row:*`, `grade:*`.
Base `METRIC`/`INCH` `en:` values are now the official names (the informal ones are gone). At load every family gets `f.en`, `f.enStd`, `f.enShort` (`bomEnSet`; METRIC/INCH in e1n, `BOM_FAMS` at the end of e2_cat.js). `GRADE.B7S/F880M/LW188/LWCS.en` = the TYPE `grade:*` names.

**New top-level names** (do not redeclare): `BOM_EN, bomEn(key) → {en, std, ko} | null, bomEnSet(f), bomEnKey(q), BOM_EN_TYPE_KO, bomEnType(q, point?) → {key, en, std}, bomKoEn(ko, en), bomEnLine(x) → {ko, en}, bomEnMatch(m) → {ko, en, std} | null, bomEnCart(cartLine) → en` (e1n); `wbEnName` (v2), `qdName` (v3), `RFQ_PN_WORD` (v5). Test hook `window.__bomTest.en = { map, fams, line(raw, qty), cart(l), grades }` (v4_out.js).
- `bomEnType(q)` follows `labelOf` (variant → label → type) and, if that key's Korean is not exactly `q.typeLabel`, takes the TYPE entry whose Korean is `q.typeLabel` — the English is always the pair of the Korean on screen. Anchors append ` with Nut` / ` and Washer` like the Korean ` + 너트·와셔`; `point = true` appends `, Cup Point` etc. (specLine and C&D style).
- `bomEnMatch(m)`: only catalog lines, the matched METRIC/BOM_FAMS family.
- `bomEnCart(l)`: item lines → the part number's family `enShort`; quote lines → `l.en` (set by the inch configurator, the flange calculator and BOM→cart), else the INCH family by `fam`+title, `플랜지 스터드 세트 NPS x Class y` → `INCH:fl-set`, 4장 custom → `c-shape:<shape>` + ` (Made to Order)`.

**Where names appear**: family sheet `h1` (`.h-en` line + `.tag.en-std`; the old English part of the subtitle is removed), home A/C and 2장/3장 parts lists (`.en-n`), 형번 조립 selector (`p.pn-en`), recent items, cart rows (item + quote), 견적 요청서/발주서 documents, search keywords (`en`, `enShort`, `enStd` for METRIC/INCH; `en`, `enStd` for BOM_FAMS), 4A line cards (`.wb-en` = matched family + enStd, else the line item) and the detail panel (`품명`, `카탈로그 품목`), 4A-1 quotation and drawing pack 품명 (`qdName`: `<b>ko</b><span class="qd-nm-en"> / en</span>`, independent of the C&D language switch), C&D English column (`cdSpecEn` first part = `bomEnType(q, true).en`; the informal `CD_TYPE_EN` table is removed), 5장 규격 대조 product column (`std-row:*`; 구조용 고장력 볼트 세트 and 기초 앵커볼트 have no entry in the JSON and stay Korean only).
**Exports**: C&D `doc.lines[].name = {ko, en}` (also in `cdUnpriced` lines and the QuoteRevision JSON snapshot); 4A xlsx ① 견적 column `품명 영문 (Item name)` after `정리한 사양` (also TSV/CSV), ⑤ 해석 원문 column `품목 영문 (Item)`; 견적 요청서/발주서 xlsx column `품명 영문 (Item name)` after `해석 규격`/`품명·규격`, `boltnote.rfq` JSON `lines[].en`.
**Re-import text is not a display name**: `rfqPnText` keeps the engine-readable words (`RFQ_PN_WORD`: `Hex bolt`, `Socket head cap screw`, … — the engine does not read `Hexagon Head Screw` as an item), so its output is byte-identical to before.
**CSS**: `src/en.css` (`.h-en`, `.tag.en-std`, `.en-n`, `.pn-en`, `.wb-en`, `.qd-nm-en`; long names wrap, `overflow-wrap: anywhere`).
**Tests**: `out_gn/work/en_check.py <page> <out> [--ref <page before>] [--shots <dir>]` (map = JSON, families and Korean names, collision, every corpus line's English pairs its Korean, re-import text unchanged vs ref, all views and exports above, 400/1360 light/dark overflow incl. opened cart, 4A with data, 4A-1, longest family sheets, tools). `out_gn/work/run_all_gn.sh <outdir> <base>` = the 17 suite commands + verify_b2b + rfq + stock + en_check.

## 16. Finalize-2 (out_g_final): owner flags, quantity guard, wording

Edit scripts: `out_g_final/work/ed_*.py` (escrow, quality, mtr, price); pre-edit copies in `out_g_final/work/before/` (base.html, src/, build.py, INTERFACE.md, test.py, page.html). Report: `FINAL2.md`. `--check` 18/18; no build.py anchor changed (the go() hook's replacement text changed, its anchor did not).

**Operator flags (base.html, one line each; modules read them):**
| flag | now | effect |
|---|---|---|
| `ESCROW_ON` (+ `PAY_CARDS`, `PAY_COPY`) | `false` | No 구매안전서비스 yet: the footer escrow row is hidden (`[data-pc-row]`), individuals prepay by credit card only (`RFQ_PAY_BO.ind = ['신용카드 결제 링크 요청']`), no 현금영수증/escrow sentences in the cart, 6장 B, footer, 발주서 notes or the 4A-1 증빙 row. `true` restores bank escrow wording with a neutral `<span class="ph">은행명</span>` (no real bank or product name). Footer cells `[data-pc]` are filled at start like `[data-sc]`. |
| `MTR_STATE` (`MTR_OK` = `'confirmed'`) | `'unconfirmed'` | INCH `docTag` → `CoC · 3.1(확인 후)` (`docTagOf`), `docs` → `CoC(ISO 16228 F2.1) 기본 · 공급처 확인 후 가능하면 …` (`docsOf`), configurator default `CoC`, 6장 E 3.1 row and FAQ say availability is confirmed per item, C&D Q-31-FWD adds 'availability to be confirmed'. The CAD module's `CAD_MTR` should replace this one value later (cad/requirements.md §7.3). |
| `PMI_ON` | `false` | PMI removed from doc tags, family `docs`, the 4장 서류 checkbox (`REQ_DOCS`) and the 6장 E table (8 rows); C&D Q-PMI says 'availability on request'. |
| `CART_QTY_MAX` (base) = `BOM_QTY_MAX` (e3) | 1,000,000 | Cart/quick order refuse a line above it (toast / `#qo-msg`); the engine flags it `issue: 'big'`. |

**Quantity (engine `parseQty`):** exponent forms (`1e3`, `1E+03`) are read as their value with `issue: 'exp'`; a quantity with no digit (`abc`, `TBD`) is `{ n: 1, issue: 'nonnum' }`; above `BOM_QTY_MAX` → `'big'`. New `qtyWarnOf` texts and `CD_QTY_EN` keys `exp`, `nonnum`, `big`. **기본값 모두 승인 never accepts a line in the `qty` queue** (`bomSummary().defaults`), and `bomToCart` skips lines that still need a quantity decision (toast '수량 확인이 필요한 n줄 제외'). Cart quantity input writes the rounded value back on change.

**Supply tier wording:** `BOM_TIER.MRO_BACKUP.label` = `'협력사 수배'` (was 협력사 재고; text says what makes it longer: 도금 or 수배). An exact catalog item with an outsourced process (coat/plate/sec) is `DOMESTIC_MFG` ('국내 제작 (기본품 + 외주 공정)'), not 협력사 재고. Inch family pages that have BOM catalog part numbers show `기본 사양: 협력사 재고 …` next to the family 공급·납기 (`bomInchCatNote`).

**Commercial wording:** '표시 단가 · 바로 발주 · 예시' → '참고 단가 (공급처 확인 전), 발주 확인서로 확정' everywhere (home, 2장, cart, 발주서, 4A, 4A-1). GC-C04 counts lead time exactly like `shipDate()` (before `CUT_T` on a business day = that day). GC-C08 applies to separately negotiated B2B terms; site-price orders follow 6장 D; '재고 규격품' → '규격품'. K-NONRET wording follows. Quote 'AVL' text only when the RFQ has an AVL (`cdAvl`).

**7장 발주서:** `#ship-ok` unchecked → the send section is replaced by `#rq-held` (repainted on change). Business/public 발주서 require 상호/기관명 and a 10-digit 사업자등록번호/고유번호 (`check()`); the mail subject/body label a missing 상호 as `(상호 미기재 사업자|공공기관)`. Table rows stack as cards ≤560 px (`.rq-tbl`, `td[data-l]`).

**4A paste:** `#bom-enc` hint when the pasted text has U+FFFD or a run of ≥4 Latin-1 high characters (CP949 shown as Latin-1).

**New top-level names** (do not redeclare): base `ESCROW_ON, PAY_CARDS, PAY_COPY, MTR_STATE, PMI_ON, MTR_OK, docTagOf, docsOf, CART_QTY_MAX`; engine `BOM_QTY_MAX`; views `BOM_NA_HEAD` (v1), `RFQ_NO_CH` (v5).

**Suite:** `out_g_final/work/run_all_final.sh <outdir> <base>` = the 17 commands with current expectations: `feat` = `out_gs/work/feat_gs.py`, `behave2` = `out_g_final/work/behave2_g2.py` (behave2_gs with the 6장 E table at 8 rows while `PMI_ON` is false), `corpus_cart` = `out_g_final/work/corpus_cart_g2.py` (expects catalog lines with qty > 0 and no qtyWarn). `out_f/work/feat_f.py` and `behave2_f.py` are stale (they expect the removed indicative '메일 텍스트 복사' button, 13 FAQ items and old cart tier labels) and run only as info extras.

## 17. IA redesign + 165-family catalog + CAD/trust wiring (out_h)

Report: `FINAL3.md`. Pre-edit copies: `out_h/work/before/` (base.html, build.py, src/, test.py, cdtest.py, corpus.json, INTERFACE.md, page.html). Everything is re-made from those copies by `out_h/work/rebuild.sh [out.html]` (ed_e1 → gen_cat → wire_cad → ed_src → ed_base → ed_corpus → ed_tests → `build.py --check` → build). Approved design: `ia/spec.md` + `ia/prototype.html`.

**Build:** `--check` 16/16 anchors; 13 core hooks (the two hooks that added 4A to the old 8-cell `#nav` and the shop footer list were removed with those elements); module hooks: `v7_ia.hooks.json` (4A title + split bar), `ea_catalog.hooks.json` (engine), `cad.hooks.json`, `cad_trust.hooks.json`.

**New files:**
| file | block | what |
|---|---|---|
| `src/ea_catdata.js` | engine | `CAT_TILES` (6 tiles → subgroups → family ids), `CAT_COLL` (plant, pump, flange), `CAT_F` (165 families: names ko/en, standards, notes, tier label, verified dimension rows only, gates, safety). Generated by `out_h/work/gen_cat.py` from `catalog/taxonomy.json`, `catalog/data/*.json`, `ia/toplevel_map.json`; do not edit by hand. |
| `src/ea_catalog.hooks.json` | engine | `BOM_CAT_EXT`: pin, ring, key, rivet, insert, discspring lines become engineer-quote (`K-EQ`, `item: 'cat-<type>'`) instead of not-available (catalog/spec.md 4.6 P1). Corpus statuses of lines 121–124, 127, 133, 135 follow (`ed_corpus.py`). |
| `src/v7_ia.js`, `src/ia.css` | view / css | IA routes, home, smart box, tiles, family pages, list/ref/notes/about pages, menu, footer fill, search-index remap, screen-text rewrite. Prefixes `ia…` (pages), `hm…` (home), `sb…` (smart box). |
| `src/t_cad.js`, `t_datasheet.js`, `t_trust.js`, `t_cad.css`, `cad.hooks.json`, `cad_trust.hooks.json` | view / css | CAD · datasheet · trust module from `cad/src` (`wire_cad.py`). `CAD_MTR` lives in base.html where `MTR_STATE`/`PMI_ON` were; both are derived from it. |

**Routes:** `products`, `buy`, `list`, `ref`, `notes`, `about`, `t-<tile>` (bolt, nut, washer, stud, pin, rivet), `k-<collection>` (plant, pump, flange), `c-<family>`. Aliases (`iaNorm`, called first in `normRoute`): `metric`/`inch` → `products` (and set the 미터/인치 filter), `help` → `about`, `cad` → `ref`; `c-<legacy id>` → its `m-`/`i-` page; an unknown `t-`/`k-`/`c-` → `products`. Old routes all still open (`m-*`, `i-*`, `custom`, `tools`, `cart`, `bom`, `quote`, `privacy`, `terms`). Nav = 제품 · 목록 견적 · 도면·규격 · 회사 소개 + 견적함 (`iaNavKey`). `IA_ZONE` maps the old home jump zones to pages; `k-plant` carries the old 3장 C/D content (ledger, service guide, flange stud calculator `flangeInit`).

**Switches (`e1_data.js`, one block, owner only):** `SHOP` = `ordersOpen`, `mailOrderNo`, `bizNo`, `ownerName`, `ownerYears` ('7'), `hero`, `listPrimary`, `homeLayout`, `sla`, `quickOrder`, `priceBasis`, `priceOk`, `minOrder`, `leadRange`, `payLink`, `wbPublic`. Derived: `ORDER_LIVE` (ordersOpen + both numbers), `PRICE_ON(id)` (priceBasis date + id in priceOk; `PRICE_FAM` maps engine family ids), `PRICE_ANY()`, `PRICE_LAB()` ('참고가' / '판매가'), `ORDER_DOC()` ('주문 요청서' / '발주서'), `SLA()`. Default: no price shown anywhere; every catalog line is a quote line ('단가 확인 중').

**Theme:** light by default even when the OS is dark; footer switch 자동/밝게/어둡게 stored in `bn.theme` (try/catch); `[data-theme="auto"]` follows the OS.

**Screen text rewrite (v7_ia.js):** a MutationObserver rewrites text nodes outside documents (`.qd-doc-w`, `.rfq-doc`, `#doc`, textarea): `IA_SHEET_RX` turns old 'N장' references into page names; `IA_PO_RX` (only while `!ORDER_LIVE`) turns the customer-PO word '발주서' into '주문서' (spec 17.3 AC-L2).

**Family pages (`V.c`):** A families show the verified dimension rows only (gated families say 준비 중), a simple dimensioned drawing for pin/washer/nut/key templates (`IA_DRAW`), and CAD where the verified rows fit the generators: `IA_CAD_NEW = { hnthin: 'nut', pwl: 'washer' }` → STEP · DXF · zip · BOM text (no A4 datasheet: the datasheet code reads the 26 legacy family records). B/C families show spec info and [사양 적어 담기] (quote line). Safety families (eyebolt, ieyebolt, swingbolt, hoistring, eyenut, oemnut) keep their safety notes.

**Test hooks:** `window.__hmTest = { kind, list, isList }` (smart box), `window.__iaTest = { cadNew }` (STEP/DXF text for every hnthin/pwl row).

**New top-level names (do not redeclare):** engine `CAT_TILES, CAT_COLL, CAT_F, BOM_CAT_EXT`; e1 `SHOP, ORDER_LIVE, PRICE_FAM, PRICE_ON, PRICE_ANY, PRICE_LAB, ORDER_DOC, SLA_COPY, SLA`; views: every `ia*`, `hm*`, `sb*`, `IA_*`, `SB_MAX` name in `src/v7_ia.js`.

**Suite:** `out_h/work/run_all_h.sh <outdir> [base]` = the 17 commands of run_all_final.sh with out_h copies where the IA changed what a script expects (`func_h`, `ui_check_h`, `walk_h`, `corpus_cart_h`, `feat_h`, `a6check_h`, `behave2_h`; each docstring says what changed), plus extras: verify on all 139 new family pages, real-dark verify (`verify_h`), the unchanged walk.py and feat_g2.py on a `--prices` variant (`variant.py`), wording scans (`textscan.py`, `acl2.py`), home acceptance (`accept.py`), persona clicks (`persona.py`), switch variants (`flags_h.py`), catalog bomLines (`catlines.py`), new-family CAD (`cadnew.py`, `cadclick.py`), screenshots (`shots_h.py`) and the source hard-rule scan (`static_h.py`).

## 18. Owner changes 2026-10-01 (out_i): supplier wording, catalog-line ship dates, catalog-extension quote lines

Report: `FINAL4.md`. Pre-edit copies: `out_i/work/before/` (base.html, build.py, src/, catalog/, test.py, cdtest.py, corpus.json, INTERFACE.md, holdout.py, ui_check.py, interact.py = the out_h state; deployed page md5 `c5046344…` also at `out_i/page.before.html`). Everything is re-made by `out_i/work/rebuild_i.sh [out.html]`: `gen_cat_i.py` → `ed_i.py` → `ed_tests_i.py` → `build.py --check` → build. **Do not run `out_h/work/rebuild.sh` any more**: it starts from the pre-out_h copies and would drop these changes.

**1. No supplier-agreement wording.** Visible text never says 협력 (no supplier agreements exist yet). Labels: `BOM_TIER.PARTNER_STOCK.label` = `'도매처 재고'` (was 협력사 재고), `MRO_BACKUP.label` = `'도매처 수배'`, base `LEAD_TIER` key `'도매처 재고'` (v1_bom `bomInchCatNote` reads it), catalog tier label `국내 유통처 조달` (`gen_cat_i.py` TIER_KO; was 협력 유통처 조달), trust/about/c-pages `국내 도매처` (was 협력 도매처), `국내 가공업체`, `외부 코팅업체`, `제작을 맡은 업체/제조사` (was 협력 가공업체 / 협력 코팅업체 / 협력 제조사), `공급처 포장`. C&D English: `CD_TIER_EN.PARTNER_STOCK` = `'Wholesaler stock'`, `MRO_BACKUP` = `'Wholesaler sourcing'`, '(or the shop making the part)'. Code identifiers (`PARTNER_STOCK`, `MRO_BACKUP`, `tierCode`) are unchanged. `ed_i.py` fails if '협력', '바로 공급' or English 'partner' remains anywhere in base.html or src/; `static_i.py` / `textscan_i.py` check the built page.

**2. Catalog lines are not stock-ready supply.** Engine status `'catalog'` is labelled `'카탈로그 품목'` (`BOM_ST`; was 바로 공급) in 4A (tab, rows, detail), 4A-1 (견적서 section 1), mail text and exports. One wording constant in the engine block: `BOM_SHIP_TBD = '출고일은 공급처 확인 후 확정'` (e7s_supply.js). Catalog lines show it instead of a date unless the line's tier is `OWN_STOCK` (off while `OWN_STOCK = false`):
- `m.lead.text` (catalog): `'도매처 재고 확인 후 출고 (예상 1–2영업일) · 출고일은 공급처 확인 후 확정'` (MRO: `… 포함 예상 n–m영업일 출고 · …`). Ranges say '예상'.
- views (v1_bom.js): `bomShipOk(leads)` (all OWN_STOCK with a date), `bomCatShipTxt(sum, fmt)` (4A summary footer, 견적서 납품기한, xlsx/TSV '납기' row), `bomLatestTxt(doc)` (준수 요약 '카탈로그 품목 출고', screen + xlsx); `bomSummary()` adds `shipOk`; `bomLeadTxt` (4A row meta, 견적서 비고) and the export column '출고·회신 예정' use BOM_SHIP_TBD.
- C&D `K-LEAD` (customer required date): a non-own-stock catalog line says `요구 납기 {req} → 출고일은 공급처 확인 후 확정 ({tier})` (params `tbd`, `canKo`, `canEn`; no date params); engineer-quote lines keep `가능 납기 {date}`. `imp.leadNote` follows.
- Internal dates are still computed: `m.ship`, `m.leadDays`, `m.lead.shipDate`, C&D `doc.lines[].lead.shipDate`, `compliance.lead.latest` (cdtest 10.3 / 10.1 read them). The QuoteRevision snapshot (JSON export) writes `shipDate` only for OWN_STOCK lines (null otherwise; `cdQuoteDiff` does not compare it).

**3. Catalog-extension lines are quote lines (`src/ea_catalog.hooks.json`, written by `ed_i.py`).** Lines the engine reads as `pin`, `ring`, `key`, `rivet`, `insert`, `discspring`, `clinch` or the variant `rivetnut` are `engineer-quote` with the single warn reason `BOM_CAT_WHY = '카탈로그 품목 · 사양 확인 후 견적'` (event `K-EQ {why: 'item', item: 'cat-<type>'}`) plus an info reason `BOM_CAT_EXT[k]` ('확인할 것: …'). `bomCatFamOf(q, k)` maps the line to a catalog family id (CAT_F; taxonomy engineRules + standard numbers; null when ambiguous) → `m.catFam`, `m.family` (= family Korean name). Name helpers (e1n_names.js): `bomCatF(m)`, `bomEnLine(x)` → `{ko, en}` of the family when `m.catFam` (C&D `doc.lines[].name`, quote 품명 `<ko> / <en>`, 4A detail 품명, 견적함 quote line title/en), `bomEnMatch(m)` → the family `{ko, en, std}` for catFam lines too (4A `.wb-en` + std tag, detail '카탈로그 품목'). O-ring, gasket, pipe, valve, tool, non-fastener and the proprietary wedge-lock washer (`wedgelock` variant) stay not-available. Lines the engine does not recognise as these types (e.g. '분할핀 3.2*25', 'E-RING DIN 6799 - 6', '클린칭너트 M4' read as a hex nut) are unchanged (recognition is a later CAT_REFINE step).
New top-level names (do not redeclare): `BOM_SHIP_TBD` (e7s), `bomCatF` (e1n), `BOM_CAT_WHY`, `BOM_CAT_EXT`, `bomCatFamOf` (e7_status via hook), `bomShipOk`, `bomCatShipTxt`, `bomLatestTxt` (v1).

**Tests:** `out_i/work/run_all_i.sh <outdir> [base]` = run_all_h.sh with out_i copies `ui_check_i` (label 카탈로그 품목), `behave2_i` (label 도매처 재고), `catlines_i` (baseline `out_i/work/catlines_pass.json`, family report), `textscan_i`/`static_i` (협력, 바로 공급, partner banned), plus `x_catfam` (`catfam_i.py`: corpus families, more extension lines, non-fasteners stay NA, K-LEAD / JSON ship dates, lead text) and `x_rscan` (`rscan.py --all`: rendered text of home, products, about, help, i-b7, cart, a mixed 6-line BOM in 4A/4A-1 with every document tab, the send sheet, the exports, then every other route). Expectation changes: `test.py` tier label list ('도매처 재고'); `corpus.json` line 121 (PEM clinch) not-available → engineer-quote and a new `family` key on lines 121–125, 128, 134, 136 (checked by catfam_i.py; test.py ignores it).
