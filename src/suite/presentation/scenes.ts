// Presentation Mode — the scripted keynote timeline, expressed as data.
//
// The director (PresentationOverlay) reads this list and choreographs each scene by `kind`.
// Keeping scenes as declarative data makes the show trivial to reorder, extend or localise —
// add an entry here and the director handles the rest.

export type SceneKind =
  | 'intro' // Design Studio opens, cursor focuses the prompt
  | 'type' // realistic typing of the collection prompt
  | 'collection' // four garments generate + animate in
  | 'select' // zoom onto the hoodie
  | 'graphics' // four premium graphics animate in
  | 'drag' // the chosen graphic is dragged onto the hoodie
  | 'recolor' // premium colour transitions
  | 'mockup' // front / back / lifestyle / studio mockups
  | 'techpack' // tech-pack sections cascade in
  | 'manufacturers' // factories fade in on a map
  | 'complete' // return to dashboard, everything done

export type Scene = {
  id: number
  kind: SceneKind
  /** Big keynote caption. */
  title: string
  /** Supporting line under the caption. */
  subtitle: string
  /** Route to be on for this scene (the real app animates in behind the overlay). */
  route: string
  /** Extra beat to hold on the finished scene, in ms. */
  hold: number
}

export const SCENES: Scene[] = [
  { id: 1, kind: 'intro', title: 'Design Studio', subtitle: 'Where a collection begins.', route: '/suite/studio', hold: 900 },
  { id: 2, kind: 'type', title: 'Just describe it', subtitle: '“Create a luxury streetwear collection”', route: '/suite/studio', hold: 500 },
  { id: 3, kind: 'collection', title: 'A collection, in a second', subtitle: 'Four pieces, generated instantly.', route: '/suite/studio', hold: 1400 },
  { id: 4, kind: 'select', title: 'Focus the hoodie', subtitle: 'Every piece is fully editable.', route: '/suite/studio', hold: 900 },
  { id: 5, kind: 'graphics', title: 'Chrome tribal butterfly', subtitle: 'Four premium graphics, ready to place.', route: '/suite/studio', hold: 1400 },
  { id: 6, kind: 'drag', title: 'Place it', subtitle: 'Grab, move, snap — pixel perfect.', route: '/suite/studio', hold: 1000 },
  { id: 7, kind: 'recolor', title: 'Recolour instantly', subtitle: 'Black · White · Olive · Cream.', route: '/suite/studio', hold: 1200 },
  { id: 8, kind: 'mockup', title: 'Perfect mockups', subtitle: 'Front · Back · Lifestyle · Studio.', route: '/suite/studio', hold: 1400 },
  { id: 9, kind: 'techpack', title: 'Production-ready tech pack', subtitle: 'Every detail, done for you.', route: '/suite/tech-packs', hold: 1600 },
  { id: 10, kind: 'manufacturers', title: 'Manufacturer Hub', subtitle: 'Matched with world-class factories.', route: '/suite/manufacturers', hold: 1500 },
  { id: 11, kind: 'complete', title: 'From idea to production', subtitle: 'The entire workflow — in seconds.', route: '/suite', hold: 2600 },
]
