import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { IcoPlus, IcoSparkle } from '../../components/ui/Icons'
import { useMarketing } from '../../marketing/useMarketing'
import { useMkProducts } from '../../marketing/useMkProducts'
import { mkId } from '../../marketing/marketingStore'

/** Campaigns — organize marketing per drop/season: products + characters + generated content. */
export function MkCampaigns() {
  const t = useT()
  const navigate = useNavigate()
  const { meta, update } = useMarketing()
  const { products } = useMkProducts()
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')

  const open = meta.campaigns.find((c) => c.id === openId) ?? null

  function create() {
    if (!name.trim()) return
    const camp = { id: mkId('camp'), name: name.trim(), goal: goal.trim(), productIds: [], characterIds: [], contentIds: [], createdAt: Date.now() }
    update((m) => ({ ...m, campaigns: [camp, ...m.campaigns] }))
    setCreating(false)
    setName('')
    setGoal('')
    setOpenId(camp.id)
  }

  function toggle(campId: string, field: 'productIds' | 'characterIds', id: string) {
    update((m) => ({
      ...m,
      campaigns: m.campaigns.map((c) =>
        c.id === campId ? { ...c, [field]: c[field].includes(id) ? c[field].filter((x) => x !== id) : [...c[field], id] } : c,
      ),
    }))
  }

  function remove(campId: string) {
    if (!window.confirm(t('mk.camps.confirmDelete'))) return
    update((m) => ({ ...m, campaigns: m.campaigns.filter((c) => c.id !== campId) }))
    if (openId === campId) setOpenId(null)
  }

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.camps.head')}</h2>
          <p>{t('mk.camps.sub')}</p>
        </div>
        <button type="button" className="s-btn s-btn--accent" onClick={() => setCreating(true)}>
          <IcoPlus width="15" height="15" /> {t('mk.camps.cta')}
        </button>
      </div>

      {creating && (
        <div className="mst-campdetail">
          <h3>{t('mk.camps.newTitle')}</h3>
          <div className="mst-form">
            <label className="mst-field">
              <span>{t('mk.camps.name')}</span>
              <input type="text" value={name} maxLength={60} placeholder={t('mk.camps.namePh')} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <label className="mst-field">
              <span>{t('mk.camps.goal')}</span>
              <input type="text" value={goal} maxLength={120} placeholder={t('mk.camps.goalPh')} onChange={(e) => setGoal(e.target.value)} />
            </label>
          </div>
          <div className="mst-modal__foot">
            <button type="button" className="s-btn s-btn--subtle" onClick={() => setCreating(false)}>{t('mk.cancel')}</button>
            <button type="button" className="s-btn s-btn--accent" disabled={!name.trim()} onClick={create}>{t('mk.create')}</button>
          </div>
        </div>
      )}

      {meta.campaigns.length === 0 && !creating ? (
        <div className="mst-empty">
          <b>{t('mk.camps.emptyTitle')}</b>
          <p>{t('mk.camps.emptyBody')}</p>
          <button type="button" className="s-btn s-btn--accent" onClick={() => setCreating(true)}>
            <IcoPlus width="15" height="15" /> {t('mk.camps.cta')}
          </button>
        </div>
      ) : (
        <div className="mst-camps">
          {meta.campaigns.map((c) => (
            <button key={c.id} type="button" className={`mst-camp${openId === c.id ? ' is-open' : ''}`} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
              <b>{c.name}</b>
              {c.goal && <small>{c.goal}</small>}
              <span className="mst-camp__counts">
                <span><b>{c.productIds.length}</b> {t('mk.camps.products')}</span>
                <span><b>{c.characterIds.length}</b> {t('mk.camps.characters')}</span>
                <span><b>{meta.content.filter((x) => x.campaignId === c.id).length}</b> {t('mk.camps.content')}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="mst-campdetail">
          <div className="mst-sec__head">
            <h3>{open.name}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="s-btn s-btn--accent" onClick={() => navigate(`/marketing/generate?camp=${open.id}`)}>
                <IcoSparkle width="14" height="14" /> {t('mk.camps.generate')}
              </button>
              <button type="button" className="mst-char__del" aria-label={t('mk.delete')} onClick={() => remove(open.id)}>×</button>
            </div>
          </div>

          <h3>{t('mk.camps.assignProducts')}</h3>
          {products.length === 0 ? (
            <p className="mst-note">{t('mk.products.emptyTitle')}</p>
          ) : (
            <div className="mst-minis">
              {products.map((p) => (
                <button key={p.id} type="button" className={`mst-mini${open.productIds.includes(p.id) ? ' is-on' : ''}`} aria-pressed={open.productIds.includes(p.id)} onClick={() => toggle(open.id, 'productIds', p.id)}>
                  {p.image && <img src={p.image} alt="" />}
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <h3>{t('mk.camps.assignCharacters')}</h3>
          {meta.characters.length === 0 ? (
            <p className="mst-note">{t('mk.chars.emptyTitle')}</p>
          ) : (
            <div className="mst-minis">
              {meta.characters.map((c) => (
                <button key={c.id} type="button" className={`mst-mini${open.characterIds.includes(c.id) ? ' is-on' : ''}`} aria-pressed={open.characterIds.includes(c.id)} onClick={() => toggle(open.id, 'characterIds', c.id)}>
                  {c.avatar && <img src={c.avatar} alt="" />}
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
