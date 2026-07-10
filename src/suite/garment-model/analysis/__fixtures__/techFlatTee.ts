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

/** A hooded zip jacket flat exercising the fuller taxonomy: body, sleeves, hood, zipper,
 *  waistband, two pockets, two cuffs. */
export const HOODED_JACKET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560">
  <path d="M 120 152 L 64 182 L 56 340 L 108 340 L 122 188 Z" fill="#fff" stroke="#111"/>
  <path d="M 280 152 L 336 182 L 344 340 L 292 340 L 278 188 Z" fill="#fff" stroke="#111"/>
  <path d="M 120 140 L 280 140 L 286 300 L 280 440 L 120 440 L 114 300 Z" fill="#fff" stroke="#111"/>
  <path d="M 135 150 L 200 68 L 265 150 L 255 175 L 145 175 Z" fill="#eee" stroke="#111"/>
  <path d="M 197 165 L 203 165 L 203 430 L 197 430 Z" fill="#333" stroke="#111"/>
  <path d="M 95 444 L 305 444 L 305 472 L 95 472 Z" fill="#ddd" stroke="#111"/>
  <path d="M 135 345 L 185 345 L 185 405 L 135 405 Z" fill="#fff" stroke="#111"/>
  <path d="M 215 345 L 265 345 L 265 405 L 215 405 Z" fill="#fff" stroke="#111"/>
  <path d="M 58 334 L 106 334 L 106 350 L 58 350 Z" fill="#eee" stroke="#111"/>
  <path d="M 294 334 L 342 334 L 342 350 L 294 350 Z" fill="#eee" stroke="#111"/>
</svg>`
