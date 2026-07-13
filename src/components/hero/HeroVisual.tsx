// Imported so Vite fingerprints the file — busts caches on every update.
import heroProduct from '../../assets/hero-product.png'

/**
 * Hero product render — a transparent cutout of the all-black collection,
 * floating on a CSS spotlight + glowing platform so it melts into the page
 * with no image box.
 */
export function HeroVisual() {
  return (
    <div
      className="hero-visual"
      aria-label="loom studios Kollektion: schwarzer Hoodie, T-Shirt, Cargohose und Cap im Spotlight"
    >
      <div className="hero-visual__stage">
        <img
          className="hero-visual__img"
          src={heroProduct}
          alt="loom studios Kollektion – Hoodie, T-Shirt, Cargohose und Cap in Schwarz, dramatisch beleuchtet"
          width={1536}
          height={1024}
          loading="eager"
          decoding="async"
          {...({ fetchpriority: 'high' } as Record<string, string>)}
        />
      </div>
    </div>
  )
}
