import { useState } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import {
  IcoSettings,
  IcoGrid,
  IcoSparkle,
  IcoCoins,
  IcoCommunity,
  IcoMarketplace,
  IcoCheck,
  IcoUpload,
  IcoBolt,
  IcoDots,
  IcoChevron,
  IcoBell,
  IcoStar,
  IcoLogout,
} from '../../components/ui/Icons'
import './set.css'

/* ---------------------------------------------------------------- data */

type NavKey =
  | 'profile'
  | 'workspace'
  | 'brand'
  | 'billing'
  | 'team'
  | 'integrations'

type NavItem = {
  key: NavKey
  label: string
  icon: typeof IcoSettings
  count?: string
}

const NAV: NavItem[] = [
  { key: 'profile', label: 'Profile', icon: IcoSettings },
  { key: 'workspace', label: 'Workspace', icon: IcoGrid },
  { key: 'brand', label: 'Brand Kit', icon: IcoSparkle },
  { key: 'billing', label: 'Billing', icon: IcoCoins },
  { key: 'team', label: 'Team', icon: IcoCommunity, count: '5' },
  { key: 'integrations', label: 'Integrations', icon: IcoMarketplace, count: '3' },
]

const ACCENTS: { id: string; hex: string }[] = [
  { id: 'violet', hex: '#d1f94f' },
  { id: 'indigo', hex: '#5aa2ff' },
  { id: 'emerald', hex: '#3ecf8e' },
  { id: 'amber', hex: '#f5b544' },
  { id: 'rose', hex: '#ff6ba6' },
  { id: 'slate', hex: '#8b8b9c' },
]

type ToggleDef = { id: string; title: string; sub: string; on: boolean }
const INITIAL_TOGGLES: ToggleDef[] = [
  { id: 'tech', title: 'Tech pack activity', sub: 'When a tech pack finishes generating or is edited.', on: true },
  { id: 'factory', title: 'Manufacturer matches', sub: 'New factory matches and quote responses for your designs.', on: true },
  { id: 'prod', title: 'Production milestones', sub: 'Sampling, bulk start, QC and shipment status changes.', on: false },
  { id: 'digest', title: 'Weekly brand digest', sub: 'A Monday summary of drops, orders and community activity.', on: true },
]

type Member = {
  id: string
  name: string
  email: string
  initials: string
  role: string
  accent?: boolean
  owner?: boolean
  you?: boolean
}
const MEMBERS: Member[] = [
  { id: '1', name: 'Mike Chen', email: 'mike@atelier-nord.co', initials: 'MC', role: 'Owner', accent: true, owner: true, you: true },
  { id: '2', name: 'Jordan Diaz', email: 'jordan@atelier-nord.co', initials: 'JD', role: 'Admin' },
  { id: '3', name: 'Amara Lowe', email: 'amara@atelier-nord.co', initials: 'AL', role: 'Designer' },
  { id: '4', name: 'Kai Petrov', email: 'kai.p@atelier-nord.co', initials: 'KP', role: 'Designer' },
  { id: '5', name: 'Sofia Marchetti', email: 'sofia@studio-atlas.it', initials: 'SM', role: 'Production' },
]

/* ---------------------------------------------------------------- switch */

type SwitchProps = { on: boolean; onToggle: () => void; label: string }
function Switch({ on, onToggle, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`set-switch${on ? ' is-on' : ''}`}
      onClick={onToggle}
    />
  )
}

/* ---------------------------------------------------------------- page */

