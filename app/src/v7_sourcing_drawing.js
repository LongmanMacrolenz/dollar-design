/* Original orthographic study of the film's stud/nut set. Symbolic dimensions
   are deliberately not manufacturing values. Thread notation reuses the library. */
function bnSourcingDrawing(prefix='bn-sourcing') {
  return `<svg class="bn-sourcing-sheet bn-blueprint" viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="스터드 측면·끝면과 헤비너트 정면·단면의 형상 참고도. 길이와 너트 치수는 고객 도면으로 확인합니다.">
    <defs>
      <marker id="${prefix}-arrow" viewBox="0 0 8 6" refX="8" refY="3" markerWidth="6" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L8 3L0 6Z" fill="#547565"/></marker>
      <pattern id="${prefix}-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 7L7 0M5 9L9 5" fill="none" stroke="#84988c" stroke-width=".65"/></pattern>
    </defs>
    <rect width="640" height="400" fill="#eef1eb"/>
    <g fill="none" stroke="#c7d1c8" stroke-width=".8"><path d="M24 60H616M24 355H616M24 24H616V376H24ZM433 76V341M459 244H604"/></g>
    <g fill="#304b3d" font-family="monospace"><text x="32" y="45" font-size="12" letter-spacing="1.5">BOLTNOTE / SPECIFICATION STUDY</text><text x="32" y="376" font-size="9">FORM REFERENCE · NTS · SYMBOLIC DIMENSIONS</text><text x="572" y="45" font-size="11">01—02</text></g>
    <g fill="none" stroke="#20392c" stroke-width="1.8" stroke-linejoin="round">
      <path d="M130 135H380L387 142V182L380 189H130L123 182V142Z"/>
      <circle cx="65" cy="162" r="27"/>
      <path d="M134 140H376M134 184H376" stroke-width=".8"/>
      <path d="M88 162A23 23 0 1 1 65 139" stroke-width=".8"/>
      <path d="M527 95L570.3 120V170L527 195L483.7 170V120Z"/>
      <circle cx="527" cy="145" r="22.5"/>
      <path d="M553 145A26 26 0 1 1 527 119" stroke-width=".8"/>
      <!-- Aligned axial section: the bore runs vertically through both ends.
           s spans the opposite flats; m is the axial thickness, not bore width. -->
      <path d="M483.7 263L490.7 256H500.5L504.5 263V301L500.5 308H490.7L483.7 301Z" fill="url(#${prefix}-hatch)"/>
      <path d="M570.3 263L563.3 256H553.5L549.5 263V301L553.5 308H563.3L570.3 301Z" fill="url(#${prefix}-hatch)"/>
      <path d="M500.5 263V301M553.5 263V301" stroke-width=".7"/>
    </g>
    <g fill="none" stroke="#90a195" stroke-width=".65" stroke-dasharray="14 3 2 3"><path d="M31 162H410M65 117V204M465 145H590M527 85V201M527 246V323M475 282H579"/></g>
    <g fill="none" stroke="#547565" stroke-width=".8">
      <path d="M123 196V233M387 189V233M34 135H24M34 189H24M483.7 176V222M570.3 176V222M577 256H600M577 308H600"/>
      <path d="M123 224H387M26 135V189M483.7 218H570.3M594 256V308" marker-start="url(#${prefix}-arrow)" marker-end="url(#${prefix}-arrow)"/>
      <path d="M353 140L375 109H409M549 126L582 94H604"/>
    </g>
    <g fill="#547565" font-family="monospace" font-size="12"><text x="251" y="217">L</text><text x="18" y="164" transform="rotate(-90 18 164)">d</text><text x="523" y="212">s</text><text x="601" y="285">m</text></g>
    <g fill="#2e4b3b" font-family="monospace" font-size="12"><text x="139" y="96">3/4″–10 UNC–2A</text><text x="474" y="80">UNC–2B</text></g>
    <g fill="#536b5c" font-family="sans-serif" font-size="11"><text x="43" y="253">끝면</text><text x="198" y="253">스터드 · 측면</text><text x="476" y="232">헤비너트 · 정면</text><text x="478" y="335">나사 구멍 · 축 단면</text></g>
    <g fill="#294b38" font-family="sans-serif"><text x="43" y="294" font-size="17" font-weight="600">나사 표기부터, 짝 부품까지.</text><text x="43" y="321" font-size="12">길이 · 너트 등급 · 표면처리 · 서류를 함께 확인합니다.</text></g>
  </svg>`;
}
