import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid } from '../../data/utils'
import { downloadCsv, downloadJson, downloadText, slugify } from '../../lib/download'
import { useStorageEstimate, formatBytes as formatBytesLabel } from '../../lib/useStorageEstimate'
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

/** Next plan up from the current one, or null when already on the top tier. */
const PLAN_ORDER = ['Free', 'Studio', 'Scale'] as const
type Plan = (typeof PLAN_ORDER)[number]
function nextPlan(plan: Plan): Plan | null {
  const idx = PLAN_ORDER.indexOf(plan)
  return idx >= 0 && idx < PLAN_ORDER.length - 1 ? PLAN_ORDER[idx + 1] : null
}

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
]

export function Settings() {
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const location = useLocation()

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
    if (!EMAIL_RE.test(cleanEmail)) {
      toast('Enter a valid email address.', 'default')
      setActive('profile')
      return
    }
    const clash = data.users.some((u) => u.id !== user.id && u.email.toLowerCase() === cleanEmail)
    if (clash) {
      toast('That email is already used by another account.', 'default')
      return
    }
    const nextProfile: StoredProfile = { company: company.trim(), handle: handle.trim(), bio: bio.trim() }
    try {
      localStorage.setItem(profileKey(user.id), JSON.stringify(nextProfile))
    } catch {
      toast('Could not save — browser storage is unavailable.', 'default')
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
    toast('Profile saved', 'success')
  }

  const discard = () => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setCompany(savedProfile.company)
    setHandle(savedProfile.handle)
    setBio(savedProfile.bio)
    toast('Reverted to your last saved profile', 'default')
  }

  const submitInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (members.length + 1 >= SEAT_LIMIT) {
      toast(`All ${SEAT_LIMIT} seats are in use — upgrade to add more.`, 'default')
      setActive('billing')
      return
    }
    const clean = inviteEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(clean)) {
      toast('Enter a valid email address to invite.', 'default')
      return
    }
    const ownEmail = (email.trim() || user?.email || '').toLowerCase()
    if (clean === ownEmail || members.some((m) => m.email.toLowerCase() === clean)) {
      toast('That email is already on this team.', 'default')
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
    toast(`Invite for ${clean} recorded — email delivery arrives with the backend.`, 'success')
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
    toast(m.pending ? `Invite for ${m.email} revoked` : `${m.name} removed from the workspace`, 'default')
  }

  /* -- Upgrade: real plan change persisted to the store -- */
  const upgrade = () => {
    if (!user) return
    const target = nextPlan(user.plan as Plan)
    if (!target) {
      toast('You are already on the top plan.', 'default')
      return
    }
    mutate((d) => ({
      ...d,
      users: d.users.map((u) => (u.id === user.id ? { ...u, plan: target } : u)),
    }))
    toast(`Upgraded to the ${target} plan`, 'success')
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
    toast('Plan summary exported — no charges have been processed yet.', 'info')
  }

  /* -- Documentation: real navigation to the docs site -- */
  const documentation = () => {
    window.open(DOCS_URL, '_blank', 'noopener,noreferrer')
    toast('Opening the THREADOS documentation', 'info')
  }

  /* -- Avatar upload: real file picker → data URL → visible avatar image -- */
  const uploadAvatar = () => avatarInputRef.current?.click()

  const onAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Choose a PNG or JPG image.', 'default')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast('Image is over 4MB — choose a smaller file.', 'default')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result)
        toast('Avatar updated', 'success')
      }
    }
    reader.onerror = () => toast('Could not read that image — try another file.', 'default')
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => {
    if (!avatarUrl) {
      toast('No avatar image to remove.', 'default')
      return
    }
    setAvatarUrl(null)
    toast('Avatar removed — using your initials.', 'default')
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
    toast('Account data exported', 'success')
  }

  /* -- Transfer ownership: pick a member, confirm, then promote in the roster -- */
  const eligibleOwners = members.filter((m) => !m.owner && !m.pending)

  const openTransfer = () => {
    if (eligibleOwners.length === 0) {
      toast('Invite a teammate before transferring ownership.', 'default')
      setActive('team')
      return
    }
    setDeleteOpen(false)
    setTransferOpen(true)
  }

  const confirmTransfer = () => {
    const to = members.find((m) => m.id === transferTo)
    if (!to) {
      toast('Choose a member to receive ownership.', 'default')
      return
    }
    setMembers((prev) => prev.map((m) => (m.id === to.id ? { ...m, role: 'Owner', owner: true } : m)))
    setOwnershipTransferred(true)
    setTransferOpen(false)
    setTransferTo('')
    toast(`${to.name} is now the workspace owner — recorded in this workspace.`, 'success')
    setActive('team')
  }

  /* -- Delete workspace: backup first, then really clear local THREADOS data -- */
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
  const planPriceLabel = planName === 'Scale' ? '$199' : planName === 'Studio' ? '$79' : '$0'
  const coins = user?.coins ?? 0
  const coinCap = planName === 'Scale' ? 100000 : planName === 'Studio' ? 25000 : 2500
  const coinPct = Math.min(100, Math.round((coins / coinCap) * 100))
  const storage = useStorageEstimate() // real browser storage — no fabricated GB figures
  const memberCount = members.length + 1 // + the owner (you)

  /* -- Download a plan summary. There is no payment processor wired yet, so this is an honest
     account summary — not a paid tax invoice with an invented card. -- */
  const downloadInvoice = () => {
    if (!user) return
    const now = new Date()
    const body = [
      'THREADOS — PLAN SUMMARY',
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
      'Thank you for building with THREADOS.',
    ].join('\n')
    downloadText(body, `threados-plan-summary-${now.toISOString().slice(0, 10)}.txt`)
    toast('Plan summary downloaded — no payment has been processed.', 'info')
  }

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
              <div className="set-head-actions">
                <span className="s-chip s-chip--good">
                  <IcoCheck width="12" height="12" /> Verified
                </span>
                <button className="s-btn s-btn--subtle" type="button" onClick={exportAccountData}>
                  <IcoUpload width="15" height="15" /> Export data
                </button>
              </div>
            </div>
            <div className="set-card__body">
              {/* Avatar row */}
              <div className="set-avatar-row">
                <div className="set-avatar">
                  <span className="set-avatar__ring" aria-hidden="true" />
                  {avatarUrl ? (
                    <img className="set-avatar__img" src={avatarUrl} alt="Your avatar" />
                  ) : (
                    avatarInitials
                  )}
                </div>
                <div className="set-avatar-meta">
                  <b>{name || user?.name || 'Your name'}</b>
                  <span>PNG or JPG, up to 4MB. 512×512 recommended.</span>
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
                <div className="set-danger-row__text" style={{ flex: 1 }}>
                  <b>Transfer ownership</b>
                  <p>
                    Move this workspace to another team member. The change is recorded in this
                    workspace — no emails are sent.
                  </p>
                  {transferOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <select
                        className="set-input"
                        style={{ maxWidth: 260 }}
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        aria-label="New workspace owner"
                      >
                        <option value="">Choose a member…</option>
                        {eligibleOwners.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.role}
                          </option>
                        ))}
                      </select>
                      <button
                        className="set-btn-danger"
                        type="button"
                        disabled={!transferTo}
                        onClick={confirmTransfer}
                      >
                        Confirm transfer
                      </button>
                      <button
                        className="s-btn s-btn--subtle"
                        type="button"
                        onClick={() => {
                          setTransferOpen(false)
                          setTransferTo('')
                        }}
                      >
                        Cancel
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
                    title={ownershipTransferred ? 'Ownership already transferred' : undefined}
                  >
                    <IcoLogout width="15" height="15" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                    Transfer
                  </button>
                )}
              </div>
              <div className="set-danger-row">
                <div className="set-danger-row__text" style={{ flex: 1 }}>
                  <b>Delete workspace</b>
                  <p>
                    Downloads a backup, then permanently deletes all THREADOS data stored in this
                    browser — designs, garments, tech packs, drive files and preferences — and
                    reloads the app to a fresh state.
                  </p>
                  {deleteOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      <input
                        className="set-input"
                        style={{ maxWidth: 260 }}
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={`Type “${deletePhrase}” to confirm`}
                        aria-label={`Type ${deletePhrase} to confirm deletion`}
                      />
                      <button
                        className="set-btn-danger"
                        type="button"
                        disabled={deleteConfirm.trim() !== deletePhrase}
                        onClick={confirmDeleteWorkspace}
                      >
                        Delete forever
                      </button>
                      <button
                        className="s-btn s-btn--subtle"
                        type="button"
                        onClick={() => {
                          setDeleteOpen(false)
                          setDeleteConfirm('')
                        }}
                      >
                        Cancel
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
                    Delete workspace
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
                Export plan summary
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
                      {storage.ready ? (
                        storage.pct !== null ? (
                          <>
                            <b>{storage.usedLabel}</b> / {formatBytesLabel(storage.quotaBytes)}
                          </>
                        ) : (
                          <b>{storage.usedLabel}</b>
                        )
                      ) : (
                        <b>Measuring…</b>
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
                    ? 'Free plan — no billing set up.'
                    : 'Billing isn’t connected yet — no card on file, no charges processed.'}
                </span>
                <div className="set-billing-foot__actions">
                  <button className="s-btn s-btn--subtle" type="button" onClick={downloadInvoice}>
                    <IcoUpload width="15" height="15" /> Download plan summary
                  </button>
                  {nextPlan(planName as Plan) ? (
                    <button className="s-btn s-btn--accent" type="button" onClick={upgrade}>
                      <IcoStar width="16" height="16" /> Upgrade to {nextPlan(planName as Plan)}
                    </button>
                  ) : (
                    <span className="s-chip s-chip--accent">
                      <IcoStar width="13" height="13" /> Top plan
                    </span>
                  )}
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
                <h2>Team members</h2>
                <p>
                  {memberCount} of {SEAT_LIMIT} seats used on the {planName} plan.
                </p>
              </div>
              <form style={{ display: 'flex', gap: 8 }} onSubmit={submitInvite}>
                <input
                  className="set-input"
                  style={{ width: 220 }}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@brand.com"
                  aria-label="Invite by email"
                />
                <button className="s-btn s-btn--ghost" type="submit">
                  <IcoCommunity width="15" height="15" /> Invite
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
                      {name || user?.name || 'You'}
                      <span className="s-chip s-chip--accent">You</span>
                    </span>
                    <span className="set-member__email">{email || user?.email}</span>
                  </div>
                  <div className="set-member__right">
                    {ownershipTransferred ? (
                      <span className="set-role" title="Ownership was transferred">
                        Admin
                      </span>
                    ) : (
                      <span className="set-role set-role--owner" title="You own this workspace">
                        Owner
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
                        {m.owner && <span className="s-chip s-chip--accent">Owner</span>}
                      </span>
                      <span className="set-member__email">
                        {m.pending ? 'Invited · pending' : m.email}
                      </span>
                    </div>
                    <div className="set-member__right">
                      {m.owner ? (
                        <span className="set-role set-role--owner" title="Workspace owner">
                          Owner
                        </span>
                      ) : m.pending ? (
                        <>
                          <span className="set-role" title="Invite recorded locally — awaiting backend email delivery">
                            Invited
                          </span>
                          <button
                            className="set-member__more"
                            type="button"
                            aria-label={`Revoke invite for ${m.email}`}
                            title={`Revoke invite for ${m.email}`}
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
                <h2>Integrations</h2>
                <p>Connections to outside tools are in development and are not live yet.</p>
              </div>
              <span className="s-chip">
                <IcoMarketplace width="12" height="12" /> Coming soon
              </span>
            </div>
            <div className="set-card__body">
              <div className="set-toggles">
                {INTEGRATIONS.map((it) => (
                  <div className="set-toggle-row" key={it.id}>
                    <div className="set-toggle-text">
                      <b>{it.name}</b>
                      <small>{it.desc}</small>
                    </div>
                    <span
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
                    >
                      <span className="set-hint">Coming soon</span>
                      <Switch on={false} disabled label={`${it.name} integration — coming soon`} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}

          {/* ===== AI ===== */}
          {active === 'ai' && <AiSettings />}

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
