/**
 * Marketing Studio engine — deterministic, on-device creative direction. Builds the image
 * prompts for photo shoots and keyframes, writes storyboard scripts from per-template beat
 * plans, and lays out 30-day content plans. Image RENDERING goes through the shared
 * imageProvider (Runware/OpenAI) — this module only writes the creative brief, so scripts and
 * plans work instantly and honestly even without an API key.
 */
import type { MkBrandKit, MkCharacter, MkContent, MkScene } from './marketingStore'
import type { MkTemplate } from './templates'

export type MkProductRef = { id: string; name: string; image?: string }

export type EngineCtx = {
  template: MkTemplate
  products: MkProductRef[]
  character?: MkCharacter
  prompt: string
  brand: MkBrandKit
}

/** Language of the generated SCRIPT copy (not the UI) — follows the character, defaults to EN. */
function lang(ctx: EngineCtx): 'en' | 'de' {
  return ctx.character?.language === 'de' ? 'de' : 'en'
}

function L(l: 'en' | 'de', en: string, de: string): string {
  return l === 'de' ? de : en
}

function productLine(ctx: EngineCtx): string {
  return ctx.products.map((p) => p.name).join(', ') || 'the new piece'
}

function heroProduct(ctx: EngineCtx): string {
  return ctx.products[0]?.name ?? 'the new piece'
}

function personaLine(c?: MkCharacter): string {
  if (!c) return 'a fashion model'
  return `${c.name}, ${c.age}, ${c.style.toLowerCase()}`
}

function toneLine(brand: MkBrandKit): string {
  return brand.tone ? `brand tone: ${brand.tone}` : 'confident, premium brand tone'
}

/* ── Photo prompts ─────────────────────────────────────────────────────────────────────── */

const STYLE_LOOKS: Record<string, string> = {
  studio: 'clean studio seamless backdrop, soft key light, controlled shadows',
  luxury: 'quiet-luxury set design, marble and glass, golden rim light, editorial polish',
  street: 'city street at dusk, neon reflections, candid documentary framing',
  minimal: 'minimalist negative space, single hard light, architectural composition',
  outdoor: 'natural outdoor light, overcast softness, environmental storytelling',
  gym: 'moody gym atmosphere, chalk dust in light beams, athletic energy',
  lifestyle: 'warm lived-in interior, morning window light, natural candid moment',
  editorial: 'high-fashion editorial, dramatic poses, magazine cover composition',
}

/** The full image prompt for a photo-shoot generation. */
export function buildPhotoPrompt(ctx: EngineCtx, style: string): string {
  const wear = ctx.character
    ? `worn by ${personaLine(ctx.character)} (match the reference person's face, hair and build exactly)`
    : 'presented product-first, no model'
  return [
    ctx.template.scaffold,
    `featuring ${productLine(ctx)} (match the reference garment exactly — fabric, colors, prints)`,
    wear,
    STYLE_LOOKS[style] ?? STYLE_LOOKS.studio,
    ctx.prompt.trim(),
    toneLine(ctx.brand),
    'photorealistic, professional fashion photography, no text, no watermark',
  ]
    .filter(Boolean)
    .join('. ')
}

/** Image prompt for one storyboard keyframe. */
export function buildKeyframePrompt(ctx: EngineCtx, scene: Pick<MkScene, 'title' | 'camera' | 'action'>): string {
  return [
    `cinematic film still, ${ctx.template.scaffold}`,
    `scene: ${scene.action}`,
    `camera: ${scene.camera}`,
    `featuring ${productLine(ctx)} (match the reference garment exactly)`,
    ctx.character ? `with ${personaLine(ctx.character)} (match the reference person exactly)` : '',
    ctx.prompt.trim(),
    'photorealistic, shallow depth of field, film grain, no text, no watermark',
  ]
    .filter(Boolean)
    .join('. ')
}

/* ── Storyboard beats ──────────────────────────────────────────────────────────────────── */

type Beat = (ctx: EngineCtx) => Omit<MkScene, 'keyframePrompt' | 'imageKey'>

