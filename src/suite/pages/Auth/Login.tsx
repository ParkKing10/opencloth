import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useT, LanguageToggle } from '@/i18n'
import { useAuth } from '../../auth/auth'
import { DEMO_CREDENTIALS } from '../../data/seed'
import { isSupabaseConfigured } from '../../../lib/supabase'
import { AuthBrand } from './AuthBrand'
import './auth-screen.css'

type LocationState = { from?: string }

const DEMO_NAMES = { user: 'Mike Carter', admin: 'Ava Reyes' } as const

export function Login() {
  const t = useT()
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent, creds?: { email: string; password: string }) {
    e.preventDefault()
    const em = creds?.email ?? email
    const pw = creds?.password ?? password
    setBusy(true)
    setError('')
    const res = await login(em, pw)
    setBusy(false)
    if (res.ok) navigate(from, { replace: true })
    else setError(res.error ?? t('auth.err.couldNotSignIn'))
  }

  async function fillDemo(role: 'user' | 'admin') {
    const creds = DEMO_CREDENTIALS[role]
    setEmail(creds.email)
    setPassword(creds.password)
    setBusy(true)
    setError('')
    let res = await login(creds.email, creds.password)
    // In Supabase mode the demo account may not exist yet — create it, then sign in.
    if (!res.ok && isSupabaseConfigured) {
      const created = await signup(DEMO_NAMES[role], creds.email, creds.password)
      res = created.ok ? created : await login(creds.email, creds.password)
    }
    setBusy(false)
    if (res.ok) navigate(from, { replace: true })
    else setError(res.error ?? t('auth.err.couldNotSignIn'))
  }

  return (
    <div className="suite">
      <div className="auth">
        <AuthBrand />
        <main className="auth__panel">
          <Link className="auth__back" to="/">
            ← {t('auth.backToSite')}
          </Link>
          <LanguageToggle variant="ghost" />
          <div className="auth__card">
            <h1 className="auth__title">{t('auth.login.title')}</h1>
            <p className="auth__sub">{t('auth.login.sub')}</p>

            <form className="auth__form" onSubmit={(e) => submit(e)}>
              <div className="auth__field">
                <label className="auth__label" htmlFor="login-email">
                  {t('auth.field.email')}
                </label>
                <input
                  id="login-email"
                  className="auth__input"
                  type="email"
                  autoComplete="email"
                  placeholder={t('auth.field.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="auth__field">
                <label className="auth__label" htmlFor="login-pw">
                  {t('auth.field.password')}
                </label>
                <input
                  id="login-pw"
                  className="auth__input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <div className="auth__error">{error}</div>}

              <button className="auth__submit" type="submit" disabled={busy}>
                {busy ? t('auth.login.busy') : t('auth.login.submit')}
              </button>
            </form>

            <div className="auth__demo">
              <div className="auth__demo-head">{t('auth.login.demoHead')}</div>
              <div className="auth__demo-row">
                <button className="auth__demo-btn" type="button" onClick={() => fillDemo('user')}>
                  {t('auth.login.demoCreator')}
                </button>
                <button className="auth__demo-btn" type="button" onClick={() => fillDemo('admin')}>
                  {t('auth.login.demoAdmin')}
                </button>
              </div>
            </div>

            <p className="auth__alt">
              {t('auth.login.noAccount')}
              <Link to="/signup">{t('auth.login.createOne')}</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
