# Boltnote identity

Original B monogram: a six-sided fastener silhouette with two machined counterspaces. Orange `#F15A38`; navy `#142234`; white reverse wordmark for dark backgrounds.

The wordmark uses outlined Manrope ExtraBold (800), licensed under the included SIL Open Font License. There is no external font dependency in the SVGs. The logo is a new original design, not an existing company mark.

Source assets are kept here. `site/build_brand.py` copies them into `docs/brand/`; do not edit the deployed copies. Social card source is `boltnote-social.png` (1280 × 720); its browser-rendering layout is `social.html`: the home headline in Hahmlet (SIL OFL, from Google Fonts) over the tightening-scene poster `docs/media/boltnote-tighten-poster.webp`, with the note 「참고용 렌더링 · 실제 제품 사진 아님」. Re-render with `python3 tools/render_brand.py` (it refuses a card drawn with fallback fonts or with copy that differs from the home), then raise `?v=` in `site/catalog.py` `SOCIAL_IMAGE` so messengers that cache previews by address fetch the new picture.

`boltnote-intro.pdf` is the one-page A4 introduction attached to first-contact mail (linked from `/admin/mail.html`). It has no hand-edited source: `python3 tools/render_intro.py` draws it from the home copy (`BN_TIGHTEN`), the four work steps (`PM_STEPS`) and the public contact details, and refuses a page drawn with fallback fonts or one whose text overlaps the contact box. Re-run it after that copy or the contact details change. It states no stock, price, lead-time, reference or certification claims and no street address.