export function Settings() {
  const [active, setActive] = useState<NavKey>('profile')
  const [accent, setAccent] = useState('violet')
  const [toggles, setToggles] = useState<ToggleDef[]>(INITIAL_TOGGLES)

  const handleToggle = (id: string) => {
    setToggles((prev) => prev.map((t) => (t.id === id ? { ...t, on: !t.on } : t)))
  }

  return (
    <SuitePage
      eyebrow="Settings"
      title="Settings"
      subtitle="Manage your profile, brand, plan, team and integrations across the THREADOS workspace."
      actions={
        <>
          <button className="s-btn s-btn--subtle" type="button">
            Documentation
          </button>
          <button className="s-btn s-btn--accent" type="button">
            <IcoCheck width="16" height="16" /> Save changes
          </button>
        </>
      }
    >
      <div className="set-shell">
        {/* ---------- Left sub-nav ---------- */}
        <nav className="set-nav" aria-label="Settings sections">
          <div className="set-nav__group">
            <span className="set-nav__group-label">Account</span>
          </div>
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = item.key === active
            return (
              <button
                key={item.key}
                type="button"
                className={`set-nav__item${isActive ? ' is-active' : ''}`}
                onClick={() => setActive(item.key)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="set-nav__ico">
                  <Icon width="17" height="17" />
                </span>
                {item.label}
                {item.count && <span className="set-nav__count">{item.count}</span>}
              </button>
            )
          })}
        </nav>

        {/* ---------- Right content ---------- */}
        <div className="set-content">
          {/* ===== Profile ===== */}
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Profile</h2>
                <p>This information appears on tech packs, invites and factory intros.</p>
              </div>
              <span className="s-chip s-chip--good">
                <IcoCheck width="12" height="12" /> Verified
              </span>
            </div>
            <div className="set-card__body">
              {/* Avatar row */}
              <div className="set-avatar-row">
                <div className="set-avatar">
                  <span className="set-avatar__ring" aria-hidden="true" />
                  MC
                </div>
                <div className="set-avatar-meta">
                  <b>Mike Chen</b>
                  <span>PNG or JPG, up to 4MB. 512×512 recommended.</span>
                </div>
                <div className="set-avatar-actions">
                  <button className="s-btn s-btn--ghost" type="button">
                    <IcoUpload width="15" height="15" /> Upload
                  </button>
                  <button className="s-btn s-btn--subtle" type="button">
                    Remove
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="set-fields">
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-name">
                    Full name
                  </label>
                  <input id="set-name" className="set-input" defaultValue="Mike Chen" placeholder="Your name" />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-email">
                    Email address
                  </label>
                  <input
                    id="set-email"
                    className="set-input"
                    type="email"
                    defaultValue="mike@atelier-nord.co"
                    placeholder="you@brand.com"
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-company">
                    Company
                  </label>
                  <input id="set-company" className="set-input" defaultValue="Atelier Nord" placeholder="Brand name" />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-handle">
                    Brand handle
                  </label>
                  <div className="set-input-wrap">
                    <span className="set-input-wrap__prefix">threados.co/</span>
                    <input id="set-handle" className="set-input" defaultValue="atelier-nord" placeholder="handle" />
                    <span className="set-input-wrap__suffix">
                      <IcoCheck width="13" height="13" /> Available
                    </span>
                  </div>
                </div>
                <div className="set-field set-field--full">
                  <label className="set-field__label" htmlFor="set-bio">
                    Studio bio
                    <span className="set-field__opt">Optional</span>
                  </label>
                  <input
                    id="set-bio"
                    className="set-input"
                    defaultValue="Contemporary streetwear studio — heavyweight fleece, garment dye, small-batch drops."
                    placeholder="Tell factories about your brand"
                  />
                  <span className="set-hint">Shown on your public marketplace profile and factory intros.</span>
                </div>
              </div>
            </div>
          </section>

          {/* ===== Brand Kit — accent color ===== */}
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Brand accent</h2>
                <p>Sets the highlight color across your workspace, exports and share pages.</p>
              </div>
            </div>
            <div className="set-card__body">
              <div className="set-field">
                <span className="set-field__label">Accent color</span>
                <div className="set-swatches" role="radiogroup" aria-label="Brand accent color">
                  {ACCENTS.map((sw) => {
                    const isActive = sw.id === accent
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={sw.id}
                        className={`set-swatch${isActive ? ' is-active' : ''}`}
                        style={{ background: sw.hex, color: sw.hex }}
                        onClick={() => setAccent(sw.id)}
                      >
                        <span className="set-swatch__tick">
                          <IcoCheck width="15" height="15" />
                        </span>
                      </button>
                    )
                  })}
                  <button type="button" className="set-swatch set-swatch--custom" aria-label="Custom color">
                    <IcoSparkle width="15" height="15" />
                  </button>
                </div>
                <span className="set-hint">Violet is the THREADOS default and keeps contrast AA-compliant.</span>
              </div>
            </div>
          </section>

          {/* ===== Notifications — toggles ===== */}
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Notifications</h2>
                <p>Choose what THREADOS emails and pushes to your team.</p>
              </div>
              <span className="s-chip s-chip--accent">
                <IcoBell width="12" height="12" /> Email + Push
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-toggles">
                {toggles.map((t) => (
                  <div className="set-toggle-row" key={t.id}>
                    <div className="set-toggle-text">
                      <b>{t.title}</b>
                      <small>{t.sub}</small>
                    </div>
                    <Switch on={t.on} onToggle={() => handleToggle(t.id)} label={t.title} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ===== Billing ===== */}
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Plan &amp; billing</h2>
                <p>Your current subscription and monthly usage.</p>
              </div>
              <button className="s-btn s-btn--subtle" type="button">
                Billing history
              </button>
            </div>
            <div className="set-card__body">
              <div className="set-plan">
                <div>
                  <div className="set-plan__name">
                    <span className="set-plan__ico">
                      <IcoBolt width="17" height="17" />
                    </span>
                    Studio plan
                    <span className="s-chip s-chip--accent">Current</span>
                  </div>
                  <p className="set-plan__desc">
                    Unlimited designs, AI tech packs, factory matching and 3 seats — everything to run a small-batch
                    label end to end.
                  </p>
                </div>
                <div className="set-plan__price">
                  <b>$79</b>
                  <span>/ month</span>
                </div>
              </div>

              <div className="set-meters">
                <div className="set-meter">
                  <div className="set-meter__top">
                    <span className="set-meter__label">
                      <span className="set-meter__label-ico">
                        <IcoCoins width="15" height="15" />
                      </span>
                      AI coins
                    </span>
                    <span className="set-meter__val">
                      <b>1,840</b> / 2,500
                    </span>
                  </div>
                  <div className="set-bar">
                    <span className="set-bar__fill" style={{ width: '74%' }} />
                  </div>
                </div>
                <div className="set-meter">
                  <div className="set-meter__top">
                    <span className="set-meter__label">
                      <span className="set-meter__label-ico">
                        <IcoGrid width="15" height="15" />
                      </span>
                      Storage
                    </span>
                    <span className="set-meter__val">
                      <b>17.2 GB</b> / 20 GB
                    </span>
                  </div>
                  <div className="set-bar">
                    <span className="set-bar__fill set-bar__fill--warn" style={{ width: '86%' }} />
                  </div>
                </div>
              </div>

              <div className="set-billing-foot">
                <span className="set-billing-foot__note">Renews Aug 7, 2026 · Visa ending 4429</span>
                <button className="s-btn s-btn--accent" type="button">
                  <IcoStar width="16" height="16" /> Upgrade to Atelier
                </button>
              </div>
            </div>
          </section>

          {/* ===== Team ===== */}
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Team members</h2>
                <p>5 of 6 seats used on the Studio plan.</p>
              </div>
              <button className="s-btn s-btn--ghost" type="button">
                <IcoCommunity width="15" height="15" /> Invite member
              </button>
            </div>
            <div className="set-card__body">
              <div className="set-members">
                {MEMBERS.map((m) => (
                  <div className="set-member" key={m.id}>
                    <span className={`set-member__av${m.accent ? ' set-member__av--accent' : ''}`}>{m.initials}</span>
                    <div className="set-member__info">
                      <span className="set-member__name">
                        {m.name}
                        {m.you && <span className="s-chip s-chip--accent">You</span>}
                      </span>
                      <span className="set-member__email">{m.email}</span>
                    </div>
                    <div className="set-member__right">
                      <button className={`set-role${m.owner ? ' set-role--owner' : ''}`} type="button">
                        {m.role}
                        {!m.owner && <IcoChevron width="13" height="13" />}
                      </button>
                      {!m.owner && (
                        <button className="set-member__more" type="button" aria-label={`Manage ${m.name}`}>
                          <IcoDots width="16" height="16" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ===== Danger zone ===== */}
          <section className="set-card set-card--danger">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Danger zone</h2>
                <p>Irreversible and destructive actions.</p>
              </div>
            </div>
            <div className="set-card__body">
              <div className="set-danger-row">
                <div className="set-danger-row__text">
                  <b>Transfer ownership</b>
                  <p>Move this workspace and all collections to another team member.</p>
                </div>
                <button className="set-btn-danger" type="button">
                  <IcoLogout width="15" height="15" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  Transfer
                </button>
              </div>
              <div className="set-danger-row">
                <div className="set-danger-row__text">
                  <b>Delete workspace</b>
                  <p>Permanently remove Atelier Nord, all designs, tech packs and production data.</p>
                </div>
                <button className="set-btn-danger" type="button">
                  Delete workspace
                </button>
              </div>
            </div>
          </section>

          {/* ===== Sticky save bar ===== */}
          <div className="set-savebar">
            <span className="set-savebar__text">
              <span className="set-savebar__dot" aria-hidden="true" />
              You have unsaved changes
            </span>
            <div className="set-savebar__actions">
              <button className="s-btn s-btn--subtle" type="button">
                Discard
              </button>
              <button className="s-btn s-btn--accent" type="button">
                <IcoCheck width="16" height="16" /> Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </SuitePage>
  )
}
