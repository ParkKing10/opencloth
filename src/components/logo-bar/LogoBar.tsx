import './logo-bar.css'

/* Placeholder partner wordmarks — swap for real logo assets when available. */
const BRANDS = [
  { name: 'PEGADOR', style: 'italic' },
  { name: 'LIVE FAST.', style: 'condensed' },
  { name: 'REPRESENT', style: 'wide' },
  { name: 'DEF', style: 'bold' },
  { name: 'ELEVATE', style: 'light' },
  { name: 'MJGONZALES', style: 'italic' },
  { name: 'FUTURE', style: 'wide' },
] as const

export function LogoBar() {
  return (
    <section className="logo-bar" aria-label="Vertraut von Top Marken und Designern">
      <div className="shell logo-bar__inner">
        <p className="logo-bar__label">Vertraut von Top Marken &amp; Designern</p>
        <ul className="logo-bar__list">
          {BRANDS.map((brand) => (
            <li className={`logo-bar__brand logo-bar__brand--${brand.style}`} key={brand.name}>
              {brand.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
