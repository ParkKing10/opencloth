import { Cube, Doc, Factory, Users } from '../ui/Icons'
import './stats.css'

const STATS = [
  { icon: Users, value: '10.000+', label: 'Creator weltweit' },
  { icon: Cube, value: '250.000+', label: 'Designs erstellt' },
  { icon: Doc, value: '50.000+', label: 'Tech Packs erstellt' },
  { icon: Factory, value: '1.000+', label: 'Hersteller & Partner' },
]

export function Stats() {
  return (
    <section className="stats" aria-label="loom studios in Zahlen">
      <div className="shell stats__grid">
        {STATS.map(({ icon: Icon, value, label }) => (
          <article className="stat" key={label}>
            <span className="stat__icon" aria-hidden="true">
              <Icon width="24" height="24" />
            </span>
            <div className="stat__body">
              <p className="stat__value">{value}</p>
              <p className="stat__label">{label}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
