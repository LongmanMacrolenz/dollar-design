/* Original orthographic study of the film's stud/nut set. Symbolic dimensions
   are deliberately not manufacturing values. Thread notation reuses the library. */
function bnSourcingDrawing(prefix='bn-sourcing') {
  return `<svg class="bn-sourcing-sheet bn-blueprint" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="스터드 측면·끝면과 헤비너트 정면·단면의 형상 참고도. 길이와 너트 치수는 고객 도면으로 확인합니다.">
    <defs>
      <marker id="${prefix}-arrow" viewBox="0 0 8 6" refX="4" refY="3" markerWidth="6" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L8 3L0 6Z" fill="#547565"/></marker>
      <pattern id="${prefix}-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 7L7 0M5 9L9 5" fill="none" stroke="#84988c" stroke-width=".65"/></pattern>
    </defs>
    <rect width="640" height="400" fill="#eef1eb"/>
    <g fill="none" stroke="#c7d1c8" stroke-width=".8"><path d="M24 60H616M24 355H616M24 24H616V376H24ZM440 76V341M462 220H594"/></g>
    <g fill="#304b3d" font-family="monospace"><text x="32" y="45" font-size="12" letter-spacing="1.5">BOLTNOTE / SPECIFICATION STUDY</text><text x="32" y="376" font-size="9">FORM REFERENCE · NTS · SYMBOLIC DIMENSIONS</text><text x="572" y="45" font-size="11">01—02</text></g>
    <g fill="none" stroke="#20392c" stroke-width="1.8" stroke-linejoin="round">
      <path d="M123 126H335L341 132V172L335 178H123L117 172V132Z"/>
      <circle cx="65" cy="152" r="26"/>
      <path d="M126 130H332M126 174H332" stroke-width=".8"/>
      <path d="M87.5 152A22.5 22.5 0 1 1 65 129.5" stroke-width=".8"/>
      <path d="M531 89L574.3 114V164L531 189L487.7 164V114Z"/>
      <circle cx="531" cy="139" r="22.5"/>
      <path d="M557 139A26 26 0 1 1 531 113" stroke-width=".8"/>
      <path d="M501 249L508 241H545L552 249V318L545 326H508L501 318Z" fill="url(#${prefix}-hatch)"/>
      <path d="M501 262H552V305H501" fill="#eef1eb" stroke-width="1.5"/>
      <path d="M501 258H552M501 309H552" stroke-width=".7"/>
    </g>
    <g fill="none" stroke="#90a195" stroke-width=".65" stroke-dasharray="14 3 2 3"><path d="M30 152H384M65 111V195M475 139H587M531 83V195M480 284H571"/></g>
    <g fill="none" stroke="#547565" stroke-width=".8">
      <path d="M117 184V235M341 178V235M34 126H24M34 178H24M481 114H474M481 164H474M501 333V348M552 326V348"/>
      <path d="M117 225H341M26 126V178M474 114V164M501 341H552" marker-start="url(#${prefix}-arrow)" marker-end="url(#${prefix}-arrow)"/>
      <path d="M314 130L351 100H412M549 155L581 197H596"/>
    </g>
    <g fill="#547565" font-family="monospace" font-size="12"><text x="227" y="218">L</text><text x="18" y="154" transform="rotate(-90 18 154)">d</text><text x="465" y="142">s</text><text x="522" y="337">m</text></g>
    <g fill="#2e4b3b" font-family="monospace" font-size="11"><text x="133" y="88">3/4″–10 UNC–2A</text><text x="464" y="211">UNC–2B</text></g>
    <g fill="#536b5c" font-family="sans-serif" font-size="10"><text x="44" y="256">끝면</text><text x="184" y="256">스터드 · 측면</text><text x="482" y="232">헤비너트 · 정면</text><text x="485" y="351">나사 구멍 · 단면</text></g>
    <g fill="#294b38" font-family="sans-serif"><text x="43" y="294" font-size="15" font-weight="600">형상을 보고, 표기를 읽습니다.</text><text x="43" y="320" font-size="11">길이 · 짝 너트 · 표면처리 · 서류 조건은 함께 확인합니다.</text></g>
  </svg>`;
}