const BEATS: Record<string, Beat> = {
  hook: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The hook', 'Der Hook'),
      camera: 'snap zoom to face, handheld',
      action: `${c.character?.name ?? 'The model'} looks straight into the lens holding ${heroProduct(c)}`,
      caption: L(l, `POV: you found the ${heroProduct(c)} everyone keeps asking about`, `POV: du hast ${heroProduct(c)} gefunden — alle fragen danach`),
    }
  },
  wear: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'On the body', 'Am Körper'),
      camera: 'full-body orbit, 24mm, slight low angle',
      action: `${c.character?.name ?? 'The model'} wears ${heroProduct(c)}, walking toward camera`,
      caption: L(l, 'the fit does the talking', 'der Fit spricht für sich'),
    }
  },
  detail: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The details', 'Die Details'),
      camera: 'macro rack focus across fabric',
      action: `Extreme close-up of the stitching, texture and hardware of ${heroProduct(c)}`,
      caption: L(l, 'look closer.', 'schau genauer hin.'),
    }
  },
  cta: (c) => {
    const l = lang(c)
    return {
      title: 'Call to action',
      camera: 'static tripod, product centered',
      action: `${heroProduct(c)} on a pedestal, logo fades in`,
      caption: L(l, 'link in bio — while it lasts', 'Link in Bio — solange verfügbar'),
    }
  },
  'selfie-intro': (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Selfie intro', 'Selfie-Intro'),
      camera: 'front camera, arm extended, natural light',
      action: `${c.character?.name ?? 'The creator'} talks to camera, package in hand`,
      caption: L(l, `okay so this just arrived… (${heroProduct(c)})`, `okay, das ist gerade angekommen… (${heroProduct(c)})`),
    }
  },
  tryon: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Try-on', 'Anprobe'),
      camera: 'mirror shot, phone visible, vertical',
      action: `First try-on of ${heroProduct(c)} in a bedroom mirror`,
      caption: L(l, 'not gonna lie, this is heavy quality', 'ehrlich — die Qualität ist krass'),
    }
  },
  'verdict-cta': (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Verdict', 'Fazit'),
      camera: 'front camera close-up',
      action: `${c.character?.name ?? 'The creator'} gives the final verdict, thumbs up`,
      caption: L(l, '10/10 — get it before it sells out', '10/10 — hol es dir, bevor es weg ist'),
    }
  },
  'mood-open': (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Mood opener', 'Mood-Opener'),
      camera: 'slow push-in, golden hour',
      action: `Atmospheric shot: ${heroProduct(c)} laid out with styling props`,
      caption: L(l, 'a moment for the new drop', 'ein Moment für den neuen Drop'),
    }
  },
  transition: (c) => {
    const l = lang(c)
    return {
      title: 'Transition',
      camera: 'whip pan / outfit-change cut on beat',
      action: `Outfit transition into ${productLine(c)}`,
      caption: L(l, 'wait for it…', 'wart’s ab…'),
    }
  },
  story: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The story', 'Die Story'),
      camera: 'B-roll montage, captions on screen',
      action: `Three fast scenes showing why ${heroProduct(c)} exists`,
      caption: L(l, 'we made this because nothing else fit right', 'wir haben das gebaut, weil nichts richtig saß'),
    }
  },
  payoff: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The payoff', 'Der Payoff'),
      camera: 'hero shot, slow motion, backlit',
      action: `${c.character?.name ?? 'The model'} in ${heroProduct(c)}, wind, confidence`,
      caption: L(l, 'this is the one.', 'das ist es.'),
    }
  },
  question: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The question', 'Die Frage'),
      camera: 'handheld street interview, mic in frame',
      action: `Interviewer asks a stranger: how much would you pay for ${heroProduct(c)}?`,
      caption: L(l, '"guess the price of this fit"', '„schätz mal, was der Fit kostet“'),
    }
  },
  reaction: (c) => {
    const l = lang(c)
    return {
      title: 'Reaction',
      camera: 'quick cuts between faces',
      action: 'Real reactions — surprised guesses, laughing, touching the fabric',
      caption: L(l, 'nobody guessed it right', 'keiner hat richtig geschätzt'),
    }
  },
  reveal: (c) => {
    const l = lang(c)
    return {
      title: 'Reveal',
      camera: 'light sweep across the product, deep shadow',
      action: `${heroProduct(c)} revealed from darkness, fabric texture catching the light`,
      caption: L(l, 'the real price will surprise you', 'der echte Preis überrascht'),
    }
  },
  before: (c) => {
    const l = lang(c)
    return {
      title: 'Before',
      camera: 'flat light, static, desaturated',
      action: 'The old basic outfit, plain wall, low energy',
      caption: L(l, 'before…', 'vorher…'),
    }
  },
  snap: () => ({
    title: 'The snap',
    camera: 'hard cut on the beat, flash frame',
    action: 'Finger snap / camera flash marks the transformation moment',
    caption: '⚡',
  }),
  after: (c) => {
    const l = lang(c)
    return {
      title: 'After',
      camera: 'saturated grade, dynamic low angle, wind',
      action: `Full transformation: ${personaLine(c.character)} in ${productLine(c)}`,
      caption: L(l, '…after. same person.', '…nachher. dieselbe Person.'),
    }
  },
  box: (c) => {
    const l = lang(c)
    return {
      title: 'The box',
      camera: 'top-down on table, hands enter frame',
      action: 'Branded package on the table, hands rotate it slowly',
      caption: L(l, 'it finally arrived', 'endlich da'),
    }
  },
  open: () => ({
    title: 'Opening',
    camera: 'macro on tape cut + tissue paper',
    action: 'Slow, satisfying opening — tissue paper, branded sticker, first glimpse',
    caption: 'ASMR 🔉',
  }),
  'tryon-cta': (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Try-on + CTA', 'Anprobe + CTA'),
      camera: 'mirror shot to camera, vertical',
      action: `First wear of ${heroProduct(c)}, spin, logo end-card`,
      caption: L(l, 'worth the wait — link in bio', 'das Warten wert — Link in Bio'),
    }
  },
  process: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The process', 'Der Prozess'),
      camera: 'documentary handheld, natural light',
      action: `Sketches, fabric rolls, fittings — the making of ${heroProduct(c)}`,
      caption: L(l, 'what it actually takes', 'was wirklich dahintersteckt'),
    }
  },
  craft: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The craft', 'Das Handwerk'),
      camera: 'macro on hands and machines',
      action: 'Needle through fabric, chalk lines, steam — craft close-ups',
      caption: L(l, 'every stitch on purpose', 'jede Naht mit Absicht'),
    }
  },
  human: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The people', 'Die Menschen'),
      camera: 'slow push-in on candid smiles',
      action: 'The team trying pieces on each other, honest laughter',
      caption: L(l, 'made by people who care', 'gemacht von Leuten, denen es was bedeutet'),
    }
  },
  atmosphere: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Atmosphere', 'Atmosphäre'),
      camera: 'slow dolly through haze, anamorphic flare',
      action: 'Dark set, single light source, silhouette waiting',
      caption: L(l, 'something is coming', 'etwas kommt'),
    }
  },
  'logo-cta': (c) => {
    const l = lang(c)
    return {
      title: 'End card',
      camera: 'static, centered, black background',
      action: `Logo resolve with ${heroProduct(c)} fading behind`,
      caption: c.brand.website || L(l, 'discover the collection', 'entdecke die Kollektion'),
    }
  },
  macro: (c) => {
    const l = lang(c)
    return {
      title: 'Macro',
      camera: 'probe lens through fabric folds',
      action: `Traveling macro across ${heroProduct(c)} — weave, zipper, print edges`,
      caption: L(l, 'obsessed with the details', 'besessen von den Details'),
    }
  },
  tease: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The tease', 'Der Teaser'),
      camera: 'extreme close-ups, nothing fully visible',
      action: `Fragments of ${productLine(c)} — a cuff, a seam, a shadow`,
      caption: L(l, 'you’re not ready', 'ihr seid nicht bereit'),
    }
  },
  lookbook: (c) => {
    const l = lang(c)
    return {
      title: 'Lookbook',
      camera: 'locked-off studio frames, hard flash',
      action: `Piece-by-piece looks: ${productLine(c)}`,
      caption: L(l, 'the collection, piece by piece', 'die Kollektion, Teil für Teil'),
    }
  },
  'hero-piece': (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Hero piece', 'Hero-Piece'),
      camera: 'slow-motion turn, backlit silhouette',
      action: `The signature piece — ${heroProduct(c)} — gets its own moment`,
      caption: L(l, 'the one everyone will want', 'das Teil, das alle wollen'),
    }
  },
  'date-cta': (c) => {
    const l = lang(c)
    return {
      title: 'Date card',
      camera: 'typography on texture close-up',
      action: 'Launch date types itself over fabric macro',
      caption: L(l, 'dropping friday — set a reminder', 'Drop am Freitag — Reminder setzen'),
    }
  },
  countdown: () => ({
    title: 'Countdown',
    camera: 'flash frames, 3…2…1 typography',
    action: 'Numbers slam on screen between product flashes',
    caption: '3… 2… 1…',
  }),
  flash: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Flash cuts', 'Flash-Cuts'),
      camera: 'strobe cuts, alternating angles',
      action: `Rapid cuts through ${productLine(c)} on and off body`,
      caption: L(l, 'new drop. no restock.', 'neuer Drop. kein Restock.'),
    }
  },
  'drop-cta': (c) => {
    const l = lang(c)
    return {
      title: 'Drop CTA',
      camera: 'static end card, bold type',
      action: 'Drop name + time, shaking slightly on the bass',
      caption: L(l, 'friday 7pm — be fast', 'Freitag 19 Uhr — sei schnell'),
    }
  },
  alarm: (c) => {
    const l = lang(c)
    return {
      title: 'Alarm',
      camera: 'screen-record style notification pop',
      action: 'Phone notification: FLASH SALE — screen lights up a dark room',
      caption: L(l, '🚨 48 hours only', '🚨 nur 48 Stunden'),
    }
  },
  offer: (c) => {
    const l = lang(c)
    return {
      title: 'Offer',
      camera: 'bold percentage typography over product',
      action: `Discount type slams over ${heroProduct(c)}`,
      caption: L(l, 'up to −40% on everything', 'bis zu −40% auf alles'),
    }
  },
  pieces: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The pieces', 'Die Teile'),
      camera: 'fast grid montage',
      action: `Quick montage of ${productLine(c)} with price tags`,
      caption: L(l, 'while stock lasts', 'solange der Vorrat reicht'),
    }
  },
  'urgency-cta': (c) => {
    const l = lang(c)
    return {
      title: 'Urgency CTA',
      camera: 'ticking clock overlay, end card',
      action: 'Countdown timer over the logo',
      caption: L(l, 'ends sunday midnight', 'endet Sonntag Mitternacht'),
    }
  },
  origin: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The origin', 'Der Anfang'),
      camera: 'interview frame, warm key light',
      action: `${c.character?.name ?? 'The founder'} tells how the brand started`,
      caption: L(l, 'it started in a bedroom', 'angefangen hat alles im Schlafzimmer'),
    }
  },
  struggle: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The struggle', 'Der Kampf'),
      camera: 'b-roll: late nights, rejected samples',
      action: 'Failed prototypes, packed boxes, screen glow at 2am',
      caption: L(l, 'nobody saw the 100 failed samples', 'die 100 gescheiterten Samples sah niemand'),
    }
  },
  'vision-cta': (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The vision', 'Die Vision'),
      camera: 'slow push-out from founder to full studio',
      action: 'The founder steps back, the new collection fills the frame',
      caption: L(l, 'this is just the beginning', 'das ist erst der Anfang'),
    }
  },
  problem: (c) => {
    const l = lang(c)
    return {
      title: 'Problem',
      camera: 'fast montage of frustration',
      action: 'Designers drowning in tools, files, deadlines',
      caption: L(l, 'making content used to take weeks', 'Content hat früher Wochen gedauert'),
    }
  },
  demo: (c) => {
    const l = lang(c)
    return {
      title: 'Demo',
      camera: 'clean UI screen capture, cursor choreography',
      action: 'One prompt typed, generation running, results appearing',
      caption: L(l, 'one prompt. done.', 'ein Prompt. fertig.'),
    }
  },
  wow: (c) => {
    const l = lang(c)
    return {
      title: 'Wow',
      camera: 'results grid zooms out to dozens of assets',
      action: 'The single result multiplies into a full campaign',
      caption: L(l, 'a full campaign in minutes', 'eine ganze Kampagne in Minuten'),
    }
  },
  prompt: (c) => {
    const l = lang(c)
    return {
      title: 'Prompt',
      camera: 'macro on keyboard + screen',
      action: `Typing: "${c.prompt.slice(0, 60) || 'luxury campaign, tokyo at night'}"`,
      caption: L(l, 'watch this', 'schau zu'),
    }
  },
  generate: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'Generating', 'Generierung'),
      camera: 'UI progress choreography, particles',
      action: 'The AI assembles the shot — layers snapping into place',
      caption: '…',
    }
  },
  result: (c) => {
    const l = lang(c)
    return {
      title: L(l, 'The result', 'Das Ergebnis'),
      camera: 'full-frame reveal of the generated shot',
      action: `Finished campaign visual of ${heroProduct(c)} fills the screen`,
      caption: L(l, 'no studio. no crew.', 'kein Studio. keine Crew.'),
    }
  },
}

