import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { useT } from '@/i18n'
import { uid } from '../../data/utils'
import { downloadCsv, downloadJson, downloadText, slugify } from '../../lib/download'
import { useStorageEstimate, formatBytes as formatBytesLabel } from '../../lib/useStorageEstimate'
import { planTier } from '../../economy/economy'
import { requestTour } from '../../onboarding/tourBus'
import { AiSettings } from './AiSettings'
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

const DOCS_URL = 'https://docs.threados.co'
const AVATAR_MAX_BYTES = 4 * 1024 * 1024
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ---------------------------------------------- local profile persistence */

const PROFILE_DEFAULTS = {
  company: 'Atelier Nord',
  handle: 'atelier-nord',
  bio: 'Contemporary streetwear studio — heavyweight fleece, garment dye, small-batch drops.',
}

type StoredProfile = typeof PROFILE_DEFAULTS

function profileKey(userId: string): string {
  return `threados-profile-${userId}`
}

/** Read the locally persisted profile fields for a user, falling back to defaults. */
function loadStoredProfile(userId: string | undefined): StoredProfile {
  if (!userId) return PROFILE_DEFAULTS
  try {
    const raw = localStorage.getItem(profileKey(userId))
    if (!raw) return PROFILE_DEFAULTS
    const parsed = JSON.parse(raw) as Partial<StoredProfile>
    return {
      company: typeof parsed.company === 'string' ? parsed.company : PROFILE_DEFAULTS.company,
      handle: typeof parsed.handle === 'string' ? parsed.handle : PROFILE_DEFAULTS.handle,
      bio: typeof parsed.bio === 'string' ? parsed.bio : PROFILE_DEFAULTS.bio,
    }
  } catch {
    return PROFILE_DEFAULTS
  }
}

/* ---------------------------------------------------------------- data */

type NavKey =
  | 'profile'
  | 'workspace'
  | 'brand'
  | 'billing'
  | 'team'
  | 'integrations'
  | 'ai'
  | 'tour'

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
  /** Invited locally but not yet accepted — email delivery arrives with the backend. */
  pending?: boolean
}

