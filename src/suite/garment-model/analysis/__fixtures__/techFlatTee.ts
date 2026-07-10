/**
 * A hand-authored technical-flat SVG (front view of a tee): body + left/right sleeves + collar +
 * four buttons down the centre. Used by unit tests AND droppable in the browser to prove the whole
 * import pipeline end-to-end. Kept as a TS string so tests can import it without file I/O.
 */
export const TECH_FLAT_TEE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <g>
    <path d="M 130 130 L 70 165 L 60 305 L 112 305 L 128 168 Z" fill="#ffffff" stroke="#111111" stroke-width="2"/>
    <path d="M 270 130 L 330 165 L 340 305 L 288 305 L 272 168 Z" fill="#ffffff" stroke="#111111" stroke-width="2"/>
    <path d="M 130 120 L 270 120 L 276 300 L 268 482 L 132 482 L 124 300 Z" fill="#ffffff" stroke="#111111" stroke-width="2"/>
    <path d="M 168 122 L 200 104 L 232 122 L 224 140 L 176 140 Z" fill="#eeeeee" stroke="#111111" stroke-width="2"/>
    <circle cx="200" cy="180" r="6" fill="#1a1a20"/>
    <circle cx="200" cy="250" r="6" fill="#1a1a20"/>
    <circle cx="200" cy="320" r="6" fill="#1a1a20"/>
    <circle cx="200" cy="390" r="6" fill="#1a1a20"/>
    <path d="M 200 150 L 200 470" fill="none" stroke="#111111" stroke-width="1" stroke-dasharray="4 3"/>
  </g>
</svg>`