const MUSIC: Record<string, string> = {
  volt: 'high-energy phonk / trap, 140 BPM, hard drop on scene 2',
  noir: 'cinematic strings + sub bass, slow build, sparse',
  blush: 'dreamy indie pop, light percussion, trending-audio feel',
  ocean: 'minimal electronic, clean synth pulse, product-launch energy',
  ember: 'dark drill / percussion-driven, urgent, ticking hats',
  jade: 'warm lo-fi with organic texture, documentary feel',
}

export type MkStoryboard = NonNullable<MkContent['script']>

/** Compose the full storyboard (script, scenes, voiceover, CTA, music) for a video template. */
export function buildStoryboard(ctx: EngineCtx): MkStoryboard {
  const l = lang(ctx)
  const beats = ctx.template.beats ?? ['hook', 'wear', 'detail', 'cta']
  const scenes: MkScene[] = beats.map((key) => {
    const beat = BEATS[key] ?? BEATS.hook
    const base = beat(ctx)
    return { ...base, keyframePrompt: buildKeyframePrompt(ctx, base) }
  })
  const voice = ctx.character ? `${ctx.character.voice}, ${ctx.character.language}` : L(l, 'neutral voice', 'neutrale Stimme')
  return {
    hook: scenes[0]?.caption ?? '',
    voiceover:
      L(l, `Voiceover (${voice}): `, `Voiceover (${voice}): `) +
      scenes.map((s) => s.caption).filter((c) => c && c.length > 2).join(' — '),
    cta: scenes[scenes.length - 1]?.caption ?? L(l, 'link in bio', 'Link in Bio'),
    music: MUSIC[ctx.template.look] ?? MUSIC.noir,
    scenes,
  }
}

