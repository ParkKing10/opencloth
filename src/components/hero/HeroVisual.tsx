import { useT } from '@/i18n'
// Imported so Vite fingerprints the file — busts caches on every update.
import heroProduct from '../../assets/hero-product.png'

/**
 * Hero product render — a transparent cutout of the all-black collection,
 * floating on a CSS spotlight + glowing platform so it melts into the page
 * with no image box.
 */
export function HeroVisual() {
  const t = useT()
  return (
    <div
      className="hero-visual"
      aria-label={t('landing.heroVisual.ariaLabel')}
    >
      <div className="hero-visual__stage">
        <img
          className="hero-visual__img"
          src={heroProduct}
          alt={t('landing.heroVisual.alt')}
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
