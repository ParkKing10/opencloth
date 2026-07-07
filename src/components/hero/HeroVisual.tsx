// Imported so Vite fingerprints the file — busts caches on every update.
import heroProduct from '../../assets/hero-product.png'

/**
 * Hero product render — spotlit all-black streetwear collection on a
 * reflective platform. Edges are masked so the studio backdrop melts into
 * the page background instead of showing a hard image box.
 */
export function HeroVisual() {
  return (
    <div
      className="hero-visual"
      aria-label="THREADOS Kollektion: schwarzer Hoodie, T-Shirt, Cargohose und Cap im Spotlight"
    >
      <div className="hero-visual__stage">
        <img
          className="hero-visual__img"
          src={heroProduct}
          alt="THREADOS Kollektion – Hoodie, T-Shirt, Cargohose und Cap in Schwarz, dramatisch beleuchtet"
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