/* ── 30-day content plan ───────────────────────────────────────────────────────────────── */

const PLAN_FORMATS = ['TikTok Hook', 'UGC Video', 'Instagram Reel', 'Story', 'Product Photo', 'Before/After', 'Unboxing', 'Behind the Scenes'] as const

const PLAN_IDEAS: ((product: string, l: 'en' | 'de') => { idea: string; hook: string })[] = [
  (p, l) => ({ idea: L(l, `Street styling: 3 ways to wear ${p}`, `Street-Styling: 3 Arten, ${p} zu tragen`), hook: L(l, 'which fit wins? 1, 2 or 3', 'welcher Fit gewinnt? 1, 2 oder 3') }),
  (p, l) => ({ idea: L(l, `Honest review of ${p} after 30 days`, `Ehrliches Review zu ${p} nach 30 Tagen`), hook: L(l, 'okay, real talk…', 'okay, Klartext…') }),
  (p, l) => ({ idea: L(l, `${p} vs. the expensive designer version`, `${p} vs. die teure Designer-Version`), hook: L(l, 'can you tell which is which?', 'erkennst du, welches welches ist?') }),
  (p, l) => ({ idea: L(l, `Fabric close-up ASMR of ${p}`, `Stoff-Close-up-ASMR von ${p}`), hook: L(l, 'turn your sound on 🔉', 'Ton an 🔉') }),
  (p, l) => ({ idea: L(l, `How we designed ${p} (process)`, `Wie wir ${p} designt haben (Prozess)`), hook: L(l, 'from sketch to street', 'vom Sketch auf die Straße') }),
  (p, l) => ({ idea: L(l, `Styling ${p} for a night out`, `${p} stylen für den Abend`), hook: L(l, 'date-night fit check', 'Date-Night Fit-Check') }),
  (p, l) => ({ idea: L(l, `What people think ${p} costs`, `Was Leute denken, was ${p} kostet`), hook: L(l, 'street price guessing', 'Preis-Schätzen auf der Straße') }),
  (p, l) => ({ idea: L(l, `Packing orders of ${p} (satisfying)`, `Bestellungen von ${p} packen (satisfying)`), hook: L(l, 'small brand things 📦', 'Small-Brand-Things 📦') }),
]

export function buildPlan(ctx: EngineCtx, days = 30): NonNullable<MkContent['plan']> {
  const l = lang(ctx)
  const products = ctx.products.length ? ctx.products : [{ id: 'x', name: L(l, 'your hero piece', 'dein Hero-Piece') }]
  return Array.from({ length: days }, (_, i) => {
    const product = products[i % products.length].name
    const { idea, hook } = PLAN_IDEAS[i % PLAN_IDEAS.length](product, l)
    return { day: i + 1, format: PLAN_FORMATS[i % PLAN_FORMATS.length], idea, hook }
  })
}
