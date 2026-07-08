import './library-panels.css'

type MaterialSpec = { fabric: string; weight: string; composition: string }

type FabricCard = {
  name: string
  weight: string
  composition: string
  note: string
  isPopular?: boolean
}

const FABRICS: readonly FabricCard[] = [
  {
    name: 'Lightweight Jersey',
    weight: '240 GSM',
    composition: '100% Cotton',
    note: 'Soft summer tee',
  },
  {
    name: 'Midweight Twill',
    weight: '320 GSM',
    composition: '98% Cotton / 2% Elastane',
    note: 'Everyday structure',
  },
  {
    name: 'Heavy French Terry',
    weight: '450 GSM',
    composition: '80% Cotton / 20% Poly',
    note: 'The premium hoodie standard',
    isPopular: true,
  },
  {
    name: 'Ultra Fleece',
    weight: '520 GSM',
    composition: '100% Cotton',
    note: 'Luxury heavyweight',
  },
  {
    name: 'Ripstop',
    weight: '280 GSM',
    composition: '100% Cotton',
    note: 'Technical cargo',
  },
  {
    name: 'Waffle Knit',
    weight: '300 GSM',
    composition: '95% Cotton / 5% Elastane',
    note: 'Texture piece',
  },
]

function toSpec(fabric: FabricCard): MaterialSpec {
  return {
    fabric: `${fabric.name} ${fabric.weight}`,
    weight: fabric.weight,
    composition: fabric.composition,
  }
}

export function MaterialsPanel({ onApply }: { onApply: (m: MaterialSpec) => void }) {
  return (
    <section className="lib-panel" aria-label="Materials">
      <header className="lib-head">
        <h2>Materials</h2>
        <p className="lib-head__hint">Pick a fabric — specs update everywhere</p>
      </header>

      <div className="lib-scroll">
        <div className="lib-mats">
          {FABRICS.map((fabric) => (
            <button
              type="button"
              key={fabric.name}
              className="lib-mat"
              aria-label={`Apply ${fabric.name} ${fabric.weight}`}
              onClick={() => onApply(toSpec(fabric))}
            >
              <span className="lib-mat__row">
                <span className="lib-mat__name">{fabric.name}</span>
                {fabric.isPopular && <span className="lib-mat__pop">Popular</span>}
                <span className="lib-badge">{fabric.weight}</span>
              </span>
              <span className="lib-mat__comp">{fabric.composition}</span>
              <span className="lib-mat__note">{fabric.note}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