type Integration = {
  id: string
  name: string
  desc: string
}
/** OAuth for these is not built yet — shown honestly as coming soon, never as fake connections. */
const INTEGRATIONS: Integration[] = [
  { id: 'shopify', name: 'Shopify', desc: 'Sync drops and inventory to your storefront.' },
  { id: 'figma', name: 'Figma', desc: 'Pull artboards straight into the design studio.' },
  { id: 'stripe', name: 'Stripe', desc: 'Collect deposits and settle factory invoices.' },
  { id: 'slack', name: 'Slack', desc: 'Post production milestones to a team channel.' },
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

type SwitchProps = { on: boolean; onToggle?: () => void; label: string; disabled?: boolean }
function Switch({ on, onToggle, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`set-switch${on ? ' is-on' : ''}`}
      onClick={onToggle}
      disabled={disabled}
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
  { key: 'ai', label: 'AI', icon: IcoBolt },
  { key: 'tour', label: 'App tour', icon: IcoStar },
]

export function Settings() {
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()
  const location = useLocation()
  const navigate = useNavigate()

  const [active, setActive] = useState<NavKey>('profile')

  /* -- Deep links: /suite/settings?section=billing opens that section -- */
  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section')
    if (section && NAV.some((n) => n.key === section)) setActive(section as NavKey)
  }, [location.key, location.search])

  /* -- Profile form (controlled, seeded from the signed-in user + local storage) -- */
  const [savedProfile, setSavedProfile] = useState<StoredProfile>(() => loadStoredProfile(user?.id))
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [company, setCompany] = useState(savedProfile.company)
  const [handle, setHandle] = useState(savedProfile.handle)
  const [bio, setBio] = useState(savedProfile.bio)

  /* -- Brand accent + notifications (local preferences) -- */
  const [accent, setAccent] = useState('lime')
  const [toggles, setToggles] = useState<ToggleDef[]>(INITIAL_TOGGLES)

  /* -- Team roster (local) -- */
  const [members, setMembers] = useState<Member[]>(SEED_MEMBERS)
  const [inviteEmail, setInviteEmail] = useState('')

  /* -- Avatar image (real upload → data URL, shown in the avatar tile) -- */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  /* -- Workspace (local preferences) -- */
  const [workspaceName, setWorkspaceName] = useState('Atelier Nord')
  const [region, setRegion] = useState('eu')

  /* -- Danger zone: transfer + delete confirmation flows -- */
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [ownershipTransferred, setOwnershipTransferred] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  /* -- Dirty tracking so the save bar reflects real unsaved edits -- */
  const isDirty =
    !!user &&
    (name.trim() !== user.name ||
      email.trim().toLowerCase() !== user.email.toLowerCase() ||
      company.trim() !== savedProfile.company ||
      handle.trim() !== savedProfile.handle ||
      bio.trim() !== savedProfile.bio)

  const avatarInitials = useMemo(() => initialsOf(name || user?.name || ''), [name, user?.name])
  const accentHex = ACCENTS.find((a) => a.id === accent)?.hex ?? ACCENTS[0].hex

  /* -- Localized labels for the local const arrays, resolved at the render site -- */
  const navLabel = (key: NavKey) => t(`settings.nav.${key}`)
  const accentLabel = (id: string) => t(`settings.accent.${id}`)
  const regionLabel = (id: string) => t(`settings.region.${id}`)
  const roleLabel = (role: string) => t(`settings.role.${role.toLowerCase()}`)
  const notifTitle = (id: string) => t(`settings.notif.${id}.title`)
  const notifSub = (id: string) => t(`settings.notif.${id}.sub`)
  const integDesc = (id: string) => t(`settings.integ.${id}.desc`)

  const handleToggle = (id: string) => {
    setToggles((prev) => prev.map((tog) => (tog.id === id ? { ...tog, on: !tog.on } : tog)))
    const next = toggles.find((tog) => tog.id === id)
    const title = notifTitle(id)
    toast(next?.on ? t('settings.notif.muted', { title }) : t('settings.notif.on', { title }), 'default')
  }

  const handlePickAccent = (id: string) => {
    setAccent(id)
    toast(t('settings.accent.set', { color: accentLabel(id) }), 'accent')
  }

  const saveProfile = () => {
    if (!user) return
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    if (cleanName.length < 2) {
      toast(t('settings.profile.nameRequired'), 'default')
      setActive('profile')
      return
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      toast(t('settings.profile.emailInvalid'), 'default')
      setActive('profile')
      return
    }
    const clash = data.users.some((u) => u.id !== user.id && u.email.toLowerCase() === cleanEmail)
    if (clash) {
      toast(t('settings.profile.emailClash'), 'default')
      return
    }
    const nextProfile: StoredProfile = { company: company.trim(), handle: handle.trim(), bio: bio.trim() }
    try {
      localStorage.setItem(profileKey(user.id), JSON.stringify(nextProfile))
    } catch {
      toast(t('settings.profile.storageUnavailable'), 'default')
      return
    }
    mutate((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === user.id ? { ...u, name: cleanName, email: cleanEmail } : u)),
    }))
    setSavedProfile(nextProfile)
    setName(cleanName)
    setEmail(cleanEmail)
    setCompany(nextProfile.company)
    setHandle(nextProfile.handle)
    setBio(nextProfile.bio)
    toast(t('settings.profile.saved'), 'success')
  }

  const discard = () => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setCompany(savedProfile.company)
    setHandle(savedProfile.handle)
    setBio(savedProfile.bio)
    toast(t('settings.profile.reverted'), 'default')
  }

  const submitInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (members.length + 1 >= SEAT_LIMIT) {
      toast(t('settings.team.seatsFull', { n: SEAT_LIMIT }), 'default')
      setActive('billing')
      return
    }
    const clean = inviteEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      toast(t('settings.team.inviteEmailInvalid'), 'default')
      return
    }
    const ownEmail = (email.trim() || user?.email || '').toLowerCase()
    if (clean === ownEmail || members.some((m) => m.email.toLowerCase() === clean)) {
      toast(t('settings.team.emailOnTeam'), 'default')
      return
    }
    const invited: Member = {
      id: uid('m'),
      name: clean,
      email: clean,
      initials: clean.slice(0, 2).toUpperCase(),
      role: 'Invited',
      pending: true,
    }
    setMembers((prev) => [...prev, invited])
    setInviteEmail('')
    toast(t('settings.team.inviteRecorded', { email: clean }), 'success')
  }

  const cycleRole = (m: Member) => {
    const ROLES = ['Admin', 'Designer', 'Production'] as const
    const idx = ROLES.indexOf(m.role as (typeof ROLES)[number])
    const nextRole = ROLES[(idx + 1) % ROLES.length]
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role: nextRole } : x)))
    toast(t('settings.role.changed', { name: m.name, role: roleLabel(nextRole) }), 'default')
  }

  const removeMember = (m: Member) => {
    setMembers((prev) => prev.filter((x) => x.id !== m.id))
    toast(
      m.pending
        ? t('settings.team.inviteRevoked', { email: m.email })
        : t('settings.team.memberRemoved', { name: m.name }),
      'default',
    )
  }


  /* -- Billing history: exports the REAL account state. No payment processor is wired yet,
     so there are no charges to invent — the export reflects the current plan only. -- */
  const billingHistory = () => {
    const rows = [
      {
        plan: `${planName} plan`,
        listPrice: planPriceLabel,
        status: planName === 'Free' ? 'Free — no charges' : 'Active — billing not connected',
        chargesProcessed: 'None',
        exportedAt: new Date().toISOString().slice(0, 10),
      },
    ]
    downloadCsv(rows, 'threados-plan-summary.csv')
    toast(t('settings.billing.exportedToast'), 'info')
  }

  /* -- Documentation: real navigation to the docs site -- */
  const documentation = () => {
    window.open(DOCS_URL, '_blank', 'noopener,noreferrer')
    toast(t('settings.doc.opening'), 'info')
  }

  /* -- Avatar upload: real file picker → data URL → visible avatar image -- */
  const uploadAvatar = () => avatarInputRef.current?.click()

  const onAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast(t('settings.profile.avatarType'), 'default')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast(t('settings.profile.avatarTooBig'), 'default')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result)
        toast(t('settings.profile.avatarUpdated'), 'success')
      }
    }
    reader.onerror = () => toast(t('settings.profile.avatarReadError'), 'default')
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => {
    if (!avatarUrl) {
      toast(t('settings.profile.avatarNone'), 'default')
      return
    }
    setAvatarUrl(null)
    toast(t('settings.profile.avatarRemoved'), 'default')
  }

  /* -- Export account data: real JSON of the profile + owned designs/collections -- */
  const exportAccountData = () => {
    if (!user) return
    const owned = data.designs.filter((d) => d.ownerId === user.id)
    const collections = data.collections.filter((c) => c.ownerId === user.id)
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        coins: user.coins,
        company,
        handle,
        bio,
        workspace: workspaceName,
        region,
        accent,
      },
      designs: owned,
      collections,
    }
    downloadJson(payload, `threados-account-${slugify(user.name)}.json`)
    toast(t('settings.profile.exported'), 'success')
  }

  /* -- Transfer ownership: pick a member, confirm, then promote in the roster -- */
  const eligibleOwners = members.filter((m) => !m.owner && !m.pending)

  const openTransfer = () => {
    if (eligibleOwners.length === 0) {
      toast(t('settings.team.inviteNeeded'), 'default')
      setActive('team')
      return
    }
    setDeleteOpen(false)
    setTransferOpen(true)
  }

  const confirmTransfer = () => {
    const to = members.find((m) => m.id === transferTo)
    if (!to) {
      toast(t('settings.team.chooseOwner'), 'default')
      return
    }
    setMembers((prev) => prev.map((m) => (m.id === to.id ? { ...m, role: 'Owner', owner: true } : m)))
    setOwnershipTransferred(true)
    setTransferOpen(false)
    setTransferTo('')
    toast(t('settings.team.transferred', { name: to.name }), 'success')
    setActive('team')
  }

  /* -- Delete workspace: backup first, then really clear local loom studios data -- */
  const deletePhrase = workspaceName.trim() || 'DELETE'

  const confirmDeleteWorkspace = () => {
    if (deleteConfirm.trim() !== deletePhrase) return
    downloadJson(
      { exportedAt: new Date().toISOString(), workspace: workspaceName, region, data },
      `threados-${slugify(workspaceName || 'workspace')}-backup.json`,
    )
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('threados-')) doomed.push(key)
    }
    doomed.forEach((key) => localStorage.removeItem(key))
    // Give the backup download a beat to start, then reload into the fresh state.
    window.setTimeout(() => window.location.reload(), 500)
  }

  /* -- Real plan + coins from the signed-in user -- */
  const planName = user?.plan ?? 'Studio'
  // Plans are priced in COINS — never currency. Currency lives only on the coin packs (Earn Coins page).
  const planCoinsPerMonth = planTier(planName).coinsPerMonth
  const planPriceLabel = planCoinsPerMonth === 0 ? 'Free' : `${planCoinsPerMonth.toLocaleString()} coins / month`
  const coins = user?.coins ?? 0
  const coinCap = planTier(planName).coinCap
  const coinPct = Math.min(100, Math.round((coins / coinCap) * 100))
  const storage = useStorageEstimate() // real browser storage — no fabricated GB figures
  const memberCount = members.length + 1 // + the owner (you)

  /* -- Download a plan summary. There is no payment processor wired yet, so this is an honest
     account summary — not a paid tax invoice with an invented card. -- */
  const downloadInvoice = () => {
    if (!user) return
    const now = new Date()
    const body = [
      'loom studios — PLAN SUMMARY',
      '=======================',
      '',
      `Date:         ${now.toISOString().slice(0, 10)}`,
      `Account:      ${user.name} <${user.email}>`,
      `Workspace:    ${workspaceName}`,
      '',
      'Plan                                List price',
      '-------------------------------------------',
      `${planName} plan (monthly)`.padEnd(36) + planPriceLabel,
      '-------------------------------------------',
      '',
      'Billing is not connected yet — no payment has been processed and no',
      'card is on file. This document is a plan summary, not a tax invoice.',
      '',
      'Thank you for building with loom studios.',
    ].join('\n')
    downloadText(body, `threados-plan-summary-${now.toISOString().slice(0, 10)}.txt`)
    toast(t('settings.billing.downloadedToast'), 'info')
  }

  return (
    <SuitePage
      eyebrow={t('settings.title')}
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      actions={
        <>
          <button className="s-btn s-btn--subtle" type="button" onClick={documentation}>
            {t('settings.documentation')}
          </button>
          <button
            className="s-btn s-btn--accent"
            type="button"
            onClick={saveProfile}
            disabled={!isDirty}
            title={isDirty ? t('settings.save.title.dirty') : t('settings.save.title.clean')}
          >
            <IcoCheck width="16" height="16" /> {t('settings.save')}
          </button>
        </>
      }
    >
      <div className="set-shell">
        {/* ---------- Left sub-nav ---------- */}
        <nav className="set-nav" aria-label={t('settings.nav.aria')}>
          <div className="set-nav__group">
            <span className="set-nav__group-label">{t('settings.nav.account')}</span>
          </div>
          {NAV.map((item) => {
            const Icon = item.icon
            const isActive = item.key === active
            const count = item.key === 'team' ? String(memberCount) : undefined
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
                {navLabel(item.key)}
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
                <h2>{t('settings.profile.title')}</h2>
                <p>{t('settings.profile.desc')}</p>
              </div>
              <div className="set-head-actions">
                <span className="s-chip s-chip--good">
                  <IcoCheck width="12" height="12" /> {t('settings.profile.verified')}
                </span>
                <button className="s-btn s-btn--subtle" type="button" onClick={exportAccountData}>
                  <IcoUpload width="15" height="15" /> {t('settings.profile.exportData')}
                </button>
              </div>
            </div>
            <div className="set-card__body">
              {/* Avatar row */}
              <div className="set-avatar-row">
                <div className="set-avatar">
                  <span className="set-avatar__ring" aria-hidden="true" />
                  {avatarUrl ? (
                    <img className="set-avatar__img" src={avatarUrl} alt={t('settings.profile.avatarAlt')} />
                  ) : (
                    avatarInitials
                  )}
                </div>
                <div className="set-avatar-meta">
                  <b>{name || user?.name || t('settings.profile.yourName')}</b>
                  <span>{t('settings.profile.avatarHint')}</span>
                </div>
                <div className="set-avatar-actions">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={onAvatarPicked}
                  />
                  <button className="s-btn s-btn--ghost" type="button" onClick={uploadAvatar}>
                    <IcoUpload width="15" height="15" /> {t('settings.profile.upload')}
                  </button>
                  <button className="s-btn s-btn--subtle" type="button" onClick={removeAvatar}>
                    {t('settings.profile.remove')}
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="set-fields">
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-name">
                    {t('settings.profile.fullName')}
                  </label>
                  <input
                    id="set-name"
                    className="set-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('settings.profile.yourName')}
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-email">
                    {t('settings.profile.email')}
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
                    {t('settings.profile.company')}
                  </label>
                  <input
                    id="set-company"
                    className="set-input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={t('settings.profile.companyPlaceholder')}
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-handle">
                    {t('settings.profile.handle')}
                  </label>
                  <div className="set-input-wrap">
                    <span className="set-input-wrap__prefix">threados.co/</span>
                    <input
                      id="set-handle"
                      className="set-input"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase())}
                      placeholder={t('settings.profile.handlePlaceholder')}
                    />
                    <span className="set-input-wrap__suffix">
                      <IcoCheck width="13" height="13" /> {t('settings.profile.handleAvailable')}
                    </span>
                  </div>
                </div>
                <div className="set-field set-field--full">
                  <label className="set-field__label" htmlFor="set-bio">
                    {t('settings.profile.bio')}
                    <span className="set-field__opt">{t('settings.profile.optional')}</span>
                  </label>
                  <input
                    id="set-bio"
                    className="set-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('settings.profile.bioPlaceholder')}
                  />
                  <span className="set-hint">{t('settings.profile.bioHint')}</span>
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
                <h2>{t('settings.workspace.title')}</h2>
                <p>{t('settings.workspace.desc', { name: workspaceName || t('settings.workspace.thisWorkspace') })}</p>
              </div>
              <span className="s-chip s-chip--good">
                <IcoCheck width="12" height="12" /> {t('settings.workspace.active')}
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-fields">
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-ws-name">
                    {t('settings.workspace.name')}
                  </label>
                  <input
                    id="set-ws-name"
                    className="set-input"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder={t('settings.workspace.name')}
                  />
                </div>
                <div className="set-field">
                  <label className="set-field__label" htmlFor="set-ws-region">
                    {t('settings.workspace.region')}
                  </label>
                  <select
                    id="set-ws-region"
                    className="set-input"
                    value={region}
                    onChange={(e) => {
                      setRegion(e.target.value)
                      toast(t('settings.workspace.regionSet', { region: regionLabel(e.target.value) }), 'default')
                    }}
                  >
                    {REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {regionLabel(r.id)}
                      </option>
                    ))}
                  </select>
                  <span className="set-hint">{t('settings.workspace.regionHint')}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ===== Danger zone ===== */}
          <section className="set-card set-card--danger">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>{t('settings.danger.title')}</h2>
                <p>{t('settings.danger.desc')}</p>
              </div>
            </div>
            <div className="set-card__body">
              <div className="set-danger-row">
                <div className="set-danger-row__text" style={{ flex: 1 }}>
                  <b>{t('settings.danger.transferTitle')}</b>
                  <p>{t('settings.danger.transferDesc')}</p>
                  {transferOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <select
                        className="set-input"
                        style={{ maxWidth: 260 }}
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        aria-label={t('settings.danger.newOwnerAria')}
                      >
                        <option value="">{t('settings.danger.chooseMember')}</option>
                        {eligibleOwners.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {roleLabel(m.role)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="set-btn-danger"
                        type="button"
                        disabled={!transferTo}
                        onClick={confirmTransfer}
                      >
                        {t('settings.danger.confirmTransfer')}
                      </button>
                      <button
                        className="s-btn s-btn--subtle"
                        type="button"
                        onClick={() => {
                          setTransferOpen(false)
                          setTransferTo('')
                        }}
                      >
                        {t('settings.common.cancel')}
                      </button>
                    </div>
                  )}
                </div>
                {!transferOpen && (
                  <button
                    className="set-btn-danger"
                    type="button"
                    onClick={openTransfer}
                    disabled={ownershipTransferred}
                    title={ownershipTransferred ? t('settings.danger.transferredTitle') : undefined}
                  >
                    <IcoLogout width="15" height="15" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                    {t('settings.danger.transfer')}
                  </button>
                )}
              </div>
              <div className="set-danger-row">
                <div className="set-danger-row__text" style={{ flex: 1 }}>
                  <b>{t('settings.danger.deleteTitle')}</b>
                  <p>{t('settings.danger.deleteDesc')}</p>
                  {deleteOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <input
                        className="set-input"
                        style={{ maxWidth: 260 }}
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={t('settings.danger.deleteTypePlaceholder', { phrase: deletePhrase })}
                        aria-label={t('settings.danger.deleteTypeAria', { phrase: deletePhrase })}
                      />
                      <button
                        className="set-btn-danger"
                        type="button"
                        disabled={deleteConfirm.trim() !== deletePhrase}
                        onClick={confirmDeleteWorkspace}
                      >
                        {t('settings.danger.deleteForever')}
                      </button>
                      <button
                        className="s-btn s-btn--subtle"
                        type="button"
                        onClick={() => {
                          setDeleteOpen(false)
                          setDeleteConfirm('')
                        }}
                      >
                        {t('settings.common.cancel')}
                      </button>
                    </div>
                  )}
                </div>
                {!deleteOpen && (
                  <button
                    className="set-btn-danger"
                    type="button"
                    onClick={() => {
                      setTransferOpen(false)
                      setDeleteOpen(true)
                    }}
                  >
                    {t('settings.danger.deleteTitle')}
                  </button>
                )}
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
                <h2>{t('settings.brand.accentTitle')}</h2>
                <p>{t('settings.brand.accentDesc')}</p>
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
                {accentLabel(accent)}
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-field">
                <span className="set-field__label">{t('settings.brand.accentColor')}</span>
                <div className="set-swatches" role="radiogroup" aria-label={t('settings.brand.accentGroupAria')}>
                  {ACCENTS.map((sw) => {
                    const isActive = sw.id === accent
                    return (
                      <button
                        key={sw.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={accentLabel(sw.id)}
                        title={accentLabel(sw.id)}
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
                    aria-label={t('settings.brand.customColor')}
                    title={t('settings.brand.customColorTitle')}
                    onClick={() => {
                      toast(t('settings.brand.customToast'), 'accent')
                      setActive('billing')
                    }}
                  >
                    <IcoSparkle width="15" height="15" />
                  </button>
                </div>
                <span className="set-hint">{t('settings.brand.accentHint')}</span>
              </div>
            </div>
          </section>

          {/* ===== Notifications — toggles ===== */}
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>{t('settings.notif.title')}</h2>
                <p>{t('settings.notif.desc')}</p>
              </div>
              <span className="s-chip s-chip--accent">
                <IcoBell width="12" height="12" /> {t('settings.notif.channels')}
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-toggles">
                {toggles.map((tog) => (
                  <div className="set-toggle-row" key={tog.id}>
                    <div className="set-toggle-text">
                      <b>{notifTitle(tog.id)}</b>
                      <small>{notifSub(tog.id)}</small>
                    </div>
                    <Switch on={tog.on} onToggle={() => handleToggle(tog.id)} label={notifTitle(tog.id)} />
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
                <h2>{t('settings.billing.title')}</h2>
                <p>{t('settings.billing.desc')}</p>
              </div>
              <button className="s-btn s-btn--subtle" type="button" onClick={billingHistory}>
                {t('settings.billing.exportSummary')}
              </button>
            </div>
            <div className="set-card__body">
              <div className="set-plan">
                <div>
                  <div className="set-plan__name">
                    <span className="set-plan__ico">
                      <IcoBolt width="17" height="17" />
                    </span>
                    {t('settings.billing.planName', { plan: planName })}
                    <span className="s-chip s-chip--accent">{t('settings.billing.current')}</span>
                  </div>
                  <p className="set-plan__desc">
                    {t('settings.billing.planDesc', { n: SEAT_LIMIT })}
                  </p>
                </div>
                <div className="set-plan__price">
                  {planCoinsPerMonth === 0 ? (
                    <b>{t('common.free')}</b>
                  ) : (
                    <>
                      <b>{planCoinsPerMonth.toLocaleString()}</b>
                      <span>{t('rewards.balance.coins')} {t('settings.billing.perMonth')}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="set-meters">
                <div className="set-meter">
                  <div className="set-meter__top">
                    <span className="set-meter__label">
                      <span className="set-meter__label-ico">
                        <IcoCoins width="15" height="15" />
                      </span>
                      {t('settings.billing.coins')}
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
                      {t('settings.billing.storage')}
                    </span>
                    <span className="set-meter__val">
                      {storage.ready ? (
                        storage.pct !== null ? (
                          <>
                            <b>{storage.usedLabel}</b> / {formatBytesLabel(storage.quotaBytes)}
                          </>
                        ) : (
                          <b>{storage.usedLabel}</b>
                        )
                      ) : (
                        <b>{t('settings.billing.measuring')}</b>
                      )}
                    </span>
                  </div>
                  {storage.pct !== null && (
                    <div className="set-bar">
                      <span
                        className={`set-bar__fill${storage.pct >= 85 ? ' set-bar__fill--warn' : ''}`}
                        style={{ width: `${Math.max(2, storage.pct)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="set-billing-foot">
                <span className="set-billing-foot__note">
                  {planName === 'Free'
                    ? t('settings.billing.noteFree')
                    : t('settings.billing.noteConnected')}
                </span>
                <div className="set-billing-foot__actions">
                  <button className="s-btn s-btn--subtle" type="button" onClick={downloadInvoice}>
                    <IcoUpload width="15" height="15" /> {t('settings.billing.downloadSummary')}
                  </button>
                  <button className="s-btn s-btn--accent" type="button" onClick={() => navigate('/suite/pricing')}>
                    <IcoStar width="16" height="16" /> {t('shell.upgrade')}
                  </button>
                </div>
              </div>
            </div>
          </section>
          )}

          {/* ===== Team ===== */}
          {active === 'team' && (
          <section className="set-card">
            <div className="set-card__head">
              <div className="set-card__head-text">
                <h2>{t('settings.team.title')}</h2>
                <p>{t('settings.team.seats', { used: memberCount, total: SEAT_LIMIT, plan: planName })}</p>
              </div>
              <form style={{ display: 'flex', gap: 8 }} onSubmit={submitInvite}>
                <input
                  className="set-input"
                  style={{ width: 220 }}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@brand.com"
                  aria-label={t('settings.team.inviteAria')}
                />
                <button className="s-btn s-btn--ghost" type="submit">
                  <IcoCommunity width="15" height="15" /> {t('settings.team.invite')}
                </button>
              </form>
            </div>
            <div className="set-card__body">
              <div className="set-members">
                {/* Owner (the signed-in user) */}
                <div className="set-member">
                  <span className="set-member__av set-member__av--accent">{avatarInitials}</span>
                  <div className="set-member__info">
                    <span className="set-member__name">
                      {name || user?.name || t('settings.team.you')}
                      <span className="s-chip s-chip--accent">{t('settings.team.you')}</span>
                    </span>
                    <span className="set-member__email">{email || user?.email}</span>
                  </div>
                  <div className="set-member__right">
                    {ownershipTransferred ? (
                      <span className="set-role" title={t('settings.team.ownerTransferredTitle')}>
                        {roleLabel('Admin')}
                      </span>
                    ) : (
                      <span className="set-role set-role--owner" title={t('settings.team.youOwnTitle')}>
                        {roleLabel('Owner')}
                      </span>
                    )}
                  </div>
                </div>

                {members.map((m) => (
                  <div className="set-member" key={m.id}>
                    <span className="set-member__av">{m.initials}</span>
                    <div className="set-member__info">
                      <span className="set-member__name">
                        {m.name}
                        {m.owner && <span className="s-chip s-chip--accent">{roleLabel('Owner')}</span>}
                      </span>
                      <span className="set-member__email">
                        {m.pending ? t('settings.team.invitedPending') : m.email}
                      </span>
                    </div>
                    <div className="set-member__right">
                      {m.owner ? (
                        <span className="set-role set-role--owner" title={t('settings.team.ownerRoleTitle')}>
                          {roleLabel('Owner')}
                        </span>
                      ) : m.pending ? (
                        <>
                          <span className="set-role" title={t('settings.team.invitedTitle')}>
                            {roleLabel('Invited')}
                          </span>
                          <button
                            className="set-member__more"
                            type="button"
                            aria-label={t('settings.team.revokeAria', { email: m.email })}
                            title={t('settings.team.revokeAria', { email: m.email })}
                            onClick={() => removeMember(m)}
                          >
                            <IcoDots width="16" height="16" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="set-role"
                            type="button"
                            onClick={() => cycleRole(m)}
                            title={t('settings.team.changeRoleTitle')}
                          >
                            {roleLabel(m.role)}
                            <IcoChevron width="13" height="13" />
                          </button>
                          <button
                            className="set-member__more"
                            type="button"
                            aria-label={t('settings.team.removeAria', { name: m.name })}
                            title={t('settings.team.removeAria', { name: m.name })}
                            onClick={() => removeMember(m)}
                          >
                            <IcoDots width="16" height="16" />
                          </button>
                        </>
                      )}
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
                <h2>{t('settings.integ.title')}</h2>
                <p>{t('settings.integ.desc')}</p>
              </div>
              <span className="s-chip">
                <IcoMarketplace width="12" height="12" /> {t('settings.integ.comingSoon')}
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-toggles">
                {INTEGRATIONS.map((it) => (
                  <div className="set-toggle-row" key={it.id}>
                    <div className="set-toggle-text">
                      <b>{it.name}</b>
                      <small>{integDesc(it.id)}</small>
                    </div>
                    <span
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
                    >
                      <span className="set-hint">{t('settings.integ.comingSoon')}</span>
                      <Switch on={false} disabled label={t('settings.integ.switchLabel', { name: it.name })} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}

          {/* ===== AI ===== */}
          {active === 'ai' && <AiSettings />}

          {/* ===== App tour ===== */}
          {active === 'tour' && (
            <section className="set-card">
              <div className="set-card__head">
                <div className="set-card__head-text">
                  <h2>{t('settings.tour.title')}</h2>
                  <p>{t('settings.tour.desc')}</p>
                </div>
                <span className="s-chip s-chip--accent">{t('settings.tour.chip')}</span>
              </div>
              <div className="set-card__body">
                <p className="set-hint">{t('settings.tour.hint')}</p>
                <div style={{ marginTop: 12 }}>
                  <button className="s-btn s-btn--accent" type="button" onClick={requestTour}>
                    <IcoSparkle width="16" height="16" /> {t('settings.tour.start')}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ===== Sticky save bar ===== */}
          {isDirty && (
            <div className="set-savebar">
              <span className="set-savebar__text">
                <span className="set-savebar__dot" aria-hidden="true" />
                {t('settings.savebar.unsaved')}
              </span>
              <div className="set-savebar__actions">
                <button className="s-btn s-btn--subtle" type="button" onClick={discard}>
                  {t('settings.savebar.discard')}
                </button>
                <button className="s-btn s-btn--accent" type="button" onClick={saveProfile}>
                  <IcoCheck width="16" height="16" /> {t('settings.save')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SuitePage>
  )
}
