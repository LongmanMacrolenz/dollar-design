# 견적서 도구 (대표 전용)

메일로 받은 RFQ를 사이트(#quote) 견적서 양식 그대로 PDF로 만들고, 보낼 메일 문안과 내부 원가표까지 한 번에 만듭니다.
2026-11-09 견적 1호(코일 스프링핀, 해외 소량 조달)를 만들 때 쓴 절차를 도구로 옮긴 것입니다.

```bash
npm ci                              # 처음 한 번 (playwright 포함)
npx playwright install chromium     # 처음 한 번: PDF를 만들 브라우저 (무료)
python3 tools/build_all.py          # docs/index.html 이 최신이어야 사이트 양식·함수를 그대로 씁니다

cp tools/quote/local.example.json tools/quote/local.json   # 입금계좌·업태·종목 (git 무시)
cp tools/quote/example.json tools/quote/out/BNQ-YYYYMMDD-XX.json   # 입력을 복사해 채웁니다 (out/ 는 git 무시)
node tools/quote/make_quote.mjs tools/quote/out/BNQ-YYYYMMDD-XX.json
node tools/quote/make_quote.mjs 입력.json --no-pdf          # 숫자만 먼저 확인할 때 (브라우저 없이)
```

## 만들어지는 것 (`tools/quote/out/`)

| 파일 | 누구에게 | 내용 |
|---|---|---|
| `<번호>.pdf` | 고객 | 옵션 전체가 든 견적서 (A4) |
| `<번호>-<옵션>.pdf` | 고객 | 옵션이 둘 이상일 때 옵션 하나씩만 든 견적서 (고객이 한 옵션만 원할 때) |
| `<번호>…_메일.txt` | 고객 | 받는 사람·제목·본문. 메일에 붙여 넣고 PDF를 첨부합니다 |
| `<번호>_내부원가.txt` | **대표만** | 매입 수량·원가·관세·이익률. 고객에게 보내지 않습니다 |
| `<번호>.calc.json` | 대표 | 계산 결과 원본 |

`out/`와 `local.json`은 git이 무시합니다. 고객 이름·메일·매입 조건·계좌는 저장소에 올리지 않습니다(AGENTS.md 7번·9번).

## 입력 JSON

`example.json`을 복사해 채웁니다. 모든 가격은 **원가(매입가)** 이고, 판매가는 도구가 계산합니다.

- `number`, `rev`, `issued`(YYYY-MM-DD), `validDays`(기본 14) 또는 `validUntil`
- `customer`: `name`(수신), `attn`(참조), `email`, `subject`(건명)
- `pricing`
  - `marginPct` 이익률 % (공급가액 기준). 판매가 = 원가 ÷ (1 − 이익률), 줄 단가는 원 단위 올림. 사이트 기본은 원가 × 1.20(≈16.7%)이고, 해외 소량 조달은 25%를 썼습니다.
  - `fx`: 통화별 환율 (`{"USD": 1400}`). 대표가 정한 값을 적습니다.
  - `dutyPct` 관세율 %, `clearanceFeeKRW` 통관·정산 수수료, `domesticShipKRW` 국내 배송비. **해외 매입(KRW가 아닌 통화) 줄과 해외 운송비에만** 관세가 붙습니다. 수입 부가세는 매입세액 공제라 원가에 넣지 않습니다.
- `lead`: `days`, `maxDays`, `basis`. 비우면 "견적서 회신 때 확정"으로 나옵니다. 납기를 약속할 수 있을 때만 적습니다.
- `shipping`(선택): `foreign: {amount, currency}` 해외 운송비, `krw` 기타 국내 비용, `label`, `remark`. 있으면 **운임·통관 줄 1회**로 들어가고 단가에는 섞이지 않습니다. 옵션이 여럿이어도 1회만 부과한다는 문장이 자동으로 붙습니다.
- `options[]`: `key`(A, B…), `title`, `mat`, `fin`(옵션 공통 재질·표면처리), `lines[]`
  - 줄: `name`, `nameEn`, `spec`, `std`(적용규격), `origin`(기본 "발주 후 통보"), `unit`(기본 EA), `qty`, `note`, 줄별 `mat`·`fin`
  - `buy`: `pack`(포장 단위), `price`(포장당 매입가), `currency`(기본 KRW). 수량을 포장 단위로 올림해 매입하고, 남는 수량은 내부 원가표에 적힙니다.
- `notes[]`: 특기사항 앞부분. 운임·합계·납기·서류·VAT 문장은 자동으로 뒤에 붙습니다(`"autoNotes": false`로 끌 수 있음).
- `terms`: 조건표 덮어쓰기 (`{"납품장소": "…"}`). 기본은 사이트 SHOP_TERMS와 같은 선입금·세금계산서 조건.
- `mail`: `intro`, `extra[]`, `payment` 문장.
- `pdf`: `scale`(옵션 전체본, 기본 0.9), `singleScale`(옵션별 본, 기본 0.8). 표가 2쪽으로 넘어가면 줄입니다.
- `revisions[]`: `{rev, date, desc}`. 재발행 때 적습니다.

공급자 칸의 사업자등록번호·상호·대표·전화·이메일은 사이트 원본(`site/page.html`의 `SHOP`·`CONTACT`)에서 읽고, 업태·종목·입금계좌는 `local.json`에서 읽습니다.

## 보내기 전에 확인

1. `_내부원가.txt`의 이익률과 "남는 수량"을 봅니다. 관세율·통관수수료·운송비가 **가정값이면 실제 청구액으로 바꿔 다시 만듭니다.**
2. PDF를 열어 표가 끊기지 않는지, 합계 = 줄 공급가액 합 + 운임 줄, 부가세 = 공급가액 × 10% 반올림인지 봅니다.
3. 메일 문안의 받는 사람·첨부 파일명을 확인하고, 내부 원가표는 첨부하지 않습니다.
4. 사이트 규칙(AGENTS.md 3번): 고객 문서에 공급처 이름·재고·납기 약속을 지어 쓰지 않습니다. 납기는 지킬 수 있는 값만 적습니다.

## 계산 규칙 (사이트와 같음)

- 줄 원가 = 포장 수 × 포장당 매입가 × 환율 (+ 해외면 관세). 줄 판매가 = 올림(원가 ÷ (1 − 이익률)), 단가 = 올림(줄 판매가 ÷ 수량), 공급가액 = 단가 × 수량.
- 운임·통관 줄 원가 = 해외 운송비 × 환율 (+ 관세) + 통관수수료 + 국내 배송비. 판매가 = 올림(원가 ÷ (1 − 이익률)).
- 부가세 = 공급가액 합계(운임 포함) × 10% 반올림 1회. 줄 세액은 사이트의 `bomVatSplit`로 비율 배분(끝수는 나머지 큰 줄부터), 한글 금액은 `wonKo`. 둘 다 `app/src/e1m_money.js`의 함수 본문을 읽어 그대로 실행하므로 사이트와 어긋나지 않습니다. PDF 양식·CSS는 `docs/index.html`을 브라우저로 열어 씁니다.
