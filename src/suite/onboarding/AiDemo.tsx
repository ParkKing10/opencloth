/* ============================================================
   App tour — the KI-Designer live demo.
   A miniature of the real flow inside the tour card: a prompt
   types itself ("Daunenjacke mit ANSARI-Aufschrift rechts"),
   the AI "generates", and the finished piece fades in as a
   transparent-background preview. Pure theatre — no API calls.
   ============================================================ */

import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import jacketPng from './ai-demo-jacket.webp'

type Phase = 'typing' | 'generating' | 'done'

export function AiDemo() {
  const t = useT()
  const prompt = t('tour.ai.demoPrompt')
  const [chars, setChars] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')

  /* Time-based typewriter — throttled background tabs catch up in jumps
     instead of stalling. */
  useEffect(() => {
    const t0 = performance.now()
    const SPEED = 40 // ms per character
    const id = window.setInterval(() => {
      const n = Math.floor((performance.now() - t0) / SPEED)
      if (n >= prompt.length) {
        setChars(prompt.length)
        clearInterval(id)
        setPhase('generating')
      } else {
        setChars(n)
      }
    }, 40)
    return () => clearInterval(id)
  }, [prompt])

  /* A short "the AI is working" beat before the reveal. */
  useEffect(() => {
    if (phase !== 'generating') return
    const id = window.setTimeout(() => setPhase('done'), 1000)
    return () => clearTimeout(id)
  }, [phase])

  return (
    <div className="tour-demo">
      <div className="tour-demo__prompt">
        <span className="tour-demo__spark" aria-hidden="true">✦</span>
        <span className="tour-demo__text">
          {prompt.slice(0, chars)}
          {phase === 'typing' && <span className="tour-demo__caret" aria-hidden="true" />}
        </span>
      </div>
      <div className={`tour-demo__stage${phase === 'done' ? ' is-done' : ''}`}>
        {phase === 'generating' && (
          <span className="tour-demo__dots" aria-hidden="true">
            <i /><i /><i />
          </span>
        )}
        <img className="tour-demo__img" src={jacketPng} alt={t('tour.ai.demoAlt')} draggable={false} />
      </div>
    </div>
  )
}
