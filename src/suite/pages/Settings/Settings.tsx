import { useMemo, useState } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid } from '../../data/utils'
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
}

const ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: 'lime', label: 'Lime', hex: '#d1f94f' },
  { id: 'indigo', label: 'Indigo', hex: '#5aa2ff' },
  { id: 'emerald', label: 'Emerald', hex: '#3ecf8e' },
  { id: 'amber', label: 'Amber', hex: '#f5b544' },
  { id: 'rose', label: 'Rose', hex: '#ff6ba6' },
  { id: 'slate', label: 'Slate', hex: '#8b8b9c' },
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
  owner?: boolean
}

type Integration = {
  id: string
  name: string
  desc: string
  connected: boolean
}
const INITIAL_INTEGRATIONS: Integration[] = [
  { id: 'shopify', name: 'Shopify', desc: 'Sync drops and inventory to your storefront.', connected: true },
  { id: 'figma', name: 'Figma', desc: 'Pull artboards straight into the design studio.', connected: true },
  { id: 'stripe', name: 'Stripe', desc: 'Collect deposits and settle factory invoices.', connected: true },
  { id: 'slack', name: 'Slack', desc: 'Post production milestones to a team channel.', connected: false },
]

const REGIONS: { id: string; label: string }[] = [
  { id: 'eu', label: 'Europe (EU)' },
  { id: 'uk', label: 'United Kingdom' },
  { id: 'us', label: 'North America' },
  { id: 'apac', label: 'Asia-Pacific' },
]

const SEED_MEMBERS: Member[] = [
  { id: 'm2', name: 'Jordan Diaz', email: 'jordan@atelier-nord.co', initials: 'JD', role: 'Admin' },
  { id: 'm3', name: 'Amara Lowe', email: 'amara@atelier-nord.co', initials: 'AL', role: 'Designer' },
  { id: 'm4', name: 'Kai Petrov', email: 'kai.p@atelier-nord.co', initials: 'KP', role: 'Designer' },
  { id: 'm5', name: 'Sofia Marchetti', email: 'sofia@studio-atlas.it', initials: 'SM', role: 'Production' },
]

const SEAT_LIMIT = 6

