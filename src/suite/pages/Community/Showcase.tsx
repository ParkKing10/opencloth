import { useState } from 'react'
import { useT } from '@/i18n'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { IcoCheck } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { slugify } from '../../lib/download'
import './com.css'

/* The designer showcase — the retained (and trimmed) piece of the old community page.
   Follow/hire behave as before: local state + a real copy-to-clipboard hire mailto. */

type Category = 'Streetwear' | 'Outerwear' | 'Denim' | 'Techwear' | 'Knitwear' | 'Vintage'

type Designer = {
  id: string
  name: string
  initials: string
  role: string
  category: Category
  location: string
  followers: string
  projects: string
  verified: boolean
  grad: string
  thumbs: GarmentKind[]
}

export const DESIGNERS: Designer[] = [
  { id: 'd1', name: 'Mika Okafor', initials: 'MO', role: 'Streetwear Designer', category: 'Streetwear', location: 'Lagos, NG', followers: '18.4k', projects: '62', verified: true, grad: 'com-grad-1', thumbs: ['hoodie', 'tee', 'cap'] },
  { id: 'd2', name: 'Elias Vandt', initials: 'EV', role: 'Outerwear Specialist', category: 'Outerwear', location: 'Copenhagen, DK', followers: '11.2k', projects: '38', verified: true, grad: 'com-grad-3', thumbs: ['jacket', 'pants', 'hoodie'] },
  { id: 'd3', name: 'Sora Tanaka', initials: 'ST', role: 'Techwear Art Director', category: 'Techwear', location: 'Tokyo, JP', followers: '27.9k', projects: '84', verified: true, grad: 'com-grad-6', thumbs: ['jacket', 'cap', 'pants'] },
  { id: 'd4', name: 'Priya Raman', initials: 'PR', role: 'Knitwear & Textiles', category: 'Knitwear', location: 'Mumbai, IN', followers: '9.6k', projects: '41', verified: false, grad: 'com-grad-4', thumbs: ['tee', 'hoodie', 'cap'] },
  { id: 'd5', name: 'Diego Salas', initials: 'DS', role: 'Denim Developer', category: 'Denim', location: 'Mexico City, MX', followers: '14.1k', projects: '57', verified: true, grad: 'com-grad-5', thumbs: ['pants', 'jacket', 'tee'] },
  { id: 'd6', name: 'Nora Bennett', initials: 'NB', role: 'Vintage Revivalist', category: 'Vintage', location: 'London, UK', followers: '22.7k', projects: '73', verified: true, grad: 'com-grad-2', thumbs: ['hoodie', 'jacket', 'pants'] },
]

function IcoPin({ width = 13, height = 13 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s6-5.3 6-10a6 6 0 0 0-12 0c0 4.7 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  )
}

export function Showcase() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const [followed, setFollowed] = useState<Set<string>>(() => new Set())
  const [hired, setHired] = useState<Set<string>>(() => new Set())

  function toggleFollow(dz: Designer) {
    const nowFollowing = !followed.has(dz.id)
    setFollowed((prev) => {
      const next = new Set(prev)
      if (next.has(dz.id)) next.delete(dz.id)
      else next.add(dz.id)
      return next
    })
    toast(nowFollowing ? t('community.toast.following', { name: dz.name }) : t('community.toast.unfollowed', { name: dz.name }), nowFollowing ? 'success' : 'default')
  }

  // Copy an intro-request mailto so the user can actually reach the designer.
  async function hire(dz: Designer) {
    const subject = encodeURIComponent(t('community.hire.subject', { name: dz.name }))
    const from = user ? `${user.name} (${user.email})` : t('community.hire.member')
    const body = encodeURIComponent(
      t('community.hire.body', { name: dz.name.split(' ')[0], from, category: t(`community.cat.${dz.category}`) }),
    )
    const mailto = `mailto:${slugify(dz.name)}@makers.threados.app?subject=${subject}&body=${body}`
    try {
      await navigator.clipboard.writeText(mailto)
      setHired((prev) => new Set(prev).add(dz.id))
      toast(t('community.toast.hireCopied', { name: dz.name }), 'accent')
    } catch {
      toast(t('community.toast.hireFail'), 'info')
    }
  }

  return (
    <section className="com-sec" aria-label={t('community.designers.head')}>
      <div className="com-sechead">
        <div>
          <h2 className="com-sechead__title">{t('community.designers.head')}</h2>
          <p className="com-sechead__sub">{t('community.designers.sub')}</p>
        </div>
      </div>

      <div className="com-scroller">
        {DESIGNERS.map((dz) => {
          const Ghost = GARMENT_GLYPHS[dz.thumbs[0]]
          const isFollowing = followed.has(dz.id)
          const isHired = hired.has(dz.id)
          return (
            <article className="com-designer" key={dz.id}>
              <div className="com-designer__banner">
                <span className="com-designer__ghost" aria-hidden="true">
                  <Ghost width="112" height="112" />
                </span>
              </div>

              <div className="com-designer__top">
                <span className={`com-av com-av--lg ${dz.grad}`}>{dz.initials}</span>
                <div className="com-designer__ident">
                  <span className="com-designer__name">
                    {dz.name}
                    {dz.verified && (
                      <span className="com-verify" title={t('community.designer.verified')}>
                        <IcoCheck width="9" height="9" />
                      </span>
                    )}
                  </span>
                  <span className="com-designer__role">{dz.role}</span>
                </div>
              </div>

              <div className="com-designer__meta">
                <span><IcoPin />{dz.location}</span>
                <span><b>{dz.followers}</b> {t('community.designer.followers')}</span>
                <span><b>{dz.projects}</b> {t('community.designer.projects')}</span>
              </div>

              <div className="com-thumbs">
                {dz.thumbs.map((kind, i) => {
                  const Glyph = GARMENT_GLYPHS[kind]
                  return (
                    <span className="com-thumb" key={`${dz.id}-${kind}-${i}`} title={t('community.thumb.title', { kind })}>
                      <Glyph width="34" height="34" />
                    </span>
                  )
                })}
              </div>

              <div className="com-designer__actions">
                <button
                  type="button"
                  className={`s-btn s-btn--accent com-follow${isFollowing ? ' is-following' : ''}`}
                  aria-pressed={isFollowing}
                  title={isFollowing ? t('community.designer.unfollowTitle', { name: dz.name }) : t('community.designer.followTitle', { name: dz.name })}
                  onClick={() => toggleFollow(dz)}
                >
                  {isFollowing ? (<><IcoCheck width="14" height="14" /> {t('community.designer.following')}</>) : t('community.designer.follow')}
                </button>
                <button
                  type="button"
                  className={`s-btn s-btn--subtle com-hire${isHired ? ' is-hired' : ''}`}
                  title={isHired ? t('community.designer.hireTitleCopied', { name: dz.name }) : t('community.designer.hireTitle', { name: dz.name })}
                  onClick={() => void hire(dz)}
                >
                  {isHired ? (<><IcoCheck width="14" height="14" /> {t('community.designer.copied')}</>) : t('community.designer.hire')}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