/** Turn a display name into up-to-two-letter initials. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

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

const NAV: NavItem[] = [
  { key: 'profile', label: 'Profile', icon: IcoSettings },
  { key: 'workspace', label: 'Workspace', icon: IcoGrid },
  { key: 'brand', label: 'Brand Kit', icon: IcoSparkle },
  { key: 'billing', label: 'Billing', icon: IcoCoins },
  { key: 'team', label: 'Team', icon: IcoCommunity },
  { key: 'integrations', label: 'Integrations', icon: IcoMarketplace },
]

export function Settings() {
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [active, setActive] = useState<NavKey>('profile')

  /* -- Profile form (controlled, seeded from the signed-in user) -- */
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [company, setCompany] = useState('Atelier Nord')
  const [handle, setHandle] = useState('atelier-nord')
  const [bio, setBio] = useState(
    'Contemporary streetwear studio — heavyweight fleece, garment dye, small-batch drops.',
  )

  /* -- Brand accent + notifications (local preferences) -- */
  const [accent, setAccent] = useState('lime')
  const [toggles, setToggles] = useState<ToggleDef[]>(INITIAL_TOGGLES)

  /* -- Team roster (local) -- */
  const [members, setMembers] = useState<Member[]>(SEED_MEMBERS)

  /* -- Workspace + integrations (local preferences) -- */
  const [workspaceName, setWorkspaceName] = useState('Atelier Nord')
  const [region, setRegion] = useState('eu')
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS)

  /* -- Dirty tracking so the save bar reflects real unsaved edits -- */
  const isDirty =
    !!user && (name.trim() !== user.name || email.trim().toLowerCase() !== user.email.toLowerCase())

  const avatarInitials = useMemo(() => initialsOf(name || user?.name || ''), [name, user?.name])
  const accentHex = ACCENTS.find((a) => a.id === accent)?.hex ?? ACCENTS[0].hex

  const handleToggle = (id: string) => {
    setToggles((prev) => prev.map((t) => (t.id === id ? { ...t, on: !t.on } : t)))
    const next = toggles.find((t) => t.id === id)
    toast(next?.on ? `Muted “${next.title}”` : `“${next?.title}” notifications on`, 'default')
  }

  const handlePickAccent = (id: string) => {
    setAccent(id)
    const label = ACCENTS.find((a) => a.id === id)?.label ?? id
    toast(`${label} set as your brand accent`, 'accent')
  }

  const saveProfile = () => {
    if (!user) return
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    if (cleanName.length < 2) {
      toast('Enter your full name before saving.', 'default')
      setActive('profile')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast('Enter a valid email address.', 'default')
      setActive('profile')
      return
    }
    const clash = data.users.some((u) => u.id !== user.id && u.email.toLowerCase() === cleanEmail)
    if (clash) {
      toast('That email is already used by another account.', 'default')
      return
    }
    mutate((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === user.id ? { ...u, name: cleanName, email: cleanEmail } : u)),
    }))
    setName(cleanName)
    setEmail(cleanEmail)
    toast('Profile saved', 'success')
  }

  const discard = () => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    toast('Reverted to your last saved profile', 'default')
  }

  const inviteMember = () => {
    if (members.length + 1 >= SEAT_LIMIT) {
      toast(`All ${SEAT_LIMIT} seats are in use — upgrade to add more.`, 'default')
      setActive('billing')
      return
    }
    const n = members.length + 2
    const newMember: Member = {
      id: uid('m'),
      name: `Teammate ${n}`,
      email: `invite${n}@${handle || 'brand'}.co`,
      initials: `T${n}`,
      role: 'Designer',
    }
    setMembers((prev) => [...prev, newMember])
    toast(`Invite sent to ${newMember.email}`, 'success')
  }

  const cycleRole = (m: Member) => {
    const ROLES = ['Admin', 'Designer', 'Production'] as const
    const idx = ROLES.indexOf(m.role as (typeof ROLES)[number])
    const nextRole = ROLES[(idx + 1) % ROLES.length]
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: nextRole } : x)))
    toast(`${m.name} is now ${nextRole}`, 'default')
  }

  const removeMember = (m: Member) => {
    setMembers((prev) => prev.filter((x) => x.id !== m.id))
    toast(`${m.name} removed from the workspace`, 'default')
  }

  const upgrade = () => toast('Redirecting you to upgrade to the Atelier plan…', 'accent')
  const billingHistory = () => toast('Opening your billing history…', 'info')
  const uploadAvatar = () => toast('Choose a PNG or JPG to use as your avatar.', 'info')
  const removeAvatar = () => toast('Avatar removed — using your initials.', 'default')
  const documentation = () => toast('Opening the THREADOS documentation…', 'info')

  const toggleIntegration = (id: string) => {
    let nowConnected = false
    setIntegrations((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        nowConnected = !it.connected
        return { ...it, connected: nowConnected }
      }),
    )
    const target = integrations.find((it) => it.id === id)
    if (target) {
      toast(
        nowConnected ? `${target.name} connected` : `${target.name} disconnected`,
        nowConnected ? 'success' : 'default',
      )
    }
  }

  const connectedCount = integrations.filter((it) => it.connected).length

  const transferOwnership = () => {
    const to = members[0]
    if (!to) {
      toast('Invite a teammate before transferring ownership.', 'default')
      setActive('team')
      return
    }
    if (window.confirm(`Transfer this workspace to ${to.name}? You will lose owner access.`)) {
      toast(`Ownership transfer to ${to.name} requested`, 'default')
    }
  }

  const deleteWorkspace = () => {
    if (window.confirm('Permanently delete Atelier Nord and all its data? This cannot be undone.')) {
      toast('Workspace deletion scheduled — check your email to confirm.', 'default')
    }
  }

  /* -- Real plan + coins from the signed-in user -- */
  const planName = user?.plan ?? 'Studio'
  const coins = user?.coins ?? 0
  const coinCap = planName === 'Scale' ? 100000 : planName === 'Studio' ? 25000 : 2500
  const coinPct = Math.min(100, Math.round((coins / coinCap) * 100))
  const memberCount = members.length + 1 // + the owner (you)

  return (
    <SuitePage
      eyebrow="Settings"
      title="Settings"
      subtitle="Manage your profile, brand, plan, team and integrations across the THREADOS workspace."
      actions={
        <>
          <button className="s-btn s-btn--subtle" type="button" onClick={documentation}>
            Documentation
          </button>
          <button
            className="s-btn s-btn--accent"
            type="button"
            onClick={saveProfile}
            disabled={!isDirty}
            title={isDirty ? 'Save your profile changes' : 'No unsaved changes'}
          >
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
            const count =
              item.key === 'team'
                ? String(memberCount)
                : item.key === 'integrations'
                  ? String(connectedCount)
                  : undefined
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
                {count && <span className="set-nav__count">{count}</span>}
              </button>
            )
          })}
        </nav>

        {/* ---------- Right content ---------- */}
        <div className="set-content">
          {/* ===== Profile ===== */}
          {active === 'profile' && (
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
                  {avatarInitials}
                </div>
                <div className="set-avatar-meta">
                  <b>{name || user?.name || 'Your name'}</b>
                  <span>PNG or JPG, up to 4MB. 512×512 recommended.</span>
                </div>
                <div className="set-avatar-actions">
                  <button className="s-btn s-btn--ghost" type="button" onClick={uploadAvatar}>
                    <IcoUpload width="15" height="15" /> Upload
                  </button>
                  <button className="s-btn s-btn--subtle" type="button" onClick={removeAvatar}>
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
                  <input
                    id="set-name"
                    className="set-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-email">
                    Email address
                  </label>
                  <input
                    id="set-email"
                    className="set-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@brand.com"
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-company">
                    Company
                  </label>
                  <input
                    id="set-company"
                    className="set-input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Brand name"
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-handle">
                    Brand handle
                  </label>
                  <div className="set-input-wrap">
                    <span className="set-input-wrap__prefix">threados.co/</span>
                    <input
                      id="set-handle"
                      className="set-input"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
                      placeholder="handle"
                    />
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
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell factories about your brand"
                  />
                  <span className="set-hint">Shown on your public marketplace profile and factory intros.</span>
                </div>
              </div>
            </div>
          </section>
          )}

          {/* ===== Workspace ===== */}
          {active === 'workspace' && (
          <>
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Workspace</h2>
                <p>Name, data region and defaults for everyone in {workspaceName || 'this workspace'}.</p>
              </div>
              <span className="s-chip s-chip--good">
                <IcoCheck width="12" height="12" /> Active
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-fields">
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-ws-name">
                    Workspace name
                  </label>
                  <input
                    id="set-ws-name"
                    className="set-input"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-ws-region">
                    Data region
                  </label>
                  <select
                    id="set-ws-region"
                    className="set-input"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value)
                      const label = REGIONS.find((r) => r.id === e.target.value)?.label ?? e.target.value
                      toast(`Data region set to ${label}`, 'default')
                    }}
                  >
                    {REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <span className="set-hint">Where your designs, tech packs and orders are stored.</span>
                </div>
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
                <button className="set-btn-danger" type="button" onClick={transferOwnership}>
                  <IcoLogout width="15" height="15" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                  Transfer
                </button>
              </div>
              <div className="set-danger-row">
                <div className="set-danger-row__text">
                  <b>Delete workspace</b>
                  <p>Permanently remove {workspaceName || 'this workspace'}, all designs, tech packs and production data.</p>
                </div>
                <button className="set-btn-danger" type="button" onClick={deleteWorkspace}>
                  Delete workspace
                </button>
              </div>
            </div>
          </section>
          </>
          )}

          {/* ===== Brand Kit — accent color ===== */}
          {active === 'brand' && (
          <>
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Brand accent</h2>
                <p>Sets the highlight color across your workspace, exports and share pages.</p>
              </div>
              <span className="s-chip" style={{ color: accentHex }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: accentHex,
                    display: 'inline-block',
                  }}
                />
                {ACCENTS.find((a) => a.id === accent)?.label}
              </span>
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
                        aria-label={sw.label}
                        title={sw.label}
                        className={`set-swatch${isActive ? ' is-active' : ''}`}
                        style={{ background: sw.hex, color: sw.hex }}
                        onClick={() => handlePickAccent(sw.id)}
                      >
                        <span className="set-swatch__tick">
                          <IcoCheck width="15" height="15" />
                        </span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    className="set-swatch set-swatch--custom"
                    aria-label="Custom color"
                    title="Custom colors are on the Atelier plan"
                    onClick={() => {
                      toast('Custom accent colors are available on the Atelier plan.', 'accent')
                      setActive('billing')
                    }}
                  >
                    <IcoSparkle width="15" height="15" />
                  </button>
                </div>
                <span className="set-hint">Lime is the THREADOS default and keeps contrast AA-compliant.</span>
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
          </>
          )}

          {/* ===== Billing ===== */}
          {active === 'billing' && (
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Plan &amp; billing</h2>
                <p>Your current subscription and monthly usage.</p>
              </div>
              <button className="s-btn s-btn--subtle" type="button" onClick={billingHistory}>
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
                    {planName} plan
                    <span className="s-chip s-chip--accent">Current</span>
                  </div>
                  <p className="set-plan__desc">
                    Unlimited designs, AI tech packs, factory matching and {SEAT_LIMIT} seats — everything to run
                    a small-batch label end to end.
                  </p>
                </div>
                <div className="set-plan__price">
                  <b>{planName === 'Scale' ? '$199' : planName === 'Studio' ? '$79' : '$0'}</b>
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
                      <b>{coins.toLocaleString()}</b> / {coinCap.toLocaleString()}
                    </span>
                  </div>
                  <div className="set-bar">
                    <span className="set-bar__fill" style={{ width: `${coinPct}%` }} />
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
                <button className="s-btn s-btn--accent" type="button" onClick={upgrade}>
                  <IcoStar width="16" height="16" /> Upgrade to Atelier
                </button>
              </div>
            </div>
          </section>
          )}

          {/* ===== Team ===== */}
          {active === 'team' && (
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Team members</h2>
                <p>
                  {memberCount} of {SEAT_LIMIT} seats used on the {planName} plan.
                </p>
              </div>
              <button className="s-btn s-btn--ghost" type="button" onClick={inviteMember}>
                <IcoCommunity width="15" height="15" /> Invite member
              </button>
            </div>
            <div className="set-card__body">
              <div className="set-members">
                {/* Owner (the signed-in user) */}
                <div className="set-member">
                  <span className="set-member__av set-member__av--accent">{avatarInitials}</span>
                  <div className="set-member__info">
                    <span className="set-member__name">
                      {name || user?.name || 'You'}
                      <span className="s-chip s-chip--accent">You</span>
                    </span>
                    <span className="set-member__email">{email || user?.email}</span>
                  </div>
                  <div className="set-member__right">
                    <button className="set-role set-role--owner" type="button" title="You own this workspace">
                      Owner
                    </button>
                  </div>
                </div>

                {members.map((m) => (
                  <div className="set-member" key={m.id}>
                    <span className="set-member__av">{m.initials}</span>
                    <div className="set-member__info">
                      <span className="set-member__name">{m.name}</span>
                      <span className="set-member__email">{m.email}</span>
                    </div>
                    <div className="set-member__right">
                      <button
                        className="set-role"
                        type="button"
                        onClick={() => cycleRole(m)}
                        title="Click to change role"
                      >
                        {m.role}
                        <IcoChevron width="13" height="13" />
                      </button>
                      <button
                        className="set-member__more"
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        title={`Remove ${m.name}`}
                        onClick={() => removeMember(m)}
                      >
                        <IcoDots width="16" height="16" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}

          {/* ===== Integrations ===== */}
          {active === 'integrations' && (
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>Integrations</h2>
                <p>Connect the tools your studio already runs on.</p>
              </div>
              <span className="s-chip s-chip--accent">
                <IcoMarketplace width="12" height="12" /> {connectedCount} connected
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-toggles">
                {integrations.map((it) => (
                  <div className="set-toggle-row" key={it.id}>
                    <div className="set-toggle-text">
                      <b>{it.name}</b>
                      <small>{it.desc}</small>
                    </div>
                    <Switch
                      on={it.connected}
                      onToggle={() => toggleIntegration(it.id)}
                      label={`${it.connected ? 'Disconnect' : 'Connect'} ${it.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}

          {/* ===== Sticky save bar ===== */}
          {isDirty && (
            <div className="set-savebar">
              <span className="set-savebar__text">
                <span className="set-savebar__dot" aria-hidden="true" />
                You have unsaved changes
              </span>
              <div className="set-savebar__actions">
                <button className="s-btn s-btn--subtle" type="button" onClick={discard}>
                  Discard
                </button>
                <button className="s-btn s-btn--accent" type="button" onClick={saveProfile}>
                  <IcoCheck width="16" height="16" /> Save changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SuitePage>
  )
}
